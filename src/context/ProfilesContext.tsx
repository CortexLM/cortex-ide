import {
  createContext,
  useContext,
  ParentProps,
  createEffect,
  onMount,
  onCleanup,
  Accessor,
  batch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { type CortexSettings } from "./SettingsContext";
import { createLogger } from "../utils/logger";

const profilesLogger = createLogger("Profiles");

// ============================================================================
// Profile Type Definitions
// ============================================================================

/** Keybinding entry stored per profile */
export interface KeyBinding {
  command: string;
  key: string;
  when?: string;
  args?: Record<string, unknown>;
}

/** UI state that can be saved per profile */
export interface ProfileUIState {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  panelHeight: number;
  panelCollapsed: boolean;
  activityBarVisible: boolean;
  statusBarVisible: boolean;
  zenMode: boolean;
  activeActivityBarItem: string;
  explorerExpandedFolders: string[];
  auxiliaryBarWidth: number;
  auxiliaryBarCollapsed: boolean;
}

/** A complete user profile containing all customizable state */
export interface Profile {
  id: string;
  name: string;
  icon?: string;
  isDefault?: boolean;
  settings: Partial<CortexSettings>;
  keybindings: KeyBinding[];
  enabledExtensions: string[];
  snippets?: Record<string, unknown>;
  uiState?: ProfileUIState;
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal profile metadata for display */
export interface ProfileMetadata {
  id: string;
  name: string;
  icon?: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Export format for profiles */
export interface ProfileExportData {
  version: number;
  exportedAt: number;
  profile: Profile;
  checksum?: string;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_UI_STATE: ProfileUIState = {
  sidebarWidth: 260,
  sidebarCollapsed: false,
  panelHeight: 250,
  panelCollapsed: true,
  activityBarVisible: true,
  statusBarVisible: true,
  zenMode: false,
  activeActivityBarItem: "explorer",
  explorerExpandedFolders: [],
  auxiliaryBarWidth: 320,
  auxiliaryBarCollapsed: true,
};

const PROFILE_ICONS = [
  "user", "code", "rocket", "terminal", "bug", "beaker", "briefcase", 
  "book", "coffee", "heart", "star", "sun", "moon", "cloud", "lightning",
  "palette", "gear", "folder", "home", "globe",
];

const STORAGE_KEY = "cortex_profiles_v2";
const ACTIVE_PROFILE_KEY = "cortex_active_profile_v2";

// ============================================================================
// Utility Functions
// ============================================================================

function generateProfileId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function createDefaultProfile(): Profile {
  const now = new Date();
  return {
    id: "default",
    name: "Default",
    icon: "user",
    isDefault: true,
    settings: {},
    keybindings: [],
    enabledExtensions: [],
    snippets: {},
    uiState: { ...DEFAULT_UI_STATE },
    createdAt: now,
    updatedAt: now,
  };
}

// Note: _serializeProfile and _deserializeProfile removed as unused
// deserializeProfiles is used instead which handles arrays of profiles

function deserializeProfiles(json: string): Profile[] {
  const parsed = JSON.parse(json, (key, value) => {
    if (value && typeof value === "object" && value.__type === "Date") {
      return new Date(value.value);
    }
    // Handle legacy number timestamps
    if ((key === "createdAt" || key === "updatedAt") && typeof value === "number") {
      return new Date(value);
    }
    return value;
  });
  return Array.isArray(parsed) ? parsed : [];
}

// ============================================================================
// Context State
// ============================================================================

interface ProfilesState {
  profiles: Profile[];
  activeProfileId: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  showQuickSwitch: boolean;
  showManager: boolean;
}

// ============================================================================
// Context Value
// ============================================================================

export interface ProfilesContextValue {
  // State
  state: ProfilesState;
  
  // Accessors
  profiles: Accessor<Profile[]>;
  activeProfile: Accessor<Profile | null>;
  activeProfileId: Accessor<string | null>;
  showQuickSwitch: Accessor<boolean>;
  showManager: Accessor<boolean>;
  isLoading: Accessor<boolean>;
  
  // Profile CRUD
  createProfile: (name: string, copyFrom?: string) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<boolean>;
  switchProfile: (id: string) => Promise<boolean>;
  updateProfile: (id: string, changes: Partial<Omit<Profile, "id" | "createdAt">>) => Promise<boolean>;
  duplicateProfile: (id: string, newName: string) => Promise<Profile | null>;
  
  // Import/Export
  exportProfile: (id: string) => Promise<string | null>;
  importProfile: (json: string) => Promise<{ success: boolean; error?: string; profile?: Profile }>;
  
  // Profile Data Updates
  updateProfileSettings: (settings: Partial<CortexSettings>) => void;
  updateProfileKeybindings: (keybindings: KeyBinding[]) => void;
  updateProfileExtensions: (extensions: string[]) => void;
  updateProfileUIState: (uiState: Partial<ProfileUIState>) => void;
  
  // UI
  openQuickSwitch: () => void;
  closeQuickSwitch: () => void;
  toggleQuickSwitch: () => void;
  openManager: () => void;
  closeManager: () => void;
  
  // Utilities
  getProfileMetadata: () => ProfileMetadata[];
  getDefaultProfile: () => Profile;
  getAvailableIcons: () => string[];
  isDefaultProfile: (id: string) => boolean;
  setProfileIcon: (id: string, icon: string) => Promise<boolean>;
  renameProfile: (id: string, name: string) => Promise<boolean>;
}

const ProfilesContext = createContext<ProfilesContextValue>();

// ============================================================================
// Storage Operations
// ============================================================================

async function loadProfilesFromStorage(): Promise<{ profiles: Profile[]; activeId: string | null }> {
  try {
    // Try to load from Tauri backend first
    try {
      const result = await invoke<{ profiles: string; activeId: string | null }>("profiles_load");
      if (result.profiles) {
        const profiles = deserializeProfiles(result.profiles);
        if (profiles.length > 0) {
          return { profiles, activeId: result.activeId };
        }
      }
    } catch (err) {
      console.debug("Backend profiles load failed, using localStorage:", err);
    }

    // Fallback to localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    
    if (stored) {
      const profiles = deserializeProfiles(stored);
      if (profiles.length > 0) {
        // Ensure default profile exists
        if (!profiles.find(p => p.id === "default")) {
          profiles.unshift(createDefaultProfile());
        }
        return { profiles, activeId: activeId || profiles[0]?.id || "default" };
      }
    }
  } catch (e) {
    console.error("[ProfilesContext] Failed to load profiles:", e);
  }
  
  // Return default profile if nothing found
  const defaultProfile = createDefaultProfile();
  return { profiles: [defaultProfile], activeId: defaultProfile.id };
}

async function saveProfilesToStorage(profiles: Profile[], activeId: string | null): Promise<void> {
  try {
    const serialized = JSON.stringify(profiles, (_key, value) => {
      if (value instanceof Date) {
        return { __type: "Date", value: value.toISOString() };
      }
      return value;
    });

    // Try to save to Tauri backend
    try {
      await invoke("profiles_save", { profiles: serialized, activeId });
    } catch (err) {
      console.debug("Backend profiles save failed:", err);
    }

    // Always save to localStorage as backup
    localStorage.setItem(STORAGE_KEY, serialized);
    if (activeId) {
      localStorage.setItem(ACTIVE_PROFILE_KEY, activeId);
    }
  } catch (e) {
    console.error("[ProfilesContext] Failed to save profiles:", e);
  }
}

// ============================================================================
// Provider Component
// ============================================================================

export function ProfilesProvider(props: ParentProps) {
  const [state, setState] = createStore<ProfilesState>({
    profiles: [],
    activeProfileId: null,
    loading: true,
    saving: false,
    error: null,
    showQuickSwitch: false,
    showManager: false,
  });

  // Initialize profiles on mount
  onMount(async () => {
    const { profiles, activeId } = await loadProfilesFromStorage();
    batch(() => {
      setState("profiles", profiles);
      setState("activeProfileId", activeId || profiles[0]?.id || null);
      setState("loading", false);
    });
    
    profilesLogger.debug("Loaded", profiles.length, "profiles. Active:", activeId);
    
    // Apply active profile settings on load
    const active = profiles.find(p => p.id === activeId);
    if (active) {
      emitProfileChanged(active);
    }
  });

  // Auto-save on changes
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Cleanup saveTimeout to prevent memory leaks
  onCleanup(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  });
  
  createEffect(() => {
    const profiles = state.profiles;
    const activeId = state.activeProfileId;
    
    if (!state.loading && profiles.length > 0) {
      // Debounce saves
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveProfilesToStorage(profiles, activeId);
      }, 500);
    }
  });

  // Keyboard shortcut for quick switch (Ctrl+Alt+P)
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopPropagation();
        setState("showQuickSwitch", prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // Listen for external events
  onMount(() => {
    const handleSwitchProfile = (e: CustomEvent<{ profileId: string }>) => {
      if (e.detail?.profileId) {
        switchProfile(e.detail.profileId);
      }
    };
    
    const handleOpenManager = () => setState("showManager", true);
    const handleOpenQuickSwitch = () => setState("showQuickSwitch", true);
    
    window.addEventListener("profiles:switch", handleSwitchProfile as EventListener);
    window.addEventListener("profiles:open-manager", handleOpenManager);
    window.addEventListener("profiles:open-quick-switch", handleOpenQuickSwitch);
    
    onCleanup(() => {
      window.removeEventListener("profiles:switch", handleSwitchProfile as EventListener);
      window.removeEventListener("profiles:open-manager", handleOpenManager);
      window.removeEventListener("profiles:open-quick-switch", handleOpenQuickSwitch);
    });
  });

  // Listen for settings changes to sync back to profile
  onMount(() => {
    const handleSettingsChanged = (e: CustomEvent<{ section: string; settings: unknown }>) => {
      const currentProfile = activeProfile();
      if (!currentProfile || currentProfile.id === "default") return;
      
      // Sync settings back to the profile
      const { section, settings } = e.detail;
      if (section && settings) {
        setState(
          produce((s) => {
            const profile = s.profiles.find(p => p.id === s.activeProfileId);
            if (profile) {
              if (!profile.settings) profile.settings = {};
              (profile.settings as Record<string, unknown>)[section] = settings;
              profile.updatedAt = new Date();
            }
          })
        );
      }
    };
    
    window.addEventListener("settings:changed", handleSettingsChanged as EventListener);
    onCleanup(() => {
      window.removeEventListener("settings:changed", handleSettingsChanged as EventListener);
    });
  });

  // Accessors
  const profiles = () => state.profiles;
  const activeProfileId = () => state.activeProfileId;
  const activeProfile = (): Profile | null => {
    const id = state.activeProfileId;
    return state.profiles.find(p => p.id === id) || null;
  };
  const showQuickSwitch = () => state.showQuickSwitch;
  const showManager = () => state.showManager;
  const isLoading = () => state.loading;

  // Emit profile change events
  function emitProfileChanged(profile: Profile): void {
    window.dispatchEvent(
      new CustomEvent("profiles:switched", {
        detail: { profile, profileId: profile.id },
      })
    );
    
    // Emit settings to apply
    if (profile.settings && Object.keys(profile.settings).length > 0) {
      window.dispatchEvent(
        new CustomEvent("settings:profile-apply", {
          detail: { settings: profile.settings },
        })
      );
    }
    
    // Emit keybindings
    if (profile.keybindings && profile.keybindings.length > 0) {
      window.dispatchEvent(
        new CustomEvent("keybindings:profile-apply", {
          detail: { keybindings: profile.keybindings },
        })
      );
    }
    
    // Emit extensions
    if (profile.enabledExtensions && profile.enabledExtensions.length > 0) {
      window.dispatchEvent(
        new CustomEvent("extensions:profile-apply", {
          detail: { extensions: profile.enabledExtensions },
        })
      );
    }
    
    // Emit UI state
    if (profile.uiState) {
      window.dispatchEvent(
        new CustomEvent("ui:profile-apply", {
          detail: { uiState: profile.uiState },
        })
      );
    }
  }

  // Create a new profile
  const createProfile = async (name: string, copyFrom?: string): Promise<Profile> => {
    const now = new Date();
    const sourceProfile = copyFrom 
      ? state.profiles.find(p => p.id === copyFrom) 
      : null;
    
    const newProfile: Profile = {
      id: generateProfileId(),
      name: name.trim() || "New Profile",
      icon: sourceProfile?.icon || "code",
      isDefault: false,
      settings: sourceProfile?.settings ? JSON.parse(JSON.stringify(sourceProfile.settings)) : {},
      keybindings: sourceProfile?.keybindings ? JSON.parse(JSON.stringify(sourceProfile.keybindings)) : [],
      enabledExtensions: sourceProfile?.enabledExtensions ? [...sourceProfile.enabledExtensions] : [],
      snippets: sourceProfile?.snippets ? JSON.parse(JSON.stringify(sourceProfile.snippets)) : {},
      uiState: sourceProfile?.uiState 
        ? JSON.parse(JSON.stringify(sourceProfile.uiState)) 
        : { ...DEFAULT_UI_STATE },
      createdAt: now,
      updatedAt: now,
    };

    setState("profiles", prev => [...prev, newProfile]);
    
    window.dispatchEvent(
      new CustomEvent("profiles:created", { detail: { profile: newProfile } })
    );
    
    profilesLogger.debug("Created profile:", newProfile.name);
    return newProfile;
  };

  // Delete a profile
  const deleteProfile = async (id: string): Promise<boolean> => {
    if (id === "default") {
      profilesLogger.warn("Cannot delete the default profile");
      setState("error", "Cannot delete the default profile");
      return false;
    }

    const profileExists = state.profiles.some(p => p.id === id);
    if (!profileExists) {
      profilesLogger.warn("Profile not found:", id);
      return false;
    }

    // Switch to default if deleting active profile
    if (state.activeProfileId === id) {
      await switchProfile("default");
    }

    setState("profiles", prev => prev.filter(p => p.id !== id));
    
    window.dispatchEvent(
      new CustomEvent("profiles:deleted", { detail: { profileId: id } })
    );
    
    profilesLogger.debug("Deleted profile:", id);
    return true;
  };

  // Switch to a different profile
  const switchProfile = async (id: string): Promise<boolean> => {
    const targetProfile = state.profiles.find(p => p.id === id);
    if (!targetProfile) {
      profilesLogger.warn("Profile not found:", id);
      return false;
    }

    const previousId = state.activeProfileId;
    
    batch(() => {
      setState("activeProfileId", id);
      setState("showQuickSwitch", false);
    });

    // Emit change events
    emitProfileChanged(targetProfile);
    
    window.dispatchEvent(
      new CustomEvent("profiles:switch-complete", {
        detail: { previousId, newId: id, profile: targetProfile },
      })
    );

    profilesLogger.debug("Switched to profile:", targetProfile.name);
    return true;
  };

  // Update a profile
  const updateProfile = async (
    id: string,
    changes: Partial<Omit<Profile, "id" | "createdAt">>
  ): Promise<boolean> => {
    const index = state.profiles.findIndex(p => p.id === id);
    if (index === -1) {
      profilesLogger.warn("Profile not found:", id);
      return false;
    }

    setState(
      produce((s) => {
        const profile = s.profiles[index];
        Object.assign(profile, changes);
        profile.updatedAt = new Date();
      })
    );

    window.dispatchEvent(
      new CustomEvent("profiles:updated", { detail: { profileId: id, changes } })
    );
    
    return true;
  };

  // Duplicate a profile
  const duplicateProfile = async (id: string, newName: string): Promise<Profile | null> => {
    const source = state.profiles.find(p => p.id === id);
    if (!source) {
      profilesLogger.warn("Source profile not found:", id);
      return null;
    }

    return createProfile(newName || `${source.name} (Copy)`, id);
  };

  // Export a profile as JSON
  const exportProfile = async (id: string): Promise<string | null> => {
    const profile = state.profiles.find(p => p.id === id);
    if (!profile) {
      profilesLogger.warn("Profile not found for export:", id);
      return null;
    }

    const exportData: ProfileExportData = {
      version: 2,
      exportedAt: Date.now(),
      profile: JSON.parse(JSON.stringify(profile, (_key, value) => {
        if (value instanceof Date) {
          return { __type: "Date", value: value.toISOString() };
        }
        return value;
      })),
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    exportData.checksum = generateChecksum(jsonString);

    return JSON.stringify(exportData, null, 2);
  };

  // Import a profile from JSON
  const importProfile = async (jsonData: string): Promise<{ success: boolean; error?: string; profile?: Profile }> => {
    try {
      const parsed = JSON.parse(jsonData);
      
      // Validate format
      if (!parsed.profile || typeof parsed.profile !== "object") {
        return { success: false, error: "Invalid profile format: missing profile data" };
      }
      
      if (!parsed.profile.name || typeof parsed.profile.name !== "string") {
        return { success: false, error: "Invalid profile format: missing profile name" };
      }

      const now = new Date();
      const imported = parsed.profile;
      
      // Generate new ID to avoid conflicts
      const newProfile: Profile = {
        id: generateProfileId(),
        name: imported.name || "Imported Profile",
        icon: imported.icon || "folder",
        isDefault: false,
        settings: imported.settings || {},
        keybindings: Array.isArray(imported.keybindings) ? imported.keybindings : [],
        enabledExtensions: Array.isArray(imported.enabledExtensions) ? imported.enabledExtensions : [],
        snippets: imported.snippets || {},
        uiState: imported.uiState || { ...DEFAULT_UI_STATE },
        createdAt: now,
        updatedAt: now,
      };

      // Handle name conflicts
      const existingNames = state.profiles.map(p => p.name.toLowerCase());
      let finalName = newProfile.name;
      let counter = 1;
      while (existingNames.includes(finalName.toLowerCase())) {
        finalName = `${newProfile.name} (${counter})`;
        counter++;
      }
      newProfile.name = finalName;

      setState("profiles", prev => [...prev, newProfile]);

      window.dispatchEvent(
        new CustomEvent("profiles:imported", { detail: { profile: newProfile } })
      );

      profilesLogger.debug("Imported profile:", newProfile.name);
      return { success: true, profile: newProfile };
    } catch (e) {
      const error = e instanceof Error ? e.message : "Failed to parse profile JSON";
      profilesLogger.error("Import failed:", e);
      return { success: false, error };
    }
  };

  // Update profile data helpers
  const updateProfileSettings = (settings: Partial<CortexSettings>): void => {
    const currentId = state.activeProfileId;
    if (!currentId) return;

    setState(
      produce((s) => {
        const profile = s.profiles.find(p => p.id === currentId);
        if (profile) {
          profile.settings = { ...profile.settings, ...settings };
          profile.updatedAt = new Date();
        }
      })
    );
  };

  const updateProfileKeybindings = (keybindings: KeyBinding[]): void => {
    const currentId = state.activeProfileId;
    if (!currentId) return;

    setState(
      produce((s) => {
        const profile = s.profiles.find(p => p.id === currentId);
        if (profile) {
          profile.keybindings = keybindings;
          profile.updatedAt = new Date();
        }
      })
    );
  };

  const updateProfileExtensions = (extensions: string[]): void => {
    const currentId = state.activeProfileId;
    if (!currentId) return;

    setState(
      produce((s) => {
        const profile = s.profiles.find(p => p.id === currentId);
        if (profile) {
          profile.enabledExtensions = extensions;
          profile.updatedAt = new Date();
        }
      })
    );
  };

  const updateProfileUIState = (uiState: Partial<ProfileUIState>): void => {
    const currentId = state.activeProfileId;
    if (!currentId) return;

    setState(
      produce((s) => {
        const profile = s.profiles.find(p => p.id === currentId);
        if (profile) {
          profile.uiState = { ...DEFAULT_UI_STATE, ...profile.uiState, ...uiState };
          profile.updatedAt = new Date();
        }
      })
    );
  };

  // UI state management
  const openQuickSwitch = () => setState("showQuickSwitch", true);
  const closeQuickSwitch = () => setState("showQuickSwitch", false);
  const toggleQuickSwitch = () => setState("showQuickSwitch", prev => !prev);
  const openManager = () => setState("showManager", true);
  const closeManager = () => setState("showManager", false);

  // Utility functions
  const getProfileMetadata = (): ProfileMetadata[] => {
    return state.profiles.map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      isDefault: p.isDefault,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  };

  const getDefaultProfile = (): Profile => {
    return state.profiles.find(p => p.id === "default") || createDefaultProfile();
  };

  const getAvailableIcons = (): string[] => [...PROFILE_ICONS];

  const isDefaultProfile = (id: string): boolean => id === "default";

  const setProfileIcon = async (id: string, icon: string): Promise<boolean> => {
    return updateProfile(id, { icon });
  };

  const renameProfile = async (id: string, name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    return updateProfile(id, { name: trimmed });
  };

  const value: ProfilesContextValue = {
    state,
    profiles,
    activeProfile,
    activeProfileId,
    showQuickSwitch,
    showManager,
    isLoading,
    createProfile,
    deleteProfile,
    switchProfile,
    updateProfile,
    duplicateProfile,
    exportProfile,
    importProfile,
    updateProfileSettings,
    updateProfileKeybindings,
    updateProfileExtensions,
    updateProfileUIState,
    openQuickSwitch,
    closeQuickSwitch,
    toggleQuickSwitch,
    openManager,
    closeManager,
    getProfileMetadata,
    getDefaultProfile,
    getAvailableIcons,
    isDefaultProfile,
    setProfileIcon,
    renameProfile,
  };

  return (
    <ProfilesContext.Provider value={value}>
      {props.children}
    </ProfilesContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useProfiles(): ProfilesContextValue {
  const context = useContext(ProfilesContext);
  if (!context) {
    throw new Error("useProfiles must be used within a ProfilesProvider");
  }
  return context;
}

/** Quick access to profile switching */
export function useProfileQuickSwitch() {
  const { profiles, activeProfileId, switchProfile, showQuickSwitch, closeQuickSwitch, openQuickSwitch } = useProfiles();
  
  return {
    profiles,
    activeProfileId,
    switchProfile,
    isOpen: showQuickSwitch,
    open: openQuickSwitch,
    close: closeQuickSwitch,
  };
}

/** Access to profile management functions */
export function useProfileManager() {
  const { 
    profiles, 
    activeProfile, 
    createProfile, 
    deleteProfile, 
    duplicateProfile, 
    updateProfile,
    exportProfile, 
    importProfile,
    showManager,
    openManager,
    closeManager,
    getAvailableIcons,
    setProfileIcon,
    renameProfile,
    isDefaultProfile,
  } = useProfiles();
  
  return {
    profiles,
    activeProfile,
    createProfile,
    deleteProfile,
    duplicateProfile,
    updateProfile,
    exportProfile,
    importProfile,
    isOpen: showManager,
    open: openManager,
    close: closeManager,
    getAvailableIcons,
    setProfileIcon,
    renameProfile,
    isDefaultProfile,
  };
}

import {
  createContext,
  useContext,
  ParentProps,
  createEffect,
  onMount,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

// ============================================================================
// Terminal Profile Type Definitions
// ============================================================================

/** A terminal profile configuration */
export interface TerminalProfile {
  /** Unique profile identifier */
  id: string;
  /** Profile display name */
  name: string;
  /** Path to the shell executable */
  shell: string;
  /** Arguments to pass to the shell */
  args?: string[];
  /** Environment variables for this profile */
  env?: Record<string, string>;
  /** Initial working directory */
  cwd?: string;
  /** Icon identifier for the profile */
  icon?: string;
  /** Profile accent color */
  color?: string;
  /** Whether this is the default profile */
  isDefault?: boolean;
}

/** Terminal profiles state */
export interface TerminalProfilesState {
  /** All configured terminal profiles */
  profiles: TerminalProfile[];
  /** ID of the default profile */
  defaultProfileId: string | null;
  /** Whether profiles are being loaded */
  isLoading: boolean;
}

// ============================================================================
// Context Value Interface
// ============================================================================

export interface TerminalProfilesContextValue {
  /** Current terminal profiles state */
  state: TerminalProfilesState;

  /** Get all profiles */
  getProfiles: () => TerminalProfile[];

  /** Get the default profile */
  getDefaultProfile: () => TerminalProfile | undefined;

  /** Get a profile by its ID */
  getProfileById: (id: string) => TerminalProfile | undefined;

  /** Save a new profile (generates an ID) */
  saveProfile: (profile: Omit<TerminalProfile, "id">) => TerminalProfile;

  /** Update an existing profile */
  updateProfile: (id: string, updates: Partial<TerminalProfile>) => void;

  /** Delete a profile by ID */
  deleteProfile: (id: string) => void;

  /** Set the default profile ID */
  setDefaultProfile: (id: string | null) => void;

  /** Duplicate an existing profile */
  duplicateProfile: (id: string) => TerminalProfile | undefined;

  /** Import profiles from a JSON string */
  importProfiles: (json: string) => boolean;

  /** Export profiles as a JSON string */
  exportProfiles: () => string;

  /** Reset profiles to built-in defaults */
  resetToDefaults: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Storage key for persisting terminal profiles */
const STORAGE_KEY = "cortex_terminal_profiles";

/**
 * Generate a unique identifier.
 * Uses crypto.randomUUID when available, falls back to a random hex string.
 */
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const segment = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return `${segment()}${segment()}-${segment()}-${segment()}-${segment()}-${segment()}${segment()}${segment()}`;
}

/** Default terminal profiles for common shells */
const DEFAULT_PROFILES: TerminalProfile[] = [
  {
    id: "default-bash",
    name: "Bash",
    shell: "/bin/bash",
    args: ["--login"],
    icon: "bash",
    color: "#4EAA25",
    isDefault: false,
  },
  {
    id: "default-zsh",
    name: "Zsh",
    shell: "/bin/zsh",
    args: ["--login"],
    icon: "zsh",
    color: "#428850",
    isDefault: false,
  },
  {
    id: "default-fish",
    name: "Fish",
    shell: "/usr/bin/fish",
    args: ["--login"],
    icon: "fish",
    color: "#DE4C36",
    isDefault: false,
  },
  {
    id: "default-powershell",
    name: "PowerShell",
    shell: "pwsh",
    args: ["-NoLogo"],
    icon: "powershell",
    color: "#012456",
    isDefault: false,
  },
];

/** Default state when no persisted data exists */
const DEFAULT_STATE: TerminalProfilesState = {
  profiles: [...DEFAULT_PROFILES],
  defaultProfileId: null,
  isLoading: true,
};

// ============================================================================
// Context
// ============================================================================

const TerminalProfilesContext = createContext<TerminalProfilesContextValue>();

// ============================================================================
// Provider Component
// ============================================================================

export function TerminalProfilesProvider(props: ParentProps) {
  const loadPersistedState = (): Partial<TerminalProfilesState> => {
    if (typeof localStorage === "undefined") return {};
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("[TerminalProfiles] Failed to load profiles:", e);
    }
    return {};
  };

  const persisted = loadPersistedState();
  const [state, setState] = createStore<TerminalProfilesState>({
    ...DEFAULT_STATE,
    ...persisted,
    isLoading: true,
  });

  const persistState = () => {
    if (typeof localStorage === "undefined") return;
    try {
      const toStore: Partial<TerminalProfilesState> = {
        profiles: state.profiles,
        defaultProfileId: state.defaultProfileId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
      console.error("[TerminalProfiles] Failed to persist profiles:", e);
    }
  };

  onMount(() => {
    setState("isLoading", false);
  });

  createEffect(() => {
    void state.profiles.length;
    void state.defaultProfileId;

    if (!state.isLoading) {
      persistState();
    }
  });

  // --- Context methods ---

  const getProfiles = (): TerminalProfile[] => {
    return state.profiles;
  };

  const getDefaultProfile = (): TerminalProfile | undefined => {
    if (!state.defaultProfileId) return undefined;
    return state.profiles.find((p) => p.id === state.defaultProfileId);
  };

  const getProfileById = (id: string): TerminalProfile | undefined => {
    return state.profiles.find((p) => p.id === id);
  };

  const saveProfile = (profile: Omit<TerminalProfile, "id">): TerminalProfile => {
    const newProfile: TerminalProfile = {
      ...profile,
      id: generateId(),
    };
    setState(
      produce((s) => {
        s.profiles.push(newProfile);
      })
    );
    return newProfile;
  };

  const updateProfile = (id: string, updates: Partial<TerminalProfile>): void => {
    setState(
      produce((s) => {
        const index = s.profiles.findIndex((p) => p.id === id);
        if (index === -1) return;
        const profile = s.profiles[index];
        Object.assign(profile, updates);
        profile.id = id;
      })
    );
  };

  const deleteProfile = (id: string): void => {
    setState(
      produce((s) => {
        s.profiles = s.profiles.filter((p) => p.id !== id);
        if (s.defaultProfileId === id) {
          s.defaultProfileId = null;
        }
      })
    );
  };

  const setDefaultProfile = (id: string | null): void => {
    setState("defaultProfileId", id);
  };

  const duplicateProfile = (id: string): TerminalProfile | undefined => {
    const source = state.profiles.find((p) => p.id === id);
    if (!source) return undefined;

    const duplicated: TerminalProfile = {
      ...source,
      id: generateId(),
      name: `${source.name} (Copy)`,
      isDefault: false,
    };

    if (source.args) {
      duplicated.args = [...source.args];
    }
    if (source.env) {
      duplicated.env = { ...source.env };
    }

    setState(
      produce((s) => {
        s.profiles.push(duplicated);
      })
    );
    return duplicated;
  };

  const importProfiles = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        console.warn("[TerminalProfiles] Import data is not an array");
        return false;
      }

      const validProfiles: TerminalProfile[] = parsed.filter(
        (item: unknown) =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as TerminalProfile).name === "string" &&
          typeof (item as TerminalProfile).shell === "string"
      ).map((item: TerminalProfile) => ({
        ...item,
        id: item.id || generateId(),
      }));

      if (validProfiles.length === 0) {
        console.warn("[TerminalProfiles] No valid profiles found in import data");
        return false;
      }

      setState(
        produce((s) => {
          for (const profile of validProfiles) {
            const existingIndex = s.profiles.findIndex((p) => p.id === profile.id);
            if (existingIndex !== -1) {
              Object.assign(s.profiles[existingIndex], profile);
            } else {
              s.profiles.push(profile);
            }
          }
        })
      );
      return true;
    } catch (e) {
      console.error("[TerminalProfiles] Failed to import profiles:", e);
      return false;
    }
  };

  const exportProfiles = (): string => {
    return JSON.stringify(state.profiles, null, 2);
  };

  const resetToDefaults = (): void => {
    setState(
      produce((s) => {
        s.profiles = [...DEFAULT_PROFILES];
        s.defaultProfileId = null;
      })
    );
  };

  const contextValue: TerminalProfilesContextValue = {
    state,
    getProfiles,
    getDefaultProfile,
    getProfileById,
    saveProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
    duplicateProfile,
    importProfiles,
    exportProfiles,
    resetToDefaults,
  };

  return (
    <TerminalProfilesContext.Provider value={contextValue}>
      {props.children}
    </TerminalProfilesContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Access the terminal profiles context.
 * Must be used within a TerminalProfilesProvider.
 */
export function useTerminalProfiles(): TerminalProfilesContextValue {
  const context = useContext(TerminalProfilesContext);
  if (!context) {
    throw new Error("useTerminalProfiles must be used within a TerminalProfilesProvider");
  }
  return context;
}

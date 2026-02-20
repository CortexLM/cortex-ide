import { createContext, useContext, ParentProps, onMount, onCleanup, createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useToast } from "./ToastContext";

// ===== Types =====

export type AutoUpdateStatusType = 
  | "Idle"
  | "Checking"
  | "UpdateAvailable"
  | "Downloading"
  | "ReadyToInstall"
  | "Installing"
  | "RestartRequired"
  | "UpToDate"
  | "Error";

export interface UpdateAvailableData {
  version: string;
  current_version: string;
  release_notes: string | null;
  release_date: string | null;
}

export interface DownloadingData {
  version: string;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
}

export interface ReadyToInstallData {
  version: string;
}

export interface InstallingData {
  version: string;
}

export interface RestartRequiredData {
  version: string;
}

export interface UpToDateData {
  current_version: string;
}

export interface ErrorData {
  message: string;
}

export type AutoUpdateStatus = 
  | { type: "Idle" }
  | { type: "Checking" }
  | { type: "UpdateAvailable"; data: UpdateAvailableData }
  | { type: "Downloading"; data: DownloadingData }
  | { type: "ReadyToInstall"; data: ReadyToInstallData }
  | { type: "Installing"; data: InstallingData }
  | { type: "RestartRequired"; data: RestartRequiredData }
  | { type: "UpToDate"; data: UpToDateData }
  | { type: "Error"; data: ErrorData };

export interface UpdateInfo {
  version: string;
  current_version: string;
  release_notes: string | null;
  release_date: string | null;
  download_url: string | null;
}

export interface AutoUpdateEvent {
  status: AutoUpdateStatus;
  timestamp: number;
}

interface AutoUpdateState {
  status: AutoUpdateStatus;
  updateInfo: UpdateInfo | null;
  currentVersion: string;
  showDialog: boolean;
  skippedVersion: string | null;
  lastChecked: Date | null;
  autoCheckEnabled: boolean;
  // Release notes state
  releaseNotes: string;
  releaseNotesVersion: string | null;
  releaseNotesDate: string | null;
  showingReleaseNotes: boolean;
  lastShownVersion: string | null;
}

interface AutoUpdateContextValue {
  // State
  status: AutoUpdateStatus;
  updateInfo: UpdateInfo | null;
  currentVersion: string;
  showDialog: boolean;
  skippedVersion: string | null;
  lastChecked: Date | null;
  autoCheckEnabled: boolean;
  
  // Release notes state
  releaseNotes: string;
  releaseNotesVersion: string | null;
  releaseNotesDate: string | null;
  showingReleaseNotes: boolean;
  
  // Actions
  checkForUpdates: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  restartApp: () => Promise<void>;
  dismissUpdate: () => Promise<void>;
  skipVersion: (version: string) => void;
  clearSkippedVersion: () => void;
  setShowDialog: (show: boolean) => void;
  setAutoCheckEnabled: (enabled: boolean) => void;
  
  // Release notes actions
  fetchReleaseNotes: (version: string) => Promise<void>;
  showReleaseNotes: () => void;
  hideReleaseNotes: () => void;
  
  // Helpers
  isUpdateAvailable: () => boolean;
  isDownloading: () => boolean;
  isRestartRequired: () => boolean;
  getDownloadProgress: () => number;
}

const AutoUpdateContext = createContext<AutoUpdateContextValue>();

const STORAGE_KEYS = {
  SKIPPED_VERSION: "cortex_skipped_version",
  AUTO_CHECK: "cortex_auto_check_updates",
  LAST_CHECKED: "cortex_last_update_check",
  LAST_SHOWN_RELEASE_NOTES: "cortex_last_shown_release_notes",
};

export function AutoUpdateProvider(props: ParentProps) {
  const toast = useToast();
  
  const [state, setState] = createStore<AutoUpdateState>({
    status: { type: "Idle" },
    updateInfo: null,
    currentVersion: "0.0.0",
    showDialog: false,
    skippedVersion: null,
    lastChecked: null,
    autoCheckEnabled: true,
    // Release notes initial state
    releaseNotes: "",
    releaseNotesVersion: null,
    releaseNotesDate: null,
    showingReleaseNotes: false,
    lastShownVersion: null,
  });
  
  let unlisten: UnlistenFn | null = null;

  // Load saved settings from localStorage
  const loadSettings = () => {
    try {
      const skipped = localStorage.getItem(STORAGE_KEYS.SKIPPED_VERSION);
      const autoCheck = localStorage.getItem(STORAGE_KEYS.AUTO_CHECK);
      const lastChecked = localStorage.getItem(STORAGE_KEYS.LAST_CHECKED);
      const lastShownReleaseNotes = localStorage.getItem(STORAGE_KEYS.LAST_SHOWN_RELEASE_NOTES);
      
      setState(produce((s) => {
        s.skippedVersion = skipped;
        s.autoCheckEnabled = autoCheck !== "false";
        s.lastChecked = lastChecked ? new Date(lastChecked) : null;
        s.lastShownVersion = lastShownReleaseNotes;
      }));
    } catch (e) {
      console.error("Failed to load auto-update settings:", e);
    }
  };

  // Get current app version
  const loadVersion = async () => {
    try {
      const version = await invoke<string>("get_app_version");
      setState("currentVersion", version);
    } catch (e) {
      console.error("Failed to get app version:", e);
    }
  };

  // Listen for status updates from backend
  const setupEventListener = async () => {
    try {
      unlisten = await listen<AutoUpdateEvent>("auto-update:status", (event) => {
        const { status } = event.payload;
        setState("status", status);
        
        // Show dialog when update is available (if not skipped)
        if (status.type === "UpdateAvailable") {
          const data = status.data as UpdateAvailableData;
          if (state.skippedVersion !== data.version) {
            setState("showDialog", true);
            toast.info(`Update available: v${data.version}`, { title: "Update Available" });
          }
        }
        
        // Show notification when download completes
        if (status.type === "RestartRequired") {
          toast.success("Update downloaded! Restart to apply.", { title: "Ready to Install" });
        }
        
        // Show error notification
        if (status.type === "Error") {
          const data = status.data as ErrorData;
          toast.error(data.message, { title: "Update Error" });
        }
      });
    } catch (e) {
      console.error("Failed to setup auto-update event listener:", e);
    }
  };

  onMount(() => {
    loadSettings();
    loadVersion();
    setupEventListener();

    onCleanup(() => {
      if (unlisten) {
        unlisten();
      }
    });
  });

  // Check for skipped version when update is available
  createEffect(() => {
    if (state.status.type === "UpdateAvailable") {
      const data = state.status.data as UpdateAvailableData;
      if (state.skippedVersion === data.version) {
        // Don't show dialog for skipped versions
        setState("showDialog", false);
      }
    }
  });

  // Check if we should show release notes on first launch after update
  createEffect(() => {
    const currentVersion = state.currentVersion;
    const lastShown = state.lastShownVersion;
    
    // Only check after version is loaded (not the initial 0.0.0)
    if (currentVersion && currentVersion !== "0.0.0") {
      // If current version is different from last shown, show release notes
      if (currentVersion !== lastShown) {
        fetchReleaseNotes(currentVersion);
        setState("showingReleaseNotes", true);
      }
    }
  });

  // Actions
  const checkForUpdates = async () => {
    try {
      setState("status", { type: "Checking" });
      const info = await invoke<UpdateInfo | null>("check_for_updates");
      
      if (info) {
        setState("updateInfo", info);
        // Show dialog if update found (and not skipped)
        if (state.skippedVersion !== info.version) {
          setState("showDialog", true);
        }
      } else {
        toast.info("You're running the latest version.", { title: "Up to Date" });
      }
      
      // Update last checked time
      const now = new Date();
      setState("lastChecked", now);
      localStorage.setItem(STORAGE_KEYS.LAST_CHECKED, now.toISOString());
    } catch (e) {
      console.error("Failed to check for updates:", e);
      toast.error(String(e), { title: "Update Check Failed" });
    }
  };

  const downloadAndInstall = async () => {
    try {
      await invoke("download_and_install_update");
    } catch (e) {
      console.error("Failed to download update:", e);
      toast.error(String(e), { title: "Download Failed" });
    }
  };

  const restartApp = async () => {
    try {
      await invoke("restart_app");
    } catch (e) {
      console.error("Failed to restart app:", e);
      toast.error(String(e), { title: "Restart Failed" });
    }
  };

  const dismissUpdate = async () => {
    try {
      await invoke("dismiss_update");
      setState("showDialog", false);
    } catch (e) {
      console.error("Failed to dismiss update:", e);
    }
  };

  const skipVersion = (version: string) => {
    setState("skippedVersion", version);
    setState("showDialog", false);
    localStorage.setItem(STORAGE_KEYS.SKIPPED_VERSION, version);
    toast.info(`Version ${version} will be skipped.`, { title: "Version Skipped" });
  };

  const clearSkippedVersion = () => {
    setState("skippedVersion", null);
    localStorage.removeItem(STORAGE_KEYS.SKIPPED_VERSION);
  };

  const setShowDialog = (show: boolean) => {
    setState("showDialog", show);
  };

  const setAutoCheckEnabled = (enabled: boolean) => {
    setState("autoCheckEnabled", enabled);
    localStorage.setItem(STORAGE_KEYS.AUTO_CHECK, String(enabled));
  };

  // Release notes actions
  const fetchReleaseNotes = async (version: string) => {
    try {
      // Try to fetch from GitHub releases API
      const response = await fetch(
        `https://api.github.com/repos/cortex-dev/cortex/releases/tags/v${version}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setState(produce((s) => {
          s.releaseNotes = data.body || "";
          s.releaseNotesVersion = version;
          s.releaseNotesDate = data.published_at || null;
        }));
      } else {
        // Fallback: check if we have release notes from the update info
        const updateData = state.updateInfo;
        if (updateData && updateData.version === version && updateData.release_notes) {
          setState(produce((s) => {
            s.releaseNotes = updateData.release_notes || "";
            s.releaseNotesVersion = version;
            s.releaseNotesDate = updateData.release_date || null;
          }));
        } else {
          // Set empty release notes
          setState(produce((s) => {
            s.releaseNotes = "";
            s.releaseNotesVersion = version;
            s.releaseNotesDate = null;
          }));
        }
      }
    } catch (err) {
      console.debug("[AutoUpdate] Release notes fetch failed:", err);
      // Fallback to update info if available
      const updateData = state.updateInfo;
      if (updateData && updateData.version === version && updateData.release_notes) {
        setState(produce((s) => {
          s.releaseNotes = updateData.release_notes || "";
          s.releaseNotesVersion = version;
          s.releaseNotesDate = updateData.release_date || null;
        }));
      } else {
        setState(produce((s) => {
          s.releaseNotes = "";
          s.releaseNotesVersion = version;
          s.releaseNotesDate = null;
        }));
      }
    }
  };

  const showReleaseNotes = () => {
    // If we have a current version, fetch its release notes
    const version = state.currentVersion;
    if (version && version !== "0.0.0") {
      fetchReleaseNotes(version);
    }
    setState("showingReleaseNotes", true);
  };

  const hideReleaseNotes = () => {
    setState("showingReleaseNotes", false);
    // Mark this version as shown
    if (state.releaseNotesVersion) {
      setState("lastShownVersion", state.releaseNotesVersion);
      localStorage.setItem(STORAGE_KEYS.LAST_SHOWN_RELEASE_NOTES, state.releaseNotesVersion);
    }
  };

  // Helpers
  const isUpdateAvailable = () => {
    return state.status.type === "UpdateAvailable";
  };

  const isDownloading = () => {
    return state.status.type === "Downloading";
  };

  const isRestartRequired = () => {
    return state.status.type === "RestartRequired";
  };

  const getDownloadProgress = () => {
    if (state.status.type === "Downloading") {
      return (state.status.data as DownloadingData).progress;
    }
    return 0;
  };

  const contextValue: AutoUpdateContextValue = {
    get status() { return state.status; },
    get updateInfo() { return state.updateInfo; },
    get currentVersion() { return state.currentVersion; },
    get showDialog() { return state.showDialog; },
    get skippedVersion() { return state.skippedVersion; },
    get lastChecked() { return state.lastChecked; },
    get autoCheckEnabled() { return state.autoCheckEnabled; },
    
    // Release notes state
    get releaseNotes() { return state.releaseNotes; },
    get releaseNotesVersion() { return state.releaseNotesVersion; },
    get releaseNotesDate() { return state.releaseNotesDate; },
    get showingReleaseNotes() { return state.showingReleaseNotes; },
    
    checkForUpdates,
    downloadAndInstall,
    restartApp,
    dismissUpdate,
    skipVersion,
    clearSkippedVersion,
    setShowDialog,
    setAutoCheckEnabled,
    
    // Release notes actions
    fetchReleaseNotes,
    showReleaseNotes,
    hideReleaseNotes,
    
    isUpdateAvailable,
    isDownloading,
    isRestartRequired,
    getDownloadProgress,
  };

  return (
    <AutoUpdateContext.Provider value={contextValue}>
      {props.children}
    </AutoUpdateContext.Provider>
  );
}

export function useAutoUpdate() {
  const ctx = useContext(AutoUpdateContext);
  if (!ctx) throw new Error("useAutoUpdate must be used within AutoUpdateProvider");
  return ctx;
}

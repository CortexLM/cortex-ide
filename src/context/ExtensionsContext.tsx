import {
  createContext,
  useContext,
  ParentProps,
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  Accessor,
  batch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { ExtensionHostProxy } from "@/sdk/extension-host-proxy";
import { createLogger } from "@/utils/logger";
// ============================================================================
// WASM Extension Runtime Types
// ============================================================================

import {
  ExtensionHostStatus,
  ExtensionStatus,
  type ExtensionRuntimeState,
} from "./ExtensionHostContext";

const extensionsLogger = createLogger("Extensions");

export enum WebExtensionKind {
  UI = 1,
  Workspace = 2,
}

// ============================================================================
// Type Definitions matching Rust backend
// ============================================================================

/** Extension manifest schema */
export interface ExtensionManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main?: string;
  wasm?: string;
  wit_world?: string;
  contributes: ExtensionContributes;
  icon?: string;
  repository?: string;
  engines?: EngineRequirements;
  keywords: string[];
  license?: string;
}

export interface EngineRequirements {
  cortex?: string;
}

export interface ExtensionContributes {
  themes: ThemeContribution[];
  languages: LanguageContribution[];
  commands: CommandContribution[];
  panels: PanelContribution[];
  settings: SettingsContribution[];
  keybindings: KeybindingContribution[];
  snippets: SnippetContribution[];
}

export interface ThemeContribution {
  id: string;
  label: string;
  path: string;
  uiTheme: string;
}

export interface LanguageContribution {
  id: string;
  name: string;
  extensions: string[];
  aliases: string[];
  grammar?: string;
  configuration?: string;
  mimeTypes: string[];
}

export interface CommandContribution {
  command: string;
  title: string;
  category?: string;
  icon?: string;
  enablement?: string;
}

export interface PanelContribution {
  id: string;
  title: string;
  icon?: string;
  location: string;
  component?: string;
}

export interface SettingsContribution {
  title: string;
  properties: Record<string, SettingsProperty>;
}

export interface SettingsProperty {
  type: string;
  default?: unknown;
  description?: string;
  enum?: unknown[];
  enumDescriptions?: string[];
}

export interface KeybindingContribution {
  command: string;
  key: string;
  mac?: string;
  when?: string;
}

export interface SnippetContribution {
  language: string;
  path: string;
}

export interface Extension {
  manifest: ExtensionManifest;
  path: string;
  enabled: boolean;
  source: ExtensionSource;
}

export type ExtensionSource = "local" | "marketplace" | "git";

/** Information about an available extension update */
export interface ExtensionUpdateInfo {
  extensionName: string;
  currentVersion: string;
  availableVersion: string;
  changelog?: string;
  releaseDate?: string;
  downloadUrl?: string;
}

// ============================================================================
// Extension Pack Types
// ============================================================================

/** Extension pack metadata */
export interface ExtensionPack {
  /** Unique identifier for the pack */
  id: string;
  /** Display name */
  name: string;
  /** Extensions included in the pack */
  extensionIds: string[];
  /** Pack description */
  description: string;
  /** Publisher/author of the pack */
  publisher: string;
  /** Optional icon URL */
  icon?: string;
  /** Categories */
  categories?: string[];
  /** Version */
  version?: string;
}

/** Extension pack installation state */
export interface ExtensionPackState {
  /** Pack ID */
  packId: string;
  /** Extensions that are installed from this pack */
  installedExtensions: string[];
  /** Extensions that failed to install */
  failedExtensions: string[];
  /** Whether installation is in progress */
  installing: boolean;
}

/** Extension kind for categorization */
export type ExtensionKindString = "ui" | "workspace" | "web";

/** Auto-update mode for extensions */
export type ExtensionAutoUpdateMode = true | false | "onlyEnabledExtensions";

/** Extension update settings */
export interface ExtensionUpdateSettings {
  /** Auto-update mode */
  autoUpdate: ExtensionAutoUpdateMode;
  /** Automatically check for updates on startup and periodically */
  autoCheckUpdates: boolean;
  /** Interval in minutes for periodic update checks (default: 60) */
  checkInterval: number;
}

export interface MarketplaceExtension {
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  icon_url?: string;
  repository_url?: string;
  download_url: string;
  categories: string[];
  updated_at: string;
}

export interface ExtensionTheme {
  id: string;
  name: string;
  extension_name: string;
  ui_theme: string;
  colors: Record<string, unknown>;
}

// ============================================================================
// Context Definition
// ============================================================================

/** Update state store */
export interface ExtensionUpdateState {
  /** Map of extension name to update info */
  outdatedExtensions: Map<string, ExtensionUpdateInfo>;
  /** Set of extension names currently being updated */
  updateInProgress: Set<string>;
  /** Last time updates were checked */
  lastChecked: Date | null;
  /** Whether an update check is in progress */
  checkingForUpdates: boolean;
  /** Update settings */
  settings: ExtensionUpdateSettings;
}

export interface ExtensionsContextValue {
  // State
  extensions: Accessor<Extension[]>;
  enabledExtensions: Accessor<Extension[]>;
  marketplaceExtensions: Accessor<MarketplaceExtension[]>;
  extensionThemes: Accessor<ExtensionTheme[]>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  extensionsDir: Accessor<string>;
  initialized: Accessor<boolean>;

  // Update State
  outdatedExtensions: Accessor<Map<string, ExtensionUpdateInfo>>;
  updateInProgress: Accessor<Set<string>>;
  lastChecked: Accessor<Date | null>;
  checkingForUpdates: Accessor<boolean>;
  updateSettings: Accessor<ExtensionUpdateSettings>;
  outdatedCount: Accessor<number>;

  // Extension Host State
  hostStatus: Accessor<ExtensionHostStatus>;
  hostReady: Accessor<boolean>;
  runtimeStates: Accessor<ExtensionRuntimeState[]>;
  activeRuntimeExtensions: Accessor<ExtensionRuntimeState[]>;

  // Actions
  loadExtensions: () => Promise<void>;
  enableExtension: (name: string) => Promise<void>;
  disableExtension: (name: string) => Promise<void>;
  uninstallExtension: (name: string) => Promise<void>;
  installFromPath: (path: string) => Promise<Extension>;
  openExtensionsDirectory: () => Promise<void>;
  searchMarketplace: (query: string, category?: string) => Promise<void>;
  getFeaturedExtensions: () => Promise<void>;
  installFromMarketplace: (name: string) => Promise<void>;
  refreshThemes: () => Promise<void>;
  getExtensionCommands: () => Promise<CommandContribution[]>;
  getExtensionLanguages: () => Promise<LanguageContribution[]>;
  getExtensionPanels: () => Promise<PanelContribution[]>;
  getExtensionSettings: () => Promise<SettingsContribution[]>;
  executeExtensionCommand: (command: string, args?: any[]) => Promise<any>;

  // Update Actions
  checkForUpdates: () => Promise<ExtensionUpdateInfo[]>;
  updateExtension: (name: string) => Promise<void>;
  updateAllExtensions: () => Promise<void>;
  getOutdatedExtensions: () => ExtensionUpdateInfo[];
  isExtensionOutdated: (name: string) => boolean;
  isExtensionUpdating: (name: string) => boolean;
  getUpdateInfo: (name: string) => ExtensionUpdateInfo | undefined;
  setUpdateSettings: (settings: Partial<ExtensionUpdateSettings>) => void;

  // Extension Host Actions
  startExtensionHost: () => Promise<void>;
  stopExtensionHost: () => Promise<void>;
  restartExtensionHost: () => Promise<void>;
  activateRuntimeExtension: (extensionId: string) => Promise<void>;
  deactivateRuntimeExtension: (extensionId: string) => Promise<void>;
  executeHostCommand: <T = unknown>(commandId: string, ...args: unknown[]) => Promise<T>;
  sendHostEvent: (eventName: string, data: unknown) => void;
  getExtensionHost: () => null;

  // Extension Pack Actions
  installExtensionPack: (packId: string) => Promise<void>;
  uninstallExtensionPack: (packId: string) => Promise<void>;
  getExtensionPackContents: (packId: string) => string[];
  isExtensionPack: (extensionId: string) => boolean;
  getInstalledPacks: () => ExtensionPackState[];
  getPackForExtension: (extensionId: string) => string | undefined;

  // Web Extension Support
  isWebExtension: (extensionId: string) => boolean;
  getExtensionKind: (extensionId: string) => ExtensionKindString[];
  getWebExtensionHost: () => null;
  startWebExtensionHost: () => Promise<void>;
  stopWebExtensionHost: () => Promise<void>;

  // Profiler Actions
  getExtensionProfiles: () => ExtensionProfileData[];
  restartExtension: (id: string) => Promise<void>;
  getExtensionMemoryUsage: (id: string) => number;
}

/** Extension profile data for profiler */
export interface ExtensionProfileData {
  extensionId: string;
  activationTime: number;
  activationEvent: string;
  memoryUsage: number;
  cpuUsage: number;
  apiCalls: number;
  lastActive: Date;
  status: "active" | "idle" | "error";
}

const ExtensionsContext = createContext<ExtensionsContextValue>();

// ============================================================================
// Constants
// ============================================================================

const UPDATE_SETTINGS_STORAGE_KEY = "cortex-extension-update-settings";
const LAST_CHECKED_STORAGE_KEY = "cortex-extension-last-checked";

const DEFAULT_UPDATE_SETTINGS: ExtensionUpdateSettings = {
  autoUpdate: false,
  autoCheckUpdates: true,
  checkInterval: 60, // 60 minutes
};

// ============================================================================
// Helper Functions
// ============================================================================

function loadUpdateSettings(): ExtensionUpdateSettings {
  try {
    const stored = localStorage.getItem(UPDATE_SETTINGS_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_UPDATE_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_UPDATE_SETTINGS;
}

function saveUpdateSettings(settings: ExtensionUpdateSettings): void {
  try {
    localStorage.setItem(UPDATE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

function loadLastChecked(): Date | null {
  try {
    const stored = localStorage.getItem(LAST_CHECKED_STORAGE_KEY);
    if (stored) {
      return new Date(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveLastChecked(date: Date): void {
  try {
    localStorage.setItem(LAST_CHECKED_STORAGE_KEY, date.toISOString());
  } catch {
    // Ignore storage errors
  }
}

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, "").split(".").map(Number);
  const parts2 = v2.replace(/^v/, "").split(".").map(Number);
  
  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

// ============================================================================
// Provider Component
// ============================================================================

export function ExtensionsProvider(props: ParentProps) {
  const [extensions, setExtensions] = createSignal<Extension[]>([]);
  const [enabledExtensions, setEnabledExtensions] = createSignal<Extension[]>([]);
  const [marketplaceExtensions, setMarketplaceExtensions] = createSignal<MarketplaceExtension[]>([]);
  const [extensionThemes, setExtensionThemes] = createSignal<ExtensionTheme[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [extensionsDir, setExtensionsDir] = createSignal("");
  const [initialized, setInitialized] = createSignal(false);

  // Update state using store for reactive nested updates
  const [updateState, setUpdateState] = createStore<ExtensionUpdateState>({
    outdatedExtensions: new Map(),
    updateInProgress: new Set(),
    lastChecked: loadLastChecked(),
    checkingForUpdates: false,
    settings: loadUpdateSettings(),
  });

  // Extension Host state (WASM runtime managed by Tauri backend)
  const [hostStatus, setHostStatus] = createSignal<ExtensionHostStatus>(ExtensionHostStatus.Stopped);
  const [runtimeStates, setRuntimeStates] = createSignal<ExtensionRuntimeState[]>([]);

  // Extension Pack state
  const [packStates, setPackStates] = createStore<Map<string, ExtensionPackState>>(new Map());
  const [knownPacks, setKnownPacks] = createSignal<Map<string, ExtensionPack>>(new Map());

  // Web Worker extension host for isolated execution
  const extensionHostProxy = new ExtensionHostProxy();

  const startWorkerHost = async (): Promise<void> => {
    try {
      extensionHostProxy.start();
      await extensionHostProxy.init({ isolationMode: true });
      extensionHostProxy.onLog((level, message) => {
        extensionsLogger.debug(`[ExtensionWorker][${level}]`, message);
      });
    } catch (err) {
      extensionsLogger.warn("Worker host failed to start:", err);
    }
  };

  const stopWorkerHost = (): void => {
    try {
      extensionHostProxy.stop();
    } catch (err) {
      extensionsLogger.warn("Worker host failed to stop:", err);
    }
  };

  // Derived accessors
  const hostReady = createMemo(() => hostStatus() === ExtensionHostStatus.Ready);
  const activeRuntimeExtensions = createMemo(() => 
    runtimeStates().filter(s => s.status === ExtensionStatus.Active)
  );

  // Derived accessors for update state
  const outdatedExtensions = () => updateState.outdatedExtensions;
  const updateInProgress = () => updateState.updateInProgress;
  const lastChecked = () => updateState.lastChecked;
  const checkingForUpdates = () => updateState.checkingForUpdates;
  const updateSettings = () => updateState.settings;
  const outdatedCount = createMemo(() => updateState.outdatedExtensions.size);

  // Interval reference for periodic checks
  let updateCheckInterval: ReturnType<typeof setInterval> | undefined;
  let unlistenFn: UnlistenFn | undefined;

  // Cleanup on unmount
  onCleanup(() => {
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval);
    }
    unlistenFn?.();
    // Stop WASM extension host
    stopExtensionHost().catch(console.error);
    stopWorkerHost();
  });

  // Load all extensions
  const loadExtensions = async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await invoke<Extension[]>("load_extensions");
      batch(() => {
        setExtensions(loaded);
        const enabled = loaded.filter((ext) => ext.enabled);
        setEnabledExtensions(enabled);
      });
      // Also refresh themes when extensions are loaded
      await refreshThemes();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("Failed to load extensions:", e);
    } finally {
      setLoading(false);
    }
  };

  // Enable an extension
  const enableExtension = async (name: string) => {
    setError(null);
    try {
      await invoke("enable_extension", { name });
      await loadExtensions();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("Failed to enable extension:", e);
    }
  };

  // Disable an extension
  const disableExtension = async (name: string) => {
    setError(null);
    try {
      await invoke("disable_extension", { name });
      await loadExtensions();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("Failed to disable extension:", e);
    }
  };

  // Uninstall an extension
  const uninstallExtension = async (name: string) => {
    setError(null);
    try {
      await invoke("uninstall_extension", { name });
      await loadExtensions();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("Failed to uninstall extension:", e);
    }
  };

  // Install from local path
  const installFromPath = async (path: string): Promise<Extension> => {
    setError(null);
    try {
      const ext = await invoke<Extension>("install_extension_from_path", { path });
      await loadExtensions();
      return ext;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      throw e;
    }
  };

  // Open extensions directory
  const openExtensionsDirectory = async () => {
    try {
      await invoke("open_extensions_directory");
    } catch (e) {
      console.error("Failed to open extensions directory:", e);
    }
  };

  // Search marketplace
  const searchMarketplace = async (query: string, category?: string) => {
    setLoading(true);
    setError(null);
    try {
      const results = await invoke<MarketplaceExtension[]>("search_marketplace", {
        query,
        category,
      });
      setMarketplaceExtensions(results);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("Failed to search marketplace:", e);
    } finally {
      setLoading(false);
    }
  };

  // Get featured extensions
  const getFeaturedExtensions = async () => {
    setLoading(true);
    setError(null);
    try {
      const featured = await invoke<MarketplaceExtension[]>("get_featured_extensions");
      setMarketplaceExtensions(featured);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("Failed to get featured extensions:", e);
    } finally {
      setLoading(false);
    }
  };

  // Install from marketplace
  const installFromMarketplace = async (name: string) => {
    setError(null);
    try {
      await invoke("install_from_marketplace", { extensionName: name });
      await loadExtensions();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("Failed to install from marketplace:", e);
    }
  };

  // Refresh themes from enabled extensions
  const refreshThemes = async () => {
    try {
      const themes = await invoke<ExtensionTheme[]>("get_extension_themes");
      setExtensionThemes(themes);
    } catch (e) {
      console.error("Failed to refresh themes:", e);
    }
  };

  // Get extension commands
  const getExtensionCommands = async (): Promise<CommandContribution[]> => {
    try {
      return await invoke<CommandContribution[]>("get_extension_commands");
    } catch (e) {
      console.error("Failed to get extension commands:", e);
      return [];
    }
  };

  // Get extension languages
  const getExtensionLanguages = async (): Promise<LanguageContribution[]> => {
    try {
      return await invoke<LanguageContribution[]>("get_extension_languages");
    } catch (e) {
      console.error("Failed to get extension languages:", e);
      return [];
    }
  };

  // Get extension panels
  const getExtensionPanels = async (): Promise<PanelContribution[]> => {
    try {
      return await invoke<PanelContribution[]>("get_extension_panels");
    } catch (e) {
      console.error("Failed to get extension panels:", e);
      return [];
    }
  };

  // Get extension settings
  const getExtensionSettings = async (): Promise<SettingsContribution[]> => {
    try {
      return await invoke<SettingsContribution[]>("get_extension_settings");
    } catch (e) {
      console.error("Failed to get extension settings:", e);
      return [];
    }
  };

  // Execute a command in an extension
  const executeExtensionCommand = async (command: string, args?: any[]): Promise<any> => {
    try {
      return await invoke("execute_extension_command", { command, args });
    } catch (e) {
      console.error(`Failed to execute extension command ${command}:`, e);
      throw e;
    }
  };

  // ============================================================================
  // Update Management Functions
  // ============================================================================

  /**
   * Check for updates for all installed extensions
   * Returns list of extensions with available updates
   */
  const checkForUpdates = async (): Promise<ExtensionUpdateInfo[]> => {
    setUpdateState("checkingForUpdates", true);
    setError(null);

    try {
      const currentExtensions = extensions();
      if (currentExtensions.length === 0) {
        return [];
      }

      // Try to get update info from backend
      let updates: ExtensionUpdateInfo[] = [];
      
      try {
        // Call backend to check marketplace for updates
        updates = await invoke<ExtensionUpdateInfo[]>("check_extension_updates", {
          extensions: currentExtensions.map(ext => ({
            name: ext.manifest.name,
            version: ext.manifest.version,
            source: ext.source,
          })),
        });
      } catch (backendError) {
        // If backend command doesn't exist, fall back to client-side check
        console.warn("Backend update check not available, using client-side check:", backendError);
        
        // For each marketplace extension, check if there's a newer version
        for (const ext of currentExtensions) {
          if (ext.source === "marketplace") {
            try {
              const marketplaceInfo = await invoke<MarketplaceExtension | null>(
                "get_marketplace_extension",
                { name: ext.manifest.name }
              );
              
              if (marketplaceInfo && compareVersions(ext.manifest.version, marketplaceInfo.version) < 0) {
                updates.push({
                  extensionName: ext.manifest.name,
                  currentVersion: ext.manifest.version,
                  availableVersion: marketplaceInfo.version,
                  downloadUrl: marketplaceInfo.download_url,
                  releaseDate: marketplaceInfo.updated_at,
                });
              }
            } catch {
              // Skip extensions we can't check
            }
          }
        }
      }

      // Update the outdated extensions map
      const newOutdated = new Map<string, ExtensionUpdateInfo>();
      for (const update of updates) {
        newOutdated.set(update.extensionName, update);
      }
      
      const now = new Date();
      batch(() => {
        setUpdateState("outdatedExtensions", newOutdated);
        setUpdateState("lastChecked", now);
      });
      saveLastChecked(now);

      // Emit notification if updates are available
      if (updates.length > 0) {
        window.dispatchEvent(
          new CustomEvent("extensions:updates-available", {
            detail: { count: updates.length, updates },
          })
        );
      }

      return updates;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("Failed to check for updates:", e);
      return [];
    } finally {
      setUpdateState("checkingForUpdates", false);
    }
  };

  /**
   * Update a single extension
   */
  const updateExtension = async (name: string): Promise<void> => {
    const updateInfo = updateState.outdatedExtensions.get(name);
    if (!updateInfo) {
      console.warn(`No update available for extension: ${name}`);
      return;
    }

    // Add to in-progress set
    setUpdateState(
      produce((state) => {
        state.updateInProgress = new Set([...state.updateInProgress, name]);
      })
    );
    setError(null);

    try {
      // Call backend to update the extension
      await invoke("update_extension", {
        name,
        version: updateInfo.availableVersion,
      });

      // Remove from outdated and in-progress
      setUpdateState(
        produce((state) => {
          state.outdatedExtensions.delete(name);
          state.updateInProgress.delete(name);
        })
      );

      // Reload extensions to get updated version
      await loadExtensions();

      // Emit success event
      window.dispatchEvent(
        new CustomEvent("extensions:update-complete", {
          detail: { name, version: updateInfo.availableVersion },
        })
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error(`Failed to update extension ${name}:`, e);

      // Remove from in-progress on error
      setUpdateState(
        produce((state) => {
          state.updateInProgress.delete(name);
        })
      );

      // Emit error event
      window.dispatchEvent(
        new CustomEvent("extensions:update-failed", {
          detail: { name, error: errorMsg },
        })
      );
    }
  };

  /**
   * Update all outdated extensions
   */
  const updateAllExtensions = async (): Promise<void> => {
    const outdated = Array.from(updateState.outdatedExtensions.keys());
    if (outdated.length === 0) {
      return;
    }

    // Update extensions IN PARALLEL (each update is independent)
    await Promise.all(outdated.map(name => updateExtension(name)));
  };

  /**
   * Get list of all outdated extensions
   */
  const getOutdatedExtensions = (): ExtensionUpdateInfo[] => {
    return Array.from(updateState.outdatedExtensions.values());
  };

  /**
   * Check if a specific extension has an update available
   */
  const isExtensionOutdated = (name: string): boolean => {
    return updateState.outdatedExtensions.has(name);
  };

  /**
   * Check if a specific extension is currently being updated
   */
  const isExtensionUpdating = (name: string): boolean => {
    return updateState.updateInProgress.has(name);
  };

  /**
   * Get update info for a specific extension
   */
  const getUpdateInfo = (name: string): ExtensionUpdateInfo | undefined => {
    return updateState.outdatedExtensions.get(name);
  };

  /**
   * Update extension update settings
   */
  const setUpdateSettings = (settings: Partial<ExtensionUpdateSettings>): void => {
    const newSettings = { ...updateState.settings, ...settings };
    setUpdateState("settings", newSettings);
    saveUpdateSettings(newSettings);

    // Reconfigure periodic check interval if needed
    setupPeriodicUpdateCheck();

    window.dispatchEvent(
      new CustomEvent("extensions:update-settings-changed", {
        detail: { settings: newSettings },
      })
    );
  };

  /**
   * Setup periodic update checks based on settings
   */
  const setupPeriodicUpdateCheck = () => {
    // Clear existing interval
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval);
      updateCheckInterval = undefined;
    }

    // Setup new interval if auto-check is enabled
    if (updateState.settings.autoCheckUpdates && updateState.settings.checkInterval > 0) {
      const intervalMs = updateState.settings.checkInterval * 60 * 1000;
      updateCheckInterval = setInterval(() => {
        checkForUpdates();
      }, intervalMs);
    }
  };

  /**
   * Perform auto-update if enabled
   */
  const performAutoUpdate = async () => {
    const settings = updateState.settings;
    if (!settings.autoUpdate) {
      return;
    }

    const outdated = getOutdatedExtensions();
    for (const update of outdated) {
      const ext = extensions().find((e) => e.manifest.name === update.extensionName);
      if (!ext) continue;

      // Check if we should update this extension based on settings
      if (settings.autoUpdate === "onlyEnabledExtensions" && !ext.enabled) {
        continue;
      }

      await updateExtension(update.extensionName);
    }
  };

  // ============================================================================
  // Extension Host Functions (WASM via Tauri IPC)
  // ============================================================================

  /**
   * Start the WASM extension host by loading enabled extensions
   */
  const startExtensionHost = async (): Promise<void> => {
    if (hostStatus() === ExtensionHostStatus.Ready) {
      console.warn("[ExtensionsProvider] Extension host already running");
      return;
    }

    try {
      setHostStatus(ExtensionHostStatus.Starting);

      const enabled = enabledExtensions();
      const wasmExtensions = enabled.filter(ext => ext.manifest.wasm);

      if (wasmExtensions.length === 0) {
        console.info("[ExtensionsProvider] No WASM extensions to load");
        setHostStatus(ExtensionHostStatus.Ready);
        return;
      }

      const states: ExtensionRuntimeState[] = wasmExtensions.map(ext => ({
        id: ext.manifest.name,
        status: ExtensionStatus.Inactive,
      }));
      setRuntimeStates(states);

      for (const ext of wasmExtensions) {
        try {
          await invoke("load_wasm_extension", {
            extensionId: ext.manifest.name,
            wasmPath: ext.path + "/" + ext.manifest.wasm,
          });

          setRuntimeStates(prev =>
            prev.map(s => s.id === ext.manifest.name
              ? { ...s, status: ExtensionStatus.Active, lastActivity: Date.now() }
              : s
            )
          );

          window.dispatchEvent(new CustomEvent("extension:activated", {
            detail: { extensionId: ext.manifest.name, activationTime: 0 }
          }));
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          setRuntimeStates(prev =>
            prev.map(s => s.id === ext.manifest.name
              ? { ...s, status: ExtensionStatus.Error, error: errMsg }
              : s
            )
          );
          console.error(`[ExtensionsProvider] Extension error (${ext.manifest.name}):`, errMsg);
        }
      }

      setHostStatus(ExtensionHostStatus.Ready);
      console.info("[ExtensionsProvider] Extension host started");
    } catch (error) {
      setHostStatus(ExtensionHostStatus.Crashed);
      const err = error instanceof Error ? error : new Error(String(error));
      setError(`Failed to start extension host: ${err.message}`);
      throw error;
    }
  };

  /**
   * Stop the WASM extension host
   */
  const stopExtensionHost = async (): Promise<void> => {
    if (hostStatus() === ExtensionHostStatus.Stopped) {
      return;
    }

    try {
      for (const state of runtimeStates()) {
        try {
          await invoke("unload_wasm_extension", { extensionId: state.id });
        } catch (e) {
          console.error(`[ExtensionsProvider] Failed to unload ${state.id}:`, e);
        }
      }
      setRuntimeStates([]);
      setHostStatus(ExtensionHostStatus.Stopped);
    } catch (error) {
      console.error("[ExtensionsProvider] Failed to stop extension host:", error);
      throw error;
    }
  };

  /**
   * Restart the WASM extension host
   */
  const restartExtensionHost = async (): Promise<void> => {
    await stopExtensionHost();
    await startExtensionHost();
  };

  /**
   * Activate a specific extension in the WASM runtime
   */
  const activateRuntimeExtension = async (extensionId: string): Promise<void> => {
    setRuntimeStates(prev =>
      prev.map(s => s.id === extensionId
        ? { ...s, status: ExtensionStatus.Activating }
        : s
      )
    );

    const ext = extensions().find(e => e.manifest.name === extensionId);
    if (!ext || !ext.manifest.wasm) {
      throw new Error(`WASM extension not found: ${extensionId}`);
    }

    await invoke("load_wasm_extension", {
      extensionId,
      wasmPath: ext.path + "/" + ext.manifest.wasm,
    });

    setRuntimeStates(prev =>
      prev.map(s => s.id === extensionId
        ? { ...s, status: ExtensionStatus.Active, lastActivity: Date.now() }
        : s
      )
    );
  };

  /**
   * Deactivate a specific extension in the WASM runtime
   */
  const deactivateRuntimeExtension = async (extensionId: string): Promise<void> => {
    setRuntimeStates(prev =>
      prev.map(s => s.id === extensionId
        ? { ...s, status: ExtensionStatus.Deactivating }
        : s
      )
    );

    await invoke("unload_wasm_extension", { extensionId });

    setRuntimeStates(prev =>
      prev.map(s => s.id === extensionId
        ? { ...s, status: ExtensionStatus.Inactive }
        : s
      )
    );
  };

  /**
   * Execute a command through the WASM extension host
   */
  const executeHostCommand = async <T = unknown>(
    commandId: string,
    ...args: unknown[]
  ): Promise<T> => {
    if (hostStatus() !== ExtensionHostStatus.Ready) {
      throw new Error("Extension host not running");
    }

    const parts = commandId.split(".");
    const extensionId = parts.length > 1 ? parts[0] : commandId;

    return invoke<T>("execute_wasm_command", {
      extensionId,
      command: commandId,
      args: args.length > 0 ? args : undefined,
    });
  };

  /**
   * Send an event to extensions (no-op, events handled via Tauri)
   */
  const sendHostEvent = (_eventName: string, _data: unknown): void => {};

  /**
   * Get the extension host instance (returns null - host is in Rust backend)
   */
  const getExtensionHost = (): null => null;

  // ============================================================================
  // Extension Pack Functions
  // ============================================================================

  /**
   * Fetch extension pack metadata from marketplace or cache
   */
  const fetchExtensionPack = async (packId: string): Promise<ExtensionPack | null> => {
    // Check cache first
    const cached = knownPacks().get(packId);
    if (cached) {
      return cached;
    }

    try {
      // Try to fetch from marketplace
      const pack = await invoke<ExtensionPack | null>("get_extension_pack", { packId });
      if (pack) {
        setKnownPacks(prev => {
          const newMap = new Map(prev);
          newMap.set(packId, pack);
          return newMap;
        });
      }
      return pack;
    } catch (e) {
      console.error(`Failed to fetch extension pack ${packId}:`, e);
      return null;
    }
  };

  /**
   * Install an extension pack - installs all extensions in the pack
   */
  const installExtensionPack = async (packId: string): Promise<void> => {
    setError(null);

    // Fetch pack metadata
    const pack = await fetchExtensionPack(packId);
    if (!pack) {
      const errorMsg = `Extension pack not found: ${packId}`;
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    // Initialize pack state
    const initialState: ExtensionPackState = {
      packId,
      installedExtensions: [],
      failedExtensions: [],
      installing: true,
    };
    
    setPackStates(prev => {
      const newMap = new Map(prev);
      newMap.set(packId, initialState);
      return newMap;
    });

    // Emit event for UI to show confirmation dialog
    window.dispatchEvent(
      new CustomEvent("extensions:pack-install-start", {
        detail: { pack, extensionCount: pack.extensionIds.length },
      })
    );

    const installedExtensions: string[] = [];
    const failedExtensions: string[] = [];

    // Install extensions in parallel batches for better performance
    const batchSize = 3;
    for (let i = 0; i < pack.extensionIds.length; i += batchSize) {
      const batch = pack.extensionIds.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(async (extensionId) => {
          // Check if already installed
          const existing = extensions().find(
            (ext) => ext.manifest.name === extensionId
          );
          if (existing) {
            return { id: extensionId, status: 'skipped' as const };
          }

          // Install from marketplace
          await invoke("install_from_marketplace", { extensionName: extensionId });
          return { id: extensionId, status: 'installed' as const };
        })
      );

      // Process batch results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          installedExtensions.push(result.value.id);
        } else {
          // Extract extension ID from the failed promise
          const failedIndex = results.indexOf(result);
          const failedExtensionId = batch[failedIndex];
          console.error(`Failed to install extension ${failedExtensionId} from pack:`, result.reason);
          failedExtensions.push(failedExtensionId);
        }
      }

      // Update state after each batch
      setPackStates(prev => {
        const newMap = new Map(prev);
        const state = newMap.get(packId);
        if (state) {
          newMap.set(packId, {
            ...state,
            installedExtensions: [...installedExtensions],
          });
        }
        return newMap;
      });

      // Emit progress event after each batch
      window.dispatchEvent(
        new CustomEvent("extensions:pack-install-progress", {
          detail: {
            packId,
            extensionIds: batch,
            installed: installedExtensions.length,
            failed: failedExtensions.length,
            total: pack.extensionIds.length,
          },
        })
      );
    }

    // Update final state
    setPackStates(prev => {
      const newMap = new Map(prev);
      newMap.set(packId, {
        packId,
        installedExtensions,
        failedExtensions,
        installing: false,
      });
      return newMap;
    });

    // Reload extensions
    await loadExtensions();

    // Emit completion event
    window.dispatchEvent(
      new CustomEvent("extensions:pack-install-complete", {
        detail: {
          packId,
          pack,
          installedExtensions,
          failedExtensions,
          success: failedExtensions.length === 0,
        },
      })
    );

    if (failedExtensions.length > 0) {
      setError(
        `Failed to install ${failedExtensions.length} extension(s) from pack: ${failedExtensions.join(", ")}`
      );
    }
  };

  /**
   * Uninstall all extensions in a pack
   */
  const uninstallExtensionPack = async (packId: string): Promise<void> => {
    const packState = packStates.get(packId);
    if (!packState) {
      console.warn(`Pack state not found for ${packId}`);
      return;
    }

    setError(null);

    // Mark as uninstalling
    setPackStates(prev => {
      const newMap = new Map(prev);
      const state = newMap.get(packId);
      if (state) {
        newMap.set(packId, { ...state, installing: true });
      }
      return newMap;
    });

    // Uninstall all extensions from the pack
    for (const extensionId of packState.installedExtensions) {
      try {
        await invoke("uninstall_extension", { name: extensionId });
      } catch (e) {
        console.error(`Failed to uninstall extension ${extensionId}:`, e);
      }
    }

    // Remove pack state
    setPackStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(packId);
      return newMap;
    });

    // Reload extensions
    await loadExtensions();

    // Emit event
    window.dispatchEvent(
      new CustomEvent("extensions:pack-uninstall-complete", {
        detail: { packId },
      })
    );
  };

  /**
   * Get the list of extension IDs in a pack
   */
  const getExtensionPackContents = (packId: string): string[] => {
    const pack = knownPacks().get(packId);
    return pack?.extensionIds ?? [];
  };

  /**
   * Check if an extension ID refers to a pack
   */
  const isExtensionPack = (extensionId: string): boolean => {
    return knownPacks().has(extensionId);
  };

  /**
   * Get all installed pack states
   */
  const getInstalledPacks = (): ExtensionPackState[] => {
    return Array.from(packStates.values()).filter(
      (state) => state.installedExtensions.length > 0
    );
  };

  /**
   * Get the pack ID that an extension belongs to (if any)
   */
  const getPackForExtension = (extensionId: string): string | undefined => {
    for (const [packId, state] of packStates.entries()) {
      if (state.installedExtensions.includes(extensionId)) {
        return packId;
      }
    }
    return undefined;
  };

  // ============================================================================
  // Web Extension Functions (simplified - WASM replaces web extension host)
  // ============================================================================

  const isWebExtension = (extensionId: string): boolean => {
    const ext = extensions().find((e) => e.manifest.name === extensionId);
    if (!ext) return false;

    const hasWorkspaceContributions =
      ext.manifest.contributes.languages.length > 0 ||
      ext.manifest.contributes.snippets.length > 0;

    const hasOnlyUIContributions =
      !hasWorkspaceContributions &&
      (ext.manifest.contributes.themes.length > 0 ||
        ext.manifest.contributes.commands.length > 0);

    return hasOnlyUIContributions;
  };

  const getExtensionKind = (extensionId: string): ExtensionKindString[] => {
    const ext = extensions().find((e) => e.manifest.name === extensionId);
    if (!ext) return ["workspace"];

    const kinds: ExtensionKindString[] = [];

    const manifest = ext.manifest as ExtensionManifest & {
      extensionKind?: ExtensionKindString[];
    };

    if (manifest.extensionKind) {
      return manifest.extensionKind;
    }

    const hasUIContributions =
      ext.manifest.contributes.themes.length > 0 ||
      ext.manifest.contributes.panels.length > 0;

    const hasWorkspaceContributions =
      ext.manifest.contributes.languages.length > 0 ||
      ext.manifest.contributes.snippets.length > 0 ||
      ext.manifest.main;

    if (hasUIContributions) kinds.push("ui");
    if (hasWorkspaceContributions) kinds.push("workspace");

    if (kinds.length === 0) kinds.push("workspace");

    return kinds;
  };

  const getWebExtensionHost = (): null => null;

  const startWebExtensionHost = async (): Promise<void> => {
    console.info("[ExtensionsProvider] Web extensions now run via WASM runtime");
  };

  const stopWebExtensionHost = async (): Promise<void> => {
    // No-op: web extension host replaced by WASM runtime
  };

  // ============================================================================
  // Profiler Functions
  // ============================================================================

  /**
   * Get extension profiles for all running extensions
   */
  const getExtensionProfiles = (): ExtensionProfileData[] => {
    const states = runtimeStates();
    // Note: enabledExtensions lookup and ext variable kept for potential future use
    // const enabled = enabledExtensions();

    return states.map((state) => {
      // const ext = enabled.find((e) => e.manifest.name === state.id);

      // Determine status
      let status: "active" | "idle" | "error" = "idle";
      if (state.status === ExtensionStatus.Error || state.status === ExtensionStatus.Crashed) {
        status = "error";
      } else if (state.status === ExtensionStatus.Active) {
        const lastActivityTime = state.lastActivity || 0;
        const isRecentlyActive = Date.now() - lastActivityTime < 30000;
        status = isRecentlyActive ? "active" : "idle";
      }

      return {
        extensionId: state.id,
        activationTime: state.activationTime || 0,
        activationEvent: "*", // Would come from extension manifest
        memoryUsage: state.memoryUsage || 0,
        cpuUsage: state.cpuUsage || 0,
        apiCalls: 0, // Would be tracked by extension host
        lastActive: new Date(state.lastActivity || Date.now()),
        status,
      };
    });
  };

  /**
   * Restart a specific extension
   */
  const restartExtension = async (id: string): Promise<void> => {
    if (hostStatus() !== ExtensionHostStatus.Ready) {
      throw new Error("Extension host not running");
    }

    await deactivateRuntimeExtension(id);
    await activateRuntimeExtension(id);
  };

  /**
   * Get memory usage for a specific extension
   */
  const getExtensionMemoryUsage = (id: string): number => {
    const state = runtimeStates().find((s) => s.id === id);
    return state?.memoryUsage || 0;
  };

  // Auto-load extensions on mount - DEFERRED for startup performance
  // Extensions are not needed for first paint, so we load them during idle time
  onMount(() => {
    // Use requestIdleCallback to defer extension loading until browser is idle
    // This prevents blocking the main thread during startup
    const loadExtensionsDeferred = async () => {
      // Load extensions directory path (deferred from mount for startup perf)
      try {
        const dir = await invoke<string>("get_extensions_directory");
        setExtensionsDir(dir);
      } catch (e) {
        console.error("Failed to get extensions directory:", e);
      }

      await loadExtensions();
      setInitialized(true);

      // Setup event listener for update-related events
      try {
        unlistenFn = await listen<{ name: string; version: string }>(
          "extension:update-available",
          (event) => {
            const { name, version } = event.payload;
            const ext = extensions().find((e) => e.manifest.name === name);
            if (ext && compareVersions(ext.manifest.version, version) < 0) {
              setUpdateState(
                produce((state) => {
                  state.outdatedExtensions.set(name, {
                    extensionName: name,
                    currentVersion: ext.manifest.version,
                    availableVersion: version,
                  });
                })
              );
            }
          }
        );
      } catch {
        // Tauri events not available
      }

      // Check for updates on startup if enabled
      if (updateState.settings.autoCheckUpdates) {
        // Delay initial check slightly to not block startup
        setTimeout(async () => {
          await checkForUpdates();
          
          // Perform auto-update after check if enabled
          if (updateState.settings.autoUpdate) {
            await performAutoUpdate();
          }
        }, 5000);
      }

      // Setup periodic update checks
      setupPeriodicUpdateCheck();
    };

    // Defer with requestIdleCallback (with 2s timeout fallback)
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback(() => loadExtensionsDeferred(), { timeout: 2000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(loadExtensionsDeferred, 500);
    }

    startWorkerHost();
  });

  const value: ExtensionsContextValue = {
    // Base state
    extensions,
    enabledExtensions,
    marketplaceExtensions,
    extensionThemes,
    loading,
    error,
    extensionsDir,
    initialized,

    // Update state
    outdatedExtensions,
    updateInProgress,
    lastChecked,
    checkingForUpdates,
    updateSettings,
    outdatedCount,

    // Extension Host state
    hostStatus,
    hostReady,
    runtimeStates,
    activeRuntimeExtensions,

    // Base actions
    loadExtensions,
    enableExtension,
    disableExtension,
    uninstallExtension,
    installFromPath,
    openExtensionsDirectory,
    searchMarketplace,
    getFeaturedExtensions,
    installFromMarketplace,
    refreshThemes,
    getExtensionCommands,
    getExtensionLanguages,
    getExtensionPanels,
    getExtensionSettings,
    executeExtensionCommand,

    // Update actions
    checkForUpdates,
    updateExtension,
    updateAllExtensions,
    getOutdatedExtensions,
    isExtensionOutdated,
    isExtensionUpdating,
    getUpdateInfo,
    setUpdateSettings,

    // Extension Host actions
    startExtensionHost,
    stopExtensionHost,
    restartExtensionHost,
    activateRuntimeExtension,
    deactivateRuntimeExtension,
    executeHostCommand,
    sendHostEvent,
    getExtensionHost,

    // Extension Pack actions
    installExtensionPack,
    uninstallExtensionPack,
    getExtensionPackContents,
    isExtensionPack,
    getInstalledPacks,
    getPackForExtension,

    // Web Extension Support
    isWebExtension,
    getExtensionKind,
    getWebExtensionHost,
    startWebExtensionHost,
    stopWebExtensionHost,

    // Profiler actions
    getExtensionProfiles,
    restartExtension,
    getExtensionMemoryUsage,
  };

  return (
    <ExtensionsContext.Provider value={value}>
      {props.children}
    </ExtensionsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useExtensions(): ExtensionsContextValue {
  const context = useContext(ExtensionsContext);
  if (!context) {
    throw new Error("useExtensions must be used within an ExtensionsProvider");
  }
  return context;
}

/**
 * Convenience hook for extension update functionality
 */
export function useExtensionUpdates() {
  const ctx = useExtensions();
  
  return {
    // State
    outdatedExtensions: ctx.outdatedExtensions,
    outdatedCount: ctx.outdatedCount,
    updateInProgress: ctx.updateInProgress,
    lastChecked: ctx.lastChecked,
    checkingForUpdates: ctx.checkingForUpdates,
    settings: ctx.updateSettings,
    
    // Actions
    checkForUpdates: ctx.checkForUpdates,
    updateExtension: ctx.updateExtension,
    updateAllExtensions: ctx.updateAllExtensions,
    getOutdatedExtensions: ctx.getOutdatedExtensions,
    isExtensionOutdated: ctx.isExtensionOutdated,
    isExtensionUpdating: ctx.isExtensionUpdating,
    getUpdateInfo: ctx.getUpdateInfo,
    setSettings: ctx.setUpdateSettings,
  };
}

/**
 * Hook to integrate extension updates with notifications
 * Use this in your app root to automatically show notifications for available updates
 */
export function useExtensionUpdateNotifications(
  notifyCallback: (count: number, updates: ExtensionUpdateInfo[]) => void
) {
  const { outdatedCount, getOutdatedExtensions } = useExtensionUpdates();
  
  onMount(() => {
    // Listen for updates-available events
    const handleUpdatesAvailable = (event: CustomEvent<{ count: number; updates: ExtensionUpdateInfo[] }>) => {
      const { count, updates } = event.detail;
      if (count > 0) {
        notifyCallback(count, updates);
      }
    };
    
    window.addEventListener("extensions:updates-available", handleUpdatesAvailable as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("extensions:updates-available", handleUpdatesAvailable as EventListener);
    });
  });
  
  return {
    outdatedCount,
    getOutdatedExtensions,
  };
}

/**
 * Convenience hook for extension host functionality
 */
export function useExtensionRuntime() {
  const ctx = useExtensions();
  
  return {
    // State
    status: ctx.hostStatus,
    isReady: ctx.hostReady,
    extensions: ctx.runtimeStates,
    activeExtensions: ctx.activeRuntimeExtensions,
    
    // Actions
    start: ctx.startExtensionHost,
    stop: ctx.stopExtensionHost,
    restart: ctx.restartExtensionHost,
    activate: ctx.activateRuntimeExtension,
    deactivate: ctx.deactivateRuntimeExtension,
    executeCommand: ctx.executeHostCommand,
    sendEvent: ctx.sendHostEvent,
    getHost: ctx.getExtensionHost,
  };
}

/**
 * Hook to execute extension commands
 */
export function useExtensionCommand<T = unknown>(commandId: string) {
  const { executeHostCommand, hostReady } = useExtensions();
  
  return async (...args: unknown[]): Promise<T> => {
    if (!hostReady()) {
      throw new Error("Extension host not ready");
    }
    return executeHostCommand<T>(commandId, ...args);
  };
}

/**
 * Hook to send events to extensions
 */
export function useExtensionEvent(eventName: string) {
  const { sendHostEvent, hostReady } = useExtensions();
  
  return (data: unknown): void => {
    if (hostReady()) {
      sendHostEvent(eventName, data);
    }
  };
}

/**
 * Hook to get runtime state of a specific extension
 */
export function useRuntimeExtension(extensionId: string) {
  const { runtimeStates } = useExtensions();
  
  return createMemo(() => runtimeStates().find(s => s.id === extensionId));
}

/**
 * Hook for extension profiler functionality
 */
export function useExtensionProfiler() {
  const ctx = useExtensions();
  
  return {
    // State
    profiles: ctx.getExtensionProfiles,
    
    // Actions
    restartExtension: ctx.restartExtension,
    getMemoryUsage: ctx.getExtensionMemoryUsage,
    
    // Derived stats
    getSlowExtensions: (thresholdMs: number = 100) => {
      return ctx.getExtensionProfiles().filter(p => p.activationTime > thresholdMs);
    },
    getTotalMemoryUsage: () => {
      return ctx.getExtensionProfiles().reduce((sum, p) => sum + p.memoryUsage, 0);
    },
    getErrorExtensions: () => {
      return ctx.getExtensionProfiles().filter(p => p.status === "error");
    },
  };
}

/**
 * Convenience hook for extension pack functionality
 */
export function useExtensionPacks() {
  const ctx = useExtensions();
  
  return {
    // Actions
    installPack: ctx.installExtensionPack,
    uninstallPack: ctx.uninstallExtensionPack,
    getPackContents: ctx.getExtensionPackContents,
    isPack: ctx.isExtensionPack,
    getInstalledPacks: ctx.getInstalledPacks,
    getPackForExtension: ctx.getPackForExtension,
  };
}

/**
 * Convenience hook for web extension functionality
 */
export function useWebExtensions() {
  const ctx = useExtensions();
  
  return {
    // Query
    isWebExtension: ctx.isWebExtension,
    getExtensionKind: ctx.getExtensionKind,
    
    // Host management
    getHost: ctx.getWebExtensionHost,
    startHost: ctx.startWebExtensionHost,
    stopHost: ctx.stopWebExtensionHost,
    
    // Derived
    getWebCompatibleExtensions: () => {
      return ctx.extensions().filter((ext) => ctx.isWebExtension(ext.manifest.name));
    },
    getUIExtensions: () => {
      return ctx.extensions().filter((ext) => 
        ctx.getExtensionKind(ext.manifest.name).includes("ui")
      );
    },
    getWorkspaceExtensions: () => {
      return ctx.extensions().filter((ext) => 
        ctx.getExtensionKind(ext.manifest.name).includes("workspace")
      );
    },
  };
}

/**
 * Hook to listen for extension pack installation events
 */
export function useExtensionPackEvents(callbacks: {
  onInstallStart?: (pack: ExtensionPack, count: number) => void;
  onInstallProgress?: (packId: string, extensionId: string, installed: number, total: number) => void;
  onInstallComplete?: (packId: string, installed: string[], failed: string[], success: boolean) => void;
  onUninstallComplete?: (packId: string) => void;
}) {
  onMount(() => {
    const handleStart = (event: CustomEvent) => {
      callbacks.onInstallStart?.(event.detail.pack, event.detail.extensionCount);
    };

    const handleProgress = (event: CustomEvent) => {
      callbacks.onInstallProgress?.(
        event.detail.packId,
        event.detail.extensionId,
        event.detail.installed,
        event.detail.total
      );
    };

    const handleComplete = (event: CustomEvent) => {
      callbacks.onInstallComplete?.(
        event.detail.packId,
        event.detail.installedExtensions,
        event.detail.failedExtensions,
        event.detail.success
      );
    };

    const handleUninstall = (event: CustomEvent) => {
      callbacks.onUninstallComplete?.(event.detail.packId);
    };

    window.addEventListener("extensions:pack-install-start", handleStart as EventListener);
    window.addEventListener("extensions:pack-install-progress", handleProgress as EventListener);
    window.addEventListener("extensions:pack-install-complete", handleComplete as EventListener);
    window.addEventListener("extensions:pack-uninstall-complete", handleUninstall as EventListener);

    onCleanup(() => {
      window.removeEventListener("extensions:pack-install-start", handleStart as EventListener);
      window.removeEventListener("extensions:pack-install-progress", handleProgress as EventListener);
      window.removeEventListener("extensions:pack-install-complete", handleComplete as EventListener);
      window.removeEventListener("extensions:pack-uninstall-complete", handleUninstall as EventListener);
    });
  });
}

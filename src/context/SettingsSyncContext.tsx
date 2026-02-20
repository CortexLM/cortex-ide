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
import { createStore, produce, reconcile } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Type Definitions
// ============================================================================

/** Sync status indicating current state of synchronization */
export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "conflict";

/** Available items that can be synced */
export type SyncableItem = 
  | "settings"
  | "keybindings"
  | "snippets"
  | "uiState"
  | "extensions";

/** Account information for sync service */
export interface SyncAccount {
  id: string;
  provider: "github" | "custom";
  username: string;
  email?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  gistId?: string;
  customEndpoint?: string;
}

/** Conflict between local and remote data */
export interface SyncConflict {
  id: string;
  itemType: SyncableItem;
  itemKey: string;
  localValue: unknown;
  remoteValue: unknown;
  localTimestamp: number;
  remoteTimestamp: number;
  resolved: boolean;
}

/** Resolution choice for conflicts */
export type ConflictResolution = "local" | "remote" | "merge";

/** Sync item configuration */
export interface SyncItemConfig {
  enabled: boolean;
  lastSynced: number | null;
  error: string | null;
}

/** What items to sync */
export interface SyncItems {
  settings: SyncItemConfig;
  keybindings: SyncItemConfig;
  snippets: SyncItemConfig;
  uiState: SyncItemConfig;
  extensions: SyncItemConfig;
}

/** Sync data stored remotely */
export interface SyncData {
  version: number;
  timestamp: number;
  machineId: string;
  items: {
    settings?: unknown;
    keybindings?: unknown;
    snippets?: unknown;
    uiState?: unknown;
    extensions?: string[];
  };
}

/** Sync activity log entry */
export interface SyncActivityEntry {
  id: string;
  timestamp: number;
  action: "upload" | "download" | "conflict" | "error" | "merge";
  itemType: SyncableItem;
  message: string;
  success: boolean;
}

// ============================================================================
// State Definition
// ============================================================================

export interface SettingsSyncState {
  enabled: boolean;
  status: SyncStatus;
  account: SyncAccount | null;
  lastSyncTime: number | null;
  syncItems: SyncItems;
  conflicts: SyncConflict[];
  activityLog: SyncActivityEntry[];
  autoSync: boolean;
  syncOnStartup: boolean;
  syncInterval: number; // in minutes
  error: string | null;
  loading: boolean;
}

// ============================================================================
// Context Value
// ============================================================================

export interface SettingsSyncContextValue {
  state: SettingsSyncState;
  
  // Accessors
  isEnabled: Accessor<boolean>;
  isSyncing: Accessor<boolean>;
  hasConflicts: Accessor<boolean>;
  account: Accessor<SyncAccount | null>;
  
  // Account management
  enableSync: (account: SyncAccount) => Promise<void>;
  disableSync: () => Promise<void>;
  updateAccount: (updates: Partial<SyncAccount>) => Promise<void>;
  signOut: () => Promise<void>;
  
  // Sync operations
  syncNow: () => Promise<void>;
  syncItem: (item: SyncableItem) => Promise<void>;
  
  // Conflict resolution
  resolveConflict: (conflictId: string, choice: ConflictResolution) => Promise<void>;
  resolveAllConflicts: (choice: ConflictResolution) => Promise<void>;
  
  // Item configuration
  toggleSyncItem: (item: SyncableItem, enabled: boolean) => void;
  setSyncItems: (items: Partial<SyncItems>) => void;
  
  // Settings
  setAutoSync: (enabled: boolean) => void;
  setSyncOnStartup: (enabled: boolean) => void;
  setSyncInterval: (minutes: number) => void;
  
  // Import/Export
  exportSettings: () => Promise<string>;
  importSettings: (data: string) => Promise<void>;
  
  // Utilities
  clearActivityLog: () => void;
  getLastSyncTimeFormatted: () => string;
  resetSyncState: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "cortex-settings-sync";
const SYNC_DATA_VERSION = 1;
const DEFAULT_SYNC_INTERVAL = 30; // minutes

const DEFAULT_SYNC_ITEM_CONFIG: SyncItemConfig = {
  enabled: true,
  lastSynced: null,
  error: null,
};

const DEFAULT_SYNC_ITEMS: SyncItems = {
  settings: { ...DEFAULT_SYNC_ITEM_CONFIG },
  keybindings: { ...DEFAULT_SYNC_ITEM_CONFIG },
  snippets: { ...DEFAULT_SYNC_ITEM_CONFIG },
  uiState: { ...DEFAULT_SYNC_ITEM_CONFIG, enabled: false },
  extensions: { ...DEFAULT_SYNC_ITEM_CONFIG },
};

const DEFAULT_STATE: SettingsSyncState = {
  enabled: false,
  status: "idle",
  account: null,
  lastSyncTime: null,
  syncItems: DEFAULT_SYNC_ITEMS,
  conflicts: [],
  activityLog: [],
  autoSync: true,
  syncOnStartup: true,
  syncInterval: DEFAULT_SYNC_INTERVAL,
  error: null,
  loading: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getMachineId(): string {
  let machineId = localStorage.getItem("cortex-machine-id");
  if (!machineId) {
    machineId = generateId();
    localStorage.setItem("cortex-machine-id", machineId);
  }
  return machineId;
}

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return "Never";
  
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// GitHub Gist API Functions
// ============================================================================

interface GistFile {
  content: string;
}

interface GistResponse {
  id: string;
  files: Record<string, GistFile>;
  updated_at: string;
}

async function createGist(token: string, data: SyncData): Promise<string> {
  const response = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: "Cortex IDE Settings Sync",
      public: false,
      files: {
        "cortex-settings-sync.json": {
          content: JSON.stringify(data, null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create gist: ${response.status} ${error}`);
  }

  const gist: GistResponse = await response.json();
  return gist.id;
}

async function updateGist(token: string, gistId: string, data: SyncData): Promise<void> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        "cortex-settings-sync.json": {
          content: JSON.stringify(data, null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update gist: ${response.status} ${error}`);
  }
}

async function fetchGist(token: string, gistId: string): Promise<SyncData | null> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch gist: ${response.status} ${error}`);
  }

  const gist: GistResponse = await response.json();
  const file = gist.files["cortex-settings-sync.json"];
  
  if (!file) {
    return null;
  }

  return JSON.parse(file.content);
}

async function deleteGist(token: string, gistId: string): Promise<void> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete gist: ${response.status} ${error}`);
  }
}

// ============================================================================
// Backend Sync Bridge
// ============================================================================

interface BackendSyncResult {
  success: boolean;
  message: string;
  conflicts: Array<{
    id: string;
    itemKind: string;
    localTimestamp: number;
    remoteTimestamp: number;
    localPreview: string;
    remotePreview: string;
  }>;
  timestamp: number;
}

interface BackendSyncStatus {
  status: string;
  profile: {
    id: string;
    provider: string;
    gistId: string | null;
    username: string | null;
    customEndpoint: string | null;
    createdAt: number;
    lastSyncAt: number | null;
  } | null;
  conflicts: Array<{
    id: string;
    itemKind: string;
    localTimestamp: number;
    remoteTimestamp: number;
    localPreview: string;
    remotePreview: string;
  }>;
  lastError: string | null;
  lastSyncTime: number | null;
}

export async function backendSyncPush(token: string, gistId?: string): Promise<BackendSyncResult | null> {
  try {
    return await invoke<BackendSyncResult>("sync_push", {
      token,
      gistId: gistId || null,
    });
  } catch (e) {
    console.debug("[SettingsSync] Backend sync_push unavailable:", e);
    return null;
  }
}

export async function backendSyncPull(token: string, gistId: string): Promise<BackendSyncResult | null> {
  try {
    return await invoke<BackendSyncResult>("sync_pull", { token, gistId });
  } catch (e) {
    console.debug("[SettingsSync] Backend sync_pull unavailable:", e);
    return null;
  }
}

export async function backendSyncStatus(): Promise<BackendSyncStatus | null> {
  try {
    return await invoke<BackendSyncStatus>("sync_status");
  } catch (e) {
    console.debug("[SettingsSync] Backend sync_status unavailable:", e);
    return null;
  }
}

export async function backendResolveConflicts(
  token: string,
  gistId: string,
  resolution: "local" | "remote" | "merge"
): Promise<BackendSyncResult | null> {
  try {
    return await invoke<BackendSyncResult>("sync_resolve_conflicts", {
      token,
      gistId,
      resolution,
    });
  } catch (e) {
    console.debug("[SettingsSync] Backend sync_resolve_conflicts unavailable:", e);
    return null;
  }
}

// ============================================================================
// Custom Backend API Functions
// ============================================================================

async function uploadToCustomBackend(
  endpoint: string,
  token: string,
  data: SyncData
): Promise<void> {
  const response = await fetch(`${endpoint}/sync`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload settings: ${response.status} ${error}`);
  }
}

async function downloadFromCustomBackend(
  endpoint: string,
  token: string
): Promise<SyncData | null> {
  const response = await fetch(`${endpoint}/sync`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to download settings: ${response.status} ${error}`);
  }

  return response.json();
}

// ============================================================================
// Local Data Collection Functions
// ============================================================================

function collectLocalSettings(): unknown {
  const stored = localStorage.getItem("cortex-settings");
  return stored ? JSON.parse(stored) : null;
}

function collectLocalKeybindings(): unknown {
  const stored = localStorage.getItem("cortex_keybindings");
  return stored ? JSON.parse(stored) : null;
}

function collectLocalSnippets(): unknown {
  const stored = localStorage.getItem("cortex-user-snippets");
  return stored ? JSON.parse(stored) : null;
}

function collectLocalUIState(): unknown {
  const uiState: Record<string, unknown> = {};
  const uiKeys = [
    "cortex-sidebar-width",
    "cortex-panel-height",
    "cortex-sidebar-collapsed",
    "cortex-active-panels",
  ];
  
  for (const key of uiKeys) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        uiState[key] = JSON.parse(value);
      } catch (err) {
        console.debug("[SettingsSync] Parse UI state failed:", err);
        uiState[key] = value;
      }
    }
  }
  
  return Object.keys(uiState).length > 0 ? uiState : null;
}

function collectLocalExtensions(): string[] {
  const stored = localStorage.getItem("cortex-enabled-extensions");
  return stored ? JSON.parse(stored) : [];
}

function applySettings(data: unknown): void {
  if (data) {
    localStorage.setItem("cortex-settings", JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("settings:imported"));
  }
}

function applyKeybindings(data: unknown): void {
  if (data) {
    localStorage.setItem("cortex_keybindings", JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("keybindings:imported"));
  }
}

function applySnippets(data: unknown): void {
  if (data) {
    localStorage.setItem("cortex-user-snippets", JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("snippets:imported"));
  }
}

function applyUIState(data: unknown): void {
  if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    window.dispatchEvent(new CustomEvent("uistate:imported"));
  }
}

function applyExtensions(extensions: string[]): void {
  if (extensions && Array.isArray(extensions)) {
    localStorage.setItem("cortex-enabled-extensions", JSON.stringify(extensions));
    window.dispatchEvent(new CustomEvent("extensions:imported"));
  }
}

// ============================================================================
// Context
// ============================================================================

const SettingsSyncContext = createContext<SettingsSyncContextValue>();

// ============================================================================
// Provider Component
// ============================================================================

export function SettingsSyncProvider(props: ParentProps) {
  const [state, setState] = createStore<SettingsSyncState>(DEFAULT_STATE);
  let syncIntervalId: number | null = null;

  // Load saved state on mount
  onMount(() => {
    loadSavedState();
    
    if (state.enabled && state.syncOnStartup) {
      syncNow();
    }
    
    if (state.enabled && state.autoSync) {
      startAutoSync();
    }

    // Cleanup on unmount
    onCleanup(() => {
      stopAutoSync();
    });
  });

  // Start auto-sync when settings change
  createEffect(() => {
    if (state.enabled && state.autoSync) {
      startAutoSync();
    } else {
      stopAutoSync();
    }
  });

  // Persist state changes
  createEffect(() => {
    const stateToSave = {
      enabled: state.enabled,
      account: state.account,
      syncItems: state.syncItems,
      autoSync: state.autoSync,
      syncOnStartup: state.syncOnStartup,
      syncInterval: state.syncInterval,
      lastSyncTime: state.lastSyncTime,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  });

  function loadSavedState(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        batch(() => {
          if (parsed.enabled !== undefined) setState("enabled", parsed.enabled);
          if (parsed.account) setState("account", parsed.account);
          if (parsed.syncItems) setState("syncItems", reconcile(parsed.syncItems));
          if (parsed.autoSync !== undefined) setState("autoSync", parsed.autoSync);
          if (parsed.syncOnStartup !== undefined) setState("syncOnStartup", parsed.syncOnStartup);
          if (parsed.syncInterval !== undefined) setState("syncInterval", parsed.syncInterval);
          if (parsed.lastSyncTime !== undefined) setState("lastSyncTime", parsed.lastSyncTime);
        });
      }
    } catch (e) {
      console.error("[SettingsSync] Failed to load saved state:", e);
    }
  }

  function startAutoSync(): void {
    stopAutoSync();
    const intervalMs = state.syncInterval * 60 * 1000;
    syncIntervalId = window.setInterval(() => {
      if (state.enabled && state.status !== "syncing") {
        syncNow();
      }
    }, intervalMs);
  }

  function stopAutoSync(): void {
    if (syncIntervalId !== null) {
      window.clearInterval(syncIntervalId);
      syncIntervalId = null;
    }
  }

  function addActivityEntry(
    action: SyncActivityEntry["action"],
    itemType: SyncableItem,
    message: string,
    success: boolean
  ): void {
    const entry: SyncActivityEntry = {
      id: generateId(),
      timestamp: Date.now(),
      action,
      itemType,
      message,
      success,
    };
    
    setState(
      produce((s) => {
        s.activityLog.unshift(entry);
        // Keep only last 100 entries
        if (s.activityLog.length > 100) {
          s.activityLog = s.activityLog.slice(0, 100);
        }
      })
    );
  }

  async function enableSync(account: SyncAccount): Promise<void> {
    setState("loading", true);
    setState("error", null);
    
    try {
      // Validate account
      if (account.provider === "github" && !account.accessToken) {
        throw new Error("GitHub access token is required");
      }
      
      if (account.provider === "custom" && !account.customEndpoint) {
        throw new Error("Custom endpoint URL is required");
      }

      // If GitHub and no gist ID, create one
      if (account.provider === "github" && !account.gistId) {
        const localData = collectSyncData();
        const gistId = await createGist(account.accessToken, localData);
        account = { ...account, gistId };
      }

      batch(() => {
        setState("account", account);
        setState("enabled", true);
        setState("status", "idle");
      });
      
      addActivityEntry("upload", "settings", "Sync enabled successfully", true);
      
      // Perform initial sync
      await syncNow();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      addActivityEntry("error", "settings", `Failed to enable sync: ${errorMsg}`, false);
      throw e;
    } finally {
      setState("loading", false);
    }
  }

  async function disableSync(): Promise<void> {
    stopAutoSync();
    
    batch(() => {
      setState("enabled", false);
      setState("status", "idle");
      setState("conflicts", []);
    });
    
    addActivityEntry("download", "settings", "Sync disabled", true);
  }

  async function updateAccount(updates: Partial<SyncAccount>): Promise<void> {
    if (!state.account) return;
    
    setState("account", { ...state.account, ...updates });
  }

  async function signOut(): Promise<void> {
    const account = state.account;
    
    // Optionally delete the gist when signing out
    if (account?.provider === "github" && account.gistId) {
      try {
        await deleteGist(account.accessToken, account.gistId);
      } catch (err) {
        console.debug("[SettingsSync] Gist deletion failed:", err);
      }
    }
    
    batch(() => {
      setState("account", null);
      setState("enabled", false);
      setState("status", "idle");
      setState("conflicts", []);
      setState("activityLog", []);
      setState("lastSyncTime", null);
    });
    
    // Clear persisted state
    localStorage.removeItem(STORAGE_KEY);
  }

  function collectSyncData(): SyncData {
    const items: SyncData["items"] = {};
    
    if (state.syncItems.settings.enabled) {
      items.settings = collectLocalSettings();
    }
    if (state.syncItems.keybindings.enabled) {
      items.keybindings = collectLocalKeybindings();
    }
    if (state.syncItems.snippets.enabled) {
      items.snippets = collectLocalSnippets();
    }
    if (state.syncItems.uiState.enabled) {
      items.uiState = collectLocalUIState();
    }
    if (state.syncItems.extensions.enabled) {
      items.extensions = collectLocalExtensions();
    }
    
    return {
      version: SYNC_DATA_VERSION,
      timestamp: Date.now(),
      machineId: getMachineId(),
      items,
    };
  }

  async function uploadData(data: SyncData): Promise<void> {
    const account = state.account;
    if (!account) throw new Error("No account configured");

    if (account.provider === "github") {
      if (!account.gistId) {
        const gistId = await createGist(account.accessToken, data);
        setState("account", { ...account, gistId });
      } else {
        await updateGist(account.accessToken, account.gistId, data);
      }
    } else if (account.provider === "custom" && account.customEndpoint) {
      await uploadToCustomBackend(account.customEndpoint, account.accessToken, data);
    }
  }

  async function downloadData(): Promise<SyncData | null> {
    const account = state.account;
    if (!account) throw new Error("No account configured");

    if (account.provider === "github" && account.gistId) {
      return fetchGist(account.accessToken, account.gistId);
    } else if (account.provider === "custom" && account.customEndpoint) {
      return downloadFromCustomBackend(account.customEndpoint, account.accessToken);
    }

    return null;
  }

  function detectConflicts(local: SyncData, remote: SyncData): SyncConflict[] {
    const conflicts: SyncConflict[] = [];
    const items: SyncableItem[] = ["settings", "keybindings", "snippets", "uiState", "extensions"];
    
    for (const item of items) {
      if (!state.syncItems[item].enabled) continue;
      
      const localValue = local.items[item];
      const remoteValue = remote.items[item];
      
      // Skip if both are empty/null
      if (!localValue && !remoteValue) continue;
      
      // Detect conflict if remote is newer but local has changes
      const lastSynced = state.syncItems[item].lastSynced || 0;
      const hasLocalChanges = lastSynced > 0 && JSON.stringify(localValue) !== JSON.stringify(remoteValue);
      const remoteIsNewer = remote.timestamp > lastSynced;
      
      if (hasLocalChanges && remoteIsNewer && remote.machineId !== getMachineId()) {
        conflicts.push({
          id: generateId(),
          itemType: item,
          itemKey: item,
          localValue,
          remoteValue,
          localTimestamp: local.timestamp,
          remoteTimestamp: remote.timestamp,
          resolved: false,
        });
      }
    }
    
    return conflicts;
  }

  function applyRemoteData(data: SyncData): void {
    if (data.items.settings && state.syncItems.settings.enabled) {
      applySettings(data.items.settings);
      setState("syncItems", "settings", "lastSynced", Date.now());
    }
    if (data.items.keybindings && state.syncItems.keybindings.enabled) {
      applyKeybindings(data.items.keybindings);
      setState("syncItems", "keybindings", "lastSynced", Date.now());
    }
    if (data.items.snippets && state.syncItems.snippets.enabled) {
      applySnippets(data.items.snippets);
      setState("syncItems", "snippets", "lastSynced", Date.now());
    }
    if (data.items.uiState && state.syncItems.uiState.enabled) {
      applyUIState(data.items.uiState);
      setState("syncItems", "uiState", "lastSynced", Date.now());
    }
    if (data.items.extensions && state.syncItems.extensions.enabled) {
      applyExtensions(data.items.extensions);
      setState("syncItems", "extensions", "lastSynced", Date.now());
    }
  }

  async function syncNow(): Promise<void> {
    if (!state.enabled || !state.account) {
      return;
    }

    if (state.status === "syncing") {
      return;
    }

    setState("status", "syncing");
    setState("error", null);

    try {
      // Collect local data
      const localData = collectSyncData();
      
      // Fetch remote data
      const remoteData = await downloadData();
      
      if (!remoteData) {
        // No remote data, upload local
        await uploadData(localData);
        setState("lastSyncTime", Date.now());
        setState("status", "synced");
        addActivityEntry("upload", "settings", "Initial upload completed", true);
        return;
      }

      // Check for conflicts
      const conflicts = detectConflicts(localData, remoteData);
      
      if (conflicts.length > 0) {
        setState("conflicts", conflicts);
        setState("status", "conflict");
        addActivityEntry("conflict", "settings", `${conflicts.length} conflict(s) detected`, false);
        return;
      }

      // Determine sync direction based on timestamps
      const remoteIsNewer = remoteData.timestamp > (state.lastSyncTime || 0);
      const localHasChanges = localData.timestamp > (state.lastSyncTime || 0);

      if (remoteIsNewer && remoteData.machineId !== getMachineId()) {
        // Download remote changes
        applyRemoteData(remoteData);
        addActivityEntry("download", "settings", "Downloaded remote settings", true);
      }
      
      if (localHasChanges || !remoteIsNewer) {
        // Upload local changes
        await uploadData(localData);
        addActivityEntry("upload", "settings", "Uploaded local settings", true);
      }

      // Bridge to backend for file-level sync
      if (state.account?.provider === "github" && state.account?.accessToken && state.account?.gistId) {
        backendSyncPush(state.account.accessToken, state.account.gistId).catch(() => {});
      }

      setState("lastSyncTime", Date.now());
      setState("status", "synced");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      setState("status", "error");
      addActivityEntry("error", "settings", `Sync failed: ${errorMsg}`, false);
    }
  }

  async function syncItem(item: SyncableItem): Promise<void> {
    if (!state.enabled || !state.account) return;
    
    setState("status", "syncing");
    
    try {
      const localData = collectSyncData();
      await uploadData(localData);
      
      setState("syncItems", item, "lastSynced", Date.now());
      setState("status", "synced");
      addActivityEntry("upload", item, `Synced ${item}`, true);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("syncItems", item, "error", errorMsg);
      setState("status", "error");
      addActivityEntry("error", item, `Failed to sync ${item}: ${errorMsg}`, false);
    }
  }

  async function resolveConflict(conflictId: string, choice: ConflictResolution): Promise<void> {
    const conflict = state.conflicts.find((c) => c.id === conflictId);
    if (!conflict) return;

    try {
      if (choice === "local") {
        // Keep local, upload to remote
        const localData = collectSyncData();
        await uploadData(localData);
        addActivityEntry("merge", conflict.itemType, `Resolved conflict: kept local ${conflict.itemType}`, true);
      } else if (choice === "remote") {
        // Apply remote value
        const remoteData = await downloadData();
        if (remoteData) {
          applyRemoteData(remoteData);
        }
        addActivityEntry("merge", conflict.itemType, `Resolved conflict: applied remote ${conflict.itemType}`, true);
      } else if (choice === "merge") {
        // For merge, we keep local for now (could implement smart merge in future)
        const localData = collectSyncData();
        await uploadData(localData);
        addActivityEntry("merge", conflict.itemType, `Resolved conflict: merged ${conflict.itemType}`, true);
      }

      // Remove resolved conflict
      setState(
        "conflicts",
        state.conflicts.filter((c) => c.id !== conflictId)
      );

      // Bridge to backend conflict resolution
      if (state.account?.provider === "github" && state.account?.accessToken && state.account?.gistId) {
        backendResolveConflicts(state.account.accessToken, state.account.gistId, choice).catch(() => {});
      }

      // Update status if no more conflicts
      if (state.conflicts.length === 0) {
        setState("status", "synced");
        setState("lastSyncTime", Date.now());
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      addActivityEntry("error", conflict.itemType, `Failed to resolve conflict: ${errorMsg}`, false);
    }
  }

  async function resolveAllConflicts(choice: ConflictResolution): Promise<void> {
    const conflictIds = state.conflicts.map((c) => c.id);
    for (const id of conflictIds) {
      await resolveConflict(id, choice);
    }
  }

  function toggleSyncItem(item: SyncableItem, enabled: boolean): void {
    setState("syncItems", item, "enabled", enabled);
  }

  function setSyncItems(items: Partial<SyncItems>): void {
    for (const [key, value] of Object.entries(items)) {
      if (value) {
        setState("syncItems", key as SyncableItem, value);
      }
    }
  }

  function setAutoSync(enabled: boolean): void {
    setState("autoSync", enabled);
  }

  function setSyncOnStartup(enabled: boolean): void {
    setState("syncOnStartup", enabled);
  }

  function setSyncInterval(minutes: number): void {
    setState("syncInterval", Math.max(5, Math.min(1440, minutes)));
    if (state.enabled && state.autoSync) {
      startAutoSync();
    }
  }

  async function exportSettings(): Promise<string> {
    const data = collectSyncData();
    return JSON.stringify(data, null, 2);
  }

  async function importSettings(jsonData: string): Promise<void> {
    try {
      const data: SyncData = JSON.parse(jsonData);
      
      if (!data.version || !data.items) {
        throw new Error("Invalid settings file format");
      }
      
      applyRemoteData(data);
      addActivityEntry("download", "settings", "Imported settings from file", true);
      
      // Trigger sync to upload imported settings
      if (state.enabled) {
        await syncNow();
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      addActivityEntry("error", "settings", `Import failed: ${errorMsg}`, false);
      throw e;
    }
  }

  function clearActivityLog(): void {
    setState("activityLog", []);
  }

  function getLastSyncTimeFormatted(): string {
    return formatTimestamp(state.lastSyncTime);
  }

  async function resetSyncState(): Promise<void> {
    await signOut();
    setState(reconcile(DEFAULT_STATE));
    localStorage.removeItem(STORAGE_KEY);
  }

  // Create accessor functions
  const isEnabled: Accessor<boolean> = () => state.enabled;
  const isSyncing: Accessor<boolean> = () => state.status === "syncing";
  const hasConflicts: Accessor<boolean> = () => state.conflicts.length > 0;
  const accountAccessor: Accessor<SyncAccount | null> = () => state.account;

  const value: SettingsSyncContextValue = {
    state,
    isEnabled,
    isSyncing,
    hasConflicts,
    account: accountAccessor,
    enableSync,
    disableSync,
    updateAccount,
    signOut,
    syncNow,
    syncItem,
    resolveConflict,
    resolveAllConflicts,
    toggleSyncItem,
    setSyncItems,
    setAutoSync,
    setSyncOnStartup,
    setSyncInterval,
    exportSettings,
    importSettings,
    clearActivityLog,
    getLastSyncTimeFormatted,
    resetSyncState,
  };

  return (
    <SettingsSyncContext.Provider value={value}>
      {props.children}
    </SettingsSyncContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useSettingsSync(): SettingsSyncContextValue {
  const context = useContext(SettingsSyncContext);
  if (!context) {
    throw new Error("useSettingsSync must be used within a SettingsSyncProvider");
  }
  return context;
}

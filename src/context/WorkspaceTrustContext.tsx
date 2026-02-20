import {
  createContext,
  useContext,
  ParentProps,
  createSignal,
  createMemo,
  createEffect,
  onMount,
  batch,
  Accessor,
} from "solid-js";
import { getProjectPath } from "../utils/workspace";

// ============================================================================
// Types
// ============================================================================

/** Trust level for a workspace */
export type TrustLevel = "trusted" | "restricted" | "unknown";

/** A trusted folder entry with metadata */
export interface TrustedFolder {
  /** Absolute path to the trusted folder */
  path: string;
  /** When the folder was trusted */
  trustedAt: number;
  /** Optional description for why it was trusted */
  description?: string;
  /** Whether trust was granted for parent folders */
  trustParent: boolean;
}

/** Restrictions applied in restricted mode */
export interface RestrictedModeRestrictions {
  /** Task execution is disabled */
  taskExecutionDisabled: boolean;
  /** Debugging is disabled */
  debuggingDisabled: boolean;
  /** Extension activation is disabled */
  extensionActivationDisabled: boolean;
  /** Terminal commands are restricted */
  terminalRestricted: boolean;
  /** File writing is restricted to safe locations */
  fileWriteRestricted: boolean;
}

/** Trust decision for a workspace */
export interface TrustDecision {
  /** The workspace path */
  workspacePath: string;
  /** Trust level */
  trustLevel: TrustLevel;
  /** When the decision was made */
  decidedAt: number;
  /** Whether to remember this decision */
  remember: boolean;
}

/** Workspace trust settings */
export interface WorkspaceTrustSettings {
  /** Enable workspace trust feature */
  enabled: boolean;
  /** Trust all workspaces by default (not recommended) */
  trustAllWorkspaces: boolean;
  /** Show the trust banner when workspace is not trusted */
  showBanner: boolean;
  /** Enable restricted mode restrictions */
  restrictedModeEnabled: boolean;
  /** Prompt before trusting parent folders */
  promptForParentFolderTrust: boolean;
}

/** Workspace trust state */
export interface WorkspaceTrustState {
  /** Current workspace path */
  currentWorkspace: string | null;
  /** Whether current workspace is trusted */
  isTrusted: boolean;
  /** Trust level of current workspace */
  trustLevel: TrustLevel;
  /** List of all trusted folders */
  trustedFolders: TrustedFolder[];
  /** Trust decisions history */
  trustDecisions: TrustDecision[];
  /** Current restrictions if in restricted mode */
  restrictions: RestrictedModeRestrictions;
  /** Trust settings */
  settings: WorkspaceTrustSettings;
  /** Whether the trust banner is dismissed for this session */
  bannerDismissed: boolean;
}

/** Context value interface */
export interface WorkspaceTrustContextValue {
  /** Current trust state */
  state: WorkspaceTrustState;
  /** Whether the current workspace is trusted */
  isTrusted: Accessor<boolean>;
  /** Current trust level */
  trustLevel: Accessor<TrustLevel>;
  /** List of trusted folders */
  trustedFolders: Accessor<TrustedFolder[]>;
  /** Current restrictions */
  restrictions: Accessor<RestrictedModeRestrictions>;
  /** Whether in restricted mode */
  isRestrictedMode: Accessor<boolean>;
  /** Whether the trust banner should be shown */
  shouldShowBanner: Accessor<boolean>;
  /** Trust settings */
  settings: Accessor<WorkspaceTrustSettings>;

  /** Trust the current workspace */
  trustWorkspace: (options?: { trustParent?: boolean; description?: string }) => void;
  /** Restrict the current workspace (remove trust) */
  restrictWorkspace: () => void;
  /** Add a folder to trusted folders list */
  addTrustedFolder: (path: string, options?: { trustParent?: boolean; description?: string }) => void;
  /** Remove a folder from trusted folders list */
  removeTrustedFolder: (path: string) => void;
  /** Check if a specific path is trusted */
  isPathTrusted: (path: string) => boolean;
  /** Set the current workspace path */
  setCurrentWorkspace: (path: string | null) => void;
  /** Update trust settings */
  updateSettings: (updates: Partial<WorkspaceTrustSettings>) => void;
  /** Dismiss the trust banner for this session */
  dismissBanner: () => void;
  /** Reset banner dismissed state */
  resetBannerDismissed: () => void;
  /** Clear all trust decisions */
  clearAllTrustDecisions: () => void;
  /** Get trust decision for a path */
  getTrustDecision: (path: string) => TrustDecision | undefined;
  /** Check if an action is allowed in current mode */
  isActionAllowed: (action: keyof RestrictedModeRestrictions) => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "cortex_workspace_trust";
const SETTINGS_KEY = "cortex_workspace_trust_settings";

const DEFAULT_RESTRICTIONS: RestrictedModeRestrictions = {
  taskExecutionDisabled: true,
  debuggingDisabled: true,
  extensionActivationDisabled: true,
  terminalRestricted: true,
  fileWriteRestricted: true,
};

const TRUSTED_RESTRICTIONS: RestrictedModeRestrictions = {
  taskExecutionDisabled: false,
  debuggingDisabled: false,
  extensionActivationDisabled: false,
  terminalRestricted: false,
  fileWriteRestricted: false,
};

const DEFAULT_SETTINGS: WorkspaceTrustSettings = {
  enabled: true,
  trustAllWorkspaces: false,
  showBanner: true,
  restrictedModeEnabled: true,
  promptForParentFolderTrust: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function isSubPath(parent: string, child: string): boolean {
  const normalizedParent = normalizePath(parent);
  const normalizedChild = normalizePath(child);
  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(normalizedParent + "/")
  );
}

function getParentPath(path: string): string | null {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) return null;
  return normalized.slice(0, lastSlash);
}

function loadStoredTrustData(): {
  trustedFolders: TrustedFolder[];
  trustDecisions: TrustDecision[];
} {
  if (typeof localStorage === "undefined") {
    return { trustedFolders: [], trustDecisions: [] };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return {
        trustedFolders: Array.isArray(data.trustedFolders) ? data.trustedFolders : [],
        trustDecisions: Array.isArray(data.trustDecisions) ? data.trustDecisions : [],
      };
    }
  } catch (err) {
    console.debug("[WorkspaceTrust] Parse error loading trust data:", err);
  }

  return { trustedFolders: [], trustDecisions: [] };
}

function loadStoredSettings(): WorkspaceTrustSettings {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.debug("[WorkspaceTrust] Parse error loading settings:", err);
  }

  return { ...DEFAULT_SETTINGS };
}

function saveTrustData(trustedFolders: TrustedFolder[], trustDecisions: TrustDecision[]): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ trustedFolders, trustDecisions })
    );
  } catch (err) {
    console.debug("[WorkspaceTrust] Storage save failed:", err);
  }
}

function saveSettings(settings: WorkspaceTrustSettings): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.debug("[WorkspaceTrust] Settings save failed:", err);
  }
}

// ============================================================================
// Context
// ============================================================================

const WorkspaceTrustContext = createContext<WorkspaceTrustContextValue>();

export function WorkspaceTrustProvider(props: ParentProps) {
  // Load initial data
  const initialData = loadStoredTrustData();
  const initialSettings = loadStoredSettings();

  // State signals
  const [currentWorkspace, setCurrentWorkspace] = createSignal<string | null>(null);
  const [trustedFolders, setTrustedFolders] = createSignal<TrustedFolder[]>(
    initialData.trustedFolders
  );
  const [trustDecisions, setTrustDecisions] = createSignal<TrustDecision[]>(
    initialData.trustDecisions
  );
  const [settings, setSettings] = createSignal<WorkspaceTrustSettings>(initialSettings);
  const [bannerDismissed, setBannerDismissed] = createSignal(false);

  // Check if a path is trusted
  const isPathTrusted = (path: string): boolean => {
    if (!path) return false;

    const currentSettings = settings();

    // If trust feature is disabled or trust all is enabled, everything is trusted
    if (!currentSettings.enabled || currentSettings.trustAllWorkspaces) {
      return true;
    }

    const normalizedPath = normalizePath(path);

    // Check trusted folders
    for (const folder of trustedFolders()) {
      const normalizedFolderPath = normalizePath(folder.path);

      // Direct match
      if (normalizedPath === normalizedFolderPath) {
        return true;
      }

      // Check if path is under a trusted folder
      if (isSubPath(normalizedFolderPath, normalizedPath)) {
        return true;
      }

      // Check parent trust
      if (folder.trustParent && isSubPath(normalizedPath, normalizedFolderPath)) {
        return true;
      }
    }

    // Check trust decisions
    const decision = trustDecisions().find(
      (d) => normalizePath(d.workspacePath) === normalizedPath
    );
    if (decision && decision.remember) {
      return decision.trustLevel === "trusted";
    }

    return false;
  };

  // Derived state
  const isTrusted = createMemo(() => {
    const workspace = currentWorkspace();
    if (!workspace) return true; // No workspace = nothing to restrict
    return isPathTrusted(workspace);
  });

  const trustLevel = createMemo((): TrustLevel => {
    const workspace = currentWorkspace();
    if (!workspace) return "unknown";

    if (!settings().enabled || settings().trustAllWorkspaces) {
      return "trusted";
    }

    if (isPathTrusted(workspace)) {
      return "trusted";
    }

    // Check for explicit restriction
    const decision = trustDecisions().find(
      (d) => normalizePath(d.workspacePath) === normalizePath(workspace)
    );
    if (decision && decision.remember && decision.trustLevel === "restricted") {
      return "restricted";
    }

    return "unknown";
  });

  const restrictions = createMemo((): RestrictedModeRestrictions => {
    const currentSettings = settings();

    if (!currentSettings.enabled || !currentSettings.restrictedModeEnabled) {
      return { ...TRUSTED_RESTRICTIONS };
    }

    if (isTrusted()) {
      return { ...TRUSTED_RESTRICTIONS };
    }

    return { ...DEFAULT_RESTRICTIONS };
  });

  const isRestrictedMode = createMemo(() => {
    return !isTrusted() && settings().enabled && settings().restrictedModeEnabled;
  });

  const shouldShowBanner = createMemo(() => {
    const currentSettings = settings();
    const workspace = currentWorkspace();

    if (!currentSettings.enabled) return false;
    if (!currentSettings.showBanner) return false;
    if (!workspace) return false;
    if (bannerDismissed()) return false;
    if (isTrusted()) return false;

    return true;
  });

  // Actions
  const trustWorkspace = (options?: { trustParent?: boolean; description?: string }): void => {
    const workspace = currentWorkspace();
    if (!workspace) return;

    const normalizedPath = normalizePath(workspace);
    const now = Date.now();

    batch(() => {
      // Add to trusted folders if not already present
      const existingIndex = trustedFolders().findIndex(
        (f) => normalizePath(f.path) === normalizedPath
      );

      if (existingIndex >= 0) {
        // Update existing entry
        setTrustedFolders((prev) =>
          prev.map((f, i) =>
            i === existingIndex
              ? {
                  ...f,
                  trustedAt: now,
                  trustParent: options?.trustParent ?? f.trustParent,
                  description: options?.description ?? f.description,
                }
              : f
          )
        );
      } else {
        // Add new trusted folder
        const newFolder: TrustedFolder = {
          path: workspace,
          trustedAt: now,
          trustParent: options?.trustParent ?? false,
          description: options?.description,
        };
        setTrustedFolders((prev) => [...prev, newFolder]);
      }

      // Record trust decision
      const decisionIndex = trustDecisions().findIndex(
        (d) => normalizePath(d.workspacePath) === normalizedPath
      );

      const newDecision: TrustDecision = {
        workspacePath: workspace,
        trustLevel: "trusted",
        decidedAt: now,
        remember: true,
      };

      if (decisionIndex >= 0) {
        setTrustDecisions((prev) =>
          prev.map((d, i) => (i === decisionIndex ? newDecision : d))
        );
      } else {
        setTrustDecisions((prev) => [...prev, newDecision]);
      }

      // Dismiss banner
      setBannerDismissed(true);
    });

    // Dispatch event for other components
    window.dispatchEvent(
      new CustomEvent("workspace:trust-changed", {
        detail: { path: workspace, trusted: true },
      })
    );
  };

  const restrictWorkspace = (): void => {
    const workspace = currentWorkspace();
    if (!workspace) return;

    const normalizedPath = normalizePath(workspace);
    const now = Date.now();

    batch(() => {
      // Remove from trusted folders
      setTrustedFolders((prev) =>
        prev.filter((f) => normalizePath(f.path) !== normalizedPath)
      );

      // Record restriction decision
      const decisionIndex = trustDecisions().findIndex(
        (d) => normalizePath(d.workspacePath) === normalizedPath
      );

      const newDecision: TrustDecision = {
        workspacePath: workspace,
        trustLevel: "restricted",
        decidedAt: now,
        remember: true,
      };

      if (decisionIndex >= 0) {
        setTrustDecisions((prev) =>
          prev.map((d, i) => (i === decisionIndex ? newDecision : d))
        );
      } else {
        setTrustDecisions((prev) => [...prev, newDecision]);
      }

      // Dismiss banner
      setBannerDismissed(true);
    });

    // Dispatch event
    window.dispatchEvent(
      new CustomEvent("workspace:trust-changed", {
        detail: { path: workspace, trusted: false },
      })
    );
  };

  const addTrustedFolder = (
    path: string,
    options?: { trustParent?: boolean; description?: string }
  ): void => {
    const normalizedPath = normalizePath(path);
    const now = Date.now();

    const existingIndex = trustedFolders().findIndex(
      (f) => normalizePath(f.path) === normalizedPath
    );

    if (existingIndex >= 0) {
      // Update existing
      setTrustedFolders((prev) =>
        prev.map((f, i) =>
          i === existingIndex
            ? {
                ...f,
                trustedAt: now,
                trustParent: options?.trustParent ?? f.trustParent,
                description: options?.description ?? f.description,
              }
            : f
        )
      );
    } else {
      const newFolder: TrustedFolder = {
        path,
        trustedAt: now,
        trustParent: options?.trustParent ?? false,
        description: options?.description,
      };
      setTrustedFolders((prev) => [...prev, newFolder]);
    }

    // Dispatch event
    window.dispatchEvent(
      new CustomEvent("workspace:trusted-folder-added", {
        detail: { path },
      })
    );
  };

  const removeTrustedFolder = (path: string): void => {
    const normalizedPath = normalizePath(path);

    setTrustedFolders((prev) =>
      prev.filter((f) => normalizePath(f.path) !== normalizedPath)
    );

    // Also remove any trust decisions for this path
    setTrustDecisions((prev) =>
      prev.filter((d) => normalizePath(d.workspacePath) !== normalizedPath)
    );

    // Dispatch event
    window.dispatchEvent(
      new CustomEvent("workspace:trusted-folder-removed", {
        detail: { path },
      })
    );
  };

  const updateSettings = (updates: Partial<WorkspaceTrustSettings>): void => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const dismissBanner = (): void => {
    setBannerDismissed(true);
  };

  const resetBannerDismissed = (): void => {
    setBannerDismissed(false);
  };

  const clearAllTrustDecisions = (): void => {
    batch(() => {
      setTrustedFolders([]);
      setTrustDecisions([]);
    });

    // Dispatch event
    window.dispatchEvent(new CustomEvent("workspace:trust-cleared"));
  };

  const getTrustDecision = (path: string): TrustDecision | undefined => {
    const normalizedPath = normalizePath(path);
    return trustDecisions().find(
      (d) => normalizePath(d.workspacePath) === normalizedPath
    );
  };

  const isActionAllowed = (action: keyof RestrictedModeRestrictions): boolean => {
    const currentRestrictions = restrictions();
    return !currentRestrictions[action];
  };

  // Persist changes
  createEffect(() => {
    saveTrustData(trustedFolders(), trustDecisions());
  });

  createEffect(() => {
    saveSettings(settings());
  });

  // Listen for workspace changes from WorkspaceContext
  onMount(() => {
    const handleWorkspaceLoaded = (event: CustomEvent<{ filePath?: string }>) => {
      if (event.detail?.filePath) {
        const parentPath = getParentPath(event.detail.filePath);
        if (parentPath) {
          setCurrentWorkspace(parentPath);
          setBannerDismissed(false);
        }
      }
    };

    const handleFolderAdded = (event: CustomEvent<{ path: string }>) => {
      if (event.detail?.path && !currentWorkspace()) {
        setCurrentWorkspace(event.detail.path);
        setBannerDismissed(false);
      }
    };

    const handleWorkspaceClosed = () => {
      setCurrentWorkspace(null);
      setBannerDismissed(false);
    };

    window.addEventListener("workspace:loaded", handleWorkspaceLoaded as EventListener);
    window.addEventListener("workspace:folder-added", handleFolderAdded as EventListener);
    window.addEventListener("workspace:closed", handleWorkspaceClosed);

    // Check for existing workspace in localStorage
    const storedProject = getProjectPath();
    if (storedProject) {
      setCurrentWorkspace(storedProject);
    }

    return () => {
      window.removeEventListener("workspace:loaded", handleWorkspaceLoaded as EventListener);
      window.removeEventListener("workspace:folder-added", handleFolderAdded as EventListener);
      window.removeEventListener("workspace:closed", handleWorkspaceClosed);
    };
  });

  // Build state object for consumers that need full state access
  const state = createMemo((): WorkspaceTrustState => ({
    currentWorkspace: currentWorkspace(),
    isTrusted: isTrusted(),
    trustLevel: trustLevel(),
    trustedFolders: trustedFolders(),
    trustDecisions: trustDecisions(),
    restrictions: restrictions(),
    settings: settings(),
    bannerDismissed: bannerDismissed(),
  }));

  const contextValue: WorkspaceTrustContextValue = {
    get state() {
      return state();
    },
    isTrusted,
    trustLevel,
    trustedFolders,
    restrictions,
    isRestrictedMode,
    shouldShowBanner,
    settings,
    trustWorkspace,
    restrictWorkspace,
    addTrustedFolder,
    removeTrustedFolder,
    isPathTrusted,
    setCurrentWorkspace,
    updateSettings,
    dismissBanner,
    resetBannerDismissed,
    clearAllTrustDecisions,
    getTrustDecision,
    isActionAllowed,
  };

  return (
    <WorkspaceTrustContext.Provider value={contextValue}>
      {props.children}
    </WorkspaceTrustContext.Provider>
  );
}

export function useWorkspaceTrust(): WorkspaceTrustContextValue {
  const ctx = useContext(WorkspaceTrustContext);
  if (!ctx) {
    throw new Error("useWorkspaceTrust must be used within WorkspaceTrustProvider");
  }
  return ctx;
}

// ============================================================================
// Utility Hooks
// ============================================================================

/** Hook to check if a specific action is allowed */
export function useIsActionAllowed(action: keyof RestrictedModeRestrictions): Accessor<boolean> {
  const { restrictions } = useWorkspaceTrust();
  return createMemo(() => !restrictions()[action]);
}

/** Hook to get formatted trust status */
export function useTrustStatus(): Accessor<{
  label: string;
  description: string;
  color: string;
}> {
  const { trustLevel } = useWorkspaceTrust();

  return createMemo(() => {
    const level = trustLevel();

    if (level === "trusted") {
      return {
        label: "Trusted",
        description: "This workspace is trusted. All features are enabled.",
        color: "#22c55e", // green
      };
    }

    if (level === "restricted") {
      return {
        label: "Restricted",
        description: "This workspace is restricted. Some features are disabled for security.",
        color: "#f59e0b", // amber
      };
    }

    return {
      label: "Not Trusted",
      description: "Trust this workspace to enable all features.",
      color: "#ef4444", // red
    };
  });
}

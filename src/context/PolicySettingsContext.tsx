/**
 * =============================================================================
 * POLICY SETTINGS CONTEXT - Enterprise Policy-Locked Settings
 * =============================================================================
 * 
 * Provides support for enterprise policy-locked settings that can be managed
 * by IT administrators through system-level configuration.
 * 
 * Policy sources by platform:
 * - Windows: Registry HKLM\Software\Policies\Orion
 * - macOS: /Library/Managed Preferences/com.orion.desktop.plist
 * - Linux: /etc/orion/policies.json
 * 
 * Policy-controlled settings are read-only and display a lock indicator.
 * =============================================================================
 */

import {
  createContext,
  useContext,
  ParentProps,
  createMemo,
  onMount,
  onCleanup,
  Accessor,
  batch,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { platform } from "@tauri-apps/plugin-os";

// ============================================================================
// Type Definitions
// ============================================================================

/** Source of the policy - machine-level or organization (via MDM) */
export type PolicySource = "machine" | "organization";

/** Individual policy setting entry */
export interface PolicySetting {
  /** Setting path (e.g., "update.mode", "security.telemetryEnabled") */
  key: string;
  /** Enforced value for this setting */
  value: unknown;
  /** Source of the policy */
  source: PolicySource;
  /** Human-readable name of the policy */
  name?: string;
  /** Description of what the policy controls */
  description?: string;
  /** When the policy was last updated */
  lastUpdated?: number;
}

/** Policy metadata from the system */
export interface PolicyMetadata {
  /** Version of the policy schema */
  version: number;
  /** Organization name (if provided) */
  organizationName?: string;
  /** Contact for policy issues */
  adminContact?: string;
  /** Last refresh timestamp */
  lastRefreshed: number;
  /** Policy source location */
  sourceLocation?: string;
}

/** Policy state */
export interface PolicySettingsState {
  /** All loaded policies */
  policies: PolicySetting[];
  /** Policy metadata */
  metadata: PolicyMetadata | null;
  /** Whether policies are loaded */
  loaded: boolean;
  /** Whether policies are currently loading */
  loading: boolean;
  /** Error message if policy loading failed */
  error: string | null;
  /** Platform-specific policy source */
  policySource: string | null;
}

/** Context value interface */
export interface PolicySettingsContextValue {
  /** Current policy state */
  state: PolicySettingsState;
  /** All loaded policies */
  policies: Accessor<PolicySetting[]>;
  /** Policy metadata */
  metadata: Accessor<PolicyMetadata | null>;
  /** Whether policies are loaded */
  isLoaded: Accessor<boolean>;
  /** Whether policies are loading */
  isLoading: Accessor<boolean>;
  /** Error if any */
  error: Accessor<string | null>;
  
  /** Check if a setting is controlled by policy */
  isPolicyControlled: (settingKey: string) => boolean;
  /** Get the policy value for a setting (if controlled) */
  getPolicyValue: (settingKey: string) => unknown | undefined;
  /** Get the full policy setting object */
  getPolicy: (settingKey: string) => PolicySetting | undefined;
  /** Get the policy source for a setting */
  getPolicySource: (settingKey: string) => PolicySource | undefined;
  /** Get description for why a setting is policy-controlled */
  getPolicyDescription: (settingKey: string) => string;
  /** Get all policy-controlled setting keys */
  getPolicyControlledKeys: () => string[];
  
  /** Load/reload policies from system */
  loadPolicies: () => Promise<void>;
  /** Refresh policies */
  refreshPolicies: () => Promise<void>;
  /** Check if policy refresh is available */
  canRefreshPolicies: () => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const POLICY_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = "cortex_policies_cache";

/** Default empty state */
const DEFAULT_STATE: PolicySettingsState = {
  policies: [],
  metadata: null,
  loaded: false,
  loading: false,
  error: null,
  policySource: null,
};

/** Common policy keys that enterprises might control */
export const KNOWN_POLICY_KEYS = [
  // Update policies
  "update.mode",
  "update.channel",
  "update.autoDownload",
  "update.allowPrerelease",
  
  // Security policies
  "security.telemetryEnabled",
  "security.crashReportsEnabled",
  "security.networkAccess",
  "security.sandboxMode",
  "security.approvalMode",
  
  // Terminal policies
  "terminal.integrated.shell.windows",
  "terminal.integrated.shell.linux",
  "terminal.integrated.shell.osx",
  "terminal.integrated.env.*",
  "terminal.integrated.allowChords",
  
  // Editor policies
  "editor.formatOnSave",
  "editor.formatOnPaste",
  
  // AI/Copilot policies
  "ai.copilotEnabled",
  "ai.supermavenEnabled",
  "ai.inlineSuggestEnabled",
  "ai.defaultProvider",
  
  // Git policies
  "git.enabled",
  "git.autofetch",
  "git.autoRepositoryDetection",
  
  // Extension policies
  "extensions.autoUpdate",
  "extensions.allowedPublishers",
  "extensions.blockedExtensions",
  
  // Workspace trust policies
  "workspaceTrust.enabled",
  "workspaceTrust.trustAllWorkspaces",
  
  // Task policies
  "task.allowAutomaticTasks",
  
  // HTTP policies
  "http.proxy",
  "http.proxyStrictSSL",
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the policy source location based on platform
 */
function getPolicySourceLocation(platformName: string): string {
  switch (platformName) {
    case "windows":
      return "HKLM\\Software\\Policies\\Orion";
    case "macos":
      return "/Library/Managed Preferences/com.orion.desktop.plist";
    case "linux":
      return "/etc/orion/policies.json";
    default:
      return "Unknown";
  }
}

/**
 * Normalize a setting key for comparison
 */
function normalizeSettingKey(key: string): string {
  return key.toLowerCase().trim();
}

/**
 * Check if a key matches a pattern (supports wildcards)
 */
function matchesPattern(key: string, pattern: string): boolean {
  // Simple wildcard support
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return key.startsWith(prefix);
  }
  return normalizeSettingKey(key) === normalizeSettingKey(pattern);
}

/**
 * Load cached policies from localStorage
 */
function loadCachedPolicies(): { policies: PolicySetting[]; metadata: PolicyMetadata | null } {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // Only use cache if less than 1 hour old
      if (data.metadata?.lastRefreshed && Date.now() - data.metadata.lastRefreshed < 3600000) {
        return {
          policies: data.policies || [],
          metadata: data.metadata || null,
        };
      }
    }
  } catch (err) {
    console.debug("[PolicySettings] Cache load failed:", err);
  }
  return { policies: [], metadata: null };
}

/**
 * Save policies to cache
 */
function cachePolicies(policies: PolicySetting[], metadata: PolicyMetadata | null): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ policies, metadata }));
  } catch (err) {
    console.debug("[PolicySettings] Cache save failed:", err);
  }
}

// ============================================================================
// Context
// ============================================================================

const PolicySettingsContext = createContext<PolicySettingsContextValue>();

// ============================================================================
// Provider Component
// ============================================================================

export function PolicySettingsProvider(props: ParentProps) {
  const [state, setState] = createStore<PolicySettingsState>(DEFAULT_STATE);
  let refreshIntervalId: number | null = null;

  // Accessors
  const policies = () => state.policies;
  const metadata = () => state.metadata;
  const isLoaded = () => state.loaded;
  const isLoading = () => state.loading;
  const error = () => state.error;

  /**
   * Check if a setting is controlled by policy
   */
  const isPolicyControlled = (settingKey: string): boolean => {
    return state.policies.some((p) => matchesPattern(settingKey, p.key));
  };

  /**
   * Get the policy value for a setting
   */
  const getPolicyValue = (settingKey: string): unknown | undefined => {
    const policy = state.policies.find((p) => matchesPattern(settingKey, p.key));
    return policy?.value;
  };

  /**
   * Get the full policy setting object
   */
  const getPolicy = (settingKey: string): PolicySetting | undefined => {
    return state.policies.find((p) => matchesPattern(settingKey, p.key));
  };

  /**
   * Get the policy source for a setting
   */
  const getPolicySource = (settingKey: string): PolicySource | undefined => {
    const policy = state.policies.find((p) => matchesPattern(settingKey, p.key));
    return policy?.source;
  };

  /**
   * Get description for why a setting is policy-controlled
   */
  const getPolicyDescription = (settingKey: string): string => {
    const policy = getPolicy(settingKey);
    if (!policy) return "";

    const orgName = state.metadata?.organizationName;
    const source = policy.source === "organization" ? orgName || "your organization" : "system administrator";

    if (policy.description) {
      return `${policy.description} (Managed by ${source})`;
    }

    return `This setting is managed by ${source}.`;
  };

  /**
   * Get all policy-controlled setting keys
   */
  const getPolicyControlledKeys = (): string[] => {
    return state.policies.map((p) => p.key);
  };

  /**
   * Check if policy refresh is available
   */
  const canRefreshPolicies = (): boolean => {
    return !state.loading;
  };

  /**
   * Load policies from system
   */
  const loadPolicies = async (): Promise<void> => {
    if (state.loading) return;

    setState("loading", true);
    setState("error", null);

    try {
      // Get current platform
      const platformName = platform();
      const policySource = getPolicySourceLocation(platformName);
      setState("policySource", policySource);

      // Try to load from Tauri backend
      let policies: PolicySetting[] = [];
      let policyMetadata: PolicyMetadata | null = null;

      try {
        // Invoke Tauri command to read policies
        const result = await invoke<{
          policies: PolicySetting[];
          metadata: PolicyMetadata | null;
        }>("policy_settings_load");

        policies = result.policies || [];
        policyMetadata = result.metadata
          ? { ...result.metadata, lastRefreshed: Date.now(), sourceLocation: policySource }
          : null;
      } catch (e) {
        // If Tauri command fails, try loading from cache
        console.warn("[PolicySettings] Failed to load from system, using cache:", e);
        const cached = loadCachedPolicies();
        policies = cached.policies;
        policyMetadata = cached.metadata;
      }

      // Update state
      batch(() => {
        setState("policies", reconcile(policies));
        setState("metadata", policyMetadata);
        setState("loaded", true);
      });

      // Cache the policies
      if (policies.length > 0) {
        cachePolicies(policies, policyMetadata);
      }

      // Dispatch event for other contexts
      window.dispatchEvent(
        new CustomEvent("policy:loaded", {
          detail: { count: policies.length },
        })
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      console.error("[PolicySettings] Error loading policies:", e);
    } finally {
      setState("loading", false);
    }
  };

  /**
   * Refresh policies
   */
  const refreshPolicies = async (): Promise<void> => {
    await loadPolicies();
  };

  /**
   * Start periodic policy refresh
   */
  const startPeriodicRefresh = (): void => {
    stopPeriodicRefresh();
    refreshIntervalId = window.setInterval(() => {
      loadPolicies();
    }, POLICY_REFRESH_INTERVAL);
  };

  /**
   * Stop periodic policy refresh
   */
  const stopPeriodicRefresh = (): void => {
    if (refreshIntervalId !== null) {
      window.clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }
  };

  // Initial load
  onMount(async () => {
    // Load cached policies first for immediate availability
    const cached = loadCachedPolicies();
    if (cached.policies.length > 0) {
      batch(() => {
        setState("policies", reconcile(cached.policies));
        setState("metadata", cached.metadata);
      });
    }

    // Then load fresh policies from system
    await loadPolicies();

    // Start periodic refresh
    startPeriodicRefresh();

    // Listen for system policy change events (if supported)
    let unlistenPolicyChange: UnlistenFn | null = null;
    try {
      unlistenPolicyChange = await listen("policy:changed", () => {
        loadPolicies();
      });
    } catch (err) {
      console.debug("[PolicySettings] Event listener setup failed:", err);
    }

    onCleanup(() => {
      stopPeriodicRefresh();
      unlistenPolicyChange?.();
    });
  });

  // Build context value
  const value: PolicySettingsContextValue = {
    get state() {
      return state;
    },
    policies,
    metadata,
    isLoaded,
    isLoading,
    error,
    isPolicyControlled,
    getPolicyValue,
    getPolicy,
    getPolicySource,
    getPolicyDescription,
    getPolicyControlledKeys,
    loadPolicies,
    refreshPolicies,
    canRefreshPolicies,
  };

  return (
    <PolicySettingsContext.Provider value={value}>
      {props.children}
    </PolicySettingsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function usePolicySettings(): PolicySettingsContextValue {
  const ctx = useContext(PolicySettingsContext);
  if (!ctx) {
    throw new Error("usePolicySettings must be used within PolicySettingsProvider");
  }
  return ctx;
}

// ============================================================================
// Utility Hook: Check if specific setting is policy-controlled
// ============================================================================

export function useIsPolicyControlled(settingKey: string): Accessor<boolean> {
  const { isPolicyControlled } = usePolicySettings();
  return createMemo(() => isPolicyControlled(settingKey));
}

// ============================================================================
// Utility Hook: Get policy value with type safety
// ============================================================================

export function usePolicyValue<T>(settingKey: string, defaultValue: T): Accessor<T> {
  const { getPolicyValue, isPolicyControlled } = usePolicySettings();
  return createMemo(() => {
    if (isPolicyControlled(settingKey)) {
      return getPolicyValue(settingKey) as T;
    }
    return defaultValue;
  });
}

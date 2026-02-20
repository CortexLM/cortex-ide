import {
  createContext,
  useContext,
  ParentProps,
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  Accessor,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspace } from "./WorkspaceContext";
import { useExtensions, Extension } from "./ExtensionsContext";
import { useNotifications } from "./NotificationsContext";

// ============================================================================
// Type Definitions
// ============================================================================

/** VS Code extensions.json format */
export interface ExtensionsJson {
  /** Recommended extensions for this workspace */
  recommendations?: string[];
  /** Extensions that should not be recommended */
  unwantedRecommendations?: string[];
}

/** Recommendation status for an extension */
export interface ExtensionRecommendation {
  /** Extension identifier (e.g., "publisher.extension-name") */
  id: string;
  /** Whether this extension is currently installed */
  isInstalled: boolean;
  /** Whether this extension is enabled (if installed) */
  isEnabled: boolean;
}

// ============================================================================
// Context Definition
// ============================================================================

export interface ExtensionRecommendationsContextValue {
  /** Loading state */
  loading: Accessor<boolean>;
  /** Error state */
  error: Accessor<string | null>;
  /** Recommended extensions from workspace */
  recommendations: Accessor<ExtensionRecommendation[]>;
  /** Unwanted/not recommended extensions */
  unwantedRecommendations: Accessor<string[]>;
  /** Recommended extensions that are not installed */
  uninstalledRecommendations: Accessor<ExtensionRecommendation[]>;
  /** Whether there are uninstalled recommendations */
  hasUninstalledRecommendations: Accessor<boolean>;
  /** Raw extensions.json content */
  extensionsJson: Accessor<ExtensionsJson | null>;
  /** Reload recommendations from workspace */
  reloadRecommendations: () => Promise<void>;
  /** Install a recommended extension by ID */
  installRecommendation: (id: string) => Promise<void>;
  /** Install all uninstalled recommended extensions */
  installAllRecommendations: () => Promise<void>;
  /** Show recommendations in Extensions panel */
  showRecommendations: () => void;
  /** Dismiss the uninstalled recommendations notification */
  dismissNotification: () => void;
  /** Whether the notification has been dismissed for current workspace */
  isNotificationDismissed: Accessor<boolean>;
}

const ExtensionRecommendationsContext = createContext<ExtensionRecommendationsContextValue>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize extension ID to lowercase for comparison
 */
function normalizeExtensionId(id: string): string {
  return id.toLowerCase().trim();
}

/**
 * Check if an extension matches a recommendation ID
 * Handles both full IDs (publisher.name) and short names
 */
function extensionMatchesId(extension: Extension, recommendationId: string): boolean {
  const normalizedRecommendation = normalizeExtensionId(recommendationId);
  const extensionName = normalizeExtensionId(extension.manifest.name);
  const extensionAuthor = extension.manifest.author ? normalizeExtensionId(extension.manifest.author) : "";
  
  // Check full ID match (author.name)
  const fullId = extensionAuthor ? `${extensionAuthor}.${extensionName}` : extensionName;
  if (fullId === normalizedRecommendation) {
    return true;
  }
  
  // Check name-only match (for local extensions without author prefix)
  if (extensionName === normalizedRecommendation) {
    return true;
  }
  
  // Check if recommendation is author.name format and matches
  if (normalizedRecommendation.includes(".")) {
    const parts = normalizedRecommendation.split(".");
    const recName = parts.slice(1).join(".");
    if (extensionName === recName) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Provider Component
// ============================================================================

export function ExtensionRecommendationsProvider(props: ParentProps) {
  const workspace = useWorkspace();
  const extensions = useExtensions();
  const notifications = useNotifications();

  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [extensionsJson, setExtensionsJson] = createSignal<ExtensionsJson | null>(null);
  const [isNotificationDismissed, setIsNotificationDismissed] = createSignal(false);
  const [lastNotifiedWorkspace, setLastNotifiedWorkspace] = createSignal<string | null>(null);

  // Compute recommendations with installation status
  const recommendations = createMemo<ExtensionRecommendation[]>(() => {
    const json = extensionsJson();
    if (!json?.recommendations) {
      return [];
    }

    const installedExtensions = extensions.extensions();
    
    return json.recommendations.map((id) => {
      const matchingExtension = installedExtensions.find((ext) =>
        extensionMatchesId(ext, id)
      );

      return {
        id,
        isInstalled: !!matchingExtension,
        isEnabled: matchingExtension?.enabled ?? false,
      };
    });
  });

  // Get unwanted recommendations
  const unwantedRecommendations = createMemo<string[]>(() => {
    return extensionsJson()?.unwantedRecommendations ?? [];
  });

  // Get uninstalled recommendations
  const uninstalledRecommendations = createMemo<ExtensionRecommendation[]>(() => {
    return recommendations().filter((rec) => !rec.isInstalled);
  });

  // Check if there are uninstalled recommendations
  const hasUninstalledRecommendations = createMemo(() => {
    return uninstalledRecommendations().length > 0;
  });

  /**
   * Load extensions.json from workspace .vscode directory
   */
  const loadExtensionsJson = async (workspacePath: string): Promise<ExtensionsJson | null> => {
    try {
      // Normalize path separators
      const normalizedPath = workspacePath.replace(/\\/g, "/");
      const extensionsJsonPath = `${normalizedPath}/.vscode/extensions.json`;
      
      const content = await invoke<string>("fs_read_file", { path: extensionsJsonPath });
      
      // Parse JSON (handle comments by stripping them)
      const cleanedContent = content
        .split("\n")
        .map((line) => {
          // Remove single-line comments
          const commentIndex = line.indexOf("//");
          if (commentIndex !== -1) {
            // Check if // is inside a string
            const beforeComment = line.substring(0, commentIndex);
            const quoteCount = (beforeComment.match(/"/g) || []).length;
            if (quoteCount % 2 === 0) {
              return line.substring(0, commentIndex);
            }
          }
          return line;
        })
        .join("\n");

      return JSON.parse(cleanedContent) as ExtensionsJson;
    } catch (e) {
      // File not found or parse error - this is expected for workspaces without extensions.json
      return null;
    }
  };

  /**
   * Reload recommendations from workspace
   */
  const reloadRecommendations = async (): Promise<void> => {
    const folders = workspace.folders();
    if (folders.length === 0) {
      setExtensionsJson(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load extensions.json from the first (primary) workspace folder
      const primaryFolder = folders[0];
      const json = await loadExtensionsJson(primaryFolder.path);
      
      // Also try to load from additional workspace folders and merge
      if (folders.length > 1) {
        const allRecommendations = new Set<string>(json?.recommendations ?? []);
        const allUnwanted = new Set<string>(json?.unwantedRecommendations ?? []);

        for (let i = 1; i < folders.length; i++) {
          const folderJson = await loadExtensionsJson(folders[i].path);
          if (folderJson) {
            folderJson.recommendations?.forEach((r) => allRecommendations.add(r));
            folderJson.unwantedRecommendations?.forEach((r) => allUnwanted.add(r));
          }
        }

        // Merge all recommendations
        setExtensionsJson({
          recommendations: Array.from(allRecommendations),
          unwantedRecommendations: Array.from(allUnwanted),
        });
      } else {
        setExtensionsJson(json);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      console.error("[ExtensionRecommendations] Failed to load recommendations:", e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Install a recommended extension by ID
   */
  const installRecommendation = async (id: string): Promise<void> => {
    try {
      // Try to install from marketplace
      await extensions.installFromMarketplace(id);
    } catch (e) {
      console.error(`[ExtensionRecommendations] Failed to install ${id}:`, e);
      throw e;
    }
  };

  /**
   * Install all uninstalled recommended extensions
   */
  const installAllRecommendations = async (): Promise<void> => {
    const uninstalled = uninstalledRecommendations();
    
    for (const rec of uninstalled) {
      try {
        await installRecommendation(rec.id);
      } catch (e) {
        // Continue with next extension even if one fails
        console.error(`[ExtensionRecommendations] Failed to install ${rec.id}:`, e);
      }
    }
  };

  /**
   * Show recommendations in Extensions panel
   */
  const showRecommendations = (): void => {
    window.dispatchEvent(new CustomEvent("extensions:show-recommendations"));
  };

  /**
   * Dismiss the uninstalled recommendations notification
   */
  const dismissNotification = (): void => {
    setIsNotificationDismissed(true);
    const folders = workspace.folders();
    if (folders.length > 0) {
      // Store dismissal state in localStorage with workspace identifier
      const workspaceId = folders.map((f) => f.path).sort().join("|");
      const dismissedWorkspaces = JSON.parse(
        localStorage.getItem("cortex_dismissed_extension_recommendations") || "[]"
      );
      if (!dismissedWorkspaces.includes(workspaceId)) {
        dismissedWorkspaces.push(workspaceId);
        localStorage.setItem(
          "cortex_dismissed_extension_recommendations",
          JSON.stringify(dismissedWorkspaces)
        );
      }
    }
  };

  /**
   * Check if notification was dismissed for current workspace
   */
  const checkDismissedState = (): void => {
    const folders = workspace.folders();
    if (folders.length === 0) {
      setIsNotificationDismissed(false);
      return;
    }

    const workspaceId = folders.map((f) => f.path).sort().join("|");
    const dismissedWorkspaces = JSON.parse(
      localStorage.getItem("cortex_dismissed_extension_recommendations") || "[]"
    );
    setIsNotificationDismissed(dismissedWorkspaces.includes(workspaceId));
  };

  // Reload recommendations when workspace changes
  createEffect(() => {
    const folders = workspace.folders();
    if (folders.length > 0) {
      checkDismissedState();
      reloadRecommendations();
    } else {
      setExtensionsJson(null);
    }
  });

  // Show notification when workspace has uninstalled recommendations
  createEffect(() => {
    const hasUninstalled = hasUninstalledRecommendations();
    const dismissed = isNotificationDismissed();
    const folders = workspace.folders();
    const workspaceId = folders.length > 0 ? folders.map((f) => f.path).sort().join("|") : null;
    const lastNotified = lastNotifiedWorkspace();

    // Only show notification if:
    // 1. There are uninstalled recommendations
    // 2. Notification hasn't been dismissed
    // 3. We haven't already notified for this workspace
    if (hasUninstalled && !dismissed && workspaceId && workspaceId !== lastNotified) {
      const count = uninstalledRecommendations().length;
      setLastNotifiedWorkspace(workspaceId);
      
      notifications.addNotification({
        type: "info",
        title: "Recommended Extensions",
        message: `This workspace has ${count} recommended extension${count === 1 ? "" : "s"} that ${count === 1 ? "is" : "are"} not installed.`,
        priority: "normal",
        actions: [
          { id: "show", label: "Show Recommendations", variant: "primary" },
          { id: "dismiss", label: "Don't Show Again", variant: "secondary" },
        ],
      });
    }
  });

  // Handle notification actions
  onMount(() => {
    const handleNotificationAction = (e: CustomEvent<{
      notificationId: string;
      actionId: string;
      notification: { type: string; title: string };
    }>) => {
      if (e.detail.notification.title === "Recommended Extensions") {
        if (e.detail.actionId === "show") {
          showRecommendations();
        } else if (e.detail.actionId === "dismiss") {
          dismissNotification();
        }
      }
    };

    window.addEventListener("notification:action", handleNotificationAction as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("notification:action", handleNotificationAction as EventListener);
    });
  });

  // Initial load
  onMount(() => {
    if (workspace.folders().length > 0) {
      reloadRecommendations();
    }
  });

  const value: ExtensionRecommendationsContextValue = {
    loading,
    error,
    recommendations,
    unwantedRecommendations,
    uninstalledRecommendations,
    hasUninstalledRecommendations,
    extensionsJson,
    reloadRecommendations,
    installRecommendation,
    installAllRecommendations,
    showRecommendations,
    dismissNotification,
    isNotificationDismissed,
  };

  return (
    <ExtensionRecommendationsContext.Provider value={value}>
      {props.children}
    </ExtensionRecommendationsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useExtensionRecommendations(): ExtensionRecommendationsContextValue {
  const context = useContext(ExtensionRecommendationsContext);
  if (!context) {
    throw new Error(
      "useExtensionRecommendations must be used within an ExtensionRecommendationsProvider"
    );
  }
  return context;
}

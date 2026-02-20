import { Show, createSignal, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useWorkspaceTrust, RestrictedModeRestrictions } from "../context/WorkspaceTrustContext";

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceTrustBannerProps {
  /** Custom class name for the banner container */
  class?: string;
  /** Whether to show the banner in compact mode */
  compact?: boolean;
  /** Callback when trust decision is made */
  onTrustDecision?: (trusted: boolean) => void;
}

// ============================================================================
// Restriction Item Component
// ============================================================================

interface RestrictionItemProps {
  icon: string;
  label: string;
  description: string;
}

function RestrictionItem(props: RestrictionItemProps) {
  return (
    <div class="flex items-start gap-2 text-sm">
      <Icon name={props.icon} class="w-4 h-4 mt-0.5 text-amber-400 flex-shrink-0" />
      <div>
        <span class="text-zinc-200">{props.label}</span>
        <span class="text-zinc-500 ml-1">— {props.description}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Banner Component
// ============================================================================

export function WorkspaceTrustBanner(props: WorkspaceTrustBannerProps) {
  const {
    shouldShowBanner,
    trustWorkspace,
    restrictWorkspace,
    dismissBanner,
    restrictions,
    state,
  } = useWorkspaceTrust();

  const [showDetails, setShowDetails] = createSignal(false);
  const [isProcessing, setIsProcessing] = createSignal(false);

  const workspaceName = createMemo(() => {
    const path = state.currentWorkspace;
    if (!path) return "this workspace";
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || "this workspace";
  });

  const handleTrust = () => {
    setIsProcessing(true);
    try {
      trustWorkspace({ trustParent: false });
      props.onTrustDecision?.(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDontTrust = () => {
    setIsProcessing(true);
    try {
      restrictWorkspace();
      props.onTrustDecision?.(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = () => {
    dismissBanner();
  };

  const activeRestrictions = createMemo(() => {
    const r = restrictions();
    const items: Array<{ key: keyof RestrictedModeRestrictions; label: string; description: string }> = [];

    if (r.taskExecutionDisabled) {
      items.push({
        key: "taskExecutionDisabled",
        label: "Task execution",
        description: "Build tasks and scripts cannot run",
      });
    }
    if (r.debuggingDisabled) {
      items.push({
        key: "debuggingDisabled",
        label: "Debugging",
        description: "Debug sessions cannot be started",
      });
    }
    if (r.extensionActivationDisabled) {
      items.push({
        key: "extensionActivationDisabled",
        label: "Extensions",
        description: "Workspace extensions won't activate",
      });
    }
    if (r.terminalRestricted) {
      items.push({
        key: "terminalRestricted",
        label: "Terminal",
        description: "Terminal commands are restricted",
      });
    }
    if (r.fileWriteRestricted) {
      items.push({
        key: "fileWriteRestricted",
        label: "File operations",
        description: "Write access is limited",
      });
    }

    return items;
  });

  return (
    <Show when={shouldShowBanner()}>
      <div
        class={`
          bg-gradient-to-r from-amber-950/80 to-amber-900/60 
          border-b border-amber-700/50 
          ${props.class || ""}
        `}
        role="alert"
        aria-live="polite"
      >
        {/* Compact Mode */}
        <Show when={props.compact}>
          <div class="flex items-center justify-between px-4 py-2">
            <div class="flex items-center gap-2">
              <Icon name="lock" class="w-4 h-4 text-amber-400" />
              <span class="text-sm text-zinc-200">
                Restricted Mode — Some features are disabled
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTrust}
                disabled={isProcessing()}
                class="
                  px-3 py-1 text-xs font-medium rounded
                  bg-amber-600 hover:bg-amber-500
                  text-white
                  transition-colors
                  disabled:opacity-50
                "
              >
                Trust
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                class="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                aria-label="Dismiss"
              >
                <Icon name="xmark" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </Show>

        {/* Full Mode */}
        <Show when={!props.compact}>
          <div class="px-4 py-3">
            {/* Header */}
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="p-2 bg-amber-800/50 rounded-lg">
<Icon name="lock" class="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 class="text-base font-semibold text-zinc-100">
                    Do you trust the authors of this workspace?
                  </h3>
                  <p class="text-sm text-zinc-400 mt-1">
                    <span class="text-amber-300 font-medium">{workspaceName()}</span> contains code that may execute automatically.
                    Only trust workspaces from sources you trust.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                class="p-1 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
                aria-label="Dismiss banner"
              >
                <Icon name="xmark" class="w-5 h-5" />
              </button>
            </div>

            {/* Restrictions Summary */}
            <Show when={activeRestrictions().length > 0}>
              <div class="mt-3 ml-11">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails())}
                  class="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <Icon name="circle-info" class="w-4 h-4" />
                  <span>
                    {showDetails() ? "Hide" : "Show"} restricted features ({activeRestrictions().length})
                  </span>
                </button>

                <Show when={showDetails()}>
                  <div class="mt-2 p-3 bg-black/30 rounded-lg space-y-2">
{activeRestrictions().map((item) => (
                      <RestrictionItem
                        icon="triangle-exclamation"
                        label={item.label}
                        description={item.description}
                      />
                    ))}
                  </div>
                </Show>
              </div>
            </Show>

            {/* Actions */}
            <div class="flex items-center gap-3 mt-4 ml-11">
              <button
                type="button"
                onClick={handleTrust}
                disabled={isProcessing()}
                class="
                  flex items-center gap-2 px-4 py-2
                  bg-indigo-600 hover:bg-indigo-500
                  text-white text-sm font-medium
                  rounded-lg transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
<Icon name="shield" class="w-4 h-4" />
                Trust Workspace
              </button>

              <button
                type="button"
                onClick={handleDontTrust}
                disabled={isProcessing()}
                class="
                  flex items-center gap-2 px-4 py-2
                  bg-zinc-700 hover:bg-zinc-600
                  text-zinc-200 text-sm font-medium
                  rounded-lg transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <Icon name="lock" class="w-4 h-4" />
                Don't Trust
              </button>

              <span class="text-xs text-zinc-500">
                You can change this later in workspace settings
              </span>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// ============================================================================
// Inline Trust Badge (for status bar or headers)
// ============================================================================

export interface TrustBadgeProps {
  /** Size variant */
  size?: "sm" | "md";
  /** Whether to show label text */
  showLabel?: boolean;
  /** Click handler to open trust settings */
  onClick?: () => void;
}

export function TrustBadge(props: TrustBadgeProps) {
  const { isTrusted, trustLevel } = useWorkspaceTrust();

const badgeConfig = createMemo(() => {
    const level = trustLevel();
    const trusted = isTrusted();

    if (trusted) {
      return {
        icon: "shield",
        label: "Trusted",
        bgClass: "bg-green-900/50",
        textClass: "text-green-400",
        borderClass: "border-green-700/50",
      };
    }

    if (level === "restricted") {
      return {
        icon: "lock",
        label: "Restricted",
        bgClass: "bg-amber-900/50",
        textClass: "text-amber-400",
        borderClass: "border-amber-700/50",
      };
    }

    return {
      icon: "lock",
      label: "Not Trusted",
      bgClass: "bg-red-900/50",
      textClass: "text-red-400",
      borderClass: "border-red-700/50",
    };
  });

  const sizeClasses = createMemo(() => {
    const size = props.size || "sm";
    return {
      container: size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
      icon: size === "sm" ? "w-3 h-3" : "w-4 h-4",
    };
  });

  const handleClick = () => {
    props.onClick?.();
  };

  const config = badgeConfig();
  const sizes = sizeClasses();

  return (
    <button
      type="button"
      onClick={handleClick}
      class={`
        inline-flex items-center gap-1.5
        ${sizes.container}
        ${config.bgClass}
        ${config.textClass}
        border ${config.borderClass}
        rounded-full
        transition-all
        hover:opacity-80
        cursor-pointer
      `}
      title={`Workspace trust: ${config.label}`}
    >
      <Icon name={config.icon} class={sizes.icon} />
      <Show when={props.showLabel !== false}>
        <span>{config.label}</span>
      </Show>
    </button>
  );
}

// ============================================================================
// Restricted Mode Indicator (minimal inline indicator)
// ============================================================================

export interface RestrictedModeIndicatorProps {
  /** Custom class */
  class?: string;
}

export function RestrictedModeIndicator(props: RestrictedModeIndicatorProps) {
  const { isRestrictedMode } = useWorkspaceTrust();

  return (
    <Show when={isRestrictedMode()}>
      <div
        class={`
          flex items-center gap-1.5 px-2 py-1
          bg-amber-900/30 border border-amber-700/30
          rounded text-xs text-amber-400
          ${props.class || ""}
        `}
        title="Workspace is in Restricted Mode"
      >
        <Icon name="lock" class="w-3 h-3" />
        <span>Restricted Mode</span>
      </div>
    </Show>
  );
}

// ============================================================================
// Action Blocked Dialog
// ============================================================================

export interface ActionBlockedDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** The action that was blocked */
  action: string;
  /** Optional custom message */
  message?: string;
  /** Whether to show trust button */
  showTrustButton?: boolean;
}

export function ActionBlockedDialog(props: ActionBlockedDialogProps) {
  const { trustWorkspace } = useWorkspaceTrust();

  const handleTrust = () => {
    trustWorkspace();
    props.onClose();
  };

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={props.onClose}
      >
        <div
          class="
            bg-zinc-900 border border-zinc-700
            rounded-xl shadow-2xl
            max-w-md w-full mx-4
            overflow-hidden
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center gap-3 p-4 border-b border-zinc-700 bg-amber-950/30">
<div class="p-2 bg-amber-800/50 rounded-lg">
              <Icon name="lock" class="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-zinc-100">
                Action Blocked
              </h2>
              <p class="text-sm text-zinc-400">
                Restricted Mode is active
              </p>
            </div>
          </div>

          {/* Content */}
          <div class="p-4">
            <p class="text-zinc-300">
              {props.message || (
                <>
                  <span class="font-medium text-amber-300">{props.action}</span>{" "}
                  is not available in Restricted Mode. Trust this workspace to enable all features.
                </>
              )}
            </p>
          </div>

          {/* Actions */}
          <div class="flex items-center justify-end gap-3 p-4 border-t border-zinc-700 bg-zinc-900/50">
            <button
              type="button"
              onClick={props.onClose}
              class="
                px-4 py-2 text-sm font-medium
                text-zinc-300 hover:text-white
                transition-colors
              "
            >
              Cancel
            </button>
            <Show when={props.showTrustButton !== false}>
              <button
                type="button"
                onClick={handleTrust}
                class="
                  flex items-center gap-2 px-4 py-2
                  bg-indigo-600 hover:bg-indigo-500
                  text-white text-sm font-medium
                  rounded-lg transition-colors
                "
              >
<Icon name="shield" class="w-4 h-4" />
                Trust Workspace
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Hook for blocking actions
// ============================================================================

export function useBlockedAction() {
  const [blockedAction, setBlockedAction] = createSignal<{
    action: string;
    message?: string;
  } | null>(null);

  const blockAction = (action: string, message?: string) => {
    setBlockedAction({ action, message });
  };

  const clearBlockedAction = () => {
    setBlockedAction(null);
  };

  return {
    blockedAction,
    blockAction,
    clearBlockedAction,
    isBlocked: () => blockedAction() !== null,
  };
}

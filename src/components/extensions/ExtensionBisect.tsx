/**
 * Extension Bisect - Find problematic extensions via binary search
 * 
 * Like VS Code's "Help > Start Extension Bisect":
 * 1. Disables half of extensions
 * 2. User reports if problem persists
 * 3. Repeat until problematic extension found
 */

import { Component, Show, createSignal, createMemo, createEffect } from "solid-js";
import { useExtensionBisect } from "../../context/ExtensionBisectContext";
import { useExtensions } from "../../context/ExtensionsContext";
import { tokens } from "@/design-system/tokens";

export interface ExtensionBisectProps {
  /** Callback when bisect completes (found or cancelled) */
  onComplete?: (problematicExtension: string | null) => void;
  /** Callback when bisect is cancelled */
  onCancel?: () => void;
}

export const ExtensionBisect: Component<ExtensionBisectProps> = (props) => {
  const bisect = useExtensionBisect();
  const extensions = useExtensions();
  
  const [isLoading, setIsLoading] = createSignal(false);
  const [showConfirmCancel, setShowConfirmCancel] = createSignal(false);

  const phase = bisect.phase;
  const state = bisect.state;

  // Calculate remaining extensions text
  const remainingText = createMemo(() => {
    const count = bisect.suspectedCount();
    if (count === 0) return "No extensions";
    if (count === 1) return "1 extension remaining";
    return `${count} extensions remaining`;
  });

  // Get the found extension details
  const foundExtensionDetails = createMemo(() => {
    if (!state.foundExtension) return null;
    return extensions.extensions().find(
      e => e.manifest.name === state.foundExtension
    );
  });

  // Handle starting bisect
  const handleStart = async () => {
    setIsLoading(true);
    try {
      await bisect.startBisect();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle problem persists
  const handleProblemPersists = async () => {
    setIsLoading(true);
    try {
      await bisect.reportProblemPersists();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle problem gone
  const handleProblemGone = async () => {
    setIsLoading(true);
    try {
      await bisect.reportProblemGone();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!showConfirmCancel()) {
      setShowConfirmCancel(true);
      setTimeout(() => setShowConfirmCancel(false), 3000);
      return;
    }
    
    setIsLoading(true);
    try {
      await bisect.cancelBisect();
      props.onCancel?.();
    } finally {
      setIsLoading(false);
      setShowConfirmCancel(false);
    }
  };

  // Handle disable problematic extension
  const handleDisable = async () => {
    setIsLoading(true);
    try {
      await bisect.disableProblematicExtension();
      props.onComplete?.(state.foundExtension);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle uninstall problematic extension
  const handleUninstall = async () => {
    setIsLoading(true);
    try {
      await bisect.uninstallProblematicExtension();
      props.onComplete?.(state.foundExtension);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle restore all
  const handleRestoreAll = async () => {
    setIsLoading(true);
    try {
      await bisect.cancelBisect();
      props.onComplete?.(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Notify on completion
  createEffect(() => {
    if (state.completed && state.foundExtension) {
      props.onComplete?.(state.foundExtension);
    }
  });

  // Icons
  const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );

  const CheckIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );

  const XIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );

  const AlertIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );

  const ExtensionIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );

  const LoadingSpinner = () => (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    </svg>
  );

  return (
    <div
      class="extension-bisect"
      style={{
        display: "flex",
        "flex-direction": "column",
        "background-color": tokens.colors.surface.base,
        "border-radius": tokens.radius.lg,
        border: `1px solid ${tokens.colors.border.default}`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "12px",
          padding: "16px",
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "background-color": tokens.colors.surface.elevated,
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            "border-radius": tokens.radius.md,
            "background-color": phase() === "found" 
              ? tokens.colors.semantic.warning 
              : tokens.colors.semantic.primary,
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            color: "var(--cortex-text-primary)",
            transition: "background-color 0.2s ease",
          }}
        >
          <Show when={phase() === "found"} fallback={<SearchIcon />}>
            <AlertIcon />
          </Show>
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              "font-size": "14px",
              "font-weight": 600,
              color: tokens.colors.text.primary,
            }}
          >
            Extension Bisect
          </h3>
          <p
            style={{
              margin: "2px 0 0 0",
              "font-size": "12px",
              color: tokens.colors.text.muted,
            }}
          >
            <Show when={phase() === "idle"}>
              Find problematic extensions using binary search
            </Show>
            <Show when={phase() === "starting"}>
              Preparing to test extensions...
            </Show>
            <Show when={phase() === "testing"}>
              Step {state.step} of ~{state.totalSteps} - {remainingText()}
            </Show>
            <Show when={phase() === "found"}>
              Problematic extension identified!
            </Show>
            <Show when={phase() === "no-problem"}>
              No problematic extension found
            </Show>
            <Show when={phase() === "cancelled"}>
              Bisect cancelled
            </Show>
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <Show when={state.active && !state.completed}>
        <div
          style={{
            height: "4px",
            "background-color": tokens.colors.surface.canvas,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${bisect.progress()}%`,
              "background-color": tokens.colors.semantic.primary,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </Show>

      {/* Content */}
      <div style={{ padding: "16px" }}>
        {/* Idle State - Start Screen */}
        <Show when={phase() === "idle"}>
          <div style={{ "text-align": "center", padding: "8px 0" }}>
            <p
              style={{
                "font-size": "13px",
                color: tokens.colors.text.secondary,
                "line-height": 1.5,
                margin: "0 0 16px 0",
              }}
            >
              This tool helps identify which extension is causing issues by systematically 
              disabling half of your extensions until the problematic one is found.
            </p>
            
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                gap: "8px",
                padding: "12px",
                "background-color": tokens.colors.surface.canvas,
                "border-radius": tokens.radius.md,
                "margin-bottom": "16px",
              }}
            >
              <ExtensionIcon />
              <span style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
                {extensions.enabledExtensions().length} enabled extensions
              </span>
            </div>

            <button
              onClick={handleStart}
              disabled={isLoading() || extensions.enabledExtensions().length === 0}
              style={{
                padding: "10px 24px",
                "border-radius": tokens.radius.md,
                border: "none",
                "background-color": tokens.colors.semantic.primary,
                color: "var(--cortex-text-primary)",
                "font-size": "13px",
                "font-weight": 600,
                cursor: isLoading() ? "not-allowed" : "pointer",
                opacity: isLoading() || extensions.enabledExtensions().length === 0 ? 0.6 : 1,
                display: "flex",
                "align-items": "center",
                gap: "8px",
                margin: "0 auto",
                transition: "opacity 0.2s ease",
              }}
            >
              <Show when={isLoading()} fallback={<SearchIcon />}>
                <LoadingSpinner />
              </Show>
              Start Extension Bisect
            </button>

            <Show when={extensions.enabledExtensions().length === 0}>
              <p
                style={{
                  "font-size": "12px",
                  color: tokens.colors.semantic.warning,
                  "margin-top": "12px",
                }}
              >
                No enabled extensions to test
              </p>
            </Show>
          </div>
        </Show>

        {/* Testing State */}
        <Show when={phase() === "testing"}>
          <div>
            <div
              style={{
                "background-color": tokens.colors.surface.canvas,
                "border-radius": tokens.radius.md,
                padding: "16px",
                "margin-bottom": "16px",
              }}
            >
              <p
                style={{
                  "font-size": "13px",
                  color: tokens.colors.text.primary,
                  margin: "0 0 8px 0",
                  "font-weight": 500,
                }}
              >
                Test your application now
              </p>
              <p
                style={{
                  "font-size": "12px",
                  color: tokens.colors.text.muted,
                  margin: 0,
                  "line-height": 1.5,
                }}
              >
                <strong>{bisect.disabledCount()}</strong> extensions are currently disabled.
                Try to reproduce the issue you were experiencing.
              </p>
            </div>

            <p
              style={{
                "font-size": "13px",
                color: tokens.colors.text.secondary,
                "text-align": "center",
                margin: "0 0 16px 0",
              }}
            >
              Does the problem still occur?
            </p>

            <div
              style={{
                display: "flex",
                gap: "8px",
                "justify-content": "center",
              }}
            >
              <button
                onClick={handleProblemPersists}
                disabled={isLoading()}
                style={{
                  flex: 1,
                  "max-width": "160px",
                  padding: "10px 16px",
                  "border-radius": tokens.radius.md,
                  border: `1px solid ${tokens.colors.semantic.error}`,
                  "background-color": "transparent",
                  color: tokens.colors.semantic.error,
                  "font-size": "13px",
                  "font-weight": 500,
                  cursor: isLoading() ? "not-allowed" : "pointer",
                  opacity: isLoading() ? 0.6 : 1,
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading()) {
                    e.currentTarget.style.backgroundColor = tokens.colors.semantic.error;
                    e.currentTarget.style.color = "#fff";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = tokens.colors.semantic.error;
                }}
              >
                <Show when={isLoading()} fallback={<XIcon />}>
                  <LoadingSpinner />
                </Show>
                Yes, still broken
              </button>

              <button
                onClick={handleProblemGone}
                disabled={isLoading()}
                style={{
                  flex: 1,
                  "max-width": "160px",
                  padding: "10px 16px",
                  "border-radius": tokens.radius.md,
                  border: `1px solid ${tokens.colors.semantic.success}`,
                  "background-color": "transparent",
                  color: tokens.colors.semantic.success,
                  "font-size": "13px",
                  "font-weight": 500,
                  cursor: isLoading() ? "not-allowed" : "pointer",
                  opacity: isLoading() ? 0.6 : 1,
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading()) {
                    e.currentTarget.style.backgroundColor = tokens.colors.semantic.success;
                    e.currentTarget.style.color = "#fff";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = tokens.colors.semantic.success;
                }}
              >
                <Show when={isLoading()} fallback={<CheckIcon />}>
                  <LoadingSpinner />
                </Show>
                No, it's fixed
              </button>
            </div>

            {/* Cancel button */}
            <div style={{ "text-align": "center", "margin-top": "16px" }}>
              <button
                onClick={handleCancel}
                disabled={isLoading()}
                style={{
                  padding: "6px 12px",
                  "border-radius": tokens.radius.sm,
                  border: "none",
                  "background-color": showConfirmCancel() 
                    ? tokens.colors.semantic.error 
                    : "transparent",
                  color: showConfirmCancel() 
                    ? "#fff" 
                    : tokens.colors.text.muted,
                  "font-size": "12px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {showConfirmCancel() ? "Click again to confirm cancel" : "Cancel Bisect"}
              </button>
            </div>
          </div>
        </Show>

        {/* Found State */}
        <Show when={phase() === "found"}>
          <div>
            <div
              style={{
                "background-color": `${tokens.colors.semantic.warning}15`,
                "border": `1px solid ${tokens.colors.semantic.warning}40`,
                "border-radius": tokens.radius.md,
                padding: "16px",
                "margin-bottom": "16px",
              }}
            >
              <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    "border-radius": tokens.radius.md,
                    "background-color": tokens.colors.surface.canvas,
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "center",
                    color: tokens.colors.semantic.warning,
                  }}
                >
                  <ExtensionIcon />
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      "font-size": "14px",
                      "font-weight": 600,
                      color: tokens.colors.text.primary,
                    }}
                  >
                    {state.foundExtension}
                  </p>
                  <Show when={foundExtensionDetails()}>
                    <p
                      style={{
                        margin: "2px 0 0 0",
                        "font-size": "12px",
                        color: tokens.colors.text.muted,
                      }}
                    >
                      v{foundExtensionDetails()!.manifest.version} by {foundExtensionDetails()!.manifest.author}
                    </p>
                  </Show>
                </div>
              </div>
            </div>

            <p
              style={{
                "font-size": "13px",
                color: tokens.colors.text.secondary,
                "text-align": "center",
                margin: "0 0 16px 0",
              }}
            >
              What would you like to do with this extension?
            </p>

            <div
              style={{
                display: "flex",
                "flex-direction": "column",
                gap: "8px",
              }}
            >
              <button
                onClick={handleDisable}
                disabled={isLoading()}
                style={{
                  padding: "10px 16px",
                  "border-radius": tokens.radius.md,
                  border: "none",
                  "background-color": tokens.colors.semantic.primary,
                  color: "var(--cortex-text-primary)",
                  "font-size": "13px",
                  "font-weight": 500,
                  cursor: isLoading() ? "not-allowed" : "pointer",
                  opacity: isLoading() ? 0.6 : 1,
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  gap: "8px",
                }}
              >
                <Show when={isLoading()}>
                  <LoadingSpinner />
                </Show>
                Keep Disabled & Restore Others
              </button>

              <button
                onClick={handleUninstall}
                disabled={isLoading()}
                style={{
                  padding: "10px 16px",
                  "border-radius": tokens.radius.md,
                  border: `1px solid ${tokens.colors.semantic.error}`,
                  "background-color": "transparent",
                  color: tokens.colors.semantic.error,
                  "font-size": "13px",
                  "font-weight": 500,
                  cursor: isLoading() ? "not-allowed" : "pointer",
                  opacity: isLoading() ? 0.6 : 1,
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  gap: "8px",
                }}
              >
                <Show when={isLoading()}>
                  <LoadingSpinner />
                </Show>
                Uninstall Extension
              </button>

              <button
                onClick={handleRestoreAll}
                disabled={isLoading()}
                style={{
                  padding: "10px 16px",
                  "border-radius": tokens.radius.md,
                  border: `1px solid ${tokens.colors.border.default}`,
                  "background-color": "transparent",
                  color: tokens.colors.text.secondary,
                  "font-size": "13px",
                  cursor: isLoading() ? "not-allowed" : "pointer",
                  opacity: isLoading() ? 0.6 : 1,
                }}
              >
                Restore All & Close
              </button>
            </div>
          </div>
        </Show>

        {/* No Problem Found State */}
        <Show when={phase() === "no-problem"}>
          <div style={{ "text-align": "center", padding: "8px 0" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                "border-radius": "var(--cortex-radius-full)",
                "background-color": `${tokens.colors.semantic.success}20`,
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                color: tokens.colors.semantic.success,
                margin: "0 auto 16px auto",
              }}
            >
              <CheckIcon />
            </div>
            
            <p
              style={{
                "font-size": "14px",
                "font-weight": 500,
                color: tokens.colors.text.primary,
                margin: "0 0 8px 0",
              }}
            >
              No problematic extension found
            </p>
            <p
              style={{
                "font-size": "13px",
                color: tokens.colors.text.muted,
                margin: "0 0 16px 0",
              }}
            >
              The issue may be caused by something else.
            </p>

            <button
              onClick={handleRestoreAll}
              disabled={isLoading()}
              style={{
                padding: "10px 24px",
                "border-radius": tokens.radius.md,
                border: "none",
                "background-color": tokens.colors.semantic.primary,
                color: "var(--cortex-text-primary)",
                "font-size": "13px",
                "font-weight": 500,
                cursor: isLoading() ? "not-allowed" : "pointer",
                opacity: isLoading() ? 0.6 : 1,
              }}
            >
              Restore All Extensions
            </button>
          </div>
        </Show>
      </div>

      {/* Footer with stats (when active) */}
      <Show when={state.active && !state.completed}>
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            padding: "12px 16px",
            "border-top": `1px solid ${tokens.colors.border.divider}`,
            "background-color": tokens.colors.surface.elevated,
            "font-size": "11px",
            color: tokens.colors.text.muted,
          }}
        >
          <span>Tested: {state.testedExtensions.length}</span>
          <span>Disabled: {bisect.disabledCount()}</span>
          <span>Suspected: {bisect.suspectedCount()}</span>
        </div>
      </Show>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

/**
 * Compact inline bisect status indicator for status bar or headers
 */
export const ExtensionBisectIndicator: Component<{
  onClick?: () => void;
}> = (props) => {
  const bisect = useExtensionBisect();
  const phase = bisect.phase;
  const state = bisect.state;

  // Don't render if not active
  const shouldShow = () => state.active || state.completed;

  return (
    <Show when={shouldShow()}>
      <button
        onClick={props.onClick}
        style={{
          display: "flex",
          "align-items": "center",
          gap: "6px",
          padding: "4px 8px",
          "border-radius": tokens.radius.sm,
          border: "none",
          "background-color": phase() === "found" 
            ? `${tokens.colors.semantic.warning}20`
            : `${tokens.colors.semantic.info}20`,
          color: phase() === "found"
            ? tokens.colors.semantic.warning
            : tokens.colors.semantic.info,
          "font-size": "11px",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <Show when={phase() === "testing"}>
          Bisect: Step {state.step}/{state.totalSteps}
        </Show>
        <Show when={phase() === "found"}>
          Found: {state.foundExtension}
        </Show>
      </button>
    </Show>
  );
};

export default ExtensionBisect;


/**
 * ErrorBoundary - Catches and handles component errors gracefully
 * 
 * Provides isolation for component failures to prevent cascade crashes.
 * Integrates with telemetry for error logging and offers recovery options.
 * 
 * Features:
 * - Catches render errors in child components
 * - Logs errors to telemetry system
 * - Provides retry/recovery options
 * - Optional "report bug" functionality
 * - Customizable fallback UI
 * - Panel-specific error handling
 */

import { 
  ErrorBoundary as SolidErrorBoundary,
  ParentProps, 
  createSignal, 
  Show,
  JSX,
  onCleanup,
} from "solid-js";
import { getTelemetryClient, events } from "@/utils/telemetry";
import { Icon } from "./ui/Icon";

// ============================================================================
// Types
// ============================================================================

export interface ErrorBoundaryProps extends ParentProps {
  /** Name of the component/panel being wrapped (for error reporting) */
  name: string;
  /** Custom fallback component - receives error and reset function */
  fallback?: (err: Error, reset: () => void) => JSX.Element;
  /** Whether to show the "report bug" button */
  showReportBug?: boolean;
  /** Callback when an error occurs */
  onError?: (error: Error, errorInfo: string) => void;
  /** Custom error message to display */
  errorMessage?: string;
  /** Whether to show error details by default */
  showDetailsDefault?: boolean;
  /** Panel variant - affects styling */
  variant?: "panel" | "sidebar" | "dialog" | "full" | "inline";
  /** Optional class name for the fallback container */
  class?: string;
}

export interface PanelErrorBoundaryProps extends ParentProps {
  /** Name of the panel */
  name: string;
  /** Icon component for the panel header */
  icon?: JSX.Element;
  /** Additional class names */
  class?: string;
}

// ============================================================================
// Error Logging Utility
// ============================================================================

/**
 * Logs error to telemetry and console
 */
function logError(
  error: Error,
  componentName: string,
  fatal: boolean = false
): void {
  // Log to console for development
  console.error(`[ErrorBoundary] Error in ${componentName}:`, error);

  // Log to telemetry
  try {
    const client = getTelemetryClient();
    if (client.isEnabled()) {
      client.track(
        events.error({
          errorType: error.name || "Error",
          errorMessage: error.message || "Unknown error",
          component: componentName,
          stack: error.stack,
          fatal,
        })
      );
    }
  } catch (telemetryError) {
    // Don't let telemetry errors break the app
    console.error("[ErrorBoundary] Failed to log error to telemetry:", telemetryError);
  }
}

/**
 * Formats an error for display
 */
function formatErrorForDisplay(error: Error): string {
  const lines: string[] = [];
  
  lines.push(`Error: ${error.name || "Error"}`);
  lines.push(`Message: ${error.message || "Unknown error"}`);
  
  if (error.stack) {
    lines.push("");
    lines.push("Stack trace:");
    lines.push(error.stack);
  }
  
  // Handle error.cause if available (ES2022+)
  const errorWithCause = error as Error & { cause?: unknown };
  if (errorWithCause.cause && errorWithCause.cause instanceof Error) {
    lines.push("");
    lines.push("Caused by:");
    lines.push(formatErrorForDisplay(errorWithCause.cause));
  }
  
  return lines.join("\n");
}

/**
 * Copies text to clipboard with fallback
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
}

// ============================================================================
// Default Fallback Component
// ============================================================================

interface DefaultFallbackProps {
  error: Error;
  reset: () => void;
  componentName: string;
  errorMessage?: string;
  showReportBug?: boolean;
  showDetailsDefault?: boolean;
  variant?: "panel" | "sidebar" | "dialog" | "full" | "inline";
}

function DefaultFallback(props: DefaultFallbackProps) {
  const [showDetails, setShowDetails] = createSignal(props.showDetailsDefault ?? false);
  const [copied, setCopied] = createSignal(false);
  const [isRetrying, setIsRetrying] = createSignal(false);

  const errorText = () => formatErrorForDisplay(props.error);

  // Track timers for cleanup on unmount
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  
  onCleanup(() => {
    if (copyTimer) clearTimeout(copyTimer);
    if (retryTimer) clearTimeout(retryTimer);
  });

  const handleCopy = async () => {
    const success = await copyToClipboard(
      `Component: ${props.componentName}\n\n${errorText()}`
    );
    if (success) {
      setCopied(true);
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRetry = () => {
    setIsRetrying(true);
    // Small delay to show retry state
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      setIsRetrying(false);
      props.reset();
    }, 300);
  };

  const handleReportBug = () => {
    // Open feedback dialog with error details pre-filled
    window.dispatchEvent(
      new CustomEvent("feedback:open", {
        detail: { 
          type: "bug",
          errorInfo: {
            component: props.componentName,
            error: props.error.message,
            stack: props.error.stack,
          }
        },
      })
    );
  };

  // Variant-specific styles
  const containerStyles = (): JSX.CSSProperties => {
    const base: JSX.CSSProperties = {
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      background: "var(--vscode-editor-background, var(--cortex-bg-base, var(--cortex-bg-secondary)))",
      color: "var(--vscode-editor-foreground, var(--cortex-text-base, var(--cortex-text-primary)))",
    };

    switch (props.variant) {
      case "sidebar":
        return {
          ...base,
          height: "100%",
          padding: "16px",
        };
      case "dialog":
        return {
          ...base,
          padding: "24px",
          "border-radius": "var(--cortex-radius-md)",
        };
      case "full":
        return {
          ...base,
          height: "100vh",
          width: "100vw",
          padding: "32px",
        };
      case "inline":
        return {
          ...base,
          padding: "12px",
          "border-radius": "var(--cortex-radius-sm)",
          border: "1px solid var(--vscode-editorError-foreground, var(--cortex-error))",
        };
      case "panel":
      default:
        return {
          ...base,
          flex: "1",
          "min-height": "0",
          padding: "20px",
        };
    }
  };

  return (
    <div 
      class="error-boundary-fallback"
      style={containerStyles()}
      role="alert"
      aria-live="assertive"
    >
      <div 
        class="error-content"
        style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "max-width": "400px",
          "text-align": "center",
        }}
      >
        {/* Error Icon */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: "48px",
            height: "48px",
            "border-radius": "var(--cortex-radius-full)",
            background: "rgba(244, 71, 71, 0.15)",
            "margin-bottom": "16px",
          }}
        >
<Icon 
            name="triangle-exclamation"
            size={24}
            style={{ 
              color: "var(--vscode-editorError-foreground, var(--cortex-error))" 
            }} 
          />
        </div>

        {/* Error Title */}
        <h3
          style={{
            margin: "0 0 8px 0",
            "font-size": "14px",
            "font-weight": "600",
            color: "var(--vscode-editor-foreground, inherit)",
          }}
        >
          {props.errorMessage || `${props.componentName} encountered an error`}
        </h3>

        {/* Error Summary */}
        <p
          style={{
            margin: "0 0 16px 0",
            "font-size": "12px",
            color: "var(--vscode-descriptionForeground, #888)",
            "line-height": "1.5",
          }}
        >
          {props.error.message || "An unexpected error occurred"}
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            "flex-wrap": "wrap",
            "justify-content": "center",
            "margin-bottom": "12px",
          }}
        >
          {/* Retry Button */}
          <button
            onClick={handleRetry}
            disabled={isRetrying()}
            style={{
              display: "flex",
              "align-items": "center",
              gap: "6px",
              padding: "6px 12px",
              background: "var(--vscode-button-background, var(--cortex-info))",
              color: "var(--vscode-button-foreground, #fff)",
              border: "none",
              "border-radius": "var(--cortex-radius-sm)",
              "font-size": "12px",
              cursor: isRetrying() ? "wait" : "pointer",
              opacity: isRetrying() ? "0.7" : "1",
              transition: "opacity 150ms, background 150ms",
            }}
            onMouseEnter={(e) => {
              if (!isRetrying()) {
                e.currentTarget.style.background = "var(--vscode-button-hoverBackground, var(--cortex-info))";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--vscode-button-background, var(--cortex-info))";
            }}
          >
<Icon 
              name="rotate"
              size={14}
              style={{ 
                animation: isRetrying() ? "spin 1s linear infinite" : "none",
              }} 
            />
            {isRetrying() ? "Retrying..." : "Retry"}
          </button>

          {/* Report Bug Button */}
          <Show when={props.showReportBug !== false}>
            <button
              onClick={handleReportBug}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "6px",
                padding: "6px 12px",
                background: "var(--vscode-button-secondaryBackground, var(--cortex-bg-hover))",
                color: "var(--vscode-button-secondaryForeground, var(--cortex-text-primary))",
                border: "none",
                "border-radius": "var(--cortex-radius-sm)",
                "font-size": "12px",
                cursor: "pointer",
                transition: "background 150ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--vscode-button-secondaryHoverBackground, var(--cortex-bg-active))";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--vscode-button-secondaryBackground, var(--cortex-bg-hover))";
              }}
            >
              <Icon name="flag" size={14} />
              Report Bug
            </button>
          </Show>
        </div>

        {/* Show Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails())}
          style={{
            display: "flex",
            "align-items": "center",
            gap: "4px",
            padding: "4px 8px",
            background: "transparent",
            color: "var(--vscode-textLink-foreground, var(--cortex-info))",
            border: "none",
            "font-size": "11px",
            cursor: "pointer",
            opacity: "0.8",
            transition: "opacity 150ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.8";
          }}
        >
{showDetails() ? (
            <>
              <Icon name="chevron-up" size={12} />
              Hide Details
            </>
          ) : (
            <>
              <Icon name="chevron-down" size={12} />
              Show Details
            </>
          )}
        </button>

        {/* Error Details */}
        <Show when={showDetails()}>
          <div
            style={{
              "margin-top": "12px",
              width: "100%",
              "max-width": "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                "justify-content": "flex-end",
                "margin-bottom": "4px",
              }}
            >
              <button
                onClick={handleCopy}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "4px",
                  padding: "2px 6px",
                  background: "transparent",
                  color: "var(--vscode-descriptionForeground, #888)",
                  border: "1px solid var(--vscode-input-border, var(--cortex-bg-hover))",
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "10px",
                  cursor: "pointer",
                  transition: "border-color 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--vscode-focusBorder, var(--cortex-info))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--vscode-input-border, var(--cortex-bg-hover))";
                }}
              >
{copied() ? (
                  <>
                    <Icon name="check" size={10} style={{ color: "var(--cortex-success)" }} />
                    Copied
                  </>
                ) : (
                  <>
                    <Icon name="copy" size={10} />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre
              style={{
                margin: "0",
                padding: "12px",
                background: "var(--vscode-textCodeBlock-background, var(--cortex-bg-primary))",
                border: "1px solid var(--vscode-input-border, var(--cortex-bg-hover))",
                "border-radius": "var(--cortex-radius-sm)",
                "font-size": "10px",
                "font-family": "var(--vscode-editor-font-family, 'Consolas', monospace)",
                "text-align": "left",
                "white-space": "pre-wrap",
                "word-break": "break-word",
                "max-height": "200px",
                overflow: "auto",
                color: "var(--vscode-editor-foreground, var(--cortex-text-primary))",
              }}
            >
              {errorText()}
            </pre>
          </div>
        </Show>
      </div>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Main ErrorBoundary Component
// ============================================================================

/**
 * ErrorBoundary wraps components and catches errors during rendering.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary name="FileExplorer" variant="sidebar">
 *   <FileExplorer />
 * </ErrorBoundary>
 * ```
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  const [key, setKey] = createSignal(0);

  const handleReset = () => {
    // Increment key to force re-mount of children
    setKey(k => k + 1);
  };

  const handleError = (error: Error) => {
    // Log to telemetry
    logError(error, props.name, false);
    
    // Call optional callback
    if (props.onError) {
      props.onError(error, formatErrorForDisplay(error));
    }
  };

  return (
    <SolidErrorBoundary
      fallback={(err, reset) => {
        // Handle the error
        handleError(err);

        // Use custom fallback if provided
        if (props.fallback) {
          return props.fallback(err, () => {
            reset();
            handleReset();
          });
        }

        // Use default fallback
        return (
          <DefaultFallback
            error={err}
            reset={() => {
              reset();
              handleReset();
            }}
            componentName={props.name}
            errorMessage={props.errorMessage}
            showReportBug={props.showReportBug}
            showDetailsDefault={props.showDetailsDefault}
            variant={props.variant}
          />
        );
      }}
    >
      <div
        class={props.class}
        style={{ 
          display: "contents",
        }}
        data-error-boundary={props.name}
        data-error-boundary-key={key()}
      >
        {props.children}
      </div>
    </SolidErrorBoundary>
  );
}

// ============================================================================
// Panel-Specific Error Boundaries
// ============================================================================

/**
 * Pre-configured error boundary for sidebar panels
 */
export function SidebarErrorBoundary(props: PanelErrorBoundaryProps) {
  return (
    <ErrorBoundary
      name={props.name}
      variant="sidebar"
      class={props.class}
      showReportBug={true}
    >
      {props.children}
    </ErrorBoundary>
  );
}

/**
 * Pre-configured error boundary for main editor panels
 */
export function EditorErrorBoundary(props: PanelErrorBoundaryProps) {
  return (
    <ErrorBoundary
      name={props.name}
      variant="panel"
      class={props.class}
      showReportBug={true}
    >
      {props.children}
    </ErrorBoundary>
  );
}

/**
 * Pre-configured error boundary for dialogs/modals
 */
export function DialogErrorBoundary(props: PanelErrorBoundaryProps) {
  return (
    <ErrorBoundary
      name={props.name}
      variant="dialog"
      class={props.class}
      showReportBug={true}
    >
      {props.children}
    </ErrorBoundary>
  );
}

/**
 * Pre-configured error boundary for inline components
 */
export function InlineErrorBoundary(props: PanelErrorBoundaryProps) {
  return (
    <ErrorBoundary
      name={props.name}
      variant="inline"
      class={props.class}
      showReportBug={false}
      showDetailsDefault={false}
    >
      {props.children}
    </ErrorBoundary>
  );
}

// ============================================================================
// Compact Fallback for Small Panels
// ============================================================================

interface CompactFallbackProps {
  error: Error;
  reset: () => void;
  componentName: string;
}

/**
 * Compact fallback UI for smaller panels
 */
export function CompactFallback(props: CompactFallbackProps) {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        padding: "12px",
        height: "100%",
        "min-height": "80px",
        background: "var(--vscode-editor-background, var(--cortex-bg-secondary))",
        color: "var(--vscode-editor-foreground, var(--cortex-text-primary))",
      }}
    >
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          "margin-bottom": "8px",
        }}
      >
<Icon
          name="triangle-exclamation"
          size={16}
          style={{
            color: "var(--vscode-editorError-foreground, var(--cortex-error))",
          }}
        />
        <span style={{ "font-size": "12px" }}>
          {props.componentName} error
        </span>
      </div>
      <button
        onClick={props.reset}
        style={{
          display: "flex",
          "align-items": "center",
          gap: "4px",
          padding: "4px 8px",
          background: "var(--vscode-button-background, var(--cortex-info))",
          color: "var(--vscode-button-foreground, #fff)",
          border: "none",
          "border-radius": "var(--cortex-radius-sm)",
          "font-size": "11px",
          cursor: "pointer",
        }}
      >
        <Icon name="rotate" size={12} />
        Retry
      </button>
    </div>
  );
}

// ============================================================================
// Higher-Order Component for Error Boundaries
// ============================================================================

/**
 * HOC to wrap a component with an error boundary
 * 
 * @example
 * ```tsx
 * const SafeFileExplorer = withErrorBoundary(FileExplorer, "FileExplorer", "sidebar");
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: (props: P) => JSX.Element,
  name: string,
  variant: ErrorBoundaryProps["variant"] = "panel"
): (props: P) => JSX.Element {
  return (props: P) => (
    <ErrorBoundary name={name} variant={variant}>
      <Component {...props} />
    </ErrorBoundary>
  );
}

// ============================================================================
// Export Types
// ============================================================================

export type { DefaultFallbackProps, CompactFallbackProps };


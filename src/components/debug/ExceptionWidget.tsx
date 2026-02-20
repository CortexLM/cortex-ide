/**
 * ExceptionWidget Component
 *
 * Inline widget that displays exception information during debugging.
 * Appears at the line where the exception occurred with:
 * - Exception type and message
 * - Collapsible stack trace
 * - Action buttons (Continue, Break on this exception, Copy)
 * - Close functionality (X button or Escape key)
 */

import {
  Component,
  Show,
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  JSX,
} from "solid-js";
import { useDebug } from "../../context/DebugContext";
import type {
  ExceptionInfo,
  ExceptionDetails,
} from "../../types/debug";

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, JSX.CSSProperties> = {
  container: {
    position: "absolute",
    left: "60px",
    right: "16px",
    "z-index": "100",
    "font-family": "var(--font-family-mono, 'SF Mono', Monaco, 'Cascadia Code', monospace)",
    "font-size": "12px",
    "line-height": "1.4",
  },
  widget: {
    background: "var(--exception-widget-bg, var(--cortex-error-bg))",
    border: "1px solid var(--exception-widget-border, var(--cortex-error))",
    "border-radius": "var(--cortex-radius-sm)",
    "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.4)",
    overflow: "hidden",
    "max-width": "100%",
  },
  header: {
    display: "flex",
    "align-items": "flex-start",
    "justify-content": "space-between",
    padding: "8px 12px",
    background: "var(--exception-widget-header-bg, var(--cortex-error-bg))",
    "border-bottom": "1px solid var(--exception-widget-border, var(--cortex-error))",
    gap: "12px",
  },
  headerContent: {
    flex: "1",
    "min-width": "0",
  },
  exceptionType: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "margin-bottom": "4px",
  },
  exceptionIcon: {
    width: "16px",
    height: "16px",
    color: "var(--exception-icon-color, var(--cortex-error))",
    "flex-shrink": "0",
  },
  typeName: {
    color: "var(--exception-type-color, var(--cortex-error))",
    "font-weight": "600",
    "font-size": "13px",
    "word-break": "break-word",
  },
  breakMode: {
    color: "var(--exception-breakmode-color, var(--cortex-warning))",
    "font-size": "11px",
    "font-weight": "normal",
    "margin-left": "8px",
    opacity: "0.8",
  },
  message: {
    color: "var(--exception-message-color, var(--cortex-error-bg))",
    "word-break": "break-word",
    "white-space": "pre-wrap",
    "max-height": "80px",
    "overflow-y": "auto",
  },
  closeButton: {
    background: "transparent",
    border: "none",
    color: "var(--exception-close-color, var(--cortex-text-primary))",
    cursor: "pointer",
    padding: "4px",
    "border-radius": "var(--cortex-radius-sm)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    opacity: "0.7",
    transition: "opacity 0.15s, background 0.15s",
    "flex-shrink": "0",
  },
  closeButtonHover: {
    opacity: "1",
    background: "rgba(255, 255, 255, 0.1)",
  },
  body: {
    padding: "8px 12px",
  },
  stackTraceToggle: {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    background: "transparent",
    border: "none",
    color: "var(--exception-toggle-color, var(--cortex-syntax-variable))",
    cursor: "pointer",
    padding: "4px 0",
    "font-size": "12px",
    "font-family": "inherit",
  },
  stackTraceToggleIcon: {
    width: "12px",
    height: "12px",
    transition: "transform 0.15s",
  },
  stackTraceToggleIconExpanded: {
    transform: "rotate(90deg)",
  },
  stackTrace: {
    "margin-top": "8px",
    "max-height": "200px",
    "overflow-y": "auto",
    background: "var(--exception-stacktrace-bg, rgba(0, 0, 0, 0.2))",
    "border-radius": "var(--cortex-radius-sm)",
    padding: "8px",
  },
  stackTraceLine: {
    color: "var(--exception-stacktrace-color, var(--cortex-text-primary))",
    "white-space": "pre-wrap",
    "word-break": "break-all",
    "font-size": "11px",
    "line-height": "1.5",
  },
  innerException: {
    "margin-top": "12px",
    "padding-top": "8px",
    "border-top": "1px solid var(--exception-widget-border, var(--cortex-error))",
  },
  innerExceptionLabel: {
    color: "var(--exception-inner-label-color, var(--cortex-warning))",
    "font-size": "11px",
    "margin-bottom": "4px",
  },
  actions: {
    display: "flex",
    gap: "8px",
    padding: "8px 12px",
    "border-top": "1px solid var(--exception-widget-border, var(--cortex-error))",
    background: "var(--exception-actions-bg, rgba(0, 0, 0, 0.15))",
    "flex-wrap": "wrap",
  },
  actionButton: {
    display: "inline-flex",
    "align-items": "center",
    gap: "6px",
    padding: "5px 10px",
    "font-size": "11px",
    "font-family": "inherit",
    "border-radius": "var(--cortex-radius-sm)",
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
  },
  primaryButton: {
    background: "var(--exception-primary-btn-bg, var(--cortex-info))",
    border: "1px solid var(--exception-primary-btn-border, var(--cortex-info))",
    color: "var(--exception-primary-btn-color, var(--cortex-text-primary))",
  },
  primaryButtonHover: {
    background: "var(--exception-primary-btn-hover-bg, var(--cortex-info))",
  },
  secondaryButton: {
    background: "var(--exception-secondary-btn-bg, transparent)",
    border: "1px solid var(--exception-secondary-btn-border, var(--cortex-text-inactive))",
    color: "var(--exception-secondary-btn-color, var(--cortex-text-primary))",
  },
  secondaryButtonHover: {
    background: "var(--exception-secondary-btn-hover-bg, rgba(255, 255, 255, 0.1)",
    "border-color": "var(--exception-secondary-btn-hover-border, var(--cortex-text-inactive))",
  },
  buttonIcon: {
    width: "14px",
    height: "14px",
  },
};

// ============================================================================
// Icons
// ============================================================================

const ExceptionIcon: Component = () => (
  <svg
    style={styles.exceptionIcon}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 1L1 14h14L8 1z"
      stroke="currentColor"
      stroke-width="1.5"
      fill="none"
    />
    <path d="M8 5v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="8" cy="11" r="0.75" fill="currentColor" />
  </svg>
);

const CloseIcon: Component = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z" />
  </svg>
);

const ChevronIcon: Component<{ expanded: boolean }> = (props) => (
  <svg
    style={{
      ...styles.stackTraceToggleIcon,
      ...(props.expanded ? styles.stackTraceToggleIconExpanded : {}),
    }}
    viewBox="0 0 16 16"
    fill="currentColor"
  >
    <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" />
  </svg>
);

const PlayIcon: Component = () => (
  <svg style={styles.buttonIcon} viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.5 2v12l10-6-10-6z" />
  </svg>
);

const BreakpointIcon: Component = () => (
  <svg style={styles.buttonIcon} viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none" />
    <circle cx="8" cy="8" r="3" fill="currentColor" />
  </svg>
);

const CopyIcon: Component = () => (
  <svg style={styles.buttonIcon} viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 4h1V2H2v10h2v-1H3V3h1v1zM6 6v8h8V6H6zm7 7H7V7h6v6z" />
  </svg>
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats the break mode into a human-readable label.
 */
function formatBreakMode(mode: string): string {
  switch (mode) {
    case "never":
      return "";
    case "always":
      return "Break always";
    case "unhandled":
      return "Unhandled";
    case "userUnhandled":
      return "User-unhandled";
    default:
      return mode;
  }
}

/**
 * Gets the display name for an exception.
 */
function getExceptionDisplayName(exception: ExceptionInfo): string {
  if (exception.details?.typeName) {
    return exception.details.typeName;
  }
  if (exception.details?.fullTypeName) {
    // Extract the short name from fully qualified name
    const parts = exception.details.fullTypeName.split(".");
    return parts[parts.length - 1];
  }
  return exception.id || "Exception";
}

/**
 * Gets the exception message.
 */
function getExceptionMessage(exception: ExceptionInfo): string {
  return exception.details?.message || exception.description || "An exception occurred";
}

/**
 * Formats exception details for copying to clipboard.
 */
function formatExceptionForCopy(exception: ExceptionInfo): string {
  const lines: string[] = [];
  
  const typeName = getExceptionDisplayName(exception);
  const message = getExceptionMessage(exception);
  
  lines.push(`${typeName}: ${message}`);
  
  if (exception.details?.stackTrace) {
    lines.push("");
    lines.push("Stack Trace:");
    lines.push(exception.details.stackTrace);
  }
  
  if (exception.details?.innerException && exception.details.innerException.length > 0) {
    for (const inner of exception.details.innerException) {
      lines.push("");
      lines.push(`Inner Exception: ${inner.typeName || "Unknown"}`);
      if (inner.message) {
        lines.push(inner.message);
      }
      if (inner.stackTrace) {
        lines.push(inner.stackTrace);
      }
    }
  }
  
  return lines.join("\n");
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Renders the stack trace section with expand/collapse functionality.
 */
const StackTraceSection: Component<{
  stackTrace?: string;
  expanded: boolean;
  onToggle: () => void;
}> = (props) => {
  return (
    <Show when={props.stackTrace}>
      <div style={styles.body}>
        <button
          style={styles.stackTraceToggle}
          onClick={props.onToggle}
          aria-expanded={props.expanded}
        >
          <ChevronIcon expanded={props.expanded} />
          <span>Stack Trace</span>
        </button>
        <Show when={props.expanded}>
          <div style={styles.stackTrace}>
            <pre style={styles.stackTraceLine}>{props.stackTrace}</pre>
          </div>
        </Show>
      </div>
    </Show>
  );
};

/**
 * Renders inner exception details recursively.
 */
const InnerExceptionSection: Component<{
  innerExceptions?: ExceptionDetails[];
}> = (props) => {
  return (
    <Show when={props.innerExceptions && props.innerExceptions.length > 0}>
      {props.innerExceptions!.map((inner, index) => (
        <div style={styles.innerException}>
          <div style={styles.innerExceptionLabel}>
            Inner Exception {index + 1}: {inner.typeName || "Unknown"}
          </div>
          <Show when={inner.message}>
            <div style={styles.message}>{inner.message}</div>
          </Show>
          <Show when={inner.stackTrace}>
            <div style={{ ...styles.stackTrace, "margin-top": "4px" }}>
              <pre style={styles.stackTraceLine}>{inner.stackTrace}</pre>
            </div>
          </Show>
        </div>
      ))}
    </Show>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export interface ExceptionWidgetProps {
  /** Line height in pixels for positioning */
  lineHeight?: number;
  /** Top offset for the editor content area */
  editorTopOffset?: number;
  /** Called when the user clicks Continue */
  onContinue?: () => void;
  /** Called when the user wants to configure exception breakpoints */
  onConfigureBreakpoint?: (exceptionId: string) => void;
}

/**
 * ExceptionWidget displays exception information inline in the editor.
 * It shows the exception type, message, stack trace, and provides actions.
 */
export const ExceptionWidget: Component<ExceptionWidgetProps> = (props) => {
  const debug = useDebug();
  const [stackTraceExpanded, setStackTraceExpanded] = createSignal(false);
  const [closeButtonHovered, setCloseButtonHovered] = createSignal(false);
  const [primaryButtonHovered, setPrimaryButtonHovered] = createSignal(false);
  const [breakButtonHovered, setBreakButtonHovered] = createSignal(false);
  const [copyButtonHovered, setCopyButtonHovered] = createSignal(false);
  const [copySuccess, setCopySuccess] = createSignal(false);
  
  let containerRef: HTMLDivElement | undefined;

  // Get exception widget state from context
  const widgetState = () => debug.getExceptionWidgetState();
  const exception = () => widgetState().exception;
  const position = () => widgetState().position;
  const visible = () => widgetState().visible;

  // Calculate top position based on line number
  const topPosition = () => {
    const lineHeight = props.lineHeight || 20;
    const editorOffset = props.editorTopOffset || 0;
    const line = position().line;
    // Position widget below the exception line
    return `${editorOffset + (line * lineHeight)}px`;
  };

  // Handle Escape key to close
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && visible()) {
      e.preventDefault();
      e.stopPropagation();
      debug.hideExceptionWidget();
    }
  };

  // Handle Continue action
  const handleContinue = async () => {
    debug.hideExceptionWidget();
    if (props.onContinue) {
      props.onContinue();
    } else {
      await debug.continue_();
    }
  };

  // Handle Break on this exception
  const handleBreakOnException = () => {
    const exc = exception();
    if (exc && props.onConfigureBreakpoint) {
      props.onConfigureBreakpoint(exc.id);
    }
    // Notify the user that breakpoint configuration was triggered
    if (exc) {
      window.dispatchEvent(new CustomEvent("notification", {
        detail: {
          type: "info",
          message: `Exception breakpoint configured for: ${exc.id}`,
        },
      }));
    }
  };

  // Handle Copy to clipboard
  const handleCopy = async () => {
    const exc = exception();
    if (!exc) return;

    const text = formatExceptionForCopy(exc);
    
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy exception to clipboard:", err);
    }
  };

  // Handle close
  const handleClose = () => {
    debug.hideExceptionWidget();
  };

  // Setup keyboard listener
  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  // Focus container when shown for keyboard accessibility
  createEffect(() => {
    if (visible() && containerRef) {
      containerRef.focus();
    }
  });

  return (
    <Show when={visible() && exception()}>
      <div
        ref={containerRef}
        style={{
          ...styles.container,
          top: topPosition(),
        }}
        role="alert"
        aria-live="assertive"
        tabIndex={-1}
      >
        <div style={styles.widget}>
          {/* Header with exception type and close button */}
          <div style={styles.header}>
            <div style={styles.headerContent}>
              <div style={styles.exceptionType}>
                <ExceptionIcon />
                <span style={styles.typeName}>
                  {getExceptionDisplayName(exception()!)}
                </span>
                <Show when={exception()!.breakMode && exception()!.breakMode !== "never"}>
                  <span style={styles.breakMode}>
                    ({formatBreakMode(exception()!.breakMode)})
                  </span>
                </Show>
              </div>
              <div style={styles.message}>
                {getExceptionMessage(exception()!)}
              </div>
            </div>
            <button
              style={{
                ...styles.closeButton,
                ...(closeButtonHovered() ? styles.closeButtonHover : {}),
              }}
              onClick={handleClose}
              onMouseEnter={() => setCloseButtonHovered(true)}
              onMouseLeave={() => setCloseButtonHovered(false)}
              title="Close (Escape)"
              aria-label="Close exception widget"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Stack trace section */}
          <StackTraceSection
            stackTrace={exception()!.details?.stackTrace}
            expanded={stackTraceExpanded()}
            onToggle={() => setStackTraceExpanded(!stackTraceExpanded())}
          />

          {/* Inner exceptions */}
          <InnerExceptionSection
            innerExceptions={exception()!.details?.innerException}
          />

          {/* Action buttons */}
          <div style={styles.actions}>
            <button
              style={{
                ...styles.actionButton,
                ...styles.primaryButton,
                ...(primaryButtonHovered() ? styles.primaryButtonHover : {}),
              }}
              onClick={handleContinue}
              onMouseEnter={() => setPrimaryButtonHovered(true)}
              onMouseLeave={() => setPrimaryButtonHovered(false)}
              title="Continue execution (F5)"
            >
              <PlayIcon />
              <span>Continue</span>
            </button>

            <button
              style={{
                ...styles.actionButton,
                ...styles.secondaryButton,
                ...(breakButtonHovered() ? styles.secondaryButtonHover : {}),
              }}
              onClick={handleBreakOnException}
              onMouseEnter={() => setBreakButtonHovered(true)}
              onMouseLeave={() => setBreakButtonHovered(false)}
              title="Configure exception breakpoint"
            >
              <BreakpointIcon />
              <span>Break on this exception</span>
            </button>

            <button
              style={{
                ...styles.actionButton,
                ...styles.secondaryButton,
                ...(copyButtonHovered() ? styles.secondaryButtonHover : {}),
              }}
              onClick={handleCopy}
              onMouseEnter={() => setCopyButtonHovered(true)}
              onMouseLeave={() => setCopyButtonHovered(false)}
              title="Copy exception details to clipboard"
            >
              <CopyIcon />
              <span>{copySuccess() ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ExceptionWidget;


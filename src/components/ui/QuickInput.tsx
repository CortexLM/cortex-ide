/**
 * QuickInput Component
 * 
 * A VS Code-style input box for quick user input (like VS Code's IInputBox).
 * 
 * Features:
 * - Title and step indicator ("Step 1 of 3")
 * - Prompt/description text
 * - Placeholder text
 * - Initial value with selection
 * - Validation with error/warning/info messages
 * - Password mode (hidden input)
 * - Custom buttons
 * - Busy indicator
 * - Back button for multi-step flows
 * 
 * Use cases: rename symbol, create file, git commit message, etc.
 */

import {
  createSignal,
  createEffect,
  Show,
  For,
  onCleanup,
  JSX,
  batch,
} from "solid-js";
import { Portal } from "solid-js/web";
import { useDebouncedCallback } from "@/hooks";
import { LoadingSpinner } from "./LoadingSpinner";

// ============================================================================
// Types
// ============================================================================

/** Validation severity levels */
export type ValidationSeverity = "error" | "warning" | "info";

/** Validation result returned by validation functions */
export interface ValidationResult {
  /** Whether the input is valid (no error) */
  valid: boolean;
  /** Message to display */
  message?: string;
  /** Severity of the validation message */
  severity?: ValidationSeverity;
}

/** Custom button configuration */
export interface QuickInputButton {
  /** Unique identifier for the button */
  id: string;
  /** Button label text */
  label: string;
  /** Tooltip text */
  tooltip?: string;
  /** Icon element to display */
  icon?: JSX.Element;
  /** Whether this is the primary/default button */
  primary?: boolean;
}

/** Selection range for initial value */
export interface SelectionRange {
  /** Start index of selection */
  start: number;
  /** End index of selection */
  end: number;
}

/** Options for showInputBox */
export interface QuickInputOptions {
  /** Title displayed at the top of the input box */
  title?: string;
  /** Step indicator (e.g., { current: 1, total: 3 }) */
  step?: {
    current: number;
    total: number;
  };
  /** Prompt/description text shown above the input */
  prompt?: string;
  /** Placeholder text shown when input is empty */
  placeholder?: string;
  /** Initial value of the input */
  value?: string;
  /** Selection range for initial value */
  valueSelection?: SelectionRange | "all";
  /** Password mode - hides input characters */
  password?: boolean;
  /** Whether to ignore focus out events (keep open when clicking outside) */
  ignoreFocusOut?: boolean;
  /** Synchronous validation function */
  validateInput?: (value: string) => ValidationResult | string | undefined;
  /** Asynchronous validation function */
  validateInputAsync?: (value: string) => Promise<ValidationResult | string | undefined>;
  /** Debounce delay for async validation in ms (default: 300) */
  validationDebounce?: number;
  /** Custom buttons to display */
  buttons?: QuickInputButton[];
  /** Whether to show the back button */
  showBackButton?: boolean;
  /** Busy/loading state */
  busy?: boolean;
  /** Whether input should accept multi-line (shows textarea) */
  multiline?: boolean;
}

/** Internal state for QuickInput */
interface QuickInputState extends QuickInputOptions {
  /** Whether the input box is visible */
  visible: boolean;
  /** Current input value */
  currentValue: string;
  /** Current validation result */
  validation: ValidationResult | null;
  /** Whether async validation is in progress */
  validating: boolean;
  /** Resolve function for the promise */
  resolve: ((value: string | undefined) => void) | null;
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Callback when a button is clicked */
  onButton?: (button: QuickInputButton) => void;
}

// ============================================================================
// QuickInput Component
// ============================================================================

export interface QuickInputProps {
  /** Current state of the input box */
  state: QuickInputState;
  /** Callback to update state */
  onStateChange: (updates: Partial<QuickInputState>) => void;
  /** Callback when input is submitted */
  onSubmit: (value: string) => void;
  /** Callback when input is cancelled */
  onCancel: () => void;
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Callback when a custom button is clicked */
  onButton?: (button: QuickInputButton) => void;
}

export function QuickInput(props: QuickInputProps) {
  let inputRef: HTMLInputElement | HTMLTextAreaElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  // Local state for hover effects
  const [backHover, setBackHover] = createSignal(false);
  const [isClosing, setIsClosing] = createSignal(false);

  // Create debounced async validation
  const debouncedValidate = useDebouncedCallback(
    (async (value: unknown) => {
      if (!props.state.validateInputAsync) return;
      
      props.onStateChange({ validating: true });
      
      try {
        const result = await props.state.validateInputAsync(value as string);
        const validation = normalizeValidation(result);
        props.onStateChange({ validation, validating: false });
      } catch (error) {
        props.onStateChange({
          validation: {
            valid: false,
            message: error instanceof Error ? error.message : "Validation failed",
            severity: "error",
          },
          validating: false,
        });
      }
    }) as (...args: unknown[]) => unknown,
    props.state.validationDebounce ?? 300
  );

  // Focus input when visible
  createEffect(() => {
    if (props.state.visible && inputRef) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        inputRef?.focus();
        
        // Handle initial selection
        if (props.state.value && props.state.valueSelection && inputRef) {
          const selection = props.state.valueSelection;
          if (selection === "all") {
            (inputRef as HTMLInputElement).setSelectionRange(0, props.state.value.length);
          } else {
            (inputRef as HTMLInputElement).setSelectionRange(selection.start, selection.end);
          }
        }
      }, 10);
    }
  });

  // Handle value changes
  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const value = target.value;
    
    batch(() => {
      props.onStateChange({ currentValue: value });
      
      // Run sync validation immediately
      if (props.state.validateInput) {
        const result = props.state.validateInput(value);
        const validation = normalizeValidation(result);
        props.onStateChange({ validation });
      }
      
      // Schedule async validation
      if (props.state.validateInputAsync) {
        debouncedValidate(value);
      }
    });
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    } else if (e.key === "Enter" && !e.shiftKey) {
      // For multiline, allow Shift+Enter for new lines
      if (!props.state.multiline || !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  // Handle submit
  const handleSubmit = () => {
    const validation = props.state.validation;
    
    // Don't submit if there's an error
    if (validation && !validation.valid && validation.severity === "error") {
      return;
    }
    
    // Don't submit while validating
    if (props.state.validating) {
      return;
    }
    
    props.onSubmit(props.state.currentValue);
  };

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      props.onCancel();
      setIsClosing(false);
    }, 100);
  };

  // Handle focus out
  const handleFocusOut = (e: FocusEvent) => {
    if (props.state.ignoreFocusOut) return;
    
    // Check if focus is moving to another element within the container
    const relatedTarget = e.relatedTarget as Node;
    if (containerRef?.contains(relatedTarget)) {
      return;
    }
    
    // Small delay to allow button clicks to process
    setTimeout(() => {
      if (!containerRef?.contains(document.activeElement)) {
        handleClose();
      }
    }, 100);
  };

  // Handle backdrop click
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget && !props.state.ignoreFocusOut) {
      handleClose();
    }
  };

  // Handle back button
  const handleBack = () => {
    if (props.onBack) {
      props.onBack();
    }
  };

  // Handle custom button click
  const handleButtonClick = (button: QuickInputButton) => {
    if (props.onButton) {
      props.onButton(button);
    }
  };

  // Cleanup on unmount
  onCleanup(() => {
    debouncedValidate.cancel();
  });

  // ============================================================================
  // Styles
  // ============================================================================

  const backdropStyle: JSX.CSSProperties = {
    position: "fixed",
    inset: "0",
    "z-index": "2549",
    background: "transparent",
  };

  const containerStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    top: "44px",
    width: props.state.multiline ? "520px" : "420px",
    "max-width": "calc(100vw - 32px)",
    "z-index": "2550",
    left: "50%",
    transform: `translateX(-50%) ${isClosing() ? "translateY(-10px)" : "translateY(0)"}`,
    "border-radius": "var(--cortex-radius-md)",
    "font-size": "11px",
    "-webkit-app-region": "no-drag",
    background: "var(--ui-panel-bg)",
    color: "var(--jb-text-body-color)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.3)",
    overflow: "hidden",
    opacity: isClosing() ? "0" : "1",
    transition: "opacity 100ms ease, transform 100ms ease",
  });

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    padding: "8px 12px",
    gap: "8px",
    "border-bottom": "1px solid rgba(255, 255, 255, 0.06)",
  };

  const backButtonStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "20px",
    height: "20px",
    background: backHover() ? "rgba(255, 255, 255, 0.08)" : "transparent",
    border: "none",
    "border-radius": "var(--cortex-radius-sm)",
    color: "var(--jb-text-muted-color)",
    cursor: "pointer",
    transition: "background 80ms ease",
    "flex-shrink": "0",
  });

  const titleStyle: JSX.CSSProperties = {
    flex: "1",
    "font-size": "12px",
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const stepStyle: JSX.CSSProperties = {
    "font-size": "10px",
    color: "var(--jb-text-muted-color)",
    "flex-shrink": "0",
  };

  const promptStyle: JSX.CSSProperties = {
    padding: "8px 12px",
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    "border-bottom": "1px solid rgba(255, 255, 255, 0.06)",
    "line-height": "1.4",
  };

  const inputContainerStyle: JSX.CSSProperties = {
    padding: "8px 12px",
    display: "flex",
    "align-items": "flex-start",
    gap: "8px",
  };

  const inputStyle: JSX.CSSProperties = {
    flex: "1",
    height: props.state.multiline ? "80px" : "24px",
    padding: "4px 8px",
    background: "var(--jb-input-bg)",
    border: "1px solid var(--jb-border-default)",
    "border-radius": "var(--cortex-radius-sm)",
    color: "var(--jb-text-body-color)",
    "font-family": "var(--jb-font-ui)",
    "font-size": "12px",
    outline: "none",
    resize: props.state.multiline ? "vertical" : "none",
    transition: "border-color 80ms ease",
  };

  const busyIndicatorStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "20px",
    height: "24px",
    "flex-shrink": "0",
  };

  const validationStyle = (): JSX.CSSProperties => {
    const validation = props.state.validation;
    if (!validation?.message) return { display: "none" };

    const colorMap: Record<ValidationSeverity, string> = {
      error: "var(--cortex-error)",
      warning: "var(--cortex-warning)",
      info: "var(--jb-border-focus)",
    };

    const bgMap: Record<ValidationSeverity, string> = {
      error: "rgba(247, 84, 100, 0.1)",
      warning: "rgba(233, 170, 70, 0.1)",
      info: "rgba(53, 116, 240, 0.1)",
    };

    const severity = validation.severity || "error";

    return {
      display: "flex",
      "align-items": "flex-start",
      gap: "6px",
      padding: "6px 12px",
      background: bgMap[severity],
      color: colorMap[severity],
      "font-size": "11px",
      "line-height": "1.4",
    };
  };

  const buttonsContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "flex-end",
    gap: "6px",
    padding: "8px 12px",
    "border-top": "1px solid rgba(255, 255, 255, 0.06)",
  };

  const buttonStyle = (isPrimary?: boolean): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    gap: "4px",
    height: "24px",
    padding: "0 12px",
    background: isPrimary ? "var(--jb-btn-primary-bg)" : "transparent",
    border: isPrimary ? "none" : "1px solid var(--jb-border-default)",
    "border-radius": "var(--cortex-radius-sm)",
    color: isPrimary ? "var(--jb-btn-primary-color)" : "var(--jb-text-body-color)",
    "font-family": "var(--jb-font-ui)",
    "font-size": "11px",
    cursor: "pointer",
    transition: "filter 80ms ease",
  });

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Show when={props.state.visible}>
      <Portal>
        {/* Backdrop */}
        <div style={backdropStyle} onClick={handleBackdropClick} />

        {/* Container */}
        <div
          ref={containerRef}
          style={containerStyle()}
          role="dialog"
          aria-modal="true"
          aria-label={props.state.title || "Input"}
          onFocusOut={handleFocusOut}
        >
          {/* Header with title and step indicator */}
          <Show when={props.state.title || props.state.step || props.state.showBackButton}>
            <div style={headerStyle}>
              {/* Back button */}
              <Show when={props.state.showBackButton}>
                <button
                  type="button"
                  style={backButtonStyle()}
                  onClick={handleBack}
                  onMouseEnter={() => setBackHover(true)}
                  onMouseLeave={() => setBackHover(false)}
                  aria-label="Go back"
                  title="Go back"
                >
                  <BackIcon />
                </button>
              </Show>

              {/* Title */}
              <Show when={props.state.title}>
                <div style={titleStyle}>{props.state.title}</div>
              </Show>

              {/* Step indicator */}
              <Show when={props.state.step}>
                <div style={stepStyle}>
                  Step {props.state.step!.current} of {props.state.step!.total}
                </div>
              </Show>
            </div>
          </Show>

          {/* Prompt/description */}
          <Show when={props.state.prompt}>
            <div style={promptStyle}>{props.state.prompt}</div>
          </Show>

          {/* Input container */}
          <div style={inputContainerStyle}>
            {props.state.multiline ? (
              <textarea
                ref={inputRef as HTMLTextAreaElement}
                value={props.state.currentValue}
                placeholder={props.state.placeholder}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                style={inputStyle}
                aria-label={props.state.prompt || props.state.title || "Input"}
                aria-invalid={props.state.validation?.severity === "error"}
              />
            ) : (
              <input
                ref={inputRef as HTMLInputElement}
                type={props.state.password ? "password" : "text"}
                value={props.state.currentValue}
                placeholder={props.state.placeholder}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                style={inputStyle}
                aria-label={props.state.prompt || props.state.title || "Input"}
                aria-invalid={props.state.validation?.severity === "error"}
              />
            )}

            {/* Busy indicator */}
            <Show when={props.state.busy || props.state.validating}>
              <div style={busyIndicatorStyle}>
                <LoadingSpinner size="sm" />
              </div>
            </Show>
          </div>

          {/* Validation message */}
          <Show when={props.state.validation?.message}>
            <div style={validationStyle()}>
              <ValidationIcon severity={props.state.validation?.severity || "error"} />
              <span>{props.state.validation?.message}</span>
            </div>
          </Show>

          {/* Custom buttons */}
          <Show when={props.state.buttons && props.state.buttons.length > 0}>
            <div style={buttonsContainerStyle}>
              <For each={props.state.buttons}>
                {(button) => (
                  <button
                    type="button"
                    style={buttonStyle(button.primary)}
                    onClick={() => handleButtonClick(button)}
                    title={button.tooltip}
                  >
                    <Show when={button.icon}>{button.icon}</Show>
                    {button.label}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Portal>
    </Show>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function BackIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M7.5 2.5L4 6L7.5 9.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function ValidationIcon(props: { severity: ValidationSeverity }) {
  const iconStyle: JSX.CSSProperties = {
    width: "12px",
    height: "12px",
    "flex-shrink": "0",
    "margin-top": "1px",
  };

  switch (props.severity) {
    case "error":
      return (
        <svg style={iconStyle} viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2" />
          <path d="M6 3.5V6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          <circle cx="6" cy="8.5" r="0.6" fill="currentColor" />
        </svg>
      );
    case "warning":
      return (
        <svg style={iconStyle} viewBox="0 0 12 12" fill="none">
          <path
            d="M6 1.5L11 10.5H1L6 1.5Z"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
          <path d="M6 5V7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          <circle cx="6" cy="8.5" r="0.6" fill="currentColor" />
        </svg>
      );
    case "info":
    default:
      return (
        <svg style={iconStyle} viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2" />
          <circle cx="6" cy="3.5" r="0.6" fill="currentColor" />
          <path d="M6 5.5V8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize various validation return types to ValidationResult
 */
function normalizeValidation(
  result: ValidationResult | string | undefined | null
): ValidationResult | null {
  if (result === undefined || result === null) {
    return null;
  }

  if (typeof result === "string") {
    return result
      ? { valid: false, message: result, severity: "error" }
      : { valid: true };
  }

  return result;
}

// ============================================================================
// Exports
// ============================================================================

export type { QuickInputState };
export { normalizeValidation };


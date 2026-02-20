/**
 * CortexInput - Pixel-perfect input component for Cortex UI Design System
 *
 * Figma specs:
 * - Container: bg var(--cortex-sidebar-bg), border var(--cortex-border-accent),
 *   border-radius 12px, padding 12px
 * - Focus: border-color var(--cortex-accent-primary)
 * - Error: border-color var(--cortex-error)
 * - Font: Figtree 14px
 */

import { Component, JSX, splitProps, createSignal, Show } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexInputProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: boolean;
  size?: "sm" | "md" | "lg";
  leftIcon?: string;
  rightIcon?: string;
  onRightIconClick?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
  type?: "text" | "password" | "email" | "search";
  autoFocus?: boolean;
  multiline?: boolean;
  rows?: number;
}

const SIZE_SPECS = {
  sm: { height: 32, padding: 8, fontSize: 14, iconSize: 14 },
  md: { height: 40, padding: 12, fontSize: 14, iconSize: 16 },
  lg: { height: 48, padding: 16, fontSize: 16, iconSize: 18 },
};

export const CortexInput: Component<CortexInputProps> = (props) => {
  const [local] = splitProps(props, [
    "value", "placeholder", "onChange", "onSubmit", "onFocus", "onBlur",
    "disabled", "error", "size", "leftIcon", "rightIcon", "onRightIconClick",
    "class", "style", "type", "autoFocus", "multiline", "rows",
  ]);

  const [isFocused, setIsFocused] = createSignal(false);
  const size = () => local.size || "md";
  const specs = () => SIZE_SPECS[size()];

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    height: local.multiline ? "auto" : `${specs().height}px`,
    "min-height": local.multiline ? `${specs().height}px` : undefined,
    padding: `${specs().padding}px`,
    background: "var(--cortex-sidebar-bg)",
    border: local.error
      ? "1px solid var(--cortex-input-border-error, var(--cortex-error))"
      : isFocused()
      ? "1px solid var(--cortex-input-border-focus, var(--cortex-accent-primary))"
      : "1px solid var(--cortex-border-accent)",
    "border-radius": "var(--cortex-sidebar-radius, 12px)",
    transition: "border-color var(--cortex-transition-normal, 150ms ease)",
    opacity: local.disabled ? "0.5" : "1",
    cursor: local.disabled ? "not-allowed" : "text",
    outline: "none",
    ...local.style,
  });

  const inputStyle = (): JSX.CSSProperties => ({
    flex: "1",
    height: local.multiline ? "auto" : "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--cortex-input-text, var(--cortex-text-primary))",
    "font-family": "var(--cortex-font-sans, 'Figtree', sans-serif)",
    "font-size": `${specs().fontSize}px`,
    "line-height": local.multiline ? "1.5" : "1",
    resize: local.multiline ? "vertical" : "none",
  });

  const iconStyle = (clickable: boolean): JSX.CSSProperties => ({
    "flex-shrink": "0",
    color: "var(--cortex-text-inactive)",
    cursor: clickable ? "pointer" : "default",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
  });

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    local.onChange?.(target.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !local.multiline && !e.shiftKey) {
      e.preventDefault();
      local.onSubmit?.(local.value || "");
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    local.onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    local.onBlur?.();
  };

  return (
    <div class={local.class} style={containerStyle()}>
      <Show when={local.leftIcon}>
        <CortexIcon
          name={local.leftIcon!}
          size={specs().iconSize}
          style={iconStyle(false)}
        />
      </Show>

      {local.multiline ? (
        <textarea
          value={local.value || ""}
          placeholder={local.placeholder}
          disabled={local.disabled}
          autofocus={local.autoFocus}
          rows={local.rows || 3}
          style={inputStyle()}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <input
          type={local.type || "text"}
          value={local.value || ""}
          placeholder={local.placeholder}
          disabled={local.disabled}
          autofocus={local.autoFocus}
          style={inputStyle()}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      )}

      <Show when={local.rightIcon}>
        <CortexIcon
          name={local.rightIcon!}
          size={specs().iconSize}
          style={iconStyle(!!local.onRightIconClick)}
          onClick={local.onRightIconClick}
        />
      </Show>
    </div>
  );
};

/**
 * CortexPromptInput - Specialized chat prompt input matching Figma design
 *
 * Figma: layout_1J2410 (Home) → padding 16px, gap 32px, width 802px
 *        layout_AFMUU2 (Minimized) → padding 12px, gap 8px
 *
 * Structure:
 * ┌──────────────────────────────────────────────────────┐
 * │  [Placeholder text ...]                    [Send ●]  │  ← Input row
 * │                                                      │
 * │  [+] [📎]                   [Build ▾] [claude ▾]     │  ← Action bar
 * └──────────────────────────────────────────────────────┘
 *
 * Send button: 32×32px, bg var(--cortex-accent-primary), border-radius 16px
 * Model selector: height 32px, padding 8px 8px 8px 12px, border-radius 8px
 */
export interface CortexPromptInputProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onPlusClick?: () => void;
  onUploadClick?: () => void;
  onModelClick?: () => void;
  modelName?: string;
  modelIcon?: string;
  isProcessing?: boolean;
  onStop?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexPromptInput: Component<CortexPromptInputProps> = (props) => {
  const [local, others] = splitProps(props, [
    "value", "placeholder", "onChange", "onSubmit", "onPlusClick", "onUploadClick",
    "onModelClick", "modelName", "modelIcon", "isProcessing", "onStop", "class", "style",
  ]);

  const [isFocused, setIsFocused] = createSignal(false);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    width: "100%",
    "max-width": "802px",
    "min-width": "345px",
    padding: "16px",
    background: "var(--cortex-bg-secondary)",
    "border-radius": "var(--cortex-sidebar-radius, 12px)",
    border: isFocused()
      ? "1px solid var(--cortex-accent-primary)"
      : "1px solid var(--cortex-border-accent)",
    gap: "16px",
    transition: "border-color var(--cortex-transition-normal, 150ms ease)",
    ...local.style,
  });

  const inputRowStyle: JSX.CSSProperties = {
    display: "flex",
    "justify-content": "space-between",
    "align-items": "center",
    gap: "12px",
  };

  const inputStyle: JSX.CSSProperties = {
    flex: "1",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--cortex-text-primary)",
    "font-family": "var(--cortex-font-sans, 'Figtree', sans-serif)",
    "font-size": "18px",
    "font-weight": "500",
    "line-height": "1.33em",
  };

  const sendButtonStyle = (): JSX.CSSProperties => ({
    width: "32px",
    height: "32px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: local.isProcessing
      ? "var(--cortex-error)"
      : "var(--cortex-accent-primary)",
    "border-radius": "16px",
    border: "none",
    cursor: "pointer",
    "flex-shrink": "0",
    transition: "background var(--cortex-transition-fast, 100ms ease)",
    opacity: !local.value && !local.isProcessing ? "0.5" : "1",
    padding: "8px",
  });

  const actionBarStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
  };

  const leftActionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
  };

  const actionButtonStyle: JSX.CSSProperties = {
    width: "20px",
    height: "20px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--cortex-text-inactive)",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
    padding: "0",
  };

  const rightActionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const modelSelectorStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 8px 8px 12px",
    background: "var(--cortex-model-selector-bg)",
    border: "1px solid var(--cortex-model-selector-border)",
    "border-radius": "var(--cortex-radius-md, 8px)",
    cursor: "pointer",
    color: "var(--cortex-text-primary)",
    "font-family": "var(--cortex-font-sans, 'Figtree', sans-serif)",
    "font-size": "14px",
    "font-weight": "500",
    "line-height": "1em",
    "letter-spacing": "-0.015em",
    height: "32px",
  };

  const handleSubmit = () => {
    if (local.isProcessing) {
      local.onStop?.();
    } else {
      local.onSubmit?.(local.value || "");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      {/* Input Row */}
      <div style={inputRowStyle}>
        <input
          type="text"
          value={local.value || ""}
          placeholder={local.placeholder || "Send a prompt or run a command..."}
          style={inputStyle}
          onInput={(e) => local.onChange?.(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <button style={sendButtonStyle()} onClick={handleSubmit}>
          <Show
            when={local.isProcessing}
            fallback={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M14.5 1.5L7.5 8.5M14.5 1.5L10 14.5L7.5 8.5M14.5 1.5L1.5 6L7.5 8.5"
                  stroke="var(--cortex-accent-dark-bg)"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
              </svg>
            }
          >
            <CortexIcon name="stop" size={16} color="var(--cortex-text-primary)" />
          </Show>
        </button>
      </div>

      {/* Action Bar */}
      <div style={actionBarStyle}>
        <div style={leftActionsStyle}>
          <button style={actionButtonStyle} onClick={local.onPlusClick}>
            <CortexIcon name="plus" size={20} color="var(--cortex-text-inactive)" />
          </button>
          <button style={actionButtonStyle} onClick={local.onUploadClick}>
            <CortexIcon name="upload" size={20} color="var(--cortex-text-inactive)" />
          </button>
        </div>

        <div style={rightActionsStyle}>
          <button style={modelSelectorStyle} onClick={local.onModelClick}>
            <Show when={local.modelIcon}>
              <img
                src={local.modelIcon || "/assets/claude-logo.svg"}
                alt=""
                style={{ width: "16px", height: "16px" }}
              />
            </Show>
            <span>{local.modelName || "Claude 3.5 Sonnet"}</span>
            <CortexIcon name="chevron-down" size={16} color="var(--cortex-text-inactive)" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CortexInput;

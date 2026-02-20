/**
 * Input - Cortex UI Design System Input Component
 * 
 * Cortex UI specs:
 * - Background: var(--cortex-bg-primary) (--cortex-bg-primary)
 * - Border: rgba(255,255,255,0.15) (--cortex-border-default)
 * - Focus border: var(--cortex-accent-primary) (--cortex-accent-primary)
 * - Border radius: 8px (--cortex-radius-md)
 */
/**
 * @deprecated Prefer CortexInput from "@/components/cortex/primitives" for new code.
 * This HTML-attributes-extending API is kept for backward compatibility.
 */
import { JSX, splitProps, Show, createSignal } from "solid-js";

export interface InputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "style"> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: JSX.Element;
  iconRight?: JSX.Element;
  style?: JSX.CSSProperties;
}

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, [
    "label",
    "error",
    "hint",
    "icon",
    "iconRight",
    "style",
    "onFocus",
    "onBlur",
  ]);

  const [isFocused, setIsFocused] = createSignal(false);

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "4px",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
    "margin-bottom": "6px",
  };

  const wrapperStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "flex",
    "align-items": "center",
  });

  const inputStyle = (): JSX.CSSProperties => ({
    width: "100%",
    height: "32px",
    padding: local.icon ? "8px 12px 8px 36px" : local.iconRight ? "8px 36px 8px 12px" : "8px 12px",
    background: "var(--cortex-bg-primary)",
    border: local.error 
      ? "1px solid var(--cortex-error)" 
      : isFocused() 
        ? "2px solid var(--cortex-accent-primary)"
        : "1px solid var(--cortex-border-default)",
    "border-radius": "var(--cortex-radius-md)",
    color: "var(--cortex-text-primary)",
    "font-family": "var(--cortex-font-sans)",
    "font-size": "13px",
    outline: "none",
    transition: "border-color var(--cortex-transition-fast)",
    ...local.style,
  });

  const iconStyle: JSX.CSSProperties = {
    position: "absolute",
    left: "12px",
    width: "16px",
    height: "16px",
    color: "var(--cortex-text-inactive)",
    "pointer-events": "none",
  };

  const iconRightStyle: JSX.CSSProperties = {
    position: "absolute",
    right: "12px",
    width: "16px",
    height: "16px",
    color: "var(--cortex-text-inactive)",
    "pointer-events": "none",
  };

  const hintStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--cortex-text-inactive)",
    "margin-top": "4px",
  };

  const errorStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--cortex-error)",
    "margin-top": "4px",
  };

  const handleFocus = (e: FocusEvent) => {
    setIsFocused(true);
    if (typeof local.onFocus === "function") {
      (local.onFocus as (e: FocusEvent) => void)(e);
    }
  };

  const handleBlur = (e: FocusEvent) => {
    setIsFocused(false);
    if (typeof local.onBlur === "function") {
      (local.onBlur as (e: FocusEvent) => void)(e);
    }
  };

  return (
    <div style={containerStyle}>
      <Show when={local.label}>
        <label style={labelStyle}>{local.label}</label>
      </Show>
      <div style={wrapperStyle()}>
        <Show when={local.icon}>
          <span style={iconStyle}>{local.icon}</span>
        </Show>
        <input
          {...rest}
          style={inputStyle()}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        <Show when={local.iconRight}>
          <span style={iconRightStyle}>{local.iconRight}</span>
        </Show>
      </div>
      <Show when={local.hint && !local.error}>
        <span style={hintStyle}>{local.hint}</span>
      </Show>
      <Show when={local.error}>
        <span style={errorStyle}>{local.error}</span>
      </Show>
    </div>
  );
}

/**
 * Textarea - Cortex UI Design System Textarea Component
 */
export interface TextareaProps extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, "style"> {
  label?: string;
  error?: string;
  hint?: string;
  style?: JSX.CSSProperties;
}

export function Textarea(props: TextareaProps) {
  const [local, rest] = splitProps(props, [
    "label",
    "error",
    "hint",
    "style",
    "onFocus",
    "onBlur",
  ]);

  const [isFocused, setIsFocused] = createSignal(false);

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "4px",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
    "margin-bottom": "6px",
  };

  const textareaStyle = (): JSX.CSSProperties => ({
    width: "100%",
    "min-height": "80px",
    padding: "8px 12px",
    background: "var(--cortex-bg-primary)",
    border: local.error 
      ? "1px solid var(--cortex-error)" 
      : isFocused() 
        ? "2px solid var(--cortex-accent-primary)"
        : "1px solid var(--cortex-border-default)",
    "border-radius": "var(--cortex-radius-md)",
    color: "var(--cortex-text-primary)",
    "font-family": "var(--cortex-font-sans)",
    "font-size": "13px",
    outline: "none",
    resize: "vertical",
    transition: "border-color var(--cortex-transition-fast)",
    ...local.style,
  });

  const hintStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--cortex-text-inactive)",
    "margin-top": "4px",
  };

  const errorStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--cortex-error)",
    "margin-top": "4px",
  };

  const handleFocus = (e: FocusEvent) => {
    setIsFocused(true);
    if (typeof local.onFocus === "function") {
      (local.onFocus as (e: FocusEvent) => void)(e);
    }
  };

  const handleBlur = (e: FocusEvent) => {
    setIsFocused(false);
    if (typeof local.onBlur === "function") {
      (local.onBlur as (e: FocusEvent) => void)(e);
    }
  };

  return (
    <div style={containerStyle}>
      <Show when={local.label}>
        <label style={labelStyle}>{local.label}</label>
      </Show>
      <textarea
        {...rest}
        style={textareaStyle()}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <Show when={local.hint && !local.error}>
        <span style={hintStyle}>{local.hint}</span>
      </Show>
      <Show when={local.error}>
        <span style={errorStyle}>{local.error}</span>
      </Show>
    </div>
  );
}



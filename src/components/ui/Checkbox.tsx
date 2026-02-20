import { JSX, splitProps, Show, createSignal } from "solid-js";

export interface CheckboxProps {
  /** Checked state */
  checked?: boolean;
  /** Indeterminate state */
  indeterminate?: boolean;
  /** Callback when checkbox changes */
  onChange?: (checked: boolean) => void;
  /** Label text */
  label?: string;
  /** Description text */
  description?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom styles */
  style?: JSX.CSSProperties;
  /** ARIA label */
  "aria-label"?: string;
}

export function Checkbox(props: CheckboxProps) {
  const [local] = splitProps(props, [
    "checked", "indeterminate", "onChange", "label", "description",
    "disabled", "style", "aria-label"
  ]);

  const [focused, setFocused] = createSignal(false);
  const [hovered, setHovered] = createSignal(false);

  const isChecked = () => local.checked ?? false;
  const isIndeterminate = () => local.indeterminate ?? false;

  const handleClick = () => {
    if (local.disabled) return;
    local.onChange?.(!isChecked());
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (local.disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      local.onChange?.(!isChecked());
    }
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "flex-start",
    gap: "8px",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    ...local.style,
  };

  const checkboxStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "18px",
    height: "18px",
    "border-radius": "var(--cortex-radius-sm)",
    border: isChecked() || isIndeterminate()
      ? "none"
      : `1px solid ${focused() ? "var(--border-focus)" : "var(--border-default)"}`,
    background: isChecked() || isIndeterminate()
      ? "var(--accent-primary)"
      : hovered() && !local.disabled
        ? "var(--surface-hover)"
        : "transparent",
    color: "var(--cortex-text-primary)",
    "flex-shrink": "0",
    transition: "background 150ms ease, border 150ms ease",
    "box-shadow": focused() ? "0 0 0 2px var(--accent-muted)" : "none",
  });

  const labelContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
    "padding-top": "1px",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--text-primary)",
    "user-select": "none",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "12px",
    color: "var(--text-muted)",
    "user-select": "none",
  };

  const getAriaChecked = (): "true" | "false" | "mixed" => {
    if (isIndeterminate()) return "mixed";
    return isChecked() ? "true" : "false";
  };

  return (
    <div
      style={containerStyle}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        role="checkbox"
        aria-checked={getAriaChecked()}
        aria-disabled={local.disabled}
        aria-label={local["aria-label"] || local.label}
        tabIndex={local.disabled ? -1 : 0}
        style={checkboxStyle()}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <Show when={isChecked() && !isIndeterminate()}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L4.5 8.5L9.5 3.5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </Show>
        <Show when={isIndeterminate()}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6H9.5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </Show>
      </div>
      <Show when={local.label || local.description}>
        <div style={labelContainerStyle}>
          <Show when={local.label}>
            <span style={labelStyle}>{local.label}</span>
          </Show>
          <Show when={local.description}>
            <span style={descriptionStyle}>{local.description}</span>
          </Show>
        </div>
      </Show>
    </div>
  );
}


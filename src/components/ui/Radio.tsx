import { JSX, splitProps, Show, For, createSignal } from "solid-js";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Radio options */
  options: RadioOption[];
  /** Current value */
  value?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Name for form */
  name?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Layout direction */
  direction?: "horizontal" | "vertical";
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function RadioGroup(props: RadioGroupProps) {
  const [local] = splitProps(props, [
    "options", "value", "onChange", "name", "disabled", "direction", "style"
  ]);

  const direction = () => local.direction || "vertical";

  const handleSelect = (option: RadioOption) => {
    if (local.disabled || option.disabled) return;
    local.onChange?.(option.value);
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": direction() === "horizontal" ? "row" : "column",
    gap: direction() === "horizontal" ? "16px" : "8px",
    ...local.style,
  };

  return (
    <div role="radiogroup" style={containerStyle}>
      <For each={local.options}>
        {(option) => (
          <RadioItem
            option={option}
            selected={option.value === local.value}
            disabled={local.disabled || option.disabled}
            onSelect={() => handleSelect(option)}
          />
        )}
      </For>
    </div>
  );
}

interface RadioItemProps {
  option: RadioOption;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

function RadioItem(props: RadioItemProps) {
  const [focused, setFocused] = createSignal(false);
  const [hovered, setHovered] = createSignal(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (props.disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      props.onSelect();
    }
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "flex-start",
    gap: "8px",
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? "0.5" : "1",
  };

  const radioStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "18px",
    height: "18px",
    "border-radius": "var(--cortex-radius-full)",
    border: props.selected
      ? "none"
      : `1px solid ${focused() ? "var(--border-focus)" : "var(--border-default)"}`,
    background: props.selected
      ? "var(--accent-primary)"
      : hovered() && !props.disabled
        ? "var(--surface-hover)"
        : "transparent",
    "flex-shrink": "0",
    transition: "background 150ms ease, border 150ms ease",
    "box-shadow": focused() ? "0 0 0 2px var(--accent-muted)" : "none",
  });

  const dotStyle: JSX.CSSProperties = {
    width: "6px",
    height: "6px",
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--cortex-text-primary, var(--cortex-text-primary))",
  };

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

  return (
    <div
      style={containerStyle}
      onClick={props.onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        role="radio"
        aria-checked={props.selected}
        aria-disabled={props.disabled}
        tabIndex={props.disabled ? -1 : 0}
        style={radioStyle()}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <Show when={props.selected}>
          <div style={dotStyle} />
        </Show>
      </div>
      <Show when={props.option.label || props.option.description}>
        <div style={labelContainerStyle}>
          <Show when={props.option.label}>
            <span style={labelStyle}>{props.option.label}</span>
          </Show>
          <Show when={props.option.description}>
            <span style={descriptionStyle}>{props.option.description}</span>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export interface RadioProps {
  /** Checked state */
  checked?: boolean;
  /** Change handler */
  onChange?: (checked: boolean) => void;
  /** Label text */
  label?: string;
  /** Description text */
  description?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function Radio(props: RadioProps) {
  const [local] = splitProps(props, [
    "checked", "onChange", "label", "description", "disabled", "style"
  ]);

  return (
    <RadioItem
      option={{ value: "", label: local.label || "", description: local.description }}
      selected={local.checked ?? false}
      disabled={local.disabled}
      onSelect={() => local.onChange?.(!local.checked)}
    />
  );
}


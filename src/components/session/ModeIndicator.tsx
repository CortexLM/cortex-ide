import { JSX, For, Show, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";

export type SessionMode = "build" | "plan" | "spec";

interface ModeIndicatorProps {
  mode: SessionMode;
  onChange: (mode: SessionMode) => void;
  disabled?: boolean;
}

interface ModeConfig {
  value: SessionMode;
  label: string;
  icon: string;
  description: string;
  bgColor: string;
  textColor: string;
}

const MODES: ModeConfig[] = [
  {
    value: "build",
    label: "Build",
    icon: "hammer",
    description: "Execute changes immediately",
    bgColor: "color-mix(in srgb, var(--state-success) 15%, transparent)",
    textColor: "var(--state-success)",
  },
  {
    value: "plan",
    label: "Plan",
    icon: "clipboard-list",
    description: "Read-only exploration mode",
    bgColor: "color-mix(in srgb, var(--state-warning) 15%, transparent)",
    textColor: "var(--state-warning)",
  },
  {
    value: "spec",
    label: "Spec",
    icon: "file-lines",
    description: "Create implementation plans",
    bgColor: "color-mix(in srgb, var(--cortex-info) 15%, transparent)",
    textColor: "var(--cortex-info)",
  },
];

export function ModeIndicator(props: ModeIndicatorProps) {
  const [open, setOpen] = createSignal(false);

  const currentMode = () => MODES.find((m) => m.value === props.mode) || MODES[0];

  const handleSelect = (mode: SessionMode) => {
    if (props.disabled) return;
    props.onChange(mode);
    setOpen(false);
  };

  const triggerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "6px",
    padding: "6px 10px",
    background: currentMode().bgColor,
    color: currentMode().textColor,
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    "font-family": "var(--jb-font-ui)",
    "font-size": "12px",
    "font-weight": "500",
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? "0.5" : "1",
    transition: "filter 150ms ease",
  });

  const dropdownStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: "0",
    background: "var(--surface-card)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--jb-radius-md)",
    "box-shadow": "var(--shadow-popup)",
    "min-width": "220px",
    "z-index": "100",
    overflow: "hidden",
  };

  const menuItemStyle = (isActive: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "flex-start",
    gap: "12px",
    padding: "10px 14px",
    background: isActive ? "var(--surface-hover)" : "transparent",
    cursor: "pointer",
    transition: "background 150ms ease",
  });

  const iconContainerStyle = (config: ModeConfig): JSX.CSSProperties => ({
    width: "28px",
    height: "28px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: config.bgColor,
    color: config.textColor,
    "border-radius": "var(--jb-radius-sm)",
    "flex-shrink": "0",
  });

  const itemTextStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
    flex: "1",
  };

  const itemLabelStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--text-primary)",
  };

  const itemDescStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "11px",
    color: "var(--text-muted)",
  };

  const checkStyle: JSX.CSSProperties = {
    color: "var(--accent-primary)",
    "flex-shrink": "0",
    "align-self": "center",
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        style={triggerStyle()}
        onClick={() => !props.disabled && setOpen(!open())}
        onMouseEnter={(e) => {
          if (!props.disabled) {
            e.currentTarget.style.filter = "brightness(1.1)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "brightness(1)";
        }}
        disabled={props.disabled}
      >
        <Icon name={currentMode().icon as any} size={14} />
        <span>{currentMode().label}</span>
        <Icon name="chevron-down" size={10} />
      </button>

      <Show when={open()}>
        <div style={dropdownStyle}>
          <For each={MODES}>
            {(mode) => {
              const isActive = () => mode.value === props.mode;
              return (
                <div
                  style={menuItemStyle(isActive())}
                  onClick={() => handleSelect(mode.value)}
                  onMouseEnter={(e) => {
                    if (!isActive()) {
                      e.currentTarget.style.background = "var(--surface-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive()) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <div style={iconContainerStyle(mode)}>
                    <Icon name={mode.icon as any} size={14} />
                  </div>
                  <div style={itemTextStyle}>
                    <span style={itemLabelStyle}>{mode.label}</span>
                    <span style={itemDescStyle}>{mode.description}</span>
                  </div>
                  <Show when={isActive()}>
                    <div style={checkStyle}>
                      <Icon name="check" size={14} />
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}


import { Component, JSX, For } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import {
  useAccessibility,
  type FontScale,
  type FocusIndicatorStyle,
  type AudioSignalType,
} from "@/context/AccessibilityContext";

export interface AccessibilitySettingsProps {
  class?: string;
  style?: JSX.CSSProperties;
}

const FONT_SCALES: { value: FontScale; label: string }[] = [
  { value: 0.8, label: "80%" },
  { value: 0.9, label: "90%" },
  { value: 1.0, label: "100%" },
  { value: 1.1, label: "110%" },
  { value: 1.2, label: "120%" },
  { value: 1.3, label: "130%" },
  { value: 1.4, label: "140%" },
  { value: 1.5, label: "150%" },
];

const FOCUS_STYLES: { value: FocusIndicatorStyle; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "high-visibility", label: "High Visibility" },
  { value: "custom", label: "Custom" },
];

const AUDIO_SIGNALS: { type: AudioSignalType; label: string; icon: string }[] = [
  { type: "error", label: "Errors", icon: "circle-xmark" },
  { type: "warning", label: "Warnings", icon: "triangle-exclamation" },
  { type: "success", label: "Success", icon: "circle-check" },
  { type: "breakpointHit", label: "Breakpoint Hit", icon: "circle-dot" },
  { type: "taskComplete", label: "Task Complete", icon: "check" },
  { type: "notification", label: "Notifications", icon: "bell" },
];

export const AccessibilitySettings: Component<AccessibilitySettingsProps> = (props) => {
  const accessibility = useAccessibility();

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    gap: "24px",
    padding: "24px",
    background: "var(--cortex-bg-primary)",
    ...props.style,
  });

  const sectionStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "12px",
  };

  const sectionTitleStyle: JSX.CSSProperties = {
    "font-size": "14px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
  };

  const sectionDescStyle: JSX.CSSProperties = {
    "font-size": "12px",
    color: "var(--cortex-text-muted)",
    "margin-top": "-8px",
  };

  const toggleStyle = (_enabled: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "12px",
    background: "var(--cortex-bg-secondary)",
    "border-radius": "var(--cortex-radius-md)",
    cursor: "pointer",
  });

  const switchStyle = (enabled: boolean): JSX.CSSProperties => ({
    width: "36px",
    height: "20px",
    "border-radius": "10px",
    background: enabled ? "var(--cortex-accent-primary)" : "var(--cortex-bg-active)",
    position: "relative",
    transition: "background var(--cortex-transition-fast)",
    cursor: "pointer",
  });

  const switchKnobStyle = (enabled: boolean): JSX.CSSProperties => ({
    position: "absolute",
    top: "2px",
    left: enabled ? "18px" : "2px",
    width: "16px",
    height: "16px",
    "border-radius": "50%",
    background: "white",
    transition: "left var(--cortex-transition-fast)",
  });

  const selectStyle: JSX.CSSProperties = {
    padding: "8px 12px",
    "font-size": "12px",
    background: "var(--cortex-bg-secondary)",
    border: "1px solid var(--cortex-border-default)",
    "border-radius": "var(--cortex-radius-sm)",
    color: "var(--cortex-text-primary)",
    cursor: "pointer",
    outline: "none",
  };

  const sliderContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "12px",
    background: "var(--cortex-bg-secondary)",
    "border-radius": "var(--cortex-radius-md)",
  };

  const sliderStyle: JSX.CSSProperties = {
    flex: "1",
    height: "4px",
    "border-radius": "2px",
    background: "var(--cortex-bg-active)",
    cursor: "pointer",
    "-webkit-appearance": "none",
    appearance: "none",
  };

  const checkboxRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    background: "var(--cortex-bg-primary)",
    "border-radius": "var(--cortex-radius-sm)",
    cursor: "pointer",
  };

  const checkboxStyle = (checked: boolean): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    "border-radius": "var(--cortex-radius-sm)",
    border: `1px solid ${checked ? "var(--cortex-accent-primary)" : "var(--cortex-border-default)"}`,
    background: checked ? "var(--cortex-accent-primary)" : "transparent",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "flex-shrink": "0",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Visual Settings</div>

        <div
          style={toggleStyle(accessibility.screenReaderMode())}
          onClick={() => accessibility.toggleScreenReaderMode()}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
            <Icon name="eye" size={16} style={{ color: "var(--cortex-text-muted)" }} />
            <div>
              <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>
                Screen Reader Mode
              </div>
              <div style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
                Optimize for screen readers with enhanced ARIA
              </div>
            </div>
          </div>
          <div style={switchStyle(accessibility.screenReaderMode())}>
            <div style={switchKnobStyle(accessibility.screenReaderMode())} />
          </div>
        </div>

        <div
          style={toggleStyle(accessibility.highContrastMode())}
          onClick={() => accessibility.toggleHighContrast()}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
            <Icon name="circle-half-stroke" size={16} style={{ color: "var(--cortex-text-muted)" }} />
            <div>
              <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>
                High Contrast Mode
              </div>
              <div style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
                Increase contrast for better visibility
              </div>
            </div>
          </div>
          <div style={switchStyle(accessibility.highContrastMode())}>
            <div style={switchKnobStyle(accessibility.highContrastMode())} />
          </div>
        </div>

        <div
          style={toggleStyle(accessibility.reducedMotion())}
          onClick={() => accessibility.toggleReducedMotion()}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
            <Icon name="pause" size={16} style={{ color: "var(--cortex-text-muted)" }} />
            <div>
              <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>
                Reduced Motion
              </div>
              <div style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
                Minimize animations and transitions
              </div>
            </div>
          </div>
          <div style={switchStyle(accessibility.reducedMotion())}>
            <div style={switchKnobStyle(accessibility.reducedMotion())} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Font Size</div>
        <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
          <Icon name="text-size" size={16} style={{ color: "var(--cortex-text-muted)" }} />
          <select
            style={selectStyle}
            value={accessibility.fontScale()}
            onChange={(e) => accessibility.setFontScale(parseFloat(e.currentTarget.value) as FontScale)}
          >
            <For each={FONT_SCALES}>
              {(scale) => (
                <option value={scale.value}>{scale.label}</option>
              )}
            </For>
          </select>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Focus Indicator</div>
        <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
          <Icon name="crosshairs" size={16} style={{ color: "var(--cortex-text-muted)" }} />
          <select
            style={selectStyle}
            value={accessibility.focusIndicatorStyle()}
            onChange={(e) => accessibility.setFocusIndicatorStyle(e.currentTarget.value as FocusIndicatorStyle)}
          >
            <For each={FOCUS_STYLES}>
              {(style) => (
                <option value={style.value}>{style.label}</option>
              )}
            </For>
          </select>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Audio Signals</div>
        <div style={sectionDescStyle}>
          Play sounds for various events
        </div>

        <div
          style={toggleStyle(accessibility.audioSignalsEnabled())}
          onClick={() => accessibility.toggleAudioSignals()}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
            <Icon name="volume-high" size={16} style={{ color: "var(--cortex-text-muted)" }} />
            <div>
              <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>
                Enable Audio Signals
              </div>
            </div>
          </div>
          <div style={switchStyle(accessibility.audioSignalsEnabled())}>
            <div style={switchKnobStyle(accessibility.audioSignalsEnabled())} />
          </div>
        </div>

        <div style={sliderContainerStyle}>
          <Icon name="volume-low" size={14} style={{ color: "var(--cortex-text-muted)" }} />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={accessibility.audioVolume()}
            onInput={(e) => accessibility.setAudioVolume(parseFloat(e.currentTarget.value))}
            style={sliderStyle}
            disabled={!accessibility.audioSignalsEnabled()}
          />
          <Icon name="volume-high" size={14} style={{ color: "var(--cortex-text-muted)" }} />
          <span style={{ "font-size": "11px", color: "var(--cortex-text-muted)", width: "32px" }}>
            {Math.round(accessibility.audioVolume() * 100)}%
          </span>
        </div>

        <div style={{ ...sectionStyle, gap: "4px", background: "var(--cortex-bg-secondary)", padding: "8px", "border-radius": "var(--cortex-radius-md)" }}>
          <For each={AUDIO_SIGNALS}>
            {(signal) => (
              <div
                style={checkboxRowStyle}
                onClick={() => accessibility.setAudioSignalEnabled(signal.type, !accessibility.state.audioSignals[signal.type])}
              >
                <div style={checkboxStyle(accessibility.state.audioSignals[signal.type])}>
                  {accessibility.state.audioSignals[signal.type] && (
                    <Icon name="check" size={10} style={{ color: "white" }} />
                  )}
                </div>
                <Icon name={signal.icon} size={12} style={{ color: "var(--cortex-text-muted)" }} />
                <span style={{ "font-size": "12px", color: "var(--cortex-text-primary)" }}>
                  {signal.label}
                </span>
              </div>
            )}
          </For>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Keyboard</div>

        <div
          style={toggleStyle(accessibility.keyboardHintsVisible())}
          onClick={() => accessibility.toggleKeyboardHints()}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
            <Icon name="keyboard" size={16} style={{ color: "var(--cortex-text-muted)" }} />
            <div>
              <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>
                Show Keyboard Hints
              </div>
              <div style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
                Display keyboard shortcuts on UI elements
              </div>
            </div>
          </div>
          <div style={switchStyle(accessibility.keyboardHintsVisible())}>
            <div style={switchKnobStyle(accessibility.keyboardHintsVisible())} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Monaco Editor Accessibility</div>
        <div style={sectionDescStyle}>
          Configure Monaco editor accessibility support
        </div>

        <div
          style={toggleStyle(accessibility.screenReaderMode())}
          onClick={() => accessibility.toggleScreenReaderMode()}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
            <Icon name="code" size={16} style={{ color: "var(--cortex-text-muted)" }} />
            <div>
              <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>
                Editor Screen Reader Support
              </div>
              <div style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
                Set Monaco accessibilitySupport to 'on' for screen readers
              </div>
            </div>
          </div>
          <div style={switchStyle(accessibility.screenReaderMode())}>
            <div style={switchKnobStyle(accessibility.screenReaderMode())} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>System Integration</div>

        <div style={{
          padding: "12px",
          background: "var(--cortex-bg-secondary)",
          "border-radius": "var(--cortex-radius-md)",
          display: "flex",
          "flex-direction": "column",
          gap: "8px",
        }}>
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <Icon name="circle-info" size={14} style={{ color: "var(--cortex-text-muted)" }} />
            <span style={{ "font-size": "12px", color: "var(--cortex-text-muted)" }}>
              System prefers reduced motion: {accessibility.systemPrefersReducedMotion() ? "Yes" : "No"}
            </span>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <Icon name="circle-info" size={14} style={{ color: "var(--cortex-text-muted)" }} />
            <span style={{ "font-size": "12px", color: "var(--cortex-text-muted)" }}>
              High contrast auto-detection is {accessibility.highContrastMode() ? "active" : "inactive"}
            </span>
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>ARIA Labels Audit</div>
        <div style={sectionDescStyle}>
          Status of ARIA label coverage across components
        </div>

        <div style={{
          padding: "12px",
          background: "var(--cortex-bg-secondary)",
          "border-radius": "var(--cortex-radius-md)",
          display: "flex",
          "flex-direction": "column",
          gap: "6px",
        }}>
          <For each={[
            { name: "Editor", status: "complete" as const },
            { name: "Terminal", status: "complete" as const },
            { name: "File Explorer", status: "complete" as const },
            { name: "Activity Bar", status: "complete" as const },
            { name: "Status Bar", status: "complete" as const },
            { name: "Chat Panel", status: "partial" as const },
            { name: "Settings", status: "complete" as const },
            { name: "Debug Panel", status: "partial" as const },
          ]}>
            {(item) => (
              <div style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: "4px 0",
              }}>
                <span style={{ "font-size": "12px", color: "var(--cortex-text-primary)" }}>
                  {item.name}
                </span>
                <span style={{
                  "font-size": "11px",
                  padding: "2px 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: item.status === "complete"
                    ? "rgba(75, 210, 143, 0.15)"
                    : "rgba(255, 193, 7, 0.15)",
                  color: item.status === "complete"
                    ? "rgb(75, 210, 143)"
                    : "rgb(255, 193, 7)",
                }}>
                  {item.status === "complete" ? "✓ Complete" : "◐ Partial"}
                </span>
              </div>
            )}
          </For>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <Button variant="secondary" size="sm" onClick={() => accessibility.resetToDefaults()}>
          <Icon name="rotate-left" size={14} />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};

export default AccessibilitySettings;

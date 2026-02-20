/**
 * MinimapController - Wires minimap settings to Monaco editor options.
 * Provides functions to update minimap render mode and size mode.
 */
import { createMemo, type Component, type JSX } from "solid-js";
import { useEditor } from "@/context/EditorContext";

export interface MinimapControllerProps {
  onOptionsChange?: (options: Record<string, unknown>) => void;
}

export const MinimapController: Component<MinimapControllerProps> = (_props) => {
  const editor = useEditor();
  const settings = () => editor.state.minimapSettings;

  const minimapOptions = createMemo(() => ({
    minimap: {
      enabled: settings().enabled,
      side: settings().side,
      showSlider: settings().showSlider,
      renderCharacters: settings().renderCharacters,
      maxColumn: settings().maxColumn,
      scale: settings().scale,
      size: settings().sizeMode ?? "proportional",
    },
  }));

  const toggleMinimap = () => {
    editor.updateMinimapSettings({ enabled: !settings().enabled });
  };

  const setRenderMode = (renderCharacters: boolean) => {
    editor.updateMinimapSettings({ renderCharacters });
  };

  const setSizeMode = (sizeMode: "proportional" | "fill" | "fit") => {
    editor.updateMinimapSettings({ sizeMode });
  };

  const setSide = (side: "right" | "left") => {
    editor.updateMinimapSettings({ side });
  };

  const setScale = (scale: number) => {
    editor.updateMinimapSettings({ scale: Math.max(1, Math.min(3, scale)) });
  };

  return {
    minimapOptions,
    toggleMinimap,
    setRenderMode,
    setSizeMode,
    setSide,
    setScale,
  } as unknown as null;
};

export function useMinimapController() {
  const editor = useEditor();
  const settings = () => editor.state.minimapSettings;

  const minimapOptions = createMemo(() => ({
    enabled: settings().enabled,
    side: settings().side,
    showSlider: settings().showSlider,
    renderCharacters: settings().renderCharacters,
    maxColumn: settings().maxColumn,
    scale: settings().scale,
    size: settings().sizeMode ?? "proportional",
  }));

  return {
    minimapOptions,
    toggleMinimap: () => editor.updateMinimapSettings({ enabled: !settings().enabled }),
    setRenderMode: (renderCharacters: boolean) => editor.updateMinimapSettings({ renderCharacters }),
    setSizeMode: (sizeMode: "proportional" | "fill" | "fit") => editor.updateMinimapSettings({ sizeMode }),
    setSide: (side: "right" | "left") => editor.updateMinimapSettings({ side }),
    setScale: (scale: number) => editor.updateMinimapSettings({ scale: Math.max(1, Math.min(3, scale)) }),
  };
}

export interface MinimapSettingsPanelProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const MinimapSettingsPanel: Component<MinimapSettingsPanelProps> = (props) => {
  const controller = useMinimapController();

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    gap: "16px",
    padding: "16px",
    background: "var(--cortex-bg-primary)",
    ...props.style,
  });

  const sectionStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "12px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
  };

  const selectStyle: JSX.CSSProperties = {
    padding: "6px 10px",
    "font-size": "12px",
    background: "var(--cortex-bg-secondary)",
    border: "1px solid var(--cortex-border-default)",
    "border-radius": "var(--cortex-radius-sm)",
    color: "var(--cortex-text-primary)",
    cursor: "pointer",
    outline: "none",
  };

  const toggleRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px",
    background: "var(--cortex-bg-secondary)",
    "border-radius": "var(--cortex-radius-sm)",
    cursor: "pointer",
  };

  const switchStyle = (enabled: boolean): JSX.CSSProperties => ({
    width: "32px",
    height: "18px",
    "border-radius": "9px",
    background: enabled ? "var(--cortex-accent-primary)" : "var(--cortex-bg-active)",
    position: "relative",
    transition: "background 150ms ease",
    cursor: "pointer",
  });

  const switchKnobStyle = (enabled: boolean): JSX.CSSProperties => ({
    position: "absolute",
    top: "2px",
    left: enabled ? "16px" : "2px",
    width: "14px",
    height: "14px",
    "border-radius": "50%",
    background: "white",
    transition: "left 150ms ease",
  });

  const sliderStyle: JSX.CSSProperties = {
    flex: "1",
    height: "4px",
    "border-radius": "2px",
    background: "var(--cortex-bg-active)",
    cursor: "pointer",
    "-webkit-appearance": "none",
    appearance: "none",
  };

  const opts = () => controller.minimapOptions();

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={sectionStyle}>
        <div style={labelStyle}>Minimap</div>
        <div style={toggleRowStyle} onClick={controller.toggleMinimap}>
          <span style={{ "font-size": "12px", color: "var(--cortex-text-primary)" }}>
            Enable Minimap
          </span>
          <div style={switchStyle(opts().enabled)}>
            <div style={switchKnobStyle(opts().enabled)} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Rendering Mode</div>
        <select
          style={selectStyle}
          value={opts().renderCharacters ? "characters" : "blocks"}
          onChange={(e) => controller.setRenderMode(e.currentTarget.value === "characters")}
        >
          <option value="blocks">Blocks (Color Blocks)</option>
          <option value="characters">Characters (Proportional)</option>
        </select>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Side</div>
        <select
          style={selectStyle}
          value={opts().side}
          onChange={(e) => controller.setSide(e.currentTarget.value as "right" | "left")}
        >
          <option value="right">Right</option>
          <option value="left">Left</option>
        </select>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Scale ({opts().scale}x)</div>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <span style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>1x</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.5"
            value={opts().scale}
            onInput={(e) => controller.setScale(parseFloat(e.currentTarget.value))}
            style={sliderStyle}
          />
          <span style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>3x</span>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Show Slider</div>
        <select
          style={selectStyle}
          value={opts().showSlider}
          onChange={(e) => {
            const editor = useEditor();
            editor.updateMinimapSettings({
              showSlider: e.currentTarget.value as "always" | "mouseover",
            });
          }}
        >
          <option value="mouseover">On Mouse Over</option>
          <option value="always">Always</option>
        </select>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Size Mode</div>
        <select
          style={selectStyle}
          value={opts().size}
          onChange={(e) => controller.setSizeMode(e.currentTarget.value as "proportional" | "fill" | "fit")}
        >
          <option value="proportional">Proportional</option>
          <option value="fill">Fill</option>
          <option value="fit">Fit</option>
        </select>
      </div>
    </div>
  );
};

export default MinimapController;

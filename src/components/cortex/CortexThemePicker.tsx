import { Component, For, Show, createSignal, JSX } from "solid-js";
import { useColorTheme, type ColorThemeId } from "@/context/CortexColorThemeContext";
import { CortexIcon } from "./primitives/CortexIcon";

interface ThemePreset { id: ColorThemeId; label: string; bgColor: string; sidebarColor: string; description: string }

const THEME_PRESETS: ThemePreset[] = [
  { id: "01", label: "Default Dark", bgColor: "#141415", sidebarColor: "#1C1C1D", description: "Standard dark theme" },
  { id: "02", label: "Deeper Dark", bgColor: "#111112", sidebarColor: "#161617", description: "Darker background" },
  { id: "03", label: "Midnight", bgColor: "#0A0A0B", sidebarColor: "#0F0F10", description: "Darkest variant" },
  { id: "04", label: "Soft Dark", bgColor: "#1D1D1D", sidebarColor: "#222222", description: "Lighter dark theme" },
  { id: "05", label: "Purple Haze", bgColor: "#131217", sidebarColor: "#191A1E", description: "Purple tint" },
];

interface AccentSwatch { color: string; label: string }

const ACCENT_SWATCHES: AccentSwatch[] = [
  { color: "#B2FF22", label: "Lime" },
  { color: "#FEAB78", label: "Orange" },
  { color: "#FFB7FA", label: "Pink" },
  { color: "#66BFFF", label: "Blue" },
  { color: "#FF7070", label: "Red" },
  { color: "#FEC55A", label: "Yellow" },
  { color: "#42A5F5", label: "Cyan" },
  { color: "#9491FF", label: "Purple" },
];

const SEC: JSX.CSSProperties = { padding: "16px", display: "flex", "flex-direction": "column", gap: "8px" };
const SEC_TITLE: JSX.CSSProperties = { "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: "var(--cortex-text-inactive)", "margin-bottom": "4px" };

export const CortexThemePicker: Component = () => {
  const { colorTheme, setColorTheme, accentColor, setAccentColor, customCss, setCustomCss } = useColorTheme();
  const [cssExpanded, setCssExpanded] = createSignal(false);
  const [cssBuffer, setCssBuffer] = createSignal(customCss());

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", background: "var(--cortex-bg-secondary)", color: "var(--cortex-text-primary)", "font-family": "var(--cortex-font-sans)", overflow: "auto" }}>
      <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-border-default)", "font-weight": "500", "font-size": "13px" }}>
        Color Themes
      </div>

      <div style={SEC}>
        <span style={SEC_TITLE}>Theme</span>
        <For each={THEME_PRESETS}>
          {(preset) => (
            <ThemeCard preset={preset} isActive={colorTheme() === preset.id} accent={accentColor()} onClick={() => setColorTheme(preset.id)} />
          )}
        </For>
      </div>

      <div style={{ ...SEC, "border-top": "1px solid var(--cortex-border-default)" }}>
        <span style={SEC_TITLE}>Accent Color</span>
        <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px" }}>
          <For each={ACCENT_SWATCHES}>
            {(s) => (
              <button onClick={() => setAccentColor(s.color)} title={s.label} style={{
                width: "32px", height: "32px", "border-radius": "50%", background: s.color, padding: "0", cursor: "pointer", transition: "all 150ms ease",
                border: accentColor() === s.color ? "3px solid var(--cortex-text-primary)" : "2px solid transparent",
                "box-shadow": accentColor() === s.color ? `0 0 0 2px ${s.color}40` : "none",
              }} />
            )}
          </For>
        </div>
        <div style={{ "margin-top": "4px", display: "flex", "align-items": "center", gap: "8px" }}>
          <label style={{ "font-size": "12px", color: "var(--cortex-text-secondary)" }}>Custom:</label>
          <input type="color" value={accentColor()} onInput={(e) => setAccentColor(e.currentTarget.value)} style={{
            width: "28px", height: "28px", border: "1px solid var(--cortex-border-default)", "border-radius": "var(--cortex-radius-sm)", background: "transparent", cursor: "pointer", padding: "2px",
          }} />
          <span style={{ "font-size": "12px", color: "var(--cortex-text-inactive)", "font-family": "var(--cortex-font-mono, monospace)" }}>{accentColor()}</span>
        </div>
      </div>

      <div style={{ ...SEC, "border-top": "1px solid var(--cortex-border-default)" }}>
        <span style={SEC_TITLE}>Preview</span>
        <LivePreview bgColor={THEME_PRESETS.find(p => p.id === colorTheme())?.bgColor || "#141415"} accent={accentColor()} />
      </div>

      <div style={{ ...SEC, "border-top": "1px solid var(--cortex-border-default)" }}>
        <button onClick={() => setCssExpanded(!cssExpanded())} style={{
          display: "flex", "align-items": "center", gap: "6px", background: "none", border: "none", color: "var(--cortex-text-inactive)", cursor: "pointer", padding: "0",
          "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px",
        }}>
          <CortexIcon name="chevron-right" size={10} style={{ transform: cssExpanded() ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
          Custom CSS Overrides
        </button>
        <Show when={cssExpanded()}>
          <textarea value={cssBuffer()} onInput={(e) => setCssBuffer(e.currentTarget.value)} placeholder={":root {\n  --cortex-bg-primary: #1a1a2e;\n}"} rows={6} style={{
            width: "100%", background: "var(--cortex-bg-primary)", color: "var(--cortex-text-primary)", border: "1px solid var(--cortex-border-default)",
            "border-radius": "var(--cortex-radius-sm)", padding: "8px", "font-family": "var(--cortex-font-mono, monospace)", "font-size": "12px", resize: "vertical",
          }} />
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => { setCustomCss(cssBuffer()); }} style={tinyBtn(accentColor())}>Apply</button>
            <button onClick={() => { setCssBuffer(""); setCustomCss(""); }} style={tinyBtn("var(--cortex-text-inactive)")}>Reset</button>
          </div>
        </Show>
      </div>

      <div style={{ padding: "12px 16px", "margin-top": "auto", "border-top": "1px solid var(--cortex-border-default)", color: "var(--cortex-text-secondary)", "font-size": "12px" }}>
        Themes adjust the background and accent colors across the entire application.
      </div>
    </div>
  );
};

const tinyBtn = (color: string): JSX.CSSProperties => ({
  padding: "4px 12px", background: "transparent", border: `1px solid ${color}`, "border-radius": "var(--cortex-radius-sm)", color, cursor: "pointer", "font-size": "12px",
});

const ThemeCard: Component<{ preset: ThemePreset; isActive: boolean; accent: string; onClick: () => void }> = (props) => {
  const [hovered, setHovered] = createSignal(false);
  return (
    <button onClick={props.onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      display: "flex", "align-items": "center", gap: "12px", padding: "10px 12px", width: "100%", "text-align": "left", cursor: "pointer", transition: "all 150ms ease",
      background: props.isActive ? "var(--cortex-bg-hover)" : hovered() ? "rgba(255,255,255,0.03)" : "transparent",
      border: props.isActive ? `1px solid ${props.accent}` : "1px solid var(--cortex-border-default)", "border-radius": "var(--cortex-radius-md)",
    }}>
      <div style={{ display: "flex", gap: "2px", "flex-shrink": "0" }}>
        <div style={{ width: "12px", height: "28px", "border-radius": "3px 0 0 3px", background: props.preset.sidebarColor }} />
        <div style={{ width: "20px", height: "28px", "border-radius": "0 3px 3px 0", background: props.preset.bgColor }} />
      </div>
      <div style={{ flex: "1", "min-width": "0" }}>
        <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--cortex-text-primary)" }}>{props.preset.label}</div>
        <div style={{ "font-size": "11px", color: "var(--cortex-text-secondary)", "margin-top": "2px" }}>{props.preset.description}</div>
      </div>
      <Show when={props.isActive}>
        <div style={{ width: "8px", height: "8px", "border-radius": "50%", background: props.accent, "flex-shrink": "0" }} />
      </Show>
    </button>
  );
};

const LivePreview: Component<{ bgColor: string; accent: string }> = (props) => (
  <div style={{ display: "flex", gap: "2px", height: "64px", "border-radius": "var(--cortex-radius-md)", overflow: "hidden", border: "1px solid var(--cortex-border-default)" }}>
    <div style={{ width: "28px", background: props.bgColor, display: "flex", "flex-direction": "column", "align-items": "center", padding: "6px 0", gap: "4px" }}>
      <div style={{ width: "10px", height: "10px", "border-radius": "3px", background: props.accent }} />
      <div style={{ width: "10px", height: "10px", "border-radius": "3px", background: "rgba(255,255,255,0.15)" }} />
      <div style={{ width: "10px", height: "10px", "border-radius": "3px", background: "rgba(255,255,255,0.15)" }} />
    </div>
    <div style={{ flex: "1", background: props.bgColor, display: "flex", "flex-direction": "column", padding: "6px 8px", gap: "3px" }}>
      <div style={{ height: "6px", width: "60%", "border-radius": "2px", background: props.accent, opacity: "0.7" }} />
      <div style={{ height: "4px", width: "80%", "border-radius": "2px", background: "rgba(255,255,255,0.12)" }} />
      <div style={{ height: "4px", width: "50%", "border-radius": "2px", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ height: "4px", width: "70%", "border-radius": "2px", background: "rgba(255,255,255,0.1)" }} />
    </div>
  </div>
);

export default CortexThemePicker;

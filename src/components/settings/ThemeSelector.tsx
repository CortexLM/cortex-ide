import { createSignal, createMemo, For, Show, type JSX } from "solid-js";
import { useTheme } from "@/context/ThemeContext";
import type { Theme, PluginThemeContribution } from "@/context/theme/types";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

interface BuiltinEntry { id: Theme; name: string; type: "dark" | "light" | "system"; description: string }

const BUILTIN_THEMES: BuiltinEntry[] = [
  { id: "dark", name: "Dark+", type: "dark", description: "Default dark color theme" },
  { id: "light", name: "Light+", type: "light", description: "Default light color theme" },
  { id: "system", name: "System", type: "system", description: "Follow OS color scheme" },
  { id: "high-contrast", name: "High Contrast", type: "dark", description: "High contrast dark theme" },
  { id: "high-contrast-light", name: "High Contrast Light", type: "light", description: "High contrast light theme" },
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  dark: { bg: "rgba(99,102,241,0.15)", text: "#818cf8" },
  light: { bg: "rgba(250,204,21,0.15)", text: "#facc15" },
  system: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
  hc: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  hcLight: { bg: "rgba(251,146,60,0.15)", text: "#fb923c" },
};

const SWATCHES: Record<string, string[]> = {
  dark: ["#1e1e1e", "#252526", "#3c3c3c", "#569cd6", "#4ec9b0", "#ce9178"],
  light: ["#ffffff", "#f3f3f3", "#e8e8e8", "#0000ff", "#267f99", "#a31515"],
  hcDark: ["#000000", "#1a1a1a", "#6fc3df", "#ffd700", "#f48771", "#d7ba7d"],
  hcLight: ["#ffffff", "#f8f8f8", "#0f4a85", "#b5200d", "#185e73", "#000000"],
};

function getSwatches(id: string, type: string): string[] {
  if (id === "high-contrast") return SWATCHES.hcDark;
  if (id === "high-contrast-light") return SWATCHES.hcLight;
  return type === "light" || type === "hcLight" ? SWATCHES.light : SWATCHES.dark;
}

function typeBadgeLabel(type: string): string {
  if (type === "hc") return "HC";
  if (type === "hcLight") return "HC Light";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// ============================================================================
// Styles
// ============================================================================

const panelStyle: JSX.CSSProperties = {
  display: "flex", "flex-direction": "column", gap: "16px", padding: "16px",
  background: "var(--vscode-settings-editor-background, var(--surface-panel))",
  color: tokens.colors.text.primary, "font-size": "13px",
};

const searchInputStyle: JSX.CSSProperties = {
  width: "100%", padding: "6px 8px 6px 30px",
  background: tokens.colors.surface.input,
  border: `1px solid ${tokens.colors.border.default}`,
  "border-radius": tokens.radius.sm, color: tokens.colors.text.primary,
  "font-size": "12px", outline: "none",
};

const gridStyle: JSX.CSSProperties = {
  display: "grid", "grid-template-columns": "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px",
};

const cardStyle = (active: boolean): JSX.CSSProperties => ({
  display: "flex", "flex-direction": "column", gap: "8px",
  padding: "12px", cursor: "pointer", position: "relative",
  "border-radius": tokens.radius.md,
  border: active ? `2px solid ${tokens.colors.accent.primary}` : `1px solid ${tokens.colors.border.default}`,
  background: active ? tokens.colors.surface.active : tokens.colors.surface.card,
  transition: "border-color 0.15s, background 0.15s",
});

const swatchStyle = (color: string): JSX.CSSProperties => ({
  width: "16px", height: "16px", "border-radius": "3px",
  background: color, border: "1px solid rgba(128,128,128,0.3)", "flex-shrink": "0",
});

// ============================================================================
// Sub-Components
// ============================================================================

function ThemeCard(props: {
  name: string; description: string; type: string; swatches: string[];
  active: boolean; onClick: () => void;
  onMouseEnter?: () => void; onMouseLeave?: () => void;
}) {
  const c = () => TYPE_COLORS[props.type] ?? TYPE_COLORS.dark;
  return (
    <div style={cardStyle(props.active)} onClick={props.onClick}
      onMouseEnter={props.onMouseEnter} onMouseLeave={props.onMouseLeave} role="button" tabIndex={0}>
      <Show when={props.active}>
        <div style={{ position: "absolute", top: "8px", right: "8px", width: "20px", height: "20px",
          "border-radius": tokens.radius.full, background: tokens.colors.accent.primary,
          display: "flex", "align-items": "center", "justify-content": "center" }}>
          <Icon name="check" style={{ width: "12px", height: "12px", color: "#fff" }} />
        </div>
      </Show>
      <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
        <span style={{ "font-size": "13px", "font-weight": "600", color: tokens.colors.text.primary }}>{props.name}</span>
        <span style={{ display: "inline-flex", "align-items": "center", padding: "1px 6px",
          "border-radius": tokens.radius.full, background: c().bg, color: c().text,
          "font-size": "10px", "font-weight": "600" }}>{typeBadgeLabel(props.type)}</span>
      </div>
      <span style={{ "font-size": "11px", color: tokens.colors.text.muted, "line-height": "1.4" }}>{props.description}</span>
      <div style={{ display: "flex", gap: "4px", "margin-top": "4px" }}>
        <For each={props.swatches}>{(color) => <div style={swatchStyle(color)} />}</For>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ThemeSelector() {
  const themeCtx = useTheme();
  const [search, setSearch] = createSignal("");

  const filteredBuiltin = createMemo(() => {
    const q = search().toLowerCase().trim();
    return q ? BUILTIN_THEMES.filter((t) => t.name.toLowerCase().includes(q)) : BUILTIN_THEMES;
  });

  const filteredPlugins = createMemo(() => {
    const q = search().toLowerCase().trim();
    const themes = themeCtx.pluginThemes();
    return q ? themes.filter((t) => t.name.toLowerCase().includes(q)) : themes;
  });

  const customThemes = createMemo(() => {
    const q = search().toLowerCase().trim();
    const vscode = themeCtx.activeVSCodeTheme();
    if (!vscode) return [] as { name: string; id: string }[];
    if (q && !vscode.name.toLowerCase().includes(q)) return [] as { name: string; id: string }[];
    return [{ name: vscode.name, id: "vscode-custom" }];
  });

  const pluginTypeKey = (t: PluginThemeContribution): string => {
    if (t.type === "hc") return "hc";
    if (t.type === "hcLight") return "hcLight";
    return t.type;
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", "align-items": "center", gap: "8px",
        "padding-bottom": "8px", "border-bottom": `1px solid ${tokens.colors.border.default}` }}>
        <Icon name="palette" style={{ width: "16px", height: "16px", color: tokens.colors.accent.primary }} />
        <span style={{ "font-weight": "600" }}>Theme Selector</span>
      </div>

      <div style={{ position: "relative" } as JSX.CSSProperties}>
        <Icon name="magnifying-glass" style={{ position: "absolute", left: "8px", top: "7px",
          width: "14px", height: "14px", color: tokens.colors.text.muted } as JSX.CSSProperties} />
        <input type="text" placeholder="Search themes..." value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)} style={searchInputStyle} />
      </div>

      <Show when={filteredBuiltin().length > 0}>
        <div>
          <div style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase",
            "letter-spacing": "0.05em", color: tokens.colors.text.muted, "margin-bottom": "8px" }}>Built-in Themes</div>
          <div style={gridStyle}>
            <For each={filteredBuiltin()}>{(entry) => (
              <ThemeCard name={entry.name} description={entry.description} type={entry.type}
                swatches={getSwatches(entry.id, entry.type)} active={themeCtx.theme() === entry.id}
                onClick={() => themeCtx.setTheme(entry.id)}
                onMouseEnter={() => themeCtx.startPreview(entry.id)}
                onMouseLeave={() => themeCtx.stopPreview()} />
            )}</For>
          </div>
        </div>
      </Show>

      <Show when={filteredPlugins().length > 0}>
        <div>
          <div style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase",
            "letter-spacing": "0.05em", color: tokens.colors.text.muted, "margin-bottom": "8px" }}>Plugin Themes</div>
          <div style={gridStyle}>
            <For each={filteredPlugins()}>{(plugin) => (
              <ThemeCard name={plugin.name} description={`${plugin.type} theme from plugin`}
                type={pluginTypeKey(plugin)} swatches={getSwatches(plugin.id, plugin.type)}
                active={false} onClick={() => themeCtx.applyPluginTheme(plugin.id)} />
            )}</For>
          </div>
        </div>
      </Show>

      <Show when={customThemes().length > 0}>
        <div>
          <div style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase",
            "letter-spacing": "0.05em", color: tokens.colors.text.muted, "margin-bottom": "8px" }}>Custom Themes</div>
          <div style={gridStyle}>
            <For each={customThemes()}>{(custom) => (
              <ThemeCard name={custom.name} description="VS Code extension theme"
                type={themeCtx.isDark() ? "dark" : "light"}
                swatches={themeCtx.isDark() ? SWATCHES.dark : SWATCHES.light}
                active={true} onClick={() => themeCtx.clearVSCodeExtensionTheme()} />
            )}</For>
          </div>
        </div>
      </Show>

      <Show when={filteredBuiltin().length === 0 && filteredPlugins().length === 0 && customThemes().length === 0}>
        <div style={{ padding: "24px", "text-align": "center", color: tokens.colors.text.muted }}>
          No themes match your search
        </div>
      </Show>
    </div>
  );
}

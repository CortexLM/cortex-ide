import { createSignal, createMemo, Show, For, type JSX } from "solid-js";
import { useTheme } from "@/context/ThemeContext";
import type { ColorCategory } from "@/context/theme/types";
import {
  UI_COLOR_TOKENS, EDITOR_COLOR_TOKENS,
  SYNTAX_COLOR_TOKENS, TERMINAL_COLOR_TOKENS,
} from "@/context/theme/colorTokens";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

interface CategoryTab { value: ColorCategory; label: string; icon: string }
const CATEGORIES: CategoryTab[] = [
  { value: "ui", label: "UI", icon: "window-maximize" },
  { value: "editor", label: "Editor", icon: "code" },
  { value: "syntax", label: "Syntax", icon: "highlighter" },
  { value: "terminal", label: "Terminal", icon: "terminal" },
];
const TOKEN_MAP: Record<ColorCategory, typeof UI_COLOR_TOKENS> = {
  ui: UI_COLOR_TOKENS, editor: EDITOR_COLOR_TOKENS,
  syntax: SYNTAX_COLOR_TOKENS, terminal: TERMINAL_COLOR_TOKENS,
};

interface ComponentColorGroup { label: string; icon: string; tokens: Array<{ key: string; label: string; description: string }> }

const COMPONENT_COLORS: ComponentColorGroup[] = [
  { label: "Activity Bar", icon: "bars", tokens: [
    { key: "activityBar.background", label: "Background", description: "Activity bar background color" },
    { key: "activityBar.foreground", label: "Foreground", description: "Activity bar foreground color" },
    { key: "activityBar.border", label: "Border", description: "Activity bar border color" },
    { key: "activityBarBadge.background", label: "Badge Background", description: "Badge background on activity bar" },
  ] },
  { label: "Status Bar", icon: "rectangle-wide", tokens: [
    { key: "statusBar.background", label: "Background", description: "Status bar background color" },
    { key: "statusBar.foreground", label: "Foreground", description: "Status bar foreground color" },
    { key: "statusBar.border", label: "Border", description: "Status bar border color" },
    { key: "statusBar.debuggingBackground", label: "Debugging", description: "Status bar color when debugging" },
  ] },
  { label: "Title Bar", icon: "window-maximize", tokens: [
    { key: "titleBar.activeBackground", label: "Active Background", description: "Title bar background when active" },
    { key: "titleBar.activeForeground", label: "Active Foreground", description: "Title bar text when active" },
    { key: "titleBar.inactiveBackground", label: "Inactive Background", description: "Title bar background when inactive" },
    { key: "titleBar.border", label: "Border", description: "Title bar border color" },
  ] },
  { label: "Sidebar", icon: "sidebar", tokens: [
    { key: "sideBar.background", label: "Background", description: "Sidebar background color" },
    { key: "sideBar.foreground", label: "Foreground", description: "Sidebar foreground color" },
    { key: "sideBar.border", label: "Border", description: "Sidebar border color" },
    { key: "sideBarTitle.foreground", label: "Title", description: "Sidebar title text color" },
  ] },
];

const panelStyle: JSX.CSSProperties = {
  display: "flex", "flex-direction": "column", gap: "12px", padding: "16px",
  background: "var(--vscode-settings-editor-background, var(--surface-panel))",
  color: tokens.colors.text.primary, "font-size": "13px",
};
const headerStyle: JSX.CSSProperties = {
  display: "flex", "align-items": "center", "justify-content": "space-between",
  "padding-bottom": "8px", "border-bottom": `1px solid ${tokens.colors.border.default}`,
};
const tabBarStyle: JSX.CSSProperties = {
  display: "flex", gap: "2px", "border-radius": tokens.radius.sm,
  padding: "2px", background: tokens.colors.surface.active,
};
const tabStyle = (active: boolean): JSX.CSSProperties => ({
  display: "flex", "align-items": "center", gap: "4px", padding: "5px 10px",
  border: "none", "border-radius": tokens.radius.sm,
  background: active ? tokens.colors.accent.primary : "transparent",
  color: active ? "#fff" : tokens.colors.text.secondary,
  cursor: "pointer", "font-size": "11px", "font-weight": active ? "600" : "400",
});
const searchInputStyle: JSX.CSSProperties = {
  width: "100%", padding: "6px 8px 6px 30px",
  background: tokens.colors.surface.input, border: `1px solid ${tokens.colors.border.default}`,
  "border-radius": tokens.radius.sm, color: tokens.colors.text.primary,
  "font-size": "12px", outline: "none",
};
const tokenRowStyle: JSX.CSSProperties = {
  display: "flex", "align-items": "center", gap: "8px",
  padding: "6px 8px", "border-radius": tokens.radius.sm,
};
const swatchStyle = (color: string): JSX.CSSProperties => ({
  width: "24px", height: "24px", "border-radius": tokens.radius.sm,
  background: color, border: "1px solid rgba(128,128,128,0.3)",
  "flex-shrink": "0", cursor: "pointer", padding: "0",
});
const badgeStyle: JSX.CSSProperties = {
  display: "inline-flex", "align-items": "center", "justify-content": "center",
  "min-width": "18px", height: "18px", padding: "0 5px",
  "border-radius": tokens.radius.full, background: tokens.colors.accent.muted,
  color: tokens.colors.accent.primary, "font-size": "10px", "font-weight": "600",
};
const actionBtnStyle: JSX.CSSProperties = {
  padding: "4px 10px", border: `1px solid ${tokens.colors.border.default}`,
  "border-radius": tokens.radius.sm, background: "transparent",
  color: tokens.colors.text.secondary, cursor: "pointer", "font-size": "11px",
};

export function ColorCustomizer(props: { onClose?: () => void }) {
  const themeCtx = useTheme();
  const [activeCategory, setActiveCategory] = createSignal<ColorCategory>("ui");
  const [search, setSearch] = createSignal("");
  const [showComponents, setShowComponents] = createSignal(false);

  const currentTokens = createMemo(() => TOKEN_MAP[activeCategory()]);

  const filteredTokens = createMemo(() => {
    const q = search().toLowerCase().trim();
    if (!q) return currentTokens();
    return currentTokens().filter(
      (t) => t.label.toLowerCase().includes(q) || t.key.toLowerCase().includes(q)
    );
  });

  const currentColors = createMemo((): Record<string, string> => {
    const cat = activeCategory();
    if (cat === "ui") return themeCtx.colors() as unknown as Record<string, string>;
    if (cat === "editor") return themeCtx.editorColors() as unknown as Record<string, string>;
    if (cat === "syntax") return themeCtx.syntaxColors() as unknown as Record<string, string>;
    return themeCtx.terminalColors() as unknown as Record<string, string>;
  });

  const defaultColors = createMemo((): Record<string, string> => {
    const defaults = themeCtx.getDefaultColors();
    return defaults[activeCategory()] as unknown as Record<string, string>;
  });

  const categoryCount = createMemo(() =>
    Object.keys(themeCtx.colorCustomizations()[activeCategory()]).length
  );

  const handleExport = async () => {
    const json = themeCtx.exportCustomizations();
    try { await navigator.clipboard.writeText(json); } catch { /* clipboard unavailable */ }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => themeCtx.importCustomizations(reader.result as string);
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Icon name="swatchbook" style={{ width: "16px", height: "16px", color: tokens.colors.accent.primary }} />
          <span style={{ "font-weight": "600" }}>Color Customizer</span>
          <Show when={themeCtx.customizationCount() > 0}>
            <span style={badgeStyle}>{themeCtx.customizationCount()}</span>
          </Show>
        </div>
        <Show when={props.onClose}>
          <button
            style={{ background: "transparent", border: "none", cursor: "pointer", color: tokens.colors.text.muted, padding: "2px" } as JSX.CSSProperties}
            onClick={props.onClose} title="Close"
          >
            <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
          </button>
        </Show>
      </div>

      <div style={{ display: "flex", gap: "6px", "align-items": "center" } as JSX.CSSProperties}>
        <Show when={!showComponents()}>
          <div style={{ ...tabBarStyle, flex: "1" }}>
            <For each={CATEGORIES}>
              {(cat) => (
                <button style={tabStyle(activeCategory() === cat.value)} onClick={() => setActiveCategory(cat.value)}>
                  <Icon name={cat.icon} style={{ width: "12px", height: "12px" }} />
                  {cat.label}
                </button>
              )}
            </For>
          </div>
        </Show>
        <Show when={showComponents()}>
          <div style={{ flex: "1", "font-size": "11px", color: tokens.colors.text.secondary, "font-weight": "500" }}>Component Colors</div>
        </Show>
        <button
          style={tabStyle(showComponents())}
          onClick={() => setShowComponents((v) => !v)}
          title={showComponents() ? "Show token colors" : "Show component colors"}
        >
          <Icon name="puzzle-piece" style={{ width: "12px", height: "12px" }} />
          Components
        </button>
      </div>

      <div style={{ position: "relative" } as JSX.CSSProperties}>
        <Icon name="magnifying-glass" style={{ position: "absolute", left: "8px", top: "7px", width: "14px", height: "14px", color: tokens.colors.text.muted } as JSX.CSSProperties} />
        <input type="text" placeholder="Filter colors..." value={search()} onInput={(e) => setSearch(e.currentTarget.value)} style={searchInputStyle} />
      </div>

      <div style={{ display: "flex", "flex-direction": "column", gap: "2px", "max-height": "320px", "overflow-y": "auto" } as JSX.CSSProperties}>
        <Show when={!showComponents()}>
          <For each={filteredTokens()} fallback={
            <div style={{ padding: "12px", color: tokens.colors.text.muted, "text-align": "center" } as JSX.CSSProperties}>No matching colors</div>
          }>
            {(token) => {
              const isCustomized = () => themeCtx.hasCustomization(activeCategory(), token.key);
              const currentColor = () => currentColors()[token.key] ?? "#888";
              const defColor = () => defaultColors()[token.key] ?? "#888";
              return (
                <div style={{ ...tokenRowStyle, background: isCustomized() ? tokens.colors.surface.hover : "transparent" } as JSX.CSSProperties}>
                  <label style={{ display: "contents" }}>
                    <input type="color" value={currentColor()} onInput={(e) => themeCtx.setColorCustomization(activeCategory(), token.key, e.currentTarget.value)} style={{ position: "absolute", opacity: "0", width: "0", height: "0" } as JSX.CSSProperties} />
                    <div style={swatchStyle(currentColor())} title={`Current: ${currentColor()}`} />
                  </label>
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div style={{ "font-size": "12px", "font-weight": "500" }}>{token.label}</div>
                    <div style={{ "font-size": "10px", color: tokens.colors.text.muted }}>{token.description}</div>
                  </div>
                  <Show when={isCustomized()}>
                    <div style={swatchStyle(defColor())} title={`Default: ${defColor()}`} />
                    <button style={actionBtnStyle} onClick={() => themeCtx.removeColorCustomization(activeCategory(), token.key)} title="Reset to default">
                      <Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />
                    </button>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
        <Show when={showComponents()}>
          {(() => {
            const uiColors = () => themeCtx.colors() as unknown as Record<string, string>;
            const uiDefaults = () => themeCtx.getDefaultColors().ui as unknown as Record<string, string>;
            return (
              <For each={COMPONENT_COLORS}>
                {(group) => (
                  <div style={{ "margin-bottom": "8px" }}>
                    <div style={{ display: "flex", "align-items": "center", gap: "6px", padding: "6px 8px", "font-size": "11px", "font-weight": "600", color: tokens.colors.text.secondary }}>
                      <Icon name={group.icon} style={{ width: "12px", height: "12px" }} />{group.label}
                    </div>
                    <For each={group.tokens}>{(tk) => {
                      const custom = () => themeCtx.hasCustomization("ui", tk.key);
                      const c = () => uiColors()[tk.key] ?? "#888";
                      const d = () => uiDefaults()[tk.key] ?? "#888";
                      return (
                        <div style={{ ...tokenRowStyle, background: custom() ? tokens.colors.surface.hover : "transparent" } as JSX.CSSProperties}>
                          <label style={{ display: "contents" }}>
                            <input type="color" value={c()} onInput={(e) => themeCtx.setColorCustomization("ui", tk.key, e.currentTarget.value)} style={{ position: "absolute", opacity: "0", width: "0", height: "0" } as JSX.CSSProperties} />
                            <div style={swatchStyle(c())} title={`Current: ${c()}`} />
                          </label>
                          <div style={{ flex: "1", "min-width": "0" }}>
                            <div style={{ "font-size": "12px", "font-weight": "500" }}>{tk.label}</div>
                            <div style={{ "font-size": "10px", color: tokens.colors.text.muted }}>{tk.description}</div>
                          </div>
                          <Show when={custom()}>
                            <div style={swatchStyle(d())} title={`Default: ${d()}`} />
                            <button style={actionBtnStyle} onClick={() => themeCtx.removeColorCustomization("ui", tk.key)} title="Reset to default">
                              <Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />
                            </button>
                          </Show>
                        </div>);
                    }}</For>
                  </div>
                )}
              </For>);
          })()}
        </Show>
      </div>

      <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap", "padding-top": "4px", "border-top": `1px solid ${tokens.colors.border.default}` } as JSX.CSSProperties}>
        <Show when={categoryCount() > 0}>
          <button style={actionBtnStyle} onClick={() => themeCtx.resetCategoryCustomizations(activeCategory())}>
            Reset {CATEGORIES.find((c) => c.value === activeCategory())?.label}
          </button>
        </Show>
        <Show when={themeCtx.customizationCount() > 0}>
          <button style={actionBtnStyle} onClick={() => themeCtx.resetCustomizations()}>Reset All</button>
        </Show>
        <div style={{ flex: "1" }} />
        <button style={actionBtnStyle} onClick={handleImport} title="Import from file">
          <Icon name="file-import" style={{ width: "12px", height: "12px" }} />
        </button>
        <button style={actionBtnStyle} onClick={handleExport} title="Export to clipboard">
          <Icon name="file-export" style={{ width: "12px", height: "12px" }} />
        </button>
      </div>
    </div>
  );
}

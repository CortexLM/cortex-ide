import { createSignal, createMemo, Show, For, type JSX } from "solid-js";
import { useTheme } from "@/context/ThemeContext";
import type { ColorCategory, ColorTokenInfo } from "@/context/theme/types";
import {
  UI_COLOR_TOKENS, EDITOR_COLOR_TOKENS,
  SYNTAX_COLOR_TOKENS, TERMINAL_COLOR_TOKENS,
  COMPONENT_COLOR_TOKENS,
} from "@/context/theme/colorTokens";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";
type EditorCategory = ColorCategory | "components";

export interface ColorCustomizationEditorProps {
  onClose?: () => void;
  initialCategory?: EditorCategory;
}

interface CategoryTab { value: EditorCategory; label: string; icon: string }

const CATEGORIES: CategoryTab[] = [
  { value: "ui", label: "Workbench", icon: "window-maximize" },
  { value: "editor", label: "Editor", icon: "code" },
  { value: "syntax", label: "Syntax", icon: "highlighter" },
  { value: "terminal", label: "Terminal", icon: "terminal" },
  { value: "components", label: "Components", icon: "puzzle-piece" },
];

const TOKEN_MAP: Record<EditorCategory, ColorTokenInfo[]> = {
  ui: UI_COLOR_TOKENS, editor: EDITOR_COLOR_TOKENS,
  syntax: SYNTAX_COLOR_TOKENS, terminal: TERMINAL_COLOR_TOKENS,
  components: COMPONENT_COLOR_TOKENS,
};

function storageCategory(cat: EditorCategory): ColorCategory {
  return cat === "components" ? "ui" : cat;
}

const LANGUAGES = [
  { value: "", label: "All Languages" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
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
  background: tokens.colors.surface.input,
  border: `1px solid ${tokens.colors.border.default}`,
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

const selectStyle: JSX.CSSProperties = {
  padding: "4px 8px", background: tokens.colors.surface.input,
  border: `1px solid ${tokens.colors.border.default}`,
  "border-radius": tokens.radius.sm, color: tokens.colors.text.primary,
  "font-size": "11px", outline: "none",
};

// ============================================================================
// Sub-Components
// ============================================================================

function ColorRow(props: {
  token: ColorTokenInfo;
  category: ColorCategory;
  currentColor: string;
  defaultColor: string;
  isCustomized: boolean;
  onSet: (color: string) => void;
  onReset: () => void;
}) {
  return (
    <div style={{ ...tokenRowStyle, background: props.isCustomized ? tokens.colors.surface.hover : "transparent" } as JSX.CSSProperties}>
      <label style={{ display: "contents" }}>
        <input
          type="color"
          value={props.currentColor}
          onInput={(e) => props.onSet(e.currentTarget.value)}
          style={{ position: "absolute", opacity: "0", width: "0", height: "0" } as JSX.CSSProperties}
        />
        <div style={swatchStyle(props.currentColor)} title={`Current: ${props.currentColor}`} />
      </label>
      <div style={{ flex: "1", "min-width": "0" }}>
        <div style={{ "font-size": "12px", "font-weight": "500" }}>{props.token.label}</div>
        <div style={{ "font-size": "10px", color: tokens.colors.text.muted }}>{props.token.description}</div>
      </div>
      <Show when={props.isCustomized}>
        <div style={swatchStyle(props.defaultColor)} title={`Default: ${props.defaultColor}`} />
        <button style={actionBtnStyle} onClick={() => props.onReset()} title="Reset to default">
          <Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />
        </button>
      </Show>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ColorCustomizationEditor(props: ColorCustomizationEditorProps) {
  const themeCtx = useTheme();
  const [activeCategory, setActiveCategory] = createSignal<EditorCategory>(props.initialCategory ?? "ui");
  const [search, setSearch] = createSignal("");
  const [selectedLang, setSelectedLang] = createSignal("");

  const currentTokens = createMemo(() => TOKEN_MAP[activeCategory()]);

  const filteredTokens = createMemo(() => {
    const q = search().toLowerCase().trim();
    const list = currentTokens();
    if (!q) return list;
    return list.filter(
      (t) => t.label.toLowerCase().includes(q) || t.key.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  });

  const effectiveCategory = createMemo(() => storageCategory(activeCategory()));

  const currentColors = createMemo((): Record<string, string> => {
    const cat = effectiveCategory();
    if (cat === "ui") return themeCtx.colors() as unknown as Record<string, string>;
    if (cat === "editor") return themeCtx.editorColors() as unknown as Record<string, string>;
    if (cat === "syntax") return themeCtx.syntaxColors() as unknown as Record<string, string>;
    return themeCtx.terminalColors() as unknown as Record<string, string>;
  });

  const defaultColors = createMemo((): Record<string, string> => {
    const defaults = themeCtx.getDefaultColors();
    return defaults[effectiveCategory()] as unknown as Record<string, string>;
  });

  const categoryCount = createMemo(() =>
    Object.keys(themeCtx.colorCustomizations()[effectiveCategory()]).length,
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
          <Icon name="palette" style={{ width: "16px", height: "16px", color: tokens.colors.accent.primary }} />
          <span style={{ "font-weight": "600" }}>Color Customization Editor</span>
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

      <div style={tabBarStyle}>
        <For each={CATEGORIES}>
          {(cat) => (
            <button style={tabStyle(activeCategory() === cat.value)} onClick={() => setActiveCategory(cat.value)}>
              <Icon name={cat.icon} style={{ width: "12px", height: "12px" }} />
              {cat.label}
            </button>
          )}
        </For>
      </div>

      <div style={{ display: "flex", gap: "8px", "align-items": "center" } as JSX.CSSProperties}>
        <div style={{ position: "relative", flex: "1" } as JSX.CSSProperties}>
          <Icon name="magnifying-glass" style={{ position: "absolute", left: "8px", top: "7px", width: "14px", height: "14px", color: tokens.colors.text.muted } as JSX.CSSProperties} />
          <input type="text" placeholder="Search colors..." value={search()} onInput={(e) => setSearch(e.currentTarget.value)} style={searchInputStyle} />
        </div>
        <Show when={activeCategory() === "syntax"}>
          <select value={selectedLang()} onChange={(e) => setSelectedLang(e.currentTarget.value)} style={selectStyle}>
            <For each={LANGUAGES}>
              {(lang) => <option value={lang.value}>{lang.label}</option>}
            </For>
          </select>
        </Show>
      </div>

      <Show when={activeCategory() === "syntax" && selectedLang()}>
        <div style={{ padding: "6px 8px", background: tokens.colors.accent.muted, "border-radius": tokens.radius.sm, "font-size": "11px", color: tokens.colors.accent.primary } as JSX.CSSProperties}>
          <Icon name="info-circle" style={{ width: "12px", height: "12px", "margin-right": "4px" }} />
          Language-scoped overrides for <strong>{LANGUAGES.find((l) => l.value === selectedLang())?.label}</strong> apply only to {selectedLang()} files.
        </div>
      </Show>

      <div style={{ display: "flex", "flex-direction": "column", gap: "2px", "max-height": "360px", "overflow-y": "auto" } as JSX.CSSProperties}>
        <For each={filteredTokens()} fallback={
          <div style={{ padding: "12px", color: tokens.colors.text.muted, "text-align": "center" } as JSX.CSSProperties}>No matching colors</div>
        }>
          {(token) => (
            <ColorRow
              token={token}
              category={effectiveCategory()}
              currentColor={currentColors()[token.key] ?? "#888"}
              defaultColor={defaultColors()[token.key] ?? "#888"}
              isCustomized={themeCtx.hasCustomization(effectiveCategory(), token.key)}
              onSet={(color) => themeCtx.setColorCustomization(effectiveCategory(), token.key, color)}
              onReset={() => themeCtx.removeColorCustomization(effectiveCategory(), token.key)}
            />
          )}
        </For>
      </div>

      <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap", "padding-top": "4px", "border-top": `1px solid ${tokens.colors.border.default}` } as JSX.CSSProperties}>
        <Show when={categoryCount() > 0}>
          <button style={actionBtnStyle} onClick={() => themeCtx.resetCategoryCustomizations(effectiveCategory())}>
            Reset {CATEGORIES.find((c) => c.value === activeCategory())?.label}
          </button>
        </Show>
        <Show when={themeCtx.customizationCount() > 0}>
          <button style={actionBtnStyle} onClick={() => themeCtx.resetCustomizations()}>Reset All</button>
        </Show>
        <div style={{ flex: "1" }} />
        <button style={actionBtnStyle} onClick={handleImport} title="Import from JSON file">
          <Icon name="file-import" style={{ width: "12px", height: "12px" }} />
        </button>
        <button style={actionBtnStyle} onClick={handleExport} title="Export to clipboard as JSON">
          <Icon name="file-export" style={{ width: "12px", height: "12px" }} />
        </button>
      </div>
    </div>
  );
}

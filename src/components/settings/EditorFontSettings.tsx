import { createSignal, createMemo, Show, For, type JSX } from "solid-js";
import { useSettings } from "@/context/SettingsContext";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

type WordWrapOption = "off" | "on" | "wordWrapColumn" | "bounded";
type LineNumbersOption = "on" | "off" | "relative" | "interval";

interface EditorFontSettingsProps {
  onClose?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const WORD_WRAP_OPTIONS: { value: WordWrapOption; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
  { value: "wordWrapColumn", label: "Column" },
  { value: "bounded", label: "Bounded" },
];

const LINE_NUMBERS_OPTIONS: { value: LineNumbersOption; label: string }[] = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
  { value: "relative", label: "Relative" },
  { value: "interval", label: "Interval" },
];

const TAB_SIZES = [2, 4, 8];

const PREVIEW_TEXT = "function fibonacci(n: number): number {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\nconst result = fibonacci(10);";

// ============================================================================
// Styles
// ============================================================================

const panelStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  gap: "16px",
  padding: "16px",
  background: "var(--vscode-settings-editor-background, var(--surface-panel))",
  color: tokens.colors.text.primary,
  "font-size": "13px",
};

const sectionStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  gap: "10px",
};

const sectionTitleStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  "font-weight": "600",
  "font-size": "13px",
  "padding-bottom": "6px",
  "border-bottom": `1px solid ${tokens.colors.border.default}`,
};

const rowStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  gap: "12px",
  "min-height": "28px",
};

const labelStyle: JSX.CSSProperties = {
  color: tokens.colors.text.secondary,
  "font-size": "12px",
  "white-space": "nowrap",
};

const textInputStyle: JSX.CSSProperties = {
  width: "180px",
  padding: "4px 8px",
  background: tokens.colors.surface.input,
  border: `1px solid ${tokens.colors.border.default}`,
  "border-radius": tokens.radius.sm,
  color: tokens.colors.text.primary,
  "font-size": "12px",
  outline: "none",
};

const numberInputStyle: JSX.CSSProperties = {
  width: "64px", padding: "4px 6px", background: tokens.colors.surface.input,
  border: `1px solid ${tokens.colors.border.default}`, "border-radius": tokens.radius.sm,
  color: tokens.colors.text.primary, "font-size": "12px", "text-align": "center", outline: "none",
};

const selectStyle: JSX.CSSProperties = {
  padding: "4px 8px", background: tokens.colors.surface.input,
  border: `1px solid ${tokens.colors.border.default}`, "border-radius": tokens.radius.sm,
  color: tokens.colors.text.primary, "font-size": "12px", outline: "none", cursor: "pointer",
};

const toggleTrackStyle = (active: boolean): JSX.CSSProperties => ({
  position: "relative",
  width: "36px",
  height: "20px",
  "border-radius": tokens.radius.full,
  background: active ? tokens.colors.accent.primary : tokens.colors.surface.active,
  cursor: "pointer",
  transition: "background 0.2s",
  border: "none",
  padding: "0",
  "flex-shrink": "0",
});

const toggleThumbStyle = (active: boolean): JSX.CSSProperties => ({
  position: "absolute",
  top: "2px",
  left: active ? "18px" : "2px",
  width: "16px",
  height: "16px",
  "border-radius": tokens.radius.full,
  background: "#fff",
  transition: "left 0.2s",
  "pointer-events": "none",
});

// ============================================================================
// Component
// ============================================================================

export function EditorFontSettings(props: EditorFontSettingsProps) {
  const settings = useSettings();
  const editor = () => settings.effectiveSettings().editor;

  const [fontFamily, setFontFamily] = createSignal(editor().fontFamily);
  const [fontSize, setFontSize] = createSignal(editor().fontSize);
  const [lineHeight, setLineHeight] = createSignal(editor().lineHeight);
  const [ligatures, setLigatures] = createSignal(editor().fontLigatures);
  const [wordWrap, setWordWrap] = createSignal<WordWrapOption>(editor().wordWrap);
  const [lineNumbers, setLineNumbers] = createSignal<LineNumbersOption>(editor().lineNumbers);
  const [tabSize, setTabSize] = createSignal(editor().tabSize);

  const clampFontSize = (val: number) => Math.max(8, Math.min(72, val));

  const previewStyle = createMemo((): JSX.CSSProperties => ({
    "font-family": fontFamily() || "monospace",
    "font-size": `${fontSize()}px`,
    "line-height": `${lineHeight()}`,
    "font-variant-ligatures": ligatures() ? "normal" : "none",
    "tab-size": String(tabSize()),
    padding: "12px",
    background: "var(--vscode-editor-background, var(--surface-card))",
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.sm,
    color: "var(--vscode-editor-foreground, var(--text-primary))",
    "white-space": "pre",
    overflow: "auto",
    "max-height": "140px",
  }));

  const handleFontSizeInput = (e: Event) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) setFontSize(clampFontSize(val));
  };

  const handleLineHeightInput = (e: Event) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(val) && val >= 1 && val <= 3) setLineHeight(val);
  };

  const handleApply = async () => {
    await settings.updateEditorSetting("fontFamily", fontFamily());
    await settings.updateEditorSetting("fontSize", fontSize());
    await settings.updateEditorSetting("lineHeight", lineHeight());
    await settings.updateEditorSetting("fontLigatures", ligatures());
    await settings.updateEditorSetting("wordWrap", wordWrap());
    await settings.updateEditorSetting("lineNumbers", lineNumbers());
    await settings.updateEditorSetting("tabSize", tabSize());
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <Show when={props.onClose}>
        <div style={{ display: "flex", "justify-content": "flex-end" } as JSX.CSSProperties}>
          <button
            style={{ background: "transparent", border: "none", cursor: "pointer", color: tokens.colors.text.muted, padding: "2px" } as JSX.CSSProperties}
            onClick={props.onClose}
            title="Close"
          >
            <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      </Show>

      {/* Font Family & Size */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <Icon name="font" style={{ width: "14px", height: "14px", color: tokens.colors.accent.primary }} />
          <span>Font</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Font Family</span>
          <input
            type="text"
            value={fontFamily()}
            onInput={(e) => setFontFamily(e.currentTarget.value)}
            style={textInputStyle}
            placeholder="e.g. JetBrains Mono"
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Font Size</span>
          <input type="number" min={8} max={72} value={fontSize()} onInput={handleFontSizeInput} style={numberInputStyle} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Line Height</span>
          <input type="number" min={1} max={3} step={0.1} value={lineHeight()} onInput={handleLineHeightInput} style={numberInputStyle} />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Font Ligatures</span>
          <button style={toggleTrackStyle(ligatures())} onClick={() => setLigatures(!ligatures())} aria-label="Toggle ligatures">
            <div style={toggleThumbStyle(ligatures())} />
          </button>
        </div>
      </div>

      {/* Wrapping & Display */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <Icon name="align-left" style={{ width: "14px", height: "14px", color: tokens.colors.accent.primary }} />
          <span>Display</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Word Wrap</span>
          <select value={wordWrap()} onChange={(e) => setWordWrap(e.currentTarget.value as WordWrapOption)} style={selectStyle}>
            <For each={WORD_WRAP_OPTIONS}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Line Numbers</span>
          <select value={lineNumbers()} onChange={(e) => setLineNumbers(e.currentTarget.value as LineNumbersOption)} style={selectStyle}>
            <For each={LINE_NUMBERS_OPTIONS}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Tab Size</span>
          <select value={tabSize()} onChange={(e) => setTabSize(Number(e.currentTarget.value))} style={selectStyle}>
            <For each={TAB_SIZES}>
              {(size) => <option value={size}>{size}</option>}
            </For>
          </select>
        </div>
      </div>

      {/* Live Preview */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <Icon name="eye" style={{ width: "14px", height: "14px", color: tokens.colors.accent.primary }} />
          <span>Preview</span>
        </div>
        <div style={previewStyle()}>
          {PREVIEW_TEXT}
        </div>
      </div>

      {/* Apply */}
      <button
        style={{
          padding: "6px 16px",
          background: tokens.colors.accent.primary,
          color: "#fff",
          border: "none",
          "border-radius": tokens.radius.sm,
          cursor: "pointer",
          "font-size": "12px",
          "font-weight": "600",
          "align-self": "flex-end",
        } as JSX.CSSProperties}
        onClick={handleApply}
      >
        Apply Settings
      </button>
    </div>
  );
}

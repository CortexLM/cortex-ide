import { Component, JSX, For } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useEditorSettings } from "@/context/SettingsContext";

export interface EditorFontSettingsProps {
  class?: string;
  style?: JSX.CSSProperties;
}

const FONT_FAMILIES = [
  { value: "'JetBrains Mono', monospace", label: "JetBrains Mono" },
  { value: "'Fira Code', monospace", label: "Fira Code" },
  { value: "'Cascadia Code', monospace", label: "Cascadia Code" },
  { value: "'Source Code Pro', monospace", label: "Source Code Pro" },
  { value: "'SF Mono', monospace", label: "SF Mono" },
  { value: "'IBM Plex Mono', monospace", label: "IBM Plex Mono" },
  { value: "'Roboto Mono', monospace", label: "Roboto Mono" },
  { value: "'Ubuntu Mono', monospace", label: "Ubuntu Mono" },
  { value: "'Inconsolata', monospace", label: "Inconsolata" },
  { value: "Menlo, monospace", label: "Menlo" },
  { value: "Monaco, monospace", label: "Monaco" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "Consolas, monospace", label: "Consolas" },
];

const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24];
const LINE_HEIGHTS = [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0];

export const EditorFontSettings: Component<EditorFontSettingsProps> = (props) => {
  const editorSettings = useEditorSettings();

  const currentFontFamily = () => editorSettings.settings().fontFamily;
  const currentFontSize = () => editorSettings.settings().fontSize;
  const currentLineHeight = () => editorSettings.settings().lineHeight;
  const currentFontLigatures = () => editorSettings.settings().fontLigatures;

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

  const selectStyle: JSX.CSSProperties = {
    padding: "8px 12px",
    "font-size": "12px",
    background: "var(--cortex-bg-secondary)",
    border: "1px solid var(--cortex-border-default)",
    "border-radius": "var(--cortex-radius-sm)",
    color: "var(--cortex-text-primary)",
    cursor: "pointer",
    outline: "none",
    width: "100%",
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

  const previewStyle = (): JSX.CSSProperties => ({
    padding: "16px",
    background: "var(--cortex-bg-secondary)",
    "border-radius": "var(--cortex-radius-md)",
    "font-family": currentFontFamily(),
    "font-size": `${currentFontSize()}px`,
    "line-height": `${currentLineHeight()}`,
    color: "var(--cortex-text-primary)",
    border: "1px solid var(--cortex-border-default)",
    "white-space": "pre",
    overflow: "auto",
  });

  const previewText = () => {
    if (currentFontLigatures()) {
      return `// Font Ligatures Preview
const fn = (x) => x !== null && x >= 0;
if (a === b || c <= d) { /* => */ }
const pipe = a |> b |> c;`;
    }
    return `// Font Preview
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}`;
  };

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Font Family</div>
        <div style={sectionDescStyle}>
          Select the font used in the editor
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
          <Icon name="font" size={16} style={{ color: "var(--cortex-text-muted)" }} />
          <select
            style={selectStyle}
            value={currentFontFamily()}
            onChange={(e) => editorSettings.update("fontFamily", e.currentTarget.value)}
          >
            <For each={FONT_FAMILIES}>
              {(font) => (
                <option value={font.value}>{font.label}</option>
              )}
            </For>
          </select>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Font Size</div>
        <div style={sectionDescStyle}>
          Controls the font size in pixels
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
          <Icon name="text-size" size={16} style={{ color: "var(--cortex-text-muted)" }} />
          <select
            style={selectStyle}
            value={currentFontSize()}
            onChange={(e) => editorSettings.update("fontSize", parseInt(e.currentTarget.value, 10))}
          >
            <For each={FONT_SIZES}>
              {(size) => (
                <option value={size}>{size}px</option>
              )}
            </For>
          </select>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Line Height</div>
        <div style={sectionDescStyle}>
          Controls the line height relative to font size
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
          <Icon name="arrows-up-down" size={16} style={{ color: "var(--cortex-text-muted)" }} />
          <select
            style={selectStyle}
            value={currentLineHeight()}
            onChange={(e) => editorSettings.update("lineHeight", parseFloat(e.currentTarget.value))}
          >
            <For each={LINE_HEIGHTS}>
              {(height) => (
                <option value={height}>{height}x</option>
              )}
            </For>
          </select>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Font Ligatures</div>
        <div
          style={toggleStyle(currentFontLigatures())}
          onClick={() => editorSettings.update("fontLigatures", !currentFontLigatures())}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
            <Icon name="link" size={16} style={{ color: "var(--cortex-text-muted)" }} />
            <div>
              <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>
                Enable Font Ligatures
              </div>
              <div style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
                Combine characters like =&gt;, !==, &lt;= into single glyphs
              </div>
            </div>
          </div>
          <div style={switchStyle(currentFontLigatures())}>
            <div style={switchKnobStyle(currentFontLigatures())} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Preview</div>
        <div style={previewStyle()}>
          {previewText()}
        </div>
      </div>
    </div>
  );
};

export default EditorFontSettings;

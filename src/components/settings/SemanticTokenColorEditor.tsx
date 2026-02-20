import { Component, JSX, For, Show, createSignal, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import {
  useSemanticTokenCustomizations,
  SEMANTIC_TOKEN_TYPES,
} from "@/context/SemanticTokenCustomizationsContext";

export interface SemanticTokenColorEditorProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const SemanticTokenColorEditor: Component<SemanticTokenColorEditorProps> = (props) => {
  const ctx = useSemanticTokenCustomizations();
  const [filter, setFilter] = createSignal("");
  const [editingToken, setEditingToken] = createSignal<string | null>(null);
  const [colorInput, setColorInput] = createSignal("");

  const filteredTokenTypes = createMemo(() => {
    const q = filter().toLowerCase();
    if (!q) return [...SEMANTIC_TOKEN_TYPES];
    return SEMANTIC_TOKEN_TYPES.filter((t) => t.toLowerCase().includes(q));
  });

  const getTokenColor = (tokenType: string): string | undefined => {
    const customizations = ctx.currentCustomizations();
    const rule = customizations.rules?.[tokenType];
    if (!rule) return undefined;
    if (typeof rule === "string") return rule;
    return rule.foreground;
  };

  const handleColorChange = (tokenType: string, color: string) => {
    ctx.setRule(ctx.currentThemeName(), tokenType, { foreground: color });
    setEditingToken(null);
    setColorInput("");
  };

  const handleRemoveCustomization = (tokenType: string) => {
    ctx.removeRule(ctx.currentThemeName(), tokenType);
  };

  const handleResetAll = () => {
    ctx.resetAll();
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    gap: "16px",
    padding: "16px",
    ...props.style,
  });

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": "14px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
  };

  const searchStyle: JSX.CSSProperties = {
    padding: "6px 10px",
    "font-size": "12px",
    background: "var(--cortex-bg-secondary)",
    border: "1px solid var(--cortex-border-default)",
    "border-radius": "var(--cortex-radius-sm)",
    color: "var(--cortex-text-primary)",
    outline: "none",
    width: "100%",
  };

  const tokenRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 8px",
    "border-radius": "var(--cortex-radius-sm)",
    transition: "background var(--cortex-transition-fast)",
  };

  const swatchStyle = (color?: string): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    "border-radius": "3px",
    border: "1px solid var(--cortex-border-default)",
    background: color || "var(--cortex-bg-secondary)",
    cursor: "pointer",
    "flex-shrink": "0",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={headerStyle}>
        <span style={titleStyle}>Semantic Token Colors</span>
        <Button variant="ghost" size="sm" onClick={handleResetAll}>
          <Icon name="rotate" size={12} />
          Reset All
        </Button>
      </div>

      <input
        type="text"
        style={searchStyle}
        placeholder="Filter token types..."
        value={filter()}
        onInput={(e) => setFilter(e.currentTarget.value)}
      />

      <div style={{
        display: "flex",
        "flex-direction": "column",
        gap: "2px",
        "max-height": "400px",
        overflow: "auto",
      }}>
        <For each={filteredTokenTypes()}>
          {(tokenType) => {
            const color = () => getTokenColor(tokenType);
            const isEditing = () => editingToken() === tokenType;

            return (
              <div
                style={{
                  ...tokenRowStyle,
                  background: isEditing() ? "var(--cortex-bg-active)" : "transparent",
                }}
              >
                <div
                  style={swatchStyle(color())}
                  onClick={() => {
                    setEditingToken(tokenType);
                    setColorInput(color() || "");
                  }}
                  title={`Edit color for ${tokenType}`}
                />
                <span style={{
                  flex: "1",
                  "font-size": "12px",
                  "font-family": "var(--cortex-font-mono)",
                  color: color() || "var(--cortex-text-primary)",
                }}>
                  {tokenType}
                </span>
                <Show when={color()}>
                  <span style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
                    {color()}
                  </span>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px",
                      color: "var(--cortex-text-muted)",
                    }}
                    onClick={() => handleRemoveCustomization(tokenType)}
                    title="Remove customization"
                  >
                    <Icon name="x-close" size={12} />
                  </button>
                </Show>
                <Show when={isEditing()}>
                  <input
                    type="color"
                    value={colorInput() || "#ffffff"}
                    onInput={(e) => setColorInput(e.currentTarget.value)}
                    onChange={(e) => handleColorChange(tokenType, e.currentTarget.value)}
                    style={{ width: "24px", height: "24px", padding: "0", border: "none", cursor: "pointer" }}
                  />
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

export default SemanticTokenColorEditor;

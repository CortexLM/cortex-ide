import { createSignal, createMemo, For, Show, type JSX } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import {
  WhenClauseInput,
  WhenClauseDisplay,
  validateWhenClause,
  CONTEXT_KEY_CATEGORIES,
  ALL_CONTEXT_KEYS,
  type ContextKeyCategory,
  type ContextKeyInfo,
} from "./WhenClauseInput";

interface WhenClauseEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidate?: (isValid: boolean) => void;
}

type EditorMode = "text" | "visual";

const OPERATORS = ["&&", "||", "!", "==", "!="] as const;
type Operator = (typeof OPERATORS)[number];

const QUICK_INSERT_KEYS = [
  "editorTextFocus",
  "terminalFocus",
  "editorLangId",
  "inputFocus",
  "inDebugMode",
  "sideBarVisible",
  "panelFocus",
  "listFocus",
];

const COMPARISON_OPERATORS = new Set<string>(["==", "!="]);

const panelStyle: JSX.CSSProperties = {
  display: "flex", "flex-direction": "column", gap: "12px", padding: "16px",
  background: tokens.colors.surface.panel, color: tokens.colors.text.primary,
  "font-size": "13px", "border-radius": tokens.radius.md,
  border: `1px solid ${tokens.colors.border.default}`,
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

const selectStyle: JSX.CSSProperties = {
  flex: "1", padding: "6px 8px", background: tokens.colors.surface.input,
  border: `1px solid ${tokens.colors.border.default}`, "border-radius": tokens.radius.sm,
  color: tokens.colors.text.primary, "font-size": "12px", outline: "none",
};

const inputStyle: JSX.CSSProperties = {
  width: "100%", padding: "6px 8px", background: tokens.colors.surface.input,
  border: `1px solid ${tokens.colors.border.default}`, "border-radius": tokens.radius.sm,
  color: tokens.colors.text.primary, "font-size": "12px", outline: "none",
};

const addBtnStyle: JSX.CSSProperties = {
  padding: "6px 14px", border: "none", "border-radius": tokens.radius.sm,
  background: tokens.colors.accent.primary, color: "#fff",
  cursor: "pointer", "font-size": "12px", "font-weight": "600",
  display: "flex", "align-items": "center", gap: "4px",
};

const quickBtnStyle: JSX.CSSProperties = {
  padding: "3px 8px", border: `1px solid ${tokens.colors.border.default}`,
  "border-radius": tokens.radius.sm, background: "transparent",
  color: tokens.colors.text.secondary, cursor: "pointer",
  "font-size": "11px", "font-family": "monospace",
};

const previewStyle: JSX.CSSProperties = {
  padding: "8px 12px", background: tokens.colors.surface.card,
  "border-radius": tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`,
  "min-height": "32px", display: "flex", "align-items": "center", gap: "8px",
};

const validationStyle = (isValid: boolean): JSX.CSSProperties => ({
  display: "flex", "align-items": "center", gap: "4px", "font-size": "11px",
  color: isValid ? tokens.colors.state.success : tokens.colors.state.error,
});

const sectionLabelStyle: JSX.CSSProperties = {
  "font-size": "11px", "font-weight": "600", color: tokens.colors.text.muted,
  "text-transform": "uppercase", "letter-spacing": "0.5px",
};

export function WhenClauseEditor(props: WhenClauseEditorProps) {
  const [mode, setMode] = createSignal<EditorMode>("text");
  const [selectedKey, setSelectedKey] = createSignal(ALL_CONTEXT_KEYS[0].key);
  const [selectedOperator, setSelectedOperator] = createSignal<Operator>("&&");
  const [comparisonValue, setComparisonValue] = createSignal("");

  const validation = createMemo(() => {
    const result = validateWhenClause(props.value);
    props.onValidate?.(result.isValid);
    return result;
  });

  const selectedKeyInfo = createMemo(() =>
    ALL_CONTEXT_KEYS.find(k => k.key === selectedKey())
  );

  const needsValue = createMemo(() => COMPARISON_OPERATORS.has(selectedOperator()));

  const buildCondition = (): string => {
    const key = selectedKey();
    const op = selectedOperator();
    if (op === "!") return `!${key}`;
    if (COMPARISON_OPERATORS.has(op)) {
      const val = comparisonValue().trim();
      const formatted = /^\d+$/.test(val) || val === "true" || val === "false"
        ? val : `'${val}'`;
      return `${key} ${op} ${formatted}`;
    }
    return key;
  };

  const handleAddCondition = () => {
    const condition = buildCondition();
    const op = selectedOperator();
    const current = props.value.trim();
    if (!current) {
      props.onChange(condition);
      return;
    }
    const joiner = op === "!" || COMPARISON_OPERATORS.has(op) ? " && " : ` ${op} `;
    props.onChange(`${current}${joiner}${condition}`);
    setComparisonValue("");
  };

  const handleQuickInsert = (key: string) => {
    const current = props.value.trim();
    props.onChange(current ? `${current} && ${key}` : key);
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Icon name="code" style={{ width: "16px", height: "16px", color: tokens.colors.accent.primary }} />
          <span style={{ "font-weight": "600" }}>When Clause Editor</span>
        </div>
        <div style={tabBarStyle}>
          <button style={tabStyle(mode() === "text")} onClick={() => setMode("text")}>
            <Icon name="keyboard" style={{ width: "12px", height: "12px" }} />
            Text
          </button>
          <button style={tabStyle(mode() === "visual")} onClick={() => setMode("visual")}>
            <Icon name="sliders" style={{ width: "12px", height: "12px" }} />
            Visual
          </button>
        </div>
      </div>

      <Show when={mode() === "text"}>
        <WhenClauseInput value={props.value} onChange={props.onChange} onValidate={props.onValidate} />
      </Show>

      <Show when={mode() === "visual"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "10px" }}>
          <span style={sectionLabelStyle}>Build Condition</span>
          <div style={{ display: "flex", gap: "8px", "align-items": "flex-end", "flex-wrap": "wrap" }}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "4px", flex: "2", "min-width": "140px" }}>
              <label style={{ "font-size": "11px", color: tokens.colors.text.muted }}>Context Key</label>
              <select
                style={selectStyle}
                value={selectedKey()}
                onChange={e => setSelectedKey(e.currentTarget.value)}
              >
                <For each={CONTEXT_KEY_CATEGORIES}>
                  {(cat: ContextKeyCategory) => (
                    <optgroup label={cat.name}>
                      <For each={cat.keys}>
                        {(info: ContextKeyInfo) => (
                          <option value={info.key}>{info.key} — {info.description}</option>
                        )}
                      </For>
                    </optgroup>
                  )}
                </For>
              </select>
            </div>

            <div style={{ display: "flex", "flex-direction": "column", gap: "4px", "min-width": "80px" }}>
              <label style={{ "font-size": "11px", color: tokens.colors.text.muted }}>Operator</label>
              <select
                style={selectStyle}
                value={selectedOperator()}
                onChange={e => setSelectedOperator(e.currentTarget.value as Operator)}
              >
                <For each={OPERATORS}>
                  {(op) => <option value={op}>{op}</option>}
                </For>
              </select>
            </div>

            <Show when={needsValue()}>
              <div style={{ display: "flex", "flex-direction": "column", gap: "4px", flex: "1", "min-width": "100px" }}>
                <label style={{ "font-size": "11px", color: tokens.colors.text.muted }}>Value</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={comparisonValue()}
                  onInput={e => setComparisonValue(e.currentTarget.value)}
                  placeholder={selectedKeyInfo()?.examples?.[0] ?? "value"}
                />
              </div>
            </Show>

            <button style={addBtnStyle} onClick={handleAddCondition}>
              <Icon name="plus" style={{ width: "12px", height: "12px" }} />
              Add
            </button>
          </div>

          <Show when={selectedKeyInfo()?.examples?.length}>
            <div style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
              Examples: {selectedKeyInfo()!.examples!.join(", ")}
            </div>
          </Show>

          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <span style={sectionLabelStyle}>Current Expression</span>
            <input
              type="text"
              style={inputStyle}
              value={props.value}
              onInput={e => props.onChange(e.currentTarget.value)}
              placeholder="Expression will appear here..."
            />
          </div>
        </div>
      </Show>

      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        <span style={sectionLabelStyle}>Quick Insert</span>
        <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
          <For each={QUICK_INSERT_KEYS}>
            {(key) => (
              <button style={quickBtnStyle} onClick={() => handleQuickInsert(key)}>
                {key}
              </button>
            )}
          </For>
        </div>
      </div>

      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
          <span style={sectionLabelStyle}>Preview</span>
          <Show when={props.value.trim()}>
            <div style={validationStyle(validation().isValid)}>
              <Icon
                name={validation().isValid ? "check" : "circle-exclamation"}
                style={{ width: "12px", height: "12px" }}
              />
              {validation().isValid ? "Valid" : validation().error}
            </div>
          </Show>
        </div>
        <div style={previewStyle}>
          <WhenClauseDisplay value={props.value} />
        </div>
      </div>

      <Show when={props.value.trim()}>
        <div style={{ display: "flex", "justify-content": "flex-end" }}>
          <button style={quickBtnStyle} onClick={() => props.onChange("")}>
            <Icon name="rotate-left" style={{ width: "12px", height: "12px" }} /> Clear
          </button>
        </div>
      </Show>
    </div>
  );
}

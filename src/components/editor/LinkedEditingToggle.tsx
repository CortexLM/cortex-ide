import { Component, JSX, createSignal, onMount } from "solid-js";
import { CortexToggle, CortexIcon } from "@/components/cortex/primitives";
import { updateLinkedEditingEnabled } from "./modules/EditorLSP";

export interface LinkedEditingToggleProps {
  class?: string;
  style?: JSX.CSSProperties;
  initialEnabled?: boolean;
  onChange?: (enabled: boolean) => void;
}

export const LinkedEditingToggle: Component<LinkedEditingToggleProps> = (props) => {
  const [enabled, setEnabled] = createSignal(props.initialEnabled ?? true);

  onMount(() => {
    const stored = localStorage.getItem("cortex.editor.linkedEditing");
    if (stored !== null) {
      const val = stored === "true";
      setEnabled(val);
      updateLinkedEditingEnabled(val);
    }
  });

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    updateLinkedEditingEnabled(checked);
    localStorage.setItem("cortex.editor.linkedEditing", String(checked));
    props.onChange?.(checked);
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 12px",
    "border-radius": "var(--cortex-radius-sm)",
    background: "var(--cortex-bg-secondary)",
    ...props.style,
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <CortexIcon name="link" size={14} style={{ color: "var(--cortex-text-muted)" }} />
        <div>
          <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>
            Linked Editing
          </div>
          <div style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
            Auto-rename matching HTML/JSX tags
          </div>
        </div>
      </div>
      <CortexToggle
        checked={enabled()}
        onChange={handleToggle}
        size="sm"
      />
    </div>
  );
};

export default LinkedEditingToggle;

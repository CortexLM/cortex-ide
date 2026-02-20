/**
 * Toggle - Cortex UI Design System Toggle Component
 * 
 * @deprecated Prefer importing CortexToggle from "@/components/cortex/primitives" for new code.
 * This wrapper delegates to CortexToggle while preserving the legacy API.
 */
import { JSX, splitProps, Show } from "solid-js";
import { CortexToggle } from "../cortex/primitives/CortexToggle";

export interface ToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  style?: JSX.CSSProperties;
  "aria-label"?: string;
}

export function Toggle(props: ToggleProps) {
  const [local] = splitProps(props, [
    "checked", "onChange", "label", "description", "disabled", "size", "style", "aria-label"
  ]);

  return (
    <div style={{ display: "flex", "align-items": "center", gap: "10px", ...local.style }}>
      <CortexToggle
        checked={local.checked}
        onChange={local.onChange}
        disabled={local.disabled}
        size={local.size || "md"}
      />
      <Show when={local.label || local.description}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
          <Show when={local.label}>
            <span style={{
              "font-size": "13px",
              color: "var(--cortex-text-primary)",
              "font-family": "var(--cortex-font-sans)",
            }}>
              {local.label}
            </span>
          </Show>
          <Show when={local.description}>
            <span style={{
              "font-size": "12px",
              color: "var(--cortex-text-secondary)",
              "font-family": "var(--cortex-font-sans)",
            }}>
              {local.description}
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
}

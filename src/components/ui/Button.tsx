/**
 * Button - Cortex UI Design System Button Component
 * 
 * @deprecated Prefer importing CortexButton from "@/components/cortex/primitives" for new code.
 * This wrapper delegates to CortexButton while preserving the legacy JSX.Element icon API.
 */
import { JSX, splitProps, Show } from "solid-js";
import { CortexButton } from "../cortex/primitives/CortexButton";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: JSX.Element;
  iconRight?: JSX.Element;
}

const SIZE_MAP: Record<string, "xs" | "sm" | "md" | "lg"> = {
  sm: "xs",
  md: "sm",
  lg: "md",
};

export function Button(props: ButtonProps) {
  const [local] = splitProps(props, [
    "variant",
    "size",
    "loading",
    "icon",
    "iconRight",
    "children",
    "style",
    "disabled",
    "class",
    "onClick",
    "type",
    "title",
  ]);

  return (
    <CortexButton
      variant={local.variant || "secondary"}
      size={SIZE_MAP[local.size || "md"] || "sm"}
      loading={local.loading}
      disabled={local.disabled}
      class={local.class}
      style={typeof local.style === "object" ? local.style : undefined}
      onClick={local.onClick as ((e: MouseEvent) => void) | undefined}
      type={local.type as "button" | "submit" | "reset" | undefined}
      title={local.title}
    >
      <Show when={local.icon && !local.loading}>
        {local.icon}
      </Show>
      {local.children}
      <Show when={local.iconRight}>
        {local.iconRight}
      </Show>
    </CortexButton>
  );
}

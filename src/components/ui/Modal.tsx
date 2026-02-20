/**
 * Modal - Cortex UI Design System Modal Component
 * 
 * @deprecated Prefer importing CortexModal from "@/components/cortex/primitives" for new code.
 * This wrapper delegates to CortexModal while preserving the legacy API.
 */
import { JSX, splitProps, Show } from "solid-js";
import { CortexModal } from "../cortex/primitives/CortexModal";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: JSX.Element;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: JSX.Element;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  style?: JSX.CSSProperties;
}

export function Modal(props: ModalProps) {
  const [local] = splitProps(props, [
    "open", "onClose", "title", "children", "size", "footer",
    "closeOnOverlay", "closeOnEscape", "style"
  ]);

  return (
    <CortexModal
      open={local.open}
      onClose={local.onClose}
      title={local.title}
      size={local.size}
      closeOnOverlay={local.closeOnOverlay}
      closeOnEscape={local.closeOnEscape}
      style={local.style}
    >
      {local.children}
      <Show when={local.footer}>
        <div style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "flex-end",
          gap: "8px",
          padding: "16px 20px",
          "border-top": "1px solid var(--cortex-border-default)",
          "flex-shrink": "0",
        }}>
          {local.footer}
        </div>
      </Show>
    </CortexModal>
  );
}

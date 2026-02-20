/**
 * CortexModal - Pixel-perfect modal dialog component for Cortex UI Design System
 * Supports multiple sizes, custom header/footer, and keyboard accessibility
 */

import {
  Component,
  JSX,
  splitProps,
  createSignal,
  createEffect,
  Show,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";
import { CortexIcon } from "./CortexIcon";
import { CortexButton } from "./CortexButton";

export type CortexModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface CortexModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  size?: CortexModalSize;
  closable?: boolean;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showFooter?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLoading?: boolean;
  confirmDisabled?: boolean;
  confirmVariant?: "primary" | "danger";
  class?: string;
  style?: JSX.CSSProperties;
  children?: JSX.Element;
  header?: JSX.Element;
  footer?: JSX.Element;
}

const SIZE_STYLES: Record<CortexModalSize, JSX.CSSProperties> = {
  sm: { width: "360px", "max-width": "90vw" },
  md: { width: "480px", "max-width": "90vw" },
  lg: { width: "640px", "max-width": "90vw" },
  xl: { width: "800px", "max-width": "90vw" },
  full: { width: "90vw", height: "90vh" },
};

export const CortexModal: Component<CortexModalProps> = (props) => {
  const [local, others] = splitProps(props, [
    "open",
    "onClose",
    "title",
    "description",
    "size",
    "closable",
    "closeOnOverlay",
    "closeOnEscape",
    "showFooter",
    "confirmText",
    "cancelText",
    "onConfirm",
    "onCancel",
    "confirmLoading",
    "confirmDisabled",
    "confirmVariant",
    "class",
    "style",
    "children",
    "header",
    "footer",
  ]);

  const [isAnimating, setIsAnimating] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(false);
  let modalRef: HTMLDivElement | undefined;
  let previousActiveElement: HTMLElement | null = null;

  const size = () => local.size ?? "md";
  const closable = () => local.closable ?? true;
  const closeOnOverlay = () => local.closeOnOverlay ?? true;
  const closeOnEscape = () => local.closeOnEscape ?? true;
  const showFooter = () => local.showFooter ?? (local.onConfirm !== undefined || local.onCancel !== undefined);

  const handleClose = () => {
    if (!closable()) return;
    local.onClose?.();
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlay()) {
      handleClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && closeOnEscape()) {
      e.preventDefault();
      handleClose();
    }

    if (e.key === "Tab") {
      trapFocus(e);
    }
  };

  const trapFocus = (e: KeyboardEvent) => {
    if (!modalRef) return;

    const focusableElements = modalRef.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  const handleConfirm = () => {
    local.onConfirm?.();
  };

  const handleCancel = () => {
    if (local.onCancel) {
      local.onCancel();
    } else {
      handleClose();
    }
  };

  createEffect(() => {
    if (local.open) {
      previousActiveElement = document.activeElement as HTMLElement;
      setIsAnimating(true);
      requestAnimationFrame(() => {
        setIsVisible(true);
        modalRef?.focus();
      });
      document.body.style.overflow = "hidden";
    } else {
      setIsVisible(false);
      setTimeout(() => {
        setIsAnimating(false);
        document.body.style.overflow = "";
        previousActiveElement?.focus();
      }, 200);
    }
  });

  onCleanup(() => {
    document.body.style.overflow = "";
  });

  const overlayStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    inset: "0",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: "var(--cortex-overlay-bg, rgba(0, 0, 0, 0.6))",
    "backdrop-filter": "blur(4px)",
    "z-index": "var(--cortex-z-modal, 800)",
    opacity: isVisible() ? "1" : "0",
    transition: "opacity 200ms ease",
  });

  const modalStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    background: "var(--cortex-modal-bg, var(--cortex-bg-elevated))",
    border: "1px solid var(--cortex-modal-border, rgba(255,255,255,0.1))",
    "border-radius": "var(--cortex-radius-lg, 12px)",
    "box-shadow": "var(--cortex-shadow-xl, 0 24px 48px rgba(0,0,0,0.5))",
    "max-height": size() === "full" ? undefined : "85vh",
    outline: "none",
    transform: isVisible() ? "scale(1) translateY(0)" : "scale(0.95) translateY(-10px)",
    opacity: isVisible() ? "1" : "0",
    transition: "transform 200ms ease, opacity 200ms ease",
    ...SIZE_STYLES[size()],
    ...local.style,
  });

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "flex-start",
    "justify-content": "space-between",
    gap: "16px",
    padding: "20px 24px",
    "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "flex-shrink": "0",
  });

  const bodyStyle = (): JSX.CSSProperties => ({
    flex: "1",
    padding: "20px 24px",
    "overflow-y": "auto",
  });

  const footerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "flex-end",
    gap: "12px",
    padding: "16px 24px",
    "border-top": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "flex-shrink": "0",
  });

  return (
    <Show when={local.open || isAnimating()}>
      <Portal>
        <div
          style={overlayStyle()}
          onClick={handleOverlayClick}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby={local.title ? "modal-title" : undefined}
          aria-describedby={local.description ? "modal-description" : undefined}
        >
          <div
            ref={modalRef}
            class={local.class}
            style={modalStyle()}
            tabIndex={-1}
            {...others}
          >
            <Show when={local.header || local.title}>
              <div style={headerStyle()}>
                <Show when={local.header} fallback={
                  <div>
                    <Show when={local.title}>
                      <h2
                        id="modal-title"
                        style={{
                          margin: "0",
                          "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
                          "font-size": "18px",
                          "font-weight": "600",
                          color: "var(--cortex-text-primary)",
                          "line-height": "1.4",
                        }}
                      >
                        {local.title}
                      </h2>
                    </Show>
                    <Show when={local.description}>
                      <p
                        id="modal-description"
                        style={{
                          margin: "4px 0 0 0",
                          "font-size": "14px",
                          color: "var(--cortex-text-muted)",
                          "line-height": "1.5",
                        }}
                      >
                        {local.description}
                      </p>
                    </Show>
                  </div>
                }>
                  {local.header}
                </Show>
                <Show when={closable()}>
                  <button
                    onClick={handleClose}
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "center",
                      width: "28px",
                      height: "28px",
                      padding: "0",
                      background: "transparent",
                      border: "none",
                      "border-radius": "var(--cortex-radius-sm, 4px)",
                      color: "var(--cortex-text-muted)",
                      cursor: "pointer",
                      transition: "background var(--cortex-transition-fast, 100ms ease), color var(--cortex-transition-fast, 100ms ease)",
                      "flex-shrink": "0",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--cortex-interactive-hover, rgba(255,255,255,0.05))";
                      e.currentTarget.style.color = "var(--cortex-text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--cortex-text-muted)";
                    }}
                    aria-label="Close modal"
                  >
                    <CortexIcon name="x" size={18} />
                  </button>
                </Show>
              </div>
            </Show>

            <div style={bodyStyle()}>
              {local.children}
            </div>

            <Show when={showFooter()}>
              <div style={footerStyle()}>
                <Show when={local.footer} fallback={
                  <>
                    <Show when={local.cancelText || local.onCancel}>
                      <CortexButton
                        variant="secondary"
                        onClick={handleCancel}
                      >
                        {local.cancelText || "Cancel"}
                      </CortexButton>
                    </Show>
                    <Show when={local.confirmText || local.onConfirm}>
                      <CortexButton
                        variant={local.confirmVariant || "primary"}
                        onClick={handleConfirm}
                        loading={local.confirmLoading}
                        disabled={local.confirmDisabled}
                      >
                        {local.confirmText || "Confirm"}
                      </CortexButton>
                    </Show>
                  </>
                }>
                  {local.footer}
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

export default CortexModal;

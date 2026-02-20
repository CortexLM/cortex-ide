import { Show, createSignal, onMount, onCleanup, createEffect } from "solid-js";
import { useSDK } from "@/context/SDKContext";
import { Button } from "./ui";
import { Icon } from "./ui/Icon";

/** Dialog types matching VS Code specifications */
export type DialogType = "info" | "error" | "warning" | "question" | "pending" | "none";

/** Get platform for button ordering */
function getPlatform(): "windows" | "mac" | "linux" {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("mac")) return "mac";
  if (platform.includes("win")) return "windows";
  return "linux";
}

/** Get icon for dialog type */
function DialogIcon(props: { type: DialogType }) {
  const iconClass = () => {
    switch (props.type) {
      case "info": return "modal-icon-info";
      case "error": return "modal-icon-error";
      case "warning": return "modal-icon-warning";
      case "question": return "modal-icon-question";
      case "pending": return "modal-icon-pending";
      default: return "modal-icon-none";
    }
  };

  const ariaLabel = () => {
    switch (props.type) {
      case "info": return "Info";
      case "error": return "Error";
      case "warning": return "Warning";
      case "pending": return "In Progress";
      default: return "Info";
    }
  };

  return (
    <Show when={props.type !== "none"}>
      <div 
        class={`modal-icon ${iconClass()}`}
        aria-label={ariaLabel()}
        id="modal-dialog-icon"
      >
        <Show when={props.type === "pending"}>
          <div class="icon-spin">⏳</div>
        </Show>
        <Show when={props.type === "question"}>
          <span>❓</span>
        </Show>
        <Show when={props.type === "info"}>
          <span>ℹ️</span>
        </Show>
        <Show when={props.type === "error"}>
          <span>❌</span>
        </Show>
        <Show when={props.type === "warning"}>
          <span>⚠️</span>
        </Show>
      </div>
    </Show>
  );
}

export function ApprovalDialog() {
  const { state, approve } = useSDK();
  const [dialogRef, setDialogRef] = createSignal<HTMLDivElement | null>(null);
  const platform = getPlatform();

  const handleApprove = () => {
    if (state.pendingApproval) {
      approve(state.pendingApproval.callId, true);
    }
  };

  const handleDeny = () => {
    if (state.pendingApproval) {
      approve(state.pendingApproval.callId, false);
    }
  };

  const command = () => {
    const cmd = state.pendingApproval?.command || [];
    return cmd.join(" ");
  };

  // Focus trapping implementation
  const getFocusableElements = () => {
    const dialog = dialogRef();
    if (!dialog) return [];
    return Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!state.pendingApproval) return;

    // Escape key closes dialog (deny action)
    if (e.key === "Escape") {
      e.preventDefault();
      handleDeny();
      return;
    }

    // Tab key focus trapping with circular navigation
    if (e.key === "Tab") {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        // Shift+Tab: go backwards
        if (activeElement === firstElement || !focusable.includes(activeElement as HTMLElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: go forwards
        if (activeElement === lastElement || !focusable.includes(activeElement as HTMLElement)) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    // Arrow key navigation
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (currentIndex === -1) return;

      e.preventDefault();
      const direction = e.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + direction + focusable.length) % focusable.length;
      focusable[nextIndex].focus();
    }

    // Prevent Alt key shortcuts
    if (e.altKey) {
      e.preventDefault();
    }
  };

  // Handle backdrop click - return focus to dialog
  const handleBackdropClick = (e: MouseEvent) => {
    const dialog = dialogRef();
    if (e.target === e.currentTarget && dialog) {
      dialog.focus();
    }
  };

  // Set up focus management when dialog opens
  createEffect(() => {
    if (state.pendingApproval) {
      // Focus the primary button when dialog opens
      setTimeout(() => {
        const focusable = getFocusableElements();
        const primaryButton = focusable.find(el => 
          el.classList.contains('modal-button-primary') || 
          el.getAttribute('data-primary') === 'true'
        );
        if (primaryButton) {
          primaryButton.focus();
        } else if (focusable.length > 0) {
          focusable[0].focus();
        }
      }, 0);
    }
  });

  // Set up keyboard event listener
  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Show when={state.pendingApproval}>
      {/* Modal Backdrop - VS Code: z-index 2575, rgba(0,0,0,0.3) */}
      <div 
        class="modal-overlay dimmed"
        onClick={handleBackdropClick}
      >
        {/* Dialog Shadow Wrapper */}
        <div class="dialog-shadow">
          {/* Dialog Box - VS Code structure with column-reverse */}
          <div 
            ref={setDialogRef}
            class="modal dialog-type-question"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-dialog-icon modal-dialog-message-text"
            aria-describedby="modal-dialog-icon modal-dialog-message-text modal-dialog-message-detail"
            tabIndex={-1}
            data-focus-trap="true"
          >
            {/* 
              VS Code uses flex-direction: column-reverse
              DOM order: Footer -> Buttons -> Message -> Toolbar
              Visual order: Toolbar -> Message -> Buttons -> Footer
            */}
            
            {/* Buttons Row (appears at bottom visually) */}
            <div class="modal-buttons-row">
              <div class={`modal-buttons platform-${platform}`}>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleDeny}
                  class="modal-button modal-button-secondary"
                >
                  Deny
                </Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleApprove}
                  class="modal-button modal-button-primary"
                  data-primary="true"
                >
                  Approve
                </Button>
              </div>
            </div>

            {/* Message Row (appears in middle visually) */}
            <div class="modal-message-row">
              <DialogIcon type="question" />
              <div class="modal-message-container">
                <div class="modal-title" id="modal-dialog-message-text">
                  Approve Command
                </div>
                <div class="modal-detail" id="modal-dialog-message-detail">
                  <pre 
                    class="text-sm font-mono p-3 rounded overflow-x-auto"
                    style={{ 
                      background: "var(--background-base)",
                      color: "var(--text-strong)"
                    }}
                  >
                    $ {command()}
                  </pre>
                  <div class="mt-2 text-xs" style={{ color: "var(--text-weaker)" }}>
                    {state.pendingApproval?.cwd}
                  </div>
                </div>
              </div>
            </div>

            {/* Toolbar Row (appears at top visually) */}
            <div class="modal-toolbar-row">
              <div class="actions-container">
                <button
                  class="modal-close"
                  onClick={handleDeny}
                  aria-label="Close"
                >
                  <Icon name="xmark" size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

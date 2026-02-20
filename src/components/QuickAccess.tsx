/**
 * =============================================================================
 * QUICK ACCESS COMPONENT - Unified Quick Access Widget
 * =============================================================================
 * 
 * A unified input widget that routes to different providers based on prefix:
 * 
 * Prefixes:
 * - '>' - Commands
 * - '@' - Document symbols
 * - '#' - Workspace symbols
 * - ':' - Go to line
 * - '?' - Help
 * - 'view ' - Views
 * - (no prefix) - Files
 * 
 * Features:
 * - Dynamic provider switching based on input
 * - Fuzzy search with highlighting
 * - Keyboard navigation
 * - Pin items for quick access
 * - History per provider
 * 
 * @example
 * ```tsx
 * // Simple usage
 * <QuickAccess />
 * 
 * // With initial value
 * <QuickAccess initialValue=">" />
 * ```
 */

import {
  createEffect,
  For,
  onMount,
  JSX,
} from "solid-js";
import { Icon } from "./ui/Icon";
import { useQuickAccess } from "@/context/QuickAccessContext";

// =============================================================================
// Props
// =============================================================================

export interface QuickAccessProps {
  /** Initial value for the input */
  initialValue?: string;
  /** Callback when closed */
  onClose?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function QuickAccess(props: QuickAccessProps) {
  const quickAccess = useQuickAccess();
  
  // Show on mount if provided
  onMount(() => {
    if (props.initialValue !== undefined) {
      quickAccess.show(props.initialValue);
    }
  });
  
  // Notify parent on close
  createEffect(() => {
    if (!quickAccess.isVisible() && props.onClose) {
      props.onClose();
    }
  });
  
  // The actual rendering is handled by QuickAccessProvider
  // This component just provides a convenience wrapper
  return null;
}

// =============================================================================
// Standalone Quick Access Dialog
// =============================================================================

export interface QuickAccessDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Initial query value */
  initialValue?: string;
  /** Callback when closed */
  onClose: () => void;
}

/**
 * Standalone Quick Access dialog that can be rendered anywhere.
 * This is useful when you want to control visibility externally.
 */
export function QuickAccessDialog(props: QuickAccessDialogProps) {
  const quickAccess = useQuickAccess();
  
  createEffect(() => {
    if (props.open) {
      quickAccess.show(props.initialValue ?? "");
    } else if (quickAccess.isVisible()) {
      quickAccess.hide();
    }
  });
  
  // Handle close callback
  createEffect(() => {
    if (!quickAccess.isVisible() && props.open) {
      props.onClose();
    }
  });
  
  return null;
}

// =============================================================================
// Prefix Hint Component
// =============================================================================

export function QuickAccessPrefixHint() {
  const prefixes = [
    { prefix: ">", label: "Commands", icon: "terminal" },
    { prefix: "@", label: "Symbols", icon: "at" },
    { prefix: "#", label: "Workspace Symbols", icon: "hashtag" },
    { prefix: ":", label: "Go to Line", icon: "hashtag" },
    { prefix: "?", label: "Help", icon: "circle-question" },
    { prefix: "view ", label: "Views", icon: "grid-2" },
  ];
  
  return (
    <div
      style={{
        display: "flex",
        "flex-wrap": "wrap",
        gap: "8px",
        padding: "8px 16px",
        "font-size": "11px",
        color: "var(--jb-text-muted-color)",
        background: "var(--jb-canvas)",
        "border-top": "1px solid var(--jb-border-default)",
      }}
    >
      <For each={prefixes}>
        {(item) => (
          <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <Icon name={item.icon} size={12} />
            <span style={{ color: "var(--jb-border-focus)" }}>{item.prefix}</span>
            <span>{item.label}</span>
          </div>
        )}
      </For>
    </div>
  );
}

// =============================================================================
// Quick Access Trigger Button
// =============================================================================

export interface QuickAccessTriggerProps {
  /** Button label */
  label?: string;
  /** Initial prefix to use when opening */
  prefix?: string;
  /** Custom class name */
  class?: string;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

/**
 * A button that triggers the Quick Access dialog.
 */
export function QuickAccessTrigger(props: QuickAccessTriggerProps) {
  const quickAccess = useQuickAccess();
  
  return (
    <button
      type="button"
      class={props.class}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        padding: "6px 12px",
        background: "var(--jb-canvas)",
        border: "1px solid var(--jb-border-default)",
        "border-radius": "var(--cortex-radius-md)",
        color: "var(--jb-text-muted-color)",
        "font-size": "13px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        ...props.style,
      }}
      onClick={() => quickAccess.show(props.prefix ?? "")}
    >
      <Icon name="magnifying-glass" size={14} />
      <span>{props.label ?? "Quick Access"}</span>
      <kbd
        style={{
          "margin-left": "auto",
          padding: "2px 6px",
          background: "var(--ui-panel-bg)",
          "border-radius": "var(--cortex-radius-sm)",
          "font-size": "11px",
          "font-family": "var(--font-code)",
        }}
      >
        Ctrl+Shift+P
      </kbd>
    </button>
  );
}

export default QuickAccess;


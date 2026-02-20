/**
 * DiffNavigator - Navigation controls for diff changes
 * 
 * Features:
 * - Navigate between changes (previous/next)
 * - Jump to specific change
 * - Change count indicator
 * - Keyboard shortcuts support
 */

import { createSignal, onMount, onCleanup, Show, For, type JSX } from "solid-js";
import { IconButton, Text } from "@/components/ui";
import { Icon } from "../ui/Icon";

// ============================================================================
// Types
// ============================================================================

export interface DiffChange {
  /** Unique identifier for the change */
  id: string;
  /** Line number in the modified file */
  lineNumber: number;
  /** Type of change */
  type: "addition" | "deletion" | "modification";
  /** Number of lines affected */
  lineCount: number;
  /** Preview text of the change */
  preview?: string;
}

export interface DiffNavigatorProps {
  /** List of changes to navigate */
  changes: DiffChange[];
  /** Currently focused change index */
  currentIndex: number;
  /** Callback when navigating to a change */
  onNavigate: (index: number) => void;
  /** Whether the navigator is disabled */
  disabled?: boolean;
  /** Show compact mode (icons only) */
  compact?: boolean;
  /** Show change list dropdown */
  showList?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function DiffNavigator(props: DiffNavigatorProps) {
  const [showDropdown, setShowDropdown] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  const hasChanges = () => props.changes.length > 0;
  const hasPrevious = () => props.currentIndex > 0;
  const hasNext = () => props.currentIndex < props.changes.length - 1;
  
  const goToPrevious = () => {
    if (hasPrevious() && !props.disabled) {
      props.onNavigate(props.currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (hasNext() && !props.disabled) {
      props.onNavigate(props.currentIndex + 1);
    }
  };

  const goToChange = (index: number) => {
    if (!props.disabled && index >= 0 && index < props.changes.length) {
      props.onNavigate(index);
      setShowDropdown(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (props.disabled) return;
    
    // Alt+Up: Previous change
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      goToPrevious();
    }
    // Alt+Down: Next change
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      goToNext();
    }
    // F7: Previous change (VSCode compatible)
    if (e.key === "F7" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      goToPrevious();
    }
    // Shift+F7: Next change (VSCode compatible)
    if (e.key === "F7" && e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      goToNext();
    }
  };

  // Close dropdown on outside click
  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      setShowDropdown(false);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("mousedown", handleClickOutside);
  });

  const getChangeIcon = (type: DiffChange["type"]) => {
    switch (type) {
      case "addition": return "+";
      case "deletion": return "-";
      case "modification": return "~";
    }
  };

  const getChangeColor = (type: DiffChange["type"]): string => {
    switch (type) {
      case "addition": return "var(--jb-green)";
      case "deletion": return "var(--jb-red)";
      case "modification": return "var(--jb-yellow)";
    }
  };

  // Styles
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
    position: "relative",
  };

  const countBadgeStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
    padding: "2px 8px",
    "border-radius": "var(--cortex-radius-sm)",
    background: "var(--jb-button-secondary)",
    cursor: props.showList ? "pointer" : "default",
    "font-size": "12px",
    color: "var(--jb-text)",
    "min-width": "60px",
    "justify-content": "center",
  };

  const dropdownStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "100%",
    left: "0",
    "margin-top": "4px",
    "min-width": "250px",
    "max-height": "300px",
    "overflow-y": "auto",
    background: "var(--jb-panel)",
    border: "1px solid var(--jb-border)",
    "border-radius": "var(--cortex-radius-md)",
    "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.3)",
    "z-index": "1000",
  };

  const dropdownItemStyle = (isActive: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    cursor: "pointer",
    background: isActive ? "var(--jb-selection)" : "transparent",
    "border-left": isActive ? "2px solid var(--jb-primary)" : "2px solid transparent",
  });

  const changeTypeStyle = (type: DiffChange["type"]): JSX.CSSProperties => ({
    width: "18px",
    height: "18px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "border-radius": "var(--cortex-radius-sm)",
    background: getChangeColor(type),
    color: "white",
    "font-size": "12px",
    "font-weight": "bold",
    "flex-shrink": "0",
  });

  return (
    <div style={containerStyle} ref={dropdownRef}>
      {/* Previous change button */}
      <IconButton
        icon={<Icon name="chevron-up" />}
        size="sm"
        variant="ghost"
        onClick={goToPrevious}
        disabled={!hasPrevious() || props.disabled}
        title="Previous Change (Alt+Up or F7)"
      />

      {/* Change count / selector */}
      <Show when={hasChanges()}>
        <div
          style={countBadgeStyle}
          onClick={() => props.showList && setShowDropdown(!showDropdown())}
          title={props.showList ? "Click to see all changes" : undefined}
        >
          <Show when={props.showList}>
            <Icon name="list" style={{ width: "12px", height: "12px" }} />
          </Show>
          <span>
            {props.currentIndex + 1} / {props.changes.length}
          </span>
        </div>
      </Show>

      <Show when={!hasChanges()}>
        <div style={countBadgeStyle}>
          <span>No changes</span>
        </div>
      </Show>

      {/* Next change button */}
      <IconButton
        icon={<Icon name="chevron-down" />}
        size="sm"
        variant="ghost"
        onClick={goToNext}
        disabled={!hasNext() || props.disabled}
        title="Next Change (Alt+Down or Shift+F7)"
      />

      {/* Dropdown list */}
      <Show when={showDropdown() && props.showList}>
        <div style={dropdownStyle}>
          <For each={props.changes}>
            {(change, index) => (
              <div
                style={dropdownItemStyle(index() === props.currentIndex)}
                onClick={() => goToChange(index())}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 
                    index() === props.currentIndex ? "var(--jb-selection)" : "var(--jb-button-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 
                    index() === props.currentIndex ? "var(--jb-selection)" : "transparent";
                }}
              >
                <div style={changeTypeStyle(change.type)}>
                  {getChangeIcon(change.type)}
                </div>
                <div style={{ flex: "1", "min-width": "0" }}>
                  <Text size="sm" style={{ display: "block" }}>
                    Line {change.lineNumber}
                  </Text>
                  <Show when={change.preview}>
                    <Text
                      size="xs"
                      variant="muted"
                      style={{
                        display: "block",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}
                    >
                      {change.preview}
                    </Text>
                  </Show>
                </div>
                <Text size="xs" variant="muted">
                  {change.lineCount} line{change.lineCount !== 1 ? "s" : ""}
                </Text>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default DiffNavigator;


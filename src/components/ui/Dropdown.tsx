/**
 * @deprecated Prefer CortexDropdown from "@/components/cortex/primitives" for new code.
 * This trigger-based dropdown API is kept for backward compatibility.
 */
import { JSX, splitProps, Show, For, createSignal, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

export interface DropdownItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: JSX.Element;
  /** Keyboard shortcut display */
  shortcut?: string;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Whether this is a separator */
  separator?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export interface DropdownProps {
  /** Trigger element */
  trigger: JSX.Element;
  /** Menu items */
  items: DropdownItem[];
  /** Alignment relative to trigger */
  align?: "start" | "end";
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function Dropdown(props: DropdownProps) {
  const [local] = splitProps(props, ["trigger", "items", "align", "style"]);
  const [open, setOpen] = createSignal(false);
  const [position, setPosition] = createSignal({ top: 0, left: 0 });
  const [focusedIndex, setFocusedIndex] = createSignal(-1);

  let triggerRef: HTMLDivElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  const updatePosition = () => {
    if (!triggerRef) return;
    const rect = triggerRef.getBoundingClientRect();
    const align = local.align || "start";
    setPosition({
      top: rect.bottom + 4,
      left: align === "end" ? rect.right : rect.left,
    });
  };

  const handleToggle = () => {
    if (!open()) updatePosition();
    setOpen(!open());
    setFocusedIndex(-1);
  };

  const handleClose = () => {
    setOpen(false);
    setFocusedIndex(-1);
  };

  const handleItemClick = (item: DropdownItem) => {
    if (item.disabled || item.separator) return;
    item.onClick?.();
    handleClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!open()) return;
    const selectableItems = local.items.filter(i => !i.separator && !i.disabled);
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex(i => Math.min(i + 1, selectableItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex() >= 0) {
          handleItemClick(selectableItems[focusedIndex()]);
        }
        break;
      case "Escape":
        e.preventDefault();
        handleClose();
        break;
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (triggerRef?.contains(e.target as Node)) return;
    if (menuRef?.contains(e.target as Node)) return;
    handleClose();
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  const menuStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    top: `${position().top}px`,
    left: local.align === "end" ? "auto" : `${position().left}px`,
    right: local.align === "end" ? `${window.innerWidth - position().left}px` : "auto",
    "min-width": "160px",
    background: "var(--surface-active)",
    "border-radius": "var(--cortex-radius-md)",
    "box-shadow": "0px 8px 24px rgba(0, 0, 0, 0.4)",
    border: "1px solid var(--border-default)",
    padding: "4px",
    "z-index": "var(--cortex-z-highest)",
    ...local.style,
  });

  const itemStyle = (item: DropdownItem, idx: number): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    gap: "8px",
    padding: "8px 12px",
    "border-radius": "var(--cortex-radius-sm)",
    "font-size": "13px",
    color: item.disabled ? "var(--text-placeholder)" : "var(--text-primary)",
    background: idx === focusedIndex() ? "var(--surface-hover)" : "transparent",
    cursor: item.disabled ? "not-allowed" : "pointer",
    opacity: item.disabled ? "0.6" : "1",
    transition: "background 100ms ease",
  });

  const separatorStyle: JSX.CSSProperties = {
    height: "1px",
    background: "var(--border-default)",
    margin: "4px 0",
  };

  const shortcutStyle: JSX.CSSProperties = {
    "margin-left": "auto",
    "font-size": "11px",
    color: "var(--text-placeholder)",
    "flex-shrink": "0",
  };

  let selectableIdx = -1;

  return (
    <div style={{ display: "inline-block", position: "relative" }}>
      <div ref={triggerRef} onClick={handleToggle} style={{ cursor: "pointer" }}>
        {local.trigger}
      </div>
      <Show when={open()}>
        <Portal>
          <div ref={menuRef} style={menuStyle()} role="menu">
            <For each={local.items}>
              {(item) => {
                if (item.separator) {
                  return <div style={separatorStyle} role="separator" />;
                }
                selectableIdx++;
                const currentIdx = selectableIdx;
                return (
                  <div
                    role="menuitem"
                    aria-disabled={item.disabled}
                    style={itemStyle(item, currentIdx)}
                    onClick={() => handleItemClick(item)}
                    onMouseEnter={() => !item.disabled && setFocusedIndex(currentIdx)}
                  >
                    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                      <Show when={item.icon}>
                        <span style={{ width: "16px", height: "16px", "flex-shrink": "0" }}>
                          {item.icon}
                        </span>
                      </Show>
                      <span>{item.label}</span>
                    </div>
                    <Show when={item.shortcut}>
                      <span style={shortcutStyle}>{item.shortcut}</span>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Portal>
      </Show>
    </div>
  );
}


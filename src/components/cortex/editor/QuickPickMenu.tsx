import {
  Component,
  JSX,
  For,
  Show,
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";
import { CortexIcon } from "../primitives";

export interface QuickPickItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string;
}

export interface QuickPickMenuProps {
  items: QuickPickItem[];
  onSelect: (item: QuickPickItem) => void;
  onClose: () => void;
  visible: boolean;
  anchorRef?: HTMLElement;
  searchable?: boolean;
  title?: string;
}

export const QuickPickMenu: Component<QuickPickMenuProps> = (props) => {
  const [focusedIndex, setFocusedIndex] = createSignal(0);
  const [searchQuery, setSearchQuery] = createSignal("");
  let containerRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const filteredItems = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.items;
    return props.items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    );
  });

  createEffect(() => {
    if (props.visible) {
      setFocusedIndex(0);
      setSearchQuery("");
      requestAnimationFrame(() => {
        if (props.searchable && inputRef) {
          inputRef.focus();
        }
      });
    }
  });

  const menuPosition = createMemo((): JSX.CSSProperties => {
    if (!props.anchorRef) {
      return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    const rect = props.anchorRef.getBoundingClientRect();
    return {
      position: "fixed",
      bottom: `${window.innerHeight - rect.top + 4}px`,
      left: `${rect.left}px`,
      "min-width": `${Math.max(rect.width, 220)}px`,
    };
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;

    const items = filteredItems();
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % items.length);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const item = items[focusedIndex()];
        if (item) {
          props.onSelect(item);
        }
        break;
      }
      case "Escape": {
        e.preventDefault();
        props.onClose();
        break;
      }
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (!props.visible) return;
    if (containerRef && !containerRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  createEffect(() => {
    if (props.visible) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("mousedown", handleClickOutside);
    } else {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    }
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("mousedown", handleClickOutside);
  });

  const overlayStyle: JSX.CSSProperties = {
    position: "fixed",
    inset: "0",
    "z-index": "var(--cortex-z-popover, 600)",
    "pointer-events": "none",
  };

  const containerStyle = (): JSX.CSSProperties => ({
    ...menuPosition(),
    "z-index": "var(--cortex-z-popover, 600)",
    "max-height": "300px",
    display: "flex",
    "flex-direction": "column",
    background: "var(--cortex-bg-elevated, #1e1e2e)",
    border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "border-radius": "var(--cortex-radius-md, 6px)",
    "box-shadow": "0 8px 24px rgba(0,0,0,0.4)",
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "13px",
    color: "var(--cortex-text-primary)",
    overflow: "hidden",
    "pointer-events": "auto",
  });

  const titleStyle: JSX.CSSProperties = {
    padding: "8px 12px",
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--cortex-text-muted)",
    "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "flex-shrink": "0",
  };

  const searchStyle: JSX.CSSProperties = {
    padding: "6px 12px",
    "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "flex-shrink": "0",
  };

  const inputStyle: JSX.CSSProperties = {
    width: "100%",
    background: "var(--cortex-bg-tertiary, rgba(255,255,255,0.05))",
    border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "border-radius": "var(--cortex-radius-sm, 4px)",
    padding: "4px 8px",
    color: "var(--cortex-text-primary)",
    "font-size": "13px",
    "font-family": "inherit",
    outline: "none",
  };

  const listStyle: JSX.CSSProperties = {
    "overflow-y": "auto",
    "flex-grow": "1",
    padding: "4px 0",
  };

  const itemStyle = (isFocused: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
    cursor: "pointer",
    background: isFocused ? "var(--cortex-bg-hover, rgba(255,255,255,0.08))" : "transparent",
    color: isFocused ? "var(--cortex-text-primary)" : "var(--cortex-text-secondary, var(--cortex-text-primary))",
    transition: "background var(--cortex-transition-fast, 100ms ease)",
  });

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--cortex-text-muted)",
    "margin-left": "auto",
    "white-space": "nowrap",
  };

  const shortcutStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--cortex-text-muted)",
    "margin-left": "auto",
    padding: "1px 4px",
    background: "var(--cortex-bg-tertiary, rgba(255,255,255,0.05))",
    "border-radius": "var(--cortex-radius-sm, 3px)",
    "font-family": "var(--cortex-font-mono, monospace)",
  };

  const emptyStyle: JSX.CSSProperties = {
    padding: "12px",
    "text-align": "center",
    color: "var(--cortex-text-muted)",
    "font-size": "12px",
  };

  return (
    <Show when={props.visible}>
      <Portal>
        <div style={overlayStyle}>
          <div ref={containerRef} style={containerStyle()}>
            <Show when={props.title}>
              <div style={titleStyle}>{props.title}</div>
            </Show>

            <Show when={props.searchable}>
              <div style={searchStyle}>
                <input
                  ref={inputRef}
                  type="text"
                  style={inputStyle}
                  placeholder="Type to filter..."
                  value={searchQuery()}
                  onInput={(e) => {
                    setSearchQuery(e.currentTarget.value);
                    setFocusedIndex(0);
                  }}
                />
              </div>
            </Show>

            <div style={listStyle}>
              <Show
                when={filteredItems().length > 0}
                fallback={<div style={emptyStyle}>No matching items</div>}
              >
                <For each={filteredItems()}>
                  {(item, index) => (
                    <div
                      style={itemStyle(index() === focusedIndex())}
                      onMouseEnter={() => setFocusedIndex(index())}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        props.onSelect(item);
                      }}
                      role="option"
                      aria-selected={index() === focusedIndex()}
                    >
                      <Show when={item.icon}>
                        <CortexIcon name={item.icon!} size={14} />
                      </Show>
                      <span>{item.label}</span>
                      <Show when={item.description && !item.shortcut}>
                        <span style={descriptionStyle}>{item.description}</span>
                      </Show>
                      <Show when={item.shortcut}>
                        <span style={shortcutStyle}>{item.shortcut}</span>
                      </Show>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

export default QuickPickMenu;

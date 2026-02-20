import { createSignal, createEffect, createMemo, onMount, Show, For } from "solid-js";
import { Icon } from "../../ui/Icon";
import { SYMBOL_ICONS, SYMBOL_COLORS } from "./breadcrumbConstants";
import { getFileIconPath } from "./breadcrumbHelpers";
import type { BreadcrumbsPickerProps, SiblingItem, SymbolInfo } from "./breadcrumbTypes";

export function BreadcrumbsPicker(props: BreadcrumbsPickerProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  onMount(() => {
    inputRef?.focus();
  });

  const filteredItems = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.items;
    
    if (props.type === "folder") {
      return (props.items as SiblingItem[]).filter(item =>
        item.name.toLowerCase().includes(query)
      );
    } else {
      return (props.items as SymbolInfo[]).filter(item =>
        item.name.toLowerCase().includes(query)
      );
    }
  });

  createEffect(() => {
    filteredItems();
    setSelectedIndex(0);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = filteredItems();
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, items.length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        if (items[selectedIndex()]) {
          props.onSelect(items[selectedIndex()]);
        }
        break;
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
      case "Home":
        e.preventDefault();
        setSelectedIndex(0);
        scrollToSelected();
        break;
      case "End":
        e.preventDefault();
        setSelectedIndex(items.length - 1);
        scrollToSelected();
        break;
    }
  };

  const scrollToSelected = () => {
    if (listRef) {
      const selected = listRef.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <div
      class="breadcrumbs-picker"
      style={{
        position: "fixed",
        left: `${props.position.x}px`,
        top: `${props.position.y}px`,
        "min-width": "220px",
        "max-width": "400px",
        "max-height": "350px",
        background: "var(--jb-panel)",
        border: "1px solid var(--jb-border-divider)",
        "border-radius": "var(--cortex-radius-md)",
        "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.36)",
        "z-index": "1000",
        overflow: "hidden",
        display: "flex",
        "flex-direction": "column",
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          padding: "8px",
          "border-bottom": "1px solid var(--jb-border-divider)",
        }}
      >
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            padding: "4px 8px",
            background: "var(--jb-surface-base)",
            "border-radius": "var(--cortex-radius-sm)",
            border: "1px solid var(--jb-border-divider)",
          }}
        >
          <Icon name="magnifying-glass" style={{ width: "14px", height: "14px", color: "var(--jb-text-muted-color)", "flex-shrink": "0" }} />
          <input
            ref={inputRef}
            type="text"
            placeholder={props.type === "folder" ? "Search files..." : "Search symbols..."}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            style={{
              flex: "1",
              border: "none",
              background: "transparent",
              color: "var(--jb-text-body-color)",
              "font-size": "12px",
              outline: "none",
            }}
          />
        </div>
      </div>

      <div
        ref={listRef}
        style={{
          flex: "1",
          "overflow-y": "auto",
          padding: "4px 0",
        }}
      >
        <Show
          when={filteredItems().length > 0}
          fallback={
            <div
              style={{
                padding: "12px 16px",
                color: "var(--jb-text-muted-color)",
                "font-size": "12px",
                "text-align": "center",
              }}
            >
              No items found
            </div>
          }
        >
          <For each={filteredItems()}>
            {(item, index) => {
              const isSelected = () => index() === selectedIndex();
              const isCurrent = () => {
                if (props.type === "folder") {
                  return (item as SiblingItem).path === props.currentPath;
                } else {
                  return (item as SymbolInfo).id === props.currentSymbolId;
                }
              };

              if (props.type === "folder") {
                const folderItem = item as SiblingItem;
                return (
                  <button
                    data-selected={isSelected()}
                    onClick={() => props.onSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index())}
                    style={{
                      width: "100%",
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      padding: "4px 12px",
                      height: "24px",
                      border: "none",
                      background: isSelected() 
                        ? "var(--jb-bg-hover)" 
                        : "transparent",
                      color: isCurrent() 
                        ? "var(--jb-border-focus)" 
                        : "var(--jb-text-body-color)",
                      cursor: "pointer",
                      "text-align": "left",
                    }}
                  >
                    <Show
                      when={folderItem.isDirectory}
                      fallback={
                        <img 
                          src={getFileIconPath(folderItem.name)} 
                          alt="" 
                          style={{ width: "16px", height: "16px", "flex-shrink": "0" }}
                        />
                      }
                    >
                      <Icon name="folder" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--cortex-warning)" }} />
                    </Show>
                    <span
                      style={{
                        "font-size": "12px",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}
                    >
                      {folderItem.name}
                    </span>
                  </button>
                );
              } else {
                const symbolItem = item as SymbolInfo;
                return (
                  <button
                    data-selected={isSelected()}
                    onClick={() => props.onSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index())}
                    style={{
                      width: "100%",
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      padding: "4px 12px",
                      "padding-left": `${12 + symbolItem.depth * 12}px`,
                      height: "24px",
                      border: "none",
                      background: isSelected() 
                        ? "var(--jb-bg-hover)" 
                        : "transparent",
                      color: isCurrent() 
                        ? "var(--jb-border-focus)" 
                        : "var(--jb-text-body-color)",
                      cursor: "pointer",
                      "text-align": "left",
                    }}
                  >
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        "flex-shrink": "0",
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "center",
                        "font-size": "10px",
                        "font-weight": "600",
                        "border-radius": "var(--cortex-radius-sm)",
                        background: "var(--jb-surface-base)",
                        color: SYMBOL_COLORS[symbolItem.kind] || "var(--jb-text-muted-color)",
                      }}
                    >
                      {SYMBOL_ICONS[symbolItem.kind] || "?"}
                    </span>
                    <span
                      style={{
                        "font-size": "12px",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        flex: "1",
                      }}
                    >
                      {symbolItem.name}
                    </span>
                    <span
                      style={{
                        "font-size": "10px",
                        color: "var(--jb-text-muted-color)",
                        "margin-left": "auto",
                      }}
                    >
                      {symbolItem.kind}
                    </span>
                  </button>
                );
              }
            }}
          </For>
        </Show>
      </div>
    </div>
  );
}

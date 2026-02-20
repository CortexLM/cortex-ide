/**
 * CortexDropdown - Pixel-perfect dropdown component for Cortex UI Design System
 * Supports single/multi select, search filtering, and keyboard navigation
 */

import {
  Component,
  JSX,
  splitProps,
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";
import { CortexIcon } from "./CortexIcon";

export interface CortexDropdownOption {
  value: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  description?: string;
}

export interface CortexDropdownProps {
  options: CortexDropdownOption[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  onChange?: (value: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
  maxHeight?: number;
  position?: "bottom" | "top" | "auto";
  fullWidth?: boolean;
}

export const CortexDropdown: Component<CortexDropdownProps> = (props) => {
  const [local, others] = splitProps(props, [
    "options",
    "value",
    "placeholder",
    "disabled",
    "searchable",
    "clearable",
    "class",
    "style",
    "onChange",
    "onOpen",
    "onClose",
    "maxHeight",
    "position",
    "fullWidth",
  ]);

  const [isOpen, setIsOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  const [dropdownPos, setDropdownPos] = createSignal({ x: 0, y: 0, width: 0, showAbove: false });

  let triggerRef: HTMLButtonElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;
  let searchInputRef: HTMLInputElement | undefined;

  const maxHeight = () => local.maxHeight ?? 280;

  const selectedOption = createMemo(() =>
    local.options.find((opt) => opt.value === local.value)
  );

  const filteredOptions = createMemo(() => {
    const query = search().toLowerCase();
    if (!query) return local.options;
    return local.options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.value.toLowerCase().includes(query)
    );
  });

  const calculatePosition = () => {
    if (!triggerRef) return;

    const rect = triggerRef.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const preferredHeight = maxHeight();

    const positionPref = local.position ?? "auto";
    let showAbove = false;

    if (positionPref === "top") {
      showAbove = true;
    } else if (positionPref === "bottom") {
      showAbove = false;
    } else {
      showAbove = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
    }

    setDropdownPos({
      x: rect.left,
      y: showAbove ? rect.top : rect.bottom,
      width: rect.width,
      showAbove,
    });
  };

  const open = () => {
    if (local.disabled) return;
    calculatePosition();
    setIsOpen(true);
    setSearch("");
    setHighlightedIndex(0);
    local.onOpen?.();

    requestAnimationFrame(() => {
      searchInputRef?.focus();
    });
  };

  const close = () => {
    setIsOpen(false);
    setSearch("");
    local.onClose?.();
    triggerRef?.focus();
  };

  const selectOption = (option: CortexDropdownOption) => {
    if (option.disabled) return;
    local.onChange?.(option.value);
    close();
  };

  const handleTriggerClick = () => {
    if (isOpen()) {
      close();
    } else {
      open();
    }
  };

  const handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    local.onChange?.("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const options = filteredOptions();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen()) {
          open();
        } else {
          setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (isOpen()) {
          setHighlightedIndex((i) => Math.max(i - 1, 0));
        }
        break;

      case "Enter":
        e.preventDefault();
        if (isOpen() && options[highlightedIndex()]) {
          selectOption(options[highlightedIndex()]);
        } else if (!isOpen()) {
          open();
        }
        break;

      case "Escape":
        e.preventDefault();
        close();
        break;

      case "Tab":
        close();
        break;

      case "Home":
        e.preventDefault();
        setHighlightedIndex(0);
        break;

      case "End":
        e.preventDefault();
        setHighlightedIndex(options.length - 1);
        break;
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (
      triggerRef &&
      !triggerRef.contains(e.target as Node) &&
      dropdownRef &&
      !dropdownRef.contains(e.target as Node)
    ) {
      close();
    }
  };

  createEffect(() => {
    if (isOpen()) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("resize", calculatePosition);
      window.addEventListener("scroll", calculatePosition, true);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition, true);
    }
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    window.removeEventListener("resize", calculatePosition);
    window.removeEventListener("scroll", calculatePosition, true);
  });

  createEffect(() => {
    const index = highlightedIndex();
    const item = dropdownRef?.querySelector(`[data-index="${index}"]`) as HTMLElement;
    item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  const triggerStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "space-between",
    gap: "8px",
    height: "32px",
    padding: "0 12px",
    background: "var(--cortex-input-bg, var(--cortex-bg-tertiary))",
    border: `1px solid ${isOpen() ? "var(--cortex-accent-primary)" : "var(--cortex-input-border, rgba(255,255,255,0.1))"}`,
    "border-radius": "var(--cortex-radius-md, 8px)",
    color: local.value ? "var(--cortex-text-primary)" : "var(--cortex-text-muted)",
    "font-family": "var(--cortex-font-sans, 'Figtree', sans-serif)",
    "font-size": "14px",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    transition: "border-color var(--cortex-transition-normal, 150ms ease)",
    width: local.fullWidth ? "100%" : "auto",
    "min-width": "120px",
    ...local.style,
  });

  const dropdownStyle = (): JSX.CSSProperties => {
    const pos = dropdownPos();
    return {
      position: "fixed",
      left: `${pos.x}px`,
      top: pos.showAbove ? undefined : `${pos.y + 4}px`,
      bottom: pos.showAbove ? `${window.innerHeight - pos.y + 4}px` : undefined,
      width: `${pos.width}px`,
      "min-width": "160px",
      "max-height": `${maxHeight()}px`,
      background: "var(--cortex-dropdown-bg, #252628)",
      border: "1px solid var(--cortex-dropdown-border, #3C3D40)",
      "border-radius": "8px",
      padding: "4px 0px",
      "box-shadow": "var(--cortex-shadow-lg, 0 8px 24px rgba(0,0,0,0.4))",
      "z-index": "var(--cortex-z-dropdown, 600)",
      overflow: "hidden",
    };
  };

  const optionStyle = (opt: CortexDropdownOption, index: number): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "4px 8px",
    cursor: opt.disabled ? "not-allowed" : "pointer",
    opacity: opt.disabled ? "0.5" : "1",
    background:
      index === highlightedIndex()
        ? "#252628"
        : opt.value === local.value
          ? "var(--cortex-interactive-selected, rgba(255,255,255,0.08))"
          : "transparent",
    "border-radius": index === highlightedIndex() ? "4px" : "0",
    color:
      opt.value === local.value
        ? "var(--cortex-accent-primary)"
        : "var(--cortex-text-primary)",
    "font-size": "14px",
    transition: "background var(--cortex-transition-fast, 100ms ease)",
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        class={local.class}
        style={triggerStyle()}
        disabled={local.disabled}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen()}
        {...others}
      >
        <Show when={selectedOption()?.icon}>
          <CortexIcon name={selectedOption()!.icon!} size={16} />
        </Show>
        <span style={{ flex: "1", "text-align": "left", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          {selectedOption()?.label || local.placeholder || "Select..."}
        </span>
        <Show when={local.clearable && local.value}>
          <span
            onClick={handleClear}
            style={{ display: "flex", "align-items": "center", cursor: "pointer" }}
          >
            <CortexIcon name="x" size={14} />
          </span>
        </Show>
        <CortexIcon
          name="chevron-down"
          size={14}
          style={{
            transition: "transform var(--cortex-transition-normal, 150ms ease)",
            transform: isOpen() ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      <Show when={isOpen()}>
        <Portal>
          <div ref={dropdownRef} style={dropdownStyle()} role="listbox">
            <Show when={local.searchable}>
              <div
                style={{
                  padding: "8px",
                  "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
                }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={search()}
                  onInput={(e) => {
                    setSearch(e.currentTarget.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    background: "var(--cortex-input-bg, var(--cortex-bg-tertiary))",
                    border: "1px solid var(--cortex-input-border, rgba(255,255,255,0.1))",
                    "border-radius": "var(--cortex-radius-sm, 4px)",
                    color: "var(--cortex-text-primary)",
                    "font-size": "13px",
                    outline: "none",
                  }}
                />
              </div>
            </Show>

            <div
              style={{
                "max-height": local.searchable ? `${maxHeight() - 52}px` : `${maxHeight()}px`,
                "overflow-y": "auto",
              }}
            >
              <Show
                when={filteredOptions().length > 0}
                fallback={
                  <div
                    style={{
                      padding: "16px",
                      "text-align": "center",
                      color: "var(--cortex-text-muted)",
                      "font-size": "13px",
                    }}
                  >
                    No options found
                  </div>
                }
              >
                <For each={filteredOptions()}>
                  {(option, index) => (
                    <div
                      data-index={index()}
                      role="option"
                      aria-selected={option.value === local.value}
                      style={optionStyle(option, index())}
                      onMouseEnter={() => setHighlightedIndex(index())}
                      onClick={() => selectOption(option)}
                    >
                      <Show when={option.icon}>
                        <CortexIcon name={option.icon!} size={16} />
                      </Show>
                      <div style={{ flex: "1", overflow: "hidden" }}>
                        <div
                          style={{
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                          }}
                        >
                          {option.label}
                        </div>
                        <Show when={option.description}>
                          <div
                            style={{
                              "font-size": "12px",
                              color: "var(--cortex-text-muted)",
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                              "white-space": "nowrap",
                            }}
                          >
                            {option.description}
                          </div>
                        </Show>
                      </div>
                      <Show when={option.value === local.value}>
                        <CortexIcon name="check" size={14} style={{ color: "var(--cortex-accent-primary)" }} />
                      </Show>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
};

export default CortexDropdown;

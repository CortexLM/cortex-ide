import { JSX, splitProps, Show, For, createSignal, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  /** Select options */
  options: SelectOption[];
  /** Current value */
  value?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  error?: boolean;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function Select(props: SelectProps) {
  const [local] = splitProps(props, [
    "options", "value", "onChange", "placeholder", "disabled", "error", "style"
  ]);

  const [open, setOpen] = createSignal(false);
  const [focused, setFocused] = createSignal(-1);
  const [dropdownPos, setDropdownPos] = createSignal({ top: 0, left: 0, width: 0 });

  let containerRef: HTMLDivElement | undefined;

  const selectedOption = () => local.options.find(o => o.value === local.value);
  const displayText = () => selectedOption()?.label || local.placeholder || "Select...";

  const updateDropdownPosition = () => {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
  };

  const handleToggle = () => {
    if (local.disabled) return;
    if (!open()) updateDropdownPosition();
    setOpen(!open());
    if (!open()) {
      const idx = local.options.findIndex(o => o.value === local.value);
      setFocused(idx >= 0 ? idx : 0);
    }
  };

  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    local.onChange?.(option.value);
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (local.disabled) return;
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (open() && focused() >= 0) {
          const opt = local.options[focused()];
          if (opt && !opt.disabled) handleSelect(opt);
        } else {
          handleToggle();
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!open()) handleToggle();
        else setFocused(i => Math.min(i + 1, local.options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocused(i => Math.max(i - 1, 0));
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (!containerRef?.contains(e.target as Node)) setOpen(false);
  };

  onMount(() => document.addEventListener("mousedown", handleClickOutside));
  onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));

  const [isHovered, setIsHovered] = createSignal(false);

  const triggerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    gap: "8px",
    height: "32px",
    padding: "8px 12px",
    background: "var(--surface-input)",
    border: local.error
      ? "1px solid var(--state-error)"
      : isHovered() && !local.disabled
        ? "1px solid var(--border-hover)"
        : "1px solid var(--border-default)",
    "border-radius": "var(--cortex-radius-md)",
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: local.value ? "var(--text-primary)" : "var(--text-placeholder)",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    transition: "border-color 150ms ease",
    ...local.style,
  });

  const dropdownStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    top: `${dropdownPos().top}px`,
    left: `${dropdownPos().left}px`,
    width: `${dropdownPos().width}px`,
    "max-height": "200px",
    "overflow-y": "auto",
    background: "var(--surface-input)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--cortex-radius-md)",
    "box-shadow": "0px 8px 24px rgba(0, 0, 0, 0.4)",
    "z-index": "var(--cortex-z-highest)",
    padding: "4px",
  });

  const optionStyle = (opt: SelectOption, idx: number): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    height: "28px",
    padding: "0 8px",
    "border-radius": "var(--cortex-radius-sm)",
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: opt.disabled ? "var(--text-placeholder)" : "var(--text-primary)",
    background: idx === focused() && !opt.disabled ? "var(--surface-hover)" : "transparent",
    cursor: opt.disabled ? "not-allowed" : "pointer",
    opacity: opt.disabled ? "0.5" : "1",
    transition: "background 150ms ease",
  });

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        style={triggerStyle()}
        disabled={local.disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-haspopup="listbox"
        aria-expanded={open()}
      >
        <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          {displayText()}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ "flex-shrink": "0" }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <Show when={open()}>
        <Portal>
          <div role="listbox" style={dropdownStyle()}>
            <For each={local.options}>
              {(opt, idx) => (
                <div
                  role="option"
                  aria-selected={opt.value === local.value}
                  aria-disabled={opt.disabled}
                  style={optionStyle(opt, idx())}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => !opt.disabled && setFocused(idx())}
                >
                  {opt.label}
                </div>
              )}
            </For>
          </div>
        </Portal>
      </Show>
    </div>
  );
}


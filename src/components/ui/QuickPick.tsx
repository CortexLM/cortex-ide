/**
 * =============================================================================
 * QUICK PICK COMPONENT - Generic Selection Widget
 * =============================================================================
 * 
 * A VS Code-style QuickPick component for SolidJS with full feature parity:
 * - Generic type support `QuickPick<T>`
 * - Items with label, description, detail, icon, buttons
 * - Multi-select mode with checkboxes
 * - Fuzzy filtering with match highlights
 * - Sections with separators
 * - Item action buttons (on hover)
 * - Keyboard navigation
 * - Loading state
 * - Async item providers
 * 
 * @example
 * ```tsx
 * <QuickPick
 *   items={items}
 *   onSelect={(item) => console.log(item)}
 *   placeholder="Select an item..."
 * />
 * ```
 */

import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
  JSX,
  Component,
} from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import { Icon } from './Icon';
import "@/styles/quickinput.css";

// =============================================================================
// Types
// =============================================================================

/** Button displayed on quick pick items */
export interface QuickPickItemButton {
  /** Icon component to render */
  icon: Component<{ style?: JSX.CSSProperties }>;
  /** Tooltip text */
  tooltip?: string;
  /** Whether this button should always be visible (not just on hover) */
  alwaysVisible?: boolean;
}

/** A single item in the quick pick list */
export interface QuickPickItem<T = unknown> {
  /** Primary label text */
  label: string;
  /** Secondary description (shown after label) */
  description?: string;
  /** Detailed information (shown on second line) */
  detail?: string;
  /** Icon component to render */
  icon?: Component<{ style?: JSX.CSSProperties }>;
  /** Icon color */
  iconColor?: string;
  /** Action buttons shown on the right */
  buttons?: QuickPickItemButton[];
  /** Whether this item is currently picked (for multi-select) */
  picked?: boolean;
  /** Whether this item should always be shown (bypass filtering) */
  alwaysShow?: boolean;
  /** Whether this item is a separator */
  kind?: "separator" | "default";
  /** The underlying data associated with this item */
  data?: T;
}

/** A group/section of items */
export interface QuickPickItemSection<T = unknown> {
  /** Section label */
  label: string;
  /** Items in this section */
  items: QuickPickItem<T>[];
}

/** Options for configuring the quick pick */
export interface QuickPickOptions<T = unknown> {
  /** Placeholder text for the input */
  placeholder?: string;
  /** Title shown in the header */
  title?: string;
  /** Whether to allow multiple selections */
  canSelectMany?: boolean;
  /** Whether to match on description in addition to label */
  matchOnDescription?: boolean;
  /** Whether to match on detail in addition to label */
  matchOnDetail?: boolean;
  /** Custom filter function */
  filter?: (item: QuickPickItem<T>, query: string) => boolean;
  /** Whether the picker is currently busy/loading */
  busy?: boolean;
  /** Message to show when no items match */
  noResultsMessage?: string;
  /** Whether to ignore focus out events */
  ignoreFocusOut?: boolean;
  /** Step indicator (e.g., "1/3") */
  step?: number;
  /** Total steps */
  totalSteps?: number;
  /** Value to pre-fill the input with */
  value?: string;
  /** Whether items should be sorted by label */
  sortByLabel?: boolean;
  /** Keep scroll position when items change */
  keepScrollPosition?: boolean;
  
  // Multi-step wizard support
  /** Whether to show the back button (for multi-step wizards) */
  showBackButton?: boolean;
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Whether back navigation is available */
  canGoBack?: boolean;
  /** Wizard state to carry between steps */
  wizardState?: unknown;
  /** Help text to show below the input */
  helpText?: string;
  /** Whether this is part of a wizard (enables Alt+Left for back) */
  isWizardStep?: boolean;
}

/** Props for the QuickPick component */
export interface QuickPickProps<T = unknown> extends QuickPickOptions<T> {
  /** Whether the quick pick is open */
  open: boolean;
  /** Items to display (can be flat or sectioned) */
  items: QuickPickItem<T>[] | QuickPickItemSection<T>[];
  /** Callback when an item is selected (single select mode) */
  onSelect?: (item: QuickPickItem<T>) => void;
  /** Callback when items are selected (multi-select mode) */
  onSelectMany?: (items: QuickPickItem<T>[]) => void;
  /** Callback when the quick pick is closed */
  onClose?: () => void;
  /** Callback when the input value changes */
  onValueChange?: (value: string) => void;
  /** Callback when an item button is clicked */
  onItemButtonClick?: (item: QuickPickItem<T>, button: QuickPickItemButton, index: number) => void;
  /** Callback when active item changes (for preview) */
  onActiveItemChange?: (item: QuickPickItem<T> | undefined) => void;
  /** Custom rendering for item label */
  renderLabel?: (item: QuickPickItem<T>, matches: number[]) => JSX.Element;
  /** Custom rendering for item description */
  renderDescription?: (item: QuickPickItem<T>, matches: number[]) => JSX.Element;
  /** Async item provider - called when query changes */
  itemProvider?: (query: string) => Promise<QuickPickItem<T>[]>;
  /** Debounce delay for async item provider (ms) */
  itemProviderDebounce?: number;
}

// =============================================================================
// Fuzzy Matching
// =============================================================================

interface FuzzyResult {
  score: number;
  matches: number[];
}

/**
 * Fuzzy match algorithm with character indices for highlighting.
 * Scores consecutive matches, word boundaries, and shorter strings higher.
 */
function fuzzyMatch(query: string, text: string): FuzzyResult {
  if (!query) return { score: 0, matches: [] };
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Quick rejection: all query chars must exist in text
  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (textLower[ti] === queryLower[qi]) qi++;
  }
  if (qi !== query.length) return { score: 0, matches: [] };
  
  // Full scoring
  const matches: number[] = [];
  let score = 0;
  let lastMatchIndex = -1;
  let consecutiveBonus = 0;
  
  qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (textLower[ti] === queryLower[qi]) {
      matches.push(ti);
      let charScore = 1;
      
      // Consecutive match bonus (exponential)
      if (lastMatchIndex === ti - 1) {
        consecutiveBonus++;
        charScore += consecutiveBonus * 5;
      } else {
        consecutiveBonus = 0;
      }
      
      // Word boundary bonus
      if (ti === 0) {
        charScore += 10; // Start of string
      } else {
        const prevChar = text[ti - 1];
        if (/[\s_\-./\\]/.test(prevChar)) {
          charScore += 8; // Word separator
        } else if (prevChar.toLowerCase() === prevChar && text[ti].toLowerCase() !== text[ti]) {
          charScore += 6; // camelCase boundary
        }
      }
      
      // Exact case match bonus
      if (query[qi] === text[ti]) {
        charScore += 2;
      }
      
      // Penalty for distance from last match
      if (lastMatchIndex >= 0 && ti - lastMatchIndex > 1) {
        charScore -= Math.min(ti - lastMatchIndex - 1, 3);
      }
      
      score += charScore;
      lastMatchIndex = ti;
      qi++;
    }
  }
  
  // Length penalty - shorter names are better
  score = score * (1 + 10 / (text.length + 10));
  
  return { score, matches };
}

/**
 * Highlight matched characters in text
 */
function highlightMatches(text: string, matches: number[]): JSX.Element {
  if (!matches || matches.length === 0) {
    return <span>{text}</span>;
  }
  
  const result: JSX.Element[] = [];
  let lastIndex = 0;
  const matchSet = new Set(matches);
  
  for (let i = 0; i < text.length; i++) {
    if (matchSet.has(i)) {
      if (i > lastIndex) {
        result.push(<span>{text.slice(lastIndex, i)}</span>);
      }
      result.push(<span class="quick-input-highlight">{text[i]}</span>);
      lastIndex = i + 1;
    }
  }
  
  if (lastIndex < text.length) {
    result.push(<span>{text.slice(lastIndex)}</span>);
  }
  
  return <>{result}</>;
}

// =============================================================================
// Utility Functions
// =============================================================================

/** Type guard to check if items are sectioned */
function isSectionedItems<T>(
  items: QuickPickItem<T>[] | QuickPickItemSection<T>[]
): items is QuickPickItemSection<T>[] {
  return items.length > 0 && "items" in items[0];
}

/** Flatten sectioned items into a flat list with separators */
function flattenItems<T>(
  items: QuickPickItem<T>[] | QuickPickItemSection<T>[]
): QuickPickItem<T>[] {
  if (!isSectionedItems(items)) {
    return items;
  }
  
  const result: QuickPickItem<T>[] = [];
  for (const section of items) {
    // Add section header as separator
    result.push({
      label: section.label,
      kind: "separator",
    });
    result.push(...section.items);
  }
  return result;
}

// =============================================================================
// QuickPick Component
// =============================================================================

export function QuickPick<T = unknown>(props: QuickPickProps<T>) {
  const [query, setQuery] = createSignal(props.value ?? "");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [selectedItems, setSelectedItems] = createSignal<Set<QuickPickItem<T>>>(new Set());
  const [isLoading, setIsLoading] = createSignal(false);
  const [asyncItems, setAsyncItems] = createSignal<QuickPickItem<T>[]>([]);
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null);
  
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Initialize selected items from picked state
  createEffect(() => {
    if (props.open) {
      const flatItems = flattenItems(props.items);
      const picked = new Set(flatItems.filter(item => item.picked));
      setSelectedItems(picked);
      setQuery(props.value ?? "");
      setSelectedIndex(0);
      setTimeout(() => inputRef?.focus(), 10);
    }
  });

  // Handle async item provider
  createEffect(() => {
    if (!props.itemProvider) return;
    
    const q = query();
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const delay = props.itemProviderDebounce ?? 150;
    debounceTimer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const items = await props.itemProvider!(q);
        setAsyncItems(items);
      } catch (e) {
        console.error("QuickPick: Error fetching items", e);
        setAsyncItems([]);
      } finally {
        setIsLoading(false);
      }
    }, delay);
  });

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  // Get the effective items (async or prop-based)
  const effectiveItems = createMemo(() => {
    if (props.itemProvider) {
      return asyncItems();
    }
    return flattenItems(props.items);
  });

  // Filter and score items
  const filteredItems = createMemo(() => {
    const q = query().trim();
    const items = effectiveItems();
    
    if (!q) {
      return items.map(item => ({
        item,
        labelMatches: [] as number[],
        descriptionMatches: [] as number[],
        detailMatches: [] as number[],
        score: 0,
      }));
    }
    
    const results: Array<{
      item: QuickPickItem<T>;
      labelMatches: number[];
      descriptionMatches: number[];
      detailMatches: number[];
      score: number;
    }> = [];
    
    for (const item of items) {
      // Separators are always shown
      if (item.kind === "separator") {
        results.push({
          item,
          labelMatches: [],
          descriptionMatches: [],
          detailMatches: [],
          score: 0,
        });
        continue;
      }
      
      // Always show items with alwaysShow flag
      if (item.alwaysShow) {
        results.push({
          item,
          labelMatches: [],
          descriptionMatches: [],
          detailMatches: [],
          score: 0,
        });
        continue;
      }
      
      // Custom filter function
      if (props.filter) {
        if (props.filter(item, q)) {
          results.push({
            item,
            labelMatches: [],
            descriptionMatches: [],
            detailMatches: [],
            score: 1,
          });
        }
        continue;
      }
      
      // Default fuzzy matching
      const labelResult = fuzzyMatch(q, item.label);
      let descriptionResult: FuzzyResult = { score: 0, matches: [] };
      let detailResult: FuzzyResult = { score: 0, matches: [] };
      
      if (props.matchOnDescription && item.description) {
        descriptionResult = fuzzyMatch(q, item.description);
      }
      if (props.matchOnDetail && item.detail) {
        detailResult = fuzzyMatch(q, item.detail);
      }
      
      const totalScore = labelResult.score * 2 + descriptionResult.score + detailResult.score;
      
      if (totalScore > 0) {
        results.push({
          item,
          labelMatches: labelResult.matches,
          descriptionMatches: descriptionResult.matches,
          detailMatches: detailResult.matches,
          score: totalScore,
        });
      }
    }
    
    // Sort by score (descending), but keep separators in place
    if (q) {
      results.sort((a, b) => {
        if (a.item.kind === "separator" && b.item.kind !== "separator") return -1;
        if (b.item.kind === "separator" && a.item.kind !== "separator") return 1;
        return b.score - a.score;
      });
    }
    
    // Optional: sort by label
    if (props.sortByLabel && !q) {
      results.sort((a, b) => {
        if (a.item.kind === "separator" || b.item.kind === "separator") return 0;
        return a.item.label.localeCompare(b.item.label);
      });
    }
    
    return results;
  });

  // Get selectable items (excluding separators)
  const selectableItems = createMemo(() => {
    return filteredItems().filter(r => r.item.kind !== "separator");
  });

  // Reset selection when query changes
  createEffect(() => {
    query();
    setSelectedIndex(0);
  });

  // Scroll selected item into view
  createEffect(() => {
    const index = selectedIndex();
    if (listRef && props.open) {
      const items = listRef.querySelectorAll("[data-quickpick-item]");
      const selectedItem = items[index] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });

  // Notify active item change
  createEffect(() => {
    const items = selectableItems();
    const index = selectedIndex();
    const activeItem = items[index]?.item;
    props.onActiveItemChange?.(activeItem);
  });

  // Handle input change
  const handleInputChange = (value: string) => {
    setQuery(value);
    props.onValueChange?.(value);
  };

  // Handle item selection
  const handleSelect = (item: QuickPickItem<T>) => {
    if (item.kind === "separator") return;
    
    if (props.canSelectMany) {
      setSelectedItems(prev => {
        const next = new Set(prev);
        if (next.has(item)) {
          next.delete(item);
        } else {
          next.add(item);
        }
        return next;
      });
    } else {
      props.onSelect?.(item);
      props.onClose?.();
    }
  };

  // Handle back navigation for wizards
  const handleBack = () => {
    if (props.canGoBack && props.onBack) {
      props.onBack();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    const items = selectableItems();
    
    // Alt+Left for back navigation in wizard mode
    if (e.altKey && e.key === "ArrowLeft" && props.isWizardStep) {
      e.preventDefault();
      handleBack();
      return;
    }
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        const selectedItem = items[selectedIndex()]?.item;
        if (selectedItem) {
          handleSelect(selectedItem);
        }
        if (props.canSelectMany) {
          props.onSelectMany?.(Array.from(selectedItems()));
          props.onClose?.();
        }
        break;
      case "Escape":
        e.preventDefault();
        // In wizard mode with back navigation available, Escape goes back
        if (props.isWizardStep && props.canGoBack && props.onBack) {
          handleBack();
        } else {
          props.onClose?.();
        }
        break;
      case " ":
        if (props.canSelectMany) {
          e.preventDefault();
          const item = items[selectedIndex()]?.item;
          if (item) handleSelect(item);
        }
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          setSelectedIndex(i => Math.max(i - 1, 0));
        } else {
          setSelectedIndex(i => Math.min(i + 1, items.length - 1));
        }
        break;
      case "Home":
        e.preventDefault();
        setSelectedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setSelectedIndex(items.length - 1);
        break;
      case "PageUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 10, 0));
        break;
      case "PageDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 10, items.length - 1));
        break;
    }
  };

  // Handle item button click
  const handleItemButtonClick = (
    e: MouseEvent,
    item: QuickPickItem<T>,
    button: QuickPickItemButton,
    buttonIndex: number
  ) => {
    e.stopPropagation();
    props.onItemButtonClick?.(item, button, buttonIndex);
  };

  // Handle backdrop click
  const handleBackdropClick = () => {
    if (!props.ignoreFocusOut) {
      props.onClose?.();
    }
  };

  // Global escape handler
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && props.open) {
      e.preventDefault();
      e.stopPropagation();
      props.onClose?.();
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown, true);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown, true);
  });

  // Track selectable index for items (skip separators)
  let selectableIndex = -1;
  const getSelectableIndex = (item: QuickPickItem<T>): number => {
    if (item.kind === "separator") return -1;
    selectableIndex++;
    return selectableIndex;
  };

  // Render item
  const renderItem = (
    result: { item: QuickPickItem<T>; labelMatches: number[]; descriptionMatches: number[]; detailMatches: number[] },
    _index: number
  ) => {
    const item = result.item;
    
    // Handle separator
    if (item.kind === "separator") {
      return (
        <div class="quick-input-group-header">
          {item.label}
        </div>
      );
    }
    
    const selectIdx = getSelectableIndex(item);
    const isSelected = () => selectIdx === selectedIndex();
    const isPicked = () => selectedItems().has(item);
    const isHovered = () => hoveredIndex() === selectIdx;
    const hasDetail = !!item.detail;

    return (
      <div
        data-quickpick-item
        class="quick-input-list-row"
        classList={{
          focused: isSelected(),
          selected: isPicked(),
          "has-detail": hasDetail,
        }}
        role="option"
        aria-selected={isSelected()}
        onMouseEnter={() => {
          setSelectedIndex(selectIdx);
          setHoveredIndex(selectIdx);
        }}
        onMouseLeave={() => setHoveredIndex(null)}
        onClick={() => handleSelect(item)}
      >
        <div class="quick-input-list-entry">
          {/* Checkbox for multi-select */}
          <Show when={props.canSelectMany}>
            <div
              class="quick-input-checkbox"
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "16px",
                height: "16px",
                "border-radius": "var(--jb-radius-sm)",
                border: isPicked() ? "none" : "1px solid var(--jb-border-default)",
                background: isPicked() ? "var(--jb-btn-primary-bg)" : "transparent",
                color: "var(--cortex-text-primary)",
                "flex-shrink": "0",
                "margin-right": "6px",
              }}
            >
              <Show when={isPicked()}>
                <Icon name="check" size={12} />
              </Show>
            </div>
          </Show>

          {/* Icon */}
          <Show when={item.icon}>
            <div class="quick-input-list-icon" style={{ color: item.iconColor }}>
              <Dynamic
                component={item.icon!}
                style={{ width: "16px", height: "16px" }}
              />
            </div>
          </Show>

          {/* Label and description */}
          <div class="quick-input-list-rows">
            <div class="quick-input-list-row-content" style={{ gap: "6px" }}>
              <span class="quick-input-label-name">
                {props.renderLabel
                  ? props.renderLabel(item, result.labelMatches)
                  : highlightMatches(item.label, result.labelMatches)}
              </span>
              <Show when={item.description}>
                <span class="quick-input-label-description">
                  {props.renderDescription
                    ? props.renderDescription(item, result.descriptionMatches)
                    : highlightMatches(item.description!, result.descriptionMatches)}
                </span>
              </Show>
            </div>
            <Show when={item.detail}>
              <div class="quick-input-label-meta">
                {highlightMatches(item.detail!, result.detailMatches)}
              </div>
            </Show>
          </div>

          {/* Action buttons */}
          <Show when={item.buttons && item.buttons.length > 0}>
            <div
              class="quick-input-list-entry-action-bar"
              style={{
                display: isHovered() || isSelected() ? "flex" : "none",
              }}
            >
              <For each={item.buttons}>
                {(button, buttonIdx) => (
                  <button
                    type="button"
                    class="action-label"
                    classList={{ "always-visible": button.alwaysVisible }}
                    title={button.tooltip}
                    onClick={(e) => handleItemButtonClick(e, item, button, buttonIdx())}
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "center",
                      width: "22px",
                      height: "22px",
                      background: "transparent",
                      border: "none",
                      "border-radius": "var(--jb-radius-sm)",
                      color: "var(--jb-text-muted-color)",
                      cursor: "pointer",
                    }}
                  >
                    <Dynamic
                      component={button.icon}
                      style={{ width: "14px", height: "14px" }}
                    />
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    );
  };

  // Reset selectable index before each render
  createEffect(() => {
    filteredItems();
    selectableIndex = -1;
  });

  const isBusy = () => props.busy || isLoading();

  return (
    <Show when={props.open}>
      <Portal>
        {/* Backdrop */}
        <div
          class="quick-input-backdrop animate-in"
          onClick={handleBackdropClick}
        />

        {/* Quick Pick Widget */}
        <div
          class="quick-input-widget quick-input-animate-in"
          classList={{ "show-checkboxes": props.canSelectMany }}
          role="dialog"
          aria-label={props.title || "Quick Pick"}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="quick-input-header">
            {/* Back button for wizard navigation */}
            <Show when={props.showBackButton && props.canGoBack}>
              <button
                type="button"
                class="quick-input-back-button"
                onClick={handleBack}
                title="Back (Alt+Left)"
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  width: "28px",
                  height: "28px",
                  background: "transparent",
                  border: "none",
                  "border-radius": "var(--jb-radius-sm)",
                  color: "var(--jb-text-muted-color)",
                  cursor: "pointer",
                  "flex-shrink": "0",
                  transition: "background 100ms ease, color 100ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--jb-surface-hover)";
                  e.currentTarget.style.color = "var(--jb-text-body-color)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--jb-text-muted-color)";
                }}
              >
                <Icon name="arrow-left" size={16} />
              </button>
            </Show>

            {/* Step indicator */}
            <Show when={props.step && props.totalSteps}>
              <div
                style={{
                  padding: "0 8px",
                  "font-size": "var(--jb-font-size-small)",
                  color: "var(--jb-text-muted-color)",
                }}
              >
                {props.step}/{props.totalSteps}
              </div>
            </Show>

            {/* Title */}
            <Show when={props.title}>
              <div
                class="quick-input-title"
                style={{
                  "font-weight": "600",
                  "margin-bottom": "4px",
                }}
              >
                {props.title}
              </div>
            </Show>

            {/* Help text */}
            <Show when={props.helpText}>
              <div
                style={{
                  "font-size": "var(--jb-font-size-small)",
                  color: "var(--jb-text-muted-color)",
                  "margin-bottom": "4px",
                }}
              >
                {props.helpText}
              </div>
            </Show>

            {/* Input */}
            <div class="quick-input-filter">
              <div class="quick-input-box">
                <div
                  class="monaco-inputbox"
                  style={{
                    "border-radius": "var(--jb-radius-sm)",
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    padding: "0 8px",
                  }}
                >
                  <Icon
                    name="magnifying-glass"
                    size={14}
                    style={{
                      color: "var(--jb-text-muted-color)",
                      "flex-shrink": "0",
                    }}
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    class="quick-input-input"
                    placeholder={props.placeholder || "Type to filter..."}
                    value={query()}
                    onInput={(e) => handleInputChange(e.currentTarget.value)}
                    onKeyDown={handleKeyDown}
                    role="combobox"
                    aria-haspopup="listbox"
                    aria-autocomplete="list"
                    aria-controls="quickpick-list"
                    aria-expanded="true"
                  />
                  <Show when={isBusy()}>
                    <Icon
                      name="spinner"
                      size={14}
                      class="animate-spin"
                      style={{
                        color: "var(--jb-text-muted-color)",
                        "flex-shrink": "0",
                      }}
                    />
                  </Show>
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div
            class="quick-input-progress"
            classList={{
              active: isBusy(),
              infinite: isBusy(),
              delayed: isBusy(),
            }}
          >
            <div class="progress-bit" />
          </div>

          {/* Results list */}
          <div
            id="quickpick-list"
            class="quick-input-list"
            role="listbox"
            aria-label="Items"
          >
            <div
              ref={listRef}
              class="list-container"
              style={{
                "max-height": "440px",
                overflow: "auto",
                "overscroll-behavior": "contain",
              }}
            >
              <Show
                when={filteredItems().length > 0}
                fallback={
                  <div
                    style={{
                      padding: "16px",
                      "text-align": "center",
                    }}
                  >
                    <p
                      style={{
                        "font-size": "var(--jb-font-size-base)",
                        color: "var(--jb-text-muted-color)",
                      }}
                    >
                      {isBusy()
                        ? "Loading..."
                        : props.noResultsMessage || "No matching items"}
                    </p>
                  </div>
                }
              >
                <div class="scrollable-element">
                  <For each={filteredItems()}>
                    {(result, index) => renderItem(result, index())}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          {/* Footer with hints */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "4px 8px",
              "font-size": "var(--jb-font-size-small)",
              "border-top": "1px solid var(--jb-border-default)",
              color: "var(--jb-text-muted-color)",
              background: "var(--jb-canvas)",
            }}
          >
            <span style={{ display: "flex", gap: "12px" }}>
              <span>
                <kbd class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>
                  <span style={{ "font-size": "10px" }}>&#8593;</span>
                </kbd>
                <kbd class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>
                  <span style={{ "font-size": "10px" }}>&#8595;</span>
                </kbd>{" "}
                navigate
              </span>
              <span>
                <kbd class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>
                  Enter
                </kbd>{" "}
                {props.canSelectMany ? "confirm" : "select"}
              </span>
              <Show when={props.canSelectMany}>
                <span>
                  <kbd class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>
                    Space
                  </kbd>{" "}
                  toggle
                </span>
              </Show>
              <Show when={props.isWizardStep && props.canGoBack}>
                <span>
                  <kbd class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>
                    Alt+Left
                  </kbd>{" "}
                  back
                </span>
              </Show>
              <span>
                <kbd class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>
                  Esc
                </kbd>{" "}
                {props.isWizardStep && props.canGoBack ? "back" : "close"}
              </span>
            </span>
            <span>
              {selectableItems().length} item{selectableItems().length !== 1 ? "s" : ""}
              {query() && ` matching "${query()}"`}
              {props.canSelectMany && selectedItems().size > 0 && (
                <> ({selectedItems().size} selected)</>
              )}
            </span>
          </div>
        </div>
      </Portal>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Show>
  );
}

export default QuickPick;


/**
 * =============================================================================
 * QUICK PICK CONTEXT - API for Showing Quick Picks Programmatically
 * =============================================================================
 * 
 * Provides a VS Code-like API for showing quick picks from anywhere in the app:
 * 
 * Simple usage:
 * ```tsx
 * const { showQuickPick } = useQuickPick();
 * const result = await showQuickPick(items, { placeholder: "Select..." });
 * ```
 * 
 * Advanced usage with QuickPick controller:
 * ```tsx
 * const { createQuickPick } = useQuickPick();
 * const qp = createQuickPick<MyItem>();
 * qp.placeholder = "Search symbols...";
 * qp.items = [];
 * qp.onDidChangeValue = async (value) => {
 *   qp.busy = true;
 *   qp.items = await fetchSymbols(value);
 *   qp.busy = false;
 * };
 * qp.onDidAccept = () => {
 *   const selected = qp.selectedItems[0];
 *   if (selected) navigateTo(selected);
 * };
 * qp.show();
 * ```
 */

import {
  createContext,
  useContext,
  createSignal,
  JSX,
} from "solid-js";
import { QuickPick, QuickPickItem, QuickPickItemButton, QuickPickItemSection, QuickPickOptions } from "@/components/ui/QuickPick";

// =============================================================================
// Types
// =============================================================================

/** Options for showQuickPick function */
export interface ShowQuickPickOptions<T> extends QuickPickOptions<T> {
  /** Called when item buttons are clicked */
  onItemButtonClick?: (item: QuickPickItem<T>, button: QuickPickItemButton, index: number) => void;
  /** Called when active item changes (for live preview) */
  onActiveItemChange?: (item: QuickPickItem<T> | undefined) => void;
}

/** A controllable QuickPick instance (similar to VS Code's IQuickPick) */
export interface IQuickPick<T = unknown> {
  // Properties
  /** Items to display */
  items: QuickPickItem<T>[];
  /** Currently selected items (readonly in single-select mode) */
  readonly selectedItems: QuickPickItem<T>[];
  /** Current filter value */
  value: string;
  /** Placeholder text */
  placeholder: string;
  /** Title text */
  title: string;
  /** Whether multiple items can be selected */
  canSelectMany: boolean;
  /** Whether the picker is busy/loading */
  busy: boolean;
  /** Whether to match on description */
  matchOnDescription: boolean;
  /** Whether to match on detail */
  matchOnDetail: boolean;
  /** Step indicator */
  step: number | undefined;
  /** Total steps */
  totalSteps: number | undefined;
  /** Whether to ignore focus out */
  ignoreFocusOut: boolean;
  /** Enabled state */
  enabled: boolean;
  /** Active item (for preview) */
  readonly activeItem: QuickPickItem<T> | undefined;

  // Events
  /** Called when the value changes */
  onDidChangeValue: ((value: string) => void) | undefined;
  /** Called when active item changes */
  onDidChangeActive: ((items: QuickPickItem<T>[]) => void) | undefined;
  /** Called when selection changes (multi-select mode) */
  onDidChangeSelection: ((items: QuickPickItem<T>[]) => void) | undefined;
  /** Called when user accepts selection */
  onDidAccept: (() => void) | undefined;
  /** Called when the picker is hidden */
  onDidHide: (() => void) | undefined;
  /** Called when item buttons are triggered */
  onDidTriggerItemButton: ((event: { button: QuickPickItemButton; item: QuickPickItem<T> }) => void) | undefined;

  // Methods
  /** Show the quick pick */
  show(): void;
  /** Hide the quick pick */
  hide(): void;
  /** Dispose the quick pick */
  dispose(): void;
}

/** Context value */
interface QuickPickContextValue {
  /**
   * Show a quick pick and wait for user selection.
   * Returns the selected item or undefined if cancelled.
   */
  showQuickPick<T>(
    items: QuickPickItem<T>[] | QuickPickItemSection<T>[] | Promise<QuickPickItem<T>[]>,
    options?: ShowQuickPickOptions<T>
  ): Promise<QuickPickItem<T> | undefined>;

  /**
   * Show a quick pick in multi-select mode.
   * Returns the selected items or undefined if cancelled.
   */
  showQuickPickMany<T>(
    items: QuickPickItem<T>[] | QuickPickItemSection<T>[] | Promise<QuickPickItem<T>[]>,
    options?: ShowQuickPickOptions<T>
  ): Promise<QuickPickItem<T>[] | undefined>;

  /**
   * Create a controllable QuickPick instance for advanced use cases.
   * This gives you full control over the picker's lifecycle and state.
   */
  createQuickPick<T>(): IQuickPick<T>;
}

// =============================================================================
// Context
// =============================================================================

const QuickPickContext = createContext<QuickPickContextValue>();

// =============================================================================
// Internal State Types
// =============================================================================

interface QuickPickState<T = unknown> {
  id: number;
  open: boolean;
  items: QuickPickItem<T>[] | QuickPickItemSection<T>[];
  options: ShowQuickPickOptions<T>;
  resolve: (value: QuickPickItem<T> | QuickPickItem<T>[] | undefined) => void;
  isMultiSelect: boolean;
  controller?: IQuickPick<T>;
}

// =============================================================================
// Provider Component
// =============================================================================

export function QuickPickProvider(props: { children: JSX.Element }) {
  const [activeQuickPick, setActiveQuickPick] = createSignal<QuickPickState | null>(null);
  let nextId = 0;

  // Show quick pick (single select)
  const showQuickPick = async <T,>(
    items: QuickPickItem<T>[] | QuickPickItemSection<T>[] | Promise<QuickPickItem<T>[]>,
    options: ShowQuickPickOptions<T> = {}
  ): Promise<QuickPickItem<T> | undefined> => {
    const resolvedItems = await Promise.resolve(items);
    
    return new Promise((resolve) => {
      const state: QuickPickState<T> = {
        id: nextId++,
        open: true,
        items: resolvedItems,
        options,
        resolve: resolve as (value: QuickPickItem<T> | QuickPickItem<T>[] | undefined) => void,
        isMultiSelect: false,
      };
      setActiveQuickPick(state as QuickPickState);
    });
  };

  // Show quick pick (multi select)
  const showQuickPickMany = async <T,>(
    items: QuickPickItem<T>[] | QuickPickItemSection<T>[] | Promise<QuickPickItem<T>[]>,
    options: ShowQuickPickOptions<T> = {}
  ): Promise<QuickPickItem<T>[] | undefined> => {
    const resolvedItems = await Promise.resolve(items);
    
    return new Promise((resolve) => {
      const state: QuickPickState<T> = {
        id: nextId++,
        open: true,
        items: resolvedItems,
        options: { ...options, canSelectMany: true },
        resolve: resolve as (value: QuickPickItem<T> | QuickPickItem<T>[] | undefined) => void,
        isMultiSelect: true,
      };
      setActiveQuickPick(state as QuickPickState);
    });
  };

  // Create a controllable QuickPick instance
  const createQuickPick = <T,>(): IQuickPick<T> => {
    // Internal state
    let _items: QuickPickItem<T>[] = [];
    let _selectedItems: QuickPickItem<T>[] = [];
    let _activeItem: QuickPickItem<T> | undefined;
    let _value = "";
    let _placeholder = "";
    let _title = "";
    let _canSelectMany = false;
    let _busy = false;
    let _matchOnDescription = false;
    let _matchOnDetail = false;
    let _step: number | undefined;
    let _totalSteps: number | undefined;
    let _ignoreFocusOut = false;
    let _enabled = true;
    let _disposed = false;

    // Event handlers
    let _onDidChangeValue: ((value: string) => void) | undefined;
    let _onDidChangeActive: ((items: QuickPickItem<T>[]) => void) | undefined;
    let _onDidChangeSelection: ((items: QuickPickItem<T>[]) => void) | undefined;
    let _onDidAccept: (() => void) | undefined;
    let _onDidHide: (() => void) | undefined;
    let _onDidTriggerItemButton: ((event: { button: QuickPickItemButton; item: QuickPickItem<T> }) => void) | undefined;

    // Resolve function for the promise
    let _resolve: ((value: QuickPickItem<T> | QuickPickItem<T>[] | undefined) => void) | undefined;

    const controller: IQuickPick<T> = {
      // Getters and setters
      get items() { return _items; },
      set items(value) { 
        _items = value;
        // Update the active quick pick if this controller is active
        const current = activeQuickPick();
        if (current?.controller === controller) {
          setActiveQuickPick({ ...current, items: value } as QuickPickState);
        }
      },

      get selectedItems() { return _selectedItems; },

      get value() { return _value; },
      set value(v) { 
        _value = v;
        _onDidChangeValue?.(v);
      },

      get placeholder() { return _placeholder; },
      set placeholder(v) { _placeholder = v; updateState(); },

      get title() { return _title; },
      set title(v) { _title = v; updateState(); },

      get canSelectMany() { return _canSelectMany; },
      set canSelectMany(v) { _canSelectMany = v; updateState(); },

      get busy() { return _busy; },
      set busy(v) { _busy = v; updateState(); },

      get matchOnDescription() { return _matchOnDescription; },
      set matchOnDescription(v) { _matchOnDescription = v; updateState(); },

      get matchOnDetail() { return _matchOnDetail; },
      set matchOnDetail(v) { _matchOnDetail = v; updateState(); },

      get step() { return _step; },
      set step(v) { _step = v; updateState(); },

      get totalSteps() { return _totalSteps; },
      set totalSteps(v) { _totalSteps = v; updateState(); },

      get ignoreFocusOut() { return _ignoreFocusOut; },
      set ignoreFocusOut(v) { _ignoreFocusOut = v; updateState(); },

      get enabled() { return _enabled; },
      set enabled(v) { _enabled = v; updateState(); },

      get activeItem() { return _activeItem; },

      // Event setters
      get onDidChangeValue() { return _onDidChangeValue; },
      set onDidChangeValue(fn) { _onDidChangeValue = fn; },

      get onDidChangeActive() { return _onDidChangeActive; },
      set onDidChangeActive(fn) { _onDidChangeActive = fn; },

      get onDidChangeSelection() { return _onDidChangeSelection; },
      set onDidChangeSelection(fn) { _onDidChangeSelection = fn; },

      get onDidAccept() { return _onDidAccept; },
      set onDidAccept(fn) { _onDidAccept = fn; },

      get onDidHide() { return _onDidHide; },
      set onDidHide(fn) { _onDidHide = fn; },

      get onDidTriggerItemButton() { return _onDidTriggerItemButton; },
      set onDidTriggerItemButton(fn) { _onDidTriggerItemButton = fn; },

      // Methods
      show() {
        if (_disposed) return;
        
        const state: QuickPickState<T> = {
          id: nextId++,
          open: true,
          items: _items,
          options: {
            placeholder: _placeholder,
            title: _title,
            canSelectMany: _canSelectMany,
            busy: _busy,
            matchOnDescription: _matchOnDescription,
            matchOnDetail: _matchOnDetail,
            step: _step,
            totalSteps: _totalSteps,
            ignoreFocusOut: _ignoreFocusOut,
            value: _value,
            onActiveItemChange: (item) => {
              _activeItem = item;
              if (item) {
                _onDidChangeActive?.([item]);
              }
            },
            onItemButtonClick: (item, button) => {
              _onDidTriggerItemButton?.({ button, item });
            },
          },
          resolve: (value) => {
            _resolve?.(value);
          },
          isMultiSelect: _canSelectMany,
          controller: controller,
        };
        
        setActiveQuickPick(state as unknown as QuickPickState<unknown>);
      },

      hide() {
        const current = activeQuickPick();
        if (current?.controller === controller) {
          setActiveQuickPick(null);
          _onDidHide?.();
        }
      },

      dispose() {
        _disposed = true;
        controller.hide();
      },
    };

    // Helper to update state
    const updateState = () => {
      const current = activeQuickPick();
      if (current?.controller === controller) {
        setActiveQuickPick({
          ...current,
          items: _items,
          options: {
            ...current.options,
            placeholder: _placeholder,
            title: _title,
            canSelectMany: _canSelectMany,
            busy: _busy,
            matchOnDescription: _matchOnDescription,
            matchOnDetail: _matchOnDetail,
            step: _step,
            totalSteps: _totalSteps,
            ignoreFocusOut: _ignoreFocusOut,
          },
        } as QuickPickState);
      }
    };

    return controller;
  };

  // Handle selection
  const handleSelect = (item: QuickPickItem) => {
    const state = activeQuickPick();
    if (!state) return;

    // If using controller, call its accept handler
    if (state.controller) {
      (state.controller as IQuickPick<unknown>).onDidAccept?.();
    }

    state.resolve(item);
    setActiveQuickPick(null);
  };

  // Handle multi-select
  const handleSelectMany = (items: QuickPickItem[]) => {
    const state = activeQuickPick();
    if (!state) return;

    // If using controller, call its accept handler
    if (state.controller) {
      (state.controller as IQuickPick<unknown>).onDidAccept?.();
    }

    state.resolve(items);
    setActiveQuickPick(null);
  };

  // Handle close
  const handleClose = () => {
    const state = activeQuickPick();
    if (!state) return;

    // If using controller, call its hide handler
    if (state.controller) {
      (state.controller as IQuickPick<unknown>).onDidHide?.();
    }

    state.resolve(undefined);
    setActiveQuickPick(null);
  };

  // Handle value change
  const handleValueChange = (value: string) => {
    const state = activeQuickPick();
    if (!state) return;

    // If using controller, call its value change handler
    if (state.controller) {
      const ctrl = state.controller as IQuickPick<unknown>;
      ctrl.onDidChangeValue?.(value);
    }
  };

  // Handle active item change
  const handleActiveItemChange = (item: QuickPickItem | undefined) => {
    const state = activeQuickPick();
    if (!state) return;

    // Call the option handler
    state.options.onActiveItemChange?.(item);

    // If using controller, call its handler
    if (state.controller) {
      const ctrl = state.controller as IQuickPick<unknown>;
      if (item) {
        ctrl.onDidChangeActive?.([item]);
      }
    }
  };

  // Handle item button click
  const handleItemButtonClick = (
    item: QuickPickItem,
    button: QuickPickItemButton,
    index: number
  ) => {
    const state = activeQuickPick();
    if (!state) return;

    // Call the option handler
    state.options.onItemButtonClick?.(item, button, index);

    // If using controller, call its handler
    if (state.controller) {
      const ctrl = state.controller as IQuickPick<unknown>;
      ctrl.onDidTriggerItemButton?.({ button, item });
    }
  };

  const value: QuickPickContextValue = {
    showQuickPick,
    showQuickPickMany,
    createQuickPick,
  };

  return (
    <QuickPickContext.Provider value={value}>
      {props.children}
      
      {/* Render the active quick pick */}
      {(() => {
        const state = activeQuickPick();
        if (!state) return null;

        return (
          <QuickPick
            open={state.open}
            items={state.items}
            placeholder={state.options.placeholder}
            title={state.options.title}
            canSelectMany={state.options.canSelectMany}
            busy={state.options.busy}
            matchOnDescription={state.options.matchOnDescription}
            matchOnDetail={state.options.matchOnDetail}
            noResultsMessage={state.options.noResultsMessage}
            ignoreFocusOut={state.options.ignoreFocusOut}
            step={state.options.step}
            totalSteps={state.options.totalSteps}
            value={state.options.value}
            sortByLabel={state.options.sortByLabel}
            filter={state.options.filter}
            onSelect={handleSelect}
            onSelectMany={handleSelectMany}
            onClose={handleClose}
            onValueChange={handleValueChange}
            onActiveItemChange={handleActiveItemChange}
            onItemButtonClick={handleItemButtonClick}
          />
        );
      })()}
    </QuickPickContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useQuickPick() {
  const context = useContext(QuickPickContext);
  if (!context) {
    throw new Error("useQuickPick must be used within a QuickPickProvider");
  }
  return context;
}

export default QuickPickProvider;

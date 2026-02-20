/**
 * QuickInputContext
 * 
 * Provides a VS Code-style input box API for the application.
 * 
 * Usage:
 * ```tsx
 * const { showInputBox } = useQuickInput();
 * 
 * // Simple usage
 * const name = await showInputBox({ prompt: "Enter file name" });
 * 
 * // With validation
 * const email = await showInputBox({
 *   title: "Enter Email",
 *   prompt: "We'll send a confirmation to this address",
 *   validateInput: (value) => {
 *     if (!value.includes("@")) {
 *       return { valid: false, message: "Invalid email format", severity: "error" };
 *     }
 *     return { valid: true };
 *   },
 * });
 * 
 * // Multi-step flow
 * const step1 = await showInputBox({
 *   title: "Create Project",
 *   step: { current: 1, total: 3 },
 *   prompt: "Enter project name",
 * });
 * 
 * // Accept in background (Ctrl+Enter)
 * const result = await showInputBox({
 *   prompt: "Enter search term",
 *   canAcceptInBackground: true,
 *   onDidAcceptInBackground: (value) => {
 *     // Perform background search without closing
 *     performBackgroundSearch(value);
 *   },
 * });
 * 
 * // Quick Pick with tree items
 * const selected = await showQuickPick({
 *   title: "Select Files",
 *   treeItems: folderStructure,
 *   itemActivation: ItemActivation.FIRST,
 * });
 * ```
 */

import {
  createContext,
  useContext,
  createSignal,
  JSX,
  batch,
  createEffect,
  onCleanup,
} from "solid-js";
import {
  QuickInput,
  QuickInputOptions,
  QuickInputButton,
  ValidationResult,
  normalizeValidation,
} from "@/components/ui/QuickInput";
import {
  ItemActivation,
  QuickNavigateConfiguration,
  QuickTreeItem,
  QuickPickSeparatorWithButtons,
  QuickInputExtendedOptions,
  QuickTreePickOptions,
  QuickPickItemExtendedOptions,
  FlattenedTreeItem,
  CheckboxState,
  QuickTreeNodeEvent,
} from "@/types/quickInput";

// ============================================================================
// Types
// ============================================================================

/** Quick Pick item with extended options */
export interface QuickPickItem<T = unknown> extends QuickPickItemExtendedOptions<T> {
  /** Display label for the item */
  label: string;
  /** Optional description shown after the label */
  description?: string;
  /** Optional detail text shown below the label */
  detail?: string;
  /** Icon path or icon identifier */
  iconPath?: string;
  /** Value associated with this item */
  value?: T;
  /** Whether this is a separator */
  kind?: "item" | "separator";
  /** Buttons to show for this item */
  buttons?: QuickInputButton[];
}

/** Separator item for quick pick */
export interface QuickPickSeparator extends QuickPickSeparatorWithButtons {
  kind: "separator";
}

/** Union type for quick pick list items */
export type QuickPickListItem<T = unknown> = QuickPickItem<T> | QuickPickSeparator;

/** Internal state for the quick input */
interface QuickInputState extends QuickInputOptions, QuickInputExtendedOptions {
  visible: boolean;
  currentValue: string;
  validation: ValidationResult | null;
  validating: boolean;
  resolve: ((value: string | undefined) => void) | null;
  onBack?: () => void;
  onButton?: (button: QuickInputButton) => void;
}

/** Internal state for quick pick */
interface QuickPickState<T = unknown> {
  visible: boolean;
  title?: string;
  placeholder?: string;
  items: QuickPickListItem<T>[];
  treeItems?: QuickTreeItem<T>[];
  flattenedTreeItems?: FlattenedTreeItem<T>[];
  selectedItems: QuickPickItem<T>[];
  activeItem?: QuickPickItem<T>;
  activeIndex: number;
  filterValue: string;
  transformedFilterValue: string;
  canSelectMany: boolean;
  matchOnDescription: boolean;
  matchOnDetail: boolean;
  busy: boolean;
  enabled: boolean;
  ignoreFocusOut: boolean;
  step?: { current: number; total: number };
  buttons?: QuickInputButton[];
  
  // Extended options
  itemActivation: ItemActivation;
  quickNavigate?: QuickNavigateConfiguration;
  canAcceptInBackground: boolean;
  showKeybindings: boolean;
  filterFunction?: (input: string, item: QuickPickItem<T>) => boolean;
  filterValueTransform?: (value: string) => string;
  
  // Callbacks
  resolve: ((value: QuickPickItem<T> | QuickPickItem<T>[] | undefined) => void) | null;
  onBack?: () => void;
  onButton?: (button: QuickInputButton) => void;
  onDidAcceptInBackground?: (item: QuickPickItem<T>) => void;
  onItemButton?: (item: QuickPickItem<T>, button: QuickInputButton) => void;
  onSeparatorButton?: (separator: QuickPickSeparator, button: QuickInputButton) => void;
  onTreeNodeToggle?: (event: QuickTreeNodeEvent<T>) => void;
  onCheckboxChange?: (item: QuickTreeItem<T>, state: CheckboxState) => void;
}

/** Extended options that include callbacks for multi-step flows */
export interface ShowInputBoxOptions extends QuickInputOptions, QuickInputExtendedOptions {
  /** Callback when back button is clicked (return false to prevent closing) */
  onBack?: () => boolean | void | Promise<boolean | void>;
  /** Callback when a custom button is clicked */
  onButton?: (button: QuickInputButton) => void | Promise<void>;
}

/** Options for showing a quick pick */
export interface ShowQuickPickOptions<T = unknown> extends Partial<Omit<QuickTreePickOptions<T>, 'filterFunction' | 'onDidAcceptInBackground'>> {
  /** Title of the quick pick */
  title?: string;
  /** Placeholder text in the filter input */
  placeholder?: string;
  /** Items to show */
  items?: QuickPickListItem<T>[];
  /** Tree items for hierarchical display */
  treeItems?: QuickTreeItem<T>[];
  /** Whether multiple items can be selected */
  canSelectMany?: boolean;
  /** Whether to match on item description */
  matchOnDescription?: boolean;
  /** Whether to match on item detail */
  matchOnDetail?: boolean;
  /** Initial filter value */
  value?: string;
  /** Whether the picker is busy */
  busy?: boolean;
  /** Whether the picker is enabled */
  enabled?: boolean;
  /** Whether to ignore focus out events */
  ignoreFocusOut?: boolean;
  /** Multi-step indicator */
  step?: { current: number; total: number };
  /** Buttons to show in title bar */
  buttons?: QuickInputButton[];
  /** Initial item activation */
  itemActivation?: ItemActivation;
  /** Quick navigate configuration */
  quickNavigate?: QuickNavigateConfiguration;
  /** Whether items can be accepted in background */
  canAcceptInBackground?: boolean;
  /** Whether to show keybindings on items */
  showKeybindings?: boolean;
  /** Custom filter function */
  filterFunction?: (input: string, item: QuickPickItem<T>) => boolean;
  /** Transform filter value before matching */
  filterValueTransform?: (value: string) => string;
  
  // Callbacks
  /** Callback when back button is clicked */
  onBack?: () => boolean | void | Promise<boolean | void>;
  /** Callback when a title button is clicked */
  onButton?: (button: QuickInputButton) => void | Promise<void>;
  /** Callback when accepting in background */
  onDidAcceptInBackground?: (item: QuickPickItem<T>) => void;
  /** Callback when an item button is clicked */
  onItemButton?: (item: QuickPickItem<T>, button: QuickInputButton) => void;
  /** Callback when a separator button is clicked */
  onSeparatorButton?: (separator: QuickPickSeparator, button: QuickInputButton) => void;
  /** Callback when tree node is expanded/collapsed */
  onTreeNodeToggle?: (event: QuickTreeNodeEvent<T>) => void;
  /** Callback when checkbox state changes */
  onCheckboxChange?: (item: QuickTreeItem<T>, state: CheckboxState) => void;
  /** Callback for lazy loading tree children */
  onLoadChildren?: (item: QuickTreeItem<T>) => Promise<QuickTreeItem<T>[]>;
}

/** Context value provided by QuickInputProvider */
interface QuickInputContextValue {
  /**
   * Show an input box and wait for user input.
   * 
   * @param options - Configuration options for the input box
   * @returns Promise that resolves to the entered value, or undefined if cancelled
   */
  showInputBox: (options: ShowInputBoxOptions) => Promise<string | undefined>;

  /**
   * Show a quick pick and wait for selection.
   * 
   * @param options - Configuration options for the quick pick
   * @returns Promise that resolves to the selected item(s), or undefined if cancelled
   */
  showQuickPick: <T = unknown>(
    options: ShowQuickPickOptions<T>
  ) => Promise<QuickPickItem<T> | QuickPickItem<T>[] | undefined>;

  /**
   * Hide the currently visible input box (if any).
   * The promise returned by showInputBox will resolve to undefined.
   */
  hideInputBox: () => void;

  /**
   * Hide the currently visible quick pick (if any).
   */
  hideQuickPick: () => void;

  /**
   * Check if an input box is currently visible.
   */
  isInputBoxVisible: () => boolean;

  /**
   * Check if a quick pick is currently visible.
   */
  isQuickPickVisible: () => boolean;

  /**
   * Check if any quick input is currently visible.
   */
  isVisible: () => boolean;

  /**
   * Update the current input box state.
   * Useful for dynamically updating validation, busy state, etc.
   */
  updateInputBox: (updates: Partial<ShowInputBoxOptions>) => void;

  /**
   * Update the current quick pick state.
   */
  updateQuickPick: <T = unknown>(updates: Partial<ShowQuickPickOptions<T>>) => void;

  /**
   * Set the busy state of the current input box.
   */
  setBusy: (busy: boolean) => void;

  /**
   * Set items for the current quick pick.
   */
  setQuickPickItems: <T = unknown>(items: QuickPickListItem<T>[]) => void;

  /**
   * Set tree items for the current quick pick.
   */
  setQuickPickTreeItems: <T = unknown>(items: QuickTreeItem<T>[]) => void;

  /**
   * Accept the current selection in background (without closing).
   */
  acceptInBackground: () => void;

  /**
   * Navigate to next/previous item programmatically.
   */
  navigateQuickPick: (direction: "next" | "previous" | "first" | "last") => void;

  /**
   * Toggle tree node expansion.
   */
  toggleTreeNode: <T = unknown>(item: QuickTreeItem<T>) => void;
}

// ============================================================================
// Context
// ============================================================================

const QuickInputContext = createContext<QuickInputContextValue>();

// ============================================================================
// Default State
// ============================================================================

const createDefaultInputState = (): QuickInputState => ({
  visible: false,
  currentValue: "",
  validation: null,
  validating: false,
  resolve: null,
});

const createDefaultPickState = <T = unknown>(): QuickPickState<T> => ({
  visible: false,
  items: [],
  selectedItems: [],
  activeIndex: -1,
  filterValue: "",
  transformedFilterValue: "",
  canSelectMany: false,
  matchOnDescription: false,
  matchOnDetail: false,
  busy: false,
  enabled: true,
  ignoreFocusOut: false,
  itemActivation: ItemActivation.FIRST,
  canAcceptInBackground: false,
  showKeybindings: false,
  resolve: null,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Flatten tree items into a flat list with depth information
 */
function flattenTreeItems<T>(
  items: QuickTreeItem<T>[],
  depth: number = 0,
  parent?: FlattenedTreeItem<T>
): FlattenedTreeItem<T>[] {
  const result: FlattenedTreeItem<T>[] = [];
  
  for (const item of items) {
    const flatItem: FlattenedTreeItem<T> = {
      ...item,
      depth,
      parent,
      visible: true,
    };
    result.push(flatItem);
    
    if (item.children && item.expanded) {
      const children = flattenTreeItems(item.children, depth + 1, flatItem);
      result.push(...children);
    }
  }
  
  return result;
}

/**
 * Get the initial active index based on ItemActivation
 */
function getInitialActiveIndex<T>(
  items: QuickPickListItem<T>[],
  activation: ItemActivation
): number {
  const selectableItems = items.filter(
    (item): item is QuickPickItem<T> => 
      item.kind !== "separator" && !item.disabled
  );
  
  if (selectableItems.length === 0) return -1;
  
  switch (activation) {
    case ItemActivation.NONE:
      return -1;
    case ItemActivation.FIRST:
      return items.findIndex(
        (item) => item.kind !== "separator" && !(item as QuickPickItem<T>).disabled
      );
    case ItemActivation.SECOND:
      let count = 0;
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind !== "separator" && !(items[i] as QuickPickItem<T>).disabled) {
          count++;
          if (count === 2) return i;
        }
      }
      return items.findIndex(
        (item) => item.kind !== "separator" && !(item as QuickPickItem<T>).disabled
      );
    case ItemActivation.LAST:
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].kind !== "separator" && !(items[i] as QuickPickItem<T>).disabled) {
          return i;
        }
      }
      return -1;
    default:
      return 0;
  }
}

/**
 * Filter items based on input and options
 */
function filterItems<T>(
  items: QuickPickListItem<T>[],
  filterValue: string,
  options: {
    matchOnDescription?: boolean;
    matchOnDetail?: boolean;
    filterFunction?: (input: string, item: QuickPickItem<T>) => boolean;
  }
): QuickPickListItem<T>[] {
  if (!filterValue) return items;
  
  const lowerFilter = filterValue.toLowerCase();
  
  return items.filter((item) => {
    // Always show separators
    if (item.kind === "separator") return true;
    
    const pickItem = item as QuickPickItem<T>;
    
    // Always show items marked as alwaysShow
    if (pickItem.alwaysShow) return true;
    
    // Skip disabled items in filter (optional, can be changed)
    // if (pickItem.disabled) return false;
    
    // Use custom filter function if provided
    if (options.filterFunction) {
      return options.filterFunction(filterValue, pickItem);
    }
    
    // Default matching
    const labelMatch = pickItem.label.toLowerCase().includes(lowerFilter);
    const descMatch = options.matchOnDescription && 
      pickItem.description?.toLowerCase().includes(lowerFilter);
    const detailMatch = options.matchOnDetail && 
      pickItem.detail?.toLowerCase().includes(lowerFilter);
    
    return labelMatch || descMatch || detailMatch;
  });
}

// ============================================================================
// Provider
// ============================================================================

export function QuickInputProvider(props: { children: JSX.Element }) {
  const [inputState, setInputState] = createSignal<QuickInputState>(createDefaultInputState());
  const [pickState, setPickState] = createSignal<QuickPickState>(createDefaultPickState());
  
  // Track held modifier keys for quick navigate
  const [heldModifiers, setHeldModifiers] = createSignal<Set<string>>(new Set());

  // Quick navigate keyboard event handlers
  createEffect(() => {
    const state = pickState();
    if (!state.visible || !state.quickNavigate?.enableQuickNavigate) return;
    
    const modifier = state.quickNavigate.quickNavigateModifier || "ctrl";
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === modifier || key === "control" && modifier === "ctrl") {
        setHeldModifiers((prev) => new Set([...prev, modifier]));
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === modifier || key === "control" && modifier === "ctrl") {
        const newSet = new Set(heldModifiers());
        newSet.delete(modifier);
        setHeldModifiers(newSet);
        
        // If modifier released and quick navigate was active, accept current selection
        if (state.activeIndex >= 0) {
          const items = filterItems(state.items, state.transformedFilterValue, {
            matchOnDescription: state.matchOnDescription,
            matchOnDetail: state.matchOnDetail,
            filterFunction: state.filterFunction,
          });
          const activeItem = items[state.activeIndex];
          if (activeItem && activeItem.kind !== "separator") {
            handleQuickPickAccept(activeItem as QuickPickItem);
          }
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    });
  });

  /**
   * Show an input box and wait for user input
   */
  const showInputBox = (options: ShowInputBoxOptions): Promise<string | undefined> => {
    return new Promise((resolve) => {
      // Run initial validation if there's an initial value and sync validator
      let initialValidation: ValidationResult | null = null;
      if (options.value && options.validateInput) {
        const result = options.validateInput(options.value);
        initialValidation = normalizeValidation(result);
      }

      batch(() => {
        setInputState({
          ...options,
          visible: true,
          currentValue: options.value || "",
          validation: initialValidation,
          validating: false,
          resolve,
          onBack: options.onBack ? async () => {
            const result = await options.onBack?.();
            if (result !== false) {
              hideInputBox();
            }
          } : undefined,
          onButton: options.onButton,
        });
      });

      // Run async validation for initial value if provided
      if (options.value && options.validateInputAsync) {
        setInputState((prev) => ({ ...prev, validating: true }));
        options.validateInputAsync(options.value)
          .then((result) => {
            const validation = normalizeValidation(result);
            setInputState((prev) => ({ ...prev, validation, validating: false }));
          })
          .catch((error) => {
            setInputState((prev) => ({
              ...prev,
              validation: {
                valid: false,
                message: error instanceof Error ? error.message : "Validation failed",
                severity: "error",
              },
              validating: false,
            }));
          });
      }
    });
  };

  /**
   * Show a quick pick and wait for selection
   */
  const showQuickPick = <T = unknown>(
    options: ShowQuickPickOptions<T>
  ): Promise<QuickPickItem<T> | QuickPickItem<T>[] | undefined> => {
    return new Promise((resolve) => {
      const items = options.items || [];
      const treeItems = options.treeItems;
      const flattenedTreeItems = treeItems ? flattenTreeItems(treeItems) : undefined;
      
      // Convert tree items to pick items if provided
      const allItems: QuickPickListItem<T>[] = flattenedTreeItems
        ? flattenedTreeItems.map((item) => ({
            label: item.label,
            description: item.description,
            detail: item.detail,
            iconPath: item.iconPath,
            value: item.value,
            disabled: item.disabled,
            highlights: item.highlights,
            buttons: item.buttons?.map((b) => ({
              iconPath: b.iconPath,
              tooltip: b.tooltip,
            })),
          } as QuickPickItem<T>))
        : items;
      
      const itemActivation = options.itemActivation ?? ItemActivation.FIRST;
      const initialValue = options.value || "";
      const transformedValue = options.filterValueTransform 
        ? options.filterValueTransform(initialValue)
        : initialValue;
      
      batch(() => {
        setPickState({
          visible: true,
          title: options.title,
          placeholder: options.placeholder,
          items: allItems as QuickPickListItem<unknown>[],
          treeItems: treeItems as QuickTreeItem<unknown>[] | undefined,
          flattenedTreeItems: flattenedTreeItems as FlattenedTreeItem<unknown>[] | undefined,
          selectedItems: [],
          activeIndex: getInitialActiveIndex(allItems, itemActivation),
          filterValue: initialValue,
          transformedFilterValue: transformedValue,
          canSelectMany: options.canSelectMany || false,
          matchOnDescription: options.matchOnDescription || false,
          matchOnDetail: options.matchOnDetail || false,
          busy: options.busy || false,
          enabled: options.enabled !== false,
          ignoreFocusOut: options.ignoreFocusOut || false,
          step: options.step,
          buttons: options.buttons,
          itemActivation,
          quickNavigate: options.quickNavigate,
          canAcceptInBackground: options.canAcceptInBackground || false,
          showKeybindings: options.showKeybindings || false,
          filterFunction: options.filterFunction as ((input: string, item: QuickPickItem<unknown>) => boolean) | undefined,
          filterValueTransform: options.filterValueTransform,
          resolve: resolve as (value: QuickPickItem<unknown> | QuickPickItem<unknown>[] | undefined) => void,
          onBack: options.onBack ? async () => {
            const result = await options.onBack?.();
            if (result !== false) {
              hideQuickPick();
            }
          } : undefined,
          onButton: options.onButton,
          onDidAcceptInBackground: options.onDidAcceptInBackground as ((item: QuickPickItem<unknown>) => void) | undefined,
          onItemButton: options.onItemButton as ((item: QuickPickItem<unknown>, button: QuickInputButton) => void) | undefined,
          onSeparatorButton: options.onSeparatorButton,
          onTreeNodeToggle: options.onTreeNodeToggle as ((event: QuickTreeNodeEvent<unknown>) => void) | undefined,
          onCheckboxChange: options.onCheckboxChange as ((item: QuickTreeItem<unknown>, state: CheckboxState) => void) | undefined,
        });
      });
    });
  };

  /**
   * Hide the current input box
   */
  const hideInputBox = () => {
    const currentState = inputState();
    if (currentState.resolve) {
      currentState.resolve(undefined);
    }
    setInputState(createDefaultInputState());
  };

  /**
   * Hide the current quick pick
   */
  const hideQuickPick = () => {
    const currentState = pickState();
    if (currentState.resolve) {
      currentState.resolve(undefined);
    }
    setPickState(createDefaultPickState());
  };

  /**
   * Check if input box is visible
   */
  const isInputBoxVisible = () => inputState().visible;

  /**
   * Check if quick pick is visible
   */
  const isQuickPickVisible = () => pickState().visible;

  /**
   * Check if any quick input is visible
   */
  const isVisible = () => inputState().visible || pickState().visible;

  /**
   * Update the current input box state
   */
  const updateInputBox = (updates: Partial<ShowInputBoxOptions>) => {
    setInputState((prev) => ({ ...prev, ...updates }));
  };

  /**
   * Update the current quick pick state
   */
  const updateQuickPick = <T = unknown>(updates: Partial<ShowQuickPickOptions<T>>) => {
    setPickState((prev) => ({ 
      ...prev, 
      ...updates,
      items: updates.items as QuickPickListItem<unknown>[] | undefined ?? prev.items,
    } as QuickPickState<unknown>));
  };

  /**
   * Set busy state
   */
  const setBusy = (busy: boolean) => {
    setInputState((prev) => ({ ...prev, busy }));
    setPickState((prev) => ({ ...prev, busy }));
  };

  /**
   * Set quick pick items
   */
  const setQuickPickItems = <T = unknown>(items: QuickPickListItem<T>[]) => {
    setPickState((prev) => ({
      ...prev,
      items: items as QuickPickListItem<unknown>[],
      activeIndex: getInitialActiveIndex(items, prev.itemActivation),
    }));
  };

  /**
   * Set quick pick tree items
   */
  const setQuickPickTreeItems = <T = unknown>(items: QuickTreeItem<T>[]) => {
    const flattenedItems = flattenTreeItems(items);
    const pickItems: QuickPickListItem<T>[] = flattenedItems.map((item) => ({
      label: "  ".repeat(item.depth) + item.label,
      description: item.description,
      detail: item.detail,
      iconPath: item.iconPath,
      value: item.value,
      disabled: item.disabled,
    }));
    
    setPickState((prev) => ({
      ...prev,
      treeItems: items as QuickTreeItem<unknown>[],
      flattenedTreeItems: flattenedItems as FlattenedTreeItem<unknown>[],
      items: pickItems as QuickPickListItem<unknown>[],
      activeIndex: getInitialActiveIndex(pickItems, prev.itemActivation),
    }));
  };

  /**
   * Accept current selection in background
   */
  const acceptInBackground = () => {
    const state = pickState();
    if (!state.canAcceptInBackground || state.activeIndex < 0) return;
    
    const filteredItems = filterItems(state.items, state.transformedFilterValue, {
      matchOnDescription: state.matchOnDescription,
      matchOnDetail: state.matchOnDetail,
      filterFunction: state.filterFunction,
    });
    
    const activeItem = filteredItems[state.activeIndex];
    if (activeItem && activeItem.kind !== "separator" && !(activeItem as QuickPickItem).disabled) {
      state.onDidAcceptInBackground?.(activeItem as QuickPickItem);
    }
  };

  /**
   * Navigate quick pick programmatically
   */
  const navigateQuickPick = (direction: "next" | "previous" | "first" | "last") => {
    setPickState((prev) => {
      const filteredItems = filterItems(prev.items, prev.transformedFilterValue, {
        matchOnDescription: prev.matchOnDescription,
        matchOnDetail: prev.matchOnDetail,
        filterFunction: prev.filterFunction,
      });
      
      const selectableIndices: number[] = [];
      filteredItems.forEach((item, index) => {
        if (item.kind !== "separator" && !(item as QuickPickItem).disabled) {
          selectableIndices.push(index);
        }
      });
      
      if (selectableIndices.length === 0) return prev;
      
      let newIndex = prev.activeIndex;
      const currentSelectableIndex = selectableIndices.indexOf(prev.activeIndex);
      
      switch (direction) {
        case "next":
          if (currentSelectableIndex < selectableIndices.length - 1) {
            newIndex = selectableIndices[currentSelectableIndex + 1];
          } else if (prev.quickNavigate?.cycleNavigation) {
            newIndex = selectableIndices[0];
          }
          break;
        case "previous":
          if (currentSelectableIndex > 0) {
            newIndex = selectableIndices[currentSelectableIndex - 1];
          } else if (prev.quickNavigate?.cycleNavigation) {
            newIndex = selectableIndices[selectableIndices.length - 1];
          }
          break;
        case "first":
          newIndex = selectableIndices[0];
          break;
        case "last":
          newIndex = selectableIndices[selectableIndices.length - 1];
          break;
      }
      
      return { ...prev, activeIndex: newIndex };
    });
  };

  /**
   * Toggle tree node expansion
   */
  const toggleTreeNode = <T = unknown>(item: QuickTreeItem<T>) => {
    setPickState((prev) => {
      if (!prev.treeItems) return prev;
      
      const toggleInTree = (items: QuickTreeItem<unknown>[]): QuickTreeItem<unknown>[] => {
        return items.map((treeItem) => {
          if (treeItem.id === item.id) {
            return { ...treeItem, expanded: !treeItem.expanded };
          }
          if (treeItem.children) {
            return { ...treeItem, children: toggleInTree(treeItem.children) };
          }
          return treeItem;
        });
      };
      
      const newTreeItems = toggleInTree(prev.treeItems);
      const newFlattenedItems = flattenTreeItems(newTreeItems);
      
      // Emit toggle event
      prev.onTreeNodeToggle?.({
        item: item as QuickTreeItem<unknown>,
        expanded: !item.expanded,
      });
      
      return {
        ...prev,
        treeItems: newTreeItems,
        flattenedTreeItems: newFlattenedItems,
      };
    });
  };

  /**
   * Handle quick pick accept
   */
  const handleQuickPickAccept = (item: QuickPickItem) => {
    const currentState = pickState();
    if (currentState.resolve) {
      if (currentState.canSelectMany) {
        currentState.resolve([...currentState.selectedItems, item]);
      } else {
        currentState.resolve(item);
      }
    }
    setPickState(createDefaultPickState());
  };

  /**
   * Handle state changes from the component
   */
  const handleInputStateChange = (updates: Partial<QuickInputState>) => {
    setInputState((prev) => ({ ...prev, ...updates }));
  };

  /**
   * Handle submit from the component
   */
  const handleInputSubmit = (value: string) => {
    const currentState = inputState();
    if (currentState.resolve) {
      currentState.resolve(value);
    }
    setInputState(createDefaultInputState());
  };

  /**
   * Handle cancel from the component
   */
  const handleInputCancel = () => {
    hideInputBox();
  };

  /**
   * Handle back button click
   */
  const handleInputBack = () => {
    const currentState = inputState();
    if (currentState.onBack) {
      currentState.onBack();
    }
  };

  /**
   * Handle custom button click
   */
  const handleInputButton = async (button: QuickInputButton) => {
    const currentState = inputState();
    if (currentState.onButton) {
      await currentState.onButton(button);
    }
  };

  const value: QuickInputContextValue = {
    showInputBox,
    showQuickPick,
    hideInputBox,
    hideQuickPick,
    isInputBoxVisible,
    isQuickPickVisible,
    isVisible,
    updateInputBox,
    updateQuickPick,
    setBusy,
    setQuickPickItems,
    setQuickPickTreeItems,
    acceptInBackground,
    navigateQuickPick,
    toggleTreeNode,
  };

  return (
    <QuickInputContext.Provider value={value}>
      {props.children}
      <QuickInput
        state={inputState()}
        onStateChange={handleInputStateChange}
        onSubmit={handleInputSubmit}
        onCancel={handleInputCancel}
        onBack={handleInputBack}
        onButton={handleInputButton}
      />
      {/* QuickPick component would be rendered here similarly */}
    </QuickInputContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the quick input API.
 * 
 * @throws Error if used outside of QuickInputProvider
 * 
 * @example
 * ```tsx
 * function RenameSymbol() {
 *   const { showInputBox, showQuickPick } = useQuickInput();
 *   
 *   const handleRename = async () => {
 *     const newName = await showInputBox({
 *       title: "Rename Symbol",
 *       prompt: "Enter new name",
 *       value: currentName,
 *       valueSelection: "all",
 *       validateInput: validateIdentifier,
 *     });
 *     
 *     if (newName !== undefined) {
 *       await performRename(newName);
 *     }
 *   };
 *   
 *   const handleSelectFile = async () => {
 *     const selected = await showQuickPick({
 *       title: "Select File",
 *       treeItems: fileTree,
 *       itemActivation: ItemActivation.FIRST,
 *       quickNavigate: {
 *         enableQuickNavigate: true,
 *         quickNavigateModifier: "ctrl",
 *       },
 *     });
 *     
 *     if (selected) {
 *       await openFile(selected.value);
 *     }
 *   };
 *   
 *   return (
 *     <>
 *       <button onClick={handleRename}>Rename</button>
 *       <button onClick={handleSelectFile}>Open File</button>
 *     </>
 *   );
 * }
 * ```
 */
export function useQuickInput(): QuickInputContextValue {
  const context = useContext(QuickInputContext);
  if (!context) {
    throw new Error("useQuickInput must be used within a QuickInputProvider");
  }
  return context;
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  QuickInputOptions,
  QuickInputButton,
  ValidationResult,
  ValidationSeverity,
  SelectionRange,
} from "@/components/ui/QuickInput";

export {
  ItemActivation,
  QuickPickItemButtonLocation,
} from "@/types/quickInput";

export type {
  QuickTreeItem,
  QuickNavigateConfiguration,
  QuickPickSeparatorWithButtons,
  QuickPickSeparatorButton,
  QuickPickHighlights,
  QuickInputExtendedOptions,
  FlattenedTreeItem,
  CheckboxState,
  QuickTreeNodeEvent,
} from "@/types/quickInput";

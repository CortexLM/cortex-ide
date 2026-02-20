/**
 * Quick Input Types
 *
 * Centralized type definitions for quick input/quick pick functionality
 * including tree items, widgets, buttons, navigation, and advanced options.
 *
 * These types extend the base QuickPick/QuickInput functionality with
 * advanced features like hierarchical items, custom widgets, and more.
 */

import type { JSX } from "solid-js";

// ============================================================================
// Button Location Types
// ============================================================================

/**
 * Location where item buttons can be displayed.
 */
export enum QuickPickItemButtonLocation {
  /** Button appears in the title bar area */
  Title = 1,
  /** Button appears inline with the item */
  Inline = 2,
  /** Button appears in the input field area */
  Input = 3,
}

// ============================================================================
// Item Activation Types
// ============================================================================

/**
 * Controls which item is initially activated when the quick pick opens.
 */
export enum ItemActivation {
  /** No item is initially activated */
  NONE = 0,
  /** The first item is activated */
  FIRST = 1,
  /** The second item is activated */
  SECOND = 2,
  /** The last item is activated */
  LAST = 3,
}

// ============================================================================
// Checkbox State Types
// ============================================================================

/**
 * Tri-state checkbox value for hierarchical items.
 */
export type CheckboxState = "checked" | "unchecked" | "indeterminate";

/**
 * Checkbox configuration for quick pick items.
 */
export interface QuickPickCheckbox {
  /** Current state of the checkbox */
  state: CheckboxState;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Tooltip text for the checkbox */
  tooltip?: string;
  /** Callback when checkbox state changes */
  onChange?: (newState: CheckboxState) => void;
}

// ============================================================================
// Highlight Types
// ============================================================================

/**
 * Represents a highlight range within text.
 * [startIndex, endIndex] - both inclusive
 */
export type HighlightRange = [number, number];

/**
 * Custom highlights for quick pick items.
 * Allows highlighting specific parts of label, description, or detail.
 */
export interface QuickPickHighlights {
  /** Ranges to highlight in the label */
  label?: HighlightRange[];
  /** Ranges to highlight in the description */
  description?: HighlightRange[];
  /** Ranges to highlight in the detail */
  detail?: HighlightRange[];
}

// ============================================================================
// Match Mode Types
// ============================================================================

/**
 * Mode for matching input against item labels.
 */
export type MatchOnLabelMode = "fuzzy" | "contiguous";

// ============================================================================
// Quick Tree Item Types
// ============================================================================

/**
 * Hierarchical tree item for quick picks.
 * Supports nested children and tri-state checkboxes.
 *
 * @template T - The type of the item's value
 *
 * @example
 * ```tsx
 * const treeItem: QuickTreeItem<string> = {
 *   id: "folder-1",
 *   label: "src",
 *   iconPath: "folder",
 *   expanded: true,
 *   children: [
 *     { id: "file-1", label: "index.ts", value: "/src/index.ts" },
 *     { id: "file-2", label: "utils.ts", value: "/src/utils.ts" },
 *   ],
 *   checkbox: { state: "indeterminate" },
 * };
 * ```
 */
export interface QuickTreeItem<T = unknown> {
  /** Unique identifier for the tree item */
  id: string;
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
  /** Child items for hierarchical structure */
  children?: QuickTreeItem<T>[];
  /** Whether this node is expanded (for items with children) */
  expanded?: boolean;
  /** Tri-state checkbox configuration */
  checkbox?: QuickPickCheckbox;
  /** Whether this item is selectable */
  selectable?: boolean;
  /** Custom highlights for this item */
  highlights?: QuickPickHighlights;
  /** Buttons to show for this item */
  buttons?: QuickTreeItemButton[];
  /** Depth level in the tree (auto-calculated) */
  depth?: number;
  /** Whether this item is disabled */
  disabled?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Whether this item is currently loading children */
  loading?: boolean;
  /** Parent item ID (auto-calculated) */
  parentId?: string;
  /** Whether children should be loaded lazily */
  hasChildren?: boolean;
}

/**
 * Button that can appear on a tree item.
 */
export interface QuickTreeItemButton {
  /** Icon path or icon identifier */
  iconPath: string;
  /** Tooltip text */
  tooltip?: string;
  /** Whether the button is always visible or only on hover */
  alwaysVisible?: boolean;
  /** Location of the button */
  location?: QuickPickItemButtonLocation;
}

// ============================================================================
// Quick Widget Types
// ============================================================================

/**
 * Custom HTML widget that can be embedded in quick picks.
 *
 * @example
 * ```tsx
 * const colorWidget: QuickWidget = {
 *   id: "color-picker",
 *   type: "custom",
 *   render: () => <ColorPicker onSelect={handleColor} />,
 *   height: 200,
 * };
 * ```
 */
export interface QuickWidget {
  /** Unique identifier for the widget */
  id: string;
  /** Type of widget */
  type: "custom" | "preview" | "info" | "progress" | "form";
  /** Render function for custom widgets */
  render?: () => JSX.Element;
  /** HTML content (alternative to render) */
  html?: string;
  /** Fixed height of the widget in pixels */
  height?: number;
  /** Minimum height of the widget */
  minHeight?: number;
  /** Maximum height of the widget */
  maxHeight?: number;
  /** Whether the widget can be collapsed */
  collapsible?: boolean;
  /** Whether the widget is initially collapsed */
  collapsed?: boolean;
  /** Position of the widget relative to items */
  position?: "top" | "bottom" | "inline";
  /** Whether the widget should fill available space */
  fillSpace?: boolean;
  /** CSS class to apply to the widget container */
  className?: string;
  /** Inline styles for the widget container */
  style?: JSX.CSSProperties;
  /** Callback when widget is interacted with */
  onInteraction?: (event: QuickWidgetInteractionEvent) => void;
}

/**
 * Event emitted when a widget is interacted with.
 */
export interface QuickWidgetInteractionEvent {
  /** Type of interaction */
  type: "click" | "change" | "submit" | "cancel";
  /** Widget that was interacted with */
  widgetId: string;
  /** Additional data from the interaction */
  data?: unknown;
}

// ============================================================================
// Separator Types
// ============================================================================

/**
 * Enhanced separator with optional buttons.
 *
 * @example
 * ```tsx
 * const separator: QuickPickSeparatorWithButtons = {
 *   label: "Recent Files",
 *   buttons: [
 *     { iconPath: "clear-all", tooltip: "Clear Recent" },
 *   ],
 * };
 * ```
 */
export interface QuickPickSeparatorWithButtons {
  /** Separator label */
  label?: string;
  /** Buttons to display on the separator */
  buttons?: QuickPickSeparatorButton[];
  /** Whether this is a visual divider only (no label) */
  divider?: boolean;
}

/**
 * Button that appears on a separator.
 */
export interface QuickPickSeparatorButton {
  /** Icon path or icon identifier */
  iconPath: string;
  /** Tooltip text */
  tooltip?: string;
  /** Callback when button is clicked */
  onClick?: () => void;
}

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Configuration for keyboard navigation in quick picks.
 *
 * @example
 * ```tsx
 * const navConfig: QuickNavigateConfiguration = {
 *   keybindings: {
 *     selectNext: ["Down", "Ctrl+N"],
 *     selectPrevious: ["Up", "Ctrl+P"],
 *     accept: ["Enter"],
 *     cancel: ["Escape"],
 *   },
 *   enableQuickNavigate: true,
 * };
 * ```
 */
export interface QuickNavigateConfiguration {
  /** Key bindings for navigation actions */
  keybindings?: QuickNavigateKeybindings;
  /** Whether to enable quick navigate mode (hold modifier to navigate) */
  enableQuickNavigate?: boolean;
  /** Modifier key for quick navigate mode */
  quickNavigateModifier?: "ctrl" | "alt" | "shift" | "meta";
  /** Whether Page Up/Down jumps by page */
  enablePageNavigation?: boolean;
  /** Whether Home/End jumps to first/last item */
  enableHomeEndNavigation?: boolean;
  /** Whether to cycle when reaching boundaries */
  cycleNavigation?: boolean;
  /** Whether to enable type-ahead search */
  typeAheadEnabled?: boolean;
  /** Delay before type-ahead search resets (ms) */
  typeAheadTimeout?: number;
}

/**
 * Key bindings for quick pick navigation.
 */
export interface QuickNavigateKeybindings {
  /** Keys to select next item */
  selectNext?: string[];
  /** Keys to select previous item */
  selectPrevious?: string[];
  /** Keys to accept selection */
  accept?: string[];
  /** Keys to cancel/close */
  cancel?: string[];
  /** Keys to toggle selection (multi-select) */
  toggleSelection?: string[];
  /** Keys to select all (multi-select) */
  selectAll?: string[];
  /** Keys to go back (in multi-step) */
  goBack?: string[];
  /** Keys to show/hide detail */
  toggleDetail?: string[];
  /** Keys to expand tree node */
  expandNode?: string[];
  /** Keys to collapse tree node */
  collapseNode?: string[];
}

// ============================================================================
// Extended Item Options
// ============================================================================

/**
 * Extended options for quick pick items.
 */
export interface QuickPickItemExtendedOptions<T = unknown> {
  /** Whether this item can accept in background (Ctrl+Enter) */
  canAcceptInBackground?: boolean;
  /** Custom filter function for this item */
  filterValue?: (input: string, item: T) => boolean;
  /** Whether this item is pickable/selectable */
  pickable?: boolean;
  /** Whether this item is disabled */
  disabled?: boolean;
  /** Reason why item is disabled */
  disabledReason?: string;
  /** Custom highlights */
  highlights?: QuickPickHighlights;
  /** Mode for label matching */
  matchOnLabelMode?: MatchOnLabelMode;
  /** Sort priority (lower = higher priority) */
  sortPriority?: number;
  /** Whether this item should be shown even when filter doesn't match */
  alwaysShow?: boolean;
  /** Keyboard shortcut to select this item */
  keybinding?: string;
  /** Whether to auto-focus this item when shown */
  autoFocus?: boolean;
}

// ============================================================================
// Filter Function Types
// ============================================================================

/**
 * Custom filter function type for quick picks.
 *
 * @param input - The current filter input value
 * @param item - The item being filtered
 * @returns true if the item should be shown, false to hide
 */
export type QuickPickFilterFunction<T> = (input: string, item: T) => boolean;

/**
 * Score-based filter function that returns a relevance score.
 *
 * @param input - The current filter input value
 * @param item - The item being filtered
 * @returns A score >= 0 (higher = more relevant), or -1 to hide
 */
export type QuickPickScorerFunction<T> = (input: string, item: T) => number;

// ============================================================================
// Extended Quick Pick Options
// ============================================================================

/**
 * Extended options for quick picks with all advanced features.
 */
export interface QuickPickExtendedOptions<T = unknown> {
  /** Initial item activation behavior */
  itemActivation?: ItemActivation;
  /** Navigation configuration */
  navigation?: QuickNavigateConfiguration;
  /** Custom filter function */
  filterFunction?: QuickPickFilterFunction<T>;
  /** Score-based filter function */
  scorerFunction?: QuickPickScorerFunction<T>;
  /** Mode for matching on labels */
  matchOnLabelMode?: MatchOnLabelMode;
  /** Widgets to display */
  widgets?: QuickWidget[];
  /** Whether items can accept in background */
  canAcceptInBackground?: boolean;
  /** Callback for background accept */
  onDidAcceptInBackground?: (item: T) => void;
  /** Custom separator with buttons */
  separators?: QuickPickSeparatorWithButtons[];
  /** Whether to show checkboxes */
  showCheckboxes?: boolean;
  /** Whether to preserve filter on hide */
  preserveFilter?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Custom empty state widget */
  emptyWidget?: QuickWidget;
  /** Whether to show item count */
  showItemCount?: boolean;
  /** Format string for item count (e.g., "{count} items") */
  itemCountFormat?: string;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Whether to enable virtual scrolling for large lists */
  virtualScroll?: boolean;
  /** Item height for virtual scrolling */
  itemHeight?: number;
  /** Debounce delay for filter input (ms) */
  filterDebounce?: number;
  /** Whether to show keyboard shortcuts */
  showKeybindings?: boolean;
  /** Context key for when conditions */
  contextKey?: string;
}

// ============================================================================
// Tree Quick Pick Options
// ============================================================================

/**
 * Options specific to tree-based quick picks.
 */
export interface QuickTreePickOptions<T = unknown> extends QuickPickExtendedOptions<T> {
  /** Root items of the tree */
  rootItems: QuickTreeItem<T>[];
  /** Whether to show expand/collapse all buttons */
  showExpandCollapseAll?: boolean;
  /** Whether to auto-expand single-child nodes */
  autoExpandSingleChild?: boolean;
  /** Maximum depth to auto-expand */
  autoExpandDepth?: number;
  /** Whether to enable drag and drop */
  enableDragDrop?: boolean;
  /** Callback for lazy loading children */
  onLoadChildren?: (item: QuickTreeItem<T>) => Promise<QuickTreeItem<T>[]>;
  /** Callback when checkbox state changes */
  onCheckboxChange?: (item: QuickTreeItem<T>, state: CheckboxState) => void;
  /** Whether to propagate checkbox state to children */
  propagateCheckbox?: boolean;
  /** Whether to propagate checkbox state to parents */
  propagateCheckboxToParent?: boolean;
  /** Filter mode for trees */
  treeFilterMode?: "filter" | "highlight" | "both";
  /** Whether to show parent chain when filtering */
  showFilteredParents?: boolean;
}

// ============================================================================
// Quick Input Extended Options
// ============================================================================

/**
 * Extended options for quick input boxes.
 */
export interface QuickInputExtendedOptions {
  /** Whether to accept input in background */
  canAcceptInBackground?: boolean;
  /** Callback for background accept */
  onDidAcceptInBackground?: (value: string) => void;
  /** Custom validation severity icons */
  validationIcons?: {
    error?: string;
    warning?: string;
    info?: string;
  };
  /** Whether to show character count */
  showCharacterCount?: boolean;
  /** Maximum character count */
  maxLength?: number;
  /** Whether to show word count */
  showWordCount?: boolean;
  /** Pattern for input validation (regex string) */
  pattern?: string;
  /** Message shown when pattern doesn't match */
  patternMessage?: string;
  /** History of previous inputs */
  history?: string[];
  /** Whether to enable history navigation */
  enableHistory?: boolean;
  /** Whether to show history dropdown */
  showHistoryDropdown?: boolean;
  /** Whether input is a password field */
  password?: boolean;
  /** Autocomplete suggestions */
  suggestions?: string[];
  /** Whether to enable autocomplete */
  enableAutocomplete?: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event emitted when item buttons are triggered.
 */
export interface QuickPickItemButtonEvent<T = unknown> {
  /** The button that was triggered */
  button: QuickTreeItemButton;
  /** The item the button belongs to */
  item: T;
  /** Location of the button */
  location: QuickPickItemButtonLocation;
}

/**
 * Event emitted when separator buttons are triggered.
 */
export interface QuickPickSeparatorButtonEvent {
  /** The button that was triggered */
  button: QuickPickSeparatorButton;
  /** The separator the button belongs to */
  separator: QuickPickSeparatorWithButtons;
}

/**
 * Event emitted when tree nodes are expanded/collapsed.
 */
export interface QuickTreeNodeEvent<T = unknown> {
  /** The tree item */
  item: QuickTreeItem<T>;
  /** Whether the node is now expanded */
  expanded: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Makes specified properties of T optional.
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extracts the value type from a QuickTreeItem.
 */
export type QuickTreeItemValue<T extends QuickTreeItem<unknown>> =
  T extends QuickTreeItem<infer V> ? V : never;

/**
 * Flattened tree item with resolved parent references.
 */
export interface FlattenedTreeItem<T = unknown> extends QuickTreeItem<T> {
  /** Computed depth in the tree */
  depth: number;
  /** Parent item reference */
  parent?: FlattenedTreeItem<T>;
  /** Whether this item is visible based on filtering */
  visible: boolean;
  /** Computed match score for filtering */
  matchScore?: number;
}

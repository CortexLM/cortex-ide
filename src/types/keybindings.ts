// ============================================================================
// Keybinding Types - VS Code-style keybindings for the editor
// ============================================================================

/**
 * Source of a keybinding definition
 */
type KeybindingSource = 'default' | 'user' | 'workspace' | 'extension';

/**
 * Represents a single keybinding item for the keybindings editor
 */
interface KeybindingItem {
  /** Unique identifier for the keybinding */
  id: string;
  /** Command identifier to execute */
  command: string;
  /** Human-readable title for the command */
  commandTitle?: string;
  /** Primary keybinding string (e.g., "Ctrl+Shift+P") */
  key: string;
  /** macOS-specific keybinding */
  mac?: string;
  /** Linux-specific keybinding */
  linux?: string;
  /** Windows-specific keybinding */
  win?: string;
  /** When clause for conditional activation */
  when?: string;
  /** Source of the keybinding definition */
  source: KeybindingSource;
  /** Whether this is a default keybinding */
  isDefault: boolean;
  /** Whether this keybinding was defined by the user */
  isUserDefined: boolean;
  /** Additional arguments to pass to the command */
  args?: unknown;
}

// ============================================================================
// When Clause Types - Conditional keybinding activation
// ============================================================================

/**
 * Abstract syntax tree node types for when clause expressions
 */
type WhenExpression = 
  | { type: 'true' }
  | { type: 'false' }
  | { type: 'context'; key: string }
  | { type: 'equals'; key: string; value: unknown }
  | { type: 'notEquals'; key: string; value: unknown }
  | { type: 'regex'; key: string; pattern: string }
  | { type: 'in'; key: string; values: unknown[] }
  | { type: 'not'; expr: WhenExpression }
  | { type: 'and'; left: WhenExpression; right: WhenExpression }
  | { type: 'or'; left: WhenExpression; right: WhenExpression };

/**
 * Context for evaluating when clauses
 */
interface WhenContext {
  [key: string]: unknown;
}

/**
 * Parsed when clause with evaluation capability
 */
interface WhenClause {
  /** Raw when clause string */
  raw: string;
  /** Parsed AST representation */
  parsed: WhenExpression;
  /** Evaluate the when clause against a context */
  evaluate: (context: WhenContext) => boolean;
}

// ============================================================================
// Keybinding Conflict Types
// ============================================================================

/**
 * Represents a conflict between keybindings
 */
interface KeybindingConflict {
  /** The conflicting keybinding string */
  key: string;
  /** List of keybinding items with the same key */
  bindings: KeybindingItem[];
  /** Type of conflict */
  conflictType: 'duplicate' | 'shadow';
}

// ============================================================================
// Record Keys Mode Types
// ============================================================================

/**
 * Represents a recorded key event
 */
interface RecordedKey {
  /** Physical key code */
  code: string;
  /** Logical key value */
  key: string;
  /** Ctrl modifier state */
  ctrlKey: boolean;
  /** Shift modifier state */
  shiftKey: boolean;
  /** Alt modifier state */
  altKey: boolean;
  /** Meta (Cmd/Win) modifier state */
  metaKey: boolean;
  /** Timestamp of the key event */
  timestamp: number;
}

/**
 * State for the record keys mode
 */
interface RecordKeysState {
  /** Whether currently recording keys */
  isRecording: boolean;
  /** List of recorded key events */
  recordedKeys: RecordedKey[];
  /** Final keybinding string after recording completes */
  finalKeybinding?: string;
}

// ============================================================================
// Keybindings Editor State
// ============================================================================

/**
 * Sort field options for keybindings editor
 */
type KeybindingSortField = 'command' | 'keybinding' | 'source' | 'when';

/**
 * Sort order options
 */
type KeybindingSortOrder = 'asc' | 'desc';

/**
 * Complete state for the keybindings editor UI
 */
interface KeybindingsEditorState {
  /** All keybinding items */
  items: KeybindingItem[];
  /** Current search query */
  searchQuery: string;
  /** Whether searching by keybinding instead of command */
  searchByKeybinding: boolean;
  /** Current sort field */
  sortBy: KeybindingSortField;
  /** Current sort order */
  sortOrder: KeybindingSortOrder;
  /** Currently selected keybinding item */
  selectedItem?: KeybindingItem;
  /** Keybinding item currently being edited */
  editingItem?: KeybindingItem;
  /** List of detected conflicts */
  conflicts: KeybindingConflict[];
  /** Record keys mode state */
  recordMode: RecordKeysState;
}

// ============================================================================
// Define Keybinding Widget Types
// ============================================================================

/**
 * State for the define keybinding widget (popup for setting new keybindings)
 */
interface DefineKeybindingWidgetState {
  /** Whether the widget is visible */
  visible: boolean;
  /** Target command for the new keybinding */
  targetCommand?: string;
  /** Current keybinding value being displayed */
  currentValue?: string;
  /** Keys recorded during definition */
  recordedKeys: RecordedKey[];
  /** Optional when clause for the keybinding */
  whenClause?: string;
}

// ============================================================================
// Keybinding JSON Schema Types
// ============================================================================

/**
 * JSON representation of a keybinding (for keybindings.json)
 */
interface KeybindingJSON {
  /** Primary keybinding string */
  key: string;
  /** Command to execute */
  command: string;
  /** When clause for conditional activation */
  when?: string;
  /** Additional command arguments */
  args?: unknown;
  /** macOS-specific keybinding override */
  mac?: string;
  /** Linux-specific keybinding override */
  linux?: string;
  /** Windows-specific keybinding override */
  win?: string;
}

// ============================================================================
// Keybinding Resolution Types
// ============================================================================

/**
 * Resolved keybinding with display labels
 */
interface ResolvedKeybinding {
  /** Human-readable label for the keybinding */
  label: string;
  /** Accessible label for screen readers */
  ariaLabel: string;
  /** Electron accelerator string (if applicable) */
  electronAccelerator?: string;
  /** Label for user settings display */
  userSettingsLabel?: string;
  /** Whether the label matches what the user typed */
  isWYSIWYG: boolean;
  /** Whether this is a chord (multi-key) keybinding */
  isChord: boolean;
  /** Parts of the keybinding for dispatch */
  dispatchParts: (string | null)[];
}

// ============================================================================
// Keyboard Layout Types
// ============================================================================

/**
 * Mapping for a single key on the keyboard
 */
interface KeyMapping {
  /** Default value without modifiers */
  value: string;
  /** Value with Shift modifier */
  withShift: string;
  /** Value with AltGr modifier (optional) */
  withAltGr?: string;
  /** Value with Shift+AltGr modifiers (optional) */
  withShiftAltGr?: string;
}

/**
 * Complete keyboard layout information
 */
interface KeyboardLayout {
  /** Layout name (e.g., "US", "French AZERTY") */
  name: string;
  /** Locale identifier (e.g., "en-US", "fr-FR") */
  locale: string;
  /** Key code to character mapping */
  mapping: Record<string, KeyMapping>;
}

// ============================================================================
// Exports
// ============================================================================

export type {
  KeybindingItem,
  KeybindingSource,
  WhenClause,
  WhenExpression,
  WhenContext,
  KeybindingConflict,
  RecordKeysState,
  RecordedKey,
  KeybindingsEditorState,
  KeybindingSortField,
  KeybindingSortOrder,
  DefineKeybindingWidgetState,
  KeybindingJSON,
  ResolvedKeybinding,
  KeyboardLayout,
  KeyMapping
};

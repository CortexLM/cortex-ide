/**
 * =============================================================================
 * OBJECT SETTING WIDGET
 * =============================================================================
 *
 * A comprehensive widget for editing object/dictionary-type settings with:
 * - Key-value pair list display
 * - Add/remove/edit entries
 * - Nested object support with tree view
 * - Unique key validation
 * - Multiple value types (string, number, boolean, array, object)
 * - Toggle between form view and raw JSON editor
 * - Drag and drop reordering (optional)
 * =============================================================================
 */

import {
  Show,
  For,
  createSignal,
  createMemo,
  createEffect,
  type Component,
} from "solid-js";
import { Icon } from '../ui/Icon';
import { tokens } from "@/design-system/tokens";
import { Button, Input, Text, Badge, Toggle } from "@/components/ui";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/** Supported value types for object entries */
export type ObjectValueType = "string" | "number" | "boolean" | "array" | "object" | "null";

/** Single entry in the object */
export interface ObjectEntry {
  key: string;
  value: unknown;
  type: ObjectValueType;
}

/** Validation result for a key */
export interface KeyValidationResult {
  valid: boolean;
  message?: string;
}

/** Props for the ObjectSettingWidget */
export interface ObjectSettingWidgetProps {
  /** The current object value */
  value: Record<string, unknown>;
  /** Callback when value changes */
  onChange: (value: Record<string, unknown>) => void;
  /** Whether the setting has been modified from default */
  isModified?: boolean;
  /** Whether there's an override from a higher scope */
  hasOverride?: boolean;
  /** Callback to reset to parent scope value */
  onReset?: () => void;
  /** Callback to reset to default value */
  onResetToDefault?: () => void;
  /** Optional label for the widget */
  label?: string;
  /** Optional description */
  description?: string;
  /** Whether the widget is disabled */
  disabled?: boolean;
  /** Maximum depth for nested objects (default: 5) */
  maxDepth?: number;
  /** Allowed value types (default: all) */
  allowedTypes?: ObjectValueType[];
  /** Custom key validator */
  validateKey?: (key: string, existingKeys: string[]) => KeyValidationResult;
  /** Whether to show the JSON toggle (default: true) */
  showJsonToggle?: boolean;
  /** Initial view mode */
  initialViewMode?: "form" | "json";
  /** Placeholder for new key input */
  keyPlaceholder?: string;
  /** Placeholder for new value input */
  valuePlaceholder?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Detect the type of a value
 */
function detectValueType(value: unknown): ObjectValueType {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "string";
}

/**
 * Parse a string value based on the expected type
 */
function parseValue(valueStr: string, type: ObjectValueType): unknown {
  switch (type) {
    case "boolean":
      return valueStr.toLowerCase() === "true";
    case "number":
      const num = parseFloat(valueStr);
      return isNaN(num) ? 0 : num;
    case "null":
      return null;
    case "array":
      try {
        const parsed = JSON.parse(valueStr);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    case "object":
      try {
        const parsed = JSON.parse(valueStr);
        return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    case "string":
    default:
      return valueStr;
  }
}

/**
 * Convert a value to a display string
 */
function valueToDisplayString(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Default key validator - checks for uniqueness and valid format
 */
function defaultKeyValidator(key: string, existingKeys: string[]): KeyValidationResult {
  if (!key.trim()) {
    return { valid: false, message: "Key cannot be empty" };
  }
  if (existingKeys.includes(key)) {
    return { valid: false, message: "Key already exists" };
  }
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) && !/^[\w.-]+$/.test(key)) {
    // Allow alphanumeric with dots, dashes, underscores
    if (key.includes(" ")) {
      return { valid: false, message: "Key cannot contain spaces" };
    }
  }
  return { valid: true };
}

/**
 * Get icon color for value type
 */
function getTypeColor(type: ObjectValueType): string {
  switch (type) {
    case "string": return "var(--cortex-success)"; // Green
    case "number": return "var(--cortex-info)"; // Blue
    case "boolean": return "var(--cortex-warning)"; // Amber
    case "array": return "var(--cortex-info)"; // Purple
    case "object": return "var(--cortex-error)"; // Pink
    case "null": return "var(--cortex-text-inactive)"; // Gray
    default: return tokens.colors.text.muted;
  }
}

/**
 * Get type badge label
 */
function getTypeBadgeLabel(type: ObjectValueType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// =============================================================================
// TYPE SELECTOR COMPONENT
// =============================================================================

interface TypeSelectorProps {
  value: ObjectValueType;
  onChange: (type: ObjectValueType) => void;
  allowedTypes?: ObjectValueType[];
  disabled?: boolean;
}

const TypeSelector: Component<TypeSelectorProps> = (props) => {
  const types: ObjectValueType[] = props.allowedTypes || ["string", "number", "boolean", "array", "object", "null"];

  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.currentTarget.value as ObjectValueType)}
      disabled={props.disabled}
      style={{
        height: "26px",
        padding: "2px 24px 2px 8px",
        background: tokens.colors.surface.panel,
        border: `1px solid ${tokens.colors.border.default}`,
        "border-radius": tokens.radius.sm,
        color: getTypeColor(props.value),
        "font-size": "11px",
        "font-weight": "500",
        outline: "none",
        cursor: props.disabled ? "not-allowed" : "pointer",
        appearance: "none",
        "background-image": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        "background-repeat": "no-repeat",
        "background-position": "right 6px center",
        opacity: props.disabled ? "0.5" : "1",
      }}
    >
      <For each={types}>
        {(type) => (
          <option value={type} style={{ color: getTypeColor(type) }}>
            {getTypeBadgeLabel(type)}
          </option>
        )}
      </For>
    </select>
  );
};

// =============================================================================
// VALUE EDITOR COMPONENT
// =============================================================================

interface ValueEditorProps {
  value: unknown;
  type: ObjectValueType;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  maxDepth?: number;
  currentDepth?: number;
  allowedTypes?: ObjectValueType[];
  validateKey?: (key: string, existingKeys: string[]) => KeyValidationResult;
}

const ValueEditor: Component<ValueEditorProps> = (props) => {
  const [localValue, setLocalValue] = createSignal(valueToDisplayString(props.value));

  createEffect(() => {
    setLocalValue(valueToDisplayString(props.value));
  });

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    props.onChange(parseValue(newValue, props.type));
  };

  // For nested objects, use a recursive ObjectSettingWidget
  if (props.type === "object" && typeof props.value === "object" && !Array.isArray(props.value) && props.value !== null) {
    const currentDepth = props.currentDepth || 0;
    const maxDepth = props.maxDepth || 5;

    if (currentDepth >= maxDepth) {
      return (
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Input
            value={localValue()}
            onInput={(e) => handleChange(e.currentTarget.value)}
            placeholder="Enter JSON..."
            disabled={props.disabled}
            style={{ flex: "1", "font-family": "var(--jb-font-code)", "font-size": "12px" }}
          />
          <Text size="xs" style={{ color: tokens.colors.text.muted }}>
            (max depth reached)
          </Text>
        </div>
      );
    }

    return (
      <NestedObjectEditor
        value={props.value as Record<string, unknown>}
        onChange={props.onChange}
        disabled={props.disabled}
        maxDepth={maxDepth}
        currentDepth={currentDepth + 1}
        allowedTypes={props.allowedTypes}
        validateKey={props.validateKey}
      />
    );
  }

  // For arrays, provide a simple JSON input or nested array editor
  if (props.type === "array") {
    return (
      <ArrayValueEditor
        value={Array.isArray(props.value) ? props.value : []}
        onChange={props.onChange}
        disabled={props.disabled}
      />
    );
  }

  // Boolean toggle
  if (props.type === "boolean") {
    return (
      <Toggle
        checked={props.value === true}
        onChange={(checked) => props.onChange(checked)}
        disabled={props.disabled}
      />
    );
  }

  // Number input
  if (props.type === "number") {
    return (
      <input
        type="number"
        value={typeof props.value === "number" ? props.value : 0}
        onInput={(e) => {
          const val = parseFloat(e.currentTarget.value);
          props.onChange(isNaN(val) ? 0 : val);
        }}
        disabled={props.disabled}
        style={{
          width: "120px",
          height: "26px",
          padding: "4px 8px",
          background: tokens.colors.surface.panel,
          border: `1px solid ${tokens.colors.border.default}`,
          "border-radius": tokens.radius.sm,
          color: tokens.colors.text.primary,
          "font-size": "12px",
          outline: "none",
        }}
      />
    );
  }

  // Null display
  if (props.type === "null") {
    return (
      <span style={{ color: tokens.colors.text.muted, "font-style": "italic", "font-size": "12px" }}>
        null
      </span>
    );
  }

  // String input (default)
  return (
    <Input
      value={typeof props.value === "string" ? props.value : String(props.value ?? "")}
      onInput={(e) => props.onChange(e.currentTarget.value)}
      placeholder="Enter value..."
      disabled={props.disabled}
      style={{ flex: "1", "min-width": "150px" }}
    />
  );
};

// =============================================================================
// ARRAY VALUE EDITOR
// =============================================================================

interface ArrayValueEditorProps {
  value: unknown[];
  onChange: (value: unknown[]) => void;
  disabled?: boolean;
}

const ArrayValueEditor: Component<ArrayValueEditorProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [newItemValue, setNewItemValue] = createSignal("");
  const [jsonMode, setJsonMode] = createSignal(false);
  const [jsonText, setJsonText] = createSignal("");

  createEffect(() => {
    setJsonText(JSON.stringify(props.value, null, 2));
  });

  const addItem = () => {
    const trimmed = newItemValue().trim();
    if (trimmed) {
      // Try to parse as JSON, otherwise use as string
      let parsedValue: unknown = trimmed;
      try {
        parsedValue = JSON.parse(trimmed);
      } catch {
        // Keep as string
      }
      props.onChange([...props.value, parsedValue]);
      setNewItemValue("");
    }
  };

  const removeItem = (index: number) => {
    props.onChange(props.value.filter((_, i) => i !== index));
  };

  const saveJson = () => {
    try {
      const parsed = JSON.parse(jsonText());
      if (Array.isArray(parsed)) {
        props.onChange(parsed);
        setJsonMode(false);
      }
    } catch {
      // Invalid JSON
    }
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <button
          onClick={() => setIsExpanded(!isExpanded())}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.colors.text.secondary,
            padding: "2px",
            display: "flex",
            "align-items": "center",
          }}
        >
          <Show when={isExpanded()} fallback={<Icon name="chevron-right" style={{ width: "14px", height: "14px" }} />}>
            <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />
          </Show>
        </button>
        <Badge size="sm" style={{ background: "rgba(139, 92, 246, 0.2)", color: "var(--cortex-info)" }}>
          Array [{props.value.length}]
        </Badge>
        <button
          onClick={() => setJsonMode(!jsonMode())}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: jsonMode() ? tokens.colors.semantic.primary : tokens.colors.text.muted,
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "border-radius": tokens.radius.sm,
          }}
          title={jsonMode() ? "Switch to form view" : "Edit as JSON"}
        >
          <Show when={jsonMode()} fallback={<Icon name="code" style={{ width: "14px", height: "14px" }} />}>
            <Icon name="list" style={{ width: "14px", height: "14px" }} />
          </Show>
        </button>
      </div>

      {/* Expanded content */}
      <Show when={isExpanded()}>
        <div style={{
          "margin-left": "20px",
          "padding-left": "12px",
          "border-left": `1px solid ${tokens.colors.border.default}`,
        }}>
          <Show when={!jsonMode()}>
            {/* Form view */}
            <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
              <For each={props.value}>
                {(item, index) => (
                  <div style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    padding: "4px 8px",
                    background: tokens.colors.surface.canvas,
                    "border-radius": tokens.radius.sm,
                  }}>
                    <span style={{ color: tokens.colors.text.muted, "font-size": "11px", "min-width": "24px" }}>
                      [{index()}]
                    </span>
                    <span style={{ flex: "1", "font-size": "12px", color: tokens.colors.text.primary }}>
                      {valueToDisplayString(item)}
                    </span>
                    <button
                      onClick={() => removeItem(index())}
                      disabled={props.disabled}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: props.disabled ? "not-allowed" : "pointer",
                        color: tokens.colors.text.muted,
                        padding: "2px",
                        display: "flex",
                        "align-items": "center",
                        opacity: props.disabled ? "0.5" : "1",
                      }}
                    >
                      <Icon name="minus" style={{ width: "12px", height: "12px" }} />
                    </button>
                  </div>
                )}
              </For>

              {/* Add new item */}
              <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-top": "4px" }}>
                <Input
                  value={newItemValue()}
                  onInput={(e) => setNewItemValue(e.currentTarget.value)}
                  placeholder="New item..."
                  disabled={props.disabled}
                  style={{ flex: "1" }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") addItem();
                  }}
                />
                <Button variant="ghost" size="sm" onClick={addItem} disabled={props.disabled || !newItemValue().trim()}>
                  <Icon name="plus" style={{ width: "12px", height: "12px" }} />
                </Button>
              </div>
            </div>
          </Show>

          <Show when={jsonMode()}>
            {/* JSON view */}
            <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
              <textarea
                value={jsonText()}
                onInput={(e) => setJsonText(e.currentTarget.value)}
                disabled={props.disabled}
                style={{
                  width: "100%",
                  height: "100px",
                  padding: "8px",
                  background: tokens.colors.surface.canvas,
                  border: `1px solid ${tokens.colors.border.default}`,
                  "border-radius": tokens.radius.sm,
                  color: tokens.colors.text.primary,
                  "font-family": "var(--jb-font-code)",
                  "font-size": "11px",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="primary" size="sm" onClick={saveJson} disabled={props.disabled}>
                  Apply
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  setJsonText(JSON.stringify(props.value, null, 2));
                  setJsonMode(false);
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

// =============================================================================
// NESTED OBJECT EDITOR
// =============================================================================

interface NestedObjectEditorProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
  maxDepth: number;
  currentDepth: number;
  allowedTypes?: ObjectValueType[];
  validateKey?: (key: string, existingKeys: string[]) => KeyValidationResult;
}

const NestedObjectEditor: Component<NestedObjectEditorProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(true);
  const [newKey, setNewKey] = createSignal("");
  const [newType, setNewType] = createSignal<ObjectValueType>("string");
  const [keyError, setKeyError] = createSignal<string | null>(null);

  const entries = createMemo(() => {
    return Object.entries(props.value).map(([key, value]) => ({
      key,
      value,
      type: detectValueType(value),
    }));
  });

  const existingKeys = createMemo(() => Object.keys(props.value));

  const validateNewKey = (key: string): KeyValidationResult => {
    const validator = props.validateKey || defaultKeyValidator;
    return validator(key, existingKeys());
  };

  const addEntry = () => {
    const key = newKey().trim();
    const validation = validateNewKey(key);
    
    if (!validation.valid) {
      setKeyError(validation.message || "Invalid key");
      return;
    }

    const defaultValue = (() => {
      switch (newType()) {
        case "string": return "";
        case "number": return 0;
        case "boolean": return false;
        case "array": return [];
        case "object": return {};
        case "null": return null;
        default: return "";
      }
    })();

    props.onChange({ ...props.value, [key]: defaultValue });
    setNewKey("");
    setKeyError(null);
  };

  const updateEntry = (key: string, newValue: unknown) => {
    props.onChange({ ...props.value, [key]: newValue });
  };

  const removeEntry = (key: string) => {
    const newObj = { ...props.value };
    delete newObj[key];
    props.onChange(newObj);
  };

  const updateEntryKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    
    const validation = validateNewKey(newKey);
    if (!validation.valid) return;

    const newObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props.value)) {
      newObj[k === oldKey ? newKey : k] = v;
    }
    props.onChange(newObj);
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <button
          onClick={() => setIsExpanded(!isExpanded())}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.colors.text.secondary,
            padding: "2px",
            display: "flex",
            "align-items": "center",
          }}
        >
          <Show when={isExpanded()} fallback={<Icon name="chevron-right" style={{ width: "14px", height: "14px" }} />}>
            <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />
          </Show>
        </button>
        <Badge size="sm" style={{ background: "rgba(236, 72, 153, 0.2)", color: "var(--cortex-error)" }}>
          Object {`{${entries().length}}`}
        </Badge>
      </div>

      {/* Content */}
      <Show when={isExpanded()}>
        <div style={{
          "margin-left": "20px",
          "padding-left": "12px",
          "border-left": `1px solid ${tokens.colors.border.default}`,
          display: "flex",
          "flex-direction": "column",
          gap: "6px",
        }}>
          {/* Entries */}
          <For each={entries()}>
            {(entry) => (
              <ObjectEntryRow
                entry={entry}
                onValueChange={(value) => updateEntry(entry.key, value)}
                onKeyChange={(newKey) => updateEntryKey(entry.key, newKey)}
                onRemove={() => removeEntry(entry.key)}
                disabled={props.disabled}
                maxDepth={props.maxDepth}
                currentDepth={props.currentDepth}
                allowedTypes={props.allowedTypes}
                validateKey={props.validateKey}
                existingKeys={existingKeys().filter(k => k !== entry.key)}
              />
            )}
          </For>

          {/* Add new entry */}
          <div style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            padding: "6px 8px",
            background: tokens.colors.surface.canvas,
            "border-radius": tokens.radius.sm,
            "margin-top": "4px",
          }}>
            <Input
              value={newKey()}
              onInput={(e) => {
                setNewKey(e.currentTarget.value);
                setKeyError(null);
              }}
              placeholder="New key..."
              disabled={props.disabled}
              style={{ width: "120px" }}
              onKeyPress={(e) => {
                if (e.key === "Enter") addEntry();
              }}
            />
            <TypeSelector
              value={newType()}
              onChange={setNewType}
              allowedTypes={props.allowedTypes}
              disabled={props.disabled}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={addEntry}
              disabled={props.disabled || !newKey().trim()}
            >
              <Icon name="plus" style={{ width: "12px", height: "12px" }} />
              Add
            </Button>
          </div>
          
          {/* Key error message */}
          <Show when={keyError()}>
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "6px",
              padding: "4px 8px",
              background: "rgba(239, 68, 68, 0.1)",
              "border-radius": tokens.radius.sm,
              color: "var(--cortex-error)",
              "font-size": "11px",
            }}>
              <Icon name="triangle-exclamation" style={{ width: "12px", height: "12px" }} />
              {keyError()}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

// =============================================================================
// OBJECT ENTRY ROW COMPONENT
// =============================================================================

interface ObjectEntryRowProps {
  entry: ObjectEntry;
  onValueChange: (value: unknown) => void;
  onKeyChange: (newKey: string) => void;
  onRemove: () => void;
  disabled?: boolean;
  maxDepth: number;
  currentDepth: number;
  allowedTypes?: ObjectValueType[];
  validateKey?: (key: string, existingKeys: string[]) => KeyValidationResult;
  existingKeys: string[];
}

const ObjectEntryRow: Component<ObjectEntryRowProps> = (props) => {
  const [isEditingKey, setIsEditingKey] = createSignal(false);
  const [editedKey, setEditedKey] = createSignal(props.entry.key);
  const [keyError, setKeyError] = createSignal<string | null>(null);
  const [currentType, setCurrentType] = createSignal(props.entry.type);

  createEffect(() => {
    setEditedKey(props.entry.key);
    setCurrentType(props.entry.type);
  });

  const handleKeyEdit = () => {
    const newKey = editedKey().trim();
    if (newKey !== props.entry.key) {
      const validator = props.validateKey || defaultKeyValidator;
      const validation = validator(newKey, props.existingKeys);
      
      if (!validation.valid) {
        setKeyError(validation.message || "Invalid key");
        return;
      }
      
      props.onKeyChange(newKey);
    }
    setIsEditingKey(false);
    setKeyError(null);
  };

  const handleTypeChange = (newType: ObjectValueType) => {
    setCurrentType(newType);
    // Convert value to new type
    const newValue = parseValue(valueToDisplayString(props.entry.value), newType);
    props.onValueChange(newValue);
  };

  const isNestedType = () => currentType() === "object" || currentType() === "array";

  return (
    <div style={{
      display: "flex",
      "flex-direction": isNestedType() ? "column" : "row",
      gap: "8px",
      padding: "6px 8px",
      background: tokens.colors.surface.panel,
      "border-radius": tokens.radius.sm,
      border: `1px solid ${tokens.colors.border.default}`,
    }}>
      {/* Key and controls row */}
      <div style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        flex: isNestedType() ? "none" : "1",
      }}>
        {/* Key */}
        <Show when={!isEditingKey()}>
          <div style={{
            display: "flex",
            "align-items": "center",
            gap: "4px",
            "min-width": "100px",
          }}>
            <span style={{
              "font-weight": "500",
              color: tokens.colors.text.primary,
              "font-size": "12px",
              "font-family": "var(--jb-font-code)",
            }}>
              {props.entry.key}
            </span>
            <button
              onClick={() => setIsEditingKey(true)}
              disabled={props.disabled}
              style={{
                background: "transparent",
                border: "none",
                cursor: props.disabled ? "not-allowed" : "pointer",
                color: tokens.colors.text.muted,
                padding: "2px",
                display: "flex",
                "align-items": "center",
                opacity: props.disabled ? "0.5" : "1",
              }}
              title="Edit key"
            >
              <Icon name="pen" style={{ width: "10px", height: "10px" }} />
            </button>
          </div>
        </Show>

        <Show when={isEditingKey()}>
          <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <Input
              value={editedKey()}
              onInput={(e) => {
                setEditedKey(e.currentTarget.value);
                setKeyError(null);
              }}
              style={{ width: "100px", height: "24px", "font-size": "11px" }}
              onKeyPress={(e) => {
                if (e.key === "Enter") handleKeyEdit();
                if (e.key === "Escape") {
                  setIsEditingKey(false);
                  setEditedKey(props.entry.key);
                  setKeyError(null);
                }
              }}
              autofocus
            />
            <button
              onClick={handleKeyEdit}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--cortex-success)",
                padding: "2px",
                display: "flex",
                "align-items": "center",
              }}
            >
              <Icon name="check" style={{ width: "12px", height: "12px" }} />
            </button>
            <button
              onClick={() => {
                setIsEditingKey(false);
                setEditedKey(props.entry.key);
                setKeyError(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--cortex-error)",
                padding: "2px",
                display: "flex",
                "align-items": "center",
              }}
            >
              <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
            </button>
          </div>
        </Show>

        {/* Key error */}
        <Show when={keyError()}>
          <span style={{ color: "var(--cortex-error)", "font-size": "10px" }}>{keyError()}</span>
        </Show>

        {/* Separator */}
        <span style={{ color: tokens.colors.text.muted }}>:</span>

        {/* Type selector */}
        <TypeSelector
          value={currentType()}
          onChange={handleTypeChange}
          allowedTypes={props.allowedTypes}
          disabled={props.disabled}
        />

        {/* Value (for non-nested types) */}
        <Show when={!isNestedType()}>
          <div style={{ flex: "1" }}>
            <ValueEditor
              value={props.entry.value}
              type={currentType()}
              onChange={props.onValueChange}
              disabled={props.disabled}
              maxDepth={props.maxDepth}
              currentDepth={props.currentDepth}
              allowedTypes={props.allowedTypes}
              validateKey={props.validateKey}
            />
          </div>
        </Show>

        {/* Remove button */}
        <button
          onClick={props.onRemove}
          disabled={props.disabled}
          style={{
            background: "transparent",
            border: "none",
            cursor: props.disabled ? "not-allowed" : "pointer",
            color: tokens.colors.text.muted,
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "border-radius": tokens.radius.sm,
            opacity: props.disabled ? "0.5" : "1",
            "margin-left": "auto",
          }}
          onMouseEnter={(e) => { if (!props.disabled) e.currentTarget.style.color = "var(--cortex-error)"; }}
          onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.muted}
          title="Remove entry"
        >
          <Icon name="trash" style={{ width: "14px", height: "14px" }} />
        </button>
      </div>

      {/* Value (for nested types) */}
      <Show when={isNestedType()}>
        <div style={{ "margin-left": "12px" }}>
          <ValueEditor
            value={props.entry.value}
            type={currentType()}
            onChange={props.onValueChange}
            disabled={props.disabled}
            maxDepth={props.maxDepth}
            currentDepth={props.currentDepth}
            allowedTypes={props.allowedTypes}
            validateKey={props.validateKey}
          />
        </div>
      </Show>
    </div>
  );
};

// =============================================================================
// MAIN OBJECT SETTING WIDGET COMPONENT
// =============================================================================

export const ObjectSettingWidget: Component<ObjectSettingWidgetProps> = (props) => {
  const [viewMode, setViewMode] = createSignal<"form" | "json">(props.initialViewMode || "form");
  const [jsonText, setJsonText] = createSignal("");
  const [jsonError, setJsonError] = createSignal<string | null>(null);
  const [newKey, setNewKey] = createSignal("");
  const [newType, setNewType] = createSignal<ObjectValueType>("string");
  const [keyError, setKeyError] = createSignal<string | null>(null);

  // Sync JSON text with value
  createEffect(() => {
    setJsonText(JSON.stringify(props.value, null, 2));
    setJsonError(null);
  });

  const entries = createMemo(() => {
    return Object.entries(props.value || {}).map(([key, value]) => ({
      key,
      value,
      type: detectValueType(value),
    }));
  });

  const existingKeys = createMemo(() => Object.keys(props.value || {}));

  const validateNewKey = (key: string): KeyValidationResult => {
    const validator = props.validateKey || defaultKeyValidator;
    return validator(key, existingKeys());
  };

  const addEntry = () => {
    const key = newKey().trim();
    const validation = validateNewKey(key);
    
    if (!validation.valid) {
      setKeyError(validation.message || "Invalid key");
      return;
    }

    const defaultValue = (() => {
      switch (newType()) {
        case "string": return "";
        case "number": return 0;
        case "boolean": return false;
        case "array": return [];
        case "object": return {};
        case "null": return null;
        default: return "";
      }
    })();

    props.onChange({ ...props.value, [key]: defaultValue });
    setNewKey("");
    setKeyError(null);
  };

  const updateEntry = (key: string, newValue: unknown) => {
    props.onChange({ ...props.value, [key]: newValue });
  };

  const removeEntry = (key: string) => {
    const newObj = { ...props.value };
    delete newObj[key];
    props.onChange(newObj);
  };

  const updateEntryKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    
    const validation = validateNewKey(newKey);
    if (!validation.valid) return;

    const newObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props.value)) {
      newObj[k === oldKey ? newKey : k] = v;
    }
    props.onChange(newObj);
  };

  const saveJson = () => {
    try {
      const parsed = JSON.parse(jsonText());
      if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) {
        props.onChange(parsed);
        setJsonError(null);
      } else {
        setJsonError("Value must be an object");
      }
    } catch (e) {
      setJsonError("Invalid JSON syntax");
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(props.value, null, 2));
    } catch {
      // Clipboard access denied
    }
  };

  const showJsonToggle = props.showJsonToggle !== false;
  const maxDepth = props.maxDepth || 5;

  return (
    <div style={{
      display: "flex",
      "flex-direction": "column",
      gap: "12px",
    }}>
      {/* Header with label and controls */}
      <Show when={props.label || showJsonToggle}>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
          <Show when={props.label}>
            <Text weight="medium" style={{ color: tokens.colors.text.primary }}>
              {props.label}
            </Text>
          </Show>
          
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            {/* Entry count badge */}
            <Badge size="sm" style={{ background: tokens.colors.surface.panel }}>
              {entries().length} {entries().length === 1 ? "entry" : "entries"}
            </Badge>

            {/* Copy button */}
            <button
              onClick={copyToClipboard}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: tokens.colors.text.muted,
                padding: "4px",
                display: "flex",
                "align-items": "center",
                "border-radius": tokens.radius.sm,
              }}
              title="Copy as JSON"
            >
              <Icon name="copy" style={{ width: "14px", height: "14px" }} />
            </button>

            {/* View mode toggle */}
            <Show when={showJsonToggle}>
              <div style={{
                display: "flex",
                "align-items": "center",
                gap: "2px",
                padding: "2px",
                background: tokens.colors.surface.canvas,
                "border-radius": tokens.radius.sm,
                border: `1px solid ${tokens.colors.border.default}`,
              }}>
                <button
                  onClick={() => setViewMode("form")}
                  style={{
                    background: viewMode() === "form" ? tokens.colors.surface.panel : "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: viewMode() === "form" ? tokens.colors.text.primary : tokens.colors.text.muted,
                    padding: "4px 8px",
                    display: "flex",
                    "align-items": "center",
                    gap: "4px",
                    "border-radius": tokens.radius.sm,
                    "font-size": "11px",
                  }}
                >
                  <Icon name="list" style={{ width: "12px", height: "12px" }} />
                  Form
                </button>
                <button
                  onClick={() => setViewMode("json")}
                  style={{
                    background: viewMode() === "json" ? tokens.colors.surface.panel : "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: viewMode() === "json" ? tokens.colors.text.primary : tokens.colors.text.muted,
                    padding: "4px 8px",
                    display: "flex",
                    "align-items": "center",
                    gap: "4px",
                    "border-radius": tokens.radius.sm,
                    "font-size": "11px",
                  }}
                >
                  <Icon name="code" style={{ width: "12px", height: "12px" }} />
                  JSON
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Description */}
      <Show when={props.description}>
        <Text size="sm" style={{ color: tokens.colors.text.secondary }}>
          {props.description}
        </Text>
      </Show>

      {/* Form View */}
      <Show when={viewMode() === "form"}>
        <div style={{
          display: "flex",
          "flex-direction": "column",
          gap: "8px",
          padding: "12px",
          background: tokens.colors.surface.canvas,
          "border-radius": tokens.radius.md,
          border: `1px solid ${tokens.colors.border.default}`,
        }}>
          {/* Entries list */}
          <Show when={entries().length > 0}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
              <For each={entries()}>
                {(entry) => (
                  <ObjectEntryRow
                    entry={entry}
                    onValueChange={(value) => updateEntry(entry.key, value)}
                    onKeyChange={(newKey) => updateEntryKey(entry.key, newKey)}
                    onRemove={() => removeEntry(entry.key)}
                    disabled={props.disabled}
                    maxDepth={maxDepth}
                    currentDepth={1}
                    allowedTypes={props.allowedTypes}
                    validateKey={props.validateKey}
                    existingKeys={existingKeys().filter(k => k !== entry.key)}
                  />
                )}
              </For>
            </div>
          </Show>

          {/* Empty state */}
          <Show when={entries().length === 0}>
            <div style={{
              padding: "24px",
              "text-align": "center",
              color: tokens.colors.text.muted,
            }}>
              <Text size="sm">No entries. Add a new key-value pair below.</Text>
            </div>
          </Show>

          {/* Add new entry */}
          <div style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            padding: "8px",
            background: tokens.colors.surface.panel,
            "border-radius": tokens.radius.sm,
            "margin-top": "8px",
          }}>
            <Input
              value={newKey()}
              onInput={(e) => {
                setNewKey(e.currentTarget.value);
                setKeyError(null);
              }}
              placeholder={props.keyPlaceholder || "Key"}
              disabled={props.disabled}
              style={{ width: "140px" }}
              onKeyPress={(e) => {
                if (e.key === "Enter") addEntry();
              }}
            />
            <TypeSelector
              value={newType()}
              onChange={setNewType}
              allowedTypes={props.allowedTypes}
              disabled={props.disabled}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={addEntry}
              disabled={props.disabled || !newKey().trim()}
            >
              <Icon name="plus" style={{ width: "14px", height: "14px" }} />
              Add Entry
            </Button>
          </div>

          {/* Key error message */}
          <Show when={keyError()}>
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "6px",
              padding: "6px 10px",
              background: "rgba(239, 68, 68, 0.1)",
              "border-radius": tokens.radius.sm,
              color: "var(--cortex-error)",
              "font-size": "12px",
            }}>
              <Icon name="triangle-exclamation" style={{ width: "14px", height: "14px" }} />
              {keyError()}
            </div>
          </Show>
        </div>
      </Show>

      {/* JSON View */}
      <Show when={viewMode() === "json"}>
        <div style={{
          display: "flex",
          "flex-direction": "column",
          gap: "8px",
        }}>
          <textarea
            value={jsonText()}
            onInput={(e) => {
              setJsonText(e.currentTarget.value);
              setJsonError(null);
            }}
            disabled={props.disabled}
            style={{
              width: "100%",
              height: "200px",
              padding: "12px",
              background: tokens.colors.surface.canvas,
              border: jsonError()
                ? "1px solid var(--cortex-error)"
                : `1px solid ${tokens.colors.border.default}`,
              "border-radius": tokens.radius.md,
              color: tokens.colors.text.primary,
              "font-family": "var(--jb-font-code)",
              "font-size": "12px",
              "line-height": "1.5",
              resize: "vertical",
              outline: "none",
            }}
            spellcheck={false}
          />

          {/* JSON error message */}
          <Show when={jsonError()}>
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "6px",
              padding: "6px 10px",
              background: "rgba(239, 68, 68, 0.1)",
              "border-radius": tokens.radius.sm,
              color: "var(--cortex-error)",
              "font-size": "12px",
            }}>
              <Icon name="triangle-exclamation" style={{ width: "14px", height: "14px" }} />
              {jsonError()}
            </div>
          </Show>

          {/* JSON actions */}
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="primary" size="sm" onClick={saveJson} disabled={props.disabled}>
              <Icon name="check" style={{ width: "14px", height: "14px" }} />
              Apply Changes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setJsonText(JSON.stringify(props.value, null, 2));
                setJsonError(null);
              }}
              disabled={props.disabled}
            >
              <Icon name="rotate-left" style={{ width: "14px", height: "14px" }} />
              Revert
            </Button>
          </div>
        </div>
      </Show>

      {/* Reset buttons */}
      <Show when={props.hasOverride || props.isModified}>
        <div style={{ display: "flex", gap: "8px", "margin-top": "8px" }}>
          <Show when={props.hasOverride && props.onReset}>
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onReset}
              style={{ color: "var(--cortex-info)" }}
            >
              <Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />
              Reset to user setting
            </Button>
          </Show>
          <Show when={props.isModified && !props.hasOverride && props.onResetToDefault}>
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onResetToDefault}
            >
              <Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />
              Reset to default
            </Button>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default ObjectSettingWidget;


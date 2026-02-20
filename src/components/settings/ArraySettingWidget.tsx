/**
 * =============================================================================
 * ARRAY SETTING WIDGET - Editable Array Settings Component
 * =============================================================================
 * 
 * A comprehensive widget for editing array-type settings with:
 * - List of items with index numbers
 * - Add/Remove functionality
 * - Drag & drop reordering
 * - Inline editing for each item
 * - Support for string, number, and object item types
 * - Schema-based validation
 * - Empty state messaging
 * 
 * =============================================================================
 */

import {
  Show,
  For,
  createSignal,
  createMemo,
  createEffect,
} from "solid-js";
import { Icon } from '../ui/Icon';
import { tokens } from "@/design-system/tokens";
import { Button, Text, Badge } from "@/components/ui";
import type { ArraySettingValue } from "@/types/settings";
import { validateSetting, type JSONSchema } from "@/utils/settingsValidation";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/** Supported item types in arrays */
export type ArrayItemType = "string" | "number" | "object" | "boolean";

/** Schema for array items */
export interface ArrayItemSchema extends JSONSchema {
  /** Type of array items */
  type?: ArrayItemType;
  /** For object items, define the shape */
  properties?: Record<string, JSONSchema>;
  /** Required properties for objects */
  required?: string[];
  /** Enum values for selection */
  enum?: unknown[];
  /** Enum descriptions */
  enumDescriptions?: string[];
  /** Pattern for string validation */
  pattern?: string;
  /** Min/max for numbers */
  minimum?: number;
  maximum?: number;
}

/** Props for ArraySettingWidget */
export interface ArraySettingWidgetProps {
  /** Setting ID for identification */
  settingId: string;
  /** Current array value */
  value: unknown[];
  /** Callback when value changes */
  onChange: (value: unknown[]) => void;
  /** Schema for array items */
  itemSchema?: ArrayItemSchema;
  /** Label for the setting */
  label?: string;
  /** Description of the setting */
  description?: string;
  /** Placeholder for new items */
  placeholder?: string;
  /** Maximum number of items allowed */
  maxItems?: number;
  /** Minimum number of items required */
  minItems?: number;
  /** Whether items must be unique */
  uniqueItems?: boolean;
  /** Whether the setting is disabled */
  disabled?: boolean;
  /** Whether items can be reordered */
  allowReorder?: boolean;
  /** Whether to show validation errors */
  showValidation?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Custom add button text */
  addButtonText?: string;
  /** Callback when validation state changes */
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
}

/** Internal state for drag and drop */
interface DragState {
  dragging: boolean;
  draggedIndex: number;
  targetIndex: number;
}

/** Validation state for an item */
interface ItemValidation {
  valid: boolean;
  message?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get default value for a given item type
 */
function getDefaultValue(itemSchema?: ArrayItemSchema): unknown {
  if (!itemSchema?.type) return "";
  
  switch (itemSchema.type) {
    case "string":
      return itemSchema.default ?? "";
    case "number":
      return itemSchema.default ?? (itemSchema.minimum ?? 0);
    case "boolean":
      return itemSchema.default ?? false;
    case "object":
      if (itemSchema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, propSchema] of Object.entries(itemSchema.properties)) {
          obj[key] = propSchema.default ?? getDefaultValueForType(propSchema.type as string);
        }
        return obj;
      }
      return {};
    default:
      return "";
  }
}

/**
 * Get default value for a primitive type
 */
function getDefaultValueForType(type?: string): unknown {
  switch (type) {
    case "string": return "";
    case "number": return 0;
    case "boolean": return false;
    case "object": return {};
    case "array": return [];
    default: return "";
  }
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Parse a string value to the expected type
 */
function parseValue(value: string, type?: ArrayItemType): unknown {
  if (!type || type === "string") return value;
  
  switch (type) {
    case "number":
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    case "boolean":
      return value.toLowerCase() === "true" || value === "1";
    case "object":
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    default:
      return value;
  }
}

// =============================================================================
// ARRAY ITEM COMPONENT
// =============================================================================

interface ArrayItemProps {
  index: number;
  value: unknown;
  itemSchema?: ArrayItemSchema;
  onUpdate: (value: unknown) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  isFirst: boolean;
  isLast: boolean;
  disabled?: boolean;
  allowReorder?: boolean;
  validation: ItemValidation;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
}

function ArrayItem(props: ArrayItemProps) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  const [isHovered, setIsHovered] = createSignal(false);

  // Initialize edit value when entering edit mode
  createEffect(() => {
    if (isEditing()) {
      setEditValue(formatValue(props.value));
    }
  });

  const handleSave = () => {
    const parsed = parseValue(editValue(), props.itemSchema?.type);
    props.onUpdate(parsed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(formatValue(props.value));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const isObjectType = () => props.itemSchema?.type === "object" && props.itemSchema?.properties;

  // Render object properties inline
  const renderObjectEditor = () => {
    if (!isObjectType() || !props.itemSchema?.properties) return null;
    
    const objValue = (props.value as Record<string, unknown>) || {};
    
    return (
      <div style={{ display: "flex", "flex-direction": "column", gap: "8px", width: "100%" }}>
        <For each={Object.entries(props.itemSchema!.properties!)}>
          {([propKey, propSchema]) => (
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <Text size="xs" style={{ color: tokens.colors.text.muted, "min-width": "80px" }}>
                {propKey}:
              </Text>
              <input
                type={propSchema.type === "number" ? "number" : "text"}
                value={formatValue(objValue[propKey])}
                onInput={(e) => {
                  const newObj = { ...objValue };
                  newObj[propKey] = parseValue(e.currentTarget.value, propSchema.type as ArrayItemType);
                  props.onUpdate(newObj);
                }}
                disabled={props.disabled}
                style={{
                  flex: "1",
                  height: "28px",
                  padding: "4px 8px",
                  background: tokens.colors.surface.panel,
                  border: `1px solid ${tokens.colors.border.default}`,
                  "border-radius": tokens.radius.sm,
                  color: tokens.colors.text.primary,
                  "font-size": "12px",
                  outline: "none",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = tokens.colors.border.focus}
                onBlur={(e) => e.currentTarget.style.borderColor = tokens.colors.border.default}
              />
            </div>
          )}
        </For>
      </div>
    );
  };

  // Render enum selector
  const renderEnumSelector = () => {
    if (!props.itemSchema?.enum) return null;
    
    return (
      <select
        value={String(props.value)}
        onChange={(e) => props.onUpdate(parseValue(e.currentTarget.value, props.itemSchema?.type))}
        disabled={props.disabled}
        style={{
          flex: "1",
          height: "28px",
          padding: "4px 8px",
          background: tokens.colors.surface.panel,
          border: `1px solid ${tokens.colors.border.default}`,
          "border-radius": tokens.radius.sm,
          color: tokens.colors.text.primary,
          "font-size": "12px",
          outline: "none",
          cursor: "pointer",
        }}
      >
        <For each={props.itemSchema.enum}>
          {(enumValue, i) => (
            <option value={String(enumValue)}>
              {props.itemSchema?.enumDescriptions?.[i()] || String(enumValue)}
            </option>
          )}
        </For>
      </select>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        "align-items": "flex-start",
        gap: "8px",
        padding: "10px 12px",
        background: props.isDropTarget 
          ? "rgba(53, 116, 240, 0.15)"
          : props.isDragging 
            ? "rgba(53, 116, 240, 0.1)"
            : isHovered() 
              ? tokens.colors.surface.panel 
              : "transparent",
        border: `1px solid ${
          !props.validation.valid
            ? tokens.colors.semantic.error
            : props.isDropTarget
              ? tokens.colors.semantic.primary
              : props.isDragging
                ? "rgba(53, 116, 240, 0.3)"
                : tokens.colors.border.default
        }`,
        "border-radius": tokens.radius.md,
        transition: "all 0.15s ease",
        opacity: props.isDragging ? "0.6" : "1",
        cursor: props.allowReorder && !props.disabled ? "grab" : "default",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      draggable={props.allowReorder && !props.disabled}
      onDragStart={(e) => {
        e.dataTransfer?.setData("text/plain", String(props.index));
        props.onDragStart();
      }}
      onDragEnd={props.onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        props.onDragOver();
      }}
    >
      {/* Index number */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "min-width": "24px",
          height: "24px",
          "border-radius": tokens.radius.sm,
          background: tokens.colors.surface.active,
          color: tokens.colors.text.muted,
          "font-size": "11px",
          "font-weight": "500",
          "flex-shrink": "0",
        }}
      >
        {props.index + 1}
      </div>

      {/* Drag handle */}
      <Show when={props.allowReorder && !props.disabled}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            color: tokens.colors.text.muted,
            cursor: "grab",
            padding: "4px",
            "flex-shrink": "0",
          }}
          title="Drag to reorder"
        >
          <Icon name="up-down-left-right" style={{ width: "14px", height: "14px" }} />
        </div>
      </Show>

      {/* Value display/editor */}
      <div style={{ flex: "1", "min-width": "0" }}>
        <Show when={isEditing() && !isObjectType() && !props.itemSchema?.enum}>
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <Show
              when={props.itemSchema?.type !== "object"}
              fallback={
                <textarea
                  value={editValue()}
                  onInput={(e) => setEditValue(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  style={{
                    flex: "1",
                    "min-height": "60px",
                    padding: "8px",
                    background: tokens.colors.surface.panel,
                    border: `1px solid ${tokens.colors.border.focus}`,
                    "border-radius": tokens.radius.sm,
                    color: tokens.colors.text.primary,
                    "font-family": "var(--jb-font-code)",
                    "font-size": "12px",
                    resize: "vertical",
                    outline: "none",
                  }}
                  autofocus
                />
              }
            >
              <input
                type={props.itemSchema?.type === "number" ? "number" : "text"}
                value={editValue()}
                onInput={(e) => setEditValue(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                min={props.itemSchema?.minimum}
                max={props.itemSchema?.maximum}
                style={{
                  flex: "1",
                  height: "28px",
                  padding: "4px 8px",
                  background: tokens.colors.surface.panel,
                  border: `1px solid ${tokens.colors.border.focus}`,
                  "border-radius": tokens.radius.sm,
                  color: tokens.colors.text.primary,
                  "font-size": "12px",
                  outline: "none",
                }}
                autofocus
              />
            </Show>
            <button
              onClick={handleSave}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "24px",
                height: "24px",
                background: tokens.colors.semantic.success,
                border: "none",
                "border-radius": tokens.radius.sm,
                cursor: "pointer",
                color: "var(--cortex-text-primary)",
              }}
              title="Save (Enter)"
            >
              <Icon name="check" style={{ width: "14px", height: "14px" }} />
            </button>
            <button
              onClick={handleCancel}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "24px",
                height: "24px",
                background: tokens.colors.surface.active,
                border: "none",
                "border-radius": tokens.radius.sm,
                cursor: "pointer",
                color: tokens.colors.text.muted,
              }}
              title="Cancel (Esc)"
            >
              <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
            </button>
          </div>
        </Show>

        <Show when={!isEditing()}>
          <Show when={isObjectType()}>
            {renderObjectEditor()}
          </Show>
          <Show when={props.itemSchema?.enum}>
            {renderEnumSelector()}
          </Show>
          <Show when={!isObjectType() && !props.itemSchema?.enum}>
            <div
              onClick={() => !props.disabled && setIsEditing(true)}
              style={{
                padding: "4px 8px",
                background: "transparent",
                "border-radius": tokens.radius.sm,
                color: tokens.colors.text.primary,
                "font-size": "13px",
                "word-break": "break-all",
                cursor: props.disabled ? "default" : "text",
                "min-height": "24px",
                display: "flex",
                "align-items": "center",
              }}
              title={props.disabled ? undefined : "Click to edit"}
            >
              <Show when={props.value !== "" && props.value !== null && props.value !== undefined}>
                {formatValue(props.value)}
              </Show>
              <Show when={props.value === "" || props.value === null || props.value === undefined}>
                <span style={{ color: tokens.colors.text.muted, "font-style": "italic" }}>
                  (empty)
                </span>
              </Show>
            </div>
          </Show>
        </Show>

        {/* Validation error */}
        <Show when={!props.validation.valid && props.validation.message}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
              "margin-top": "4px",
              color: tokens.colors.semantic.error,
              "font-size": "11px",
            }}
          >
            <Icon name="circle-exclamation" style={{ width: "12px", height: "12px" }} />
            {props.validation.message}
          </div>
        </Show>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "2px",
          "flex-shrink": "0",
          opacity: isHovered() || isEditing() ? "1" : "0.5",
          transition: "opacity 0.15s ease",
        }}
      >
        {/* Edit button (for non-object types) */}
        <Show when={!isObjectType() && !props.itemSchema?.enum && !props.disabled}>
          <button
            onClick={() => setIsEditing(true)}
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "24px",
              height: "24px",
              background: "transparent",
              border: "none",
              "border-radius": tokens.radius.sm,
              cursor: "pointer",
              color: tokens.colors.text.muted,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
              e.currentTarget.style.color = tokens.colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = tokens.colors.text.muted;
            }}
            title="Edit"
          >
            <Icon name="pen" style={{ width: "12px", height: "12px" }} />
          </button>
        </Show>

        {/* Move up button */}
        <Show when={props.allowReorder && !props.isFirst && !props.disabled}>
          <button
            onClick={props.onMoveUp}
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "24px",
              height: "24px",
              background: "transparent",
              border: "none",
              "border-radius": tokens.radius.sm,
              cursor: "pointer",
              color: tokens.colors.text.muted,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
              e.currentTarget.style.color = tokens.colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = tokens.colors.text.muted;
            }}
            title="Move up"
          >
            <Icon name="chevron-up" style={{ width: "14px", height: "14px" }} />
          </button>
        </Show>

        {/* Move down button */}
        <Show when={props.allowReorder && !props.isLast && !props.disabled}>
          <button
            onClick={props.onMoveDown}
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "24px",
              height: "24px",
              background: "transparent",
              border: "none",
              "border-radius": tokens.radius.sm,
              cursor: "pointer",
              color: tokens.colors.text.muted,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
              e.currentTarget.style.color = tokens.colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = tokens.colors.text.muted;
            }}
            title="Move down"
          >
            <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />
          </button>
        </Show>

        {/* Duplicate button */}
        <Show when={!props.disabled}>
          <button
            onClick={props.onDuplicate}
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "24px",
              height: "24px",
              background: "transparent",
              border: "none",
              "border-radius": tokens.radius.sm,
              cursor: "pointer",
              color: tokens.colors.text.muted,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
              e.currentTarget.style.color = tokens.colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = tokens.colors.text.muted;
            }}
            title="Duplicate"
          >
            <Icon name="copy" style={{ width: "12px", height: "12px" }} />
          </button>
        </Show>

        {/* Remove button */}
        <Show when={!props.disabled}>
          <button
            onClick={props.onRemove}
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "24px",
              height: "24px",
              background: "transparent",
              border: "none",
              "border-radius": tokens.radius.sm,
              cursor: "pointer",
              color: tokens.colors.text.muted,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(247, 84, 100, 0.15)";
              e.currentTarget.style.color = tokens.colors.semantic.error;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = tokens.colors.text.muted;
            }}
            title="Remove"
          >
            <Icon name="trash" style={{ width: "12px", height: "12px" }} />
          </button>
        </Show>
      </div>
    </div>
  );
}

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

interface EmptyStateProps {
  message: string;
  onAdd: () => void;
  addButtonText: string;
  disabled?: boolean;
}

function EmptyState(props: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        padding: "32px 16px",
        background: tokens.colors.surface.canvas,
        border: `1px dashed ${tokens.colors.border.default}`,
        "border-radius": tokens.radius.md,
        "text-align": "center",
      }}
    >
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          width: "48px",
          height: "48px",
          "border-radius": "var(--cortex-radius-full)",
          background: tokens.colors.surface.panel,
          "margin-bottom": "12px",
        }}
      >
        <Icon name="plus" style={{ width: "24px", height: "24px", color: tokens.colors.text.muted }} />
      </div>
      <Text size="sm" style={{ color: tokens.colors.text.muted, "margin-bottom": "16px" }}>
        {props.message}
      </Text>
      <Button
        variant="primary"
        size="sm"
        onClick={props.onAdd}
        disabled={props.disabled}
        icon={<Icon name="plus" style={{ width: "14px", height: "14px" }} />}
      >
        {props.addButtonText}
      </Button>
    </div>
  );
}

// =============================================================================
// MAIN ARRAY SETTING WIDGET COMPONENT
// =============================================================================

export function ArraySettingWidget(props: ArraySettingWidgetProps) {
  const [dragState, setDragState] = createSignal<DragState>({
    dragging: false,
    draggedIndex: -1,
    targetIndex: -1,
  });
  const [newItemValue, setNewItemValue] = createSignal("");
  const [showAddInput, setShowAddInput] = createSignal(false);

  // Validate all items
  const itemValidations = createMemo((): ItemValidation[] => {
    if (!props.showValidation || !props.itemSchema) {
      return props.value.map(() => ({ valid: true }));
    }

    return props.value.map((item, index) => {
      const result = validateSetting(item, props.itemSchema!, `[${index}]`);
      return {
        valid: result.valid,
        message: result.errors[0]?.message,
      };
    });
  });

  // Overall validation state
  const overallValidation = createMemo(() => {
    const errors: string[] = [];
    
    // Check minItems
    if (props.minItems !== undefined && props.value.length < props.minItems) {
      errors.push(`Minimum ${props.minItems} item${props.minItems !== 1 ? "s" : ""} required`);
    }
    
    // Check maxItems
    if (props.maxItems !== undefined && props.value.length > props.maxItems) {
      errors.push(`Maximum ${props.maxItems} item${props.maxItems !== 1 ? "s" : ""} allowed`);
    }
    
    // Check uniqueItems
    if (props.uniqueItems) {
      const seen = new Set<string>();
      for (let i = 0; i < props.value.length; i++) {
        const serialized = JSON.stringify(props.value[i]);
        if (seen.has(serialized)) {
          errors.push(`Duplicate item at position ${i + 1}`);
          break;
        }
        seen.add(serialized);
      }
    }
    
    // Check individual item validations
    const invalidItems = itemValidations().filter(v => !v.valid);
    if (invalidItems.length > 0) {
      errors.push(`${invalidItems.length} item${invalidItems.length !== 1 ? "s have" : " has"} validation errors`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  });

  // Notify parent of validation changes
  createEffect(() => {
    const validation = overallValidation();
    props.onValidationChange?.(validation.valid, validation.errors);
  });

  // Array manipulation functions
  const addItem = (item?: unknown) => {
    if (props.maxItems !== undefined && props.value.length >= props.maxItems) {
      return;
    }
    
    const newItem = item ?? parseValue(newItemValue(), props.itemSchema?.type) ?? getDefaultValue(props.itemSchema);
    
    // Check uniqueness
    if (props.uniqueItems) {
      const serialized = JSON.stringify(newItem);
      if (props.value.some(v => JSON.stringify(v) === serialized)) {
        return; // Don't add duplicate
      }
    }
    
    props.onChange([...props.value, newItem]);
    setNewItemValue("");
    setShowAddInput(false);
  };

  const removeItem = (index: number) => {
    if (props.minItems !== undefined && props.value.length <= props.minItems) {
      return;
    }
    props.onChange(props.value.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, newValue: unknown) => {
    const newArray = [...props.value];
    newArray[index] = newValue;
    props.onChange(newArray);
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newArray = [...props.value];
    const [removed] = newArray.splice(fromIndex, 1);
    newArray.splice(toIndex, 0, removed);
    props.onChange(newArray);
  };

  const duplicateItem = (index: number) => {
    if (props.maxItems !== undefined && props.value.length >= props.maxItems) {
      return;
    }
    
    const itemToDuplicate = props.value[index];
    const cloned = JSON.parse(JSON.stringify(itemToDuplicate));
    
    // Check uniqueness - skip if would create duplicate
    if (props.uniqueItems) {
      const serialized = JSON.stringify(cloned);
      if (props.value.some(v => JSON.stringify(v) === serialized)) {
        return;
      }
    }
    
    const newArray = [...props.value];
    newArray.splice(index + 1, 0, cloned);
    props.onChange(newArray);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDragState({
      dragging: true,
      draggedIndex: index,
      targetIndex: index,
    });
  };

  const handleDragEnd = () => {
    const state = dragState();
    if (state.dragging && state.draggedIndex !== state.targetIndex) {
      moveItem(state.draggedIndex, state.targetIndex);
    }
    setDragState({
      dragging: false,
      draggedIndex: -1,
      targetIndex: -1,
    });
  };

  const handleDragOver = (index: number) => {
    const state = dragState();
    if (state.dragging && state.targetIndex !== index) {
      setDragState({
        ...state,
        targetIndex: index,
      });
    }
  };

  // Handle add input key press
  const handleAddKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    } else if (e.key === "Escape") {
      setShowAddInput(false);
      setNewItemValue("");
    }
  };

  // Determine if we can add more items
  const canAddMore = () => {
    return props.maxItems === undefined || props.value.length < props.maxItems;
  };

  const emptyMessage = props.emptyMessage || "No items added yet";
  const addButtonText = props.addButtonText || "Add Item";

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
      {/* Header with label and info */}
      <Show when={props.label}>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <Text weight="medium" style={{ color: tokens.colors.text.primary }}>
                {props.label}
              </Text>
              <Badge size="sm" style={{ background: tokens.colors.surface.active }}>
                {props.value.length} item{props.value.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <Show when={props.description}>
              <Text size="xs" style={{ color: tokens.colors.text.muted }}>
                {props.description}
              </Text>
            </Show>
          </div>
          
          {/* Constraints info */}
          <Show when={props.minItems !== undefined || props.maxItems !== undefined}>
            <Text size="xs" style={{ color: tokens.colors.text.muted }}>
              <Show when={props.minItems !== undefined}>
                Min: {props.minItems}
              </Show>
              <Show when={props.minItems !== undefined && props.maxItems !== undefined}>
                {" / "}
              </Show>
              <Show when={props.maxItems !== undefined}>
                Max: {props.maxItems}
              </Show>
            </Text>
          </Show>
        </div>
      </Show>

      {/* Validation errors */}
      <Show when={props.showValidation && !overallValidation().valid}>
        <div
          style={{
            display: "flex",
            "flex-direction": "column",
            gap: "4px",
            padding: "8px 12px",
            background: "rgba(247, 84, 100, 0.1)",
            border: `1px solid rgba(247, 84, 100, 0.3)`,
            "border-radius": tokens.radius.sm,
          }}
        >
          <For each={overallValidation().errors}>
            {(error) => (
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                  color: tokens.colors.semantic.error,
                  "font-size": "12px",
                }}
              >
                <Icon name="circle-exclamation" style={{ width: "12px", height: "12px", "flex-shrink": "0" }} />
                {error}
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Items list */}
      <Show
        when={props.value.length > 0}
        fallback={
          <EmptyState
            message={emptyMessage}
            onAdd={() => addItem()}
            addButtonText={addButtonText}
            disabled={props.disabled || !canAddMore()}
          />
        }
      >
        <div
          style={{
            display: "flex",
            "flex-direction": "column",
            gap: "6px",
          }}
        >
          <For each={props.value}>
            {(item, index) => (
              <ArrayItem
                index={index()}
                value={item}
                itemSchema={props.itemSchema}
                onUpdate={(newValue) => updateItem(index(), newValue)}
                onRemove={() => removeItem(index())}
                onMoveUp={() => moveItem(index(), index() - 1)}
                onMoveDown={() => moveItem(index(), index() + 1)}
                onDuplicate={() => duplicateItem(index())}
                isFirst={index() === 0}
                isLast={index() === props.value.length - 1}
                disabled={props.disabled}
                allowReorder={props.allowReorder !== false}
                validation={itemValidations()[index()]}
                isDragging={dragState().dragging && dragState().draggedIndex === index()}
                isDropTarget={dragState().dragging && dragState().targetIndex === index() && dragState().draggedIndex !== index()}
                onDragStart={() => handleDragStart(index())}
                onDragEnd={handleDragEnd}
                onDragOver={() => handleDragOver(index())}
              />
            )}
          </For>
        </div>
      </Show>

      {/* Add new item section */}
      <Show when={props.value.length > 0 && canAddMore() && !props.disabled}>
        <Show
          when={showAddInput()}
          fallback={
            <Button
              variant="ghost"
              size="sm"
            onClick={() => setShowAddInput(true)}
            icon={<Icon name="plus" style={{ width: "14px", height: "14px" }} />}
            style={{
                "align-self": "flex-start",
                color: tokens.colors.text.secondary,
              }}
            >
              {addButtonText}
            </Button>
          }
        >
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "8px 12px",
              background: tokens.colors.surface.panel,
              border: `1px solid ${tokens.colors.border.default}`,
              "border-radius": tokens.radius.md,
            }}
          >
            <Show
              when={!props.itemSchema?.type || props.itemSchema.type === "string"}
              fallback={
                <Show when={props.itemSchema?.type === "number"}>
                  <input
                    type="number"
                    value={newItemValue()}
                    onInput={(e) => setNewItemValue(e.currentTarget.value)}
                    onKeyDown={handleAddKeyDown}
                    min={props.itemSchema?.minimum}
                    max={props.itemSchema?.maximum}
                    placeholder={props.placeholder || "Enter a number..."}
                    style={{
                      flex: "1",
                      height: "28px",
                      padding: "4px 8px",
                      background: tokens.colors.surface.canvas,
                      border: `1px solid ${tokens.colors.border.default}`,
                      "border-radius": tokens.radius.sm,
                      color: tokens.colors.text.primary,
                      "font-size": "12px",
                      outline: "none",
                    }}
                    autofocus
                  />
                </Show>
              }
            >
              <input
                type="text"
                value={newItemValue()}
                onInput={(e) => setNewItemValue(e.currentTarget.value)}
                onKeyDown={handleAddKeyDown}
                placeholder={props.placeholder || "Enter a value..."}
                style={{
                  flex: "1",
                  height: "28px",
                  padding: "4px 8px",
                  background: tokens.colors.surface.canvas,
                  border: `1px solid ${tokens.colors.border.default}`,
                  "border-radius": tokens.radius.sm,
                  color: tokens.colors.text.primary,
                  "font-size": "12px",
                  outline: "none",
                }}
                autofocus
              />
            </Show>
            <Button
              variant="primary"
              size="sm"
              onClick={() => addItem()}
              disabled={!newItemValue().trim() && props.itemSchema?.type !== "object"}
            >
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddInput(false);
                setNewItemValue("");
              }}
            >
              Cancel
            </Button>
          </div>
        </Show>
      </Show>
    </div>
  );
}

// =============================================================================
// HOOK FOR ARRAY SETTING VALUE
// =============================================================================

/**
 * Create an ArraySettingValue interface for managing array settings
 */
export function createArraySettingValue<T = unknown>(
  initialValue: T[] = [],
  onChange?: (value: T[]) => void
): ArraySettingValue<T> {
  const [items, setItems] = createSignal<T[]>(initialValue);

  const updateItems = (newItems: T[]) => {
    setItems(newItems as any);
    onChange?.(newItems);
  };

  return {
    get items() {
      return items();
    },
    addItem: (item: T) => {
      updateItems([...items(), item]);
    },
    removeItem: (index: number) => {
      updateItems(items().filter((_, i) => i !== index));
    },
    moveItem: (fromIndex: number, toIndex: number) => {
      const newItems = [...items()];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, removed);
      updateItems(newItems);
    },
    updateItem: (index: number, item: T) => {
      const newItems = [...items()];
      newItems[index] = item;
      updateItems(newItems);
    },
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ArraySettingWidget;


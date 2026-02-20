import {
  JSX,
  Show,
  For,
  splitProps,
  createSignal,
  createMemo,
  ParentProps,
} from "solid-js";
import { Tooltip } from "@/components/ui/Tooltip";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// ============================================================================
// Types
// ============================================================================

export type NodeStatus = "idle" | "running" | "success" | "error" | "warning";

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeSize {
  width: number;
  height: number;
}

export interface NodePort {
  id: string;
  label: string;
  type: "input" | "output";
  dataType?: PortDataType;
  connected?: boolean;
  multiple?: boolean;
}

export type PortDataType =
  | "any"
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "agent"
  | "message"
  | "event"
  | "error";

export interface NodeValidationError {
  field?: string;
  message: string;
  severity: "error" | "warning";
}

export interface BaseNodeData {
  label: string;
  description?: string;
  inputs?: NodePort[];
  outputs?: NodePort[];
  errors?: NodeValidationError[];
  metadata?: Record<string, unknown>;
}

export interface BaseNodeProps<T extends BaseNodeData = BaseNodeData> {
  id: string;
  type: string;
  position: NodePosition;
  size?: NodeSize;
  selected?: boolean;
  multiSelected?: boolean;
  data: T;
  status?: NodeStatus;
  progress?: number;
  resizable?: boolean;
  disabled?: boolean;
  onSelect?: (id: string, multi: boolean) => void;
  onDragStart?: (id: string, e: MouseEvent) => void;
  onDragEnd?: (id: string, position: NodePosition) => void;
  onResize?: (id: string, size: NodeSize) => void;
  onPortDragStart?: (nodeId: string, portId: string, type: "input" | "output") => void;
  onPortDrop?: (nodeId: string, portId: string, type: "input" | "output") => void;
  onPortHover?: (nodeId: string, portId: string | null) => void;
  onContextMenu?: (id: string, e: MouseEvent) => void;
}

// ============================================================================
// Port Color Mapping
// ============================================================================

export const PORT_COLORS: Record<PortDataType, string> = {
  any: "var(--port-any)",
  string: "var(--port-string)",
  number: "var(--port-number)",
  boolean: "var(--port-boolean)",
  object: "var(--port-object)",
  array: "var(--port-array)",
  agent: "var(--port-agent)",
  message: "var(--port-message)",
  event: "var(--port-event)",
  error: "var(--port-error)",
};

// ============================================================================
// Status Indicator
// ============================================================================

interface StatusIndicatorProps {
  status: NodeStatus;
  progress?: number;
}

function StatusIndicator(props: StatusIndicatorProps) {
  const statusColor = createMemo(() => {
    switch (props.status) {
      case "running":
        return "var(--jb-border-focus)";
      case "success":
        return "var(--cortex-success)";
      case "error":
        return "var(--cortex-error)";
      case "warning":
        return "var(--cortex-warning)";
      default:
        return "transparent";
    }
  });

  return (
    <div
      class="node-status"
      style={{
        position: "absolute",
        top: "-2px",
        right: "-2px",
        width: "10px",
        height: "10px",
        "border-radius": "var(--cortex-radius-full)",
        background: statusColor(),
        border: "2px solid var(--ui-panel-bg)",
        display: props.status === "idle" ? "none" : "flex",
        "align-items": "center",
        "justify-content": "center",
        "z-index": "10",
      }}
    >
      <Show when={props.status === "running"}>
        <LoadingSpinner size="sm" />
      </Show>
    </div>
  );
}

// ============================================================================
// Resize Handle
// ============================================================================

interface ResizeHandleProps {
  onResizeStart: (e: MouseEvent) => void;
}

function ResizeHandle(props: ResizeHandleProps) {
  return (
    <div
      class="node-resize-handle"
      style={{
        position: "absolute",
        bottom: "0",
        right: "0",
        width: "12px",
        height: "12px",
        cursor: "se-resize",
        opacity: "0.5",
        transition: "opacity var(--cortex-transition-fast)",
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        props.onResizeStart(e);
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="currentColor"
        style={{ opacity: "0.5" }}
      >
        <path d="M11 11H9V9H11V11ZM11 7H9V5H11V7ZM7 11H5V9H7V11Z" />
      </svg>
    </div>
  );
}

// ============================================================================
// Drag Handle
// ============================================================================

interface DragHandleProps {
  onDragStart: (e: MouseEvent) => void;
}

function DragHandle(props: DragHandleProps) {
  return (
    <div
      class="node-drag-handle"
      style={{
        cursor: "grab",
        padding: "2px 4px",
        display: "flex",
        "align-items": "center",
        opacity: "0.5",
        transition: "opacity var(--cortex-transition-fast)",
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        (e.currentTarget as HTMLElement).style.cursor = "grabbing";
        props.onDragStart(e);
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLElement).style.cursor = "grab";
      }}
    >
      <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
        <circle cx="2" cy="2" r="1.5" />
        <circle cx="6" cy="2" r="1.5" />
        <circle cx="2" cy="7" r="1.5" />
        <circle cx="6" cy="7" r="1.5" />
        <circle cx="2" cy="12" r="1.5" />
        <circle cx="6" cy="12" r="1.5" />
      </svg>
    </div>
  );
}

// ============================================================================
// Validation Indicator
// ============================================================================

interface ValidationIndicatorProps {
  errors: NodeValidationError[];
}

function ValidationIndicator(props: ValidationIndicatorProps) {
  const errorCount = createMemo(() => props.errors.filter((e) => e.severity === "error").length);
  const warningCount = createMemo(() => props.errors.filter((e) => e.severity === "warning").length);

  const tooltipContent = () => (
    <div style={{ "max-width": "250px" }}>
      <For each={props.errors}>
        {(error) => (
          <div
            style={{
              display: "flex",
              "align-items": "flex-start",
              gap: "6px",
              "margin-bottom": "4px",
            }}
          >
            <span
              style={{
                color: error.severity === "error" ? "var(--cortex-error)" : "var(--cortex-warning)",
                "flex-shrink": "0",
              }}
            >
              {error.severity === "error" ? "\u2716" : "\u26a0"}
            </span>
            <span style={{ "font-size": "11px" }}>
              {error.field && <strong>{error.field}: </strong>}
              {error.message}
            </span>
          </div>
        )}
      </For>
    </div>
  );

  return (
    <Show when={props.errors.length > 0}>
      <Tooltip content={tooltipContent()} position="top">
        <div
          class="node-validation"
          style={{
            display: "flex",
            "align-items": "center",
            gap: "4px",
            padding: "2px 6px",
            "border-radius": "var(--jb-radius-sm)",
            background: errorCount() > 0 ? "rgba(247, 84, 100, 0.15)" : "rgba(233, 170, 70, 0.15)",
            "font-size": "10px",
            cursor: "help",
          }}
        >
          <Show when={errorCount() > 0}>
            <span style={{ color: "var(--cortex-error)" }}>
              {errorCount()} error{errorCount() !== 1 ? "s" : ""}
            </span>
          </Show>
          <Show when={warningCount() > 0 && errorCount() > 0}>
            <span style={{ color: "var(--jb-text-muted-color)" }}>|</span>
          </Show>
          <Show when={warningCount() > 0}>
            <span style={{ color: "var(--cortex-warning)" }}>
              {warningCount()} warning{warningCount() !== 1 ? "s" : ""}
            </span>
          </Show>
        </div>
      </Tooltip>
    </Show>
  );
}

// ============================================================================
// Progress Bar
// ============================================================================

interface ProgressBarProps {
  progress: number;
  color?: string;
}

function ProgressBar(props: ProgressBarProps) {
  return (
    <div
      class="node-progress"
      style={{
        position: "absolute",
        bottom: "0",
        left: "0",
        right: "0",
        height: "3px",
        background: "rgba(255, 255, 255, 0.1)",
        "border-radius": "0 0 var(--jb-radius-md) var(--jb-radius-md)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, props.progress))}%`,
          height: "100%",
          background: props.color || "var(--jb-border-focus)",
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

// ============================================================================
// Base Node Component
// ============================================================================

export interface BaseNodeContainerProps extends ParentProps {
  id: string;
  type: string;
  position: NodePosition;
  size?: NodeSize;
  selected?: boolean;
  multiSelected?: boolean;
  status?: NodeStatus;
  progress?: number;
  resizable?: boolean;
  disabled?: boolean;
  colorScheme: string;
  icon: JSX.Element;
  label: string;
  description?: string;
  errors?: NodeValidationError[];
  headerActions?: JSX.Element;
  onSelect?: (id: string, multi: boolean) => void;
  onDragStart?: (id: string, e: MouseEvent) => void;
  onDragEnd?: (id: string, position: NodePosition) => void;
  onResize?: (id: string, size: NodeSize) => void;
  onContextMenu?: (id: string, e: MouseEvent) => void;
}

export function BaseNodeContainer(props: BaseNodeContainerProps) {
  const [local] = splitProps(props, [
    "id",
    "type",
    "position",
    "size",
    "selected",
    "multiSelected",
    "status",
    "progress",
    "resizable",
    "disabled",
    "colorScheme",
    "icon",
    "label",
    "description",
    "errors",
    "headerActions",
    "children",
    "onSelect",
    "onDragStart",
    "onDragEnd",
    "onResize",
    "onContextMenu",
  ]);

  const [isDragging, setIsDragging] = createSignal(false);
  const [isResizing, setIsResizing] = createSignal(false);
  const [currentSize, setCurrentSize] = createSignal(local.size || { width: 220, height: 120 });

  const handleClick = (e: MouseEvent) => {
    if (local.disabled) return;
    e.stopPropagation();
    local.onSelect?.(local.id, e.ctrlKey || e.metaKey || e.shiftKey);
  };

  const handleDragStart = (e: MouseEvent) => {
    if (local.disabled) return;
    setIsDragging(true);
    local.onDragStart?.(local.id, e);
  };

  const handleResizeStart = (e: MouseEvent) => {
    if (local.disabled || !local.resizable) return;
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = currentSize().width;
    const startHeight = currentSize().height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const newSize = {
        width: Math.max(180, startWidth + deltaX),
        height: Math.max(80, startHeight + deltaY),
      };
      setCurrentSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      local.onResize?.(local.id, currentSize());
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    local.onContextMenu?.(local.id, e);
  };

  const nodeStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: `${local.position.x}px`,
    top: `${local.position.y}px`,
    width: `${currentSize().width}px`,
    "min-height": `${currentSize().height}px`,
    background: "var(--ui-panel-bg)",
    "border-radius": "var(--jb-radius-lg)",
    border: `2px solid ${local.selected || local.multiSelected ? local.colorScheme : "var(--jb-border-default)"}`,
    "box-shadow": local.selected
      ? `0 0 0 3px ${local.colorScheme}40, var(--jb-shadow-popup)`
      : "var(--jb-shadow-popup)",
    transition: isDragging() || isResizing()
      ? "none"
      : "box-shadow var(--cortex-transition-fast), border-color var(--cortex-transition-fast)",
    opacity: local.disabled ? "0.5" : "1",
    cursor: local.disabled ? "not-allowed" : "default",
    "user-select": "none",
    "font-family": "var(--jb-font-ui)",
    overflow: "visible",
  });

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "10px",
    padding: "10px 12px",
    background: `${local.colorScheme}20`,
    "border-bottom": "1px solid var(--jb-border-default)",
    "border-radius": "var(--jb-radius-lg) var(--jb-radius-lg) 0 0",
  });

  return (
    <div
      class="factory-node"
      classList={{
        "factory-node--selected": local.selected,
        "factory-node--multi-selected": local.multiSelected,
        "factory-node--disabled": local.disabled,
        "factory-node--dragging": isDragging(),
        "factory-node--resizing": isResizing(),
        [`factory-node--${local.type}`]: true,
      }}
      data-node-id={local.id}
      data-node-type={local.type}
      style={nodeStyle()}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          local.onSelect?.(local.id, e.ctrlKey || e.metaKey || e.shiftKey);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${local.type} node: ${local.label}`}
      aria-selected={local.selected}
      aria-disabled={local.disabled}
    >
      {/* Status Indicator */}
      <StatusIndicator status={local.status || "idle"} progress={local.progress} />

      {/* Header */}
      <header style={headerStyle()}>
        <DragHandle onDragStart={handleDragStart} />

        <span
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: "24px",
            height: "24px",
            "border-radius": "var(--jb-radius-sm)",
            background: `${local.colorScheme}30`,
            color: local.colorScheme,
            "font-size": "14px",
            "flex-shrink": "0",
          }}
        >
          {local.icon}
        </span>

        <div style={{ flex: "1", "min-width": "0" }}>
          <div
            style={{
              "font-size": "12px",
              "font-weight": "600",
              color: "var(--jb-text-heading-color)",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
            }}
          >
            {local.label}
          </div>
          <Show when={local.description}>
            <div
              style={{
                "font-size": "10px",
                color: "var(--jb-text-muted-color)",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
            >
              {local.description}
            </div>
          </Show>
        </div>

        <Show when={local.errors && local.errors.length > 0}>
          <ValidationIndicator errors={local.errors!} />
        </Show>

        <Show when={local.headerActions}>{local.headerActions}</Show>
      </header>

      {/* Body */}
      <div
        class="factory-node__body"
        style={{
          padding: "10px",
          "font-size": "11px",
          color: "var(--jb-text-body-color)",
        }}
      >
        {local.children}
      </div>

      {/* Progress Bar */}
      <Show when={local.status === "running" && local.progress !== undefined}>
        <ProgressBar progress={local.progress!} color={local.colorScheme} />
      </Show>

      {/* Resize Handle */}
      <Show when={local.resizable}>
        <ResizeHandle onResizeStart={handleResizeStart} />
      </Show>

      {/* Selection outline for multi-select */}
      <Show when={local.multiSelected && !local.selected}>
        <div
          style={{
            position: "absolute",
            inset: "-4px",
            border: `2px dashed ${local.colorScheme}80`,
            "border-radius": "calc(var(--jb-radius-md) + 4px)",
            "pointer-events": "none",
          }}
        />
      </Show>

      <style>{`
        .factory-node:hover .node-drag-handle,
        .factory-node:hover .node-resize-handle {
          opacity: 1;
        }
        .factory-node:focus {
          outline: none;
        }
        .factory-node:focus-visible {
          outline: 2px solid var(--jb-border-focus);
          outline-offset: 2px;
        }
        .factory-node--dragging {
          z-index: 1000;
          cursor: grabbing !important;
        }
        .factory-node--resizing {
          z-index: 1000;
        }
        @keyframes node-pulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--jb-border-focus); }
          50% { box-shadow: 0 0 0 4px rgba(53, 116, 240, 0.3); }
        }
        .factory-node--running {
          animation: node-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default BaseNodeContainer;


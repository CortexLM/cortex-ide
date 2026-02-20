import {
  JSX,
  Show,
  createSignal,
  createMemo,
  splitProps,
} from "solid-js";
import { Tooltip } from "@/components/ui/Tooltip";
import { PortDataType, PORT_COLORS } from "./BaseNode";

// ============================================================================
// Types
// ============================================================================

export interface NodePortProps {
  id: string;
  nodeId: string;
  label: string;
  type: "input" | "output";
  dataType?: PortDataType;
  connected?: boolean;
  multiple?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
  validDropTarget?: boolean;
  showLabel?: boolean;
  position?: "left" | "right" | "top" | "bottom";
  onDragStart?: (nodeId: string, portId: string, type: "input" | "output", e: MouseEvent) => void;
  onDrop?: (nodeId: string, portId: string, type: "input" | "output") => void;
  onHover?: (nodeId: string, portId: string | null) => void;
  onConnect?: (sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string) => void;
}

// ============================================================================
// Port Component
// ============================================================================

export function NodePort(props: NodePortProps) {
  const [local] = splitProps(props, [
    "id",
    "nodeId",
    "label",
    "type",
    "dataType",
    "connected",
    "multiple",
    "disabled",
    "highlighted",
    "validDropTarget",
    "showLabel",
    "position",
    "onDragStart",
    "onDrop",
    "onHover",
    "onConnect",
  ]);

  const [isDragging, setIsDragging] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);
  const [isDragOver, setIsDragOver] = createSignal(false);

  const dataType = () => local.dataType || "any";
  const position = () => local.position || (local.type === "input" ? "left" : "right");
  const showLabel = () => local.showLabel !== false;

  const portColor = createMemo(() => PORT_COLORS[dataType()]);

  const handleMouseEnter = () => {
    if (local.disabled) return;
    setIsHovered(true);
    local.onHover?.(local.nodeId, local.id);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    local.onHover?.(local.nodeId, null);
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (local.disabled) return;
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    local.onDragStart?.(local.nodeId, local.id, local.type, e);

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    if (local.disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!local.disabled && local.validDropTarget) {
      e.dataTransfer!.dropEffect = "link";
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (local.disabled) return;
    local.onDrop?.(local.nodeId, local.id, local.type);
  };

  // Container styles based on position
  const containerStyle = (): JSX.CSSProperties => {
    const pos = position();
    const base: JSX.CSSProperties = {
      display: "flex",
      "align-items": "center",
      gap: "6px",
      position: "relative",
    };

    if (pos === "left") {
      return { ...base, "flex-direction": "row" };
    } else if (pos === "right") {
      return { ...base, "flex-direction": "row-reverse" };
    } else if (pos === "top") {
      return { ...base, "flex-direction": "column" };
    } else {
      return { ...base, "flex-direction": "column-reverse" };
    }
  };

  // Port indicator styles
  const portIndicatorStyle = (): JSX.CSSProperties => {
    const isActive = isHovered() || isDragging() || isDragOver() || local.highlighted;
    const isValid = local.validDropTarget;

    return {
      width: "12px",
      height: "12px",
      "border-radius": "var(--cortex-radius-full)",
      background: local.connected ? portColor() : "var(--ui-panel-bg)",
      border: `2px solid ${portColor()}`,
      cursor: local.disabled ? "not-allowed" : "crosshair",
      transition: "all var(--cortex-transition-fast)",
      transform: isActive ? "scale(1.3)" : "scale(1)",
      "box-shadow": isActive
        ? `0 0 0 3px ${portColor()}40`
        : isDragOver() && isValid
          ? `0 0 0 3px ${portColor()}60`
          : "none",
      opacity: local.disabled ? "0.4" : "1",
      position: "relative",
      "z-index": isActive ? "10" : "1",
      "flex-shrink": "0",
    };
  };

  // Label styles
  const labelStyle = (): JSX.CSSProperties => {
    const pos = position();
    return {
      "font-size": "10px",
      color: "var(--jb-text-muted-color)",
      "white-space": "nowrap",
      "text-align": pos === "right" ? "right" : "left",
      "line-height": "1",
    };
  };

  // Data type badge
  const dataTypeBadge = () => {
    if (dataType() === "any") return null;
    return (
      <span
        style={{
          "font-size": "8px",
          padding: "1px 4px",
          "border-radius": "var(--jb-radius-sm)",
          background: `${portColor()}20`,
          color: portColor(),
          "text-transform": "uppercase",
          "font-weight": "600",
          "letter-spacing": "0.5px",
        }}
      >
        {dataType()}
      </span>
    );
  };

  const tooltipContent = () => (
    <div style={{ "text-align": "center" }}>
      <div style={{ "font-weight": "600", "margin-bottom": "2px" }}>{local.label}</div>
      <div style={{ "font-size": "10px", color: "var(--jb-text-muted-color)" }}>
        {local.type === "input" ? "Input" : "Output"} ({dataType()})
      </div>
      <Show when={local.multiple}>
        <div style={{ "font-size": "10px", color: "var(--jb-text-muted-color)" }}>
          Multiple connections allowed
        </div>
      </Show>
    </div>
  );

  return (
    <div
      class="node-port"
      classList={{
        "node-port--input": local.type === "input",
        "node-port--output": local.type === "output",
        "node-port--connected": local.connected,
        "node-port--dragging": isDragging(),
        "node-port--drag-over": isDragOver(),
        "node-port--highlighted": local.highlighted,
        "node-port--disabled": local.disabled,
        [`node-port--${position()}`]: true,
      }}
      data-port-id={local.id}
      data-port-type={local.type}
      data-port-data-type={dataType()}
      data-node-id={local.nodeId}
      style={containerStyle()}
    >
      <Tooltip content={tooltipContent()} position={position() === "left" ? "right" : "left"}>
        <div
          class="node-port__indicator"
          style={portIndicatorStyle()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="button"
          tabIndex={local.disabled ? -1 : 0}
          aria-label={`${local.type} port: ${local.label}`}
          aria-disabled={local.disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              // Trigger connection start
              local.onDragStart?.(local.nodeId, local.id, local.type, e as unknown as MouseEvent);
            }
          }}
        >
          {/* Connection indicator dot */}
          <Show when={local.connected}>
            <div
              style={{
                position: "absolute",
                inset: "3px",
                "border-radius": "var(--cortex-radius-full)",
                background: portColor(),
              }}
            />
          </Show>
          
          {/* Multiple connection indicator */}
          <Show when={local.multiple && local.connected}>
            <div
              style={{
                position: "absolute",
                top: "-2px",
                right: "-2px",
                width: "6px",
                height: "6px",
                "border-radius": "var(--cortex-radius-full)",
                background: "var(--jb-border-focus)",
                border: "1px solid var(--ui-panel-bg)",
              }}
            />
          </Show>
        </div>
      </Tooltip>

      <Show when={showLabel()}>
        <div class="node-port__label" style={labelStyle()}>
          <span>{local.label}</span>
          <Show when={dataType() !== "any"}>
            {dataTypeBadge()}
          </Show>
        </div>
      </Show>

      {/* Visual feedback for valid drop target */}
      <Show when={isDragOver() && local.validDropTarget}>
        <div
          class="node-port__drop-indicator"
          style={{
            position: "absolute",
            inset: "-8px",
            border: `2px dashed ${portColor()}`,
            "border-radius": "var(--cortex-radius-md)",
            "pointer-events": "none",
            animation: "port-pulse 0.5s ease-in-out infinite alternate",
          }}
        />
      </Show>

      <style>{`
        @keyframes port-pulse {
          from { opacity: 0.5; }
          to { opacity: 1; }
        }
        .node-port:focus-within .node-port__indicator {
          outline: 2px solid var(--jb-border-focus);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Port Row Component (for consistent port layout)
// ============================================================================

export interface PortRowProps {
  ports: Array<{
    id: string;
    label: string;
    dataType?: PortDataType;
    connected?: boolean;
    multiple?: boolean;
  }>;
  nodeId: string;
  type: "input" | "output";
  onDragStart?: (nodeId: string, portId: string, type: "input" | "output", e: MouseEvent) => void;
  onDrop?: (nodeId: string, portId: string, type: "input" | "output") => void;
  onHover?: (nodeId: string, portId: string | null) => void;
  highlightedPort?: string;
  validDropTargets?: string[];
}

export function PortRow(props: PortRowProps) {
  return (
    <div
      class="node-port-row"
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: "8px",
        padding: "4px 0",
      }}
    >
      {props.ports.map((port) => (
        <NodePort
          id={port.id}
          nodeId={props.nodeId}
          label={port.label}
          type={props.type}
          dataType={port.dataType}
          connected={port.connected}
          multiple={port.multiple}
          highlighted={props.highlightedPort === port.id}
          validDropTarget={props.validDropTargets?.includes(port.id)}
          onDragStart={props.onDragStart}
          onDrop={props.onDrop}
          onHover={props.onHover}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Port Group Component (for grouped ports)
// ============================================================================

export interface PortGroupProps {
  label: string;
  ports: Array<{
    id: string;
    label: string;
    dataType?: PortDataType;
    connected?: boolean;
    multiple?: boolean;
  }>;
  nodeId: string;
  type: "input" | "output";
  collapsed?: boolean;
  onToggle?: () => void;
  onDragStart?: (nodeId: string, portId: string, type: "input" | "output", e: MouseEvent) => void;
  onDrop?: (nodeId: string, portId: string, type: "input" | "output") => void;
  onHover?: (nodeId: string, portId: string | null) => void;
}

export function PortGroup(props: PortGroupProps) {
  const [collapsed, setCollapsed] = createSignal(props.collapsed ?? false);

  return (
    <div
      class="node-port-group"
      style={{
        "border-top": "1px solid var(--jb-border-default)",
        "padding-top": "6px",
        "margin-top": "6px",
      }}
    >
      <button
        class="node-port-group__header"
        style={{
          display: "flex",
          "align-items": "center",
          gap: "4px",
          width: "100%",
          padding: "2px 4px",
          background: "transparent",
          border: "none",
          color: "var(--jb-text-muted-color)",
          "font-size": "10px",
          cursor: "pointer",
          "text-align": "left",
        }}
        onClick={() => {
          setCollapsed(!collapsed());
          props.onToggle?.();
        }}
      >
        <span
          style={{
            transform: collapsed() ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform var(--cortex-transition-fast)",
          }}
        >
          {"\u25bc"}
        </span>
        <span>{props.label}</span>
        <span style={{ opacity: "0.5" }}>({props.ports.length})</span>
      </button>

      <Show when={!collapsed()}>
        <PortRow
          ports={props.ports}
          nodeId={props.nodeId}
          type={props.type}
          onDragStart={props.onDragStart}
          onDrop={props.onDrop}
          onHover={props.onHover}
        />
      </Show>
    </div>
  );
}

export default NodePort;


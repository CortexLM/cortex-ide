import { Show, createMemo } from "solid-js";
import { BaseNodeContainer, NodePosition, NodeSize, NodeStatus, NodeValidationError } from "./BaseNode";
import { NodePort } from "./NodePort";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// ============================================================================
// Types
// ============================================================================

export type ActionType =
  | "shell"
  | "http"
  | "file_write"
  | "file_read"
  | "notification"
  | "transform"
  | "delay"
  | "log"
  | "custom";

export interface ActionNodeData {
  name: string;
  description?: string;
  actionType: ActionType;
  config: Record<string, unknown>;
  timeout?: number;
  retryCount?: number;
  errors?: NodeValidationError[];
}

export interface ActionNodeProps {
  id: string;
  position: NodePosition;
  size?: NodeSize;
  selected?: boolean;
  multiSelected?: boolean;
  data: ActionNodeData;
  status?: NodeStatus;
  progress?: number;
  exitCode?: number;
  duration?: number;
  disabled?: boolean;
  onSelect?: (id: string, multi: boolean) => void;
  onDragStart?: (id: string, e: MouseEvent) => void;
  onDragEnd?: (id: string, position: NodePosition) => void;
  onResize?: (id: string, size: NodeSize) => void;
  onPortDragStart?: (nodeId: string, portId: string, type: "input" | "output", e: MouseEvent) => void;
  onPortDrop?: (nodeId: string, portId: string, type: "input" | "output") => void;
  onPortHover?: (nodeId: string, portId: string | null) => void;
  onContextMenu?: (id: string, e: MouseEvent) => void;
}

// ============================================================================
// Action Node Color
// ============================================================================

const ACTION_COLOR = "var(--node-action)";

// ============================================================================
// Action Icon (Play)
// ============================================================================

function ActionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
    </svg>
  );
}

// ============================================================================
// Action Type Icons
// ============================================================================

function ShellIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 9a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 6 9zM3.854 4.146a.5.5 0 1 0-.708.708L4.793 6.5 3.146 8.146a.5.5 0 1 0 .708.708l2-2a.5.5 0 0 0 0-.708l-2-2z"/>
      <path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H2zm12 1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h12z"/>
    </svg>
  );
}

function HttpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm5.904-2.803a.5.5 0 1 0-.808.588l2.5 3.5a.5.5 0 0 0 .808 0l2.5-3.5a.5.5 0 1 0-.808-.588L8 7.616 5.904 5.197z"/>
    </svg>
  );
}

function FileWriteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
    </svg>
  );
}

function FileReadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 4a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm-.5 2.5A.5.5 0 0 1 5 6h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zM5 8a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm0 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1H5z"/>
      <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/>
    </svg>
  );
}

function NotificationIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zm.995-14.901a1 1 0 1 0-1.99 0A5.002 5.002 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7 0-2.42-1.72-4.44-4.005-4.901z"/>
    </svg>
  );
}

function TransformIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path fill-rule="evenodd" d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5zm14-7a.5.5 0 0 1-.5.5H2.707l3.147 3.146a.5.5 0 1 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 4H14.5a.5.5 0 0 1 .5.5z"/>
    </svg>
  );
}

function DelayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.5 0a.5.5 0 0 0 0 1H7v1.07A7.001 7.001 0 0 0 8 16a7 7 0 0 0 5.29-11.584.531.531 0 0 0 .013-.012l.354-.354a.5.5 0 1 0-.707-.707l-.353.353a.5.5 0 0 0-.013.012A7 7 0 0 0 9 2.07V1h.5a.5.5 0 0 0 0-1h-3zm1.5 3a6 6 0 1 1 0 12A6 6 0 0 1 8 3zm0 2.5a.5.5 0 0 0-1 0v4a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 0-1H8V5.5z"/>
    </svg>
  );
}

function LogIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
      <path d="m2.165 15.803.02-.004c1.83-.363 2.948-.842 3.468-1.105A9.06 9.06 0 0 0 8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a10.437 10.437 0 0 1-.524 2.318l-.003.011a10.722 10.722 0 0 1-.244.637c-.079.186.074.394.273.362a21.673 21.673 0 0 0 .693-.125zm.8-3.108a1 1 0 0 0-.287-.801C1.618 10.83 1 9.468 1 8c0-3.192 3.004-6 7-6s7 2.808 7 6c0 3.193-3.004 6-7 6a8.06 8.06 0 0 1-2.088-.272 1 1 0 0 0-.711.074c-.387.196-1.24.57-2.634.893a10.97 10.97 0 0 0 .398-2z"/>
    </svg>
  );
}

function CustomIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
    </svg>
  );
}

function getActionTypeIcon(type: ActionType) {
  switch (type) {
    case "shell":
      return <ShellIcon />;
    case "http":
      return <HttpIcon />;
    case "file_write":
      return <FileWriteIcon />;
    case "file_read":
      return <FileReadIcon />;
    case "notification":
      return <NotificationIcon />;
    case "transform":
      return <TransformIcon />;
    case "delay":
      return <DelayIcon />;
    case "log":
      return <LogIcon />;
    case "custom":
      return <CustomIcon />;
  }
}

function getActionTypeLabel(type: ActionType): string {
  switch (type) {
    case "shell":
      return "Shell";
    case "http":
      return "HTTP";
    case "file_write":
      return "Write File";
    case "file_read":
      return "Read File";
    case "notification":
      return "Notify";
    case "transform":
      return "Transform";
    case "delay":
      return "Delay";
    case "log":
      return "Log";
    case "custom":
      return "Custom";
  }
}

// ============================================================================
// Config Preview
// ============================================================================

function getConfigPreview(type: ActionType, config: Record<string, unknown>): string | null {
  switch (type) {
    case "shell":
      return config.command as string || null;
    case "http":
      const method = config.method as string || "GET";
      const url = config.url as string || "";
      return `${method} ${url.length > 25 ? url.slice(0, 25) + "..." : url}`;
    case "file_write":
    case "file_read":
      return config.path as string || null;
    case "delay":
      const ms = config.ms as number || 0;
      return ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`;
    case "transform":
      return config.expression as string || null;
    case "notification":
      return config.title as string || null;
    default:
      return null;
  }
}

// ============================================================================
// Duration Display
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// ============================================================================
// Action Node Component
// ============================================================================

export function ActionNode(props: ActionNodeProps) {
  const actionTypeLabel = createMemo(() => getActionTypeLabel(props.data.actionType));
  const actionTypeIcon = createMemo(() => getActionTypeIcon(props.data.actionType));
  const configPreview = createMemo(() => getConfigPreview(props.data.actionType, props.data.config));

  return (
    <BaseNodeContainer
      id={props.id}
      type="action"
      position={props.position}
      size={props.size || { width: 220, height: 140 }}
      selected={props.selected}
      multiSelected={props.multiSelected}
      status={props.status}
      progress={props.progress}
      disabled={props.disabled}
      colorScheme={ACTION_COLOR}
      icon={<ActionIcon />}
      label={props.data.name || "Action"}
      description={props.data.description}
      errors={props.data.errors}
      resizable
      onSelect={props.onSelect}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onResize={props.onResize}
      onContextMenu={props.onContextMenu}
    >
      {/* Ports Container */}
      <div
        style={{
          display: "flex",
          "justify-content": "space-between",
          "margin-bottom": "8px",
        }}
      >
        {/* Input Port */}
        <div>
          <NodePort
            id="input"
            nodeId={props.id}
            label="Input"
            type="input"
            dataType="any"
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
        </div>

        {/* Output Ports */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
          <NodePort
            id="stdout"
            nodeId={props.id}
            label="Output"
            type="output"
            dataType="string"
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
          <NodePort
            id="stderr"
            nodeId={props.id}
            label="Stderr"
            type="output"
            dataType="error"
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
          <NodePort
            id="code"
            nodeId={props.id}
            label="Code"
            type="output"
            dataType="number"
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
        </div>
      </div>

      {/* Action Type & Config */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        {/* Action Type Badge */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "20px",
              height: "20px",
              "border-radius": "var(--jb-radius-sm)",
              background: `${ACTION_COLOR}20`,
              color: ACTION_COLOR,
            }}
          >
            {actionTypeIcon()}
          </span>
          <Badge variant="warning" size="sm">
            {actionTypeLabel()}
          </Badge>
        </div>

        {/* Config Preview */}
        <Show when={configPreview()}>
          <div
            style={{
              padding: "4px 6px",
              background: "var(--jb-surface-active)",
              "border-radius": "var(--jb-radius-sm)",
              "font-size": "10px",
              "font-family": "var(--jb-font-mono)",
              color: "var(--jb-text-body-color)",
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
            }}
          >
            {configPreview()}
          </div>
        </Show>

        {/* Running State */}
        <Show when={props.status === "running"}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "6px",
              padding: "4px 8px",
              background: `${ACTION_COLOR}15`,
              "border-radius": "var(--jb-radius-sm)",
              "font-size": "10px",
              color: ACTION_COLOR,
            }}
          >
            <LoadingSpinner size="sm" color={ACTION_COLOR} />
            <span>Running...</span>
          </div>
        </Show>

        {/* Completed State */}
        <Show when={props.status === "success" && props.duration !== undefined}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              "font-size": "10px",
            }}
          >
            <span style={{ color: "var(--cortex-success)" }}>Completed</span>
            <span style={{ color: "var(--jb-text-muted-color)" }}>
              {formatDuration(props.duration!)}
            </span>
          </div>
        </Show>

        {/* Exit Code */}
        <Show when={props.exitCode !== undefined}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
              "font-size": "10px",
            }}
          >
            <span style={{ color: "var(--jb-text-muted-color)" }}>Exit:</span>
            <span
              style={{
                color: props.exitCode === 0 ? "var(--cortex-success)" : "var(--cortex-error)",
                "font-family": "var(--jb-font-mono)",
              }}
            >
              {props.exitCode}
            </span>
          </div>
        </Show>

        {/* Error State */}
        <Show when={props.status === "error"}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
              padding: "4px 6px",
              background: "rgba(247, 84, 100, 0.15)",
              "border-radius": "var(--jb-radius-sm)",
              "font-size": "10px",
              color: "var(--cortex-error)",
            }}
          >
            <span>Failed</span>
          </div>
        </Show>
      </div>
    </BaseNodeContainer>
  );
}

export default ActionNode;

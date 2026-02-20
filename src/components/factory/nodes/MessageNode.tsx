import { Show, createMemo } from "solid-js";
import { BaseNodeContainer, NodePosition, NodeSize, NodeStatus, NodeValidationError } from "./BaseNode";
import { NodePort } from "./NodePort";
import { Badge } from "@/components/ui/Badge";

// ============================================================================
// Types
// ============================================================================

export type MessageDirection = "send" | "receive" | "broadcast" | "request";

export interface MessageNodeData {
  name: string;
  description?: string;
  direction: MessageDirection;
  fromAgent?: string;
  toAgent?: string;
  toAgents?: string[]; // For broadcast
  messageType?: string;
  schema?: string;
  timeout?: number;
  errors?: NodeValidationError[];
}

export interface MessageNodeProps {
  id: string;
  position: NodePosition;
  size?: NodeSize;
  selected?: boolean;
  multiSelected?: boolean;
  data: MessageNodeData;
  status?: NodeStatus;
  messageCount?: number;
  lastMessageAt?: number;
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
// Message Node Color
// ============================================================================

const MESSAGE_COLOR = "var(--cortex-info)"; // Cyan

// ============================================================================
// Message Icon (Chat Bubble)
// ============================================================================

function MessageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2.678 11.894a1 1 0 0 1 .287.801 10.97 10.97 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8.06 8.06 0 0 0 8 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105z"/>
    </svg>
  );
}

// ============================================================================
// Direction Icons
// ============================================================================

function SendIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z"/>
    </svg>
  );
}

function ReceiveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555ZM0 4.697v7.104l5.803-3.558L0 4.697ZM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757Zm3.436-.586L16 11.801V4.697l-5.803 3.546Z"/>
    </svg>
  );
}

function BroadcastIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707zm2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708zm5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708zm2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707zM10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
    </svg>
  );
}

function RequestIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path fill-rule="evenodd" d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5zm14-7a.5.5 0 0 1-.5.5H2.707l3.147 3.146a.5.5 0 1 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 4H14.5a.5.5 0 0 1 .5.5z"/>
    </svg>
  );
}

function getDirectionIcon(direction: MessageDirection) {
  switch (direction) {
    case "send":
      return <SendIcon />;
    case "receive":
      return <ReceiveIcon />;
    case "broadcast":
      return <BroadcastIcon />;
    case "request":
      return <RequestIcon />;
  }
}

function getDirectionLabel(direction: MessageDirection): string {
  switch (direction) {
    case "send":
      return "Send";
    case "receive":
      return "Receive";
    case "broadcast":
      return "Broadcast";
    case "request":
      return "Request";
  }
}

// ============================================================================
// Time Formatting
// ============================================================================

function formatLastMessage(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ============================================================================
// Message Node Component
// ============================================================================

export function MessageNode(props: MessageNodeProps) {
  const direction = createMemo(() => props.data.direction);
  const directionIcon = createMemo(() => getDirectionIcon(direction()));
  const directionLabel = createMemo(() => getDirectionLabel(direction()));

  // Determine ports based on direction
  const hasInput = createMemo(() => 
    direction() === "receive" || direction() === "request"
  );
  const hasOutput = createMemo(() => 
    direction() === "send" || direction() === "broadcast" || direction() === "request"
  );
  const hasResponse = createMemo(() => direction() === "request");

  return (
    <BaseNodeContainer
      id={props.id}
      type="message"
      position={props.position}
      size={props.size || { width: 200, height: 130 }}
      selected={props.selected}
      multiSelected={props.multiSelected}
      status={props.status}
      disabled={props.disabled}
      colorScheme={MESSAGE_COLOR}
      icon={<MessageIcon />}
      label={props.data.name || "Message"}
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
        <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
          <NodePort
            id="trigger"
            nodeId={props.id}
            label="Trigger"
            type="input"
            dataType="event"
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
          <Show when={hasInput()}>
            <NodePort
              id="message"
              nodeId={props.id}
              label="Message"
              type="input"
              dataType="message"
              onDragStart={props.onPortDragStart}
              onDrop={props.onPortDrop}
              onHover={props.onPortHover}
            />
          </Show>
        </div>

        {/* Output Ports */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
          <Show when={hasOutput()}>
            <NodePort
              id="sent"
              nodeId={props.id}
              label="Sent"
              type="output"
              dataType="message"
              onDragStart={props.onPortDragStart}
              onDrop={props.onPortDrop}
              onHover={props.onPortHover}
            />
          </Show>
          <Show when={hasResponse()}>
            <NodePort
              id="response"
              nodeId={props.id}
              label="Response"
              type="output"
              dataType="message"
              onDragStart={props.onPortDragStart}
              onDrop={props.onPortDrop}
              onHover={props.onPortHover}
            />
          </Show>
          <NodePort
            id="error"
            nodeId={props.id}
            label="Error"
            type="output"
            dataType="error"
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
        </div>
      </div>

      {/* Message Config */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        {/* Direction Badge */}
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
              background: `${MESSAGE_COLOR}20`,
              color: MESSAGE_COLOR,
            }}
          >
            {directionIcon()}
          </span>
          <Badge
            variant="default"
            size="sm"
            style={{ background: `${MESSAGE_COLOR}30`, color: MESSAGE_COLOR }}
          >
            {directionLabel()}
          </Badge>
        </div>

        {/* From/To Agents */}
        <Show when={props.data.fromAgent || props.data.toAgent}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
              "font-size": "10px",
              color: "var(--jb-text-muted-color)",
            }}
          >
            <Show when={props.data.fromAgent}>
              <span>{props.data.fromAgent}</span>
            </Show>
            <span style={{ color: MESSAGE_COLOR }}>{"\u2192"}</span>
            <Show when={props.data.toAgent}>
              <span>{props.data.toAgent}</span>
            </Show>
            <Show when={props.data.toAgents && props.data.toAgents.length > 0}>
              <span>{props.data.toAgents!.length} agents</span>
            </Show>
          </div>
        </Show>

        {/* Message Type */}
        <Show when={props.data.messageType}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
              "font-size": "10px",
            }}
          >
            <span style={{ color: "var(--jb-text-muted-color)" }}>Type:</span>
            <span
              style={{
                color: "var(--jb-text-body-color)",
                "font-family": "var(--jb-font-mono)",
              }}
            >
              {props.data.messageType}
            </span>
          </div>
        </Show>

        {/* Message Stats */}
        <Show when={props.messageCount !== undefined}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              "font-size": "10px",
            }}
          >
            <span style={{ color: "var(--jb-text-muted-color)" }}>
              Messages: <span style={{ color: "var(--jb-text-body-color)" }}>{props.messageCount}</span>
            </span>
            <Show when={props.lastMessageAt}>
              <span style={{ color: "var(--jb-text-muted-color)" }}>
                {formatLastMessage(props.lastMessageAt!)}
              </span>
            </Show>
          </div>
        </Show>

        {/* Timeout */}
        <Show when={props.data.timeout && direction() === "request"}>
          <div
            style={{
              "font-size": "10px",
              color: "var(--jb-text-muted-color)",
            }}
          >
            Timeout: {props.data.timeout! >= 1000 ? `${props.data.timeout! / 1000}s` : `${props.data.timeout}ms`}
          </div>
        </Show>
      </div>

      {/* Direction indicator */}
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          right: "8px",
          opacity: "0.2",
          color: MESSAGE_COLOR,
        }}
      >
        {directionIcon()}
      </div>
    </BaseNodeContainer>
  );
}

export default MessageNode;


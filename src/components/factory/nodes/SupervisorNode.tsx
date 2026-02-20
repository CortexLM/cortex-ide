import { Show, For, createMemo } from "solid-js";
import { BaseNodeContainer, NodePosition, NodeSize, NodeStatus, NodeValidationError } from "./BaseNode";
import { NodePort } from "./NodePort";
import { Badge } from "@/components/ui/Badge";

// ============================================================================
// Types
// ============================================================================

export type InterceptMode = "all" | "tool_calls" | "responses" | "errors" | "none";

export interface WatchedAgent {
  id: string;
  name: string;
  status?: NodeStatus;
}

export interface SupervisorNodeData {
  name: string;
  description?: string;
  watchedAgents?: WatchedAgent[];
  interceptMode?: InterceptMode;
  autoApprove?: boolean;
  decisionModel?: string;
  alertThreshold?: "low" | "medium" | "high";
  errors?: NodeValidationError[];
}

export interface SupervisorNodeProps {
  id: string;
  position: NodePosition;
  size?: NodeSize;
  selected?: boolean;
  multiSelected?: boolean;
  data: SupervisorNodeData;
  status?: NodeStatus;
  pendingDecisions?: number;
  alertCount?: number;
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
// Supervisor Node Color
// ============================================================================

const SUPERVISOR_COLOR = "var(--cortex-error)"; // Red

// ============================================================================
// Supervisor Icon (Telescope/Eye)
// ============================================================================

function SupervisorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a2 2 0 0 1 2 2v4.5H6V3a2 2 0 0 1 2-2zm3 6.5V3a3 3 0 0 0-6 0v4.5H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1h-1zM8 10a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1z"/>
    </svg>
  );
}

// ============================================================================
// Intercept Mode Icons & Labels
// ============================================================================

function getInterceptModeLabel(mode: InterceptMode): string {
  switch (mode) {
    case "all":
      return "All Events";
    case "tool_calls":
      return "Tool Calls";
    case "responses":
      return "Responses";
    case "errors":
      return "Errors Only";
    case "none":
      return "Passive";
  }
}

function getInterceptModeColor(mode: InterceptMode): string {
  switch (mode) {
    case "all":
      return SUPERVISOR_COLOR;
    case "tool_calls":
      return "var(--cortex-warning)";
    case "responses":
      return "var(--jb-border-focus)";
    case "errors":
      return "var(--cortex-error)";
    case "none":
      return "var(--jb-text-muted-color)";
  }
}

// ============================================================================
// Watched Agent Badge
// ============================================================================

interface WatchedAgentBadgeProps {
  agent: WatchedAgent;
}

function WatchedAgentBadge(props: WatchedAgentBadgeProps) {
  const statusColor = createMemo(() => {
    switch (props.agent.status) {
      case "running":
        return "var(--jb-border-focus)";
      case "success":
        return "var(--cortex-success)";
      case "error":
        return "var(--cortex-error)";
      case "warning":
        return "var(--cortex-warning)";
      default:
        return "var(--jb-text-muted-color)";
    }
  });

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: "4px",
        padding: "2px 6px",
        background: "var(--jb-surface-active)",
        "border-radius": "var(--jb-radius-sm)",
        "font-size": "10px",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          "border-radius": "var(--cortex-radius-full)",
          background: statusColor(),
        }}
      />
      <span style={{ color: "var(--jb-text-body-color)" }}>{props.agent.name}</span>
    </div>
  );
}

// ============================================================================
// Supervisor Node Component
// ============================================================================

export function SupervisorNode(props: SupervisorNodeProps) {
  const watchedCount = createMemo(() => props.data.watchedAgents?.length ?? 0);
  const interceptMode = createMemo(() => props.data.interceptMode || "all");

  // Calculate size based on watched agents
  const nodeSize = createMemo(() => {
    const baseHeight = 140;
    const agentRowHeight = 20;
    const extraHeight = Math.min(watchedCount(), 3) * agentRowHeight;
    return props.size || { width: 240, height: baseHeight + extraHeight };
  });

  return (
    <BaseNodeContainer
      id={props.id}
      type="supervisor"
      position={props.position}
      size={nodeSize()}
      selected={props.selected}
      multiSelected={props.multiSelected}
      status={props.status}
      disabled={props.disabled}
      colorScheme={SUPERVISOR_COLOR}
      icon={<SupervisorIcon />}
      label={props.data.name || "Supervisor"}
      description={props.data.description}
      errors={props.data.errors}
      resizable
      headerActions={
        <Show when={props.alertCount && props.alertCount > 0}>
          <Badge variant="error" size="sm">
            {props.alertCount} alert{props.alertCount !== 1 ? "s" : ""}
          </Badge>
        </Show>
      }
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
        {/* Input Port (from agents) */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
          <NodePort
            id="agents"
            nodeId={props.id}
            label="Agents"
            type="input"
            dataType="agent"
            multiple
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
        </div>

        {/* Output Ports */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
          <NodePort
            id="decisions"
            nodeId={props.id}
            label="Decisions"
            type="output"
            dataType="message"
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
          <NodePort
            id="alerts"
            nodeId={props.id}
            label="Alerts"
            type="output"
            dataType="event"
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
        </div>
      </div>

      {/* Supervisor Config */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
        {/* Intercept Mode */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              "font-size": "10px",
              color: "var(--jb-text-muted-color)",
            }}
          >
            Mode:
          </span>
          <Badge
            variant="default"
            size="sm"
            style={{
              background: `${getInterceptModeColor(interceptMode())}20`,
              color: getInterceptModeColor(interceptMode()),
            }}
          >
            {getInterceptModeLabel(interceptMode())}
          </Badge>
          <Show when={props.data.autoApprove}>
            <Badge variant="success" size="sm">Auto</Badge>
          </Show>
        </div>

        {/* Watched Agents */}
        <Show when={watchedCount() > 0}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <span
              style={{
                "font-size": "10px",
                color: "var(--jb-text-muted-color)",
              }}
            >
              Watching ({watchedCount()}):
            </span>
            <div
              style={{
                display: "flex",
                "flex-wrap": "wrap",
                gap: "4px",
                "max-height": "60px",
                overflow: "hidden",
              }}
            >
              <For each={props.data.watchedAgents?.slice(0, 3)}>
                {(agent) => <WatchedAgentBadge agent={agent} />}
              </For>
              <Show when={watchedCount() > 3}>
                <span
                  style={{
                    "font-size": "10px",
                    color: "var(--jb-text-muted-color)",
                    padding: "2px 4px",
                  }}
                >
                  +{watchedCount() - 3} more
                </span>
              </Show>
            </div>
          </div>
        </Show>

        {/* Pending Decisions */}
        <Show when={props.pendingDecisions && props.pendingDecisions > 0}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "6px",
              padding: "4px 8px",
              background: `${SUPERVISOR_COLOR}15`,
              "border-radius": "var(--jb-radius-sm)",
              "font-size": "10px",
              color: SUPERVISOR_COLOR,
            }}
          >
            <span style={{ animation: "supervisor-blink 1s ease-in-out infinite" }}>
              {"\u26a0"}
            </span>
            <span>
              {props.pendingDecisions} pending decision{props.pendingDecisions !== 1 ? "s" : ""}
            </span>
          </div>
        </Show>

        {/* Decision Model */}
        <Show when={props.data.decisionModel}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
              "font-size": "10px",
            }}
          >
            <span style={{ color: "var(--jb-text-muted-color)" }}>Model:</span>
            <span style={{ color: "var(--jb-text-body-color)" }}>{props.data.decisionModel}</span>
          </div>
        </Show>
      </div>

      {/* Eye indicator */}
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          right: "8px",
          width: "20px",
          height: "20px",
          opacity: "0.2",
        }}
      >
        <svg viewBox="0 0 16 16" fill={SUPERVISOR_COLOR}>
          <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
          <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
        </svg>
      </div>

      <style>{`
        @keyframes supervisor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </BaseNodeContainer>
  );
}

export default SupervisorNode;


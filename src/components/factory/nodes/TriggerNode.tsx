import { Show, createMemo, Match, Switch } from "solid-js";
import { BaseNodeContainer, NodePosition, NodeSize, NodeStatus, NodeValidationError } from "./BaseNode";
import { NodePort } from "./NodePort";
import { Badge } from "@/components/ui/Badge";

// ============================================================================
// Types
// ============================================================================

export type TriggerType =
  | "file_watch"
  | "schedule"
  | "git_hook"
  | "webhook"
  | "manual"
  | "event"
  | "startup"
  | "api";

export interface TriggerNodeData {
  name: string;
  description?: string;
  triggerType: TriggerType;
  pattern?: string; // For file_watch: glob pattern, for schedule: cron expression
  config?: Record<string, unknown>;
  enabled?: boolean;
  lastTriggered?: number;
  errors?: NodeValidationError[];
}

export interface TriggerNodeProps {
  id: string;
  position: NodePosition;
  size?: NodeSize;
  selected?: boolean;
  multiSelected?: boolean;
  data: TriggerNodeData;
  status?: NodeStatus;
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
// Trigger Node Color
// ============================================================================

const TRIGGER_COLOR = "var(--node-trigger)";

// ============================================================================
// Trigger Icon (Lightning Bolt)
// ============================================================================

function TriggerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"/>
    </svg>
  );
}

// ============================================================================
// Trigger Type Icons
// ============================================================================

function FileWatchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
      <path d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0z"/>
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
    </svg>
  );
}

function GitHookIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M15.698 7.287L8.712.302a1.03 1.03 0 00-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 011.55 1.56l1.773 1.774a1.224 1.224 0 11-.733.732L8.5 5.923V10.5a1.224 1.224 0 11-1.007-.013V5.858a1.224 1.224 0 01-.664-1.605L5.02 2.447.302 7.163a1.03 1.03 0 000 1.457l6.986 6.987a1.03 1.03 0 001.457 0l6.953-6.862a1.03 1.03 0 000-1.458z"/>
    </svg>
  );
}

function WebhookIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855-.143.268-.276.56-.395.872.705.157 1.472.257 2.282.287V1.077zM4.249 3.539c.142-.384.304-.744.481-1.078a6.7 6.7 0 0 1 .597-.933A7.01 7.01 0 0 0 3.051 3.05c.362.184.763.349 1.198.49zM3.509 7.5c.036-1.07.188-2.087.436-3.008a9.124 9.124 0 0 1-1.565-.667A6.964 6.964 0 0 0 1.018 7.5h2.49zm1.4-2.741a12.344 12.344 0 0 0-.4 2.741H7.5V5.091c-.91-.03-1.783-.145-2.591-.332zM8.5 5.09V7.5h2.99a12.342 12.342 0 0 0-.399-2.741c-.808.187-1.681.301-2.591.332z"/>
    </svg>
  );
}

function ManualIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 3h8a1 1 0 0 1 1 1v2.5a.5.5 0 0 1-1 0V4H4v8h3.5a.5.5 0 0 1 0 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
      <path d="M9 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-3zm1 0v3h4v-3h-4z"/>
    </svg>
  );
}

function EventIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588z"/>
      <circle cx="8" cy="4.5" r="1"/>
    </svg>
  );
}

function StartupIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
      <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4z"/>
    </svg>
  );
}

function ApiIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 9a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 6 9zM3.854 4.146a.5.5 0 1 0-.708.708L4.793 6.5 3.146 8.146a.5.5 0 1 0 .708.708l2-2a.5.5 0 0 0 0-.708l-2-2z"/>
      <path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H2zm12 1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h12z"/>
    </svg>
  );
}

function getTriggerTypeIcon(type: TriggerType) {
  switch (type) {
    case "file_watch":
      return <FileWatchIcon />;
    case "schedule":
      return <ScheduleIcon />;
    case "git_hook":
      return <GitHookIcon />;
    case "webhook":
      return <WebhookIcon />;
    case "manual":
      return <ManualIcon />;
    case "event":
      return <EventIcon />;
    case "startup":
      return <StartupIcon />;
    case "api":
      return <ApiIcon />;
  }
}

function getTriggerTypeLabel(type: TriggerType): string {
  switch (type) {
    case "file_watch":
      return "File Watch";
    case "schedule":
      return "Schedule";
    case "git_hook":
      return "Git Hook";
    case "webhook":
      return "Webhook";
    case "manual":
      return "Manual";
    case "event":
      return "Event";
    case "startup":
      return "Startup";
    case "api":
      return "API";
  }
}

// ============================================================================
// Last Triggered Display
// ============================================================================

function formatLastTriggered(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ============================================================================
// Trigger Node Component
// ============================================================================

export function TriggerNode(props: TriggerNodeProps) {
  const triggerTypeLabel = createMemo(() => getTriggerTypeLabel(props.data.triggerType));
  const triggerTypeIcon = createMemo(() => getTriggerTypeIcon(props.data.triggerType));

  return (
    <BaseNodeContainer
      id={props.id}
      type="trigger"
      position={props.position}
      size={props.size || { width: 200, height: 100 }}
      selected={props.selected}
      multiSelected={props.multiSelected}
      status={props.status}
      disabled={props.disabled || !props.data.enabled}
      colorScheme={TRIGGER_COLOR}
      icon={<TriggerIcon />}
      label={props.data.name || "Trigger"}
      description={props.data.description}
      errors={props.data.errors}
      headerActions={
        <Show when={props.data.enabled === false}>
          <Badge variant="warning" size="sm">Disabled</Badge>
        </Show>
      }
      onSelect={props.onSelect}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onResize={props.onResize}
      onContextMenu={props.onContextMenu}
    >
      {/* Output Port Only */}
      <div
        style={{
          display: "flex",
          "justify-content": "flex-end",
          "margin-bottom": "8px",
        }}
      >
        <NodePort
          id="event"
          nodeId={props.id}
          label="Event"
          type="output"
          dataType="event"
          onDragStart={props.onPortDragStart}
          onDrop={props.onPortDrop}
          onHover={props.onPortHover}
        />
      </div>

      {/* Trigger Type & Config */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        {/* Trigger Type Badge */}
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
              background: `${TRIGGER_COLOR}20`,
              color: TRIGGER_COLOR,
            }}
          >
            {triggerTypeIcon()}
          </span>
          <Badge variant="success" size="sm">
            {triggerTypeLabel()}
          </Badge>
        </div>

        {/* Pattern/Config Display */}
        <Show when={props.data.pattern}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
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
            <Switch>
              <Match when={props.data.triggerType === "file_watch"}>
                <span style={{ color: "var(--jb-text-muted-color)" }}>glob:</span>
              </Match>
              <Match when={props.data.triggerType === "schedule"}>
                <span style={{ color: "var(--jb-text-muted-color)" }}>cron:</span>
              </Match>
              <Match when={props.data.triggerType === "webhook"}>
                <span style={{ color: "var(--jb-text-muted-color)" }}>path:</span>
              </Match>
              <Match when={props.data.triggerType === "event"}>
                <span style={{ color: "var(--jb-text-muted-color)" }}>event:</span>
              </Match>
            </Switch>
            <span>{props.data.pattern}</span>
          </div>
        </Show>

        {/* Last Triggered */}
        <Show when={props.data.lastTriggered}>
          <div
            style={{
              "font-size": "10px",
              color: "var(--jb-text-muted-color)",
            }}
          >
            Last: {formatLastTriggered(props.data.lastTriggered!)}
          </div>
        </Show>
      </div>

      {/* Active indicator */}
      <Show when={props.status === "running"}>
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            width: "8px",
            height: "8px",
            "border-radius": "var(--cortex-radius-full)",
            background: TRIGGER_COLOR,
            animation: "trigger-blink 1s ease-in-out infinite",
          }}
        />
      </Show>

      <style>{`
        @keyframes trigger-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </BaseNodeContainer>
  );
}

export default TriggerNode;


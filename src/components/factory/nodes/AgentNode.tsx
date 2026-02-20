import { Show, createMemo } from "solid-js";
import { BaseNodeContainer, NodePosition, NodeSize, NodeStatus, NodeValidationError } from "./BaseNode";
import { NodePort } from "./NodePort";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// ============================================================================
// Types
// ============================================================================

export interface AgentNodeData {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  tools?: string[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  errors?: NodeValidationError[];
}

export interface AgentNodeProps {
  id: string;
  position: NodePosition;
  size?: NodeSize;
  selected?: boolean;
  multiSelected?: boolean;
  data: AgentNodeData;
  status?: NodeStatus;
  progress?: number;
  currentStep?: string;
  tokensUsed?: number;
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
// Agent Node Color
// ============================================================================

const AGENT_COLOR = "var(--node-agent)";

// ============================================================================
// Agent Icon
// ============================================================================

function AgentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5c0 1.194.618 2.26 1.5 2.913V8.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-1.087c.882-.653 1.5-1.72 1.5-2.913A3.5 3.5 0 0 0 8 1zM6.5 4.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM5 10a.5.5 0 0 0-.5.5v1a2.5 2.5 0 0 0 2.5 2.5h2a2.5 2.5 0 0 0 2.5-2.5v-1a.5.5 0 0 0-.5-.5H5zm1 1h4v.5a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 6 11.5V11z"/>
    </svg>
  );
}

// ============================================================================
// Running Animation
// ============================================================================

function RunningAnimation() {
  return (
    <div
      class="agent-running-animation"
      style={{
        display: "flex",
        "align-items": "center",
        gap: "6px",
        padding: "4px 8px",
        background: "color-mix(in srgb, var(--node-agent) 15%, transparent)",
        "border-radius": "var(--jb-radius-sm)",
        "font-size": "10px",
        color: AGENT_COLOR,
      }}
    >
      <LoadingSpinner size="sm" />
      <span>Processing...</span>
    </div>
  );
}

// ============================================================================
// Step Progress
// ============================================================================

interface StepProgressProps {
  step: string;
  progress?: number;
}

function StepProgress(props: StepProgressProps) {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: "4px",
        padding: "6px 8px",
        background: "color-mix(in srgb, var(--node-agent) 10%, transparent)",
        "border-radius": "var(--jb-radius-sm)",
        "font-size": "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          gap: "8px",
        }}
      >
        <span style={{ color: "var(--jb-text-body-color)" }}>{props.step}</span>
        <Show when={props.progress !== undefined}>
          <span style={{ color: "var(--jb-text-muted-color)" }}>{Math.round(props.progress!)}%</span>
        </Show>
      </div>
      <Show when={props.progress !== undefined}>
        <div
          style={{
            width: "100%",
            height: "3px",
            background: "rgba(255, 255, 255, 0.1)",
            "border-radius": "var(--cortex-radius-sm)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${props.progress}%`,
              height: "100%",
              background: AGENT_COLOR,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Agent Node Component
// ============================================================================

export function AgentNode(props: AgentNodeProps) {
  const toolCount = createMemo(() => props.data.tools?.length ?? 0);

  const modelDisplay = createMemo(() => {
    if (!props.data.model) return null;
    const provider = props.data.provider ? `${props.data.provider}/` : "";
    return `${provider}${props.data.model}`;
  });

  return (
    <BaseNodeContainer
      id={props.id}
      type="agent"
      position={props.position}
      size={props.size}
      selected={props.selected}
      multiSelected={props.multiSelected}
      status={props.status}
      progress={props.progress}
      disabled={props.disabled}
      colorScheme={AGENT_COLOR}
      icon={<AgentIcon />}
      label={props.data.name || "Agent"}
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
        {/* Input Ports */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
          <NodePort
            id="input"
            nodeId={props.id}
            label="Input"
            type="input"
            dataType="message"
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
        </div>

        {/* Output Ports */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
          <NodePort
            id="output"
            nodeId={props.id}
            label="Output"
            type="output"
            dataType="message"
            onDragStart={props.onPortDragStart}
            onDrop={props.onPortDrop}
            onHover={props.onPortHover}
          />
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

      {/* Agent Info */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        {/* Model Badge */}
        <Show when={modelDisplay()}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
            }}
          >
            <span
              style={{
                "font-size": "10px",
                color: "var(--jb-text-muted-color)",
              }}
            >
              Model:
            </span>
            <Badge variant="accent" size="sm">
              {modelDisplay()}
            </Badge>
          </div>
        </Show>

        {/* Tools Count */}
        <Show when={toolCount() > 0}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
            }}
          >
            <span
              style={{
                "font-size": "10px",
                color: "var(--jb-text-muted-color)",
              }}
            >
              Tools:
            </span>
            <Badge variant="default" size="sm">
              {toolCount()} tool{toolCount() !== 1 ? "s" : ""}
            </Badge>
          </div>
        </Show>

        {/* Tokens Used */}
        <Show when={props.tokensUsed !== undefined && props.tokensUsed > 0}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
            }}
          >
            <span
              style={{
                "font-size": "10px",
                color: "var(--jb-text-muted-color)",
              }}
            >
              Tokens:
            </span>
            <span
              style={{
                "font-size": "10px",
                color: "var(--jb-text-body-color)",
              }}
            >
              {props.tokensUsed?.toLocaleString()}
            </span>
          </div>
        </Show>

        {/* Running State */}
        <Show when={props.status === "running"}>
          <Show when={props.currentStep} fallback={<RunningAnimation />}>
            <StepProgress step={props.currentStep!} progress={props.progress} />
          </Show>
        </Show>
      </div>

      {/* Running glow effect */}
      <Show when={props.status === "running"}>
        <div
          style={{
            position: "absolute",
            inset: "-4px",
            "border-radius": "calc(var(--jb-radius-md) + 4px)",
            border: `2px solid ${AGENT_COLOR}40`,
            animation: "agent-pulse 2s ease-in-out infinite",
            "pointer-events": "none",
          }}
        />
      </Show>

      <style>{`
        @keyframes agent-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 color-mix(in srgb, var(--node-agent) 40%, transparent);
          }
          50% {
            box-shadow: 0 0 0 8px transparent;
          }
        }
      `}</style>
    </BaseNodeContainer>
  );
}

export default AgentNode;


import { Show, For, createMemo } from "solid-js";
import { BaseNodeContainer, NodePosition, NodeSize, NodeStatus, NodeValidationError } from "./BaseNode";
import { NodePort } from "./NodePort";
import { Badge } from "@/components/ui/Badge";

// ============================================================================
// Types
// ============================================================================

export type LogicType =
  | "condition"
  | "switch"
  | "loop"
  | "parallel"
  | "merge"
  | "delay"
  | "filter"
  | "map";

export interface LogicNodeData {
  name: string;
  description?: string;
  logicType: LogicType;
  expression?: string; // For condition/switch/filter
  cases?: string[]; // For switch node
  maxIterations?: number; // For loop
  parallelBranches?: number; // For parallel
  delayMs?: number; // For delay
  errors?: NodeValidationError[];
}

export interface LogicNodeProps {
  id: string;
  position: NodePosition;
  size?: NodeSize;
  selected?: boolean;
  multiSelected?: boolean;
  data: LogicNodeData;
  status?: NodeStatus;
  currentIteration?: number;
  activeBranch?: string;
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
// Logic Node Color
// ============================================================================

const LOGIC_COLOR = "var(--cortex-info)"; // Purple

// ============================================================================
// Logic Icon (Diamond)
// ============================================================================

function LogicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l5.968 2.387 5.968-2.387-5.596-2.387zM13 5.5l-5 2V15l5-2V5.5zm-6 9.5V7.5l-5-2V13l5 2z"/>
    </svg>
  );
}

// ============================================================================
// Logic Type Icons
// ============================================================================

function ConditionIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5v1A1.5 1.5 0 0 1 8.5 6v1H14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 2 7h5.5V6A1.5 1.5 0 0 1 6 4.5v-1zM8.5 5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1zM0 11.5A1.5 1.5 0 0 1 1.5 10h1A1.5 1.5 0 0 1 4 11.5v1A1.5 1.5 0 0 1 2.5 14h-1A1.5 1.5 0 0 1 0 12.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1zm4.5.5A1.5 1.5 0 0 1 7.5 10h1a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 8.5 14h-1A1.5 1.5 0 0 1 6 12.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1zm4.5.5a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1z"/>
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
    </svg>
  );
}

function ParallelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
    </svg>
  );
}

function MergeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4a.5.5 0 0 1 .5.5V6a.5.5 0 0 1-1 0V4.5A.5.5 0 0 1 8 4zM3.732 5.732a.5.5 0 0 1 .707 0l.915.914a.5.5 0 1 1-.708.708l-.914-.915a.5.5 0 0 1 0-.707zM2 10a.5.5 0 0 1 .5-.5h1.586a.5.5 0 0 1 0 1H2.5A.5.5 0 0 1 2 10zm9.5 0a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 0 1H12a.5.5 0 0 1-.5-.5zm.754-4.246a.389.389 0 0 0-.527-.02L7.547 9.31a.91.91 0 1 0 1.302 1.258l3.434-4.297a.389.389 0 0 0-.029-.518z"/>
    </svg>
  );
}

function DelayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path fill-rule="evenodd" d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5zm14-7a.5.5 0 0 1-.5.5H2.707l3.147 3.146a.5.5 0 1 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 4H14.5a.5.5 0 0 1 .5.5z"/>
    </svg>
  );
}

function getLogicTypeIcon(type: LogicType) {
  switch (type) {
    case "condition":
      return <ConditionIcon />;
    case "switch":
      return <SwitchIcon />;
    case "loop":
      return <LoopIcon />;
    case "parallel":
      return <ParallelIcon />;
    case "merge":
      return <MergeIcon />;
    case "delay":
      return <DelayIcon />;
    case "filter":
      return <FilterIcon />;
    case "map":
      return <MapIcon />;
  }
}

function getLogicTypeLabel(type: LogicType): string {
  switch (type) {
    case "condition":
      return "Condition";
    case "switch":
      return "Switch";
    case "loop":
      return "Loop";
    case "parallel":
      return "Parallel";
    case "merge":
      return "Merge";
    case "delay":
      return "Delay";
    case "filter":
      return "Filter";
    case "map":
      return "Map";
  }
}

// ============================================================================
// Get Output Ports for Logic Type
// ============================================================================

function getOutputPorts(data: LogicNodeData): Array<{ id: string; label: string; dataType?: string }> {
  switch (data.logicType) {
    case "condition":
      return [
        { id: "true", label: "True" },
        { id: "false", label: "False" },
      ];
    case "switch":
      const cases = data.cases || ["case1", "case2"];
      return [
        ...cases.map((c, i) => ({ id: `case_${i}`, label: c })),
        { id: "default", label: "Default" },
      ];
    case "loop":
      return [
        { id: "iteration", label: "Iteration" },
        { id: "done", label: "Done" },
      ];
    case "parallel":
      const branches = data.parallelBranches || 2;
      return Array.from({ length: branches }, (_, i) => ({
        id: `branch_${i}`,
        label: `Branch ${i + 1}`,
      }));
    case "merge":
      return [{ id: "output", label: "Output" }];
    case "delay":
      return [{ id: "output", label: "Output" }];
    case "filter":
      return [
        { id: "passed", label: "Passed" },
        { id: "rejected", label: "Rejected" },
      ];
    case "map":
      return [{ id: "output", label: "Output" }];
    default:
      return [{ id: "output", label: "Output" }];
  }
}

function getInputPorts(data: LogicNodeData): Array<{ id: string; label: string; multiple?: boolean }> {
  switch (data.logicType) {
    case "merge":
      return [{ id: "input", label: "Inputs", multiple: true }];
    case "parallel":
      return [{ id: "input", label: "Input" }];
    default:
      return [{ id: "input", label: "Input" }];
  }
}

// ============================================================================
// Logic Node Component
// ============================================================================

export function LogicNode(props: LogicNodeProps) {
  const logicTypeLabel = createMemo(() => getLogicTypeLabel(props.data.logicType));
  const logicTypeIcon = createMemo(() => getLogicTypeIcon(props.data.logicType));
  const outputPorts = createMemo(() => getOutputPorts(props.data));
  const inputPorts = createMemo(() => getInputPorts(props.data));

  // Calculate size based on port count
  const nodeSize = createMemo(() => {
    const portCount = Math.max(outputPorts().length, inputPorts().length);
    const baseHeight = 100;
    const portHeight = 24;
    return props.size || { width: 200, height: baseHeight + (portCount * portHeight) };
  });

  return (
    <BaseNodeContainer
      id={props.id}
      type="logic"
      position={props.position}
      size={nodeSize()}
      selected={props.selected}
      multiSelected={props.multiSelected}
      status={props.status}
      disabled={props.disabled}
      colorScheme={LOGIC_COLOR}
      icon={<LogicIcon />}
      label={props.data.name || logicTypeLabel()}
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
          <For each={inputPorts()}>
            {(port) => (
              <NodePort
                id={port.id}
                nodeId={props.id}
                label={port.label}
                type="input"
                dataType="any"
                multiple={port.multiple}
                onDragStart={props.onPortDragStart}
                onDrop={props.onPortDrop}
                onHover={props.onPortHover}
              />
            )}
          </For>
        </div>

        {/* Output Ports */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
          <For each={outputPorts()}>
            {(port) => (
              <NodePort
                id={port.id}
                nodeId={props.id}
                label={port.label}
                type="output"
                dataType="any"
                highlighted={props.activeBranch === port.id}
                onDragStart={props.onPortDragStart}
                onDrop={props.onPortDrop}
                onHover={props.onPortHover}
              />
            )}
          </For>
        </div>
      </div>

      {/* Logic Type & Config */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
        {/* Logic Type Badge */}
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
              background: `${LOGIC_COLOR}20`,
              color: LOGIC_COLOR,
            }}
          >
            {logicTypeIcon()}
          </span>
          <Badge variant="default" size="sm" style={{ background: `${LOGIC_COLOR}30`, color: LOGIC_COLOR }}>
            {logicTypeLabel()}
          </Badge>
        </div>

        {/* Expression Display */}
        <Show when={props.data.expression}>
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
            {props.data.expression}
          </div>
        </Show>

        {/* Loop Iteration Counter */}
        <Show when={props.data.logicType === "loop" && props.currentIteration !== undefined}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              "font-size": "10px",
            }}
          >
            <span style={{ color: "var(--jb-text-muted-color)" }}>Iteration:</span>
            <span style={{ color: "var(--jb-text-body-color)" }}>
              {props.currentIteration}
              {props.data.maxIterations && ` / ${props.data.maxIterations}`}
            </span>
          </div>
        </Show>

        {/* Delay Display */}
        <Show when={props.data.logicType === "delay" && props.data.delayMs}>
          <div
            style={{
              "font-size": "10px",
              color: "var(--jb-text-muted-color)",
            }}
          >
            Wait: {props.data.delayMs! >= 1000 ? `${props.data.delayMs! / 1000}s` : `${props.data.delayMs}ms`}
          </div>
        </Show>

        {/* Active Branch Indicator */}
        <Show when={props.activeBranch}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
              padding: "4px 6px",
              background: `${LOGIC_COLOR}15`,
              "border-radius": "var(--jb-radius-sm)",
              "font-size": "10px",
              color: LOGIC_COLOR,
            }}
          >
            <span style={{ opacity: "0.7" }}>Active:</span>
            <span style={{ "font-weight": "600" }}>{props.activeBranch}</span>
          </div>
        </Show>
      </div>

      {/* Diamond shape indicator for condition */}
      <Show when={props.data.logicType === "condition"}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "-8px",
            transform: "translateY(-50%) rotate(45deg)",
            width: "12px",
            height: "12px",
            background: LOGIC_COLOR,
            opacity: "0.3",
          }}
        />
      </Show>
    </BaseNodeContainer>
  );
}

export default LogicNode;


/**
 * Factory Node Components Index
 * 
 * This module exports all node components for the Agent Factory visual editor,
 * along with utilities for node registration and defaults.
 */

import { NodePosition, NodeSize, PortDataType } from "./BaseNode";

// ============================================================================
// Component Exports
// ============================================================================

export { BaseNodeContainer, PORT_COLORS } from "./BaseNode";
export type {
  NodeStatus,
  NodePosition,
  NodeSize,
  NodePort as NodePortType,
  PortDataType,
  NodeValidationError,
  BaseNodeData,
  BaseNodeProps,
  BaseNodeContainerProps,
} from "./BaseNode";

export { NodePort, PortRow, PortGroup } from "./NodePort";
export type { NodePortProps, PortRowProps, PortGroupProps } from "./NodePort";

export { AgentNode } from "./AgentNode";
export type { AgentNodeData, AgentNodeProps } from "./AgentNode";

export { TriggerNode } from "./TriggerNode";
export type { TriggerType, TriggerNodeData, TriggerNodeProps } from "./TriggerNode";

export { ActionNode } from "./ActionNode";
export type { ActionType, ActionNodeData, ActionNodeProps } from "./ActionNode";

export { LogicNode } from "./LogicNode";
export type { LogicType, LogicNodeData, LogicNodeProps } from "./LogicNode";

export { SupervisorNode } from "./SupervisorNode";
export type { InterceptMode, WatchedAgent, SupervisorNodeData, SupervisorNodeProps } from "./SupervisorNode";

export { MessageNode } from "./MessageNode";
export type { MessageDirection, MessageNodeData, MessageNodeProps } from "./MessageNode";

// ============================================================================
// Node Types
// ============================================================================

export type NodeType =
  | "agent"
  | "trigger"
  | "action"
  | "logic"
  | "supervisor"
  | "message";

// ============================================================================
// Node Metadata
// ============================================================================

export interface NodeTypeMetadata {
  type: NodeType;
  label: string;
  description: string;
  icon: string;
  color: string;
  category: "core" | "control" | "communication";
  defaultSize: NodeSize;
  defaultPorts: {
    inputs: Array<{ id: string; label: string; dataType: PortDataType }>;
    outputs: Array<{ id: string; label: string; dataType: PortDataType }>;
  };
  resizable: boolean;
}

/**
 * Node type metadata registry
 */
export const NODE_METADATA: Record<NodeType, NodeTypeMetadata> = {
  agent: {
    type: "agent",
    label: "Agent",
    description: "AI agent that processes messages using LLM",
    icon: "\u{1F916}", // Robot emoji
    color: "#3498DB",
    category: "core",
    defaultSize: { width: 220, height: 160 },
    defaultPorts: {
      inputs: [{ id: "input", label: "Input", dataType: "message" }],
      outputs: [
        { id: "output", label: "Output", dataType: "message" },
        { id: "error", label: "Error", dataType: "error" },
      ],
    },
    resizable: true,
  },
  trigger: {
    type: "trigger",
    label: "Trigger",
    description: "Starts workflow based on events",
    icon: "\u26A1", // Lightning bolt
    color: "#27AE60",
    category: "core",
    defaultSize: { width: 200, height: 120 },
    defaultPorts: {
      inputs: [],
      outputs: [{ id: "event", label: "Event", dataType: "event" }],
    },
    resizable: false,
  },
  action: {
    type: "action",
    label: "Action",
    description: "Executes shell commands or API calls",
    icon: "\u25B6", // Play button
    color: "#E67E22",
    category: "core",
    defaultSize: { width: 220, height: 150 },
    defaultPorts: {
      inputs: [{ id: "input", label: "Input", dataType: "any" }],
      outputs: [
        { id: "stdout", label: "Output", dataType: "string" },
        { id: "stderr", label: "Stderr", dataType: "error" },
        { id: "code", label: "Code", dataType: "number" },
      ],
    },
    resizable: true,
  },
  logic: {
    type: "logic",
    label: "Logic",
    description: "Controls flow with conditions, loops, and branches",
    icon: "\u25C7", // Diamond
    color: "#9B59B6",
    category: "control",
    defaultSize: { width: 200, height: 140 },
    defaultPorts: {
      inputs: [{ id: "input", label: "Input", dataType: "any" }],
      outputs: [
        { id: "true", label: "True", dataType: "any" },
        { id: "false", label: "False", dataType: "any" },
      ],
    },
    resizable: true,
  },
  supervisor: {
    type: "supervisor",
    label: "Supervisor",
    description: "Monitors and controls agent behavior",
    icon: "\u{1F52D}", // Telescope emoji
    color: "#E74C3C",
    category: "control",
    defaultSize: { width: 240, height: 180 },
    defaultPorts: {
      inputs: [{ id: "agents", label: "Agents", dataType: "agent" }],
      outputs: [
        { id: "decisions", label: "Decisions", dataType: "message" },
        { id: "alerts", label: "Alerts", dataType: "event" },
      ],
    },
    resizable: true,
  },
  message: {
    type: "message",
    label: "Message",
    description: "Sends messages between agents",
    icon: "\u{1F4AC}", // Chat bubble emoji
    color: "#00BCD4",
    category: "communication",
    defaultSize: { width: 200, height: 130 },
    defaultPorts: {
      inputs: [
        { id: "trigger", label: "Trigger", dataType: "event" },
        { id: "message", label: "Message", dataType: "message" },
      ],
      outputs: [
        { id: "sent", label: "Sent", dataType: "message" },
        { id: "error", label: "Error", dataType: "error" },
      ],
    },
    resizable: true,
  },
};

// ============================================================================
// Node Component Registry
// ============================================================================

import { AgentNode } from "./AgentNode";
import { TriggerNode } from "./TriggerNode";
import { ActionNode } from "./ActionNode";
import { LogicNode } from "./LogicNode";
import { SupervisorNode } from "./SupervisorNode";
import { MessageNode } from "./MessageNode";

/**
 * Get the component for a given node type
 */
export function getNodeComponent(type: NodeType): typeof AgentNode | typeof TriggerNode | typeof ActionNode | typeof LogicNode | typeof SupervisorNode | typeof MessageNode {
  switch (type) {
    case "agent":
      return AgentNode;
    case "trigger":
      return TriggerNode;
    case "action":
      return ActionNode;
    case "logic":
      return LogicNode;
    case "supervisor":
      return SupervisorNode;
    case "message":
      return MessageNode;
    default:
      throw new Error(`Unknown node type: ${type}`);
  }
}

// ============================================================================
// Node Defaults
// ============================================================================

/**
 * Default data for each node type
 */
export interface NodeDefaults {
  position: NodePosition;
  size: NodeSize;
  data: Record<string, unknown>;
}

/**
 * Get default values for a new node of a given type
 */
export function getNodeDefaults(type: NodeType, position?: NodePosition): NodeDefaults {
  const metadata = NODE_METADATA[type];
  
  const baseDefaults: NodeDefaults = {
    position: position || { x: 100, y: 100 },
    size: metadata.defaultSize,
    data: {},
  };

  switch (type) {
    case "agent":
      return {
        ...baseDefaults,
        data: {
          name: "New Agent",
          description: "",
          model: "gpt-4",
          provider: "openai",
          tools: [],
          temperature: 0.7,
          streaming: true,
        },
      };
    case "trigger":
      return {
        ...baseDefaults,
        data: {
          name: "New Trigger",
          description: "",
          triggerType: "manual",
          enabled: true,
        },
      };
    case "action":
      return {
        ...baseDefaults,
        data: {
          name: "New Action",
          description: "",
          actionType: "shell",
          config: { command: "" },
          timeout: 30000,
        },
      };
    case "logic":
      return {
        ...baseDefaults,
        data: {
          name: "Condition",
          description: "",
          logicType: "condition",
          expression: "",
        },
      };
    case "supervisor":
      return {
        ...baseDefaults,
        data: {
          name: "Supervisor",
          description: "",
          watchedAgents: [],
          interceptMode: "all",
          autoApprove: false,
        },
      };
    case "message":
      return {
        ...baseDefaults,
        data: {
          name: "Message",
          description: "",
          direction: "send",
        },
      };
    default:
      return baseDefaults;
  }
}

// ============================================================================
// Node Categories
// ============================================================================

export interface NodeCategory {
  id: string;
  label: string;
  description: string;
  nodes: NodeType[];
}

/**
 * Node categories for the node palette
 */
export const NODE_CATEGORIES: NodeCategory[] = [
  {
    id: "core",
    label: "Core Nodes",
    description: "Essential building blocks for workflows",
    nodes: ["agent", "trigger", "action"],
  },
  {
    id: "control",
    label: "Control Flow",
    description: "Logic and supervision nodes",
    nodes: ["logic", "supervisor"],
  },
  {
    id: "communication",
    label: "Communication",
    description: "Inter-agent messaging",
    nodes: ["message"],
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if two ports can be connected
 */
export function canConnect(
  sourceType: PortDataType,
  targetType: PortDataType
): boolean {
  // Any type can connect to anything
  if (sourceType === "any" || targetType === "any") return true;
  
  // Same types can connect
  if (sourceType === targetType) return true;
  
  // Special cases
  const compatiblePairs: [PortDataType, PortDataType][] = [
    ["message", "string"],
    ["event", "any"],
    ["agent", "any"],
  ];
  
  for (const [a, b] of compatiblePairs) {
    if ((sourceType === a && targetType === b) || (sourceType === b && targetType === a)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate a unique node ID
 */
export function generateNodeId(type: NodeType): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get all node types for a category
 */
export function getNodesByCategory(categoryId: string): NodeType[] {
  const category = NODE_CATEGORIES.find((c) => c.id === categoryId);
  return category?.nodes || [];
}

/**
 * Get metadata for multiple node types
 */
export function getNodesMetadata(types: NodeType[]): NodeTypeMetadata[] {
  return types.map((type) => NODE_METADATA[type]);
}

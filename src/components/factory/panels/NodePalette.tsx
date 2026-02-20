/**
 * =============================================================================
 * NODE PALETTE - Agent Factory Node Library
 * =============================================================================
 * 
 * A categorized palette of available nodes that can be dragged onto the canvas
 * to build agent workflows. Supports search/filter, collapsible categories,
 * and drag-and-drop functionality.
 * 
 * Categories:
 * - Triggers: File watch, schedule, webhook, manual
 * - Agents: AI agents with different capabilities
 * - Actions: File operations, API calls, commands
 * - Logic: Conditionals, loops, switches
 * - Communication: Notifications, approvals
 * - Utilities: Delay, transform, aggregate
 * 
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  JSX,
  onMount,
} from "solid-js";
import { Input } from "../../ui/Input";


// =============================================================================
// TYPES
// =============================================================================

export type NodeCategory = 
  | "triggers"
  | "agents"
  | "actions"
  | "logic"
  | "communication"
  | "utilities"
  | "typescript";

export interface NodeDefinition {
  id: string;
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultConfig?: Record<string, unknown>;
}

export interface NodePaletteProps {
  /** Callback when a node is dragged */
  onDragStart?: (node: NodeDefinition, event: DragEvent) => void;
  /** Callback when a node is dropped */
  onDragEnd?: (node: NodeDefinition, event: DragEvent) => void;
  /** Callback for quick add (click to add at center) */
  onQuickAdd?: (node: NodeDefinition) => void;
  /** Whether the palette is collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

// =============================================================================
// ICONS
// =============================================================================

const icons: Record<string, () => JSX.Element> = {
  // Triggers
  "file-watch": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.5 1H4L2 3.5V14.5L4 16h9.5l1.5-1.5V2.5L13.5 1zM13 14H4V3h9v11z"/>
      <path d="M5 5h6v1H5zM5 7h6v1H5zM5 9h4v1H5z"/>
    </svg>
  ),
  "schedule": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 13A6 6 0 1 1 8 2a6 6 0 0 1 0 12z"/>
      <path d="M8 4v4.5l3 1.5-.5 1-3.5-2V4h1z"/>
    </svg>
  ),
  "webhook": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.5 6a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0-4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
      <path d="M8 8.5L5.5 6 3 8.5l.7.7L5 8v6h1V8l1.3 1.2.7-.7z"/>
      <path d="M10.5 15a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0-4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
      <path d="M8 7.5L10.5 10 13 7.5l-.7-.7L11 8V2h-1v6l-1.3-1.2-.7.7z"/>
    </svg>
  ),
  "play": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.5 2v12l10-6-10-6z"/>
    </svg>
  ),
  // Agents
  "robot": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a1 1 0 0 1 1 1v1h3.5l.5.5v3l-.5.5H12v1h.5l.5.5v5l-.5.5h-9l-.5-.5v-5l.5-.5H4V7h-.5L3 6.5v-3l.5-.5H7V2a1 1 0 0 1 1-1zM4 4v2h8V4H4zm1 4v5h6V8H5zm1 1h1v1H6V9zm3 0h1v1H9V9z"/>
    </svg>
  ),
  "brain": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm0 13c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
      <path d="M8.5 4C7.1 4 6 5.1 6 6.5S7.1 9 8.5 9 11 7.9 11 6.5 9.9 4 8.5 4zm0 4c-.8 0-1.5-.7-1.5-1.5S7.7 5 8.5 5s1.5.7 1.5 1.5S9.3 8 8.5 8z"/>
      <path d="M5 10c-1.1 0-2 .9-2 2v1h2v-1h-1v-.5c0-.3.2-.5.5-.5h1v-1H5z"/>
    </svg>
  ),
  "code": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.7 13.7l-4-4 .7-.7 3.3 3.3 3.3-3.3.7.7-4 4z"/>
      <path d="M10.3 2.3l4 4-.7.7-3.3-3.3-3.3 3.3-.7-.7 4-4z"/>
    </svg>
  ),
  // Actions
  "terminal": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 3l.5-.5h12l.5.5v10l-.5.5H2l-.5-.5V3zM2 13h12V3H2v10z"/>
      <path d="M3 12h4v-1H3v1zM3 6l3 2-3 2V6z"/>
    </svg>
  ),
  "globe": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm5.9 6.5h-2.2c-.1-1.5-.5-2.8-1-3.8 1.6.8 2.8 2.2 3.2 3.8zM8 2c.5 0 1.2 1.4 1.4 3.5H6.6C6.8 3.4 7.5 2 8 2zM2.1 7.5c.4-1.6 1.6-3 3.2-3.8-.5 1-1 2.3-1 3.8H2.1zM2 8.5h2.3c.1 1.5.5 2.8 1 3.8-1.6-.8-2.9-2.2-3.3-3.8zM8 14c-.5 0-1.2-1.4-1.4-3.5h2.8C9.2 12.6 8.5 14 8 14zm2.7-1.3c.5-1 .9-2.3 1-3.7h2.2c-.4 1.6-1.6 3-3.2 3.7z"/>
    </svg>
  ),
  "file-add": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.5 1H4l-.5.5v13l.5.5h8l.5-.5V4l-1-1.5-.5-.5h-1zM11 2l1 1.5V4h-2V2h1zM4 14V2h4v3h3v9H4z"/>
      <path d="M7 6v3H5v1h2v3h1v-3h2V9H8V6H7z"/>
    </svg>
  ),
  // Logic
  "split-branch": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1v4H4v2h4v2H4v2h4v4h1v-4h4v-2H9V7h4V5H9V1H8z"/>
    </svg>
  ),
  "loop": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.5 3H11v2l3-2.5L11 0v2H4a3 3 0 0 0-3 3v2h1V5a2 2 0 0 1 2.5-1.9z"/>
      <path d="M11.5 13H5v-2l-3 2.5L5 16v-2h7a3 3 0 0 0 3-3V9h-1v2a2 2 0 0 1-2.5 1.9z"/>
    </svg>
  ),
  "switch": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 4h5v1H1V4zM1 7h3v1H1V7zM1 10h5v1H1v-1z"/>
      <path d="M8 4h7v1H8V4zM10 7h5v1h-5V7zM8 10h7v1H8v-1z"/>
      <path d="M6.5 4.5l2 2.5-2 2.5V4.5z"/>
    </svg>
  ),
  // Communication
  "bell": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2a1 1 0 0 1 1 1v.3c2.3.6 4 2.7 4 5.2v2l1 2H2l1-2v-2c0-2.5 1.7-4.6 4-5.2V3a1 1 0 0 1 1-1zm0 2c-2.2 0-4 1.8-4 4v2.6l-.3.4h8.6l-.3-.4V8c0-2.2-1.8-4-4-4z"/>
      <path d="M10 13H6a2 2 0 1 0 4 0z"/>
    </svg>
  ),
  "mail": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 4l.5-.5h13l.5.5v8l-.5.5h-13L1 12V4zm1 1v6.5l5.5-3.5L2 5zm5.5 4L2 12h12l-5.5-3-.5.3-.5-.3zm1-1L14 5v6.5L8.5 8z"/>
    </svg>
  ),
  "shield": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1L2 3v5c0 3.3 2.4 6.3 6 7 3.6-.7 6-3.7 6-7V3L8 1zm5 7c0 2.6-1.9 5-5 5.8C4.9 13 3 10.6 3 8V4l5-1.5L13 4v4z"/>
      <path d="M7 9.8L5.2 8l.7-.7L7 8.4l3.1-3.1.7.7L7 9.8z"/>
    </svg>
  ),
  // Utilities
  "clock": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 13A6 6 0 1 1 8 2a6 6 0 0 1 0 12z"/>
      <path d="M7.5 4v4.5l3 1.5.5-1-2.5-1.3V4h-1z"/>
    </svg>
  ),
  "transform": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 1h4v4h-4V1zm1 1v2h2V2h-2z"/>
      <path d="M10.5 1h4v4h-4V1zm1 1v2h2V2h-2z"/>
      <path d="M1.5 11h4v4h-4v-4zm1 1v2h2v-2h-2z"/>
      <path d="M10.5 11h4v4h-4v-4zm1 1v2h2v-2h-2z"/>
      <path d="M5.5 3h5v1h-5V3zM3 5.5v5h1v-5H3zM12 5.5v5h1v-5h-1zM5.5 12h5v1h-5v-1z"/>
    </svg>
  ),
  "merge": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 15V9l4-4V1H4v4l4 4v6h1zM5 2h6v2.5L8 7.5 5 4.5V2z"/>
    </svg>
  ),
  // TypeScript/TSP icons
  "typescript": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 1h14v14H1V1zm1 1v12h12V2H2z"/>
      <path d="M5 6h6v1H8.5v5h-1V7H5V6z"/>
      <path d="M10 8.5c0-.3.2-.5.5-.5h1c.6 0 1 .4 1 1v.5h-1V9h-1v1h1c.6 0 1 .4 1 1v1c0 .6-.4 1-1 1h-1c-.3 0-.5-.2-.5-.5h1v-1h1v-1h-1c-.6 0-1-.4-1-1v-.5z"/>
    </svg>
  ),
  "component": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1L1 4.5v7L8 15l7-3.5v-7L8 1zm0 1.2l5.4 2.7L8 7.6 2.6 4.9 8 2.2zM2 5.8l5.5 2.7v5.3L2 11.1V5.8zm6.5 8V8.5L14 5.8v5.3l-5.5 2.7z"/>
    </svg>
  ),
  "function": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.5A1.5 1.5 0 0 1 5.5 1H7v1H5.5a.5.5 0 0 0-.5.5V5h2v1H5v4H4V6H2V5h2V2.5z"/>
      <path d="M9 6h1l1.2 3.5L12.5 6h1l-2 5.5h-1L9 6z"/>
    </svg>
  ),
  "interface": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 4h12v1H2V4z"/>
      <path d="M4 6h8v1H4V6z"/>
      <path d="M4 8h8v1H4V8z"/>
      <path d="M4 10h8v1H4v-1z"/>
      <path d="M2 12h12v1H2v-1z"/>
    </svg>
  ),
  "type": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 3h10v2h-4v8H7V5H3V3z"/>
    </svg>
  ),
  "class": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1L2 4v8l6 3 6-3V4L8 1zm0 1.2l4.8 2.4-4.8 2.4-4.8-2.4L8 2.2zM3 5.2l4.5 2.3v5l-4.5-2.3v-5zm5.5 7.3v-5l4.5-2.3v5l-4.5 2.3z"/>
    </svg>
  ),
  "module": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 3v10h14V3H1zm1 1h12v8H2V4z"/>
      <path d="M3 6h4v1H3V6zM3 8h6v1H3V8zM3 10h4v1H3v-1z"/>
      <path d="M9 6h4v5H9V6zm1 1v3h2V7h-2z"/>
    </svg>
  ),
  "test": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 1v3H4v2h2v1L3 14h10L10 7V6h2V4h-2V1H6zm1 1h2v2H7V2zm0 3h2v2l2.5 6h-7L7 7V5z"/>
      <path d="M7.5 9a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0z"/>
    </svg>
  ),
  "lint": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1L2 3v5c0 3 2 5.5 6 7 4-1.5 6-4 6-7V3L8 1zm0 1.3l5 1.7v4.5c0 2.3-1.6 4.3-5 5.5-3.4-1.2-5-3.2-5-5.5V4l5-1.7z"/>
      <path d="M7 9l-2-2 .7-.7L7 7.6l3.3-3.3.7.7L7 9z"/>
    </svg>
  ),
  "build": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.5 11.5L12 14l-3-3 .7-.7 1.8 1.8V8h1v4.1l1.8-1.8.7.7zM5 3H2v10h3V3zm1 0v10h3V3H6zm4 0v4h3V3h-3z"/>
    </svg>
  ),
  "package": () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1L1 4v8l7 3 7-3V4L8 1zm0 1.2l5.5 2.4L8 7.2 2.5 4.6 8 2.2zM2 5.4l5.5 2.4v5.8L2 11V5.4zm6.5 8.2V8L14 5.4V11l-5.5 2.6z"/>
    </svg>
  ),
};

function Icon(props: { name: string; size?: number }) {
  const iconFn = icons[props.name];
  const size = props.size || 16;

  return (
    <span
      style={{
        display: "inline-flex",
        "align-items": "center",
        "justify-content": "center",
        width: `${size}px`,
        height: `${size}px`,
        "flex-shrink": "0",
      }}
    >
      {iconFn ? iconFn() : null}
    </span>
  );
}

// =============================================================================
// NODE DEFINITIONS
// =============================================================================

const NODE_DEFINITIONS: NodeDefinition[] = [
  // Triggers
  {
    id: "trigger-file-watch",
    type: "trigger",
    category: "triggers",
    label: "File Watcher",
    description: "Triggers when files change in a directory",
    icon: "file-watch",
    color: "var(--node-trigger)",
    defaultConfig: { pattern: "**/*", debounce: 300 },
  },
  {
    id: "trigger-schedule",
    type: "trigger",
    category: "triggers",
    label: "Schedule",
    description: "Triggers on a cron schedule",
    icon: "schedule",
    color: "var(--node-trigger)",
    defaultConfig: { cron: "0 * * * *" },
  },
  {
    id: "trigger-webhook",
    type: "trigger",
    category: "triggers",
    label: "Webhook",
    description: "Triggers on incoming HTTP requests",
    icon: "webhook",
    color: "var(--node-trigger)",
    defaultConfig: { method: "POST", path: "/webhook" },
  },
  {
    id: "trigger-manual",
    type: "trigger",
    category: "triggers",
    label: "Manual",
    description: "Triggers manually via UI or API",
    icon: "play",
    color: "var(--node-trigger)",
    defaultConfig: {},
  },

  // Agents
  {
    id: "agent-general",
    type: "agent",
    category: "agents",
    label: "General Agent",
    description: "A versatile AI agent for various tasks",
    icon: "robot",
    color: "var(--node-agent)",
    defaultConfig: { model: "gpt-4", temperature: 0.7, maxSteps: 10 },
  },
  {
    id: "agent-coder",
    type: "agent",
    category: "agents",
    label: "Code Agent",
    description: "Specialized agent for coding tasks",
    icon: "code",
    color: "var(--node-agent)",
    defaultConfig: { model: "gpt-4", temperature: 0.2, maxSteps: 20 },
  },
  {
    id: "agent-analyst",
    type: "agent",
    category: "agents",
    label: "Analyst Agent",
    description: "Agent for data analysis and insights",
    icon: "brain",
    color: "var(--node-agent)",
    defaultConfig: { model: "gpt-4", temperature: 0.5, maxSteps: 15 },
  },
  {
    id: "agent-supervisor",
    type: "agent",
    category: "agents",
    label: "Supervisor",
    description: "Coordinates and oversees other agents",
    icon: "shield",
    color: "var(--node-supervisor)",
    defaultConfig: { model: "gpt-4", approvalRequired: true },
  },

  // Actions
  {
    id: "action-command",
    type: "action",
    category: "actions",
    label: "Run Command",
    description: "Execute a shell command",
    icon: "terminal",
    color: "var(--node-action)",
    defaultConfig: { command: "", timeout: 30000 },
  },
  {
    id: "action-api",
    type: "action",
    category: "actions",
    label: "API Request",
    description: "Make an HTTP API request",
    icon: "globe",
    color: "var(--node-action)",
    defaultConfig: { method: "GET", url: "", headers: {} },
  },
  {
    id: "action-file",
    type: "action",
    category: "actions",
    label: "File Operation",
    description: "Read, write, or modify files",
    icon: "file-add",
    color: "var(--node-action)",
    defaultConfig: { operation: "read", path: "" },
  },

  // Logic
  {
    id: "logic-condition",
    type: "logic",
    category: "logic",
    label: "Condition",
    description: "Branch based on a condition",
    icon: "split-branch",
    color: "var(--node-logic)",
    defaultConfig: { expression: "", trueLabel: "Yes", falseLabel: "No" },
  },
  {
    id: "logic-loop",
    type: "logic",
    category: "logic",
    label: "Loop",
    description: "Iterate over items or repeat",
    icon: "loop",
    color: "var(--node-logic)",
    defaultConfig: { type: "forEach", maxIterations: 100 },
  },
  {
    id: "logic-switch",
    type: "logic",
    category: "logic",
    label: "Switch",
    description: "Multi-way branching",
    icon: "switch",
    color: "var(--node-logic)",
    defaultConfig: { expression: "", cases: [] },
  },

  // Communication
  {
    id: "comm-notify",
    type: "communication",
    category: "communication",
    label: "Notification",
    description: "Send a notification",
    icon: "bell",
    color: "var(--node-communication)",
    defaultConfig: { channel: "default", message: "" },
  },
  {
    id: "comm-email",
    type: "communication",
    category: "communication",
    label: "Send Email",
    description: "Send an email message",
    icon: "mail",
    color: "var(--node-communication)",
    defaultConfig: { to: "", subject: "", body: "" },
  },
  {
    id: "comm-approval",
    type: "communication",
    category: "communication",
    label: "Request Approval",
    description: "Wait for human approval",
    icon: "shield",
    color: "var(--node-communication)",
    defaultConfig: { message: "", timeout: 86400000 },
  },

  // Utilities
  {
    id: "util-delay",
    type: "utility",
    category: "utilities",
    label: "Delay",
    description: "Wait for a specified duration",
    icon: "clock",
    color: "var(--node-utility)",
    defaultConfig: { duration: 1000 },
  },
  {
    id: "util-transform",
    type: "utility",
    category: "utilities",
    label: "Transform",
    description: "Transform data using expressions",
    icon: "transform",
    color: "var(--node-utility)",
    defaultConfig: { expression: "" },
  },
  {
    id: "util-aggregate",
    type: "utility",
    category: "utilities",
    label: "Aggregate",
    description: "Combine multiple inputs",
    icon: "merge",
    color: "var(--node-utility)",
    defaultConfig: { mode: "all" },
  },

  // TypeScript Project (TSP) nodes
  {
    id: "tsp-typecheck",
    type: "typescript",
    category: "typescript",
    label: "TypeCheck",
    description: "Run TypeScript type checker (tsc --noEmit)",
    icon: "typescript",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      command: "tsc --noEmit",
      configPath: "tsconfig.json",
      strict: true 
    },
  },
  {
    id: "tsp-build",
    type: "typescript",
    category: "typescript",
    label: "Build Project",
    description: "Build TypeScript project",
    icon: "build",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      command: "tsc",
      outDir: "dist",
      watch: false 
    },
  },
  {
    id: "tsp-lint",
    type: "typescript",
    category: "typescript",
    label: "ESLint",
    description: "Run ESLint on TypeScript files",
    icon: "lint",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      command: "eslint",
      pattern: "src/**/*.{ts,tsx}",
      fix: false 
    },
  },
  {
    id: "tsp-test",
    type: "typescript",
    category: "typescript",
    label: "Run Tests",
    description: "Execute test suite (Jest, Vitest, etc.)",
    icon: "test",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      runner: "vitest",
      coverage: false,
      watch: false 
    },
  },
  {
    id: "tsp-format",
    type: "typescript",
    category: "typescript",
    label: "Prettier",
    description: "Format code with Prettier",
    icon: "code",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      command: "prettier --write",
      pattern: "src/**/*.{ts,tsx,js,jsx}" 
    },
  },
  {
    id: "tsp-analyze-imports",
    type: "typescript",
    category: "typescript",
    label: "Analyze Imports",
    description: "Analyze and organize imports",
    icon: "module",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      removeUnused: true,
      sortImports: true 
    },
  },
  {
    id: "tsp-generate-types",
    type: "typescript",
    category: "typescript",
    label: "Generate Types",
    description: "Generate TypeScript types from schema",
    icon: "type",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      source: "api",
      outputPath: "src/types/generated.ts" 
    },
  },
  {
    id: "tsp-extract-interface",
    type: "typescript",
    category: "typescript",
    label: "Extract Interface",
    description: "Extract interface from implementation",
    icon: "interface",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      filePath: "",
      className: "" 
    },
  },
  {
    id: "tsp-refactor-component",
    type: "typescript",
    category: "typescript",
    label: "Refactor Component",
    description: "Refactor React/Solid component",
    icon: "component",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      componentPath: "",
      action: "extract-logic" 
    },
  },
  {
    id: "tsp-package-audit",
    type: "typescript",
    category: "typescript",
    label: "Package Audit",
    description: "Audit npm packages for vulnerabilities",
    icon: "package",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      command: "npm audit",
      fix: false 
    },
  },
  {
    id: "tsp-bundle-analyze",
    type: "typescript",
    category: "typescript",
    label: "Bundle Analyzer",
    description: "Analyze bundle size and composition",
    icon: "package",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      bundler: "vite",
      outputPath: "bundle-report.html" 
    },
  },
  {
    id: "tsp-dead-code",
    type: "typescript",
    category: "typescript",
    label: "Dead Code Detection",
    description: "Find unused exports and dead code",
    icon: "function",
    color: "var(--node-typescript, var(--cortex-info))",
    defaultConfig: { 
      pattern: "src/**/*.ts",
      reportOnly: true 
    },
  },
];

const CATEGORY_INFO: Record<NodeCategory, { label: string; description: string }> = {
  triggers: { label: "Triggers", description: "Start workflow execution" },
  agents: { label: "Agents", description: "AI-powered agents" },
  actions: { label: "Actions", description: "Perform operations" },
  logic: { label: "Logic", description: "Control flow" },
  communication: { label: "Communication", description: "Send messages" },
  utilities: { label: "Utilities", description: "Helper nodes" },
  typescript: { label: "TypeScript", description: "TypeScript project tools" },
};

// =============================================================================
// NODE ITEM COMPONENT
// =============================================================================

interface NodeItemProps {
  node: NodeDefinition;
  onDragStart?: (node: NodeDefinition, event: DragEvent) => void;
  onDragEnd?: (node: NodeDefinition, event: DragEvent) => void;
  onQuickAdd?: (node: NodeDefinition) => void;
}

function NodeItem(props: NodeItemProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  // Ensure draggable is set on mount
  onMount(() => {
    if (containerRef) {
      containerRef.draggable = true;
    }
  });

  const handleDragStart = (e: DragEvent) => {
    if (!e.dataTransfer) return;
    setIsDragging(true);
    
    // Set the drag data
    e.dataTransfer.setData("application/json", JSON.stringify(props.node));
    e.dataTransfer.setData("text/plain", props.node.label);
    e.dataTransfer.effectAllowed = "copy";
    
    // Create a drag image from the current element
    const target = e.currentTarget as HTMLElement;
    if (target) {
      const rect = target.getBoundingClientRect();
      e.dataTransfer.setDragImage(target, rect.width / 2, rect.height / 2);
    }
    
    props.onDragStart?.(props.node, e);
  };

  const handleDragEnd = (e: DragEvent) => {
    setIsDragging(false);
    props.onDragEnd?.(props.node, e);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onQuickAdd?.(props.node);
    }
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "10px",
    padding: "8px 10px",
    "border-radius": "var(--jb-radius-sm)",
    cursor: "grab",
    background: isHovered() ? "var(--jb-surface-hover)" : "transparent",
    opacity: isDragging() ? "0.5" : "1",
    transition: "background var(--cortex-transition-fast)",
    "user-select": "none",
  });

  const iconContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    "border-radius": "var(--jb-radius-sm)",
    background: `${props.node.color}20`,
    color: props.node.color,
    "flex-shrink": "0",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
    overflow: "hidden",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "var(--jb-text-body-size)",
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "var(--jb-text-muted-size)",
    color: "var(--jb-text-muted-color)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "margin-top": "1px",
  };

  const addButtonStyle = (): JSX.CSSProperties => ({
    display: isHovered() ? "flex" : "none",
    "align-items": "center",
    "justify-content": "center",
    width: "22px",
    height: "22px",
    "border-radius": "var(--jb-radius-sm)",
    background: "var(--jb-btn-primary-bg)",
    color: "var(--jb-btn-primary-color)",
    border: "none",
    cursor: "pointer",
    "flex-shrink": "0",
    transition: "filter var(--cortex-transition-fast)",
  });

  return (
    <div
      ref={containerRef}
      style={containerStyle()}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Add ${props.node.label} node`}
    >
      <div style={iconContainerStyle}>
        <Icon name={props.node.icon} size={16} />
      </div>
      <div style={contentStyle}>
        <div style={labelStyle}>{props.node.label}</div>
        <div style={descriptionStyle}>{props.node.description}</div>
      </div>
      <button
        style={addButtonStyle()}
        onClick={(e) => {
          e.stopPropagation();
          props.onQuickAdd?.(props.node);
        }}
        title={`Quick add ${props.node.label}`}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = "brightness(1.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "brightness(1)";
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  );
}

// =============================================================================
// NODE PALETTE COMPONENT
// =============================================================================

export function NodePalette(props: NodePaletteProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [collapsedCategories, setCollapsedCategories] = createSignal<Set<NodeCategory>>(new Set());

  // Filter nodes based on search query
  const filteredNodes = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return NODE_DEFINITIONS;

    return NODE_DEFINITIONS.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query)
    );
  });

  // Group nodes by category
  const nodesByCategory = createMemo(() => {
    const groups: Record<NodeCategory, NodeDefinition[]> = {
      triggers: [],
      agents: [],
      actions: [],
      logic: [],
      communication: [],
      utilities: [],
      typescript: [],
    };

    for (const node of filteredNodes()) {
      groups[node.category].push(node);
    }

    return groups;
  });

  const toggleCategory = (category: NodeCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    overflow: "hidden",
    ...props.style,
  };

  const searchStyle: JSX.CSSProperties = {
    padding: "0 12px 12px",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
    padding: "0 0 12px",
  };

  const categoryHeaderStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 12px",
    cursor: "pointer",
    "user-select": "none",
  };

  const categoryLabelStyle: JSX.CSSProperties = {
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--jb-text-header-color)",
  };

  const categoryCountStyle: JSX.CSSProperties = {
    "font-size": "10px",
    color: "var(--jb-text-muted-color)",
    background: "var(--jb-surface-active)",
    padding: "1px 6px",
    "border-radius": "var(--jb-radius-sm)",
  };

  const emptyStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    padding: "32px 16px",
    color: "var(--jb-text-muted-color)",
    "text-align": "center",
  };

  return (
    <div style={containerStyle}>
      {/* Search */}
      <div style={searchStyle}>
        <Input
          placeholder="Search nodes..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M10.5 9.5L13 12l-1 1-2.5-2.5a5.5 5.5 0 1 1 1-1zM6 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </svg>
          }
          style={{ background: "var(--jb-canvas)" }}
        />
      </div>

      {/* Content */}
      <div style={contentStyle}>
        <Show
          when={filteredNodes().length > 0}
          fallback={
            <div style={emptyStyle}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" style={{ opacity: 0.4, "margin-bottom": "8px" }}>
                <path d="M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26zm0 24a11 11 0 1 1 0-22 11 11 0 0 1 0 22z" />
                <path d="M16 8v8h6v2h-8V8h2z" />
              </svg>
              <span>No nodes found</span>
              <span style={{ "font-size": "12px", "margin-top": "4px" }}>
                Try a different search term
              </span>
            </div>
          }
        >
          <For each={Object.entries(nodesByCategory()) as [NodeCategory, NodeDefinition[]][]}>
            {([category, nodes]) => (
              <Show when={nodes.length > 0}>
                <div>
                  {/* Category Header */}
                  <div
                    style={categoryHeaderStyle}
                    onClick={() => toggleCategory(category)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleCategory(category);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-expanded={!collapsedCategories().has(category)}
                  >
                    <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="currentColor"
                        style={{
                          transform: collapsedCategories().has(category) ? "rotate(-90deg)" : "rotate(0deg)",
                          transition: "transform var(--cortex-transition-fast)",
                          color: "var(--jb-icon-color-default)",
                        }}
                      >
                        <path d="M2 3l3 3.5L8 3v1L5 7.5 2 4V3z" />
                      </svg>
                      <span style={categoryLabelStyle}>{CATEGORY_INFO[category].label}</span>
                    </div>
                    <span style={categoryCountStyle}>{nodes.length}</span>
                  </div>

                  {/* Category Content */}
                  <Show when={!collapsedCategories().has(category)}>
                    <div style={{ padding: "0 4px" }}>
                      <For each={nodes}>
                        {(node) => (
                          <NodeItem
                            node={node}
                            onDragStart={props.onDragStart}
                            onDragEnd={props.onDragEnd}
                            onQuickAdd={props.onQuickAdd}
                          />
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

export default NodePalette;


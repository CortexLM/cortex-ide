/**
 * =============================================================================
 * AGENT FACTORY PANELS - Public Exports
 * =============================================================================
 * 
 * This module exports all panel components for the Agent Factory visual
 * workflow builder. These panels provide the UI for node configuration,
 * execution monitoring, audit logging, and approval management.
 * 
 * =============================================================================
 */

// Node Palette - Node library for drag-and-drop
export { NodePalette } from "./NodePalette";
export type {
  NodePaletteProps,
  NodeDefinition,
  NodeCategory,
} from "./NodePalette";

// Inspector - Node configuration panel
export { Inspector } from "./Inspector";
export type {
  InspectorProps,
  FactoryNode,
  FactoryNodeType,
  ValidationError,
} from "./Inspector";

// Console Panel - Execution logs
export { ConsolePanel } from "./ConsolePanel";
export type {
  ConsolePanelProps,
  LogEntry,
  LogLevel,
} from "./ConsolePanel";

// Live Monitor - Agent monitoring
export { LiveMonitor } from "./LiveMonitor";
export type {
  LiveMonitorProps,
  ActiveAgent,
  AgentStatus,
  AgentStep,
} from "./LiveMonitor";

// Audit Log - Audit history
export { AuditLog } from "./AuditLog";
export type {
  AuditLogProps,
  AuditEntry,
  AuditDecision,
  ActionType,
  RiskLevel as AuditRiskLevel,
} from "./AuditLog";

// Approvals Panel - Pending approvals
export { ApprovalsPanel } from "./ApprovalsPanel";
export type {
  ApprovalsPanelProps,
  ApprovalRequest,
  RiskLevel,
} from "./ApprovalsPanel";

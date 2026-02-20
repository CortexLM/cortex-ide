/**
 * =============================================================================
 * AGENT FACTORY - Main Export Index
 * =============================================================================
 *
 * This module exports all components, types, and hooks for the Agent Factory
 * visual workflow builder. The Agent Factory provides a node-based canvas
 * for designing, configuring, and monitoring AI agent workflows.
 *
 * @module components/factory
 *
 * @example
 * // Import main component
 * import { AgentFactory } from '@/components/factory';
 *
 * // Import specific components
 * import { FactoryCanvas, NodePalette, Inspector } from '@/components/factory';
 *
 * // Import types
 * import type { CanvasNode, FactoryNode, NodeType } from '@/components/factory';
 *
 * // Import hooks
 * import { useWorkflow, useExecution } from '@/components/factory';
 *
 * =============================================================================
 */

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export { AgentFactory, type AgentFactoryProps } from "./AgentFactory";

// =============================================================================
// CANVAS COMPONENTS
// =============================================================================

export {
  // Main canvas
  FactoryCanvas,
  default as FactoryCanvasDefault,
  // Background/grid
  CanvasBackground,
  // Toolbar
  CanvasToolbar,
  // Connection/edge rendering
  ConnectionLine,
  TempConnectionLine,
  // Selection box for multi-select
  SelectionBox,
  isNodeInSelection,
  // Minimap overview
  MiniMap,
} from "./canvas";

export type {
  // Canvas types
  FactoryCanvasProps,
  CanvasNode,
  CanvasPort,
  CanvasEdge,
  CanvasViewport,
  // Background types
  CanvasBackgroundProps,
  GridPattern,
  // Toolbar types
  CanvasToolbarProps,
  // Connection types
  ConnectionLineProps,
  TempConnectionLineProps,
  EdgeType,
  EdgeLabel,
  // Selection types
  SelectionBoxProps,
  SelectionBoxBounds,
  // Minimap types
  MiniMapProps,
  MiniMapNode,
  MiniMapViewport,
} from "./canvas";

// =============================================================================
// NODE COMPONENTS
// =============================================================================

export {
  // Base node
  BaseNodeContainer,
  PORT_COLORS,
  // Port components
  NodePort,
  PortRow,
  PortGroup,
  // Specialized nodes
  AgentNode,
  TriggerNode,
  ActionNode,
  LogicNode,
  SupervisorNode,
  MessageNode,
  // Node utilities
  getNodeComponent,
  getNodeDefaults,
  getNodesByCategory,
  getNodesMetadata,
  canConnect,
  generateNodeId,
  // Node metadata
  NODE_METADATA,
  NODE_CATEGORIES,
} from "./nodes";

export type {
  // Base node types
  NodeStatus,
  NodePosition,
  NodeSize,
  NodePort as NodePortType,
  PortDataType,
  NodeValidationError,
  BaseNodeData,
  BaseNodeProps,
  BaseNodeContainerProps,
  // Port types
  NodePortProps,
  PortRowProps,
  PortGroupProps,
  // Node-specific types
  AgentNodeData,
  AgentNodeProps,
  TriggerType,
  TriggerNodeData,
  TriggerNodeProps,
  ActionType,
  ActionNodeData,
  ActionNodeProps,
  LogicType,
  LogicNodeData,
  LogicNodeProps,
  InterceptMode,
  WatchedAgent,
  SupervisorNodeData,
  SupervisorNodeProps,
  MessageDirection,
  MessageNodeData,
  MessageNodeProps,
  // Registry types
  NodeType,
  NodeTypeMetadata,
  NodeCategory,
  NodeDefaults,
} from "./nodes";

// =============================================================================
// PANEL COMPONENTS
// =============================================================================

export {
  // Node palette for drag-and-drop
  NodePalette,
  // Inspector for node configuration
  Inspector,
  // Console for execution logs
  ConsolePanel,
  // Live monitor for agent activity
  LiveMonitor,
  // Audit log history
  AuditLog,
  // Approvals panel
  ApprovalsPanel,
} from "./panels";

// =============================================================================
// BUILDER COMPONENTS
// =============================================================================

export { AgentBuilder, WorkflowSettings } from "./builders";
export type {
  AgentBuilderProps,
  AgentConfig as BuilderAgentConfig,
  AgentMode,
  ToolPermission,
  ToolConfig,
  WorkflowSettingsProps,
  VariableType,
  InterceptionMode,
  InterceptionTarget,
  HookAction,
  WorkflowVariable as BuilderWorkflowVariable,
  InterceptionSettings,
  ExecutionSettings,
  HookConfig,
  WorkflowConfig as WorkflowSettingsConfig,
} from "./builders";

// =============================================================================
// DIALOG COMPONENTS
// =============================================================================

export {
  ImportExportDialog,
  TemplateGallery,
} from "./dialogs";

export type {
  ImportExportDialogProps,
  ExportFormat,
  ConflictResolution,
  ImportExportHistoryEntry,
  WorkflowPreview,
  TemplateGalleryProps,
  WorkflowTemplate,
  TemplateCategory,
  TemplateComplexity,
} from "./dialogs";

export type {
  // Node palette types
  NodePaletteProps,
  NodeDefinition,
  NodeCategory as PaletteNodeCategory,
  // Inspector types
  InspectorProps,
  FactoryNode,
  FactoryNodeType,
  ValidationError,
  // Console types
  ConsolePanelProps,
  LogEntry,
  LogLevel,
  // Live monitor types
  LiveMonitorProps,
  ActiveAgent,
  AgentStatus,
  AgentStep,
  // Audit log types
  AuditLogProps,
  AuditEntry as AuditLogEntry,
  AuditDecision,
  ActionType as AuditActionType,
  AuditRiskLevel,
  // Approvals types
  ApprovalsPanelProps,
  ApprovalRequest as PanelApprovalRequest,
  RiskLevel,
} from "./panels";

// =============================================================================
// HOOKS (Re-exported from @/hooks/factory)
// =============================================================================

export {
  // Workflow management
  useWorkflow,
  // Execution tracking
  useExecution,
  // Approvals management
  useApprovals,
  getApprovalStatusIcon,
  getApprovalStatusColor,
  getApprovalActionLabel,
  isApprovalExpiringSoon,
  getApprovalTimeRemaining,
  formatApprovalRequest,
  // Audit log
  useAudit,
  formatAuditEntry,
  groupAuditEntriesByDate,
} from "@/hooks/factory";

export type {
  // Workflow types
  UseWorkflowOptions,
  UseWorkflowReturn,
  // Execution types
  ExecutionProgress,
  UseExecutionOptions,
  UseExecutionReturn,
  // Approval types
  ApprovalFilter,
  UseApprovalsOptions,
  UseApprovalsReturn,
  // Audit types
  AuditStats,
  UseAuditOptions,
  UseAuditReturn,
} from "@/hooks/factory";

// =============================================================================
// SERVICES (Re-exported from @/services/factory)
// =============================================================================

export {
  // Workflow CRUD
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  exportWorkflow,
  importWorkflow,
  // Execution Control
  startExecution,
  stopExecution,
  pauseExecution,
  resumeExecution,
  getExecution,
  // Agent Management
  listAgents,
  getAgentState,
  createAgent,
  updateAgent,
  deleteAgent,
  // Approval Operations
  listApprovals,
  approveAction,
  denyAction,
  modifyAction,
  // Audit Log
  getAuditLog,
  getAuditEntry,
  exportAuditLog,
  // Event subscriptions
  subscribeToAllEvents,
  subscribeToWorkflows,
  subscribeToExecutions,
  subscribeToNodes,
  subscribeToApprovals,
  subscribeToAgents,
  trackExecution,
  subscribeToPendingApprovals,
  isExecutionComplete,
  isErrorEvent,
} from "@/services/factory";

export type {
  // Event handler types
  FactoryEventHandler,
  EventFilter,
  Subscription,
} from "@/services/factory";

// =============================================================================
// TYPES (Re-exported from @/types/factory)
// =============================================================================

export type {
  // Core Identifiers
  WorkflowId,
  NodeId,
  EdgeId,
  ExecutionId,
  AgentId,
  ApprovalId,
  AuditId,
  // Node Data Types
  NodeDataBase,
  TriggerNodeData as WorkflowTriggerNodeData,
  AgentNodeData as WorkflowAgentNodeData,
  ToolNodeData,
  ConditionNodeData,
  LoopNodeData,
  ParallelNodeData,
  MergeNodeData,
  DelayNodeData,
  HumanApprovalNodeData,
  SubworkflowNodeData,
  TransformNodeData,
  OutputNodeData,
  NodeData,
  // Workflow Definition
  Position,
  WorkflowNode,
  HandleType,
  WorkflowEdge,
  WorkflowVariable,
  Workflow,
  WorkflowSettings as WorkflowSettingsType,
  // Agent Configuration
  AgentConfig,
  // Execution Types
  ExecutionStatus,
  NodeExecutionStatus,
  NodeExecution,
  WorkflowExecution,
  // Approval Types
  ApprovalAction,
  ApprovalStatus,
  ApprovalRequest,
  // Audit Types
  AuditEventType,
  AuditSeverity,
  AuditEntry,
  AuditFilter as WorkflowAuditFilter,
  AuditPage,
  // Event Types
  FactoryEventType,
  FactoryEvent,
  // API Response Types
  ListWorkflowsResponse,
  ListExecutionsResponse,
  ListAgentsResponse,
  ListApprovalsResponse,
  // Undo/Redo Types
  WorkflowMutationType,
  WorkflowMutation,
} from "@/types/factory";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default canvas viewport settings */
export const DEFAULT_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: 1,
  minZoom: 0.1,
  maxZoom: 4,
} as const;

/** Default grid settings */
export const DEFAULT_GRID = {
  size: 20,
  snapToGrid: true,
  showGrid: true,
  pattern: "dots" as const,
} as const;

/** Keyboard shortcuts for Factory */
export const FACTORY_SHORTCUTS = {
  // Canvas navigation
  panCanvas: "Space + Drag",
  zoomIn: "Ctrl+=",
  zoomOut: "Ctrl+-",
  resetZoom: "Ctrl+0",
  fitView: "Ctrl+1",
  // Selection
  selectAll: "Ctrl+A",
  deselectAll: "Escape",
  deleteSelected: "Delete",
  // Editing
  undo: "Ctrl+Z",
  redo: "Ctrl+Shift+Z",
  copy: "Ctrl+C",
  paste: "Ctrl+V",
  cut: "Ctrl+X",
  duplicate: "Ctrl+D",
  // Workflow
  save: "Ctrl+S",
  run: "F5",
  stop: "Shift+F5",
  // Panels
  togglePalette: "Ctrl+Shift+P",
  toggleInspector: "Ctrl+Shift+I",
  toggleConsole: "Ctrl+`",
  // Quick actions
  quickAdd: "Ctrl+Space",
  search: "Ctrl+F",
} as const;

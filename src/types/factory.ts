/**
 * Factory Types
 * Type definitions for the AI Agent Factory system
 * 
 * Re-exports types from factoryService.ts that match Rust backend,
 * plus additional UI-specific types.
 */

// Re-export all types from factoryService (matching Rust backend)
export type {
  // Core types
  Workflow,
  WorkflowSettings,
  WorkflowNode,
  NodePort,
  NodeType,
  TriggerType,
  ActionType,
  WorkflowEdge,
  InterceptionConfig,
  InterceptionRule,
  RiskLevel,
  DecisionAction,
  TimeoutAction,
  InterceptionActionType,
  WorkflowExport,
  
  // Execution types
  ExecutionState,
  ExecutionStatus,
  NodeExecutionResult,
  
  // Agent types
  AgentRuntimeState,
  AgentStatus,
  AgentConfig,
  StepExecution,
  StepType,
  StepStatus,
  
  // Approval types
  PendingApproval,
  ApprovalStatus,
  SupervisorDecision,
  
  // Audit types
  AuditEntry,
  AuditEventType,
  AuditResult,
  AuditFilter,
} from "../services/factory/factoryService";

// Re-export event types
export type {
  FactoryEvent,
  FactoryEventType,
  WorkflowCreatedEvent,
  WorkflowUpdatedEvent,
  WorkflowDeletedEvent,
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  ExecutionPausedEvent,
  ExecutionResumedEvent,
  ExecutionStoppedEvent,
  NodeStartedEvent,
  NodeCompletedEvent,
  NodeFailedEvent,
  AgentSpawnedEvent,
  AgentUpdatedEvent,
  AgentRemovedEvent,
  ApprovalRequestedEvent,
  ApprovalGrantedEvent,
  ApprovalDeniedEvent,
  ApprovalModifiedEvent,
} from "../services/factory/eventService";

// ============================================================================
// Type Aliases (for convenience)
// ============================================================================

/** Unique identifier for a workflow */
export type WorkflowId = string;

/** Unique identifier for a node within a workflow */
export type NodeId = string;

/** Unique identifier for an edge connecting nodes */
export type EdgeId = string;

/** Unique identifier for a workflow execution */
export type ExecutionId = string;

/** Unique identifier for an agent instance */
export type AgentId = string;

/** Unique identifier for an approval request */
export type ApprovalId = string;

/** Unique identifier for an audit entry */
export type AuditId = string;

// ============================================================================
// UI-Specific Types (not in backend)
// ============================================================================

/** Position in the workflow canvas */
export interface Position {
  x: number;
  y: number;
}

/** Handle type for connections */
export type HandleType = "source" | "target";

/** Workflow variable definition (UI representation) */
export interface WorkflowVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: "string" | "number" | "boolean" | "object" | "array" | "any";
  /** Default value */
  defaultValue?: unknown;
  /** Whether required as input */
  required?: boolean;
  /** Description */
  description?: string;
}

/** Node execution status (simplified for UI) */
export type NodeExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "waiting";

/** Single node execution record (UI representation) */
export interface NodeExecution {
  /** Node ID */
  nodeId: NodeId;
  /** Execution status */
  status: NodeExecutionStatus;
  /** Start time */
  startedAt?: number;
  /** End time */
  completedAt?: number;
  /** Input data */
  input?: Record<string, unknown>;
  /** Output data */
  output?: Record<string, unknown>;
  /** Error if failed */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  /** Retry count */
  retryCount?: number;
  /** Duration in ms */
  durationMs?: number;
}

/** Complete workflow execution (UI representation) */
export interface WorkflowExecution {
  /** Execution ID */
  id: ExecutionId;
  /** Workflow ID */
  workflowId: WorkflowId;
  /** Workflow version at execution time */
  workflowVersion?: string;
  /** Overall status */
  status: import("../services/factory/factoryService").ExecutionStatus;
  /** Input parameters */
  input?: Record<string, unknown>;
  /** Output values */
  output?: Record<string, unknown>;
  /** Per-node execution records */
  nodeExecutions?: Record<NodeId, NodeExecution>;
  /** Current node being executed */
  currentNodeId?: NodeId;
  /** Start time */
  startedAt: number;
  /** End time */
  completedAt?: number;
  /** Error if failed */
  error?: string;
  /** Execution variables (runtime state) */
  variables?: Record<string, unknown>;
  /** Triggered by */
  triggeredBy?: string;
  /** Parent execution ID (for subworkflows) */
  parentExecutionId?: ExecutionId;
}

/** Audit severity level */
export type AuditSeverity = "info" | "warning" | "error" | "critical";

/** Paginated audit result */
export interface AuditPage {
  /** Audit entries */
  entries: import("../services/factory/factoryService").AuditEntry[];
  /** Total count (for pagination) */
  totalCount: number;
  /** Current page */
  page: number;
  /** Page size */
  pageSize: number;
  /** Has more pages */
  hasMore: boolean;
}

// ============================================================================
// Approval Action Types (UI)
// ============================================================================

/** Approval action type (UI representation) */
export type ApprovalAction = "approve" | "deny" | "modify" | "skip" | "escalate";

/** Approval request (UI representation) */
export interface ApprovalRequest {
  /** Approval ID */
  id: ApprovalId;
  /** Execution ID */
  executionId: ExecutionId;
  /** Node ID requiring approval */
  nodeId: NodeId;
  /** Workflow ID */
  workflowId?: WorkflowId;
  /** Approval prompt/description */
  prompt?: string;
  /** Description of action */
  description?: string;
  /** Data to review */
  reviewData?: Record<string, unknown>;
  /** Allowed actions */
  allowedActions?: ApprovalAction[];
  /** Current status */
  status: import("../services/factory/factoryService").ApprovalStatus;
  /** Requested at */
  requestedAt: number;
  /** Response at */
  respondedAt?: number;
  /** Responded by user ID */
  respondedBy?: string;
  /** Selected action */
  action?: ApprovalAction;
  /** Comments/reason */
  comments?: string;
  /** Modified data (if action is modify) */
  modifiedData?: Record<string, unknown>;
  /** Expiration time */
  expiresAt?: number;
  /** Required approvers */
  requiredApprovers?: string[];
  /** Risk level */
  riskLevel?: import("../services/factory/factoryService").RiskLevel;
  /** Action type */
  actionType?: import("../services/factory/factoryService").InterceptionActionType;
  /** Action params */
  actionParams?: unknown;
}

// ============================================================================
// API Response Types
// ============================================================================

/** List workflows response */
export interface ListWorkflowsResponse {
  workflows: import("../services/factory/factoryService").Workflow[];
  totalCount: number;
}

/** List executions response */
export interface ListExecutionsResponse {
  executions: WorkflowExecution[];
  totalCount: number;
}

/** List agents response */
export interface ListAgentsResponse {
  agents: import("../services/factory/factoryService").AgentRuntimeState[];
  totalCount: number;
}

/** List approvals response */
export interface ListApprovalsResponse {
  approvals: ApprovalRequest[];
  totalCount: number;
}

// ============================================================================
// Undo/Redo Types
// ============================================================================

/** Types of workflow mutations for undo/redo */
export type WorkflowMutationType =
  | "add_node"
  | "remove_node"
  | "update_node"
  | "move_node"
  | "add_edge"
  | "remove_edge"
  | "update_edge"
  | "bulk_update"
  | "update_settings"
  | "update_inputs"
  | "update_outputs";

/** Workflow mutation for undo/redo history */
export interface WorkflowMutation {
  /** Mutation type */
  type: WorkflowMutationType;
  /** Timestamp */
  timestamp: number;
  /** Data before mutation */
  before: unknown;
  /** Data after mutation */
  after: unknown;
  /** Description for UI */
  description: string;
}

// ============================================================================
// Node Data Types (for UI node configurations)
// ============================================================================

/** Base node data shared by all node types */
export interface NodeDataBase {
  /** Display label for the node */
  label: string;
  /** Optional description */
  description?: string;
  /** Whether the node is disabled */
  disabled?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/** Trigger node data */
export interface TriggerNodeData extends NodeDataBase {
  type: "trigger";
  triggerType: "manual" | "schedule" | "webhook" | "event" | "file_watch";
  schedule?: string;
  webhookPath?: string;
  eventName?: string;
  filePatterns?: string[];
}

/** Agent node data */
export interface AgentNodeData extends NodeDataBase {
  type: "agent";
  agentConfig: string | import("../services/factory/factoryService").AgentConfig;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  inputMapping?: Record<string, string>;
  outputVariable?: string;
}

/** Tool node data */
export interface ToolNodeData extends NodeDataBase {
  type: "tool";
  toolId: string;
  arguments: Record<string, unknown>;
  retry?: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier?: number;
  };
}

/** Condition node data */
export interface ConditionNodeData extends NodeDataBase {
  type: "condition";
  expression: string;
  branches: {
    true: string;
    false: string;
  };
}

/** Loop node data */
export interface LoopNodeData extends NodeDataBase {
  type: "loop";
  iterateOver: string;
  loopVariable: string;
  maxIterations?: number;
  parallel?: boolean;
}

/** Parallel node data */
export interface ParallelNodeData extends NodeDataBase {
  type: "parallel";
  branches: string[];
  waitMode: "all" | "any" | "first_success";
}

/** Merge node data */
export interface MergeNodeData extends NodeDataBase {
  type: "merge";
  mergeStrategy: "array" | "object" | "first" | "custom";
  customMerge?: string;
}

/** Delay node data */
export interface DelayNodeData extends NodeDataBase {
  type: "delay";
  delayMs: number;
  untilTime?: string;
}

/** Human approval node data */
export interface HumanApprovalNodeData extends NodeDataBase {
  type: "human_approval";
  approvalPrompt: string;
  actions: ApprovalAction[];
  timeoutMs?: number;
  timeoutAction?: "approve" | "deny" | "skip";
  requiredApprovers?: string[];
}

/** Subworkflow node data */
export interface SubworkflowNodeData extends NodeDataBase {
  type: "subworkflow";
  workflowId: WorkflowId;
  inputMapping?: Record<string, string>;
  waitForCompletion: boolean;
}

/** Transform node data */
export interface TransformNodeData extends NodeDataBase {
  type: "transform";
  transform: string;
  inputs: string[];
  outputVariable: string;
}

/** Output node data */
export interface OutputNodeData extends NodeDataBase {
  type: "output";
  outputName: string;
  value: string;
}

/** Union of all node data types */
export type NodeData =
  | TriggerNodeData
  | AgentNodeData
  | ToolNodeData
  | ConditionNodeData
  | LoopNodeData
  | ParallelNodeData
  | MergeNodeData
  | DelayNodeData
  | HumanApprovalNodeData
  | SubworkflowNodeData
  | TransformNodeData
  | OutputNodeData;

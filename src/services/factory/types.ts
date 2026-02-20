/**
 * Agent Factory System Types
 *
 * Complete TypeScript types and interfaces for the visual workflow builder,
 * agent orchestration, and execution management system.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Types of nodes available in the workflow builder
 */
export enum NodeType {
  /** Entry point that initiates workflow execution */
  TRIGGER = 'trigger',
  /** AI agent that processes tasks autonomously */
  AGENT = 'agent',
  /** Discrete action like file operations or HTTP requests */
  ACTION = 'action',
  /** Conditional branching based on expressions */
  CONDITION = 'condition',
  /** Multi-way branching with multiple outputs */
  SWITCH = 'switch',
  /** Iterative execution over collections */
  LOOP = 'loop',
  /** Concurrent execution of multiple branches */
  PARALLEL = 'parallel',
  /** Synchronization point for parallel branches */
  MERGE = 'merge',
  /** Data transformation and mapping */
  TRANSFORM = 'transform',
  /** Human-in-the-loop supervisor node */
  SUPERVISOR = 'supervisor',
  /** Send messages or notifications */
  MESSAGE = 'message',
  /** Nested workflow execution */
  SUBWORKFLOW = 'subworkflow',
}

/**
 * Supervisor decision actions for agent interception
 */
export enum DecisionAction {
  /** Allow the action to proceed as-is */
  ALLOW = 'allow',
  /** Deny the action completely */
  DENY = 'deny',
  /** Modify the action before execution */
  MODIFY = 'modify',
  /** Pause execution and wait for human input */
  PAUSE = 'pause',
  /** Stop the entire workflow */
  STOP = 'stop',
  /** Delegate to another agent or workflow */
  DELEGATE = 'delegate',
}

/**
 * Risk levels for agent actions
 */
export enum RiskLevel {
  /** Safe operations with no side effects */
  LOW = 'low',
  /** Operations with limited, reversible effects */
  MEDIUM = 'medium',
  /** Operations that may have significant effects */
  HIGH = 'high',
  /** Dangerous operations requiring approval */
  CRITICAL = 'critical',
}

/**
 * Status of an agent during execution
 */
export enum AgentStatus {
  /** Agent is ready but not yet started */
  IDLE = 'idle',
  /** Agent is initializing */
  INITIALIZING = 'initializing',
  /** Agent is actively processing */
  RUNNING = 'running',
  /** Agent is waiting for input or approval */
  WAITING = 'waiting',
  /** Agent is paused by supervisor */
  PAUSED = 'paused',
  /** Agent completed successfully */
  COMPLETED = 'completed',
  /** Agent encountered an error */
  ERROR = 'error',
  /** Agent was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Status of a workflow execution
 */
export enum ExecutionStatus {
  /** Execution is queued but not started */
  PENDING = 'pending',
  /** Execution is actively running */
  RUNNING = 'running',
  /** Execution is paused (awaiting approval, etc.) */
  PAUSED = 'paused',
  /** Execution completed successfully */
  COMPLETED = 'completed',
  /** Execution failed with errors */
  FAILED = 'failed',
  /** Execution was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Log levels for console output
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Export formats for audit logs
 */
export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  PDF = 'pdf',
}

// =============================================================================
// WORKFLOW TYPES
// =============================================================================

/**
 * Connection port on a workflow node
 */
export interface Port {
  /** Unique identifier for the port */
  id: string;
  /** Display label for the port */
  label: string;
  /** Port direction */
  type: 'input' | 'output';
  /** Data type accepted/emitted by this port */
  dataType?: string;
  /** Whether this port is required for execution */
  required?: boolean;
  /** Maximum number of connections allowed */
  maxConnections?: number;
}

/**
 * Edge connecting two nodes in a workflow
 */
export interface WorkflowEdge {
  /** Unique identifier for the edge */
  id: string;
  /** Source node ID */
  source: string;
  /** Source port ID */
  sourceHandle: string;
  /** Target node ID */
  target: string;
  /** Target port ID */
  targetHandle: string;
  /** Optional label for the edge */
  label?: string;
  /** Condition expression for conditional edges */
  condition?: string;
  /** Visual styling for the edge */
  style?: {
    stroke?: string;
    strokeWidth?: number;
    animated?: boolean;
  };
}

/**
 * Base interface for all node data types
 */
export interface BaseNodeData {
  /** Display label for the node */
  label: string;
  /** Description of what this node does */
  description?: string;
  /** Whether this node is disabled */
  disabled?: boolean;
  /** Input ports for this node */
  inputs?: Port[];
  /** Output ports for this node */
  outputs?: Port[];
  /** Error handling configuration */
  errorHandling?: {
    /** Retry count on failure */
    retryCount?: number;
    /** Delay between retries in ms */
    retryDelay?: number;
    /** Continue workflow on error */
    continueOnError?: boolean;
    /** Fallback node ID */
    fallbackNode?: string;
  };
  /** Timeout in milliseconds */
  timeout?: number;
}

// =============================================================================
// TRIGGER NODE DATA
// =============================================================================

/** Trigger when a file is created */
export interface FileCreatedTriggerData extends BaseNodeData {
  triggerType: 'file_created';
  config: {
    /** Directory or file pattern to watch */
    path: string;
    /** Glob patterns to include */
    patterns?: string[];
    /** Glob patterns to exclude */
    exclude?: string[];
    /** Watch recursively */
    recursive?: boolean;
  };
}

/** Trigger when a file is edited */
export interface FileEditedTriggerData extends BaseNodeData {
  triggerType: 'file_edited';
  config: {
    /** Directory or file pattern to watch */
    path: string;
    /** Glob patterns to include */
    patterns?: string[];
    /** Glob patterns to exclude */
    exclude?: string[];
    /** Watch recursively */
    recursive?: boolean;
    /** Debounce time in ms */
    debounce?: number;
  };
}

/** Trigger when a file is deleted */
export interface FileDeletedTriggerData extends BaseNodeData {
  triggerType: 'file_deleted';
  config: {
    /** Directory or file pattern to watch */
    path: string;
    /** Glob patterns to include */
    patterns?: string[];
    /** Glob patterns to exclude */
    exclude?: string[];
    /** Watch recursively */
    recursive?: boolean;
  };
}

/** Trigger on a schedule (cron expression) */
export interface ScheduleTriggerData extends BaseNodeData {
  triggerType: 'schedule';
  config: {
    /** Cron expression */
    cron: string;
    /** Timezone for the schedule */
    timezone?: string;
    /** Whether to run immediately on workflow start */
    runImmediately?: boolean;
  };
}

/** Trigger on git commit */
export interface GitCommitTriggerData extends BaseNodeData {
  triggerType: 'git_commit';
  config: {
    /** Repository path */
    repository: string;
    /** Branch patterns to watch */
    branches?: string[];
    /** File patterns to watch */
    paths?: string[];
    /** Author patterns to match */
    authors?: string[];
  };
}

/** Trigger on git push */
export interface GitPushTriggerData extends BaseNodeData {
  triggerType: 'git_push';
  config: {
    /** Repository path */
    repository: string;
    /** Branch patterns to watch */
    branches?: string[];
    /** Remote name */
    remote?: string;
  };
}

/** Manual trigger (user-initiated) */
export interface ManualTriggerData extends BaseNodeData {
  triggerType: 'manual';
  config: {
    /** Input schema for manual trigger */
    inputSchema?: Record<string, unknown>;
    /** Form field definitions */
    formFields?: Array<{
      name: string;
      type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'file';
      label: string;
      required?: boolean;
      defaultValue?: unknown;
      options?: Array<{ label: string; value: unknown }>;
    }>;
  };
}

/** Webhook trigger (HTTP endpoint) */
export interface WebhookTriggerData extends BaseNodeData {
  triggerType: 'webhook';
  config: {
    /** HTTP method to accept */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Path for the webhook endpoint */
    path: string;
    /** Secret for webhook validation */
    secret?: string;
    /** Headers to require */
    requiredHeaders?: Record<string, string>;
    /** Request body schema */
    bodySchema?: Record<string, unknown>;
  };
}

/** Trigger when another agent completes */
export interface AgentCompleteTriggerData extends BaseNodeData {
  triggerType: 'agent_complete';
  config: {
    /** Agent ID to watch */
    agentId: string;
    /** Only trigger on specific status */
    status?: AgentStatus[];
    /** Filter by output data */
    outputFilter?: Record<string, unknown>;
  };
}

/** Trigger on workflow error */
export interface OnErrorTriggerData extends BaseNodeData {
  triggerType: 'on_error';
  config: {
    /** Error types to catch */
    errorTypes?: string[];
    /** Node IDs to watch for errors */
    nodeIds?: string[];
    /** Whether to catch all errors in workflow */
    catchAll?: boolean;
  };
}

/**
 * Union type for all trigger node data
 */
export type TriggerNodeData =
  | FileCreatedTriggerData
  | FileEditedTriggerData
  | FileDeletedTriggerData
  | ScheduleTriggerData
  | GitCommitTriggerData
  | GitPushTriggerData
  | ManualTriggerData
  | WebhookTriggerData
  | AgentCompleteTriggerData
  | OnErrorTriggerData;

// =============================================================================
// AGENT NODE DATA
// =============================================================================

/**
 * Configuration for an AI agent node
 */
export interface AgentNodeData extends BaseNodeData {
  /** Reference to agent configuration */
  agentId: string;
  /** Override agent model for this node */
  model?: string;
  /** Override system prompt */
  systemPrompt?: string;
  /** Available tools for this agent */
  tools?: string[];
  /** Maximum iterations allowed */
  maxIterations?: number;
  /** Temperature override */
  temperature?: number;
  /** Context window size */
  contextSize?: number;
  /** Input mapping from workflow context */
  inputMapping?: Record<string, string>;
  /** Output mapping to workflow context */
  outputMapping?: Record<string, string>;
  /** Interception configuration */
  interception?: InterceptionConfig;
  /** Memory configuration */
  memory?: {
    /** Enable conversation memory */
    enabled: boolean;
    /** Maximum messages to retain */
    maxMessages?: number;
    /** Persist memory across executions */
    persistent?: boolean;
  };
}

// =============================================================================
// ACTION NODE DATA
// =============================================================================

/** Run a shell command */
export interface RunCommandActionData extends BaseNodeData {
  actionType: 'run_command';
  config: {
    /** Command to execute */
    command: string;
    /** Arguments for the command */
    args?: string[];
    /** Working directory */
    cwd?: string;
    /** Environment variables */
    env?: Record<string, string>;
    /** Timeout in ms */
    timeout?: number;
    /** Shell to use */
    shell?: string;
  };
}

/** Read file contents */
export interface ReadFileActionData extends BaseNodeData {
  actionType: 'read_file';
  config: {
    /** File path to read */
    path: string;
    /** Encoding (default: utf-8) */
    encoding?: string;
    /** Read as binary */
    binary?: boolean;
    /** Line range to read */
    lineRange?: { start: number; end: number };
  };
}

/** Write file contents */
export interface WriteFileActionData extends BaseNodeData {
  actionType: 'write_file';
  config: {
    /** File path to write */
    path: string;
    /** Content to write (can use template variables) */
    content: string;
    /** Encoding (default: utf-8) */
    encoding?: string;
    /** Create directories if needed */
    createDirs?: boolean;
    /** Overwrite existing file */
    overwrite?: boolean;
    /** Append to existing file */
    append?: boolean;
  };
}

/** Make HTTP request */
export interface HttpRequestActionData extends BaseNodeData {
  actionType: 'http_request';
  config: {
    /** Request URL */
    url: string;
    /** HTTP method */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    /** Request headers */
    headers?: Record<string, string>;
    /** Request body */
    body?: unknown;
    /** Query parameters */
    params?: Record<string, string>;
    /** Request timeout in ms */
    timeout?: number;
    /** Follow redirects */
    followRedirects?: boolean;
    /** Expected response type */
    responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
    /** Authentication */
    auth?: {
      type: 'basic' | 'bearer' | 'api_key';
      credentials: Record<string, string>;
    };
  };
}

/** Send notification */
export interface SendNotificationActionData extends BaseNodeData {
  actionType: 'send_notification';
  config: {
    /** Notification channel */
    channel: 'desktop' | 'email' | 'slack' | 'webhook';
    /** Notification title */
    title: string;
    /** Notification message */
    message: string;
    /** Priority level */
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    /** Channel-specific options */
    channelConfig?: Record<string, unknown>;
  };
}

/** Git operations */
export interface GitOperationActionData extends BaseNodeData {
  actionType: 'git_operation';
  config: {
    /** Git operation to perform */
    operation:
      | 'clone'
      | 'pull'
      | 'push'
      | 'commit'
      | 'branch'
      | 'checkout'
      | 'merge'
      | 'stash'
      | 'status'
      | 'diff';
    /** Repository path */
    repository: string;
    /** Operation-specific parameters */
    params?: Record<string, unknown>;
  };
}

/** Transform data */
export interface TransformDataActionData extends BaseNodeData {
  actionType: 'transform_data';
  config: {
    /** Transformation type */
    transformType: 'jq' | 'jsonpath' | 'template' | 'javascript' | 'regex';
    /** Transformation expression */
    expression: string;
    /** Input data key */
    inputKey?: string;
    /** Output data key */
    outputKey?: string;
  };
}

/** Delay execution */
export interface DelayActionData extends BaseNodeData {
  actionType: 'delay';
  config: {
    /** Delay duration in ms */
    duration: number;
    /** Whether delay is interruptible */
    interruptible?: boolean;
  };
}

/** Log message */
export interface LogActionData extends BaseNodeData {
  actionType: 'log';
  config: {
    /** Log level */
    level: LogLevel;
    /** Log message (can use template variables) */
    message: string;
    /** Additional data to log */
    data?: Record<string, unknown>;
    /** Log destination */
    destination?: 'console' | 'file' | 'both';
    /** Log file path (if destination includes file) */
    filePath?: string;
  };
}

/**
 * Union type for all action node data
 */
export type ActionNodeData =
  | RunCommandActionData
  | ReadFileActionData
  | WriteFileActionData
  | HttpRequestActionData
  | SendNotificationActionData
  | GitOperationActionData
  | TransformDataActionData
  | DelayActionData
  | LogActionData;

// =============================================================================
// LOGIC NODE DATA
// =============================================================================

/** Condition node for branching */
export interface ConditionNodeData extends BaseNodeData {
  logicType: 'condition';
  config: {
    /** Condition expression */
    expression: string;
    /** Expression language */
    language: 'javascript' | 'jsonpath' | 'simple';
    /** True branch label */
    trueLabel?: string;
    /** False branch label */
    falseLabel?: string;
  };
}

/** Switch node for multi-way branching */
export interface SwitchNodeData extends BaseNodeData {
  logicType: 'switch';
  config: {
    /** Expression to evaluate */
    expression: string;
    /** Case definitions */
    cases: Array<{
      /** Case value to match */
      value: unknown;
      /** Case label */
      label: string;
      /** Output port ID */
      portId: string;
    }>;
    /** Default case port ID */
    defaultPort?: string;
  };
}

/** Loop node for iteration */
export interface LoopNodeData extends BaseNodeData {
  logicType: 'loop';
  config: {
    /** Loop type */
    loopType: 'foreach' | 'while' | 'times';
    /** Collection expression (for foreach) */
    collection?: string;
    /** Condition expression (for while) */
    condition?: string;
    /** Number of iterations (for times) */
    count?: number;
    /** Maximum iterations (safety limit) */
    maxIterations?: number;
    /** Loop variable name */
    variableName?: string;
    /** Index variable name */
    indexName?: string;
    /** Parallel execution of iterations */
    parallel?: boolean;
    /** Max concurrent iterations (if parallel) */
    concurrency?: number;
  };
}

/**
 * Union type for all logic node data
 */
export type LogicNodeData = ConditionNodeData | SwitchNodeData | LoopNodeData;

// =============================================================================
// SUPERVISOR NODE DATA
// =============================================================================

/**
 * Supervisor node for human-in-the-loop control
 */
export interface SupervisorNodeData extends BaseNodeData {
  /** Agents or nodes this supervisor monitors */
  monitoredNodes: string[];
  /** Interception rules */
  rules: InterceptionRule[];
  /** Default decision if no rules match */
  defaultDecision: DecisionAction;
  /** Approval timeout in ms */
  approvalTimeout?: number;
  /** Auto-approve low-risk actions */
  autoApproveLowRisk?: boolean;
  /** Escalation configuration */
  escalation?: {
    /** Enable escalation */
    enabled: boolean;
    /** Escalation timeout in ms */
    timeout: number;
    /** Escalation target (user, role, or workflow) */
    target: string;
  };
  /** Notification settings */
  notifications?: {
    /** Notify on pending approval */
    onPending: boolean;
    /** Notify on auto-approve */
    onAutoApprove: boolean;
    /** Notify on timeout */
    onTimeout: boolean;
    /** Notification channels */
    channels: string[];
  };
}

// =============================================================================
// MESSAGE NODE DATA
// =============================================================================

/**
 * Message node for sending messages/notifications
 */
export interface MessageNodeData extends BaseNodeData {
  /** Message target type */
  targetType: 'user' | 'agent' | 'channel' | 'workflow';
  /** Target identifier */
  target: string;
  /** Message template */
  template: string;
  /** Message format */
  format: 'text' | 'markdown' | 'html';
  /** Wait for response */
  waitForResponse?: boolean;
  /** Response timeout in ms */
  responseTimeout?: number;
  /** Response validation schema */
  responseSchema?: Record<string, unknown>;
  /** Attachments */
  attachments?: Array<{
    /** Attachment type */
    type: 'file' | 'image' | 'data';
    /** Source path or data key */
    source: string;
    /** Display name */
    name?: string;
  }>;
}

// =============================================================================
// PARALLEL AND MERGE NODE DATA
// =============================================================================

/**
 * Parallel node for concurrent execution
 */
export interface ParallelNodeData extends BaseNodeData {
  /** Maximum concurrent branches */
  maxConcurrency?: number;
  /** Fail fast on first error */
  failFast?: boolean;
  /** Branch definitions */
  branches: Array<{
    /** Branch ID */
    id: string;
    /** Branch label */
    label: string;
    /** Branch entry node ID */
    entryNode: string;
  }>;
}

/**
 * Merge node for synchronization
 */
export interface MergeNodeData extends BaseNodeData {
  /** Merge strategy */
  strategy: 'all' | 'any' | 'race' | 'count';
  /** Count for 'count' strategy */
  count?: number;
  /** Timeout for waiting on branches */
  timeout?: number;
  /** How to combine branch outputs */
  outputCombination: 'array' | 'object' | 'first' | 'last';
}

// =============================================================================
// TRANSFORM AND SUBWORKFLOW NODE DATA
// =============================================================================

/**
 * Transform node for data manipulation
 */
export interface TransformNodeData extends BaseNodeData {
  /** Transformation language */
  language: 'javascript' | 'jsonpath' | 'jq' | 'template';
  /** Transformation code/expression */
  code: string;
  /** Input mappings */
  inputMappings?: Record<string, string>;
  /** Output key */
  outputKey?: string;
  /** Sandbox execution */
  sandbox?: boolean;
}

/**
 * Subworkflow node for nested workflow execution
 */
export interface SubworkflowNodeData extends BaseNodeData {
  /** Referenced workflow ID */
  workflowId: string;
  /** Workflow version (optional, defaults to latest) */
  version?: string;
  /** Input mapping */
  inputMapping?: Record<string, string>;
  /** Output mapping */
  outputMapping?: Record<string, string>;
  /** Wait for subworkflow completion */
  waitForCompletion?: boolean;
  /** Pass parent context */
  passContext?: boolean;
}

// =============================================================================
// WORKFLOW NODE
// =============================================================================

/**
 * Complete workflow node definition
 */
export interface WorkflowNode {
  /** Unique node identifier */
  id: string;
  /** Node type */
  type: NodeType;
  /** Node position in canvas */
  position: { x: number; y: number };
  /** Node dimensions */
  dimensions?: { width: number; height: number };
  /** Type-specific node data */
  data:
    | TriggerNodeData
    | AgentNodeData
    | ActionNodeData
    | LogicNodeData
    | SupervisorNodeData
    | MessageNodeData
    | ParallelNodeData
    | MergeNodeData
    | TransformNodeData
    | SubworkflowNodeData;
  /** Node metadata */
  metadata?: {
    /** Creation timestamp */
    createdAt: string;
    /** Last modified timestamp */
    updatedAt: string;
    /** Created by user ID */
    createdBy?: string;
    /** Tags for organization */
    tags?: string[];
    /** Custom color */
    color?: string;
    /** Node icon */
    icon?: string;
  };
}

// =============================================================================
// WORKFLOW
// =============================================================================

/**
 * Workflow settings and configuration
 */
export interface WorkflowSettings {
  /** Global timeout for workflow execution in ms */
  timeout?: number;
  /** Maximum retries for failed nodes */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Enable detailed logging */
  verboseLogging?: boolean;
  /** Persist execution state */
  persistState?: boolean;
  /** Enable execution history */
  enableHistory?: boolean;
  /** Maximum history entries */
  maxHistoryEntries?: number;
  /** Error handling strategy */
  errorStrategy?: 'fail' | 'continue' | 'rollback';
  /** Variables available to all nodes */
  globalVariables?: Record<string, unknown>;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Concurrent execution limit */
  concurrencyLimit?: number;
  /** Rate limiting */
  rateLimit?: {
    /** Requests per window */
    requests: number;
    /** Window duration in ms */
    window: number;
  };
}

/**
 * Complete workflow definition
 */
export interface Workflow {
  /** Unique workflow identifier */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Workflow version */
  version: string;
  /** Workflow nodes */
  nodes: WorkflowNode[];
  /** Workflow edges */
  edges: WorkflowEdge[];
  /** Workflow settings */
  settings: WorkflowSettings;
  /** Workflow status */
  status: 'draft' | 'active' | 'paused' | 'archived';
  /** Creation timestamp */
  createdAt: string;
  /** Last modified timestamp */
  updatedAt: string;
  /** Created by user ID */
  createdBy?: string;
  /** Last modified by user ID */
  updatedBy?: string;
  /** Tags for organization */
  tags?: string[];
  /** Category */
  category?: string;
  /** Is this a template */
  isTemplate?: boolean;
  /** Parent template ID if cloned from template */
  templateId?: string;
  /** Viewport state for canvas */
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

/**
 * Summary view of a workflow for listings
 */
export interface WorkflowSummary {
  /** Workflow ID */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Workflow status */
  status: 'draft' | 'active' | 'paused' | 'archived';
  /** Node count */
  nodeCount: number;
  /** Last modified timestamp */
  updatedAt: string;
  /** Created by user */
  createdBy?: string;
  /** Tags */
  tags?: string[];
  /** Category */
  category?: string;
  /** Last execution status */
  lastExecutionStatus?: ExecutionStatus;
  /** Last execution timestamp */
  lastExecutionAt?: string;
  /** Execution count */
  executionCount?: number;
}

// =============================================================================
// INTERCEPTION TYPES
// =============================================================================

/**
 * Rule for intercepting agent actions
 */
export interface InterceptionRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description?: string;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Priority (higher = evaluated first) */
  priority: number;
  /** Conditions that trigger this rule */
  conditions: {
    /** Action types to match */
    actionTypes?: string[];
    /** File patterns to match */
    filePatterns?: string[];
    /** Command patterns to match */
    commandPatterns?: string[];
    /** Risk levels to match */
    riskLevels?: RiskLevel[];
    /** Custom condition expression */
    expression?: string;
  };
  /** Action to take when rule matches */
  action: DecisionAction;
  /** Require specific approvers */
  approvers?: string[];
  /** Auto-approve after timeout */
  autoApproveTimeout?: number;
  /** Notification on trigger */
  notify?: boolean;
}

/**
 * Configuration for agent interception
 */
export interface InterceptionConfig {
  /** Enable interception */
  enabled: boolean;
  /** Interception rules */
  rules: InterceptionRule[];
  /** Default action if no rules match */
  defaultAction: DecisionAction;
  /** Risk thresholds */
  riskThresholds?: {
    /** Auto-approve below this level */
    autoApprove: RiskLevel;
    /** Require approval at or above this level */
    requireApproval: RiskLevel;
    /** Block at this level */
    block: RiskLevel;
  };
  /** Supervisor node ID (if using supervisor node) */
  supervisorNodeId?: string;
}

/**
 * Modification to apply to an action
 */
export interface Modification {
  /** Modification type */
  type: 'replace' | 'prepend' | 'append' | 'remove' | 'transform';
  /** Target field to modify */
  field: string;
  /** New value or transformation */
  value: unknown;
  /** Reason for modification */
  reason?: string;
}

/**
 * Supervisor decision for an intercepted action
 */
export interface SupervisorDecision {
  /** Decision ID */
  id: string;
  /** Associated approval ID */
  approvalId: string;
  /** Decision action */
  action: DecisionAction;
  /** Modifications to apply (if action is 'modify') */
  modifications?: Modification[];
  /** Delegation target (if action is 'delegate') */
  delegateTo?: string;
  /** Decision reason */
  reason?: string;
  /** Decided by (user or system) */
  decidedBy: string;
  /** Decision timestamp */
  decidedAt: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Pending approval request
 */
export interface PendingApproval {
  /** Approval ID */
  id: string;
  /** Workflow execution ID */
  executionId: string;
  /** Node ID that generated the action */
  nodeId: string;
  /** Agent ID (if from agent node) */
  agentId?: string;
  /** Action type */
  actionType: string;
  /** Action details */
  actionDetails: {
    /** Tool or action name */
    name: string;
    /** Parameters/arguments */
    params: Record<string, unknown>;
    /** Target (file, URL, etc.) */
    target?: string;
    /** Estimated impact */
    impact?: string;
  };
  /** Assessed risk level */
  riskLevel: RiskLevel;
  /** Risk assessment details */
  riskAssessment?: {
    /** Risk factors */
    factors: string[];
    /** Risk score (0-100) */
    score: number;
    /** Assessment explanation */
    explanation: string;
  };
  /** Rule that triggered interception */
  triggeredRule?: string;
  /** Approval status */
  status: 'pending' | 'approved' | 'denied' | 'modified' | 'expired' | 'delegated';
  /** Required approvers */
  requiredApprovers?: string[];
  /** Current approvals */
  approvals?: Array<{
    userId: string;
    action: 'approve' | 'deny';
    timestamp: string;
    comment?: string;
  }>;
  /** Creation timestamp */
  createdAt: string;
  /** Expiration timestamp */
  expiresAt?: string;
  /** Decision (if resolved) */
  decision?: SupervisorDecision;
  /** Context for decision making */
  context?: {
    /** Recent agent actions */
    recentActions?: string[];
    /** Current workflow state summary */
    workflowState?: string;
    /** Relevant file contents */
    fileContents?: Record<string, string>;
  };
}

// =============================================================================
// AGENT RUNTIME TYPES
// =============================================================================

/**
 * Step execution record
 */
export interface StepExecution {
  /** Step ID */
  id: string;
  /** Step number */
  stepNumber: number;
  /** Step type */
  type: 'thinking' | 'tool_call' | 'tool_result' | 'response' | 'error';
  /** Step content */
  content: {
    /** Thinking content */
    thinking?: string;
    /** Tool name */
    toolName?: string;
    /** Tool parameters */
    toolParams?: Record<string, unknown>;
    /** Tool result */
    toolResult?: unknown;
    /** Response text */
    response?: string;
    /** Error message */
    error?: string;
  };
  /** Tokens used */
  tokens?: {
    input: number;
    output: number;
  };
  /** Step duration in ms */
  duration?: number;
  /** Start timestamp */
  startedAt: string;
  /** End timestamp */
  completedAt?: string;
  /** Was this step intercepted */
  intercepted?: boolean;
  /** Approval status if intercepted */
  approvalStatus?: 'pending' | 'approved' | 'denied' | 'modified';
}

/**
 * Runtime state of an agent
 */
export interface AgentRuntimeState {
  /** Agent instance ID */
  instanceId: string;
  /** Agent configuration ID */
  agentId: string;
  /** Current status */
  status: AgentStatus;
  /** Current iteration */
  currentIteration: number;
  /** Maximum iterations */
  maxIterations: number;
  /** Execution history */
  steps: StepExecution[];
  /** Current context */
  context: {
    /** Working directory */
    workingDirectory?: string;
    /** Open files */
    openFiles?: string[];
    /** Variables */
    variables: Record<string, unknown>;
    /** Memory/conversation history */
    memory?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
  };
  /** Token usage */
  tokenUsage: {
    total: number;
    input: number;
    output: number;
    limit?: number;
  };
  /** Start timestamp */
  startedAt: string;
  /** Last activity timestamp */
  lastActivityAt: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Error if failed */
  error?: {
    message: string;
    code?: string;
    stack?: string;
    recoverable?: boolean;
  };
  /** Output data */
  output?: unknown;
  /** Performance metrics */
  metrics?: {
    /** Average step duration */
    avgStepDuration: number;
    /** Total duration */
    totalDuration: number;
    /** Tool call count */
    toolCallCount: number;
    /** Interception count */
    interceptionCount: number;
  };
}

// =============================================================================
// EXECUTION TYPES
// =============================================================================

/**
 * Workflow execution state
 */
export interface ExecutionState {
  /** Execution ID */
  id: string;
  /** Workflow ID */
  workflowId: string;
  /** Workflow version */
  workflowVersion: string;
  /** Execution status */
  status: ExecutionStatus;
  /** Trigger information */
  trigger: {
    /** Trigger type */
    type: string;
    /** Trigger node ID */
    nodeId: string;
    /** Trigger data */
    data?: unknown;
    /** Trigger timestamp */
    timestamp: string;
  };
  /** Node execution states */
  nodeStates: Record<
    string,
    {
      /** Node status */
      status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
      /** Start timestamp */
      startedAt?: string;
      /** End timestamp */
      completedAt?: string;
      /** Input data */
      input?: unknown;
      /** Output data */
      output?: unknown;
      /** Error if failed */
      error?: string;
      /** Retry count */
      retryCount?: number;
    }
  >;
  /** Agent states (for agent nodes) */
  agentStates: Record<string, AgentRuntimeState>;
  /** Pending approvals */
  pendingApprovals: PendingApproval[];
  /** Workflow context/variables */
  context: Record<string, unknown>;
  /** Execution path (node IDs in order) */
  executionPath: string[];
  /** Start timestamp */
  startedAt: string;
  /** End timestamp */
  completedAt?: string;
  /** Total duration in ms */
  duration?: number;
  /** Error if failed */
  error?: {
    nodeId: string;
    message: string;
    code?: string;
    stack?: string;
  };
  /** Final output */
  output?: unknown;
  /** Execution metadata */
  metadata?: {
    /** Initiated by */
    initiatedBy?: string;
    /** Parent execution ID (if subworkflow) */
    parentExecutionId?: string;
    /** Tags */
    tags?: string[];
  };
}

// =============================================================================
// AUDIT TYPES
// =============================================================================

/**
 * Audit log entry
 */
export interface AuditEntry {
  /** Entry ID */
  id: string;
  /** Entry timestamp */
  timestamp: string;
  /** Event type */
  eventType:
    | 'workflow_created'
    | 'workflow_updated'
    | 'workflow_deleted'
    | 'workflow_executed'
    | 'execution_started'
    | 'execution_completed'
    | 'execution_failed'
    | 'execution_cancelled'
    | 'node_executed'
    | 'agent_started'
    | 'agent_completed'
    | 'agent_failed'
    | 'tool_called'
    | 'approval_requested'
    | 'approval_granted'
    | 'approval_denied'
    | 'interception_triggered'
    | 'error_occurred'
    | 'settings_changed';
  /** Actor (user or system) */
  actor: {
    /** Actor type */
    type: 'user' | 'system' | 'agent' | 'workflow';
    /** Actor ID */
    id: string;
    /** Actor name */
    name?: string;
  };
  /** Target resource */
  target?: {
    /** Target type */
    type: 'workflow' | 'execution' | 'node' | 'agent' | 'approval' | 'settings';
    /** Target ID */
    id: string;
    /** Target name */
    name?: string;
  };
  /** Event details */
  details: Record<string, unknown>;
  /** Changes made (for update events) */
  changes?: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  /** Associated execution ID */
  executionId?: string;
  /** Associated workflow ID */
  workflowId?: string;
  /** Risk level (for agent actions) */
  riskLevel?: RiskLevel;
  /** Outcome */
  outcome?: 'success' | 'failure' | 'pending';
  /** IP address (for user actions) */
  ipAddress?: string;
  /** User agent (for user actions) */
  userAgent?: string;
  /** Tags */
  tags?: string[];
}

/**
 * Filter for audit log queries
 */
export interface AuditFilter {
  /** Start date */
  startDate?: string;
  /** End date */
  endDate?: string;
  /** Event types to include */
  eventTypes?: AuditEntry['eventType'][];
  /** Actor IDs */
  actorIds?: string[];
  /** Actor types */
  actorTypes?: Array<'user' | 'system' | 'agent' | 'workflow'>;
  /** Target IDs */
  targetIds?: string[];
  /** Target types */
  targetTypes?: Array<'workflow' | 'execution' | 'node' | 'agent' | 'approval' | 'settings'>;
  /** Workflow IDs */
  workflowIds?: string[];
  /** Execution IDs */
  executionIds?: string[];
  /** Risk levels */
  riskLevels?: RiskLevel[];
  /** Outcomes */
  outcomes?: Array<'success' | 'failure' | 'pending'>;
  /** Search text */
  searchText?: string;
  /** Tags */
  tags?: string[];
}

/**
 * Paginated audit log response
 */
export interface AuditLogPage {
  /** Audit entries */
  entries: AuditEntry[];
  /** Total count */
  total: number;
  /** Page number */
  page: number;
  /** Page size */
  pageSize: number;
  /** Has more pages */
  hasMore: boolean;
  /** Cursor for next page */
  nextCursor?: string;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Console log entry for real-time output
 */
export interface ConsoleLogEntry {
  /** Entry ID */
  id: string;
  /** Timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Source */
  source: {
    /** Source type */
    type: 'workflow' | 'node' | 'agent' | 'system';
    /** Source ID */
    id: string;
    /** Source name */
    name?: string;
  };
  /** Log message */
  message: string;
  /** Additional data */
  data?: unknown;
  /** Execution ID */
  executionId?: string;
}

/** Workflow created event */
export interface WorkflowCreatedEvent {
  type: 'workflow:created';
  workflowId: string;
  workflow: WorkflowSummary;
  timestamp: string;
}

/** Workflow updated event */
export interface WorkflowUpdatedEvent {
  type: 'workflow:updated';
  workflowId: string;
  changes: string[];
  timestamp: string;
}

/** Workflow deleted event */
export interface WorkflowDeletedEvent {
  type: 'workflow:deleted';
  workflowId: string;
  timestamp: string;
}

/** Execution started event */
export interface ExecutionStartedEvent {
  type: 'execution:started';
  executionId: string;
  workflowId: string;
  trigger: ExecutionState['trigger'];
  timestamp: string;
}

/** Execution completed event */
export interface ExecutionCompletedEvent {
  type: 'execution:completed';
  executionId: string;
  workflowId: string;
  status: ExecutionStatus;
  duration: number;
  output?: unknown;
  timestamp: string;
}

/** Execution failed event */
export interface ExecutionFailedEvent {
  type: 'execution:failed';
  executionId: string;
  workflowId: string;
  error: ExecutionState['error'];
  timestamp: string;
}

/** Node started event */
export interface NodeStartedEvent {
  type: 'node:started';
  executionId: string;
  nodeId: string;
  nodeType: NodeType;
  timestamp: string;
}

/** Node completed event */
export interface NodeCompletedEvent {
  type: 'node:completed';
  executionId: string;
  nodeId: string;
  nodeType: NodeType;
  output?: unknown;
  duration: number;
  timestamp: string;
}

/** Node failed event */
export interface NodeFailedEvent {
  type: 'node:failed';
  executionId: string;
  nodeId: string;
  nodeType: NodeType;
  error: string;
  timestamp: string;
}

/** Agent step event */
export interface AgentStepEvent {
  type: 'agent:step';
  executionId: string;
  nodeId: string;
  agentId: string;
  step: StepExecution;
  timestamp: string;
}

/** Agent status changed event */
export interface AgentStatusChangedEvent {
  type: 'agent:status';
  executionId: string;
  nodeId: string;
  agentId: string;
  previousStatus: AgentStatus;
  newStatus: AgentStatus;
  timestamp: string;
}

/** Approval requested event */
export interface ApprovalRequestedEvent {
  type: 'approval:requested';
  approval: PendingApproval;
  timestamp: string;
}

/** Approval resolved event */
export interface ApprovalResolvedEvent {
  type: 'approval:resolved';
  approvalId: string;
  decision: SupervisorDecision;
  timestamp: string;
}

/** Console log event */
export interface ConsoleLogEvent {
  type: 'console:log';
  entry: ConsoleLogEntry;
}

/**
 * Union type for all factory events
 */
export type FactoryEvent =
  | WorkflowCreatedEvent
  | WorkflowUpdatedEvent
  | WorkflowDeletedEvent
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | NodeStartedEvent
  | NodeCompletedEvent
  | NodeFailedEvent
  | AgentStepEvent
  | AgentStatusChangedEvent
  | ApprovalRequestedEvent
  | ApprovalResolvedEvent
  | ConsoleLogEvent;

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extract event type from FactoryEvent union
 */
export type FactoryEventType = FactoryEvent['type'];

/**
 * Extract specific event by type
 */
export type FactoryEventByType<T extends FactoryEventType> = Extract<FactoryEvent, { type: T }>;

/**
 * Node data type by NodeType
 */
export type NodeDataByType<T extends NodeType> = T extends NodeType.TRIGGER
  ? TriggerNodeData
  : T extends NodeType.AGENT
    ? AgentNodeData
    : T extends NodeType.ACTION
      ? ActionNodeData
      : T extends NodeType.CONDITION | NodeType.SWITCH | NodeType.LOOP
        ? LogicNodeData
        : T extends NodeType.SUPERVISOR
          ? SupervisorNodeData
          : T extends NodeType.MESSAGE
            ? MessageNodeData
            : T extends NodeType.PARALLEL
              ? ParallelNodeData
              : T extends NodeType.MERGE
                ? MergeNodeData
                : T extends NodeType.TRANSFORM
                  ? TransformNodeData
                  : T extends NodeType.SUBWORKFLOW
                    ? SubworkflowNodeData
                    : never;

/**
 * Type guard for checking node type
 */
export function isNodeType<T extends NodeType>(
  node: WorkflowNode,
  type: T
): node is WorkflowNode & { type: T; data: NodeDataByType<T> } {
  return node.type === type;
}

/**
 * Type guard for trigger node data
 */
export function isTriggerData<T extends TriggerNodeData['triggerType']>(
  data: TriggerNodeData,
  triggerType: T
): data is Extract<TriggerNodeData, { triggerType: T }> {
  return data.triggerType === triggerType;
}

/**
 * Type guard for action node data
 */
export function isActionData<T extends ActionNodeData['actionType']>(
  data: ActionNodeData,
  actionType: T
): data is Extract<ActionNodeData, { actionType: T }> {
  return data.actionType === actionType;
}

/**
 * Type guard for logic node data
 */
export function isLogicData<T extends LogicNodeData['logicType']>(
  data: LogicNodeData,
  logicType: T
): data is Extract<LogicNodeData, { logicType: T }> {
  return data.logicType === logicType;
}

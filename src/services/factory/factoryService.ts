/**
 * Factory Service - Tauri Command Bindings
 * Provides async functions that invoke Tauri commands for Factory operations
 * 
 * These bindings match the Rust backend commands in:
 * desktop/src-tauri/src/factory/commands.rs
 */

import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types (matching Rust types in factory/types.rs)
// ============================================================================

/** Workflow definition */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown>;
  settings: WorkflowSettings;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  enabled: boolean;
}

/** Workflow settings */
export interface WorkflowSettings {
  timeoutMs: number;
  maxRetries: number;
  continueOnFailure: boolean;
  parallelExecution: boolean;
  interception?: InterceptionConfig;
}

/** Workflow node */
export interface WorkflowNode {
  id: string;
  nodeType: NodeType;
  label: string;
  x: number;
  y: number;
  config: unknown;
  inputs: NodePort[];
  outputs: NodePort[];
  disabled: boolean;
  notes?: string;
}

/** Node port */
export interface NodePort {
  id: string;
  label: string;
  dataType: string;
  required: boolean;
}

/** Node type variants */
export type NodeType =
  | { trigger: TriggerType }
  | { action: ActionType }
  | "condition"
  | "parallel_split"
  | "parallel_join"
  | "loop"
  | "delay"
  | "transform"
  | "agent"
  | "sub_workflow"
  | "approval"
  | "end"
  | "note";

/** Trigger types */
export type TriggerType = "manual" | "schedule" | "webhook" | "file_watch" | "git_event" | "event";

/** Action types */
export type ActionType = "shell" | "read_file" | "write_file" | "delete_file" | "http_request" | "ai_call" | "tool" | "notify" | "custom";

/** Workflow edge */
export interface WorkflowEdge {
  id: string;
  source: string;
  sourcePort?: string;
  target: string;
  targetPort?: string;
  condition?: string;
  label?: string;
}

/** Interception config */
export interface InterceptionConfig {
  enabled: boolean;
  autoApproveThreshold: RiskLevel;
  autoDenyThreshold: RiskLevel;
  rules: InterceptionRule[];
  approvalTimeoutMs: number;
  timeoutAction: TimeoutAction;
}

/** Interception rule */
export interface InterceptionRule {
  id: string;
  name: string;
  description?: string;
  pattern: string;
  actionType: InterceptionActionType;
  riskLevel: RiskLevel;
  enabled: boolean;
  requiredDecision?: DecisionAction;
}

/** Risk levels */
export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

/** Decision actions */
export type DecisionAction = "approve" | "deny" | "modify" | "defer";

/** Timeout actions */
export type TimeoutAction = "deny" | "approve" | "pause";

/** Interception action types */
export type InterceptionActionType = "file_write" | "file_delete" | "shell_exec" | "http_request" | "ai_call" | "tool_exec" | "all";

/** Workflow export format */
export interface WorkflowExport {
  formatVersion: string;
  exportedAt: number;
  workflow: Workflow;
  interceptionRules: InterceptionRule[];
  checksum?: string;
}

/** Execution state */
export interface ExecutionState {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: number;
  completedAt?: number;
  currentNode?: string;
  executedNodes: NodeExecutionResult[];
  variables: Record<string, unknown>;
  error?: string;
  spawnedAgents: string[];
  pendingApprovals: string[];
}

/** Execution status */
export type ExecutionStatus = "pending" | "running" | "paused" | "waiting_approval" | "completed" | "failed" | "cancelled";

/** Node execution result */
export interface NodeExecutionResult {
  nodeId: string;
  status: ExecutionStatus;
  startedAt: number;
  completedAt?: number;
  output?: unknown;
  error?: string;
  retries: number;
}

/** Agent runtime state */
export interface AgentRuntimeState {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model: string;
  status: AgentStatus;
  config: AgentConfig;
  currentStep?: StepExecution;
  stepHistory: StepExecution[];
  error?: string;
  createdAt: number;
  lastActiveAt?: number;
  workflowId?: string;
  nodeId?: string;
}

/** Agent status */
export type AgentStatus = "idle" | "running" | "paused" | "waiting_approval" | "completed" | "failed" | "cancelled";

/** Agent config */
export interface AgentConfig {
  temperature?: number;
  maxTokens?: number;
  tools: string[];
  maxSteps: number;
  stepTimeoutMs: number;
}

/** Step execution */
export interface StepExecution {
  stepNumber: number;
  stepType: StepType;
  description: string;
  input?: unknown;
  output?: unknown;
  status: StepStatus;
  error?: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
}

/** Step types */
export type StepType = "thinking" | "tool_call" | "file_read" | "file_write" | "shell_exec" | "http_request" | "wait_approval" | "user_message" | "assistant_message";

/** Step status */
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";

/** Pending approval */
export interface PendingApproval {
  id: string;
  executionId: string;
  nodeId: string;
  agentId?: string;
  description: string;
  context?: string;
  actionType: InterceptionActionType;
  actionParams: unknown;
  riskLevel: RiskLevel;
  triggeredRules: string[];
  requestedAt: number;
  expiresAt: number;
  status: ApprovalStatus;
  decision?: SupervisorDecision;
}

/** Approval status */
export type ApprovalStatus = "pending" | "approved" | "denied" | "modified" | "expired" | "cancelled";

/** Supervisor decision */
export interface SupervisorDecision {
  id: string;
  approvalId: string;
  action: DecisionAction;
  reason?: string;
  modifiedParams?: unknown;
  decidedAt: number;
  decidedBy: string;
}

/** Audit entry */
export interface AuditEntry {
  id: string;
  timestamp: number;
  eventType: AuditEventType;
  actor: string;
  target?: string;
  action: string;
  description?: string;
  metadata: Record<string, unknown>;
  riskLevel?: RiskLevel;
  result: AuditResult;
  workflowId?: string;
  executionId?: string;
  agentId?: string;
}

/** Audit event types */
export type AuditEventType =
  | "workflow_created" | "workflow_updated" | "workflow_deleted"
  | "workflow_started" | "workflow_completed" | "workflow_failed"
  | "workflow_paused" | "workflow_resumed"
  | "agent_spawned" | "agent_completed" | "agent_failed"
  | "step_executed" | "interception_triggered"
  | "approval_requested" | "approval_granted" | "approval_denied" | "approval_modified" | "approval_timeout"
  | "file_access" | "shell_execution" | "tool_execution"
  | "error" | "warning" | "info";

/** Audit result */
export type AuditResult = "success" | "failure" | "pending" | "cancelled";

/** Audit filter */
export interface AuditFilter {
  eventTypes?: AuditEventType[];
  actor?: string;
  workflowId?: string;
  executionId?: string;
  agentId?: string;
  minRiskLevel?: RiskLevel;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Error Handling
// ============================================================================

/** Factory service error */
export class FactoryServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "FactoryServiceError";
  }
}

/** Wrap invoke calls with error handling */
async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    if (error instanceof Error) {
      throw new FactoryServiceError(error.message, "INVOKE_ERROR", { command, args });
    }
    throw new FactoryServiceError(String(error), "INVOKE_ERROR", { command, args });
  }
}

// ============================================================================
// Workflow Management Commands
// ============================================================================

/**
 * Create a new workflow
 * Backend: factory_create_workflow(workflow: Workflow) -> Workflow
 */
export async function createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
  const defaultWorkflow: Workflow = {
    id: "",
    name: workflow.name || "New Workflow",
    description: workflow.description,
    version: workflow.version || "1.0.0",
    nodes: workflow.nodes || [],
    edges: workflow.edges || [],
    variables: workflow.variables || {},
    settings: workflow.settings || {
      timeoutMs: 300000,
      maxRetries: 0,
      continueOnFailure: false,
      parallelExecution: true,
    },
    createdAt: 0,
    updatedAt: 0,
    tags: workflow.tags || [],
    enabled: workflow.enabled ?? true,
  };
  return invokeCommand<Workflow>("factory_create_workflow", { workflow: defaultWorkflow });
}

/**
 * Update an existing workflow
 * Backend: factory_update_workflow(workflow: Workflow) -> Workflow
 */
export async function updateWorkflow(workflow: Workflow): Promise<Workflow> {
  return invokeCommand<Workflow>("factory_update_workflow", { workflow });
}

/**
 * Delete a workflow
 * Backend: factory_delete_workflow(workflow_id: String) -> ()
 */
export async function deleteWorkflow(workflowId: string): Promise<void> {
  return invokeCommand<void>("factory_delete_workflow", { workflowId });
}

/**
 * List all workflows
 * Backend: factory_list_workflows() -> Vec<Workflow>
 */
export async function listWorkflows(): Promise<Workflow[]> {
  return invokeCommand<Workflow[]>("factory_list_workflows");
}

/**
 * Get a specific workflow by ID
 * Backend: factory_get_workflow(workflow_id: String) -> Option<Workflow>
 */
export async function getWorkflow(workflowId: string): Promise<Workflow | null> {
  return invokeCommand<Workflow | null>("factory_get_workflow", { workflowId });
}

/**
 * Export a workflow to JSON
 * Backend: factory_export_workflow(workflow_id: String) -> WorkflowExport
 */
export async function exportWorkflow(workflowId: string): Promise<WorkflowExport> {
  return invokeCommand<WorkflowExport>("factory_export_workflow", { workflowId });
}

/**
 * Import a workflow from JSON
 * Backend: factory_import_workflow(export: WorkflowExport) -> Workflow
 */
export async function importWorkflow(workflowExport: WorkflowExport): Promise<Workflow> {
  return invokeCommand<Workflow>("factory_import_workflow", { export: workflowExport });
}

// ============================================================================
// Workflow Execution Commands
// ============================================================================

/**
 * Start executing a workflow
 * Backend: factory_start_workflow(workflow_id: String, variables: Option<HashMap>) -> ExecutionState
 */
export async function startWorkflow(
  workflowId: string,
  variables?: Record<string, unknown>
): Promise<ExecutionState> {
  return invokeCommand<ExecutionState>("factory_start_workflow", { workflowId, variables });
}

/**
 * Stop a running workflow execution
 * Backend: factory_stop_workflow(execution_id: String) -> ()
 */
export async function stopWorkflow(executionId: string): Promise<void> {
  return invokeCommand<void>("factory_stop_workflow", { executionId });
}

/**
 * Pause a running workflow execution
 * Backend: factory_pause_workflow(execution_id: String) -> ()
 */
export async function pauseWorkflow(executionId: string): Promise<void> {
  return invokeCommand<void>("factory_pause_workflow", { executionId });
}

/**
 * Resume a paused workflow execution
 * Backend: factory_resume_workflow(execution_id: String) -> ()
 */
export async function resumeWorkflow(executionId: string): Promise<void> {
  return invokeCommand<void>("factory_resume_workflow", { executionId });
}

/**
 * Get the current state of an execution
 * Backend: factory_get_execution_state(execution_id: String) -> Option<ExecutionState>
 */
export async function getExecutionState(executionId: string): Promise<ExecutionState | null> {
  return invokeCommand<ExecutionState | null>("factory_get_execution_state", { executionId });
}

// ============================================================================
// Agent Management Commands
// ============================================================================

/**
 * List all agents
 * Backend: factory_list_agents() -> Vec<AgentRuntimeState>
 */
export async function listAgents(): Promise<AgentRuntimeState[]> {
  return invokeCommand<AgentRuntimeState[]>("factory_list_agents");
}

/**
 * Create a new agent
 * Backend: factory_create_agent(agent: AgentRuntimeState) -> AgentRuntimeState
 */
export async function createAgent(agent: Partial<AgentRuntimeState>): Promise<AgentRuntimeState> {
  const defaultAgent: AgentRuntimeState = {
    id: "",
    name: agent.name || "New Agent",
    description: agent.description,
    systemPrompt: agent.systemPrompt || "",
    model: agent.model || "gpt-4",
    status: "idle",
    config: agent.config || {
      tools: [],
      maxSteps: 100,
      stepTimeoutMs: 60000,
    },
    stepHistory: [],
    createdAt: 0,
  };
  return invokeCommand<AgentRuntimeState>("factory_create_agent", { agent: defaultAgent });
}

/**
 * Update an existing agent
 * Backend: factory_update_agent(agent: AgentRuntimeState) -> AgentRuntimeState
 */
export async function updateAgent(agent: AgentRuntimeState): Promise<AgentRuntimeState> {
  return invokeCommand<AgentRuntimeState>("factory_update_agent", { agent });
}

/**
 * Delete an agent
 * Backend: factory_delete_agent(agent_id: String) -> ()
 */
export async function deleteAgent(agentId: string): Promise<void> {
  return invokeCommand<void>("factory_delete_agent", { agentId });
}

/**
 * Get the current state of an agent
 * Backend: factory_get_agent_state(agent_id: String) -> Option<AgentRuntimeState>
 */
export async function getAgentState(agentId: string): Promise<AgentRuntimeState | null> {
  return invokeCommand<AgentRuntimeState | null>("factory_get_agent_state", { agentId });
}

// ============================================================================
// Approval Management Commands
// ============================================================================

/**
 * List all pending approvals
 * Backend: factory_list_pending_approvals() -> Vec<PendingApproval>
 */
export async function listPendingApprovals(): Promise<PendingApproval[]> {
  return invokeCommand<PendingApproval[]>("factory_list_pending_approvals");
}

/**
 * Approve a pending action
 * Backend: factory_approve_action(approval_id: String, reason: Option<String>) -> ()
 */
export async function approveAction(approvalId: string, reason?: string): Promise<void> {
  return invokeCommand<void>("factory_approve_action", { approvalId, reason });
}

/**
 * Deny a pending action
 * Backend: factory_deny_action(approval_id: String, reason: Option<String>) -> ()
 */
export async function denyAction(approvalId: string, reason?: string): Promise<void> {
  return invokeCommand<void>("factory_deny_action", { approvalId, reason });
}

/**
 * Modify and approve a pending action
 * Backend: factory_modify_action(approval_id: String, modified_params: Value, reason: Option<String>) -> ()
 */
export async function modifyAction(
  approvalId: string,
  modifiedParams: unknown,
  reason?: string
): Promise<void> {
  return invokeCommand<void>("factory_modify_action", { approvalId, modifiedParams, reason });
}

// ============================================================================
// Audit Log Commands
// ============================================================================

/**
 * Get audit log entries with optional filtering
 * Backend: factory_get_audit_log(filter: Option<AuditFilter>) -> Vec<AuditEntry>
 */
export async function getAuditLog(filter?: AuditFilter): Promise<AuditEntry[]> {
  return invokeCommand<AuditEntry[]>("factory_get_audit_log", { filter });
}

/**
 * Export audit log to a file
 * Backend: factory_export_audit_log(path: String, filter: Option<AuditFilter>) -> usize
 */
export async function exportAuditLog(path: string, filter?: AuditFilter): Promise<number> {
  return invokeCommand<number>("factory_export_audit_log", { path, filter });
}

/**
 * Get a specific audit entry by ID
 * Backend: factory_get_audit_entry(entry_id: String) -> Option<AuditEntry>
 */
export async function getAuditEntry(entryId: string): Promise<AuditEntry | null> {
  return invokeCommand<AuditEntry | null>("factory_get_audit_entry", { entryId });
}

// ============================================================================
// Re-exports for backward compatibility with existing code
// ============================================================================

// Alias functions to match what hooks might be expecting
export const listApprovals = listPendingApprovals;
export const startExecution = startWorkflow;
export const stopExecution = stopWorkflow;
export const pauseExecution = pauseWorkflow;
export const resumeExecution = resumeWorkflow;
export const getExecution = getExecutionState;

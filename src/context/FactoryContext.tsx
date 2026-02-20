/**
 * Factory Context - SolidJS State Management
 * Provides centralized state and operations for the Factory system
 * 
 * Updated to match Rust backend commands in:
 * desktop/src-tauri/src/factory/commands.rs
 */

import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  createMemo,
  ParentProps,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

import type {
  Workflow,
  ExecutionState,
  AgentRuntimeState,
  PendingApproval,
  AuditEntry,
  AuditFilter,
  WorkflowExport,
} from "../services/factory/factoryService";

import * as factoryService from "../services/factory/factoryService";
import * as eventService from "../services/factory/eventService";

// Type aliases for cleaner code
type WorkflowId = string;
type ExecutionId = string;
type AgentId = string;
type ApprovalId = string;

// Validation result type
export interface ValidationError {
  nodeId?: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_ACTIVE_WORKFLOW = "factory_active_workflow";

// ============================================================================
// State Interface
// ============================================================================

export interface FactoryState {
  // Workflows
  workflows: Workflow[];
  activeWorkflowId: WorkflowId | null;
  workflowsLoading: boolean;
  workflowsError: string | null;

  // Executions
  executions: ExecutionState[];
  activeExecutionId: ExecutionId | null;
  executionsLoading: boolean;
  executionsError: string | null;

  // Agents
  agents: AgentRuntimeState[];
  agentsLoading: boolean;
  agentsError: string | null;

  // Approvals
  pendingApprovals: PendingApproval[];
  approvalsLoading: boolean;
  approvalsError: string | null;

  // Audit
  auditEntries: AuditEntry[];
  auditLoading: boolean;
  auditError: string | null;

  // UI State
  isInitialized: boolean;
}

// ============================================================================
// Context Value Interface
// ============================================================================

export interface FactoryContextValue {
  // State accessors
  state: FactoryState;

  // Workflow accessors
  workflows: Accessor<Workflow[]>;
  activeWorkflow: Accessor<Workflow | null>;
  workflowsLoading: Accessor<boolean>;
  workflowsError: Accessor<string | null>;

  // Execution accessors
  executions: Accessor<ExecutionState[]>;
  activeExecution: Accessor<ExecutionState | null>;
  runningExecutions: Accessor<ExecutionState[]>;
  executionsLoading: Accessor<boolean>;

  // Agent accessors
  agents: Accessor<AgentRuntimeState[]>;
  agentsLoading: Accessor<boolean>;

  // Approval accessors
  pendingApprovals: Accessor<PendingApproval[]>;
  pendingApprovalCount: Accessor<number>;
  approvalsLoading: Accessor<boolean>;

  // Audit accessors
  auditEntries: Accessor<AuditEntry[]>;
  auditLoading: Accessor<boolean>;

  // Workflow Operations
  loadWorkflows: () => Promise<void>;
  loadWorkflow: (id: WorkflowId) => Promise<Workflow | null>;
  createWorkflow: (workflow: Partial<Workflow>) => Promise<Workflow>;
  updateWorkflow: (workflow: Workflow) => Promise<Workflow>;
  deleteWorkflow: (id: WorkflowId) => Promise<void>;
  exportWorkflow: (id: WorkflowId) => Promise<WorkflowExport>;
  importWorkflow: (workflowExport: WorkflowExport) => Promise<Workflow>;
  setActiveWorkflow: (id: WorkflowId | null) => void;
  validateWorkflow: (id: WorkflowId) => Promise<ValidationResult>;

  // Execution Operations
  startWorkflow: (workflowId: WorkflowId, variables?: Record<string, unknown>) => Promise<ExecutionState>;
  stopWorkflow: (executionId: ExecutionId) => Promise<void>;
  pauseWorkflow: (executionId: ExecutionId) => Promise<void>;
  resumeWorkflow: (executionId: ExecutionId) => Promise<void>;
  getExecutionState: (executionId: ExecutionId) => Promise<ExecutionState | null>;
  setActiveExecution: (id: ExecutionId | null) => void;

  // Agent Operations
  loadAgents: () => Promise<void>;
  createAgent: (agent: Partial<AgentRuntimeState>) => Promise<AgentRuntimeState>;
  updateAgent: (agent: AgentRuntimeState) => Promise<AgentRuntimeState>;
  deleteAgent: (id: AgentId) => Promise<void>;
  getAgentState: (id: AgentId) => Promise<AgentRuntimeState | null>;

  // Approval Operations
  loadApprovals: () => Promise<void>;
  approveAction: (id: ApprovalId, reason?: string) => Promise<void>;
  denyAction: (id: ApprovalId, reason?: string) => Promise<void>;
  modifyAction: (id: ApprovalId, modifiedParams: unknown, reason?: string) => Promise<void>;

  // Audit Operations
  loadAuditLog: (filter?: AuditFilter) => Promise<void>;
  exportAuditLog: (path: string, filter?: AuditFilter) => Promise<number>;
  getAuditEntry: (id: string) => Promise<AuditEntry | null>;

  // Refresh/Reload
  refresh: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const FactoryContext = createContext<FactoryContextValue>();

// ============================================================================
// Initial State
// ============================================================================

const initialState: FactoryState = {
  workflows: [],
  activeWorkflowId: null,
  workflowsLoading: false,
  workflowsError: null,

  executions: [],
  activeExecutionId: null,
  executionsLoading: false,
  executionsError: null,

  agents: [],
  agentsLoading: false,
  agentsError: null,

  pendingApprovals: [],
  approvalsLoading: false,
  approvalsError: null,

  auditEntries: [],
  auditLoading: false,
  auditError: null,

  isInitialized: false,
};

// ============================================================================
// Provider Component
// ============================================================================

export function FactoryProvider(props: ParentProps) {
  const [state, setState] = createStore<FactoryState>(initialState);

  // Track subscriptions for cleanup
  const subscriptions: eventService.Subscription[] = [];

  // ============================================================================
  // Initialization
  // ============================================================================

  const loadFromStorage = () => {
    try {
      const savedWorkflowId = localStorage.getItem(STORAGE_KEY_ACTIVE_WORKFLOW);
      if (savedWorkflowId) {
        setState("activeWorkflowId", savedWorkflowId);
      }
    } catch (e) {
      console.warn("[FactoryContext] Failed to load from storage:", e);
    }
  };

  const saveToStorage = () => {
    try {
      if (state.activeWorkflowId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_WORKFLOW, state.activeWorkflowId);
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_WORKFLOW);
      }
    } catch (e) {
      console.warn("[FactoryContext] Failed to save to storage:", e);
    }
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const setupEventListeners = async () => {
    try {
      // Subscribe to all factory events
      const sub = await eventService.subscribeToAllEvents((event) => {
        // Handle workflow events
        if (event.type === "workflow:created" && "workflow" in event) {
          setState(produce((s) => {
            s.workflows.unshift(event.workflow);
          }));
        } else if (event.type === "workflow:updated" && "workflow" in event) {
          setState(produce((s) => {
            const idx = s.workflows.findIndex((w) => w.id === event.workflow.id);
            if (idx >= 0) {
              s.workflows[idx] = event.workflow;
            }
          }));
        } else if (event.type === "workflow:deleted" && "workflowId" in event) {
          setState(produce((s) => {
            s.workflows = s.workflows.filter((w) => w.id !== event.workflowId);
            if (s.activeWorkflowId === event.workflowId) {
              s.activeWorkflowId = null;
            }
          }));
        }

        // Handle execution events
        if (event.type === "execution:started" && "execution" in event) {
          setState(produce((s) => {
            s.executions.unshift(event.execution);
          }));
        } else if (
          (event.type === "execution:completed" ||
            event.type === "execution:failed" ||
            event.type === "execution:paused" ||
            event.type === "execution:resumed" ||
            event.type === "execution:stopped") &&
          "execution" in event
        ) {
          setState(produce((s) => {
            const idx = s.executions.findIndex((e) => e.id === event.execution.id);
            if (idx >= 0) {
              s.executions[idx] = event.execution;
            }
          }));
        }

        // Handle agent events
        if (event.type === "agent:spawned" && "agent" in event) {
          setState(produce((s) => {
            s.agents.unshift(event.agent);
          }));
        } else if (event.type === "agent:updated" && "agent" in event) {
          setState(produce((s) => {
            const idx = s.agents.findIndex((a) => a.id === event.agent.id);
            if (idx >= 0) {
              s.agents[idx] = event.agent;
            }
          }));
        } else if (event.type === "agent:removed" && "agentId" in event) {
          setState(produce((s) => {
            s.agents = s.agents.filter((a) => a.id !== event.agentId);
          }));
        }

        // Handle approval events
        if (event.type === "approval:requested" && "approval" in event) {
          setState(produce((s) => {
            if (!s.pendingApprovals.find((a) => a.id === event.approval.id)) {
              s.pendingApprovals.unshift(event.approval);
            }
          }));
        } else if (
          (event.type === "approval:granted" ||
            event.type === "approval:denied" ||
            event.type === "approval:modified") &&
          "approvalId" in event
        ) {
          setState(produce((s) => {
            s.pendingApprovals = s.pendingApprovals.filter((a) => a.id !== event.approvalId);
          }));
        }
      });
      subscriptions.push(sub);
    } catch (e) {
      console.error("[FactoryContext] Failed to setup event listeners:", e);
    }
  };

  // ============================================================================
  // Workflow Operations
  // ============================================================================

  const loadWorkflows = async (): Promise<void> => {
    setState("workflowsLoading", true);
    setState("workflowsError", null);

    try {
      const workflows = await factoryService.listWorkflows();
      setState("workflows", workflows);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load workflows";
      setState("workflowsError", message);
      throw e;
    } finally {
      setState("workflowsLoading", false);
    }
  };

  const loadWorkflow = async (id: WorkflowId): Promise<Workflow | null> => {
    const workflow = await factoryService.getWorkflow(id);
    if (workflow) {
      // Update in state if exists
      setState(produce((s) => {
        const idx = s.workflows.findIndex((w) => w.id === id);
        if (idx >= 0) {
          s.workflows[idx] = workflow;
        } else {
          s.workflows.push(workflow);
        }
      }));
    }
    return workflow;
  };

  const createWorkflow = async (workflow: Partial<Workflow>): Promise<Workflow> => {
    const created = await factoryService.createWorkflow(workflow);
    // Note: Will be added via event handler
    return created;
  };

  const updateWorkflow = async (workflow: Workflow): Promise<Workflow> => {
    const updated = await factoryService.updateWorkflow(workflow);
    // Note: Will be updated via event handler
    return updated;
  };

  const deleteWorkflow = async (id: WorkflowId): Promise<void> => {
    await factoryService.deleteWorkflow(id);
    // Note: Will be removed via event handler
  };

  const exportWorkflow = async (id: WorkflowId): Promise<WorkflowExport> => {
    return factoryService.exportWorkflow(id);
  };

  const importWorkflow = async (workflowExport: WorkflowExport): Promise<Workflow> => {
    return factoryService.importWorkflow(workflowExport);
  };

  const setActiveWorkflow = (id: WorkflowId | null): void => {
    setState("activeWorkflowId", id);
    saveToStorage();
  };

  /**
   * Validate a workflow before execution
   * Client-side validation since no backend command exists
   */
  const validateWorkflow = async (id: WorkflowId): Promise<ValidationResult> => {
    const workflow = state.workflows.find(w => w.id === id);
    if (!workflow) {
      return {
        valid: false,
        errors: [{ message: `Workflow not found: ${id}` }],
        warnings: [],
      };
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check for empty workflow
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push({ message: "Workflow has no nodes" });
    }

    // Check for trigger node
    const hasTrigger = workflow.nodes?.some(n => {
      const nodeType = n.nodeType;
      return typeof nodeType === 'object' && 'trigger' in nodeType;
    });
    if (!hasTrigger) {
      errors.push({ message: "Workflow must have at least one trigger node" });
    }

    // Check for disconnected nodes
    const connectedNodeIds = new Set<string>();
    workflow.edges?.forEach(e => {
      connectedNodeIds.add(e.source);
      connectedNodeIds.add(e.target);
    });
    
    workflow.nodes?.forEach(n => {
      if (!connectedNodeIds.has(n.id) && workflow.nodes.length > 1) {
        warnings.push({ 
          nodeId: n.id, 
          message: `Node "${n.label}" is not connected to any other node` 
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  };

  // ============================================================================
  // Execution Operations
  // ============================================================================

  const startWorkflow = async (
    workflowId: WorkflowId,
    variables?: Record<string, unknown>
  ): Promise<ExecutionState> => {
    const execution = await factoryService.startWorkflow(workflowId, variables);
    // Note: Will be added via event handler
    return execution;
  };

  const stopWorkflow = async (executionId: ExecutionId): Promise<void> => {
    await factoryService.stopWorkflow(executionId);
    // Note: Will be updated via event handler
  };

  const pauseWorkflow = async (executionId: ExecutionId): Promise<void> => {
    await factoryService.pauseWorkflow(executionId);
    // Note: Will be updated via event handler
  };

  const resumeWorkflow = async (executionId: ExecutionId): Promise<void> => {
    await factoryService.resumeWorkflow(executionId);
    // Note: Will be updated via event handler
  };

  const getExecutionState = async (executionId: ExecutionId): Promise<ExecutionState | null> => {
    return factoryService.getExecutionState(executionId);
  };

  const setActiveExecution = (id: ExecutionId | null): void => {
    setState("activeExecutionId", id);
  };

  // ============================================================================
  // Agent Operations
  // ============================================================================

  const loadAgents = async (): Promise<void> => {
    setState("agentsLoading", true);
    setState("agentsError", null);

    try {
      const agents = await factoryService.listAgents();
      setState("agents", agents);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load agents";
      setState("agentsError", message);
      throw e;
    } finally {
      setState("agentsLoading", false);
    }
  };

  const createAgent = async (agent: Partial<AgentRuntimeState>): Promise<AgentRuntimeState> => {
    const created = await factoryService.createAgent(agent);
    // Note: Will be added via event handler
    return created;
  };

  const updateAgent = async (agent: AgentRuntimeState): Promise<AgentRuntimeState> => {
    const updated = await factoryService.updateAgent(agent);
    // Note: Will be updated via event handler
    return updated;
  };

  const deleteAgent = async (id: AgentId): Promise<void> => {
    await factoryService.deleteAgent(id);
    // Note: Will be removed via event handler
  };

  const getAgentState = async (id: AgentId): Promise<AgentRuntimeState | null> => {
    return factoryService.getAgentState(id);
  };

  // ============================================================================
  // Approval Operations
  // ============================================================================

  const loadApprovals = async (): Promise<void> => {
    setState("approvalsLoading", true);
    setState("approvalsError", null);

    try {
      const approvals = await factoryService.listPendingApprovals();
      setState("pendingApprovals", approvals);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load approvals";
      setState("approvalsError", message);
      throw e;
    } finally {
      setState("approvalsLoading", false);
    }
  };

  const approveAction = async (id: ApprovalId, reason?: string): Promise<void> => {
    await factoryService.approveAction(id, reason);
    // Note: Will be updated via event handler
  };

  const denyAction = async (id: ApprovalId, reason?: string): Promise<void> => {
    await factoryService.denyAction(id, reason);
    // Note: Will be updated via event handler
  };

  const modifyAction = async (
    id: ApprovalId,
    modifiedParams: unknown,
    reason?: string
  ): Promise<void> => {
    await factoryService.modifyAction(id, modifiedParams, reason);
    // Note: Will be updated via event handler
  };

  // ============================================================================
  // Audit Operations
  // ============================================================================

  const loadAuditLog = async (filter?: AuditFilter): Promise<void> => {
    setState("auditLoading", true);
    setState("auditError", null);

    try {
      const entries = await factoryService.getAuditLog(filter);
      setState("auditEntries", entries);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load audit log";
      setState("auditError", message);
      throw e;
    } finally {
      setState("auditLoading", false);
    }
  };

  const exportAuditLog = async (path: string, filter?: AuditFilter): Promise<number> => {
    return factoryService.exportAuditLog(path, filter);
  };

  const getAuditEntry = async (id: string): Promise<AuditEntry | null> => {
    return factoryService.getAuditEntry(id);
  };

  // ============================================================================
  // Refresh
  // ============================================================================

  const refresh = async (): Promise<void> => {
    await Promise.all([loadWorkflows(), loadAgents(), loadApprovals()]);
  };

  // ============================================================================
  // Computed Accessors
  // ============================================================================

  const workflows: Accessor<Workflow[]> = () => state.workflows;
  const activeWorkflow: Accessor<Workflow | null> = () => {
    if (!state.activeWorkflowId) return null;
    return state.workflows.find((w) => w.id === state.activeWorkflowId) ?? null;
  };
  const workflowsLoading: Accessor<boolean> = () => state.workflowsLoading;
  const workflowsError: Accessor<string | null> = () => state.workflowsError;

  const executions: Accessor<ExecutionState[]> = () => state.executions;
  const activeExecution: Accessor<ExecutionState | null> = () => {
    if (!state.activeExecutionId) return null;
    return state.executions.find((e) => e.id === state.activeExecutionId) ?? null;
  };
  const runningExecutions = createMemo(() =>
    state.executions.filter((e) => e.status === "running" || e.status === "paused")
  );
  const executionsLoading: Accessor<boolean> = () => state.executionsLoading;

  const agents: Accessor<AgentRuntimeState[]> = () => state.agents;
  const agentsLoading: Accessor<boolean> = () => state.agentsLoading;

  const pendingApprovals: Accessor<PendingApproval[]> = () => state.pendingApprovals;
  const pendingApprovalCount = createMemo(() => state.pendingApprovals.length);
  const approvalsLoading: Accessor<boolean> = () => state.approvalsLoading;

  const auditEntries: Accessor<AuditEntry[]> = () => state.auditEntries;
  const auditLoading: Accessor<boolean> = () => state.auditLoading;

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: FactoryContextValue = {
    state,

    // Workflow accessors
    workflows,
    activeWorkflow,
    workflowsLoading,
    workflowsError,

    // Execution accessors
    executions,
    activeExecution,
    runningExecutions,
    executionsLoading,

    // Agent accessors
    agents,
    agentsLoading,

    // Approval accessors
    pendingApprovals,
    pendingApprovalCount,
    approvalsLoading,

    // Audit accessors
    auditEntries,
    auditLoading,

    // Workflow Operations
    loadWorkflows,
    loadWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    exportWorkflow,
    importWorkflow,
    setActiveWorkflow,
    validateWorkflow,

    // Execution Operations
    startWorkflow,
    stopWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    getExecutionState,
    setActiveExecution,

    // Agent Operations
    loadAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    getAgentState,

    // Approval Operations
    loadApprovals,
    approveAction,
    denyAction,
    modifyAction,

    // Audit Operations
    loadAuditLog,
    exportAuditLog,
    getAuditEntry,

    // Refresh
    refresh,
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(async () => {
    loadFromStorage();
    await setupEventListeners();

    // Initial data load
    try {
      await Promise.all([loadWorkflows(), loadAgents(), loadApprovals()]);
      setState("isInitialized", true);
    } catch (e) {
      console.error("[FactoryContext] Initialization failed:", e);
      setState("isInitialized", true); // Still mark as initialized to show error states
    }
  });

  onCleanup(() => {
    // Clean up all subscriptions
    for (const sub of subscriptions) {
      sub.unsubscribe();
    }
    subscriptions.length = 0;
  });

  return (
    <FactoryContext.Provider value={contextValue}>
      {props.children}
    </FactoryContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useFactory(): FactoryContextValue {
  const ctx = useContext(FactoryContext);
  if (!ctx) {
    throw new Error("useFactory must be used within FactoryProvider");
  }
  return ctx;
}

// ============================================================================
// Selectors (for more granular subscriptions)
// ============================================================================

/**
 * Get a specific workflow by ID
 */
export function useWorkflowById(id: Accessor<WorkflowId | null>): Accessor<Workflow | null> {
  const factory = useFactory();
  return createMemo(() => {
    const workflowId = id();
    if (!workflowId) return null;
    return factory.workflows().find((w) => w.id === workflowId) ?? null;
  });
}

/**
 * Get a specific agent by ID
 */
export function useAgentById(id: Accessor<AgentId | null>): Accessor<AgentRuntimeState | null> {
  const factory = useFactory();
  return createMemo(() => {
    const agentId = id();
    if (!agentId) return null;
    return factory.agents().find((a) => a.id === agentId) ?? null;
  });
}

/**
 * Get executions for a specific workflow
 */
export function useWorkflowExecutions(
  workflowId: Accessor<WorkflowId | null>
): Accessor<ExecutionState[]> {
  const factory = useFactory();
  return createMemo(() => {
    const id = workflowId();
    if (!id) return [];
    return factory.executions().filter((e) => e.workflowId === id);
  });
}

/**
 * Get approval requests for a specific execution
 */
export function useExecutionApprovals(
  executionId: Accessor<ExecutionId | null>
): Accessor<PendingApproval[]> {
  const factory = useFactory();
  return createMemo(() => {
    const id = executionId();
    if (!id) return [];
    return factory.pendingApprovals().filter((a) => a.executionId === id);
  });
}

/**
 * useExecution - Execution tracking hook
 */

import {
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  Accessor,
} from "solid-js";

import type {
  ExecutionState,
  ExecutionStatus,
  NodeExecutionResult,
} from "../../types/factory";

import { useFactory } from "../../context/FactoryContext";
import * as eventService from "../../services/factory/eventService";

// Type aliases for cleaner code
type WorkflowExecution = ExecutionState;
type NodeExecution = NodeExecutionResult;
type NodeId = string;
type WorkflowId = string;
type ExecutionId = string;

// Import event types from eventService
import type {
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  NodeStartedEvent,
  NodeCompletedEvent,
  NodeFailedEvent,
  ApprovalRequestedEvent,
} from "../../services/factory/eventService";

// Internal event types for the hook
type ExecutionEvent = ExecutionStartedEvent | ExecutionCompletedEvent | ExecutionFailedEvent;
type NodeEvent = NodeStartedEvent | NodeCompletedEvent | NodeFailedEvent;
type ApprovalEvent = ApprovalRequestedEvent;

// ============================================================================
// Types
// ============================================================================

export interface ExecutionProgress {
  /** Total number of nodes */
  totalNodes: number;
  /** Number of completed nodes */
  completedNodes: number;
  /** Number of failed nodes */
  failedNodes: number;
  /** Number of skipped nodes */
  skippedNodes: number;
  /** Progress percentage (0-100) */
  percentage: number;
}

export interface UseExecutionOptions {
  /** Automatically subscribe to real-time events */
  autoSubscribe?: boolean;
  /** Called when execution starts */
  onStart?: (execution: WorkflowExecution) => void;
  /** Called when a node starts */
  onNodeStart?: (nodeExecution: NodeExecution) => void;
  /** Called when a node completes */
  onNodeComplete?: (nodeExecution: NodeExecution) => void;
  /** Called when a node fails */
  onNodeFail?: (nodeExecution: NodeExecution) => void;
  /** Called when approval is required */
  onApprovalRequired?: (approval: ApprovalRequestedEvent) => void;
  /** Called when execution completes */
  onComplete?: (execution: WorkflowExecution) => void;
  /** Called when execution fails */
  onFail?: (execution: WorkflowExecution) => void;
}

export interface UseExecutionReturn {
  // Execution state
  execution: Accessor<WorkflowExecution | null>;
  status: Accessor<ExecutionStatus | null>;
  isRunning: Accessor<boolean>;
  isPaused: Accessor<boolean>;
  isWaitingApproval: Accessor<boolean>;
  isComplete: Accessor<boolean>;
  isFailed: Accessor<boolean>;
  error: Accessor<string | null>;

  // Node state
  currentNodeId: Accessor<NodeId | null>;
  nodeExecutions: Accessor<Record<NodeId, NodeExecution>>;
  progress: Accessor<ExecutionProgress>;

  // Execution control
  start: (workflowId: WorkflowId, input?: Record<string, unknown>) => Promise<WorkflowExecution>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  retry: () => Promise<WorkflowExecution | null>;

  // Tracking
  track: (executionId: ExecutionId) => Promise<void>;
  untrack: () => void;
  refresh: () => Promise<void>;

  // Node helpers
  getNodeExecution: (nodeId: NodeId) => NodeExecution | undefined;
  isNodeRunning: (nodeId: NodeId) => boolean;
  isNodeComplete: (nodeId: NodeId) => boolean;
  isNodeFailed: (nodeId: NodeId) => boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useExecution(
  executionId?: Accessor<ExecutionId | null>,
  options: UseExecutionOptions = {}
): UseExecutionReturn {
  const {
    autoSubscribe = true,
    onStart,
    onNodeStart,
    onNodeComplete,
    onNodeFail,
    onApprovalRequired,
    onComplete,
    onFail,
  } = options;

  const factory = useFactory();

  // ============================================================================
  // State
  // ============================================================================

  const [execution, setExecution] = createSignal<WorkflowExecution | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  // Subscription handle
  let subscription: eventService.Subscription | null = null;

  // ============================================================================
  // Computed
  // ============================================================================

  const status = createMemo(() => execution()?.status ?? null);

  const isRunning = createMemo(() => status() === "running");
  const isPaused = createMemo(() => status() === "paused");
  const isWaitingApproval = createMemo(() => status() === "waiting_approval");
  const isComplete = createMemo(() => status() === "completed");
  const isFailed = createMemo(() => status() === "failed" || status() === "cancelled");

  const currentNodeId = createMemo(() => execution()?.currentNode ?? null);

  // Convert array of NodeExecutionResult to a map keyed by nodeId
  const nodeExecutions = createMemo(() => {
    const exec = execution();
    if (!exec) return {} as Record<NodeId, NodeExecution>;
    const map: Record<NodeId, NodeExecution> = {};
    for (const nodeExec of exec.executedNodes) {
      map[nodeExec.nodeId] = nodeExec;
    }
    return map;
  });

  const progress = createMemo((): ExecutionProgress => {
    const exec = execution();
    if (!exec) {
      return {
        totalNodes: 0,
        completedNodes: 0,
        failedNodes: 0,
        skippedNodes: 0,
        percentage: 0,
      };
    }

    const nodeExecs = exec.executedNodes;
    const totalNodes = nodeExecs.length;
    const completedNodes = nodeExecs.filter((n) => n.status === "completed").length;
    const failedNodes = nodeExecs.filter((n) => n.status === "failed").length;
    // Note: ExecutionStatus doesn't have "skipped" - using cancelled as fallback
    const skippedNodes = nodeExecs.filter((n) => n.status === "cancelled").length;

    const percentage =
      totalNodes > 0 ? Math.round(((completedNodes + failedNodes + skippedNodes) / totalNodes) * 100) : 0;

    return {
      totalNodes,
      completedNodes,
      failedNodes,
      skippedNodes,
      percentage,
    };
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleExecutionEvent = (event: ExecutionEvent) => {
    const exec = event.execution;
    setExecution(exec);

    if (event.type === "execution:started") {
      onStart?.(exec);
    } else if (event.type === "execution:completed") {
      onComplete?.(exec);
    } else if (event.type === "execution:failed") {
      onFail?.(exec);
    }
  };

  const handleNodeEvent = (event: NodeEvent) => {
    const nodeId = event.nodeId;
    setExecution((prev) => {
      if (!prev) return prev;
      // Create a partial node execution result from the event
      const nodeResult: NodeExecutionResult = {
        nodeId,
        status: event.type === "node:started" ? "running" 
              : event.type === "node:completed" ? "completed" 
              : "failed",
        startedAt: Date.now(),
        retries: 0,
        output: event.type === "node:completed" ? (event as NodeCompletedEvent).output : undefined,
        error: event.type === "node:failed" ? (event as NodeFailedEvent).error : undefined,
      };
      
      // Update the executedNodes array
      const existingIndex = prev.executedNodes.findIndex(n => n.nodeId === nodeId);
      const newExecutedNodes = [...prev.executedNodes];
      if (existingIndex >= 0) {
        newExecutedNodes[existingIndex] = { ...newExecutedNodes[existingIndex], ...nodeResult };
      } else {
        newExecutedNodes.push(nodeResult);
      }
      return {
        ...prev,
        executedNodes: newExecutedNodes,
        currentNode: event.type === "node:started" ? nodeId : prev.currentNode,
      };
    });

    // Create a node result for callbacks
    const nodeResult: NodeExecution = {
      nodeId,
      status: event.type === "node:started" ? "running" 
            : event.type === "node:completed" ? "completed" 
            : "failed",
      startedAt: Date.now(),
      retries: 0,
    };

    if (event.type === "node:started") {
      onNodeStart?.(nodeResult);
    } else if (event.type === "node:completed") {
      onNodeComplete?.(nodeResult);
    } else if (event.type === "node:failed") {
      onNodeFail?.(nodeResult);
    }
  };

  const handleApprovalEvent = (event: ApprovalEvent) => {
    if (event.type === "approval:requested") {
      setExecution((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "waiting_approval",
        };
      });
      onApprovalRequired?.(event);
    }
  };

  // ============================================================================
  // Subscription Management
  // ============================================================================

  const subscribe = async (execId: ExecutionId): Promise<void> => {
    // Unsubscribe from previous
    unsubscribe();

    subscription = await eventService.trackExecution(execId, {
      onUpdate: handleExecutionEvent,
      onNodeStart: (event) => handleNodeEvent(event as unknown as NodeEvent),
      onNodeComplete: (event) => handleNodeEvent(event as unknown as NodeEvent),
      onNodeFail: (event) => handleNodeEvent(event as unknown as NodeEvent),
      onApprovalRequired: handleApprovalEvent,
      onComplete: handleExecutionEvent,
      onFail: handleExecutionEvent,
    });
  };

  const unsubscribe = (): void => {
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }
  };

  // ============================================================================
  // Execution Control
  // ============================================================================

  const start = async (
    workflowId: WorkflowId,
    input?: Record<string, unknown>
  ): Promise<WorkflowExecution> => {
    setError(null);

    try {
      const exec = await factory.startWorkflow(workflowId, input);
      setExecution(exec);

      if (autoSubscribe) {
        await subscribe(exec.id);
      }

      return exec;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to start execution";
      setError(message);
      throw e;
    }
  };

  const stop = async (): Promise<void> => {
    const exec = execution();
    if (!exec) return;

    try {
      await factory.stopWorkflow(exec.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to stop execution";
      setError(message);
      throw e;
    }
  };

  const pause = async (): Promise<void> => {
    const exec = execution();
    if (!exec) return;

    try {
      await factory.pauseWorkflow(exec.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to pause execution";
      setError(message);
      throw e;
    }
  };

  const resume = async (): Promise<void> => {
    const exec = execution();
    if (!exec) return;

    try {
      await factory.resumeWorkflow(exec.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to resume execution";
      setError(message);
      throw e;
    }
  };

  const retry = async (): Promise<WorkflowExecution | null> => {
    const exec = execution();
    if (!exec) return null;

    setError(null);

    try {
      // Retry by starting the workflow again with same variables
      const newExec = await factory.startWorkflow(exec.workflowId, exec.variables);
      setExecution(newExec);

      if (autoSubscribe) {
        await subscribe(newExec.id);
      }

      return newExec;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to retry execution";
      setError(message);
      throw e;
    }
  };

  // ============================================================================
  // Tracking
  // ============================================================================

  const track = async (execId: ExecutionId): Promise<void> => {
    setError(null);

    try {
      // Fetch execution data from factory context
      const exec = factory.executions().find((e) => e.id === execId);
      if (exec) {
        setExecution(exec);
      } else {
        // Try to get execution state directly
        const loaded = await factory.getExecutionState(execId);
        if (loaded) {
          setExecution(loaded);
        }
      }

      if (autoSubscribe) {
        await subscribe(execId);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to track execution";
      setError(message);
      throw e;
    }
  };

  const untrack = (): void => {
    unsubscribe();
    setExecution(null);
    setError(null);
  };

  const refresh = async (): Promise<void> => {
    const exec = execution();
    if (!exec) return;

    try {
      const updated = await factory.getExecutionState(exec.id);
      if (updated) {
        setExecution(updated);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to refresh execution";
      setError(message);
    }
  };

  // ============================================================================
  // Node Helpers
  // ============================================================================

  const getNodeExecution = (nodeId: NodeId): NodeExecution | undefined => {
    return nodeExecutions()[nodeId];
  };

  const isNodeRunning = (nodeId: NodeId): boolean => {
    const node = getNodeExecution(nodeId);
    return node?.status === "running";
  };

  const isNodeComplete = (nodeId: NodeId): boolean => {
    const node = getNodeExecution(nodeId);
    return node?.status === "completed";
  };

  const isNodeFailed = (nodeId: NodeId): boolean => {
    const node = getNodeExecution(nodeId);
    return node?.status === "failed";
  };

  // ============================================================================
  // Effects
  // ============================================================================

  // Track execution when ID changes
  createEffect(() => {
    const id = executionId?.();
    if (id) {
      track(id).catch(console.error);
    } else {
      untrack();
    }
  });

  // Update from context changes
  createEffect(() => {
    const exec = execution();
    if (!exec) return;

    const contextExec = factory.executions().find((e) => e.id === exec.id);
    if (contextExec && contextExec !== exec) {
      setExecution(contextExec);
    }
  });

  // Cleanup
  onCleanup(() => {
    unsubscribe();
  });

  // ============================================================================
  // Return
  // ============================================================================

  return {
    execution,
    status,
    isRunning,
    isPaused,
    isWaitingApproval,
    isComplete,
    isFailed,
    error,

    currentNodeId,
    nodeExecutions,
    progress,

    start,
    stop,
    pause,
    resume,
    retry,

    track,
    untrack,
    refresh,

    getNodeExecution,
    isNodeRunning,
    isNodeComplete,
    isNodeFailed,
  };
}

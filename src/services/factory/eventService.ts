/**
 * Factory Event Service - Tauri Event Subscriptions
 * Handles real-time event subscriptions for Factory operations
 * 
 * Events are emitted by the Rust backend via:
 * desktop/src-tauri/src/factory/events.rs
 */

import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type {
  Workflow,
  ExecutionState,
  AgentRuntimeState,
  PendingApproval,
  SupervisorDecision,
} from "./factoryService";

// ============================================================================
// Event Types (matching Rust factory/events.rs)
// ============================================================================

/** Workflow created event */
export interface WorkflowCreatedEvent {
  type: "workflow:created";
  workflow: Workflow;
}

/** Workflow updated event */
export interface WorkflowUpdatedEvent {
  type: "workflow:updated";
  workflow: Workflow;
}

/** Workflow deleted event */
export interface WorkflowDeletedEvent {
  type: "workflow:deleted";
  workflowId: string;
}

/** Execution started event */
export interface ExecutionStartedEvent {
  type: "execution:started";
  execution: ExecutionState;
}

/** Execution completed event */
export interface ExecutionCompletedEvent {
  type: "execution:completed";
  execution: ExecutionState;
}

/** Execution failed event */
export interface ExecutionFailedEvent {
  type: "execution:failed";
  execution: ExecutionState;
}

/** Execution paused event */
export interface ExecutionPausedEvent {
  type: "execution:paused";
  executionId: string;
}

/** Execution resumed event */
export interface ExecutionResumedEvent {
  type: "execution:resumed";
  executionId: string;
}

/** Execution stopped event */
export interface ExecutionStoppedEvent {
  type: "execution:stopped";
  executionId: string;
}

/** Node started event */
export interface NodeStartedEvent {
  type: "node:started";
  executionId: string;
  nodeId: string;
}

/** Node completed event */
export interface NodeCompletedEvent {
  type: "node:completed";
  executionId: string;
  nodeId: string;
  output?: unknown;
}

/** Node failed event */
export interface NodeFailedEvent {
  type: "node:failed";
  executionId: string;
  nodeId: string;
  error: string;
}

/** Agent spawned event */
export interface AgentSpawnedEvent {
  type: "agent:spawned";
  agent: AgentRuntimeState;
}

/** Agent updated event */
export interface AgentUpdatedEvent {
  type: "agent:updated";
  agent: AgentRuntimeState;
}

/** Agent removed event */
export interface AgentRemovedEvent {
  type: "agent:removed";
  agentId: string;
}

/** Approval requested event */
export interface ApprovalRequestedEvent {
  type: "approval:requested";
  approval: PendingApproval;
}

/** Approval granted event */
export interface ApprovalGrantedEvent {
  type: "approval:granted";
  approvalId: string;
  decision: SupervisorDecision;
}

/** Approval denied event */
export interface ApprovalDeniedEvent {
  type: "approval:denied";
  approvalId: string;
  decision: SupervisorDecision;
}

/** Approval modified event */
export interface ApprovalModifiedEvent {
  type: "approval:modified";
  approvalId: string;
  decision: SupervisorDecision;
}

/** Union of all factory events */
export type FactoryEvent =
  | WorkflowCreatedEvent
  | WorkflowUpdatedEvent
  | WorkflowDeletedEvent
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | ExecutionPausedEvent
  | ExecutionResumedEvent
  | ExecutionStoppedEvent
  | NodeStartedEvent
  | NodeCompletedEvent
  | NodeFailedEvent
  | AgentSpawnedEvent
  | AgentUpdatedEvent
  | AgentRemovedEvent
  | ApprovalRequestedEvent
  | ApprovalGrantedEvent
  | ApprovalDeniedEvent
  | ApprovalModifiedEvent;

/** Event type strings */
export type FactoryEventType = FactoryEvent["type"];

// ============================================================================
// Event Names (Tauri event channels)
// ============================================================================

/** Tauri event channel for factory events */
const FACTORY_EVENT_CHANNEL = "factory:event";

// ============================================================================
// Subscription Management
// ============================================================================

/** Active subscription handle */
export interface Subscription {
  /** Unsubscribe from events */
  unsubscribe: () => void;
}

/** Handler for any factory event */
export type FactoryEventHandler = (event: FactoryEvent) => void;

/** Filter options for event subscriptions */
export interface EventFilter {
  /** Filter by event types */
  eventTypes?: FactoryEventType[];
  /** Filter by workflow ID */
  workflowId?: string;
  /** Filter by execution ID */
  executionId?: string;
}

// Internal storage for the global listener
let globalUnlisten: UnlistenFn | null = null;
let handlerCount = 0;
const handlers = new Map<number, { handler: FactoryEventHandler; filter?: EventFilter }>();

/**
 * Initialize the global event listener
 * Called automatically when the first subscription is made
 */
async function initGlobalListener(): Promise<void> {
  if (globalUnlisten) return;

  globalUnlisten = await listen<FactoryEvent>(FACTORY_EVENT_CHANNEL, (event) => {
    const factoryEvent = event.payload;
    
    // Dispatch to all registered handlers
    handlers.forEach(({ handler, filter }) => {
      // Check if event matches filter
      if (filter) {
        if (filter.eventTypes && !filter.eventTypes.includes(factoryEvent.type)) {
          return;
        }
        
        // Check workflow ID filter
        if (filter.workflowId) {
          if ("workflow" in factoryEvent && factoryEvent.workflow?.id !== filter.workflowId) {
            return;
          }
          if ("execution" in factoryEvent && (factoryEvent.execution as ExecutionState)?.workflowId !== filter.workflowId) {
            return;
          }
        }
        
        // Check execution ID filter
        if (filter.executionId) {
          if ("execution" in factoryEvent && (factoryEvent.execution as ExecutionState)?.id !== filter.executionId) {
            return;
          }
          if ("executionId" in factoryEvent && factoryEvent.executionId !== filter.executionId) {
            return;
          }
        }
      }
      
      // Call handler
      try {
        handler(factoryEvent);
      } catch (error) {
        console.error("[FactoryEventService] Handler error:", error);
      }
    });
  });
}

/**
 * Cleanup the global listener when no more handlers exist
 */
function cleanupGlobalListener(): void {
  if (handlers.size === 0 && globalUnlisten) {
    globalUnlisten();
    globalUnlisten = null;
  }
}

// ============================================================================
// Public Subscription Functions
// ============================================================================

/**
 * Subscribe to all factory events
 */
export async function subscribeToAllEvents(
  handler: FactoryEventHandler,
  filter?: EventFilter
): Promise<Subscription> {
  await initGlobalListener();
  
  const id = ++handlerCount;
  handlers.set(id, { handler, filter });
  
  return {
    unsubscribe: () => {
      handlers.delete(id);
      cleanupGlobalListener();
    },
  };
}

/**
 * Subscribe to workflow events only
 */
export async function subscribeToWorkflows(
  handler: (event: WorkflowCreatedEvent | WorkflowUpdatedEvent | WorkflowDeletedEvent) => void,
  workflowId?: string
): Promise<Subscription> {
  const filter: EventFilter = {
    eventTypes: ["workflow:created", "workflow:updated", "workflow:deleted"],
    workflowId,
  };
  
  return subscribeToAllEvents((event) => {
    if (event.type.startsWith("workflow:")) {
      handler(event as WorkflowCreatedEvent | WorkflowUpdatedEvent | WorkflowDeletedEvent);
    }
  }, filter);
}

/**
 * Subscribe to execution events
 */
export async function subscribeToExecutions(
  handler: (event: ExecutionStartedEvent | ExecutionCompletedEvent | ExecutionFailedEvent | ExecutionPausedEvent | ExecutionResumedEvent | ExecutionStoppedEvent) => void,
  options?: {
    workflowId?: string;
    executionId?: string;
  }
): Promise<Subscription> {
  const filter: EventFilter = {
    eventTypes: [
      "execution:started",
      "execution:completed",
      "execution:failed",
      "execution:paused",
      "execution:resumed",
      "execution:stopped",
    ],
    workflowId: options?.workflowId,
    executionId: options?.executionId,
  };
  
  return subscribeToAllEvents((event) => {
    if (event.type.startsWith("execution:")) {
      handler(event as ExecutionStartedEvent | ExecutionCompletedEvent | ExecutionFailedEvent | ExecutionPausedEvent | ExecutionResumedEvent | ExecutionStoppedEvent);
    }
  }, filter);
}

/**
 * Subscribe to node execution events
 */
export async function subscribeToNodes(
  handler: (event: NodeStartedEvent | NodeCompletedEvent | NodeFailedEvent) => void,
  executionId?: string
): Promise<Subscription> {
  const filter: EventFilter = {
    eventTypes: ["node:started", "node:completed", "node:failed"],
    executionId,
  };
  
  return subscribeToAllEvents((event) => {
    if (event.type.startsWith("node:")) {
      handler(event as NodeStartedEvent | NodeCompletedEvent | NodeFailedEvent);
    }
  }, filter);
}

/**
 * Subscribe to approval events
 */
export async function subscribeToApprovals(
  handler: (event: ApprovalRequestedEvent | ApprovalGrantedEvent | ApprovalDeniedEvent | ApprovalModifiedEvent) => void,
  options?: {
    workflowId?: string;
    executionId?: string;
  }
): Promise<Subscription> {
  const filter: EventFilter = {
    eventTypes: ["approval:requested", "approval:granted", "approval:denied", "approval:modified"],
    workflowId: options?.workflowId,
    executionId: options?.executionId,
  };
  
  return subscribeToAllEvents((event) => {
    if (event.type.startsWith("approval:")) {
      handler(event as ApprovalRequestedEvent | ApprovalGrantedEvent | ApprovalDeniedEvent | ApprovalModifiedEvent);
    }
  }, filter);
}

/**
 * Subscribe to agent events
 */
export async function subscribeToAgents(
  handler: (event: AgentSpawnedEvent | AgentUpdatedEvent | AgentRemovedEvent) => void
): Promise<Subscription> {
  const filter: EventFilter = {
    eventTypes: ["agent:spawned", "agent:updated", "agent:removed"],
  };
  
  return subscribeToAllEvents((event) => {
    if (event.type.startsWith("agent:")) {
      handler(event as AgentSpawnedEvent | AgentUpdatedEvent | AgentRemovedEvent);
    }
  }, filter);
}

// ============================================================================
// Specialized Subscription Helpers
// ============================================================================

/**
 * Subscribe to a single execution's progress
 * Useful for tracking execution in real-time
 */
export async function trackExecution(
  executionId: string,
  handlers: {
    onUpdate?: (event: ExecutionStartedEvent | ExecutionCompletedEvent | ExecutionFailedEvent) => void;
    onNodeStart?: (event: NodeStartedEvent) => void;
    onNodeComplete?: (event: NodeCompletedEvent) => void;
    onNodeFail?: (event: NodeFailedEvent) => void;
    onApprovalRequired?: (event: ApprovalRequestedEvent) => void;
    onComplete?: (event: ExecutionCompletedEvent) => void;
    onFail?: (event: ExecutionFailedEvent) => void;
  }
): Promise<Subscription> {
  const subscriptions: Subscription[] = [];
  
  // All events for this execution
  const sub = await subscribeToAllEvents(
    (event) => {
      // Execution events
      if (event.type === "execution:started" || event.type === "execution:completed" || event.type === "execution:failed") {
        const execEvent = event as ExecutionStartedEvent | ExecutionCompletedEvent | ExecutionFailedEvent;
        if (execEvent.execution.id === executionId) {
          handlers.onUpdate?.(execEvent);
          if (event.type === "execution:completed") {
            handlers.onComplete?.(event as ExecutionCompletedEvent);
          } else if (event.type === "execution:failed") {
            handlers.onFail?.(event as ExecutionFailedEvent);
          }
        }
      }
      
      // Node events
      if (event.type === "node:started" && (event as NodeStartedEvent).executionId === executionId) {
        handlers.onNodeStart?.(event as NodeStartedEvent);
      }
      if (event.type === "node:completed" && (event as NodeCompletedEvent).executionId === executionId) {
        handlers.onNodeComplete?.(event as NodeCompletedEvent);
      }
      if (event.type === "node:failed" && (event as NodeFailedEvent).executionId === executionId) {
        handlers.onNodeFail?.(event as NodeFailedEvent);
      }
      
      // Approval events
      if (event.type === "approval:requested") {
        const approvalEvent = event as ApprovalRequestedEvent;
        if (approvalEvent.approval.executionId === executionId) {
          handlers.onApprovalRequired?.(approvalEvent);
        }
      }
    },
    { executionId }
  );
  subscriptions.push(sub);
  
  return {
    unsubscribe: () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    },
  };
}

/**
 * Subscribe to pending approval notifications
 */
export async function subscribeToPendingApprovals(
  handler: (approval: PendingApproval) => void
): Promise<Subscription> {
  return subscribeToApprovals((event) => {
    if (event.type === "approval:requested") {
      handler(event.approval);
    }
  });
}

// ============================================================================
// Event Utilities
// ============================================================================

/**
 * Helper to check if event is an execution completion
 */
export function isExecutionComplete(event: FactoryEvent): boolean {
  return (
    event.type === "execution:completed" ||
    event.type === "execution:failed" ||
    event.type === "execution:stopped"
  );
}

/**
 * Helper to check if event indicates an error
 */
export function isErrorEvent(event: FactoryEvent): boolean {
  return (
    event.type === "execution:failed" ||
    event.type === "node:failed" ||
    event.type === "approval:denied"
  );
}

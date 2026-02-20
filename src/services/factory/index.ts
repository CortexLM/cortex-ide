/**
 * Factory Service - Public Exports
 * Re-exports all factory service functionality
 */

// ============================================================================
// Factory Service (Tauri Commands)
// ============================================================================

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
} from "./factoryService";

// ============================================================================
// Event Service (Tauri Events)
// ============================================================================

export {
  // Types
  type FactoryEventHandler,
  type EventFilter,
  type Subscription,
  
  // Subscription Functions
  subscribeToAllEvents,
  subscribeToWorkflows,
  subscribeToExecutions,
  subscribeToNodes,
  subscribeToApprovals,
  subscribeToAgents,
  
  // Specialized Subscriptions
  trackExecution,
  subscribeToPendingApprovals,
  
  // Event Utilities
  isExecutionComplete,
  isErrorEvent,
} from "./eventService";

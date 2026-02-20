/**
 * Factory Hooks Index
 *
 * Re-exports all factory-related hooks for convenient importing.
 *
 * @example
 * import { useWorkflow, useExecution, useApprovals, useAudit } from '@/hooks/factory';
 */

// ============================================================================
// useWorkflow - Workflow editing with undo/redo
// ============================================================================

export {
  useWorkflow,
  type UseWorkflowOptions,
  type UseWorkflowReturn,
} from "./useWorkflow";

// ============================================================================
// useExecution - Execution tracking and control
// ============================================================================

export {
  useExecution,
  type ExecutionProgress,
  type UseExecutionOptions,
  type UseExecutionReturn,
} from "./useExecution";

// ============================================================================
// useApprovals - Approval management
// ============================================================================

export {
  useApprovals,
  getApprovalStatusIcon,
  getApprovalStatusColor,
  getApprovalActionLabel,
  isApprovalExpiringSoon,
  getApprovalTimeRemaining,
  formatApprovalRequest,
  type ApprovalFilter,
  type UseApprovalsOptions,
  type UseApprovalsReturn,
} from "./useApprovals";

// ============================================================================
// useAudit - Audit log with filtering and pagination
// ============================================================================

export {
  useAudit,
  formatAuditEntry,
  groupAuditEntriesByDate,
  type AuditStats,
  type UseAuditOptions,
  type UseAuditReturn,
} from "./useAudit";

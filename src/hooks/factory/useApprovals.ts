/**
 * useApprovals - Approval management hook
 * Updated to match Rust backend types
 */

import {
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  Accessor,
} from "solid-js";

import type {
  PendingApproval,
  ApprovalStatus,
  RiskLevel,
} from "../../services/factory/factoryService";

import { useFactory } from "../../context/FactoryContext";
import * as eventService from "../../services/factory/eventService";

// Type aliases
type ApprovalId = string;
type ExecutionId = string;
type WorkflowId = string;
type NodeId = string;

// ============================================================================
// Types
// ============================================================================

export interface ApprovalFilter {
  /** Filter by status */
  status?: ApprovalStatus[];
  /** Filter by workflow */
  workflowId?: WorkflowId;
  /** Filter by execution */
  executionId?: ExecutionId;
  /** Filter by risk level (minimum) */
  minRiskLevel?: RiskLevel;
}

export interface UseApprovalsOptions {
  /** Initial filter */
  initialFilter?: ApprovalFilter;
  /** Auto-load on mount */
  autoLoad?: boolean;
  /** Subscribe to real-time events */
  autoSubscribe?: boolean;
  /** Called when new approval request comes in */
  onNewApproval?: (approval: PendingApproval) => void;
  /** Called when an approval is responded to */
  onApprovalResponded?: (approvalId: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface UseApprovalsReturn {
  // State
  approvals: Accessor<PendingApproval[]>;
  pendingApprovals: Accessor<PendingApproval[]>;
  pendingCount: Accessor<number>;
  filter: Accessor<ApprovalFilter>;
  isLoading: Accessor<boolean>;
  error: Accessor<string | null>;

  // Selected approval
  selectedApproval: Accessor<PendingApproval | null>;
  selectApproval: (id: ApprovalId | null) => void;

  // Filter operations
  setFilter: (filter: ApprovalFilter) => void;
  updateFilter: (updates: Partial<ApprovalFilter>) => void;
  clearFilter: () => void;
  filterByExecution: (executionId: ExecutionId | null) => void;
  filterByWorkflow: (workflowId: WorkflowId | null) => void;

  // Approval actions
  approve: (id: ApprovalId, reason?: string) => Promise<void>;
  deny: (id: ApprovalId, reason?: string) => Promise<void>;
  modifyAndApprove: (
    id: ApprovalId,
    modifiedParams: unknown,
    reason?: string
  ) => Promise<void>;

  // Batch operations
  approveAll: (ids: ApprovalId[], reason?: string) => Promise<void>;
  denyAll: (ids: ApprovalId[], reason?: string) => Promise<void>;

  // Data operations
  load: () => Promise<void>;
  refresh: () => Promise<void>;

  // Utility
  getApprovalById: (id: ApprovalId) => PendingApproval | undefined;
  getApprovalsForExecution: (executionId: ExecutionId) => PendingApproval[];
  getApprovalsForNode: (executionId: ExecutionId, nodeId: NodeId) => PendingApproval[];
}

// Risk level ordering for filtering
const riskLevelOrder: Record<RiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useApprovals(options: UseApprovalsOptions = {}): UseApprovalsReturn {
  const {
    initialFilter = {},
    autoLoad = true,
    autoSubscribe = true,
    onNewApproval,
    onApprovalResponded,
    onError,
  } = options;

  const factory = useFactory();

  // ============================================================================
  // State
  // ============================================================================

  const [filter, setFilterState] = createSignal<ApprovalFilter>(initialFilter);
  const [selectedId, setSelectedId] = createSignal<ApprovalId | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Subscription handle
  let subscription: eventService.Subscription | null = null;

  // ============================================================================
  // Computed
  // ============================================================================

  // Get all approvals (from context, filtered)
  const approvals = createMemo(() => {
    const all = factory.pendingApprovals();
    const currentFilter = filter();

    return all.filter((approval) => {
      if (currentFilter.status && !currentFilter.status.includes(approval.status)) {
        return false;
      }
      if (currentFilter.executionId && approval.executionId !== currentFilter.executionId) {
        return false;
      }
      if (currentFilter.minRiskLevel) {
        const minOrder = riskLevelOrder[currentFilter.minRiskLevel];
        const approvalOrder = riskLevelOrder[approval.riskLevel];
        if (approvalOrder < minOrder) {
          return false;
        }
      }
      return true;
    });
  });

  const pendingApprovals = createMemo(() =>
    approvals().filter((a) => a.status === "pending")
  );

  const pendingCount = createMemo(() => pendingApprovals().length);

  const selectedApproval = createMemo(() => {
    const id = selectedId();
    if (!id) return null;
    return approvals().find((a) => a.id === id) ?? null;
  });

  // ============================================================================
  // Event Handling
  // ============================================================================

  const handleApprovalEvent = (event: eventService.FactoryEvent): void => {
    if (event.type === "approval:requested" && "approval" in event) {
      onNewApproval?.(event.approval);
    } else if (
      (event.type === "approval:granted" ||
        event.type === "approval:denied" ||
        event.type === "approval:modified") &&
      "approvalId" in event
    ) {
      onApprovalResponded?.(event.approvalId);

      // Clear selection if the responded approval was selected
      if (selectedId() === event.approvalId) {
        setSelectedId(null);
      }
    }
  };

  const setupSubscription = async (): Promise<void> => {
    if (subscription) {
      subscription.unsubscribe();
    }

    try {
      subscription = await eventService.subscribeToApprovals(handleApprovalEvent);
    } catch (e) {
      console.error("[useApprovals] Failed to setup subscription:", e);
    }
  };

  // ============================================================================
  // Filter Operations
  // ============================================================================

  const setFilter = (newFilter: ApprovalFilter): void => {
    setFilterState(newFilter);
  };

  const updateFilter = (updates: Partial<ApprovalFilter>): void => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  const clearFilter = (): void => {
    setFilterState({});
  };

  const filterByExecution = (executionId: ExecutionId | null): void => {
    updateFilter({ executionId: executionId ?? undefined });
  };

  const filterByWorkflow = (workflowId: WorkflowId | null): void => {
    updateFilter({ workflowId: workflowId ?? undefined });
  };

  // ============================================================================
  // Selection
  // ============================================================================

  const selectApproval = (id: ApprovalId | null): void => {
    setSelectedId(id);
  };

  // ============================================================================
  // Approval Actions
  // ============================================================================

  const approve = async (id: ApprovalId, reason?: string): Promise<void> => {
    setError(null);

    try {
      await factory.approveAction(id, reason);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to approve request";
      setError(message);
      onError?.(e instanceof Error ? e : new Error(message));
      throw e;
    }
  };

  const deny = async (id: ApprovalId, reason?: string): Promise<void> => {
    setError(null);

    try {
      await factory.denyAction(id, reason);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to deny request";
      setError(message);
      onError?.(e instanceof Error ? e : new Error(message));
      throw e;
    }
  };

  const modifyAndApprove = async (
    id: ApprovalId,
    modifiedParams: unknown,
    reason?: string
  ): Promise<void> => {
    setError(null);

    try {
      await factory.modifyAction(id, modifiedParams, reason);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to modify and approve";
      setError(message);
      onError?.(e instanceof Error ? e : new Error(message));
      throw e;
    }
  };

  // ============================================================================
  // Batch Operations
  // ============================================================================

  const approveAll = async (ids: ApprovalId[], reason?: string): Promise<void> => {
    setError(null);

    try {
      await Promise.all(ids.map((id) => factory.approveAction(id, reason)));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to approve all requests";
      setError(message);
      onError?.(e instanceof Error ? e : new Error(message));
      throw e;
    }
  };

  const denyAll = async (ids: ApprovalId[], reason?: string): Promise<void> => {
    setError(null);

    try {
      await Promise.all(ids.map((id) => factory.denyAction(id, reason)));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to deny all requests";
      setError(message);
      onError?.(e instanceof Error ? e : new Error(message));
      throw e;
    }
  };

  // ============================================================================
  // Data Operations
  // ============================================================================

  const load = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await factory.loadApprovals();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load approvals";
      setError(message);
      onError?.(e instanceof Error ? e : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = async (): Promise<void> => {
    await load();
  };

  // ============================================================================
  // Utility Functions
  // ============================================================================

  const getApprovalById = (id: ApprovalId): PendingApproval | undefined => {
    return approvals().find((a) => a.id === id);
  };

  const getApprovalsForExecution = (executionId: ExecutionId): PendingApproval[] => {
    return approvals().filter((a) => a.executionId === executionId);
  };

  const getApprovalsForNode = (executionId: ExecutionId, nodeId: NodeId): PendingApproval[] => {
    return approvals().filter(
      (a) => a.executionId === executionId && a.nodeId === nodeId
    );
  };

  // ============================================================================
  // Effects
  // ============================================================================

  // Setup subscription on mount
  createEffect(() => {
    if (autoSubscribe) {
      setupSubscription();
    }
  });

  // Auto-load on mount
  if (autoLoad) {
    load().catch(console.error);
  }

  // Cleanup
  onCleanup(() => {
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }
  });

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    approvals,
    pendingApprovals,
    pendingCount,
    filter,
    isLoading,
    error,

    // Selected approval
    selectedApproval,
    selectApproval,

    // Filter operations
    setFilter,
    updateFilter,
    clearFilter,
    filterByExecution,
    filterByWorkflow,

    // Approval actions
    approve,
    deny,
    modifyAndApprove,

    // Batch operations
    approveAll,
    denyAll,

    // Data operations
    load,
    refresh,

    // Utility
    getApprovalById,
    getApprovalsForExecution,
    getApprovalsForNode,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get icon for approval status
 */
export function getApprovalStatusIcon(status: ApprovalStatus): string {
  switch (status) {
    case "pending":
      return "hourglass_empty";
    case "approved":
      return "check_circle";
    case "denied":
      return "cancel";
    case "modified":
      return "edit";
    case "expired":
      return "schedule";
    case "cancelled":
      return "block";
    default:
      return "help";
  }
}

/**
 * Get color for approval status
 */
export function getApprovalStatusColor(status: ApprovalStatus): string {
  switch (status) {
    case "pending":
      return "var(--state-warning)";
    case "approved":
      return "var(--state-success)";
    case "denied":
      return "var(--state-error)";
    case "modified":
      return "var(--accent-primary)";
    case "expired":
      return "var(--state-warning)";
    case "cancelled":
      return "var(--text-muted)";
    default:
      return "var(--text-disabled)";
  }
}

/**
 * Get color for risk level
 */
export function getRiskLevelColor(risk: RiskLevel): string {
  switch (risk) {
    case "none":
      return "var(--text-muted)";
    case "low":
      return "var(--state-success)";
    case "medium":
      return "var(--state-warning)";
    case "high":
      return "var(--node-trigger)"; // Orange for high risk
    case "critical":
      return "var(--state-error)";
    default:
      return "var(--text-disabled)";
  }
}

/** Approval action type for UI */
type ApprovalAction = "approve" | "deny" | "modify" | "skip" | "escalate";

/**
 * Get label for approval action
 */
export function getApprovalActionLabel(action: ApprovalAction): string {
  switch (action) {
    case "approve":
      return "Approve";
    case "deny":
      return "Deny";
    case "modify":
      return "Modify & Approve";
    case "skip":
      return "Skip";
    case "escalate":
      return "Escalate";
    default:
      return action;
  }
}

/**
 * Check if approval is expiring soon (within 5 minutes)
 */
export function isApprovalExpiringSoon(approval: PendingApproval): boolean {
  const fiveMinutes = 5 * 60 * 1000;
  return approval.expiresAt - Date.now() < fiveMinutes;
}

/**
 * Get time remaining for approval (formatted string)
 */
export function getApprovalTimeRemaining(approval: PendingApproval): string {
  const remaining = approval.expiresAt - Date.now();
  if (remaining <= 0) return "Expired";

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format approval for display
 */
export function formatApprovalRequest(approval: PendingApproval): {
  title: string;
  subtitle: string;
  timeAgo: string;
  urgency: "low" | "medium" | "high";
} {
  const formatTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  let urgency: "low" | "medium" | "high" = "low";
  const remaining = approval.expiresAt - Date.now();
  if (remaining < 5 * 60 * 1000) {
    urgency = "high"; // Less than 5 minutes
  } else if (remaining < 30 * 60 * 1000) {
    urgency = "medium"; // Less than 30 minutes
  }

  // Also consider risk level for urgency
  if (approval.riskLevel === "critical" || approval.riskLevel === "high") {
    urgency = "high";
  } else if (approval.riskLevel === "medium" && urgency === "low") {
    urgency = "medium";
  }

  return {
    title: approval.description,
    subtitle: `${approval.actionType} - Node: ${approval.nodeId}`,
    timeAgo: formatTimeAgo(approval.requestedAt),
    urgency,
  };
}

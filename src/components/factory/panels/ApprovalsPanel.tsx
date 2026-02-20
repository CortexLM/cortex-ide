/**
 * =============================================================================
 * APPROVALS PANEL - Pending Approval Requests
 * =============================================================================
 * 
 * A panel for managing pending approval requests from agents in the Agent
 * Factory. Allows human operators to review, approve, deny, or modify
 * agent actions before they are executed.
 * 
 * Features:
 * - List of pending approval requests
 * - Agent name and action type display
 * - Supervisor analysis and reason
 * - Risk level badges
 * - Time waiting indicator
 * - Action buttons: Approve, Deny, Modify, Skip
 * - Bulk actions: Approve all safe, Deny all
 * - Empty state when no approvals
 * 
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  JSX,
} from "solid-js";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";
import { Modal } from "../../ui/Modal";
import { Textarea } from "../../ui/Input";

// =============================================================================
// TYPES
// =============================================================================

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ApprovalRequest {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  actionType: string;
  description: string;
  supervisorAnalysis: string;
  riskLevel: RiskLevel;
  requestedAt: Date;
  context?: Record<string, unknown>;
  suggestedModification?: string;
}

export interface ApprovalsPanelProps {
  /** Pending approval requests */
  requests?: ApprovalRequest[];
  /** Callback when a request is approved */
  onApprove?: (requestId: string) => void;
  /** Callback when a request is denied */
  onDeny?: (requestId: string, reason?: string) => void;
  /** Callback when a request is modified */
  onModify?: (requestId: string, modifiedAction: string) => void;
  /** Callback when a request is skipped */
  onSkip?: (requestId: string) => void;
  /** Callback for bulk approve all safe */
  onApproveAllSafe?: () => void;
  /** Callback for bulk deny all */
  onDenyAll?: (reason?: string) => void;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; variant: "default" | "accent" | "success" | "warning" | "error" }> = {
  low: { label: "Low Risk", color: "var(--cortex-success)", variant: "success" },
  medium: { label: "Medium Risk", color: "var(--cortex-warning)", variant: "warning" },
  high: { label: "High Risk", color: "var(--cortex-warning)", variant: "warning" },
  critical: { label: "Critical", color: "var(--cortex-error)", variant: "error" },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTimeWaiting(requestedAt: Date): string {
  const now = new Date();
  const diff = now.getTime() - requestedAt.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// =============================================================================
// MODIFY MODAL COMPONENT
// =============================================================================

interface ModifyModalProps {
  request: ApprovalRequest | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (modifiedAction: string) => void;
}

function ModifyModal(props: ModifyModalProps) {
  const [modifiedAction, setModifiedAction] = createSignal("");

  // Reset on open
  const handleOpen = () => {
    if (props.request) {
      setModifiedAction(props.request.suggestedModification || props.request.action);
    }
  };

  // Watch for changes
  createMemo(() => {
    if (props.open) {
      handleOpen();
    }
  });

  const handleSubmit = () => {
    props.onSubmit(modifiedAction());
    props.onClose();
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Modify Action"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Apply Modification
          </Button>
        </>
      }
    >
      <Show when={props.request}>
        <div>
          <div style={{ "margin-bottom": "16px" }}>
            <div style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: "var(--jb-text-header-color)", "margin-bottom": "6px" }}>
              Original Action
            </div>
            <div style={{ "font-family": "var(--jb-font-mono)", "font-size": "12px", background: "var(--jb-canvas)", padding: "8px 12px", "border-radius": "var(--jb-radius-sm)", color: "var(--jb-text-body-color)" }}>
              {props.request!.action}
            </div>
          </div>

          <div style={{ "margin-bottom": "16px" }}>
            <div style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: "var(--jb-text-header-color)", "margin-bottom": "6px" }}>
              Supervisor Analysis
            </div>
            <div style={{ "font-size": "13px", color: "var(--jb-text-muted-color)" }}>
              {props.request!.supervisorAnalysis}
            </div>
          </div>

          <Textarea
            label="Modified Action"
            value={modifiedAction()}
            onInput={(e) => setModifiedAction(e.currentTarget.value)}
            style={{ "min-height": "120px", "font-family": "var(--jb-font-mono)", "font-size": "12px" }}
            hint="Edit the action to make it safe for execution"
          />
        </div>
      </Show>
    </Modal>
  );
}

// =============================================================================
// DENY MODAL COMPONENT
// =============================================================================

interface DenyModalProps {
  open: boolean;
  isBulk?: boolean;
  onClose: () => void;
  onSubmit: (reason?: string) => void;
}

function DenyModal(props: DenyModalProps) {
  const [reason, setReason] = createSignal("");

  const handleSubmit = () => {
    props.onSubmit(reason() || undefined);
    setReason("");
    props.onClose();
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.isBulk ? "Deny All Requests" : "Deny Request"}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSubmit}>
            {props.isBulk ? "Deny All" : "Deny"}
          </Button>
        </>
      }
    >
      <div>
        <p style={{ "margin-bottom": "16px", color: "var(--jb-text-body-color)", "font-size": "13px" }}>
          {props.isBulk
            ? "Are you sure you want to deny all pending approval requests?"
            : "Are you sure you want to deny this request?"}
        </p>
        <Textarea
          label="Reason (optional)"
          value={reason()}
          onInput={(e) => setReason(e.currentTarget.value)}
          placeholder="Provide a reason for denying this request..."
          style={{ "min-height": "80px" }}
        />
      </div>
    </Modal>
  );
}

// =============================================================================
// APPROVAL CARD COMPONENT
// =============================================================================

interface ApprovalCardProps {
  request: ApprovalRequest;
  onApprove?: () => void;
  onDeny?: () => void;
  onModify?: () => void;
  onSkip?: () => void;
}

function ApprovalCard(props: ApprovalCardProps) {
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);

  const riskConfig = () => RISK_CONFIG[props.request.riskLevel];

  const containerStyle = (): JSX.CSSProperties => ({
    background: isHovered() ? "var(--jb-surface-hover)" : "var(--jb-surface-panel)",
    border: `1px solid ${riskConfig().color}30`,
    "border-left": `3px solid ${riskConfig().color}`,
    "border-radius": "var(--jb-radius-md)",
    overflow: "hidden",
    transition: "background var(--cortex-transition-fast)",
    "margin-bottom": "8px",
  });

  const headerStyle: JSX.CSSProperties = {
    padding: "12px",
  };

  const topRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    "margin-bottom": "8px",
  };

  const agentInfoStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const agentNameStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "12px",
    color: "var(--jb-text-body-color)",
    "margin-bottom": "8px",
    "line-height": "1.4",
  };

  const actionPreviewStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-mono)",
    "font-size": "11px",
    background: "var(--jb-canvas)",
    padding: "8px 10px",
    "border-radius": "var(--jb-radius-sm)",
    color: "var(--jb-text-muted-color)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    cursor: "pointer",
    "margin-bottom": "8px",
  };

  const analysisStyle: JSX.CSSProperties = {
    "font-size": "12px",
    color: "var(--jb-text-muted-color)",
    background: "var(--jb-canvas)",
    padding: "10px 12px",
    "border-radius": "var(--jb-radius-sm)",
    "margin-bottom": "12px",
    "border-left": "2px solid var(--jb-border-focus)",
  };

  const metaStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    "margin-bottom": "12px",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "flex-wrap": "wrap",
  };

  const expandedStyle: JSX.CSSProperties = {
    padding: "0 12px 12px",
    "border-top": "1px solid var(--jb-border-divider)",
    "padding-top": "12px",
  };

  const contextStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-mono)",
    "font-size": "11px",
    background: "var(--jb-canvas)",
    padding: "8px 12px",
    "border-radius": "var(--jb-radius-sm)",
    "white-space": "pre-wrap",
    "word-break": "break-all",
    "max-height": "150px",
    overflow: "auto",
    color: "var(--jb-text-muted-color)",
  };

  return (
    <div
      style={containerStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={headerStyle}>
        {/* Top Row */}
        <div style={topRowStyle}>
          <div style={agentInfoStyle}>
            <span style={agentNameStyle}>{props.request.agentName}</span>
            <Badge variant="default" size="sm">{props.request.actionType}</Badge>
            <Badge variant={riskConfig().variant} size="sm">{riskConfig().label}</Badge>
          </div>
          <button
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "20px",
              height: "20px",
              background: "transparent",
              border: "none",
              "border-radius": "var(--jb-radius-sm)",
              color: "var(--jb-icon-color-default)",
              cursor: "pointer",
              transition: "background var(--cortex-transition-fast)",
            }}
            onClick={() => setIsExpanded(!isExpanded())}
            title={isExpanded() ? "Collapse" : "Expand"}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--jb-surface-active)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              style={{
                transform: isExpanded() ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform var(--cortex-transition-fast)",
              }}
            >
              <path d="M2 3l3 3.5L8 3v1L5 7.5 2 4V3z" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <div style={descriptionStyle}>{props.request.description}</div>

        {/* Action Preview */}
        <div
          style={actionPreviewStyle}
          onClick={() => setIsExpanded(!isExpanded())}
          title="Click to expand"
        >
          {props.request.action}
        </div>

        {/* Supervisor Analysis */}
        <div style={analysisStyle}>
          <div style={{ "font-weight": "500", "margin-bottom": "4px", color: "var(--jb-text-body-color)" }}>
            Supervisor Analysis:
          </div>
          {props.request.supervisorAnalysis}
        </div>

        {/* Meta Info */}
        <div style={metaStyle}>
          <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zm0 9A4 4 0 1 1 6 2a4 4 0 0 1 0 8z" />
              <path d="M6 3v3l2 1-.4.8-2.6-1.3V3h1z" />
            </svg>
            <span>Waiting: {formatTimeWaiting(props.request.requestedAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={actionsStyle}>
          <Button
            variant="primary"
            size="sm"
            onClick={props.onApprove}
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 6l3 3 5-5-.7-.7L5 8 2.7 5.7 2 6z" />
              </svg>
            }
          >
            Approve
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={props.onDeny}
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M9.5 2.5l-7 7m0-7l7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" />
              </svg>
            }
          >
            Deny
          </Button>
          <Show when={props.request.riskLevel !== "low"}>
            <Button
              variant="secondary"
              size="sm"
              onClick={props.onModify}
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M10.5 1.5l-1-1-7 7v2h2l7-7-1-1zm-7.5 7v-.5l5.5-5.5.5.5-5.5 5.5H3z" />
                </svg>
              }
            >
              Modify
            </Button>
          </Show>
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onSkip}
          >
            Skip
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      <Show when={isExpanded()}>
        <div style={expandedStyle}>
          <div style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: "var(--jb-text-header-color)", "margin-bottom": "8px" }}>
            Full Action
          </div>
          <div style={{ ...contextStyle, "margin-bottom": "12px" }}>
            {props.request.action}
          </div>

          <Show when={props.request.context}>
            <div style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: "var(--jb-text-header-color)", "margin-bottom": "8px" }}>
              Context
            </div>
            <div style={contextStyle}>
              {JSON.stringify(props.request.context, null, 2)}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// =============================================================================
// APPROVALS PANEL COMPONENT
// =============================================================================

export function ApprovalsPanel(props: ApprovalsPanelProps) {
  const requests = () => props.requests || [];

  const [modifyRequest, setModifyRequest] = createSignal<ApprovalRequest | null>(null);
  const [showDenyModal, setShowDenyModal] = createSignal(false);
  const [denyRequestId, setDenyRequestId] = createSignal<string | null>(null);
  const [isBulkDeny, setIsBulkDeny] = createSignal(false);

  // Count stats
  const safeCount = createMemo(() => 
    requests().filter((r) => r.riskLevel === "low").length
  );
  const riskyCount = createMemo(() => 
    requests().filter((r) => ["high", "critical"].includes(r.riskLevel)).length
  );

  const handleDeny = (requestId: string) => {
    setDenyRequestId(requestId);
    setIsBulkDeny(false);
    setShowDenyModal(true);
  };

  const handleBulkDeny = () => {
    setDenyRequestId(null);
    setIsBulkDeny(true);
    setShowDenyModal(true);
  };

  const handleDenySubmit = (reason?: string) => {
    if (isBulkDeny()) {
      props.onDenyAll?.(reason);
    } else if (denyRequestId()) {
      props.onDeny?.(denyRequestId()!, reason);
    }
  };

  const handleModifySubmit = (modifiedAction: string) => {
    if (modifyRequest()) {
      props.onModify?.(modifyRequest()!.id, modifiedAction);
    }
  };

  // Styles
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    overflow: "hidden",
    ...props.style,
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "12px",
    "border-bottom": "1px solid var(--jb-border-divider)",
    "flex-wrap": "wrap",
    gap: "8px",
  };

  const titleStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
    padding: "12px",
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleStyle}>
          <span>Pending Approvals</span>
          <Badge variant="accent" size="sm">{requests().length}</Badge>
          <Show when={safeCount() > 0}>
            <Badge variant="success" size="sm">{safeCount()} safe</Badge>
          </Show>
          <Show when={riskyCount() > 0}>
            <Badge variant="error" size="sm">{riskyCount()} risky</Badge>
          </Show>
        </div>
        <Show when={requests().length > 0}>
          <div style={actionsStyle}>
            <Show when={safeCount() > 0}>
              <Button
                variant="primary"
                size="sm"
                onClick={props.onApproveAllSafe}
                icon={
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M2 6l3 3 5-5-.7-.7L5 8 2.7 5.7 2 6z" />
                  </svg>
                }
              >
                Approve Safe ({safeCount()})
              </Button>
            </Show>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkDeny}
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M9.5 2.5l-7 7m0-7l7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" />
                </svg>
              }
            >
              Deny All
            </Button>
          </div>
        </Show>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        <Show
          when={requests().length > 0}
          fallback={
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                  <path d="M16 2L6 7v9c0 6.6 4.3 12.7 10 14 5.7-1.3 10-7.4 10-14V7L16 2zm0 2.4l8 4v8.6c0 5.3-3.5 10.2-8 11.4-4.5-1.2-8-6.1-8-11.4V8.4l8-4z" />
                  <path d="M14 15.8l-2.8-2.8-1.4 1.4L14 18.6l8.2-8.2-1.4-1.4L14 15.8z" />
                </svg>
              }
              title="No Pending Approvals"
              description="When agents request approval for actions, they will appear here"
            />
          }
        >
          <For each={requests()}>
            {(request) => (
              <ApprovalCard
                request={request}
                onApprove={() => props.onApprove?.(request.id)}
                onDeny={() => handleDeny(request.id)}
                onModify={() => setModifyRequest(request)}
                onSkip={() => props.onSkip?.(request.id)}
              />
            )}
          </For>
        </Show>
      </div>

      {/* Modify Modal */}
      <ModifyModal
        request={modifyRequest()}
        open={modifyRequest() !== null}
        onClose={() => setModifyRequest(null)}
        onSubmit={handleModifySubmit}
      />

      {/* Deny Modal */}
      <DenyModal
        open={showDenyModal()}
        isBulk={isBulkDeny()}
        onClose={() => setShowDenyModal(false)}
        onSubmit={handleDenySubmit}
      />
    </div>
  );
}

export default ApprovalsPanel;


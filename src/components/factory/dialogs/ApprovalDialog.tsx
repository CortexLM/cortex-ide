/**
 * =============================================================================
 * APPROVAL DIALOG - Single Approval Request Modal
 * =============================================================================
 * 
 * A modal dialog for handling a single approval request from an agent.
 * Provides full details of the pending action and allows the human
 * operator to approve, deny, modify, skip, or escalate.
 * 
 * Features:
 * - Full details of the pending action
 * - Agent info and context
 * - What the agent wants to do (formatted display)
 * - Supervisor's analysis and reason
 * - Risk assessment with visual indicator
 * - Code preview (if file write)
 * - Command preview (if bash)
 * - Approve button (with confirmation)
 * - Deny button (with reason input)
 * - Modify button (opens editor for modification)
 * - Skip button (let another approver handle)
 * - Escalate button (for high-risk actions)
 * - Timer showing how long it's been waiting
 * 
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  Show,
  For,
  JSX,
  onMount,
  onCleanup,
} from "solid-js";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { Textarea } from "../../ui/Input";

// =============================================================================
// TYPES
// =============================================================================

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ActionType = "file_write" | "file_delete" | "bash_command" | "api_call" | "config_change" | "other";

export interface ApprovalContext {
  workflowId: string;
  workflowName: string;
  stepNumber: number;
  totalSteps: number;
  previousActions?: string[];
}

export interface FileWriteDetails {
  path: string;
  content: string;
  previousContent?: string;
  language?: string;
}

export interface BashCommandDetails {
  command: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
}

export interface ApprovalRequestDetails {
  id: string;
  agentId: string;
  agentName: string;
  agentIcon?: string;
  actionType: ActionType;
  action: string;
  description: string;
  supervisorAnalysis: string;
  supervisorRecommendation?: "approve" | "deny" | "modify";
  riskLevel: RiskLevel;
  requestedAt: Date;
  context: ApprovalContext;
  fileDetails?: FileWriteDetails;
  bashDetails?: BashCommandDetails;
  suggestedModification?: string;
  relatedApprovals?: number;
}

export interface ApprovalDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** The approval request to display */
  request?: ApprovalRequestDetails;
  /** Callback when request is approved */
  onApprove?: (requestId: string) => void;
  /** Callback when request is denied */
  onDeny?: (requestId: string, reason: string) => void;
  /** Callback when request is modified */
  onModify?: (requestId: string, modifiedAction: string) => void;
  /** Callback when request is skipped */
  onSkip?: (requestId: string) => void;
  /** Callback when request is escalated */
  onEscalate?: (requestId: string, note: string) => void;
  /** Loading state */
  loading?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bgColor: string; description: string }> = {
  low: {
    label: "Low Risk",
    color: "var(--cortex-success)",
    bgColor: "rgba(89, 168, 105, 0.15)",
    description: "Safe to approve automatically",
  },
  medium: {
    label: "Medium Risk",
    color: "var(--cortex-warning)",
    bgColor: "rgba(233, 170, 70, 0.15)",
    description: "Review recommended before approval",
  },
  high: {
    label: "High Risk",
    color: "var(--cortex-warning)",
    bgColor: "rgba(204, 120, 50, 0.15)",
    description: "Careful review required",
  },
  critical: {
    label: "Critical",
    color: "var(--cortex-error)",
    bgColor: "rgba(247, 84, 100, 0.15)",
    description: "May require escalation",
  },
};

const ACTION_TYPE_CONFIG: Record<ActionType, { label: string; icon: JSX.Element }> = {
  file_write: {
    label: "File Write",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M3 2h6l3 3v7H3V2zm1 1v8h7V6H9V3H4zm5 0v2h2l-2-2z" />
      </svg>
    ),
  },
  file_delete: {
    label: "File Delete",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M5 1h4v1h3v1H2V2h3V1zM3 4h8v8H3V4zm2 1v6h1V5H5zm3 0v6h1V5H8z" />
      </svg>
    ),
  },
  bash_command: {
    label: "Command",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M2 3h10v8H2V3zm1 1v6h8V4H3zm1 1l2 2-2 2v-1l1-1-1-1V5zm3 3h3v1H7V8z" />
      </svg>
    ),
  },
  api_call: {
    label: "API Call",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zm0 1a5 5 0 1 1 0 10A5 5 0 0 1 7 2z" />
        <path d="M4 7h6M7 4v6" />
      </svg>
    ),
  },
  config_change: {
    label: "Config Change",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M7 1l1 2h2l-1.5 1.5L10 7l-2-1-2 1 1.5-2.5L6 3h2l-1-2zm-4 6l.5 1H2l.8.8L2 10l1-.5 1 .5-.8-1.2L4 8H2.5L3 7zm6 2l.5 1H8l.8.8L8 12l1-.5 1 .5-.8-1.2L10 10H8.5L9 9z" />
      </svg>
    ),
  },
  other: {
    label: "Other",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1" fill="none" />
        <circle cx="7" cy="7" r="1.5" />
      </svg>
    ),
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatWaitingTime(requestedAt: Date): string {
  const now = new Date();
  const diff = now.getTime() - requestedAt.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// =============================================================================
// RISK INDICATOR COMPONENT
// =============================================================================

interface RiskIndicatorProps {
  level: RiskLevel;
}

function RiskIndicator(props: RiskIndicatorProps) {
  const config = () => RISK_CONFIG[props.level];

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "12px 16px",
    background: config().bgColor,
    "border-radius": "var(--jb-radius-md)",
    "border-left": `4px solid ${config().color}`,
  };

  const indicatorStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const dotsStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "4px",
  };

  const getDots = () => {
    const levels: RiskLevel[] = ["low", "medium", "high", "critical"];
    const currentIndex = levels.indexOf(props.level);
    return levels.map((_, i) => i <= currentIndex);
  };

  return (
    <div style={containerStyle}>
      <div style={indicatorStyle}>
        <div style={dotsStyle}>
          <For each={getDots()}>
            {(active) => (
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  "border-radius": "var(--cortex-radius-full)",
                  background: active ? config().color : "var(--jb-surface-active)",
                }}
              />
            )}
          </For>
        </div>
        <span style={{ "font-size": "13px", "font-weight": "600", color: config().color }}>
          {config().label}
        </span>
      </div>
      <span style={{ "font-size": "12px", color: "var(--jb-text-muted-color)" }}>
        {config().description}
      </span>
    </div>
  );
}

// =============================================================================
// CODE PREVIEW COMPONENT
// =============================================================================

interface CodePreviewProps {
  content: string;
  language?: string;
  title?: string;
  maxHeight?: string;
}

function CodePreview(props: CodePreviewProps) {
  const containerStyle: JSX.CSSProperties = {
    background: "var(--jb-canvas)",
    "border-radius": "var(--jb-radius-md)",
    overflow: "hidden",
    border: "1px solid var(--jb-border-default)",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 12px",
    background: "var(--jb-surface-panel)",
    "border-bottom": "1px solid var(--jb-border-divider)",
    "font-size": "11px",
    "font-weight": "600",
    color: "var(--jb-text-header-color)",
  };

  const codeStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-mono)",
    "font-size": "12px",
    "line-height": "1.5",
    padding: "12px",
    margin: "0",
    overflow: "auto",
    "max-height": props.maxHeight || "200px",
    color: "var(--jb-text-body-color)",
    "white-space": "pre-wrap",
    "word-break": "break-word",
  };

  return (
    <div style={containerStyle}>
      <Show when={props.title}>
        <div style={headerStyle}>
          <span>{props.title}</span>
          <Show when={props.language}>
            <Badge variant="default" size="sm">{props.language}</Badge>
          </Show>
        </div>
      </Show>
      <pre style={codeStyle}>{props.content}</pre>
    </div>
  );
}

// =============================================================================
// WAITING TIMER COMPONENT
// =============================================================================

interface WaitingTimerProps {
  requestedAt: Date;
}

function WaitingTimer(props: WaitingTimerProps) {
  const [time, setTime] = createSignal(formatWaitingTime(props.requestedAt));

  onMount(() => {
    const interval = setInterval(() => {
      setTime(formatWaitingTime(props.requestedAt));
    }, 1000);
    onCleanup(() => clearInterval(interval));
  });

  const timerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    "font-size": "12px",
    color: "var(--jb-text-muted-color)",
  };

  return (
    <div style={timerStyle}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ opacity: "0.6" }}>
        <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zm0 1a5 5 0 1 1 0 10A5 5 0 0 1 7 2z" />
        <path d="M7 3v4l3 1.5-.4.9L6 7.5V3h1z" />
      </svg>
      <span>Waiting: {time()}</span>
    </div>
  );
}

// =============================================================================
// APPROVAL DIALOG COMPONENT
// =============================================================================

export function ApprovalDialog(props: ApprovalDialogProps) {
  const request = () => props.request;

  const [mode, setMode] = createSignal<"view" | "deny" | "modify" | "escalate">("view");
  const [denyReason, setDenyReason] = createSignal("");
  const [modifiedAction, setModifiedAction] = createSignal("");
  const [escalateNote, setEscalateNote] = createSignal("");
  const [confirmApprove, setConfirmApprove] = createSignal(false);

  // Reset state when request changes
  createEffect(() => {
    if (props.open) {
      setMode("view");
      setDenyReason("");
      setEscalateNote("");
      setConfirmApprove(false);
      setModifiedAction(request()?.suggestedModification || request()?.action || "");
    }
  });

  const actionConfig = () => request() ? ACTION_TYPE_CONFIG[request()!.actionType] : null;

  const handleApprove = () => {
    if (request()?.riskLevel === "high" || request()?.riskLevel === "critical") {
      if (!confirmApprove()) {
        setConfirmApprove(true);
        return;
      }
    }
    props.onApprove?.(request()!.id);
    props.onClose();
  };

  const handleDeny = () => {
    props.onDeny?.(request()!.id, denyReason());
    props.onClose();
  };

  const handleModify = () => {
    props.onModify?.(request()!.id, modifiedAction());
    props.onClose();
  };

  const handleEscalate = () => {
    props.onEscalate?.(request()!.id, escalateNote());
    props.onClose();
  };

  const handleSkip = () => {
    props.onSkip?.(request()!.id);
    props.onClose();
  };

  // Styles
  const sectionStyle: JSX.CSSProperties = {
    "margin-bottom": "20px",
  };

  const sectionTitleStyle: JSX.CSSProperties = {
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--jb-text-header-color)",
    "margin-bottom": "10px",
  };

  const agentRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "12px",
    background: "var(--jb-surface-panel)",
    "border-radius": "var(--jb-radius-md)",
  };

  const agentIconStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "40px",
    height: "40px",
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--jb-border-focus)",
    color: "var(--cortex-text-primary)",
  };

  const contextStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-wrap": "wrap",
    gap: "12px",
    "font-size": "12px",
    color: "var(--jb-text-muted-color)",
  };

  const analysisStyle: JSX.CSSProperties = {
    background: "var(--jb-canvas)",
    "border-radius": "var(--jb-radius-md)",
    padding: "12px",
    "border-left": "3px solid var(--jb-border-focus)",
    "font-size": "13px",
    color: "var(--jb-text-body-color)",
    "line-height": "1.5",
  };

  const footerActionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    gap: "8px",
    "flex-wrap": "wrap",
  };

  const primaryActionsStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "8px",
  };

  const secondaryActionsStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "8px",
  };

  const renderFooter = () => {
    if (mode() === "deny") {
      return (
        <>
          <Button variant="ghost" onClick={() => setMode("view")}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeny} disabled={!denyReason().trim()}>
            Deny Request
          </Button>
        </>
      );
    }

    if (mode() === "modify") {
      return (
        <>
          <Button variant="ghost" onClick={() => setMode("view")}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleModify}>
            Apply Modification
          </Button>
        </>
      );
    }

    if (mode() === "escalate") {
      return (
        <>
          <Button variant="ghost" onClick={() => setMode("view")}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleEscalate}>
            Escalate
          </Button>
        </>
      );
    }

    return (
      <div style={footerActionsStyle}>
        <div style={secondaryActionsStyle}>
          <Button variant="ghost" onClick={handleSkip}>
            Skip
          </Button>
          <Show when={request()?.riskLevel === "high" || request()?.riskLevel === "critical"}>
            <Button variant="ghost" onClick={() => setMode("escalate")}>
              Escalate
            </Button>
          </Show>
        </div>
        <div style={primaryActionsStyle}>
          <Button variant="danger" onClick={() => setMode("deny")}>
            Deny
          </Button>
          <Show when={request()?.riskLevel !== "low"}>
            <Button variant="secondary" onClick={() => setMode("modify")}>
              Modify
            </Button>
          </Show>
          <Button
            variant="primary"
            onClick={handleApprove}
            loading={props.loading}
          >
            {confirmApprove() ? "Confirm Approve" : "Approve"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Approval Request"
      size="lg"
      style={{ width: "700px", "max-width": "95vw" }}
      footer={request() ? renderFooter() : undefined}
    >
      <Show when={request()} fallback={<div style={{ padding: "20px", color: "var(--jb-text-muted-color)" }}>No request selected</div>}>
        {/* View Mode */}
        <Show when={mode() === "view"}>
          {/* Timer */}
          <div style={{ display: "flex", "justify-content": "flex-end", "margin-bottom": "16px" }}>
            <WaitingTimer requestedAt={request()!.requestedAt} />
          </div>

          {/* Agent Info */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Agent</div>
            <div style={agentRowStyle}>
              <div style={agentIconStyle}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="10" cy="7" r="3" />
                  <path d="M4 16c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                </svg>
              </div>
              <div style={{ flex: "1" }}>
                <div style={{ "font-size": "14px", "font-weight": "600", color: "var(--jb-text-body-color)" }}>
                  {request()!.agentName}
                </div>
                <div style={contextStyle}>
                  <span>Workflow: {request()!.context.workflowName}</span>
                  <span>Step {request()!.context.stepNumber} of {request()!.context.totalSteps}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <Badge variant="default" size="sm">
                  {actionConfig()?.icon}
                  <span style={{ "margin-left": "4px" }}>{actionConfig()?.label}</span>
                </Badge>
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Risk Assessment</div>
            <RiskIndicator level={request()!.riskLevel} />
          </div>

          {/* Action Description */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Requested Action</div>
            <div style={{ "font-size": "13px", color: "var(--jb-text-body-color)", "margin-bottom": "12px" }}>
              {request()!.description}
            </div>
            <CodePreview
              content={request()!.action}
              title="Action Details"
            />
          </div>

          {/* File Preview (if applicable) */}
          <Show when={request()!.fileDetails}>
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>File Changes</div>
              <div style={{ "font-size": "12px", color: "var(--jb-text-muted-color)", "margin-bottom": "8px" }}>
                <strong>Path:</strong> {request()!.fileDetails!.path}
              </div>
              <CodePreview
                content={request()!.fileDetails!.content}
                language={request()!.fileDetails!.language}
                title="New Content"
                maxHeight="150px"
              />
            </div>
          </Show>

          {/* Bash Command Preview (if applicable) */}
          <Show when={request()!.bashDetails}>
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Command Details</div>
              <Show when={request()!.bashDetails!.workingDirectory}>
                <div style={{ "font-size": "12px", color: "var(--jb-text-muted-color)", "margin-bottom": "8px" }}>
                  <strong>Working Directory:</strong> {request()!.bashDetails!.workingDirectory}
                </div>
              </Show>
              <CodePreview
                content={request()!.bashDetails!.command}
                language="bash"
                title="Command"
              />
            </div>
          </Show>

          {/* Supervisor Analysis */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", "align-items": "center", gap: "8px", ...sectionTitleStyle }}>
              Supervisor Analysis
              <Show when={request()!.supervisorRecommendation}>
                <Badge
                  variant={
                    request()!.supervisorRecommendation === "approve"
                      ? "success"
                      : request()!.supervisorRecommendation === "deny"
                        ? "error"
                        : "warning"
                  }
                  size="sm"
                >
                  Recommends: {request()!.supervisorRecommendation}
                </Badge>
              </Show>
            </div>
            <div style={analysisStyle}>
              {request()!.supervisorAnalysis}
            </div>
          </div>
        </Show>

        {/* Deny Mode */}
        <Show when={mode() === "deny"}>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Reason for Denial</div>
            <Textarea
              placeholder="Please provide a reason for denying this request..."
              value={denyReason()}
              onInput={(e) => setDenyReason(e.currentTarget.value)}
              style={{ "min-height": "120px" }}
            />
            <div style={{ "font-size": "11px", color: "var(--jb-text-muted-color)", "margin-top": "8px" }}>
              This reason will be provided to the agent for context.
            </div>
          </div>
        </Show>

        {/* Modify Mode */}
        <Show when={mode() === "modify"}>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Original Action</div>
            <CodePreview content={request()!.action} />
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Modified Action</div>
            <Textarea
              placeholder="Edit the action to make it safe..."
              value={modifiedAction()}
              onInput={(e) => setModifiedAction(e.currentTarget.value)}
              style={{ "min-height": "150px", "font-family": "var(--jb-font-mono)", "font-size": "12px" }}
            />
            <div style={{ "font-size": "11px", color: "var(--jb-text-muted-color)", "margin-top": "8px" }}>
              The modified action will be executed instead of the original.
            </div>
          </div>
        </Show>

        {/* Escalate Mode */}
        <Show when={mode() === "escalate"}>
          <div style={sectionStyle}>
            <RiskIndicator level={request()!.riskLevel} />
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Escalation Note</div>
            <Textarea
              placeholder="Add any notes for the escalation handler..."
              value={escalateNote()}
              onInput={(e) => setEscalateNote(e.currentTarget.value)}
              style={{ "min-height": "100px" }}
            />
            <div style={{ "font-size": "11px", color: "var(--jb-text-muted-color)", "margin-top": "8px" }}>
              This request will be forwarded to a higher-level approver.
            </div>
          </div>
        </Show>
      </Show>
    </Modal>
  );
}

export default ApprovalDialog;


import { JSX, For, Show, createSignal } from "solid-js";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";

export interface FileChange {
  path: string;
  changeType: "create" | "modify" | "delete" | "rename";
  description?: string;
}

export interface PlanStep {
  description: string;
  fileChanges: FileChange[];
  estimatedTime?: string;
}

export interface SpecPlan {
  title: string;
  summary: string;
  steps: PlanStep[];
  filesAffected: string[];
  estimatedTotalTime?: string;
}

interface SpecPlanDialogProps {
  plan: SpecPlan;
  isOpen: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
  approving?: boolean;
}

export function SpecPlanDialog(props: SpecPlanDialogProps) {
  const [expandedSteps, setExpandedSteps] = createSignal<number[]>([0]);

  const toggleStep = (index: number) => {
    const current = expandedSteps();
    if (current.includes(index)) {
      setExpandedSteps(current.filter((i) => i !== index));
    } else {
      setExpandedSteps([...current, index]);
    }
  };

  const changeTypeIcon = (type: FileChange["changeType"]) => {
    switch (type) {
      case "create":
        return { icon: "plus", color: "var(--state-success)" };
      case "modify":
        return { icon: "pen", color: "var(--state-warning)" };
      case "delete":
        return { icon: "trash", color: "var(--state-error)" };
      case "rename":
        return { icon: "arrow-right-arrow-left", color: "var(--accent-primary)" };
    }
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "20px",
  };

  const summaryStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "14px",
    "line-height": "1.6",
    color: "var(--text-primary)",
    margin: "0",
  };

  const stepsContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
  };

  const stepHeaderStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "flex-start",
    gap: "12px",
    cursor: "pointer",
  };

  const stepNumberStyle: JSX.CSSProperties = {
    width: "24px",
    height: "24px",
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--surface-hover)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "font-family": "var(--jb-font-ui)",
    "font-size": "12px",
    "font-weight": "600",
    color: "var(--text-primary)",
    "flex-shrink": "0",
  };

  const stepContentStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
  };

  const stepDescStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "14px",
    color: "var(--text-primary)",
    margin: "0 0 8px",
  };

  const fileChangesStyle: JSX.CSSProperties = {
    "padding-left": "36px",
    "margin-top": "8px",
    display: "flex",
    "flex-direction": "column",
    gap: "4px",
  };

  const fileChangeStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "font-family": "var(--jb-font-mono)",
    "font-size": "12px",
    color: "var(--text-muted)",
    padding: "4px 8px",
    background: "var(--surface-base)",
    "border-radius": "var(--jb-radius-sm)",
  };

  const statsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "16px",
    padding: "12px",
    background: "var(--surface-base)",
    "border-radius": "var(--jb-radius-sm)",
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--text-muted)",
  };

  const statItemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
  };

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title="Review Implementation Plan"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={props.onReject} disabled={props.approving}>
            Reject
          </Button>
          <Button
            variant="primary"
            onClick={props.onApprove}
            loading={props.approving}
            icon={<Icon name="play" size={14} />}
          >
            Approve & Build
          </Button>
        </>
      }
    >
      <div style={containerStyle}>
        {/* Title & Summary */}
        <div>
          <h3
            style={{
              "font-family": "var(--jb-font-ui)",
              "font-size": "16px",
              "font-weight": "600",
              color: "var(--text-title)",
              margin: "0 0 8px",
            }}
          >
            {props.plan.title}
          </h3>
          <p style={summaryStyle}>{props.plan.summary}</p>
        </div>

        {/* Stats */}
        <div style={statsStyle}>
          <div style={statItemStyle}>
            <Icon name="list-check" size={14} />
            <span>{props.plan.steps.length} steps</span>
          </div>
          <div style={statItemStyle}>
            <Icon name="file" size={14} />
            <span>{props.plan.filesAffected.length} files affected</span>
          </div>
          <Show when={props.plan.estimatedTotalTime}>
            <div style={statItemStyle}>
              <Icon name="clock" size={14} />
              <span>~{props.plan.estimatedTotalTime}</span>
            </div>
          </Show>
        </div>

        {/* Steps */}
        <div>
          <h4
            style={{
              "font-family": "var(--jb-font-ui)",
              "font-size": "13px",
              "font-weight": "600",
              color: "var(--text-primary)",
              margin: "0 0 12px",
              "text-transform": "uppercase",
              "letter-spacing": "0.5px",
            }}
          >
            Implementation Steps
          </h4>
          <div style={stepsContainerStyle}>
            <For each={props.plan.steps}>
              {(step, index) => {
                const isExpanded = () => expandedSteps().includes(index());
                return (
                  <Card variant="outlined" padding="md">
                    <div style={stepHeaderStyle} onClick={() => toggleStep(index())}>
                      <div style={stepNumberStyle}>{index() + 1}</div>
                      <div style={stepContentStyle}>
                        <p style={stepDescStyle}>{step.description}</p>
                        <Show when={step.fileChanges.length > 0}>
                          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                            <Badge variant="default" size="sm">
                              {step.fileChanges.length} file{step.fileChanges.length !== 1 ? "s" : ""}
                            </Badge>
                            <Show when={step.estimatedTime}>
                              <span
                                style={{
                                  "font-size": "11px",
                                  color: "var(--text-weaker)",
                                }}
                              >
                                ~{step.estimatedTime}
                              </span>
                            </Show>
                          </div>
                        </Show>
                      </div>
                      <Icon
                        name={isExpanded() ? "chevron-up" : "chevron-down"}
                        size={14}
                        style={{ color: "var(--text-muted)", "flex-shrink": "0" }}
                      />
                    </div>

                    <Show when={isExpanded() && step.fileChanges.length > 0}>
                      <div style={fileChangesStyle}>
                        <For each={step.fileChanges}>
                          {(change) => {
                            const typeConfig = changeTypeIcon(change.changeType);
                            return (
                              <div style={fileChangeStyle}>
                                <Icon
                                  name={typeConfig.icon as any}
                                  size={12}
                                  style={{ color: typeConfig.color }}
                                />
                                <code>{change.path}</code>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  </Card>
                );
              }}
            </For>
          </div>
        </div>

        {/* Files Affected Summary */}
        <Show when={props.plan.filesAffected.length > 0}>
          <div>
            <h4
              style={{
                "font-family": "var(--jb-font-ui)",
                "font-size": "13px",
                "font-weight": "600",
                color: "var(--text-primary)",
                margin: "0 0 8px",
                "text-transform": "uppercase",
                "letter-spacing": "0.5px",
              }}
            >
              All Files Affected
            </h4>
            <div
              style={{
                display: "flex",
                "flex-wrap": "wrap",
                gap: "6px",
                "max-height": "100px",
                "overflow-y": "auto",
              }}
            >
              <For each={props.plan.filesAffected}>
                {(file) => (
                  <Badge variant="default" size="sm">
                    <code style={{ "font-size": "11px" }}>{file}</code>
                  </Badge>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Modal>
  );
}


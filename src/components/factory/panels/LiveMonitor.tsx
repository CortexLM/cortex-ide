/**
 * =============================================================================
 * LIVE MONITOR - Agent Monitoring Panel
 * =============================================================================
 * 
 * A real-time monitoring panel for active agents in the Agent Factory. Displays
 * agent status, progress, current activity, token usage, and allows control
 * over running agents.
 * 
 * Features:
 * - List of active agents with status badges
 * - Progress bars (current step / max steps)
 * - Current activity display (tool being called)
 * - Token usage metrics
 * - Duration tracking
 * - Expandable step history
 * - Supervisor section
 * - Pause/Resume/Stop controls
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
import { ProgressBar } from "../../ui/ProgressBar";
import { EmptyState } from "../../ui/EmptyState";

// =============================================================================
// TYPES
// =============================================================================

export type AgentStatus = 
  | "idle"
  | "running"
  | "waiting"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentStep {
  id: string;
  type: "tool" | "thinking" | "decision" | "output";
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  startTime?: Date;
  endTime?: Date;
  result?: string;
  error?: string;
}

export interface ActiveAgent {
  id: string;
  name: string;
  status: AgentStatus;
  currentStep: number;
  maxSteps: number;
  currentActivity?: string;
  currentTool?: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  startTime: Date;
  steps: AgentStep[];
  isSupervisor?: boolean;
  supervisorId?: string;
}

export interface LiveMonitorProps {
  /** Active agents to display */
  agents?: ActiveAgent[];
  /** Callback when an agent is paused */
  onPauseAgent?: (agentId: string) => void;
  /** Callback when an agent is resumed */
  onResumeAgent?: (agentId: string) => void;
  /** Callback when an agent is stopped */
  onStopAgent?: (agentId: string) => void;
  /** Callback to pause all agents */
  onPauseAll?: () => void;
  /** Callback to resume all agents */
  onResumeAll?: () => void;
  /** Callback to stop all agents */
  onStopAll?: () => void;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_CONFIG: Record<AgentStatus, { color: string; label: string; variant: "default" | "accent" | "success" | "warning" | "error" }> = {
  idle: { color: "var(--cortex-text-inactive)", label: "Idle", variant: "default" },
  running: { color: "var(--cortex-info)", label: "Running", variant: "accent" },
  waiting: { color: "var(--cortex-warning)", label: "Waiting", variant: "warning" },
  paused: { color: "var(--cortex-info)", label: "Paused", variant: "accent" },
  completed: { color: "var(--cortex-success)", label: "Completed", variant: "success" },
  failed: { color: "var(--cortex-error)", label: "Failed", variant: "error" },
  cancelled: { color: "var(--cortex-text-inactive)", label: "Cancelled", variant: "default" },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDuration(startTime: Date): string {
  const now = new Date();
  const diff = now.getTime() - startTime.getTime();
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

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return String(tokens);
}

// =============================================================================
// AGENT CARD COMPONENT
// =============================================================================

interface AgentCardProps {
  agent: ActiveAgent;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

function AgentCard(props: AgentCardProps) {
  const [expanded, setExpanded] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);

  const statusConfig = () => STATUS_CONFIG[props.agent.status];
  const progressPercent = () => 
    props.agent.maxSteps > 0 
      ? (props.agent.currentStep / props.agent.maxSteps) * 100 
      : 0;

  const canPause = () => props.agent.status === "running";
  const canResume = () => props.agent.status === "paused";
  const canStop = () => ["running", "paused", "waiting"].includes(props.agent.status);

  const containerStyle = (): JSX.CSSProperties => ({
    background: isHovered() ? "var(--jb-surface-hover)" : "var(--jb-surface-panel)",
    "border-radius": "var(--jb-radius-md)",
    border: props.agent.isSupervisor
      ? "1px solid rgba(157, 91, 210, 0.3)"
      : "1px solid var(--jb-border-default)",
    overflow: "hidden",
    transition: "background var(--cortex-transition-fast)",
    "margin-bottom": "8px",
  });

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "10px",
    padding: "10px 12px",
    cursor: "pointer",
    "user-select": "none",
  };

  const infoStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
    overflow: "hidden",
  };

  const nameStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  };

  const activityStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    "margin-top": "4px",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  };

  const metricsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "8px 12px",
    background: "var(--jb-canvas)",
    "border-top": "1px solid var(--jb-border-divider)",
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
  };

  const metricStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  };

  const actionsStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    "flex-shrink": "0",
    opacity: isHovered() ? "1" : "0.5",
    transition: "opacity var(--cortex-transition-fast)",
  });

  const iconButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "24px",
    height: "24px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    color: "var(--jb-icon-color-default)",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  };

  const expandedStyle: JSX.CSSProperties = {
    "border-top": "1px solid var(--jb-border-divider)",
    padding: "12px",
    "max-height": "200px",
    overflow: "auto",
  };

  const stepStyle = (step: AgentStep): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "4px 0",
    "font-size": "11px",
    color: step.status === "running" 
      ? "var(--jb-text-body-color)" 
      : "var(--jb-text-muted-color)",
    opacity: step.status === "pending" ? "0.5" : "1",
  });

  const stepIconStyle = (step: AgentStep): JSX.CSSProperties => ({
    width: "12px",
    height: "12px",
    "border-radius": "var(--cortex-radius-full)",
    background: step.status === "completed" 
      ? "var(--cortex-success)" 
      : step.status === "failed"
        ? "var(--cortex-error)"
        : step.status === "running"
          ? "var(--cortex-info)"
          : "var(--jb-border-default)",
    "flex-shrink": "0",
  });

  return (
    <div
      style={containerStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div
        style={headerStyle}
        onClick={() => setExpanded(!expanded())}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded());
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={expanded()}
      >
        {/* Status Indicator */}
        <div
          style={{
            width: "8px",
            height: "8px",
            "border-radius": "var(--cortex-radius-full)",
            background: statusConfig().color,
            "flex-shrink": "0",
            animation: props.agent.status === "running" ? "pulse 2s infinite" : "none",
          }}
        />

        {/* Info */}
        <div style={infoStyle}>
          <div style={nameStyle}>
            <span>{props.agent.name}</span>
            <Show when={props.agent.isSupervisor}>
              <Badge variant="accent" size="sm">Supervisor</Badge>
            </Show>
            <Badge variant={statusConfig().variant} size="sm">{statusConfig().label}</Badge>
          </div>
          <Show when={props.agent.currentActivity}>
            <div style={activityStyle}>
              <Show when={props.agent.currentTool}>
                <span style={{ color: "var(--cortex-success)" }}>[{props.agent.currentTool}]</span>{" "}
              </Show>
              {props.agent.currentActivity}
            </div>
          </Show>
        </div>

        {/* Actions */}
        <div style={actionsStyle()}>
          <Show when={canPause()}>
            <button
              style={iconButtonStyle}
              onClick={(e) => {
                e.stopPropagation();
                props.onPause?.();
              }}
              title="Pause"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--jb-surface-active)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 2h2v8H3V2zM7 2h2v8H7V2z" />
              </svg>
            </button>
          </Show>
          <Show when={canResume()}>
            <button
              style={iconButtonStyle}
              onClick={(e) => {
                e.stopPropagation();
                props.onResume?.();
              }}
              title="Resume"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--jb-surface-active)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 1v10l8-5-8-5z" />
              </svg>
            </button>
          </Show>
          <Show when={canStop()}>
            <button
              style={{
                ...iconButtonStyle,
                color: "var(--cortex-error)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                props.onStop?.();
              }}
              title="Stop"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(247, 84, 100, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 2h8v8H2V2z" />
              </svg>
            </button>
          </Show>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            style={{
              transform: expanded() ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform var(--cortex-transition-fast)",
              color: "var(--jb-icon-color-default)",
              "margin-left": "4px",
            }}
          >
            <path d="M2 3l3 3.5L8 3v1L5 7.5 2 4V3z" />
          </svg>
        </div>
      </div>

      {/* Progress */}
      <Show when={props.agent.maxSteps > 0}>
        <div style={{ padding: "0 12px 8px" }}>
          <div style={{ display: "flex", "justify-content": "space-between", "font-size": "10px", color: "var(--jb-text-muted-color)", "margin-bottom": "4px" }}>
            <span>Step {props.agent.currentStep} / {props.agent.maxSteps}</span>
            <span>{Math.round(progressPercent())}%</span>
          </div>
          <ProgressBar
            value={progressPercent()}
            variant={props.agent.status === "failed" ? "error" : props.agent.status === "completed" ? "success" : "primary"}
            size="sm"
          />
        </div>
      </Show>

      {/* Metrics */}
      <div style={metricsStyle}>
        <div style={metricStyle}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zm0 9A4 4 0 1 1 6 2a4 4 0 0 1 0 8z" />
            <path d="M6 3v3l2 1-.4.8-2.6-1.3V3h1z" />
          </svg>
          <span>{formatDuration(props.agent.startTime)}</span>
        </div>
        <div style={metricStyle}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M1 2h10v1H1V2zM1 5h8v1H1V5zM1 8h10v1H1V8z" />
          </svg>
          <span>{formatTokens(props.agent.tokenUsage.total)} tokens</span>
        </div>
        <div style={{ ...metricStyle, "margin-left": "auto" }}>
          <span style={{ opacity: 0.6 }}>In: {formatTokens(props.agent.tokenUsage.input)}</span>
          <span style={{ opacity: 0.6 }}>Out: {formatTokens(props.agent.tokenUsage.output)}</span>
        </div>
      </div>

      {/* Expanded Step History */}
      <Show when={expanded()}>
        <div style={expandedStyle}>
          <div style={{ "font-size": "11px", "font-weight": "500", color: "var(--jb-text-header-color)", "margin-bottom": "8px", "text-transform": "uppercase", "letter-spacing": "0.5px" }}>
            Step History
          </div>
          <Show
            when={props.agent.steps.length > 0}
            fallback={
              <div style={{ "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
                No steps recorded yet
              </div>
            }
          >
            <For each={props.agent.steps}>
              {(step) => (
                <div style={stepStyle(step)}>
                  <div style={stepIconStyle(step)} />
                  <span style={{ "font-family": "var(--jb-font-mono)", color: "var(--cortex-success)" }}>{step.type}</span>
                  <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                    {step.name}
                  </span>
                  <Show when={step.status === "running"}>
                    <span style={{ color: "var(--cortex-info)" }}>Running...</span>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>

      {/* Pulse Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// LIVE MONITOR COMPONENT
// =============================================================================

export function LiveMonitor(props: LiveMonitorProps) {
  const agents = () => props.agents || [];

  const supervisors = createMemo(() => agents().filter((a) => a.isSupervisor));
  const workers = createMemo(() => agents().filter((a) => !a.isSupervisor));

  const runningCount = createMemo(() => 
    agents().filter((a) => ["running", "waiting"].includes(a.status)).length
  );
  const pausedCount = createMemo(() => 
    agents().filter((a) => a.status === "paused").length
  );

  const hasRunning = () => runningCount() > 0;
  const hasPaused = () => pausedCount() > 0;

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
  };

  const titleStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
  };

  const controlsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
    padding: "12px",
  };

  const sectionStyle: JSX.CSSProperties = {
    "margin-bottom": "16px",
  };

  const sectionTitleStyle: JSX.CSSProperties = {
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--jb-text-header-color)",
    "margin-bottom": "8px",
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleStyle}>
          <span>Active Agents</span>
          <Show when={runningCount() > 0}>
            <Badge variant="accent" size="sm">{runningCount()} running</Badge>
          </Show>
          <Show when={pausedCount() > 0}>
            <Badge variant="warning" size="sm">{pausedCount()} paused</Badge>
          </Show>
        </div>
        <div style={controlsStyle}>
          <Show when={hasRunning()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onPauseAll}
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M3 2h2v8H3V2zM7 2h2v8H7V2z" />
                </svg>
              }
            >
              Pause All
            </Button>
          </Show>
          <Show when={hasPaused()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onResumeAll}
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M3 1v10l8-5-8-5z" />
                </svg>
              }
            >
              Resume All
            </Button>
          </Show>
          <Show when={hasRunning() || hasPaused()}>
            <Button
              variant="danger"
              size="sm"
              onClick={props.onStopAll}
              icon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M2 2h8v8H2V2z" />
                </svg>
              }
            >
              Stop All
            </Button>
          </Show>
        </div>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        <Show
          when={agents().length > 0}
          fallback={
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                  <path d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z" />
                  <path d="M16 10a1 1 0 0 1 1 1v5.5l3.5 2-.5.9-4-2.3V11a1 1 0 0 1 1-1z" />
                </svg>
              }
              title="No Active Agents"
              description="Agents will appear here when they start running"
            />
          }
        >
          {/* Supervisors Section */}
          <Show when={supervisors().length > 0}>
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 1L1 3v4c0 2.8 2 5.3 5 6 3-.7 5-3.2 5-6V3L6 1zm4 6c0 2.2-1.6 4.2-4 4.8C3.6 11.2 2 9.2 2 7V4l4-1.5L10 4v3z" />
                </svg>
                <span>Supervisors</span>
                <Badge variant="accent" size="sm">{supervisors().length}</Badge>
              </div>
              <For each={supervisors()}>
                {(agent) => (
                  <AgentCard
                    agent={agent}
                    onPause={() => props.onPauseAgent?.(agent.id)}
                    onResume={() => props.onResumeAgent?.(agent.id)}
                    onStop={() => props.onStopAgent?.(agent.id)}
                  />
                )}
              </For>
            </div>
          </Show>

          {/* Workers Section */}
          <Show when={workers().length > 0}>
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 1a1 1 0 0 1 1 1v1h2.5l.5.5v2l-.5.5H9v1h.5l.5.5v3l-.5.5h-7l-.5-.5v-3l.5-.5H3V6h-.5L2 5.5v-2l.5-.5H5V2a1 1 0 0 1 1-1zM3 4v1h6V4H3zm0 3v3h6V7H3z" />
                </svg>
                <span>Worker Agents</span>
                <Badge variant="default" size="sm">{workers().length}</Badge>
              </div>
              <For each={workers()}>
                {(agent) => (
                  <AgentCard
                    agent={agent}
                    onPause={() => props.onPauseAgent?.(agent.id)}
                    onResume={() => props.onResumeAgent?.(agent.id)}
                    onStop={() => props.onStopAgent?.(agent.id)}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}

export default LiveMonitor;


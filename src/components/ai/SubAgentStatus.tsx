/**
 * SubAgentStatus Component
 * Displays active sub-agents and their tasks in a collapsible panel
 */

import { createSignal, createMemo, Show, For, JSX } from "solid-js";
import { Icon } from "../ui/Icon";

// ============================================================================
// Types
// ============================================================================

export type AgentStatus = "idle" | "running" | "completed" | "failed";

export interface SubAgent {
  id: string;
  name: string;
  status: AgentStatus;
  description?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AgentTask {
  id: string;
  agentId: string;
  prompt: string;
  status: AgentStatus;
  progress?: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

function formatDuration(startMs: number, endMs?: number): string {
  const duration = (endMs || Date.now()) - startMs;
  const seconds = Math.floor(duration / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// ============================================================================
// AgentIcon Component
// ============================================================================

const AGENT_TYPE_ICONS: Record<string, string> = {
  "CodeAgent": "code",
  "ResearchAgent": "magnifying-glass",
  "TestAgent": "circle-check",
  "ReviewAgent": "eye",
  "DocumentAgent": "file",
  "TerminalAgent": "terminal",
  "PackageAgent": "box",
  "DatabaseAgent": "database",
  "GitAgent": "code-branch",
};

interface AgentIconProps {
  type: string;
  class?: string;
  style?: JSX.CSSProperties;
}

function AgentIcon(props: AgentIconProps): JSX.Element {
  const getIconName = (): string => {
    for (const [key, iconName] of Object.entries(AGENT_TYPE_ICONS)) {
      if (props.type.toLowerCase().includes(key.toLowerCase().replace("agent", ""))) {
        return iconName;
      }
    }
    return "microchip";
  };

  return <Icon name={getIconName()} class={props.class || "w-4 h-4"} style={props.style} />;
}

// ============================================================================
// StatusBadge Component
// ============================================================================

interface StatusBadgeProps {
  status: AgentStatus;
}

const STATUS_CONFIG: Record<AgentStatus, { color: string; label: string; bgColor: string }> = {
  idle: { color: "var(--text-weak)", label: "Idle", bgColor: "rgba(90, 193, 254, 0.1)" },
  running: { color: "var(--accent)", label: "Running", bgColor: "rgba(90, 193, 254, 0.15)" },
  completed: { color: "var(--success)", label: "Done", bgColor: "rgba(170, 216, 76, 0.15)" },
  failed: { color: "var(--error)", label: "Failed", bgColor: "rgba(239, 113, 119, 0.15)" },
};

function StatusBadge(props: StatusBadgeProps): JSX.Element {
  const config = () => STATUS_CONFIG[props.status];

  return (
    <span
      class="px-2 py-0.5 text-xs font-medium rounded-full"
      style={{
        color: config().color,
        background: config().bgColor,
      }}
    >
      {config().label}
    </span>
  );
}

// ============================================================================
// SubAgentCard Component
// ============================================================================

interface SubAgentCardProps {
  agent: SubAgent;
  tasks: AgentTask[];
  onCancelTask: (taskId: string) => void;
}

function SubAgentCard(props: SubAgentCardProps): JSX.Element {
  const [showCancelBtn, setShowCancelBtn] = createSignal(false);

  const currentTask = createMemo(() =>
    props.tasks.find((t) => t.status === "running")
  );

  const completedTasks = createMemo(() =>
    props.tasks.filter((t) => t.status === "completed")
  );

  const failedTasks = createMemo(() =>
    props.tasks.filter((t) => t.status === "failed")
  );

  const getCardBorderColor = (): string => {
    switch (props.agent.status) {
      case "running":
        return "var(--accent)";
      case "completed":
        return "var(--success)";
      case "failed":
        return "var(--error)";
      default:
        return "var(--border-weak)";
    }
  };

  return (
    <div
      class="rounded-lg border transition-all duration-200"
      style={{
        background: props.agent.status === "running" 
          ? "rgba(90, 193, 254, 0.03)" 
          : "var(--surface-base)",
        "border-color": getCardBorderColor(),
        "border-left-width": "3px",
      }}
      onMouseEnter={() => setShowCancelBtn(true)}
      onMouseLeave={() => setShowCancelBtn(false)}
    >
      {/* Agent info header */}
      <div class="flex items-center justify-between px-3 py-2">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <div
            class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: STATUS_CONFIG[props.agent.status].bgColor,
            }}
          >
            <AgentIcon
              type={props.agent.name}
              class="w-4 h-4"
              style={{ color: STATUS_CONFIG[props.agent.status].color }}
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                class="text-sm font-medium truncate"
                style={{ color: "var(--text-strong)" }}
              >
                {props.agent.name}
              </span>
            </div>
            <Show when={props.agent.description}>
              <span
                class="text-xs truncate block"
                style={{ color: "var(--text-weak)" }}
              >
                {props.agent.description}
              </span>
            </Show>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <Show when={props.agent.startedAt && props.agent.status === "running"}>
            <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
              {formatDuration(props.agent.startedAt!)}
            </span>
          </Show>
          <StatusBadge status={props.agent.status} />
        </div>
      </div>

      {/* Current task section */}
      <Show when={currentTask()}>
        <div
          class="px-3 py-2 border-t"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <div
            class="text-xs mb-2 line-clamp-2"
            style={{ color: "var(--text-base)" }}
          >
            {truncate(currentTask()!.prompt, 100)}
          </div>
          <div class="flex items-center gap-2">
            {/* Progress bar */}
            <div
              class="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--surface-active)" }}
            >
              <div
                class="h-full rounded-full sub-agent-progress-pulse"
                style={{
                  width: currentTask()!.progress ? `${currentTask()!.progress}%` : "100%",
                  background: "var(--accent)",
                }}
              />
            </div>
            {/* Cancel button */}
            <Show when={showCancelBtn() || true}>
              <button
                class="p-1 rounded transition-all duration-150 opacity-0 hover:opacity-100"
                classList={{
                  "opacity-60": showCancelBtn(),
                }}
                style={{
                  color: "var(--text-weak)",
                  background: "transparent",
                }}
                onClick={() => props.onCancelTask(currentTask()!.id)}
                title="Cancel task"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--error)";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-weak)";
                }}
              >
                <Icon name="xmark" class="w-3.5 h-3.5" />
              </button>
            </Show>
          </div>
        </div>
      </Show>

      {/* Completed/Failed tasks summary */}
      <Show when={completedTasks().length > 0 || failedTasks().length > 0}>
        <div
          class="px-3 py-1.5 flex items-center gap-3 border-t"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <Show when={completedTasks().length > 0}>
<span class="text-xs flex items-center gap-1" style={{ color: "var(--success)" }}>
              <Icon name="circle-check" class="w-3 h-3" />
              {completedTasks().length} completed
            </span>
          </Show>
          <Show when={failedTasks().length > 0}>
<span class="text-xs flex items-center gap-1" style={{ color: "var(--error)" }}>
              <Icon name="xmark" class="w-3 h-3" />
              {failedTasks().length} failed
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// SubAgentStatus Component (Main Export)
// ============================================================================

export interface SubAgentStatusProps {
  agents: SubAgent[];
  tasks: AgentTask[];
  onCancelTask: (taskId: string) => void;
  defaultExpanded?: boolean;
}

export function SubAgentStatus(props: SubAgentStatusProps): JSX.Element {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded ?? true);

  const activeAgents = createMemo(() =>
    props.agents.filter((a) => a.status === "running")
  );

  const activeTasks = createMemo(() =>
    props.tasks.filter((t) => t.status === "running")
  );

  const getAgentTasks = (agentId: string): AgentTask[] =>
    props.tasks.filter((t) => t.agentId === agentId);

  const hasAgents = () => props.agents.length > 0;

  return (
    <Show when={hasAgents()}>
      <div
        class="rounded-lg border overflow-hidden"
        style={{
          background: "var(--surface-base)",
          "border-color": "var(--border-base)",
        }}
      >
        {/* Collapsible header */}
        <button
          class="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
          style={{
            background: expanded() ? "var(--surface-raised)" : "transparent",
          }}
          onClick={() => setExpanded(!expanded())}
          onMouseEnter={(e) => {
            if (!expanded()) {
              e.currentTarget.style.background = "var(--surface-raised-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (!expanded()) {
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          <div class="flex items-center gap-2">
            <div
              class="w-6 h-6 rounded-md flex items-center justify-center"
              style={{
                background: activeAgents().length > 0 
                  ? "rgba(90, 193, 254, 0.15)" 
                  : "var(--surface-active)",
              }}
            >
<Icon
                name="microchip"
                class="w-3.5 h-3.5"
                style={{
                  color: activeAgents().length > 0 
                    ? "var(--accent)" 
                    : "var(--text-weak)",
                }}
              />
            </div>
            <span class="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
              {activeAgents().length} sub-agent{activeAgents().length !== 1 ? "s" : ""} active
            </span>
            <Show when={activeTasks().length > 0}>
              <span
                class="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(90, 193, 254, 0.15)",
                  color: "var(--accent)",
                }}
              >
                {activeTasks().length} task{activeTasks().length !== 1 ? "s" : ""}
              </span>
            </Show>
          </div>
<Icon
            name="chevron-down"
            class="w-4 h-4 transition-transform duration-200"
            style={{
              color: "var(--text-weak)",
              transform: expanded() ? "rotate(0deg)" : "rotate(-90deg)",
            }}
          />
        </button>

        {/* Agent list */}
        <Show when={expanded()}>
          <div
            class="p-2 space-y-2 border-t max-h-80 overflow-y-auto"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <For each={props.agents}>
              {(agent) => (
                <SubAgentCard
                  agent={agent}
                  tasks={getAgentTasks(agent.id)}
                  onCancelTask={props.onCancelTask}
                />
              )}
            </For>
            <Show when={props.agents.length === 0}>
              <div
                class="text-center py-4 text-sm"
                style={{ color: "var(--text-weak)" }}
              >
                No active sub-agents
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// ============================================================================
// Compact Variant for Minimal Display
// ============================================================================

export interface SubAgentStatusCompactProps {
  agents: SubAgent[];
  onClick?: () => void;
}

export function SubAgentStatusCompact(props: SubAgentStatusCompactProps): JSX.Element {
  const activeCount = createMemo(() =>
    props.agents.filter((a) => a.status === "running").length
  );

  return (
    <Show when={activeCount() > 0}>
      <button
        class="flex items-center gap-1.5 px-2 py-1 rounded transition-colors"
        style={{
          background: "rgba(90, 193, 254, 0.1)",
          color: "var(--accent)",
        }}
        onClick={props.onClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(90, 193, 254, 0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(90, 193, 254, 0.1)";
        }}
        title={`${activeCount()} sub-agent${activeCount() !== 1 ? "s" : ""} running`}
      >
        <Icon name="microchip" class="w-3.5 h-3.5" />
        <span class="text-xs font-medium">{activeCount()}</span>
      </button>
    </Show>
  );
}

// ============================================================================
// CSS Keyframes (injected once)
// ============================================================================

if (typeof document !== "undefined") {
  const styleId = "sub-agent-status-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes sub-agent-pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
      
      .sub-agent-progress-pulse {
        animation: sub-agent-pulse 2s ease-in-out infinite;
      }
      
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }
}

// ============================================================================
// Exports
// ============================================================================

export type { SubAgentCardProps, StatusBadgeProps };

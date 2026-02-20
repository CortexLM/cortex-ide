import { Show, For } from "solid-js";
import { Icon } from "./ui/Icon";

export interface PlanAgent {
  id: string;
  name: string;
  role: string;
  icon: string;
  status: "pending" | "running" | "completed" | "error";
  progress?: number;
  result?: AgentResult;
  startedAt?: number;
  completedAt?: number;
}

export interface AgentResult {
  findings: string[];
  recommendations: string[];
  data?: Record<string, unknown>;
  risk_level?: "low" | "medium" | "high" | "critical";
}

interface PlanAgentsPanelProps {
  agents: PlanAgent[];
  isCompiling: boolean;
  onClose?: () => void;
}

const AGENT_ICON_NAMES: Record<string, string> = {
  "security": "shield",
  "performance": "bolt",
  "ux": "table-columns",
  "devops": "server",
  "qa": "circle-check",
  "data": "database",
  "architect": "box",
};

const getAgentIconName = (iconName: string): string => {
  return AGENT_ICON_NAMES[iconName.toLowerCase()] || "microchip";
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "running": return "var(--cortex-info)";
    case "completed": return "var(--cortex-success)";
    case "error": return "var(--cortex-error)";
    default: return "var(--text-weaker)";
  }
};

export function PlanAgentsPanel(props: PlanAgentsPanelProps) {
  const completedCount = () => props.agents.filter(a => a.status === "completed").length;
  const totalCount = () => props.agents.length;
  const progress = () => totalCount() > 0 ? (completedCount() / totalCount()) * 100 : 0;

  return (
    <div 
      class="fixed right-4 top-20 w-80 rounded-lg border shadow-xl overflow-hidden z-50"
      style={{ 
        background: "var(--surface-raised)",
        "border-color": "var(--border-base)"
      }}
    >
      {/* Header */}
      <div 
        class="px-4 py-3 border-b"
        style={{ 
          background: "var(--surface-base)",
          "border-color": "var(--border-weak)"
        }}
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
            Plan Analysis Agents
          </span>
          <span class="text-xs" style={{ color: "var(--text-weak)" }}>
            {completedCount()}/{totalCount()}
          </span>
        </div>
        
        {/* Progress bar */}
        <div 
          class="h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--surface-active)" }}
        >
          <div 
            class="h-full transition-all duration-500 rounded-full"
            style={{ 
              width: `${progress()}%`,
              background: props.isCompiling ? "var(--cortex-warning)" : "var(--cortex-success)"
            }}
          />
        </div>
      </div>

      {/* Agents list */}
      <div class="max-h-96 overflow-y-auto">
          <For each={props.agents}>
            {(agent) => {
              const agentIconName = getAgentIconName(agent.icon);
              const elapsed = () => {
                if (agent.startedAt) {
                  const end = agent.completedAt || Date.now();
                  return Math.round((end - agent.startedAt) / 1000);
                }
                return 0;
              };

              return (
                <div 
                  class="px-4 py-3 border-b last:border-0 transition-colors"
                  style={{ 
                    "border-color": "var(--border-weak)",
                    background: agent.status === "running" ? "rgba(59, 130, 246, 0.05)" : "transparent"
                  }}
                >
                  <div class="flex items-start gap-3">
                    {/* Status indicator */}
                    <div 
                      class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${getStatusColor(agent.status)}15` }}
                    >
                      <Show 
                        when={agent.status === "running"}
                        fallback={
                          <Show 
                            when={agent.status === "completed"}
                            fallback={
                              <Show when={agent.status === "error"} fallback={<Icon name={agentIconName} class="w-4 h-4" style={{ color: "var(--text-weaker)" }} />}>
                                <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--cortex-error)" }} />
                              </Show>
                            }
                          >
                            <Icon name="check" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
                          </Show>
                        }
                      >
                        <Icon name="spinner" class="w-4 h-4 animate-spin" style={{ color: "var(--cortex-info)" }} />
                      </Show>
                    </div>

                  {/* Agent info */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
                        {agent.name}
                      </span>
                      <Show when={agent.status === "running" || agent.status === "completed"}>
                        <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
                          {elapsed()}s
                        </span>
                      </Show>
                    </div>
                    <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                      {agent.role}
                    </div>

                    {/* Results preview */}
                    <Show when={agent.status === "completed" && agent.result}>
                      <div class="mt-2 text-xs space-y-1">
                        <Show when={agent.result!.findings.length > 0}>
                          <div style={{ color: "var(--text-weak)" }}>
                            <span class="font-medium">{agent.result!.findings.length}</span> findings
                          </div>
                        </Show>
                        <Show when={agent.result!.recommendations.length > 0}>
                          <div style={{ color: "var(--cortex-success)" }}>
                            <span class="font-medium">{agent.result!.recommendations.length}</span> recommendations
                          </div>
                        </Show>
                        <Show when={agent.result!.risk_level}>
                          <div 
                            class="inline-block px-1.5 py-0.5 rounded text-xs"
                            style={{ 
                              background: agent.result!.risk_level === "high" || agent.result!.risk_level === "critical" 
                                ? "rgba(239, 68, 68, 0.2)" 
                                : "rgba(34, 197, 94, 0.2)",
                              color: agent.result!.risk_level === "high" || agent.result!.risk_level === "critical"
                                ? "var(--cortex-error)"
                                : "var(--cortex-success)"
                            }}
                          >
                            {agent.result!.risk_level} risk
                          </div>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Footer - Compiling status */}
      <Show when={props.isCompiling}>
        <div 
          class="px-4 py-3 border-t flex items-center gap-2"
          style={{ 
            background: "rgba(234, 179, 8, 0.1)",
            "border-color": "var(--border-weak)"
          }}
        >
          <Icon name="spinner" class="w-4 h-4 animate-spin" style={{ color: "var(--cortex-warning)" }} />
          <span class="text-sm" style={{ color: "var(--cortex-warning)" }}>
            Compiling comprehensive plan...
          </span>
        </div>
      </Show>

      <Show when={completedCount() === totalCount() && !props.isCompiling}>
        <div 
          class="px-4 py-3 border-t flex items-center gap-2"
          style={{ 
            background: "rgba(34, 197, 94, 0.1)",
            "border-color": "var(--border-weak)"
          }}
        >
          <Icon name="check" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
          <span class="text-sm" style={{ color: "var(--cortex-success)" }}>
            All analyses complete
          </span>
        </div>
      </Show>
    </div>
  );
}

// Default agents for comprehensive planning
export const DEFAULT_PLAN_AGENTS: Omit<PlanAgent, "status" | "result">[] = [
  {
    id: "security",
    name: "Security Analyst",
    role: "Authentication, authorization, vulnerabilities, OWASP",
    icon: "security",
  },
  {
    id: "performance",
    name: "Performance Engineer",
    role: "Scalability, caching, optimization, rate limiting",
    icon: "performance",
  },
  {
    id: "ux",
    name: "UX Architect",
    role: "User flows, accessibility, responsive design, theme",
    icon: "ux",
  },
  {
    id: "devops",
    name: "DevOps Engineer",
    role: "CI/CD, deployment, monitoring, infrastructure",
    icon: "devops",
  },
  {
    id: "qa",
    name: "QA Engineer",
    role: "Test strategy, edge cases, validation",
    icon: "qa",
  },
  {
    id: "data",
    name: "Data Architect",
    role: "Data models, relationships, migrations, backups",
    icon: "data",
  },
];


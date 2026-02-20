import { createSignal, Show, For } from "solid-js";
import { Icon } from "../ui/Icon";
import { Card, Button, Text, Badge, Textarea } from "@/components/ui";

interface AgentAnalysis {
  agent: string;
  role: string;
  findings: string[];
  recommendations: string[];
  risk_level?: "low" | "medium" | "high" | "critical";
}

interface PlanData {
  type: "plan";
  title: string;
  description: string;
  architecture?: string;
  tech_stack?: string[];
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    subtasks?: string[];
    complexity?: string;
    estimated_time?: string;
  }>;
  use_cases?: Array<string | { name: string; description?: string }>;
  agent_analyses?: AgentAnalysis[];
  risks?: Array<string | { risk: string; level?: string; mitigation?: string }>;
  success_criteria?: string[];
  timeline?: string;
  estimated_changes?: string;
  status: "pending_approval" | "approved" | "rejected";
}

interface PlanCardProps {
  data: PlanData;
  onApprove?: (plan: PlanData) => void;
  onReject?: () => void;
}

const AGENT_ICONS: Record<string, string> = {
  "Security": "shield",
  "Performance": "bolt",
  "UX": "users",
  "DevOps": "server",
  "QA": "circle-check",
  "Data": "database",
  "AI": "code",
};

const getAgentIconName = (agent: string): string => {
  for (const [key, iconName] of Object.entries(AGENT_ICONS)) {
    if (agent.toLowerCase().includes(key.toLowerCase())) {
      return iconName;
    }
  }
  return "users";
};

const getRiskVariant = (level?: string): "default" | "success" | "warning" | "error" => {
  switch (level) {
    case "critical": return "error";
    case "high": return "error";
    case "medium": return "warning";
    case "low": return "success";
    default: return "default";
  }
};

export function PlanCard(props: PlanCardProps) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [editedContent, setEditedContent] = createSignal("");
  const [collapsed, setCollapsed] = createSignal(false);
  const [analysesOpen, setAnalysesOpen] = createSignal(true);

  // Convert plan data to editable text format
  const planToText = () => {
    let text = "";
    
    // Description
    if (props.data.description) {
      text += props.data.description + "\n\n";
    }
    
    // Architecture
    if (props.data.architecture) {
      text += "## Architecture\n" + props.data.architecture + "\n\n";
    }
    
    // Tech Stack
    if (props.data.tech_stack?.length) {
      text += "## Tech Stack\n" + props.data.tech_stack.join(", ") + "\n\n";
    }
    
    // Tasks
    if (props.data.tasks?.length) {
      text += "## Tasks\n";
      for (const task of props.data.tasks) {
        text += `- ${task.title}`;
        if (task.complexity) text += ` [${task.complexity}]`;
        if (task.estimated_time) text += ` (${task.estimated_time})`;
        text += "\n";
        if (task.description) text += `  ${task.description}\n`;
        if (task.subtasks?.length) {
          for (const st of task.subtasks) {
            text += `  - ${st}\n`;
          }
        }
      }
      text += "\n";
    }
    
    // Use Cases
    if (props.data.use_cases?.length) {
      text += "## Use Cases\n";
      for (const uc of props.data.use_cases) {
        if (typeof uc === "string") {
          text += `- ${uc}\n`;
        } else {
          text += `- ${uc.name}${uc.description ? `: ${uc.description}` : ""}\n`;
        }
      }
      text += "\n";
    }
    
    // Risks
    if (props.data.risks?.length) {
      text += "## Risks\n";
      for (const r of props.data.risks) {
        if (typeof r === "string") {
          text += `- ${r}\n`;
        } else {
          text += `- [${r.level || "medium"}] ${r.risk}`;
          if (r.mitigation) text += ` → ${r.mitigation}`;
          text += "\n";
        }
      }
      text += "\n";
    }
    
    // Success Criteria
    if (props.data.success_criteria?.length) {
      text += "## Success Criteria\n";
      for (const c of props.data.success_criteria) {
        text += `- ${c}\n`;
      }
    }
    
    return text.trim();
  };

  const startEditing = () => {
    setEditedContent(planToText());
    setIsEditing(true);
  };

  const handleApprove = () => {
    props.onApprove?.(props.data);
  };

  return (
    <Card variant="outlined" padding="none" class="my-2 overflow-hidden">
      {/* Header */}
      <div 
        class="flex items-center justify-between px-4 py-3 border-b cursor-pointer"
        style={{ "border-color": "var(--jb-border-default)", background: "var(--jb-surface-active)" }}
        onClick={() => setCollapsed(!collapsed())}
      >
        <div class="flex items-center gap-2">
          <Icon name="file" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
          <Text size="sm" weight="medium">{props.data.title}</Text>
          <Show when={props.data.status === "pending_approval"}>
            <Badge variant="warning">Awaiting approval</Badge>
          </Show>
        </div>
        <div class="flex items-center gap-3">
          <Show when={props.data.timeline}>
            <div class="flex items-center gap-1">
              <Icon name="clock" class="w-3 h-3" style={{ color: "var(--jb-text-muted-color)" }} />
              <Text variant="muted" size="xs">{props.data.timeline}</Text>
            </div>
          </Show>
          {collapsed() ? <Icon name="chevron-right" class="w-4 h-4" /> : <Icon name="chevron-down" class="w-4 h-4" />}
        </div>
      </div>

      <Show when={!collapsed()}>
        {/* Editable Content */}
        <div class="border-b" style={{ "border-color": "var(--jb-border-default)" }}>
          <Show 
            when={isEditing()}
            fallback={
              <div 
                class="px-4 py-3 cursor-text transition-colors"
                style={{ "min-height": "100px" }}
                onClick={startEditing}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Text 
                  size="sm" 
                  style={{ "white-space": "pre-wrap" }}
                >
                  {planToText() || "Click to edit plan..."}
                </Text>
              </div>
            }
          >
            <Textarea
              value={editedContent()}
              onInput={(e) => setEditedContent(e.currentTarget.value)}
              onBlur={() => setIsEditing(false)}
              autofocus
              placeholder="Edit your plan here..."
              style={{ 
                "min-height": "300px",
                border: "none",
                "border-radius": "0",
              }}
            />
          </Show>
        </div>

        {/* Agent Analyses - Collapsible */}
        <Show when={props.data.agent_analyses && props.data.agent_analyses.length > 0}>
          <button
            class="flex items-center gap-2 w-full px-4 py-2 text-left border-b transition-colors"
            style={{ "border-color": "var(--jb-border-default)", background: "transparent" }}
            onClick={() => setAnalysesOpen(!analysesOpen())}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            {analysesOpen() ? (
              <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
            ) : (
              <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
            )}
            <Icon name="users" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
            <Text variant="muted" size="xs" weight="medium" style={{ flex: "1" }}>
              Expert Analyses
            </Text>
            <Badge>{props.data.agent_analyses?.length}</Badge>
          </button>
          
          <Show when={analysesOpen()}>
            <div>
              <For each={props.data.agent_analyses}>
                {(analysis) => {
                  const iconName = getAgentIconName(analysis.agent);
                  return (
                    <div class="px-4 py-3 border-b" style={{ "border-color": "var(--jb-border-default)" }}>
                      {/* Agent Header */}
                      <div class="flex items-center gap-2 mb-2">
                        <Icon name={iconName} class="w-4 h-4" style={{ color: analysis.risk_level === "critical" || analysis.risk_level === "high" ? "var(--cortex-error)" : analysis.risk_level === "medium" ? "var(--cortex-warning)" : "var(--cortex-success)" }} />
                        <Text size="sm" weight="medium">{analysis.agent}</Text>
                        <Text variant="muted" size="xs">({analysis.role})</Text>
                        <Show when={analysis.risk_level}>
                          <Badge 
                            variant={getRiskVariant(analysis.risk_level)}
                            style={{ "margin-left": "auto" }}
                          >
                            {analysis.risk_level} risk
                          </Badge>
                        </Show>
                      </div>
                      
                      {/* Findings */}
                      <Show when={analysis.findings?.length}>
                        <div class="mb-2">
                          <Text variant="muted" size="xs" weight="medium" style={{ display: "block", "margin-bottom": "4px" }}>
                            Findings:
                          </Text>
                          <For each={analysis.findings}>
                            {(f) => (
                              <div class="flex items-start gap-1 pl-3 py-0.5">
                                <Text variant="muted" size="xs">•</Text>
                                <Text size="xs">{f}</Text>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                      
                      {/* Recommendations */}
                      <Show when={analysis.recommendations?.length}>
                        <div>
                          <Text variant="muted" size="xs" weight="medium" style={{ display: "block", "margin-bottom": "4px" }}>
                            Recommendations:
                          </Text>
                          <For each={analysis.recommendations}>
                            {(r) => (
                              <div class="flex items-start gap-1 pl-3 py-0.5">
                                <Text size="xs" style={{ color: "var(--cortex-success)" }}>✓</Text>
                                <Text size="xs" style={{ color: "var(--cortex-success)" }}>{r}</Text>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </Show>

        {/* Actions */}
        <Show when={props.data.status === "pending_approval"}>
          <div 
            class="flex items-center justify-between px-4 py-3 border-t"
            style={{ "border-color": "var(--jb-border-default)", background: "var(--jb-surface-active)" }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={startEditing}
              icon={<Icon name="pen" class="w-3.5 h-3.5" />}
            >
              Edit Plan
            </Button>
            <div class="flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={props.onReject}
                icon={<Icon name="xmark" class="w-3.5 h-3.5" />}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApprove}
                icon={<Icon name="check" class="w-3.5 h-3.5" />}
                style={{ background: "var(--cortex-success)" }}
              >
                Approve & Execute
              </Button>
            </div>
          </div>
        </Show>
      </Show>
    </Card>
  );
}

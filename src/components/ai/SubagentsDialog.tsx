/**
 * SubagentsDialog - Manage and spawn AI sub-agents
 * Subagent management dialog for viewing and controlling active subagents
 */

import {
  createSignal,
  createEffect,
  For,
  Show,
  onMount,
  onCleanup,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// ============================================================================
// Types
// ============================================================================

interface SubAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  parentId?: string;
  agentType: "custom" | "code" | "research" | "test" | "review";
  createdAt: number;
  lastActiveAt?: number;
  tasksCompleted: number;
  tasksFailed: number;
}

interface AgentTask {
  id: string;
  agentId: string;
  prompt: string;
  context: string[];
  result?: string;
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

interface AgentTemplate {
  name: string;
  description: string;
  type: "code" | "research" | "test" | "review";
  icon: string;
  prompt: string;
}

// ============================================================================
// Agent Templates
// ============================================================================

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    name: "Code Agent",
    description: "Specialized in code generation, refactoring, and bug fixes",
    type: "code",
    icon: "code",
    prompt: "You are an expert code agent. Generate clean, efficient, production-ready code. Follow best practices and include proper error handling.",
  },
  {
    name: "Research Agent",
    description: "Analyzes codebases, documentation, and provides insights",
    type: "research",
    icon: "magnifying-glass",
    prompt: "You are a research agent. Analyze code, documentation, and provide detailed insights. Summarize findings clearly and suggest improvements.",
  },
  {
    name: "Test Agent",
    description: "Creates and runs tests, validates implementations",
    type: "test",
    icon: "circle-check",
    prompt: "You are a testing agent. Create comprehensive tests, identify edge cases, and ensure code quality. Focus on coverage and reliability.",
  },
  {
    name: "Review Agent",
    description: "Reviews code for quality, security, and best practices",
    type: "review",
    icon: "eye",
    prompt: "You are a code review agent. Review code for quality, security, performance, and maintainability. Provide actionable feedback.",
  },
];

// ============================================================================
// SubagentsDialog Component
// ============================================================================

export interface SubagentsDialogProps {
  open: boolean;
  onClose: () => void;
  model: string;
  onSpawnAgent?: (agent: SubAgent) => void;
}

export function SubagentsDialog(props: SubagentsDialogProps) {
  // State
  const [agents, setAgents] = createSignal<SubAgent[]>([]);
  const [_, setTasks] = createSignal<AgentTask[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedAgent, setSelectedAgent] = createSignal<SubAgent | null>(null);
  const [showNewAgent, setShowNewAgent] = createSignal(false);
  const [newAgentPrompt, setNewAgentPrompt] = createSignal("");
  const [taskPrompt, setTaskPrompt] = createSignal("");
  
  let dialogRef: HTMLDivElement | undefined;
  let unlistenFns: UnlistenFn[] = [];

  // Load agents on mount
  onMount(async () => {
    await loadAgents();
    
    // Listen for agent events
    const unlisten1 = await listen<SubAgent>("agent:spawned", (event) => {
      setAgents((prev) => [...prev, event.payload]);
    });
    
    const unlisten2 = await listen<{ agentId: string; status: string }>("agent:status-changed", (event) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === event.payload.agentId
            ? { ...a, status: event.payload.status as SubAgent["status"] }
            : a
        )
      );
    });
    
    const unlisten3 = await listen<AgentTask>("agent:task-completed", (event) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === event.payload.id ? event.payload : t
        )
      );
    });
    
    unlistenFns = [unlisten1, unlisten2, unlisten3];
  });

  onCleanup(() => {
    unlistenFns.forEach((fn) => fn());
  });

  // Load agents from backend
  const loadAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<SubAgent[]>("agent_list");
      setAgents(result);
    } catch (e) {
      setError(`Failed to load agents: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Spawn a new agent from template
  const spawnFromTemplate = async (template: AgentTemplate) => {
    setLoading(true);
    setError(null);
    try {
      const agentId = await invoke<string>("agent_spawn", {
        agentType: template.type,
        name: template.name,
        description: template.description,
        systemPrompt: template.prompt,
        model: props.model,
      });
      
      // Reload agents
      await loadAgents();
      
      // Select the new agent
      const newAgent = agents().find((a) => a.id === agentId);
      if (newAgent) {
        setSelectedAgent(newAgent);
        props.onSpawnAgent?.(newAgent);
      }
    } catch (e) {
      setError(`Failed to spawn agent: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Spawn custom agent
  const spawnCustomAgent = async () => {
    if (!newAgentPrompt().trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const agentId = await invoke<string>("agent_spawn", {
        agentType: "custom",
        name: "Custom Agent",
        description: "Custom specialized agent",
        systemPrompt: newAgentPrompt(),
        model: props.model,
      });
      
      await loadAgents();
      setShowNewAgent(false);
      setNewAgentPrompt("");
      
      const newAgent = agents().find((a) => a.id === agentId);
      if (newAgent) {
        setSelectedAgent(newAgent);
        props.onSpawnAgent?.(newAgent);
      }
    } catch (e) {
      setError(`Failed to spawn agent: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Run task on selected agent
  const runTask = async () => {
    const agent = selectedAgent();
    if (!agent || !taskPrompt().trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      await invoke("agent_run_task", {
        agentId: agent.id,
        prompt: taskPrompt(),
        context: [],
      });
      
      setTaskPrompt("");
      await loadAgents();
    } catch (e) {
      setError(`Failed to run task: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Remove agent
  const removeAgent = async (agentId: string) => {
    try {
      await invoke("agent_remove", { agentId });
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      if (selectedAgent()?.id === agentId) {
        setSelectedAgent(null);
      }
    } catch (e) {
      setError(`Failed to remove agent: ${e}`);
    }
  };

  // Get agent icon
  const getAgentIcon = (type: SubAgent["agentType"]): string => {
    switch (type) {
      case "code": return "code";
      case "research": return "magnifying-glass";
      case "test": return "circle-check";
      case "review": return "eye";
      default: return "microchip";
    }
  };

  // Get status color
  const getStatusColor = (status: SubAgent["status"]) => {
    switch (status) {
      case "running": return "var(--accent-primary)";
      case "completed": return "var(--success)";
      case "failed": return "var(--error)";
      case "cancelled": return "var(--warning)";
      default: return "var(--text-weak)";
    }
  };

  // Close on escape
  createEffect(() => {
    if (!props.open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onClose();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // Click outside to close
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Show when={props.open}>
      {/* Backdrop - VS Code: rgba(0,0,0,0.4) with blur */}
      <div
        class="modal-overlay dimmed dialog-backdrop-enter"
        onClick={handleBackdropClick}
      >
        {/* Dialog - VS Code specs */}
        <div
          ref={dialogRef}
          class="dialog dialog-standard dialog-enter"
          style={{
            width: "800px",
            "max-width": "90vw",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="subagents-dialog-title"
        >
          {/* Header - VS Code: 35px height, 13px font, font-weight 600 */}
          <div class="dialog-header">
<div class="flex items-center gap-2 dialog-header-title">
              <Icon name="microchip" class="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
              <span id="subagents-dialog-title" class="text-sm">Sub-Agents</span>
              <span
                class="px-2 py-0.5 text-[11px] rounded"
                style={{ background: "var(--surface-active)" }}
              >
                {agents().length} active
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="p-1.5 rounded transition-colors"
                style={{ color: "var(--text-weak)" }}
                onClick={loadAgents}
                title="Refresh"
              >
                <Icon name="rotate" class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} />
              </button>
<button
                class="dialog-close"
                onClick={props.onClose}
                aria-label="Close"
              >
                <Icon name="xmark" class="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Error Banner */}
          <Show when={error()}>
<div
              class="px-4 py-2 text-sm flex items-center gap-2"
              style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--error)" }}
            >
              <Icon name="circle-exclamation" class="w-4 h-4" />
              {error()}
              <button
                class="ml-auto text-xs underline"
                onClick={() => setError(null)}
              >
                Dismiss
              </button>
            </div>
          </Show>

          {/* Content */}
          <div class="flex flex-1 min-h-0">
            {/* Left: Agent List */}
            <div
              class="w-64 flex flex-col"
              style={{ "border-right": "1px solid var(--border-base)" }}
            >
              {/* Templates Section */}
              <div class="p-3">
                <div class="text-xs font-medium mb-2" style={{ color: "var(--text-weak)" }}>
                  SPAWN AGENT
                </div>
                <div class="grid grid-cols-2 gap-2">
<For each={AGENT_TEMPLATES}>
                    {(template) => {
                      return (
                        <button
                          class="flex flex-col items-center gap-1 p-2 rounded text-xs transition-colors"
                          style={{ background: "var(--surface-raised)" }}
                          onClick={() => spawnFromTemplate(template)}
                          title={template.description}
                        >
                          <Icon name={template.icon} class="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
                          <span class="truncate w-full text-center">{template.name.split(" ")[0]}</span>
                        </button>
                      );
                    }}
                  </For>
                </div>
                <button
                  class="w-full mt-2 flex items-center justify-center gap-1 p-2 rounded text-xs transition-colors"
                  style={{ 
                    background: "var(--surface-raised)",
                    border: "1px dashed var(--border-base)",
                  }}
                  onClick={() => setShowNewAgent(true)}
                >
                  <Icon name="plus" class="w-3 h-3" />
                  Custom Agent
                </button>
              </div>

              {/* Active Agents */}
              <div class="flex-1 overflow-auto p-3">
                <div class="text-xs font-medium mb-2" style={{ color: "var(--text-weak)" }}>
                  ACTIVE AGENTS ({agents().length})
                </div>
                <Show
                  when={agents().length > 0}
                  fallback={
                    <div class="text-xs text-center py-4" style={{ color: "var(--text-weak)" }}>
                      No agents spawned yet
                    </div>
                  }
                >
                  <div class="space-y-1">
<For each={agents()}>
                      {(agent) => {
                        const iconName = getAgentIcon(agent.agentType);
                        const isSelected = () => selectedAgent()?.id === agent.id;
                        return (
                          <button
                            class="w-full flex items-center gap-2 p-2 rounded text-left transition-colors"
                            style={{
                              background: isSelected() ? "var(--surface-active)" : "transparent",
                            }}
                            onClick={() => setSelectedAgent(agent)}
                          >
                            <Icon name={iconName} class="w-4 h-4 flex-shrink-0" />
                            <div class="flex-1 min-w-0">
                              <div class="text-xs font-medium truncate">{agent.name}</div>
                              <div class="text-[10px] truncate" style={{ color: "var(--text-weak)" }}>
                                {agent.tasksCompleted} tasks
                              </div>
                            </div>
                            <div
                              class="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: getStatusColor(agent.status) }}
                              title={agent.status}
                            />
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>
              </div>
            </div>

            {/* Right: Agent Details / New Agent */}
            <div class="flex-1 flex flex-col min-w-0">
              <Show
                when={!showNewAgent()}
                fallback={
                  <div class="flex-1 p-4">
                    <h3 class="font-medium mb-3">Create Custom Agent</h3>
                    <textarea
                      class="w-full h-40 p-3 rounded text-sm resize-none"
                      style={{
                        background: "var(--surface-raised)",
                        border: "1px solid var(--border-base)",
                        color: "var(--text-base)",
                      }}
                      placeholder="Enter the system prompt for your custom agent..."
                      value={newAgentPrompt()}
                      onInput={(e) => setNewAgentPrompt(e.currentTarget.value)}
                    />
                    <div class="flex gap-2 mt-3">
                      <button
                        class="px-3 py-1.5 rounded text-sm"
                        style={{ background: "var(--surface-raised)" }}
                        onClick={() => {
                          setShowNewAgent(false);
                          setNewAgentPrompt("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        class="px-3 py-1.5 rounded text-sm"
                        style={{ 
                          background: "var(--accent-primary)",
                          color: "white",
                        }}
                        onClick={spawnCustomAgent}
                        disabled={!newAgentPrompt().trim() || loading()}
                      >
                        {loading() ? "Creating..." : "Create Agent"}
                      </button>
                    </div>
                  </div>
                }
              >
                <Show
                  when={selectedAgent()}
                  fallback={
<div class="flex-1 flex items-center justify-center">
                      <div class="text-center" style={{ color: "var(--text-weak)" }}>
                        <Icon name="microchip" class="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p class="text-sm">Select an agent to view details</p>
                        <p class="text-xs mt-1">or spawn a new one from the templates</p>
                      </div>
                    </div>
                  }
                >
{(agent) => {
                    const iconName = getAgentIcon(agent().agentType);
                    return (
                      <div class="flex-1 flex flex-col">
                        {/* Agent Header */}
                        <div
                          class="p-4"
                          style={{ "border-bottom": "1px solid var(--border-base)" }}
                        >
                          <div class="flex items-start gap-3">
                            <div
                              class="p-2 rounded"
                              style={{ background: "var(--surface-raised)" }}
                            >
                              <Icon name={iconName} class="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
                            </div>
                            <div class="flex-1">
                              <h3 class="font-medium">{agent().name}</h3>
                              <p class="text-xs mt-0.5" style={{ color: "var(--text-weak)" }}>
                                {agent().description}
                              </p>
                              <div class="flex items-center gap-3 mt-2 text-xs">
                                <span style={{ color: getStatusColor(agent().status) }}>
                                  {agent().status}
                                </span>
                                <span style={{ color: "var(--text-weak)" }}>
                                  {agent().tasksCompleted} completed
                                </span>
                                <Show when={agent().tasksFailed > 0}>
                                  <span style={{ color: "var(--error)" }}>
                                    {agent().tasksFailed} failed
                                  </span>
                                </Show>
                              </div>
                            </div>
                            <button
                              class="p-1.5 rounded transition-colors hover:bg-[var(--surface-active)]"
                              style={{ color: "var(--error)" }}
                              onClick={() => removeAgent(agent().id)}
                              title="Remove agent"
                            >
                              <Icon name="trash" class="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Task Input */}
                        <div class="p-4 flex-1">
                          <div class="text-xs font-medium mb-2" style={{ color: "var(--text-weak)" }}>
                            RUN TASK
                          </div>
                          <textarea
                            class="w-full h-24 p-3 rounded text-sm resize-none"
                            style={{
                              background: "var(--surface-raised)",
                              border: "1px solid var(--border-base)",
                              color: "var(--text-base)",
                            }}
                            placeholder="Describe the task for this agent..."
                            value={taskPrompt()}
                            onInput={(e) => setTaskPrompt(e.currentTarget.value)}
                          />
                          <div class="flex justify-end mt-2">
                            <button
                              class="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
                              style={{ 
                                background: "var(--accent-primary)",
                                color: "white",
                                opacity: (!taskPrompt().trim() || agent().status === "running") ? 0.5 : 1,
                              }}
                              onClick={runTask}
                              disabled={!taskPrompt().trim() || agent().status === "running"}
                            >
<Show
                                when={agent().status !== "running"}
                                fallback={<Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />}
                              >
                                <Icon name="play" class="w-3.5 h-3.5" />
                              </Show>
                              {agent().status === "running" ? "Running..." : "Run Task"}
                            </button>
                          </div>
                        </div>

                        {/* System Prompt Preview */}
                        <div
                          class="p-4"
                          style={{ "border-top": "1px solid var(--border-base)" }}
                        >
                          <div class="text-xs font-medium mb-2" style={{ color: "var(--text-weak)" }}>
                            SYSTEM PROMPT
                          </div>
                          <div
                            class="p-3 rounded text-xs max-h-24 overflow-auto"
                            style={{ 
                              background: "var(--surface-raised)",
                              color: "var(--text-weak)",
                              "font-family": "var(--font-mono)",
                            }}
                          >
                            {agent().systemPrompt}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </Show>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default SubagentsDialog;

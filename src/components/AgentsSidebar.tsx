/**
 * AgentsSidebar - Sidebar panel for managing AI agents
 * 
 * Features:
 * - List of agents (built-in and custom)
 * - Agent creation with AI-powered prompt generation
 * - Agent editing when clicking on an agent
 * - Agent statistics (tokens, cost)
 * - Agent history tracking
 */

import {
  createSignal,
  For,
  Show,
  onMount,
  onCleanup,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Icon } from "./ui/Icon";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { tokens } from "@/design-system/tokens";
import {
  SidebarHeader,
  IconButton,
  Button,
  Input,
  Badge,
  Text,
  EmptyState,
} from "@/components/ui";
import { ui } from "@/lib/ui-kit";

// ============================================================================
// Types
// ============================================================================

export type AgentType = "custom" | "code" | "research" | "test" | "review";
export type AgentStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  agentType: AgentType;
  status: AgentStatus;
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
  // Statistics
  tokensUsed: number;
  costUsd: number;
  tasksCompleted: number;
  tasksFailed: number;
  lastActiveAt?: number;
  // Cortex Core integration
  /** Whether agent is enabled (available in Cortex Core's Task tool) */
  enabled: boolean;
  /** Allowed tools (undefined means all tools) */
  allowedTools?: string[];
  /** Denied tools */
  deniedTools: string[];
  /** Tags for categorization */
  tags: string[];
}

export interface AgentHistory {
  id: string;
  agentId: string;
  prompt: string;
  result?: string;
  tokensUsed: number;
  costUsd: number;
  startedAt: number;
  completedAt?: number;
  status: AgentStatus;
  error?: string;
}

interface AgentStoreData {
  version: string;
  agents: Agent[];
  history: AgentHistory[];
}

// ============================================================================
// Constants
// ============================================================================

const AGENT_TEMPLATES: Array<{ type: AgentType; name: string; description: string; icon: string; prompt: string }> = [
  {
    type: "code",
    name: "Code Agent",
    description: "Expert at writing, implementing, and modifying code",
    icon: "code",
    prompt: `You are an expert code agent. Your responsibilities:
- Write clean, efficient, production-ready code
- Follow best practices and design patterns
- Include proper error handling and input validation
- Add comprehensive comments and documentation
- Consider edge cases and security implications
- Optimize for performance where appropriate`,
  },
  {
    type: "research",
    name: "Research Agent",
    description: "Analyzes codebases, finds patterns, understands architecture",
    icon: "magnifying-glass",
    prompt: `You are a research agent specialized in code analysis. Your responsibilities:
- Analyze code structure and architecture
- Identify patterns and anti-patterns
- Map dependencies and relationships
- Document architectural decisions
- Provide insights on code quality
- Suggest improvements and optimizations`,
  },
  {
    type: "test",
    name: "Test Agent",
    description: "Creates comprehensive tests and validates implementations",
    icon: "circle-check",
    prompt: `You are a testing agent. Your responsibilities:
- Create comprehensive unit tests
- Cover happy paths and edge cases
- Write integration tests where appropriate
- Include error handling tests
- Mock dependencies correctly
- Ensure high code coverage`,
  },
  {
    type: "review",
    name: "Review Agent",
    description: "Reviews code for quality, security, and best practices",
    icon: "eye",
    prompt: `You are a code review agent. Your responsibilities:
- Review code for quality and maintainability
- Check for security vulnerabilities
- Verify performance implications
- Ensure consistency with codebase style
- Provide actionable, constructive feedback
- Suggest specific improvements with examples`,
  },
];

const BUILT_IN_AGENTS: Agent[] = AGENT_TEMPLATES.map((t, i) => ({
  id: `builtin-${t.type}`,
  name: t.name,
  description: t.description,
  systemPrompt: t.prompt,
  model: "gpt-4",
  agentType: t.type,
  status: "idle" as AgentStatus,
  isBuiltIn: true,
  createdAt: Date.now() - i * 1000,
  updatedAt: Date.now(),
  tokensUsed: 0,
  costUsd: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  enabled: true,
  allowedTools: undefined,
  deniedTools: [],
  tags: [t.type],
}));

// ============================================================================
// Helper Functions
// ============================================================================

function getAgentIcon(type: AgentType): string {
  switch (type) {
    case "code": return "code";
    case "research": return "magnifying-glass";
    case "test": return "circle-check";
    case "review": return "eye";
    default: return "microchip";
  }
}

function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case "running": return tokens.colors.semantic.primary;
    case "completed": return tokens.colors.semantic.success;
    case "failed": return tokens.colors.semantic.error;
    case "cancelled": return tokens.colors.semantic.warning;
    default: return tokens.colors.text.muted;
  }
}

function formatCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

// ============================================================================
// AgentsSidebar Component
// ============================================================================

export function AgentsSidebar() {
  // State
  const [agents, setAgents] = createSignal<Agent[]>([...BUILT_IN_AGENTS]);
  const [history, setHistory] = createSignal<AgentHistory[]>([]);
  const [selectedAgent, setSelectedAgent] = createSignal<Agent | null>(null);
  const [isEditing, setIsEditing] = createSignal(false);
  const [isCreating, setIsCreating] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [expandedSections, setExpandedSections] = createSignal<Set<string>>(new Set(["agents"]));
  
  // Form state for creating/editing
  const [formData, setFormData] = createStore({
    name: "",
    description: "",
    systemPrompt: "",
    agentType: "custom" as AgentType,
    model: "gpt-4",
  });
  
  // AI prompt generation state
  const [promptDescription, setPromptDescription] = createSignal("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = createSignal(false);

  let unlistenFns: UnlistenFn[] = [];

  // Load agents on mount
  onMount(async () => {
    await loadAgents();
    
    // Listen for agent events
    try {
      const unlisten1 = await listen<{ agent: Agent }>("agent:spawned", (event) => {
        setAgents((prev) => [...prev, event.payload.agent]);
      });
      
      const unlisten2 = await listen<{ agentId: string; status: AgentStatus }>("agent:status_changed", (event) => {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === event.payload.agentId
              ? { ...a, status: event.payload.status }
              : a
          )
        );
      });
      
      const unlisten3 = await listen<{ agentId: string }>("agent:removed", (event) => {
        setAgents((prev) => prev.filter((a) => a.id !== event.payload.agentId));
        if (selectedAgent()?.id === event.payload.agentId) {
          setSelectedAgent(null);
          setIsEditing(false);
        }
      });
      
      unlistenFns = [unlisten1, unlisten2, unlisten3];
    } catch (e) {
      console.error("Failed to setup agent listeners:", e);
    }
  });

  onCleanup(() => {
    unlistenFns.forEach((fn) => fn());
  });

  // Load agents from persistent storage
  const loadAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<AgentStoreData>("agent_store_load");
      // Merge built-in agents with stored custom agents
      const customAgents = data.agents.filter(a => !a.isBuiltIn);
      setAgents([...BUILT_IN_AGENTS, ...customAgents]);
      setHistory(data.history || []);
    } catch (e) {
      console.error("Failed to load agents:", e);
      // Keep built-in agents even if load fails
      setAgents([...BUILT_IN_AGENTS]);
    } finally {
      setLoading(false);
    }
  };

  // Save agents to persistent storage
  const saveAgents = async () => {
    try {
      const customAgents = agents().filter(a => !a.isBuiltIn);
      await invoke("agent_store_save", {
        agents: customAgents,
        history: history(),
      });
    } catch (e) {
      console.error("Failed to save agents:", e);
      setError("Failed to save agents");
    }
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Select an agent for viewing/editing
  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setIsEditing(true);
    setIsCreating(false);
    // Populate form with agent data
    setFormData({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      agentType: agent.agentType,
      model: agent.model,
    });
  };

  // Start creating a new agent
  const handleStartCreate = () => {
    setSelectedAgent(null);
    setIsEditing(false);
    setIsCreating(true);
    setFormData({
      name: "",
      description: "",
      systemPrompt: "",
      agentType: "custom",
      model: "gpt-4",
    });
    setPromptDescription("");
  };

  // Create from template
  const handleCreateFromTemplate = (template: typeof AGENT_TEMPLATES[0]) => {
    setSelectedAgent(null);
    setIsEditing(false);
    setIsCreating(true);
    setFormData({
      name: `My ${template.name}`,
      description: template.description,
      systemPrompt: template.prompt,
      agentType: template.type,
      model: "gpt-4",
    });
    setPromptDescription("");
  };

  // Generate system prompt from description using AI
  const handleGeneratePrompt = async () => {
    const desc = promptDescription().trim();
    if (!desc) return;
    
    setIsGeneratingPrompt(true);
    setError(null);
    
    try {
      const generatedPrompt = await invoke<string>("agent_generate_prompt", {
        description: desc,
      });
      setFormData("systemPrompt", generatedPrompt);
    } catch (e) {
      console.error("Failed to generate prompt:", e);
      setError("Failed to generate prompt. Please try again or write manually.");
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Save agent (create or update)
  const handleSaveAgent = async () => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) {
      setError("Name and system prompt are required");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const now = Date.now();
      
      if (isCreating()) {
        // Create new agent
        const newAgent: Agent = {
          id: `agent-${now}-${Math.random().toString(36).substr(2, 9)}`,
          name: formData.name.trim(),
          description: formData.description.trim(),
          systemPrompt: formData.systemPrompt.trim(),
          model: formData.model,
          agentType: formData.agentType,
          status: "idle",
          isBuiltIn: false,
          createdAt: now,
          updatedAt: now,
          tokensUsed: 0,
          costUsd: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
          enabled: true, // Enabled by default - available in Task tool
          allowedTools: undefined, // All tools allowed
          deniedTools: [],
          tags: [formData.agentType],
        };
        
        setAgents((prev) => [...prev, newAgent]);
        await saveAgents();
        setSelectedAgent(newAgent);
        setIsCreating(false);
        setIsEditing(true);
        
        // Emit event for other components
        window.dispatchEvent(new CustomEvent("agent:created", { detail: newAgent }));
        
      } else if (isEditing() && selectedAgent()) {
        // Update existing agent
        const agentId = selectedAgent()!.id;
        const updatedAgent: Agent = {
          ...selectedAgent()!,
          name: formData.name.trim(),
          description: formData.description.trim(),
          systemPrompt: formData.systemPrompt.trim(),
          model: formData.model,
          agentType: formData.agentType,
          updatedAt: now,
        };
        
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? updatedAgent : a))
        );
        await saveAgents();
        setSelectedAgent(updatedAgent);
        
        // Emit event
        window.dispatchEvent(new CustomEvent("agent:updated", { detail: updatedAgent }));
      }
    } catch (e) {
      console.error("Failed to save agent:", e);
      setError("Failed to save agent");
    } finally {
      setLoading(false);
    }
  };

  // Delete agent
  const handleDeleteAgent = async (agent: Agent) => {
    if (agent.isBuiltIn) {
      setError("Cannot delete built-in agents");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
      await saveAgents();
      
      if (selectedAgent()?.id === agent.id) {
        setSelectedAgent(null);
        setIsEditing(false);
      }
      
      // Emit event
      window.dispatchEvent(new CustomEvent("agent:deleted", { detail: { agentId: agent.id } }));
    } catch (e) {
      console.error("Failed to delete agent:", e);
      setError("Failed to delete agent");
    } finally {
      setLoading(false);
    }
  };

  // Duplicate agent
  const handleDuplicateAgent = async (agent: Agent) => {
    const now = Date.now();
    const duplicatedAgent: Agent = {
      ...agent,
      id: `agent-${now}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${agent.name} (Copy)`,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
      tokensUsed: 0,
      costUsd: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
    };
    
    setAgents((prev) => [...prev, duplicatedAgent]);
    await saveAgents();
    
    // Select the duplicated agent
    handleSelectAgent(duplicatedAgent);
  };

  // Cancel editing/creating
  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedAgent(null);
    setError(null);
  };

  // Calculate total stats
  const totalStats = () => {
    const all = agents();
    return {
      totalTokens: all.reduce((sum, a) => sum + a.tokensUsed, 0),
      totalCost: all.reduce((sum, a) => sum + a.costUsd, 0),
      totalTasks: all.reduce((sum, a) => sum + a.tasksCompleted + a.tasksFailed, 0),
    };
  };

  // Styles
  const agentItemStyle = (isSelected: boolean): Record<string, string> => ({
    width: "100%",
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "text-align": "left",
    cursor: "pointer",
    border: "none",
    "border-radius": tokens.radius.sm,
    background: isSelected ? tokens.colors.interactive.selected : "transparent",
    transition: "background 0.15s ease",
  });

  const sectionHeaderStyle: Record<string, string> = {
    width: "100%",
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    cursor: "pointer",
    border: "none",
    background: "transparent",
    color: tokens.colors.text.muted,
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.05em",
  };

  return (
    <div style={ui.panel}>
      {/* Header */}
      <SidebarHeader
        title="Agents"
        actions={
          <>
            <IconButton
              tooltip="Refresh"
              size="sm"
              onClick={loadAgents}
              disabled={loading()}
            >
              <Icon name="rotate" class={loading() ? "animate-spin" : ""} style={{ width: "14px", height: "14px" }} />
            </IconButton>
            <IconButton
              tooltip="Create Agent"
              size="sm"
              onClick={handleStartCreate}
            >
              <Icon name="plus" style={{ width: "14px", height: "14px" }} />
            </IconButton>
          </>
        }
      />

      {/* Error Banner */}
      <Show when={error()}>
        <div
          style={{
            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
            background: "rgba(239, 68, 68, 0.1)",
            color: tokens.colors.semantic.error,
            "font-size": "12px",
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.sm,
          }}
        >
          <span style={{ flex: "1" }}>{error()}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "transparent",
              border: "none",
              color: tokens.colors.semantic.error,
              cursor: "pointer",
            }}
          >
            <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      </Show>

      {/* Main Content */}
      <div style={ui.scrollY}>
        <Show
          when={!isCreating() && !isEditing()}
          fallback={
            /* Edit/Create Form */
            <div style={{ padding: tokens.spacing.md }}>
              <div style={{ "margin-bottom": tokens.spacing.lg }}>
                <Text variant="header" size="sm" style={{ "margin-bottom": tokens.spacing.md }}>
                  {isCreating() ? "Create Agent" : "Edit Agent"}
                </Text>
                
                {/* Template Quick Select (only when creating) */}
                <Show when={isCreating()}>
                  <div style={{ "margin-bottom": tokens.spacing.lg }}>
                    <Text variant="muted" size="xs" style={{ "margin-bottom": tokens.spacing.sm }}>
                      START FROM TEMPLATE
                    </Text>
                    <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: tokens.spacing.sm }}>
                      <For each={AGENT_TEMPLATES}>
                        {(template) => {
                          return (
                            <button
                              style={{
                                display: "flex",
                                "flex-direction": "column",
                                "align-items": "center",
                                gap: tokens.spacing.xs,
                                padding: tokens.spacing.sm,
                                background: tokens.colors.surface.popup,
                                border: `1px solid ${tokens.colors.border.default}`,
                                "border-radius": tokens.radius.sm,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                              onClick={() => handleCreateFromTemplate(template)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = tokens.colors.semantic.primary;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = tokens.colors.border.default;
                              }}
                            >
                              <Icon name={template.icon} style={{ width: "16px", height: "16px", color: tokens.colors.semantic.primary }} />
                              <span style={{ "font-size": "11px", color: tokens.colors.text.primary }}>
                                {template.name.split(" ")[0]}
                              </span>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                </Show>

                {/* Agent Name */}
                <div style={{ "margin-bottom": tokens.spacing.md }}>
                  <Text variant="muted" size="xs" style={{ "margin-bottom": tokens.spacing.xs }}>
                    NAME
                  </Text>
                  <Input
                    value={formData.name}
                    onInput={(e) => setFormData("name", e.currentTarget.value)}
                    placeholder="My Custom Agent"
                    disabled={selectedAgent()?.isBuiltIn}
                  />
                </div>

                {/* Description */}
                <div style={{ "margin-bottom": tokens.spacing.md }}>
                  <Text variant="muted" size="xs" style={{ "margin-bottom": tokens.spacing.xs }}>
                    DESCRIPTION
                  </Text>
                  <Input
                    value={formData.description}
                    onInput={(e) => setFormData("description", e.currentTarget.value)}
                    placeholder="What does this agent do?"
                    disabled={selectedAgent()?.isBuiltIn}
                  />
                </div>

                {/* AI Prompt Generator */}
                <Show when={!selectedAgent()?.isBuiltIn}>
                  <div style={{ "margin-bottom": tokens.spacing.md }}>
                    <Text variant="muted" size="xs" style={{ "margin-bottom": tokens.spacing.xs }}>
                      AUTO-GENERATE PROMPT
                    </Text>
                    <div style={{ display: "flex", gap: tokens.spacing.sm }}>
                      <Input
                        value={promptDescription()}
                        onInput={(e) => setPromptDescription(e.currentTarget.value)}
                        placeholder="Describe what you want the agent to do..."
                        style={{ flex: "1" }}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleGeneratePrompt}
                        disabled={isGeneratingPrompt() || !promptDescription().trim()}
                      >
                        <Show
                          when={!isGeneratingPrompt()}
                          fallback={<Icon name="spinner" class="animate-spin" style={{ width: "14px", height: "14px" }} />}
                        >
                          <Icon name="bolt" style={{ width: "14px", height: "14px" }} />
                        </Show>
                        Generate
                      </Button>
                    </div>
                    <Text variant="muted" size="xs" style={{ "margin-top": tokens.spacing.xs, color: tokens.colors.text.muted }}>
                      Describe your use case and AI will generate a system prompt
                    </Text>
                  </div>
                </Show>

                {/* System Prompt */}
                <div style={{ "margin-bottom": tokens.spacing.md }}>
                  <Text variant="muted" size="xs" style={{ "margin-bottom": tokens.spacing.xs }}>
                    SYSTEM PROMPT
                  </Text>
                  <textarea
                    value={formData.systemPrompt}
                    onInput={(e) => setFormData("systemPrompt", e.currentTarget.value)}
                    placeholder="You are an AI assistant that..."
                    disabled={selectedAgent()?.isBuiltIn}
                    style={{
                      width: "100%",
                      height: "200px",
                      padding: tokens.spacing.sm,
                      background: tokens.colors.surface.popup,
                      border: `1px solid ${tokens.colors.border.default}`,
                      "border-radius": tokens.radius.sm,
                      color: tokens.colors.text.primary,
                      "font-size": "12px",
                      "font-family": "var(--font-mono)",
                      resize: "vertical",
                    }}
                  />
                </div>

                {/* Agent Type */}
                <div style={{ "margin-bottom": tokens.spacing.md }}>
                  <Text variant="muted" size="xs" style={{ "margin-bottom": tokens.spacing.xs }}>
                    TYPE
                  </Text>
                  <select
                    value={formData.agentType}
                    onChange={(e) => setFormData("agentType", e.currentTarget.value as AgentType)}
                    disabled={selectedAgent()?.isBuiltIn}
                    style={{
                      width: "100%",
                      padding: tokens.spacing.sm,
                      background: tokens.colors.surface.popup,
                      border: `1px solid ${tokens.colors.border.default}`,
                      "border-radius": tokens.radius.sm,
                      color: tokens.colors.text.primary,
                      "font-size": "12px",
                    }}
                  >
                    <option value="custom">Custom</option>
                    <option value="code">Code</option>
                    <option value="research">Research</option>
                    <option value="test">Test</option>
                    <option value="review">Review</option>
                  </select>
                </div>

                {/* Enabled for Task Tool - only show for custom agents */}
                <Show when={!selectedAgent()?.isBuiltIn}>
                  <div style={{ "margin-bottom": tokens.spacing.md }}>
                    <label
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: tokens.spacing.sm,
                        cursor: "pointer",
                        padding: tokens.spacing.sm,
                        background: tokens.colors.surface.popup,
                        "border-radius": tokens.radius.sm,
                        border: `1px solid ${tokens.colors.border.default}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgent()?.enabled ?? true}
                        onChange={(e) => {
                          const agent = selectedAgent();
                          if (agent) {
                            const updatedAgent = { ...agent, enabled: e.currentTarget.checked };
                            setAgents((prev) => prev.map((a) => a.id === agent.id ? updatedAgent : a));
                            setSelectedAgent(updatedAgent);
                            saveAgents();
                          }
                        }}
                        style={{
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                        }}
                      />
                      <div>
                        <Text variant="body" size="sm">Available in Task Tool</Text>
                        <Text variant="muted" size="xs" style={{ display: "block" }}>
                          When enabled, this agent can be used via the Task function
                        </Text>
                      </div>
                    </label>
                  </div>
                </Show>

                {/* Statistics (only for existing agents) */}
                <Show when={selectedAgent()}>
                  <div style={{ "margin-bottom": tokens.spacing.md }}>
                    <Text variant="muted" size="xs" style={{ "margin-bottom": tokens.spacing.sm }}>
                      STATISTICS
                    </Text>
                    <div
                      style={{
                        display: "grid",
                        "grid-template-columns": "1fr 1fr",
                        gap: tokens.spacing.sm,
                      }}
                    >
                      <div
                        style={{
                          padding: tokens.spacing.sm,
                          background: tokens.colors.surface.popup,
                          "border-radius": tokens.radius.sm,
                        }}
                      >
                        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                          <Icon name="bolt" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.primary }} />
                          <Text variant="muted" size="xs">Tokens</Text>
                        </div>
                        <Text variant="body" size="sm" weight="medium">
                          {formatTokens(selectedAgent()!.tokensUsed)}
                        </Text>
                      </div>
                      <div
                        style={{
                          padding: tokens.spacing.sm,
                          background: tokens.colors.surface.popup,
                          "border-radius": tokens.radius.sm,
                        }}
                      >
                        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                          <Icon name="dollar-sign" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.success }} />
                          <Text variant="muted" size="xs">Cost</Text>
                        </div>
                        <Text variant="body" size="sm" weight="medium">
                          {formatCost(selectedAgent()!.costUsd)}
                        </Text>
                      </div>
                      <div
                        style={{
                          padding: tokens.spacing.sm,
                          background: tokens.colors.surface.popup,
                          "border-radius": tokens.radius.sm,
                        }}
                      >
                        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                          <Icon name="circle-check" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.success }} />
                          <Text variant="muted" size="xs">Completed</Text>
                        </div>
                        <Text variant="body" size="sm" weight="medium">
                          {selectedAgent()!.tasksCompleted}
                        </Text>
                      </div>
                      <div
                        style={{
                          padding: tokens.spacing.sm,
                          background: tokens.colors.surface.popup,
                          "border-radius": tokens.radius.sm,
                        }}
                      >
                        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                          <Icon name="xmark" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.error }} />
                          <Text variant="muted" size="xs">Failed</Text>
                        </div>
                        <Text variant="body" size="sm" weight="medium">
                          {selectedAgent()!.tasksFailed}
                        </Text>
                      </div>
                    </div>
                  </div>
                </Show>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: tokens.spacing.sm }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    style={{ flex: "1" }}
                  >
                    Cancel
                  </Button>
                  <Show when={!selectedAgent()?.isBuiltIn}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveAgent}
                      disabled={loading() || !formData.name.trim() || !formData.systemPrompt.trim()}
                      style={{ flex: "1" }}
                    >
                      <Show
                        when={!loading()}
                        fallback={<Icon name="spinner" class="animate-spin" style={{ width: "14px", height: "14px" }} />}
                      >
                        <Icon name="floppy-disk" style={{ width: "14px", height: "14px" }} />
                      </Show>
                      {isCreating() ? "Create" : "Save"}
                    </Button>
                  </Show>
                </div>

                {/* Delete Button (only for custom agents in edit mode) */}
                <Show when={isEditing() && selectedAgent() && !selectedAgent()!.isBuiltIn}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAgent(selectedAgent()!)}
                    style={{
                      width: "100%",
                      "margin-top": tokens.spacing.md,
                      color: tokens.colors.semantic.error,
                    }}
                  >
                    <Icon name="trash" style={{ width: "14px", height: "14px" }} />
                    Delete Agent
                  </Button>
                </Show>
              </div>
            </div>
          }
        >
          {/* Agent List View */}
          <div>
            {/* Stats Summary */}
            <div
              style={{
                padding: tokens.spacing.md,
                display: "flex",
                gap: tokens.spacing.md,
                "border-bottom": `1px solid ${tokens.colors.border.divider}`,
              }}
            >
              <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                <Icon name="bolt" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.primary }} />
                <Text variant="muted" size="xs">{formatTokens(totalStats().totalTokens)}</Text>
              </div>
              <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                <Icon name="dollar-sign" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.success }} />
                <Text variant="muted" size="xs">{formatCost(totalStats().totalCost)}</Text>
              </div>
              <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                <Icon name="circle-check" style={{ width: "12px", height: "12px", color: tokens.colors.text.muted }} />
                <Text variant="muted" size="xs">{totalStats().totalTasks} tasks</Text>
              </div>
            </div>

            {/* Agents Section */}
            <div>
              <button
                style={sectionHeaderStyle}
                onClick={() => toggleSection("agents")}
              >
                {expandedSections().has("agents") ? (
                  <Icon name="chevron-down" style={{ width: "12px", height: "12px" }} />
                ) : (
                  <Icon name="chevron-right" style={{ width: "12px", height: "12px" }} />
                )}
                <span>Agents ({agents().length})</span>
              </button>
              
              <Show when={expandedSections().has("agents")}>
                <Show
                  when={agents().length > 0}
                  fallback={
                    <EmptyState
                      icon={<Icon name="microchip" />}
                      description="No agents yet"
                      action={
                        <Button variant="primary" size="sm" onClick={handleStartCreate}>
                          <Icon name="plus" style={{ width: "14px", height: "14px" }} />
                          Create Agent
                        </Button>
                      }
                    />
                  }
                >
                  <div style={{ padding: `0 ${tokens.spacing.sm}` }}>
                    <For each={agents()}>
                      {(agent) => {
                        const iconName = getAgentIcon(agent.agentType);
                        const isSelected = () => selectedAgent()?.id === agent.id;
                        const [showMenu, setShowMenu] = createSignal(false);
                        
                        return (
                          <div
                            style={{
                              position: "relative",
                              "margin-bottom": tokens.spacing.xs,
                            }}
                          >
                            <button
                              style={agentItemStyle(isSelected())}
                              onClick={() => handleSelectAgent(agent)}
                              onMouseEnter={(e) => {
                                if (!isSelected()) {
                                  e.currentTarget.style.background = tokens.colors.interactive.hover;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected()) {
                                  e.currentTarget.style.background = "transparent";
                                }
                              }}
                            >
                              {/* Status indicator */}
                              <div
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  "border-radius": "var(--cortex-radius-full)",
                                  background: getStatusColor(agent.status),
                                  "flex-shrink": "0",
                                }}
                              />
                              
                              {/* Icon */}
                              <Icon
                                name={iconName}
                                style={{
                                  width: "14px",
                                  height: "14px",
                                  color: tokens.colors.semantic.primary,
                                  "flex-shrink": "0",
                                }}
                              />
                              
                              {/* Info */}
                              <div style={{ flex: "1", "min-width": "0" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    "align-items": "center",
                                    gap: tokens.spacing.xs,
                                  }}
                                >
                                  <Text
                                    variant="body"
                                    size="sm"
                                    truncate
                                    style={{ flex: "1" }}
                                  >
                                    {agent.name}
                                  </Text>
                                  <Show when={agent.isBuiltIn}>
                                    <Badge variant="default" size="sm">Built-in</Badge>
                                  </Show>
                                </div>
                                <Text variant="muted" size="xs" truncate>
                                  {agent.tokensUsed > 0
                                    ? `${formatTokens(agent.tokensUsed)} tokens • ${formatCost(agent.costUsd)}`
                                    : agent.description
                                  }
                                </Text>
                              </div>
                              
                              {/* Menu button */}
                              <IconButton
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMenu(!showMenu());
                                }}
                              >
                                <Icon name="ellipsis-vertical" style={{ width: "14px", height: "14px" }} />
                              </IconButton>
                            </button>
                            
                            {/* Context menu */}
                            <Show when={showMenu()}>
                              <div
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  right: tokens.spacing.sm,
                                  "z-index": "100",
                                  "min-width": "140px",
                                  background: tokens.colors.surface.panel,
                                  border: `1px solid ${tokens.colors.border.default}`,
                                  "border-radius": tokens.radius.sm,
                                  "box-shadow": tokens.shadows.popup,
                                  overflow: "hidden",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  style={{
                                    width: "100%",
                                    display: "flex",
                                    "align-items": "center",
                                    gap: tokens.spacing.sm,
                                    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    color: tokens.colors.text.primary,
                                    "font-size": "12px",
                                  }}
                                  onClick={() => {
                                    handleSelectAgent(agent);
                                    setShowMenu(false);
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                >
                                  <Icon name="pen" style={{ width: "12px", height: "12px" }} />
                                  Edit
                                </button>
                                <button
                                  style={{
                                    width: "100%",
                                    display: "flex",
                                    "align-items": "center",
                                    gap: tokens.spacing.sm,
                                    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    color: tokens.colors.text.primary,
                                    "font-size": "12px",
                                  }}
                                  onClick={() => {
                                    handleDuplicateAgent(agent);
                                    setShowMenu(false);
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                >
                                  <Icon name="copy" style={{ width: "12px", height: "12px" }} />
                                  Duplicate
                                </button>
                                <Show when={!agent.isBuiltIn}>
                                  <div style={{ height: "1px", background: tokens.colors.border.divider }} />
                                  <button
                                    style={{
                                      width: "100%",
                                      display: "flex",
                                      "align-items": "center",
                                      gap: tokens.spacing.sm,
                                      padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                                      background: "transparent",
                                      border: "none",
                                      cursor: "pointer",
                                      color: tokens.colors.semantic.error,
                                      "font-size": "12px",
                                    }}
                                    onClick={() => {
                                      handleDeleteAgent(agent);
                                      setShowMenu(false);
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                  >
                                    <Icon name="trash" style={{ width: "12px", height: "12px" }} />
                                    Delete
                                  </button>
                                </Show>
                              </div>
                            </Show>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>

            {/* History Section */}
            <Show when={history().length > 0}>
              <div style={{ "margin-top": tokens.spacing.md }}>
                <button
                  style={sectionHeaderStyle}
                  onClick={() => toggleSection("history")}
                >
                  {expandedSections().has("history") ? (
                    <Icon name="chevron-down" style={{ width: "12px", height: "12px" }} />
                  ) : (
                    <Icon name="chevron-right" style={{ width: "12px", height: "12px" }} />
                  )}
                  <span>History ({history().length})</span>
                </button>
                
                <Show when={expandedSections().has("history")}>
                  <div style={{ padding: `0 ${tokens.spacing.sm}` }}>
                    <For each={history().slice(0, 10)}>
                      {(entry) => {
                        const agent = agents().find((a) => a.id === entry.agentId);
                        return (
                          <div
                            style={{
                              padding: tokens.spacing.sm,
                              "margin-bottom": tokens.spacing.xs,
                              background: tokens.colors.surface.popup,
                              "border-radius": tokens.radius.sm,
                            }}
                          >
                            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                              <div
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  "border-radius": "var(--cortex-radius-full)",
                                  background: getStatusColor(entry.status),
                                }}
                              />
                              <Text variant="body" size="xs" truncate style={{ flex: "1" }}>
                                {agent?.name || "Unknown Agent"}
                              </Text>
                              <Text variant="muted" size="xs">
                                {formatTokens(entry.tokensUsed)}
                              </Text>
                            </div>
                            <Text variant="muted" size="xs" truncate style={{ "margin-top": tokens.spacing.xs }}>
                              {entry.prompt}
                            </Text>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default AgentsSidebar;


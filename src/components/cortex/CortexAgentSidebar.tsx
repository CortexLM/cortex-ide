/**
 * CortexAgentSidebar - Agent workspace sidebar for Vibe mode
 * Figma: 326px sidebar with agent tree, task assignment, progress bars
 * Wired to agent_spawn / agent_list / agent_run_task Tauri IPC commands
 */

import { Component, For, Show, JSX, createSignal, onMount, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { CortexIcon } from "./primitives/CortexIcon";
import { CortexIconButton } from "./primitives/CortexIconButton";
import { AgentItem } from "./vibe/AgentItem";
import { ConversationItem } from "./vibe/ConversationItem";

export interface Conversation {
  id: string;
  title: string;
  status: "active" | "completed" | "error";
  changesCount?: number;
}

export interface Agent {
  id: string;
  name: string;
  branch: string;
  status: "running" | "idle" | "completed" | "error";
  conversations: Conversation[];
  isExpanded?: boolean;
  currentTask?: string;
  progress?: number;
  toolCalls?: string[];
}

export interface CortexAgentSidebarProps {
  projectName?: string;
  agents: Agent[];
  selectedConversationId?: string;
  onConversationSelect?: (agentId: string, conversationId: string) => void;
  onAgentToggle?: (agentId: string) => void;
  onNewWorkspace?: () => void;
  onSearch?: () => void;
  onAgentSpawn?: (agent: Agent) => void;
  onAgentTaskAssign?: (agentId: string, prompt: string) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

function AgentDetails(props: {
  agent: Agent;
  selectedConversationId?: string;
  onConversationSelect?: (agentId: string, convId: string) => void;
  onAgentTaskAssign?: (agentId: string, prompt: string) => void;
}) {
  const [taskInput, setTaskInput] = createSignal("");
  const [showInput, setShowInput] = createSignal(false);

  const handleRunTask = async () => {
    const prompt = taskInput().trim();
    if (!prompt) return;
    try {
      await invoke("agent_run_task", { agentId: props.agent.id, prompt, context: null });
    } catch { /* fallback */ }
    props.onAgentTaskAssign?.(props.agent.id, prompt);
    setTaskInput("");
    setShowInput(false);
  };

  return (
    <>
      <Show when={props.agent.status === "running" && props.agent.progress !== undefined}>
        <div style={{ "margin-top": "8px", "padding-left": "32px" }}>
          <div style={{ height: "3px", background: "var(--cortex-vibe-status-running-bg)", "border-radius": "var(--cortex-radius-2xs)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${props.agent.progress}%`, background: "var(--cortex-vibe-status-running)", "border-radius": "var(--cortex-radius-2xs)", transition: "width 300ms ease" }} />
          </div>
        </div>
      </Show>
      <Show when={props.agent.currentTask}>
        <div style={{ "padding-left": "32px", "margin-top": "4px", "font-family": "var(--cortex-font-sans)", "font-size": "var(--cortex-text-xs)", color: "var(--cortex-text-secondary)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          {props.agent.currentTask}
        </div>
      </Show>
      <Show when={props.agent.toolCalls && props.agent.toolCalls.length > 0}>
        <div style={{ "padding-left": "32px", "margin-top": "4px" }}>
          <For each={props.agent.toolCalls}>
            {(tc) => <div style={{ "font-family": "var(--cortex-font-mono)", "font-size": "11px", color: "var(--cortex-vibe-text-dim)", "padding-top": "2px" }}>→ {tc}</div>}
          </For>
        </div>
      </Show>
      <For each={props.agent.conversations}>
        {(conv) => (
          <ConversationItem
            title={conv.title}
            changesCount={conv.changesCount}
            isSelected={props.selectedConversationId === conv.id}
            onClick={() => props.onConversationSelect?.(props.agent.id, conv.id)}
          />
        )}
      </For>
      <Show when={showInput()}>
        <div style={{ "padding-left": "32px", "margin-top": "8px" }}>
          <input
            type="text"
            value={taskInput()}
            onInput={(e) => setTaskInput(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRunTask(); }}
            placeholder="Describe task..."
            style={{ width: "100%", background: "var(--cortex-bg-elevated)", border: `1px solid var(--cortex-border-strong)`, "border-radius": "var(--cortex-radius-md)", padding: "6px 8px", "font-family": "var(--cortex-font-sans)", "font-size": "var(--cortex-text-xs)", color: "var(--cortex-text-on-surface)", outline: "none", "box-sizing": "border-box" }}
          />
        </div>
      </Show>
      <Show when={!showInput()}>
        <div
          style={{ "padding-left": "32px", "margin-top": "4px", "font-family": "var(--cortex-font-sans)", "font-size": "var(--cortex-text-xs)", color: "var(--cortex-text-secondary)", cursor: "pointer", display: "flex", "align-items": "center", gap: "4px" }}
          onClick={() => setShowInput(true)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-on-surface)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-secondary)"; }}
        >
          <CortexIcon name="plus" size={12} color="currentColor" />
          <span>Assign task</span>
        </div>
      </Show>
    </>
  );
}

export const CortexAgentSidebar: Component<CortexAgentSidebarProps> = (props) => {
  const [newWsHovered, setNewWsHovered] = createSignal(false);
  const unlistenFns: UnlistenFn[] = [];

  onMount(async () => {
    try {
      const u = await listen("agent:task_progress", () => {});
      unlistenFns.push(u);
    } catch { /* Not in Tauri */ }
  });

  onCleanup(() => { unlistenFns.forEach(fn => fn()); });

  const handleSpawnAgent = async () => {
    try {
      const result = await invoke("agent_spawn", {
        name: `Agent ${props.agents.length + 1}`,
        systemPrompt: "You are a helpful coding assistant.",
        model: null, parentId: null, agentType: "code",
      });
      props.onAgentSpawn?.(result as Agent);
    } catch {
      props.onNewWorkspace?.();
    }
  };

  return (
    <div class={props.class} style={{
      width: "326px", height: "100%", background: "var(--cortex-bg-primary)",
      border: "1px solid var(--cortex-border-default)", "border-radius": "var(--cortex-radius-xl)",
      display: "flex", "flex-direction": "column", overflow: "hidden", "flex-shrink": "0",
      ...props.style,
    }}>
      <div style={{
        height: "48px", padding: "0 16px", display: "flex",
        "align-items": "center", gap: "10px",
        "border-bottom": "1px solid var(--cortex-border-default)", "flex-shrink": "0",
      }}>
        <span style={{
          flex: "1", "font-family": "var(--cortex-font-sans)", "font-size": "18px",
          "font-weight": "var(--cortex-font-medium)", color: "var(--cortex-text-on-surface)", "text-align": "center",
          overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap",
        }}>
          {props.projectName || "Home"}
        </span>
        <CortexIconButton icon="search" size={20} onClick={props.onSearch} />
      </div>

      <div style={{ flex: "1", overflow: "auto", padding: "16px", display: "flex", "flex-direction": "column", gap: "16px" }}>
        <For each={props.agents}>
          {(agent) => (
            <div>
              <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <AgentItem name={agent.name} status={agent.status} isExpanded={agent.isExpanded || false} onToggle={() => props.onAgentToggle?.(agent.id)} />
                <span style={{ "font-family": "var(--cortex-font-sans)", "font-size": "var(--cortex-text-xs)", color: "var(--cortex-vibe-branch-color)", background: "var(--cortex-vibe-branch-bg)", padding: "4px 6px", "border-radius": "var(--cortex-radius-xs)", "white-space": "nowrap", "flex-shrink": "0" }}>
                  {agent.branch}
                </span>
              </div>
              <Show when={agent.isExpanded}>
                <AgentDetails
                  agent={agent}
                  selectedConversationId={props.selectedConversationId}
                  onConversationSelect={props.onConversationSelect}
                  onAgentTaskAssign={props.onAgentTaskAssign}
                />
              </Show>
            </div>
          )}
        </For>
      </div>

      <div style={{ "border-top": "1px solid var(--cortex-border-default)", padding: "16px", "flex-shrink": "0", display: "flex", "flex-direction": "column", gap: "16px" }}>
        <div
          style={{
            display: "flex", "align-items": "center", gap: "4px", cursor: "pointer",
            color: newWsHovered() ? "var(--cortex-text-on-surface)" : "var(--cortex-text-secondary)",
            "font-family": "var(--cortex-font-sans)", "font-size": "var(--cortex-text-sm)", "font-weight": "var(--cortex-font-medium)",
            transition: "color 150ms ease", background: "none", border: "none", padding: "0",
          }}
          onClick={handleSpawnAgent}
          onMouseEnter={() => setNewWsHovered(true)}
          onMouseLeave={() => setNewWsHovered(false)}
        >
          <CortexIcon name="plus" size={16} color={newWsHovered() ? "var(--cortex-text-on-surface)" : "var(--cortex-text-secondary)"} />
          <span>New workspace</span>
        </div>
      </div>
    </div>
  );
};

export default CortexAgentSidebar;

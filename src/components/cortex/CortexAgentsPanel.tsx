import { Component, For, Show, createSignal, onMount, JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { CortexIcon } from "./primitives/CortexIcon";
import { CortexIconButton } from "./primitives/CortexIconButton";
import type { SubAgent, SubAgentStatus } from "@/types";

interface AgentTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
}

const TEMPLATES: AgentTemplate[] = [
  { id: "coder", name: "Coder", icon: "code", description: "Writes and refactors code", systemPrompt: "You are a coding assistant. Write clean, well-tested code." },
  { id: "reviewer", name: "Reviewer", icon: "eye", description: "Reviews code for issues", systemPrompt: "You are a code reviewer. Find bugs, security issues, and suggest improvements." },
  { id: "researcher", name: "Researcher", icon: "search", description: "Researches documentation", systemPrompt: "You are a research assistant. Find relevant documentation and examples." },
  { id: "tester", name: "Tester", icon: "play", description: "Writes and runs tests", systemPrompt: "You are a testing assistant. Write comprehensive test cases." },
];

const STATUS_COLORS: Record<SubAgentStatus, string> = {
  running: "#B2FF22",
  idle: "#8C8D8F",
  completed: "#10B981",
  failed: "#EF4444",
};

const STATUS_LABELS: Record<SubAgentStatus, string> = {
  running: "Running",
  idle: "Idle",
  completed: "Done",
  failed: "Failed",
};

const HDR: JSX.CSSProperties = {
  display: "flex", "align-items": "center", gap: "8px", padding: "12px 16px",
  "border-bottom": "1px solid var(--cortex-border-default)", "flex-shrink": "0",
};
const SEC_HDR: JSX.CSSProperties = {
  display: "flex", "align-items": "center", gap: "6px", padding: "8px 16px", cursor: "pointer", "user-select": "none",
};
const SEC_TITLE: JSX.CSSProperties = {
  flex: "1", "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: "var(--cortex-text-inactive)",
};

export const CortexAgentsPanel: Component = () => {
  const [agents, setAgents] = createSignal<SubAgent[]>([]);
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [templatesExpanded, setTemplatesExpanded] = createSignal(true);
  const [agentsExpanded, setAgentsExpanded] = createSignal(true);
  const [configExpanded, setConfigExpanded] = createSignal(false);
  const [taskPrompt, setTaskPrompt] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [spawning, setSpawning] = createSignal(false);

  const fetchAgents = async () => {
    try {
      const result = await invoke<SubAgent[]>("agent_list");
      setAgents(result);
    } catch (e) {
      console.error("[CortexAgentsPanel] Failed to fetch agents:", e);
    }
  };

  onMount(() => { fetchAgents(); });

  const selectedAgent = () => agents().find(a => a.id === selectedId());

  const handleSpawn = async (template: AgentTemplate) => {
    setSpawning(true);
    setError(null);
    try {
      const result = await invoke<SubAgent>("agent_spawn", {
        name: template.name,
        systemPrompt: template.systemPrompt,
        parentId: null,
      });
      await fetchAgents();
      setSelectedId(result.id);
      setConfigExpanded(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSpawning(false);
    }
  };

  const MAX_TASK_PROMPT_LENGTH = 10_000;

  const handleRunTask = async () => {
    const agent = selectedAgent();
    const prompt = taskPrompt().trim().slice(0, MAX_TASK_PROMPT_LENGTH);
    if (!agent || !prompt) return;
    setError(null);
    try {
      await invoke("agent_run_task", { agentId: agent.id, prompt, context: [] });
      setTaskPrompt("");
      await fetchAgents();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", background: "var(--cortex-bg-secondary)", color: "var(--cortex-text-primary)", "font-family": "var(--cortex-font-sans)", overflow: "auto" }}>
      <div style={HDR}>
        <CortexIcon name="users" size={16} color="var(--cortex-text-primary)" />
        <span style={{ flex: "1", "font-size": "13px", "font-weight": "500" }}>AI Agents</span>
        <CortexIconButton icon="refresh-cw" size={14} onClick={fetchAgents} title="Refresh" />
      </div>

      <Show when={error()}>
        <div style={{ padding: "8px 16px", "font-size": "12px", color: "#EF4444", background: "rgba(239,68,68,0.1)", "border-bottom": "1px solid var(--cortex-border-default)" }}>
          {error()}
        </div>
      </Show>

      {/* Templates */}
      <div>
        <div style={SEC_HDR} onClick={() => setTemplatesExpanded(!templatesExpanded())}>
          <CortexIcon name="chevron-right" size={10} style={{ transform: templatesExpanded() ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} color="var(--cortex-text-inactive)" />
          <span style={SEC_TITLE}>Templates</span>
        </div>
        <Show when={templatesExpanded()}>
          <div style={{ padding: "0 16px 12px", display: "flex", "flex-direction": "column", gap: "4px" }}>
            <For each={TEMPLATES}>
              {(tpl) => (
                <button onClick={() => handleSpawn(tpl)} disabled={spawning()} style={{
                  display: "flex", "align-items": "center", gap: "10px", padding: "8px 10px", background: "transparent", border: "1px solid var(--cortex-border-default)",
                  "border-radius": "var(--cortex-radius-md)", cursor: spawning() ? "wait" : "pointer", width: "100%", "text-align": "left", transition: "background 100ms",
                }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                   onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <CortexIcon name={tpl.icon} size={16} color="var(--cortex-text-primary)" />
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--cortex-text-primary)" }}>{tpl.name}</div>
                    <div style={{ "font-size": "11px", color: "var(--cortex-text-secondary)", "margin-top": "2px" }}>{tpl.description}</div>
                  </div>
                  <CortexIcon name="plus" size={14} color="var(--cortex-text-inactive)" />
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Running Agents */}
      <div style={{ "border-top": "1px solid var(--cortex-border-default)" }}>
        <div style={SEC_HDR} onClick={() => setAgentsExpanded(!agentsExpanded())}>
          <CortexIcon name="chevron-right" size={10} style={{ transform: agentsExpanded() ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} color="var(--cortex-text-inactive)" />
          <span style={SEC_TITLE}>Agents ({agents().length})</span>
        </div>
        <Show when={agentsExpanded()}>
          <div style={{ padding: "0 16px 12px", display: "flex", "flex-direction": "column", gap: "4px" }}>
            <Show when={agents().length === 0}>
              <div style={{ "font-size": "12px", color: "var(--cortex-text-inactive)", padding: "8px 0" }}>No agents spawned yet. Use a template above.</div>
            </Show>
            <For each={agents()}>
              {(agent) => (
                <button onClick={() => { setSelectedId(agent.id); setConfigExpanded(true); }} style={{
                  display: "flex", "align-items": "center", gap: "8px", padding: "8px 10px", width: "100%", "text-align": "left", cursor: "pointer", transition: "background 100ms",
                  background: selectedId() === agent.id ? "var(--cortex-bg-hover)" : "transparent",
                  border: selectedId() === agent.id ? "1px solid var(--cortex-accent-primary)" : "1px solid var(--cortex-border-default)",
                  "border-radius": "var(--cortex-radius-md)",
                }}>
                  <div style={{ width: "8px", height: "8px", "border-radius": "50%", background: STATUS_COLORS[agent.status], "flex-shrink": "0" }} />
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--cortex-text-primary)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{agent.name}</div>
                  </div>
                  <span style={{
                    "font-size": "10px", padding: "2px 6px", "border-radius": "var(--cortex-radius-sm)",
                    background: `${STATUS_COLORS[agent.status]}20`, color: STATUS_COLORS[agent.status],
                  }}>{STATUS_LABELS[agent.status]}</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Agent Config */}
      <Show when={selectedAgent()}>
        <div style={{ "border-top": "1px solid var(--cortex-border-default)" }}>
          <div style={SEC_HDR} onClick={() => setConfigExpanded(!configExpanded())}>
            <CortexIcon name="chevron-right" size={10} style={{ transform: configExpanded() ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} color="var(--cortex-text-inactive)" />
            <span style={SEC_TITLE}>Configuration</span>
          </div>
          <Show when={configExpanded()}>
            <div style={{ padding: "0 16px 16px", display: "flex", "flex-direction": "column", gap: "10px" }}>
              <div>
                <label style={{ "font-size": "11px", color: "var(--cortex-text-inactive)", display: "block", "margin-bottom": "4px" }}>Name</label>
                <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>{selectedAgent()!.name}</div>
              </div>
              <div>
                <label style={{ "font-size": "11px", color: "var(--cortex-text-inactive)", display: "block", "margin-bottom": "4px" }}>System Prompt</label>
                <div style={{ "font-size": "12px", color: "var(--cortex-text-secondary)", background: "var(--cortex-bg-primary)", padding: "8px", "border-radius": "var(--cortex-radius-sm)", "max-height": "80px", overflow: "auto" }}>
                  {selectedAgent()!.systemPrompt || "—"}
                </div>
              </div>
              <div>
                <label style={{ "font-size": "11px", color: "var(--cortex-text-inactive)", display: "block", "margin-bottom": "4px" }}>Run Task</label>
                <div style={{ display: "flex", gap: "4px" }}>
                  <input value={taskPrompt()} onInput={(e) => setTaskPrompt(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") handleRunTask(); }}
                    placeholder="Enter a task prompt..." style={{
                      flex: "1", padding: "6px 10px", background: "var(--cortex-bg-primary)", color: "var(--cortex-text-primary)", border: "1px solid var(--cortex-border-default)",
                      "border-radius": "var(--cortex-radius-sm)", "font-size": "12px", "font-family": "var(--cortex-font-sans)",
                    }} />
                  <button onClick={handleRunTask} disabled={!taskPrompt().trim()} style={{
                    padding: "6px 12px", background: "var(--cortex-accent-primary)", color: "#000", border: "none", "border-radius": "var(--cortex-radius-sm)",
                    "font-size": "12px", "font-weight": "500", cursor: taskPrompt().trim() ? "pointer" : "not-allowed", opacity: taskPrompt().trim() ? "1" : "0.5",
                  }}>Run</button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default CortexAgentsPanel;

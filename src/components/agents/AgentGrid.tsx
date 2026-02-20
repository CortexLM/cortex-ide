import { JSX, For, Show } from "solid-js";
import { AgentCard } from "./AgentCard";
import { Icon } from "@/components/ui/Icon";
import type { Agent } from "@/types/agents";

interface AgentGridProps {
  agents: Agent[];
  loading?: boolean;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onInvoke?: (agent: Agent) => void;
}

export function AgentGrid(props: AgentGridProps) {
  const gridStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "16px",
  };

  const loadingStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    padding: "60px 20px",
    color: "var(--text-muted)",
    gap: "12px",
  };

  const emptyStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    padding: "60px 20px",
    "text-align": "center",
  };

  const emptyIconStyle: JSX.CSSProperties = {
    width: "64px",
    height: "64px",
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--surface-hover)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    color: "var(--text-weaker)",
    "margin-bottom": "16px",
  };

  const emptyTitleStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "16px",
    "font-weight": "600",
    color: "var(--text-primary)",
    margin: "0 0 8px",
  };

  const emptyDescStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--text-muted)",
    margin: "0",
    "max-width": "300px",
  };

  return (
    <>
      <Show when={props.loading}>
        <div style={loadingStyle}>
          <Icon name="spinner" size={24} class="animate-spin" />
          <span>Loading agents...</span>
        </div>
      </Show>

      <Show when={!props.loading && props.agents.length === 0}>
        <div style={emptyStyle}>
          <div style={emptyIconStyle}>
            <Icon name="robot" size={28} />
          </div>
          <h3 style={emptyTitleStyle}>No Agents Yet</h3>
          <p style={emptyDescStyle}>
            Create your first agent to extend Cortex's capabilities with custom behaviors and tools.
          </p>
        </div>
      </Show>

      <Show when={!props.loading && props.agents.length > 0}>
        <div style={gridStyle}>
          <For each={props.agents}>
            {(agent) => (
              <AgentCard
                agent={agent}
                onEdit={() => props.onEdit(agent)}
                onDelete={() => props.onDelete(agent)}
                onInvoke={props.onInvoke ? () => props.onInvoke!(agent) : undefined}
              />
            )}
          </For>
        </div>
      </Show>
    </>
  );
}


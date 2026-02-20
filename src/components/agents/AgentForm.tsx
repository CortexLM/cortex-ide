import { JSX, For, Show, createSignal, createEffect } from "solid-js";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";
import type { Agent, AgentFormData } from "@/types/agents";

interface AgentFormProps {
  agent?: Agent;
  onSubmit: (data: AgentFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const AVAILABLE_TOOLS = [
  { id: "Read", label: "Read file contents", category: "file" },
  { id: "Create", label: "Create/write files", category: "file" },
  { id: "Edit", label: "Edit existing files", category: "file" },
  { id: "LS", label: "List directory contents", category: "file" },
  { id: "Glob", label: "Find files by pattern", category: "search" },
  { id: "Grep", label: "Search file contents", category: "search" },
  { id: "Execute", label: "Execute shell commands", category: "execution" },
  { id: "WebSearch", label: "Search the web", category: "network" },
  { id: "FetchUrl", label: "Fetch URL content", category: "network" },
  { id: "TodoWrite", label: "Manage todo lists", category: "utility" },
];

const MODELS = [
  { value: "inherit", label: "Inherit from session" },
  { value: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
];

const REASONING_EFFORTS = [
  { value: "low", label: "Low - Faster responses" },
  { value: "medium", label: "Medium - Balanced" },
  { value: "high", label: "High - More thorough" },
];

const SCOPES = [
  { value: "project", label: "Project - This project only" },
  { value: "user", label: "User - All your projects" },
];

export function AgentForm(props: AgentFormProps) {
  const [name, setName] = createSignal(props.agent?.name || "");
  const [description, setDescription] = createSignal(props.agent?.description || "");
  const [model, setModel] = createSignal(props.agent?.model || "inherit");
  const [reasoningEffort, setReasoningEffort] = createSignal<"low" | "medium" | "high">(
    props.agent?.reasoningEffort || "medium"
  );
  const [tools, setTools] = createSignal<string[]>(props.agent?.tools || []);
  const [prompt, setPrompt] = createSignal(props.agent?.prompt || "");
  const [scope, setScope] = createSignal<"project" | "user">(
    props.agent?.scope === "builtin" ? "project" : (props.agent?.scope as "project" | "user") || "project"
  );

  const [nameError, setNameError] = createSignal<string | null>(null);

  // Validate name format
  createEffect(() => {
    const n = name();
    if (n && !/^[a-z0-9-]+$/.test(n)) {
      setNameError("Name must be lowercase letters, numbers, and hyphens only");
    } else {
      setNameError(null);
    }
  });

  const toggleTool = (toolId: string) => {
    const current = tools();
    if (current.includes(toolId)) {
      setTools(current.filter((t) => t !== toolId));
    } else {
      setTools([...current, toolId]);
    }
  };

  const selectAllTools = () => setTools(AVAILABLE_TOOLS.map((t) => t.id));
  const clearAllTools = () => setTools([]);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!name() || !description() || nameError()) return;

    props.onSubmit({
      name: name(),
      description: description(),
      model: model(),
      reasoningEffort: reasoningEffort(),
      tools: tools(),
      prompt: prompt(),
      scope: scope(),
    });
  };

  const isValid = () => name() && description() && !nameError();

  const formStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "20px",
  };

  const fieldStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "6px",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--text-primary)",
  };

  const hintStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "11px",
    color: "var(--text-muted)",
  };

  const errorStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "11px",
    color: "var(--state-error)",
  };

  const toolsHeaderStyle: JSX.CSSProperties = {
    display: "flex",
    "justify-content": "space-between",
    "align-items": "center",
  };

  const toolsGridStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "repeat(2, 1fr)",
    gap: "4px",
  };

  const toolButtonStyle = (selected: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    background: selected ? "var(--surface-hover)" : "transparent",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--jb-radius-sm)",
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--text-primary)",
    cursor: "pointer",
    "text-align": "left",
    transition: "background 150ms ease",
  });

  const textareaStyle: JSX.CSSProperties = {
    width: "100%",
    "min-height": "150px",
    padding: "12px",
    "font-family": "var(--jb-font-mono)",
    "font-size": "13px",
    "line-height": "1.5",
    background: "var(--surface-input)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--jb-radius-sm)",
    color: "var(--text-primary)",
    resize: "vertical",
  };

  const rowStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "1fr 1fr",
    gap: "16px",
  };

  const footerStyle: JSX.CSSProperties = {
    display: "flex",
    "justify-content": "flex-end",
    gap: "12px",
    "padding-top": "16px",
    "border-top": "1px solid var(--border-default)",
  };

  return (
    <form style={formStyle} onSubmit={handleSubmit}>
      {/* Scope */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Scope</label>
        <Select
          options={SCOPES}
          value={scope()}
          onChange={(v) => setScope(v as "project" | "user")}
        />
        <span style={hintStyle}>
          Project agents are stored in .cortex/agents/, user agents in ~/.cortex/agents/
        </span>
      </div>

      {/* Name */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Name</label>
        <Input
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          placeholder="code-reviewer"
          error={nameError() || undefined}
        />
        <Show when={nameError()} fallback={<span style={hintStyle}>Lowercase letters, numbers, and hyphens only</span>}>
          <span style={errorStyle}>{nameError()}</span>
        </Show>
      </div>

      {/* Description */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Description</label>
        <Input
          type="text"
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          placeholder="Expert code reviewer. Use proactively after code changes."
        />
        <span style={hintStyle}>Describes when this agent should be used</span>
      </div>

      {/* Model & Reasoning */}
      <div style={rowStyle}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Model</label>
          <Select
            options={MODELS}
            value={model()}
            onChange={setModel}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Reasoning Effort</label>
          <Select
            options={REASONING_EFFORTS}
            value={reasoningEffort()}
            onChange={(v) => setReasoningEffort(v as "low" | "medium" | "high")}
          />
        </div>
      </div>

      {/* Tools */}
      <div style={fieldStyle}>
        <div style={toolsHeaderStyle}>
          <label style={labelStyle}>Tools</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={selectAllTools}
              style={{ ...hintStyle, cursor: "pointer", background: "none", border: "none" }}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAllTools}
              style={{ ...hintStyle, cursor: "pointer", background: "none", border: "none" }}
            >
              Clear
            </button>
          </div>
        </div>
        <div style={toolsGridStyle}>
          <For each={AVAILABLE_TOOLS}>
            {(tool) => (
              <button
                type="button"
                style={toolButtonStyle(tools().includes(tool.id))}
                onClick={() => toggleTool(tool.id)}
                onMouseEnter={(e) => {
                  if (!tools().includes(tool.id)) {
                    e.currentTarget.style.background = "var(--surface-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!tools().includes(tool.id)) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <Icon
                  name={tools().includes(tool.id) ? "square-check" : "square"}
                  size={14}
                  style={{ color: tools().includes(tool.id) ? "var(--accent-primary)" : "var(--text-muted)" }}
                />
                <span>{tool.id}</span>
              </button>
            )}
          </For>
        </div>
        <span style={hintStyle}>Leave empty to inherit all tools from the session</span>
      </div>

      {/* System Prompt */}
      <div style={fieldStyle}>
        <label style={labelStyle}>System Prompt</label>
        <textarea
          style={textareaStyle}
          value={prompt()}
          onInput={(e) => setPrompt(e.currentTarget.value)}
          placeholder="You are an expert code reviewer..."
        />
        <span style={hintStyle}>The system prompt that defines this agent's behavior</span>
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <Button variant="ghost" onClick={props.onCancel} disabled={props.loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!isValid() || props.loading}
          loading={props.loading}
        >
          {props.agent ? "Save Changes" : "Create Agent"}
        </Button>
      </div>
    </form>
  );
}

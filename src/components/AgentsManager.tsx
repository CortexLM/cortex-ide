import { createSignal, createEffect, Show, For } from "solid-js";
import { Icon } from "./ui/Icon";
import { useSDK } from "@/context/SDKContext";

// Cortex API base URL for completions
const CORTEX_API_URL = "https://api.cortex.foundation";

export interface AgentDefinition {
  name: string;
  description: string;
  tools: string[];
  model: string;
  permissionMode: string;
  prompt: string;
  scope: "project" | "user";
  filePath?: string;
}

// Function definition for agent generation via OpenAI-style function calling
const AGENT_GENERATION_FUNCTION = {
  name: "generate_agent_config",
  description: "Generate a complete agent configuration based on the user's description",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "A short, lowercase, hyphenated name for the agent (e.g., 'code-reviewer', 'test-writer')"
      },
      description: {
        type: "string",
        description: "A brief description of when this agent should be used and what it does"
      },
      tools: {
        type: "array",
        items: { type: "string" },
        description: "List of tools the agent should have access to. Available tools: Read, Create, Edit, Glob, Grep, Execute, LS, WebSearch, FetchUrl, TodoWrite"
      },
      model: {
        type: "string",
        enum: ["inherit", "sonnet", "opus", "haiku"],
        description: "The model to use for this agent"
      },
      prompt: {
        type: "string",
        description: "The system prompt that defines this agent's behavior, expertise, and guidelines"
      }
    },
    required: ["name", "description", "tools", "prompt"]
  }
};

interface AgentsManagerProps {
  visible: boolean;
  onClose: () => void;
}

const AVAILABLE_TOOLS = [
  { id: "Read", label: "Read file contents" },
  { id: "Create", label: "Create/write files" },
  { id: "Edit", label: "Edit existing files" },
  { id: "Glob", label: "Find files by pattern" },
  { id: "Grep", label: "Search file contents" },
  { id: "Execute", label: "Execute shell commands" },
  { id: "LS", label: "List directory contents" },
  { id: "WebSearch", label: "Search the web" },
  { id: "FetchUrl", label: "Fetch URL content" },
  { id: "TodoWrite", label: "Manage todo lists" },
];

const MODELS = [
  { id: "inherit", label: "Inherit (use session model)" },
  { id: "sonnet", label: "Sonnet (balanced)" },
  { id: "opus", label: "Opus (most capable)" },
  { id: "haiku", label: "Haiku (fastest)" },
];

export function AgentsManager(props: AgentsManagerProps) {
  const { state } = useSDK();
  const [agents, setAgents] = createSignal<AgentDefinition[]>([]);
  const [mode, setMode] = createSignal<"list" | "create" | "edit" | "ai">("list");
  const [loading, setLoading] = createSignal(false);
  const [generating, setGenerating] = createSignal(false);
  const [aiError, setAiError] = createSignal<string | null>(null);
  
  // Form state
  const [formName, setFormName] = createSignal("");
  const [formDescription, setFormDescription] = createSignal("");
  const [formTools, setFormTools] = createSignal<string[]>([]);
  const [formModel, setFormModel] = createSignal("inherit");
  const [formPermission, setFormPermission] = createSignal("default");
  const [formPrompt, setFormPrompt] = createSignal("");
  const [formScope, setFormScope] = createSignal<"project" | "user">("project");
  const [aiPrompt, setAiPrompt] = createSignal("");

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${state.serverUrl}/api/v1/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (e) {
      console.error("Failed to fetch agents:", e);
      // Load from local files as fallback
      loadLocalAgents();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalAgents = async () => {
    // This would need to be implemented via Tauri commands in real app
    // For now, we'll just use the server API
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormTools([]);
    setFormModel("inherit");
    setFormPermission("default");
    setFormPrompt("");
    setFormScope("project");
    setAiPrompt("");
    setAiError(null);
  };

  const startCreate = () => {
    resetForm();
    setMode("create");
  };

  const startAICreate = () => {
    resetForm();
    setMode("ai");
  };

  const generateWithAI = async () => {
    if (!aiPrompt().trim()) return;
    
    setGenerating(true);
    setAiError(null);
    
    try {
      // Use the completions API with function calling to generate agent config
      const systemPrompt = `You are an AI assistant that helps create custom agent configurations for Cortex, an AI-powered coding assistant.

When the user describes what kind of agent they want, you must generate a complete agent configuration by calling the generate_agent_config function.

Guidelines for generating agents:
1. Name should be lowercase, hyphenated, and descriptive (e.g., "code-reviewer", "security-auditor")
2. Description should clearly explain when to use this agent
3. Select appropriate tools based on what the agent needs to do:
   - Read: For reading file contents
   - Create: For creating new files
   - Edit: For modifying existing files
   - Glob: For finding files by pattern
   - Grep: For searching file contents
   - Execute: For running shell commands
   - LS: For listing directories
   - WebSearch: For searching the web
   - FetchUrl: For fetching URL content
   - TodoWrite: For managing todo lists
4. Do NOT include tools that require user interaction/ask (the agent should work autonomously)
5. The system prompt should be detailed and clearly define the agent's expertise, behavior, and guidelines`;

      const res = await fetch(`${CORTEX_API_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: state.config?.model || "anthropic/claude-sonnet-4",
          messages: [
            { role: "system", content: systemPrompt },
            // User message is internal - don't expose "Create an agent with..." to the user
            { role: "user", content: aiPrompt() }
          ],
          tools: [{
            type: "function",
            function: AGENT_GENERATION_FUNCTION
          }],
          tool_choice: { type: "function", function: { name: "generate_agent_config" } }
        }),
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to generate agent");
      }
      
      const data = await res.json();
      
      // Extract the function call result
      const choice = data.choices?.[0];
      const toolCall = choice?.message?.tool_calls?.[0];
      
      if (!toolCall || toolCall.function?.name !== "generate_agent_config") {
        throw new Error("AI did not return a valid agent configuration");
      }
      
      // Parse the function arguments
      const agentConfig = JSON.parse(toolCall.function.arguments);
      
      // Fill form with generated data
      setFormName(agentConfig.name || "");
      setFormDescription(agentConfig.description || "");
      setFormPrompt(agentConfig.prompt || "");
      setFormTools(agentConfig.tools || []);
      setFormModel(agentConfig.model || "inherit");
      setFormPermission("default"); // Default permission mode for safety
      
      // Switch to create mode to review and validate tools
      setMode("create");
    } catch (e) {
      console.error("AI generation error:", e);
      setAiError(e instanceof Error ? e.message : "Failed to generate agent");
    } finally {
      setGenerating(false);
    }
  };

  // Auto-save and return to list after AI generation creates valid agent
  const generateAndSaveWithAI = async () => {
    if (!aiPrompt().trim()) return;
    
    setGenerating(true);
    setAiError(null);
    
    try {
      // Use the completions API with function calling to generate agent config
      const systemPrompt = `You are an AI assistant that helps create custom agent configurations for Cortex, an AI-powered coding assistant.

When the user describes what kind of agent they want, you must generate a complete agent configuration by calling the generate_agent_config function.

Guidelines for generating agents:
1. Name should be lowercase, hyphenated, and descriptive (e.g., "code-reviewer", "security-auditor")
2. Description should clearly explain when to use this agent
3. Select appropriate tools based on what the agent needs to do:
   - Read: For reading file contents
   - Create: For creating new files
   - Edit: For modifying existing files
   - Glob: For finding files by pattern
   - Grep: For searching file contents
   - Execute: For running shell commands
   - LS: For listing directories
   - WebSearch: For searching the web
   - FetchUrl: For fetching URL content
   - TodoWrite: For managing todo lists
4. Do NOT include tools that require user interaction/ask (the agent should work autonomously)
5. The system prompt should be detailed and clearly define the agent's expertise, behavior, and guidelines`;

      const res = await fetch(`${CORTEX_API_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: state.config?.model || "anthropic/claude-sonnet-4",
          messages: [
            { role: "system", content: systemPrompt },
            // User message is just the description - no "Create an agent with..." prefix
            { role: "user", content: aiPrompt() }
          ],
          tools: [{
            type: "function",
            function: AGENT_GENERATION_FUNCTION
          }],
          tool_choice: { type: "function", function: { name: "generate_agent_config" } }
        }),
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to generate agent");
      }
      
      const data = await res.json();
      
      // Extract the function call result
      const choice = data.choices?.[0];
      const toolCall = choice?.message?.tool_calls?.[0];
      
      if (!toolCall || toolCall.function?.name !== "generate_agent_config") {
        throw new Error("AI did not return a valid agent configuration");
      }
      
      // Parse the function arguments
      const agentConfig = JSON.parse(toolCall.function.arguments);
      
      // Validate tools - filter to only valid tools
      const validTools = (agentConfig.tools || []).filter((t: string) => 
        AVAILABLE_TOOLS.some(at => at.id === t)
      );
      
      // Create the agent definition
      const agent: AgentDefinition = {
        name: agentConfig.name || "",
        description: agentConfig.description || "",
        tools: validTools,
        model: agentConfig.model || "inherit",
        permissionMode: "default",
        prompt: agentConfig.prompt || "",
        scope: formScope(),
      };
      
      // Validate required fields
      if (!agent.name || !agent.description || !agent.prompt) {
        // Fill form and let user complete
        setFormName(agent.name);
        setFormDescription(agent.description);
        setFormPrompt(agent.prompt);
        setFormTools(validTools);
        setFormModel(agent.model);
        setFormPermission("default");
        setMode("create");
        return;
      }
      
      // Auto-save the agent
      try {
        const saveRes = await fetch(`${state.serverUrl}/api/v1/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(agent),
        });
        
        if (saveRes.ok) {
          // Refresh agents list and go back to list view
          await fetchAgents();
          setMode("list");
          resetForm();
        } else {
          // Save failed - show form for manual review
          setFormName(agent.name);
          setFormDescription(agent.description);
          setFormPrompt(agent.prompt);
          setFormTools(validTools);
          setFormModel(agent.model);
          setFormPermission("default");
          setMode("create");
          setAiError("Agent generated but failed to save. Please review and save manually.");
        }
      } catch (saveError) {
        // Network error - show form for manual save
        setFormName(agent.name);
        setFormDescription(agent.description);
        setFormPrompt(agent.prompt);
        setFormTools(validTools);
        setFormModel(agent.model);
        setFormPermission("default");
        setMode("create");
        console.error("Failed to save agent:", saveError);
      }
    } catch (e) {
      console.error("AI generation error:", e);
      setAiError(e instanceof Error ? e.message : "Failed to generate agent");
    } finally {
      setGenerating(false);
    }
  };

  const startEdit = (agent: AgentDefinition) => {
    setFormName(agent.name);
    setFormDescription(agent.description);
    setFormTools([...agent.tools]);
    setFormModel(agent.model || "inherit");
    setFormPermission(agent.permissionMode || "default");
    setFormPrompt(agent.prompt);
    setFormScope(agent.scope);
    setMode("edit");
  };

  const saveAgent = async () => {
    const agent: AgentDefinition = {
      name: formName(),
      description: formDescription(),
      tools: formTools(),
      model: formModel(),
      permissionMode: formPermission(),
      prompt: formPrompt(),
      scope: formScope(),
    };

    try {
      const res = await fetch(`${state.serverUrl}/api/v1/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agent),
      });
      
      if (res.ok) {
        await fetchAgents();
        setMode("list");
        resetForm();
      }
    } catch (e) {
      console.error("Failed to save agent:", e);
      // Save locally as markdown
      saveAgentLocally(agent);
    }
  };

  const saveAgentLocally = (agent: AgentDefinition) => {
    const markdown = generateMarkdown(agent);
    // Would need Tauri to write to file
    if (import.meta.env.DEV) console.log("Agent markdown:", markdown);
    setMode("list");
    resetForm();
  };

  const generateMarkdown = (agent: AgentDefinition): string => {
    let md = "---\n";
    md += `name: ${agent.name}\n`;
    md += `description: ${agent.description}\n`;
    if (agent.tools.length > 0) {
      md += `tools: ${agent.tools.join(", ")}\n`;
    }
    if (agent.model !== "inherit") {
      md += `model: ${agent.model}\n`;
    }
    if (agent.permissionMode !== "default") {
      md += `permissionMode: ${agent.permissionMode}\n`;
    }
    md += "---\n\n";
    md += agent.prompt;
    return md;
  };

  const deleteAgent = async (agent: AgentDefinition) => {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    
    try {
      const res = await fetch(`${state.serverUrl}/api/v1/agents/${agent.name}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchAgents();
      }
    } catch (e) {
      console.error("Failed to delete agent:", e);
    }
  };

  const toggleTool = (toolId: string) => {
    const current = formTools();
    if (current.includes(toolId)) {
      setFormTools(current.filter(t => t !== toolId));
    } else {
      setFormTools([...current, toolId]);
    }
  };

  const selectAllTools = () => {
    setFormTools(AVAILABLE_TOOLS.map(t => t.id));
  };

  const clearAllTools = () => {
    setFormTools([]);
  };

  createEffect(() => {
    if (props.visible) {
      fetchAgents();
    }
  });

  return (
    <Show when={props.visible}>
      <div 
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
      >
      <div 
        class="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-lg border flex flex-col"
        style={{ 
          background: "var(--surface-base)",
          "border-color": "var(--border-base)"
        }}
      >
        {/* Header */}
        <div 
          class="px-4 py-3 border-b flex items-center justify-between shrink-0"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
              {mode() === "list" ? "Agents" : mode() === "ai" ? "Generate Agent with AI" : mode() === "create" ? "Create Agent" : "Edit Agent"}
            </span>
          </div>
          <button
            onClick={props.onClose}
            class="p-1 rounded hover:bg-[var(--surface-raised)] transition-colors"
            style={{ color: "var(--text-weak)" }}
          >
            <Icon name="xmark" size={16} />
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-4">
          <Show when={mode() === "list"}>
            {/* Create buttons */}
            <div class="flex gap-2 mb-4">
              <button
                onClick={startAICreate}
                class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border transition-colors hover:bg-[var(--surface-raised)]"
                style={{ 
                  "border-color": "var(--border-base)",
                  color: "var(--text-base)"
                }}
              >
                <Icon name="bolt" size={16} />
                <span class="text-sm">Generate with AI</span>
              </button>
              <button
                onClick={startCreate}
                class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border transition-colors hover:bg-[var(--surface-raised)]"
                style={{ 
                  "border-color": "var(--border-weak)",
                  color: "var(--text-weak)"
                }}
              >
                <Icon name="plus" size={16} />
                <span class="text-sm">Create Manually</span>
              </button>
            </div>

            {/* Agents list */}
            <Show when={loading()}>
              <div class="text-center py-8 text-sm" style={{ color: "var(--text-weaker)" }}>
                Loading agents...
              </div>
            </Show>

            <Show when={!loading() && agents().length === 0}>
              <div class="text-center py-8">
                <p class="text-sm mb-2" style={{ color: "var(--text-weak)" }}>
                  No agents defined yet.
                </p>
                <p class="text-xs" style={{ color: "var(--text-weaker)" }}>
                  Create an agent to extend Cortex's capabilities.
                </p>
              </div>
            </Show>

            <div class="space-y-2">
              <For each={agents()}>
                {(agent) => (
                  <div 
                    class="group px-3 py-2 rounded border transition-colors hover:bg-[var(--surface-raised)]"
                    style={{ "border-color": "var(--border-weak)" }}
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                            {agent.name}
                          </span>
                          <span 
                            class="text-xs px-1.5 py-0.5 rounded"
                            style={{ 
                              background: "var(--surface-raised)",
                              color: "var(--text-weaker)"
                            }}
                          >
                            {agent.scope === "project" ? "Project" : "User"}
                          </span>
                        </div>
                        <p class="text-xs mt-1 truncate" style={{ color: "var(--text-weak)" }}>
                          {agent.description}
                        </p>
                      </div>
                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(agent)}
                          class="p-1.5 rounded hover:bg-[var(--surface-stronger)] transition-colors"
                          style={{ color: "var(--text-weak)" }}
                        >
                          <Icon name="pen" size={14} />
                        </button>
                        <button
                          onClick={() => deleteAgent(agent)}
                          class="p-1.5 rounded hover:bg-[var(--surface-stronger)] transition-colors"
                          style={{ color: "var(--text-weak)" }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* AI Generation Mode */}
          <Show when={mode() === "ai"}>
            <div class="space-y-4">
              <div class="text-center mb-6">
                <Icon name="bolt" size={32} style={{ color: "var(--text-weak)" }} class="mx-auto mb-2" />
                <p class="text-sm" style={{ color: "var(--text-base)" }}>
                  Describe the agent you want to create
                </p>
                <p class="text-xs mt-1" style={{ color: "var(--text-weaker)" }}>
                  AI will generate name, description, system prompt, and recommended tools
                </p>
              </div>

              {/* Scope selection */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Scope
                </label>
                <div class="flex gap-2">
                  <button
                    onClick={() => setFormScope("project")}
                    class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border text-xs transition-colors"
                    style={{ 
                      "border-color": formScope() === "project" ? "var(--text-weak)" : "var(--border-weak)",
                      background: formScope() === "project" ? "var(--surface-raised)" : "transparent",
                      color: "var(--text-base)"
                    }}
                  >
                    <Icon name="folder" size={14} />
                    Project
                  </button>
                  <button
                    onClick={() => setFormScope("user")}
                    class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border text-xs transition-colors"
                    style={{ 
                      "border-color": formScope() === "user" ? "var(--text-weak)" : "var(--border-weak)",
                      background: formScope() === "user" ? "var(--surface-raised)" : "transparent",
                      color: "var(--text-base)"
                    }}
                  >
                    <Icon name="user" size={14} />
                    User (Global)
                  </button>
                </div>
              </div>

              {/* AI Prompt */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Describe your agent
                </label>
                <textarea
                  value={aiPrompt()}
                  onInput={(e) => setAiPrompt(e.currentTarget.value)}
                  placeholder="Example: A code reviewer that checks for security vulnerabilities, best practices, and suggests improvements. Should be thorough but concise."
                  rows={4}
                  class="w-full px-3 py-2 rounded border text-sm resize-none"
                  style={{ 
                    background: "var(--background-base)",
                    "border-color": "var(--border-base)",
                    color: "var(--text-base)"
                  }}
                  disabled={generating()}
                />
              </div>

              {/* Error message */}
              <Show when={aiError()}>
                <div 
                  class="px-3 py-2 rounded text-xs"
                  style={{ 
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "var(--cortex-error)"
                  }}
                >
                  {aiError()}
                </div>
              </Show>

              {/* Generate buttons */}
              <div class="flex gap-2">
                {/* Auto-generate and save button - primary action */}
                <button
                  onClick={generateAndSaveWithAI}
                  disabled={!aiPrompt().trim() || generating()}
                  class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded transition-colors"
                  style={{ 
                    background: aiPrompt().trim() && !generating() ? "var(--surface-raised)" : "var(--surface-base)",
                    color: aiPrompt().trim() && !generating() ? "var(--text-base)" : "var(--text-weaker)",
                    "border": "1px solid var(--border-base)"
                  }}
                >
                  <Show when={generating()} fallback={<Icon name="bolt" size={16} />}>
                    <Icon name="spinner" size={16} class="animate-spin" />
                  </Show>
                  <span class="text-sm">
                    {generating() ? "Creating Agent..." : "Create Agent"}
                  </span>
                </button>
                
                {/* Review before save button */}
                <button
                  onClick={generateWithAI}
                  disabled={!aiPrompt().trim() || generating()}
                  class="flex items-center justify-center gap-2 px-3 py-3 rounded transition-colors"
                  style={{ 
                    background: "transparent",
                    color: aiPrompt().trim() && !generating() ? "var(--text-weak)" : "var(--text-weaker)",
                    "border": "1px solid var(--border-weak)"
                  }}
                  title="Review the generated agent before saving"
                >
                  <Icon name="pen" size={14} />
                  <span class="text-xs">Review</span>
                </button>
              </div>

              <p class="text-xs text-center" style={{ color: "var(--text-weaker)" }}>
                Agent will be created automatically. Use "Review" to edit before saving.
              </p>
            </div>
          </Show>

          {/* Create/Edit Form */}
          <Show when={mode() === "create" || mode() === "edit"}>
            <div class="space-y-4">
              {/* Scope */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Scope
                </label>
                <div class="flex gap-2">
                  <button
                    onClick={() => setFormScope("project")}
                    class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border text-xs transition-colors"
                    style={{ 
                      "border-color": formScope() === "project" ? "var(--text-weak)" : "var(--border-weak)",
                      background: formScope() === "project" ? "var(--surface-raised)" : "transparent",
                      color: "var(--text-base)"
                    }}
                  >
                    <Icon name="folder" size={14} />
                    Project (.cortex/agents/)
                  </button>
                  <button
                    onClick={() => setFormScope("user")}
                    class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border text-xs transition-colors"
                    style={{ 
                      "border-color": formScope() === "user" ? "var(--text-weak)" : "var(--border-weak)",
                      background: formScope() === "user" ? "var(--surface-raised)" : "transparent",
                      color: "var(--text-base)"
                    }}
                  >
                    <Icon name="user" size={14} />
                    User (~/.cortex/agents/)
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Name (lowercase, hyphens only)
                </label>
                <input
                  type="text"
                  value={formName()}
                  onInput={(e) => setFormName(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="code-reviewer"
                  class="w-full px-3 py-2 rounded border text-sm"
                  style={{ 
                    background: "var(--background-base)",
                    "border-color": "var(--border-base)",
                    color: "var(--text-base)"
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Description (when to use this agent)
                </label>
                <input
                  type="text"
                  value={formDescription()}
                  onInput={(e) => setFormDescription(e.currentTarget.value)}
                  placeholder="Expert code reviewer. Use proactively after code changes."
                  class="w-full px-3 py-2 rounded border text-sm"
                  style={{ 
                    background: "var(--background-base)",
                    "border-color": "var(--border-base)",
                    color: "var(--text-base)"
                  }}
                />
              </div>

              {/* Tools */}
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs" style={{ color: "var(--text-weak)" }}>
                    Tools (leave empty to inherit all)
                  </label>
                  <div class="flex gap-2">
                    <button
                      onClick={selectAllTools}
                      class="text-xs px-2 py-0.5 rounded hover:bg-[var(--surface-raised)]"
                      style={{ color: "var(--text-weaker)" }}
                    >
                      all
                    </button>
                    <button
                      onClick={clearAllTools}
                      class="text-xs px-2 py-0.5 rounded hover:bg-[var(--surface-raised)]"
                      style={{ color: "var(--text-weaker)" }}
                    >
                      none
                    </button>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-1">
                  <For each={AVAILABLE_TOOLS}>
                    {(tool) => (
                      <button
                        onClick={() => toggleTool(tool.id)}
                        class="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors"
                        style={{ 
                          background: formTools().includes(tool.id) ? "var(--surface-raised)" : "transparent",
                          color: "var(--text-base)"
                        }}
                      >
                        <span style={{ color: formTools().includes(tool.id) ? "var(--text-base)" : "var(--text-weaker)" }}>
                          {formTools().includes(tool.id) ? "[x]" : "[ ]"}
                        </span>
                        {tool.id}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Model */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  Model
                </label>
                <select
                  value={formModel()}
                  onChange={(e) => setFormModel(e.currentTarget.value)}
                  class="w-full px-3 py-2 rounded border text-sm"
                  style={{ 
                    background: "var(--background-base)",
                    "border-color": "var(--border-base)",
                    color: "var(--text-base)"
                  }}
                >
                  <For each={MODELS}>
                    {(model) => (
                      <option value={model.id}>{model.label}</option>
                    )}
                  </For>
                </select>
              </div>

              {/* Prompt */}
              <div>
                <label class="block text-xs mb-1" style={{ color: "var(--text-weak)" }}>
                  System Prompt
                </label>
                <textarea
                  value={formPrompt()}
                  onInput={(e) => setFormPrompt(e.currentTarget.value)}
                  placeholder="You are an expert code reviewer..."
                  rows={6}
                  class="w-full px-3 py-2 rounded border text-sm resize-none"
                  style={{ 
                    background: "var(--background-base)",
                    "border-color": "var(--border-base)",
                    color: "var(--text-base)"
                  }}
                />
              </div>
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div 
          class="px-4 py-3 border-t flex justify-end gap-2 shrink-0"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <Show when={mode() === "list"}>
            <button
              onClick={props.onClose}
              class="px-3 py-1.5 text-sm rounded transition-colors"
              style={{ color: "var(--text-weak)" }}
            >
              Close
            </button>
          </Show>

          <Show when={mode() === "ai"}>
            <button
              onClick={() => { setMode("list"); resetForm(); }}
              class="px-3 py-1.5 text-sm rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
            >
              Cancel
            </button>
          </Show>

          <Show when={mode() === "create" || mode() === "edit"}>
            <button
              onClick={() => { setMode("list"); resetForm(); }}
              class="px-3 py-1.5 text-sm rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
            >
              Cancel
            </button>
            <button
              onClick={saveAgent}
              disabled={!formName() || !formDescription()}
              class="px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5"
              style={{ 
                background: "var(--surface-raised)",
                color: formName() && formDescription() ? "var(--text-base)" : "var(--text-weaker)"
              }}
            >
              <Icon name="check" size={14} />
              {mode() === "create" ? "Create" : "Save"}
            </button>
          </Show>
        </div>
      </div>
      </div>
    </Show>
  );
}


import { createSignal, Show, For, onMount, createEffect } from "solid-js";
import { Icon } from "./ui/Icon";
import { useSDK } from "@/context/SDKContext";
import { usePlan } from "@/context/PlanContext";
import { Card, Button, Text, ListItem } from "@/components/ui";

// Available models
const MODELS = [
  { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5", provider: "anthropic" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic" },
  { id: "anthropic/claude-opus-4", name: "Claude Opus 4", provider: "anthropic" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai" },
  { id: "openai/o1-preview", name: "o1 Preview", provider: "openai" },
  { id: "openai/o1-mini", name: "o1 Mini", provider: "openai" },
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash", provider: "google" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", provider: "deepseek" },
  { id: "z-ai/glm-4.6:nitro", name: "GLM-4.6 Nitro", provider: "z-ai" },
];

// Available slash commands
const COMMANDS = [
  { 
    name: "plan", 
    description: "Create a comprehensive plan with expert analyses",
    icon: "map",
    action: "plan"
  },
  { 
    name: "code", 
    description: "Write code to implement a feature",
    icon: "code",
    prefix: "Please implement: "
  },
  { 
    name: "search", 
    description: "Search the codebase",
    icon: "magnifying-glass",
    prefix: "Search the codebase for: "
  },
  {
    name: "subagents",
    description: "Manage and spawn sub-agents for specialized tasks",
    icon: "users",
    action: "subagents"
  },
  {
    name: "fork",
    description: "Fork the conversation from this point",
    icon: "code-branch",
    action: "fork"
  },
  {
    name: "skill",
    description: "Load a skill for specialized guidance",
    icon: "book-open",
    action: "skill"
  },
  {
    name: "file",
    description: "Include a file in context",
    icon: "file-lines",
    action: "file"
  },
  {
    name: "models",
    description: "Select a different model",
    icon: "microchip",
    action: "models"
  },
  {
    name: "help",
    description: "Show available commands",
    icon: "circle-question",
    action: "help"
  },
  { 
    name: "clear", 
    description: "Clear current conversation",
    icon: "trash",
    action: "clear"
  },
  { 
    name: "reset", 
    description: "Reset session and start fresh",
    icon: "rotate",
    action: "reset"
  },
];

export function PromptInput() {
  const { state, sendMessage, interrupt, destroySession, createSession, updateConfig } = useSDK();
  const { startDiscovery } = usePlan();
  const [input, setInput] = createSignal("");
  const [showCommands, setShowCommands] = createSignal(false);
  const [showModels, setShowModels] = createSignal(false);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [modelSelectedIndex, setModelSelectedIndex] = createSignal(0);
  const [commandFilter, setCommandFilter] = createSignal("");
  let textareaRef: HTMLTextAreaElement | undefined;

  onMount(() => {
    textareaRef?.focus();
  });

  // Filter commands based on input
  const filteredCommands = () => {
    const filter = commandFilter().toLowerCase();
    if (!filter) return COMMANDS;
    return COMMANDS.filter(cmd => 
      cmd.name.toLowerCase().includes(filter) || 
      cmd.description.toLowerCase().includes(filter)
    );
  };

  // Reset selection when filter changes
  createEffect(() => {
    filteredCommands();
    setSelectedIndex(0);
  });

  const executeCommand = async (cmd: typeof COMMANDS[0], args: string = "") => {
    setShowCommands(false);
    setCommandFilter("");
    setInput("");
    
    if (cmd.action === "clear") {
      // Clear messages in current session
      return;
    }
    
    if (cmd.action === "reset") {
      await destroySession();
      await createSession();
      return;
    }

    if (cmd.action === "models") {
      // Find current model index
      const currentIdx = MODELS.findIndex(m => m.id === state.config.model);
      setModelSelectedIndex(currentIdx >= 0 ? currentIdx : 0);
      setShowModels(true);
      return;
    }

    if (cmd.action === "plan") {
      // Start discovery phase for comprehensive planning
      if (args.trim()) {
        await startDiscovery(args.trim());
      }
      return;
    }

    if (cmd.action === "subagents") {
      // Open subagents dialog
      window.dispatchEvent(new CustomEvent("ai:subagents", { detail: { action: "list" } }));
      return;
    }

    if (cmd.action === "fork") {
      // Fork conversation
      window.dispatchEvent(new CustomEvent("ai:fork"));
      return;
    }

    if (cmd.action === "skill") {
      // Open skill selector
      window.dispatchEvent(new CustomEvent("ai:skill", { detail: { name: args.trim() } }));
      return;
    }

    if (cmd.action === "file") {
      // Open file selector
      window.dispatchEvent(new CustomEvent("ai:file"));
      return;
    }

    if (cmd.action === "help") {
      // Show help
      const helpText = COMMANDS.map(c => `/${c.name} - ${c.description}`).join("\n");
      if (import.meta.env.DEV) console.log("Available commands:\n" + helpText);
      return;
    }
    
    if (cmd.prefix) {
      const message = cmd.prefix + args;
      await sendMessage(message);
    }
    
    if (textareaRef) {
      textareaRef.style.height = "auto";
    }
  };

  const selectModel = (modelId: string) => {
    updateConfig({ model: modelId });
    setShowModels(false);
    textareaRef?.focus();
  };

  const handleSubmit = async (e?: Event) => {
    e?.preventDefault();
    const text = input().trim();
    
    if (state.isStreaming) {
      interrupt();
      return;
    }
    
    // Handle command submission
    if (showCommands() && filteredCommands().length > 0) {
      const cmd = filteredCommands()[selectedIndex()];
      const args = text.replace(/^\/\S*\s*/, ""); // Remove /command from input
      await executeCommand(cmd, args);
      return;
    }
    
    // Check if input is a command
    if (text.startsWith("/")) {
      const parts = text.slice(1).split(/\s+/);
      const cmdName = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");
      const cmd = COMMANDS.find(c => c.name === cmdName);
      if (cmd) {
        await executeCommand(cmd, args);
        return;
      }
    }
    
    if (!text) return;

    await sendMessage(text);
    setInput("");
    
    if (textareaRef) {
      textareaRef.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Models menu navigation
    if (showModels()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setModelSelectedIndex(i => Math.min(i + 1, MODELS.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setModelSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectModel(MODELS[modelSelectedIndex()].id);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowModels(false);
        return;
      }
      return;
    }

    // Command menu navigation
    if (showCommands()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands().length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const cmd = filteredCommands()[selectedIndex()];
        if (cmd) {
          setInput("/" + cmd.name + " ");
          setShowCommands(false);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }
    
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape" && state.isStreaming) {
      interrupt();
    }
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    setInput(value);
    target.style.height = "auto";
    target.style.height = Math.min(target.scrollHeight, 200) + "px";
    
    // Check for slash command
    if (value.startsWith("/")) {
      const match = value.match(/^\/(\S*)$/);
      if (match) {
        setCommandFilter(match[1]);
        setShowCommands(true);
      } else if (value.match(/^\/\S+\s/)) {
        // User typed space after command, hide menu
        setShowCommands(false);
      }
    } else {
      setShowCommands(false);
      setCommandFilter("");
    }
  };

  const selectCommand = (cmd: typeof COMMANDS[0]) => {
    setInput("/" + cmd.name + " ");
    setShowCommands(false);
    textareaRef?.focus();
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Command autocomplete menu */}
      <Show when={showCommands() && filteredCommands().length > 0}>
        <Card 
          variant="elevated"
          padding="none"
          style={{ 
            position: "absolute",
            bottom: "100%",
            left: "0",
            right: "0",
            "margin-bottom": "8px",
            overflow: "hidden",
            "z-index": "50",
          }}
        >
          <div style={{ padding: "4px" }}>
            <For each={filteredCommands()}>
              {(cmd, index) => (
                <ListItem
                  onClick={() => selectCommand(cmd)}
                  selected={index() === selectedIndex()}
                  icon={<Icon name={cmd.icon} size={16} />}
                  label={`/${cmd.name}`}
                  description={cmd.description}
                />
              )}
            </For>
          </div>
          <div 
            style={{ 
              padding: "6px 12px",
              "font-size": "var(--jb-text-muted-size)",
              "border-top": "1px solid var(--jb-border-divider)",
              color: "var(--jb-text-muted-color)",
            }}
          >
            <span style={{ "margin-right": "12px" }}>↑↓ navigate</span>
            <span style={{ "margin-right": "12px" }}>Tab complete</span>
            <span>Enter select</span>
          </div>
        </Card>
      </Show>

      {/* Models selector popup */}
      <Show when={showModels()}>
        <Card 
          variant="elevated"
          padding="none"
          style={{ 
            position: "absolute",
            bottom: "100%",
            left: "0",
            right: "0",
            "margin-bottom": "8px",
            overflow: "hidden",
            "z-index": "50",
          }}
        >
          <div 
            style={{ 
              padding: "8px 12px",
              "border-bottom": "1px solid var(--jb-border-divider)",
              "font-size": "var(--jb-text-body-size)",
              "font-weight": "500",
              color: "var(--jb-text-body-color)",
            }}
          >
            Select Model
          </div>
          <div style={{ padding: "4px", "max-height": "256px", "overflow-y": "auto" }}>
            <For each={MODELS}>
              {(model, index) => (
                <ListItem
                  onClick={() => selectModel(model.id)}
                  selected={index() === modelSelectedIndex()}
                  icon={<Icon name="microchip" size={16} />}
                  label={model.name}
                  badge={model.provider}
                  iconRight={model.id === state.config.model ? (
                    <Icon name="check" size={16} style={{ color: "var(--jb-border-focus)" }} />
                  ) : undefined}
                />
              )}
            </For>
          </div>
          <div 
            style={{ 
              padding: "6px 12px",
              "font-size": "var(--jb-text-muted-size)",
              "border-top": "1px solid var(--jb-border-divider)",
              color: "var(--jb-text-muted-color)",
            }}
          >
            <span style={{ "margin-right": "12px" }}>↑↓ navigate</span>
            <span style={{ "margin-right": "12px" }}>Enter select</span>
            <span>Esc close</span>
          </div>
        </Card>
        {/* Backdrop to close */}
        <div 
          style={{ position: "fixed", inset: "0", "z-index": "-1" }}
          onClick={() => setShowModels(false)}
        />
      </Show>
      
      <Card 
        variant="outlined"
        padding="none"
        style={{ 
          overflow: "hidden",
        }}
      >
        <textarea
          ref={textareaRef}
          value={input()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Message Cortex... (type / for commands)"
          rows={1}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "transparent",
            color: "var(--jb-text-body-color)",
            "min-height": "48px",
            "max-height": "200px",
            "line-height": "1.5",
            "font-size": "var(--jb-text-body-size)",
            "font-family": "var(--jb-font-ui)",
            border: "none",
            outline: "none",
            resize: "none",
          }}
        />
        
        <div 
          style={{ 
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "10px 12px",
            "border-top": "1px solid var(--jb-border-divider)",
            background: "var(--jb-surface-hover)",
          }}
        >
          {/* Model selector button */}
          <Button
            onClick={() => {
              const currentIdx = MODELS.findIndex(m => m.id === state.config.model);
              setModelSelectedIndex(currentIdx >= 0 ? currentIdx : 0);
              setShowModels(true);
            }}
            variant="ghost"
            size="sm"
            icon={<Icon name="microchip" size={12} />}
            style={{ 
              "font-family": "var(--jb-font-mono)",
            }}
          >
            {state.config.model?.split("/").pop() || "claude"}
          </Button>
          
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            {/* Working indicator */}
            <Show when={state.isStreaming}>
              <div style={{ display: "flex", "align-items": "center", gap: "6px", padding: "4px 8px" }}>
                <span 
                  style={{ 
                    width: "6px", 
                    height: "6px", 
                    "border-radius": "var(--cortex-radius-full)",
                    background: "var(--jb-border-focus)",
                    animation: "pulse 2s infinite",
                  }}
                />
                <Text variant="muted" size="xs">working</Text>
              </div>
            </Show>
            
            {/* Send/Stop button */}
            <Button
              onClick={handleSubmit}
              disabled={!input().trim() && !state.isStreaming}
              variant={state.isStreaming ? "danger" : "primary"}
              size="sm"
              icon={state.isStreaming 
                ? <Icon name="stop" size={14} />
                : <Icon name="arrow-turn-down-left" size={14} />
              }
              style={{
                opacity: (!input().trim() && !state.isStreaming) ? "0.5" : "1",
              }}
            >
              {state.isStreaming ? "Stop" : "Send"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Keyboard hints */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "center", gap: "16px", "margin-top": "8px" }}>
        <Text variant="muted" size="xs">
          <kbd style={{ 
            padding: "2px 6px", 
            "border-radius": "var(--jb-radius-sm)", 
            "font-size": "var(--jb-text-muted-size)", 
            "font-family": "var(--jb-font-mono)",
            background: "var(--jb-surface-hover)", 
            border: "1px solid var(--jb-border-default)" 
          }}>Enter</kbd>
          {" "}to send
        </Text>
        <Text variant="muted" size="xs">
          <kbd style={{ 
            padding: "2px 6px", 
            "border-radius": "var(--jb-radius-sm)", 
            "font-size": "var(--jb-text-muted-size)", 
            "font-family": "var(--jb-font-mono)",
            background: "var(--jb-surface-hover)", 
            border: "1px solid var(--jb-border-default)" 
          }}>Shift+Enter</kbd>
          {" "}for new line
        </Text>
      </div>
    </div>
  );
}


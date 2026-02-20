import { Show, For, createSignal } from "solid-js";
import { ToolCall, useSDK } from "@/context/SDKContext";
import { Icon } from "../ui/Icon";
import { PlanCard } from "./PlanCard";
import { QuestionsCard } from "./QuestionsCard";
import { DesignSystemCard } from "./DesignSystemCard";
import { useTerminals } from "@/context/TerminalsContext";
import { Card, Text } from "@/components/ui";
import {
  extractQuestionsData,
  extractPlanData,
} from "@/types/toolInputs";

interface ToolCardProps {
  tool: ToolCall;
  defaultExpanded?: boolean;
}

// Tool display names
const TOOL_NAMES: Record<string, string> = {
  "Execute": "shell",
  "Read": "read",
  "Create": "create",
  "Edit": "edit",
  "LS": "ls",
  "Grep": "grep",
  "Glob": "glob",
  "FetchUrl": "fetch",
  "WebSearch": "search",
  "TodoWrite": "todo",
  "TodoRead": "todo",
  "Plan": "plan",
  "Questions": "questions",
  "CreateTerminal": "terminal",
  "RunInTerminal": "terminal",
  "GetTerminalLogs": "terminal",
  "ListTerminals": "terminal",
  "KillTerminal": "terminal",
  "DesignSystem": "design",
};

export function ToolCard(props: ToolCardProps) {
  const name = () => TOOL_NAMES[props.tool.name] || props.tool.name.toLowerCase();
  
  // Only show cards for Todo, Edit, Plan, Create, Questions, CreateTerminal, and DesignSystem
  const isCardType = () => 
    props.tool.name === "TodoWrite" || 
    props.tool.name === "Edit" || 
    props.tool.name === "Plan" ||
    props.tool.name === "Create" ||
    props.tool.name === "Questions" ||
    props.tool.name === "CreateTerminal" ||
    props.tool.name === "DesignSystem";
  
  // Inline display for other tools
  if (!isCardType()) {
    return <InlineTool tool={props.tool} name={name()} />;
  }
  
  // Card display for specific tools
  if (props.tool.name === "TodoWrite") {
    return <TodoCard tool={props.tool} />;
  }
  
  if (props.tool.name === "Plan") {
    return <PlanCardWrapper tool={props.tool} />;
  }
  
  if (props.tool.name === "Create") {
    return <CreateCard tool={props.tool} />;
  }
  
  if (props.tool.name === "Questions") {
    return <QuestionsCardWrapper tool={props.tool} />;
  }
  
  if (props.tool.name === "CreateTerminal") {
    return <TerminalCreatedCard tool={props.tool} />;
  }
  
  if (props.tool.name === "DesignSystem") {
    return <DesignSystemCard tool={props.tool} />;
  }
  
  return <EditCard tool={props.tool} />;
}

/** Plan data structure for rendering */
interface LocalPlanData {
  type: "plan";
  title: string;
  description: string;
  architecture?: string;
  tech_stack?: string[];
  tasks: Array<{ id?: string; title: string; description?: string; status?: string }>;
  use_cases?: string[];
  agent_analyses?: string[];
  risks?: string[];
  files_to_modify: string[];
  success_criteria?: string[];
  timeline?: string;
  estimated_changes: string;
  status: string;
}

/** Questions data structure for rendering */
interface LocalQuestionsData {
  type: "questions";
  title: string;
  description: string;
  questions: Array<{ id?: string; text: string; type?: string; options?: string[] }>;
  status: string;
}

// Wrapper for PlanCard that handles approve/reject
function PlanCardWrapper(props: { tool: ToolCall }) {
  const { sendMessage } = useSDK();
  
  // Parse plan data from tool output or input
  const getPlanData = (): LocalPlanData => {
    if (import.meta.env.DEV) {
      console.log("[PlanCard] Getting plan data from tool:", props.tool);
      console.log("[PlanCard] Tool input:", props.tool.input);
      console.log("[PlanCard] Tool output:", props.tool.output);
    }
    try {
      // Try to parse from output first (if tool completed)
      if (props.tool.output) {
        const parsed = JSON.parse(props.tool.output);
        if (import.meta.env.DEV) console.log("[PlanCard] Parsed output:", parsed);
        if (parsed.type === "plan") return parsed as LocalPlanData;
      }
      // Fall back to input (which has the arguments from tool_call_begin)
      const input = extractPlanData(props.tool.input);
      if (import.meta.env.DEV) console.log("[PlanCard] Using input as fallback:", input);
      return {
        type: "plan",
        title: input.title || "Implementation Plan",
        description: input.description || "",
        architecture: input.architecture || "",
        tech_stack: input.tech_stack || [],
        tasks: input.tasks || [],
        use_cases: input.use_cases || [],
        agent_analyses: input.agent_analyses || [],
        risks: input.risks || [],
        files_to_modify: input.files_to_modify || [],
        success_criteria: input.success_criteria || [],
        timeline: input.timeline || "",
        estimated_changes: input.estimated_changes || "",
        status: "pending_approval"
      };
    } catch (e) {
      console.error("[PlanCard] Error parsing plan data:", e);
      return {
        type: "plan",
        title: "Implementation Plan",
        description: String(props.tool.output || ""),
        tasks: [],
        files_to_modify: [],
        estimated_changes: "",
        status: "pending_approval"
      };
    }
  };

  const handleApprove = async (plan: LocalPlanData) => {
    // Send approval message to continue with implementation
    await sendMessage(`I approve the plan "${plan.title}". Please proceed with the implementation.`);
  };

  const handleReject = async () => {
    await sendMessage("I reject this plan. Please suggest a different approach.");
  };

  return (
    <PlanCard 
      data={getPlanData() as unknown as Parameters<typeof PlanCard>[0]['data']} 
      onApprove={handleApprove as unknown as Parameters<typeof PlanCard>[0]['onApprove']}
      onReject={handleReject}
    />
  );
}

// Wrapper for QuestionsCard
function QuestionsCardWrapper(props: { tool: ToolCall }) {
  // Parse questions data from tool output or input
  const getQuestionsData = (): LocalQuestionsData => {
    try {
      // Try to parse from output first (if tool completed)
      if (props.tool.output) {
        const parsed = JSON.parse(props.tool.output);
        if (parsed.type === "questions") return parsed as LocalQuestionsData;
      }
      // Fall back to input
      const input = extractQuestionsData(props.tool.input);
      return {
        type: "questions",
        title: input.title || "Questions",
        description: input.description || "",
        questions: input.questions || [],
        status: "pending_answers"
      };
    } catch {
      const input = extractQuestionsData(props.tool.input);
      return {
        type: "questions",
        title: input.title || "Questions",
        description: input.description || "",
        questions: input.questions || [],
        status: "pending_answers"
      };
    }
  };

  return <QuestionsCard data={getQuestionsData() as unknown as Parameters<typeof QuestionsCard>[0]['data']} />;
}

// Minimal inline tool display
function InlineTool(props: { tool: ToolCall; name: string }) {
  const [expanded, setExpanded] = createSignal(false);
  
  const summary = (): string => {
    const input = props.tool.input || {};
    switch (props.tool.name) {
      case "Execute":
        const cmd = input.command;
        if (typeof cmd === "string") return cmd.length > 80 ? cmd.slice(0, 80) + "..." : cmd;
        if (Array.isArray(cmd)) {
          const full = cmd.join(" ");
          return full.length > 80 ? full.slice(0, 80) + "..." : full;
        }
        return "";
      case "Read":
      case "Create":
        return String(input.file_path || "");
      case "LS":
        return String(input.directory_path || ".");
      case "Grep":
        return `"${input.pattern}" ${input.path || "."}`;
      case "Glob":
        const patterns = input.patterns as string[];
        return patterns?.join(", ") || "";
      case "FetchUrl":
        return String(input.url || "");
      case "WebSearch":
        return String(input.query || "");
      default:
        return "";
    }
  };

  const hasOutput = () => props.tool.output && props.tool.output.length > 0;

  return (
    <div class="text-sm font-mono">
      {/* Tool line */}
      <div class="flex items-center gap-2 py-1">
        <Text variant="muted" size="sm" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>
          {props.name}
        </Text>
        <Text size="sm" style={{ color: "var(--jb-text-muted-color)", "font-family": "var(--jb-font-mono, monospace)" }}>
          {summary()}
        </Text>
        
        {/* Status */}
        <Show when={props.tool.status === "running"}>
          <Icon name="spinner" class="w-3 h-3 animate-spin" style={{ color: "var(--jb-text-muted-color)" }} />
        </Show>
        <Show when={props.tool.status === "completed"}>
          <Icon name="check" class="w-3 h-3" style={{ color: "var(--jb-text-muted-color)" }} />
        </Show>
        
        {/* Expand output */}
        <Show when={hasOutput() && props.tool.status === "completed"}>
          <button 
            onClick={() => setExpanded(!expanded())}
            class="ml-auto"
            style={{ color: "var(--jb-text-muted-color)", background: "transparent", border: "none", cursor: "pointer" }}
          >
            {expanded() ? <Icon name="chevron-down" class="w-3 h-3" /> : <Icon name="chevron-right" class="w-3 h-3" />}
          </button>
        </Show>
      </div>
      
      {/* Output */}
      <Show when={expanded() && hasOutput()}>
        <Card 
          variant="outlined" 
          padding="sm"
          class="mt-1 overflow-x-auto max-h-40 overflow-y-auto"
        >
          <pre style={{ 
            "font-size": "12px",
            "font-family": "var(--jb-font-mono, monospace)",
            color: "var(--jb-text-muted-color)",
            margin: 0,
            "white-space": "pre-wrap"
          }}>
            {props.tool.output}
          </pre>
        </Card>
      </Show>
    </div>
  );
}

// Todo card with task list
function TodoCard(props: { tool: ToolCall }) {
  const todos = () => {
    const input = props.tool.input?.todos;
    if (Array.isArray(input)) return input;
    if (typeof input === "string") {
      return input.split("\n").filter(Boolean).map((line, i) => {
        const match = line.match(/^\d+\.\s*\[(\w+)\]\s*(.+)$/);
        if (match) {
          return { id: String(i + 1), status: match[1], content: match[2] };
        }
        return { id: String(i + 1), status: "pending", content: line };
      });
    }
    return [];
  };

  return (
    <Card variant="outlined" padding="none" class="my-2">
      <div 
        class="px-3 py-2 border-b"
        style={{ 
          background: "var(--jb-surface-active)",
          "border-color": "var(--jb-border-default)",
        }}
      >
        <Text variant="muted" size="xs" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>
          todo
        </Text>
      </div>
      <div class="p-2 space-y-1">
        <For each={todos()}>
          {(todo) => (
            <div class="flex items-start gap-2 py-1">
              <Text 
                size="xs"
                style={{ 
                  "font-family": "var(--jb-font-mono, monospace)",
                  "margin-top": "2px",
                  color: todo.status === "completed" 
                    ? "var(--jb-text-muted-color)" 
                    : todo.status === "in_progress" 
                      ? "var(--jb-text-body-color)" 
                      : "var(--jb-text-muted-color)"
                }}
              >
                {todo.status === "completed" ? "[x]" : todo.status === "in_progress" ? "[~]" : "[ ]"}
              </Text>
              <Text 
                size="sm"
                style={{ 
                  color: todo.status === "completed" ? "var(--jb-text-muted-color)" : "var(--jb-text-body-color)",
                  "text-decoration": todo.status === "completed" ? "line-through" : "none"
                }}
              >
                {todo.content}
              </Text>
            </div>
          )}
        </For>
      </div>
    </Card>
  );
}

// Create card with diff view (all green)
function CreateCard(props: { tool: ToolCall }) {
  const [collapsed, setCollapsed] = createSignal(false);
  const input = () => props.tool.input || {};
  const filePath = () => String(input().file_path || "");
  const content = () => String(input().content || "");
  const lines = () => content().split("\n");
  const lineCount = () => lines().length;
  const byteCount = () => new TextEncoder().encode(content()).length;

  return (
    <Card variant="outlined" padding="none" class="my-2 overflow-hidden">
      {/* Header */}
      <div 
        class="px-3 py-2 border-b flex items-center justify-between cursor-pointer"
        style={{ 
          background: "var(--jb-surface-active)",
          "border-color": "var(--jb-border-default)",
        }}
        onClick={() => setCollapsed(!collapsed())}
      >
        <div class="flex items-center gap-2">
          <Text size="xs" style={{ color: "var(--cortex-success)", "font-family": "var(--jb-font-mono, monospace)" }}>
            create
          </Text>
          <Text variant="muted" size="xs" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>
            {filePath()}
          </Text>
        </div>
        <div class="flex items-center gap-2">
          <Text variant="muted" size="xs">
            +{lineCount()} lines, {byteCount()} bytes
          </Text>
          {collapsed() ? <Icon name="chevron-right" class="w-3 h-3" /> : <Icon name="chevron-down" class="w-3 h-3" />}
        </div>
      </div>
      
      {/* Content as diff (all additions) */}
      <Show when={!collapsed()}>
        <div class="font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
          <For each={lines()}>
            {(line, index) => (
              <div 
                class="flex whitespace-pre"
                style={{ background: "rgba(89, 168, 105, 0.1)" }}
              >
                <span 
                  class="px-2 py-0.5 text-right select-none shrink-0"
                  style={{ 
                    color: "var(--jb-text-muted-color)",
                    "min-width": "3rem",
                    background: "rgba(89, 168, 105, 0.05)"
                  }}
                >
                  {index() + 1}
                </span>
                <span 
                  class="px-1 py-0.5 select-none"
                  style={{ color: "var(--cortex-success)" }}
                >
                  +
                </span>
                <span 
                  class="py-0.5 pr-3"
                  style={{ color: "var(--cortex-success)" }}
                >
                  {line}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </Card>
  );
}

// Edit card with diff
function EditCard(props: { tool: ToolCall }) {
  const input = () => props.tool.input || {};
  const filePath = () => String(input().file_path || "");
  const oldStr = () => String(input().old_str || "");
  const newStr = () => String(input().new_str || "");

  // Generate diff lines
  const diffLines = () => {
    const oldLines = oldStr().split("\n");
    const newLines = newStr().split("\n");
    const result: { type: "remove" | "add" | "context"; content: string }[] = [];
    
    // Simple diff - show removed then added
    oldLines.forEach(line => {
      result.push({ type: "remove", content: line });
    });
    newLines.forEach(line => {
      result.push({ type: "add", content: line });
    });
    
    return result;
  };

  return (
    <Card variant="outlined" padding="none" class="my-2 overflow-hidden">
      {/* Header */}
      <div 
        class="px-3 py-2 border-b flex items-center justify-between"
        style={{ 
          background: "var(--jb-surface-active)",
          "border-color": "var(--jb-border-default)",
        }}
      >
        <Text size="xs" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>edit</Text>
        <Text variant="muted" size="xs" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>{filePath()}</Text>
      </div>
      
      {/* Diff */}
      <div class="font-mono text-xs overflow-x-auto">
        <For each={diffLines()}>
          {(line) => (
            <div 
              class="px-3 py-0.5 whitespace-pre"
              style={{ 
                background: line.type === "remove" 
                  ? "rgba(247, 84, 100, 0.15)" 
                  : line.type === "add" 
                    ? "rgba(89, 168, 105, 0.15)" 
                    : "transparent",
                color: line.type === "remove" 
                  ? "var(--cortex-error)" 
                  : line.type === "add" 
                    ? "var(--cortex-success)" 
                    : "var(--jb-text-body-color)"
              }}
            >
              <span style={{ color: line.type === "remove" ? "var(--cortex-error)" : line.type === "add" ? "var(--cortex-success)" : "var(--jb-text-muted-color)" }}>
                {line.type === "remove" ? "−" : line.type === "add" ? "+" : " "}
              </span>
              {" "}{line.content}
            </div>
          )}
        </For>
      </div>
    </Card>
  );
}

// Terminal Created Card
function TerminalCreatedCard(props: { tool: ToolCall }) {
  const { openTerminal } = useTerminals();
  
  const terminalData = () => {
    try {
      // Try to parse from metadata
      if (props.tool.metadata?.terminal_id) {
        return props.tool.metadata;
      }
      // Try to parse from output
      if (props.tool.output) {
        const match = props.tool.output.match(/ID: ([a-f0-9-]+)/);
        if (match) {
          return { terminal_id: match[1], name: "Terminal", cwd: "" };
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleClick = () => {
    const data = terminalData();
    if (data?.terminal_id) {
      openTerminal(data.terminal_id);
    }
  };

  return (
    <Card 
      variant="outlined"
      padding="none"
      hoverable
      onClick={handleClick}
      style={{ cursor: "pointer" }}
    >
      <div 
        class="flex items-center gap-2 px-3 py-2 border-b"
        style={{ "border-color": "var(--jb-border-default)" }}
      >
        <Icon name="terminal" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
        <Text variant="muted" size="xs" style={{ "font-family": "var(--jb-font-mono, monospace)" }}>
          terminal
        </Text>
        <Show when={terminalData()}>
          <Text variant="muted" size="xs">{terminalData()?.name}</Text>
        </Show>
        <Show when={props.tool.status === "running"}>
          <Icon name="spinner" class="w-3 h-3 animate-spin ml-auto" />
        </Show>
        <Show when={props.tool.status === "completed"}>
          <Icon name="check" class="w-3 h-3 ml-auto" style={{ color: "var(--cortex-success)" }} />
        </Show>
      </div>
      
      <div class="px-3 py-2">
        <Show 
          when={terminalData()}
          fallback={
            <Text variant="muted" size="sm">Creating terminal...</Text>
          }
        >
          <div class="flex items-center gap-3">
            <div 
              class="w-8 h-8 rounded flex items-center justify-center"
              style={{ background: "rgba(89, 168, 105, 0.2)" }}
            >
              <Icon name="terminal" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
            </div>
            <div class="flex-1 min-w-0">
              <Text weight="medium" size="sm" truncate style={{ display: "block" }}>
                {terminalData()?.name}
              </Text>
              <Text variant="muted" size="xs" truncate>
                {terminalData()?.cwd || "Click to view terminal"}
              </Text>
            </div>
            <div class="flex items-center gap-2">
              <span 
                class="w-2 h-2 rounded-full animate-pulse"
                style={{ background: "var(--cortex-success)" }}
              />
              <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--jb-text-muted-color)" }} />
            </div>
          </div>
        </Show>
      </div>
    </Card>
  );
}

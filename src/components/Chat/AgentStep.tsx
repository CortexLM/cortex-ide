import { createSignal, Show, createEffect, JSX } from "solid-js";
import { Icon } from "../ui/Icon";
import { AgenticToolStep } from "@/types/chat";
import { TerminalBlock } from "./TerminalBlock";
import { LSTable } from "./LSTable";
import { QuestionsCard } from "../tools/QuestionsCard";
import { PlanCard } from "../tools/PlanCard";
import { useSDK } from "@/context/SDKContext";
import { extractQuestionsData, extractPlanData } from "@/types/toolInputs";

// ============================================================================
// CSS Variable-based Color Palette
// ============================================================================
const palette = {
  canvas: "var(--surface-base)",
  panel: "var(--surface-card)",
  inputCard: "var(--surface-input)",
  border: "var(--border-default)",
  borderSubtle: "var(--border-default)",
  textTitle: "var(--text-title)",
  textBody: "var(--text-primary)",
  textMuted: "var(--text-muted)",
  accent: "var(--text-placeholder)",
  outputBg: "var(--surface-base)",
  outputText: "var(--text-secondary)",
};

// Tool status colors
const statusStyles = {
  running: { color: "var(--text-placeholder)" },
  completed: { color: "var(--state-success)" },
  error: { color: "var(--state-error)" },
};

// Tool header style
const toolHeaderStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  color: palette.textTitle,
  "font-weight": "500",
  "font-size": "13px",
};

// Tool output style
const outputStyle: JSX.CSSProperties = {
  background: palette.outputBg,
  "border-radius": "var(--cortex-radius-md)",
  padding: "8px 12px",
  "font-family": "var(--jb-font-code)",
  "font-size": "12px",
  color: palette.outputText,
  "margin-top": "8px",
  "max-height": "200px",
  overflow: "auto",
};

interface AgentStepProps {
  tool: AgenticToolStep;
  indentation?: number;
  isLatest?: boolean;
}



/** Questions data structure for rendering - matches QuestionsCard expectations */
interface QuestionsDataType {
  type: "questions";
  title: string;
  description?: string;
  questions: Array<{ 
    id: string; 
    question: string; 
    type: "single" | "multiple" | "text" | "number"; 
    options?: Array<{ value: string; label: string; selected?: boolean }>;
    required?: boolean;
  }>;
  status: "pending_answers" | "submitted";
}

/** Plan data structure for rendering - matches PlanCard expectations */
interface PlanDataType {
  type: "plan";
  title: string;
  description: string;
  tasks: Array<{ 
    id: string; 
    title: string; 
    description?: string; 
    subtasks?: string[];
    complexity?: string;
    estimated_time?: string;
  }>;
  status: "pending_approval" | "approved" | "rejected";
}

// Transform raw question to QuestionsCard format
function transformQuestion(q: { id?: string; text?: string; question?: string; type?: string; options?: (string | { value: string; label: string })[] }, index: number) {
  const questionText = q.question || q.text || `Question ${index + 1}`;
  const questionType = (q.type === "single" || q.type === "multiple" || q.type === "text" || q.type === "number") 
    ? q.type 
    : "text";
  
  return {
    id: q.id || `q-${index}`,
    question: questionText,
    type: questionType as "single" | "multiple" | "text" | "number",
    options: q.options?.map(opt => 
      typeof opt === "string" ? { value: opt, label: opt } : opt
    ),
    required: false,
  };
}

// Try to parse questions data from tool
function getQuestionsData(tool: AgenticToolStep): QuestionsDataType | null {
  try {
    // Try output first
    if (tool.output) {
      const parsed = JSON.parse(tool.output);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return { 
          type: "questions",
          title: parsed.title || "Questions",
          description: parsed.description,
          questions: parsed.questions.map(transformQuestion),
          status: parsed.status === "submitted" ? "submitted" : "pending_answers"
        };
      }
    }
    // Try input - use safe extraction
    const input = extractQuestionsData(tool.input);
    if (input.questions && input.questions.length > 0) {
      return { 
        type: "questions", 
        title: input.title || "Questions",
        description: input.description,
        questions: input.questions.map(transformQuestion),
        status: "pending_answers"
      };
    }
  } catch {
    // Parsing failed, return null
  }
  return null;
}

// Transform raw task to PlanCard format
type SubtaskInput = string | { id?: string; title: string; completed?: boolean };
type TaskInput = { 
  id?: string; 
  title: string; 
  description?: string; 
  status?: string; 
  subtasks?: SubtaskInput[]; 
  complexity?: string; 
  estimated_time?: string;
};

function transformTask(t: TaskInput, index: number) {
  // Convert subtasks to string array format
  const subtasks = t.subtasks?.map(st => 
    typeof st === "string" ? st : st.title
  );
  
  return {
    id: t.id || `task-${index}`,
    title: t.title,
    description: t.description,
    subtasks,
    complexity: t.complexity,
    estimated_time: t.estimated_time,
  };
}

// Try to parse plan data from tool
function getPlanData(tool: AgenticToolStep): PlanDataType | null {
  try {
    if (tool.output) {
      const parsed = JSON.parse(tool.output);
      if (parsed.type === "plan" || parsed.tasks) {
        const status = parsed.status === "approved" ? "approved" 
          : parsed.status === "rejected" ? "rejected" 
          : "pending_approval";
        return { 
          type: "plan",
          title: parsed.title || "Implementation Plan",
          description: parsed.description || "",
          tasks: (parsed.tasks || []).map(transformTask),
          status
        };
      }
    }
    // Try input - use safe extraction
    const input = extractPlanData(tool.input);
    if (input.tasks || input.title) {
      return {
        type: "plan",
        title: input.title || "Implementation Plan",
        description: input.description || "",
        tasks: (input.tasks || []).map(transformTask),
        status: "pending_approval"
      };
    }
  } catch {
    // Parsing failed, return null
  }
  return null;
}

export function AgentStep(props: AgentStepProps) {
  const { sendMessage } = useSDK();
  const [isExpanded, setIsExpanded] = createSignal(props.isLatest);

  // Auto-expand when it becomes the latest tool, or auto-collapse when it's no longer the latest
  createEffect(() => {
    setIsExpanded(!!props.isLatest || props.tool.status === 'running');
  });

  // Check if this is Questions tool
  const isQuestionsTool = () => props.tool.name.toLowerCase() === "questions";
  const isPlanTool = () => props.tool.name.toLowerCase() === "plan";

  const getIcon = () => {
    const name = props.tool.name.toLowerCase();
    if (name === "questions") return <Icon name="circle-question" class="w-3.5 h-3.5" />;
    if (name.includes("glob")) return <Icon name="magnifying-glass" class="w-3.5 h-3.5" />;
    if (name.includes("ls") || name.includes("list")) return <Icon name="list" class="w-3.5 h-3.5" />;
    return <Icon name="terminal" class="w-3.5 h-3.5" />;
  };

  const isLS = () => {
    const name = props.tool.name.toLowerCase();
    return (name === "ls" || name === "list_dir" || name === "list") && props.tool.output?.startsWith("{");
  };

  const getStatusIcon = () => {
    switch (props.tool.status) {
      case "running": return <Icon name="spinner" class="w-3 h-3 animate-spin" style={{ color: statusStyles.running.color }} />;
      case "completed": return <Icon name="check" class="w-3 h-3" style={{ color: statusStyles.completed.color }} />;
      case "error": return <Icon name="circle-exclamation" class="w-3 h-3" style={{ color: statusStyles.error.color }} />;
      default: return null;
    }
  };

  const getTerminalStatus = () => {
    if (props.tool.status === 'completed') return 'success';
    if (props.tool.status === 'pending') return 'running';
    return props.tool.status;
  };

  const getDisplayName = () => {
    const name = props.tool.name.toLowerCase();
    if (name === "questions") return "Questions";
    if (name === "plan") return "Plan";
    if (name === "ls" || name === "list_dir") return "List directory";
    if (name === "read" || name === "read_file") return "Read file";
    if (name === "write" || name === "write_file") return "Write file";
    if (name === "grep") return "Search text";
    if (name === "glob") return "Find files";
    if (name === "execute" || name === "shell") return "Run command";
    if (name === "edit") return "Edit file";
    return props.tool.name;
  };

  // Render Questions tool with QuestionsCard
  if (isQuestionsTool()) {
    const questionsData = getQuestionsData(props.tool);
    if (questionsData) {
      return <QuestionsCard data={questionsData} />;
    }
  }

  // Render Plan tool with PlanCard
  if (isPlanTool()) {
    const planData = getPlanData(props.tool);
    if (planData) {
      return (
        <PlanCard 
          data={planData}
          onApprove={async (plan) => {
            await sendMessage(`I approve the plan "${plan.title}". Please proceed with the implementation.`);
          }}
          onReject={async () => {
            await sendMessage("I reject this plan. Please suggest a different approach.");
          }}
        />
      );
    }
  }

  // Default rendering for other tools
  return (
    <div class="my-1" style={{ "padding-left": `${(props.indentation || 0) * 16}px` }}>
      <div 
        class="flex items-center gap-2 py-1 cursor-pointer group rounded px-2 -ml-2 transition-colors"
        style={{
          ...toolHeaderStyle,
        }}
        onClick={() => setIsExpanded(!isExpanded())}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <div class="w-4 flex justify-center" style={{ color: palette.textMuted }}>
          <Show when={isExpanded()} fallback={<Icon name="chevron-right" class="w-3 h-3" />}>
            <Icon name="chevron-down" class="w-3 h-3" />
          </Show>
        </div>
        
        <div style={{ color: palette.accent }}>
          {getIcon()}
        </div>
        
        <div class="flex-1 font-mono text-[11px] font-medium flex items-center gap-2" style={{ color: palette.textBody }}>
          <span style={{ color: palette.accent }}>{getDisplayName()}</span>
          <span class="truncate max-w-[300px]" style={{ color: palette.textMuted }}>
            {props.tool.name.toLowerCase().includes("ls") && props.tool.input.directory_path 
              ? (props.tool.input.directory_path as string)
              : props.tool.name.toLowerCase().includes("read") && props.tool.input.file_path
              ? (props.tool.input.file_path as string)
              : JSON.stringify(props.tool.input)}
          </span>
        </div>
        
        <div class="flex items-center gap-2">
          <Show when={props.tool.durationMs}>
            <span class="text-[9px] font-mono" style={{ color: palette.textMuted }}>{props.tool.durationMs}ms</span>
          </Show>
          {getStatusIcon()}
        </div>
      </div>

      <div 
        class="overflow-hidden transition-all duration-800 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          "max-height": isExpanded() ? "1500px" : "0px",
          opacity: isExpanded() ? "1" : "0",
          transform: isExpanded() ? "translateY(0)" : "translateY(-8px)",
          "transition-property": "max-height, opacity, transform",
        }}
      >
        <div class="ml-4 pl-4 mt-1 pb-2" style={{ "border-left": `1px solid ${palette.borderSubtle}` }}>
          <div class="text-[10px] font-mono mb-1 flex items-center gap-1" style={{ color: palette.textMuted }}>
            <span style={{ color: palette.textBody, opacity: 0.5 }}>Result</span>
          </div>
          <Show when={props.tool.output} fallback={
            <div class="text-[10px] italic font-mono py-2" style={{ color: palette.textMuted }}>
              {props.tool.status === 'running' ? 'Executing...' : 'No output'}
            </div>
          }>
            <Show when={isLS()} fallback={
              <div style={outputStyle}>
                <TerminalBlock 
                  content={props.tool.output!} 
                  status={getTerminalStatus()} 
                />
              </div>
            }>
              <LSTable content={props.tool.output!} />
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}


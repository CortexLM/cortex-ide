// ============================================================================
// Tool Input Type Definitions
// ============================================================================
// Provides strongly-typed interfaces for all tool inputs used throughout
// the application, replacing unsafe "as any" casts.

/**
 * Questions tool input structure
 */
export interface QuestionsToolInput {
  title?: string;
  description?: string;
  questions?: Array<{
    id?: string;
    text: string;
    type?: "text" | "choice" | "multiselect";
    options?: string[];
    required?: boolean;
  }>;
}

/**
 * Plan tool input structure
 */
export interface PlanToolInput {
  title?: string;
  description?: string;
  architecture?: string;
  tech_stack?: string[];
  tasks?: Array<{
    id?: string;
    title: string;
    description?: string;
    status?: "pending" | "in_progress" | "completed";
    subtasks?: Array<{
      id?: string;
      title: string;
      completed?: boolean;
    }>;
  }>;
  use_cases?: string[];
  agent_analyses?: string[];
  risks?: string[];
  files_to_modify?: string[];
  success_criteria?: string[];
  timeline?: string;
  estimated_changes?: string;
}

/**
 * Todo tool input structure
 */
export interface TodoToolInput {
  todos: string | Array<{
    id: string;
    status: string;
    content: string;
  }>;
}

/**
 * Execute tool input structure
 */
export interface ExecuteToolInput {
  command: string | string[];
  cwd?: string;
  timeout?: number;
}

/**
 * Read tool input structure
 */
export interface ReadToolInput {
  file_path: string;
  start_line?: number;
  end_line?: number;
}

/**
 * Create tool input structure
 */
export interface CreateToolInput {
  file_path: string;
  content: string;
}

/**
 * Edit tool input structure
 */
export interface EditToolInput {
  file_path: string;
  old_text: string;
  new_text: string;
}

/**
 * LS tool input structure
 */
export interface LSToolInput {
  directory_path?: string;
  recursive?: boolean;
  show_hidden?: boolean;
}

/**
 * Grep tool input structure
 */
export interface GrepToolInput {
  pattern: string;
  path?: string;
  include?: string[];
  exclude?: string[];
  case_sensitive?: boolean;
}

/**
 * Glob tool input structure
 */
export interface GlobToolInput {
  patterns: string[];
  cwd?: string;
}

/**
 * FetchUrl tool input structure
 */
export interface FetchUrlToolInput {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
}

/**
 * WebSearch tool input structure
 */
export interface WebSearchToolInput {
  query: string;
  num_results?: number;
}

/**
 * Terminal tool input structure
 */
export interface CreateTerminalToolInput {
  name?: string;
  cwd?: string;
  shell?: string;
}

export interface RunInTerminalToolInput {
  terminal_id: string;
  command: string;
}

export interface GetTerminalLogsToolInput {
  terminal_id: string;
  lines?: number;
}

export interface KillTerminalToolInput {
  terminal_id: string;
}

/**
 * Design System tool input structure
 */
export interface DesignSystemToolInput {
  type: "design_system";
  title?: string;
  description?: string;
  config?: Record<string, unknown>;
}

/**
 * ACP tool parameter structure
 */
export interface ACPToolParameter {
  name: string;
  type?: string;
  description?: string;
  required?: boolean;
  value?: unknown;
}

/**
 * Union type of all possible tool inputs
 */
export type ToolInputType =
  | QuestionsToolInput
  | PlanToolInput
  | TodoToolInput
  | ExecuteToolInput
  | ReadToolInput
  | CreateToolInput
  | EditToolInput
  | LSToolInput
  | GrepToolInput
  | GlobToolInput
  | FetchUrlToolInput
  | WebSearchToolInput
  | CreateTerminalToolInput
  | RunInTerminalToolInput
  | GetTerminalLogsToolInput
  | KillTerminalToolInput
  | DesignSystemToolInput;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if input is QuestionsToolInput
 */
export function isQuestionsInput(input: unknown): input is QuestionsToolInput {
  if (typeof input !== "object" || input === null) return false;
  const obj = input as Record<string, unknown>;
  return "questions" in obj && Array.isArray(obj.questions);
}

/**
 * Type guard to check if input is PlanToolInput
 */
export function isPlanInput(input: unknown): input is PlanToolInput {
  if (typeof input !== "object" || input === null) return false;
  const obj = input as Record<string, unknown>;
  return "tasks" in obj || "title" in obj || "description" in obj;
}

/**
 * Type guard to check if input is TodoToolInput
 */
export function isTodoInput(input: unknown): input is TodoToolInput {
  if (typeof input !== "object" || input === null) return false;
  return "todos" in input;
}

/**
 * Type guard to check if input is ExecuteToolInput
 */
export function isExecuteInput(input: unknown): input is ExecuteToolInput {
  if (typeof input !== "object" || input === null) return false;
  return "command" in input;
}

/**
 * Safely extract questions data from tool input
 */
export function extractQuestionsData(input: Record<string, unknown>): QuestionsToolInput {
  return {
    title: typeof input.title === "string" ? input.title : undefined,
    description: typeof input.description === "string" ? input.description : undefined,
    questions: Array.isArray(input.questions) ? input.questions : undefined,
  };
}

/**
 * Safely extract plan data from tool input
 */
export function extractPlanData(input: Record<string, unknown>): PlanToolInput {
  return {
    title: typeof input.title === "string" ? input.title : undefined,
    description: typeof input.description === "string" ? input.description : undefined,
    architecture: typeof input.architecture === "string" ? input.architecture : undefined,
    tech_stack: Array.isArray(input.tech_stack) ? input.tech_stack : undefined,
    tasks: Array.isArray(input.tasks) ? input.tasks : undefined,
    use_cases: Array.isArray(input.use_cases) ? input.use_cases : undefined,
    agent_analyses: Array.isArray(input.agent_analyses) ? input.agent_analyses : undefined,
    risks: Array.isArray(input.risks) ? input.risks : undefined,
    files_to_modify: Array.isArray(input.files_to_modify) ? input.files_to_modify : undefined,
    success_criteria: Array.isArray(input.success_criteria) ? input.success_criteria : undefined,
    timeline: typeof input.timeline === "string" ? input.timeline : undefined,
    estimated_changes: typeof input.estimated_changes === "string" ? input.estimated_changes : undefined,
  };
}

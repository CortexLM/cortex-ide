/**
 * ACP (Agent Communication Protocol) Context
 *
 * Provides tool registry and execution functionality for AI agent tools.
 * Tools can be registered, discovered, and executed with parameter validation.
 * Supports permissions and sandboxing for secure tool execution.
 */

import { createContext, useContext, ParentProps, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// =====================
// Types
// =====================

export type ToolPermission = "read" | "write" | "network" | "execute" | "filesystem";
export type ToolExecutionStatus = "idle" | "running" | "completed" | "error" | "cancelled";

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ACPTool {
  id: string;
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
  outputSchema?: unknown;
  annotations?: ToolAnnotations;
  permissions: ToolPermission[];
  enabled: boolean;
  source: "builtin" | "extension" | "custom" | "mcp";
  handler?: string;
  serverId?: string;
}

export interface ToolExecutionRequest {
  toolId: string;
  arguments: Record<string, unknown>;
  timeout?: number;
}

export type ToolResultContentType =
  | { type: "text"; text: string }
  | { type: "json"; data: unknown }
  | { type: "image"; data: string; mimeType: string }
  | { type: "error"; message: string; code?: string };

export interface ToolExecutionResult {
  id: string;
  toolId: string;
  status: ToolExecutionStatus;
  content: ToolResultContentType[];
  isError: boolean;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionHistory {
  executions: ToolExecutionResult[];
  maxHistory: number;
}

export interface ToolPermissionRequest {
  toolId: string;
  toolName: string;
  permissions: ToolPermission[];
  reason?: string;
}

export interface ToolSandboxConfig {
  allowNetwork: boolean;
  allowFilesystem: boolean;
  allowExecution: boolean;
  timeout: number;
  maxOutputSize: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
}

// =====================
// State
// =====================

interface ACPState {
  tools: Record<string, ACPTool>;
  executions: Record<string, ToolExecutionResult>;
  history: ToolExecutionResult[];
  pendingPermissions: ToolPermissionRequest[];
  sandboxConfig: ToolSandboxConfig;
  loading: boolean;
  error: string | null;
}

interface ACPContextValue {
  state: ACPState;
  // Tool Registry
  registerTool: (tool: Omit<ACPTool, "id" | "enabled">) => Promise<string>;
  unregisterTool: (toolId: string) => Promise<boolean>;
  updateTool: (toolId: string, updates: Partial<ACPTool>) => Promise<void>;
  listTools: () => ACPTool[];
  getTool: (toolId: string) => ACPTool | undefined;
  getToolByName: (name: string) => ACPTool | undefined;
  searchTools: (query: string) => ACPTool[];
  // Tool Execution
  executeTool: (request: ToolExecutionRequest) => Promise<ToolExecutionResult>;
  cancelExecution: (executionId: string) => Promise<boolean>;
  getExecution: (executionId: string) => ToolExecutionResult | undefined;
  // Permissions
  enableTool: (toolId: string) => Promise<void>;
  disableTool: (toolId: string) => Promise<void>;
  grantPermissions: (toolId: string, permissions: ToolPermission[]) => Promise<void>;
  revokePermissions: (toolId: string, permissions: ToolPermission[]) => Promise<void>;
  checkPermission: (toolId: string, permission: ToolPermission) => boolean;
  requestPermission: (request: ToolPermissionRequest) => Promise<boolean>;
  // Sandbox
  updateSandboxConfig: (config: Partial<ToolSandboxConfig>) => void;
  getSandboxConfig: () => ToolSandboxConfig;
  // History
  getHistory: (limit?: number) => ToolExecutionResult[];
  clearHistory: () => void;
  // Import/Export
  importTools: (tools: ACPTool[]) => Promise<number>;
  exportTools: () => ACPTool[];
  // AI Integration
  getToolsForAI: () => { name: string; description: string; parameters: unknown }[];
  handleAIToolCall: (name: string, args: Record<string, unknown>) => Promise<string>;
}

const ACPContext = createContext<ACPContextValue>();

// =====================
// Default Configuration
// =====================

const DEFAULT_SANDBOX_CONFIG: ToolSandboxConfig = {
  allowNetwork: false,
  allowFilesystem: false,
  allowExecution: false,
  timeout: 30000,
  maxOutputSize: 1024 * 1024,
};

const MAX_HISTORY_SIZE = 100;

// =====================
// Provider
// =====================

export function ACPProvider(props: ParentProps) {
  const [state, setState] = createStore<ACPState>({
    tools: {},
    executions: {},
    history: [],
    pendingPermissions: [],
    sandboxConfig: { ...DEFAULT_SANDBOX_CONFIG },
    loading: false,
    error: null,
  });

  let unlistenExecution: UnlistenFn | undefined;
  let unlistenPermission: UnlistenFn | undefined;

  onMount(async () => {
    unlistenExecution = await listen<{
      executionId: string;
      result: ToolExecutionResult;
    }>("acp:execution_complete", (event) => {
      const { executionId, result } = event.payload;
      setState("executions", executionId, result);
      setState(
        produce((s) => {
          s.history.unshift(result);
          if (s.history.length > MAX_HISTORY_SIZE) {
            s.history = s.history.slice(0, MAX_HISTORY_SIZE);
          }
        })
      );
    });

    unlistenPermission = await listen<ToolPermissionRequest>(
      "acp:permission_request",
      (event) => {
        setState(
          produce((s) => {
            s.pendingPermissions.push(event.payload);
          })
        );
      }
    );

    await loadTools();

    onCleanup(() => {
      unlistenExecution?.();
      unlistenPermission?.();
    });
  });

  const loadTools = async () => {
    setState("loading", true);
    setState("error", null);
    try {
      const tools = await invoke<ACPTool[]>("acp_list_tools");
      const toolsMap: Record<string, ACPTool> = {};
      for (const tool of tools) {
        toolsMap[tool.id] = tool;
      }
      setState("tools", toolsMap);
    } catch (e) {
      console.error("Failed to load ACP tools:", e);
      setState("error", e instanceof Error ? e.message : String(e));
    } finally {
      setState("loading", false);
    }
  };

  const generateToolId = (name: string): string => {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    return `${sanitized}_${Date.now().toString(36)}`;
  };

  const registerTool = async (
    tool: Omit<ACPTool, "id" | "enabled">
  ): Promise<string> => {
    const id = generateToolId(tool.name);
    const fullTool: ACPTool = {
      ...tool,
      id,
      enabled: true,
    };

    try {
      await invoke("acp_register_tool", { tool: fullTool });
      setState("tools", id, fullTool);
      return id;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const unregisterTool = async (toolId: string): Promise<boolean> => {
    try {
      const result = await invoke<boolean>("acp_unregister_tool", { toolId });
      if (result) {
        setState("tools", toolId, undefined!);
      }
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const updateTool = async (
    toolId: string,
    updates: Partial<ACPTool>
  ): Promise<void> => {
    const tool = state.tools[toolId];
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    const updatedTool = { ...tool, ...updates };
    try {
      await invoke("acp_update_tool", { toolId, updates });
      setState("tools", toolId, updatedTool);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const listTools = (): ACPTool[] => {
    return Object.values(state.tools);
  };

  const getTool = (toolId: string): ACPTool | undefined => {
    return state.tools[toolId];
  };

  const getToolByName = (name: string): ACPTool | undefined => {
    return Object.values(state.tools).find((t) => t.name === name);
  };

  const searchTools = (query: string): ACPTool[] => {
    const lowerQuery = query.toLowerCase();
    return Object.values(state.tools).filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description?.toLowerCase().includes(lowerQuery)
    );
  };

  const executeTool = async (
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> => {
    const tool = state.tools[request.toolId];
    if (!tool) {
      throw new Error(`Tool not found: ${request.toolId}`);
    }

    if (!tool.enabled) {
      throw new Error(`Tool is disabled: ${tool.name}`);
    }

    const executionId = `exec_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = Date.now();

    const pendingResult: ToolExecutionResult = {
      id: executionId,
      toolId: request.toolId,
      status: "running",
      content: [],
      isError: false,
      startedAt,
    };

    setState("executions", executionId, pendingResult);

    try {
      const result = await invoke<ToolExecutionResult>("acp_execute_tool", {
        executionId,
        toolId: request.toolId,
        arguments: request.arguments,
        timeout: request.timeout ?? state.sandboxConfig.timeout,
        sandboxConfig: state.sandboxConfig,
      });

      const completedResult: ToolExecutionResult = {
        ...result,
        id: executionId,
        startedAt,
        completedAt: Date.now(),
        durationMs: Date.now() - startedAt,
      };

      setState("executions", executionId, completedResult);
      setState(
        produce((s) => {
          s.history.unshift(completedResult);
          if (s.history.length > MAX_HISTORY_SIZE) {
            s.history = s.history.slice(0, MAX_HISTORY_SIZE);
          }
        })
      );

      return completedResult;
    } catch (e) {
      const errorResult: ToolExecutionResult = {
        id: executionId,
        toolId: request.toolId,
        status: "error",
        content: [
          {
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          },
        ],
        isError: true,
        startedAt,
        completedAt: Date.now(),
        durationMs: Date.now() - startedAt,
      };

      setState("executions", executionId, errorResult);
      setState(
        produce((s) => {
          s.history.unshift(errorResult);
          if (s.history.length > MAX_HISTORY_SIZE) {
            s.history = s.history.slice(0, MAX_HISTORY_SIZE);
          }
        })
      );

      return errorResult;
    }
  };

  const cancelExecution = async (executionId: string): Promise<boolean> => {
    try {
      const result = await invoke<boolean>("acp_cancel_execution", {
        executionId,
      });
      if (result) {
        setState("executions", executionId, "status", "cancelled");
      }
      return result;
    } catch (e) {
      console.error("Failed to cancel execution:", e);
      return false;
    }
  };

  const getExecution = (executionId: string): ToolExecutionResult | undefined => {
    return state.executions[executionId];
  };

  const enableTool = async (toolId: string): Promise<void> => {
    await updateTool(toolId, { enabled: true });
  };

  const disableTool = async (toolId: string): Promise<void> => {
    await updateTool(toolId, { enabled: false });
  };

  const grantPermissions = async (
    toolId: string,
    permissions: ToolPermission[]
  ): Promise<void> => {
    const tool = state.tools[toolId];
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    const newPermissions = [...new Set([...tool.permissions, ...permissions])];
    await updateTool(toolId, { permissions: newPermissions });
  };

  const revokePermissions = async (
    toolId: string,
    permissions: ToolPermission[]
  ): Promise<void> => {
    const tool = state.tools[toolId];
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    const newPermissions = tool.permissions.filter(
      (p) => !permissions.includes(p)
    );
    await updateTool(toolId, { permissions: newPermissions });
  };

  const checkPermission = (
    toolId: string,
    permission: ToolPermission
  ): boolean => {
    const tool = state.tools[toolId];
    return tool?.permissions.includes(permission) ?? false;
  };

  const requestPermission = async (
    request: ToolPermissionRequest
  ): Promise<boolean> => {
    try {
      const granted = await invoke<boolean>("acp_request_permission", {
        request,
      });
      if (granted) {
        await grantPermissions(request.toolId, request.permissions);
      }
      return granted;
    } catch (err) {
      console.debug("[ACP] Request permission failed:", err);
      return false;
    }
  };

  const updateSandboxConfig = (config: Partial<ToolSandboxConfig>): void => {
    setState("sandboxConfig", { ...state.sandboxConfig, ...config });
  };

  const getSandboxConfig = (): ToolSandboxConfig => {
    return { ...state.sandboxConfig };
  };

  const getHistory = (limit?: number): ToolExecutionResult[] => {
    const history = state.history;
    return limit ? history.slice(0, limit) : history;
  };

  const clearHistory = (): void => {
    setState("history", []);
  };

  const importTools = async (tools: ACPTool[]): Promise<number> => {
    let imported = 0;
    for (const tool of tools) {
      try {
        const { id, enabled, ...toolData } = tool;
        await registerTool(toolData);
        imported++;
      } catch (e) {
        console.error(`Failed to import tool ${tool.name}:`, e);
      }
    }
    return imported;
  };

  const exportTools = (): ACPTool[] => {
    return Object.values(state.tools).filter((t) => t.source === "custom");
  };

  const getToolsForAI = (): {
    name: string;
    description: string;
    parameters: unknown;
  }[] => {
    return Object.values(state.tools)
      .filter((tool) => tool.enabled)
      .map((tool) => ({
        name: tool.name,
        description: tool.description || `Execute the ${tool.name} tool`,
        parameters: tool.inputSchema,
      }));
  };

  const handleAIToolCall = async (
    name: string,
    args: Record<string, unknown>
  ): Promise<string> => {
    const tool = getToolByName(name);
    if (!tool) {
      return JSON.stringify({ error: `Unknown tool: ${name}` });
    }

    const result = await executeTool({
      toolId: tool.id,
      arguments: args,
    });

    if (result.isError) {
      const errorContent = result.content.find((c) => c.type === "error");
      return JSON.stringify({
        error:
          errorContent?.type === "error"
            ? errorContent.message
            : "Tool execution failed",
      });
    }

    const textContent = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("\n");

    const jsonContent = result.content.find((c) => c.type === "json");
    if (jsonContent?.type === "json") {
      return JSON.stringify(jsonContent.data);
    }

    return textContent || JSON.stringify({ success: true });
  };

  return (
    <ACPContext.Provider
      value={{
        state,
        registerTool,
        unregisterTool,
        updateTool,
        listTools,
        getTool,
        getToolByName,
        searchTools,
        executeTool,
        cancelExecution,
        getExecution,
        enableTool,
        disableTool,
        grantPermissions,
        revokePermissions,
        checkPermission,
        requestPermission,
        updateSandboxConfig,
        getSandboxConfig,
        getHistory,
        clearHistory,
        importTools,
        exportTools,
        getToolsForAI,
        handleAIToolCall,
      }}
    >
      {props.children}
    </ACPContext.Provider>
  );
}

// =====================
// Hook
// =====================

export function useACP() {
  const context = useContext(ACPContext);
  if (!context) {
    throw new Error("useACP must be used within ACPProvider");
  }
  return context;
}

// =====================
// Built-in Tool Definitions
// =====================

export const BUILTIN_TOOLS: Omit<ACPTool, "id" | "enabled">[] = [
  {
    name: "read_file",
    description: "Read the contents of a file from the filesystem",
    source: "builtin",
    permissions: ["read", "filesystem"],
    inputSchema: {
      type: "object",
      properties: {
        path: {
          name: "path",
          type: "string",
          description: "The file path to read",
          required: true,
        },
        encoding: {
          name: "encoding",
          type: "string",
          description: "File encoding (default: utf-8)",
          default: "utf-8",
        },
      },
      required: ["path"],
    },
    annotations: {
      readOnlyHint: true,
    },
    handler: "builtin:read_file",
  },
  {
    name: "write_file",
    description: "Write content to a file on the filesystem",
    source: "builtin",
    permissions: ["write", "filesystem"],
    inputSchema: {
      type: "object",
      properties: {
        path: {
          name: "path",
          type: "string",
          description: "The file path to write to",
          required: true,
        },
        content: {
          name: "content",
          type: "string",
          description: "The content to write",
          required: true,
        },
        encoding: {
          name: "encoding",
          type: "string",
          description: "File encoding (default: utf-8)",
          default: "utf-8",
        },
      },
      required: ["path", "content"],
    },
    annotations: {
      destructiveHint: true,
    },
    handler: "builtin:write_file",
  },
  {
    name: "list_directory",
    description: "List files and directories in a given path",
    source: "builtin",
    permissions: ["read", "filesystem"],
    inputSchema: {
      type: "object",
      properties: {
        path: {
          name: "path",
          type: "string",
          description: "The directory path to list",
          required: true,
        },
        recursive: {
          name: "recursive",
          type: "boolean",
          description: "Whether to list recursively",
          default: false,
        },
      },
      required: ["path"],
    },
    annotations: {
      readOnlyHint: true,
    },
    handler: "builtin:list_directory",
  },
  {
    name: "execute_command",
    description: "Execute a shell command",
    source: "builtin",
    permissions: ["execute"],
    inputSchema: {
      type: "object",
      properties: {
        command: {
          name: "command",
          type: "string",
          description: "The command to execute",
          required: true,
        },
        args: {
          name: "args",
          type: "array",
          description: "Command arguments",
        },
        cwd: {
          name: "cwd",
          type: "string",
          description: "Working directory for the command",
        },
        timeout: {
          name: "timeout",
          type: "number",
          description: "Timeout in milliseconds",
          default: 30000,
        },
      },
      required: ["command"],
    },
    annotations: {
      destructiveHint: true,
      openWorldHint: true,
    },
    handler: "builtin:execute_command",
  },
  {
    name: "http_request",
    description: "Make an HTTP request to a URL",
    source: "builtin",
    permissions: ["network"],
    inputSchema: {
      type: "object",
      properties: {
        url: {
          name: "url",
          type: "string",
          description: "The URL to request",
          required: true,
        },
        method: {
          name: "method",
          type: "string",
          description: "HTTP method (GET, POST, PUT, DELETE, etc.)",
          default: "GET",
          enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
        },
        headers: {
          name: "headers",
          type: "object",
          description: "HTTP headers",
        },
        body: {
          name: "body",
          type: "string",
          description: "Request body",
        },
      },
      required: ["url"],
    },
    annotations: {
      openWorldHint: true,
    },
    handler: "builtin:http_request",
  },
  {
    name: "search_files",
    description: "Search for files matching a pattern",
    source: "builtin",
    permissions: ["read", "filesystem"],
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          name: "pattern",
          type: "string",
          description: "Glob pattern to match files",
          required: true,
        },
        directory: {
          name: "directory",
          type: "string",
          description: "Base directory to search from",
        },
        maxResults: {
          name: "maxResults",
          type: "number",
          description: "Maximum number of results",
          default: 100,
        },
      },
      required: ["pattern"],
    },
    annotations: {
      readOnlyHint: true,
    },
    handler: "builtin:search_files",
  },
];

/**
 * Helper to create a custom tool definition
 */
export function createTool(
  name: string,
  description: string,
  parameters: ToolInputSchema["properties"],
  options?: {
    required?: string[];
    permissions?: ToolPermission[];
    annotations?: ToolAnnotations;
    handler?: string;
  }
): Omit<ACPTool, "id" | "enabled"> {
  return {
    name,
    description,
    source: "custom",
    permissions: options?.permissions || [],
    inputSchema: {
      type: "object",
      properties: parameters,
      required: options?.required,
    },
    annotations: options?.annotations,
    handler: options?.handler,
  };
}

/**
 * Helper to validate tool arguments against schema
 */
export function validateToolArguments(
  tool: ACPTool,
  args: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { properties, required } = tool.inputSchema;

  for (const reqField of required || []) {
    if (args[reqField] === undefined || args[reqField] === null) {
      errors.push(`Missing required parameter: ${reqField}`);
    }
  }

  for (const [key, value] of Object.entries(args)) {
    const param = properties[key];
    if (!param) {
      errors.push(`Unknown parameter: ${key}`);
      continue;
    }

    if (value !== undefined && value !== null) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (param.type !== actualType && !(param.type === "number" && actualType === "number")) {
        errors.push(
          `Invalid type for ${key}: expected ${param.type}, got ${actualType}`
        );
      }

      if (param.enum && !param.enum.includes(value)) {
        errors.push(`Invalid value for ${key}: must be one of ${param.enum.join(", ")}`);
      }

      if (param.type === "string" && typeof value === "string") {
        if (param.minLength !== undefined && value.length < param.minLength) {
          errors.push(`${key} must be at least ${param.minLength} characters`);
        }
        if (param.maxLength !== undefined && value.length > param.maxLength) {
          errors.push(`${key} must be at most ${param.maxLength} characters`);
        }
      }

      if (param.type === "number" && typeof value === "number") {
        if (param.minimum !== undefined && value < param.minimum) {
          errors.push(`${key} must be at least ${param.minimum}`);
        }
        if (param.maximum !== undefined && value > param.maximum) {
          errors.push(`${key} must be at most ${param.maximum}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

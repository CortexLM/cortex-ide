/**
 * Context Server Context
 *
 * Provides MCP (Model Context Protocol) functionality for connecting to
 * external context providers like databases, APIs, and documentation sources.
 */

import { createContext, useContext, ParentProps, onMount, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// =====================
// Types
// =====================

export type ServerType = "stdio" | "http" | "sse";
export type ServerStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ServerCapabilities {
  experimental?: Record<string, unknown>;
  logging?: unknown;
  completions?: unknown;
  prompts?: PromptsCapabilities;
  resources?: ResourcesCapabilities;
  tools?: ToolsCapabilities;
}

export interface PromptsCapabilities {
  listChanged?: boolean;
}

export interface ResourcesCapabilities {
  subscribe?: boolean;
  listChanged?: boolean;
}

export interface ToolsCapabilities {
  listChanged?: boolean;
}

export interface ContextServerConfig {
  name: string;
  serverType: ServerType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  workingDirectory?: string;
  timeoutMs?: number;
  autoConnect?: boolean;
}

export interface ContextServerInfo {
  id: string;
  name: string;
  serverType: ServerType;
  status: ServerStatus;
  capabilities?: ServerCapabilities;
}

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  annotations?: ToolAnnotations;
}

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export type ToolResponseContentType =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "audio"; data: string; mimeType: string }
  | { type: "resource"; resource: ResourceContents };

export interface CallToolResponse {
  content: ToolResponseContentType[];
  isError?: boolean;
  structuredContent?: unknown;
}

export interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export type Role = "user" | "assistant";

export type MessageContentType =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; resource: ResourceContents };

export interface PromptMessage {
  role: Role;
  content: MessageContentType;
}

export interface PromptsGetResponse {
  description?: string;
  messages: PromptMessage[];
}

export type LoggingLevel = "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency";

// =====================
// State
// =====================

interface ContextServerState {
  servers: Record<string, ContextServerInfo>;
  resources: Record<string, Resource[]>;
  tools: Record<string, Tool[]>;
  prompts: Record<string, Prompt[]>;
  loading: boolean;
  error: string | null;
}

interface ContextServerContextValue {
  state: ContextServerState;
  // Server management
  addServer: (config: ContextServerConfig) => Promise<string>;
  removeServer: (serverId: string) => Promise<boolean>;
  listServers: () => ContextServerInfo[];
  getServer: (serverId: string) => ContextServerInfo | undefined;
  connect: (serverId: string) => Promise<ContextServerInfo>;
  disconnect: (serverId: string) => Promise<void>;
  ping: (serverId: string) => Promise<boolean>;
  // Resources
  listResources: (serverId: string) => Promise<Resource[]>;
  readResource: (serverId: string, uri: string) => Promise<ResourceContents[]>;
  listResourceTemplates: (serverId: string) => Promise<ResourceTemplate[]>;
  // Tools
  listTools: (serverId: string) => Promise<Tool[]>;
  callTool: (serverId: string, toolName: string, args?: unknown) => Promise<CallToolResponse>;
  // Prompts
  listPrompts: (serverId: string) => Promise<Prompt[]>;
  getPrompt: (serverId: string, promptName: string, args?: Record<string, string>) => Promise<PromptsGetResponse>;
  // Context aggregation
  queryContext: (serverIds: string[], query: string) => Promise<ResourceContents[]>;
  getContextForPrompt: (serverIds: string[], maxTokens?: number) => Promise<string>;
  // Utility
  setLogLevel: (serverId: string, level: LoggingLevel) => Promise<void>;
  getConnectedServers: () => ContextServerInfo[];
  hasCapability: (serverId: string, capability: keyof ServerCapabilities) => boolean;
}

const ContextServerContext = createContext<ContextServerContextValue>();

// =====================
// Provider
// =====================

export function ContextServerProvider(props: ParentProps) {
  const [state, setState] = createStore<ContextServerState>({
    servers: {},
    resources: {},
    tools: {},
    prompts: {},
    loading: false,
    error: null,
  });

  let unlistenStatus: UnlistenFn | undefined;

  onMount(async () => {
    // Listen for status events from the backend
    unlistenStatus = await listen<{
      serverId: string;
      status: ServerStatus;
      capabilities?: ServerCapabilities;
      error?: string;
    }>("mcp:status", (event) => {
      const { serverId, status, capabilities, error } = event.payload;

      if (state.servers[serverId]) {
        setState("servers", serverId, {
          ...state.servers[serverId],
          status,
          capabilities: capabilities ?? state.servers[serverId].capabilities,
        });
      }

      if (error) {
        setState("error", error);
      }
    });

    // Load existing servers
    await refreshServers();

    onCleanup(() => {
      unlistenStatus?.();
    });
  });

  const refreshServers = async () => {
    try {
      const servers = await invoke<ContextServerInfo[]>("mcp_list_servers");
      const serversMap: Record<string, ContextServerInfo> = {};
      for (const server of servers) {
        serversMap[server.id] = server;
      }
      setState("servers", serversMap);
    } catch (e) {
      console.error("Failed to refresh servers:", e);
    }
  };

  const addServer = async (config: ContextServerConfig): Promise<string> => {
    setState("loading", true);
    setState("error", null);

    try {
      const id = await invoke<string>("mcp_add_server", {
        config: {
          name: config.name,
          server_type: config.serverType,
          command: config.command,
          args: config.args,
          env: config.env,
          url: config.url,
          headers: config.headers,
          working_directory: config.workingDirectory,
          timeout_ms: config.timeoutMs,
          auto_connect: config.autoConnect,
        },
      });

      await refreshServers();
      return id;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    } finally {
      setState("loading", false);
    }
  };

  const removeServer = async (serverId: string): Promise<boolean> => {
    setState("loading", true);
    setState("error", null);

    try {
      const removed = await invoke<boolean>("mcp_remove_server", { serverId });
      if (removed) {
        setState("servers", serverId, undefined!);
        setState("resources", serverId, undefined!);
        setState("tools", serverId, undefined!);
        setState("prompts", serverId, undefined!);
      }
      return removed;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    } finally {
      setState("loading", false);
    }
  };

  const listServers = (): ContextServerInfo[] => {
    return Object.values(state.servers);
  };

  const getServer = (serverId: string): ContextServerInfo | undefined => {
    return state.servers[serverId];
  };

  const connect = async (serverId: string): Promise<ContextServerInfo> => {
    setState("loading", true);
    setState("error", null);

    try {
      const info = await invoke<ContextServerInfo>("mcp_connect", { serverId });
      setState("servers", serverId, info);

      // Auto-load resources, tools, and prompts
      if (info.capabilities?.resources) {
        listResources(serverId).catch(console.error);
      }
      if (info.capabilities?.tools) {
        listTools(serverId).catch(console.error);
      }
      if (info.capabilities?.prompts) {
        listPrompts(serverId).catch(console.error);
      }

      return info;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    } finally {
      setState("loading", false);
    }
  };

  const disconnect = async (serverId: string): Promise<void> => {
    setState("loading", true);
    setState("error", null);

    try {
      await invoke("mcp_disconnect", { serverId });
      if (state.servers[serverId]) {
        setState("servers", serverId, {
          ...state.servers[serverId],
          status: "disconnected",
        });
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    } finally {
      setState("loading", false);
    }
  };

  const ping = async (serverId: string): Promise<boolean> => {
    try {
      return await invoke<boolean>("mcp_ping", { serverId });
    } catch (err) {
      console.debug("[MCP] Ping failed:", err);
      return false;
    }
  };

  const listResources = async (serverId: string): Promise<Resource[]> => {
    try {
      const resources = await invoke<Resource[]>("mcp_list_resources", { serverId });
      setState("resources", serverId, resources);
      return resources;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const readResource = async (serverId: string, uri: string): Promise<ResourceContents[]> => {
    try {
      return await invoke<ResourceContents[]>("mcp_read_resource", { serverId, uri });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const listResourceTemplates = async (serverId: string): Promise<ResourceTemplate[]> => {
    try {
      return await invoke<ResourceTemplate[]>("mcp_list_resource_templates", { serverId });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const listTools = async (serverId: string): Promise<Tool[]> => {
    try {
      const tools = await invoke<Tool[]>("mcp_list_tools", { serverId });
      setState("tools", serverId, tools);
      return tools;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const callTool = async (
    serverId: string,
    toolName: string,
    args?: unknown
  ): Promise<CallToolResponse> => {
    try {
      return await invoke<CallToolResponse>("mcp_call_tool", {
        serverId,
        toolName,
        arguments: args,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const listPrompts = async (serverId: string): Promise<Prompt[]> => {
    try {
      const prompts = await invoke<Prompt[]>("mcp_list_prompts", { serverId });
      setState("prompts", serverId, prompts);
      return prompts;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const getPrompt = async (
    serverId: string,
    promptName: string,
    args?: Record<string, string>
  ): Promise<PromptsGetResponse> => {
    try {
      return await invoke<PromptsGetResponse>("mcp_get_prompt", {
        serverId,
        promptName,
        arguments: args,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const queryContext = async (serverIds: string[], query: string): Promise<ResourceContents[]> => {
    try {
      return await invoke<ResourceContents[]>("mcp_query_context", { serverIds, query });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const getContextForPrompt = async (serverIds: string[], maxTokens?: number): Promise<string> => {
    try {
      return await invoke<string>("mcp_get_context_for_prompt", { serverIds, maxTokens });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const setLogLevel = async (serverId: string, level: LoggingLevel): Promise<void> => {
    try {
      await invoke("mcp_set_log_level", { serverId, level });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const getConnectedServers = (): ContextServerInfo[] => {
    return Object.values(state.servers).filter((s) => s.status === "connected");
  };

  const hasCapability = (serverId: string, capability: keyof ServerCapabilities): boolean => {
    const server = state.servers[serverId];
    if (!server?.capabilities) return false;
    return server.capabilities[capability] !== undefined;
  };

  return (
    <ContextServerContext.Provider
      value={{
        state,
        addServer,
        removeServer,
        listServers,
        getServer,
        connect,
        disconnect,
        ping,
        listResources,
        readResource,
        listResourceTemplates,
        listTools,
        callTool,
        listPrompts,
        getPrompt,
        queryContext,
        getContextForPrompt,
        setLogLevel,
        getConnectedServers,
        hasCapability,
      }}
    >
      {props.children}
    </ContextServerContext.Provider>
  );
}

// =====================
// Hook
// =====================

export function useContextServer() {
  const context = useContext(ContextServerContext);
  if (!context) {
    throw new Error("useContextServer must be used within ContextServerProvider");
  }
  return context;
}

// =====================
// Preset Server Configs
// =====================

export const PRESET_SERVERS: Record<string, Omit<ContextServerConfig, "name">> = {
  filesystem: {
    serverType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
  },
  github: {
    serverType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
  },
  postgres: {
    serverType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
  },
  sqlite: {
    serverType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite"],
  },
  memory: {
    serverType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
  },
  fetch: {
    serverType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
  },
};

/**
 * Helper to create a server config from a preset
 */
export function createServerConfig(
  presetName: keyof typeof PRESET_SERVERS,
  name: string,
  extraConfig?: Partial<ContextServerConfig>
): ContextServerConfig {
  const preset = PRESET_SERVERS[presetName];
  return {
    ...preset,
    name,
    ...extraConfig,
  };
}

/**
 * Context Server Panel Component
 *
 * UI for managing MCP context servers and browsing available resources,
 * tools, and prompts from connected servers.
 */

import { createSignal, For, Show, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  useContextServer,
  PRESET_SERVERS,
  type ContextServerConfig,
  type ContextServerInfo,
  type Resource,
  type Tool,
  type Prompt,
  type ServerStatus,
  type ServerType,
} from "@/context/ContextServerContext";
import { Button, IconButton, Input } from "@/components/ui";

interface ContextServerPanelProps {
  onContextSelected?: (context: string) => void;
  compact?: boolean;
}

export function ContextServerPanel(props: ContextServerPanelProps) {
  const contextServer = useContextServer();

  const [showAddDialog, setShowAddDialog] = createSignal(false);
  const [expandedServers, setExpandedServers] = createSignal<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = createSignal<Record<string, Set<string>>>({});
  const [selectedResource, setSelectedResource] = createSignal<{ serverId: string; uri: string } | null>(null);
  const [resourceContent, setResourceContent] = createSignal<string | null>(null);
  const [loadingResource, setLoadingResource] = createSignal(false);

  // Tool invocation state
  const [selectedTool, setSelectedTool] = createSignal<{ serverId: string; tool: Tool } | null>(null);
  const [toolResult, setToolResult] = createSignal<{ content: string; isError?: boolean } | null>(null);
  const [loadingTool, setLoadingTool] = createSignal(false);

  // Prompt execution state
  const [selectedPrompt, setSelectedPrompt] = createSignal<{ serverId: string; prompt: Prompt } | null>(null);
  const [promptResult, setPromptResult] = createSignal<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = createSignal(false);

  const servers = createMemo(() => contextServer.listServers());

  const toggleServerExpanded = (serverId: string) => {
    const expanded = new Set(expandedServers());
    if (expanded.has(serverId)) {
      expanded.delete(serverId);
    } else {
      expanded.add(serverId);
    }
    setExpandedServers(expanded);
  };

  const toggleSection = (serverId: string, section: string) => {
    const sections = { ...expandedSections() };
    if (!sections[serverId]) {
      sections[serverId] = new Set();
    }
    if (sections[serverId].has(section)) {
      sections[serverId].delete(section);
    } else {
      sections[serverId].add(section);
    }
    setExpandedSections(sections);
  };

  const handleConnect = async (serverId: string) => {
    try {
      await contextServer.connect(serverId);
    } catch (e) {
      console.error("Failed to connect:", e);
    }
  };

  const handleDisconnect = async (serverId: string) => {
    try {
      await contextServer.disconnect(serverId);
    } catch (e) {
      console.error("Failed to disconnect:", e);
    }
  };

  const handleRemove = async (serverId: string) => {
    try {
      await contextServer.removeServer(serverId);
    } catch (e) {
      console.error("Failed to remove server:", e);
    }
  };

  const handleResourceClick = async (serverId: string, uri: string) => {
    setSelectedResource({ serverId, uri });
    setLoadingResource(true);
    setResourceContent(null);

    try {
      const contents = await contextServer.readResource(serverId, uri);
      const text = contents.map((c) => c.text || "").join("\n");
      setResourceContent(text);

      if (props.onContextSelected) {
        props.onContextSelected(text);
      }
    } catch (e) {
      console.error("Failed to read resource:", e);
      setResourceContent(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingResource(false);
    }
  };

  const copyResourceToClipboard = async () => {
    const content = resourceContent();
    if (content) {
      await navigator.clipboard.writeText(content);
    }
  };

  const handleToolClick = (serverId: string, tool: Tool) => {
    setSelectedTool({ serverId, tool });
    setToolResult(null);
  };

  const handleToolInvoke = async (args: Record<string, unknown>) => {
    const tool = selectedTool();
    if (!tool) return;

    setLoadingTool(true);
    setToolResult(null);

    try {
      const response = await contextServer.callTool(tool.serverId, tool.tool.name, args);
      const resultText = response.content
        .map((c) => {
          if (c.type === "text") return c.text;
          if (c.type === "image") return `[Image: ${c.mimeType}]`;
          if (c.type === "audio") return `[Audio: ${c.mimeType}]`;
          if (c.type === "resource") return c.resource.text || `[Resource: ${c.resource.uri}]`;
          return "[Unknown content]";
        })
        .join("\n");

      setToolResult({ content: resultText, isError: response.isError });

      if (props.onContextSelected && !response.isError) {
        props.onContextSelected(resultText);
      }
    } catch (e) {
      setToolResult({
        content: `Error: ${e instanceof Error ? e.message : String(e)}`,
        isError: true,
      });
    } finally {
      setLoadingTool(false);
    }
  };

  const handlePromptClick = (serverId: string, prompt: Prompt) => {
    setSelectedPrompt({ serverId, prompt });
    setPromptResult(null);
  };

  const handlePromptExecute = async (args: Record<string, string>) => {
    const prompt = selectedPrompt();
    if (!prompt) return;

    setLoadingPrompt(true);
    setPromptResult(null);

    try {
      const response = await contextServer.getPrompt(prompt.serverId, prompt.prompt.name, args);
      const resultText = response.messages
        .map((msg) => {
          const content = msg.content;
          if (content.type === "text") return `[${msg.role}]: ${content.text}`;
          if (content.type === "image") return `[${msg.role}]: [Image: ${content.mimeType}]`;
          if (content.type === "resource")
            return `[${msg.role}]: ${content.resource.text || `[Resource: ${content.resource.uri}]`}`;
          return `[${msg.role}]: [Unknown content]`;
        })
        .join("\n\n");

      setPromptResult(resultText);

      if (props.onContextSelected) {
        props.onContextSelected(resultText);
      }
    } catch (e) {
      setPromptResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingPrompt(false);
    }
  };

  return (
    <div class={`flex flex-col h-full ${props.compact ? "text-sm" : ""}`}>
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <div class="flex items-center gap-2">
          <Icon name="server" class="h-4 w-4" style={{ color: "var(--color-primary)" }} />
          <span class="font-medium">Context Servers</span>
          <span class="text-xs text-foreground-muted">({servers().length})</span>
        </div>
        <IconButton
          onClick={() => setShowAddDialog(true)}
          tooltip="Add Server"
        >
          <Icon name="plus" class="h-4 w-4" />
        </IconButton>
      </div>

      {/* Server List */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={servers().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center p-4 text-center text-foreground-muted">
              <Icon name="server" class="h-8 w-8 mb-2 opacity-50" />
              <p class="text-sm">No context servers configured</p>
              <Button
                onClick={() => setShowAddDialog(true)}
                variant="ghost"
                size="sm"
              >
                Add your first server
              </Button>
            </div>
          }
        >
          <For each={servers()}>
            {(server) => (
              <ServerItem
                server={server}
                expanded={expandedServers().has(server.id)}
                expandedSections={expandedSections()[server.id] || new Set()}
                resources={contextServer.state.resources[server.id] || []}
                tools={contextServer.state.tools[server.id] || []}
                prompts={contextServer.state.prompts[server.id] || []}
                onToggleExpand={() => toggleServerExpanded(server.id)}
                onToggleSection={(section) => toggleSection(server.id, section)}
                onConnect={() => handleConnect(server.id)}
                onDisconnect={() => handleDisconnect(server.id)}
                onRemove={() => handleRemove(server.id)}
                onResourceClick={(uri) => handleResourceClick(server.id, uri)}
                onToolClick={(tool) => handleToolClick(server.id, tool)}
                onPromptClick={(prompt) => handlePromptClick(server.id, prompt)}
                selectedResourceUri={
                  selectedResource()?.serverId === server.id
                    ? selectedResource()?.uri
                    : undefined
                }
              />
            )}
          </For>
        </Show>
      </div>

      {/* Resource Preview */}
      <Show when={selectedResource()}>
        <div class="border-t border-border">
          <div class="flex items-center justify-between px-3 py-2 bg-background-tertiary">
            <span class="text-xs font-medium truncate">{selectedResource()?.uri}</span>
            <div class="flex items-center gap-1">
              <IconButton
                onClick={copyResourceToClipboard}
                tooltip="Copy to clipboard"
                size="sm"
              >
                <Icon name="copy" class="h-3 w-3" />
              </IconButton>
              <IconButton
                onClick={() => setSelectedResource(null)}
                size="sm"
              >
                <Icon name="xmark" class="h-3 w-3" />
              </IconButton>
            </div>
          </div>
          <div class="max-h-40 overflow-y-auto p-2 text-xs font-mono bg-background-tertiary/50">
            <Show
              when={!loadingResource()}
              fallback={
                <div class="flex items-center justify-center p-4">
                  <Icon name="spinner" class="h-4 w-4 animate-spin" />
                </div>
              }
            >
              <pre class="whitespace-pre-wrap break-words">{resourceContent() || "No content"}</pre>
            </Show>
          </div>
        </div>
      </Show>

      {/* Add Server Dialog */}
      <Show when={showAddDialog()}>
        <AddServerDialog onClose={() => setShowAddDialog(false)} />
      </Show>

      {/* Tool Invocation Dialog */}
      <Show when={selectedTool()}>
        <ToolInvocationDialog
          tool={selectedTool()!.tool}
          onClose={() => setSelectedTool(null)}
          onInvoke={handleToolInvoke}
          loading={loadingTool()}
          result={toolResult()}
        />
      </Show>

      {/* Prompt Execution Dialog */}
      <Show when={selectedPrompt()}>
        <PromptExecutionDialog
          prompt={selectedPrompt()!.prompt}
          onClose={() => setSelectedPrompt(null)}
          onExecute={handlePromptExecute}
          loading={loadingPrompt()}
          result={promptResult()}
        />
      </Show>
    </div>
  );
}

// =====================
// Server Item Component
// =====================

interface ServerItemProps {
  server: ContextServerInfo;
  expanded: boolean;
  expandedSections: Set<string>;
  resources: Resource[];
  tools: Tool[];
  prompts: Prompt[];
  onToggleExpand: () => void;
  onToggleSection: (section: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
  onResourceClick: (uri: string) => void;
  onToolClick: (tool: Tool) => void;
  onPromptClick: (prompt: Prompt) => void;
  selectedResourceUri?: string;
}

function ServerItem(props: ServerItemProps) {
  const isConnected = () => props.server.status === "connected";
  const isConnecting = () => props.server.status === "connecting";

  return (
    <div class="border-b border-border">
      {/* Server Header */}
      <div
        class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-background-tertiary transition-colors"
        onClick={props.onToggleExpand}
      >
{props.expanded ? (
          <Icon name="chevron-down" class="h-4 w-4 flex-shrink-0" />
        ) : (
          <Icon name="chevron-right" class="h-4 w-4 flex-shrink-0" />
        )}
        <span class="flex-1 truncate font-medium">{props.server.name}</span>
        <span class="flex items-center gap-1">
          {getStatusIconInline(props.server.status)}
        </span>
        <div class="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Show
            when={isConnected()}
            fallback={
              <IconButton
                onClick={props.onConnect}
                disabled={isConnecting()}
                tooltip="Connect"
                size="sm"
              >
                <Icon name="play" class="h-3 w-3 text-green-500" />
              </IconButton>
            }
          >
            <IconButton
              onClick={props.onDisconnect}
              tooltip="Disconnect"
              size="sm"
            >
              <Icon name="pause" class="h-3 w-3 text-yellow-500" />
            </IconButton>
          </Show>
          <IconButton
            onClick={props.onRemove}
            tooltip="Remove"
            size="sm"
          >
            <Icon name="trash" class="h-3 w-3 text-red-500" />
          </IconButton>
        </div>
      </div>

      {/* Expanded Content */}
      <Show when={props.expanded}>
        <div class="pl-6 pr-3 pb-2">
          {/* Server Info */}
          <div class="text-xs text-foreground-muted mb-2">
            <span class="capitalize">{props.server.serverType}</span>
            <span class="mx-1">•</span>
            <span>{getStatusTextInline(props.server.status)}</span>
          </div>

          {/* Resources Section */}
          <Show when={props.server.capabilities?.resources}>
            <SectionHeader
              icon={<Icon name="database" class="h-3 w-3" />}
              title="Resources"
              count={props.resources.length}
              expanded={props.expandedSections.has("resources")}
              onClick={() => props.onToggleSection("resources")}
            />
            <Show when={props.expandedSections.has("resources")}>
              <div class="ml-4 mt-1 space-y-1">
                <For each={props.resources}>
                  {(resource) => (
                    <div
                      class={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                        props.selectedResourceUri === resource.uri
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-background-tertiary"
                      }`}
                      onClick={() => props.onResourceClick(resource.uri)}
                    >
                      <Icon name="file" class="h-3 w-3 flex-shrink-0" />
                      <span class="truncate">{resource.name}</span>
                    </div>
                  )}
                </For>
                <Show when={props.resources.length === 0}>
                  <div class="text-xs text-foreground-muted italic px-2">No resources available</div>
                </Show>
              </div>
            </Show>
          </Show>

          {/* Tools Section */}
          <Show when={props.server.capabilities?.tools}>
            <SectionHeader
              icon={<Icon name="wrench" class="h-3 w-3" />}
              title="Tools"
              count={props.tools.length}
              expanded={props.expandedSections.has("tools")}
              onClick={() => props.onToggleSection("tools")}
            />
            <Show when={props.expandedSections.has("tools")}>
              <div class="ml-4 mt-1 space-y-1">
                <For each={props.tools}>
                  {(tool) => (
                    <div
                      class="flex items-start gap-2 px-2 py-1 rounded text-xs hover:bg-background-tertiary cursor-pointer transition-colors"
                      onClick={() => props.onToolClick(tool)}
                    >
                      <Icon name="wrench" class="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <div class="flex-1 min-w-0">
                        <div class="font-medium truncate">{tool.name}</div>
                        <Show when={tool.description}>
                          <div class="text-foreground-muted truncate">{tool.description}</div>
                        </Show>
                      </div>
                      <Icon name="play" class="h-3 w-3 flex-shrink-0 mt-0.5 text-green-500 opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </For>
                <Show when={props.tools.length === 0}>
                  <div class="text-xs text-foreground-muted italic px-2">No tools available</div>
                </Show>
              </div>
            </Show>
          </Show>

          {/* Prompts Section */}
          <Show when={props.server.capabilities?.prompts}>
            <SectionHeader
              icon={<Icon name="message" class="h-3 w-3" />}
              title="Prompts"
              count={props.prompts.length}
              expanded={props.expandedSections.has("prompts")}
              onClick={() => props.onToggleSection("prompts")}
            />
            <Show when={props.expandedSections.has("prompts")}>
              <div class="ml-4 mt-1 space-y-1">
                <For each={props.prompts}>
                  {(prompt) => (
                    <div
                      class="flex items-start gap-2 px-2 py-1 rounded text-xs hover:bg-background-tertiary cursor-pointer transition-colors"
                      onClick={() => props.onPromptClick(prompt)}
                    >
                      <Icon name="message" class="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <div class="flex-1 min-w-0">
                        <div class="font-medium truncate">{prompt.name}</div>
                        <Show when={prompt.description}>
                          <div class="text-foreground-muted truncate">{prompt.description}</div>
                        </Show>
                      </div>
                      <Icon name="play" class="h-3 w-3 flex-shrink-0 mt-0.5 text-green-500 opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </For>
                <Show when={props.prompts.length === 0}>
                  <div class="text-xs text-foreground-muted italic px-2">No prompts available</div>
                </Show>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function getStatusIconInline(status: ServerStatus) {
  switch (status) {
    case "connected":
      return <Icon name="check" class="h-3 w-3 text-green-500" />;
    case "connecting":
      return <Icon name="spinner" class="h-3 w-3 text-yellow-500 animate-spin" />;
    case "error":
      return <Icon name="circle-exclamation" class="h-3 w-3 text-red-500" />;
    default:
      return <Icon name="pause" class="h-3 w-3 text-foreground-muted" />;
  }
}

function getStatusTextInline(status: ServerStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting...";
    case "error":
      return "Error";
    default:
      return "Disconnected";
  }
}

// =====================
// Section Header Component
// =====================

interface SectionHeaderProps {
  icon: any;
  title: string;
  count: number;
  expanded: boolean;
  onClick: () => void;
}

function SectionHeader(props: SectionHeaderProps) {
  return (
    <div
      class="flex items-center gap-2 py-1 cursor-pointer hover:text-foreground text-foreground-muted transition-colors"
      onClick={props.onClick}
    >
{props.expanded ? (
        <Icon name="chevron-down" class="h-3 w-3" />
      ) : (
        <Icon name="chevron-right" class="h-3 w-3" />
      )}
      {props.icon}
      <span class="text-xs font-medium">{props.title}</span>
      <span class="text-xs">({props.count})</span>
    </div>
  );
}

// =====================
// Add Server Dialog
// =====================

interface AddServerDialogProps {
  onClose: () => void;
}

function AddServerDialog(props: AddServerDialogProps) {
  const contextServer = useContextServer();

  const [tab, setTab] = createSignal<"preset" | "custom">("preset");
  const [selectedPreset, setSelectedPreset] = createSignal<string | null>(null);
  const [name, setName] = createSignal("");
  const [serverType, setServerType] = createSignal<ServerType>("stdio");
  const [command, setCommand] = createSignal("");
  const [args, setArgs] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const presetEntries = Object.entries(PRESET_SERVERS);

  const handleAddPreset = async () => {
    const preset = selectedPreset();
    if (!preset || !name()) return;

    setLoading(true);
    setError(null);

    try {
      const config = PRESET_SERVERS[preset];
      await contextServer.addServer({
        name: name(),
        ...config,
      });
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustom = async () => {
    if (!name()) return;

    setLoading(true);
    setError(null);

    try {
      const config: ContextServerConfig = {
        name: name(),
        serverType: serverType(),
      };

      if (serverType() === "stdio") {
        if (!command()) {
          setError("Command is required for stdio servers");
          return;
        }
        config.command = command();
        config.args = args().split(" ").filter(Boolean);
      } else {
        if (!url()) {
          setError("URL is required for HTTP/SSE servers");
          return;
        }
        config.url = url();
      }

      await contextServer.addServer(config);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-background-secondary border border-border rounded-lg w-full max-w-md shadow-xl">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 class="font-medium">Add Context Server</h3>
          <IconButton
            onClick={props.onClose}
          >
            <Icon name="xmark" class="h-4 w-4" />
          </IconButton>
        </div>

        {/* Tabs */}
        <div class="flex border-b border-border">
          <Button
            onClick={() => setTab("preset")}
            variant="ghost"
            style={{
              "flex": "1",
              "border-radius": "0",
              "border-bottom": tab() === "preset" ? "2px solid var(--jb-btn-primary-bg)" : "2px solid transparent",
              color: tab() === "preset" ? "var(--jb-btn-primary-bg)" : "var(--jb-text-muted-color)",
            }}
          >
            Presets
          </Button>
          <Button
            onClick={() => setTab("custom")}
            variant="ghost"
            style={{
              "flex": "1",
              "border-radius": "0",
              "border-bottom": tab() === "custom" ? "2px solid var(--jb-btn-primary-bg)" : "2px solid transparent",
              color: tab() === "custom" ? "var(--jb-btn-primary-bg)" : "var(--jb-text-muted-color)",
            }}
          >
            Custom
          </Button>
        </div>

        {/* Content */}
        <div class="p-4 space-y-4">
          <Show when={tab() === "preset"}>
            {/* Name Input */}
            <div>
              <Input
                type="text"
                label="Server Name"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="My Context Server"
              />
            </div>

            {/* Preset Selection */}
            <div>
              <label class="block text-sm font-medium mb-1">Server Type</label>
              <div class="grid grid-cols-2 gap-2">
                <For each={presetEntries}>
                  {([key, config]) => (
                    <Button
                      onClick={() => setSelectedPreset(key)}
                      variant={selectedPreset() === key ? "primary" : "secondary"}
                      style={{
                        padding: "12px",
                        height: "auto",
                        "flex-direction": "column",
                        "align-items": "flex-start",
                        "text-align": "left",
                      }}
                    >
                      <div class="font-medium capitalize">{key}</div>
                      <div class="text-xs text-foreground-muted mt-1">
                        {config.command} {config.args?.slice(0, 2).join(" ")}...
                      </div>
                    </Button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={tab() === "custom"}>
            {/* Name Input */}
            <div>
              <Input
                type="text"
                label="Server Name"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="My Context Server"
              />
            </div>

            {/* Server Type */}
            <div>
              <label class="block text-sm font-medium mb-1">Transport Type</label>
              <select
                value={serverType()}
                onChange={(e) => setServerType(e.currentTarget.value as ServerType)}
                class="w-full px-3 py-2 rounded border border-border bg-background-tertiary focus:border-primary focus:outline-none"
              >
                <option value="stdio">Stdio (Local Process)</option>
                <option value="http">HTTP</option>
                <option value="sse">SSE (Server-Sent Events)</option>
              </select>
            </div>

            {/* Stdio Options */}
            <Show when={serverType() === "stdio"}>
              <div>
                <Input
                  type="text"
                  label="Command"
                  value={command()}
                  onInput={(e) => setCommand(e.currentTarget.value)}
                  placeholder="npx"
                />
              </div>
              <div>
                <Input
                  type="text"
                  label="Arguments"
                  value={args()}
                  onInput={(e) => setArgs(e.currentTarget.value)}
                  placeholder="-y @modelcontextprotocol/server-memory"
                />
              </div>
            </Show>

            {/* HTTP/SSE Options */}
            <Show when={serverType() !== "stdio"}>
              <div>
                <Input
                  type="text"
                  label="URL"
                  value={url()}
                  onInput={(e) => setUrl(e.currentTarget.value)}
                  placeholder="https://api.example.com/mcp"
                />
              </div>
            </Show>
          </Show>

          {/* Error Message */}
          <Show when={error()}>
            <div class="text-sm text-red-500 bg-red-500/10 rounded px-3 py-2">
              {error()}
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <Button
            onClick={props.onClose}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={tab() === "preset" ? handleAddPreset : handleAddCustom}
            disabled={loading() || !name() || (tab() === "preset" && !selectedPreset())}
            variant="primary"
            loading={loading()}
          >
            Add Server
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact context server selector for embedding in chat interfaces
 */
export function ContextServerSelector(props: {
  onSelect?: (serverId: string) => void;
  selectedIds?: string[];
}) {
  const contextServer = useContextServer();
  const connectedServers = createMemo(() => contextServer.getConnectedServers());

  return (
    <div class="flex items-center gap-1 flex-wrap">
      <For each={connectedServers()}>
        {(server) => {
          const isSelected = () => props.selectedIds?.includes(server.id);
          return (
            <Button
              onClick={() => props.onSelect?.(server.id)}
              variant={isSelected() ? "primary" : "ghost"}
              size="sm"
              icon={<Icon name="server" class="h-3 w-3" />}
              style={{
                "border-radius": "var(--jb-radius-full, 9999px)",
                padding: "2px 8px",
                height: "auto",
              }}
            >
              {server.name}
            </Button>
          );
        }}
      </For>
      <Show when={connectedServers().length === 0}>
        <span class="text-xs text-foreground-muted">No connected servers</span>
      </Show>
    </div>
  );
}

// =====================
// Tool Invocation Dialog
// =====================

interface ToolInvocationDialogProps {
  tool: Tool;
  onClose: () => void;
  onInvoke: (args: Record<string, unknown>) => Promise<void>;
  loading: boolean;
  result: { content: string; isError?: boolean } | null;
}

function ToolInvocationDialog(props: ToolInvocationDialogProps) {
  const [args, setArgs] = createSignal<Record<string, string>>({});

  const schema = () => {
    const inputSchema = props.tool.inputSchema as { properties?: Record<string, { type?: string; description?: string }>; required?: string[] } | undefined;
    return inputSchema || {};
  };

  const properties = () => schema().properties || {};
  const requiredFields = () => schema().required || [];

  const handleInputChange = (key: string, value: string) => {
    setArgs({ ...args(), [key]: value });
  };

  const handleInvoke = async () => {
    const parsedArgs: Record<string, unknown> = {};
    const currentArgs = args();

    for (const [key, value] of Object.entries(currentArgs)) {
      if (value.trim()) {
        const propSchema = properties()[key];
        if (propSchema?.type === "number") {
          parsedArgs[key] = parseFloat(value);
        } else if (propSchema?.type === "boolean") {
          parsedArgs[key] = value.toLowerCase() === "true";
        } else if (propSchema?.type === "object" || propSchema?.type === "array") {
          try {
            parsedArgs[key] = JSON.parse(value);
          } catch {
            parsedArgs[key] = value;
          }
        } else {
          parsedArgs[key] = value;
        }
      }
    }

    await props.onInvoke(parsedArgs);
  };

  const hasRequiredFields = () => {
    const required = requiredFields();
    const currentArgs = args();
    return required.every((field) => currentArgs[field]?.trim());
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-background-secondary border border-border rounded-lg w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div class="flex items-center gap-2">
            <Icon name="wrench" class="h-4 w-4" style={{ color: "var(--color-primary)" }} />
            <h3 class="font-medium">Invoke Tool</h3>
          </div>
          <IconButton
            onClick={props.onClose}
          >
            <Icon name="xmark" class="h-4 w-4" />
          </IconButton>
        </div>

        {/* Content */}
        <div class="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Tool Info */}
          <div>
            <div class="font-medium">{props.tool.name}</div>
            <Show when={props.tool.description}>
              <div class="text-sm text-foreground-muted mt-1">{props.tool.description}</div>
            </Show>
          </div>

          {/* Arguments */}
          <Show when={Object.keys(properties()).length > 0}>
            <div class="space-y-3">
              <div class="text-sm font-medium">Arguments</div>
              <For each={Object.entries(properties())}>
                {([key, propSchema]) => {
                  const isRequired = requiredFields().includes(key);
                  return (
                    <div>
                      <Input
                        type="text"
                        label={`${key}${isRequired ? " *" : ""}${propSchema.type ? ` (${propSchema.type})` : ""}`}
                        hint={propSchema.description}
                        value={args()[key] || ""}
                        onInput={(e) => handleInputChange(key, e.currentTarget.value)}
                        placeholder={propSchema.type === "object" || propSchema.type === "array" ? "JSON" : `Enter ${key}`}
                      />
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>

          <Show when={Object.keys(properties()).length === 0}>
            <div class="text-sm text-foreground-muted italic">This tool has no arguments.</div>
          </Show>

          {/* Result */}
          <Show when={props.result}>
            <div class="border-t border-border pt-4">
              <div class="text-sm font-medium mb-2">Result</div>
              <div
                class={`p-3 rounded text-xs font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto ${
                  props.result?.isError
                    ? "bg-red-500/10 text-red-500"
                    : "bg-background-tertiary"
                }`}
              >
                {props.result?.content || "No result"}
              </div>
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-border flex-shrink-0">
          <Button
            onClick={props.onClose}
            variant="secondary"
          >
            Close
          </Button>
          <Button
            onClick={handleInvoke}
            disabled={props.loading || !hasRequiredFields()}
            variant="primary"
            loading={props.loading}
            icon={<Icon name="play" class="h-4 w-4" />}
          >
            Invoke
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================
// Prompt Execution Dialog
// =====================

interface PromptExecutionDialogProps {
  prompt: Prompt;
  onClose: () => void;
  onExecute: (args: Record<string, string>) => Promise<void>;
  loading: boolean;
  result: string | null;
}

function PromptExecutionDialog(props: PromptExecutionDialogProps) {
  const [args, setArgs] = createSignal<Record<string, string>>({});

  const promptArgs = () => props.prompt.arguments || [];

  const handleInputChange = (name: string, value: string) => {
    setArgs({ ...args(), [name]: value });
  };

  const handleExecute = async () => {
    await props.onExecute(args());
  };

  const hasRequiredFields = () => {
    const currentArgs = args();
    return promptArgs()
      .filter((arg) => arg.required)
      .every((arg) => currentArgs[arg.name]?.trim());
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-background-secondary border border-border rounded-lg w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div class="flex items-center gap-2">
            <Icon name="message" class="h-4 w-4" style={{ color: "var(--color-primary)" }} />
            <h3 class="font-medium">Execute Prompt</h3>
          </div>
          <IconButton
            onClick={props.onClose}
          >
            <Icon name="xmark" class="h-4 w-4" />
          </IconButton>
        </div>

        {/* Content */}
        <div class="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Prompt Info */}
          <div>
            <div class="font-medium">{props.prompt.name}</div>
            <Show when={props.prompt.description}>
              <div class="text-sm text-foreground-muted mt-1">{props.prompt.description}</div>
            </Show>
          </div>

          {/* Arguments */}
          <Show when={promptArgs().length > 0}>
            <div class="space-y-3">
              <div class="text-sm font-medium">Arguments</div>
              <For each={promptArgs()}>
                {(arg) => (
                  <div>
                    <Input
                      type="text"
                      label={`${arg.name}${arg.required ? " *" : ""}`}
                      hint={arg.description}
                      value={args()[arg.name] || ""}
                      onInput={(e) => handleInputChange(arg.name, e.currentTarget.value)}
                      placeholder={`Enter ${arg.name}`}
                    />
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={promptArgs().length === 0}>
            <div class="text-sm text-foreground-muted italic">This prompt has no arguments.</div>
          </Show>

          {/* Result */}
          <Show when={props.result}>
            <div class="border-t border-border pt-4">
              <div class="text-sm font-medium mb-2">Result</div>
              <div class="p-3 rounded text-xs font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto bg-background-tertiary">
                {props.result || "No result"}
              </div>
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-border flex-shrink-0">
          <Button
            onClick={props.onClose}
            variant="secondary"
          >
            Close
          </Button>
          <Button
            onClick={handleExecute}
            disabled={props.loading || !hasRequiredFields()}
            variant="primary"
            loading={props.loading}
            icon={<Icon name="play" class="h-4 w-4" />}
          >
            Execute
          </Button>
        </div>
      </div>
    </div>
  );
}

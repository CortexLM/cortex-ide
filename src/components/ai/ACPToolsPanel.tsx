/**
 * ACP Tools Panel Component
 *
 * UI for managing ACP (Agent Communication Protocol) tools including
 * registration, discovery, execution, and history viewing.
 */

import { createSignal, For, Show, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { Button, IconButton, Input, Textarea } from "@/components/ui";
import {
  useACP,
  type ACPTool,
  type ToolExecutionResult,
  type ToolPermission,
  type ToolExecutionStatus,
  type ToolParameter,
  validateToolArguments,
  createTool,
} from "@/context/ACPContext";

interface ACPToolsPanelProps {
  onToolSelect?: (tool: ACPTool) => void;
  onToolExecute?: (result: ToolExecutionResult) => void;
  compact?: boolean;
}

export function ACPToolsPanel(props: ACPToolsPanelProps) {
  const acp = useACP();

  const [activeTab, setActiveTab] = createSignal<"tools" | "history" | "settings">("tools");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showAddDialog, setShowAddDialog] = createSignal(false);
  const [selectedTool, setSelectedTool] = createSignal<ACPTool | null>(null);
  const [showExecuteDialog, setShowExecuteDialog] = createSignal(false);
  const [expandedTools, setExpandedTools] = createSignal<Set<string>>(new Set());

  const filteredTools = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return acp.listTools();
    return acp.searchTools(query);
  });

  const groupedTools = createMemo(() => {
    const tools = filteredTools();
    const groups: Record<string, ACPTool[]> = {
      builtin: [],
      extension: [],
      mcp: [],
      custom: [],
    };

    for (const tool of tools) {
      if (groups[tool.source]) {
        groups[tool.source].push(tool);
      }
    }

    return groups;
  });

  const toggleToolExpanded = (toolId: string) => {
    const expanded = new Set(expandedTools());
    if (expanded.has(toolId)) {
      expanded.delete(toolId);
    } else {
      expanded.add(toolId);
    }
    setExpandedTools(expanded);
  };

  const handleToolSelect = (tool: ACPTool) => {
    setSelectedTool(tool);
    props.onToolSelect?.(tool);
  };

  const handleExecuteTool = (tool: ACPTool) => {
    setSelectedTool(tool);
    setShowExecuteDialog(true);
  };

  const handleToggleEnabled = async (tool: ACPTool) => {
    try {
      if (tool.enabled) {
        await acp.disableTool(tool.id);
      } else {
        await acp.enableTool(tool.id);
      }
    } catch (e) {
      console.error("Failed to toggle tool:", e);
    }
  };

  const handleDeleteTool = async (tool: ACPTool) => {
    if (tool.source !== "custom") return;
    try {
      await acp.unregisterTool(tool.id);
    } catch (e) {
      console.error("Failed to delete tool:", e);
    }
  };

  const getPermissionIcon = (permission: ToolPermission) => {
    switch (permission) {
      case "read":
        return <Icon name="file" class="h-3 w-3" />;
      case "write":
        return <Icon name="pen" class="h-3 w-3" />;
      case "network":
        return <Icon name="globe" class="h-3 w-3" />;
      case "execute":
        return <Icon name="terminal" class="h-3 w-3" />;
      case "filesystem":
        return <Icon name="folder" class="h-3 w-3" />;
    }
  };

  const getSourceLabel = (source: ACPTool["source"]): string => {
    switch (source) {
      case "builtin":
        return "Built-in";
      case "extension":
        return "Extension";
      case "mcp":
        return "MCP Server";
      case "custom":
        return "Custom";
    }
  };

  return (
    <div class={`flex flex-col h-full ${props.compact ? "text-sm" : ""}`}>
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <div class="flex items-center gap-2">
          <Icon name="wrench" class="h-4 w-4" style={{ color: "var(--color-primary)" }} />
          <span class="font-medium">ACP Tools</span>
          <span class="text-xs text-foreground-muted">({acp.listTools().length})</span>
        </div>
        <div class="flex items-center gap-1">
          <IconButton
            onClick={() => setShowAddDialog(true)}
            variant="ghost"
            size="sm"
            tooltip="Add Tool"
          >
            <Icon name="plus" style={{ width: "16px", height: "16px" }} />
          </IconButton>
          <IconButton
            onClick={() => setActiveTab(activeTab() === "settings" ? "tools" : "settings")}
            variant={activeTab() === "settings" ? "ghost" : "ghost"}
            active={activeTab() === "settings"}
            size="sm"
            tooltip="Settings"
          >
            <Icon name="gear" style={{ width: "16px", height: "16px" }} />
          </IconButton>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex border-b border-border">
        <Button
          onClick={() => setActiveTab("tools")}
          variant="ghost"
          size="sm"
          class={`flex-1 rounded-none text-xs font-medium ${
            activeTab() === "tools"
              ? "border-b-2 border-primary text-primary"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          Tools
        </Button>
        <Button
          onClick={() => setActiveTab("history")}
          variant="ghost"
          size="sm"
          class={`flex-1 rounded-none text-xs font-medium ${
            activeTab() === "history"
              ? "border-b-2 border-primary text-primary"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          History
        </Button>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        <Show when={activeTab() === "tools"}>
          {/* Search */}
          <div class="p-2 border-b border-border">
            <div class="relative">
              <Icon name="magnifying-glass" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted z-10" />
              <Input
                type="text"
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="Search tools..."
                class="w-full pl-8"
                size="sm"
              />
            </div>
          </div>

          {/* Tool Groups */}
          <For each={Object.entries(groupedTools())}>
            {([source, tools]) => (
              <Show when={tools.length > 0}>
                <div class="border-b border-border">
                  <div class="px-3 py-2 bg-background-tertiary text-xs font-medium text-foreground-muted">
                    {getSourceLabel(source as ACPTool["source"])} ({tools.length})
                  </div>
                  <For each={tools}>
                    {(tool) => (
                      <ToolItem
                        tool={tool}
                        expanded={expandedTools().has(tool.id)}
                        onToggleExpand={() => toggleToolExpanded(tool.id)}
                        onSelect={() => handleToolSelect(tool)}
                        onExecute={() => handleExecuteTool(tool)}
                        onToggleEnabled={() => handleToggleEnabled(tool)}
                        onDelete={() => handleDeleteTool(tool)}
                        getPermissionIcon={getPermissionIcon}
                      />
                    )}
                  </For>
                </div>
              </Show>
            )}
          </For>

          <Show when={filteredTools().length === 0}>
            <div class="flex flex-col items-center justify-center p-4 text-center text-foreground-muted">
              <Icon name="wrench" class="h-8 w-8 mb-2 opacity-50" />
              <p class="text-sm">
                {searchQuery() ? "No tools match your search" : "No tools registered"}
              </p>
              <Button
                onClick={() => setShowAddDialog(true)}
                variant="ghost"
                size="sm"
                style={{ "margin-top": "8px", color: "var(--jb-border-focus)" }}
              >
                Add a custom tool
              </Button>
            </div>
          </Show>
        </Show>

        <Show when={activeTab() === "history"}>
          <ExecutionHistory
            history={acp.getHistory(50)}
            onClear={() => acp.clearHistory()}
          />
        </Show>

        <Show when={activeTab() === "settings"}>
          <SandboxSettings
            config={acp.getSandboxConfig()}
            onUpdate={acp.updateSandboxConfig}
          />
        </Show>
      </div>

      {/* Add Tool Dialog */}
      <Show when={showAddDialog()}>
        <AddToolDialog onClose={() => setShowAddDialog(false)} />
      </Show>

      {/* Execute Tool Dialog */}
      <Show when={showExecuteDialog() && selectedTool()}>
        <ExecuteToolDialog
          tool={selectedTool()!}
          onClose={() => setShowExecuteDialog(false)}
          onResult={(result) => {
            setShowExecuteDialog(false);
            props.onToolExecute?.(result);
          }}
        />
      </Show>
    </div>
  );
}

// =====================
// Tool Item Component
// =====================

interface ToolItemProps {
  tool: ACPTool;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onExecute: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  getPermissionIcon: (permission: ToolPermission) => any;
}

function ToolItem(props: ToolItemProps) {
  return (
    <div class="border-b border-border last:border-b-0">
      <div
        class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-background-tertiary transition-colors"
        onClick={props.onToggleExpand}
      >
        {props.expanded ? (
          <Icon name="chevron-down" class="h-4 w-4 flex-shrink-0" />
        ) : (
          <Icon name="chevron-right" class="h-4 w-4 flex-shrink-0" />
        )}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span
              class={`font-medium truncate ${
                props.tool.enabled ? "" : "text-foreground-muted line-through"
              }`}
            >
              {props.tool.name}
            </span>
            <Show when={props.tool.annotations?.destructiveHint}>
              <span class="text-xs px-1 py-0.5 rounded bg-red-500/10 text-red-500">
                destructive
              </span>
            </Show>
            <Show when={props.tool.annotations?.readOnlyHint}>
              <span class="text-xs px-1 py-0.5 rounded bg-blue-500/10 text-blue-500">
                read-only
              </span>
            </Show>
          </div>
          <Show when={props.tool.description}>
            <div class="text-xs text-foreground-muted truncate">{props.tool.description}</div>
          </Show>
        </div>
        <div class="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <IconButton
            onClick={props.onExecute}
            disabled={!props.tool.enabled}
            variant="ghost"
            size="sm"
            tooltip="Execute"
          >
            <Icon name="play" style={{ width: "12px", height: "12px", color: "var(--cortex-success)" }} />
          </IconButton>
          <IconButton
            onClick={props.onToggleEnabled}
            variant="ghost"
            size="sm"
            tooltip={props.tool.enabled ? "Disable" : "Enable"}
          >
            {props.tool.enabled ? (
              <Icon name="toggle-on" style={{ width: "16px", height: "16px", color: "var(--jb-border-focus)" }} />
            ) : (
              <Icon name="toggle-off" style={{ width: "16px", height: "16px", color: "var(--jb-text-muted-color)" }} />
            )}
          </IconButton>
          <Show when={props.tool.source === "custom"}>
            <IconButton
              onClick={props.onDelete}
              variant="ghost"
              size="sm"
              tooltip="Delete"
            >
              <Icon name="trash" style={{ width: "12px", height: "12px", color: "var(--cortex-error)" }} />
            </IconButton>
          </Show>
        </div>
      </div>

      <Show when={props.expanded}>
        <div class="px-6 pb-3 space-y-2">
          {/* Permissions */}
          <div class="flex items-center gap-2">
            <span class="text-xs text-foreground-muted">Permissions:</span>
            <div class="flex items-center gap-1">
              <For each={props.tool.permissions}>
                {(permission) => (
                  <span
                    class="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-background-tertiary"
                    title={permission}
                  >
                    {props.getPermissionIcon(permission)}
                    <span class="capitalize">{permission}</span>
                  </span>
                )}
              </For>
              <Show when={props.tool.permissions.length === 0}>
                <span class="text-xs text-foreground-muted italic">None required</span>
              </Show>
            </div>
          </div>

          {/* Parameters */}
          <div>
            <span class="text-xs text-foreground-muted">Parameters:</span>
            <div class="mt-1 space-y-1">
              <For each={Object.entries(props.tool.inputSchema.properties)}>
                {([name, param]) => (
                  <div class="flex items-center gap-2 text-xs pl-2">
                    <span class="font-mono text-primary">{name}</span>
                    <span class="text-foreground-muted">({param.type})</span>
                    <Show when={props.tool.inputSchema.required?.includes(name)}>
                      <span class="text-red-500">*</span>
                    </Show>
                    <Show when={param.description}>
                      <span class="text-foreground-muted truncate">- {param.description}</span>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={Object.keys(props.tool.inputSchema.properties).length === 0}>
                <div class="text-xs text-foreground-muted italic pl-2">No parameters</div>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// =====================
// Execution History Component
// =====================

interface ExecutionHistoryProps {
  history: ToolExecutionResult[];
  onClear: () => void;
}

function ExecutionHistory(props: ExecutionHistoryProps) {
  const acp = useACP();

  const getStatusIcon = (status: ToolExecutionStatus) => {
    switch (status) {
      case "completed":
        return <Icon name="check" class="h-3 w-3 text-green-500" />;
      case "running":
        return <Icon name="spinner" class="h-3 w-3 text-yellow-500 animate-spin" />;
      case "error":
        return <Icon name="xmark" class="h-3 w-3 text-red-500" />;
      case "cancelled":
        return <Icon name="pause" class="h-3 w-3 text-foreground-muted" />;
      default:
        return <Icon name="clock" class="h-3 w-3 text-foreground-muted" />;
    }
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between px-3 py-2 border-b border-border bg-background-tertiary">
        <span class="text-xs font-medium">Execution History ({props.history.length})</span>
        <Button
          onClick={props.onClear}
          disabled={props.history.length === 0}
          variant="ghost"
          size="sm"
          class="text-xs text-foreground-muted hover:text-foreground"
        >
          Clear
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show
          when={props.history.length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center p-4 text-center text-foreground-muted">
              <Icon name="clock" class="h-8 w-8 mb-2 opacity-50" />
              <p class="text-sm">No executions yet</p>
            </div>
          }
        >
          <For each={props.history}>
            {(execution) => {
              const tool = acp.getTool(execution.toolId);
              return (
                <div class="flex items-start gap-2 px-3 py-2 border-b border-border hover:bg-background-tertiary">
                  {getStatusIcon(execution.status)}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-sm truncate">
                        {tool?.name || execution.toolId}
                      </span>
                      <span class="text-xs text-foreground-muted">
                        {formatTime(execution.startedAt)}
                      </span>
                    </div>
                    <div class="text-xs text-foreground-muted">
                      Duration: {formatDuration(execution.durationMs)}
                    </div>
                    <Show when={execution.isError}>
                      <div class="text-xs text-red-500 mt-1">
                        {(() => {
                          const errorContent = execution.content.find((c) => c.type === "error");
                          return errorContent && "message" in errorContent 
                            ? (errorContent as { type: "error"; message: string }).message 
                            : "Unknown error";
                        })()}
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
}

// =====================
// Sandbox Settings Component
// =====================

interface SandboxConfig {
  allowNetwork: boolean;
  allowFilesystem: boolean;
  allowExecution: boolean;
  timeout: number;
  maxOutputSize: number;
  workingDirectory?: string;
}

interface SandboxSettingsProps {
  config: SandboxConfig;
  onUpdate: (config: Partial<SandboxConfig>) => void;
}

function SandboxSettings(props: SandboxSettingsProps) {
  return (
    <div class="p-4 space-y-4">
      <h3 class="font-medium text-sm">Sandbox Configuration</h3>
      <p class="text-xs text-foreground-muted">
        Configure security settings for tool execution
      </p>

      <div class="space-y-3">
        {/* Network Access */}
        <label class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="globe" class="h-4 w-4" />
            <span class="text-sm">Allow Network Access</span>
          </div>
          <IconButton
            onClick={() => props.onUpdate({ allowNetwork: !props.config.allowNetwork })}
            variant="ghost"
            size="sm"
          >
            {props.config.allowNetwork ? (
              <Icon name="toggle-on" style={{ width: "20px", height: "20px", color: "var(--jb-border-focus)" }} />
            ) : (
              <Icon name="toggle-off" style={{ width: "20px", height: "20px", color: "var(--jb-text-muted-color)" }} />
            )}
          </IconButton>
        </label>

        {/* Filesystem Access */}
        <label class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="folder" class="h-4 w-4" />
            <span class="text-sm">Allow Filesystem Access</span>
          </div>
          <IconButton
            onClick={() => props.onUpdate({ allowFilesystem: !props.config.allowFilesystem })}
            variant="ghost"
            size="sm"
          >
            {props.config.allowFilesystem ? (
              <Icon name="toggle-on" style={{ width: "20px", height: "20px", color: "var(--jb-border-focus)" }} />
            ) : (
              <Icon name="toggle-off" style={{ width: "20px", height: "20px", color: "var(--jb-text-muted-color)" }} />
            )}
          </IconButton>
        </label>

        {/* Command Execution */}
        <label class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="terminal" class="h-4 w-4" />
            <span class="text-sm">Allow Command Execution</span>
          </div>
          <IconButton
            onClick={() => props.onUpdate({ allowExecution: !props.config.allowExecution })}
            variant="ghost"
            size="sm"
          >
            {props.config.allowExecution ? (
              <Icon name="toggle-on" style={{ width: "20px", height: "20px", color: "var(--jb-border-focus)" }} />
            ) : (
              <Icon name="toggle-off" style={{ width: "20px", height: "20px", color: "var(--jb-text-muted-color)" }} />
            )}
          </IconButton>
        </label>

        {/* Timeout */}
        <div>
          <label class="block text-sm mb-1">Execution Timeout (ms)</label>
          <Input
            type="number"
            value={props.config.timeout}
            onInput={(e) =>
              props.onUpdate({ timeout: parseInt(e.currentTarget.value) || 30000 })
            }
            size="sm"
          />
        </div>

        {/* Max Output Size */}
        <div>
          <label class="block text-sm mb-1">Max Output Size (bytes)</label>
          <Input
            type="number"
            value={props.config.maxOutputSize}
            onInput={(e) =>
              props.onUpdate({ maxOutputSize: parseInt(e.currentTarget.value) || 1048576 })
            }
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

// =====================
// Add Tool Dialog
// =====================

interface AddToolDialogProps {
  onClose: () => void;
}

function AddToolDialog(props: AddToolDialogProps) {
  const acp = useACP();

  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [parameters, setParameters] = createSignal<
    { name: string; type: string; description: string; required: boolean }[]
  >([]);
  const [permissions, setPermissions] = createSignal<ToolPermission[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const addParameter = () => {
    setParameters([
      ...parameters(),
      { name: "", type: "string", description: "", required: false },
    ]);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters().filter((_, i) => i !== index));
  };

  /** Update a specific field on a tool parameter */
  const updateParameter = (
    index: number,
    field: "name" | "type" | "description" | "required",
    value: string | boolean
  ) => {
    setParameters(params => params.map((param, i) => 
      i === index ? { ...param, [field]: value } : param
    ));
  };

  const togglePermission = (permission: ToolPermission) => {
    const perms = permissions();
    if (perms.includes(permission)) {
      setPermissions(perms.filter((p) => p !== permission));
    } else {
      setPermissions([...perms, permission]);
    }
  };

  const handleSubmit = async () => {
    if (!name().trim()) {
      setError("Tool name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const inputProperties: Record<string, ToolParameter> = {};
      const requiredFields: string[] = [];

      for (const param of parameters()) {
        if (param.name.trim()) {
          inputProperties[param.name] = {
            name: param.name,
            type: param.type as ToolParameter["type"],
            description: param.description || undefined,
          };
          if (param.required) {
            requiredFields.push(param.name);
          }
        }
      }

      const tool = createTool(name(), description(), inputProperties, {
        required: requiredFields.length > 0 ? requiredFields : undefined,
        permissions: permissions(),
      });

      await acp.registerTool(tool);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const allPermissions: ToolPermission[] = [
    "read",
    "write",
    "network",
    "execute",
    "filesystem",
  ];

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-background-secondary border border-border rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h3 class="font-medium">Add Custom Tool</h3>
          <IconButton
            onClick={props.onClose}
            variant="ghost"
            size="sm"
          >
            <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
          </IconButton>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label class="block text-sm font-medium mb-1">Tool Name *</label>
            <Input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="my_custom_tool"
            />
          </div>

          {/* Description */}
          <div>
            <label class="block text-sm font-medium mb-1">Description</label>
            <Textarea
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="What does this tool do?"
              rows={2}
              class="resize-none"
            />
          </div>

          {/* Parameters */}
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium">Parameters</label>
              <Button
                onClick={addParameter}
                variant="ghost"
                size="sm"
                icon={<Icon name="plus" style={{ width: "12px", height: "12px" }} />}
                style={{ color: "var(--jb-border-focus)" }}
              >
                Add Parameter
              </Button>
            </div>
            <div class="space-y-2">
              <For each={parameters()}>
                {(param, index) => (
                  <div class="flex items-start gap-2 p-2 rounded bg-background-tertiary">
                    <div class="flex-1 space-y-2">
                      <div class="flex gap-2">
                        <Input
                          type="text"
                          value={param.name}
                          onInput={(e) =>
                            updateParameter(index(), "name", e.currentTarget.value)
                          }
                          placeholder="Parameter name"
                          size="sm"
                          class="flex-1"
                        />
                        <select
                          value={param.type}
                          onChange={(e) =>
                            updateParameter(index(), "type", e.currentTarget.value)
                          }
                          class="px-2 py-1 text-sm rounded border border-border bg-background-secondary focus:border-primary focus:outline-none"
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="array">array</option>
                          <option value="object">object</option>
                        </select>
                      </div>
                      <Input
                        type="text"
                        value={param.description}
                        onInput={(e) =>
                          updateParameter(index(), "description", e.currentTarget.value)
                        }
                        placeholder="Description"
                        size="sm"
                      />
                      <label class="flex items-center gap-2 text-xs">
                        <Input
                          type="checkbox"
                          checked={param.required}
                          onChange={(e) =>
                            updateParameter(index(), "required", e.currentTarget.checked)
                          }
                          class="w-4 h-4 rounded"
                        />
                        Required
                      </label>
                    </div>
                    <IconButton
                      onClick={() => removeParameter(index())}
                      variant="ghost"
                      size="sm"
                      style={{ color: "var(--cortex-error)" }}
                    >
                      <Icon name="trash" style={{ width: "16px", height: "16px" }} />
                    </IconButton>
                  </div>
                )}
              </For>
              <Show when={parameters().length === 0}>
                <p class="text-xs text-foreground-muted text-center py-2">
                  No parameters defined
                </p>
              </Show>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <label class="block text-sm font-medium mb-2">Required Permissions</label>
            <div class="flex flex-wrap gap-2">
              <For each={allPermissions}>
                {(permission) => (
                  <Button
                    onClick={() => togglePermission(permission)}
                    variant={permissions().includes(permission) ? "primary" : "secondary"}
                    size="sm"
                    class={`text-xs ${
                      permissions().includes(permission)
                        ? ""
                        : "bg-background-tertiary hover:bg-background-secondary"
                    }`}
                  >
                    <span class="capitalize">{permission}</span>
                  </Button>
                )}
              </For>
            </div>
          </div>

          {/* Error */}
          <Show when={error()}>
            <div class="text-sm text-red-500 bg-red-500/10 rounded px-3 py-2">
              {error()}
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-border flex-shrink-0">
          <Button
            onClick={props.onClose}
            variant="secondary"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading() || !name().trim()}
            variant="primary"
            size="sm"
            class="flex items-center gap-2"
          >
            <Show when={loading()}>
              <Icon name="spinner" class="h-4 w-4 animate-spin" />
            </Show>
            Add Tool
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================
// Execute Tool Dialog
// =====================

interface ExecuteToolDialogProps {
  tool: ACPTool;
  onClose: () => void;
  onResult: (result: ToolExecutionResult) => void;
}

function ExecuteToolDialog(props: ExecuteToolDialogProps) {
  const acp = useACP();

  const [args, setArgs] = createSignal<Record<string, unknown>>({});
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [result, setResult] = createSignal<ToolExecutionResult | null>(null);

  const updateArg = (name: string, value: unknown) => {
    setArgs({ ...args(), [name]: value });
  };

  const handleExecute = async () => {
    setError(null);

    const validation = validateToolArguments(props.tool, args());
    if (!validation.valid) {
      setError(validation.errors.join("\n"));
      return;
    }

    setLoading(true);

    try {
      const execResult = await acp.executeTool({
        toolId: props.tool.id,
        arguments: args(),
      });
      setResult(execResult);
      props.onResult(execResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const getInputForType = (
    name: string,
    param: ToolParameter,
    value: unknown
  ) => {
    switch (param.type) {
      case "boolean":
        return (
          <IconButton
            onClick={() => updateArg(name, !value)}
            variant="ghost"
            size="sm"
          >
            {value ? (
              <Icon name="toggle-on" style={{ width: "20px", height: "20px", color: "var(--jb-border-focus)" }} />
            ) : (
              <Icon name="toggle-off" style={{ width: "20px", height: "20px", color: "var(--jb-text-muted-color)" }} />
            )}
          </IconButton>
        );
      case "number":
        return (
          <Input
            type="number"
            value={value as number || ""}
            onInput={(e) => updateArg(name, parseFloat(e.currentTarget.value) || 0)}
            placeholder={param.default?.toString()}
            size="sm"
            class="flex-1"
          />
        );
      default:
        if (param.enum) {
          return (
            <select
              value={value as string || ""}
              onChange={(e) => updateArg(name, e.currentTarget.value)}
              class="flex-1 px-3 py-2 rounded border border-border bg-background-tertiary focus:border-primary focus:outline-none text-sm"
            >
              <option value="">Select...</option>
              <For each={param.enum as string[]}>
                {(opt) => <option value={opt}>{opt}</option>}
              </For>
            </select>
          );
        }
        return (
          <Input
            type="text"
            value={value as string || ""}
            onInput={(e) => updateArg(name, e.currentTarget.value)}
            placeholder={param.description || param.default?.toString()}
            size="sm"
            class="flex-1"
          />
        );
    }
  };

  const formatResultContent = (content: ToolExecutionResult["content"]) => {
    return content
      .map((c) => {
        if (c.type === "text") return c.text;
        if (c.type === "json") return JSON.stringify(c.data, null, 2);
        if (c.type === "error") return `Error: ${c.message}`;
        return "";
      })
      .join("\n");
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-background-secondary border border-border rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div>
            <h3 class="font-medium">Execute: {props.tool.name}</h3>
            <Show when={props.tool.description}>
              <p class="text-xs text-foreground-muted mt-0.5">
                {props.tool.description}
              </p>
            </Show>
          </div>
          <IconButton
            onClick={props.onClose}
            variant="ghost"
            size="sm"
          >
            <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
          </IconButton>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Parameters */}
          <Show when={Object.keys(props.tool.inputSchema.properties).length > 0}>
            <div class="space-y-3">
              <For each={Object.entries(props.tool.inputSchema.properties)}>
                {([name, param]) => (
                  <div>
                    <label class="flex items-center gap-1 text-sm font-medium mb-1">
                      <span>{name}</span>
                      <Show when={props.tool.inputSchema.required?.includes(name)}>
                        <span class="text-red-500">*</span>
                      </Show>
                      <span class="text-foreground-muted font-normal">
                        ({param.type})
                      </span>
                    </label>
                    <Show when={param.description}>
                      <p class="text-xs text-foreground-muted mb-1">
                        {param.description}
                      </p>
                    </Show>
                    {getInputForType(name, param, args()[name])}
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={Object.keys(props.tool.inputSchema.properties).length === 0}>
            <p class="text-sm text-foreground-muted text-center py-2">
              This tool has no parameters
            </p>
          </Show>

          {/* Error */}
          <Show when={error()}>
            <div class="text-sm text-red-500 bg-red-500/10 rounded px-3 py-2 whitespace-pre-wrap">
              {error()}
            </div>
          </Show>

          {/* Result */}
          <Show when={result()}>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">Result</span>
                <Show when={result()?.isError}>
                  <span class="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">
                    Error
                  </span>
                </Show>
                <Show when={!result()?.isError}>
                  <span class="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">
                    Success
                  </span>
                </Show>
                <span class="text-xs text-foreground-muted">
                  {result()?.durationMs}ms
                </span>
              </div>
              <pre class="text-xs bg-background-tertiary rounded p-3 overflow-x-auto max-h-48">
                {formatResultContent(result()?.content || [])}
              </pre>
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-border flex-shrink-0">
          <Button
            onClick={props.onClose}
            variant="secondary"
            size="sm"
          >
            Close
          </Button>
          <Button
            onClick={handleExecute}
            disabled={loading()}
            variant="primary"
            size="sm"
            class="flex items-center gap-2"
          >
            <Show when={loading()}>
              <Icon name="spinner" class="h-4 w-4 animate-spin" />
            </Show>
            <Show when={!loading()}>
              <Icon name="play" class="h-4 w-4" />
            </Show>
            Execute
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact tool selector for embedding in chat interfaces
 */
export function ACPToolSelector(props: {
  onSelect?: (tool: ACPTool) => void;
  filter?: (tool: ACPTool) => boolean;
}) {
  const acp = useACP();
  const tools = createMemo(() => {
    const allTools = acp.listTools().filter((t) => t.enabled);
    return props.filter ? allTools.filter(props.filter) : allTools;
  });

  return (
    <div class="flex items-center gap-1 flex-wrap">
      <For each={tools()}>
        {(tool) => (
          <Button
            onClick={() => props.onSelect?.(tool)}
            variant="secondary"
            size="sm"
            class="flex items-center gap-1 rounded-full text-xs bg-background-tertiary hover:bg-background-secondary"
            title={tool.description}
          >
            <Icon name="wrench" class="h-3 w-3" />
            <span>{tool.name}</span>
          </Button>
        )}
      </For>
      <Show when={tools().length === 0}>
        <span class="text-xs text-foreground-muted">No tools available</span>
      </Show>
    </div>
  );
}

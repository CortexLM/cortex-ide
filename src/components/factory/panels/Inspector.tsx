/**
 * =============================================================================
 * INSPECTOR PANEL - Node Configuration
 * =============================================================================
 * 
 * A dynamic configuration panel that shows when a node is selected in the
 * Agent Factory canvas. Provides type-specific forms for configuring node
 * properties including agents, triggers, actions, and logic nodes.
 * 
 * Features:
 * - Dynamic form generation based on node type
 * - Agent config: model, temperature, tools, permissions, prompts
 * - Trigger config: type, patterns, debounce
 * - Action config: command/url/path inputs, timeout
 * - Logic config: expression editor, output labels
 * - Validation with error display
 * - Apply/Reset functionality
 * 
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  For,
  Show,
  JSX,
} from "solid-js";
import { Input, Textarea } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Checkbox } from "../../ui/Checkbox";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";


// =============================================================================
// TYPES
// =============================================================================

export type FactoryNodeType = "trigger" | "agent" | "action" | "logic" | "communication" | "utility";

export interface FactoryNode {
  id: string;
  type: FactoryNodeType;
  subtype: string;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface InspectorProps {
  /** Currently selected node */
  selectedNode?: FactoryNode | null;
  /** Callback when config is applied */
  onApply?: (nodeId: string, config: Record<string, unknown>) => void;
  /** Callback when config is reset */
  onReset?: (nodeId: string) => void;
  /** Callback when node label is changed */
  onLabelChange?: (nodeId: string, label: string) => void;
  /** Callback when node is deleted */
  onDelete?: (nodeId: string) => void;
  /** Available tools for agent nodes */
  availableTools?: string[];
  /** Available models for agent nodes */
  availableModels?: { value: string; label: string }[];
  /** Whether the panel is loading */
  loading?: boolean;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MODELS = [
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku" },
];

const DEFAULT_TOOLS = [
  "file_read",
  "file_write",
  "file_edit",
  "shell_execute",
  "web_search",
  "web_fetch",
  "code_analysis",
  "git_operations",
];

const TRIGGER_TYPES = [
  { value: "file_watch", label: "File Watch" },
  { value: "schedule", label: "Schedule (Cron)" },
  { value: "webhook", label: "Webhook" },
  { value: "manual", label: "Manual Trigger" },
  { value: "event", label: "Event Listener" },
];

const ACTION_TYPES = [
  { value: "command", label: "Run Command" },
  { value: "api", label: "API Request" },
  { value: "file", label: "File Operation" },
  { value: "script", label: "Run Script" },
];

const LOGIC_TYPES = [
  { value: "condition", label: "Condition (If/Else)" },
  { value: "switch", label: "Switch (Multi-branch)" },
  { value: "loop", label: "Loop (Iterate)" },
  { value: "parallel", label: "Parallel (Fan-out)" },
];

// =============================================================================
// SECTION HEADER COMPONENT
// =============================================================================

interface SectionHeaderProps {
  title: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: JSX.Element;
}

function CollapsibleSection(props: SectionHeaderProps) {
  const [collapsed, setCollapsed] = createSignal(props.defaultCollapsed ?? false);

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    padding: "10px 12px",
    cursor: props.collapsible ? "pointer" : "default",
    "user-select": "none",
    "border-bottom": "1px solid var(--jb-border-divider)",
    background: "var(--jb-surface-panel)",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--jb-text-header-color)",
    flex: "1",
  };

  const contentStyle: JSX.CSSProperties = {
    padding: "12px",
    display: collapsed() ? "none" : "block",
  };

  return (
    <div>
      <div
        style={headerStyle}
        onClick={() => props.collapsible && setCollapsed(!collapsed())}
        onKeyDown={(e) => {
          if (props.collapsible && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setCollapsed(!collapsed());
          }
        }}
        tabIndex={props.collapsible ? 0 : -1}
        role={props.collapsible ? "button" : undefined}
        aria-expanded={props.collapsible ? !collapsed() : undefined}
      >
        <Show when={props.collapsible}>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            style={{
              transform: collapsed() ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform var(--cortex-transition-fast)",
              color: "var(--jb-icon-color-default)",
            }}
          >
            <path d="M2 3l3 3.5L8 3v1L5 7.5 2 4V3z" />
          </svg>
        </Show>
        <span style={titleStyle}>{props.title}</span>
      </div>
      <div style={contentStyle}>{props.children}</div>
    </div>
  );
}

// =============================================================================
// AGENT CONFIG COMPONENT
// =============================================================================

interface AgentConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  availableTools?: string[];
  availableModels?: { value: string; label: string }[];
  errors?: ValidationError[];
}

function AgentConfig(props: AgentConfigProps) {
  const tools = () => props.availableTools || DEFAULT_TOOLS;
  const models = () => props.availableModels || DEFAULT_MODELS;

  const selectedTools = () => (props.config.tools as string[]) || [];
  const temperature = () => (props.config.temperature as number) ?? 0.7;
  const maxSteps = () => (props.config.maxSteps as number) ?? 10;
  const systemPrompt = () => (props.config.systemPrompt as string) || "";

  const getError = (field: string) => props.errors?.find((e) => e.field === field)?.message;

  const updateConfig = (field: string, value: unknown) => {
    props.onChange({ ...props.config, [field]: value });
  };

  const toggleTool = (tool: string) => {
    const current = selectedTools();
    const next = current.includes(tool)
      ? current.filter((t) => t !== tool)
      : [...current, tool];
    updateConfig("tools", next);
  };

  const fieldStyle: JSX.CSSProperties = {
    "margin-bottom": "16px",
  };

  const rangeContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
  };

  const rangeStyle: JSX.CSSProperties = {
    flex: "1",
    height: "4px",
    appearance: "none",
    background: "var(--jb-canvas)",
    "border-radius": "var(--cortex-radius-sm)",
    outline: "none",
  };

  const rangeValueStyle: JSX.CSSProperties = {
    "min-width": "40px",
    "text-align": "right",
    "font-size": "var(--jb-text-body-size)",
    color: "var(--jb-text-body-color)",
    "font-family": "var(--jb-font-mono)",
  };

  const toolsGridStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "repeat(2, 1fr)",
    gap: "8px",
  };

  return (
    <>
      <CollapsibleSection title="Model Settings" collapsible>
        <div style={fieldStyle}>
          <Select
            options={models()}
            value={(props.config.model as string) || "gpt-4"}
            onChange={(value) => updateConfig("model", value)}
            placeholder="Select model..."
          />
          <Show when={getError("model")}>
            <span style={{ color: "var(--cortex-error)", "font-size": "11px", "margin-top": "4px", display: "block" }}>
              {getError("model")}
            </span>
          </Show>
        </div>

        <div style={fieldStyle}>
          <label style={{ "font-size": "var(--jb-text-muted-size)", color: "var(--jb-text-muted-color)", display: "block", "margin-bottom": "6px" }}>
            Temperature
          </label>
          <div style={rangeContainerStyle}>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature()}
              onInput={(e) => updateConfig("temperature", parseFloat(e.currentTarget.value))}
              style={rangeStyle}
            />
            <span style={rangeValueStyle}>{temperature().toFixed(1)}</span>
          </div>
        </div>

        <div style={fieldStyle}>
          <Input
            label="Max Steps"
            type="number"
            value={String(maxSteps())}
            onInput={(e) => updateConfig("maxSteps", parseInt(e.currentTarget.value) || 10)}
            min={1}
            max={100}
            error={getError("maxSteps")}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Tools & Permissions" collapsible>
        <div style={toolsGridStyle}>
          <For each={tools()}>
            {(tool) => (
              <Checkbox
                checked={selectedTools().includes(tool)}
                onChange={() => toggleTool(tool)}
                label={tool.replace(/_/g, " ")}
              />
            )}
          </For>
        </div>
        <Show when={getError("tools")}>
          <span style={{ color: "var(--cortex-error)", "font-size": "11px", "margin-top": "8px", display: "block" }}>
            {getError("tools")}
          </span>
        </Show>
      </CollapsibleSection>

      <CollapsibleSection title="System Prompt" collapsible defaultCollapsed>
        <Textarea
          value={systemPrompt()}
          onInput={(e) => updateConfig("systemPrompt", e.currentTarget.value)}
          placeholder="Enter system prompt for this agent..."
          style={{ "min-height": "120px", "font-family": "var(--jb-font-mono)", "font-size": "12px" }}
          error={getError("systemPrompt")}
        />
      </CollapsibleSection>
    </>
  );
}

// =============================================================================
// TRIGGER CONFIG COMPONENT
// =============================================================================

interface TriggerConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  errors?: ValidationError[];
}

function TriggerConfig(props: TriggerConfigProps) {
  const triggerType = () => (props.config.triggerType as string) || "file_watch";
  const getError = (field: string) => props.errors?.find((e) => e.field === field)?.message;

  const updateConfig = (field: string, value: unknown) => {
    props.onChange({ ...props.config, [field]: value });
  };

  const fieldStyle: JSX.CSSProperties = {
    "margin-bottom": "16px",
  };

  return (
    <CollapsibleSection title="Trigger Configuration" collapsible>
      <div style={fieldStyle}>
        <label style={{ "font-size": "var(--jb-text-muted-size)", color: "var(--jb-text-muted-color)", display: "block", "margin-bottom": "6px" }}>
          Trigger Type
        </label>
        <Select
          options={TRIGGER_TYPES}
          value={triggerType()}
          onChange={(value) => updateConfig("triggerType", value)}
        />
      </div>

      <Show when={triggerType() === "file_watch"}>
        <div style={fieldStyle}>
          <Input
            label="Pattern"
            value={(props.config.pattern as string) || "**/*"}
            onInput={(e) => updateConfig("pattern", e.currentTarget.value)}
            placeholder="**/*.ts"
            hint="Glob pattern to watch"
            error={getError("pattern")}
          />
        </div>
        <div style={fieldStyle}>
          <Input
            label="Exclude Pattern"
            value={(props.config.exclude as string) || ""}
            onInput={(e) => updateConfig("exclude", e.currentTarget.value)}
            placeholder="**/node_modules/**"
            hint="Glob pattern to exclude"
          />
        </div>
        <div style={fieldStyle}>
          <Input
            label="Debounce (ms)"
            type="number"
            value={String((props.config.debounce as number) || 300)}
            onInput={(e) => updateConfig("debounce", parseInt(e.currentTarget.value) || 300)}
            min={0}
            max={10000}
          />
        </div>
      </Show>

      <Show when={triggerType() === "schedule"}>
        <div style={fieldStyle}>
          <Input
            label="Cron Expression"
            value={(props.config.cron as string) || "0 * * * *"}
            onInput={(e) => updateConfig("cron", e.currentTarget.value)}
            placeholder="0 * * * *"
            hint="Standard cron format"
            error={getError("cron")}
          />
        </div>
        <div style={fieldStyle}>
          <Input
            label="Timezone"
            value={(props.config.timezone as string) || "UTC"}
            onInput={(e) => updateConfig("timezone", e.currentTarget.value)}
            placeholder="UTC"
          />
        </div>
      </Show>

      <Show when={triggerType() === "webhook"}>
        <div style={fieldStyle}>
          <Select
            options={[
              { value: "GET", label: "GET" },
              { value: "POST", label: "POST" },
              { value: "PUT", label: "PUT" },
              { value: "DELETE", label: "DELETE" },
            ]}
            value={(props.config.method as string) || "POST"}
            onChange={(value) => updateConfig("method", value)}
          />
        </div>
        <div style={fieldStyle}>
          <Input
            label="Path"
            value={(props.config.path as string) || "/webhook"}
            onInput={(e) => updateConfig("path", e.currentTarget.value)}
            placeholder="/webhook/my-trigger"
            error={getError("path")}
          />
        </div>
        <div style={fieldStyle}>
          <Input
            label="Secret (optional)"
            type="password"
            value={(props.config.secret as string) || ""}
            onInput={(e) => updateConfig("secret", e.currentTarget.value)}
            placeholder="Webhook secret for validation"
          />
        </div>
      </Show>

      <Show when={triggerType() === "event"}>
        <div style={fieldStyle}>
          <Input
            label="Event Name"
            value={(props.config.eventName as string) || ""}
            onInput={(e) => updateConfig("eventName", e.currentTarget.value)}
            placeholder="custom.event.name"
            error={getError("eventName")}
          />
        </div>
      </Show>
    </CollapsibleSection>
  );
}

// =============================================================================
// ACTION CONFIG COMPONENT
// =============================================================================

interface ActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  errors?: ValidationError[];
}

function ActionConfig(props: ActionConfigProps) {
  const actionType = () => (props.config.actionType as string) || "command";
  const getError = (field: string) => props.errors?.find((e) => e.field === field)?.message;

  const updateConfig = (field: string, value: unknown) => {
    props.onChange({ ...props.config, [field]: value });
  };

  const fieldStyle: JSX.CSSProperties = {
    "margin-bottom": "16px",
  };

  return (
    <CollapsibleSection title="Action Configuration" collapsible>
      <div style={fieldStyle}>
        <label style={{ "font-size": "var(--jb-text-muted-size)", color: "var(--jb-text-muted-color)", display: "block", "margin-bottom": "6px" }}>
          Action Type
        </label>
        <Select
          options={ACTION_TYPES}
          value={actionType()}
          onChange={(value) => updateConfig("actionType", value)}
        />
      </div>

      <Show when={actionType() === "command"}>
        <div style={fieldStyle}>
          <Textarea
            label="Command"
            value={(props.config.command as string) || ""}
            onInput={(e) => updateConfig("command", e.currentTarget.value)}
            placeholder="echo 'Hello, World!'"
            style={{ "font-family": "var(--jb-font-mono)", "font-size": "12px" }}
            error={getError("command")}
          />
        </div>
        <div style={fieldStyle}>
          <Input
            label="Working Directory"
            value={(props.config.cwd as string) || ""}
            onInput={(e) => updateConfig("cwd", e.currentTarget.value)}
            placeholder="/path/to/directory"
          />
        </div>
      </Show>

      <Show when={actionType() === "api"}>
        <div style={fieldStyle}>
          <Select
            options={[
              { value: "GET", label: "GET" },
              { value: "POST", label: "POST" },
              { value: "PUT", label: "PUT" },
              { value: "PATCH", label: "PATCH" },
              { value: "DELETE", label: "DELETE" },
            ]}
            value={(props.config.method as string) || "GET"}
            onChange={(value) => updateConfig("method", value)}
          />
        </div>
        <div style={fieldStyle}>
          <Input
            label="URL"
            value={(props.config.url as string) || ""}
            onInput={(e) => updateConfig("url", e.currentTarget.value)}
            placeholder="https://api.example.com/endpoint"
            error={getError("url")}
          />
        </div>
        <div style={fieldStyle}>
          <Textarea
            label="Headers (JSON)"
            value={(props.config.headers as string) || "{}"}
            onInput={(e) => updateConfig("headers", e.currentTarget.value)}
            placeholder='{"Authorization": "Bearer token"}'
            style={{ "font-family": "var(--jb-font-mono)", "font-size": "12px" }}
          />
        </div>
        <div style={fieldStyle}>
          <Textarea
            label="Body (JSON)"
            value={(props.config.body as string) || ""}
            onInput={(e) => updateConfig("body", e.currentTarget.value)}
            placeholder='{"key": "value"}'
            style={{ "font-family": "var(--jb-font-mono)", "font-size": "12px" }}
          />
        </div>
      </Show>

      <Show when={actionType() === "file"}>
        <div style={fieldStyle}>
          <Select
            options={[
              { value: "read", label: "Read File" },
              { value: "write", label: "Write File" },
              { value: "append", label: "Append to File" },
              { value: "delete", label: "Delete File" },
              { value: "copy", label: "Copy File" },
              { value: "move", label: "Move File" },
            ]}
            value={(props.config.operation as string) || "read"}
            onChange={(value) => updateConfig("operation", value)}
          />
        </div>
        <div style={fieldStyle}>
          <Input
            label="Path"
            value={(props.config.path as string) || ""}
            onInput={(e) => updateConfig("path", e.currentTarget.value)}
            placeholder="/path/to/file"
            error={getError("path")}
          />
        </div>
        <Show when={["write", "append"].includes((props.config.operation as string) || "")}>
          <div style={fieldStyle}>
            <Textarea
              label="Content"
              value={(props.config.content as string) || ""}
              onInput={(e) => updateConfig("content", e.currentTarget.value)}
              placeholder="File content..."
              style={{ "min-height": "100px" }}
            />
          </div>
        </Show>
      </Show>

      <div style={fieldStyle}>
        <Input
          label="Timeout (ms)"
          type="number"
          value={String((props.config.timeout as number) || 30000)}
          onInput={(e) => updateConfig("timeout", parseInt(e.currentTarget.value) || 30000)}
          min={1000}
          max={600000}
        />
      </div>
    </CollapsibleSection>
  );
}

// =============================================================================
// LOGIC CONFIG COMPONENT
// =============================================================================

interface LogicConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  errors?: ValidationError[];
}

function LogicConfig(props: LogicConfigProps) {
  const logicType = () => (props.config.logicType as string) || "condition";
  const getError = (field: string) => props.errors?.find((e) => e.field === field)?.message;

  const updateConfig = (field: string, value: unknown) => {
    props.onChange({ ...props.config, [field]: value });
  };

  const fieldStyle: JSX.CSSProperties = {
    "margin-bottom": "16px",
  };

  return (
    <CollapsibleSection title="Logic Configuration" collapsible>
      <div style={fieldStyle}>
        <label style={{ "font-size": "var(--jb-text-muted-size)", color: "var(--jb-text-muted-color)", display: "block", "margin-bottom": "6px" }}>
          Logic Type
        </label>
        <Select
          options={LOGIC_TYPES}
          value={logicType()}
          onChange={(value) => updateConfig("logicType", value)}
        />
      </div>

      <Show when={logicType() === "condition"}>
        <div style={fieldStyle}>
          <Textarea
            label="Expression"
            value={(props.config.expression as string) || ""}
            onInput={(e) => updateConfig("expression", e.currentTarget.value)}
            placeholder="input.status === 'success'"
            hint="JavaScript expression that evaluates to boolean"
            style={{ "font-family": "var(--jb-font-mono)", "font-size": "12px" }}
            error={getError("expression")}
          />
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ flex: "1" }}>
            <Input
              label="True Branch Label"
              value={(props.config.trueLabel as string) || "Yes"}
              onInput={(e) => updateConfig("trueLabel", e.currentTarget.value)}
            />
          </div>
          <div style={{ flex: "1" }}>
            <Input
              label="False Branch Label"
              value={(props.config.falseLabel as string) || "No"}
              onInput={(e) => updateConfig("falseLabel", e.currentTarget.value)}
            />
          </div>
        </div>
      </Show>

      <Show when={logicType() === "switch"}>
        <div style={fieldStyle}>
          <Textarea
            label="Expression"
            value={(props.config.expression as string) || ""}
            onInput={(e) => updateConfig("expression", e.currentTarget.value)}
            placeholder="input.type"
            hint="JavaScript expression to evaluate"
            style={{ "font-family": "var(--jb-font-mono)", "font-size": "12px" }}
            error={getError("expression")}
          />
        </div>
        <div style={fieldStyle}>
          <Textarea
            label="Cases (JSON array)"
            value={JSON.stringify((props.config.cases as unknown[]) || [], null, 2)}
            onInput={(e) => {
              try {
                updateConfig("cases", JSON.parse(e.currentTarget.value));
              } catch {
                // Invalid JSON, ignore
              }
            }}
            placeholder='["case1", "case2", "default"]'
            style={{ "font-family": "var(--jb-font-mono)", "font-size": "12px", "min-height": "80px" }}
          />
        </div>
      </Show>

      <Show when={logicType() === "loop"}>
        <div style={fieldStyle}>
          <Select
            options={[
              { value: "forEach", label: "For Each (iterate array)" },
              { value: "while", label: "While (condition)" },
              { value: "times", label: "Times (count)" },
            ]}
            value={(props.config.loopType as string) || "forEach"}
            onChange={(value) => updateConfig("loopType", value)}
          />
        </div>
        <Show when={(props.config.loopType as string) === "forEach" || !(props.config.loopType as string)}>
          <div style={fieldStyle}>
            <Input
              label="Array Expression"
              value={(props.config.arrayExpr as string) || ""}
              onInput={(e) => updateConfig("arrayExpr", e.currentTarget.value)}
              placeholder="input.items"
              error={getError("arrayExpr")}
            />
          </div>
        </Show>
        <Show when={(props.config.loopType as string) === "while"}>
          <div style={fieldStyle}>
            <Input
              label="While Condition"
              value={(props.config.whileExpr as string) || ""}
              onInput={(e) => updateConfig("whileExpr", e.currentTarget.value)}
              placeholder="counter < 10"
              error={getError("whileExpr")}
            />
          </div>
        </Show>
        <Show when={(props.config.loopType as string) === "times"}>
          <div style={fieldStyle}>
            <Input
              label="Iterations"
              type="number"
              value={String((props.config.iterations as number) || 1)}
              onInput={(e) => updateConfig("iterations", parseInt(e.currentTarget.value) || 1)}
              min={1}
              max={1000}
            />
          </div>
        </Show>
        <div style={fieldStyle}>
          <Input
            label="Max Iterations"
            type="number"
            value={String((props.config.maxIterations as number) || 100)}
            onInput={(e) => updateConfig("maxIterations", parseInt(e.currentTarget.value) || 100)}
            min={1}
            max={10000}
            hint="Safety limit to prevent infinite loops"
          />
        </div>
      </Show>
    </CollapsibleSection>
  );
}

// =============================================================================
// INSPECTOR COMPONENT
// =============================================================================

export function Inspector(props: InspectorProps) {
  const [localConfig, setLocalConfig] = createSignal<Record<string, unknown>>({});
  const [localLabel, setLocalLabel] = createSignal("");
  const [errors, setErrors] = createSignal<ValidationError[]>([]);
  const [isDirty, setIsDirty] = createSignal(false);

  // Sync local state when selected node changes
  createEffect(() => {
    const node = props.selectedNode;
    if (node) {
      setLocalConfig({ ...node.config });
      setLocalLabel(node.label);
      setErrors([]);
      setIsDirty(false);
    }
  });

  const handleConfigChange = (newConfig: Record<string, unknown>) => {
    setLocalConfig(newConfig);
    setIsDirty(true);
  };

  const handleLabelChange = (label: string) => {
    setLocalLabel(label);
    setIsDirty(true);
  };

  const validate = (): boolean => {
    const node = props.selectedNode;
    if (!node) return false;

    const newErrors: ValidationError[] = [];

    // Basic label validation
    if (!localLabel().trim()) {
      newErrors.push({ field: "label", message: "Label is required" });
    }

    // Type-specific validation
    switch (node.type) {
      case "agent":
        if (!localConfig().model) {
          newErrors.push({ field: "model", message: "Model is required" });
        }
        break;
      case "trigger":
        if (localConfig().triggerType === "webhook" && !localConfig().path) {
          newErrors.push({ field: "path", message: "Path is required for webhooks" });
        }
        break;
      case "action":
        if (localConfig().actionType === "api" && !localConfig().url) {
          newErrors.push({ field: "url", message: "URL is required" });
        }
        break;
      case "logic":
        if (localConfig().logicType === "condition" && !localConfig().expression) {
          newErrors.push({ field: "expression", message: "Expression is required" });
        }
        break;
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleApply = () => {
    if (!props.selectedNode || !validate()) return;

    if (localLabel() !== props.selectedNode.label) {
      props.onLabelChange?.(props.selectedNode.id, localLabel());
    }
    props.onApply?.(props.selectedNode.id, localConfig());
    setIsDirty(false);
  };

  const handleReset = () => {
    if (!props.selectedNode) return;

    setLocalConfig({ ...props.selectedNode.config });
    setLocalLabel(props.selectedNode.label);
    setErrors([]);
    setIsDirty(false);
    props.onReset?.(props.selectedNode.id);
  };

  const handleDelete = () => {
    if (!props.selectedNode) return;
    props.onDelete?.(props.selectedNode.id);
  };

  // Styles
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    overflow: "hidden",
    ...props.style,
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "12px",
    "border-bottom": "1px solid var(--jb-border-divider)",
    background: "var(--jb-surface-panel)",
  };

  const titleStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
  };

  const footerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    gap: "8px",
    padding: "12px",
    "border-top": "1px solid var(--jb-border-divider)",
    background: "var(--jb-surface-panel)",
  };

  const emptyStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    height: "100%",
    padding: "32px",
    color: "var(--jb-text-muted-color)",
    "text-align": "center",
  };

  const getTypeBadgeVariant = (type: FactoryNodeType) => {
    switch (type) {
      case "trigger": return "warning";
      case "agent": return "accent";
      case "action": return "success";
      case "logic": return "default";
      case "communication": return "error";
      default: return "default";
    }
  };

  return (
    <div style={containerStyle}>
      <Show
        when={props.selectedNode}
        fallback={
          <div style={emptyStyle}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor" style={{ opacity: 0.3, "margin-bottom": "12px" }}>
              <path d="M24 4L4 14v20l20 10 20-10V14L24 4zm0 4l14 7-14 7-14-7 14-7zM8 18l14 7v14l-14-7V18zm32 0v14l-14 7V25l14-7z" />
            </svg>
            <span style={{ "font-size": "14px", "font-weight": "500" }}>No Node Selected</span>
            <span style={{ "font-size": "12px", "margin-top": "4px" }}>
              Select a node on the canvas to configure it
            </span>
          </div>
        }
      >
        {/* Header */}
        <div style={headerStyle}>
          <div style={titleStyle}>
            <Badge variant={getTypeBadgeVariant(props.selectedNode!.type)}>
              {props.selectedNode!.type.toUpperCase()}
            </Badge>
            <span style={{ "font-size": "14px", "font-weight": "500", color: "var(--jb-text-body-color)" }}>
              {props.selectedNode!.subtype}
            </span>
          </div>
          <button
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "24px",
              height: "24px",
              background: "transparent",
              border: "none",
              "border-radius": "var(--jb-radius-sm)",
              color: "var(--cortex-error)",
              cursor: "pointer",
              transition: "background var(--cortex-transition-fast)",
            }}
            onClick={handleDelete}
            title="Delete node"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(247, 84, 100, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M5 0v1H1v2h12V1H9V0H5zM2 4v9h10V4H2zm2 2h2v5H4V6zm4 0h2v5H8V6z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {/* Basic Info */}
          <CollapsibleSection title="Basic Info" collapsible>
            <div style={{ "margin-bottom": "12px" }}>
              <Input
                label="Label"
                value={localLabel()}
                onInput={(e) => handleLabelChange(e.currentTarget.value)}
                placeholder="Node label"
                error={errors().find((e) => e.field === "label")?.message}
              />
            </div>
            <div style={{ "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
              ID: <code style={{ "font-family": "var(--jb-font-mono)" }}>{props.selectedNode!.id}</code>
            </div>
          </CollapsibleSection>

          {/* Type-specific config */}
          <Show when={props.selectedNode!.type === "agent"}>
            <AgentConfig
              config={localConfig()}
              onChange={handleConfigChange}
              availableTools={props.availableTools}
              availableModels={props.availableModels}
              errors={errors()}
            />
          </Show>

          <Show when={props.selectedNode!.type === "trigger"}>
            <TriggerConfig
              config={localConfig()}
              onChange={handleConfigChange}
              errors={errors()}
            />
          </Show>

          <Show when={props.selectedNode!.type === "action"}>
            <ActionConfig
              config={localConfig()}
              onChange={handleConfigChange}
              errors={errors()}
            />
          </Show>

          <Show when={props.selectedNode!.type === "logic"}>
            <LogicConfig
              config={localConfig()}
              onChange={handleConfigChange}
              errors={errors()}
            />
          </Show>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty()}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            disabled={!isDirty() || props.loading}
            loading={props.loading}
          >
            Apply
          </Button>
        </div>
      </Show>
    </div>
  );
}

export default Inspector;


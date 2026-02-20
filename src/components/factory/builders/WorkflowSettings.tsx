/**
 * =============================================================================
 * WORKFLOW SETTINGS - Workflow Configuration Dialog
 * =============================================================================
 * 
 * A comprehensive dialog for configuring workflow settings in the Agent Factory.
 * Provides forms for basic info, variables, interception, execution settings,
 * and lifecycle hooks.
 * 
 * Features:
 * - Basic Info: name, description, author, tags
 * - Variables: workflow-level key-value pairs with types
 * - Interception Settings: mode, targets, supervisor selection
 * - Execution Settings: parallelism, timeouts, retries
 * - Hooks: onStart, onComplete, onError handlers
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
import { Modal } from "../../ui/Modal";
import { Input, Textarea } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Checkbox } from "../../ui/Checkbox";
import { Button } from "../../ui/Button";
import { Toggle } from "../../ui/Toggle";
import { Tabs, TabList, Tab, TabPanel } from "../../ui/Tabs";

// =============================================================================
// TYPES
// =============================================================================

export type VariableType = "string" | "number" | "boolean" | "array" | "object";

export type InterceptionMode = "rules" | "supervisor" | "hybrid";

export type InterceptionTarget = 
  | "tool_calls"
  | "file_writes"
  | "bash_commands"
  | "network_requests"
  | "agent_outputs";

export type HookAction = "none" | "notify" | "log" | "webhook" | "custom";

export interface WorkflowVariable {
  id: string;
  key: string;
  value: string;
  type: VariableType;
  description?: string;
}

export interface InterceptionSettings {
  enabled: boolean;
  mode: InterceptionMode;
  targets: InterceptionTarget[];
  supervisorAgentId?: string;
  timeout: number;
  fallback: "allow" | "deny" | "pause";
}

export interface ExecutionSettings {
  maxParallelAgents: number;
  defaultTimeout: number;
  retryEnabled: boolean;
  maxRetries: number;
  retryDelay: number;
}

export interface HookConfig {
  action: HookAction;
  webhookUrl?: string;
  customScript?: string;
}

export interface WorkflowConfig {
  id?: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  variables: WorkflowVariable[];
  interception: InterceptionSettings;
  execution: ExecutionSettings;
  hooks: {
    onStart: HookConfig;
    onComplete: HookConfig;
    onError: HookConfig;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface WorkflowSettingsProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Initial workflow config for editing */
  initialConfig?: Partial<WorkflowConfig>;
  /** Callback when settings are saved */
  onSave?: (config: WorkflowConfig) => void;
  /** Available supervisor agents */
  supervisorAgents?: { value: string; label: string }[];
  /** Loading state */
  loading?: boolean;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const VARIABLE_TYPES: { value: VariableType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "array", label: "Array" },
  { value: "object", label: "Object" },
];

const INTERCEPTION_TARGETS: { value: InterceptionTarget; label: string; description: string }[] = [
  { value: "tool_calls", label: "Tool Calls", description: "Intercept all tool invocations" },
  { value: "file_writes", label: "File Writes", description: "Intercept file write operations" },
  { value: "bash_commands", label: "Bash Commands", description: "Intercept shell command execution" },
  { value: "network_requests", label: "Network Requests", description: "Intercept HTTP/API requests" },
  { value: "agent_outputs", label: "Agent Outputs", description: "Intercept final agent responses" },
];

const HOOK_ACTIONS: { value: HookAction; label: string }[] = [
  { value: "none", label: "None" },
  { value: "notify", label: "Send Notification" },
  { value: "log", label: "Log Event" },
  { value: "webhook", label: "Trigger Webhook" },
  { value: "custom", label: "Custom Script" },
];

const DEFAULT_INTERCEPTION: InterceptionSettings = {
  enabled: false,
  mode: "rules",
  targets: ["tool_calls", "file_writes"],
  timeout: 30000,
  fallback: "pause",
};

const DEFAULT_EXECUTION: ExecutionSettings = {
  maxParallelAgents: 5,
  defaultTimeout: 60000,
  retryEnabled: true,
  maxRetries: 3,
  retryDelay: 1000,
};

const DEFAULT_HOOK: HookConfig = {
  action: "none",
};

const DEFAULT_CONFIG: WorkflowConfig = {
  name: "",
  description: "",
  author: "",
  tags: [],
  variables: [],
  interception: DEFAULT_INTERCEPTION,
  execution: DEFAULT_EXECUTION,
  hooks: {
    onStart: { ...DEFAULT_HOOK },
    onComplete: { ...DEFAULT_HOOK },
    onError: { ...DEFAULT_HOOK },
  },
};

// =============================================================================
// SECTION COMPONENT
// =============================================================================

interface SectionProps {
  title: string;
  children: JSX.Element;
  description?: string;
}

function Section(props: SectionProps) {
  const containerStyle: JSX.CSSProperties = {
    "margin-bottom": "24px",
  };

  const headerStyle: JSX.CSSProperties = {
    "margin-bottom": "12px",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "600",
    color: "var(--jb-text-header-color)",
    "margin-bottom": "4px",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>{props.title}</div>
        <Show when={props.description}>
          <div style={descriptionStyle}>{props.description}</div>
        </Show>
      </div>
      {props.children}
    </div>
  );
}

// =============================================================================
// TAGS INPUT COMPONENT
// =============================================================================

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

function TagsInput(props: TagsInputProps) {
  const [inputValue, setInputValue] = createSignal("");

  const addTag = () => {
    const tag = inputValue().trim();
    if (tag && !props.value.includes(tag)) {
      props.onChange([...props.value, tag]);
      setInputValue("");
    }
  };

  const removeTag = (tag: string) => {
    props.onChange(props.value.filter(t => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !inputValue() && props.value.length > 0) {
      removeTag(props.value[props.value.length - 1]);
    }
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-wrap": "wrap",
    gap: "6px",
    padding: "6px 8px",
    background: "var(--jb-input-bg)",
    border: "var(--jb-input-border)",
    "border-radius": "var(--jb-input-radius)",
    "min-height": "var(--jb-input-height)",
    "align-items": "center",
  };

  const tagStyle: JSX.CSSProperties = {
    display: "inline-flex",
    "align-items": "center",
    gap: "4px",
    padding: "2px 6px",
    background: "var(--jb-surface-active)",
    "border-radius": "var(--jb-radius-sm)",
    "font-size": "12px",
    color: "var(--jb-text-body-color)",
  };

  const removeButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "14px",
    height: "14px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--cortex-radius-full)",
    cursor: "pointer",
    color: "var(--jb-text-muted-color)",
    padding: "0",
  };

  const inputStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "100px",
    border: "none",
    background: "transparent",
    outline: "none",
    "font-family": "var(--jb-font-ui)",
    "font-size": "var(--jb-text-body-size)",
    color: "var(--jb-input-color)",
  };

  return (
    <div style={containerStyle}>
      <For each={props.value}>
        {(tag) => (
          <span style={tagStyle}>
            {tag}
            <button
              type="button"
              style={removeButtonStyle}
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" fill="none"/>
              </svg>
            </button>
          </span>
        )}
      </For>
      <input
        type="text"
        value={inputValue()}
        onInput={(e) => setInputValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={props.value.length === 0 ? props.placeholder : ""}
        style={inputStyle}
      />
    </div>
  );
}

// =============================================================================
// VARIABLES EDITOR COMPONENT
// =============================================================================

interface VariablesEditorProps {
  variables: WorkflowVariable[];
  onChange: (variables: WorkflowVariable[]) => void;
}

function VariablesEditor(props: VariablesEditorProps) {
  const generateId = () => `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addVariable = () => {
    const newVar: WorkflowVariable = {
      id: generateId(),
      key: "",
      value: "",
      type: "string",
    };
    props.onChange([...props.variables, newVar]);
  };

  const updateVariable = (id: string, updates: Partial<WorkflowVariable>) => {
    props.onChange(props.variables.map(v => 
      v.id === id ? { ...v, ...updates } : v
    ));
  };

  const removeVariable = (id: string) => {
    props.onChange(props.variables.filter(v => v.id !== id));
  };

  const tableStyle: JSX.CSSProperties = {
    width: "100%",
    "border-collapse": "collapse",
    "font-size": "12px",
  };

  const thStyle: JSX.CSSProperties = {
    padding: "8px 12px",
    "text-align": "left",
    "border-bottom": "1px solid var(--jb-border-default)",
    "font-weight": "500",
    color: "var(--jb-text-muted-color)",
    background: "var(--jb-surface-panel)",
  };

  const tdStyle: JSX.CSSProperties = {
    padding: "8px 12px",
    "border-bottom": "1px solid var(--jb-border-divider)",
    color: "var(--jb-text-body-color)",
    "vertical-align": "middle",
  };

  const actionButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "24px",
    height: "24px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    cursor: "pointer",
    color: "var(--cortex-error)",
    padding: "0",
  };

  return (
    <div>
      <div style={{ "margin-bottom": "8px" }}>
        <Button size="sm" variant="secondary" onClick={addVariable}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ "margin-right": "4px" }}>
            <path d="M6 0v12M0 6h12" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
          Add Variable
        </Button>
      </div>
      <Show when={props.variables.length > 0}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Key</th>
              <th style={{ ...thStyle, width: "100px" }}>Type</th>
              <th style={thStyle}>Value</th>
              <th style={{ ...thStyle, width: "40px" }}></th>
            </tr>
          </thead>
          <tbody>
            <For each={props.variables}>
              {(variable) => (
                <tr>
                  <td style={tdStyle}>
                    <Input
                      value={variable.key}
                      onInput={(e) => updateVariable(variable.id, { key: e.currentTarget.value })}
                      placeholder="variable_name"
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <Select
                      options={VARIABLE_TYPES}
                      value={variable.type}
                      onChange={(value) => updateVariable(variable.id, { type: value as VariableType })}
                    />
                  </td>
                  <td style={tdStyle}>
                    <Input
                      value={variable.value}
                      onInput={(e) => updateVariable(variable.id, { value: e.currentTarget.value })}
                      placeholder="value"
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      style={actionButtonStyle}
                      onClick={() => removeVariable(variable.id)}
                      aria-label="Remove variable"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                        <path d="M5 0v1H1v2h12V1H9V0H5zM2 4v9h10V4H2z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
      <Show when={props.variables.length === 0}>
        <div style={{
          padding: "24px",
          "text-align": "center",
          color: "var(--jb-text-muted-color)",
          background: "var(--jb-surface-panel)",
          "border-radius": "var(--jb-radius-md)",
          border: "1px dashed var(--jb-border-default)",
        }}>
          No variables defined. Click "Add Variable" to create one.
        </div>
      </Show>
    </div>
  );
}

// =============================================================================
// HOOK EDITOR COMPONENT
// =============================================================================

interface HookEditorProps {
  label: string;
  config: HookConfig;
  onChange: (config: HookConfig) => void;
}

function HookEditor(props: HookEditorProps) {
  const containerStyle: JSX.CSSProperties = {
    padding: "12px",
    background: "var(--jb-surface-panel)",
    "border-radius": "var(--jb-radius-md)",
    border: "1px solid var(--jb-border-divider)",
    "margin-bottom": "12px",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    "margin-bottom": "12px",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
    "min-width": "100px",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={labelStyle}>{props.label}</span>
        <div style={{ flex: 1 }}>
          <Select
            options={HOOK_ACTIONS}
            value={props.config.action}
            onChange={(value) => props.onChange({ ...props.config, action: value as HookAction })}
          />
        </div>
      </div>
      
      <Show when={props.config.action === "webhook"}>
        <Input
          label="Webhook URL"
          value={props.config.webhookUrl || ""}
          onInput={(e) => props.onChange({ ...props.config, webhookUrl: e.currentTarget.value })}
          placeholder="https://api.example.com/webhook"
          style={{ "margin-top": "8px" }}
        />
      </Show>

      <Show when={props.config.action === "custom"}>
        <Textarea
          label="Custom Script"
          value={props.config.customScript || ""}
          onInput={(e) => props.onChange({ ...props.config, customScript: e.currentTarget.value })}
          placeholder="// JavaScript code to execute"
          style={{ 
            "margin-top": "8px",
            "min-height": "80px",
            "font-family": "var(--jb-font-mono)",
            "font-size": "12px",
          }}
        />
      </Show>
    </div>
  );
}

// =============================================================================
// WORKFLOW SETTINGS COMPONENT
// =============================================================================

export function WorkflowSettings(props: WorkflowSettingsProps) {
  const [config, setConfig] = createSignal<WorkflowConfig>({ ...DEFAULT_CONFIG });
  const [errors, setErrors] = createSignal<ValidationError[]>([]);
  const [activeTab, setActiveTab] = createSignal("basic");

  // Initialize config when opening
  createEffect(() => {
    if (props.open) {
      if (props.initialConfig) {
        setConfig({
          ...DEFAULT_CONFIG,
          ...props.initialConfig,
          interception: { ...DEFAULT_INTERCEPTION, ...props.initialConfig.interception },
          execution: { ...DEFAULT_EXECUTION, ...props.initialConfig.execution },
          hooks: {
            onStart: { ...DEFAULT_HOOK, ...props.initialConfig.hooks?.onStart },
            onComplete: { ...DEFAULT_HOOK, ...props.initialConfig.hooks?.onComplete },
            onError: { ...DEFAULT_HOOK, ...props.initialConfig.hooks?.onError },
          },
        });
      } else {
        setConfig({ ...DEFAULT_CONFIG });
      }
      setErrors([]);
    }
  });

  const updateConfig = <K extends keyof WorkflowConfig>(field: K, value: WorkflowConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setErrors(prev => prev.filter(e => e.field !== field));
  };

  const updateInterception = <K extends keyof InterceptionSettings>(field: K, value: InterceptionSettings[K]) => {
    setConfig(prev => ({
      ...prev,
      interception: { ...prev.interception, [field]: value },
    }));
  };

  const updateExecution = <K extends keyof ExecutionSettings>(field: K, value: ExecutionSettings[K]) => {
    setConfig(prev => ({
      ...prev,
      execution: { ...prev.execution, [field]: value },
    }));
  };

  const updateHook = (hookName: "onStart" | "onComplete" | "onError", hookConfig: HookConfig) => {
    setConfig(prev => ({
      ...prev,
      hooks: { ...prev.hooks, [hookName]: hookConfig },
    }));
  };

  const toggleTarget = (target: InterceptionTarget) => {
    const current = config().interception.targets;
    const updated = current.includes(target)
      ? current.filter(t => t !== target)
      : [...current, target];
    updateInterception("targets", updated);
  };

  const getError = (field: string) => errors().find(e => e.field === field)?.message;

  const validate = (): boolean => {
    const newErrors: ValidationError[] = [];
    const c = config();

    if (!c.name.trim()) {
      newErrors.push({ field: "name", message: "Name is required" });
    }

    if (c.interception.enabled && c.interception.mode !== "rules" && !c.interception.supervisorAgentId) {
      newErrors.push({ field: "supervisorAgentId", message: "Supervisor agent is required for this mode" });
    }

    // Validate variables
    const keys = c.variables.map(v => v.key);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicates.length > 0) {
      newErrors.push({ field: "variables", message: `Duplicate variable keys: ${duplicates.join(", ")}` });
    }

    for (const v of c.variables) {
      if (!v.key.trim()) {
        newErrors.push({ field: "variables", message: "Variable key cannot be empty" });
        break;
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    props.onSave?.(config());
    props.onClose();
  };

  const isEditing = () => !!props.initialConfig?.id;

  // Modal footer
  const footer = (
    <div style={{ display: "flex", "align-items": "center", gap: "8px", width: "100%" }}>
      <div style={{ flex: 1 }} />
      <Button variant="ghost" onClick={props.onClose} disabled={props.loading}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave} loading={props.loading}>
        {isEditing() ? "Save Changes" : "Save Settings"}
      </Button>
    </div>
  );

  const fieldStyle: JSX.CSSProperties = {
    "margin-bottom": "16px",
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Workflow Settings"
      size="lg"
      footer={footer}
      style={{ width: "680px", "max-width": "90vw", "max-height": "85vh" }}
    >
      <Tabs activeTab={activeTab()} onChange={setActiveTab}>
        <TabList>
          <Tab id="basic">Basic Info</Tab>
          <Tab id="variables">Variables</Tab>
          <Tab id="interception">Interception</Tab>
          <Tab id="execution">Execution</Tab>
          <Tab id="hooks">Hooks</Tab>
        </TabList>

        {/* Basic Info Tab */}
        <TabPanel id="basic">
          <div style={{ padding: "16px 0" }}>
            <Section title="Workflow Identity">
              <div style={fieldStyle}>
                <Input
                  label="Name"
                  value={config().name}
                  onInput={(e) => updateConfig("name", e.currentTarget.value)}
                  placeholder="My Workflow"
                  error={getError("name")}
                />
              </div>

              <div style={fieldStyle}>
                <Textarea
                  label="Description"
                  value={config().description}
                  onInput={(e) => updateConfig("description", e.currentTarget.value)}
                  placeholder="Describe what this workflow does..."
                  style={{ "min-height": "80px" }}
                />
              </div>

              <div style={fieldStyle}>
                <Input
                  label="Author"
                  value={config().author}
                  onInput={(e) => updateConfig("author", e.currentTarget.value)}
                  placeholder="Your name or email"
                />
              </div>

              <div style={fieldStyle}>
                <label style={{ 
                  "font-size": "var(--jb-text-muted-size)", 
                  color: "var(--jb-text-muted-color)", 
                  display: "block", 
                  "margin-bottom": "6px" 
                }}>
                  Tags
                </label>
                <TagsInput
                  value={config().tags}
                  onChange={(tags) => updateConfig("tags", tags)}
                  placeholder="Add tags..."
                />
              </div>
            </Section>
          </div>
        </TabPanel>

        {/* Variables Tab */}
        <TabPanel id="variables">
          <div style={{ padding: "16px 0" }}>
            <Section 
              title="Workflow Variables" 
              description="Define variables that can be used throughout the workflow"
            >
              <VariablesEditor
                variables={config().variables}
                onChange={(variables) => updateConfig("variables", variables)}
              />
              <Show when={getError("variables")}>
                <div style={{ 
                  "margin-top": "8px", 
                  color: "var(--cortex-error)", 
                  "font-size": "12px" 
                }}>
                  {getError("variables")}
                </div>
              </Show>
            </Section>
          </div>
        </TabPanel>

        {/* Interception Tab */}
        <TabPanel id="interception">
          <div style={{ padding: "16px 0" }}>
            <Section title="Interception Settings">
              <div style={fieldStyle}>
                <Toggle
                  checked={config().interception.enabled}
                  onChange={(checked) => updateInterception("enabled", checked)}
                  label="Enable Interception"
                  description="Pause execution for approval on certain actions"
                />
              </div>

              <Show when={config().interception.enabled}>
                <div style={fieldStyle}>
                  <label style={{ 
                    "font-size": "var(--jb-text-muted-size)", 
                    color: "var(--jb-text-muted-color)", 
                    display: "block", 
                    "margin-bottom": "6px" 
                  }}>
                    Mode
                  </label>
                  <Select
                    options={[
                      { value: "rules", label: "Rules Only" },
                      { value: "supervisor", label: "Supervisor Agent" },
                      { value: "hybrid", label: "Hybrid (Rules + Supervisor)" },
                    ]}
                    value={config().interception.mode}
                    onChange={(value) => updateInterception("mode", value as InterceptionMode)}
                  />
                </div>

                <Show when={config().interception.mode !== "rules"}>
                  <div style={fieldStyle}>
                    <label style={{ 
                      "font-size": "var(--jb-text-muted-size)", 
                      color: "var(--jb-text-muted-color)", 
                      display: "block", 
                      "margin-bottom": "6px" 
                    }}>
                      Supervisor Agent
                    </label>
                    <Select
                      options={props.supervisorAgents || []}
                      value={config().interception.supervisorAgentId || ""}
                      onChange={(value) => updateInterception("supervisorAgentId", value)}
                      placeholder="Select supervisor agent..."
                      error={!!getError("supervisorAgentId")}
                    />
                    <Show when={getError("supervisorAgentId")}>
                      <div style={{ 
                        "margin-top": "4px", 
                        color: "var(--cortex-error)", 
                        "font-size": "11px" 
                      }}>
                        {getError("supervisorAgentId")}
                      </div>
                    </Show>
                  </div>
                </Show>

                <div style={fieldStyle}>
                  <label style={{ 
                    "font-size": "var(--jb-text-muted-size)", 
                    color: "var(--jb-text-muted-color)", 
                    display: "block", 
                    "margin-bottom": "8px" 
                  }}>
                    What to Intercept
                  </label>
                  <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                    <For each={INTERCEPTION_TARGETS}>
                      {(target) => (
                        <Checkbox
                          checked={config().interception.targets.includes(target.value)}
                          onChange={() => toggleTarget(target.value)}
                          label={target.label}
                          description={target.description}
                        />
                      )}
                    </For>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      label="Timeout (ms)"
                      type="number"
                      value={String(config().interception.timeout)}
                      onInput={(e) => updateInterception("timeout", parseInt(e.currentTarget.value) || 30000)}
                      min={1000}
                      max={600000}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ 
                      "font-size": "var(--jb-text-muted-size)", 
                      color: "var(--jb-text-muted-color)", 
                      display: "block", 
                      "margin-bottom": "6px" 
                    }}>
                      On Timeout
                    </label>
                    <Select
                      options={[
                        { value: "allow", label: "Allow Action" },
                        { value: "deny", label: "Deny Action" },
                        { value: "pause", label: "Keep Paused" },
                      ]}
                      value={config().interception.fallback}
                      onChange={(value) => updateInterception("fallback", value as "allow" | "deny" | "pause")}
                    />
                  </div>
                </div>
              </Show>
            </Section>
          </div>
        </TabPanel>

        {/* Execution Tab */}
        <TabPanel id="execution">
          <div style={{ padding: "16px 0" }}>
            <Section title="Execution Settings" description="Configure how the workflow executes">
              <div style={fieldStyle}>
                <Input
                  label="Max Parallel Agents"
                  type="number"
                  value={String(config().execution.maxParallelAgents)}
                  onInput={(e) => updateExecution("maxParallelAgents", parseInt(e.currentTarget.value) || 5)}
                  min={1}
                  max={50}
                  hint="Maximum number of agents that can run simultaneously"
                />
              </div>

              <div style={fieldStyle}>
                <Input
                  label="Default Timeout (ms)"
                  type="number"
                  value={String(config().execution.defaultTimeout)}
                  onInput={(e) => updateExecution("defaultTimeout", parseInt(e.currentTarget.value) || 60000)}
                  min={1000}
                  max={3600000}
                  hint="Default timeout for agent operations"
                />
              </div>
            </Section>

            <Section title="Retry Settings">
              <div style={fieldStyle}>
                <Toggle
                  checked={config().execution.retryEnabled}
                  onChange={(checked) => updateExecution("retryEnabled", checked)}
                  label="Enable Automatic Retries"
                  description="Automatically retry failed operations"
                />
              </div>

              <Show when={config().execution.retryEnabled}>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      label="Max Retries"
                      type="number"
                      value={String(config().execution.maxRetries)}
                      onInput={(e) => updateExecution("maxRetries", parseInt(e.currentTarget.value) || 3)}
                      min={1}
                      max={10}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Input
                      label="Retry Delay (ms)"
                      type="number"
                      value={String(config().execution.retryDelay)}
                      onInput={(e) => updateExecution("retryDelay", parseInt(e.currentTarget.value) || 1000)}
                      min={100}
                      max={60000}
                    />
                  </div>
                </div>
              </Show>
            </Section>
          </div>
        </TabPanel>

        {/* Hooks Tab */}
        <TabPanel id="hooks">
          <div style={{ padding: "16px 0" }}>
            <Section 
              title="Lifecycle Hooks" 
              description="Configure actions to run at specific workflow lifecycle events"
            >
              <HookEditor
                label="On Start"
                config={config().hooks.onStart}
                onChange={(hookConfig) => updateHook("onStart", hookConfig)}
              />
              <HookEditor
                label="On Complete"
                config={config().hooks.onComplete}
                onChange={(hookConfig) => updateHook("onComplete", hookConfig)}
              />
              <HookEditor
                label="On Error"
                config={config().hooks.onError}
                onChange={(hookConfig) => updateHook("onError", hookConfig)}
              />
            </Section>
          </div>
        </TabPanel>
      </Tabs>

      {/* Validation Errors Summary */}
      <Show when={errors().length > 0}>
        <div style={{
          "margin-top": "16px",
          padding: "12px",
          background: "rgba(247, 84, 100, 0.1)",
          "border-radius": "var(--jb-radius-md)",
          border: "1px solid var(--cortex-error)",
        }}>
          <div style={{ 
            "font-size": "12px", 
            "font-weight": "500", 
            color: "var(--cortex-error)",
            "margin-bottom": "8px",
          }}>
            Please fix the following errors:
          </div>
          <ul style={{ 
            margin: "0", 
            padding: "0 0 0 16px",
            "font-size": "12px",
            color: "var(--jb-text-body-color)",
          }}>
            <For each={errors()}>
              {(error) => <li>{error.field}: {error.message}</li>}
            </For>
          </ul>
        </div>
      </Show>
    </Modal>
  );
}

export default WorkflowSettings;


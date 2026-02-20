/**
 * =============================================================================
 * AGENT BUILDER - Custom Agent Creation and Editing
 * =============================================================================
 * 
 * A comprehensive dialog/panel for creating and editing custom agents in the
 * Agent Factory. Provides forms for configuring all aspects of an agent
 * including model settings, tools, permissions, and system prompts.
 * 
 * Features:
 * - Basic Info: name, display name, description, mode, color, icon
 * - Model Configuration: provider, model, temperature, top_p, max tokens
 * - Tools & Permissions: tool selection with permission levels
 * - System Prompt: rich editor with variable insertion
 * - Input/Output Schema: JSON schema editors
 * - Test Agent functionality
 * - Validation with error display
 * 
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  JSX,
  batch,
} from "solid-js";
import { Modal } from "../../ui/Modal";
import { Input, Textarea } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Checkbox } from "../../ui/Checkbox";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { Tabs, TabList, Tab, TabPanel } from "../../ui/Tabs";

// =============================================================================
// TYPES
// =============================================================================

export type AgentMode = "primary" | "subagent";

export type ToolPermission = "allow" | "ask" | "deny";

export interface ToolConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  permission: ToolPermission;
}

export interface AgentConfig {
  id?: string;
  name: string;
  displayName: string;
  description: string;
  mode: AgentMode;
  color: string;
  icon: string;
  provider: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  tools: ToolConfig[];
  systemPrompt: string;
  inputSchema: string;
  outputSchema: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface AgentBuilderProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Initial agent config for editing (undefined for new agent) */
  initialConfig?: Partial<AgentConfig>;
  /** Callback when agent is saved */
  onSave?: (config: AgentConfig) => void;
  /** Callback to test the agent */
  onTest?: (config: AgentConfig) => Promise<{ success: boolean; output?: string; error?: string }>;
  /** Available providers */
  providers?: { value: string; label: string }[];
  /** Available models by provider */
  modelsByProvider?: Record<string, { value: string; label: string }[]>;
  /** Available tools */
  availableTools?: { id: string; name: string; description?: string }[];
  /** Available icons */
  availableIcons?: { value: string; label: string; icon?: JSX.Element }[];
  /** Loading state */
  loading?: boolean;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google AI" },
  { value: "azure", label: "Azure OpenAI" },
];

const DEFAULT_MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-4", label: "GPT-4" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  anthropic: [
    { value: "claude-3-opus", label: "Claude 3 Opus" },
    { value: "claude-3-sonnet", label: "Claude 3 Sonnet" },
    { value: "claude-3-haiku", label: "Claude 3 Haiku" },
  ],
  google: [
    { value: "gemini-pro", label: "Gemini Pro" },
    { value: "gemini-ultra", label: "Gemini Ultra" },
  ],
  azure: [
    { value: "gpt-4", label: "GPT-4" },
    { value: "gpt-35-turbo", label: "GPT-3.5 Turbo" },
  ],
};

const DEFAULT_TOOLS = [
  { id: "file_read", name: "File Read", description: "Read files from the filesystem" },
  { id: "file_write", name: "File Write", description: "Write files to the filesystem" },
  { id: "file_edit", name: "File Edit", description: "Edit files using search/replace" },
  { id: "shell_execute", name: "Shell Execute", description: "Execute shell commands" },
  { id: "web_search", name: "Web Search", description: "Search the web" },
  { id: "web_fetch", name: "Web Fetch", description: "Fetch content from URLs" },
  { id: "code_analysis", name: "Code Analysis", description: "Analyze code structure" },
  { id: "git_operations", name: "Git Operations", description: "Git version control" },
];

const PRESET_COLORS = [
  "var(--cortex-info)", // Blue
  "var(--cortex-success)", // Green
  "var(--cortex-error)", // Red
  "var(--cortex-info)", // Purple
  "var(--cortex-warning)", // Orange
  "var(--cortex-success)", // Teal
  "var(--cortex-error)", // Pink
  "var(--cortex-text-inactive)", // Gray
];

const PRESET_ICONS = [
  { value: "robot", label: "Robot" },
  { value: "brain", label: "Brain" },
  { value: "code", label: "Code" },
  { value: "terminal", label: "Terminal" },
  { value: "search", label: "Search" },
  { value: "document", label: "Document" },
  { value: "gear", label: "Gear" },
  { value: "lightning", label: "Lightning" },
];

const DEFAULT_CONFIG: AgentConfig = {
  name: "",
  displayName: "",
  description: "",
  mode: "primary",
  color: "var(--cortex-info)",
  icon: "robot",
  provider: "openai",
  model: "gpt-4o",
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  tools: [],
  systemPrompt: "",
  inputSchema: "{}",
  outputSchema: "{}",
};

// =============================================================================
// SECTION COMPONENTS
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
// COLOR PICKER COMPONENT
// =============================================================================

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
}

function ColorPicker(props: ColorPickerProps) {
  const presets = () => props.presets || PRESET_COLORS;

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
  };

  const presetsStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-wrap": "wrap",
    gap: "6px",
  };

  const colorSwatchStyle = (color: string, isSelected: boolean): JSX.CSSProperties => ({
    width: "24px",
    height: "24px",
    "border-radius": "var(--jb-radius-sm)",
    background: color,
    cursor: "pointer",
    border: isSelected ? "2px solid white" : "2px solid transparent",
    "box-shadow": isSelected ? `0 0 0 2px ${color}` : "none",
    transition: "transform var(--cortex-transition-fast)",
  });

  const customInputStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  return (
    <div style={containerStyle}>
      <div style={presetsStyle}>
        <For each={presets()}>
          {(color) => (
            <button
              type="button"
              style={colorSwatchStyle(color, props.value === color)}
              onClick={() => props.onChange(color)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
              aria-label={`Select color ${color}`}
            />
          )}
        </For>
      </div>
      <div style={customInputStyle}>
        <input
          type="color"
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          style={{
            width: "32px",
            height: "32px",
            border: "none",
            "border-radius": "var(--jb-radius-sm)",
            cursor: "pointer",
            padding: "0",
          }}
        />
        <Input
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          placeholder="var(--cortex-accent-text)"
          style={{ flex: "1", "font-family": "var(--jb-font-mono)", "font-size": "12px" }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// ICON SELECTOR COMPONENT
// =============================================================================

interface IconSelectorProps {
  value: string;
  onChange: (icon: string) => void;
  icons?: { value: string; label: string }[];
}

function IconSelector(props: IconSelectorProps) {
  const icons = () => props.icons || PRESET_ICONS;

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-wrap": "wrap",
    gap: "8px",
  };

  const iconButtonStyle = (isSelected: boolean): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    gap: "4px",
    width: "60px",
    height: "56px",
    background: isSelected ? "var(--jb-btn-primary-bg)" : "var(--jb-surface-active)",
    color: isSelected ? "var(--cortex-text-primary)" : "var(--jb-text-body-color)",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
    "font-size": "10px",
  });

  const getIconSvg = (iconName: string) => {
    const icons: Record<string, JSX.Element> = {
      robot: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a2 2 0 0 0-2 2v1H6a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-2V4a2 2 0 0 0-2-2zm-3 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-5 3h4a1 1 0 0 1 0 2H8a1 1 0 0 1 0-2z"/>
        </svg>
      ),
      brain: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2C6.686 2 4 4.686 4 8c0 1.57.608 3 1.6 4.073V16a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1v-3.927C15.392 11 16 9.57 16 8c0-3.314-2.686-6-6-6z"/>
        </svg>
      ),
      code: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.854 4.146a.5.5 0 0 1 0 .708L2.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm8.292 0a.5.5 0 0 1 .708 0l3.5 3.5a.5.5 0 0 1 0 .708l-3.5 3.5a.5.5 0 0 1-.708-.708L17.293 8l-3.147-3.146a.5.5 0 0 1 0-.708zm-4.22-.53a.5.5 0 0 1 .374.832L7.707 8l2.593 3.552a.5.5 0 1 1-.8.596l-2.7-3.7a.5.5 0 0 1 0-.596l2.7-3.7a.5.5 0 0 1 .426-.236z"/>
        </svg>
      ),
      terminal: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H3zm2.854 4.146a.5.5 0 0 1 .708.708L4.707 10l1.855 2.146a.5.5 0 0 1-.708.708l-2.5-2.5a.5.5 0 0 1 0-.708l2.5-2.5zM9 12h4a.5.5 0 0 1 0 1H9a.5.5 0 0 1 0-1z"/>
        </svg>
      ),
      search: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 8a6 6 0 1 1 10.89 3.476l4.817 4.817a1 1 0 0 1-1.414 1.414l-4.817-4.817A6 6 0 0 1 2 8z"/>
        </svg>
      ),
      document: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4zm6 1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2h-3V6a1 1 0 0 0-1-1z"/>
        </svg>
      ),
      gear: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a1 1 0 0 1 1 1v.5a6.97 6.97 0 0 1 2.185.903l.354-.354a1 1 0 0 1 1.414 1.414l-.354.354A6.97 6.97 0 0 1 15.5 8H16a1 1 0 1 1 0 2h-.5a6.97 6.97 0 0 1-.903 2.185l.354.354a1 1 0 0 1-1.414 1.414l-.354-.354A6.97 6.97 0 0 1 11 14.5V15a1 1 0 1 1-2 0v-.5a6.97 6.97 0 0 1-2.185-.903l-.354.354a1 1 0 0 1-1.414-1.414l.354-.354A6.97 6.97 0 0 1 4.5 10H4a1 1 0 1 1 0-2h.5a6.97 6.97 0 0 1 .903-2.185l-.354-.354a1 1 0 0 1 1.414-1.414l.354.354A6.97 6.97 0 0 1 9 3.5V3a1 1 0 0 1 1-1zm0 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
        </svg>
      ),
      lightning: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M11.983 1.907a.5.5 0 0 1 .17.613L9.978 8h5.522a.5.5 0 0 1 .38.825l-8 9.5a.5.5 0 0 1-.86-.482L9.193 11H3.5a.5.5 0 0 1-.38-.825l8-9.5a.5.5 0 0 1 .863.232z"/>
        </svg>
      ),
    };
    return icons[iconName] || icons.robot;
  };

  return (
    <div style={containerStyle}>
      <For each={icons()}>
        {(icon) => (
          <button
            type="button"
            style={iconButtonStyle(props.value === icon.value)}
            onClick={() => props.onChange(icon.value)}
          >
            {getIconSvg(icon.value)}
            <span>{icon.label}</span>
          </button>
        )}
      </For>
    </div>
  );
}

// =============================================================================
// TOOLS TABLE COMPONENT
// =============================================================================

interface ToolsTableProps {
  tools: ToolConfig[];
  onChange: (tools: ToolConfig[]) => void;
  availableTools?: { id: string; name: string; description?: string }[];
}

function ToolsTable(props: ToolsTableProps) {
  const available = () => props.availableTools || DEFAULT_TOOLS;

  // Ensure all available tools are in the config
  const normalizedTools = createMemo(() => {
    const existingIds = new Set(props.tools.map(t => t.id));
    const merged = [...props.tools];
    
    for (const tool of available()) {
      if (!existingIds.has(tool.id)) {
        merged.push({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          enabled: false,
          permission: "allow",
        });
      }
    }
    
    return merged;
  });

  const updateTool = (id: string, updates: Partial<ToolConfig>) => {
    const updated = normalizedTools().map(t => 
      t.id === id ? { ...t, ...updates } : t
    );
    props.onChange(updated);
  };

  const toggleAll = (enabled: boolean) => {
    const updated = normalizedTools().map(t => ({ ...t, enabled }));
    props.onChange(updated);
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
  };

  const allEnabled = () => normalizedTools().every(t => t.enabled);
  const noneEnabled = () => normalizedTools().every(t => !t.enabled);

  return (
    <div style={{ overflow: "auto" }}>
      <div style={{ "margin-bottom": "8px", display: "flex", gap: "8px" }}>
        <Button size="sm" variant="ghost" onClick={() => toggleAll(true)} disabled={allEnabled()}>
          Enable All
        </Button>
        <Button size="sm" variant="ghost" onClick={() => toggleAll(false)} disabled={noneEnabled()}>
          Disable All
        </Button>
      </div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: "40px" }}>On</th>
            <th style={thStyle}>Tool</th>
            <th style={{ ...thStyle, width: "120px" }}>Permission</th>
          </tr>
        </thead>
        <tbody>
          <For each={normalizedTools()}>
            {(tool) => (
              <tr>
                <td style={tdStyle}>
                  <Checkbox
                    checked={tool.enabled}
                    onChange={(checked) => updateTool(tool.id, { enabled: checked })}
                    aria-label={`Enable ${tool.name}`}
                  />
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
                    <span style={{ "font-weight": "500" }}>{tool.name}</span>
                    <Show when={tool.description}>
                      <span style={{ "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
                        {tool.description}
                      </span>
                    </Show>
                  </div>
                </td>
                <td style={tdStyle}>
                  <Select
                    options={[
                      { value: "allow", label: "Allow" },
                      { value: "ask", label: "Ask" },
                      { value: "deny", label: "Deny" },
                    ]}
                    value={tool.permission}
                    onChange={(value) => updateTool(tool.id, { permission: value as ToolPermission })}
                    disabled={!tool.enabled}
                  />
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// JSON SCHEMA EDITOR
// =============================================================================

interface SchemaEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}

function SchemaEditor(props: SchemaEditorProps) {
  const [localValue, setLocalValue] = createSignal(props.value);
  const [isValid, setIsValid] = createSignal(true);

  createEffect(() => {
    setLocalValue(props.value);
    try {
      JSON.parse(props.value);
      setIsValid(true);
    } catch {
      setIsValid(false);
    }
  });

  const handleChange = (value: string) => {
    setLocalValue(value);
    try {
      JSON.parse(value);
      setIsValid(true);
      props.onChange(value);
    } catch {
      setIsValid(false);
    }
  };

  const format = () => {
    try {
      const parsed = JSON.parse(localValue());
      const formatted = JSON.stringify(parsed, null, 2);
      setLocalValue(formatted);
      props.onChange(formatted);
      setIsValid(true);
    } catch {
      // Already invalid
    }
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
      <Textarea
        value={localValue()}
        onInput={(e) => handleChange(e.currentTarget.value)}
        placeholder={props.placeholder || '{\n  "type": "object",\n  "properties": {}\n}'}
        style={{
          "min-height": "120px",
          "font-family": "var(--jb-font-mono)",
          "font-size": "12px",
        }}
        error={!isValid() ? "Invalid JSON" : props.error}
      />
      <div style={{ display: "flex", "justify-content": "flex-end" }}>
        <Button size="sm" variant="ghost" onClick={format} disabled={!isValid()}>
          Format
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// SLIDER COMPONENT
// =============================================================================

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
}

function Slider(props: SliderProps) {
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "6px",
  };

  const labelRowStyle: JSX.CSSProperties = {
    display: "flex",
    "justify-content": "space-between",
    "align-items": "center",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "var(--jb-text-muted-size)",
    color: "var(--jb-text-muted-color)",
  };

  const valueStyle: JSX.CSSProperties = {
    "font-size": "var(--jb-text-body-size)",
    "font-family": "var(--jb-font-mono)",
    color: "var(--jb-text-body-color)",
  };

  const sliderStyle: JSX.CSSProperties = {
    width: "100%",
    height: "4px",
    appearance: "none",
    background: "var(--jb-surface-active)",
    "border-radius": "var(--cortex-radius-sm)",
    outline: "none",
    cursor: "pointer",
  };

  const hintStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
  };

  return (
    <div style={containerStyle}>
      <div style={labelRowStyle}>
        <span style={labelStyle}>{props.label}</span>
        <span style={valueStyle}>{props.value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={(e) => props.onChange(parseFloat(e.currentTarget.value))}
        style={sliderStyle}
      />
      <Show when={props.hint}>
        <span style={hintStyle}>{props.hint}</span>
      </Show>
    </div>
  );
}

// =============================================================================
// AGENT BUILDER COMPONENT
// =============================================================================

export function AgentBuilder(props: AgentBuilderProps) {
  const [config, setConfig] = createSignal<AgentConfig>({ ...DEFAULT_CONFIG });
  const [errors, setErrors] = createSignal<ValidationError[]>([]);
  const [testResult, setTestResult] = createSignal<{ success: boolean; output?: string; error?: string } | null>(null);
  const [isTesting, setIsTesting] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal("basic");

  // Initialize config when opening or when initialConfig changes
  createEffect(() => {
    if (props.open) {
      if (props.initialConfig) {
        setConfig({ ...DEFAULT_CONFIG, ...props.initialConfig });
      } else {
        setConfig({ ...DEFAULT_CONFIG });
      }
      setErrors([]);
      setTestResult(null);
    }
  });

  const providers = () => props.providers || DEFAULT_PROVIDERS;
  const modelsByProvider = () => props.modelsByProvider || DEFAULT_MODELS_BY_PROVIDER;
  const availableModels = () => modelsByProvider()[config().provider] || [];

  const updateConfig = <K extends keyof AgentConfig>(field: K, value: AgentConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    setErrors(prev => prev.filter(e => e.field !== field));
  };

  const getError = (field: string) => errors().find(e => e.field === field)?.message;

  const validate = (): boolean => {
    const newErrors: ValidationError[] = [];
    const c = config();

    if (!c.name.trim()) {
      newErrors.push({ field: "name", message: "Name is required" });
    } else if (!/^[a-z][a-z0-9_]*$/.test(c.name)) {
      newErrors.push({ field: "name", message: "Name must start with lowercase letter and contain only lowercase letters, numbers, and underscores" });
    }

    if (!c.displayName.trim()) {
      newErrors.push({ field: "displayName", message: "Display name is required" });
    }

    if (!c.provider) {
      newErrors.push({ field: "provider", message: "Provider is required" });
    }

    if (!c.model) {
      newErrors.push({ field: "model", message: "Model is required" });
    }

    if (c.maxTokens < 1 || c.maxTokens > 128000) {
      newErrors.push({ field: "maxTokens", message: "Max tokens must be between 1 and 128000" });
    }

    // Validate JSON schemas
    try {
      JSON.parse(c.inputSchema);
    } catch {
      newErrors.push({ field: "inputSchema", message: "Invalid JSON schema" });
    }

    try {
      JSON.parse(c.outputSchema);
    } catch {
      newErrors.push({ field: "outputSchema", message: "Invalid JSON schema" });
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    props.onSave?.(config());
    props.onClose();
  };

  const handleTest = async () => {
    if (!props.onTest) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await props.onTest(config());
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: String(err) });
    } finally {
      setIsTesting(false);
    }
  };

  const isEditing = () => !!props.initialConfig?.id;

  // Modal footer
  const footer = (
    <div style={{ display: "flex", "align-items": "center", gap: "8px", width: "100%" }}>
      <Show when={props.onTest}>
        <Button
          variant="secondary"
          onClick={handleTest}
          loading={isTesting()}
          disabled={props.loading}
        >
          Test Agent
        </Button>
      </Show>
      <div style={{ flex: 1 }} />
      <Button variant="ghost" onClick={props.onClose} disabled={props.loading}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave} loading={props.loading}>
        {isEditing() ? "Save Changes" : "Create Agent"}
      </Button>
    </div>
  );

  const fieldStyle: JSX.CSSProperties = {
    "margin-bottom": "16px",
  };

  const rowStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "16px",
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={isEditing() ? "Edit Agent" : "Create New Agent"}
      size="lg"
      footer={footer}
      style={{ width: "720px", "max-width": "90vw", "max-height": "85vh" }}
    >
      <Tabs activeTab={activeTab()} onChange={setActiveTab}>
        <TabList>
          <Tab id="basic">Basic Info</Tab>
          <Tab id="model">Model</Tab>
          <Tab id="tools">Tools</Tab>
          <Tab id="prompt">Prompt</Tab>
          <Tab id="schema">Schema</Tab>
        </TabList>

        {/* Basic Info Tab */}
        <TabPanel id="basic">
          <div style={{ padding: "16px 0" }}>
            <Section title="Identity">
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <div style={fieldStyle}>
                    <Input
                      label="Name (identifier)"
                      value={config().name}
                      onInput={(e) => updateConfig("name", e.currentTarget.value)}
                      placeholder="my_custom_agent"
                      hint="Lowercase letters, numbers, underscores only"
                      error={getError("name")}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={fieldStyle}>
                    <Input
                      label="Display Name"
                      value={config().displayName}
                      onInput={(e) => updateConfig("displayName", e.currentTarget.value)}
                      placeholder="My Custom Agent"
                      error={getError("displayName")}
                    />
                  </div>
                </div>
              </div>

              <div style={fieldStyle}>
                <Textarea
                  label="Description"
                  value={config().description}
                  onInput={(e) => updateConfig("description", e.currentTarget.value)}
                  placeholder="Describe what this agent does..."
                  style={{ "min-height": "80px" }}
                />
              </div>

              <div style={fieldStyle}>
                <label style={{ 
                  "font-size": "var(--jb-text-muted-size)", 
                  color: "var(--jb-text-muted-color)", 
                  display: "block", 
                  "margin-bottom": "8px" 
                }}>
                  Mode
                </label>
                <div style={{ display: "flex", gap: "16px" }}>
                  <Checkbox
                    checked={config().mode === "primary"}
                    onChange={() => updateConfig("mode", "primary")}
                    label="Primary Agent"
                    description="Can be invoked directly by users"
                  />
                  <Checkbox
                    checked={config().mode === "subagent"}
                    onChange={() => updateConfig("mode", "subagent")}
                    label="Subagent"
                    description="Only invoked by other agents"
                  />
                </div>
              </div>
            </Section>

            <Section title="Appearance">
              <div style={{ display: "flex", gap: "24px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    "font-size": "var(--jb-text-muted-size)", 
                    color: "var(--jb-text-muted-color)", 
                    display: "block", 
                    "margin-bottom": "8px" 
                  }}>
                    Color
                  </label>
                  <ColorPicker
                    value={config().color}
                    onChange={(color) => updateConfig("color", color)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    "font-size": "var(--jb-text-muted-size)", 
                    color: "var(--jb-text-muted-color)", 
                    display: "block", 
                    "margin-bottom": "8px" 
                  }}>
                    Icon
                  </label>
                  <IconSelector
                    value={config().icon}
                    onChange={(icon) => updateConfig("icon", icon)}
                  />
                </div>
              </div>
            </Section>
          </div>
        </TabPanel>

        {/* Model Configuration Tab */}
        <TabPanel id="model">
          <div style={{ padding: "16px 0" }}>
            <Section title="Model Selection" description="Choose the AI model provider and specific model">
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <div style={fieldStyle}>
                    <label style={{ 
                      "font-size": "var(--jb-text-muted-size)", 
                      color: "var(--jb-text-muted-color)", 
                      display: "block", 
                      "margin-bottom": "6px" 
                    }}>
                      Provider
                    </label>
                    <Select
                      options={providers()}
                      value={config().provider}
                      onChange={(value) => {
                        batch(() => {
                          updateConfig("provider", value);
                          // Reset model when provider changes
                          const models = modelsByProvider()[value] || [];
                          if (models.length > 0) {
                            updateConfig("model", models[0].value);
                          }
                        });
                      }}
                      error={!!getError("provider")}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={fieldStyle}>
                    <label style={{ 
                      "font-size": "var(--jb-text-muted-size)", 
                      color: "var(--jb-text-muted-color)", 
                      display: "block", 
                      "margin-bottom": "6px" 
                    }}>
                      Model
                    </label>
                    <Select
                      options={availableModels()}
                      value={config().model}
                      onChange={(value) => updateConfig("model", value)}
                      error={!!getError("model")}
                    />
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Parameters" description="Fine-tune model behavior">
              <div style={fieldStyle}>
                <Slider
                  label="Temperature"
                  value={config().temperature}
                  onChange={(value) => updateConfig("temperature", value)}
                  min={0}
                  max={2}
                  step={0.1}
                  hint="Lower = more focused, Higher = more creative"
                />
              </div>

              <div style={fieldStyle}>
                <Slider
                  label="Top P"
                  value={config().topP}
                  onChange={(value) => updateConfig("topP", value)}
                  min={0}
                  max={1}
                  step={0.05}
                  hint="Nucleus sampling probability"
                />
              </div>

              <div style={fieldStyle}>
                <Input
                  label="Max Tokens"
                  type="number"
                  value={String(config().maxTokens)}
                  onInput={(e) => updateConfig("maxTokens", parseInt(e.currentTarget.value) || 4096)}
                  min={1}
                  max={128000}
                  hint="Maximum output tokens"
                  error={getError("maxTokens")}
                />
              </div>
            </Section>
          </div>
        </TabPanel>

        {/* Tools Tab */}
        <TabPanel id="tools">
          <div style={{ padding: "16px 0" }}>
            <Section 
              title="Tools & Permissions" 
              description="Configure which tools this agent can use and their permission levels"
            >
              <ToolsTable
                tools={config().tools}
                onChange={(tools) => updateConfig("tools", tools)}
                availableTools={props.availableTools}
              />
            </Section>
          </div>
        </TabPanel>

        {/* System Prompt Tab */}
        <TabPanel id="prompt">
          <div style={{ padding: "16px 0" }}>
            <Section 
              title="System Prompt" 
              description="Define the agent's personality, capabilities, and instructions"
            >
              <div style={{ "margin-bottom": "8px" }}>
                <label style={{ 
                  "font-size": "var(--jb-text-muted-size)", 
                  color: "var(--jb-text-muted-color)", 
                  display: "block", 
                  "margin-bottom": "6px" 
                }}>
                  Available Variables
                </label>
                <div style={{ display: "flex", "flex-wrap": "wrap", gap: "6px", "margin-bottom": "12px" }}>
                  <For each={["{{user_name}}", "{{workspace}}", "{{current_file}}", "{{date}}", "{{context}}"]}>
                    {(variable) => (
                      <span
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          updateConfig("systemPrompt", config().systemPrompt + variable);
                        }}
                      >
                        <Badge variant="accent">
                          {variable}
                        </Badge>
                      </span>
                    )}
                  </For>
                </div>
              </div>
              <Textarea
                value={config().systemPrompt}
                onInput={(e) => updateConfig("systemPrompt", e.currentTarget.value)}
                placeholder="You are a helpful AI assistant..."
                style={{ 
                  "min-height": "300px", 
                  "font-family": "var(--jb-font-mono)", 
                  "font-size": "13px",
                  "line-height": "1.5",
                }}
              />
              <div style={{ 
                display: "flex", 
                "justify-content": "space-between", 
                "align-items": "center",
                "margin-top": "8px",
                "font-size": "11px",
                color: "var(--jb-text-muted-color)",
              }}>
                <span>{config().systemPrompt.length} characters</span>
                <span>~{Math.ceil(config().systemPrompt.length / 4)} tokens (estimated)</span>
              </div>
            </Section>
          </div>
        </TabPanel>

        {/* Schema Tab */}
        <TabPanel id="schema">
          <div style={{ padding: "16px 0" }}>
            <Section 
              title="Input Schema" 
              description="JSON Schema defining expected input structure"
            >
              <SchemaEditor
                value={config().inputSchema}
                onChange={(value) => updateConfig("inputSchema", value)}
                error={getError("inputSchema")}
              />
            </Section>

            <Section 
              title="Output Schema" 
              description="JSON Schema defining expected output structure"
            >
              <SchemaEditor
                value={config().outputSchema}
                onChange={(value) => updateConfig("outputSchema", value)}
                error={getError("outputSchema")}
              />
            </Section>
          </div>
        </TabPanel>
      </Tabs>

      {/* Test Result Display */}
      <Show when={testResult()}>
        <div style={{
          "margin-top": "16px",
          padding: "12px",
          background: testResult()!.success ? "rgba(89, 168, 105, 0.1)" : "rgba(247, 84, 100, 0.1)",
          "border-radius": "var(--jb-radius-md)",
          border: `1px solid ${testResult()!.success ? "var(--cortex-success)" : "var(--cortex-error)"}`,
        }}>
          <div style={{ 
            display: "flex", 
            "align-items": "center", 
            gap: "8px",
            "margin-bottom": "8px",
          }}>
            <Badge variant={testResult()!.success ? "success" : "error"}>
              {testResult()!.success ? "Test Passed" : "Test Failed"}
            </Badge>
          </div>
          <Show when={testResult()!.output}>
            <pre style={{
              "font-family": "var(--jb-font-mono)",
              "font-size": "12px",
              "white-space": "pre-wrap",
              "word-break": "break-word",
              margin: "0",
              color: "var(--jb-text-body-color)",
            }}>
              {testResult()!.output}
            </pre>
          </Show>
          <Show when={testResult()!.error}>
            <pre style={{
              "font-family": "var(--jb-font-mono)",
              "font-size": "12px",
              "white-space": "pre-wrap",
              "word-break": "break-word",
              margin: "0",
              color: "var(--cortex-error)",
            }}>
              {testResult()!.error}
            </pre>
          </Show>
        </div>
      </Show>

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

export default AgentBuilder;


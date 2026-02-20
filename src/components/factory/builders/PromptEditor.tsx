/**
 * =============================================================================
 * PROMPT EDITOR - Rich Prompt Template Editor
 * =============================================================================
 * 
 * A comprehensive prompt editor for creating and editing system prompts and
 * prompt templates in the Agent Factory. Features syntax highlighting for
 * variables, preview functionality, and template management.
 * 
 * Features:
 * - Rich textarea with variable syntax highlighting ({{variable}})
 * - Variable insertion dropdown with available variables
 * - Available variables sidebar
 * - Preview rendered prompt
 * - Character/token count
 * - Save as template / Load from template
 * - Format/beautify functionality
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
  onMount,
  onCleanup,
} from "solid-js";
import { Modal } from "../../ui/Modal";
import { Input, Textarea } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { Tabs, TabList, Tab, TabPanel } from "../../ui/Tabs";

// =============================================================================
// TYPES
// =============================================================================

export interface PromptVariable {
  name: string;
  description?: string;
  defaultValue?: string;
  type: "string" | "number" | "boolean" | "array" | "object";
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  variables: PromptVariable[];
  category?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PromptEditorProps {
  /** Current prompt value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Available variables */
  variables?: PromptVariable[];
  /** Saved templates */
  templates?: PromptTemplate[];
  /** Callback to save as template */
  onSaveTemplate?: (template: Omit<PromptTemplate, "id" | "createdAt" | "updatedAt">) => void;
  /** Callback to load template */
  onLoadTemplate?: (template: PromptTemplate) => void;
  /** Preview context for rendering */
  previewContext?: Record<string, unknown>;
  /** Custom placeholder */
  placeholder?: string;
  /** Label for the editor */
  label?: string;
  /** Min height */
  minHeight?: string;
  /** Max height */
  maxHeight?: string;
  /** Whether to show the sidebar */
  showSidebar?: boolean;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_VARIABLES: PromptVariable[] = [
  { name: "user_name", description: "Current user's name", type: "string" },
  { name: "workspace", description: "Current workspace path", type: "string" },
  { name: "current_file", description: "Currently open file", type: "string" },
  { name: "date", description: "Current date", type: "string" },
  { name: "time", description: "Current time", type: "string" },
  { name: "context", description: "Conversation context", type: "object" },
  { name: "language", description: "Programming language", type: "string" },
  { name: "project_name", description: "Current project name", type: "string" },
];

const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: "code_assistant",
    name: "Code Assistant",
    description: "General purpose coding assistant",
    category: "coding",
    content: `You are an expert software engineer helping {{user_name}} with their {{language}} project.

Current workspace: {{workspace}}
Current file: {{current_file}}

Follow these guidelines:
- Write clean, maintainable code
- Follow best practices for {{language}}
- Explain your reasoning when asked
- Consider edge cases and error handling`,
    variables: [
      { name: "user_name", type: "string" },
      { name: "language", type: "string" },
      { name: "workspace", type: "string" },
      { name: "current_file", type: "string" },
    ],
  },
  {
    id: "code_reviewer",
    name: "Code Reviewer",
    description: "Reviews code for issues and improvements",
    category: "coding",
    content: `You are a senior code reviewer examining code in {{project_name}}.

Focus on:
1. Code correctness and logic errors
2. Security vulnerabilities
3. Performance issues
4. Code style and maintainability
5. Test coverage gaps

Provide constructive feedback with specific suggestions for improvement.`,
    variables: [
      { name: "project_name", type: "string" },
    ],
  },
  {
    id: "documentation_writer",
    name: "Documentation Writer",
    description: "Writes technical documentation",
    category: "documentation",
    content: `You are a technical writer creating documentation for {{project_name}}.

Guidelines:
- Use clear, concise language
- Include code examples where appropriate
- Structure content with headers and lists
- Consider the target audience's expertise level

Date: {{date}}`,
    variables: [
      { name: "project_name", type: "string" },
      { name: "date", type: "string" },
    ],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extracts variable names from a prompt template
 */
function extractVariables(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const varName = match[1].trim();
    if (!matches.includes(varName)) {
      matches.push(varName);
    }
  }
  return matches;
}

/**
 * Renders a prompt with variable substitution
 */
function renderPrompt(content: string, context: Record<string, unknown>): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const name = varName.trim();
    const value = context[name];
    if (value === undefined) {
      return match; // Keep original if no value
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Estimates token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Formats prompt text (basic cleanup)
 */
function formatPrompt(text: string): string {
  return text
    .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
    .replace(/[ \t]+$/gm, "") // Remove trailing whitespace per line
    .trim();
}

// =============================================================================
// VARIABLE INSERT DROPDOWN
// =============================================================================

interface VariableDropdownProps {
  variables: PromptVariable[];
  onInsert: (variable: string) => void;
  trigger: JSX.Element;
}

function VariableDropdown(props: VariableDropdownProps) {
  const [open, setOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  let containerRef: HTMLDivElement | undefined;

  const filteredVariables = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.variables;
    return props.variables.filter(v => 
      v.name.toLowerCase().includes(query) ||
      v.description?.toLowerCase().includes(query)
    );
  });

  const handleClickOutside = (e: MouseEvent) => {
    if (!containerRef?.contains(e.target as Node)) {
      setOpen(false);
    }
  };

  onMount(() => document.addEventListener("mousedown", handleClickOutside));
  onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));

  const handleInsert = (variable: string) => {
    props.onInsert(`{{${variable}}}`);
    setOpen(false);
    setSearchQuery("");
  };

  const dropdownStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "100%",
    left: "0",
    width: "280px",
    "max-height": "300px",
    "overflow-y": "auto",
    background: "var(--jb-popup)",
    border: "1px solid var(--jb-border-default)",
    "border-radius": "var(--jb-radius-md)",
    "box-shadow": "var(--jb-shadow-popup)",
    "z-index": "100",
    padding: "8px",
    "margin-top": "4px",
  };

  const itemStyle = (hovered: boolean): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
    padding: "8px",
    "border-radius": "var(--jb-radius-sm)",
    cursor: "pointer",
    background: hovered ? "var(--jb-surface-hover)" : "transparent",
    transition: "background var(--cortex-transition-fast)",
  });

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div onClick={() => setOpen(!open())}>
        {props.trigger}
      </div>
      <Show when={open()}>
        <div style={dropdownStyle}>
          <Input
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search variables..."
            style={{ "margin-bottom": "8px" }}
          />
          <Show when={filteredVariables().length === 0}>
            <div style={{ 
              padding: "16px", 
              "text-align": "center", 
              color: "var(--jb-text-muted-color)",
              "font-size": "12px",
            }}>
              No matching variables
            </div>
          </Show>
          <For each={filteredVariables()}>
            {(variable) => {
              const [hovered, setHovered] = createSignal(false);
              return (
                <div
                  style={itemStyle(hovered())}
                  onClick={() => handleInsert(variable.name)}
                  onMouseEnter={() => setHovered(true)}
                  onMouseLeave={() => setHovered(false)}
                >
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <code style={{ 
                      "font-family": "var(--jb-font-mono)", 
                      "font-size": "12px",
                      color: "var(--jb-border-focus)",
                    }}>
                      {`{{${variable.name}}}`}
                    </code>
                    <Badge variant="default" size="sm">{variable.type}</Badge>
                  </div>
                  <Show when={variable.description}>
                    <span style={{ 
                      "font-size": "11px", 
                      color: "var(--jb-text-muted-color)" 
                    }}>
                      {variable.description}
                    </span>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}

// =============================================================================
// TEMPLATE PICKER DIALOG
// =============================================================================

interface TemplatePickerDialogProps {
  open: boolean;
  onClose: () => void;
  templates: PromptTemplate[];
  onSelect: (template: PromptTemplate) => void;
}

function TemplatePickerDialog(props: TemplatePickerDialogProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null);

  const categories = createMemo(() => {
    const cats = new Set(props.templates.map(t => t.category || "uncategorized"));
    return ["all", ...Array.from(cats)];
  });

  const filteredTemplates = createMemo(() => {
    let templates = props.templates;
    
    if (selectedCategory() && selectedCategory() !== "all") {
      templates = templates.filter(t => (t.category || "uncategorized") === selectedCategory());
    }
    
    const query = searchQuery().toLowerCase();
    if (query) {
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return templates;
  });

  const footer = (
    <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
  );

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Load Template"
      size="md"
      footer={footer}
    >
      <div style={{ display: "flex", gap: "8px", "margin-bottom": "16px" }}>
        <Input
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          placeholder="Search templates..."
          style={{ flex: 1 }}
        />
        <Select
          options={categories().map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
          value={selectedCategory() || "all"}
          onChange={(value) => setSelectedCategory(value === "all" ? null : value)}
          style={{ width: "150px" }}
        />
      </div>

      <div style={{ "max-height": "400px", "overflow-y": "auto" }}>
        <Show when={filteredTemplates().length === 0}>
          <div style={{ 
            padding: "32px", 
            "text-align": "center", 
            color: "var(--jb-text-muted-color)" 
          }}>
            No templates found
          </div>
        </Show>
        <For each={filteredTemplates()}>
          {(template) => {
            const [hovered, setHovered] = createSignal(false);
            return (
              <div
                style={{
                  padding: "12px",
                  "border-radius": "var(--jb-radius-md)",
                  border: "1px solid var(--jb-border-divider)",
                  "margin-bottom": "8px",
                  cursor: "pointer",
                  background: hovered() ? "var(--jb-surface-hover)" : "var(--jb-surface-panel)",
                  transition: "background var(--cortex-transition-fast)",
                }}
                onClick={() => {
                  props.onSelect(template);
                  props.onClose();
                }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "4px" }}>
                  <span style={{ 
                    "font-size": "13px", 
                    "font-weight": "500", 
                    color: "var(--jb-text-body-color)" 
                  }}>
                    {template.name}
                  </span>
                  <Show when={template.category}>
                    <Badge variant="default" size="sm">{template.category}</Badge>
                  </Show>
                </div>
                <Show when={template.description}>
                  <div style={{ 
                    "font-size": "12px", 
                    color: "var(--jb-text-muted-color)",
                    "margin-bottom": "8px",
                  }}>
                    {template.description}
                  </div>
                </Show>
                <div style={{ 
                  "font-family": "var(--jb-font-mono)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                }}>
                  {template.content.substring(0, 100)}...
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </Modal>
  );
}

// =============================================================================
// SAVE TEMPLATE DIALOG
// =============================================================================

interface SaveTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  content: string;
  variables: string[];
  onSave: (template: Omit<PromptTemplate, "id" | "createdAt" | "updatedAt">) => void;
}

function SaveTemplateDialog(props: SaveTemplateDialogProps) {
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [category, setCategory] = createSignal("");

  createEffect(() => {
    if (props.open) {
      setName("");
      setDescription("");
      setCategory("");
    }
  });

  const handleSave = () => {
    if (!name().trim()) return;

    const template: Omit<PromptTemplate, "id" | "createdAt" | "updatedAt"> = {
      name: name().trim(),
      description: description().trim() || undefined,
      category: category().trim() || undefined,
      content: props.content,
      variables: props.variables.map(v => ({ name: v, type: "string" as const })),
    };

    props.onSave(template);
    props.onClose();
  };

  const footer = (
    <>
      <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
      <Button variant="primary" onClick={handleSave} disabled={!name().trim()}>
        Save Template
      </Button>
    </>
  );

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Save as Template"
      size="sm"
      footer={footer}
    >
      <div style={{ "margin-bottom": "16px" }}>
        <Input
          label="Name"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="My Template"
        />
      </div>
      <div style={{ "margin-bottom": "16px" }}>
        <Textarea
          label="Description"
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          placeholder="What this template is for..."
          style={{ "min-height": "60px" }}
        />
      </div>
      <div style={{ "margin-bottom": "16px" }}>
        <Input
          label="Category"
          value={category()}
          onInput={(e) => setCategory(e.currentTarget.value)}
          placeholder="coding, documentation, etc."
        />
      </div>
      <Show when={props.variables.length > 0}>
        <div>
          <label style={{ 
            "font-size": "var(--jb-text-muted-size)", 
            color: "var(--jb-text-muted-color)", 
            display: "block", 
            "margin-bottom": "6px" 
          }}>
            Detected Variables
          </label>
          <div style={{ display: "flex", "flex-wrap": "wrap", gap: "6px" }}>
            <For each={props.variables}>
              {(v) => <Badge variant="accent" size="sm">{`{{${v}}}`}</Badge>}
            </For>
          </div>
        </div>
      </Show>
    </Modal>
  );
}

// =============================================================================
// PREVIEW PANEL
// =============================================================================

interface PreviewPanelProps {
  content: string;
  context: Record<string, unknown>;
  variables: PromptVariable[];
}

function PreviewPanel(props: PreviewPanelProps) {
  const [localContext, setLocalContext] = createSignal<Record<string, string>>({});

  // Initialize context with defaults
  createEffect(() => {
    const initial: Record<string, string> = {};
    for (const v of props.variables) {
      initial[v.name] = (props.context[v.name] as string) || v.defaultValue || `[${v.name}]`;
    }
    setLocalContext(initial);
  });

  const updateContext = (name: string, value: string) => {
    setLocalContext(prev => ({ ...prev, [name]: value }));
  };

  const renderedContent = createMemo(() => {
    return renderPrompt(props.content, { ...props.context, ...localContext() });
  });

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%" }}>
      <div style={{ 
        "font-size": "11px", 
        "font-weight": "600", 
        "text-transform": "uppercase",
        "letter-spacing": "0.5px",
        color: "var(--jb-text-muted-color)",
        "margin-bottom": "12px",
      }}>
        Preview Variables
      </div>
      
      <div style={{ 
        "margin-bottom": "16px",
        "max-height": "150px",
        "overflow-y": "auto",
        display: "flex",
        "flex-direction": "column",
        gap: "8px",
      }}>
        <For each={props.variables}>
          {(variable) => (
            <Input
              label={variable.name}
              value={localContext()[variable.name] || ""}
              onInput={(e) => updateContext(variable.name, e.currentTarget.value)}
              placeholder={variable.defaultValue || `Enter ${variable.name}...`}
              style={{ "font-size": "12px" }}
            />
          )}
        </For>
      </div>

      <div style={{ 
        "font-size": "11px", 
        "font-weight": "600", 
        "text-transform": "uppercase",
        "letter-spacing": "0.5px",
        color: "var(--jb-text-muted-color)",
        "margin-bottom": "8px",
      }}>
        Rendered Output
      </div>
      
      <div style={{
        flex: 1,
        padding: "12px",
        background: "var(--jb-canvas)",
        "border-radius": "var(--jb-radius-md)",
        border: "1px solid var(--jb-border-divider)",
        "font-family": "var(--jb-font-ui)",
        "font-size": "13px",
        "line-height": "1.6",
        color: "var(--jb-text-body-color)",
        "white-space": "pre-wrap",
        "word-break": "break-word",
        overflow: "auto",
      }}>
        {renderedContent()}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PROMPT EDITOR COMPONENT
// =============================================================================

export function PromptEditor(props: PromptEditorProps) {
  const [showTemplates, setShowTemplates] = createSignal(false);
  const [showSaveTemplate, setShowSaveTemplate] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal("edit");
  let textareaRef: HTMLTextAreaElement | undefined;

  const variables = () => props.variables || DEFAULT_VARIABLES;
  const templates = () => [...BUILTIN_TEMPLATES, ...(props.templates || [])];
  const showSidebar = () => props.showSidebar !== false;
  const showToolbar = () => props.showToolbar !== false;

  const extractedVariables = createMemo(() => extractVariables(props.value));
  const charCount = () => props.value.length;
  const tokenCount = () => estimateTokens(props.value);

  const usedVariables = createMemo(() => {
    const extracted = extractedVariables();
    return variables().filter(v => extracted.includes(v.name));
  });

  const unusedVariables = createMemo(() => {
    const extracted = extractedVariables();
    return variables().filter(v => !extracted.includes(v.name));
  });

  const handleInsertVariable = (variable: string) => {
    if (!textareaRef) return;
    
    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const newValue = props.value.substring(0, start) + variable + props.value.substring(end);
    props.onChange(newValue);
    
    // Set cursor position after inserted text
    requestAnimationFrame(() => {
      if (textareaRef) {
        textareaRef.selectionStart = textareaRef.selectionEnd = start + variable.length;
        textareaRef.focus();
      }
    });
  };

  const handleFormat = () => {
    props.onChange(formatPrompt(props.value));
  };

  const handleLoadTemplate = (template: PromptTemplate) => {
    props.onChange(template.content);
    props.onLoadTemplate?.(template);
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    ...props.style,
  };

  const toolbarStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 0",
    "border-bottom": "1px solid var(--jb-border-divider)",
    "margin-bottom": "12px",
    "flex-wrap": "wrap",
  };

  const mainAreaStyle: JSX.CSSProperties = {
    display: "flex",
    flex: 1,
    gap: "16px",
    "min-height": "0",
  };

  const editorStyle: JSX.CSSProperties = {
    flex: 1,
    display: "flex",
    "flex-direction": "column",
  };

  const sidebarStyle: JSX.CSSProperties = {
    width: "200px",
    "flex-shrink": 0,
    display: "flex",
    "flex-direction": "column",
    gap: "12px",
  };

  const textareaStyle: JSX.CSSProperties = {
    flex: 1,
    "font-family": "var(--jb-font-mono)",
    "font-size": "13px",
    "line-height": "1.5",
    "min-height": props.minHeight || "200px",
    "max-height": props.maxHeight,
    resize: "vertical",
  };

  const statsStyle: JSX.CSSProperties = {
    display: "flex",
    "justify-content": "space-between",
    "align-items": "center",
    padding: "8px 0",
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    "border-top": "1px solid var(--jb-border-divider)",
    "margin-top": "8px",
  };

  return (
    <div style={containerStyle}>
      {/* Label */}
      <Show when={props.label}>
        <label style={{ 
          "font-size": "var(--jb-text-muted-size)", 
          color: "var(--jb-text-muted-color)", 
          display: "block", 
          "margin-bottom": "6px" 
        }}>
          {props.label}
        </label>
      </Show>

      {/* Toolbar */}
      <Show when={showToolbar()}>
        <div style={toolbarStyle}>
          <VariableDropdown
            variables={variables()}
            onInsert={handleInsertVariable}
            trigger={
              <Button variant="secondary" size="sm">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ "margin-right": "4px" }}>
                  <path d="M1 3h10v1H1V3zm0 3h7v1H1V6zm0 3h10v1H1V9z"/>
                </svg>
                Insert Variable
              </Button>
            }
          />
          <Button variant="ghost" size="sm" onClick={handleFormat}>
            Format
          </Button>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" onClick={() => setShowTemplates(true)}>
            Load Template
          </Button>
          <Show when={props.onSaveTemplate}>
            <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(true)}>
              Save as Template
            </Button>
          </Show>
        </div>
      </Show>

      {/* Main Area */}
      <div style={mainAreaStyle}>
        {/* Editor */}
        <div style={editorStyle}>
          <Tabs activeTab={activeTab()} onChange={setActiveTab}>
            <TabList>
              <Tab id="edit">Edit</Tab>
              <Tab id="preview">Preview</Tab>
            </TabList>

            <TabPanel id="edit">
              <div style={{ padding: "12px 0", height: "100%", display: "flex", "flex-direction": "column" }}>
                <textarea
                  ref={textareaRef}
                  value={props.value}
                  onInput={(e) => props.onChange(e.currentTarget.value)}
                  placeholder={props.placeholder || "Enter your prompt template..."}
                  style={{
                    ...textareaStyle,
                    width: "100%",
                    padding: "12px",
                    background: "var(--jb-input-bg)",
                    border: "var(--jb-input-border)",
                    "border-radius": "var(--jb-input-radius)",
                    color: "var(--jb-input-color)",
                    outline: "none",
                  }}
                />
              </div>
            </TabPanel>

            <TabPanel id="preview">
              <div style={{ padding: "12px 0", height: "100%" }}>
                <PreviewPanel
                  content={props.value}
                  context={props.previewContext || {}}
                  variables={usedVariables()}
                />
              </div>
            </TabPanel>
          </Tabs>

          {/* Stats */}
          <div style={statsStyle}>
            <span>{charCount()} characters</span>
            <span>~{tokenCount()} tokens (estimated)</span>
          </div>
        </div>

        {/* Sidebar */}
        <Show when={showSidebar()}>
          <div style={sidebarStyle}>
            {/* Used Variables */}
            <div>
              <div style={{ 
                "font-size": "11px", 
                "font-weight": "600", 
                "text-transform": "uppercase",
                "letter-spacing": "0.5px",
                color: "var(--jb-text-muted-color)",
                "margin-bottom": "8px",
              }}>
                Used Variables ({usedVariables().length})
              </div>
              <Show when={usedVariables().length === 0}>
                <div style={{ 
                  "font-size": "11px", 
                  color: "var(--jb-text-muted-color)",
                  "font-style": "italic",
                }}>
                  No variables used
                </div>
              </Show>
              <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                <For each={usedVariables()}>
                  {(variable) => (
                    <div style={{
                      padding: "6px 8px",
                      background: "rgba(53, 116, 240, 0.1)",
                      "border-radius": "var(--jb-radius-sm)",
                      "font-size": "11px",
                    }}>
                      <code style={{ 
                        "font-family": "var(--jb-font-mono)",
                        color: "var(--jb-border-focus)",
                      }}>
                        {`{{${variable.name}}}`}
                      </code>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Available Variables */}
            <div style={{ flex: 1, overflow: "auto" }}>
              <div style={{ 
                "font-size": "11px", 
                "font-weight": "600", 
                "text-transform": "uppercase",
                "letter-spacing": "0.5px",
                color: "var(--jb-text-muted-color)",
                "margin-bottom": "8px",
              }}>
                Available ({unusedVariables().length})
              </div>
              <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                <For each={unusedVariables()}>
                  {(variable) => {
                    const [hovered, setHovered] = createSignal(false);
                    return (
                      <div
                        style={{
                          padding: "6px 8px",
                          background: hovered() ? "var(--jb-surface-hover)" : "var(--jb-surface-panel)",
                          "border-radius": "var(--jb-radius-sm)",
                          "font-size": "11px",
                          cursor: "pointer",
                          transition: "background var(--cortex-transition-fast)",
                        }}
                        onClick={() => handleInsertVariable(`{{${variable.name}}}`)}
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => setHovered(false)}
                        title={variable.description || `Insert {{${variable.name}}}`}
                      >
                        <code style={{ 
                          "font-family": "var(--jb-font-mono)",
                          color: "var(--jb-text-muted-color)",
                        }}>
                          {`{{${variable.name}}}`}
                        </code>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Template Picker Dialog */}
      <TemplatePickerDialog
        open={showTemplates()}
        onClose={() => setShowTemplates(false)}
        templates={templates()}
        onSelect={handleLoadTemplate}
      />

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        open={showSaveTemplate()}
        onClose={() => setShowSaveTemplate(false)}
        content={props.value}
        variables={extractedVariables()}
        onSave={(template) => props.onSaveTemplate?.(template)}
      />
    </div>
  );
}

export default PromptEditor;

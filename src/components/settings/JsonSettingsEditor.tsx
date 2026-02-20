/**
 * JSON Settings Editor Component
 * 
 * Provides VS Code-like JSON editing for settings.json with:
 * - Monaco editor with JSONC language support
 * - JSON Schema validation and autocomplete
 * - Ctrl+S to save
 * - Format on save
 * - Inline validation errors
 * - Tabs for User/Workspace settings
 */

import { Show, createSignal, onMount, onCleanup, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { invoke } from "@tauri-apps/api/core";
import { MonacoManager } from "@/utils/monacoManager";
import { useSettings, type SettingsScope, DEFAULT_SETTINGS } from "@/context/SettingsContext";
import { DefaultSettingsView } from "./DefaultSettingsView";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Monaco JSON Language Types
// ============================================================================

/** Schema configuration for Monaco JSON validation */
interface JsonSchemaConfig {
  uri: string;
  fileMatch: string[];
  schema: Record<string, unknown>;
}

/** Diagnostics options for Monaco JSON language */
interface JsonDiagnosticsOptions {
  validate: boolean;
  allowComments: boolean;
  schemas: JsonSchemaConfig[];
  enableSchemaRequest: boolean;
}

/** Monaco JSON language defaults interface (not exposed in standard types) */
interface JsonLanguageDefaults {
  setDiagnosticsOptions(options: JsonDiagnosticsOptions): void;
}

/** Extended Monaco languages with JSON support */
interface MonacoLanguagesWithJson {
  json?: {
    jsonDefaults?: JsonLanguageDefaults;
  };
}

// ============================================================================
// JSON Schema for CortexSettings
// ============================================================================

/**
 * JSON Schema for CortexSettings - provides autocomplete and validation
 * This schema matches the CortexSettings structure from settings.rs
 */
const cortex_SETTINGS_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Cortex Settings",
  description: "Configuration schema for Cortex Desktop settings",
  type: "object",
  properties: {
    version: {
      type: "number",
      description: "Settings schema version (do not modify)",
      default: 1
    },
    editor: {
      type: "object",
      description: "Editor settings",
      properties: {
        fontFamily: {
          type: "string",
          description: "Font family for the editor",
          default: "JetBrains Mono, Fira Code, Consolas, monospace"
        },
        fontSize: {
          type: "number",
          description: "Font size in pixels",
          default: 14,
          minimum: 8,
          maximum: 72
        },
        lineHeight: {
          type: "number",
          description: "Line height multiplier",
          default: 1.5,
          minimum: 1,
          maximum: 3
        },
        tabSize: {
          type: "number",
          description: "Number of spaces per tab",
          default: 2,
          enum: [2, 4, 8]
        },
        insertSpaces: {
          type: "boolean",
          description: "Insert spaces when pressing Tab",
          default: true
        },
        wordWrap: {
          type: "string",
          description: "Word wrap mode",
          enum: ["off", "on", "wordWrapColumn", "bounded"],
          default: "off"
        },
        lineNumbers: {
          type: "string",
          description: "Line numbers display mode",
          enum: ["on", "off", "relative", "interval"],
          default: "on"
        },
        minimapEnabled: {
          type: "boolean",
          description: "Show minimap",
          default: true
        },
        minimapWidth: {
          type: "number",
          description: "Minimap width in pixels",
          default: 100,
          minimum: 50,
          maximum: 300
        },
        bracketPairColorization: {
          type: "boolean",
          description: "Enable bracket pair colorization",
          default: true
        },
        autoClosingBrackets: {
          type: "string",
          description: "Auto-close brackets behavior",
          enum: ["always", "languageDefined", "beforeWhitespace", "never"],
          default: "always"
        },
        autoIndent: {
          type: "boolean",
          description: "Enable automatic indentation",
          default: true
        },
        formatOnSave: {
          type: "boolean",
          description: "Format document on save",
          default: false
        },
        formatOnPaste: {
          type: "boolean",
          description: "Format pasted content",
          default: false
        },
        formatOnType: {
          type: "boolean",
          description: "Format on typing trigger characters",
          default: false
        },
        cursorStyle: {
          type: "string",
          description: "Cursor style",
          enum: ["line", "block", "underline", "line-thin", "block-outline", "underline-thin"],
          default: "line"
        },
        cursorBlink: {
          type: "string",
          description: "Cursor blink animation",
          enum: ["blink", "smooth", "phase", "expand", "solid"],
          default: "blink"
        },
        renderWhitespace: {
          type: "string",
          description: "Render whitespace characters",
          enum: ["none", "boundary", "selection", "trailing", "all"],
          default: "selection"
        },
        scrollBeyondLastLine: {
          type: "boolean",
          description: "Allow scrolling past the last line",
          default: true
        },
        smoothScrolling: {
          type: "boolean",
          description: "Enable smooth scrolling",
          default: true
        },
        mouseWheelZoom: {
          type: "boolean",
          description: "Zoom with Ctrl+scroll",
          default: false
        },
        linkedEditing: {
          type: "boolean",
          description: "Enable linked editing for HTML tags",
          default: true
        },
        renameOnType: {
          type: "boolean",
          description: "Enable rename on type",
          default: false
        },
        stickyScrollEnabled: {
          type: "boolean",
          description: "Enable sticky scroll",
          default: false
        },
        foldingEnabled: {
          type: "boolean",
          description: "Enable code folding",
          default: true
        },
        showFoldingControls: {
          type: "string",
          description: "When to show folding controls",
          enum: ["always", "mouseover", "never"],
          default: "mouseover"
        },
        guidesIndentation: {
          type: "boolean",
          description: "Show indentation guides",
          default: true
        },
        guidesBracketPairs: {
          type: "boolean",
          description: "Show bracket pair guides",
          default: true
        },
        highlightActiveIndentGuide: {
          type: "boolean",
          description: "Highlight active indent guide",
          default: true
        }
      }
    },
    theme: {
      type: "object",
      description: "Theme and appearance settings",
      properties: {
        theme: {
          type: "string",
          description: "Color theme",
          enum: ["dark", "light", "system"],
          default: "dark"
        },
        iconTheme: {
          type: "string",
          description: "File icon theme",
          default: "default"
        },
        accentColor: {
          type: "string",
          description: "Accent color (hex)",
          default: "var(--cortex-info)",
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        uiFontFamily: {
          type: "string",
          description: "UI font family",
          default: "Inter, system-ui, sans-serif"
        },
        uiFontSize: {
          type: "number",
          description: "UI font size",
          default: 13,
          minimum: 10,
          maximum: 24
        },
        zoomLevel: {
          type: "number",
          description: "Zoom level",
          default: 1.0,
          minimum: 0.5,
          maximum: 2.0
        },
        sidebarPosition: {
          type: "string",
          description: "Sidebar position",
          enum: ["left", "right"],
          default: "left"
        },
        activityBarVisible: {
          type: "boolean",
          description: "Show activity bar",
          default: true
        },
        statusBarVisible: {
          type: "boolean",
          description: "Show status bar",
          default: true
        },
        tabBarVisible: {
          type: "boolean",
          description: "Show tab bar",
          default: true
        },
        breadcrumbsEnabled: {
          type: "boolean",
          description: "Show breadcrumbs",
          default: true
        }
      }
    },
    terminal: {
      type: "object",
      description: "Terminal settings",
      properties: {
        shellPath: {
          type: "string",
          description: "Shell executable path"
        },
        shellArgs: {
          type: "array",
          description: "Shell arguments",
          items: { type: "string" }
        },
        fontFamily: {
          type: "string",
          description: "Terminal font family",
          default: "JetBrains Mono, Fira Code, Consolas, monospace"
        },
        fontSize: {
          type: "number",
          description: "Terminal font size",
          default: 14,
          minimum: 8,
          maximum: 36
        },
        lineHeight: {
          type: "number",
          description: "Terminal line height",
          default: 1.2
        },
        cursorStyle: {
          type: "string",
          description: "Terminal cursor style",
          enum: ["block", "underline", "bar"],
          default: "block"
        },
        cursorBlink: {
          type: "boolean",
          description: "Blink terminal cursor",
          default: true
        },
        scrollback: {
          type: "number",
          description: "Scrollback buffer size",
          default: 10000,
          minimum: 1000,
          maximum: 100000
        },
        copyOnSelection: {
          type: "boolean",
          description: "Copy text on selection",
          default: false
        },
        integratedGpu: {
          type: "boolean",
          description: "Use GPU acceleration",
          default: true
        }
      }
    },
    ai: {
      type: "object",
      description: "AI completion settings",
      properties: {
        supermavenEnabled: {
          type: "boolean",
          description: "Enable Supermaven completions",
          default: false
        },
        copilotEnabled: {
          type: "boolean",
          description: "Enable GitHub Copilot",
          default: false
        },
        inlineSuggestEnabled: {
          type: "boolean",
          description: "Show inline suggestions",
          default: true
        },
        inlineSuggestShowToolbar: {
          type: "boolean",
          description: "Show inline suggestion toolbar",
          default: true
        },
        defaultProvider: {
          type: "string",
          description: "Default AI provider",
          default: "anthropic"
        },
        defaultModel: {
          type: "string",
          description: "Default AI model",
          default: "claude-sonnet-4-20250514"
        }
      }
    },
    security: {
      type: "object",
      description: "Security settings",
      properties: {
        sandboxMode: {
          type: "string",
          description: "Sandbox mode for AI operations",
          enum: ["workspace_write", "directory_only", "read_only"],
          default: "workspace_write"
        },
        approvalMode: {
          type: "string",
          description: "Operation approval mode",
          enum: ["auto", "ask_edit", "ask_all"],
          default: "auto"
        },
        networkAccess: {
          type: "boolean",
          description: "Allow network access",
          default: true
        },
        telemetryEnabled: {
          type: "boolean",
          description: "Enable telemetry",
          default: false
        },
        crashReportsEnabled: {
          type: "boolean",
          description: "Send crash reports",
          default: false
        }
      }
    },
    files: {
      type: "object",
      description: "File handling settings",
      properties: {
        autoSave: {
          type: "string",
          description: "Auto-save mode",
          enum: ["off", "afterDelay", "onFocusChange", "onWindowChange"],
          default: "off"
        },
        autoSaveDelay: {
          type: "number",
          description: "Auto-save delay in milliseconds",
          default: 1000,
          minimum: 100
        },
        hotExit: {
          type: "string",
          description: "Hot exit behavior",
          enum: ["off", "onExit", "onExitAndWindowClose"],
          default: "onExit"
        },
        trimTrailingWhitespace: {
          type: "boolean",
          description: "Trim trailing whitespace on save",
          default: false
        },
        insertFinalNewline: {
          type: "boolean",
          description: "Insert final newline on save",
          default: false
        },
        trimFinalNewlines: {
          type: "boolean",
          description: "Trim final newlines on save",
          default: false
        },
        encoding: {
          type: "string",
          description: "Default file encoding",
          default: "utf8"
        },
        eol: {
          type: "string",
          description: "End of line character",
          enum: ["auto", "\n", "\r\n"],
          default: "auto"
        }
      }
    },
    explorer: {
      type: "object",
      description: "File explorer settings",
      properties: {
        compactFolders: {
          type: "boolean",
          description: "Compact single-child folders",
          default: true
        },
        fileNesting: {
          type: "object",
          description: "File nesting configuration",
          properties: {
            enabled: {
              type: "boolean",
              description: "Enable file nesting",
              default: true
            },
            patterns: {
              type: "object",
              description: "File nesting patterns",
              additionalProperties: { type: "string" }
            }
          }
        }
      }
    },
    zenMode: {
      type: "object",
      description: "Zen mode settings",
      properties: {
        hideSidebar: {
          type: "boolean",
          description: "Hide sidebar in zen mode",
          default: true
        },
        hideStatusBar: {
          type: "boolean",
          description: "Hide status bar in zen mode",
          default: true
        },
        hideMenuBar: {
          type: "boolean",
          description: "Hide menu bar in zen mode",
          default: true
        },
        hidePanel: {
          type: "boolean",
          description: "Hide bottom panel in zen mode",
          default: true
        },
        centerLayout: {
          type: "boolean",
          description: "Center editor layout in zen mode",
          default: true
        },
        maxWidth: {
          type: "string",
          description: "Max width for centered layout",
          default: "900px"
        },
        fullScreen: {
          type: "boolean",
          description: "Enter fullscreen in zen mode",
          default: false
        },
        showLineNumbers: {
          type: "boolean",
          description: "Show line numbers in zen mode",
          default: true
        },
        silenceNotifications: {
          type: "boolean",
          description: "Silence notifications in zen mode",
          default: true
        }
      }
    },
    vimEnabled: {
      type: "boolean",
      description: "Enable Vim keybindings",
      default: false
    },
    languageOverrides: {
      type: "object",
      description: "Language-specific editor settings overrides",
      additionalProperties: false,
      patternProperties: {
        "^\\[.+\\]$": {
          type: "object",
          description: "Language-specific settings override (e.g., [python], [javascript])",
          properties: {
            fontFamily: {
              type: "string",
              description: "Font family for this language"
            },
            fontSize: {
              type: "number",
              description: "Font size in pixels",
              minimum: 8,
              maximum: 72
            },
            lineHeight: {
              type: "number",
              description: "Line height multiplier",
              minimum: 1,
              maximum: 3
            },
            tabSize: {
              type: "number",
              description: "Number of spaces per tab",
              enum: [2, 4, 8]
            },
            insertSpaces: {
              type: "boolean",
              description: "Insert spaces when pressing Tab"
            },
            wordWrap: {
              type: "string",
              description: "Word wrap mode",
              enum: ["off", "on", "wordWrapColumn", "bounded"]
            },
            lineNumbers: {
              type: "string",
              description: "Line numbers display mode",
              enum: ["on", "off", "relative", "interval"]
            },
            minimapEnabled: {
              type: "boolean",
              description: "Show minimap"
            },
            bracketPairColorization: {
              type: "boolean",
              description: "Enable bracket pair colorization"
            },
            autoClosingBrackets: {
              type: "string",
              description: "Auto-close brackets behavior",
              enum: ["always", "languageDefined", "beforeWhitespace", "never"]
            },
            autoIndent: {
              type: "boolean",
              description: "Enable automatic indentation"
            },
            formatOnSave: {
              type: "boolean",
              description: "Format document on save"
            },
            formatOnPaste: {
              type: "boolean",
              description: "Format pasted content"
            },
            cursorStyle: {
              type: "string",
              description: "Cursor style",
              enum: ["line", "block", "underline", "line-thin", "block-outline", "underline-thin"]
            },
            renderWhitespace: {
              type: "string",
              description: "Render whitespace characters",
              enum: ["none", "boundary", "selection", "trailing", "all"]
            },
            guidesIndentation: {
              type: "boolean",
              description: "Show indentation guides"
            },
            guidesBracketPairs: {
              type: "boolean",
              description: "Show bracket pair guides"
            },
            foldingEnabled: {
              type: "boolean",
              description: "Enable code folding"
            },
            stickyScrollEnabled: {
              type: "boolean",
              description: "Enable sticky scroll"
            },
            linkedEditing: {
              type: "boolean",
              description: "Enable linked editing for HTML tags"
            }
          },
          additionalProperties: false
        }
      },
      examples: [
        {
          "[python]": { "tabSize": 4, "insertSpaces": true },
          "[javascript]": { "tabSize": 2, "insertSpaces": true },
          "[go]": { "tabSize": 4, "insertSpaces": false },
          "[markdown]": { "wordWrap": "on" }
        }
      ]
    }
  },
  patternProperties: {
    "^\\[.+\\]$": {
      type: "object",
      description: "Language-specific settings override (VS Code-style, e.g., [python])",
      properties: {
        tabSize: {
          type: "number",
          description: "Number of spaces per tab",
          enum: [2, 4, 8]
        },
        insertSpaces: {
          type: "boolean",
          description: "Insert spaces when pressing Tab"
        },
        wordWrap: {
          type: "string",
          description: "Word wrap mode",
          enum: ["off", "on", "wordWrapColumn", "bounded"]
        },
        formatOnSave: {
          type: "boolean",
          description: "Format document on save"
        },
        formatOnPaste: {
          type: "boolean",
          description: "Format pasted content"
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: false
};

// ============================================================================
// Types
// ============================================================================

interface JsonSettingsEditorProps {
  /** Initial scope to show */
  initialScope?: SettingsScope;
  /** Callback when settings are saved */
  onSave?: () => void;
  /** Callback when dirty state changes */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Initial state for showing default settings side panel */
  initialShowDefaults?: boolean;
}

interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

// ============================================================================
// Component
// ============================================================================

export function JsonSettingsEditor(props: JsonSettingsEditorProps) {
  const settings = useSettings();
  
  // State
  const [activeScope, setActiveScope] = createSignal<SettingsScope>(props.initialScope ?? "user");
  const [isDirty, setIsDirty] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveStatus, setSaveStatus] = createSignal<"idle" | "saved" | "error">("idle");
  const [validationErrors, setValidationErrors] = createSignal<ValidationError[]>([]);
  const [settingsPath, setSettingsPath] = createSignal<string>("");
  const [originalContent, setOriginalContent] = createSignal<string>("");
  const [showDefaultSettings, setShowDefaultSettings] = createSignal(props.initialShowDefaults ?? false);
  
  // Refs
  let containerRef: HTMLDivElement | undefined;
  let editorRef: Monaco.editor.IStandaloneCodeEditor | undefined;
  let monacoRef: typeof Monaco | undefined;
  let modelRef: Monaco.editor.ITextModel | undefined;
  let disposables: Monaco.IDisposable[] = [];

  // Computed
  const hasWorkspace = createMemo(() => settings.hasWorkspace());
  const workspaceName = createMemo(() => {
    const path = settings.workspacePath();
    if (!path) return null;
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || parts[parts.length - 2];
  });

  // Load settings content as JSON string
  const loadSettingsContent = async (scope: SettingsScope): Promise<string> => {
    try {
      if (scope === "user") {
        // Export user settings as JSON
        const json = await settings.exportSettings();
        return json;
      } else {
        // Get workspace settings
        const wsSettings = settings.workspaceSettings();
        return JSON.stringify(wsSettings, null, 2);
      }
    } catch (e) {
      console.error("[JsonSettingsEditor] Failed to load settings:", e);
      return scope === "user" 
        ? JSON.stringify(DEFAULT_SETTINGS, null, 2)
        : "{}";
    }
  };

  // Get settings path
  const loadSettingsPath = async (scope: SettingsScope): Promise<string> => {
    if (scope === "user") {
      return await settings.getSettingsPath();
    } else {
      const wsPath = settings.workspacePath();
      return wsPath ? `${wsPath}/.cortex/settings.json` : "";
    }
  };

  // Initialize Monaco editor
  const initializeEditor = async () => {
    if (!containerRef) return;

    try {
      const manager = MonacoManager.getInstance();
      monacoRef = await manager.ensureLoaded();
      
      // Configure JSON defaults with schema
      const languagesWithJson = monacoRef.languages as unknown as MonacoLanguagesWithJson;
      const jsonDefaults = languagesWithJson.json?.jsonDefaults;
      if (jsonDefaults) {
        jsonDefaults.setDiagnosticsOptions({
          validate: true,
          allowComments: true,
          schemas: [
            {
              uri: "cortex://schemas/settings.json",
              fileMatch: ["**/settings.json", "cortex-settings-user", "cortex-settings-workspace"],
              schema: cortex_SETTINGS_SCHEMA
            }
          ],
          enableSchemaRequest: false
        });
      }

      // Load initial content
      const content = await loadSettingsContent(activeScope());
      const path = await loadSettingsPath(activeScope());
      setSettingsPath(path);
      setOriginalContent(content);

      // Create model with JSONC language
      const modelUri = monacoRef.Uri.parse(`cortex-settings-${activeScope()}`);
      modelRef = monacoRef.editor.createModel(content, "json", modelUri);

      // Create editor
      editorRef = monacoRef.editor.create(containerRef, {
        model: modelRef,
        theme: "cortex-dark",
        language: "json",
        automaticLayout: true,
        fontSize: 13,
        fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
        lineNumbers: "on",
        minimap: { enabled: true, maxColumn: 80 },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        wrappingIndent: "indent",
        tabSize: 2,
        insertSpaces: true,
        formatOnPaste: true,
        folding: true,
        foldingStrategy: "indentation",
        showFoldingControls: "mouseover",
        bracketPairColorization: { enabled: true },
        guides: {
          indentation: true,
          bracketPairs: true
        },
        renderWhitespace: "selection",
        quickSuggestions: { strings: true, other: true, comments: true },
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnCommitCharacter: true,
        tabCompletion: "on",
        snippetSuggestions: "top",
        // JSON-specific
        comments: { insertSpace: true },
      });

      // Setup event listeners
      setupEventListeners();

      // Focus editor
      editorRef.focus();

    } catch (e) {
      console.error("[JsonSettingsEditor] Failed to initialize editor:", e);
    }
  };

  // Setup editor event listeners
  const setupEventListeners = () => {
    if (!editorRef || !monacoRef || !modelRef) return;

    // Track content changes
    const contentChangeDisposable = modelRef.onDidChangeContent(() => {
      const currentContent = modelRef?.getValue() ?? "";
      const hasChanges = currentContent !== originalContent();
      setIsDirty(hasChanges);
      props.onDirtyChange?.(hasChanges);
      
      // Validate on change
      validateContent(currentContent);
    });
    disposables.push(contentChangeDisposable);

    // Ctrl+S to save
    // Note: addCommand returns string | null (command ID), not a disposable
    editorRef.addCommand(
      monacoRef.KeyMod.CtrlCmd | monacoRef.KeyCode.KeyS,
      async () => {
        await saveSettings();
      }
    );

    // Format document command - addAction returns IDisposable
    const formatActionDisposable = editorRef.addAction({
      id: "cortex.formatDocument",
      label: "Format Document",
      keybindings: [
        monacoRef.KeyMod.Shift | monacoRef.KeyMod.Alt | monacoRef.KeyCode.KeyF
      ],
      run: async () => {
        await formatDocument();
      }
    });
    disposables.push(formatActionDisposable);

    // Track marker changes for validation errors
    const markerDisposable = monacoRef.editor.onDidChangeMarkers((uris) => {
      if (!modelRef) return;
      const modelUri = modelRef.uri.toString();
      if (uris.some(uri => uri.toString() === modelUri)) {
        const markers = monacoRef!.editor.getModelMarkers({ resource: modelRef.uri });
        const errors: ValidationError[] = markers.map(m => ({
          line: m.startLineNumber,
          column: m.startColumn,
          message: m.message,
          severity: m.severity === monacoRef!.MarkerSeverity.Error ? "error" : "warning"
        }));
        setValidationErrors(errors);
      }
    });
    disposables.push(markerDisposable);
  };

  // Validate JSON content
  const validateContent = (content: string) => {
    try {
      JSON.parse(content);
      // JSON is valid - Monaco will handle schema validation
    } catch (e) {
      // JSON parse error - Monaco will show this
    }
  };

  // Format the document
  const formatDocument = async () => {
    if (!editorRef) return;
    
    try {
      await editorRef.getAction("editor.action.formatDocument")?.run();
    } catch (e) {
      console.error("[JsonSettingsEditor] Format failed:", e);
    }
  };

  // Save settings
  const saveSettings = async () => {
    if (!modelRef || isSaving()) return;

    const content = modelRef.getValue();
    
    // Validate JSON first
    let parsedSettings: any;
    try {
      parsedSettings = JSON.parse(content);
    } catch (e) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    }

    // Check for validation errors
    if (validationErrors().some(e => e.severity === "error")) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    }

    setIsSaving(true);

    try {
      // Format before save
      await formatDocument();
      const formattedContent = modelRef.getValue();

      if (activeScope() === "user") {
        // Import user settings
        await settings.importSettings(formattedContent);
      } else {
        // Save workspace settings
        // Update workspace settings through context
        const wsPath = settings.workspacePath();
        if (wsPath) {
          await invoke("settings_set_workspace_file", {
            workspacePath: wsPath,
            content: parsedSettings
          });
          // Reload to sync state
          await settings.loadWorkspaceSettings(wsPath);
        }
      }

      setOriginalContent(formattedContent);
      setIsDirty(false);
      props.onDirtyChange?.(false);
      setSaveStatus("saved");
      props.onSave?.();
      
      setTimeout(() => setSaveStatus("idle"), 2000);

    } catch (e) {
      console.error("[JsonSettingsEditor] Save failed:", e);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Switch between user and workspace scope
  const switchScope = async (scope: SettingsScope) => {
    if (scope === activeScope()) return;
    
    // Warn if dirty
    if (isDirty()) {
      const confirmed = window.confirm(
        "You have unsaved changes. Switch anyway? Changes will be lost."
      );
      if (!confirmed) return;
    }

    setActiveScope(scope);
    
    // Load new content
    const content = await loadSettingsContent(scope);
    const path = await loadSettingsPath(scope);
    
    setSettingsPath(path);
    setOriginalContent(content);
    
    if (modelRef) {
      modelRef.setValue(content);
    }
    
    setIsDirty(false);
    setValidationErrors([]);
    props.onDirtyChange?.(false);
  };

  // Reload settings from disk
  const reloadSettings = async () => {
    if (isDirty()) {
      const confirmed = window.confirm(
        "You have unsaved changes. Reload anyway? Changes will be lost."
      );
      if (!confirmed) return;
    }

    // Reload from backend
    await settings.loadSettings();
    if (activeScope() === "workspace" && settings.workspacePath()) {
      await settings.loadWorkspaceSettings(settings.workspacePath()!);
    }

    const content = await loadSettingsContent(activeScope());
    setOriginalContent(content);
    
    if (modelRef) {
      modelRef.setValue(content);
    }
    
    setIsDirty(false);
    setValidationErrors([]);
    props.onDirtyChange?.(false);
  };

  // Mount
  onMount(() => {
    initializeEditor();
  });

  // Cleanup
  onCleanup(() => {
    disposables.forEach(d => d?.dispose?.());
    disposables = [];
    modelRef?.dispose?.();
    editorRef?.dispose?.();
  });

  // Error count
  const errorCount = createMemo(() => 
    validationErrors().filter(e => e.severity === "error").length
  );
  const warningCount = createMemo(() => 
    validationErrors().filter(e => e.severity === "warning").length
  );

  return (
    <div class="json-settings-editor h-full flex flex-col bg-background">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-background-secondary">
        {/* Scope Tabs */}
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
            <button
              onClick={() => switchScope("user")}
              class={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeScope() === "user"
                  ? "bg-primary text-white"
                  : "text-foreground-muted hover:text-foreground hover:bg-background-tertiary"
              }`}
              title="User Settings (~/.cortex/settings.json)"
            >
              <Icon name="user" class="h-3.5 w-3.5" />
              User
            </button>
            <button
              onClick={() => switchScope("workspace")}
              disabled={!hasWorkspace()}
              class={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeScope() === "workspace"
                  ? "bg-purple-600 text-white"
                  : hasWorkspace()
                    ? "text-foreground-muted hover:text-foreground hover:bg-background-tertiary"
                    : "text-foreground-muted/50 cursor-not-allowed"
              }`}
              title={hasWorkspace() 
                ? `Workspace Settings (.cortex/settings.json in ${workspaceName()})` 
                : "No workspace open"}
            >
              <Icon name="folder" class="h-3.5 w-3.5" />
              Workspace
            </button>
          </div>
          
          {/* File path indicator */}
          <Show when={settingsPath()}>
            <span class="text-xs text-foreground-muted truncate max-w-[300px]" title={settingsPath()}>
              {settingsPath()}
            </span>
          </Show>
        </div>

        {/* Actions */}
        <div class="flex items-center gap-2">
          {/* Show Default Settings Toggle */}
          <button
            onClick={() => setShowDefaultSettings(!showDefaultSettings())}
            class={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              showDefaultSettings()
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
                : "text-foreground-muted hover:text-foreground hover:bg-background-tertiary"
            }`}
            title={showDefaultSettings() ? "Hide Default Settings" : "Show Default Settings (side-by-side)"}
          >
            <Icon name="columns" class="h-3.5 w-3.5" />
            {showDefaultSettings() ? "Hide Defaults" : "Show Defaults"}
          </button>
          
          <div class="w-px h-4 bg-border" />
          
          {/* Validation status */}
          <Show when={errorCount() > 0 || warningCount() > 0}>
            <div class="flex items-center gap-2 text-xs">
              <Show when={errorCount() > 0}>
                <span class="flex items-center gap-1 text-red-400">
                  <Icon name="circle-exclamation" class="h-3.5 w-3.5" />
                  {errorCount()} error{errorCount() !== 1 ? "s" : ""}
                </span>
              </Show>
              <Show when={warningCount() > 0}>
                <span class="flex items-center gap-1 text-yellow-400">
                  <Icon name="circle-exclamation" class="h-3.5 w-3.5" />
                  {warningCount()} warning{warningCount() !== 1 ? "s" : ""}
                </span>
              </Show>
            </div>
          </Show>

          {/* Save status indicator */}
          <Show when={saveStatus() !== "idle"}>
            <span class={`flex items-center gap-1 text-xs ${
              saveStatus() === "saved" ? "text-green-400" : "text-red-400"
            }`}>
              <Show when={saveStatus() === "saved"}>
                <Icon name="check" class="h-3.5 w-3.5" />
                Saved
              </Show>
              <Show when={saveStatus() === "error"}>
                <Icon name="circle-exclamation" class="h-3.5 w-3.5" />
                Save failed
              </Show>
            </span>
          </Show>

          {/* Dirty indicator */}
          <Show when={isDirty()}>
            <span class="text-xs text-foreground-muted">
              Modified
            </span>
          </Show>

          {/* Reload button */}
          <button
            onClick={reloadSettings}
            class="p-1.5 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground transition-colors"
            title="Reload from disk"
          >
            <Icon name="rotate" class="h-4 w-4" />
          </button>

          {/* Save button */}
          <button
            onClick={saveSettings}
            disabled={!isDirty() || isSaving() || errorCount() > 0}
            class={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              isDirty() && !isSaving() && errorCount() === 0
                ? "bg-primary text-white hover:bg-primary/90"
                : "bg-background-tertiary text-foreground-muted cursor-not-allowed"
            }`}
            title="Save (Ctrl+S)"
          >
            <Icon name="floppy-disk" class="h-3.5 w-3.5" />
            {isSaving() ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <Show when={activeScope() === "workspace"}>
        <div class="px-4 py-2 bg-purple-500/10 border-b border-purple-500/20">
          <div class="flex items-center gap-2 text-xs text-purple-400">
            <Icon name="circle-info" class="h-3.5 w-3.5 shrink-0" />
            <span>
              Workspace settings override user settings for <strong>{workspaceName()}</strong> only.
              Only include settings you want to override.
            </span>
          </div>
        </div>
      </Show>

      {/* Editor Container - with optional split view */}
      <div class="flex-1 min-h-0 flex">
        {/* Default Settings Panel (left side) */}
        <Show when={showDefaultSettings()}>
          <div class="w-1/2 border-r border-border flex flex-col min-h-0">
            <DefaultSettingsView />
          </div>
        </Show>
        
        {/* User/Workspace Settings Editor (right side or full width) */}
        <div 
          ref={containerRef!} 
          class={`min-h-0 ${showDefaultSettings() ? "w-1/2" : "flex-1"}`}
        />
      </div>

      {/* Footer with shortcuts */}
      <div class="flex items-center justify-between px-4 py-1.5 border-t border-border bg-background-secondary text-xs text-foreground-muted">
        <div class="flex items-center gap-4">
          <span>
            <kbd class="px-1 py-0.5 bg-background-tertiary rounded text-[10px]">Ctrl+S</kbd> Save
          </span>
          <span>
            <kbd class="px-1 py-0.5 bg-background-tertiary rounded text-[10px]">Shift+Alt+F</kbd> Format
          </span>
          <span>
            <kbd class="px-1 py-0.5 bg-background-tertiary rounded text-[10px]">Ctrl+Space</kbd> Autocomplete
          </span>
        </div>
        <div class="flex items-center gap-2">
          <Icon name="code" class="h-3.5 w-3.5" />
          <span>JSON with Comments</span>
        </div>
      </div>
    </div>
  );
}

export default JsonSettingsEditor;


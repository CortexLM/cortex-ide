import { createContext, useContext, ParentProps, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Snippet Types
// ============================================================================

/** A single placeholder in a snippet body */
export interface SnippetPlaceholder {
  index: number;
  defaultValue: string;
  start: number;
  end: number;
  choices?: string[];
  /** All ranges for this placeholder index (for mirror placeholders) */
  mirrorRanges?: Array<{ start: number; end: number }>;
}

/** Parsed representation of a snippet with resolved placeholders */
export interface ParsedSnippet {
  text: string;
  placeholders: SnippetPlaceholder[];
  /** Map of placeholder index to all its ranges (for mirror placeholders) */
  placeholderMirrors: Map<number, Array<{ start: number; end: number }>>;
}

/** VSCode-compatible snippet format for import/export */
export interface VSCodeSnippetFormat {
  prefix: string | string[];
  body: string | string[];
  description?: string;
  scope?: string;
}

/** VSCode snippet file format */
export interface VSCodeSnippetFile {
  [name: string]: VSCodeSnippetFormat;
}

/** Snippet definition as stored/loaded */
export interface Snippet {
  name: string;
  prefix: string;
  body: string[];
  description: string;
  scope?: string;
}

/** A collection of snippets keyed by name */
export interface SnippetCollection {
  [name: string]: Snippet;
}

/** Snippet file metadata */
export interface SnippetFile {
  path: string;
  language: string;
  snippets: SnippetCollection;
  isGlobal: boolean;
  isProjectLocal?: boolean;
}

/** Active snippet session during placeholder navigation */
export interface ActiveSnippetSession {
  fileId: string;
  parsedSnippet: ParsedSnippet;
  currentPlaceholderIndex: number;
  startPosition: { line: number; column: number };
  insertedText: string;
  /** Track placeholder values for mirror updates */
  placeholderValues: Map<number, string>;
}

// ============================================================================
// Snippet State
// ============================================================================

interface SnippetsState {
  snippetFiles: SnippetFile[];
  userSnippetsDir: string;
  activeSession: ActiveSnippetSession | null;
  showPanel: boolean;
  editingSnippet: { snippet: Snippet; language: string } | null;
  loading: boolean;
  error: string | null;
}

interface SnippetsContextValue {
  state: SnippetsState;
  // Snippet management
  loadSnippets: () => Promise<void>;
  loadProjectSnippets: (projectPath: string) => Promise<void>;
  getSnippetsForLanguage: (language: string) => Snippet[];
  getAllSnippets: () => { language: string; snippet: Snippet; isProjectLocal?: boolean }[];
  addSnippet: (language: string, snippet: Snippet) => Promise<void>;
  updateSnippet: (language: string, name: string, snippet: Snippet) => Promise<void>;
  deleteSnippet: (language: string, name: string) => Promise<void>;
  // Import/Export
  importSnippets: (content: string, language: string) => Promise<{ imported: number; errors: string[] }>;
  exportSnippets: (language?: string) => string;
  exportSnippetsForLanguage: (language: string) => string;
  // Panel controls
  openPanel: () => void;
  closePanel: () => void;
  editSnippet: (snippet: Snippet, language: string) => void;
  createNewSnippet: (language?: string) => void;
  closeEditor: () => void;
  // Snippet parsing and expansion
  parseSnippet: (body: string) => ParsedSnippet;
  expandSnippet: (snippet: Snippet, fileId: string, position: { line: number; column: number }) => { text: string; session: ActiveSnippetSession } | null;
  // Placeholder navigation
  startSession: (session: ActiveSnippetSession) => void;
  nextPlaceholder: () => SnippetPlaceholder | null;
  previousPlaceholder: () => SnippetPlaceholder | null;
  getCurrentPlaceholder: () => SnippetPlaceholder | null;
  updatePlaceholderValue: (index: number, value: string) => void;
  getMirrorRanges: (placeholderIndex: number) => Array<{ start: number; end: number }>;
  endSession: () => void;
  isSessionActive: () => boolean;
  // Monaco integration
  getMonacoCompletionItems: (language: string, model: unknown, position: unknown) => unknown[];
  registerSnippetProvider: (monaco: unknown, language: string) => unknown;
}

const SnippetsContext = createContext<SnippetsContextValue>();

const SNIPPETS_STORAGE_KEY = "cortex-user-snippets";

// ============================================================================
// Snippet Parser
// ============================================================================

/**
 * Parse a snippet body string into text with resolved placeholders.
 * Supports:
 * - $1, $2, etc. - Simple tabstops
 * - ${1:default} - Tabstops with default values
 * - ${1|choice1,choice2|} - Tabstops with choices
 * - $0 - Final cursor position
 * - Nested placeholders
 * - Escaped characters (\$, \\, \})
 */
function parseSnippetBody(body: string): ParsedSnippet {
  let text = "";
  const placeholders: Map<number, SnippetPlaceholder[]> = new Map();
  const placeholderMirrors: Map<number, Array<{ start: number; end: number }>> = new Map();
  let source = body;

  const parseText = (nested: boolean): string => {
    let result = "";
    
    while (source.length > 0) {
      const char = source[0];
      
      if (char === "$") {
        source = source.slice(1);
        const placeholder = parseTabstop();
        if (placeholder) {
          const currentStart = text.length + result.length;
          const currentEnd = currentStart + placeholder.defaultValue.length;
          
          // Track mirror ranges for this placeholder index
          const mirrors = placeholderMirrors.get(placeholder.index) || [];
          mirrors.push({ start: currentStart, end: currentEnd });
          placeholderMirrors.set(placeholder.index, mirrors);
          
          const existing = placeholders.get(placeholder.index) || [];
          existing.push({
            ...placeholder,
            start: currentStart,
            end: currentEnd,
          });
          placeholders.set(placeholder.index, existing);
          result += placeholder.defaultValue;
        }
      } else if (char === "\\") {
        source = source.slice(1);
        if (source.length > 0) {
          const nextChar = source[0];
          if (nextChar === "$" || nextChar === "\\" || nextChar === "}") {
            result += nextChar;
            source = source.slice(1);
          } else {
            result += "\\";
          }
        } else {
          result += "\\";
        }
      } else if (char === "}" && nested) {
        return result;
      } else {
        result += char;
        source = source.slice(1);
      }
    }
    
    return result;
  };

  const parseTabstop = (): { index: number; defaultValue: string; choices?: string[] } | null => {
    if (source.length === 0) return null;

    if (source[0] === "{") {
      source = source.slice(1);
      
      // Parse tabstop index
      let indexStr = "";
      while (source.length > 0 && /[0-9]/.test(source[0])) {
        indexStr += source[0];
        source = source.slice(1);
      }
      
      if (indexStr.length === 0) return null;
      const index = parseInt(indexStr, 10);
      
      let defaultValue = "";
      let choices: string[] | undefined;
      
      // Check for choice syntax ${1|choice1,choice2|}
      if (source[0] === "|") {
        source = source.slice(1);
        const result = parseChoices();
        choices = result.choices;
        defaultValue = result.defaultValue;
      } else if (source[0] === ":") {
        source = source.slice(1);
        defaultValue = parseText(true);
      }
      
      if (source[0] === "}") {
        source = source.slice(1);
      }
      
      return { index, defaultValue, choices };
    } else {
      // Simple tabstop $1, $2, etc.
      let indexStr = "";
      while (source.length > 0 && /[0-9]/.test(source[0])) {
        indexStr += source[0];
        source = source.slice(1);
      }
      
      if (indexStr.length === 0) return null;
      return { index: parseInt(indexStr, 10), defaultValue: "" };
    }
  };

  const parseChoices = (): { choices: string[]; defaultValue: string } => {
    const choices: string[] = [];
    let currentChoice = "";
    let defaultValue = "";
    let isFirst = true;
    
    while (source.length > 0) {
      const char = source[0];
      
      if (char === "\\") {
        source = source.slice(1);
        if (source.length > 0) {
          currentChoice += source[0];
          source = source.slice(1);
        }
      } else if (char === ",") {
        if (isFirst) {
          defaultValue = currentChoice;
          isFirst = false;
        }
        choices.push(currentChoice);
        currentChoice = "";
        source = source.slice(1);
      } else if (char === "|") {
        if (isFirst) {
          defaultValue = currentChoice;
        }
        choices.push(currentChoice);
        source = source.slice(1);
        break;
      } else {
        currentChoice += char;
        source = source.slice(1);
      }
    }
    
    return { choices, defaultValue };
  };

  text = parseText(false);

  // Convert map to sorted array of placeholders, grouping by index
  const sortedPlaceholders: SnippetPlaceholder[] = [];
  const indices = Array.from(placeholders.keys()).sort((a, b) => {
    // $0 (final position) should always be last
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
  });

  const processedIndices = new Set<number>();
  
  for (const index of indices) {
    if (processedIndices.has(index)) continue;
    processedIndices.add(index);
    
    const ps = placeholders.get(index) || [];
    const mirrors = placeholderMirrors.get(index) || [];
    
    // Only add the first placeholder for each index, but include all mirror ranges
    if (ps.length > 0) {
      const primary = ps[0];
      sortedPlaceholders.push({
        ...primary,
        mirrorRanges: mirrors.length > 1 ? mirrors : undefined,
      });
    }
  }

  // If no $0 exists, add an implicit one at the end
  if (!placeholders.has(0)) {
    sortedPlaceholders.push({
      index: 0,
      defaultValue: "",
      start: text.length,
      end: text.length,
      choices: undefined,
    });
  }

  return { text, placeholders: sortedPlaceholders, placeholderMirrors };
}

// ============================================================================
// Snippets Provider
// ============================================================================

export function SnippetsProvider(props: ParentProps) {
  const [state, setState] = createStore<SnippetsState>({
    snippetFiles: [],
    userSnippetsDir: "",
    activeSession: null,
    showPanel: false,
    editingSnippet: null,
    loading: false,
    error: null,
  });

  // Load snippets from storage on mount
  onMount(() => {
    loadSnippets();
  });

  // Handle Tab key for placeholder navigation
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.activeSession) return;
      
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
          previousPlaceholder();
        } else {
          nextPlaceholder();
        }
      } else if (e.key === "Escape") {
        endSession();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const loadSnippets = async (): Promise<void> => {
    setState("loading", true);
    setState("error", null);

    try {
      // Try to get user snippets directory from Tauri
      let userSnippetsDir = "";
      try {
        const homeDir = await invoke<string>("get_home_dir");
        userSnippetsDir = `${homeDir}/.cortex/snippets`;
        setState("userSnippetsDir", userSnippetsDir);
      } catch {
        // Fallback for browser testing
        userSnippetsDir = "~/.cortex/snippets";
        setState("userSnippetsDir", userSnippetsDir);
      }

      // Load snippets from localStorage for now (file system handled by Tauri)
      const stored = localStorage.getItem(SNIPPETS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SnippetFile[];
        setState("snippetFiles", parsed);
      } else {
        // Initialize with default snippets
        const defaultSnippets = getDefaultSnippets();
        setState("snippetFiles", defaultSnippets);
        localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(defaultSnippets));
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
    } finally {
      setState("loading", false);
    }
  };

  const getSnippetsForLanguage = (language: string): Snippet[] => {
    const result: Snippet[] = [];
    const normalizedLang = normalizeLanguage(language);

    for (const file of state.snippetFiles) {
      if (file.isGlobal || file.language === normalizedLang) {
        for (const snippet of Object.values(file.snippets)) {
          // Check scope if defined
          if (!snippet.scope || snippet.scope === normalizedLang || snippet.scope === "global") {
            result.push(snippet);
          }
        }
      }
    }

    return result;
  };

  const getAllSnippets = (): { language: string; snippet: Snippet; isProjectLocal?: boolean }[] => {
    const result: { language: string; snippet: Snippet; isProjectLocal?: boolean }[] = [];

    for (const file of state.snippetFiles) {
      for (const snippet of Object.values(file.snippets)) {
        result.push({
          language: file.isGlobal ? "global" : file.language,
          snippet,
          isProjectLocal: file.isProjectLocal,
        });
      }
    }

    return result;
  };

  const addSnippet = async (language: string, snippet: Snippet): Promise<void> => {
    const normalizedLang = language === "global" ? "global" : normalizeLanguage(language);
    const isGlobal = normalizedLang === "global";

    setState(
      produce((s) => {
        let file = s.snippetFiles.find(
          (f) => (isGlobal && f.isGlobal) || (!isGlobal && f.language === normalizedLang)
        );

        if (!file) {
          file = {
            path: `${s.userSnippetsDir}/${normalizedLang}.json`,
            language: normalizedLang,
            snippets: {},
            isGlobal,
          };
          s.snippetFiles.push(file);
        }

        file.snippets[snippet.name] = snippet;
      })
    );

    await saveSnippets();
  };

  const updateSnippet = async (language: string, name: string, snippet: Snippet): Promise<void> => {
    const normalizedLang = language === "global" ? "global" : normalizeLanguage(language);
    const isGlobal = normalizedLang === "global";

    setState(
      produce((s) => {
        const file = s.snippetFiles.find(
          (f) => (isGlobal && f.isGlobal) || (!isGlobal && f.language === normalizedLang)
        );

        if (file) {
          // Remove old entry if name changed
          if (name !== snippet.name) {
            delete file.snippets[name];
          }
          file.snippets[snippet.name] = snippet;
        }
      })
    );

    await saveSnippets();
  };

  const deleteSnippet = async (language: string, name: string): Promise<void> => {
    const normalizedLang = language === "global" ? "global" : normalizeLanguage(language);
    const isGlobal = normalizedLang === "global";

    setState(
      produce((s) => {
        const file = s.snippetFiles.find(
          (f) => (isGlobal && f.isGlobal) || (!isGlobal && f.language === normalizedLang)
        );

        if (file) {
          delete file.snippets[name];
        }
      })
    );

    await saveSnippets();
  };

  const saveSnippets = async (): Promise<void> => {
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(state.snippetFiles));
  };

  const loadProjectSnippets = async (projectPath: string): Promise<void> => {
    try {
      // Try to load project-local snippets from .cortex/snippets.json
      const snippetsPath = `${projectPath}/.cortex/snippets.json`;
      const content = await invoke<string>("fs_read_file", { path: snippetsPath }).catch(() => null);
      
      if (content) {
        const parsed = JSON.parse(content) as VSCodeSnippetFile;
        const snippets: SnippetCollection = {};
        
        for (const [name, snippetDef] of Object.entries(parsed)) {
          const prefix = Array.isArray(snippetDef.prefix) ? snippetDef.prefix[0] : snippetDef.prefix;
          const body = Array.isArray(snippetDef.body) ? snippetDef.body : [snippetDef.body];
          
          snippets[name] = {
            name,
            prefix,
            body,
            description: snippetDef.description || "",
            scope: snippetDef.scope,
          };
        }
        
        // Remove any existing project-local snippets
        setState(
          produce((s) => {
            s.snippetFiles = s.snippetFiles.filter((f) => !f.isProjectLocal);
            s.snippetFiles.push({
              path: snippetsPath,
              language: "project",
              snippets,
              isGlobal: false,
              isProjectLocal: true,
            });
          })
        );
      }
    } catch {
      // Project snippets are optional, so we silently ignore errors
    }
  };

  const importSnippets = async (
    content: string,
    language: string
  ): Promise<{ imported: number; errors: string[] }> => {
    const errors: string[] = [];
    let imported = 0;
    
    try {
      const parsed = JSON.parse(content) as VSCodeSnippetFile;
      
      for (const [name, snippetDef] of Object.entries(parsed)) {
        try {
          const prefix = Array.isArray(snippetDef.prefix) ? snippetDef.prefix[0] : snippetDef.prefix;
          const body = Array.isArray(snippetDef.body) ? snippetDef.body : [snippetDef.body];
          
          if (!prefix || !body || body.length === 0) {
            errors.push(`Snippet "${name}": missing prefix or body`);
            continue;
          }
          
          const snippet: Snippet = {
            name,
            prefix,
            body,
            description: snippetDef.description || "",
            scope: snippetDef.scope || (language === "global" ? undefined : language),
          };
          
          await addSnippet(language, snippet);
          imported++;
        } catch (e) {
          errors.push(`Snippet "${name}": ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      errors.push(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    return { imported, errors };
  };

  const exportSnippets = (language?: string): string => {
    const output: VSCodeSnippetFile = {};
    
    for (const file of state.snippetFiles) {
      if (file.isProjectLocal) continue; // Don't export project-local snippets
      if (language && file.language !== language && !file.isGlobal) continue;
      
      for (const [name, snippet] of Object.entries(file.snippets)) {
        output[name] = {
          prefix: snippet.prefix,
          body: snippet.body,
          description: snippet.description || undefined,
          scope: snippet.scope,
        };
      }
    }
    
    return JSON.stringify(output, null, 2);
  };

  const exportSnippetsForLanguage = (language: string): string => {
    const output: VSCodeSnippetFile = {};
    const normalizedLang = language === "global" ? "global" : normalizeLanguage(language);
    
    for (const file of state.snippetFiles) {
      if (file.isProjectLocal) continue;
      if (file.language !== normalizedLang && !file.isGlobal) continue;
      
      for (const [name, snippet] of Object.entries(file.snippets)) {
        output[name] = {
          prefix: snippet.prefix,
          body: snippet.body,
          description: snippet.description || undefined,
          scope: snippet.scope,
        };
      }
    }
    
    return JSON.stringify(output, null, 2);
  };

  const openPanel = () => {
    setState("showPanel", true);
  };

  const closePanel = () => {
    setState("showPanel", false);
    setState("editingSnippet", null);
  };

  const editSnippet = (snippet: Snippet, language: string) => {
    setState("editingSnippet", { snippet, language });
  };

  const createNewSnippet = (language?: string) => {
    setState("editingSnippet", {
      snippet: {
        name: "",
        prefix: "",
        body: [""],
        description: "",
        scope: language,
      },
      language: language || "global",
    });
  };

  const closeEditor = () => {
    setState("editingSnippet", null);
  };

  const parseSnippet = (body: string): ParsedSnippet => {
    return parseSnippetBody(body);
  };

  const expandSnippet = (
    snippet: Snippet,
    fileId: string,
    position: { line: number; column: number }
  ): { text: string; session: ActiveSnippetSession } | null => {
    const bodyText = snippet.body.join("\n");
    const parsed = parseSnippetBody(bodyText);

    // Initialize placeholder values with default values
    const placeholderValues = new Map<number, string>();
    for (const p of parsed.placeholders) {
      if (!placeholderValues.has(p.index)) {
        placeholderValues.set(p.index, p.defaultValue);
      }
    }

    const session: ActiveSnippetSession = {
      fileId,
      parsedSnippet: parsed,
      currentPlaceholderIndex: 0,
      startPosition: position,
      insertedText: parsed.text,
      placeholderValues,
    };

    return { text: parsed.text, session };
  };

  const startSession = (session: ActiveSnippetSession) => {
    setState("activeSession", session);
    
    // Dispatch event for editor to handle
    window.dispatchEvent(
      new CustomEvent("snippet-session-start", {
        detail: {
          session,
          placeholder: session.parsedSnippet.placeholders[0] || null,
        },
      })
    );
  };

  const nextPlaceholder = (): SnippetPlaceholder | null => {
    const session = state.activeSession;
    if (!session) return null;

    const placeholders = session.parsedSnippet.placeholders;
    const nextIndex = session.currentPlaceholderIndex + 1;

    // Check if we've gone past all placeholders
    if (nextIndex >= placeholders.length) {
      // Find $0 placeholder or end session
      const finalPlaceholder = placeholders.find((p) => p.index === 0);
      endSession();
      return finalPlaceholder || null;
    }

    // Move to next placeholder
    setState("activeSession", "currentPlaceholderIndex", nextIndex);
    const placeholder = placeholders[nextIndex];

    window.dispatchEvent(
      new CustomEvent("snippet-placeholder-change", {
        detail: { session: state.activeSession, placeholder },
      })
    );

    return placeholder;
  };

  const previousPlaceholder = (): SnippetPlaceholder | null => {
    const session = state.activeSession;
    if (!session) return null;

    const placeholders = session.parsedSnippet.placeholders;
    const prevIndex = Math.max(0, session.currentPlaceholderIndex - 1);

    setState("activeSession", "currentPlaceholderIndex", prevIndex);
    const placeholder = placeholders[prevIndex];

    window.dispatchEvent(
      new CustomEvent("snippet-placeholder-change", {
        detail: { session: state.activeSession, placeholder },
      })
    );

    return placeholder;
  };

  const getCurrentPlaceholder = (): SnippetPlaceholder | null => {
    const session = state.activeSession;
    if (!session) return null;

    return session.parsedSnippet.placeholders[session.currentPlaceholderIndex] || null;
  };

  const endSession = () => {
    if (state.activeSession) {
      window.dispatchEvent(new CustomEvent("snippet-session-end"));
    }
    setState("activeSession", null);
  };

  const isSessionActive = (): boolean => {
    return state.activeSession !== null;
  };

  const updatePlaceholderValue = (index: number, value: string): void => {
    const session = state.activeSession;
    if (!session) return;
    
    session.placeholderValues.set(index, value);
    
    // Dispatch event for editor to update mirror placeholders
    const mirrors = session.parsedSnippet.placeholderMirrors.get(index);
    if (mirrors && mirrors.length > 1) {
      window.dispatchEvent(
        new CustomEvent("snippet-mirror-update", {
          detail: {
            session,
            placeholderIndex: index,
            newValue: value,
            mirrors,
          },
        })
      );
    }
  };

  const getMirrorRanges = (placeholderIndex: number): Array<{ start: number; end: number }> => {
    const session = state.activeSession;
    if (!session) return [];
    
    return session.parsedSnippet.placeholderMirrors.get(placeholderIndex) || [];
  };

  const getMonacoCompletionItems = (
    language: string,
    model: unknown,
    position: unknown
  ): unknown[] => {
    const snippets = getSnippetsForLanguage(language);
    const monaco = (window as unknown as Record<string, unknown>).monaco as {
      languages?: {
        CompletionItemKind?: { Snippet?: number };
        CompletionItemInsertTextRule?: { InsertAsSnippet?: number };
      };
    } | undefined;

    return snippets.map((snippet, index) => ({
      label: {
        label: snippet.prefix,
        description: snippet.description || snippet.name,
      },
      kind: monaco?.languages?.CompletionItemKind?.Snippet ?? 27,
      insertText: snippet.body.join("\n"),
      insertTextRules: monaco?.languages?.CompletionItemInsertTextRule?.InsertAsSnippet ?? 4,
      documentation: {
        value: `**${snippet.name}**\n\n${snippet.description || ""}\n\n\`\`\`\n${snippet.body.join("\n")}\n\`\`\``,
      },
      detail: `Snippet: ${snippet.name}`,
      sortText: `0_snippet_${String(index).padStart(5, "0")}`,
      range: model && position ? undefined : undefined,
    }));
  };

  /**
   * Register a Monaco completion provider for snippets.
   * Returns a disposable that should be disposed when no longer needed.
   */
  const registerSnippetProvider = (monacoInstance: unknown, language: string): unknown => {
    const monaco = monacoInstance as {
      languages: {
        registerCompletionItemProvider: (
          language: string,
          provider: {
            triggerCharacters?: string[];
            provideCompletionItems: (
              model: unknown,
              position: { lineNumber: number; column: number }
            ) => { suggestions: unknown[] };
          }
        ) => { dispose: () => void };
        CompletionItemKind: { Snippet: number };
        CompletionItemInsertTextRule: { InsertAsSnippet: number };
      };
    };

    if (!monaco?.languages?.registerCompletionItemProvider) {
      return { dispose: () => {} };
    }

    return monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: [],
      provideCompletionItems: (
        _model: unknown,
        _position: { lineNumber: number; column: number }
      ) => {
        const snippets = getSnippetsForLanguage(language);
        
        const suggestions = snippets.map((snippet, index) => ({
          label: {
            label: snippet.prefix,
            description: snippet.name,
            detail: snippet.description ? ` - ${snippet.description}` : undefined,
          },
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.body.join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: [
              `**${snippet.name}**`,
              "",
              snippet.description || "",
              "",
              "```",
              snippet.body.join("\n"),
              "```",
            ].join("\n"),
          },
          detail: "Snippet",
          sortText: `!0_snippet_${String(index).padStart(5, "0")}`,
        }));

        return { suggestions };
      },
    });
  };

  return (
    <SnippetsContext.Provider
      value={{
        state,
        loadSnippets,
        loadProjectSnippets,
        getSnippetsForLanguage,
        getAllSnippets,
        addSnippet,
        updateSnippet,
        deleteSnippet,
        importSnippets,
        exportSnippets,
        exportSnippetsForLanguage,
        openPanel,
        closePanel,
        editSnippet,
        createNewSnippet,
        closeEditor,
        parseSnippet,
        expandSnippet,
        startSession,
        nextPlaceholder,
        previousPlaceholder,
        getCurrentPlaceholder,
        updatePlaceholderValue,
        getMirrorRanges,
        endSession,
        isSessionActive,
        getMonacoCompletionItems,
        registerSnippetProvider,
      }}
    >
      {props.children}
    </SnippetsContext.Provider>
  );
}

export function useSnippets() {
  const context = useContext(SnippetsContext);
  if (!context) {
    throw new Error("useSnippets must be used within SnippetsProvider");
  }
  return context;
}

// ============================================================================
// Utility Functions
// ============================================================================

function normalizeLanguage(language: string): string {
  const languageMap: Record<string, string> = {
    typescriptreact: "typescript",
    javascriptreact: "javascript",
    tsx: "typescript",
    jsx: "javascript",
    ts: "typescript",
    js: "javascript",
    py: "python",
    rs: "rust",
    rb: "ruby",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
  };

  return languageMap[language.toLowerCase()] || language.toLowerCase();
}

function getDefaultSnippets(): SnippetFile[] {
  return [
    {
      path: "global.json",
      language: "global",
      isGlobal: true,
      snippets: {
        "Print to console": {
          name: "Print to console",
          prefix: "log",
          body: ["console.log('$1');", "$0"],
          description: "Log output to console",
          scope: "global",
        },
        "Try-Catch Block": {
          name: "Try-Catch Block",
          prefix: "trycatch",
          body: [
            "try {",
            "\t$1",
            "} catch (${2:error}) {",
            "\tconsole.error($2);",
            "\t$0",
            "}",
          ],
          description: "Try-catch block for error handling",
          scope: "global",
        },
      },
    },
    {
      path: "typescript.json",
      language: "typescript",
      isGlobal: false,
      snippets: {
        "React Functional Component": {
          name: "React Functional Component",
          prefix: "rfc",
          body: [
            "interface ${1:Component}Props {",
            "\t$2",
            "}",
            "",
            "export function ${1:Component}(props: ${1:Component}Props) {",
            "\treturn (",
            "\t\t<div>",
            "\t\t\t$0",
            "\t\t</div>",
            "\t);",
            "}",
          ],
          description: "Create a React functional component with TypeScript",
        },
        "SolidJS Component": {
          name: "SolidJS Component",
          prefix: "sfc",
          body: [
            "import { Component } from 'solid-js';",
            "",
            "interface ${1:Component}Props {",
            "\t$2",
            "}",
            "",
            "export const ${1:Component}: Component<${1:Component}Props> = (props) => {",
            "\treturn (",
            "\t\t<div>",
            "\t\t\t$0",
            "\t\t</div>",
            "\t);",
            "};",
          ],
          description: "Create a SolidJS component",
        },
        "TypeScript Interface": {
          name: "TypeScript Interface",
          prefix: "int",
          body: [
            "interface ${1:Name} {",
            "\t$0",
            "}",
          ],
          description: "Create a TypeScript interface",
        },
        "TypeScript Type": {
          name: "TypeScript Type",
          prefix: "type",
          body: [
            "type ${1:Name} = ${0};",
          ],
          description: "Create a TypeScript type alias",
        },
        "Arrow Function": {
          name: "Arrow Function",
          prefix: "af",
          body: [
            "const ${1:name} = (${2:params}) => {",
            "\t$0",
            "};",
          ],
          description: "Create an arrow function",
        },
        "Async Arrow Function": {
          name: "Async Arrow Function",
          prefix: "aaf",
          body: [
            "const ${1:name} = async (${2:params}) => {",
            "\t$0",
            "};",
          ],
          description: "Create an async arrow function",
        },
        "useState Hook": {
          name: "useState Hook",
          prefix: "ust",
          body: [
            "const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState<${2:type}>(${3:initialValue});",
          ],
          description: "React useState hook",
        },
        "useEffect Hook": {
          name: "useEffect Hook",
          prefix: "uef",
          body: [
            "useEffect(() => {",
            "\t$0",
            "", 
            "\treturn () => {",
            "\t\t// cleanup",
            "\t};",
            "}, [${1:deps}]);",
          ],
          description: "React useEffect hook",
        },
        "createSignal": {
          name: "createSignal",
          prefix: "sig",
          body: [
            "const [${1:value}, set${1/(.*)/${1:/capitalize}/}] = createSignal<${2:type}>(${3:initialValue});",
          ],
          description: "SolidJS createSignal",
        },
        "createEffect": {
          name: "createEffect",
          prefix: "eff",
          body: [
            "createEffect(() => {",
            "\t$0",
            "});",
          ],
          description: "SolidJS createEffect",
        },
      },
    },
    {
      path: "javascript.json",
      language: "javascript",
      isGlobal: false,
      snippets: {
        "Console Log": {
          name: "Console Log",
          prefix: "cl",
          body: ["console.log($1);", "$0"],
          description: "Console log statement",
        },
        "For Loop": {
          name: "For Loop",
          prefix: "for",
          body: [
            "for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {",
            "\t$0",
            "}",
          ],
          description: "For loop",
        },
        "For Of Loop": {
          name: "For Of Loop",
          prefix: "forof",
          body: [
            "for (const ${1:item} of ${2:iterable}) {",
            "\t$0",
            "}",
          ],
          description: "For...of loop",
        },
        "Async Function": {
          name: "Async Function",
          prefix: "asyncfn",
          body: [
            "async function ${1:name}(${2:params}) {",
            "\t$0",
            "}",
          ],
          description: "Async function declaration",
        },
        "Promise": {
          name: "Promise",
          prefix: "prom",
          body: [
            "new Promise((resolve, reject) => {",
            "\t$0",
            "});",
          ],
          description: "Create a new Promise",
        },
        "Import Statement": {
          name: "Import Statement",
          prefix: "imp",
          body: ["import { $2 } from '${1:module}';", "$0"],
          description: "Import statement",
        },
        "Export Default": {
          name: "Export Default",
          prefix: "expd",
          body: ["export default $0"],
          description: "Export default",
        },
        "Export Named": {
          name: "Export Named",
          prefix: "exp",
          body: ["export { $0 };"],
          description: "Export named",
        },
      },
    },
    {
      path: "rust.json",
      language: "rust",
      isGlobal: false,
      snippets: {
        "Function": {
          name: "Function",
          prefix: "fn",
          body: [
            "fn ${1:name}(${2:params}) -> ${3:ReturnType} {",
            "\t$0",
            "}",
          ],
          description: "Rust function",
        },
        "Struct": {
          name: "Struct",
          prefix: "struct",
          body: [
            "#[derive(Debug)]",
            "struct ${1:Name} {",
            "\t$0",
            "}",
          ],
          description: "Rust struct with Debug derive",
        },
        "Impl Block": {
          name: "Impl Block",
          prefix: "impl",
          body: [
            "impl ${1:Type} {",
            "\t$0",
            "}",
          ],
          description: "Implementation block",
        },
        "Match Expression": {
          name: "Match Expression",
          prefix: "match",
          body: [
            "match ${1:expression} {",
            "\t${2:pattern} => $0,",
            "}",
          ],
          description: "Match expression",
        },
        "If Let": {
          name: "If Let",
          prefix: "iflet",
          body: [
            "if let ${1:Some(value)} = ${2:option} {",
            "\t$0",
            "}",
          ],
          description: "If let pattern matching",
        },
        "Result Type": {
          name: "Result Type",
          prefix: "res",
          body: ["Result<${1:T}, ${2:E}>"],
          description: "Result type",
        },
        "Option Type": {
          name: "Option Type",
          prefix: "opt",
          body: ["Option<${1:T}>"],
          description: "Option type",
        },
        "Test Function": {
          name: "Test Function",
          prefix: "test",
          body: [
            "#[test]",
            "fn ${1:test_name}() {",
            "\t$0",
            "}",
          ],
          description: "Test function",
        },
      },
    },
    {
      path: "python.json",
      language: "python",
      isGlobal: false,
      snippets: {
        "Function Definition": {
          name: "Function Definition",
          prefix: "def",
          body: [
            "def ${1:function_name}(${2:params}):",
            "\t\"\"\"${3:Docstring}\"\"\"",
            "\t$0",
          ],
          description: "Python function definition",
        },
        "Class Definition": {
          name: "Class Definition",
          prefix: "class",
          body: [
            "class ${1:ClassName}:",
            "\t\"\"\"${2:Docstring}\"\"\"",
            "",
            "\tdef __init__(self${3:, params}):",
            "\t\t$0",
          ],
          description: "Python class definition",
        },
        "If Statement": {
          name: "If Statement",
          prefix: "if",
          body: [
            "if ${1:condition}:",
            "\t$0",
          ],
          description: "If statement",
        },
        "For Loop": {
          name: "For Loop",
          prefix: "for",
          body: [
            "for ${1:item} in ${2:iterable}:",
            "\t$0",
          ],
          description: "For loop",
        },
        "With Statement": {
          name: "With Statement",
          prefix: "with",
          body: [
            "with ${1:expression} as ${2:var}:",
            "\t$0",
          ],
          description: "With context manager",
        },
        "Try Except": {
          name: "Try Except",
          prefix: "try",
          body: [
            "try:",
            "\t$1",
            "except ${2:Exception} as ${3:e}:",
            "\t$0",
          ],
          description: "Try-except block",
        },
        "Main Block": {
          name: "Main Block",
          prefix: "main",
          body: [
            "if __name__ == \"__main__\":",
            "\t$0",
          ],
          description: "Main block",
        },
        "List Comprehension": {
          name: "List Comprehension",
          prefix: "lc",
          body: ["[${1:expression} for ${2:item} in ${3:iterable}]"],
          description: "List comprehension",
        },
      },
    },
  ];
}

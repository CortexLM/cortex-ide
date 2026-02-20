/**
 * Editor Associations Context
 *
 * Manages custom editor associations for file types, allowing users to:
 * - Map file patterns to specific editor types
 * - Register custom editors from extensions
 * - Get the appropriate editor for a given file
 * - Configure default editors for file patterns
 */

import {
  createContext,
  useContext,
  ParentProps,
  createEffect,
  onMount,
  onCleanup,
  createMemo,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

// ============================================================================
// Types
// ============================================================================

/** An association between a file pattern and an editor */
export interface EditorAssociation {
  /** Glob pattern (e.g., "*.png", "*.md", "Dockerfile") */
  pattern: string;
  /** Editor type ID to use for this pattern */
  editorId: string;
  /** Priority for resolving conflicts - higher wins */
  priority: number;
  /** Whether this is a user-defined association (vs built-in) */
  isUserDefined: boolean;
}

/** Definition of an available editor */
export interface AvailableEditor {
  /** Unique identifier for this editor */
  id: string;
  /** Human-readable label */
  label: string;
  /** Optional icon identifier or codicon name */
  icon?: string;
  /** Function to check if this editor can handle a given file path */
  canHandle: (filePath: string) => boolean;
  /** Priority when multiple editors can handle a file (higher = preferred) */
  priority?: number;
  /** Whether this editor is from an extension */
  isExtension?: boolean;
  /** Extension ID if from an extension */
  extensionId?: string;
}

/** Disposable interface for cleanup */
export interface Disposable {
  dispose: () => void;
}

/** State shape for the context */
interface EditorAssociationsState {
  associations: EditorAssociation[];
  registeredEditors: AvailableEditor[];
  loading: boolean;
  error: string | null;
}

// ============================================================================
// File Type Detection Utilities
// ============================================================================

/** Check if file is a code file (for Monaco editor) */
function isCodeFile(filePath: string): boolean {
  const codeExtensions = [
    // JavaScript/TypeScript
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts",
    // Web
    ".html", ".htm", ".css", ".scss", ".sass", ".less", ".vue", ".svelte",
    // Data formats
    ".json", ".jsonc", ".json5", ".yaml", ".yml", ".toml", ".xml",
    // Programming languages
    ".py", ".pyw", ".pyi", ".rb", ".php", ".java", ".kt", ".kts",
    ".scala", ".swift", ".go", ".rs", ".c", ".h", ".cpp", ".cc",
    ".cxx", ".hpp", ".cs", ".fs", ".fsx", ".lua", ".r", ".R",
    // Shell/Config
    ".sh", ".bash", ".zsh", ".fish", ".ps1", ".psm1", ".bat", ".cmd",
    ".env", ".gitignore", ".dockerignore", ".editorconfig",
    // Markup/Docs
    ".md", ".mdx", ".markdown", ".rst", ".txt", ".tex",
    // Database
    ".sql", ".mysql", ".pgsql", ".sqlite",
    // Config files
    ".conf", ".cfg", ".ini", ".properties",
  ];

  const lower = filePath.toLowerCase();
  const fileName = lower.split(/[/\\]/).pop() || lower;

  // Check for files without extensions
  const noExtFiles = [
    "dockerfile", "makefile", "gnumakefile", "gemfile",
    "rakefile", "procfile", "brewfile", "vagrantfile",
  ];
  if (noExtFiles.includes(fileName)) return true;

  return codeExtensions.some((ext) => lower.endsWith(ext));
}

/** Check if file is an image */
function isImageFile(filePath: string): boolean {
  const imageExtensions = [
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
    ".ico", ".svg", ".tiff", ".tif", ".avif", ".heic", ".heif",
  ];
  const lower = filePath.toLowerCase();
  return imageExtensions.some((ext) => lower.endsWith(ext));
}

/** Check if file is a video */
function isVideoFile(filePath: string): boolean {
  const videoExtensions = [
    ".mp4", ".webm", ".ogg", ".ogv", ".mov", ".avi",
    ".mkv", ".wmv", ".flv", ".m4v", ".3gp",
  ];
  const lower = filePath.toLowerCase();
  return videoExtensions.some((ext) => lower.endsWith(ext));
}

/** Check if file is audio */
function isAudioFile(filePath: string): boolean {
  const audioExtensions = [
    ".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac",
    ".flac", ".wma", ".aiff", ".opus",
  ];
  const lower = filePath.toLowerCase();
  return audioExtensions.some((ext) => lower.endsWith(ext));
}

/** Check if file is a PDF */
function isPdfFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".pdf");
}

/** Check if file is a Jupyter notebook */
function isNotebookFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".ipynb");
}

/** Check if file is markdown */
function isMarkdownFile(filePath: string): boolean {
  const mdExtensions = [".md", ".mdx", ".markdown"];
  const lower = filePath.toLowerCase();
  return mdExtensions.some((ext) => lower.endsWith(ext));
}

// ============================================================================
// Built-in Editors
// ============================================================================

const BUILTIN_EDITORS: AvailableEditor[] = [
  {
    id: "default",
    label: "Text Editor",
    icon: "file-text",
    canHandle: () => true,
    priority: 0,
  },
  {
    id: "monaco",
    label: "Code Editor",
    icon: "code",
    canHandle: isCodeFile,
    priority: 10,
  },
  {
    id: "imagePreview",
    label: "Image Preview",
    icon: "file-media",
    canHandle: isImageFile,
    priority: 100,
  },
  {
    id: "videoPlayer",
    label: "Video Player",
    icon: "play",
    canHandle: isVideoFile,
    priority: 100,
  },
  {
    id: "audioPlayer",
    label: "Audio Player",
    icon: "unmute",
    canHandle: isAudioFile,
    priority: 100,
  },
  {
    id: "pdfViewer",
    label: "PDF Viewer",
    icon: "file-pdf",
    canHandle: isPdfFile,
    priority: 100,
  },
  {
    id: "hexEditor",
    label: "Hex Editor",
    icon: "file-binary",
    canHandle: () => true,
    priority: -10,
  },
  {
    id: "markdownPreview",
    label: "Markdown Preview",
    icon: "markdown",
    canHandle: isMarkdownFile,
    priority: 50,
  },
  {
    id: "notebookEditor",
    label: "Notebook Editor",
    icon: "notebook",
    canHandle: isNotebookFile,
    priority: 100,
  },
];

// ============================================================================
// Default Associations
// ============================================================================

const DEFAULT_ASSOCIATIONS: EditorAssociation[] = [
  // Images -> Image Preview
  { pattern: "*.png", editorId: "imagePreview", priority: 100, isUserDefined: false },
  { pattern: "*.jpg", editorId: "imagePreview", priority: 100, isUserDefined: false },
  { pattern: "*.jpeg", editorId: "imagePreview", priority: 100, isUserDefined: false },
  { pattern: "*.gif", editorId: "imagePreview", priority: 100, isUserDefined: false },
  { pattern: "*.webp", editorId: "imagePreview", priority: 100, isUserDefined: false },
  { pattern: "*.svg", editorId: "imagePreview", priority: 100, isUserDefined: false },
  { pattern: "*.ico", editorId: "imagePreview", priority: 100, isUserDefined: false },
  { pattern: "*.bmp", editorId: "imagePreview", priority: 100, isUserDefined: false },

  // Video -> Video Player
  { pattern: "*.mp4", editorId: "videoPlayer", priority: 100, isUserDefined: false },
  { pattern: "*.webm", editorId: "videoPlayer", priority: 100, isUserDefined: false },
  { pattern: "*.ogg", editorId: "videoPlayer", priority: 80, isUserDefined: false },
  { pattern: "*.mov", editorId: "videoPlayer", priority: 100, isUserDefined: false },

  // Audio -> Audio Player
  { pattern: "*.mp3", editorId: "audioPlayer", priority: 100, isUserDefined: false },
  { pattern: "*.wav", editorId: "audioPlayer", priority: 100, isUserDefined: false },
  { pattern: "*.m4a", editorId: "audioPlayer", priority: 100, isUserDefined: false },
  { pattern: "*.flac", editorId: "audioPlayer", priority: 100, isUserDefined: false },

  // PDF -> PDF Viewer
  { pattern: "*.pdf", editorId: "pdfViewer", priority: 100, isUserDefined: false },

  // Notebooks -> Notebook Editor
  { pattern: "*.ipynb", editorId: "notebookEditor", priority: 100, isUserDefined: false },

  // Markdown -> Markdown Preview (lower priority so code editor is default)
  { pattern: "*.md", editorId: "monaco", priority: 100, isUserDefined: false },
  { pattern: "*.mdx", editorId: "monaco", priority: 100, isUserDefined: false },
];

// ============================================================================
// Pattern Matching
// ============================================================================

/** Convert a glob pattern to a regex */
function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except * and ?
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/\\\\]*")
    .replace(/\?/g, "[^/\\\\]")
    .replace(/{{GLOBSTAR}}/g, ".*");

  return new RegExp(`^${regex}$`, "i");
}

/** Check if a filename matches a glob pattern */
function matchesPattern(filename: string, pattern: string): boolean {
  // Get just the filename from the path
  const baseName = filename.split(/[/\\]/).pop() || filename;

  // Handle patterns that start with **/ for path matching
  if (pattern.startsWith("**/")) {
    const subPattern = pattern.slice(3);
    const regex = globToRegex(subPattern);
    return regex.test(baseName) || globToRegex(pattern).test(filename);
  }

  // Handle simple patterns
  const regex = globToRegex(pattern);
  return regex.test(baseName);
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY = "cortex_editor_associations";

// ============================================================================
// Context Interface
// ============================================================================

export interface EditorAssociationsContextValue {
  /** Current associations */
  associations: Accessor<EditorAssociation[]>;
  /** All available editors (built-in + registered) */
  availableEditors: Accessor<AvailableEditor[]>;
  /** Get the default editor ID for a file path */
  getEditorForFile: (filePath: string) => string;
  /** Get all editors that can handle a file */
  getAvailableEditorsForFile: (filePath: string) => AvailableEditor[];
  /** Set an association for a pattern */
  setAssociation: (pattern: string, editorId: string, priority?: number) => void;
  /** Remove an association */
  removeAssociation: (pattern: string) => void;
  /** Register a custom editor (returns disposable) */
  registerEditor: (editor: AvailableEditor) => Disposable;
  /** Unregister a custom editor */
  unregisterEditor: (editorId: string) => void;
  /** Get the association for a specific pattern */
  getAssociation: (pattern: string) => EditorAssociation | undefined;
  /** Check if there's a user-defined association for a pattern */
  hasUserAssociation: (pattern: string) => boolean;
  /** Reset a pattern to its default association */
  resetAssociation: (pattern: string) => void;
  /** Reset all user associations */
  resetAllAssociations: () => void;
  /** Get the pattern that matches a file path */
  getMatchingPattern: (filePath: string) => string | undefined;
  /** Loading state */
  loading: Accessor<boolean>;
  /** Error state */
  error: Accessor<string | null>;
}

const EditorAssociationsContext = createContext<EditorAssociationsContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function EditorAssociationsProvider(props: ParentProps) {
  const [state, setState] = createStore<EditorAssociationsState>({
    associations: [...DEFAULT_ASSOCIATIONS],
    registeredEditors: [...BUILTIN_EDITORS],
    loading: true,
    error: null,
  });

  // Load user associations from localStorage
  const loadAssociations = () => {
    setState("loading", true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const userAssociations: EditorAssociation[] = JSON.parse(stored);
        // Merge user associations with defaults (user takes priority)
        const mergedAssociations = [...DEFAULT_ASSOCIATIONS];

        for (const userAssoc of userAssociations) {
          const existingIndex = mergedAssociations.findIndex(
            (a) => a.pattern === userAssoc.pattern
          );
          if (existingIndex >= 0) {
            // Replace default with user association
            mergedAssociations[existingIndex] = {
              ...userAssoc,
              isUserDefined: true,
            };
          } else {
            // Add new user association
            mergedAssociations.push({
              ...userAssoc,
              isUserDefined: true,
            });
          }
        }

        setState("associations", mergedAssociations);
      }
    } catch (e) {
      console.error("[EditorAssociations] Failed to load associations:", e);
      setState("error", e instanceof Error ? e.message : String(e));
    } finally {
      setState("loading", false);
    }
  };

  // Save user associations to localStorage
  const saveAssociations = () => {
    try {
      const userAssociations = state.associations.filter((a) => a.isUserDefined);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userAssociations));
    } catch (e) {
      console.error("[EditorAssociations] Failed to save associations:", e);
      setState("error", e instanceof Error ? e.message : String(e));
    }
  };

  // Initialize on mount
  onMount(() => {
    loadAssociations();
  });

  // Listen for settings changes from other windows
  createEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadAssociations();
      }
    };
    window.addEventListener("storage", handleStorage);
    onCleanup(() => window.removeEventListener("storage", handleStorage));
  });

  // Accessors
  const associationsAccessor = createMemo(() => state.associations);
  const availableEditorsAccessor = createMemo(() => state.registeredEditors);
  const loadingAccessor = createMemo(() => state.loading);
  const errorAccessor = createMemo(() => state.error);

  // Get the editor ID for a file based on associations
  const getEditorForFile = (filePath: string): string => {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;

    // Find all matching associations
    const matchingAssociations = state.associations.filter((assoc) =>
      matchesPattern(fileName, assoc.pattern)
    );

    if (matchingAssociations.length === 0) {
      // No association found, determine from file type
      for (const editor of state.registeredEditors.sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
      )) {
        if (editor.canHandle(filePath)) {
          return editor.id;
        }
      }
      return "default";
    }

    // Sort by priority (highest first) and return the best match
    matchingAssociations.sort((a, b) => b.priority - a.priority);
    return matchingAssociations[0].editorId;
  };

  // Get all editors that can handle a file
  const getAvailableEditorsForFile = (filePath: string): AvailableEditor[] => {
    return state.registeredEditors
      .filter((editor) => editor.canHandle(filePath))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  };

  // Set an association
  const setAssociation = (
    pattern: string,
    editorId: string,
    priority: number = 1000
  ) => {
    setState(
      produce((draft) => {
        const existingIndex = draft.associations.findIndex(
          (a) => a.pattern === pattern
        );
        if (existingIndex >= 0) {
          draft.associations[existingIndex] = {
            pattern,
            editorId,
            priority,
            isUserDefined: true,
          };
        } else {
          draft.associations.push({
            pattern,
            editorId,
            priority,
            isUserDefined: true,
          });
        }
      })
    );
    saveAssociations();

    // Dispatch event for other components
    window.dispatchEvent(
      new CustomEvent("editor-association:changed", {
        detail: { pattern, editorId },
      })
    );
  };

  // Remove an association
  const removeAssociation = (pattern: string) => {
    setState(
      produce((draft) => {
        // Find if there's a default for this pattern
        const defaultAssoc = DEFAULT_ASSOCIATIONS.find(
          (a) => a.pattern === pattern
        );
        const index = draft.associations.findIndex((a) => a.pattern === pattern);

        if (index >= 0) {
          if (defaultAssoc) {
            // Restore to default
            draft.associations[index] = { ...defaultAssoc };
          } else {
            // Remove entirely
            draft.associations.splice(index, 1);
          }
        }
      })
    );
    saveAssociations();

    window.dispatchEvent(
      new CustomEvent("editor-association:removed", {
        detail: { pattern },
      })
    );
  };

  // Register a custom editor
  const registerEditor = (editor: AvailableEditor): Disposable => {
    // Check if already registered
    if (state.registeredEditors.some((e) => e.id === editor.id)) {
      console.warn(`[EditorAssociations] Editor "${editor.id}" already registered`);
      return { dispose: () => {} };
    }

    setState("registeredEditors", (editors) => [...editors, editor]);

    window.dispatchEvent(
      new CustomEvent("editor-association:editor-registered", {
        detail: { editor },
      })
    );

    return {
      dispose: () => unregisterEditor(editor.id),
    };
  };

  // Unregister a custom editor
  const unregisterEditor = (editorId: string) => {
    // Don't allow unregistering built-in editors
    if (BUILTIN_EDITORS.some((e) => e.id === editorId)) {
      console.warn(`[EditorAssociations] Cannot unregister built-in editor "${editorId}"`);
      return;
    }

    setState("registeredEditors", (editors) =>
      editors.filter((e) => e.id !== editorId)
    );

    window.dispatchEvent(
      new CustomEvent("editor-association:editor-unregistered", {
        detail: { editorId },
      })
    );
  };

  // Get association for a pattern
  const getAssociation = (pattern: string): EditorAssociation | undefined => {
    return state.associations.find((a) => a.pattern === pattern);
  };

  // Check if there's a user-defined association
  const hasUserAssociation = (pattern: string): boolean => {
    const assoc = state.associations.find((a) => a.pattern === pattern);
    return assoc?.isUserDefined ?? false;
  };

  // Reset a pattern to default
  const resetAssociation = (pattern: string) => {
    removeAssociation(pattern);
  };

  // Reset all user associations
  const resetAllAssociations = () => {
    setState("associations", [...DEFAULT_ASSOCIATIONS]);
    localStorage.removeItem(STORAGE_KEY);

    window.dispatchEvent(new CustomEvent("editor-association:reset-all"));
  };

  // Get the pattern that matches a file
  const getMatchingPattern = (filePath: string): string | undefined => {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;

    const matchingAssociations = state.associations
      .filter((assoc) => matchesPattern(fileName, assoc.pattern))
      .sort((a, b) => b.priority - a.priority);

    return matchingAssociations[0]?.pattern;
  };

  const value: EditorAssociationsContextValue = {
    associations: associationsAccessor,
    availableEditors: availableEditorsAccessor,
    getEditorForFile,
    getAvailableEditorsForFile,
    setAssociation,
    removeAssociation,
    registerEditor,
    unregisterEditor,
    getAssociation,
    hasUserAssociation,
    resetAssociation,
    resetAllAssociations,
    getMatchingPattern,
    loading: loadingAccessor,
    error: errorAccessor,
  };

  return (
    <EditorAssociationsContext.Provider value={value}>
      {props.children}
    </EditorAssociationsContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useEditorAssociations(): EditorAssociationsContextValue {
  const context = useContext(EditorAssociationsContext);
  if (!context) {
    throw new Error(
      "useEditorAssociations must be used within an EditorAssociationsProvider"
    );
  }
  return context;
}

/** Hook to get the editor for a specific file */
export function useEditorForFile(filePath: Accessor<string>) {
  const ctx = useEditorAssociations();
  return createMemo(() => ctx.getEditorForFile(filePath()));
}

/** Hook to get available editors for a file */
export function useAvailableEditorsForFile(filePath: Accessor<string>) {
  const ctx = useEditorAssociations();
  return createMemo(() => ctx.getAvailableEditorsForFile(filePath()));
}

// ============================================================================
// Exports
// ============================================================================

export {
  BUILTIN_EDITORS,
  DEFAULT_ASSOCIATIONS,
  isCodeFile,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isPdfFile,
  isNotebookFile,
  isMarkdownFile,
  matchesPattern,
};

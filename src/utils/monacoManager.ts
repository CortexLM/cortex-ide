/**
 * Monaco Editor Manager
 * 
 * Provides centralized management for Monaco editor instances with:
 * - Lazy loading of Monaco editor
 * - Editor instance pooling for reuse
 * - Model caching with delayed disposal
 * - Large file optimizations
 * - Worker configuration
 */

import type * as Monaco from "monaco-editor";

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of editor instances in the pool.
 * Pool is created on demand — no editors are pre-allocated.
 * Editors are only instantiated in `acquireEditor()` when a tab is opened.
 */
const EDITOR_POOL_SIZE = 4;

/** Delay before disposing unused models (ms) */
const MODEL_DISPOSE_DELAY_MS = 60000; // 1 minute

/** Line thresholds for large file optimizations */
const LARGE_FILE_THRESHOLDS = {
  /** Disable minimap above this line count */
  DISABLE_MINIMAP: 10000,
  /** Disable bracket matching above this line count */
  DISABLE_BRACKET_MATCHING: 50000,
  /** Disable word-based suggestions above this line count */
  DISABLE_WORD_SUGGESTIONS: 30000,
  /** Disable folding above this line count */
  DISABLE_FOLDING: 100000,
} as const;

// ============================================================================
// Types
// ============================================================================

/** State of Monaco loading */
type MonacoLoadState = "idle" | "loading" | "loaded" | "error";

/** Editor instance in the pool */
interface PooledEditor {
  /** The Monaco editor instance */
  editor: Monaco.editor.IStandaloneCodeEditor;
  /** Whether this editor is currently in use */
  inUse: boolean;
  /** The container element it's mounted to */
  container: HTMLDivElement;
  /** Current file path associated with this editor */
  filePath: string | null;
  /** Timestamp of last use */
  lastUsed: number;
}

/** Cached model information */
interface CachedModel {
  /** The Monaco text model */
  model: Monaco.editor.ITextModel;
  /** File path for this model */
  filePath: string;
  /** Language ID */
  languageId: string;
  /** Scheduled disposal timeout */
  disposeTimer: ReturnType<typeof setTimeout> | null;
  /** Last used timestamp */
  lastUsed: number;
  /** Version ID for tracking changes */
  version: number;
}

/** Options for large file optimizations */
interface LargeFileOptions {
  disableMinimap: boolean;
  disableBracketMatching: boolean;
  disableWordSuggestions: boolean;
  disableFolding: boolean;
  useSimplifiedTokenization: boolean;
}

/** Large file settings from user/workspace configuration */
export interface LargeFileSettings {
  /** Enable automatic optimizations for large files */
  largeFileOptimizations: boolean;
  /** Maximum line length for syntax tokenization */
  maxTokenizationLineLength: number;
}

/** Monaco manager configuration */
interface MonacoManagerConfig {
  poolSize?: number;
  modelDisposeDelay?: number;
  onLoadStart?: () => void;
  onLoadComplete?: () => void;
  onLoadError?: (error: Error) => void;
}

// ============================================================================
// Monaco Manager Class
// ============================================================================

/**
 * Manages Monaco editor lifecycle including lazy loading, pooling, and model caching.
 * 
 * Usage:
 * ```ts
 * const manager = MonacoManager.getInstance();
 * await manager.ensureLoaded();
 * const editor = manager.acquireEditor(container, filePath, options);
 * // ... use editor ...
 * manager.releaseEditor(editor, filePath);
 * ```
 */
class MonacoManager {
  private static instance: MonacoManager | null = null;

  /** Monaco module instance */
  private monaco: typeof Monaco | null = null;
  
  /** Current loading state */
  private loadState: MonacoLoadState = "idle";
  
  /** Promise for ongoing load operation */
  private loadPromise: Promise<typeof Monaco> | null = null;
  
  /** Pool of editor instances */
  private editorPool: PooledEditor[] = [];
  
  /** Cache of text models */
  private modelCache: Map<string, CachedModel> = new Map();
  
  /** Configuration */
  private config: Required<MonacoManagerConfig>;
  
  /** Theme registered flag */
  private themeRegistered = false;
  
  /** Registered providers disposables */
  private providerDisposables: Monaco.IDisposable[] = [];

  private constructor(config: MonacoManagerConfig = {}) {
    this.config = {
      poolSize: config.poolSize ?? EDITOR_POOL_SIZE,
      modelDisposeDelay: config.modelDisposeDelay ?? MODEL_DISPOSE_DELAY_MS,
      onLoadStart: config.onLoadStart ?? (() => {}),
      onLoadComplete: config.onLoadComplete ?? (() => {}),
      onLoadError: config.onLoadError ?? (() => {}),
    };
  }

  /**
   * Get the singleton instance of MonacoManager
   */
  static getInstance(config?: MonacoManagerConfig): MonacoManager {
    if (!MonacoManager.instance) {
      MonacoManager.instance = new MonacoManager(config);
    }
    return MonacoManager.instance;
  }

  /**
   * Reset the manager (useful for testing)
   */
  static reset(): void {
    if (MonacoManager.instance) {
      MonacoManager.instance?.dispose?.();
      MonacoManager.instance = null;
    }
  }

  /**
   * Get current loading state
   */
  getLoadState(): MonacoLoadState {
    return this.loadState;
  }

  /**
   * Check if Monaco is loaded
   */
  isLoaded(): boolean {
    return this.loadState === "loaded" && this.monaco !== null;
  }

  /**
   * Get the Monaco instance (throws if not loaded)
   */
  getMonaco(): typeof Monaco {
    if (!this.monaco) {
      throw new Error("Monaco is not loaded. Call ensureLoaded() first.");
    }
    return this.monaco;
  }

  /**
   * Get the Monaco instance or null if not loaded
   */
  getMonacoOrNull(): typeof Monaco | null {
    return this.monaco;
  }

  /**
   * Ensure Monaco is loaded, returning the Monaco instance
   */
  async ensureLoaded(): Promise<typeof Monaco> {
    // Already loaded
    if (this.loadState === "loaded" && this.monaco) {
      return this.monaco;
    }

    // Loading in progress
    if (this.loadState === "loading" && this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    this.loadState = "loading";
    this.config.onLoadStart();

    this.loadPromise = this.loadMonaco();
    
    try {
      this.monaco = await this.loadPromise;
      this.loadState = "loaded";
      this.config.onLoadComplete();
      
      // Register theme and providers
      this.registerTheme();
      
      return this.monaco;
    } catch (error) {
      this.loadState = "error";
      this.config.onLoadError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Load Monaco dynamically
   */
  private async loadMonaco(): Promise<typeof Monaco> {
    // Use direct ES module import instead of @monaco-editor/loader
    // This avoids CDN loading and lets Vite handle bundling
    const monaco = await import("monaco-editor");
    return monaco;
  }

  /**
   * Register the custom theme
   */
  private registerTheme(): void {
    if (this.themeRegistered || !this.monaco) return;
    
    this.monaco.editor.defineTheme("cortex-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        // ============================================
        // FIGMA DESIGN EXACT COLORS (re-analyzed)
        // ============================================
        // #FEAB78 = orange (keywords: const, typeof, if, true, false, <boolean>)
        // #66BFFF = blue (functions: useState, setIsLoading, useAccount, Object.keys)
        // #FFB7FA = pink (hooks/special: useTranslation, properties: .length, .household)
        // #FFB7FA = pink (strings, hooks/special, properties: .length, .household)
        // #FFFFFF = white (variables, operators, brackets, punctuation)
        // #8C8D8F = gray (comments, line numbers)
        
        // Comments - Figma: #8C8D8F
        { token: "comment", foreground: "8C8D8F", fontStyle: "italic" },
        { token: "comment.block", foreground: "8C8D8F", fontStyle: "italic" },
        { token: "comment.line", foreground: "8C8D8F", fontStyle: "italic" },
        { token: "comment.doc", foreground: "8C8D8F", fontStyle: "italic" },
        
        // Keywords - Figma: #FEAB78 (orange)
        { token: "keyword", foreground: "FEAB78" },
        { token: "keyword.control", foreground: "FEAB78" },
        { token: "keyword.other", foreground: "FEAB78" },
        { token: "storage", foreground: "FEAB78" },
        { token: "storage.type", foreground: "FEAB78" },
        { token: "storage.modifier", foreground: "FEAB78" },
        
        // Types/Generics - Figma: #FEAB78 (orange) - <boolean>, <string>
        { token: "type", foreground: "FEAB78" },
        { token: "type.identifier", foreground: "FEAB78" },
        { token: "support.type", foreground: "FEAB78" },
        { token: "support.type.primitive", foreground: "FEAB78" },
        { token: "entity.name.type", foreground: "FEAB78" },
        
        // Classes/Interfaces - Figma: #66BFFF (blue)
        { token: "class", foreground: "66BFFF" },
        { token: "interface", foreground: "66BFFF" },
        { token: "entity.name.class", foreground: "66BFFF" },
        
        // Functions - Figma: #66BFFF (blue) - useState, setIsLoading, Object.keys
        { token: "function", foreground: "66BFFF" },
        { token: "function.call", foreground: "66BFFF" },
        { token: "entity.name.function", foreground: "66BFFF" },
        { token: "support.function", foreground: "66BFFF" },
        { token: "meta.function-call", foreground: "66BFFF" },
        { token: "variable.function", foreground: "66BFFF" },
        
        // Variables - Figma: #FFFFFF (white)
        { token: "variable", foreground: "FFFFFF" },
        { token: "variable.predefined", foreground: "FFFFFF" },
        { token: "variable.other", foreground: "FFFFFF" },
        { token: "variable.other.readwrite", foreground: "FFFFFF" },
        { token: "identifier", foreground: "FFFFFF" },
        
        // Parameters - Figma: #FFFFFF (white)
        { token: "parameter", foreground: "FFFFFF" },
        { token: "variable.parameter", foreground: "FFFFFF" },
        
        // Properties/Members - Figma: #FFB7FA (pink) - .length, .household, .members
        { token: "property", foreground: "FFB7FA" },
        { token: "variable.property", foreground: "FFB7FA" },
        { token: "support.property", foreground: "FFB7FA" },
        { token: "variable.other.property", foreground: "FFB7FA" },
        { token: "meta.property", foreground: "FFB7FA" },
        { token: "entity.name.tag.localname", foreground: "FFB7FA" },
        
        // Strings - Figma: #FFB7FA (pink)
        { token: "string", foreground: "FFB7FA" },
        { token: "string.escape", foreground: "FEAB78" },
        { token: "string.template", foreground: "FFB7FA" },
        { token: "string.quoted", foreground: "FFB7FA" },
        { token: "string.regexp", foreground: "FFB7FA" },
        
        // Numbers - Figma: #FFB7FA (pink)
        { token: "number", foreground: "FFB7FA" },
        { token: "number.hex", foreground: "FFB7FA" },
        { token: "number.float", foreground: "FFB7FA" },
        { token: "constant.numeric", foreground: "FFB7FA" },
        
        // Operators - Figma: #FFFFFF (white)
        { token: "operator", foreground: "FFFFFF" },
        { token: "keyword.operator", foreground: "FFFFFF" },
        { token: "keyword.operator.assignment", foreground: "FFFFFF" },
        { token: "keyword.operator.arithmetic", foreground: "FFFFFF" },
        { token: "keyword.operator.logical", foreground: "FFFFFF" },
        { token: "keyword.operator.comparison", foreground: "FFFFFF" },
        
        // Punctuation/Brackets - Figma: #FCFCFC
        { token: "delimiter", foreground: "FCFCFC" },
        { token: "delimiter.bracket", foreground: "FCFCFC" },
        { token: "delimiter.parenthesis", foreground: "FCFCFC" },
        { token: "delimiter.square", foreground: "FCFCFC" },
        { token: "delimiter.curly", foreground: "FCFCFC" },
        { token: "punctuation", foreground: "FCFCFC" },
        { token: "punctuation.definition", foreground: "FCFCFC" },
        { token: "meta.brace", foreground: "FCFCFC" },
        
        // Annotations/Decorators - Figma: #FEAB78 (orange)
        { token: "annotation", foreground: "FEAB78" },
        { token: "metatag", foreground: "FEAB78" },
        { token: "meta.decorator", foreground: "FEAB78" },
        
        // HTML/JSX Tags - Figma: #FEAB78 (orange)
        { token: "tag", foreground: "FEAB78" },
        { token: "tag.id", foreground: "FEAB78" },
        { token: "metatag.html", foreground: "FEAB78" },
        { token: "metatag.xml", foreground: "FEAB78" },
        
        // JSX/HTML Attributes - Figma: #FFB7FA (pink)
        { token: "attribute.name", foreground: "FFB7FA" },
        { token: "attribute.value", foreground: "FFB7FA" },
        
        // Constants (true/false/null) - Figma: #FEAB78 (orange)
        { token: "constant", foreground: "FEAB78" },
        { token: "constant.language", foreground: "FEAB78" },
        { token: "constant.language.boolean", foreground: "FEAB78" },
        { token: "constant.language.null", foreground: "FEAB78" },
        { token: "constant.language.undefined", foreground: "FEAB78" },
        { token: "constant.character", foreground: "FFB7FA" },
        
        // Regex - Figma: #FFB7FA (pink)
        { token: "regexp", foreground: "FFB7FA" },
        
        // Default/Fallback
        { token: "", foreground: "FCFCFC" },
      ],
      colors: {
        // Editor core - Figma: #141415
        "editor.background": "#141415",
        "editor.foreground": "#FCFCFC",
        "editorCursor.foreground": "#FCFCFC",
        
        // Gutter/margin background - same as editor
        "editorGutter.background": "#141415",
        
        // Line numbers - Figma: #8C8D8F
        "editorLineNumber.foreground": "#8C8D8F",
        "editorLineNumber.activeForeground": "#FCFCFC",
        
        // Active line
        "editor.lineHighlightBackground": "#ffffff08",
        "editor.lineHighlightBorder": "#00000000",
        
        // Selection - Trae/Cortex indigo based
        "editor.selectionBackground": "#6366F14d",
        "editor.inactiveSelectionBackground": "#6366F126",
        "editor.selectionHighlightBackground": "#6366F133",
        
        // Word highlight - Trae/Cortex indigo based (text occurrences)
        "editor.wordHighlightBackground": "#6366F133",
        "editor.wordHighlightStrongBackground": "#6366F14d",
        "editor.wordHighlightBorder": "#6366F180",
        "editor.wordHighlightStrongBorder": "#6366F1",
        
        // Document highlight - Read occurrences (blue/cyan tint)
        // Read: when a variable is being read/accessed
        "editor.wordHighlightTextBackground": "#38BDF833",
        "editor.wordHighlightTextBorder": "#38BDF880",
        
        // Document highlight - Write occurrences (orange/amber tint)
        // Write: when a variable is being assigned/modified
        // Uses wordHighlightStrong which Monaco maps to write occurrences
        
        // Whitespace
        "editorWhitespace.foreground": "#3F3F46",
        
        // Indent guides
        "editorIndentGuide.background1": "#3F3F46",
        "editorIndentGuide.activeBackground1": "#52525B",
        
        // Bracket matching - Trae/Cortex indigo
        "editorBracketMatch.background": "#6366F14d",
        "editorBracketMatch.border": "#6366F1",
        
        // Bracket colorization - Figma: ALL WHITE (#FFFFFF)
        "editorBracketHighlight.foreground1": "#FFFFFF",
        "editorBracketHighlight.foreground2": "#FFFFFF",
        "editorBracketHighlight.foreground3": "#FFFFFF",
        "editorBracketHighlight.foreground4": "#FFFFFF",
        "editorBracketHighlight.foreground5": "#FFFFFF",
        "editorBracketHighlight.foreground6": "#FFFFFF",
        "editorBracketHighlight.unexpectedBracket.foreground": "#EF4444",
        
        // Bracket pair guides - Figma: white with opacity
        "editorBracketPairGuide.foreground1": "#FFFFFF40",
        "editorBracketPairGuide.foreground2": "#FFFFFF40",
        "editorBracketPairGuide.foreground3": "#FFFFFF40",
        "editorBracketPairGuide.foreground4": "#FFFFFF40",
        "editorBracketPairGuide.foreground5": "#FFFFFF40",
        "editorBracketPairGuide.foreground6": "#FFFFFF40",
        "editorBracketPairGuide.activeBackground1": "#FFFFFF",
        "editorBracketPairGuide.activeBackground2": "#FFFFFF",
        "editorBracketPairGuide.activeBackground3": "#FFFFFF",
        "editorBracketPairGuide.activeBackground4": "#FFFFFF",
        "editorBracketPairGuide.activeBackground5": "#FFFFFF",
        "editorBracketPairGuide.activeBackground6": "#FFFFFF",
        
        // Minimap - same as editor
        "minimap.background": "#141415",
        "minimap.foregroundOpacity": "#000000cc",
        "minimapSlider.background": "#2E2F3150",
        "minimapSlider.hoverBackground": "#2E2F3180",
        "minimapSlider.activeBackground": "#2E2F31a0",
        
        // Scrollbar - Figma: #2E2F31 thumb, transparent track
        "scrollbarSlider.background": "#2E2F31",
        "scrollbarSlider.hoverBackground": "#2E2F31cc",
        "scrollbarSlider.activeBackground": "#2E2F31e0",
        
        // Error/warning/info squiggles
        "editorError.foreground": "#FF7070",
        "editorWarning.foreground": "#FEC55A",
        "editorInfo.foreground": "#6366F1",
        "editorHint.foreground": "#6366F1",
        
        // Inlay hints
        "editorInlayHint.background": "#14141580",
        "editorInlayHint.foreground": "#8C8D8F",
        "editorInlayHint.typeForeground": "#8C8D8F",
        "editorInlayHint.typeBackground": "#14141580",
        "editorInlayHint.parameterForeground": "#8C8D8F",
        "editorInlayHint.parameterBackground": "#14141580",
        
        // Linked editing
        "editor.linkedEditingBackground": "#6366F120",
        
        // Find/search match - Trae/Cortex indigo
        "editor.findMatchBackground": "#6366F14d",
        "editor.findMatchHighlightBackground": "#6366F133",
        "editor.findMatchBorder": "#6366F1",
        
        // Gutter modification indicators
        "editorGutter.modifiedBackground": "#6366F1",
        "editorGutter.addedBackground": "#22C55E",
        "editorGutter.deletedBackground": "#EF4444",
        
        // Overview ruler (right-side scrollbar annotations)
        "editorOverviewRuler.errorForeground": "#FF7070",
        "editorOverviewRuler.warningForeground": "#FEC55A",
        "editorOverviewRuler.infoForeground": "#6366F1",
        "editorOverviewRuler.bracketMatchForeground": "#6366F1",
        "editorOverviewRuler.findMatchForeground": "#6366F1",
        "editorOverviewRuler.modifiedForeground": "#6366F1",
        "editorOverviewRuler.addedForeground": "#22C55E",
        "editorOverviewRuler.deletedForeground": "#EF4444",
      },
    });
    
    this.themeRegistered = true;
  }

  /**
   * Calculate large file optimizations based on line count
   * @param lineCount - Number of lines in the file
   * @param settings - Optional large file settings from user configuration
   */
  getLargeFileOptions(lineCount: number, settings?: LargeFileSettings): LargeFileOptions {
    // If large file optimizations are disabled, return all false
    if (settings && !settings.largeFileOptimizations) {
      return {
        disableMinimap: false,
        disableBracketMatching: false,
        disableWordSuggestions: false,
        disableFolding: false,
        useSimplifiedTokenization: false,
      };
    }
    
    return {
      disableMinimap: lineCount > LARGE_FILE_THRESHOLDS.DISABLE_MINIMAP,
      disableBracketMatching: lineCount > LARGE_FILE_THRESHOLDS.DISABLE_BRACKET_MATCHING,
      disableWordSuggestions: lineCount > LARGE_FILE_THRESHOLDS.DISABLE_WORD_SUGGESTIONS,
      disableFolding: lineCount > LARGE_FILE_THRESHOLDS.DISABLE_FOLDING,
      useSimplifiedTokenization: lineCount > LARGE_FILE_THRESHOLDS.DISABLE_FOLDING,
    };
  }

  /**
   * Get editor options adjusted for large files
   * @param baseOptions - Base Monaco editor options
   * @param lineCount - Number of lines in the file
   * @param settings - Optional large file settings from user configuration
   */
  getOptionsForFile(
    baseOptions: Monaco.editor.IStandaloneEditorConstructionOptions,
    lineCount: number,
    settings?: LargeFileSettings
  ): Monaco.editor.IStandaloneEditorConstructionOptions {
    const largeFileOpts = this.getLargeFileOptions(lineCount, settings);
    
    const options = { ...baseOptions };
    
    // Large file optimizations
    if (largeFileOpts.disableMinimap) {
      options.minimap = { enabled: false };
    }
    
    if (largeFileOpts.disableBracketMatching) {
      options.matchBrackets = "never";
      options.bracketPairColorization = { enabled: false };
    }
    
    if (largeFileOpts.disableWordSuggestions) {
      options.wordBasedSuggestions = "off";
    }
    
    if (largeFileOpts.disableFolding) {
      options.folding = false;
    }
    
    // Apply Monaco's built-in large file optimizations setting
    options.largeFileOptimizations = settings?.largeFileOptimizations ?? true;
    
    // Apply max tokenization line length from settings
    if (settings?.maxTokenizationLineLength) {
      options.maxTokenizationLineLength = settings.maxTokenizationLineLength;
    }
    
    return options;
  }

  /**
   * Get or create a cached model for a file
   */
  getOrCreateModel(
    filePath: string,
    content: string,
    languageId: string
  ): Monaco.editor.ITextModel {
    if (!this.monaco) {
      throw new Error("Monaco not loaded");
    }

    const cacheKey = filePath;
    const cached = this.modelCache.get(cacheKey);

    if (cached) {
      // Cancel any pending disposal
      if (cached.disposeTimer) {
        clearTimeout(cached.disposeTimer);
        cached.disposeTimer = null;
      }
      
      cached.lastUsed = Date.now();
      
      // Update content if it changed externally
      if (cached.model.getValue() !== content) {
        cached.model.setValue(content);
      }
      
      // Update language if needed
      if (cached.languageId !== languageId) {
        this.monaco.editor.setModelLanguage(cached.model, languageId);
        cached.languageId = languageId;
      }
      
      return cached.model;
    }

    // Create new model
    const uri = this.monaco.Uri.parse(`file://${filePath.replace(/\\/g, "/")}`);
    
    // Check if model with this URI already exists (cleanup stale)
    const existingModel = this.monaco.editor.getModel(uri);
    if (existingModel) {
      existingModel?.dispose?.();
    }
    
    const model = this.monaco.editor.createModel(content, languageId, uri);

    this.modelCache.set(cacheKey, {
      model,
      filePath,
      languageId,
      disposeTimer: null,
      lastUsed: Date.now(),
      version: model.getVersionId(),
    });

    return model;
  }

  /**
   * Schedule model disposal for a file (delayed to allow reopening)
   */
  scheduleModelDisposal(filePath: string): void {
    const cached = this.modelCache.get(filePath);
    if (!cached) return;

    // Cancel existing timer
    if (cached.disposeTimer) {
      clearTimeout(cached.disposeTimer);
    }

    // Schedule disposal
    cached.disposeTimer = setTimeout(() => {
      const entry = this.modelCache.get(filePath);
      if (entry && entry.disposeTimer) {
        entry.model?.dispose?.();
        this.modelCache.delete(filePath);
      }
    }, this.config.modelDisposeDelay);
  }

  /**
   * Cancel scheduled disposal for a file
   */
  cancelModelDisposal(filePath: string): void {
    const cached = this.modelCache.get(filePath);
    if (cached?.disposeTimer) {
      clearTimeout(cached.disposeTimer);
      cached.disposeTimer = null;
    }
  }

  /**
   * Immediately dispose a model
   */
  disposeModel(filePath: string): void {
    const cached = this.modelCache.get(filePath);
    if (cached) {
      if (cached.disposeTimer) {
        clearTimeout(cached.disposeTimer);
      }
      cached.model?.dispose?.();
      this.modelCache.delete(filePath);
    }
  }

  /**
   * Get current content from a cached model
   */
  getModelContent(filePath: string): string | null {
    const cached = this.modelCache.get(filePath);
    return cached ? cached.model.getValue() : null;
  }

  /**
   * Check if a model is cached for a file
   */
  hasModel(filePath: string): boolean {
    return this.modelCache.has(filePath);
  }

  /**
   * Acquire an editor instance from the pool
   * Creates a new one if pool is not full and none available
   */
  acquireEditor(
    container: HTMLDivElement,
    options: Monaco.editor.IStandaloneEditorConstructionOptions
  ): Monaco.editor.IStandaloneCodeEditor {
    if (!this.monaco) {
      throw new Error("Monaco not loaded");
    }

    // Look for an available editor in the pool
    const available = this.editorPool.find((p) => !p.inUse);
    
    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      
      // Move editor to new container
      if (available.container !== container) {
        // Layout editor in new container
        container.appendChild(available.container);
        available.editor.layout();
      }
      
      // Update options
      available.editor.updateOptions(options);
      
      return available.editor;
    }

    // Create new editor if pool not full
    if (this.editorPool.length < this.config.poolSize) {
      // Create a wrapper div for the editor
      const editorContainer = document.createElement("div");
      editorContainer.style.width = "100%";
      editorContainer.style.height = "100%";
      container.appendChild(editorContainer);

      const editor = this.monaco.editor.create(editorContainer, {
        ...options,
        theme: "cortex-dark",
        automaticLayout: true,
      });

      const pooled: PooledEditor = {
        editor,
        inUse: true,
        container: editorContainer,
        filePath: null,
        lastUsed: Date.now(),
      };

      this.editorPool.push(pooled);
      return editor;
    }

    // Pool is full, reuse the least recently used editor
    const leastUsed = this.editorPool
      .filter((p) => !p.inUse)
      .sort((a, b) => a.lastUsed - b.lastUsed)[0];

    if (leastUsed) {
      leastUsed.inUse = true;
      leastUsed.lastUsed = Date.now();
      
      container.appendChild(leastUsed.container);
      leastUsed.editor.updateOptions(options);
      leastUsed.editor.layout();
      
      return leastUsed.editor;
    }

    // All editors in use - create a temporary one (will be cleaned up later)
    const editorContainer = document.createElement("div");
    editorContainer.style.width = "100%";
    editorContainer.style.height = "100%";
    container.appendChild(editorContainer);

    return this.monaco.editor.create(editorContainer, {
      ...options,
      theme: "cortex-dark",
      automaticLayout: true,
    });
  }

  /**
   * Release an editor back to the pool
   */
  releaseEditor(editor: Monaco.editor.IStandaloneCodeEditor): void {
    const pooled = this.editorPool.find((p) => p.editor === editor);
    
    if (pooled) {
      pooled.inUse = false;
      pooled.filePath = null;
    } else {
      // Editor not in pool - it's a temporary one, dispose it
      editor?.dispose?.();
    }
  }

  /**
   * Set the model for an editor (swapping instead of recreating)
   */
  setEditorModel(
    editor: Monaco.editor.IStandaloneCodeEditor,
    filePath: string,
    content: string,
    languageId: string
  ): Monaco.editor.ITextModel {
    const model = this.getOrCreateModel(filePath, content, languageId);
    editor.setModel(model);
    
    // Update pooled editor file path
    const pooled = this.editorPool.find((p) => p.editor === editor);
    if (pooled) {
      pooled.filePath = filePath;
    }
    
    return model;
  }

  /**
   * Update editor options based on file size
   * @param editor - Monaco editor instance
   * @param lineCount - Number of lines in the file
   * @param settings - Optional large file settings from user configuration
   * @param baseMinimapEnabled - Whether minimap is enabled in base settings (to restore when optimizations don't apply)
   * @param baseFoldingEnabled - Whether folding is enabled in base settings (to restore when optimizations don't apply)
   * @param baseBracketColorization - Whether bracket colorization is enabled in base settings
   */
  updateEditorForFileSize(
    editor: Monaco.editor.IStandaloneCodeEditor,
    lineCount: number,
    settings?: LargeFileSettings,
    baseMinimapEnabled: boolean = true,
    baseFoldingEnabled: boolean = true,
    baseBracketColorization: boolean = true
  ): void {
    const largeFileOpts = this.getLargeFileOptions(lineCount, settings);
    
    editor.updateOptions({
      minimap: { enabled: largeFileOpts.disableMinimap ? false : baseMinimapEnabled },
      matchBrackets: largeFileOpts.disableBracketMatching ? "never" : "always",
      bracketPairColorization: { enabled: largeFileOpts.disableBracketMatching ? false : baseBracketColorization },
      wordBasedSuggestions: largeFileOpts.disableWordSuggestions ? "off" : "currentDocument",
      folding: largeFileOpts.disableFolding ? false : baseFoldingEnabled,
      largeFileOptimizations: settings?.largeFileOptimizations ?? true,
      maxTokenizationLineLength: settings?.maxTokenizationLineLength ?? 20000,
    });
  }

  /**
   * Register a provider and track its disposable
   */
  registerProvider(disposable: Monaco.IDisposable): void {
    this.providerDisposables.push(disposable);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    // Dispose all providers
    this.providerDisposables.forEach((d) => d?.dispose?.());
    this.providerDisposables = [];

    // Dispose all models
    this.modelCache.forEach((cached) => {
      if (cached?.disposeTimer) {
        clearTimeout(cached.disposeTimer);
      }
      cached?.model?.dispose?.();
    });
    this.modelCache.clear();

    // Dispose all editors in pool
    this.editorPool.forEach((pooled) => {
      pooled?.editor?.dispose?.();
    });
    this.editorPool = [];

    this.monaco = null;
    this.loadState = "idle";
    this.loadPromise = null;
    this.themeRegistered = false;
  }

  /**
   * Get statistics about the manager state
   */
  getStats(): {
    loadState: MonacoLoadState;
    poolSize: number;
    poolInUse: number;
    cachedModels: number;
    pendingDisposals: number;
  } {
    return {
      loadState: this.loadState,
      poolSize: this.editorPool.length,
      poolInUse: this.editorPool.filter((p) => p.inUse).length,
      cachedModels: this.modelCache.size,
      pendingDisposals: Array.from(this.modelCache.values()).filter(
        (c) => c.disposeTimer !== null
      ).length,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  MonacoManager,
  LARGE_FILE_THRESHOLDS,
  EDITOR_POOL_SIZE,
  MODEL_DISPOSE_DELAY_MS,
};

export type {
  MonacoLoadState,
  PooledEditor,
  CachedModel,
  LargeFileOptions,
  MonacoManagerConfig,
};

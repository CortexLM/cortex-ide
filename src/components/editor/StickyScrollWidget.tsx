/**
 * StickyScrollWidget - Sticky Scroll Header for Code Editor
 *
 * Displays parent scope context (functions, classes, namespaces, etc.) 
 * at the top of the editor viewport as the user scrolls.
 *
 * Features:
 * - Shows nested scope hierarchy (class > method > inner function)
 * - Configurable maximum number of sticky lines (default: 5)
 * - Click to navigate to the scope definition
 * - Hover to preview the scope line
 * - Smooth transitions when scope changes
 * - Consistent styling with Monaco editor (font, line height)
 * - Full light/dark theme support
 * - Scope calculation from folding ranges or AST
 */

import { 
  createSignal, 
  createEffect, 
  onCleanup, 
  Show, 
  For, 
  createMemo 
} from "solid-js";
import type * as Monaco from "monaco-editor";
import type { StickyScrollLine, StickyScrollState } from "@/types/editor";

// ============================================================================
// Types
// ============================================================================

/** Document symbol information from LSP/outline context */
export interface DocumentSymbolInfo {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  children?: DocumentSymbolInfo[];
}

export interface StickyScrollWidgetProps {
  /** Monaco editor instance */
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  /** Monaco module reference */
  monaco: typeof Monaco | null;
  /** Maximum number of sticky lines to display */
  maxLineCount?: number;
  /** Whether sticky scroll is enabled */
  enabled?: boolean;
  /** Callback when a sticky line is clicked */
  onLineClick?: (lineNumber: number) => void;
  /** Font family to use (should match editor) */
  fontFamily?: string;
  /** Font size to use (should match editor) */
  fontSize?: number;
  /** Line height to use (should match editor) */
  lineHeight?: number;
  /** Document symbols from LSP/outline context for scope calculation */
  symbols?: DocumentSymbolInfo[];
}

/** Internal scope information for calculation */
interface ScopeInfo {
  /** Start line of the scope (1-based) */
  startLine: number;
  /** End line of the scope (1-based) */
  endLine: number;
  /** Nesting depth (0 = top level) */
  depth: number;
  /** Type of scope (function, class, etc.) */
  kind: ScopeKind;
  /** Display text for the scope line */
  text: string;
}

/** Types of scopes we track */
type ScopeKind = 
  | "class" 
  | "interface" 
  | "function" 
  | "method" 
  | "namespace" 
  | "module" 
  | "enum" 
  | "struct"
  | "block"
  | "region"
  | "comment"
  | "imports"
  | "unknown";

/** Folding range from Monaco/LSP */
interface FoldingRange {
  start: number;
  end: number;
  kind?: Monaco.languages.FoldingRangeKind;
}

// ============================================================================
// Scope Detection Utilities
// ============================================================================

/** Patterns to detect scope types from line content */
const SCOPE_PATTERNS: Array<{ pattern: RegExp; kind: ScopeKind }> = [
  // Classes
  { pattern: /^\s*(export\s+)?(abstract\s+)?(class|interface)\s+\w+/, kind: "class" },
  { pattern: /^\s*(pub\s+)?(struct|enum|trait|impl)\s+/, kind: "struct" },
  
  // Functions/Methods
  { pattern: /^\s*(export\s+)?(async\s+)?(function|const\s+\w+\s*=\s*(async\s+)?(\([^)]*\)|[^=])\s*=>)/, kind: "function" },
  { pattern: /^\s*(public|private|protected|static|async|abstract)*\s*\w+\s*\([^)]*\)\s*[:{]/, kind: "method" },
  { pattern: /^\s*(pub\s+)?(async\s+)?fn\s+\w+/, kind: "function" },
  { pattern: /^\s*def\s+\w+\s*\(/, kind: "function" },
  { pattern: /^\s*func\s+\w+\s*\(/, kind: "function" },
  
  // Namespaces/Modules
  { pattern: /^\s*(export\s+)?(namespace|module)\s+\w+/, kind: "namespace" },
  { pattern: /^\s*mod\s+\w+/, kind: "module" },
  { pattern: /^\s*package\s+\w+/, kind: "namespace" },
  
  // Enums
  { pattern: /^\s*(export\s+)?enum\s+\w+/, kind: "enum" },
  
  // Blocks (if, for, while, etc.) - lower priority
  { pattern: /^\s*(if|else|for|while|switch|match|try|catch)\s*[\({]/, kind: "block" },
  
  // Imports block
  { pattern: /^\s*(import|from|use)\s+/, kind: "imports" },
  
  // Region comments
  { pattern: /^\s*\/\/\s*#?region\s+/i, kind: "region" },
  { pattern: /^\s*\/\*\s*#?region\s+/i, kind: "region" },
];

/**
 * Detects the scope kind from line content.
 */
function detectScopeKind(lineText: string): ScopeKind {
  for (const { pattern, kind } of SCOPE_PATTERNS) {
    if (pattern.test(lineText)) {
      return kind;
    }
  }
  return "unknown";
}

/**
 * Determines if a scope kind should be shown in sticky scroll.
 * We skip certain types like block statements and imports.
 */
function shouldShowScope(kind: ScopeKind): boolean {
  // Show important structural scopes
  return ["class", "interface", "function", "method", "namespace", "module", "enum", "struct", "region"].includes(kind);
}

/**
 * Maps an LSP symbol kind string to an internal ScopeKind.
 */
function mapSymbolKindToScopeKind(kind: string): ScopeKind {
  const kindLower = kind.toLowerCase();
  switch (kindLower) {
    case "class": return "class";
    case "interface": return "interface";
    case "function": return "function";
    case "method": case "constructor": return "method";
    case "namespace": case "package": return "namespace";
    case "module": return "module";
    case "enum": return "enum";
    case "struct": case "trait": case "impl": return "struct";
    default: return "unknown";
  }
}

/**
 * Converts LSP document symbols into ScopeInfo[] for sticky scroll.
 * Recursively processes children to capture nested scopes.
 */
function calculateScopesFromSymbols(symbols: DocumentSymbolInfo[], depth: number = 0): ScopeInfo[] {
  const scopes: ScopeInfo[] = [];
  for (const sym of symbols) {
    const kind = mapSymbolKindToScopeKind(sym.kind);
    if (shouldShowScope(kind)) {
      scopes.push({
        startLine: sym.startLine,
        endLine: sym.endLine,
        depth,
        kind,
        text: sym.name,
      });
    }
    if (sym.children?.length) {
      scopes.push(...calculateScopesFromSymbols(sym.children, depth + 1));
    }
  }
  return scopes.sort((a, b) => a.startLine !== b.startLine ? a.startLine - b.startLine : a.depth - b.depth);
}

/**
 * Extracts a clean display name from a scope line.
 * Removes excessive whitespace, trailing braces, etc.
 */
function cleanScopeText(lineText: string, maxLength: number = 100): string {
  let text = lineText.trim();
  
  // Remove trailing opening brace/colon and whitespace
  text = text.replace(/\s*[{:]\s*$/, "");
  
  // Remove inline comments
  text = text.replace(/\/\/.*$/, "").replace(/\/\*.*\*\/$/, "");
  
  // Collapse multiple spaces
  text = text.replace(/\s+/g, " ");
  
  // Truncate if too long
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3) + "...";
  }
  
  return text;
}

// ============================================================================
// StickyScrollWidget Component
// ============================================================================

export function StickyScrollWidget(props: StickyScrollWidgetProps) {
  // ============================================================================
  // State
  // ============================================================================
  
  const [stickyLines, setStickyLines] = createSignal<StickyScrollLine[]>([]);
  const [hoveredLine, setHoveredLine] = createSignal<number | null>(null);
  const [isVisible, setIsVisible] = createSignal(false);
  const [cachedScopes, setCachedScopes] = createSignal<ScopeInfo[]>([]);
  const [lastScrollTop, setLastScrollTop] = createSignal(0);
  
  // Computed values
  const maxLines = createMemo(() => props.maxLineCount ?? 5);
  const enabled = createMemo(() => props.enabled ?? true);
  
  // Editor style values (with defaults)
  const fontFamily = createMemo(() => 
    props.fontFamily ?? "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace"
  );
  const fontSize = createMemo(() => props.fontSize ?? 13);
  const lineHeight = createMemo(() => props.lineHeight ?? 20);
  
  // Track if scopes need recalculation
  let updateTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let scrollDebounceId: ReturnType<typeof setTimeout> | null = null;
  
  // ============================================================================
  // Scope Calculation
  // ============================================================================
  
  /**
   * Calculates scope information from folding ranges.
   * This provides structural information about the code.
   */
  async function calculateScopesFromFolding(): Promise<ScopeInfo[]> {
    if (!props.editor || !props.monaco) return [];
    
    const model = props.editor.getModel();
    if (!model) return [];
    
    const scopes: ScopeInfo[] = [];
    
    try {
      // Get folding ranges from Monaco's folding provider
      const foldingRanges = await getFoldingRanges(model);
      
      // Convert folding ranges to scope info
      for (const range of foldingRanges) {
        const lineText = model.getLineContent(range.start);
        const kind = detectScopeKind(lineText);
        
        // Skip scopes we don't want to show
        if (!shouldShowScope(kind)) continue;
        
        // Calculate depth based on nesting
        const depth = calculateDepth(range.start, foldingRanges);
        
        scopes.push({
          startLine: range.start,
          endLine: range.end,
          depth,
          kind,
          text: cleanScopeText(lineText),
        });
      }
      
      // Sort by start line and depth
      scopes.sort((a, b) => {
        if (a.startLine !== b.startLine) return a.startLine - b.startLine;
        return a.depth - b.depth;
      });
      
    } catch (error) {
      console.debug("StickyScroll: Error calculating scopes from folding:", error);
    }
    
    return scopes;
  }
  
  /**
   * Gets folding ranges from Monaco's folding model.
   */
  async function getFoldingRanges(model: Monaco.editor.ITextModel): Promise<FoldingRange[]> {
    if (!props.monaco) return [];
    
    const language = model.getLanguageId();
    
    // Try to get folding ranges from registered providers
    // Note: FoldingRangeProviderRegistry is an internal Monaco API that may not be available
    // in all Monaco versions. We safely access it with optional chaining.
    const monacoLanguages = props.monaco.languages as unknown as { 
      FoldingRangeProviderRegistry?: { 
        all(model: Monaco.editor.ITextModel): Monaco.languages.FoldingRangeProvider[] 
      } 
    };
    const providers = monacoLanguages.FoldingRangeProviderRegistry?.all(model) ?? [];
    
    if (providers.length > 0) {
      try {
        // Use the first provider
        const ranges = await providers[0].provideFoldingRanges(
          model, 
          {}, 
          { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) }
        );
        
        if (ranges) {
          return ranges.map((r: Monaco.languages.FoldingRange) => ({
            start: r.start,
            end: r.end,
            kind: r.kind,
          }));
        }
      } catch (error) {
        console.debug("StickyScroll: Folding provider error:", error);
      }
    }
    
    // Fallback: Calculate simple folding ranges from indentation
    return calculateFoldingFromIndentation(model, language);
  }
  
  /**
   * Fallback: Calculate folding ranges based on indentation.
   */
  function calculateFoldingFromIndentation(model: Monaco.editor.ITextModel, _language: string): FoldingRange[] {
    const ranges: FoldingRange[] = [];
    const lineCount = model.getLineCount();
    const indentStack: Array<{ line: number; indent: number }> = [];
    
    for (let i = 1; i <= lineCount; i++) {
      const lineText = model.getLineContent(i);
      const trimmed = lineText.trim();
      
      // Skip empty lines
      if (!trimmed) continue;
      
      // Calculate indentation (count leading spaces/tabs)
      const indent = lineText.search(/\S/);
      if (indent < 0) continue;
      
      // Pop items from stack with greater or equal indent
      while (indentStack.length > 0) {
        const top = indentStack[indentStack.length - 1];
        if (top.indent >= indent) {
          // Close the previous scope
          if (i - 1 > top.line) {
            ranges.push({
              start: top.line,
              end: i - 1,
            });
          }
          indentStack.pop();
        } else {
          break;
        }
      }
      
      // Check if this line starts a new scope
      const kind = detectScopeKind(lineText);
      if (shouldShowScope(kind)) {
        indentStack.push({ line: i, indent });
      }
    }
    
    // Close remaining scopes
    while (indentStack.length > 0) {
      const top = indentStack.pop()!;
      ranges.push({
        start: top.line,
        end: lineCount,
      });
    }
    
    return ranges;
  }
  
  /**
   * Calculate depth (nesting level) for a given line.
   */
  function calculateDepth(line: number, ranges: FoldingRange[]): number {
    let depth = 0;
    for (const range of ranges) {
      if (range.start < line && range.end >= line) {
        depth++;
      }
    }
    return depth;
  }
  
  // ============================================================================
  // Sticky Lines Update
  // ============================================================================
  
  /**
   * Updates the sticky lines based on current scroll position.
   */
  function updateStickyLines() {
    if (!props.editor || !enabled()) {
      setStickyLines([]);
      setIsVisible(false);
      return;
    }
    
    const scrollTop = props.editor.getScrollTop();
    const lineHeight = props.editor.getOption(props.monaco!.editor.EditorOption.lineHeight);
    
    // Calculate the first visible line
    const firstVisibleLine = Math.floor(scrollTop / lineHeight) + 1;
    
    const scopes = cachedScopes();
    const max = maxLines();
    
    // Find scopes that contain the first visible line
    const activeScopes: StickyScrollLine[] = [];
    
    for (const scope of scopes) {
      // The scope should:
      // 1. Start before the first visible line (or at it)
      // 2. End after the first visible line
      // 3. The start line should now be "scrolled past"
      if (scope.startLine <= firstVisibleLine && scope.endLine > firstVisibleLine) {
        // Only show if the scope's start line has scrolled out of view
        if (scope.startLine < firstVisibleLine) {
          activeScopes.push({
            lineNumber: scope.startLine,
            depth: scope.depth,
            text: scope.text,
          });
        }
      }
    }
    
    // Sort by depth (innermost scopes last, we want them at the bottom)
    activeScopes.sort((a, b) => a.depth - b.depth);
    
    // Limit to max lines, keeping the most specific (deepest) scopes
    const limitedScopes = activeScopes.slice(-max);
    
    // Update state with transition
    setStickyLines(limitedScopes);
    setIsVisible(limitedScopes.length > 0);
  }
  
  /**
   * Handles editor scroll events.
   */
  function handleScroll() {
    if (!props.editor) return;
    
    const scrollTop = props.editor.getScrollTop();
    
    // Debounce rapid scroll events
    if (scrollDebounceId) {
      clearTimeout(scrollDebounceId);
    }
    
    // Quick update for smooth feel
    if (Math.abs(scrollTop - lastScrollTop()) > 10) {
      updateStickyLines();
      setLastScrollTop(scrollTop);
    } else {
      // Debounce smaller scrolls
      scrollDebounceId = setTimeout(() => {
        updateStickyLines();
        setLastScrollTop(scrollTop);
        scrollDebounceId = null;
      }, 16); // ~60fps
    }
  }
  
  /**
   * Handles model content changes.
   */
  function handleModelChange() {
    // Debounce scope recalculation
    if (updateTimeoutId) {
      clearTimeout(updateTimeoutId);
    }
    
    updateTimeoutId = setTimeout(async () => {
      if (props.symbols?.length) {
        const scopes = calculateScopesFromSymbols(props.symbols);
        setCachedScopes(scopes);
      } else {
        const scopes = await calculateScopesFromFolding();
        setCachedScopes(scopes);
      }
      updateStickyLines();
      updateTimeoutId = null;
    }, 250); // Wait for edits to settle
  }
  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  /**
   * Handles click on a sticky line.
   */
  function handleLineClick(lineNumber: number) {
    if (!props.editor || !props.monaco) return;
    
    // Navigate to the line
    props.editor.revealLineInCenter(lineNumber);
    props.editor.setPosition({ lineNumber, column: 1 });
    props.editor.focus();
    
    // Callback
    props.onLineClick?.(lineNumber);
  }
  
  /**
   * Handles mouse enter on a sticky line.
   */
  function handleLineMouseEnter(lineNumber: number) {
    setHoveredLine(lineNumber);
  }
  
  /**
   * Handles mouse leave from a sticky line.
   */
  function handleLineMouseLeave() {
    setHoveredLine(null);
  }
  
  /**
   * Handles double-click - reveals and selects the line.
   */
  function handleLineDoubleClick(lineNumber: number) {
    if (!props.editor || !props.monaco) return;
    
    const model = props.editor.getModel();
    if (!model) return;
    
    // Go to line and select it
    props.editor.revealLineInCenter(lineNumber);
    
    const lineContent = model.getLineContent(lineNumber);
    props.editor.setSelection(new props.monaco.Selection(
      lineNumber, 1, 
      lineNumber, lineContent.length + 1
    ));
    props.editor.focus();
  }
  
  // ============================================================================
  // Lifecycle
  // ============================================================================
  
  // Set up editor event listeners
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    
    if (!editor || !monaco || !enabled()) {
      setStickyLines([]);
      setIsVisible(false);
      return;
    }
    
    const disposables: Monaco.IDisposable[] = [];
    
    // Listen for scroll events
    disposables.push(editor.onDidScrollChange(handleScroll));
    
    // Listen for model changes
    disposables.push(editor.onDidChangeModelContent(handleModelChange));
    
    // Listen for model change (file switch)
    disposables.push(editor.onDidChangeModel(async () => {
      if (props.symbols?.length) {
        const scopes = calculateScopesFromSymbols(props.symbols);
        setCachedScopes(scopes);
      } else {
        const scopes = await calculateScopesFromFolding();
        setCachedScopes(scopes);
      }
      updateStickyLines();
    }));
    
    // Initial scope calculation
    if (props.symbols?.length) {
      const scopes = calculateScopesFromSymbols(props.symbols);
      setCachedScopes(scopes);
      updateStickyLines();
    } else {
      (async () => {
        const scopes = await calculateScopesFromFolding();
        setCachedScopes(scopes);
        updateStickyLines();
      })();
    }
    
    // Cleanup
    onCleanup(() => {
      disposables.forEach(d => d.dispose());
      if (updateTimeoutId) clearTimeout(updateTimeoutId);
      if (scrollDebounceId) clearTimeout(scrollDebounceId);
    });
  });
  
  // Reactively update scopes when LSP symbols change
  createEffect(() => {
    const symbols = props.symbols;
    if (symbols?.length) {
      const scopes = calculateScopesFromSymbols(symbols);
      setCachedScopes(scopes);
      updateStickyLines();
    }
  });
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <Show when={enabled() && isVisible()}>
      <div 
        class="sticky-scroll-widget"
        style={{
          "--sticky-font-family": fontFamily(),
          "--sticky-font-size": `${fontSize()}px`,
          "--sticky-line-height": `${lineHeight()}px`,
        }}
      >
        <For each={stickyLines()}>
          {(line, index) => (
            <div
              class="sticky-scroll-line"
              classList={{
                "sticky-scroll-line-hovered": hoveredLine() === line.lineNumber,
                "sticky-scroll-line-last": index() === stickyLines().length - 1,
              }}
              style={{
                "--depth": line.depth,
                "--indent": `${line.depth * 16}px`,
              }}
              onClick={() => handleLineClick(line.lineNumber)}
              onDblClick={() => handleLineDoubleClick(line.lineNumber)}
              onMouseEnter={() => handleLineMouseEnter(line.lineNumber)}
              onMouseLeave={handleLineMouseLeave}
              title={`Line ${line.lineNumber}: ${line.text}`}
            >
              <span class="sticky-scroll-line-number">{line.lineNumber}</span>
              <span class="sticky-scroll-line-text">{line.text}</span>
            </div>
          )}
        </For>
        
        {/* Fade shadow at bottom */}
        <div class="sticky-scroll-shadow" />
        
        <style>{`
          .sticky-scroll-widget {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            z-index: 10;
            background: var(--vscode-editorStickyScroll-background, var(--vscode-editor-background, var(--cortex-bg-primary)));
            border-bottom: 1px solid var(--vscode-editorStickyScroll-border, var(--vscode-editorWidget-border, var(--cortex-bg-active)));
            font-family: var(--sticky-font-family);
            font-size: var(--sticky-font-size);
            line-height: var(--sticky-line-height);
            overflow: hidden;
            user-select: none;
            
            /* Smooth appearance */
            animation: stickyScrollFadeIn 0.15s ease-out;
          }
          
          @keyframes stickyScrollFadeIn {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .sticky-scroll-line {
            display: flex;
            align-items: center;
            height: var(--sticky-line-height);
            padding: 0 8px 0 calc(var(--indent, 0px) + 8px);
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--vscode-editorStickyScroll-foreground, var(--vscode-editor-foreground, var(--cortex-text-primary)));
            background: transparent;
            transition: background-color 0.1s ease;
          }
          
          .sticky-scroll-line:hover,
          .sticky-scroll-line-hovered {
            background: var(--vscode-editorStickyScrollHover-background, rgba(255, 255, 255, 0.1));
          }
          
          .sticky-scroll-line-last {
            /* Slightly stronger visual for deepest scope */
          }
          
          .sticky-scroll-line-number {
            min-width: 40px;
            margin-right: 8px;
            color: var(--vscode-editorLineNumber-foreground, var(--cortex-text-inactive));
            font-variant-numeric: tabular-nums;
            text-align: right;
            opacity: 0;
            transition: opacity 0.15s ease;
          }
          
          .sticky-scroll-line:hover .sticky-scroll-line-number {
            opacity: 1;
          }
          
          .sticky-scroll-line-text {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .sticky-scroll-shadow {
            position: absolute;
            left: 0;
            right: 0;
            bottom: -8px;
            height: 8px;
            background: linear-gradient(
              to bottom,
              var(--vscode-editorStickyScroll-shadow, rgba(0, 0, 0, 0.3)),
              transparent
            );
            pointer-events: none;
          }
          
          /* Light theme adjustments */
          @media (prefers-color-scheme: light) {
            .sticky-scroll-widget {
              background: var(--vscode-editorStickyScroll-background, var(--vscode-editor-background, var(--cortex-text-primary)));
              border-bottom-color: var(--vscode-editorStickyScroll-border, var(--vscode-editorWidget-border, var(--cortex-text-primary)));
            }
            
            .sticky-scroll-line {
              color: var(--vscode-editorStickyScroll-foreground, var(--vscode-editor-foreground, var(--cortex-bg-hover)));
            }
            
            .sticky-scroll-line:hover,
            .sticky-scroll-line-hovered {
              background: var(--vscode-editorStickyScrollHover-background, rgba(0, 0, 0, 0.06));
            }
            
            .sticky-scroll-line-number {
              color: var(--vscode-editorLineNumber-foreground, var(--cortex-text-inactive));
            }
            
            .sticky-scroll-shadow {
              background: linear-gradient(
                to bottom,
                var(--vscode-editorStickyScroll-shadow, rgba(0, 0, 0, 0.12)),
                transparent
              );
            }
          }
          
          /* When VSCode theme variables are not available, support basic light class */
          .theme-light .sticky-scroll-widget {
            background: var(--cortex-text-primary);
            border-bottom-color: var(--cortex-text-primary);
          }
          
          .theme-light .sticky-scroll-line {
            color: var(--cortex-bg-hover);
          }
          
          .theme-light .sticky-scroll-line:hover {
            background: rgba(0, 0, 0, 0.06);
          }
          
          .theme-light .sticky-scroll-line-number {
            color: var(--cortex-text-inactive);
          }
          
          .theme-light .sticky-scroll-shadow {
            background: linear-gradient(to bottom, rgba(0, 0, 0, 0.1), transparent);
          }
        `}</style>
      </div>
    </Show>
  );
}

// ============================================================================
// State Management Helpers
// ============================================================================

/**
 * Creates an initial StickyScrollState object.
 */
export function createStickyScrollState(maxLineCount: number = 5): StickyScrollState {
  return {
    lines: [],
    maxLineCount,
  };
}

/**
 * Updates sticky scroll state with new lines.
 */
export function updateStickyScrollState(
  state: StickyScrollState,
  lines: StickyScrollLine[]
): StickyScrollState {
  return {
    ...state,
    lines: lines.slice(0, state.maxLineCount),
  };
}

/**
 * Applies Monaco's native stickyScroll editor option.
 * This ensures the editor's built-in sticky scroll is properly configured
 * in addition to our custom widget.
 */
export function applyMonacoStickyScrollOptions(
  editor: Monaco.editor.IStandaloneCodeEditor | null,
  options: {
    enabled?: boolean;
    maxLineCount?: number;
    defaultModel?: "outlineModel" | "foldingProviderModel" | "indentationModel";
    scrollWithEditor?: boolean;
  }
): void {
  if (!editor) return;

  editor.updateOptions({
    stickyScroll: {
      enabled: options.enabled ?? true,
      maxLineCount: options.maxLineCount ?? 5,
      defaultModel: options.defaultModel ?? "outlineModel",
      scrollWithEditor: options.scrollWithEditor ?? true,
    },
  });
}

// ============================================================================
// Exports
// ============================================================================

export default StickyScrollWidget;

// Export types for external use
export type { StickyScrollLine, StickyScrollState };
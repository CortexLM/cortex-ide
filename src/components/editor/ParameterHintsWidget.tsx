/**
 * Parameter Hints Widget (Signature Help)
 *
 * Displays function signature help with parameter highlighting.
 * Features:
 * - Shows function signature with all parameters
 * - Highlights the currently active parameter
 * - Navigation between multiple overloaded signatures (arrows up/down)
 * - Markdown documentation support
 * - Smart positioning (above or below cursor)
 * - Dismiss with Escape
 * - Triggers on '(' and ','
 * - Consistent theming with Ayu Dark style
 */

import { createSignal, createEffect, onMount, onCleanup, Show, createMemo } from "solid-js";
import type { SignatureHelp, Position } from "@/context/LSPContext";
import type * as Monaco from "monaco-editor";
import { SafeHTML } from "../ui/SafeHTML";

// ============================================================================
// Types
// ============================================================================

export interface ParameterHintsWidgetProps {
  /** Monaco editor instance */
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  /** Monaco namespace for types */
  monaco: typeof Monaco | null;
  /** Signature help state from LSP */
  signatureHelp: SignatureHelp | null;
  /** Callback to close the widget */
  onClose?: () => void;
  /** Callback to request signature help */
  onRequestSignatureHelp?: (position: Position, triggerCharacter?: string, isRetrigger?: boolean) => void;
}

export interface ParameterHintsPosition {
  x: number;
  y: number;
  above: boolean;
}

// ============================================================================
// Markdown Utilities
// ============================================================================

/**
 * Simple markdown to HTML converter for documentation.
 * Handles basic markdown syntax: bold, italic, code, links.
 */
function parseMarkdown(text: string): string {
  if (!text) return "";
  
  // Escape HTML first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Code blocks (triple backticks)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre class="param-hints-code-block"><code>${code.trim()}</code></pre>`;
  });
  
  // Inline code (single backticks)
  html = html.replace(/`([^`]+)`/g, '<code class="param-hints-inline-code">$1</code>');
  
  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  
  // Italic (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // Line breaks
  html = html.replace(/\n/g, "<br>");
  
  return html;
}

/**
 * Extracts the documentation text from a signature or parameter.
 * LSP can return documentation as string or MarkupContent.
 */
function extractDocumentation(doc: string | { kind: string; value: string } | undefined): string {
  if (!doc) return "";
  if (typeof doc === "string") return doc;
  return doc.value || "";
}

// ============================================================================
// Component
// ============================================================================

export function ParameterHintsWidget(props: ParameterHintsWidgetProps) {
  // State
  const [visible, setVisible] = createSignal(false);
  const [position, setPosition] = createSignal<ParameterHintsPosition>({ x: 0, y: 0, above: false });
  const [activeSignatureIndex, setActiveSignatureIndex] = createSignal(0);
  const [activeParameterIndex, setActiveParameterIndex] = createSignal(0);
  const [expanded, setExpanded] = createSignal(false);

  // Refs
  let containerRef: HTMLDivElement | undefined;

  // Computed: Current signatures from props
  const signatures = createMemo(() => {
    const help = props.signatureHelp;
    if (!help || !help.signatures || help.signatures.length === 0) return [];
    return help.signatures;
  });

  // Computed: Current active signature
  const activeSignature = createMemo(() => {
    const sigs = signatures();
    const idx = activeSignatureIndex();
    if (sigs.length === 0) return null;
    return sigs[Math.min(idx, sigs.length - 1)] || null;
  });

  // Computed: Active parameter for the current signature
  const activeParameter = createMemo(() => {
    const sig = activeSignature();
    if (!sig || !sig.parameters) return null;
    
    // Use signature's activeParameter if available, otherwise use state
    const paramIdx = sig.activeParameter ?? activeParameterIndex();
    return sig.parameters[paramIdx] || null;
  });

  // Computed: Rendered signature label with highlighted parameter
  const renderedSignature = createMemo(() => {
    const sig = activeSignature();
    if (!sig) return { before: "", highlighted: "", after: "" };
    
    const label = sig.label;
    const params = sig.parameters || [];
    const paramIdx = sig.activeParameter ?? activeParameterIndex();
    
    if (params.length === 0 || paramIdx < 0 || paramIdx >= params.length) {
      return { before: label, highlighted: "", after: "" };
    }
    
    const activeParam = params[paramIdx];
    const paramLabel = activeParam.label;
    
    // Find the parameter in the signature label
    const paramStart = label.indexOf(paramLabel);
    if (paramStart === -1) {
      // Parameter not found in label, return whole label
      return { before: label, highlighted: "", after: "" };
    }
    
    const paramEnd = paramStart + paramLabel.length;
    
    return {
      before: label.substring(0, paramStart),
      highlighted: label.substring(paramStart, paramEnd),
      after: label.substring(paramEnd),
    };
  });

  // Update visibility and indices when signatureHelp changes
  createEffect(() => {
    const help = props.signatureHelp;
    
    if (!help || !help.signatures || help.signatures.length === 0) {
      setVisible(false);
      return;
    }
    
    setVisible(true);
    setActiveSignatureIndex(help.activeSignature ?? 0);
    setActiveParameterIndex(help.activeParameter ?? 0);
    
    // Update position
    updatePosition();
  });

  // Calculate position based on cursor location
  const updatePosition = () => {
    const editor = props.editor;
    const monaco = props.monaco;
    
    if (!editor || !monaco || !containerRef) return;
    
    const cursorPosition = editor.getPosition();
    if (!cursorPosition) return;
    
    // Get cursor pixel coordinates
    const coordinates = editor.getScrolledVisiblePosition(cursorPosition);
    if (!coordinates) return;
    
    // Get editor container rect for absolute positioning
    const editorDomNode = editor.getDomNode();
    if (!editorDomNode) return;
    
    const editorRect = editorDomNode.getBoundingClientRect();
    
    // Calculate widget dimensions
    const widgetHeight = containerRef.offsetHeight || 150;
    const widgetWidth = containerRef.offsetWidth || 400;
    
    // Calculate position
    let x = editorRect.left + coordinates.left;
    let y: number;
    let above = false;
    
    // Determine if we should show above or below cursor
    const spaceBelow = window.innerHeight - (editorRect.top + coordinates.top + coordinates.height);
    const spaceAbove = editorRect.top + coordinates.top;
    
    if (spaceBelow < widgetHeight && spaceAbove > widgetHeight) {
      // Show above cursor
      y = editorRect.top + coordinates.top - widgetHeight - 4;
      above = true;
    } else {
      // Show below cursor
      y = editorRect.top + coordinates.top + coordinates.height + 4;
      above = false;
    }
    
    // Ensure widget stays within viewport horizontally
    if (x + widgetWidth > window.innerWidth - 10) {
      x = window.innerWidth - widgetWidth - 10;
    }
    if (x < 10) {
      x = 10;
    }
    
    // Ensure widget stays within viewport vertically
    if (y < 10) {
      y = 10;
    }
    if (y + widgetHeight > window.innerHeight - 10) {
      y = window.innerHeight - widgetHeight - 10;
    }
    
    setPosition({ x, y, above });
  };

  // Navigate to previous signature (up arrow or scroll)
  const prevSignature = () => {
    const sigs = signatures();
    if (sigs.length <= 1) return;
    
    setActiveSignatureIndex((prev) => {
      if (prev === 0) return sigs.length - 1;
      return prev - 1;
    });
  };

  // Navigate to next signature (down arrow or scroll)
  const nextSignature = () => {
    const sigs = signatures();
    if (sigs.length <= 1) return;
    
    setActiveSignatureIndex((prev) => {
      if (prev >= sigs.length - 1) return 0;
      return prev + 1;
    });
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!visible()) return;
    
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        setVisible(false);
        props.onClose?.();
        break;
      
      case "ArrowUp":
        if (signatures().length > 1) {
          e.preventDefault();
          e.stopPropagation();
          prevSignature();
        }
        break;
      
      case "ArrowDown":
        if (signatures().length > 1) {
          e.preventDefault();
          e.stopPropagation();
          nextSignature();
        }
        break;
    }
  };

  // Handle mouse wheel for signature navigation
  const handleWheel = (e: WheelEvent) => {
    if (!visible() || signatures().length <= 1) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (e.deltaY < 0) {
      prevSignature();
    } else {
      nextSignature();
    }
  };

  // Setup event listeners
  onMount(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    
    // Update position on window resize
    window.addEventListener("resize", updatePosition);
    
    // Update position on scroll
    const editor = props.editor;
    if (editor) {
      const scrollDisposable = editor.onDidScrollChange(updatePosition);
      onCleanup(() => scrollDisposable.dispose());
    }
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("resize", updatePosition);
  });

  // Re-calculate position when container is mounted
  createEffect(() => {
    if (visible() && containerRef) {
      // Use RAF to ensure the container has rendered
      requestAnimationFrame(updatePosition);
    }
  });

  // Toggle expanded documentation view
  const toggleExpanded = () => {
    setExpanded((prev) => !prev);
    // Re-calculate position after expansion
    requestAnimationFrame(updatePosition);
  };

  // Get documentation for display
  const signatureDoc = createMemo(() => {
    const sig = activeSignature();
    if (!sig) return "";
    return extractDocumentation(sig.documentation as string | { kind: string; value: string } | undefined);
  });

  const parameterDoc = createMemo(() => {
    const param = activeParameter();
    if (!param) return "";
    return extractDocumentation(param.documentation as string | { kind: string; value: string } | undefined);
  });

  return (
    <Show when={visible() && signatures().length > 0}>
      <div
        ref={containerRef}
        class="param-hints-widget"
        classList={{
          "param-hints-above": position().above,
          "param-hints-expanded": expanded(),
        }}
        style={{
          position: "fixed",
          left: `${position().x}px`,
          top: `${position().y}px`,
          "z-index": 10000,
        }}
        onWheel={handleWheel}
      >
        {/* Signature Navigation (multiple overloads) */}
        <Show when={signatures().length > 1}>
          <div class="param-hints-navigation">
            <button
              class="param-hints-nav-btn"
              onClick={prevSignature}
              title="Previous signature (Up arrow)"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M8 4l4 4H4l4-4z" />
              </svg>
            </button>
            <span class="param-hints-nav-counter">
              {activeSignatureIndex() + 1} / {signatures().length}
            </span>
            <button
              class="param-hints-nav-btn"
              onClick={nextSignature}
              title="Next signature (Down arrow)"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M8 12l4-4H4l4 4z" />
              </svg>
            </button>
          </div>
        </Show>

        {/* Signature Label */}
        <div class="param-hints-signature">
          <code class="param-hints-signature-code">
            <span class="param-hints-signature-before">{renderedSignature().before}</span>
            <span class="param-hints-signature-highlighted">{renderedSignature().highlighted}</span>
            <span class="param-hints-signature-after">{renderedSignature().after}</span>
          </code>
        </div>

        {/* Parameter Documentation */}
        <Show when={parameterDoc() || signatureDoc()}>
          <div class="param-hints-docs">
            {/* Active Parameter Documentation */}
            <Show when={parameterDoc()}>
              <div class="param-hints-param-doc">
                <span class="param-hints-param-name">
                  {activeParameter()?.label}:
                </span>
                <SafeHTML
                  class="param-hints-param-description"
                  html={parseMarkdown(parameterDoc())}
                />
              </div>
            </Show>

            {/* Signature Documentation (collapsed by default) */}
            <Show when={signatureDoc()}>
              <div class="param-hints-signature-doc">
                <Show when={!expanded() && signatureDoc().length > 100}>
                  <button
                    class="param-hints-expand-btn"
                    onClick={toggleExpanded}
                    title="Show full documentation"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                      <path d="M4 6l4 4 4-4H4z" />
                    </svg>
                    More
                  </button>
                </Show>
                <Show when={expanded() || signatureDoc().length <= 100}>
                  <SafeHTML
                    class="param-hints-full-doc"
                    html={parseMarkdown(signatureDoc())}
                  />
                  <Show when={expanded()}>
                    <button
                      class="param-hints-expand-btn"
                      onClick={toggleExpanded}
                      title="Collapse documentation"
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                        <path d="M4 10l4-4 4 4H4z" />
                      </svg>
                      Less
                    </button>
                  </Show>
                </Show>
              </div>
            </Show>
          </div>
        </Show>

        {/* Hint for keyboard navigation */}
        <Show when={signatures().length > 1}>
          <div class="param-hints-footer">
            <span class="param-hints-hint">
              Use <kbd>Up</kbd>/<kbd>Down</kbd> to navigate overloads
            </span>
          </div>
        </Show>

        <style>{`
          .param-hints-widget {
            min-width: 300px;
            max-width: 600px;
            max-height: 400px;
            overflow: hidden;
            background: var(--vscode-editorSuggestWidget-background, var(--cortex-bg-primary));
            border: 1px solid var(--vscode-editorSuggestWidget-border, var(--cortex-bg-active));
            border-radius: var(--cortex-radius-sm);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.36);
            font-family: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
            font-size: 13px;
            color: var(--vscode-editorSuggestWidget-foreground, var(--cortex-text-secondary));
            animation: param-hints-fade-in 0.1s ease-out;
          }

          .param-hints-widget.param-hints-expanded {
            max-height: 500px;
          }

          @keyframes param-hints-fade-in {
            from {
              opacity: 0;
              transform: translateY(4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .param-hints-widget.param-hints-above {
            animation-name: param-hints-fade-in-above;
          }

          @keyframes param-hints-fade-in-above {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          /* Navigation */
          .param-hints-navigation {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 4px 8px;
            background: var(--vscode-editorSuggestWidget-selectedBackground, var(--cortex-bg-secondary));
            border-bottom: 1px solid var(--vscode-editorSuggestWidget-border, var(--cortex-bg-active));
          }

          .param-hints-nav-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            padding: 0;
            background: transparent;
            border: none;
            border-radius: var(--cortex-radius-sm);
            color: var(--vscode-foreground, var(--cortex-text-primary));
            cursor: pointer;
            opacity: 0.8;
          }

          .param-hints-nav-btn:hover {
            background: var(--vscode-list-hoverBackground, var(--cortex-bg-hover));
            opacity: 1;
          }

          .param-hints-nav-counter {
            font-size: 11px;
            color: var(--vscode-descriptionForeground, var(--cortex-text-inactive));
            min-width: 40px;
            text-align: center;
          }

          /* Signature */
          .param-hints-signature {
            padding: 8px 12px;
            overflow-x: auto;
            white-space: nowrap;
          }

          .param-hints-signature-code {
            font-family: var(--vscode-editor-font-family, 'JetBrains Mono', 'Fira Code', monospace);
            font-size: 13px;
            line-height: 1.5;
          }

          .param-hints-signature-before,
          .param-hints-signature-after {
            color: var(--vscode-foreground, var(--cortex-text-primary));
          }

          .param-hints-signature-highlighted {
            color: var(--vscode-editorSuggestWidget-highlightForeground, var(--cortex-info));
            font-weight: 600;
            background: rgba(24, 163, 255, 0.1);
            border-radius: var(--cortex-radius-sm);
            padding: 0 2px;
          }

          /* Documentation */
          .param-hints-docs {
            padding: 8px 12px;
            border-top: 1px solid var(--vscode-editorSuggestWidget-border, var(--cortex-bg-active));
            max-height: 200px;
            overflow-y: auto;
          }

          .param-hints-expanded .param-hints-docs {
            max-height: 350px;
          }

          .param-hints-param-doc {
            margin-bottom: 8px;
          }

          .param-hints-param-name {
            color: var(--vscode-symbolIcon-parameterForeground, var(--cortex-info));
            font-family: var(--vscode-editor-font-family, monospace);
            font-weight: 600;
            margin-right: 8px;
          }

          .param-hints-param-description {
            color: var(--vscode-foreground, var(--cortex-text-primary));
            line-height: 1.4;
          }

          .param-hints-signature-doc {
            color: var(--vscode-descriptionForeground, var(--cortex-text-inactive));
            font-size: 12px;
            line-height: 1.5;
          }

          .param-hints-full-doc {
            margin-bottom: 4px;
          }

          .param-hints-expand-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 6px;
            background: transparent;
            border: 1px solid var(--vscode-button-secondaryBackground, var(--cortex-bg-hover));
            border-radius: var(--cortex-radius-sm);
            color: var(--vscode-textLink-foreground, var(--cortex-info));
            font-size: 11px;
            cursor: pointer;
          }

          .param-hints-expand-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground, var(--cortex-bg-active));
          }

          /* Code blocks in documentation */
          .param-hints-code-block {
            background: var(--vscode-textCodeBlock-background, var(--cortex-bg-primary));
            border-radius: var(--cortex-radius-sm);
            padding: 8px 12px;
            margin: 8px 0;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
          }

          .param-hints-inline-code {
            background: var(--vscode-textCodeBlock-background, var(--cortex-bg-primary));
            border-radius: var(--cortex-radius-sm);
            padding: 1px 4px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
          }

          /* Links in documentation */
          .param-hints-docs a {
            color: var(--vscode-textLink-foreground, var(--cortex-info));
            text-decoration: none;
          }

          .param-hints-docs a:hover {
            text-decoration: underline;
          }

          /* Footer hint */
          .param-hints-footer {
            padding: 4px 12px;
            border-top: 1px solid var(--vscode-editorSuggestWidget-border, var(--cortex-bg-active));
            background: var(--vscode-editorSuggestWidget-background, var(--cortex-bg-primary));
          }

          .param-hints-hint {
            font-size: 11px;
            color: var(--vscode-descriptionForeground, var(--cortex-text-inactive));
          }

          .param-hints-hint kbd {
            display: inline-block;
            padding: 1px 4px;
            background: var(--vscode-keybindingLabel-background, var(--cortex-bg-hover));
            border: 1px solid var(--vscode-keybindingLabel-border, var(--cortex-bg-active));
            border-radius: var(--cortex-radius-sm);
            font-family: var(--vscode-font-family, system-ui);
            font-size: 10px;
            color: var(--vscode-keybindingLabel-foreground, var(--cortex-text-primary));
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
          }

          /* Scrollbar styling */
          .param-hints-docs::-webkit-scrollbar {
            width: 8px;
          }

          .param-hints-docs::-webkit-scrollbar-track {
            background: transparent;
          }

          .param-hints-docs::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
            border-radius: var(--cortex-radius-sm);
          }

          .param-hints-docs::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground, rgba(100, 100, 100, 0.7));
          }

          .param-hints-signature::-webkit-scrollbar {
            height: 6px;
          }

          .param-hints-signature::-webkit-scrollbar-track {
            background: transparent;
          }

          .param-hints-signature::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
            border-radius: var(--cortex-radius-sm);
          }
        `}</style>
      </div>
    </Show>
  );
}

// ============================================================================
// Controller Functions
// ============================================================================

/** Global state for parameter hints visibility */
let parameterHintsState: {
  visible: boolean;
  signatureHelp: SignatureHelp | null;
  onClose?: () => void;
} = {
  visible: false,
  signatureHelp: null,
};

/** Subscribers for state changes */
const subscribers: Set<() => void> = new Set();

/** Subscribe to parameter hints state changes */
export function subscribeToParameterHints(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/** Notify all subscribers of state change */
function notifySubscribers() {
  subscribers.forEach((cb) => cb());
}

/** Show parameter hints widget with signature help data */
export function showParameterHints(signatureHelp: SignatureHelp): void {
  parameterHintsState = {
    visible: true,
    signatureHelp,
  };
  notifySubscribers();
}

/** Hide parameter hints widget */
export function hideParameterHints(): void {
  parameterHintsState = {
    visible: false,
    signatureHelp: null,
  };
  notifySubscribers();
}

/** Update parameter hints with new active parameter */
export function updateParameterHints(activeParameter: number): void {
  if (parameterHintsState.signatureHelp) {
    parameterHintsState = {
      ...parameterHintsState,
      signatureHelp: {
        ...parameterHintsState.signatureHelp,
        activeParameter,
      },
    };
    notifySubscribers();
  }
}

/** Get current parameter hints state */
export function getParameterHintsState(): typeof parameterHintsState {
  return parameterHintsState;
}

// ============================================================================
// Trigger Character Detection
// ============================================================================

/** Characters that trigger signature help */
export const SIGNATURE_TRIGGER_CHARACTERS = ["(", ","];

/** Characters that close signature help */
export const SIGNATURE_CLOSE_CHARACTERS = [")", ";"];

/**
 * Check if a character should trigger signature help request
 */
export function shouldTriggerSignatureHelp(char: string): boolean {
  return SIGNATURE_TRIGGER_CHARACTERS.includes(char);
}

/**
 * Check if a character should close signature help
 */
export function shouldCloseSignatureHelp(char: string): boolean {
  return SIGNATURE_CLOSE_CHARACTERS.includes(char);
}

// ============================================================================
// Integration Hook
// ============================================================================

/**
 * Hook to integrate parameter hints with Monaco editor.
 * Sets up key listeners and triggers signature help on '(' and ','.
 */
export function useParameterHints(
  editor: Monaco.editor.IStandaloneCodeEditor | null,
  monaco: typeof Monaco | null,
  getSignatureHelp: (position: Position, triggerCharacter?: string, isRetrigger?: boolean) => Promise<SignatureHelp | null>
) {
  const [signatureHelp, setSignatureHelp] = createSignal<SignatureHelp | null>(null);
  
  let lastTriggerPosition: { line: number; column: number } | null = null;
  let isActive = false;
  
  createEffect(() => {
    if (!editor || !monaco) return;
    
    // Listen for content changes to detect trigger characters
    const contentChangeDisposable = editor.onDidChangeModelContent(async (e) => {
      if (!editor) return;
      
      for (const change of e.changes) {
        const text = change.text;
        const position = editor.getPosition();
        
        if (!position) continue;
        
        // Check for trigger characters
        if (text.length === 1) {
          if (shouldTriggerSignatureHelp(text)) {
            // Request signature help
            const lspPosition: Position = {
              line: position.lineNumber - 1,
              character: position.column - 1,
            };
            
            try {
              const help = await getSignatureHelp(lspPosition, text, isActive);
              if (help && help.signatures && help.signatures.length > 0) {
                setSignatureHelp(help);
                lastTriggerPosition = { line: position.lineNumber, column: position.column };
                isActive = true;
              }
            } catch (err) {
              console.debug("Signature help request failed:", err);
            }
          } else if (shouldCloseSignatureHelp(text)) {
            // Close signature help
            setSignatureHelp(null);
            lastTriggerPosition = null;
            isActive = false;
          }
        }
      }
    });
    
    // Listen for cursor position changes to update active parameter
    const cursorChangeDisposable = editor.onDidChangeCursorPosition(async (e) => {
      if (!isActive || !lastTriggerPosition) return;
      
      const position = e.position;
      
      // Check if cursor moved before the trigger position (should close hints)
      if (
        position.lineNumber < lastTriggerPosition.line ||
        (position.lineNumber === lastTriggerPosition.line && position.column < lastTriggerPosition.column)
      ) {
        setSignatureHelp(null);
        lastTriggerPosition = null;
        isActive = false;
        return;
      }
      
      // Request updated signature help for parameter tracking
      const lspPosition: Position = {
        line: position.lineNumber - 1,
        character: position.column - 1,
      };
      
      try {
        const help = await getSignatureHelp(lspPosition, undefined, true);
        if (help && help.signatures && help.signatures.length > 0) {
          setSignatureHelp(help);
        } else {
          // No more signature help available
          setSignatureHelp(null);
          lastTriggerPosition = null;
          isActive = false;
        }
      } catch {
        // Silently ignore errors on retrigger
      }
    });
    
    // Cleanup
    onCleanup(() => {
      contentChangeDisposable.dispose();
      cursorChangeDisposable.dispose();
    });
  });
  
  // Handler to close the widget
  const handleClose = () => {
    setSignatureHelp(null);
    lastTriggerPosition = null;
    isActive = false;
  };
  
  return {
    signatureHelp,
    onClose: handleClose,
  };
}

export default ParameterHintsWidget;


import { Show, createSignal, createResource, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { SafeHTML } from "../ui/SafeHTML";
import { highlightCode, normalizeLanguage } from "@/utils/shikiHighlighter";

// ============================================================================
// Types
// ============================================================================

export interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
}

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Component
// ============================================================================

export function CodeBlock(props: CodeBlockProps) {
  const [copied, setCopied] = createSignal(false);
  const [hovered, setHovered] = createSignal(false);
  let copyTimeoutId: number | undefined;
  
  const language = createMemo(() => normalizeLanguage(props.language));
  const displayLanguage = createMemo(() => props.language || "code");
  
  const [highlightedCode] = createResource(
    () => ({ code: props.code, lang: language() }),
    async ({ code, lang }) => {
      try {
        return await highlightCode(code, lang);
      } catch {
        // Fallback to plain escaped code
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }
    }
  );
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      
      if (copyTimeoutId) {
        window.clearTimeout(copyTimeoutId);
      }
      
      copyTimeoutId = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = props.code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      
      copyTimeoutId = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };
  
  // Cleanup timeout on unmount handled by signal
  
  const containerStyle = createMemo(() => {
    const styles: Record<string, string> = {
      position: "relative",
      margin: "8px 0",
      "border-radius": "var(--cortex-radius-sm)",
      overflow: "hidden",
      background: "var(--vscode-interactive-result-editor-background-color)",
      border: "1px solid var(--vscode-input-border, transparent)",
    };
    if (props.maxHeight) {
      styles["max-height"] = props.maxHeight;
      styles["overflow-y"] = "auto";
    }
    return styles;
  });

  return (
    <div 
      class="interactive-result-code-block code-block" 
      style={containerStyle()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* VS Code floating toolbar - appears on hover */}
      <div 
        class="interactive-result-code-block-toolbar code-block-toolbar"
        style={{
          opacity: hovered() ? "1" : "0",
          "pointer-events": hovered() ? "auto" : "none",
          position: "absolute",
          top: "-15px",
          right: "10px",
          height: "26px",
          "line-height": "26px",
          background: "var(--vscode-interactive-result-editor-background-color, var(--vscode-editor-background))",
          border: "1px solid var(--vscode-chat-requestBorder)",
          "border-radius": "var(--cortex-radius-sm)",
          "z-index": "100",
          display: "flex",
          "align-items": "center",
          padding: "0 4px",
          transition: "opacity 0.15s ease",
        }}
      >
        <span 
          style={{ 
            "font-size": "var(--vscode-chat-font-size-body-xs)", 
            color: "var(--vscode-descriptionForeground)",
            "margin-right": "8px",
            "font-family": "var(--monaco-monospace-font, monospace)",
          }}
        >
          {displayLanguage()}
        </span>
        <button
          type="button"
          class="code-block-copy-btn"
          onClick={handleCopy}
          title={copied() ? "Copied!" : "Copy code"}
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: "24px",
            height: "24px",
            padding: "0",
            background: "transparent",
            border: "none",
            color: copied() ? "var(--vscode-chat-linesAddedForeground)" : "var(--vscode-descriptionForeground)",
            cursor: "pointer",
            "border-radius": "var(--cortex-radius-sm)",
          }}
        >
          <Show when={copied()} fallback={<Icon name="copy" class="w-3.5 h-3.5" />}>
            <Icon name="check" class="w-3.5 h-3.5" />
          </Show>
        </button>
      </div>

      {/* Code block header - VS Code style */}
      <div 
        class="code-block-header"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          height: "28px",
          padding: "0 8px",
          background: "rgba(0, 0, 0, 0.2)",
          "border-bottom": "1px solid var(--vscode-chat-requestBorder)",
        }}
      >
        <span 
          class="code-block-language"
          style={{
            "font-size": "var(--vscode-chat-font-size-body-xs)",
            color: "var(--vscode-descriptionForeground)",
            "font-family": "var(--monaco-monospace-font, monospace)",
            "text-transform": "lowercase",
          }}
        >
          {displayLanguage()}
        </span>
      </div>

      {/* Code content - VS Code style */}
      <div
        class="code-block-content"
        classList={{
          "code-block-line-numbers": props.showLineNumbers,
        }}
        style={{
          padding: "12px 16px",
          "overflow-x": "auto",
          "font-family": "var(--monaco-monospace-font, 'Consolas', 'Courier New', monospace)",
          "font-size": "var(--vscode-chat-font-size-body-s)",
          "line-height": "1.5",
        }}
      >
        <Show
          when={!highlightedCode.loading && highlightedCode()}
          fallback={
            <pre class="code-block-pre" style={{ margin: "0" }}>
              <code class="code-block-code">{props.code}</code>
            </pre>
          }
        >
          <SafeHTML
            class="code-block-highlighted"
            html={highlightedCode()!}
          />
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Inline Code Component (for inline `code` in markdown)
// ============================================================================

export interface InlineCodeProps {
  children: string;
}

export function InlineCode(props: InlineCodeProps) {
  return <code class="inline-code">{props.children}</code>;
}

export default CodeBlock;


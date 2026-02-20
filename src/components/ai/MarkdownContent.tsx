import { marked, type Token, type Tokens } from "marked";
import { createMemo, For, Switch, Match } from "solid-js";
import { CodeBlock } from "./CodeBlock";
import { SafeHTML } from "../ui/SafeHTML";

// ============================================================================
// Types
// ============================================================================

export interface MarkdownContentProps {
  content: string;
  class?: string;
}

interface ContentSegment {
  type: "code" | "html";
  content: string;
  language?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Markdown Processing
// ============================================================================

/**
 * Processes marked tokens and separates code blocks from other content.
 * Code blocks are rendered with syntax highlighting via CodeBlock component,
 * while other content is rendered as HTML.
 */
function processTokens(tokens: Token[]): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let htmlBuffer = "";

  for (const token of tokens) {
    if (token.type === "code") {
      const codeToken = token as Tokens.Code;
      
      // Flush HTML buffer before adding code segment
      if (htmlBuffer.trim()) {
        segments.push({ type: "html", content: htmlBuffer });
        htmlBuffer = "";
      }
      
      segments.push({
        type: "code",
        content: codeToken.text,
        language: codeToken.lang || "plaintext",
      });
    } else {
      // Convert token to HTML and add to buffer
      try {
        const html = marked.parser([token]);
        htmlBuffer += typeof html === "string" ? html : "";
      } catch {
        // Fallback for parsing errors
        if ("raw" in token && typeof token.raw === "string") {
          htmlBuffer += escapeHtml(token.raw);
        }
      }
    }
  }

  // Flush remaining HTML buffer
  if (htmlBuffer.trim()) {
    segments.push({ type: "html", content: htmlBuffer });
  }

  return segments;
}

/**
 * Configures marked options for consistent rendering.
 */
function configureMarked(): void {
  marked.setOptions({
    gfm: true,      // GitHub Flavored Markdown
    breaks: true,   // Convert \n to <br>
  });
}

// Configure marked on module load
configureMarked();

// ============================================================================
// MarkdownContent Component
// ============================================================================

/**
 * Renders markdown content with special handling for code blocks.
 * Code blocks are rendered using the CodeBlock component with syntax highlighting.
 * Other markdown content is rendered as HTML using the marked library.
 */
export function MarkdownContent(props: MarkdownContentProps) {
  const parsed = createMemo(() => {
    const content = props.content;
    
    if (!content || !content.trim()) {
      return [];
    }
    
    try {
      const tokens = marked.lexer(content);
      return processTokens(tokens);
    } catch {
      // Fallback: render as escaped HTML paragraph
      return [{ type: "html" as const, content: `<p>${escapeHtml(content)}</p>` }];
    }
  });

  return (
    <div class={`markdown-content ${props.class || ""}`}>
      <For each={parsed()}>
        {(segment) => (
          <Switch>
            <Match when={segment.type === "code"}>
              <CodeBlock
                code={segment.content}
                language={segment.language || "plaintext"}
              />
            </Match>
<Match when={segment.type === "html"}>
              <SafeHTML html={segment.content} />
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
}

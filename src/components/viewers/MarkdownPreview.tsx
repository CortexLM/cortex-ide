import {
  Show,
  For,
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
} from "solid-js";
import { marked, type Token, type Tokens } from "marked";
import { Icon } from "../ui/Icon";
import { SafeHTML } from "../../components/ui/SafeHTML";
import { highlightCode, isLanguageSupported } from "@/utils/shikiHighlighter";

// ============================================================================
// Types
// ============================================================================

export interface MarkdownPreviewProps {
  content: string;
  filePath?: string;
  onContentChange?: (content: string) => void;
  onClose?: () => void;
  readOnly?: boolean;
  initialViewMode?: ViewMode;
}

export type ViewMode = "preview" | "editor" | "split";

interface TocItem {
  id: string;
  text: string;
  level: number;
  children: TocItem[];
}

interface ParsedContent {
  html: string;
  toc: TocItem[];
}

// ============================================================================
// Constants
// ============================================================================

const MERMAID_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
const KATEX_CSS_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
const KATEX_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
const KATEX_AUTO_RENDER_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js";

// ============================================================================
// Utility Functions
// ============================================================================

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function extractTextFromTokens(tokens: Token[]): string {
  let text = "";
  for (const token of tokens) {
    if ("text" in token && typeof token.text === "string") {
      text += token.text;
    }
    if ("tokens" in token && Array.isArray(token.tokens)) {
      text += extractTextFromTokens(token.tokens);
    }
  }
  return text;
}

function buildToc(tokens: Token[]): TocItem[] {
  const toc: TocItem[] = [];
  const stack: { item: TocItem; level: number }[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      const headingToken = token as Tokens.Heading;
      const text = extractTextFromTokens(headingToken.tokens);
      const id = generateSlug(text);
      const item: TocItem = {
        id,
        text,
        level: headingToken.depth,
        children: [],
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= headingToken.depth) {
        stack.pop();
      }

      if (stack.length === 0) {
        toc.push(item);
      } else {
        stack[stack.length - 1].item.children.push(item);
      }

      stack.push({ item, level: headingToken.depth });
    }
  }

  return toc;
}

async function loadExternalScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function loadExternalStylesheet(href: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => resolve(); // Don't fail on style load errors
    document.head.appendChild(link);
  });
}

// ============================================================================
// Markdown Renderer
// ============================================================================

class MarkdownRenderer {
  private mermaidInitialized = false;
  private katexInitialized = false;
  private headingCounter: Map<string, number> = new Map();

  async initialize(): Promise<void> {
    // No initialization needed - highlighter is lazily loaded
  }

  async initializeMermaid(): Promise<void> {
    if (this.mermaidInitialized) return;
    try {
      await loadExternalScript(MERMAID_SCRIPT_URL);
      const mermaid = (window as unknown as { mermaid?: { initialize: (config: object) => void } }).mermaid;
      if (mermaid) {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          fontFamily: "Inter, sans-serif",
        });
        this.mermaidInitialized = true;
      }
    } catch (error) {
      console.warn("Failed to initialize Mermaid:", error);
    }
  }

  async initializeKatex(): Promise<void> {
    if (this.katexInitialized) return;
    try {
      await loadExternalStylesheet(KATEX_CSS_URL);
      await loadExternalScript(KATEX_SCRIPT_URL);
      await loadExternalScript(KATEX_AUTO_RENDER_URL);
      this.katexInitialized = true;
    } catch (error) {
      console.warn("Failed to initialize KaTeX:", error);
    }
  }

  private getUniqueHeadingId(baseId: string): string {
    const count = this.headingCounter.get(baseId) || 0;
    this.headingCounter.set(baseId, count + 1);
    return count === 0 ? baseId : `${baseId}-${count}`;
  }

  async parse(markdown: string): Promise<ParsedContent> {
    this.headingCounter.clear();
    const tokens = marked.lexer(markdown);
    const toc = buildToc(tokens);
    const html = await this.renderTokens(tokens);
    return { html, toc };
  }

  private async renderTokens(tokens: Token[]): Promise<string> {
    const parts: string[] = [];
    for (const token of tokens) {
      parts.push(await this.renderToken(token));
    }
    return parts.join("");
  }

  private async renderToken(token: Token): Promise<string> {
    switch (token.type) {
      case "heading": {
        const headingToken = token as Tokens.Heading;
        const text = extractTextFromTokens(headingToken.tokens);
        const baseId = generateSlug(text);
        const id = this.getUniqueHeadingId(baseId);
        const innerHtml = await this.renderInlineTokens(headingToken.tokens);
        return `<h${headingToken.depth} id="${id}" class="md-heading md-h${headingToken.depth}">
          <a href="#${id}" class="md-heading-anchor" aria-hidden="true">#</a>
          ${innerHtml}
        </h${headingToken.depth}>`;
      }

      case "paragraph": {
        const paragraphToken = token as Tokens.Paragraph;
        const innerHtml = await this.renderInlineTokens(paragraphToken.tokens);
        return `<p class="md-paragraph">${innerHtml}</p>`;
      }

      case "text": {
        const textToken = token as Tokens.Text;
        if ("tokens" in textToken && textToken.tokens) {
          return await this.renderInlineTokens(textToken.tokens);
        }
        return escapeHtml(textToken.text);
      }

      case "code": {
        const codeToken = token as Tokens.Code;
        return await this.renderCodeBlock(codeToken.text, codeToken.lang);
      }

      case "blockquote": {
        const blockquoteToken = token as Tokens.Blockquote;
        const innerHtml = await this.renderTokens(blockquoteToken.tokens);
        return `<blockquote class="md-blockquote">${innerHtml}</blockquote>`;
      }

      case "list": {
        const listToken = token as Tokens.List;
        const tag = listToken.ordered ? "ol" : "ul";
        const startAttr = listToken.ordered && listToken.start !== 1 ? ` start="${listToken.start}"` : "";
        const items: string[] = [];
        for (const item of listToken.items) {
          items.push(await this.renderListItem(item, listToken.ordered));
        }
        return `<${tag} class="md-list md-list-${listToken.ordered ? "ordered" : "unordered"}"${startAttr}>${items.join("")}</${tag}>`;
      }

      case "table": {
        const tableToken = token as Tokens.Table;
        return await this.renderTable(tableToken);
      }

      case "hr":
        return '<hr class="md-hr" />';

      case "html": {
        const htmlToken = token as Tokens.HTML;
        return htmlToken.raw;
      }

      case "space":
        return "";

      default:
        if ("raw" in token) {
          return escapeHtml((token as { raw: string }).raw);
        }
        return "";
    }
  }

  private async renderInlineTokens(tokens: Token[]): Promise<string> {
    const parts: string[] = [];
    for (const token of tokens) {
      parts.push(await this.renderInlineToken(token));
    }
    return parts.join("");
  }

  private async renderInlineToken(token: Token): Promise<string> {
    switch (token.type) {
      case "text": {
        const textToken = token as Tokens.Text;
        return escapeHtml(textToken.text);
      }

      case "strong": {
        const strongToken = token as Tokens.Strong;
        const innerHtml = await this.renderInlineTokens(strongToken.tokens);
        return `<strong class="md-strong">${innerHtml}</strong>`;
      }

      case "em": {
        const emToken = token as Tokens.Em;
        const innerHtml = await this.renderInlineTokens(emToken.tokens);
        return `<em class="md-em">${innerHtml}</em>`;
      }

      case "del": {
        const delToken = token as Tokens.Del;
        const innerHtml = await this.renderInlineTokens(delToken.tokens);
        return `<del class="md-del">${innerHtml}</del>`;
      }

      case "codespan": {
        const codespanToken = token as Tokens.Codespan;
        return `<code class="md-code-inline">${escapeHtml(codespanToken.text)}</code>`;
      }

      case "link": {
        const linkToken = token as Tokens.Link;
        const innerHtml = await this.renderInlineTokens(linkToken.tokens);
        const titleAttr = linkToken.title ? ` title="${escapeHtml(linkToken.title)}"` : "";
        return `<a href="${escapeHtml(linkToken.href)}" class="md-link"${titleAttr} target="_blank" rel="noopener noreferrer">${innerHtml}</a>`;
      }

      case "image": {
        const imageToken = token as Tokens.Image;
        const titleAttr = imageToken.title ? ` title="${escapeHtml(imageToken.title)}"` : "";
        return `<img src="${escapeHtml(imageToken.href)}" alt="${escapeHtml(imageToken.text)}" class="md-image"${titleAttr} loading="lazy" />`;
      }

      case "br":
        return "<br />";

      case "escape": {
        const escapeToken = token as Tokens.Escape;
        return escapeHtml(escapeToken.text);
      }

      default:
        if ("raw" in token) {
          return escapeHtml((token as { raw: string }).raw);
        }
        return "";
    }
  }

  private async renderCodeBlock(code: string, lang?: string): Promise<string> {
    const language = lang?.toLowerCase() || "";

    // Handle Mermaid diagrams
    if (language === "mermaid") {
      await this.initializeMermaid();
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return `<div class="md-mermaid" data-mermaid-id="${id}"><pre class="mermaid">${escapeHtml(code)}</pre></div>`;
    }

    // Handle math blocks
    if (language === "math" || language === "latex" || language === "tex") {
      await this.initializeKatex();
      return `<div class="md-math-block" data-math="${escapeHtml(code)}">${escapeHtml(code)}</div>`;
    }

    // Syntax highlighting with shared Shiki utility
    try {
      const validLang = isLanguageSupported(language) ? language : "plaintext";
      const highlighted = await highlightCode(code, validLang);
      return `<div class="md-code-block" data-language="${escapeHtml(language || "text")}">${highlighted}</div>`;
    } catch {
      // Fallback to plain code block
    }

    return `<div class="md-code-block" data-language="${escapeHtml(language || "text")}">
      <pre><code>${escapeHtml(code)}</code></pre>
    </div>`;
  }

  private async renderListItem(item: Tokens.ListItem, _ordered: boolean): Promise<string> {
    const checkbox = item.task
      ? `<input type="checkbox" class="md-task-checkbox" ${item.checked ? "checked" : ""} disabled />`
      : "";
    const innerHtml = await this.renderTokens(item.tokens);
    const taskClass = item.task ? " md-task-item" : "";
    const checkedClass = item.checked ? " md-task-checked" : "";
    return `<li class="md-list-item${taskClass}${checkedClass}">${checkbox}${innerHtml}</li>`;
  }

  private async renderTable(table: Tokens.Table): Promise<string> {
    const headerCells: string[] = [];
    for (let i = 0; i < table.header.length; i++) {
      const cell = table.header[i];
      const align = table.align[i];
      const alignAttr = align ? ` style="text-align: ${align}"` : "";
      const innerHtml = await this.renderInlineTokens(cell.tokens);
      headerCells.push(`<th class="md-table-th"${alignAttr}>${innerHtml}</th>`);
    }

    const bodyRows: string[] = [];
    for (const row of table.rows) {
      const cells: string[] = [];
      for (let i = 0; i < row.length; i++) {
        const cell = row[i];
        const align = table.align[i];
        const alignAttr = align ? ` style="text-align: ${align}"` : "";
        const innerHtml = await this.renderInlineTokens(cell.tokens);
        cells.push(`<td class="md-table-td"${alignAttr}>${innerHtml}</td>`);
      }
      bodyRows.push(`<tr class="md-table-row">${cells.join("")}</tr>`);
    }

    return `<div class="md-table-wrapper">
      <table class="md-table">
        <thead class="md-table-head">
          <tr class="md-table-row">${headerCells.join("")}</tr>
        </thead>
        <tbody class="md-table-body">${bodyRows.join("")}</tbody>
      </table>
    </div>`;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function MarkdownPreview(props: MarkdownPreviewProps) {
  const [viewMode, setViewMode] = createSignal<ViewMode>(props.initialViewMode || "split");
  const [showToc, setShowToc] = createSignal(true);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [parsedContent, setParsedContent] = createSignal<ParsedContent>({ html: "", toc: [] });
  const [isRendering, setIsRendering] = createSignal(false);
  const [editorContent, setEditorContent] = createSignal(props.content);
  const [scrollSync, setScrollSync] = createSignal(true);
  const [expandedTocItems, setExpandedTocItems] = createSignal<Set<string>>(new Set());

  let previewRef: HTMLDivElement | undefined;
  let editorRef: HTMLTextAreaElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let renderer: MarkdownRenderer | null = null;
  let renderTimeout: ReturnType<typeof setTimeout> | null = null;

  // Initialize renderer
  onMount(async () => {
    renderer = new MarkdownRenderer();
    await renderer.initialize();
    await renderMarkdown(props.content);
  });

  // Clean up on unmount
  onCleanup(() => {
    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }
  });

  // Update editor content when props change
  createEffect(() => {
    setEditorContent(props.content);
  });

  // Debounced rendering
  createEffect(() => {
    const content = editorContent();
    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }
    renderTimeout = setTimeout(() => {
      renderMarkdown(content);
    }, 150);
  });

  async function renderMarkdown(content: string): Promise<void> {
    if (!renderer) return;
    setIsRendering(true);
    try {
      const parsed = await renderer.parse(content);
      setParsedContent(parsed);
      
      // After DOM update, process mermaid and math
      requestAnimationFrame(() => {
        processMermaidDiagrams();
        processMathBlocks();
      });
    } catch (error) {
      console.error("Markdown rendering error:", error);
      setParsedContent({
        html: `<div class="md-error">Error rendering markdown</div>`,
        toc: [],
      });
    } finally {
      setIsRendering(false);
    }
  }

  function processMermaidDiagrams(): void {
    if (!previewRef) return;
    const mermaid = (window as unknown as { mermaid?: { run: (config: { nodes: NodeListOf<Element> }) => void } }).mermaid;
    if (mermaid) {
      const diagrams = previewRef.querySelectorAll(".mermaid:not([data-processed])");
      if (diagrams.length > 0) {
        mermaid.run({ nodes: diagrams });
        diagrams.forEach((d) => d.setAttribute("data-processed", "true"));
      }
    }
  }

  function processMathBlocks(): void {
    if (!previewRef) return;
    const renderMathInElement = (window as unknown as { renderMathInElement?: (el: Element, config: object) => void }).renderMathInElement;
    if (renderMathInElement) {
      renderMathInElement(previewRef, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    }
  }

  function handleEditorInput(e: InputEvent): void {
    const target = e.target as HTMLTextAreaElement;
    setEditorContent(target.value);
    props.onContentChange?.(target.value);
  }

  function handleEditorScroll(): void {
    if (!scrollSync() || !editorRef || !previewRef) return;
    const editorScrollRatio = editorRef.scrollTop / (editorRef.scrollHeight - editorRef.clientHeight);
    previewRef.scrollTop = editorScrollRatio * (previewRef.scrollHeight - previewRef.clientHeight);
  }

  function handlePreviewScroll(): void {
    if (!scrollSync() || !editorRef || !previewRef) return;
    const previewScrollRatio = previewRef.scrollTop / (previewRef.scrollHeight - previewRef.clientHeight);
    editorRef.scrollTop = previewScrollRatio * (editorRef.scrollHeight - editorRef.clientHeight);
  }

  function scrollToHeading(id: string): void {
    if (!previewRef) return;
    const element = previewRef.querySelector(`#${CSS.escape(id)}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function toggleTocItem(id: string): void {
    setExpandedTocItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function exportToHtml(): Promise<void> {
    const content = parsedContent();
    const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${props.filePath?.split(/[/\\]/).pop() || "Markdown Export"}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    :root {
      --md-bg: var(--cortex-bg-primary);
      --md-text: var(--cortex-text-primary);
      --md-text-muted: var(--cortex-text-inactive);
      --md-border: var(--cortex-bg-hover);
      --md-link: var(--cortex-info);
      --md-code-bg: var(--cortex-bg-secondary);
    }
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--md-bg);
      color: var(--md-text);
      line-height: 1.7;
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 { color: #fff; margin: 1.5em 0 0.5em; }
    h1 { font-size: 2.25rem; border-bottom: 1px solid var(--md-border); padding-bottom: 0.5rem; }
    h2 { font-size: 1.875rem; border-bottom: 1px solid var(--md-border); padding-bottom: 0.5rem; }
    h3 { font-size: 1.5rem; }
    a { color: var(--md-link); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: var(--md-code-bg); padding: 0.2em 0.4em; border-radius: var(--cortex-radius-sm); font-family: 'JetBrains Mono', monospace; }
    pre { background: var(--md-code-bg); padding: 1rem; border-radius: var(--cortex-radius-md); overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid var(--md-border); margin: 1rem 0; padding: 0.5rem 1rem; color: var(--md-text-muted); }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid var(--md-border); padding: 0.5rem 1rem; text-align: left; }
    th { background: var(--md-code-bg); }
    img { max-width: 100%; height: auto; border-radius: var(--cortex-radius-md); }
    hr { border: none; border-top: 1px solid var(--md-border); margin: 2rem 0; }
    .md-heading-anchor { display: none; }
  </style>
</head>
<body>
  ${content.html}
</body>
</html>`;

    const blob = new Blob([htmlDocument], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.filePath?.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") || "export"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleFullscreen(): void {
    if (!containerRef) return;
    if (!document.fullscreenElement) {
      containerRef.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  }

  // Fullscreen change listener
  onMount(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    onCleanup(() => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    });
  });

  // Calculate file name for display
  const fileName = createMemo(() => {
    if (!props.filePath) return "Markdown Preview";
    return props.filePath.split(/[/\\]/).pop() || "Markdown Preview";
  });

  return (
    <div
      ref={containerRef}
      class="md-preview-container flex flex-col h-full overflow-hidden"
      style={{
        background: "var(--background-base, var(--cortex-bg-primary))",
        color: "var(--text-base, var(--cortex-text-primary))",
      }}
    >
      {/* Toolbar */}
      <div
        class="md-toolbar shrink-0 flex items-center justify-between px-3 h-10 border-b"
        style={{ "border-color": "var(--border-weak, var(--cortex-bg-hover))" }}
      >
        {/* Left: File name and view mode */}
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium truncate max-w-[200px]" title={props.filePath}>
            {fileName()}
          </span>
          <div class="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "var(--surface-raised, var(--cortex-bg-hover))" }}>
<ToolbarButton
              iconName="pen"
              title="Editor only"
              active={viewMode() === "editor"}
              onClick={() => setViewMode("editor")}
            />
            <ToolbarButton
              iconName="columns"
              title="Split view"
              active={viewMode() === "split"}
              onClick={() => setViewMode("split")}
            />
            <ToolbarButton
              iconName="eye"
              title="Preview only"
              active={viewMode() === "preview"}
              onClick={() => setViewMode("preview")}
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div class="flex items-center gap-1">
<Show when={isRendering()}>
            <Icon name="rotate" class="w-4 h-4 animate-spin" style={{ color: "var(--text-muted, var(--cortex-text-inactive))" }} />
          </Show>
          <ToolbarButton
            iconName="link"
            title={scrollSync() ? "Disable scroll sync" : "Enable scroll sync"}
            active={scrollSync()}
            onClick={() => setScrollSync(!scrollSync())}
          />
          <ToolbarButton
            iconName="list"
            title={showToc() ? "Hide table of contents" : "Show table of contents"}
            active={showToc()}
            onClick={() => setShowToc(!showToc())}
          />
          <div class="w-px h-4 mx-1" style={{ background: "var(--border-weak, var(--cortex-bg-hover))" }} />
          <ToolbarButton iconName="download" title="Export to HTML" onClick={exportToHtml} />
          <ToolbarButton
            iconName={isFullscreen() ? "minimize" : "maximize"}
            title={isFullscreen() ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={toggleFullscreen}
          />
          <Show when={props.onClose}>
            <ToolbarButton iconName="xmark" title="Close preview" onClick={props.onClose} />
          </Show>
        </div>
      </div>

      {/* Main content area */}
      <div class="flex-1 flex min-h-0 overflow-hidden">
        {/* Table of Contents */}
        <Show when={showToc() && parsedContent().toc.length > 0 && viewMode() !== "editor"}>
          <div
            class="md-toc shrink-0 w-56 border-r overflow-y-auto"
            style={{ "border-color": "var(--border-weak, var(--cortex-bg-hover))", background: "var(--surface-base, var(--cortex-bg-secondary))" }}
          >
            <div class="p-3">
              <h3 class="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted, var(--cortex-text-inactive))" }}>
                Contents
              </h3>
              <TocTree
                items={parsedContent().toc}
                expandedItems={expandedTocItems()}
                onToggle={toggleTocItem}
                onNavigate={scrollToHeading}
              />
            </div>
          </div>
        </Show>

        {/* Editor pane */}
        <Show when={viewMode() === "editor" || viewMode() === "split"}>
          <div
            class="md-editor-pane flex-1 min-w-0"
            style={{ "max-width": viewMode() === "split" ? "50%" : "100%" }}
          >
            <textarea
              ref={editorRef}
              value={editorContent()}
              onInput={handleEditorInput}
              onScroll={handleEditorScroll}
              disabled={props.readOnly}
              class="w-full h-full p-4 resize-none outline-none font-mono text-sm leading-relaxed"
              style={{
                background: "var(--background-stronger, var(--cortex-bg-secondary))",
                color: "var(--text-base, var(--cortex-text-primary))",
                "font-family": "'JetBrains Mono', 'Fira Code', monospace",
              }}
              spellcheck={false}
              placeholder="Enter markdown content..."
            />
          </div>
        </Show>

        {/* Divider */}
        <Show when={viewMode() === "split"}>
          <div class="w-px shrink-0" style={{ background: "var(--border-weak, var(--cortex-bg-hover))" }} />
        </Show>

        {/* Preview pane */}
        <Show when={viewMode() === "preview" || viewMode() === "split"}>
          <SafeHTML
            ref={previewRef}
            class="md-preview-pane flex-1 min-w-0 overflow-y-auto p-6"
            style={{
              "max-width": viewMode() === "split" ? "50%" : "100%",
              background: "var(--background-base, var(--cortex-bg-primary))",
            }}
            onScroll={handlePreviewScroll}
            html={parsedContent().html}
          />
        </Show>
      </div>

      {/* Styles */}
      <style>{markdownStyles}</style>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface ToolbarButtonProps {
  iconName: string;
  title: string;
  active?: boolean;
  onClick?: () => void;
}

function ToolbarButton(props: ToolbarButtonProps) {
  return (
    <button
      onClick={props.onClick}
      title={props.title}
      class="p-1.5 rounded transition-colors"
      style={{
        color: props.active ? "var(--text-base, var(--cortex-text-primary))" : "var(--text-muted, var(--cortex-text-inactive))",
        background: props.active ? "var(--surface-overlay, var(--cortex-bg-hover))" : "transparent",
      }}
    >
      <Icon name={props.iconName} class="w-4 h-4" />
    </button>
  );
}

interface TocTreeProps {
  items: TocItem[];
  expandedItems: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
  depth?: number;
}

function TocTree(props: TocTreeProps) {
  const depth = props.depth ?? 0;

  return (
    <ul class="md-toc-list" style={{ "padding-left": depth > 0 ? "0.75rem" : "0" }}>
      <For each={props.items}>
        {(item) => {
          const hasChildren = item.children.length > 0;
          const isExpanded = props.expandedItems.has(item.id);

          return (
            <li class="md-toc-item">
              <div class="flex items-center gap-1">
                <Show when={hasChildren}>
                  <button
                    onClick={() => props.onToggle(item.id)}
                    class="p-0.5 rounded hover:bg-[var(--surface-raised)]"
                    style={{ color: "var(--text-muted, var(--cortex-text-inactive))" }}
                  >
{isExpanded ? (
                      <Icon name="chevron-down" class="w-3 h-3" />
                    ) : (
                      <Icon name="chevron-right" class="w-3 h-3" />
                    )}
                  </button>
                </Show>
                <Show when={!hasChildren}>
                  <span class="w-4" />
                </Show>
                <button
                  onClick={() => props.onNavigate(item.id)}
                  class="flex-1 text-left text-sm py-1 px-1 rounded truncate transition-colors hover:bg-[var(--surface-raised)]"
                  style={{ color: "var(--text-weak, var(--cortex-text-inactive))" }}
                  title={item.text}
                >
                  {item.text}
                </button>
              </div>
              <Show when={hasChildren && isExpanded}>
                <TocTree
                  items={item.children}
                  expandedItems={props.expandedItems}
                  onToggle={props.onToggle}
                  onNavigate={props.onNavigate}
                  depth={depth + 1}
                />
              </Show>
            </li>
          );
        }}
      </For>
    </ul>
  );
}

// ============================================================================
// Markdown Styles
// ============================================================================

const markdownStyles = `
/* Preview container styles */
.md-preview-pane {
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.7;
}

/* Headings */
.md-heading {
  position: relative;
  margin: 1.5em 0 0.5em;
  font-weight: 600;
  color: #fff;
}

.md-heading:hover .md-heading-anchor {
  opacity: 1;
}

.md-heading-anchor {
  position: absolute;
  left: -1.25em;
  padding-right: 0.25em;
  opacity: 0;
  color: var(--text-muted, var(--cortex-text-inactive));
  text-decoration: none;
  transition: opacity 0.2s;
}

.md-heading-anchor:hover {
  color: var(--text-base, var(--cortex-text-primary));
}

.md-h1 {
  font-size: 2.25rem;
  border-bottom: 1px solid var(--border-weak, var(--cortex-bg-hover));
  padding-bottom: 0.5rem;
}

.md-h2 {
  font-size: 1.875rem;
  border-bottom: 1px solid var(--border-weak, var(--cortex-bg-hover));
  padding-bottom: 0.5rem;
}

.md-h3 { font-size: 1.5rem; }
.md-h4 { font-size: 1.25rem; }
.md-h5 { font-size: 1.125rem; }
.md-h6 { font-size: 1rem; color: var(--text-muted, var(--cortex-text-inactive)); }

/* Paragraphs and text */
.md-paragraph {
  margin: 1em 0;
}

.md-strong { font-weight: 600; }
.md-em { font-style: italic; }
.md-del { text-decoration: line-through; color: var(--text-muted, var(--cortex-text-inactive)); }

/* Links */
.md-link {
  color: var(--cortex-info);
  text-decoration: none;
  transition: color 0.2s;
}

.md-link:hover {
  color: var(--cortex-info);
  text-decoration: underline;
}

/* Inline code */
.md-code-inline {
  background: var(--surface-raised, var(--cortex-bg-hover));
  padding: 0.2em 0.4em;
  border-radius: var(--cortex-radius-sm);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875em;
  color: var(--cortex-info);
}

/* Code blocks */
.md-code-block {
  margin: 1em 0;
  border-radius: var(--cortex-radius-md);
  overflow: hidden;
}

.md-code-block pre {
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
  background: var(--surface-base, var(--cortex-bg-secondary)) !important;
}

.md-code-block code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* Blockquotes */
.md-blockquote {
  margin: 1em 0;
  padding: 0.5rem 1rem;
  border-left: 4px solid var(--cortex-info);
  background: var(--surface-raised, var(--cortex-bg-hover));
  border-radius: 0 8px 8px 0;
  color: var(--text-weak, var(--cortex-text-inactive));
}

.md-blockquote > *:first-child { margin-top: 0; }
.md-blockquote > *:last-child { margin-bottom: 0; }

/* Lists */
.md-list {
  margin: 1em 0;
  padding-left: 1.5em;
}

.md-list-ordered { list-style-type: decimal; }
.md-list-unordered { list-style-type: disc; }

.md-list-item {
  margin: 0.25em 0;
}

.md-list-item .md-list {
  margin: 0.5em 0;
}

/* Task lists */
.md-task-item {
  list-style: none;
  margin-left: -1.5em;
  padding-left: 0;
}

.md-task-checkbox {
  margin-right: 0.5em;
  accent-color: var(--cortex-info);
}

.md-task-checked {
  color: var(--text-muted, var(--cortex-text-inactive));
  text-decoration: line-through;
}

/* Tables */
.md-table-wrapper {
  margin: 1em 0;
  overflow-x: auto;
}

.md-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.md-table-th,
.md-table-td {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-weak, var(--cortex-bg-hover));
}

.md-table-th {
  background: var(--surface-raised, var(--cortex-bg-hover));
  font-weight: 600;
  text-align: left;
}

.md-table-row:nth-child(even) .md-table-td {
  background: var(--surface-base, var(--cortex-bg-secondary));
}

/* Horizontal rule */
.md-hr {
  border: none;
  border-top: 1px solid var(--border-weak, var(--cortex-bg-hover));
  margin: 2rem 0;
}

/* Images */
.md-image {
  max-width: 100%;
  height: auto;
  border-radius: var(--cortex-radius-md);
  margin: 1em 0;
}

/* Mermaid diagrams */
.md-mermaid {
  margin: 1em 0;
  padding: 1rem;
  background: var(--surface-raised, var(--cortex-bg-hover));
  border-radius: var(--cortex-radius-md);
  overflow-x: auto;
}

.md-mermaid .mermaid {
  display: flex;
  justify-content: center;
}

/* Math blocks */
.md-math-block {
  margin: 1em 0;
  padding: 1rem;
  background: var(--surface-raised, var(--cortex-bg-hover));
  border-radius: var(--cortex-radius-md);
  overflow-x: auto;
  text-align: center;
}

/* Error display */
.md-error {
  padding: 1rem;
  background: var(--cortex-error-bg);
  color: var(--cortex-error-bg);
  border-radius: var(--cortex-radius-md);
  margin: 1em 0;
}

/* Table of Contents */
.md-toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.md-toc-item {
  margin: 0.125rem 0;
}

/* Scrollbar styling */
.md-preview-pane::-webkit-scrollbar,
.md-editor-pane textarea::-webkit-scrollbar,
.md-toc::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.md-preview-pane::-webkit-scrollbar-track,
.md-editor-pane textarea::-webkit-scrollbar-track,
.md-toc::-webkit-scrollbar-track {
  background: transparent;
}

.md-preview-pane::-webkit-scrollbar-thumb,
.md-editor-pane textarea::-webkit-scrollbar-thumb,
.md-toc::-webkit-scrollbar-thumb {
  background: var(--border-weak, var(--cortex-bg-hover));
  border-radius: var(--cortex-radius-sm);
}

.md-preview-pane::-webkit-scrollbar-thumb:hover,
.md-editor-pane textarea::-webkit-scrollbar-thumb:hover,
.md-toc::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted, var(--cortex-text-inactive));
}
`;

// ============================================================================
// Utility: Check if file is Markdown
// ============================================================================

export function isMarkdownFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return ["md", "mdx", "markdown"].includes(ext);
}

export default MarkdownPreview;


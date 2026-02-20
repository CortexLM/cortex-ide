import {
  Show,
  For,
  Switch,
  Match,
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  batch,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { SafeHTML } from "../ui/SafeHTML";
import { Markdown } from "@/components/Markdown";
import { MonacoManager } from "@/utils/monacoManager";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Notebook Search Types
// ============================================================================

type SearchScope = "code" | "markdown" | "output";

interface NotebookSearchMatch {
  cellId: string;
  cellIndex: number;
  cellType: CellType;
  scope: SearchScope;
  start: number;
  end: number;
  line: number;
  column: number;
  text: string;
  contextBefore: string;
  contextAfter: string;
}

interface CellMatchInfo {
  cellId: string;
  cellIndex: number;
  cellType: CellType;
  matchCount: number;
  matches: NotebookSearchMatch[];
}

// ============================================================================
// Types for Jupyter Notebook Format (.ipynb)
// ============================================================================

type CellType = "markdown" | "code" | "raw";

interface NotebookCellOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string; // For stream: "stdout" | "stderr"
  text?: string | string[];
  data?: Record<string, string | string[]>;
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface NotebookCell {
  id: string;
  cell_type: CellType;
  source: string[];
  metadata: Record<string, unknown>;
  outputs?: NotebookCellOutput[];
  execution_count?: number | null;
}

interface NotebookKernelSpec {
  display_name: string;
  language: string;
  name: string;
}

interface NotebookMetadata {
  kernelspec?: NotebookKernelSpec;
  language_info?: {
    name: string;
    version?: string;
    file_extension?: string;
  };
  [key: string]: unknown;
}

interface JupyterNotebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: NotebookMetadata;
  cells: NotebookCell[];
}

type CellStatus = "idle" | "running" | "success" | "error";

interface InternalCell extends NotebookCell {
  status: CellStatus;
  isEditing: boolean;
  isOutputCollapsed: boolean;
}

// ============================================================================
// Monaco Editor Instance (shared)
// ============================================================================

let monacoInstance: typeof Monaco | null = null;

async function initMonaco(): Promise<typeof Monaco> {
  if (monacoInstance) {
    return monacoInstance;
  }

  const monaco = await MonacoManager.getInstance().ensureLoaded();
  monacoInstance = monaco;

  monaco.editor.defineTheme("notebook-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a9955", fontStyle: "italic" },
      { token: "keyword", foreground: "c586c0" },
      { token: "keyword.control", foreground: "c586c0" },
      { token: "storage", foreground: "569cd6" },
      { token: "storage.type", foreground: "569cd6" },
      { token: "type", foreground: "4ec9b0" },
      { token: "type.identifier", foreground: "4ec9b0" },
      { token: "class", foreground: "4ec9b0" },
      { token: "interface", foreground: "4ec9b0" },
      { token: "function", foreground: "dcdcaa" },
      { token: "variable", foreground: "9cdcfe" },
      { token: "variable.predefined", foreground: "9cdcfe" },
      { token: "parameter", foreground: "9cdcfe" },
      { token: "property", foreground: "9cdcfe" },
      { token: "string", foreground: "ce9178" },
      { token: "string.escape", foreground: "d7ba7d" },
      { token: "number", foreground: "b5cea8" },
      { token: "number.hex", foreground: "b5cea8" },
      { token: "regexp", foreground: "d16969" },
      { token: "operator", foreground: "d4d4d4" },
      { token: "delimiter", foreground: "d4d4d4" },
      { token: "tag", foreground: "569cd6" },
      { token: "attribute.name", foreground: "9cdcfe" },
      { token: "attribute.value", foreground: "ce9178" },
      { token: "metatag", foreground: "569cd6" },
      { token: "annotation", foreground: "dcdcaa" },
      { token: "constant", foreground: "569cd6" },
    ],
    colors: {
      "editor.background": "var(--ui-panel-bg)",
      "editor.foreground": "var(--cortex-text-primary)",
      "editor.lineHighlightBackground": "var(--cortex-bg-hover)",
      "editor.selectionBackground": "var(--cortex-info-bg)",
      "editor.inactiveSelectionBackground": "var(--cortex-bg-hover)",
      "editorCursor.foreground": "var(--cortex-text-secondary)",
      "editorLineNumber.foreground": "var(--cortex-bg-active)",
      "editorLineNumber.activeForeground": "var(--cortex-text-primary)",
      "editorIndentGuide.background1": "var(--cortex-bg-active)",
      "editorIndentGuide.activeBackground1": "var(--cortex-text-inactive)",
      "editor.selectionHighlightBackground": "var(--cortex-info)26",
      "editorBracketMatch.background": "var(--cortex-success)1a",
      "editorBracketMatch.border": "var(--cortex-text-inactive)",
    },
  });

  return monaco;
}

// ============================================================================
// Language Mapping for Monaco
// ============================================================================

const languageMap: Record<string, string> = {
  python: "python",
  python3: "python",
  julia: "julia",
  r: "r",
  javascript: "javascript",
  typescript: "typescript",
  rust: "rust",
  go: "go",
  c: "c",
  cpp: "cpp",
  java: "java",
  scala: "scala",
  ruby: "ruby",
  perl: "perl",
  php: "php",
  swift: "swift",
  kotlin: "kotlin",
  sql: "sql",
  shell: "shell",
  bash: "shell",
  powershell: "powershell",
};

// ============================================================================
// Utility Functions
// ============================================================================

function generateCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function joinSource(source: string | string[]): string {
  return Array.isArray(source) ? source.join("") : source;
}

function splitSource(source: string): string[] {
  return source.split("\n").map((line, i, arr) => (i < arr.length - 1 ? line + "\n" : line));
}

function parseNotebook(content: string): JupyterNotebook | null {
  try {
    const notebook = JSON.parse(content) as JupyterNotebook;
    if (!notebook.cells || !Array.isArray(notebook.cells)) {
      return null;
    }
    return notebook;
  } catch {
    return null;
  }
}

function serializeNotebook(
  cells: InternalCell[],
  metadata: NotebookMetadata,
  nbformat: number,
  nbformat_minor: number
): string {
  const notebookCells: NotebookCell[] = cells.map((cell) => ({
    id: cell.id,
    cell_type: cell.cell_type,
    source: splitSource(joinSource(cell.source)),
    metadata: cell.metadata,
    ...(cell.cell_type === "code"
      ? {
          outputs: cell.outputs || [],
          execution_count: cell.execution_count ?? null,
        }
      : {}),
  }));

  const notebook: JupyterNotebook = {
    nbformat,
    nbformat_minor,
    metadata,
    cells: notebookCells,
  };

  return JSON.stringify(notebook, null, 1);
}

function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

// ============================================================================
// Output Renderers
// ============================================================================

function TextOutput(props: { content: string; isError?: boolean }) {
  return (
    <pre
      class="font-mono text-code-sm whitespace-pre-wrap break-words"
      style={{
        color: props.isError ? "var(--error)" : "var(--text-base)",
        margin: 0,
        padding: "4px 0",
        "line-height": "1.5",
      }}
    >
      {stripAnsiCodes(props.content)}
    </pre>
  );
}

function HtmlOutput(props: { content: string }) {
  return (
    <SafeHTML
      html={props.content}
      class="notebook-html-output prose prose-invert max-w-none"
      style={{
        "max-width": "100%",
        overflow: "auto",
      }}
    />
  );
}

function ImageOutput(props: { mimeType: string; data: string }) {
  const src = createMemo(() => {
    if (props.data.startsWith("data:")) {
      return props.data;
    }
    return `data:${props.mimeType};base64,${props.data}`;
  });

  return (
    <img
      src={src()}
      alt="Cell output"
      style={{
        "max-width": "100%",
        height: "auto",
        "border-radius": "var(--cortex-radius-sm)",
        "margin-top": "8px",
      }}
    />
  );
}

function SvgOutput(props: { content: string }) {
  return (
    <SafeHTML
      html={props.content}
      class="notebook-svg-output"
      style={{
        "max-width": "100%",
        overflow: "auto",
      }}
    />
  );
}

function JsonOutput(props: { data: unknown }) {
  return (
    <pre
      class="font-mono text-code-sm"
      style={{
        color: "var(--text-base)",
        background: "var(--surface-raised)",
        padding: "8px",
        "border-radius": "var(--cortex-radius-sm)",
        overflow: "auto",
        margin: "4px 0",
      }}
    >
      {JSON.stringify(props.data, null, 2)}
    </pre>
  );
}

function ErrorOutput(props: { name: string; message: string; traceback: string[] }) {
  return (
    <div class="notebook-error-output" style={{ padding: "4px 0" }}>
      <div
        class="font-mono text-sm font-semibold mb-1"
        style={{ color: "var(--error)" }}
      >
        {props.name}: {props.message}
      </div>
      <Show when={props.traceback.length > 0}>
        <pre
          class="font-mono text-code-sm"
          style={{
            color: "var(--cortex-error)",
            margin: 0,
            "white-space": "pre-wrap",
            "word-break": "break-all",
          }}
        >
          {props.traceback.map(stripAnsiCodes).join("\n")}
        </pre>
      </Show>
    </div>
  );
}

function CellOutputRenderer(props: { output: NotebookCellOutput }) {
  const getOutputContent = () => {
    const output = props.output;

    // Error output
    if (output.output_type === "error") {
      return (
        <ErrorOutput
          name={output.ename || "Error"}
          message={output.evalue || "Unknown error"}
          traceback={output.traceback || []}
        />
      );
    }

    // Stream output (stdout/stderr)
    if (output.output_type === "stream") {
      const text = Array.isArray(output.text) ? output.text.join("") : output.text || "";
      return <TextOutput content={text} isError={output.name === "stderr"} />;
    }

    // execute_result or display_data
    if (output.data) {
      const data = output.data;

      // HTML content
      if (data["text/html"]) {
        const html = Array.isArray(data["text/html"])
          ? data["text/html"].join("")
          : data["text/html"];
        return <HtmlOutput content={html} />;
      }

      // SVG content
      if (data["image/svg+xml"]) {
        const svg = Array.isArray(data["image/svg+xml"])
          ? data["image/svg+xml"].join("")
          : data["image/svg+xml"];
        return <SvgOutput content={svg} />;
      }

      // PNG image
      if (data["image/png"]) {
        const png = Array.isArray(data["image/png"])
          ? data["image/png"].join("")
          : data["image/png"];
        return <ImageOutput mimeType="image/png" data={png} />;
      }

      // JPEG image
      if (data["image/jpeg"]) {
        const jpeg = Array.isArray(data["image/jpeg"])
          ? data["image/jpeg"].join("")
          : data["image/jpeg"];
        return <ImageOutput mimeType="image/jpeg" data={jpeg} />;
      }

      // GIF image
      if (data["image/gif"]) {
        const gif = Array.isArray(data["image/gif"])
          ? data["image/gif"].join("")
          : data["image/gif"];
        return <ImageOutput mimeType="image/gif" data={gif} />;
      }

      // JSON/Application JSON
      if (data["application/json"]) {
        return <JsonOutput data={data["application/json"]} />;
      }

      // LaTeX
      if (data["text/latex"]) {
        const latex = Array.isArray(data["text/latex"])
          ? data["text/latex"].join("")
          : data["text/latex"];
        return (
          <pre
            class="font-mono text-code-sm"
            style={{ color: "var(--text-base)", margin: "4px 0" }}
          >
            {latex}
          </pre>
        );
      }

      // Markdown
      if (data["text/markdown"]) {
        const md = Array.isArray(data["text/markdown"])
          ? data["text/markdown"].join("")
          : data["text/markdown"];
        return <Markdown content={md} />;
      }

      // Plain text (fallback)
      if (data["text/plain"]) {
        const text = Array.isArray(data["text/plain"])
          ? data["text/plain"].join("")
          : data["text/plain"];
        return <TextOutput content={text} />;
      }
    }

    // Final fallback for text property
    if (output.text) {
      const text = Array.isArray(output.text) ? output.text.join("") : output.text;
      return <TextOutput content={text} />;
    }

    return null;
  };

  return <>{getOutputContent()}</>;
}

// ============================================================================
// Cell Output Area
// ============================================================================

interface CellOutputAreaProps {
  outputs: NotebookCellOutput[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function CellOutputArea(props: CellOutputAreaProps) {
  const outputCount = () => props.outputs.length;

  return (
    <Show when={outputCount() > 0}>
      <div
        class="cell-output-area"
        style={{
          "border-top": "1px solid var(--border-weak)",
          "margin-top": "8px",
        }}
      >
        {/* Output header with collapse toggle */}
        <div
          class="flex items-center gap-2 py-1 cursor-pointer select-none"
          style={{ color: "var(--text-weak)" }}
          onClick={() => props.onToggleCollapse()}
        >
      <Show when={props.isCollapsed} fallback={<Icon name="chevron-down" class="w-3 h-3" />}>
            <Icon name="chevron-right" class="w-3 h-3" />
          </Show>
          <span class="text-xs">
            {outputCount()} output{outputCount() > 1 ? "s" : ""}
            {props.isCollapsed ? " (collapsed)" : ""}
          </span>
        </div>

        {/* Output content */}
        <Show when={!props.isCollapsed}>
          <div class="cell-outputs pt-2">
            <For each={props.outputs}>
              {(output) => <CellOutputRenderer output={output} />}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// ============================================================================
// Monaco Code Cell Editor
// ============================================================================

interface CodeCellEditorProps {
  source: string;
  language: string;
  onChange: (value: string) => void;
  onRun: () => void;
  isFocused: boolean;
  onFocus: () => void;
}

function CodeCellEditor(props: CodeCellEditorProps) {
  let containerRef: HTMLDivElement | undefined;
  let editorInstance: Monaco.editor.IStandaloneCodeEditor | null = null;
  const [isLoading, setIsLoading] = createSignal(true);

  onMount(async () => {
    const monaco = await initMonaco();
    setIsLoading(false);

    if (!containerRef) return;

    const monacoLang = languageMap[props.language.toLowerCase()] || "plaintext";

    editorInstance = monaco.editor.create(containerRef, {
      value: props.source,
      language: monacoLang,
      theme: "notebook-dark",
      automaticLayout: true,
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      glyphMargin: false,
      folding: true,
      foldingHighlight: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineHeight: 20,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
      fontLigatures: true,
      tabSize: 4,
      insertSpaces: true,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      renderLineHighlight: "line",
      bracketPairColorization: { enabled: true },
      matchBrackets: "always",
      autoClosingBrackets: "always",
      autoClosingQuotes: "always",
      guides: {
        bracketPairs: true,
        indentation: true,
        highlightActiveIndentation: true,
        highlightActiveBracketPair: true,
      },
      padding: { top: 8, bottom: 8 },
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
        useShadows: false,
        vertical: "auto",
        horizontal: "auto",
      },
      overviewRulerLanes: 0,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      wordWrap: "on",
      wrappingStrategy: "advanced",
    });

    // Handle content changes
    editorInstance.onDidChangeModelContent(() => {
      if (editorInstance) {
        props.onChange(editorInstance.getValue());
      }
    });

    // Handle Shift+Enter to run cell
    editorInstance.addCommand(
      monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      () => {
        props.onRun();
      }
    );

    // Handle focus
    editorInstance.onDidFocusEditorText(() => {
      props.onFocus();
    });

    // Dynamic height based on content
    updateEditorHeight();
    editorInstance.onDidChangeModelContent(updateEditorHeight);
  });

  const updateEditorHeight = () => {
    if (!editorInstance || !containerRef) return;

    const lineCount = editorInstance.getModel()?.getLineCount() || 1;
    const lineHeight = 20;
    const minHeight = 60;
    const maxHeight = 500;
    const padding = 16;

    const contentHeight = Math.min(
      Math.max(lineCount * lineHeight + padding, minHeight),
      maxHeight
    );

    containerRef.style.height = `${contentHeight}px`;
    editorInstance.layout();
  };

  // Update content when source changes externally
  createEffect(() => {
    const source = props.source;
    if (editorInstance) {
      const currentValue = editorInstance.getValue();
      if (currentValue !== source) {
        editorInstance.setValue(source);
      }
    }
  });

  onCleanup(() => {
    if (editorInstance) {
      editorInstance?.dispose?.();
      editorInstance = null;
    }
  });

  return (
    <div class="code-cell-editor" style={{ position: "relative" }}>
      <Show when={isLoading()}>
        <div
          class="flex items-center justify-center"
          style={{
            height: "60px",
            background: "var(--ui-panel-bg)",
            "border-radius": "var(--cortex-radius-sm)",
          }}
        >
          <Icon
            name="spinner"
            class="w-4 h-4 animate-spin"
            style={{ color: "var(--text-weak)" }}
          />
        </div>
      </Show>
      <div
        ref={containerRef}
        style={{
          display: isLoading() ? "none" : "block",
          "min-height": "60px",
          "border-radius": "var(--cortex-radius-sm)",
          overflow: "hidden",
        }}
      />
    </div>
  );
}

// ============================================================================
// Markdown Cell Editor
// ============================================================================

interface MarkdownCellEditorProps {
  source: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  onToggleEdit: () => void;
}

function MarkdownCellEditor(props: MarkdownCellEditorProps) {
  let textareaRef: HTMLTextAreaElement | undefined;

  createEffect(() => {
    if (props.isEditing && textareaRef) {
      textareaRef.focus();
      autoResizeTextarea();
    }
  });

  const autoResizeTextarea = () => {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = `${Math.max(textareaRef.scrollHeight, 80)}px`;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Escape to exit edit mode
    if (e.key === "Escape") {
      e.preventDefault();
      props.onToggleEdit();
    }
  };

  return (
    <div class="markdown-cell-editor">
      <Show
        when={props.isEditing}
        fallback={
          <div
            class="markdown-preview cursor-pointer p-3"
            style={{
              "min-height": "40px",
              "border-radius": "var(--cortex-radius-sm)",
              background: "transparent",
            }}
            onClick={() => props.onToggleEdit()}
            onDblClick={() => props.onToggleEdit()}
          >
            <Show
              when={props.source.trim()}
              fallback={
                <p
                  class="text-sm italic"
                  style={{ color: "var(--text-weaker)" }}
                >
                  Empty markdown cell. Double-click to edit.
                </p>
              }
            >
              <Markdown content={props.source} />
            </Show>
          </div>
        }
      >
        <textarea
          ref={textareaRef}
          value={props.source}
          onInput={(e) => {
            props.onChange(e.currentTarget.value);
            autoResizeTextarea();
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => props.onToggleEdit()}
          class="w-full resize-none outline-none font-mono text-sm p-3"
          style={{
            background: "var(--surface-base)",
            color: "var(--text-base)",
            border: "1px solid var(--accent)",
            "border-radius": "var(--cortex-radius-sm)",
            "min-height": "80px",
          }}
          placeholder="Enter markdown..."
          rows={3}
        />
      </Show>
    </div>
  );
}

// ============================================================================
// Raw Cell Editor
// ============================================================================

interface RawCellEditorProps {
  source: string;
  onChange: (value: string) => void;
}

function RawCellEditor(props: RawCellEditorProps) {
  let textareaRef: HTMLTextAreaElement | undefined;

  const autoResizeTextarea = () => {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = `${Math.max(textareaRef.scrollHeight, 60)}px`;
    }
  };

  onMount(autoResizeTextarea);

  return (
    <textarea
      ref={textareaRef}
      value={props.source}
      onInput={(e) => {
        props.onChange(e.currentTarget.value);
        autoResizeTextarea();
      }}
      class="w-full resize-none outline-none font-mono text-sm p-3"
      style={{
        background: "var(--surface-base)",
        color: "var(--text-base)",
        border: "1px solid var(--border-base)",
        "border-radius": "var(--cortex-radius-sm)",
        "min-height": "60px",
      }}
      placeholder="Raw cell content..."
      rows={2}
    />
  );
}

// ============================================================================
// Cell Status Indicator
// ============================================================================

interface CellStatusIndicatorProps {
  status: CellStatus;
  executionCount: number | null | undefined;
}

function CellStatusIndicator(props: CellStatusIndicatorProps) {
  const statusIcon = () => {
    switch (props.status) {
      case "running":
        return (
          <Icon
            name="spinner"
            class="w-3 h-3 animate-spin"
            style={{ color: "var(--warning)" }}
          />
        );
      case "success":
        return <Icon name="circle-check" class="w-3 h-3" style={{ color: "var(--success)" }} />;
      case "error":
        return <Icon name="circle-exclamation" class="w-3 h-3" style={{ color: "var(--error)" }} />;
      default:
        return null;
    }
  };

  const executionLabel = () => {
    if (props.status === "running") {
      return "[*]";
    }
    if (props.executionCount != null) {
      return `[${props.executionCount}]`;
    }
    return "[ ]";
  };

  return (
    <div
      class="flex items-center justify-center gap-1"
      style={{
        width: "48px",
        "min-width": "48px",
        color:
          props.status === "running"
            ? "var(--warning)"
            : props.status === "success"
            ? "var(--success)"
            : props.status === "error"
            ? "var(--error)"
            : "var(--text-weak)",
      }}
    >
      <span class="font-mono text-xs">{executionLabel()}</span>
      {statusIcon()}
    </div>
  );
}

// ============================================================================
// Cell Toolbar
// ============================================================================

interface CellToolbarProps {
  cellType: CellType;
  isEditing: boolean;
  onRun: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeCellType: (type: CellType) => void;
  onToggleEdit: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function CellToolbar(props: CellToolbarProps) {
  const [showTypeMenu, setShowTypeMenu] = createSignal(false);

  const cellTypeLabel = () => {
    switch (props.cellType) {
      case "code":
        return "Code";
      case "markdown":
        return "Markdown";
      case "raw":
        return "Raw";
    }
  };

  const cellTypeIcon = () => {
    switch (props.cellType) {
      case "code":
        return <Icon name="code" class="w-3.5 h-3.5" />;
      case "markdown":
        return <Icon name="file-lines" class="w-3.5 h-3.5" />;
      case "raw":
        return <Icon name="font" class="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      class="cell-toolbar flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ "min-height": "28px" }}
    >
      {/* Run button (only for code cells) */}
      <Show when={props.cellType === "code"}>
        <button
          onClick={() => props.onRun()}
          class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          title="Run cell (Shift+Enter)"
        >
          <Icon name="play" class="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
        </button>
      </Show>

      {/* Edit/View toggle (for markdown cells) */}
      <Show when={props.cellType === "markdown"}>
        <button
          onClick={() => props.onToggleEdit()}
          class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          title={props.isEditing ? "Preview markdown" : "Edit markdown"}
        >
          <Show when={props.isEditing} fallback={<Icon name="pen" class="w-3.5 h-3.5" />}>
            <Icon name="eye" class="w-3.5 h-3.5" />
          </Show>
        </button>
      </Show>

      {/* Cell type selector */}
      <div class="relative">
        <button
          onClick={() => setShowTypeMenu(!showTypeMenu())}
          class="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--surface-hover)] transition-colors text-xs"
          style={{ color: "var(--text-weak)" }}
        >
          {cellTypeIcon()}
          <span>{cellTypeLabel()}</span>
          <Icon name="chevron-down" class="w-3 h-3" />
        </button>

        <Show when={showTypeMenu()}>
          <div
            class="absolute top-full left-0 mt-1 py-1 rounded shadow-lg z-50"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-base)",
              "min-width": "120px",
            }}
          >
            <button
              onClick={() => {
                props.onChangeCellType("code");
                setShowTypeMenu(false);
              }}
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
              style={{
                color:
                  props.cellType === "code"
                    ? "var(--accent)"
                    : "var(--text-base)",
              }}
            >
              <Icon name="code" class="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
            <button
              onClick={() => {
                props.onChangeCellType("markdown");
                setShowTypeMenu(false);
              }}
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
              style={{
                color:
                  props.cellType === "markdown"
                    ? "var(--accent)"
                    : "var(--text-base)",
              }}
            >
              <Icon name="file-lines" class="w-3.5 h-3.5" />
              <span>Markdown</span>
            </button>
            <button
              onClick={() => {
                props.onChangeCellType("raw");
                setShowTypeMenu(false);
              }}
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
              style={{
                color:
                  props.cellType === "raw"
                    ? "var(--accent)"
                    : "var(--text-base)",
              }}
            >
              <Icon name="font" class="w-3.5 h-3.5" />
              <span>Raw</span>
            </button>
          </div>
        </Show>
      </div>

      {/* Spacer */}
      <div class="flex-1" />

      {/* Move up/down */}
      <button
        onClick={() => props.onMoveUp()}
        disabled={!props.canMoveUp}
        class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Move cell up"
      >
        <Icon name="chevron-up" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
      </button>
      <button
        onClick={() => props.onMoveDown()}
        disabled={!props.canMoveDown}
        class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Move cell down"
      >
        <Icon name="chevron-down" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
      </button>

      {/* Delete */}
      <button
        onClick={() => props.onDelete()}
        class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
        title="Delete cell"
      >
        <Icon name="trash" class="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
      </button>
    </div>
  );
}

// ============================================================================
// Notebook Cell Component
// ============================================================================

interface NotebookCellComponentProps {
  cell: InternalCell;
  index: number;
  totalCells: number;
  language: string;
  isActive: boolean;
  onUpdateSource: (source: string) => void;
  onRun: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeCellType: (type: CellType) => void;
  onToggleEdit: () => void;
  onToggleOutputCollapse: () => void;
  onFocus: () => void;
}

function NotebookCellComponent(props: NotebookCellComponentProps) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joinSource(props.cell.source));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      class="notebook-cell group relative"
      data-cell-id={props.cell.id}
      style={{
        background: props.isActive ? "var(--surface-base)" : "transparent",
        "border-left": props.isActive
          ? "3px solid var(--accent)"
          : "3px solid transparent",
        "border-radius": "var(--cortex-radius-sm)",
        padding: "8px",
        "margin-bottom": "4px",
        transition: "all 0.15s ease",
      }}
      onClick={() => props.onFocus()}
    >
      {/* Cell header with toolbar */}
      <div class="flex items-center gap-2 mb-2">
        {/* Execution indicator (for code cells) */}
        <Show when={props.cell.cell_type === "code"}>
          <CellStatusIndicator
            status={props.cell.status}
            executionCount={props.cell.execution_count}
          />
        </Show>

        {/* Cell type badge (for non-code cells) */}
        <Show when={props.cell.cell_type !== "code"}>
          <div
            class="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
            style={{
              background: "var(--surface-raised)",
              color: "var(--text-weak)",
            }}
          >
            <Show
              when={props.cell.cell_type === "markdown"}
              fallback={<Icon name="font" class="w-3 h-3" />}
            >
              <Icon name="file-lines" class="w-3 h-3" />
            </Show>
            <span>
              {props.cell.cell_type === "markdown" ? "Markdown" : "Raw"}
            </span>
          </div>
        </Show>

        {/* Toolbar */}
        <CellToolbar
          cellType={props.cell.cell_type}
          isEditing={props.cell.isEditing}
          onRun={props.onRun}
          onDelete={props.onDelete}
          onMoveUp={props.onMoveUp}
          onMoveDown={props.onMoveDown}
          onChangeCellType={props.onChangeCellType}
          onToggleEdit={props.onToggleEdit}
          canMoveUp={props.index > 0}
          canMoveDown={props.index < props.totalCells - 1}
        />

        {/* Copy button */}
        <button
          onClick={handleCopy}
          class="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-hover)] transition-all"
          title="Copy cell content"
        >
          <Show
            when={copied()}
            fallback={
              <Icon name="copy" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
            }
          >
            <Icon name="check" class="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
          </Show>
        </button>
      </div>

      {/* Cell content */}
      <div
        class="cell-content"
        style={{
          "margin-left": props.cell.cell_type === "code" ? "48px" : "0",
        }}
      >
        <Switch>
          <Match when={props.cell.cell_type === "code"}>
            <CodeCellEditor
              source={joinSource(props.cell.source)}
              language={props.language}
              onChange={props.onUpdateSource}
              onRun={props.onRun}
              isFocused={props.isActive}
              onFocus={props.onFocus}
            />
          </Match>
          <Match when={props.cell.cell_type === "markdown"}>
            <MarkdownCellEditor
              source={joinSource(props.cell.source)}
              isEditing={props.cell.isEditing}
              onChange={props.onUpdateSource}
              onToggleEdit={props.onToggleEdit}
            />
          </Match>
          <Match when={props.cell.cell_type === "raw"}>
            <RawCellEditor
              source={joinSource(props.cell.source)}
              onChange={props.onUpdateSource}
            />
          </Match>
        </Switch>

        {/* Cell outputs (for code cells) */}
        <Show when={props.cell.cell_type === "code" && props.cell.outputs}>
          <CellOutputArea
            outputs={props.cell.outputs || []}
            isCollapsed={props.cell.isOutputCollapsed}
            onToggleCollapse={props.onToggleOutputCollapse}
          />
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Add Cell Button
// ============================================================================

interface AddCellButtonProps {
  onAddCode: () => void;
  onAddMarkdown: () => void;
}

function AddCellButton(props: AddCellButtonProps) {
  const [showMenu, setShowMenu] = createSignal(false);

  return (
    <div
      class="add-cell-button flex items-center justify-center py-2 opacity-50 hover:opacity-100 transition-opacity"
    >
      <div class="relative">
        <button
          onClick={() => setShowMenu(!showMenu())}
          class="flex items-center gap-1 px-3 py-1.5 rounded text-xs hover:bg-[var(--surface-hover)] transition-colors"
          style={{
            color: "var(--text-weak)",
            border: "1px dashed var(--border-base)",
          }}
        >
          <Icon name="plus" class="w-3.5 h-3.5" />
          <span>Add Cell</span>
        </button>

        <Show when={showMenu()}>
          <div
            class="absolute top-full left-1/2 -translate-x-1/2 mt-1 py-1 rounded shadow-lg z-50"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-base)",
              "min-width": "120px",
            }}
          >
            <button
              onClick={() => {
                props.onAddCode();
                setShowMenu(false);
              }}
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-base)" }}
            >
              <Icon name="code" class="w-3.5 h-3.5" />
              <span>Code Cell</span>
            </button>
            <button
              onClick={() => {
                props.onAddMarkdown();
                setShowMenu(false);
              }}
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-base)" }}
            >
              <Icon name="file-lines" class="w-3.5 h-3.5" />
              <span>Markdown Cell</span>
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Notebook Search Component
// ============================================================================

// Persisted search state across open/close
let persistedNotebookQuery = "";
let persistedNotebookReplaceText = "";
let persistedNotebookCaseSensitive = false;
let persistedNotebookWholeWord = false;
let persistedNotebookUseRegex = false;
let persistedNotebookShowReplace = false;
let persistedNotebookSearchInCode = true;
let persistedNotebookSearchInMarkdown = true;
let persistedNotebookSearchInOutput = false;
let persistedNotebookFilterCellType: CellType | "all" = "all";

interface NotebookSearchProps {
  isVisible: boolean;
  onClose: () => void;
  cells: InternalCell[];
  onNavigateToCell: (cellId: string, position?: { line: number; column: number }) => void;
  onReplaceInCell: (cellId: string, start: number, end: number, replacement: string) => void;
  onReplaceAllInCell: (cellId: string, pattern: RegExp, replacement: string) => void;
}

function NotebookSearch(props: NotebookSearchProps) {
  const [query, setQuery] = createSignal(persistedNotebookQuery);
  const [replaceText, setReplaceText] = createSignal(persistedNotebookReplaceText);
  const [showReplace, setShowReplace] = createSignal(persistedNotebookShowReplace);
  const [caseSensitive, setCaseSensitive] = createSignal(persistedNotebookCaseSensitive);
  const [useRegex, setUseRegex] = createSignal(persistedNotebookUseRegex);
  const [wholeWord, setWholeWord] = createSignal(persistedNotebookWholeWord);
  const [searchInCode, setSearchInCode] = createSignal(persistedNotebookSearchInCode);
  const [searchInMarkdown, setSearchInMarkdown] = createSignal(persistedNotebookSearchInMarkdown);
  const [searchInOutput, setSearchInOutput] = createSignal(persistedNotebookSearchInOutput);
  const [filterCellType, setFilterCellType] = createSignal<CellType | "all">(persistedNotebookFilterCellType);
  const [matches, setMatches] = createSignal<NotebookSearchMatch[]>([]);
  const [cellMatches, setCellMatches] = createSignal<CellMatchInfo[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = createSignal(0);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [showFilters, setShowFilters] = createSignal(false);
  
  let inputRef: HTMLInputElement | undefined;
  let replaceInputRef: HTMLInputElement | undefined;

  // Persist state when values change
  createEffect(() => {
    persistedNotebookQuery = query();
    persistedNotebookReplaceText = replaceText();
    persistedNotebookCaseSensitive = caseSensitive();
    persistedNotebookWholeWord = wholeWord();
    persistedNotebookUseRegex = useRegex();
    persistedNotebookShowReplace = showReplace();
    persistedNotebookSearchInCode = searchInCode();
    persistedNotebookSearchInMarkdown = searchInMarkdown();
    persistedNotebookSearchInOutput = searchInOutput();
    persistedNotebookFilterCellType = filterCellType();
  });

  // Focus input when visible
  createEffect(() => {
    if (props.isVisible) {
      setQuery(persistedNotebookQuery);
      setReplaceText(persistedNotebookReplaceText);
      setCaseSensitive(persistedNotebookCaseSensitive);
      setWholeWord(persistedNotebookWholeWord);
      setUseRegex(persistedNotebookUseRegex);
      setShowReplace(persistedNotebookShowReplace);
      setSearchInCode(persistedNotebookSearchInCode);
      setSearchInMarkdown(persistedNotebookSearchInMarkdown);
      setSearchInOutput(persistedNotebookSearchInOutput);
      setFilterCellType(persistedNotebookFilterCellType);
      setTimeout(() => {
        inputRef?.focus();
        inputRef?.select();
      }, 10);
      performSearch();
    }
  });

  // Re-search when query or options change
  createEffect(() => {
    const q = query();
    const cs = caseSensitive();
    const re = useRegex();
    const ww = wholeWord();
    const code = searchInCode();
    const md = searchInMarkdown();
    const out = searchInOutput();
    const filter = filterCellType();
    void q; void cs; void re; void ww; void code; void md; void out; void filter;
    if (props.isVisible) {
      performSearch();
    }
  });

  // Re-search when cells change
  createEffect(() => {
    const cellList = props.cells;
    void cellList;
    if (props.isVisible && query()) {
      performSearch();
    }
  });

  const buildSearchPattern = (searchQuery: string): RegExp | null => {
    if (!searchQuery) return null;
    
    try {
      let pattern = searchQuery;
      
      if (!useRegex()) {
        pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      
      if (wholeWord()) {
        pattern = `\\b${pattern}\\b`;
      }
      
      const flags = caseSensitive() ? "g" : "gi";
      return new RegExp(pattern, flags);
    } catch {
      return null;
    }
  };

  const getTextContent = (output: NotebookCellOutput): string => {
    if (output.output_type === "error") {
      const parts: string[] = [];
      if (output.ename) parts.push(output.ename);
      if (output.evalue) parts.push(output.evalue);
      if (output.traceback) parts.push(...output.traceback);
      return parts.join("\n");
    }
    
    if (output.output_type === "stream") {
      return Array.isArray(output.text) ? output.text.join("") : output.text || "";
    }
    
    if (output.data) {
      if (output.data["text/plain"]) {
        return Array.isArray(output.data["text/plain"]) 
          ? output.data["text/plain"].join("") 
          : output.data["text/plain"];
      }
      if (output.data["text/html"]) {
        const html = Array.isArray(output.data["text/html"])
          ? output.data["text/html"].join("")
          : output.data["text/html"];
        return html.replace(/<[^>]*>/g, "");
      }
    }
    
    return "";
  };

  const findMatchesInText = (
    text: string,
    regex: RegExp,
    cellId: string,
    cellIndex: number,
    cellType: CellType,
    scope: SearchScope
  ): NotebookSearchMatch[] => {
    const found: NotebookSearchMatch[] = [];
    const lines = text.split("\n");
    let match;
    
    regex.lastIndex = 0;
    
    while ((match = regex.exec(text)) !== null) {
      let lineNum = 1;
      let lineStart = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const lineEnd = lineStart + lines[i].length;
        if (match.index >= lineStart && match.index <= lineEnd) {
          lineNum = i + 1;
          break;
        }
        lineStart = lineEnd + 1;
      }
      
      const contextStart = Math.max(0, match.index - 30);
      const contextEnd = Math.min(text.length, match.index + match[0].length + 30);
      
      found.push({
        cellId,
        cellIndex,
        cellType,
        scope,
        start: match.index,
        end: match.index + match[0].length,
        line: lineNum,
        column: match.index - (lineStart > 0 ? lineStart : 0) + 1,
        text: match[0],
        contextBefore: text.slice(contextStart, match.index),
        contextAfter: text.slice(match.index + match[0].length, contextEnd),
      });
      
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
      
      if (found.length >= 5000) break;
    }
    
    return found;
  };

  const performSearch = () => {
    const q = query();
    setSearchError(null);
    
    if (!q) {
      batch(() => {
        setMatches([]);
        setCellMatches([]);
        setCurrentMatchIndex(0);
      });
      return;
    }

    const regex = buildSearchPattern(q);
    if (!regex) {
      if (useRegex()) {
        setSearchError("Invalid regex");
      }
      batch(() => {
        setMatches([]);
        setCellMatches([]);
        setCurrentMatchIndex(0);
      });
      return;
    }

    const allMatches: NotebookSearchMatch[] = [];
    const cellMatchMap: Map<string, CellMatchInfo> = new Map();
    const filter = filterCellType();
    
    props.cells.forEach((cell, cellIndex) => {
      if (filter !== "all" && cell.cell_type !== filter) return;
      
      const cellMatchList: NotebookSearchMatch[] = [];
      const source = joinSource(cell.source);
      
      if (cell.cell_type === "code" && searchInCode()) {
        const sourceMatches = findMatchesInText(source, regex, cell.id, cellIndex, cell.cell_type, "code");
        cellMatchList.push(...sourceMatches);
      }
      
      if (cell.cell_type === "markdown" && searchInMarkdown()) {
        const sourceMatches = findMatchesInText(source, regex, cell.id, cellIndex, cell.cell_type, "markdown");
        cellMatchList.push(...sourceMatches);
      }
      
      if (cell.cell_type === "raw" && (searchInCode() || searchInMarkdown())) {
        const sourceMatches = findMatchesInText(source, regex, cell.id, cellIndex, cell.cell_type, "code");
        cellMatchList.push(...sourceMatches);
      }
      
      if (searchInOutput() && cell.outputs) {
        cell.outputs.forEach((output) => {
          const outputText = getTextContent(output);
          if (outputText) {
            const outputMatches = findMatchesInText(outputText, regex, cell.id, cellIndex, cell.cell_type, "output");
            cellMatchList.push(...outputMatches);
          }
        });
      }
      
      if (cellMatchList.length > 0) {
        allMatches.push(...cellMatchList);
        cellMatchMap.set(cell.id, {
          cellId: cell.id,
          cellIndex,
          cellType: cell.cell_type,
          matchCount: cellMatchList.length,
          matches: cellMatchList,
        });
      }
    });
    
    batch(() => {
      setMatches(allMatches);
      setCellMatches(Array.from(cellMatchMap.values()));
      if (allMatches.length > 0 && currentMatchIndex() >= allMatches.length) {
        setCurrentMatchIndex(0);
      }
    });
    
    if (allMatches.length > 0) {
      highlightCurrentMatch(allMatches[currentMatchIndex()]);
    }
  };

  const highlightCurrentMatch = (match: NotebookSearchMatch) => {
    props.onNavigateToCell(match.cellId, { line: match.line, column: match.column });
  };

  const goToMatch = (index: number) => {
    const allMatches = matches();
    if (allMatches.length === 0) return;
    
    const safeIndex = ((index % allMatches.length) + allMatches.length) % allMatches.length;
    setCurrentMatchIndex(safeIndex);
    
    const match = allMatches[safeIndex];
    if (match) {
      highlightCurrentMatch(match);
    }
  };

  const nextMatch = () => goToMatch(currentMatchIndex() + 1);
  const prevMatch = () => goToMatch(currentMatchIndex() - 1);

  const replaceOne = () => {
    const allMatches = matches();
    if (allMatches.length === 0) return;
    
    const match = allMatches[currentMatchIndex()];
    if (!match || match.scope === "output") return;
    
    let replacement = replaceText();
    
    if (useRegex()) {
      try {
        const regex = buildSearchPattern(query());
        if (regex) {
          replacement = match.text.replace(regex, replaceText());
        }
      } catch {
        // Fall back to literal replacement
      }
    }
    
    props.onReplaceInCell(match.cellId, match.start, match.end, replacement);
    
    setTimeout(() => {
      performSearch();
      const newMatches = matches();
      if (newMatches.length > 0) {
        const nextIdx = Math.min(currentMatchIndex(), newMatches.length - 1);
        goToMatch(nextIdx);
      }
    }, 10);
  };

  const replaceAll = () => {
    const q = query();
    if (!q) return;
    
    const regex = buildSearchPattern(q);
    if (!regex) return;
    
    const replacement = replaceText();
    const cellsToReplace = new Set<string>();
    
    matches().forEach((match) => {
      if (match.scope !== "output") {
        cellsToReplace.add(match.cellId);
      }
    });
    
    cellsToReplace.forEach((cellId) => {
      props.onReplaceAllInCell(cellId, regex, replacement);
    });
    
    setTimeout(performSearch, 10);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
      return;
    }
    
    if (e.key === "F3") {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
      return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === "h") {
      e.preventDefault();
      setShowReplace(!showReplace());
      if (!showReplace()) {
        setTimeout(() => replaceInputRef?.focus(), 10);
      }
      return;
    }
    
    if (e.altKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setCaseSensitive(!caseSensitive());
      return;
    }
    
    if (e.altKey && e.key.toLowerCase() === "w") {
      e.preventDefault();
      setWholeWord(!wholeWord());
      return;
    }
    
    if (e.altKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      setUseRegex(!useRegex());
      return;
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown, true);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown, true);
  });

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    } else if (e.key === "Tab" && showReplace()) {
      e.preventDefault();
      replaceInputRef?.focus();
    }
  };

  const handleReplaceKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        replaceAll();
      } else {
        replaceOne();
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      inputRef?.focus();
    }
  };

  const ToggleButton = (buttonProps: { 
    active: boolean; 
    onClick: () => void; 
    title: string; 
    children: string;
    shortcut?: string;
  }) => (
    <button
      class="px-2 py-1 text-[11px] rounded-md transition-colors font-medium"
      style={{
        background: buttonProps.active ? "var(--accent-primary)" : "transparent",
        color: buttonProps.active ? "white" : "var(--text-weak)",
      }}
      onClick={buttonProps.onClick}
      title={`${buttonProps.title}${buttonProps.shortcut ? ` (${buttonProps.shortcut})` : ""}`}
    >
      {buttonProps.children}
    </button>
  );

  const matchCountText = () => {
    const m = matches();
    if (searchError()) return searchError();
    if (!query()) return "";
    if (m.length === 0) return "No results";
    return `${currentMatchIndex() + 1} of ${m.length}`;
  };

  const cellMatchSummary = () => {
    const cm = cellMatches();
    if (cm.length === 0) return null;
    return `in ${cm.length} cell${cm.length !== 1 ? "s" : ""}`;
  };

  return (
    <Show when={props.isVisible}>
      <div 
        class="absolute top-2 right-4 z-[90] w-[420px] rounded-lg shadow-xl overflow-hidden"
        style={{ 
          background: "var(--surface-raised)",
          "box-shadow": "0 10px 40px -10px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Search row */}
        <div class="flex items-center gap-2 px-3 py-2 border-b" style={{ "border-color": "var(--border-weak)" }}>
          <div 
            class="flex-1 flex items-center gap-2 px-3 h-[32px] rounded-md"
            style={{ 
              background: "var(--background-base)",
              border: searchError() ? "1px solid var(--status-error)" : "1px solid transparent",
            }}
          >
            <Icon name="magnifying-glass" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search notebook..."
              class="flex-1 bg-transparent outline-none text-[13px] min-w-0"
              style={{ color: "var(--text-base)" }}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleInputKeyDown}
            />
          </div>
          
          <span 
            class="text-[11px] shrink-0 min-w-[70px] text-center font-mono"
            style={{ 
              color: searchError() 
                ? "var(--status-error)" 
                : matches().length > 0 
                  ? "var(--text-base)" 
                  : "var(--text-weak)" 
            }}
          >
            {matchCountText()}
          </span>
          
          <div class="flex items-center gap-0.5">
            <button 
              class="p-1.5 rounded-md hover:bg-white/10 transition-colors disabled:opacity-30"
              onClick={prevMatch}
              disabled={matches().length === 0}
              title="Previous match (Shift+Enter or Shift+F3)"
            >
              <Icon name="chevron-up" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            </button>
            <button 
              class="p-1.5 rounded-md hover:bg-white/10 transition-colors disabled:opacity-30"
              onClick={nextMatch}
              disabled={matches().length === 0}
              title="Next match (Enter or F3)"
            >
              <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            </button>
          </div>
          
          <button 
            class="p-1.5 rounded-md hover:bg-white/10 transition-colors"
            onClick={() => props.onClose()}
            title="Close (Escape)"
          >
            <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </button>
        </div>

        {/* Options row */}
        <div class="flex items-center gap-1 px-3 py-2 border-b" style={{ "border-color": "var(--border-weak)" }}>
          <ToggleButton
            active={caseSensitive()}
            onClick={() => setCaseSensitive(!caseSensitive())}
            title="Case Sensitive"
            shortcut="Alt+C"
          >
            Aa
          </ToggleButton>
          <ToggleButton
            active={wholeWord()}
            onClick={() => setWholeWord(!wholeWord())}
            title="Whole Word"
            shortcut="Alt+W"
          >
            W
          </ToggleButton>
          <ToggleButton
            active={useRegex()}
            onClick={() => setUseRegex(!useRegex())}
            title="Regular Expression"
            shortcut="Alt+R"
          >
            .*
          </ToggleButton>
          
          <div class="w-px h-4 mx-1" style={{ background: "var(--border-weak)" }} />
          
          <button
            class="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors"
            style={{
              background: showFilters() ? "var(--surface-active)" : "transparent",
              color: "var(--text-weak)",
            }}
            onClick={() => setShowFilters(!showFilters())}
            title="Filter options"
          >
            <Icon name="filter" class="w-3 h-3" />
            Filters
          </button>
          
          <div class="flex-1" />
          
          <Show when={cellMatchSummary()}>
            <span class="text-[10px] mr-2" style={{ color: "var(--text-weaker)" }}>
              {cellMatchSummary()}
            </span>
          </Show>
          
          <button
            class="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-md transition-colors"
            style={{
              background: showReplace() ? "var(--surface-active)" : "transparent",
              color: "var(--text-weak)",
            }}
            onClick={() => {
              setShowReplace(!showReplace());
              if (!showReplace()) {
                setTimeout(() => replaceInputRef?.focus(), 10);
              }
            }}
            title="Toggle Replace (Ctrl+H)"
          >
            <Icon name="rotate" class="w-3 h-3" />
            Replace
          </button>
        </div>

        {/* Filters row */}
        <Show when={showFilters()}>
          <div class="flex items-center gap-3 px-3 py-2 border-b" style={{ "border-color": "var(--border-weak)" }}>
            <span class="text-[11px]" style={{ color: "var(--text-weak)" }}>Search in:</span>
            
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={searchInCode()}
                onChange={(e) => setSearchInCode(e.currentTarget.checked)}
                class="w-3 h-3 accent-[var(--accent-primary)]"
              />
              <span class="text-[11px]" style={{ color: "var(--text-base)" }}>Code</span>
            </label>
            
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={searchInMarkdown()}
                onChange={(e) => setSearchInMarkdown(e.currentTarget.checked)}
                class="w-3 h-3 accent-[var(--accent-primary)]"
              />
              <span class="text-[11px]" style={{ color: "var(--text-base)" }}>Markdown</span>
            </label>
            
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={searchInOutput()}
                onChange={(e) => setSearchInOutput(e.currentTarget.checked)}
                class="w-3 h-3 accent-[var(--accent-primary)]"
              />
              <span class="text-[11px]" style={{ color: "var(--text-base)" }}>Output</span>
            </label>
            
            <div class="w-px h-4" style={{ background: "var(--border-weak)" }} />
            
            <span class="text-[11px]" style={{ color: "var(--text-weak)" }}>Cell type:</span>
            <select
              value={filterCellType()}
              onChange={(e) => setFilterCellType(e.currentTarget.value as CellType | "all")}
              class="text-[11px] px-2 py-0.5 rounded outline-none"
              style={{
                background: "var(--background-base)",
                color: "var(--text-base)",
                border: "1px solid var(--border-weak)",
              }}
            >
              <option value="all">All</option>
              <option value="code">Code</option>
              <option value="markdown">Markdown</option>
              <option value="raw">Raw</option>
            </select>
          </div>
        </Show>

        {/* Replace row */}
        <Show when={showReplace()}>
          <div class="flex items-center gap-2 px-3 py-2 border-b" style={{ "border-color": "var(--border-weak)" }}>
            <div 
              class="flex-1 flex items-center gap-2 px-3 h-[32px] rounded-md"
              style={{ background: "var(--background-base)" }}
            >
              <input
                ref={replaceInputRef}
                type="text"
                placeholder="Replace with..."
                class="flex-1 bg-transparent outline-none text-[13px] min-w-0"
                style={{ color: "var(--text-base)" }}
                value={replaceText()}
                onInput={(e) => setReplaceText(e.currentTarget.value)}
                onKeyDown={handleReplaceKeyDown}
              />
            </div>
            <button
              class="px-2.5 py-1.5 text-[11px] rounded-md transition-colors font-medium disabled:opacity-30 hover:bg-white/5"
              style={{ 
                background: "var(--surface-active)", 
                color: "var(--text-base)",
              }}
              onClick={replaceOne}
              disabled={matches().length === 0 || matches()[currentMatchIndex()]?.scope === "output"}
              title="Replace current match (Enter)"
            >
              Replace
            </button>
            <button
              class="px-2.5 py-1.5 text-[11px] rounded-md transition-colors font-medium disabled:opacity-30 hover:bg-white/5"
              style={{ 
                background: "var(--surface-active)", 
                color: "var(--text-base)",
              }}
              onClick={replaceAll}
              disabled={matches().filter((m) => m.scope !== "output").length === 0}
              title="Replace all matches (Ctrl+Enter)"
            >
              All
            </button>
          </div>
        </Show>

        {/* Cell matches list - collapsed view */}
        <Show when={matches().length > 0 && cellMatches().length > 1}>
          <div 
            class="max-h-[200px] overflow-y-auto border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <For each={cellMatches()}>
              {(cellMatch) => {
                const currentMatchInCell = () => {
                  const m = matches()[currentMatchIndex()];
                  return m?.cellId === cellMatch.cellId;
                };
                
                return (
                  <div
                    class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/5 transition-colors"
                    style={{
                      background: currentMatchInCell() ? "var(--surface-active)" : "transparent",
                    }}
                    onClick={() => {
                      const firstMatchInCell = cellMatch.matches[0];
                      if (firstMatchInCell) {
                        const idx = matches().findIndex((m) => m === firstMatchInCell);
                        if (idx >= 0) goToMatch(idx);
                      }
                    }}
                  >
                    <div 
                      class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: "var(--surface-raised)", color: "var(--text-weak)" }}
                    >
<Show when={cellMatch.cellType === "code"}>
                        <Icon name="code" class="w-3 h-3" />
                      </Show>
                      <Show when={cellMatch.cellType === "markdown"}>
                        <Icon name="file-lines" class="w-3 h-3" />
                      </Show>
                      <Show when={cellMatch.cellType === "raw"}>
                        <Icon name="font" class="w-3 h-3" />
                      </Show>
                      <span>Cell {cellMatch.cellIndex + 1}</span>
                    </div>
                    <span 
                      class="text-[11px] font-mono"
                      style={{ color: "var(--accent-primary)" }}
                    >
                      {cellMatch.matchCount} match{cellMatch.matchCount !== 1 ? "es" : ""}
                    </span>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Keyboard hints */}
        <div 
          class="flex items-center justify-between px-3 py-1.5 text-[10px]"
          style={{ 
            background: "var(--background-base)",
            color: "var(--text-weaker)",
          }}
        >
          <span>
            <kbd class="font-mono px-1 rounded" style={{ background: "var(--surface-raised)" }}>Enter</kbd> next
            {" • "}
            <kbd class="font-mono px-1 rounded" style={{ background: "var(--surface-raised)" }}>Shift+Enter</kbd> prev
            {" • "}
            <kbd class="font-mono px-1 rounded" style={{ background: "var(--surface-raised)" }}>F3</kbd>
          </span>
          <span>
            <kbd class="font-mono px-1 rounded" style={{ background: "var(--surface-raised)" }}>Esc</kbd> close
          </span>
        </div>
      </div>

      <style>{`
        @keyframes notebook-search-slide-in {
          from { 
            opacity: 0;
            transform: translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Show>
  );
}

// ============================================================================
// Main NotebookEditor Component
// ============================================================================

export interface NotebookEditorProps {
  content: string;
  filePath?: string;
  onChange?: (content: string) => void;
  onRunCell?: (cellId: string, source: string) => Promise<NotebookCellOutput[]>;
}

export function NotebookEditor(props: NotebookEditorProps) {
  const [cells, setCells] = createSignal<InternalCell[]>([]);
  const [metadata, setMetadata] = createSignal<NotebookMetadata>({});
  const [nbformat, setNbformat] = createSignal(4);
  const [nbformatMinor, setNbformatMinor] = createSignal(5);
  const [activeCellId, setActiveCellId] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [showNotebookSearch, setShowNotebookSearch] = createSignal(false);
  
  let notebookContainerRef: HTMLDivElement | undefined;

  const language = createMemo(() => {
    const meta = metadata();
    return (
      meta.language_info?.name ||
      meta.kernelspec?.language ||
      "python"
    );
  });

  // Parse notebook on mount and when content changes
  createEffect(() => {
    const content = props.content;
    setIsLoading(true);

    const notebook = parseNotebook(content);
    if (notebook) {
      batch(() => {
        setMetadata(notebook.metadata || {});
        setNbformat(notebook.nbformat || 4);
        setNbformatMinor(notebook.nbformat_minor || 5);

        const internalCells: InternalCell[] = notebook.cells.map((cell) => ({
          ...cell,
          id: cell.id || generateCellId(),
          source: Array.isArray(cell.source) ? cell.source : [cell.source],
          status: "idle" as CellStatus,
          isEditing: false,
          isOutputCollapsed: false,
        }));

        setCells(internalCells);

        // Set first cell as active if none selected
        if (internalCells.length > 0 && !activeCellId()) {
          setActiveCellId(internalCells[0].id);
        }
      });
    } else {
      // Create empty notebook with one code cell
      const defaultCell: InternalCell = {
        id: generateCellId(),
        cell_type: "code",
        source: [""],
        metadata: {},
        outputs: [],
        execution_count: null,
        status: "idle",
        isEditing: false,
        isOutputCollapsed: false,
      };
      setCells([defaultCell]);
      setActiveCellId(defaultCell.id);
    }

    setIsLoading(false);
  });

  // Emit changes to parent
  const emitChange = () => {
    if (props.onChange) {
      const content = serializeNotebook(
        cells(),
        metadata(),
        nbformat(),
        nbformatMinor()
      );
      props.onChange(content);
    }
  };

  // Cell operations
  const updateCellSource = (cellId: string, source: string) => {
    setCells((prev) =>
      prev.map((cell) =>
        cell.id === cellId ? { ...cell, source: splitSource(source) } : cell
      )
    );
    emitChange();
  };

  const deleteCell = (cellId: string) => {
    setCells((prev) => {
      const filtered = prev.filter((cell) => cell.id !== cellId);
      // Ensure at least one cell exists
      if (filtered.length === 0) {
        const newCell: InternalCell = {
          id: generateCellId(),
          cell_type: "code",
          source: [""],
          metadata: {},
          outputs: [],
          execution_count: null,
          status: "idle",
          isEditing: false,
          isOutputCollapsed: false,
        };
        return [newCell];
      }
      return filtered;
    });
    emitChange();
  };

  const moveCell = (cellId: string, direction: "up" | "down") => {
    setCells((prev) => {
      const index = prev.findIndex((cell) => cell.id === cellId);
      if (index === -1) return prev;

      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newCells = [...prev];
      const [removed] = newCells.splice(index, 1);
      newCells.splice(newIndex, 0, removed);
      return newCells;
    });
    emitChange();
  };

  const changeCellType = (cellId: string, newType: CellType) => {
    setCells((prev) =>
      prev.map((cell) => {
        if (cell.id !== cellId) return cell;

        const updatedCell: InternalCell = {
          ...cell,
          cell_type: newType,
          isEditing: newType === "markdown" ? cell.isEditing : false,
        };

        // Clear outputs when changing from code to other types
        if (cell.cell_type === "code" && newType !== "code") {
          updatedCell.outputs = undefined;
          updatedCell.execution_count = undefined;
        }

        // Add outputs array when changing to code
        if (cell.cell_type !== "code" && newType === "code") {
          updatedCell.outputs = [];
          updatedCell.execution_count = null;
        }

        return updatedCell;
      })
    );
    emitChange();
  };

  const toggleCellEdit = (cellId: string) => {
    setCells((prev) =>
      prev.map((cell) =>
        cell.id === cellId ? { ...cell, isEditing: !cell.isEditing } : cell
      )
    );
  };

  const toggleOutputCollapse = (cellId: string) => {
    setCells((prev) =>
      prev.map((cell) =>
        cell.id === cellId
          ? { ...cell, isOutputCollapsed: !cell.isOutputCollapsed }
          : cell
      )
    );
  };

  const addCell = (type: CellType, afterCellId?: string) => {
    const newCell: InternalCell = {
      id: generateCellId(),
      cell_type: type,
      source: [""],
      metadata: {},
      ...(type === "code"
        ? { outputs: [], execution_count: null }
        : {}),
      status: "idle",
      isEditing: type === "markdown",
      isOutputCollapsed: false,
    };

    setCells((prev) => {
      if (!afterCellId) {
        return [...prev, newCell];
      }
      const index = prev.findIndex((cell) => cell.id === afterCellId);
      if (index === -1) {
        return [...prev, newCell];
      }
      const newCells = [...prev];
      newCells.splice(index + 1, 0, newCell);
      return newCells;
    });

    setActiveCellId(newCell.id);
    emitChange();
  };

  const runCell = async (cellId: string) => {
    const cell = cells().find((c) => c.id === cellId);
    if (!cell || cell.cell_type !== "code") return;

    // Update status to running
    setCells((prev) =>
      prev.map((c) =>
        c.id === cellId
          ? { ...c, status: "running" as CellStatus, outputs: [] }
          : c
      )
    );

    try {
      if (props.onRunCell) {
        const outputs = await props.onRunCell(cellId, joinSource(cell.source));
        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId
              ? {
                  ...c,
                  status: outputs.some((o) => o.output_type === "error")
                    ? ("error" as CellStatus)
                    : ("success" as CellStatus),
                  outputs,
                  execution_count: (c.execution_count ?? 0) + 1,
                }
              : c
          )
        );
      } else {
        // No execution handler - just mark as success
        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId
              ? {
                  ...c,
                  status: "success" as CellStatus,
                  execution_count: (c.execution_count ?? 0) + 1,
                }
              : c
          )
        );
      }
    } catch (error) {
      // Mark as error
      const errorOutput: NotebookCellOutput = {
        output_type: "error",
        ename: "ExecutionError",
        evalue: error instanceof Error ? error.message : "Unknown error",
        traceback: [],
      };
      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId
            ? {
                ...c,
                status: "error" as CellStatus,
                outputs: [errorOutput],
              }
            : c
        )
      );
    }

    emitChange();
  };

  // Search navigation and replacement handlers
  const navigateToCell = (cellId: string, _position?: { line: number; column: number }) => {
    setActiveCellId(cellId);
    
    // Scroll the cell into view
    setTimeout(() => {
      const cellElement = notebookContainerRef?.querySelector(`[data-cell-id="${cellId}"]`);
      if (cellElement) {
        cellElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 10);
  };

  const replaceInCell = (cellId: string, start: number, end: number, replacement: string) => {
    setCells((prev) =>
      prev.map((cell) => {
        if (cell.id !== cellId) return cell;
        const source = joinSource(cell.source);
        const newSource = source.slice(0, start) + replacement + source.slice(end);
        return { ...cell, source: splitSource(newSource) };
      })
    );
    emitChange();
  };

  const replaceAllInCell = (cellId: string, pattern: RegExp, replacement: string) => {
    setCells((prev) =>
      prev.map((cell) => {
        if (cell.id !== cellId) return cell;
        const source = joinSource(cell.source);
        const newSource = source.replace(pattern, replacement);
        return { ...cell, source: splitSource(newSource) };
      })
    );
    emitChange();
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+F: Open notebook search
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      e.stopPropagation();
      setShowNotebookSearch(true);
      return;
    }

    const activeId = activeCellId();
    if (!activeId) return;

    // Shift+Enter: Run cell and move to next (or create new)
    if (e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      const cellList = cells();
      const currentIndex = cellList.findIndex((c) => c.id === activeId);
      const currentCell = cellList[currentIndex];

      if (currentCell?.cell_type === "code") {
        runCell(activeId);
      }

      // Move to next cell or create new one
      if (currentIndex < cellList.length - 1) {
        setActiveCellId(cellList[currentIndex + 1].id);
      } else {
        addCell("code", activeId);
      }
    }

    // Ctrl/Cmd+Enter: Run cell without moving
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const currentCell = cells().find((c) => c.id === activeId);
      if (currentCell?.cell_type === "code") {
        runCell(activeId);
      }
    }

    // A: Add cell above (when not editing)
    if (e.key === "a" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.closest(".monaco-editor")) return;

      e.preventDefault();
      const cellList = cells();
      const currentIndex = cellList.findIndex((c) => c.id === activeId);
      if (currentIndex > 0) {
        addCell("code", cellList[currentIndex - 1].id);
      } else {
        // Add at the beginning
        const newCell: InternalCell = {
          id: generateCellId(),
          cell_type: "code",
          source: [""],
          metadata: {},
          outputs: [],
          execution_count: null,
          status: "idle",
          isEditing: false,
          isOutputCollapsed: false,
        };
        setCells((prev) => [newCell, ...prev]);
        setActiveCellId(newCell.id);
        emitChange();
      }
    }

    // B: Add cell below (when not editing)
    if (e.key === "b" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.closest(".monaco-editor")) return;

      e.preventDefault();
      addCell("code", activeId);
    }

    // DD: Delete cell (double D) - simplified to single press for now
    if (e.key === "d" && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      deleteCell(activeId);
    }

    // Arrow keys for navigation (when not editing)
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.shiftKey) {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.closest(".monaco-editor")) return;

      e.preventDefault();
      const cellList = cells();
      const currentIndex = cellList.findIndex((c) => c.id === activeId);

      if (e.key === "ArrowUp" && currentIndex > 0) {
        setActiveCellId(cellList[currentIndex - 1].id);
      } else if (e.key === "ArrowDown" && currentIndex < cellList.length - 1) {
        setActiveCellId(cellList[currentIndex + 1].id);
      }
    }

    // M: Convert to markdown
    if (e.key === "m" && !e.ctrlKey && !e.metaKey) {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.closest(".monaco-editor")) return;

      e.preventDefault();
      changeCellType(activeId, "markdown");
    }

    // Y: Convert to code
    if (e.key === "y" && !e.ctrlKey && !e.metaKey) {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.closest(".monaco-editor")) return;

      e.preventDefault();
      changeCellType(activeId, "code");
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div
      ref={notebookContainerRef}
      class="notebook-editor flex flex-col h-full overflow-hidden relative"
      style={{ background: "var(--background-base)" }}
    >
      {/* Notebook Search */}
      <NotebookSearch
        isVisible={showNotebookSearch()}
        onClose={() => setShowNotebookSearch(false)}
        cells={cells()}
        onNavigateToCell={navigateToCell}
        onReplaceInCell={replaceInCell}
        onReplaceAllInCell={replaceAllInCell}
      />

      {/* Notebook header */}
      <div
        class="notebook-header flex items-center gap-4 px-4 py-2 shrink-0"
        style={{
          background: "var(--surface-base)",
          "border-bottom": "1px solid var(--border-base)",
        }}
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
            {props.filePath?.split(/[\\/]/).pop() || "Untitled.ipynb"}
          </span>
        </div>

        <div
          class="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
          style={{
            background: "var(--surface-raised)",
            color: "var(--text-weak)",
          }}
        >
<Icon name="code" class="w-3 h-3" />
          <span>{language()}</span>
        </div>

        <div class="flex-1" />

        <div class="text-xs" style={{ color: "var(--text-weak)" }}>
          {cells().length} cell{cells().length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Notebook cells */}
      <div class="notebook-cells flex-1 overflow-auto p-4">
        <Show
          when={!isLoading()}
          fallback={
            <div class="flex items-center justify-center h-32">
<Icon
                name="spinner"
                class="w-6 h-6 animate-spin"
                style={{ color: "var(--text-weak)" }}
              />
            </div>
          }
        >
          <For each={cells()}>
            {(cell, index) => (
              <>
                <NotebookCellComponent
                  cell={cell}
                  index={index()}
                  totalCells={cells().length}
                  language={language()}
                  isActive={activeCellId() === cell.id}
                  onUpdateSource={(source) => updateCellSource(cell.id, source)}
                  onRun={() => runCell(cell.id)}
                  onDelete={() => deleteCell(cell.id)}
                  onMoveUp={() => moveCell(cell.id, "up")}
                  onMoveDown={() => moveCell(cell.id, "down")}
                  onChangeCellType={(type) => changeCellType(cell.id, type)}
                  onToggleEdit={() => toggleCellEdit(cell.id)}
                  onToggleOutputCollapse={() => toggleOutputCollapse(cell.id)}
                  onFocus={() => setActiveCellId(cell.id)}
                />

                {/* Add cell button between cells */}
                <Show when={index() < cells().length - 1}>
                  <AddCellButton
                    onAddCode={() => addCell("code", cell.id)}
                    onAddMarkdown={() => addCell("markdown", cell.id)}
                  />
                </Show>
              </>
            )}
          </For>

          {/* Add cell button at the end */}
          <AddCellButton
            onAddCode={() => addCell("code")}
            onAddMarkdown={() => addCell("markdown")}
          />
        </Show>
      </div>

      {/* Keyboard shortcuts help */}
      <div
        class="notebook-footer flex items-center gap-4 px-4 py-1 shrink-0 text-xs"
        style={{
          background: "var(--surface-base)",
          "border-top": "1px solid var(--border-base)",
          color: "var(--text-weaker)",
        }}
      >
        <span>
          <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-raised)" }}>
            Shift+Enter
          </kbd>{" "}
          Run &amp; advance
        </span>
        <span>
          <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-raised)" }}>
            Ctrl+Enter
          </kbd>{" "}
          Run
        </span>
        <span>
          <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-raised)" }}>
            Ctrl+F
          </kbd>{" "}
          Search
        </span>
        <span>
          <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-raised)" }}>
            A
          </kbd>{" "}
          /{" "}
          <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-raised)" }}>
            B
          </kbd>{" "}
          Add above/below
        </span>
        <span>
          <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-raised)" }}>
            M
          </kbd>{" "}
          /{" "}
          <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--surface-raised)" }}>
            Y
          </kbd>{" "}
          Markdown/Code
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Utility Functions for External Use
// ============================================================================

export function isNotebookFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".ipynb");
}

export function createEmptyNotebook(language: string = "python"): string {
  const notebook: JupyterNotebook = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: language.charAt(0).toUpperCase() + language.slice(1),
        language: language,
        name: language,
      },
      language_info: {
        name: language,
      },
    },
    cells: [
      {
        id: generateCellId(),
        cell_type: "code",
        source: [],
        metadata: {},
        outputs: [],
        execution_count: null,
      },
    ],
  };

  return JSON.stringify(notebook, null, 1);
}


import { Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { MonacoManager } from "@/utils/monacoManager";
import type * as Monaco from "monaco-editor";

export type CellStatus = "idle" | "running" | "success" | "error";

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

let monacoInstance: typeof Monaco | null = null;

async function initMonaco(): Promise<typeof Monaco> {
  if (monacoInstance) return monacoInstance;

  const monaco = await MonacoManager.getInstance().ensureLoaded();
  monacoInstance = monaco;

  monaco.editor.defineTheme("notebook-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a9955", fontStyle: "italic" },
      { token: "keyword", foreground: "c586c0" },
      { token: "string", foreground: "ce9178" },
      { token: "number", foreground: "b5cea8" },
      { token: "function", foreground: "dcdcaa" },
      { token: "variable", foreground: "9cdcfe" },
      { token: "type", foreground: "4ec9b0" },
    ],
    colors: {
      "editor.background": "var(--ui-panel-bg)",
      "editor.foreground": "var(--cortex-text-primary)",
      "editor.lineHighlightBackground": "var(--cortex-bg-hover)",
      "editor.selectionBackground": "var(--cortex-info-bg)",
      "editorCursor.foreground": "var(--cortex-text-secondary)",
      "editorLineNumber.foreground": "var(--cortex-bg-active)",
      "editorLineNumber.activeForeground": "var(--cortex-text-primary)",
    },
  });

  return monaco;
}

export interface CellStatusIndicatorProps {
  status: CellStatus;
  executionCount: number | null | undefined;
}

export function CellStatusIndicator(props: CellStatusIndicatorProps) {
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
    if (props.status === "running") return "[*]";
    if (props.executionCount != null) return `[${props.executionCount}]`;
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

export interface CodeCellProps {
  source: string;
  language: string;
  onChange: (value: string) => void;
  onRun: () => void;
  isFocused: boolean;
  onFocus: () => void;
}

export function CodeCell(props: CodeCellProps) {
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

    editorInstance.onDidChangeModelContent(() => {
      if (editorInstance) {
        props.onChange(editorInstance.getValue());
      }
    });

    editorInstance.addCommand(
      monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      () => props.onRun()
    );

    editorInstance.onDidFocusEditorText(() => props.onFocus());

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

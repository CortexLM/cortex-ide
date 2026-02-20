import { createSignal, createEffect, createMemo, Show, onMount, onCleanup } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";

export function GoToLineDialog() {
  const { showGoToLine, setShowGoToLine } = useCommands();
  const { state } = useEditor();
  const [input, setInput] = createSignal("");
  const [error, setError] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  const activeFile = createMemo(() => state.openFiles.find((f) => f.id === state.activeFileId));

  const totalLines = createMemo(() => {
    const file = activeFile();
    if (!file) return 0;
    return file.content.split("\n").length;
  });

  createEffect(() => {
    if (showGoToLine()) {
      setInput("");
      setError("");
      setTimeout(() => inputRef?.focus(), 10);
    }
  });

  const parseInput = (): { line: number; column: number } | null => {
    const value = input().trim();
    if (!value) return null;

    const match = value.match(/^(\d*):?(\d*)$/);
    if (!match) {
      setError("Invalid format. Use: line, line:column, or :column");
      return null;
    }

    const line = match[1] ? parseInt(match[1], 10) : 1;
    const column = match[2] ? parseInt(match[2], 10) : 1;

    const maxLines = totalLines();
    if (line > maxLines) {
      setError(`Line ${line} exceeds max (${maxLines})`);
      return null;
    }

    setError("");
    return { line: Math.max(1, line), column: Math.max(1, column) };
  };

  createEffect(() => {
    if (input()) {
      parseInput();
    } else {
      setError("");
    }
  });

  const isValid = () => {
    const value = input().trim();
    if (!value) return false;
    return parseInput() !== null;
  };

  const previewLine = createMemo(() => {
    const parsed = parseInput();
    if (!parsed) return null;
    const file = activeFile();
    if (!file) return null;
    const lines = file.content.split("\n");
    const content = lines[parsed.line - 1];
    if (content === undefined) return null;
    return { lineNumber: parsed.line, content };
  });

  const handleSubmit = () => {
    const parsed = parseInput();
    if (!parsed) return;

    window.dispatchEvent(new CustomEvent("editor:goto-line", {
      detail: { line: parsed.line, column: parsed.column }
    }));

    setShowGoToLine(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowGoToLine(false);
    }
  };

  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && showGoToLine()) {
      e.preventDefault();
      setShowGoToLine(false);
    }
  };

  const handleGotoLineEvent = () => {
    setShowGoToLine(true);
  };

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("goto:line", handleGotoLineEvent);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown);
    window.removeEventListener("goto:line", handleGotoLineEvent);
  });

  return (
    <Show when={showGoToLine() && activeFile()}>
      <div
        class="fixed inset-x-0 top-0 z-[100] flex justify-center"
        style={{ "padding-top": "0" }}
      >
        <div
          class="w-full max-w-[400px] overflow-hidden"
          style={{
            background: "var(--ui-panel-bg)",
            "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.4)",
            border: "1px solid var(--jb-border-default)",
            "border-top": "none",
            "border-radius": "0 0 var(--cortex-radius-md) var(--cortex-radius-md)",
          }}
        >
          <div class="flex items-center gap-2 px-3 py-2">
            <span
              class="text-[12px] flex-shrink-0"
              style={{ color: "var(--jb-text-muted-color)" }}
            >
              Go to Line
            </span>
            <input
              ref={inputRef}
              type="text"
              placeholder={`line[:column] (1–${totalLines()})`}
              class="flex-1 bg-transparent outline-none text-[13px]"
              style={{
                color: "var(--jb-text-body-color)",
                background: "var(--jb-canvas)",
                padding: "4px 8px",
                "border-radius": "var(--cortex-radius-sm)",
                border: error()
                  ? "1px solid var(--cortex-error)"
                  : "1px solid var(--jb-border-default)",
              }}
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              class="px-2 py-1 text-[12px] rounded transition-colors"
              style={{
                background: isValid() ? "var(--jb-border-focus)" : "var(--jb-canvas)",
                color: isValid() ? "white" : "var(--jb-text-muted-color)",
                cursor: isValid() ? "pointer" : "not-allowed",
              }}
              onClick={handleSubmit}
              disabled={!isValid()}
            >
              Go
            </button>
          </div>

          <Show when={error()}>
            <p
              class="px-3 pb-2 text-[11px]"
              style={{ color: "var(--cortex-error)" }}
            >
              {error()}
            </p>
          </Show>

          <Show when={previewLine()}>
            <div
              class="mx-3 mb-2 flex overflow-hidden"
              style={{
                background: "var(--jb-canvas)",
                border: "1px solid var(--jb-border-default)",
                "border-radius": "var(--cortex-radius-sm)",
              }}
            >
              <div
                class="flex-shrink-0 px-2 py-1 text-right select-none"
                style={{
                  color: "var(--jb-text-muted-color)",
                  "font-family": "'SF Mono', 'JetBrains Mono', monospace",
                  "font-size": "11px",
                  "min-width": "36px",
                  "border-right": "1px solid var(--jb-border-default)",
                  background: "rgba(255, 255, 255, 0.02)",
                }}
              >
                {previewLine()!.lineNumber}
              </div>
              <pre
                class="flex-1 px-2 py-1 overflow-x-auto"
                style={{
                  color: "var(--jb-text-body-color)",
                  "font-family": "'SF Mono', 'JetBrains Mono', monospace",
                  "font-size": "11px",
                  margin: "0",
                  "white-space": "pre",
                  "max-height": "40px",
                }}
              >
                {previewLine()!.content || " "}
              </pre>
            </div>
          </Show>

          <div
            class="flex items-center gap-3 px-3 py-1.5 text-[10px]"
            style={{
              color: "var(--jb-text-muted-color)",
              "border-top": "1px solid var(--jb-border-default)",
              background: "var(--jb-canvas)",
            }}
          >
            <span>
              <kbd class="font-mono px-1 py-0.5 rounded" style={{ background: "var(--ui-panel-bg)" }}>Enter</kbd> go
            </span>
            <span>
              <kbd class="font-mono px-1 py-0.5 rounded" style={{ background: "var(--ui-panel-bg)" }}>Esc</kbd> close
            </span>
            <span class="ml-auto font-mono">42 · 42:10 · :5</span>
          </div>
        </div>
      </div>
    </Show>
  );
}

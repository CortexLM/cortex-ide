import { Show, For, createSignal } from "solid-js";
import { useDebug } from "@/context/DebugContext";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../ui/Icon";

interface CompletionItem {
  label: string;
  text?: string;
  sortText?: string;
  detail?: string;
  type?: string;
  start?: number;
  length?: number;
}

export interface ConsoleInputProps {
  onSubmit: (expression: string) => void;
  onClear: () => void;
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function ConsoleInput(props: ConsoleInputProps) {
  const debug = useDebug();
  const [input, setInput] = createSignal("");
  const [history, setHistory] = createSignal<string[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(-1);
  const [completions, setCompletions] = createSignal<CompletionItem[]>([]);
  const [selectedCompletion, setSelectedCompletion] = createSignal(0);
  const [showCompletions, setShowCompletions] = createSignal(false);
  const [isMultiline, setIsMultiline] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;

  const fetchCompletions = async (text: string, column: number) => {
    if (!debug.state.activeSessionId || !debug.state.isPaused) {
      setCompletions([]); setShowCompletions(false); return;
    }
    try {
      const items = await invoke<CompletionItem[]>("debug_completions", {
        sessionId: debug.state.activeSessionId,
        text, column, line: null,
      });
      setCompletions(items);
      setSelectedCompletion(0);
      setShowCompletions(items.length > 0);
    } catch {
      setCompletions([]); setShowCompletions(false);
    }
  };

  const debouncedFetch = debounce((text: string, col: number) => {
    fetchCompletions(text, col);
  }, 150);

  const applyCompletion = (item: CompletionItem) => {
    const currentInput = input();
    const textToInsert = item.text || item.label;
    const lines = currentInput.split("\n");
    const lastLine = lines[lines.length - 1];
    const pos = lastLine.length;

    let start = item.start ?? 0;
    let length = item.length ?? pos - start;
    if (item.start === undefined) {
      let wordStart = pos;
      while (wordStart > 0 && /[a-zA-Z0-9_.]/.test(lastLine[wordStart - 1])) wordStart--;
      start = wordStart;
      length = pos - wordStart;
    }

    lines[lines.length - 1] = lastLine.slice(0, start) + textToInsert + lastLine.slice(start + length);
    setInput(lines.join("\n"));
    setShowCompletions(false);
    setCompletions([]);
    textareaRef?.focus();
  };

  const getTypeIcon = (type?: string): string => {
    switch (type?.toLowerCase()) {
      case "method": case "function": return "ƒ";
      case "variable": return "𝑥";
      case "property": case "field": return "•";
      case "class": return "◆";
      case "module": return "□";
      case "keyword": return "⌘";
      default: return "·";
    }
  };

  const getTypeColor = (type?: string): string => {
    switch (type?.toLowerCase()) {
      case "method": case "function": return "var(--cortex-info)";
      case "variable": return "var(--cortex-info)";
      case "property": case "field": return "var(--cortex-success)";
      case "class": return "var(--cortex-warning)";
      case "keyword": return "var(--cortex-error)";
      default: return "var(--text-weak)";
    }
  };

  const handleSubmit = () => {
    const expr = input().trim();
    if (!expr) return;
    setShowCompletions(false);
    setCompletions([]);

    if (expr === "clear") {
      props.onClear();
      setInput("");
      setHistoryIndex(-1);
      return;
    }

    setHistory((h) => [...h, expr]);
    setHistoryIndex(-1);
    setInput("");
    setIsMultiline(false);
    props.onSubmit(expr);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = completions();
    const showing = showCompletions();

    if (showing && items.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedCompletion((i) => Math.min(i + 1, items.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedCompletion((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) { e.preventDefault(); applyCompletion(items[selectedCompletion()]); return; }
      if (e.key === "Escape") { e.preventDefault(); setShowCompletions(false); return; }
    }

    if ((e.key === "Tab" || (e.ctrlKey && e.key === " ")) && !showing) {
      e.preventDefault();
      const lines = input().split("\n");
      const lastLine = lines[lines.length - 1];
      fetchCompletions(lastLine, lastLine.length + 1);
      return;
    }

    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      setInput((v) => v + "\n");
      setIsMultiline(true);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); return; }

    if (e.key === "ArrowUp" && !isMultiline()) {
      e.preventDefault();
      const h = history();
      if (h.length > 0) {
        const newIndex = historyIndex() < h.length - 1 ? historyIndex() + 1 : historyIndex();
        setHistoryIndex(newIndex);
        setInput(h[h.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown" && !isMultiline()) {
      e.preventDefault();
      if (historyIndex() > 0) {
        const newIndex = historyIndex() - 1;
        setHistoryIndex(newIndex);
        setInput(history()[history().length - 1 - newIndex] || "");
      } else if (historyIndex() === 0) {
        setHistoryIndex(-1); setInput("");
      }
    } else if (e.key === "Escape") {
      setShowCompletions(false);
    }
  };

  const handleInput = (e: Event) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    const value = target.value;
    setInput(value);
    setHistoryIndex(-1);
    setIsMultiline(value.includes("\n"));

    const lines = value.split("\n");
    const lastLine = lines[lines.length - 1];
    if (lastLine.length > 0 && debug.state.isPaused) {
      debouncedFetch(lastLine, lastLine.length + 1);
    } else {
      setShowCompletions(false);
    }
  };

  return (
    <div class="shrink-0 relative" style={{ "border-color": "var(--border-weak)" }}>
      <Show when={showCompletions() && completions().length > 0}>
        <div class="absolute bottom-full left-0 right-0 max-h-48 overflow-auto border rounded-t shadow-lg z-50" style={{ background: "var(--surface-raised)", "border-color": "var(--border-weak)" }}>
          <For each={completions()}>
            {(item, index) => (
              <div class="flex items-center gap-2 px-2 py-1 cursor-pointer text-xs font-mono" style={{ background: index() === selectedCompletion() ? "var(--surface-hover)" : "transparent" }} onClick={() => applyCompletion(item)} onMouseEnter={() => setSelectedCompletion(index())}>
                <span class="w-4 text-center shrink-0" style={{ color: getTypeColor(item.type) }}>{getTypeIcon(item.type)}</span>
                <span class="flex-1 truncate" style={{ color: "var(--text-base)" }}>{item.label}</span>
                <Show when={item.detail}>
                  <span class="shrink-0 truncate max-w-[150px]" style={{ color: "var(--text-weak)" }}>{item.detail}</span>
                </Show>
                <Show when={item.type}>
                  <span class="shrink-0 text-[10px] px-1 rounded" style={{ background: `${getTypeColor(item.type)}20`, color: getTypeColor(item.type) }}>{item.type}</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <div class="flex items-start gap-2 px-2 py-1.5 border-t" style={{ "border-color": "var(--border-weak)" }}>
        <span class="text-xs mt-0.5" style={{ color: "var(--cortex-info)" }}>{">"}</span>
        <textarea
          ref={textareaRef}
          value={input()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={debug.state.isPaused ? "Evaluate expression... (Shift+Enter for newline)" : "Paused to evaluate"}
          disabled={!debug.state.isPaused}
          class="flex-1 bg-transparent text-xs outline-none resize-none font-mono"
          style={{ color: "var(--text-base)", opacity: debug.state.isPaused ? 1 : 0.5, "min-height": "20px", height: isMultiline() ? "auto" : "20px" }}
          rows={isMultiline() ? Math.min(input().split("\n").length, 8) : 1}
        />
        <button onClick={handleSubmit} disabled={!debug.state.isPaused || !input().trim()} class="p-1 rounded transition-colors disabled:opacity-30 mt-0.5" style={{ color: "var(--text-weak)" }} title="Evaluate (Enter)">
          <Icon name="paper-plane" size="xs" />
        </button>
      </div>
    </div>
  );
}

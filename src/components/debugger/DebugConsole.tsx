import { Show, For, createSignal, createEffect, createMemo } from "solid-js";
import { useDebug } from "@/context/DebugContext";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../ui/Icon";
import { LinkifiedOutput } from "./LinkifiedOutput";
import { open } from "@tauri-apps/plugin-shell";

// Completion item type matching the Rust CompletionItem
interface CompletionItem {
  label: string;
  text?: string;
  sortText?: string;
  detail?: string;
  type?: string;
  start?: number;
  length?: number;
}

// Debounce utility
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function DebugConsole() {
  const debug = useDebug();
  const [input, setInput] = createSignal("");
  const [history, setHistory] = createSignal<string[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(-1);
  const [completions, setCompletions] = createSignal<CompletionItem[]>([]);
  const [selectedCompletionIndex, setSelectedCompletionIndex] = createSignal(0);
  const [showCompletions, setShowCompletions] = createSignal(false);
  const [cursorPosition, setCursorPosition] = createSignal(0);
  const [filterText, setFilterText] = createSignal("");
  const [showStdout, setShowStdout] = createSignal(true);
  const [showStderr, setShowStderr] = createSignal(true);
  const [showConsole, setShowConsole] = createSignal(true);
  let outputRef: HTMLDivElement | undefined;
  let inputRef: HTMLTextAreaElement | undefined;

  // Filtered output based on category and text filters
  const filteredOutput = createMemo(() => {
    return debug.state.output.filter(entry => {
      // Category filter
      if (entry.category === 'stdout' && !showStdout()) return false;
      if (entry.category === 'stderr' && !showStderr()) return false;
      if (entry.category === 'console' && !showConsole()) return false;
      
      // Text filter
      const filter = filterText().toLowerCase();
      if (filter && !entry.output.toLowerCase().includes(filter)) return false;
      
      return true;
    });
  });

  // Auto-scroll to bottom when new output is added
  createEffect(() => {
    // Access output.length to trigger reactivity
    void debug.state.output.length;
    if (outputRef) {
      outputRef.scrollTop = outputRef.scrollHeight;
    }
  });

  // Fetch completions from the debug adapter
  const fetchCompletions = async (text: string, column: number) => {
    if (!debug.state.activeSessionId || !debug.state.isPaused) {
      setCompletions([]);
      setShowCompletions(false);
      return;
    }

    try {
      const items = await invoke<CompletionItem[]>("debug_completions", {
        sessionId: debug.state.activeSessionId,
        text,
        column,
        line: null,
      });
      setCompletions(items);
      setSelectedCompletionIndex(0);
      setShowCompletions(items.length > 0);
    } catch (e) {
      console.error("Failed to fetch completions:", e);
      setCompletions([]);
      setShowCompletions(false);
    }
  };

  // Debounced version of fetchCompletions
  const debouncedFetchCompletions = debounce((text: string, column: number) => {
    fetchCompletions(text, column);
  }, 150);

  // Apply selected completion
  const applyCompletion = (item: CompletionItem) => {
    const currentInput = input();
    const textToInsert = item.text || item.label;
    const pos = cursorPosition();
    
    // Use start/length if provided, otherwise replace from word start
    let start = item.start ?? 0;
    let length = item.length ?? pos - start;
    
    // If start is not provided, find the word start
    if (item.start === undefined) {
      // Find the start of the current word
      let wordStart = pos;
      while (wordStart > 0 && /[a-zA-Z0-9_.]/.test(currentInput[wordStart - 1])) {
        wordStart--;
      }
      start = wordStart;
      length = pos - wordStart;
    }
    
    const newInput = currentInput.slice(0, start) + textToInsert + currentInput.slice(start + length);
    setInput(newInput);
    setShowCompletions(false);
    setCompletions([]);
    
    // Set cursor position after the inserted text
    const newCursorPos = start + textToInsert.length;
    setCursorPosition(newCursorPos);
    
    // Focus and set cursor position in the input
    if (inputRef) {
      inputRef.focus();
      setTimeout(() => {
        if (inputRef) {
          inputRef.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // Get icon for completion type
  const getCompletionTypeIcon = (type?: string): string => {
    switch (type?.toLowerCase()) {
      case "method":
      case "function":
        return "ƒ";
      case "variable":
        return "𝑥";
      case "property":
      case "field":
        return "•";
      case "class":
        return "◆";
      case "module":
        return "□";
      case "keyword":
        return "⌘";
      case "value":
        return "=";
      default:
        return "·";
    }
  };

  // Get color for completion type
  const getCompletionTypeColor = (type?: string): string => {
    switch (type?.toLowerCase()) {
      case "method":
      case "function":
        return "var(--cortex-info)"; // Purple
      case "variable":
        return "var(--cortex-info)"; // Blue
      case "property":
      case "field":
        return "var(--cortex-success)"; // Green
      case "class":
        return "var(--cortex-warning)"; // Yellow
      case "keyword":
        return "var(--cortex-error)"; // Pink
      default:
        return "var(--text-weak)";
    }
  };

  const handleSubmit = async () => {
    const expr = input().trim();
    if (!expr) return;

    // Hide completions
    setShowCompletions(false);
    setCompletions([]);

    // Add to history
    setHistory((h) => [...h, expr]);
    setHistoryIndex(-1);
    setInput("");

    try {
      await debug.evaluate(expr);
      // Result will be shown via output event
    } catch (e) {
      console.error("Evaluate failed:", e);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = completions();
    const showing = showCompletions();

    // Handle completion navigation
    if (showing && items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCompletionIndex((i) => Math.min(i + 1, items.length - 1));
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCompletionIndex((i) => Math.max(i - 1, 0));
        return;
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        applyCompletion(items[selectedCompletionIndex()]);
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowCompletions(false);
        setCompletions([]);
        return;
      }
    }

    // Normal handling when completions not shown
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const h = history();
      if (h.length > 0) {
        const newIndex = historyIndex() < h.length - 1 ? historyIndex() + 1 : historyIndex();
        setHistoryIndex(newIndex);
        setInput(h[h.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const h = history();
      if (historyIndex() > 0) {
        const newIndex = historyIndex() - 1;
        setHistoryIndex(newIndex);
        setInput(h[h.length - 1 - newIndex] || "");
      } else if (historyIndex() === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    } else if (e.key === "Escape") {
      setShowCompletions(false);
      setCompletions([]);
    }
  };

  // Handle input changes and trigger completion fetch
  const handleInput = (e: Event) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    const value = target.value;
    const pos = target.selectionStart ?? value.length;
    
    setInput(value);
    setCursorPosition(pos);
    setHistoryIndex(-1);
    
    // Trigger completion fetch if there's input and we're paused
    if (value.length > 0 && debug.state.isPaused) {
      debouncedFetchCompletions(value, pos + 1); // DAP column is 1-based
    } else {
      setShowCompletions(false);
      setCompletions([]);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "stdout":
        return "var(--text-base)";
      case "stderr":
        return "var(--cortex-error)";
      case "console":
        return "var(--cortex-info)";
      case "important":
        return "var(--cortex-warning)";
      default:
        return "var(--text-weak)";
    }
  };

  const formatOutput = (output: string) => {
    // Remove trailing newline for display
    return output.replace(/\n$/, "");
  };

  /**
   * Handles clicking on a file link in the output.
   * Opens the file in the editor at the specified line and column.
   */
  const handleFileClick = (path: string, line?: number, column?: number) => {
    // Dispatch event to open file in editor
    window.dispatchEvent(new CustomEvent("editor:goto", {
      detail: {
        path,
        line: line ?? 1,
        column: column ?? 1,
        focus: true,
      }
    }));
  };

  /**
   * Handles clicking on a URL link in the output.
   * Opens the URL in the default browser.
   */
  const handleUrlClick = async (url: string) => {
    try {
      await open(url);
    } catch (e) {
      console.error("Failed to open URL:", e);
    }
  };

  return (
    <div class="h-full flex flex-col">
      {/* Toolbar */}
      <div
        class="shrink-0 flex items-center justify-between px-2 py-1 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-weak)" }}>
          <Icon name="terminal" size="xs" />
          Debug Console
        </div>
        <button
          onClick={() => debug.clearOutput()}
          class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
          style={{ color: "var(--text-weak)" }}
          title="Clear console"
        >
          <Icon name="trash" size="xs" />
        </button>
      </div>

      {/* Filter row */}
      <div
        class="shrink-0 flex items-center gap-2 px-2 py-1 border-b"
        style={{ "border-color": "var(--border-weak)", background: "var(--surface-base)" }}
      >
        <input
          type="text"
          placeholder="Filter output..."
          value={filterText()}
          onInput={(e) => setFilterText((e.target as HTMLInputElement).value)}
          class="flex-1 bg-transparent text-xs outline-none px-2 py-0.5 rounded border"
          style={{
            color: "var(--text-base)",
            "border-color": "var(--border-weak)",
            background: "var(--background-stronger)",
          }}
        />
        <div class="flex items-center gap-3 text-xs" style={{ color: "var(--text-weak)" }}>
          <label class="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showStdout()}
              onChange={() => setShowStdout(!showStdout())}
              class="w-3 h-3"
            />
            <span style={{ color: "var(--text-base)" }}>stdout</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showStderr()}
              onChange={() => setShowStderr(!showStderr())}
              class="w-3 h-3"
            />
            <span style={{ color: "var(--cortex-error)" }}>stderr</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showConsole()}
              onChange={() => setShowConsole(!showConsole())}
              class="w-3 h-3"
            />
            <span style={{ color: "var(--cortex-info)" }}>console</span>
          </label>
        </div>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        class="flex-1 overflow-auto p-2 font-mono text-xs"
        style={{ background: "var(--background-stronger)" }}
      >
        <Show
          when={filteredOutput().length > 0}
          fallback={
            <div class="text-center py-4" style={{ color: "var(--text-weak)" }}>
              {debug.state.output.length > 0 ? "No matching output" : "Debug output will appear here"}
            </div>
          }
        >
          <For each={filteredOutput()}>
            {(msg) => (
              <div class="flex items-start gap-2 py-0.5">
                {/* Timestamp */}
                <span class="shrink-0 opacity-50" style={{ color: "var(--text-weak)" }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>

                {/* Category badge */}
                <span
                  class="shrink-0 text-[10px] px-1 rounded"
                  style={{
                    background: `${getCategoryColor(msg.category)}20`,
                    color: getCategoryColor(msg.category),
                  }}
                >
                  {msg.category}
                </span>

                {/* Output text with ANSI colors and link detection */}
                <pre
                  class="flex-1 whitespace-pre-wrap break-words"
                  style={{ color: getCategoryColor(msg.category) }}
                >
                  <LinkifiedOutput
                    text={formatOutput(msg.output)}
                    color={getCategoryColor(msg.category)}
                    onFileClick={handleFileClick}
                    onUrlClick={handleUrlClick}
                  />
                </pre>

                {/* Source location */}
                <Show when={msg.source}>
                  <span class="shrink-0 opacity-50" style={{ color: "var(--text-weak)" }}>
                    {msg.source?.split(/[/\\]/).pop()}
                    {msg.line && `:${msg.line}`}
                  </span>
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Input area */}
      <div
        class="shrink-0 relative"
        style={{ "border-color": "var(--border-weak)" }}
      >
        {/* Completion popup */}
        <Show when={showCompletions() && completions().length > 0}>
          <div
            class="absolute bottom-full left-0 right-0 max-h-48 overflow-auto border rounded-t shadow-lg z-50"
            style={{
              background: "var(--surface-raised)",
              "border-color": "var(--border-weak)",
            }}
          >
            <For each={completions()}>
              {(item, index) => (
                <div
                  class="flex items-center gap-2 px-2 py-1 cursor-pointer text-xs font-mono"
                  style={{
                    background: index() === selectedCompletionIndex() 
                      ? "var(--surface-hover)" 
                      : "transparent",
                  }}
                  onClick={() => applyCompletion(item)}
                  onMouseEnter={() => setSelectedCompletionIndex(index())}
                >
                  {/* Type icon */}
                  <span
                    class="w-4 text-center shrink-0"
                    style={{ color: getCompletionTypeColor(item.type) }}
                  >
                    {getCompletionTypeIcon(item.type)}
                  </span>
                  {/* Label */}
                  <span
                    class="flex-1 truncate"
                    style={{ color: "var(--text-base)" }}
                  >
                    {item.label}
                  </span>
                  {/* Detail */}
                  <Show when={item.detail}>
                    <span
                      class="shrink-0 truncate max-w-[150px]"
                      style={{ color: "var(--text-weak)" }}
                    >
                      {item.detail}
                    </span>
                  </Show>
                  {/* Type badge */}
                  <Show when={item.type}>
                    <span
                      class="shrink-0 text-[10px] px-1 rounded"
                      style={{
                        background: `${getCompletionTypeColor(item.type)}20`,
                        color: getCompletionTypeColor(item.type),
                      }}
                    >
                      {item.type}
                    </span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
        
        {/* Input row */}
        <div
          class="flex items-center gap-2 px-2 py-1.5 border-t"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <span class="text-xs" style={{ color: "var(--cortex-info)" }}>
            {">"}</span>
          <textarea
            ref={inputRef}
            value={input()}
            onInput={(e) => {
              handleInput(e);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={debug.state.isPaused ? "Evaluate expression..." : "Paused to evaluate"}
            disabled={!debug.state.isPaused}
            class="flex-1 bg-transparent text-xs outline-none resize-none"
            rows={1}
            style={{
              color: "var(--text-base)",
              opacity: debug.state.isPaused ? 1 : 0.5,
              "line-height": "1.5",
              "max-height": "120px",
              overflow: "auto",
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!debug.state.isPaused || !input().trim()}
            class="p-1 rounded transition-colors disabled:opacity-30"
            style={{ color: "var(--text-weak)" }}
            title="Evaluate (Enter)"
          >
            <Icon name="paper-plane" size="xs" />
          </button>
        </div>
      </div>
    </div>
  );
}

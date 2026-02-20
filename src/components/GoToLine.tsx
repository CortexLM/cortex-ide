import { createSignal, createEffect, createMemo, Show, onMount, onCleanup } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "./ui/Icon";

export function GoToLine() {
  const { showGoToLine, setShowGoToLine } = useCommands();
  const { state } = useEditor();
  const [input, setInput] = createSignal("");
  const [isVisible, setIsVisible] = createSignal(false);
  const [error, setError] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  // PERFORMANCE: Memoize to prevent recalculation
  const activeFile = createMemo(() => state.openFiles.find((f) => f.id === state.activeFileId));

  // Handle visibility and animation
  createEffect(() => {
    if (showGoToLine()) {
      setIsVisible(true);
      setInput("");
      setError("");
      setTimeout(() => inputRef?.focus(), 10);
    } else {
      setIsVisible(false);
    }
  });

  const totalLines = () => {
    const file = activeFile();
    if (!file) return 0;
    return file.content.split("\n").length;
  };

  const parseInput = () => {
    const value = input().trim();
    if (!value) return null;
    
    // Support formats: "line", "line:column", ":column"
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

  const handleSubmit = () => {
    const parsed = parseInput();
    if (!parsed) return;
    
    // Emit event to Monaco editor
    window.dispatchEvent(new CustomEvent("goto-line", { 
      detail: { line: parsed.line, column: parsed.column }
    }));
    
    setShowGoToLine(false);
  };

  // Global escape handler
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && showGoToLine()) {
      e.preventDefault();
      setShowGoToLine(false);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Validate on input change
  createEffect(() => {
    const value = input();
    if (value) {
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

  return (
    <Show when={showGoToLine() && activeFile()}>
      <div 
        class="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
        classList={{
          "animate-fade-in": isVisible(),
          "animate-fade-out": !isVisible(),
        }}
        style={{ "animation-duration": "150ms" }}
        onClick={() => setShowGoToLine(false)}
      >
        {/* Backdrop */}
        <div class="absolute inset-0" style={{ background: "rgba(0, 0, 0, 0.5)" }} />
        
        {/* Modal */}
        <div 
          class="relative w-full max-w-[360px] mx-4 overflow-hidden"
          classList={{
            "animate-scale-in": isVisible(),
          }}
          style={{ 
            background: "var(--ui-panel-bg)",
            "animation-duration": "150ms",
            "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            "border-radius": "var(--cortex-radius-md)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            class="flex items-center justify-between px-4 py-3 border-b"
            style={{ "border-color": "var(--jb-border-default)" }}
          >
            <span class="text-[13px] font-medium" style={{ color: "var(--jb-text-body-color)" }}>
              Go to Line
            </span>
            <span class="text-[11px]" style={{ color: "var(--jb-text-muted-color)" }}>
              1 - {totalLines()}
            </span>
          </div>

          {/* Input */}
          <div class="p-4">
            <div 
              class="flex items-center gap-3 px-3 h-[40px] rounded-md transition-colors"
              style={{ 
                background: "var(--jb-canvas)",
                border: error() ? "1px solid var(--cortex-error)" : "1px solid transparent",
              }}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="line[:column]"
                class="flex-1 bg-transparent outline-none text-[14px]"
                style={{ color: "var(--jb-text-body-color)" }}
                value={input()}
                onInput={(e) => setInput(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
              />
              <Show when={isValid()}>
                <button
                  class="flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-white/10"
                  onClick={handleSubmit}
                  title="Go (Enter)"
                >
                  <Icon name="turn-down-left" class="w-4 h-4" style={{ color: "var(--jb-border-focus)" }} />
                </button>
              </Show>
            </div>
            
            <Show when={error()}>
              <p class="text-[11px] mt-2" style={{ color: "var(--cortex-error)" }}>
                {error()}
              </p>
            </Show>
            
            <Show when={!error()}>
              <p class="text-[11px] mt-2" style={{ color: "var(--jb-text-muted-color)" }}>
                Examples: <span class="font-mono">42</span>, <span class="font-mono">42:10</span>, <span class="font-mono">:5</span>
              </p>
            </Show>
          </div>

          {/* Actions */}
          <div 
            class="flex items-center justify-between px-4 py-3 border-t"
            style={{ "border-color": "var(--jb-border-default)" }}
          >
            <kbd 
              class="text-[11px] px-1.5 py-0.5 rounded font-mono"
              style={{ 
                background: "var(--jb-canvas)",
                color: "var(--jb-text-muted-color)",
              }}
            >
              ESC
            </kbd>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 text-[13px] rounded-md transition-colors hover:bg-white/5"
                style={{ color: "var(--jb-text-muted-color)" }}
                onClick={() => setShowGoToLine(false)}
              >
                Cancel
              </button>
              <button
                class="px-3 py-1.5 text-[13px] rounded-md transition-colors"
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
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 150ms ease-out forwards;
        }
        .animate-fade-out {
          animation: fade-out 150ms ease-in forwards;
        }
        .animate-scale-in {
          animation: scale-in 150ms ease-out forwards;
        }
      `}</style>
    </Show>
  );
}


import { createSignal, createEffect, Show, For, onMount, onCleanup, batch } from "solid-js";
import { Icon } from "../ui/Icon";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useEditor } from "@/context/EditorContext";
import { useAI, type StreamChunk } from "@/context/AIContext";
import { useCommands } from "@/context/CommandContext";

// ============================================================================
// Types
// ============================================================================

interface InlineAssistantProps {
  visible: boolean;
  position: { top: number; left: number };
  selectedText: string;
  onClose: () => void;
  onApply: (newText: string) => void;
}

// Note: StreamChunk is imported from AIContext

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  lineNumber?: number;
}

// ============================================================================
// Inline Diff View Component
// ============================================================================

function InlineDiffView(props: { original: string; modified: string }) {
  const computeDiff = (): DiffLine[] => {
    const originalLines = props.original.split("\n");
    const modifiedLines = props.modified.split("\n");
    const diff: DiffLine[] = [];
    
    // Simple line-by-line diff
    let origIdx = 0;
    let modIdx = 0;
    
    while (origIdx < originalLines.length || modIdx < modifiedLines.length) {
      const origLine = originalLines[origIdx];
      const modLine = modifiedLines[modIdx];
      
      if (origIdx >= originalLines.length) {
        // Remaining lines are additions
        diff.push({ type: "add", content: modLine, lineNumber: modIdx + 1 });
        modIdx++;
      } else if (modIdx >= modifiedLines.length) {
        // Remaining lines are removals
        diff.push({ type: "remove", content: origLine, lineNumber: origIdx + 1 });
        origIdx++;
      } else if (origLine === modLine) {
        // Lines match
        diff.push({ type: "context", content: origLine, lineNumber: origIdx + 1 });
        origIdx++;
        modIdx++;
      } else {
        // Lines differ - show removal then addition
        diff.push({ type: "remove", content: origLine, lineNumber: origIdx + 1 });
        diff.push({ type: "add", content: modLine, lineNumber: modIdx + 1 });
        origIdx++;
        modIdx++;
      }
    }
    
    return diff;
  };

  return (
    <div 
      class="hover-widget overflow-hidden font-mono text-xs"
      style={{ 
        /* VS Code hover widget: 3px border-radius */
        "border-radius": "var(--cortex-radius-sm)",
        border: "1px solid var(--border-weak)",
      }}
    >
      <div class="overflow-x-auto max-h-[200px] overflow-y-auto">
        <For each={computeDiff()}>
          {(line) => (
            <div
              class="flex"
              style={{
                background:
                  line.type === "add"
                    ? "rgba(46, 160, 67, 0.15)"
                    : line.type === "remove"
                    ? "rgba(248, 81, 73, 0.15)"
                    : "transparent",
              }}
            >
              <span
                class="flex-shrink-0 w-6 text-center select-none"
                style={{
                  color:
                    line.type === "add"
                      ? "var(--success)"
                      : line.type === "remove"
                      ? "var(--error)"
                      : "var(--text-muted)",
                }}
              >
                {line.type === "add" ? (
                  <Icon name="plus" class="w-3 h-3 inline" />
                ) : line.type === "remove" ? (
                  <Icon name="minus" class="w-3 h-3 inline" />
                ) : (
                  " "
                )}
              </span>
              <pre
                class="flex-1 px-2 py-0.5 whitespace-pre-wrap"
                style={{
                  color:
                    line.type === "add"
                      ? "var(--success)"
                      : line.type === "remove"
                      ? "var(--error)"
                      : "var(--text-base)",
                }}
              >
                {line.content}
              </pre>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// ============================================================================
// Main InlineAssistant Component
// ============================================================================

export function InlineAssistant(props: InlineAssistantProps) {
  const ai = useAI();
  
  const [prompt, setPrompt] = createSignal("");
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [preview, setPreview] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [streamingContent, setStreamingContent] = createSignal("");
  
  let inputRef: HTMLInputElement | undefined;
  let streamUnlisten: UnlistenFn | null = null;

  // Reset state when visibility changes
  createEffect(() => {
    if (props.visible) {
      batch(() => {
        setPrompt("");
        setPreview(null);
        setError(null);
        setStreamingContent("");
      });
      setTimeout(() => inputRef?.focus(), 10);
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    streamUnlisten?.();
  });

  const quickActions = [
    { label: "Explain", prompt: "Explain this code" },
    { label: "Fix", prompt: "Fix any bugs in this code" },
    { label: "Refactor", prompt: "Refactor this code to be cleaner" },
    { label: "Add types", prompt: "Add TypeScript types to this code" },
    { label: "Document", prompt: "Add documentation comments" },
    { label: "Optimize", prompt: "Optimize this code for performance" },
  ];

  const handleAssist = async (customPrompt?: string) => {
    const userPrompt = customPrompt || prompt();
    if (!userPrompt.trim() || !props.selectedText) return;

    batch(() => {
      setIsProcessing(true);
      setError(null);
      setPreview(null);
      setStreamingContent("");
    });

    const streamId = `inline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let fullContent = "";

    try {
      // Set up event listener for stream chunks
      streamUnlisten = await listen<StreamChunk>(`ai:stream_chunk:${streamId}`, (event) => {
        const chunk = event.payload;
        fullContent += chunk.content;
        setStreamingContent(fullContent);
        
        if (chunk.done) {
          setIsProcessing(false);
          // Clean up the response - remove markdown code blocks if present
          let cleanedContent = fullContent.trim();
          if (cleanedContent.startsWith("```")) {
            const lines = cleanedContent.split("\n");
            lines.shift(); // Remove opening ```
            if (lines[lines.length - 1]?.trim() === "```") {
              lines.pop(); // Remove closing ```
            }
            cleanedContent = lines.join("\n");
          }
          setPreview(cleanedContent);
          setStreamingContent("");
        }
      });

      // Also listen for the generic stream event as fallback
      const genericUnlisten = await listen<StreamChunk>("ai:stream_chunk", (event) => {
        const chunk = event.payload;
        fullContent += chunk.content;
        setStreamingContent(fullContent);
        
        if (chunk.done) {
          setIsProcessing(false);
          let cleanedContent = fullContent.trim();
          if (cleanedContent.startsWith("```")) {
            const lines = cleanedContent.split("\n");
            lines.shift();
            if (lines[lines.length - 1]?.trim() === "```") {
              lines.pop();
            }
            cleanedContent = lines.join("\n");
          }
          setPreview(cleanedContent);
          setStreamingContent("");
        }
      });

      // Prepare messages for the AI
      const messages = [
        {
          role: "system",
          content: "You are a code assistant. Modify the given code according to the user's request. Only output the modified code, no explanations. Do not wrap the code in markdown code blocks."
        },
        {
          role: "user",
          content: `Code:\n\`\`\`\n${props.selectedText}\n\`\`\`\n\nRequest: ${userPrompt}`
        }
      ];

      // Use Tauri invoke for AI streaming
      try {
        await invoke("ai_stream", {
          streamId,
          messages,
          model: ai.selectedModel(),
        });
      } catch (invokeError) {
        console.error("AI stream failed:", invokeError);
        throw new Error("Failed to get AI response: " + (invokeError instanceof Error ? invokeError.message : String(invokeError)));
      }

      // Cleanup listeners
      streamUnlisten?.();
      genericUnlisten();
      streamUnlisten = null;
    } catch (err) {
      console.error("Inline assist failed:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsProcessing(false);
    }
  };

  const applyChanges = () => {
    if (!preview()) return;
    props.onApply(preview()!);
    props.onClose();
  };

  const rejectChanges = () => {
    batch(() => {
      setPreview(null);
      setStreamingContent("");
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAssist();
    } else if (e.key === "Escape") {
      if (preview()) {
        rejectChanges();
      } else {
        props.onClose();
      }
    }
  };

  return (
    <Show when={props.visible}>
      <div 
        class="inline-assistant suggest-widget"
        style={{ 
          /* VS Code specs: z-index 40, 430px width, flex layout, 3px border-radius */
          position: "fixed",
          top: `${props.position.top}px`,
          left: `${props.position.left}px`,
          "z-index": "40",
          width: "430px",
          display: "flex",
          "flex-direction": "column",
          "border-radius": "var(--cortex-radius-sm)",
          "border-style": "solid",
          "border-width": "1px",
          "border-color": "var(--border-weak)",
          background: "var(--surface-raised)",
          "box-shadow": "0 0 8px 2px rgba(0, 0, 0, 0.36)",
          "max-height": "80vh",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div 
          class="flex items-center justify-between px-3 py-2 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <div class="flex items-center gap-2">
            <Icon name="bolt" class="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
            <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
              Inline Edit
            </span>
            <span
              class="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: "var(--surface-active)",
                color: "var(--text-weak)",
              }}
            >
              Ctrl+K
            </span>
          </div>
          <button 
            class="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={props.onClose}
            title="Close (Escape)"
          >
            <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </button>
        </div>

        {/* Selected code preview */}
        <div 
          class="px-3 py-2 border-b max-h-[100px] overflow-y-auto"
          style={{ 
            "border-color": "var(--border-weak)",
            background: "var(--background-base)",
          }}
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs" style={{ color: "var(--text-muted)" }}>
              Selected Code
            </span>
          </div>
          <pre 
            class="text-xs font-mono whitespace-pre-wrap"
            style={{ color: "var(--text-weak)" }}
          >
            {props.selectedText.length > 300 
              ? props.selectedText.slice(0, 300) + "..." 
              : props.selectedText}
          </pre>
        </div>

        {/* Quick actions */}
        <div class="flex flex-wrap gap-1 px-3 py-2 border-b" style={{ "border-color": "var(--border-weak)" }}>
          <For each={quickActions}>
            {(action) => (
              <button
                class="px-2 py-1 text-xs rounded transition-colors hover:bg-white/10"
                style={{ 
                  background: "var(--surface-active)",
                  color: "var(--text-weak)",
                }}
                onClick={() => handleAssist(action.prompt)}
                disabled={isProcessing()}
              >
                {action.label}
              </button>
            )}
          </For>
        </div>

        {/* Input */}
        <div class="inline-assistant-input p-3">
          <div 
            class="flex items-center gap-2 px-3 py-2 rounded"
            style={{ background: "var(--background-base)" }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Describe the change..."
              class="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-base)" }}
              value={prompt()}
              onInput={(e) => setPrompt(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing()}
              autofocus
            />
            <button
              class="p-1.5 rounded transition-colors"
              style={{ 
                background: "var(--accent-primary)",
                opacity: isProcessing() || !prompt().trim() ? 0.5 : 1,
              }}
              onClick={() => handleAssist()}
              disabled={isProcessing() || !prompt().trim()}
            >
              {isProcessing() ? (
                <Icon name="spinner" class="w-4 h-4 text-white animate-spin" />
              ) : (
                <Icon name="paper-plane" class="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        <Show when={error()}>
          <div class="px-3 pb-3">
            <div 
              class="px-3 py-2 rounded text-sm"
              style={{ background: "rgba(248, 81, 73, 0.1)", color: "var(--cortex-error)" }}
            >
              {error()}
            </div>
          </div>
        </Show>

        {/* Streaming content */}
        <Show when={isProcessing() && streamingContent()}>
          <div class="px-3 pb-3">
            <div class="flex items-center gap-2 mb-2">
              <Icon name="spinner" class="w-3 h-3 animate-spin" style={{ color: "var(--accent-primary)" }} />
              <span class="text-xs" style={{ color: "var(--text-muted)" }}>
                Generating...
              </span>
            </div>
            <pre 
              class="text-xs font-mono whitespace-pre-wrap p-2 rounded max-h-[150px] overflow-y-auto"
              style={{ 
                background: "var(--background-base)",
                color: "var(--text-base)",
              }}
            >
              {streamingContent()}
            </pre>
          </div>
        </Show>

        {/* Preview diff */}
        <Show when={preview()}>
          <div class="inline-assistant-preview border-t" style={{ "border-color": "var(--border-weak)" }}>
            <div class="px-3 py-2">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-medium" style={{ color: "var(--text-base)" }}>
                  Preview Changes
                </span>
              </div>
              <InlineDiffView original={props.selectedText} modified={preview()!} />
            </div>
            <div class="inline-assistant-actions flex justify-end gap-2 p-3 border-t" style={{ "border-color": "var(--border-weak)" }}>
              <button
                class="reject flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors hover:bg-white/10"
                style={{ color: "var(--text-weak)" }}
                onClick={rejectChanges}
              >
                <Icon name="xmark" class="w-4 h-4" />
                Reject
              </button>
              <button
                class="accept flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors"
                style={{ 
                  background: "var(--accent-primary)",
                  color: "white",
                }}
                onClick={applyChanges}
              >
                <Icon name="check" class="w-4 h-4" />
                Accept
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* Inline assistant styles */}
      <style>{`
        .inline-assistant {
          animation: inlineAssistantSlideIn 150ms ease-out;
        }
        
        @keyframes inlineAssistantSlideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .inline-assistant-input input::placeholder {
          color: var(--text-muted);
        }
        
        .inline-assistant-preview {
          max-height: 300px;
          overflow-y: auto;
        }
      `}</style>
    </Show>
  );
}

// ============================================================================
// Standalone InlineAssistant with keyboard shortcut support
// ============================================================================

export function InlineAssistantManager() {
  const editor = useEditor();
  const commands = useCommands();
  
  const [visible, setVisible] = createSignal(false);
  const [position, setPosition] = createSignal({ top: 100, left: 100 });
  const [selectedText, setSelectedText] = createSignal("");

  // Get current selection from active file
  const getSelectionContext = (): { text: string; position: { top: number; left: number } } | null => {
    const activeFile = editor.state.openFiles.find(
      (f) => f.id === editor.state.activeFileId
    );
    
    if (!activeFile) return null;
    
    const selection = activeFile.selections?.[0];
    if (!selection) {
      // No selection - get current line
      const lines = activeFile.content.split("\n");
      const cursor = activeFile.cursors?.[0];
      if (cursor && cursor.line <= lines.length) {
        const lineContent = lines[cursor.line - 1] || "";
        return {
          text: lineContent,
          position: { top: 100, left: 100 }, // Default position
        };
      }
      return null;
    }
    
    // Extract selected text
    const lines = activeFile.content.split("\n");
    let selectedLines: string[];
    
    if (selection.startLine === selection.endLine) {
      selectedLines = [lines[selection.startLine - 1]?.slice(
        selection.startColumn - 1,
        selection.endColumn - 1
      ) || ""];
    } else {
      selectedLines = lines.slice(selection.startLine - 1, selection.endLine);
      if (selectedLines.length > 0) {
        selectedLines[0] = selectedLines[0].slice(selection.startColumn - 1);
        selectedLines[selectedLines.length - 1] = selectedLines[selectedLines.length - 1].slice(
          0,
          selection.endColumn - 1
        );
      }
    }
    
    return {
      text: selectedLines.join("\n"),
      position: { top: 100, left: 100 }, // Default position
    };
  };

  const show = () => {
    const context = getSelectionContext();
    if (context && context.text.trim()) {
      batch(() => {
        setSelectedText(context.text);
        setPosition(context.position);
        setVisible(true);
      });
    }
  };

  const hide = () => {
    setVisible(false);
  };

  const handleApply = (newText: string) => {
    // Apply the changes to the editor
    // This would integrate with the editor's replace functionality
    const activeFile = editor.state.openFiles.find(
      (f) => f.id === editor.state.activeFileId
    );
    
    if (activeFile) {
      const selection = activeFile.selections?.[0];
      if (selection) {
        // Replace the selection with new text
        const lines = activeFile.content.split("\n");
        const beforeSelection = lines.slice(0, selection.startLine - 1).join("\n");
        const lineBeforeStart = lines[selection.startLine - 1]?.slice(0, selection.startColumn - 1) || "";
        const lineAfterEnd = lines[selection.endLine - 1]?.slice(selection.endColumn - 1) || "";
        const afterSelection = lines.slice(selection.endLine).join("\n");
        
        const newContent = 
          (beforeSelection ? beforeSelection + "\n" : "") +
          lineBeforeStart +
          newText +
          lineAfterEnd +
          (afterSelection ? "\n" + afterSelection : "");
        
        editor.updateFileContent(activeFile.id, newContent);
      } else {
        // Replace current line
        const cursor = activeFile.cursors?.[0];
        if (cursor) {
          const lines = activeFile.content.split("\n");
          lines[cursor.line - 1] = newText;
          editor.updateFileContent(activeFile.id, lines.join("\n"));
        }
      }
    }
    
    hide();
  };

  // Register keyboard shortcut (Ctrl+K)
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        if (visible()) {
          hide();
        } else {
          show();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown, true));
  });

  // Register command
  onMount(() => {
    commands.registerCommand({
      id: "inline-assistant",
      label: "Inline Edit with AI",
      shortcut: "Ctrl+K",
      category: "AI",
      action: () => {
        if (visible()) {
          hide();
        } else {
          show();
        }
      },
    });

    onCleanup(() => commands.unregisterCommand("inline-assistant"));
  });

  return (
    <InlineAssistant
      visible={visible()}
      position={position()}
      selectedText={selectedText()}
      onClose={hide}
      onApply={handleApply}
    />
  );
}

// ============================================================================
// Hook for external usage
// ============================================================================

export function useInlineAssistant() {
  const [visible, setVisible] = createSignal(false);
  const [position, setPosition] = createSignal({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = createSignal("");

  const show = (text: string, pos: { top: number; left: number }) => {
    batch(() => {
      setSelectedText(text);
      setPosition(pos);
      setVisible(true);
    });
  };

  const hide = () => {
    setVisible(false);
  };

  return {
    visible,
    position,
    selectedText,
    show,
    hide,
  };
}


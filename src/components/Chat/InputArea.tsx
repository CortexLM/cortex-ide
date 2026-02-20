import { createSignal, Show, For, JSX } from "solid-js";
import { Icon } from "../ui/Icon";
import { useSDK, type Attachment } from "@/context/SDKContext";
import { useEditor } from "@/context/EditorContext";
import { useToast } from "@/context/ToastContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { parseCommand, findCommand, getCommandSuggestions, type Command, type CommandContext } from "./CommandSystem";


// ============================================================================
// CSS Variable-based Color Palette
// ============================================================================
const palette = {
  canvas: "var(--surface-base)",
  panel: "var(--surface-card)",
  inputCard: "var(--surface-input)",
  border: "var(--border-default)",
  borderSubtle: "var(--border-default)",
  borderHover: "var(--border-hover)",
  textTitle: "var(--text-title)",
  textBody: "var(--text-primary)",
  textMuted: "var(--text-muted)",
  accent: "var(--text-placeholder)",
  placeholder: "var(--text-placeholder)",
};

// ============================================================================
// NeonGridLoader Component - 3x3 Neon Grid with Snake Animation
// ============================================================================
function getSnakeDelay(index: number): number {
  const snakeOrder = [0, 1, 2, 5, 4, 3, 6, 7, 8];
  return snakeOrder.indexOf(index) * 100;
}

function NeonGridLoader() {
  // Simple white/gray loader - subtle and minimal
  const dotColor = "var(--text-muted, var(--cortex-text-secondary))";
  const dotColorActive = "var(--text-secondary, var(--cortex-text-primary))";
  
  return (
    <div style={{
      display: "grid",
      "grid-template-columns": "repeat(3, 1fr)",
      gap: "2px",
      width: "18px",
      height: "18px",
    }}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          style={{
            width: "4px",
            height: "4px",
            "border-radius": "var(--cortex-radius-sm)",
            background: dotColor,
            opacity: "0.4",
            animation: `gridPulse 1.2s ease-in-out infinite`,
            "animation-delay": `${getSnakeDelay(i)}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes gridPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.9; background: ${dotColorActive}; }
        }
      `}</style>
    </div>
  );
}

export function InputArea() {
  const { sendMessage, interrupt, state } = useSDK();
  const editor = useEditor();
  const toast = useToast();
  const workspace = useWorkspace();
  const [text, setText] = createSignal("");
  const [isFocused, setIsFocused] = createSignal(false);
  const [attachments, setAttachments] = createSignal<Attachment[]>([]);
  const [isDragging, setIsDragging] = createSignal(false);
  const [showCommands, setShowCommands] = createSignal(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = createSignal(0);
  
  // Command suggestions based on input
  const commandSuggestions = () => {
    const val = text();
    if (!val.startsWith("/")) return [];
    const partial = val.slice(1).split(/\s/)[0] || "";
    // Only show suggestions if typing the command name (no space yet)
    if (val.includes(" ") && val.indexOf(" ") > 1) return [];
    return getCommandSuggestions(partial);
  };
  
  // Command context for execution
  const commandContext: CommandContext = {
    cwd: state.config.cwd,
    sendMessage: async (content: string) => { await sendMessage(content); },
    openFile: (path: string) => { editor.openFile(path); },
    runInTerminal: (cmd: string) => { 
      window.dispatchEvent(new CustomEvent("terminal:run", { detail: cmd })); 
    },
    showToast: (msg: string, type?: "info" | "error" | "success") => {
      if (type === "error") toast.error(msg);
      else if (type === "success") toast.success(msg);
      else toast.info(msg);
    },
  };

const handleSubmit = async () => {
    const val = text().trim();
    if ((!val && attachments().length === 0) || state.isStreaming) return;
    
    // Check if a project is open before allowing message send
    const folders = workspace?.folders() || [];
    if (folders.length === 0) {
      // Fire event to show project selection modal
      window.dispatchEvent(
        new CustomEvent("cortex:need-project", {
          detail: { content: val, attachments: attachments() },
        })
      );
      return; // Don't proceed - modal will handle it
    }
    
    // Check if it's a command
    const parsed = parseCommand(val);
    if (parsed) {
      const cmd = findCommand(parsed.command);
      if (cmd) {
        setText("");
        setShowCommands(false);
        try {
          const result = await cmd.execute(parsed.args, commandContext);
          if (!result.silent && result.message) {
            if (result.success) {
              toast.info(result.message);
            } else {
              toast.error(result.message);
            }
          }
        } catch (e) {
          toast.error(`Command failed: ${e}`);
        }
        return;
      } else {
        toast.error(`Unknown command: /${parsed.command}`);
        return;
      }
    }
    
    const currentAttachments = attachments();
    setText("");
    setAttachments([]);
    setShowCommands(false);
    await sendMessage(val, currentAttachments);
  };
  
  const selectCommand = (cmd: Command) => {
    setText(`/${cmd.name} `);
    setShowCommands(false);
    setSelectedCommandIndex(0);
  };

  const handleAddAttachment = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
          { name: "All Files", extensions: ["*"] }
        ]
      });

      if (selected && Array.isArray(selected)) {
        for (const path of selected) {
          await processFile(path);
        }
      } else if (selected) {
        await processFile(selected as string);
      }
    } catch (err) {
      console.error("Failed to pick files:", err);
    }
  };

  const processFile = async (path: string) => {
    const name = path.split(/[\\/]/).pop() || "file";
    const ext = name.split('.').pop()?.toLowerCase() || "";
    const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);

    let attachment: Attachment = {
      id: crypto.randomUUID(),
      name,
      path,
      type: isImage ? "image" : "file"
    };

    if (isImage) {
      try {
        const base64 = await invoke<string>("fs_read_file_binary", { path });
        attachment.content = `data:image/${ext};base64,${base64}`;
      } catch (e) {
        console.error("Failed to read image:", e);
      }
    }

    setAttachments(prev => [...prev, attachment]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const suggestions = commandSuggestions();
    
    // Navigate command suggestions
    if (suggestions.length > 0 && showCommands()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (suggestions[selectedCommandIndex()]) {
          selectCommand(suggestions[selectedCommandIndex()]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }
    
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Escape to cancel streaming
    if (e.key === "Escape" && state.isStreaming) {
      e.preventDefault();
      interrupt();
    }
  };

  // Task type dropdown
  const [taskType, setTaskType] = createSignal("Build");
  const [showTaskDropdown, setShowTaskDropdown] = createSignal(false);
  const taskTypes = ["Build", "Debug", "Review", "Explain", "Refactor", "Test"];
  
  // Model display name
  const modelDisplayName = () => {
    const model = state.config.model;
    const name = model.split('/').pop() || model;
    return name.length > 20 ? name.slice(0, 20) + "..." : name;
  };

  // Container style with new palette
  const containerStyle: JSX.CSSProperties = {
    background: palette.inputCard,
    border: isFocused() ? `2px solid ${palette.accent}` : `1px solid ${palette.border}`,
    "border-radius": "var(--cortex-radius-lg)",
    padding: "12px 16px",
    margin: "16px",
    transition: "border-color 150ms ease",
  };

  // Textarea style
  const textareaStyle: JSX.CSSProperties = {
    background: "transparent",
    border: "none",
    color: palette.textBody,
    "font-size": "14px",
    "line-height": "1.5",
    resize: "none",
    outline: "none",
    width: "100%",
    "max-height": "200px",
    "font-weight": "400",
    "letter-spacing": "-0.01em",
  };

  // Attachment style
  const attachmentStyle: JSX.CSSProperties = {
    background: "var(--surface-hover)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--cortex-radius-md)",
    padding: "4px 8px",
    color: "var(--text-primary)",
    "font-size": "12px",
  };

  // Suggestions dropdown style
  const suggestionsStyle: JSX.CSSProperties = {
    background: palette.inputCard,
    border: `1px solid ${palette.border}`,
    "border-radius": "var(--cortex-radius-md)",
    "box-shadow": "0px 8px 24px rgba(0, 0, 0, 0.4)",
    "max-height": "200px",
    "overflow-y": "auto",
  };

  return (
    <div 
      class="flex flex-col"
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer!.dropEffect = "move";
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        
        const cortexData = e.dataTransfer?.getData("application/x-cortex-paths");
        if (cortexData) {
          try {
            const parsed = JSON.parse(cortexData);
            if (Array.isArray(parsed)) {
              for (const path of parsed) {
                if (typeof path === 'string') await processFile(path);
              }
              return;
            }
          } catch (err) { console.warn("Failed to parse clipboard data:", err); }
        }

        const uriList = e.dataTransfer?.getData("text/uri-list");
        if (uriList) {
          const uris = uriList.split('\n');
          for (const uri of uris) {
            if (uri.startsWith('file://')) {
              const path = decodeURIComponent(uri.substring(7));
              await processFile(path);
            }
          }
          if (uris.length > 0) return;
        }

        const data = e.dataTransfer?.getData("text/plain");
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              for (const path of parsed) {
                if (typeof path === 'string') await processFile(path);
              }
              return;
            }
          } catch (err) {
            if (data.includes('/') || data.includes('\\')) {
              await processFile(data);
              return;
            }
          }
        }

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          // Extended File interface that may include path from Tauri
          interface TauriFile extends File {
            path?: string;
          }
          for (let i = 0; i < e.dataTransfer.files.length; i++) {
            const file = e.dataTransfer.files[i] as TauriFile;
            const path = file.path || file.name;
            await processFile(path);
          }
        }
      }}
    >
      {/* Main Input Container - New Palette */}
      <div style={containerStyle}>
        {/* Attachments Preview */}
        <Show when={attachments().length > 0}>
          <div class="flex flex-wrap gap-2 mb-3">
            <For each={attachments()}>
              {(attachment) => (
                <div 
                  class="group relative flex items-center gap-2 rounded-lg transition-all duration-150"
                  style={attachmentStyle}
                  title={attachment.path}
                >
                  <Show when={attachment.type === "image"} fallback={
                    <Icon name="file" class="w-3.5 h-3.5" style={{ color: palette.textMuted }} />
                  }>
                    <div class="w-8 h-8 rounded-md overflow-hidden">
                      <img src={attachment.content} class="w-full h-full object-cover" />
                    </div>
                  </Show>
                  <span class="text-[11px] max-w-[100px] truncate" style={{ color: palette.textBody }}>{attachment.name}</span>
                  <button 
                    onClick={() => removeAttachment(attachment.id)}
                    class="p-0.5 rounded-md transition-all duration-150"
                    style={{ color: palette.textMuted }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--text-title)";
                      e.currentTarget.style.background = "var(--surface-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-muted)";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Icon name="xmark" class="w-3 h-3" />
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Textarea Area */}
        <div class="relative">
          {/* Command Suggestions */}
          <Show when={showCommands() && commandSuggestions().length > 0}>
            <div 
              class="absolute bottom-full left-0 right-0 mb-3 rounded-xl overflow-hidden z-50"
              style={suggestionsStyle}
            >
              <div class="px-3 py-2 flex items-center gap-2" style={{ "border-bottom": "1px solid var(--border-default)" }}>
                <Icon name="terminal" class="w-3 h-3" style={{ color: palette.accent }} />
                <span class="text-[10px] uppercase tracking-wider" style={{ color: palette.textMuted }}>Commands</span>
              </div>
              <For each={commandSuggestions()}>
                {(cmd, index) => (
                  <div
                    class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors duration-150"
                    style={{ 
                      padding: "8px 12px",
                      color: palette.textBody,
                      background: index() === selectedCommandIndex() ? "var(--surface-hover)" : "transparent" 
                    }}
                    onClick={() => selectCommand(cmd)}
                    onMouseEnter={() => setSelectedCommandIndex(index())}
                  >
                    <Icon name="chevron-right" class="w-3 h-3" style={{ color: palette.accent }} />
                    <span class="text-[12px] font-mono" style={{ color: palette.accent }}>/{cmd.name}</span>
                    <span class="flex-1 truncate text-[11px]" style={{ color: palette.textMuted }}>{cmd.description}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <textarea
            class="w-full bg-transparent border-none outline-none resize-none text-[15px] min-h-[44px] leading-relaxed px-1 py-1"
            placeholder={isDragging() ? "Drop files here..." : "Ask anything..."}
            rows="1"
            style={textareaStyle}
            value={text()}
            onInput={(e) => {
              const val = e.currentTarget.value;
              setText(val);
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 200) + 'px';
              if (val.startsWith("/") && !val.includes(" ")) {
                setShowCommands(true);
                setSelectedCommandIndex(0);
              } else {
                setShowCommands(false);
              }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              setTimeout(() => setShowCommands(false), 150);
            }}
            onKeyDown={handleKeyDown}
          />
          {/* Add CSS for placeholder color */}
          <style>{`
            textarea::placeholder {
              color: var(--text-placeholder);
            }
          `}</style>

          {/* Loading indicator - Neon Grid Loader */}
          <Show when={state.isStreaming}>
            <div class="absolute top-0 right-0">
              <NeonGridLoader />
            </div>
          </Show>
        </div>

        {/* Footer Controls */}
        <div class="flex items-center justify-between mt-3 pt-3 px-1" style={{ "border-top": "1px solid var(--border-default)" }}>
          {/* Left Group - Dropdowns */}
          <div class="flex items-center gap-3">
            {/* Task Type Dropdown */}
            <div class="relative">
              <button 
                class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-medium transition-all duration-150"
                style={{ 
                  color: palette.textMuted,
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-hover)";
                  e.currentTarget.style.color = "var(--text-title)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
                onClick={() => setShowTaskDropdown(!showTaskDropdown())}
              >
                {taskType()}
                <Icon name="chevron-down" class="w-3 h-3" />
              </button>
              <Show when={showTaskDropdown()}>
                <div 
                  class="absolute bottom-full left-0 mb-2 py-1.5 rounded-xl z-50 overflow-hidden"
                  style={{ 
                    background: "var(--surface-input)",
                    border: "1px solid var(--border-default)",
                    "box-shadow": "0px 8px 24px rgba(0, 0, 0, 0.4)",
                    "min-width": "120px",
                  }}
                >
                  <For each={taskTypes}>
                    {(type) => (
                      <button
                        class="w-full px-3 py-2 text-left text-[12px] transition-colors duration-150"
                        style={{ 
                          color: taskType() === type ? "var(--text-title)" : "var(--text-muted)",
                          background: taskType() === type ? "var(--surface-hover)" : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (taskType() !== type) {
                            e.currentTarget.style.background = "var(--surface-hover)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (taskType() !== type) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                        onClick={() => { setTaskType(type); setShowTaskDropdown(false); }}
                      >
                        {type}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Model Display */}
            <button 
              class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] transition-all duration-150"
              style={{ 
                color: palette.textMuted,
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              {modelDisplayName()}
              <Icon name="chevron-down" class="w-3 h-3" />
            </button>
          </div>

          {/* Right Group - Actions */}
          <div class="flex items-center gap-1">
            {/* Attach Button */}
            <button 
              onClick={handleAddAttachment}
              class="p-2 rounded-lg transition-all duration-150"
              style={{ color: palette.textMuted }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
              title="Attach file"
            >
              <Icon name="paperclip" class="w-4 h-4" />
            </button>

            {/* Cancel button */}
            <Show when={state.isStreaming}>
              <button 
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150"
                style={{ 
                  color: "var(--state-error)",
                  background: "var(--state-error-bg, rgba(220, 53, 69, 0.1))",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--state-error-bg-hover, rgba(220, 53, 69, 0.15))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--state-error-bg, rgba(220, 53, 69, 0.1))";
                }}
                onClick={interrupt}
                title="Cancel (Escape)"
              >
                <Icon name="stop" class="w-3.5 h-3.5" />
                <span class="text-[11px] font-medium">Stop</span>
              </button>
            </Show>

            {/* Submit Button */}
            <Show when={!state.isStreaming}>
              <button 
                class="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200"
                style={{
                  background: (text().trim().length > 0 || attachments().length > 0)
                    ? "var(--text-placeholder)"
                    : "var(--surface-hover)",
                  color: (text().trim().length > 0 || attachments().length > 0)
                    ? "var(--text-title)"
                    : "var(--text-muted)",
                  "box-shadow": (text().trim().length > 0 || attachments().length > 0)
                    ? "0 2px 8px rgba(0,0,0,0.3), 0 0 12px var(--accent-muted)"
                    : "none",
                  cursor: (text().trim().length > 0 || attachments().length > 0) ? "pointer" : "not-allowed",
                }}
                onMouseEnter={(e) => {
                  if (text().trim().length > 0 || attachments().length > 0) {
                    e.currentTarget.style.background = "var(--surface-active)";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (text().trim().length > 0 || attachments().length > 0) {
                    e.currentTarget.style.background = "var(--text-placeholder)";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
                onClick={handleSubmit}
                disabled={!text().trim() && attachments().length === 0}
              >
                <Icon name="arrow-up" class="w-4 h-4" />
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}


import {
  createSignal,
  createEffect,
  Show,
  For,
  onMount,
  onCleanup,
  batch,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { useEditor } from "@/context/EditorContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useCommands } from "@/context/CommandContext";
import { useAI, type MessageContext, type Message } from "@/context/AIContext";
import { Button, IconButton, Textarea, Text } from "@/components/ui";

// ============================================================================
// Types
// ============================================================================

interface QuickAction {
  id: string;
  label: string;
  iconName: string;
  shortcut: string;
  description: string;
  insertText: string;
}

// ============================================================================
// Constants
// ============================================================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "file",
    label: "@file",
    iconName: "file",
    shortcut: "@f",
    description: "Include current file",
    insertText: "@file ",
  },
  {
    id: "selection",
    label: "@selection",
    iconName: "code",
    shortcut: "@s",
    description: "Include selected code",
    insertText: "@selection ",
  },
  {
    id: "workspace",
    label: "@workspace",
    iconName: "folder",
    shortcut: "@w",
    description: "Include workspace context",
    insertText: "@workspace ",
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ============================================================================
// QuickChat Component
// ============================================================================

export function QuickChat() {
  const ai = useAI();
  const editor = useEditor();
  const workspace = useWorkspace();
  const commands = useCommands();

  // Local UI state
  const [visible, setVisible] = createSignal(false);
  const [input, setInput] = createSignal("");
  const [showQuickActions, setShowQuickActions] = createSignal(false);
  const [selectedActionIndex, setSelectedActionIndex] = createSignal(0);
  const [copiedMessageId, setCopiedMessageId] = createSignal<string | null>(null);
  const [isClosing, setIsClosing] = createSignal(false);

  // Refs
  let inputRef: HTMLTextAreaElement | undefined;
  let messagesContainerRef: HTMLDivElement | undefined;
  let backdropRef: HTMLDivElement | undefined;

  // Derive messages from AI context
  const messages = () => ai.activeThread()?.messages || [];
  const isStreaming = ai.isStreaming;
  const streamingContent = ai.streamingContent;

  // Auto-scroll to bottom on new messages or streaming content
  createEffect(() => {
    // Track these to trigger scroll
    messages();
    streamingContent();
    if (messagesContainerRef) {
      setTimeout(() => {
        messagesContainerRef!.scrollTop = messagesContainerRef!.scrollHeight;
      }, 10);
    }
  });

  // Focus input when visible
  createEffect(() => {
    if (visible() && !isClosing()) {
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  // Register keyboard shortcut (Ctrl+I)
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+I to open Quick Chat
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        e.stopPropagation();
        if (visible()) {
          closeWithAnimation();
        } else {
          show();
        }
        return;
      }

      // Handle shortcuts when visible
      if (visible()) {
        // Escape to close
        if (e.key === "Escape") {
          e.preventDefault();
          closeWithAnimation();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown, true));
  });

  // Register command
  onMount(() => {
    commands.registerCommand({
      id: "quick-chat",
      label: "Open Quick Chat",
      shortcut: "Ctrl+I",
      category: "AI",
      action: () => {
        if (visible()) {
          closeWithAnimation();
        } else {
          show();
        }
      },
    });

    onCleanup(() => commands.unregisterCommand("quick-chat"));
  });

  // Listen for custom event to open quick chat
  onMount(() => {
    const handleOpen = () => show();
    window.addEventListener("quick-chat:open", handleOpen);
    onCleanup(() => window.removeEventListener("quick-chat:open", handleOpen));
  });

  // ============================================================================
  // Actions
  // ============================================================================

  const show = () => {
    batch(() => {
      setIsClosing(false);
      setVisible(true);
      setShowQuickActions(false);
    });
  };

  const closeWithAnimation = () => {
    setIsClosing(true);
    setTimeout(() => {
      batch(() => {
        setVisible(false);
        setIsClosing(false);
        setShowQuickActions(false);
      });
    }, 150);
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === backdropRef) {
      closeWithAnimation();
    }
  };

  const getCurrentContext = (): MessageContext => {
    const context: MessageContext = {};

    // Get current file info
    const activeFile = editor.state.openFiles.find(
      (f) => f.id === editor.state.activeFileId
    );
    if (activeFile) {
      context.files = [activeFile.path];
    }

    // Get selection if any
    const selection = activeFile?.selections?.[0];
    if (selection && activeFile) {
      const lines = activeFile.content.split("\n");
      const selectedLines = lines.slice(
        selection.startLine - 1,
        selection.endLine
      );
      if (selectedLines.length > 0) {
        if (selection.startLine === selection.endLine) {
          context.selection = selectedLines[0].slice(
            selection.startColumn - 1,
            selection.endColumn - 1
          );
        } else {
          selectedLines[0] = selectedLines[0].slice(selection.startColumn - 1);
          selectedLines[selectedLines.length - 1] = selectedLines[
            selectedLines.length - 1
          ].slice(0, selection.endColumn - 1);
          context.selection = selectedLines.join("\n");
        }
      }
    }

    // Get workspace info
    const activeFolder = workspace.activeFolder();
    if (activeFolder) {
      context.workspacePath = activeFolder;
    }

    return context;
  };

  const buildPromptWithContext = (userInput: string): string => {
    const context = getCurrentContext();
    let prompt = userInput;

    // Process @file mention
    if (userInput.includes("@file") && context.files && context.files.length > 0) {
      const activeFile = editor.state.openFiles.find(
        (f) => f.id === editor.state.activeFileId
      );
      if (activeFile) {
        prompt = prompt.replace(
          /@file\s*/g,
          `\n[Current file: ${activeFile.name}]\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\`\n`
        );
      }
    }

    // Process @selection mention
    if (userInput.includes("@selection") && context.selection) {
      prompt = prompt.replace(
        /@selection\s*/g,
        `\n[Selected code:]\n\`\`\`\n${context.selection}\n\`\`\`\n`
      );
    }

    // Process @workspace mention
    if (userInput.includes("@workspace") && context.workspacePath) {
      prompt = prompt.replace(
        /@workspace\s*/g,
        `\n[Workspace: ${context.workspacePath}]\n`
      );
    }

    return prompt;
  };

  const handleSend = async () => {
    const userInput = input().trim();
    if (!userInput || isStreaming()) return;

    const context = getCurrentContext();
    const processedContent = buildPromptWithContext(userInput);

    batch(() => {
      setInput("");
      setShowQuickActions(false);
    });

    // Send through AI context
    await ai.sendMessage(processedContent, context);
  };

  const handleCancel = () => {
    ai.cancelStream();
  };

  const handleNewThread = async () => {
    await ai.createThread();
  };

  const copyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const openInFullChat = () => {
    closeWithAnimation();
    // Dispatch event to open full chat panel with current conversation
    window.dispatchEvent(
      new CustomEvent("chat:open", {
        detail: { threadId: ai.activeThread()?.id },
      })
    );
  };

  const clearHistory = async () => {
    await ai.clearAllThreads();
  };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    // Handle @ trigger for quick actions
    if (e.key === "@" && !showQuickActions()) {
      setShowQuickActions(true);
      setSelectedActionIndex(0);
      return;
    }

    // Handle quick actions navigation
    if (showQuickActions()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedActionIndex((i) =>
          Math.min(i + 1, QUICK_ACTIONS.length - 1)
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedActionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const action = QUICK_ACTIONS[selectedActionIndex()];
        if (action) {
          insertQuickAction(action);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowQuickActions(false);
        return;
      }
    }

    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    // Check for @ at the end to show quick actions
    if (value.endsWith("@")) {
      setShowQuickActions(true);
      setSelectedActionIndex(0);
    } else if (showQuickActions()) {
      // Filter quick actions based on text after @
      const atIndex = value.lastIndexOf("@");
      if (atIndex === -1) {
        setShowQuickActions(false);
      } else {
        const filterText = value.slice(atIndex + 1).toLowerCase();
        const hasMatch = QUICK_ACTIONS.some(
          (a) =>
            a.id.toLowerCase().startsWith(filterText) ||
            a.shortcut.slice(1).toLowerCase().startsWith(filterText)
        );
        if (!hasMatch && filterText.length > 0) {
          setShowQuickActions(false);
        }
      }
    }
  };

  const insertQuickAction = (action: QuickAction) => {
    const currentInput = input();
    const atIndex = currentInput.lastIndexOf("@");
    if (atIndex !== -1) {
      const newInput = currentInput.slice(0, atIndex) + action.insertText;
      setInput(newInput);
    } else {
      setInput(currentInput + action.insertText);
    }
    setShowQuickActions(false);
    inputRef?.focus();
  };

  const filteredQuickActions = () => {
    const currentInput = input();
    const atIndex = currentInput.lastIndexOf("@");
    if (atIndex === -1) return QUICK_ACTIONS;

    const filterText = currentInput.slice(atIndex + 1).toLowerCase();
    if (!filterText) return QUICK_ACTIONS;

    return QUICK_ACTIONS.filter(
      (a) =>
        a.id.toLowerCase().startsWith(filterText) ||
        a.shortcut.slice(1).toLowerCase().startsWith(filterText)
    );
  };

  // Check if a message content looks like an error
  const isErrorMessage = (message: Message): boolean => {
    return message.role === "assistant" && message.content.startsWith("Error:");
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Show when={visible()}>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        class="fixed inset-0 z-[250] flex items-center justify-center"
        style={{
          "background-color": "rgba(0, 0, 0, 0.5)",
          animation: isClosing()
            ? "quickChatFadeOut 150ms ease-out forwards"
            : "quickChatFadeIn 150ms ease-out forwards",
        }}
        onClick={handleBackdropClick}
      >
        {/* Modal */}
        <div
          class="flex flex-col w-[600px] max-h-[500px] rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-weak)",
            animation: isClosing()
              ? "quickChatSlideOut 150ms ease-out forwards"
              : "quickChatSlideIn 150ms ease-out forwards",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-4 py-3 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <div class="flex items-center gap-2">
              <Icon
                name="message"
                class="w-5 h-5"
                style={{ color: "var(--accent-primary)" }}
              />
              <span
                class="text-sm font-semibold"
                style={{ color: "var(--text-base)" }}
              >
                Quick Chat
              </span>
              <span
                class="text-xs px-2 py-0.5 rounded"
                style={{
                  background: "var(--surface-active)",
                  color: "var(--text-weak)",
                }}
              >
                Ctrl+I
              </span>
            </div>
            <div class="flex items-center gap-1">
              <IconButton
                variant="ghost"
                size="sm"
                onClick={handleNewThread}
                tooltip="New conversation"
              >
                <Icon name="plus" style={{ width: "16px", height: "16px" }} />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                onClick={openInFullChat}
                tooltip="Open in full chat"
              >
                <Icon name="maximize" style={{ width: "16px", height: "16px" }} />
              </IconButton>
              <Show when={messages().length > 0}>
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  tooltip="Clear history"
                >
                  <Icon name="trash" style={{ width: "16px", height: "16px" }} />
                </IconButton>
              </Show>
              <IconButton
                variant="ghost"
                size="sm"
                onClick={closeWithAnimation}
                tooltip="Close (Escape)"
              >
                <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
              </IconButton>
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            class="flex-1 overflow-y-auto px-4 py-3 min-h-[200px] max-h-[300px]"
            style={{ background: "var(--background-base)" }}
          >
            <Show
              when={messages().length > 0 || streamingContent()}
              fallback={
                <div class="flex flex-col items-center justify-center h-full py-8">
                  <Icon
                    name="message"
                    class="w-12 h-12 mb-3"
                    style={{ color: "var(--text-weak)", opacity: 0.3 }}
                  />
                  <p
                    class="text-sm text-center mb-2"
                    style={{ color: "var(--text-weak)" }}
                  >
                    Ask anything about your code
                  </p>
                  <p
                    class="text-xs text-center"
                    style={{ color: "var(--text-weak)", opacity: 0.7 }}
                  >
                    Use @file, @selection, or @workspace to add context
                  </p>
                </div>
              }
            >
              <div class="space-y-4">
                <For each={messages()}>
                  {(message) => (
                    <div
                      class={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        class="max-w-[85%] rounded-lg px-3 py-2 group"
                        style={{
                          background:
                            message.role === "user"
                              ? "var(--accent-primary)"
                              : isErrorMessage(message)
                                ? "var(--error-bg, rgba(239, 68, 68, 0.1))"
                                : "var(--surface-raised)",
                          color:
                            message.role === "user"
                              ? "white"
                              : isErrorMessage(message)
                                ? "var(--error, var(--cortex-error))"
                                : "var(--text-base)",
                        }}
                      >
                        {/* Message content */}
                        <p class="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>

                        {/* Message footer */}
                        <div class="flex items-center justify-between mt-1">
                          <span
                            class="text-xs"
                            style={{
                              opacity: 0.6,
                            }}
                          >
                            {formatTimestamp(message.timestamp)}
                          </span>
                          <Show when={message.role === "assistant" && !isErrorMessage(message)}>
                            <IconButton
                              variant="ghost"
                              size="sm"
                              style={{ opacity: "0", transition: "opacity 0.2s" }}
                              onClick={() => copyMessage(message)}
                              tooltip="Copy"
                            >
                              {copiedMessageId() === message.id ? (
                                <Icon name="check" style={{ width: "14px", height: "14px", color: "var(--cortex-success)" }} />
                              ) : (
                                <Icon name="copy" style={{ width: "14px", height: "14px", color: "var(--jb-text-muted-color)" }} />
                              )}
                            </IconButton>
                          </Show>
                        </div>
                      </div>
                    </div>
                  )}
                </For>

                {/* Streaming response */}
                <Show when={isStreaming() && streamingContent()}>
                  <div class="flex justify-start">
                    <div
                      class="max-w-[85%] rounded-lg px-3 py-2"
                      style={{
                        background: "var(--surface-raised)",
                        color: "var(--text-base)",
                      }}
                    >
                      <p class="text-sm whitespace-pre-wrap break-words">
                        {streamingContent()}
                      </p>
                    </div>
                  </div>
                </Show>

                {/* Loading indicator */}
                <Show when={isStreaming() && !streamingContent()}>
                  <div class="flex justify-start">
                    <div
                      class="flex items-center gap-2 rounded-lg px-3 py-2"
                      style={{ background: "var(--surface-raised)" }}
                    >
                      <Icon
                        name="spinner"
                        class="w-4 h-4 animate-spin"
                        style={{ color: "var(--accent-primary)" }}
                      />
                      <span
                        class="text-sm"
                        style={{ color: "var(--text-weak)" }}
                      >
                        Thinking...
                      </span>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Input Area */}
          <div
            class="px-4 py-3 border-t relative"
            style={{
              "border-color": "var(--border-weak)",
              background: "var(--surface-raised)",
            }}
          >
            {/* Quick Actions Dropdown */}
            <Show when={showQuickActions() && filteredQuickActions().length > 0}>
              <div
                class="absolute bottom-full left-4 right-4 mb-2 rounded-lg shadow-xl overflow-hidden"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-weak)",
                }}
              >
                <div class="py-1">
                  <For each={filteredQuickActions()}>
                    {(action, index) => (
                      <Button
                        variant="ghost"
                        class="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors justify-start"
                        style={{
                          background:
                            index() === selectedActionIndex()
                              ? "var(--surface-active)"
                              : "transparent",
                        }}
                        onClick={() => insertQuickAction(action)}
                        onMouseEnter={() => setSelectedActionIndex(index())}
                      >
                        <Icon
                          name={action.iconName}
                          class="w-4 h-4"
                          style={{ color: "var(--accent-primary)" }}
                        />
                        <div class="flex-1">
                          <div class="flex items-center gap-2">
                            <Text size="sm" weight="medium">
                              {action.label}
                            </Text>
                            <Text size="xs" variant="muted">
                              {action.shortcut}
                            </Text>
                          </div>
                          <Text size="xs" variant="muted">
                            {action.description}
                          </Text>
                        </div>
                      </Button>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Input field */}
            <div
              class="flex items-end gap-2 rounded-lg px-3 py-2"
              style={{ background: "var(--background-base)" }}
            >
              <Textarea
                ref={inputRef}
                placeholder="Ask a question... (@ for context)"
                class="flex-1 bg-transparent outline-none text-sm resize-none"
                style={{
                  color: "var(--text-base)",
                  "min-height": "24px",
                  "max-height": "120px",
                }}
                value={input()}
                onInput={(e) => handleInputChange(e.currentTarget.value)}
                onKeyDown={handleInputKeyDown}
                disabled={isStreaming()}
                rows={1}
              />
              <Show
                when={isStreaming()}
                fallback={
                  <IconButton
                    variant="ghost"
                    size="sm"
                    style={{
                      "flex-shrink": "0",
                      opacity: isStreaming() || !input().trim() ? 0.5 : 1,
                      cursor: isStreaming() || !input().trim() ? "not-allowed" : "pointer",
                      background: "var(--jb-btn-primary-bg)",
                      color: "var(--jb-btn-primary-color)",
                    }}
                    onClick={handleSend}
                    disabled={isStreaming() || !input().trim()}
                  >
                    <Icon name="paper-plane" style={{ width: "16px", height: "16px" }} />
                  </IconButton>
                }
              >
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  tooltip="Cancel"
                  style={{
                    "flex-shrink": "0",
                    background: "var(--cortex-error)",
                    color: "var(--cortex-text-primary)",
                  }}
                >
                  <Icon name="stop" style={{ width: "16px", height: "16px" }} />
                </IconButton>
              </Show>
            </div>

            {/* Quick action hints */}
            <div class="flex items-center gap-2 mt-2">
              <For each={QUICK_ACTIONS}>
                {(action) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setInput((prev) => prev + action.insertText);
                      inputRef?.focus();
                    }}
                    icon={<Icon name={action.iconName} style={{ width: "12px", height: "12px" }} />}
                    style={{ "font-size": "11px" }}
                  >
                    {action.label}
                  </Button>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes quickChatFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes quickChatFadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        
        @keyframes quickChatSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes quickChatSlideOut {
          from {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          to {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
        }
      `}</style>
    </Show>
  );
}

// ============================================================================
// Hook for external usage
// ============================================================================

export function useQuickChat() {
  const open = () => {
    window.dispatchEvent(new CustomEvent("quick-chat:open"));
  };

  return { open };
}


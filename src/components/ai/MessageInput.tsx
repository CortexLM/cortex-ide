import {
  createSignal,
  createEffect,
  Show,
  For,
  onMount,
  batch,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

/** Context attached to a message */
export interface MessageContext {
  file?: {
    path: string;
    name: string;
    language: string;
    content?: string;
  };
  selection?: {
    text: string;
    startLine: number;
    endLine: number;
  };
  workspace?: string;
  attachments?: Attachment[];
}

/** File attachment for messages */
export interface Attachment {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder" | "image";
  size?: number;
  preview?: string;
}

/** Slash command definition */
interface SlashCommand {
  name: string;
  description: string;
  icon: string;
  category: "conversation" | "context" | "settings";
}

/** Context mention action */
interface ContextMention {
  id: string;
  label: string;
  icon: string;
  shortcut: string;
  description: string;
  insertText: string;
}

/** Props for MessageInput component */
export interface MessageInputProps {
  onSend: (content: string, context?: MessageContext) => void;
  onCancel?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "clear",
    description: "Clear conversation history",
    icon: "trash",
    category: "conversation",
  },
  {
    name: "new",
    description: "Start a new thread",
    icon: "plus",
    category: "conversation",
  },
  {
    name: "model",
    description: "Change the AI model",
    icon: "microchip",
    category: "settings",
  },
  {
    name: "system",
    description: "Set system prompt",
    icon: "terminal",
    category: "settings",
  },
  {
    name: "file",
    description: "Include file in context",
    icon: "file",
    category: "context",
  },
  {
    name: "folder",
    description: "Include folder context",
    icon: "folder",
    category: "context",
  },
];

const CONTEXT_MENTIONS: ContextMention[] = [
  {
    id: "file",
    label: "@file",
    icon: "file",
    shortcut: "@f",
    description: "Include current file",
    insertText: "@file ",
  },
  {
    id: "selection",
    label: "@selection",
    icon: "code",
    shortcut: "@s",
    description: "Include selected code",
    insertText: "@selection ",
  },
  {
    id: "workspace",
    label: "@workspace",
    icon: "folder",
    shortcut: "@w",
    description: "Include workspace context",
    insertText: "@workspace ",
  },
];

const MAX_TEXTAREA_HEIGHT = 200;

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function isImageFile(filename: string): boolean {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
  return imageExtensions.includes(getFileExtension(filename));
}

// ============================================================================
// Attachments Preview Component
// ============================================================================

function AttachmentsPreview(props: {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}) {
  const getIcon = (attachment: Attachment) => {
    switch (attachment.type) {
      case "folder":
        return "folder";
      case "image":
        return "file-lines";
      default:
        return "file";
    }
  };

  return (
    <div
      class="flex flex-wrap gap-2 px-3 py-2 border-b"
      style={{ "border-color": tokens.colors.border.default }}
    >
      <For each={props.attachments}>
        {(attachment) => {
          const iconName = getIcon(attachment);
          return (
            <div
              class="flex items-center gap-2 px-2 py-1.5 rounded-md group"
              style={{
                background: tokens.colors.interactive.hover,
                border: `1px solid ${tokens.colors.border.default}`,
              }}
            >
              <Show
                when={attachment.type === "image" && attachment.preview}
                fallback={
                  <Icon
                    name={iconName}
                    class="w-4 h-4 shrink-0"
                    style={{ color: tokens.colors.text.muted }}
                  />
                }
              >
                <img
                  src={attachment.preview}
                  alt={attachment.name}
                  class="w-6 h-6 rounded object-cover"
                />
              </Show>
              <span
                class="text-xs max-w-[120px] truncate"
                style={{ color: tokens.colors.text.primary }}
              >
                {attachment.name}
              </span>
              <Show when={attachment.size}>
                <span class="text-xs" style={{ color: tokens.colors.text.muted }}>
                  {formatFileSize(attachment.size!)}
                </span>
              </Show>
              <button
                class="p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: tokens.colors.text.muted }}
                onClick={() => props.onRemove(attachment.id)}
                title="Remove"
              >
                <Icon name="xmark" class="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }}
      </For>
    </div>
  );
}

// ============================================================================
// Slash Command Menu Component
// ============================================================================

function SlashCommandMenu(props: {
  filter: string;
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  onNavigate: (direction: "up" | "down") => void;
}) {
  let containerRef: HTMLDivElement | undefined;

  const filteredCommands = () => {
    const filter = props.filter.toLowerCase();
    if (!filter) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(filter) ||
        cmd.description.toLowerCase().includes(filter)
    );
  };

  const groupedCommands = () => {
    const commands = filteredCommands();
    const groups: Record<string, SlashCommand[]> = {
      conversation: [],
      context: [],
      settings: [],
    };
    for (const cmd of commands) {
      groups[cmd.category].push(cmd);
    }
    return groups;
  };

  createEffect(() => {
    const index = props.selectedIndex;
    if (containerRef) {
      const items = containerRef.querySelectorAll("[data-command-item]");
      items[index]?.scrollIntoView({ block: "nearest" });
    }
  });

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "conversation":
        return "Conversation";
      case "context":
        return "Context";
      case "settings":
        return "Settings";
      default:
        return category;
    }
  };

  let globalIndex = -1;

  return (
    <div
      ref={containerRef}
      class="absolute bottom-full left-0 right-0 mb-2 rounded-lg shadow-xl overflow-hidden z-50"
      style={{
        background: tokens.colors.surface.panel,
        border: `1px solid ${tokens.colors.border.default}`,
        "max-height": "280px",
      }}
    >
      <div class="overflow-y-auto max-h-[280px]">
        <Show
          when={filteredCommands().length > 0}
          fallback={
            <div class="px-3 py-4 text-center">
              <span class="text-sm" style={{ color: tokens.colors.text.muted }}>
                No commands found
              </span>
            </div>
          }
        >
          <For each={Object.entries(groupedCommands())}>
            {([category, commands]) => (
              <Show when={commands.length > 0}>
                <div>
                  <div
                    class="px-3 py-1.5 text-xs font-medium uppercase tracking-wide"
                    style={{
                      color: tokens.colors.text.muted,
                      background: tokens.colors.surface.canvas,
                    }}
                  >
                    {getCategoryLabel(category)}
                  </div>
                  <For each={commands}>
                    {(command) => {
                      globalIndex++;
                      const currentIndex = globalIndex;
                      return (
                        <button
                          data-command-item
                          class="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer"
                          style={{
                            background:
                              currentIndex === props.selectedIndex
                                ? tokens.colors.interactive.hover
                                : "transparent",
                          }}
                          onClick={() => props.onSelect(command)}
                        >
                          <Icon
                            name={command.icon}
                            class="w-4 h-4 shrink-0"
                            style={{ color: tokens.colors.text.muted }}
                          />
                          <div class="flex-1 min-w-0">
                            <div
                              class="text-sm font-medium"
                              style={{ color: tokens.colors.text.primary }}
                            >
                              /{command.name}
                            </div>
                            <div
                              class="text-xs truncate"
                              style={{ color: tokens.colors.text.muted }}
                            >
                              {command.description}
                            </div>
                          </div>
                          <Icon
                            name="chevron-right"
                            class="w-3.5 h-3.5 shrink-0"
                            style={{ color: tokens.colors.text.muted }}
                          />
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            )}
          </For>
        </Show>
      </div>
      <div
        class="px-3 py-1.5 text-xs border-t flex items-center gap-4"
        style={{
          "border-color": tokens.colors.border.default,
          color: tokens.colors.text.muted,
          background: tokens.colors.surface.canvas,
        }}
      >
        <span>
          <kbd
            class="px-1 py-0.5 rounded text-xs"
            style={{
              background: tokens.colors.surface.panel,
              border: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            ↑↓
          </kbd>{" "}
          navigate
        </span>
        <span>
          <kbd
            class="px-1 py-0.5 rounded text-xs"
            style={{
              background: tokens.colors.surface.panel,
              border: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            Tab
          </kbd>{" "}
          complete
        </span>
        <span>
          <kbd
            class="px-1 py-0.5 rounded text-xs"
            style={{
              background: tokens.colors.surface.panel,
              border: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            Esc
          </kbd>{" "}
          close
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Context Mention Menu Component
// ============================================================================

function ContextMentionMenu(props: {
  filter: string;
  selectedIndex: number;
  onSelect: (mention: ContextMention) => void;
  onClose: () => void;
}) {
  let containerRef: HTMLDivElement | undefined;

  const filteredMentions = () => {
    const filter = props.filter.toLowerCase();
    if (!filter) return CONTEXT_MENTIONS;
    return CONTEXT_MENTIONS.filter(
      (m) =>
        m.id.toLowerCase().includes(filter) ||
        m.label.toLowerCase().includes(filter) ||
        m.shortcut.slice(1).toLowerCase().includes(filter)
    );
  };

  createEffect(() => {
    const index = props.selectedIndex;
    if (containerRef) {
      const items = containerRef.querySelectorAll("[data-mention-item]");
      items[index]?.scrollIntoView({ block: "nearest" });
    }
  });

  return (
    <div
      ref={containerRef}
      class="absolute bottom-full left-0 right-0 mb-2 rounded-lg shadow-xl overflow-hidden z-50"
      style={{
        background: tokens.colors.surface.panel,
        border: `1px solid ${tokens.colors.border.default}`,
      }}
    >
      <Show
        when={filteredMentions().length > 0}
        fallback={
          <div class="px-3 py-4 text-center">
            <span class="text-sm" style={{ color: tokens.colors.text.muted }}>
              No mentions found
            </span>
          </div>
        }
      >
        <div class="py-1">
          <For each={filteredMentions()}>
            {(mention, index) => (
              <button
                data-mention-item
                class="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer"
                style={{
                  background:
                    index() === props.selectedIndex
                      ? tokens.colors.interactive.hover
                      : "transparent",
                }}
                onClick={() => props.onSelect(mention)}
              >
                <Icon
                  name={mention.icon}
                  class="w-4 h-4 shrink-0"
                  style={{ color: tokens.colors.semantic.primary }}
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm font-medium"
                      style={{ color: tokens.colors.text.primary }}
                    >
                      {mention.label}
                    </span>
                    <span
                      class="text-xs"
                      style={{ color: tokens.colors.text.muted }}
                    >
                      {mention.shortcut}
                    </span>
                  </div>
                  <p class="text-xs" style={{ color: tokens.colors.text.muted }}>
                    {mention.description}
                  </p>
                </div>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// MessageInput Component
// ============================================================================

export function MessageInput(props: MessageInputProps) {
  const [content, setContent] = createSignal("");
  const [showSlashMenu, setShowSlashMenu] = createSignal(false);
  const [showMentionMenu, setShowMentionMenu] = createSignal(false);
  const [slashFilter, setSlashFilter] = createSignal("");
  const [mentionFilter, setMentionFilter] = createSignal("");
  const [selectedSlashIndex, setSelectedSlashIndex] = createSignal(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = createSignal(0);
  const [attachments, setAttachments] = createSignal<Attachment[]>([]);
  const [isDragging, setIsDragging] = createSignal(false);

  let textareaRef: HTMLTextAreaElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  // Auto-resize textarea
  const resizeTextarea = () => {
    if (!textareaRef) return;
    textareaRef.style.height = "auto";
    const newHeight = Math.min(textareaRef.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textareaRef.style.height = `${newHeight}px`;
  };

  createEffect(() => {
    content();
    resizeTextarea();
  });

  // Reset selection when filter changes
  createEffect(() => {
    slashFilter();
    setSelectedSlashIndex(0);
  });

  createEffect(() => {
    mentionFilter();
    setSelectedMentionIndex(0);
  });

  // Focus textarea on mount
  onMount(() => {
    textareaRef?.focus();
  });

  // ============================================================================
  // Attachment Handling
  // ============================================================================

  const addAttachment = (file: File, path?: string) => {
    const attachment: Attachment = {
      id: generateId(),
      name: file.name,
      path: path || file.name,
      type: isImageFile(file.name) ? "image" : "file",
      size: file.size,
    };

    if (attachment.type === "image") {
      const reader = new FileReader();
      reader.onload = (e) => {
        attachment.preview = e.target?.result as string;
        setAttachments((prev) => [...prev, attachment]);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachments((prev) => [...prev, attachment]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAttachClick = () => {
    fileInputRef?.click();
  };

  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      addAttachment(file);
    }

    target.value = "";
  };

  // ============================================================================
  // Drag & Drop Handling
  // ============================================================================

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as Node | null;
    if (!containerRef?.contains(relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      addAttachment(file);
    }
  };

  // ============================================================================
  // Input Handling
  // ============================================================================

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    setContent(value);

    // Check for slash command at start
    if (value.startsWith("/")) {
      const match = value.match(/^\/(\S*)$/);
      if (match) {
        setSlashFilter(match[1]);
        setShowSlashMenu(true);
        setShowMentionMenu(false);
      } else if (value.match(/^\/\S+\s/)) {
        setShowSlashMenu(false);
      }
    } else {
      setShowSlashMenu(false);
      setSlashFilter("");
    }

    // Check for @ mention
    const atMatch = value.match(/@(\w*)$/);
    if (atMatch && !showSlashMenu()) {
      setMentionFilter(atMatch[1]);
      setShowMentionMenu(true);
    } else if (!value.includes("@") || value.endsWith(" ")) {
      setShowMentionMenu(false);
      setMentionFilter("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Slash menu navigation
    if (showSlashMenu()) {
      const commands = getFilteredSlashCommands();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSlashIndex((i) => Math.min(i + 1, commands.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && commands.length > 0)) {
        e.preventDefault();
        const cmd = commands[selectedSlashIndex()];
        if (cmd) {
          handleSlashCommand(cmd);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }

    // Mention menu navigation
    if (showMentionMenu()) {
      const mentions = getFilteredMentions();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((i) => Math.min(i + 1, mentions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && mentions.length > 0)) {
        e.preventDefault();
        const mention = mentions[selectedMentionIndex()];
        if (mention) {
          handleMentionSelect(mention);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Cancel streaming on Escape
    if (e.key === "Escape" && props.isStreaming && props.onCancel) {
      e.preventDefault();
      props.onCancel();
      return;
    }
  };

  // ============================================================================
  // Command & Mention Handlers
  // ============================================================================

  const getFilteredSlashCommands = () => {
    const filter = slashFilter().toLowerCase();
    if (!filter) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(filter) ||
        cmd.description.toLowerCase().includes(filter)
    );
  };

  const getFilteredMentions = () => {
    const filter = mentionFilter().toLowerCase();
    if (!filter) return CONTEXT_MENTIONS;
    return CONTEXT_MENTIONS.filter(
      (m) =>
        m.id.toLowerCase().includes(filter) ||
        m.label.toLowerCase().includes(filter)
    );
  };

  const handleSlashCommand = (command: SlashCommand) => {
    batch(() => {
      setShowSlashMenu(false);
      setSlashFilter("");
      setContent("/" + command.name + " ");
    });
    textareaRef?.focus();
  };

  const handleMentionSelect = (mention: ContextMention) => {
    const currentContent = content();
    const atIndex = currentContent.lastIndexOf("@");
    if (atIndex !== -1) {
      const newContent = currentContent.slice(0, atIndex) + mention.insertText;
      setContent(newContent);
    } else {
      setContent(currentContent + mention.insertText);
    }
    batch(() => {
      setShowMentionMenu(false);
      setMentionFilter("");
    });
    textareaRef?.focus();
  };

  // ============================================================================
  // Send Handler
  // ============================================================================

  const handleSend = () => {
    const text = content().trim();
    if (!text || props.isStreaming || props.disabled) return;

    const context: MessageContext = {};

    // Add attachments to context
    if (attachments().length > 0) {
      context.attachments = attachments();
    }

    props.onSend(text, Object.keys(context).length > 0 ? context : undefined);

    batch(() => {
      setContent("");
      setAttachments([]);
      setShowSlashMenu(false);
      setShowMentionMenu(false);
    });

    if (textareaRef) {
      textareaRef.style.height = "auto";
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      ref={containerRef}
      class="message-input-container relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        class="hidden"
        multiple
        onChange={handleFileSelect}
      />

      {/* Drag overlay */}
      <Show when={isDragging()}>
        <div
          class="absolute inset-0 z-40 rounded-lg flex items-center justify-center"
          style={{
            background: `color-mix(in srgb, ${tokens.colors.semantic.primary} 15%, transparent)`,
            border: `2px dashed ${tokens.colors.semantic.primary}`,
          }}
        >
          <div class="flex flex-col items-center gap-2">
            <Icon
              name="paperclip"
              class="w-8 h-8"
              style={{ color: tokens.colors.semantic.primary }}
            />
            <span class="text-sm font-medium" style={{ color: tokens.colors.semantic.primary }}>
              Drop files to attach
            </span>
          </div>
        </div>
      </Show>

      {/* Attachments preview */}
      <Show when={attachments().length > 0}>
        <AttachmentsPreview
          attachments={attachments()}
          onRemove={removeAttachment}
        />
      </Show>

      {/* Slash command menu */}
      <Show when={showSlashMenu()}>
        <SlashCommandMenu
          filter={slashFilter()}
          selectedIndex={selectedSlashIndex()}
          onSelect={handleSlashCommand}
          onClose={() => setShowSlashMenu(false)}
          onNavigate={(dir) => {
            const commands = getFilteredSlashCommands();
            if (dir === "up") {
              setSelectedSlashIndex((i) => Math.max(i - 1, 0));
            } else {
              setSelectedSlashIndex((i) => Math.min(i + 1, commands.length - 1));
            }
          }}
        />
      </Show>

      {/* Context mention menu */}
      <Show when={showMentionMenu()}>
        <ContextMentionMenu
          filter={mentionFilter()}
          selectedIndex={selectedMentionIndex()}
          onSelect={handleMentionSelect}
          onClose={() => setShowMentionMenu(false)}
        />
      </Show>

      {/* Main input area - VS Code chat-input-container styling */}
      <div
        class="chat-input-container message-input overflow-hidden transition-all duration-150"
        style={{
          background: tokens.colors.surface.canvas,
          border: `1px solid ${tokens.colors.border.default}`,
          "border-radius": tokens.radius.sm,
          padding: `0 6px 6px 6px`,
        }}
      >
        <textarea
          ref={textareaRef}
          value={content()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder || "Ask anything... (/ for commands)"}
          rows={1}
          disabled={props.disabled}
          class="w-full px-3 py-2.5 resize-none focus:outline-none"
          style={{
            background: "transparent",
            color: tokens.colors.text.primary,
            "font-size": "var(--vscode-chat-font-size-body-m)",
            "min-height": "42px",
            "max-height": `${MAX_TEXTAREA_HEIGHT}px`,
            "line-height": "1.5",
          }}
        />

        {/* Actions bar - VS Code input toolbar styling */}
        <div
          class="message-input-actions flex items-center justify-between px-2 py-1.5 border-t"
          style={{
            "border-color": tokens.colors.border.default,
            background: tokens.colors.surface.panel,
          }}
        >
          {/* Left actions */}
          <div class="flex items-center gap-1">
            {/* Attach button */}
            <button
              class="input-action-btn p-1.5 rounded transition-colors hover:bg-white/5"
              onClick={handleAttachClick}
              title="Attach file (drag & drop supported)"
              disabled={props.isStreaming}
              style={{ color: tokens.colors.text.muted }}
            >
              <Icon name="paperclip" class="w-4 h-4" />
            </button>

            {/* Context mention hints */}
            <div class="flex items-center gap-1 ml-1">
              <For each={CONTEXT_MENTIONS}>
                {(mention) => (
                  <button
                    class="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors hover:bg-white/5"
                    style={{ color: tokens.colors.text.muted }}
                    onClick={() => {
                      setContent((prev) => prev + mention.insertText);
                      textareaRef?.focus();
                    }}
                    title={mention.description}
                  >
                    <Icon name={mention.icon} class="w-3 h-3" />
                    <span class="hidden sm:inline">{mention.label}</span>
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Right actions */}
          <div class="flex items-center gap-1">
            {/* Send/Cancel button */}
            <Show
              when={!props.isStreaming}
              fallback={
                <button
                  class="input-action-btn cancel flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  onClick={() => props.onCancel?.()}
                  disabled={!props.onCancel}
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "var(--cortex-error)",
                    opacity: props.onCancel ? 1 : 0.5,
                    cursor: props.onCancel ? "pointer" : "not-allowed",
                  }}
                >
                  <Icon name="stop" class="w-4 h-4" />
                  <span>Stop</span>
                </button>
              }
            >
              <button
                class="input-action-btn send flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition-all"
                onClick={handleSend}
                disabled={!content().trim() || props.disabled}
                style={{
                  background: content().trim()
                    ? tokens.colors.semantic.primary
                    : tokens.colors.interactive.hover,
                  color: content().trim() ? tokens.colors.surface.panel : tokens.colors.text.muted,
                  opacity: !content().trim() || props.disabled ? 0.5 : 1,
                  cursor:
                    !content().trim() || props.disabled
                      ? "not-allowed"
                      : "pointer",
                  "font-size": "var(--vscode-chat-font-size-body-s)",
                  "border-radius": tokens.radius.sm,
                }}
              >
                <Icon name="paper-plane" class="w-4 h-4" />
                <span>Send</span>
              </button>
            </Show>
          </div>
        </div>
      </div>

      {/* Hints */}
      <div
        class="message-input-hints flex items-center justify-center gap-4 mt-2"
        style={{ color: tokens.colors.text.muted }}
      >
        <span class="text-xs">
          <kbd
            class="px-1 py-0.5 rounded text-xs"
            style={{
              background: tokens.colors.surface.panel,
              border: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            Enter
          </kbd>{" "}
          to send
        </span>
        <span class="text-xs">
          <kbd
            class="px-1 py-0.5 rounded text-xs"
            style={{
              background: tokens.colors.surface.panel,
              border: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            Shift+Enter
          </kbd>{" "}
          for newline
        </span>
      </div>
    </div>
  );
}

export default MessageInput;


import { createSignal, Show, For, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import { usePromptStore } from "@/context/PromptStoreContext";

interface ValidationError {
  field: string;
  message: string;
}

const PLACEHOLDER_EXAMPLES = [
  { placeholder: "{{code}}", description: "Code block to analyze" },
  { placeholder: "{{language}}", description: "Programming language" },
  { placeholder: "{{framework}}", description: "Framework name" },
  { placeholder: "{{topic}}", description: "Subject or topic" },
  { placeholder: "{{text}}", description: "Text content" },
  { placeholder: "{{error}}", description: "Error message" },
  { placeholder: "{{format}}", description: "Output format" },
  { placeholder: "{{length}}", description: "Content length" },
];

export function PromptEditor() {
  const promptStore = usePromptStore();
  let titleInputRef: HTMLInputElement | undefined;

  // Check if we're editing or creating
  const isEditing = () => promptStore.state.editingPrompt !== null;
  const isOpen = () => promptStore.state.editingPrompt !== null || promptStore.state.isCreatingNew;

  // Form state
  const [title, setTitle] = createSignal("");
  const [content, setContent] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [category, setCategory] = createSignal("general");
  const [tags, setTags] = createSignal<string[]>([]);
  const [newTag, setNewTag] = createSignal("");
  const [isFavorite, setIsFavorite] = createSignal(false);
  const [errors, setErrors] = createSignal<ValidationError[]>([]);
  const [showHelp, setShowHelp] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  // Initialize form when editing prompt changes
  createEffect(() => {
    const editing = promptStore.state.editingPrompt;
    if (editing) {
      setTitle(editing.title);
      setContent(editing.content);
      setDescription(editing.description);
      setCategory(editing.category);
      setTags([...editing.tags]);
      setIsFavorite(editing.isFavorite);
      setErrors([]);
    } else if (promptStore.state.isCreatingNew) {
      // Reset form for new prompt
      setTitle("");
      setContent("");
      setDescription("");
      setCategory("general");
      setTags([]);
      setIsFavorite(false);
      setErrors([]);
    }
  });

  // Focus title input when opening
  createEffect(() => {
    if (isOpen() && titleInputRef) {
      setTimeout(() => titleInputRef?.focus(), 100);
    }
  });

  const validate = (): ValidationError[] => {
    const validationErrors: ValidationError[] = [];

    if (!title().trim()) {
      validationErrors.push({ field: "title", message: "Title is required" });
    } else if (title().trim().length < 3) {
      validationErrors.push({ field: "title", message: "Title must be at least 3 characters" });
    }

    if (!content().trim()) {
      validationErrors.push({ field: "content", message: "Prompt content is required" });
    } else if (content().trim().length < 10) {
      validationErrors.push({ field: "content", message: "Prompt content must be at least 10 characters" });
    }

    return validationErrors;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);

    try {
      const promptData = {
        title: title().trim(),
        content: content().trim(),
        description: description().trim(),
        category: category(),
        tags: tags(),
        isFavorite: isFavorite(),
      };

      if (isEditing()) {
        await promptStore.updatePrompt(promptStore.state.editingPrompt!.id, promptData);
      } else {
        await promptStore.createPrompt(promptData);
      }

      promptStore.closeEditor();
    } catch (e) {
      setErrors([{ field: "general", message: String(e) }]);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    const tag = newTag().trim().toLowerCase();
    if (tag && !tags().includes(tag)) {
      setTags([...tags(), tag]);
    }
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags().filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Backspace" && newTag() === "" && tags().length > 0) {
      setTags(tags().slice(0, -1));
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.querySelector("textarea[data-prompt-content]") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content().slice(0, start) + placeholder + content().slice(end);
      setContent(newContent);

      // Set cursor position after placeholder
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
        textarea.focus();
      }, 0);
    } else {
      setContent(content() + placeholder);
    }
  };

  const getFieldError = (field: string): string | undefined => {
    return errors().find((e) => e.field === field)?.message;
  };

  const handleClose = () => {
    promptStore.closeEditor();
  };

  return (
    <Show when={isOpen()}>
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div
          class="w-[700px] max-h-[90vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
          style={{ background: "var(--surface-base)", border: "1px solid var(--border-base)" }}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded flex items-center justify-center"
                style={{ background: "var(--cortex-info)20" }}
              >
                <Icon name="message" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />
              </div>
              <div>
                <h2 class="font-semibold" style={{ color: "var(--text-strong)" }}>
                  {isEditing() ? "Edit Prompt" : "Create Prompt"}
                </h2>
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {isEditing()
                    ? `Editing: ${promptStore.state.editingPrompt?.title}`
                    : "Create a new reusable prompt template"}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                onClick={() => setShowHelp(!showHelp())}
                class="p-2 rounded hover:bg-[var(--surface-hover)]"
                title="Help"
              >
                <Icon name="circle-info" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
              </button>
              <button
                onClick={handleClose}
                class="p-2 rounded hover:bg-[var(--surface-hover)]"
              >
                <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
              </button>
            </div>
          </div>

          {/* Help Section */}
          <Show when={showHelp()}>
            <div
              class="px-4 py-3 border-b text-xs"
              style={{
                "border-color": "var(--border-base)",
                background: "var(--cortex-info)10",
                color: "var(--text-base)",
              }}
            >
              <div class="font-semibold mb-2" style={{ color: "var(--text-strong)" }}>
                Template Placeholders
              </div>
              <p class="mb-2" style={{ color: "var(--text-weak)" }}>
                Use placeholders like {"{{variable}}"} to create dynamic prompts. Click to insert:
              </p>
              <div class="flex flex-wrap gap-2">
                <For each={PLACEHOLDER_EXAMPLES}>
                  {(item) => (
                    <button
                      onClick={() => insertPlaceholder(item.placeholder)}
                      class="px-2 py-1 rounded text-xs font-mono hover:bg-[var(--surface-hover)]"
                      style={{
                        background: "var(--ui-panel-bg)",
                        color: "var(--cortex-syntax-variable)",
                      }}
                      title={item.description}
                    >
                      {item.placeholder}
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Form Content */}
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            {/* General Error */}
            <Show when={getFieldError("general")}>
              <div
                class="flex items-center gap-2 p-3 rounded text-sm"
                style={{ background: "var(--cortex-error)20", color: "var(--cortex-error)" }}
              >
                <Icon name="circle-exclamation" class="w-4 h-4 shrink-0" />
                {getFieldError("general")}
              </div>
            </Show>

            {/* Title */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Title *
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                placeholder="e.g., Code Review Helper"
                class="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--text-base)",
                  border: getFieldError("title")
                    ? "1px solid var(--cortex-error)"
                    : "1px solid var(--border-base)",
                  outline: "none",
                }}
              />
              <Show when={getFieldError("title")}>
                <p class="text-xs mt-1 text-red-400">{getFieldError("title")}</p>
              </Show>
            </div>

            {/* Description */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Description
              </label>
              <input
                type="text"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder="Brief description of what this prompt does"
                class="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--text-base)",
                  border: "1px solid var(--border-base)",
                  outline: "none",
                }}
              />
            </div>

            {/* Category and Favorite */}
            <div class="flex gap-4">
              <div class="flex-1">
                <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                  <Icon name="folder" class="w-4 h-4 inline mr-1.5" />
                  Category
                </label>
                <select
                  value={category()}
                  onChange={(e) => setCategory(e.currentTarget.value)}
                  class="w-full px-3 py-2 rounded text-sm"
                  style={{
                    background: "var(--surface-hover)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-base)",
                    outline: "none",
                  }}
                >
                  <For each={promptStore.state.categories}>
                    {(cat) => <option value={cat.id}>{cat.name}</option>}
                  </For>
                </select>
              </div>

              <div class="flex items-end">
                <button
                  onClick={() => setIsFavorite(!isFavorite())}
                  class="flex items-center gap-2 px-4 py-2 rounded text-sm"
                  style={{
                    background: isFavorite() ? "var(--cortex-warning)20" : "var(--surface-hover)",
                    color: isFavorite() ? "var(--cortex-warning)" : "var(--text-base)",
                    border: "1px solid var(--border-base)",
                  }}
                >
                  <Icon
                    name="star"
                    class="w-4 h-4"
                    style={{ color: isFavorite() ? "var(--cortex-warning)" : "currentColor" }}
                  />
                  Favorite
                </button>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                <Icon name="hashtag" class="w-4 h-4 inline mr-1.5" />
                Tags
              </label>
              <div
                class="flex flex-wrap gap-1.5 p-2 rounded min-h-[42px]"
                style={{
                  background: "var(--surface-hover)",
                  border: "1px solid var(--border-base)",
                }}
              >
                <For each={tags()}>
                  {(tag) => (
                    <span
                      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                      style={{
                        background: "var(--cortex-info)20",
                        color: "var(--cortex-info)",
                      }}
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        class="hover:text-red-400"
                      >
                        <Icon name="xmark" class="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </For>
                <input
                  type="text"
                  value={newTag()}
                  onInput={(e) => setNewTag(e.currentTarget.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleAddTag}
                  placeholder={tags().length === 0 ? "Add tags..." : ""}
                  class="flex-1 min-w-[100px] bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-base)" }}
                />
              </div>
              <p class="text-xs mt-1" style={{ color: "var(--text-weak)" }}>
                Press Enter to add a tag
              </p>
            </div>

            {/* Content */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Prompt Content *
              </label>
              <textarea
                data-prompt-content
                value={content()}
                onInput={(e) => setContent(e.currentTarget.value)}
                placeholder={`Enter your prompt template here...

Example:
Please review the following code and provide feedback on:
1. Code quality
2. Potential bugs
3. Performance

\`\`\`
{{code}}
\`\`\``}
                rows={12}
                class="w-full px-3 py-2 rounded text-sm font-mono resize-none"
                style={{
                  background: "var(--ui-panel-bg)",
                  color: "var(--cortex-text-primary)",
                  border: getFieldError("content")
                    ? "1px solid var(--cortex-error)"
                    : "1px solid var(--border-base)",
                  outline: "none",
                  "line-height": "1.5",
                }}
              />
              <Show when={getFieldError("content")}>
                <p class="text-xs mt-1 text-red-400">{getFieldError("content")}</p>
              </Show>
              <div class="flex items-center justify-between mt-1">
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  Use {"{{placeholder}}"} syntax for dynamic values
                </p>
                <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {content().length} characters
                </span>
              </div>
            </div>

            {/* Preview */}
            <Show when={content().trim()}>
              <div>
                <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                  Preview
                </label>
                <div
                  class="px-3 py-2 rounded text-sm overflow-x-auto"
                  style={{
                    background: "var(--surface-hover)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-base)",
                    "white-space": "pre-wrap",
                    "max-height": "200px",
                    "overflow-y": "auto",
                  }}
                >
                  {content().split(/(\{\{[^}]+\}\})/).map((part, _i) => {
                    if (part.startsWith("{{") && part.endsWith("}}")) {
                      return (
                        <span
                          style={{
                            background: "var(--cortex-info)20",
                            color: "var(--cortex-info)",
                            padding: "0 4px",
                            "border-radius": "var(--cortex-radius-sm)",
                          }}
                        >
                          {part}
                        </span>
                      );
                    }
                    return part;
                  })}
                </div>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-end gap-3 px-4 py-3 border-t shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <button
              onClick={handleClose}
              class="px-4 py-2 rounded text-sm font-medium"
              style={{
                background: "var(--surface-hover)",
                color: "var(--text-base)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving()}
              class="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--cortex-info)", color: "white" }}
            >
              <Icon name="floppy-disk" class="w-4 h-4" />
              {saving() ? "Saving..." : isEditing() ? "Save Changes" : "Create Prompt"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}


/**
 * Rules Editor Component
 *
 * Modal editor for creating and editing AI instruction rules
 * with syntax highlighting and live preview.
 */

import { createSignal, Show, For, createEffect, onMount, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { useRulesLibrary, type RuleSource } from "@/context/RulesLibraryContext";
import { Button, IconButton, Input, Textarea } from "@/components/ui";

const AVAILABLE_TAGS = [
  "general",
  "quality",
  "typescript",
  "javascript",
  "rust",
  "python",
  "testing",
  "documentation",
  "security",
  "performance",
  "style",
  "architecture",
  "language",
];

const SOURCE_OPTIONS: { value: RuleSource; label: string; description: string }[] = [
  { value: "user", label: "Custom", description: "Personal rules saved across projects" },
  { value: "project", label: "Project", description: "Rules specific to this project" },
];

interface ValidationError {
  field: string;
  message: string;
}

export function RulesEditor() {
  const rulesLibrary = useRulesLibrary();
  const editing = () => rulesLibrary.state.editingRule;

  // Form state
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [content, setContent] = createSignal("");
  const [enabled, setEnabled] = createSignal(true);
  const [priority, setPriority] = createSignal(50);
  const [tags, setTags] = createSignal<string[]>([]);
  const [source, setSource] = createSignal<RuleSource>("user");
  const [customTag, setCustomTag] = createSignal("");
  const [errors, setErrors] = createSignal<ValidationError[]>([]);
  const [showHelp, setShowHelp] = createSignal(false);
  const [showPreview, setShowPreview] = createSignal(false);
  const [estimatedTokens, setEstimatedTokens] = createSignal(0);

  // Initialize form when editing rule changes
  createEffect(() => {
    const edit = editing();
    if (edit) {
      setName(edit.rule.name);
      setDescription(edit.rule.description);
      setContent(edit.rule.content);
      setEnabled(edit.rule.enabled);
      setPriority(edit.rule.priority);
      setTags([...edit.rule.tags]);
      setSource(edit.rule.source);
      setErrors([]);
      updateTokenEstimate(edit.rule.content);
    }
  });

  const isNewRule = () => {
    const edit = editing();
    return edit?.rule.id === "";
  };

  const updateTokenEstimate = (text: string) => {
    setEstimatedTokens(rulesLibrary.estimateTokenCount(text));
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    updateTokenEstimate(value);
  };

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags().includes(trimmedTag)) {
      setTags([...tags(), trimmedTag]);
    }
    setCustomTag("");
  };

  const removeTag = (tag: string) => {
    setTags(tags().filter(t => t !== tag));
  };

  const handleCustomTagKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && customTag().trim()) {
      e.preventDefault();
      addTag(customTag());
    }
  };

  const validate = (): ValidationError[] => {
    const validationErrors: ValidationError[] = [];

    if (!name().trim()) {
      validationErrors.push({ field: "name", message: "Rule name is required" });
    }

    if (!content().trim()) {
      validationErrors.push({ field: "content", message: "Rule content is required" });
    }

    const priorityValue = priority();
    if (priorityValue < 0 || priorityValue > 100) {
      validationErrors.push({
        field: "priority",
        message: "Priority must be between 0 and 100",
      });
    }

    return validationErrors;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const ruleData = {
      name: name().trim(),
      description: description().trim(),
      content: rulesLibrary.formatRuleContent(content()),
      enabled: enabled(),
      priority: priority(),
      tags: tags(),
      source: source(),
    };

    try {
      if (isNewRule()) {
        await rulesLibrary.createRule(ruleData, editing()?.filePath);
      } else {
        await rulesLibrary.updateRule(editing()!.rule.id, ruleData);
      }
      rulesLibrary.closeEditor();
    } catch (e) {
      setErrors([{ field: "general", message: String(e) }]);
    }
  };

  const getFieldError = (field: string): string | undefined => {
    return errors().find((e) => e.field === field)?.message;
  };

  // Handle Escape key to close
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      rulesLibrary.closeEditor();
    }
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Show when={editing()}>
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) rulesLibrary.closeEditor();
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
                <Icon name="book-open" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />
              </div>
              <div>
                <h2 class="font-semibold" style={{ color: "var(--text-strong)" }}>
                  {isNewRule() ? "Create Rule" : "Edit Rule"}
                </h2>
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {isNewRule()
                    ? "Define a new AI instruction rule"
                    : `Editing: ${editing()?.rule.name}`}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <IconButton
                onClick={() => setShowPreview(!showPreview())}
                variant="ghost"
                active={showPreview()}
                tooltip="Preview"
              >
                <Icon name="eye" style={{ width: "16px", height: "16px" }} />
              </IconButton>
              <IconButton
                onClick={() => setShowHelp(!showHelp())}
                variant="ghost"
                active={showHelp()}
                tooltip="Help"
              >
                <Icon name="circle-info" style={{ width: "16px", height: "16px", color: showHelp() ? "var(--jb-border-focus)" : "var(--jb-text-muted-color)" }} />
              </IconButton>
              <IconButton
                onClick={() => rulesLibrary.closeEditor()}
                variant="ghost"
              >
                <Icon name="xmark" style={{ width: "20px", height: "20px", color: "var(--jb-text-muted-color)" }} />
              </IconButton>
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
                Writing Effective Rules
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <div class="font-medium mb-1">Do:</div>
                  <ul class="list-disc list-inside space-y-0.5 text-foreground-muted">
                    <li>Be specific and actionable</li>
                    <li>Use bullet points for clarity</li>
                    <li>Include examples when helpful</li>
                    <li>Focus on "why" not just "what"</li>
                  </ul>
                </div>
                <div>
                  <div class="font-medium mb-1">Avoid:</div>
                  <ul class="list-disc list-inside space-y-0.5 text-foreground-muted">
                    <li>Vague or general statements</li>
                    <li>Contradicting other rules</li>
                    <li>Overly long rules (token limit)</li>
                    <li>Duplicating built-in guidelines</li>
                  </ul>
                </div>
              </div>
              <div class="mt-2 text-[10px] text-foreground-muted">
                Tip: Use Markdown formatting in rule content. Rules with higher priority are applied first.
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

            {/* Row: Source & Enabled */}
            <div class="grid grid-cols-2 gap-4">
              {/* Source */}
              <div>
                <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                  Rule Type
                </label>
                <select
                  value={source()}
                  onChange={(e) => setSource(e.currentTarget.value as RuleSource)}
                  disabled={!isNewRule()}
                  class="w-full px-3 py-2 rounded text-sm"
                  style={{
                    background: "var(--surface-hover)",
                    color: "var(--text-base)",
                    border: "1px solid var(--border-base)",
                    outline: "none",
                    opacity: isNewRule() ? 1 : 0.7,
                  }}
                >
                  <For each={SOURCE_OPTIONS}>
                    {(option) => (
                      <option value={option.value}>{option.label} - {option.description}</option>
                    )}
                  </For>
                </select>
              </div>

              {/* Priority & Enabled */}
              <div class="flex gap-4">
                <div class="flex-1">
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                    Priority (0-100)
                  </label>
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={priority()}
                      onInput={(e) => setPriority(parseInt(e.currentTarget.value, 10) || 50)}
                      class="w-20"
                      error={getFieldError("priority")}
                    />
                    <div class="flex flex-col">
                      <IconButton
                        onClick={() => setPriority(Math.min(100, priority() + 10))}
                        variant="ghost"
                        size="sm"
                      >
                        <Icon name="arrow-up" style={{ width: "12px", height: "12px" }} />
                      </IconButton>
                      <IconButton
                        onClick={() => setPriority(Math.max(0, priority() - 10))}
                        variant="ghost"
                        size="sm"
                      >
                        <Icon name="arrow-down" style={{ width: "12px", height: "12px" }} />
                      </IconButton>
                    </div>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                    Status
                  </label>
                  <Button
                    type="button"
                    onClick={() => setEnabled(!enabled())}
                    variant="secondary"
                    style={
                      enabled()
                        ? { background: "rgba(34, 197, 94, 0.2)", color: "rgb(34, 197, 94)", border: "1px solid rgba(34, 197, 94, 0.3)" }
                        : { background: "rgba(156, 163, 175, 0.2)", color: "rgb(156, 163, 175)", border: "1px solid rgba(156, 163, 175, 0.3)" }
                    }
                  >
                    {enabled() ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Name *
              </label>
              <Input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="e.g., TypeScript Best Practices"
                class="w-full"
                error={getFieldError("name")}
              />
              <Show when={getFieldError("name")}>
                <p class="text-xs mt-1 text-red-400">{getFieldError("name")}</p>
              </Show>
            </div>

            {/* Description */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Description
              </label>
              <Input
                type="text"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder="Brief description of what this rule does"
                class="w-full"
              />
            </div>

            {/* Tags */}
            <div>
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                Tags
              </label>
              <div class="flex flex-wrap gap-2 mb-2">
                <For each={tags()}>
                  {(tag) => (
                    <span
                      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                      style={{ background: "var(--cortex-info)20", color: "var(--cortex-info)" }}
                    >
                      <Icon name="hashtag" class="w-3 h-3" />
                      {tag}
                      <IconButton
                        onClick={() => removeTag(tag)}
                        variant="ghost"
                        size="sm"
                        style={{ "margin-left": "4px", padding: "0", width: "16px", height: "16px" }}
                      >
                        <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
                      </IconButton>
                    </span>
                  )}
                </For>
              </div>
              <div class="flex items-center gap-2">
                <div class="flex flex-wrap gap-1">
                  <For each={AVAILABLE_TAGS.filter(t => !tags().includes(t))}>
                    {(tag) => (
                      <Button
                        type="button"
                        onClick={() => addTag(tag)}
                        variant="secondary"
                        size="sm"
                        style={{ "font-size": "11px" }}
                      >
                        + {tag}
                      </Button>
                    )}
                  </For>
                </div>
              </div>
              <div class="flex items-center gap-2 mt-2">
                <Input
                  type="text"
                  value={customTag()}
                  onInput={(e) => setCustomTag(e.currentTarget.value)}
                  onKeyDown={handleCustomTagKeyDown}
                  placeholder="Add custom tag..."
                  class="flex-1"
                  size="sm"
                />
                <IconButton
                  onClick={() => addTag(customTag())}
                  disabled={!customTag().trim()}
                  variant="ghost"
                  size="sm"
                >
                  <Icon name="plus" style={{ width: "12px", height: "12px" }} />
                </IconButton>
              </div>
            </div>

            {/* Content */}
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
                  Rule Content *
                </label>
                <span class="text-xs text-foreground-muted">
                  ~{estimatedTokens()} tokens
                </span>
              </div>
              <Textarea
                value={content()}
                onInput={(e) => handleContentChange(e.currentTarget.value)}
                placeholder={`Enter your AI instruction rule here...

Example:
When writing TypeScript code:
- Use explicit types instead of 'any'
- Prefer interfaces over type aliases for object types
- Use strict null checks
- Leverage union types and discriminated unions`}
                rows={12}
                class="w-full font-mono resize-none"
                error={getFieldError("content")}
                style={{
                  background: "var(--ui-panel-bg)",
                  color: "var(--cortex-text-primary)",
                  "line-height": "1.5",
                }}
              />
              <Show when={getFieldError("content")}>
                <p class="text-xs mt-1 text-red-400">{getFieldError("content")}</p>
              </Show>
            </div>

            {/* Preview */}
            <Show when={showPreview()}>
              <div>
                <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
                  Preview (how AI will see this rule)
                </label>
                <div
                  class="w-full px-3 py-2 rounded text-sm font-mono overflow-x-auto"
                  style={{
                    background: "var(--ui-panel-bg)",
                    color: "var(--cortex-syntax-variable)",
                    border: "1px solid var(--border-base)",
                    "white-space": "pre-wrap",
                    "min-height": "80px",
                    "max-height": "200px",
                    "line-height": "1.5",
                  }}
                >
                  <Show when={name()}>
                    <div style={{ color: "var(--cortex-syntax-keyword)" }}>## {name()}</div>
                    <Show when={description()}>
                      <div style={{ color: "var(--cortex-syntax-comment)" }}>// {description()}</div>
                    </Show>
                    <br />
                  </Show>
                  {content() || "Preview will appear here..."}
                </div>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-between px-4 py-3 border-t shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <div class="text-xs text-foreground-muted">
              <Show when={estimatedTokens() > 1000}>
                <span class="text-yellow-500">
                  ⚠ Large rule ({estimatedTokens()} tokens). Consider splitting.
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-3">
              <Button
                onClick={() => rulesLibrary.closeEditor()}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                variant="primary"
                class="flex items-center gap-2"
              >
                <Icon name="floppy-disk" class="w-4 h-4" />
                {isNewRule() ? "Create Rule" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}


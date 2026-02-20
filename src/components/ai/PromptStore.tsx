import { createSignal, Show, For, createMemo, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import { usePromptStore, type SavedPrompt } from "@/context/PromptStoreContext";
import { Button, IconButton, Input, Textarea, Text, Badge } from "@/components/ui";

export function PromptStore() {
  const promptStore = usePromptStore();
  const [showFilters, setShowFilters] = createSignal(false);
  const [showSortMenu, setShowSortMenu] = createSignal(false);

  const filteredPrompts = createMemo(() => promptStore.getFilteredPrompts());
  const allTags = createMemo(() => promptStore.getAllTags());

  // Check if we're in editor mode (editing or creating)
  const isEditorMode = createMemo(() => 
    promptStore.state.editingPrompt !== null || promptStore.state.isCreatingNew
  );

  const handleDeletePrompt = async (e: Event, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this prompt?")) {
      await promptStore.deletePrompt(id);
    }
  };

  const handleDuplicatePrompt = async (e: Event, id: string) => {
    e.stopPropagation();
    await promptStore.duplicatePrompt(id);
  };

  const handleToggleFavorite = async (e: Event, id: string) => {
    e.stopPropagation();
    await promptStore.toggleFavorite(id);
  };

  const handleInsertPrompt = (prompt: SavedPrompt) => {
    promptStore.insertPromptIntoChat(prompt);
  };

  const getCategoryColor = (categoryId: string): string => {
    const category = promptStore.state.categories.find((c) => c.id === categoryId);
    return category?.color || "var(--cortex-text-inactive)";
  };

  const getCategoryName = (categoryId: string): string => {
    const category = promptStore.state.categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown";
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getSortLabel = (): string => {
    switch (promptStore.state.sortBy) {
      case "title":
        return "Name";
      case "createdAt":
        return "Created";
      case "updatedAt":
        return "Modified";
      case "usageCount":
        return "Usage";
      default:
        return "Sort";
    }
  };

  return (
    <Show when={promptStore.state.showPanel}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) promptStore.closePanel();
        }}
      >
        <div
          class="w-[850px] max-h-[85vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
          style={{ background: "var(--surface-base)", border: "1px solid var(--border-base)" }}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ "border-color": "var(--border-base)" }}
          >
            <div class="flex items-center gap-3">
              <Show when={isEditorMode()}>
                <IconButton
                  onClick={() => promptStore.closeEditor()}
                  variant="ghost"
                  size="sm"
                  tooltip="Back to prompts"
                >
                  <Icon name="arrow-left" style={{ width: "20px", height: "20px" }} />
                </IconButton>
              </Show>
              <div
                class="w-8 h-8 rounded flex items-center justify-center"
                style={{ background: "var(--cortex-info)20" }}
              >
                <Icon name="message" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />
              </div>
              <div>
                <h2 class="font-semibold" style={{ color: "var(--text-strong)" }}>
                  <Show when={isEditorMode()} fallback="Prompt Store">
                    {promptStore.state.isCreatingNew ? "New Prompt" : "Edit Prompt"}
                  </Show>
                </h2>
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  <Show when={isEditorMode()} fallback={`${promptStore.state.prompts.length} prompts saved`}>
                    {promptStore.state.isCreatingNew ? "Create a new prompt template" : "Modify your prompt"}
                  </Show>
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Show when={!isEditorMode()}>
                <IconButton
                  onClick={() => promptStore.importFromFile()}
                  variant="ghost"
                  size="sm"
                  tooltip="Import prompts"
                >
                  <Icon name="upload" style={{ width: "16px", height: "16px" }} />
                </IconButton>
                <IconButton
                  onClick={() => promptStore.exportToFile()}
                  variant="ghost"
                  size="sm"
                  tooltip="Export all prompts"
                >
                  <Icon name="download" style={{ width: "16px", height: "16px" }} />
                </IconButton>
                <Button
                  onClick={() => promptStore.createNewPrompt()}
                  variant="primary"
                  size="sm"
                  icon={<Icon name="plus" style={{ width: "16px", height: "16px" }} />}
                >
                  New Prompt
                </Button>
              </Show>
              <IconButton
                onClick={() => promptStore.closePanel()}
                variant="ghost"
                size="sm"
              >
                <Icon name="xmark" style={{ width: "20px", height: "20px" }} />
              </IconButton>
            </div>
          </div>

          {/* Editor Mode */}
          <Show when={isEditorMode()}>
            <PromptEditor
              editingPrompt={promptStore.state.editingPrompt}
              isCreatingNew={promptStore.state.isCreatingNew}
              categories={promptStore.state.categories}
              allTags={allTags()}
              onSave={async (promptData) => {
                if (promptStore.state.isCreatingNew) {
                  await promptStore.createPrompt(promptData);
                } else if (promptStore.state.editingPrompt) {
                  await promptStore.updatePrompt(promptStore.state.editingPrompt.id, promptData);
                }
                promptStore.closeEditor();
              }}
              onCancel={() => promptStore.closeEditor()}
            />
          </Show>

          {/* List Mode */}
          <Show when={!isEditorMode()}>
            {/* Search and Filter Bar */}
            <div
              class="flex items-center gap-3 px-4 py-2 border-b shrink-0"
              style={{ "border-color": "var(--border-base)" }}
            >
            {/* Search */}
            <div class="flex-1">
              <Input
                type="text"
                placeholder="Search prompts..."
                value={promptStore.state.searchQuery}
                onInput={(e) => promptStore.setSearchQuery(e.currentTarget.value)}
                size="sm"
              />
            </div>

            {/* Category Filter */}
            <select
              value={promptStore.state.selectedCategory || ""}
              onChange={(e) =>
                promptStore.setSelectedCategory(e.currentTarget.value || null)
              }
              class="px-3 py-1.5 rounded text-sm"
              style={{
                background: "var(--surface-hover)",
                color: "var(--text-base)",
                border: "1px solid var(--border-base)",
                outline: "none",
              }}
            >
              <option value="">All Categories</option>
              <For each={promptStore.state.categories}>
                {(cat) => (
                  <option value={cat.id}>
                    {cat.name} ({cat.promptCount})
                  </option>
                )}
              </For>
            </select>

            {/* Favorites Toggle */}
            <IconButton
              onClick={() =>
                promptStore.setShowFavoritesOnly(!promptStore.state.showFavoritesOnly)
              }
              variant="ghost"
              active={promptStore.state.showFavoritesOnly}
              size="sm"
            >
              <Icon name="star" style={{ width: "16px", height: "16px", color: promptStore.state.showFavoritesOnly ? "var(--cortex-warning)" : "currentColor" }} />
            </IconButton>

            {/* Filters Toggle */}
            <IconButton
              onClick={() => setShowFilters(!showFilters())}
              variant="ghost"
              active={showFilters()}
              size="sm"
            >
              <Icon name="filter" style={{ width: "16px", height: "16px" }} />
            </IconButton>

            {/* Sort Menu */}
            <div class="relative">
              <Button
                onClick={() => setShowSortMenu(!showSortMenu())}
                variant="ghost"
                size="sm"
                iconRight={<Icon name="chevron-down" style={{ width: "12px", height: "12px" }} />}
              >
                {getSortLabel()}
              </Button>

              <Show when={showSortMenu()}>
                <div
                  class="absolute right-0 top-full mt-1 w-40 rounded-lg shadow-lg overflow-hidden z-10"
                  style={{
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border-base)",
                  }}
                >
                  <SortOption
                    label="Name"
                    iconName="folder"
                    active={promptStore.state.sortBy === "title"}
                    onClick={() => {
                      promptStore.setSortBy("title");
                      setShowSortMenu(false);
                    }}
                  />
                  <SortOption
                    label="Created"
                    iconName="clock"
                    active={promptStore.state.sortBy === "createdAt"}
                    onClick={() => {
                      promptStore.setSortBy("createdAt");
                      setShowSortMenu(false);
                    }}
                  />
                  <SortOption
                    label="Modified"
                    iconName="pen"
                    active={promptStore.state.sortBy === "updatedAt"}
                    onClick={() => {
                      promptStore.setSortBy("updatedAt");
                      setShowSortMenu(false);
                    }}
                  />
                  <SortOption
                    label="Usage"
                    iconName="wave-pulse"
                    active={promptStore.state.sortBy === "usageCount"}
                    onClick={() => {
                      promptStore.setSortBy("usageCount");
                      setShowSortMenu(false);
                    }}
                  />
                  <div
                    class="border-t my-1"
                    style={{ "border-color": "var(--border-base)" }}
                  />
                  <Button
                    class="w-full justify-between"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      promptStore.setSortOrder(
                        promptStore.state.sortOrder === "asc" ? "desc" : "asc"
                      );
                      setShowSortMenu(false);
                    }}
                  >
                    <Text variant="body">
                      {promptStore.state.sortOrder === "asc" ? "Ascending" : "Descending"}
                    </Text>
                  </Button>
                </div>
              </Show>
            </div>
          </div>

          {/* Tags Filter (expandable) */}
          <Show when={showFilters()}>
            <div
              class="px-4 py-2 border-b"
              style={{ "border-color": "var(--border-base)" }}
            >
              <div class="flex items-center gap-2 flex-wrap">
                <Text variant="muted" weight="medium">
                  Tags:
                </Text>
                <For each={allTags()}>
                  {(tag) => (
                    <Button
                      onClick={() => promptStore.toggleTag(tag)}
                      variant={promptStore.state.selectedTags.includes(tag) ? "secondary" : "ghost"}
                      size="sm"
                      style={{ "border-radius": "var(--cortex-radius-full)", ...(promptStore.state.selectedTags.includes(tag) ? { background: "var(--cortex-info)20", color: "var(--cortex-info)" } : {}) }}
                    >
                      {tag}
                    </Button>
                  )}
                </For>
                <Show when={promptStore.state.selectedTags.length > 0}>
                  <Button
                    onClick={() => promptStore.clearFilters()}
                    variant="ghost"
                    size="sm"
                    style={{ "text-decoration": "underline" }}
                  >
                    Clear all
                  </Button>
                </Show>
              </div>
            </div>
          </Show>

          {/* Prompts List */}
          <div class="flex-1 overflow-y-auto">
            <Show
              when={filteredPrompts().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-12">
                  <div
                    class="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: "var(--surface-hover)" }}
                  >
                    <Icon
                      name="message"
                      class="w-8 h-8"
                      style={{ color: "var(--text-weak)" }}
                    />
                  </div>
                  <p
                    class="text-sm font-medium mb-1"
                    style={{ color: "var(--text-strong)" }}
                  >
                    No prompts found
                  </p>
                  <Text variant="muted" style={{ "margin-bottom": "16px" }}>
                    {promptStore.state.searchQuery
                      ? "Try a different search term"
                      : "Create your first prompt to get started"}
                  </Text>
                  <Button
                    onClick={() => promptStore.createNewPrompt()}
                    variant="primary"
                    size="sm"
                  >
                    Create Prompt
                  </Button>
                </div>
              }
            >
              <div class="p-2">
                <For each={filteredPrompts()}>
                  {(prompt) => (
                    <PromptItem
                      prompt={prompt}
                      categoryColor={getCategoryColor(prompt.category)}
                      categoryName={getCategoryName(prompt.category)}
                      formatDate={formatDate}
                      onEdit={() => promptStore.editPrompt(prompt)}
                      onDelete={(e) => handleDeletePrompt(e, prompt.id)}
                      onDuplicate={(e) => handleDuplicatePrompt(e, prompt.id)}
                      onToggleFavorite={(e) => handleToggleFavorite(e, prompt.id)}
                      onInsert={() => handleInsertPrompt(prompt)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>

            {/* Footer */}
            <div
              class="flex items-center justify-between px-4 py-2 border-t shrink-0 text-xs"
              style={{
                "border-color": "var(--border-base)",
                color: "var(--text-weak)",
              }}
            >
              <span>
                Showing {filteredPrompts().length} of {promptStore.state.prompts.length} prompts
              </span>
              <span>Click a prompt to insert it into chat</span>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Sort Option Component
// ============================================================================

interface SortOptionProps {
  label: string;
  iconName: string;
  active: boolean;
  onClick: () => void;
}

function SortOption(props: SortOptionProps) {
  return (
    <Button
      class="w-full justify-start gap-2"
      variant="ghost"
      size="sm"
      onClick={props.onClick}
      style={{
        background: props.active ? "var(--surface-active)" : "transparent",
      }}
    >
      <Icon name={props.iconName} class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
      <Text variant="body">{props.label}</Text>
    </Button>
  );
}

// ============================================================================
// Prompt Item Component
// ============================================================================

interface PromptItemProps {
  prompt: SavedPrompt;
  categoryColor: string;
  categoryName: string;
  formatDate: (date: string) => string;
  onEdit: () => void;
  onDelete: (e: Event) => void;
  onDuplicate: (e: Event) => void;
  onToggleFavorite: (e: Event) => void;
  onInsert: () => void;
}

function PromptItem(props: PromptItemProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const truncateContent = (content: string, maxLength: number = 150): string => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength).trim() + "...";
  };

  return (
    <div
      class="mb-2 rounded-lg border cursor-pointer transition-all"
      style={{
        background: isHovered() ? "var(--surface-hover)" : "var(--surface-base)",
        "border-color": isHovered() ? "var(--border-strong)" : "var(--border-base)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={props.onInsert}
    >
      <div class="p-3">
        {/* Header Row */}
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="flex items-center gap-2 min-w-0">
            {/* Category Badge */}
            <span
              class="shrink-0 px-2 py-0.5 rounded text-xs font-medium"
              style={{
                background: `${props.categoryColor}20`,
                color: props.categoryColor,
              }}
            >
              {props.categoryName}
            </span>

            {/* Title */}
            <h3
              class="font-medium truncate"
              style={{ color: "var(--text-strong)" }}
            >
              {props.prompt.title}
            </h3>

            {/* Favorite Star */}
            <Show when={props.prompt.isFavorite}>
              <Icon
                name="star"
                class="w-4 h-4 shrink-0"
                style={{ color: "var(--cortex-warning)" }}
              />
            </Show>
          </div>

          {/* Actions */}
          <div
            class="flex items-center gap-1 shrink-0 transition-opacity"
            style={{ opacity: isHovered() ? 1 : 0 }}
          >
            <IconButton
              onClick={props.onToggleFavorite}
              variant="ghost"
              size="sm"
              tooltip={props.prompt.isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Icon name="star" style={{ width: "14px", height: "14px", color: props.prompt.isFavorite ? "var(--cortex-warning)" : "var(--jb-text-muted-color)" }} />
            </IconButton>
            <IconButton
              onClick={props.onDuplicate}
              variant="ghost"
              size="sm"
              tooltip="Duplicate"
            >
              <Icon name="copy" style={{ width: "14px", height: "14px", color: "var(--jb-text-muted-color)" }} />
            </IconButton>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                props.onEdit();
              }}
              variant="ghost"
              size="sm"
              tooltip="Edit"
            >
              <Icon name="pen" style={{ width: "14px", height: "14px", color: "var(--jb-text-muted-color)" }} />
            </IconButton>
            <IconButton
              onClick={props.onDelete}
              variant="ghost"
              size="sm"
              tooltip="Delete"
            >
              <Icon name="trash" style={{ width: "14px", height: "14px", color: "var(--cortex-error)" }} />
            </IconButton>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                props.onInsert();
              }}
              variant="ghost"
              size="sm"
              tooltip="Insert into chat"
            >
              <Icon name="play" style={{ width: "14px", height: "14px", color: "var(--cortex-success)" }} />
            </IconButton>
          </div>
        </div>

        {/* Description */}
        <Show when={props.prompt.description}>
          <p
            class="text-sm mb-2 line-clamp-1"
            style={{ color: "var(--text-base)" }}
          >
            {props.prompt.description}
          </p>
        </Show>

        {/* Content Preview */}
        <div
          class="text-xs font-mono p-2 rounded mb-2"
          style={{
            background: "var(--ui-panel-bg)",
            color: "var(--cortex-syntax-variable)",
            "white-space": "pre-wrap",
          }}
        >
          {truncateContent(props.prompt.content)}
        </div>

        {/* Footer Row */}
        <div class="flex items-center justify-between">
          {/* Tags */}
          <div class="flex items-center gap-1.5 flex-wrap">
            <Icon name="hashtag" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
            <For each={props.prompt.tags.slice(0, 4)}>
              {(tag) => (
                <span
                  class="px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    background: "var(--surface-hover)",
                    color: "var(--text-weak)",
                  }}
                >
                  {tag}
                </span>
              )}
            </For>
            <Show when={props.prompt.tags.length > 4}>
              <span class="text-[10px]" style={{ color: "var(--text-weak)" }}>
                +{props.prompt.tags.length - 4} more
              </span>
            </Show>
          </div>

          {/* Meta Info */}
          <div class="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-weak)" }}>
            <span class="flex items-center gap-1">
              <Icon name="wave-pulse" class="w-3 h-3" />
              {props.prompt.usageCount} uses
            </span>
            <span class="flex items-center gap-1">
              <Icon name="clock" class="w-3 h-3" />
              {props.formatDate(props.prompt.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Prompt Editor Component
// ============================================================================

interface PromptEditorProps {
  editingPrompt: SavedPrompt | null;
  isCreatingNew: boolean;
  categories: { id: string; name: string; color: string }[];
  allTags: string[];
  onSave: (promptData: Omit<SavedPrompt, "id" | "createdAt" | "updatedAt" | "usageCount">) => Promise<void>;
  onCancel: () => void;
}

function PromptEditor(props: PromptEditorProps) {
  const [title, setTitle] = createSignal("");
  const [content, setContent] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [category, setCategory] = createSignal("general");
  const [tags, setTags] = createSignal<string[]>([]);
  const [isFavorite, setIsFavorite] = createSignal(false);
  const [newTag, setNewTag] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Initialize form when editing an existing prompt
  createEffect(() => {
    if (props.editingPrompt) {
      setTitle(props.editingPrompt.title);
      setContent(props.editingPrompt.content);
      setDescription(props.editingPrompt.description);
      setCategory(props.editingPrompt.category);
      setTags([...props.editingPrompt.tags]);
      setIsFavorite(props.editingPrompt.isFavorite);
    } else if (props.isCreatingNew) {
      // Reset form for new prompt
      setTitle("");
      setContent("");
      setDescription("");
      setCategory("general");
      setTags([]);
      setIsFavorite(false);
    }
  });

  const handleAddTag = () => {
    const tag = newTag().trim().toLowerCase();
    if (tag && !tags().includes(tag)) {
      setTags([...tags(), tag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags().filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!title().trim()) {
      setError("Title is required");
      return;
    }
    if (!content().trim()) {
      setError("Content is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await props.onSave({
        title: title().trim(),
        content: content().trim(),
        description: description().trim(),
        category: category(),
        tags: tags(),
        isFavorite: isFavorite(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save prompt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Editor Form */}
      <div class="flex-1 overflow-y-auto p-4">
        <div class="space-y-4">
          {/* Error Message */}
          <Show when={error()}>
            <div
              class="px-3 py-2 rounded text-sm"
              style={{ background: "var(--cortex-error)20", color: "var(--cortex-error)", border: "1px solid var(--cortex-error)40" }}
            >
              {error()}
            </div>
          </Show>

          {/* Title */}
          <div>
            <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
              Title <Text as="span" variant="body" style={{ color: "var(--cortex-error)" }}>*</Text>
            </label>
            <Input
              type="text"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              placeholder="Enter prompt title..."
              size="sm"
            />
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
              placeholder="Brief description of what this prompt does..."
              size="sm"
            />
          </div>

          {/* Content */}
          <div>
            <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
              Content <Text as="span" variant="body" style={{ color: "var(--cortex-error)" }}>*</Text>
            </label>
            <Textarea
              value={content()}
              onInput={(e) => setContent(e.currentTarget.value)}
              placeholder="Enter your prompt template...&#10;&#10;Use {{variable}} for placeholders."
              rows={10}
              class="font-mono"
              style={{
                background: "var(--ui-panel-bg)",
                color: "var(--cortex-syntax-variable)",
              }}
            />
            <Text variant="muted" style={{ "margin-top": "4px" }}>
              Tip: Use {"{{variable}}"} syntax for placeholders that can be filled in when using the prompt.
            </Text>
          </div>

          {/* Category & Favorite */}
          <div class="flex items-start gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
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
                <For each={props.categories}>
                  {(cat) => <option value={cat.id}>{cat.name}</option>}
                </For>
              </select>
            </div>
            <div class="pt-7">
              <Button
                onClick={() => setIsFavorite(!isFavorite())}
                variant={isFavorite() ? "secondary" : "ghost"}
                size="sm"
                icon={<Icon name="star" style={{ width: "16px", height: "16px", color: isFavorite() ? "var(--cortex-warning)" : "currentColor" }} />}
                style={isFavorite() ? { background: "var(--cortex-warning)20", color: "var(--cortex-warning)" } : {}}
              >
                {isFavorite() ? "Favorited" : "Add to Favorites"}
              </Button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label class="block text-sm font-medium mb-1.5" style={{ color: "var(--text-strong)" }}>
              Tags
            </label>
            <div class="flex flex-wrap gap-2 mb-2">
              <For each={tags()}>
                {(tag) => (
                  <Badge variant="accent" style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                    {tag}
                    <IconButton
                      onClick={() => handleRemoveTag(tag)}
                      variant="ghost"
                      size="sm"
                      style={{ width: "16px", height: "16px", padding: "0" }}
                    >
                      <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
                    </IconButton>
                  </Badge>
                )}
              </For>
            </div>
            <div class="flex gap-2">
              <Input
                type="text"
                value={newTag()}
                onInput={(e) => setNewTag(e.currentTarget.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag..."
                size="sm"
                class="flex-1"
              />
              <IconButton
                onClick={handleAddTag}
                variant="ghost"
                size="sm"
              >
                <Icon name="plus" style={{ width: "16px", height: "16px" }} />
              </IconButton>
            </div>
            {/* Existing Tags Suggestions */}
            <Show when={props.allTags.length > 0}>
              <div class="flex flex-wrap gap-1 mt-2">
                <Text variant="muted">
                  Suggestions:
                </Text>
                <For each={props.allTags.filter((t) => !tags().includes(t)).slice(0, 8)}>
                  {(tag) => (
                    <Button
                      onClick={() => setTags([...tags(), tag])}
                      variant="ghost"
                      size="sm"
                      style={{ "font-size": "10px" }}
                    >
                      + {tag}
                    </Button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div
        class="flex items-center justify-end gap-3 px-4 py-3 border-t shrink-0"
        style={{ "border-color": "var(--border-base)" }}
      >
        <Button
          onClick={props.onCancel}
          disabled={saving()}
          variant="ghost"
          size="sm"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving()}
          variant="primary"
          size="sm"
          icon={<Icon name="floppy-disk" style={{ width: "16px", height: "16px" }} />}
        >
          {saving() ? "Saving..." : props.isCreatingNew ? "Create Prompt" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}


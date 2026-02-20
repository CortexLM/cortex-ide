/**
 * Git Tag Manager - Full CRUD for tags
 * 
 * Features:
 * 1. List all tags (local and remote)
 * 2. Search/filter tags
 * 3. Create tag dialog (lightweight vs annotated)
 * 4. Delete tag (local and/or remote)
 * 5. Push tag to remote
 * 6. Push all tags
 * 7. Checkout tag
 * 8. Create branch from tag
 * 9. View tag details (commit, message, tagger)
 * 10. Tag diff (compare with current HEAD)
 */

import { createSignal, For, Show, onMount, onCleanup, createMemo, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";
import { 
  Button, 
  IconButton, 
  Input, 
  Badge, 
  Text, 
  ListItem,
  Modal
} from "@/components/ui";
import { CreateTagDialog } from "./CreateTagDialog";
import {
  gitTagList,
  gitTagDelete,
  gitTagPush,
  gitTagPushAll,
  gitCheckoutTag,
  gitCreateBranchFromTag,
  gitTagInfo,
  type GitTag
} from "../../utils/tauri-api";

export interface TagManagerProps {
  repoPath: string;
  onClose?: () => void;
}

type SortOrder = "name-asc" | "name-desc" | "date-asc" | "date-desc";

export function TagManager(props: TagManagerProps) {
  // State
  const [tags, setTags] = createSignal<GitTag[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [operationLoading, setOperationLoading] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [sortOrder, setSortOrder] = createSignal<SortOrder>("date-desc");
  const [selectedTag, setSelectedTag] = createSignal<GitTag | null>(null);
  const [tagDetailsLoading, setTagDetailsLoading] = createSignal(false);
  const [showCreateDialog, setShowCreateDialog] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal<GitTag | null>(null);
  const [deleteRemoteToo, setDeleteRemoteToo] = createSignal(false);
  const [showBranchDialog, setShowBranchDialog] = createSignal<GitTag | null>(null);
  const [newBranchName, setNewBranchName] = createSignal("");
  const [copiedTag, setCopiedTag] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [expandedSections, setExpandedSections] = createSignal<Set<string>>(new Set(["local", "remote"]));

  // Load tags on mount and listen for command palette events
  onMount(() => {
    fetchTags();
    
    // Event handlers for command palette integration
    const handleOpenCreateDialog = () => {
      setShowCreateDialog(true);
    };
    
    window.addEventListener("tags:open-create-dialog", handleOpenCreateDialog);
    
    onCleanup(() => {
      window.removeEventListener("tags:open-create-dialog", handleOpenCreateDialog);
    });
  });

  // Fetch tag details when selection changes
  createEffect(() => {
    const tag = selectedTag();
    if (tag) {
      fetchTagDetails(tag.name);
    }
  });

  const fetchTags = async () => {
    setLoading(true);
    setError(null);
    try {
      const tagList = await gitTagList(props.repoPath);
      setTags(tagList);
    } catch (err) {
      setError(`Failed to fetch tags: ${err}`);
      console.error("Failed to fetch tags:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTagDetails = async (tagName: string) => {
    setTagDetailsLoading(true);
    try {
      // Fetch additional details - currently we just use selectedTag for display
      // This could be extended to fetch more info in the future
      await gitTagInfo(props.repoPath, tagName);
    } catch (err) {
      console.error("Failed to fetch tag details:", err);
    } finally {
      setTagDetailsLoading(false);
    }
  };

  const handleTagCreated = async (tag: GitTag) => {
    setShowCreateDialog(false);
    await fetchTags();
    setSelectedTag(tag);
  };

  const handleDeleteTag = async (tag: GitTag, deleteRemote: boolean) => {
    setOperationLoading(`delete-${tag.name}`);
    try {
      await gitTagDelete(props.repoPath, tag.name, deleteRemote);
      setShowDeleteConfirm(null);
      if (selectedTag()?.name === tag.name) {
        setSelectedTag(null);
      }
      await fetchTags();
    } catch (err) {
      setError(`Failed to delete tag: ${err}`);
      console.error("Failed to delete tag:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const handlePushTag = async (tagName: string) => {
    setOperationLoading(`push-${tagName}`);
    try {
      await gitTagPush(props.repoPath, tagName);
      await fetchTags();
    } catch (err) {
      setError(`Failed to push tag: ${err}`);
      console.error("Failed to push tag:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const handlePushAllTags = async () => {
    setOperationLoading("push-all");
    try {
      await gitTagPushAll(props.repoPath);
      await fetchTags();
    } catch (err) {
      setError(`Failed to push tags: ${err}`);
      console.error("Failed to push all tags:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleCheckoutTag = async (tagName: string) => {
    setOperationLoading(`checkout-${tagName}`);
    try {
      await gitCheckoutTag(props.repoPath, tagName);
    } catch (err) {
      setError(`Failed to checkout tag: ${err}`);
      console.error("Failed to checkout tag:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleCreateBranchFromTag = async () => {
    const tag = showBranchDialog();
    const branchName = newBranchName().trim();
    if (!tag || !branchName) return;

    setOperationLoading(`branch-${tag.name}`);
    try {
      await gitCreateBranchFromTag(props.repoPath, tag.name, branchName);
      setShowBranchDialog(null);
      setNewBranchName("");
    } catch (err) {
      setError(`Failed to create branch: ${err}`);
      console.error("Failed to create branch from tag:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const copyToClipboard = async (text: string, tagName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTag(tagName);
      setTimeout(() => setCopiedTag(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  // Filter and sort tags
  const filteredTags = createMemo(() => {
    const query = searchQuery().toLowerCase();
    let filtered = tags();
    
    if (query) {
      filtered = filtered.filter(tag => 
        tag.name.toLowerCase().includes(query) ||
        tag.message?.toLowerCase().includes(query) ||
        tag.tagger?.toLowerCase().includes(query)
      );
    }

    // Sort tags
    const order = sortOrder();
    return [...filtered].sort((a, b) => {
      switch (order) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "date-asc":
          return (a.date?.getTime() || 0) - (b.date?.getTime() || 0);
        case "date-desc":
        default:
          return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
      }
    });
  });

  // Separate local and remote tags
  const localTags = createMemo(() => filteredTags().filter(t => !t.isPushed));
  const remoteTags = createMemo(() => filteredTags().filter(t => t.isPushed));

  // Stats
  const tagStats = createMemo(() => ({
    total: tags().length,
    local: tags().filter(t => !t.isPushed).length,
    remote: tags().filter(t => t.isPushed).length,
    annotated: tags().filter(t => t.isAnnotated).length,
  }));

  const toggleSection = (section: string) => {
    const current = expandedSections();
    const newSet = new Set(current);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedSections(newSet);
  };

  const formatDate = (date?: Date): string => {
    if (!date) return "Unknown date";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const clearError = () => setError(null);

  // Tag list item component
  const TagItem = (props: { tag: GitTag }) => {
    const tag = () => props.tag;
    const isSelected = () => selectedTag()?.name === tag().name;
    const isOperating = () => 
      operationLoading()?.startsWith(`push-${tag().name}`) ||
      operationLoading()?.startsWith(`delete-${tag().name}`) ||
      operationLoading()?.startsWith(`checkout-${tag().name}`) ||
      operationLoading()?.startsWith(`branch-${tag().name}`);

    return (
      <ListItem
        selected={isSelected()}
        onClick={() => setSelectedTag(tag())}
        icon={
          <Icon 
            name="tag"
            style={{ 
              width: "14px", 
              height: "14px",
              color: tag().isAnnotated ? tokens.colors.semantic.primary : tokens.colors.icon.default
            }} 
          />
        }
        style={{
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
        }}
        iconRight={
          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
            <Show when={isOperating()}>
              <Icon 
                name="spinner"
                style={{ 
                  width: "14px", 
                  height: "14px", 
                  animation: "spin 1s linear infinite",
                  color: tokens.colors.icon.default 
                }} 
              />
            </Show>
            
            <Show when={!isOperating()}>
              <Show when={!tag().isPushed}>
                <IconButton
                  size="sm"
                  tooltip="Push tag to remote"
                  onClick={(e) => { e.stopPropagation(); handlePushTag(tag().name); }}
                >
                  <Icon name="upload" style={{ width: "12px", height: "12px" }} />
                </IconButton>
              </Show>
              
              <IconButton
                size="sm"
                tooltip="Delete tag"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(tag()); }}
              >
                <Icon name="trash" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.error }} />
              </IconButton>
            </Show>

            {/* Status badges */}
            <Show when={tag().isAnnotated}>
              <span title="Annotated tag">
                <Badge variant="default" size="sm">
                  A
                </Badge>
              </span>
            </Show>
            <Show when={tag().isPushed}>
              <span title="Pushed to remote">
                <Icon name="cloud" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.success }} />
              </span>
            </Show>
            <Show when={!tag().isPushed}>
              <span title="Local only">
                <Icon name="cloud-slash" style={{ width: "12px", height: "12px", color: tokens.colors.text.muted }} />
              </span>
            </Show>
          </div>
        }
      >
        <div style={{ flex: "1", "min-width": "0" }}>
          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
            <Text 
              style={{ 
                "font-size": "13px", 
                "font-weight": "500",
                color: isSelected() ? tokens.colors.semantic.primary : tokens.colors.text.primary,
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
            >
              {tag().name}
            </Text>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, "margin-top": "2px" }}>
            <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
              {tag().commitShort}
            </Text>
            <Show when={tag().message}>
              <Text 
                style={{ 
                  "font-size": "10px", 
                  color: tokens.colors.text.muted,
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "white-space": "nowrap",
                  "max-width": "200px",
                }}
              >
                {tag().message}
              </Text>
            </Show>
          </div>
        </div>
      </ListItem>
    );
  };

  // Section header component
  const SectionHeader = (props: {
    title: string;
    iconName: string;
    count: number;
    expanded: boolean;
    onToggle: () => void;
  }) => (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        height: "28px",
        padding: `0 ${tokens.spacing.lg}`,
        cursor: "pointer",
        "user-select": "none",
        background: tokens.colors.surface.panel,
        transition: "background var(--cortex-transition-fast)",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
      onMouseLeave={(e) => e.currentTarget.style.background = tokens.colors.surface.panel}
      onClick={props.onToggle}
    >
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
        {props.expanded ? (
          <Icon name="chevron-down" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
        ) : (
          <Icon name="chevron-right" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
        )}
        <Icon name={props.iconName} style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
        <Text style={{
          "font-size": "11px",
          "font-weight": "600",
          "text-transform": "uppercase",
          "letter-spacing": "0.5px",
          color: tokens.colors.text.muted,
        }}>
          {props.title}
        </Text>
        <Badge variant="default" size="sm">
          {props.count}
        </Badge>
      </div>
    </div>
  );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        "flex-direction": "column",
        overflow: "hidden",
        background: tokens.colors.surface.panel,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "flex-shrink": "0",
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <Icon name="tag" style={{ width: "16px", height: "16px", color: tokens.colors.icon.default }} />
          <Text style={{ "font-size": "14px", "font-weight": "600", color: tokens.colors.text.primary }}>
            Tags
          </Text>
          <Badge variant="default" size="sm">
            {tagStats().total}
          </Badge>
        </div>
        
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          <IconButton
            tooltip="Create Tag"
            onClick={() => setShowCreateDialog(true)}
          >
            <Icon name="plus" style={{ width: "16px", height: "16px" }} />
          </IconButton>
          <IconButton
            tooltip="Push All Tags"
            onClick={handlePushAllTags}
            disabled={operationLoading() === "push-all" || localTags().length === 0}
          >
            <Show when={operationLoading() === "push-all"} fallback={<Icon name="upload" style={{ width: "16px", height: "16px" }} />}>
              <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
            </Show>
          </IconButton>
          <IconButton
            tooltip="Refresh"
            onClick={fetchTags}
            disabled={loading()}
          >
            <Show when={loading()} fallback={<Icon name="rotate" style={{ width: "16px", height: "16px" }} />}>
              <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
            </Show>
          </IconButton>
          <Show when={props.onClose}>
            <IconButton
              tooltip="Close"
              onClick={props.onClose}
            >
              <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
            </IconButton>
          </Show>
        </div>
      </div>

      {/* Error banner */}
      <Show when={error()}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.md,
            padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
            "font-size": "12px",
            background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`,
            color: tokens.colors.semantic.error,
          }}
        >
          <Text as="span" style={{ flex: "1" }}>{error()}</Text>
          <IconButton size="sm" onClick={clearError}>
            <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
          </IconButton>
        </div>
      </Show>

      {/* Search and sort */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: tokens.spacing.md,
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "flex-shrink": "0",
        }}
      >
        <div style={{ flex: "1" }}>
          <Input
            placeholder="Search tags..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            icon={<Icon name="magnifying-glass" style={{ width: "14px", height: "14px" }} />}
            iconRight={
              <Show when={searchQuery()}>
                <IconButton
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  style={{ position: "absolute", right: "4px" }}
                >
                  <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
                </IconButton>
              </Show>
            }
          />
        </div>
        <select
          value={sortOrder()}
          onChange={(e) => setSortOrder(e.currentTarget.value as SortOrder)}
          style={{
            height: "28px",
            padding: `0 ${tokens.spacing.md}`,
            background: "var(--jb-input-bg)",
            border: "var(--jb-input-border)",
            "border-radius": "var(--jb-input-radius)",
            color: "var(--jb-input-color)",
            "font-size": "12px",
            cursor: "pointer",
          }}
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
        </select>
      </div>

      {/* Main content area - split view */}
      <div style={{ flex: "1", display: "flex", overflow: "hidden" }}>
        {/* Tag list */}
        <div 
          style={{ 
            width: selectedTag() ? "50%" : "100%",
            "border-right": selectedTag() ? `1px solid ${tokens.colors.border.divider}` : undefined,
            "overflow-y": "auto",
            transition: "width var(--cortex-transition-normal)",
          }}
        >
          <Show when={loading()}>
            <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "128px" }}>
              <Icon name="spinner" style={{ width: "20px", height: "20px", animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
            </div>
          </Show>

          <Show when={!loading() && tags().length === 0}>
            <div style={{ display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", padding: "48px 16px", "text-align": "center" }}>
              <Icon name="tag" style={{ width: "48px", height: "48px", "margin-bottom": tokens.spacing.lg, color: tokens.colors.text.muted }} />
              <Text style={{ "font-size": "14px", "font-weight": "500", color: tokens.colors.text.primary }}>
                No tags found
              </Text>
              <Text style={{ "font-size": "12px", "margin-top": tokens.spacing.sm, color: tokens.colors.text.muted }}>
                Create a tag to mark important points in your repository's history
              </Text>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                icon={<Icon name="plus" style={{ width: "14px", height: "14px" }} />}
                style={{ "margin-top": tokens.spacing.lg }}
              >
                Create Tag
              </Button>
            </div>
          </Show>

          <Show when={!loading() && tags().length > 0}>
            {/* Local tags section */}
            <Show when={localTags().length > 0}>
              <SectionHeader
                title="Local Tags"
                iconName="cloud-slash"
                count={localTags().length}
                expanded={expandedSections().has("local")}
                onToggle={() => toggleSection("local")}
              />
              <Show when={expandedSections().has("local")}>
                <For each={localTags()}>
                  {(tag) => <TagItem tag={tag} />}
                </For>
              </Show>
            </Show>

            {/* Remote tags section */}
            <Show when={remoteTags().length > 0}>
              <SectionHeader
                title="Remote Tags"
                iconName="cloud"
                count={remoteTags().length}
                expanded={expandedSections().has("remote")}
                onToggle={() => toggleSection("remote")}
              />
              <Show when={expandedSections().has("remote")}>
                <For each={remoteTags()}>
                  {(tag) => <TagItem tag={tag} />}
                </For>
              </Show>
            </Show>

            {/* No results message */}
            <Show when={filteredTags().length === 0 && searchQuery()}>
              <div style={{ padding: "32px 16px", "text-align": "center" }}>
                <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                  No tags matching "{searchQuery()}"
                </Text>
              </div>
            </Show>
          </Show>
        </div>

        {/* Tag details panel */}
        <Show when={selectedTag()}>
          <div style={{ flex: "1", "overflow-y": "auto", display: "flex", "flex-direction": "column" }}>
            {/* Details header */}
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                "border-bottom": `1px solid ${tokens.colors.border.divider}`,
                "flex-shrink": "0",
              }}
            >
              <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                <Icon name="circle-info" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
                <Text style={{ "font-size": "12px", "font-weight": "600", color: tokens.colors.text.primary }}>
                  Tag Details
                </Text>
              </div>
              <IconButton
                size="sm"
                tooltip="Close details"
                onClick={() => setSelectedTag(null)}
              >
                <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
              </IconButton>
            </div>

            {/* Details content */}
            <Show when={tagDetailsLoading()}>
              <div style={{ display: "flex", "align-items": "center", "justify-content": "center", padding: "48px" }}>
                <Icon name="spinner" style={{ width: "20px", height: "20px", animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
              </div>
            </Show>

            <Show when={!tagDetailsLoading() && selectedTag()}>
              <div style={{ padding: tokens.spacing.lg, display: "flex", "flex-direction": "column", gap: tokens.spacing.lg }}>
                {/* Tag name */}
                <div>
                  <Text style={{ "font-size": "18px", "font-weight": "600", color: tokens.colors.text.primary }}>
                    {selectedTag()!.name}
                  </Text>
                  <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm, "margin-top": tokens.spacing.sm }}>
                    <Show when={selectedTag()!.isAnnotated}>
                      <Badge variant="default" size="sm">Annotated</Badge>
                    </Show>
                    <Show when={!selectedTag()!.isAnnotated}>
                      <Badge variant="default" size="sm">Lightweight</Badge>
                    </Show>
                    <Show when={selectedTag()!.isPushed}>
                      <Badge variant="success" size="sm">Pushed</Badge>
                    </Show>
                    <Show when={!selectedTag()!.isPushed}>
                      <Badge variant="warning" size="sm">Local only</Badge>
                    </Show>
                  </div>
                </div>

                {/* Commit info */}
                <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.md }}>
                  <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                    <Icon name="code-commit" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default, "flex-shrink": "0" }} />
                    <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>Commit</Text>
                    <span 
                      style={{ 
                        "font-size": "12px", 
                        "font-family": "var(--jb-font-code)", 
                        color: tokens.colors.text.primary,
                        cursor: "pointer",
                      }}
                      onClick={() => copyToClipboard(selectedTag()!.commit, selectedTag()!.name)}
                    >
                      {selectedTag()!.commitShort}
                      <Show when={copiedTag() === selectedTag()!.name}>
                        <Icon name="check" style={{ width: "12px", height: "12px", "margin-left": "4px", color: tokens.colors.semantic.success }} />
                      </Show>
                    </span>
                    <IconButton
                      size="sm"
                      tooltip="Copy full commit hash"
                      onClick={() => copyToClipboard(selectedTag()!.commit, selectedTag()!.name)}
                    >
                      <Icon name="copy" style={{ width: "12px", height: "12px" }} />
                    </IconButton>
                  </div>

                  <Show when={selectedTag()!.tagger}>
                    <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                      <Icon name="user" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default, "flex-shrink": "0" }} />
                      <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>Tagger</Text>
                      <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                        {selectedTag()!.tagger}
                      </Text>
                    </div>
                  </Show>

                  <Show when={selectedTag()!.date}>
                    <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                      <Icon name="calendar" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default, "flex-shrink": "0" }} />
                      <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>Date</Text>
                      <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                        {formatDate(selectedTag()!.date)}
                      </Text>
                    </div>
                  </Show>
                </div>

                {/* Message */}
                <Show when={selectedTag()!.message}>
                  <div style={{ 
                    padding: tokens.spacing.md, 
                    background: tokens.colors.interactive.hover,
                    "border-radius": tokens.radius.md,
                  }}>
                    <Text style={{ "font-size": "11px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
                      Message
                    </Text>
                    <Text style={{ "font-size": "12px", color: tokens.colors.text.primary, "white-space": "pre-wrap" }}>
                      {selectedTag()!.message}
                    </Text>
                  </div>
                </Show>

                {/* Actions */}
                <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.sm }}>
                  <Text style={{ "font-size": "11px", "font-weight": "500", color: tokens.colors.text.muted }}>
                    Actions
                  </Text>
                  
                  <div style={{ display: "flex", "flex-wrap": "wrap", gap: tokens.spacing.sm }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCheckoutTag(selectedTag()!.name)}
                      disabled={!!operationLoading()}
                      icon={<Icon name="eye" style={{ width: "12px", height: "12px" }} />}
                    >
                      Checkout
                    </Button>
                    
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setNewBranchName(`branch-from-${selectedTag()!.name}`);
                        setShowBranchDialog(selectedTag());
                      }}
                      disabled={!!operationLoading()}
                      icon={<Icon name="code-branch" style={{ width: "12px", height: "12px" }} />}
                    >
                      Create Branch
                    </Button>
                    
                    <Show when={!selectedTag()!.isPushed}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePushTag(selectedTag()!.name)}
                        disabled={!!operationLoading()}
                        icon={<Icon name="upload" style={{ width: "12px", height: "12px" }} />}
                      >
                        Push
                      </Button>
                    </Show>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(selectedTag())}
                      disabled={!!operationLoading()}
                      style={{ color: tokens.colors.semantic.error }}
                      icon={<Icon name="trash" style={{ width: "12px", height: "12px" }} />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Create tag dialog */}
      <Show when={showCreateDialog()}>
        <CreateTagDialog
          repoPath={props.repoPath}
          onCreated={handleTagCreated}
          onCancel={() => setShowCreateDialog(false)}
        />
      </Show>

      {/* Delete confirmation dialog */}
      <Modal
        open={!!showDeleteConfirm()}
        onClose={() => { setShowDeleteConfirm(null); setDeleteRemoteToo(false); }}
        title="Delete Tag"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowDeleteConfirm(null); setDeleteRemoteToo(false); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDeleteTag(showDeleteConfirm()!, deleteRemoteToo())}
              loading={operationLoading()?.startsWith("delete-")}
              style={{ background: tokens.colors.semantic.error }}
            >
              Delete
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.lg }}>
          <Text style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
            Are you sure you want to delete tag <strong>{showDeleteConfirm()?.name}</strong>?
          </Text>
          
          <Show when={showDeleteConfirm()?.isPushed}>
            <label style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={deleteRemoteToo()}
                onChange={(e) => setDeleteRemoteToo(e.currentTarget.checked)}
                style={{
                  width: "16px",
                  height: "16px",
                  cursor: "pointer",
                }}
              />
              <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                Also delete from remote
              </Text>
            </label>
          </Show>
          
          <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
            This action cannot be undone.
          </Text>
        </div>
      </Modal>

      {/* Create branch from tag dialog */}
      <Modal
        open={!!showBranchDialog()}
        onClose={() => { setShowBranchDialog(null); setNewBranchName(""); }}
        title="Create Branch from Tag"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowBranchDialog(null); setNewBranchName(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateBranchFromTag}
              disabled={!newBranchName().trim()}
              loading={operationLoading()?.startsWith("branch-")}
            >
              Create Branch
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.lg }}>
          <Text style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
            Create a new branch from tag <strong>{showBranchDialog()?.name}</strong>
          </Text>
          
          <Input
            label="Branch Name"
            placeholder="Enter branch name..."
            value={newBranchName()}
            onInput={(e) => setNewBranchName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newBranchName().trim()) {
                handleCreateBranchFromTag();
              }
            }}
            autofocus
          />
        </div>
      </Modal>

      {/* Keyframes for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default TagManager;

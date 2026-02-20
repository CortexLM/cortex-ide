/**
 * Bookmarks Panel
 * 
 * A modal panel that displays all bookmarks and allows navigation.
 * Features:
 * - List all bookmarks grouped by file
 * - Click to navigate to bookmark
 * - Edit bookmark labels
 * - Delete bookmarks
 * - Clear all bookmarks
 * - Keyboard navigation
 */

import { Show, For, createSignal, createEffect, onMount, onCleanup, createMemo, JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { useBookmarks, Bookmark } from "@/context/BookmarksContext";
import { Button, IconButton, ListItem, Badge, Text, EmptyState, SidebarHeader } from "@/components/ui";
import { Icon } from "./ui/Icon";

// ============================================================================
// Types
// ============================================================================

interface GroupedBookmarks {
  filePath: string;
  fileName: string;
  bookmarks: Bookmark[];
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  backdrop: {
    position: "fixed",
    inset: "0",
    background: "rgba(0, 0, 0, 0.5)",
    "z-index": "50",
  } as JSX.CSSProperties,

  panel: {
    position: "fixed",
    top: "25%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "600px",
    "max-height": "60vh",
    "border-radius": "var(--jb-radius-md)",
    "box-shadow": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    "z-index": "50",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    background: "var(--jb-surface-raised)",
    border: "1px solid var(--jb-border-default)",
  } as JSX.CSSProperties,

  content: {
    flex: "1",
    "overflow-y": "auto",
    padding: "8px 0",
    "max-height": "400px",
  } as JSX.CSSProperties,

  fileGroupHeader: {
    width: "100%",
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
    "text-align": "left",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  } as JSX.CSSProperties,

  bookmarkItem: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "padding-left": "32px",
    "padding-right": "12px",
    padding: "6px 12px 6px 32px",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  } as JSX.CSSProperties,

  editInput: {
    flex: "1",
    padding: "2px 4px",
    "font-size": "var(--jb-text-muted-size)",
    background: "transparent",
    border: "1px solid var(--jb-border-focus)",
    "border-radius": "var(--jb-radius-sm)",
    outline: "none",
    color: "var(--jb-text-body-color)",
  } as JSX.CSSProperties,

  footer: {
    padding: "8px 16px",
    "border-top": "1px solid var(--jb-border-divider)",
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
  } as JSX.CSSProperties,

  kbd: {
    padding: "2px 6px",
    background: "var(--jb-surface-sunken)",
    "border-radius": "var(--jb-radius-sm)",
    "font-size": "var(--jb-text-muted-size)",
    color: "var(--jb-text-muted-color)",
  } as JSX.CSSProperties,

  actionButtons: {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  } as JSX.CSSProperties,
};

// ============================================================================
// Component
// ============================================================================

export function BookmarksPanel() {
  const {
    bookmarks,
    isBookmarksPanelVisible,
    setBookmarksPanelVisible,
    navigateToBookmark,
    removeBookmark,
    updateBookmarkLabel,
    clearAllBookmarks,
  } = useBookmarks();

  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editLabel, setEditLabel] = createSignal("");
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());

  let containerRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  // Group bookmarks by file
  const groupedBookmarks = createMemo((): GroupedBookmarks[] => {
    const groups = new Map<string, Bookmark[]>();

    for (const bookmark of bookmarks()) {
      const existing = groups.get(bookmark.filePath) || [];
      groups.set(bookmark.filePath, [...existing, bookmark]);
    }

    // Convert to array and sort by file path
    return Array.from(groups.entries())
      .map(([filePath, bms]) => ({
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || filePath,
        bookmarks: bms.sort((a, b) => a.line - b.line),
      }))
      .sort((a, b) => a.filePath.localeCompare(b.filePath));
  });

  // Flatten bookmarks for keyboard navigation
  const flatBookmarks = createMemo(() => bookmarks().sort((a, b) => {
    if (a.filePath !== b.filePath) {
      return a.filePath.localeCompare(b.filePath);
    }
    return a.line - b.line;
  }));

  // Auto-expand all files initially
  createEffect(() => {
    if (isBookmarksPanelVisible()) {
      const allFiles = new Set<string>(bookmarks().map(b => b.filePath));
      setExpandedFiles(allFiles);
      setSelectedIndex(0);
    }
  });

  // Focus container when opened
  createEffect(() => {
    if (isBookmarksPanelVisible() && containerRef) {
      containerRef.focus();
    }
  });

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isBookmarksPanelVisible()) return;

    const flat = flatBookmarks();
    const maxIndex = flat.length - 1;

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        if (editingId()) {
          setEditingId(null);
        } else {
          setBookmarksPanelVisible(false);
        }
        break;

      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, maxIndex));
        break;

      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;

      case "Enter":
        e.preventDefault();
        if (editingId()) {
          saveLabel();
        } else if (flat[selectedIndex()]) {
          navigateToBookmark(flat[selectedIndex()]);
          setBookmarksPanelVisible(false);
        }
        break;

      case "Delete":
      case "Backspace":
        if (!editingId() && flat[selectedIndex()]) {
          e.preventDefault();
          removeBookmark(flat[selectedIndex()].id);
        }
        break;

      case "F2":
        if (flat[selectedIndex()]) {
          e.preventDefault();
          startEditing(flat[selectedIndex()]);
        }
        break;
    }
  };

  // Start editing a bookmark label
  const startEditing = (bookmark: Bookmark) => {
    setEditingId(bookmark.id);
    setEditLabel(bookmark.label || "");
    // Focus input after render
    setTimeout(() => inputRef?.focus(), 0);
  };

  // Save edited label
  const saveLabel = () => {
    const id = editingId();
    if (id) {
      updateBookmarkLabel(id, editLabel());
      setEditingId(null);
    }
  };

  // Toggle file expansion
  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  // Handle click on bookmark item
  const handleBookmarkClick = (bookmark: Bookmark, index: number) => {
    setSelectedIndex(index);
    navigateToBookmark(bookmark);
    setBookmarksPanelVisible(false);
  };

  // Global key listener
  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Header actions
  const headerActions = () => (
    <div style={styles.actionButtons}>
      <Show when={bookmarks().length > 0}>
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon name="trash" size={14} />}
          onClick={() => {
            if (confirm("Clear all bookmarks?")) {
              clearAllBookmarks();
            }
          }}
          title="Clear all bookmarks"
        >
          Clear All
        </Button>
      </Show>
      <IconButton
        size="sm"
        tooltip="Close (Esc)"
        onClick={() => setBookmarksPanelVisible(false)}
      >
        <Icon name="xmark" size={14} />
      </IconButton>
    </div>
  );

  return (
    <Show when={isBookmarksPanelVisible()}>
      <Portal>
        {/* Backdrop */}
        <div
          style={styles.backdrop}
          onClick={() => setBookmarksPanelVisible(false)}
        />

        {/* Panel */}
        <div
          ref={containerRef}
          tabIndex={0}
          style={styles.panel}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <SidebarHeader
            title="Bookmarks"
            actions={
              <div style={styles.actionButtons}>
                <Badge variant="default">{bookmarks().length}</Badge>
                {headerActions()}
              </div>
            }
          />

          {/* Content */}
          <div style={styles.content}>
            <Show
              when={bookmarks().length > 0}
              fallback={
                <EmptyState
                  icon={<Icon name="bookmark" size={32} />}
                  title="No bookmarks yet"
                  description="Press Ctrl+Alt+K to add a bookmark"
                />
              }
            >
              <For each={groupedBookmarks()}>
                {(group) => {
                  const isExpanded = () => expandedFiles().has(group.filePath);

                  return (
                    <div style={{ "margin-bottom": "4px" }}>
                      {/* File Header */}
                      <ListItem
icon={
                          <Icon
                            name="chevron-right"
                            size={14}
                            style={{
                              color: "var(--jb-icon-color-default)",
                              transform: isExpanded() ? "rotate(90deg)" : "rotate(0deg)",
                              transition: "transform var(--cortex-transition-fast)",
                            }}
                          />
                        }
iconRight={
                          <Icon name="file" size={14} style={{ color: "var(--jb-icon-color-default)" }} />
                        }
                        label={group.fileName}
                        badge={group.bookmarks.length}
                        onClick={() => toggleFile(group.filePath)}
                        style={{ cursor: "pointer" }}
                      />

                      {/* Bookmarks in file */}
                      <Show when={isExpanded()}>
                        <For each={group.bookmarks}>
                          {(bookmark) => {
                            const globalIndex = () =>
                              flatBookmarks().findIndex((b) => b.id === bookmark.id);
                            const isSelected = () => selectedIndex() === globalIndex();
                            const isEditing = () => editingId() === bookmark.id;

                            return (
                              <div
                                style={{
                                  ...styles.bookmarkItem,
                                  background: isSelected()
                                    ? "var(--jb-tree-selection-bg)"
                                    : "transparent",
                                }}
                                onClick={() => handleBookmarkClick(bookmark, globalIndex())}
                                onDblClick={() => startEditing(bookmark)}
                                onMouseEnter={(e) => {
                                  if (!isSelected()) {
                                    e.currentTarget.style.background = "var(--jb-surface-hover)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected()) {
                                    e.currentTarget.style.background = "transparent";
                                  }
                                }}
                              >
<Icon
                                  name="bookmark"
                                  size={14}
                                  style={{
                                    "flex-shrink": "0",
                                    color: "var(--jb-border-focus)",
                                  }}
                                />

                                <Text variant="muted" style={{ "flex-shrink": "0" }}>
                                  Line {bookmark.line}
                                </Text>

                                <Show
                                  when={!isEditing()}
                                  fallback={
                                    <div style={{ flex: "1", display: "flex", "align-items": "center", gap: "4px" }}>
                                      <input
                                        ref={inputRef}
                                        type="text"
                                        value={editLabel()}
                                        onInput={(e) => setEditLabel(e.currentTarget.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            saveLabel();
                                          } else if (e.key === "Escape") {
                                            setEditingId(null);
                                          }
                                          e.stopPropagation();
                                        }}
                                        onBlur={() => saveLabel()}
                                        style={styles.editInput}
                                        placeholder="Add label..."
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <IconButton
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          saveLabel();
                                        }}
                                      >
                                        <Icon name="check" size={14} style={{ color: "var(--cortex-success)" }} />
                                      </IconButton>
                                    </div>
                                  }
                                >
                                  <Text
                                    variant={bookmark.label ? "body" : "muted"}
                                    truncate
                                    style={{
                                      flex: "1",
                                      "font-style": bookmark.label ? "normal" : "italic",
                                    }}
                                  >
                                    {bookmark.label || "No label"}
                                  </Text>
                                </Show>

                                <div style={styles.actionButtons}>
                                  <IconButton
                                    size="sm"
                                    tooltip="Edit label (F2)"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditing(bookmark);
                                    }}
                                  >
                                    <Icon name="pen" size={14} />
                                  </IconButton>
                                  <IconButton
                                    size="sm"
                                    tooltip="Delete (Del)"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeBookmark(bookmark.id);
                                    }}
                                  >
                                    <Icon name="trash" size={14} />
                                  </IconButton>
                                </div>
                              </div>
                            );
                          }}
                        </For>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <div style={{ display: "flex", "align-items": "center", gap: "16px" }}>
              <Text variant="muted">
                <span style={styles.kbd}>↑↓</span> Navigate
              </Text>
              <Text variant="muted">
                <span style={styles.kbd}>Enter</span> Go to
              </Text>
              <Text variant="muted">
                <span style={styles.kbd}>F2</span> Edit
              </Text>
              <Text variant="muted">
                <span style={styles.kbd}>Del</span> Remove
              </Text>
            </div>
            <Text variant="muted">
              <span style={styles.kbd}>Esc</span> Close
            </Text>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export default BookmarksPanel;

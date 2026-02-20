/**
 * ReferencesPanel - Find All References Panel
 * 
 * Displays references grouped by file in a tree view.
 * Features:
 * - Tree view of references grouped by file
 * - Line preview with highlighted match
 * - Click to navigate to reference
 * - Reference count display
 * - Collapse/expand files
 * - Search/filter references
 * - Keyboard navigation
 */

import { Show, For, createSignal, createEffect, onCleanup, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { Location, Position } from "@/context/LSPContext";

// ============================================================================
// Types
// ============================================================================

export interface ReferenceLocation {
  uri: string;
  range: {
    start: Position;
    end: Position;
  };
  lineContent?: string;
}

export interface FileReferences {
  uri: string;
  fileName: string;
  dirPath: string;
  references: ReferenceLocation[];
  expanded: boolean;
}

export interface ReferencesPanelState {
  visible: boolean;
  loading: boolean;
  error: string | null;
  symbolName: string;
  originUri: string | null;
  originPosition: Position | null;
  fileGroups: FileReferences[];
  totalCount: number;
  selectedIndex: number;
}

export interface ReferencesPanelProps {
  onNavigate?: (uri: string, line: number, column: number) => void;
  onClose?: () => void;
}

// ============================================================================
// Utilities
// ============================================================================

/** Extract filename from URI */
function getFileName(uri: string): string {
  const path = uri.replace(/^file:\/\//, "").replace(/\\/g, "/");
  const parts = path.split("/");
  return parts[parts.length - 1] || uri;
}

/** Extract directory path from URI */
function getDirPath(uri: string): string {
  const path = uri.replace(/^file:\/\//, "").replace(/\\/g, "/");
  const parts = path.split("/");
  parts.pop();
  // Return last 2-3 parts for brevity
  const displayParts = parts.slice(-3);
  return displayParts.length < parts.length 
    ? ".../" + displayParts.join("/") 
    : displayParts.join("/");
}

/** Highlight the matched text in a line preview */
function highlightMatch(
  lineContent: string, 
  start: number, 
  end: number
): { before: string; match: string; after: string } {
  const before = lineContent.substring(0, start);
  const match = lineContent.substring(start, end);
  const after = lineContent.substring(end);
  return { before, match, after };
}

/** Fetch line content from backend */
async function fetchLineContent(uri: string, line: number): Promise<string> {
  try {
    const filePath = uri.replace(/^file:\/\//, "").replace(/\//g, "\\");
    const content = await invoke<string>("read_file", { path: filePath });
    const lines = content.split("\n");
    return lines[line] || "";
  } catch {
    return "";
  }
}

// ============================================================================
// Component
// ============================================================================

export function ReferencesPanel(props: ReferencesPanelProps) {
  const [state, setState] = createSignal<ReferencesPanelState>({
    visible: false,
    loading: false,
    error: null,
    symbolName: "",
    originUri: null,
    originPosition: null,
    fileGroups: [],
    totalCount: 0,
    selectedIndex: -1,
  });

  const [filterText, setFilterText] = createSignal("");
  let containerRef: HTMLDivElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Filtered file groups based on search
  const filteredGroups = createMemo(() => {
    const filter = filterText().toLowerCase();
    if (!filter) return state().fileGroups;

    return state().fileGroups
      .map((group) => ({
        ...group,
        references: group.references.filter(
          (ref) =>
            ref.lineContent?.toLowerCase().includes(filter) ||
            group.fileName.toLowerCase().includes(filter)
        ),
      }))
      .filter((group) => group.references.length > 0);
  });

  // Flat list of all visible references for keyboard navigation
  const flatReferenceList = createMemo(() => {
    const items: { groupIndex: number; refIndex: number; uri: string; line: number; column: number }[] = [];
    
    filteredGroups().forEach((group, groupIndex) => {
      if (group.expanded) {
        group.references.forEach((ref, refIndex) => {
          items.push({
            groupIndex,
            refIndex,
            uri: ref.uri,
            line: ref.range.start.line + 1,
            column: ref.range.start.character + 1,
          });
        });
      }
    });
    
    return items;
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /** Show references for a symbol */
  const showReferences = async (
    locations: Location[],
    symbolName: string,
    originUri: string,
    originPosition: Position
  ) => {
    setState((prev) => ({
      ...prev,
      visible: true,
      loading: true,
      error: null,
      symbolName,
      originUri,
      originPosition,
      fileGroups: [],
      totalCount: 0,
      selectedIndex: -1,
    }));

    try {
      // Group locations by file
      const groupMap = new Map<string, ReferenceLocation[]>();

      for (const loc of locations) {
        const uri = loc.uri;
        if (!groupMap.has(uri)) {
          groupMap.set(uri, []);
        }
        
        // Fetch line content for preview
        const lineContent = await fetchLineContent(uri, loc.range.start.line);
        
        groupMap.get(uri)!.push({
          uri: loc.uri,
          range: loc.range,
          lineContent: lineContent.trim(),
        });
      }

      // Convert map to array of FileReferences
      const fileGroups: FileReferences[] = [];
      for (const [uri, refs] of groupMap) {
        // Sort references by line number
        refs.sort((a, b) => a.range.start.line - b.range.start.line);
        
        fileGroups.push({
          uri,
          fileName: getFileName(uri),
          dirPath: getDirPath(uri),
          references: refs,
          expanded: true, // Expand all by default
        });
      }

      // Sort file groups alphabetically by filename
      fileGroups.sort((a, b) => a.fileName.localeCompare(b.fileName));

      setState((prev) => ({
        ...prev,
        loading: false,
        fileGroups,
        totalCount: locations.length,
        selectedIndex: 0,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load references",
      }));
    }
  };

  /** Hide the panel */
  const hide = () => {
    setState((prev) => ({ ...prev, visible: false }));
    props.onClose?.();
  };

  /** Toggle file group expansion */
  const toggleGroup = (groupIndex: number) => {
    setState((prev) => {
      const newGroups = [...prev.fileGroups];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        expanded: !newGroups[groupIndex].expanded,
      };
      return { ...prev, fileGroups: newGroups };
    });
  };

  /** Expand all groups */
  const expandAll = () => {
    setState((prev) => ({
      ...prev,
      fileGroups: prev.fileGroups.map((g) => ({ ...g, expanded: true })),
    }));
  };

  /** Collapse all groups */
  const collapseAll = () => {
    setState((prev) => ({
      ...prev,
      fileGroups: prev.fileGroups.map((g) => ({ ...g, expanded: false })),
    }));
  };

  /** Navigate to a reference */
  const navigateToReference = (uri: string, line: number, column: number) => {
    props.onNavigate?.(uri, line, column);
  };

  /** Handle keyboard navigation */
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!state().visible) return;

    const items = flatReferenceList();
    const currentIndex = state().selectedIndex;

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        hide();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          setState((prev) => ({ ...prev, selectedIndex: currentIndex + 1 }));
          scrollToSelected(currentIndex + 1);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          setState((prev) => ({ ...prev, selectedIndex: currentIndex - 1 }));
          scrollToSelected(currentIndex - 1);
        }
        break;
      case "Enter":
        e.preventDefault();
        if (currentIndex >= 0 && currentIndex < items.length) {
          const item = items[currentIndex];
          navigateToReference(item.uri, item.line, item.column);
        }
        break;
    }
  };

  /** Scroll to keep selected item visible */
  const scrollToSelected = (index: number) => {
    if (!listRef) return;
    const items = listRef.querySelectorAll(".reference-item");
    const selectedItem = items[index] as HTMLElement | undefined;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: "nearest" });
    }
  };

  // ============================================================================
  // Event Listeners
  // ============================================================================

  createEffect(() => {
    const handleShowReferences = (
      e: CustomEvent<{
        locations: Location[];
        symbolName: string;
        originUri: string;
        originPosition: Position;
      }>
    ) => {
      if (e.detail) {
        showReferences(
          e.detail.locations,
          e.detail.symbolName,
          e.detail.originUri,
          e.detail.originPosition
        );
      }
    };

    const handleHideReferences = () => {
      hide();
    };

    window.addEventListener("references:show", handleShowReferences as EventListener);
    window.addEventListener("references:hide", handleHideReferences);
    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      window.removeEventListener("references:show", handleShowReferences as EventListener);
      window.removeEventListener("references:hide", handleHideReferences);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Focus filter input when panel opens
  createEffect(() => {
    if (state().visible && containerRef) {
      const filterInput = containerRef.querySelector("input");
      filterInput?.focus();
    }
  });

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Show when={state().visible}>
      <div 
        ref={containerRef}
        class="references-panel"
      >
        {/* Header */}
        <div class="references-panel-header">
          <div class="references-panel-title">
            <span class="references-panel-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM4.5 2H12v12H4V2h.5z"/>
                <path d="M5 4h6v1H5zm0 2h6v1H5zm0 2h4v1H5z"/>
              </svg>
            </span>
            <span class="references-panel-symbol">{state().symbolName}</span>
            <span class="references-panel-count">
              {state().totalCount} reference{state().totalCount !== 1 ? "s" : ""}
            </span>
          </div>
          
          <div class="references-panel-actions">
            <button
              class="references-panel-action-btn"
              onClick={expandAll}
              title="Expand All"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 8l3 3 3-3H5z"/>
              </svg>
            </button>
            <button
              class="references-panel-action-btn"
              onClick={collapseAll}
              title="Collapse All"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 5l3 3H5l3-3z"/>
              </svg>
            </button>
            <button
              class="references-panel-close-btn"
              onClick={hide}
              title="Close (Escape)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Filter */}
        <div class="references-panel-filter">
          <input
            type="text"
            placeholder="Filter references..."
            value={filterText()}
            onInput={(e) => setFilterText(e.currentTarget.value)}
            class="references-panel-filter-input"
          />
        </div>

        {/* Content */}
        <div class="references-panel-content" ref={listRef}>
          <Show when={state().loading}>
            <div class="references-panel-loading">
              <div class="references-panel-spinner" />
              <span>Finding references...</span>
            </div>
          </Show>

          <Show when={state().error}>
            <div class="references-panel-error">
              <span class="references-panel-error-icon">!</span>
              <span>{state().error}</span>
            </div>
          </Show>

          <Show when={!state().loading && !state().error && filteredGroups().length === 0}>
            <div class="references-panel-empty">
              <span>No references found</span>
            </div>
          </Show>

          <Show when={!state().loading && !state().error && filteredGroups().length > 0}>
            <For each={filteredGroups()}>
              {(group, groupIndex) => {
                // Calculate base index for this group
                const baseIndex = () => {
                  let count = 0;
                  for (let i = 0; i < groupIndex(); i++) {
                    const g = filteredGroups()[i];
                    if (g.expanded) {
                      count += g.references.length;
                    }
                  }
                  return count;
                };

                return (
                  <div class="references-file-group">
                    {/* File header */}
                    <div
                      class="references-file-header"
                      onClick={() => toggleGroup(groupIndex())}
                    >
                      <span class="references-file-chevron" classList={{ expanded: group.expanded }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M6 4l4 4-4 4V4z"/>
                        </svg>
                      </span>
                      <span class="references-file-icon">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M14 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h7.5L14 4.5zM13 4.5V5H10a1 1 0 0 1-1-1V1.5H3a.5.5 0 0 0-.5.5v12a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V4.5H13z"/>
                        </svg>
                      </span>
                      <span class="references-file-name">{group.fileName}</span>
                      <span class="references-file-path">{group.dirPath}</span>
                      <span class="references-file-count">{group.references.length}</span>
                    </div>

                    {/* References list */}
                    <Show when={group.expanded}>
                      <div class="references-list">
                        <For each={group.references}>
                          {(ref, refIndex) => {
                            const currentItemIndex = baseIndex() + refIndex();
                            const isSelected = () => state().selectedIndex === currentItemIndex;
                            const lineNumber = ref.range.start.line + 1;
                            const highlighted = highlightMatch(
                              ref.lineContent || "",
                              ref.range.start.character,
                              ref.range.end.character
                            );

                            return (
                              <div
                                class="reference-item"
                                classList={{ selected: isSelected() }}
                                onClick={() => {
                                  setState((prev) => ({ ...prev, selectedIndex: currentItemIndex }));
                                  navigateToReference(ref.uri, lineNumber, ref.range.start.character + 1);
                                }}
                              >
                                <span class="reference-line-number">{lineNumber}</span>
                                <span class="reference-preview">
                                  <span class="reference-text-before">{highlighted.before}</span>
                                  <span class="reference-text-match">{highlighted.match}</span>
                                  <span class="reference-text-after">{highlighted.after}</span>
                                </span>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Helper functions to trigger panel from outside
// ============================================================================

/** Show references panel with given locations */
export function showReferencesPanel(
  locations: Location[],
  symbolName: string,
  originUri: string,
  originPosition: Position
) {
  window.dispatchEvent(
    new CustomEvent("references:show", {
      detail: { locations, symbolName, originUri, originPosition },
    })
  );
}

/** Hide references panel */
export function hideReferencesPanel() {
  window.dispatchEvent(new CustomEvent("references:hide"));
}

export default ReferencesPanel;

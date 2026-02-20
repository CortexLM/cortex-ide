import { 
  createSignal, 
  For, 
  Show, 
  createEffect, 
  onMount, 
  onCleanup, 
  createMemo,
  batch,
  untrack,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Icon } from './ui/Icon';
import { useWorkspace, type WorkspaceFolder, FOLDER_COLORS } from "../context/WorkspaceContext";
import { useFileOperations } from "../context/FileOperationsContext";
import { 
  useSettings,
  type FileNestingSettings,
  type FileNestingPatterns,
  type ExplorerSortOrder,
} from "../context/SettingsContext";
import { useMultiRepo, type GitFileStatus } from "../context/MultiRepoContext";
import { fsDeleteFile, fsDeleteDirectory } from "../utils/tauri-api";
import { type ExplorerRevealPayload, addAppEventListener } from "../utils/eventBus";

import { tokens } from "@/design-system/tokens";


import { SidebarSkeleton } from "./ui/SidebarSkeleton";

import { ExplorerWelcome } from "./WelcomeView";
import { ContextMenu, ContextMenuPresets } from "./ui/ContextMenu";

// ============================================================================
// Types
// ============================================================================

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  isHidden: boolean;
  isSymlink: boolean;
  size?: number;
  modifiedAt?: number;
  extension?: string;
  children?: FileEntry[];
}

interface CompactedFileEntry extends FileEntry {
  compactedName?: string;
  compactedPaths?: string[];
}

interface FileExplorerProps {
  rootPath?: string | null;
  onFileSelect?: (path: string) => void;
  onFilePreview?: (path: string) => void; // Opens file in preview mode (single-click)
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  entry: FlattenedItem | null;
}

interface ClipboardState {
  paths: string[];
  operation: 'cut' | 'copy';
}

/** Flattened item for virtual scrolling */
interface FlattenedItem {
  id: string;
  entry: CompactedFileEntry;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
  parentPath: string | null;
  isNestedParent: boolean;
  nestedFiles?: FileEntry[];
  isNestedExpanded?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ITEM_HEIGHT = 18; // Compact tree item height (reduced 25%)
const OVERSCAN = 10;
const DEBOUNCE_DELAY = 100;
const LAZY_LOAD_DEPTH = 1;
const TREE_INDENT_SIZE = 16; // Indent per depth level
const TREE_BASE_PADDING = 12; // Base left padding

// ============================================================================
// Git Decoration Types & Utilities
// ============================================================================

/** Git decoration information for a file or folder */
interface GitDecoration {
  /** CSS class for the name text */
  nameClass: string;
  /** Badge letter (M, A, D, U, R, !) */
  badge?: string;
  /** CSS class for the badge */
  badgeClass?: string;
  /** Status for reference */
  status: GitFileStatus | "folder-modified" | "folder-added" | "folder-conflict" | null;
}

/** Get git decoration for a file based on its status */
function getGitDecorationForStatus(status: GitFileStatus | null): GitDecoration {
  if (!status) {
    return { nameClass: "", status: null };
  }

  switch (status) {
    case "modified":
      return {
        nameClass: "file-tree-name--git-modified",
        badge: "M",
        badgeClass: "file-tree-git-badge file-tree-git-badge--modified",
        status,
      };
    case "added":
      return {
        nameClass: "file-tree-name--git-added",
        badge: "A",
        badgeClass: "file-tree-git-badge file-tree-git-badge--added",
        status,
      };
    case "deleted":
      return {
        nameClass: "file-tree-name--git-deleted",
        badge: "D",
        badgeClass: "file-tree-git-badge file-tree-git-badge--deleted",
        status,
      };
    case "untracked":
      return {
        nameClass: "file-tree-name--git-untracked",
        badge: "U",
        badgeClass: "file-tree-git-badge file-tree-git-badge--untracked",
        status,
      };
    case "renamed":
      return {
        nameClass: "file-tree-name--git-renamed",
        badge: "R",
        badgeClass: "file-tree-git-badge file-tree-git-badge--renamed",
        status,
      };
    case "conflict":
      return {
        nameClass: "file-tree-name--git-conflict",
        badge: "!",
        badgeClass: "file-tree-git-badge file-tree-git-badge--conflict",
        status,
      };
    default:
      return { nameClass: "", status: null };
  }
}

/** Get folder decoration based on children statuses */
function getFolderDecoration(
  hasConflicts: boolean,
  hasAdded: boolean,
  hasModified: boolean
): GitDecoration {
  if (hasConflicts) {
    return {
      nameClass: "file-tree-name--git-folder-conflict",
      status: "folder-conflict",
    };
  }
  if (hasAdded) {
    return {
      nameClass: "file-tree-name--git-folder-added",
      status: "folder-added",
    };
  }
  if (hasModified) {
    return {
      nameClass: "file-tree-name--git-folder-modified",
      status: "folder-modified",
    };
  }
  return { nameClass: "", status: null };
}

// ============================================================================
// File Nesting Types & Utilities  
// ============================================================================

interface NestedFileGroup {
  parent: FileEntry;
  nestedFiles: FileEntry[];
}

function matchesNestingGlob(filename: string, pattern: string): boolean {
  const lowerFilename = filename.toLowerCase();
  const lowerPattern = pattern.toLowerCase().trim();
  if (lowerFilename === lowerPattern) return true;
  let regexPattern = lowerPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  try {
    return new RegExp(`^${regexPattern}$`, "i").test(lowerFilename);
  } catch {
    return false;
  }
}

function extractBasename(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

function isNestedFile(parentName: string, childName: string, patterns: string): boolean {
  const parentBase = extractBasename(parentName);
  for (const pattern of patterns.split(",").map((p) => p.trim()).filter(Boolean)) {
    const expanded = pattern.replace(/\$\{basename\}/gi, parentBase);
    if (matchesNestingGlob(childName, expanded)) return true;
  }
  return false;
}

function findNestingRule(parentName: string, patterns: FileNestingPatterns): string | null {
  for (const [pattern, nested] of Object.entries(patterns)) {
    if (matchesNestingGlob(parentName, pattern)) return nested;
  }
  return null;
}

function computeNestedGroups(
  entries: FileEntry[],
  settings: FileNestingSettings
): { groups: Map<string, NestedFileGroup>; standalone: FileEntry[] } {
  if (!settings.enabled) {
    return { groups: new Map(), standalone: entries };
  }
  const groups = new Map<string, NestedFileGroup>();
  const nestedPaths = new Set<string>();
  const parentRules = new Map<string, string>();

  for (const e of entries) {
    if (!e.isDir) {
      const rule = findNestingRule(e.name, settings.patterns);
      if (rule) parentRules.set(e.path, rule);
    }
  }

  for (const [parentPath, rule] of parentRules) {
    const parent = entries.find((e) => e.path === parentPath);
    if (!parent) continue;
    const nested: FileEntry[] = [];
    for (const e of entries) {
      if (!e.isDir && e.path !== parentPath && isNestedFile(parent.name, e.name, rule)) {
        nested.push(e);
        nestedPaths.add(e.path);
      }
    }
    if (nested.length > 0) {
      groups.set(parentPath, {
        parent,
        nestedFiles: nested.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      });
    }
  }

  return { groups, standalone: entries.filter((e) => !nestedPaths.has(e.path)) };
}

// ============================================================================
// File Icons & Colors (Memoized lookup)
// ============================================================================

// VS Code style: all file names use the same color (JetBrains text body color)
// Git status colors are handled separately via CSS classes
const FILE_COLORS: Record<string, string> = {
  // Empty - all files use default color like VS Code
};

import { getFileIcon as getFileIconPath, getFolderIcon } from "@/utils/fileIcons";
import { generateUniquePath, basename as getBasename, joinPath } from "@/utils/fileUtils";

// ============================================================================
// LRU Cache Implementation for Icons and Colors
// Prevents unbounded memory growth while maintaining performance
// ============================================================================

const ICON_CACHE_MAX_SIZE = 500;
const COLOR_CACHE_MAX_SIZE = 200;

class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // If key exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest entry (first key in Map iteration order)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

const iconCache = new LRUCache<string, string>(ICON_CACHE_MAX_SIZE);
const colorCache = new LRUCache<string, string>(COLOR_CACHE_MAX_SIZE);

/**
 * Clear all icon and color caches.
 * Call this when the FileExplorer is unmounted or when memory needs to be freed.
 */
export function clearFileExplorerCaches(): void {
  iconCache.clear();
  colorCache.clear();
}

function getFileIconSvg(name: string, isDir: boolean, _isExpanded: boolean): string {
  if (isDir) {
    return getFolderIcon(name);
  }
  const cacheKey = name;
  const cached = iconCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const iconPath = getFileIconPath(name, false);
  iconCache.set(cacheKey, iconPath);
  return iconPath;
}

function getFileColor(name: string): string {
  const cached = colorCache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const ext = name.split(".").pop()?.toLowerCase() || "";
  // Use JetBrains text body color for all file names
  const color = FILE_COLORS[ext] || tokens.colors.text.primary;
  colorCache.set(name, color);
  return color;
}

// ============================================================================
// Sorting & Filtering (Pure functions for memoization)
// ============================================================================

function sortEntries(entries: FileEntry[], sortOrder: ExplorerSortOrder = "default"): FileEntry[] {
  return [...entries].sort((a, b) => {
    switch (sortOrder) {
      case "mixed":
        // Alphabetical, folders and files mixed
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      
      case "filesFirst":
        // Files before folders, then alphabetically
        if (!a.isDir && b.isDir) return -1;
        if (a.isDir && !b.isDir) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      
      case "type":
        // Sort by file extension, folders first
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        if (a.isDir && b.isDir) {
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        }
        // For files, sort by extension first, then by name
        const extA = a.name.includes('.') ? a.name.split('.').pop()?.toLowerCase() || '' : '';
        const extB = b.name.includes('.') ? b.name.split('.').pop()?.toLowerCase() || '' : '';
        if (extA !== extB) {
          return extA.localeCompare(extB, undefined, { sensitivity: "base" });
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      
      case "modified":
        // Most recently modified first, folders first
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        // Sort by modification time (most recent first)
        const modA = a.modifiedAt || 0;
        const modB = b.modifiedAt || 0;
        if (modA !== modB) {
          return modB - modA; // Descending (most recent first)
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      
      case "default":
      default:
        // Folders first, then files, alphabetically
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    }
  });
}

function filterEntries(entries: FileEntry[], query: string, showHidden: boolean): FileEntry[] {
  const queryLower = query.toLowerCase();
  return entries.filter(entry => {
    if (!showHidden && entry.isHidden) return false;
    if (!query) return true;
    return entry.name.toLowerCase().includes(queryLower);
  });
}

// ============================================================================
// Compact Folders Logic
// ============================================================================

function compactFolderEntries(
  entries: FileEntry[],
  compactEnabled: boolean,
  showHidden: boolean
): CompactedFileEntry[] {
  if (!compactEnabled) {
    return entries as CompactedFileEntry[];
  }
  return entries.map(entry => compactSingleEntry(entry, showHidden));
}

function compactSingleEntry(entry: FileEntry, showHidden: boolean): CompactedFileEntry {
  if (!entry.isDir || !entry.children) {
    return entry as CompactedFileEntry;
  }

  const visibleChildren = entry.children.filter(child => 
    showHidden || !child.isHidden
  );

  if (visibleChildren.length === 1 && visibleChildren[0].isDir) {
    const singleChild = visibleChildren[0];
    const compactedChild = compactSingleEntry(singleChild, showHidden);
    const childDisplayName = compactedChild.compactedName || compactedChild.name;
    const compactedName = `${entry.name}/${childDisplayName}`;
    const compactedPaths = [entry.path];
    if (compactedChild.compactedPaths) {
      compactedPaths.push(...compactedChild.compactedPaths);
    } else {
      compactedPaths.push(compactedChild.path);
    }

    const result: CompactedFileEntry = {
      ...compactedChild,
      compactedName,
      compactedPaths,
    };

    if (compactedChild.children) {
      result.children = compactedChild.children.map(child => 
        compactSingleEntry(child, showHidden)
      );
    }

    return result;
  }

  const result: CompactedFileEntry = {
    ...entry,
    children: entry.children.map(child => compactSingleEntry(child, showHidden)),
  };

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function extractProjectName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || parts[parts.length - 2] || "Project";
}

function debounce<T extends (...args: unknown[]) => void>(
  fn: T, 
  delay: number
): { call: (...args: Parameters<T>) => void; cancel: () => void } {
  let timeoutId: number | null = null;
  return {
    call: (...args: Parameters<T>) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        fn(...args);
        timeoutId = null;
      }, delay);
    },
    cancel: () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };
}

// ============================================================================
// Virtual Scroll Item Component
// ============================================================================

interface VirtualItemProps {
  item: FlattenedItem;
  isSelected: boolean; // Pre-computed to avoid array.includes in render
  focusedPath: string | null;
  renamingPath: string | null;
  dragOverPath: string | null;
  isDragCopy: boolean;
  isCut: boolean;
  gitDecoration?: GitDecoration;
  indentGuidesEnabled: boolean;
  enablePreview: boolean; // VS Code: workbench.editor.enablePreview
  isEntering: boolean; // True when item is part of a recently expanded folder
  onSelect: (path: string, event?: MouseEvent) => void;
  onOpen: (entry: FileEntry) => void;
  onOpenPreview: (entry: FileEntry) => void; // Opens file in preview mode
  onToggleExpand: (path: string, additionalPaths?: string[]) => void;
  onToggleNestedExpand: (path: string) => void;
  onContextMenu: (e: MouseEvent, item: FlattenedItem) => void;
  onRename: (oldPath: string, newName: string) => void;
  onDragStart: (e: DragEvent, entry: FileEntry) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent, entry: FileEntry) => void;
  onDrop: (e: DragEvent, entry: FileEntry) => void;
  onFocus: (path: string) => void;
}

function VirtualItem(props: VirtualItemProps) {
  const [renameValue, setRenameValue] = createSignal("");
  let inputRef: HTMLInputElement | undefined;
  
  // Use pre-computed isSelected prop instead of checking array
  const isFocused = () => props.focusedPath === props.item.entry.path;
  const isRenaming = () => props.renamingPath === props.item.entry.path;
  const isDragOver = () => props.dragOverPath === props.item.entry.path;
  
  const displayName = createMemo(() => 
    props.item.entry.compactedName || props.item.entry.name
  );
  
  const fileIconPath = createMemo(() => 
    getFileIconSvg(props.item.entry.name, props.item.entry.isDir, props.item.isExpanded)
  );
  
  const fileColor = createMemo(() => 
    props.item.entry.isDir ? undefined : getFileColor(props.item.entry.name)
  );
  
  const compactedPaths = () => props.item.entry.compactedPaths;
  
  createEffect(() => {
    if (isRenaming()) {
      setRenameValue(props.item.entry.name);
      setTimeout(() => {
        inputRef?.focus();
        if (!props.item.entry.isDir) {
          const lastDot = props.item.entry.name.lastIndexOf(".");
          if (lastDot > 0) {
            inputRef?.setSelectionRange(0, lastDot);
          } else {
            inputRef?.select();
          }
        } else {
          inputRef?.select();
        }
      }, 10);
    }
  });
  
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    
    // For directories, toggle expand immediately without waiting for selection update
    if (props.item.entry.isDir && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      props.onSelect(props.item.entry.path, e);
      props.onToggleExpand(props.item.entry.path, compactedPaths());
      return;
    }
    
    props.onSelect(props.item.entry.path, e);
    
    // Only expand/open on simple click without modifiers
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (props.item.isNestedParent && !props.item.entry.isDir) {
        // For nested parent files, use preview mode if enabled
        if (props.enablePreview) {
          props.onOpenPreview(props.item.entry);
        } else {
          props.onOpen(props.item.entry);
        }
      } else {
        // For regular files, use preview mode if enabled
        if (props.enablePreview) {
          props.onOpenPreview(props.item.entry);
        } else {
          props.onOpen(props.item.entry);
        }
      }
    }
  };
  
  const handleChevronClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (props.item.isNestedParent) {
      props.onToggleNestedExpand(props.item.entry.path);
    } else if (props.item.entry.isDir) {
      props.onToggleExpand(props.item.entry.path, compactedPaths());
    }
  };
  
  const handleDoubleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!props.item.entry.isDir) {
      props.onOpen(props.item.entry);
    }
  };
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (isRenaming()) {
      if (e.key === "Enter") {
        e.preventDefault();
        props.onRename(props.item.entry.path, renameValue());
      } else if (e.key === "Escape") {
        e.preventDefault();
        props.onRename(props.item.entry.path, props.item.entry.name);
      }
      return;
    }
    
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (props.item.entry.isDir) {
          props.onToggleExpand(props.item.entry.path, compactedPaths());
        } else {
          props.onOpen(props.item.entry);
        }
        break;
      case "ArrowRight":
        if (props.item.entry.isDir && !props.item.isExpanded) {
          e.preventDefault();
          props.onToggleExpand(props.item.entry.path, compactedPaths());
        }
        break;
      case "ArrowLeft":
        if (props.item.entry.isDir && props.item.isExpanded) {
          e.preventDefault();
          props.onToggleExpand(props.item.entry.path, compactedPaths());
        }
        break;
    }
  };
  
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only change selection if right-clicked item is not already selected
    // This preserves multi-selection when right-clicking on a selected item
    if (!props.isSelected) {
      props.onSelect(props.item.entry.path);
    }
    props.onContextMenu(e, props.item);
  };
  
  const handleDragStart = (e: DragEvent) => {
    props.onDragStart(e, props.item.entry);
  };

  const handleDragEnd = () => {
    props.onDragEnd();
  };
  
  const handleDragOver = (e: DragEvent) => {
    props.onDragOver(e, props.item.entry);
  };
  
  const handleDrop = (e: DragEvent) => {
    props.onDrop(e, props.item.entry);
  };

  const showChevron = () => 
    props.item.entry.isDir || props.item.isNestedParent;
  
  const isExpandedOrNestedExpanded = () => 
    props.item.isNestedParent ? props.item.isNestedExpanded : props.item.isExpanded;

  // Create array of depth indices for indent guides
  const indentGuideDepths = createMemo(() => {
    const depth = props.item.depth;
    if (depth <= 0) return [];
    return Array.from({ length: depth }, (_, i) => i);
  });

  return (
    <div
      class="file-tree-item"
      classList={{
        "file-tree-item--selected": props.isSelected,
        "file-tree-item--focused": isFocused(),
        "file-tree-item--drag-over": isDragOver() && props.item.entry.isDir,
        "file-tree-item--drag-copy": isDragOver() && props.item.entry.isDir && props.isDragCopy,
        "file-tree-item--nested": !props.item.entry.isDir && !props.item.isNestedParent && props.item.depth > 0,
        "file-tree-item--entering": props.isEntering,
      }}
      data-depth={props.item.depth}
      style={{ 
        "padding-left": `${props.item.depth * TREE_INDENT_SIZE + TREE_BASE_PADDING}px`,
        height: `${ITEM_HEIGHT}px`,
        opacity: props.isCut ? 0.5 : 1,
      }}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onFocus={() => props.onFocus(props.item.entry.path)}
      draggable={!isRenaming()}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      tabIndex={0}
      role="treeitem"
      aria-expanded={props.item.entry.isDir ? props.item.isExpanded : undefined}
      aria-selected={props.isSelected}
    >
      {/* Indent Guides */}
      <Show when={props.indentGuidesEnabled && props.item.depth > 0}>
        <div class="file-tree-indent-guides" aria-hidden="true">
          <For each={indentGuideDepths()}>
            {(level) => (
              <span 
                class="file-tree-indent-guide"
                style={{ left: `${level * 16 + 12}px` }}
              />
            )}
          </For>
        </div>
      </Show>

      {/* Chevron */}
      <span 
        class="file-tree-chevron"
        classList={{ 
          "file-tree-chevron--expanded": isExpandedOrNestedExpanded(),
          "file-tree-chevron--hidden": !showChevron(),
        }}
        onClick={handleChevronClick}
      >
        <Show when={showChevron()}>
          <Show 
            when={!props.item.isLoading}
            fallback={<Icon name="spinner" size={12} class="animate-spin" />}
          >
            <Icon name="chevron-right" size={12} />
          </Show>
        </Show>
      </span>
      
      {/* Icon */}
      <img 
        src={fileIconPath()} 
        alt="" 
        class="file-tree-icon"
        style={{ 
          width: "16px", 
          height: "16px",
          "flex-shrink": "0",
        }}
        draggable={false}
      />
      
      {/* Name or Rename Input */}
      <Show 
        when={isRenaming()}
        fallback={
          <span 
            class={`file-tree-name ${props.gitDecoration?.nameClass || ""}`}
            style={{ color: props.gitDecoration?.nameClass ? undefined : fileColor() }}
            title={props.item.entry.compactedName ? props.item.entry.path : undefined}
          >
            {displayName()}
          </span>
        }
      >
        <input
          ref={inputRef}
          type="text"
          class="file-tree-rename-input"
          value={renameValue()}
          onInput={(e) => setRenameValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => props.onRename(props.item.entry.path, renameValue())}
          onClick={(e) => e.stopPropagation()}
        />
      </Show>
      
      {/* Git status badge */}
      <Show when={props.gitDecoration?.badge && props.gitDecoration?.badgeClass}>
        <span 
          class={props.gitDecoration!.badgeClass}
          title={`Git: ${props.gitDecoration!.status}`}
        >
          {props.gitDecoration!.badge}
        </span>
      </Show>
      
      {/* Nested files count badge */}
      <Show when={props.item.isNestedParent && props.item.nestedFiles}>
        <span class="file-tree-nested-badge" title={`${props.item.nestedFiles!.length} nested file(s)`}>
          {props.item.nestedFiles!.length}
        </span>
      </Show>
    </div>
  );
}

// ============================================================================
// Skeleton Loader Component
// ============================================================================

function SkeletonLoader(props: { depth: number; count: number }) {
  return (
    <For each={Array(props.count).fill(0)}>
      {(_, index) => (
        <div 
          class="file-tree-skeleton"
          style={{ 
            "padding-left": `${props.depth * TREE_INDENT_SIZE + TREE_BASE_PADDING}px`,
            height: `${ITEM_HEIGHT}px`,
          }}
        >
          <span class="file-tree-skeleton-chevron" />
          <span class="file-tree-skeleton-icon" />
          <span 
            class="file-tree-skeleton-name" 
            style={{ width: `${60 + (index() % 3) * 20}px` }}
          />
        </div>
      )}
    </For>
  );
}

// ============================================================================
// Workspace Folder Header Component
// ============================================================================

interface WorkspaceFolderHeaderProps {
  folder: WorkspaceFolder;
  isExpanded: boolean;
  isActive: boolean;
  folderIndex: number;
  totalFolders: number;
  onToggle: () => void;
  onRemove: () => void;
  onSetActive: () => void;
  onRename: (name: string) => void;
  onSetColor: (color: string | undefined) => void;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: () => void;
}

function WorkspaceFolderHeader(props: WorkspaceFolderHeaderProps) {
  const [showMenu, setShowMenu] = createSignal(false);
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const [isRenaming, setIsRenaming] = createSignal(false);
  const [renameValue, setRenameValue] = createSignal(props.folder.name);
  let menuRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const handleRenameSubmit = () => {
    const newName = renameValue().trim();
    if (newName && newName !== props.folder.name) {
      props.onRename(newName);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setRenameValue(props.folder.name);
      setIsRenaming(false);
    }
  };

  createEffect(() => {
    if (isRenaming()) {
      setRenameValue(props.folder.name);
      setTimeout(() => inputRef?.select(), 10);
    }
  });

  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        setShowMenu(false);
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  return (
    <div
      class="workspace-folder-header"
      classList={{
        "workspace-folder-header--active": props.isActive,
        "workspace-folder-header--expanded": props.isExpanded,
      }}
      style={{
        "border-left": props.folder.color ? `3px solid ${props.folder.color}` : undefined,
      }}
      draggable={props.totalFolders > 1}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      onDragEnd={props.onDragEnd}
    >
      <button
        class="workspace-folder-toggle"
        onClick={props.onToggle}
        title={props.isExpanded ? "Collapse" : "Expand"}
      >
        {props.isExpanded ? (
          <Icon name="chevron-down" size={14} />
        ) : (
          <Icon name="chevron-right" size={14} />
        )}
      </button>

      <div class="workspace-folder-info" onClick={props.onSetActive}>
        <Show
          when={!isRenaming()}
          fallback={
            <input
              ref={inputRef}
              type="text"
              class="workspace-folder-rename-input"
              value={renameValue()}
              onInput={(e) => setRenameValue(e.currentTarget.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleRenameSubmit}
            />
          }
        >
          <span class="workspace-folder-name" title={props.folder.path}>
            {props.folder.name}
          </span>
        </Show>
      </div>

      <div class="workspace-folder-actions">
        <div class="relative" ref={menuRef}>
          <button
            class="workspace-folder-action"
            onClick={() => setShowMenu(!showMenu())}
            title="More actions"
          >
            <Icon name="ellipsis-vertical" size={14} />
          </button>

          <Show when={showMenu()}>
            <div class="workspace-folder-menu">
              <button
                class="workspace-folder-menu-item"
                onClick={() => {
                  setIsRenaming(true);
                  setShowMenu(false);
                }}
              >
                Rename
              </button>
              <button
                class="workspace-folder-menu-item"
                onClick={() => {
                  setShowColorPicker(!showColorPicker());
                }}
              >
                Set Color
              </button>
              <Show when={showColorPicker()}>
                <div class="workspace-folder-color-picker">
                  <For each={FOLDER_COLORS}>
                    {(colorOption) => (
                      <button
                        class="workspace-folder-color-swatch"
                        classList={{
                          "workspace-folder-color-swatch--selected": 
                            colorOption.value === props.folder.color,
                        }}
                        style={{
                          "background-color": colorOption.value || tokens.colors.interactive.hover,
                        }}
                        title={colorOption.name}
                        onClick={() => {
                          props.onSetColor(colorOption.value);
                          setShowColorPicker(false);
                          setShowMenu(false);
                        }}
                      />
                    )}
                  </For>
                </div>
              </Show>
              <div class="workspace-folder-menu-divider" />
              <button
                class="workspace-folder-menu-item workspace-folder-menu-item--danger"
                onClick={() => {
                  props.onRemove();
                  setShowMenu(false);
                }}
              >
                Remove from Project
              </button>
            </div>
          </Show>
        </div>

        <button
          class="workspace-folder-action workspace-folder-action--remove"
          onClick={props.onRemove}
          title="Remove from project"
        >
          <Icon name="xmark" size={14} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Virtualized File Tree Component (Single Root)
// ============================================================================

interface VirtualizedFileTreeProps {
  rootPath: string;
  onFileSelect?: (path: string) => void;
  onFilePreview?: (path: string) => void; // Opens file in preview mode (single-click)
  enablePreview: boolean; // VS Code: workbench.editor.enablePreview
  selectedPaths: string[];
  onSelectPaths: (paths: string[]) => void;
  showHidden: boolean;
  filterQuery: string;
  compactFolders: boolean;
  fileNestingSettings: FileNestingSettings;
  confirmDragAndDrop: boolean;
  /** Whether to show indent guide lines in the tree */
  indentGuidesEnabled: boolean;
  /** Sort order for files and folders */
  sortOrder: ExplorerSortOrder;
  /** Map of file paths to their git status */
  gitStatusMap: Map<string, GitFileStatus>;
  /** Set of folder paths that contain changed files */
  gitFolderStatusMap: Map<string, { hasConflicts: boolean; hasAdded: boolean; hasModified: boolean }>;
  /** Whether to confirm before deleting files */
  confirmDelete: boolean;
  /** Whether to move deleted files to trash instead of permanent delete */
  enableTrash: boolean;
  /** Maximum file size (in MB) to open without warning */
  maxMemoryForLargeFilesMB: number;
}

// ============================================================================
// Drag Confirmation Dialog Component
// ============================================================================

interface DragConfirmDialogProps {
  open: boolean;
  operation: "move" | "copy";
  itemCount: number;
  targetName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DragConfirmDialog(props: DragConfirmDialogProps) {
  return (
    <Show when={props.open}>
      <div class="modal-overlay dimmed" onClick={props.onCancel}>
        <div class="dialog-shadow">
          <div 
            class="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ "min-width": "350px" }}
          >
            {/* Buttons Row */}
            <div class="modal-buttons-row">
              <div class="modal-buttons">
                <button 
                  class="modal-button modal-button-secondary"
                  onClick={props.onCancel}
                >
                  Cancel
                </button>
                <button 
                  class="modal-button modal-button-primary"
                  onClick={props.onConfirm}
                >
                  {props.operation === "copy" ? "Copy" : "Move"}
                </button>
              </div>
            </div>
            
            {/* Message Row */}
            <div class="modal-message-row">
              <div class="modal-message-container">
                <div class="modal-title">
                  {props.operation === "copy" ? "Copy" : "Move"} {props.itemCount === 1 ? "Item" : "Items"}
                </div>
                <div class="modal-detail">
                  {props.operation === "copy" ? "Copy" : "Move"} {props.itemCount} {props.itemCount === 1 ? "item" : "items"} to "{props.targetName}"?
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Large File Warning Dialog Component
// ============================================================================

interface LargeFileWarningDialogProps {
  open: boolean;
  fileName: string;
  fileSizeMB: number;
  maxSizeMB: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function LargeFileWarningDialog(props: LargeFileWarningDialogProps) {
  return (
    <Show when={props.open}>
      <div class="modal-overlay dimmed" onClick={props.onCancel}>
        <div class="dialog-shadow">
          <div 
            class="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ "min-width": "400px" }}
          >
            {/* Buttons Row */}
            <div class="modal-buttons-row">
              <div class="modal-buttons">
                <button 
                  class="modal-button modal-button-secondary"
                  onClick={props.onCancel}
                >
                  Cancel
                </button>
                <button 
                  class="modal-button modal-button-primary"
                  onClick={props.onConfirm}
                >
                  Open Anyway
                </button>
              </div>
            </div>
            
            {/* Message Row */}
            <div class="modal-message-row">
              <div class="modal-message-container">
                <div class="modal-title">Large File Warning</div>
                <div class="modal-detail">
                  The file "{props.fileName}" is {props.fileSizeMB.toFixed(1)} MB, which exceeds the configured limit of {props.maxSizeMB} MB.
                  <br /><br />
                  Opening large files may impact editor performance and memory usage.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

function VirtualizedFileTree(props: VirtualizedFileTreeProps) {
  // File operations context for undo support
  const fileOps = useFileOperations();
  
  // Directory cache for lazy loading
  const [directoryCache, setDirectoryCache] = createSignal<Map<string, FileEntry[]>>(new Map());
  const [loadingDirs, setLoadingDirs] = createSignal<Set<string>>(new Set());
  const [expandedPaths, setExpandedPaths] = createSignal<Set<string>>(new Set());
  const [expandedNestedGroups, setExpandedNestedGroups] = createSignal<Set<string>>(new Set());
  const [rootEntry, setRootEntry] = createSignal<FileEntry | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [focusedPath, setFocusedPath] = createSignal<string | null>(null);
  const [renamingPath, setRenamingPath] = createSignal<string | null>(null);
  const [draggedPaths, setDraggedPaths] = createSignal<string[]>([]);
  const [dragOverPath, setDragOverPath] = createSignal<string | null>(null);
  const [isDragCopy, setIsDragCopy] = createSignal(false);
  const [lastSelectedPath, setLastSelectedPath] = createSignal<string | null>(null);
  const [watchId, setWatchId] = createSignal<string | null>(null);
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    entry: null,
  });
  const [clipboardFiles, setClipboardFiles] = createSignal<ClipboardState | null>(null);
  
  // Pending drop operation state for confirmation dialog
  const [pendingDropOperation, setPendingDropOperation] = createSignal<{
    sourcePaths: string[];
    targetDir: string;
    targetName: string;
    isCopy: boolean;
  } | null>(null);
  
  // Large file warning state
  const [largeFileWarning, setLargeFileWarning] = createSignal<{
    path: string;
    fileName: string;
    fileSizeMB: number;
    isPreview: boolean;
  } | null>(null);
  
  // Track recently expanded folders for animation
  const [recentlyExpandedPaths, setRecentlyExpandedPaths] = createSignal<Set<string>>(new Set());
  
  // Virtual scroll state
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerHeight, setContainerHeight] = createSignal(400);
  
  let containerRef: HTMLDivElement | undefined;
  let resizeObserverRef: ResizeObserver | null = null;
  let unlistenFn: UnlistenFn | null = null;
  
  // Callback ref to setup ResizeObserver when container is available
  const setContainerRef = (el: HTMLDivElement) => {
    containerRef = el;
    if (el && !resizeObserverRef) {
      // Set initial height immediately
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        setContainerHeight(rect.height);
      }
      
      resizeObserverRef = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.contentRect.height;
          if (height > 0) {
            setContainerHeight(height);
          }
        }
      });
      resizeObserverRef.observe(el);
    }
  };
  
  // Create debounced refresh function
  const debouncedRefresh = debounce(() => {
    batch(() => {
      loadRootDirectory();
      refreshExpandedDirectories();
    });
  }, DEBOUNCE_DELAY);
  
  // Load root directory (lazy - depth 1)
  const loadRootDirectory = async () => {
    if (!props.rootPath) return;

    setLoading(true);
    setError(null);

    try {
      const data = await invoke<FileEntry>("fs_get_file_tree", {
        path: props.rootPath,
        depth: LAZY_LOAD_DEPTH,
        showHidden: true,
        includeIgnored: false,
      });

      batch(() => {
        setRootEntry(data);
        if (data?.children) {
          setDirectoryCache(prev => {
            const next = new Map(prev);
            next.set(data.path, data.children!);
            return next;
          });
        }
        if (data?.path) {
          setExpandedPaths((prev) => {
            const next = new Set(prev);
            next.add(data.path);
            return next;
          });
        }
      });
    } catch (e) {
      console.error("Failed to load file tree:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  
  // Load directory children lazily
  const loadDirectoryChildren = async (dirPath: string): Promise<FileEntry[] | null> => {
    if (loadingDirs().has(dirPath)) return null;
    
    const cached = directoryCache().get(dirPath);
    if (cached) return cached;
    
    setLoadingDirs(prev => {
      const next = new Set(prev);
      next.add(dirPath);
      return next;
    });
    
    try {
      const data = await invoke<FileEntry>("fs_get_file_tree", {
        path: dirPath,
        depth: LAZY_LOAD_DEPTH,
        showHidden: true,
        includeIgnored: false,
      });
      
      batch(() => {
        if (data?.children) {
          setDirectoryCache(prev => {
            const next = new Map(prev);
            next.set(dirPath, data.children!);
            return next;
          });
        }
        setLoadingDirs(prev => {
          const next = new Set(prev);
          next.delete(dirPath);
          return next;
        });
      });
      
      return data?.children || [];
    } catch (e) {
      console.error("Failed to load directory:", dirPath, e);
      setLoadingDirs(prev => {
        const next = new Set(prev);
        next.delete(dirPath);
        return next;
      });
      return null;
    }
  };
  
  // Refresh only expanded directories - batch state updates for better performance
  const refreshExpandedDirectories = async () => {
    const expanded = expandedPaths();
    const expandedArray = Array.from(expanded);
    
    // Fetch all directories in parallel
    const results = await Promise.allSettled(
      expandedArray.map(async (dirPath) => {
        const data = await invoke<FileEntry>("fs_get_file_tree", {
          path: dirPath,
          depth: LAZY_LOAD_DEPTH,
          showHidden: true,
          includeIgnored: false,
        });
        return { dirPath, children: data?.children };
      })
    );
    
    // Batch all cache updates into a single state update
    const updates: Array<{ dirPath: string; children: FileEntry[] }> = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.children) {
        updates.push({ dirPath: result.value.dirPath, children: result.value.children });
      }
    }
    
    if (updates.length > 0) {
      setDirectoryCache(prev => {
        const next = new Map(prev);
        for (const { dirPath, children } of updates) {
          next.set(dirPath, children);
        }
        return next;
      });
    }
  };
  
  // Flatten tree structure for virtualization
  const flattenedItems = createMemo((): FlattenedItem[] => {
    const root = rootEntry();
    if (!root) return [];
    
    const cache = directoryCache();
    const expanded = expandedPaths();
    const loadingSet = loadingDirs();
    const nestedExpanded = expandedNestedGroups();
    const query = props.filterQuery;
    const showHidden = props.showHidden;
    const compactFolders = props.compactFolders;
    const nestingSettings = props.fileNestingSettings;
    const sortOrder = props.sortOrder;
    
    const items: FlattenedItem[] = [];
    
    const processEntries = (
      entries: FileEntry[],
      depth: number,
      parentPath: string | null
    ) => {
      const filtered = filterEntries(entries, query, showHidden);
      const sorted = sortEntries(filtered, sortOrder);
      const compacted = compactFolderEntries(sorted, compactFolders, showHidden);
      const { groups, standalone } = computeNestedGroups(compacted, nestingSettings);
      
      for (const entry of standalone) {
        const nestedGroup = groups.get(entry.path);
        
        if (nestedGroup && !entry.isDir) {
          // File with nested children
          const isNestedExpanded = nestedExpanded.has(entry.path);
          
          items.push({
            id: entry.path,
            entry: entry as CompactedFileEntry,
            depth,
            isExpanded: false,
            isLoading: false,
            hasChildren: false,
            parentPath,
            isNestedParent: true,
            nestedFiles: nestedGroup.nestedFiles,
            isNestedExpanded,
          });
          
          // Add nested files if expanded
          if (isNestedExpanded) {
            for (const nestedFile of nestedGroup.nestedFiles) {
              items.push({
                id: nestedFile.path,
                entry: nestedFile as CompactedFileEntry,
                depth: depth + 1,
                isExpanded: false,
                isLoading: false,
                hasChildren: false,
                parentPath: entry.path,
                isNestedParent: false,
              });
            }
          }
        } else {
          // Regular file or directory
          const isDir = entry.isDir;
          const isExpanded = expanded.has(entry.path);
          const isLoading = loadingSet.has(entry.path);
          const children = cache.get(entry.path);
          const hasChildren = isDir && (children ? children.length > 0 : true);
          
          items.push({
            id: entry.path,
            entry: entry as CompactedFileEntry,
            depth,
            isExpanded,
            isLoading,
            hasChildren,
            parentPath,
            isNestedParent: false,
          });
          
          // Recursively add children if expanded
          if (isDir && isExpanded && children) {
            processEntries(children, depth + 1, entry.path);
          }
        }
      }
    };
    
    // Start from root's children
    const rootChildren = cache.get(root.path) || root.children || [];
    processEntries(rootChildren, 0, root.path);
    
    return items;
  });
  
  // Calculate visible range for virtual scrolling
  const visibleRange = createMemo(() => {
    const totalItems = flattenedItems().length;
    const scrollPosition = scrollTop();
    const viewportHeight = containerHeight();
    
    const startIndex = Math.max(0, Math.floor(scrollPosition / ITEM_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / ITEM_HEIGHT) + OVERSCAN * 2;
    const endIndex = Math.min(totalItems, startIndex + visibleCount);
    
    return { startIndex, endIndex };
  });
  
  // Get visible items
  const visibleItems = createMemo(() => {
    const items = flattenedItems();
    const { startIndex, endIndex } = visibleRange();
    return items.slice(startIndex, endIndex);
  });
  
  // Pre-compute git decorations for all visible items (avoids createMemo in For loop)
  const gitDecorationsMap = createMemo(() => {
    const decorations = new Map<string, GitDecoration>();
    const items = visibleItems();
    
    for (const item of items) {
      const normalizedPath = item.entry.path.replace(/\\/g, "/");
      
      if (item.entry.isDir) {
        const folderStatus = props.gitFolderStatusMap.get(normalizedPath);
        if (folderStatus) {
          decorations.set(item.id, getFolderDecoration(
            folderStatus.hasConflicts,
            folderStatus.hasAdded,
            folderStatus.hasModified
          ));
        } else {
          decorations.set(item.id, { nameClass: "", status: null } as GitDecoration);
        }
      } else {
        const status = props.gitStatusMap.get(normalizedPath) || null;
        decorations.set(item.id, getGitDecorationForStatus(status));
      }
    }
    
    return decorations;
  });
  
  // Total height for scroll container
  const totalHeight = createMemo(() => flattenedItems().length * ITEM_HEIGHT);
  
  // Offset for visible items
  const offsetY = createMemo(() => visibleRange().startIndex * ITEM_HEIGHT);
  
  // Convert selectedPaths array to Set for O(1) lookups
  const selectedPathsSet = createMemo(() => new Set(props.selectedPaths));
  
  // Handle scroll with requestAnimationFrame for better performance
  let scrollRafId: number | null = null;
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    const newScrollTop = target.scrollTop;
    
    // Cancel any pending update
    if (scrollRafId !== null) {
      cancelAnimationFrame(scrollRafId);
    }
    
    // Schedule update on next frame
    scrollRafId = requestAnimationFrame(() => {
      setScrollTop(newScrollTop);
      scrollRafId = null;
    });
  };
  
  // Cleanup for resize observer and scroll RAF
  onCleanup(() => {
    if (resizeObserverRef) {
      resizeObserverRef.disconnect();
      resizeObserverRef = null;
    }
    if (scrollRafId !== null) {
      cancelAnimationFrame(scrollRafId);
    }
  });
  
  // Store cleanup function reference for proper cleanup
  let cleanupRevealListener: (() => void) | null = null;

  // Register cleanup for reveal handler synchronously (before any async onMount code)
  onCleanup(() => {
    if (cleanupRevealListener) {
      cleanupRevealListener();
      cleanupRevealListener = null;
    }
  });

  onMount(async () => {
    // Load expanded paths from localStorage
    const storageKey = `file_explorer_expanded_${hashString(props.rootPath)}`;
    const stored = localStorage.getItem(storageKey);
    let restoredPaths: string[] = [];
    if (stored) {
      try {
        restoredPaths = JSON.parse(stored) as string[];
        setExpandedPaths(new Set<string>(restoredPaths));
      } catch {
        // Ignore parse errors
      }
    }
    
    await loadRootDirectory();
    
    // Load children for all restored expanded paths
    if (restoredPaths.length > 0) {
      await Promise.all(
        restoredPaths.map(path => loadDirectoryChildren(path).catch(() => {
          // Remove invalid paths from expanded set
          setExpandedPaths(prev => {
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        }))
      );
    }

    const handleReveal = async (e: CustomEvent<ExplorerRevealPayload>) => {
      const targetPath = e.detail.path.replace(/\\/g, "/");
      const normalizedRoot = props.rootPath.replace(/\\/g, "/");
      
      if (targetPath.startsWith(normalizedRoot)) {
        // Expand parents
        const relative = targetPath.slice(normalizedRoot.length).replace(/^[/\\]/, "");
        const parts = relative.split("/");
        let current = normalizedRoot;
        
        for (const part of parts) {
          if (!part) continue;
          
          const pathToBeExpanded = current;
          setExpandedPaths(prev => {
            const next = new Set(prev);
            next.add(pathToBeExpanded);
            return next;
          });
          
          if (!directoryCache().has(pathToBeExpanded)) {
            await loadDirectoryChildren(pathToBeExpanded);
          }
          
          current = `${current}/${part}`;
        }
        
        // Select the final path
        props.onSelectPaths([e.detail.path]);
        setLastSelectedPath(e.detail.path);
        
        // Wait for rendering then scroll
        setTimeout(() => {
          const index = flattenedItems().findIndex(item => 
            item.entry.path.replace(/\\/g, "/") === targetPath
          );
          if (index !== -1 && containerRef) {
            containerRef.scrollTop = index * ITEM_HEIGHT - containerHeight() / 3;
          }
        }, 100);
      }
    };

    // Use typed event listener from event bus
    cleanupRevealListener = addAppEventListener("explorer:reveal", handleReveal);
  });
  
  // Save expanded paths to localStorage with debounce to avoid blocking on rapid expansions
  let saveExpandedPathsTimeout: ReturnType<typeof setTimeout> | null = null;
  createEffect(() => {
    const storageKey = `file_explorer_expanded_${hashString(props.rootPath)}`;
    const paths = expandedPaths();
    
    // Debounce localStorage writes
    if (saveExpandedPathsTimeout) {
      clearTimeout(saveExpandedPathsTimeout);
    }
    saveExpandedPathsTimeout = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify([...paths]));
    }, 200);
  });
  
  // Setup file watcher with debouncing
  createEffect(() => {
    const rootPath = props.rootPath;
    if (!rootPath) return;

    const newWatchId = `watch_${hashString(rootPath)}`;

    if (watchId() === newWatchId) return;

    // Cleanup previous watcher
    if (watchId()) {
      invoke("fs_unwatch_directory", { watchId: watchId(), path: rootPath }).catch(console.error);
    }

    if (unlistenFn) {
      unlistenFn();
      unlistenFn = null;
    }

    // Exclude common build/dependency directories from file watching to prevent performance issues
    const excludePatterns = [
      "**/target/**",      // Rust build output
      "**/node_modules/**", // Node.js dependencies
      "**/.git/**",        // Git internals
      "**/dist/**",        // Build output
      "**/build/**",       // Build output
      "**/.next/**",       // Next.js build
      "**/__pycache__/**", // Python cache
      "**/venv/**",        // Python virtualenv
      "**/.venv/**",       // Python virtualenv
      "**/vendor/**",      // Vendor directories
      "**/.cargo/**",      // Cargo cache
    ];
    
    invoke("fs_watch_directory", { path: rootPath, watchId: newWatchId, excludePatterns })
      .then(() => setWatchId(newWatchId))
      .catch((err) => console.warn("Failed to watch directory:", err));

    listen<{ watchId: string; paths: string[]; type: string }>("fs:change", (event) => {
      if (event.payload.watchId === newWatchId) {
        debouncedRefresh.call();
      }
    }).then((fn) => {
      unlistenFn = fn;
    }).catch((err) => {
      console.warn("Failed to listen for fs:change events:", err);
    });

    onCleanup(() => {
      if (untrack(() => watchId())) {
        invoke("fs_unwatch_directory", { watchId: untrack(() => watchId()), path: rootPath }).catch(console.error);
      }
      if (unlistenFn) {
        unlistenFn();
      }
      debouncedRefresh.cancel();
    });
  });

  // Listen for header toolbar events
  onMount(() => {
    const handleToggleSearchEvent = () => {
      // Note: showSearch signal is in the main FileExplorer component
      // This event is dispatched by the header but handled by the parent
    };
    const handleNewFileEvent = async () => {
      // Trigger new file creation in the root folder
      const rootPath = props.rootPath;
      if (rootPath) {
        const name = prompt("New file name:");
        if (name) {
          const newPath = `${rootPath}/${name}`.replace(/\\/g, "/");
          try {
            await fileOps.createFileWithUndo(newPath);
            await loadRootDirectory();
            props.onSelectPaths([newPath]);
          } catch (e) {
            console.error("Failed to create file:", e);
            alert(`Failed to create file: ${e}`);
          }
        }
      }
    };
    const handleNewFolderEvent = async () => {
      // Trigger new folder creation in the root folder
      const rootPath = props.rootPath;
      if (rootPath) {
        const name = prompt("New folder name:");
        if (name) {
          const newPath = `${rootPath}/${name}`.replace(/\\/g, "/");
          try {
            await fileOps.createDirectoryWithUndo(newPath);
            await loadRootDirectory();
            setExpandedPaths((prev) => new Set([...prev, newPath]));
            props.onSelectPaths([newPath]);
          } catch (e) {
            console.error("Failed to create folder:", e);
            alert(`Failed to create folder: ${e}`);
          }
        }
      }
    };
    const handleRefreshEvent = () => {
      loadRootDirectory();
    };
    const handleCollapseAllEvent = () => {
      setExpandedPaths(new Set<string>());
    };

    window.addEventListener("fileexplorer:toggle-search", handleToggleSearchEvent);
    window.addEventListener("fileexplorer:new-file", handleNewFileEvent);
    window.addEventListener("fileexplorer:new-folder", handleNewFolderEvent);
    window.addEventListener("fileexplorer:refresh", handleRefreshEvent);
    window.addEventListener("fileexplorer:collapse-all", handleCollapseAllEvent);

    onCleanup(() => {
      window.removeEventListener("fileexplorer:toggle-search", handleToggleSearchEvent);
      window.removeEventListener("fileexplorer:new-file", handleNewFileEvent);
      window.removeEventListener("fileexplorer:new-folder", handleNewFolderEvent);
      window.removeEventListener("fileexplorer:refresh", handleRefreshEvent);
      window.removeEventListener("fileexplorer:collapse-all", handleCollapseAllEvent);
    });
  });
  
  // Toggle expand with lazy loading
  const handleToggleExpand = async (path: string, additionalPaths?: string[]) => {
    const isCurrentlyExpanded = expandedPaths().has(path);
    
    batch(() => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        
        if (isCurrentlyExpanded) {
          next.delete(path);
          if (additionalPaths) {
            for (const p of additionalPaths) {
              next.delete(p);
            }
          }
        } else {
          next.add(path);
          if (additionalPaths) {
            for (const p of additionalPaths) {
              next.add(p);
            }
          }
        }
        return next;
      });
      
      // Track recently expanded paths for animation
      if (!isCurrentlyExpanded) {
        const pathsToAnimate = [path, ...(additionalPaths || [])];
        setRecentlyExpandedPaths((prev) => {
          const next = new Set(prev);
          for (const p of pathsToAnimate) {
            next.add(p);
          }
          return next;
        });
        
        // Clear animation state after animation completes
        setTimeout(() => {
          setRecentlyExpandedPaths((prev) => {
            const next = new Set(prev);
            for (const p of pathsToAnimate) {
              next.delete(p);
            }
            return next;
          });
        }, 200); // Slightly longer than animation duration
      }
    });
    
    // Lazy load if expanding and not cached - PARALLEL loading for better performance
    if (!isCurrentlyExpanded) {
      const pathsToLoad = [path, ...(additionalPaths || [])];
      const pathsNeedingLoad = pathsToLoad.filter(p => !directoryCache().has(p));
      
      if (pathsNeedingLoad.length > 0) {
        // Load all directories in parallel instead of sequentially
        await Promise.all(pathsNeedingLoad.map(p => loadDirectoryChildren(p)));
      }
    }
  };
  
  // Toggle nested file group expansion
  const handleToggleNestedExpand = (parentPath: string) => {
    setExpandedNestedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(parentPath)) {
        next.delete(parentPath);
      } else {
        next.add(parentPath);
      }
      return next;
    });
  };
  
  // Select entry with multi-selection support
  const handleSelect = (path: string, event?: MouseEvent) => {
    const items = flattenedItems();
    const currentSelected = props.selectedPaths;
    
    // Ctrl+Click (or Cmd+Click on Mac): Toggle selection
    if (event && (event.ctrlKey || event.metaKey)) {
      if (currentSelected.includes(path)) {
        // Remove from selection
        props.onSelectPaths(currentSelected.filter(p => p !== path));
      } else {
        // Add to selection
        props.onSelectPaths([...currentSelected, path]);
      }
      setLastSelectedPath(path);
      return;
    }
    
    // Shift+Click: Range select
    if (event && event.shiftKey && lastSelectedPath()) {
      const lastPath = lastSelectedPath()!;
      const lastIndex = items.findIndex(item => item.entry.path === lastPath);
      const currentIndex = items.findIndex(item => item.entry.path === path);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const startIndex = Math.min(lastIndex, currentIndex);
        const endIndex = Math.max(lastIndex, currentIndex);
        
        // Select all items in the range
        const rangePaths = items
          .slice(startIndex, endIndex + 1)
          .map(item => item.entry.path);
        
        // Merge with existing selection if Ctrl is also held, otherwise replace
        props.onSelectPaths(rangePaths);
        return;
      }
    }
    
    // Simple click: Select single item (clear others)
    props.onSelectPaths([path]);
    setLastSelectedPath(path);
  };
  
  // Check file size and show warning if too large
  const checkFileSizeAndOpen = async (entry: FileEntry, isPreview: boolean) => {
    if (entry.isDir) return;
    
    // Check if we have a size limit configured
    const maxSizeMB = props.maxMemoryForLargeFilesMB;
    if (maxSizeMB > 0) {
      try {
        // Get file metadata to check size
        const metadata = await invoke<{ size: number }>("fs_get_metadata", { path: entry.path });
        const fileSizeMB = metadata.size / (1024 * 1024);
        
        if (fileSizeMB > maxSizeMB) {
          // Show warning dialog
          setLargeFileWarning({
            path: entry.path,
            fileName: entry.name,
            fileSizeMB,
            isPreview,
          });
          return;
        }
      } catch (e) {
        // If we can't get metadata, proceed with opening anyway
        console.warn("Could not get file metadata:", e);
      }
    }
    
    // Proceed with opening the file
    if (isPreview) {
      if (props.onFilePreview) {
        props.onFilePreview(entry.path);
      } else if (props.onFileSelect) {
        props.onFileSelect(entry.path);
      }
    } else {
      if (props.onFileSelect) {
        props.onFileSelect(entry.path);
      }
    }
  };
  
  // Open file permanently
  const handleOpen = (entry: FileEntry) => {
    if (!entry.isDir && props.onFileSelect) {
      checkFileSizeAndOpen(entry, false);
    }
  };
  
  // Open file in preview mode (single-click with preview enabled)
  const handleOpenPreview = (entry: FileEntry) => {
    if (!entry.isDir) {
      checkFileSizeAndOpen(entry, true);
    }
  };
  
  // Handle large file warning confirm
  const handleLargeFileConfirm = () => {
    const warning = largeFileWarning();
    if (warning) {
      setLargeFileWarning(null);
      if (warning.isPreview) {
        if (props.onFilePreview) {
          props.onFilePreview(warning.path);
        } else if (props.onFileSelect) {
          props.onFileSelect(warning.path);
        }
      } else {
        if (props.onFileSelect) {
          props.onFileSelect(warning.path);
        }
      }
    }
  };
  
  // Handle large file warning cancel
  const handleLargeFileCancel = () => {
    setLargeFileWarning(null);
  };
  
  // Context menu handlers
  const handleContextMenu = (e: MouseEvent, item: FlattenedItem) => {
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      entry: item,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleContextAction = async (action: string) => {
    const item = contextMenu().entry;
    if (!item) return;
    
    const entry = item.entry;
    handleCloseContextMenu();

    switch (action) {
      case "open":
        handleOpen(entry);
        break;

      case "openDefault":
        try {
          await invoke("fs_open_with_default", { path: entry.path });
        } catch (e) {
          console.error("Failed to open file:", e);
        }
        break;

      case "rename":
        setRenamingPath(entry.path);
        break;

      case "delete":
        {
          // Handle multiple selection delete
          const pathsToDelete = props.selectedPaths.length > 1 && props.selectedPaths.includes(entry.path)
            ? props.selectedPaths
            : [entry.path];
          
          // Check confirmDelete setting before showing confirmation
          let shouldProceed = true;
          if (props.confirmDelete) {
            const confirmMsg = pathsToDelete.length > 1
              ? `Delete ${pathsToDelete.length} selected items?`
              : `Delete "${entry.name}"?`;
            shouldProceed = confirm(confirmMsg);
          }
          
          if (shouldProceed) {
            try {
              for (const pathToDelete of pathsToDelete) {
                const items = flattenedItems();
                const itemToDelete = items.find(i => i.entry.path === pathToDelete);
                if (itemToDelete) {
                  const isDir = itemToDelete.entry.isDir;
                  
                  // Use trash or permanent delete based on enableTrash setting
                  if (props.enableTrash) {
                    // Use deleteWithUndo which tries trash first (with undo support)
                    await fileOps.deleteWithUndo(pathToDelete, isDir);
                  } else {
                    // Permanent delete without undo (no trash)
                    if (isDir) {
                      await fsDeleteDirectory(pathToDelete, true);
                    } else {
                      await fsDeleteFile(pathToDelete);
                    }
                  }
                }
              }
              // Clear selection after delete
              props.onSelectPaths([]);
              debouncedRefresh.call();
            } catch (e) {
              console.error("Failed to delete:", e);
              alert(`Failed to delete: ${e}`);
            }
          }
        }
        break;

      case "newFile":
        {
          const name = prompt("New file name:");
          if (name) {
            const newPath = `${entry.path}/${name}`.replace(/\\/g, "/");
            try {
              // Use createFileWithUndo for undo support
              await fileOps.createFileWithUndo(newPath);
              await loadDirectoryChildren(entry.path);
              setExpandedPaths((prev) => new Set([...prev, entry.path]));
              props.onSelectPaths([newPath]);
            } catch (e) {
              console.error("Failed to create file:", e);
              alert(`Failed to create file: ${e}`);
            }
          }
        }
        break;

      case "newFolder":
        {
          const name = prompt("New folder name:");
          if (name) {
            const newPath = `${entry.path}/${name}`.replace(/\\/g, "/");
            try {
              // Use createDirectoryWithUndo for undo support
              await fileOps.createDirectoryWithUndo(newPath);
              await loadDirectoryChildren(entry.path);
              setExpandedPaths((prev) => new Set([...prev, entry.path]));
              props.onSelectPaths([newPath]);
            } catch (e) {
              console.error("Failed to create folder:", e);
              alert(`Failed to create folder: ${e}`);
            }
          }
        }
        break;

      case "copyPath":
        try {
          await writeText(entry.path);
        } catch (e) {
          console.error("Failed to copy path:", e);
        }
        break;

      case "copyRelativePath":
        {
          const relative = entry.path.replace(props.rootPath, "").replace(/^[/\\]/, "");
          try {
            await writeText(relative);
          } catch (e) {
            console.error("Failed to copy path:", e);
          }
        }
        break;

      case "reveal":
        try {
          await invoke("fs_reveal_in_explorer", { path: entry.path });
        } catch (e) {
          console.error("Failed to reveal:", e);
        }
        break;

      case "cut":
        setClipboardFiles({ paths: [entry.path], operation: 'cut' });
        break;

      case "copy":
        setClipboardFiles({ paths: [entry.path], operation: 'copy' });
        break;

      case "paste":
        await handlePaste(entry.isDir ? entry.path : item.parentPath || props.rootPath);
        break;

      case "duplicate":
        {
          // Handle multiple selection duplicate
          const pathsToDuplicate = props.selectedPaths.length > 1 && props.selectedPaths.includes(entry.path)
            ? props.selectedPaths
            : [entry.path];
          
          try {
            const newPaths: string[] = [];
            for (const pathToDuplicate of pathsToDuplicate) {
              const items = flattenedItems();
              const itemToDuplicate = items.find(i => i.entry.path === pathToDuplicate);
              if (itemToDuplicate) {
                const newPath = await fileOps.duplicateWithUndo(pathToDuplicate, itemToDuplicate.entry.isDir);
                newPaths.push(newPath);
              }
            }
            // Select the newly created duplicates
            if (newPaths.length > 0) {
              props.onSelectPaths(newPaths);
            }
            debouncedRefresh.call();
          } catch (e) {
            console.error("Failed to duplicate:", e);
            alert(`Failed to duplicate: ${e}`);
          }
        }
        break;
    }
  };

  // Paste files from clipboard
  const handlePaste = async (targetDir: string) => {
    const clipboard = clipboardFiles();
    if (!clipboard) return;

    try {
      for (const sourcePath of clipboard.paths) {
        const fileName = getBasename(sourcePath);
        const initialDestPath = joinPath(targetDir, fileName);

        if (clipboard.operation === 'cut') {
          // Move the file with undo support
          // For moves, generate unique path if destination exists
          const destPath = await generateUniquePath(initialDestPath);
          await fileOps.moveWithUndo(sourcePath, destPath);
        } else {
          // Copy the file with undo support (auto-generates unique name if needed)
          await fileOps.copyWithUndo(sourcePath, initialDestPath);
        }
      }

      // Clear clipboard if it was a cut operation
      if (clipboard.operation === 'cut') {
        setClipboardFiles(null);
      }

      // Invalidate cache and refresh
      setDirectoryCache(prev => {
        const next = new Map(prev);
        next.delete(targetDir);
        // Also invalidate source directories for cut
        if (clipboard.operation === 'cut') {
          for (const sourcePath of clipboard.paths) {
            const sourceDir = sourcePath.replace(/\\/g, "/").replace(/\/[^/]+$/, "");
            next.delete(sourceDir);
          }
        }
        return next;
      });
      await loadDirectoryChildren(targetDir);
      debouncedRefresh.call();
    } catch (e) {
      console.error("Failed to paste:", e);
      alert(`Failed to paste: ${e}`);
    }
  };
  
  // Rename handler
  const handleRename = async (oldPath: string, newName: string) => {
    setRenamingPath(null);
    
    const items = flattenedItems();
    const item = items.find(i => i.entry.path === oldPath);
    if (!item || item.entry.name === newName) return;

    const parentPath = oldPath.replace(/[/\\][^/\\]+$/, "");
    const newPath = `${parentPath}/${newName}`.replace(/\\/g, "/");

    try {
      // Use renameWithUndo for undo support
      await fileOps.renameWithUndo(oldPath, newPath);
      // Invalidate cache and refresh
      setDirectoryCache(prev => {
        const next = new Map(prev);
        next.delete(parentPath);
        return next;
      });
      await loadDirectoryChildren(parentPath);
      props.onSelectPaths([newPath]);
    } catch (e) {
      console.error("Failed to rename:", e);
      alert(`Failed to rename: ${e}`);
    }
  };
  
  // Drag and drop handlers
  let autoExpandTimeout: number | null = null;

  const handleDragStart = (e: DragEvent, entry: FileEntry) => {
    const selected = props.selectedPaths;
    const pathsToDrag = selected.includes(entry.path) ? selected : [entry.path];
    
    setDraggedPaths(pathsToDrag);
    
    // Track Ctrl key state for copy vs move
    const isCopy = e.ctrlKey || e.metaKey;
    setIsDragCopy(isCopy);
    
    // Use "all" to allow moving within explorer AND copying/attaching to chat
    // effectAllowed is set based on Ctrl key
    e.dataTransfer!.effectAllowed = isCopy ? "copy" : "all";
    
    // Set both standard text and our JSON format
    const pathsJson = JSON.stringify(pathsToDrag);
    e.dataTransfer!.setData("text/plain", pathsJson);
    e.dataTransfer!.setData("application/x-cortex-paths", pathsJson);
    
    // Add file URLs for OS compatibility
    try {
      const fileUrls = pathsToDrag.map(p => `file://${p.replace(/\\/g, '/')}`).join('\n');
      e.dataTransfer!.setData("text/uri-list", fileUrls);
    } catch (err) {
      console.warn("Failed to set uri-list data:", err);
    }

    // Create VS Code style drag ghost image using JetBrains tokens
    const dragGhost = document.createElement("div");
    dragGhost.style.position = "absolute";
    dragGhost.style.top = "-1000px";
    dragGhost.style.left = "-1000px";
    dragGhost.style.display = "flex";
    dragGhost.style.alignItems = "center";
    dragGhost.style.gap = "6px";
    dragGhost.style.padding = `${tokens.spacing.sm} ${tokens.spacing.md}`;
    dragGhost.style.background = tokens.colors.surface.panel;
    dragGhost.style.color = tokens.colors.text.primary;
    dragGhost.style.border = `1px solid ${tokens.colors.border.default}`;
    dragGhost.style.borderRadius = tokens.radius.sm;
    dragGhost.style.fontSize = "var(--jb-text-muted-size)";
    dragGhost.style.whiteSpace = "nowrap";
    dragGhost.style.boxShadow = "var(--jb-shadow-popup)";
    dragGhost.style.zIndex = "9999";
    dragGhost.id = "drag-ghost-element";

    // Copy indicator (+ sign) when Ctrl is held
    if (isCopy) {
      const copyIndicator = document.createElement("span");
      copyIndicator.innerText = "+";
      copyIndicator.style.fontWeight = "bold";
      copyIndicator.style.color = "var(--jb-icon-color-active)";
      copyIndicator.style.marginRight = "2px";
      dragGhost.appendChild(copyIndicator);
    }

    // Icon
    const icon = document.createElement("img");
    icon.src = getFileIconSvg(entry.name, entry.isDir, false);
    icon.style.width = "16px";
    icon.style.height = "16px";
    dragGhost.appendChild(icon);

    // Name
    const name = document.createElement("span");
    name.innerText = pathsToDrag.length > 1 ? `${pathsToDrag.length} items` : entry.name;
    dragGhost.appendChild(name);

    document.body.appendChild(dragGhost);
    
    // Set drag image (offset slightly so cursor is at the top-left of the box)
    e.dataTransfer!.setDragImage(dragGhost, -10, -10);
    
    // Clean up the ghost element after a tiny delay so the browser can capture it
    setTimeout(() => {
      if (document.body.contains(dragGhost)) {
        document.body.removeChild(dragGhost);
      }
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedPaths([]);
    setDragOverPath(null);
    setIsDragCopy(false);
    if (autoExpandTimeout) clearTimeout(autoExpandTimeout);
  };

  const handleDragOver = (e: DragEvent, entry: FileEntry) => {
    // IMPORTANT: Always prevent default to keep the drag operation alive
    // This prevents the "no-drop" cursor (red circle) from appearing
    e.preventDefault();
    e.stopPropagation();

    const dragged = draggedPaths();
    
    // Update copy state based on current Ctrl key state
    const isCopy = e.ctrlKey || e.metaKey;
    setIsDragCopy(isCopy);
    
    // If no internal drag is happening, still allow the drop (for external files)
    if (dragged.length === 0) {
      e.dataTransfer!.dropEffect = "copy";
      return;
    }

    // Internal move/copy logic
    const isValidInternalTarget = entry.isDir && !dragged.includes(entry.path) && !dragged.some(p => entry.path.startsWith(p + "/"));
    
    if (isValidInternalTarget) {
      // Set dropEffect based on Ctrl key - copy if held, move otherwise
      e.dataTransfer!.dropEffect = isCopy ? "copy" : "move";
      if (dragOverPath() !== entry.path) {
        setDragOverPath(entry.path);
        
        if (autoExpandTimeout) clearTimeout(autoExpandTimeout);
        if (!expandedPaths().has(entry.path)) {
          autoExpandTimeout = window.setTimeout(() => {
            handleToggleExpand(entry.path);
          }, 800);
        }
      }
    } else {
      // Even if not a valid internal folder target, we MUST set a dropEffect
      // to avoid the red circle. "copy" is safe as it indicates external transfer possibility.
      e.dataTransfer!.dropEffect = "copy";
      if (dragOverPath() !== null) setDragOverPath(null);
    }
  };

  // Execute the actual file move/copy operation
  const executeDropOperation = async (sourcePaths: string[], targetDir: string, isCopy: boolean) => {
    try {
      const operationPromises = sourcePaths.map(async (sourcePath) => {
        const name = getBasename(sourcePath);
        const initialPath = joinPath(targetDir, name);
        
        if (sourcePath === initialPath) return; // Same location
        if (targetDir.startsWith(sourcePath + "/")) return; // Cannot move/copy to child

        if (isCopy) {
          // Copy operation with undo support (auto-generates unique name if needed)
          const newPath = await fileOps.copyWithUndo(sourcePath, initialPath);
          return { sourcePath, newPath };
        } else {
          // Move operation with undo support - generate unique path if needed
          const newPath = await generateUniquePath(initialPath);
          await fileOps.moveWithUndo(sourcePath, newPath);
          return { sourcePath, newPath };
        }
      });

      const results = await Promise.all(operationPromises);
      
      // Refresh and update UI
      batch(() => {
        const affectedDirs = new Set<string>([targetDir]);
        // For move operations, also invalidate source directories
        if (!isCopy) {
          results.forEach(r => {
            if (r) {
              const sourceParent = r.sourcePath.replace(/[/\\][^/\\]+$/, "");
              affectedDirs.add(sourceParent);
            }
          });
        }

        setDirectoryCache(prev => {
          const next = new Map(prev);
          affectedDirs.forEach(dir => next.delete(dir));
          return next;
        });
        
        affectedDirs.forEach(dir => loadDirectoryChildren(dir));
      });
      
      const newSelected = results.filter(r => r).map(r => r!.newPath);
      if (newSelected.length > 0) props.onSelectPaths(newSelected);
      
    } catch (e) {
      console.error(`Failed to ${isCopy ? 'copy' : 'move'} files:`, e);
      alert(`Failed to ${isCopy ? 'copy' : 'move'} files: ${e}`);
    }
  };

  // Handle confirmation dialog confirm
  const handleConfirmDrop = async () => {
    const pending = pendingDropOperation();
    if (pending) {
      await executeDropOperation(pending.sourcePaths, pending.targetDir, pending.isCopy);
      setPendingDropOperation(null);
    }
  };

  // Handle confirmation dialog cancel
  const handleCancelDrop = () => {
    setPendingDropOperation(null);
  };

  const handleDrop = async (e: DragEvent, targetEntry: FileEntry) => {
    e.preventDefault();
    const sourcePaths = draggedPaths();
    
    // Check Ctrl key state at drop time for copy vs move
    const isCopy = e.ctrlKey || e.metaKey;
    
    setDraggedPaths([]);
    setDragOverPath(null);
    setIsDragCopy(false);
    if (autoExpandTimeout) clearTimeout(autoExpandTimeout);

    if (sourcePaths.length === 0) return;

    // Determine actual target directory
    const targetDir = targetEntry.isDir ? targetEntry.path : targetEntry.path.replace(/[/\\][^/\\]+$/, "");
    const targetName = targetDir.split(/[/\\]/).pop() || "folder";
    
    // Check if confirmation is required
    if (props.confirmDragAndDrop) {
      // Show confirmation dialog
      setPendingDropOperation({
        sourcePaths: [...sourcePaths],
        targetDir,
        targetName,
        isCopy,
      });
    } else {
      // Execute immediately without confirmation
      await executeDropOperation(sourcePaths, targetDir, isCopy);
    }
  };

  const handleContainerDragOver = (e: DragEvent) => {
    // Always prevent default to avoid "no-drop" cursor
    e.preventDefault();
    
    // Update copy state based on current Ctrl key state
    const isCopy = e.ctrlKey || e.metaKey;
    setIsDragCopy(isCopy);
    
    if (draggedPaths().length > 0) {
      // Set dropEffect based on Ctrl key - copy if held, move otherwise
      e.dataTransfer!.dropEffect = isCopy ? "copy" : "move";
      setDragOverPath(props.rootPath);
    } else {
      // External drag - allow copy
      e.dataTransfer!.dropEffect = "copy";
    }
  };

  const handleContainerDrop = async (e: DragEvent) => {
    if (props.rootPath) {
      await handleDrop(e, { path: props.rootPath, isDir: true, name: "root" } as FileEntry);
    }
  };

  // Check if a path is in the cut clipboard
  const isCutFile = (path: string): boolean => {
    const clipboard = clipboardFiles();
    return clipboard?.operation === 'cut' && clipboard.paths.includes(path);
  };

  // Keyboard handler for cut/copy/paste
  const handleKeyDown = (e: KeyboardEvent) => {
    // Check if we have a selection
    const selected = props.selectedPaths;
    if (selected.length === 0) return;

    // Ctrl+X - Cut
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      e.preventDefault();
      setClipboardFiles({ paths: [...selected], operation: 'cut' });
      return;
    }

    // Ctrl+C - Copy
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      setClipboardFiles({ paths: [...selected], operation: 'copy' });
      return;
    }

    // Ctrl+V - Paste
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      const clipboard = clipboardFiles();
      if (!clipboard) return;

      // Determine target directory - use first selected item's parent or root
      const firstSelected = selected[0];
      const items = flattenedItems();
      const selectedItem = items.find(item => item.entry.path === firstSelected);
      
      if (selectedItem) {
        const targetDir = selectedItem.entry.isDir 
          ? selectedItem.entry.path 
          : (selectedItem.parentPath || props.rootPath);
        handlePaste(targetDir);
      }
      return;
    }

    // Ctrl+D - Duplicate
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      
      const items = flattenedItems();
      const duplicatePromises = selected.map(async (path) => {
        const item = items.find(i => i.entry.path === path);
        if (item) {
          return fileOps.duplicateWithUndo(path, item.entry.isDir);
        }
        return null;
      });
      
      Promise.all(duplicatePromises)
        .then((newPaths) => {
          const validPaths = newPaths.filter((p): p is string => p !== null);
          if (validPaths.length > 0) {
            props.onSelectPaths(validPaths);
          }
          debouncedRefresh.call();
        })
        .catch((err) => {
          console.error("Failed to duplicate:", err);
          alert(`Failed to duplicate: ${err}`);
        });
      return;
    }
  };

  return (
    <div 
      class="virtualized-file-tree" 
      onKeyDown={handleKeyDown} 
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
      onDragLeave={() => setDragOverPath(null)}
      tabIndex={-1}
    >
      <Show when={loading() && !rootEntry()}>
        <SidebarSkeleton />
      </Show>

      <Show when={error()}>
        <div class="file-explorer-error">
          <p>{error()}</p>
          <button onClick={loadRootDirectory} class="file-explorer-retry">
            Retry
          </button>
        </div>
      </Show>

      <Show when={rootEntry() && !error()}>
        <div 
          ref={setContainerRef}
          class="virtual-scroll-container"
          classList={{ 
            "virtual-scroll-container--drag-over": dragOverPath() === props.rootPath,
            "virtual-scroll-container--drag-copy": dragOverPath() === props.rootPath && isDragCopy(),
          }}
          onScroll={handleScroll}
          role="tree"
          aria-label="File tree"
        >
          <div 
            class="virtual-scroll-spacer"
            style={{ height: `${totalHeight()}px` }}
          >
            <div 
              class="virtual-scroll-content"
              style={{ transform: `translateY(${offsetY()}px)` }}
            >
              <For each={visibleItems()}>
                {(item) => {
                  // Get pre-computed git decoration from map (avoids createMemo in loop)
                  const gitDecoration = gitDecorationsMap().get(item.id);

                  // Check if this item is a child of a recently expanded folder
                  const isEntering = item.parentPath !== null && recentlyExpandedPaths().has(item.parentPath);
                  
                  // Pre-compute isSelected to avoid array.includes in VirtualItem
                  const isSelected = selectedPathsSet().has(item.entry.path);

                  return (
                    <VirtualItem
                      item={item}
                      isSelected={isSelected}
                      focusedPath={focusedPath()}
                      renamingPath={renamingPath()}
                      dragOverPath={dragOverPath()}
                      isDragCopy={isDragCopy()}
                      isCut={isCutFile(item.entry.path)}
                      gitDecoration={gitDecoration}
                      indentGuidesEnabled={props.indentGuidesEnabled}
                      enablePreview={props.enablePreview}
                      isEntering={isEntering}
                      onSelect={handleSelect}
                      onOpen={handleOpen}
                      onOpenPreview={handleOpenPreview}
                      onToggleExpand={handleToggleExpand}
                      onToggleNestedExpand={handleToggleNestedExpand}
                      onContextMenu={handleContextMenu}
                      onRename={handleRename}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onFocus={setFocusedPath}
                    />
                  );
                }}
              </For>
              
              {/* Show skeleton loaders for loading directories */}
              <Show when={loadingDirs().size > 0}>
                <SkeletonLoader depth={1} count={3} />
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* JetBrains-style Context Menu */}
      <ContextMenu
        state={{
          visible: contextMenu().visible,
          x: contextMenu().x,
          y: contextMenu().y,
          sections: contextMenu().entry ? (
            contextMenu().entry!.entry.isDir 
              ? ContextMenuPresets.folderItems({
                  hasClipboard: clipboardFiles() !== null,
                  onNewFile: () => handleContextAction("newFile"),
                  onNewFolder: () => handleContextAction("newFolder"),
                  onCut: () => handleContextAction("cut"),
                  onCopy: () => handleContextAction("copy"),
                  onPaste: () => handleContextAction("paste"),
                  onDuplicate: () => handleContextAction("duplicate"),
                  onRename: () => handleContextAction("rename"),
                  onDelete: () => handleContextAction("delete"),
                  onCopyPath: () => handleContextAction("copyPath"),
                  onCopyRelativePath: () => handleContextAction("copyRelativePath"),
                  onReveal: () => handleContextAction("reveal"),
                  onOpenInTerminal: () => {
                    const entry = contextMenu().entry?.entry;
                    if (entry) {
                      window.dispatchEvent(new CustomEvent("terminal:open-at", { detail: { path: entry.path } }));
                    }
                    handleCloseContextMenu();
                  },
                })
              : ContextMenuPresets.fileItems({
                  hasClipboard: clipboardFiles() !== null,
                  onOpen: () => handleContextAction("open"),
                  onOpenDefault: () => handleContextAction("openDefault"),
                  onCut: () => handleContextAction("cut"),
                  onCopy: () => handleContextAction("copy"),
                  onPaste: () => handleContextAction("paste"),
                  onDuplicate: () => handleContextAction("duplicate"),
                  onRename: () => handleContextAction("rename"),
                  onDelete: () => handleContextAction("delete"),
                  onCopyPath: () => handleContextAction("copyPath"),
                  onCopyRelativePath: () => handleContextAction("copyRelativePath"),
                  onReveal: () => handleContextAction("reveal"),
                })
          ) : [],
        }}
        onClose={handleCloseContextMenu}
      />

      {/* Drag Confirmation Dialog */}
      <DragConfirmDialog
        open={pendingDropOperation() !== null}
        operation={pendingDropOperation()?.isCopy ? "copy" : "move"}
        itemCount={pendingDropOperation()?.sourcePaths.length || 0}
        targetName={pendingDropOperation()?.targetName || ""}
        onConfirm={handleConfirmDrop}
        onCancel={handleCancelDrop}
      />

      {/* Large File Warning Dialog */}
      <LargeFileWarningDialog
        open={largeFileWarning() !== null}
        fileName={largeFileWarning()?.fileName || ""}
        fileSizeMB={largeFileWarning()?.fileSizeMB || 0}
        maxSizeMB={props.maxMemoryForLargeFilesMB}
        onConfirm={handleLargeFileConfirm}
        onCancel={handleLargeFileCancel}
      />
    </div>
  );
}

// ============================================================================
// Main FileExplorer Component
// ============================================================================

export function FileExplorer(props: FileExplorerProps) {
  let workspace: ReturnType<typeof useWorkspace> | null = null;
  try {
    workspace = useWorkspace();
  } catch {
    // Workspace context not available
  }

  let settingsContext: ReturnType<typeof useSettings> | null = null;
  try {
    settingsContext = useSettings();
  } catch {
    // Settings context not available
  }

  // Git context for file decorations
  let multiRepo: ReturnType<typeof useMultiRepo> | null = null;
  try {
    multiRepo = useMultiRepo();
  } catch {
    // Git context not available
  }
  
  const compactFolders = createMemo(() => 
    settingsContext?.state.settings.explorer?.compactFolders ?? true
  );

  const fileNestingSettings = createMemo((): FileNestingSettings => 
    settingsContext?.state.settings.explorer?.fileNesting ?? {
      enabled: true,
      patterns: {
        "*.ts": "${basename}.js, ${basename}.d.ts, ${basename}.map, ${basename}.js.map",
        "*.tsx": "${basename}.js, ${basename}.d.ts, ${basename}.map, ${basename}.js.map",
        "package.json": "package-lock.json, yarn.lock, pnpm-lock.yaml, .npmrc, .yarnrc, .yarnrc.yml",
        "tsconfig.json": "tsconfig.*.json",
        ".env": ".env.*, .env.local, .env.development, .env.production, .env.test",
      },
    }
  );

  const confirmDragAndDrop = createMemo(() => 
    settingsContext?.state.settings.files?.confirmDragAndDrop ?? true
  );

  const confirmDelete = createMemo(() => 
    settingsContext?.state.settings.files?.confirmDelete ?? true
  );

  const enableTrash = createMemo(() => 
    settingsContext?.state.settings.files?.enableTrash ?? true
  );

  const maxMemoryForLargeFilesMB = createMemo(() => 
    settingsContext?.state.settings.files?.maxMemoryForLargeFilesMB ?? 4096
  );

  const indentGuidesEnabled = createMemo(() => 
    settingsContext?.state.settings.explorer?.indentGuidesEnabled ?? true
  );

  const sortOrder = createMemo((): ExplorerSortOrder => 
    settingsContext?.state.settings.explorer?.sortOrder ?? "default"
  );

  // VS Code: workbench.editor.enablePreview - single-click opens preview, double-click opens permanent
  const enablePreview = createMemo(() => 
    settingsContext?.state.settings.editor?.enablePreview ?? true
  );

  // Create git status maps from MultiRepoContext
  const gitStatusMap = createMemo(() => {
    const statusMap = new Map<string, GitFileStatus>();
    if (!multiRepo) return statusMap;
    
    const repositories = multiRepo.repositories();
    for (const repo of repositories) {
      // Add staged files
      for (const file of repo.stagedFiles) {
        const normalizedPath = file.path.replace(/\\/g, "/");
        statusMap.set(normalizedPath, file.status);
      }
      // Add unstaged files (these take precedence since they show current state)
      for (const file of repo.unstagedFiles) {
        const normalizedPath = file.path.replace(/\\/g, "/");
        statusMap.set(normalizedPath, file.status);
      }
      // Add conflict files (highest priority)
      for (const file of repo.conflictFiles) {
        const normalizedPath = file.path.replace(/\\/g, "/");
        statusMap.set(normalizedPath, file.status);
      }
    }
    return statusMap;
  });

  // Create folder status map (for folder decorations based on children)
  // OPTIMIZED: Computed asynchronously with debounce to avoid blocking UI on large repos
  const [gitFolderStatusMap, setGitFolderStatusMap] = createSignal<Map<string, { hasConflicts: boolean; hasAdded: boolean; hasModified: boolean }>>(new Map());
  
  // Debounced computation of folder status map
  let folderStatusTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  createEffect(() => {
    const statusMap = gitStatusMap();
    
    // Clear any pending computation
    if (folderStatusTimeoutId) {
      clearTimeout(folderStatusTimeoutId);
    }
    
    // Debounce the computation to avoid blocking on rapid status changes
    folderStatusTimeoutId = setTimeout(() => {
      // Use requestIdleCallback if available to compute during idle time
      const compute = () => {
        const folderMap = new Map<string, { hasConflicts: boolean; hasAdded: boolean; hasModified: boolean }>();
        const propagated = new Set<string>();
        
        for (const [filePath, status] of statusMap) {
          let currentPath = filePath;
          let lastSlash = currentPath.lastIndexOf("/");
          
          while (lastSlash > 0) {
            currentPath = currentPath.slice(0, lastSlash);
            
            const key = `${currentPath}:${status}`;
            if (propagated.has(key)) break;
            propagated.add(key);
            
            let existing = folderMap.get(currentPath);
            if (!existing) {
              existing = { hasConflicts: false, hasAdded: false, hasModified: false };
              folderMap.set(currentPath, existing);
            }
            
            if (status === "conflict") {
              existing.hasConflicts = true;
            } else if (status === "added" || status === "untracked") {
              existing.hasAdded = true;
            } else if (status === "modified" || status === "deleted" || status === "renamed") {
              existing.hasModified = true;
            }
            
            lastSlash = currentPath.lastIndexOf("/");
          }
        }
        
        setGitFolderStatusMap(folderMap);
      };
      
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(compute, { timeout: 100 });
      } else {
        compute();
      }
    }, 50); // 50ms debounce
  });

  const [showHidden, _setShowHidden] = createSignal(false);
  const [filterQuery, setFilterQuery] = createSignal("");
  const [showSearch, setShowSearch] = createSignal(false);
  const [showSortMenu, setShowSortMenu] = createSignal(false);
  const [selectedPaths, setSelectedPaths] = createSignal<string[]>([]);
  const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(new Set());
  const [draggingFolderIndex, setDraggingFolderIndex] = createSignal<number | null>(null);

  let containerRef: HTMLDivElement | undefined;
  let sortMenuRef: HTMLDivElement | undefined;

  // Close sort menu when clicking outside
  createEffect(() => {
    if (showSortMenu()) {
      const handleClickOutside = (e: MouseEvent) => {
        if (sortMenuRef && !sortMenuRef.contains(e.target as Node)) {
          setShowSortMenu(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
    }
  });


  
  const displayFolders = createMemo(() => {
    if (workspace && workspace.folders().length > 0) {
      return workspace.folders();
    }
    if (props.rootPath) {
      return [{
        path: props.rootPath,
        name: extractProjectName(props.rootPath),
      }];
    }
    return [];
  });

  const isFolderExpanded = (path: string) => expandedFolders().has(path);

  const toggleFolderExpanded = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  onMount(() => {
    const folders = displayFolders();
    if (folders.length > 0) {
      setExpandedFolders(new Set(folders.map(f => f.path)));
    }
  });

  createEffect(() => {
    const folders = displayFolders();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const folder of folders) {
        if (!next.has(folder.path)) {
          next.add(folder.path);
        }
      }
      return next;
    });
  });

  const handleFolderDragStart = (e: DragEvent, index: number) => {
    setDraggingFolderIndex(index);
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", String(index));
  };

  const handleFolderDragOver = (e: DragEvent, index: number) => {
    const dragIndex = draggingFolderIndex();
    if (dragIndex !== null && dragIndex !== index) {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
    }
  };

  const handleFolderDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggingFolderIndex();
    if (sourceIndex !== null && sourceIndex !== targetIndex && workspace) {
      workspace.reorderFolders(sourceIndex, targetIndex);
    }
    setDraggingFolderIndex(null);
  };

  const handleFolderDragEnd = () => {
    setDraggingFolderIndex(null);
  };

  const handleOpenFolder = () => {
    window.dispatchEvent(new CustomEvent('folder:open'));
  };

  const handleAddFolder = async () => {
    if (workspace) {
      await workspace.addFolderWithPicker();
    } else {
      await handleOpenFolder();
    }
  };

  const explorerTitle = createMemo(() => {
    const folders = displayFolders();
    if (folders.length === 0) return "Explorer";
    if (folders.length === 1) return folders[0].name;
    return "Project";
  });

  return (
    <div
      ref={containerRef}
      class="file-explorer"
      tabIndex={-1}
      onDragOver={(e) => {
        // Always allow drag over the file explorer to prevent "no-drop" cursor
        e.preventDefault();
        e.dataTransfer!.dropEffect = "copy";
      }}
    >
      {/* Header with title and action buttons - Figma design */}
      <div
        class="file-explorer-header"
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "8px 16px",
          height: "32px",
          "flex-shrink": "0",
          background: "transparent",
          border: "none",
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
          <span
            style={{
              "font-family": "'DM Sans', sans-serif",
              "font-size": "16px",
              "font-weight": "500",
              "line-height": "16px",
              color: "var(--cortex-text-primary)",
            }}
          >
            {explorerTitle()}
          </span>
          <Icon name="chevron-down" size={16} color="var(--cortex-text-muted, var(--cortex-text-inactive))" />
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <button
            onClick={() => setShowSearch(!showSearch())}
            title="Search (Ctrl+Shift+F)"
            style={{
              width: "16px",
              height: "16px",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0",
              color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
            }}
          >
            <Icon name="magnifying-glass" size={16} />
          </button>
          <button
            onClick={handleAddFolder}
            title="New File"
            style={{
              width: "16px",
              height: "16px",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0",
              color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
            }}
          >
            <Icon name="plus" size={16} />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("explorer:refresh"))}
            title="Refresh"
            style={{
              width: "16px",
              height: "16px",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0",
              color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
            }}
          >
            <Icon name="arrows-rotate" size={16} />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("explorer:collapse-all"))}
            title="Collapse All"
            style={{
              width: "16px",
              height: "16px",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0",
              color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
            }}
          >
            <Icon name="chevrons-up" size={16} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <Show when={showSearch()}>
        <div
          style={{
            padding: `${tokens.spacing.sm} ${tokens.spacing.sm} 0 ${tokens.spacing.sm}`,
            "margin-bottom": tokens.spacing.sm,
            background: tokens.colors.surface.panel,
          }}
        >
          <div
            class="file-explorer-search-wrapper"
            style={{
              display: "flex",
              "align-items": "center",
              width: "100%",
              padding: `6px ${tokens.spacing.lg}`,
              background: tokens.colors.surface.canvas,
              border: `1px solid ${tokens.colors.border.default}`,
              "border-radius": tokens.radius.sm,
            }}
          >
            <Icon
              name="magnifying-glass"
              size={14}
              style={{ color: tokens.colors.icon.default, "margin-right": tokens.spacing.md, "flex-shrink": "0" }}
            />
            <input
              type="text"
              placeholder="Filter files..."
              value={filterQuery()}
              onInput={(e) => setFilterQuery(e.currentTarget.value)}
              style={{
                flex: "1",
                padding: "0",
                "font-size": "var(--jb-text-body-size)",
                color: tokens.colors.text.primary,
                background: "transparent",
                border: "none",
                outline: "none",
              }}
              onFocus={(e) => {
                const wrapper = e.currentTarget.parentElement;
                if (wrapper) wrapper.style.borderColor = tokens.colors.semantic.primary;
              }}
              onBlur={(e) => {
                const wrapper = e.currentTarget.parentElement;
                if (wrapper) wrapper.style.borderColor = tokens.colors.border.default;
              }}
              autofocus
            />
            <Show when={filterQuery()}>
              <button
                onClick={() => setFilterQuery("")}
                title="Clear filter"
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  width: "16px",
                  height: "16px",
                  "margin-left": tokens.spacing.sm,
                  "border-radius": "var(--cortex-radius-full)",
                  "font-size": "14px",
                  color: tokens.colors.icon.default,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </Show>
          </div>
        </div>
      </Show>



      {/* Content */}
      <div 
        class="file-explorer-content" 
        role="tree" 
        aria-label="File explorer"
        onDragOver={(e) => {
          // Allow drag over content area to prevent "no-drop" cursor
          e.preventDefault();
          e.dataTransfer!.dropEffect = "copy";
        }}
      >
        {/* Trae-style: No Open Editors section - direct folder view */}
        
        {/* No folder open - Welcome View */}
        <Show when={displayFolders().length === 0}>
          <ExplorerWelcome
            onOpenFolder={handleOpenFolder}
            onCloneRepo={() => {
              const url = prompt("Enter Git repository URL:");
              if (url) {
                window.dispatchEvent(new CustomEvent("git:clone", { detail: { url } }));
              }
            }}
            recentWorkspaces={workspace?.recentWorkspaces().map(r => ({
              name: r.name,
              path: r.path,
              type: r.isWorkspaceFile ? "workspace" : "folder" as const,
            }))}
            onOpenRecent={(path, type) => {
              if (type === "folder") {
                workspace?.addFolder(path);
              } else {
                workspace?.openWorkspaceFile();
              }
            }}
          />
        </Show>

        {/* Multi-root workspace folders */}
        <Show when={displayFolders().length > 0}>
          <For each={displayFolders()}>
            {(folder, index) => (
              <div class="workspace-folder-section">
                <Show when={displayFolders().length > 1}>
                  <WorkspaceFolderHeader
                    folder={folder}
                    isExpanded={isFolderExpanded(folder.path)}
                    isActive={workspace?.activeFolder() === folder.path}
                    folderIndex={index()}
                    totalFolders={displayFolders().length}
                    onToggle={() => toggleFolderExpanded(folder.path)}
                    onRemove={() => workspace?.removeFolder(folder.path)}
                    onSetActive={() => workspace?.setActiveFolder(folder.path)}
                    onRename={(name) => workspace?.setFolderName(folder.path, name)}
                    onSetColor={(color) => workspace?.setFolderColor(folder.path, color)}
                    onDragStart={(e) => handleFolderDragStart(e, index())}
                    onDragOver={(e) => handleFolderDragOver(e, index())}
                    onDrop={(e) => handleFolderDrop(e, index())}
                    onDragEnd={handleFolderDragEnd}
                  />
                </Show>

                {/* Folder Contents - Now using VirtualizedFileTree */}
                <Show when={isFolderExpanded(folder.path) || displayFolders().length === 1}>
                  <div 
                    class="workspace-folder-contents"
                    classList={{ "workspace-folder-contents--indented": displayFolders().length > 1 }}
                    onDragOver={(e) => {
                      // Always allow drag over this container to prevent "no-drop" cursor
                      e.preventDefault();
                      e.dataTransfer!.dropEffect = "copy";
                    }}
                  >
                    <VirtualizedFileTree
                      rootPath={folder.path}
                      onFileSelect={props.onFileSelect}
                      onFilePreview={props.onFilePreview}
                      enablePreview={enablePreview()}
                      selectedPaths={selectedPaths()}
                      onSelectPaths={setSelectedPaths}
                      showHidden={showHidden()}
                      filterQuery={filterQuery()}
                      compactFolders={compactFolders()}
                      fileNestingSettings={fileNestingSettings()}
                      confirmDragAndDrop={confirmDragAndDrop()}
                      indentGuidesEnabled={indentGuidesEnabled()}
                      sortOrder={sortOrder()}
                      gitStatusMap={gitStatusMap()}
                      gitFolderStatusMap={gitFolderStatusMap()}
                      confirmDelete={confirmDelete()}
                      enableTrash={enableTrash()}
                      maxMemoryForLargeFilesMB={maxMemoryForLargeFilesMB()}
                    />
                  </div>
                </Show>
              </div>
            )}
          </For>


        </Show>
      </div>
    </div>
  );
}


/**
 * =============================================================================
 * EDITOR MRU PROVIDER - edt mru prefix
 * =============================================================================
 * 
 * Lists all open editors in Most Recently Used (MRU) order.
 * Shows file name, path, and type-based icon.
 * Accessible via "edt mru " prefix in quick access.
 */

import type { QuickAccessProvider, QuickAccessItem, QuickAccessItemButton } from "./types";
import { Icon } from "../../components/ui/Icon";
import type { OpenFile } from "@/types";
import type { TabHistoryEntry } from "@/context/TabSwitcherContext";
import type { Component, JSX } from "solid-js";
import { getFileIcon } from "@/utils/fileIcons";

/**
 * Editor MRU item data
 */
interface EditorMRUItemData {
  type: "focus" | "close" | "pin" | "unpin";
  fileId: string;
  path: string;
}

/**
 * File icon cache for performance
 */
const iconCache = new Map<string, string>();

/**
 * Get cached file icon path
 */
function getCachedFileIcon(filename: string): string {
  let iconPath = iconCache.get(filename);
  if (!iconPath) {
    iconPath = getFileIcon(filename, false);
    iconCache.set(filename, iconPath);
  }
  return iconPath;
}

/**
 * Create a component that renders a file icon image
 */
function createFileIconComponent(filename: string): Component<{ style?: JSX.CSSProperties }> {
  const iconPath = getCachedFileIcon(filename);
  
  return (props) => {
    // Use the file icon image
    const imgStyle: JSX.CSSProperties = {
      width: "16px",
      height: "16px",
      "object-fit": "contain",
      ...props.style,
    };
    
    return (
      <img 
        src={iconPath} 
        alt="" 
        style={imgStyle}
        onError={(e) => {
          // Fallback to default icon on error
          (e.target as HTMLImageElement).src = "/icons/files/document.svg";
        }}
      />
    );
  };
}

/**
 * Get directory path from full file path
 */
function getDirectoryPath(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (lastSlash === -1) return "";
  return filePath.substring(0, lastSlash);
}

/**
 * Get relative path from workspace root
 */
function getRelativePath(filePath: string, workspaceRoot?: string): string {
  if (!workspaceRoot) return getDirectoryPath(filePath);
  
  const normalizedPath = filePath.replace(/\\/g, "/");
  const normalizedRoot = workspaceRoot.replace(/\\/g, "/");
  
  if (normalizedPath.startsWith(normalizedRoot)) {
    const relative = normalizedPath.substring(normalizedRoot.length);
    return relative.startsWith("/") ? relative.substring(1) : relative;
  }
  
  return getDirectoryPath(filePath);
}

/**
 * Create the Editor MRU Provider
 */
export function createEditorMRUProvider(
  getOpenFiles: () => OpenFile[],
  getMRUHistory: () => TabHistoryEntry[],
  getPinnedTabs: () => string[],
  focusEditor: (fileId: string) => void,
  closeEditor: (fileId: string) => void,
  pinEditor: (fileId: string) => void,
  unpinEditor: (fileId: string) => void,
  getWorkspaceRoot: () => string | undefined,
  hide: () => void
): QuickAccessProvider<EditorMRUItemData> {
  
  return {
    id: "quickaccess.editorMRU",
    prefix: "edt mru ",
    name: "Editor MRU",
    description: "Switch between open editors by most recently used",
    placeholder: "Search open editors...",

    async provideItems(query: string): Promise<QuickAccessItem<EditorMRUItemData>[]> {
      const items: QuickAccessItem<EditorMRUItemData>[] = [];
      const trimmedQuery = query.trim().toLowerCase();
      const openFiles = getOpenFiles();
      const mruHistory = getMRUHistory();
      const pinnedTabs = getPinnedTabs();
      const workspaceRoot = getWorkspaceRoot();

      // Create a map for quick lookup of open files
      const openFilesMap = new Map<string, OpenFile>();
      for (const file of openFiles) {
        openFilesMap.set(file.id, file);
      }

      // Get files in MRU order, but only include files that are still open
      const mruFiles: OpenFile[] = [];
      const addedIds = new Set<string>();

      // First, add files from MRU history that are still open
      for (const entry of mruHistory) {
        const file = openFilesMap.get(entry.fileId);
        if (file && !addedIds.has(file.id)) {
          mruFiles.push(file);
          addedIds.add(file.id);
        }
      }

      // Then, add any open files not in the MRU history (fallback)
      for (const file of openFiles) {
        if (!addedIds.has(file.id)) {
          mruFiles.push(file);
          addedIds.add(file.id);
        }
      }

      // Filter files by query
      const filteredFiles = mruFiles.filter(file => {
        if (!trimmedQuery) return true;
        const name = file.name.toLowerCase();
        const path = file.path.toLowerCase();
        return name.includes(trimmedQuery) || path.includes(trimmedQuery);
      });

      // Separate pinned and unpinned files
      const pinnedFiles = filteredFiles.filter(f => pinnedTabs.includes(f.id));
      const unpinnedFiles = filteredFiles.filter(f => !pinnedTabs.includes(f.id));

      // Add pinned editors section
      if (pinnedFiles.length > 0) {
        items.push({
          id: "separator-pinned",
          label: "Pinned Editors",
          kind: "separator",
        });

        for (const file of pinnedFiles) {
          items.push(createEditorItem(file, true, workspaceRoot, closeEditor, unpinEditor));
        }
      }

      // Add recent editors section
      if (unpinnedFiles.length > 0) {
        if (pinnedFiles.length > 0) {
          items.push({
            id: "separator-recent",
            label: "Recent Editors",
            kind: "separator",
          });
        }

        for (const file of unpinnedFiles) {
          items.push(createEditorItem(file, false, workspaceRoot, closeEditor, pinEditor));
        }
      }

      // If no files found
      if (items.length === 0) {
        items.push({
          id: "no-editors",
          label: "No open editors",
          description: "Open a file to see it here",
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "file", style: props.style }),
          disabled: true,
        });
      }

      return items;
    },

    onSelect(item: QuickAccessItem<EditorMRUItemData>): void {
      if (!item.data) return;
      
      hide();

      switch (item.data.type) {
        case "focus":
          focusEditor(item.data.fileId);
          break;
        case "close":
          closeEditor(item.data.fileId);
          break;
        case "pin":
          pinEditor(item.data.fileId);
          break;
        case "unpin":
          unpinEditor(item.data.fileId);
          break;
      }
    },

    onButtonClick(_item: QuickAccessItem<EditorMRUItemData>, button: QuickAccessItemButton): void {
      button.onClick();
    },
  };
}

/**
 * Create a QuickAccessItem for an open editor file
 */
function createEditorItem(
  file: OpenFile,
  isPinned: boolean,
  workspaceRoot: string | undefined,
  closeEditor: (fileId: string) => void,
  togglePin: (fileId: string) => void
): QuickAccessItem<EditorMRUItemData> {
  const relativePath = getRelativePath(file.path, workspaceRoot);
  const dirPath = getDirectoryPath(relativePath);

  // Create buttons
  const buttons: QuickAccessItemButton[] = [];

  // Pin/Unpin button
  buttons.push({
    icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "thumbtack", style: props.style }),
    tooltip: isPinned ? "Unpin Editor" : "Pin Editor",
    onClick: () => togglePin(file.id),
  });

  // Close button
  buttons.push({
    icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "xmark", style: props.style }),
    tooltip: "Close Editor",
    onClick: () => closeEditor(file.id),
  });

  // Build label with modification indicator
  const label = file.modified ? `${file.name} \u2022` : file.name;

  return {
    id: `editor-${file.id}`,
    label,
    description: isPinned ? "Pinned" : undefined,
    detail: dirPath || file.path,
    icon: createFileIconComponent(file.name),
    buttons,
    data: { 
      type: "focus" as const, 
      fileId: file.id, 
      path: file.path 
    },
  };
}

export default createEditorMRUProvider;

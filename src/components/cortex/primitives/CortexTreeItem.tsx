/**
 * CortexTreeItem - Tree view item component for FileExplorer
 * Matches Cortex UI specs: 16px row height, proper indentation
 */

import { Component, JSX, splitProps, createSignal, Show, For } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface TreeItemData {
  id: string;
  name: string;
  icon?: string;
  type: "file" | "folder";
  children?: TreeItemData[];
  isExpanded?: boolean;
}

export interface CortexTreeItemProps {
  item: TreeItemData;
  level?: number;
  isSelected?: boolean;
  isExpanded?: boolean;
  onSelect?: (item: TreeItemData) => void;
  onToggle?: (item: TreeItemData) => void;
  onContextMenu?: (item: TreeItemData, e: MouseEvent) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

// Cortex UI specs for file icons
const FILE_ICON_MAP: Record<string, string> = {
  // Folders by type
  "folder-default": "folder",
  "folder-open": "folder-open",
  "folder-yarn": "folder",
  "folder-syntax": "folder",
  "folder-sublime": "folder",
  "folder-storybook": "folder",
  "folder-taskfile": "folder",
  "folder-zeabur": "folder",
  "folder-windows": "folder",
  
  // Files by extension
  ".ts": "file-code",
  ".tsx": "file-code",
  ".js": "file-code",
  ".jsx": "file-code",
  ".rs": "file-code",
  ".toml": "file-text",
  ".json": "file-text",
  ".md": "file-text",
  ".yml": "file-text",
  ".yaml": "file-text",
  ".lock": "lock",
  ".dockerfile": "file",
  "dockerfile": "file",
};

const getFileIcon = (name: string, type: "file" | "folder", customIcon?: string): string => {
  if (customIcon) return customIcon;
  
  if (type === "folder") {
    return "folder";
  }
  
  const ext = name.toLowerCase().includes(".")
    ? "." + name.split(".").pop()?.toLowerCase()
    : name.toLowerCase();
  
  return FILE_ICON_MAP[ext] || "file";
};

export const CortexTreeItem: Component<CortexTreeItemProps> = (props) => {
  const [local, others] = splitProps(props, [
    "item",
    "level",
    "isSelected",
    "isExpanded",
    "onSelect",
    "onToggle",
    "onContextMenu",
    "class",
    "style",
  ]);

  const [isHovered, setIsHovered] = createSignal(false);
  const level = () => local.level || 0;
  const hasChildren = () => local.item.type === "folder" && local.item.children && local.item.children.length > 0;

  // Cortex UI specs: 24px per indent level
  const indentPx = () => level() * 24;

  const rowStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    height: "24px", // 16px content + 4px padding top/bottom
    padding: "4px 8px",
    "padding-left": `${8 + indentPx()}px`,
    gap: "4px",
    cursor: "pointer",
    background: local.isSelected
      ? "var(--cortex-accent-muted, rgba(191,255,0,0.1))"
      : isHovered()
      ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))"
      : "transparent",
    transition: "background var(--cortex-transition-fast, 100ms ease)",
    ...local.style,
  });

  const chevronStyle = (): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transform: local.isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
    transition: "transform var(--cortex-transition-fast, 100ms ease)",
    opacity: hasChildren() ? "1" : "0",
    visibility: hasChildren() ? "visible" : "hidden",
  });

  const iconStyle = (): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    "flex-shrink": "0",
    color: local.item.type === "folder"
      ? "var(--cortex-accent-primary, var(--cortex-accent-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
  });

  const textStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    color: local.isSelected
      ? "var(--cortex-text-primary, var(--cortex-text-primary))"
      : "var(--cortex-text-secondary, var(--cortex-text-secondary))",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "line-height": "16px",
  });

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    
    if (local.item.type === "folder") {
      local.onToggle?.(local.item);
    }
    
    local.onSelect?.(local.item);
  };

  const handleChevronClick = (e: MouseEvent) => {
    e.stopPropagation();
    local.onToggle?.(local.item);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    local.onContextMenu?.(local.item, e);
  };

  const icon = () => getFileIcon(
    local.item.name,
    local.item.type,
    local.item.icon
  );

  return (
    <>
      <div
        class={local.class}
        style={rowStyle()}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...others}
      >
        {/* Chevron for folders */}
        <div style={chevronStyle()} onClick={handleChevronClick}>
          <CortexIcon name="chevron-down" size={12} />
        </div>

        {/* File/Folder Icon */}
        <div style={iconStyle()}>
          <CortexIcon
            name={local.isExpanded && local.item.type === "folder" ? "folder-open" : icon()}
            size={16}
          />
        </div>

        {/* Name */}
        <span style={textStyle()}>{local.item.name}</span>
      </div>

      {/* Children (if expanded) */}
      <Show when={local.isExpanded && hasChildren()}>
        <For each={local.item.children}>
          {(child) => (
            <CortexTreeItem
              item={child}
              level={level() + 1}
              isSelected={false}
              isExpanded={child.isExpanded}
              onSelect={local.onSelect}
              onToggle={local.onToggle}
              onContextMenu={local.onContextMenu}
            />
          )}
        </For>
      </Show>
    </>
  );
};

/**
 * IndentGuide - Vertical indent guide lines
 */
export interface IndentGuideProps {
  level: number;
  height: number;
  style?: JSX.CSSProperties;
}

export const IndentGuide: Component<IndentGuideProps> = (props) => {
  const guideStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: `${8 + props.level * 24 + 8}px`, // 8px padding + level indent + 8px to center in chevron
    width: "1px",
    height: `${props.height}px`,
    background: "var(--cortex-border-default, rgba(255,255,255,0.1))",
    "pointer-events": "none",
    ...props.style,
  });

  return <div style={guideStyle()} />;
};

export default CortexTreeItem;



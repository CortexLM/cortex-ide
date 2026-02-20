/**
 * CortexFileExplorer - Pixel-perfect file explorer matching Figma design
 * Dimensions: 317×882px
 * 
 * Structure:
 * - Header: "Project" + dropdown + actions (Q, +, refresh, collapse)
 * - Tree View: 285×616px, 16px row height, 24px step
 * - Footer: 285×28px with Docker indicator + status icons
 */

import { Component, JSX, splitProps, createSignal, For } from "solid-js";
import { CortexIcon, CortexTooltip, CortexTreeItem, TreeItemData } from "./primitives";

export interface CortexFileExplorerProps {
  title?: string;
  items?: TreeItemData[];
  selectedId?: string | null;
  expandedIds?: Set<string>;
  onSelect?: (item: TreeItemData) => void;
  onToggle?: (item: TreeItemData) => void;
  onSearch?: () => void;
  onAdd?: () => void;
  onRefresh?: () => void;
  onCollapseAll?: () => void;
  onContextMenu?: (item: TreeItemData, e: MouseEvent) => void;
  projectType?: string;
  projectName?: string;
  class?: string;
  style?: JSX.CSSProperties;
}

// Sample tree data matching Figma design
const SAMPLE_TREE_DATA: TreeItemData[] = [
  { id: "1", name: "chain-extensions", type: "folder", icon: "folder" },
  { id: "2", name: "chainspecs", type: "folder", icon: "folder" },
  { id: "3", name: "common", type: "folder", icon: "folder" },
  { id: "4", name: "contract-tests", type: "folder", icon: "folder" },
  { id: "5", name: "docs", type: "folder", icon: "folder" },
  {
    id: "6",
    name: "node",
    type: "folder",
    icon: "folder",
    isExpanded: true,
    children: [
      { id: "6-1", name: "src", type: "folder", icon: "folder" },
      { id: "6-2", name: "tests", type: "folder", icon: "folder" },
      { id: "6-3", name: "build.rs", type: "file", icon: "file-code" },
      { id: "6-4", name: "Cargo.toml", type: "file", icon: "file-text" },
    ],
  },
  { id: "7", name: "pallets", type: "folder", icon: "folder" },
  { id: "8", name: "precompiles", type: "folder", icon: "folder" },
  { id: "9", name: "primitives", type: "folder", icon: "folder" },
  { id: "10", name: "runtime", type: "folder", icon: "folder" },
  { id: "11", name: "scripts", type: "folder", icon: "folder" },
  { id: "12", name: "src", type: "folder", icon: "folder" },
  { id: "13", name: "support", type: "folder", icon: "folder" },
  { id: "14", name: "build.rs", type: "file", icon: "file-code" },
  { id: "15", name: "Cargo.lock", type: "file", icon: "lock" },
  { id: "16", name: "Cargo.toml", type: "file", icon: "file-text" },
  { id: "17", name: "CONTRIBUTING.md", type: "file", icon: "file-text" },
  { id: "18", name: "docker-compose.localnet.yml", type: "file", icon: "file-text" },
  { id: "19", name: "docker-compose.yml", type: "file", icon: "file-text" },
  { id: "20", name: "Dockerfile", type: "file", icon: "file" },
  { id: "21", name: "Dockerfile-localnet", type: "file", icon: "file" },
  { id: "22", name: "hyperparameters.md", type: "file", icon: "file-text" },
];

export const CortexFileExplorer: Component<CortexFileExplorerProps> = (props) => {
  const [local, others] = splitProps(props, [
    "title",
    "items",
    "selectedId",
    "expandedIds",
    "onSelect",
    "onToggle",
    "onSearch",
    "onAdd",
    "onRefresh",
    "onCollapseAll",
    "onContextMenu",
    "projectType",
    "projectName",
    "class",
    "style",
  ]);

  const [internalSelectedId, setInternalSelectedId] = createSignal<string | null>(null);
  const [internalExpandedIds, setInternalExpandedIds] = createSignal<Set<string>>(new Set(["6"]));

  const selectedId = () => local.selectedId ?? internalSelectedId();
  const expandedIds = () => local.expandedIds ?? internalExpandedIds();
  const items = () => local.items || SAMPLE_TREE_DATA;

  // Main container - 317×882px
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    width: "317px",
    height: "100%",
    background: "var(--cortex-bg-primary, #141415)",
    border: "1px solid var(--cortex-border-default, #2E2F31)",
    "border-radius": "var(--cortex-panel-radius, 16px)",
    overflow: "hidden",
    "flex-shrink": "0",
    ...local.style,
  });

  // Header - 285×32px (with padding)
  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 16px",
    height: "32px",
    "flex-shrink": "0",
  });

  // Title section
  const titleSectionStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
  });

  const titleTextStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "12px",
    "font-weight": "600",
    color: "var(--cortex-text-secondary, var(--cortex-text-secondary))",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
  });

  // Actions section
  const actionsStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
  });

  // Tree container - scrollable
  const treeContainerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "overflow-y": "auto",
    "overflow-x": "hidden",
    padding: "0 16px",
  });

  // Footer - 285×28px
  const footerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "5.5px 8px",
    height: "28px",
    "border-top": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "flex-shrink": "0",
  });

  // Footer left (project indicator)
  const footerLeftStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
  });

  // Footer right (icons)
  const footerRightStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "12px",
  });

  const footerTextStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "12px",
    "line-height": "17px",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
  });

  const handleSelect = (item: TreeItemData) => {
    if (!local.onSelect) {
      setInternalSelectedId(item.id);
    }
    local.onSelect?.(item);
  };

  const handleToggle = (item: TreeItemData) => {
    if (!local.onToggle) {
      setInternalExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
    }
    local.onToggle?.(item);
  };

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      {/* Header */}
      <header style={headerStyle()}>
        <div style={titleSectionStyle()}>
          <span style={titleTextStyle()}>{local.title || "Project"}</span>
          <CortexIcon name="chevron-down" size={16} color="var(--cortex-text-muted, var(--cortex-text-inactive))" />
        </div>

        <div style={actionsStyle()}>
          <ExplorerActionButton icon="search" label="Search (Ctrl+Shift+F)" onClick={local.onSearch} />
          <ExplorerActionButton icon="plus" label="New File" onClick={local.onAdd} />
          <ExplorerActionButton icon="refresh" label="Refresh" onClick={local.onRefresh} />
          <ExplorerActionButton icon="chevron-up-double" label="Collapse All" onClick={local.onCollapseAll} />
        </div>
      </header>

      {/* Tree View */}
      <div style={treeContainerStyle()}>
        <For each={items()}>
          {(item) => (
            <CortexTreeItem
              item={item}
              level={0}
              isSelected={selectedId() === item.id}
              isExpanded={expandedIds().has(item.id)}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onContextMenu={local.onContextMenu}
            />
          )}
        </For>
      </div>

      {/* Footer */}
      <footer style={footerStyle()}>
        <div style={footerLeftStyle()}>
          <CortexIcon name="container" size={15} color="var(--cortex-text-muted, var(--cortex-text-inactive))" />
          <span style={footerTextStyle()}>
            {local.projectName || `${local.projectType || "Docker"} Project`}
          </span>
        </div>

        <div style={footerRightStyle()}>
          <ExplorerFooterButton icon="layout" label="Toggle Panel" />
          <ExplorerFooterButton icon="terminal" label="Toggle Terminal" />
          <ExplorerFooterButton icon="git" label="Source Control" />
          <ExplorerFooterButton icon="info" label="Info" />
        </div>
      </footer>
    </div>
  );
};

/**
 * ExplorerActionButton - Header action button
 * Size: 16×16px
 */
interface ExplorerActionButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
}

const ExplorerActionButton: Component<ExplorerActionButtonProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const buttonStyle = (): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "0",
    color: isHovered()
      ? "var(--cortex-text-primary, var(--cortex-text-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
  });

  return (
    <CortexTooltip content={props.label} position="bottom">
      <button
        style={buttonStyle()}
        onClick={props.onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={props.label}
      >
        <CortexIcon name={props.icon} size={16} />
      </button>
    </CortexTooltip>
  );
};

/**
 * ExplorerFooterButton - Footer icon button
 * Size: 16×16px
 */
interface ExplorerFooterButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
}

const ExplorerFooterButton: Component<ExplorerFooterButtonProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const buttonStyle = (): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "0",
    color: isHovered()
      ? "var(--cortex-text-primary, var(--cortex-text-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
  });

  return (
    <CortexTooltip content={props.label} position="top">
      <button
        style={buttonStyle()}
        onClick={props.onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={props.label}
      >
        <CortexIcon name={props.icon} size={16} />
      </button>
    </CortexTooltip>
  );
};

export default CortexFileExplorer;



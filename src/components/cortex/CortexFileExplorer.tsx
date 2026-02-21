/**
 * CortexFileExplorer - Pixel-perfect file explorer matching Figma design
 * Figma component: Explorer (590:10817)
 *
 * Container: 320px width, #141415 bg, 16px border-radius, 1px solid #2E2F31
 * Structure: ExplorerHeader (tabs) + ExplorerTreeView (project + tree)
 */

import { Component, JSX, splitProps, createSignal } from "solid-js";
import { TreeItemData } from "./primitives";
import { ExplorerHeader, ExplorerTab } from "./explorer/ExplorerHeader";
import { ExplorerTreeView } from "./explorer/ExplorerTreeView";

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

const SAMPLE_TREE_DATA: TreeItemData[] = [
  { id: "1", name: "chain-extensions", type: "folder", icon: "folder" },
  { id: "2", name: "chainspecs", type: "folder", icon: "folder" },
  { id: "3", name: "common", type: "folder", icon: "folder" },
  { id: "4", name: "contract-tests", type: "folder", icon: "folder" },
  { id: "5", name: "docs", type: "folder", icon: "folder" },
  { id: "5b", name: "app", type: "folder", icon: "folder" },
  {
    id: "6",
    name: "node",
    type: "folder",
    icon: "folder",
    isExpanded: true,
    children: [
      { id: "6-1", name: "src", type: "folder", icon: "folder" },
      {
        id: "6-2",
        name: "components",
        type: "folder",
        icon: "folder",
        children: [
          { id: "6-2-1", name: "SurveyQuestion.tsx", type: "file", icon: "file-code" },
        ],
      },
      { id: "6-3", name: "Cargo.toml", type: "file", icon: "file-text" },
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

  const [activeTab, setActiveTab] = createSignal<ExplorerTab>("explorer");
  const [internalSelectedId, setInternalSelectedId] = createSignal<string | null>(null);
  const [internalExpandedIds, setInternalExpandedIds] = createSignal<Set<string>>(new Set(["6"]));

  const selectedId = () => local.selectedId ?? internalSelectedId();
  const expandedIds = () => local.expandedIds ?? internalExpandedIds();
  const items = () => local.items || SAMPLE_TREE_DATA;

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    width: "320px",
    height: "100%",
    background: "#141415",
    border: "1px solid #2E2F31",
    "border-radius": "16px",
    gap: "8px",
    overflow: "hidden",
    "flex-shrink": "0",
    ...local.style,
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
      <ExplorerHeader activeTab={activeTab()} onTabChange={setActiveTab} />

      <ExplorerTreeView
        title={local.title}
        items={items()}
        selectedId={selectedId()}
        expandedIds={expandedIds()}
        onSelect={handleSelect}
        onToggle={handleToggle}
        onContextMenu={local.onContextMenu}
        onSearch={local.onSearch}
        onAdd={local.onAdd}
        onRefresh={local.onRefresh}
        onCollapseAll={local.onCollapseAll}
      />
    </div>
  );
};

export default CortexFileExplorer;

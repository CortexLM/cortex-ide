/**
 * CallHierarchyPanel Component
 *
 * Displays call hierarchy (incoming/outgoing calls) in a tree view.
 * Integrates with LSP call hierarchy providers.
 */

import { createSignal, For, Show, createEffect, JSX } from "solid-js";
import { CortexIcon, CortexButton } from "@/components/cortex/primitives";
import type * as Monaco from "monaco-editor";
import {
  type CallHierarchyItem,
  type CallHierarchyIncomingCall,
  type CallHierarchyOutgoingCall,
  getCallHierarchyIcon,
  formatCallHierarchyItem,
} from "@/providers/CallHierarchyProvider";

export type CallHierarchyDirection = "incoming" | "outgoing";

interface CallHierarchyNodeData {
  item: CallHierarchyItem;
  fromRanges?: Monaco.IRange[];
  children?: CallHierarchyNodeData[];
  isLoading?: boolean;
  isExpanded?: boolean;
}

export interface CallHierarchyPanelProps {
  rootItem: CallHierarchyItem | null;
  direction: CallHierarchyDirection;
  onDirectionChange: (direction: CallHierarchyDirection) => void;
  onNavigate: (item: CallHierarchyItem) => void;
  onClose: () => void;
  getIncomingCalls: (item: CallHierarchyItem) => Promise<CallHierarchyIncomingCall[]>;
  getOutgoingCalls: (item: CallHierarchyItem) => Promise<CallHierarchyOutgoingCall[]>;
}

interface HierarchyTreeItemProps {
  label: string;
  icon: string;
  depth: number;
  isExpanded: boolean;
  isExpandable: boolean;
  isLoading: boolean;
  onClick: () => void;
  onToggle: () => void;
}

function HierarchyTreeItem(props: HierarchyTreeItemProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const rowStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    height: "24px",
    padding: "4px 8px",
    "padding-left": `${8 + props.depth * 24}px`,
    gap: "4px",
    cursor: "pointer",
    background: isHovered() ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))" : "transparent",
    transition: "background var(--cortex-transition-fast, 100ms ease)",
  });

  const chevronStyle = (): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transform: props.isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
    transition: "transform var(--cortex-transition-fast, 100ms ease)",
    opacity: props.isExpandable ? "1" : "0",
    visibility: props.isExpandable ? "visible" : "hidden",
  });

  const iconStyle = (): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    "flex-shrink": "0",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
  });

  const textStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    color: "var(--cortex-text-secondary, var(--cortex-text-secondary))",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "line-height": "16px",
  });

  const handleChevronClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.onToggle();
  };

  return (
    <div
      style={rowStyle()}
      onClick={props.onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={chevronStyle()} onClick={handleChevronClick}>
        <Show when={props.isLoading} fallback={<CortexIcon name="chevron-down" size={12} />}>
          <CortexIcon name="loading" size={12} />
        </Show>
      </div>
      <div style={iconStyle()}>
        <CortexIcon name={props.icon} size={16} />
      </div>
      <span style={textStyle()}>{props.label}</span>
    </div>
  );
}

export function CallHierarchyPanel(props: CallHierarchyPanelProps) {
  const [rootNode, setRootNode] = createSignal<CallHierarchyNodeData | null>(null);
  const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(new Set());
  const [loadingNodes, setLoadingNodes] = createSignal<Set<string>>(new Set());

  const getNodeKey = (item: CallHierarchyItem): string => {
    return `${item.uri}:${item.range.start.line}:${item.range.start.character}:${item.name}`;
  };

  createEffect(() => {
    const item = props.rootItem;
    if (item) {
      setRootNode({
        item,
        isExpanded: true,
      });
      setExpandedNodes(new Set([getNodeKey(item)]));
      loadChildren(item);
    } else {
      setRootNode(null);
    }
  });

  const loadChildren = async (item: CallHierarchyItem) => {
    const key = getNodeKey(item);
    setLoadingNodes((prev) => new Set([...prev, key]));

    try {
      let children: CallHierarchyNodeData[] = [];

      if (props.direction === "incoming") {
        const calls = await props.getIncomingCalls(item);
        children = calls.map((call) => ({
          item: call.from,
          fromRanges: call.fromRanges.map((r) => ({
            startLineNumber: r.start.line + 1,
            startColumn: r.start.character + 1,
            endLineNumber: r.end.line + 1,
            endColumn: r.end.character + 1,
          })),
        }));
      } else {
        const calls = await props.getOutgoingCalls(item);
        children = calls.map((call) => ({
          item: call.to,
          fromRanges: call.fromRanges.map((r) => ({
            startLineNumber: r.start.line + 1,
            startColumn: r.start.character + 1,
            endLineNumber: r.end.line + 1,
            endColumn: r.end.character + 1,
          })),
        }));
      }

      setRootNode((current) => {
        if (!current) return null;
        return updateNodeChildren(current, key, children);
      });
    } catch (error) {
      console.error("Failed to load call hierarchy:", error);
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const updateNodeChildren = (
    node: CallHierarchyNodeData,
    targetKey: string,
    children: CallHierarchyNodeData[]
  ): CallHierarchyNodeData => {
    const nodeKey = getNodeKey(node.item);
    if (nodeKey === targetKey) {
      return { ...node, children };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map((child) => updateNodeChildren(child, targetKey, children)),
      };
    }
    return node;
  };

  const toggleExpand = async (item: CallHierarchyItem) => {
    const key = getNodeKey(item);
    const expanded = expandedNodes();

    if (expanded.has(key)) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      setExpandedNodes((prev) => new Set([...prev, key]));
      await loadChildren(item);
    }
  };

  const renderNode = (node: CallHierarchyNodeData, depth: number = 0) => {
    const key = getNodeKey(node.item);
    const isExpanded = expandedNodes().has(key);
    const isLoading = loadingNodes().has(key);
    const hasChildren = node.children && node.children.length > 0;
    const iconName = getCallHierarchyIcon(node.item.kind);

    return (
      <div class="call-hierarchy-node">
        <HierarchyTreeItem
          label={formatCallHierarchyItem(node.item)}
          icon={iconName}
          depth={depth}
          isExpanded={isExpanded}
          isExpandable={true}
          isLoading={isLoading}
          onClick={() => props.onNavigate(node.item)}
          onToggle={() => toggleExpand(node.item)}
        />
        <Show when={isExpanded && hasChildren}>
          <div class="call-hierarchy-children">
            <For each={node.children}>{(child) => renderNode(child, depth + 1)}</For>
          </div>
        </Show>
      </div>
    );
  };

  return (
    <div
      class="call-hierarchy-panel"
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: "var(--cortex-bg-secondary)",
        "border-radius": "var(--cortex-radius-sm)",
        overflow: "hidden",
      }}
    >
      <div
        class="call-hierarchy-header"
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          padding: "8px 12px",
          "border-bottom": "1px solid var(--cortex-border)",
          "flex-shrink": 0,
        }}
      >
        <CortexIcon name="symbol-method" size="sm" />
        <span
          style={{
            flex: 1,
            "font-size": "var(--cortex-text-sm)",
            "font-weight": 500,
            color: "var(--cortex-text-primary)",
          }}
        >
          Call Hierarchy
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <CortexButton
            variant={props.direction === "incoming" ? "primary" : "ghost"}
            size="sm"
            onClick={() => props.onDirectionChange("incoming")}
            title="Show Incoming Calls"
          >
            <CortexIcon name="arrow-left" size="sm" />
          </CortexButton>
          <CortexButton
            variant={props.direction === "outgoing" ? "primary" : "ghost"}
            size="sm"
            onClick={() => props.onDirectionChange("outgoing")}
            title="Show Outgoing Calls"
          >
            <CortexIcon name="arrow-right" size="sm" />
          </CortexButton>
        </div>
        <CortexButton variant="ghost" size="sm" onClick={props.onClose} title="Close">
          <CortexIcon name="close" size="sm" />
        </CortexButton>
      </div>

      <div
        class="call-hierarchy-content"
        style={{
          flex: 1,
          overflow: "auto",
          padding: "4px 0",
        }}
      >
        <Show
          when={rootNode()}
          fallback={
            <div
              style={{
                padding: "16px",
                "text-align": "center",
                color: "var(--cortex-text-secondary)",
                "font-size": "var(--cortex-text-sm)",
              }}
            >
              No call hierarchy available
            </div>
          }
        >
          {(node) => renderNode(node())}
        </Show>
      </div>
    </div>
  );
}

export default CallHierarchyPanel;

import { createSignal, createMemo, For, Show, onMount, batch } from "solid-js";
import { Icon } from "../ui/Icon";
import { invoke } from "@tauri-apps/api/core";
import { getProjectPath } from "@/utils/workspace";

const COLUMN_WIDTH = 20;
const ROW_HEIGHT = 36;

const GRAPH_COLORS = [
  "#4ec9b0", "#569cd6", "#c586c0", "#ce9178", "#dcdcaa", "#9cdcfe",
  "#d7ba7d", "#608b4e", "#d16969", "#b5cea8", "#4fc1ff", "#c586c0",
];

interface GraphNodeRef {
  name: string;
  refType: string;
  isHead: boolean;
}

interface GraphCommitData {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: number;
  parents: string[];
  refs: GraphNodeRef[];
  column: number;
  colorIndex: number;
  isMerge: boolean;
}

interface GraphEdge {
  fromHash: string;
  toHash: string;
  fromColumn: number;
  toColumn: number;
  colorIndex: number;
}

interface GraphResult {
  nodes: GraphCommitData[];
  edges: GraphEdge[];
  totalCount: number;
  hasMore: boolean;
  maxColumn: number;
}

export interface GitGraphProps {
  onCommitSelect?: (commit: GraphCommitData) => void;
  maxCount?: number;
  class?: string;
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const tsMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const diffMs = now - tsMs;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getRefBadgeStyle(refType: string, isHead: boolean): { background: string; color: string } {
  if (isHead) {
    return { background: "var(--cortex-info)", color: "white" };
  }
  switch (refType) {
    case "branch":
      return { background: "rgba(63, 185, 80, 0.2)", color: "var(--cortex-success)" };
    case "tag":
      return { background: "rgba(240, 136, 62, 0.2)", color: "var(--cortex-warning)" };
    case "remote":
      return { background: "rgba(136, 87, 219, 0.2)", color: "var(--cortex-info)" };
    default:
      return { background: "var(--surface-active)", color: "var(--text-weak)" };
  }
}

function getRefIcon(refType: string): string | null {
  switch (refType) {
    case "branch":
      return "code-branch";
    case "tag":
      return "tag";
    case "remote":
      return "cloud";
    default:
      return null;
  }
}

export function GitGraph(props: GitGraphProps) {
  const [nodes, setNodes] = createSignal<GraphCommitData[]>([]);
  const [edges, setEdges] = createSignal<GraphEdge[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(false);
  const [totalCount, setTotalCount] = createSignal(0);
  const [maxColumn, setMaxColumn] = createSignal(0);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedHash, setSelectedHash] = createSignal<string | null>(null);

  const effectiveMaxCount = () => props.maxCount ?? 50;

  const fetchGraph = async (skip: number, append: boolean) => {
    const projectPath = getProjectPath();
    if (!projectPath) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await invoke<GraphResult>("git_get_commit_graph", {
        path: projectPath,
        options: { max_count: effectiveMaxCount(), skip, all: true },
      });

      batch(() => {
        if (append) {
          setNodes((prev) => [...prev, ...result.nodes]);
          setEdges((prev) => [...prev, ...result.edges]);
        } else {
          setNodes(result.nodes);
          setEdges(result.edges);
        }
        setTotalCount(result.totalCount);
        setHasMore(result.hasMore);
        setMaxColumn(result.maxColumn);
      });
    } catch (_err) {
      batch(() => {
        if (!append) {
          setNodes([]);
          setEdges([]);
        }
        setHasMore(false);
      });
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const refresh = () => {
    setSelectedHash(null);
    fetchGraph(0, false);
  };

  const loadMore = () => {
    fetchGraph(nodes().length, true);
  };

  onMount(() => {
    fetchGraph(0, false);
  });

  const filteredNodes = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return nodes();

    return nodes().filter(
      (node) =>
        node.message.toLowerCase().includes(query) ||
        node.author.toLowerCase().includes(query) ||
        node.hash.toLowerCase().includes(query) ||
        node.shortHash.toLowerCase().includes(query),
    );
  });

  const nodeIndexMap = createMemo(() => {
    const map = new Map<string, number>();
    const currentNodes = filteredNodes();
    for (let i = 0; i < currentNodes.length; i++) {
      map.set(currentNodes[i].hash, i);
    }
    return map;
  });

  const visibleEdges = createMemo(() => {
    const indexMap = nodeIndexMap();
    return edges().filter(
      (edge) => indexMap.has(edge.fromHash) && indexMap.has(edge.toHash),
    );
  });

  const svgWidth = createMemo(() => Math.max(maxColumn() + 1, 3) * COLUMN_WIDTH);

  const handleCommitClick = (commit: GraphCommitData) => {
    setSelectedHash((prev) => (prev === commit.hash ? null : commit.hash));
    props.onCommitSelect?.(commit);
  };

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
    } catch (_err) {
      /* clipboard may not be available */
    }
  };

  const renderEdgePath = (edge: GraphEdge) => {
    const indexMap = nodeIndexMap();
    const fromRow = indexMap.get(edge.fromHash);
    const toRow = indexMap.get(edge.toHash);
    if (fromRow === undefined || toRow === undefined) return null;

    const x1 = edge.fromColumn * COLUMN_WIDTH + COLUMN_WIDTH / 2;
    const y1 = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
    const x2 = edge.toColumn * COLUMN_WIDTH + COLUMN_WIDTH / 2;
    const y2 = toRow * ROW_HEIGHT + ROW_HEIGHT / 2;
    const color = GRAPH_COLORS[edge.colorIndex % GRAPH_COLORS.length];

    if (x1 === x2) {
      return (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          stroke-width="2"
        />
      );
    }

    const midY = (y1 + y2) / 2;
    const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    return (
      <path d={d} stroke={color} stroke-width="2" fill="none" />
    );
  };

  const renderCommitDot = (node: GraphCommitData, rowIndex: number) => {
    const cx = node.column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
    const cy = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    const color = GRAPH_COLORS[node.colorIndex % GRAPH_COLORS.length];

    if (node.isMerge) {
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r="6"
            fill="var(--background-base)"
            stroke={color}
            stroke-width="2"
          />
          <circle cx={cx} cy={cy} r="3" fill={color} />
        </g>
      );
    }

    return <circle cx={cx} cy={cy} r="5" fill={color} />;
  };

  return (
    <div
      class={`h-full flex flex-col overflow-hidden ${props.class ?? ""}`}
      style={{ background: "var(--background-base)" }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="code-branch" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            Git Graph
          </span>
          <span
            class="text-xs px-1.5 rounded"
            style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
          >
            {totalCount() > 0 ? `${nodes().length} / ${totalCount()}` : nodes().length}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={refresh}
            disabled={loading()}
            title="Refresh"
          >
            <Icon
              name="rotate"
              class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`}
              style={{ color: "var(--text-weak)" }}
            />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div class="px-3 py-2 border-b shrink-0" style={{ "border-color": "var(--border-weak)" }}>
        <div
          class="flex items-center gap-2 px-2 py-1.5 rounded"
          style={{ background: "var(--surface-base)" }}
        >
          <Icon name="magnifying-glass" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
          <input
            type="text"
            placeholder="Filter by message, author, or hash..."
            class="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-base)" }}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <Show when={searchQuery().length > 0}>
            <button
              class="p-0.5 rounded hover:bg-white/10"
              onClick={() => setSearchQuery("")}
            >
              <Icon name="xmark" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
            </button>
          </Show>
        </div>
      </div>

      {/* Loading state */}
      <Show when={loading()}>
        <div class="flex items-center justify-center h-32">
          <span class="text-sm" style={{ color: "var(--text-weak)" }}>Loading graph...</span>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!loading() && filteredNodes().length === 0}>
        <div class="flex items-center justify-center h-32">
          <span class="text-sm" style={{ color: "var(--text-weak)" }}>
            {searchQuery() ? "No matching commits" : "No commits found"}
          </span>
        </div>
      </Show>

      {/* Main graph area */}
      <Show when={!loading() && filteredNodes().length > 0}>
        <div class="flex-1 overflow-auto">
          <div class="flex min-w-max">
            {/* SVG graph column */}
            <svg
              width={svgWidth()}
              height={filteredNodes().length * ROW_HEIGHT}
              class="shrink-0"
              style={{ "min-width": `${svgWidth()}px` }}
            >
              <For each={visibleEdges()}>
                {(edge) => renderEdgePath(edge)}
              </For>
              <For each={filteredNodes()}>
                {(node, i) => renderCommitDot(node, i())}
              </For>
            </svg>

            {/* Commit info rows */}
            <div class="flex-1 min-w-0">
              <For each={filteredNodes()}>
                {(node) => {
                  const isSelected = () => selectedHash() === node.hash;
                  const color = GRAPH_COLORS[node.colorIndex % GRAPH_COLORS.length];

                  return (
                    <div>
                      <div
                        class={`flex items-center gap-2 px-2 cursor-pointer transition-colors ${
                          isSelected() ? "bg-white/10" : "hover:bg-white/5"
                        }`}
                        style={{ height: `${ROW_HEIGHT}px` }}
                        onClick={() => handleCommitClick(node)}
                      >
                        {/* Ref badges */}
                        <div class="flex items-center gap-1 shrink-0">
                          <For each={node.refs}>
                            {(ref) => {
                              const badgeStyle = getRefBadgeStyle(ref.refType, ref.isHead);
                              const iconName = getRefIcon(ref.refType);
                              return (
                                <span
                                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                                  style={badgeStyle}
                                >
                                  <Show when={iconName}>
                                    {(name) => <Icon name={name()} class="w-3 h-3" />}
                                  </Show>
                                  {ref.name}
                                </span>
                              );
                            }}
                          </For>
                        </div>

                        {/* Message */}
                        <span
                          class="flex-1 text-sm truncate"
                          style={{ color: "var(--text-base)" }}
                        >
                          {node.message.split("\n")[0]}
                        </span>

                        {/* Short hash */}
                        <span
                          class="text-xs font-mono shrink-0"
                          style={{ color: color }}
                        >
                          {node.shortHash}
                        </span>

                        {/* Author */}
                        <span
                          class="text-xs shrink-0 max-w-24 truncate"
                          style={{ color: "var(--text-weak)" }}
                        >
                          {node.author}
                        </span>

                        {/* Date */}
                        <span
                          class="text-xs shrink-0 w-16 text-right"
                          style={{ color: "var(--text-weak)" }}
                        >
                          {formatRelativeDate(node.date)}
                        </span>
                      </div>

                      {/* Selected commit detail panel */}
                      <Show when={isSelected()}>
                        <div
                          class="mx-2 mb-1 p-3 rounded"
                          style={{ background: "var(--surface-base)", border: "1px solid var(--border-weak)" }}
                        >
                          <div class="space-y-2">
                            <div class="flex items-start gap-2">
                              <Icon name="user" class="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--text-weak)" }} />
                              <div>
                                <div class="text-sm" style={{ color: "var(--text-base)" }}>
                                  {node.author}
                                </div>
                                <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                                  {node.authorEmail}
                                </div>
                              </div>
                            </div>

                            <div class="flex items-center gap-2">
                              <Icon name="clock" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                              <span class="text-sm" style={{ color: "var(--text-base)" }}>
                                {new Date(node.date < 1e12 ? node.date * 1000 : node.date).toLocaleString()}
                              </span>
                            </div>

                            <div class="flex items-center gap-2">
                              <Icon name="code-commit" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                              <span class="text-sm font-mono" style={{ color: "var(--text-base)" }}>
                                {node.hash}
                              </span>
                              <button
                                class="p-1 rounded hover:bg-white/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyHash(node.hash);
                                }}
                                title="Copy full hash"
                              >
                                <Icon name="copy" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
                              </button>
                            </div>

                            <Show when={node.parents.length > 0}>
                              <div class="flex items-center gap-2">
                                <Icon name="code-merge" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                                <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                                  Parents: {node.parents.map((p) => p.slice(0, 7)).join(", ")}
                                </span>
                              </div>
                            </Show>

                            <div
                              class="mt-2 pt-2 border-t"
                              style={{ "border-color": "var(--border-weak)" }}
                            >
                              <pre
                                class="text-sm whitespace-pre-wrap"
                                style={{ color: "var(--text-base)" }}
                              >
                                {node.message}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>

              {/* Load More */}
              <Show when={hasMore() && !searchQuery()}>
                <div class="flex items-center justify-center py-3">
                  <button
                    class="px-4 py-1.5 text-sm rounded transition-colors hover:bg-white/10"
                    style={{
                      color: "var(--text-base)",
                      border: "1px solid var(--border-weak)",
                    }}
                    onClick={loadMore}
                    disabled={loadingMore()}
                  >
                    {loadingMore() ? "Loading..." : "Load More"}
                  </button>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default GitGraph;

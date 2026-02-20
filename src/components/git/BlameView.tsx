import { createSignal, createEffect, For, Show } from "solid-js";
import { Icon } from "../ui/Icon";
import { gitBlame, gitBlameWithHeatmap } from "@/utils/tauri-api";
import type { BlameHeatmapEntry } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";

interface BlameLine {
  lineNumber: number;
  content: string;
  commit: {
    hash: string;
    shortHash: string;
    author: string;
    email: string;
    date: string;
    message: string;
    timestamp: number;
    heatScore?: number;
  };
}

interface TooltipInfo {
  x: number;
  y: number;
  commit: BlameLine["commit"];
}

interface BlameViewProps {
  filePath: string;
  onNavigateToCommit?: (hash: string) => void;
}

export function BlameView(props: BlameViewProps) {
  const [blameData, setBlameData] = createSignal<BlameLine[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [hoveredCommit, setHoveredCommit] = createSignal<string | null>(null);
  const [selectedCommit, setSelectedCommit] = createSignal<string | null>(null);
  const [copiedHash, setCopiedHash] = createSignal<string | null>(null);
  const [blameEnabled, setBlameEnabled] = createSignal(true);
  const [useHeatmap, setUseHeatmap] = createSignal(true);
  const [tooltipInfo, setTooltipInfo] = createSignal<TooltipInfo | null>(null);

  const fetchBlame = async (file: string) => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();

      if (useHeatmap()) {
        const entries: BlameHeatmapEntry[] = await gitBlameWithHeatmap(projectPath, file);
        const lines: BlameLine[] = entries.map((entry) => ({
          lineNumber: entry.lineStart,
          content: entry.content,
          commit: {
            hash: entry.hash,
            shortHash: entry.hash.substring(0, 7),
            author: entry.author,
            email: entry.authorEmail,
            date: entry.date,
            message: entry.message,
            timestamp: entry.timestamp,
            heatScore: entry.heatScore,
          },
        }));
        setBlameData(lines);
      } else {
        const entries = await gitBlame(projectPath, file);
        const lines: BlameLine[] = entries.map((entry) => ({
          lineNumber: entry.lineStart,
          content: entry.content,
          commit: {
            hash: entry.hash,
            shortHash: entry.hash.substring(0, 7),
            author: entry.author,
            email: entry.authorEmail,
            date: entry.date,
            message: entry.message,
            timestamp: entry.timestamp,
          },
        }));
        setBlameData(lines);
      }
    } catch (err) {
      console.error("Failed to fetch blame:", err);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    void useHeatmap();
    const filePath = props.filePath;
    if (filePath) {
      fetchBlame(filePath);
    }
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getHeatColor = (timestamp: number, heatScore?: number) => {
    if (heatScore !== undefined) {
      if (heatScore > 0.75) return "var(--cortex-success)";
      if (heatScore > 0.5) return "var(--cortex-info)";
      if (heatScore > 0.25) return "var(--cortex-warning)";
      return "var(--cortex-error)";
    }
    if (timestamp <= 0) return "var(--border-weak)";
    const now = Date.now() / 1000;
    const age = now - timestamp;
    const maxAge = 365 * 24 * 60 * 60;
    const ratio = Math.min(age / maxAge, 1);
    if (ratio < 0.25) return "var(--cortex-success)";
    if (ratio < 0.5) return "var(--cortex-info)";
    if (ratio < 0.75) return "var(--cortex-warning)";
    return "var(--cortex-error)";
  };

  const copyCommitHash = async (hash: string, e: MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch {
      console.debug("Failed to copy commit hash");
    }
  };

  const navigateToCommit = (hash: string, e: MouseEvent) => {
    e.stopPropagation();
    props.onNavigateToCommit?.(hash);
  };

  const handleLineMouseEnter = (e: MouseEvent, commit: BlameLine["commit"]) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipInfo({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      commit,
    });
  };

  const handleLineMouseLeave = () => {
    setTooltipInfo(null);
  };

  return (
    <div 
      class="h-full flex flex-col overflow-hidden font-mono text-sm"
      style={{ background: "var(--background-base)" }}
    >
      {/* Toolbar */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="code-branch" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            Git Blame
          </span>
          <span class="text-xs truncate max-w-[200px]" style={{ color: "var(--text-weak)" }}>
            {props.filePath}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => setUseHeatmap(!useHeatmap())}
            title={useHeatmap() ? "Disable heatmap mode" : "Enable heatmap mode"}
          >
            <Icon
              name="fire"
              class="w-4 h-4"
              style={{ color: useHeatmap() ? "var(--cortex-warning)" : "var(--text-weak)" }}
            />
          </button>
          <button
            class="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => fetchBlame(props.filePath)}
            disabled={loading()}
            title="Refresh blame"
          >
            <Icon
              name="rotate"
              class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`}
              style={{ color: "var(--text-weak)" }}
            />
          </button>
          <button
            class="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => setBlameEnabled(!blameEnabled())}
            title={blameEnabled() ? "Disable blame view" : "Enable blame view"}
          >
            <Icon
              name={blameEnabled() ? "eye" : "eye-slash"}
              class="w-4 h-4"
              style={{ color: "var(--text-weak)" }}
            />
          </button>
        </div>
      </div>

      <Show
        when={blameEnabled()}
        fallback={
          <div class="flex items-center justify-center h-full">
            <span style={{ color: "var(--text-weak)" }}>Blame view disabled</span>
          </div>
        }
      >
        <Show when={loading()}>
          <div class="flex items-center justify-center h-full">
            <span style={{ color: "var(--text-weak)" }}>Loading blame...</span>
          </div>
        </Show>

        <Show when={!loading() && blameData().length > 0}>
          <div class="flex-1 overflow-auto relative">
            <table class="w-full border-collapse">
              <tbody>
                <For each={blameData()}>
                  {(line, index) => {
                    const isFirstInGroup = index() === 0 || 
                      blameData()[index() - 1].commit.hash !== line.commit.hash;
                    const isHovered = hoveredCommit() === line.commit.hash;
                    const isSelected = selectedCommit() === line.commit.hash;
                    
                    return (
                      <tr 
                        class="group"
                        style={{
                          background: isHovered || isSelected 
                            ? "rgba(255, 255, 255, 0.05)" 
                            : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          setHoveredCommit(line.commit.hash);
                          if (isFirstInGroup) handleLineMouseEnter(e, line.commit);
                        }}
                        onMouseLeave={() => {
                          setHoveredCommit(null);
                          handleLineMouseLeave();
                        }}
                        onClick={() => setSelectedCommit(
                          selectedCommit() === line.commit.hash ? null : line.commit.hash
                        )}
                      >
                        {/* Blame info */}
                        <td 
                          class="w-[200px] px-2 py-0 border-r align-top whitespace-nowrap overflow-hidden"
                          style={{ 
                            "border-color": "var(--border-weak)",
                            "border-left": `3px solid ${getHeatColor(line.commit.timestamp, line.commit.heatScore)}`,
                          }}
                        >
                          <Show when={isFirstInGroup}>
                            <div class="py-1">
                              <div 
                                class="text-xs truncate"
                                style={{ color: "var(--text-base)" }}
                              >
                                {line.commit.author}
                              </div>
                              <div 
                                class="text-xs flex items-center gap-1"
                                style={{ color: "var(--text-weak)" }}
                              >
                                <button
                                  class="hover:underline cursor-pointer"
                                  style={{ color: "var(--text-weak)" }}
                                  onClick={(e) => copyCommitHash(line.commit.hash, e)}
                                  title="Copy commit hash"
                                >
                                  {copiedHash() === line.commit.hash ? "✓" : line.commit.shortHash}
                                </button>
                                <span>·</span>
                                <span>{formatDate(line.commit.date)}</span>
                              </div>
                              <Show when={line.commit.message}>
                                <div
                                  class="text-xs truncate mt-0.5"
                                  style={{ color: "var(--text-weaker)" }}
                                  title={line.commit.message}
                                >
                                  {line.commit.message}
                                </div>
                              </Show>
                            </div>
                          </Show>
                        </td>

                        {/* Line number */}
                        <td 
                          class="w-12 px-2 py-0 text-right select-none"
                          style={{ color: "var(--text-weaker)" }}
                        >
                          {line.lineNumber}
                        </td>

                        {/* Code */}
                        <td class="px-3 py-0">
                          <pre 
                            class="py-0"
                            style={{ color: "var(--text-base)" }}
                          >
                            {line.content}
                          </pre>
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>

            {/* Tooltip */}
            <Show when={tooltipInfo()}>
              {(info) => (
                <div
                  class="fixed z-50 px-3 py-2 rounded shadow-lg text-xs max-w-xs pointer-events-none"
                  style={{
                    left: `${info().x}px`,
                    top: `${info().y}px`,
                    transform: "translate(-50%, -100%)",
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--border-weak)",
                  }}
                >
                  <div class="font-medium" style={{ color: "var(--text-base)" }}>
                    {info().commit.author}
                  </div>
                  <div style={{ color: "var(--text-weak)" }}>
                    {info().commit.email}
                  </div>
                  <div class="mt-1" style={{ color: "var(--text-base)" }}>
                    {info().commit.message}
                  </div>
                  <div class="mt-1 font-mono" style={{ color: "var(--text-weak)" }}>
                    {info().commit.shortHash} · {formatDate(info().commit.date)}
                  </div>
                  <Show when={info().commit.heatScore !== undefined}>
                    <div class="mt-1 flex items-center gap-1">
                      <span style={{ color: "var(--text-weak)" }}>Heat:</span>
                      <span style={{ color: getHeatColor(0, info().commit.heatScore) }}>
                        {Math.round((info().commit.heatScore ?? 0) * 100)}%
                      </span>
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </div>

          {/* Commit details panel */}
          <Show when={selectedCommit()}>
            {(() => {
              const commit = blameData().find(l => l.commit.hash === selectedCommit())?.commit;
              if (!commit) return null;
              
              return (
                <div 
                  class="shrink-0 p-3 border-t"
                  style={{ 
                    "border-color": "var(--border-weak)",
                    background: "var(--surface-base)",
                  }}
                >
                  <div class="flex items-start gap-3">
                    <div 
                      class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: getHeatColor(commit.timestamp, commit.heatScore) }}
                    >
                      <Icon name="user" class="w-5 h-5 text-white" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-medium" style={{ color: "var(--text-base)" }}>
                          {commit.author}
                        </span>
                        <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                          {commit.email}
                        </span>
                      </div>
                      <p class="text-sm mt-1" style={{ color: "var(--text-base)" }}>
                        {commit.message}
                      </p>
                      <div class="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-weak)" }}>
                        <button
                          class="flex items-center gap-1 hover:underline cursor-pointer"
                          onClick={(e) => copyCommitHash(commit.hash, e)}
                          title="Copy full commit hash"
                        >
                          <Icon name="code-commit" class="w-3.5 h-3.5" />
                          {copiedHash() === commit.hash ? "Copied!" : commit.hash.slice(0, 12)}
                        </button>
                        <span class="flex items-center gap-1">
                          <Icon name="clock" class="w-3.5 h-3.5" />
                          {new Date(commit.date).toLocaleDateString()}
                        </span>
                        <Show when={props.onNavigateToCommit}>
                          <button
                            class="flex items-center gap-1 hover:underline cursor-pointer"
                            style={{ color: "var(--cortex-info)" }}
                            onClick={(e) => navigateToCommit(commit.hash, e)}
                            title="Navigate to commit"
                          >
                            <Icon name="external-link" class="w-3.5 h-3.5" />
                            View commit
                          </button>
                        </Show>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Show>
        </Show>

        <Show when={!loading() && blameData().length === 0}>
          <div class="flex items-center justify-center h-full">
            <span style={{ color: "var(--text-weak)" }}>No blame data available</span>
          </div>
        </Show>
      </Show>
    </div>
  );
}

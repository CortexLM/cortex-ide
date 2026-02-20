import { Component, For, Show } from "solid-js";
import { usePullRequests, type PullRequestState, type PullRequest } from "@/context/PullRequestContext";

interface PullRequestListProps {
  onSelectPR?: () => void;
}

const stateColors: Record<PullRequestState, string> = {
  open: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-red-500/20 text-red-400 border-red-500/30",
  merged: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const stateLabels: Record<PullRequestState, string> = {
  open: "Open",
  closed: "Closed",
  merged: "Merged",
};

type FilterValue = PullRequestState | "all";

const filters: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "merged", label: "Merged" },
];

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    return `${Math.floor(diffMonths / 12)}y ago`;
  } catch {
    return dateStr;
  }
};

export const PullRequestList: Component<PullRequestListProps> = (props) => {
  const pr = usePullRequests();

  const handleSelectPR = (item: PullRequest) => {
    pr.selectPR(item);
    props.onSelectPR?.();
  };

  return (
    <div class="flex flex-col h-full">
      {/* Filter Bar */}
      <div class="flex gap-1 px-3 py-2 border-b border-white/10">
        <For each={filters}>
          {(filter) => (
            <button
              class={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                pr.state.filterState === filter.value
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
              onClick={() => pr.setFilterState(filter.value)}
            >
              {filter.label}
            </button>
          )}
        </For>
        <div class="flex-1" />
        <button
          class="p-1 rounded hover:bg-white/10 text-white/50 transition-colors"
          onClick={() => void pr.fetchPRs()}
          title="Refresh"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.5 2a.5.5 0 0 0-.5.5V5a5 5 0 1 0-1.07 5.5.5.5 0 0 0-.76-.65A4 4 0 1 1 12 5.5H9.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5z" />
          </svg>
        </button>
      </div>

      {/* Loading Skeleton */}
      <Show when={pr.state.isLoading && pr.state.pullRequests.length === 0}>
        <div class="flex flex-col gap-2 p-3">
          <For each={[1, 2, 3]}>
            {() => (
              <div class="bg-white/5 rounded-lg p-3 animate-pulse">
                <div class="h-3 bg-white/10 rounded w-3/4 mb-2" />
                <div class="h-2.5 bg-white/5 rounded w-1/2" />
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* PR List */}
      <Show when={!pr.state.isLoading || pr.state.pullRequests.length > 0}>
        <div class="flex-1 overflow-auto">
          <Show
            when={pr.filteredPRs().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center py-12 text-white/30 text-xs">
                <svg class="w-8 h-8 mb-2" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M7.177 3.073L9.573.677A.25.25 0 0 1 10 .854v4.792a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354zM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25zM11 2.5h-1V4h1a1 1 0 0 1 1 1v5.628a2.251 2.251 0 1 0 1.5 0V5A2.5 2.5 0 0 0 11 2.5zm1 10.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0zM3.75 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z" />
                </svg>
                <span>No pull requests found</span>
              </div>
            }
          >
            <For each={pr.filteredPRs()}>
              {(item) => (
                <button
                  class="w-full text-left px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors"
                  onClick={() => handleSelectPR(item)}
                >
                  <div class="flex items-start gap-2">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-white/40 text-xs">#{item.number}</span>
                        <Show when={item.draft}>
                          <span class="text-xs text-white/30 italic">Draft</span>
                        </Show>
                      </div>
                      <div class="text-sm text-white/90 truncate">{item.title}</div>
                      <div class="flex items-center gap-2 mt-1.5">
                        <div class="flex items-center gap-1">
                          <img
                            src={item.user.avatar_url}
                            alt={item.user.login}
                            class="w-4 h-4 rounded-full"
                          />
                          <span class="text-xs text-white/40">{item.user.login}</span>
                        </div>
                        <span class="text-xs text-white/20">·</span>
                        <span class="text-xs text-white/30">{formatDate(item.created_at)}</span>
                      </div>
                      <Show when={item.labels.length > 0}>
                        <div class="flex flex-wrap gap-1 mt-1.5">
                          <For each={item.labels}>
                            {(label) => (
                              <span
                                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border"
                                style={{
                                  "background-color": `#${label.color}20`,
                                  "border-color": `#${label.color}40`,
                                  color: `#${label.color}`,
                                }}
                              >
                                {label.name}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                    <span
                      class={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border flex-shrink-0 ${stateColors[item.state]}`}
                    >
                      {stateLabels[item.state]}
                    </span>
                  </div>
                </button>
              )}
            </For>
          </Show>
        </div>
      </Show>

      {/* Error */}
      <Show when={pr.state.error}>
        <div class="mx-3 mb-3 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          {pr.state.error}
        </div>
      </Show>
    </div>
  );
};

export default PullRequestList;

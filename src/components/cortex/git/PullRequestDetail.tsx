import { Component, createSignal, For, Show } from "solid-js";
import {
  usePullRequests,
  type MergeMethod,
  type PullRequestState,
  type ReviewState,
} from "@/context/PullRequestContext";
import { CIStatusBadge } from "@/components/cortex/git/CIStatusBadge";

interface PullRequestDetailProps {
  onBack?: () => void;
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

const reviewStateLabels: Record<ReviewState, string> = {
  approved: "Approved",
  changes_requested: "Changes Requested",
  commented: "Commented",
  pending: "Pending",
  dismissed: "Dismissed",
};

const reviewStateColors: Record<ReviewState, string> = {
  approved: "text-green-400",
  changes_requested: "text-red-400",
  commented: "text-white/60",
  pending: "text-yellow-400",
  dismissed: "text-gray-400",
};

const mergeOptions: { value: MergeMethod; label: string }[] = [
  { value: "merge", label: "Merge Commit" },
  { value: "squash", label: "Squash & Merge" },
  { value: "rebase", label: "Rebase & Merge" },
];

export const PullRequestDetail: Component<PullRequestDetailProps> = (props) => {
  const pr = usePullRequests();
  const [mergeMethod, setMergeMethod] = createSignal<MergeMethod>("merge");
  const [isMerging, setIsMerging] = createSignal(false);

  const selectedPR = () => pr.state.selectedPR;

  const handleMerge = async () => {
    const current = selectedPR();
    if (!current) return;
    setIsMerging(true);
    try {
      await pr.mergePR(current.number, mergeMethod());
    } catch {
      // Error is set in context state
    } finally {
      setIsMerging(false);
    }
  };

  const handleOpenInBrowser = () => {
    const current = selectedPR();
    if (current?.html_url) {
      window.open(current.html_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div class="flex flex-col h-full">
      <Show
        when={selectedPR()}
        fallback={
          <div class="flex flex-col items-center justify-center flex-1 text-white/30 text-xs py-12">
            <span>Select a pull request to view details</span>
          </div>
        }
      >
        {(current) => (
          <div class="flex-1 overflow-auto">
            {/* Back Button & Header */}
            <div class="px-4 py-3 border-b border-white/10">
              <button
                class="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 mb-2 transition-colors"
                onClick={() => props.onBack?.()}
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z" />
                </svg>
                Back to list
              </button>
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <h2 class="text-base font-medium text-white leading-snug">{current().title}</h2>
                  <div class="flex items-center gap-2 mt-1.5">
                    <span class="text-xs text-white/40">#{current().number}</span>
                    <span
                      class={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${stateColors[current().state]}`}
                    >
                      {stateLabels[current().state]}
                    </span>
                    <Show when={current().draft}>
                      <span class="text-[10px] text-white/30 italic">Draft</span>
                    </Show>
                  </div>
                </div>
                <button
                  class="p-1.5 rounded hover:bg-white/10 text-white/50 transition-colors flex-shrink-0"
                  onClick={handleOpenInBrowser}
                  title="Open in browser"
                >
                  <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" />
                    <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Branch Info */}
            <div class="px-4 py-2.5 border-b border-white/10 flex items-center gap-2 text-xs">
              <span class="bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded font-mono text-[11px]">
                {current().head.ref}
              </span>
              <svg class="w-3.5 h-3.5 text-white/30" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8z" />
              </svg>
              <span class="bg-white/10 text-white/60 px-2 py-0.5 rounded font-mono text-[11px]">
                {current().base.ref}
              </span>
            </div>

            {/* Stats */}
            <div class="px-4 py-2.5 border-b border-white/10 flex items-center gap-4 text-xs">
              <Show when={current().additions != null}>
                <span class="text-green-400">+{current().additions}</span>
              </Show>
              <Show when={current().deletions != null}>
                <span class="text-red-400">-{current().deletions}</span>
              </Show>
              <Show when={current().changed_files != null}>
                <span class="text-white/40">{current().changed_files} files</span>
              </Show>
              <Show when={current().commits != null}>
                <span class="text-white/40">{current().commits} commits</span>
              </Show>
            </div>

            {/* Description */}
            <Show when={current().body}>
              <div class="px-4 py-3 border-b border-white/10">
                <div class="text-xs text-white/50 uppercase tracking-wide mb-1.5">Description</div>
                <div class="text-sm text-white/70 whitespace-pre-wrap break-words leading-relaxed">
                  {current().body}
                </div>
              </div>
            </Show>

            {/* Labels */}
            <Show when={current().labels.length > 0}>
              <div class="px-4 py-2.5 border-b border-white/10">
                <div class="text-xs text-white/50 uppercase tracking-wide mb-1.5">Labels</div>
                <div class="flex flex-wrap gap-1.5">
                  <For each={current().labels}>
                    {(label) => (
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs border"
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
              </div>
            </Show>

            {/* Reviews */}
            <Show when={pr.state.reviews.length > 0}>
              <div class="px-4 py-2.5 border-b border-white/10">
                <div class="text-xs text-white/50 uppercase tracking-wide mb-1.5">Reviews</div>
                <div class="flex flex-col gap-2">
                  <For each={pr.state.reviews}>
                    {(review) => (
                      <div class="flex items-center gap-2">
                        <img
                          src={review.user.avatar_url}
                          alt={review.user.login}
                          class="w-5 h-5 rounded-full"
                        />
                        <span class="text-xs text-white/70">{review.user.login}</span>
                        <span class={`text-xs font-medium ${reviewStateColors[review.state]}`}>
                          {reviewStateLabels[review.state]}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* CI Checks */}
            <Show when={pr.state.checks.length > 0}>
              <div class="px-4 py-2.5 border-b border-white/10">
                <div class="text-xs text-white/50 uppercase tracking-wide mb-1.5">CI Checks</div>
                <div class="flex flex-col gap-0.5">
                  <For each={pr.state.checks}>
                    {(check) => (
                      <CIStatusBadge
                        status={check.status}
                        conclusion={check.conclusion}
                        name={check.name}
                        url={check.html_url}
                      />
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Merge Section */}
            <Show when={current().state === "open"}>
              <div class="px-4 py-3 border-b border-white/10">
                <div class="text-xs text-white/50 uppercase tracking-wide mb-2">Merge</div>
                <div class="flex gap-2">
                  <select
                    value={mergeMethod()}
                    onChange={(e) => setMergeMethod(e.currentTarget.value as MergeMethod)}
                    class="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-white/30"
                  >
                    <For each={mergeOptions}>
                      {(opt) => <option value={opt.value}>{opt.label}</option>}
                    </For>
                  </select>
                  <button
                    onClick={handleMerge}
                    disabled={isMerging() || pr.state.isLoading || current().mergeable === false}
                    class="px-4 py-1.5 rounded text-xs font-medium bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isMerging() ? "Merging..." : "Merge PR"}
                  </button>
                </div>
                <Show when={current().mergeable === false}>
                  <p class="mt-1.5 text-xs text-yellow-400">This PR has merge conflicts</p>
                </Show>
              </div>
            </Show>

            {/* Error */}
            <Show when={pr.state.error}>
              <div class="mx-4 my-3 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {pr.state.error}
              </div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
};

export default PullRequestDetail;

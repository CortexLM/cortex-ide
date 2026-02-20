import { createSignal, createEffect, For, Show } from "solid-js";
import { Icon } from "../ui/Icon";
import { gitCompare, GitCompareResult } from "../../utils/tauri-api";
import { getProjectPath } from "../../utils/workspace";

interface CompareCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

interface CompareFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  oldPath?: string;
}

interface BranchCompareStats {
  ahead: number;
  behind: number;
  commits: CompareCommit[];
  files: CompareFile[];
  totalAdditions: number;
  totalDeletions: number;
}

interface BranchComparisonProps {
  baseBranch?: string;
  compareBranch?: string;
  branches: { name: string; current: boolean }[];
  onClose?: () => void;
  onFileSelect?: (path: string) => void;
  onMerge?: (from: string, to: string) => void;
  onCreatePR?: (from: string, to: string) => void;
}

export function BranchComparison(props: BranchComparisonProps) {
  const [baseBranch, setBaseBranch] = createSignal(props.baseBranch || "");
  const [compareBranch, setCompareBranch] = createSignal(props.compareBranch || "");
  const [loading, setLoading] = createSignal(false);
  const [stats, setStats] = createSignal<BranchCompareStats | null>(null);
  const [showBaseDropdown, setShowBaseDropdown] = createSignal(false);
  const [showCompareDropdown, setShowCompareDropdown] = createSignal(false);
  // Note: Expandable sections feature prepared for future use
  // State would be: const [expandedSections, setExpandedSections] = createSignal({ commits: true, files: true });
  const [viewMode, setViewMode] = createSignal<"commits" | "files">("commits");

  createEffect(() => {
    if (props.baseBranch) setBaseBranch(props.baseBranch);
    if (props.compareBranch) setCompareBranch(props.compareBranch);
  });

  createEffect(() => {
    const base = baseBranch();
    const compare = compareBranch();
    if (base && compare && base !== compare) {
      fetchComparison(base, compare);
    }
  });

  const fetchComparison = async (base: string, compare: string) => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();
      const data: GitCompareResult = await gitCompare(projectPath, base, compare);
      
      // Map to component's BranchCompareStats interface
      setStats({
        ahead: data.ahead,
        behind: data.behind,
        commits: data.commits.map(c => ({
          hash: c.hash,
          shortHash: c.shortHash,
          message: c.message,
          author: c.author,
          date: c.date
        })),
        files: data.files.map(f => ({
          path: f.path,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          oldPath: f.oldPath
        })),
        totalAdditions: data.totalAdditions,
        totalDeletions: data.totalDeletions
      });
    } catch (err) {
      console.error("Failed to fetch comparison:", err);
    } finally {
      setLoading(false);
    }
  };

  const swapBranches = () => {
    const base = baseBranch();
    const compare = compareBranch();
    setBaseBranch(compare);
    setCompareBranch(base);
  };

  // Note: toggleSection prepared for future expandable sections feature
  // Implementation would toggle expandedSections state for given section

  const getFileIcon = (status: string) => {
    switch (status) {
      case "added":
        return <Icon name="plus" class="w-4 h-4 text-green-400" />;
      case "deleted":
        return <Icon name="minus" class="w-4 h-4 text-red-400" />;
      case "modified":
        return <Icon name="pen" class="w-4 h-4 text-yellow-400" />;
      case "renamed":
        return <Icon name="arrow-right" class="w-4 h-4 text-blue-400" />;
      default:
        return <Icon name="file" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />;
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // Note: filteredBranches prepared for branch filtering feature
  // Would filter out currently selected base and compare branches

  return (
    <div
      class="h-full flex flex-col overflow-hidden"
      style={{ background: "var(--background-base)" }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="code-branch" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
          <h2 class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            Compare Branches
          </h2>
        </div>
        <Show when={props.onClose}>
          <button
            class="p-1 rounded hover:bg-white/10"
            onClick={props.onClose}
          >
            <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
          </button>
        </Show>
      </div>

      {/* Branch selectors */}
      <div
        class="flex items-center gap-3 px-4 py-3 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        {/* Base branch */}
        <div class="relative flex-1">
          <button
            class="w-full flex items-center justify-between px-3 py-2 rounded text-sm"
            style={{
              background: "var(--background-stronger)",
              color: "var(--text-base)",
              border: "1px solid var(--border-weak)"
            }}
            onClick={() => setShowBaseDropdown(!showBaseDropdown())}
          >
            <div class="flex items-center gap-2">
              <Icon name="code-branch" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
              <span>{baseBranch() || "Select base branch"}</span>
            </div>
            <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </button>

          <Show when={showBaseDropdown()}>
            <div
              class="absolute top-full left-0 right-0 mt-1 z-10 rounded shadow-lg max-h-48 overflow-y-auto"
              style={{ background: "var(--surface-raised)" }}
            >
              <For each={props.branches.filter(b => b.name !== compareBranch())}>
                {(branch) => (
                  <button
                    class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => {
                      setBaseBranch(branch.name);
                      setShowBaseDropdown(false);
                    }}
                  >
                    <Icon name="code-branch" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    <span class="text-sm" style={{ color: "var(--text-base)" }}>
                      {branch.name}
                    </span>
                    <Show when={branch.current}>
                      <span class="text-xs px-1 rounded" style={{ background: "var(--accent-primary)", color: "white" }}>
                        current
                      </span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Swap button */}
        <button
          class="p-2 rounded hover:bg-white/10 transition-colors shrink-0"
          onClick={swapBranches}
          title="Swap branches"
        >
          <Icon name="rotate" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
        </button>

        {/* Compare branch */}
        <div class="relative flex-1">
          <button
            class="w-full flex items-center justify-between px-3 py-2 rounded text-sm"
            style={{
              background: "var(--background-stronger)",
              color: "var(--text-base)",
              border: "1px solid var(--border-weak)"
            }}
            onClick={() => setShowCompareDropdown(!showCompareDropdown())}
          >
            <div class="flex items-center gap-2">
              <Icon name="code-branch" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
              <span>{compareBranch() || "Select compare branch"}</span>
            </div>
            <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </button>

          <Show when={showCompareDropdown()}>
            <div
              class="absolute top-full left-0 right-0 mt-1 z-10 rounded shadow-lg max-h-48 overflow-y-auto"
              style={{ background: "var(--surface-raised)" }}
            >
              <For each={props.branches.filter(b => b.name !== baseBranch())}>
                {(branch) => (
                  <button
                    class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => {
                      setCompareBranch(branch.name);
                      setShowCompareDropdown(false);
                    }}
                  >
                    <Icon name="code-branch" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    <span class="text-sm" style={{ color: "var(--text-base)" }}>
                      {branch.name}
                    </span>
                    <Show when={branch.current}>
                      <span class="text-xs px-1 rounded" style={{ background: "var(--accent-primary)", color: "white" }}>
                        current
                      </span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>

      {/* Stats summary */}
      <Show when={stats()}>
        <div
          class="flex items-center gap-4 px-4 py-2 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <div class="flex items-center gap-2">
            <span class="text-sm" style={{ color: "var(--text-weak)" }}>
              {compareBranch()} is
            </span>
            <Show when={stats()!.ahead > 0}>
              <span class="text-sm text-green-400">
                {stats()!.ahead} commit{stats()!.ahead !== 1 ? "s" : ""} ahead
              </span>
            </Show>
            <Show when={stats()!.ahead > 0 && stats()!.behind > 0}>
              <span class="text-sm" style={{ color: "var(--text-weak)" }}>and</span>
            </Show>
            <Show when={stats()!.behind > 0}>
              <span class="text-sm text-orange-400">
                {stats()!.behind} commit{stats()!.behind !== 1 ? "s" : ""} behind
              </span>
            </Show>
            <span class="text-sm" style={{ color: "var(--text-weak)" }}>
              {baseBranch()}
            </span>
          </div>
          <div class="flex-1" />
          <div class="flex items-center gap-3 text-xs">
            <span class="text-green-400">+{stats()!.totalAdditions}</span>
            <span class="text-red-400">-{stats()!.totalDeletions}</span>
            <span style={{ color: "var(--text-weak)" }}>
              {stats()!.files.length} files
            </span>
          </div>
        </div>

        {/* View mode tabs */}
        <div
          class="flex items-center gap-2 px-4 py-2 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <button
            class={`px-3 py-1 rounded text-sm transition-colors ${
              viewMode() === "commits" ? "" : "hover:bg-white/5"
            }`}
            style={{
              background: viewMode() === "commits" ? "var(--accent-primary)" : "transparent",
              color: viewMode() === "commits" ? "white" : "var(--text-weak)"
            }}
            onClick={() => setViewMode("commits")}
          >
            <Icon name="code-commit" class="w-4 h-4 inline-block mr-1" />
            Commits ({stats()!.commits.length})
          </button>
          <button
            class={`px-3 py-1 rounded text-sm transition-colors ${
              viewMode() === "files" ? "" : "hover:bg-white/5"
            }`}
            style={{
              background: viewMode() === "files" ? "var(--accent-primary)" : "transparent",
              color: viewMode() === "files" ? "white" : "var(--text-weak)"
            }}
            onClick={() => setViewMode("files")}
          >
            <Icon name="file" class="w-4 h-4 inline-block mr-1" />
            Files ({stats()!.files.length})
          </button>
        </div>
      </Show>

      {/* Content */}
      <div class="flex-1 overflow-auto">
        <Show when={loading()}>
          <div class="flex items-center justify-center h-32">
            <span style={{ color: "var(--text-weak)" }}>Loading comparison...</span>
          </div>
        </Show>

        <Show when={!loading() && !baseBranch() || !compareBranch()}>
          <div class="flex flex-col items-center justify-center h-32 gap-2">
            <Icon name="code-branch" class="w-8 h-8" style={{ color: "var(--text-weaker)" }} />
            <span style={{ color: "var(--text-weak)" }}>
              Select two branches to compare
            </span>
          </div>
        </Show>

        <Show when={!loading() && stats() && viewMode() === "commits"}>
          <div class="py-2">
            <For each={stats()!.commits}>
              {(commit) => (
                <div
                  class="flex items-start gap-3 px-4 py-2 hover:bg-white/5 cursor-pointer"
                  onClick={() => {/* Show commit details */}}
                >
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-primary)" }}
                  >
                    <Icon name="code-commit" class="w-4 h-4 text-white" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span
                        class="text-sm font-mono"
                        style={{ color: "var(--text-weak)" }}
                      >
                        {commit.shortHash}
                      </span>
                      <span
                        class="text-sm truncate"
                        style={{ color: "var(--text-base)" }}
                      >
                        {commit.message.split("\n")[0]}
                      </span>
                    </div>
                    <div class="flex items-center gap-2 text-xs mt-1" style={{ color: "var(--text-weaker)" }}>
                      <span>{commit.author}</span>
                      <span>•</span>
                      <span>{formatDate(commit.date)}</span>
                    </div>
                  </div>
                </div>
              )}
            </For>

            <Show when={stats()!.commits.length === 0}>
              <div class="flex items-center justify-center h-24">
                <span style={{ color: "var(--text-weak)" }}>No commits to compare</span>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={!loading() && stats() && viewMode() === "files"}>
          <div class="py-2">
            <For each={stats()!.files}>
              {(file) => (
                <div
                  class="flex items-center gap-3 px-4 py-2 hover:bg-white/5 cursor-pointer group"
                  onClick={() => props.onFileSelect?.(file.path)}
                >
                  {getFileIcon(file.status)}
                  <div class="flex-1 min-w-0">
                    <Show when={file.status === "renamed" && file.oldPath}>
                      <span
                        class="text-sm truncate block"
                        style={{ color: "var(--text-weak)" }}
                      >
                        {file.oldPath} →
                      </span>
                    </Show>
                    <span
                      class="text-sm truncate block"
                      style={{ color: "var(--text-base)" }}
                    >
                      {file.path}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 text-xs shrink-0">
                    <Show when={file.additions > 0}>
                      <span class="text-green-400">+{file.additions}</span>
                    </Show>
                    <Show when={file.deletions > 0}>
                      <span class="text-red-400">-{file.deletions}</span>
                    </Show>
                  </div>
                  <button
                    class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onFileSelect?.(file.path);
                    }}
                  >
                    <Icon name="arrow-up-right-from-square" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                  </button>
                </div>
              )}
            </For>

            <Show when={stats()!.files.length === 0}>
              <div class="flex items-center justify-center h-24">
                <span style={{ color: "var(--text-weak)" }}>No file changes</span>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Actions footer */}
      <Show when={stats() && (stats()!.ahead > 0 || stats()!.behind > 0)}>
        <div
          class="flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <Show when={props.onCreatePR}>
            <button
              class="flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors"
              style={{
                background: "var(--surface-active)",
                color: "var(--text-base)"
              }}
              onClick={() => props.onCreatePR?.(compareBranch(), baseBranch())}
            >
              <Icon name="arrow-up-right-from-square" class="w-4 h-4" />
              Create Pull Request
            </button>
          </Show>
          <Show when={props.onMerge}>
            <button
              class="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{ background: "var(--accent-primary)", color: "white" }}
              onClick={() => props.onMerge?.(compareBranch(), baseBranch())}
            >
              <Icon name="code-branch" class="w-4 h-4" />
              Merge {compareBranch()} into {baseBranch()}
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default BranchComparison;

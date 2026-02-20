import { createSignal, createEffect, For, Show, onMount, onCleanup, createMemo, batch } from "solid-js";
import { Icon } from "../ui/Icon";
import { 
  gitBranches, 
  gitLog, 
  GitBranch as TauriBranch, 
  GitCommit as TauriCommit,
  gitCherryPickStatus,
  gitCherryPickStart,
  gitCherryPickContinue,
  gitCherryPickSkip,
  gitCherryPickAbort,
  gitCommitFiles,
  CherryPickStatus,
  CommitFile
} from "../../utils/tauri-api";
import { getProjectPath } from "../../utils/workspace";

/** Commit entry for cherry-pick selection */
export interface CherryPickCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  files: number;
  additions: number;
  deletions: number;
}

/** Branch information */
export interface BranchInfo {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
  lastCommit?: string;
  lastCommitDate?: string;
}

/** Current cherry-pick operation state */
export type CherryPickState =
  | "idle"
  | "selecting"
  | "in-progress"
  | "paused-conflict"
  | "completing"
  | "aborting";

/** Conflict information during cherry-pick */
export interface CherryPickConflict {
  files: string[];
  currentCommit: string;
  message: string;
}

/** Props for CherryPick component */
export interface CherryPickProps {
  initialBranch?: string;
  onCherryPickStart?: (commits: CherryPickCommit[]) => void;
  onCherryPickComplete?: () => void;
  onCherryPickAbort?: () => void;
  onResolveConflicts?: (files: string[]) => void;
  onClose?: () => void;
}

export function CherryPick(props: CherryPickProps) {
  const [branches, setBranches] = createSignal<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = createSignal<string | null>(props.initialBranch || null);
  const [branchDropdownOpen, setBranchDropdownOpen] = createSignal(false);
  const [branchSearchQuery, setBranchSearchQuery] = createSignal("");
  
  const [availableCommits, setAvailableCommits] = createSignal<CherryPickCommit[]>([]);
  const [selectedCommits, setSelectedCommits] = createSignal<CherryPickCommit[]>([]);
  const [commitSearchQuery, setCommitSearchQuery] = createSignal("");
  
  const [cherryPickState, setCherryPickState] = createSignal<CherryPickState>("idle");
  const [loading, setLoading] = createSignal(false);
  const [commitsLoading, setCommitsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [conflict, setConflict] = createSignal<CherryPickConflict | null>(null);
  
  const [currentStep, setCurrentStep] = createSignal(0);
  const [totalSteps, setTotalSteps] = createSignal(0);
  
  const [previewCommit, setPreviewCommit] = createSignal<CherryPickCommit | null>(null);
  const [previewExpanded, setPreviewExpanded] = createSignal(true);
  const [commitFiles, setCommitFiles] = createSignal<{ path: string; status: string }[]>([]);
  const [commitFilesLoading, setCommitFilesLoading] = createSignal(false);

  onMount(() => {
    fetchBranches();
    checkCherryPickStatus();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-branch-dropdown]")) {
        setBranchDropdownOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  createEffect(() => {
    const branch = selectedBranch();
    if (branch) {
      fetchCommitsFromBranch(branch);
    }
  });

  createEffect(() => {
    const commit = previewCommit();
    if (commit) {
      fetchCommitFiles(commit.hash);
    }
  });

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();
      const tauriBranches: TauriBranch[] = await gitBranches(projectPath);
      
      const branchList: BranchInfo[] = tauriBranches.map((b: TauriBranch) => ({
        name: b.name,
        isRemote: b.isRemote || b.name.startsWith("origin/"),
        isCurrent: b.isHead || false,
        lastCommit: b.commit,
        lastCommitDate: undefined
      }));
      setBranches(branchList);
      
      if (!selectedBranch() && branchList.length > 0) {
        const nonCurrentBranch = branchList.find(b => !b.isCurrent);
        if (nonCurrentBranch) {
          setSelectedBranch(nonCurrentBranch.name);
        }
      }
    } catch (err) {
      setError("Failed to connect to git service");
      console.error("Failed to fetch branches:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommitsFromBranch = async (branch: string) => {
    setCommitsLoading(true);
    setError(null);
    try {
      const projectPath = getProjectPath();
      // Fetch commits from the specified branch
      const tauriCommits: TauriCommit[] = await gitLog(projectPath, 100, branch);
      
      const commits: CherryPickCommit[] = tauriCommits.map((c: TauriCommit) => ({
        hash: c.hash,
        shortHash: c.shortHash || c.hash.slice(0, 7),
        message: c.message,
        author: c.author,
        email: c.authorEmail || "",
        date: new Date(parseInt(c.date) * 1000).toISOString(),
        files: 0, // Not available from git_log
        additions: 0,
        deletions: 0
      }));
      setAvailableCommits(commits);
    } catch (err) {
      setError("Failed to connect to git service");
      console.error("Failed to fetch commits:", err);
    } finally {
      setCommitsLoading(false);
    }
  };

  const fetchCommitFiles = async (hash: string) => {
    setCommitFilesLoading(true);
    try {
      const projectPath = getProjectPath();
      const files = await gitCommitFiles(projectPath, hash);
      setCommitFiles(files.map((f: CommitFile) => ({ path: f.path, status: f.status })));
    } catch (err) {
      console.error("Failed to fetch commit files:", err);
      setCommitFiles([]);
    } finally {
      setCommitFilesLoading(false);
    }
  };

  const checkCherryPickStatus = async () => {
    try {
      const projectPath = getProjectPath();
      const status: CherryPickStatus = await gitCherryPickStatus(projectPath);
      
      if (status.in_progress) {
        batch(() => {
          setCherryPickState(status.has_conflicts ? "paused-conflict" : "in-progress");
          
          if (status.has_conflicts && status.current_commit) {
            setConflict({
              files: [], // Conflicts are detected via git status in the backend
              currentCommit: status.current_commit,
              message: "Conflict detected during cherry-pick"
            });
          }
        });
      } else {
        batch(() => {
          setCherryPickState("idle");
          setConflict(null);
        });
      }
    } catch (err) {
      console.error("Failed to check cherry-pick status:", err);
    }
  };

  const toggleCommitSelection = (commit: CherryPickCommit) => {
    setSelectedCommits(prev => {
      const exists = prev.find(c => c.hash === commit.hash);
      if (exists) {
        return prev.filter(c => c.hash !== commit.hash);
      } else {
        return [...prev, commit];
      }
    });
  };

  const isCommitSelected = (hash: string): boolean => {
    return selectedCommits().some(c => c.hash === hash);
  };

  const moveCommitUp = (index: number) => {
    if (index <= 0) return;
    setSelectedCommits(prev => {
      const result = [...prev];
      [result[index - 1], result[index]] = [result[index], result[index - 1]];
      return result;
    });
  };

  const moveCommitDown = (index: number) => {
    if (index >= selectedCommits().length - 1) return;
    setSelectedCommits(prev => {
      const result = [...prev];
      [result[index], result[index + 1]] = [result[index + 1], result[index]];
      return result;
    });
  };

  const removeFromSelection = (hash: string) => {
    setSelectedCommits(prev => prev.filter(c => c.hash !== hash));
  };

  const clearSelection = () => {
    setSelectedCommits([]);
  };

  const startCherryPick = async () => {
    const commits = selectedCommits();
    if (commits.length === 0) return;

    setCherryPickState("in-progress");
    setError(null);
    setTotalSteps(commits.length);
    setCurrentStep(0);

    try {
      const projectPath = getProjectPath();
      const hashes = commits.map(c => c.hash);

      await gitCherryPickStart(projectPath, hashes);
      props.onCherryPickStart?.(commits);
      
      // Check status to see if there are conflicts or if it completed
      await checkCherryPickStatus();
      
      // If no longer in progress, it completed successfully
      if (cherryPickState() === "idle") {
        setSelectedCommits([]);
        props.onCherryPickComplete?.();
        props.onClose?.();
      }
    } catch (err) {
      setError(`Failed to start cherry-pick: ${err}`);
      setCherryPickState("idle");
      console.error("Failed to start cherry-pick:", err);
    }
  };

  const continueCherryPick = async () => {
    setCherryPickState("in-progress");
    setError(null);
    setConflict(null);

    try {
      const projectPath = getProjectPath();
      await gitCherryPickContinue(projectPath);
      
      // Check status to see if there are more conflicts or if it completed
      await checkCherryPickStatus();
      
      // If no longer in progress, it completed successfully
      if (cherryPickState() === "idle") {
        setSelectedCommits([]);
        props.onCherryPickComplete?.();
        props.onClose?.();
      }
    } catch (err) {
      setError(`${err}`);
      await checkCherryPickStatus();
      console.error("Failed to continue cherry-pick:", err);
    }
  };

  const skipCommit = async () => {
    setCherryPickState("in-progress");
    setError(null);
    setConflict(null);

    try {
      const projectPath = getProjectPath();
      await gitCherryPickSkip(projectPath);
      
      // Check status to see if there are more conflicts or if it completed
      await checkCherryPickStatus();
      
      // If no longer in progress, it completed successfully
      if (cherryPickState() === "idle") {
        setSelectedCommits([]);
        props.onCherryPickComplete?.();
        props.onClose?.();
      }
    } catch (err) {
      setError(`Failed to skip commit: ${err}`);
      await checkCherryPickStatus();
      console.error("Failed to skip commit:", err);
    }
  };

  const abortCherryPick = async () => {
    setCherryPickState("aborting");
    setError(null);

    try {
      const projectPath = getProjectPath();
      await gitCherryPickAbort(projectPath);
      
      batch(() => {
        setCherryPickState("idle");
        setConflict(null);
        setCurrentStep(0);
        setTotalSteps(0);
      });
      props.onCherryPickAbort?.();
    } catch (err) {
      setError(`Failed to abort cherry-pick: ${err}`);
      await checkCherryPickStatus();
      console.error("Failed to abort cherry-pick:", err);
    }
  };

  const resolveConflicts = () => {
    const currentConflict = conflict();
    if (currentConflict) {
      props.onResolveConflicts?.(currentConflict.files);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
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
    return date.toLocaleDateString();
  };

  const filteredBranches = createMemo(() => {
    const query = branchSearchQuery().toLowerCase();
    if (!query) return branches();
    return branches().filter(b =>
      b.name.toLowerCase().includes(query)
    );
  });

  const filteredCommits = createMemo(() => {
    const query = commitSearchQuery().toLowerCase();
    if (!query) return availableCommits();
    return availableCommits().filter(c =>
      c.message.toLowerCase().includes(query) ||
      c.author.toLowerCase().includes(query) ||
      c.hash.toLowerCase().includes(query) ||
      c.shortHash.toLowerCase().includes(query)
    );
  });

  const isCherryPickActive = createMemo(() => {
    const state = cherryPickState();
    return state === "in-progress" || state === "paused-conflict" || state === "completing" || state === "aborting";
  });

  const canStartCherryPick = createMemo(() => {
    return cherryPickState() === "idle" && selectedCommits().length > 0 && !loading();
  });

  const progressPercent = createMemo(() => {
    const total = totalSteps();
    if (total === 0) return 0;
    return Math.round((currentStep() / total) * 100);
  });

  const currentBranchInfo = createMemo(() => {
    return branches().find(b => b.isCurrent);
  });

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
        <div class="flex items-center gap-3">
          <Icon name="copy" class="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
          <div>
            <h2 class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
              Cherry Pick Commits
            </h2>
            <Show when={currentBranchInfo()}>
              <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                Into branch: <span class="font-medium">{currentBranchInfo()!.name}</span>
              </p>
            </Show>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Show when={!isCherryPickActive()}>
            <button
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              onClick={fetchBranches}
              disabled={loading()}
              title="Refresh branches"
            >
<Icon
                name="rotate"
                class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`}
                style={{ color: "var(--text-weak)" }}
              />
            </button>
          </Show>

          <Show when={props.onClose}>
            <button
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              onClick={() => props.onClose?.()}
              title="Close"
            >
              <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            </button>
          </Show>
        </div>
      </div>

      {/* Status banner for active cherry-pick */}
      <Show when={isCherryPickActive()}>
        <div
          class="px-4 py-3 border-b shrink-0"
          style={{
            background: cherryPickState() === "paused-conflict"
              ? "rgba(248, 81, 73, 0.1)"
              : "rgba(88, 166, 255, 0.1)",
            "border-color": "var(--border-weak)"
          }}
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Show when={cherryPickState() === "paused-conflict"}>
                <Icon name="triangle-exclamation" class="w-5 h-5 text-red-400" />
                <div>
                  <div class="text-sm font-medium text-red-400">Conflicts Detected</div>
                  <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                    {conflict()?.files.length || 0} file(s) with conflicts
                  </div>
                </div>
              </Show>

              <Show when={cherryPickState() === "in-progress" || cherryPickState() === "completing"}>
                <Icon name="spinner" class="w-5 h-5 text-blue-400 animate-spin" />
                <div>
                  <div class="text-sm font-medium text-blue-400">Cherry-Pick In Progress</div>
                  <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                    Processing commit {currentStep()} of {totalSteps()}
                  </div>
                </div>
              </Show>

              <Show when={cherryPickState() === "aborting"}>
                <Icon name="spinner" class="w-5 h-5 text-red-400 animate-spin" />
                <div>
                  <div class="text-sm font-medium text-red-400">Aborting Cherry-Pick...</div>
                </div>
              </Show>
            </div>

            {/* Progress bar */}
            <Show when={totalSteps() > 0}>
              <div class="flex items-center gap-2">
                <div
                  class="w-32 h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--surface-active)" }}
                >
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progressPercent()}%`,
                      background: cherryPickState() === "paused-conflict"
                        ? "var(--cortex-error)"
                        : "var(--cortex-info)"
                    }}
                  />
                </div>
                <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {progressPercent()}%
                </span>
              </div>
            </Show>
          </div>

          {/* Conflict files list */}
          <Show when={cherryPickState() === "paused-conflict" && conflict()}>
            <div class="mt-3 pt-3 border-t" style={{ "border-color": "var(--border-weak)" }}>
              <div class="text-xs font-medium mb-2" style={{ color: "var(--text-weak)" }}>
                Conflicting files:
              </div>
              <div class="flex flex-wrap gap-2">
                <For each={conflict()?.files || []}>
                  {(file) => (
                    <span
                      class="text-xs px-2 py-1 rounded"
                      style={{ background: "rgba(248, 81, 73, 0.2)", color: "var(--cortex-error)" }}
                    >
                      {file}
                    </span>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Error banner */}
      <Show when={error()}>
        <div
          class="flex items-center gap-2 px-4 py-2 text-xs border-b"
          style={{
            background: "rgba(248, 81, 73, 0.1)",
            color: "var(--cortex-error)",
            "border-color": "var(--border-weak)"
          }}
        >
          <Icon name="circle-exclamation" class="w-4 h-4 shrink-0" />
          <span class="flex-1">{error()}</span>
          <button
            class="p-0.5 rounded hover:bg-white/10"
            onClick={() => setError(null)}
          >
            <Icon name="xmark" class="w-3.5 h-3.5" />
          </button>
        </div>
      </Show>

      {/* Main content */}
      <div class="flex-1 flex overflow-hidden">
        {/* Left panel: Branch selector and commit list */}
        <div class="flex-1 flex flex-col border-r overflow-hidden" style={{ "border-color": "var(--border-weak)" }}>
          {/* Branch selector */}
          <div class="px-3 py-2 border-b shrink-0" style={{ "border-color": "var(--border-weak)" }}>
            <label class="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-weak)" }}>
              Select source branch
            </label>
            <div class="relative" data-branch-dropdown>
              <button
                class="w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors"
                style={{
                  background: "var(--surface-base)",
                  color: "var(--text-base)",
                  border: "1px solid var(--border-weak)"
                }}
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen())}
                disabled={isCherryPickActive()}
              >
                <div class="flex items-center gap-2 min-w-0">
                  <Icon name="code-branch" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                  <Show when={selectedBranch()} fallback={
                    <span style={{ color: "var(--text-weaker)" }}>Select a branch...</span>
                  }>
                    <span class="truncate">{selectedBranch()}</span>
                  </Show>
                </div>
                <Icon name="chevron-down" class={`w-4 h-4 shrink-0 transition-transform ${branchDropdownOpen() ? "rotate-180" : ""}`} style={{ color: "var(--text-weak)" }} />
              </button>

              <Show when={branchDropdownOpen()}>
                <div
                  class="absolute left-0 right-0 top-full mt-1 z-20 rounded-md shadow-lg overflow-hidden"
                  style={{ background: "var(--surface-raised)", border: "1px solid var(--border-weak)" }}
                >
                  <div class="p-2 border-b" style={{ "border-color": "var(--border-weak)" }}>
                    <div
                      class="flex items-center gap-2 px-2 py-1.5 rounded"
                      style={{ background: "var(--background-stronger)" }}
                    >
                      <Icon name="magnifying-glass" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                      <input
                        type="text"
                        placeholder="Search branches..."
                        class="flex-1 bg-transparent text-sm outline-none"
                        style={{ color: "var(--text-base)" }}
                        value={branchSearchQuery()}
                        onInput={(e) => setBranchSearchQuery(e.currentTarget.value)}
                        autofocus
                      />
                    </div>
                  </div>
                  <div class="max-h-64 overflow-y-auto">
                    <For each={filteredBranches()}>
                      {(branch) => (
                        <button
                          class={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/10 ${
                            branch.isCurrent ? "opacity-50 cursor-not-allowed" : ""
                          } ${selectedBranch() === branch.name ? "bg-white/5" : ""}`}
                          onClick={() => {
                            if (!branch.isCurrent) {
                              setSelectedBranch(branch.name);
                              setBranchDropdownOpen(false);
                              setBranchSearchQuery("");
                            }
                          }}
                          disabled={branch.isCurrent}
                        >
                          <Icon name="code-branch" class="w-4 h-4 shrink-0" style={{ color: branch.isRemote ? "var(--cortex-info)" : "var(--text-weak)" }} />
                          <span class="flex-1 truncate text-sm" style={{ color: "var(--text-base)" }}>
                            {branch.name}
                          </span>
                          <Show when={branch.isCurrent}>
                            <span class="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent-primary)", color: "white" }}>
                              current
                            </span>
                          </Show>
                          <Show when={selectedBranch() === branch.name && !branch.isCurrent}>
                            <Icon name="check" class="w-4 h-4 text-green-400" />
                          </Show>
                        </button>
                      )}
                    </For>
                    <Show when={filteredBranches().length === 0}>
                      <div class="px-3 py-4 text-center text-sm" style={{ color: "var(--text-weak)" }}>
                        No branches found
                      </div>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          {/* Commit search */}
          <div class="px-3 py-2 border-b shrink-0" style={{ "border-color": "var(--border-weak)" }}>
            <div
              class="flex items-center gap-2 px-2 py-1.5 rounded"
              style={{ background: "var(--surface-base)", border: "1px solid var(--border-weak)" }}
            >
              <Icon name="magnifying-glass" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
              <input
                type="text"
                placeholder="Search commits..."
                class="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-base)" }}
                value={commitSearchQuery()}
                onInput={(e) => setCommitSearchQuery(e.currentTarget.value)}
                disabled={isCherryPickActive()}
              />
            </div>
          </div>

          {/* Available commits list */}
          <div class="flex-1 overflow-y-auto">
            <Show when={commitsLoading()}>
              <div class="flex items-center justify-center h-32">
                <Icon name="spinner" class="w-5 h-5 animate-spin" style={{ color: "var(--text-weak)" }} />
              </div>
            </Show>

            <Show when={!commitsLoading() && !selectedBranch()}>
              <div class="flex flex-col items-center justify-center h-32 gap-2">
                <Icon name="code-branch" class="w-8 h-8" style={{ color: "var(--text-weaker)" }} />
                <span class="text-sm" style={{ color: "var(--text-weak)" }}>Select a branch to view commits</span>
              </div>
            </Show>

            <Show when={!commitsLoading() && selectedBranch() && filteredCommits().length === 0}>
              <div class="flex flex-col items-center justify-center h-32 gap-2">
                <Icon name="code-commit" class="w-8 h-8" style={{ color: "var(--text-weaker)" }} />
                <span class="text-sm" style={{ color: "var(--text-weak)" }}>No commits found</span>
              </div>
            </Show>

            <Show when={!commitsLoading() && filteredCommits().length > 0}>
              <For each={filteredCommits()}>
                {(commit) => {
                  const selected = () => isCommitSelected(commit.hash);
                  return (
                    <div
                      class={`group flex items-start gap-3 px-3 py-2 border-b cursor-pointer transition-colors ${
                        selected() ? "bg-blue-500/10" : "hover:bg-white/5"
                      } ${isCherryPickActive() ? "opacity-60 pointer-events-none" : ""}`}
                      style={{ "border-color": "var(--border-weak)" }}
                      onClick={() => !isCherryPickActive() && toggleCommitSelection(commit)}
                    >
                      {/* Selection checkbox */}
                      <div
                        class={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          selected()
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-500 group-hover:border-gray-400"
                        }`}
                      >
                        <Show when={selected()}>
                          <Icon name="check" class="w-3 h-3 text-white" />
                        </Show>
                      </div>

                      {/* Commit info */}
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span
                            class="font-mono text-xs px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
                          >
                            {commit.shortHash}
                          </span>
                          <span
                            class="text-sm truncate"
                            style={{ color: "var(--text-base)" }}
                            title={commit.message}
                          >
                            {commit.message.split("\n")[0]}
                          </span>
                        </div>
                        <div class="flex items-center gap-3 text-xs" style={{ color: "var(--text-weaker)" }}>
                          <span class="flex items-center gap-1">
                            <Icon name="user" class="w-3 h-3" />
                            {commit.author}
                          </span>
                          <span class="flex items-center gap-1">
                            <Icon name="clock" class="w-3 h-3" />
                            {formatDate(commit.date)}
                          </span>
                        </div>
                      </div>

                      {/* Preview button */}
                      <button
                        class="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewCommit(commit);
                        }}
                        title="View details"
                      >
                        <Icon name="circle-info" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                      </button>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>

        {/* Right panel: Selected commits and preview */}
        <div class="w-80 flex flex-col overflow-hidden">
          {/* Selected commits section */}
          <div class="flex-1 flex flex-col border-b overflow-hidden" style={{ "border-color": "var(--border-weak)" }}>
            <div
              class="flex items-center justify-between px-3 py-2 border-b shrink-0"
              style={{ "border-color": "var(--border-weak)" }}
            >
              <div class="flex items-center gap-2">
                <Icon name="code-commit" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                  Selected ({selectedCommits().length})
                </span>
              </div>
              <Show when={selectedCommits().length > 0 && !isCherryPickActive()}>
                <button
                  class="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
                  style={{ color: "var(--text-weak)" }}
                  onClick={clearSelection}
                >
                  Clear all
                </button>
              </Show>
            </div>

            <div class="flex-1 overflow-y-auto">
              <Show when={selectedCommits().length === 0}>
                <div class="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
                  <Icon name="copy" class="w-6 h-6" style={{ color: "var(--text-weaker)" }} />
                  <span class="text-sm" style={{ color: "var(--text-weak)" }}>
                    Select commits from the left panel to cherry-pick
                  </span>
                </div>
              </Show>

              <Show when={selectedCommits().length > 0}>
                <div class="py-1">
                  <For each={selectedCommits()}>
                    {(commit, index) => (
                      <div
                        class="group flex items-center gap-2 px-3 py-2 hover:bg-white/5"
                      >
                        {/* Reorder buttons */}
                        <Show when={!isCherryPickActive()}>
                          <div class="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              class="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                              onClick={() => moveCommitUp(index())}
                              disabled={index() === 0}
                              title="Move up"
                            >
                              <Icon name="chevron-up" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
                            </button>
                            <button
                              class="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                              onClick={() => moveCommitDown(index())}
                              disabled={index() === selectedCommits().length - 1}
                              title="Move down"
                            >
                              <Icon name="chevron-down" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
                            </button>
                          </div>
                        </Show>

                        {/* Order number */}
                        <span
                          class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                          style={{ background: "var(--accent-primary)", color: "white" }}
                        >
                          {index() + 1}
                        </span>

                        {/* Commit info */}
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span
                              class="font-mono text-xs"
                              style={{ color: "var(--text-weak)" }}
                            >
                              {commit.shortHash}
                            </span>
                          </div>
                          <span
                            class="text-xs truncate block"
                            style={{ color: "var(--text-base)" }}
                            title={commit.message}
                          >
                            {commit.message.split("\n")[0]}
                          </span>
                        </div>

                        {/* Remove button */}
                        <Show when={!isCherryPickActive()}>
                          <button
                            class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                            onClick={() => removeFromSelection(commit.hash)}
                            title="Remove"
                          >
                            <Icon name="trash" class="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          {/* Commit preview section */}
          <div
            class="shrink-0"
            style={{ height: previewExpanded() && previewCommit() ? "200px" : "auto" }}
          >
            <button
              class="w-full flex items-center justify-between px-3 py-2 border-b hover:bg-white/5 transition-colors"
              style={{ "border-color": "var(--border-weak)" }}
              onClick={() => setPreviewExpanded(!previewExpanded())}
            >
              <div class="flex items-center gap-2">
                <Icon name="file-lines" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                  Commit Details
                </span>
              </div>
<Icon
                name="chevron-down"
                class={`w-4 h-4 transition-transform ${previewExpanded() ? "" : "-rotate-90"}`}
                style={{ color: "var(--text-weak)" }}
              />
            </button>

            <Show when={previewExpanded()}>
              <div class="overflow-y-auto" style={{ height: "calc(200px - 41px)" }}>
                <Show when={!previewCommit()}>
                  <div class="flex flex-col items-center justify-center h-full gap-2">
                    <Icon name="circle-info" class="w-5 h-5" style={{ color: "var(--text-weaker)" }} />
                    <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                      Click info icon to preview
                    </span>
                  </div>
                </Show>

                <Show when={previewCommit()}>
                  <div class="p-3 space-y-3">
                    {/* Commit hash and message */}
                    <div>
                      <span
                        class="font-mono text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
                      >
                        {previewCommit()!.shortHash}
                      </span>
                      <p class="text-sm mt-1.5" style={{ color: "var(--text-base)" }}>
                        {previewCommit()!.message}
                      </p>
                    </div>

                    {/* Author and date */}
                    <div class="flex items-center gap-4 text-xs" style={{ color: "var(--text-weaker)" }}>
                      <span class="flex items-center gap-1">
                        <Icon name="user" class="w-3 h-3" />
                        {previewCommit()!.author}
                      </span>
                      <span class="flex items-center gap-1">
                        <Icon name="clock" class="w-3 h-3" />
                        {formatDate(previewCommit()!.date)}
                      </span>
                    </div>

                    {/* Stats */}
                    <div class="flex items-center gap-3 text-xs">
                      <span class="flex items-center gap-1" style={{ color: "var(--cortex-success)" }}>
                        <Icon name="plus" class="w-3 h-3" />
                        {previewCommit()!.additions}
                      </span>
                      <span class="flex items-center gap-1" style={{ color: "var(--cortex-error)" }}>
                        <Icon name="minus" class="w-3 h-3" />
                        {previewCommit()!.deletions}
                      </span>
                      <span class="flex items-center gap-1" style={{ color: "var(--text-weak)" }}>
                        <Icon name="file-lines" class="w-3 h-3" />
                        {previewCommit()!.files} files
                      </span>
                    </div>

                    {/* Changed files */}
                    <Show when={commitFilesLoading()}>
                      <div class="flex items-center gap-2 text-xs" style={{ color: "var(--text-weak)" }}>
                        <Icon name="spinner" class="w-3 h-3 animate-spin" />
                        Loading files...
                      </div>
                    </Show>

                    <Show when={!commitFilesLoading() && commitFiles().length > 0}>
                      <div>
                        <div class="text-xs font-medium mb-1.5" style={{ color: "var(--text-weak)" }}>
                          Changed files:
                        </div>
                        <div class="space-y-1">
                          <For each={commitFiles().slice(0, 5)}>
                            {(file) => (
                              <div
                                class="text-xs px-2 py-1 rounded truncate"
                                style={{ background: "var(--surface-base)", color: "var(--text-base)" }}
                                title={file.path}
                              >
                                <span
                                  class="inline-block w-2 h-2 rounded-full mr-2"
                                  style={{
                                    background: file.status === "A" ? "var(--cortex-success)" :
                                               file.status === "D" ? "var(--cortex-error)" :
                                               file.status === "M" ? "var(--cortex-info)" : "var(--text-weak)"
                                  }}
                                />
                                {file.path.split("/").pop()}
                              </div>
                            )}
                          </For>
                          <Show when={commitFiles().length > 5}>
                            <div class="text-xs" style={{ color: "var(--text-weaker)" }}>
                              +{commitFiles().length - 5} more files
                            </div>
                          </Show>
                        </div>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Action buttons footer */}
      <div
        class="px-4 py-3 border-t shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <Show when={!isCherryPickActive()}>
          <div class="flex items-center justify-between">
            <div class="text-xs" style={{ color: "var(--text-weak)" }}>
              {selectedCommits().length} commit{selectedCommits().length !== 1 ? "s" : ""} will be cherry-picked
            </div>
            <div class="flex items-center gap-2">
              <Show when={props.onClose}>
                <button
                  class="px-4 py-2 rounded text-sm transition-colors"
                  style={{ color: "var(--text-weak)" }}
                  onClick={() => props.onClose?.()}
                >
                  Cancel
                </button>
              </Show>
              <button
                class="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--accent-primary)", color: "white" }}
                disabled={!canStartCherryPick()}
                onClick={startCherryPick}
              >
                <Icon name="play" class="w-4 h-4" />
                Start Cherry Pick
              </button>
            </div>
          </div>
        </Show>

        <Show when={isCherryPickActive()}>
          <div class="flex items-center justify-between">
            <button
              class="flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors hover:bg-red-500/20"
              style={{ color: "var(--cortex-error)" }}
              onClick={abortCherryPick}
              disabled={cherryPickState() === "aborting"}
            >
              <Icon name="xmark" class="w-4 h-4" />
              Abort
            </button>

            <div class="flex items-center gap-2">
              <Show when={cherryPickState() === "paused-conflict"}>
                <button
                  class="flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors border"
                  style={{ "border-color": "var(--border-weak)", color: "var(--text-base)" }}
                  onClick={resolveConflicts}
                >
                  <Icon name="code-merge" class="w-4 h-4" />
                  Resolve Conflicts
                </button>
                <button
                  class="flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors border"
                  style={{ "border-color": "var(--border-weak)", color: "var(--text-weak)" }}
                  onClick={skipCommit}
                >
                  <Icon name="forward-step" class="w-4 h-4" />
                  Skip
                </button>
              </Show>

              <button
                class="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: "var(--accent-primary)", color: "white" }}
                onClick={continueCherryPick}
                disabled={cherryPickState() === "in-progress" || cherryPickState() === "completing"}
              >
                <Show when={cherryPickState() === "in-progress" || cherryPickState() === "completing"}>
                  <Icon name="spinner" class="w-4 h-4 animate-spin" />
                  Processing...
                </Show>
                <Show when={cherryPickState() === "paused-conflict"}>
                  <Icon name="play" class="w-4 h-4" />
                  Continue
                </Show>
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default CherryPick;


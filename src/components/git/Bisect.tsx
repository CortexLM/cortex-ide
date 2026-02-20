import { createSignal, For, Show, onMount, createMemo, batch } from "solid-js";
import { Icon } from "../ui/Icon";
import { 
  gitLog, 
  GitCommit as TauriCommit,
  gitBisectStatus as tauriBisectStatus,
  gitBisectStart as tauriBisectStart,
  gitBisectMark as tauriBisectMark,
  gitBisectReset as tauriBisectReset,
  BisectStatus as TauriBisectStatus,
  BisectResult as TauriBisectResult
} from "../../utils/tauri-api";
import { getProjectPath } from "../../utils/workspace";

export interface BisectCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
}

export interface BisectMark {
  hash: string;
  shortHash: string;
  message: string;
  mark: "good" | "bad" | "skip";
  timestamp: number;
}

export interface BisectStatus {
  active: boolean;
  currentCommit: BisectCommit | null;
  goodCommit: BisectCommit | null;
  badCommit: BisectCommit | null;
  stepsRemaining: number;
  totalSteps: number;
  culprit: BisectCommit | null;
  marks: BisectMark[];
}

type WizardStep = "idle" | "select-bad" | "select-good" | "testing" | "complete";

export interface BisectProps {
  onCommitSelect?: (hash: string) => void;
  onBisectComplete?: (culpritHash: string) => void;
}

export function Bisect(props: BisectProps) {
  const [wizardStep, setWizardStep] = createSignal<WizardStep>("idle");
  const [commits, setCommits] = createSignal<BisectCommit[]>([]);
  const [, setLoading] = createSignal(false);
  const [operationLoading, setOperationLoading] = createSignal<string | null>(null);
  // Prepared for future search feature
  // const [searchQuery, setSearchQuery] = createSignal("");
  // const [showCommitSelector, setShowCommitSelector] = createSignal(false);
  const [bisectStatus, setBisectStatus] = createSignal<BisectStatus>({
    active: false,
    currentCommit: null,
    goodCommit: null,
    badCommit: null,
    stepsRemaining: 0,
    totalSteps: 0,
    culprit: null,
    marks: []
  });
  const [selectedBadCommit, setSelectedBadCommit] = createSignal<BisectCommit | null>(null);
  const [selectedGoodCommit, setSelectedGoodCommit] = createSignal<BisectCommit | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = createSignal(true);

  onMount(() => {
    fetchCommits();
    fetchBisectStatus();
  });

  const clearError = () => setError(null);

  const showError = (message: string) => {
    setError(message);
    setTimeout(clearError, 5000);
  };

  const fetchCommits = async () => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();
      const tauriCommits: TauriCommit[] = await gitLog(projectPath, 200);
      
      const bisectCommits: BisectCommit[] = tauriCommits.map((c: TauriCommit) => ({
        hash: c.hash,
        shortHash: c.shortHash || c.hash.slice(0, 7),
        message: c.message,
        author: c.author,
        email: c.authorEmail || "",
        date: new Date(parseInt(c.date) * 1000).toISOString(),
        timestamp: parseInt(c.date) * 1000
      }));
      setCommits(bisectCommits);
    } catch (err) {
      console.error("Failed to fetch commits:", err);
      showError("Failed to fetch commit history");
    } finally {
      setLoading(false);
    }
  };

  // Helper to convert commit hash to BisectCommit
  const hashToCommit = (hash: string): BisectCommit | null => {
    const allCommits = commits();
    const commit = allCommits.find(c => c.hash === hash || c.hash.startsWith(hash));
    return commit || null;
  };

  const fetchBisectStatus = async () => {
    try {
      const projectPath = getProjectPath();
      const data: TauriBisectStatus = await tauriBisectStatus(projectPath);
      
      if (data.in_progress) {
        const currentCommit = data.current_commit ? hashToCommit(data.current_commit) : null;
        const goodCommit = data.good_commits.length > 0 ? hashToCommit(data.good_commits[0]) : null;
        const badCommit = data.bad_commits.length > 0 ? hashToCommit(data.bad_commits[0]) : null;
        
        batch(() => {
          setBisectStatus(prev => ({
            ...prev,
            active: true,
            currentCommit,
            goodCommit,
            badCommit,
            stepsRemaining: data.remaining_steps,
          }));
          setWizardStep("testing");
        });
      } else {
        setWizardStep("idle");
      }
    } catch (err) {
      console.error("Failed to fetch bisect status:", err);
    }
  };

  const startBisect = async () => {
    const badCommit = selectedBadCommit();
    const goodCommit = selectedGoodCommit();

    if (!badCommit || !goodCommit) return;

    setOperationLoading("start");
    try {
      const projectPath = getProjectPath();
      const data: TauriBisectResult = await tauriBisectStart(projectPath, badCommit.hash, goodCommit.hash);
      
      const currentCommit = hashToCommit(data.current_commit);
      const estimatedSteps = estimateSteps(goodCommit, badCommit);
      
      if (data.found_culprit && data.culprit_commit) {
        const culpritCommit = hashToCommit(data.culprit_commit);
        batch(() => {
          setBisectStatus({
            active: true,
            currentCommit: null,
            goodCommit,
            badCommit,
            stepsRemaining: 0,
            totalSteps: estimatedSteps,
            culprit: culpritCommit,
            marks: []
          });
          setWizardStep("complete");
          if (culpritCommit) {
            props.onBisectComplete?.(culpritCommit.hash);
          }
        });
      } else {
        batch(() => {
          setBisectStatus({
            active: true,
            currentCommit,
            goodCommit,
            badCommit,
            stepsRemaining: data.remaining_steps || estimatedSteps,
            totalSteps: estimatedSteps,
            culprit: null,
            marks: []
          });
          setWizardStep("testing");
        });
      }
    } catch (err) {
      console.error("Failed to start bisect:", err);
      showError("Failed to start bisect");
    } finally {
      setOperationLoading(null);
    }
  };

  const estimateSteps = (good: BisectCommit, bad: BisectCommit): number => {
    const goodIndex = commits().findIndex(c => c.hash === good.hash);
    const badIndex = commits().findIndex(c => c.hash === bad.hash);
    if (goodIndex === -1 || badIndex === -1) return 0;
    const range = Math.abs(goodIndex - badIndex);
    return Math.max(1, Math.ceil(Math.log2(range)));
  };

  const markCommit = async (mark: "good" | "bad" | "skip") => {
    const status = bisectStatus();
    if (!status.currentCommit) return;

    setOperationLoading(mark);
    try {
      const projectPath = getProjectPath();
      const data: TauriBisectResult = await tauriBisectMark(projectPath, mark);
      
      const newMark: BisectMark = {
        hash: status.currentCommit.hash,
        shortHash: status.currentCommit.shortHash,
        message: status.currentCommit.message,
        mark: mark,
        timestamp: Date.now()
      };

      if (data.found_culprit && data.culprit_commit) {
        const culpritCommit = hashToCommit(data.culprit_commit);
        batch(() => {
          setBisectStatus(prev => ({
            ...prev,
            currentCommit: null,
            culprit: culpritCommit,
            stepsRemaining: 0,
            marks: [...prev.marks, newMark]
          }));
          setWizardStep("complete");
          if (culpritCommit) {
            props.onBisectComplete?.(culpritCommit.hash);
          }
        });
      } else {
        const currentCommit = hashToCommit(data.current_commit);
        batch(() => {
          setBisectStatus(prev => ({
            ...prev,
            currentCommit,
            stepsRemaining: data.remaining_steps ?? Math.max(0, prev.stepsRemaining - 1),
            marks: [...prev.marks, newMark]
          }));
        });
      }
    } catch (err) {
      console.error(`Failed to mark commit as ${mark}:`, err);
      showError(`Failed to mark commit as ${mark}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const resetBisect = async () => {
    setOperationLoading("reset");
    try {
      const projectPath = getProjectPath();
      await tauriBisectReset(projectPath);
      
      batch(() => {
        setBisectStatus({
          active: false,
          currentCommit: null,
          goodCommit: null,
          badCommit: null,
          stepsRemaining: 0,
          totalSteps: 0,
          culprit: null,
          marks: []
        });
        setSelectedBadCommit(null);
        setSelectedGoodCommit(null);
        setWizardStep("idle");
      });
    } catch (err) {
      console.error("Failed to reset bisect:", err);
      showError("Failed to reset bisect");
    } finally {
      setOperationLoading(null);
    }
  };

  // Prepared for future search functionality
  // const filteredCommits = createMemo(() => {
  //   const query = searchQuery().toLowerCase();
  //   if (!query) return commits();
  //   return commits().filter(commit =>
  //     commit.message.toLowerCase().includes(query) ||
  //     commit.author.toLowerCase().includes(query) ||
  //     commit.hash.toLowerCase().includes(query) ||
  //     commit.shortHash.toLowerCase().includes(query)
  //   );
  // });

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

  const progressPercent = createMemo(() => {
    const status = bisectStatus();
    if (status.totalSteps === 0) return 0;
    return Math.round(((status.totalSteps - status.stepsRemaining) / status.totalSteps) * 100);
  });

  const CommitSelector = (props: {
    title: string;
    selectedCommit: BisectCommit | null;
    onSelect: (commit: BisectCommit) => void;
    excludeHash?: string;
    badgeColor: string;
    badgeText: string;
  }) => {
    const [open, setOpen] = createSignal(false);
    const [localSearch, setLocalSearch] = createSignal("");

    const filteredList = createMemo(() => {
      const query = localSearch().toLowerCase();
      return commits().filter(commit => {
        if (props.excludeHash && commit.hash === props.excludeHash) return false;
        if (!query) return true;
        return (
          commit.message.toLowerCase().includes(query) ||
          commit.author.toLowerCase().includes(query) ||
          commit.hash.toLowerCase().includes(query)
        );
      });
    });

    return (
      <div class="relative">
        <label class="text-xs font-medium mb-1 block" style={{ color: "var(--text-weak)" }}>
          {props.title}
        </label>
        <button
          class="w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors"
          style={{
            background: "var(--surface-base)",
            color: "var(--text-base)",
            border: "1px solid var(--border-weak)"
          }}
          onClick={() => setOpen(!open())}
        >
          <Show
            when={props.selectedCommit}
            fallback={
              <span style={{ color: "var(--text-weaker)" }}>Select commit...</span>
            }
          >
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
                style={{ background: props.badgeColor, color: "white" }}
              >
                {props.badgeText}
              </span>
              <span class="font-mono text-xs shrink-0" style={{ color: "var(--text-weak)" }}>
                {props.selectedCommit!.shortHash}
              </span>
              <span class="truncate">
                {props.selectedCommit!.message.split("\n")[0]}
              </span>
            </div>
          </Show>
          <Icon name="chevron-down" class="w-4 h-4 shrink-0 ml-2" style={{ color: "var(--text-weak)" }} />
        </button>

        <Show when={open()}>
          <div
            class="absolute top-full left-0 right-0 mt-1 z-20 rounded-md shadow-lg overflow-hidden"
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
                  placeholder="Search commits..."
                  class="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-base)" }}
                  value={localSearch()}
                  onInput={(e) => setLocalSearch(e.currentTarget.value)}
                  autofocus
                />
              </div>
            </div>

            <div class="max-h-64 overflow-y-auto">
              <For each={filteredList().slice(0, 50)}>
                {(commit) => (
                  <button
                    class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/10 transition-colors"
                    onClick={() => {
                      props.onSelect(commit);
                      setOpen(false);
                      setLocalSearch("");
                    }}
                  >
                    <Icon name="code-commit" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                    <span class="font-mono text-xs shrink-0" style={{ color: "var(--text-weak)" }}>
                      {commit.shortHash}
                    </span>
                    <span class="text-sm truncate flex-1" style={{ color: "var(--text-base)" }}>
                      {commit.message.split("\n")[0]}
                    </span>
                    <span class="text-xs shrink-0" style={{ color: "var(--text-weaker)" }}>
                      {formatDate(commit.date)}
                    </span>
                  </button>
                )}
              </For>

              <Show when={filteredList().length === 0}>
                <div class="px-3 py-4 text-center text-sm" style={{ color: "var(--text-weak)" }}>
                  No commits found
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    );
  };

  const MarkBadge = (props: { mark: "good" | "bad" | "skip" }) => {
    const config = {
      good: { bg: "rgba(63, 185, 80, 0.2)", color: "var(--cortex-success)", icon: "circle-check" },
      bad: { bg: "rgba(248, 81, 73, 0.2)", color: "var(--cortex-error)", icon: "circle-xmark" },
      skip: { bg: "rgba(136, 146, 158, 0.2)", color: "var(--cortex-text-inactive)", icon: "forward-step" }
    }[props.mark];

    return (
      <span
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
        style={{ background: config.bg, color: config.color }}
      >
        <Icon name={config.icon} class="w-3 h-3" />
        {props.mark}
      </span>
    );
  };

  return (
    <div
      class="h-full flex flex-col overflow-hidden"
      style={{ background: "var(--background-base)" }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="magnifying-glass" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            Git Bisect
          </span>
          <Show when={bisectStatus().active}>
            <span
              class="text-xs px-1.5 py-0.5 rounded"
              style={{ background: "var(--accent-primary)", color: "white" }}
            >
              Active
            </span>
          </Show>
        </div>
        <Show when={bisectStatus().active || wizardStep() !== "idle"}>
          <button
            class="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
            onClick={resetBisect}
            disabled={!!operationLoading()}
            title="Reset bisect"
          >
            <Show when={operationLoading() === "reset"} fallback={
              <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            }>
              <Icon name="spinner" class="w-4 h-4 animate-spin" style={{ color: "var(--text-weak)" }} />
            </Show>
          </button>
        </Show>
      </div>

      {/* Error banner */}
      <Show when={error()}>
        <div
          class="flex items-center gap-2 px-3 py-2 text-xs"
          style={{ background: "rgba(248, 81, 73, 0.1)", color: "var(--cortex-error)" }}
        >
          <Icon name="circle-exclamation" class="w-3.5 h-3.5 shrink-0" />
          <span class="flex-1">{error()}</span>
          <button class="p-0.5 rounded hover:bg-white/10" onClick={clearError}>
            <Icon name="xmark" class="w-3 h-3" />
          </button>
        </div>
      </Show>

      {/* Main content */}
      <div class="flex-1 overflow-y-auto">
        {/* Idle state - Start wizard */}
        <Show when={wizardStep() === "idle"}>
          <div class="p-4 space-y-4">
            <div
              class="p-4 rounded-lg"
              style={{ background: "var(--surface-base)", border: "1px solid var(--border-weak)" }}
            >
              <div class="flex items-start gap-3 mb-4">
                <div
                  class="p-2 rounded-lg shrink-0"
                  style={{ background: "rgba(88, 166, 255, 0.1)" }}
                >
                  <Icon name="bullseye" class="w-5 h-5" style={{ color: "var(--cortex-info)" }} />
                </div>
                <div>
                  <h3 class="text-sm font-medium mb-1" style={{ color: "var(--text-base)" }}>
                    Find the Bug
                  </h3>
                  <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                    Git bisect uses binary search to find the commit that introduced a bug.
                    Select a bad commit (has the bug) and a good commit (no bug).
                  </p>
                </div>
              </div>

              <button
                class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={{ background: "var(--accent-primary)", color: "white" }}
                onClick={() => setWizardStep("select-bad")}
              >
                <Icon name="play" class="w-4 h-4" />
                Start Bisect Wizard
              </button>
            </div>

            {/* How it works */}
            <div class="space-y-2">
              <h4 class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                How it works:
              </h4>
              <div class="space-y-2">
                {[
                  { step: 1, text: "Select the bad commit (where the bug exists)" },
                  { step: 2, text: "Select a good commit (where the bug doesn't exist)" },
                  { step: 3, text: "Test each commit and mark as good or bad" },
                  { step: 4, text: "Git bisect finds the culprit commit" }
                ].map((item) => (
                  <div class="flex items-center gap-2">
                    <span
                      class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                      style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
                    >
                      {item.step}
                    </span>
                    <span class="text-xs" style={{ color: "var(--text-base)" }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Show>

        {/* Step 1: Select bad commit */}
        <Show when={wizardStep() === "select-bad"}>
          <div class="p-4 space-y-4">
            <div class="flex items-center gap-2 mb-2">
              <span
                class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                style={{ background: "var(--cortex-error)", color: "white" }}
              >
                1
              </span>
              <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                Select Bad Commit
              </span>
            </div>

            <p class="text-xs" style={{ color: "var(--text-weak)" }}>
              Select a commit where the bug is present. This is typically your current HEAD or a recent commit.
            </p>

            <CommitSelector
              title="Bad Commit (has bug)"
              selectedCommit={selectedBadCommit()}
              onSelect={setSelectedBadCommit}
              badgeColor="var(--cortex-error)"
              badgeText="BAD"
            />

            <div class="flex justify-between pt-2">
              <button
                class="px-3 py-1.5 rounded text-sm"
                style={{ color: "var(--text-weak)" }}
                onClick={() => setWizardStep("idle")}
              >
                Cancel
              </button>
              <button
                class="px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: "var(--accent-primary)", color: "white" }}
                disabled={!selectedBadCommit()}
                onClick={() => setWizardStep("select-good")}
              >
                Next
              </button>
            </div>
          </div>
        </Show>

        {/* Step 2: Select good commit */}
        <Show when={wizardStep() === "select-good"}>
          <div class="p-4 space-y-4">
            <div class="flex items-center gap-2 mb-2">
              <span
                class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                style={{ background: "var(--cortex-success)", color: "white" }}
              >
                2
              </span>
              <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                Select Good Commit
              </span>
            </div>

            <p class="text-xs" style={{ color: "var(--text-weak)" }}>
              Select a commit where the bug is NOT present. This should be an older commit before the bug was introduced.
            </p>

            {/* Show selected bad commit */}
            <Show when={selectedBadCommit()}>
              <div
                class="flex items-center gap-2 px-3 py-2 rounded text-sm"
                style={{ background: "rgba(248, 81, 73, 0.1)" }}
              >
                <span class="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--cortex-error)", color: "white" }}>
                  BAD
                </span>
                <span class="font-mono text-xs" style={{ color: "var(--text-weak)" }}>
                  {selectedBadCommit()!.shortHash}
                </span>
                <span class="truncate" style={{ color: "var(--text-base)" }}>
                  {selectedBadCommit()!.message.split("\n")[0]}
                </span>
              </div>
            </Show>

            <CommitSelector
              title="Good Commit (no bug)"
              selectedCommit={selectedGoodCommit()}
              onSelect={setSelectedGoodCommit}
              excludeHash={selectedBadCommit()?.hash}
              badgeColor="var(--cortex-success)"
              badgeText="GOOD"
            />

            <div class="flex justify-between pt-2">
              <button
                class="px-3 py-1.5 rounded text-sm"
                style={{ color: "var(--text-weak)" }}
                onClick={() => setWizardStep("select-bad")}
              >
                Back
              </button>
              <button
                class="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: "var(--accent-primary)", color: "white" }}
                disabled={!selectedGoodCommit() || !!operationLoading()}
                onClick={startBisect}
              >
                <Show when={operationLoading() === "start"}>
                  <Icon name="spinner" class="w-4 h-4 animate-spin" />
                </Show>
                Start Bisect
              </button>
            </div>
          </div>
        </Show>

        {/* Testing phase */}
        <Show when={wizardStep() === "testing"}>
          <div class="p-4 space-y-4">
            {/* Progress indicator */}
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span style={{ color: "var(--text-weak)" }}>Progress</span>
                <span style={{ color: "var(--text-base)" }}>
                  {bisectStatus().totalSteps - bisectStatus().stepsRemaining} / {bisectStatus().totalSteps} steps
                </span>
              </div>
              <div
                class="h-2 rounded-full overflow-hidden"
                style={{ background: "var(--surface-active)" }}
              >
                <div
                  class="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPercent()}%`,
                    background: "var(--accent-primary)"
                  }}
                />
              </div>
              <div class="flex items-center justify-between text-xs">
                <span style={{ color: "var(--text-weaker)" }}>
                  ~{bisectStatus().stepsRemaining} step{bisectStatus().stepsRemaining !== 1 ? "s" : ""} remaining
                </span>
                <span style={{ color: "var(--text-weaker)" }}>
                  {progressPercent()}%
                </span>
              </div>
            </div>

            {/* Current commit to test */}
            <Show when={bisectStatus().currentCommit}>
              <div
                class="p-4 rounded-lg"
                style={{ background: "var(--surface-base)", border: "1px solid var(--border-weak)" }}
              >
                <div class="flex items-center gap-2 mb-3">
                  <Icon name="flag" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />
                  <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                    Test This Commit
                  </span>
                </div>

                <div class="space-y-2 mb-4">
                  <div class="flex items-center gap-2">
                    <Icon name="code-commit" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    <span class="font-mono text-sm" style={{ color: "var(--text-base)" }}>
                      {bisectStatus().currentCommit!.shortHash}
                    </span>
                    <button
                      class="text-xs px-1.5 py-0.5 rounded hover:bg-white/10"
                      style={{ color: "var(--text-weak)" }}
                      onClick={() => {
                        navigator.clipboard.writeText(bisectStatus().currentCommit!.hash);
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <p class="text-sm" style={{ color: "var(--text-base)" }}>
                    {bisectStatus().currentCommit!.message.split("\n")[0]}
                  </p>
                  <div class="flex items-center gap-4 text-xs" style={{ color: "var(--text-weak)" }}>
                    <div class="flex items-center gap-1">
                      <Icon name="user" class="w-3 h-3" />
                      {bisectStatus().currentCommit!.author}
                    </div>
                    <div class="flex items-center gap-1">
                      <Icon name="clock" class="w-3 h-3" />
                      {formatDate(bisectStatus().currentCommit!.date)}
                    </div>
                  </div>
                </div>

                <p class="text-xs mb-3" style={{ color: "var(--text-weaker)" }}>
                  Test your application at this commit. Does the bug exist?
                </p>

                {/* Action buttons */}
                <div class="flex items-center gap-2">
                  <button
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    style={{ background: "rgba(63, 185, 80, 0.2)", color: "var(--cortex-success)" }}
                    disabled={!!operationLoading()}
                    onClick={() => markCommit("good")}
                  >
                    <Show when={operationLoading() === "good"} fallback={
                      <Icon name="circle-check" class="w-4 h-4" />
                    }>
                      <Icon name="spinner" class="w-4 h-4 animate-spin" />
                    </Show>
                    Good
                  </button>
                  <button
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    style={{ background: "rgba(248, 81, 73, 0.2)", color: "var(--cortex-error)" }}
                    disabled={!!operationLoading()}
                    onClick={() => markCommit("bad")}
                  >
                    <Show when={operationLoading() === "bad"} fallback={
                      <Icon name="circle-xmark" class="w-4 h-4" />
                    }>
                      <Icon name="spinner" class="w-4 h-4 animate-spin" />
                    </Show>
                    Bad
                  </button>
                  <button
                    class="flex items-center justify-center gap-2 px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
                    style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
                    disabled={!!operationLoading()}
                    onClick={() => markCommit("skip")}
                    title="Skip if you can't test this commit"
                  >
                    <Show when={operationLoading() === "skip"} fallback={
                      <Icon name="forward-step" class="w-4 h-4" />
                    }>
                      <Icon name="spinner" class="w-4 h-4 animate-spin" />
                    </Show>
                    Skip
                  </button>
                </div>
              </div>
            </Show>

            {/* Bisect range info */}
            <div class="flex items-center gap-4 text-xs">
              <div class="flex items-center gap-2">
                <span style={{ color: "var(--text-weak)" }}>Good:</span>
                <span class="font-mono" style={{ color: "var(--cortex-success)" }}>
                  {bisectStatus().goodCommit?.shortHash}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span style={{ color: "var(--text-weak)" }}>Bad:</span>
                <span class="font-mono" style={{ color: "var(--cortex-error)" }}>
                  {bisectStatus().badCommit?.shortHash}
                </span>
              </div>
            </div>

            {/* History of marks */}
            <Show when={bisectStatus().marks.length > 0}>
              <div class="border-t pt-4" style={{ "border-color": "var(--border-weak)" }}>
                <button
                  class="w-full flex items-center justify-between mb-2"
                  onClick={() => setHistoryExpanded(!historyExpanded())}
                >
                  <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                    History ({bisectStatus().marks.length})
                  </span>
                  {historyExpanded() ? (
                    <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                  ) : (
                    <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                  )}
                </button>

                <Show when={historyExpanded()}>
                  <div class="space-y-1">
                    <For each={[...bisectStatus().marks].reverse()}>
                      {(mark) => (
                        <div
                          class="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                          style={{ background: "var(--surface-base)" }}
                        >
                          <MarkBadge mark={mark.mark} />
                          <span class="font-mono" style={{ color: "var(--text-weak)" }}>
                            {mark.shortHash}
                          </span>
                          <span class="truncate flex-1" style={{ color: "var(--text-base)" }}>
                            {mark.message.split("\n")[0]}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>

        {/* Complete - culprit found */}
        <Show when={wizardStep() === "complete"}>
          <div class="p-4 space-y-4">
            <div
              class="p-4 rounded-lg"
              style={{ background: "rgba(63, 185, 80, 0.1)", border: "1px solid rgba(63, 185, 80, 0.3)" }}
            >
              <div class="flex items-center gap-2 mb-3">
                <Icon name="circle-check" class="w-5 h-5" style={{ color: "var(--cortex-success)" }} />
                <span class="text-sm font-medium" style={{ color: "var(--cortex-success)" }}>
                  Culprit Found!
                </span>
              </div>

              <Show when={bisectStatus().culprit}>
                <div class="space-y-3">
                  <div
                    class="p-3 rounded"
                    style={{ background: "var(--surface-base)" }}
                  >
                    <div class="flex items-center gap-2 mb-2">
                      <Icon name="code-commit" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                      <span class="font-mono text-sm font-medium" style={{ color: "var(--text-base)" }}>
                        {bisectStatus().culprit!.shortHash}
                      </span>
                      <button
                        class="text-xs px-1.5 py-0.5 rounded hover:bg-white/10"
                        style={{ color: "var(--text-weak)" }}
                        onClick={() => {
                          navigator.clipboard.writeText(bisectStatus().culprit!.hash);
                        }}
                      >
                        Copy SHA
                      </button>
                    </div>
                    <p class="text-sm mb-2" style={{ color: "var(--text-base)" }}>
                      {bisectStatus().culprit!.message}
                    </p>
                    <div class="flex items-center gap-4 text-xs" style={{ color: "var(--text-weak)" }}>
                      <div class="flex items-center gap-1">
                        <Icon name="user" class="w-3 h-3" />
                        {bisectStatus().culprit!.author}
                      </div>
                      <div class="flex items-center gap-1">
                        <Icon name="clock" class="w-3 h-3" />
                        {formatDate(bisectStatus().culprit!.date)}
                      </div>
                    </div>
                  </div>

                  <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                    This is the first bad commit. The bug was introduced in this commit.
                  </p>

                  <div class="flex items-center gap-2">
                    <button
                      class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors"
                      style={{ background: "var(--accent-primary)", color: "white" }}
                      onClick={() => {
                        props.onCommitSelect?.(bisectStatus().culprit!.hash);
                      }}
                    >
                      View Commit
                    </button>
                    <button
                      class="flex items-center justify-center gap-2 px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
                      style={{ background: "var(--surface-active)", color: "var(--text-base)" }}
                      disabled={!!operationLoading()}
                      onClick={resetBisect}
                    >
                      <Show when={operationLoading() === "reset"}>
                        <Icon name="spinner" class="w-4 h-4 animate-spin" />
                      </Show>
                      Start New Bisect
                    </button>
                  </div>
                </div>
              </Show>
            </div>

            {/* History of marks */}
            <Show when={bisectStatus().marks.length > 0}>
              <div class="border-t pt-4" style={{ "border-color": "var(--border-weak)" }}>
                <button
                  class="w-full flex items-center justify-between mb-2"
                  onClick={() => setHistoryExpanded(!historyExpanded())}
                >
                  <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                    Bisect History ({bisectStatus().marks.length} steps)
                  </span>
                  {historyExpanded() ? (
                    <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                  ) : (
                    <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                  )}
                </button>

                <Show when={historyExpanded()}>
                  <div class="space-y-1">
                    <For each={[...bisectStatus().marks].reverse()}>
                      {(mark) => (
                        <div
                          class="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                          style={{ background: "var(--surface-base)" }}
                        >
                          <MarkBadge mark={mark.mark} />
                          <span class="font-mono" style={{ color: "var(--text-weak)" }}>
                            {mark.shortHash}
                          </span>
                          <span class="truncate flex-1" style={{ color: "var(--text-base)" }}>
                            {mark.message.split("\n")[0]}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default Bisect;


import { createSignal, createEffect, For, Show, onMount, onCleanup, createMemo, batch } from "solid-js";
import { Icon } from "../ui/Icon";
import { gitRebaseCommits, gitRebaseStatus, gitRebaseStart, gitRebaseContinue, gitRebaseSkip, gitRebaseAbort, RebaseCommit as ApiRebaseCommit, RebaseAction as ApiRebaseAction } from "../../utils/tauri-api";
import { getProjectPath } from "../../utils/workspace";

/** Rebase action types matching git rebase -i commands */
export type RebaseAction = "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";

/** Commit entry in the rebase todo list */
export interface RebaseCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  action: RebaseAction;
  originalIndex: number;
}

/** Current rebase operation state */
export type RebaseState = 
  | "idle"
  | "preparing"
  | "in-progress"
  | "paused-edit"
  | "paused-conflict"
  | "completing"
  | "aborting";

/** Conflict information during rebase */
export interface RebaseConflict {
  files: string[];
  currentCommit: string;
  message: string;
}

/** Props for InteractiveRebase component */
export interface InteractiveRebaseProps {
  targetBranch?: string;
  ontoCommit?: string;
  commits?: RebaseCommit[];
  onRebaseStart?: (commits: RebaseCommit[]) => void;
  onRebaseAbort?: () => void;
  onRebaseContinue?: () => void;
  onResolveConflicts?: () => void;
  onClose?: () => void;
}

/** Action configuration with display info */
interface ActionConfig {
  value: RebaseAction;
  label: string;
  shortLabel: string;
  iconName: string;
  color: string;
  description: string;
}

const REBASE_ACTIONS: ActionConfig[] = [
  {
    value: "pick",
    label: "Pick",
    shortLabel: "pick",
    iconName: "check",
    color: "var(--cortex-success)",
    description: "Use commit as-is"
  },
  {
    value: "reword",
    label: "Reword",
    shortLabel: "reword",
    iconName: "pen",
    color: "var(--cortex-info)",
    description: "Edit commit message"
  },
  {
    value: "edit",
    label: "Edit",
    shortLabel: "edit",
    iconName: "stop",
    color: "var(--cortex-warning)",
    description: "Stop for amending"
  },
  {
    value: "squash",
    label: "Squash",
    shortLabel: "squash",
    iconName: "code-merge",
    color: "var(--cortex-info)",
    description: "Meld into previous commit"
  },
  {
    value: "fixup",
    label: "Fixup",
    shortLabel: "fixup",
    iconName: "turn-down-right",
    color: "var(--cortex-error)",
    description: "Like squash, discard message"
  },
  {
    value: "drop",
    label: "Drop",
    shortLabel: "drop",
    iconName: "trash",
    color: "var(--cortex-error)",
    description: "Remove commit"
  }
];

export function InteractiveRebase(props: InteractiveRebaseProps) {
  const [commits, setCommits] = createSignal<RebaseCommit[]>([]);
  const [rebaseState, setRebaseState] = createSignal<RebaseState>("idle");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [conflict, setConflict] = createSignal<RebaseConflict | null>(null);
  const [currentStep, setCurrentStep] = createSignal(0);
  const [totalSteps, setTotalSteps] = createSignal(0);
  const [editingMessage, setEditingMessage] = createSignal<string | null>(null);
  const [editedMessage, setEditedMessage] = createSignal("");
  const [draggedIndex, setDraggedIndex] = createSignal<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);
  const [openDropdown, setOpenDropdown] = createSignal<string | null>(null);
  const [pausedCommit, setPausedCommit] = createSignal<RebaseCommit | null>(null);

  onMount(() => {
    if (props.commits && props.commits.length > 0) {
      setCommits(props.commits);
    } else {
      fetchCommitsForRebase();
    }

    checkRebaseStatus();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-dropdown]")) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  createEffect(() => {
    if (props.commits) {
      setCommits(props.commits);
    }
  });

  const fetchCommitsForRebase = async () => {
    setLoading(true);
    setError(null);
    try {
      const projectPath = getProjectPath();
      const onto = props.ontoCommit || "HEAD~10";
      
      const data = await gitRebaseCommits(projectPath, onto);
      const rebaseCommits: RebaseCommit[] = data.map((c: ApiRebaseCommit, idx: number) => ({
        hash: c.hash,
        shortHash: c.shortHash || c.hash.slice(0, 7),
        message: c.message,
        author: c.author,
        email: "",
        date: c.date,
        action: "pick" as RebaseAction,
        originalIndex: idx
      }));
      setCommits(rebaseCommits);
    } catch (err) {
      setError("Failed to fetch commits for rebase");
      console.error("Failed to fetch commits:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkRebaseStatus = async () => {
    try {
      const projectPath = getProjectPath();
      
      const data = await gitRebaseStatus(projectPath);
      if (data.inProgress) {
        batch(() => {
          setRebaseState(data.hasConflicts ? "paused-conflict" : "in-progress");
          setCurrentStep(data.total - data.remaining);
          setTotalSteps(data.total);
          
          if (data.hasConflicts && data.conflictFiles.length > 0) {
            setConflict({
              files: data.conflictFiles,
              currentCommit: data.currentCommit || "",
              message: "Conflict detected"
            });
          }
          
          if (data.pausedCommit) {
            setPausedCommit({
              hash: data.pausedCommit.hash,
              shortHash: data.pausedCommit.shortHash,
              message: data.pausedCommit.message,
              author: data.pausedCommit.author,
              email: "",
              date: data.pausedCommit.date,
              action: "pick",
              originalIndex: 0
            });
            if (!data.hasConflicts) {
              setRebaseState("paused-edit");
            }
          }
        });
      }
    } catch (err) {
      console.error("Failed to check rebase status:", err);
    }
  };

  const setCommitAction = (hash: string, action: RebaseAction) => {
    setCommits(prev => prev.map(c => 
      c.hash === hash ? { ...c, action } : c
    ));
    setOpenDropdown(null);
  };

  const moveCommit = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    setCommits(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
  };

  const handleDragStart = (e: DragEvent, index: number) => {
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = draggedIndex();
    if (fromIndex !== null && fromIndex !== toIndex) {
      moveCommit(fromIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const startMessageEdit = (commit: RebaseCommit) => {
    setEditingMessage(commit.hash);
    setEditedMessage(commit.message);
  };

  const saveMessageEdit = (hash: string) => {
    const newMessage = editedMessage().trim();
    if (newMessage) {
      setCommits(prev => prev.map(c =>
        c.hash === hash ? { ...c, message: newMessage } : c
      ));
    }
    setEditingMessage(null);
    setEditedMessage("");
  };

  const cancelMessageEdit = () => {
    setEditingMessage(null);
    setEditedMessage("");
  };

  const startRebase = async () => {
    const commitList = commits();
    if (commitList.length === 0) return;

    setRebaseState("preparing");
    setError(null);

    try {
      const projectPath = getProjectPath();
      const onto = props.ontoCommit || `HEAD~${commitList.length}`;

      const todoList: ApiRebaseAction[] = commitList.map(c => ({
        action: c.action,
        hash: c.hash
      }));

      const data = await gitRebaseStart(projectPath, onto, todoList);
      batch(() => {
        setTotalSteps(commitList.filter(c => c.action !== "drop").length);
        setCurrentStep(0);
        
        if (!data.inProgress) {
          setRebaseState("idle");
          props.onClose?.();
        } else if (data.hasConflicts) {
          setRebaseState("paused-conflict");
          setConflict({
            files: data.conflictFiles || [],
            currentCommit: data.currentCommit || "",
            message: "Conflicts detected"
          });
        } else if (data.pausedCommit) {
          setRebaseState("paused-edit");
          setPausedCommit({
            hash: data.pausedCommit.hash,
            shortHash: data.pausedCommit.shortHash,
            message: data.pausedCommit.message,
            author: data.pausedCommit.author,
            email: "",
            date: data.pausedCommit.date,
            action: "pick",
            originalIndex: 0
          });
        } else {
          setRebaseState("in-progress");
        }
      });
      props.onRebaseStart?.(commitList);
    } catch (err) {
      setError("Failed to start rebase");
      setRebaseState("idle");
      console.error("Failed to start rebase:", err);
    }
  };

  const continueRebase = async () => {
    setRebaseState("in-progress");
    setError(null);

    try {
      const projectPath = getProjectPath();
      
      const data = await gitRebaseContinue(projectPath);
      batch(() => {
        setCurrentStep(data.total - data.remaining);
        setConflict(null);
        setPausedCommit(null);

        if (!data.inProgress) {
          setRebaseState("idle");
          props.onClose?.();
        } else if (data.hasConflicts) {
          setRebaseState("paused-conflict");
          setConflict({
            files: data.conflictFiles || [],
            currentCommit: data.currentCommit || "",
            message: "Conflicts detected"
          });
        } else if (data.pausedCommit) {
          setRebaseState("paused-edit");
          setPausedCommit({
            hash: data.pausedCommit.hash,
            shortHash: data.pausedCommit.shortHash,
            message: data.pausedCommit.message,
            author: data.pausedCommit.author,
            email: "",
            date: data.pausedCommit.date,
            action: "pick",
            originalIndex: 0
          });
        }
      });
      props.onRebaseContinue?.();
    } catch (err) {
      setError("Failed to continue rebase");
      await checkRebaseStatus();
      console.error("Failed to continue rebase:", err);
    }
  };

  const skipCommit = async () => {
    setRebaseState("in-progress");
    setError(null);

    try {
      const projectPath = getProjectPath();
      
      const data = await gitRebaseSkip(projectPath);
      batch(() => {
        setCurrentStep(data.total - data.remaining);
        setConflict(null);
        setPausedCommit(null);

        if (!data.inProgress) {
          setRebaseState("idle");
          props.onClose?.();
        } else if (data.hasConflicts) {
          setRebaseState("paused-conflict");
          setConflict({
            files: data.conflictFiles || [],
            currentCommit: data.currentCommit || "",
            message: "Conflicts detected"
          });
        } else if (data.pausedCommit) {
          setRebaseState("paused-edit");
          setPausedCommit({
            hash: data.pausedCommit.hash,
            shortHash: data.pausedCommit.shortHash,
            message: data.pausedCommit.message,
            author: data.pausedCommit.author,
            email: "",
            date: data.pausedCommit.date,
            action: "pick",
            originalIndex: 0
          });
        }
      });
    } catch (err) {
      setError("Failed to skip commit");
      await checkRebaseStatus();
      console.error("Failed to skip commit:", err);
    }
  };

  const abortRebase = async () => {
    setRebaseState("aborting");
    setError(null);

    try {
      const projectPath = getProjectPath();
      
      await gitRebaseAbort(projectPath);
      batch(() => {
        setRebaseState("idle");
        setConflict(null);
        setPausedCommit(null);
        setCurrentStep(0);
        setTotalSteps(0);
      });
      props.onRebaseAbort?.();
    } catch (err) {
      setError("Failed to abort rebase");
      await checkRebaseStatus();
      console.error("Failed to abort rebase:", err);
    }
  };

  const resolveConflicts = () => {
    props.onResolveConflicts?.();
  };

  const getActionConfig = (action: RebaseAction): ActionConfig => {
    return REBASE_ACTIONS.find(a => a.value === action) || REBASE_ACTIONS[0];
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

  const isRebaseActive = createMemo(() => {
    const state = rebaseState();
    return state !== "idle" && state !== "preparing";
  });

  const canStartRebase = createMemo(() => {
    return rebaseState() === "idle" && commits().length > 0 && !loading();
  });

  const progressPercent = createMemo(() => {
    const total = totalSteps();
    if (total === 0) return 0;
    return Math.round((currentStep() / total) * 100);
  });

  const CommitRow = (rowProps: { commit: RebaseCommit; index: number }) => {
    const actionConfig = () => getActionConfig(rowProps.commit.action);
    const isDragging = () => draggedIndex() === rowProps.index;
    const isDragOver = () => dragOverIndex() === rowProps.index;
    const isEditing = () => editingMessage() === rowProps.commit.hash;
    const isDropdownOpen = () => openDropdown() === rowProps.commit.hash;

    return (
      <div
        class={`group flex items-center gap-2 px-3 py-2 border-b transition-all ${
          isDragging() ? "opacity-50" : ""
        } ${isDragOver() ? "border-t-2 border-t-blue-500" : ""}`}
        style={{ "border-color": "var(--border-weak)" }}
        draggable={!isRebaseActive() && !isEditing()}
        onDragStart={(e) => handleDragStart(e, rowProps.index)}
        onDragOver={(e) => handleDragOver(e, rowProps.index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, rowProps.index)}
        onDragEnd={handleDragEnd}
      >
        {/* Drag handle */}
        <div
          class={`cursor-grab p-1 rounded transition-colors ${
            isRebaseActive() ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10"
          }`}
          title={isRebaseActive() ? "Cannot reorder during rebase" : "Drag to reorder"}
        >
          <Icon name="up-down-left-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
        </div>

        {/* Action selector */}
        <div class="relative shrink-0" data-dropdown>
          <button
            class={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
              isRebaseActive() ? "opacity-60 cursor-not-allowed" : "hover:bg-white/10"
            }`}
            style={{ 
              background: `${actionConfig().color}20`,
              color: actionConfig().color,
              "min-width": "80px"
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isRebaseActive()) {
                setOpenDropdown(isDropdownOpen() ? null : rowProps.commit.hash);
              }
            }}
            disabled={isRebaseActive()}
          >
            <Icon name={actionConfig().iconName} class="w-3.5 h-3.5" />
            {actionConfig().label}
            <Icon name="chevron-down" class="w-3 h-3 ml-auto" />
          </button>

          <Show when={isDropdownOpen()}>
            <div
              class="absolute left-0 top-full mt-1 z-20 w-48 rounded-md shadow-lg overflow-hidden"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border-weak)" }}
            >
              <For each={REBASE_ACTIONS}>
                {(action) => (
                  <button
                    class={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/10 ${
                      rowProps.commit.action === action.value ? "bg-white/5" : ""
                    }`}
                    onClick={() => setCommitAction(rowProps.commit.hash, action.value)}
                  >
                    <span style={{ color: action.color }}>
                      <Icon name={action.iconName} class="w-4 h-4" />
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm" style={{ color: "var(--text-base)" }}>
                        {action.label}
                      </div>
                      <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
                        {action.description}
                      </div>
                    </div>
                    <Show when={rowProps.commit.action === action.value}>
                      <Icon name="check" class="w-4 h-4 text-green-400 shrink-0" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Commit hash */}
        <span
          class="font-mono text-xs px-1.5 py-0.5 rounded shrink-0"
          style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
        >
          {rowProps.commit.shortHash}
        </span>

        {/* Commit message */}
        <Show when={!isEditing()}>
          <span
            class={`flex-1 text-sm truncate ${
              rowProps.commit.action === "drop" ? "line-through opacity-50" : ""
            }`}
            style={{ color: "var(--text-base)" }}
            title={rowProps.commit.message}
          >
            {rowProps.commit.message.split("\n")[0]}
          </span>
        </Show>

        <Show when={isEditing()}>
          <input
            type="text"
            class="flex-1 px-2 py-1 rounded text-sm outline-none"
            style={{
              background: "var(--surface-base)",
              color: "var(--text-base)",
              border: "1px solid var(--accent-primary)"
            }}
            value={editedMessage()}
            onInput={(e) => setEditedMessage(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                saveMessageEdit(rowProps.commit.hash);
              } else if (e.key === "Escape") {
                cancelMessageEdit();
              }
            }}
            autofocus
          />
        </Show>

        {/* Author */}
        <span
          class="text-xs shrink-0 max-w-24 truncate"
          style={{ color: "var(--text-weak)" }}
          title={rowProps.commit.author}
        >
          {rowProps.commit.author}
        </span>

        {/* Date */}
        <span
          class="text-xs shrink-0 w-16 text-right"
          style={{ color: "var(--text-weaker)" }}
        >
          {formatDate(rowProps.commit.date)}
        </span>

        {/* Edit message button */}
        <Show when={!isEditing() && !isRebaseActive()}>
          <button
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={() => startMessageEdit(rowProps.commit)}
            title="Edit message"
          >
            <Icon name="pen" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
          </button>
        </Show>

        <Show when={isEditing()}>
          <div class="flex items-center gap-1">
            <button
              class="p-1 rounded hover:bg-white/10 transition-colors"
              onClick={() => saveMessageEdit(rowProps.commit.hash)}
              title="Save"
            >
              <Icon name="check" class="w-4 h-4 text-green-400" />
            </button>
            <button
              class="p-1 rounded hover:bg-white/10 transition-colors"
              onClick={cancelMessageEdit}
              title="Cancel"
            >
              <Icon name="xmark" class="w-4 h-4 text-red-400" />
            </button>
          </div>
        </Show>
      </div>
    );
  };

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
          <Icon name="code-commit" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
          <div>
            <h2 class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
              Interactive Rebase
            </h2>
            <Show when={props.targetBranch || props.ontoCommit}>
              <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                {props.targetBranch ? `Branch: ${props.targetBranch}` : `Onto: ${props.ontoCommit}`}
              </p>
            </Show>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Show when={!isRebaseActive()}>
            <button
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              onClick={fetchCommitsForRebase}
              disabled={loading()}
              title="Refresh commits"
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

      {/* Status banner for active rebase */}
      <Show when={isRebaseActive()}>
        <div
          class="px-4 py-3 border-b shrink-0"
          style={{
            background: rebaseState() === "paused-conflict"
              ? "rgba(248, 81, 73, 0.1)"
              : rebaseState() === "paused-edit"
                ? "rgba(240, 136, 62, 0.1)"
                : "rgba(88, 166, 255, 0.1)",
            "border-color": "var(--border-weak)"
          }}
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Show when={rebaseState() === "paused-conflict"}>
                <Icon name="triangle-exclamation" class="w-5 h-5 text-red-400" />
                <div>
                  <div class="text-sm font-medium text-red-400">Conflicts Detected</div>
                  <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                    {conflict()?.files.length || 0} file(s) with conflicts
                  </div>
                </div>
              </Show>

              <Show when={rebaseState() === "paused-edit"}>
                <Icon name="stop" class="w-5 h-5 text-orange-400" />
                <div>
                  <div class="text-sm font-medium text-orange-400">Rebase Paused</div>
                  <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                    Stopped for editing at {pausedCommit()?.shortHash || "commit"}
                  </div>
                </div>
              </Show>

              <Show when={rebaseState() === "in-progress" || rebaseState() === "completing"}>
                <Icon name="spinner" class="w-5 h-5 text-blue-400 animate-spin" />
                <div>
                  <div class="text-sm font-medium text-blue-400">Rebase In Progress</div>
                  <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                    Step {currentStep()} of {totalSteps()}
                  </div>
                </div>
              </Show>

              <Show when={rebaseState() === "aborting"}>
                <Icon name="spinner" class="w-5 h-5 text-red-400 animate-spin" />
                <div>
                  <div class="text-sm font-medium text-red-400">Aborting Rebase...</div>
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
                      background: rebaseState() === "paused-conflict"
                        ? "var(--cortex-error)"
                        : rebaseState() === "paused-edit"
                          ? "var(--cortex-warning)"
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
          <Show when={rebaseState() === "paused-conflict" && conflict()}>
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

      {/* Instructions panel */}
      <Show when={!isRebaseActive() && commits().length > 0}>
        <div
          class="px-4 py-2 border-b text-xs"
          style={{ background: "var(--surface-base)", "border-color": "var(--border-weak)", color: "var(--text-weak)" }}
        >
          <span class="font-medium">Instructions:</span> Drag rows to reorder commits. Select an action for each commit. 
          Use <span class="font-mono px-1 py-0.5 rounded" style={{ background: "var(--surface-active)" }}>squash</span> or 
          <span class="font-mono px-1 py-0.5 rounded ml-1" style={{ background: "var(--surface-active)" }}>fixup</span> to combine commits.
        </div>
      </Show>

      {/* Commits list */}
      <div class="flex-1 overflow-auto">
        <Show when={loading()}>
          <div class="flex items-center justify-center h-32">
            <Icon name="spinner" class="w-5 h-5 animate-spin" style={{ color: "var(--text-weak)" }} />
          </div>
        </Show>

        <Show when={!loading() && commits().length === 0}>
          <div class="flex flex-col items-center justify-center h-32 gap-2">
            <Icon name="code-commit" class="w-8 h-8" style={{ color: "var(--text-weaker)" }} />
            <span style={{ color: "var(--text-weak)" }}>No commits to rebase</span>
          </div>
        </Show>

        <Show when={!loading() && commits().length > 0}>
          <div>
            <For each={commits()}>
              {(commit, index) => (
                <CommitRow commit={commit} index={index()} />
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Action buttons footer */}
      <div
        class="px-4 py-3 border-t shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <Show when={!isRebaseActive()}>
          <div class="flex items-center justify-between">
            <div class="text-xs" style={{ color: "var(--text-weak)" }}>
              {commits().length} commit{commits().length !== 1 ? "s" : ""} selected
              <Show when={commits().filter(c => c.action === "drop").length > 0}>
                <span class="ml-2 text-red-400">
                  ({commits().filter(c => c.action === "drop").length} will be dropped)
                </span>
              </Show>
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
                disabled={!canStartRebase()}
                onClick={startRebase}
              >
                <Show when={rebaseState() === "preparing"}>
                  <Icon name="spinner" class="w-4 h-4 animate-spin" />
                  Starting...
                </Show>
                <Show when={rebaseState() !== "preparing"}>
                  <Icon name="play" class="w-4 h-4" />
                  Start Rebase
                </Show>
              </button>
            </div>
          </div>
        </Show>

        <Show when={isRebaseActive()}>
          <div class="flex items-center justify-between">
            <button
              class="flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors hover:bg-red-500/20"
              style={{ color: "var(--cortex-error)" }}
              onClick={abortRebase}
              disabled={rebaseState() === "aborting"}
            >
              <Icon name="xmark" class="w-4 h-4" />
              Abort Rebase
            </button>

            <div class="flex items-center gap-2">
              <Show when={rebaseState() === "paused-conflict"}>
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
                  Skip Commit
                </button>
              </Show>

              <button
                class="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: "var(--accent-primary)", color: "white" }}
                onClick={continueRebase}
                disabled={rebaseState() === "in-progress" || rebaseState() === "completing"}
              >
                <Show when={rebaseState() === "in-progress" || rebaseState() === "completing"}>
                  <Icon name="spinner" class="w-4 h-4 animate-spin" />
                  Processing...
                </Show>
                <Show when={rebaseState() === "paused-conflict" || rebaseState() === "paused-edit"}>
                  <Icon name="play" class="w-4 h-4" />
                  Continue Rebase
                </Show>
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default InteractiveRebase;


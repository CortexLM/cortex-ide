import { createSignal, For, Show, onMount, onCleanup, createMemo, createEffect, on, batch } from "solid-js";
import { Icon } from "../ui/Icon";
import { VirtualList } from "../ui/VirtualList";
import { CommitGraph, type Commit } from "./CommitGraph";
import { StashPanel } from "./StashPanel";
import { TagManager } from "./TagManager";
import { IncomingOutgoingSection, IncomingOutgoingView } from "./IncomingOutgoingView";
import { GitLFSManager } from "./GitLFSManager";
import { WorktreeManager } from "./WorktreeManager";
import { useMultiRepo, type GitFile } from "@/context/MultiRepoContext";
import { useSettings } from "@/context/SettingsContext";
import { gitLog, gitDiff, gitSubmoduleList, gitSubmoduleInit, gitSubmoduleUpdate, gitIsGpgConfigured, gitInit, gitTagList, type SubmoduleInfo } from "../../utils/tauri-api";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  Button,
  IconButton,
  Input,
  Textarea,
  Badge,
  Text,
  ListItem,
} from "@/components/ui";
import { tokens } from '@/design-system/tokens';
// Note: Box, Flex, VStack, HStack from '@/design-system/primitives/Flex' prepared for layout refactoring

// Threshold for virtualizing lists (render all if below this)
const VIRTUALIZE_THRESHOLD = 100;
// Height of each file item in the list
const FILE_ITEM_HEIGHT = 24;

interface FileDiffData {
  path: string;
  hunks: Array<{
    header: string;
    lines: Array<{
      type: "context" | "addition" | "deletion" | "header";
      content: string;
      oldLineNumber?: number;
      newLineNumber?: number;
    }>;
  }>;
  additions: number;
  deletions: number;
}

interface ErrorState {
  message: string;
  type: "error" | "warning";
}

type PanelView = "changes" | "history" | "stashes" | "tags" | "submodules" | "worktrees" | "sync" | "lfs";

export function GitPanel() {
  const multiRepo = useMultiRepo();
  const settings = useSettings();
  const workspace = useWorkspace();

  // Git settings from SettingsContext
  const gitSettings = () => settings.effectiveSettings().git;

  const [activeView, setActiveView] = createSignal<PanelView>("changes");
  const [commitMessage, setCommitMessage] = createSignal("");
  const [operationLoading, setOperationLoading] = createSignal<string | null>(null);
  const [showBranchSelector, setShowBranchSelector] = createSignal(false);
  const [showRepoSelector, setShowRepoSelector] = createSignal(false);
  const [stagedExpanded, setStagedExpanded] = createSignal(true);
  const [unstagedExpanded, setUnstagedExpanded] = createSignal(true);
  const [conflictsExpanded, setConflictsExpanded] = createSignal(true);
  const [selectedFile, setSelectedFile] = createSignal<GitFile | null>(null);
  const [fileDiff, setFileDiff] = createSignal<FileDiffData | null>(null);
  const [diffLoading, setDiffLoading] = createSignal(false);
  const [commits, setCommits] = createSignal<Commit[]>([]);
  const [error, setError] = createSignal<ErrorState | null>(null);
  const [showCreateBranch, setShowCreateBranch] = createSignal(false);
  const [newBranchName, setNewBranchName] = createSignal("");
  const [submodules, setSubmodules] = createSignal<SubmoduleInfo[]>([]);
  const [submodulesLoading, setSubmodulesLoading] = createSignal(false);
const [signCommits, setSignCommits] = createSignal(false);
  const [gpgConfigured, setGpgConfigured] = createSignal(false);
  const [tagCount, setTagCount] = createSignal(0);

  // Commit message validation settings (defaults as per conventional commit guidelines)
  const INPUT_VALIDATION_SUBJECT_LENGTH = 50;
  const INPUT_VALIDATION_LENGTH = 72;

  // Commit message validation state
  const commitValidation = createMemo(() => {
    const message = commitMessage();
    const lines = message.split('\n');
    const firstLine = lines[0] || '';
    const firstLineLength = firstLine.length;
    
    // Check subject line (first line)
    const subjectExceedsLimit = firstLineLength > INPUT_VALIDATION_SUBJECT_LENGTH;
    
    // Also check first line against body limit
    const anyLineExceedsBodyLimit = lines.some(line => line.length > INPUT_VALIDATION_LENGTH);
    
    const hasWarning = subjectExceedsLimit || anyLineExceedsBodyLimit;
    
    let warningMessage = '';
    if (subjectExceedsLimit && anyLineExceedsBodyLimit) {
      warningMessage = `Subject exceeds ${INPUT_VALIDATION_SUBJECT_LENGTH} chars, line exceeds ${INPUT_VALIDATION_LENGTH} chars`;
    } else if (subjectExceedsLimit) {
      warningMessage = `Subject line should be ≤${INPUT_VALIDATION_SUBJECT_LENGTH} characters`;
    } else if (anyLineExceedsBodyLimit) {
      warningMessage = `Lines should be ≤${INPUT_VALIDATION_LENGTH} characters`;
    }
    
    return {
      firstLineLength,
      subjectLimit: INPUT_VALIDATION_SUBJECT_LENGTH,
      bodyLimit: INPUT_VALIDATION_LENGTH,
      subjectExceedsLimit,
      bodyLineExceedsLimit: anyLineExceedsBodyLimit,
      hasWarning,
      warningMessage,
    };
  });

  // Derived state from active repository
  const activeRepo = () => multiRepo.activeRepository();
  const branch = () => activeRepo()?.branch || null;
  const branches = () => activeRepo()?.branches || [];
  
  /** Extended branch interface that may include commit date from backend */
  interface GitBranchWithDate {
    name: string;
    current: boolean;
    remote?: string;
    upstream?: string;
    ahead?: number;
    behind?: number;
    lastCommit?: string;
    lastCommitDate?: number; // Optional timestamp from backend
  }
  
  // Sort branches according to branchSortOrder setting
  const sortedBranches = createMemo(() => {
    const allBranches = branches();
    const sortOrder = gitSettings()?.branchSortOrder ?? "alphabetically";
    
    return [...allBranches].sort((a, b) => {
      // Current branch always first
      if (a.current) return -1;
      if (b.current) return 1;
      
      if (sortOrder === "alphabetically") {
        return a.name.localeCompare(b.name);
      } else {
        // committerDate - sort by most recent (if no date info available, fall back to alphabetical)
        // Cast to extended interface that may include lastCommitDate from backend
        const branchA = a as GitBranchWithDate;
        const branchB = b as GitBranchWithDate;
        const dateA = branchA.lastCommitDate ?? 0;
        const dateB = branchB.lastCommitDate ?? 0;
        if (dateA !== dateB) {
          return dateB - dateA; // Most recent first
        }
        return a.name.localeCompare(b.name);
      }
    });
  });
  const stagedFiles = () => activeRepo()?.stagedFiles || [];
  const unstagedFiles = () => activeRepo()?.unstagedFiles || [];
  const conflictFiles = () => activeRepo()?.conflictFiles || [];
  const loading = () => activeRepo()?.status === "loading" || multiRepo.state.isLoading;
  const repositories = () => multiRepo.repositories();

  onMount(() => {
    // Initial detection and refresh
    multiRepo.detectRepositories();

    // Git command event listeners
    const handleShowIncoming = () => {
      setActiveView("sync");
    };
    
    const handleShowOutgoing = () => {
      setActiveView("sync");
    };
    
    const handleFetchAndShow = async () => {
      await gitFetch();
      setActiveView("sync");
    };
    
    const handleSync = async () => {
      const repo = activeRepo();
      if (repo) {
        setOperationLoading("sync");
        try {
          await multiRepo.pull(repo.id);
          await multiRepo.push(repo.id);
        } catch (err) {
          showError("Sync failed");
          console.error("Sync failed:", err);
        } finally {
          setOperationLoading(null);
        }
      }
    };

    // Worktree event handlers
    const handleWorktreeList = () => {
      setActiveView("worktrees");
    };
    
    const handleWorktreeAdd = () => {
      setActiveView("worktrees");
      // Dispatch event to open add dialog in WorktreeManager
      window.dispatchEvent(new CustomEvent("worktree:open-add-dialog"));
    };
    
    const handleWorktreeRemove = () => {
      setActiveView("worktrees");
    };
    
    // LFS event handlers
    const handleLFSStatus = () => {
      setActiveView("lfs");
    };
    
    const handleLFSTrack = () => {
      setActiveView("lfs");
      // Dispatch event to open track dialog in GitLFSManager
      window.dispatchEvent(new CustomEvent("lfs:open-track-dialog"));
    };
    
    const handleLFSFetch = async () => {
      setActiveView("lfs");
      // Dispatch event to trigger fetch in GitLFSManager
      window.dispatchEvent(new CustomEvent("lfs:fetch"));
    };
    
    const handleLFSPull = async () => {
      setActiveView("lfs");
      // Dispatch event to trigger pull in GitLFSManager
      window.dispatchEvent(new CustomEvent("lfs:pull"));
    };
    
    const handleLFSPush = async () => {
      setActiveView("lfs");
      // Dispatch event to trigger push in GitLFSManager
      window.dispatchEvent(new CustomEvent("lfs:push"));
    };
    
    // Tags event handlers
    const handleTagsList = () => {
      setActiveView("tags");
    };
    
    const handleTagsCreate = () => {
      setActiveView("tags");
      // Dispatch event to open create dialog in TagManager
      window.dispatchEvent(new CustomEvent("tags:open-create-dialog"));
    };

    window.addEventListener("git:show-incoming", handleShowIncoming);
    window.addEventListener("git:show-outgoing", handleShowOutgoing);
    window.addEventListener("git:fetch-and-show", handleFetchAndShow);
    window.addEventListener("git:sync", handleSync);
    
    // Worktree events
    window.addEventListener("git:worktree-list", handleWorktreeList);
    window.addEventListener("git:worktree-add", handleWorktreeAdd);
    window.addEventListener("git:worktree-remove", handleWorktreeRemove);
    
    // LFS events
    window.addEventListener("git:lfs-status", handleLFSStatus);
    window.addEventListener("git:lfs-track", handleLFSTrack);
    window.addEventListener("git:lfs-fetch", handleLFSFetch);
    window.addEventListener("git:lfs-pull", handleLFSPull);
    window.addEventListener("git:lfs-push", handleLFSPush);
    
    // Tags events
    window.addEventListener("git:tags-list", handleTagsList);
    window.addEventListener("git:tags-create", handleTagsCreate);

    onCleanup(() => {
      window.removeEventListener("git:show-incoming", handleShowIncoming);
      window.removeEventListener("git:show-outgoing", handleShowOutgoing);
      window.removeEventListener("git:fetch-and-show", handleFetchAndShow);
      window.removeEventListener("git:sync", handleSync);
      
      // Worktree events
      window.removeEventListener("git:worktree-list", handleWorktreeList);
      window.removeEventListener("git:worktree-add", handleWorktreeAdd);
      window.removeEventListener("git:worktree-remove", handleWorktreeRemove);
      
      // LFS events
      window.removeEventListener("git:lfs-status", handleLFSStatus);
      window.removeEventListener("git:lfs-track", handleLFSTrack);
      window.removeEventListener("git:lfs-fetch", handleLFSFetch);
      window.removeEventListener("git:lfs-pull", handleLFSPull);
      window.removeEventListener("git:lfs-push", handleLFSPush);
      
      // Tags events
      window.removeEventListener("git:tags-list", handleTagsList);
      window.removeEventListener("git:tags-create", handleTagsCreate);
    });
  });

  // Load minimal data when repo changes (VS Code lazy loading pattern)
  createEffect(on(activeRepo, (repo) => {
    if (!repo) {
      batch(() => {
        setGpgConfigured(false);
        setTagCount(0);
        setCommits([]);
        setSubmodules([]);
      });
      return;
    }
    
    // Only load GPG config immediately (needed for commit UI)
    gitIsGpgConfigured(repo.path)
      .then(configured => setGpgConfigured(configured))
      .catch(() => setGpgConfigured(false));
      
    // Other data loads on-demand when switching to their tabs
  }, { defer: true }));
  
  // Load data on-demand when switching tabs (lazy loading)
  createEffect(on(activeView, (view) => {
    const repo = activeRepo();
    if (!repo) return;
    
    switch (view) {
      case "history":
        // Only load commits if not already loaded or if empty
        if (commits().length === 0) {
          fetchCommits(repo.path);
        }
        break;
      case "submodules":
        // Only load submodules if not already loaded
        if (submodules().length === 0) {
          fetchSubmodules(repo.path);
        }
        break;
      case "tags":
        // Always refresh tag count when switching to tags view
        fetchTagCount(repo.path);
        break;
      case "changes":
        // Refresh status when going back to changes view
        // (handled by MultiRepoContext)
        break;
    }
  }, { defer: true }));

  const fetchTagCount = async (repoPath: string) => {
    try {
      const tags = await gitTagList(repoPath);
      setTagCount(tags.length);
    } catch (err) {
      console.error("Failed to fetch tag count:", err);
      setTagCount(0);
    }
  };

  const clearError = () => setError(null);

  const showError = (message: string, type: "error" | "warning" = "error") => {
    setError({ message, type });
    setTimeout(clearError, 5000);
  };

  const fetchCommits = async (repoPath: string) => {
    try {
      const rawCommits = await gitLog(repoPath, 100);
      // Convert GitCommit to Commit interface for CommitGraph compatibility
      const commits: Commit[] = (rawCommits || []).map(c => ({
        hash: c.hash,
        shortHash: c.shortHash,
        message: c.message,
        author: c.author,
        email: c.authorEmail,
        date: c.date,
        timestamp: new Date(c.date).getTime(),
        parents: c.parents,
        refs: [],
        isMerge: c.parents.length > 1,
      }));
      setCommits(commits);
    } catch (err) {
      console.error("Failed to fetch commits:", err);
    }
  };

  const fetchSubmodules = async (repoPath: string) => {
    setSubmodulesLoading(true);
    try {
      const subs = await gitSubmoduleList(repoPath);
      setSubmodules(subs || []);
    } catch (err) {
      console.error("Failed to fetch submodules:", err);
      setSubmodules([]);
    } finally {
      setSubmodulesLoading(false);
    }
  };

  const initSubmodule = async (submodulePath?: string) => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading(`init-submodule-${submodulePath || "all"}`);
    try {
      await gitSubmoduleInit(repo.path, submodulePath);
      await fetchSubmodules(repo.path);
    } catch (err) {
      showError("Failed to initialize submodule");
      console.error("Failed to init submodule:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const updateSubmodules = async (init: boolean = false, recursive: boolean = false) => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading("update-submodules");
    try {
      await gitSubmoduleUpdate(repo.path, init, recursive);
      await fetchSubmodules(repo.path);
    } catch (err) {
      showError("Failed to update submodules");
      console.error("Failed to update submodules:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  /** Extended FileDiffData that can hold raw diff text before parsing */
  interface FileDiffDataWithRaw extends FileDiffData {
    rawDiff?: string;
  }

  const fetchFileDiff = async (file: GitFile) => {
    const repo = activeRepo();
    if (!repo) return;

    setDiffLoading(true);
    try {
      const diff = await gitDiff(repo.path, file.path, file.staged);
      // Store raw diff text - will be parsed by the diff view component
      const diffData: FileDiffDataWithRaw = {
        path: file.path,
        hunks: [],
        additions: 0,
        deletions: 0,
        rawDiff: diff,
      };
      setFileDiff(diffData);
    } catch (err) {
      console.error("Failed to fetch diff:", err);
    } finally {
      setDiffLoading(false);
    }
  };

  const handleFileSelect = (file: GitFile) => {
    setSelectedFile(file);
    fetchFileDiff(file);
  };

  const stageFile = async (path: string) => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading(`stage-${path}`);
    try {
      await multiRepo.stageFiles(repo.id, [path]);
    } catch (err) {
      showError("Failed to stage file");
      console.error("Failed to stage file:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const unstageFile = async (path: string) => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading(`unstage-${path}`);
    try {
      await multiRepo.unstageFiles(repo.id, [path]);
    } catch (err) {
      showError("Failed to unstage file");
      console.error("Failed to unstage file:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const stageAll = async () => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading("stage-all");
    try {
      await multiRepo.stageAll(repo.id);
    } catch (err) {
      showError("Failed to stage all files");
      console.error("Failed to stage all:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const unstageAll = async () => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading("unstage-all");
    try {
      await multiRepo.unstageAll(repo.id);
    } catch (err) {
      showError("Failed to unstage all files");
      console.error("Failed to unstage all:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const discardChanges = async (path: string) => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading(`discard-${path}`);
    try {
      await multiRepo.discardChanges(repo.id, [path]);
    } catch (err) {
      showError("Failed to discard changes");
      console.error("Failed to discard changes:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const commit = async () => {
    const repo = activeRepo();
    const message = commitMessage().trim();
    if (!message || !repo || stagedFiles().length === 0) return;

    setOperationLoading("commit");
    try {
      const sign = gpgConfigured() && signCommits();
      const success = await multiRepo.commit(repo.id, message, sign || undefined);
      if (success) {
        setCommitMessage("");
        await fetchCommits(repo.path);
        
        // Apply postCommitCommand setting
        const postCommitAction = gitSettings()?.postCommitCommand ?? "none";
        if (postCommitAction === "push") {
          // Push after commit
          setOperationLoading("push");
          try {
            await multiRepo.push(repo.id);
          } catch (pushErr) {
            showError("Commit succeeded but push failed", "warning");
            console.error("Post-commit push failed:", pushErr);
          }
        } else if (postCommitAction === "sync") {
          // Sync (pull then push) after commit
          setOperationLoading("sync");
          try {
            await multiRepo.pull(repo.id);
            await multiRepo.push(repo.id);
          } catch (syncErr) {
            showError("Commit succeeded but sync failed", "warning");
            console.error("Post-commit sync failed:", syncErr);
          }
        }
      } else {
        showError("Failed to commit");
      }
    } catch (err) {
      showError("Failed to commit");
      console.error("Failed to commit:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const checkout = async (branchName: string) => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading("checkout");
    try {
      await multiRepo.checkout(repo.id, branchName);
      setShowBranchSelector(false);
    } catch (err) {
      showError("Failed to checkout branch");
      console.error("Failed to checkout:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const push = async () => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading("push");
    try {
      await multiRepo.push(repo.id);
    } catch (err) {
      showError("Failed to push");
      console.error("Failed to push:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const pull = async () => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading("pull");
    try {
      await multiRepo.pull(repo.id);
    } catch (err) {
      showError("Failed to pull");
      console.error("Failed to pull:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const gitFetch = async () => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading("fetch");
    try {
      await multiRepo.fetch(repo.id);
    } catch (err) {
      showError("Failed to fetch");
      console.error("Failed to fetch:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const createBranch = async (name: string, checkoutAfter: boolean = true) => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading("create-branch");
    try {
      await multiRepo.createBranch(repo.id, name, checkoutAfter);
      setShowBranchSelector(false);
    } catch (err) {
      showError("Failed to create branch");
      console.error("Failed to create branch:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const deleteBranch = async (name: string, force: boolean = false) => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading("delete-branch");
    try {
      await multiRepo.deleteBranch(repo.id, name, force);
    } catch (err) {
      showError("Failed to delete branch");
      console.error("Failed to delete branch:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const mergeBranch = async (branchName: string) => {
    const repo = activeRepo();
    if (!repo) return;

    setOperationLoading("merge");
    try {
      const result = await multiRepo.mergeBranch(repo.id, branchName);
      if (result.hasConflicts) {
        showError("Merge completed with conflicts - resolve them before committing", "warning");
      }
    } catch (err) {
      showError("Failed to merge branch");
      console.error("Failed to merge branch:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  // Cross-repo operations
  const fetchAllRepos = async () => {
    setOperationLoading("fetch-all");
    try {
      await multiRepo.executeCrossRepoOperation("fetch-all");
    } catch (err) {
      showError("Failed to fetch all repositories");
    } finally {
      setOperationLoading(null);
    }
  };

  const pullAllRepos = async () => {
    setOperationLoading("pull-all");
    try {
      await multiRepo.executeCrossRepoOperation("pull-all");
    } catch (err) {
      showError("Failed to pull all repositories");
    } finally {
      setOperationLoading(null);
    }
  };

  const pushAllRepos = async () => {
    setOperationLoading("push-all");
    try {
      await multiRepo.executeCrossRepoOperation("push-all");
    } catch (err) {
      showError("Failed to push all repositories");
    } finally {
      setOperationLoading(null);
    }
  };

  const currentBranchInfo = createMemo(() => branches().find(b => b.current));

  // Initialize a new repository in the current workspace folder
  const initializeRepository = async () => {
    const folders = workspace.folders();
    if (folders.length === 0) {
      showError("No folder open. Open a folder first to initialize a repository.");
      return;
    }

    const folderPath = folders[0].path;
    setOperationLoading("init");
    
    try {
      await gitInit(folderPath, "main");
      // Re-detect repositories after initialization
      await multiRepo.detectRepositories();
    } catch (err) {
      showError(`Failed to initialize repository: ${err}`);
      console.error("Failed to initialize repository:", err);
    } finally {
      setOperationLoading(null);
    }
  };

  const getStatusBadge = (status: string): { letter: string; variant: "success" | "warning" | "error" | "default" } => {
    switch (status) {
      case "modified":
        return { letter: "M", variant: "warning" };
      case "added":
        return { letter: "A", variant: "success" };
      case "deleted":
        return { letter: "D", variant: "error" };
      case "untracked":
        return { letter: "U", variant: "success" };
      case "renamed":
        return { letter: "R", variant: "success" };
      case "conflict":
        return { letter: "!", variant: "error" };
      default:
        return { letter: "?", variant: "default" };
    }
  };

  const getFileName = (path: string): string => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  const getFileDir = (path: string): string => {
    const parts = path.split(/[/\\]/);
    if (parts.length <= 1) return "";
    return parts.slice(0, -1).join("/");
  };

  const getRepoSummary = () => multiRepo.getSummary();

  const FileItem = (props: { 
    file: GitFile; 
    onStage?: () => void; 
    onUnstage?: () => void;
    onDiscard?: () => void;
  }) => {
    const badge = () => getStatusBadge(props.file.status);
    const isSelected = () => selectedFile()?.path === props.file.path;
    const isOperating = () => 
      operationLoading() === `stage-${props.file.path}` || 
      operationLoading() === `unstage-${props.file.path}` ||
      operationLoading() === `discard-${props.file.path}`;

    return (
      <ListItem
        icon={<Icon name="file" size={14} />}
        label={getFileName(props.file.path)}
        description={getFileDir(props.file.path) || undefined}
        selected={isSelected()}
        onClick={() => handleFileSelect(props.file)}
        iconRight={
          <div style={{ display: "flex", "align-items": "center", gap: "2px" }}>
            <Show when={isOperating()}>
              <Icon name="spinner" size={14} style={{ animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
            </Show>
            
            <Show when={!isOperating()}>
              <Show when={props.onDiscard}>
                <IconButton
                  size="sm"
                  tooltip="Discard changes"
                  onClick={(e) => { e.stopPropagation(); props.onDiscard?.(); }}
                >
                  <Icon name="trash" style={{ color: tokens.colors.semantic.error }} />
                </IconButton>
              </Show>
              
              <Show when={props.onUnstage}>
                <IconButton
                  size="sm"
                  tooltip="Unstage"
                  onClick={(e) => { e.stopPropagation(); props.onUnstage?.(); }}
                >
                  <Icon name="minus" />
                </IconButton>
              </Show>
              
              <Show when={props.onStage}>
                <IconButton
                  size="sm"
                  tooltip="Stage"
                  onClick={(e) => { e.stopPropagation(); props.onStage?.(); }}
                >
                  <Icon name="plus" />
                </IconButton>
              </Show>
            </Show>

            <Badge variant={badge().variant} size="sm">
              {badge().letter}
            </Badge>
          </div>
        }
      />
    );
  };

  const SectionHeader = (props: {
    title: string;
    count: number;
    expanded: boolean;
    onToggle: () => void;
    action?: { label: string; onClick: () => void };
    loading?: boolean;
  }) => (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        height: "28px",
        padding: "0 12px",
        cursor: "pointer",
        "user-select": "none",
        transition: "background var(--cortex-transition-fast)",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      onClick={props.onToggle}
    >
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
        {props.expanded ? (
          <Icon name="chevron-down" size={12} style={{ color: tokens.colors.icon.default }} />
        ) : (
          <Icon name="chevron-right" size={12} style={{ color: tokens.colors.icon.default }} />
        )}
        <Text style={{
          "font-size": "11px",
          "font-weight": "600",
          "text-transform": "uppercase",
          "letter-spacing": "0.5px",
          color: tokens.colors.text.muted,
        }}>
          {props.title}
        </Text>
        <Badge variant="default" size="sm">
          {props.count}
        </Badge>
      </div>
      <Show when={props.action && props.count > 0}>
        <Button
          variant="ghost"
          size="sm"
          loading={props.loading}
          onClick={(e) => { e.stopPropagation(); props.action?.onClick(); }}
          style={{ "font-size": "10px", height: "20px", padding: "0 6px" }}
        >
          {props.action?.label}
        </Button>
      </Show>
    </div>
  );

  const InlineDiffPreview = () => {
    const diff = fileDiff();
    if (!diff) return null;

    return (
      <div style={{ "border-top": `1px solid ${tokens.colors.border.divider}` }}>
        <div 
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: `0 ${tokens.spacing.lg}`,
            height: "28px",
            background: tokens.colors.surface.panel,
          }}
        >
          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
            <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.primary }}>
              {selectedFile()?.path}
            </Text>
            <Text style={{ "font-size": "10px", color: tokens.colors.semantic.success }}>+{diff.additions}</Text>
            <Text style={{ "font-size": "10px", color: tokens.colors.semantic.error }}>-{diff.deletions}</Text>
          </div>
          <IconButton
            size="sm"
            tooltip="Close diff"
            onClick={() => { setSelectedFile(null); setFileDiff(null); }}
          >
            <Icon name="xmark" />
          </IconButton>
        </div>
        
        <div style={{ "max-height": "192px", overflow: "auto", "font-family": "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace", "font-size": "12px" }}>
          <For each={diff.hunks}>
            {(hunk) => (
              <div>
                <div 
                  style={{
                    padding: `0 ${tokens.spacing.lg}`,
                    position: "sticky",
                    top: "0",
                    background: `color-mix(in srgb, ${tokens.colors.semantic.primary} 10%, transparent)`,
                    color: tokens.colors.semantic.primary,
                  }}
                >
                  {hunk.header}
                </div>
                <For each={hunk.lines}>
                  {(line) => (
                    <div
                      style={{
                        display: "flex",
                        padding: `0 ${tokens.spacing.lg}`,
                        background: line.type === "addition" 
                          ? `color-mix(in srgb, ${tokens.colors.semantic.success} 15%, transparent)` 
                          : line.type === "deletion"
                            ? `color-mix(in srgb, ${tokens.colors.semantic.error} 15%, transparent)`
                            : "transparent"
                      }}
                    >
                      <Text 
                        style={{
                          width: "32px",
                          "flex-shrink": "0",
                          "text-align": "right",
                          "padding-right": tokens.spacing.md,
                          "user-select": "none",
                          color: tokens.colors.text.muted,
                        }}
                      >
                        {line.type !== "addition" ? line.oldLineNumber : ""}
                      </Text>
                      <Text 
                        style={{
                          width: "32px",
                          "flex-shrink": "0",
                          "text-align": "right",
                          "padding-right": tokens.spacing.md,
                          "user-select": "none",
                          color: tokens.colors.text.muted,
                        }}
                      >
                        {line.type !== "deletion" ? line.newLineNumber : ""}
                      </Text>
                      <Text
                        style={{
                          flex: "1",
                          color: line.type === "addition" 
                            ? tokens.colors.semantic.success 
                            : line.type === "deletion"
                              ? tokens.colors.semantic.error
                              : tokens.colors.text.primary
                        }}
                      >
                        <Text as="span" style={{ "user-select": "none", opacity: "0.5" }}>
                          {line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " "}
                        </Text>
                        {line.content}
                      </Text>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    );
  };

  // Repository selector dropdown component
  const RepoSelector = () => {
    const repos = repositories();
    const active = activeRepo();
    const summary = getRepoSummary();

    return (
      <div
        style={{
          position: "absolute",
          top: "36px",
          left: tokens.spacing.sm,
          right: tokens.spacing.sm,
          "z-index": "30",
          "border-radius": tokens.radius.md,
          "box-shadow": "var(--jb-shadow-popup)",
          overflow: "hidden",
          background: "var(--jb-popup)",
          border: `1px solid ${tokens.colors.border.divider}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Summary header */}
        <div
          style={{
            padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
            background: tokens.colors.surface.panel,
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
          }}
        >
          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
            <Icon name="database" size={14} style={{ color: tokens.colors.icon.default }} />
            <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.primary }}>
              {summary.totalRepos} {summary.totalRepos === 1 ? "Repository" : "Repositories"}
            </Text>
          </div>
          <Show when={summary.reposWithChanges > 0}>
            <Badge variant="warning" size="sm">
              {summary.reposWithChanges} with changes
            </Badge>
          </Show>
        </div>

        {/* Cross-repo actions */}
        <Show when={repos.length > 1}>
          <div style={{ padding: `6px ${tokens.spacing.md}`, "border-bottom": `1px solid ${tokens.colors.border.divider}`, display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
            <Button
              variant="ghost"
              size="sm"
              loading={operationLoading() === "fetch-all"}
              onClick={fetchAllRepos}
              disabled={!!operationLoading()}
              icon={<Icon name="rotate" style={{ width: "12px", height: "12px" }} />}
              style={{ flex: "1", "font-size": "10px" }}
            >
              Fetch All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={operationLoading() === "pull-all"}
              onClick={pullAllRepos}
              disabled={!!operationLoading()}
              icon={<Icon name="download" size={12} />}
              style={{ flex: "1", "font-size": "10px" }}
            >
              Pull All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={operationLoading() === "push-all"}
              onClick={pushAllRepos}
              disabled={!!operationLoading()}
              icon={<Icon name="upload" size={12} />}
              style={{ flex: "1", "font-size": "10px" }}
            >
              Push All
            </Button>
          </div>
        </Show>

        {/* Repository list */}
        <div style={{ "max-height": "256px", "overflow-y": "auto" }}>
          <Show when={repos.length === 0}>
            <div style={{ padding: `${tokens.spacing.lg} 16px`, "text-align": "center" }}>
              <Icon name="folder" size={24} style={{ margin: `0 auto ${tokens.spacing.md}`, color: tokens.colors.text.muted }} />
              <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>No repositories found</Text>
              <Text style={{ "font-size": "10px", "margin-top": tokens.spacing.sm, color: tokens.colors.text.muted }}>
                Open a folder containing a git repository
              </Text>
            </div>
          </Show>

          <For each={repos}>
            {(repo) => {
              const isActive = () => active?.id === repo.id;
              const hasChanges = () => repo.stagedFiles.length > 0 || repo.unstagedFiles.length > 0;
              const hasConflicts = () => repo.conflictFiles.length > 0;
              const changeCount = () => repo.stagedFiles.length + repo.unstagedFiles.length;

              return (
                <ListItem
                  selected={isActive()}
                  onClick={() => {
                    multiRepo.setActiveRepository(repo.id);
                    setShowRepoSelector(false);
                  }}
                  icon={
                    isActive() ? (
                      <Icon name="check" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.success }} />
                    ) : (
                      <div style={{ width: "14px" }} />
                    )
                  }
                  style={{ height: "40px" }}
                >
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                      <Icon name="folder" size={14} style={{ "flex-shrink": "0", color: tokens.colors.icon.default }} />
                      <Text style={{
                        "font-size": "12px",
                        "font-weight": "500",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        color: isActive() ? tokens.colors.semantic.success : tokens.colors.text.primary,
                      }}>
                        {repo.name}
                      </Text>
                    </div>
                    <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, "margin-top": "2px", "margin-left": "22px" }}>
                      <Show when={repo.branch}>
                        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
                          <Icon name="code-branch" size={12} style={{ color: tokens.colors.text.muted }} />
                          <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                            {repo.branch}
                          </Text>
                        </div>
                      </Show>
                      <Show when={repo.ahead > 0 || repo.behind > 0}>
                        <Text style={{ "font-size": "10px" }}>
                          <Show when={repo.ahead > 0}>
                            <Text as="span" style={{ color: tokens.colors.semantic.success }}>↑{repo.ahead}</Text>
                          </Show>
                          <Show when={repo.behind > 0}>
                            <Text as="span" style={{ color: tokens.colors.semantic.warning }}>↓{repo.behind}</Text>
                          </Show>
                        </Text>
                      </Show>
                    </div>
                  </div>

                  {/* Status indicators */}
                  <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm, "flex-shrink": "0" }}>
                    <Show when={repo.status === "loading"}>
                      <Icon name="spinner" size={12} style={{ animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
                    </Show>
                    <Show when={hasConflicts()}>
                      <Badge variant="error" size="sm">
                        {repo.conflictFiles.length} conflicts
                      </Badge>
                    </Show>
                    <Show when={hasChanges() && !hasConflicts()}>
                      <Badge variant="warning" size="sm">
                        {changeCount()}
                      </Badge>
                    </Show>
                  </div>
                </ListItem>
              );
            }}
          </For>
        </div>

        {/* Refresh button */}
        <div style={{ padding: `6px ${tokens.spacing.md}`, "border-top": `1px solid ${tokens.colors.border.divider}` }}>
          <Button
            variant="ghost"
            size="sm"
            loading={multiRepo.state.isLoading}
            onClick={() => multiRepo.detectRepositories()}
            icon={<Icon name="rotate" size={14} />}
            style={{ width: "100%" }}
          >
            Refresh Repositories
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        "flex-direction": "column",
        overflow: "hidden",
        position: "relative",
        background: tokens.colors.surface.panel,
      }}
    >
      {/* Repository selector header */}
      <Show when={repositories().length > 1 || repositories().length === 0}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: `0 ${tokens.spacing.lg}`,
            height: "32px",
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
            background: tokens.colors.surface.panel,
            "flex-shrink": "0",
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRepoSelector(!showRepoSelector())}
            icon={<Icon name="folder" size={14} />}
            iconRight={<Icon name="chevron-down" size={12} />}
            style={{ "max-width": "180px" }}
          >
            <Text as="span" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
              {activeRepo()?.name || "Select Repository"}
            </Text>
          </Button>

          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
            <Show when={getRepoSummary().totalConflicts > 0}>
              <Badge variant="error" size="sm">
                {getRepoSummary().totalConflicts} conflicts
              </Badge>
            </Show>
            <Show when={getRepoSummary().reposWithChanges > 0}>
              <Badge variant="warning" size="sm">
                {getRepoSummary().reposWithChanges} repos
              </Badge>
            </Show>
          </div>
        </div>
      </Show>

      {/* Repo selector dropdown */}
      <Show when={showRepoSelector()}>
        <RepoSelector />
      </Show>

      {/* Header with branch and sync */}
      <Show when={activeRepo()}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: `0 ${tokens.spacing.lg}`,
            height: "36px",
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
            "flex-shrink": "0",
          }}
        >
          {/* Branch selector */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBranchSelector(!showBranchSelector())}
            disabled={loading()}
            icon={<Icon name="code-branch" size={16} />}
            iconRight={<Icon name="chevron-down" size={12} />}
          >
            {branch() || "No branch"}
          </Button>
          
          <div style={{ display: "flex", "align-items": "center" }}>
            <Show when={currentBranchInfo()?.ahead || currentBranchInfo()?.behind}>
              <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm, "font-size": "10px", "margin-right": tokens.spacing.md }}>
                <Show when={currentBranchInfo()?.ahead}>
                  <Text as="span" style={{ color: tokens.colors.semantic.success }}>↑{currentBranchInfo()?.ahead}</Text>
                </Show>
                <Show when={currentBranchInfo()?.behind}>
                  <Text as="span" style={{ color: tokens.colors.semantic.warning }}>↓{currentBranchInfo()?.behind}</Text>
                </Show>
              </div>
            </Show>
          </div>

          <div style={{ display: "flex", "align-items": "center", gap: "2px" }}>
            <IconButton
              tooltip="Fetch"
              onClick={gitFetch}
              disabled={!!operationLoading()}
            >
              <Show when={operationLoading() === "fetch"} fallback={<Icon name="rotate" size={16} />}>
                <Icon name="spinner" size={16} style={{ animation: "spin 1s linear infinite" }} />
              </Show>
            </IconButton>
            <IconButton
              tooltip="Pull"
              onClick={pull}
              disabled={!!operationLoading()}
            >
              <Show when={operationLoading() === "pull"} fallback={<Icon name="download" size={16} />}>
                <Icon name="spinner" size={16} style={{ animation: "spin 1s linear infinite" }} />
              </Show>
            </IconButton>
            <IconButton
              tooltip="Push"
              onClick={push}
              disabled={!!operationLoading()}
            >
              <Show when={operationLoading() === "push"} fallback={<Icon name="upload" size={16} />}>
                <Icon name="spinner" size={16} style={{ animation: "spin 1s linear infinite" }} />
              </Show>
            </IconButton>
          </div>
        </div>
      </Show>

      {/* Branch selector dropdown */}
      <Show when={showBranchSelector() && activeRepo()}>
        <div
          style={{
            position: "absolute",
            top: "68px",
            left: tokens.spacing.sm,
            right: tokens.spacing.sm,
            "z-index": "20",
            "border-radius": tokens.radius.md,
            "box-shadow": "var(--jb-shadow-popup)",
            overflow: "hidden",
            background: "var(--jb-popup)",
            border: `1px solid ${tokens.colors.border.divider}`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Create new branch button */}
          <ListItem
            icon={<Icon name="plus" size={14} />}
            label="Create new branch"
            onClick={() => setShowCreateBranch(true)}
            style={{ "border-bottom": `1px solid ${tokens.colors.border.divider}` }}
          />
          
          {/* Create branch input */}
          <Show when={showCreateBranch()}>
            <div style={{ padding: `${tokens.spacing.md} ${tokens.spacing.lg}`, "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
              <Input
                placeholder="Branch name..."
                value={newBranchName()}
                onInput={(e) => setNewBranchName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBranchName().trim()) {
                    createBranch(newBranchName().trim());
                    setNewBranchName("");
                    setShowCreateBranch(false);
                  }
                  if (e.key === "Escape") {
                    setShowCreateBranch(false);
                    setNewBranchName("");
                  }
                }}
                autofocus
              />
              <div style={{ display: "flex", "justify-content": "flex-end", gap: tokens.spacing.sm, "margin-top": tokens.spacing.md }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowCreateBranch(false); setNewBranchName(""); }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!newBranchName().trim()}
                  onClick={() => {
                    if (newBranchName().trim()) {
                      createBranch(newBranchName().trim());
                      setNewBranchName("");
                      setShowCreateBranch(false);
                    }
                  }}
                >
                  Create
                </Button>
              </div>
            </div>
          </Show>
          
          {/* Branch list */}
          <div style={{ "max-height": "192px", "overflow-y": "auto" }}>
            <For each={sortedBranches().filter(b => !b.remote)}>
              {(b) => (
                <ListItem
                  icon={
                    b.current ? (
                      <Icon name="check" size={14} style={{ color: tokens.colors.semantic.success }} />
                    ) : (
                      <div style={{ width: "14px" }} />
                    )
                  }
                  label={b.name}
                  selected={b.current}
                  onClick={() => { if (!b.current) { checkout(b.name); setShowBranchSelector(false); } }}
                  disabled={operationLoading() === "checkout" || b.current}
                  iconRight={
                    <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
                      <Show when={b.ahead || b.behind}>
                        <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                          {b.ahead ? `↑${b.ahead}` : ""}{b.behind ? `↓${b.behind}` : ""}
                        </Text>
                      </Show>
                      <Show when={!b.current}>
                        <IconButton
                          size="sm"
                          tooltip={`Merge ${b.name} into current branch`}
                          onClick={(e) => { e.stopPropagation(); mergeBranch(b.name); }}
                        >
                          <Icon name="code-merge" size={12} />
                        </IconButton>
                        <IconButton
                          size="sm"
                          tooltip={`Delete ${b.name}`}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (confirm(`Delete branch "${b.name}"?`)) {
                              deleteBranch(b.name);
                            }
                          }}
                        >
                          <Icon name="trash" size={12} style={{ color: tokens.colors.semantic.error }} />
                        </IconButton>
                      </Show>
                    </div>
                  }
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Error banner */}
      <Show when={error()}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.md,
            padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
            "font-size": "12px",
            background: error()?.type === "error" ? `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)` : `color-mix(in srgb, ${tokens.colors.semantic.warning} 10%, transparent)`,
            color: error()?.type === "error" ? tokens.colors.semantic.error : tokens.colors.semantic.warning,
          }}
        >
          <Show when={error()?.type === "error"}>
            <Icon name="circle-exclamation" size={14} style={{ "flex-shrink": "0" }} />
          </Show>
          <Show when={error()?.type === "warning"}>
            <Icon name="triangle-exclamation" size={14} style={{ "flex-shrink": "0" }} />
          </Show>
          <Text as="span" style={{ flex: "1" }}>{error()?.message}</Text>
          <IconButton size="sm" onClick={clearError}>
            <Icon name="xmark" size={12} />
          </IconButton>
        </div>
      </Show>

      {/* View tabs */}
      <Show when={activeRepo()}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.sm,
            padding: `0 ${tokens.spacing.md}`,
            height: "32px",
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
            "flex-shrink": "0",
          }}
        >
          {(["changes", "sync", "history", "stashes", "tags", "lfs", "worktrees", "submodules"] as PanelView[]).map(view => (
            <Button
              variant={activeView() === view ? "primary" : "ghost"}
              size="sm"
              onClick={() => setActiveView(view)}
              style={{ "font-size": "12px" }}
            >
              {view === "sync" ? (
                <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  Sync
                  <Show when={(currentBranchInfo()?.ahead ?? 0) > 0 || (currentBranchInfo()?.behind ?? 0) > 0}>
                    <span style={{ 
                      display: "flex", 
                      "align-items": "center", 
                      gap: "2px", 
                      "font-size": "10px",
                      opacity: activeView() === view ? 1 : 0.7
                    }}>
                      <Show when={(currentBranchInfo()?.behind ?? 0) > 0}>
                        <span style={{ color: tokens.colors.semantic.warning }}>
                          {currentBranchInfo()?.behind}
                        </span>
                      </Show>
                      <Show when={(currentBranchInfo()?.ahead ?? 0) > 0}>
                        <span style={{ color: tokens.colors.semantic.success }}>
                          {currentBranchInfo()?.ahead}
                        </span>
                      </Show>
                    </span>
                  </Show>
                </span>
              ) : view === "tags" ? (
                <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  <Icon name="tag" size={12} />
                  Tags
                  <Show when={tagCount() > 0}>
                    <Badge variant="default" size="sm" style={{ "font-size": "9px", padding: "0 4px" }}>
                      {tagCount()}
                    </Badge>
                  </Show>
                </span>
              ) : view === "lfs" ? (
                <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  <Icon name="cloud" size={12} />
                  LFS
                </span>
              ) : (
                view.charAt(0).toUpperCase() + view.slice(1)
              )}
            </Button>
          ))}
        </div>
      </Show>

      {/* Main content area */}
      <div style={{ flex: "1", "overflow-y": "auto" }}>
        <Show when={!activeRepo()}>
          <div style={{ display: "flex", "flex-direction": "column", height: "100%", padding: "24px 16px" }}>
            {/* Welcome message */}
            <div style={{ "text-align": "center", "margin-bottom": "24px" }}>
              <Text style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
                In order to use Git features, you can open a folder containing a Git repository or clone from a URL.
              </Text>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.md }}>
              <Button
                variant="primary"
                onClick={initializeRepository}
                disabled={operationLoading() === "init" || workspace.folders().length === 0}
                loading={operationLoading() === "init"}
                style={{ width: "100%" }}
              >
                Initialize Repository
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  // Dispatch event to open clone dialog
                  window.dispatchEvent(new CustomEvent("command:git.clone"));
                }}
                style={{ width: "100%" }}
              >
                Clone Repository
              </Button>
            </div>

            {/* Help text */}
            <div style={{ "margin-top": "24px", "text-align": "center" }}>
              <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                To learn more about how to use Git and source control,{" "}
                <a 
                  href="#" 
                  style={{ color: tokens.colors.semantic.primary, "text-decoration": "underline" }}
                  onClick={(e) => {
                    e.preventDefault();
                    // Could open documentation
                  }}
                >
                  read our docs
                </a>.
              </Text>
            </div>

            {/* Refresh link */}
            <div style={{ "margin-top": "auto", "padding-top": "16px", "text-align": "center" }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => multiRepo.detectRepositories()}
              icon={<Icon name="rotate" size={12} />}
              >
                Refresh
              </Button>
            </div>
          </div>
        </Show>

        <Show when={loading() && activeRepo()}>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "128px" }}>
            <Icon name="spinner" size={20} style={{ animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
          </div>
        </Show>

        <Show when={!loading() && activeView() === "changes" && activeRepo()}>
          {/* Conflicts section */}
          <Show when={conflictFiles().length > 0}>
            <div style={{ "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
              <SectionHeader
                title="Conflicts"
                count={conflictFiles().length}
                expanded={conflictsExpanded()}
                onToggle={() => setConflictsExpanded(!conflictsExpanded())}
              />
              <Show when={conflictsExpanded()}>
                <div style={{ "padding-bottom": "4px" }}>
                  <Show 
                    when={conflictFiles().length >= VIRTUALIZE_THRESHOLD}
                    fallback={
                      <For each={conflictFiles()}>
                        {(file) => (
                          <FileItem file={file} />
                        )}
                      </For>
                    }
                  >
                    <VirtualList
                      items={conflictFiles()}
                      itemHeight={FILE_ITEM_HEIGHT}
                      height={Math.min(conflictFiles().length * FILE_ITEM_HEIGHT, 200)}
                      overscan={5}
                    >
                      {(file) => (
                        <FileItem file={file} />
                      )}
                    </VirtualList>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>

          {/* Incoming/Outgoing changes section */}
          <Show when={(currentBranchInfo()?.behind ?? 0) > 0 || (currentBranchInfo()?.ahead ?? 0) > 0}>
            <IncomingOutgoingSection
              incomingCount={currentBranchInfo()?.behind ?? 0}
              outgoingCount={currentBranchInfo()?.ahead ?? 0}
              onPull={pull}
              onPush={push}
              onShowIncoming={() => setActiveView("sync")}
              onShowOutgoing={() => setActiveView("sync")}
              operationLoading={operationLoading()}
            />
          </Show>

          {/* Staged changes section */}
          <div style={{ "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
            <SectionHeader
              title="Staged"
              count={stagedFiles().length}
              expanded={stagedExpanded()}
              onToggle={() => setStagedExpanded(!stagedExpanded())}
              action={stagedFiles().length > 0 ? { 
                label: "Unstage All", 
                onClick: unstageAll 
              } : undefined}
              loading={operationLoading() === "unstage-all"}
            />
            <Show when={stagedExpanded()}>
              <div style={{ "padding-bottom": "4px" }}>
                <Show 
                  when={stagedFiles().length >= VIRTUALIZE_THRESHOLD}
                  fallback={
                    <For each={stagedFiles()}>
                      {(file) => (
                        <FileItem
                          file={file}
                          onUnstage={() => unstageFile(file.path)}
                        />
                      )}
                    </For>
                  }
                >
                  <VirtualList
                    items={stagedFiles()}
                    itemHeight={FILE_ITEM_HEIGHT}
                    height={Math.min(stagedFiles().length * FILE_ITEM_HEIGHT, 300)}
                    overscan={5}
                  >
                    {(file) => (
                      <FileItem
                        file={file}
                        onUnstage={() => unstageFile(file.path)}
                      />
                    )}
                  </VirtualList>
                </Show>
                <Show when={stagedFiles().length === 0}>
                  <Text style={{
                    display: "block",
                    "font-size": "12px",
                    height: "22px",
                    "line-height": "22px",
                    padding: `0 ${tokens.spacing.lg}`,
                    color: tokens.colors.text.muted,
                  }}>
                    No staged changes
                  </Text>
                </Show>
              </div>
            </Show>
          </div>

          {/* Unstaged changes section */}
          <div style={{ "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
            <SectionHeader
              title="Changes"
              count={unstagedFiles().length}
              expanded={unstagedExpanded()}
              onToggle={() => setUnstagedExpanded(!unstagedExpanded())}
              action={unstagedFiles().length > 0 ? { 
                label: "Stage All", 
                onClick: stageAll 
              } : undefined}
              loading={operationLoading() === "stage-all"}
            />
            <Show when={unstagedExpanded()}>
              <div style={{ "padding-bottom": "4px" }}>
                <Show 
                  when={unstagedFiles().length >= VIRTUALIZE_THRESHOLD}
                  fallback={
                    <For each={unstagedFiles()}>
                      {(file) => (
                        <FileItem
                          file={file}
                          onStage={() => stageFile(file.path)}
                          onDiscard={file.status !== "untracked" ? () => discardChanges(file.path) : undefined}
                        />
                      )}
                    </For>
                  }
                >
                  <VirtualList
                    items={unstagedFiles()}
                    itemHeight={FILE_ITEM_HEIGHT}
                    height={Math.min(unstagedFiles().length * FILE_ITEM_HEIGHT, 400)}
                    overscan={5}
                  >
                    {(file) => (
                      <FileItem
                        file={file}
                        onStage={() => stageFile(file.path)}
                        onDiscard={file.status !== "untracked" ? () => discardChanges(file.path) : undefined}
                      />
                    )}
                  </VirtualList>
                </Show>
                <Show when={unstagedFiles().length === 0}>
                  <Text style={{
                    display: "block",
                    "font-size": "12px",
                    height: "22px",
                    "line-height": "22px",
                    padding: `0 ${tokens.spacing.lg}`,
                    color: tokens.colors.text.muted,
                  }}>
                    No changes
                  </Text>
                </Show>
              </div>
            </Show>
          </div>

          {/* Inline diff preview */}
          <Show when={selectedFile() && !diffLoading()}>
            <InlineDiffPreview />
          </Show>
          <Show when={diffLoading()}>
            <div 
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                height: "48px",
                "border-top": `1px solid ${tokens.colors.border.divider}`,
              }}
            >
              <Icon name="spinner" size={16} style={{ animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
            </div>
          </Show>
        </Show>

        <Show when={!loading() && activeView() === "history" && activeRepo()}>
          <CommitGraph
            commits={commits()}
            currentBranch={branch() || undefined}
          />
        </Show>

        <Show when={!loading() && activeView() === "stashes" && activeRepo()}>
          <StashPanel />
        </Show>

        <Show when={!loading() && activeView() === "tags" && activeRepo()}>
          <TagManager 
            repoPath={activeRepo()!.path}
            onClose={() => setActiveView("changes")}
          />
        </Show>

        <Show when={!loading() && activeView() === "sync" && activeRepo()}>
          <IncomingOutgoingView
            repoPath={activeRepo()!.path}
            branch={branch() || ""}
            remoteBranch={currentBranchInfo()?.upstream}
            incomingCount={currentBranchInfo()?.behind ?? 0}
            outgoingCount={currentBranchInfo()?.ahead ?? 0}
            onPull={pull}
            onPush={push}
            onFetch={gitFetch}
            onSync={async () => {
              await pull();
              await push();
            }}
            operationLoading={operationLoading()}
          />
        </Show>

        <Show when={!loading() && activeView() === "lfs" && activeRepo()}>
          <GitLFSManager repoPath={activeRepo()!.path} />
        </Show>

        <Show when={!loading() && activeView() === "submodules" && activeRepo()}>
          <div style={{ display: "flex", "flex-direction": "column", height: "100%" }}>
            {/* Submodules header with actions */}
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                "border-bottom": `1px solid ${tokens.colors.border.divider}`,
                "flex-shrink": "0",
              }}
            >
              <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.primary }}>
                Submodules ({submodules().length})
              </Text>
              <Button
                variant="ghost"
                size="sm"
                loading={operationLoading() === "update-submodules"}
                onClick={() => updateSubmodules(true, true)}
                disabled={!!operationLoading() || submodules().length === 0}
              >
                Update All
              </Button>
            </div>

            {/* Submodules loading state */}
            <Show when={submodulesLoading()}>
              <div style={{ display: "flex", "align-items": "center", "justify-content": "center", padding: "32px 0" }}>
                <Icon name="spinner" size={20} style={{ animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
              </div>
            </Show>

            {/* No submodules message */}
            <Show when={!submodulesLoading() && submodules().length === 0}>
              <div style={{ display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", padding: "32px 16px", "text-align": "center" }}>
                <Icon name="folder" size={32} style={{ "margin-bottom": tokens.spacing.md, color: tokens.colors.text.muted }} />
                <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted }}>
                  No submodules
                </Text>
                <Text style={{ "font-size": "10px", "margin-top": tokens.spacing.sm, color: tokens.colors.text.muted }}>
                  This repository has no submodules configured
                </Text>
              </div>
            </Show>

            {/* Submodules list */}
            <Show when={!submodulesLoading() && submodules().length > 0}>
              <div style={{ flex: "1", "overflow-y": "auto" }}>
                <For each={submodules()}>
                  {(sub) => {
                    const getStatusVariant = (): "default" | "success" | "warning" => {
                      switch (sub.status) {
                        case "initialized": return "success";
                        case "modified": return "warning";
                        default: return "default";
                      }
                    };
                    const isInitializing = () => operationLoading() === `init-submodule-${sub.path}`;

                    return (
                      <ListItem
                        icon={<Icon name="folder" size={16} />}
                        style={{ height: "auto", padding: `${tokens.spacing.md} ${tokens.spacing.lg}`, "border-bottom": `1px solid ${tokens.colors.border.divider}` }}
                        iconRight={
                          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
                            <Show when={sub.status === "uninitialized"}>
                              <Button
                                variant="ghost"
                                size="sm"
                                loading={isInitializing()}
                                onClick={() => initSubmodule(sub.path)}
                                style={{ color: tokens.colors.semantic.primary }}
                              >
                                Init
                              </Button>
                            </Show>
                            <Show when={sub.status !== "uninitialized"}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateSubmodules(false, false)}
                              >
                                Update
                              </Button>
                            </Show>
                          </div>
                        }
                      >
                        <div style={{ flex: "1", "min-width": "0" }}>
                          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                            <Text style={{ "font-size": "12px", "font-weight": "500", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: tokens.colors.text.primary }}>
                              {sub.name}
                            </Text>
                            <Badge variant={getStatusVariant()} size="sm">
                              {sub.status}
                            </Badge>
                          </div>
                          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, "margin-top": "2px" }}>
                            <Text style={{ "font-size": "10px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: tokens.colors.text.muted }}>
                              {sub.path}
                            </Text>
                            <Show when={sub.branch}>
                              <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                                • {sub.branch}
                              </Text>
                            </Show>
                          </div>
                          <Show when={sub.url}>
                            <span title={sub.url}>
                              <Text style={{ "font-size": "10px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "margin-top": "2px", color: tokens.colors.text.muted }}>
                                {sub.url}
                              </Text>
                            </span>
                          </Show>
                        </div>
                      </ListItem>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* Worktrees view */}
        <Show when={!loading() && activeView() === "worktrees" && activeRepo()}>
          <WorktreeManager
            repoPath={activeRepo()!.path}
            onWorktreeSelect={(_worktree) => {
              // Could navigate to worktree or set it as active
            }}
            onOpenInNewWindow={(worktree) => {
              // Dispatch event to open worktree in new window
              window.dispatchEvent(
                new CustomEvent("command:workbench.openWorktree", {
                  detail: { path: worktree.path },
                })
              );
            }}
          />
        </Show>
      </div>

      {/* Commit section - only show in changes view when repo is active */}
      <Show when={activeView() === "changes" && activeRepo()}>
        <div style={{ "flex-shrink": "0", padding: tokens.spacing.lg, "border-top": `1px solid ${tokens.colors.border.divider}` }}>
          {/* Commit message textarea with validation */}
          <div style={{ position: "relative" }}>
            <Textarea
              placeholder="Commit message..."
              value={commitMessage()}
              onInput={(e) => setCommitMessage(e.currentTarget.value)}
              error={commitValidation().hasWarning ? commitValidation().warningMessage : undefined}
              style={{
                "min-height": "60px",
                "border-color": commitValidation().hasWarning ? tokens.colors.semantic.warning : undefined,
              }}
            />
            
            {/* Character count indicator */}
            <div 
              style={{ 
                "font-size": "11px",
                color: commitValidation().bodyLineExceedsLimit 
                  ? tokens.colors.semantic.error 
                  : commitValidation().subjectExceedsLimit 
                    ? tokens.colors.semantic.warning 
                    : tokens.colors.text.muted,
                "text-align": "right",
                padding: "2px 0",
                "user-select": "none",
              }}
            >
              <Show when={commitMessage().length > 0}>
                <Text as="span">
                  {commitValidation().firstLineLength}/{commitValidation().subjectLimit}
                </Text>
              </Show>
            </div>
          </div>

          {/* GPG signing toggle - only show if GPG is configured */}
          <Show when={gpgConfigured()}>
            <label style={{ display: "flex", "align-items": "center", gap: "8px", "margin-top": "8px", cursor: "pointer", "user-select": "none" }}>
              <input
                type="checkbox"
                checked={signCommits()}
                onChange={() => setSignCommits(!signCommits())}
                style={{
                  width: "16px",
                  height: "16px",
                  "border-radius": tokens.radius.sm,
                  cursor: "pointer",
                  "accent-color": tokens.colors.semantic.success,
                }}
              />
              <Icon name="lock" size={14} style={{ color: signCommits() ? tokens.colors.semantic.success : tokens.colors.icon.default }} />
              <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                Sign commit with GPG
              </Text>
            </label>
          </Show>

          <Button
            variant="primary"
            loading={operationLoading() === "commit"}
            disabled={!commitMessage().trim() || stagedFiles().length === 0 || operationLoading() === "commit"}
            onClick={commit}
            icon={<Icon name="code-commit" size={16} />}
            style={{ width: "100%", "margin-top": "8px", height: "32px" }}
          >
            Commit {stagedFiles().length > 0 ? `(${stagedFiles().length} file${stagedFiles().length !== 1 ? "s" : ""})` : ""}
          </Button>
        </div>
      </Show>

      {/* Click outside handler for dropdowns */}
      <Show when={showRepoSelector() || showBranchSelector()}>
        <div
          style={{
            position: "fixed",
            inset: "0",
            "z-index": "10",
          }}
          onClick={() => {
            setShowRepoSelector(false);
            setShowBranchSelector(false);
          }}
        />
      </Show>

      {/* Keyframes for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default GitPanel;

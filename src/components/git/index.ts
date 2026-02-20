/**
 * Git Components - Export Module
 * 
 * Centralized exports for all git-related UI components.
 */

export { Bisect } from "./Bisect";
export type { BisectProps, BisectCommit, BisectMark, BisectStatus } from "./Bisect";

export { BlameView } from "./BlameView";

export { BranchComparison } from "./BranchComparison";

export { CommitGraph } from "./CommitGraph";
export type { Commit, CommitRef } from "./CommitGraph";

export { ConflictResolver } from "./ConflictResolver";

export { DiffView } from "./DiffView";

export { DiffHunkToolbar } from "./DiffHunkToolbar";
export type { DiffHunkToolbarProps } from "./DiffHunkToolbar";

export { GitPanel } from "./GitPanel";

export { InteractiveRebase } from "./InteractiveRebase";
export type {
  InteractiveRebaseProps,
  RebaseCommit,
  RebaseAction,
  RebaseState,
  RebaseConflict
} from "./InteractiveRebase";

export { StashPanel } from "./StashPanel";
export type { StashEntry, StashPanelProps } from "./StashPanel";

export { CherryPick } from "./CherryPick";
export type {
  CherryPickProps,
  CherryPickCommit,
  CherryPickState,
  CherryPickConflict,
  BranchInfo
} from "./CherryPick";

export { MergeEditor, parseConflictMarkers } from "./MergeEditor";
export type {
  MergeEditorProps,
  ConflictRegion,
  MergeViewMode
} from "./MergeEditor";

export { GitLFSManager } from "./GitLFSManager";
export type {
  GitLFSManagerProps,
  LFSFile,
  LFSLock,
  LFSStorageInfo,
  LFSStatus
} from "./GitLFSManager";

export { LFSTrackDialog } from "./LFSTrackDialog";
export type { LFSTrackDialogProps } from "./LFSTrackDialog";

export { 
  LFSFileIndicator, 
  LFSDirectoryIndicator,
  invalidateLFSCache,
  clearLFSCache 
} from "./LFSFileIndicator";
export type {
  LFSFileIndicatorProps,
  LFSDirectoryIndicatorProps,
  LFSFileStatus,
  LFSFileInfo
} from "./LFSFileIndicator";

export { IncomingOutgoingView, IncomingOutgoingSection } from "./IncomingOutgoingView";
export type {
  IncomingOutgoingViewProps,
  IncomingOutgoingSectionProps,
  CommitInfo,
  IncomingOutgoingState,
  CommitFile as IncomingOutgoingCommitFile
} from "./IncomingOutgoingView";

export { WorktreeManager } from "./WorktreeManager";
export type { WorktreeManagerProps } from "./WorktreeManager";

export { AddWorktreeDialog } from "./AddWorktreeDialog";
export type { AddWorktreeDialogProps } from "./AddWorktreeDialog";

// Clone Repository Dialog
export { CloneRepositoryDialog } from "./CloneRepositoryDialog";
export type { CloneRepositoryDialogProps } from "./CloneRepositoryDialog";

// Merge Branch Dialog
export { MergeBranchDialog } from "./MergeBranchDialog";
export type { MergeBranchDialogProps } from "./MergeBranchDialog";

// Publish Branch Dialog
export { PublishBranchDialog } from "./PublishBranchDialog";
export type { PublishBranchDialogProps } from "./PublishBranchDialog";

// Inline Diff Editor
export { InlineDiffEditor } from "./InlineDiffEditor";
export type { InlineDiffEditorProps } from "./InlineDiffEditor";

// Stash Diff View
export { StashDiffView } from "./StashDiffView";
export type { StashDiffViewProps } from "./StashDiffView";

// Sync Status
export { SyncStatus } from "./SyncStatus";
export type { SyncStatusProps } from "./SyncStatus";

// Stash Manager
export { StashManager } from "./StashManager";
export type { StashManagerProps } from "./StashManager";

// Diff sub-components
export { DiffToolbar } from "./DiffToolbar";
export type { DiffToolbarProps } from "./DiffToolbar";
export { DiffHunk } from "./DiffHunk";
export type { DiffHunkProps, DiffHunkData, DiffLineData } from "./DiffHunk";
export { DiffLine, computeWordDiff, getLineBackground, getLineColor, getLinePrefix } from "./DiffLine";
export type { DiffLineProps, WordChange } from "./DiffLine";

// Tag Manager
export { TagManager } from "./TagManager";
export type { TagManagerProps } from "./TagManager";

// Force Push Confirmation
export { ForcePushConfirmation } from "./ForcePushConfirmation";
export type { ForcePushConfirmationProps } from "./ForcePushConfirmation";

// Tag Creator
export { TagCreator } from "./TagCreator";
export type { TagCreatorProps } from "./TagCreator";

// Git Graph (SVG-based DAG visualization)
export { GitGraph } from "./GitGraph";
export type { GitGraphProps } from "./GitGraph";

// Create Tag Dialog
export { CreateTagDialog } from "./CreateTagDialog";

// Re-export MultiDiffEditor from editor components for git workflows
export { MultiDiffEditor } from "../editor/MultiDiffEditor";
export type { MultiDiffEditorProps, FileDiff, FileStatus } from "../editor/MultiDiffEditor";

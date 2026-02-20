import { createSignal, createMemo, For, Show, createEffect } from "solid-js";
import { parsePatch } from "diff";
import { Icon } from "@/components/ui/Icon";
import { Button, IconButton, Text, Badge } from "@/components/ui";

/** File status in the diff */
export type FileStatus = "added" | "modified" | "deleted" | "renamed";

/** Single file diff information */
export interface FileDiffInfo {
  /** Unique identifier for the file */
  id: string;
  /** File path (new path for renamed files) */
  path: string;
  /** Original path (for renamed files) */
  oldPath?: string;
  /** Unified diff patch content */
  patch: string;
  /** File status */
  status: FileStatus;
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** Whether file is binary */
  binary?: boolean;
}

/** File decision state */
export type FileDecision = "pending" | "accepted" | "rejected";

/** Props for MultiDiffView component */
export interface MultiDiffViewProps {
  /** Array of file diffs to display */
  files: FileDiffInfo[];
  /** Title for the diff view */
  title?: string;
  /** Callback when a file is accepted */
  onAccept?: (fileId: string) => void;
  /** Callback when a file is rejected */
  onReject?: (fileId: string) => void;
  /** Callback when all files are accepted */
  onAcceptAll?: () => void;
  /** Callback when all files are rejected */
  onRejectAll?: () => void;
  /** Callback when view is closed */
  onClose?: () => void;
  /** Initial file decisions (file id -> decision) */
  initialDecisions?: Record<string, FileDecision>;
  /** Whether to show accept/reject controls */
  showDecisionControls?: boolean;
  /** Read-only mode (no accept/reject) */
  readOnly?: boolean;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface DiffHunk {
  header: string;
  lines: DiffLine[];
  startLine: number;
}

/**
 * MultiDiffView - A comprehensive multi-file diff viewer component
 * 
 * Features:
 * - File list sidebar with status icons
 * - Unified diff view for selected file
 * - Summary statistics (additions/deletions)
 * - Expand/collapse all functionality
 * - Per-file accept/reject decisions
 * - Keyboard navigation between changes
 * - Copy diff to clipboard
 * - Fullscreen mode
 */
export function MultiDiffView(props: MultiDiffViewProps) {
  // State management
  const [selectedFileId, setSelectedFileId] = createSignal<string | null>(
    props.files.length > 0 ? props.files[0].id : null
  );
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(
    new Set(props.files.map(f => f.id))
  );
  const [decisions, setDecisions] = createSignal<Record<string, FileDecision>>(
    props.initialDecisions || {}
  );
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [sidebarWidth] = createSignal(280);
  const [currentChangeIndex, setCurrentChangeIndex] = createSignal(0);

  // Show decision controls unless explicitly disabled or in read-only mode
  const showControls = () => props.showDecisionControls !== false && !props.readOnly;

  // Computed: Selected file
  const selectedFile = createMemo(() => {
    const id = selectedFileId();
    return id ? props.files.find(f => f.id === id) : null;
  });

  // Computed: Total statistics
  const totalStats = createMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const file of props.files) {
      additions += file.additions;
      deletions += file.deletions;
    }
    return { additions, deletions, fileCount: props.files.length };
  });

  // Computed: Files grouped by status
  const filesByStatus = createMemo(() => {
    const added: FileDiffInfo[] = [];
    const modified: FileDiffInfo[] = [];
    const deleted: FileDiffInfo[] = [];
    const renamed: FileDiffInfo[] = [];

    for (const file of props.files) {
      switch (file.status) {
        case "added":
          added.push(file);
          break;
        case "modified":
          modified.push(file);
          break;
        case "deleted":
          deleted.push(file);
          break;
        case "renamed":
          renamed.push(file);
          break;
      }
    }

    return { added, modified, deleted, renamed };
  });

  // Computed: Parse the selected file's diff
  const parsedDiff = createMemo((): DiffHunk[] => {
    const file = selectedFile();
    if (!file || file.binary) return [];

    try {
      const patches = parsePatch(file.patch);
      const hunks: DiffHunk[] = [];

      for (const patch of patches) {
        for (const hunk of patch.hunks) {
          const lines: DiffLine[] = [];
          let oldLine = hunk.oldStart;
          let newLine = hunk.newStart;

          for (const line of hunk.lines) {
            if (line.startsWith("+")) {
              lines.push({
                type: "add",
                content: line.slice(1),
                newLine: newLine++,
              });
            } else if (line.startsWith("-")) {
              lines.push({
                type: "remove",
                content: line.slice(1),
                oldLine: oldLine++,
              });
            } else {
              lines.push({
                type: "context",
                content: line.slice(1),
                oldLine: oldLine++,
                newLine: newLine++,
              });
            }
          }

          hunks.push({
            header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
            lines,
            startLine: hunk.newStart,
          });
        }
      }

      return hunks;
    } catch {
      return [];
    }
  });

  // Computed: All change indices (for navigation)
  const changeIndices = createMemo(() => {
    const indices: number[] = [];
    const hunks = parsedDiff();
    let lineIndex = 0;

    for (const hunk of hunks) {
      lineIndex++; // header line
      for (const line of hunk.lines) {
        if (line.type === "add" || line.type === "remove") {
          indices.push(lineIndex);
        }
        lineIndex++;
      }
    }

    return indices;
  });

  // Computed: Decision summary
  const decisionSummary = createMemo(() => {
    const d = decisions();
    let accepted = 0;
    let rejected = 0;
    let pending = 0;

    for (const file of props.files) {
      const decision = d[file.id] || "pending";
      switch (decision) {
        case "accepted":
          accepted++;
          break;
        case "rejected":
          rejected++;
          break;
        default:
          pending++;
      }
    }

    return { accepted, rejected, pending };
  });

  // Update selected file when files prop changes
  createEffect(() => {
    const files = props.files;
    const currentId = selectedFileId();
    if (currentId && !files.find(f => f.id === currentId)) {
      setSelectedFileId(files.length > 0 ? files[0].id : null);
    } else if (!currentId && files.length > 0) {
      setSelectedFileId(files[0].id);
    }
  });

  // Handlers
  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId);
    setCurrentChangeIndex(0);
  };

  const handleToggleExpand = (fileId: string) => {
    const current = expandedFiles();
    const next = new Set(current);
    if (next.has(fileId)) {
      next.delete(fileId);
    } else {
      next.add(fileId);
    }
    setExpandedFiles(next);
  };

  const handleExpandAll = () => {
    setExpandedFiles(new Set(props.files.map(f => f.id)));
  };

  const handleCollapseAll = () => {
    setExpandedFiles(new Set<string>());
  };

  const handleAccept = (fileId: string) => {
    setDecisions(prev => ({ ...prev, [fileId]: "accepted" }));
    props.onAccept?.(fileId);
  };

  const handleReject = (fileId: string) => {
    setDecisions(prev => ({ ...prev, [fileId]: "rejected" }));
    props.onReject?.(fileId);
  };

  const handleAcceptAll = () => {
    const newDecisions: Record<string, FileDecision> = {};
    for (const file of props.files) {
      newDecisions[file.id] = "accepted";
    }
    setDecisions(newDecisions);
    props.onAcceptAll?.();
  };

  const handleRejectAll = () => {
    const newDecisions: Record<string, FileDecision> = {};
    for (const file of props.files) {
      newDecisions[file.id] = "rejected";
    }
    setDecisions(newDecisions);
    props.onRejectAll?.();
  };

  const handleCopyDiff = async (fileId: string, patch: string) => {
    try {
      await navigator.clipboard.writeText(patch);
      setCopiedId(fileId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy diff:", err);
    }
  };

  const handleNavigateChange = (direction: "prev" | "next") => {
    const indices = changeIndices();
    if (indices.length === 0) return;

    const current = currentChangeIndex();
    let next: number;

    if (direction === "next") {
      next = current < indices.length - 1 ? current + 1 : 0;
    } else {
      next = current > 0 ? current - 1 : indices.length - 1;
    }

    setCurrentChangeIndex(next);

    // Scroll to the change
    const lineElement = document.querySelector(`[data-line-index="${indices[next]}"]`);
    lineElement?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleNavigateFile = (direction: "prev" | "next") => {
    const currentId = selectedFileId();
    if (!currentId) return;

    const currentIndex = props.files.findIndex(f => f.id === currentId);
    if (currentIndex === -1) return;

    let nextIndex: number;
    if (direction === "next") {
      nextIndex = currentIndex < props.files.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : props.files.length - 1;
    }

    setSelectedFileId(props.files[nextIndex].id);
    setCurrentChangeIndex(0);
  };

  // Utility functions
  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case "added":
        return <Icon name="file-circle-plus" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />;
      case "deleted":
        return <Icon name="file-circle-minus" class="w-4 h-4" style={{ color: "var(--cortex-error)" }} />;
      case "renamed":
        return <Icon name="file" class="w-4 h-4" style={{ color: "var(--cortex-info)" }} />;
      default:
        return <Icon name="file" class="w-4 h-4" style={{ color: "var(--cortex-warning)" }} />;
    }
  };

  const getStatusLabel = (status: FileStatus): string => {
    switch (status) {
      case "added":
        return "A";
      case "deleted":
        return "D";
      case "renamed":
        return "R";
      default:
        return "M";
    }
  };

  const getStatusColor = (status: FileStatus): { color: string; bg: string } => {
    switch (status) {
      case "added":
        return { color: "var(--cortex-success)", bg: "rgba(63, 185, 80, 0.15)" };
      case "deleted":
        return { color: "var(--cortex-error)", bg: "rgba(248, 81, 73, 0.15)" };
      case "renamed":
        return { color: "var(--cortex-info)", bg: "rgba(163, 113, 247, 0.15)" };
      default:
        return { color: "var(--cortex-warning)", bg: "rgba(227, 179, 65, 0.15)" };
    }
  };

  const getDecisionColor = (decision: FileDecision): { color: string; bg: string } => {
    switch (decision) {
      case "accepted":
        return { color: "var(--cortex-success)", bg: "rgba(63, 185, 80, 0.15)" };
      case "rejected":
        return { color: "var(--cortex-error)", bg: "rgba(248, 81, 73, 0.15)" };
      default:
        return { color: "var(--text-weak)", bg: "transparent" };
    }
  };

  const getLineBackground = (type: DiffLine["type"]): string => {
    switch (type) {
      case "add":
        return "rgba(46, 160, 67, 0.15)";
      case "remove":
        return "rgba(248, 81, 73, 0.15)";
      default:
        return "transparent";
    }
  };

  const getLineColor = (type: DiffLine["type"]): string => {
    switch (type) {
      case "add":
        return "var(--cortex-success)";
      case "remove":
        return "var(--cortex-error)";
      default:
        return "var(--text-base)";
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

  // File list item component
  const FileListItem = (itemProps: { file: FileDiffInfo }) => {
    const file = itemProps.file;
    const isSelected = () => selectedFileId() === file.id;
    const isExpanded = () => expandedFiles().has(file.id);
    const decision = () => decisions()[file.id] || "pending";
    const statusColors = () => getStatusColor(file.status);
    const decisionColors = () => getDecisionColor(decision());

    return (
      <div
        class={`group transition-colors ${isSelected() ? "bg-white/10" : "hover:bg-white/5"}`}
      >
        {/* File header row */}
        <div
          class="flex items-center gap-2 px-2 cursor-pointer"
          style={{ height: "32px" }}
          onClick={() => handleFileSelect(file.id)}
        >
          {/* Expand/collapse toggle */}
          <IconButton
            class="p-0.5 rounded hover:bg-white/10 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpand(file.id);
            }}
          >
            {isExpanded() ? (
              <Icon name="chevron-down" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
            ) : (
              <Icon name="chevron-right" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
            )}
          </IconButton>

          {/* Status icon */}
          <span class="shrink-0">{getStatusIcon(file.status)}</span>

          {/* File name */}
          <span
            class="flex-1 text-xs truncate"
            style={{ color: isSelected() ? "var(--text-base)" : "var(--text-weak)" }}
            title={file.path}
          >
            {getFileName(file.path)}
          </span>

          {/* Stats */}
          <div class="flex items-center gap-1 shrink-0">
            <Show when={file.additions > 0}>
              <Text size="xs" style={{ color: "var(--cortex-success)" }}>
                +{file.additions}
              </Text>
            </Show>
            <Show when={file.deletions > 0}>
              <Text size="xs" style={{ color: "var(--cortex-error)" }}>
                -{file.deletions}
              </Text>
            </Show>
          </div>

          {/* Status badge */}
          <span
            class="text-[10px] font-mono px-1 py-0.5 rounded shrink-0"
            style={{
              color: statusColors().color,
              background: statusColors().bg,
              "min-width": "18px",
              "text-align": "center",
            }}
          >
            {getStatusLabel(file.status)}
          </span>

          {/* Decision indicator */}
          <Show when={showControls() && decision() !== "pending"}>
            <span
              class="text-[10px] px-1 py-0.5 rounded shrink-0"
              style={{
                color: decisionColors().color,
                background: decisionColors().bg,
              }}
            >
              {decision() === "accepted" ? "✓" : "✗"}
            </span>
          </Show>
        </div>

        {/* Expanded details */}
        <Show when={isExpanded()}>
          <div
            class="px-8 py-1 text-[10px] border-l-2 ml-4"
            style={{
              color: "var(--text-weaker)",
              "border-color": statusColors().color,
            }}
          >
            <div class="truncate">{getFileDir(file.path) || "/"}</div>
            <Show when={file.oldPath}>
              <div class="truncate opacity-75">← {file.oldPath}</div>
            </Show>
            <Show when={file.binary}>
              <div class="text-orange-400">Binary file</div>
            </Show>
          </div>
        </Show>
      </div>
    );
  };

  // File section component
  const FileSection = (sectionProps: {
    title: string;
    files: FileDiffInfo[];
    defaultExpanded?: boolean;
  }) => {
    const [sectionExpanded, setSectionExpanded] = createSignal(
      sectionProps.defaultExpanded !== false
    );

    return (
      <Show when={sectionProps.files.length > 0}>
        <div class="border-b" style={{ "border-color": "var(--border-weak)" }}>
          <Button
            class="w-full flex items-center justify-between px-3 hover:bg-white/5 transition-colors"
            style={{ height: "28px" }}
            onClick={() => setSectionExpanded(!sectionExpanded())}
          >
            <div class="flex items-center gap-1.5">
            {sectionExpanded() ? (
                <Icon name="chevron-down" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
              ) : (
                <Icon name="chevron-right" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
              )}
              <Text size="xs" weight="medium" style={{ color: "var(--text-base)" }}>
                {sectionProps.title}
              </Text>
              <Badge
                size="sm"
                style={{ background: "var(--surface-active)", color: "var(--text-weak)", "font-size": "10px" }}
              >
                {sectionProps.files.length}
              </Badge>
            </div>
          </Button>
          <Show when={sectionExpanded()}>
            <div class="pb-1">
              <For each={sectionProps.files}>{(file) => <FileListItem file={file} />}</For>
            </div>
          </Show>
        </div>
      </Show>
    );
  };

  return (
    <div
      class={`flex flex-col overflow-hidden ${isFullscreen() ? "fixed inset-0 z-50" : "h-full"}`}
      style={{ background: "var(--background-base)" }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        {/* Title and stats */}
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            {props.title || "Changes"}
          </span>
          <div class="flex items-center gap-2 text-xs">
            <Text style={{ color: "var(--text-weak)" }}>
              {totalStats().fileCount} {totalStats().fileCount === 1 ? "file" : "files"}
            </Text>
            <Text style={{ color: "var(--cortex-success)" }}>+{totalStats().additions}</Text>
            <Text style={{ color: "var(--cortex-error)" }}>-{totalStats().deletions}</Text>
          </div>
          <Show when={showControls()}>
            <div
              class="flex items-center gap-2 px-2 py-1 rounded text-[10px]"
              style={{ background: "var(--surface-active)" }}
            >
              <Text style={{ color: "var(--cortex-success)" }}>
                ✓ {decisionSummary().accepted}
              </Text>
              <Text style={{ color: "var(--cortex-error)" }}>
                ✗ {decisionSummary().rejected}
              </Text>
              <Text style={{ color: "var(--text-weak)" }}>
                ○ {decisionSummary().pending}
              </Text>
            </div>
          </Show>
        </div>

        {/* Actions */}
        <div class="flex items-center gap-2">
          {/* Navigation */}
          <div class="flex items-center gap-1">
            <IconButton
              class="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
              onClick={() => handleNavigateFile("prev")}
              disabled={props.files.length <= 1}
              title="Previous file"
            >
              <Icon name="chevron-up" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            </IconButton>
            <IconButton
              class="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
              onClick={() => handleNavigateFile("next")}
              disabled={props.files.length <= 1}
              title="Next file"
            >
              <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            </IconButton>
          </div>

          <div class="w-px h-4" style={{ background: "var(--border-weak)" }} />

          {/* Expand/Collapse */}
          <Button
            class="px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-weak)" }}
            onClick={handleExpandAll}
          >
            Expand All
          </Button>
          <Button
            class="px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-weak)" }}
            onClick={handleCollapseAll}
          >
            Collapse All
          </Button>

          <Show when={showControls()}>
            <div class="w-px h-4" style={{ background: "var(--border-weak)" }} />

            {/* Accept/Reject All */}
            <Button
              class="px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors flex items-center gap-1"
              style={{ color: "var(--cortex-success)" }}
              onClick={handleAcceptAll}
            >
              <Icon name="check" class="w-3.5 h-3.5" />
              Accept All
            </Button>
            <Button
              class="px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors flex items-center gap-1"
              style={{ color: "var(--cortex-error)" }}
              onClick={handleRejectAll}
            >
              <Icon name="xmark" class="w-3.5 h-3.5" />
              Reject All
            </Button>
          </Show>

          <div class="w-px h-4" style={{ background: "var(--border-weak)" }} />

          {/* Fullscreen toggle */}
          <IconButton
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={() => setIsFullscreen(!isFullscreen())}
            title={isFullscreen() ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen() ? (
              <Icon name="minimize" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            ) : (
              <Icon name="maximize" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            )}
          </IconButton>

          {/* Close button */}
          <Show when={props.onClose}>
            <IconButton
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              onClick={props.onClose}
              title="Close"
            >
              <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            </IconButton>
          </Show>
        </div>
      </div>

      {/* Main content */}
      <div class="flex flex-1 overflow-hidden">
        {/* File list sidebar */}
        <div
          class="shrink-0 overflow-y-auto border-r"
          style={{
            width: `${sidebarWidth()}px`,
            "border-color": "var(--border-weak)",
            background: "var(--surface-base)",
          }}
        >
          <FileSection title="Added" files={filesByStatus().added} />
          <FileSection title="Modified" files={filesByStatus().modified} />
          <FileSection title="Deleted" files={filesByStatus().deleted} />
          <FileSection title="Renamed" files={filesByStatus().renamed} />

          {/* Empty state */}
          <Show when={props.files.length === 0}>
            <div class="flex flex-col items-center justify-center h-full px-4 text-center">
              <Icon name="file" class="w-8 h-8 mb-2" style={{ color: "var(--text-weaker)" }} />
              <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                No changes to display
              </p>
            </div>
          </Show>
        </div>

        {/* Diff view */}
        <div class="flex-1 flex flex-col overflow-hidden">
          <Show when={selectedFile()}>
            {(file) => (
              <>
                {/* File header */}
                <div
                  class="flex items-center justify-between px-4 py-2 border-b shrink-0"
                  style={{
                    "border-color": "var(--border-weak)",
                    background: "var(--surface-base)",
                  }}
                >
                  <div class="flex items-center gap-2">
                    {getStatusIcon(file().status)}
                    <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                      {file().path}
                    </span>
                    <Show when={file().oldPath}>
                      <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                        ← {file().oldPath}
                      </span>
                    </Show>
                  </div>

                  <div class="flex items-center gap-2">
                    {/* Stats */}
                    <div class="flex items-center gap-2 text-xs">
                      <Text style={{ color: "var(--cortex-success)" }}>+{file().additions}</Text>
                      <Text style={{ color: "var(--cortex-error)" }}>-{file().deletions}</Text>
                    </div>

                    {/* Change navigation */}
                    <Show when={changeIndices().length > 0}>
                      <div class="flex items-center gap-1">
                        <IconButton
                          class="p-1 rounded hover:bg-white/10 transition-colors"
                          onClick={() => handleNavigateChange("prev")}
                          title="Previous change"
                        >
                          <Icon name="chevron-up" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
                        </IconButton>
                        <Text size="xs" style={{ color: "var(--text-weaker)" }}>
                          {currentChangeIndex() + 1}/{changeIndices().length}
                        </Text>
                        <IconButton
                          class="p-1 rounded hover:bg-white/10 transition-colors"
                          onClick={() => handleNavigateChange("next")}
                          title="Next change"
                        >
                          <Icon name="chevron-down" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
                        </IconButton>
                      </div>
                    </Show>

                    {/* Copy button */}
                    <IconButton
                      class="p-1.5 rounded hover:bg-white/10 transition-colors"
                      onClick={() => handleCopyDiff(file().id, file().patch)}
                      title="Copy diff"
                    >
                      {copiedId() === file().id ? (
                        <Icon name="check" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
                      ) : (
                        <Icon name="copy" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                      )}
                    </IconButton>

                    {/* Accept/Reject buttons */}
                    <Show when={showControls()}>
                      <div class="flex items-center gap-1">
                        <IconButton
                          class={`p-1.5 rounded transition-colors ${
                            decisions()[file().id] === "accepted"
                              ? "bg-green-500/20"
                              : "hover:bg-white/10"
                          }`}
                          onClick={() => handleAccept(file().id)}
                          title="Accept this file"
                        >
                          <Icon
                            name="check"
                            class="w-4 h-4"
                            style={{
                              color:
                                decisions()[file().id] === "accepted"
                                  ? "var(--cortex-success)"
                                  : "var(--text-weak)",
                            }}
                          />
                        </IconButton>
                        <IconButton
                          class={`p-1.5 rounded transition-colors ${
                            decisions()[file().id] === "rejected"
                              ? "bg-red-500/20"
                              : "hover:bg-white/10"
                          }`}
                          onClick={() => handleReject(file().id)}
                          title="Reject this file"
                        >
                          <Icon
                            name="xmark"
                            class="w-4 h-4"
                            style={{
                              color:
                                decisions()[file().id] === "rejected"
                                  ? "var(--cortex-error)"
                                  : "var(--text-weak)",
                            }}
                          />
                        </IconButton>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Diff content */}
                <div class="flex-1 overflow-auto font-mono text-sm">
                  <Show when={file().binary}>
                    <div class="flex items-center justify-center h-full">
                      <span style={{ color: "var(--text-weak)" }}>Binary file changed</span>
                    </div>
                  </Show>

                  <Show when={!file().binary && parsedDiff().length === 0}>
                    <div class="flex items-center justify-center h-full">
                      <span style={{ color: "var(--text-weak)" }}>No changes in this file</span>
                    </div>
                  </Show>

                  <Show when={!file().binary && parsedDiff().length > 0}>
                    <div>
                      {(() => {
                        let lineIndex = 0;
                        return (
                          <For each={parsedDiff()}>
                            {(hunk) => (
                              <div class="mb-4">
                                {/* Hunk header */}
                                <div
                                  data-line-index={lineIndex++}
                                  class="px-4 py-1 sticky top-0"
                                  style={{
                                    background: "rgba(56, 139, 253, 0.1)",
                                    color: "var(--cortex-info)",
                                  }}
                                >
                                  {hunk.header}
                                </div>

                                {/* Lines */}
                                <For each={hunk.lines}>
                                  {(line) => {
                                    const currentLineIndex = lineIndex++;
                                    const isHighlighted =
                                      changeIndices()[currentChangeIndex()] === currentLineIndex;

                                    return (
                                      <div
                                        data-line-index={currentLineIndex}
                                        class={`flex ${isHighlighted ? "ring-1 ring-blue-500" : ""}`}
                                        style={{ background: getLineBackground(line.type) }}
                                      >
                                        {/* Old line number */}
                                        <span
                                          class="w-12 shrink-0 text-right pr-2 select-none"
                                          style={{ color: "var(--text-weaker)" }}
                                        >
                                          {line.type !== "add" ? line.oldLine : ""}
                                        </span>
                                        {/* New line number */}
                                        <span
                                          class="w-12 shrink-0 text-right pr-2 select-none border-r"
                                          style={{
                                            color: "var(--text-weaker)",
                                            "border-color": "var(--border-weak)",
                                          }}
                                        >
                                          {line.type !== "remove" ? line.newLine : ""}
                                        </span>
                                        {/* Content */}
                                        <pre
                                          class="flex-1 px-3 py-0"
                                          style={{ color: getLineColor(line.type) }}
                                        >
                                          <span class="select-none opacity-50">
                                            {line.type === "add"
                                              ? "+"
                                              : line.type === "remove"
                                                ? "-"
                                                : " "}
                                          </span>
                                          {line.content}
                                        </pre>
                                      </div>
                                    );
                                  }}
                                </For>
                              </div>
                            )}
                          </For>
                        );
                      })()}
                    </div>
                  </Show>
                </div>
              </>
            )}
          </Show>

          {/* Empty state when no file selected */}
          <Show when={!selectedFile() && props.files.length > 0}>
            <div class="flex flex-col items-center justify-center h-full">
              <Icon name="file" class="w-10 h-10 mb-3" style={{ color: "var(--text-weaker)" }} />
              <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                Select a file to view changes
              </p>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

export default MultiDiffView;


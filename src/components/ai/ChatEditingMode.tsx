import { For, Show, createMemo, createSignal } from "solid-js";
import { parsePatch } from "diff";
import { Icon } from "../ui/Icon";
import { useChatEditing, type FileChange, type ChangeStatus } from "@/context/ChatEditingContext";

interface DiffLineData {
  type: "add" | "remove" | "context" | "header";
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface FileGroupData {
  filePath: string;
  fileName: string;
  changes: FileChange[];
  totalAdded: number;
  totalRemoved: number;
}

function parseDiffLines(patch: string): DiffLineData[] {
  const lines: DiffLineData[] = [];
  
  try {
    const parsed = parsePatch(patch);
    
    for (const diff of parsed) {
      lines.push({
        type: "header",
        content: `--- ${diff.oldFileName || "a"}`,
      });
      lines.push({
        type: "header",
        content: `+++ ${diff.newFileName || "b"}`,
      });
      
      for (const hunk of diff.hunks) {
        lines.push({
          type: "header",
          content: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
        });
        
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
      }
    }
  } catch {
    lines.push({
      type: "context",
      content: "Unable to parse diff",
    });
  }
  
  return lines;
}

function getStatusIcon(status: ChangeStatus) {
  switch (status) {
    case "accepted":
      return <Icon name="circle-check" class="w-4 h-4" style={{ color: "var(--success)" }} />;
    case "rejected":
      return <Icon name="circle-xmark" class="w-4 h-4" style={{ color: "var(--error)" }} />;
    default:
      return <Icon name="clock" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />;
  }
}

function getStatusBadgeStyle(status: ChangeStatus): string {
  switch (status) {
    case "accepted":
      return "background: rgba(46, 160, 67, 0.15); color: var(--success);";
    case "rejected":
      return "background: rgba(248, 81, 73, 0.15); color: var(--error);";
    default:
      return "background: rgba(136, 146, 157, 0.15); color: var(--text-weak);";
  }
}

function DiffBlock(props: { patch: string; expanded: boolean }) {
  const lines = createMemo(() => parseDiffLines(props.patch));
  
  return (
    <Show when={props.expanded}>
      <div class="overflow-hidden rounded border" style={{ "border-color": "var(--border-weak)" }}>
        <div class="overflow-x-auto">
          <table class="w-full text-xs font-mono" style={{ "border-collapse": "collapse" }}>
            <tbody>
              <For each={lines()}>
                {(line) => (
                  <tr
                    style={{
                      background:
                        line.type === "add"
                          ? "rgba(46, 160, 67, 0.1)"
                          : line.type === "remove"
                          ? "rgba(248, 81, 73, 0.1)"
                          : line.type === "header"
                          ? "var(--surface-active)"
                          : "transparent",
                    }}
                  >
                    <td
                      class="select-none px-2 py-0.5 text-right border-r"
                      style={{
                        color: "var(--text-muted)",
                        "border-color": "var(--border-weak)",
                        width: "40px",
                        "min-width": "40px",
                      }}
                    >
                      {line.type !== "header" && line.type !== "add" ? line.oldLine : ""}
                    </td>
                    <td
                      class="select-none px-2 py-0.5 text-right border-r"
                      style={{
                        color: "var(--text-muted)",
                        "border-color": "var(--border-weak)",
                        width: "40px",
                        "min-width": "40px",
                      }}
                    >
                      {line.type !== "header" && line.type !== "remove" ? line.newLine : ""}
                    </td>
                    <td
                      class="select-none px-1 py-0.5 text-center"
                      style={{
                        width: "20px",
                        "min-width": "20px",
                        color:
                          line.type === "add"
                            ? "var(--success)"
                            : line.type === "remove"
                            ? "var(--error)"
                            : "var(--text-muted)",
                      }}
                    >
                      {line.type === "add" ? "+" : line.type === "remove" ? "-" : line.type === "header" ? "" : " "}
                    </td>
                    <td
                      class="px-2 py-0.5 whitespace-pre"
                      style={{
                        color:
                          line.type === "header"
                            ? "var(--text-muted)"
                            : line.type === "add"
                            ? "var(--success)"
                            : line.type === "remove"
                            ? "var(--error)"
                            : "var(--text-base)",
                      }}
                    >
                      {line.content}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </Show>
  );
}

function ChangeItem(props: {
  change: FileChange;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div
      class="rounded border transition-colors"
      style={{
        "border-color": props.selected ? "var(--accent-primary)" : "var(--border-weak)",
        background: props.selected ? "rgba(88, 166, 255, 0.05)" : "transparent",
      }}
    >
      <div
        class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={props.onSelect}
      >
        <button
          class="p-0.5 rounded hover:bg-white/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            props.onToggleExpand();
          }}
        >
{props.expanded ? (
            <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          ) : (
            <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          )}
        </button>
        
        {getStatusIcon(props.change.status)}
        
        <span class="flex-1 text-sm truncate" style={{ color: "var(--text-base)" }}>
          {props.change.fileName}
        </span>
        
        <div class="flex items-center gap-1 text-xs">
          <span class="flex items-center gap-0.5" style={{ color: "var(--success)" }}>
            <Icon name="plus" class="w-3 h-3" />
            {props.change.addedLines}
          </span>
          <span class="flex items-center gap-0.5" style={{ color: "var(--error)" }}>
            <Icon name="minus" class="w-3 h-3" />
            {props.change.removedLines}
          </span>
        </div>
        
        <span
          class="px-1.5 py-0.5 text-xs rounded capitalize"
          style={getStatusBadgeStyle(props.change.status)}
        >
          {props.change.status}
        </span>
        
        <Show when={props.change.status === "pending"}>
          <div class="flex items-center gap-1">
            <button
              class="p-1 rounded transition-colors hover:bg-white/10"
              style={{ color: "var(--success)" }}
              onClick={(e) => {
                e.stopPropagation();
                props.onAccept();
              }}
              title="Accept change"
            >
              <Icon name="check" class="w-4 h-4" />
            </button>
            <button
              class="p-1 rounded transition-colors hover:bg-white/10"
              style={{ color: "var(--error)" }}
              onClick={(e) => {
                e.stopPropagation();
                props.onReject();
              }}
              title="Reject change"
            >
              <Icon name="xmark" class="w-4 h-4" />
            </button>
          </div>
        </Show>
      </div>
      
      <DiffBlock patch={props.change.patch} expanded={props.expanded} />
    </div>
  );
}

function FileGroup(props: {
  group: FileGroupData;
  expandedFiles: Set<string>;
  selectedChangeId: string | null;
  onToggleFile: (filePath: string) => void;
  onSelectChange: (changeId: string) => void;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
}) {
  const isExpanded = createMemo(() => props.expandedFiles.has(props.group.filePath));
  const [expandedChanges, setExpandedChanges] = createSignal<Set<string>>(new Set());
  
  const toggleChangeExpanded = (changeId: string) => {
    setExpandedChanges((prev) => {
      const next = new Set(prev);
      if (next.has(changeId)) {
        next.delete(changeId);
      } else {
        next.add(changeId);
      }
      return next;
    });
  };
  
  const allAccepted = createMemo(() =>
    props.group.changes.every((c) => c.status === "accepted")
  );
  
  const allRejected = createMemo(() =>
    props.group.changes.every((c) => c.status === "rejected")
  );
  
  const hasPending = createMemo(() =>
    props.group.changes.some((c) => c.status === "pending")
  );
  
  return (
    <div
      class="rounded-lg border overflow-hidden"
      style={{ "border-color": "var(--border-weak)", background: "var(--surface-base)" }}
    >
      <div
        class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
        style={{ background: "var(--surface-active)" }}
        onClick={() => props.onToggleFile(props.group.filePath)}
      >
        <button class="p-0.5">
{isExpanded() ? (
            <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          ) : (
            <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          )}
        </button>
        
        <Icon name="file" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
        
        <span class="flex-1 text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>
          {props.group.fileName}
        </span>
        
        <Show when={allAccepted()}>
          <Icon name="circle-check" class="w-4 h-4" style={{ color: "var(--success)" }} />
        </Show>
        <Show when={allRejected()}>
          <Icon name="circle-xmark" class="w-4 h-4" style={{ color: "var(--error)" }} />
        </Show>
        <Show when={hasPending() && !allAccepted() && !allRejected()}>
          <Icon name="circle-exclamation" class="w-4 h-4" style={{ color: "var(--warning)" }} />
        </Show>
        
        <div class="flex items-center gap-2 text-xs">
          <span style={{ color: "var(--text-muted)" }}>
            {props.group.changes.length} change{props.group.changes.length !== 1 ? "s" : ""}
          </span>
          <span class="flex items-center gap-0.5" style={{ color: "var(--success)" }}>
            <Icon name="plus" class="w-3 h-3" />
            {props.group.totalAdded}
          </span>
          <span class="flex items-center gap-0.5" style={{ color: "var(--error)" }}>
            <Icon name="minus" class="w-3 h-3" />
            {props.group.totalRemoved}
          </span>
        </div>
      </div>
      
      <Show when={isExpanded()}>
        <div class="p-2 space-y-2">
          <For each={props.group.changes}>
            {(change) => (
              <ChangeItem
                change={change}
                expanded={expandedChanges().has(change.id)}
                selected={props.selectedChangeId === change.id}
                onToggleExpand={() => toggleChangeExpanded(change.id)}
                onSelect={() => props.onSelectChange(change.id)}
                onAccept={() => props.onAcceptChange(change.id)}
                onReject={() => props.onRejectChange(change.id)}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

function WorkingSetIndicator(props: { files: Set<string> }) {
  const fileCount = createMemo(() => props.files.size);
  
  return (
    <Show when={fileCount() > 0}>
      <div
        class="flex items-center gap-2 px-3 py-2 rounded border"
        style={{
          "border-color": "var(--border-weak)",
          background: "var(--surface-active)",
        }}
      >
        <Icon name="pen" class="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
        <span class="text-sm" style={{ color: "var(--text-base)" }}>
          Working Set: {fileCount()} file{fileCount() !== 1 ? "s" : ""}
        </span>
        <div class="flex-1" />
        <div class="flex items-center gap-1 flex-wrap max-w-[200px]">
          <For each={Array.from(props.files).slice(0, 3)}>
            {(file) => {
              const fileName = file.split("/").pop() || file.split("\\").pop() || file;
              return (
                <span
                  class="px-1.5 py-0.5 text-xs rounded truncate max-w-[60px]"
                  style={{
                    background: "var(--surface-raised)",
                    color: "var(--text-weak)",
                  }}
                  title={file}
                >
                  {fileName}
                </span>
              );
            }}
          </For>
          <Show when={fileCount() > 3}>
            <span class="text-xs" style={{ color: "var(--text-muted)" }}>
              +{fileCount() - 3} more
            </span>
          </Show>
        </div>
      </div>
    </Show>
  );
}

function ProgressIndicator(props: { progress: number; currentFile?: string; status: string }) {
  return (
    <div
      class="flex flex-col gap-2 p-3 rounded border"
      style={{
        "border-color": "var(--border-weak)",
        background: "var(--surface-active)",
      }}
    >
      <div class="flex items-center gap-2">
        <Show when={props.status === "generating" || props.status === "applying"}>
          <Icon name="spinner" class="w-4 h-4 animate-spin" style={{ color: "var(--accent-primary)" }} />
        </Show>
        <Show when={props.status === "completed"}>
          <Icon name="circle-check" class="w-4 h-4" style={{ color: "var(--success)" }} />
        </Show>
        <Show when={props.status === "cancelled"}>
          <Icon name="circle-xmark" class="w-4 h-4" style={{ color: "var(--error)" }} />
        </Show>
        
        <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
          {props.status === "generating"
            ? "AI is generating changes..."
            : props.status === "applying"
            ? "Applying changes..."
            : props.status === "completed"
            ? "Changes applied successfully"
            : props.status === "cancelled"
            ? "Session cancelled"
            : "Ready to review"}
        </span>
        
        <Show when={props.currentFile && (props.status === "generating" || props.status === "applying")}>
          <span class="text-xs" style={{ color: "var(--text-muted)" }}>
            {props.currentFile}
          </span>
        </Show>
      </div>
      
      <Show when={props.status === "generating" || props.status === "applying"}>
        <div class="relative h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-base)" }}>
          <div
            class="absolute top-0 left-0 h-full rounded-full transition-all duration-300"
            style={{
              width: `${props.progress}%`,
              background: "var(--accent-primary)",
            }}
          />
        </div>
        <div class="text-xs text-right" style={{ color: "var(--text-muted)" }}>
          {Math.round(props.progress)}%
        </div>
      </Show>
    </div>
  );
}

export function ChatEditingMode() {
  const chatEditing = useChatEditing();
  
  const fileGroups = createMemo(() => {
    const groups: Map<string, FileGroupData> = new Map();
    
    for (const change of chatEditing.state.pendingChanges.values()) {
      const existing = groups.get(change.filePath);
      if (existing) {
        existing.changes.push(change);
        existing.totalAdded += change.addedLines;
        existing.totalRemoved += change.removedLines;
      } else {
        groups.set(change.filePath, {
          filePath: change.filePath,
          fileName: change.fileName,
          changes: [change],
          totalAdded: change.addedLines,
          totalRemoved: change.removedLines,
        });
      }
    }
    
    return Array.from(groups.values()).sort((a, b) =>
      a.fileName.localeCompare(b.fileName)
    );
  });
  
  const stats = createMemo(() => chatEditing.getTotalStats());
  const pendingCount = createMemo(() => chatEditing.getPendingCount());
  const acceptedCount = createMemo(() => chatEditing.getAcceptedCount());
  const rejectedCount = createMemo(() => chatEditing.getRejectedCount());
  const hasChanges = createMemo(() => chatEditing.state.pendingChanges.size > 0);
  const hasAccepted = createMemo(() => acceptedCount() > 0);
  const hasPending = createMemo(() => pendingCount() > 0);
  
  const sessionStatus = createMemo(() => chatEditing.state.session?.status || "ready");
  const isGenerating = createMemo(() => sessionStatus() === "generating");
  const isApplying = createMemo(() => sessionStatus() === "applying");
  const isDisabled = createMemo(() => isGenerating() || isApplying());
  
  return (
    <Show when={chatEditing.state.isActive && chatEditing.state.session}>
      <div
        class="flex flex-col h-full"
        style={{ background: "var(--background-base)" }}
      >
        {/* Header */}
        <div
          class="flex items-center justify-between px-4 py-3 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <div class="flex items-center gap-3">
            <Icon name="pen" class="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
            <div>
              <h2 class="text-sm font-semibold" style={{ color: "var(--text-base)" }}>
                Chat Editing Mode
              </h2>
              <p class="text-xs" style={{ color: "var(--text-muted)" }}>
                {chatEditing.state.session!.prompt.length > 50
                  ? chatEditing.state.session!.prompt.slice(0, 50) + "..."
                  : chatEditing.state.session!.prompt}
              </p>
            </div>
          </div>
          
          <button
            class="p-1.5 rounded transition-colors hover:bg-white/10"
            style={{ color: "var(--text-weak)" }}
            onClick={() => chatEditing.endSession()}
            title="Close editing mode"
          >
            <Icon name="xmark" class="w-5 h-5" />
          </button>
        </div>
        
        {/* Stats Bar */}
        <Show when={hasChanges()}>
          <div
            class="flex items-center gap-4 px-4 py-2 border-b text-xs"
            style={{ "border-color": "var(--border-weak)", background: "var(--surface-base)" }}
          >
            <span style={{ color: "var(--text-base)" }}>
              {stats().files} file{stats().files !== 1 ? "s" : ""}
            </span>
            <span class="flex items-center gap-1" style={{ color: "var(--success)" }}>
              <Icon name="plus" class="w-3 h-3" />
              {stats().added} added
            </span>
            <span class="flex items-center gap-1" style={{ color: "var(--error)" }}>
              <Icon name="minus" class="w-3 h-3" />
              {stats().removed} removed
            </span>
            <div class="flex-1" />
            <span style={{ color: "var(--text-muted)" }}>
              {pendingCount()} pending · {acceptedCount()} accepted · {rejectedCount()} rejected
            </span>
          </div>
        </Show>
        
        {/* Content */}
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Progress Indicator */}
          <Show when={chatEditing.state.session}>
            <ProgressIndicator
              progress={chatEditing.state.session!.progress}
              currentFile={chatEditing.state.session!.currentFile}
              status={chatEditing.state.session!.status}
            />
          </Show>
          
          {/* Error Display */}
          <Show when={chatEditing.state.session?.error}>
            <div
              class="p-3 rounded border"
              style={{
                "border-color": "var(--error)",
                background: "rgba(248, 81, 73, 0.1)",
              }}
            >
              <div class="flex items-center gap-2 mb-2">
                <Icon name="circle-exclamation" class="w-4 h-4" style={{ color: "var(--error)" }} />
                <span class="text-sm font-medium" style={{ color: "var(--error)" }}>
                  Error
                </span>
              </div>
              <pre class="text-xs whitespace-pre-wrap" style={{ color: "var(--text-base)" }}>
                {chatEditing.state.session!.error}
              </pre>
            </div>
          </Show>
          
          {/* Working Set Indicator */}
          <WorkingSetIndicator files={chatEditing.state.workingSet} />
          
          {/* File Groups */}
          <Show
            when={hasChanges()}
            fallback={
              <div
                class="flex flex-col items-center justify-center py-12 text-center"
                style={{ color: "var(--text-muted)" }}
              >
                <Icon name="file" class="w-12 h-12 mb-4 opacity-50" />
                <p class="text-sm">No changes yet</p>
                <p class="text-xs mt-1">AI is analyzing your request...</p>
              </div>
            }
          >
            <div class="space-y-3">
              <For each={fileGroups()}>
                {(group) => (
                  <FileGroup
                    group={group}
                    expandedFiles={chatEditing.state.expandedFiles}
                    selectedChangeId={chatEditing.state.selectedChangeId}
                    onToggleFile={(path) => chatEditing.toggleFileExpanded(path)}
                    onSelectChange={(id) => chatEditing.setSelectedChange(id)}
                    onAcceptChange={(id) => chatEditing.acceptChange(id)}
                    onRejectChange={(id) => chatEditing.rejectChange(id)}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
        
        {/* Footer Actions */}
        <Show when={hasChanges()}>
          <div
            class="flex items-center justify-between px-4 py-3 border-t"
            style={{ "border-color": "var(--border-weak)", background: "var(--surface-base)" }}
          >
            <div class="flex items-center gap-2">
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors"
                style={{
                  background: "var(--surface-active)",
                  color: "var(--success)",
                  opacity: isDisabled() || !hasPending() ? 0.5 : 1,
                }}
                disabled={isDisabled() || !hasPending()}
                onClick={() => chatEditing.acceptAll()}
              >
                <Icon name="circle-check" class="w-4 h-4" />
                Accept All
              </button>
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors"
                style={{
                  background: "var(--surface-active)",
                  color: "var(--error)",
                  opacity: isDisabled() || !hasPending() ? 0.5 : 1,
                }}
                disabled={isDisabled() || !hasPending()}
                onClick={() => chatEditing.rejectAll()}
              >
                <Icon name="circle-xmark" class="w-4 h-4" />
                Reject All
              </button>
            </div>
            
            <div class="flex items-center gap-2">
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors hover:bg-white/10"
                style={{
                  color: "var(--text-weak)",
                  opacity: isDisabled() ? 0.5 : 1,
                }}
                disabled={isDisabled()}
                onClick={() => chatEditing.discardSession()}
              >
                <Icon name="trash" class="w-4 h-4" />
                Discard
              </button>
              <button
                class="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded transition-colors"
                style={{
                  background: hasAccepted() && !isDisabled() ? "var(--accent-primary)" : "var(--surface-active)",
                  color: hasAccepted() && !isDisabled() ? "white" : "var(--text-base)",
                  opacity: !hasAccepted() || isDisabled() ? 0.5 : 1,
                }}
                disabled={!hasAccepted() || isDisabled()}
                onClick={() => chatEditing.applyAccepted()}
              >
                <Show when={isApplying()} fallback={<Icon name="check" class="w-4 h-4" />}>
                  <Icon name="spinner" class="w-4 h-4 animate-spin" />
                </Show>
                {isApplying() ? "Applying..." : "Apply Changes"}
              </button>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

export function ChatEditingModeCompact() {
  const chatEditing = useChatEditing();
  
  const pendingCount = createMemo(() => chatEditing.getPendingCount());
  const acceptedCount = createMemo(() => chatEditing.getAcceptedCount());
  const stats = createMemo(() => chatEditing.getTotalStats());
  const isActive = createMemo(() => chatEditing.state.isActive);
  const isGenerating = createMemo(() => chatEditing.state.session?.status === "generating");
  
  return (
    <Show when={isActive()}>
      <div
        class="flex items-center gap-3 px-3 py-2 rounded-lg border"
        style={{
          "border-color": "var(--accent-primary)",
          background: "rgba(88, 166, 255, 0.1)",
        }}
      >
        <Show when={isGenerating()} fallback={<Icon name="pen" class="w-4 h-4" style={{ color: "var(--accent-primary)" }} />}>
          <Icon name="spinner" class="w-4 h-4 animate-spin" style={{ color: "var(--accent-primary)" }} />
        </Show>
        
        <span class="text-sm" style={{ color: "var(--text-base)" }}>
          {isGenerating() ? "Generating..." : "Editing Mode"}
        </span>
        
        <Show when={stats().files > 0}>
          <span class="text-xs" style={{ color: "var(--text-muted)" }}>
            {stats().files} file{stats().files !== 1 ? "s" : ""} ·{" "}
            {pendingCount()} pending ·{" "}
            {acceptedCount()} accepted
          </span>
        </Show>
        
        <div class="flex-1" />
        
        <button
          class="p-1 rounded transition-colors hover:bg-white/10"
          style={{ color: "var(--text-weak)" }}
          onClick={() => chatEditing.endSession()}
          title="Close editing mode"
        >
          <Icon name="xmark" class="w-4 h-4" />
        </button>
      </div>
    </Show>
  );
}

export function useChatEditingMode() {
  const chatEditing = useChatEditing();
  
  return {
    isActive: () => chatEditing.state.isActive,
    session: () => chatEditing.state.session,
    startSession: chatEditing.startSession,
    endSession: chatEditing.endSession,
    addChange: chatEditing.addChange,
    acceptAll: chatEditing.acceptAll,
    rejectAll: chatEditing.rejectAll,
    applyAccepted: chatEditing.applyAccepted,
    discardSession: chatEditing.discardSession,
    getPendingCount: chatEditing.getPendingCount,
    getAcceptedCount: chatEditing.getAcceptedCount,
    getTotalStats: chatEditing.getTotalStats,
  };
}

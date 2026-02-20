/**
 * MergeEditor - 3-way merge conflict resolution component
 *
 * Features:
 * - Displays merge conflicts with current (ours) and incoming (theirs) sections
 * - Per-conflict resolution: Accept Current, Accept Incoming, Accept Both, Edit Manually
 * - Bulk actions: Accept All Current, Accept All Incoming, Abort Merge
 * - Bottom bar with Save & Continue when all conflicts are resolved
 */
import { createSignal, createMemo, Show, For, type JSX } from "solid-js";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";

type Resolution = "current" | "incoming" | "both" | "custom";

interface Conflict {
  id: string;
  currentContent: string;
  incomingContent: string;
  baseContent: string;
  resolution: Resolution | null;
  customContent?: string;
}

export interface MergeEditorProps {
  filePath: string;
  conflicts: Conflict[];
  onResolve: (conflictId: string, resolution: Resolution, customContent?: string) => void;
  onAcceptAllCurrent: () => void;
  onAcceptAllIncoming: () => void;
  onSave: () => void;
  onAbort: () => void;
  onClose: () => void;
}

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace";

const codeBlock = (border: string, bg: string): JSX.CSSProperties => ({
  "border-left": `3px solid ${border}`,
  background: bg,
  padding: "8px 12px",
  "font-family": MONO,
  "font-size": "13px",
  "line-height": "1.5",
  "white-space": "pre-wrap",
  "word-break": "break-all",
  "overflow-x": "auto",
  color: "var(--cortex-text-primary)",
});

// ============================================================================
// ConflictChunk
// ============================================================================

interface ConflictChunkProps {
  conflict: Conflict;
  index: number;
  total: number;
  onResolve: (id: string, res: Resolution, custom?: string) => void;
}

export function ConflictChunk(props: ConflictChunkProps) {
  const [editing, setEditing] = createSignal(false);
  const [editContent, setEditContent] = createSignal("");
  const isResolved = () => props.conflict.resolution !== null;

  const resolvedContent = createMemo(() => {
    const c = props.conflict;
    if (c.resolution === "current") return c.currentContent;
    if (c.resolution === "incoming") return c.incomingContent;
    if (c.resolution === "both") return c.currentContent + "\n" + c.incomingContent;
    if (c.resolution === "custom") return c.customContent ?? "";
    return "";
  });

  const handleEditManually = () => {
    const c = props.conflict;
    setEditContent(c.resolution === "custom" && c.customContent ? c.customContent : c.currentContent);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    props.onResolve(props.conflict.id, "custom", editContent());
    setEditing(false);
  };

  const label = (color: string): JSX.CSSProperties => ({
    "font-size": "11px", "font-weight": "600", "text-transform": "uppercase",
    "letter-spacing": "0.5px", color, padding: "4px 12px",
  });

  return (
    <div style={{ border: "1px solid var(--cortex-bg-secondary)", "border-radius": "6px", overflow: "hidden", background: "var(--cortex-bg-primary)" }}>
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "6px 12px", background: "var(--cortex-bg-secondary)", "font-size": "12px", "font-weight": "600", color: "var(--cortex-text-primary)" }}>
        <span>Conflict {props.index + 1} of {props.total}</span>
        <Show when={isResolved()}>
          <span style={{ color: "var(--cortex-success)", "font-weight": "500" }}>✓ Resolved ({props.conflict.resolution})</span>
        </Show>
      </div>

      <Show when={!editing()}>
        <div style={label("#4ec9b0")}>Current (Ours)</div>
        <div style={codeBlock("#4ec9b0", "rgba(78, 201, 176, 0.1)")}>{props.conflict.currentContent}</div>
        <div style={label("#569cd6")}>Incoming (Theirs)</div>
        <div style={codeBlock("#569cd6", "rgba(86, 156, 214, 0.1)")}>{props.conflict.incomingContent}</div>
      </Show>

      <Show when={editing()}>
        <div style={{ padding: "8px 12px" }}>
          <textarea
            style={{ width: "100%", "min-height": "100px", padding: "8px 12px", "font-family": MONO, "font-size": "13px", "line-height": "1.5", background: "var(--cortex-bg-primary)", color: "var(--cortex-text-primary)", border: "1px solid var(--cortex-info)", "border-radius": "4px", resize: "vertical" }}
            value={editContent()}
            onInput={(e) => setEditContent(e.currentTarget.value)}
          />
          <div style={{ display: "flex", gap: "6px", "margin-top": "6px" }}>
            <Button variant="primary" size="sm" onClick={handleSaveEdit}>Apply</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      </Show>

      <Show when={!editing()}>
        <div style={{ display: "flex", gap: "6px", padding: "8px 12px", "flex-wrap": "wrap", "border-top": "1px solid var(--cortex-bg-secondary)" }}>
          <Button variant="ghost" size="sm" onClick={() => props.onResolve(props.conflict.id, "current")}>
            <Icon name="check" size={12} /> Accept Current
          </Button>
          <Button variant="ghost" size="sm" onClick={() => props.onResolve(props.conflict.id, "incoming")}>
            <Icon name="download" size={12} /> Accept Incoming
          </Button>
          <Button variant="ghost" size="sm" onClick={() => props.onResolve(props.conflict.id, "both")}>
            <Icon name="layer-group" size={12} /> Accept Both
          </Button>
          <Button variant="ghost" size="sm" onClick={handleEditManually}>
            <Icon name="pen" size={12} /> Edit Manually
          </Button>
        </div>
      </Show>

      <Show when={isResolved() && !editing()}>
        <div style={{ display: "flex", "align-items": "center", gap: "6px", padding: "6px 12px", background: "rgba(78, 201, 176, 0.08)", "font-size": "12px", color: "var(--cortex-success)", "border-top": "1px solid var(--cortex-bg-secondary)" }}>
          <Icon name="check-circle" size={14} />
          <span>Resolved content:</span>
        </div>
        <div style={codeBlock("#808080", "rgba(128, 128, 128, 0.1)")}>{resolvedContent()}</div>
      </Show>
    </div>
  );
}

// ============================================================================
// MergeEditor
// ============================================================================

export function MergeEditor(props: MergeEditorProps) {
  const allResolved = createMemo(() =>
    props.conflicts.length > 0 && props.conflicts.every((c) => c.resolution !== null)
  );
  const resolvedCount = createMemo(() =>
    props.conflicts.filter((c) => c.resolution !== null).length
  );

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", background: "var(--cortex-bg-primary)", color: "var(--cortex-text-primary)" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "8px 12px", background: "var(--cortex-bg-secondary)", "border-bottom": "1px solid var(--cortex-bg-secondary)", "flex-shrink": "0", gap: "12px" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "10px", "min-width": "0", flex: "1" }}>
          <Icon name="code-merge" size={16} />
          <span style={{ "font-family": MONO, "font-size": "13px", "font-weight": "500", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }} title={props.filePath}>
            {props.filePath}
          </span>
          <span style={{ "font-size": "11px", padding: "2px 8px", "border-radius": "10px", background: "var(--cortex-error)", color: "var(--cortex-text-primary)", "white-space": "nowrap", "flex-shrink": "0" }}>
            {props.conflicts.length} conflict{props.conflicts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "6px", "flex-shrink": "0" }}>
          <Button variant="ghost" size="sm" onClick={props.onAcceptAllCurrent}>Accept All Current</Button>
          <Button variant="ghost" size="sm" onClick={props.onAcceptAllIncoming}>Accept All Incoming</Button>
          <Button variant="danger" size="sm" onClick={props.onAbort}>Abort Merge</Button>
          <Button variant="ghost" size="sm" onClick={props.onClose}><Icon name="xmark" size={14} /></Button>
        </div>
      </div>

      {/* Conflict list */}
      <div style={{ flex: "1", "overflow-y": "auto", padding: "12px", display: "flex", "flex-direction": "column", gap: "12px" }}>
        <For each={props.conflicts}>
          {(conflict, index) => (
            <ConflictChunk conflict={conflict} index={index()} total={props.conflicts.length} onResolve={props.onResolve} />
          )}
        </For>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "8px 12px", background: "var(--cortex-bg-secondary)", "border-top": "1px solid var(--cortex-bg-secondary)", "flex-shrink": "0" }}>
        <span style={{ "font-size": "12px", color: allResolved() ? "var(--cortex-success)" : "var(--cortex-text-inactive)" }}>
          {resolvedCount()} of {props.conflicts.length} conflicts resolved
        </span>
        <Button variant="primary" size="sm" disabled={!allResolved()} onClick={props.onSave}>
          <Icon name="check" size={14} /> Save &amp; Continue Merge
        </Button>
      </div>
    </div>
  );
}

export default MergeEditor;

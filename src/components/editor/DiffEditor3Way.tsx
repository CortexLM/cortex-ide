import {
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  Show,
  Component,
  JSX,
} from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { MonacoManager } from "@/utils/monacoManager";
import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";

export interface ConflictMarker {
  id: string;
  index: number;
  startLine: number;
  endLine: number;
  separatorLine: number;
  baseMarkerLine?: number;
  currentContent: string[];
  incomingContent: string[];
  baseContent?: string[];
  currentLabel: string;
  incomingLabel: string;
  resolved: boolean;
  resolution?: "current" | "incoming" | "both" | "both-reverse";
  resolvedContent?: string[];
}

export interface DiffEditor3WayProps {
  filePath: string;
  conflictedContent: string;
  language?: string;
  onSave?: (mergedContent: string) => void;
  onCancel?: () => void;
  onAllResolved?: () => void;
  readOnly?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
}

function parseConflictMarkers(content: string): ConflictMarker[] {
  const lines = content.split("\n");
  const conflicts: ConflictMarker[] = [];
  let conflictIndex = 0;
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      const startLine = i + 1;
      const currentLabel = lines[i].replace(/^<{7}\s*/, "").trim() || "Current";
      const currentContent: string[] = [];
      const incomingContent: string[] = [];
      const baseContent: string[] = [];
      let separatorLine = -1;
      let baseMarkerLine: number | undefined;
      let endLine = -1;
      let inBase = false;
      let inIncoming = false;

      i++;
      while (i < lines.length) {
        if (lines[i].startsWith("|||||||")) {
          baseMarkerLine = i + 1;
          inBase = true;
          i++;
          continue;
        }
        if (lines[i].startsWith("=======")) {
          separatorLine = i + 1;
          inBase = false;
          inIncoming = true;
          i++;
          continue;
        }
        if (lines[i].startsWith(">>>>>>>")) {
          endLine = i + 1;
          break;
        }

        if (inIncoming) {
          incomingContent.push(lines[i]);
        } else if (inBase) {
          baseContent.push(lines[i]);
        } else {
          currentContent.push(lines[i]);
        }
        i++;
      }

      if (endLine > 0) {
        conflictIndex++;
        conflicts.push({
          id: `conflict-${conflictIndex}`,
          index: conflictIndex,
          startLine,
          endLine,
          separatorLine,
          baseMarkerLine,
          currentContent,
          incomingContent,
          baseContent: baseContent.length > 0 ? baseContent : undefined,
          currentLabel,
          incomingLabel: lines[i]?.replace(/^>{7}\s*/, "").trim() || "Incoming",
          resolved: false,
        });
      }
      i++;
    } else {
      i++;
    }
  }

  return conflicts;
}

function buildResolvedContent(
  originalContent: string,
  conflicts: ConflictMarker[]
): string {
  const lines = originalContent.split("\n");
  const result: string[] = [];
  let lineIndex = 0;

  for (const conflict of conflicts) {
    const startIdx = conflict.startLine - 1;
    while (lineIndex < startIdx) {
      result.push(lines[lineIndex]);
      lineIndex++;
    }

    if (conflict.resolved && conflict.resolvedContent) {
      result.push(...conflict.resolvedContent);
    } else {
      for (let j = startIdx; j < conflict.endLine; j++) {
        result.push(lines[j]);
      }
    }
    lineIndex = conflict.endLine;
  }

  while (lineIndex < lines.length) {
    result.push(lines[lineIndex]);
    lineIndex++;
  }

  return result.join("\n");
}

export const DiffEditor3Way: Component<DiffEditor3WayProps> = (props) => {
  const [conflicts, setConflicts] = createSignal<ConflictMarker[]>([]);
  const [activeConflict, setActiveConflict] = createSignal<number>(0);
  const [monacoInstance, setMonacoInstance] = createSignal<typeof Monaco | null>(null);
  const [currentEditor, setCurrentEditor] = createSignal<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [baseEditor, setBaseEditor] = createSignal<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [incomingEditor, setIncomingEditor] = createSignal<Monaco.editor.IStandaloneCodeEditor | null>(null);

  let currentRef: HTMLDivElement | undefined;
  let baseRef: HTMLDivElement | undefined;
  let incomingRef: HTMLDivElement | undefined;

  const resolvedCount = createMemo(() => conflicts().filter((c) => c.resolved).length);
  const totalCount = createMemo(() => conflicts().length);
  const allResolved = createMemo(() => totalCount() > 0 && resolvedCount() === totalCount());
  const currentConflict = createMemo(() => conflicts()[activeConflict()] ?? null);
  const language = createMemo(() => props.language ?? "plaintext");

  onMount(async () => {
    const parsed = parseConflictMarkers(props.conflictedContent);
    setConflicts(parsed);

    const monaco = await MonacoManager.getInstance().ensureLoaded();
    setMonacoInstance(monaco);

    if (currentRef && monaco) {
      const editor = monaco.editor.create(currentRef, {
        value: "",
        language: language(),
        readOnly: true,
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: 13,
      });
      setCurrentEditor(editor);
    }

    if (baseRef && monaco) {
      const editor = monaco.editor.create(baseRef, {
        value: "",
        language: language(),
        readOnly: true,
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: 13,
      });
      setBaseEditor(editor);
    }

    if (incomingRef && monaco) {
      const editor = monaco.editor.create(incomingRef, {
        value: "",
        language: language(),
        readOnly: true,
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: 13,
      });
      setIncomingEditor(editor);
    }
  });

  createEffect(() => {
    const conflict = currentConflict();
    const monaco = monacoInstance();
    if (!conflict || !monaco) return;

    const cur = currentEditor();
    const base = baseEditor();
    const inc = incomingEditor();

    if (cur) {
      const model = cur.getModel();
      if (model) {
        model.setValue(conflict.currentContent.join("\n"));
      }
    }

    if (base) {
      const model = base.getModel();
      if (model) {
        model.setValue(conflict.baseContent?.join("\n") ?? "(no base content available)");
      }
    }

    if (inc) {
      const model = inc.getModel();
      if (model) {
        model.setValue(conflict.incomingContent.join("\n"));
      }
    }
  });

  createEffect(() => {
    if (allResolved()) {
      props.onAllResolved?.();
    }
  });

  onCleanup(() => {
    currentEditor()?.dispose();
    baseEditor()?.dispose();
    incomingEditor()?.dispose();
  });

  const resolveConflict = (resolution: "current" | "incoming" | "both" | "both-reverse") => {
    const idx = activeConflict();
    const conflict = conflicts()[idx];
    if (!conflict) return;

    let resolvedContent: string[];
    switch (resolution) {
      case "current":
        resolvedContent = [...conflict.currentContent];
        break;
      case "incoming":
        resolvedContent = [...conflict.incomingContent];
        break;
      case "both":
        resolvedContent = [...conflict.currentContent, ...conflict.incomingContent];
        break;
      case "both-reverse":
        resolvedContent = [...conflict.incomingContent, ...conflict.currentContent];
        break;
    }

    setConflicts((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, resolved: true, resolution, resolvedContent } : c
      )
    );

    if (idx < totalCount() - 1) {
      setActiveConflict(idx + 1);
    }
  };

  const handleSave = async () => {
    const merged = buildResolvedContent(props.conflictedContent, conflicts());
    props.onSave?.(merged);

    try {
      await invoke("fs_write_file", {
        path: props.filePath,
        content: merged,
      });
    } catch (_e) {
      // onSave callback already received the content
    }
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    background: "var(--cortex-bg-primary)",
    ...props.style,
  });

  const toolbarStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 16px",
    background: "var(--cortex-bg-secondary)",
    "border-bottom": "1px solid var(--cortex-border-default)",
    gap: "12px",
  };

  const editorsContainerStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "1fr 1fr 1fr",
    flex: "1",
    overflow: "hidden",
    gap: "1px",
    background: "var(--cortex-border-default)",
  };

  const editorPaneStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    background: "var(--cortex-bg-primary)",
  };

  const paneLabelStyle = (color: string): JSX.CSSProperties => ({
    padding: "6px 12px",
    "font-size": "12px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
    background: "var(--cortex-bg-secondary)",
    "border-bottom": `2px solid ${color}`,
    display: "flex",
    "align-items": "center",
    gap: "8px",
  });

  const editorContainerStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "hidden",
  };

  const conflictNavStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 16px",
    background: "var(--cortex-bg-secondary)",
    "border-top": "1px solid var(--cortex-border-default)",
  };

  const actionButtonStyle = (color: string): JSX.CSSProperties => ({
    padding: "4px 12px",
    "font-size": "12px",
    "border-radius": "var(--cortex-radius-sm)",
    border: `1px solid ${color}`,
    background: "transparent",
    color: color,
    cursor: "pointer",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={toolbarStyle}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Icon name="code-merge" size={16} style={{ color: "var(--cortex-text-muted)" }} />
          <span style={{ "font-size": "13px", "font-weight": "600", color: "var(--cortex-text-primary)" }}>
            3-Way Merge: {props.filePath.split("/").pop()}
          </span>
          <span style={{ "font-size": "12px", color: "var(--cortex-text-muted)" }}>
            ({resolvedCount()}/{totalCount()} resolved)
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="secondary" size="sm" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!allResolved() || props.readOnly}
          >
            <Icon name="check" size={14} />
            Save Merge
          </Button>
        </div>
      </div>

      <Show when={totalCount() > 0} fallback={
        <div style={{ padding: "24px", "text-align": "center", color: "var(--cortex-text-muted)" }}>
          No conflicts found in this file.
        </div>
      }>
        <div style={editorsContainerStyle}>
          <div style={editorPaneStyle}>
            <div style={paneLabelStyle("#4ec9b0")}>
              <Icon name="arrow-left" size={12} />
              Current ({currentConflict()?.currentLabel ?? "HEAD"})
            </div>
            <div ref={currentRef} style={editorContainerStyle} />
          </div>

          <div style={editorPaneStyle}>
            <div style={paneLabelStyle("#808080")}>
              <Icon name="git" size={12} />
              Base (Common Ancestor)
            </div>
            <div ref={baseRef} style={editorContainerStyle} />
          </div>

          <div style={editorPaneStyle}>
            <div style={paneLabelStyle("#569cd6")}>
              <Icon name="arrow-right" size={12} />
              Incoming ({currentConflict()?.incomingLabel ?? "Incoming"})
            </div>
            <div ref={incomingRef} style={editorContainerStyle} />
          </div>
        </div>

        <div style={conflictNavStyle}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveConflict(Math.max(0, activeConflict() - 1))}
            disabled={activeConflict() === 0}
          >
            <Icon name="chevron-left" size={14} />
            Previous
          </Button>

          <span style={{ "font-size": "12px", color: "var(--cortex-text-muted)" }}>
            Conflict {activeConflict() + 1} of {totalCount()}
            <Show when={currentConflict()?.resolved}>
              <span style={{ color: "var(--cortex-accent-primary)", "margin-left": "8px" }}>✓ Resolved</span>
            </Show>
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveConflict(Math.min(totalCount() - 1, activeConflict() + 1))}
            disabled={activeConflict() >= totalCount() - 1}
          >
            Next
            <Icon name="chevron-right" size={14} />
          </Button>

          <div style={{ flex: "1" }} />

          <Show when={!currentConflict()?.resolved && !props.readOnly}>
            <button
              style={actionButtonStyle("#4ec9b0")}
              onClick={() => resolveConflict("current")}
            >
              Accept Current
            </button>
            <button
              style={actionButtonStyle("#569cd6")}
              onClick={() => resolveConflict("incoming")}
            >
              Accept Incoming
            </button>
            <button
              style={actionButtonStyle("#dcdcaa")}
              onClick={() => resolveConflict("both")}
            >
              Accept Both
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export { parseConflictMarkers, buildResolvedContent };
export default DiffEditor3Way;

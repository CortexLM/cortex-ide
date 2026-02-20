import { createEffect, onCleanup, createMemo } from "solid-js";
import type * as Monaco from "monaco-editor";
import { useCollab, type CollabUser } from "@/context/CollabContext";

interface CollabCursorsProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  fileId: string | null;
}

interface DecorationEntry {
  cursorIds: string[];
  selectionIds: string[];
}

const styleElements = new Map<string, HTMLStyleElement>();

function ensureCursorStyle(userId: string, color: string, name: string) {
  const safeId = userId.replace(/[^a-zA-Z0-9]/g, "");
  if (styleElements.has(userId)) return;

  const sheet = document.createElement("style");
  sheet.textContent = `
    .collab-cursor-${safeId} {
      background-color: ${color} !important;
      width: 2px !important;
    }
    .collab-cursor-line-${safeId}::before {
      content: "";
      position: absolute;
      width: 2px;
      height: 100%;
      background-color: ${color};
      box-shadow: 0 0 4px ${color};
    }
    .collab-cursor-label-${safeId}::after {
      content: "${name}";
      position: absolute;
      top: -18px;
      left: 0;
      background-color: ${color};
      color: white;
      font-size: 10px;
      font-weight: 500;
      padding: 1px 4px;
      border-radius: 2px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .collab-selection-${safeId} {
      background-color: ${color}30 !important;
      border-left: 2px solid ${color};
    }
  `;
  document.head.appendChild(sheet);
  styleElements.set(userId, sheet);
}

function cleanupAllStyles() {
  styleElements.forEach((el) => el.remove());
  styleElements.clear();
}

/**
 * CollabCursors renders remote user cursors and selections as Monaco
 * editor decorations. It subscribes to the collaboration state and
 * updates decorations reactively via deltaDecorations.
 */
export function CollabCursors(props: CollabCursorsProps) {
  const { state } = useCollab();
  const decorations = new Map<string, DecorationEntry>();
  let lastEditor: Monaco.editor.IStandaloneCodeEditor | null = null;

  const remoteParticipants = createMemo(() => {
    if (!props.fileId) return [];
    return state.participants.filter(
      (p) =>
        p.id !== state.currentUser?.id &&
        p.cursor?.fileId === props.fileId
    );
  });

  const applyDecorations = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    participant: CollabUser,
  ) => {
    const cursor = participant.cursor;
    const selection = participant.selection;
    const safeId = participant.id.replace(/[^a-zA-Z0-9]/g, "");
    const existing = decorations.get(participant.id) || { cursorIds: [], selectionIds: [] };

    ensureCursorStyle(participant.id, participant.color, participant.name);

    const cursorDecs: Monaco.editor.IModelDeltaDecoration[] = [];
    const selDecs: Monaco.editor.IModelDeltaDecoration[] = [];

    if (cursor) {
      const line = cursor.line + 1;
      const col = cursor.column + 1;

      cursorDecs.push({
        range: new monaco.Range(line, col, line, col + 1),
        options: {
          className: `collab-cursor-${safeId}`,
          beforeContentClassName: `collab-cursor-line-${safeId}`,
          hoverMessage: { value: participant.name },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });

      cursorDecs.push({
        range: new monaco.Range(line, col, line, col),
        options: {
          after: {
            content: "",
            inlineClassName: `collab-cursor-label-${safeId}`,
          },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    if (selection && selection.fileId === props.fileId) {
      selDecs.push({
        range: new monaco.Range(
          selection.startLine + 1,
          selection.startColumn + 1,
          selection.endLine + 1,
          selection.endColumn + 1,
        ),
        options: {
          className: `collab-selection-${safeId}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    const newCursorIds = editor.deltaDecorations(existing.cursorIds, cursorDecs);
    const newSelIds = editor.deltaDecorations(existing.selectionIds, selDecs);

    decorations.set(participant.id, { cursorIds: newCursorIds, selectionIds: newSelIds });
  };

  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    const fileId = props.fileId;
    const participants = remoteParticipants();

    if (!editor || !monaco || !fileId) {
      if (lastEditor && decorations.size > 0) {
        decorations.forEach((d) => {
          lastEditor!.deltaDecorations([...d.cursorIds, ...d.selectionIds], []);
        });
      }
      decorations.clear();
      lastEditor = null;
      return;
    }

    lastEditor = editor;

    participants.forEach((p) => applyDecorations(editor, monaco, p));

    const activeIds = new Set(participants.map((p) => p.id));
    decorations.forEach((d, id) => {
      if (!activeIds.has(id)) {
        editor.deltaDecorations([...d.cursorIds, ...d.selectionIds], []);
        decorations.delete(id);
      }
    });
  });

  onCleanup(() => {
    if (lastEditor && decorations.size > 0) {
      decorations.forEach((d) => {
        lastEditor!.deltaDecorations([...d.cursorIds, ...d.selectionIds], []);
      });
    }
    decorations.clear();
    lastEditor = null;
    cleanupAllStyles();
  });

  return null;
}

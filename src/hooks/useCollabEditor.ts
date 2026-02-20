import { createEffect, onCleanup, createMemo } from "solid-js";
import type * as Monaco from "monaco-editor";
import { useCollab, type CollabUser } from "@/context/CollabContext";

interface UseCollabEditorOptions {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  fileId: string | null;
}

interface RemoteCursorDecoration {
  cursorDecorationIds: string[];
  selectionDecorationIds: string[];
}

/**
 * Hook to integrate Monaco editor with collaboration features.
 * Handles:
 * - Sending local cursor/selection updates
 * - Displaying remote cursors and selections
 * - Following other users
 */
export function useCollabEditor(options: UseCollabEditorOptions) {
  const { 
    state, 
    updateCursor, 
    updateSelection, 
    getParticipant 
  } = useCollab();

  const decorationsMap = new Map<string, RemoteCursorDecoration>();
  let cursorPositionDisposable: Monaco.IDisposable | null = null;
  let selectionDisposable: Monaco.IDisposable | null = null;
  // Store editor reference for cleanup when editor becomes null
  let lastEditor: Monaco.editor.IStandaloneCodeEditor | null = null;

  // Get participants with cursors in current file
  const remoteParticipants = createMemo(() => {
    if (!options.fileId) return [];
    return state.participants.filter(
      (p) => 
        p.id !== state.currentUser?.id && 
        p.cursor?.fileId === options.fileId
    );
  });

  // Send local cursor updates
  createEffect(() => {
    const editor = options.editor;
    const fileId = options.fileId;
    
    if (!editor || !fileId || !state.currentRoom) {
      cursorPositionDisposable?.dispose?.();
      cursorPositionDisposable = null;
      return;
    }

    cursorPositionDisposable = editor.onDidChangeCursorPosition((e) => {
      updateCursor({
        fileId,
        line: e.position.lineNumber - 1, // 0-indexed
        column: e.position.column - 1,
      });
    });

    onCleanup(() => {
      cursorPositionDisposable?.dispose?.();
      cursorPositionDisposable = null;
    });
  });

  // Send local selection updates
  createEffect(() => {
    const editor = options.editor;
    const fileId = options.fileId;
    
    if (!editor || !fileId || !state.currentRoom) {
      selectionDisposable?.dispose?.();
      selectionDisposable = null;
      return;
    }

    selectionDisposable = editor.onDidChangeCursorSelection((e) => {
      const selection = e.selection;
      
      // Only send if there's an actual selection (not just cursor)
      if (selection.startLineNumber !== selection.endLineNumber ||
          selection.startColumn !== selection.endColumn) {
        updateSelection({
          fileId,
          startLine: selection.startLineNumber - 1,
          startColumn: selection.startColumn - 1,
          endLine: selection.endLineNumber - 1,
          endColumn: selection.endColumn - 1,
        });
      }
    });

    onCleanup(() => {
      selectionDisposable?.dispose?.();
      selectionDisposable = null;
    });
  });

  // Display remote cursors and selections
  createEffect(() => {
    const editor = options.editor;
    const monaco = options.monaco;
    const fileId = options.fileId;
    const participants = remoteParticipants();

    if (!editor || !monaco || !fileId) {
      // Clean up all decorations using stored editor reference
      if (lastEditor && decorationsMap.size > 0) {
        decorationsMap.forEach((decoration) => {
          lastEditor!.deltaDecorations(
            [...decoration.cursorDecorationIds, ...decoration.selectionDecorationIds],
            []
          );
        });
      }
      decorationsMap.clear();
      lastEditor = null;
      return;
    }

    // Update stored editor reference
    lastEditor = editor;

    // Update decorations for each participant
    participants.forEach((participant) => {
      updateParticipantDecorations(editor, monaco, participant);
    });

    // Remove decorations for participants no longer in file
    const participantIds = new Set(participants.map((p) => p.id));
    decorationsMap.forEach((decoration, participantId) => {
      if (!participantIds.has(participantId)) {
        editor.deltaDecorations(
          [...decoration.cursorDecorationIds, ...decoration.selectionDecorationIds],
          []
        );
        decorationsMap.delete(participantId);
      }
    });
  });

  function updateParticipantDecorations(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    participant: CollabUser
  ) {
    const cursor = participant.cursor;
    const selection = participant.selection;
    const existing = decorationsMap.get(participant.id) || {
      cursorDecorationIds: [],
      selectionDecorationIds: [],
    };

    const newCursorDecorations: Monaco.editor.IModelDeltaDecoration[] = [];
    const newSelectionDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

    // Create cursor decoration
    if (cursor) {
      const line = cursor.line + 1; // 1-indexed for Monaco
      const column = cursor.column + 1;

      // Add inline class for cursor styling
      const cursorClassName = `remote-cursor-${participant.id.replace(/[^a-zA-Z0-9]/g, '')}`;
      
      // Add CSS for this participant's cursor if not exists
      addCursorStyle(participant.id, participant.color, participant.name);

      newCursorDecorations.push({
        range: new monaco.Range(line, column, line, column + 1),
        options: {
          className: cursorClassName,
          beforeContentClassName: `remote-cursor-line-${participant.id.replace(/[^a-zA-Z0-9]/g, '')}`,
          hoverMessage: { value: participant.name },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });

      // Add name label decoration
      newCursorDecorations.push({
        range: new monaco.Range(line, column, line, column),
        options: {
          after: {
            content: "",
            inlineClassName: `remote-cursor-label-${participant.id.replace(/[^a-zA-Z0-9]/g, '')}`,
          },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    // Create selection decoration
    if (selection) {
      const startLine = selection.startLine + 1;
      const startColumn = selection.startColumn + 1;
      const endLine = selection.endLine + 1;
      const endColumn = selection.endColumn + 1;

      newSelectionDecorations.push({
        range: new monaco.Range(startLine, startColumn, endLine, endColumn),
        options: {
          className: `remote-selection-${participant.id.replace(/[^a-zA-Z0-9]/g, '')}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    // Update cursor decorations
    const updatedCursorIds = editor.deltaDecorations(
      existing.cursorDecorationIds,
      newCursorDecorations
    );

    // Update selection decorations
    const updatedSelectionIds = editor.deltaDecorations(
      existing.selectionDecorationIds,
      newSelectionDecorations
    );

    decorationsMap.set(participant.id, {
      cursorDecorationIds: updatedCursorIds,
      selectionDecorationIds: updatedSelectionIds,
    });
  }

  // Handle following user - scroll to their position
  createEffect(() => {
    const editor = options.editor;
    const followingId = state.followingUser;
    
    if (!editor || !followingId) return;

    const followedUser = getParticipant(followingId);
    if (!followedUser?.cursor || followedUser.cursor.fileId !== options.fileId) {
      return;
    }

    // Scroll to followed user's cursor position
    const line = followedUser.cursor.line + 1;
    const column = followedUser.cursor.column + 1;
    
    editor.revealPositionInCenter({ lineNumber: line, column });
  });

  // Cleanup on unmount
  onCleanup(() => {
    cursorPositionDisposable?.dispose?.();
    selectionDisposable?.dispose?.();
    
    // Remove all Monaco decorations before clearing the map
    if (lastEditor && decorationsMap.size > 0) {
      decorationsMap.forEach((decoration) => {
        lastEditor!.deltaDecorations(
          [...decoration.cursorDecorationIds, ...decoration.selectionDecorationIds],
          []
        );
      });
    }
    decorationsMap.clear();
    lastEditor = null;
    
    cleanupCursorStyles();
  });

  return {
    remoteParticipants,
    isCollaborating: () => state.currentRoom !== null,
    participantCount: () => state.participants.length,
  };
}

// ============================================================================
// Style Management for Remote Cursors
// ============================================================================

const styleElements = new Map<string, HTMLStyleElement>();

function addCursorStyle(userId: string, color: string, name: string) {
  const safeId = userId.replace(/[^a-zA-Z0-9]/g, '');
  
  if (styleElements.has(userId)) {
    return; // Style already exists
  }

  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    .remote-cursor-${safeId} {
      background-color: ${color} !important;
      width: 2px !important;
    }
    
    .remote-cursor-line-${safeId}::before {
      content: "";
      position: absolute;
      width: 2px;
      height: 100%;
      background-color: ${color};
      box-shadow: 0 0 4px ${color};
      animation: cursor-blink 1s ease-in-out infinite;
    }
    
    .remote-cursor-label-${safeId}::after {
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
    
    .remote-selection-${safeId} {
      background-color: ${color}30 !important;
      border-left: 2px solid ${color};
    }

    @keyframes cursor-blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0.5; }
    }
  `;
  
  document.head.appendChild(styleSheet);
  styleElements.set(userId, styleSheet);
}

function cleanupCursorStyles() {
  styleElements.forEach((styleElement) => {
    styleElement.remove();
  });
  styleElements.clear();
}

import { For, Show, createMemo } from "solid-js";
import { useCollab, type CollabUser, type CursorPosition, type SelectionRange } from "@/context/CollabContext";
import { useCollabSync } from "@/context/CollabSyncContext";
import { Badge, Text } from "@/components/ui";

interface CursorOverlayProps {
  fileId: string;
  lineHeight: number;
  charWidth: number;
  scrollTop: number;
  scrollLeft: number;
  editorPaddingTop?: number;
  editorPaddingLeft?: number;
}

export function CursorOverlay(props: CursorOverlayProps) {
  const { state } = useCollab();
  const { state: syncState } = useCollabSync();

  // Filter participants with cursors in the current file (excluding current user).
  // Merges data from both the existing CollabContext participants and the
  // real-time sync backend's remoteCursors for live peer cursor positions.
  const visibleCursors = createMemo(() => {
    const fromParticipants = state.participants.filter(
      (p) => 
        p.id !== state.currentUser?.id && 
        p.cursor?.fileId === props.fileId
    );

    // Enrich with real-time cursor data from the sync backend
    const remoteCursors = syncState.remoteCursors;
    for (const participant of fromParticipants) {
      const remote = remoteCursors[participant.id];
      if (remote && remote.fileId === props.fileId && remote.timestamp > (participant.cursor?.timestamp ?? 0)) {
        participant.cursor = {
          fileId: remote.fileId,
          line: remote.line,
          column: remote.column,
          timestamp: remote.timestamp,
        };
      }
    }

    return fromParticipants;
  });

  // Filter participants with selections in the current file (excluding current user)
  const visibleSelections = createMemo(() => {
    return state.participants.filter(
      (p) => 
        p.id !== state.currentUser?.id && 
        p.selection?.fileId === props.fileId
    );
  });

  return (
    <div 
      class="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ "z-index": "10" }}
    >
      {/* Remote selections (rendered behind cursors) */}
      <For each={visibleSelections()}>
        {(participant) => (
          <RemoteSelection
            user={participant}
            selection={participant.selection!}
            lineHeight={props.lineHeight}
            charWidth={props.charWidth}
            scrollTop={props.scrollTop}
            scrollLeft={props.scrollLeft}
            paddingTop={props.editorPaddingTop || 0}
            paddingLeft={props.editorPaddingLeft || 0}
          />
        )}
      </For>

      {/* Remote cursors */}
      <For each={visibleCursors()}>
        {(participant) => (
          <RemoteCursor
            user={participant}
            cursor={participant.cursor!}
            lineHeight={props.lineHeight}
            charWidth={props.charWidth}
            scrollTop={props.scrollTop}
            scrollLeft={props.scrollLeft}
            paddingTop={props.editorPaddingTop || 0}
            paddingLeft={props.editorPaddingLeft || 0}
          />
        )}
      </For>
    </div>
  );
}

// ============================================================================
// Remote Cursor Component
// ============================================================================

interface RemoteCursorProps {
  user: CollabUser;
  cursor: CursorPosition;
  lineHeight: number;
  charWidth: number;
  scrollTop: number;
  scrollLeft: number;
  paddingTop: number;
  paddingLeft: number;
}

function RemoteCursor(props: RemoteCursorProps) {
  const top = () => 
    (props.cursor.line * props.lineHeight) - props.scrollTop + props.paddingTop;
  
  const left = () => 
    (props.cursor.column * props.charWidth) - props.scrollLeft + props.paddingLeft;

  // Check if cursor is visible in viewport
  const isVisible = () => top() >= -props.lineHeight && left() >= -20;

  // Calculate opacity based on activity (fade out over time)
  const opacity = createMemo(() => {
    const timeSinceActivity = Date.now() - props.cursor.timestamp;
    if (timeSinceActivity < 10000) return 1; // Fully visible for 10s
    if (timeSinceActivity < 30000) return 0.7; // Slightly faded for 30s
    return 0.4; // More faded after 30s
  });

  return (
    <Show when={isVisible()}>
      <div
        class="absolute transition-all duration-75"
        style={{
          top: `${top()}px`,
          left: `${left()}px`,
          opacity: opacity(),
        }}
      >
        {/* Cursor line */}
        <div
          class="w-0.5 animate-pulse"
          style={{
            height: `${props.lineHeight}px`,
            background: props.user.color,
            "box-shadow": `0 0 4px ${props.user.color}`,
          }}
        />
        
        {/* Name label */}
        <CursorLabel 
          name={props.user.name} 
          color={props.user.color} 
          position="top"
        />
      </div>
    </Show>
  );
}

// ============================================================================
// Cursor Label Component
// ============================================================================

interface CursorLabelProps {
  name: string;
  color: string;
  position?: "top" | "bottom";
}

function CursorLabel(props: CursorLabelProps) {
  const positionStyles = () => {
    if (props.position === "bottom") {
      return { top: "100%", left: "0" };
    }
    return { bottom: "100%", left: "0" };
  };

  return (
    <div
      class="absolute whitespace-nowrap pointer-events-none select-none"
      style={{
        ...positionStyles(),
        background: props.color,
        color: "white",
        "box-shadow": "0 1px 3px rgba(0,0,0,0.3)",
        transform: "translateY(-2px)",
        padding: "1px 6px",
        "border-radius": "var(--jb-radius-sm)",
        "font-size": "10px",
        "font-weight": "500",
      }}
    >
      {props.name}
    </div>
  );
}

// ============================================================================
// Remote Selection Component
// ============================================================================

interface RemoteSelectionProps {
  user: CollabUser;
  selection: SelectionRange;
  lineHeight: number;
  charWidth: number;
  scrollTop: number;
  scrollLeft: number;
  paddingTop: number;
  paddingLeft: number;
}

function RemoteSelection(props: RemoteSelectionProps) {
  // Generate selection rectangles for multi-line selections
  const selectionRects = createMemo(() => {
    const rects: Array<{ top: number; left: number; width: number; height: number }> = [];
    const { startLine, startColumn, endLine, endColumn } = props.selection;

    if (startLine === endLine) {
      // Single line selection
      rects.push({
        top: (startLine * props.lineHeight) - props.scrollTop + props.paddingTop,
        left: (startColumn * props.charWidth) - props.scrollLeft + props.paddingLeft,
        width: (endColumn - startColumn) * props.charWidth,
        height: props.lineHeight,
      });
    } else {
      // Multi-line selection
      // First line: from start column to end of line
      const avgLineLength = 80; // Assume average line length for extending to end
      rects.push({
        top: (startLine * props.lineHeight) - props.scrollTop + props.paddingTop,
        left: (startColumn * props.charWidth) - props.scrollLeft + props.paddingLeft,
        width: Math.max(avgLineLength - startColumn, 10) * props.charWidth,
        height: props.lineHeight,
      });

      // Middle lines: full width
      for (let line = startLine + 1; line < endLine; line++) {
        rects.push({
          top: (line * props.lineHeight) - props.scrollTop + props.paddingTop,
          left: props.paddingLeft - props.scrollLeft,
          width: avgLineLength * props.charWidth,
          height: props.lineHeight,
        });
      }

      // Last line: from start to end column
      rects.push({
        top: (endLine * props.lineHeight) - props.scrollTop + props.paddingTop,
        left: props.paddingLeft - props.scrollLeft,
        width: endColumn * props.charWidth,
        height: props.lineHeight,
      });
    }

    return rects;
  });

  return (
    <For each={selectionRects()}>
      {(rect) => (
        <div
          class="absolute pointer-events-none"
          style={{
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            background: `${props.user.color}30`,
            "border-left": `2px solid ${props.user.color}`,
          }}
        />
      )}
    </For>
  );
}

// ============================================================================
// Follow Indicator Component
// ============================================================================

interface FollowIndicatorProps {
  user: CollabUser;
  isFollowing: boolean;
}

export function FollowIndicator(props: FollowIndicatorProps) {
  return (
    <Show when={props.isFollowing}>
      <div 
        class="fixed top-16 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg"
        style={{
          background: props.user.color,
          color: "white",
        }}
      >
        <div class="w-2 h-2 rounded-full bg-white animate-pulse" />
        <Text size="sm" weight="medium" style={{ color: "white" }}>
          Following {props.user.name}
        </Text>
      </div>
    </Show>
  );
}

// ============================================================================
// Cursor Position Indicator (shown at bottom of editor)
// ============================================================================

interface CursorPositionIndicatorProps {
  participants: CollabUser[];
  fileId: string;
}

export function CursorPositionIndicator(props: CursorPositionIndicatorProps) {
  const participantsInFile = createMemo(() => {
    return props.participants.filter(
      (p) => p.cursor?.fileId === props.fileId
    );
  });

  return (
    <Show when={participantsInFile().length > 0}>
      <div class="flex items-center gap-1 px-2 py-1">
        <For each={participantsInFile()}>
          {(participant) => (
            <Badge 
              style={{ 
                background: `${participant.color}20`,
                color: participant.color,
              }}
            >
              <div 
                class="w-2 h-2 rounded-full mr-1"
                style={{ background: participant.color }}
              />
              {participant.name}: L{(participant.cursor?.line || 0) + 1}
            </Badge>
          )}
        </For>
      </div>
    </Show>
  );
}

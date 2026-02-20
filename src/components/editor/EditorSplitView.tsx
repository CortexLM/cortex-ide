/**
 * EditorSplitView - Enhanced Split View Management
 *
 * Provides split view management with:
 * - Context menu for split/unsplit actions
 * - Draggable resize handles between splits
 * - Support for horizontal and vertical splits
 * - Each split maintains its own active file
 */

import {
  Show,
  createSignal,
  createMemo,
  onCleanup,
  type JSX,
  type Component,
} from "solid-js";
import { useEditor, type SplitDirection, type EditorGroup } from "@/context/EditorContext";
import { useContextMenu, ContextMenu, type ContextMenuSection } from "@/components/ui";

const STORAGE_KEY_SPLIT_RATIO = "editor_split_view_ratio";

const MIN_SPLIT_RATIO = 0.15;
const MAX_SPLIT_RATIO = 0.85;

interface SplitSashProps {
  direction: SplitDirection;
  onResize: (delta: number) => void;
  onDoubleClick: () => void;
}

const SplitSash: Component<SplitSashProps> = (props) => {
  const [isDragging, setIsDragging] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);

  const isVertical = () => props.direction === "vertical";

  let dragStartPos = 0;
  let lastDelta = 0;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragStartPos = isVertical() ? e.clientX : e.clientY;
    lastDelta = 0;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    document.body.style.cursor = isVertical() ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging()) return;

    const currentPos = isVertical() ? e.clientX : e.clientY;
    const totalDelta = currentPos - dragStartPos;
    const incrementalDelta = totalDelta - lastDelta;
    lastDelta = totalDelta;

    props.onResize(incrementalDelta);
  };

  const handleMouseUp = () => {
    setIsDragging(false);

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const handleDoubleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.onDoubleClick();
  };

  onCleanup(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  const containerStyle = (): JSX.CSSProperties => {
    const hoverSize = 8;
    const sashSize = 4;
    return {
      position: "relative",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "flex-shrink": "0",
      width: isVertical() ? `${hoverSize}px` : "100%",
      height: isVertical() ? "100%" : `${hoverSize}px`,
      cursor: isVertical() ? "col-resize" : "row-resize",
      "z-index": "5",
      margin: isVertical()
        ? `0 -${(hoverSize - sashSize) / 2}px`
        : `-${(hoverSize - sashSize) / 2}px 0`,
    };
  };

  const sashStyle = (): JSX.CSSProperties => {
    const active = isDragging() || isHovered();
    const sashSize = 4;
    return {
      position: "absolute",
      width: isVertical() ? `${sashSize}px` : "100%",
      height: isVertical() ? "100%" : `${sashSize}px`,
      background: active
        ? "var(--accent, var(--cortex-info))"
        : "var(--border-subtle, var(--jb-border-default, var(--cortex-bg-hover)))",
      transition: isDragging() ? "none" : "background 150ms ease",
      "pointer-events": "none",
    };
  };

  return (
    <div
      class="split-sash"
      style={containerStyle()}
      onMouseDown={handleMouseDown}
      onDblClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-direction={props.direction}
      data-dragging={isDragging()}
    >
      <div class="split-sash-visual" style={sashStyle()} />
    </div>
  );
};

interface SplitPaneProps {
  direction: SplitDirection;
  ratio: number;
  onRatioChange: (ratio: number) => void;
  first: () => JSX.Element;
  second: () => JSX.Element;
}

const SplitPane: Component<SplitPaneProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;

  const isVertical = () => props.direction === "vertical";

  const handleResize = (delta: number) => {
    if (!containerRef) return;

    const rect = containerRef.getBoundingClientRect();
    const totalSize = isVertical() ? rect.width : rect.height;
    const deltaRatio = delta / totalSize;
    const newRatio = Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, props.ratio + deltaRatio));

    props.onRatioChange(newRatio);
  };

  const handleDoubleClick = () => {
    props.onRatioChange(0.5);
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    flex: "1",
    overflow: "hidden",
    "flex-direction": isVertical() ? "row" : "column",
  });

  const firstPaneStyle = (): JSX.CSSProperties => ({
    display: "flex",
    overflow: "hidden",
    [isVertical() ? "width" : "height"]: `${props.ratio * 100}%`,
    [isVertical() ? "min-width" : "min-height"]: "100px",
  });

  const secondPaneStyle = (): JSX.CSSProperties => ({
    display: "flex",
    overflow: "hidden",
    [isVertical() ? "width" : "height"]: `${(1 - props.ratio) * 100}%`,
    [isVertical() ? "min-width" : "min-height"]: "100px",
  });

  return (
    <div ref={containerRef} style={containerStyle()}>
      <div style={firstPaneStyle()}>{props.first()}</div>
      <SplitSash
        direction={props.direction}
        onResize={handleResize}
        onDoubleClick={handleDoubleClick}
      />
      <div style={secondPaneStyle()}>{props.second()}</div>
    </div>
  );
};

interface EditorSplitViewProps {
  renderGroup: (group: EditorGroup, index: number, total: number) => JSX.Element;
}

export const EditorSplitView: Component<EditorSplitViewProps> = (props) => {
  const {
    state,
    splitEditor,
    closeGroup,
    unsplit,
    updateSplitRatio,
  } = useEditor();

  const { menuState, showMenu, hideMenu } = useContextMenu();

  const getSavedRatio = (): number => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SPLIT_RATIO);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= MIN_SPLIT_RATIO && parsed <= MAX_SPLIT_RATIO) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return 0.5;
  };

  const saveRatio = (ratio: number) => {
    try {
      localStorage.setItem(STORAGE_KEY_SPLIT_RATIO, ratio.toString());
    } catch {
      // Ignore storage errors
    }
  };

  const [localRatio, setLocalRatio] = createSignal(getSavedRatio());

  const hasSplit = createMemo(() => state.groups.length > 1);
  const activeSplit = createMemo(() => state.splits[0]);

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();

    const sections = buildContextMenuSections();
    showMenu(e.clientX, e.clientY, sections);
  };

  const buildContextMenuSections = (): ContextMenuSection[] => {
    const sections: ContextMenuSection[] = [];

    sections.push({
      items: [
        {
          id: "split-right",
          label: "Split Right",
          icon: "columns",
          shortcut: "Ctrl+\\",
          action: () => {
            splitEditor("vertical");
            hideMenu();
          },
        },
        {
          id: "split-down",
          label: "Split Down",
          icon: "grip-lines",
          shortcut: "Ctrl+K Ctrl+\\",
          action: () => {
            splitEditor("horizontal");
            hideMenu();
          },
        },
      ],
    });

    if (hasSplit()) {
      sections.push({
        items: [
          {
            id: "close-split",
            label: "Close Split",
            icon: "xmark",
            action: () => {
              const activeGroup = state.groups.find((g) => g.id === state.activeGroupId);
              if (activeGroup && state.groups.length > 1) {
                closeGroup(activeGroup.id);
              }
              hideMenu();
            },
          },
          {
            id: "unsplit-all",
            label: "Unsplit All",
            icon: "maximize",
            action: () => {
              unsplit();
              hideMenu();
            },
          },
        ],
      });
    }

    return sections;
  };

  const handleRatioChange = (ratio: number) => {
    setLocalRatio(ratio);
    saveRatio(ratio);

    const split = activeSplit();
    if (split && updateSplitRatio) {
      updateSplitRatio(split.id, ratio);
    }
  };

  const renderSingleGroup = () => {
    const group = state.groups[0];
    if (!group) return null;
    return props.renderGroup(group, 0, 1);
  };

  const renderSplitGroups = () => {
    const split = activeSplit();
    if (!split) return null;

    const firstGroup = state.groups.find((g) => g.id === split.firstGroupId);
    const secondGroup = state.groups.find((g) => g.id === split.secondGroupId);

    if (!firstGroup || !secondGroup) return null;

    const firstIndex = state.groups.findIndex((g) => g.id === split.firstGroupId);
    const secondIndex = state.groups.findIndex((g) => g.id === split.secondGroupId);

    return (
      <SplitPane
        direction={split.direction}
        ratio={localRatio()}
        onRatioChange={handleRatioChange}
        first={() => props.renderGroup(firstGroup, firstIndex, state.groups.length)}
        second={() => props.renderGroup(secondGroup, secondIndex, state.groups.length)}
      />
    );
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    flex: "1",
    overflow: "hidden",
    "min-height": "0",
  });

  return (
    <>
      <div
        style={containerStyle()}
        onContextMenu={handleContextMenu}
        data-split-view
        data-has-split={hasSplit()}
      >
        <Show when={!hasSplit()} fallback={renderSplitGroups()}>
          {renderSingleGroup()}
        </Show>
      </div>
      <ContextMenu state={menuState()} onClose={hideMenu} />
    </>
  );
};

export default EditorSplitView;

/**
 * Minimap Context Menu
 *
 * Right-click context menu for the editor minimap.
 * Provides options to toggle visibility, change render mode, and adjust size.
 */

import { Show, For, createSignal, createEffect, onCleanup, type Component } from "solid-js";
import { Portal } from "solid-js/web";

type MinimapSize = "proportional" | "fill" | "fit";

interface MinimapContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  minimapEnabled: boolean;
  onToggleMinimap: () => void;
  renderCharacters: boolean;
  onToggleRenderCharacters: () => void;
  minimapSize: MinimapSize;
  onSetMinimapSize: (size: MinimapSize) => void;
}

const MENU_COLORS = {
  shadow: "rgba(0, 0, 0, 0.36)",
  border: "var(--cortex-bg-active)",
  foreground: "var(--cortex-text-primary)",
  background: "var(--ui-panel-bg-lighter)",
  selectionForeground: "var(--cortex-text-primary)",
  selectionBackground: "var(--cortex-bg-active)",
  separator: "var(--cortex-bg-active)",
} as const;

const MENU_STYLES = {
  container: {
    "min-width": "160px",
    background: MENU_COLORS.background,
    border: `1px solid ${MENU_COLORS.border}`,
    "border-radius": "var(--cortex-radius-md)",
    "box-shadow": `0 2px 8px ${MENU_COLORS.shadow}`,
    padding: "4px 0",
    "z-index": 2575,
  },
  item: {
    height: "26px",
    "line-height": "26px",
    padding: "0 26px",
    "font-size": "13px",
    gap: "8px",
  },
  separator: {
    height: "1px",
    margin: "4px 0",
    background: MENU_COLORS.separator,
  },
  sectionLabel: {
    padding: "4px 26px 2px",
    "font-size": "11px",
    "text-transform": "uppercase" as const,
    "letter-spacing": "0.05em",
    opacity: "0.6",
    color: MENU_COLORS.foreground,
  },
  animation: {
    duration: "83ms",
    easing: "linear",
  },
} as const;

const MINIMAP_SIZES: readonly MinimapSize[] = ["proportional", "fill", "fit"];

const ANIMATION_KEYFRAMES = `
  @keyframes minimapMenuFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export const MinimapContextMenu: Component<MinimapContextMenuProps> = (props) => {
  let menuRef: HTMLDivElement | undefined;
  const [focusedIndex, setFocusedIndex] = createSignal(-1);

  createEffect(() => {
    if (!props.visible) return;

    setFocusedIndex(-1);

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        props.onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
      }
    };

    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);

    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  const getMenuPosition = () => {
    const padding = 8;
    const menuWidth = 200;
    const menuHeight = 240;

    let x = props.x;
    let y = props.y;

    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }

    return {
      left: `${Math.max(padding, x)}px`,
      top: `${Math.max(padding, y)}px`,
    };
  };

  const itemStyle = (hovered: boolean, _disabled?: boolean) => ({
    ...MENU_STYLES.item,
    color: hovered ? MENU_COLORS.selectionForeground : MENU_COLORS.foreground,
    background: hovered ? MENU_COLORS.selectionBackground : "transparent",
    cursor: "pointer",
    "white-space": "nowrap",
    "border-radius": "0",
    margin: "0",
  });

  return (
    <Show when={props.visible}>
      <Portal>
        <style>{ANIMATION_KEYFRAMES}</style>
        <div
          ref={menuRef}
          class="fixed overflow-hidden"
          style={{
            ...getMenuPosition(),
            ...MENU_STYLES.container,
            animation: `minimapMenuFadeIn ${MENU_STYLES.animation.duration} ${MENU_STYLES.animation.easing}`,
          }}
        >
          {/* Toggle minimap */}
          <button
            class="w-full flex items-center"
            style={itemStyle(focusedIndex() === 0)}
            onMouseEnter={() => setFocusedIndex(0)}
            onMouseLeave={() => setFocusedIndex(-1)}
            onClick={() => {
              props.onToggleMinimap();
              props.onClose();
            }}
          >
            <span
              class="shrink-0 text-center"
              style={{ width: "16px", "font-size": "12px" }}
            >
              {props.minimapEnabled ? "✓" : ""}
            </span>
            <span>Minimap</span>
          </button>

          {/* Separator */}
          <div style={MENU_STYLES.separator} />

          {/* Render mode section */}
          <div style={MENU_STYLES.sectionLabel}>Render</div>
          <button
            class="w-full flex items-center"
            style={itemStyle(focusedIndex() === 1)}
            onMouseEnter={() => setFocusedIndex(1)}
            onMouseLeave={() => setFocusedIndex(-1)}
            onClick={() => {
              if (props.renderCharacters) {
                props.onToggleRenderCharacters();
              }
              props.onClose();
            }}
          >
            <span
              class="shrink-0 text-center"
              style={{ width: "16px", "font-size": "10px" }}
            >
              {!props.renderCharacters ? "●" : ""}
            </span>
            <span>Blocks</span>
          </button>
          <button
            class="w-full flex items-center"
            style={itemStyle(focusedIndex() === 2)}
            onMouseEnter={() => setFocusedIndex(2)}
            onMouseLeave={() => setFocusedIndex(-1)}
            onClick={() => {
              if (!props.renderCharacters) {
                props.onToggleRenderCharacters();
              }
              props.onClose();
            }}
          >
            <span
              class="shrink-0 text-center"
              style={{ width: "16px", "font-size": "10px" }}
            >
              {props.renderCharacters ? "●" : ""}
            </span>
            <span>Characters</span>
          </button>

          {/* Separator */}
          <div style={MENU_STYLES.separator} />

          {/* Size section */}
          <div style={MENU_STYLES.sectionLabel}>Size</div>
          <For each={MINIMAP_SIZES}>
            {(size, index) => (
              <button
                class="w-full flex items-center"
                style={itemStyle(focusedIndex() === 3 + index())}
                onMouseEnter={() => setFocusedIndex(3 + index())}
                onMouseLeave={() => setFocusedIndex(-1)}
                onClick={() => {
                  props.onSetMinimapSize(size);
                  props.onClose();
                }}
              >
                <span
                  class="shrink-0 text-center"
                  style={{ width: "16px", "font-size": "10px" }}
                >
                  {props.minimapSize === size ? "●" : ""}
                </span>
                <span class="capitalize">{size}</span>
              </button>
            )}
          </For>
        </div>
      </Portal>
    </Show>
  );
};

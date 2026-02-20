/**
 * Step Into Targets Menu
 *
 * Quick pick menu displayed when multiple functions exist on a line during debugging.
 * Allows the user to choose which specific function to step into.
 *
 * VS Code equivalent: "Step Into Targets" command
 */

import { Show, For, createSignal, createEffect, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Icon } from "../ui/Icon";
import { useDebug, StepInTarget } from "@/context/DebugContext";

// VS Code-style menu colors
const MENU_COLORS = {
  background: "var(--ui-panel-bg-lighter)",
  border: "var(--cortex-bg-active)",
  foreground: "var(--cortex-text-primary)",
  selectionBackground: "var(--cortex-bg-active)",
  selectionForeground: "var(--cortex-text-primary)",
  shadow: "rgba(0, 0, 0, 0.36)",
};

interface StepInTargetsMenuProps {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Position to render the menu */
  position: { x: number; y: number };
  /** Callback when menu should close */
  onClose: () => void;
  /** Frame ID to get targets for (defaults to active frame) */
  frameId?: number;
}

export function StepInTargetsMenu(props: StepInTargetsMenuProps) {
  const debug = useDebug();
  const [targets, setTargets] = createSignal<StepInTarget[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let menuRef: HTMLDivElement | undefined;

  // Load targets when menu opens
  createEffect(async () => {
    if (!props.isOpen) {
      setTargets([]);
      setSelectedIndex(0);
      setError(null);
      return;
    }

    const frameId = props.frameId ?? debug.state.activeFrameId;
    if (frameId === null) {
      setError("No active frame");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await debug.getStepInTargets(frameId);
      setTargets(result);
      
      if (result.length === 0) {
        setError("No step-in targets available");
      }
    } catch (e) {
      setError("Failed to get step-in targets");
      console.error("Failed to get step-in targets:", e);
    } finally {
      setLoading(false);
    }
  });

  // Handle keyboard navigation
  createEffect(() => {
    if (!props.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetList = targets();

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          props.onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % targetList.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + targetList.length) % targetList.length);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (targetList[selectedIndex()]) {
            handleSelectTarget(targetList[selectedIndex()]);
          }
          break;
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        props.onClose();
      }
    };

    // Delay to avoid immediate close
    setTimeout(() => {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    });
  });

  const handleSelectTarget = async (target: StepInTarget) => {
    try {
      await debug.stepIntoTarget(target.id);
      props.onClose();
    } catch (e) {
      console.error("Failed to step into target:", e);
    }
  };

  // Calculate menu position (avoid going off-screen)
  const getMenuStyle = () => {
    const padding = 8;
    const menuWidth = 320;
    const menuHeight = Math.min(300, targets().length * 32 + 48);

    let x = props.position.x;
    let y = props.position.y;

    // Adjust if menu would go off right edge
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }

    // Adjust if menu would go off bottom edge
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }

    return {
      left: `${Math.max(padding, x)}px`,
      top: `${Math.max(padding, y)}px`,
    };
  };

  return (
    <Show when={props.isOpen}>
      <Portal>
        <div
          ref={menuRef}
          class="fixed overflow-hidden"
          style={{
            ...getMenuStyle(),
            "min-width": "280px",
            "max-width": "400px",
            background: MENU_COLORS.background,
            border: `1px solid ${MENU_COLORS.border}`,
            "border-radius": "var(--cortex-radius-md)",
            "box-shadow": `0 2px 8px ${MENU_COLORS.shadow}`,
            "z-index": "2575",
          }}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-3 py-2 border-b"
            style={{
              "border-color": MENU_COLORS.border,
              color: MENU_COLORS.foreground,
            }}
          >
            <div class="flex items-center gap-2">
              <Icon name="arrow-turn-down-right" size="md" style={{ color: "var(--debug-icon-step-into-foreground)" }} />
              <span class="text-sm font-medium">Step Into Target</span>
            </div>
            <button
              onClick={props.onClose}
              class="p-1 rounded hover:bg-[var(--surface-raised)]"
              title="Close (Escape)"
            >
              <Icon name="xmark" size="md" />
            </button>
          </div>

          {/* Content */}
          <div class="max-h-64 overflow-y-auto py-1">
            <Show when={loading()}>
              <div
                class="flex items-center justify-center py-4"
                style={{ color: "rgba(204, 204, 204, 0.6)" }}
              >
                Loading targets...
              </div>
            </Show>

            <Show when={error() && !loading()}>
              <div
                class="flex items-center justify-center py-4 text-sm"
                style={{ color: "rgba(204, 204, 204, 0.6)" }}
              >
                {error()}
              </div>
            </Show>

            <Show when={!loading() && !error() && targets().length > 0}>
              <For each={targets()}>
                {(target, index) => (
                  <button
                    class="w-full flex items-center px-3 py-1.5 text-left text-sm"
                    style={{
                      color:
                        selectedIndex() === index()
                          ? MENU_COLORS.selectionForeground
                          : MENU_COLORS.foreground,
                      background:
                        selectedIndex() === index()
                          ? MENU_COLORS.selectionBackground
                          : "transparent",
                    }}
                    onClick={() => handleSelectTarget(target)}
                    onMouseEnter={() => setSelectedIndex(index())}
                  >
                    <Icon name="arrow-turn-down-right" size="md" class="mr-2 shrink-0" style={{ color: "var(--debug-icon-step-into-foreground)" }} />
                    <span class="truncate flex-1">{target.label}</span>
                    <Show when={target.line !== undefined}>
                      <span
                        class="ml-2 text-xs shrink-0"
                        style={{ color: "rgba(204, 204, 204, 0.5)" }}
                      >
                        :{target.line}
                        {target.column !== undefined && `:${target.column}`}
                      </span>
                    </Show>
                  </button>
                )}
              </For>
            </Show>
          </div>

          {/* Footer hint */}
          <Show when={targets().length > 0}>
            <div
              class="px-3 py-1.5 text-xs border-t"
              style={{
                "border-color": MENU_COLORS.border,
                color: "rgba(204, 204, 204, 0.5)",
              }}
            >
              Use ↑↓ to navigate, Enter to select, Escape to cancel
            </div>
          </Show>
        </div>
      </Portal>
    </Show>
  );
}

/**
 * Hook to manage Step Into Targets menu state.
 */
export function useStepInTargetsMenu() {
  const [menuState, setMenuState] = createSignal<{
    isOpen: boolean;
    position: { x: number; y: number };
    frameId?: number;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    frameId: undefined,
  });

  const showMenu = (x: number, y: number, frameId?: number) => {
    setMenuState({
      isOpen: true,
      position: { x, y },
      frameId,
    });
  };

  const hideMenu = () => {
    setMenuState((prev) => ({ ...prev, isOpen: false }));
  };

  return {
    menuState,
    showMenu,
    hideMenu,
  };
}

/**
 * Global Step Into Targets Menu component that listens for events.
 * Add this component to App.tsx to enable step-into targets functionality.
 */
export function StepInTargetsMenuGlobal() {
  const { menuState, showMenu, hideMenu } = useStepInTargetsMenu();

  const handleShowMenu = (e: CustomEvent<{ x: number; y: number; frameId?: number }>) => {
    showMenu(e.detail.x, e.detail.y, e.detail.frameId);
  };

  createEffect(() => {
    window.addEventListener("debug:show-step-in-targets", handleShowMenu as EventListener);

    onCleanup(() => {
      window.removeEventListener("debug:show-step-in-targets", handleShowMenu as EventListener);
    });
  });

  return (
    <StepInTargetsMenu
      isOpen={menuState().isOpen}
      position={menuState().position}
      frameId={menuState().frameId}
      onClose={hideMenu}
    />
  );
}


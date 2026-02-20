/**
 * Editor Context Menu
 * 
 * Right-click context menu for the code editor with git hosting provider actions.
 * Polished Zed-like design with smooth animations and keyboard navigation.
 */

import { Show, For, createSignal, createEffect, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Icon } from "../ui/Icon";
import { useGitHosting } from "@/context/GitHostingContext";
import { useDebug } from "@/context/DebugContext";
import type { LineSelection } from "@/utils/git/types";

// IMenuStyles interface - VS Code's 12 color properties for menus
interface IContextMenuStyles {
  shadowColor: string;
  borderColor: string;
  foregroundColor: string;
  backgroundColor: string;
  selectionForegroundColor: string;
  selectionBackgroundColor: string;
  selectionBorderColor: string;
  separatorColor: string;
  scrollbarShadow: string;
  scrollbarSliderBackground: string;
  scrollbarSliderHoverBackground: string;
  scrollbarSliderActiveBackground: string;
}

// VS Code context menu color theme - exact VS Code specs
const CONTEXT_MENU_COLORS: IContextMenuStyles = {
  shadowColor: "rgba(0, 0, 0, 0.36)",
  borderColor: "var(--cortex-bg-active)",
  foregroundColor: "var(--cortex-text-primary)",
  backgroundColor: "var(--ui-panel-bg-lighter)",
  selectionForegroundColor: "var(--cortex-text-primary)",
  selectionBackgroundColor: "var(--cortex-bg-active)",
  selectionBorderColor: "transparent",
  separatorColor: "var(--cortex-bg-active)",
  scrollbarShadow: "rgba(0, 0, 0, 0.3)",
  scrollbarSliderBackground: "rgba(121, 121, 121, 0.4)",
  scrollbarSliderHoverBackground: "rgba(100, 100, 100, 0.7)",
  scrollbarSliderActiveBackground: "rgba(191, 191, 191, 0.4)",
};

// VS Code menu timing constants
const CONTEXT_MENU_TIMINGS = {
  submenuShowDelay: 250,    // ms - RunOnceScheduler show delay
  submenuHideDelay: 750,    // ms - when focus leaves
  fadeInDuration: 83,       // ms - context view fade-in animation
  transformTransition: 50,  // ms - item transform transition
  mouseUpDebounce: 100,     // ms - prevent accidental clicks
} as const;

// Menu styling constants - VS Code exact specifications
const CONTEXT_MENU_STYLES = {
  container: {
    minWidth: "160px",               // VS Code: 160px min-width
    background: CONTEXT_MENU_COLORS.backgroundColor,
    border: `1px solid ${CONTEXT_MENU_COLORS.borderColor}`,
    borderRadius: "var(--cortex-radius-md)",             // VS Code: 6px border-radius for menu
    boxShadow: `0 2px 8px ${CONTEXT_MENU_COLORS.shadowColor}`,  // VS Code shadow spec
    padding: "4px 0",                // VS Code: 4px 0 padding
    zIndex: 2575,                    // VS Code: z-index 2575
  },
  item: {
    height: "26px",                  // VS Code: 26px height
    lineHeight: "26px",              // VS Code: line-height 2em (26px)
    paddingHorizontal: "26px",       // VS Code: 0 26px padding (left for checkmark, right for submenu)
    fontSize: "13px",                // VS Code: 13px font-size
    borderRadius: "0",               // VS Code: no item border-radius
    margin: "0",                     // VS Code: no margin
    gap: "8px",                      // VS Code: 8px gap
  },
  label: {
    padding: "0 26px",               // VS Code: 0 26px label padding
  },
  separator: {
    height: "1px",                   // VS Code: 1px height
    marginVertical: "4px",           // VS Code: 4px 0 margin
    marginHorizontal: "0px",
    background: CONTEXT_MENU_COLORS.separatorColor,
  },
  hover: {
    background: CONTEXT_MENU_COLORS.selectionBackgroundColor,
    color: CONTEXT_MENU_COLORS.selectionForegroundColor,
  },
  disabled: {
    opacity: "0.5",
  },
  shortcut: {
    color: "rgba(204, 204, 204, 0.6)", // VS Code: muted color
    fontSize: "11px",                // VS Code: 11px keybinding font-size
    fontFamily: "monospace",         // VS Code: monospace font
    marginLeft: "auto",              // VS Code: right-aligned
  },
  submenuIndicator: {
    padding: "0 26px",               // VS Code: 0 26px padding
  },
  checkIcon: {
    width: "26px",                   // VS Code: 26px width
  },
  icon: {
    width: "16px",                   // VS Code: 16px icon size
    height: "16px",
    marginLeft: "-22px",             // VS Code: icon position
    marginRight: "6px",
  },
  animation: {
    duration: `${CONTEXT_MENU_TIMINGS.fadeInDuration}ms`,  // VS Code: 83ms fade-in
    easing: "linear",                                      // VS Code: linear easing
  },
  scrollbar: {
    size: "7px",                     // VS Code: 7px scrollbar size
  },
} as const;

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface EditorPosition {
  line: number;
  column: number;
}

interface EditorContextMenuProps {
  isOpen: boolean;
  position: ContextMenuPosition;
  filePath: string;
  selection?: LineSelection;
  onClose: () => void;
  /** Current cursor position in the editor (1-indexed) */
  editorPosition?: EditorPosition;
  /** Function to trigger an editor action */
  triggerAction?: (actionId: string) => void;
}

interface MenuAction {
  id: string;
  label: string;
  iconName: string;
  action: () => Promise<void>;
  dividerAfter?: boolean;
  shortcut?: string;
  disabled?: boolean;
}

export function EditorContextMenu(props: EditorContextMenuProps) {
  const gitHosting = useGitHosting();
  const debug = useDebug();
  const [focusedIndex, setFocusedIndex] = createSignal(-1);
  let menuRef: HTMLDivElement | undefined;

  // CSS keyframes for menu animation - VS Code spec: 83ms linear fade-in
  const animationStyle = `
    @keyframes contextMenuFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    
    /* Menu item transform transition: 50ms ease (VS Code spec) */
    .context-menu-item-transition {
      transition: transform ${CONTEXT_MENU_TIMINGS.transformTransition}ms ease;
    }
  `;

  // Close menu when clicking outside
  createEffect(() => {
    if (!props.isOpen) return;
    
    // Reset focus when menu opens
    setFocusedIndex(-1);

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        props.onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const actions = menuActions();
      const navigableIndices = actions
        .map((_, i) => i)
        .filter(i => !actions[i].disabled);
      
      if (navigableIndices.length === 0) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          props.onClose();
          break;
        case "ArrowDown": {
          e.preventDefault();
          const currentIdx = navigableIndices.indexOf(focusedIndex());
          const nextIdx = currentIdx < navigableIndices.length - 1 
            ? navigableIndices[currentIdx + 1] 
            : navigableIndices[0];
          setFocusedIndex(nextIdx);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const currentIdx = navigableIndices.indexOf(focusedIndex());
          const prevIdx = currentIdx > 0 
            ? navigableIndices[currentIdx - 1] 
            : navigableIndices[navigableIndices.length - 1];
          setFocusedIndex(prevIdx);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const action = actions[focusedIndex()];
          if (action && !action.disabled) {
            action.action();
          }
          break;
        }
      }
    };

    // Delay attaching listeners to avoid immediate close
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);

    onCleanup(() => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Build menu actions based on available features
  const menuActions = (): MenuAction[] => {
    const actions: MenuAction[] = [];
    const available = gitHosting.isAvailable();
    const providerName = gitHosting.getProviderName() || "Remote";
    const isDebugging = debug.state.isDebugging && debug.state.isPaused;
    const supportsGoto = debug.state.capabilities?.supportsGotoTargetsRequest ?? false;
    const supportsStepInTargets = debug.state.capabilities?.supportsStepInTargetsRequest ?? false;

    // Debug actions (only shown during active debug session when paused)
    if (isDebugging && props.editorPosition) {
      // Jump to Cursor (Set Next Statement) - only if adapter supports it
      if (supportsGoto) {
        actions.push({
          id: "debug-jump-to-cursor",
          label: "Jump to Cursor",
          iconName: "crosshairs",
          shortcut: "Ctrl+Shift+F10",
          action: async () => {
            const line = props.editorPosition?.line ?? 1;
            try {
              // Get goto targets for the current line
              const targets = await debug.getGotoTargets(props.filePath, line);
              if (targets.length > 0) {
                // Jump to the first available target
                await debug.jumpToLocation(targets[0].id);
              }
            } catch (e) {
              console.error("Jump to cursor failed:", e);
            }
            props.onClose();
          },
        });
      }

      // Step Into Target - only if adapter supports it
      if (supportsStepInTargets && debug.state.activeFrameId !== null) {
        actions.push({
          id: "debug-step-into-target",
          label: "Step Into Target...",
          iconName: "turn-down-right",
          action: async () => {
            // Dispatch event to show step-in targets menu
            window.dispatchEvent(new CustomEvent("debug:show-step-in-targets", {
              detail: {
                x: props.position.x,
                y: props.position.y,
                frameId: debug.state.activeFrameId,
              }
            }));
            props.onClose();
          },
          dividerAfter: true, // Add divider after debug actions
        });
      } else if (supportsGoto) {
        // Mark the last debug action with divider if step-into-target isn't shown
        const lastAction = actions[actions.length - 1];
        if (lastAction) {
          lastAction.dividerAfter = true;
        }
      }
    }

    // LSP Navigation actions (always available when triggerAction is provided)
    if (props.triggerAction) {
      actions.push({
        id: "go-to-definition",
        label: "Go to Definition",
        iconName: "location-arrow",
        shortcut: "F12",
        action: async () => {
          props.triggerAction?.("editor.action.revealDefinition");
          props.onClose();
        },
      });

      actions.push({
        id: "peek-definition",
        label: "Peek Definition",
        iconName: "eye",
        shortcut: "Alt+F12",
        action: async () => {
          props.triggerAction?.("editor.action.peekDefinition");
          props.onClose();
        },
      });

      actions.push({
        id: "find-all-references",
        label: "Find All References",
        iconName: "magnifying-glass",
        shortcut: "Shift+Alt+F12",
        action: async () => {
          props.triggerAction?.("editor.action.findAllReferences");
          props.onClose();
        },
      });

      actions.push({
        id: "peek-references",
        label: "Peek References",
        iconName: "eye",
        shortcut: "Shift+F12",
        action: async () => {
          props.triggerAction?.("editor.action.referenceSearch.trigger");
          props.onClose();
        },
        dividerAfter: available, // Add divider if git hosting actions follow
      });
    }

    if (available) {
      actions.push({
        id: "open-on-remote",
        label: `Open on ${providerName}`,
        iconName: "arrow-up-right-from-square",
        action: async () => {
          await gitHosting.openFileOnRemote(props.filePath, props.selection);
          props.onClose();
        },
      });

actions.push({
        id: "copy-permalink",
        label: "Copy Permalink",
        iconName: "copy",
        action: async () => {
          await gitHosting.copyPermalink(props.filePath, props.selection);
          props.onClose();
        },
      });

actions.push({
        id: "copy-file-url",
        label: "Copy File URL",
        iconName: "copy",
        action: async () => {
          await gitHosting.copyFileUrl(props.filePath, props.selection);
          props.onClose();
        },
        dividerAfter: true,
      });

actions.push({
        id: "view-blame",
        label: `View Blame on ${providerName}`,
        iconName: "eye",
        action: async () => {
          await gitHosting.openBlameOnRemote(props.filePath, props.selection);
          props.onClose();
        },
      });

actions.push({
        id: "create-gist",
        label: "Create Gist/Snippet",
        iconName: "code",
        action: async () => {
          await gitHosting.openCreateGist();
          props.onClose();
        },
      });
    }

    return actions;
  };

// Get provider icon name
  const getProviderIconName = () => {
    const providerName = gitHosting.getProviderName()?.toLowerCase() || "";
    if (providerName.includes("github")) {
      return "github";
    } else if (providerName.includes("gitlab")) {
      return "gitlab";
    } else if (providerName.includes("bitbucket")) {
      return "bitbucket";
    }
    return "arrow-up-right-from-square";
  };

  // Calculate menu position (avoid going off-screen)
  const getMenuStyle = () => {
    const padding = 8;
    const menuWidth = 240;
    const menuHeight = 280;

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

    // Determine transform origin based on position
    const originX = props.position.x >= window.innerWidth - menuWidth - padding ? "right" : "left";
    const originY = props.position.y >= window.innerHeight - menuHeight - padding ? "bottom" : "top";

    return {
      left: `${Math.max(padding, x)}px`,
      top: `${Math.max(padding, y)}px`,
      transformOrigin: `${originY} ${originX}`,
    };
  };

  return (
    <Show when={props.isOpen}>
      <Portal>
        {/* Inject animation keyframes */}
        <style>{animationStyle}</style>
        <div
          ref={menuRef}
          class="fixed overflow-hidden"
          style={{
            ...getMenuStyle(),
            "min-width": CONTEXT_MENU_STYLES.container.minWidth,
            background: CONTEXT_MENU_STYLES.container.background,
            border: CONTEXT_MENU_STYLES.container.border,
            "border-radius": CONTEXT_MENU_STYLES.container.borderRadius,
            "box-shadow": CONTEXT_MENU_STYLES.container.boxShadow,
            padding: CONTEXT_MENU_STYLES.container.padding,
            "z-index": CONTEXT_MENU_STYLES.container.zIndex,
            animation: `contextMenuFadeIn ${CONTEXT_MENU_STYLES.animation.duration} ${CONTEXT_MENU_STYLES.animation.easing}`,
          }}
        >
          <Show
            when={menuActions().length > 0}
            fallback={
              <div 
                class="flex items-center justify-center"
                style={{ 
                  height: "48px",
                  color: "rgba(204, 204, 204, 0.6)",
                  "font-size": CONTEXT_MENU_STYLES.item.fontSize,
                }}
              >
                Git hosting features unavailable
              </div>
            }
          >
            {/* Provider header */}
            <Show when={gitHosting.isAvailable()}>
              <div
                class="flex items-center gap-2"
                style={{
                  padding: `4px ${CONTEXT_MENU_STYLES.item.paddingHorizontal}`,
                  "margin-bottom": "4px",
                  color: "rgba(204, 204, 204, 0.6)",
                  "font-size": "11px",
                  "font-weight": "500",
                  "padding-bottom": "8px",
                }}
              >
<Icon name={getProviderIconName()} class="w-3.5 h-3.5" />
                {gitHosting.getProviderName()}
              </div>
              <div
                style={{ 
                  height: CONTEXT_MENU_STYLES.separator.height, 
                  background: CONTEXT_MENU_STYLES.separator.background,
                  margin: `0 0 ${CONTEXT_MENU_STYLES.separator.marginVertical} 0`,
                }}
              />
            </Show>

            {/* Menu items */}
            <For each={menuActions()}>
              {(action, index) => (
                <>
                  <button
                    class="w-full flex items-center"
                    style={{ 
                      height: CONTEXT_MENU_STYLES.item.height,
                      "line-height": CONTEXT_MENU_STYLES.item.lineHeight,
                      padding: `0 ${CONTEXT_MENU_STYLES.item.paddingHorizontal}`,
                      "font-size": CONTEXT_MENU_STYLES.item.fontSize,
                      gap: CONTEXT_MENU_STYLES.item.gap,
                      color: focusedIndex() === index() 
                        ? CONTEXT_MENU_STYLES.hover.color 
                        : CONTEXT_MENU_COLORS.foregroundColor,
                      opacity: action.disabled ? CONTEXT_MENU_STYLES.disabled.opacity : "1",
                      background: focusedIndex() === index() 
                        ? CONTEXT_MENU_STYLES.hover.background 
                        : "transparent",
                      "border-radius": CONTEXT_MENU_STYLES.item.borderRadius,
                      margin: CONTEXT_MENU_STYLES.item.margin,
                      cursor: action.disabled ? "default" : "pointer",
                      "white-space": "nowrap",
                    }}
                    onClick={action.action}
                    disabled={action.disabled}
                    onMouseEnter={(e) => {
                      if (!action.disabled) {
                        e.currentTarget.style.background = CONTEXT_MENU_STYLES.hover.background;
                        e.currentTarget.style.color = CONTEXT_MENU_STYLES.hover.color;
                        setFocusedIndex(index());
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = CONTEXT_MENU_COLORS.foregroundColor;
                      if (focusedIndex() === index()) {
                        setFocusedIndex(-1);
                      }
                    }}
                  >
                    <span 
                      class="flex items-center justify-center shrink-0"
                      style={{ 
                        width: CONTEXT_MENU_STYLES.icon.width, 
                        height: CONTEXT_MENU_STYLES.icon.height,
                        "margin-left": CONTEXT_MENU_STYLES.icon.marginLeft,
                        "margin-right": CONTEXT_MENU_STYLES.icon.marginRight,
                        color: "inherit",
                      }}
                    >
                      <Icon name={action.iconName} class="w-4 h-4" />
                    </span>
                    <span class="flex-1 text-left truncate">{action.label}</span>
                    <Show when={action.shortcut}>
                      <span 
                        class="shrink-0"
                        style={{ 
                          color: CONTEXT_MENU_STYLES.shortcut.color, 
                          "font-size": CONTEXT_MENU_STYLES.shortcut.fontSize,
                          "font-family": CONTEXT_MENU_STYLES.shortcut.fontFamily,
                          "margin-left": CONTEXT_MENU_STYLES.shortcut.marginLeft,
                        }}
                      >
                        {action.shortcut}
                      </span>
                    </Show>
                  </button>
                  <Show when={action.dividerAfter}>
                    <div
                      style={{ 
                        height: CONTEXT_MENU_STYLES.separator.height, 
                        background: CONTEXT_MENU_STYLES.separator.background,
                        margin: `${CONTEXT_MENU_STYLES.separator.marginVertical} ${CONTEXT_MENU_STYLES.separator.marginHorizontal}`,
                      }}
                    />
                  </Show>
                </>
              )}
            </For>
          </Show>
        </div>
      </Portal>
    </Show>
  );
}

/**
 * Hook to manage editor context menu state.
 * 
 * Usage:
 * ```tsx
 * const { menuState, showMenu, hideMenu } = useEditorContextMenu();
 * 
 * // In your editor's contextmenu handler:
 * onContextMenu={(e) => {
 *   e.preventDefault();
 *   showMenu(e.clientX, e.clientY, filePath, selection);
 * }}
 * ```
 */
interface MenuState {
  isOpen: boolean;
  position: ContextMenuPosition;
  filePath: string;
  selection?: LineSelection;
  editorPosition?: EditorPosition;
  triggerAction?: (actionId: string) => void;
}

export function useEditorContextMenu() {
  const [menuState, setMenuState] = createSignal<MenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    filePath: "",
    selection: undefined,
    editorPosition: undefined,
    triggerAction: undefined,
  });

  const showMenu = (
    x: number,
    y: number,
    filePath: string,
    selection?: LineSelection,
    editorPosition?: EditorPosition,
    triggerAction?: (actionId: string) => void
  ) => {
    setMenuState({
      isOpen: true,
      position: { x, y },
      filePath,
      selection,
      editorPosition,
      triggerAction,
    });
  };

  const hideMenu = () => {
    setMenuState((prev: MenuState) => ({ ...prev, isOpen: false }));
  };

  return {
    menuState,
    showMenu,
    hideMenu,
  };
}


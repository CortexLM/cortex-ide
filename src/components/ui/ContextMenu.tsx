/**
 * =============================================================================
 * CONTEXT MENU - JetBrains Dark Theme Style
 * =============================================================================
 * 
 * A centralized, reusable context menu component with:
 * - JetBrains Dark Theme styling (deep slate background, subtle borders)
 * - Icon support with custom colors (e.g., yellow lightbulb)
 * - Keyboard shortcuts aligned right (muted gray)
 * - Separators between sections
 * - Header items with highlighted styling
 * - Submenu support with arrow indicator
 * - Keyboard navigation (Arrow Up/Down, Enter, Escape)
 * - Smart positioning (avoids screen edges)
 * - Smooth fade-in animation
 * 
 * Usage:
 *   import { ContextMenu, useContextMenu } from '@/components/ui';
 *   
 *   const { menuState, showMenu, hideMenu } = useContextMenu();
 *   
 *   <div onContextMenu={(e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, items); }}>
 *     ...
 *   </div>
 *   <ContextMenu state={menuState()} onClose={hideMenu} />
 */

import { Show, For, createSignal, createEffect, onCleanup, onMount, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { Icon } from "./Icon";

// =============================================================================
// JETBRAINS DARK THEME COLORS
// =============================================================================

const JB_COLORS = {
  // Container
  background: "var(--cortex-bg-hover, var(--cortex-bg-hover))",
  backgroundHover: "var(--cortex-bg-hover, var(--cortex-bg-hover))",
  border: "var(--cortex-bg-active)",
  shadow: "0 4px 12px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.25)",
  
  // Text
  foreground: "var(--cortex-text-secondary)",
  foregroundHover: "var(--cortex-text-primary, var(--cortex-text-primary))",
  shortcut: "var(--cortex-text-inactive)",
  disabled: "var(--cortex-bg-active)",
  header: "var(--cortex-info)",
  
  // Hover state
  hoverBg: "var(--cortex-bg-hover)",
  
  // Separator
  separator: "var(--cortex-bg-hover)",
  
  // Icon colors
  iconDefault: "var(--cortex-text-inactive)",
  iconYellow: "var(--cortex-warning)",
  iconBlue: "var(--cortex-info)",
  iconGreen: "var(--cortex-success)",
  iconRed: "var(--cortex-error)",
  iconOrange: "var(--cortex-warning)",
} as const;

// =============================================================================
// STYLING CONSTANTS
// =============================================================================

const JB_STYLES = {
  container: {
    minWidth: "200px",
    maxWidth: "340px",
    padding: "5px 0",
    borderRadius: "var(--cortex-radius-md)",
    fontSize: "13px",
    fontWeight: "450",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  item: {
    height: "28px",
    paddingLeft: "12px",
    paddingRight: "14px",
    iconWidth: "16px",
    iconMarginRight: "10px",
    gap: "10px",
  },
  separator: {
    height: "1px",
    marginVertical: "4px",
    marginHorizontal: "8px",
  },
  submenuArrow: {
    marginLeft: "auto",
    paddingLeft: "16px",
  },
  animation: {
    duration: "80ms",
    easing: "ease-out",
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface ContextMenuItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** FontAwesome icon name (without 'fa-' prefix) */
  icon?: string;
  /** Custom icon color (hex or named JB color: 'yellow', 'blue', 'green', 'red', 'orange') */
  iconColor?: string | "yellow" | "blue" | "green" | "red" | "orange";
  /** Keyboard shortcut display (e.g., "Ctrl+C") */
  shortcut?: string;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Whether this is a header item (highlighted styling) */
  isHeader?: boolean;
  /** Submenu items */
  children?: ContextMenuItem[];
  /** Action handler */
  action?: () => void;
}

export interface ContextMenuSection {
  items: ContextMenuItem[];
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  sections: ContextMenuSection[];
}

export interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getIconColor(color?: string): string {
  if (!color) return JB_COLORS.iconDefault;
  
  const colorMap: Record<string, string> = {
    yellow: JB_COLORS.iconYellow,
    blue: JB_COLORS.iconBlue,
    green: JB_COLORS.iconGreen,
    red: JB_COLORS.iconRed,
    orange: JB_COLORS.iconOrange,
  };
  
  return colorMap[color] || color;
}

function calculateMenuPosition(x: number, y: number, menuWidth: number, menuHeight: number) {
  const padding = 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let finalX = x;
  let finalY = y;
  
  // Adjust if menu would go off right edge
  if (x + menuWidth > viewportWidth - padding) {
    finalX = viewportWidth - menuWidth - padding;
  }
  
  // Adjust if menu would go off bottom edge
  if (y + menuHeight > viewportHeight - padding) {
    finalY = viewportHeight - menuHeight - padding;
  }
  
  // Ensure minimum padding from edges
  finalX = Math.max(padding, finalX);
  finalY = Math.max(padding, finalY);
  
  return { x: finalX, y: finalY };
}

// =============================================================================
// CONTEXT MENU ITEM COMPONENT
// =============================================================================

interface MenuItemProps {
  item: ContextMenuItem;
  isFocused: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

function MenuItem(props: MenuItemProps) {
  const itemStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    width: "100%",
    height: JB_STYLES.item.height,
    padding: `0 ${JB_STYLES.item.paddingRight} 0 ${JB_STYLES.item.paddingLeft}`,
    border: "none",
    background: props.isFocused && !props.item.disabled ? JB_COLORS.hoverBg : "transparent",
    color: props.item.disabled 
      ? JB_COLORS.disabled 
      : props.item.isHeader 
        ? JB_COLORS.header 
        : props.isFocused 
          ? JB_COLORS.foregroundHover 
          : JB_COLORS.foreground,
    cursor: props.item.disabled ? "default" : "pointer",
    "font-size": JB_STYLES.container.fontSize,
    "font-weight": JB_STYLES.container.fontWeight,
    "font-family": JB_STYLES.container.fontFamily,
    "text-align": "left",
    "white-space": "nowrap",
    transition: `background ${JB_STYLES.animation.duration} ${JB_STYLES.animation.easing}`,
  });

  const iconStyle = (): JSX.CSSProperties => ({
    width: JB_STYLES.item.iconWidth,
    height: JB_STYLES.item.iconWidth,
    "margin-right": JB_STYLES.item.iconMarginRight,
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "flex-shrink": "0",
    color: props.item.disabled ? JB_COLORS.disabled : getIconColor(props.item.iconColor),
  });

  const labelStyle = (): JSX.CSSProperties => ({
    flex: "1",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "font-weight": props.item.isHeader ? "550" : "inherit",
  });

  const shortcutStyle = (): JSX.CSSProperties => ({
    color: JB_COLORS.shortcut,
    "font-size": "12.5px",
    "font-weight": "400",
    "margin-left": "auto",
    "padding-left": "20px",
    "flex-shrink": "0",
  });

  const submenuArrowStyle = (): JSX.CSSProperties => ({
    color: JB_COLORS.shortcut,
    "font-size": "10px",
    "margin-left": "auto",
    "padding-left": "12px",
  });

  return (
    <button
      style={itemStyle()}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!props.item.disabled && !props.item.children) {
          props.onClick();
        }
      }}
      disabled={props.item.disabled}
    >
      {/* Icon slot (always reserve space for alignment) */}
      <span style={iconStyle()}>
        <Show when={props.item.icon}>
          <Icon name={props.item.icon!} style={{ width: "14px", height: "14px" }} />
        </Show>
      </span>
      
      {/* Label */}
      <span style={labelStyle()}>{props.item.label}</span>
      
      {/* Shortcut or submenu arrow */}
      <Show when={props.item.children && props.item.children.length > 0}>
        <span style={submenuArrowStyle()}>
          <Icon name="chevron-right" style={{ width: "8px", height: "8px" }} />
        </span>
      </Show>
      <Show when={props.item.shortcut && (!props.item.children || props.item.children.length === 0)}>
        <span style={shortcutStyle()}>{props.item.shortcut}</span>
      </Show>
    </button>
  );
}

// =============================================================================
// SEPARATOR COMPONENT
// =============================================================================

function MenuSeparator() {
  return (
    <div
      style={{
        height: JB_STYLES.separator.height,
        margin: `${JB_STYLES.separator.marginVertical} ${JB_STYLES.separator.marginHorizontal}`,
        background: JB_COLORS.separator,
      }}
    />
  );
}

// =============================================================================
// MAIN CONTEXT MENU COMPONENT
// =============================================================================

export function ContextMenu(props: ContextMenuProps) {
  let menuRef: HTMLDivElement | undefined;
  const [focusedIndex, setFocusedIndex] = createSignal(-1);
  const [menuSize, setMenuSize] = createSignal({ width: 200, height: 200 });

  // Flatten all items for keyboard navigation
  const flatItems = () => {
    const items: { item: ContextMenuItem; sectionIndex: number; itemIndex: number }[] = [];
    props.state.sections.forEach((section, sectionIndex) => {
      section.items.forEach((item, itemIndex) => {
        items.push({ item, sectionIndex, itemIndex });
      });
    });
    return items;
  };

  // Get navigable indices (non-disabled items)
  const navigableIndices = () => {
    return flatItems()
      .map((entry, index) => ({ index, disabled: entry.item.disabled }))
      .filter(e => !e.disabled)
      .map(e => e.index);
  };

  // Handle click outside
  createEffect(() => {
    if (!props.state.visible) return;

    setFocusedIndex(-1);

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        props.onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const indices = navigableIndices();
      if (indices.length === 0) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          props.onClose();
          break;
        case "ArrowDown": {
          e.preventDefault();
          const currentPos = indices.indexOf(focusedIndex());
          const nextPos = currentPos < indices.length - 1 ? currentPos + 1 : 0;
          setFocusedIndex(indices[nextPos]);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const currentPos = indices.indexOf(focusedIndex());
          const prevPos = currentPos > 0 ? currentPos - 1 : indices.length - 1;
          setFocusedIndex(indices[prevPos]);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const focused = flatItems()[focusedIndex()];
          if (focused && !focused.item.disabled && focused.item.action) {
            focused.item.action();
            props.onClose();
          }
          break;
        }
      }
    };

    // Delay to avoid immediate close from the triggering click
    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);

    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Measure menu size after render
  onMount(() => {
    if (menuRef) {
      const rect = menuRef.getBoundingClientRect();
      setMenuSize({ width: rect.width, height: rect.height });
    }
  });

  // Calculate position
  const position = () => {
    return calculateMenuPosition(
      props.state.x, 
      props.state.y, 
      menuSize().width, 
      menuSize().height
    );
  };

  // Animation keyframes
  const animationStyle = `
    @keyframes jbContextMenuFadeIn {
      from {
        opacity: 0;
        transform: scale(0.98);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `;

  const containerStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    left: `${position().x}px`,
    top: `${position().y}px`,
    "min-width": JB_STYLES.container.minWidth,
    "max-width": JB_STYLES.container.maxWidth,
    padding: JB_STYLES.container.padding,
    background: JB_COLORS.background,
    border: `1px solid ${JB_COLORS.border}`,
    "border-radius": JB_STYLES.container.borderRadius,
    "box-shadow": JB_COLORS.shadow,
    "z-index": "10000",
    "font-family": JB_STYLES.container.fontFamily,
    animation: `jbContextMenuFadeIn ${JB_STYLES.animation.duration} ${JB_STYLES.animation.easing}`,
    "transform-origin": "top left",
  });

  // Track global item index for focus management
  let globalIndex = 0;

  return (
    <Show when={props.state.visible}>
      <Portal>
        <style>{animationStyle}</style>
        <div ref={menuRef} style={containerStyle()}>
          <For each={props.state.sections}>
            {(section, sectionIndex) => {
              // Reset global index at start of rendering
              if (sectionIndex() === 0) globalIndex = 0;
              
              return (
                <>
                  {/* Add separator before section (except first) */}
                  <Show when={sectionIndex() > 0}>
                    <MenuSeparator />
                  </Show>
                  
                  {/* Section items */}
                  <For each={section.items}>
                    {(item) => {
                      const currentIndex = globalIndex++;
                      return (
                        <MenuItem
                          item={item}
                          isFocused={focusedIndex() === currentIndex}
                          onMouseEnter={() => !item.disabled && setFocusedIndex(currentIndex)}
                          onMouseLeave={() => {
                            if (focusedIndex() === currentIndex) {
                              setFocusedIndex(-1);
                            }
                          }}
                          onClick={() => {
                            if (item.action) {
                              item.action();
                              props.onClose();
                            }
                          }}
                        />
                      );
                    }}
                  </For>
                </>
              );
            }}
          </For>
        </div>
      </Portal>
    </Show>
  );
}

// =============================================================================
// CONTEXT MENU HOOK
// =============================================================================

export function useContextMenu() {
  const [menuState, setMenuState] = createSignal<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    sections: [],
  });

  const showMenu = (x: number, y: number, sections: ContextMenuSection[]) => {
    setMenuState({
      visible: true,
      x,
      y,
      sections,
    });
  };

  const hideMenu = () => {
    setMenuState((prev) => ({ ...prev, visible: false }));
  };

  return {
    menuState,
    showMenu,
    hideMenu,
  };
}

// =============================================================================
// PRESET MENU BUILDERS (Helpers for common menus)
// =============================================================================

export const ContextMenuPresets = {
  /** File context menu items for FileExplorer */
  fileItems: (handlers: {
    onOpen?: () => void;
    onOpenDefault?: () => void;
    onCut?: () => void;
    onCopy?: () => void;
    onPaste?: () => void;
    onDuplicate?: () => void;
    onRename?: () => void;
    onDelete?: () => void;
    onCopyPath?: () => void;
    onCopyRelativePath?: () => void;
    onReveal?: () => void;
    hasClipboard?: boolean;
  }): ContextMenuSection[] => [
    {
      items: [
        { id: "open", label: "Open", icon: "file", action: handlers.onOpen },
        { id: "openDefault", label: "Open with Default App", icon: "arrow-up-right-from-square", action: handlers.onOpenDefault },
      ],
    },
    {
      items: [
        { id: "cut", label: "Cut", icon: "scissors", shortcut: "Ctrl+X", action: handlers.onCut },
        { id: "copy", label: "Copy", icon: "copy", shortcut: "Ctrl+C", action: handlers.onCopy },
        { id: "paste", label: "Paste", icon: "paste", shortcut: "Ctrl+V", disabled: !handlers.hasClipboard, action: handlers.onPaste },
        { id: "duplicate", label: "Duplicate", shortcut: "Ctrl+D", action: handlers.onDuplicate },
      ],
    },
    {
      items: [
        { id: "rename", label: "Rename", icon: "pen", shortcut: "F2", action: handlers.onRename },
        { id: "delete", label: "Delete", icon: "trash", iconColor: "red", shortcut: "Delete", action: handlers.onDelete },
      ],
    },
    {
      items: [
        { id: "copyPath", label: "Copy Path", action: handlers.onCopyPath },
        { id: "copyRelativePath", label: "Copy Relative Path", action: handlers.onCopyRelativePath },
      ],
    },
    {
      items: [
        { id: "reveal", label: "Reveal in Explorer", icon: "folder-open", action: handlers.onReveal },
      ],
    },
  ],

  /** Folder context menu items for FileExplorer */
  folderItems: (handlers: {
    onNewFile?: () => void;
    onNewFolder?: () => void;
    onCut?: () => void;
    onCopy?: () => void;
    onPaste?: () => void;
    onDuplicate?: () => void;
    onRename?: () => void;
    onDelete?: () => void;
    onCopyPath?: () => void;
    onCopyRelativePath?: () => void;
    onReveal?: () => void;
    onOpenInTerminal?: () => void;
    hasClipboard?: boolean;
  }): ContextMenuSection[] => [
    {
      items: [
        { id: "newFile", label: "New File...", icon: "file-circle-plus", shortcut: "Ctrl+N", action: handlers.onNewFile },
        { id: "newFolder", label: "New Folder...", icon: "folder-plus", action: handlers.onNewFolder },
      ],
    },
    {
      items: [
        { id: "cut", label: "Cut", icon: "scissors", shortcut: "Ctrl+X", action: handlers.onCut },
        { id: "copy", label: "Copy", icon: "copy", shortcut: "Ctrl+C", action: handlers.onCopy },
        { id: "paste", label: "Paste", icon: "paste", shortcut: "Ctrl+V", disabled: !handlers.hasClipboard, action: handlers.onPaste },
        { id: "duplicate", label: "Duplicate", action: handlers.onDuplicate },
      ],
    },
    {
      items: [
        { id: "rename", label: "Rename", icon: "pen", shortcut: "F2", action: handlers.onRename },
        { id: "delete", label: "Delete", icon: "trash", iconColor: "red", shortcut: "Delete", action: handlers.onDelete },
      ],
    },
    {
      items: [
        { id: "copyPath", label: "Copy Path", action: handlers.onCopyPath },
        { id: "copyRelativePath", label: "Copy Relative Path", action: handlers.onCopyRelativePath },
      ],
    },
    {
      items: [
        { id: "reveal", label: "Reveal in Explorer", icon: "folder-open", action: handlers.onReveal },
        { id: "openInTerminal", label: "Open in Terminal", icon: "terminal", action: handlers.onOpenInTerminal },
      ],
    },
  ],

  /** Tab context menu items */
  tabItems: (handlers: {
    onClose?: () => void;
    onCloseOthers?: () => void;
    onCloseAll?: () => void;
    onCloseToRight?: () => void;
    onCloseToLeft?: () => void;
    onPin?: () => void;
    onCopyPath?: () => void;
    onCopyRelativePath?: () => void;
    onReveal?: () => void;
    isPinned?: boolean;
  }): ContextMenuSection[] => [
    {
      items: [
        { id: "close", label: "Close", shortcut: "Ctrl+W", action: handlers.onClose },
        { id: "closeOthers", label: "Close Others", action: handlers.onCloseOthers },
        { id: "closeAll", label: "Close All", action: handlers.onCloseAll },
        { id: "closeToRight", label: "Close to the Right", action: handlers.onCloseToRight },
        { id: "closeToLeft", label: "Close to the Left", action: handlers.onCloseToLeft },
      ],
    },
    {
      items: [
        { 
          id: "pin", 
          label: handlers.isPinned ? "Unpin Tab" : "Pin Tab", 
          icon: "thumbtack", 
          iconColor: handlers.isPinned ? "blue" : undefined,
          action: handlers.onPin 
        },
      ],
    },
    {
      items: [
        { id: "copyPath", label: "Copy Path", action: handlers.onCopyPath },
        { id: "copyRelativePath", label: "Copy Relative Path", action: handlers.onCopyRelativePath },
      ],
    },
    {
      items: [
        { id: "reveal", label: "Reveal in Explorer", icon: "folder-open", action: handlers.onReveal },
      ],
    },
  ],

  /** Editor context menu items */
  editorItems: (handlers: {
    onShowContextActions?: () => void;
    onGoToDefinition?: () => void;
    onPeekDefinition?: () => void;
    onFindAllReferences?: () => void;
    onPeekReferences?: () => void;
    onCut?: () => void;
    onCopy?: () => void;
    onPaste?: () => void;
    onOpenOnRemote?: () => void;
    onCopyPermalink?: () => void;
    onViewBlame?: () => void;
    providerName?: string;
    hasGitHosting?: boolean;
  }): ContextMenuSection[] => {
    const sections: ContextMenuSection[] = [
      {
        items: [
          { 
            id: "contextActions", 
            label: "Show Context Actions", 
            icon: "lightbulb", 
            iconColor: "yellow",
            shortcut: "Alt+Enter",
            isHeader: true,
            action: handlers.onShowContextActions 
          },
        ],
      },
      {
        items: [
          { id: "goToDefinition", label: "Go to Definition", shortcut: "F12", action: handlers.onGoToDefinition },
          { id: "peekDefinition", label: "Peek Definition", shortcut: "Alt+F12", action: handlers.onPeekDefinition },
          { id: "findAllReferences", label: "Find All References", shortcut: "Shift+F12", action: handlers.onFindAllReferences },
          { id: "peekReferences", label: "Peek References", action: handlers.onPeekReferences },
        ],
      },
      {
        items: [
          { id: "cut", label: "Cut", icon: "scissors", shortcut: "Ctrl+X", action: handlers.onCut },
          { id: "copy", label: "Copy", icon: "copy", shortcut: "Ctrl+C", action: handlers.onCopy },
          { id: "paste", label: "Paste", icon: "paste", shortcut: "Ctrl+V", action: handlers.onPaste },
        ],
      },
    ];

    // Add git hosting section if available
    if (handlers.hasGitHosting) {
      sections.push({
        items: [
          { 
            id: "openOnRemote", 
            label: `Open on ${handlers.providerName || "Remote"}`, 
            icon: "arrow-up-right-from-square",
            action: handlers.onOpenOnRemote 
          },
          { id: "copyPermalink", label: "Copy Permalink", icon: "link", action: handlers.onCopyPermalink },
          { id: "viewBlame", label: "View Blame", icon: "eye", action: handlers.onViewBlame },
        ],
      });
    }

    return sections;
  },

  /** Chat message context menu items */
  chatMessageItems: (handlers: {
    onCopyMessage?: () => void;
    onCopyCodeBlock?: () => void;
    onRegenerate?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    hasCodeBlock?: boolean;
    isUserMessage?: boolean;
  }): ContextMenuSection[] => {
    const sections: ContextMenuSection[] = [
      {
        items: [
          { id: "copyMessage", label: "Copy Message", icon: "copy", action: handlers.onCopyMessage },
          ...(handlers.hasCodeBlock ? [{ 
            id: "copyCodeBlock", 
            label: "Copy Code Block", 
            icon: "code",
            action: handlers.onCopyCodeBlock 
          }] : []),
        ],
      },
    ];

    if (!handlers.isUserMessage) {
      sections.push({
        items: [
          { id: "regenerate", label: "Regenerate Response", icon: "rotate", action: handlers.onRegenerate },
        ],
      });
    }

    if (handlers.isUserMessage) {
      sections.push({
        items: [
          { id: "edit", label: "Edit Message", icon: "pen", action: handlers.onEdit },
        ],
      });
    }

    sections.push({
      items: [
        { id: "delete", label: "Delete Message", icon: "trash", iconColor: "red", action: handlers.onDelete },
      ],
    });

    return sections;
  },

  /** Chat panel empty area context menu */
  chatEmptyItems: (handlers: {
    onClearConversation?: () => void;
    onExportChat?: () => void;
    onSettings?: () => void;
  }): ContextMenuSection[] => [
    {
      items: [
        { id: "clearConversation", label: "Clear Conversation", icon: "broom", action: handlers.onClearConversation },
        { id: "exportChat", label: "Export Chat...", icon: "file-export", action: handlers.onExportChat },
      ],
    },
    {
      items: [
        { id: "settings", label: "Settings", icon: "gear", action: handlers.onSettings },
      ],
    },
  ],
};

export default ContextMenu;


/**
 * Open With Menu Component
 *
 * Context menu for choosing which editor to open a file with.
 * Features:
 * - Lists available editors for the file type
 * - Shows current default with checkmark
 * - "Configure Default Editor..." option
 * - "Remember choice" option for quick setting
 */

import {
  Show,
  For,
  createSignal,
  createEffect,
  onCleanup,
  createMemo,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Icon } from "./ui/Icon";
import { useEditorAssociations } from "@/context/EditorAssociationsContext";
import { Text } from "@/components/ui";

// ============================================================================
// VS Code Context Menu Styling (matching EditorContextMenu)
// ============================================================================

const CONTEXT_MENU_COLORS = {
  shadowColor: "rgba(0, 0, 0, 0.36)",
  borderColor: "var(--cortex-bg-active)",
  foregroundColor: "var(--cortex-text-primary)",
  backgroundColor: "var(--ui-panel-bg-lighter)",
  selectionForegroundColor: "var(--cortex-text-primary)",
  selectionBackgroundColor: "var(--cortex-bg-active)",
  selectionBorderColor: "transparent",
  separatorColor: "var(--cortex-bg-active)",
};

const CONTEXT_MENU_TIMINGS = {
  fadeInDuration: 83,
  transformTransition: 50,
};

const CONTEXT_MENU_STYLES = {
  container: {
    minWidth: "220px",
    maxWidth: "320px",
    background: CONTEXT_MENU_COLORS.backgroundColor,
    border: `1px solid ${CONTEXT_MENU_COLORS.borderColor}`,
    borderRadius: "var(--cortex-radius-md)",
    boxShadow: `0 2px 8px ${CONTEXT_MENU_COLORS.shadowColor}`,
    padding: "4px 0",
    zIndex: 2575,
  },
  item: {
    height: "26px",
    lineHeight: "26px",
    paddingHorizontal: "10px",
    fontSize: "13px",
    borderRadius: "0",
    margin: "0",
    gap: "8px",
  },
  separator: {
    height: "1px",
    marginVertical: "4px",
    marginHorizontal: "0px",
    background: CONTEXT_MENU_COLORS.separatorColor,
  },
  hover: {
    background: CONTEXT_MENU_COLORS.selectionBackgroundColor,
    color: CONTEXT_MENU_COLORS.selectionForegroundColor,
  },
  checkIcon: {
    width: "16px",
  },
  icon: {
    width: "16px",
    height: "16px",
  },
  animation: {
    duration: `${CONTEXT_MENU_TIMINGS.fadeInDuration}ms`,
    easing: "linear",
  },
};

// ============================================================================
// Icon Mapping
// ============================================================================

const EDITOR_ICON_NAMES: Record<string, string> = {
  default: "file",
  monaco: "code",
  imagePreview: "image",
  videoPlayer: "play",
  audioPlayer: "volume",
  pdfViewer: "file-lines",
  hexEditor: "file-code",
  markdownPreview: "book-open",
  notebookEditor: "box",
};

function getEditorIconName(editorId: string): string {
  return EDITOR_ICON_NAMES[editorId] || "file";
}

// ============================================================================
// Types
// ============================================================================

export interface OpenWithMenuProps {
  /** File path to open with */
  filePath: string;
  /** Menu position */
  position: { x: number; y: number };
  /** Callback when an editor is selected */
  onSelect: (editorId: string) => void;
  /** Callback when menu should close */
  onClose: () => void;
  /** Callback to open the configure default editor dialog */
  onConfigureDefault?: (pattern: string) => void;
}

interface MenuItemData {
  id: string;
  label: string;
  iconName: string;
  isDefault: boolean;
  action: () => void;
  dividerAfter?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function OpenWithMenu(props: OpenWithMenuProps) {
  const editorAssociations = useEditorAssociations();
  const [focusedIndex, setFocusedIndex] = createSignal(-1);
  const [rememberChoice, setRememberChoice] = createSignal(false);
  let menuRef: HTMLDivElement | undefined;

  // Animation keyframes
  const animationStyle = `
    @keyframes openWithMenuFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;

  // Get file extension for pattern
  const fileExtension = createMemo(() => {
    const fileName = props.filePath.split(/[/\\]/).pop() || props.filePath;
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot === -1 || lastDot === 0) {
      // No extension or hidden file, use filename
      return fileName;
    }
    return `*${fileName.slice(lastDot)}`;
  });

  // Get available editors for this file
  const availableEditors = createMemo(() =>
    editorAssociations.getAvailableEditorsForFile(props.filePath)
  );

  // Get current default editor
  const currentDefaultEditor = createMemo(() =>
    editorAssociations.getEditorForFile(props.filePath)
  );

  // Build menu items
  const menuItems = createMemo((): MenuItemData[] => {
    const items: MenuItemData[] = [];
    const editors = availableEditors();
    const defaultId = currentDefaultEditor();

    // Add available editors
    for (const editor of editors) {
      items.push({
        id: editor.id,
        label: editor.label,
        iconName: getEditorIconName(editor.id),
        isDefault: editor.id === defaultId,
        action: () => handleSelectEditor(editor.id),
      });
    }

    // Add separator before config option
    if (items.length > 0) {
      items[items.length - 1].dividerAfter = true;
    }

    return items;
  });

  // Handle editor selection
  const handleSelectEditor = (editorId: string) => {
    // If remember choice is checked, save the association
    if (rememberChoice()) {
      const pattern = fileExtension();
      editorAssociations.setAssociation(pattern, editorId);
    }
    props.onSelect(editorId);
    props.onClose();
  };

  // Handle configure default
  const handleConfigureDefault = () => {
    if (props.onConfigureDefault) {
      props.onConfigureDefault(fileExtension());
    }
    props.onClose();
  };

  // Handle click outside
  createEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        props.onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = menuItems();
      const totalItems = items.length + 2; // editors + remember + configure

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          props.onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          const idx = focusedIndex();
          if (idx >= 0 && idx < items.length) {
            items[idx].action();
          } else if (idx === items.length) {
            // Remember choice checkbox
            setRememberChoice(!rememberChoice());
          } else if (idx === items.length + 1) {
            // Configure default
            handleConfigureDefault();
          }
          break;
      }
    };

    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);

    onCleanup(() => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Calculate menu position
  const getMenuStyle = (): JSX.CSSProperties => {
    const padding = 8;
    const menuWidth = 280;
    const menuHeight = 300;

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

    const originX =
      props.position.x >= window.innerWidth - menuWidth - padding ? "right" : "left";
    const originY =
      props.position.y >= window.innerHeight - menuHeight - padding ? "bottom" : "top";

    return {
      position: "fixed",
      left: `${Math.max(padding, x)}px`,
      top: `${Math.max(padding, y)}px`,
      "transform-origin": `${originY} ${originX}`,
      "min-width": CONTEXT_MENU_STYLES.container.minWidth,
      "max-width": CONTEXT_MENU_STYLES.container.maxWidth,
      background: CONTEXT_MENU_STYLES.container.background,
      border: CONTEXT_MENU_STYLES.container.border,
      "border-radius": CONTEXT_MENU_STYLES.container.borderRadius,
      "box-shadow": CONTEXT_MENU_STYLES.container.boxShadow,
      padding: CONTEXT_MENU_STYLES.container.padding,
      "z-index": CONTEXT_MENU_STYLES.container.zIndex,
      animation: `openWithMenuFadeIn ${CONTEXT_MENU_STYLES.animation.duration} ${CONTEXT_MENU_STYLES.animation.easing}`,
      overflow: "hidden",
    };
  };

  return (
    <Portal>
      <style>{animationStyle}</style>
      <div ref={menuRef} style={getMenuStyle()}>
        {/* Header */}
        <div
          style={{
            padding: "4px 10px 8px",
            "border-bottom": `1px solid ${CONTEXT_MENU_COLORS.separatorColor}`,
            "margin-bottom": "4px",
          }}
        >
          <Text
            size="xs"
            weight="medium"
            style={{ color: "rgba(204, 204, 204, 0.7)" }}
          >
            Open With...
          </Text>
          <Text
            size="xs"
            style={{
              color: "rgba(204, 204, 204, 0.5)",
              "margin-top": "2px",
              "word-break": "break-all",
            }}
          >
            {props.filePath.split(/[/\\]/).pop()}
          </Text>
        </div>

        {/* Editor options */}
        <Show
          when={menuItems().length > 0}
          fallback={
            <div
              style={{
                padding: "12px 10px",
                color: "rgba(204, 204, 204, 0.6)",
                "font-size": "13px",
                "text-align": "center",
              }}
            >
              No editors available
            </div>
          }
        >
          <For each={menuItems()}>
            {(item, index) => {
              const isFocused = () => focusedIndex() === index();

              return (
                <>
                  <button
                    class="w-full flex items-center"
                    style={{
                      height: CONTEXT_MENU_STYLES.item.height,
                      "line-height": CONTEXT_MENU_STYLES.item.lineHeight,
                      padding: `0 ${CONTEXT_MENU_STYLES.item.paddingHorizontal}`,
                      "font-size": CONTEXT_MENU_STYLES.item.fontSize,
                      gap: CONTEXT_MENU_STYLES.item.gap,
                      color: isFocused()
                        ? CONTEXT_MENU_STYLES.hover.color
                        : CONTEXT_MENU_COLORS.foregroundColor,
                      background: isFocused()
                        ? CONTEXT_MENU_STYLES.hover.background
                        : "transparent",
                      "border-radius": CONTEXT_MENU_STYLES.item.borderRadius,
                      margin: CONTEXT_MENU_STYLES.item.margin,
                      cursor: "pointer",
                      "white-space": "nowrap",
                      border: "none",
                      "text-align": "left",
                    }}
                    onClick={item.action}
                    onMouseEnter={() => setFocusedIndex(index())}
                    onMouseLeave={() => {
                      if (focusedIndex() === index()) {
                        setFocusedIndex(-1);
                      }
                    }}
                  >
                    {/* Checkmark for default */}
                    <span
                      style={{
                        width: CONTEXT_MENU_STYLES.checkIcon.width,
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "center",
                        "flex-shrink": "0",
                      }}
                    >
                      <Show when={item.isDefault}>
                        <Icon name="check" size={14} style={{ color: "var(--cortex-success)" }} />
                      </Show>
                    </span>

                    {/* Icon */}
                    <span
                      style={{
                        width: CONTEXT_MENU_STYLES.icon.width,
                        height: CONTEXT_MENU_STYLES.icon.height,
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "center",
                        "flex-shrink": "0",
                      }}
                    >
                      <Icon name={item.iconName} size={14} />
                    </span>

                    {/* Label */}
                    <span class="flex-1 truncate">{item.label}</span>

                    {/* Default indicator */}
                    <Show when={item.isDefault}>
                      <span
                        style={{
                          "font-size": "10px",
                          color: "rgba(204, 204, 204, 0.5)",
                          "flex-shrink": "0",
                        }}
                      >
                        (default)
                      </span>
                    </Show>
                  </button>

                  <Show when={item.dividerAfter}>
                    <div
                      style={{
                        height: CONTEXT_MENU_STYLES.separator.height,
                        background: CONTEXT_MENU_STYLES.separator.background,
                        margin: `${CONTEXT_MENU_STYLES.separator.marginVertical} ${CONTEXT_MENU_STYLES.separator.marginHorizontal}`,
                      }}
                    />
                  </Show>
                </>
              );
            }}
          </For>
        </Show>

        {/* Remember choice checkbox */}
        <Show when={menuItems().length > 0}>
          <button
            class="w-full flex items-center"
            style={{
              height: CONTEXT_MENU_STYLES.item.height,
              "line-height": CONTEXT_MENU_STYLES.item.lineHeight,
              padding: `0 ${CONTEXT_MENU_STYLES.item.paddingHorizontal}`,
              "font-size": CONTEXT_MENU_STYLES.item.fontSize,
              gap: CONTEXT_MENU_STYLES.item.gap,
              color:
                focusedIndex() === menuItems().length
                  ? CONTEXT_MENU_STYLES.hover.color
                  : CONTEXT_MENU_COLORS.foregroundColor,
              background:
                focusedIndex() === menuItems().length
                  ? CONTEXT_MENU_STYLES.hover.background
                  : "transparent",
              "border-radius": CONTEXT_MENU_STYLES.item.borderRadius,
              margin: CONTEXT_MENU_STYLES.item.margin,
              cursor: "pointer",
              "white-space": "nowrap",
              border: "none",
              "text-align": "left",
            }}
            onClick={() => setRememberChoice(!rememberChoice())}
            onMouseEnter={() => setFocusedIndex(menuItems().length)}
            onMouseLeave={() => {
              if (focusedIndex() === menuItems().length) {
                setFocusedIndex(-1);
              }
            }}
          >
            {/* Checkbox */}
            <span
              style={{
                width: "16px",
                height: "16px",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                border: `1px solid ${
                  rememberChoice() ? "var(--cortex-info)" : "rgba(204, 204, 204, 0.4)"
                }`,
                "border-radius": "var(--cortex-radius-sm)",
                background: rememberChoice()
                  ? "var(--cortex-info)"
                  : "transparent",
                "flex-shrink": "0",
                "margin-left": "16px",
              }}
            >
              <Show when={rememberChoice()}>
                <Icon name="check" size={10} style={{ color: "var(--cortex-text-primary)" }} />
              </Show>
            </span>

            <span class="flex-1 truncate">
              Use as default for {fileExtension()} files
            </span>
          </button>
        </Show>

        {/* Separator */}
        <div
          style={{
            height: CONTEXT_MENU_STYLES.separator.height,
            background: CONTEXT_MENU_STYLES.separator.background,
            margin: `${CONTEXT_MENU_STYLES.separator.marginVertical} ${CONTEXT_MENU_STYLES.separator.marginHorizontal}`,
          }}
        />

        {/* Configure Default Editor option */}
        <button
          class="w-full flex items-center"
          style={{
            height: CONTEXT_MENU_STYLES.item.height,
            "line-height": CONTEXT_MENU_STYLES.item.lineHeight,
            padding: `0 ${CONTEXT_MENU_STYLES.item.paddingHorizontal}`,
            "font-size": CONTEXT_MENU_STYLES.item.fontSize,
            gap: CONTEXT_MENU_STYLES.item.gap,
            color:
              focusedIndex() === menuItems().length + 1
                ? CONTEXT_MENU_STYLES.hover.color
                : CONTEXT_MENU_COLORS.foregroundColor,
            background:
              focusedIndex() === menuItems().length + 1
                ? CONTEXT_MENU_STYLES.hover.background
                : "transparent",
            "border-radius": CONTEXT_MENU_STYLES.item.borderRadius,
            margin: CONTEXT_MENU_STYLES.item.margin,
            cursor: "pointer",
            "white-space": "nowrap",
            border: "none",
            "text-align": "left",
          }}
          onClick={handleConfigureDefault}
          onMouseEnter={() => setFocusedIndex(menuItems().length + 1)}
          onMouseLeave={() => {
            if (focusedIndex() === menuItems().length + 1) {
              setFocusedIndex(-1);
            }
          }}
        >
          <span
            style={{
              width: CONTEXT_MENU_STYLES.checkIcon.width,
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              "flex-shrink": "0",
            }}
          />
          <span
            style={{
              width: CONTEXT_MENU_STYLES.icon.width,
              height: CONTEXT_MENU_STYLES.icon.height,
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              "flex-shrink": "0",
            }}
          >
            <Icon name="gear" size={14} />
          </span>
          <span class="flex-1 truncate">Configure Default Editor...</span>
        </button>
      </div>
    </Portal>
  );
}

// ============================================================================
// Hook for managing Open With menu state
// ============================================================================

interface OpenWithMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  filePath: string;
}

export function useOpenWithMenu() {
  const [state, setState] = createSignal<OpenWithMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    filePath: "",
  });

  const showMenu = (x: number, y: number, filePath: string) => {
    setState({
      isOpen: true,
      position: { x, y },
      filePath,
    });
  };

  const hideMenu = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  return {
    state,
    showMenu,
    hideMenu,
  };
}

// ============================================================================
// Submenu variant for context menus
// ============================================================================

export interface OpenWithSubmenuProps {
  /** File path to open with */
  filePath: string;
  /** Callback when an editor is selected */
  onSelect: (editorId: string) => void;
  /** Callback to open the configure default editor dialog */
  onConfigureDefault?: (pattern: string) => void;
}

/**
 * OpenWithSubmenu returns menu items for use in a parent context menu.
 * This allows "Open With" to be a submenu in the file explorer context menu.
 */
export function getOpenWithMenuItems(
  filePath: string,
  editorAssociations: ReturnType<typeof useEditorAssociations>,
  onSelect: (editorId: string) => void,
  onConfigureDefault?: (pattern: string) => void
): Array<{
  id: string;
  label: string;
  iconName: string;
  isDefault: boolean;
  action: () => void;
  type: "editor" | "separator" | "configure";
}> {
  const items: Array<{
    id: string;
    label: string;
    iconName: string;
    isDefault: boolean;
    action: () => void;
    type: "editor" | "separator" | "configure";
  }> = [];

  const editors = editorAssociations.getAvailableEditorsForFile(filePath);
  const defaultId = editorAssociations.getEditorForFile(filePath);

  // Get file extension for pattern
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const lastDot = fileName.lastIndexOf(".");
  const pattern =
    lastDot === -1 || lastDot === 0 ? fileName : `*${fileName.slice(lastDot)}`;

  // Add available editors
  for (const editor of editors) {
    items.push({
      id: editor.id,
      label: editor.label,
      iconName: getEditorIconName(editor.id),
      isDefault: editor.id === defaultId,
      action: () => onSelect(editor.id),
      type: "editor",
    });
  }

  // Add separator
  if (items.length > 0) {
    items.push({
      id: "separator",
      label: "",
      iconName: "file",
      isDefault: false,
      action: () => {},
      type: "separator",
    });
  }

  // Add configure option
  items.push({
    id: "configure",
    label: "Configure Default Editor...",
    iconName: "gear",
    isDefault: false,
    action: () => onConfigureDefault?.(pattern),
    type: "configure",
  });

  return items;
}


import { For, Show, createSignal, onMount, onCleanup, createEffect, createMemo, type JSX } from "solid-js";
import { Icon } from "../ui/Icon";
import { useEditor, OpenFile } from "@/context/EditorContext";
import { useSettings, type WorkbenchEditorSettings } from "@/context/SettingsContext";
import { useDiagnostics } from "@/context/DiagnosticsContext";
import { ListItem, ContextMenu, ContextMenuPresets } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { zenModeActive } from "@/components/ZenMode";

// ============================================================================
// JetBrains New UI Tab Specifications - Floating Card Style
// ============================================================================
// Tab height: 36px (active tabs full height, inactive slightly shorter)
// Container bg: var(--jb-panel) - darker base
// Inactive tab: bg transparent, NO borders, color var(--jb-text-muted-color)
// Active tab: bg var(--jb-canvas) - SAME as editor for fusion effect
// Active tab corners: 8px top-left, 8px top-right, 0 bottom (card style)
// Inactive tab corners: 6px top, 0 bottom
// NO border indicators - active tab merges seamlessly with editor
// Font sizes: var(--jb-font-size-sm) for tab labels
// ============================================================================

// File Icons - JetBrains-style SVG icons
import { getFileIcon } from "@/utils/fileIcons";

// Tab sizing modes (VS Code)
type TabSizingMode = "fit" | "shrink" | "fixed";

// Tab sticky modes (VS Code)  
type TabStickyMode = "normal" | "compact" | "shrink";

// Tab close button visibility
type TabCloseButtonVisibility = "always" | "onHover" | "never";

// Tab close button position
type TabCloseButtonPosition = "left" | "right";

// ============================================================================
// Tab Decorations - Visual indicators for file status
// ============================================================================

export interface TabDecoration {
  /** Text badge (e.g., "3" for error count) */
  badge?: string;
  /** Badge background color */
  badgeColor?: string;
  /** Tab title color override */
  color?: string;
  /** Strikethrough for deleted files */
  strikethrough?: boolean;
  /** Italic for preview/modified files */
  italic?: boolean;
}

interface FileIconProps {
  name: string;
  size?: number;
}

function FileIcon(props: FileIconProps) {
  const size = () => props.size ?? 14;
  const iconPath = () => getFileIcon(props.name, false);
  
  return (
    <img 
      src={iconPath()} 
      alt="" 
      width={size()} 
      height={size()}
      style={{ "flex-shrink": "0" }}
      draggable={false}
    />
  );
}

// ============================================================================
// Tab Overflow Dropdown
// ============================================================================

interface TabOverflowDropdownProps {
  files: OpenFile[];
  activeFileId: string | null;
  onSelect: (fileId: string) => void;
  onClose: () => void;
}

function TabOverflowDropdown(props: TabOverflowDropdownProps) {
  let dropdownRef: HTMLDivElement | undefined;
  
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        props.onClose();
      }
    };
    
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
    
    onCleanup(() => {
      document.removeEventListener("click", handleClickOutside);
    });
  });

  const dropdownStyle: JSX.CSSProperties = {
    position: "absolute",
    right: "0",
    top: "100%",
    "margin-top": tokens.spacing.sm,
    "z-index": "50",
    "min-width": "200px",
    "max-height": "300px",
    "overflow-y": "auto",
    padding: `${tokens.spacing.sm} 0`,
    "border-radius": tokens.radius.md,
    "box-shadow": "var(--jb-shadow-popup)",
    background: tokens.colors.surface.popup,
    border: `1px solid ${tokens.colors.border.divider}`,
  };

  const modifiedDotStyle: JSX.CSSProperties = {
    width: "8px",
    height: "8px",
    "border-radius": "var(--cortex-radius-full)",
    "flex-shrink": "0",
    background: "var(--jb-border-focus)",
  };
  
  return (
    <div ref={dropdownRef} style={dropdownStyle}>
      <For each={props.files}>
        {(file) => (
          <ListItem
            icon={<FileIcon name={file.name} size={16} />}
            label={file.name}
            selected={props.activeFileId === file.id}
            iconRight={
              file.modified ? <span style={modifiedDotStyle} /> : undefined
            }
            onClick={() => {
              props.onSelect(file.id);
              props.onClose();
            }}
            style={{ margin: "0" }}
          />
        )}
      </For>
    </div>
  );
}

// ============================================================================
// Individual Tab Component - VS Code Specifications
// ============================================================================

interface TabProps {
  file: OpenFile;
  isActive: boolean;
  isGroupFocused?: boolean;
  isSticky?: boolean;
  isPinned?: boolean;
  isPreview?: boolean; // Preview tabs have italic title (VS Code style)
  isDeleted?: boolean; // For Git deleted files (strikethrough)
  stickyMode?: TabStickyMode;
  sizingMode?: TabSizingMode;
  fixedWidth?: number; // Width for fixed sizing mode
  minWidth?: number; // Min width for shrink mode
  showDirtyBorderTop?: boolean;
  showBorderBottom?: boolean;
  showCloseButtonMode?: TabCloseButtonVisibility;
  closeButtonPosition?: TabCloseButtonPosition;
  onSelect: () => void;
  onClose: (e: MouseEvent) => void;
  onMiddleClick: () => void;
  onDoubleClick?: () => void; // Double-click promotes preview to permanent
  onContextMenu: (e: MouseEvent) => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  isDraggedOver: boolean;
  dropPosition?: "left" | "right" | null;
  isFirstTab?: boolean;
  isLastTab?: boolean;
  isBeforeActive?: boolean;
  isAfterActive?: boolean;
  /** Tab decorations from diagnostics/git */
  decoration?: TabDecoration;
}

function Tab(props: TabProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  
  // VS Code: sizing mode defaults
  const sizingMode = () => props.sizingMode ?? "fit";
  const stickyMode = () => props.stickyMode ?? "normal";
  const isGroupFocused = () => props.isGroupFocused ?? true;
  const showCloseButtonMode = () => props.showCloseButtonMode ?? "onHover";
  const closeButtonPosition = () => props.closeButtonPosition ?? "right";
  const fixedWidth = () => props.fixedWidth ?? 120;
  const minWidth = () => props.minWidth ?? 80;
  
  // Get decoration or use default
  const decoration = () => props.decoration ?? {};
  
  const handleMouseDown = (e: MouseEvent) => {
    // Middle-click to close
    if (e.button === 1) {
      e.preventDefault();
      props.onMiddleClick();
    }
  };
  
  const handleDragStart = (e: DragEvent) => {
    setIsDragging(true);
    props.onDragStart(e);
  };
  
  const handleDragEnd = (e: DragEvent) => {
    setIsDragging(false);
    props.onDragEnd(e);
  };
  
  // Show close button only on tab hover (opacity handled in style)
  const showCloseButton = () => {
    // Always render the close button, but opacity is controlled by hover state
    return true;
  };
  
  // Build tab class names for VS Code styling
  const tabClasses = createMemo(() => {
    const classes = ["tab", "group", "relative", "flex", "items-center", "cursor-pointer", "select-none"];
    
    // State classes
    classes.push(props.isActive ? "active" : "inactive");
    if (!isGroupFocused()) classes.push("unfocused-group");
    if (props.file.modified) classes.push("dirty");
    if (props.showDirtyBorderTop && props.file.modified) classes.push("dirty-border-top");
    if (props.showBorderBottom && props.isActive) classes.push("tab-border-bottom");
    if (props.isActive) classes.push("tab-border-top");
    if (props.isPreview) classes.push("preview");
    if (props.isSticky || props.isPinned) classes.push("sticky");
    
    // Sizing mode classes (VS Code)
    classes.push(`sizing-${sizingMode()}`);
    
    // Sticky mode classes (VS Code: 38px compact, 80px shrink)
    if (stickyMode() === "compact") classes.push("sticky-compact");
    else if (stickyMode() === "shrink") classes.push("sticky-shrink");
    
    // Drag and drop classes (VS Code: 1-2px indicators, z-index 11)
    if (props.dropPosition === "left") classes.push("drop-target-left");
    if (props.dropPosition === "right") classes.push("drop-target-right");
    if (props.isFirstTab) classes.push("first-tab");
    if (props.isLastTab) classes.push("last-tab");
    if (props.isBeforeActive) classes.push("before-active");
    if (props.isAfterActive) classes.push("after-active");
    
    // Icon class for padding adjustment
    classes.push("has-icon", "tab-actions-right");
    
    return classes.join(" ");
  });
  
// Tab dimensions based on Figma design specs
  // Active tab: var(--cortex-bg-primary) background, merged with editor (no bottom border)
  // Inactive tabs: transparent background, muted text color
  const getTabStyle = () => {
    const baseStyle: Record<string, string> = {
      "box-sizing": "border-box",
      padding: "0 16px",
      "outline-offset": "-2px",
      border: "none",
      display: "flex",
      "align-items": "center",
      gap: "8px",
    };
    
    // Apply decoration color override
    const dec = decoration();
    const decorationColor = dec.color;
    
    if (props.isActive) {
      baseStyle.height = "100%";
      baseStyle["border-radius"] = "0";
      baseStyle.background = "var(--cortex-bg-secondary, var(--cortex-bg-primary))";
      baseStyle.color = decorationColor ?? "var(--cortex-text-primary)";
      baseStyle["box-shadow"] = "none";
      baseStyle["z-index"] = "10";
      baseStyle.border = "none";
      baseStyle["border-bottom"] = "2px solid var(--cortex-accent, #6366F1)";
    } else {
      baseStyle.height = "100%";
      baseStyle["border-radius"] = "0";
      baseStyle.background = isHovered()
        ? "rgba(255, 255, 255, 0.06)"
        : "transparent";
      baseStyle.border = "none";
      if (decorationColor) {
        baseStyle.color = decorationColor;
      } else {
        baseStyle.color = isHovered()
          ? "var(--cortex-text-primary)"
          : "var(--cortex-text-secondary, #8C8D8F)";
      }
    }
    
    // Sticky compact = 38px × 38px
    if (stickyMode() === "compact") {
      baseStyle.width = "38px";
      baseStyle["min-width"] = "38px";
      baseStyle["max-width"] = "38px";
      baseStyle.padding = `0 ${tokens.spacing.md}`;
    }
    // Sticky shrink = 80px width
    else if (stickyMode() === "shrink") {
      baseStyle.width = "80px";
      baseStyle["min-width"] = "80px";
      baseStyle["max-width"] = "80px";
    }
    // Fit mode = minimum space needed (80px min, 200px max)
    else if (sizingMode() === "fit") {
      baseStyle["min-width"] = "80px";
      baseStyle["max-width"] = "fit-content";
      baseStyle["flex-shrink"] = "0";
      baseStyle["flex-grow"] = "0";
      baseStyle.width = "auto";
    }
    // Shrink mode = tabs shrink to fit with minimum width
    else if (sizingMode() === "shrink") {
      baseStyle["min-width"] = `${minWidth()}px`;
      baseStyle["flex-basis"] = "0";
      baseStyle["flex-grow"] = "1";
      baseStyle["flex-shrink"] = "1";
      baseStyle["max-width"] = "fit-content";
    }
    // Fixed mode = all tabs have same fixed width
    else if (sizingMode() === "fixed") {
      baseStyle.width = `${fixedWidth()}px`;
      baseStyle["min-width"] = `${fixedWidth()}px`;
      baseStyle["max-width"] = `${fixedWidth()}px`;
      baseStyle["flex-shrink"] = "0";
      baseStyle["flex-grow"] = "0";
    }
    
    baseStyle.opacity = isDragging() ? "0.5" : "1";
    
    // Animations 150ms ease-out
    baseStyle.transition = "background-color 150ms ease-out, color 150ms ease-out, opacity 150ms ease-out, height 150ms ease-out, border-radius 150ms ease-out";
    
    return baseStyle;
  };
  
// Close button opacity based on showCloseButtonMode setting
  const getTabActionsOpacity = () => {
    const mode = showCloseButtonMode();
    
    // Never show close button
    if (mode === "never") return 0;
    
    // Always show close button
    if (mode === "always") return 1;
    
    // Show on hover (default) - also show for modified files
    if (isHovered()) return 1;
    if (props.file.modified) return 1;
    return 0;
  };
  
  // Get whether to show the badge
  const shouldShowBadge = () => {
    const dec = decoration();
    return dec.badge && !isHovered();
  };
  
// Close button component for reuse in left/right positions
  const CloseButtonArea = () => (
    <div 
      class="tab-actions flex items-center justify-center flex-shrink-0"
      style={{
        width: "28px",
        "margin-top": "auto",
        "margin-bottom": "auto",
        opacity: getTabActionsOpacity(),
        transition: "opacity 100ms ease-out",
      }}
    >
      <Show 
        when={!props.file.modified || isHovered()}
        fallback={
          // Modified indicator: 8px dot, JetBrains focus color
          <span 
            class="dirty-indicator-dot"
            style={{ 
              width: tokens.spacing.md,
              height: tokens.spacing.md,
              "border-radius": "var(--cortex-radius-full)",
              background: tokens.colors.semantic.primary,
            }}
          />
        }
      >
        {/* Close button - 16px × 16px (Fitts's Law: adequately sized) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onClose(e);
          }}
          class="tab-close-button flex items-center justify-center rounded"
          style={{ 
            width: "16px",
            height: "16px",
            color: tokens.colors.text.muted,
          }}
        >
          <Icon name="xmark" size={16} />
        </button>
      </Show>
    </div>
  );
  
  return (
    <div
      class={tabClasses()}
      style={getTabStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      onClick={props.onSelect}
      onDblClick={() => props.onDoubleClick?.()}
      onContextMenu={props.onContextMenu}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Active tab top border is handled inline in getTabStyle() */}
      
      {/* Close button on left (if configured) */}
      <Show when={closeButtonPosition() === "left"}>
        <CloseButtonArea />
      </Show>
      
      {/* Tab content - 8px gap for proper icon-to-text spacing */}
      <div 
        class="tab-label flex items-center w-full"
        style={{ 
          "line-height": "35px",
          "white-space": "nowrap",
          gap: "8px", // Design spec: 8px spacing from text
        }}
      >
        {/* Pin icon for pinned tabs (compact mode shows only pin icon) */}
        <Show when={props.isPinned && stickyMode() === "compact"}>
          <Icon 
            name="thumbtack"
            size={12}
            class="pin-icon"
            style={{ 
              "flex-shrink": "0",
              color: tokens.colors.semantic.primary,
            }} 
          />
        </Show>
        
        {/* File icon - 16px with 8px spacing (hidden in compact pinned mode) */}
        <Show when={!(props.isPinned && stickyMode() === "compact")}>
          <FileIcon name={props.file.name.split(/[/\\\\]/).pop() || props.file.name} size={16} />
        </Show>
        
        {/* Pin icon indicator for pinned tabs (shown after file icon in non-compact mode) */}
        <Show when={props.isPinned && stickyMode() !== "compact"}>
          <Icon 
            name="thumbtack"
            size={12}
            class="pin-icon"
            style={{ 
              "flex-shrink": "0",
              color: tokens.colors.semantic.primary,
              "margin-left": `-${tokens.spacing.sm}`,
            }} 
          />
        </Show>
        
{/* File name - JetBrains font tokens (hidden in compact pinned mode) */}
        {/* Preview tabs have italic title, deleted files have strikethrough */}
        <Show when={!(props.isPinned && stickyMode() === "compact")}>
          <span 
            
            style={{ 
              "font-size": "var(--jb-font-size-sm)",
              "font-style": (props.isPreview || decoration().italic) ? "italic" : "normal",
              "font-weight": props.isActive ? "500" : "400",
              "text-decoration": decoration().strikethrough ? "line-through" : "none",
              // Full filename display with ellipsis for very long names
              color: decoration().color ?? (props.isActive 
                ? tokens.colors.text.primary
                : tokens.colors.text.muted),
              transition: "color 150ms ease-out, font-style 150ms ease-out, text-decoration 150ms ease-out",
              
            }}
            title={props.file.name.split(/[/\\\\]/).pop() || props.file.name}
          >
            {props.file.name.split(/[/\\\\]/).pop() || props.file.name}
          </span>
        </Show>
        
        {/* Diagnostic badge (errors/warnings count) - shown when not hovering */}
        <Show when={shouldShowBadge()}>
          <span
            class="tab-decoration-badge"
            style={{
              display: "inline-flex",
              "align-items": "center",
              "justify-content": "center",
              "min-width": "16px",
              height: "16px",
              padding: "0 4px",
              "border-radius": "var(--cortex-radius-md)",
              "font-size": "10px",
              "font-weight": "600",
              background: decoration().badgeColor,
              color: "var(--cortex-text-primary)",
              "margin-left": "4px",
              "flex-shrink": "0",
            }}
          >
            {decoration().badge}
          </span>
        </Show>
        
        {/* VS Code: Overflow gradient fade - 5px width (for shrink/fixed modes) */}
        <Show when={sizingMode() !== "fit"}>
          <div 
            class="tab-fade-gradient absolute right-0 top-[1px] bottom-[1px] pointer-events-none"
            style={{
              width: "5px",
              height: "calc(100% - 2px)",
              background: `linear-gradient(to right, transparent, ${props.isActive ? "var(--tab-active-background, var(--surface-raised))" : "var(--tab-inactive-background, var(--background-base))"})`,
              opacity: showCloseButton() ? "0" : "1",
              transition: "opacity 100ms ease-out",
            }}
          />
        </Show>
      </div>
      
{/* Close button on right (default) */}
      <Show when={closeButtonPosition() === "right"}>
        <CloseButtonArea />
      </Show>
      
      {/* JetBrains: Drag and drop indicators - 1px (2px at edges), z-index 11 */}
      <Show when={props.dropPosition === "left"}>
        <div 
          class="drop-indicator-left absolute top-0 h-full pointer-events-none"
          style={{
            right: "-1px",
            width: props.isLastTab ? "2px" : "1px",
            background: tokens.colors.semantic.primary,
            "z-index": "11",
          }}
        />
      </Show>
      <Show when={props.dropPosition === "right"}>
        <div 
          class="drop-indicator-right absolute top-0 left-0 h-full pointer-events-none"
          style={{
            width: props.isFirstTab ? "2px" : "1px",
            background: tokens.colors.semantic.primary,
            "z-index": "11",
          }}
        />
      </Show>
    </div>
  );
}

// ============================================================================
// Main TabBar Component - VS Code Specifications
// ============================================================================

export interface TabBarProps {
  files?: OpenFile[];
  activeFileId?: string | null;
  onFileSelect?: (fileId: string) => void;
  onFileClose?: (fileId: string) => void;
  onNewFile?: () => void;
  groupId?: string;
  showCloseGroupButton?: boolean;
  onCloseGroup?: () => void;
  showNewTabButton?: boolean;
  // VS Code: Tab configuration options
  isGroupFocused?: boolean;
  sizingMode?: TabSizingMode;
  showDirtyBorderTop?: boolean;
  showBorderBottom?: boolean;
  pinnedTabs?: string[]; // IDs of pinned tabs
  stickyMode?: TabStickyMode;
  // Tab sizing settings
  fixedWidth?: number; // Width for fixed sizing mode (default: 120)
  minWidth?: number; // Min width for shrink mode (default: 80)
  // Tab close button settings
  showCloseButton?: TabCloseButtonVisibility;
  closeButtonPosition?: TabCloseButtonPosition;
  // Deleted files (from Git status)
  deletedFiles?: string[]; // IDs of deleted files
}

export function TabBar(props: TabBarProps) {
  const editor = useEditor();
  const settings = useSettings();
  const diagnostics = useDiagnostics();
  
  // Get workbench editor settings
  const workbenchSettings = createMemo(() => {
    const effective = settings.effectiveSettings();
    return {
      tabSizing: (effective as any)?.workbench?.editor?.tabSizing ?? props.sizingMode ?? "fit",
      tabSizingFixedMinWidth: (effective as any)?.workbench?.editor?.tabSizingFixedMinWidth ?? props.minWidth ?? 80,
      tabSizingFixedWidth: (effective as any)?.workbench?.editor?.tabSizingFixedWidth ?? props.fixedWidth ?? 120,
      wrapTabs: effective?.theme?.wrapTabs ?? false,
      showTabCloseButton: (effective as any)?.workbench?.editor?.showTabCloseButton ?? props.showCloseButton ?? "onHover",
      tabCloseButtonPosition: (effective as any)?.workbench?.editor?.tabCloseButtonPosition ?? props.closeButtonPosition ?? "right",
    } as WorkbenchEditorSettings;
  });
  
  // Get wrapTabs setting from theme settings
  const wrapTabs = () => workbenchSettings().wrapTabs;
  
  // Get tab sizing mode from settings or props
  const effectiveSizingMode = () => props.sizingMode ?? workbenchSettings().tabSizing as TabSizingMode;
  const effectiveFixedWidth = () => props.fixedWidth ?? workbenchSettings().tabSizingFixedWidth;
  const effectiveMinWidth = () => props.minWidth ?? workbenchSettings().tabSizingFixedMinWidth;
  const effectiveShowCloseButton = () => props.showCloseButton ?? workbenchSettings().showTabCloseButton as TabCloseButtonVisibility;
  const effectiveCloseButtonPosition = () => props.closeButtonPosition ?? workbenchSettings().tabCloseButtonPosition as TabCloseButtonPosition;
  
  // Use props or fall back to editor context
  const files = () => props.files ?? editor.state?.openFiles ?? [];
  const activeFileId = () => props.activeFileId ?? editor.state?.activeFileId ?? null;
  const deletedFiles = () => new Set(props.deletedFiles ?? []);
  
  const touchTab = (fileId: string) => {
    setTabAccessOrder(prev => {
      const filtered = prev.filter(id => id !== fileId);
      return [...filtered, fileId];
    });
  };
  
  const onFileSelect = (fileId: string) => {
    touchTab(fileId);
    if (props.onFileSelect) {
      props.onFileSelect(fileId);
    } else {
      editor.setActiveFile(fileId);
    }
  };
  const onFileClose = (fileId: string) => {
    if (props.onFileClose) {
      props.onFileClose(fileId);
    } else {
      editor.closeFile(fileId);
    }
  };
  
  // Get decoration for a file
  const getFileDecoration = (file: OpenFile): TabDecoration => {
    // Convert file path to URI format for diagnostics lookup
    const uri = file.path.startsWith("file://") 
      ? file.path 
      : `file://${file.path.replace(/\\/g, "/")}`;
    
    const decoration: TabDecoration = {};
    
    // Get diagnostic counts for this file
    const counts = diagnostics.getCountsForFile(uri);
    
    // Error decorations (highest priority)
    if (counts.error > 0) {
      decoration.badge = String(counts.error);
      decoration.badgeColor = "var(--semantic-error, var(--cortex-error))";
      decoration.color = "var(--semantic-error-foreground, var(--cortex-error))";
    }
    // Warning decorations
    else if (counts.warning > 0) {
      decoration.badge = String(counts.warning);
      decoration.badgeColor = "var(--semantic-warning, var(--cortex-warning))";
      decoration.color = "var(--semantic-warning-foreground, var(--cortex-warning))";
    }
    
    // Strikethrough for deleted files (Git)
    if (deletedFiles().has(file.id)) {
      decoration.strikethrough = true;
      decoration.color = decoration.color ?? "var(--text-muted)";
    }
    
    // Italic for preview tabs
    if (editor.isPreviewTab(file.id)) {
      decoration.italic = true;
    }
    
    return decoration;
  };
  
  // Local state
  let tabsContainerRef: HTMLDivElement | undefined;
  const [canScrollLeft, setCanScrollLeft] = createSignal(false);
  const [canScrollRight, setCanScrollRight] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; file: OpenFile } | null>(null);
  const [showOverflow, setShowOverflow] = createSignal(false);
  const [tabAccessOrder, setTabAccessOrder] = createSignal<string[]>([]);
  // VS Code: Enhanced drag state with position tracking
  const [dragState, setDragState] = createSignal<{ 
    overId: string | null; 
    position: "left" | "right" | null;
}>({ overId: null, position: null });

  
// VS Code: Configuration defaults
  const isGroupFocused = () => props.isGroupFocused ?? true;
  const showDirtyBorderTop = () => props.showDirtyBorderTop ?? false;
  const showBorderBottom = () => props.showBorderBottom ?? true;
  // Use editor context for pinned tabs, falling back to props
  const pinnedTabs = () => props.pinnedTabs ?? editor.state?.pinnedTabs ?? [];
  const stickyMode = () => props.stickyMode ?? "compact"; // Default to compact for pinned tabs
  
  const showNewTab = () => props.showNewTabButton !== false;
  
  // Track if tabs should be hidden in Zen Mode
  const [zenModeHideTabs, setZenModeHideTabs] = createSignal(false);
  
  // Check if TabBar should be hidden (Zen Mode with hideTabs enabled)
  const isHiddenInZenMode = () => zenModeActive() && zenModeHideTabs();
  
  // Listen for Zen Mode events to update visibility
  createEffect(() => {
    const handleZenModeEnter = (e: CustomEvent<{ settings?: { hideTabs?: boolean } }>) => {
      if (e.detail?.settings?.hideTabs) {
        setZenModeHideTabs(true);
      }
    };
    
    const handleZenModeExit = () => {
      setZenModeHideTabs(false);
    };
    
    const handleZenModeHideTabs = () => {
      setZenModeHideTabs(true);
    };
    
    window.addEventListener("zenmode:enter", handleZenModeEnter as EventListener);
    window.addEventListener("zenmode:exit", handleZenModeExit);
    window.addEventListener("zenmode:hide-tabs", handleZenModeHideTabs);
    
    onCleanup(() => {
      window.removeEventListener("zenmode:enter", handleZenModeEnter as EventListener);
      window.removeEventListener("zenmode:exit", handleZenModeExit);
      window.removeEventListener("zenmode:hide-tabs", handleZenModeHideTabs);
    });
  });
  
  // Sort files with pinned tabs first
  const sortedFiles = createMemo(() => {
    const allFiles = files();
    const pinnedSet = new Set(pinnedTabs());
    
    const pinned = allFiles.filter((f) => pinnedSet.has(f.id));
    const unpinned = allFiles.filter((f) => !pinnedSet.has(f.id));
    
    return [...pinned, ...unpinned];
  });
  
  // Check scroll state
  const updateScrollState = () => {
    if (!tabsContainerRef) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  };
  
  // Set up scroll state monitoring and keyboard shortcut event listeners
  onMount(() => {
    updateScrollState();
    
    const resizeObserver = new ResizeObserver(() => {
      updateScrollState();
    });
    
    if (tabsContainerRef) {
      resizeObserver.observe(tabsContainerRef);
    }
    
    // Handle pin/unpin tab events from keyboard shortcuts
    const handlePinTabEvent = () => {
      const currentActiveFileId = activeFileId();
      if (currentActiveFileId) {
        editor.pinTab(currentActiveFileId);
      }
    };
    
    const handleUnpinTabEvent = () => {
      const currentActiveFileId = activeFileId();
      if (currentActiveFileId) {
        editor.unpinTab(currentActiveFileId);
      }
    };
    
    const handleTogglePinTabEvent = () => {
      const currentActiveFileId = activeFileId();
      if (currentActiveFileId) {
        editor.togglePinTab(currentActiveFileId);
      }
    };
    
    window.addEventListener("editor:pin-tab", handlePinTabEvent);
    window.addEventListener("editor:unpin-tab", handleUnpinTabEvent);
    window.addEventListener("editor:toggle-pin-tab", handleTogglePinTabEvent);
    
    onCleanup(() => {
      resizeObserver.disconnect();
      window.removeEventListener("editor:pin-tab", handlePinTabEvent);
      window.removeEventListener("editor:unpin-tab", handleUnpinTabEvent);
      window.removeEventListener("editor:toggle-pin-tab", handleTogglePinTabEvent);
    });
  });
  
  // Update scroll state when files change
  createEffect(() => {
    files();
    setTimeout(updateScrollState, 50);
  });
  
  // Tab limit with LRU eviction
  createEffect(() => {
    const maxTabs = (settings.effectiveSettings() as any)?.workbench?.editor?.tabLimit ?? 0;
    if (maxTabs <= 0) return;
    const currentFiles = files();
    const pinned = new Set(pinnedTabs());
    const unpinnedFiles = currentFiles.filter(f => !pinned.has(f.id));
    if (unpinnedFiles.length <= maxTabs) return;
    const accessOrder = tabAccessOrder();
    const sorted = [...unpinnedFiles].sort((a, b) => {
      const aIdx = accessOrder.indexOf(a.id);
      const bIdx = accessOrder.indexOf(b.id);
      return (aIdx === -1 ? -1 : aIdx) - (bIdx === -1 ? -1 : bIdx);
    });
    const toClose = sorted.slice(0, unpinnedFiles.length - maxTabs);
    for (const f of toClose) {
      if (f.id !== activeFileId()) onFileClose(f.id);
    }
  });
  
  // Scroll handlers
  const scrollLeft = () => {
    if (!tabsContainerRef) return;
    tabsContainerRef.scrollBy({ left: -150, behavior: "smooth" });
  };
  
  const scrollRight = () => {
    if (!tabsContainerRef) return;
    tabsContainerRef.scrollBy({ left: 150, behavior: "smooth" });
  };
  
  // Context menu handlers
  const handleContextMenu = (e: MouseEvent, file: OpenFile) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };
  
  const closeContextMenu = () => setContextMenu(null);
  
  const handleCloseTab = (fileId: string) => {
    onFileClose(fileId);
  };
  
  const handleCloseOthers = (keepFileId: string) => {
    files().forEach((f) => {
      if (f.id !== keepFileId) {
        onFileClose(f.id);
      }
    });
  };
  
  const handleCloseToLeft = (keepFileId: string) => {
    const currentIndex = files().findIndex(f => f.id === keepFileId);
    if (currentIndex > 0) {
      files().slice(0, currentIndex).forEach(f => {
        if (!pinnedTabs().includes(f.id)) {
          onFileClose(f.id);
        }
      });
    }
  };
  
  const handleCloseAll = () => {
    // Close only unpinned tabs
    editor.closeAllFiles(false);
  };
  
  // Available for future use: Close all tabs including pinned
  // @ts-expect-error Reserved for future use
  const _handleCloseAllIncludingPinned = () => {
    editor.closeAllFiles(true);
  };
  
  const handlePinTab = (fileId: string) => {
    editor.pinTab(fileId);
  };
  
  const handleUnpinTab = (fileId: string) => {
    editor.unpinTab(fileId);
  };
  
  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch (e) {
      console.error("Failed to copy path:", e);
    }
  };
  
  const handleCopyRelativePath = async (path: string) => {
    // Extract relative path (simple approach - remove common prefixes)
    const relativePath = path.replace(/^.*?[/\\](?:src|lib|app)[/\\]/, "");
    try {
      await navigator.clipboard.writeText(relativePath);
    } catch (e) {
      console.error("Failed to copy path:", e);
    }
  };
  
  const handleRevealInExplorer = async (path: string) => {
    // Dispatch event for file explorer to handle
    window.dispatchEvent(new CustomEvent("explorer:reveal", { detail: { path } }));
  };
  
  // Double-click on empty area to create new file
  const handleEmptyAreaDoubleClick = () => {
    if (props.onNewFile) {
      props.onNewFile();
    } else {
      // Dispatch event for new file creation
      window.dispatchEvent(new CustomEvent("editor:create-new-file"));
    }
  };
  
  // VS Code: Drag and drop handlers with position detection
  const handleDragStart = (e: DragEvent, fileId: string) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("text/plain", fileId);
      e.dataTransfer.effectAllowed = "move";
    }
  };
  
  const handleDragOver = (e: DragEvent, fileId: string, tabElement: HTMLElement) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    
    // VS Code: Determine drop position based on mouse position relative to tab center
    const rect = tabElement.getBoundingClientRect();
    const mouseX = e.clientX;
    const tabCenterX = rect.left + rect.width / 2;
    const position: "left" | "right" = mouseX < tabCenterX ? "right" : "left";
    
    setDragState({ overId: fileId, position });
  };
  
  const handleDragLeave = () => {
    setDragState({ overId: null, position: null });
  };
  
  const handleDrop = (e: DragEvent, targetFileId: string) => {
    e.preventDefault();
    setDragState({ overId: null, position: null });
    
    const sourceFileId = e.dataTransfer?.getData("text/plain");
    if (!sourceFileId || sourceFileId === targetFileId) return;
    
    // Call reorderTabs from the editor context
    editor.reorderTabs(sourceFileId, targetFileId, props.groupId);
  };
  
  const handleDragEnd = () => {
    setDragState({ overId: null, position: null });
  };
  
  // VS Code: Check if tab is pinned (for sticky behavior)
  const isTabPinned = (fileId: string) => pinnedTabs().includes(fileId);
  
  // VS Code: Check if tab is preview tab (italic title)
  const isPreviewTab = (fileId: string) => editor.isPreviewTab(fileId);
  
  // Promote preview tab to permanent (double-click or edit)
  const promoteToPermament = (fileId: string) => editor.promotePreviewToPermanent(fileId);
  
// VS Code: Get sticky mode for a specific tab
  const getTabStickyMode = (fileId: string): TabStickyMode => {
    if (!isTabPinned(fileId)) return "normal";
    return stickyMode();
  };

  // Hide when in Zen Mode with hideTabs setting enabled
  if (isHiddenInZenMode()) {
    return null;
  }

  return (
    <div 
      class={`tabs-and-actions-container relative flex items-stretch shrink-0 ${wrapTabs() ? "wrapping" : ""}`}
      style={{ 
        // Figma design: 47px tab bar height
        height: wrapTabs() ? "auto" : "36px",
        "min-height": "36px",
        // Figma: Dark background for tab bar, active tab merges with editor
        background: "var(--cortex-bg-primary, var(--cortex-bg-secondary))",
        border: "none",
        // Minimal padding
        padding: "0",
      }}
    >
      {/* Scroll left button - hidden when tab wrapping is enabled */}
      <Show when={canScrollLeft() && !wrapTabs()}>
        <button
          onClick={scrollLeft}
          class="w-6 flex items-center justify-center transition-colors z-10 rounded"
          style={{ 
            height: "100%", color: tokens.colors.text.muted,
            border: "none",
            "margin-right": "2px",
          }}
        >
          <Icon name="chevron-left" size={14} />
        </button>
      </Show>
      
      {/* Tabs container with scrollbar hiding */}
      <div
        ref={tabsContainerRef}
        class={`tabs-container flex-1 flex items-stretch no-scrollbar ${wrapTabs() ? "wrapping" : "overflow-x-auto"}`}
        style={{
          // JetBrains compact: 28px height
          height: wrapTabs() ? "auto" : "36px",
          "scrollbar-width": "none", // Firefox
          ...(wrapTabs() ? { "flex-wrap": "wrap" } : {}),
        }}
        onScroll={updateScrollState}
      >
        <For each={sortedFiles()}>
          {(file, index) => {
            let tabRef: HTMLDivElement | undefined;
            const state = dragState();
            const isFirst = index() === 0;
            const isLast = index() === sortedFiles().length - 1;
            const isPinned = isTabPinned(file.id);
            
            // Check if this tab is adjacent to the active tab
            const files = sortedFiles();
            const currentActiveId = activeFileId();
            const activeIdx = files.findIndex(f => f.id === currentActiveId);
            const currentIdx = index();
            const isBeforeActive = currentIdx === activeIdx - 1 && activeIdx > 0;
            const isAfterActive = currentIdx === activeIdx + 1 && activeIdx < files.length - 1;
            
            return (
              <div
                ref={tabRef}
                style={{ display: "contents" }}
                onDragOver={(e) => tabRef && handleDragOver(e, file.id, tabRef)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, file.id)}
              >
<Tab
                  file={file}
                  isActive={activeFileId() === file.id}
                  isGroupFocused={isGroupFocused()}
                  isSticky={isPinned}
                  isPinned={isPinned}
                  isPreview={isPreviewTab(file.id)}
                  isDeleted={deletedFiles().has(file.id)}
                  stickyMode={getTabStickyMode(file.id)}
                  sizingMode={effectiveSizingMode()}
                  fixedWidth={effectiveFixedWidth()}
                  minWidth={effectiveMinWidth()}
                  showDirtyBorderTop={showDirtyBorderTop()}
                  showBorderBottom={showBorderBottom()}
                  showCloseButtonMode={effectiveShowCloseButton()}
                  closeButtonPosition={effectiveCloseButtonPosition()}
                  decoration={getFileDecoration(file)}
                  onSelect={() => onFileSelect(file.id)}
                  onClose={(e) => {
                    e.stopPropagation();
                    handleCloseTab(file.id);
                  }}
                  onMiddleClick={() => handleCloseTab(file.id)}
                  onDoubleClick={() => promoteToPermament(file.id)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  onDragStart={(e) => handleDragStart(e, file.id)}
                  onDragEnd={handleDragEnd}
                  isDraggedOver={state.overId === file.id}
                  dropPosition={state.overId === file.id ? state.position : null}
                  isFirstTab={isFirst}
                  isLastTab={isLast}
                  isBeforeActive={isBeforeActive}
                  isAfterActive={isAfterActive}
/>
                {/* Separator between pinned and unpinned tabs */}
                <Show when={isPinned && index() === pinnedTabs().length - 1 && pinnedTabs().length < sortedFiles().length}>
                  <div style={{
                    width: "1px",
                    height: "60%",
                    "align-self": "center",
                    background: "rgba(255, 255, 255, 0.15)",
                    "flex-shrink": "0",
                    margin: "0 2px",
                  }} />
                </Show>
              </div>
            );
          }}
        </For>
        
        {/* Empty area - fills remaining space, NO border */}
        <div 
          class="flex-1 min-w-[40px] h-full"
          style={{ border: "none" }}
          onDblClick={handleEmptyAreaDoubleClick}
        />
      </div>
      
      {/* Scroll right button - hidden when tab wrapping is enabled */}
      <Show when={canScrollRight() && !wrapTabs()}>
        <button
          onClick={scrollRight}
          class="w-6 flex items-center justify-center transition-colors z-10 rounded"
          style={{ 
            height: "100%", color: tokens.colors.text.muted,
            border: "none",
            "margin-left": "2px",
          }}
        >
          <Icon name="chevron-right" size={14} />
        </button>
      </Show>
      
      {/* New tab button */}
      <Show when={showNewTab()}>
        <button
          onClick={() => {
            if (props.onNewFile) {
              props.onNewFile();
            } else {
              window.dispatchEvent(new CustomEvent("editor:create-new-file", {
                detail: { groupId: props.groupId }
              }));
            }
          }}
          class="w-7 flex items-center justify-center transition-colors rounded"
          style={{ 
            height: "100%", color: tokens.colors.text.muted,
            border: "none",
            "margin-left": tokens.spacing.sm,
          }}
          title="New File (Ctrl+N)"
        >
          <Icon name="plus" size={16} />
        </button>
      </Show>
      
      {/* Overflow dropdown button */}
      <Show when={files().length > 5}>
        <div class="relative">
          <button
            onClick={() => setShowOverflow(!showOverflow())}
            class="w-7 flex items-center justify-center transition-colors rounded"
            style={{ 
              height: "100%", color: tokens.colors.text.muted,
              border: "none",
            }}
            title="Show all tabs"
          >
            <Icon name="ellipsis" size={16} />
          </button>
          
          <Show when={showOverflow()}>
            <TabOverflowDropdown
              files={files()}
              activeFileId={activeFileId()}
              onSelect={(fileId) => onFileSelect(fileId)}
              onClose={() => setShowOverflow(false)}
            />
          </Show>
        </div>
      </Show>
      
      {/* Close group button (for splits) */}
      <Show when={props.showCloseGroupButton && props.onCloseGroup}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onCloseGroup?.();
          }}
          class="w-7 flex items-center justify-center transition-colors rounded"
          style={{ 
            height: "100%", color: tokens.colors.text.muted,
            border: "none",
          }}
          title="Close split"
        >
          <Icon name="xmark" size={16} />
        </button>
      </Show>
      
      {/* JetBrains-style Context Menu */}
      <ContextMenu
        state={{
          visible: contextMenu() !== null,
          x: contextMenu()?.x ?? 0,
          y: contextMenu()?.y ?? 0,
          sections: contextMenu() ? ContextMenuPresets.tabItems({
            isPinned: isTabPinned(contextMenu()!.file.id),
            onClose: () => {
              handleCloseTab(contextMenu()!.file.id);
              closeContextMenu();
            },
            onCloseOthers: () => {
              handleCloseOthers(contextMenu()!.file.id);
              closeContextMenu();
            },
            onCloseAll: () => {
              handleCloseAll();
              closeContextMenu();
            },
            onCloseToRight: () => {
              const currentFile = contextMenu()!.file;
              const currentIndex = files().findIndex(f => f.id === currentFile.id);
              if (currentIndex !== -1) {
                files().slice(currentIndex + 1).forEach(f => onFileClose(f.id));
              }
              closeContextMenu();
            },
            onCloseToLeft: () => {
              handleCloseToLeft(contextMenu()!.file.id);
              closeContextMenu();
            },
            onPin: () => {
              const fileId = contextMenu()!.file.id;
              if (isTabPinned(fileId)) {
                handleUnpinTab(fileId);
              } else {
                handlePinTab(fileId);
              }
              closeContextMenu();
            },
            onCopyPath: () => {
              handleCopyPath(contextMenu()!.file.path);
              closeContextMenu();
            },
            onCopyRelativePath: () => {
              handleCopyRelativePath(contextMenu()!.file.path);
              closeContextMenu();
            },
            onReveal: () => {
              handleRevealInExplorer(contextMenu()!.file.path);
              closeContextMenu();
            },
          }) : [],
        }}
        onClose={closeContextMenu}
      />
    </div>
  );
}

export default TabBar;
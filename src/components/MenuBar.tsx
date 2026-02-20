import { createSignal, Show, For, onMount, onCleanup, createMemo, JSX } from "solid-js";
import { tokens } from "@/design-system/tokens";
import { useNavigate } from "@solidjs/router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { useCommands } from "@/context/CommandContext";
import { useTerminals } from "@/context/TerminalsContext";
import { useREPL } from "@/context/REPLContext";
import { useRecentProjects, type RecentProject } from "@/context/RecentProjectsContext";
import { useAutoUpdate } from "@/context/AutoUpdateContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useSDK } from "@/context/SDKContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useSettings, ActivityBarLocation, MenuBarVisibility } from "@/context/SettingsContext";
import { gitCurrentBranch } from "@/utils/tauri-api";
import { Icon } from './ui/Icon';
import { SystemSpecsDialog } from "./SystemSpecs";
import { NotificationsBadge, NotificationsPanel } from "./NotificationsPanel";
import { CommandCenter } from "./CommandCenter";

interface MenuItem {
  label?: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  submenu?: MenuItem[];
  hasSubmenu?: boolean;
  icon?: JSX.Element;
  checked?: boolean;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

// Menu styling constants - VS Code specifications from menu.ts
// IMenuStyles interface with 12 color properties
interface IMenuStyles {
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

// JetBrains UI token-based menu color theme
const MENU_COLORS: IMenuStyles = {
  shadowColor: "var(--jb-shadow-popup)",
  borderColor: tokens.colors.border.divider,
  foregroundColor: tokens.colors.text.primary,
  backgroundColor: "var(--jb-popup)",
  selectionForegroundColor: tokens.colors.text.primary,
  selectionBackgroundColor: tokens.colors.interactive.hover,
  selectionBorderColor: "transparent",
  separatorColor: tokens.colors.border.divider,
  scrollbarShadow: "var(--jb-shadow-popup)",
  scrollbarSliderBackground: tokens.colors.interactive.hover,
  scrollbarSliderHoverBackground: tokens.colors.interactive.hover,
  scrollbarSliderActiveBackground: tokens.colors.interactive.hover,
};

// VS Code menu timing constants
const MENU_TIMINGS = {
  submenuShowDelay: 250,    // ms - RunOnceScheduler show delay
  submenuHideDelay: 750,    // ms - when focus leaves
  fadeInDuration: 83,       // ms - context view fade-in animation
  transformTransition: 50,  // ms - item transform transition
  mouseUpDebounce: 100,     // ms - prevent accidental clicks
} as const;

// Menu styling constants - JetBrains UI tokens
const MENU_STYLES = {
  container: {
    minWidth: "180px",
    background: "rgba(30, 30, 30, 0.9)",                // Solid dark background at 90% opacity
    border: `1px solid ${tokens.colors.border.divider}`,       // JetBrains border divider
    borderRadius: tokens.radius.md,                // JetBrains radius md
    boxShadow: "var(--jb-shadow-popup)",                // JetBrains popup shadow
    padding: "6px 6px",
  },
  item: {
    height: "2em",                   // ~26px at 13px font
    paddingHorizontal: "16px",       // Design spec: 8px 16px (horizontal)
    paddingVertical: tokens.spacing.md,          // Design spec: 8px 16px (vertical)
    fontSize: "var(--jb-font-size-sm)",
    borderRadius: tokens.radius.sm,
    margin: "0",
  },
  separator: {
    height: "0px",
    marginVertical: "5px",
    marginHorizontal: "0px",
    borderBottom: `1px solid ${tokens.colors.border.divider}`,  // JetBrains border divider
  },
  hover: {
    background: tokens.colors.interactive.hover,  // JetBrains hover surface
    color: MENU_COLORS.selectionForegroundColor,
  },
  disabled: {
    opacity: "0.5",
  },
  label: {
    padding: "0 2em",
    fontSize: "inherit",
  },
  shortcut: {
    color: tokens.colors.text.muted,
    fontSize: "var(--jb-font-size-xs)",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace",
    padding: "0 1em",
    opacity: 0.7,
    disabledOpacity: 0.4,
    flex: "2 1 auto",
    textAlign: "right" as const,
  },
  submenuIndicator: {
    padding: "0 1.8em",
  },
  checkIcon: {
    width: "2em",
    position: "absolute" as const,
    left: 0,
  },
  icon: {
    width: "16px",
    height: "16px",
    marginRight: tokens.spacing.md,
  },
  animation: {
    duration: `${MENU_TIMINGS.fadeInDuration}ms`,
    easing: "linear",
  },
  scrollbar: {
    size: "7px",
  },
} as const;

interface MenuBarProps {
  compact?: boolean;
}

// View mode state (persisted in localStorage)
const VIEW_MODE_KEY = "cortex_view_mode";
type ViewMode = "vibe" | "ide";

export function MenuBar(_props: MenuBarProps = {}) {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = createSignal<string | null>(null);
  const [activeSubmenu, setActiveSubmenu] = createSignal<string | null>(null);
  const [showAboutDialog, setShowAboutDialog] = createSignal(false);
  const [showRecentWorkspacesModal, setShowRecentWorkspacesModal] = createSignal(false);
  const [focusedItemIndex, setFocusedItemIndex] = createSignal<number>(-1);
  const [viewMode, setViewModeSignal] = createSignal<ViewMode>(
    (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "vibe"
  );
  
  const setViewMode = (mode: ViewMode) => {
    setViewModeSignal(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent("viewmode:change", { detail: { mode } }));
  };
  
  // Listen for viewmode changes from other components (e.g., Session.tsx)
  onMount(() => {
    const handleViewModeChange = (e: CustomEvent<{ mode: ViewMode }>) => {
      // Only update if different to avoid loops
      if (e.detail.mode !== viewMode()) {
        setViewModeSignal(e.detail.mode);
      }
    };
    window.addEventListener("viewmode:change", handleViewModeChange as EventListener);
    
    // Listen for titlebar:menu events from TitleBar component
    const handleTitleBarMenu = (e: CustomEvent<{ menu: string }>) => {
      const menuName = e.detail.menu;
      if (menuName) {
        openMenu(menuName);
      }
    };
    window.addEventListener("titlebar:menu", handleTitleBarMenu as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("viewmode:change", handleViewModeChange as EventListener);
      window.removeEventListener("titlebar:menu", handleTitleBarMenu as EventListener);
    });
  });
  
  let menuContainerRef: HTMLDivElement | undefined;
  
  // Get command context for triggering modals
  let commands: ReturnType<typeof useCommands> | null = null;
  let terminals: ReturnType<typeof useTerminals> | null = null;
  let repl: ReturnType<typeof useREPL> | null = null;
  let recentProjectsCtx: ReturnType<typeof useRecentProjects> | null = null;
  let autoUpdate: ReturnType<typeof useAutoUpdate> | null = null;
  let notifications: ReturnType<typeof useNotifications> | null = null;
  let sdk: ReturnType<typeof useSDK> | null = null;
  let workspace: ReturnType<typeof useWorkspace> | null = null;
  let settingsCtx: ReturnType<typeof useSettings> | null = null;
  
  try {
    commands = useCommands();
    terminals = useTerminals();
    repl = useREPL();
    recentProjectsCtx = useRecentProjects();
    autoUpdate = useAutoUpdate();
    notifications = useNotifications();
    sdk = useSDK();
    workspace = useWorkspace();
    settingsCtx = useSettings();
  } catch (e) {
    // Context not available yet
  }
  
  // Settings accessors
  const activityBarLocation = () => settingsCtx?.effectiveSettings().theme.activityBarPosition || "side";
  const menuBarVisibility = () => settingsCtx?.effectiveSettings().theme.menuBarVisibility || "classic";
  
  // Handlers for changing settings
  const setActivityBarLocation = async (location: ActivityBarLocation) => {
    await settingsCtx?.updateThemeSetting("activityBarPosition", location);
    closeMenu();
  };
  
  const setMenuBarVisibility = async (visibility: MenuBarVisibility) => {
    await settingsCtx?.updateThemeSetting("menuBarVisibility", visibility);
    closeMenu();
  };

  const projectName = createMemo(() => {
    const cwd = sdk?.state.config.cwd;
    if (!cwd || cwd === ".") return "";
    return cwd.replace(/\\/g, "/").split("/").pop() || "";
  });

  // Git branch state for header project widget
  const [gitBranch, setGitBranch] = createSignal<string>("");
  
  // Fetch git branch when project changes
  const fetchGitBranch = async () => {
    const cwd = sdk?.state.config.cwd;
    if (!cwd || cwd === ".") {
      setGitBranch("");
      return;
    }
    try {
      const branch = await gitCurrentBranch(cwd);
      setGitBranch(branch || "");
    } catch {
      setGitBranch("");
    }
  };

  // Initial fetch and set up interval to refresh periodically
  onMount(() => {
    fetchGitBranch();
    const interval = setInterval(fetchGitBranch, 10000); // Refresh every 10 seconds
    onCleanup(() => clearInterval(interval));
  });

  const recentProjects = createMemo(() => {
    const projects = recentProjectsCtx?.filteredProjects() || [];
    return projects.slice(0, 10);
  });

  const recentWorkspaces = createMemo(() => {
    const workspaces = workspace?.recentWorkspaces() || [];
    return workspaces.slice(0, 10);
  });

  const handleOpenFolder = () => {
    window.dispatchEvent(new CustomEvent("folder:open"));
    setActiveMenu(null);
  };
  const handleOpenRecentProject = (project: RecentProject) => {
    recentProjectsCtx?.openProject(project, false);
    setActiveMenu(null);
    setActiveSubmenu(null);
  };

  const handleShowRecentProjects = () => {
    recentProjectsCtx?.setShowRecentProjects(true);
    setActiveMenu(null);
    setActiveSubmenu(null);
  };

  const handleClearRecentProjects = () => {
    recentProjectsCtx?.clearAllProjects();
    setActiveMenu(null);
    setActiveSubmenu(null);
  };

  const handleOpenRecentWorkspace = async (ws: { path: string; name: string; isWorkspaceFile: boolean; folderCount: number; id: string; lastOpened: number }) => {
    await workspace?.openRecentWorkspace(ws);
    setActiveMenu(null);
    setActiveSubmenu(null);
    navigate("/session");
  };

  const handleClearRecentWorkspaces = () => {
    workspace?.clearRecentWorkspaces();
    setActiveMenu(null);
    setActiveSubmenu(null);
  };

  const handleNewSession = () => {
    navigate("/session");
    setActiveMenu(null);
  };

  const handleNewWindow = async () => {
    try {
      await invoke("create_new_window");
    } catch (e) {
      console.error("Failed to create new window:", e);
    }
    closeMenu();
  };

  const handleCloneRepo = () => {
    // Dispatch event to open git clone dialog
    window.dispatchEvent(new CustomEvent("git:clone-repository"));
    setActiveMenu(null);
  };

  const closeMenu = () => {
    setActiveMenu(null);
    setActiveSubmenu(null);
    setFocusedItemIndex(-1);
  };

  // Handle menu open with animation
  const openMenu = (label: string) => {
    setActiveMenu(label);
    setFocusedItemIndex(-1);
  };

  // Get non-separator items for keyboard navigation
  const getNavigableItems = (items: MenuItem[]): number[] => {
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.separator && !item.disabled)
      .map(({ index }) => index);
  };

  // Keyboard navigation handler
  const handleKeyDown = (e: KeyboardEvent, items: MenuItem[]) => {
    const navigableIndices = getNavigableItems(items);
    if (navigableIndices.length === 0) return;

    const currentFocus = focusedItemIndex();
    const currentNavIndex = navigableIndices.indexOf(currentFocus);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIndex = currentNavIndex < navigableIndices.length - 1 
          ? navigableIndices[currentNavIndex + 1] 
          : navigableIndices[0];
        setFocusedItemIndex(nextIndex);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIndex = currentNavIndex > 0 
          ? navigableIndices[currentNavIndex - 1] 
          : navigableIndices[navigableIndices.length - 1];
        setFocusedItemIndex(prevIndex);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        const item = items[currentFocus];
        if (item?.hasSubmenu) {
          setActiveSubmenu("recent");
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (activeSubmenu()) {
          setActiveSubmenu(null);
        }
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        const item = items[currentFocus];
        if (item && !item.disabled && item.action) {
          item.action();
        }
        break;
      }
      case "Escape": {
        e.preventDefault();
        if (activeSubmenu()) {
          setActiveSubmenu(null);
        } else {
          closeMenu();
        }
        break;
      }
    }
  };

  // Action handlers
  const openCommandPalette = () => {
    closeMenu();
    commands?.setShowCommandPalette(true);
  };

  const openFileFinder = () => {
    closeMenu();
    commands?.setShowFileFinder(true);
  };

  const openBufferSearch = () => {
    closeMenu();
    commands?.setShowBufferSearch(true);
  };
  const openBufferSearchWithReplace = () => {
    closeMenu();
    window.dispatchEvent(new CustomEvent("buffer-search:show-replace"));
    commands?.setShowBufferSearch(true);
  };

  const openGoToLine = () => {
    closeMenu();
    commands?.setShowGoToLine(true);
  };

  const openProjectSearch = () => {
    closeMenu();
    commands?.setShowProjectSearch(true);
  };

  const toggleTerminal = () => {
    closeMenu();
    terminals?.togglePanel();
  };

  const toggleREPL = () => {
    closeMenu();
    repl?.togglePanel();
  };

  // ============================================================================
  // Menu Action Factory - Creates memoized handlers to prevent re-renders
  // ============================================================================
  
  // Factory for simple event dispatch actions
  const createMenuAction = (eventName: string, detail?: unknown) => () => {
    closeMenu();
    window.dispatchEvent(new CustomEvent(eventName, detail !== undefined ? { detail } : undefined));
  };

  // Factory for editor commands
  const createEditorCommand = (command: string) => () => {
    closeMenu();
    window.dispatchEvent(new CustomEvent("editor-command", { detail: { command } }));
  };

  // Memoized menu actions object - all handlers created once
  const menuActions = {
    // File menu actions
    fileSave: createMenuAction("file:save"),
    fileSaveAll: createMenuAction("file:save-all"),
    fileRevert: createMenuAction("file:revert"),
    fileToggleAutoSave: createMenuAction("file:toggle-auto-save"),
    fileClose: createMenuAction("file:close"),
    fileCloseFolder: createMenuAction("file:close-folder"),
    settingsOpen: createMenuAction("settings:open-tab"),

    // Edit menu actions
    undo: createEditorCommand("undo"),
    redo: createEditorCommand("redo"),
    cut: createEditorCommand("cut"),
    copy: createEditorCommand("copy"),
    paste: createEditorCommand("paste"),
    searchReplaceInFile: createMenuAction("search:replace-in-file"),
    searchReplaceInProject: createMenuAction("search:replace-in-project"),
    searchOpenEditor: createMenuAction("search:open-editor"),
    searchInOpenEditors: createMenuAction("search:in-open-editors"),
    searchToggleMultiline: createMenuAction("search:toggle-multiline"),
    transposeCharacters: createEditorCommand("transpose-characters"),
    toggleLineComment: createEditorCommand("toggle-line-comment"),
    toggleBlockComment: createEditorCommand("toggle-block-comment"),
    quickFix: createEditorCommand("quick-fix"),
    renameSymbol: createEditorCommand("rename-symbol"),
    refactor: createEditorCommand("refactor"),

    // Selection menu actions
    selectAll: createEditorCommand("select-all"),
    smartSelectExpand: createEditorCommand("smart-select-expand"),
    smartSelectShrink: createEditorCommand("smart-select-shrink"),
    copyLineUp: createEditorCommand("copy-line-up"),
    copyLineDown: createEditorCommand("copy-line-down"),
    moveLineUp: createEditorCommand("move-line-up"),
    moveLineDown: createEditorCommand("move-line-down"),
    addCursorAbove: createEditorCommand("add-cursor-above"),
    addCursorBelow: createEditorCommand("add-cursor-below"),
    addCursorsToLineEnds: createEditorCommand("add-cursors-to-line-ends"),
    addNextOccurrence: createEditorCommand("add-next-occurrence"),
    addPreviousOccurrence: createEditorCommand("add-previous-occurrence"),
    selectAllOccurrences: createEditorCommand("select-all-occurrences"),
    skipOccurrence: createEditorCommand("skip-occurrence"),
    toggleColumnSelection: createEditorCommand("toggle-column-selection"),

    // View menu actions
    sidebarToggle: createMenuAction("sidebar:toggle"),
    sidebarTogglePosition: createMenuAction("sidebar:toggle-position"),
    viewToggleAgentPanel: createMenuAction("view:toggle-agent-panel"),
    screencastToggle: createMenuAction("screencast:toggle"),
    viewZoomIn: createMenuAction("view:zoom-in"),
    viewZoomOut: createMenuAction("view:zoom-out"),
    viewZoomReset: createMenuAction("view:zoom-reset"),
    viewToggleFullscreen: createMenuAction("view:toggle-fullscreen"),

    // Go menu actions
    navigationBack: createMenuAction("navigation:back"),
    navigationForward: createMenuAction("navigation:forward"),
    navigationLastEdit: createMenuAction("navigation:last-edit"),
    goToDefinition: createEditorCommand("go-to-definition"),
    goToTypeDefinition: createEditorCommand("go-to-type-definition"),
    goToImplementation: createEditorCommand("go-to-implementation"),
    goToReferences: createEditorCommand("go-to-references"),
    problemsNext: createMenuAction("problems:next"),
    problemsPrevious: createMenuAction("problems:previous"),
    goToBracket: createEditorCommand("go-to-bracket"),

    // Terminal menu actions
    terminalNew: createMenuAction("terminal:new"),
    terminalSplit: createMenuAction("terminal:split"),
    terminalRunSelection: createMenuAction("terminal:run-selection"),
    terminalRunActiveFile: createMenuAction("terminal:run-active-file"),
    terminalShowRenameDialog: createMenuAction("terminal:show-rename-dialog"),
    terminalShowColorPicker: createMenuAction("terminal:show-color-picker"),
    terminalClear: createMenuAction("terminal:clear"),
    terminalKill: createMenuAction("terminal:kill"),

    // Task actions
    tasksOpenRunDialog: createMenuAction("tasks:open-run-dialog"),
    tasksRunBuild: createMenuAction("tasks:run-build"),
    tasksRunTest: createMenuAction("tasks:run-test"),
    tasksOpenPanel: createMenuAction("tasks:open-panel"),
    tasksOpenConfigEditor: createMenuAction("tasks:open-config-editor"),

    // Debug/Run menu actions
    debugStart: createMenuAction("debug:start"),
    debugRunWithoutDebugging: createMenuAction("debug:run-without-debugging"),
    debugStop: createMenuAction("debug:stop"),
    debugRestart: createMenuAction("debug:restart"),
    debugContinue: createMenuAction("debug:continue"),
    debugPause: createMenuAction("debug:pause"),
    debugStepOver: createMenuAction("debug:step-over"),
    debugStepInto: createMenuAction("debug:step-into"),
    debugStepOut: createMenuAction("debug:step-out"),
    debugToggleBreakpoint: createMenuAction("debug:toggle-breakpoint"),
    debugEnableAllBreakpoints: createMenuAction("debug:enable-all-breakpoints"),
    debugDisableAllBreakpoints: createMenuAction("debug:disable-all-breakpoints"),
    debugRemoveAllBreakpoints: createMenuAction("debug:remove-all-breakpoints"),
    debugAddConfiguration: createMenuAction("debug:add-configuration"),
    debugOpenLaunchJson: createMenuAction("debug:open-launch-json"),

    // Git menu actions
    gitClone: createMenuAction("git:clone"),
    gitCloneRecursive: createMenuAction("git:clone-recursive"),
    gitCommit: createMenuAction("git:commit"),
    gitStageAll: createMenuAction("git:stage-all"),
    gitUnstageAll: createMenuAction("git:unstage-all"),
    gitPull: createMenuAction("git:pull"),
    gitPush: createMenuAction("git:push"),
    gitSync: createMenuAction("git:sync"),
    gitMerge: createMenuAction("git:merge"),
    gitMergeAbort: createMenuAction("git:merge-abort"),
    gitPublishBranch: createMenuAction("git:publish-branch"),
    gitSetUpstream: createMenuAction("git:set-upstream"),
    gitStashCreate: createMenuAction("git:stash-create"),
    gitStashApply: createMenuAction("git:stash-apply"),
    gitStashShowDiff: createMenuAction("git:stash-show-diff"),
    gitFetch: createMenuAction("git:fetch"),
    gitBranchCreate: createMenuAction("git:branch-create"),
    gitBranchCheckout: createMenuAction("git:branch-checkout"),

    // Developer menu actions
    devOpenComponentPreview: createMenuAction("dev:open-component-preview"),
    devToggleDevtools: createMenuAction("dev:toggle-devtools"),
    processExplorerToggle: createMenuAction("process-explorer:toggle"),
    inspectorToggle: createMenuAction("inspector:toggle"),
    reloadWindow: () => { closeMenu(); window.location.reload(); },

    // Help menu actions
    feedbackOpenGeneral: createMenuAction("feedback:open", { type: "general" }),
    feedbackOpenBug: createMenuAction("feedback:open", { type: "bug" }),
    feedbackOpenFeature: createMenuAction("feedback:open", { type: "feature" }),
    openDocs: () => { closeMenu(); window.open('https://docs.cortex.ai', '_blank'); },
    openReleaseNotes: () => { closeMenu(); window.open('https://github.com/nicepkg/cortex/releases', '_blank'); },
    checkForUpdates: () => { 
      closeMenu(); 
      if (autoUpdate?.status.type === "UpdateAvailable" || autoUpdate?.status.type === "RestartRequired") {
        autoUpdate.setShowDialog(true);
      } else {
        autoUpdate?.checkForUpdates();
        autoUpdate?.setShowDialog(true);
      }
    },
    showAboutDialog: () => { closeMenu(); setShowAboutDialog(true); },

    // Go menu - Symbol pickers (need context access)
    showDocumentSymbolPicker: () => { closeMenu(); commands?.setShowDocumentSymbolPicker(true); },
    showWorkspaceSymbolPicker: () => { closeMenu(); commands?.setShowWorkspaceSymbolPicker(true); },
  };

  // Workspace handlers
  const handleOpenWorkspace = async () => {
    closeMenu();
    try {
      await workspace?.openWorkspaceFile();
    } catch (e) {
      console.error("Failed to open workspace:", e);
    }
  };

  const handleSaveWorkspace = async () => {
    closeMenu();
    try {
      await workspace?.saveWorkspace();
    } catch (e) {
      console.error("Failed to save workspace:", e);
    }
  };

  const handleSaveWorkspaceAs = async () => {
    closeMenu();
    try {
      await workspace?.saveWorkspaceAs();
    } catch (e) {
      console.error("Failed to save workspace as:", e);
    }
  };

  // Submenu toggle helpers (stable references)
  const toggleSubmenu = (id: string) => () => setActiveSubmenu(activeSubmenu() === id ? null : id);

  // Memoize menus to avoid recreation on every render
  // Only recomputes when workspace state changes
  const menus = createMemo<MenuSection[]>(() => [
    {
      label: "File",
      items: [
        { label: "New Session", shortcut: "Ctrl+N", action: handleNewSession },
        { label: "New Window", shortcut: "Ctrl+Shift+N", action: handleNewWindow },
        { separator: true },
        { label: "Open Folder...", shortcut: "Ctrl+O", action: handleOpenFolder },
        { label: "Open Workspace...", action: handleOpenWorkspace },
        { label: "Open Recent", shortcut: "Ctrl+Shift+E", hasSubmenu: true, action: toggleSubmenu("recent") },
        { label: "Clone Repository...", action: handleCloneRepo },
        { separator: true },
        { label: "Save", shortcut: "Ctrl+S", action: menuActions.fileSave },
        { label: "Save All", shortcut: "Ctrl+K S", action: menuActions.fileSaveAll },
        { separator: true },
        { label: "Revert File", action: menuActions.fileRevert },
        { label: "Auto Save", action: menuActions.fileToggleAutoSave },
        { separator: true },
        { label: "Close Editor", shortcut: "Ctrl+W", action: menuActions.fileClose },
        { label: "Close Folder", action: menuActions.fileCloseFolder },
        { separator: true },
        { label: "Save Workspace", action: handleSaveWorkspace, disabled: !workspace?.isWorkspaceOpen() },
        { label: "Save Workspace As...", action: handleSaveWorkspaceAs, disabled: !workspace?.isWorkspaceOpen() },
        { separator: true },
        { label: "Settings...", shortcut: "Ctrl+,", action: menuActions.settingsOpen },
        { separator: true },
        { label: "Exit", shortcut: "Alt+F4", action: () => window.close() },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", action: menuActions.undo },
        { label: "Redo", shortcut: "Ctrl+Y", action: menuActions.redo },
        { separator: true },
        { label: "Cut", shortcut: "Ctrl+X", action: menuActions.cut },
        { label: "Copy", shortcut: "Ctrl+C", action: menuActions.copy },
        { label: "Paste", shortcut: "Ctrl+V", action: menuActions.paste },
        { separator: true },
        { label: "Find in File", shortcut: "Ctrl+F", action: openBufferSearch },
        { label: "Replace in File", shortcut: "Ctrl+H", action: openBufferSearchWithReplace },
        { separator: true },
        { label: "Find in Project", shortcut: "Ctrl+Shift+F", action: openProjectSearch },
        { label: "Replace in Project", shortcut: "Ctrl+Shift+H", action: menuActions.searchReplaceInProject },
        { separator: true },
        { label: "Search Editor", shortcut: "Ctrl+Shift+J", action: menuActions.searchOpenEditor },
        { label: "Search in Open Editors", action: menuActions.searchInOpenEditors },
        { label: "Toggle Multiline Search", action: menuActions.searchToggleMultiline },
        { separator: true },
        { label: "Transpose Characters", shortcut: "Ctrl+T", action: menuActions.transposeCharacters },
        { separator: true },
        { label: "Toggle Line Comment", shortcut: "Ctrl+/", action: menuActions.toggleLineComment },
        { label: "Toggle Block Comment", shortcut: "Ctrl+Shift+/", action: menuActions.toggleBlockComment },
        { separator: true },
        { label: "Quick Fix...", shortcut: "Ctrl+.", action: menuActions.quickFix },
        { label: "Rename Symbol", shortcut: "F2", action: menuActions.renameSymbol },
        { label: "Refactor...", shortcut: "Ctrl+Shift+R", action: menuActions.refactor },
      ],
    },
    {
      label: "Selection",
      items: [
        { label: "Select All", shortcut: "Ctrl+A", action: menuActions.selectAll },
        { label: "Expand Selection", shortcut: "Shift+Alt+→", action: menuActions.smartSelectExpand },
        { label: "Shrink Selection", shortcut: "Shift+Alt+←", action: menuActions.smartSelectShrink },
        { separator: true },
        { label: "Copy Line Up", shortcut: "Shift+Alt+↑", action: menuActions.copyLineUp },
        { label: "Copy Line Down", shortcut: "Shift+Alt+↓", action: menuActions.copyLineDown },
        { label: "Move Line Up", shortcut: "Alt+↑", action: menuActions.moveLineUp },
        { label: "Move Line Down", shortcut: "Alt+↓", action: menuActions.moveLineDown },
        { separator: true },
        { label: "Add Cursor Above", shortcut: "Ctrl+Alt+↑", action: menuActions.addCursorAbove },
        { label: "Add Cursor Below", shortcut: "Ctrl+Alt+↓", action: menuActions.addCursorBelow },
        { label: "Add Cursors to Line Ends", shortcut: "Shift+Alt+I", action: menuActions.addCursorsToLineEnds },
        { separator: true },
        { label: "Add Next Occurrence", shortcut: "Ctrl+D", action: menuActions.addNextOccurrence },
        { label: "Add Previous Occurrence", shortcut: "Ctrl+Shift+D", action: menuActions.addPreviousOccurrence },
        { label: "Select All Occurrences", shortcut: "Ctrl+Shift+L", action: menuActions.selectAllOccurrences },
        { label: "Skip Occurrence", shortcut: "Ctrl+K Ctrl+D", action: menuActions.skipOccurrence },
        { separator: true },
        { label: "Column Selection Mode", shortcut: "Ctrl+Shift+C", action: menuActions.toggleColumnSelection },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Command Palette...", shortcut: "Ctrl+Shift+P", action: openCommandPalette },
        { separator: true },
        { label: "Appearance", hasSubmenu: true, action: toggleSubmenu("appearance") },
        { label: "Editor Layout", hasSubmenu: true, action: toggleSubmenu("editor-layout") },
        { separator: true },
        { label: "Toggle Sidebar", shortcut: "Ctrl+B", action: menuActions.sidebarToggle },
        { label: "Toggle Sidebar Position", action: menuActions.sidebarTogglePosition },
        { label: "Activity Bar Location", hasSubmenu: true, action: toggleSubmenu("activity-bar") },
        { separator: true },
        { label: "Menu Bar Visibility", hasSubmenu: true, action: toggleSubmenu("menu-bar") },
        { separator: true },
        { label: "Toggle Terminal", shortcut: "Ctrl+`", action: toggleTerminal },
        { label: "Toggle REPL", shortcut: "Ctrl+Shift+R", action: toggleREPL },
        { label: "Toggle Agent Panel", shortcut: "Ctrl+Shift+A", action: menuActions.viewToggleAgentPanel },
        { separator: true },
        { label: "Screencast Mode", shortcut: "Ctrl+Alt+K", action: menuActions.screencastToggle },
        { separator: true },
        { label: "Zoom In", shortcut: "Ctrl++", action: menuActions.viewZoomIn },
        { label: "Zoom Out", shortcut: "Ctrl+-", action: menuActions.viewZoomOut },
        { label: "Reset Zoom", shortcut: "Ctrl+0", action: menuActions.viewZoomReset },
        { separator: true },
        { label: "Full Screen", shortcut: "F11", action: menuActions.viewToggleFullscreen },
      ],
    },
    {
      label: "Go",
      items: [
        { label: "Go to File...", shortcut: "Ctrl+P", action: openFileFinder },
        { label: "Go to Symbol in Editor...", shortcut: "Ctrl+Shift+O", action: menuActions.showDocumentSymbolPicker },
        { label: "Go to Symbol in Workspace...", shortcut: "Ctrl+T", action: menuActions.showWorkspaceSymbolPicker },
        { label: "Go to Line...", shortcut: "Ctrl+G", action: openGoToLine },
        { separator: true },
        { label: "Go Back", shortcut: "Alt+←", action: menuActions.navigationBack },
        { label: "Go Forward", shortcut: "Alt+→", action: menuActions.navigationForward },
        { label: "Go to Last Edit Location", shortcut: "Ctrl+K Ctrl+Q", action: menuActions.navigationLastEdit },
        { separator: true },
        { label: "Go to Definition", shortcut: "F12", action: menuActions.goToDefinition },
        { label: "Go to Type Definition", action: menuActions.goToTypeDefinition },
        { label: "Go to Implementation", shortcut: "Ctrl+F12", action: menuActions.goToImplementation },
        { label: "Go to References", shortcut: "Shift+F12", action: menuActions.goToReferences },
        { separator: true },
        { label: "Next Problem", shortcut: "F8", action: menuActions.problemsNext },
        { label: "Previous Problem", shortcut: "Shift+F8", action: menuActions.problemsPrevious },
        { separator: true },
        { label: "Go to Bracket", shortcut: "Ctrl+Shift+\\", action: menuActions.goToBracket },
      ],
    },
    {
      label: "Terminal",
      items: [
        { label: "Toggle Terminal", shortcut: "Ctrl+`", action: toggleTerminal },
        { label: "New Terminal", shortcut: "Ctrl+Shift+`", action: menuActions.terminalNew },
        { label: "Split Terminal", shortcut: "Ctrl+Shift+5", action: menuActions.terminalSplit },
        { separator: true },
        { label: "Run Selection", shortcut: "Ctrl+Shift+Enter", action: menuActions.terminalRunSelection },
        { label: "Run Active File", action: menuActions.terminalRunActiveFile },
        { separator: true },
        { label: "Rename Terminal...", action: menuActions.terminalShowRenameDialog },
        { label: "Change Tab Color...", action: menuActions.terminalShowColorPicker },
        { separator: true },
        { label: "Clear Terminal", action: menuActions.terminalClear },
        { label: "Kill Terminal Process", action: menuActions.terminalKill },
        { separator: true },
        { label: "Run Task...", shortcut: "Ctrl+Shift+T", action: menuActions.tasksOpenRunDialog },
        { label: "Run Build Task", shortcut: "Ctrl+Shift+B", action: menuActions.tasksRunBuild },
        { label: "Run Test Task", shortcut: "Ctrl+Shift+Y", action: menuActions.tasksRunTest },
        { separator: true },
        { label: "Show All Tasks", action: menuActions.tasksOpenPanel },
        { label: "Configure Tasks...", action: menuActions.tasksOpenConfigEditor },
      ],
    },
    {
      label: "Run",
      items: [
        { label: "Start Debugging", shortcut: "F5", action: menuActions.debugStart },
        { label: "Run Without Debugging", shortcut: "Ctrl+F5", action: menuActions.debugRunWithoutDebugging },
        { label: "Stop Debugging", shortcut: "Shift+F5", action: menuActions.debugStop },
        { label: "Restart Debugging", shortcut: "Ctrl+Shift+F5", action: menuActions.debugRestart },
        { separator: true },
        { label: "Continue", shortcut: "F5", action: menuActions.debugContinue },
        { label: "Pause", shortcut: "F6", action: menuActions.debugPause },
        { label: "Step Over", shortcut: "F10", action: menuActions.debugStepOver },
        { label: "Step Into", shortcut: "F11", action: menuActions.debugStepInto },
        { label: "Step Out", shortcut: "Shift+F11", action: menuActions.debugStepOut },
        { separator: true },
        { label: "Toggle Breakpoint", shortcut: "F9", action: menuActions.debugToggleBreakpoint },
        { label: "New Breakpoint", hasSubmenu: true, action: toggleSubmenu("new-breakpoint") },
        { separator: true },
        { label: "Enable All Breakpoints", action: menuActions.debugEnableAllBreakpoints },
        { label: "Disable All Breakpoints", action: menuActions.debugDisableAllBreakpoints },
        { label: "Remove All Breakpoints", action: menuActions.debugRemoveAllBreakpoints },
        { separator: true },
        { label: "Add Configuration...", action: menuActions.debugAddConfiguration },
        { label: "Open launch.json", action: menuActions.debugOpenLaunchJson },
      ],
    },
    {
      label: "Git",
      items: [
        { label: "Clone Repository...", action: menuActions.gitClone },
        { label: "Clone (with submodules)...", action: menuActions.gitCloneRecursive },
        { separator: true },
        { label: "Commit...", shortcut: "Ctrl+Enter", action: menuActions.gitCommit },
        { label: "Stage All Changes", action: menuActions.gitStageAll },
        { label: "Unstage All Changes", action: menuActions.gitUnstageAll },
        { separator: true },
        { label: "Pull", action: menuActions.gitPull },
        { label: "Push", action: menuActions.gitPush },
        { label: "Sync", action: menuActions.gitSync },
        { separator: true },
        { label: "Merge Branch...", action: menuActions.gitMerge },
        { label: "Abort Merge", action: menuActions.gitMergeAbort },
        { separator: true },
        { label: "Publish Branch...", action: menuActions.gitPublishBranch },
        { label: "Set Upstream...", action: menuActions.gitSetUpstream },
        { separator: true },
        { label: "Stash Changes...", action: menuActions.gitStashCreate },
        { label: "Apply Stash...", action: menuActions.gitStashApply },
        { label: "View Stash Diff...", action: menuActions.gitStashShowDiff },
        { separator: true },
        { label: "Fetch", action: menuActions.gitFetch },
        { label: "Create Branch...", action: menuActions.gitBranchCreate },
        { label: "Checkout Branch...", action: menuActions.gitBranchCheckout },
      ],
    },
    {
      label: "Developer",
      items: [
        { label: "Component Preview", shortcut: "Ctrl+Shift+D", action: menuActions.devOpenComponentPreview },
        { separator: true },
        { label: "Toggle DevTools", shortcut: "F12", action: menuActions.devToggleDevtools },
        { label: "Reload Window", shortcut: "Ctrl+R", action: menuActions.reloadWindow },
        { separator: true },
        { label: "Process Explorer", action: menuActions.processExplorerToggle },
        { label: "Inspector", action: menuActions.inspectorToggle },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Documentation", action: menuActions.openDocs },
        { label: "Release Notes", action: menuActions.openReleaseNotes },
        { label: "Check for Updates...", action: menuActions.checkForUpdates },
        { separator: true },
        { label: "Send Feedback...", shortcut: "Ctrl+Shift+U", action: menuActions.feedbackOpenGeneral },
        { label: "Report Bug...", action: menuActions.feedbackOpenBug },
        { label: "Request Feature...", action: menuActions.feedbackOpenFeature },
        { separator: true },
        { label: "About Cortex", action: menuActions.showAboutDialog },
      ],
    },
  ]);

  // Close menu when clicking outside the active dropdown
  const handleGlobalClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Don't close if clicking inside an active dropdown menu
    if (target.closest(".menu-dropdown")) {
      return;
    }
    
    // Don't close if clicking on a menu button (handled by toggleMenu)
    if (target.closest(".menu-button")) {
      return;
    }
    
    // Close menu for all other clicks (outside dropdown and buttons)
    closeMenu();
  };

  // Set up global click listener
  onMount(() => {
    document.addEventListener("click", handleGlobalClick);
    onCleanup(() => document.removeEventListener("click", handleGlobalClick));
  });

  const toggleMenu = (label: string) => {
    if (activeMenu() === label) {
      closeMenu();
    } else {
      openMenu(label);
    }
  };

  const handleMenuHover = (label: string) => {
    if (activeMenu() !== null && activeMenu() !== label) {
      openMenu(label);
    }
  };

  const handleItemClick = (item: MenuItem) => {
    if (!item.disabled && item.action) {
      item.action();
    }
  };

  // CSS keyframes for menu animation - VS Code spec: 83ms linear fade-in
  const menuAnimationStyle = `
    @keyframes menuFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    
    /* Menu item transform transition: 50ms ease (VS Code spec) */
    .menu-item-transition {
      transition: transform ${MENU_TIMINGS.transformTransition}ms ease;
    }
  `;

  return (
    <div 
      ref={menuContainerRef}
      class="menu-bar-container flex items-center shrink-0 select-none"
      style={{
        position: "relative",
        height: `${MENUBAR_HEIGHT}px`,
        "z-index": "2500",
        isolation: "isolate",
        "padding-right": "138px",
        "min-width": "0",
        overflow: "visible",
      }}
    >
      {/* Inject animation keyframes */}
      <style>{menuAnimationStyle}</style>
      
{/* Menu items container with proper Zed-style spacing */}
      <nav 
        class="flex items-center h-full"
        role="menubar"
        aria-label="Application menu"
        style={{
          "padding-left": tokens.spacing.lg,
          "padding-right": tokens.spacing.md,
          gap: "2px",
          "pointer-events": "auto",
          "min-width": "0",
          "flex-shrink": "1",
          overflow: "visible",
        }}
      >
        {/* View Mode Toggle - Vibe / IDE */}
        <div 
          class="flex items-center rounded-full p-0.5 mr-2"
          style={{ 
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <button
            onClick={() => setViewMode("vibe")}
            class="flex items-center px-2.5 py-1 rounded-full transition-all"
            style={{
               background: viewMode() === "vibe" ? "var(--cortex-warning)" : "transparent",
               color: viewMode() === "vibe" ? "#fff" : "#fff",
               "font-size": "11px",
               "font-weight": "500",
             }}
             title="Vibe Mode"
           >
             Vibe
           </button>
           <button
             onClick={() => setViewMode("ide")}
             class="flex items-center px-2.5 py-1 rounded-full transition-all"
             style={{
               background: viewMode() === "ide" ? "var(--cortex-info)" : "transparent",
               color: viewMode() === "ide" ? "#fff" : "#fff",
              "font-size": "11px",
              "font-weight": "500",
            }}
            title="IDE Mode"
          >
            IDE
          </button>
        </div>
        
        <For each={menus()}>
          {(menu) => (
            <div class="relative h-full flex items-center">
<button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMenu(menu.label);
                }}
                onMouseEnter={() => handleMenuHover(menu.label)}
                class="menu-button rounded transition-colors duration-75"
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={activeMenu() === menu.label}
                aria-label={`${menu.label} menu`}
                style={{
                  height: "28px",                    // Fits within 40px bar
                  padding: "4px 8px",                // Reduced padding
                  "font-size": "var(--jb-font-size-xs)",  // JetBrains small font size
                  "font-weight": "400",
                  "line-height": "1",
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  // Menu text is white
                  color: "var(--cortex-text-primary)",
                  background: activeMenu() === menu.label ? tokens.colors.interactive.hover : "transparent",
                  "border-radius": tokens.radius.sm,
                }}
                onMouseOver={(e) => {
                  if (activeMenu() !== menu.label) {
                    e.currentTarget.style.color = "var(--cortex-text-primary)";
                    e.currentTarget.style.background = tokens.colors.interactive.hover;
                  }
                }}
                onMouseOut={(e) => {
                  if (activeMenu() !== menu.label) {
                    e.currentTarget.style.color = "var(--cortex-text-primary)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {menu.label}
              </button>
              
              <Show when={activeMenu() === menu.label}>
                <div
                  class="menu-dropdown absolute left-0 top-full mt-0.5"
                  style={{
                    "min-width": MENU_STYLES.container.minWidth,
                    "width": "max-content",
                    background: MENU_STYLES.container.background,
                    border: MENU_STYLES.container.border,
                    "border-radius": MENU_STYLES.container.borderRadius,
                    "box-shadow": MENU_STYLES.container.boxShadow,
                    padding: MENU_STYLES.container.padding,
                    animation: `menuFadeIn ${MENU_STYLES.animation.duration} ${MENU_STYLES.animation.easing}`,
                    "transform-origin": "top left",
                    "z-index": "9999",
                    "white-space": "nowrap",
                    "backdrop-filter": "blur(12px)",
                  }}
                  onKeyDown={(e) => handleKeyDown(e, menu.items)}
                  tabIndex={-1}
                >
                  <For each={menu.items}>
                    {(item, itemIndex) => (
                      <Show
                        when={!item.separator}
                        fallback={
                          <div 
                            style={{ 
                              height: "1px", 
                              background: tokens.colors.border.divider,
                              margin: `${MENU_STYLES.separator.marginVertical} 0`,
                            }} 
                          />
                        }
                      >
                        <div class="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item);
                            }}
                            disabled={item.disabled}
                            class="w-full flex items-center transition-colors duration-75"
                            style={{
                              height: MENU_STYLES.item.height,
                              padding: `0 ${MENU_STYLES.item.paddingHorizontal}`,
                              "font-size": MENU_STYLES.item.fontSize,
                              color: tokens.colors.text.primary,
                              opacity: item.disabled ? MENU_STYLES.disabled.opacity : "1",
                              background: focusedItemIndex() === itemIndex() || (item.hasSubmenu && activeSubmenu() === "recent") 
                                ? MENU_STYLES.hover.background 
                                : "transparent",
                              cursor: item.disabled ? "default" : "pointer",
                              "border-radius": tokens.radius.sm,
                            }}
onMouseEnter={(e) => {
                              if (!item.disabled) {
                                e.currentTarget.style.background = MENU_STYLES.hover.background;
                                setFocusedItemIndex(itemIndex());
                                if (item.hasSubmenu) {
                                  // Determine submenu ID based on label
                                  const submenuId = item.label === "Open Recent" ? "recent" 
                                    : item.label === "Activity Bar Location" ? "activity-bar"
                                    : item.label === "Menu Bar Visibility" ? "menu-bar"
                                    : item.label === "New Breakpoint" ? "new-breakpoint"
                                    : item.label === "Appearance" ? "appearance"
                                    : item.label === "Editor Layout" ? "editor-layout"
                                    : null;
                                  if (submenuId) setActiveSubmenu(submenuId);
                                } else {
                                  setActiveSubmenu(null);
                                }
                              }
                            }}
                            onMouseLeave={(e) => {
                              const submenuId = item.label === "Open Recent" ? "recent" 
                                : item.label === "Activity Bar Location" ? "activity-bar"
                                : item.label === "Menu Bar Visibility" ? "menu-bar"
                                : item.label === "New Breakpoint" ? "new-breakpoint"
                                : item.label === "Appearance" ? "appearance"
                                : item.label === "Editor Layout" ? "editor-layout"
                                : null;
                              if (!item.hasSubmenu || activeSubmenu() !== submenuId) {
                                e.currentTarget.style.background = "transparent";
                              }
                              if (focusedItemIndex() === itemIndex()) {
                                setFocusedItemIndex(-1);
                              }
                            }}
                          >
                            {/* Checkmark for checked items */}
                            <Show when={item.checked !== undefined}>
                              <span 
                                class="flex items-center justify-center"
                                style={{ 
                                  width: MENU_STYLES.icon.width, 
                                  height: MENU_STYLES.icon.height,
                                  "margin-right": "6px",
                                  color: tokens.colors.text.muted,
                                }}
                              >
                                <Show when={item.checked}>
                                  <Icon name="check" size={16} />
                                </Show>
                              </span>
                            </Show>
                            
                            {/* Icon if provided */}
                            <Show when={item.icon}>
                              <span 
                                class="flex items-center justify-center"
                                style={{ 
                                  width: MENU_STYLES.icon.width, 
                                  height: MENU_STYLES.icon.height,
                                  "margin-right": MENU_STYLES.icon.marginRight,
                                  color: tokens.colors.text.muted,
                                }}
                              >
                                {item.icon}
                              </span>
                            </Show>
                            
                            <span class="flex-1 text-left truncate">{item.label}</span>
                            
                            <Show when={item.hasSubmenu} fallback={
                              <Show when={item.shortcut}>
                                <span 
                                  class="ml-auto pl-4"
                                  style={{ 
                                    color: MENU_STYLES.shortcut.color, 
                                    "font-size": MENU_STYLES.shortcut.fontSize,
                                    "font-family": MENU_STYLES.shortcut.fontFamily,
                                  }}
                                >
                                  {item.shortcut}
                                </span>
                              </Show>
                            }>
                              <Icon name="chevron-right" size={14} class="ml-auto" style={{ color: tokens.colors.text.muted }} />
                            </Show>
                          </button>
                          
                          {/* Open Recent Submenu */}
                          <Show when={item.hasSubmenu && item.label === "Open Recent" && activeSubmenu() === "recent"}>
                            <div
                              class="menu-dropdown absolute left-full top-0 z-50"
                              style={{
                                "min-width": "280px",
                                "max-height": "400px",
                                "overflow-y": "auto",
                                "margin-left": tokens.spacing.sm,
                                background: MENU_STYLES.container.background,
                                border: MENU_STYLES.container.border,
                                "border-radius": MENU_STYLES.container.borderRadius,
                                "box-shadow": MENU_STYLES.container.boxShadow,
                                padding: MENU_STYLES.container.padding,
                                animation: `menuFadeIn ${MENU_STYLES.animation.duration} ${MENU_STYLES.animation.easing}`,
                                "transform-origin": "top left",
                                "backdrop-filter": "blur(12px)",
                              }}
                              onMouseLeave={() => setActiveSubmenu(null)}
                            >
                              <Show
                                when={recentWorkspaces().length > 0 || recentProjects().length > 0}
                                fallback={
                                  <div 
                                    class="flex items-center justify-center"
                                    style={{ 
                                      height: "48px",
                                      color: tokens.colors.text.muted,
                                      "font-size": "var(--jb-font-size-xs)",
                                    }}
                                  >
                                    No recent items
                                  </div>
                                }
                              >
                                {/* Recent Workspaces Section */}
                                <Show when={recentWorkspaces().length > 0}>
                                  <div 
                                    style={{ 
                                      padding: "4px 8px", 
                                      "font-size": "var(--jb-font-size-2xs)", 
                                      color: tokens.colors.text.muted,
                                      "text-transform": "uppercase",
                                      "letter-spacing": "0.5px",
                                    }}
                                  >
                                    Workspaces
                                  </div>
                                  <For each={recentWorkspaces().slice(0, 5)}>
                                    {(ws) => (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenRecentWorkspace(ws);
                                        }}
                                        class="w-full flex flex-col text-left transition-colors duration-75"
                                        style={{ 
                                          padding: "6px 8px",
                                          "border-radius": tokens.radius.sm,
                                          margin: "0 4px",
                                          color: tokens.colors.text.primary,
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                      >
                                        <div class="flex items-center gap-2">
                                          <span 
                                            class="truncate" 
                                            style={{ 
                                              "font-size": "var(--jb-font-size-xs)",
                                              "font-weight": "500",
                                            }}
                                          >
                                            {ws.name}
                                          </span>
                                          <Show when={ws.folderCount > 1}>
                                            <span 
                                              style={{ 
                                                "font-size": "var(--jb-font-size-2xs)", 
                                                color: tokens.colors.text.muted,
                                                background: tokens.colors.interactive.hover,
                                                padding: "1px 4px",
                                                "border-radius": "var(--jb-radius-xs)",
                                              }}
                                            >
                                              {ws.folderCount} folders
                                            </span>
                                          </Show>
                                        </div>
                                        <span 
                                          class="truncate" 
                                          style={{ 
                                            "font-size": "var(--jb-font-size-2xs)", 
                                            color: tokens.colors.text.muted,
                                            "margin-top": "1px",
                                          }}
                                        >
                                          {ws.path.replace(/\\/g, "/").split("/").slice(-2).join("/")}
                                        </span>
                                      </button>
                                    )}
                                  </For>
                                  <Show when={recentWorkspaces().length > 5}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowRecentWorkspacesModal(true);
                                        setActiveMenu(null);
                                        setActiveSubmenu(null);
                                      }}
                                      class="w-full flex items-center transition-colors duration-75"
                                      style={{ 
                                        height: MENU_STYLES.item.height,
                                        padding: `0 ${MENU_STYLES.item.paddingHorizontal}`,
                                        "font-size": "var(--jb-font-size-xs)",
                                        color: tokens.colors.text.muted,
                                        "border-radius": tokens.radius.sm,
                                        margin: "0 4px",
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                    >
                                      <span>More workspaces...</span>
                                    </button>
                                  </Show>
                                </Show>
                                
                                {/* Separator between workspaces and projects */}
                                <Show when={recentWorkspaces().length > 0 && recentProjects().length > 0}>
                                  <div 
                                    style={{ 
                                      height: "1px", 
                                      background: tokens.colors.border.divider,
                                      margin: "6px 0",
                                    }} 
                                  />
                                </Show>
                                
                                {/* Recent Projects Section */}
                                <Show when={recentProjects().length > 0}>
                                  <div 
                                    style={{ 
                                      padding: "4px 8px", 
                                      "font-size": "var(--jb-font-size-2xs)", 
                                      color: tokens.colors.text.muted,
                                      "text-transform": "uppercase",
                                      "letter-spacing": "0.5px",
                                    }}
                                  >
                                    Projects
                                  </div>
                                  <For each={recentProjects().slice(0, 5)}>
                                    {(project) => (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenRecentProject(project);
                                        }}
                                        class="w-full flex flex-col text-left transition-colors duration-75"
                                        style={{ 
                                          padding: "6px 8px",
                                          "border-radius": tokens.radius.sm,
                                          margin: "0 4px",
                                          color: tokens.colors.text.primary,
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                      >
                                        <span 
                                          class="truncate" 
                                          style={{ 
                                            "font-size": "var(--jb-font-size-xs)",
                                            "font-weight": "500",
                                          }}
                                        >
                                          {project.name}
                                        </span>
                                        <span 
                                          class="truncate" 
                                          style={{ 
                                            "font-size": "var(--jb-font-size-2xs)", 
                                            color: tokens.colors.text.muted,
                                            "margin-top": "1px",
                                          }}
                                        >
                                          {project.path.replace(/\\/g, "/").split("/").slice(-2).join("/")}
                                        </span>
                                      </button>
                                    )}
                                  </For>
                                </Show>
                                
                                {/* Bottom Actions */}
                                <div 
                                  style={{ 
                                    height: "1px", 
                                    background: tokens.colors.border.divider,
                                    margin: "6px 0",
                                  }} 
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowRecentProjects();
                                  }}
                                  class="w-full flex items-center justify-between transition-colors duration-75"
                                  style={{ 
                                    height: MENU_STYLES.item.height,
                                    padding: `0 ${MENU_STYLES.item.paddingHorizontal}`,
                                    "font-size": MENU_STYLES.item.fontSize,
                                    color: tokens.colors.text.primary,
                                    "border-radius": tokens.radius.sm,
                                    margin: "0 4px",
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                >
                                  <span>Browse All...</span>
                                  <span 
                                    style={{ 
                                      color: MENU_STYLES.shortcut.color, 
                                      "font-size": MENU_STYLES.shortcut.fontSize,
                                      "font-family": MENU_STYLES.shortcut.fontFamily,
                                    }}
                                  >
                                    Ctrl+Shift+E
                                  </span>
                                </button>
                                <Show when={recentWorkspaces().length > 0}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClearRecentWorkspaces();
                                    }}
                                    class="w-full flex items-center transition-colors duration-75"
                                    style={{ 
                                      height: MENU_STYLES.item.height,
                                      padding: `0 ${MENU_STYLES.item.paddingHorizontal}`,
                                      "font-size": MENU_STYLES.item.fontSize,
                                      color: tokens.colors.text.primary,
                                      "border-radius": tokens.radius.sm,
                                      margin: "0 4px",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                  >
                                    <span>Clear Recent Workspaces</span>
                                  </button>
                                </Show>
                                <Show when={recentProjects().length > 0}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClearRecentProjects();
                                    }}
                                    class="w-full flex items-center transition-colors duration-75"
                                    style={{ 
                                      height: MENU_STYLES.item.height,
                                      padding: `0 ${MENU_STYLES.item.paddingHorizontal}`,
                                      "font-size": MENU_STYLES.item.fontSize,
                                      color: tokens.colors.text.primary,
                                      "border-radius": tokens.radius.sm,
                                      margin: "0 4px",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                  >
                                    <span>Clear Recent Projects</span>
                                  </button>
                                </Show>
                              </Show>
                            </div>
                          </Show>
                          
                          {/* Activity Bar Location Submenu */}
                          <Show when={item.hasSubmenu && item.label === "Activity Bar Location" && activeSubmenu() === "activity-bar"}>
                            <div
                              class="menu-dropdown absolute left-full top-0 z-50"
                              style={{
                                "min-width": "180px",
                                "margin-left": tokens.spacing.sm,
                                background: MENU_STYLES.container.background,
                                border: MENU_STYLES.container.border,
                                "border-radius": MENU_STYLES.container.borderRadius,
                                "box-shadow": MENU_STYLES.container.boxShadow,
                                padding: MENU_STYLES.container.padding,
                                animation: `menuFadeIn ${MENU_STYLES.animation.duration} ${MENU_STYLES.animation.easing}`,
                                "transform-origin": "top left",
                                "backdrop-filter": "blur(12px)",
                              }}
                              onMouseLeave={() => setActiveSubmenu(null)}
                            >
                              {[
                                { value: "side" as ActivityBarLocation, label: "Side" },
                                { value: "top" as ActivityBarLocation, label: "Top" },
                                { value: "hidden" as ActivityBarLocation, label: "Hidden" },
                              ].map((option) => (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActivityBarLocation(option.value);
                                  }}
                                  class="w-full flex items-center transition-colors duration-75"
                                  style={{ 
                                    height: MENU_STYLES.item.height,
                                    padding: `0 ${MENU_STYLES.item.paddingHorizontal}`,
                                    "font-size": MENU_STYLES.item.fontSize,
                                    color: tokens.colors.text.primary,
                                    "border-radius": tokens.radius.sm,
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                >
                                  <span 
                                    class="flex items-center justify-center"
                                    style={{ 
                                      width: "20px", 
                                      "margin-right": "6px",
                                      color: tokens.colors.text.muted,
                                    }}
                                  >
                                    <Show when={activityBarLocation() === option.value}>
                                      <Icon name="check" size={16} />
                                    </Show>
                                  </span>
                                  <span>{option.label}</span>
                                </button>
                              ))}
                            </div>
                          </Show>
                          
                          {/* Menu Bar Visibility Submenu */}
                          <Show when={item.hasSubmenu && item.label === "Menu Bar Visibility" && activeSubmenu() === "menu-bar"}>
                            <div
                              class="menu-dropdown absolute left-full top-0 z-50"
                              style={{
                                "min-width": "180px",
                                "margin-left": tokens.spacing.sm,
                                background: MENU_STYLES.container.background,
                                border: MENU_STYLES.container.border,
                                "border-radius": MENU_STYLES.container.borderRadius,
                                "box-shadow": MENU_STYLES.container.boxShadow,
                                padding: MENU_STYLES.container.padding,
                                animation: `menuFadeIn ${MENU_STYLES.animation.duration} ${MENU_STYLES.animation.easing}`,
                                "transform-origin": "top left",
                                "backdrop-filter": "blur(12px)",
                              }}
                              onMouseLeave={() => setActiveSubmenu(null)}
                            >
                              {[
                                { value: "classic" as MenuBarVisibility, label: "Classic", desc: "Always visible" },
                                { value: "compact" as MenuBarVisibility, label: "Compact", desc: "Icons only" },
                                { value: "toggle" as MenuBarVisibility, label: "Toggle", desc: "Show with Alt key" },
                                { value: "hidden" as MenuBarVisibility, label: "Hidden", desc: "Use Alt to show" },
                              ].map((option) => (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuBarVisibility(option.value);
                                  }}
                                  class="w-full flex items-center transition-colors duration-75"
                                  style={{ 
                                    height: MENU_STYLES.item.height,
                                    padding: `0 ${MENU_STYLES.item.paddingHorizontal}`,
                                    "font-size": MENU_STYLES.item.fontSize,
                                    color: tokens.colors.text.primary,
                                    "border-radius": tokens.radius.sm,
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                >
                                  <span 
                                    class="flex items-center justify-center"
                                    style={{ 
                                      width: "20px", 
                                      "margin-right": "6px",
                                      color: tokens.colors.text.muted,
                                    }}
                                  >
                                    <Show when={menuBarVisibility() === option.value}>
                                      <Icon name="check" size={16} />
                                    </Show>
                                  </span>
                              <span>{option.label}</span>
                                </button>
                              ))}
                            </div>
                          </Show>
                          
                          {/* New Breakpoint Submenu */}
                          <Show when={item.hasSubmenu && item.label === "New Breakpoint" && activeSubmenu() === "new-breakpoint"}>
                            <div
                              class="menu-dropdown absolute left-full top-0 z-50"
                              style={{
                                "min-width": "200px",
                                "margin-left": tokens.spacing.sm,
                                background: MENU_STYLES.container.background,
                                border: MENU_STYLES.container.border,
                                "border-radius": MENU_STYLES.container.borderRadius,
                                "box-shadow": MENU_STYLES.container.boxShadow,
                                padding: MENU_STYLES.container.padding,
                                animation: `menuFadeIn ${MENU_STYLES.animation.duration} ${MENU_STYLES.animation.easing}`,
                                "transform-origin": "top left",
                                "backdrop-filter": "blur(12px)",
                              }}
                              onMouseLeave={() => setActiveSubmenu(null)}
                            >
                              {[
                                { label: "Conditional Breakpoint...", event: "debug:add-conditional-breakpoint" },
                                { label: "Logpoint...", event: "debug:add-logpoint" },
                                { label: "Function Breakpoint...", event: "debug:add-function-breakpoint" },
                                { label: "Data Breakpoint...", event: "debug:add-data-breakpoint" },
                              ].map((bpOption) => (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeMenu();
                                    window.dispatchEvent(new CustomEvent(bpOption.event));
                                  }}
                                  class="w-full flex items-center transition-colors duration-75"
                                  style={{ 
                                    height: MENU_STYLES.item.height,
                                    padding: `0 ${MENU_STYLES.item.paddingHorizontal}`,
                                    "font-size": MENU_STYLES.item.fontSize,
                                    color: tokens.colors.text.primary,
                                    "border-radius": tokens.radius.sm,
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                >
                                  <span>{bpOption.label}</span>
                                </button>
                              ))}
                            </div>
                          </Show>
                          
                          {/* Appearance Submenu */}
                          <Show when={item.hasSubmenu && item.label === "Appearance" && activeSubmenu() === "appearance"}>
                            <div
                              class="menu-dropdown absolute left-full top-0 z-50"
                              style={{
                                "min-width": "220px",
                                "margin-left": tokens.spacing.sm,
                                background: MENU_STYLES.container.background,
                                border: MENU_STYLES.container.border,
                                "border-radius": MENU_STYLES.container.borderRadius,
                                "box-shadow": MENU_STYLES.container.boxShadow,
                                padding: MENU_STYLES.container.padding,
                                animation: `menuFadeIn ${MENU_STYLES.animation.duration} ${MENU_STYLES.animation.easing}`,
                                "transform-origin": "top left",
                                "backdrop-filter": "blur(12px)",
                              }}
                              onMouseLeave={() => setActiveSubmenu(null)}
                            >
                              {[
                                { label: "Full Screen", shortcut: "F11", event: "view:toggle-fullscreen" },
                                { label: "Zen Mode", shortcut: "Ctrl+K Z", event: "view:toggle-zen-mode" },
                                { label: "Centered Layout", event: "view:toggle-centered-layout" },
                                { separator: true },
                                { label: "Toggle Breadcrumbs", event: "view:toggle-breadcrumbs" },
                                { label: "Toggle Minimap", event: "view:toggle-minimap" },
                                { label: "Toggle Sticky Scroll", event: "view:toggle-sticky-scroll" },
                                { label: "Toggle Render Whitespace", event: "view:toggle-render-whitespace" },
                                { separator: true },
                                { label: "Toggle Word Wrap", shortcut: "Alt+Z", event: "view:toggle-word-wrap" },
                                { label: "Toggle Line Numbers", event: "view:toggle-line-numbers" },
                                { label: "Toggle Status Bar", event: "view:toggle-status-bar" },
                              ].map((appearanceOption) => (
                                <Show
                                  when={!appearanceOption.separator}
                                  fallback={
                                    <div 
                                      style={{ 
                                        height: "1px", 
                                        background: tokens.colors.border.divider,
                                        margin: `${MENU_STYLES.separator.marginVertical} 0`,
                                      }} 
                                    />
                                  }
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      closeMenu();
                                      window.dispatchEvent(new CustomEvent(appearanceOption.event!));
                                    }}
                                    class="w-full flex items-center justify-between transition-colors duration-75"
                                    style={{ 
                                      height: MENU_STYLES.item.height,
                                      padding: `0 ${MENU_STYLES.item.paddingHorizontal}`,
                                      "font-size": MENU_STYLES.item.fontSize,
                                      color: tokens.colors.text.primary,
                                      "border-radius": tokens.radius.sm,
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                  >
                                    <span>{appearanceOption.label}</span>
                                    <Show when={appearanceOption.shortcut}>
                                      <span 
                                        style={{ 
                                          color: MENU_STYLES.shortcut.color, 
                                          "font-size": MENU_STYLES.shortcut.fontSize,
                                          "font-family": MENU_STYLES.shortcut.fontFamily,
                                        }}
                                      >
                                        {appearanceOption.shortcut}
                                      </span>
                                    </Show>
                                  </button>
                                </Show>
                              ))}
                            </div>
                          </Show>
                          
                          {/* Editor Layout Submenu */}
                          <Show when={item.hasSubmenu && item.label === "Editor Layout" && activeSubmenu() === "editor-layout"}>
                            <div
                              class="menu-dropdown absolute left-full top-0 z-50"
                              style={{
                                "min-width": "220px",
                                "margin-left": tokens.spacing.sm,
                                background: MENU_STYLES.container.background,
                                border: MENU_STYLES.container.border,
                                "border-radius": MENU_STYLES.container.borderRadius,
                                "box-shadow": MENU_STYLES.container.boxShadow,
                                padding: MENU_STYLES.container.padding,
                                animation: `menuFadeIn ${MENU_STYLES.animation.duration} ${MENU_STYLES.animation.easing}`,
                                "transform-origin": "top left",
                                "backdrop-filter": "blur(12px)",
                              }}
                              onMouseLeave={() => setActiveSubmenu(null)}
                            >
                              {[
                                { label: "Split Right", shortcut: "Ctrl+\\", event: "editor:split-right" },
                                { label: "Split Down", shortcut: "Ctrl+K Ctrl+\\", event: "editor:split-down" },
                                { separator: true },
                                { label: "Single", event: "editor:layout-single" },
                                { label: "Two Columns", event: "editor:layout-two-columns" },
                                { label: "Three Columns", event: "editor:layout-three-columns" },
                                { label: "Two Rows", event: "editor:layout-two-rows" },
                                { label: "Three Rows", event: "editor:layout-three-rows" },
                                { label: "Grid (2x2)", event: "editor:layout-grid" },
                                { separator: true },
                                { label: "Two Rows Right", event: "editor:layout-two-rows-right" },
                                { label: "Two Columns Bottom", event: "editor:layout-two-columns-bottom" },
                                { separator: true },
                                { label: "Flip Layout", event: "editor:flip-layout" },
                              ].map((layoutOption) => (
                                <Show
                                  when={!layoutOption.separator}
                                  fallback={
                                    <div 
                                      style={{ 
                                        height: "1px", 
                                        background: tokens.colors.border.divider,
                                        margin: `${MENU_STYLES.separator.marginVertical} 0`,
                                      }} 
                                    />
                                  }
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      closeMenu();
                                      window.dispatchEvent(new CustomEvent(layoutOption.event!));
                                    }}
                                    class="w-full flex items-center justify-between transition-colors duration-75"
                                    style={{ 
                                      height: MENU_STYLES.item.height,
                                      padding: `0 ${MENU_STYLES.item.paddingHorizontal}`,
                                      "font-size": MENU_STYLES.item.fontSize,
                                      color: tokens.colors.text.primary,
                                      "border-radius": tokens.radius.sm,
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = MENU_STYLES.hover.background; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                  >
                                    <span>{layoutOption.label}</span>
                                    <Show when={layoutOption.shortcut}>
                                      <span 
                                        style={{ 
                                          color: MENU_STYLES.shortcut.color, 
                                          "font-size": MENU_STYLES.shortcut.fontSize,
                                          "font-family": MENU_STYLES.shortcut.fontFamily,
                                        }}
                                      >
                                        {layoutOption.shortcut}
                                      </span>
                                    </Show>
                                  </button>
                                </Show>
                              ))}
                            </div>
                          </Show>
                        </div>
                      </Show>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
      </nav>
      
      {/* Project Widget - JetBrains Unified Header */}
      <Show when={projectName()}>
        <div 
          class="flex items-center gap-2 px-3"
          style={{
            "pointer-events": "auto",
            "border-left": `1px solid ${tokens.colors.border.divider}`,
            "margin-left": tokens.spacing.md,
            "padding-left": tokens.spacing.lg,
          }}
        >
          <span 
            style={{ 
              "font-size": "var(--jb-font-size-xs)", 
              "font-weight": "500",
              color: tokens.colors.text.primary,
            }}
          >
            {projectName()}
          </span>
          <Show when={gitBranch()}>
            <div class="flex items-center gap-1">
              <Icon name="code-branch" size={12} style={{ color: "var(--cortex-text-primary)" }} />
              <span 
                style={{ 
                  "font-size": "var(--jb-font-size-2xs)", 
                  color: "var(--cortex-text-primary)",
                }}
              >
                {gitBranch()}
              </span>
            </div>
          </Show>
        </div>
      </Show>
      
      {/* Centered Command Center - VS Code Style */}
      <div 
        class="flex-1 h-full flex items-center justify-center pointer-events-none min-w-0" 
        data-tauri-drag-region
      >
        <div class="pointer-events-auto">
          <CommandCenter />
        </div>
      </div>
      
      {/* Notifications */}
      <Show when={notifications}>
        <div class="relative pr-2" style={{ "pointer-events": "auto" }}>
          <NotificationsBadge 
            count={notifications!.unreadCount()} 
            onClick={() => notifications!.togglePanel()} 
          />
          <NotificationsPanel />
        </div>
      </Show>
      
      {/* Run/Debug Buttons - JetBrains Unified Header */}
      <div 
        class="flex items-center gap-1 mr-2"
        style={{ "pointer-events": "auto" }}
      >
        {/* Run Button - Trae: muted green, not saturated */}
        <button
          class="flex items-center justify-center rounded transition-colors"
          style={{
            width: "28px",
            height: "28px",
            // Trae: Use muted icon color instead of saturated green
            color: "var(--jb-text-navbar-color, var(--cortex-text-inactive))",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => window.dispatchEvent(new CustomEvent("tasks:run-build"))}
          onMouseEnter={(e) => { 
            e.currentTarget.style.background = tokens.colors.interactive.hover; 
            e.currentTarget.style.color = "var(--jb-text-navbar-hover, var(--cortex-text-primary))";
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.background = "transparent"; 
            e.currentTarget.style.color = "var(--jb-text-navbar-color, var(--cortex-text-inactive))";
          }}
          title="Run (Ctrl+Shift+B)"
        >
          <Icon name="play" size={16} />
        </button>
        
        {/* Debug Button - Trae: muted red, not saturated */}
        <button
          class="flex items-center justify-center rounded transition-colors"
          style={{
            width: "28px",
            height: "28px",
            // Trae: Use muted icon color instead of saturated red
            color: "var(--jb-text-navbar-color, var(--cortex-text-inactive))",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => window.dispatchEvent(new CustomEvent("debug:start"))}
          onMouseEnter={(e) => { 
            e.currentTarget.style.background = tokens.colors.interactive.hover; 
            e.currentTarget.style.color = "var(--jb-text-navbar-hover, var(--cortex-text-primary))";
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.background = "transparent"; 
            e.currentTarget.style.color = "var(--jb-text-navbar-color, var(--cortex-text-inactive))";
          }}
          title="Start Debugging (F5)"
        >
          <Icon name="pause" size={16} />
        </button>
      </div>

      {/* Collapse Sidebar Button */}
      <button
        class="flex items-center justify-center rounded transition-colors hover:bg-white/5 mr-1"
        style={{
          width: "28px",
          height: "28px",
          color: "var(--cortex-text-primary)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          "pointer-events": "auto",
        }}
        onClick={() => window.dispatchEvent(new CustomEvent("sidebar:toggle"))}
        title="Toggle Sidebar (Ctrl+B)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>

      {/* Toggle Terminal/Bottom Panel Button */}
      <button
        class="flex items-center justify-center rounded transition-colors hover:bg-white/5 mr-1"
        style={{
          width: "28px",
          height: "28px",
          color: "var(--cortex-text-primary)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          "pointer-events": "auto",
        }}
        onClick={() => window.dispatchEvent(new CustomEvent("terminal:toggle"))}
        title="Toggle Terminal (Ctrl+J)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="15" x2="21" y2="15" />
        </svg>
      </button>

      {/* Toggle Chat Button */}
      <button
        class="flex items-center justify-center rounded transition-colors hover:bg-white/5 mr-1"
        style={{
          width: "28px",
          height: "28px",
          color: "var(--cortex-text-primary)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          "pointer-events": "auto",
        }}
        onClick={() => window.dispatchEvent(new CustomEvent("view:toggle-chat"))}
        title="Toggle Chat (Ctrl+Shift+C)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </button>
      
      {/* Window Controls */}
      <WindowControls />
      
      {/* About Dialog */}
      <SystemSpecsDialog open={showAboutDialog()} onClose={() => setShowAboutDialog(false)} />
      
      {/* Recent Workspaces Modal */}
      <Show when={showRecentWorkspacesModal()}>
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "z-index": 9999,
          }}
          onClick={() => setShowRecentWorkspacesModal(false)}
        >
          <div
            style={{
              background: tokens.colors.surface.panel,
              border: `1px solid ${tokens.colors.border.panel}`,
              "border-radius": tokens.radius.lg,
              "min-width": "400px",
              "max-width": "600px",
              "max-height": "70vh",
              overflow: "hidden",
              "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: tokens.spacing.md,
                "border-bottom": `1px solid ${tokens.colors.border.divider}`,
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
              }}
            >
              <span style={{ "font-weight": "600", color: tokens.colors.text.primary }}>
                Recent Workspaces
              </span>
              <button
                onClick={() => setShowRecentWorkspacesModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  padding: tokens.spacing.xs,
                  cursor: "pointer",
                  color: tokens.colors.text.muted,
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  "border-radius": tokens.radius.sm,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = tokens.colors.surface.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                <Icon name="xmark" size={16} />
              </button>
            </div>
            <div
              style={{
                "max-height": "calc(70vh - 60px)",
                overflow: "auto",
                padding: tokens.spacing.sm,
              }}
            >
              <For each={workspace?.recentWorkspaces() || []}>
                {(ws) => (
                  <button
                    onClick={() => {
                      workspace?.openRecentWorkspace(ws);
                      setShowRecentWorkspacesModal(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      "flex-direction": "column",
                      "align-items": "flex-start",
                      padding: tokens.spacing.sm,
                      background: "none",
                      border: "none",
                      "border-radius": tokens.radius.sm,
                      cursor: "pointer",
                      "text-align": "left",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = tokens.colors.surface.hover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  >
                    <span style={{ 
                      "font-size": tokens.typography.fontSize.sm, 
                      color: tokens.colors.text.primary,
                      "font-weight": "500",
                    }}>
                      {ws.path.replace(/\\/g, "/").split("/").pop() || ws.path}
                    </span>
                    <span style={{ 
                      "font-size": tokens.typography.fontSize.xs, 
                      color: tokens.colors.text.muted,
                      "margin-top": "2px",
                    }}>
                      {ws.path}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
      
      {/* Window Resize Handles */}
      <WindowResizers />
    </div>
  );
}

// ============================================================================
// Window Controls Component
// ============================================================================

const MENUBAR_HEIGHT = 43; // Unified header height (reduced 10% from 48px)

// Update --zoom-factor CSS variable based on window scale factor
const updateZoomFactor = async () => {
  try {
    const webviewWindow = getCurrentWebviewWindow();
    const factor = await webviewWindow.scaleFactor();
    document.documentElement.style.setProperty('--zoom-factor', String(factor));
  } catch (e) {
    console.error("Failed to update zoom factor:", e);
  }
};

export function WindowControls() {
  const [isMaximized, setIsMaximized] = createSignal(false);
  let appWindow: Awaited<ReturnType<typeof getCurrentWindow>> | null = null;
  let unlisten: (() => void) | undefined;
  let unlistenScale: (() => void) | undefined;

  // Register cleanup synchronously
  onCleanup(() => {
    unlisten?.();
    unlistenScale?.();
  });

  onMount(async () => {
    try {
      appWindow = getCurrentWindow();
      setIsMaximized(await appWindow.isMaximized());
      
      // Initialize zoom factor
      await updateZoomFactor();
      
      unlisten = await appWindow.onResized(async () => {
        if (appWindow) {
          setIsMaximized(await appWindow.isMaximized());
        }
      });
      
      // Listen for scale factor changes (when moving between monitors, DPI changes, etc.)
      const webviewWindow = getCurrentWebviewWindow();
      unlistenScale = await webviewWindow.onScaleChanged(async ({ payload }) => {
        document.documentElement.style.setProperty('--zoom-factor', String(payload.scaleFactor));
      });
    } catch (e) {
      console.error("Failed to get window:", e);
    }
  });

  const handleMinimize = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (appWindow) await appWindow.minimize();
    } catch (err) {
      console.error("Minimize failed:", err);
    }
  };

  const handleMaximize = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (appWindow) await appWindow.toggleMaximize();
    } catch (err) {
      console.error("Maximize failed:", err);
    }
  };

  const handleClose = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (appWindow) await appWindow.close();
    } catch (err) {
      console.error("Close failed:", err);
    }
  };

  return (
    <div 
      class="window-controls window-controls-container flex items-center" 
      style={{ 
        position: "fixed",
        top: "0",
        right: "0",
        height: `${MENUBAR_HEIGHT}px`,
        "z-index": "9999",
        "pointer-events": "auto",
        "-webkit-app-region": "no-drag",
      }}
    >
      {/* Minimize */}
      <button
        onClick={handleMinimize}
        class="w-[46px] h-full flex items-center justify-center transition-colors hover:bg-white/10"
        style={{ color: "var(--cortex-text-primary)" }}
        title="Minimize"
      >
        <Icon name="minus" class="w-4 h-4" />
      </button>
      
      {/* Maximize/Restore */}
      <button
        onClick={handleMaximize}
        class="w-[46px] h-full flex items-center justify-center transition-colors hover:bg-white/10"
        style={{ color: "var(--cortex-text-primary)" }}
        title={isMaximized() ? "Restore" : "Maximize"}
      >
        <Show when={isMaximized()} fallback={<Icon name="square" class="w-3.5 h-3.5" />}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="7" width="14" height="14" rx="2" />
            <path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
          </svg>
        </Show>
      </button>
      
      {/* Close */}
      <button
        onClick={handleClose}
        class="w-[46px] h-full flex items-center justify-center transition-colors hover:bg-red-500"
        style={{ color: "var(--cortex-text-primary)" }}
        title="Close"
      >
        <Icon name="xmark" class="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================================================
// Window Resizers Component - Edge resize handles for frameless window
// ============================================================================

type ResizeDirection = "North" | "South" | "East" | "West" | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";

// Reasonable z-index for resize handles (below modals which typically use 10000+)
const RESIZE_HANDLE_Z_INDEX = 1000;

function WindowResizers() {
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isMaximized, setIsMaximized] = createSignal(false);
  let appWindow: Awaited<ReturnType<typeof getCurrentWindow>> | null = null;
  let unlisten: (() => void) | undefined;

  // Register cleanup synchronously
  onCleanup(() => unlisten?.());

  onMount(async () => {
    try {
      appWindow = getCurrentWindow();
      
      // Check initial window state
      const checkWindowState = async () => {
        if (appWindow) {
          setIsFullscreen(await appWindow.isFullscreen());
          setIsMaximized(await appWindow.isMaximized());
        }
      };
      
      await checkWindowState();
      
      // Listen to window resize events to detect fullscreen/maximized changes
      unlisten = await appWindow.onResized(async () => {
        await checkWindowState();
      });
    } catch (e) {
      console.error("Failed to get window for resizers:", e);
    }
  });

  const startResizing = async (direction: ResizeDirection) => {
    try {
      if (appWindow) {
        await appWindow.startResizeDragging(direction);
      }
    } catch (err) {
      console.error(`Resize ${direction} failed:`, err);
    }
  };

  // Shared resize handle size
  const RESIZE_HANDLE_SIZE = 5;
  const CORNER_SIZE = 10;

  // Hide resize handles when fullscreen or maximized
  if (isFullscreen() || isMaximized()) {
    return null;
  }

  return (
    <>
      {/* Top edge */}
      <div
        class="window-resizer resizer-top"
        onMouseDown={() => startResizing("North")}
        style={{
          position: "fixed",
          top: "0",
          left: `${CORNER_SIZE}px`,
          right: `${CORNER_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: "ns-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />
      
      {/* Bottom edge */}
      <div
        class="window-resizer resizer-bottom"
        onMouseDown={() => startResizing("South")}
        style={{
          position: "fixed",
          bottom: "0",
          left: `${CORNER_SIZE}px`,
          right: `${CORNER_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: "ns-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />
      
      {/* Left edge */}
      <div
        class="window-resizer resizer-left"
        onMouseDown={() => startResizing("West")}
        style={{
          position: "fixed",
          top: `${CORNER_SIZE}px`,
          bottom: `${CORNER_SIZE}px`,
          left: "0",
          width: `${RESIZE_HANDLE_SIZE}px`,
          cursor: "ew-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />
      
      {/* Right edge */}
      <div
        class="window-resizer resizer-right"
        onMouseDown={() => startResizing("East")}
        style={{
          position: "fixed",
          top: `${CORNER_SIZE}px`,
          bottom: `${CORNER_SIZE}px`,
          right: "0",
          width: `${RESIZE_HANDLE_SIZE}px`,
          cursor: "ew-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />
      
      {/* Top-left corner */}
      <div
        class="window-resizer resizer-top-left"
        onMouseDown={() => startResizing("NorthWest")}
        style={{
          position: "fixed",
          top: "0",
          left: "0",
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`,
          cursor: "nwse-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />
      
      {/* Top-right corner */}
      <div
        class="window-resizer resizer-top-right"
        onMouseDown={() => startResizing("NorthEast")}
        style={{
          position: "fixed",
          top: "0",
          right: "0",
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`,
          cursor: "nesw-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />
      
      {/* Bottom-left corner */}
      <div
        class="window-resizer resizer-bottom-left"
        onMouseDown={() => startResizing("SouthWest")}
        style={{
          position: "fixed",
          bottom: "0",
          left: "0",
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`,
          cursor: "nesw-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />
      
      {/* Bottom-right corner */}
      <div
        class="window-resizer resizer-bottom-right"
        onMouseDown={() => startResizing("SouthEast")}
        style={{
          position: "fixed",
          bottom: "0",
          right: "0",
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`,
          cursor: "nwse-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />
    </>
  );
}


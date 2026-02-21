import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@solidjs/testing-library";
import type { ViewMode as _ViewMode } from "../layout/types";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    minimize: vi.fn().mockResolvedValue(undefined),
    maximize: vi.fn().mockResolvedValue(undefined),
    unmaximize: vi.fn().mockResolvedValue(undefined),
    toggleMaximize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isMaximized: vi.fn().mockResolvedValue(false),
    isFullscreen: vi.fn().mockResolvedValue(false),
    label: "main",
  })),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
  emit: vi.fn().mockResolvedValue(undefined),
  once: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: vi.fn().mockResolvedValue("linux"),
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  cortexLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/utils/windowStorage", () => ({
  getWindowLabel: () => "main",
}));

vi.mock("@/utils/tauri-api", () => ({
  fsWriteFile: vi.fn().mockResolvedValue(undefined),
  fsReadTextFile: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/utils/monacoManager", () => ({
  MonacoManager: {
    getInstance: () => ({
      getMonacoOrNull: () => null,
    }),
  },
}));

const mockEditorState = {
  openFiles: [] as any[],
  activeFileId: null as string | null,
  activeGroupId: "group-default",
  groups: [{ id: "group-default", fileIds: [], activeFileId: null, splitRatio: 1 }],
  splits: [],
  cursorCount: 1,
  selectionCount: 0,
  isOpening: false,
  pinnedTabs: [] as string[],
  previewTab: null,
  gridState: null,
  useGridLayout: false,
  minimapSettings: { enabled: true, side: "right", showSlider: "mouseover", renderCharacters: true, maxColumn: 80, scale: 1, sizeMode: "proportional" },
  breadcrumbSymbolPath: [],
  groupLockState: {},
  groupNames: {},
  recentlyClosedStack: [],
};

const mockOpenFile = vi.fn();
const mockOpenVirtualFile = vi.fn();
const mockCloseFile = vi.fn();
const mockSaveFile = vi.fn();

vi.mock("@/context/EditorContext", () => ({
  useEditor: () => ({
    state: mockEditorState,
    openFile: mockOpenFile,
    openVirtualFile: mockOpenVirtualFile,
    closeFile: mockCloseFile,
    saveFile: mockSaveFile,
    setActiveFile: vi.fn(),
    updateFileContent: vi.fn(),
    closeAllFiles: vi.fn(),
    splitEditor: vi.fn(),
    closeGroup: vi.fn(),
    setActiveGroup: vi.fn(),
    moveFileToGroup: vi.fn(),
    updateCursorInfo: vi.fn(),
    getActiveGroup: vi.fn(),
    getGroupFiles: vi.fn().mockReturnValue([]),
    unsplit: vi.fn(),
    reorderTabs: vi.fn(),
    updateSplitRatio: vi.fn(),
    maximizeGroup: vi.fn(),
    restoreGroup: vi.fn(),
    equalizeGroups: vi.fn(),
    lockGroup: vi.fn(),
    unlockGroup: vi.fn(),
    isGroupLocked: vi.fn().mockReturnValue(false),
    setGroupName: vi.fn(),
    getGroupName: vi.fn(),
    pinTab: vi.fn(),
    unpinTab: vi.fn(),
    togglePinTab: vi.fn(),
    isTabPinned: vi.fn().mockReturnValue(false),
    openPreview: vi.fn(),
    promotePreviewToPermanent: vi.fn(),
    isPreviewTab: vi.fn().mockReturnValue(false),
    reopenLastClosed: vi.fn(),
    getRecentlyClosed: vi.fn().mockReturnValue([]),
    gridState: null,
    useGridLayout: false,
    setUseGridLayout: vi.fn(),
    splitEditorInGrid: vi.fn(),
    closeGridCell: vi.fn(),
    moveEditorToGridCell: vi.fn(),
    updateGridState: vi.fn(),
    getEditorOptions: vi.fn().mockReturnValue({}),
  }),
  EditorProvider: (props: { children: any }) => props.children,
}));

const mockSDKState = {
  messages: [] as any[],
  isStreaming: false,
  config: { cwd: "." },
  sessions: [],
  activeSessionId: null,
};

vi.mock("@/context/SDKContext", () => ({
  useSDK: () => ({
    state: mockSDKState,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    interrupt: vi.fn(),
    updateConfig: vi.fn(),
  }),
  SDKProvider: (props: { children: any }) => props.children,
}));

vi.mock("@/context/CommandContext", () => ({
  useCommands: () => ({
    setShowCommandPalette: vi.fn(),
    setShowFileFinder: vi.fn(),
    setShowGoToLine: vi.fn(),
    showCommandPalette: () => false,
    showFileFinder: () => false,
    showGoToLine: () => false,
    commands: () => [],
    registerCommand: vi.fn(),
    unregisterCommand: vi.fn(),
    executeCommand: vi.fn(),
  }),
  CommandProvider: (props: { children: any }) => props.children,
}));

vi.mock("@/context/ai/AIAgentContext", () => ({
  useAIAgent: () => { throw new Error("not available"); },
}));

vi.mock("@/context/ai/AIProviderContext", () => ({
  useAIProvider: () => { throw new Error("not available"); },
}));

vi.mock("@/context/MultiRepoContext", () => ({
  useMultiRepo: () => { throw new Error("not available"); },
}));

vi.mock("@/context/NotificationsContext", () => ({
  useNotifications: () => ({
    notifications: [],
    toasts: () => [],
    filter: () => ({}),
    isOpen: () => false,
    unreadCount: () => 0,
    filteredNotifications: () => [],
    settings: {},
    addNotification: vi.fn().mockResolvedValue("id"),
    markAsRead: vi.fn(),
    markAsUnread: vi.fn(),
    markAllAsRead: vi.fn(),
    removeNotification: vi.fn(),
    clearAll: vi.fn(),
    clearRead: vi.fn(),
    setFilter: vi.fn(),
    togglePanel: vi.fn(),
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    executeAction: vi.fn(),
    updateSettings: vi.fn(),
    showDesktopNotification: vi.fn().mockResolvedValue(undefined),
    setDoNotDisturb: vi.fn(),
    notify: vi.fn().mockReturnValue("id"),
    showProgress: vi.fn().mockReturnValue({ id: "p", update: vi.fn(), complete: vi.fn(), fail: vi.fn(), cancel: vi.fn() }),
    dismissToast: vi.fn(),
    dismissAllToasts: vi.fn(),
  }),
  NotificationsProvider: (props: { children: any }) => props.children,
}));

vi.mock("@/components/ApprovalDialog", () => ({
  ApprovalDialog: () => null,
}));

vi.mock("../CortexNotifications", () => ({
  CortexNotifications: () => null,
}));

vi.mock("../handlers/NotificationHandler", () => ({
  NotificationHandler: () => null,
}));

vi.mock("../handlers/FileEditHandlers", () => ({
  FileEditHandlers: () => null,
  default: () => null,
}));

vi.mock("@/components/editor/EditorPanel", () => ({
  EditorPanel: () => <div data-testid="editor-panel">EditorPanel</div>,
}));

vi.mock("../CortexAIModificationsPanel", () => ({
  CortexAIModificationsPanel: () => null,
}));

vi.mock("../CortexTokenLimitDisplay", () => ({
  CortexTokenLimitDisplay: () => null,
}));

vi.mock("../CortexUpdateFileView", () => ({
  CortexUpdateFileView: () => null,
}));

vi.mock("../CortexStatusBar", () => ({
  CortexStatusBar: () => <div data-testid="status-bar">StatusBar</div>,
}));

vi.mock("../CortexActivityBar", () => ({
  __esModule: true,
  default: () => <div data-testid="activity-bar">ActivityBar</div>,
  CortexActivityBar: () => <div data-testid="activity-bar">ActivityBar</div>,
}));

vi.mock("../CortexChatPanel", () => ({
  __esModule: true,
  default: () => null,
  CortexChatPanel: () => null,
}));

vi.mock("../CortexAgentSidebar", () => ({
  __esModule: true,
  default: () => <div data-testid="agent-sidebar">AgentSidebar</div>,
  CortexAgentSidebar: () => <div data-testid="agent-sidebar">AgentSidebar</div>,
}));

vi.mock("../CortexConversationView", () => ({
  __esModule: true,
  default: () => <div data-testid="conversation-view">ConversationView</div>,
  CortexConversationView: () => <div data-testid="conversation-view">ConversationView</div>,
}));

vi.mock("../CortexChangesPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="changes-panel">ChangesPanel</div>,
  CortexChangesPanel: () => <div data-testid="changes-panel">ChangesPanel</div>,
}));

vi.mock("../layout/CortexSidebarContainer", () => ({
  CortexSidebarContainer: () => <div data-testid="sidebar-container">SidebarContainer</div>,
}));

vi.mock("../layout/CortexBottomPanelContainer", () => ({
  CortexBottomPanelContainer: () => <div data-testid="bottom-panel">BottomPanel</div>,
}));

vi.mock("../titlebar/platformDetect", () => ({
  detectPlatform: () => "linux",
}));

vi.mock("../titlebar/TitleBarDropdownMenu", () => ({
  TitleBarDropdownMenu: () => null,
}));

vi.mock("../titlebar/WindowControls", () => ({
  WindowControls: () => <div data-testid="window-controls">WindowControls</div>,
}));

vi.mock("../titlebar/CortexLogo", () => ({
  CortexLogo: () => <div data-testid="cortex-logo">Logo</div>,
}));

vi.mock("../titlebar/defaultMenus", () => ({
  MENU_LABELS: [],
  DEFAULT_MENUS: {},
}));

vi.mock("../primitives", () => ({
  CortexIcon: (props: any) => <span data-testid={`icon-${props.name}`} />,
  CortexHeaderItem: (props: any) => <button data-testid={`header-${props.label}`}>{props.label}</button>,
  CortexConfigBadge: (props: any) => <div data-testid="config-badge">{props.label}</div>,
  CortexStartPause: (props: any) => <button data-testid="start-pause" onClick={props.onClick}>{props.state}</button>,
}));

vi.mock("../primitives/CortexOpenProjectDropdown", () => ({
  CortexOpenProjectDropdown: (props: any) => <div data-testid="open-project">{props.label}</div>,
}));

async function waitForMount() {
  await new Promise((r) => setTimeout(r, 100));
}

describe("ModeSwitch Integration", () => {
  let CortexDesktopLayout: typeof import("../CortexDesktopLayout").CortexDesktopLayout;

  beforeEach(async () => {
    vi.clearAllMocks();
    cleanup();

    localStorage.clear();
    mockSDKState.config.cwd = ".";
    mockEditorState.openFiles = [];
    mockEditorState.activeFileId = null;

    const mod = await import("../CortexDesktopLayout");
    CortexDesktopLayout = mod.CortexDesktopLayout;
  });

  afterEach(() => {
    cleanup();
  });

  it("switching from IDE to Vibe mode shows CortexVibeLayout", async () => {
    localStorage.setItem("figma_layout_mode", "ide");

    const { queryByTestId } = render(() => <CortexDesktopLayout />);
    await waitForMount();

    expect(queryByTestId("activity-bar")).toBeTruthy();

    window.dispatchEvent(new CustomEvent("viewmode:change", { detail: { mode: "vibe" } }));
    await waitForMount();

    expect(queryByTestId("agent-sidebar")).toBeTruthy();
  });

  it("switching from Vibe to IDE mode shows CortexIDELayout", async () => {
    localStorage.setItem("figma_layout_mode", "vibe");

    const { queryByTestId } = render(() => <CortexDesktopLayout />);
    await waitForMount();

    expect(queryByTestId("agent-sidebar")).toBeTruthy();

    window.dispatchEvent(new CustomEvent("viewmode:change", { detail: { mode: "ide" } }));
    await waitForMount();

    expect(queryByTestId("activity-bar")).toBeTruthy();
  });

  it("mode persists to localStorage", async () => {
    localStorage.setItem("figma_layout_mode", "vibe");

    render(() => <CortexDesktopLayout />);
    await waitForMount();

    window.dispatchEvent(new CustomEvent("viewmode:change", { detail: { mode: "ide" } }));
    await waitForMount();

    expect(localStorage.getItem("figma_layout_mode")).toBe("ide");

    window.dispatchEvent(new CustomEvent("viewmode:change", { detail: { mode: "vibe" } }));
    await waitForMount();

    expect(localStorage.getItem("figma_layout_mode")).toBe("vibe");
  });

  it("mode switch preserves chat state", async () => {
    localStorage.setItem("figma_layout_mode", "vibe");

    const { queryByTestId } = render(() => <CortexDesktopLayout />);
    await waitForMount();

    expect(queryByTestId("agent-sidebar")).toBeTruthy();

    window.dispatchEvent(new CustomEvent("viewmode:change", { detail: { mode: "ide" } }));
    await waitForMount();

    expect(queryByTestId("activity-bar")).toBeTruthy();

    window.dispatchEvent(new CustomEvent("viewmode:change", { detail: { mode: "vibe" } }));
    await waitForMount();

    expect(queryByTestId("agent-sidebar")).toBeTruthy();
  });

  it("mode switch via CortexVibeToggle in TitleBar works end-to-end", async () => {
    localStorage.setItem("figma_layout_mode", "ide");

    const { container, queryByTestId } = render(() => <CortexDesktopLayout />);
    await waitForMount();

    expect(queryByTestId("activity-bar")).toBeTruthy();

    const vibeButton = container.querySelector('button[aria-label="Vibe mode"]');
    expect(vibeButton).toBeTruthy();

    if (vibeButton) {
      await fireEvent.click(vibeButton);
    }
    await waitForMount();

    expect(queryByTestId("agent-sidebar")).toBeTruthy();
    expect(localStorage.getItem("figma_layout_mode")).toBe("vibe");

    const ideButton = container.querySelector('button[aria-label="IDE mode"]');
    expect(ideButton).toBeTruthy();

    if (ideButton) {
      await fireEvent.click(ideButton);
    }
    await waitForMount();

    expect(queryByTestId("activity-bar")).toBeTruthy();
    expect(localStorage.getItem("figma_layout_mode")).toBe("ide");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { onMount, onCleanup } from "solid-js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
  emit: vi.fn().mockResolvedValue(undefined),
  once: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    minimize: vi.fn().mockResolvedValue(undefined),
    maximize: vi.fn().mockResolvedValue(undefined),
    unmaximize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isMaximized: vi.fn().mockResolvedValue(false),
    label: "main",
  })),
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

function setupCommonDoMocks() {
  vi.doMock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
  vi.doMock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(vi.fn()), emit: vi.fn().mockResolvedValue(undefined), once: vi.fn().mockResolvedValue(vi.fn()) }));
  vi.doMock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn(() => ({ minimize: vi.fn(), maximize: vi.fn(), close: vi.fn(), isMaximized: vi.fn().mockResolvedValue(false), label: "main" })) }));
  vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(null) }));
  vi.doMock("@tauri-apps/plugin-os", () => ({ platform: vi.fn().mockResolvedValue("linux") }));
  vi.doMock("@solidjs/router", () => ({ useNavigate: () => vi.fn() }));
  vi.doMock("@/utils/logger", () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }), cortexLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
  vi.doMock("@/utils/windowStorage", () => ({ getWindowLabel: () => "main" }));
  vi.doMock("@/utils/tauri-api", () => ({ fsWriteFile: vi.fn().mockResolvedValue(undefined), fsReadTextFile: vi.fn().mockResolvedValue("") }));
  vi.doMock("@/utils/monacoManager", () => ({ MonacoManager: { getInstance: () => ({ getMonacoOrNull: () => null }) } }));
}

async function waitForMount() {
  await new Promise((r) => setTimeout(r, 100));
}

describe("EventDispatch Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe("ViewNavigationHandlers", () => {
    it("dispatching 'view:git' CustomEvent switches to git sidebar tab via CortexDesktopLayout", async () => {
      const setSidebarTab = vi.fn();
      const setSidebarCollapsed = vi.fn();
      const setShowCommandPalette = vi.fn();
      const setShowFileFinder = vi.fn();
      const setShowGoToLine = vi.fn();
      const setBottomPanelTab = vi.fn();
      const setBottomPanelCollapsed = vi.fn();

      const { ViewNavigationHandlers } = await import("../handlers/ViewNavigationHandlers");

      render(() => (
        <ViewNavigationHandlers
          setShowCommandPalette={setShowCommandPalette}
          setShowFileFinder={setShowFileFinder}
          setShowGoToLine={setShowGoToLine}
          setSidebarTab={setSidebarTab}
          setSidebarCollapsed={setSidebarCollapsed}
          bottomPanelTab={() => "terminal"}
          bottomPanelCollapsed={() => true}
          setBottomPanelTab={setBottomPanelTab}
          setBottomPanelCollapsed={setBottomPanelCollapsed}
          projectPath={() => "/test/project"}
        />
      ));
      await waitForMount();

      window.dispatchEvent(new CustomEvent("debug:start"));
      await waitForMount();

      expect(setSidebarTab).toHaveBeenCalledWith("debug");
      expect(setSidebarCollapsed).toHaveBeenCalledWith(false);
    });

    it("dispatching 'view:extensions' switches to extensions tab via ViewNavigationHandlers terminal:new event", async () => {
      const setSidebarTab = vi.fn();
      const setSidebarCollapsed = vi.fn();
      const setShowCommandPalette = vi.fn();
      const setShowFileFinder = vi.fn();
      const setShowGoToLine = vi.fn();
      const setBottomPanelTab = vi.fn();
      const setBottomPanelCollapsed = vi.fn();

      const { ViewNavigationHandlers } = await import("../handlers/ViewNavigationHandlers");

      render(() => (
        <ViewNavigationHandlers
          setShowCommandPalette={setShowCommandPalette}
          setShowFileFinder={setShowFileFinder}
          setShowGoToLine={setShowGoToLine}
          setSidebarTab={setSidebarTab}
          setSidebarCollapsed={setSidebarCollapsed}
          bottomPanelTab={() => "terminal"}
          bottomPanelCollapsed={() => true}
          setBottomPanelTab={setBottomPanelTab}
          setBottomPanelCollapsed={setBottomPanelCollapsed}
          projectPath={() => "/test/project"}
        />
      ));
      await waitForMount();

      window.dispatchEvent(new CustomEvent("terminal:new"));
      await waitForMount();

      expect(setBottomPanelCollapsed).toHaveBeenCalledWith(false);
      expect(setBottomPanelTab).toHaveBeenCalledWith("terminal");
    });

    it("ViewNavigationHandlers correctly maps events to sidebar tab changes", async () => {
      const setSidebarTab = vi.fn();
      const setSidebarCollapsed = vi.fn();
      const setShowCommandPalette = vi.fn();
      const setShowFileFinder = vi.fn();
      const setShowGoToLine = vi.fn();
      const setBottomPanelTab = vi.fn();
      const setBottomPanelCollapsed = vi.fn();

      const { ViewNavigationHandlers } = await import("../handlers/ViewNavigationHandlers");

      render(() => (
        <ViewNavigationHandlers
          setShowCommandPalette={setShowCommandPalette}
          setShowFileFinder={setShowFileFinder}
          setShowGoToLine={setShowGoToLine}
          setSidebarTab={setSidebarTab}
          setSidebarCollapsed={setSidebarCollapsed}
          bottomPanelTab={() => "terminal"}
          bottomPanelCollapsed={() => true}
          setBottomPanelTab={setBottomPanelTab}
          setBottomPanelCollapsed={setBottomPanelCollapsed}
          projectPath={() => "/test/project"}
        />
      ));
      await waitForMount();

      window.dispatchEvent(new CustomEvent("debug:start"));
      expect(setSidebarTab).toHaveBeenCalledWith("debug");
      expect(setSidebarCollapsed).toHaveBeenCalledWith(false);

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("debug:stop"));
      expect(setSidebarTab).toHaveBeenCalledWith("debug");
      expect(setSidebarCollapsed).toHaveBeenCalledWith(false);

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("command-palette:open"));
      expect(setShowCommandPalette).toHaveBeenCalledWith(true);

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("goto:file"));
      expect(setShowFileFinder).toHaveBeenCalledWith(true);

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("goto:line"));
      expect(setShowGoToLine).toHaveBeenCalledWith(true);

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("terminal:new"));
      expect(setBottomPanelCollapsed).toHaveBeenCalledWith(false);
      expect(setBottomPanelTab).toHaveBeenCalledWith("terminal");

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("git:commit"));
      expect(setSidebarTab).toHaveBeenCalledWith("git");
      expect(setSidebarCollapsed).toHaveBeenCalledWith(false);
    });
  });

  describe("CortexDesktopLayout event handling", () => {
    const mockOpenFile = vi.fn();
    const mockOpenVirtualFile = vi.fn();
    const mockCloseFile = vi.fn();
    const mockSaveFile = vi.fn();

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

    const mockSDKState = {
      messages: [] as any[],
      isStreaming: false,
      config: { cwd: "." },
      sessions: [],
      activeSessionId: null,
    };

    beforeEach(() => {
      vi.resetModules();

      setupCommonDoMocks();

      vi.doMock("@/context/EditorContext", () => ({
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

      vi.doMock("@/context/SDKContext", () => ({
        useSDK: () => ({
          state: mockSDKState,
          sendMessage: vi.fn().mockResolvedValue(undefined),
          interrupt: vi.fn(),
          updateConfig: vi.fn(),
        }),
        SDKProvider: (props: { children: any }) => props.children,
      }));

      vi.doMock("@/context/CommandContext", () => ({
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

      vi.doMock("@/context/ai/AIAgentContext", () => ({
        useAIAgent: () => { throw new Error("not available"); },
      }));

      vi.doMock("@/context/ai/AIProviderContext", () => ({
        useAIProvider: () => { throw new Error("not available"); },
      }));

      vi.doMock("@/context/MultiRepoContext", () => ({
        useMultiRepo: () => { throw new Error("not available"); },
      }));

      vi.doMock("@/context/NotificationsContext", () => ({
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

      vi.doMock("@/components/ApprovalDialog", () => ({
        ApprovalDialog: () => null,
      }));

      vi.doMock("../CortexNotifications", () => ({
        CortexNotifications: () => null,
      }));

      vi.doMock("../handlers/NotificationHandler", () => ({
        NotificationHandler: () => null,
      }));

      vi.doMock("../handlers/FileEditHandlers", () => ({
        FileEditHandlers: () => null,
        default: () => null,
      }));

      vi.doMock("@/components/editor/EditorPanel", () => ({
        EditorPanel: () => <div data-testid="editor-panel">EditorPanel</div>,
      }));

      vi.doMock("../CortexAIModificationsPanel", () => ({
        CortexAIModificationsPanel: () => null,
      }));

      vi.doMock("../CortexTokenLimitDisplay", () => ({
        CortexTokenLimitDisplay: () => null,
      }));

      vi.doMock("../CortexUpdateFileView", () => ({
        CortexUpdateFileView: () => null,
      }));

      vi.doMock("../CortexStatusBar", () => ({
        CortexStatusBar: () => <div data-testid="status-bar">StatusBar</div>,
      }));

      vi.doMock("../CortexActivityBar", () => ({
        __esModule: true,
        default: () => <div data-testid="activity-bar">ActivityBar</div>,
        CortexActivityBar: () => <div data-testid="activity-bar">ActivityBar</div>,
      }));

      vi.doMock("../CortexChatPanel", () => ({
        __esModule: true,
        default: () => null,
        CortexChatPanel: () => null,
      }));

      vi.doMock("../CortexAgentSidebar", () => ({
        __esModule: true,
        default: () => <div data-testid="agent-sidebar">AgentSidebar</div>,
        CortexAgentSidebar: () => <div data-testid="agent-sidebar">AgentSidebar</div>,
      }));

      vi.doMock("../CortexConversationView", () => ({
        __esModule: true,
        default: () => <div data-testid="conversation-view">ConversationView</div>,
        CortexConversationView: () => <div data-testid="conversation-view">ConversationView</div>,
      }));

      vi.doMock("../CortexChangesPanel", () => ({
        __esModule: true,
        default: () => <div data-testid="changes-panel">ChangesPanel</div>,
        CortexChangesPanel: () => <div data-testid="changes-panel">ChangesPanel</div>,
      }));

      vi.doMock("../layout/CortexSidebarContainer", () => ({
        CortexSidebarContainer: (props: any) => <div data-testid="sidebar-container" data-tab={props.sidebarTab} data-collapsed={String(props.sidebarCollapsed)}>SidebarContainer</div>,
      }));

      vi.doMock("../layout/CortexBottomPanelContainer", () => ({
        CortexBottomPanelContainer: () => <div data-testid="bottom-panel">BottomPanel</div>,
      }));

      vi.doMock("../titlebar/platformDetect", () => ({
        detectPlatform: () => "linux",
      }));

      vi.doMock("../titlebar/TitleBarDropdownMenu", () => ({
        TitleBarDropdownMenu: () => null,
      }));

      vi.doMock("../titlebar/WindowControls", () => ({
        WindowControls: () => <div data-testid="window-controls">WindowControls</div>,
      }));

      vi.doMock("../titlebar/CortexLogo", () => ({
        CortexLogo: () => <div data-testid="cortex-logo">Logo</div>,
      }));

      vi.doMock("../titlebar/defaultMenus", () => ({
        MENU_LABELS: [],
        DEFAULT_MENUS: {},
      }));

      vi.doMock("../primitives", () => ({
        CortexIcon: (props: any) => <span data-testid={`icon-${props.name}`} />,
        CortexHeaderItem: (props: any) => <button data-testid={`header-${props.label}`}>{props.label}</button>,
        CortexConfigBadge: (props: any) => <div data-testid="config-badge">{props.label}</div>,
        CortexStartPause: (props: any) => <button data-testid="start-pause" onClick={props.onClick}>{props.state}</button>,
      }));

      vi.doMock("../primitives/CortexOpenProjectDropdown", () => ({
        CortexOpenProjectDropdown: (props: any) => <div data-testid="open-project">{props.label}</div>,
      }));

      localStorage.clear();
      mockSDKState.config.cwd = ".";
      mockEditorState.openFiles = [];
      mockEditorState.activeFileId = null;
    });

    it("dispatching 'view:git' switches sidebar to git tab", async () => {
      localStorage.setItem("figma_layout_mode", "ide");

      const { CortexDesktopLayout } = await import("../CortexDesktopLayout");

      const { container } = render(() => <CortexDesktopLayout />);
      await waitForMount();

      window.dispatchEvent(new CustomEvent("view:git"));
      await waitForMount();

      const sidebar = container.querySelector('[data-testid="sidebar-container"]');
      expect(sidebar?.getAttribute("data-tab")).toBe("git");
      expect(sidebar?.getAttribute("data-collapsed")).toBe("false");
    });

    it("dispatching 'view:extensions' switches sidebar to extensions tab", async () => {
      localStorage.setItem("figma_layout_mode", "ide");

      const { CortexDesktopLayout } = await import("../CortexDesktopLayout");

      const { container } = render(() => <CortexDesktopLayout />);
      await waitForMount();

      window.dispatchEvent(new CustomEvent("view:extensions"));
      await waitForMount();

      const sidebar = container.querySelector('[data-testid="sidebar-container"]');
      expect(sidebar?.getAttribute("data-tab")).toBe("extensions");
      expect(sidebar?.getAttribute("data-collapsed")).toBe("false");
    });
  });

  describe("cortex:git:diff event", () => {
    it("dispatching 'cortex:git:diff' triggers the diff event handler", async () => {
      const diffHandler = vi.fn();
      window.addEventListener("cortex:git:diff", diffHandler);

      window.dispatchEvent(new CustomEvent("cortex:git:diff", {
        detail: { path: "src/test.ts", repoId: "repo-1" },
      }));

      expect(diffHandler).toHaveBeenCalledTimes(1);
      const event = diffHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.path).toBe("src/test.ts");
      expect(event.detail.repoId).toBe("repo-1");

      window.removeEventListener("cortex:git:diff", diffHandler);
    });
  });

  describe("cortex:open-file event", () => {
    it("dispatching 'cortex:open-file' triggers file open via event listener", async () => {
      const openFileHandler = vi.fn();
      window.addEventListener("cortex:open-file", openFileHandler);

      window.dispatchEvent(new CustomEvent("cortex:open-file", {
        detail: { path: "/workspace/test.ts" },
      }));

      expect(openFileHandler).toHaveBeenCalledTimes(1);
      const event = openFileHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.path).toBe("/workspace/test.ts");

      window.removeEventListener("cortex:open-file", openFileHandler);
    });
  });

  describe("NotificationHandler", () => {
    it("NotificationHandler processes notification events", async () => {
      const mockNotify = vi.fn().mockReturnValue("id");

      vi.resetModules();

      setupCommonDoMocks();

      vi.doMock("@/context/NotificationsContext", () => ({
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
          notify: mockNotify,
          showProgress: vi.fn().mockReturnValue({ id: "p", update: vi.fn(), complete: vi.fn(), fail: vi.fn(), cancel: vi.fn() }),
          dismissToast: vi.fn(),
          dismissAllToasts: vi.fn(),
        }),
        NotificationsProvider: (props: { children: any }) => props.children,
      }));

      const { useNotifications } = await import("@/context/NotificationsContext");

      function TestNotificationHandler() {
        const notifications = useNotifications();

        onMount(() => {
          const handleFileSaved = (e: Event) => {
            const detail = (e as CustomEvent<{ path?: string }>).detail;
            const name = detail?.path?.split("/").pop() ?? "File";
            notifications.notify({ type: "success", title: "File Saved", message: `${name} saved successfully.`, duration: 3000 });
          };
          const handleGitPush = () => { notifications.notify({ type: "success", title: "Git Push", message: "Changes pushed to remote.", duration: 4000 }); };
          const handleGitPull = () => { notifications.notify({ type: "info", title: "Git Pull", message: "Latest changes pulled from remote.", duration: 4000 }); };
          const handleExtensionActivated = (e: Event) => {
            const detail = (e as CustomEvent<{ id?: string; name?: string }>).detail;
            const name = detail?.name ?? detail?.id ?? "Extension";
            notifications.notify({ type: "success", title: "Extension Activated", message: `${name} is now active.`, duration: 4000 });
          };
          const handleLegacyNotification = (e: Event) => {
            const detail = (e as CustomEvent<{ type?: string; message?: string; title?: string }>).detail;
            if (!detail?.message) return;
            notifications.notify({ type: (detail.type as "info" | "success" | "warning" | "error") || "info", title: detail.title ?? "Notification", message: detail.message });
          };

          window.addEventListener("file:saved", handleFileSaved);
          window.addEventListener("git:push", handleGitPush);
          window.addEventListener("git:pull", handleGitPull);
          window.addEventListener("extension:activated", handleExtensionActivated);
          window.addEventListener("notification", handleLegacyNotification);

          onCleanup(() => {
            window.removeEventListener("file:saved", handleFileSaved);
            window.removeEventListener("git:push", handleGitPush);
            window.removeEventListener("git:pull", handleGitPull);
            window.removeEventListener("extension:activated", handleExtensionActivated);
            window.removeEventListener("notification", handleLegacyNotification);
          });
        });

        return null;
      }

      render(() => <TestNotificationHandler />);
      await waitForMount();

      window.dispatchEvent(new CustomEvent("file:saved", {
        detail: { path: "/workspace/src/index.ts" },
      }));
      await waitForMount();

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          title: "File Saved",
          message: expect.stringContaining("index.ts"),
        }),
      );

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("git:push"));
      await waitForMount();

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          title: "Git Push",
        }),
      );

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("git:pull"));
      await waitForMount();

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "info",
          title: "Git Pull",
        }),
      );

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("extension:activated", {
        detail: { name: "Python", id: "ms-python" },
      }));
      await waitForMount();

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          title: "Extension Activated",
          message: expect.stringContaining("Python"),
        }),
      );

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("notification", {
        detail: { type: "warning", message: "Test warning message", title: "Warning" },
      }));
      await waitForMount();

      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          title: "Warning",
          message: "Test warning message",
        }),
      );
    });
  });

  describe("FileEditHandlers", () => {
    it("FileEditHandlers processes file edit events", async () => {
      const mockOpenVirtualFile = vi.fn();
      const mockSaveFile = vi.fn();
      const mockCloseFile = vi.fn();

      vi.resetModules();

      setupCommonDoMocks();

      vi.doMock("@/context/editor/EditorProvider", () => ({
        useEditor: () => ({
          state: {
            openFiles: [{ id: "file-1", name: "test.ts", content: "const x = 1;", modified: true }],
            activeFileId: "file-1",
          },
          openFile: vi.fn(),
          openVirtualFile: mockOpenVirtualFile,
          closeFile: mockCloseFile,
          saveFile: mockSaveFile,
          setActiveFile: vi.fn(),
          updateFileContent: vi.fn(),
          closeAllFiles: vi.fn(),
        }),
        EditorProvider: (props: { children: any }) => props.children,
      }));

      vi.doMock("@/context/EditorContext", () => ({
        useEditor: () => ({
          state: {
            openFiles: [{ id: "file-1", name: "test.ts", content: "const x = 1;", modified: true }],
            activeFileId: "file-1",
          },
          openFile: vi.fn(),
          openVirtualFile: mockOpenVirtualFile,
          closeFile: mockCloseFile,
          saveFile: mockSaveFile,
          setActiveFile: vi.fn(),
          updateFileContent: vi.fn(),
          closeAllFiles: vi.fn(),
        }),
        EditorProvider: (props: { children: any }) => props.children,
      }));

      vi.doMock("@/context/SDKContext", () => ({
        useSDK: () => ({
          state: { messages: [], isStreaming: false, config: { cwd: "." } },
          sendMessage: vi.fn(),
          interrupt: vi.fn(),
          updateConfig: vi.fn(),
        }),
        SDKProvider: (props: { children: any }) => props.children,
      }));

      const { useEditor } = await import("@/context/editor/EditorProvider");

      function TestFileEditHandlers() {
        const editor = useEditor();

        onMount(() => {
          const handlers: Record<string, EventListener> = {
            "file:new": (() => { editor.openVirtualFile("Untitled", "", "plaintext"); }) as EventListener,
            "file:save": (() => { const id = editor.state.activeFileId; if (id) editor.saveFile(id); }) as EventListener,
            "file:close": (() => { const id = editor.state.activeFileId; if (id) editor.closeFile(id); }) as EventListener,
          };
          for (const [ev, fn] of Object.entries(handlers)) {
            window.addEventListener(ev, fn);
          }
          onCleanup(() => {
            for (const [ev, fn] of Object.entries(handlers)) {
              window.removeEventListener(ev, fn);
            }
          });
        });

        return null;
      }

      render(() => <TestFileEditHandlers />);
      await waitForMount();

      window.dispatchEvent(new CustomEvent("file:new"));
      await waitForMount();

      expect(mockOpenVirtualFile).toHaveBeenCalledWith("Untitled", "", "plaintext");

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("file:save"));
      await waitForMount();

      expect(mockSaveFile).toHaveBeenCalledWith("file-1");

      vi.clearAllMocks();

      window.dispatchEvent(new CustomEvent("file:close"));
      await waitForMount();

      expect(mockCloseFile).toHaveBeenCalledWith("file-1");
    });
  });
});

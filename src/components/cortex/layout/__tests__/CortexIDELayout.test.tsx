import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import type { CortexIDELayoutProps } from "../CortexIDELayout";

let capturedActivityBarProps: Record<string, unknown> = {};
let capturedSidebarProps: Record<string, unknown> = {};
let capturedBottomPanelProps: Record<string, unknown> = {};
let capturedStatusBarProps: Record<string, unknown> = {};
let capturedChatPanelProps: Record<string, unknown> = {};

vi.mock("@/components/cortex/CortexActivityBar", () => ({
  default: (props: Record<string, unknown>) => {
    capturedActivityBarProps = props;
    return <div data-testid="activity-bar" />;
  },
  CortexActivityBar: (props: Record<string, unknown>) => {
    capturedActivityBarProps = props;
    return <div data-testid="activity-bar" />;
  },
}));

vi.mock("@/components/cortex/CortexChatPanel", () => ({
  default: (props: Record<string, unknown>) => {
    capturedChatPanelProps = props;
    return <div data-testid="chat-panel" />;
  },
  CortexChatPanel: (props: Record<string, unknown>) => {
    capturedChatPanelProps = props;
    return <div data-testid="chat-panel" />;
  },
}));

vi.mock("@/components/cortex/CortexStatusBar", () => ({
  CortexStatusBar: (props: Record<string, unknown>) => {
    capturedStatusBarProps = props;
    return <div data-testid="status-bar" />;
  },
}));

vi.mock("../CortexSidebarContainer", () => ({
  CortexSidebarContainer: (props: Record<string, unknown>) => {
    capturedSidebarProps = props;
    return <div data-testid="sidebar-container" />;
  },
}));

vi.mock("../CortexBottomPanelContainer", () => ({
  CortexBottomPanelContainer: (props: Record<string, unknown>) => {
    capturedBottomPanelProps = props;
    return <div data-testid="bottom-panel-container" />;
  },
}));

vi.mock("@/components/editor/EditorPanel", () => ({
  EditorPanel: () => <div data-testid="editor-panel" />,
}));

function createDefaultProps(overrides: Partial<CortexIDELayoutProps> = {}): CortexIDELayoutProps {
  return {
    sidebarTab: "files",
    sidebarCollapsed: false,
    sidebarWidth: 320,
    isResizing: false,
    projectPath: "/test/project",
    bottomPanelTab: "terminal",
    bottomPanelCollapsed: false,
    bottomPanelHeight: 200,
    chatState: "home",
    chatMessages: [],
    chatInput: "",
    isProcessing: false,
    modelName: "claude-4",
    onNavItemClick: vi.fn(),
    onAvatarClick: vi.fn(),
    onFileSelect: vi.fn(),
    onSidebarWidthChange: vi.fn(),
    onResizingChange: vi.fn(),
    onBottomPanelTabChange: vi.fn(),
    onBottomPanelCollapse: vi.fn(),
    onBottomPanelHeightChange: vi.fn(),
    onChatInputChange: vi.fn(),
    onChatSubmit: vi.fn(),
    branchName: "main",
    isSyncing: false,
    hasChanges: true,
    languageName: "TypeScript",
    onBranchClick: vi.fn(),
    onTogglePanel: vi.fn(),
    onToggleTerminal: vi.fn(),
    ...overrides,
  };
}

describe("CortexIDELayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    capturedActivityBarProps = {};
    capturedSidebarProps = {};
    capturedBottomPanelProps = {};
    capturedStatusBarProps = {};
    capturedChatPanelProps = {};
  });

  describe("Rendering", () => {
    it("should render ActivityBar", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps();
      const { container } = render(() => <CortexIDELayout {...props} />);
      expect(container.querySelector('[data-testid="activity-bar"]')).toBeTruthy();
    });

    it("should render SidebarContainer", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps();
      const { container } = render(() => <CortexIDELayout {...props} />);
      expect(container.querySelector('[data-testid="sidebar-container"]')).toBeTruthy();
    });

    it("should render EditorPanel area", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps();
      const { container } = render(() => <CortexIDELayout {...props} />);
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="editor-panel"]')).toBeTruthy();
      });
    });

    it("should render BottomPanelContainer", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps();
      const { container } = render(() => <CortexIDELayout {...props} />);
      expect(container.querySelector('[data-testid="bottom-panel-container"]')).toBeTruthy();
    });

    it("should render StatusBar", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps();
      const { container } = render(() => <CortexIDELayout {...props} />);
      expect(container.querySelector('[data-testid="status-bar"]')).toBeTruthy();
    });

    it("should render all five major sections simultaneously", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps();
      const { container } = render(() => <CortexIDELayout {...props} />);
      expect(container.querySelector('[data-testid="activity-bar"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="sidebar-container"]')).toBeTruthy();
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="editor-panel"]')).toBeTruthy();
      });
      expect(container.querySelector('[data-testid="bottom-panel-container"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="status-bar"]')).toBeTruthy();
    });
  });

  describe("Props Passing — CortexActivityBar", () => {
    it("should pass activeId as sidebarTab when sidebar is not collapsed", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ sidebarTab: "git", sidebarCollapsed: false });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedActivityBarProps.activeId).toBe("git");
    });

    it("should pass activeId as null when sidebar is collapsed", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ sidebarCollapsed: true });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedActivityBarProps.activeId).toBeNull();
    });

    it("should pass onItemClick callback", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onNavItemClick = vi.fn();
      const props = createDefaultProps({ onNavItemClick });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedActivityBarProps.onItemClick).toBe(onNavItemClick);
    });

    it("should pass onAvatarClick callback", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onAvatarClick = vi.fn();
      const props = createDefaultProps({ onAvatarClick });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedActivityBarProps.onAvatarClick).toBe(onAvatarClick);
    });
  });

  describe("Props Passing — CortexSidebarContainer", () => {
    it("should pass sidebarTab", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ sidebarTab: "search" });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedSidebarProps.sidebarTab).toBe("search");
    });

    it("should pass sidebarCollapsed", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ sidebarCollapsed: false });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedSidebarProps.sidebarCollapsed).toBe(false);
    });

    it("should pass sidebarWidth", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ sidebarWidth: 400 });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedSidebarProps.sidebarWidth).toBe(400);
    });

    it("should pass isResizing", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ isResizing: true });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedSidebarProps.isResizing).toBe(true);
    });

    it("should pass projectPath", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ projectPath: "/my/project" });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedSidebarProps.projectPath).toBe("/my/project");
    });

    it("should pass onFileSelect callback", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onFileSelect = vi.fn();
      const props = createDefaultProps({ onFileSelect });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedSidebarProps.onFileSelect).toBe(onFileSelect);
    });

    it("should pass onSidebarWidthChange callback", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onSidebarWidthChange = vi.fn();
      const props = createDefaultProps({ onSidebarWidthChange });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedSidebarProps.onSidebarWidthChange).toBe(onSidebarWidthChange);
    });

    it("should pass onResizingChange callback", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onResizingChange = vi.fn();
      const props = createDefaultProps({ onResizingChange });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedSidebarProps.onResizingChange).toBe(onResizingChange);
    });
  });

  describe("Props Passing — CortexBottomPanelContainer", () => {
    it("should pass bottomPanelTab", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ bottomPanelTab: "output" });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedBottomPanelProps.bottomPanelTab).toBe("output");
    });

    it("should pass bottomPanelCollapsed", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ bottomPanelCollapsed: true });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedBottomPanelProps.bottomPanelCollapsed).toBe(true);
    });

    it("should pass bottomPanelHeight", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ bottomPanelHeight: 300 });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedBottomPanelProps.bottomPanelHeight).toBe(300);
    });

    it("should pass onTabChange mapped from onBottomPanelTabChange", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onBottomPanelTabChange = vi.fn();
      const props = createDefaultProps({ onBottomPanelTabChange });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedBottomPanelProps.onTabChange).toBe(onBottomPanelTabChange);
    });

    it("should pass onCollapse mapped from onBottomPanelCollapse", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onBottomPanelCollapse = vi.fn();
      const props = createDefaultProps({ onBottomPanelCollapse });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedBottomPanelProps.onCollapse).toBe(onBottomPanelCollapse);
    });

    it("should pass onHeightChange mapped from onBottomPanelHeightChange", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onBottomPanelHeightChange = vi.fn();
      const props = createDefaultProps({ onBottomPanelHeightChange });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedBottomPanelProps.onHeightChange).toBe(onBottomPanelHeightChange);
    });
  });

  describe("Props Passing — CortexStatusBar", () => {
    it("should pass branchName", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ branchName: "develop" });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedStatusBarProps.branchName).toBe("develop");
    });

    it("should pass isSyncing", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ isSyncing: true });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedStatusBarProps.isSyncing).toBe(true);
    });

    it("should pass hasChanges", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ hasChanges: true });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedStatusBarProps.hasChanges).toBe(true);
    });

    it("should pass languageName", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ languageName: "Rust" });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedStatusBarProps.languageName).toBe("Rust");
    });

    it("should pass onBranchClick callback", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onBranchClick = vi.fn();
      const props = createDefaultProps({ onBranchClick });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedStatusBarProps.onBranchClick).toBe(onBranchClick);
    });

    it("should pass onTogglePanel callback", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onTogglePanel = vi.fn();
      const props = createDefaultProps({ onTogglePanel });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedStatusBarProps.onTogglePanel).toBe(onTogglePanel);
    });

    it("should pass onToggleTerminal callback", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onToggleTerminal = vi.fn();
      const props = createDefaultProps({ onToggleTerminal });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedStatusBarProps.onToggleTerminal).toBe(onToggleTerminal);
    });
  });

  describe("Sidebar Collapsed State", () => {
    it("should pass null as activeId to ActivityBar when sidebar is collapsed", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ sidebarCollapsed: true, sidebarTab: "files" });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedActivityBarProps.activeId).toBeNull();
    });

    it("should pass sidebarTab as activeId to ActivityBar when sidebar is not collapsed", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ sidebarCollapsed: false, sidebarTab: "extensions" });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedActivityBarProps.activeId).toBe("extensions");
    });

    it("should still pass sidebarCollapsed=true to SidebarContainer", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ sidebarCollapsed: true });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedSidebarProps.sidebarCollapsed).toBe(true);
    });
  });

  describe("Chat Panel State", () => {
    it("should render chat panel when chatState is expanded", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ chatState: "expanded" });
      const { container } = render(() => <CortexIDELayout {...props} />);
      expect(container.querySelector('[data-testid="chat-panel"]')).toBeTruthy();
    });

    it("should not render chat panel when chatState is home", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ chatState: "home" });
      const { container } = render(() => <CortexIDELayout {...props} />);
      expect(container.querySelector('[data-testid="chat-panel"]')).toBeFalsy();
    });

    it("should not render chat panel when chatState is minimized", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ chatState: "minimized" });
      const { container } = render(() => <CortexIDELayout {...props} />);
      expect(container.querySelector('[data-testid="chat-panel"]')).toBeFalsy();
    });

    it("should pass correct props to chat panel when expanded", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const onChatInputChange = vi.fn();
      const onChatSubmit = vi.fn();
      const messages = [{ id: "1", type: "user" as const, content: "Hello" }];
      const props = createDefaultProps({
        chatState: "expanded",
        chatMessages: messages,
        chatInput: "test input",
        isProcessing: true,
        modelName: "gpt-4",
        onChatInputChange,
        onChatSubmit,
      });
      render(() => <CortexIDELayout {...props} />);
      expect(capturedChatPanelProps.state).toBe("expanded");
      expect(capturedChatPanelProps.messages).toBe(messages);
      expect(capturedChatPanelProps.inputValue).toBe("test input");
      expect(capturedChatPanelProps.isProcessing).toBe(true);
      expect(capturedChatPanelProps.modelName).toBe("gpt-4");
      expect(capturedChatPanelProps.onInputChange).toBe(onChatInputChange);
      expect(capturedChatPanelProps.onSubmit).toBe(onChatSubmit);
    });

    it("should apply absolute positioning style to chat panel", async () => {
      const { CortexIDELayout } = await import("../CortexIDELayout");
      const props = createDefaultProps({ chatState: "expanded" });
      render(() => <CortexIDELayout {...props} />);
      const style = capturedChatPanelProps.style as Record<string, string>;
      expect(style.position).toBe("absolute");
      expect(style.right).toBe("16px");
      expect(style.bottom).toBe("44px");
      expect(style["z-index"]).toBe("100");
    });
  });
});

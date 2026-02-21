import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { Suspense } from "solid-js";
import { CortexSidebarContainer } from "../CortexSidebarContainer";
import type { CortexSidebarContainerProps } from "../CortexSidebarContainer";
import type { SidebarTab } from "../types";
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from "../types";

vi.mock("@/components/cortex/CortexAgentsPanel", () => ({
  CortexAgentsPanel: () => <div data-testid="agents-panel">Agents</div>,
}));

vi.mock("@/components/cortex/CortexFactoryPanel", () => ({
  CortexFactoryPanel: () => <div data-testid="factory-panel">Factory</div>,
}));

vi.mock("@/components/FileExplorer", () => ({
  FileExplorer: (props: { rootPath?: string | null; onFileSelect?: (path: string) => void }) => (
    <div data-testid="file-explorer">
      <button data-testid="file-item" onClick={() => props.onFileSelect?.("/src/index.ts")}>
        index.ts
      </button>
    </div>
  ),
}));

vi.mock("@/components/cortex/CortexGitPanel", () => ({
  CortexGitPanel: () => <div data-testid="git-panel">Git</div>,
}));

vi.mock("@/components/cortex/CortexSearchPanel", () => ({
  CortexSearchPanel: () => <div data-testid="search-panel">Search</div>,
}));

vi.mock("@/components/cortex/CortexDebugPanel", () => ({
  CortexDebugPanel: () => <div data-testid="debug-panel">Debug</div>,
}));

vi.mock("@/components/cortex/CortexExtensionsPanel", () => ({
  CortexExtensionsPanel: () => <div data-testid="extensions-panel">Extensions</div>,
}));

vi.mock("@/components/cortex/CortexThemePicker", () => ({
  CortexThemePicker: () => <div data-testid="theme-picker">Themes</div>,
}));

vi.mock("@/components/cortex/CortexPluginsPanel", () => ({
  CortexPluginsPanel: () => <div data-testid="plugins-panel">Plugins</div>,
}));

vi.mock("@/components/cortex/CortexAccountPanel", () => ({
  CortexAccountPanel: () => <div data-testid="account-panel">Account</div>,
}));

function createDefaultProps(overrides: Partial<CortexSidebarContainerProps> = {}): CortexSidebarContainerProps {
  return {
    sidebarTab: "files" as SidebarTab,
    sidebarCollapsed: false,
    sidebarWidth: 320,
    isResizing: false,
    projectPath: "/workspace/project",
    onFileSelect: vi.fn(),
    onSidebarWidthChange: vi.fn(),
    onResizingChange: vi.fn(),
    ...overrides,
  };
}

function renderWithSuspense(props: CortexSidebarContainerProps) {
  return render(() => (
    <Suspense fallback={<div data-testid="suspense-fallback">Loading...</div>}>
      <CortexSidebarContainer {...props} />
    </Suspense>
  ));
}

describe("CortexSidebarContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Panel Rendering", () => {
    const panelMap: Array<{ tab: SidebarTab; testId: string }> = [
      { tab: "files", testId: "file-explorer" },
      { tab: "search", testId: "search-panel" },
      { tab: "git", testId: "git-panel" },
      { tab: "debug", testId: "debug-panel" },
      { tab: "extensions", testId: "extensions-panel" },
      { tab: "agents", testId: "agents-panel" },
      { tab: "themes", testId: "theme-picker" },
      { tab: "plugins", testId: "plugins-panel" },
      { tab: "account", testId: "account-panel" },
    ];

    for (const { tab, testId } of panelMap) {
      it(`should render correct panel for '${tab}' tab`, async () => {
        const props = createDefaultProps({ sidebarTab: tab });
        const { findByTestId } = renderWithSuspense(props);

        expect(await findByTestId(testId)).toBeTruthy();
      });

      it(`should not render other panels when '${tab}' tab is active`, async () => {
        const props = createDefaultProps({ sidebarTab: tab });
        const { findByTestId, queryByTestId } = renderWithSuspense(props);

        await findByTestId(testId);

        for (const other of panelMap) {
          if (other.tab !== tab) {
            expect(queryByTestId(other.testId)).toBeNull();
          }
        }
      });
    }
  });

  describe("Factory Panel Removal", () => {
    it("should not render factory panel for any valid sidebar tab", () => {
      const validTabs: SidebarTab[] = ["files", "search", "git", "debug", "extensions", "agents", "themes", "plugins", "account"];

      for (const tab of validTabs) {
        cleanup();
        const props = createDefaultProps({ sidebarTab: tab });
        const { queryByTestId } = renderWithSuspense(props);
        expect(queryByTestId("factory-panel")).toBeNull();
      }
    });

    it("should not include factory in the set of expected sidebar tabs", () => {
      const expectedTabs: SidebarTab[] = ["files", "search", "git", "debug", "extensions", "agents", "themes", "plugins", "account"];
      expect(expectedTabs).not.toContain("factory");
    });
  });

  describe("Sidebar Width", () => {
    it("should apply sidebarWidth to aside element style", () => {
      const props = createDefaultProps({ sidebarWidth: 400 });
      const { container } = renderWithSuspense(props);

      const aside = container.querySelector("aside");
      expect(aside).toBeTruthy();
      expect(aside!.style.width).toBe("400px");
    });

    it("should apply different width values correctly", () => {
      const props = createDefaultProps({ sidebarWidth: 250 });
      const { container } = renderWithSuspense(props);

      const aside = container.querySelector("aside");
      expect(aside!.style.width).toBe("250px");
    });

    it("should apply default sidebar width", () => {
      const props = createDefaultProps({ sidebarWidth: 320 });
      const { container } = renderWithSuspense(props);

      const aside = container.querySelector("aside");
      expect(aside!.style.width).toBe("320px");
    });
  });

  describe("Collapsed State", () => {
    it("should not render aside when collapsed", () => {
      const props = createDefaultProps({ sidebarCollapsed: true });
      const { container } = renderWithSuspense(props);

      const aside = container.querySelector("aside");
      expect(aside).toBeNull();
    });

    it("should not render resize handle when collapsed", () => {
      const props = createDefaultProps({ sidebarCollapsed: true });
      const { container } = renderWithSuspense(props);

      const resizeHandle = container.querySelector('[style*="col-resize"]');
      expect(resizeHandle).toBeNull();
    });

    it("should render aside when not collapsed", () => {
      const props = createDefaultProps({ sidebarCollapsed: false });
      const { container } = renderWithSuspense(props);

      const aside = container.querySelector("aside");
      expect(aside).toBeTruthy();
    });

    it("should not render any panel content when collapsed", () => {
      const props = createDefaultProps({ sidebarCollapsed: true, sidebarTab: "search" });
      const { queryByTestId } = renderWithSuspense(props);

      expect(queryByTestId("search-panel")).toBeNull();
    });
  });

  describe("Resize Handle", () => {
    function getResizeHandle(container: HTMLElement): HTMLElement {
      const handle = container.querySelector('[style*="col-resize"]') as HTMLElement;
      expect(handle).toBeTruthy();
      return handle;
    }

    it("should render resize handle when not collapsed", () => {
      const props = createDefaultProps();
      const { container } = renderWithSuspense(props);

      const handle = getResizeHandle(container);
      expect(handle).toBeTruthy();
    });

    it("should call onResizingChange(true) on mousedown", async () => {
      const onResizingChange = vi.fn();
      const props = createDefaultProps({ onResizingChange });
      const { container } = renderWithSuspense(props);

      const handle = getResizeHandle(container);
      await fireEvent.mouseDown(handle, { clientX: 320 });

      expect(onResizingChange).toHaveBeenCalledWith(true);
    });

    it("should call onSidebarWidthChange on mousemove during resize", async () => {
      const onSidebarWidthChange = vi.fn();
      const onResizingChange = vi.fn();
      const props = createDefaultProps({
        sidebarWidth: 320,
        onSidebarWidthChange,
        onResizingChange,
      });
      const { container } = renderWithSuspense(props);

      const handle = getResizeHandle(container);
      await fireEvent.mouseDown(handle, { clientX: 320 });

      const moveEvent = new MouseEvent("mousemove", { clientX: 370, bubbles: true });
      document.dispatchEvent(moveEvent);

      expect(onSidebarWidthChange).toHaveBeenCalledWith(370);
    });

    it("should call onResizingChange(false) on mouseup", async () => {
      const onResizingChange = vi.fn();
      const props = createDefaultProps({ onResizingChange });
      const { container } = renderWithSuspense(props);

      const handle = getResizeHandle(container);
      await fireEvent.mouseDown(handle, { clientX: 320 });

      onResizingChange.mockClear();

      const upEvent = new MouseEvent("mouseup", { bubbles: true });
      document.dispatchEvent(upEvent);

      expect(onResizingChange).toHaveBeenCalledWith(false);
    });

    it("should remove event listeners after mouseup", async () => {
      const onSidebarWidthChange = vi.fn();
      const onResizingChange = vi.fn();
      const props = createDefaultProps({
        sidebarWidth: 320,
        onSidebarWidthChange,
        onResizingChange,
      });
      const { container } = renderWithSuspense(props);

      const handle = getResizeHandle(container);
      await fireEvent.mouseDown(handle, { clientX: 320 });

      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      onSidebarWidthChange.mockClear();
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 500, bubbles: true }));

      expect(onSidebarWidthChange).not.toHaveBeenCalled();
    });

    it("should handle full resize sequence: mousedown → mousemove → mouseup", async () => {
      const onSidebarWidthChange = vi.fn();
      const onResizingChange = vi.fn();
      const props = createDefaultProps({
        sidebarWidth: 300,
        onSidebarWidthChange,
        onResizingChange,
      });
      const { container } = renderWithSuspense(props);

      const handle = getResizeHandle(container);

      await fireEvent.mouseDown(handle, { clientX: 300 });
      expect(onResizingChange).toHaveBeenCalledWith(true);

      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 350, bubbles: true }));
      expect(onSidebarWidthChange).toHaveBeenCalledWith(350);

      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 380, bubbles: true }));
      expect(onSidebarWidthChange).toHaveBeenCalledWith(380);

      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      expect(onResizingChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Width Constraints", () => {
    it("should clamp width to SIDEBAR_MIN_WIDTH when dragging left", async () => {
      const onSidebarWidthChange = vi.fn();
      const props = createDefaultProps({
        sidebarWidth: 300,
        onSidebarWidthChange,
      });
      const { container } = renderWithSuspense(props);

      const handle = container.querySelector('[style*="col-resize"]') as HTMLElement;
      await fireEvent.mouseDown(handle, { clientX: 300 });

      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, bubbles: true }));

      expect(onSidebarWidthChange).toHaveBeenCalledWith(SIDEBAR_MIN_WIDTH);
    });

    it("should clamp width to SIDEBAR_MAX_WIDTH when dragging right", async () => {
      const onSidebarWidthChange = vi.fn();
      const props = createDefaultProps({
        sidebarWidth: 300,
        onSidebarWidthChange,
      });
      const { container } = renderWithSuspense(props);

      const handle = container.querySelector('[style*="col-resize"]') as HTMLElement;
      await fireEvent.mouseDown(handle, { clientX: 300 });

      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 1200, bubbles: true }));

      expect(onSidebarWidthChange).toHaveBeenCalledWith(SIDEBAR_MAX_WIDTH);
    });

    it("should allow width within valid range", async () => {
      const onSidebarWidthChange = vi.fn();
      const props = createDefaultProps({
        sidebarWidth: 300,
        onSidebarWidthChange,
      });
      const { container } = renderWithSuspense(props);

      const handle = container.querySelector('[style*="col-resize"]') as HTMLElement;
      await fireEvent.mouseDown(handle, { clientX: 300 });

      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, bubbles: true }));

      expect(onSidebarWidthChange).toHaveBeenCalledWith(400);
    });

    it("should respect SIDEBAR_MIN_WIDTH constant value", () => {
      expect(SIDEBAR_MIN_WIDTH).toBe(200);
    });

    it("should respect SIDEBAR_MAX_WIDTH constant value", () => {
      expect(SIDEBAR_MAX_WIDTH).toBe(600);
    });
  });

  describe("File Explorer Tab", () => {
    it("should render file explorer when tab is files and projectPath is set", () => {
      const props = createDefaultProps({
        sidebarTab: "files",
        projectPath: "/workspace/project",
      });
      const { queryByTestId } = renderWithSuspense(props);

      expect(queryByTestId("file-explorer")).toBeTruthy();
    });

    it("should call onFileSelect when a file is selected in explorer", async () => {
      const onFileSelect = vi.fn();
      const props = createDefaultProps({
        sidebarTab: "files",
        projectPath: "/workspace/project",
        onFileSelect,
      });
      const { getByTestId } = renderWithSuspense(props);

      const fileItem = getByTestId("file-item");
      await fireEvent.click(fileItem);

      expect(onFileSelect).toHaveBeenCalledWith("/src/index.ts");
    });

    it("should render empty explorer when projectPath is null", () => {
      const props = createDefaultProps({
        sidebarTab: "files",
        projectPath: null,
      });
      const { queryByTestId, container } = renderWithSuspense(props);

      expect(queryByTestId("file-explorer")).toBeNull();
      expect(container.textContent).toContain("No folder opened");
    });

    it("should render empty explorer when projectPath is '.'", () => {
      const props = createDefaultProps({
        sidebarTab: "files",
        projectPath: ".",
      });
      const { queryByTestId, container } = renderWithSuspense(props);

      expect(queryByTestId("file-explorer")).toBeNull();
      expect(container.textContent).toContain("No folder opened");
    });

    it("should render Open Folder button in empty explorer", () => {
      const props = createDefaultProps({
        sidebarTab: "files",
        projectPath: null,
      });
      const { container } = renderWithSuspense(props);

      const openButton = container.querySelector("button");
      expect(openButton).toBeTruthy();
      expect(openButton!.textContent).toContain("Open Folder");
    });
  });

  describe("Transition Behavior", () => {
    it("should disable transition when isResizing is true", () => {
      const props = createDefaultProps({ isResizing: true });
      const { container } = renderWithSuspense(props);

      const aside = container.querySelector("aside");
      expect(aside!.style.transition).toBe("none");
    });

    it("should enable transition when isResizing is false", () => {
      const props = createDefaultProps({ isResizing: false });
      const { container } = renderWithSuspense(props);

      const aside = container.querySelector("aside");
      expect(aside!.style.transition).toContain("width 150ms ease");
    });
  });
});

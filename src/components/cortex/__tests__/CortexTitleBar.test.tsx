import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";

vi.mock("../primitives", () => ({
  CortexHeaderItem: (props: { label: string; isActive?: boolean; onClick?: () => void }) => (
    <button
      data-testid={`header-item-${props.label}`}
      data-active={props.isActive}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  ),
  CortexConfigBadge: (props: { label?: string; isOpen?: boolean; onClick?: (e: MouseEvent) => void; children?: import("solid-js").JSX.Element }) => (
    <div data-testid="config-badge" data-label={props.label} data-open={props.isOpen} onClick={props.onClick}>
      {props.children}
    </div>
  ),
  CortexStartPause: (props: { state: string; onClick?: (e: MouseEvent) => void }) => (
    <button data-testid="start-pause" data-state={props.state} onClick={props.onClick}>
      {props.state}
    </button>
  ),
}));

vi.mock("../primitives/CortexVibeToggle", () => ({
  CortexVibeToggle: (props: { mode: string; onChange?: (mode: string) => void }) => (
    <div data-testid="vibe-toggle" data-mode={props.mode}>
      <button data-testid="vibe-btn" onClick={() => props.onChange?.("vibe")}>Vibe</button>
      <button data-testid="ide-btn" onClick={() => props.onChange?.("ide")}>IDE</button>
    </div>
  ),
}));

vi.mock("../primitives/CortexOpenProjectDropdown", () => ({
  CortexOpenProjectDropdown: (props: { label?: string; isOpen?: boolean; onClick?: (e: MouseEvent) => void; children?: import("solid-js").JSX.Element }) => (
    <div data-testid="open-project" data-label={props.label} data-open={props.isOpen} onClick={props.onClick}>
      {props.children}
    </div>
  ),
}));

vi.mock("../titlebar/TitleBarDropdownMenu", () => ({
  TitleBarDropdownMenu: (props: { items: unknown[]; onItemClick: (item: unknown) => void }) => (
    <div data-testid="dropdown-menu" data-item-count={props.items.length}>
      <button data-testid="dropdown-item" onClick={() => props.onItemClick(props.items[0])}>
        menu-item
      </button>
    </div>
  ),
}));

vi.mock("../titlebar/WindowControls", () => ({
  WindowControls: (props: { onMinimize?: () => void; onMaximize?: () => void; onClose?: () => void }) => (
    <div data-testid="window-controls">
      <button data-testid="minimize-btn" onClick={props.onMinimize}>min</button>
      <button data-testid="maximize-btn" onClick={props.onMaximize}>max</button>
      <button data-testid="close-btn" onClick={props.onClose}>close</button>
    </div>
  ),
}));

vi.mock("../titlebar/CortexLogo", () => ({
  CortexLogo: (props: { size?: number }) => (
    <div data-testid="cortex-logo" data-size={props.size ?? 40}>logo</div>
  ),
}));

const mockDetectPlatform = vi.fn().mockReturnValue("windows");
vi.mock("../titlebar/platformDetect", () => ({
  detectPlatform: () => mockDetectPlatform(),
}));

import { CortexTitleBar } from "../CortexTitleBar";
import { MENU_LABELS } from "../titlebar/defaultMenus";

describe("CortexTitleBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectPlatform.mockReturnValue("windows");
    cleanup();
  });

  describe("Rendering", () => {
    it("should render a header element", () => {
      const { container } = render(() => <CortexTitleBar />);
      const header = container.querySelector("header");
      expect(header).toBeTruthy();
    });

    it("should render the CortexLogo", () => {
      const { getByTestId } = render(() => <CortexTitleBar />);
      expect(getByTestId("cortex-logo")).toBeTruthy();
    });

    it("should render the logo with size 40", () => {
      const { getByTestId } = render(() => <CortexTitleBar />);
      expect(getByTestId("cortex-logo").getAttribute("data-size")).toBe("40");
    });

    it("should render all menu labels from MENU_LABELS", () => {
      const { container } = render(() => <CortexTitleBar />);
      MENU_LABELS.forEach((label) => {
        const item = container.querySelector(`[data-testid="header-item-${label}"]`);
        expect(item).toBeTruthy();
      });
    });

    it("should render window controls", () => {
      const { getByTestId } = render(() => <CortexTitleBar />);
      expect(getByTestId("window-controls")).toBeTruthy();
    });

    it("should render the vibe toggle", () => {
      const { getByTestId } = render(() => <CortexTitleBar />);
      expect(getByTestId("vibe-toggle")).toBeTruthy();
    });

    it("should render the open project dropdown", () => {
      const { getByTestId } = render(() => <CortexTitleBar />);
      expect(getByTestId("open-project")).toBeTruthy();
    });

    it("should render the config badge", () => {
      const { getByTestId } = render(() => <CortexTitleBar />);
      expect(getByTestId("config-badge")).toBeTruthy();
    });

    it("should render the start/pause button", () => {
      const { getByTestId } = render(() => <CortexTitleBar />);
      expect(getByTestId("start-pause")).toBeTruthy();
    });

    it("should render a vertical separator", () => {
      const { container } = render(() => <CortexTitleBar />);
      const separators = container.querySelectorAll("div");
      const separator = Array.from(separators).find((el) => {
        const s = el.getAttribute("style") || "";
        return s.includes("width:1px") && s.includes("height:20px");
      });
      expect(separator).toBeTruthy();
    });
  });

  describe("Header styling", () => {
    it("should have data-tauri-drag-region attribute", () => {
      const { container } = render(() => <CortexTitleBar />);
      const header = container.querySelector("header");
      expect(header?.hasAttribute("data-tauri-drag-region")).toBe(true);
    });

    it("should have correct height of 56px", () => {
      const { container } = render(() => <CortexTitleBar />);
      const header = container.querySelector("header");
      expect(header?.style.height).toBe("56px");
    });

    it("should have flex layout with space-between", () => {
      const { container } = render(() => <CortexTitleBar />);
      const header = container.querySelector("header");
      expect(header?.style.display).toBe("flex");
      expect(header?.style.justifyContent).toBe("space-between");
    });

    it("should apply custom class", () => {
      const { container } = render(() => <CortexTitleBar class="my-titlebar" />);
      const header = container.querySelector("header");
      expect(header?.className).toContain("my-titlebar");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexTitleBar style={{ "background-color": "red" }} />
      ));
      const header = container.querySelector("header");
      expect(header?.style.backgroundColor).toBe("red");
    });
  });

  describe("Mode toggle (vibe/ide)", () => {
    it("should default to ide mode", () => {
      const { getByTestId } = render(() => <CortexTitleBar />);
      expect(getByTestId("vibe-toggle").getAttribute("data-mode")).toBe("ide");
    });

    it("should pass mode prop to vibe toggle", () => {
      const { getByTestId } = render(() => <CortexTitleBar mode="vibe" />);
      expect(getByTestId("vibe-toggle").getAttribute("data-mode")).toBe("vibe");
    });

    it("should call onModeChange when vibe button is clicked", async () => {
      const onModeChange = vi.fn();
      const { getByTestId } = render(() => (
        <CortexTitleBar mode="ide" onModeChange={onModeChange} />
      ));
      await fireEvent.click(getByTestId("vibe-btn"));
      expect(onModeChange).toHaveBeenCalledWith("vibe");
    });

    it("should call onModeChange when ide button is clicked", async () => {
      const onModeChange = vi.fn();
      const { getByTestId } = render(() => (
        <CortexTitleBar mode="vibe" onModeChange={onModeChange} />
      ));
      await fireEvent.click(getByTestId("ide-btn"));
      expect(onModeChange).toHaveBeenCalledWith("ide");
    });
  });

  describe("Menu items open/close via onMenuSelect", () => {
    it("should not show dropdown menu when no activeMenu", () => {
      const { queryByTestId } = render(() => <CortexTitleBar />);
      expect(queryByTestId("dropdown-menu")).toBeNull();
    });

    it("should show dropdown menu when activeMenu matches a label", () => {
      const { getByTestId } = render(() => (
        <CortexTitleBar activeMenu="File" />
      ));
      expect(getByTestId("dropdown-menu")).toBeTruthy();
    });

    it("should call onMenuSelect with label when menu item is clicked", async () => {
      const onMenuSelect = vi.fn();
      const { container } = render(() => (
        <CortexTitleBar onMenuSelect={onMenuSelect} />
      ));
      const fileItem = container.querySelector('[data-testid="header-item-File"]');
      await fireEvent.click(fileItem!);
      expect(onMenuSelect).toHaveBeenCalledWith("File");
    });

    it("should call onMenuSelect with null when clicking active menu to close", async () => {
      const onMenuSelect = vi.fn();
      const { container } = render(() => (
        <CortexTitleBar activeMenu="File" onMenuSelect={onMenuSelect} />
      ));
      const fileItem = container.querySelector('[data-testid="header-item-File"]');
      await fireEvent.click(fileItem!);
      expect(onMenuSelect).toHaveBeenCalledWith(null);
    });

    it("should mark active menu header item as active", () => {
      const { container } = render(() => (
        <CortexTitleBar activeMenu="Edit" />
      ));
      const editItem = container.querySelector('[data-testid="header-item-Edit"]');
      expect(editItem?.getAttribute("data-active")).toBe("true");
    });

    it("should not mark non-active menu items as active", () => {
      const { container } = render(() => (
        <CortexTitleBar activeMenu="Edit" />
      ));
      const fileItem = container.querySelector('[data-testid="header-item-File"]');
      expect(fileItem?.getAttribute("data-active")).toBe("false");
    });
  });

  describe("Keyboard and click-outside menu close", () => {
    it("should call onMenuSelect(null) on Escape key when menu is open", async () => {
      const onMenuSelect = vi.fn();
      render(() => (
        <CortexTitleBar activeMenu="File" onMenuSelect={onMenuSelect} />
      ));
      await fireEvent.keyDown(document, { key: "Escape" });
      expect(onMenuSelect).toHaveBeenCalledWith(null);
    });

    it("should not call onMenuSelect on Escape when no menu is open", async () => {
      const onMenuSelect = vi.fn();
      render(() => (
        <CortexTitleBar onMenuSelect={onMenuSelect} />
      ));
      await fireEvent.keyDown(document, { key: "Escape" });
      expect(onMenuSelect).not.toHaveBeenCalled();
    });

    it("should call onMenuSelect(null) on click outside menu bar when menu is open", async () => {
      const onMenuSelect = vi.fn();
      render(() => (
        <CortexTitleBar activeMenu="File" onMenuSelect={onMenuSelect} />
      ));
      await fireEvent.mouseDown(document.body);
      expect(onMenuSelect).toHaveBeenCalledWith(null);
    });
  });

  describe("Platform detection affects layout", () => {
    it("should render window controls on the RIGHT for Windows", () => {
      mockDetectPlatform.mockReturnValue("windows");
      const { container, getByTestId } = render(() => <CortexTitleBar />);
      const header = container.querySelector("header")!;
      const rightSection = header.children[1] as HTMLElement;
      const windowControls = getByTestId("window-controls");
      expect(rightSection.contains(windowControls)).toBe(true);
    });

    it("should render window controls on the RIGHT for Linux", () => {
      mockDetectPlatform.mockReturnValue("linux");
      const { container, getByTestId } = render(() => <CortexTitleBar />);
      const header = container.querySelector("header")!;
      const rightSection = header.children[1] as HTMLElement;
      const windowControls = getByTestId("window-controls");
      expect(rightSection.contains(windowControls)).toBe(true);
    });

    it("should render window controls on the LEFT for macOS", () => {
      mockDetectPlatform.mockReturnValue("macos");
      const { container, getByTestId } = render(() => <CortexTitleBar />);
      const header = container.querySelector("header")!;
      const leftSection = header.children[0] as HTMLElement;
      const windowControls = getByTestId("window-controls");
      expect(leftSection.contains(windowControls)).toBe(true);
    });

    it("should NOT render window controls in right section for macOS", () => {
      mockDetectPlatform.mockReturnValue("macos");
      const { container, getAllByTestId } = render(() => <CortexTitleBar />);
      const header = container.querySelector("header")!;
      const rightSection = header.children[1] as HTMLElement;
      const allControls = getAllByTestId("window-controls");
      const controlsInRight = allControls.filter((el) => rightSection.contains(el));
      expect(controlsInRight).toHaveLength(0);
    });

    it("should NOT render window controls in left section for Windows", () => {
      mockDetectPlatform.mockReturnValue("windows");
      const { container, getAllByTestId } = render(() => <CortexTitleBar />);
      const header = container.querySelector("header")!;
      const leftSection = header.children[0] as HTMLElement;
      const allControls = getAllByTestId("window-controls");
      const controlsInLeft = allControls.filter((el) => leftSection.contains(el));
      expect(controlsInLeft).toHaveLength(0);
    });
  });

  describe("Window control callbacks", () => {
    it("should call onMinimize when minimize button is clicked", async () => {
      const onMinimize = vi.fn();
      const { getByTestId } = render(() => (
        <CortexTitleBar onMinimize={onMinimize} />
      ));
      await fireEvent.click(getByTestId("minimize-btn"));
      expect(onMinimize).toHaveBeenCalledTimes(1);
    });

    it("should call onMaximize when maximize button is clicked", async () => {
      const onMaximize = vi.fn();
      const { getByTestId } = render(() => (
        <CortexTitleBar onMaximize={onMaximize} />
      ));
      await fireEvent.click(getByTestId("maximize-btn"));
      expect(onMaximize).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      const { getByTestId } = render(() => (
        <CortexTitleBar onClose={onClose} />
      ));
      await fireEvent.click(getByTestId("close-btn"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Config badge", () => {
    it("should pass configLabel to config badge", () => {
      const { getByTestId } = render(() => (
        <CortexTitleBar configLabel="GPT-4" />
      ));
      expect(getByTestId("config-badge").getAttribute("data-label")).toBe("GPT-4");
    });

    it("should default configLabel to 'config'", () => {
      const { getByTestId } = render(() => <CortexTitleBar />);
      expect(getByTestId("config-badge").getAttribute("data-label")).toBe("config");
    });
  });

  describe("Start/Pause button", () => {
    it("should show 'start' state when not running", () => {
      const { getByTestId } = render(() => (
        <CortexTitleBar isRunning={false} />
      ));
      expect(getByTestId("start-pause").getAttribute("data-state")).toBe("start");
    });

    it("should show 'pause' state when running", () => {
      const { getByTestId } = render(() => (
        <CortexTitleBar isRunning={true} />
      ));
      expect(getByTestId("start-pause").getAttribute("data-state")).toBe("pause");
    });

    it("should call onStartPause when clicked", async () => {
      const onStartPause = vi.fn();
      const { getByTestId } = render(() => (
        <CortexTitleBar onStartPause={onStartPause} />
      ));
      await fireEvent.click(getByTestId("start-pause"));
      expect(onStartPause).toHaveBeenCalledTimes(1);
    });
  });

  describe("Open project dropdown", () => {
    it("should pass openProjectLabel to dropdown", () => {
      const { getByTestId } = render(() => (
        <CortexTitleBar openProjectLabel="my-project" />
      ));
      expect(getByTestId("open-project").getAttribute("data-label")).toBe("my-project");
    });

    it("should pass isProjectDropdownOpen to dropdown", () => {
      const { getByTestId } = render(() => (
        <CortexTitleBar isProjectDropdownOpen={true} />
      ));
      expect(getByTestId("open-project").getAttribute("data-open")).toBe("true");
    });
  });

  describe("Menu hover behavior", () => {
    it("should call onMenuSelect with label on mouse enter over menu item", async () => {
      const onMenuSelect = vi.fn();
      const { container } = render(() => (
        <CortexTitleBar activeMenu="File" onMenuSelect={onMenuSelect} />
      ));
      const editItemWrapper = container.querySelector('[data-testid="header-item-Edit"]')?.parentElement;
      if (editItemWrapper) {
        await fireEvent.mouseEnter(editItemWrapper);
        expect(onMenuSelect).toHaveBeenCalledWith("Edit");
      }
    });
  });
});

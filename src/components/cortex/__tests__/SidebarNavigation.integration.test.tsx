import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { createSignal, createEffect, Show } from "solid-js";
import { CortexActivityBar } from "../CortexActivityBar";
import type { ActivityBarItem } from "../CortexActivityBar";
import { CortexSidebarContainer } from "../layout/CortexSidebarContainer";
import type { SidebarTab } from "../layout/types";
import { SIDEBAR_DEFAULT_WIDTH } from "../layout/types";

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
  CortexTooltip: (props: { content: string; position?: string; children: import("solid-js").JSX.Element }) => (
    <div data-tooltip={props.content}>{props.children}</div>
  ),
  CortexToggle: (props: { checked?: boolean; onChange?: (v: boolean) => void; size?: string }) => (
    <input
      type="checkbox"
      data-testid="toggle"
      checked={props.checked}
      onChange={(e) => props.onChange?.(e.currentTarget.checked)}
    />
  ),
}));

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

vi.mock("../primitives/CortexIconButton", () => ({
  CortexIconButton: (props: { icon: string; size?: number; onClick?: () => void }) => (
    <button data-testid={`iconbtn-${props.icon}`} onClick={props.onClick} />
  ),
}));

vi.mock("../primitives/CortexButton", () => ({
  CortexButton: (props: { children: import("solid-js").JSX.Element; onClick?: () => void }) => (
    <button onClick={props.onClick}>{props.children}</button>
  ),
}));

vi.mock("../primitives/CortexTooltip", () => ({
  CortexTooltip: (props: { content: string; children: import("solid-js").JSX.Element }) => (
    <div data-tooltip={props.content}>{props.children}</div>
  ),
}));

vi.mock("../primitives/CortexDropdown", () => ({
  CortexDropdown: (props: { children: import("solid-js").JSX.Element }) => <div>{props.children}</div>,
}));

vi.mock("../primitives/CortexDropdownMenu", () => ({
  CortexDropdownMenu: (props: { children: import("solid-js").JSX.Element }) => <div>{props.children}</div>,
}));

vi.mock("../primitives/CortexDropdownItem", () => ({
  CortexDropdownItem: (props: { children: import("solid-js").JSX.Element }) => <div>{props.children}</div>,
}));

vi.mock("../primitives/CortexToggle", () => ({
  CortexToggle: () => <input type="checkbox" data-testid="toggle" />,
}));

vi.mock("@/components/FileExplorer", () => ({
  FileExplorer: () => <div data-testid="panel-files">File Explorer Panel</div>,
}));

vi.mock("@/components/cortex/CortexSearchPanel", () => ({
  CortexSearchPanel: () => <div data-testid="panel-search">Search Panel</div>,
}));

vi.mock("@/components/cortex/CortexGitPanel", () => ({
  CortexGitPanel: () => <div data-testid="panel-git">Git Panel</div>,
}));

vi.mock("@/components/cortex/CortexDebugPanel", () => ({
  CortexDebugPanel: () => <div data-testid="panel-debug">Debug Panel</div>,
}));

vi.mock("@/components/cortex/CortexExtensionsPanel", () => ({
  CortexExtensionsPanel: () => <div data-testid="panel-extensions">Extensions Panel</div>,
}));

vi.mock("@/components/cortex/CortexAgentsPanel", () => ({
  CortexAgentsPanel: () => <div data-testid="panel-agents">Agents Panel</div>,
}));

vi.mock("@/components/cortex/CortexFactoryPanel", () => ({
  CortexFactoryPanel: () => <div data-testid="panel-factory">Factory Panel</div>,
}));

vi.mock("@/components/cortex/CortexThemePicker", () => ({
  CortexThemePicker: () => <div data-testid="panel-themes">Theme Picker Panel</div>,
}));

vi.mock("@/components/cortex/CortexPluginsPanel", () => ({
  CortexPluginsPanel: () => <div data-testid="panel-plugins">Plugins Panel</div>,
}));

vi.mock("@/components/cortex/CortexAccountPanel", () => ({
  CortexAccountPanel: () => <div data-testid="panel-account">Account Panel</div>,
}));

const STORAGE_KEYS = {
  sidebarTab: "figma_layout_sidebar_tab",
  sidebarCollapsed: "figma_layout_sidebar_collapsed",
  sidebarWidth: "figma_layout_sidebar_width",
} as const;

const NAV_ITEMS: ActivityBarItem[] = [
  { id: "files", icon: "folder", label: "Explorer" },
  { id: "search", icon: "search", label: "Search" },
  { id: "git", icon: "git", label: "Source Control" },
  { id: "debug", icon: "play", label: "Run & Debug" },
  { id: "plugins", icon: "plugins", label: "Plugins" },
  { id: "agents", icon: "users", label: "AI Agents" },
  { id: "extensions", icon: "grid", label: "Extensions" },
  { id: "themes", icon: "brush", label: "Themes" },
];

function SidebarIntegrationWrapper(props: { initialTab?: SidebarTab; initialCollapsed?: boolean }) {
  const [sidebarTab, setSidebarTab] = createSignal<SidebarTab>(props.initialTab ?? "files");
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(props.initialCollapsed ?? false);
  const [sidebarWidth, setSidebarWidth] = createSignal(SIDEBAR_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = createSignal(false);

  createEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sidebarTab, sidebarTab());
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(sidebarCollapsed()));
    localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(sidebarWidth()));
  });

  const handleNavItemClick = (id: string) => {
    const tabId = id as SidebarTab;
    if (sidebarCollapsed()) {
      setSidebarCollapsed(false);
      setSidebarTab(tabId);
    } else if (sidebarTab() === tabId) {
      setSidebarCollapsed(true);
    } else {
      setSidebarTab(tabId);
    }
  };

  const handleAvatarClick = () => {
    if (!sidebarCollapsed() && sidebarTab() === "account") {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
      setSidebarTab("account");
    }
  };

  return (
    <div data-testid="integration-wrapper" style={{ display: "flex", width: "100%", height: "600px" }}>
      <CortexActivityBar
        items={NAV_ITEMS}
        activeId={sidebarCollapsed() ? null : sidebarTab()}
        onItemClick={handleNavItemClick}
        onAvatarClick={handleAvatarClick}
      />
      <CortexSidebarContainer
        sidebarTab={sidebarTab()}
        sidebarCollapsed={sidebarCollapsed()}
        sidebarWidth={sidebarWidth()}
        isResizing={isResizing()}
        projectPath="/test/project"
        onFileSelect={vi.fn()}
        onSidebarWidthChange={(w) => setSidebarWidth(w)}
        onResizingChange={setIsResizing}
      />
      <Show when={!sidebarCollapsed()}>
        <div data-testid="sidebar-visible" />
      </Show>
      <Show when={sidebarCollapsed()}>
        <div data-testid="sidebar-collapsed" />
      </Show>
    </div>
  );
}

describe("SidebarNavigation Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    localStorage.clear();
  });

  describe("Panel Switching", () => {
    it("clicking 'files' in ActivityBar shows file explorer panel", async () => {
      const { container, findByTestId } = render(() => (
        <SidebarIntegrationWrapper initialTab="search" />
      ));

      const filesButton = container.querySelector('button[aria-label="Explorer"]');
      expect(filesButton).toBeTruthy();

      await fireEvent.click(filesButton!);

      const panel = await findByTestId("panel-files");
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain("File Explorer Panel");
    });

    it("clicking 'git' shows git panel", async () => {
      const { container, findByTestId } = render(() => <SidebarIntegrationWrapper />);

      const gitButton = container.querySelector('button[aria-label="Source Control"]');
      expect(gitButton).toBeTruthy();

      await fireEvent.click(gitButton!);

      const panel = await findByTestId("panel-git");
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain("Git Panel");
    });

    it("clicking 'search' shows search panel", async () => {
      const { container, findByTestId } = render(() => <SidebarIntegrationWrapper />);

      const searchButton = container.querySelector('button[aria-label="Search"]');
      expect(searchButton).toBeTruthy();

      await fireEvent.click(searchButton!);

      const panel = await findByTestId("panel-search");
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain("Search Panel");
    });

    it("clicking 'debug' shows debug panel", async () => {
      const { container, findByTestId } = render(() => <SidebarIntegrationWrapper />);

      const allButtons = container.querySelectorAll('nav button[aria-label]');
      const debugButton = Array.from(allButtons).find(
        (btn) => btn.getAttribute("aria-label") === "Run & Debug"
      ) as HTMLElement | undefined;
      expect(debugButton).toBeTruthy();

      await fireEvent.click(debugButton!);

      const panel = await findByTestId("panel-debug");
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain("Debug Panel");
    });

    it("clicking 'extensions' shows extensions panel", async () => {
      const { container, findByTestId } = render(() => <SidebarIntegrationWrapper />);

      const extensionsButton = container.querySelector('button[aria-label="Extensions"]');
      expect(extensionsButton).toBeTruthy();

      await fireEvent.click(extensionsButton!);

      const panel = await findByTestId("panel-extensions");
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain("Extensions Panel");
    });

    it("clicking 'agents' shows agents panel", async () => {
      const { container, findByTestId } = render(() => <SidebarIntegrationWrapper />);

      const agentsButton = container.querySelector('button[aria-label="AI Agents"]');
      expect(agentsButton).toBeTruthy();

      await fireEvent.click(agentsButton!);

      const panel = await findByTestId("panel-agents");
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain("Agents Panel");
    });

    it("clicking 'themes' shows theme picker", async () => {
      const { container, findByTestId } = render(() => <SidebarIntegrationWrapper />);

      const themesButton = container.querySelector('button[aria-label="Themes"]');
      expect(themesButton).toBeTruthy();

      await fireEvent.click(themesButton!);

      const panel = await findByTestId("panel-themes");
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain("Theme Picker Panel");
    });

    it("clicking 'plugins' shows plugins panel", async () => {
      const { container, findByTestId } = render(() => <SidebarIntegrationWrapper />);

      const pluginsButton = container.querySelector('button[aria-label="Plugins"]');
      expect(pluginsButton).toBeTruthy();

      await fireEvent.click(pluginsButton!);

      const panel = await findByTestId("panel-plugins");
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain("Plugins Panel");
    });

    it("clicking 'account' shows account panel", async () => {
      const { container, findByTestId } = render(() => <SidebarIntegrationWrapper />);

      const avatarButton = container.querySelector('button[aria-label="User account"]');
      expect(avatarButton).toBeTruthy();

      await fireEvent.click(avatarButton!);

      const panel = await findByTestId("panel-account");
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain("Account Panel");
    });
  });

  describe("Collapse and Expand", () => {
    it("clicking active tab collapses sidebar", async () => {
      const { container, findByTestId } = render(() => (
        <SidebarIntegrationWrapper initialTab="search" />
      ));

      const searchButton = container.querySelector('button[aria-label="Search"]');
      expect(searchButton).toBeTruthy();

      let visible = container.querySelector('[data-testid="sidebar-visible"]');
      expect(visible).toBeTruthy();

      await fireEvent.click(searchButton!);
      const collapsed = await findByTestId("sidebar-collapsed");
      expect(collapsed).toBeTruthy();
    });

    it("clicking collapsed active tab expands sidebar", async () => {
      const { container, findByTestId } = render(() => <SidebarIntegrationWrapper />);

      const searchButton = container.querySelector('button[aria-label="Search"]');
      expect(searchButton).toBeTruthy();

      await fireEvent.click(searchButton!);
      let panel = container.querySelector('[data-testid="panel-search"]');
      expect(panel).toBeTruthy();

      await fireEvent.click(searchButton!);
      let collapsed = container.querySelector('[data-testid="sidebar-collapsed"]');
      expect(collapsed).toBeTruthy();

      await fireEvent.click(searchButton!);
      const expanded = await findByTestId("sidebar-visible");
      expect(expanded).toBeTruthy();

      panel = container.querySelector('[data-testid="panel-search"]');
      expect(panel).toBeTruthy();
    });
  });

  describe("Factory Absent", () => {
    it("'factory' is completely absent from navigation items", () => {
      const { container } = render(() => <SidebarIntegrationWrapper />);

      const factoryButton = container.querySelector('button[aria-label="Factory"]');
      expect(factoryButton).toBeNull();

      const allButtons = container.querySelectorAll('nav button[aria-label]');
      const labels = Array.from(allButtons).map((btn) => btn.getAttribute("aria-label"));
      expect(labels).not.toContain("Factory");

      const allTooltips = container.querySelectorAll('[data-tooltip]');
      const tooltipValues = Array.from(allTooltips).map((el) => el.getAttribute("data-tooltip"));
      expect(tooltipValues).not.toContain("Factory");
    });
  });

  describe("Persistence", () => {
    it("sidebar width persists to localStorage", async () => {
      const { container: _container } = render(() => <SidebarIntegrationWrapper />);

      await new Promise((r) => setTimeout(r, 10));

      const storedWidth = localStorage.getItem(STORAGE_KEYS.sidebarWidth);
      expect(storedWidth).toBe(String(SIDEBAR_DEFAULT_WIDTH));
    });

    it("active tab persists to localStorage", async () => {
      const { container } = render(() => <SidebarIntegrationWrapper />);

      const gitButton = container.querySelector('button[aria-label="Source Control"]');
      expect(gitButton).toBeTruthy();

      await fireEvent.click(gitButton!);
      await new Promise((r) => setTimeout(r, 10));

      const storedTab = localStorage.getItem(STORAGE_KEYS.sidebarTab);
      expect(storedTab).toBe("git");
    });
  });
});

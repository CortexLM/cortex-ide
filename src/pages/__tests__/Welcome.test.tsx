import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

interface RecentProject {
  id: string;
  path: string;
  name: string;
  lastOpened: number;
  pinned: boolean;
  icon?: string;
}

const mockRecentProjects = {
  state: { projects: [] as RecentProject[], searchQuery: "" },
  projects: () => [] as RecentProject[],
  pinnedProjects: () => [] as RecentProject[],
  unpinnedProjects: () => [] as RecentProject[],
  filteredProjects: () => [] as RecentProject[],
  searchQuery: () => "",
  setSearchQuery: vi.fn(),
  addProject: vi.fn(),
  removeProject: vi.fn(),
  clearAllProjects: vi.fn(),
  togglePin: vi.fn(),
  openProject: vi.fn(),
  openProjectByPath: vi.fn(),
  getProjectByPath: vi.fn(),
  showRecentProjects: () => false,
  setShowRecentProjects: vi.fn(),
};

vi.mock("@/context/RecentProjectsContext", () => ({
  useRecentProjects: () => mockRecentProjects,
  RecentProjectsProvider: (props: { children: any }) => props.children,
}));

vi.mock("@/components/cortex/WelcomeRecentFiles", () => ({
  WelcomeRecentFiles: (props: { projects: any[]; onOpen: (p: any) => void }) => (
    <div data-testid="welcome-recent-files">
      {props.projects.map((p: any) => (
        <button data-testid={`project-${p.id}`} onClick={() => props.onOpen(p)}>
          {p.name}
        </button>
      ))}
    </div>
  ),
}));

import Welcome from "../Welcome";

describe("Welcome Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("should render the welcome page container", () => {
      const { getByTestId } = render(() => <Welcome />);
      expect(getByTestId("welcome-page")).toBeTruthy();
    });

    it("should render the branding image", () => {
      const { container } = render(() => <Welcome />);
      const img = container.querySelector('img[src="/assets/abstract-design.svg"]');
      expect(img).toBeTruthy();
    });

    it("should render the welcome heading", () => {
      const { getByText } = render(() => <Welcome />);
      expect(getByText("Welcome to Cortex")).toBeTruthy();
    });

    it("should render the tagline", () => {
      const { getByText } = render(() => <Welcome />);
      expect(getByText("AI-powered code editor. Start a new project or open a recent one.")).toBeTruthy();
    });
  });

  describe("Quick Actions", () => {
    it("should render New File button", () => {
      const { container } = render(() => <Welcome />);
      const buttons = container.querySelectorAll("button");
      const newFileBtn = Array.from(buttons).find(b => b.textContent === "New File");
      expect(newFileBtn).toBeTruthy();
    });

    it("should render Open Folder button", () => {
      const { container } = render(() => <Welcome />);
      const buttons = container.querySelectorAll("button");
      const openFolderBtn = Array.from(buttons).find(b => b.textContent === "Open Folder");
      expect(openFolderBtn).toBeTruthy();
    });

    it("should render Clone Repository button", () => {
      const { container } = render(() => <Welcome />);
      const buttons = container.querySelectorAll("button");
      const cloneBtn = Array.from(buttons).find(b => b.textContent === "Clone Repository");
      expect(cloneBtn).toBeTruthy();
    });

    it("should dispatch file:new event when New File is clicked", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      const { container } = render(() => <Welcome />);
      const buttons = container.querySelectorAll("button");
      const newFileBtn = Array.from(buttons).find(b => b.textContent === "New File");
      expect(newFileBtn).toBeTruthy();
      fireEvent.click(newFileBtn!);
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "file:new" }));
      dispatchSpy.mockRestore();
    });

    it("should dispatch folder:open event when Open Folder is clicked", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      const { container } = render(() => <Welcome />);
      const buttons = container.querySelectorAll("button");
      const openFolderBtn = Array.from(buttons).find(b => b.textContent === "Open Folder");
      expect(openFolderBtn).toBeTruthy();
      fireEvent.click(openFolderBtn!);
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "folder:open" }));
      dispatchSpy.mockRestore();
    });

    it("should dispatch git:clone event when Clone Repository is clicked", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      const { container } = render(() => <Welcome />);
      const buttons = container.querySelectorAll("button");
      const cloneBtn = Array.from(buttons).find(b => b.textContent === "Clone Repository");
      expect(cloneBtn).toBeTruthy();
      fireEvent.click(cloneBtn!);
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "git:clone" }));
      dispatchSpy.mockRestore();
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("should render the Getting Started section", () => {
      const { getByText } = render(() => <Welcome />);
      expect(getByText("Getting Started")).toBeTruthy();
    });

    it("should render Command Palette shortcut", () => {
      const { getByText } = render(() => <Welcome />);
      expect(getByText("Command Palette")).toBeTruthy();
    });

    it("should render Open File shortcut", () => {
      const { getByText } = render(() => <Welcome />);
      expect(getByText("Open File")).toBeTruthy();
    });

    it("should render Toggle Terminal shortcut", () => {
      const { getByText } = render(() => <Welcome />);
      expect(getByText("Toggle Terminal")).toBeTruthy();
    });

    it("should render Save File shortcut", () => {
      const { getByText } = render(() => <Welcome />);
      expect(getByText("Save File")).toBeTruthy();
    });
  });

  describe("Documentation Links", () => {
    it("should render the Learn More section", () => {
      const { getByText } = render(() => <Welcome />);
      expect(getByText("Learn More")).toBeTruthy();
    });

    it("should render Documentation link", () => {
      const { getByText } = render(() => <Welcome />);
      const link = getByText("Documentation");
      expect(link).toBeTruthy();
      expect(link.closest("a")?.getAttribute("href")).toBe("https://docs.cortex.dev");
    });

    it("should render Getting Started Guide link", () => {
      const { getByText } = render(() => <Welcome />);
      const link = getByText("Getting Started Guide");
      expect(link).toBeTruthy();
      expect(link.closest("a")?.getAttribute("href")).toBe("https://docs.cortex.dev/getting-started");
    });

    it("should open links in new tab", () => {
      const { getByText } = render(() => <Welcome />);
      const link = getByText("Documentation").closest("a");
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    });
  });

  describe("Recent Projects", () => {
    it("should not render recent projects when list is empty", () => {
      const { queryByTestId } = render(() => <Welcome />);
      expect(queryByTestId("welcome-recent-files")).toBeNull();
    });

    it("should render recent projects when they exist", () => {
      const projects = [
        { id: "1", path: "/home/user/project-a", name: "project-a", lastOpened: Date.now(), pinned: false },
        { id: "2", path: "/home/user/project-b", name: "project-b", lastOpened: Date.now() - 1000, pinned: true },
      ];
      mockRecentProjects.pinnedProjects = () => projects.filter(p => p.pinned);
      mockRecentProjects.unpinnedProjects = () => projects.filter(p => !p.pinned);

      const { getByTestId } = render(() => <Welcome />);
      expect(getByTestId("welcome-recent-files")).toBeTruthy();

      mockRecentProjects.pinnedProjects = () => [];
      mockRecentProjects.unpinnedProjects = () => [];
    });

    it("should call openProject when a recent project is clicked", () => {
      const projects = [
        { id: "1", path: "/home/user/project-a", name: "project-a", lastOpened: Date.now(), pinned: false },
      ];
      mockRecentProjects.pinnedProjects = () => [];
      mockRecentProjects.unpinnedProjects = () => projects;

      const { getByTestId } = render(() => <Welcome />);
      fireEvent.click(getByTestId("project-1"));
      expect(mockRecentProjects.openProject).toHaveBeenCalledWith(projects[0]);

      mockRecentProjects.pinnedProjects = () => [];
      mockRecentProjects.unpinnedProjects = () => [];
    });
  });
});

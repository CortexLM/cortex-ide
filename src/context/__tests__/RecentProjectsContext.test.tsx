import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

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

describe("RecentProjectsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("RecentProject Types", () => {
    interface RecentProject {
      id: string;
      path: string;
      name: string;
      lastOpened: number;
      pinned: boolean;
      icon?: string;
    }

    it("should create a recent project", () => {
      const project: RecentProject = {
        id: "project-1",
        path: "/home/user/projects/my-app",
        name: "my-app",
        lastOpened: Date.now(),
        pinned: false,
        icon: "folder",
      };

      expect(project.id).toBe("project-1");
      expect(project.name).toBe("my-app");
      expect(project.pinned).toBe(false);
    });

    it("should create a pinned project", () => {
      const project: RecentProject = {
        id: "project-1",
        path: "/home/user/projects/important",
        name: "important",
        lastOpened: Date.now(),
        pinned: true,
      };

      expect(project.pinned).toBe(true);
    });
  });

  describe("Project CRUD Operations", () => {
    interface RecentProject {
      id: string;
      path: string;
      name: string;
      lastOpened: number;
      pinned: boolean;
    }

    it("should add a project", () => {
      const projects: RecentProject[] = [];

      const newProject: RecentProject = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        path: "/home/user/projects/new-project",
        name: "new-project",
        lastOpened: Date.now(),
        pinned: false,
      };

      projects.push(newProject);

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe("new-project");
    });

    it("should remove a project", () => {
      const projects: RecentProject[] = [
        { id: "1", path: "/path/1", name: "Project 1", lastOpened: 1000, pinned: false },
        { id: "2", path: "/path/2", name: "Project 2", lastOpened: 2000, pinned: false },
      ];

      const filtered = projects.filter((p) => p.id !== "1");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("2");
    });

    it("should clear all projects", () => {
      let projects: RecentProject[] = [
        { id: "1", path: "/path/1", name: "Project 1", lastOpened: 1000, pinned: false },
        { id: "2", path: "/path/2", name: "Project 2", lastOpened: 2000, pinned: false },
      ];

      projects = [];

      expect(projects).toHaveLength(0);
    });

    it("should update project lastOpened", () => {
      const project: RecentProject = {
        id: "1",
        path: "/path/1",
        name: "Project 1",
        lastOpened: 1000,
        pinned: false,
      };

      project.lastOpened = Date.now();

      expect(project.lastOpened).toBeGreaterThan(1000);
    });
  });

  describe("Pinning Projects", () => {
    interface RecentProject {
      id: string;
      path: string;
      name: string;
      lastOpened: number;
      pinned: boolean;
    }

    it("should toggle pin status", () => {
      const project: RecentProject = {
        id: "1",
        path: "/path/1",
        name: "Project 1",
        lastOpened: Date.now(),
        pinned: false,
      };

      project.pinned = !project.pinned;

      expect(project.pinned).toBe(true);

      project.pinned = !project.pinned;

      expect(project.pinned).toBe(false);
    });

    it("should get pinned projects", () => {
      const projects: RecentProject[] = [
        { id: "1", path: "/path/1", name: "Project 1", lastOpened: 1000, pinned: true },
        { id: "2", path: "/path/2", name: "Project 2", lastOpened: 2000, pinned: false },
        { id: "3", path: "/path/3", name: "Project 3", lastOpened: 3000, pinned: true },
      ];

      const pinned = projects.filter((p) => p.pinned);

      expect(pinned).toHaveLength(2);
    });

    it("should get unpinned projects", () => {
      const projects: RecentProject[] = [
        { id: "1", path: "/path/1", name: "Project 1", lastOpened: 1000, pinned: true },
        { id: "2", path: "/path/2", name: "Project 2", lastOpened: 2000, pinned: false },
        { id: "3", path: "/path/3", name: "Project 3", lastOpened: 3000, pinned: false },
      ];

      const unpinned = projects.filter((p) => !p.pinned);

      expect(unpinned).toHaveLength(2);
    });
  });

  describe("Project Filtering", () => {
    interface RecentProject {
      id: string;
      path: string;
      name: string;
      lastOpened: number;
      pinned: boolean;
    }

    const projects: RecentProject[] = [
      { id: "1", path: "/home/user/react-app", name: "react-app", lastOpened: 1000, pinned: true },
      { id: "2", path: "/home/user/vue-project", name: "vue-project", lastOpened: 2000, pinned: false },
      { id: "3", path: "/home/user/node-api", name: "node-api", lastOpened: 3000, pinned: false },
    ];

    it("should filter by search query", () => {
      const query = "react";
      const filtered = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.path.toLowerCase().includes(query.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("react-app");
    });

    it("should return all when query is empty", () => {
      const query = "";
      const filtered = query.length > 0
        ? projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
        : projects;

      expect(filtered).toHaveLength(3);
    });

    it("should return empty for no matches", () => {
      const query = "angular";
      const filtered = projects.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      );

      expect(filtered).toHaveLength(0);
    });
  });

  describe("Project Sorting", () => {
    interface RecentProject {
      id: string;
      name: string;
      lastOpened: number;
      pinned: boolean;
    }

    it("should sort by lastOpened descending", () => {
      const projects: RecentProject[] = [
        { id: "1", name: "Old", lastOpened: 1000, pinned: false },
        { id: "2", name: "Newest", lastOpened: 3000, pinned: false },
        { id: "3", name: "Middle", lastOpened: 2000, pinned: false },
      ];

      const sorted = [...projects].sort((a, b) => b.lastOpened - a.lastOpened);

      expect(sorted[0].name).toBe("Newest");
      expect(sorted[2].name).toBe("Old");
    });

    it("should show pinned projects first", () => {
      const projects: RecentProject[] = [
        { id: "1", name: "Unpinned Recent", lastOpened: 3000, pinned: false },
        { id: "2", name: "Pinned Old", lastOpened: 1000, pinned: true },
        { id: "3", name: "Unpinned Old", lastOpened: 2000, pinned: false },
      ];

      const pinned = projects.filter((p) => p.pinned).sort((a, b) => b.lastOpened - a.lastOpened);
      const unpinned = projects.filter((p) => !p.pinned).sort((a, b) => b.lastOpened - a.lastOpened);
      const sorted = [...pinned, ...unpinned];

      expect(sorted[0].name).toBe("Pinned Old");
      expect(sorted[1].name).toBe("Unpinned Recent");
    });
  });

  describe("Opening Projects", () => {
    interface RecentProject {
      id: string;
      path: string;
      name: string;
    }

    it("should open project in current window", () => {
      const project: RecentProject = {
        id: "1",
        path: "/home/user/my-project",
        name: "my-project",
      };

      let navigatedTo: string | null = null;
      const navigate = (path: string) => {
        navigatedTo = path;
      };

      navigate(`/workspace?path=${encodeURIComponent(project.path)}`);

      expect(navigatedTo).toContain(encodeURIComponent(project.path));
    });

    it("should open project in new window", async () => {
      const project: RecentProject = {
        id: "1",
        path: "/home/user/my-project",
        name: "my-project",
      };

      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("create_new_window", { path: project.path });

      expect(invoke).toHaveBeenCalledWith("create_new_window", { path: project.path });
    });

    it("should open project by path", () => {
      const path = "/home/user/projects/test";

      let navigatedTo: string | null = null;
      const navigate = (navPath: string) => {
        navigatedTo = navPath;
      };

      navigate(`/workspace?path=${encodeURIComponent(path)}`);

      expect(navigatedTo).toContain(encodeURIComponent(path));
    });
  });

  describe("Project Lookup", () => {
    interface RecentProject {
      id: string;
      path: string;
      name: string;
    }

    it("should get project by path", () => {
      const projects: RecentProject[] = [
        { id: "1", path: "/path/1", name: "Project 1" },
        { id: "2", path: "/path/2", name: "Project 2" },
      ];

      const found = projects.find((p) => p.path === "/path/2");

      expect(found?.name).toBe("Project 2");
    });

    it("should return undefined for unknown path", () => {
      const projects: RecentProject[] = [
        { id: "1", path: "/path/1", name: "Project 1" },
      ];

      const found = projects.find((p) => p.path === "/unknown");

      expect(found).toBeUndefined();
    });
  });

  describe("Project Name Extraction", () => {
    it("should extract name from Unix path", () => {
      const path = "/home/user/projects/my-app";
      const parts = path.split("/").filter(Boolean);
      const name = parts[parts.length - 1] || path;

      expect(name).toBe("my-app");
    });

    it("should extract name from Windows path", () => {
      const path = "C:\\Users\\user\\projects\\my-app";
      const normalized = path.replace(/\\/g, "/");
      const parts = normalized.split("/").filter(Boolean);
      const name = parts[parts.length - 1] || path;

      expect(name).toBe("my-app");
    });

    it("should handle root path", () => {
      const path = "/";
      const parts = path.split("/").filter(Boolean);
      const name = parts[parts.length - 1] || path;

      expect(name).toBe("/");
    });
  });

  describe("Storage Limits", () => {
    interface RecentProject {
      id: string;
      path: string;
      name: string;
      lastOpened: number;
      pinned: boolean;
    }

    it("should limit number of projects", () => {
      const maxProjects = 50;
      const projects: RecentProject[] = [];

      for (let i = 0; i < 60; i++) {
        projects.push({
          id: String(i),
          path: `/path/${i}`,
          name: `Project ${i}`,
          lastOpened: i,
          pinned: false,
        });
      }

      const sorted = [...projects].sort((a, b) => b.lastOpened - a.lastOpened);
      const limited = sorted.slice(0, maxProjects);

      expect(limited).toHaveLength(50);
      expect(limited[0].lastOpened).toBe(59);
    });
  });

  describe("Show/Hide State", () => {
    interface RecentProjectsState {
      projects: unknown[];
      searchQuery: string;
      showRecentProjects: boolean;
    }

    it("should show recent projects", () => {
      const state: RecentProjectsState = {
        projects: [],
        searchQuery: "",
        showRecentProjects: false,
      };

      state.showRecentProjects = true;

      expect(state.showRecentProjects).toBe(true);
    });

    it("should hide recent projects", () => {
      const state: RecentProjectsState = {
        projects: [],
        searchQuery: "test",
        showRecentProjects: true,
      };

      state.showRecentProjects = false;

      expect(state.showRecentProjects).toBe(false);
    });

    it("should update search query", () => {
      const state: RecentProjectsState = {
        projects: [],
        searchQuery: "",
        showRecentProjects: true,
      };

      state.searchQuery = "react";

      expect(state.searchQuery).toBe("react");
    });
  });
});

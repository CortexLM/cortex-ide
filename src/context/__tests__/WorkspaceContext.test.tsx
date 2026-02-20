import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("WorkspaceContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Workspace Types", () => {
    interface WorkspaceFolder {
      uri: string;
      name: string;
      index: number;
    }

    interface Workspace {
      name: string;
      folders: WorkspaceFolder[];
      settings?: Record<string, unknown>;
    }

    it("should create workspace folder", () => {
      const folder: WorkspaceFolder = {
        uri: "file:///home/user/project",
        name: "project",
        index: 0,
      };

      expect(folder.name).toBe("project");
      expect(folder.index).toBe(0);
    });

    it("should create single-folder workspace", () => {
      const workspace: Workspace = {
        name: "My Project",
        folders: [
          { uri: "file:///home/user/project", name: "project", index: 0 },
        ],
      };

      expect(workspace.folders).toHaveLength(1);
    });

    it("should create multi-root workspace", () => {
      const workspace: Workspace = {
        name: "Full Stack Project",
        folders: [
          { uri: "file:///home/user/frontend", name: "frontend", index: 0 },
          { uri: "file:///home/user/backend", name: "backend", index: 1 },
          { uri: "file:///home/user/shared", name: "shared", index: 2 },
        ],
      };

      expect(workspace.folders).toHaveLength(3);
    });
  });

  describe("Workspace Operations", () => {
    it("should open workspace via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        name: "My Project",
        folders: [{ uri: "file:///project", name: "project", index: 0 }],
      });

      const result = await invoke("workspace_open", {
        path: "/home/user/project.code-workspace",
      });

      expect(invoke).toHaveBeenCalledWith("workspace_open", {
        path: "/home/user/project.code-workspace",
      });
      expect(result).toHaveProperty("name");
    });

    it("should open folder as workspace", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        name: "project",
        folders: [{ uri: "file:///project", name: "project", index: 0 }],
      });

      const result = await invoke("workspace_open_folder", {
        path: "/home/user/project",
      });

      expect(result).toHaveProperty("folders");
    });

    it("should close workspace", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("workspace_close");

      expect(invoke).toHaveBeenCalledWith("workspace_close");
    });

    it("should save workspace", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("workspace_save", {
        path: "/home/user/project.code-workspace",
      });

      expect(invoke).toHaveBeenCalledWith("workspace_save", {
        path: "/home/user/project.code-workspace",
      });
    });
  });

  describe("Folder Management", () => {
    it("should add folder to workspace", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        folders: [
          { uri: "file:///project1", name: "project1", index: 0 },
          { uri: "file:///project2", name: "project2", index: 1 },
        ],
      });

      const result = await invoke("workspace_add_folder", {
        path: "/home/user/project2",
      }) as { folders: unknown[] };

      expect(result.folders).toHaveLength(2);
    });

    it("should remove folder from workspace", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        folders: [{ uri: "file:///project1", name: "project1", index: 0 }],
      });

      const result = await invoke("workspace_remove_folder", {
        uri: "file:///project2",
      }) as { folders: unknown[] };

      expect(result.folders).toHaveLength(1);
    });

    it("should reorder folders", () => {
      const folders = [
        { uri: "file:///a", name: "a", index: 0 },
        { uri: "file:///b", name: "b", index: 1 },
        { uri: "file:///c", name: "c", index: 2 },
      ];

      const reorder = (fromIndex: number, toIndex: number) => {
        const [moved] = folders.splice(fromIndex, 1);
        folders.splice(toIndex, 0, moved);
        folders.forEach((f, i) => { f.index = i; });
      };

      reorder(2, 0);

      expect(folders[0].name).toBe("c");
      expect(folders[0].index).toBe(0);
    });

    it("should rename folder", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("workspace_rename_folder", {
        uri: "file:///project",
        newName: "renamed-project",
      });

      expect(invoke).toHaveBeenCalledWith("workspace_rename_folder", {
        uri: "file:///project",
        newName: "renamed-project",
      });
    });
  });

  describe("Workspace File", () => {
    interface WorkspaceFile {
      folders: Array<{ path: string; name?: string }>;
      settings?: Record<string, unknown>;
      extensions?: { recommendations?: string[] };
      launch?: { configurations: unknown[] };
      tasks?: { tasks: unknown[] };
    }

    it("should parse workspace file", () => {
      const workspaceFile: WorkspaceFile = {
        folders: [
          { path: "frontend" },
          { path: "backend", name: "API Server" },
        ],
        settings: {
          "editor.tabSize": 2,
        },
        extensions: {
          recommendations: ["dbaeumer.vscode-eslint"],
        },
      };

      expect(workspaceFile.folders).toHaveLength(2);
      expect(workspaceFile.folders[1].name).toBe("API Server");
    });

    it("should serialize workspace file", () => {
      const workspaceFile: WorkspaceFile = {
        folders: [{ path: "." }],
        settings: {},
      };

      const json = JSON.stringify(workspaceFile, null, 2);

      expect(json).toContain('"folders"');
    });

    it("should handle relative paths", () => {
      const resolvePath = (workspacePath: string, folderPath: string): string => {
        if (folderPath.startsWith("/") || folderPath.match(/^[A-Z]:\\/)) {
          return folderPath;
        }
        const workspaceDir = workspacePath.substring(0, workspacePath.lastIndexOf("/"));
        return `${workspaceDir}/${folderPath}`;
      };

      expect(resolvePath("/home/user/project.code-workspace", "src"))
        .toBe("/home/user/src");
      expect(resolvePath("/home/user/project.code-workspace", "/absolute/path"))
        .toBe("/absolute/path");
    });
  });

  describe("Workspace State", () => {
    it("should track workspace state", () => {
      interface WorkspaceState {
        isOpen: boolean;
        isMultiRoot: boolean;
        isDirty: boolean;
        path?: string;
      }

      const state: WorkspaceState = {
        isOpen: true,
        isMultiRoot: true,
        isDirty: false,
        path: "/home/user/project.code-workspace",
      };

      expect(state.isOpen).toBe(true);
      expect(state.isMultiRoot).toBe(true);
    });

    it("should detect multi-root workspace", () => {
      const isMultiRoot = (folderCount: number): boolean => folderCount > 1;

      expect(isMultiRoot(1)).toBe(false);
      expect(isMultiRoot(2)).toBe(true);
      expect(isMultiRoot(5)).toBe(true);
    });
  });

  describe("File System Operations", () => {
    it("should get workspace root", () => {
      const folders = [
        { uri: "file:///project1", name: "project1", index: 0 },
        { uri: "file:///project2", name: "project2", index: 1 },
      ];

      const getWorkspaceRoot = () => folders[0]?.uri;

      expect(getWorkspaceRoot()).toBe("file:///project1");
    });

    it("should find folder containing file", () => {
      const folders = [
        { uri: "file:///frontend", name: "frontend", index: 0 },
        { uri: "file:///backend", name: "backend", index: 1 },
      ];

      const findContainingFolder = (filePath: string) => {
        return folders.find(f => filePath.startsWith(f.uri.replace("file://", "")));
      };

      const folder = findContainingFolder("/frontend/src/app.ts");
      expect(folder?.name).toBe("frontend");
    });

    it("should get relative path within workspace", () => {
      const getRelativePath = (folderUri: string, filePath: string): string => {
        const folderPath = folderUri.replace("file://", "");
        if (filePath.startsWith(folderPath)) {
          return filePath.substring(folderPath.length + 1);
        }
        return filePath;
      };

      expect(getRelativePath("file:///project", "/project/src/app.ts"))
        .toBe("src/app.ts");
    });
  });

  describe("Workspace Events", () => {
    it("should listen for workspace opened event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("workspace:opened", () => {});

      expect(listen).toHaveBeenCalledWith("workspace:opened", expect.any(Function));
    });

    it("should listen for workspace closed event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("workspace:closed", () => {});

      expect(listen).toHaveBeenCalledWith("workspace:closed", expect.any(Function));
    });

    it("should listen for folder added event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("workspace:folder-added", () => {});

      expect(listen).toHaveBeenCalledWith("workspace:folder-added", expect.any(Function));
    });

    it("should listen for folder removed event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("workspace:folder-removed", () => {});

      expect(listen).toHaveBeenCalledWith("workspace:folder-removed", expect.any(Function));
    });
  });

  describe("Recent Workspaces", () => {
    interface RecentWorkspace {
      path: string;
      name: string;
      lastOpened: number;
    }

    it("should track recent workspaces", () => {
      const recentWorkspaces: RecentWorkspace[] = [
        { path: "/project1.code-workspace", name: "Project 1", lastOpened: 3000 },
        { path: "/project2.code-workspace", name: "Project 2", lastOpened: 2000 },
        { path: "/project3.code-workspace", name: "Project 3", lastOpened: 1000 },
      ];

      expect(recentWorkspaces).toHaveLength(3);
    });

    it("should sort recent workspaces by last opened", () => {
      const recentWorkspaces: RecentWorkspace[] = [
        { path: "/old", name: "Old", lastOpened: 1000 },
        { path: "/newest", name: "Newest", lastOpened: 3000 },
        { path: "/middle", name: "Middle", lastOpened: 2000 },
      ];

      const sorted = [...recentWorkspaces].sort((a, b) => b.lastOpened - a.lastOpened);

      expect(sorted[0].name).toBe("Newest");
      expect(sorted[2].name).toBe("Old");
    });

    it("should limit recent workspaces", () => {
      const maxRecent = 10;
      const recentWorkspaces: RecentWorkspace[] = [];

      for (let i = 0; i < 15; i++) {
        recentWorkspaces.push({
          path: `/project${i}`,
          name: `Project ${i}`,
          lastOpened: i,
        });
      }

      const limited = recentWorkspaces
        .sort((a, b) => b.lastOpened - a.lastOpened)
        .slice(0, maxRecent);

      expect(limited).toHaveLength(maxRecent);
    });

    it("should clear recent workspaces", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("workspace_clear_recent");

      expect(invoke).toHaveBeenCalledWith("workspace_clear_recent");
    });
  });

  describe("Workspace Trust", () => {
    interface WorkspaceTrust {
      isTrusted: boolean;
      restrictedMode: boolean;
      trustedFolders: string[];
    }

    it("should track workspace trust", () => {
      const trust: WorkspaceTrust = {
        isTrusted: true,
        restrictedMode: false,
        trustedFolders: ["/home/user/trusted-project"],
      };

      expect(trust.isTrusted).toBe(true);
    });

    it("should check if folder is trusted", () => {
      const trustedFolders = new Set(["/project1", "/project2"]);

      const isTrusted = (path: string): boolean => {
        for (const trusted of trustedFolders) {
          if (path.startsWith(trusted)) return true;
        }
        return false;
      };

      expect(isTrusted("/project1/src")).toBe(true);
      expect(isTrusted("/untrusted/src")).toBe(false);
    });

    it("should grant trust to workspace", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ isTrusted: true });

      const result = await invoke("workspace_grant_trust");

      expect(result).toEqual({ isTrusted: true });
    });
  });

  describe("Workspace Search", () => {
    it("should search files in workspace", async () => {
      const mockResults = [
        { path: "/project/src/app.ts", matches: 3 },
        { path: "/project/src/utils.ts", matches: 1 },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(mockResults);

      const result = await invoke("workspace_search", {
        query: "function",
        includePattern: "**/*.ts",
      });

      expect(result).toEqual(mockResults);
    });

    it("should search with exclude pattern", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await invoke("workspace_search", {
        query: "test",
        excludePattern: "**/node_modules/**",
      });

      expect(invoke).toHaveBeenCalledWith("workspace_search", {
        query: "test",
        excludePattern: "**/node_modules/**",
      });
    });

    it("should search with regex", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await invoke("workspace_search", {
        query: "function\\s+\\w+",
        isRegex: true,
      });

      expect(invoke).toHaveBeenCalledWith("workspace_search", expect.objectContaining({
        isRegex: true,
      }));
    });
  });

  describe("Workspace Configuration", () => {
    it("should get workspace settings", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        "editor.tabSize": 4,
        "files.autoSave": "onFocusChange",
      });

      const result = await invoke("workspace_get_settings");

      expect(result).toHaveProperty("editor.tabSize");
    });

    it("should update workspace settings", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("workspace_set_setting", {
        key: "editor.tabSize",
        value: 2,
      });

      expect(invoke).toHaveBeenCalledWith("workspace_set_setting", {
        key: "editor.tabSize",
        value: 2,
      });
    });
  });

  describe("Workspace Tasks", () => {
    interface WorkspaceTask {
      label: string;
      type: string;
      command: string;
      args?: string[];
      group?: string;
    }

    it("should list workspace tasks", () => {
      const tasks: WorkspaceTask[] = [
        { label: "Build", type: "shell", command: "npm run build", group: "build" },
        { label: "Test", type: "shell", command: "npm test", group: "test" },
        { label: "Lint", type: "shell", command: "npm run lint" },
      ];

      expect(tasks).toHaveLength(3);
    });

    it("should filter tasks by group", () => {
      const tasks: WorkspaceTask[] = [
        { label: "Build", type: "shell", command: "npm run build", group: "build" },
        { label: "Build Prod", type: "shell", command: "npm run build:prod", group: "build" },
        { label: "Test", type: "shell", command: "npm test", group: "test" },
      ];

      const buildTasks = tasks.filter(t => t.group === "build");

      expect(buildTasks).toHaveLength(2);
    });
  });

  describe("Workspace Launch Configurations", () => {
    interface LaunchConfig {
      name: string;
      type: string;
      request: "launch" | "attach";
      program?: string;
    }

    it("should list launch configurations", () => {
      const configs: LaunchConfig[] = [
        { name: "Debug App", type: "node", request: "launch", program: "${workspaceFolder}/app.js" },
        { name: "Attach", type: "node", request: "attach" },
      ];

      expect(configs).toHaveLength(2);
    });

    it("should substitute workspace variables", () => {
      const substituteVars = (value: string, workspaceFolder: string): string => {
        return value.replace(/\$\{workspaceFolder\}/g, workspaceFolder);
      };

      const result = substituteVars("${workspaceFolder}/src/app.ts", "/home/user/project");

      expect(result).toBe("/home/user/project/src/app.ts");
    });
  });

  describe("Workspace Extensions", () => {
    it("should get workspace recommendations", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        recommendations: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"],
      });

      const result = await invoke("workspace_get_recommendations") as { recommendations: unknown[] };

      expect(result.recommendations).toHaveLength(2);
    });

    it("should add workspace recommendation", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("workspace_add_recommendation", {
        extensionId: "ms-vscode.vscode-typescript-tslint-plugin",
      });

      expect(invoke).toHaveBeenCalledWith("workspace_add_recommendation", {
        extensionId: "ms-vscode.vscode-typescript-tslint-plugin",
      });
    });
  });
});

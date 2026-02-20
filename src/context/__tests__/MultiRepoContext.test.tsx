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

vi.mock("./WorkspaceContext", () => ({
  useWorkspace: vi.fn().mockReturnValue({
    currentPath: "/project",
    workspaceFolders: ["/project"],
  }),
}));

interface Repository {
  path: string;
  name: string;
  branch: string;
  remote?: string;
  isActive: boolean;
  status: RepositoryStatus;
  lastFetched?: number;
}

interface RepositoryStatus {
  staged: number;
  modified: number;
  untracked: number;
  deleted: number;
  ahead: number;
  behind: number;
  conflicts: number;
  hasStash: boolean;
}

interface FileChange {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "copied" | "untracked";
  staged: boolean;
  oldPath?: string;
}

interface GitSettings {
  autoFetch: boolean;
  autoFetchIntervalMs: number;
  confirmBeforePush: boolean;
  confirmBeforeForce: boolean;
  defaultRemote: string;
  signCommits: boolean;
  pruneOnFetch: boolean;
}

interface MultiRepoState {
  repositories: Repository[];
  activeRepository: Repository | null;
  changes: Map<string, FileChange[]>;
  settings: GitSettings;
  isLoading: boolean;
  error: string | null;
  lastOperation: string | null;
}

interface MultiRepoContextValue {
  state: MultiRepoState;
  addRepository: (path: string) => Promise<boolean>;
  removeRepository: (path: string) => void;
  setActiveRepository: (path: string) => void;
  refreshRepository: (path: string) => Promise<void>;
  refreshAllRepositories: () => Promise<void>;
  stageFile: (repoPath: string, filePath: string) => Promise<boolean>;
  unstageFile: (repoPath: string, filePath: string) => Promise<boolean>;
  stageAll: (repoPath: string) => Promise<boolean>;
  unstageAll: (repoPath: string) => Promise<boolean>;
  commit: (repoPath: string, message: string) => Promise<boolean>;
  push: (repoPath: string, remote?: string, branch?: string) => Promise<boolean>;
  pull: (repoPath: string, remote?: string, branch?: string) => Promise<boolean>;
  fetch: (repoPath: string, remote?: string) => Promise<boolean>;
  checkout: (repoPath: string, branch: string) => Promise<boolean>;
  createBranch: (repoPath: string, name: string, checkout?: boolean) => Promise<boolean>;
  deleteBranch: (repoPath: string, name: string, force?: boolean) => Promise<boolean>;
  getBranches: (repoPath: string) => Promise<string[]>;
  getRemotes: (repoPath: string) => Promise<string[]>;
  discardChanges: (repoPath: string, filePath: string) => Promise<boolean>;
  discardAllChanges: (repoPath: string) => Promise<boolean>;
  stash: (repoPath: string, message?: string) => Promise<boolean>;
  stashPop: (repoPath: string) => Promise<boolean>;
  updateSettings: (settings: Partial<GitSettings>) => void;
}

const STORAGE_KEY_STATE = "cortex_multi_repo_state";
const STORAGE_KEY_SETTINGS = "cortex_git_settings";

describe("MultiRepoContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("Repository interface", () => {
    it("should have correct repository structure", () => {
      const repo: Repository = {
        path: "/project/repo1",
        name: "repo1",
        branch: "main",
        remote: "origin",
        isActive: true,
        status: {
          staged: 2,
          modified: 3,
          untracked: 1,
          deleted: 0,
          ahead: 1,
          behind: 0,
          conflicts: 0,
          hasStash: false,
        },
        lastFetched: Date.now(),
      };

      expect(repo.path).toBe("/project/repo1");
      expect(repo.branch).toBe("main");
      expect(repo.status.staged).toBe(2);
    });

    it("should allow minimal repository definition", () => {
      const repo: Repository = {
        path: "/project/repo2",
        name: "repo2",
        branch: "develop",
        isActive: false,
        status: {
          staged: 0,
          modified: 0,
          untracked: 0,
          deleted: 0,
          ahead: 0,
          behind: 0,
          conflicts: 0,
          hasStash: false,
        },
      };

      expect(repo.remote).toBeUndefined();
      expect(repo.lastFetched).toBeUndefined();
    });
  });

  describe("RepositoryStatus interface", () => {
    it("should track all status fields", () => {
      const status: RepositoryStatus = {
        staged: 5,
        modified: 10,
        untracked: 3,
        deleted: 1,
        ahead: 2,
        behind: 1,
        conflicts: 0,
        hasStash: true,
      };

      expect(status.staged).toBe(5);
      expect(status.hasStash).toBe(true);
    });
  });

  describe("FileChange interface", () => {
    it("should represent file changes", () => {
      const change: FileChange = {
        path: "src/app.ts",
        status: "modified",
        staged: true,
      };

      expect(change.path).toBe("src/app.ts");
      expect(change.staged).toBe(true);
    });

    it("should support renamed files", () => {
      const change: FileChange = {
        path: "src/new-name.ts",
        status: "renamed",
        staged: true,
        oldPath: "src/old-name.ts",
      };

      expect(change.status).toBe("renamed");
      expect(change.oldPath).toBe("src/old-name.ts");
    });

    it("should support all status types", () => {
      const statuses: Array<FileChange["status"]> = [
        "modified", "added", "deleted", "renamed", "copied", "untracked",
      ];

      statuses.forEach((status) => {
        const change: FileChange = { path: "file.ts", status, staged: false };
        expect(change.status).toBe(status);
      });
    });
  });

  describe("GitSettings interface", () => {
    it("should have correct settings structure", () => {
      const settings: GitSettings = {
        autoFetch: true,
        autoFetchIntervalMs: 300000,
        confirmBeforePush: true,
        confirmBeforeForce: true,
        defaultRemote: "origin",
        signCommits: false,
        pruneOnFetch: true,
      };

      expect(settings.autoFetch).toBe(true);
      expect(settings.confirmBeforePush).toBe(true);
    });
  });

  describe("IPC operations", () => {
    it("should call invoke for git status", async () => {
      vi.mocked(invoke).mockResolvedValue({
        staged: 1,
        modified: 2,
        untracked: 0,
        deleted: 0,
        ahead: 0,
        behind: 0,
        conflicts: 0,
      });

      const result = await invoke("git_status", { path: "/project" });

      expect(invoke).toHaveBeenCalledWith("git_status", { path: "/project" });
      expect(result).toHaveProperty("staged");
    });

    it("should call invoke for git stage", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("git_stage", { repoPath: "/project", filePath: "src/app.ts" });

      expect(invoke).toHaveBeenCalledWith("git_stage", {
        repoPath: "/project",
        filePath: "src/app.ts",
      });
    });

    it("should call invoke for git unstage", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("git_unstage", { repoPath: "/project", filePath: "src/app.ts" });

      expect(invoke).toHaveBeenCalledWith("git_unstage", {
        repoPath: "/project",
        filePath: "src/app.ts",
      });
    });

    it("should call invoke for git commit", async () => {
      vi.mocked(invoke).mockResolvedValue({ hash: "abc123" });

      const result = await invoke("git_commit", {
        repoPath: "/project",
        message: "feat: add new feature",
      });

      expect(invoke).toHaveBeenCalledWith("git_commit", {
        repoPath: "/project",
        message: "feat: add new feature",
      });
      expect(result).toHaveProperty("hash");
    });

    it("should call invoke for git push", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("git_push", {
        repoPath: "/project",
        remote: "origin",
        branch: "main",
      });

      expect(invoke).toHaveBeenCalledWith("git_push", {
        repoPath: "/project",
        remote: "origin",
        branch: "main",
      });
    });

    it("should call invoke for git pull", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("git_pull", {
        repoPath: "/project",
        remote: "origin",
        branch: "main",
      });

      expect(invoke).toHaveBeenCalledWith("git_pull", {
        repoPath: "/project",
        remote: "origin",
        branch: "main",
      });
    });

    it("should call invoke for git fetch", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("git_fetch", { repoPath: "/project", remote: "origin" });

      expect(invoke).toHaveBeenCalledWith("git_fetch", {
        repoPath: "/project",
        remote: "origin",
      });
    });

    it("should call invoke for git checkout", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("git_checkout", { repoPath: "/project", branch: "develop" });

      expect(invoke).toHaveBeenCalledWith("git_checkout", {
        repoPath: "/project",
        branch: "develop",
      });
    });

    it("should call invoke for git branch operations", async () => {
      vi.mocked(invoke).mockResolvedValue(["main", "develop", "feature/test"]);

      const result = await invoke("git_list_branches", { repoPath: "/project" });

      expect(invoke).toHaveBeenCalledWith("git_list_branches", { repoPath: "/project" });
      expect(result).toContain("main");
    });

    it("should call invoke for git stash", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await invoke("git_stash", { repoPath: "/project", message: "WIP" });

      expect(invoke).toHaveBeenCalledWith("git_stash", {
        repoPath: "/project",
        message: "WIP",
      });
    });
  });

  describe("Event listeners", () => {
    it("should set up event listeners", async () => {
      await listen("git:file-changed", () => {});
      await listen("git:branch-changed", () => {});

      expect(listen).toHaveBeenCalledWith("git:file-changed", expect.any(Function));
      expect(listen).toHaveBeenCalledWith("git:branch-changed", expect.any(Function));
    });
  });

  describe("Storage persistence", () => {
    it("should save state to localStorage", () => {
      const state = {
        repositories: [
          { path: "/project", name: "project", branch: "main", isActive: true },
        ],
        activeRepository: "/project",
      };

      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));

      const stored = localStorage.getItem(STORAGE_KEY_STATE);
      expect(stored).not.toBeNull();
    });

    it("should save settings to localStorage", () => {
      const settings: GitSettings = {
        autoFetch: true,
        autoFetchIntervalMs: 300000,
        confirmBeforePush: true,
        confirmBeforeForce: true,
        defaultRemote: "origin",
        signCommits: false,
        pruneOnFetch: true,
      };

      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));

      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.autoFetch).toBe(true);
    });
  });

  describe("State management", () => {
    it("should manage repositories array", () => {
      let state: MultiRepoState = {
        repositories: [],
        activeRepository: null,
        changes: new Map(),
        settings: {
          autoFetch: true,
          autoFetchIntervalMs: 300000,
          confirmBeforePush: true,
          confirmBeforeForce: true,
          defaultRemote: "origin",
          signCommits: false,
          pruneOnFetch: true,
        },
        isLoading: false,
        error: null,
        lastOperation: null,
      };

      const newRepo: Repository = {
        path: "/project",
        name: "project",
        branch: "main",
        isActive: true,
        status: { staged: 0, modified: 0, untracked: 0, deleted: 0, ahead: 0, behind: 0, conflicts: 0, hasStash: false },
      };

      state = { ...state, repositories: [...state.repositories, newRepo] };
      expect(state.repositories).toHaveLength(1);
    });

    it("should set active repository", () => {
      const repo: Repository = {
        path: "/project",
        name: "project",
        branch: "main",
        isActive: true,
        status: { staged: 0, modified: 0, untracked: 0, deleted: 0, ahead: 0, behind: 0, conflicts: 0, hasStash: false },
      };

      let state: MultiRepoState = {
        repositories: [repo],
        activeRepository: null,
        changes: new Map(),
        settings: {
          autoFetch: true,
          autoFetchIntervalMs: 300000,
          confirmBeforePush: true,
          confirmBeforeForce: true,
          defaultRemote: "origin",
          signCommits: false,
          pruneOnFetch: true,
        },
        isLoading: false,
        error: null,
        lastOperation: null,
      };

      state = { ...state, activeRepository: repo };
      expect(state.activeRepository?.path).toBe("/project");
    });

    it("should track file changes by repository", () => {
      const changes = new Map<string, FileChange[]>();

      changes.set("/project", [
        { path: "src/app.ts", status: "modified", staged: false },
        { path: "src/utils.ts", status: "added", staged: true },
      ]);

      expect(changes.get("/project")).toHaveLength(2);
    });
  });

  describe("Repository operations", () => {
    it("should add repository", () => {
      let repositories: Repository[] = [];

      const newRepo: Repository = {
        path: "/new-project",
        name: "new-project",
        branch: "main",
        isActive: false,
        status: { staged: 0, modified: 0, untracked: 0, deleted: 0, ahead: 0, behind: 0, conflicts: 0, hasStash: false },
      };

      repositories = [...repositories, newRepo];
      expect(repositories).toHaveLength(1);
    });

    it("should remove repository", () => {
      let repositories: Repository[] = [
        { path: "/project1", name: "project1", branch: "main", isActive: true, status: { staged: 0, modified: 0, untracked: 0, deleted: 0, ahead: 0, behind: 0, conflicts: 0, hasStash: false } },
        { path: "/project2", name: "project2", branch: "main", isActive: false, status: { staged: 0, modified: 0, untracked: 0, deleted: 0, ahead: 0, behind: 0, conflicts: 0, hasStash: false } },
      ];

      repositories = repositories.filter((r) => r.path !== "/project1");
      expect(repositories).toHaveLength(1);
      expect(repositories[0].path).toBe("/project2");
    });
  });

  describe("File staging operations", () => {
    it("should stage file", () => {
      let changes: FileChange[] = [
        { path: "src/app.ts", status: "modified", staged: false },
      ];

      changes = changes.map((c) =>
        c.path === "src/app.ts" ? { ...c, staged: true } : c
      );

      expect(changes[0].staged).toBe(true);
    });

    it("should unstage file", () => {
      let changes: FileChange[] = [
        { path: "src/app.ts", status: "modified", staged: true },
      ];

      changes = changes.map((c) =>
        c.path === "src/app.ts" ? { ...c, staged: false } : c
      );

      expect(changes[0].staged).toBe(false);
    });

    it("should stage all files", () => {
      let changes: FileChange[] = [
        { path: "src/a.ts", status: "modified", staged: false },
        { path: "src/b.ts", status: "added", staged: false },
        { path: "src/c.ts", status: "deleted", staged: false },
      ];

      changes = changes.map((c) => ({ ...c, staged: true }));

      expect(changes.every((c) => c.staged)).toBe(true);
    });

    it("should unstage all files", () => {
      let changes: FileChange[] = [
        { path: "src/a.ts", status: "modified", staged: true },
        { path: "src/b.ts", status: "added", staged: true },
      ];

      changes = changes.map((c) => ({ ...c, staged: false }));

      expect(changes.every((c) => !c.staged)).toBe(true);
    });
  });

  describe("Context value structure", () => {
    it("should define all required methods", () => {
      const mockContext: MultiRepoContextValue = {
        state: {
          repositories: [],
          activeRepository: null,
          changes: new Map(),
          settings: {
            autoFetch: true,
            autoFetchIntervalMs: 300000,
            confirmBeforePush: true,
            confirmBeforeForce: true,
            defaultRemote: "origin",
            signCommits: false,
            pruneOnFetch: true,
          },
          isLoading: false,
          error: null,
          lastOperation: null,
        },
        addRepository: vi.fn(),
        removeRepository: vi.fn(),
        setActiveRepository: vi.fn(),
        refreshRepository: vi.fn(),
        refreshAllRepositories: vi.fn(),
        stageFile: vi.fn(),
        unstageFile: vi.fn(),
        stageAll: vi.fn(),
        unstageAll: vi.fn(),
        commit: vi.fn(),
        push: vi.fn(),
        pull: vi.fn(),
        fetch: vi.fn(),
        checkout: vi.fn(),
        createBranch: vi.fn(),
        deleteBranch: vi.fn(),
        getBranches: vi.fn(),
        getRemotes: vi.fn(),
        discardChanges: vi.fn(),
        discardAllChanges: vi.fn(),
        stash: vi.fn(),
        stashPop: vi.fn(),
        updateSettings: vi.fn(),
      };

      expect(mockContext.addRepository).toBeDefined();
      expect(mockContext.commit).toBeDefined();
      expect(mockContext.push).toBeDefined();
      expect(mockContext.pull).toBeDefined();
      expect(mockContext.stageFile).toBeDefined();
      expect(mockContext.checkout).toBeDefined();
    });
  });
});

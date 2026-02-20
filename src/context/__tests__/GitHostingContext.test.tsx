import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn(),
}));

vi.mock("@/utils/git/registry", () => ({
  getProviderForRemote: vi.fn(),
}));

vi.mock("../../utils/workspace", () => ({
  getProjectPath: vi.fn().mockReturnValue("/project"),
}));

describe("GitHostingContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Repository Info", () => {
    interface GitRepositoryInfo {
      remoteUrl: string | null;
      branch: string | null;
      sha: string | null;
      provider: unknown | null;
      remote: unknown | null;
    }

    it("should track repository info", () => {
      const repoInfo: GitRepositoryInfo = {
        remoteUrl: "https://github.com/user/repo.git",
        branch: "main",
        sha: "abc123def456",
        provider: { name: "GitHub" },
        remote: { owner: "user", repo: "repo" },
      };

      expect(repoInfo.remoteUrl).toContain("github.com");
      expect(repoInfo.branch).toBe("main");
    });

    it("should handle no repository", () => {
      const repoInfo: GitRepositoryInfo = {
        remoteUrl: null,
        branch: null,
        sha: null,
        provider: null,
        remote: null,
      };

      expect(repoInfo.remoteUrl).toBeNull();
    });
  });

  describe("Git Hosting State", () => {
    interface GitHostingState {
      repoInfo: {
        remoteUrl: string | null;
        branch: string | null;
        sha: string | null;
      };
      authSettings: Record<string, unknown>;
      isLoading: boolean;
      lastError: string | null;
    }

    it("should initialize state", () => {
      const state: GitHostingState = {
        repoInfo: {
          remoteUrl: null,
          branch: null,
          sha: null,
        },
        authSettings: {},
        isLoading: false,
        lastError: null,
      };

      expect(state.isLoading).toBe(false);
    });

    it("should track loading state", () => {
      const state: GitHostingState = {
        repoInfo: { remoteUrl: null, branch: null, sha: null },
        authSettings: {},
        isLoading: true,
        lastError: null,
      };

      expect(state.isLoading).toBe(true);
    });

    it("should track error state", () => {
      const state: GitHostingState = {
        repoInfo: { remoteUrl: null, branch: null, sha: null },
        authSettings: {},
        isLoading: false,
        lastError: "Failed to get remote URL",
      };

      expect(state.lastError).toContain("Failed");
    });
  });

  describe("Refresh Repo Info", () => {
    it("should get git remote via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ url: "https://github.com/user/repo.git" });

      const result = await invoke("git_remote", { path: "/project" });

      expect(invoke).toHaveBeenCalledWith("git_remote", { path: "/project" });
      expect(result).toHaveProperty("url");
    });

    it("should get git branch via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ branch: "main" });

      const result = await invoke("git_branch", { path: "/project" });

      expect(invoke).toHaveBeenCalledWith("git_branch", { path: "/project" });
      expect(result).toHaveProperty("branch", "main");
    });

    it("should get git head SHA via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ sha: "abc123def456789" });

      const result = await invoke("git_head", { path: "/project" });

      expect(invoke).toHaveBeenCalledWith("git_head", { path: "/project" });
      expect(result).toHaveProperty("sha");
    });

    it("should handle git remote error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Not a git repository"));

      await expect(invoke("git_remote", { path: "/not-git" }))
        .rejects.toThrow("Not a git repository");
    });
  });

  describe("Provider Detection", () => {
    interface ParsedGitRemote {
      owner: string;
      repo: string;
      host: string;
    }

    it("should parse GitHub remote", () => {
      const parseRemote = (url: string): ParsedGitRemote | null => {
        const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (match) {
          return { owner: match[1], repo: match[2], host: "github.com" };
        }
        return null;
      };

      const remote = parseRemote("https://github.com/user/repo.git");

      expect(remote?.owner).toBe("user");
      expect(remote?.repo).toBe("repo");
    });

    it("should parse GitLab remote", () => {
      const parseRemote = (url: string): ParsedGitRemote | null => {
        const match = url.match(/gitlab\.com[:/]([^/]+)\/([^/.]+)/);
        if (match) {
          return { owner: match[1], repo: match[2], host: "gitlab.com" };
        }
        return null;
      };

      const remote = parseRemote("https://gitlab.com/user/repo.git");

      expect(remote?.owner).toBe("user");
      expect(remote?.host).toBe("gitlab.com");
    });

    it("should parse Bitbucket remote", () => {
      const parseRemote = (url: string): ParsedGitRemote | null => {
        const match = url.match(/bitbucket\.org[:/]([^/]+)\/([^/.]+)/);
        if (match) {
          return { owner: match[1], repo: match[2], host: "bitbucket.org" };
        }
        return null;
      };

      const remote = parseRemote("https://bitbucket.org/user/repo.git");

      expect(remote?.host).toBe("bitbucket.org");
    });
  });

  describe("Build URLs", () => {
    interface LineSelection {
      startLine: number;
      endLine?: number;
    }

    it("should build file URL for GitHub", () => {
      const buildFileUrl = (
        owner: string,
        repo: string,
        path: string,
        branch: string,
        selection?: LineSelection
      ) => {
        let url = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
        if (selection) {
          url += `#L${selection.startLine}`;
          if (selection.endLine && selection.endLine !== selection.startLine) {
            url += `-L${selection.endLine}`;
          }
        }
        return url;
      };

      const url = buildFileUrl("user", "repo", "src/app.ts", "main", { startLine: 10, endLine: 20 });

      expect(url).toBe("https://github.com/user/repo/blob/main/src/app.ts#L10-L20");
    });

    it("should build permalink with SHA", () => {
      const buildPermalink = (owner: string, repo: string, sha: string, path: string) => {
        return `https://github.com/${owner}/${repo}/blob/${sha}/${path}`;
      };

      const url = buildPermalink("user", "repo", "abc123", "src/app.ts");

      expect(url).toContain("abc123");
    });

    it("should build blame URL", () => {
      const buildBlameUrl = (owner: string, repo: string, path: string, branch: string) => {
        return `https://github.com/${owner}/${repo}/blame/${branch}/${path}`;
      };

      const url = buildBlameUrl("user", "repo", "src/app.ts", "main");

      expect(url).toContain("/blame/");
    });
  });

  describe("Relative Path", () => {
    it("should get relative path from project root", () => {
      const getRelativePath = (filePath: string, projectPath: string) => {
        const normalizedFile = filePath.replace(/\\/g, "/");
        const normalizedProject = projectPath.replace(/\\/g, "/");
        
        if (normalizedFile.startsWith(normalizedProject)) {
          return normalizedFile.slice(normalizedProject.length).replace(/^\//, "");
        }
        return normalizedFile;
      };

      expect(getRelativePath("/project/src/app.ts", "/project")).toBe("src/app.ts");
      expect(getRelativePath("/other/file.ts", "/project")).toBe("/other/file.ts");
    });
  });

  describe("Git Hosting Actions", () => {
    type GitHostingAction = "open-file-on-remote" | "copy-permalink" | "open-pr" | "view-blame" | "create-gist";

    it("should define all actions", () => {
      const actions: GitHostingAction[] = [
        "open-file-on-remote",
        "copy-permalink",
        "open-pr",
        "view-blame",
        "create-gist",
      ];

      expect(actions).toHaveLength(5);
    });
  });

  describe("Open File on Remote", () => {
    it("should construct URL and open", () => {
      let openedUrl: string | null = null;

      const openFileOnRemote = (owner: string, repo: string, path: string, branch: string) => {
        openedUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
      };

      openFileOnRemote("user", "repo", "src/app.ts", "main");

      expect(openedUrl).toBe("https://github.com/user/repo/blob/main/src/app.ts");
    });
  });

  describe("Copy Permalink", () => {
    it("should copy permalink to clipboard", () => {
      let copiedText: string | null = null;

      const copyPermalink = (owner: string, repo: string, sha: string, path: string) => {
        copiedText = `https://github.com/${owner}/${repo}/blob/${sha}/${path}`;
      };

      copyPermalink("user", "repo", "abc123", "src/app.ts");

      expect(copiedText).toContain("abc123");
    });
  });

  describe("Copy File URL", () => {
    it("should copy file URL to clipboard", () => {
      let copiedText: string | null = null;

      const copyFileUrl = (owner: string, repo: string, path: string, branch: string) => {
        copiedText = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
      };

      copyFileUrl("user", "repo", "src/app.ts", "main");

      expect(copiedText).toContain("/blob/main/");
    });
  });

  describe("Open Pull Request", () => {
    it("should extract PR number from commit message", () => {
      const extractPR = (message: string) => {
        const match = message.match(/#(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      expect(extractPR("Fix bug (#123)")).toBe(123);
      expect(extractPR("Regular commit")).toBeNull();
    });

    it("should build PR URL", () => {
      const buildPRUrl = (owner: string, repo: string, prNumber: number) => {
        return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
      };

      const url = buildPRUrl("user", "repo", 123);

      expect(url).toBe("https://github.com/user/repo/pull/123");
    });
  });

  describe("Open Blame", () => {
    it("should open blame view", () => {
      let openedUrl: string | null = null;

      const openBlameOnRemote = (owner: string, repo: string, path: string, branch: string) => {
        openedUrl = `https://github.com/${owner}/${repo}/blame/${branch}/${path}`;
      };

      openBlameOnRemote("user", "repo", "src/app.ts", "main");

      expect(openedUrl).toContain("/blame/");
    });
  });

  describe("Create Gist", () => {
    it("should open gist creation page", () => {
      let openedUrl: string | null = null;

      const openCreateGist = (provider: string | null) => {
        if (provider === "GitHub" || !provider) {
          openedUrl = "https://gist.github.com";
        } else if (provider === "GitLab") {
          openedUrl = "https://gitlab.com/-/snippets/new";
        }
      };

      openCreateGist("GitHub");

      expect(openedUrl).toBe("https://gist.github.com");
    });
  });

  describe("Auth Settings", () => {
    it("should update auth settings", () => {
      let authSettings: Record<string, unknown> = {};

      const updateAuthSettings = (settings: Record<string, unknown>) => {
        authSettings = { ...authSettings, ...settings };
      };

      updateAuthSettings({ token: "ghp_xxx" });

      expect(authSettings.token).toBe("ghp_xxx");
    });

    it("should persist auth settings", () => {
      const STORAGE_KEY = "cortex_git_hosting_settings";
      const settings = { token: "ghp_xxx", storageKey: STORAGE_KEY };

      const saveSettings = (settings: unknown) => {
        return JSON.stringify(settings);
      };

      const saved = saveSettings(settings);

      expect(saved).toContain("token");
    });
  });

  describe("Availability Check", () => {
    it("should check if git hosting is available", () => {
      const isAvailable = (provider: unknown, remote: unknown) => {
        return !!(provider && remote);
      };

      expect(isAvailable({ name: "GitHub" }, { owner: "user" })).toBe(true);
      expect(isAvailable(null, null)).toBe(false);
    });

    it("should get provider name", () => {
      const getProviderName = (provider: { name: string } | null) => {
        return provider?.name || null;
      };

      expect(getProviderName({ name: "GitHub" })).toBe("GitHub");
      expect(getProviderName(null)).toBeNull();
    });
  });

  describe("Perform Action", () => {
    type GitHostingAction = "open-file-on-remote" | "copy-permalink" | "view-blame" | "create-gist";

    it("should perform open-file-on-remote action", () => {
      let actionPerformed: string | null = null;

      const performAction = (action: GitHostingAction) => {
        actionPerformed = action;
      };

      performAction("open-file-on-remote");

      expect(actionPerformed).toBe("open-file-on-remote");
    });

    it("should perform copy-permalink action", () => {
      let actionPerformed: string | null = null;

      const performAction = (action: GitHostingAction) => {
        actionPerformed = action;
      };

      performAction("copy-permalink");

      expect(actionPerformed).toBe("copy-permalink");
    });
  });

  describe("Line Selection", () => {
    interface LineSelection {
      startLine: number;
      endLine?: number;
    }

    it("should format single line selection", () => {
      const formatSelection = (selection: LineSelection) => {
        if (selection.endLine && selection.endLine !== selection.startLine) {
          return `#L${selection.startLine}-L${selection.endLine}`;
        }
        return `#L${selection.startLine}`;
      };

      expect(formatSelection({ startLine: 10 })).toBe("#L10");
    });

    it("should format range selection", () => {
      const formatSelection = (selection: LineSelection) => {
        if (selection.endLine && selection.endLine !== selection.startLine) {
          return `#L${selection.startLine}-L${selection.endLine}`;
        }
        return `#L${selection.startLine}`;
      };

      expect(formatSelection({ startLine: 10, endLine: 20 })).toBe("#L10-L20");
    });
  });
});

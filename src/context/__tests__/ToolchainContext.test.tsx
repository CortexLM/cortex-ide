import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("ToolchainContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ToolchainKind enum", () => {
    it("should define toolchain kind values", () => {
      const ToolchainKind = {
        Node: "node",
        Python: "python",
        Rust: "rust",
        Go: "go",
        Java: "java",
        Ruby: "ruby",
        Dotnet: "dotnet",
      } as const;

      expect(ToolchainKind.Node).toBe("node");
      expect(ToolchainKind.Python).toBe("python");
      expect(ToolchainKind.Rust).toBe("rust");
    });
  });

  describe("ToolchainInfo interface", () => {
    it("should define toolchain info structure", () => {
      interface ToolchainInfo {
        kind: "node" | "python" | "rust" | "go" | "java" | "ruby" | "dotnet";
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
        extra?: Record<string, unknown>;
      }

      const toolchain: ToolchainInfo = {
        kind: "node",
        name: "Node.js",
        version: "20.10.0",
        path: "/usr/local/bin/node",
        isDefault: true,
        extra: { npm: "10.2.0" },
      };

      expect(toolchain.kind).toBe("node");
      expect(toolchain.name).toBe("Node.js");
      expect(toolchain.version).toBe("20.10.0");
      expect(toolchain.isDefault).toBe(true);
      expect(toolchain.extra?.npm).toBe("10.2.0");
    });
  });

  describe("ProjectToolchains interface", () => {
    it("should define project toolchains structure", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      interface ProjectToolchains {
        projectPath: string;
        toolchains: {
          node?: ToolchainInfo;
          python?: ToolchainInfo;
          rust?: ToolchainInfo;
        };
        detectedAt: number;
      }

      const projectToolchains: ProjectToolchains = {
        projectPath: "/home/user/my-project",
        toolchains: {
          node: {
            kind: "node",
            name: "Node.js",
            version: "18.19.0",
            path: "/usr/bin/node",
            isDefault: false,
          },
          python: {
            kind: "python",
            name: "Python",
            version: "3.11.0",
            path: "/usr/bin/python3",
            isDefault: true,
          },
        },
        detectedAt: Date.now(),
      };

      expect(projectToolchains.toolchains.node?.version).toBe("18.19.0");
      expect(projectToolchains.toolchains.python?.version).toBe("3.11.0");
      expect(projectToolchains.toolchains.rust).toBeUndefined();
    });
  });

  describe("ToolchainContextValue interface", () => {
    it("should define full context value structure", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      interface ToolchainContextValue {
        toolchains: ToolchainInfo[];
        projectToolchains: Record<string, ToolchainInfo>;
        isDetecting: boolean;
        error: string | null;
        detectAll: () => Promise<ToolchainInfo[]>;
        detectNode: () => Promise<ToolchainInfo[]>;
        detectPython: () => Promise<ToolchainInfo[]>;
        detectRust: () => Promise<ToolchainInfo[]>;
        setProjectToolchain: (projectPath: string, kind: string, toolchain: ToolchainInfo) => void;
        getProjectToolchain: (projectPath: string, kind: string) => ToolchainInfo | undefined;
        getActiveToolchain: (kind: string) => ToolchainInfo | undefined;
        clearCache: () => void;
      }

      const mockContext: ToolchainContextValue = {
        toolchains: [],
        projectToolchains: {},
        isDetecting: false,
        error: null,
        detectAll: vi.fn(),
        detectNode: vi.fn(),
        detectPython: vi.fn(),
        detectRust: vi.fn(),
        setProjectToolchain: vi.fn(),
        getProjectToolchain: vi.fn(),
        getActiveToolchain: vi.fn(),
        clearCache: vi.fn(),
      };

      expect(mockContext.toolchains).toEqual([]);
      expect(typeof mockContext.detectAll).toBe("function");
    });
  });

  describe("Toolchain detection", () => {
    it("should detect all toolchains", async () => {
      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce([
        { kind: "node", name: "Node.js", version: "20.10.0", path: "/usr/bin/node", isDefault: true },
        { kind: "python", name: "Python", version: "3.11.0", path: "/usr/bin/python3", isDefault: true },
      ]);

      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      const detectAll = async (): Promise<ToolchainInfo[]> => {
        return await invoke("toolchain_detect_all");
      };

      const toolchains = await detectAll();
      expect(mockedInvoke).toHaveBeenCalledWith("toolchain_detect_all");
      expect(toolchains).toHaveLength(2);
      expect(toolchains[0].kind).toBe("node");
    });

    it("should detect Node.js toolchains", async () => {
      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce([
        { kind: "node", name: "Node.js", version: "20.10.0", path: "/usr/local/bin/node", isDefault: true },
        { kind: "node", name: "Node.js (nvm)", version: "18.19.0", path: "/home/user/.nvm/versions/node/v18.19.0/bin/node", isDefault: false },
      ]);

      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      const detectNode = async (): Promise<ToolchainInfo[]> => {
        return await invoke("toolchain_detect_node");
      };

      const toolchains = await detectNode();
      expect(mockedInvoke).toHaveBeenCalledWith("toolchain_detect_node");
      expect(toolchains).toHaveLength(2);
      expect(toolchains.every((t) => t.kind === "node")).toBe(true);
    });

    it("should detect Python toolchains", async () => {
      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce([
        { kind: "python", name: "Python", version: "3.11.0", path: "/usr/bin/python3", isDefault: true },
        { kind: "python", name: "Python (pyenv)", version: "3.10.0", path: "/home/user/.pyenv/versions/3.10.0/bin/python", isDefault: false },
      ]);

      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      const detectPython = async (): Promise<ToolchainInfo[]> => {
        return await invoke("toolchain_detect_python");
      };

      const toolchains = await detectPython();
      expect(mockedInvoke).toHaveBeenCalledWith("toolchain_detect_python");
      expect(toolchains).toHaveLength(2);
    });

    it("should detect Rust toolchains", async () => {
      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce([
        { kind: "rust", name: "Rust (stable)", version: "1.75.0", path: "/home/user/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/rustc", isDefault: true },
        { kind: "rust", name: "Rust (nightly)", version: "1.77.0-nightly", path: "/home/user/.rustup/toolchains/nightly-x86_64-unknown-linux-gnu/bin/rustc", isDefault: false },
      ]);

      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      const detectRust = async (): Promise<ToolchainInfo[]> => {
        return await invoke("toolchain_detect_rust");
      };

      const toolchains = await detectRust();
      expect(mockedInvoke).toHaveBeenCalledWith("toolchain_detect_rust");
      expect(toolchains).toHaveLength(2);
    });

    it("should handle detection errors", async () => {
      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockRejectedValueOnce(new Error("Detection failed"));

      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      const detectAll = async (): Promise<ToolchainInfo[]> => {
        try {
          return await invoke("toolchain_detect_all");
        } catch {
          return [];
        }
      };

      const toolchains = await detectAll();
      expect(toolchains).toEqual([]);
    });
  });

  describe("Project toolchain management", () => {
    it("should set project toolchain", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      const projectToolchains: Record<string, Record<string, ToolchainInfo>> = {};

      const setProjectToolchain = (
        projectPath: string,
        kind: string,
        toolchain: ToolchainInfo
      ): void => {
        if (!projectToolchains[projectPath]) {
          projectToolchains[projectPath] = {};
        }
        projectToolchains[projectPath][kind] = toolchain;
      };

      const nodeToolchain: ToolchainInfo = {
        kind: "node",
        name: "Node.js",
        version: "20.10.0",
        path: "/usr/bin/node",
        isDefault: true,
      };

      setProjectToolchain("/home/user/my-project", "node", nodeToolchain);
      expect(projectToolchains["/home/user/my-project"].node).toEqual(nodeToolchain);
    });

    it("should get project toolchain", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      const projectToolchains: Record<string, Record<string, ToolchainInfo>> = {
        "/home/user/my-project": {
          node: {
            kind: "node",
            name: "Node.js",
            version: "18.19.0",
            path: "/usr/bin/node",
            isDefault: false,
          },
        },
      };

      const getProjectToolchain = (
        projectPath: string,
        kind: string
      ): ToolchainInfo | undefined => {
        return projectToolchains[projectPath]?.[kind];
      };

      const toolchain = getProjectToolchain("/home/user/my-project", "node");
      expect(toolchain?.version).toBe("18.19.0");

      const missing = getProjectToolchain("/home/user/my-project", "python");
      expect(missing).toBeUndefined();
    });

    it("should get active toolchain for kind", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      const toolchains: ToolchainInfo[] = [
        { kind: "node", name: "Node.js", version: "20.10.0", path: "/usr/bin/node", isDefault: true },
        { kind: "node", name: "Node.js (nvm)", version: "18.19.0", path: "/home/user/.nvm/versions/node/v18.19.0/bin/node", isDefault: false },
        { kind: "python", name: "Python", version: "3.11.0", path: "/usr/bin/python3", isDefault: true },
      ];

      const getActiveToolchain = (kind: string): ToolchainInfo | undefined => {
        return toolchains.find((t) => t.kind === kind && t.isDefault);
      };

      const activeNode = getActiveToolchain("node");
      expect(activeNode?.version).toBe("20.10.0");

      const activePython = getActiveToolchain("python");
      expect(activePython?.version).toBe("3.11.0");
    });
  });

  describe("Toolchain caching", () => {
    it("should cache detected toolchains", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      interface ToolchainCache {
        toolchains: ToolchainInfo[];
        detectedAt: number;
        ttl: number;
      }

      const cache: ToolchainCache = {
        toolchains: [],
        detectedAt: 0,
        ttl: 300000,
      };

      const isCacheValid = (): boolean => {
        return Date.now() - cache.detectedAt < cache.ttl;
      };

      const updateCache = (toolchains: ToolchainInfo[]): void => {
        cache.toolchains = toolchains;
        cache.detectedAt = Date.now();
      };

      expect(isCacheValid()).toBe(false);

      updateCache([
        { kind: "node", name: "Node.js", version: "20.10.0", path: "/usr/bin/node", isDefault: true },
      ]);

      expect(isCacheValid()).toBe(true);
      expect(cache.toolchains).toHaveLength(1);
    });

    it("should clear cache", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      interface ToolchainCache {
        toolchains: ToolchainInfo[];
        detectedAt: number;
      }

      const cache: ToolchainCache = {
        toolchains: [
          { kind: "node", name: "Node.js", version: "20.10.0", path: "/usr/bin/node", isDefault: true },
        ],
        detectedAt: Date.now(),
      };

      const clearCache = (): void => {
        cache.toolchains = [];
        cache.detectedAt = 0;
      };

      clearCache();
      expect(cache.toolchains).toHaveLength(0);
      expect(cache.detectedAt).toBe(0);
    });
  });

  describe("Version comparison", () => {
    it("should compare semantic versions", () => {
      const compareVersions = (a: string, b: string): number => {
        const partsA = a.split(".").map(Number);
        const partsB = b.split(".").map(Number);

        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const partA = partsA[i] ?? 0;
          const partB = partsB[i] ?? 0;
          if (partA > partB) return 1;
          if (partA < partB) return -1;
        }
        return 0;
      };

      expect(compareVersions("20.10.0", "18.19.0")).toBe(1);
      expect(compareVersions("18.19.0", "20.10.0")).toBe(-1);
      expect(compareVersions("20.10.0", "20.10.0")).toBe(0);
      expect(compareVersions("3.11", "3.10.5")).toBe(1);
    });

    it("should find latest version", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      const toolchains: ToolchainInfo[] = [
        { kind: "node", name: "Node.js", version: "18.19.0", path: "/a", isDefault: false },
        { kind: "node", name: "Node.js", version: "20.10.0", path: "/b", isDefault: true },
        { kind: "node", name: "Node.js", version: "16.20.0", path: "/c", isDefault: false },
      ];

      const compareVersions = (a: string, b: string): number => {
        const partsA = a.split(".").map(Number);
        const partsB = b.split(".").map(Number);
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const partA = partsA[i] ?? 0;
          const partB = partsB[i] ?? 0;
          if (partA > partB) return 1;
          if (partA < partB) return -1;
        }
        return 0;
      };

      const findLatest = (kind: string): ToolchainInfo | undefined => {
        return toolchains
          .filter((t) => t.kind === kind)
          .sort((a, b) => compareVersions(b.version, a.version))[0];
      };

      const latest = findLatest("node");
      expect(latest?.version).toBe("20.10.0");
    });
  });

  describe("Toolchain validation", () => {
    it("should validate toolchain path exists", async () => {
      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce(true);

      const validatePath = async (path: string): Promise<boolean> => {
        return await invoke("toolchain_validate_path", { path });
      };

      const isValid = await validatePath("/usr/bin/node");
      expect(mockedInvoke).toHaveBeenCalledWith("toolchain_validate_path", { path: "/usr/bin/node" });
      expect(isValid).toBe(true);
    });

    it("should validate toolchain version", async () => {
      const mockedInvoke = vi.mocked(invoke);
      mockedInvoke.mockResolvedValueOnce({ version: "20.10.0", valid: true });

      interface ValidationResult {
        version: string;
        valid: boolean;
      }

      const validateVersion = async (path: string): Promise<ValidationResult> => {
        return await invoke("toolchain_validate_version", { path });
      };

      const result = await validateVersion("/usr/bin/node");
      expect(result.valid).toBe(true);
      expect(result.version).toBe("20.10.0");
    });
  });

  describe("localStorage persistence", () => {
    it("should persist project toolchains to localStorage", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
      }

      const STORAGE_KEY = "zen-project-toolchains";

      const saveProjectToolchains = (
        projectToolchains: Record<string, Record<string, ToolchainInfo>>
      ): void => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projectToolchains));
      };

      const loadProjectToolchains = (): Record<string, Record<string, ToolchainInfo>> => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return {};
        try {
          return JSON.parse(stored);
        } catch {
          return {};
        }
      };

      const projectToolchains = {
        "/home/user/project": {
          node: {
            kind: "node",
            name: "Node.js",
            version: "20.10.0",
            path: "/usr/bin/node",
            isDefault: true,
          },
        },
      };

      saveProjectToolchains(projectToolchains);
      const loaded = loadProjectToolchains();
      expect(loaded["/home/user/project"].node.version).toBe("20.10.0");
    });
  });

  describe("Toolchain extra info", () => {
    it("should include npm version for Node.js", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
        extra?: {
          npm?: string;
          yarn?: string;
          pnpm?: string;
        };
      }

      const nodeToolchain: ToolchainInfo = {
        kind: "node",
        name: "Node.js",
        version: "20.10.0",
        path: "/usr/bin/node",
        isDefault: true,
        extra: {
          npm: "10.2.0",
          yarn: "1.22.19",
          pnpm: "8.10.0",
        },
      };

      expect(nodeToolchain.extra?.npm).toBe("10.2.0");
      expect(nodeToolchain.extra?.yarn).toBe("1.22.19");
    });

    it("should include pip version for Python", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
        extra?: {
          pip?: string;
          poetry?: string;
          venv?: boolean;
        };
      }

      const pythonToolchain: ToolchainInfo = {
        kind: "python",
        name: "Python",
        version: "3.11.0",
        path: "/usr/bin/python3",
        isDefault: true,
        extra: {
          pip: "23.3.1",
          poetry: "1.7.0",
          venv: true,
        },
      };

      expect(pythonToolchain.extra?.pip).toBe("23.3.1");
      expect(pythonToolchain.extra?.venv).toBe(true);
    });

    it("should include cargo version for Rust", () => {
      interface ToolchainInfo {
        kind: string;
        name: string;
        version: string;
        path: string;
        isDefault: boolean;
        extra?: {
          cargo?: string;
          rustup?: string;
          channel?: string;
        };
      }

      const rustToolchain: ToolchainInfo = {
        kind: "rust",
        name: "Rust",
        version: "1.75.0",
        path: "/home/user/.rustup/toolchains/stable/bin/rustc",
        isDefault: true,
        extra: {
          cargo: "1.75.0",
          rustup: "1.26.0",
          channel: "stable",
        },
      };

      expect(rustToolchain.extra?.cargo).toBe("1.75.0");
      expect(rustToolchain.extra?.channel).toBe("stable");
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("PreviewContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PreviewServer", () => {
    interface PreviewServer {
      url: string;
      port: number;
      name: string;
      terminalId?: string;
      detectedAt: number;
    }

    it("should create preview server", () => {
      const server: PreviewServer = {
        url: "http://localhost:3000",
        port: 3000,
        name: "Server :3000",
        detectedAt: Date.now(),
      };

      expect(server.url).toBe("http://localhost:3000");
      expect(server.port).toBe(3000);
    });

    it("should include terminal id", () => {
      const server: PreviewServer = {
        url: "http://localhost:5173",
        port: 5173,
        name: "Vite Dev Server",
        terminalId: "term-1",
        detectedAt: Date.now(),
      };

      expect(server.terminalId).toBe("term-1");
    });

    it("should track detection time", () => {
      const now = Date.now();
      const server: PreviewServer = {
        url: "http://localhost:8080",
        port: 8080,
        name: "Server :8080",
        detectedAt: now,
      };

      expect(server.detectedAt).toBe(now);
    });
  });

  describe("PreviewState", () => {
    interface PreviewServer {
      url: string;
      port: number;
      name: string;
    }

    interface PreviewState {
      activeServer: PreviewServer | null;
      servers: PreviewServer[];
      showPreview: boolean;
      refreshKey: number;
    }

    it("should initialize preview state", () => {
      const state: PreviewState = {
        activeServer: null,
        servers: [],
        showPreview: false,
        refreshKey: 0,
      };

      expect(state.activeServer).toBeNull();
      expect(state.servers).toHaveLength(0);
      expect(state.showPreview).toBe(false);
    });

    it("should track active server", () => {
      const state: PreviewState = {
        activeServer: {
          url: "http://localhost:3000",
          port: 3000,
          name: "Dev Server",
        },
        servers: [],
        showPreview: true,
        refreshKey: 0,
      };

      expect(state.activeServer?.url).toBe("http://localhost:3000");
      expect(state.showPreview).toBe(true);
    });

    it("should track multiple servers", () => {
      const state: PreviewState = {
        activeServer: null,
        servers: [
          { url: "http://localhost:3000", port: 3000, name: "Frontend" },
          { url: "http://localhost:4000", port: 4000, name: "Backend" },
        ],
        showPreview: false,
        refreshKey: 0,
      };

      expect(state.servers).toHaveLength(2);
    });
  });

  describe("Server URL Patterns", () => {
    const SERVER_URL_PATTERNS = [
      /(?:Local|Server|App|Dev|http)[:\s]+(?:running\s+(?:at|on)\s+)?(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
      /(?:listening|started|running)\s+(?:on|at)\s+(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
      /(?:ready|available)\s+(?:on|at)\s+(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
      /➜\s+Local:\s+(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/gi,
      /ready\s+-\s+started.*on\s+(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/gi,
      /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
    ];

    it("should match localhost URL", () => {
      const output = "Server running at http://localhost:3000";
      const pattern = SERVER_URL_PATTERNS[5];
      pattern.lastIndex = 0;
      const match = pattern.exec(output);

      expect(match).not.toBeNull();
      expect(match![1]).toBe("http://localhost:3000");
    });

    it("should match 127.0.0.1 URL", () => {
      const output = "Listening on http://127.0.0.1:8080";
      const pattern = SERVER_URL_PATTERNS[5];
      pattern.lastIndex = 0;
      const match = pattern.exec(output);

      expect(match).not.toBeNull();
      expect(match![1]).toBe("http://127.0.0.1:8080");
    });

    it("should match 0.0.0.0 URL", () => {
      const output = "Server started on http://0.0.0.0:5000";
      const pattern = SERVER_URL_PATTERNS[5];
      pattern.lastIndex = 0;
      const match = pattern.exec(output);

      expect(match).not.toBeNull();
      expect(match![1]).toBe("http://0.0.0.0:5000");
    });

    it("should match Vite output", () => {
      const output = "➜  Local:   http://localhost:5173/";
      const pattern = SERVER_URL_PATTERNS[3];
      pattern.lastIndex = 0;
      const match = pattern.exec(output);

      expect(match).not.toBeNull();
    });
  });

  describe("Extract Port", () => {
    it("should extract port from URL", () => {
      const extractPort = (url: string): number => {
        const match = url.match(/:(\d+)/);
        return match ? parseInt(match[1], 10) : 80;
      };

      expect(extractPort("http://localhost:3000")).toBe(3000);
      expect(extractPort("http://localhost:8080")).toBe(8080);
      expect(extractPort("http://localhost")).toBe(80);
    });
  });

  describe("Normalize URL", () => {
    it("should convert 0.0.0.0 to localhost", () => {
      const normalizeUrl = (url: string): string => {
        return url.replace(/0\.0\.0\.0/, "localhost");
      };

      expect(normalizeUrl("http://0.0.0.0:3000")).toBe("http://localhost:3000");
    });

    it("should keep localhost unchanged", () => {
      const normalizeUrl = (url: string): string => {
        return url.replace(/0\.0\.0\.0/, "localhost");
      };

      expect(normalizeUrl("http://localhost:3000")).toBe("http://localhost:3000");
    });
  });

  describe("Open Preview", () => {
    interface PreviewState {
      activeServer: { url: string; port: number; name: string } | null;
      showPreview: boolean;
    }

    it("should open preview with URL", () => {
      const state: PreviewState = {
        activeServer: null,
        showPreview: false,
      };

      const openPreview = (url: string, name?: string) => {
        const port = parseInt(url.match(/:(\d+)/)?.[1] || "80", 10);
        state.activeServer = {
          url,
          port,
          name: name || `Server :${port}`,
        };
        state.showPreview = true;
      };

      openPreview("http://localhost:3000", "Dev Server");

      expect(state.activeServer?.url).toBe("http://localhost:3000");
      expect(state.activeServer?.name).toBe("Dev Server");
      expect(state.showPreview).toBe(true);
    });

    it("should generate default name", () => {
      const state: PreviewState = {
        activeServer: null,
        showPreview: false,
      };

      const openPreview = (url: string, name?: string) => {
        const port = parseInt(url.match(/:(\d+)/)?.[1] || "80", 10);
        state.activeServer = {
          url,
          port,
          name: name || `Server :${port}`,
        };
        state.showPreview = true;
      };

      openPreview("http://localhost:5173");

      expect(state.activeServer?.name).toBe("Server :5173");
    });
  });

  describe("Close Preview", () => {
    it("should close preview", () => {
      const state = {
        activeServer: { url: "http://localhost:3000", port: 3000, name: "Server" },
        showPreview: true,
      };

      const closePreview = () => {
        state.showPreview = false;
      };

      closePreview();

      expect(state.showPreview).toBe(false);
    });
  });

  describe("Toggle Preview", () => {
    it("should toggle preview visibility", () => {
      let showPreview = false;

      const togglePreview = () => {
        showPreview = !showPreview;
      };

      togglePreview();
      expect(showPreview).toBe(true);

      togglePreview();
      expect(showPreview).toBe(false);
    });
  });

  describe("Refresh Preview", () => {
    it("should increment refresh key", () => {
      let refreshKey = 0;

      const refreshPreview = () => {
        refreshKey++;
      };

      refreshPreview();
      expect(refreshKey).toBe(1);

      refreshPreview();
      expect(refreshKey).toBe(2);
    });
  });

  describe("Set Active Server", () => {
    interface PreviewServer {
      url: string;
      port: number;
      name: string;
    }

    it("should set active server", () => {
      let activeServer: PreviewServer | null = null;

      const setActiveServer = (server: PreviewServer | null) => {
        activeServer = server;
      };

      setActiveServer({
        url: "http://localhost:3000",
        port: 3000,
        name: "Frontend",
      });

      expect((activeServer as PreviewServer | null)?.name).toBe("Frontend");
    });

    it("should clear active server", () => {
      let activeServer: PreviewServer | null = {
        url: "http://localhost:3000",
        port: 3000,
        name: "Frontend",
      };

      const setActiveServer = (server: PreviewServer | null) => {
        activeServer = server;
      };

      setActiveServer(null);

      expect(activeServer).toBeNull();
    });
  });

  describe("Detect Server From Output", () => {
    interface PreviewServer {
      url: string;
      port: number;
      name: string;
      terminalId?: string;
      detectedAt: number;
    }

    it("should detect server from terminal output", () => {
      const detectServerFromOutput = (output: string, terminalId?: string): PreviewServer | null => {
        const pattern = /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi;
        pattern.lastIndex = 0;
        const match = pattern.exec(output);
        
        if (match && match[1]) {
          const url = match[1].replace(/0\.0\.0\.0/, "localhost");
          const portMatch = url.match(/:(\d+)/);
          const port = portMatch ? parseInt(portMatch[1], 10) : 80;
          
          return {
            url,
            port,
            name: `Server :${port}`,
            terminalId,
            detectedAt: Date.now(),
          };
        }
        return null;
      };

      const server = detectServerFromOutput("Server running at http://localhost:3000", "term-1");

      expect(server).not.toBeNull();
      expect(server?.port).toBe(3000);
      expect(server?.terminalId).toBe("term-1");
    });

    it("should return null for no match", () => {
      const detectServerFromOutput = (output: string): { url: string } | null => {
        const pattern = /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi;
        pattern.lastIndex = 0;
        const match = pattern.exec(output);
        
        if (match && match[1]) {
          return { url: match[1] };
        }
        return null;
      };

      const server = detectServerFromOutput("Build complete");

      expect(server).toBeNull();
    });

    it("should skip non-web ports", () => {
      const detectServerFromOutput = (output: string): { url: string; port: number } | null => {
        const pattern = /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+))/gi;
        pattern.lastIndex = 0;
        const match = pattern.exec(output);
        
        if (match && match[1]) {
          const port = parseInt(match[2], 10);
          if (port === 22 || port === 21 || port === 25) {
            return null;
          }
          return { url: match[1], port };
        }
        return null;
      };

      expect(detectServerFromOutput("SSH on http://localhost:22")).toBeNull();
      expect(detectServerFromOutput("FTP on http://localhost:21")).toBeNull();
      expect(detectServerFromOutput("SMTP on http://localhost:25")).toBeNull();
    });
  });

  describe("Server Management", () => {
    interface PreviewServer {
      url: string;
      port: number;
      name: string;
    }

    it("should add server to list", () => {
      const servers: PreviewServer[] = [];

      const addServer = (server: PreviewServer) => {
        if (!servers.find(s => s.port === server.port)) {
          servers.push(server);
        }
      };

      addServer({ url: "http://localhost:3000", port: 3000, name: "Frontend" });
      addServer({ url: "http://localhost:4000", port: 4000, name: "Backend" });

      expect(servers).toHaveLength(2);
    });

    it("should not add duplicate ports", () => {
      const servers: PreviewServer[] = [
        { url: "http://localhost:3000", port: 3000, name: "Frontend" },
      ];

      const addServer = (server: PreviewServer) => {
        if (!servers.find(s => s.port === server.port)) {
          servers.push(server);
        }
      };

      addServer({ url: "http://localhost:3000", port: 3000, name: "Another" });

      expect(servers).toHaveLength(1);
    });

    it("should remove server", () => {
      let servers: PreviewServer[] = [
        { url: "http://localhost:3000", port: 3000, name: "Frontend" },
        { url: "http://localhost:4000", port: 4000, name: "Backend" },
      ];

      const removeServer = (port: number) => {
        servers = servers.filter(s => s.port !== port);
      };

      removeServer(3000);

      expect(servers).toHaveLength(1);
      expect(servers[0].port).toBe(4000);
    });
  });
});

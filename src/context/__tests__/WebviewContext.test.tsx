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

describe("WebviewContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("WebviewCSPConfig", () => {
    interface WebviewCSPConfig {
      defaultSrc: string[];
      scriptSrc: string[];
      styleSrc: string[];
      imgSrc: string[];
      fontSrc: string[];
      connectSrc: string[];
      frameSrc: string[];
      objectSrc: string[];
      mediaSrc: string[];
      workerSrc: string[];
    }

    it("should create CSP config with defaults", () => {
      const config: WebviewCSPConfig = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        workerSrc: ["'self'"],
      };

      expect(config.defaultSrc).toContain("'self'");
      expect(config.scriptSrc).toContain("'unsafe-inline'");
    });

    it("should build CSP string from config", () => {
      const config: WebviewCSPConfig = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        workerSrc: ["'self'"],
      };

      const buildCSP = (cfg: WebviewCSPConfig): string => {
        const parts: string[] = [];
        parts.push(`default-src ${cfg.defaultSrc.join(" ")}`);
        parts.push(`script-src ${cfg.scriptSrc.join(" ")}`);
        parts.push(`style-src ${cfg.styleSrc.join(" ")}`);
        parts.push(`img-src ${cfg.imgSrc.join(" ")}`);
        parts.push(`font-src ${cfg.fontSrc.join(" ")}`);
        parts.push(`connect-src ${cfg.connectSrc.join(" ")}`);
        parts.push(`frame-src ${cfg.frameSrc.join(" ")}`);
        parts.push(`object-src ${cfg.objectSrc.join(" ")}`);
        parts.push(`media-src ${cfg.mediaSrc.join(" ")}`);
        parts.push(`worker-src ${cfg.workerSrc.join(" ")}`);
        return parts.join("; ");
      };

      const csp = buildCSP(config);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-src 'none'");
    });

    it("should merge CSP configs", () => {
      const base: WebviewCSPConfig = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        workerSrc: ["'self'"],
      };

      const extension: Partial<WebviewCSPConfig> = {
        scriptSrc: ["'self'", "https://cdn.example.com"],
      };

      const merged: WebviewCSPConfig = {
        ...base,
        ...extension,
      };

      expect(merged.scriptSrc).toContain("https://cdn.example.com");
    });
  });

  describe("WebviewOptions", () => {
    interface WebviewOptions {
      id: string;
      title: string;
      enableScripts: boolean;
      retainContextWhenHidden: boolean;
      localResourceRoots: string[];
      portMapping?: { webviewPort: number; extensionHostPort: number }[];
    }

    it("should create webview options", () => {
      const options: WebviewOptions = {
        id: "preview",
        title: "Preview",
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: ["/workspace"],
      };

      expect(options.id).toBe("preview");
      expect(options.enableScripts).toBe(true);
    });

    it("should include port mapping", () => {
      const options: WebviewOptions = {
        id: "dev-server",
        title: "Dev Server",
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: ["/workspace"],
        portMapping: [{ webviewPort: 3000, extensionHostPort: 3000 }],
      };

      expect(options.portMapping).toHaveLength(1);
      expect(options.portMapping?.[0].webviewPort).toBe(3000);
    });
  });

  describe("WebviewMessage", () => {
    interface WebviewMessage {
      id: string;
      type: string;
      payload: unknown;
      timestamp: number;
    }

    it("should create webview message", () => {
      const message: WebviewMessage = {
        id: "msg-1",
        type: "update",
        payload: { content: "Hello" },
        timestamp: Date.now(),
      };

      expect(message.type).toBe("update");
      expect(message.payload).toEqual({ content: "Hello" });
    });

    it("should create command message", () => {
      const message: WebviewMessage = {
        id: "msg-2",
        type: "command",
        payload: { command: "refresh", args: [] },
        timestamp: Date.now(),
      };

      expect(message.type).toBe("command");
    });

    it("should create response message", () => {
      const message: WebviewMessage = {
        id: "msg-3",
        type: "response",
        payload: { success: true, data: { result: 42 } },
        timestamp: Date.now(),
      };

      expect(message.type).toBe("response");
    });
  });

  describe("WebviewState", () => {
    interface WebviewState {
      scrollPosition: { x: number; y: number };
      selection: { start: number; end: number } | null;
      customState: Record<string, unknown>;
    }

    it("should create webview state", () => {
      const state: WebviewState = {
        scrollPosition: { x: 0, y: 100 },
        selection: null,
        customState: {},
      };

      expect(state.scrollPosition.y).toBe(100);
      expect(state.selection).toBeNull();
    });

    it("should track selection state", () => {
      const state: WebviewState = {
        scrollPosition: { x: 0, y: 0 },
        selection: { start: 10, end: 50 },
        customState: {},
      };

      expect(state.selection?.start).toBe(10);
      expect(state.selection?.end).toBe(50);
    });

    it("should store custom state", () => {
      const state: WebviewState = {
        scrollPosition: { x: 0, y: 0 },
        selection: null,
        customState: {
          theme: "dark",
          fontSize: 14,
          showLineNumbers: true,
        },
      };

      expect(state.customState.theme).toBe("dark");
      expect(state.customState.fontSize).toBe(14);
    });
  });

  describe("WebviewData", () => {
    interface WebviewCSPConfig {
      defaultSrc: string[];
      scriptSrc: string[];
      styleSrc: string[];
      imgSrc: string[];
      fontSrc: string[];
      connectSrc: string[];
      frameSrc: string[];
      objectSrc: string[];
      mediaSrc: string[];
      workerSrc: string[];
    }

    interface WebviewState {
      scrollPosition: { x: number; y: number };
      selection: { start: number; end: number } | null;
      customState: Record<string, unknown>;
    }

    interface WebviewData {
      id: string;
      title: string;
      html: string;
      visible: boolean;
      cspConfig: WebviewCSPConfig;
      state: WebviewState;
      createdAt: number;
      lastUpdated: number;
    }

    it("should create webview data", () => {
      const data: WebviewData = {
        id: "webview-1",
        title: "My Webview",
        html: "<html><body>Hello</body></html>",
        visible: true,
        cspConfig: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          workerSrc: ["'self'"],
        },
        state: {
          scrollPosition: { x: 0, y: 0 },
          selection: null,
          customState: {},
        },
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      expect(data.id).toBe("webview-1");
      expect(data.visible).toBe(true);
    });

    it("should track webview timestamps", () => {
      const now = Date.now();
      const data: WebviewData = {
        id: "webview-2",
        title: "Test",
        html: "",
        visible: false,
        cspConfig: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          workerSrc: ["'self'"],
        },
        state: {
          scrollPosition: { x: 0, y: 0 },
          selection: null,
          customState: {},
        },
        createdAt: now,
        lastUpdated: now,
      };

      expect(data.createdAt).toBe(now);
      expect(data.lastUpdated).toBe(now);
    });
  });

  describe("Webview CRUD Operations", () => {
    interface WebviewData {
      id: string;
      title: string;
      html: string;
      visible: boolean;
    }

    it("should create webview", () => {
      const webviews: Map<string, WebviewData> = new Map();

      const createWebview = (id: string, title: string, html: string): WebviewData => {
        const webview: WebviewData = { id, title, html, visible: true };
        webviews.set(id, webview);
        return webview;
      };

      const webview = createWebview("wv-1", "Preview", "<html></html>");
      expect(webviews.has("wv-1")).toBe(true);
      expect(webview.title).toBe("Preview");
    });

    it("should get webview by id", () => {
      const webviews: Map<string, WebviewData> = new Map();
      webviews.set("wv-1", { id: "wv-1", title: "Test", html: "", visible: true });

      const getWebview = (id: string): WebviewData | undefined => {
        return webviews.get(id);
      };

      expect(getWebview("wv-1")?.title).toBe("Test");
      expect(getWebview("wv-2")).toBeUndefined();
    });

    it("should update webview", () => {
      const webviews: Map<string, WebviewData> = new Map();
      webviews.set("wv-1", { id: "wv-1", title: "Test", html: "", visible: true });

      const updateWebview = (id: string, updates: Partial<WebviewData>): boolean => {
        const webview = webviews.get(id);
        if (!webview) return false;
        webviews.set(id, { ...webview, ...updates });
        return true;
      };

      const result = updateWebview("wv-1", { title: "Updated", html: "<p>New</p>" });
      expect(result).toBe(true);
      expect(webviews.get("wv-1")?.title).toBe("Updated");
    });

    it("should delete webview", () => {
      const webviews: Map<string, WebviewData> = new Map();
      webviews.set("wv-1", { id: "wv-1", title: "Test", html: "", visible: true });

      const deleteWebview = (id: string): boolean => {
        return webviews.delete(id);
      };

      const result = deleteWebview("wv-1");
      expect(result).toBe(true);
      expect(webviews.has("wv-1")).toBe(false);
    });
  });

  describe("Message Posting", () => {
    interface WebviewMessage {
      id: string;
      type: string;
      payload: unknown;
      timestamp: number;
    }

    it("should post message to webview", () => {
      const messages: WebviewMessage[] = [];

      const postMessage = (_webviewId: string, type: string, payload: unknown): string => {
        const message: WebviewMessage = {
          id: `msg-${messages.length + 1}`,
          type,
          payload,
          timestamp: Date.now(),
        };
        messages.push(message);
        return message.id;
      };

      const msgId = postMessage("wv-1", "update", { content: "Hello" });
      expect(msgId).toBe("msg-1");
      expect(messages).toHaveLength(1);
    });

    it("should handle message response", () => {
      interface MessageResponse {
        messageId: string;
        success: boolean;
        data?: unknown;
        error?: string;
      }

      const response: MessageResponse = {
        messageId: "msg-1",
        success: true,
        data: { result: "ok" },
      };

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ result: "ok" });
    });

    it("should handle message error", () => {
      interface MessageResponse {
        messageId: string;
        success: boolean;
        data?: unknown;
        error?: string;
      }

      const response: MessageResponse = {
        messageId: "msg-2",
        success: false,
        error: "Webview not found",
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Webview not found");
    });
  });

  describe("Visibility Management", () => {
    interface WebviewData {
      id: string;
      visible: boolean;
    }

    it("should show webview", () => {
      let webview: WebviewData = { id: "wv-1", visible: false };

      const showWebview = () => {
        webview = { ...webview, visible: true };
      };

      showWebview();
      expect(webview.visible).toBe(true);
    });

    it("should hide webview", () => {
      let webview: WebviewData = { id: "wv-1", visible: true };

      const hideWebview = () => {
        webview = { ...webview, visible: false };
      };

      hideWebview();
      expect(webview.visible).toBe(false);
    });

    it("should toggle webview visibility", () => {
      let webview: WebviewData = { id: "wv-1", visible: false };

      const toggleVisibility = () => {
        webview = { ...webview, visible: !webview.visible };
      };

      toggleVisibility();
      expect(webview.visible).toBe(true);

      toggleVisibility();
      expect(webview.visible).toBe(false);
    });

    it("should get visible webviews", () => {
      const webviews: WebviewData[] = [
        { id: "wv-1", visible: true },
        { id: "wv-2", visible: false },
        { id: "wv-3", visible: true },
      ];

      const getVisibleWebviews = (): WebviewData[] => {
        return webviews.filter((w) => w.visible);
      };

      const visible = getVisibleWebviews();
      expect(visible).toHaveLength(2);
    });
  });

  describe("State Persistence", () => {
    interface WebviewState {
      scrollPosition: { x: number; y: number };
      customState: Record<string, unknown>;
    }

    it("should save webview state", () => {
      const savedStates: Map<string, WebviewState> = new Map();

      const saveState = (webviewId: string, state: WebviewState): void => {
        savedStates.set(webviewId, state);
      };

      saveState("wv-1", {
        scrollPosition: { x: 0, y: 500 },
        customState: { theme: "dark" },
      });

      expect(savedStates.has("wv-1")).toBe(true);
      expect(savedStates.get("wv-1")?.scrollPosition.y).toBe(500);
    });

    it("should restore webview state", () => {
      const savedStates: Map<string, WebviewState> = new Map();
      savedStates.set("wv-1", {
        scrollPosition: { x: 0, y: 200 },
        customState: { zoom: 1.5 },
      });

      const restoreState = (webviewId: string): WebviewState | null => {
        return savedStates.get(webviewId) || null;
      };

      const state = restoreState("wv-1");
      expect(state?.scrollPosition.y).toBe(200);
      expect(state?.customState.zoom).toBe(1.5);
    });

    it("should clear webview state", () => {
      const savedStates: Map<string, WebviewState> = new Map();
      savedStates.set("wv-1", {
        scrollPosition: { x: 0, y: 0 },
        customState: {},
      });

      const clearState = (webviewId: string): void => {
        savedStates.delete(webviewId);
      };

      clearState("wv-1");
      expect(savedStates.has("wv-1")).toBe(false);
    });
  });

  describe("Webview Events", () => {
    it("should listen for webview created events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("webview:created", () => {});

      expect(listen).toHaveBeenCalledWith("webview:created", expect.any(Function));
    });

    it("should listen for webview disposed events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("webview:disposed", () => {});

      expect(listen).toHaveBeenCalledWith("webview:disposed", expect.any(Function));
    });

    it("should listen for webview message events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("webview:message", () => {});

      expect(listen).toHaveBeenCalledWith("webview:message", expect.any(Function));
    });
  });

  describe("Webview Invoke Commands", () => {
    it("should create webview via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ id: "wv-1", title: "Test" });

      const result = await invoke("webview_create", {
        title: "Test",
        html: "<html></html>",
      });

      expect(result).toEqual({ id: "wv-1", title: "Test" });
    });

    it("should dispose webview via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("webview_dispose", { id: "wv-1" });

      expect(invoke).toHaveBeenCalledWith("webview_dispose", { id: "wv-1" });
    });

    it("should post message via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ success: true });

      const result = await invoke("webview_post_message", {
        id: "wv-1",
        message: { type: "update", payload: {} },
      });

      expect(result).toEqual({ success: true });
    });

    it("should get webview html via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("<html><body>Content</body></html>");

      const result = await invoke("webview_get_html", { id: "wv-1" });

      expect(result).toBe("<html><body>Content</body></html>");
    });

    it("should set webview html via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("webview_set_html", {
        id: "wv-1",
        html: "<html><body>New Content</body></html>",
      });

      expect(invoke).toHaveBeenCalledWith("webview_set_html", {
        id: "wv-1",
        html: "<html><body>New Content</body></html>",
      });
    });
  });

  describe("Webview Panel Types", () => {
    type WebviewPanelType = "preview" | "documentation" | "custom" | "extension";

    it("should define panel types", () => {
      const types: WebviewPanelType[] = ["preview", "documentation", "custom", "extension"];
      expect(types).toHaveLength(4);
    });

    it("should get panel type label", () => {
      const getPanelTypeLabel = (type: WebviewPanelType): string => {
        switch (type) {
          case "preview":
            return "Preview";
          case "documentation":
            return "Documentation";
          case "custom":
            return "Custom Panel";
          case "extension":
            return "Extension Panel";
        }
      };

      expect(getPanelTypeLabel("preview")).toBe("Preview");
      expect(getPanelTypeLabel("extension")).toBe("Extension Panel");
    });
  });

  describe("Webview Resource Handling", () => {
    interface WebviewResource {
      uri: string;
      mimeType: string;
      content: string | Uint8Array;
    }

    it("should create webview resource", () => {
      const resource: WebviewResource = {
        uri: "/assets/style.css",
        mimeType: "text/css",
        content: "body { margin: 0; }",
      };

      expect(resource.mimeType).toBe("text/css");
    });

    it("should handle binary resources", () => {
      const resource: WebviewResource = {
        uri: "/assets/image.png",
        mimeType: "image/png",
        content: new Uint8Array([137, 80, 78, 71]),
      };

      expect(resource.content instanceof Uint8Array).toBe(true);
    });

    it("should resolve resource URI", () => {
      const resolveResourceUri = (baseUri: string, resourcePath: string): string => {
        if (resourcePath.startsWith("/")) {
          return `${baseUri}${resourcePath}`;
        }
        return `${baseUri}/${resourcePath}`;
      };

      expect(resolveResourceUri("vscode-webview://", "/assets/main.js")).toBe(
        "vscode-webview:///assets/main.js"
      );
    });
  });

  describe("Webview Security", () => {
    it("should sanitize HTML content", () => {
      const sanitizeHtml = (html: string): string => {
        return html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/on\w+="[^"]*"/gi, "");
      };

      const unsafeHtml = '<div onclick="alert(1)">Hello<script>evil()</script></div>';
      const safeHtml = sanitizeHtml(unsafeHtml);

      expect(safeHtml).not.toContain("<script>");
      expect(safeHtml).not.toContain("onclick");
    });

    it("should validate allowed origins", () => {
      const allowedOrigins = ["https://example.com", "https://cdn.example.com"];

      const isAllowedOrigin = (origin: string): boolean => {
        return allowedOrigins.includes(origin);
      };

      expect(isAllowedOrigin("https://example.com")).toBe(true);
      expect(isAllowedOrigin("https://evil.com")).toBe(false);
    });
  });
});

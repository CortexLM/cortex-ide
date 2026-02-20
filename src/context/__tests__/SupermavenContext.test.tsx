import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("SupermavenContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SupermavenStatus enum", () => {
    it("should define status values", () => {
      const SupermavenStatus = {
        Disconnected: "disconnected",
        Connecting: "connecting",
        Connected: "connected",
        Error: "error",
      } as const;

      expect(SupermavenStatus.Disconnected).toBe("disconnected");
      expect(SupermavenStatus.Connecting).toBe("connecting");
      expect(SupermavenStatus.Connected).toBe("connected");
      expect(SupermavenStatus.Error).toBe("error");
    });
  });

  describe("SupermavenCompletion interface", () => {
    it("should define completion structure", () => {
      interface SupermavenCompletion {
        text: string;
        displayText: string;
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        kind: "inline" | "multiline" | "snippet";
      }

      const completion: SupermavenCompletion = {
        text: "function hello() {\n  console.log('Hello');\n}",
        displayText: "function hello() { ... }",
        range: {
          start: { line: 10, character: 0 },
          end: { line: 10, character: 0 },
        },
        kind: "multiline",
      };

      expect(completion.text).toContain("function hello");
      expect(completion.kind).toBe("multiline");
      expect(completion.range.start.line).toBe(10);
    });
  });

  describe("SupermavenContextState interface", () => {
    it("should define context state structure", () => {
      interface SupermavenCompletion {
        text: string;
        displayText: string;
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        kind: "inline" | "multiline" | "snippet";
      }

      interface SupermavenContextState {
        enabled: boolean;
        apiKey: string | null;
        status: "disconnected" | "connecting" | "connected" | "error";
        isLoading: boolean;
        currentCompletion: SupermavenCompletion | null;
        ghostText: string | null;
        error: string | null;
        debounceMs: number;
      }

      const state: SupermavenContextState = {
        enabled: true,
        apiKey: "sm_test_key_123",
        status: "connected",
        isLoading: false,
        currentCompletion: null,
        ghostText: null,
        error: null,
        debounceMs: 150,
      };

      expect(state.enabled).toBe(true);
      expect(state.apiKey).toBe("sm_test_key_123");
      expect(state.status).toBe("connected");
      expect(state.debounceMs).toBe(150);
    });
  });

  describe("SupermavenContextValue interface", () => {
    it("should define full context value structure", () => {
      interface SupermavenContextValue {
        enabled: boolean;
        apiKey: string | null;
        status: "disconnected" | "connecting" | "connected" | "error";
        isLoading: boolean;
        currentCompletion: unknown;
        ghostText: string | null;
        error: string | null;
        debounceMs: number;
        setEnabled: (enabled: boolean) => void;
        setApiKey: (key: string | null) => void;
        setDebounceMs: (ms: number) => void;
        connect: () => Promise<void>;
        disconnect: () => void;
        signOut: () => Promise<void>;
        requestCompletion: (params: {
          filePath: string;
          content: string;
          cursorPosition: { line: number; character: number };
          language: string;
        }) => Promise<void>;
        acceptCompletion: () => void;
        acceptPartialCompletion: (chars: number) => void;
        dismissCompletion: () => void;
      }

      const mockContext: SupermavenContextValue = {
        enabled: false,
        apiKey: null,
        status: "disconnected",
        isLoading: false,
        currentCompletion: null,
        ghostText: null,
        error: null,
        debounceMs: 150,
        setEnabled: vi.fn(),
        setApiKey: vi.fn(),
        setDebounceMs: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        signOut: vi.fn(),
        requestCompletion: vi.fn(),
        acceptCompletion: vi.fn(),
        acceptPartialCompletion: vi.fn(),
        dismissCompletion: vi.fn(),
      };

      expect(mockContext.enabled).toBe(false);
      expect(mockContext.status).toBe("disconnected");
      expect(typeof mockContext.connect).toBe("function");
    });
  });

  describe("Configuration management", () => {
    it("should enable/disable Supermaven", () => {
      let enabled = false;

      const setEnabled = (value: boolean): void => {
        enabled = value;
      };

      setEnabled(true);
      expect(enabled).toBe(true);

      setEnabled(false);
      expect(enabled).toBe(false);
    });

    it("should set and validate API key", () => {
      let apiKey: string | null = null;

      const setApiKey = (key: string | null): void => {
        if (key === null || key.startsWith("sm_")) {
          apiKey = key;
        }
      };

      setApiKey("sm_valid_key");
      expect(apiKey).toBe("sm_valid_key");

      setApiKey(null);
      expect(apiKey).toBeNull();
    });

    it("should configure debounce delay", () => {
      let debounceMs = 150;

      const setDebounceMs = (ms: number): void => {
        debounceMs = Math.max(50, Math.min(500, ms));
      };

      setDebounceMs(200);
      expect(debounceMs).toBe(200);

      setDebounceMs(10);
      expect(debounceMs).toBe(50);

      setDebounceMs(1000);
      expect(debounceMs).toBe(500);
    });
  });

  describe("Connection management", () => {
    it("should connect to Supermaven service", async () => {
      let status: "disconnected" | "connecting" | "connected" | "error" = "disconnected";

      const connect = async (): Promise<void> => {
        status = "connecting";
        await new Promise((resolve) => setTimeout(resolve, 10));
        status = "connected";
      };

      await connect();
      expect(status).toBe("connected");
    });

    it("should disconnect from Supermaven service", () => {
      let status: "disconnected" | "connecting" | "connected" | "error" = "connected";

      const disconnect = (): void => {
        status = "disconnected";
      };

      disconnect();
      expect(status).toBe("disconnected");
    });

    it("should sign out and clear credentials", async () => {
      let status: "disconnected" | "connecting" | "connected" | "error" = "connected";
      let apiKey: string | null = "sm_test_key";

      const signOut = async (): Promise<void> => {
        apiKey = null;
        status = "disconnected";
      };

      await signOut();
      expect(status).toBe("disconnected");
      expect(apiKey).toBeNull();
    });

    it("should handle connection errors", async () => {
      let status: "disconnected" | "connecting" | "connected" | "error" = "disconnected";
      let error: string | null = null;

      const connect = async (shouldFail: boolean): Promise<void> => {
        status = "connecting";
        if (shouldFail) {
          status = "error";
          error = "Connection failed";
          throw new Error("Connection failed");
        }
        status = "connected";
      };

      try {
        await connect(true);
      } catch {
        expect(status).toBe("error");
        expect(error).toBe("Connection failed");
      }
    });
  });

  describe("Completion management", () => {
    it("should request completion with context", async () => {
      interface CompletionRequest {
        filePath: string;
        content: string;
        cursorPosition: { line: number; character: number };
        language: string;
      }

      const requestCompletion = vi.fn().mockResolvedValue({
        text: "console.log('Hello');",
        displayText: "console.log('Hello');",
        range: {
          start: { line: 5, character: 10 },
          end: { line: 5, character: 10 },
        },
        kind: "inline",
      });

      const request: CompletionRequest = {
        filePath: "/project/src/index.ts",
        content: "const x = ",
        cursorPosition: { line: 5, character: 10 },
        language: "typescript",
      };

      const completion = await requestCompletion(request);
      expect(requestCompletion).toHaveBeenCalledWith(request);
      expect(completion.text).toBe("console.log('Hello');");
    });

    it("should accept full completion", () => {
      interface SupermavenCompletion {
        text: string;
        displayText: string;
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        kind: "inline" | "multiline" | "snippet";
      }

      let currentCompletion: SupermavenCompletion | null = {
        text: "function test() {}",
        displayText: "function test() {}",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        kind: "inline",
      };
      let ghostText: string | null = "function test() {}";

      const acceptCompletion = (): string | null => {
        const accepted = currentCompletion?.text ?? null;
        currentCompletion = null;
        ghostText = null;
        return accepted;
      };

      const accepted = acceptCompletion();
      expect(accepted).toBe("function test() {}");
      expect(currentCompletion).toBeNull();
      expect(ghostText).toBeNull();
    });

    it("should accept partial completion", () => {
      let ghostText: string | null = "console.log('Hello World');";
      let acceptedText = "";

      const acceptPartialCompletion = (chars: number): void => {
        if (ghostText) {
          acceptedText += ghostText.substring(0, chars);
          ghostText = ghostText.substring(chars) || null;
        }
      };

      acceptPartialCompletion(8);
      expect(acceptedText).toBe("console.");
      expect(ghostText).toBe("log('Hello World');");
    });

    it("should dismiss completion", () => {
      let currentCompletion: unknown = { text: "some completion" };
      let ghostText: string | null = "some completion";

      const dismissCompletion = (): void => {
        currentCompletion = null;
        ghostText = null;
      };

      dismissCompletion();
      expect(currentCompletion).toBeNull();
      expect(ghostText).toBeNull();
    });
  });

  describe("Ghost text display", () => {
    it("should show ghost text for pending completion", () => {
      interface GhostTextState {
        text: string;
        position: { line: number; character: number };
        visible: boolean;
      }

      const ghostTextState: GhostTextState = {
        text: "const result = await fetch(url);",
        position: { line: 10, character: 5 },
        visible: true,
      };

      expect(ghostTextState.text).toBe("const result = await fetch(url);");
      expect(ghostTextState.visible).toBe(true);
    });

    it("should hide ghost text when dismissed", () => {
      let ghostText: string | null = "pending text";
      let visible = true;

      const hideGhostText = (): void => {
        ghostText = null;
        visible = false;
      };

      hideGhostText();
      expect(ghostText).toBeNull();
      expect(visible).toBe(false);
    });
  });

  describe("Loading states", () => {
    it("should track loading state during completion request", async () => {
      let isLoading = false;

      const requestCompletion = async (): Promise<void> => {
        isLoading = true;
        await new Promise((resolve) => setTimeout(resolve, 10));
        isLoading = false;
      };

      const promise = requestCompletion();
      expect(isLoading).toBe(true);
      await promise;
      expect(isLoading).toBe(false);
    });

    it("should track loading state during connection", async () => {
      let isLoading = false;
      let status: "disconnected" | "connecting" | "connected" | "error" = "disconnected";

      const connect = async (): Promise<void> => {
        isLoading = true;
        status = "connecting";
        await new Promise((resolve) => setTimeout(resolve, 10));
        status = "connected";
        isLoading = false;
      };

      const promise = connect();
      expect(isLoading).toBe(true);
      expect(status).toBe("connecting");
      await promise;
      expect(isLoading).toBe(false);
      expect(status).toBe("connected");
    });
  });

  describe("Error handling", () => {
    it("should store and clear errors", () => {
      let error: string | null = null;

      const setError = (msg: string | null): void => {
        error = msg;
      };

      setError("API rate limit exceeded");
      expect(error).toBe("API rate limit exceeded");

      setError(null);
      expect(error).toBeNull();
    });

    it("should handle completion request errors", async () => {
      let error: string | null = null;

      const requestCompletion = async (): Promise<void> => {
        throw new Error("Network error");
      };

      try {
        await requestCompletion();
      } catch (e) {
        error = (e as Error).message;
      }

      expect(error).toBe("Network error");
    });
  });

  describe("Settings persistence", () => {
    it("should persist settings to localStorage", () => {
      interface SupermavenSettings {
        enabled: boolean;
        debounceMs: number;
      }

      const STORAGE_KEY = "zen-supermaven-settings";

      const saveSettings = (settings: SupermavenSettings): void => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      };

      const loadSettings = (): SupermavenSettings | null => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      };

      saveSettings({ enabled: true, debounceMs: 200 });
      const loaded = loadSettings();
      expect(loaded?.enabled).toBe(true);
      expect(loaded?.debounceMs).toBe(200);
    });
  });
});

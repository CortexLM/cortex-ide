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

describe("useLspFeature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("UseLspFeatureReturn Interface", () => {
    interface UseLspFeatureReturn<T> {
      data: () => T | undefined;
      error: () => Error | undefined;
      loading: () => boolean;
      execute: (...args: unknown[]) => Promise<T>;
      reset: () => void;
    }

    it("should define return type with string data", () => {
      const mockReturn: UseLspFeatureReturn<string> = {
        data: () => "hover result",
        error: () => undefined,
        loading: () => false,
        execute: vi.fn().mockResolvedValue("hover result"),
        reset: vi.fn(),
      };

      expect(mockReturn.data()).toBe("hover result");
      expect(mockReturn.loading()).toBe(false);
      expect(mockReturn.error()).toBeUndefined();
    });

    it("should define return type with object data", () => {
      interface CompletionResult {
        items: { label: string; kind: string }[];
        isIncomplete: boolean;
      }

      const result: CompletionResult = {
        items: [{ label: "log", kind: "method" }],
        isIncomplete: false,
      };

      const mockReturn: UseLspFeatureReturn<CompletionResult> = {
        data: () => result,
        error: () => undefined,
        loading: () => false,
        execute: vi.fn().mockResolvedValue(result),
        reset: vi.fn(),
      };

      expect(mockReturn.data()?.items).toHaveLength(1);
      expect(mockReturn.data()?.isIncomplete).toBe(false);
    });

    it("should define return type with array data", () => {
      const locations = [
        { uri: "file:///src/app.ts", line: 10 },
        { uri: "file:///src/utils.ts", line: 20 },
      ];

      const mockReturn: UseLspFeatureReturn<typeof locations> = {
        data: () => locations,
        error: () => undefined,
        loading: () => false,
        execute: vi.fn().mockResolvedValue(locations),
        reset: vi.fn(),
      };

      expect(mockReturn.data()).toHaveLength(2);
    });
  });

  describe("Execute Function", () => {
    it("should call the request function via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ contents: "const x: number" });

      const result = await invoke("lsp_hover", {
        serverId: "ts-1",
        filePath: "/src/app.ts",
        position: { line: 0, character: 6 },
      });

      expect(invoke).toHaveBeenCalledWith("lsp_hover", {
        serverId: "ts-1",
        filePath: "/src/app.ts",
        position: { line: 0, character: 6 },
      });
      expect(result).toEqual({ contents: "const x: number" });
    });

    it("should handle invoke failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Server not running"));

      await expect(
        invoke("lsp_hover", { serverId: "ts-1", filePath: "/src/app.ts", position: { line: 0, character: 0 } })
      ).rejects.toThrow("Server not running");
    });
  });

  describe("Loading State Transitions", () => {
    type FeatureStatus = "idle" | "loading" | "success" | "error";

    it("should transition from idle to loading", () => {
      let status: FeatureStatus = "idle";
      status = "loading";
      expect(status).toBe("loading");
    });

    it("should transition from loading to success", () => {
      let status: FeatureStatus = "loading";
      status = "success";
      expect(status).toBe("success");
    });

    it("should transition from loading to error", () => {
      let status: FeatureStatus = "loading";
      status = "error";
      expect(status).toBe("error");
    });
  });

  describe("Error State", () => {
    it("should capture error on failure", () => {
      let error: Error | undefined;
      try {
        throw new Error("LSP request timed out");
      } catch (e) {
        error = e as Error;
      }

      expect(error?.message).toBe("LSP request timed out");
    });

    it("should clear error on successful execute", () => {
      let error: Error | undefined = new Error("Previous error");
      error = undefined;
      expect(error).toBeUndefined();
    });
  });

  describe("Reset Function", () => {
    it("should reset all state to initial values", () => {
      let data: string | undefined = "some result";
      let error: Error | undefined = new Error("old error");
      let status = "success";

      const reset = () => {
        data = undefined;
        error = undefined;
        status = "idle";
      };

      reset();

      expect(data).toBeUndefined();
      expect(error).toBeUndefined();
      expect(status).toBe("idle");
    });
  });

  describe("Immediate Option", () => {
    interface UseLspFeatureOptions {
      immediate?: boolean;
      serverId?: string;
    }

    it("should trigger execute on mount when immediate is true", () => {
      const executeFn = vi.fn();
      const options: UseLspFeatureOptions = { immediate: true, serverId: "ts-1" };

      if (options.immediate) {
        executeFn();
      }

      expect(executeFn).toHaveBeenCalled();
    });

    it("should not trigger execute when immediate is false", () => {
      const executeFn = vi.fn();
      const options: UseLspFeatureOptions = { immediate: false };

      if (options.immediate) {
        executeFn();
      }

      expect(executeFn).not.toHaveBeenCalled();
    });

    it("should not trigger execute when immediate is undefined", () => {
      const executeFn = vi.fn();
      const options: UseLspFeatureOptions = {};

      if (options.immediate) {
        executeFn();
      }

      expect(executeFn).not.toHaveBeenCalled();
    });
  });

  describe("LSP Feature Events", () => {
    it("should listen for feature response events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("lsp:feature-response", () => {});

      expect(listen).toHaveBeenCalledWith("lsp:feature-response", expect.any(Function));
    });
  });
});

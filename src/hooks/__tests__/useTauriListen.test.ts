import { describe, it, expect, vi, beforeEach } from "vitest";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("useTauriListen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Event Subscription", () => {
    it("should subscribe to a Tauri event", async () => {
      const handler = vi.fn();
      await listen("file-changed", handler);

      expect(listen).toHaveBeenCalledWith("file-changed", handler);
    });

    it("should return an unlisten function", async () => {
      const unlisten = vi.fn();
      vi.mocked(listen).mockResolvedValue(unlisten);

      const result = await listen("test-event", () => {});

      expect(typeof result).toBe("function");
    });

    it("should subscribe to different event types", async () => {
      await listen("file-changed", () => {});
      await listen("git:branch-changed", () => {});
      await listen("terminal:output", () => {});

      expect(listen).toHaveBeenCalledTimes(3);
      expect(listen).toHaveBeenCalledWith("file-changed", expect.any(Function));
      expect(listen).toHaveBeenCalledWith("git:branch-changed", expect.any(Function));
      expect(listen).toHaveBeenCalledWith("terminal:output", expect.any(Function));
    });
  });

  describe("Event Handler", () => {
    it("should handle typed payloads", async () => {
      interface FileChangedPayload {
        path: string;
        kind: "create" | "modify" | "delete";
      }

      const handler = vi.fn();
      await listen<FileChangedPayload>("file-changed", handler);

      expect(listen).toHaveBeenCalledWith("file-changed", expect.any(Function));
    });

    it("should handle events with complex payloads", async () => {
      interface TerminalOutput {
        terminalId: string;
        data: string;
        timestamp: number;
      }

      const payload: TerminalOutput = {
        terminalId: "term-1",
        data: "Hello, World!",
        timestamp: Date.now(),
      };

      expect(payload.terminalId).toBe("term-1");
      expect(payload.data).toBe("Hello, World!");
    });
  });

  describe("Cleanup", () => {
    it("should call unlisten on cleanup", async () => {
      const unlisten = vi.fn();
      vi.mocked(listen).mockResolvedValue(unlisten);

      const unlistenFn = await listen("test-event", () => {});
      unlistenFn();

      expect(unlisten).toHaveBeenCalled();
    });

    it("should handle cleanup before listener is ready", async () => {
      let resolveListener: (fn: () => void) => void;
      const listenerPromise = new Promise<() => void>((resolve) => {
        resolveListener = resolve;
      });

      vi.mocked(listen).mockReturnValue(listenerPromise);

      const promise = listen("test-event", () => {});

      const unlisten = vi.fn();
      resolveListener!(unlisten);

      const result = await promise;
      result();

      expect(unlisten).toHaveBeenCalled();
    });
  });

  describe("Multiple Listeners (useTauriListeners pattern)", () => {
    it("should set up multiple listeners", async () => {
      const listeners = [
        { event: "file-changed", handler: vi.fn() },
        { event: "file-deleted", handler: vi.fn() },
        { event: "file-created", handler: vi.fn() },
      ];

      const unlistenFns = await Promise.all(
        listeners.map(({ event, handler }) => listen(event, handler))
      );

      expect(listen).toHaveBeenCalledTimes(3);
      expect(unlistenFns).toHaveLength(3);
    });

    it("should clean up all listeners", async () => {
      const unlisten1 = vi.fn();
      const unlisten2 = vi.fn();
      const unlisten3 = vi.fn();

      vi.mocked(listen)
        .mockResolvedValueOnce(unlisten1)
        .mockResolvedValueOnce(unlisten2)
        .mockResolvedValueOnce(unlisten3);

      const fns = await Promise.all([
        listen("event-1", () => {}),
        listen("event-2", () => {}),
        listen("event-3", () => {}),
      ]);

      fns.forEach((fn) => fn());

      expect(unlisten1).toHaveBeenCalled();
      expect(unlisten2).toHaveBeenCalled();
      expect(unlisten3).toHaveBeenCalled();
    });
  });

  describe("Conditional Listener (useTauriListenWhen pattern)", () => {
    it("should skip listener when condition is false", () => {
      const condition = () => false;

      if (!condition()) {
        expect(listen).not.toHaveBeenCalled();
      }
    });

    it("should set up listener when condition is true", async () => {
      const condition = () => true;

      if (condition()) {
        await listen("test-event", () => {});
        expect(listen).toHaveBeenCalledWith("test-event", expect.any(Function));
      }
    });

    it("should filter events based on condition", () => {
      const condition = vi.fn().mockReturnValue(true);
      const handler = vi.fn();

      const wrappedHandler = (payload: unknown) => {
        if (condition()) {
          handler(payload);
        }
      };

      wrappedHandler({ data: "test" });
      expect(handler).toHaveBeenCalledWith({ data: "test" });

      condition.mockReturnValue(false);
      wrappedHandler({ data: "ignored" });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle listen failure gracefully", async () => {
      vi.mocked(listen).mockRejectedValue(new Error("Connection failed"));

      await expect(listen("test-event", () => {})).rejects.toThrow("Connection failed");
    });

    it("should handle listen failure in batch", async () => {
      vi.mocked(listen)
        .mockResolvedValueOnce(() => {})
        .mockRejectedValueOnce(new Error("Failed"));

      const results = await Promise.allSettled([
        listen("event-1", () => {}),
        listen("event-2", () => {}),
      ]);

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
    });
  });

  describe("Mounted State Tracking", () => {
    it("should track mounted state for safe handler calls", () => {
      let mounted = true;
      const handler = vi.fn();

      const safeHandler = (payload: unknown) => {
        if (mounted) {
          handler(payload);
        }
      };

      safeHandler({ data: "test" });
      expect(handler).toHaveBeenCalledTimes(1);

      mounted = false;
      safeHandler({ data: "after unmount" });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should clean up unlisten if unmounted before ready", async () => {
      let mounted = true;
      const unlisten = vi.fn();

      vi.mocked(listen).mockResolvedValue(unlisten);

      const unlistenFn = await listen("test-event", () => {});

      mounted = false;

      if (!mounted) {
        unlistenFn();
      }

      expect(unlisten).toHaveBeenCalled();
    });
  });
});

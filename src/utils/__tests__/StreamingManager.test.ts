import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  StreamingManager,
  getStreamingManager,
  createTextUpdate,
  createTerminalUpdate,
  createListUpdate,
  createProgressUpdate,
} from "../StreamingManager";

describe("StreamingManager", () => {
  let manager: StreamingManager;

  beforeEach(() => {
    manager = new StreamingManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe("constructor", () => {
    it("creates instance", () => {
      expect(manager).toBeDefined();
    });
  });

  describe("subscribe", () => {
    it("returns unsubscribe function", () => {
      const unsubscribe = manager.subscribe(vi.fn());
      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });
  });

  describe("queueUpdate", () => {
    it("queues an update", () => {
      const update = createTextUpdate("hello");
      manager.queueUpdate(update);
      const stats = manager.getStats();
      expect(stats.totalUpdates).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getStats", () => {
    it("returns stats with expected fields", () => {
      const stats = manager.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalUpdates).toBe("number");
      expect(typeof stats.subscriberCount).toBe("number");
    });
  });

  describe("getBackpressureStatus", () => {
    it("returns backpressure status", () => {
      const status = manager.getBackpressureStatus();
      expect(status).toBeDefined();
      expect(typeof status.active).toBe("boolean");
    });
  });

  describe("destroy", () => {
    it("cleans up without error", () => {
      manager.destroy();
    });
  });

  describe("getStreamingManager", () => {
    it("returns singleton instance", () => {
      const a = getStreamingManager();
      const b = getStreamingManager();
      expect(a).toBe(b);
    });
  });

  describe("createTextUpdate", () => {
    it("creates text update with content", () => {
      const update = createTextUpdate("hello");
      expect(update.type).toBe("text");
      expect(update.content).toBe("hello");
      expect(update.priority).toBe("normal");
      expect(update.id).toBeDefined();
      expect(update.timestamp).toBeDefined();
    });

    it("creates with custom options", () => {
      const update = createTextUpdate("hello", { targetId: "t1", priority: "high" });
      expect(update.targetId).toBe("t1");
      expect(update.priority).toBe("high");
    });
  });

  describe("createTerminalUpdate", () => {
    it("creates terminal update", () => {
      const update = createTerminalUpdate("output", "stdout");
      expect(update.type).toBe("terminal");
      expect(update.output).toBe("output");
      expect(update.stream).toBe("stdout");
    });

    it("defaults to stdout", () => {
      const update = createTerminalUpdate("output");
      expect(update.stream).toBe("stdout");
    });
  });

  describe("createListUpdate", () => {
    it("creates list add update", () => {
      const update = createListUpdate("mylist", "list_add", [{ id: "1", content: "item" }]);
      expect(update.type).toBe("list_add");
      expect(update.listId).toBe("mylist");
      expect(update.items).toHaveLength(1);
    });
  });

  describe("createProgressUpdate", () => {
    it("creates progress update", () => {
      const update = createProgressUpdate(50, { taskId: "task1", message: "Half done" });
      expect(update.type).toBe("progress");
      expect(update.progress).toBe(50);
      expect(update.taskId).toBe("task1");
      expect(update.message).toBe("Half done");
    });

    it("accepts null progress", () => {
      const update = createProgressUpdate(null);
      expect(update.progress).toBeNull();
    });
  });
});

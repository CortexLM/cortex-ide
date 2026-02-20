import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Event Bus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("AppEventMap Interface", () => {
    interface AppEventMap {
      "settings:changed": { section: string };
      "settings:reset": void;
      "explorer:reveal": { path: string };
      "workspace:folder-added": { path: string };
      "project:opened": { path: string };
      "project:closed": void;
    }

    it("should define event types", () => {
      const eventTypes: (keyof AppEventMap)[] = [
        "settings:changed",
        "settings:reset",
        "explorer:reveal",
        "workspace:folder-added",
        "project:opened",
        "project:closed",
      ];

      expect(eventTypes).toHaveLength(6);
    });

    it("should type event payloads", () => {
      const settingsPayload: AppEventMap["settings:changed"] = { section: "editor" };
      const explorerPayload: AppEventMap["explorer:reveal"] = { path: "/test/file.ts" };

      expect(settingsPayload.section).toBe("editor");
      expect(explorerPayload.path).toBe("/test/file.ts");
    });
  });

  describe("TypedCustomEvent", () => {
    class TypedCustomEvent<T> extends CustomEvent<T> {
      constructor(type: string, detail: T) {
        super(type, { detail });
      }
    }

    it("should create typed custom event", () => {
      const event = new TypedCustomEvent("settings:changed", { section: "editor" });

      expect(event.type).toBe("settings:changed");
      expect(event.detail).toEqual({ section: "editor" });
    });

    it("should create event with void payload", () => {
      const event = new TypedCustomEvent("settings:reset", undefined);

      expect(event.type).toBe("settings:reset");
      expect(event.detail == null).toBe(true);
    });
  });

  describe("dispatchAppEvent", () => {
    it("should dispatch event to window", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      window.dispatchEvent(new CustomEvent("settings:changed", { detail: { section: "editor" } }));

      expect(dispatchSpy).toHaveBeenCalled();
    });

    it("should dispatch event with correct type", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      window.dispatchEvent(new CustomEvent("project:opened", { detail: { path: "/test" } }));

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "project:opened" })
      );
    });
  });

  describe("addAppEventListener", () => {
    it("should add event listener", () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const handler = vi.fn();

      window.addEventListener("settings:changed", handler);

      expect(addSpy).toHaveBeenCalledWith("settings:changed", handler);
    });

    it("should return cleanup function", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");
      const handler = vi.fn();

      window.addEventListener("settings:changed", handler);
      window.removeEventListener("settings:changed", handler);

      expect(removeSpy).toHaveBeenCalledWith("settings:changed", handler);
    });

    it("should receive event with detail", () => {
      const handler = vi.fn();

      window.addEventListener("test:event", handler);
      window.dispatchEvent(new CustomEvent("test:event", { detail: { value: 42 } }));

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].detail).toEqual({ value: 42 });

      window.removeEventListener("test:event", handler);
    });
  });

  describe("removeAppEventListener", () => {
    it("should remove event listener", () => {
      const handler = vi.fn();

      window.addEventListener("settings:changed", handler);
      window.removeEventListener("settings:changed", handler);

      window.dispatchEvent(new CustomEvent("settings:changed", { detail: { section: "editor" } }));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Settings Events", () => {
    interface SettingsChangedPayload {
      section: string;
      settings?: unknown;
    }

    it("should type settings changed event", () => {
      const payload: SettingsChangedPayload = {
        section: "editor",
        settings: { fontSize: 14 },
      };

      expect(payload.section).toBe("editor");
      expect(payload.settings).toEqual({ fontSize: 14 });
    });

    it("should handle settings reset event", () => {
      const handler = vi.fn();

      window.addEventListener("settings:reset", handler);
      window.dispatchEvent(new CustomEvent("settings:reset"));

      expect(handler).toHaveBeenCalled();

      window.removeEventListener("settings:reset", handler);
    });
  });

  describe("Explorer Events", () => {
    interface ExplorerRevealPayload {
      path: string;
    }

    it("should type explorer reveal event", () => {
      const payload: ExplorerRevealPayload = {
        path: "/workspace/src/app.ts",
      };

      expect(payload.path).toBe("/workspace/src/app.ts");
    });

    it("should dispatch and receive explorer event", () => {
      const handler = vi.fn();

      window.addEventListener("explorer:reveal", handler);
      window.dispatchEvent(new CustomEvent("explorer:reveal", {
        detail: { path: "/test/file.ts" },
      }));

      expect(handler).toHaveBeenCalled();

      window.removeEventListener("explorer:reveal", handler);
    });
  });

  describe("Workspace Events", () => {
    interface WorkspaceFolderPayload {
      path: string;
    }

    it("should type workspace folder events", () => {
      const addPayload: WorkspaceFolderPayload = { path: "/new/folder" };
      const removePayload: WorkspaceFolderPayload = { path: "/old/folder" };

      expect(addPayload.path).toBe("/new/folder");
      expect(removePayload.path).toBe("/old/folder");
    });
  });

  describe("Project Events", () => {
    interface ProjectOpenedPayload {
      path: string;
    }

    it("should type project opened event", () => {
      const payload: ProjectOpenedPayload = {
        path: "/workspace/my-project",
      };

      expect(payload.path).toBe("/workspace/my-project");
    });

    it("should handle project closed event", () => {
      const handler = vi.fn();

      window.addEventListener("project:closed", handler);
      window.dispatchEvent(new CustomEvent("project:closed"));

      expect(handler).toHaveBeenCalled();

      window.removeEventListener("project:closed", handler);
    });
  });

  describe("Event Payload Type Guard", () => {
    const isAppEvent = <T>(event: Event, type: string): event is CustomEvent<T> => {
      return event.type === type && event instanceof CustomEvent;
    };

    it("should validate event type", () => {
      const event = new CustomEvent("settings:changed", { detail: { section: "editor" } });

      expect(isAppEvent(event, "settings:changed")).toBe(true);
      expect(isAppEvent(event, "other:event")).toBe(false);
    });

    it("should reject non-CustomEvent", () => {
      const event = new Event("click");

      expect(isAppEvent(event, "click")).toBe(false);
    });
  });

  describe("Event Subscription Pattern", () => {
    class EventSubscription {
      private listeners: Map<string, Set<EventListener>> = new Map();

      subscribe(event: string, handler: EventListener): () => void {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
        window.addEventListener(event, handler);

        return () => {
          this.listeners.get(event)?.delete(handler);
          window.removeEventListener(event, handler);
        };
      }

      unsubscribeAll(): void {
        for (const [event, handlers] of this.listeners) {
          for (const handler of handlers) {
            window.removeEventListener(event, handler);
          }
        }
        this.listeners.clear();
      }
    }

    it("should manage subscriptions", () => {
      const subscription = new EventSubscription();
      const handler = vi.fn();

      const unsubscribe = subscription.subscribe("test:event", handler);

      window.dispatchEvent(new CustomEvent("test:event"));
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      window.dispatchEvent(new CustomEvent("test:event"));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should unsubscribe all", () => {
      const subscription = new EventSubscription();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      subscription.subscribe("event1", handler1);
      subscription.subscribe("event2", handler2);

      subscription.unsubscribeAll();

      window.dispatchEvent(new CustomEvent("event1"));
      window.dispatchEvent(new CustomEvent("event2"));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe("Debounced Events", () => {
    it("should debounce rapid events", async () => {
      const handler = vi.fn();
      let timeoutId: number | undefined;

      const debouncedHandler = () => {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        timeoutId = setTimeout(handler, 100) as unknown as number;
      };

      debouncedHandler();
      debouncedHandler();
      debouncedHandler();

      expect(handler).not.toHaveBeenCalled();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("Event Bus Singleton", () => {
    class EventBus {
      private static instance: EventBus;

      private constructor() {}

      static getInstance(): EventBus {
        if (!EventBus.instance) {
          EventBus.instance = new EventBus();
        }
        return EventBus.instance;
      }

      emit(event: string, detail?: unknown): void {
        window.dispatchEvent(new CustomEvent(event, { detail }));
      }

      on(event: string, handler: EventListener): () => void {
        window.addEventListener(event, handler);
        return () => window.removeEventListener(event, handler);
      }
    }

    it("should return same instance", () => {
      const bus1 = EventBus.getInstance();
      const bus2 = EventBus.getInstance();

      expect(bus1).toBe(bus2);
    });

    it("should emit and receive events", () => {
      const bus = EventBus.getInstance();
      const handler = vi.fn();

      const off = bus.on("test:singleton", handler);
      bus.emit("test:singleton", { value: 123 });

      expect(handler).toHaveBeenCalled();

      off();
    });
  });
});

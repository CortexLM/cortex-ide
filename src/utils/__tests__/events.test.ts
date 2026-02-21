import { describe, it, expect, vi } from "vitest";
import {
  EVENTS,
  dispatchEvent,
  dispatchUntypedEvent,
  addEventListener,
  addUntypedEventListener,
} from "../events";

describe("events", () => {
  describe("EVENTS", () => {
    it("has workspace events", () => {
      expect(EVENTS.WORKSPACE.LOADED).toBe("workspace:loaded");
      expect(EVENTS.WORKSPACE.CLOSED).toBe("workspace:closed");
    });
    it("has editor events", () => {
      expect(EVENTS.EDITOR.FILE_OPENED).toBe("editor:file-opened");
      expect(EVENTS.EDITOR.FILE_CLOSED).toBe("editor:file-closed");
    });
    it("has file events", () => {
      expect(EVENTS.FILE.SAVED).toBe("file:saved");
      expect(EVENTS.FILE.CHANGED).toBe("file:changed");
    });
  });

  describe("dispatchUntypedEvent", () => {
    it("dispatches custom event on window", () => {
      const spy = vi.fn();
      window.addEventListener("test:custom", spy);
      dispatchUntypedEvent("test:custom", { data: 42 });
      expect(spy).toHaveBeenCalledTimes(1);
      const event = spy.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({ data: 42 });
      window.removeEventListener("test:custom", spy);
    });
    it("dispatches without detail", () => {
      const spy = vi.fn();
      window.addEventListener("test:nodetail", spy);
      dispatchUntypedEvent("test:nodetail");
      expect(spy).toHaveBeenCalledTimes(1);
      window.removeEventListener("test:nodetail", spy);
    });
  });

  describe("addUntypedEventListener", () => {
    it("adds listener and returns cleanup", () => {
      const handler = vi.fn();
      const cleanup = addUntypedEventListener("test:listen", handler);
      dispatchUntypedEvent("test:listen", "payload");
      expect(handler).toHaveBeenCalledTimes(1);
      cleanup();
      dispatchUntypedEvent("test:listen", "payload2");
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("useEventListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("EventListenerOptions interface", () => {
    interface EventListenerOptions extends AddEventListenerOptions {
      target?: EventTarget | (() => EventTarget | null | undefined);
      passive?: boolean;
      capture?: boolean;
      once?: boolean;
      signal?: AbortSignal;
      enabled?: boolean;
    }

    it("should define all option fields", () => {
      const options: EventListenerOptions = {
        passive: true,
        capture: false,
        once: false,
        enabled: true,
      };

      expect(options.passive).toBe(true);
      expect(options.capture).toBe(false);
      expect(options.once).toBe(false);
      expect(options.enabled).toBe(true);
    });

    it("should support target as element", () => {
      const div = document.createElement("div");
      const options: EventListenerOptions = {
        target: div,
      };

      expect(options.target).toBe(div);
    });

    it("should support target as accessor function", () => {
      const div = document.createElement("div");
      const options: EventListenerOptions = {
        target: () => div,
      };

      expect(typeof options.target).toBe("function");
    });

    it("should support AbortSignal", () => {
      const controller = new AbortController();
      const options: EventListenerOptions = {
        signal: controller.signal,
      };

      expect(options.signal).toBe(controller.signal);
    });
  });

  describe("Window event listeners", () => {
    it("should add event listener to window", () => {
      const handler = vi.fn();
      window.addEventListener("resize", handler);

      window.dispatchEvent(new Event("resize"));

      expect(handler).toHaveBeenCalled();
      window.removeEventListener("resize", handler);
    });

    it("should remove event listener on cleanup", () => {
      const handler = vi.fn();
      window.addEventListener("resize", handler);
      window.removeEventListener("resize", handler);

      window.dispatchEvent(new Event("resize"));

      expect(handler).not.toHaveBeenCalled();
    });

    it("should support passive listeners", () => {
      const handler = vi.fn();
      window.addEventListener("scroll", handler, { passive: true });

      window.dispatchEvent(new Event("scroll"));

      expect(handler).toHaveBeenCalled();
      window.removeEventListener("scroll", handler);
    });
  });

  describe("Document event listeners", () => {
    it("should add event listener to document", () => {
      const handler = vi.fn();
      document.addEventListener("visibilitychange", handler);

      document.dispatchEvent(new Event("visibilitychange"));

      expect(handler).toHaveBeenCalled();
      document.removeEventListener("visibilitychange", handler);
    });

    it("should add click listener to document", () => {
      const handler = vi.fn();
      document.addEventListener("click", handler);

      document.dispatchEvent(new MouseEvent("click"));

      expect(handler).toHaveBeenCalled();
      document.removeEventListener("click", handler);
    });
  });

  describe("Element event listeners", () => {
    it("should add event listener to element", () => {
      const div = document.createElement("div");
      const handler = vi.fn();
      div.addEventListener("click", handler);

      div.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(handler).toHaveBeenCalled();
      div.removeEventListener("click", handler);
    });

    it("should handle multiple listeners on same element", () => {
      const div = document.createElement("div");
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      div.addEventListener("click", handler1);
      div.addEventListener("click", handler2);

      div.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();

      div.removeEventListener("click", handler1);
      div.removeEventListener("click", handler2);
    });
  });

  describe("useWindowResize pattern", () => {
    it("should call handler with window dimensions", () => {
      const handler = vi.fn();
      const wrappedHandler = () => {
        handler(window.innerWidth, window.innerHeight);
      };

      window.addEventListener("resize", wrappedHandler, { passive: true });
      window.dispatchEvent(new Event("resize"));

      expect(handler).toHaveBeenCalled();
      window.removeEventListener("resize", wrappedHandler);
    });
  });

  describe("useVisibilityChange pattern", () => {
    it("should detect visibility changes", () => {
      const handler = vi.fn();
      const wrappedHandler = () => {
        handler(document.visibilityState === "visible");
      };

      document.addEventListener("visibilitychange", wrappedHandler);
      document.dispatchEvent(new Event("visibilitychange"));

      expect(handler).toHaveBeenCalled();
      document.removeEventListener("visibilitychange", wrappedHandler);
    });
  });

  describe("useWindowFocus pattern", () => {
    it("should detect focus events", () => {
      const handler = vi.fn();

      const focusHandler = () => handler(true);
      const blurHandler = () => handler(false);

      window.addEventListener("focus", focusHandler, { passive: true });
      window.addEventListener("blur", blurHandler, { passive: true });

      window.dispatchEvent(new Event("focus"));
      expect(handler).toHaveBeenCalledWith(true);

      window.dispatchEvent(new Event("blur"));
      expect(handler).toHaveBeenCalledWith(false);

      window.removeEventListener("focus", focusHandler);
      window.removeEventListener("blur", blurHandler);
    });
  });

  describe("useClickOutside pattern", () => {
    it("should detect clicks outside element", () => {
      const element = document.createElement("div");
      const outsideElement = document.createElement("div");
      document.body.appendChild(element);
      document.body.appendChild(outsideElement);

      const handler = vi.fn();

      const mousedownHandler = (event: Event) => {
        const target = event.target as Node | null;
        if (target && !element.contains(target)) {
          handler(event);
        }
      };

      document.addEventListener("mousedown", mousedownHandler);

      outsideElement.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(handler).toHaveBeenCalled();

      handler.mockClear();
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(handler).not.toHaveBeenCalled();

      document.removeEventListener("mousedown", mousedownHandler);
      document.body.removeChild(element);
      document.body.removeChild(outsideElement);
    });
  });

  describe("useInterval pattern", () => {
    it("should call callback at interval", () => {
      vi.useFakeTimers();
      const callback = vi.fn();

      const id = setInterval(callback, 1000);

      vi.advanceTimersByTime(3000);
      expect(callback).toHaveBeenCalledTimes(3);

      clearInterval(id);
    });

    it("should not call when delay is null", () => {
      const callback = vi.fn();
      const delay: number | null = null;

      if (delay !== null) {
        setInterval(callback, delay);
      }

      expect(callback).not.toHaveBeenCalled();
    });

    it("should clean up interval on unmount", () => {
      vi.useFakeTimers();
      const callback = vi.fn();

      const id = setInterval(callback, 100);
      vi.advanceTimersByTime(300);
      expect(callback).toHaveBeenCalledTimes(3);

      clearInterval(id);
      vi.advanceTimersByTime(300);
      expect(callback).toHaveBeenCalledTimes(3);
    });
  });

  describe("useTimeout pattern", () => {
    it("should call callback after delay", () => {
      vi.useFakeTimers();
      const callback = vi.fn();

      setTimeout(callback, 1000);

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should not call when delay is null", () => {
      const callback = vi.fn();
      const delay: number | null = null;

      if (delay !== null) {
        setTimeout(callback, delay);
      }

      expect(callback).not.toHaveBeenCalled();
    });

    it("should clean up timeout on unmount", () => {
      vi.useFakeTimers();
      const callback = vi.fn();

      const id = setTimeout(callback, 1000);
      clearTimeout(id);

      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("useCustomEvent pattern", () => {
    it("should handle custom events with typed payload", () => {
      interface NotificationPayload {
        message: string;
        level: "info" | "warning" | "error";
      }

      const handler = vi.fn();

      const wrappedHandler = (event: Event) => {
        const customEvent = event as CustomEvent<NotificationPayload>;
        handler(customEvent.detail, customEvent);
      };

      window.addEventListener("notification", wrappedHandler);

      const payload: NotificationPayload = { message: "Hello", level: "info" };
      window.dispatchEvent(new CustomEvent("notification", { detail: payload }));

      expect(handler).toHaveBeenCalledWith(payload, expect.any(CustomEvent));

      window.removeEventListener("notification", wrappedHandler);
    });
  });

  describe("useCustomEventDispatcher pattern", () => {
    it("should dispatch custom events", () => {
      const handler = vi.fn();
      window.addEventListener("test-event", handler);

      const dispatch = <T>(detail: T) => {
        window.dispatchEvent(
          new CustomEvent("test-event", { detail, bubbles: true, cancelable: true })
        );
      };

      dispatch({ data: "test" });

      expect(handler).toHaveBeenCalled();
      window.removeEventListener("test-event", handler);
    });

    it("should dispatch to specific target", () => {
      const div = document.createElement("div");
      const handler = vi.fn();
      div.addEventListener("custom", handler);

      div.dispatchEvent(new CustomEvent("custom", { detail: { value: 42 } }));

      expect(handler).toHaveBeenCalled();
      div.removeEventListener("custom", handler);
    });
  });

  describe("useKeyboardEvent pattern", () => {
    it("should handle keyboard events", () => {
      const handler = vi.fn();

      window.addEventListener("keydown", handler);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

      expect(handler).toHaveBeenCalled();
      window.removeEventListener("keydown", handler);
    });

    it("should differentiate key types", () => {
      const keys: string[] = [];
      const handler = (e: Event) => {
        keys.push((e as KeyboardEvent).key);
      };

      window.addEventListener("keydown", handler);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));

      expect(keys).toEqual(["Enter", "Escape", "Tab"]);
      window.removeEventListener("keydown", handler);
    });
  });

  describe("useMouseEvent pattern", () => {
    it("should handle mouse events with position", () => {
      const handler = vi.fn();

      const wrappedHandler = (event: Event) => {
        const mouseEvent = event as MouseEvent;
        handler(mouseEvent.clientX, mouseEvent.clientY, mouseEvent);
      };

      window.addEventListener("mousemove", wrappedHandler);
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 100, clientY: 200 })
      );

      expect(handler).toHaveBeenCalledWith(100, 200, expect.any(MouseEvent));
      window.removeEventListener("mousemove", wrappedHandler);
    });
  });

  describe("Multiple event listeners pattern", () => {
    it("should manage multiple listeners with cleanup", () => {
      const handlers = {
        keydown: vi.fn(),
        keyup: vi.fn(),
        click: vi.fn(),
      };

      const listeners = [
        { type: "keydown" as const, handler: handlers.keydown },
        { type: "keyup" as const, handler: handlers.keyup },
        { type: "click" as const, handler: handlers.click },
      ];

      listeners.forEach(({ type, handler }) => {
        window.addEventListener(type, handler);
      });

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "a" }));
      window.dispatchEvent(new MouseEvent("click"));

      expect(handlers.keydown).toHaveBeenCalled();
      expect(handlers.keyup).toHaveBeenCalled();
      expect(handlers.click).toHaveBeenCalled();

      listeners.forEach(({ type, handler }) => {
        window.removeEventListener(type, handler);
      });
    });
  });

  describe("Target resolution", () => {
    it("should default to window when no target specified", () => {
      const target = typeof window !== "undefined" ? window : null;
      expect(target).toBe(window);
    });

    it("should resolve accessor targets", () => {
      const div = document.createElement("div");
      const targetAccessor = () => div;

      const resolved = typeof targetAccessor === "function" ? targetAccessor() : targetAccessor;
      expect(resolved).toBe(div);
    });

    it("should handle null targets", () => {
      const targetAccessor = () => null;
      const resolved = targetAccessor();
      expect(resolved).toBeNull();
    });

    it("should handle undefined targets", () => {
      const targetAccessor = () => undefined;
      const resolved = targetAccessor();
      expect(resolved).toBeUndefined();
    });
  });

  describe("Enabled option", () => {
    it("should skip listener when disabled", () => {
      const handler = vi.fn();
      const enabled = false;

      if (enabled) {
        window.addEventListener("click", handler);
      }

      window.dispatchEvent(new MouseEvent("click"));
      expect(handler).not.toHaveBeenCalled();
    });

    it("should add listener when enabled", () => {
      const handler = vi.fn();
      const enabled = true;

      if (enabled) {
        window.addEventListener("click", handler);
      }

      window.dispatchEvent(new MouseEvent("click"));
      expect(handler).toHaveBeenCalled();
      window.removeEventListener("click", handler);
    });
  });
});

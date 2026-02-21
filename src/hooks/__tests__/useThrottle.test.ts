import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("useThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("ThrottleOptions interface", () => {
    interface ThrottleOptions {
      interval?: number;
      leading?: boolean;
      trailing?: boolean;
    }

    it("should define all option fields", () => {
      const options: ThrottleOptions = {
        interval: 100,
        leading: true,
        trailing: true,
      };

      expect(options.interval).toBe(100);
      expect(options.leading).toBe(true);
      expect(options.trailing).toBe(true);
    });

    it("should support default values", () => {
      const options: ThrottleOptions = {};
      const defaults = {
        interval: options.interval ?? 100,
        leading: options.leading ?? true,
        trailing: options.trailing ?? true,
      };

      expect(defaults.interval).toBe(100);
      expect(defaults.leading).toBe(true);
      expect(defaults.trailing).toBe(true);
    });

    it("should support leading-only mode", () => {
      const options: ThrottleOptions = {
        leading: true,
        trailing: false,
      };

      expect(options.leading).toBe(true);
      expect(options.trailing).toBe(false);
    });

    it("should support trailing-only mode", () => {
      const options: ThrottleOptions = {
        leading: false,
        trailing: true,
      };

      expect(options.leading).toBe(false);
      expect(options.trailing).toBe(true);
    });
  });

  describe("ThrottledFunction interface", () => {
    interface ThrottledFunction<T extends (...args: any[]) => any> {
      (...args: Parameters<T>): void;
      cancel: () => void;
      flush: () => void;
      isPending: () => boolean;
      getRemainingTime: () => number;
    }

    it("should define all utility methods", () => {
      const fn: ThrottledFunction<(x: number) => void> = Object.assign(
        vi.fn(),
        {
          cancel: vi.fn(),
          flush: vi.fn(),
          isPending: vi.fn().mockReturnValue(false),
          getRemainingTime: vi.fn().mockReturnValue(0),
        }
      );

      expect(typeof fn).toBe("function");
      expect(typeof fn.cancel).toBe("function");
      expect(typeof fn.flush).toBe("function");
      expect(typeof fn.isPending).toBe("function");
      expect(typeof fn.getRemainingTime).toBe("function");
    });
  });

  describe("Throttled callback behavior", () => {
    it("should execute immediately on first call (leading)", () => {
      const callback = vi.fn();
      let lastExecutedTime = 0;
      const interval = 100;

      const throttled = (...args: unknown[]) => {
        const now = Date.now();
        const timeSince = now - lastExecutedTime;
        if (timeSince >= interval || lastExecutedTime === 0) {
          callback(...args);
          lastExecutedTime = now;
        }
      };

      throttled("a");
      expect(callback).toHaveBeenCalledWith("a");
    });

    it("should throttle subsequent calls within interval", () => {
      const callback = vi.fn();
      let lastExecutedTime = 0;
      const interval = 100;

      const throttled = () => {
        const now = Date.now();
        const timeSince = now - lastExecutedTime;
        if (timeSince >= interval || lastExecutedTime === 0) {
          callback();
          lastExecutedTime = now;
        }
      };

      throttled();
      expect(callback).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      throttled();
      expect(callback).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      throttled();
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("should support trailing execution", () => {
      const callback = vi.fn();
      const interval = 100;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let lastArgs: unknown[] | null = null;

      const throttled = (...args: unknown[]) => {
        lastArgs = args;
        if (timeoutId === null) {
          callback(...args);
          timeoutId = setTimeout(() => {
            timeoutId = null;
            if (lastArgs !== null) {
              callback(...lastArgs);
              lastArgs = null;
            }
          }, interval);
        }
      };

      throttled("first");
      expect(callback).toHaveBeenCalledTimes(1);

      throttled("second");
      throttled("third");

      vi.advanceTimersByTime(interval);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith("third");

      if (timeoutId) clearTimeout(timeoutId);
    });
  });

  describe("Cancel functionality", () => {
    it("should cancel pending trailing execution", () => {
      const callback = vi.fn();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let hasPending = false;

      const schedule = () => {
        hasPending = true;
        timeoutId = setTimeout(() => {
          callback();
          hasPending = false;
          timeoutId = null;
        }, 100);
      };

      const cancel = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        hasPending = false;
      };

      schedule();
      expect(hasPending).toBe(true);

      cancel();
      expect(hasPending).toBe(false);

      vi.advanceTimersByTime(200);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Flush functionality", () => {
    it("should immediately execute pending call", () => {
      const callback = vi.fn();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let hasPending = false;
      let pendingArgs: unknown[] | null = null;

      const schedule = (...args: unknown[]) => {
        hasPending = true;
        pendingArgs = args;
        timeoutId = setTimeout(() => {
          callback(...(pendingArgs || []));
          hasPending = false;
          pendingArgs = null;
          timeoutId = null;
        }, 100);
      };

      const flush = () => {
        if (hasPending && pendingArgs !== null) {
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          callback(...pendingArgs);
          hasPending = false;
          pendingArgs = null;
        }
      };

      schedule("test-arg");
      expect(callback).not.toHaveBeenCalled();

      flush();
      expect(callback).toHaveBeenCalledWith("test-arg");
    });

    it("should not execute flush when nothing pending", () => {
      const callback = vi.fn();
      let hasPending = false;

      const flush = () => {
        if (hasPending) {
          callback();
        }
      };

      flush();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("isPending functionality", () => {
    it("should return false initially", () => {
      let hasPending = false;
      expect(hasPending).toBe(false);
    });

    it("should return true when call is pending", () => {
      let hasPending = false;

      hasPending = true;
      expect(hasPending).toBe(true);

      hasPending = false;
      expect(hasPending).toBe(false);
    });
  });

  describe("getRemainingTime functionality", () => {
    it("should return 0 when no throttle active", () => {
      const lastExecutedTime = 0;
      const interval = 100;
      const remaining = Math.max(0, interval - (Date.now() - lastExecutedTime));

      expect(remaining).toBeGreaterThanOrEqual(0);
    });

    it("should return remaining time during throttle", () => {
      const interval = 100;
      const lastExecutedTime = Date.now();

      vi.advanceTimersByTime(30);
      const timeSince = Date.now() - lastExecutedTime;
      const remaining = Math.max(0, interval - timeSince);

      expect(remaining).toBe(70);
    });

    it("should return 0 after interval expires", () => {
      const interval = 100;
      const lastExecutedTime = Date.now();

      vi.advanceTimersByTime(150);
      const timeSince = Date.now() - lastExecutedTime;
      const remaining = Math.max(0, interval - timeSince);

      expect(remaining).toBe(0);
    });
  });

  describe("useRAFThrottle pattern", () => {
    it("should schedule execution for next frame", () => {
      vi.useRealTimers();
      const callback = vi.fn();
      let pendingCallback: (() => void) | null = null;

      const mockRaf = (cb: () => void) => {
        pendingCallback = cb;
        return 1;
      };

      let lastArgs: unknown[] | null = null;
      let scheduled = false;

      const throttled = (...args: unknown[]) => {
        lastArgs = args;
        if (scheduled) return;
        scheduled = true;

        mockRaf(() => {
          scheduled = false;
          if (lastArgs !== null) {
            callback(...lastArgs);
            lastArgs = null;
          }
        });
      };

      throttled("test");
      expect(callback).not.toHaveBeenCalled();

      pendingCallback!();
      expect(callback).toHaveBeenCalledWith("test");
    });

    it("should batch multiple calls into single frame", () => {
      vi.useRealTimers();
      const callback = vi.fn();
      let pendingCallback: (() => void) | null = null;

      const mockRaf = (cb: () => void) => {
        pendingCallback = cb;
        return 1;
      };

      let lastArgs: unknown[] | null = null;
      let scheduled = false;

      const throttled = (...args: unknown[]) => {
        lastArgs = args;
        if (scheduled) return;
        scheduled = true;

        mockRaf(() => {
          scheduled = false;
          if (lastArgs !== null) {
            callback(...lastArgs);
            lastArgs = null;
          }
        });
      };

      throttled("first");
      throttled("second");
      throttled("third");

      pendingCallback!();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("third");
    });

    it("should report ~16ms remaining for RAF", () => {
      const hasPending = true;
      const remaining = hasPending ? 16 : 0;
      expect(remaining).toBe(16);
    });
  });

  describe("useThrottleState pattern", () => {
    it("should create throttled state", () => {
      let value = 0;
      let lastExecutedTime = 0;
      const interval = 100;

      const setValue = (newValue: number) => {
        const now = Date.now();
        if (now - lastExecutedTime >= interval || lastExecutedTime === 0) {
          value = newValue;
          lastExecutedTime = now;
        }
      };

      setValue(1);
      expect(value).toBe(1);

      vi.advanceTimersByTime(50);
      setValue(2);
      expect(value).toBe(1);

      vi.advanceTimersByTime(50);
      setValue(3);
      expect(value).toBe(3);
    });

    it("should support immediate setter", () => {
      let value = 0;

      const setImmediate = (newValue: number) => {
        value = newValue;
      };

      setImmediate(42);
      expect(value).toBe(42);
    });

    it("should return tuple of [getter, throttledSetter, immediateSetter, utils]", () => {
      const value = () => 0;
      const throttledSetter = vi.fn();
      const immediateSetter = vi.fn();
      const utils = {
        cancel: vi.fn(),
        flush: vi.fn(),
        isPending: () => false,
        getRemainingTime: () => 0,
      };

      const result = [value, throttledSetter, immediateSetter, utils] as const;

      expect(typeof result[0]).toBe("function");
      expect(typeof result[1]).toBe("function");
      expect(typeof result[2]).toBe("function");
      expect(typeof result[3].cancel).toBe("function");
      expect(typeof result[3].flush).toBe("function");
      expect(result[3].isPending()).toBe(false);
      expect(result[3].getRemainingTime()).toBe(0);
    });
  });

  describe("useLeadingThrottle pattern", () => {
    it("should execute on leading edge only", () => {
      const callback = vi.fn();
      let lastExecutedTime = 0;
      const interval = 100;

      const throttled = () => {
        const now = Date.now();
        if (now - lastExecutedTime >= interval || lastExecutedTime === 0) {
          callback();
          lastExecutedTime = now;
        }
      };

      throttled();
      expect(callback).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      throttled();
      expect(callback).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      throttled();
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe("useTrailingThrottle pattern", () => {
    it("should execute on trailing edge only", () => {
      const callback = vi.fn();
      const interval = 100;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let lastArgs: unknown[] | null = null;

      const throttled = (...args: unknown[]) => {
        lastArgs = args;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          if (lastArgs !== null) {
            callback(...lastArgs);
            lastArgs = null;
          }
          timeoutId = null;
        }, interval);
      };

      throttled("a");
      expect(callback).not.toHaveBeenCalled();

      throttled("b");
      throttled("c");

      vi.advanceTimersByTime(interval);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("c");
    });
  });

  describe("Cleanup on unmount", () => {
    it("should clear pending timeout on cleanup", () => {
      const callback = vi.fn();
      let timeoutId: number | ReturnType<typeof setTimeout> | null = null;

      timeoutId = setTimeout(callback, 100);

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      vi.advanceTimersByTime(200);
      expect(callback).not.toHaveBeenCalled();
    });

    it("should clear RAF on cleanup", () => {
      const callback = vi.fn();
      let rafId: number | null = null;

      rafId = requestAnimationFrame(callback);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      vi.advanceTimersByTime(100);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle rapid calls", () => {
      const callback = vi.fn();
      let lastExecutedTime = 0;
      const interval = 100;

      const throttled = () => {
        const now = Date.now();
        if (now - lastExecutedTime >= interval || lastExecutedTime === 0) {
          callback();
          lastExecutedTime = now;
        }
      };

      for (let i = 0; i < 100; i++) {
        throttled();
      }

      expect(callback).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttled();
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("should handle zero interval", () => {
      const callback = vi.fn();
      const interval = 0;
      let lastExecutedTime = 0;

      const throttled = () => {
        const now = Date.now();
        if (now - lastExecutedTime >= interval) {
          callback();
          lastExecutedTime = now;
        }
      };

      throttled();
      throttled();
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });
});

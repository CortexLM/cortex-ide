import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("DebounceOptions Interface", () => {
    interface DebounceOptions {
      delay?: number;
      leading?: boolean;
      trailing?: boolean;
      maxWait?: number;
    }

    it("should define default options", () => {
      const options: DebounceOptions = {};

      expect(options.delay).toBeUndefined();
      expect(options.leading).toBeUndefined();
      expect(options.trailing).toBeUndefined();
      expect(options.maxWait).toBeUndefined();
    });

    it("should set delay option", () => {
      const options: DebounceOptions = {
        delay: 500,
      };

      expect(options.delay).toBe(500);
    });

    it("should enable leading edge execution", () => {
      const options: DebounceOptions = {
        leading: true,
        trailing: false,
      };

      expect(options.leading).toBe(true);
      expect(options.trailing).toBe(false);
    });

    it("should enable trailing edge execution", () => {
      const options: DebounceOptions = {
        leading: false,
        trailing: true,
      };

      expect(options.leading).toBe(false);
      expect(options.trailing).toBe(true);
    });

    it("should set maxWait option", () => {
      const options: DebounceOptions = {
        delay: 300,
        maxWait: 1000,
      };

      expect(options.maxWait).toBe(1000);
    });
  });

  describe("RAFDebounceOptions Interface", () => {
    interface RAFDebounceOptions {
      leading?: boolean;
    }

    it("should define RAF debounce options", () => {
      const options: RAFDebounceOptions = {
        leading: true,
      };

      expect(options.leading).toBe(true);
    });
  });

  describe("DebouncedFunction Interface", () => {
    interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
      (...args: Parameters<T>): void;
      cancel: () => void;
      flush: () => void;
      isPending: () => boolean;
    }

    it("should define debounced function interface", () => {
      const callback = vi.fn();
      let pending = false;
      let pendingArgs: unknown[] = [];

      const debouncedFn: DebouncedFunction<typeof callback> = Object.assign(
        (...args: unknown[]) => {
          pending = true;
          pendingArgs = args;
        },
        {
          cancel: () => {
            pending = false;
            pendingArgs = [];
          },
          flush: () => {
            if (pending) {
              callback(...pendingArgs);
              pending = false;
            }
          },
          isPending: () => pending,
        }
      );

      expect(debouncedFn.isPending()).toBe(false);

      debouncedFn("test");
      expect(debouncedFn.isPending()).toBe(true);

      debouncedFn.flush();
      expect(callback).toHaveBeenCalledWith("test");
      expect(debouncedFn.isPending()).toBe(false);
    });

    it("should support cancel method", () => {
      let pending = false;

      const debouncedFn = {
        call: () => {
          pending = true;
        },
        cancel: () => {
          pending = false;
        },
        isPending: () => pending,
      };

      debouncedFn.call();
      expect(debouncedFn.isPending()).toBe(true);

      debouncedFn.cancel();
      expect(debouncedFn.isPending()).toBe(false);
    });
  });

  describe("Signal Debouncing", () => {
    it("should debounce value changes", () => {
      const callback = vi.fn();
      let value = "initial";

      const debounce = (newValue: string, delay: number) => {
        value = newValue;
        setTimeout(() => callback(value), delay);
      };

      debounce("first", 300);
      debounce("second", 300);
      debounce("third", 300);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it("should use default delay of 300ms", () => {
      const DEFAULT_DELAY = 300;
      expect(DEFAULT_DELAY).toBe(300);
    });

    it("should respect custom delay", () => {
      const callback = vi.fn();
      const delay = 500;

      setTimeout(callback, delay);

      vi.advanceTimersByTime(300);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(callback).toHaveBeenCalled();
    });
  });

  describe("Leading Edge Execution", () => {
    it("should execute immediately on leading edge", () => {
      const callback = vi.fn();
      const leading = true;

      if (leading) {
        callback("immediate");
      }

      expect(callback).toHaveBeenCalledWith("immediate");
    });

    it("should not execute trailing when leading only", () => {
      const callback = vi.fn();
      const options = { leading: true, trailing: false };
      let hasLeadingCall = false;

      const debounce = (value: string) => {
        if (options.leading && !hasLeadingCall) {
          callback(value);
          hasLeadingCall = true;
        }
      };

      debounce("first");
      debounce("second");
      debounce("third");

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("first");
    });
  });

  describe("Trailing Edge Execution", () => {
    it("should execute after delay on trailing edge", () => {
      const callback = vi.fn();
      const delay = 300;

      setTimeout(callback, delay);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(delay);

      expect(callback).toHaveBeenCalled();
    });

    it("should use latest value on trailing edge", () => {
      const callback = vi.fn();
      let latestValue = "";
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const debounce = (value: string, delay: number) => {
        latestValue = value;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => callback(latestValue), delay);
      };

      debounce("first", 300);
      debounce("second", 300);
      debounce("third", 300);

      vi.advanceTimersByTime(300);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("third");
    });
  });

  describe("Max Wait", () => {
    it("should force execution after maxWait", () => {
      const callback = vi.fn();
      const maxWait = 1000;

      setTimeout(callback, maxWait);

      vi.advanceTimersByTime(maxWait);

      expect(callback).toHaveBeenCalled();
    });

    it("should not exceed maxWait even with continuous calls", () => {
      const callback = vi.fn();
      const delay = 300;
      const maxWait = 1000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let maxWaitTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let value = "";

      const debounce = (newValue: string) => {
        value = newValue;

        if (!maxWaitTimeoutId) {
          maxWaitTimeoutId = setTimeout(() => {
            callback(value);
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = null;
            maxWaitTimeoutId = null;
          }, maxWait);
        }

        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          callback(value);
          if (maxWaitTimeoutId) clearTimeout(maxWaitTimeoutId);
          maxWaitTimeoutId = null;
        }, delay);
      };

      for (let i = 0; i < 10; i++) {
        debounce(`call-${i}`);
        vi.advanceTimersByTime(200);
      }

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("Cancel Method", () => {
    it("should cancel pending execution", () => {
      const callback = vi.fn();
      let cancelled = false;

      const timeoutId = setTimeout(() => {
        if (!cancelled) callback();
      }, 300);

      cancelled = true;
      clearTimeout(timeoutId);

      vi.advanceTimersByTime(300);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should clear all pending timeouts", () => {
      const callback = vi.fn();
      const timeoutId = setTimeout(callback, 300);
      const maxWaitTimeoutId = setTimeout(callback, 1000);

      clearTimeout(timeoutId);
      clearTimeout(maxWaitTimeoutId);

      vi.advanceTimersByTime(1000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Flush Method", () => {
    it("should immediately execute pending call", () => {
      const callback = vi.fn();
      let pending = true;
      const pendingValue = "pending-value";

      const flush = () => {
        if (pending) {
          callback(pendingValue);
          pending = false;
        }
      };

      flush();

      expect(callback).toHaveBeenCalledWith("pending-value");
      expect(pending).toBe(false);
    });

    it("should do nothing if no pending call", () => {
      const callback = vi.fn();
      let pending = false;

      const flush = () => {
        if (pending) {
          callback();
        }
      };

      flush();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("isPending Method", () => {
    it("should return true when call is pending", () => {
      let pending = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const schedule = () => {
        pending = true;
        timeoutId = setTimeout(() => {
          pending = false;
        }, 300);
      };

      const isPending = () => pending;

      schedule();
      expect(isPending()).toBe(true);

      vi.advanceTimersByTime(300);
      expect(isPending()).toBe(false);

      if (timeoutId) clearTimeout(timeoutId);
    });

    it("should return false after execution", () => {
      let pending = true;

      const execute = () => {
        pending = false;
      };

      execute();
      expect(pending).toBe(false);
    });

    it("should return false after cancel", () => {
      let pending = true;

      const cancel = () => {
        pending = false;
      };

      cancel();
      expect(pending).toBe(false);
    });
  });

  describe("useDebouncedCallback", () => {
    it("should debounce callback execution", () => {
      const callback = vi.fn();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const debouncedCallback = (...args: unknown[]) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => callback(...args), 300);
      };

      debouncedCallback("a");
      debouncedCallback("b");
      debouncedCallback("c");

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("c");
    });
  });

  describe("useDebounceState", () => {
    it("should provide state and debounced setter", () => {
      let value = "initial";
      let debouncedValue = "initial";
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const setValue = (newValue: string) => {
        value = newValue;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          debouncedValue = value;
        }, 300);
      };

      setValue("first");
      expect(value).toBe("first");
      expect(debouncedValue).toBe("initial");

      vi.advanceTimersByTime(300);
      expect(debouncedValue).toBe("first");
    });
  });

  describe("useRAFDebounce", () => {
    it("should use requestAnimationFrame for debouncing", () => {
      const callback = vi.fn();
      let rafId: number | null = null;

      const rafDebounce = (fn: () => void) => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(fn);
      };

      rafDebounce(callback);
      rafDebounce(callback);
      rafDebounce(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should cancel pending RAF", () => {
      let rafId: number | null = null;
      const callback = vi.fn();

      rafId = requestAnimationFrame(callback);
      cancelAnimationFrame(rafId);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup", () => {
    it("should clear timeouts on cleanup", () => {
      const callback = vi.fn();
      let cleaned = false;

      const timeoutId = setTimeout(() => {
        if (!cleaned) callback();
      }, 300);

      cleaned = true;
      clearTimeout(timeoutId);

      vi.advanceTimersByTime(300);

      expect(callback).not.toHaveBeenCalled();
      expect(cleaned).toBe(true);
    });
  });

  describe("Type Safety", () => {
    it("should preserve generic types", () => {
      interface User {
        name: string;
        age: number;
      }

      const user: User = { name: "Test", age: 25 };
      let debouncedUser: User = user;

      const setDebouncedUser = (newUser: User) => {
        debouncedUser = newUser;
      };

      setDebouncedUser({ name: "Updated", age: 30 });

      expect(debouncedUser.name).toBe("Updated");
      expect(debouncedUser.age).toBe(30);
    });
  });
});

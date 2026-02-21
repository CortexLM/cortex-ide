import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  throttle,
  debounce,
  debounceAsync,
  sequentialize,
  memoize,
  memoizeWithKey,
  once,
  withTimeout,
} from "../decorators";

describe("decorators", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("throttle", () => {
    it("executes immediately on first call", async () => {
      const fn = vi.fn().mockResolvedValue("result");
      const throttled = throttle(fn);
      const result = await throttled();
      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("queues subsequent calls during execution", async () => {
      let resolve1: (v: string) => void;
      const p1 = new Promise<string>((r) => { resolve1 = r; });
      const fn = vi.fn()
        .mockReturnValueOnce(p1)
        .mockResolvedValueOnce("second");
      const throttled = throttle(fn);

      const r1 = throttled();
      const r2 = throttled("arg2");

      resolve1!("first");
      await vi.runAllTimersAsync();

      expect(await r1).toBe("first");
      expect(await r2).toBe("second");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("debounce", () => {
    it("delays execution", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced("a");
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith("a");
    });

    it("resets timer on subsequent calls", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced("a");
      vi.advanceTimersByTime(50);
      debounced("b");
      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledWith("b");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("cancel prevents execution", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();
      vi.advanceTimersByTime(200);
      expect(fn).not.toHaveBeenCalled();
    });

    it("flush executes immediately", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced("a");
      debounced.flush();
      expect(fn).toHaveBeenCalledWith("a");
    });
  });

  describe("debounceAsync", () => {
    it("returns promise that resolves after delay", async () => {
      const fn = vi.fn().mockResolvedValue("result");
      const debounced = debounceAsync(fn, 100);

      const promise = debounced();
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(await promise).toBe("result");
    });

    it("cancel rejects pending promise", async () => {
      const fn = vi.fn().mockResolvedValue("result");
      const debounced = debounceAsync(fn, 100);

      const promise = debounced();
      debounced.cancel();

      await expect(promise).rejects.toThrow("cancelled");
    });
  });

  describe("sequentialize", () => {
    it("runs operations sequentially", async () => {
      const order: number[] = [];
      const fn = vi.fn().mockImplementation(async (n: number) => {
        order.push(n);
        return n;
      });
      const seq = sequentialize(fn);

      const p1 = seq(1);
      const p2 = seq(2);

      await Promise.all([p1, p2]);
      expect(order).toEqual([1, 2]);
    });
  });

  describe("memoize", () => {
    it("caches first result", () => {
      let counter = 0;
      const fn = () => ++counter;
      const memoized = memoize(fn);

      expect(memoized()).toBe(1);
      expect(memoized()).toBe(1);
      expect(counter).toBe(1);
    });
  });

  describe("memoizeWithKey", () => {
    it("caches per key", () => {
      let counter = 0;
      const fn = (x: number) => x + ++counter;
      const memoized = memoizeWithKey(fn, (x: number) => String(x));

      expect(memoized(1)).toBe(2);
      expect(memoized(1)).toBe(2);
      expect(memoized(2)).toBe(4);
      expect(counter).toBe(2);
    });

    it("clear removes all cache", () => {
      const fn = vi.fn((x: number) => x * 2);
      const memoized = memoizeWithKey(fn, (x: number) => String(x));

      memoized(1);
      memoized.clear();
      memoized(1);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("clearKey removes specific key", () => {
      const fn = vi.fn((x: number) => x * 2);
      const memoized = memoizeWithKey(fn, (x: number) => String(x));

      memoized(1);
      memoized(2);
      memoized.clearKey("1");
      memoized(1);
      memoized(2);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("once", () => {
    it("calls function only once", () => {
      let counter = 0;
      const fn = () => ++counter;
      const onceFn = once(fn);

      expect(onceFn()).toBe(1);
      expect(onceFn()).toBe(1);
      expect(counter).toBe(1);
    });
  });

  describe("withTimeout", () => {
    it("resolves if within timeout", async () => {
      const promise = Promise.resolve("ok");
      const result = await withTimeout(promise, 1000);
      expect(result).toBe("ok");
    });

    it("rejects on timeout", async () => {
      vi.useRealTimers();
      const promise = new Promise((resolve) => setTimeout(resolve, 5000));
      await expect(withTimeout(promise, 10, "Too slow")).rejects.toThrow("Too slow");
    });
  });
});

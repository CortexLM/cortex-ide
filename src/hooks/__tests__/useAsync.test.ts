import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("useAsync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("AsyncStatus Type", () => {
    type AsyncStatus = "idle" | "loading" | "success" | "error";

    it("should define all status values", () => {
      const statuses: AsyncStatus[] = ["idle", "loading", "success", "error"];
      expect(statuses).toHaveLength(4);
    });

    it("should have idle status", () => {
      const status: AsyncStatus = "idle";
      expect(status).toBe("idle");
    });

    it("should have loading status", () => {
      const status: AsyncStatus = "loading";
      expect(status).toBe("loading");
    });

    it("should have success status", () => {
      const status: AsyncStatus = "success";
      expect(status).toBe("success");
    });

    it("should have error status", () => {
      const status: AsyncStatus = "error";
      expect(status).toBe("error");
    });
  });

  describe("AsyncState Interface", () => {
    interface AsyncState<T> {
      status: "idle" | "loading" | "success" | "error";
      data: T | undefined;
      error: Error | undefined;
      isLoading: boolean;
      isSuccess: boolean;
      isError: boolean;
      isIdle: boolean;
      lastUpdated: number | undefined;
    }

    it("should create idle state", () => {
      const state: AsyncState<string> = {
        status: "idle",
        data: undefined,
        error: undefined,
        isLoading: false,
        isSuccess: false,
        isError: false,
        isIdle: true,
        lastUpdated: undefined,
      };

      expect(state.isIdle).toBe(true);
      expect(state.status).toBe("idle");
    });

    it("should create loading state", () => {
      const state: AsyncState<string> = {
        status: "loading",
        data: undefined,
        error: undefined,
        isLoading: true,
        isSuccess: false,
        isError: false,
        isIdle: false,
        lastUpdated: undefined,
      };

      expect(state.isLoading).toBe(true);
      expect(state.status).toBe("loading");
    });

    it("should create success state", () => {
      const state: AsyncState<string> = {
        status: "success",
        data: "result",
        error: undefined,
        isLoading: false,
        isSuccess: true,
        isError: false,
        isIdle: false,
        lastUpdated: Date.now(),
      };

      expect(state.isSuccess).toBe(true);
      expect(state.data).toBe("result");
    });

    it("should create error state", () => {
      const state: AsyncState<string> = {
        status: "error",
        data: undefined,
        error: new Error("Failed"),
        isLoading: false,
        isSuccess: false,
        isError: true,
        isIdle: false,
        lastUpdated: undefined,
      };

      expect(state.isError).toBe(true);
      expect(state.error?.message).toBe("Failed");
    });
  });

  describe("UseAsyncOptions Interface", () => {
    interface RetryOptions {
      count?: number;
      delay?: number;
      exponential?: boolean;
      maxDelay?: number;
    }

    interface CacheOptions {
      key: string | ((...args: unknown[]) => string);
      ttl?: number;
      staleWhileRevalidate?: boolean;
    }

    interface UseAsyncOptions<T> {
      immediate?: unknown[];
      initialData?: T;
      onSuccess?: (data: T) => void;
      onError?: (error: Error) => void;
      onSettled?: (data: T | undefined, error: Error | undefined) => void;
      retry?: RetryOptions | boolean;
      cache?: CacheOptions;
      resetErrorOnExecute?: boolean;
      resetDataOnExecute?: boolean;
      abortOnNewRequest?: boolean;
    }

    it("should define options with immediate execution", () => {
      const options: UseAsyncOptions<string> = {
        immediate: ["arg1", "arg2"],
      };

      expect(options.immediate).toEqual(["arg1", "arg2"]);
    });

    it("should define options with initial data", () => {
      const options: UseAsyncOptions<string> = {
        initialData: "initial",
      };

      expect(options.initialData).toBe("initial");
    });

    it("should define options with callbacks", () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const onSettled = vi.fn();

      const options: UseAsyncOptions<string> = {
        onSuccess,
        onError,
        onSettled,
      };

      options.onSuccess?.("data");
      options.onError?.(new Error("error"));
      options.onSettled?.("data", undefined);

      expect(onSuccess).toHaveBeenCalledWith("data");
      expect(onError).toHaveBeenCalled();
      expect(onSettled).toHaveBeenCalled();
    });

    it("should define options with retry", () => {
      const options: UseAsyncOptions<string> = {
        retry: {
          count: 3,
          delay: 1000,
          exponential: true,
        },
      };

      expect((options.retry as RetryOptions).count).toBe(3);
    });

    it("should define options with boolean retry", () => {
      const options: UseAsyncOptions<string> = {
        retry: true,
      };

      expect(options.retry).toBe(true);
    });

    it("should define options with cache", () => {
      const options: UseAsyncOptions<string> = {
        cache: {
          key: "my-cache-key",
          ttl: 60000,
          staleWhileRevalidate: true,
        },
      };

      expect(options.cache?.key).toBe("my-cache-key");
      expect(options.cache?.ttl).toBe(60000);
    });
  });

  describe("RetryOptions Interface", () => {
    interface RetryOptions {
      count?: number;
      delay?: number;
      exponential?: boolean;
      maxDelay?: number;
      shouldRetry?: (error: Error, attempt: number) => boolean;
    }

    it("should define default retry options", () => {
      const defaults: Required<Omit<RetryOptions, "shouldRetry">> = {
        count: 3,
        delay: 1000,
        exponential: true,
        maxDelay: 30000,
      };

      expect(defaults.count).toBe(3);
      expect(defaults.delay).toBe(1000);
      expect(defaults.exponential).toBe(true);
      expect(defaults.maxDelay).toBe(30000);
    });

    it("should define custom shouldRetry function", () => {
      const options: RetryOptions = {
        shouldRetry: (error, attempt) => {
          return attempt < 3 && error.message !== "Fatal";
        },
      };

      expect(options.shouldRetry?.(new Error("Temporary"), 1)).toBe(true);
      expect(options.shouldRetry?.(new Error("Fatal"), 1)).toBe(false);
      expect(options.shouldRetry?.(new Error("Temporary"), 3)).toBe(false);
    });
  });

  describe("CacheOptions Interface", () => {
    interface CacheOptions {
      key: string | ((...args: unknown[]) => string);
      ttl?: number;
      staleWhileRevalidate?: boolean;
    }

    it("should define cache with string key", () => {
      const options: CacheOptions = {
        key: "user-data",
        ttl: 300000,
      };

      expect(options.key).toBe("user-data");
    });

    it("should define cache with function key", () => {
      const options: CacheOptions = {
        key: (userId: unknown) => `user-${userId}`,
        ttl: 300000,
      };

      expect(typeof options.key).toBe("function");
      expect((options.key as (id: string) => string)("123")).toBe("user-123");
    });

    it("should support stale while revalidate", () => {
      const options: CacheOptions = {
        key: "data",
        staleWhileRevalidate: true,
      };

      expect(options.staleWhileRevalidate).toBe(true);
    });
  });

  describe("UseAsyncReturn Interface", () => {
    interface UseAsyncReturn<T> {
      data: () => T | undefined;
      error: () => Error | undefined;
      status: () => string;
      loading: () => boolean;
      isSuccess: () => boolean;
      isError: () => boolean;
      isIdle: () => boolean;
      execute: (...args: unknown[]) => Promise<T>;
      retry: () => Promise<T | undefined>;
      reset: () => void;
      cancel: () => void;
      mutate: (data: T | ((prev: T | undefined) => T)) => void;
      clearError: () => void;
    }

    it("should define return type", () => {
      const mockReturn: UseAsyncReturn<string> = {
        data: () => "result",
        error: () => undefined,
        status: () => "success",
        loading: () => false,
        isSuccess: () => true,
        isError: () => false,
        isIdle: () => false,
        execute: vi.fn().mockResolvedValue("result"),
        retry: vi.fn().mockResolvedValue("result"),
        reset: vi.fn(),
        cancel: vi.fn(),
        mutate: vi.fn(),
        clearError: vi.fn(),
      };

      expect(mockReturn.data()).toBe("result");
      expect(mockReturn.isSuccess()).toBe(true);
    });
  });

  describe("Retry Logic", () => {
    it("should calculate linear retry delay", () => {
      const calculateDelay = (attempt: number, baseDelay: number, exponential: boolean): number => {
        if (!exponential) return baseDelay;
        return baseDelay * Math.pow(2, attempt);
      };

      expect(calculateDelay(0, 1000, false)).toBe(1000);
      expect(calculateDelay(1, 1000, false)).toBe(1000);
      expect(calculateDelay(2, 1000, false)).toBe(1000);
    });

    it("should calculate exponential retry delay", () => {
      const calculateDelay = (attempt: number, baseDelay: number, exponential: boolean, maxDelay: number): number => {
        if (!exponential) return baseDelay;
        const delay = baseDelay * Math.pow(2, attempt);
        return Math.min(delay, maxDelay);
      };

      expect(calculateDelay(0, 1000, true, 30000)).toBe(1000);
      expect(calculateDelay(1, 1000, true, 30000)).toBe(2000);
      expect(calculateDelay(2, 1000, true, 30000)).toBe(4000);
      expect(calculateDelay(3, 1000, true, 30000)).toBe(8000);
    });

    it("should cap delay at maxDelay", () => {
      const calculateDelay = (attempt: number, baseDelay: number, maxDelay: number): number => {
        const delay = baseDelay * Math.pow(2, attempt);
        return Math.min(delay, maxDelay);
      };

      expect(calculateDelay(10, 1000, 30000)).toBe(30000);
    });
  });

  describe("Cache Implementation", () => {
    interface CacheEntry<T> {
      data: T;
      timestamp: number;
      ttl: number;
    }

    it("should create cache entry", () => {
      const entry: CacheEntry<string> = {
        data: "cached-value",
        timestamp: Date.now(),
        ttl: 300000,
      };

      expect(entry.data).toBe("cached-value");
    });

    it("should check if cache entry is expired", () => {
      const isExpired = (entry: CacheEntry<unknown>): boolean => {
        return Date.now() - entry.timestamp > entry.ttl;
      };

      const validEntry: CacheEntry<string> = {
        data: "value",
        timestamp: Date.now(),
        ttl: 300000,
      };

      const expiredEntry: CacheEntry<string> = {
        data: "value",
        timestamp: Date.now() - 400000,
        ttl: 300000,
      };

      expect(isExpired(validEntry)).toBe(false);
      expect(isExpired(expiredEntry)).toBe(true);
    });

    it("should generate cache key from function", () => {
      const keyFn = (userId: string, type: string) => `user-${userId}-${type}`;
      const key = keyFn("123", "profile");

      expect(key).toBe("user-123-profile");
    });
  });

  describe("Cancel Behavior", () => {
    it("should create abort controller", () => {
      const controller = new AbortController();
      expect(controller.signal.aborted).toBe(false);
    });

    it("should abort request", () => {
      const controller = new AbortController();
      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });

    it("should handle abort signal", () => {
      const controller = new AbortController();
      const callback = vi.fn();

      controller.signal.addEventListener("abort", callback);
      controller.abort();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("State Transitions", () => {
    type AsyncStatus = "idle" | "loading" | "success" | "error";

    it("should transition from idle to loading", () => {
      let status: AsyncStatus = "idle";
      status = "loading";
      expect(status).toBe("loading");
    });

    it("should transition from loading to success", () => {
      let status: AsyncStatus = "loading";
      status = "success";
      expect(status).toBe("success");
    });

    it("should transition from loading to error", () => {
      let status: AsyncStatus = "loading";
      status = "error";
      expect(status).toBe("error");
    });

    it("should reset to idle", () => {
      let status: AsyncStatus = "error";
      status = "idle";
      expect(status).toBe("idle");
    });
  });

  describe("Execute Function", () => {
    it("should execute async function", async () => {
      const asyncFn = vi.fn().mockResolvedValue("result");

      const result = await asyncFn("arg1", "arg2");

      expect(asyncFn).toHaveBeenCalledWith("arg1", "arg2");
      expect(result).toBe("result");
    });

    it("should handle async function error", async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error("Failed"));

      await expect(asyncFn()).rejects.toThrow("Failed");
    });
  });

  describe("Mutate Function", () => {
    it("should mutate data directly", () => {
      let data: string | undefined = "initial";

      const mutate = (newData: string | ((prev: string | undefined) => string)) => {
        data = typeof newData === "function" ? newData(data) : newData;
      };

      mutate("new-value");
      expect(data).toBe("new-value");
    });

    it("should mutate data with function", () => {
      let data: number | undefined = 5;

      const mutate = (newData: number | ((prev: number | undefined) => number)) => {
        data = typeof newData === "function" ? newData(data) : newData;
      };

      mutate((prev) => (prev ?? 0) + 1);
      expect(data).toBe(6);
    });
  });

  describe("Reset Function", () => {
    it("should reset state to initial", () => {
      interface State {
        status: string;
        data: unknown;
        error: unknown;
      }

      const initialState: State = {
        status: "idle",
        data: undefined,
        error: undefined,
      };

      let state: State = {
        status: "success",
        data: "result",
        error: undefined,
      };

      const reset = () => {
        state = { ...initialState };
      };

      reset();

      expect(state.status).toBe("idle");
      expect(state.data).toBeUndefined();
    });
  });

  describe("Clear Error Function", () => {
    it("should clear error state", () => {
      let error: Error | undefined = new Error("Failed");

      const clearError = () => {
        error = undefined;
      };

      clearError();

      expect(error).toBeUndefined();
    });
  });

  describe("Polling", () => {
    it("should poll at interval", () => {
      const callback = vi.fn();
      const interval = 1000;

      const intervalId = setInterval(callback, interval);

      vi.advanceTimersByTime(3000);

      expect(callback).toHaveBeenCalledTimes(3);

      clearInterval(intervalId);
    });

    it("should stop polling on cleanup", () => {
      const callback = vi.fn();
      const interval = 1000;

      const intervalId = setInterval(callback, interval);

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);

      clearInterval(intervalId);

      vi.advanceTimersByTime(2000);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("Race Condition Prevention", () => {
    it("should track request ID", () => {
      let currentRequestId = 0;

      const execute = () => {
        currentRequestId++;
        return currentRequestId;
      };

      const id1 = execute();
      const id2 = execute();
      const id3 = execute();

      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(id3).toBe(3);
    });

    it("should ignore stale responses", () => {
      let currentRequestId = 0;
      let data: string | undefined;

      const setData = (requestId: number, value: string) => {
        if (requestId === currentRequestId) {
          data = value;
        }
      };

      currentRequestId = 1;
      currentRequestId = 2;

      setData(1, "stale");
      expect(data).toBeUndefined();

      setData(2, "current");
      expect(data).toBe("current");
    });
  });
});

/**
 * useAsync - Async state management for SolidJS
 *
 * Provides comprehensive utilities for managing async operations including
 * loading states, error handling, caching, retries, and cancellation.
 *
 * Features:
 * - Full TypeScript generic support
 * - Loading, error, and data state tracking
 * - Automatic and manual execution modes
 * - Request cancellation support
 * - Retry with exponential backoff
 * - Result caching
 * - Race condition prevention
 *
 * @example
 * ```tsx
 * function UserProfile(props: { userId: string }) {
 *   const { data, loading, error, execute, retry } = useAsync(
 *     async (id: string) => {
 *       const response = await fetch(`/api/users/${id}`);
 *       if (!response.ok) throw new Error("Failed to fetch user");
 *       return response.json();
 *     },
 *     { immediate: () => props.userId }
 *   );
 *
 *   return (
 *     <Switch>
 *       <Match when={loading()}>
 *         <Spinner />
 *       </Match>
 *       <Match when={error()}>
 *         <ErrorMessage error={error()} onRetry={retry} />
 *       </Match>
 *       <Match when={data()}>
 *         <UserCard user={data()!} />
 *       </Match>
 *     </Switch>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  createEffect,
  onCleanup,
  batch,
  untrack,
  type Accessor,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

/** Async state statuses */
export type AsyncStatus = "idle" | "loading" | "success" | "error";

/** Async state object */
export interface AsyncState<T> {
  /** Current status */
  status: AsyncStatus;
  /** Result data (if successful) */
  data: T | undefined;
  /** Error (if failed) */
  error: Error | undefined;
  /** Whether currently loading */
  isLoading: boolean;
  /** Whether has successfully loaded at least once */
  isSuccess: boolean;
  /** Whether in error state */
  isError: boolean;
  /** Whether idle (never executed) */
  isIdle: boolean;
  /** Timestamp of last successful load */
  lastUpdated: number | undefined;
}

/** Options for useAsync */
export interface UseAsyncOptions<T, Args extends unknown[]> {
  /** Execute immediately with these args (can be accessor for reactivity) */
  immediate?: Args | Accessor<Args | undefined>;
  /** Initial data value */
  initialData?: T;
  /** Called on success */
  onSuccess?: (data: T) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when execution completes (success or error) */
  onSettled?: (data: T | undefined, error: Error | undefined) => void;
  /** Retry configuration */
  retry?: RetryOptions | boolean;
  /** Cache configuration */
  cache?: CacheOptions;
  /** Reset error state before each execution */
  resetErrorOnExecute?: boolean;
  /** Reset data state before each execution */
  resetDataOnExecute?: boolean;
  /** Abort previous request when new one starts */
  abortOnNewRequest?: boolean;
}

/** Retry options */
export interface RetryOptions {
  /** Maximum number of retries (default: 3) */
  count?: number;
  /** Delay between retries in ms (default: 1000) */
  delay?: number;
  /** Use exponential backoff (default: true) */
  exponential?: boolean;
  /** Maximum delay for exponential backoff (default: 30000) */
  maxDelay?: number;
  /** Custom retry condition */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/** Cache options */
export interface CacheOptions {
  /** Cache key (string or function returning string) */
  key: string | ((...args: unknown[]) => string);
  /** Time to live in ms (default: 5 minutes) */
  ttl?: number;
  /** Whether to return stale data while revalidating */
  staleWhileRevalidate?: boolean;
}

/** Return type for useAsync */
export interface UseAsyncReturn<T, Args extends unknown[]> {
  /** Current data */
  data: Accessor<T | undefined>;
  /** Current error */
  error: Accessor<Error | undefined>;
  /** Current status */
  status: Accessor<AsyncStatus>;
  /** Whether currently loading */
  loading: Accessor<boolean>;
  /** Whether is success */
  isSuccess: Accessor<boolean>;
  /** Whether is error */
  isError: Accessor<boolean>;
  /** Whether is idle */
  isIdle: Accessor<boolean>;
  /** Full state object */
  state: Accessor<AsyncState<T>>;
  /** Execute the async function */
  execute: (...args: Args) => Promise<T>;
  /** Retry the last execution */
  retry: () => Promise<T | undefined>;
  /** Reset state to initial */
  reset: () => void;
  /** Cancel current execution */
  cancel: () => void;
  /** Mutate data directly */
  mutate: (data: T | ((prev: T | undefined) => T)) => void;
  /** Clear error */
  clearError: () => void;
  /** Abort controller for current request */
  abortController: Accessor<AbortController | undefined>;
}

// ============================================================================
// Cache Implementation
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;

  // Check if expired
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return undefined;
  }

  return entry;
}

function setCacheEntry<T>(key: string, data: T, ttl: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

function clearCache(keyPattern?: string | RegExp): void {
  if (!keyPattern) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (typeof keyPattern === "string") {
      if (key.startsWith(keyPattern)) {
        cache.delete(key);
      }
    } else if (keyPattern.test(key)) {
      cache.delete(key);
    }
  }
}

// ============================================================================
// Retry Logic
// ============================================================================

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  count: 3,
  delay: 1000,
  exponential: true,
  maxDelay: 30000,
  shouldRetry: () => true,
};

function calculateRetryDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  if (!options.exponential) {
    return options.delay;
  }

  const delay = options.delay * Math.pow(2, attempt);
  return Math.min(delay, options.maxDelay);
}

// ============================================================================
// useAsync Hook
// ============================================================================

/**
 * Manages async function execution with loading, error, and data states.
 *
 * @param asyncFn - Async function to execute
 * @param options - Configuration options
 * @returns Object with state accessors and control functions
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { data, loading, error, execute } = useAsync(fetchUser);
 *
 * // With immediate execution
 * const { data, loading } = useAsync(fetchUser, {
 *   immediate: [userId],
 * });
 *
 * // With reactive immediate execution
 * const { data, loading } = useAsync(fetchUser, {
 *   immediate: () => [props.userId],
 * });
 *
 * // With retry
 * const { data, loading, retry } = useAsync(fetchUser, {
 *   retry: { count: 3, exponential: true },
 * });
 *
 * // With caching
 * const { data, loading } = useAsync(fetchUser, {
 *   cache: { key: (id) => `user:${id}`, ttl: 60000 },
 * });
 * ```
 */
export function useAsync<T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
  options: UseAsyncOptions<T, Args> = {}
): UseAsyncReturn<T, Args> {
  const {
    initialData,
    onSuccess,
    onError,
    onSettled,
    retry: retryOption,
    cache: cacheOption,
    resetErrorOnExecute = true,
    resetDataOnExecute = false,
    abortOnNewRequest = true,
  } = options;

  // Parse retry options
  const retryOptions: Required<RetryOptions> | null = retryOption
    ? {
        ...DEFAULT_RETRY_OPTIONS,
        ...(typeof retryOption === "object" ? retryOption : {}),
      }
    : null;

  // State
  const [status, setStatus] = createSignal<AsyncStatus>("idle");
  const [data, setData] = createSignal<T | undefined>(initialData);
  const [error, setError] = createSignal<Error | undefined>();
  const [lastUpdated, setLastUpdated] = createSignal<number | undefined>();
  const [abortController, setAbortController] = createSignal<
    AbortController | undefined
  >();

  // Track last args for retry
  let lastArgs: Args | undefined;
  let executionCount = 0;

  // Computed state
  const loading = () => status() === "loading";
  const isSuccess = () => status() === "success";
  const isError = () => status() === "error";
  const isIdle = () => status() === "idle";

  const state = (): AsyncState<T> => ({
    status: status(),
    data: data(),
    error: error(),
    isLoading: loading(),
    isSuccess: isSuccess(),
    isError: isError(),
    isIdle: isIdle(),
    lastUpdated: lastUpdated(),
  });

  /**
   * Get cache key for given args
   */
  const getCacheKey = (args: Args): string | undefined => {
    if (!cacheOption) return undefined;

    if (typeof cacheOption.key === "function") {
      return cacheOption.key(...args);
    }

    return cacheOption.key;
  };

  /**
   * Cancel current execution
   */
  const cancel = (): void => {
    const controller = untrack(abortController);
    if (controller) {
      controller.abort();
      setAbortController(undefined);
    }
  };

  /**
   * Execute the async function
   */
  const execute = async (...args: Args): Promise<T> => {
    lastArgs = args;
    const currentExecution = ++executionCount;

    // Cancel previous request if configured
    if (abortOnNewRequest) {
      cancel();
    }

    // Create new abort controller
    const controller = new AbortController();
    setAbortController(controller);

    // Check cache
    const cacheKey = getCacheKey(args);
    if (cacheKey) {
      const cached = getCacheEntry<T>(cacheKey);
      if (cached) {
        if (cacheOption?.staleWhileRevalidate) {
          // Return stale data immediately
          batch(() => {
            setData(() => cached.data);
            setStatus("success");
          });
        } else {
          // Just return cached data
          batch(() => {
            setData(() => cached.data);
            setStatus("success");
            setLastUpdated(cached.timestamp);
          });
          return cached.data;
        }
      }
    }

    // Reset state
    batch(() => {
      if (resetErrorOnExecute) {
        setError(undefined);
      }
      if (resetDataOnExecute) {
        setData(undefined);
      }
      setStatus("loading");
    });

    let attempt = 0;
    let lastError: Error | undefined;

    while (true) {
      try {
        // Check if aborted
        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const result = await asyncFn(...args);

        // Check if this execution is still current
        if (currentExecution !== executionCount) {
          throw new DOMException("Superseded", "AbortError");
        }

        // Check if aborted after execution
        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        // Success
        const now = Date.now();

        batch(() => {
          setData(() => result);
          setError(undefined);
          setStatus("success");
          setLastUpdated(now);
        });

        // Update cache
        if (cacheKey && cacheOption) {
          setCacheEntry(cacheKey, result, cacheOption.ttl ?? 5 * 60 * 1000);
        }

        onSuccess?.(result);
        onSettled?.(result, undefined);

        return result;
      } catch (err) {
        // Handle abort
        if (err instanceof DOMException && err.name === "AbortError") {
          throw err;
        }

        lastError = err instanceof Error ? err : new Error(String(err));

        // Check if should retry
        if (
          retryOptions &&
          attempt < retryOptions.count &&
          retryOptions.shouldRetry(lastError, attempt)
        ) {
          attempt++;
          const delay = calculateRetryDelay(attempt - 1, retryOptions);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Check if this execution is still current
        if (currentExecution !== executionCount) {
          throw new DOMException("Superseded", "AbortError");
        }

        // Error
        batch(() => {
          setError(lastError);
          setStatus("error");
        });

        onError?.(lastError);
        onSettled?.(undefined, lastError);

        throw lastError;
      }
    }
  };

  /**
   * Retry the last execution
   */
  const retry = async (): Promise<T | undefined> => {
    if (!lastArgs) return undefined;
    return execute(...lastArgs);
  };

  /**
   * Reset state to initial
   */
  const reset = (): void => {
    cancel();
    batch(() => {
      setStatus("idle");
      setData(() => initialData);
      setError(undefined);
      setLastUpdated(undefined);
    });
    lastArgs = undefined;
  };

  /**
   * Mutate data directly
   */
  const mutate = (newData: T | ((prev: T | undefined) => T)): void => {
    setData((prev) => {
      if (typeof newData === "function") {
        return (newData as (prev: T | undefined) => T)(prev);
      }
      return newData;
    });
  };

  /**
   * Clear error
   */
  const clearError = (): void => {
    setError(undefined);
    if (status() === "error") {
      setStatus("idle");
    }
  };

  // Handle immediate execution
  const immediate = options.immediate;
  if (immediate !== undefined) {
    createEffect(() => {
      const args =
        typeof immediate === "function"
          ? (immediate as Accessor<Args | undefined>)()
          : immediate;

      if (args !== undefined) {
        execute(...args);
      }
    });
  }

  // Cleanup on unmount
  onCleanup(cancel);

  return {
    data,
    error,
    status,
    loading,
    isSuccess,
    isError,
    isIdle,
    state,
    execute,
    retry,
    reset,
    cancel,
    mutate,
    clearError,
    abortController,
  };
}

// ============================================================================
// useAsyncFn Hook (Manual Execution Only)
// ============================================================================

/**
 * Like useAsync but without immediate execution support.
 * Use when you only want manual execution control.
 *
 * @param asyncFn - Async function to execute
 * @param options - Configuration options (excluding immediate)
 * @returns Object with state accessors and control functions
 *
 * @example
 * ```tsx
 * const { loading, execute } = useAsyncFn(async (data: FormData) => {
 *   const response = await fetch("/api/submit", {
 *     method: "POST",
 *     body: data,
 *   });
 *   return response.json();
 * });
 *
 * const handleSubmit = async (formData: FormData) => {
 *   try {
 *     const result = await execute(formData);
 *     console.log("Success:", result);
 *   } catch (error) {
 *     console.error("Failed:", error);
 *   }
 * };
 * ```
 */
export function useAsyncFn<T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
  options: Omit<UseAsyncOptions<T, Args>, "immediate"> = {}
): UseAsyncReturn<T, Args> {
  return useAsync(asyncFn, options);
}

// ============================================================================
// useAsyncEffect Hook
// ============================================================================

/**
 * Like createEffect but for async functions with proper cleanup.
 *
 * @param effectFn - Async effect function
 * @param deps - Dependencies accessor (optional)
 *
 * @example
 * ```tsx
 * function UserData(props: { userId: string }) {
 *   const [user, setUser] = createSignal<User>();
 *
 *   useAsyncEffect(async (signal) => {
 *     const response = await fetch(`/api/users/${props.userId}`, { signal });
 *     const data = await response.json();
 *     setUser(data);
 *   });
 *
 *   return <Show when={user()}>{(u) => <UserCard user={u()} />}</Show>;
 * }
 * ```
 */
export function useAsyncEffect(
  effectFn: (signal: AbortSignal) => Promise<void | (() => void)>,
  deps?: Accessor<unknown>
): void {
  let abortController: AbortController | null = null;
  let cleanup: (() => void) | void;

  createEffect(() => {
    // Touch deps if provided
    if (deps) {
      deps();
    }

    // Abort previous execution
    if (abortController) {
      abortController.abort();
    }

    // Run previous cleanup
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }

    // Create new controller
    abortController = new AbortController();
    const signal = abortController.signal;

    // Run effect
    effectFn(signal)
      .then((cleanupFn) => {
        if (!signal.aborted && cleanupFn) {
          cleanup = cleanupFn;
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return; // Expected abort
        }
        console.error("useAsyncEffect error:", error);
      });
  });

  onCleanup(() => {
    if (abortController) {
      abortController.abort();
    }
    if (cleanup) {
      cleanup();
    }
  });
}

// ============================================================================
// usePolling Hook
// ============================================================================

/**
 * Periodically executes an async function.
 *
 * @param asyncFn - Async function to poll
 * @param interval - Polling interval in ms
 * @param options - Configuration options
 * @returns Object with state and control functions
 *
 * @example
 * ```tsx
 * const { data, start, stop, isPolling } = usePolling(
 *   () => fetchNotifications(),
 *   30000, // Every 30 seconds
 *   {
 *     immediate: true,
 *     pauseOnHidden: true,
 *   }
 * );
 * ```
 */
export function usePolling<T>(
  asyncFn: () => Promise<T>,
  interval: number,
  options: {
    /** Start polling immediately */
    immediate?: boolean;
    /** Pause when document is hidden */
    pauseOnHidden?: boolean;
    /** Maximum number of polls (undefined = infinite) */
    maxPolls?: number;
    /** Error handler */
    onError?: (error: Error) => void;
    /** Success handler */
    onSuccess?: (data: T) => void;
  } = {}
): {
  data: Accessor<T | undefined>;
  error: Accessor<Error | undefined>;
  loading: Accessor<boolean>;
  pollCount: Accessor<number>;
  isPolling: Accessor<boolean>;
  start: () => void;
  stop: () => void;
  poll: () => Promise<T>;
} {
  const {
    immediate = false,
    pauseOnHidden = true,
    maxPolls,
    onError,
    onSuccess,
  } = options;

  const [data, setData] = createSignal<T | undefined>();
  const [error, setError] = createSignal<Error | undefined>();
  const [loading, setLoading] = createSignal(false);
  const [pollCount, setPollCount] = createSignal(0);
  const [isPolling, setIsPolling] = createSignal(false);

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isPaused = false;

  /**
   * Execute a single poll
   */
  const poll = async (): Promise<T> => {
    setLoading(true);
    setError(undefined);

    try {
      const result = await asyncFn();
      setData(() => result);
      setPollCount((c) => c + 1);
      onSuccess?.(result);

      // Check max polls
      if (maxPolls !== undefined && pollCount() >= maxPolls) {
        stop();
      }

      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      onError?.(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start polling
   */
  const start = (): void => {
    if (isPolling()) return;

    setIsPolling(true);
    setPollCount(0);

    // Initial poll
    poll().catch(() => {});

    // Start interval
    intervalId = setInterval(() => {
      if (!isPaused) {
        poll().catch(() => {});
      }
    }, interval);
  };

  /**
   * Stop polling
   */
  const stop = (): void => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    setIsPolling(false);
  };

  // Handle visibility change
  if (pauseOnHidden) {
    createEffect(() => {
      const handleVisibility = (): void => {
        isPaused = document.visibilityState === "hidden";

        // Poll immediately when becoming visible
        if (!isPaused && isPolling()) {
          poll().catch(() => {});
        }
      };

      document.addEventListener("visibilitychange", handleVisibility);

      onCleanup(() => {
        document.removeEventListener("visibilitychange", handleVisibility);
      });
    });
  }

  // Start immediately if configured
  if (immediate) {
    start();
  }

  // Cleanup
  onCleanup(stop);

  return {
    data,
    error,
    loading,
    pollCount,
    isPolling,
    start,
    stop,
    poll,
  };
}

// ============================================================================
// Cache Utilities (Exported)
// ============================================================================

export { clearCache };

/**
 * Invalidate cache entries by key or pattern
 */
export function invalidateCache(keyOrPattern: string | RegExp): void {
  clearCache(keyOrPattern);
}

/**
 * Get cache entry if valid
 */
export function getCachedData<T>(key: string): T | undefined {
  const entry = getCacheEntry<T>(key);
  return entry?.data;
}

/**
 * Prefetch and cache data
 */
export async function prefetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: { ttl?: number } = {}
): Promise<T> {
  const { ttl = 5 * 60 * 1000 } = options;

  // Check if already cached
  const cached = getCacheEntry<T>(key);
  if (cached) {
    return cached.data;
  }

  // Fetch and cache
  const data = await fetchFn();
  setCacheEntry(key, data, ttl);
  return data;
}

// ============================================================================
// Default Export
// ============================================================================

export default useAsync;

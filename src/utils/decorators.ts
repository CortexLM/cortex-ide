/**
 * Decorators inspired by VS Code - Functional version for SolidJS
 * No need for experimentalDecorators
 */

/**
 * Throttle - Ensures only one execution at a time, queues the next call
 * If called while executing, the next call is queued and executed after current completes
 */
export function throttle<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  let currentPromise: Promise<any> | null = null;
  let nextArgs: any[] | null = null;
  let nextResolve: ((value: any) => void) | null = null;
  let nextReject: ((error: any) => void) | null = null;

  const execute = async (...args: any[]): Promise<any> => {
    if (currentPromise) {
      // Already executing, queue this call
      nextArgs = args;
      return new Promise((resolve, reject) => {
        nextResolve = resolve;
        nextReject = reject;
      });
    }

    try {
      currentPromise = fn(...args);
      const result = await currentPromise;
      return result;
    } finally {
      currentPromise = null;
      
      // Execute queued call if any
      if (nextArgs) {
        const argsToUse = nextArgs;
        const resolveToUse = nextResolve;
        const rejectToUse = nextReject;
        nextArgs = null;
        nextResolve = null;
        nextReject = null;
        
        execute(...argsToUse)
          .then(resolveToUse)
          .catch(rejectToUse);
      }
    }
  };

  return execute as T;
}

/**
 * Debounce - Delays execution until no calls for specified duration
 * Resets the timer on each call
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: any[] | null = null;

  const debounced = (...args: any[]) => {
    lastArgs = args;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      lastArgs = null;
      fn(...args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  debounced.flush = () => {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId);
      timeoutId = null;
      const args = lastArgs;
      lastArgs = null;
      fn(...args);
    }
  };

  return debounced as T & { cancel: () => void; flush: () => void };
}

/**
 * Debounce for async functions - Returns a promise
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingResolve: ((value: any) => void) | null = null;
  let pendingReject: ((error: any) => void) | null = null;

  const debounced = (...args: any[]): Promise<any> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve, reject) => {
      // Cancel previous pending promise
      if (pendingReject) {
        pendingReject(new Error("Debounced call cancelled"));
      }
      
      pendingResolve = resolve;
      pendingReject = reject;

      timeoutId = setTimeout(async () => {
        timeoutId = null;
        const currentResolve = pendingResolve;
        const currentReject = pendingReject;
        pendingResolve = null;
        pendingReject = null;
        
        try {
          const result = await fn(...args);
          currentResolve?.(result);
        } catch (error) {
          currentReject?.(error);
        }
      }, delay);
    });
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (pendingReject) {
      pendingReject(new Error("Debounced call cancelled"));
      pendingResolve = null;
      pendingReject = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

/**
 * Sequentialize - Ensures sequential execution of async operations
 * Each call waits for the previous one to complete
 */
export function sequentialize<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  let lastPromise: Promise<any> = Promise.resolve();

  return ((...args: any[]) => {
    const run = async () => fn(...args);
    // Chain after previous, whether it succeeded or failed
    lastPromise = lastPromise.then(run, run);
    return lastPromise;
  }) as T;
}

/**
 * Memoize - Caches the first result and returns it for subsequent calls
 * Useful for expensive one-time computations
 */
export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  let cached: { value: any } | null = null;

  return ((...args: any[]) => {
    if (cached) return cached.value;
    cached = { value: fn(...args) };
    return cached.value;
  }) as T;
}

/**
 * Memoize with key - Caches results by key
 */
export function memoizeWithKey<T extends (...args: any[]) => any>(
  fn: T,
  keyFn: (...args: any[]) => string
): T & { clear: () => void; clearKey: (key: string) => void } {
  const cache = new Map<string, any>();

  const memoized = ((...args: any[]) => {
    const key = keyFn(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T & { clear: () => void; clearKey: (key: string) => void };

  memoized.clear = () => cache.clear();
  memoized.clearKey = (key: string) => cache.delete(key);

  return memoized;
}

/**
 * Once - Ensures function is only called once
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false;
  let result: any;

  return ((...args: any[]) => {
    if (called) return result;
    called = true;
    result = fn(...args);
    return result;
  }) as T;
}

/**
 * Timeout wrapper - Rejects if operation takes too long
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = "Operation timed out"
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

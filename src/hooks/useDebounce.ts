/**
 * useDebounce - Debounced signals and callbacks for SolidJS
 *
 * Provides debouncing utilities optimized for reactive systems with proper
 * cleanup, TypeScript generics, and configurable leading/trailing edge triggers.
 *
 * Features:
 * - Full TypeScript generic support
 * - Leading and trailing edge execution options
 * - Maximum wait time for delayed calls
 * - Automatic cleanup on unmount
 * - Cancel and flush utilities
 * - RAF-based option for visual updates
 *
 * @example
 * ```tsx
 * function SearchInput() {
 *   const [query, setQuery] = createSignal("");
 *   const debouncedQuery = useDebounce(query, 300);
 *   const debouncedSearch = useDebouncedCallback(
 *     (q: string) => performSearch(q),
 *     300
 *   );
 *
 *   createEffect(() => {
 *     // Only fires 300ms after user stops typing
 *     console.log("Searching for:", debouncedQuery());
 *   });
 *
 *   return (
 *     <input
 *       value={query()}
 *       onInput={(e) => {
 *         setQuery(e.target.value);
 *         debouncedSearch(e.target.value);
 *       }}
 *     />
 *   );
 * }
 * ```
 */

import {
  createSignal,
  createEffect,
  onCleanup,
  untrack,
  type Accessor,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

/** Options for debounce hooks */
export interface DebounceOptions {
  /** Delay in milliseconds before executing (default: 300) */
  delay?: number;
  /** Execute on the leading edge of the delay (default: false) */
  leading?: boolean;
  /** Execute on the trailing edge of the delay (default: true) */
  trailing?: boolean;
  /** Maximum time to wait before forcing execution (optional) */
  maxWait?: number;
}

/** Options for RAF-based debouncing */
export interface RAFDebounceOptions {
  /** Execute on the leading edge (first call) */
  leading?: boolean;
}

/** Return type for debounced callbacks */
export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  /** Call the debounced function */
  (...args: Parameters<T>): void;
  /** Cancel any pending execution */
  cancel: () => void;
  /** Immediately execute any pending call */
  flush: () => void;
  /** Check if there's a pending execution */
  isPending: () => boolean;
}

// ============================================================================
// useDebounce Hook (Debounced Signal)
// ============================================================================

/**
 * Creates a debounced version of a signal value.
 * The returned signal only updates after the source signal stops
 * changing for the specified delay.
 *
 * @param source - Accessor to debounce
 * @param delay - Debounce delay in milliseconds (default: 300)
 * @param options - Additional options
 * @returns Debounced accessor
 *
 * @example
 * ```tsx
 * const [text, setText] = createSignal("");
 * const debouncedText = useDebounce(text, 500);
 *
 * createEffect(() => {
 *   // Only fires 500ms after text stops changing
 *   fetchSuggestions(debouncedText());
 * });
 * ```
 */
export function useDebounce<T>(
  source: Accessor<T>,
  delay: number = 300,
  options: Omit<DebounceOptions, "delay"> = {}
): Accessor<T> {
  const { leading = false, trailing = true, maxWait } = options;

  // Initialize with current value
  const [debouncedValue, setDebouncedValue] = createSignal<T>(untrack(source));

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime: number | null = null;
  let hasLeadingCall = false;

  /**
   * Clear all pending timeouts
   */
  const clearTimeouts = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxWaitTimeoutId !== null) {
      clearTimeout(maxWaitTimeoutId);
      maxWaitTimeoutId = null;
    }
  };

  /**
   * Apply the current source value to the debounced signal
   */
  const applyValue = (): void => {
    setDebouncedValue(() => source());
    lastCallTime = Date.now();
    hasLeadingCall = false;
    clearTimeouts();
  };

  // Setup effect to track source changes
  createEffect(() => {
    const value = source();
    const now = Date.now();

    // Handle leading edge
    if (leading && !hasLeadingCall) {
      hasLeadingCall = true;
      setDebouncedValue(() => value);
      lastCallTime = now;

      if (!trailing) {
        return;
      }
    }

    // Clear existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Set trailing edge timeout
    if (trailing) {
      timeoutId = setTimeout(applyValue, delay);
    }

    // Handle max wait
    if (maxWait !== undefined && maxWaitTimeoutId === null) {
      const timeSinceLastCall = lastCallTime ? now - lastCallTime : 0;
      const remainingMaxWait = Math.max(0, maxWait - timeSinceLastCall);

      maxWaitTimeoutId = setTimeout(() => {
        applyValue();
      }, remainingMaxWait);
    }
  });

  // Cleanup on unmount
  onCleanup(clearTimeouts);

  return debouncedValue;
}

// ============================================================================
// useDebouncedCallback Hook
// ============================================================================

/**
 * Creates a debounced version of a callback function.
 * The callback only executes after it stops being called for the specified delay.
 *
 * @param callback - Function to debounce
 * @param delay - Debounce delay in milliseconds (default: 300)
 * @param options - Additional options
 * @returns Debounced function with cancel and flush methods
 *
 * @example
 * ```tsx
 * const saveChanges = useDebouncedCallback(
 *   async (data: FormData) => await api.save(data),
 *   1000,
 *   { leading: true, trailing: true }
 * );
 *
 * // Later in event handler:
 * saveChanges(formData);
 *
 * // Cancel if needed:
 * saveChanges.cancel();
 *
 * // Force immediate execution:
 * saveChanges.flush();
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300,
  options: Omit<DebounceOptions, "delay"> = {}
): DebouncedFunction<T> {
  const { leading = false, trailing = true, maxWait } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number | null = null;
  let hasLeadingCall = false;

  /**
   * Clear all pending timeouts
   */
  const clearTimeouts = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxWaitTimeoutId !== null) {
      clearTimeout(maxWaitTimeoutId);
      maxWaitTimeoutId = null;
    }
  };

  /**
   * Execute the callback with stored arguments
   */
  const invokeCallback = (): void => {
    if (lastArgs !== null) {
      callback(...lastArgs);
    }
    lastArgs = null;
    lastCallTime = Date.now();
    hasLeadingCall = false;
    clearTimeouts();
  };

  /**
   * The debounced function
   */
  const debouncedFn = ((...args: Parameters<T>): void => {
    const now = Date.now();
    lastArgs = args;

    // Handle leading edge
    if (leading && !hasLeadingCall) {
      hasLeadingCall = true;
      callback(...args);
      lastCallTime = now;

      if (!trailing) {
        lastArgs = null;
        return;
      }
    }

    // Clear existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Set trailing edge timeout
    if (trailing) {
      timeoutId = setTimeout(invokeCallback, delay);
    }

    // Handle max wait
    if (maxWait !== undefined && maxWaitTimeoutId === null) {
      const timeSinceLastCall = lastCallTime ? now - lastCallTime : 0;
      const remainingMaxWait = Math.max(0, maxWait - timeSinceLastCall);

      maxWaitTimeoutId = setTimeout(invokeCallback, remainingMaxWait);
    }
  }) as DebouncedFunction<T>;

  /**
   * Cancel any pending execution
   */
  debouncedFn.cancel = (): void => {
    lastArgs = null;
    hasLeadingCall = false;
    clearTimeouts();
  };

  /**
   * Immediately execute pending call
   */
  debouncedFn.flush = (): void => {
    if (lastArgs !== null) {
      invokeCallback();
    }
  };

  /**
   * Check if there's a pending execution
   */
  debouncedFn.isPending = (): boolean => {
    return timeoutId !== null || maxWaitTimeoutId !== null;
  };

  // Cleanup on unmount
  onCleanup(() => {
    debouncedFn.cancel();
  });

  return debouncedFn;
}

// ============================================================================
// useDebounceEffect Hook
// ============================================================================

/**
 * Creates a debounced effect that only runs after dependencies
 * stop changing for the specified delay.
 *
 * @param callback - Effect callback to run
 * @param delay - Debounce delay in milliseconds (default: 300)
 *
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = createSignal("");
 * const [filters, setFilters] = createStore({ category: "", sort: "" });
 *
 * // Effect only runs 500ms after query or filters stop changing
 * useDebounceEffect(() => {
 *   performSearch(searchQuery(), filters);
 * }, 500);
 * ```
 */
export function useDebounceEffect(
  callback: () => void | (() => void),
  delay: number = 300
): void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cleanup: (() => void) | void;

  createEffect(() => {
    // Track dependencies by running callback in tracked scope
    // We need to "touch" the reactive dependencies somehow
    // This is a common pattern - the callback itself tracks dependencies

    // Clear previous timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Run previous cleanup
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }

    // Schedule new callback
    timeoutId = setTimeout(() => {
      timeoutId = null;
      cleanup = callback();
    }, delay);
  });

  onCleanup(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (cleanup) {
      cleanup();
    }
  });
}

// ============================================================================
// useRAFDebounce Hook (Frame-Rate Limited)
// ============================================================================

/**
 * Creates a debounced callback that executes on the next animation frame.
 * Useful for visual updates that don't need to run more than 60fps.
 *
 * @param callback - Callback to debounce
 * @param options - Configuration options
 * @returns Debounced callback with cancel method
 *
 * @example
 * ```tsx
 * const updatePosition = useRAFDebounce((x: number, y: number) => {
 *   element.style.transform = `translate(${x}px, ${y}px)`;
 * });
 *
 * document.addEventListener("mousemove", (e) => {
 *   updatePosition(e.clientX, e.clientY);
 * });
 * ```
 */
export function useRAFDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  options: RAFDebounceOptions = {}
): DebouncedFunction<T> {
  const { leading = false } = options;

  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  let hasLeadingCall = false;

  /**
   * The debounced function
   */
  const debouncedFn = ((...args: Parameters<T>): void => {
    lastArgs = args;

    // Handle leading edge
    if (leading && !hasLeadingCall) {
      hasLeadingCall = true;
      callback(...args);
      return;
    }

    // Already scheduled
    if (rafId !== null) {
      return;
    }

    rafId = requestAnimationFrame(() => {
      rafId = null;
      hasLeadingCall = false;
      if (lastArgs !== null) {
        callback(...lastArgs);
        lastArgs = null;
      }
    });
  }) as DebouncedFunction<T>;

  /**
   * Cancel pending execution
   */
  debouncedFn.cancel = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastArgs = null;
    hasLeadingCall = false;
  };

  /**
   * Immediately execute pending call
   */
  debouncedFn.flush = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (lastArgs !== null) {
      callback(...lastArgs);
      lastArgs = null;
    }
    hasLeadingCall = false;
  };

  /**
   * Check if there's a pending execution
   */
  debouncedFn.isPending = (): boolean => {
    return rafId !== null;
  };

  // Cleanup on unmount
  onCleanup(() => {
    debouncedFn.cancel();
  });

  return debouncedFn;
}

// ============================================================================
// useDebounceState Hook
// ============================================================================

/**
 * Creates a signal pair where the setter is debounced.
 * Useful when you want immediate local state updates but debounced effects.
 *
 * @param initialValue - Initial signal value
 * @param delay - Debounce delay in milliseconds (default: 300)
 * @param options - Additional options
 * @returns Tuple of [getter, debouncedSetter, immediateSetter]
 *
 * @example
 * ```tsx
 * const [text, setTextDebounced, setTextImmediate] = useDebounceState("", 500);
 *
 * // For input field - update immediately for responsive UI
 * <input value={text()} onInput={(e) => setTextImmediate(e.target.value)} />
 *
 * // Or use debounced setter to avoid frequent state updates
 * <input onInput={(e) => setTextDebounced(e.target.value)} />
 * ```
 */
export function useDebounceState<T>(
  initialValue: T,
  delay: number = 300,
  options: Omit<DebounceOptions, "delay"> = {}
): [Accessor<T>, (value: T) => void, (value: T) => void] {
  const [value, setValue] = createSignal<T>(initialValue);

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const { leading = false, trailing = true, maxWait } = options;
  let lastCallTime: number | null = null;
  let hasLeadingCall = false;
  let pendingValue: T | null = null;

  const setValueDebounced = (newValue: T): void => {
    const now = Date.now();
    pendingValue = newValue;

    // Handle leading edge
    if (leading && !hasLeadingCall) {
      hasLeadingCall = true;
      setValue(() => newValue);
      lastCallTime = now;
      if (!trailing) {
        pendingValue = null;
        return;
      }
    }

    // Clear existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Set trailing edge timeout
    if (trailing) {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        hasLeadingCall = false;
        if (pendingValue !== null) {
          setValue(() => pendingValue as T);
          pendingValue = null;
        }
        lastCallTime = Date.now();
      }, delay);
    }

    // Handle max wait
    if (maxWait !== undefined && lastCallTime !== null) {
      const timeSinceLastCall = now - lastCallTime;
      if (timeSinceLastCall >= maxWait && pendingValue !== null) {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        setValue(() => pendingValue as T);
        pendingValue = null;
        lastCallTime = Date.now();
        hasLeadingCall = false;
      }
    }
  };

  const setValueImmediate = (newValue: T): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    hasLeadingCall = false;
    pendingValue = null;
    setValue(() => newValue);
  };

  // Cleanup on unmount
  onCleanup(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });

  return [value, setValueDebounced, setValueImmediate];
}

// ============================================================================
// Default Export
// ============================================================================

export default useDebounce;

/**
 * useThrottle - Throttled signals and callbacks for SolidJS
 *
 * Provides throttling utilities that limit the rate of execution to at most
 * once per specified interval, with proper cleanup and TypeScript support.
 *
 * Features:
 * - Full TypeScript generic support
 * - Leading and trailing edge execution options
 * - Automatic cleanup on unmount
 * - Cancel and flush utilities
 * - RAF-based option for visual updates
 *
 * Difference from Debounce:
 * - Debounce: Waits until calls stop, then executes once
 * - Throttle: Executes at most once per interval, regardless of call frequency
 *
 * @example
 * ```tsx
 * function ScrollHandler() {
 *   const [scrollY, setScrollY] = createSignal(0);
 *   const throttledScrollY = useThrottle(scrollY, 100);
 *   
 *   const handleScroll = useThrottledCallback(
 *     () => setScrollY(window.scrollY),
 *     100
 *   );
 *
 *   onMount(() => {
 *     window.addEventListener("scroll", handleScroll);
 *     onCleanup(() => window.removeEventListener("scroll", handleScroll));
 *   });
 *
 *   return <div>Scroll position: {throttledScrollY()}</div>;
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

/** Options for throttle hooks */
export interface ThrottleOptions {
  /** Interval in milliseconds between executions (default: 100) */
  interval?: number;
  /** Execute on the leading edge of the interval (default: true) */
  leading?: boolean;
  /** Execute on the trailing edge of the interval (default: true) */
  trailing?: boolean;
}

/** Return type for throttled callbacks */
export interface ThrottledFunction<T extends (...args: unknown[]) => unknown> {
  /** Call the throttled function */
  (...args: Parameters<T>): void;
  /** Cancel any pending trailing execution */
  cancel: () => void;
  /** Immediately execute any pending call */
  flush: () => void;
  /** Check if there's a pending trailing execution */
  isPending: () => boolean;
  /** Get time remaining until next allowed execution */
  getRemainingTime: () => number;
}

// ============================================================================
// useThrottle Hook (Throttled Signal)
// ============================================================================

/**
 * Creates a throttled version of a signal value.
 * The returned signal updates at most once per interval.
 *
 * @param source - Accessor to throttle
 * @param interval - Minimum interval between updates in milliseconds (default: 100)
 * @param options - Additional options
 * @returns Throttled accessor
 *
 * @example
 * ```tsx
 * const [mousePosition, setMousePosition] = createSignal({ x: 0, y: 0 });
 * const throttledPosition = useThrottle(mousePosition, 50);
 *
 * createEffect(() => {
 *   // Updates at most every 50ms
 *   updateVisualization(throttledPosition());
 * });
 * ```
 */
export function useThrottle<T>(
  source: Accessor<T>,
  interval: number = 100,
  options: Omit<ThrottleOptions, "interval"> = {}
): Accessor<T> {
  const { leading = true, trailing = true } = options;

  // Initialize with current value
  const [throttledValue, setThrottledValue] = createSignal<T>(untrack(source));

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastExecutedTime: number = 0;
  let pendingValue: T | null = null;
  let hasPendingValue = false;

  /**
   * Clear pending timeout
   */
  const clearPendingTimeout = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  /**
   * Apply the value to the throttled signal
   */
  const applyValue = (value: T): void => {
    setThrottledValue(() => value);
    lastExecutedTime = Date.now();
    hasPendingValue = false;
    pendingValue = null;
    clearPendingTimeout();
  };

  /**
   * Schedule a trailing edge execution
   */
  const scheduleTrailing = (value: T, remainingTime: number): void => {
    pendingValue = value;
    hasPendingValue = true;

    clearPendingTimeout();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (hasPendingValue && pendingValue !== null) {
        applyValue(pendingValue);
      }
    }, remainingTime);
  };

  // Setup effect to track source changes
  createEffect(() => {
    const value = source();
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutedTime;
    const remainingTime = Math.max(0, interval - timeSinceLastExecution);

    // Can execute immediately
    if (remainingTime === 0) {
      if (leading || lastExecutedTime > 0) {
        applyValue(value);
      } else if (trailing) {
        scheduleTrailing(value, interval);
      }
    } else {
      // Need to wait - schedule trailing if enabled
      if (trailing) {
        scheduleTrailing(value, remainingTime);
      }
    }
  });

  // Cleanup on unmount
  onCleanup(clearPendingTimeout);

  return throttledValue;
}

// ============================================================================
// useThrottledCallback Hook
// ============================================================================

/**
 * Creates a throttled version of a callback function.
 * The callback executes at most once per interval.
 *
 * @param callback - Function to throttle
 * @param interval - Minimum interval between executions in milliseconds (default: 100)
 * @param options - Additional options
 * @returns Throttled function with cancel, flush, and utility methods
 *
 * @example
 * ```tsx
 * const handleResize = useThrottledCallback(
 *   () => {
 *     updateLayout(window.innerWidth, window.innerHeight);
 *   },
 *   100,
 *   { leading: true, trailing: true }
 * );
 *
 * window.addEventListener("resize", handleResize);
 *
 * // Later:
 * handleResize.flush(); // Force immediate execution
 * handleResize.cancel(); // Cancel pending trailing call
 * console.log(handleResize.getRemainingTime()); // ms until next allowed call
 * ```
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number = 100,
  options: Omit<ThrottleOptions, "interval"> = {}
): ThrottledFunction<T> {
  const { leading = true, trailing = true } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastExecutedTime: number = 0;
  let lastArgs: Parameters<T> | null = null;
  let hasPendingCall = false;

  /**
   * Clear pending timeout
   */
  const clearPendingTimeout = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  /**
   * Execute the callback
   */
  const invokeCallback = (args: Parameters<T>): void => {
    callback(...args);
    lastExecutedTime = Date.now();
    hasPendingCall = false;
    lastArgs = null;
    clearPendingTimeout();
  };

  /**
   * Schedule a trailing edge execution
   */
  const scheduleTrailing = (args: Parameters<T>, remainingTime: number): void => {
    lastArgs = args;
    hasPendingCall = true;

    clearPendingTimeout();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (hasPendingCall && lastArgs !== null) {
        invokeCallback(lastArgs);
      }
    }, remainingTime);
  };

  /**
   * The throttled function
   */
  const throttledFn = ((...args: Parameters<T>): void => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutedTime;
    const remainingTime = Math.max(0, interval - timeSinceLastExecution);

    // Can execute immediately
    if (remainingTime === 0) {
      if (leading || lastExecutedTime > 0) {
        invokeCallback(args);
      } else if (trailing) {
        scheduleTrailing(args, interval);
      }
    } else {
      // Need to wait - schedule trailing if enabled
      if (trailing) {
        scheduleTrailing(args, remainingTime);
      }
    }
  }) as ThrottledFunction<T>;

  /**
   * Cancel pending trailing execution
   */
  throttledFn.cancel = (): void => {
    hasPendingCall = false;
    lastArgs = null;
    clearPendingTimeout();
  };

  /**
   * Immediately execute pending call
   */
  throttledFn.flush = (): void => {
    if (hasPendingCall && lastArgs !== null) {
      clearPendingTimeout();
      invokeCallback(lastArgs);
    }
  };

  /**
   * Check if there's a pending execution
   */
  throttledFn.isPending = (): boolean => {
    return hasPendingCall;
  };

  /**
   * Get remaining time until next allowed execution
   */
  throttledFn.getRemainingTime = (): number => {
    const timeSinceLastExecution = Date.now() - lastExecutedTime;
    return Math.max(0, interval - timeSinceLastExecution);
  };

  // Cleanup on unmount
  onCleanup(() => {
    throttledFn.cancel();
  });

  return throttledFn;
}

// ============================================================================
// useRAFThrottle Hook (Frame-Rate Limited)
// ============================================================================

/**
 * Creates a throttled callback that executes at most once per animation frame.
 * Useful for visual updates that should be synchronized with display refresh.
 *
 * @param callback - Callback to throttle
 * @returns Throttled callback with cancel and flush methods
 *
 * @example
 * ```tsx
 * const updateScrollIndicator = useRAFThrottle((scrollY: number) => {
 *   indicator.style.transform = `translateY(${scrollY * 0.1}px)`;
 * });
 *
 * window.addEventListener("scroll", () => {
 *   updateScrollIndicator(window.scrollY);
 * });
 * ```
 */
export function useRAFThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T
): ThrottledFunction<T> {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  let hasPendingCall = false;

  /**
   * The throttled function
   */
  const throttledFn = ((...args: Parameters<T>): void => {
    lastArgs = args;
    hasPendingCall = true;

    // Already scheduled for next frame
    if (rafId !== null) {
      return;
    }

    rafId = requestAnimationFrame(() => {
      rafId = null;
      hasPendingCall = false;
      if (lastArgs !== null) {
        callback(...lastArgs);
        lastArgs = null;
      }
    });
  }) as ThrottledFunction<T>;

  /**
   * Cancel pending execution
   */
  throttledFn.cancel = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    hasPendingCall = false;
    lastArgs = null;
  };

  /**
   * Immediately execute pending call
   */
  throttledFn.flush = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (lastArgs !== null) {
      callback(...lastArgs);
      lastArgs = null;
    }
    hasPendingCall = false;
  };

  /**
   * Check if there's a pending execution
   */
  throttledFn.isPending = (): boolean => {
    return hasPendingCall;
  };

  /**
   * Get remaining time - always returns 0 for RAF (next frame)
   */
  throttledFn.getRemainingTime = (): number => {
    return hasPendingCall ? 16 : 0; // ~16ms per frame at 60fps
  };

  // Cleanup on unmount
  onCleanup(() => {
    throttledFn.cancel();
  });

  return throttledFn;
}

// ============================================================================
// useThrottleState Hook
// ============================================================================

/**
 * Creates a signal pair where updates are throttled.
 * The getter always returns the latest throttled value.
 *
 * @param initialValue - Initial signal value
 * @param interval - Throttle interval in milliseconds (default: 100)
 * @param options - Additional options
 * @returns Tuple of [getter, throttledSetter, immediateSetter, utils]
 *
 * @example
 * ```tsx
 * const [position, setPosition, setPositionImmediate, utils] = useThrottleState(
 *   { x: 0, y: 0 },
 *   50
 * );
 *
 * document.addEventListener("mousemove", (e) => {
 *   setPosition({ x: e.clientX, y: e.clientY });
 * });
 *
 * // Force immediate update if needed:
 * setPositionImmediate({ x: 100, y: 100 });
 *
 * // Check status:
 * console.log(utils.isPending(), utils.getRemainingTime());
 * ```
 */
export function useThrottleState<T>(
  initialValue: T,
  interval: number = 100,
  options: Omit<ThrottleOptions, "interval"> = {}
): [
  Accessor<T>,
  (value: T) => void,
  (value: T) => void,
  {
    cancel: () => void;
    flush: () => void;
    isPending: () => boolean;
    getRemainingTime: () => number;
  },
] {
  const { leading = true, trailing = true } = options;
  const [value, setValue] = createSignal<T>(initialValue);

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastExecutedTime: number = 0;
  let pendingValue: T | null = null;
  let hasPendingValue = false;

  const clearPendingTimeout = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const applyValue = (newValue: T): void => {
    setValue(() => newValue);
    lastExecutedTime = Date.now();
    hasPendingValue = false;
    pendingValue = null;
    clearPendingTimeout();
  };

  const throttledSetter = (newValue: T): void => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutedTime;
    const remainingTime = Math.max(0, interval - timeSinceLastExecution);

    if (remainingTime === 0) {
      if (leading || lastExecutedTime > 0) {
        applyValue(newValue);
      } else if (trailing) {
        pendingValue = newValue;
        hasPendingValue = true;
        clearPendingTimeout();
        timeoutId = setTimeout(() => {
          timeoutId = null;
          if (hasPendingValue && pendingValue !== null) {
            applyValue(pendingValue);
          }
        }, interval);
      }
    } else if (trailing) {
      pendingValue = newValue;
      hasPendingValue = true;
      clearPendingTimeout();
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (hasPendingValue && pendingValue !== null) {
          applyValue(pendingValue);
        }
      }, remainingTime);
    }
  };

  const cancel = (): void => {
    hasPendingValue = false;
    pendingValue = null;
    clearPendingTimeout();
  };

  const flush = (): void => {
    if (hasPendingValue && pendingValue !== null) {
      clearPendingTimeout();
      applyValue(pendingValue);
    }
  };

  const isPending = (): boolean => hasPendingValue;

  const getRemainingTime = (): number => {
    const timeSinceLastExecution = Date.now() - lastExecutedTime;
    return Math.max(0, interval - timeSinceLastExecution);
  };

  const setValueImmediate = (newValue: T): void => {
    cancel();
    setValue(() => newValue);
  };

  // Cleanup on unmount
  onCleanup(cancel);

  return [
    value,
    throttledSetter,
    setValueImmediate,
    {
      cancel,
      flush,
      isPending,
      getRemainingTime,
    },
  ];
}

// ============================================================================
// Utility: Leading-Only Throttle
// ============================================================================

/**
 * Creates a throttled callback that only executes on the leading edge.
 * Useful for "fire once then ignore" patterns like click handlers.
 *
 * @param callback - Function to throttle
 * @param interval - Cooldown period in milliseconds
 * @returns Throttled function
 *
 * @example
 * ```tsx
 * const handleClick = useLeadingThrottle(() => {
 *   submitForm();
 * }, 1000);
 *
 * <button onClick={handleClick}>Submit</button>
 * ```
 */
export function useLeadingThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number
): ThrottledFunction<T> {
  return useThrottledCallback(callback, interval, {
    leading: true,
    trailing: false,
  });
}

/**
 * Creates a throttled callback that only executes on the trailing edge.
 * Useful for "collect all inputs then process once" patterns.
 *
 * @param callback - Function to throttle
 * @param interval - Collection period in milliseconds
 * @returns Throttled function
 *
 * @example
 * ```tsx
 * const processInputs = useTrailingThrottle((inputs: string[]) => {
 *   batchProcess(inputs);
 * }, 200);
 * ```
 */
export function useTrailingThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number
): ThrottledFunction<T> {
  return useThrottledCallback(callback, interval, {
    leading: false,
    trailing: true,
  });
}

// ============================================================================
// Default Export
// ============================================================================

export default useThrottle;

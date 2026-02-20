/**
 * usePrevious - Track previous values of signals in SolidJS
 *
 * Provides utilities for accessing the previous value of a signal,
 * useful for animations, comparisons, and undo functionality.
 *
 * Features:
 * - Full TypeScript generic support
 * - Multiple previous values tracking (history)
 * - Change detection utilities
 * - Conditional update support
 * - Automatic cleanup
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const [count, setCount] = createSignal(0);
 *   const previousCount = usePrevious(count);
 *
 *   return (
 *     <div>
 *       <p>Current: {count()}</p>
 *       <p>Previous: {previousCount()}</p>
 *       <button onClick={() => setCount(c => c + 1)}>Increment</button>
 *     </div>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  createEffect,
  createMemo,
  untrack,
  type Accessor,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

/** Options for usePrevious */
export interface UsePreviousOptions<T> {
  /** Initial previous value (default: undefined) */
  initialValue?: T;
  /** Custom equality function to determine if value changed */
  equals?: (prev: T | undefined, next: T) => boolean;
  /** Only update when condition is met */
  when?: (value: T) => boolean;
}

/** Options for usePreviousDistinct */
export interface UsePreviousDistinctOptions<T> extends UsePreviousOptions<T> {
  /** Custom comparison function */
  compare?: (prev: T | undefined, next: T) => boolean;
}

/** History entry with timestamp */
export interface HistoryEntry<T> {
  /** The value */
  value: T;
  /** When the value was recorded */
  timestamp: number;
}

/** Options for useHistory */
export interface UseHistoryOptions<T> extends UsePreviousOptions<T> {
  /** Maximum number of entries to keep */
  maxLength?: number;
  /** Include timestamps in history */
  includeTimestamps?: boolean;
}

/** Return type for useHistory */
export interface UseHistoryReturn<T> {
  /** Current value */
  current: Accessor<T>;
  /** Previous value (immediate) */
  previous: Accessor<T | undefined>;
  /** Full history array (oldest to newest) */
  history: Accessor<T[]>;
  /** History with timestamps */
  historyWithTimestamps: Accessor<HistoryEntry<T>[]>;
  /** Go back n steps (returns the value) */
  back: (steps?: number) => T | undefined;
  /** Check if can go back */
  canGoBack: Accessor<boolean>;
  /** Clear history */
  clear: () => void;
  /** Get value at specific index (0 = current, 1 = previous, etc.) */
  at: (index: number) => T | undefined;
}

// ============================================================================
// usePrevious Hook
// ============================================================================

/**
 * Returns an accessor to the previous value of a signal.
 *
 * @param source - Accessor to track
 * @param options - Configuration options
 * @returns Accessor to the previous value
 *
 * @example
 * ```tsx
 * const [name, setName] = createSignal("Alice");
 * const previousName = usePrevious(name);
 *
 * createEffect(() => {
 *   const prev = previousName();
 *   const curr = name();
 *   if (prev !== undefined) {
 *     console.log(`Name changed from ${prev} to ${curr}`);
 *   }
 * });
 * ```
 */
export function usePrevious<T>(
  source: Accessor<T>,
  options: UsePreviousOptions<T> = {}
): Accessor<T | undefined> {
  const {
    initialValue,
    equals = Object.is,
    when,
  } = options;

  const [previous, setPrevious] = createSignal<T | undefined>(initialValue);
  let currentValue: T | undefined;

  createEffect(() => {
    const value = source();

    // Check condition
    if (when && !when(value)) {
      return;
    }

    // Skip if equal to current tracked value
    if (currentValue !== undefined && equals(currentValue, value)) {
      return;
    }

    // Update previous with current, then store new current
    setPrevious(() => currentValue);
    currentValue = value;
  });

  return previous;
}

// ============================================================================
// usePreviousDistinct Hook
// ============================================================================

/**
 * Like usePrevious, but only updates when the value is distinctly different.
 * Useful when you only want to track meaningfully different values.
 *
 * @param source - Accessor to track
 * @param options - Configuration options
 * @returns Accessor to the previous distinct value
 *
 * @example
 * ```tsx
 * const [user, setUser] = createSignal({ id: 1, name: "Alice" });
 * const previousUser = usePreviousDistinct(user, {
 *   compare: (prev, next) => prev?.id === next.id,
 * });
 *
 * createEffect(() => {
 *   if (previousUser() && previousUser()?.id !== user().id) {
 *     console.log("User changed!");
 *   }
 * });
 * ```
 */
export function usePreviousDistinct<T>(
  source: Accessor<T>,
  options: UsePreviousDistinctOptions<T> = {}
): Accessor<T | undefined> {
  const {
    initialValue,
    compare = Object.is,
    when,
  } = options;

  const [previous, setPrevious] = createSignal<T | undefined>(initialValue);
  const [current, setCurrent] = createSignal<T | undefined>();

  createEffect(() => {
    const value = source();

    // Check condition
    if (when && !when(value)) {
      return;
    }

    // Get current stored value
    const currentStored = untrack(current);

    // Skip if same as current
    if (currentStored !== undefined && compare(currentStored, value)) {
      return;
    }

    // Update previous and current
    setPrevious(() => currentStored);
    setCurrent(() => value);
  });

  return previous;
}

// ============================================================================
// useHasChanged Hook
// ============================================================================

/**
 * Returns whether a value has changed from its previous value.
 *
 * @param source - Accessor to track
 * @param equals - Custom equality function
 * @returns Accessor indicating if value changed
 *
 * @example
 * ```tsx
 * const [count, setCount] = createSignal(0);
 * const hasCountChanged = useHasChanged(count);
 *
 * createEffect(() => {
 *   if (hasCountChanged()) {
 *     playAnimation();
 *   }
 * });
 * ```
 */
export function useHasChanged<T>(
  source: Accessor<T>,
  equals: (prev: T | undefined, next: T) => boolean = Object.is
): Accessor<boolean> {
  const [hasChanged, setHasChanged] = createSignal(false);
  let previousValue: T | undefined;
  let isFirst = true;

  createEffect(() => {
    const value = source();

    if (isFirst) {
      isFirst = false;
      previousValue = value;
      setHasChanged(false);
      return;
    }

    const changed = !equals(previousValue, value);
    setHasChanged(changed);
    previousValue = value;
  });

  return hasChanged;
}

// ============================================================================
// useChangeCount Hook
// ============================================================================

/**
 * Counts how many times a value has changed.
 *
 * @param source - Accessor to track
 * @param options - Configuration options
 * @returns Accessor to change count
 *
 * @example
 * ```tsx
 * const [text, setText] = createSignal("");
 * const editCount = useChangeCount(text);
 *
 * return (
 *   <div>
 *     <input value={text()} onInput={(e) => setText(e.target.value)} />
 *     <p>Edits: {editCount()}</p>
 *   </div>
 * );
 * ```
 */
export function useChangeCount<T>(
  source: Accessor<T>,
  options: {
    equals?: (prev: T | undefined, next: T) => boolean;
    resetOn?: Accessor<boolean>;
  } = {}
): Accessor<number> {
  const { equals = Object.is, resetOn } = options;

  const [count, setCount] = createSignal(0);
  let previousValue: T | undefined;
  let isFirst = true;

  // Reset when condition is true
  if (resetOn) {
    createEffect(() => {
      if (resetOn()) {
        setCount(0);
        isFirst = true;
        previousValue = undefined;
      }
    });
  }

  createEffect(() => {
    const value = source();

    if (isFirst) {
      isFirst = false;
      previousValue = value;
      return;
    }

    if (!equals(previousValue, value)) {
      setCount((c) => c + 1);
    }
    previousValue = value;
  });

  return count;
}

// ============================================================================
// useHistory Hook
// ============================================================================

/**
 * Tracks the history of a value with configurable depth.
 *
 * @param source - Accessor to track
 * @param options - Configuration options
 * @returns Object with history access and utilities
 *
 * @example
 * ```tsx
 * const [text, setText] = createSignal("");
 * const { history, previous, canGoBack, back } = useHistory(text, {
 *   maxLength: 10,
 * });
 *
 * const handleUndo = () => {
 *   if (canGoBack()) {
 *     const prev = back();
 *     if (prev !== undefined) {
 *       setText(prev);
 *     }
 *   }
 * };
 * ```
 */
export function useHistory<T>(
  source: Accessor<T>,
  options: UseHistoryOptions<T> = {}
): UseHistoryReturn<T> {
  const {
    initialValue,
    maxLength = 10,
    equals = Object.is,
    when,
  } = options;

  interface InternalEntry {
    value: T;
    timestamp: number;
  }

  const [entries, setEntries] = createSignal<InternalEntry[]>(
    initialValue !== undefined
      ? [{ value: initialValue, timestamp: Date.now() }]
      : []
  );

  // Track current value for comparison
  let currentTracked: T | undefined;

  // Add new entry when source changes
  createEffect(() => {
    const value = source();

    // Check condition
    if (when && !when(value)) {
      return;
    }

    // Skip if equal to current tracked value
    if (currentTracked !== undefined && equals(currentTracked, value)) {
      return;
    }

    currentTracked = value;

    setEntries((prev) => {
      const newEntry: InternalEntry = {
        value,
        timestamp: Date.now(),
      };

      const newEntries = [...prev, newEntry];

      // Trim to max length
      if (newEntries.length > maxLength) {
        return newEntries.slice(-maxLength);
      }

      return newEntries;
    });
  });

  // Computed values
  const current = createMemo(() => {
    const e = entries();
    return e.length > 0 ? e[e.length - 1].value : source();
  });

  const previous = createMemo(() => {
    const e = entries();
    return e.length > 1 ? e[e.length - 2].value : undefined;
  });

  const history = createMemo(() => entries().map((e) => e.value));

  const historyWithTimestamps = createMemo((): HistoryEntry<T>[] =>
    entries().map((e) => ({ value: e.value, timestamp: e.timestamp }))
  );

  const canGoBack = createMemo(() => entries().length > 1);

  /**
   * Go back n steps and return the value
   */
  const back = (steps: number = 1): T | undefined => {
    const e = entries();
    const index = e.length - 1 - steps;

    if (index < 0 || index >= e.length) {
      return undefined;
    }

    return e[index].value;
  };

  /**
   * Clear history
   */
  const clear = (): void => {
    setEntries([]);
    currentTracked = undefined;
  };

  /**
   * Get value at index (0 = current, 1 = previous, etc.)
   */
  const at = (index: number): T | undefined => {
    const e = entries();
    const actualIndex = e.length - 1 - index;

    if (actualIndex < 0 || actualIndex >= e.length) {
      return undefined;
    }

    return e[actualIndex].value;
  };

  return {
    current,
    previous,
    history,
    historyWithTimestamps,
    back,
    canGoBack,
    clear,
    at,
  };
}

// ============================================================================
// useFirstRender Hook
// ============================================================================

/**
 * Returns whether this is the first render of the component.
 *
 * @returns Accessor indicating if first render
 *
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const isFirstRender = useFirstRender();
 *
 *   return (
 *     <div class={isFirstRender() ? "fade-in" : "instant"}>
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useFirstRender(): Accessor<boolean> {
  const [isFirst, setIsFirst] = createSignal(true);

  createEffect(() => {
    // After first effect runs, mark as no longer first
    setIsFirst(false);
  });

  return isFirst;
}

// ============================================================================
// useLatest Hook
// ============================================================================

/**
 * Returns a ref-like accessor that always has the latest value,
 * but doesn't trigger reactivity when read.
 *
 * @param source - Accessor to track
 * @returns Accessor to latest value (non-reactive read)
 *
 * @example
 * ```tsx
 * function EventHandler() {
 *   const [count, setCount] = createSignal(0);
 *   const latestCount = useLatest(count);
 *
 *   const handleClick = () => {
 *     // Always gets the latest count without causing re-render
 *     console.log("Current count:", latestCount());
 *   };
 *
 *   return <button onClick={handleClick}>Log Count</button>;
 * }
 * ```
 */
export function useLatest<T>(source: Accessor<T>): Accessor<T> {
  let latestValue = untrack(source);

  createEffect(() => {
    latestValue = source();
  });

  return () => latestValue;
}

// ============================================================================
// useChangedProps Hook
// ============================================================================

/**
 * Tracks which properties of an object have changed.
 * Useful for debugging component re-renders.
 *
 * @param source - Accessor returning an object
 * @returns Accessor to array of changed property names
 *
 * @example
 * ```tsx
 * function MyComponent(props: { a: number; b: string; c: boolean }) {
 *   const changedProps = useChangedProps(() => props);
 *
 *   createEffect(() => {
 *     const changed = changedProps();
 *     if (changed.length > 0) {
 *       console.log("Changed props:", changed);
 *     }
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useChangedProps<T extends Record<string, unknown>>(
  source: Accessor<T>
): Accessor<(keyof T)[]> {
  const [changedKeys, setChangedKeys] = createSignal<(keyof T)[]>([]);
  let previousValues: T | undefined;

  createEffect(() => {
    const current = source();

    if (previousValues === undefined) {
      previousValues = { ...current };
      setChangedKeys([]);
      return;
    }

    const changed: (keyof T)[] = [];

    // Check all keys in current
    for (const key of Object.keys(current) as (keyof T)[]) {
      if (!Object.is(current[key], previousValues[key])) {
        changed.push(key);
      }
    }

    // Check for removed keys
    for (const key of Object.keys(previousValues) as (keyof T)[]) {
      if (!(key in current) && !changed.includes(key)) {
        changed.push(key);
      }
    }

    setChangedKeys(changed);
    previousValues = { ...current };
  });

  return changedKeys;
}

// ============================================================================
// useDelta Hook
// ============================================================================

/**
 * Calculates the delta (difference) between current and previous numeric value.
 *
 * @param source - Accessor to a numeric value
 * @returns Accessor to the delta value
 *
 * @example
 * ```tsx
 * const [price, setPrice] = createSignal(100);
 * const priceDelta = useDelta(price);
 *
 * return (
 *   <div>
 *     <p>Price: ${price()}</p>
 *     <p class={priceDelta() > 0 ? "up" : "down"}>
 *       Change: {priceDelta() > 0 ? "+" : ""}{priceDelta()}
 *     </p>
 *   </div>
 * );
 * ```
 */
export function useDelta(source: Accessor<number>): Accessor<number> {
  const [delta, setDelta] = createSignal(0);
  let previousValue: number | undefined;

  createEffect(() => {
    const value = source();

    if (previousValue !== undefined) {
      setDelta(value - previousValue);
    }

    previousValue = value;
  });

  return delta;
}

// ============================================================================
// Default Export
// ============================================================================

export default usePrevious;

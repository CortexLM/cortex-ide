/**
 * useLocalStorage - Typed localStorage hook with SolidJS signals
 *
 * Provides reactive localStorage access with proper TypeScript generics,
 * JSON serialization, error handling, and cross-tab synchronization.
 *
 * Features:
 * - Full TypeScript generic support with type inference
 * - Automatic JSON serialization/deserialization
 * - Cross-tab synchronization via storage events
 * - Graceful error handling for quota exceeded and parse errors
 * - SSR-safe with fallback to default values
 * - Optional schema validation callback
 *
 * @example
 * ```tsx
 * function Settings() {
 *   const [theme, setTheme] = useLocalStorage("app-theme", "dark");
 *   const [settings, setSettings] = useLocalStorage<UserSettings>("user-settings", {
 *     notifications: true,
 *     fontSize: 14,
 *   });
 *
 *   return (
 *     <div>
 *       <select value={theme()} onChange={(e) => setTheme(e.target.value)}>
 *         <option value="dark">Dark</option>
 *         <option value="light">Light</option>
 *       </select>
 *       <button onClick={() => setSettings((s) => ({ ...s, fontSize: s.fontSize + 1 }))}>
 *         Increase Font Size ({settings().fontSize})
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  createEffect,
  onCleanup,
  type Accessor,
  type Setter,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

/** Options for useLocalStorage hook */
export interface UseLocalStorageOptions<T> {
  /** Custom serializer function (default: JSON.stringify) */
  serializer?: (value: T) => string;
  /** Custom deserializer function (default: JSON.parse) */
  deserializer?: (value: string) => T;
  /** Enable cross-tab synchronization (default: true) */
  syncTabs?: boolean;
  /** Validation function for loaded values */
  validate?: (value: unknown) => value is T;
  /** Callback when storage operation fails */
  onError?: (error: Error, operation: "read" | "write") => void;
  /** Storage instance to use (default: localStorage) */
  storage?: Storage;
}

/** Return type for useLocalStorage */
export type UseLocalStorageReturn<T> = [
  /** Reactive accessor for the stored value */
  Accessor<T>,
  /** Setter function that updates both signal and storage */
  Setter<T>,
  /** Utility functions */
  {
    /** Remove the item from storage */
    remove: () => void;
    /** Check if key exists in storage */
    exists: () => boolean;
    /** Force refresh from storage */
    refresh: () => void;
  },
];

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Safely parse JSON with error handling
 */
function safeJsonParse<T>(
  value: string,
  fallback: T,
  validate?: (value: unknown) => value is T
): T {
  try {
    const parsed = JSON.parse(value);
    if (validate && !validate(parsed)) {
      console.warn("[useLocalStorage] Validation failed for stored value");
      return fallback;
    }
    return parsed as T;
  } catch (error) {
    console.warn("[useLocalStorage] Failed to parse stored value:", error);
    return fallback;
  }
}

/**
 * Safely stringify value with error handling
 */
function safeJsonStringify<T>(value: T): string | null {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error("[useLocalStorage] Failed to stringify value:", error);
    return null;
  }
}

// ============================================================================
// useLocalStorage Hook
// ============================================================================

/**
 * Hook for reactive localStorage access with SolidJS signals
 *
 * @param key - The localStorage key to use
 * @param defaultValue - Default value if key doesn't exist
 * @param options - Configuration options
 * @returns Tuple of [accessor, setter, utilities]
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: UseLocalStorageOptions<T> = {}
): UseLocalStorageReturn<T> {
  const {
    serializer = safeJsonStringify,
    deserializer = (s: string) => safeJsonParse(s, defaultValue, options.validate),
    syncTabs = true,
    validate,
    onError,
    storage = isBrowser() ? window.localStorage : undefined,
  } = options;

  // ============================================================================
  // State Initialization
  // ============================================================================

  /**
   * Read initial value from storage
   */
  const readValue = (): T => {
    if (!storage) {
      return defaultValue;
    }

    try {
      const item = storage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return deserializer(item);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[useLocalStorage] Error reading key "${key}":`, err);
      onError?.(err, "read");
      return defaultValue;
    }
  };

  const [storedValue, setStoredValue] = createSignal<T>(readValue());

  // ============================================================================
  // Storage Operations
  // ============================================================================

  /**
   * Write value to storage
   */
  const writeValue = (value: T): boolean => {
    if (!storage) {
      return false;
    }

    try {
      const serialized = serializer(value);
      if (serialized === null) {
        return false;
      }
      storage.setItem(key, serialized);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check for quota exceeded error
      if (
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" ||
          error.name === "NS_ERROR_DOM_QUOTA_REACHED")
      ) {
        console.error(`[useLocalStorage] Storage quota exceeded for key "${key}"`);
      } else {
        console.error(`[useLocalStorage] Error writing key "${key}":`, err);
      }

      onError?.(err, "write");
      return false;
    }
  };

  /**
   * Remove item from storage
   */
  const removeValue = (): void => {
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(key);
      setStoredValue(() => defaultValue);
    } catch (error) {
      console.error(`[useLocalStorage] Error removing key "${key}":`, error);
    }
  };

  /**
   * Check if key exists in storage
   */
  const keyExists = (): boolean => {
    if (!storage) {
      return false;
    }
    return storage.getItem(key) !== null;
  };

  /**
   * Force refresh from storage
   */
  const refreshValue = (): void => {
    setStoredValue(readValue);
  };

  // ============================================================================
  // Setter Implementation
  // ============================================================================

  /**
   * Custom setter that updates both signal and storage
   */
  const setValue: Setter<T> = ((
    valueOrFn: T | ((prev: T) => T)
  ): T | undefined => {
    const currentValue = storedValue();
    const newValue =
      typeof valueOrFn === "function"
        ? (valueOrFn as (prev: T) => T)(currentValue)
        : valueOrFn;

    // Validate new value if validator provided
    if (validate && !validate(newValue)) {
      console.warn("[useLocalStorage] New value failed validation, not storing");
      return undefined;
    }

    // Update signal
    setStoredValue(() => newValue);

    // Write to storage
    writeValue(newValue);

    return newValue;
  }) as Setter<T>;

  // ============================================================================
  // Cross-Tab Synchronization
  // ============================================================================

  if (syncTabs && isBrowser()) {
    const handleStorageChange = (event: StorageEvent): void => {
      // Only handle changes to our key from other tabs
      if (event.key !== key || event.storageArea !== storage) {
        return;
      }

      // Key was removed
      if (event.newValue === null) {
        setStoredValue(() => defaultValue);
        return;
      }

      // Parse and update value
      try {
        const newValue = deserializer(event.newValue);
        if (validate && !validate(newValue)) {
          return;
        }
        setStoredValue(() => newValue);
      } catch (error) {
        console.warn("[useLocalStorage] Failed to sync from storage event:", error);
      }
    };

    // Setup storage event listener
    createEffect(() => {
      window.addEventListener("storage", handleStorageChange);
      onCleanup(() => {
        window.removeEventListener("storage", handleStorageChange);
      });
    });
  }

  // ============================================================================
  // Return
  // ============================================================================

  return [
    storedValue,
    setValue,
    {
      remove: removeValue,
      exists: keyExists,
      refresh: refreshValue,
    },
  ];
}

// ============================================================================
// Specialized Variants
// ============================================================================

/**
 * Hook for storing boolean values in localStorage
 *
 * @example
 * ```tsx
 * const [isEnabled, setIsEnabled, { toggle }] = useLocalStorageBoolean("feature-enabled", false);
 * ```
 */
export function useLocalStorageBoolean(
  key: string,
  defaultValue: boolean,
  options: Omit<UseLocalStorageOptions<boolean>, "validate"> = {}
): [
  Accessor<boolean>,
  Setter<boolean>,
  {
    remove: () => void;
    exists: () => boolean;
    refresh: () => void;
    toggle: () => void;
  },
] {
  const [value, setValue, utils] = useLocalStorage(key, defaultValue, {
    ...options,
    validate: (v): v is boolean => typeof v === "boolean",
  });

  const toggle = () => {
    setValue((prev) => !prev);
  };

  return [value, setValue, { ...utils, toggle }];
}

/**
 * Hook for storing number values in localStorage with optional min/max bounds
 *
 * @example
 * ```tsx
 * const [count, setCount, { increment, decrement }] = useLocalStorageNumber(
 *   "counter",
 *   0,
 *   { min: 0, max: 100 }
 * );
 * ```
 */
export function useLocalStorageNumber(
  key: string,
  defaultValue: number,
  options: Omit<UseLocalStorageOptions<number>, "validate"> & {
    min?: number;
    max?: number;
    step?: number;
  } = {}
): [
  Accessor<number>,
  Setter<number>,
  {
    remove: () => void;
    exists: () => boolean;
    refresh: () => void;
    increment: (amount?: number) => void;
    decrement: (amount?: number) => void;
    clamp: (value: number) => number;
  },
] {
  const { min, max, step = 1, ...restOptions } = options;

  const clamp = (value: number): number => {
    let clamped = value;
    if (min !== undefined) {
      clamped = Math.max(min, clamped);
    }
    if (max !== undefined) {
      clamped = Math.min(max, clamped);
    }
    return clamped;
  };

  const validate = (v: unknown): v is number => {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return false;
    }
    return v === clamp(v);
  };

  const [value, setValue, utils] = useLocalStorage(key, clamp(defaultValue), {
    ...restOptions,
    validate,
  });

  const increment = (amount = step): void => {
    setValue((prev) => clamp(prev + amount));
  };

  const decrement = (amount = step): void => {
    setValue((prev) => clamp(prev - amount));
  };

  return [value, setValue, { ...utils, increment, decrement, clamp }];
}

/**
 * Hook for storing string values in localStorage with optional pattern validation
 *
 * @example
 * ```tsx
 * const [email, setEmail] = useLocalStorageString("user-email", "", {
 *   pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
 * });
 * ```
 */
export function useLocalStorageString(
  key: string,
  defaultValue: string,
  options: Omit<UseLocalStorageOptions<string>, "validate" | "serializer" | "deserializer"> & {
    pattern?: RegExp;
    maxLength?: number;
    trim?: boolean;
  } = {}
): UseLocalStorageReturn<string> {
  const { pattern, maxLength, trim = false, ...restOptions } = options;

  const validate = (v: unknown): v is string => {
    if (typeof v !== "string") {
      return false;
    }
    if (pattern && !pattern.test(v)) {
      return false;
    }
    if (maxLength !== undefined && v.length > maxLength) {
      return false;
    }
    return true;
  };

  const [value, setValueBase, utils] = useLocalStorage(key, defaultValue, {
    ...restOptions,
    validate,
    // Use simple string storage for strings
    serializer: (v) => (trim ? v.trim() : v),
    deserializer: (v) => (trim ? v.trim() : v),
  });

  const setValue: Setter<string> = ((valueOrFn: string | ((prev: string) => string)) => {
    if (typeof valueOrFn === "function") {
      return setValueBase((prev) => {
        let newValue = valueOrFn(prev);
        if (trim) newValue = newValue.trim();
        if (maxLength !== undefined) newValue = newValue.slice(0, maxLength);
        return newValue;
      });
    } else {
      let newValue = valueOrFn;
      if (trim) newValue = newValue.trim();
      if (maxLength !== undefined) newValue = newValue.slice(0, maxLength);
      return setValueBase(newValue);
    }
  }) as Setter<string>;

  return [value, setValue, utils];
}

/**
 * Hook for storing arrays in localStorage with size limits
 *
 * @example
 * ```tsx
 * const [items, setItems, { push, pop, clear }] = useLocalStorageArray<string>(
 *   "recent-items",
 *   [],
 *   { maxLength: 10 }
 * );
 * ```
 */
export function useLocalStorageArray<T>(
  key: string,
  defaultValue: T[],
  options: Omit<UseLocalStorageOptions<T[]>, "validate"> & {
    maxLength?: number;
    itemValidator?: (item: unknown) => item is T;
  } = {}
): [
  Accessor<T[]>,
  Setter<T[]>,
  {
    remove: () => void;
    exists: () => boolean;
    refresh: () => void;
    push: (...items: T[]) => void;
    pop: () => T | undefined;
    shift: () => T | undefined;
    unshift: (...items: T[]) => void;
    clear: () => void;
    removeAt: (index: number) => void;
    filter: (predicate: (item: T) => boolean) => void;
  },
] {
  const { maxLength, itemValidator, ...restOptions } = options;

  const validate = (v: unknown): v is T[] => {
    if (!Array.isArray(v)) {
      return false;
    }
    if (maxLength !== undefined && v.length > maxLength) {
      return false;
    }
    if (itemValidator) {
      return v.every(itemValidator);
    }
    return true;
  };

  const [value, setValue, utils] = useLocalStorage(key, defaultValue, {
    ...restOptions,
    validate,
  });

  const push = (...items: T[]): void => {
    setValue((prev) => {
      const newArray = [...prev, ...items];
      if (maxLength !== undefined) {
        return newArray.slice(-maxLength);
      }
      return newArray;
    });
  };

  const pop = (): T | undefined => {
    let popped: T | undefined;
    setValue((prev) => {
      const newArray = [...prev];
      popped = newArray.pop();
      return newArray;
    });
    return popped;
  };

  const shift = (): T | undefined => {
    let shifted: T | undefined;
    setValue((prev) => {
      const newArray = [...prev];
      shifted = newArray.shift();
      return newArray;
    });
    return shifted;
  };

  const unshift = (...items: T[]): void => {
    setValue((prev) => {
      const newArray = [...items, ...prev];
      if (maxLength !== undefined) {
        return newArray.slice(0, maxLength);
      }
      return newArray;
    });
  };

  const clear = (): void => {
    setValue([]);
  };

  const removeAt = (index: number): void => {
    setValue((prev) => {
      if (index < 0 || index >= prev.length) {
        return prev;
      }
      const newArray = [...prev];
      newArray.splice(index, 1);
      return newArray;
    });
  };

  const filter = (predicate: (item: T) => boolean): void => {
    setValue((prev) => prev.filter(predicate));
  };

  return [
    value,
    setValue,
    {
      ...utils,
      push,
      pop,
      shift,
      unshift,
      clear,
      removeAt,
      filter,
    },
  ];
}

// ============================================================================
// Default Export
// ============================================================================

export default useLocalStorage;

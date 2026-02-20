/**
 * useResizeObserver - Reactive element size tracking with SolidJS
 *
 * Provides a performant way to observe element size changes using the
 * ResizeObserver API with proper cleanup and TypeScript support.
 *
 * Features:
 * - Full TypeScript support with size types
 * - Automatic cleanup on unmount
 * - Support for multiple elements
 * - Border-box and content-box size options
 * - Debounced/throttled callbacks optional
 * - SSR-safe with fallback behavior
 *
 * @example
 * ```tsx
 * function ResizablePanel() {
 *   let containerRef: HTMLDivElement;
 *
 *   const { width, height, contentRect } = useResizeObserver(() => containerRef);
 *
 *   return (
 *     <div ref={containerRef} style={{ resize: "both", overflow: "auto" }}>
 *       Size: {width()}x{height()}
 *     </div>
 *   );
 * }
 * ```
 */

import {
  createSignal,
  createEffect,
  onCleanup,
  batch,
  type Accessor,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

/** Size dimensions */
export interface Size {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/** Full resize entry information */
export interface ResizeInfo extends Size {
  /** The observed element */
  target: Element | null;
  /** Content box size */
  contentBoxSize: Size;
  /** Border box size */
  borderBoxSize: Size;
  /** Content rect (legacy) */
  contentRect: DOMRectReadOnly | null;
  /** Device pixel content box size (if available) */
  devicePixelContentBoxSize: Size | null;
}

/** Options for useResizeObserver */
export interface ResizeObserverOptions {
  /** Which box model to observe (default: "content-box") */
  box?: ResizeObserverBoxOptions;
  /** Callback when size changes */
  onResize?: (entry: ResizeInfo) => void;
  /** Whether the observer is enabled (default: true) */
  enabled?: boolean;
  /** Initial size before first observation */
  initialSize?: Size;
}

/** Return type for useResizeObserver */
export interface UseResizeObserverReturn {
  /** Current width */
  width: Accessor<number>;
  /** Current height */
  height: Accessor<number>;
  /** Current content rect */
  contentRect: Accessor<DOMRectReadOnly | null>;
  /** Full resize information */
  resizeInfo: Accessor<ResizeInfo | null>;
  /** Whether currently observing */
  isObserving: Accessor<boolean>;
  /** Manually trigger a size check */
  refresh: () => void;
}

/** Options for observing multiple elements */
export interface MultiResizeObserverOptions {
  /** Which box model to observe (default: "content-box") */
  box?: ResizeObserverBoxOptions;
  /** Callback when any element's size changes */
  onResize?: (entries: Map<Element, ResizeInfo>) => void;
  /** Whether the observer is enabled (default: true) */
  enabled?: boolean;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Extract size from ResizeObserverSize array
 */
function extractSize(sizes: readonly ResizeObserverSize[] | undefined): Size {
  if (!sizes || sizes.length === 0) {
    return { width: 0, height: 0 };
  }
  const size = sizes[0];
  return {
    width: size.inlineSize,
    height: size.blockSize,
  };
}

/**
 * Create ResizeInfo from ResizeObserverEntry
 */
function createResizeInfo(entry: ResizeObserverEntry): ResizeInfo {
  const contentBoxSize = extractSize(entry.contentBoxSize);
  const borderBoxSize = extractSize(entry.borderBoxSize);
  const devicePixelContentBoxSize = entry.devicePixelContentBoxSize
    ? extractSize(entry.devicePixelContentBoxSize)
    : null;

  return {
    target: entry.target,
    width: entry.contentRect.width,
    height: entry.contentRect.height,
    contentBoxSize,
    borderBoxSize,
    contentRect: entry.contentRect,
    devicePixelContentBoxSize,
  };
}

/**
 * Get initial size from element
 */
function getElementSize(element: Element | null | undefined): Size {
  if (!element) {
    return { width: 0, height: 0 };
  }
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

/**
 * Check if ResizeObserver is supported
 */
function isResizeObserverSupported(): boolean {
  return typeof window !== "undefined" && "ResizeObserver" in window;
}

// ============================================================================
// useResizeObserver Hook
// ============================================================================

/**
 * Observes size changes of a single element.
 *
 * @param target - Accessor returning the element to observe
 * @param options - Configuration options
 * @returns Object with reactive size values and utilities
 *
 * @example
 * ```tsx
 * let panelRef: HTMLDivElement;
 *
 * const { width, height } = useResizeObserver(() => panelRef);
 *
 * createEffect(() => {
 *   console.log("Panel size:", width(), height());
 * });
 *
 * return <div ref={panelRef}>Content</div>;
 * ```
 */
export function useResizeObserver(
  target: Accessor<Element | null | undefined>,
  options: ResizeObserverOptions = {}
): UseResizeObserverReturn {
  const {
    box = "content-box",
    onResize,
    enabled = true,
    initialSize = { width: 0, height: 0 },
  } = options;

  // State
  const [width, setWidth] = createSignal(initialSize.width);
  const [height, setHeight] = createSignal(initialSize.height);
  const [contentRect, setContentRect] = createSignal<DOMRectReadOnly | null>(null);
  const [resizeInfo, setResizeInfo] = createSignal<ResizeInfo | null>(null);
  const [isObserving, setIsObserving] = createSignal(false);

  // Observer reference
  let observer: ResizeObserver | null = null;
  let currentElement: Element | null = null;

  /**
   * Handle resize entries
   */
  const handleResize = (entries: ResizeObserverEntry[]): void => {
    for (const entry of entries) {
      if (entry.target === currentElement) {
        const info = createResizeInfo(entry);

        batch(() => {
          setWidth(info.width);
          setHeight(info.height);
          setContentRect(info.contentRect);
          setResizeInfo(info);
        });

        onResize?.(info);
        break;
      }
    }
  };

  /**
   * Start observing an element
   */
  const observe = (element: Element): void => {
    if (!isResizeObserverSupported()) {
      // Fallback: just get initial size
      const size = getElementSize(element);
      batch(() => {
        setWidth(size.width);
        setHeight(size.height);
      });
      return;
    }

    // Create observer if needed
    if (!observer) {
      observer = new ResizeObserver(handleResize);
    }

    // Stop observing previous element
    if (currentElement && currentElement !== element) {
      observer.unobserve(currentElement);
    }

    // Start observing new element
    currentElement = element;
    observer.observe(element, { box });
    setIsObserving(true);

    // Get initial size
    const size = getElementSize(element);
    batch(() => {
      setWidth(size.width);
      setHeight(size.height);
    });
  };

  /**
   * Stop observing
   */
  const disconnect = (): void => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    currentElement = null;
    setIsObserving(false);
  };

  /**
   * Manually refresh size
   */
  const refresh = (): void => {
    const element = target();
    if (element) {
      const size = getElementSize(element);
      batch(() => {
        setWidth(size.width);
        setHeight(size.height);
      });
    }
  };

  // Setup effect
  createEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    const element = target();

    if (element) {
      observe(element);
    } else {
      disconnect();
      batch(() => {
        setWidth(initialSize.width);
        setHeight(initialSize.height);
        setContentRect(null);
        setResizeInfo(null);
      });
    }
  });

  // Cleanup
  onCleanup(disconnect);

  return {
    width,
    height,
    contentRect,
    resizeInfo,
    isObserving,
    refresh,
  };
}

// ============================================================================
// useElementSize Hook (Simplified)
// ============================================================================

/**
 * Simplified hook that just returns width and height.
 *
 * @param target - Accessor returning the element to observe
 * @param options - Configuration options
 * @returns Tuple of [width, height] accessors
 *
 * @example
 * ```tsx
 * let containerRef: HTMLDivElement;
 * const [width, height] = useElementSize(() => containerRef);
 *
 * return (
 *   <div ref={containerRef}>
 *     {width()}x{height()}
 *   </div>
 * );
 * ```
 */
export function useElementSize(
  target: Accessor<Element | null | undefined>,
  options: Omit<ResizeObserverOptions, "onResize"> = {}
): [Accessor<number>, Accessor<number>] {
  const { width, height } = useResizeObserver(target, options);
  return [width, height];
}

// ============================================================================
// useMultiResizeObserver Hook
// ============================================================================

/**
 * Observes size changes of multiple elements with a single observer.
 *
 * @param targets - Accessor returning array of elements to observe
 * @param options - Configuration options
 * @returns Map of element sizes and utility functions
 *
 * @example
 * ```tsx
 * const { sizes, observe, unobserve } = useMultiResizeObserver(
 *   () => [panel1Ref, panel2Ref, panel3Ref].filter(Boolean),
 *   {
 *     onResize: (entries) => {
 *       entries.forEach((info, element) => {
 *         console.log(element, info.width, info.height);
 *       });
 *     },
 *   }
 * );
 * ```
 */
export function useMultiResizeObserver(
  targets: Accessor<(Element | null | undefined)[]>,
  options: MultiResizeObserverOptions = {}
): {
  sizes: Accessor<Map<Element, ResizeInfo>>;
  observe: (element: Element) => void;
  unobserve: (element: Element) => void;
  disconnect: () => void;
} {
  const { box = "content-box", onResize, enabled = true } = options;

  // State
  const [sizes, setSizes] = createSignal<Map<Element, ResizeInfo>>(new Map());

  // Observer reference
  let observer: ResizeObserver | null = null;
  const observedElements = new Set<Element>();

  /**
   * Handle resize entries
   */
  const handleResize = (entries: ResizeObserverEntry[]): void => {
    const newSizes = new Map(sizes());
    let hasChanges = false;

    for (const entry of entries) {
      const info = createResizeInfo(entry);
      newSizes.set(entry.target, info);
      hasChanges = true;
    }

    if (hasChanges) {
      setSizes(newSizes);
      onResize?.(newSizes);
    }
  };

  /**
   * Create observer if needed
   */
  const ensureObserver = (): ResizeObserver | null => {
    if (!isResizeObserverSupported()) {
      return null;
    }

    if (!observer) {
      observer = new ResizeObserver(handleResize);
    }

    return observer;
  };

  /**
   * Observe an element
   */
  const observe = (element: Element): void => {
    const obs = ensureObserver();
    if (!obs || observedElements.has(element)) {
      return;
    }

    observedElements.add(element);
    obs.observe(element, { box });

    // Get initial size
    const rect = element.getBoundingClientRect();
    const info: ResizeInfo = {
      target: element,
      width: rect.width,
      height: rect.height,
      contentBoxSize: { width: rect.width, height: rect.height },
      borderBoxSize: { width: rect.width, height: rect.height },
      contentRect: null,
      devicePixelContentBoxSize: null,
    };

    setSizes((prev) => {
      const next = new Map(prev);
      next.set(element, info);
      return next;
    });
  };

  /**
   * Stop observing an element
   */
  const unobserve = (element: Element): void => {
    if (!observer || !observedElements.has(element)) {
      return;
    }

    observedElements.delete(element);
    observer.unobserve(element);

    setSizes((prev) => {
      const next = new Map(prev);
      next.delete(element);
      return next;
    });
  };

  /**
   * Stop observing all elements
   */
  const disconnect = (): void => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    observedElements.clear();
    setSizes(new Map());
  };

  // Setup effect to track targets
  createEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    const elements = targets().filter((el): el is Element => el != null);
    const elementsSet = new Set(elements);

    // Unobserve removed elements
    for (const el of observedElements) {
      if (!elementsSet.has(el)) {
        unobserve(el);
      }
    }

    // Observe new elements
    for (const el of elements) {
      if (!observedElements.has(el)) {
        observe(el);
      }
    }
  });

  // Cleanup
  onCleanup(disconnect);

  return {
    sizes,
    observe,
    unobserve,
    disconnect,
  };
}

// ============================================================================
// useWindowSize Hook
// ============================================================================

/**
 * Tracks window size with reactive signals.
 *
 * @param options - Configuration options
 * @returns Object with width and height accessors
 *
 * @example
 * ```tsx
 * const { width, height, isMobile, isTablet, isDesktop } = useWindowSize();
 *
 * return (
 *   <div>
 *     Window: {width()}x{height()}
 *     {isMobile() && <MobileNav />}
 *   </div>
 * );
 * ```
 */
export function useWindowSize(options: {
  /** Throttle interval in ms (0 = no throttle) */
  throttle?: number;
  /** Mobile breakpoint (default: 768) */
  mobileBreakpoint?: number;
  /** Tablet breakpoint (default: 1024) */
  tabletBreakpoint?: number;
} = {}): {
  width: Accessor<number>;
  height: Accessor<number>;
  isMobile: Accessor<boolean>;
  isTablet: Accessor<boolean>;
  isDesktop: Accessor<boolean>;
} {
  const {
    throttle = 0,
    mobileBreakpoint = 768,
    tabletBreakpoint = 1024,
  } = options;

  const getSize = (): Size => ({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  const [size, setSize] = createSignal<Size>(getSize());

  // Throttle state
  let lastUpdate = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const updateSize = (): void => {
    const now = Date.now();

    if (throttle === 0 || now - lastUpdate >= throttle) {
      setSize(getSize());
      lastUpdate = now;
    } else if (!timeoutId) {
      const remaining = throttle - (now - lastUpdate);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        setSize(getSize());
        lastUpdate = Date.now();
      }, remaining);
    }
  };

  createEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener("resize", updateSize);

    onCleanup(() => {
      window.removeEventListener("resize", updateSize);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  });

  return {
    width: () => size().width,
    height: () => size().height,
    isMobile: () => size().width < mobileBreakpoint,
    isTablet: () => size().width >= mobileBreakpoint && size().width < tabletBreakpoint,
    isDesktop: () => size().width >= tabletBreakpoint,
  };
}

// ============================================================================
// useContainerQuery Hook
// ============================================================================

/**
 * Provides container query-like functionality with breakpoints.
 *
 * @param target - Accessor returning the container element
 * @param breakpoints - Breakpoint definitions
 * @returns Active breakpoints
 *
 * @example
 * ```tsx
 * let containerRef: HTMLDivElement;
 *
 * const { isSmall, isMedium, isLarge, activeBreakpoint } = useContainerQuery(
 *   () => containerRef,
 *   { small: 0, medium: 400, large: 800 }
 * );
 *
 * return (
 *   <div ref={containerRef} class={activeBreakpoint()}>
 *     {isSmall() && <CompactView />}
 *     {isMedium() && <StandardView />}
 *     {isLarge() && <ExpandedView />}
 *   </div>
 * );
 * ```
 */
export function useContainerQuery<T extends Record<string, number>>(
  target: Accessor<Element | null | undefined>,
  breakpoints: T
): {
  [K in keyof T as `is${Capitalize<string & K>}`]: Accessor<boolean>;
} & {
  activeBreakpoint: Accessor<keyof T | null>;
  width: Accessor<number>;
  height: Accessor<number>;
} {
  const { width, height } = useResizeObserver(target);

  // Sort breakpoints by value descending
  const sortedBreakpoints = Object.entries(breakpoints)
    .sort(([, a], [, b]) => b - a) as [keyof T, number][];

  // Create breakpoint checkers
  const result: Record<string, unknown> = {
    activeBreakpoint: () => {
      const w = width();
      for (const [name, minWidth] of sortedBreakpoints) {
        if (w >= minWidth) {
          return name;
        }
      }
      return null;
    },
    width,
    height,
  };

  // Add individual breakpoint accessors
  for (const [name, minWidth] of sortedBreakpoints) {
    const capitalizedName = name.toString().charAt(0).toUpperCase() + name.toString().slice(1);
    result[`is${capitalizedName}`] = () => width() >= minWidth;
  }

  return result as {
    [K in keyof T as `is${Capitalize<string & K>}`]: Accessor<boolean>;
  } & {
    activeBreakpoint: Accessor<keyof T | null>;
    width: Accessor<number>;
    height: Accessor<number>;
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useResizeObserver;

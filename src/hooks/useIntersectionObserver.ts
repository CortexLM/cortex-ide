/**
 * useIntersectionObserver - Reactive intersection observation with SolidJS
 *
 * Provides a performant way to observe element visibility and intersection
 * with viewport or container elements using the IntersectionObserver API.
 *
 * Features:
 * - Full TypeScript support
 * - Automatic cleanup on unmount
 * - Support for multiple elements
 * - Configurable thresholds and root margins
 * - Lazy loading and infinite scroll support
 * - SSR-safe with fallback behavior
 *
 * @example
 * ```tsx
 * function LazyImage(props: { src: string }) {
 *   let imageRef: HTMLImageElement;
 *   const { isIntersecting, hasIntersected } = useIntersectionObserver(
 *     () => imageRef,
 *     { threshold: 0.1 }
 *   );
 *
 *   return (
 *     <img
 *       ref={imageRef}
 *       src={hasIntersected() ? props.src : "/placeholder.jpg"}
 *       style={{ opacity: isIntersecting() ? 1 : 0.5 }}
 *     />
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

/** Intersection entry information */
export interface IntersectionInfo {
  /** Whether the element is currently intersecting */
  isIntersecting: boolean;
  /** The intersection ratio (0-1) */
  intersectionRatio: number;
  /** The intersection rectangle */
  intersectionRect: DOMRectReadOnly | null;
  /** The target element's bounding rect */
  boundingClientRect: DOMRectReadOnly | null;
  /** The root element's bounding rect */
  rootBounds: DOMRectReadOnly | null;
  /** The target element */
  target: Element | null;
  /** Timestamp of the intersection change */
  time: number;
}

/** Options for useIntersectionObserver */
export interface IntersectionObserverOptions {
  /** Root element for intersection (default: viewport) */
  root?: Element | Document | null | Accessor<Element | Document | null>;
  /** Margin around the root (default: "0px") */
  rootMargin?: string;
  /** Threshold(s) at which to trigger callback (default: 0) */
  threshold?: number | number[];
  /** Whether the observer is enabled (default: true) */
  enabled?: boolean;
  /** Only trigger once when first intersecting */
  triggerOnce?: boolean;
  /** Callback when intersection changes */
  onChange?: (entry: IntersectionInfo) => void;
  /** Initial intersection state */
  initialIsIntersecting?: boolean;
}

/** Return type for useIntersectionObserver */
export interface UseIntersectionObserverReturn {
  /** Whether the element is currently intersecting */
  isIntersecting: Accessor<boolean>;
  /** Whether the element has ever intersected */
  hasIntersected: Accessor<boolean>;
  /** Current intersection ratio (0-1) */
  intersectionRatio: Accessor<number>;
  /** Full intersection entry information */
  entry: Accessor<IntersectionInfo | null>;
  /** Whether currently observing */
  isObserving: Accessor<boolean>;
  /** Reset the hasIntersected state */
  reset: () => void;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if IntersectionObserver is supported
 */
function isIntersectionObserverSupported(): boolean {
  return typeof window !== "undefined" && "IntersectionObserver" in window;
}

/**
 * Create IntersectionInfo from IntersectionObserverEntry
 */
function createIntersectionInfo(entry: IntersectionObserverEntry): IntersectionInfo {
  return {
    isIntersecting: entry.isIntersecting,
    intersectionRatio: entry.intersectionRatio,
    intersectionRect: entry.intersectionRect,
    boundingClientRect: entry.boundingClientRect,
    rootBounds: entry.rootBounds,
    target: entry.target,
    time: entry.time,
  };
}

/**
 * Resolve root from accessor or value
 */
function resolveRoot(
  root: Element | Document | null | Accessor<Element | Document | null> | undefined
): Element | Document | null {
  if (root === undefined) {
    return null;
  }
  if (typeof root === "function") {
    return root();
  }
  return root;
}

// ============================================================================
// useIntersectionObserver Hook
// ============================================================================

/**
 * Observes intersection of a single element with viewport or container.
 *
 * @param target - Accessor returning the element to observe
 * @param options - Configuration options
 * @returns Object with reactive intersection values and utilities
 *
 * @example
 * ```tsx
 * let sectionRef: HTMLElement;
 *
 * const { isIntersecting, intersectionRatio } = useIntersectionObserver(
 *   () => sectionRef,
 *   {
 *     threshold: [0, 0.25, 0.5, 0.75, 1],
 *     rootMargin: "-100px 0px",
 *   }
 * );
 *
 * return (
 *   <section
 *     ref={sectionRef}
 *     style={{ opacity: intersectionRatio() }}
 *   >
 *     Fading content
 *   </section>
 * );
 * ```
 */
export function useIntersectionObserver(
  target: Accessor<Element | null | undefined>,
  options: IntersectionObserverOptions = {}
): UseIntersectionObserverReturn {
  const {
    root,
    rootMargin = "0px",
    threshold = 0,
    enabled = true,
    triggerOnce = false,
    onChange,
    initialIsIntersecting = false,
  } = options;

  // State
  const [isIntersecting, setIsIntersecting] = createSignal(initialIsIntersecting);
  const [hasIntersected, setHasIntersected] = createSignal(initialIsIntersecting);
  const [intersectionRatio, setIntersectionRatio] = createSignal(0);
  const [entry, setEntry] = createSignal<IntersectionInfo | null>(null);
  const [isObserving, setIsObserving] = createSignal(false);

  // Observer reference
  let observer: IntersectionObserver | null = null;
  let currentElement: Element | null = null;
  let triggered = false;

  /**
   * Handle intersection callback
   */
  const handleIntersection = (entries: IntersectionObserverEntry[]): void => {
    for (const intersectionEntry of entries) {
      if (intersectionEntry.target !== currentElement) {
        continue;
      }

      const info = createIntersectionInfo(intersectionEntry);

      batch(() => {
        setIsIntersecting(info.isIntersecting);
        setIntersectionRatio(info.intersectionRatio);
        setEntry(info);

        if (info.isIntersecting) {
          setHasIntersected(true);

          // Handle triggerOnce
          if (triggerOnce && !triggered) {
            triggered = true;
            disconnect();
          }
        }
      });

      onChange?.(info);
    }
  };

  /**
   * Start observing an element
   */
  const observe = (element: Element): void => {
    if (!isIntersectionObserverSupported()) {
      // Fallback: assume visible
      batch(() => {
        setIsIntersecting(true);
        setHasIntersected(true);
      });
      return;
    }

    const resolvedRoot = resolveRoot(root);

    // Create observer
    observer = new IntersectionObserver(handleIntersection, {
      root: resolvedRoot,
      rootMargin,
      threshold,
    });

    // Stop observing previous element
    if (currentElement && currentElement !== element) {
      observer.unobserve(currentElement);
    }

    // Start observing new element
    currentElement = element;
    observer.observe(element);
    setIsObserving(true);
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
   * Reset state
   */
  const reset = (): void => {
    triggered = false;
    batch(() => {
      setIsIntersecting(false);
      setHasIntersected(false);
      setIntersectionRatio(0);
      setEntry(null);
    });

    // Re-observe if we have an element
    const element = target();
    if (element && enabled) {
      observe(element);
    }
  };

  // Setup effect
  createEffect(() => {
    if (!enabled || triggered) {
      disconnect();
      return;
    }

    const element = target();

    if (element) {
      observe(element);
    } else {
      disconnect();
      batch(() => {
        setIsIntersecting(false);
        setIntersectionRatio(0);
        setEntry(null);
      });
    }
  });

  // Cleanup
  onCleanup(disconnect);

  return {
    isIntersecting,
    hasIntersected,
    intersectionRatio,
    entry,
    isObserving,
    reset,
  };
}

// ============================================================================
// useInView Hook (Simplified)
// ============================================================================

/**
 * Simplified hook that just returns whether an element is in view.
 *
 * @param target - Accessor returning the element to observe
 * @param options - Configuration options
 * @returns Boolean accessor for in-view state
 *
 * @example
 * ```tsx
 * let elementRef: HTMLDivElement;
 * const isInView = useInView(() => elementRef);
 *
 * return (
 *   <div ref={elementRef} class={isInView() ? "visible" : "hidden"}>
 *     Content
 *   </div>
 * );
 * ```
 */
export function useInView(
  target: Accessor<Element | null | undefined>,
  options: Omit<IntersectionObserverOptions, "onChange"> = {}
): Accessor<boolean> {
  const { isIntersecting } = useIntersectionObserver(target, options);
  return isIntersecting;
}

// ============================================================================
// useLazyLoad Hook
// ============================================================================

/**
 * Hook for lazy loading content when it enters the viewport.
 *
 * @param target - Accessor returning the element to observe
 * @param options - Configuration options
 * @returns Object with loading state and trigger info
 *
 * @example
 * ```tsx
 * function LazyComponent(props: { src: string }) {
 *   let containerRef: HTMLDivElement;
 *
 *   const { shouldLoad, isLoaded, markLoaded } = useLazyLoad(
 *     () => containerRef,
 *     { rootMargin: "100px" }
 *   );
 *
 *   return (
 *     <div ref={containerRef}>
 *       <Show when={shouldLoad()} fallback={<Placeholder />}>
 *         <Image
 *           src={props.src}
 *           onLoad={() => markLoaded()}
 *         />
 *       </Show>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLazyLoad(
  target: Accessor<Element | null | undefined>,
  options: Omit<IntersectionObserverOptions, "triggerOnce" | "onChange"> & {
    /** Preload offset from viewport */
    offset?: string;
  } = {}
): {
  shouldLoad: Accessor<boolean>;
  isLoaded: Accessor<boolean>;
  markLoaded: () => void;
  reset: () => void;
} {
  const { offset = "0px", ...restOptions } = options;

  const [isLoaded, setIsLoaded] = createSignal(false);

  const { hasIntersected, reset: resetObserver } = useIntersectionObserver(target, {
    ...restOptions,
    rootMargin: offset,
    triggerOnce: true,
  });

  const markLoaded = (): void => {
    setIsLoaded(true);
  };

  const reset = (): void => {
    setIsLoaded(false);
    resetObserver();
  };

  return {
    shouldLoad: hasIntersected,
    isLoaded,
    markLoaded,
    reset,
  };
}

// ============================================================================
// useInfiniteScroll Hook
// ============================================================================

/**
 * Hook for implementing infinite scroll behavior.
 *
 * @param sentinelTarget - Accessor returning the sentinel element (load trigger)
 * @param onLoadMore - Callback to load more content
 * @param options - Configuration options
 * @returns Object with loading state and utilities
 *
 * @example
 * ```tsx
 * function InfiniteList() {
 *   const [items, setItems] = createSignal<Item[]>([]);
 *   let sentinelRef: HTMLDivElement;
 *
 *   const { isLoading, hasMore, setHasMore } = useInfiniteScroll(
 *     () => sentinelRef,
 *     async () => {
 *       const newItems = await fetchItems(items().length);
 *       setItems([...items(), ...newItems]);
 *       if (newItems.length < PAGE_SIZE) {
 *         setHasMore(false);
 *       }
 *     },
 *     { rootMargin: "200px" }
 *   );
 *
 *   return (
 *     <div>
 *       <For each={items()}>{(item) => <ItemCard item={item} />}</For>
 *       <Show when={hasMore()}>
 *         <div ref={sentinelRef}>
 *           {isLoading() ? "Loading..." : ""}
 *         </div>
 *       </Show>
 *     </div>
 *   );
 * }
 * ```
 */
export function useInfiniteScroll(
  sentinelTarget: Accessor<Element | null | undefined>,
  onLoadMore: () => Promise<void> | void,
  options: Omit<IntersectionObserverOptions, "triggerOnce" | "onChange"> = {}
): {
  isLoading: Accessor<boolean>;
  hasMore: Accessor<boolean>;
  setHasMore: (value: boolean) => void;
  error: Accessor<Error | null>;
  retry: () => void;
} {
  const [isLoading, setIsLoading] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);

  const { isIntersecting } = useIntersectionObserver(sentinelTarget, {
    ...options,
    enabled: options.enabled !== false && hasMore(),
  });

  /**
   * Load more content
   */
  const loadMore = async (): Promise<void> => {
    if (isLoading() || !hasMore() || error()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onLoadMore();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Retry after error
   */
  const retry = (): void => {
    setError(null);
    loadMore();
  };

  // Trigger load when sentinel is visible
  createEffect(() => {
    if (isIntersecting() && !isLoading() && hasMore() && !error()) {
      loadMore();
    }
  });

  return {
    isLoading,
    hasMore,
    setHasMore,
    error,
    retry,
  };
}

// ============================================================================
// useVisibilityTracker Hook
// ============================================================================

/**
 * Tracks visibility percentage of an element.
 *
 * @param target - Accessor returning the element to track
 * @param options - Configuration options
 * @returns Object with visibility percentage and states
 *
 * @example
 * ```tsx
 * let videoRef: HTMLVideoElement;
 *
 * const { visibilityPercent, isFullyVisible, isPartiallyVisible } = useVisibilityTracker(
 *   () => videoRef
 * );
 *
 * createEffect(() => {
 *   if (isFullyVisible()) {
 *     videoRef.play();
 *   } else if (!isPartiallyVisible()) {
 *     videoRef.pause();
 *   }
 * });
 * ```
 */
export function useVisibilityTracker(
  target: Accessor<Element | null | undefined>,
  options: Omit<IntersectionObserverOptions, "threshold" | "onChange"> = {}
): {
  visibilityPercent: Accessor<number>;
  isFullyVisible: Accessor<boolean>;
  isPartiallyVisible: Accessor<boolean>;
  isHidden: Accessor<boolean>;
} {
  // Use granular thresholds for smooth tracking
  const thresholds = Array.from({ length: 101 }, (_, i) => i / 100);

  const { intersectionRatio, isIntersecting } = useIntersectionObserver(target, {
    ...options,
    threshold: thresholds,
  });

  return {
    visibilityPercent: () => Math.round(intersectionRatio() * 100),
    isFullyVisible: () => intersectionRatio() >= 1,
    isPartiallyVisible: isIntersecting,
    isHidden: () => !isIntersecting(),
  };
}

// ============================================================================
// useMultiIntersectionObserver Hook
// ============================================================================

/**
 * Observes multiple elements with a single observer.
 *
 * @param targets - Accessor returning array of elements to observe
 * @param options - Configuration options
 * @returns Map of element intersection states
 *
 * @example
 * ```tsx
 * const { entries, isAnyIntersecting, allIntersecting } = useMultiIntersectionObserver(
 *   () => [...sectionRefs],
 *   { threshold: 0.5 }
 * );
 *
 * createEffect(() => {
 *   console.log("Visible sections:", Array.from(entries().entries())
 *     .filter(([, info]) => info.isIntersecting)
 *     .map(([el]) => el.id));
 * });
 * ```
 */
export function useMultiIntersectionObserver(
  targets: Accessor<(Element | null | undefined)[]>,
  options: Omit<IntersectionObserverOptions, "onChange"> & {
    onChange?: (entries: Map<Element, IntersectionInfo>) => void;
  } = {}
): {
  entries: Accessor<Map<Element, IntersectionInfo>>;
  isAnyIntersecting: Accessor<boolean>;
  allIntersecting: Accessor<boolean>;
  getEntry: (element: Element) => IntersectionInfo | undefined;
} {
  const {
    root,
    rootMargin = "0px",
    threshold = 0,
    enabled = true,
    onChange,
  } = options;

  // State
  const [entries, setEntries] = createSignal<Map<Element, IntersectionInfo>>(new Map());

  // Observer reference
  let observer: IntersectionObserver | null = null;
  const observedElements = new Set<Element>();

  /**
   * Handle intersection callback
   */
  const handleIntersection = (intersectionEntries: IntersectionObserverEntry[]): void => {
    setEntries((prev) => {
      const next = new Map(prev);

      for (const intersectionEntry of intersectionEntries) {
        const info = createIntersectionInfo(intersectionEntry);
        next.set(intersectionEntry.target, info);
      }

      onChange?.(next);
      return next;
    });
  };

  /**
   * Create observer if needed
   */
  const ensureObserver = (): IntersectionObserver | null => {
    if (!isIntersectionObserverSupported()) {
      return null;
    }

    if (!observer) {
      const resolvedRoot = resolveRoot(root);
      observer = new IntersectionObserver(handleIntersection, {
        root: resolvedRoot,
        rootMargin,
        threshold,
      });
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
    obs.observe(element);
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

    setEntries((prev) => {
      const next = new Map(prev);
      next.delete(element);
      return next;
    });
  };

  /**
   * Disconnect all
   */
  const disconnect = (): void => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    observedElements.clear();
    setEntries(new Map());
  };

  // Setup effect
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
    entries,
    isAnyIntersecting: () => {
      for (const [, info] of entries()) {
        if (info.isIntersecting) return true;
      }
      return false;
    },
    allIntersecting: () => {
      const e = entries();
      if (e.size === 0) return false;
      for (const [, info] of e) {
        if (!info.isIntersecting) return false;
      }
      return true;
    },
    getEntry: (element: Element) => entries().get(element),
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useIntersectionObserver;

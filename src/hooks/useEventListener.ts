/**
 * useEventListener - Type-safe event listener hook with automatic cleanup
 *
 * Provides a reactive way to attach event listeners to DOM elements,
 * window, or document with proper TypeScript support and automatic cleanup.
 *
 * Features:
 * - Full TypeScript support with event type inference
 * - Automatic cleanup on unmount
 * - Support for window, document, and element targets
 * - Passive and capture options
 * - Signal-based target support for dynamic elements
 * - Support for custom events
 *
 * @example
 * ```tsx
 * function ResizablePanel() {
 *   const [size, setSize] = createSignal({ width: 0, height: 0 });
 *   let panelRef: HTMLDivElement | undefined;
 *
 *   // Window resize listener
 *   useEventListener("resize", () => {
 *     setSize({ width: window.innerWidth, height: window.innerHeight });
 *   });
 *
 *   // Element-specific listener
 *   useEventListener(
 *     "click",
 *     (e) => console.log("Clicked at:", e.clientX, e.clientY),
 *     () => panelRef
 *   );
 *
 *   return <div ref={panelRef}>Size: {size().width}x{size().height}</div>;
 * }
 * ```
 */

import {
  createEffect,
  onCleanup,
  type Accessor,
} from "solid-js";

// ============================================================================
// Types
// ============================================================================

/** Supported event target types */
export type EventTarget =
  | Window
  | Document
  | HTMLElement
  | Element
  | MediaQueryList
  | null
  | undefined;

/** Event map for Window */
type WindowEventMap = globalThis.WindowEventMap;

/** Event map for Document */
type DocumentEventMap = globalThis.DocumentEventMap;

/** Event map for HTMLElement */
type HTMLElementEventMap = globalThis.HTMLElementEventMap;

/** Event map for MediaQueryList */
type MediaQueryListEventMap = globalThis.MediaQueryListEventMap;

/** Union of all event maps */
export type AllEventMaps = WindowEventMap &
  DocumentEventMap &
  HTMLElementEventMap &
  MediaQueryListEventMap;

/** Options for useEventListener */
export interface EventListenerOptions extends AddEventListenerOptions {
  /** Target element (default: window) */
  target?: EventTarget | Accessor<EventTarget>;
  /** Whether to use passive listener (default: false) */
  passive?: boolean;
  /** Whether to use capture phase (default: false) */
  capture?: boolean;
  /** Whether the listener should only fire once (default: false) */
  once?: boolean;
  /** Abort signal to remove the listener */
  signal?: AbortSignal;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

/** Generic event handler type */
export type EventHandler<E extends Event = Event> = (event: E) => void;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if target is Window
 */
function isWindow(target: EventTarget): target is Window {
  return typeof window !== "undefined" && target === window;
}

/**
 * Get the actual target from accessor or value
 */
function resolveTarget(
  target: EventTarget | Accessor<EventTarget> | undefined
): EventTarget {
  if (target === undefined) {
    return typeof window !== "undefined" ? window : null;
  }
  if (typeof target === "function") {
    return target();
  }
  return target;
}

// ============================================================================
// useEventListener Hook
// ============================================================================

/**
 * Attaches an event listener with automatic cleanup.
 *
 * @param eventName - Name of the event to listen for
 * @param handler - Event handler function
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * // Window event (default target)
 * useEventListener("resize", handleResize);
 *
 * // Document event
 * useEventListener("visibilitychange", handleVisibility, {
 *   target: document,
 * });
 *
 * // Element event with ref
 * let buttonRef: HTMLButtonElement;
 * useEventListener("click", handleClick, {
 *   target: () => buttonRef,
 * });
 *
 * // With options
 * useEventListener("scroll", handleScroll, {
 *   target: () => containerRef,
 *   passive: true,
 *   capture: false,
 * });
 * ```
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: EventHandler<WindowEventMap[K]>,
  options?: EventListenerOptions & { target?: Window | Accessor<Window | null | undefined> }
): void;

export function useEventListener<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: EventHandler<DocumentEventMap[K]>,
  options: EventListenerOptions & { target: Document | Accessor<Document | null | undefined> }
): void;

export function useEventListener<K extends keyof HTMLElementEventMap>(
  eventName: K,
  handler: EventHandler<HTMLElementEventMap[K]>,
  options: EventListenerOptions & {
    target: HTMLElement | Element | Accessor<HTMLElement | Element | null | undefined>;
  }
): void;

export function useEventListener<K extends keyof MediaQueryListEventMap>(
  eventName: K,
  handler: EventHandler<MediaQueryListEventMap[K]>,
  options: EventListenerOptions & {
    target: MediaQueryList | Accessor<MediaQueryList | null | undefined>;
  }
): void;

export function useEventListener(
  eventName: string,
  handler: EventHandler<Event>,
  options?: EventListenerOptions
): void;

export function useEventListener(
  eventName: string,
  handler: EventHandler<Event>,
  options: EventListenerOptions = {}
): void {
  const {
    target: targetOption,
    passive = false,
    capture = false,
    once = false,
    signal,
    enabled = true,
  } = options;

  createEffect(() => {
    // Skip if disabled
    if (!enabled) {
      return;
    }

    // Resolve the target
    const target = resolveTarget(targetOption);

    // Skip if no target
    if (!target) {
      return;
    }

    // Build listener options
    const listenerOptions: AddEventListenerOptions = {
      passive,
      capture,
      once,
      signal,
    };

    // Add the event listener
    target.addEventListener(eventName, handler as EventListener, listenerOptions);

    // Cleanup on unmount or when dependencies change
    onCleanup(() => {
      target.removeEventListener(eventName, handler as EventListener, listenerOptions);
    });
  });
}

// ============================================================================
// Specialized Event Listener Hooks
// ============================================================================

/**
 * Hook for window resize events with optional throttling
 *
 * @param handler - Resize event handler
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * useWindowResize((width, height) => {
 *   console.log("Window size:", width, height);
 * });
 * ```
 */
export function useWindowResize(
  handler: (width: number, height: number) => void,
  options: Omit<EventListenerOptions, "target"> = {}
): void {
  const wrappedHandler = (): void => {
    handler(window.innerWidth, window.innerHeight);
  };

  useEventListener("resize", wrappedHandler, {
    ...options,
    passive: true,
  });
}

/**
 * Hook for document visibility change events
 *
 * @param handler - Visibility change handler
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * useVisibilityChange((isVisible) => {
 *   if (isVisible) {
 *     resumeAnimation();
 *   } else {
 *     pauseAnimation();
 *   }
 * });
 * ```
 */
export function useVisibilityChange(
  handler: (isVisible: boolean) => void,
  options: Omit<EventListenerOptions, "target"> = {}
): void {
  const wrappedHandler = (): void => {
    handler(document.visibilityState === "visible");
  };

  useEventListener("visibilitychange", wrappedHandler, {
    ...options,
    target: document,
  });
}

/**
 * Hook for window focus and blur events
 *
 * @param handler - Focus state change handler
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * useWindowFocus((isFocused) => {
 *   if (!isFocused) {
 *     saveProgress();
 *   }
 * });
 * ```
 */
export function useWindowFocus(
  handler: (isFocused: boolean) => void,
  options: Omit<EventListenerOptions, "target"> = {}
): void {
  useEventListener(
    "focus",
    () => handler(true),
    { ...options, passive: true }
  );
  useEventListener(
    "blur",
    () => handler(false),
    { ...options, passive: true }
  );
}

/**
 * Hook for scroll events with optional passive mode
 *
 * @param handler - Scroll event handler
 * @param options - Configuration options including target element
 *
 * @example
 * ```tsx
 * useScroll(
 *   (scrollTop, scrollLeft) => {
 *     updateHeader(scrollTop);
 *   },
 *   { target: () => containerRef }
 * );
 * ```
 */
export function useScroll(
  handler: (scrollTop: number, scrollLeft: number, event: Event) => void,
  options: EventListenerOptions = {}
): void {
  const wrappedHandler = (event: Event): void => {
    const target = event.target as Element | null;
    if (target) {
      handler(target.scrollTop, target.scrollLeft, event);
    } else if (isWindow(event.currentTarget as EventTarget)) {
      handler(window.scrollY, window.scrollX, event);
    }
  };

  useEventListener("scroll", wrappedHandler, {
    ...options,
    passive: options.passive ?? true,
  });
}

/**
 * Hook for click outside detection
 *
 * @param elementRef - Accessor to the element to detect clicks outside of
 * @param handler - Handler called when click is outside the element
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * let dropdownRef: HTMLDivElement;
 *
 * useClickOutside(
 *   () => dropdownRef,
 *   () => setIsOpen(false)
 * );
 * ```
 */
export function useClickOutside(
  elementRef: Accessor<Element | null | undefined>,
  handler: (event: MouseEvent) => void,
  options: Omit<EventListenerOptions, "target"> = {}
): void {
  const wrappedHandler = (event: MouseEvent): void => {
    const element = elementRef();
    if (!element) return;

    const target = event.target as Node | null;
    if (target && !element.contains(target)) {
      handler(event);
    }
  };

  useEventListener("mousedown", wrappedHandler, {
    ...options,
    target: document,
  });
}

/**
 * Hook for detecting media query changes
 *
 * @param query - Media query string
 * @param handler - Handler called when media query state changes
 *
 * @example
 * ```tsx
 * useMediaQuery("(prefers-color-scheme: dark)", (matches) => {
 *   setTheme(matches ? "dark" : "light");
 * });
 *
 * useMediaQuery("(min-width: 768px)", (matches) => {
 *   setIsMobile(!matches);
 * });
 * ```
 */
export function useMediaQuery(
  query: string,
  handler: (matches: boolean) => void
): void {
  createEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    // Call handler with initial value
    handler(mediaQuery.matches);

    // Modern browsers support addEventListener
    const listener = (event: MediaQueryListEvent): void => {
      handler(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", listener);
      onCleanup(() => {
        mediaQuery.removeEventListener("change", listener);
      });
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(listener);
      onCleanup(() => {
        mediaQuery.removeListener(listener);
      });
    }
  });
}

/**
 * Hook for keyboard events on a specific element or window
 *
 * @param handler - Keyboard event handler
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * useKeyboardEvent(
 *   (event) => {
 *     if (event.key === "Escape") {
 *       closeModal();
 *     }
 *   },
 *   { target: () => modalRef }
 * );
 * ```
 */
export function useKeyboardEvent(
  handler: EventHandler<KeyboardEvent>,
  options: EventListenerOptions & {
    eventType?: "keydown" | "keyup" | "keypress";
  } = {}
): void {
  const { eventType = "keydown", ...restOptions } = options;
  const wrappedHandler = (event: Event): void => {
    handler(event as KeyboardEvent);
  };
  useEventListener(eventType, wrappedHandler, restOptions as EventListenerOptions);
}

/**
 * Hook for mouse events with position tracking
 *
 * @param handler - Mouse event handler with position
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * useMouseEvent(
 *   (x, y, event) => {
 *     updateCursor(x, y);
 *   },
 *   { eventType: "mousemove", passive: true }
 * );
 * ```
 */
export function useMouseEvent(
  handler: (x: number, y: number, event: MouseEvent) => void,
  options: EventListenerOptions & {
    eventType?: "mousedown" | "mouseup" | "mousemove" | "mouseenter" | "mouseleave" | "click";
  } = {}
): void {
  const { eventType = "mousemove", ...restOptions } = options;

  const wrappedHandler = (event: Event): void => {
    const mouseEvent = event as MouseEvent;
    handler(mouseEvent.clientX, mouseEvent.clientY, mouseEvent);
  };

  useEventListener(eventType, wrappedHandler, restOptions as EventListenerOptions);
}

// ============================================================================
// Custom Event Support
// ============================================================================

/**
 * Hook for custom events with typed payload
 *
 * @param eventName - Name of the custom event
 * @param handler - Event handler with typed payload
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * // Listen for custom events
 * useCustomEvent<{ userId: string }>("user:login", (detail) => {
 *   console.log("User logged in:", detail.userId);
 * });
 *
 * // Dispatch custom event elsewhere
 * window.dispatchEvent(
 *   new CustomEvent("user:login", { detail: { userId: "123" } })
 * );
 * ```
 */
export function useCustomEvent<T = unknown>(
  eventName: string,
  handler: (detail: T, event: CustomEvent<T>) => void,
  options: EventListenerOptions = {}
): void {
  const wrappedHandler = (event: Event): void => {
    const customEvent = event as CustomEvent<T>;
    handler(customEvent.detail, customEvent);
  };

  useEventListener(eventName, wrappedHandler, options);
}

/**
 * Creates a function to dispatch custom events
 *
 * @param eventName - Name of the custom event
 * @param options - Event dispatch options
 * @returns Function to dispatch the event
 *
 * @example
 * ```tsx
 * const dispatchNotification = useCustomEventDispatcher<{ message: string }>(
 *   "notification"
 * );
 *
 * // Later:
 * dispatchNotification({ message: "Hello!" });
 * ```
 */
export function useCustomEventDispatcher<T = unknown>(
  eventName: string,
  options: {
    target?: EventTarget;
    bubbles?: boolean;
    cancelable?: boolean;
  } = {}
): (detail: T) => void {
  const { target, bubbles = true, cancelable = true } = options;

  return (detail: T): void => {
    const resolvedTarget = resolveTarget(target) || window;
    if (!resolvedTarget) return;

    const event = new CustomEvent(eventName, {
      detail,
      bubbles,
      cancelable,
    });

    resolvedTarget.dispatchEvent(event);
  };
}

// ============================================================================
// Timer Hooks
// ============================================================================

/**
 * Hook for safely managing intervals with automatic cleanup
 * Prevents memory leaks from forgotten clearInterval calls
 *
 * @param callback - Function to call on each interval
 * @param delay - Interval delay in milliseconds, or null to disable
 *
 * @example
 * ```tsx
 * // Update every second
 * useInterval(() => {
 *   setCount(c => c + 1);
 * }, 1000);
 *
 * // Conditionally disable
 * useInterval(() => {
 *   fetchData();
 * }, isPaused ? null : 5000);
 * ```
 */
export function useInterval(
  callback: () => void,
  delay: number | null
): void {
  createEffect(() => {
    if (delay === null) return;

    const id = setInterval(callback, delay);

    onCleanup(() => {
      clearInterval(id);
    });
  });
}

/**
 * Hook for safely managing timeouts with automatic cleanup
 * Prevents memory leaks from forgotten clearTimeout calls
 *
 * @param callback - Function to call after the delay
 * @param delay - Timeout delay in milliseconds, or null to disable
 *
 * @example
 * ```tsx
 * // Show notification after delay
 * useTimeout(() => {
 *   setShowWelcome(true);
 * }, 2000);
 *
 * // Conditionally disable
 * useTimeout(() => {
 *   autoSave();
 * }, hasUnsavedChanges ? 5000 : null);
 * ```
 */
export function useTimeout(
  callback: () => void,
  delay: number | null
): void {
  createEffect(() => {
    if (delay === null) return;

    const id = setTimeout(callback, delay);

    onCleanup(() => {
      clearTimeout(id);
    });
  });
}

// ============================================================================
// Multiple Event Listeners Hook
// ============================================================================

/**
 * Hook for managing multiple event listeners with automatic cleanup
 *
 * @param listeners - Array of listener configurations
 *
 * @example
 * ```tsx
 * useEventListeners([
 *   { type: "keydown", handler: handleKeyDown },
 *   { type: "keyup", handler: handleKeyUp },
 *   { type: "click", handler: handleClick, target: document },
 *   { type: "scroll", handler: handleScroll, options: { passive: true } },
 * ]);
 * ```
 */
export function useEventListeners(
  listeners: Array<{
    type: string;
    handler: (event: Event) => void;
    target?: globalThis.EventTarget | null;
    options?: AddEventListenerOptions;
  }>
): void {
  createEffect(() => {
    const cleanups: (() => void)[] = [];

    for (const { type, handler, target, options } of listeners) {
      const targetElement = target ?? window;
      if (!targetElement) continue;

      targetElement.addEventListener(type, handler, options);
      cleanups.push(() => targetElement.removeEventListener(type, handler, options));
    }

    onCleanup(() => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    });
  });
}

// ============================================================================
// Default Export
// ============================================================================

export default useEventListener;

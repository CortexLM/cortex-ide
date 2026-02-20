import { onMount, onCleanup } from "solid-js";
import { listen, type UnlistenFn, type Event } from "@tauri-apps/api/event";

/**
 * Hook for safely subscribing to Tauri events with automatic cleanup.
 * Handles the async nature of listen() properly to prevent memory leaks.
 * 
 * @param event - The event name to listen to
 * @param handler - The callback function to handle the event
 * 
 * @example
 * ```tsx
 * useTauriListen<{ message: string }>("my-event", (payload) => {
 *   console.log(payload.message);
 * });
 * ```
 */
export function useTauriListen<T>(
  event: string,
  handler: (payload: T) => void
): void {
  onMount(() => {
    let unlisten: UnlistenFn | null = null;
    let mounted = true;
    
    // Setup the listener
    listen<T>(event, (e: Event<T>) => {
      // Only handle if still mounted
      if (mounted) {
        handler(e.payload);
      }
    }).then((unlistenFn) => {
      // Store unlisten function if still mounted
      if (mounted) {
        unlisten = unlistenFn;
      } else {
        // Component unmounted before listener was ready, cleanup immediately
        unlistenFn();
      }
    }).catch((error) => {
      console.error(`[useTauriListen] Failed to listen to "${event}":`, error);
    });
    
    onCleanup(() => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    });
  });
}

/**
 * Hook for subscribing to multiple Tauri events with automatic cleanup.
 * 
 * @param listeners - Array of event configurations
 * 
 * @example
 * ```tsx
 * useTauriListeners([
 *   { event: "file-changed", handler: (path) => console.log(path) },
 *   { event: "file-deleted", handler: (path) => console.log(path) },
 * ]);
 * ```
 */
export function useTauriListeners<T = unknown>(
  listeners: Array<{
    event: string;
    handler: (payload: T) => void;
  }>
): void {
  onMount(() => {
    const unlistenFns: UnlistenFn[] = [];
    let mounted = true;
    
    // Setup all listeners
    Promise.all(
      listeners.map(({ event, handler }) =>
        listen<T>(event, (e: Event<T>) => {
          if (mounted) {
            handler(e.payload);
          }
        })
      )
    ).then((fns) => {
      if (mounted) {
        unlistenFns.push(...fns);
      } else {
        // Cleanup all if unmounted before ready
        fns.forEach((fn) => fn());
      }
    }).catch((error) => {
      console.error("[useTauriListeners] Failed to setup listeners:", error);
    });
    
    onCleanup(() => {
      mounted = false;
      unlistenFns.forEach((fn) => fn());
    });
  });
}

/**
 * Conditional Tauri listener that only activates when condition is true.
 * 
 * @param event - The event name
 * @param handler - The callback function
 * @param condition - Accessor function returning boolean
 */
export function useTauriListenWhen<T>(
  event: string,
  handler: (payload: T) => void,
  condition: () => boolean
): void {
  onMount(() => {
    if (!condition()) return;
    
    let unlisten: UnlistenFn | null = null;
    let mounted = true;
    
    listen<T>(event, (e: Event<T>) => {
      if (mounted && condition()) {
        handler(e.payload);
      }
    }).then((unlistenFn) => {
      if (mounted) {
        unlisten = unlistenFn;
      } else {
        unlistenFn();
      }
    }).catch((error) => {
      console.error(`[useTauriListenWhen] Failed to listen to "${event}":`, error);
    });
    
    onCleanup(() => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    });
  });
}

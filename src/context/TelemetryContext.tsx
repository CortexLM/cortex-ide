/**
 * Telemetry Context - SolidJS context provider for telemetry
 * Privacy-first design with opt-in/opt-out support
 */

import {
  createContext,
  useContext,
  ParentProps,
  createSignal,
  onMount,
  onCleanup,
} from "solid-js";
import {
  TelemetryClient,
  getTelemetryClient,
  type TelemetryConfig,
  type TelemetryStats,
  type AnyTelemetryEvent,
  events,
} from "@/utils/telemetry";

// ============================================================================
// Context Types
// ============================================================================

export interface TelemetryContextValue {
  /** Whether telemetry is enabled */
  isEnabled: () => boolean;
  /** Enable telemetry collection */
  enable: () => void;
  /** Disable telemetry collection */
  disable: () => void;
  /** Toggle telemetry on/off */
  toggle: () => void;
  /** Track a telemetry event */
  track: (event: AnyTelemetryEvent) => void;
  /** Manually flush events to server */
  flush: () => Promise<boolean>;
  /** Get telemetry statistics */
  getStats: () => TelemetryStats;
  /** Get session ID */
  getSessionId: () => string;
  /** Update telemetry configuration */
  updateConfig: (config: Partial<TelemetryConfig>) => void;
  /** Event factory functions for convenience */
  events: typeof events;
}

// ============================================================================
// Context
// ============================================================================

const TelemetryContext = createContext<TelemetryContextValue>();

// ============================================================================
// Provider Component
// ============================================================================

export interface TelemetryProviderProps extends ParentProps {
  /** Initial configuration */
  config?: Partial<TelemetryConfig>;
  /** Enable debug mode */
  debug?: boolean;
}

export function TelemetryProvider(props: TelemetryProviderProps) {
  const [isEnabled, setIsEnabled] = createSignal(false);
  let client: TelemetryClient;

  // Initialize client
  const initialConfig: Partial<TelemetryConfig> = {
    debug: props.debug ?? false,
    ...props.config,
  };

  client = getTelemetryClient(initialConfig);
  setIsEnabled(client.isEnabled());

  // Cleanup function references
  let cleanupErrorHandlers: (() => void) | null = null;
  let cleanupVisibilityTracking: (() => void) | null = null;
  let cleanupPerformanceMonitoring: (() => void) | null = null;

  // Initialize on mount
  onMount(async () => {
    await client.initialize();
    setIsEnabled(client.isEnabled());

    // Track app launch
    if (client.isEnabled()) {
      const isFirstLaunch = !localStorage.getItem("cortex_has_launched");
      if (isFirstLaunch) {
        localStorage.setItem("cortex_has_launched", "true");
      }

      client.track(
        events.appLaunched({
          launchDuration: performance.now(),
          isFirstLaunch,
        })
      );
    }

    // Set up global error handlers
    cleanupErrorHandlers = setupGlobalErrorHandlers(client);

    // Set up visibility tracking
    cleanupVisibilityTracking = setupVisibilityTracking(client);

    // Set up performance monitoring
    cleanupPerformanceMonitoring = setupPerformanceMonitoring(client);
  });

  // Cleanup on unmount - wrap in onMount for proper reactive context
  onMount(() => {
    onCleanup(() => {
      if (client.isEnabled()) {
        client.track(
          events.appClosed({
            sessionDuration: client.getSessionDuration(),
            eventsCount: client.getQueueSize(),
          })
        );
      }
      
      // Clean up all subscriptions and handlers
      cleanupErrorHandlers?.();
      cleanupVisibilityTracking?.();
      cleanupPerformanceMonitoring?.();
      
      client.destroy();
    });
  });

  // Context value
  const value: TelemetryContextValue = {
    isEnabled,

    enable: () => {
      client.enable();
      setIsEnabled(true);

      // Track that telemetry was enabled
      client.track(
        events.featureUsed({
          feature: "telemetry",
          action: "enabled",
        })
      );
    },

    disable: () => {
      client.disable();
      setIsEnabled(false);
    },

    toggle: () => {
      if (isEnabled()) {
        value.disable();
      } else {
        value.enable();
      }
    },

    track: (event: AnyTelemetryEvent) => {
      client.track(event);
    },

    flush: () => client.flush(),

    getStats: () => client.getStats(),

    getSessionId: () => client.getSessionId(),

    updateConfig: (config: Partial<TelemetryConfig>) => {
      client.updateConfig(config);
      setIsEnabled(client.isEnabled());
    },

    events,
  };

  return (
    <TelemetryContext.Provider value={value}>
      {props.children}
    </TelemetryContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTelemetry(): TelemetryContextValue {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error("useTelemetry must be used within a TelemetryProvider");
  }
  return context;
}

// ============================================================================
// Global Error Handling
// ============================================================================

function setupGlobalErrorHandlers(client: TelemetryClient): () => void {
  if (typeof window === "undefined") return () => {};

  // Handle uncaught errors
  const errorHandler = (event: ErrorEvent) => {
    if (!client.isEnabled()) return;

    client.track(
      events.unhandledError({
        errorType: event.error?.name || "Error",
        errorMessage: event.message || "Unknown error",
        stack: event.error?.stack,
        location: `${event.filename}:${event.lineno}:${event.colno}`,
      })
    );
  };

  // Handle unhandled promise rejections
  const rejectionHandler = (event: PromiseRejectionEvent) => {
    if (!client.isEnabled()) return;

    const error = event.reason;
    client.track(
      events.unhandledError({
        errorType: error?.name || "UnhandledRejection",
        errorMessage: error?.message || String(error) || "Unknown rejection",
        stack: error?.stack,
      })
    );
  };

  window.addEventListener("error", errorHandler);
  window.addEventListener("unhandledrejection", rejectionHandler);

  return () => {
    window.removeEventListener("error", errorHandler);
    window.removeEventListener("unhandledrejection", rejectionHandler);
  };
}

// ============================================================================
// Visibility Tracking
// ============================================================================

function setupVisibilityTracking(client: TelemetryClient): () => void {
  if (typeof document === "undefined") return () => {};

  let lastBlurTime: number | null = null;

  const visibilityHandler = () => {
    if (!client.isEnabled()) return;

    if (document.visibilityState === "hidden") {
      lastBlurTime = Date.now();
      client.track(events.appBlurred());
    } else if (document.visibilityState === "visible" && lastBlurTime !== null) {
      const timeInBackground = Date.now() - lastBlurTime;
      client.track(events.appFocused({ timeInBackground }));
      lastBlurTime = null;
    }
  };

  document.addEventListener("visibilitychange", visibilityHandler);

  return () => {
    document.removeEventListener("visibilitychange", visibilityHandler);
  };
}

// ============================================================================
// Performance Monitoring
// ============================================================================

function setupPerformanceMonitoring(client: TelemetryClient): () => void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return () => {};

  let longTaskObserver: PerformanceObserver | null = null;

  // Track long tasks
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      if (!client.isEnabled()) return;

      for (const entry of list.getEntries()) {
        if (entry.duration > 100) {
          client.track(
            events.performance({
              metric: "long_task",
              value: entry.duration,
              unit: "ms",
              context: entry.name,
            })
          );
        }
      }
    });

    longTaskObserver.observe({ entryTypes: ["longtask"] });
  } catch (err) {
    console.debug("[Telemetry] Long task observer not supported:", err);
  }

  // Periodic memory monitoring (every 5 minutes)
  const memoryInterval = setInterval(() => {
    if (!client.isEnabled()) return;

    const performance = window.performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
      };
    };

    if (performance.memory) {
      client.track(
        events.memoryUsage({
          heapUsed: performance.memory.usedJSHeapSize,
          heapTotal: performance.memory.totalJSHeapSize,
        })
      );
    }
  }, 300000); // 5 minutes

  return () => {
    clearInterval(memoryInterval);
    if (longTaskObserver) {
      longTaskObserver.disconnect();
    }
  };
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Hook to track feature usage
 */
export function useTrackFeature() {
  const telemetry = useTelemetry();

  return (feature: string, action: string, metadata?: Record<string, unknown>) => {
    telemetry.track(
      telemetry.events.featureUsed({
        feature,
        action,
        metadata,
      })
    );
  };
}

/**
 * Hook to track command execution
 */
export function useTrackCommand() {
  const telemetry = useTelemetry();

  return (
    command: string,
    source: "palette" | "keybinding" | "menu" | "api",
    success: boolean,
    duration?: number
  ) => {
    telemetry.track(
      telemetry.events.commandExecuted({
        command,
        source,
        success,
        duration,
      })
    );
  };
}

/**
 * Hook to track errors
 */
export function useTrackError() {
  const telemetry = useTelemetry();

  return (
    error: Error | string,
    component?: string,
    fatal = false
  ) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    telemetry.track(
      telemetry.events.error({
        errorType: errorObj.name,
        errorMessage: errorObj.message,
        stack: errorObj.stack,
        component,
        fatal,
      })
    );
  };
}

/**
 * Hook to track performance metrics
 */
export function useTrackPerformance() {
  const telemetry = useTelemetry();

  return (
    metric: string,
    value: number,
    unit: "ms" | "bytes" | "count" | "percent",
    context?: string
  ) => {
    telemetry.track(
      telemetry.events.performance({
        metric,
        value,
        unit,
        context,
      })
    );
  };
}

/**
 * Hook to measure and track render time
 */
export function useTrackRender(componentName: string) {
  const telemetry = useTelemetry();
  let renderCount = 0;
  let lastRenderStart = 0;

  const startRender = () => {
    lastRenderStart = performance.now();
    renderCount++;
  };

  const endRender = () => {
    if (lastRenderStart === 0) return;
    const renderTime = performance.now() - lastRenderStart;

    // Only track significant renders (> 16ms / 60fps threshold)
    if (renderTime > 16) {
      telemetry.track(
        telemetry.events.renderPerformance({
          component: componentName,
          renderTime,
          rerenderCount: renderCount,
        })
      );
    }
    lastRenderStart = 0;
  };

  return { startRender, endRender };
}

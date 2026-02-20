/**
 * Provider Profiler - Measures the initialization time of each SolidJS provider
 * 
 * Usage: Wrap providers with ProfiledProvider to track their mount times
 */

import { ParentProps, onMount, onCleanup, Component } from "solid-js";

interface ProviderTiming {
  name: string;
  mountStart: number;
  mountEnd?: number;
  mountDuration?: number;
  effectStart?: number;
  effectEnd?: number;
  effectDuration?: number;
}

// Global profiler state
const timings: Map<string, ProviderTiming> = new Map();
let appStartTime = performance.now();
let reportGenerated = false;

// Enable/disable profiling
let profilingEnabled = true;

export function enableProfiling() {
  profilingEnabled = true;
  appStartTime = performance.now();
  timings.clear();
  reportGenerated = false;
}

export function disableProfiling() {
  profilingEnabled = false;
}

export function resetProfiling() {
  appStartTime = performance.now();
  timings.clear();
  reportGenerated = false;
}

/**
 * Wrapper component that profiles the mount time of a provider
 */
export function ProfiledProvider<P extends ParentProps>(
  props: P & { 
    name: string;
    component: Component<P>;
  }
) {
  const startTime = performance.now();
  
  if (profilingEnabled) {
    timings.set(props.name, {
      name: props.name,
      mountStart: startTime - appStartTime,
    });
  }

  // Track when component is fully mounted
  onMount(() => {
    if (profilingEnabled) {
      const timing = timings.get(props.name);
      if (timing) {
        timing.mountEnd = performance.now() - appStartTime;
        timing.mountDuration = timing.mountEnd - timing.mountStart;
        timing.effectStart = performance.now() - appStartTime;
      }
    }
  });

  // Track cleanup as the "effect end" boundary
  onCleanup(() => {
    if (profilingEnabled) {
      const timing = timings.get(props.name);
      if (timing && timing.effectStart && !timing.effectEnd) {
        timing.effectEnd = performance.now() - appStartTime;
        timing.effectDuration = timing.effectEnd - timing.effectStart;
      }
    }
  });

  // Create the wrapped component
  const { name, component: WrappedComponent, ...rest } = props;
  return <WrappedComponent {...rest as unknown as P}>{props.children}</WrappedComponent>;
}

/**
 * Generate and log the profiling report
 */
export function generateProfilingReport() {
  if (reportGenerated) return;
  reportGenerated = true;

  const totalTime = performance.now() - appStartTime;
  const sortedTimings = Array.from(timings.values())
    .filter(t => t.mountDuration !== undefined)
    .sort((a, b) => (b.mountDuration || 0) - (a.mountDuration || 0));

  // Summary by time bracket
  const brackets = {
    ">100ms": sortedTimings.filter(t => (t.mountDuration || 0) > 100),
    "50-100ms": sortedTimings.filter(t => (t.mountDuration || 0) > 50 && (t.mountDuration || 0) <= 100),
    "20-50ms": sortedTimings.filter(t => (t.mountDuration || 0) > 20 && (t.mountDuration || 0) <= 50),
    "10-20ms": sortedTimings.filter(t => (t.mountDuration || 0) > 10 && (t.mountDuration || 0) <= 20),
    "<10ms": sortedTimings.filter(t => (t.mountDuration || 0) <= 10),
  };

  // Total mount time (sum of all durations)
  const totalMountTime = sortedTimings.reduce((sum, t) => sum + (t.mountDuration || 0), 0);

  if (import.meta.env.DEV) {
    console.log("\n");
    console.log("%c╔══════════════════════════════════════════════════════════════════╗", "color: #4fc3f7");
    console.log("%c║              PROVIDER PROFILING REPORT                           ║", "color: #4fc3f7; font-weight: bold");
    console.log("%c╚══════════════════════════════════════════════════════════════════╝", "color: #4fc3f7");
    console.log(`%cTotal startup time: ${totalTime.toFixed(2)}ms`, "color: #fff; font-size: 14px; font-weight: bold");
    console.log(`%cProviders profiled: ${sortedTimings.length}`, "color: #888");
    console.log("\n");

    // Top 15 slowest providers
    console.log("%c🐌 SLOWEST PROVIDERS (Top 15):", "color: #ff6b6b; font-weight: bold");
    
    const top15 = sortedTimings.slice(0, 15);
    console.table(top15.map(t => ({
      Provider: t.name,
      "Mount (ms)": t.mountDuration?.toFixed(2),
      "Start (ms)": t.mountStart.toFixed(2),
    })));

    console.log("\n%c📊 PROVIDERS BY TIME BRACKET:", "color: #6bcb77; font-weight: bold");
    console.table({
      ">100ms (CRITICAL)": { Count: brackets[">100ms"].length, Names: brackets[">100ms"].map(t => t.name).join(", ") || "-" },
      "50-100ms (SLOW)": { Count: brackets["50-100ms"].length, Names: brackets["50-100ms"].map(t => t.name).join(", ") || "-" },
      "20-50ms (MODERATE)": { Count: brackets["20-50ms"].length, Names: brackets["20-50ms"].map(t => t.name).join(", ") || "-" },
      "10-20ms (OK)": { Count: brackets["10-20ms"].length, Names: brackets["10-20ms"].map(t => t.name).join(", ") || "-" },
      "<10ms (FAST)": { Count: brackets["<10ms"].length, Names: `${brackets["<10ms"].length} providers` },
    });

    console.log(`\n%c⏱️  Total mount time (sum): ${totalMountTime.toFixed(2)}ms`, "color: #ffd93d; font-weight: bold");
    console.log(`%c⏱️  App startup time: ${totalTime.toFixed(2)}ms`, "color: #4fc3f7; font-weight: bold");
  }

  return {
    totalTime,
    totalMountTime,
    providers: sortedTimings,
    brackets,
  };
}

// Auto-generate report after 5 seconds
if (typeof window !== "undefined") {
  setTimeout(() => {
    if (profilingEnabled && !reportGenerated) {
      generateProfilingReport();
    }
  }, 5000);
}

/**
 * Simple timing markers that can be added to any provider
 */
export function markProviderStart(name: string) {
  if (!profilingEnabled) return;
  timings.set(name, {
    name,
    mountStart: performance.now() - appStartTime,
  });
}

export function markProviderEnd(name: string) {
  if (!profilingEnabled) return;
  const timing = timings.get(name);
  if (timing) {
    timing.mountEnd = performance.now() - appStartTime;
    timing.mountDuration = timing.mountEnd - timing.mountStart;
  }
}

// Export for use in devtools
if (typeof window !== "undefined") {
  (window as any).__providerProfiler = {
    getTimings: () => Array.from(timings.values()),
    generateReport: generateProfilingReport,
    reset: resetProfiling,
    enable: enableProfiling,
    disable: disableProfiling,
  };
}

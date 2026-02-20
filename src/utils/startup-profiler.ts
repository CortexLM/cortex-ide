/**
 * Startup Performance Profiler
 * Measures provider initialization times to identify performance bottlenecks
 */

interface ProviderTiming {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  phase: 'mount' | 'effect' | 'async';
}

interface StartupReport {
  totalTime: number;
  providers: ProviderTiming[];
  slowestProviders: ProviderTiming[];
  ipcCalls: IPCTiming[];
}

interface IPCTiming {
  command: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class StartupProfiler {
  private enabled = true;
  private startTime = performance.now();
  private providers: Map<string, ProviderTiming> = new Map();
  private ipcCalls: IPCTiming[] = [];
  private reported = false;

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  // Mark provider mount start
  providerStart(name: string, phase: 'mount' | 'effect' | 'async' = 'mount') {
    if (!this.enabled) return;
    
    const key = `${name}-${phase}`;
    this.providers.set(key, {
      name,
      startTime: performance.now(),
      phase
    });
    
    if (phase === 'mount' && import.meta.env.DEV) {
      console.log(`%c[Profiler] ${name} mounting...`, 'color: #888');
    }
  }

  // Mark provider mount end
  providerEnd(name: string, phase: 'mount' | 'effect' | 'async' = 'mount') {
    if (!this.enabled) return;
    
    const key = `${name}-${phase}`;
    const timing = this.providers.get(key);
    if (timing) {
      timing.endTime = performance.now();
      timing.duration = timing.endTime - timing.startTime;
      
      if (import.meta.env.DEV) {
        const color = timing.duration > 100 ? 'color: #ff6b6b; font-weight: bold' :
                      timing.duration > 50 ? 'color: #ffd93d' :
                      'color: #6bcb77';
        
        console.log(
          `%c[Profiler] ${name} (${phase}): ${timing.duration.toFixed(2)}ms`,
          color
        );
      }
    }
  }

  // Track IPC calls
  ipcStart(command: string): number {
    if (!this.enabled) return -1;
    
    const index = this.ipcCalls.length;
    this.ipcCalls.push({
      command,
      startTime: performance.now()
    });
    return index;
  }

  ipcEnd(index: number) {
    if (!this.enabled || index < 0) return;
    
    const call = this.ipcCalls[index];
    if (call) {
      call.endTime = performance.now();
      call.duration = call.endTime - call.startTime;
    }
  }

  // Generate and print report
  report(): StartupReport {
    if (this.reported) return this.getReport();
    this.reported = true;

    const totalTime = performance.now() - this.startTime;
    const providerList = Array.from(this.providers.values())
      .filter(p => p.duration !== undefined);
    
    const slowestProviders = [...providerList]
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    const slowIpcCalls = [...this.ipcCalls]
      .filter(c => c.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    if (import.meta.env.DEV) {
      console.log('\n');
      console.log('%c╔══════════════════════════════════════════════════════════════╗', 'color: #4fc3f7');
      console.log('%c║            STARTUP PERFORMANCE REPORT                        ║', 'color: #4fc3f7; font-weight: bold');
      console.log('%c╚══════════════════════════════════════════════════════════════╝', 'color: #4fc3f7');
      console.log(`%cTotal startup time: ${totalTime.toFixed(2)}ms`, 'color: #fff; font-size: 14px; font-weight: bold');
      console.log('\n');

      console.log('%c🐌 SLOWEST PROVIDERS (Top 10):', 'color: #ff6b6b; font-weight: bold');
      console.table(slowestProviders.map(p => ({
        Provider: p.name,
        Phase: p.phase,
        'Duration (ms)': p.duration?.toFixed(2)
      })));

      if (slowIpcCalls.length > 0) {
        console.log('\n%c📡 SLOWEST IPC CALLS (Top 10):', 'color: #ffd93d; font-weight: bold');
        console.table(slowIpcCalls.map(c => ({
          Command: c.command,
          'Duration (ms)': c.duration?.toFixed(2)
        })));
      }

      // Provider breakdown by phase
      const mountPhase = providerList.filter(p => p.phase === 'mount');
      const effectPhase = providerList.filter(p => p.phase === 'effect');
      const asyncPhase = providerList.filter(p => p.phase === 'async');

      const mountTotal = mountPhase.reduce((sum, p) => sum + (p.duration || 0), 0);
      const effectTotal = effectPhase.reduce((sum, p) => sum + (p.duration || 0), 0);
      const asyncTotal = asyncPhase.reduce((sum, p) => sum + (p.duration || 0), 0);

      console.log('\n%c📊 TIME BY PHASE:', 'color: #6bcb77; font-weight: bold');
      console.table({
        'Mount (sync)': { Count: mountPhase.length, 'Total (ms)': mountTotal.toFixed(2) },
        'Effect (onMount)': { Count: effectPhase.length, 'Total (ms)': effectTotal.toFixed(2) },
        'Async (promises)': { Count: asyncPhase.length, 'Total (ms)': asyncTotal.toFixed(2) }
      });
    }

    return {
      totalTime,
      providers: providerList,
      slowestProviders,
      ipcCalls: this.ipcCalls
    };
  }

  private getReport(): StartupReport {
    const totalTime = performance.now() - this.startTime;
    const providerList = Array.from(this.providers.values());
    return {
      totalTime,
      providers: providerList,
      slowestProviders: providerList.slice(0, 10),
      ipcCalls: this.ipcCalls
    };
  }

  reset() {
    this.startTime = performance.now();
    this.providers.clear();
    this.ipcCalls = [];
    this.reported = false;
  }
}

// Global singleton
export const profiler = new StartupProfiler();

// Helper hook for profiling providers
export function profileProvider(name: string) {
  profiler.providerStart(name, 'mount');
  
  return {
    mounted() {
      profiler.providerEnd(name, 'mount');
    },
    effectStart() {
      profiler.providerStart(name, 'effect');
    },
    effectEnd() {
      profiler.providerEnd(name, 'effect');
    },
    asyncStart() {
      profiler.providerStart(name, 'async');
    },
    asyncEnd() {
      profiler.providerEnd(name, 'async');
    }
  };
}

// Wrap invoke to track IPC calls
export function profiledInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const index = profiler.ipcStart(command);
  
  return import('@tauri-apps/api/core').then(({ invoke }) => {
    return invoke<T>(command, args).finally(() => {
      profiler.ipcEnd(index);
    });
  });
}

// Auto-report after delay
if (typeof window !== 'undefined') {
  setTimeout(() => {
    profiler.report();
  }, 5000);
}

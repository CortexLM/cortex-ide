/**
 * Telemetry Client - Handles event collection, queuing, and batch sending
 * Privacy-first design with opt-in/opt-out support
 */

import { arch, version as osVersion, type as osType } from "@tauri-apps/plugin-os";
import { getVersion } from "../tauri";
import type {
  TelemetryEvent,
  TelemetryEventWrapper,
  TelemetryRequestBody,
  AnyTelemetryEvent,
} from "./TelemetryEvents";

// ============================================================================
// Configuration
// ============================================================================

export interface TelemetryConfig {
  /** Whether telemetry is enabled (opt-in) */
  enabled: boolean;
  /** Telemetry endpoint URL */
  endpoint: string;
  /** Batch size before automatic flush */
  batchSize: number;
  /** Flush interval in milliseconds */
  flushInterval: number;
  /** Maximum queue size before dropping old events */
  maxQueueSize: number;
  /** Enable debug logging */
  debug: boolean;
  /** Release channel (stable, preview, dev) */
  releaseChannel: string;
}

const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: false, // Opt-in by default (privacy-first)
  endpoint: "",   // Must be configured
  batchSize: 20,
  flushInterval: 60000, // 1 minute
  maxQueueSize: 500,
  debug: false,
  releaseChannel: "dev",
};

// Storage keys
const STORAGE_PREFIX = "cortex_telemetry_";
const INSTALLATION_ID_KEY = `${STORAGE_PREFIX}installation_id`;
const SESSION_ID_KEY = `${STORAGE_PREFIX}session_id`;
const ENABLED_KEY = `${STORAGE_PREFIX}enabled`;
const QUEUE_KEY = `${STORAGE_PREFIX}event_queue`;

// ============================================================================
// Utility Functions
// ============================================================================

/** Generate a random UUID v4 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Hash a string to create anonymous identifier */
async function hashString(str: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback: simple hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ============================================================================
// Telemetry Client Class
// ============================================================================

export class TelemetryClient {
  private config: TelemetryConfig;
  private eventQueue: TelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private firstEventTimestamp: number | null = null;
  private sessionStartTime: number;
  private installationId: string | null = null;
  private sessionId: string;
  private isInitialized = false;
  private isFlushing = false;
  private systemInfo: {
    osName: string;
    osVersion: string;
    architecture: string;
    appVersion: string;
  } | null = null;
  private beforeUnloadHandler: (() => void) | null = null;
  private visibilityChangeHandler: (() => void) | null = null;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = generateUUID();
    this.sessionStartTime = Date.now();
    this.loadConfig();
    this.loadQueue();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /** Initialize the telemetry client */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get or create installation ID
      this.installationId = await this.getOrCreateInstallationId();

      // Store session ID
      sessionStorage.setItem(SESSION_ID_KEY, this.sessionId);

      // Gather system information
      await this.gatherSystemInfo();

      // Start flush timer if enabled
      if (this.config.enabled) {
        this.startFlushTimer();
      }

      // Set up beforeunload handler to flush remaining events
      if (typeof window !== "undefined") {
        this.beforeUnloadHandler = () => {
          this.flush(true);
        };
        window.addEventListener("beforeunload", this.beforeUnloadHandler);

        // Track visibility changes
        this.visibilityChangeHandler = () => {
          if (document.visibilityState === "hidden") {
            this.flush(true);
          }
        };
        document.addEventListener("visibilitychange", this.visibilityChangeHandler);
      }

      this.isInitialized = true;
      this.log("Telemetry client initialized");
    } catch (error) {
      console.error("[Telemetry] Failed to initialize:", error);
    }
  }

  /** Get or create an anonymous installation ID */
  private async getOrCreateInstallationId(): Promise<string> {
    let id = localStorage.getItem(INSTALLATION_ID_KEY);
    if (!id) {
      // Generate an anonymous ID based on random data
      // We don't use hardware IDs or fingerprinting for privacy
      const randomPart = generateUUID();
      id = await hashString(randomPart + Date.now().toString());
      localStorage.setItem(INSTALLATION_ID_KEY, id);
    }
    return id;
  }

  /** Gather system information */
  private async gatherSystemInfo(): Promise<void> {
    try {
      // OS info is synchronous from tauri plugin-os
      let osName = "unknown";
      let archValue = "unknown";
      let osVer = "unknown";
      let appVer = "0.0.0";

      try {
        osName = osType();
      } catch {
        // Fallback if not in Tauri environment
      }

      try {
        archValue = arch();
      } catch {
        // Fallback if not in Tauri environment
      }

      try {
        osVer = osVersion();
      } catch {
        // Fallback if not in Tauri environment
      }

      try {
        appVer = await getVersion();
      } catch {
        // Fallback if not in Tauri environment
      }

      this.systemInfo = {
        osName,
        osVersion: osVer,
        architecture: archValue,
        appVersion: appVer,
      };
    } catch (error) {
      this.log("Failed to gather system info:", error);
      this.systemInfo = {
        osName: "unknown",
        osVersion: "unknown",
        architecture: "unknown",
        appVersion: "0.0.0",
      };
    }
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  /** Load configuration from storage */
  private loadConfig(): void {
    try {
      const enabled = localStorage.getItem(ENABLED_KEY);
      if (enabled !== null) {
        this.config.enabled = enabled === "true";
      }
    } catch {
      // Ignore storage errors
    }
  }

  /** Save configuration to storage */
  private saveConfig(): void {
    try {
      localStorage.setItem(ENABLED_KEY, String(this.config.enabled));
    } catch {
      // Ignore storage errors
    }
  }

  /** Enable telemetry collection */
  enable(): void {
    this.config.enabled = true;
    this.saveConfig();
    this.startFlushTimer();
    this.log("Telemetry enabled");
  }

  /** Disable telemetry collection */
  disable(): void {
    this.config.enabled = false;
    this.saveConfig();
    this.stopFlushTimer();
    // Optionally clear queue when disabled
    this.eventQueue = [];
    this.clearPersistedQueue();
    this.log("Telemetry disabled");
  }

  /** Check if telemetry is enabled */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Update configuration */
  updateConfig(config: Partial<TelemetryConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (config.enabled !== undefined) {
      this.saveConfig();
      if (config.enabled && !wasEnabled) {
        this.startFlushTimer();
      } else if (!config.enabled && wasEnabled) {
        this.stopFlushTimer();
      }
    }
  }

  /** Get current configuration */
  getConfig(): Readonly<TelemetryConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // Event Tracking
  // ============================================================================

  /** Track a telemetry event */
  track(event: AnyTelemetryEvent): void {
    if (!this.config.enabled) {
      this.log("Event dropped (telemetry disabled):", event.type);
      return;
    }

    // Ensure timestamp is set
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Track first event timestamp for batch
    if (this.firstEventTimestamp === null) {
      this.firstEventTimestamp = event.timestamp;
    }

    // Add to queue
    this.eventQueue.push(event);
    this.log("Event tracked:", event.type);

    // Check queue limits
    if (this.eventQueue.length > this.config.maxQueueSize) {
      // Remove oldest events
      const excess = this.eventQueue.length - this.config.maxQueueSize;
      this.eventQueue.splice(0, excess);
      this.log(`Dropped ${excess} old events due to queue limit`);
    }

    // Persist queue
    this.persistQueue();

    // Auto-flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /** Track multiple events at once */
  trackBatch(events: AnyTelemetryEvent[]): void {
    events.forEach((event) => this.track(event));
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  /** Persist event queue to localStorage */
  private persistQueue(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.eventQueue));
    } catch {
      // Ignore storage errors (quota exceeded, etc.)
    }
  }

  /** Load event queue from localStorage */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TelemetryEvent[];
        if (Array.isArray(parsed)) {
          this.eventQueue = parsed;
          this.log(`Loaded ${parsed.length} events from storage`);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  /** Clear persisted queue */
  private clearPersistedQueue(): void {
    try {
      localStorage.removeItem(QUEUE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  /** Get current queue size */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /** Clear all pending events */
  clearQueue(): void {
    this.eventQueue = [];
    this.firstEventTimestamp = null;
    this.clearPersistedQueue();
    this.log("Event queue cleared");
  }

  // ============================================================================
  // Flush / Send Events
  // ============================================================================

  /** Start the automatic flush timer */
  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /** Stop the automatic flush timer */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /** Flush events to the server */
  async flush(sync = false): Promise<boolean> {
    if (!this.config.enabled || this.eventQueue.length === 0) {
      return true;
    }

    if (this.isFlushing) {
      this.log("Flush already in progress, skipping");
      return false;
    }

    if (!this.config.endpoint) {
      this.log("No endpoint configured, clearing queue");
      this.clearQueue();
      return false;
    }

    this.isFlushing = true;
    const eventsToSend = [...this.eventQueue];
    const firstTimestamp = this.firstEventTimestamp || eventsToSend[0]?.timestamp || Date.now();

    try {
      // Wrap events with metadata
      const wrappedEvents: TelemetryEventWrapper[] = eventsToSend.map((event) => ({
        signedIn: false, // Can be updated based on auth state
        millisecondsSinceFirstEvent: event.timestamp - firstTimestamp,
        event,
      }));

      // Build request body
      const body: TelemetryRequestBody = {
        installationId: this.installationId || "unknown",
        sessionId: this.sessionId,
        appVersion: this.systemInfo?.appVersion || "0.0.0",
        osName: this.systemInfo?.osName || "unknown",
        osVersion: this.systemInfo?.osVersion || "unknown",
        architecture: this.systemInfo?.architecture || "unknown",
        releaseChannel: this.config.releaseChannel,
        events: wrappedEvents,
      };

      this.log(`Flushing ${eventsToSend.length} events`);

      // Send events
      if (sync && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        // Use sendBeacon for sync flush (before page unload)
        const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
        const success = navigator.sendBeacon(this.config.endpoint, blob);
        if (success) {
          this.onFlushSuccess(eventsToSend.length);
        }
        return success;
      } else {
        // Use fetch for async flush
        const response = await fetch(this.config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          this.onFlushSuccess(eventsToSend.length);
          return true;
        } else {
          this.log(`Flush failed with status ${response.status}`);
          return false;
        }
      }
    } catch (error) {
      this.log("Flush failed:", error);
      return false;
    } finally {
      this.isFlushing = false;
    }
  }

  /** Called after successful flush */
  private onFlushSuccess(count: number): void {
    // Remove sent events from queue
    this.eventQueue.splice(0, count);
    this.firstEventTimestamp = this.eventQueue.length > 0 ? this.eventQueue[0].timestamp : null;
    this.persistQueue();
    this.log(`Successfully flushed ${count} events`);
  }

  // ============================================================================
  // Metrics / Stats
  // ============================================================================

  /** Get telemetry statistics */
  getStats(): TelemetryStats {
    return {
      enabled: this.config.enabled,
      queueSize: this.eventQueue.length,
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.sessionStartTime,
      installationId: this.installationId
        ? `${this.installationId.slice(0, 8)}...`
        : null,
    };
  }

  /** Get session ID */
  getSessionId(): string {
    return this.sessionId;
  }

  /** Get session duration in milliseconds */
  getSessionDuration(): number {
    return Date.now() - this.sessionStartTime;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /** Cleanup and destroy the client */
  destroy(): void {
    this.stopFlushTimer();
    // Attempt to flush remaining events synchronously
    if (this.eventQueue.length > 0) {
      this.flush(true);
    }
    
    // Remove event listeners
    if (typeof window !== "undefined") {
      if (this.beforeUnloadHandler) {
        window.removeEventListener("beforeunload", this.beforeUnloadHandler);
        this.beforeUnloadHandler = null;
      }
      if (this.visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", this.visibilityChangeHandler);
        this.visibilityChangeHandler = null;
      }
    }
    
    this.isInitialized = false;
    this.log("Telemetry client destroyed");
  }

  // ============================================================================
  // Debug Logging
  // ============================================================================

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[Telemetry]", ...args);
    }
  }
}

// ============================================================================
// Types
// ============================================================================

export interface TelemetryStats {
  enabled: boolean;
  queueSize: number;
  sessionId: string;
  sessionDuration: number;
  installationId: string | null;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: TelemetryClient | null = null;

/** Get or create the telemetry client singleton */
export function getTelemetryClient(config?: Partial<TelemetryConfig>): TelemetryClient {
  if (!clientInstance) {
    clientInstance = new TelemetryClient(config);
  } else if (config) {
    clientInstance.updateConfig(config);
  }
  return clientInstance;
}

/** Reset the telemetry client singleton (mainly for testing) */
export function resetTelemetryClient(): void {
  if (clientInstance) {
    clientInstance.destroy();
    clientInstance = null;
  }
}

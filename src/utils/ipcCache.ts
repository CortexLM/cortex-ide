/**
 * Frontend IPC Cache with TTL
 *
 * Provides `cachedInvoke()` — a caching wrapper around Tauri `invoke()`.
 * Supports per-command TTL, LRU eviction, and automatic invalidation
 * triggered by application events.
 *
 * Pre-configured for high-frequency read-only commands that are safe to
 * cache (settings, extensions, version, themes, keybindings).
 */

import { invoke } from "@tauri-apps/api/core";

export interface CacheOptions {
  ttl?: number;
  bypassCache?: boolean;
}

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

const DEFAULT_MAX_SIZE = 128;

const DEFAULT_TTLS: Record<string, number> = {
  settings_load: 30_000,
  settings_get: 30_000,
  get_version: Infinity,
  get_extensions: 60_000,
  get_enabled_extensions: 60_000,
  list_available_themes: 120_000,
  load_keybindings_file: 60_000,
  get_default_keybindings: Infinity,
};

const INVALIDATION_MAP: Record<string, string[]> = {
  "settings:changed": ["settings_load", "settings_get"],
  "extension:installed": ["get_extensions", "get_enabled_extensions"],
  "extension:uninstalled": ["get_extensions", "get_enabled_extensions"],
  "extension:enabled": ["get_enabled_extensions"],
  "extension:disabled": ["get_enabled_extensions"],
};

class IpcCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private maxSize: number;
  private cleanupFns: Array<() => void> = [];

  constructor(maxSize = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
    this.setupEventListeners();
  }

  private makeKey(cmd: string, args?: Record<string, unknown>): string {
    if (!args || Object.keys(args).length === 0) return cmd;
    return `${cmd}:${JSON.stringify(args)}`;
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()!;
      this.cache.delete(oldest);
    }
  }

  private touch(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(key);
  }

  get<T>(cmd: string, args?: Record<string, unknown>): T | undefined {
    const key = this.makeKey(cmd, args);
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      const idx = this.accessOrder.indexOf(key);
      if (idx !== -1) this.accessOrder.splice(idx, 1);
      return undefined;
    }
    this.touch(key);
    return entry.value as T;
  }

  set<T>(cmd: string, args: Record<string, unknown> | undefined, value: T, ttl: number): void {
    const key = this.makeKey(cmd, args);
    this.evictIfNeeded();
    this.cache.set(key, {
      value,
      expiresAt: ttl === Infinity ? Infinity : Date.now() + ttl,
    });
    this.touch(key);
  }

  invalidate(cmd?: string): void {
    if (!cmd) {
      this.cache.clear();
      this.accessOrder = [];
      return;
    }
    const prefix = cmd;
    const toDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key === prefix || key.startsWith(prefix + ":")) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      this.cache.delete(key);
      const idx = this.accessOrder.indexOf(key);
      if (idx !== -1) this.accessOrder.splice(idx, 1);
    }
  }

  get size(): number {
    return this.cache.size;
  }

  private setupEventListeners(): void {
    for (const [eventName, commands] of Object.entries(INVALIDATION_MAP)) {
      const handler = () => {
        for (const cmd of commands) {
          this.invalidate(cmd);
        }
      };
      window.addEventListener(eventName, handler);
      this.cleanupFns.push(() => window.removeEventListener(eventName, handler));
    }
  }

  destroy(): void {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    this.cache.clear();
    this.accessOrder = [];
  }
}

let defaultCache = new IpcCache();

/**
 * Invoke a Tauri command with transparent caching.
 *
 * Uses a pre-configured TTL for known commands, or falls back to
 * a direct `invoke()` for unknown commands (no caching).
 */
export async function cachedInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options?: CacheOptions,
): Promise<T> {
  const ttl = options?.ttl ?? DEFAULT_TTLS[cmd];

  if (ttl === undefined || options?.bypassCache) {
    return invoke<T>(cmd, args);
  }

  const cached = defaultCache.get<T>(cmd, args);
  if (cached !== undefined) return cached;

  const result = await invoke<T>(cmd, args);
  defaultCache.set(cmd, args, result, ttl);
  return result;
}

/**
 * Invalidate cached results for a specific command, or all commands.
 */
export function invalidateIpcCache(cmd?: string): void {
  defaultCache.invalidate(cmd);
}

/**
 * Get the current cache size (number of entries).
 */
export function getIpcCacheSize(): number {
  return defaultCache.size;
}

/**
 * Reset the cache instance. Intended for tests only.
 */
export function _resetIpcCache(): void {
  defaultCache.destroy();
  defaultCache = new IpcCache();
}

export { IpcCache, DEFAULT_TTLS, INVALIDATION_MAP };

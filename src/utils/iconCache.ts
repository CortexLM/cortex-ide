const STORAGE_KEY = "cortex_icon_cache";

const memoryCache = new Map<string, string>();

function hydrateFromStorage(): void {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const entries: [string, string][] = JSON.parse(stored);
      for (const [k, v] of entries) {
        memoryCache.set(k, v);
      }
    }
  } catch {
    // sessionStorage unavailable or corrupt — start fresh
  }
}

function persistToStorage(): void {
  try {
    const entries = Array.from(memoryCache.entries());
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // quota exceeded or unavailable — silently ignore
  }
}

hydrateFromStorage();

export function getFromCache(name: string): string | undefined {
  return memoryCache.get(name);
}

export function addToCache(name: string, svg: string): void {
  memoryCache.set(name, svg);
  persistToStorage();
}

export function hasInCache(name: string): boolean {
  return memoryCache.has(name);
}

export function clearCache(): void {
  memoryCache.clear();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

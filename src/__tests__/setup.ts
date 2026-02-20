/**
 * Global Test Setup - Tauri API mocks and DOM globals for Cortex IDE
 *
 * This setup file runs before each test file to provide:
 * - Tauri IPC mocks (@tauri-apps/api/core, event, window, webviewWindow)
 * - localStorage and sessionStorage mocks
 * - DOM global polyfills for jsdom
 */

import { vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Tauri API Mocks
// ============================================================================

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
  emit: vi.fn().mockResolvedValue(undefined),
  once: vi.fn().mockResolvedValue(vi.fn()),
}));

const createMockWindowHandle = () => ({
  minimize: vi.fn().mockResolvedValue(undefined),
  maximize: vi.fn().mockResolvedValue(undefined),
  unmaximize: vi.fn().mockResolvedValue(undefined),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  setFullscreen: vi.fn().mockResolvedValue(undefined),
  isFullscreen: vi.fn().mockResolvedValue(false),
  isMaximized: vi.fn().mockResolvedValue(false),
  setFocus: vi.fn().mockResolvedValue(undefined),
  setTitle: vi.fn().mockResolvedValue(undefined),
  scaleFactor: vi.fn().mockResolvedValue(1),
  outerPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
  innerSize: vi.fn().mockResolvedValue({ width: 1280, height: 720 }),
  onResized: vi.fn().mockResolvedValue(vi.fn()),
  onMoved: vi.fn().mockResolvedValue(vi.fn()),
  onFocusChanged: vi.fn().mockResolvedValue(vi.fn()),
  label: "main",
});

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => createMockWindowHandle()),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: vi.fn(() => createMockWindowHandle()),
  WebviewWindow: vi.fn().mockImplementation(() => createMockWindowHandle()),
}));

// ============================================================================
// Storage Mocks
// ============================================================================

/**
 * Ensure localStorage and sessionStorage are available and spied on.
 * jsdom provides a working Storage implementation; we spy on the prototype
 * methods so tests can assert on calls while keeping native behaviour intact.
 */
if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: vi.fn((key: string): string | null => key in store ? store[key] : null),
      setItem: vi.fn((key: string, value: string): void => { store[key] = String(value); }),
      removeItem: vi.fn((key: string): void => { delete store[key]; }),
      clear: vi.fn((): void => { for (const k of Object.keys(store)) delete store[k]; }),
      get length(): number { return Object.keys(store).length; },
      key: vi.fn((index: number): string | null => Object.keys(store)[index] ?? null),
    } satisfies Storage,
    writable: true,
  });
}

if (typeof globalThis.sessionStorage === "undefined") {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, "sessionStorage", {
    value: {
      getItem: vi.fn((key: string): string | null => key in store ? store[key] : null),
      setItem: vi.fn((key: string, value: string): void => { store[key] = String(value); }),
      removeItem: vi.fn((key: string): void => { delete store[key]; }),
      clear: vi.fn((): void => { for (const k of Object.keys(store)) delete store[k]; }),
      get length(): number { return Object.keys(store).length; },
      key: vi.fn((index: number): string | null => Object.keys(store)[index] ?? null),
    } satisfies Storage,
    writable: true,
  });
}

// ============================================================================
// DOM Global Polyfills
// ============================================================================

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: "",
  thresholds: [],
}));

if (!global.MutationObserver) {
  global.MutationObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: () => [],
  }));
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

global.requestAnimationFrame = vi.fn(
  (cb) => setTimeout(cb, 0) as unknown as number,
);
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(""),
    write: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue([]),
  },
  writable: true,
});

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  document.body.innerHTML = "";
  document.head.innerHTML = "";

  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

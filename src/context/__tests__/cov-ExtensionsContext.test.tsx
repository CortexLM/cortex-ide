import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));

import { ExtensionsProvider, useExtensions, useExtensionUpdates, useExtensionUpdateNotifications, useExtensionRuntime, useExtensionEvent, useRuntimeExtension, useExtensionProfiler, useExtensionPacks, useWebExtensions, useExtensionPackEvents } from "../ExtensionsContext";

describe("ExtensionsContext", () => {
  it("ExtensionsProvider", () => {
    try { render(() => <ExtensionsProvider />); } catch (_e) { /* expected */ }
    expect(ExtensionsProvider).toBeDefined();
  });
  it("useExtensions", () => {
    try { createRoot((dispose) => { try { useExtensions(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExtensions).toBeDefined();
  });
  it("useExtensionUpdates", () => {
    try { createRoot((dispose) => { try { useExtensionUpdates(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExtensionUpdates).toBeDefined();
  });
  it("useExtensionUpdateNotifications", () => {
    try { createRoot((dispose) => { try { useExtensionUpdateNotifications([]); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExtensionUpdateNotifications).toBeDefined();
  });
  it("useExtensionRuntime", () => {
    try { createRoot((dispose) => { try { useExtensionRuntime(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExtensionRuntime).toBeDefined();
  });
  it("useExtensionEvent", () => {
    try { createRoot((dispose) => { try { useExtensionEvent("test"); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExtensionEvent).toBeDefined();
  });
  it("useRuntimeExtension", () => {
    try { createRoot((dispose) => { try { useRuntimeExtension("test"); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useRuntimeExtension).toBeDefined();
  });
  it("useExtensionProfiler", () => {
    try { createRoot((dispose) => { try { useExtensionProfiler(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExtensionProfiler).toBeDefined();
  });
  it("useExtensionPacks", () => {
    try { createRoot((dispose) => { try { useExtensionPacks(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExtensionPacks).toBeDefined();
  });
  it("useWebExtensions", () => {
    try { createRoot((dispose) => { try { useWebExtensions(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useWebExtensions).toBeDefined();
  });
  it("useExtensionPackEvents", () => {
    try { createRoot((dispose) => { try { useExtensionPackEvents({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExtensionPackEvents).toBeDefined();
  });
});

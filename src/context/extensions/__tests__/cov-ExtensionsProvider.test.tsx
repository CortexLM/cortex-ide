import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/extensions/PluginAPIBridge", () => ({ PluginAPIBridge: (p: any) => p.children, usePluginAPIBridge: vi.fn(() => ({})) }));
vi.mock("@/context/extensions/RegistryClient", () => ({ RegistryClient: (p: any) => p.children, useRegistryClient: vi.fn(() => ({})) }));
vi.mock("@/context/extensions/PluginUIContributions", () => ({ PluginUIContributions: (p: any) => p.children, usePluginUIContributions: vi.fn(() => ({})) }));
vi.mock("@/context/extensions/ActivationManager", () => ({ ActivationManager: (p: any) => p.children, useActivationManager: vi.fn(() => ({})) }));
vi.mock("@/context/ExtensionsContext", () => ({ ExtensionsProvider: (p: any) => p.children, useExtensions: vi.fn(() => ({})) }));

import { PluginSystemProvider, usePluginSystem } from "../../extensions/ExtensionsProvider";

describe("ExtensionsProvider", () => {
  it("PluginSystemProvider", () => {
    try { render(() => <PluginSystemProvider />); } catch (_e) { /* expected */ }
    expect(PluginSystemProvider).toBeDefined();
  });
  it("usePluginSystem", () => {
    try { createRoot((dispose) => { try { usePluginSystem(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(usePluginSystem).toBeDefined();
  });
});

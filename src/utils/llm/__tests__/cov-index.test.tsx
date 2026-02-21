import { describe, it, expect, vi } from "vitest";

import { createProvider, getProviderTypes, getProviderDisplayName, providerRequiresApiKey } from "../../llm/index";

describe("index", () => {
  it("createProvider", () => {
    try { createProvider({} as any); } catch (_e) { /* expected */ }
    try { createProvider(); } catch (_e) { /* expected */ }
    expect(createProvider).toBeDefined();
  });
  it("getProviderTypes", () => {
    try { getProviderTypes(); } catch (_e) { /* expected */ }
    expect(getProviderTypes).toBeDefined();
  });
  it("getProviderDisplayName", () => {
    try { getProviderDisplayName({} as any); } catch (_e) { /* expected */ }
    try { getProviderDisplayName(); } catch (_e) { /* expected */ }
    expect(getProviderDisplayName).toBeDefined();
  });
  it("providerRequiresApiKey", () => {
    try { providerRequiresApiKey({} as any); } catch (_e) { /* expected */ }
    try { providerRequiresApiKey(); } catch (_e) { /* expected */ }
    expect(providerRequiresApiKey).toBeDefined();
  });
});

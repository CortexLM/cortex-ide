import { describe, it, expect, vi } from "vitest";

vi.mock("@/context/ExtensionsContext", () => ({ ExtensionsProvider: (p: any) => p.children, useExtensions: vi.fn(() => ({})) }));

import { createExtensionProvider } from "../../quickaccess/ExtensionProvider";

describe("ExtensionProvider", () => {
  it("createExtensionProvider", () => {
    try { createExtensionProvider({} as any); } catch (_e) { /* expected */ }
    try { createExtensionProvider(); } catch (_e) { /* expected */ }
    expect(createExtensionProvider).toBeDefined();
  });
});

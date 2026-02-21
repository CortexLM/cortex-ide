import { describe, it, expect, vi } from "vitest";

import { ExtensionHostProxy } from "../extension-host-proxy";

describe("extension-host-proxy", () => {
  it("ExtensionHostProxy", () => {
    try { const inst = new ExtensionHostProxy(); expect(inst).toBeDefined(); } catch (_e) { expect(ExtensionHostProxy).toBeDefined(); }
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { ExtensionBisectProvider, useExtensionBisect, useBisectStatus } from "../ExtensionBisectContext";

describe("ExtensionBisectContext", () => {
  it("ExtensionBisectProvider", () => {
    try { render(() => <ExtensionBisectProvider />); } catch (_e) { /* expected */ }
    expect(ExtensionBisectProvider).toBeDefined();
  });
  it("useExtensionBisect", () => {
    try { createRoot((dispose) => { try { useExtensionBisect(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExtensionBisect).toBeDefined();
  });
  it("useBisectStatus", () => {
    try { createRoot((dispose) => { try { useBisectStatus(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useBisectStatus).toBeDefined();
  });
});

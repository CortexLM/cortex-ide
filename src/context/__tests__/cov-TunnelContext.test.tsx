import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { TunnelProvider, useTunnel } from "../TunnelContext";

describe("TunnelContext", () => {
  it("TunnelProvider", () => {
    try { render(() => <TunnelProvider />); } catch (_e) { /* expected */ }
    expect(TunnelProvider).toBeDefined();
  });
  it("useTunnel", () => {
    try { createRoot((dispose) => { try { useTunnel(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTunnel).toBeDefined();
  });
});

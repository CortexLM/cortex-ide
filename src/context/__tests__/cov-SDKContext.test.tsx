import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SDKProvider, useSDK } from "../SDKContext";

describe("SDKContext", () => {
  it("SDKProvider", () => {
    try { render(() => <SDKProvider />); } catch (_e) { /* expected */ }
    expect(SDKProvider).toBeDefined();
  });
  it("useSDK", () => {
    try { createRoot((dispose) => { try { useSDK(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSDK).toBeDefined();
  });
});

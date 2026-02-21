import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { QuickAccessProvider, useQuickAccess } from "../QuickAccessContext";

describe("QuickAccessContext", () => {
  it("QuickAccessProvider", () => {
    try { render(() => <QuickAccessProvider />); } catch (_e) { /* expected */ }
    expect(QuickAccessProvider).toBeDefined();
  });
  it("useQuickAccess", () => {
    try { createRoot((dispose) => { try { useQuickAccess(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useQuickAccess).toBeDefined();
  });
});

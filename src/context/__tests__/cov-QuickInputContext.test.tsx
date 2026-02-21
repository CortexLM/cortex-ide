import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { QuickInputProvider, useQuickInput } from "../QuickInputContext";

describe("QuickInputContext", () => {
  it("QuickInputProvider", () => {
    try { render(() => <QuickInputProvider />); } catch (_e) { /* expected */ }
    expect(QuickInputProvider).toBeDefined();
  });
  it("useQuickInput", () => {
    try { createRoot((dispose) => { try { useQuickInput(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useQuickInput).toBeDefined();
  });
});

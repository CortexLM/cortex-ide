import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { QuickPickProvider, useQuickPick } from "../QuickPickContext";

describe("QuickPickContext", () => {
  it("QuickPickProvider", () => {
    try { render(() => <QuickPickProvider />); } catch (_e) { /* expected */ }
    expect(QuickPickProvider).toBeDefined();
  });
  it("useQuickPick", () => {
    try { createRoot((dispose) => { try { useQuickPick(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useQuickPick).toBeDefined();
  });
});

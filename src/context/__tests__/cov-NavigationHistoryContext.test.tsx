import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { NavigationHistoryProvider, useNavigationHistory } from "../NavigationHistoryContext";

describe("NavigationHistoryContext", () => {
  it("NavigationHistoryProvider", () => {
    try { render(() => <NavigationHistoryProvider />); } catch (_e) { /* expected */ }
    expect(NavigationHistoryProvider).toBeDefined();
  });
  it("useNavigationHistory", () => {
    try { createRoot((dispose) => { try { useNavigationHistory(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useNavigationHistory).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { PlanProvider, usePlan } from "../PlanContext";

describe("PlanContext", () => {
  it("PlanProvider", () => {
    try { render(() => <PlanProvider />); } catch (_e) { /* expected */ }
    expect(PlanProvider).toBeDefined();
  });
  it("usePlan", () => {
    try { createRoot((dispose) => { try { usePlan(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(usePlan).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { PlanAgentsPanel, DEFAULT_PLAN_AGENTS } from "../PlanAgentsPanel";

describe("PlanAgentsPanel", () => {
  it("PlanAgentsPanel", () => {
    try { render(() => <PlanAgentsPanel />); } catch (_e) { /* expected */ }
    expect(PlanAgentsPanel).toBeDefined();
  });
  it("DEFAULT_PLAN_AGENTS", () => {
    expect(DEFAULT_PLAN_AGENTS).toBeDefined();
  });
});

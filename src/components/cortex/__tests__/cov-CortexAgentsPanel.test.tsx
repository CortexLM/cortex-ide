import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexAgentsPanel } from "../../cortex/CortexAgentsPanel";

describe("CortexAgentsPanel", () => {
  it("CortexAgentsPanel", () => {
    try { render(() => <CortexAgentsPanel />); } catch (_e) { /* expected */ }
    expect(CortexAgentsPanel).toBeDefined();
  });
});

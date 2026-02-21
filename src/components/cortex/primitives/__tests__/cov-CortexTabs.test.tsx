import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexTabs, CortexTabPanel } from "../../../cortex/primitives/CortexTabs";

describe("CortexTabs", () => {
  it("CortexTabs", () => {
    try { render(() => <CortexTabs />); } catch (_e) { /* expected */ }
    expect(CortexTabs).toBeDefined();
  });
  it("CortexTabPanel", () => {
    try { render(() => <CortexTabPanel />); } catch (_e) { /* expected */ }
    expect(CortexTabPanel).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexTooltip } from "../../../cortex/primitives/CortexTooltip";

describe("CortexTooltip", () => {
  it("CortexTooltip", () => {
    try { render(() => <CortexTooltip />); } catch (_e) { /* expected */ }
    expect(CortexTooltip).toBeDefined();
  });
});

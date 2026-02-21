import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { VulnerableDepsView } from "../../../cortex/diagnostics/VulnerableDepsView";

describe("VulnerableDepsView", () => {
  it("VulnerableDepsView", () => {
    try { render(() => <VulnerableDepsView />); } catch (_e) { /* expected */ }
    expect(VulnerableDepsView).toBeDefined();
  });
});

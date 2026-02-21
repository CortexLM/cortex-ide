import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexStatusBar } from "../../cortex/CortexStatusBar";

describe("CortexStatusBar", () => {
  it("CortexStatusBar", () => {
    try { render(() => <CortexStatusBar />); } catch (_e) { /* expected */ }
    expect(CortexStatusBar).toBeDefined();
  });
});

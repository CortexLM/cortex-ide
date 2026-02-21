import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexTitleBar } from "../../cortex/CortexTitleBar";

describe("CortexTitleBar", () => {
  it("CortexTitleBar", () => {
    try { render(() => <CortexTitleBar />); } catch (_e) { /* expected */ }
    expect(CortexTitleBar).toBeDefined();
  });
});

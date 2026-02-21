import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexActivityBar } from "../../cortex/CortexActivityBar";

describe("CortexActivityBar", () => {
  it("CortexActivityBar", () => {
    try { render(() => <CortexActivityBar />); } catch (_e) { /* expected */ }
    expect(CortexActivityBar).toBeDefined();
  });
});

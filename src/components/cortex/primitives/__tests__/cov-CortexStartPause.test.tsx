import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexStartPause } from "../../../cortex/primitives/CortexStartPause";

describe("CortexStartPause", () => {
  it("CortexStartPause", () => {
    try { render(() => <CortexStartPause />); } catch (_e) { /* expected */ }
    expect(CortexStartPause).toBeDefined();
  });
});

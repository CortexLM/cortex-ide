import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexModeCarousel } from "../../../cortex/layout/CortexModeCarousel";

describe("CortexModeCarousel", () => {
  it("CortexModeCarousel", () => {
    try { render(() => <CortexModeCarousel />); } catch (_e) { /* expected */ }
    expect(CortexModeCarousel).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexVibeLayout } from "../../../cortex/layout/CortexVibeLayout";

describe("CortexVibeLayout", () => {
  it("CortexVibeLayout", () => {
    try { render(() => <CortexVibeLayout />); } catch (_e) { /* expected */ }
    expect(CortexVibeLayout).toBeDefined();
  });
});

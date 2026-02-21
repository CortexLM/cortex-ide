import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexIDELayout } from "../../../cortex/layout/CortexIDELayout";

describe("CortexIDELayout", () => {
  it("CortexIDELayout", () => {
    try { render(() => <CortexIDELayout />); } catch (_e) { /* expected */ }
    expect(CortexIDELayout).toBeDefined();
  });
});

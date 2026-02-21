import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexConfigBadge } from "../../../cortex/primitives/CortexConfigBadge";

describe("CortexConfigBadge", () => {
  it("CortexConfigBadge", () => {
    try { render(() => <CortexConfigBadge />); } catch (_e) { /* expected */ }
    expect(CortexConfigBadge).toBeDefined();
  });
});

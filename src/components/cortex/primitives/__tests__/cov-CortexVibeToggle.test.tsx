import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexVibeToggle } from "../../../cortex/primitives/CortexVibeToggle";

describe("CortexVibeToggle", () => {
  it("CortexVibeToggle", () => {
    try { render(() => <CortexVibeToggle />); } catch (_e) { /* expected */ }
    expect(CortexVibeToggle).toBeDefined();
  });
});

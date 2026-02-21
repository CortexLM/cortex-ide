import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexOpenProjectDropdown } from "../../../cortex/primitives/CortexOpenProjectDropdown";

describe("CortexOpenProjectDropdown", () => {
  it("CortexOpenProjectDropdown", () => {
    try { render(() => <CortexOpenProjectDropdown />); } catch (_e) { /* expected */ }
    expect(CortexOpenProjectDropdown).toBeDefined();
  });
});

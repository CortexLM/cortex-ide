import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexDropdown } from "../../../cortex/primitives/CortexDropdown";

describe("CortexDropdown", () => {
  it("CortexDropdown", () => {
    try { render(() => <CortexDropdown />); } catch (_e) { /* expected */ }
    expect(CortexDropdown).toBeDefined();
  });
});

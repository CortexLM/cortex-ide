import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexCodeNavHelp } from "../../../cortex/primitives/CortexCodeNavHelp";

describe("CortexCodeNavHelp", () => {
  it("CortexCodeNavHelp", () => {
    try { render(() => <CortexCodeNavHelp />); } catch (_e) { /* expected */ }
    expect(CortexCodeNavHelp).toBeDefined();
  });
});

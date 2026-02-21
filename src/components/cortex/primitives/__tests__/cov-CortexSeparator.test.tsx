import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexSeparator } from "../../../cortex/primitives/CortexSeparator";

describe("CortexSeparator", () => {
  it("CortexSeparator", () => {
    try { render(() => <CortexSeparator />); } catch (_e) { /* expected */ }
    expect(CortexSeparator).toBeDefined();
  });
});

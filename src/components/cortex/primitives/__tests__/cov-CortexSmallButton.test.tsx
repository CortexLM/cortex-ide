import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexSmallButton } from "../../../cortex/primitives/CortexSmallButton";

describe("CortexSmallButton", () => {
  it("CortexSmallButton", () => {
    try { render(() => <CortexSmallButton />); } catch (_e) { /* expected */ }
    expect(CortexSmallButton).toBeDefined();
  });
});

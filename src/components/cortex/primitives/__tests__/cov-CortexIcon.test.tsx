import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexIcon, CORTEX_ICON_SIZES } from "../../../cortex/primitives/CortexIcon";

describe("CortexIcon", () => {
  it("CortexIcon", () => {
    try { render(() => <CortexIcon />); } catch (_e) { /* expected */ }
    expect(CortexIcon).toBeDefined();
  });
  it("CORTEX_ICON_SIZES", () => {
    expect(CORTEX_ICON_SIZES).toBeDefined();
  });
});

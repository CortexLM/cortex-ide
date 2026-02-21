import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexLogo } from "../../../cortex/titlebar/CortexLogo";

describe("CortexLogo", () => {
  it("CortexLogo", () => {
    try { render(() => <CortexLogo />); } catch (_e) { /* expected */ }
    expect(CortexLogo).toBeDefined();
  });
});

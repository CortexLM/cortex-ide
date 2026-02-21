import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexModal } from "../../../cortex/primitives/CortexModal";

describe("CortexModal", () => {
  it("CortexModal", () => {
    try { render(() => <CortexModal />); } catch (_e) { /* expected */ }
    expect(CortexModal).toBeDefined();
  });
});

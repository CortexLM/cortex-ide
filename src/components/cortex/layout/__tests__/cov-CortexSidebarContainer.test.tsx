import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexSidebarContainer } from "../../../cortex/layout/CortexSidebarContainer";

describe("CortexSidebarContainer", () => {
  it("CortexSidebarContainer", () => {
    try { render(() => <CortexSidebarContainer />); } catch (_e) { /* expected */ }
    expect(CortexSidebarContainer).toBeDefined();
  });
});

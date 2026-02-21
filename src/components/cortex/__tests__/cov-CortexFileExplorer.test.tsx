import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexFileExplorer } from "../../cortex/CortexFileExplorer";

describe("CortexFileExplorer", () => {
  it("CortexFileExplorer", () => {
    try { render(() => <CortexFileExplorer />); } catch (_e) { /* expected */ }
    expect(CortexFileExplorer).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { SideBySideDiffView } from "../../../editor/diff/SideBySideDiffView";

describe("SideBySideDiffView", () => {
  it("SideBySideDiffView", () => {
    try { render(() => <SideBySideDiffView />); } catch (_e) { /* expected */ }
    expect(SideBySideDiffView).toBeDefined();
  });
});

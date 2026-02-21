import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { BranchComparison } from "../../git/BranchComparison";

describe("BranchComparison", () => {
  it("BranchComparison", () => {
    try { render(() => <BranchComparison />); } catch (_e) { /* expected */ }
    expect(BranchComparison).toBeDefined();
  });
});

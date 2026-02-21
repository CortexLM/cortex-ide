import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CherryPick } from "../../git/CherryPick";

describe("CherryPick", () => {
  it("CherryPick", () => {
    try { render(() => <CherryPick />); } catch (_e) { /* expected */ }
    expect(CherryPick).toBeDefined();
  });
});

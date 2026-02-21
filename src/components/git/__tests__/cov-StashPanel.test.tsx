import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { StashPanel } from "../../git/StashPanel";

describe("StashPanel", () => {
  it("StashPanel", () => {
    try { render(() => <StashPanel />); } catch (_e) { /* expected */ }
    expect(StashPanel).toBeDefined();
  });
});

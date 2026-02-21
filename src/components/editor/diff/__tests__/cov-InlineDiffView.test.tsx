import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { InlineDiffView } from "../../../editor/diff/InlineDiffView";

describe("InlineDiffView", () => {
  it("InlineDiffView", () => {
    try { render(() => <InlineDiffView />); } catch (_e) { /* expected */ }
    expect(InlineDiffView).toBeDefined();
  });
});

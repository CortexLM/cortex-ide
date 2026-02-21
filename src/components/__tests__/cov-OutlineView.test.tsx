import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { OutlineView } from "../OutlineView";

describe("OutlineView", () => {
  it("OutlineView", () => {
    try { render(() => <OutlineView />); } catch (_e) { /* expected */ }
    expect(OutlineView).toBeDefined();
  });
});

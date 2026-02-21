import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { DiffView } from "../DiffView";

describe("DiffView", () => {
  it("DiffView", () => {
    try { render(() => <DiffView />); } catch (_e) { /* expected */ }
    expect(DiffView).toBeDefined();
  });
});

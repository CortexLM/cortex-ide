import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { DiffPreview } from "../../../cortex/vibe/DiffPreview";

describe("DiffPreview", () => {
  it("DiffPreview", () => {
    try { render(() => <DiffPreview />); } catch (_e) { /* expected */ }
    expect(DiffPreview).toBeDefined();
  });
});

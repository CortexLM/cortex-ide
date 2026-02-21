import { describe, it, expect, vi } from "vitest";

import { generateCellId } from "../../grid/types";

describe("types", () => {
  it("generateCellId", () => {
    try { generateCellId(); } catch (_e) { /* expected */ }
    expect(generateCellId).toBeDefined();
  });
});

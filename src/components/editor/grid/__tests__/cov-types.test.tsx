import { describe, it, expect, vi } from "vitest";

import { DEFAULT_MIN_CELL_SIZE, EDGE_DROP_THRESHOLD } from "../../../editor/grid/types";

describe("types", () => {
  it("DEFAULT_MIN_CELL_SIZE", () => {
    expect(DEFAULT_MIN_CELL_SIZE).toBeDefined();
  });
  it("EDGE_DROP_THRESHOLD", () => {
    expect(EDGE_DROP_THRESHOLD).toBeDefined();
  });
});

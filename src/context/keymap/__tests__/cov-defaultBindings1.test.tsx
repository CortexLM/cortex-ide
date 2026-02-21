import { describe, it, expect, vi } from "vitest";

import { BINDINGS_PART1 } from "../../keymap/defaultBindings1";

describe("defaultBindings1", () => {
  it("BINDINGS_PART1", () => {
    expect(BINDINGS_PART1).toBeDefined();
  });
});

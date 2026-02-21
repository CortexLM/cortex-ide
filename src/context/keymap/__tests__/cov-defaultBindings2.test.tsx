import { describe, it, expect, vi } from "vitest";

import { BINDINGS_PART2 } from "../../keymap/defaultBindings2";

describe("defaultBindings2", () => {
  it("BINDINGS_PART2", () => {
    expect(BINDINGS_PART2).toBeDefined();
  });
});

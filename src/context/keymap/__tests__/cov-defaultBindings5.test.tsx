import { describe, it, expect, vi } from "vitest";

import { BINDINGS_PART5 } from "../../keymap/defaultBindings5";

describe("defaultBindings5", () => {
  it("BINDINGS_PART5", () => {
    expect(BINDINGS_PART5).toBeDefined();
  });
});

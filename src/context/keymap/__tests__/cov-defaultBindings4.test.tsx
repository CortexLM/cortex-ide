import { describe, it, expect, vi } from "vitest";

import { BINDINGS_PART4 } from "../../keymap/defaultBindings4";

describe("defaultBindings4", () => {
  it("BINDINGS_PART4", () => {
    expect(BINDINGS_PART4).toBeDefined();
  });
});

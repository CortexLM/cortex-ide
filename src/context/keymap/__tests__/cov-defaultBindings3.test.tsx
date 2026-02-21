import { describe, it, expect, vi } from "vitest";

import { BINDINGS_PART3 } from "../../keymap/defaultBindings3";

describe("defaultBindings3", () => {
  it("BINDINGS_PART3", () => {
    expect(BINDINGS_PART3).toBeDefined();
  });
});

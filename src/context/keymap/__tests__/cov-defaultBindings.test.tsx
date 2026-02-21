import { describe, it, expect, vi } from "vitest";

import { DEFAULT_BINDINGS } from "../../keymap/defaultBindings";

describe("defaultBindings", () => {
  it("DEFAULT_BINDINGS", () => {
    expect(DEFAULT_BINDINGS).toBeDefined();
  });
});

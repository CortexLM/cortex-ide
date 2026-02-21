import { describe, it, expect, vi } from "vitest";

import { baseStyles } from "../../../settings/keybindings/keybindingsStyles";

describe("keybindingsStyles", () => {
  it("baseStyles", () => {
    expect(baseStyles).toBeDefined();
  });
});

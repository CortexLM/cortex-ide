import { describe, it, expect, vi } from "vitest";

import { modalStyles } from "../../../settings/keybindings/keybindingsModalStyles";

describe("keybindingsModalStyles", () => {
  it("modalStyles", () => {
    expect(modalStyles).toBeDefined();
  });
});

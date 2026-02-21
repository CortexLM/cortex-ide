import { describe, it, expect, vi } from "vitest";

import { DEFAULT_CUSTOMIZATIONS, STORAGE_KEY_CUSTOMIZATIONS } from "../../theme/types";

describe("types", () => {
  it("DEFAULT_CUSTOMIZATIONS", () => {
    expect(DEFAULT_CUSTOMIZATIONS).toBeDefined();
  });
  it("STORAGE_KEY_CUSTOMIZATIONS", () => {
    expect(STORAGE_KEY_CUSTOMIZATIONS).toBeDefined();
  });
});

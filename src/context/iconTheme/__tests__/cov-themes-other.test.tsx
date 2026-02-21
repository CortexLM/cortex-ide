import { describe, it, expect, vi } from "vitest";

import { materialTheme, minimalTheme } from "../../iconTheme/themes-other";

describe("themes-other", () => {
  it("materialTheme", () => {
    expect(materialTheme).toBeDefined();
  });
  it("minimalTheme", () => {
    expect(minimalTheme).toBeDefined();
  });
});

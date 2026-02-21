import { describe, it, expect, vi } from "vitest";

import { SDK_VERSION } from "../types";

describe("types", () => {
  it("SDK_VERSION", () => {
    expect(SDK_VERSION).toBeDefined();
  });
});

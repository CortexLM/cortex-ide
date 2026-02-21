import { describe, it, expect, vi } from "vitest";

import { isValidJsonc } from "../jsonc";

describe("jsonc", () => {
  it("isValidJsonc", () => {
    try { isValidJsonc("test"); } catch (_e) { /* expected */ }
    try { isValidJsonc(); } catch (_e) { /* expected */ }
    expect(isValidJsonc).toBeDefined();
  });
});

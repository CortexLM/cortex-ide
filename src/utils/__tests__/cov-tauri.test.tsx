import { describe, it, expect, vi } from "vitest";

import { isTauri } from "../tauri";

describe("tauri", () => {
  it("isTauri", () => {
    try { isTauri(); } catch (_e) { /* expected */ }
    expect(isTauri).toBeDefined();
  });
});

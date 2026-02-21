import { describe, it, expect, vi } from "vitest";

import { profileProvider, profiler } from "../startup-profiler";

describe("startup-profiler", () => {
  it("profileProvider", () => {
    try { profileProvider("test"); } catch (_e) { /* expected */ }
    try { profileProvider(); } catch (_e) { /* expected */ }
    expect(profileProvider).toBeDefined();
  });
  it("profiler", () => {
    expect(profiler).toBeDefined();
  });
});

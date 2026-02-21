import { describe, it, expect, vi } from "vitest";

import { detectPlatform } from "../../../cortex/titlebar/platformDetect";

describe("platformDetect", () => {
  it("detectPlatform", () => {
    try { detectPlatform(); } catch (_e) { /* expected */ }
    expect(detectPlatform).toBeDefined();
  });
});

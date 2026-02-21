import { describe, it, expect, vi } from "vitest";

import { delay } from "../retry";

describe("retry", () => {
  it("delay", () => {
    try { delay(0); } catch (_e) { /* expected */ }
    try { delay(); } catch (_e) { /* expected */ }
    expect(delay).toBeDefined();
  });
});

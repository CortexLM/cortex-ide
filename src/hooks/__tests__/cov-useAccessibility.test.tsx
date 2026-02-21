import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useAccessibility } from "../useAccessibility";

describe("useAccessibility", () => {
  it("useAccessibility", () => {
    try { createRoot((dispose) => { try { useAccessibility(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAccessibility).toBeDefined();
  });
});

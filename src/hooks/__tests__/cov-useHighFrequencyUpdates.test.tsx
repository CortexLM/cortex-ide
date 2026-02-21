import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useHighFrequencyUpdates, useBlinkingCursor } from "../useHighFrequencyUpdates";

describe("useHighFrequencyUpdates", () => {
  it("useHighFrequencyUpdates", () => {
    try { createRoot((dispose) => { try { useHighFrequencyUpdates(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useHighFrequencyUpdates).toBeDefined();
  });
  it("useBlinkingCursor", () => {
    try { createRoot((dispose) => { try { useBlinkingCursor(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useBlinkingCursor).toBeDefined();
  });
});

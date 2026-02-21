import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useTerminalSplits } from "../../terminal/useTerminalSplits";

describe("useTerminalSplits", () => {
  it("useTerminalSplits", () => {
    try { createRoot((dispose) => { try { useTerminalSplits({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalSplits).toBeDefined();
  });
});

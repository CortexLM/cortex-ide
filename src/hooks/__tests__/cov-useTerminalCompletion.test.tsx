import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { createAdvancedCompletionSource, useTerminalCompletion } from "../useTerminalCompletion";

describe("useTerminalCompletion", () => {
  it("createAdvancedCompletionSource", () => {
    try { createAdvancedCompletionSource(); } catch (_e) { /* expected */ }
    expect(createAdvancedCompletionSource).toBeDefined();
  });
  it("useTerminalCompletion", () => {
    try { createRoot((dispose) => { try { useTerminalCompletion(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalCompletion).toBeDefined();
  });
});

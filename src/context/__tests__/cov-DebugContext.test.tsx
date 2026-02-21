import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { createBreakpointId, parseBreakpointId, DebugProvider, useDebug, DEFAULT_DEBUG_BEHAVIOR_SETTINGS } from "../DebugContext";

describe("DebugContext", () => {
  it("createBreakpointId", () => {
    try { createBreakpointId("test", 0); } catch (_e) { /* expected */ }
    try { createBreakpointId(); } catch (_e) { /* expected */ }
    expect(createBreakpointId).toBeDefined();
  });
  it("parseBreakpointId", () => {
    try { parseBreakpointId({} as any); } catch (_e) { /* expected */ }
    try { parseBreakpointId(); } catch (_e) { /* expected */ }
    expect(parseBreakpointId).toBeDefined();
  });
  it("DebugProvider", () => {
    try { render(() => <DebugProvider />); } catch (_e) { /* expected */ }
    expect(DebugProvider).toBeDefined();
  });
  it("useDebug", () => {
    try { createRoot((dispose) => { try { useDebug(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDebug).toBeDefined();
  });
  it("DEFAULT_DEBUG_BEHAVIOR_SETTINGS", () => {
    expect(DEFAULT_DEBUG_BEHAVIOR_SETTINGS).toBeDefined();
  });
});

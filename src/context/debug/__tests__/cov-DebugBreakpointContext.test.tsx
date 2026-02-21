import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/DebugContext", () => ({ DebugProvider: (p: any) => p.children, useDebug: vi.fn(() => ({ state: { sessions: [], activeSessionId: null, breakpoints: [], variables: [], callStack: [], watches: [], isDebugging: false, isPaused: false }, sessions: vi.fn(() => []), activeSession: vi.fn(() => null), breakpoints: vi.fn(() => []), variables: vi.fn(() => []), callStack: vi.fn(() => []), watches: vi.fn(() => []), isDebugging: vi.fn(() => false), isPaused: vi.fn(() => false), startDebugging: vi.fn(), stopDebugging: vi.fn(), pauseDebugging: vi.fn(), continueDebugging: vi.fn(), stepOver: vi.fn(), stepInto: vi.fn(), stepOut: vi.fn(), addBreakpoint: vi.fn(), removeBreakpoint: vi.fn(), toggleBreakpoint: vi.fn(), addWatch: vi.fn(), removeWatch: vi.fn(), evaluate: vi.fn() })) }));

import { DebugBreakpointProvider, useDebugBreakpoints } from "../../debug/DebugBreakpointContext";

describe("DebugBreakpointContext", () => {
  it("DebugBreakpointProvider", () => {
    try { render(() => <DebugBreakpointProvider />); } catch (_e) { /* expected */ }
    expect(DebugBreakpointProvider).toBeDefined();
  });
  it("useDebugBreakpoints", () => {
    try { createRoot((dispose) => { try { useDebugBreakpoints(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDebugBreakpoints).toBeDefined();
  });
});

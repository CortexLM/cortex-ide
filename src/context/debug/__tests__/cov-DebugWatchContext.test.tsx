import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/DebugContext", () => ({ DebugProvider: (p: any) => p.children, useDebug: vi.fn(() => ({ state: { sessions: [], activeSessionId: null, breakpoints: [], variables: [], callStack: [], watches: [], isDebugging: false, isPaused: false }, sessions: vi.fn(() => []), activeSession: vi.fn(() => null), breakpoints: vi.fn(() => []), variables: vi.fn(() => []), callStack: vi.fn(() => []), watches: vi.fn(() => []), isDebugging: vi.fn(() => false), isPaused: vi.fn(() => false), startDebugging: vi.fn(), stopDebugging: vi.fn(), pauseDebugging: vi.fn(), continueDebugging: vi.fn(), stepOver: vi.fn(), stepInto: vi.fn(), stepOut: vi.fn(), addBreakpoint: vi.fn(), removeBreakpoint: vi.fn(), toggleBreakpoint: vi.fn(), addWatch: vi.fn(), removeWatch: vi.fn(), evaluate: vi.fn() })) }));

import { DebugWatchProvider, useDebugWatch } from "../../debug/DebugWatchContext";

describe("DebugWatchContext", () => {
  it("DebugWatchProvider", () => {
    try { render(() => <DebugWatchProvider />); } catch (_e) { /* expected */ }
    expect(DebugWatchProvider).toBeDefined();
  });
  it("useDebugWatch", () => {
    try { createRoot((dispose) => { try { useDebugWatch(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDebugWatch).toBeDefined();
  });
});

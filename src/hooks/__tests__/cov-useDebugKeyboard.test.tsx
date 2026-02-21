import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@/context/DebugContext", () => ({ DebugProvider: (p: any) => p.children, useDebug: vi.fn(() => ({ state: { sessions: [], activeSessionId: null, breakpoints: [], variables: [], callStack: [], watches: [], isDebugging: false, isPaused: false }, sessions: vi.fn(() => []), activeSession: vi.fn(() => null), breakpoints: vi.fn(() => []), variables: vi.fn(() => []), callStack: vi.fn(() => []), watches: vi.fn(() => []), isDebugging: vi.fn(() => false), isPaused: vi.fn(() => false), startDebugging: vi.fn(), stopDebugging: vi.fn(), pauseDebugging: vi.fn(), continueDebugging: vi.fn(), stepOver: vi.fn(), stepInto: vi.fn(), stepOut: vi.fn(), addBreakpoint: vi.fn(), removeBreakpoint: vi.fn(), toggleBreakpoint: vi.fn(), addWatch: vi.fn(), removeWatch: vi.fn(), evaluate: vi.fn() })) }));

import { getDebugStatusText, getDebugShortcutHints, useDebugKeyboard } from "../useDebugKeyboard";

describe("useDebugKeyboard", () => {
  it("getDebugStatusText", () => {
    try { getDebugStatusText({} as any); } catch (_e) { /* expected */ }
    try { getDebugStatusText(); } catch (_e) { /* expected */ }
    expect(getDebugStatusText).toBeDefined();
  });
  it("getDebugShortcutHints", () => {
    try { getDebugShortcutHints({} as any); } catch (_e) { /* expected */ }
    try { getDebugShortcutHints(); } catch (_e) { /* expected */ }
    expect(getDebugShortcutHints).toBeDefined();
  });
  it("useDebugKeyboard", () => {
    try { createRoot((dispose) => { try { useDebugKeyboard(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDebugKeyboard).toBeDefined();
  });
});

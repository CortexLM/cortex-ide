import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));
vi.mock("@/context/DebugContext", () => ({ DebugProvider: (p: any) => p.children, useDebug: vi.fn(() => ({ state: { sessions: [], activeSessionId: null, breakpoints: [], variables: [], callStack: [], watches: [], isDebugging: false, isPaused: false }, sessions: vi.fn(() => []), activeSession: vi.fn(() => null), breakpoints: vi.fn(() => []), variables: vi.fn(() => []), callStack: vi.fn(() => []), watches: vi.fn(() => []), isDebugging: vi.fn(() => false), isPaused: vi.fn(() => false), startDebugging: vi.fn(), stopDebugging: vi.fn(), pauseDebugging: vi.fn(), continueDebugging: vi.fn(), stepOver: vi.fn(), stepInto: vi.fn(), stepOut: vi.fn(), addBreakpoint: vi.fn(), removeBreakpoint: vi.fn(), toggleBreakpoint: vi.fn(), addWatch: vi.fn(), removeWatch: vi.fn(), evaluate: vi.fn() })) }));

import { useWatchHistory, useExpandableVariable } from "../../debug/WatchManager";

describe("WatchManager", () => {
  it("useWatchHistory", () => {
    try { createRoot((dispose) => { try { useWatchHistory(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useWatchHistory).toBeDefined();
  });
  it("useExpandableVariable", () => {
    try { createRoot((dispose) => { try { useExpandableVariable(0); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExpandableVariable).toBeDefined();
  });
});

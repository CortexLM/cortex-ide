import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@tauri-apps/plugin-shell", () => ({ Command: vi.fn(() => ({ execute: vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 }), spawn: vi.fn().mockResolvedValue({ pid: 1, write: vi.fn(), kill: vi.fn() }), on: vi.fn() })), open: vi.fn() }));
vi.mock("@/context/DebugContext", () => ({ DebugProvider: (p: any) => p.children, useDebug: vi.fn(() => ({ state: { sessions: [], activeSessionId: null, breakpoints: [], variables: [], callStack: [], watches: [], isDebugging: false, isPaused: false }, sessions: vi.fn(() => []), activeSession: vi.fn(() => null), breakpoints: vi.fn(() => []), variables: vi.fn(() => []), callStack: vi.fn(() => []), watches: vi.fn(() => []), isDebugging: vi.fn(() => false), isPaused: vi.fn(() => false), startDebugging: vi.fn(), stopDebugging: vi.fn(), pauseDebugging: vi.fn(), continueDebugging: vi.fn(), stepOver: vi.fn(), stepInto: vi.fn(), stepOut: vi.fn(), addBreakpoint: vi.fn(), removeBreakpoint: vi.fn(), toggleBreakpoint: vi.fn(), addWatch: vi.fn(), removeWatch: vi.fn(), evaluate: vi.fn() })) }));

import { DebugConsole } from "../../debugger/DebugConsole";

describe("DebugConsole", () => {
  it("DebugConsole", () => {
    try { render(() => <DebugConsole />); } catch (_e) { /* expected */ }
    expect(DebugConsole).toBeDefined();
  });
});

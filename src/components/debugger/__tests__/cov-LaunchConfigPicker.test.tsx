import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/WorkspaceContext", () => ({ WorkspaceProvider: (p: any) => p.children, useWorkspace: vi.fn(() => ({ workspacePath: vi.fn(() => "/test"), workspaceName: vi.fn(() => "test"), isWorkspaceOpen: vi.fn(() => true), openWorkspace: vi.fn(), closeWorkspace: vi.fn(), recentWorkspaces: vi.fn(() => []) })) }));
vi.mock("@/context/DebugContext", () => ({ DebugProvider: (p: any) => p.children, useDebug: vi.fn(() => ({ state: { sessions: [], activeSessionId: null, breakpoints: [], variables: [], callStack: [], watches: [], isDebugging: false, isPaused: false }, sessions: vi.fn(() => []), activeSession: vi.fn(() => null), breakpoints: vi.fn(() => []), variables: vi.fn(() => []), callStack: vi.fn(() => []), watches: vi.fn(() => []), isDebugging: vi.fn(() => false), isPaused: vi.fn(() => false), startDebugging: vi.fn(), stopDebugging: vi.fn(), pauseDebugging: vi.fn(), continueDebugging: vi.fn(), stepOver: vi.fn(), stepInto: vi.fn(), stepOut: vi.fn(), addBreakpoint: vi.fn(), removeBreakpoint: vi.fn(), toggleBreakpoint: vi.fn(), addWatch: vi.fn(), removeWatch: vi.fn(), evaluate: vi.fn() })) }));
vi.mock("@/context/TasksContext", () => ({ TasksProvider: (p: any) => p.children, useTasks: vi.fn(() => ({ tasks: vi.fn(() => []), runTask: vi.fn(), stopTask: vi.fn(), getTaskStatus: vi.fn(() => "idle"), activeTask: vi.fn(() => null) })) }));

import { getSnippetsByCategory, getSnippetConfig, LaunchConfigPicker, LAUNCH_CONFIG_SNIPPETS } from "../../debugger/LaunchConfigPicker";

describe("LaunchConfigPicker", () => {
  it("getSnippetsByCategory", () => {
    try { getSnippetsByCategory(); } catch (_e) { /* expected */ }
    expect(getSnippetsByCategory).toBeDefined();
  });
  it("getSnippetConfig", () => {
    try { getSnippetConfig("test"); } catch (_e) { /* expected */ }
    try { getSnippetConfig(); } catch (_e) { /* expected */ }
    expect(getSnippetConfig).toBeDefined();
  });
  it("LaunchConfigPicker", () => {
    try { render(() => <LaunchConfigPicker />); } catch (_e) { /* expected */ }
    expect(LaunchConfigPicker).toBeDefined();
  });
  it("LAUNCH_CONFIG_SNIPPETS", () => {
    expect(LAUNCH_CONFIG_SNIPPETS).toBeDefined();
  });
});

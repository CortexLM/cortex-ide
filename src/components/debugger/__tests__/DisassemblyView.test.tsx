import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { DisassemblyView } from "../DisassemblyView";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; size?: string | number; style?: Record<string, string> }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

const mockDebug = {
  state: {
    isDebugging: true,
    isPaused: false,
    threads: [],
    stackFrames: [],
    variables: [],
    scopes: [],
    scopeVariables: {},
    breakpoints: {},
    functionBreakpoints: [],
    dataBreakpoints: [],
    exceptionBreakpoints: [],
    watchExpressions: [],
    output: [],
    activeThreadId: null,
    activeFrameId: null,
    capabilities: null,
    sessions: [],
    activeSessionId: null,
    currentFile: null,
    currentLine: null,
    hotReloadEnabled: false,
  },
  continue_: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn().mockResolvedValue(undefined),
  stepOver: vi.fn().mockResolvedValue(undefined),
  stepInto: vi.fn().mockResolvedValue(undefined),
  stepOut: vi.fn().mockResolvedValue(undefined),
  stopSession: vi.fn().mockResolvedValue(undefined),
  restartSession: vi.fn().mockResolvedValue(undefined),
  stepBack: vi.fn().mockResolvedValue(undefined),
  hotReload: vi.fn().mockResolvedValue(undefined),
  reverseContinue: vi.fn().mockResolvedValue(undefined),
  toggleBreakpoint: vi.fn().mockResolvedValue([]),
  removeBreakpoint: vi.fn().mockResolvedValue(undefined),
  enableBreakpoint: vi.fn().mockResolvedValue(undefined),
  setBreakpointCondition: vi.fn().mockResolvedValue(undefined),
  setBreakpointHitCondition: vi.fn().mockResolvedValue(undefined),
  removeAllBreakpoints: vi.fn().mockResolvedValue(undefined),
  setExceptionBreakpoint: vi.fn().mockResolvedValue(undefined),
  getExceptionBreakpoints: vi.fn().mockReturnValue([]),
  addWatchExpression: vi.fn(),
  removeWatchExpression: vi.fn(),
  updateWatchExpression: vi.fn(),
  evaluateWatch: vi.fn().mockResolvedValue(undefined),
  refreshWatches: vi.fn().mockResolvedValue(undefined),
  evaluate: vi.fn().mockResolvedValue({ result: "", type: "", variablesReference: 0 }),
  selectThread: vi.fn().mockResolvedValue(undefined),
  selectFrame: vi.fn().mockResolvedValue(undefined),
  getScopes: vi.fn().mockResolvedValue([]),
  getScopeVariables: vi.fn().mockResolvedValue([]),
  expandVariable: vi.fn().mockResolvedValue([]),
  setVariable: vi.fn().mockResolvedValue({ value: "", type: "", variablesReference: 0 }),
  clearOutput: vi.fn(),
  getBreakpointsForFile: vi.fn().mockReturnValue([]),
  getAllBreakpointsFlat: vi.fn().mockReturnValue([]),
  addLogpoint: vi.fn().mockResolvedValue([]),
  restartFrame: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/context/DebugContext", () => ({
  useDebug: () => mockDebug,
  Breakpoint: {},
}));

describe("DisassemblyView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockDebug.state.isPaused = false;
    mockDebug.state.activeFrameId = null;
    mockDebug.state.activeSessionId = null;
    mockDebug.state.stackFrames = [];
  });

  it("renders without crashing", () => {
    const { container } = render(() => <DisassemblyView />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("shows empty state when no instructions", () => {
    const { container } = render(() => <DisassemblyView />);
    expect(container.textContent).toContain("Pause execution to view disassembly");
  });
});

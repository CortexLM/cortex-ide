import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { DebugConsole } from "../DebugConsole";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn(),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; size?: string | number }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

vi.mock("../LinkifiedOutput", () => ({
  LinkifiedOutput: (props: { text: string }) => {
    const el = document.createElement("span");
    el.textContent = props.text;
    return el;
  },
}));

const mockDebug = {
  state: {
    isDebugging: true,
    isPaused: true,
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
    output: [] as Array<{
      output: string;
      category: string;
      timestamp: number;
      source?: string;
      line?: number;
    }>,
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
}));

describe("DebugConsole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockDebug.state.output = [];
    mockDebug.state.isPaused = true;
    mockDebug.state.activeSessionId = null;
  });

  it("renders without crashing", () => {
    const { container } = render(() => <DebugConsole />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("shows output messages", () => {
    mockDebug.state.output = [
      { output: "Hello World", category: "stdout", timestamp: Date.now() },
      { output: "Error occurred", category: "stderr", timestamp: Date.now() },
    ];
    const { container } = render(() => <DebugConsole />);
    expect(container.textContent).toContain("Hello World");
    expect(container.textContent).toContain("Error occurred");
  });

  it("has input area for expressions", () => {
    const { container } = render(() => <DebugConsole />);
    const textarea = container.querySelector("textarea");
    expect(textarea).toBeTruthy();
  });

  it("shows filter controls", () => {
    const { container } = render(() => <DebugConsole />);
    const filterInput = container.querySelector('input[placeholder="Filter output..."]');
    expect(filterInput).toBeTruthy();
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(3);
  });
});

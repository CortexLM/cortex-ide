import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { DebugToolbar } from "../DebugToolbar";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; style?: Record<string, string> }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
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
}));

vi.mock("@/context/SettingsContext", () => ({
  useDebugSettings: () => ({
    settings: () => ({ toolbarLocation: "floating" }),
  }),
}));

describe("DebugToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockDebug.state.isDebugging = true;
    mockDebug.state.isPaused = true;
    mockDebug.state.capabilities = null;
    mockDebug.state.hotReloadEnabled = false;
  });

  it("renders toolbar when debugging is active", () => {
    const { container } = render(() => <DebugToolbar />);
    expect(container.querySelector(".debug-toolbar")).toBeTruthy();
  });

  it("shows continue button when paused", () => {
    mockDebug.state.isPaused = true;
    const { container } = render(() => <DebugToolbar />);
    const continueBtn = container.querySelector('button[title="Continue (F5)"]');
    expect(continueBtn).toBeTruthy();
  });

  it("shows pause button when running", () => {
    mockDebug.state.isPaused = false;
    const { container } = render(() => <DebugToolbar />);
    const pauseBtn = container.querySelector('button[title="Pause (F6)"]');
    expect(pauseBtn).toBeTruthy();
  });

  it("step buttons are disabled when not paused", () => {
    mockDebug.state.isPaused = false;
    const { container } = render(() => <DebugToolbar />);
    const stepOver = container.querySelector('button[title="Step Over (F10)"]') as HTMLButtonElement;
    const stepInto = container.querySelector('button[title="Step Into (F11)"]') as HTMLButtonElement;
    const stepOut = container.querySelector('button[title="Step Out (Shift+F11)"]') as HTMLButtonElement;
    expect(stepOver?.disabled).toBe(true);
    expect(stepInto?.disabled).toBe(true);
    expect(stepOut?.disabled).toBe(true);
  });

  it("stop button is present", () => {
    const { container } = render(() => <DebugToolbar />);
    const stopBtn = container.querySelector('button[title="Stop (Shift+F5)"]');
    expect(stopBtn).toBeTruthy();
  });

  it("restart button is present", () => {
    const { container } = render(() => <DebugToolbar />);
    const restartBtn = container.querySelector('button[title="Restart (Ctrl+Shift+F5)"]');
    expect(restartBtn).toBeTruthy();
  });

  it("keyboard shortcut handler is registered on mount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    render(() => <DebugToolbar />);
    const keydownCalls = addSpy.mock.calls.filter(([event]) => event === "keydown");
    expect(keydownCalls.length).toBeGreaterThan(0);
    addSpy.mockRestore();
  });
});

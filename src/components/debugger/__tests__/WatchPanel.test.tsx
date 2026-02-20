import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { WatchPanel } from "../WatchPanel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; size?: number }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

vi.mock("@/components/ui", () => ({
  IconButton: (props: { children?: unknown; onClick?: (e: Event) => void; title?: string }) => {
    const el = document.createElement("button");
    if (props.title) el.setAttribute("title", props.title);
    if (props.onClick) el.addEventListener("click", (e) => props.onClick!(e));
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
    watchExpressions: [] as Array<{
      id: string;
      expression: string;
      result?: string;
      type?: string;
      error?: string;
    }>,
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

describe("WatchPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockDebug.state.watchExpressions = [];
  });

  it("renders without crashing", () => {
    const { container } = render(() => <WatchPanel />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("shows add expression input", () => {
    const { container } = render(() => <WatchPanel />);
    const input = container.querySelector('input[placeholder="Add expression..."]');
    expect(input).toBeTruthy();
  });

  it("renders watch expressions", () => {
    mockDebug.state.watchExpressions = [
      { id: "w1", expression: "myVar", result: "42", type: "number" },
      { id: "w2", expression: "arr.length", result: "3", type: "number" },
    ];
    const { container } = render(() => <WatchPanel />);
    expect(container.textContent).toContain("myVar");
    expect(container.textContent).toContain("arr.length");
    expect(container.textContent).toContain("42");
    expect(container.textContent).toContain("3");
  });

  it("shows error for failed evaluations", () => {
    mockDebug.state.watchExpressions = [
      { id: "w1", expression: "badExpr", error: "ReferenceError: badExpr is not defined" },
    ];
    const { container } = render(() => <WatchPanel />);
    expect(container.textContent).toContain("badExpr");
    expect(container.textContent).toContain("ReferenceError");
  });

  it("can remove watch expression", () => {
    mockDebug.state.watchExpressions = [
      { id: "w1", expression: "myVar", result: "42" },
    ];
    const { container } = render(() => <WatchPanel />);
    const removeBtn = container.querySelector('button[title="Remove"]');
    expect(removeBtn).toBeTruthy();
  });
});

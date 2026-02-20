import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { BreakpointPanel } from "../BreakpointPanel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; size?: number; color?: string }) => {
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
    breakpoints: {} as Record<string, Array<{
      path: string;
      line: number;
      verified: boolean;
      enabled: boolean;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
      isLogpoint?: boolean;
      column?: number;
    }>>,
    functionBreakpoints: [],
    dataBreakpoints: [],
    exceptionBreakpoints: [] as Array<{
      filter: string;
      label: string;
      enabled: boolean;
      description?: string;
      condition?: string;
      supportsCondition?: boolean;
      conditionDescription?: string;
    }>,
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
  setExceptionBreakpointCondition: vi.fn().mockResolvedValue(undefined),
  setLogpointMessage: vi.fn().mockResolvedValue(undefined),
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

describe("BreakpointPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockDebug.state.breakpoints = {};
    mockDebug.state.exceptionBreakpoints = [];
  });

  it("renders without crashing", () => {
    const { container } = render(() => <BreakpointPanel />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("shows empty state when no breakpoints", () => {
    const { container } = render(() => <BreakpointPanel />);
    expect(container.textContent).toContain("No breakpoints set");
  });

  it("renders breakpoints grouped by file", () => {
    mockDebug.state.breakpoints = {
      "/src/app.ts": [
        { path: "/src/app.ts", line: 10, verified: true, enabled: true },
        { path: "/src/app.ts", line: 20, verified: true, enabled: true },
      ],
      "/src/utils.ts": [
        { path: "/src/utils.ts", line: 5, verified: true, enabled: true },
      ],
    };
    const { container } = render(() => <BreakpointPanel />);
    expect(container.textContent).toContain("app.ts");
    expect(container.textContent).toContain("utils.ts");
    expect(container.textContent).toContain("Line 10");
    expect(container.textContent).toContain("Line 20");
    expect(container.textContent).toContain("Line 5");
  });

  it("shows exception breakpoint toggles", () => {
    mockDebug.state.exceptionBreakpoints = [
      { filter: "all", label: "All Exceptions", enabled: true, description: "Break on all" },
      { filter: "uncaught", label: "Uncaught Exceptions", enabled: false },
    ];
    const { container } = render(() => <BreakpointPanel />);
    expect(container.textContent).toContain("All Exceptions");
    expect(container.textContent).toContain("Uncaught Exceptions");
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it("can toggle breakpoint enabled state", async () => {
    mockDebug.state.breakpoints = {
      "/src/app.ts": [
        { path: "/src/app.ts", line: 10, verified: true, enabled: true },
      ],
    };
    const { container } = render(() => <BreakpointPanel />);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    await fireEvent.change(checkbox, { target: { checked: false } });
    expect(mockDebug.enableBreakpoint).toHaveBeenCalled();
  });

  it("shows inline edit for condition", () => {
    mockDebug.state.breakpoints = {
      "/src/app.ts": [
        { path: "/src/app.ts", line: 10, verified: true, enabled: true, condition: "x > 5" },
      ],
    };
    const { container } = render(() => <BreakpointPanel />);
    expect(container.textContent).toContain("x > 5");
  });
});

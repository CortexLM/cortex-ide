import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { CallStackPanel } from "../CallStackPanel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string; size?: number; color?: string; class?: string }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    if (props.class) el.className = props.class;
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
    isPaused: false,
    threads: [] as Array<{ id: number; name: string; stopped: boolean }>,
    stackFrames: [] as Array<{
      id: number;
      name: string;
      line: number;
      column: number;
      source?: { path?: string; name?: string };
      presentationHint?: string;
      canRestart?: boolean;
    }>,
    variables: [],
    scopes: [],
    scopeVariables: {},
    breakpoints: {},
    functionBreakpoints: [],
    dataBreakpoints: [],
    exceptionBreakpoints: [],
    watchExpressions: [],
    output: [],
    activeThreadId: null as number | null,
    activeFrameId: null as number | null,
    capabilities: null as { supportsRestartFrame?: boolean } | null,
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

describe("CallStackPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockDebug.state.isPaused = false;
    mockDebug.state.isDebugging = true;
    mockDebug.state.threads = [];
    mockDebug.state.stackFrames = [];
    mockDebug.state.activeThreadId = null;
    mockDebug.state.activeFrameId = null;
    mockDebug.state.capabilities = null;
  });

  it("renders without crashing", () => {
    const { container } = render(() => <CallStackPanel />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("shows empty state when no threads", () => {
    mockDebug.state.isDebugging = false;
    const { container } = render(() => <CallStackPanel />);
    expect(container.textContent).toContain("Not debugging");
  });

  it("renders thread list", () => {
    mockDebug.state.isPaused = true;
    mockDebug.state.threads = [
      { id: 1, name: "Main Thread", stopped: true },
      { id: 2, name: "Worker Thread", stopped: false },
    ];
    mockDebug.state.activeThreadId = 1;
    const { container } = render(() => <CallStackPanel />);
    expect(container.textContent).toContain("Main Thread");
    expect(container.textContent).toContain("Worker Thread");
  });

  it("renders stack frames", () => {
    mockDebug.state.isPaused = true;
    mockDebug.state.stackFrames = [
      { id: 1, name: "main", line: 10, column: 1, source: { path: "/src/app.ts", name: "app.ts" } },
      { id: 2, name: "handleClick", line: 25, column: 5, source: { path: "/src/handler.ts", name: "handler.ts" } },
    ];
    mockDebug.state.activeFrameId = 1;
    const { container } = render(() => <CallStackPanel />);
    expect(container.textContent).toContain("main");
    expect(container.textContent).toContain("handleClick");
  });

  it("highlights active frame", () => {
    mockDebug.state.isPaused = true;
    mockDebug.state.stackFrames = [
      { id: 1, name: "main", line: 10, column: 1, source: { path: "/src/app.ts" } },
      { id: 2, name: "helper", line: 5, column: 1, source: { path: "/src/utils.ts" } },
    ];
    mockDebug.state.activeFrameId = 1;
    const { container } = render(() => <CallStackPanel />);
    const activeIcon = container.querySelector('[data-icon="arrow-right"]');
    expect(activeIcon).toBeTruthy();
  });
});

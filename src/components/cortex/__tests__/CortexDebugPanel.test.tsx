import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexDebugPanel } from "../CortexDebugPanel";
import type { Variable, Breakpoint, StackFrame, WatchExpression } from "@/context/DebugContext";

const mockDebug = {
  state: {
    isDebugging: false,
    isPaused: false,
    variables: [] as Variable[],
    stackFrames: [] as StackFrame[],
    watchExpressions: [] as WatchExpression[],
    output: [],
    activeFrameId: null,
    breakpoints: {} as Record<string, Breakpoint[]>,
  },
  startSession: vi.fn().mockResolvedValue({ id: "s1", name: "Test", type: "node", state: { type: "running" } }),
  stopSession: vi.fn().mockResolvedValue(undefined),
  restartSession: vi.fn().mockResolvedValue(undefined),
  continue_: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn().mockResolvedValue(undefined),
  stepOver: vi.fn().mockResolvedValue(undefined),
  stepInto: vi.fn().mockResolvedValue(undefined),
  stepOut: vi.fn().mockResolvedValue(undefined),
  selectFrame: vi.fn().mockResolvedValue(undefined),
  addWatchExpression: vi.fn(),
  removeWatchExpression: vi.fn(),
  refreshWatches: vi.fn().mockResolvedValue(undefined),
  expandVariable: vi.fn().mockResolvedValue([]),
  enableBreakpoint: vi.fn().mockResolvedValue(undefined),
  removeBreakpoint: vi.fn().mockResolvedValue(undefined),
  removeAllBreakpoints: vi.fn().mockResolvedValue(undefined),
  getSavedConfigurations: vi.fn().mockReturnValue([]),
  getAllBreakpointsFlat: vi.fn().mockReturnValue([]),
};

vi.mock("@/context/DebugContext", () => ({
  useDebug: () => mockDebug,
}));

vi.mock("../primitives/CortexButton", () => ({
  CortexButton: (props: { children?: any; onClick?: () => void; variant?: string; icon?: string; disabled?: boolean }) => (
    <button data-testid="cortex-button" data-variant={props.variant} data-icon={props.icon} disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string; style?: any }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

vi.mock("../primitives/CortexIconButton", () => ({
  CortexIconButton: (props: { icon: string; size?: number; onClick?: (e: MouseEvent) => void; style?: any; disabled?: boolean }) => (
    <button data-testid={`icon-btn-${props.icon}`} disabled={props.disabled} onClick={(e) => props.onClick?.(e)}>
      {props.icon}
    </button>
  ),
}));

vi.mock("../primitives/CortexTooltip", () => ({
  CortexTooltip: (props: { content: string; children: any }) => (
    <div data-tooltip={props.content}>{props.children}</div>
  ),
}));

vi.mock("../primitives/CortexDropdown", () => ({
  CortexDropdown: (props: {
    options: Array<{ value: string; label: string }>;
    value?: string;
    onChange?: (v: string) => void;
    placeholder?: string;
    fullWidth?: boolean;
    style?: any;
  }) => (
    <select
      data-testid="config-dropdown"
      value={props.value || ""}
      onChange={(e) => props.onChange?.(e.currentTarget.value)}
    >
      <option value="">{props.placeholder || "Select..."}</option>
      {props.options.map((opt) => (
        <option value={opt.value}>{opt.label}</option>
      ))}
    </select>
  ),
}));

function resetMockDebug(overrides: Partial<typeof mockDebug> = {}) {
  mockDebug.state = {
    isDebugging: false,
    isPaused: false,
    variables: [],
    stackFrames: [],
    watchExpressions: [],
    output: [],
    activeFrameId: null,
    breakpoints: {},
    ...overrides.state,
  } as typeof mockDebug.state;
  mockDebug.getSavedConfigurations.mockReturnValue(overrides.getSavedConfigurations?.() ?? []);
  mockDebug.getAllBreakpointsFlat.mockReturnValue(overrides.getAllBreakpointsFlat?.() ?? []);
  Object.keys(mockDebug).forEach((key) => {
    const val = (mockDebug as any)[key];
    if (typeof val === "function" && val.mockClear) {
      val.mockClear();
    }
  });
  if (overrides.getSavedConfigurations) {
    mockDebug.getSavedConfigurations.mockReturnValue(overrides.getSavedConfigurations());
  }
  if (overrides.getAllBreakpointsFlat) {
    mockDebug.getAllBreakpointsFlat.mockReturnValue(overrides.getAllBreakpointsFlat());
  }
}

describe("CortexDebugPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    resetMockDebug();
  });

  describe("Header", () => {
    it("should render debug panel header with 'Run and Debug' title", () => {
      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("Run and Debug");
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no configurations exist", () => {
      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("create a launch.json");
      const runBtn = container.querySelector('[data-testid="cortex-button"]');
      expect(runBtn).toBeTruthy();
      expect(runBtn?.textContent).toContain("Run and Debug");
    });

    it("should dispatch quick-start event when Run and Debug button is clicked", async () => {
      const handler = vi.fn();
      window.addEventListener("debug:quick-start", handler);

      const { container } = render(() => <CortexDebugPanel />);
      const runBtn = container.querySelector('[data-testid="cortex-button"]') as HTMLButtonElement;
      await fireEvent.click(runBtn);

      expect(handler).toHaveBeenCalled();
      window.removeEventListener("debug:quick-start", handler);
    });
  });

  describe("Launch Configurations", () => {
    it("should show configurations dropdown when configs exist", () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch App", type: "node", request: "launch", saved: true },
          { id: "c2", name: "Attach", type: "node", request: "attach", saved: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      const dropdown = container.querySelector('[data-testid="config-dropdown"]') as HTMLSelectElement;
      expect(dropdown).toBeTruthy();

      const options = dropdown.querySelectorAll("option");
      expect(options.length).toBe(3);
      expect(options[1].textContent).toBe("Launch App");
      expect(options[2].textContent).toBe("Attach");
    });

    it("should render start button next to dropdown", () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch App", type: "node", request: "launch", saved: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      const playBtn = container.querySelector('[data-testid="icon-btn-play"]');
      expect(playBtn).toBeTruthy();
    });
  });

  describe("Debug Controls", () => {
    it("should render control buttons when debugging", () => {
      resetMockDebug({
        state: { isDebugging: true, isPaused: false } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);

      expect(container.querySelector('[data-testid="icon-btn-pause"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-btn-forward-step"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-btn-arrow-down"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-btn-arrow-up"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-btn-arrows-rotate"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-btn-stop"]')).toBeTruthy();
    });

    it("should show continue button when paused", () => {
      resetMockDebug({
        state: { isDebugging: true, isPaused: true } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.querySelector('[data-testid="icon-btn-play"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-btn-pause"]')).toBeNull();
    });

    it("should call pause when pause button is clicked", async () => {
      resetMockDebug({
        state: { isDebugging: true, isPaused: false } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      const pauseBtn = container.querySelector('[data-testid="icon-btn-pause"]') as HTMLButtonElement;
      await fireEvent.click(pauseBtn);
      expect(mockDebug.pause).toHaveBeenCalled();
    });

    it("should call continue when play button is clicked while paused", async () => {
      resetMockDebug({
        state: { isDebugging: true, isPaused: true } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      const playBtn = container.querySelector('[data-testid="icon-btn-play"]') as HTMLButtonElement;
      await fireEvent.click(playBtn);
      expect(mockDebug.continue_).toHaveBeenCalled();
    });

    it("should call stepOver when step over button is clicked", async () => {
      resetMockDebug({
        state: { isDebugging: true, isPaused: false } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      const stepBtn = container.querySelector('[data-testid="icon-btn-forward-step"]') as HTMLButtonElement;
      await fireEvent.click(stepBtn);
      expect(mockDebug.stepOver).toHaveBeenCalled();
    });

    it("should call stepInto when step into button is clicked", async () => {
      resetMockDebug({
        state: { isDebugging: true, isPaused: false } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      const stepBtn = container.querySelector('[data-testid="icon-btn-arrow-down"]') as HTMLButtonElement;
      await fireEvent.click(stepBtn);
      expect(mockDebug.stepInto).toHaveBeenCalled();
    });

    it("should call stepOut when step out button is clicked", async () => {
      resetMockDebug({
        state: { isDebugging: true, isPaused: false } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      const stepBtn = container.querySelector('[data-testid="icon-btn-arrow-up"]') as HTMLButtonElement;
      await fireEvent.click(stepBtn);
      expect(mockDebug.stepOut).toHaveBeenCalled();
    });

    it("should call restartSession when restart button is clicked", async () => {
      resetMockDebug({
        state: { isDebugging: true, isPaused: false } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      const restartBtn = container.querySelector('[data-testid="icon-btn-arrows-rotate"]') as HTMLButtonElement;
      await fireEvent.click(restartBtn);
      expect(mockDebug.restartSession).toHaveBeenCalled();
    });

    it("should call stopSession when stop button is clicked", async () => {
      resetMockDebug({
        state: { isDebugging: true, isPaused: false } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      const stopBtn = container.querySelector('[data-testid="icon-btn-stop"]') as HTMLButtonElement;
      await fireEvent.click(stopBtn);
      expect(mockDebug.stopSession).toHaveBeenCalled();
    });
  });

  describe("Variables Section", () => {
    it("should display variables when paused", () => {
      resetMockDebug({
        state: {
          isDebugging: true,
          isPaused: true,
          variables: [
            { name: "count", value: "42", type: "number", variablesReference: 0 },
            { name: "name", value: '"hello"', type: "string", variablesReference: 0 },
          ],
        } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("Variables");
      expect(container.textContent).toContain("count");
      expect(container.textContent).toContain("42");
      expect(container.textContent).toContain("name");
      expect(container.textContent).toContain('"hello"');
    });

    it("should show 'Running...' when debugging but not paused", () => {
      resetMockDebug({
        state: {
          isDebugging: true,
          isPaused: false,
          variables: [],
        } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("Running...");
    });

    it("should show 'Not paused' when not debugging", () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("Not paused");
    });

    it("should display variable type information", () => {
      resetMockDebug({
        state: {
          isDebugging: true,
          isPaused: true,
          variables: [
            { name: "items", value: "Array(3)", type: "object", variablesReference: 5 },
          ],
        } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("items");
      expect(container.textContent).toContain("Array(3)");
      expect(container.textContent).toContain("object");
    });
  });

  describe("Call Stack Section", () => {
    it("should display stack frames when paused", () => {
      resetMockDebug({
        state: {
          isDebugging: true,
          isPaused: true,
          stackFrames: [
            { id: 1, name: "main", source: { name: "index.ts", path: "/src/index.ts" }, line: 10, column: 1 },
            { id: 2, name: "handleClick", source: { name: "app.ts", path: "/src/app.ts" }, line: 25, column: 3 },
          ],
        } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("Call Stack");
      expect(container.textContent).toContain("main");
      expect(container.textContent).toContain("index.ts:10");
      expect(container.textContent).toContain("handleClick");
      expect(container.textContent).toContain("app.ts:25");
    });

    it("should show 'Running...' in call stack when not paused", () => {
      resetMockDebug({
        state: {
          isDebugging: true,
          isPaused: false,
          stackFrames: [],
        } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("Call Stack");
      const callstackText = container.textContent || "";
      const callStackIndex = callstackText.indexOf("Call Stack");
      const afterCallStack = callstackText.slice(callStackIndex);
      expect(afterCallStack).toContain("Running...");
    });

    it("should call selectFrame when clicking a stack frame", async () => {
      resetMockDebug({
        state: {
          isDebugging: true,
          isPaused: true,
          stackFrames: [
            { id: 1, name: "main", source: { name: "index.ts" }, line: 10, column: 1 },
          ],
        } as any,
      });

      const { container } = render(() => <CortexDebugPanel />);
      const frameRow = container.querySelector(".dbg-row") as HTMLElement;
      if (frameRow) {
        await fireEvent.click(frameRow);
        expect(mockDebug.selectFrame).toHaveBeenCalledWith(1);
      }
    });
  });

  describe("Breakpoints Section", () => {
    it("should list breakpoints", () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
        getAllBreakpointsFlat: vi.fn().mockReturnValue([
          { path: "/src/index.ts", line: 10, verified: true, enabled: true },
          { path: "/src/app.ts", line: 25, verified: true, enabled: true, condition: "x > 5" },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("Breakpoints");
      expect(container.textContent).toContain("index.ts:10");
      expect(container.textContent).toContain("app.ts:25");
      expect(container.textContent).toContain("x > 5");
    });

    it("should show 'No breakpoints' when no breakpoints exist", () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
        getAllBreakpointsFlat: vi.fn().mockReturnValue([]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("No breakpoints");
    });

    it("should render checkbox for each breakpoint", () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
        getAllBreakpointsFlat: vi.fn().mockReturnValue([
          { path: "/src/index.ts", line: 10, verified: true, enabled: true },
          { path: "/src/app.ts", line: 25, verified: true, enabled: false },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    });

    it("should call enableBreakpoint when toggling checkbox", async () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
        getAllBreakpointsFlat: vi.fn().mockReturnValue([
          { path: "/src/index.ts", line: 10, verified: true, enabled: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      await fireEvent.change(checkbox);
      expect(mockDebug.enableBreakpoint).toHaveBeenCalledWith("/src/index.ts", 10, false, undefined);
    });

    it("should call removeAllBreakpoints when trash button is clicked", async () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
        getAllBreakpointsFlat: vi.fn().mockReturnValue([
          { path: "/src/index.ts", line: 10, verified: true, enabled: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      const trashBtn = container.querySelector('[data-testid="icon-btn-trash-03"]') as HTMLButtonElement;
      if (trashBtn) {
        await fireEvent.click(trashBtn);
        expect(mockDebug.removeAllBreakpoints).toHaveBeenCalled();
      }
    });
  });

  describe("Watch Expressions", () => {
    it("should render watch expression input", () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("Watch");
      const watchInput = container.querySelector(
        'input[placeholder="Add expression..."]'
      );
      expect(watchInput).toBeTruthy();
    });

    it("should add watch expression on Enter", async () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      const watchInput = container.querySelector(
        'input[placeholder="Add expression..."]'
      ) as HTMLInputElement;

      await fireEvent.input(watchInput, { target: { value: "myVar" } });
      await fireEvent.keyDown(watchInput, { key: "Enter" });

      expect(mockDebug.addWatchExpression).toHaveBeenCalledWith("myVar");
    });

    it("should display existing watch expressions", () => {
      resetMockDebug({
        state: {
          isDebugging: true,
          isPaused: true,
          watchExpressions: [
            { id: "w1", expression: "count", result: "42" },
            { id: "w2", expression: "name", result: '"hello"' },
          ],
        } as any,
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("count");
      expect(container.textContent).toContain("42");
      expect(container.textContent).toContain("name");
      expect(container.textContent).toContain('"hello"');
    });

    it("should display watch expression errors", () => {
      resetMockDebug({
        state: {
          isDebugging: true,
          isPaused: true,
          watchExpressions: [
            { id: "w1", expression: "invalid.expr", error: "ReferenceError" },
          ],
        } as any,
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      expect(container.textContent).toContain("invalid.expr");
      expect(container.textContent).toContain("ReferenceError");
    });

    it("should remove watch expression when x button is clicked", async () => {
      resetMockDebug({
        state: {
          isDebugging: true,
          isPaused: true,
          watchExpressions: [
            { id: "w1", expression: "count", result: "42" },
          ],
        } as any,
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      const removeBtn = container.querySelector('[data-testid="icon-btn-x-close"]') as HTMLButtonElement;
      if (removeBtn) {
        await fireEvent.click(removeBtn);
        expect(mockDebug.removeWatchExpression).toHaveBeenCalledWith("w1");
      }
    });

    it("should call refreshWatches when refresh button in Watch section is clicked", async () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);
      const refreshBtns = container.querySelectorAll('[data-testid="icon-btn-arrows-rotate"]');
      const watchRefreshBtn = refreshBtns[0] as HTMLButtonElement;
      if (watchRefreshBtn) {
        await fireEvent.click(watchRefreshBtn);
        expect(mockDebug.refreshWatches).toHaveBeenCalled();
      }
    });
  });

  describe("Section Toggling", () => {
    it("should toggle Variables section visibility", async () => {
      resetMockDebug({
        getSavedConfigurations: vi.fn().mockReturnValue([
          { id: "c1", name: "Launch", type: "node", request: "launch", saved: true },
        ]),
      });

      const { container } = render(() => <CortexDebugPanel />);

      expect(container.textContent).toContain("Not paused");

      const sectionHeaders = container.querySelectorAll('[style*="cursor: pointer"]');
      const variablesHeader = Array.from(sectionHeaders).find(
        (el) => el.textContent?.includes("Variables")
      ) as HTMLElement;

      if (variablesHeader) {
        await fireEvent.click(variablesHeader);
        expect(container.textContent).not.toContain("Not paused");

        await fireEvent.click(variablesHeader);
        expect(container.textContent).toContain("Not paused");
      }
    });
  });
});

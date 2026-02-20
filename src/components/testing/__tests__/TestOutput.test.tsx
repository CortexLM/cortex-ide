import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const mockTesting = {
  state: {
    tests: [],
    testIndex: new Map(),
    currentRun: null,
    runHistory: [],
    coverage: null,
    isRunning: false,
    isDiscovering: false,
    selectedTestId: null,
    expandedNodes: new Set(),
    filter: "all",
    searchQuery: "",
    framework: null,
    projectPath: null,
    watchMode: false,
    watcherId: null,
    showCoverage: false,
    autoRun: false,
    output: [] as string[],
    continuousRun: false,
    continuousSettings: { enabled: false, runOnSave: true, debounceMs: 500, runAffectedOnly: true },
    lastAutoRunTime: null,
    lastAutoRunFilePath: null,
    coverageDecorations: new Map(),
    showCoverageDecorations: false,
  },
  testCounts: () => ({ total: 0, passed: 0, failed: 0, skipped: 0, running: 0 }),
  filteredTests: () => [],
  coveragePercentage: () => 0,
  failedTestIds: () => [],
  goToTest: vi.fn(),
  selectTest: vi.fn(),
  clearResults: vi.fn(),
  clearOutput: vi.fn(),
};

vi.mock("@/context/TestingContext", () => ({
  useTesting: () => mockTesting,
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string }) => <span data-icon={props.name} />,
}));

vi.mock("@/components/ui", () => ({
  IconButton: (props: any) => <button {...props}>{props.children}</button>,
}));

describe("TestOutput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockTesting.state.output = [];
    mockTesting.state.isRunning = false;
  });

  it("renders without crashing", async () => {
    const { TestOutput } = await import("../TestOutput");
    const { container } = render(() => <TestOutput />);
    expect(container.firstChild).toBeTruthy();
  });

  it("shows empty state when no output", async () => {
    const { TestOutput } = await import("../TestOutput");
    const { container } = render(() => <TestOutput />);
    expect(container.textContent).toContain("No output yet");
  });

  it("renders output lines", async () => {
    mockTesting.state.output = ["PASS src/app.test.ts", "Tests: 1 passed"];

    const { TestOutput } = await import("../TestOutput");
    const { container } = render(() => <TestOutput />);
    expect(container.textContent).toContain("PASS src/app.test.ts");
    expect(container.textContent).toContain("Tests: 1 passed");
  });

  it("shows clear button", async () => {
    const { TestOutput } = await import("../TestOutput");
    const { container } = render(() => <TestOutput />);
    const buttons = container.querySelectorAll("button");
    const clearButton = Array.from(buttons).find(
      (b) => b.getAttribute("title") === "Clear Output",
    );
    expect(clearButton).toBeTruthy();
  });

  it("shows auto-scroll toggle", async () => {
    const { TestOutput } = await import("../TestOutput");
    const { container } = render(() => <TestOutput />);
    const buttons = container.querySelectorAll("button");
    const scrollButton = Array.from(buttons).find(
      (b) =>
        b.getAttribute("title") === "Auto-scroll On" ||
        b.getAttribute("title") === "Auto-scroll Off",
    );
    expect(scrollButton).toBeTruthy();
  });
});

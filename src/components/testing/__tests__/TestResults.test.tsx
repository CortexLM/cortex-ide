import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import type { TestItem } from "@/context/TestingContext";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const mockTesting = {
  state: {
    tests: [] as TestItem[],
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
    output: [],
    continuousRun: false,
    continuousSettings: { enabled: false, runOnSave: true, debounceMs: 500, runAffectedOnly: true },
    lastAutoRunTime: null,
    lastAutoRunFilePath: null,
    coverageDecorations: new Map(),
    showCoverageDecorations: false,
  },
  testCounts: () => ({ total: 0, passed: 0, failed: 0, skipped: 0, running: 0 }),
  filteredTests: () => [] as TestItem[],
  coveragePercentage: () => 0,
  failedTestIds: () => [],
  goToTest: vi.fn(),
  selectTest: vi.fn(),
  clearResults: vi.fn(),
  getTestResult: vi.fn().mockReturnValue(undefined),
  runTest: vi.fn(),
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

describe("TestResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockTesting.state.tests = [];
    mockTesting.state.currentRun = null;
    mockTesting.state.isRunning = false;
    mockTesting.testCounts = () => ({ total: 0, passed: 0, failed: 0, skipped: 0, running: 0 });
    mockTesting.filteredTests = () => [];
  });

  it("renders without crashing", async () => {
    const { TestResults } = await import("../TestResults");
    const { container } = render(() => <TestResults />);
    expect(container.firstChild).toBeTruthy();
  });

  it("shows summary bar", async () => {
    const { TestResults } = await import("../TestResults");
    const { container } = render(() => <TestResults />);
    expect(container.textContent).toContain("Test Results");
  });

  it("shows empty state when no results", async () => {
    const { TestResults } = await import("../TestResults");
    const { container } = render(() => <TestResults />);
    expect(container.textContent).toContain("No test results yet");
  });

  it("renders passed test results", async () => {
    mockTesting.testCounts = () => ({ total: 1, passed: 1, failed: 0, skipped: 0, running: 0 });
    mockTesting.filteredTests = () => [
      {
        id: "test-1",
        name: "should pass",
        fullName: "Suite > should pass",
        filePath: "/src/test.ts",
        type: "test" as const,
        children: [],
        status: "passed" as const,
        duration: 42,
      },
    ];

    const { TestResults } = await import("../TestResults");
    const { container } = render(() => <TestResults />);
    expect(container.textContent).toContain("should pass");
  });

  it("renders failed test results with error", async () => {
    mockTesting.testCounts = () => ({ total: 1, passed: 0, failed: 1, skipped: 0, running: 0 });
    mockTesting.filteredTests = () => [
      {
        id: "test-2",
        name: "should fail",
        fullName: "Suite > should fail",
        filePath: "/src/test.ts",
        type: "test" as const,
        children: [],
        status: "failed" as const,
        duration: 10,
        errorMessage: "Expected true to be false",
      },
    ];

    const { TestResults } = await import("../TestResults");
    const { container } = render(() => <TestResults />);
    expect(container.textContent).toContain("should fail");
  });
});

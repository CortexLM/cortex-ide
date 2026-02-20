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
    output: [],
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
  setShowCoverage: vi.fn(),
  runWithCoverage: vi.fn(),
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

describe("CoverageOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockTesting.state.coverage = null;
    mockTesting.state.showCoverage = false;
    mockTesting.coveragePercentage = () => 0;
  });

  it("renders without crashing", async () => {
    const { CoverageOverlay } = await import("../CoverageOverlay");
    const { container } = render(() => <CoverageOverlay />);
    expect(container.firstChild).toBeTruthy();
  });

  it("shows coverage percentage", async () => {
    mockTesting.state.coverage = {
      totalLines: 100,
      coveredLines: 75,
      totalBranches: 20,
      coveredBranches: 15,
      totalFunctions: 10,
      coveredFunctions: 8,
      totalStatements: 100,
      coveredStatements: 75,
      files: [],
      lastUpdated: Date.now(),
    } as any;
    mockTesting.coveragePercentage = () => 75.0;

    const { CoverageOverlay } = await import("../CoverageOverlay");
    const { container } = render(() => <CoverageOverlay />);
    expect(container.textContent).toContain("75.0%");
  });

  it("shows toggle button", async () => {
    const { CoverageOverlay } = await import("../CoverageOverlay");
    const { container } = render(() => <CoverageOverlay />);
    const buttons = container.querySelectorAll("button");
    const toggleButton = Array.from(buttons).find(
      (b) => b.getAttribute("title") === "Show Coverage" || b.getAttribute("title") === "Hide Coverage",
    );
    expect(toggleButton).toBeTruthy();
  });

  it("shows no coverage message when coverage is null", async () => {
    mockTesting.state.coverage = null;

    const { CoverageOverlay } = await import("../CoverageOverlay");
    const { container } = render(() => <CoverageOverlay />);
    expect(container.textContent).toContain("No coverage data");
  });
});

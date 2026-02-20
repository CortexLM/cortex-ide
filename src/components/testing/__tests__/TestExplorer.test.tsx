import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import { TestExplorer } from "../TestExplorer";
import type { TestExplorerProps, TestFile } from "../TestExplorer";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string }) => <span data-icon={props.name} />,
}));

vi.mock("@/components/ui", () => ({
  Button: (props: any) => <button {...props}>{props.children}</button>,
  IconButton: (props: any) => <button {...props}>{props.children}</button>,
}));

vi.mock("@/design-system/tokens", () => ({
  tokens: {
    spacing: { xs: "4px", sm: "8px", md: "12px", lg: "16px" },
  },
}));

const defaultProps: TestExplorerProps = {
  files: [],
  onRunAll: vi.fn(),
  onRunFailed: vi.fn(),
  onStopTests: vi.fn(),
  isRunning: false,
};

const sampleFiles: TestFile[] = [
  {
    id: "file-1",
    name: "app.test.ts",
    path: "/src/app.test.ts",
    status: "passed",
    duration: 120,
    suites: [],
    tests: [
      {
        id: "test-1",
        name: "should render",
        fullName: "App > should render",
        status: "passed",
        duration: 50,
        filePath: "/src/app.test.ts",
        lineNumber: 5,
      },
      {
        id: "test-2",
        name: "should handle click",
        fullName: "App > should handle click",
        status: "failed",
        duration: 70,
        error: "Expected true, got false",
        filePath: "/src/app.test.ts",
        lineNumber: 15,
      },
    ],
  },
];

describe("TestExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("renders without crashing", () => {
    const { container } = render(() => <TestExplorer {...defaultProps} />);
    expect(container.querySelector(".test-explorer")).toBeTruthy();
  });

  it("shows empty state when no files provided", () => {
    const { container } = render(() => <TestExplorer {...defaultProps} files={[]} />);
    expect(container.textContent).toContain("No tests found");
  });

  it("renders test files when provided", () => {
    const { container } = render(() => (
      <TestExplorer {...defaultProps} files={sampleFiles} />
    ));
    expect(container.textContent).toContain("app.test.ts");
  });

  it("shows run all button", () => {
    const { container } = render(() => <TestExplorer {...defaultProps} />);
    const buttons = container.querySelectorAll("button");
    const runAllButton = Array.from(buttons).find(
      (b) => b.getAttribute("tooltip") === "Run All Tests",
    );
    expect(runAllButton).toBeTruthy();
  });

  it("shows filter controls", () => {
    const { container } = render(() => <TestExplorer {...defaultProps} />);
    const buttons = container.querySelectorAll("button");
    const filterButton = Array.from(buttons).find(
      (b) => b.getAttribute("tooltip") === "Filter tests",
    );
    expect(filterButton).toBeTruthy();
  });
});

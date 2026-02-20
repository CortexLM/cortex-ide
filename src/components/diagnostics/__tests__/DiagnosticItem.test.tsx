import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { DiagnosticItem } from "../DiagnosticItem";
import type { UnifiedDiagnostic } from "@/context/DiagnosticsContext";

const createMockDiagnostic = (overrides: Partial<UnifiedDiagnostic> = {}): UnifiedDiagnostic => ({
  id: "test-1",
  uri: "file:///project/src/test.ts",
  severity: "error",
  message: "Test error message",
  source: "typescript",
  code: "TS2322",
  range: {
    start: { line: 10, character: 5 },
    end: { line: 10, character: 15 },
  },
  timestamp: Date.now(),
  ...overrides,
});

describe("DiagnosticItem", () => {
  it("renders diagnostic message", () => {
    const diagnostic = createMockDiagnostic({ message: "Cannot find name 'foo'" });
    const { getByText } = render(() => <DiagnosticItem diagnostic={diagnostic} />);
    expect(getByText("Cannot find name 'foo'")).toBeTruthy();
  });

  it("displays location with line number", () => {
    const diagnostic = createMockDiagnostic({
      range: { start: { line: 42, character: 10 }, end: { line: 42, character: 20 } },
    });
    const { container } = render(() => <DiagnosticItem diagnostic={diagnostic} />);
    expect(container.innerHTML).toContain("43:11");
  });

  it("shows code when available", () => {
    const diagnostic = createMockDiagnostic({ code: "no-unused-vars" });
    const { getByText } = render(() => <DiagnosticItem diagnostic={diagnostic} />);
    expect(getByText("no-unused-vars")).toBeTruthy();
  });

  it("shows source when available", () => {
    const diagnostic = createMockDiagnostic({ source: "eslint" });
    const { getByText } = render(() => <DiagnosticItem diagnostic={diagnostic} />);
    expect(getByText("eslint")).toBeTruthy();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const diagnostic = createMockDiagnostic();
    const { container } = render(() => <DiagnosticItem diagnostic={diagnostic} onClick={onClick} />);
    const item = container.querySelector('[role="listitem"]');
    if (item) fireEvent.click(item);
    expect(onClick).toHaveBeenCalledWith(diagnostic);
  });

  it("calls onDoubleClick when double-clicked", async () => {
    const onDoubleClick = vi.fn();
    const diagnostic = createMockDiagnostic();
    const { container } = render(() => (
      <DiagnosticItem diagnostic={diagnostic} onDoubleClick={onDoubleClick} />
    ));
    const item = container.querySelector('[role="listitem"]');
    if (item) fireEvent.dblClick(item);
    expect(onDoubleClick).toHaveBeenCalledWith(diagnostic);
  });

  it("applies selected styles when isSelected is true", () => {
    const diagnostic = createMockDiagnostic();
    const { container } = render(() => <DiagnosticItem diagnostic={diagnostic} isSelected={true} />);
    const item = container.querySelector('[role="listitem"]');
    expect(item?.getAttribute("aria-selected")).toBe("true");
  });

  it("shows file name when showFilePath is true", () => {
    const diagnostic = createMockDiagnostic({ uri: "file:///project/src/components/Button.tsx" });
    const { getByText } = render(() => (
      <DiagnosticItem diagnostic={diagnostic} showFilePath={true} />
    ));
    expect(getByText("Button.tsx")).toBeTruthy();
  });

  it("handles keyboard navigation with Enter key", async () => {
    const onClick = vi.fn();
    const diagnostic = createMockDiagnostic();
    const { container } = render(() => <DiagnosticItem diagnostic={diagnostic} onClick={onClick} />);
    const item = container.querySelector('[role="listitem"]');
    if (item) fireEvent.keyDown(item, { key: "Enter" });
    expect(onClick).toHaveBeenCalledWith(diagnostic);
  });

  it("handles keyboard navigation with Space key", async () => {
    const onClick = vi.fn();
    const diagnostic = createMockDiagnostic();
    const { container } = render(() => <DiagnosticItem diagnostic={diagnostic} onClick={onClick} />);
    const item = container.querySelector('[role="listitem"]');
    if (item) fireEvent.keyDown(item, { key: " " });
    expect(onClick).toHaveBeenCalledWith(diagnostic);
  });

  it("renders different severity icons", () => {
    const severities = ["error", "warning", "information", "hint"] as const;
    severities.forEach((severity) => {
      const diagnostic = createMockDiagnostic({ severity });
      const { unmount } = render(() => <DiagnosticItem diagnostic={diagnostic} />);
      unmount();
    });
  });
});

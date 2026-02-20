import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { BreakpointWidget } from "../BreakpointWidget";
import type { BreakpointWidgetProps } from "../BreakpointWidget";
import type { Breakpoint } from "@/context/DebugContext";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const defaultProps: BreakpointWidgetProps = {
  filePath: "/test/file.ts",
  line: 10,
  onClose: vi.fn(),
  onSave: vi.fn(),
};

describe("BreakpointWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("renders without crashing with required props", () => {
    const { container } = render(() => <BreakpointWidget {...defaultProps} />);
    expect(container.querySelector(".breakpoint-widget")).toBeTruthy();
  });

  it("shows breakpoint type selector with all types", () => {
    const { container } = render(() => <BreakpointWidget {...defaultProps} />);
    const select = container.querySelector("select");
    expect(select).toBeTruthy();
    const options = select!.querySelectorAll("option");
    const values = Array.from(options).map((o) => o.value);
    expect(values).toContain("breakpoint");
    expect(values).toContain("conditional");
    expect(values).toContain("logpoint");
    expect(values).toContain("hitCount");
  });

  it("shows condition input for conditional type", async () => {
    const { container } = render(() => (
      <BreakpointWidget {...defaultProps} initialType="conditional" />
    ));
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input!.getAttribute("placeholder")).toContain("condition");
  });

  it("shows hit count input for hitCount type", () => {
    const { container } = render(() => (
      <BreakpointWidget {...defaultProps} initialType="hitCount" />
    ));
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input!.getAttribute("placeholder")).toContain("hit count");
  });

  it("shows log message input for logpoint type", () => {
    const { container } = render(() => (
      <BreakpointWidget {...defaultProps} initialType="logpoint" />
    ));
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input!.getAttribute("placeholder")).toContain("log message");
  });

  it("calls onSave with correct data when Save button clicked", async () => {
    const onSave = vi.fn();
    const { container } = render(() => (
      <BreakpointWidget {...defaultProps} onSave={onSave} />
    ));
    const buttons = container.querySelectorAll("button");
    const saveButton = Array.from(buttons).find((b) => b.textContent === "Save");
    expect(saveButton).toBeTruthy();
    await fireEvent.click(saveButton!);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "breakpoint",
        condition: "",
        hitCondition: "",
        logMessage: "",
        enabled: true,
      })
    );
  });

  it("calls onClose when Cancel button clicked", async () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <BreakpointWidget {...defaultProps} onClose={onClose} />
    ));
    const buttons = container.querySelectorAll("button");
    const cancelButton = Array.from(buttons).find((b) => b.textContent === "Cancel");
    expect(cancelButton).toBeTruthy();
    await fireEvent.click(cancelButton!);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", async () => {
    const onClose = vi.fn();
    render(() => <BreakpointWidget {...defaultProps} onClose={onClose} />);
    await fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("initializes from existing breakpoint props", () => {
    const existingBreakpoint: Breakpoint = {
      path: "/test/file.ts",
      line: 10,
      verified: true,
      enabled: true,
      condition: "x > 5",
    };
    const { container } = render(() => (
      <BreakpointWidget {...defaultProps} breakpoint={existingBreakpoint} />
    ));
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("conditional");
    const header = container.textContent;
    expect(header).toContain("Edit Breakpoint");
  });

  it("shows Add Breakpoint header for new breakpoints", () => {
    const { container } = render(() => <BreakpointWidget {...defaultProps} />);
    expect(container.textContent).toContain("Add Breakpoint");
  });

  it("shows line number in header", () => {
    const { container } = render(() => <BreakpointWidget {...defaultProps} />);
    expect(container.textContent).toContain("Line 10");
  });
});

import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { DiagnosticsFilter } from "../DiagnosticsFilter";
import { DiagnosticsProvider } from "@/context/DiagnosticsContext";
import { LSPProvider } from "@/context/LSPContext";

const renderWithProviders = (ui: () => any) => {
  return render(() => (
    <LSPProvider>
      <DiagnosticsProvider>{ui()}</DiagnosticsProvider>
    </LSPProvider>
  ));
};

describe("DiagnosticsFilter", () => {
  it("renders filter toggles", () => {
    const { container } = renderWithProviders(() => <DiagnosticsFilter />);
    expect(container.innerHTML).toContain("Errors");
  });

  it("renders severity filter buttons", () => {
    const { container } = renderWithProviders(() => <DiagnosticsFilter />);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders group mode selector", () => {
    const { getByText } = renderWithProviders(() => <DiagnosticsFilter />);
    expect(getByText("Group:")).toBeTruthy();
    expect(getByText("File")).toBeTruthy();
    expect(getByText("Severity")).toBeTruthy();
    expect(getByText("Source")).toBeTruthy();
  });

  it("renders current file toggle", () => {
    const { getByText } = renderWithProviders(() => <DiagnosticsFilter />);
    expect(getByText("Current File")).toBeTruthy();
  });

  it("can toggle error filter", async () => {
    const { container } = renderWithProviders(() => <DiagnosticsFilter />);
    const buttons = container.querySelectorAll("button");
    if (buttons[0]) {
      fireEvent.click(buttons[0]);
    }
  });

  it("can change group mode", async () => {
    const { getByText } = renderWithProviders(() => <DiagnosticsFilter />);
    const severityButton = getByText("Severity");
    fireEvent.click(severityButton);
  });
});

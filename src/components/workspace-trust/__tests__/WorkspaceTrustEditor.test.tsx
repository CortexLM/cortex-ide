import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { WorkspaceTrustEditor } from "../WorkspaceTrustEditor";
import { WorkspaceTrustProvider } from "@/context/WorkspaceTrustContext";

const renderWithProvider = (ui: () => any) => {
  return render(() => <WorkspaceTrustProvider>{ui()}</WorkspaceTrustProvider>);
};

describe("WorkspaceTrustEditor", () => {
  it("renders without crashing within WorkspaceTrustProvider", () => {
    const { container } = renderWithProvider(() => <WorkspaceTrustEditor />);
    expect(container).toBeTruthy();
  });

  it("shows Workspace Trust Settings title", () => {
    const { container } = renderWithProvider(() => <WorkspaceTrustEditor />);
    expect(container.textContent).toContain("Workspace Trust Settings");
  });

  it("shows enable toggle", () => {
    const { container } = renderWithProvider(() => <WorkspaceTrustEditor />);
    expect(container.textContent).toContain("Enable Workspace Trust");
  });

  it("shows banner toggle", () => {
    const { container } = renderWithProvider(() => <WorkspaceTrustEditor />);
    expect(container.textContent).toContain("Show Trust Banner");
  });

  it("shows Trusted Folders section", () => {
    const { container } = renderWithProvider(() => <WorkspaceTrustEditor />);
    expect(container.textContent).toContain("Trusted Folders");
  });

  it("shows empty state when no folders", () => {
    const { container } = renderWithProvider(() => <WorkspaceTrustEditor />);
    expect(container.textContent).toContain("No trusted folders configured");
  });

  it("add folder input exists", () => {
    const { container } = renderWithProvider(() => <WorkspaceTrustEditor />);
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
  });
});

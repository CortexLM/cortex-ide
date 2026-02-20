import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { WorkspaceTrustBanner } from "../WorkspaceTrustBanner";
import { WorkspaceTrustProvider } from "@/context/WorkspaceTrustContext";

const renderWithProvider = (ui: () => any) => {
  return render(() => <WorkspaceTrustProvider>{ui()}</WorkspaceTrustProvider>);
};

describe("WorkspaceTrustBanner", () => {
  it("renders without crashing", () => {
    const { container } = renderWithProvider(() => <WorkspaceTrustBanner />);
    expect(container).toBeTruthy();
  });

  it("can be rendered within provider", () => {
    const result = renderWithProvider(() => <WorkspaceTrustBanner />);
    expect(result.container).toBeTruthy();
  });

  it("component is defined", () => {
    expect(WorkspaceTrustBanner).toBeDefined();
    expect(typeof WorkspaceTrustBanner).toBe("function");
  });

  it("accepts style prop", () => {
    const { container } = renderWithProvider(() => (
      <WorkspaceTrustBanner style={{ "margin-top": "10px" }} />
    ));
    expect(container).toBeTruthy();
  });

  it("accepts class prop", () => {
    const { container } = renderWithProvider(() => (
      <WorkspaceTrustBanner class="custom-class" />
    ));
    expect(container).toBeTruthy();
  });
});

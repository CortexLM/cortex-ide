import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { RestrictedModeBadge } from "../RestrictedModeBadge";
import { WorkspaceTrustProvider } from "@/context/WorkspaceTrustContext";

const renderWithProvider = (ui: () => any) => {
  return render(() => <WorkspaceTrustProvider>{ui()}</WorkspaceTrustProvider>);
};

describe("RestrictedModeBadge", () => {
  it("renders without crashing", () => {
    const { container } = renderWithProvider(() => <RestrictedModeBadge />);
    expect(container).toBeTruthy();
  });

  it("component is defined", () => {
    expect(RestrictedModeBadge).toBeDefined();
    expect(typeof RestrictedModeBadge).toBe("function");
  });

  it("accepts style prop", () => {
    const { container } = renderWithProvider(() => (
      <RestrictedModeBadge style={{ "margin-left": "5px" }} />
    ));
    expect(container).toBeTruthy();
  });

  it("accepts class prop", () => {
    const { container } = renderWithProvider(() => (
      <RestrictedModeBadge class="custom-badge" />
    ));
    expect(container).toBeTruthy();
  });
});

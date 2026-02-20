import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { ScreenReaderAnnouncer } from "../ScreenReaderAnnouncer";

describe("ScreenReaderAnnouncer", () => {
  it("renders with aria-live region", () => {
    const { container } = render(() => <ScreenReaderAnnouncer />);
    const region = container.querySelector('[role="status"]');
    expect(region).toBeTruthy();
    expect(region?.getAttribute("aria-live")).toBe("polite");
  });

  it("has aria-atomic attribute", () => {
    const { container } = render(() => <ScreenReaderAnnouncer />);
    const region = container.querySelector('[role="status"]');
    expect(region?.getAttribute("aria-atomic")).toBe("true");
  });

  it("is visually hidden but accessible", () => {
    const { container } = render(() => <ScreenReaderAnnouncer />);
    const region = container.querySelector('[role="status"]');
    const style = region?.getAttribute("style");
    expect(style).toContain("position: absolute");
    expect(style).toContain("width: 1px");
    expect(style).toContain("height: 1px");
  });

  it("accepts style prop", () => {
    const { container } = render(() => <ScreenReaderAnnouncer style={{}} />);
    expect(container).toBeTruthy();
  });

  it("accepts class prop", () => {
    const { container } = render(() => <ScreenReaderAnnouncer class="sr-only" />);
    expect(container).toBeTruthy();
  });

  it("component is defined", () => {
    expect(ScreenReaderAnnouncer).toBeDefined();
    expect(typeof ScreenReaderAnnouncer).toBe("function");
  });
});

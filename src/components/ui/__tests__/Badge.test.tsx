import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { Badge, StatusDot } from "../Badge";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("Badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with children text", () => {
      const { getByText } = render(() => <Badge>New</Badge>);
      expect(getByText("New")).toBeTruthy();
    });

    it("renders as a span element", () => {
      const { container } = render(() => <Badge>Label</Badge>);
      const span = container.querySelector("span");
      expect(span).toBeTruthy();
      expect(span!.textContent).toBe("Label");
    });

    it("renders numeric content", () => {
      const { getByText } = render(() => <Badge>42</Badge>);
      expect(getByText("42")).toBeTruthy();
    });
  });

  describe("variants", () => {
    it("applies default variant styles", () => {
      const { container } = render(() => <Badge variant="default">Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-bg-hover");
    });

    it("applies accent variant styles", () => {
      const { container } = render(() => <Badge variant="accent">Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-accent-primary");
    });

    it("applies success variant styles", () => {
      const { container } = render(() => <Badge variant="success">Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-success-bg");
    });

    it("applies warning variant styles", () => {
      const { container } = render(() => <Badge variant="warning">Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-warning-bg");
    });

    it("applies error variant styles", () => {
      const { container } = render(() => <Badge variant="error">Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-error-bg");
    });

    it("applies muted variant styles", () => {
      const { container } = render(() => <Badge variant="muted">Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-bg-primary");
    });

    it("defaults to default variant when no variant specified", () => {
      const { container } = render(() => <Badge>Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-bg-hover");
    });
  });

  describe("sizes", () => {
    it("applies sm size styles by default", () => {
      const { container } = render(() => <Badge>Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.fontSize).toBe("10px");
      expect(span.style.padding).toBe("1px 6px");
    });

    it("applies md size styles", () => {
      const { container } = render(() => <Badge size="md">Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.fontSize).toBe("11px");
      expect(span.style.padding).toBe("2px 8px");
    });
  });

  describe("base styles", () => {
    it("applies pill border radius", () => {
      const { container } = render(() => <Badge>Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.borderRadius).toContain("cortex-radius-full");
    });

    it("applies inline-flex display", () => {
      const { container } = render(() => <Badge>Tag</Badge>);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.display).toBe("inline-flex");
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop", () => {
      const { container } = render(() => (
        <Badge style={{ "margin-left": "8px" }}>Tag</Badge>
      ));
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.marginLeft).toBe("8px");
    });
  });
});

describe("StatusDot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders as a span element", () => {
      const { container } = render(() => <StatusDot status="idle" />);
      const span = container.querySelector("span");
      expect(span).toBeTruthy();
    });
  });

  describe("status colors", () => {
    it("applies idle color", () => {
      const { container } = render(() => <StatusDot status="idle" />);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-bg-active");
    });

    it("applies active color", () => {
      const { container } = render(() => <StatusDot status="active" />);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-accent-primary");
    });

    it("applies success color", () => {
      const { container } = render(() => <StatusDot status="success" />);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-success");
    });

    it("applies warning color", () => {
      const { container } = render(() => <StatusDot status="warning" />);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-warning");
    });

    it("applies error color", () => {
      const { container } = render(() => <StatusDot status="error" />);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.background).toContain("cortex-error");
    });
  });

  describe("sizes", () => {
    it("applies sm size (default)", () => {
      const { container } = render(() => <StatusDot status="idle" />);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.width).toBe("6px");
      expect(span.style.height).toBe("6px");
    });

    it("applies md size", () => {
      const { container } = render(() => <StatusDot status="idle" size="md" />);
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.width).toBe("8px");
      expect(span.style.height).toBe("8px");
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop", () => {
      const { container } = render(() => (
        <StatusDot status="idle" style={{ "margin-right": "4px" }} />
      ));
      const span = container.querySelector("span") as HTMLElement;
      expect(span.style.marginRight).toBe("4px");
    });
  });
});

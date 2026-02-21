import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { Avatar, AvatarGroup } from "../Avatar";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("Avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders a container div", () => {
      const { container } = render(() => <Avatar />);
      const div = container.querySelector("div");
      expect(div).toBeTruthy();
    });

    it("renders with circular border radius", () => {
      const { container } = render(() => <Avatar />);
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.borderRadius).toContain("cortex-radius-full");
    });
  });

  describe("image mode", () => {
    it("renders an img element when src is provided", () => {
      const { container } = render(() => (
        <Avatar src="https://example.com/avatar.png" />
      ));
      const img = container.querySelector("img");
      expect(img).toBeTruthy();
      expect(img?.getAttribute("src")).toBe("https://example.com/avatar.png");
    });

    it("uses alt text from alt prop", () => {
      const { container } = render(() => (
        <Avatar src="https://example.com/avatar.png" alt="User photo" />
      ));
      const img = container.querySelector("img");
      expect(img?.getAttribute("alt")).toBe("User photo");
    });

    it("uses name as alt fallback", () => {
      const { container } = render(() => (
        <Avatar src="https://example.com/avatar.png" name="John Doe" />
      ));
      const img = container.querySelector("img");
      expect(img?.getAttribute("alt")).toBe("John Doe");
    });

    it("uses Avatar as default alt text", () => {
      const { container } = render(() => (
        <Avatar src="https://example.com/avatar.png" />
      ));
      const img = container.querySelector("img");
      expect(img?.getAttribute("alt")).toBe("Avatar");
    });
  });

  describe("initials mode", () => {
    it("renders initials when no src but name is provided", () => {
      const { getByText } = render(() => <Avatar name="John Doe" />);
      expect(getByText("JD")).toBeTruthy();
    });

    it("renders single initial for single name", () => {
      const { getByText } = render(() => <Avatar name="Alice" />);
      expect(getByText("A")).toBeTruthy();
    });

    it("uses first and last name initials", () => {
      const { getByText } = render(() => <Avatar name="Jane Mary Smith" />);
      expect(getByText("JS")).toBeTruthy();
    });

    it("renders uppercase initials", () => {
      const { getByText } = render(() => <Avatar name="john doe" />);
      expect(getByText("JD")).toBeTruthy();
    });

    it("renders empty span when no name or src", () => {
      const { container } = render(() => <Avatar />);
      const span = container.querySelector("span");
      expect(span).toBeTruthy();
      expect(span?.textContent).toBe("");
    });

    it("does not render img when no src", () => {
      const { container } = render(() => <Avatar name="John" />);
      const img = container.querySelector("img");
      expect(img).toBeNull();
    });
  });

  describe("sizes", () => {
    it("applies xs size (20px)", () => {
      const { container } = render(() => <Avatar size="xs" />);
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.width).toBe("20px");
      expect(div.style.height).toBe("20px");
    });

    it("applies sm size (24px)", () => {
      const { container } = render(() => <Avatar size="sm" />);
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.width).toBe("24px");
      expect(div.style.height).toBe("24px");
    });

    it("applies md size by default (32px)", () => {
      const { container } = render(() => <Avatar />);
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.width).toBe("32px");
      expect(div.style.height).toBe("32px");
    });

    it("applies lg size (40px)", () => {
      const { container } = render(() => <Avatar size="lg" />);
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.width).toBe("40px");
      expect(div.style.height).toBe("40px");
    });

    it("applies xl size (56px)", () => {
      const { container } = render(() => <Avatar size="xl" />);
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.width).toBe("56px");
      expect(div.style.height).toBe("56px");
    });
  });

  describe("status indicator", () => {
    it("renders status dot when status is provided", () => {
      const { container } = render(() => <Avatar status="online" />);
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBeGreaterThanOrEqual(1);
    });

    it("does not render status dot when status is not provided", () => {
      const { container } = render(() => <Avatar name="John" />);
      const div = container.querySelector("div") as HTMLElement;
      const innerSpans = div.querySelectorAll(":scope > span");
      expect(innerSpans.length).toBe(1);
    });

    it("applies online color", () => {
      const { container } = render(() => <Avatar status="online" />);
      const div = container.querySelector("div") as HTMLElement;
      const statusDot = div.querySelectorAll(":scope > span")[1] as HTMLElement;
      expect(statusDot.style.background).toContain("cortex-success");
    });

    it("applies away color", () => {
      const { container } = render(() => <Avatar status="away" />);
      const div = container.querySelector("div") as HTMLElement;
      const statusDot = div.querySelectorAll(":scope > span")[1] as HTMLElement;
      expect(statusDot.style.background).toContain("cortex-warning");
    });

    it("applies busy color", () => {
      const { container } = render(() => <Avatar status="busy" />);
      const div = container.querySelector("div") as HTMLElement;
      const statusDot = div.querySelectorAll(":scope > span")[1] as HTMLElement;
      expect(statusDot.style.background).toContain("cortex-error");
    });

    it("applies offline color", () => {
      const { container } = render(() => <Avatar status="offline" />);
      const div = container.querySelector("div") as HTMLElement;
      const statusDot = div.querySelectorAll(":scope > span")[1] as HTMLElement;
      expect(statusDot.style.background).toContain("jb-text-muted-color");
    });
  });

  describe("background color", () => {
    it("generates consistent background from name", () => {
      const { container: c1 } = render(() => <Avatar name="John" />);
      const { container: c2 } = render(() => <Avatar name="John" />);
      const bg1 = (c1.querySelector("div") as HTMLElement).style.background;
      const bg2 = (c2.querySelector("div") as HTMLElement).style.background;
      expect(bg1).toBe(bg2);
    });

    it("uses fallback background when no name", () => {
      const { container } = render(() => <Avatar />);
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.background).toContain("jb-surface-active");
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop", () => {
      const { container } = render(() => (
        <Avatar style={{ "margin-right": "8px" }} />
      ));
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.marginRight).toBe("8px");
    });
  });
});

describe("AvatarGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders children", () => {
      const { getByText } = render(() => (
        <AvatarGroup>
          <span>Child 1</span>
          <span>Child 2</span>
        </AvatarGroup>
      ));
      expect(getByText("Child 1")).toBeTruthy();
      expect(getByText("Child 2")).toBeTruthy();
    });

    it("uses flex layout", () => {
      const { container } = render(() => (
        <AvatarGroup>
          <span>Child</span>
        </AvatarGroup>
      ));
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.display).toBe("flex");
      expect(div.style.alignItems).toBe("center");
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop", () => {
      const { container } = render(() => (
        <AvatarGroup style={{ gap: "4px" }}>
          <span>Child</span>
        </AvatarGroup>
      ));
      const div = container.querySelector("div") as HTMLElement;
      expect(div.style.gap).toBe("4px");
    });
  });
});

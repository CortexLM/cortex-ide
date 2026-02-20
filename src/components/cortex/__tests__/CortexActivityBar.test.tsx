import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexActivityBar } from "../CortexActivityBar";
import type { ActivityBarItem, CortexActivityBarProps } from "../CortexActivityBar";

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
  CortexTooltip: (props: { content: string; position?: string; children: import("solid-js").JSX.Element }) => (
    <div data-tooltip={props.content}>{props.children}</div>
  ),
  CortexToggle: (props: { checked?: boolean; onChange?: (v: boolean) => void; size?: string }) => (
    <input
      type="checkbox"
      data-testid="toggle"
      checked={props.checked}
      onChange={(e) => props.onChange?.(e.currentTarget.checked)}
    />
  ),
}));

describe("CortexActivityBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct ActivityBarItem interface structure", () => {
      const item: ActivityBarItem = {
        id: "test-id",
        icon: "home",
        label: "Test Label",
        badge: 5,
      };

      expect(item.id).toBe("test-id");
      expect(item.icon).toBe("home");
      expect(item.label).toBe("Test Label");
      expect(item.badge).toBe(5);
    });

    it("should have correct CortexActivityBarProps interface structure", () => {
      const props: CortexActivityBarProps = {
        items: [{ id: "1", icon: "home", label: "Home" }],
        activeId: "1",
        onItemClick: vi.fn(),
        avatarUrl: "https://example.com/avatar.png",
        onAvatarClick: vi.fn(),
        showToggle: true,
        toggleValue: false,
        onToggleChange: vi.fn(),
        class: "custom-class",
        style: { width: "50px" },
      };

      expect(props.items).toHaveLength(1);
      expect(props.activeId).toBe("1");
      expect(props.showToggle).toBe(true);
    });
  });

  describe("Rendering", () => {
    it("should render with default items when no items provided", () => {
      const { container } = render(() => <CortexActivityBar />);
      const buttons = container.querySelectorAll('button[aria-label]');
      expect(buttons.length).toBeGreaterThanOrEqual(12);
    });

    it("should render custom items when provided", () => {
      const customItems: ActivityBarItem[] = [
        { id: "custom1", icon: "star", label: "Custom 1" },
        { id: "custom2", icon: "heart", label: "Custom 2" },
      ];

      const { container } = render(() => <CortexActivityBar items={customItems} />);
      const buttons = container.querySelectorAll('nav button[aria-label]');
      expect(buttons.length).toBe(2);
    });

    it("should render avatar button", () => {
      const { container } = render(() => <CortexActivityBar />);
      const avatarButton = container.querySelector('button[aria-label="User account"]');
      expect(avatarButton).toBeTruthy();
    });

    it("should render avatar image when avatarUrl is provided", () => {
      const { container } = render(() => (
        <CortexActivityBar avatarUrl="https://example.com/avatar.png" />
      ));
      const img = container.querySelector('img[alt="User avatar"]');
      expect(img).toBeTruthy();
      expect(img?.getAttribute("src")).toBe("https://example.com/avatar.png");
    });

    it("should render toggle when showToggle is true", () => {
      const { getByTestId } = render(() => <CortexActivityBar showToggle={true} />);
      expect(getByTestId("toggle")).toBeTruthy();
    });

    it("should not render toggle when showToggle is false", () => {
      const { queryByTestId } = render(() => <CortexActivityBar showToggle={false} />);
      expect(queryByTestId("toggle")).toBeNull();
    });
  });

  describe("State Management", () => {
    it("should mark active item with aria-pressed true", () => {
      const items: ActivityBarItem[] = [
        { id: "item1", icon: "home", label: "Home" },
        { id: "item2", icon: "files", label: "Files" },
      ];

      const { container } = render(() => (
        <CortexActivityBar items={items} activeId="item1" />
      ));

      const buttons = container.querySelectorAll('nav button[aria-label]');
      expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
      expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");
    });

    it("should display badge when badge value is provided", () => {
      const items: ActivityBarItem[] = [
        { id: "item1", icon: "home", label: "Home", badge: 5 },
      ];

      const { container } = render(() => <CortexActivityBar items={items} />);
      const badgeText = container.textContent;
      expect(badgeText).toContain("5");
    });

    it("should display 99+ when badge exceeds 99", () => {
      const items: ActivityBarItem[] = [
        { id: "item1", icon: "home", label: "Home", badge: 150 },
      ];

      const { container } = render(() => <CortexActivityBar items={items} />);
      const badgeText = container.textContent;
      expect(badgeText).toContain("99+");
    });
  });

  describe("User Interactions", () => {
    it("should call onItemClick when item is clicked", async () => {
      const onItemClick = vi.fn();
      const items: ActivityBarItem[] = [
        { id: "item1", icon: "home", label: "Home" },
      ];

      const { container } = render(() => (
        <CortexActivityBar items={items} onItemClick={onItemClick} />
      ));

      const button = container.querySelector('nav button[aria-label="Home"]');
      if (button) {
        await fireEvent.click(button);
      }

      expect(onItemClick).toHaveBeenCalledWith("item1");
    });

    it("should call onAvatarClick when avatar is clicked", async () => {
      const onAvatarClick = vi.fn();

      const { container } = render(() => (
        <CortexActivityBar onAvatarClick={onAvatarClick} />
      ));

      const avatarButton = container.querySelector('button[aria-label="User account"]');
      if (avatarButton) {
        await fireEvent.click(avatarButton);
      }

      expect(onAvatarClick).toHaveBeenCalled();
    });

    it("should call onToggleChange when toggle is changed", async () => {
      const onToggleChange = vi.fn();

      const { getByTestId } = render(() => (
        <CortexActivityBar showToggle={true} toggleValue={false} onToggleChange={onToggleChange} />
      ));

      const toggle = getByTestId("toggle");
      await fireEvent.click(toggle);

      expect(onToggleChange).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => <CortexActivityBar class="custom-class" />);
      const aside = container.querySelector("aside");
      expect(aside?.className).toContain("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexActivityBar style={{ "background-color": "red" }} />
      ));
      const aside = container.querySelector("aside");
      expect(aside?.style.backgroundColor).toBe("red");
    });

    it("should have correct container width using CSS variable", () => {
      const { container } = render(() => <CortexActivityBar />);
      const aside = container.querySelector("aside");
      expect(aside?.style.width).toBe("var(--cortex-space-10)");
    });
  });
});

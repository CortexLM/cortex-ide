import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexActivityBar } from "../CortexActivityBar";
import type { ActivityBarItem } from "../CortexActivityBar";

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} data-color={props.color} />
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

  describe("DEFAULT_ITEMS rendering", () => {
    const EXPECTED_ITEMS = [
      { id: "home", icon: "home", label: "Home" },
      { id: "files", icon: "folder", label: "Explorer" },
      { id: "search", icon: "search", label: "Search" },
      { id: "git", icon: "git", label: "Source Control" },
      { id: "debug", icon: "play", label: "Run & Debug" },
      { id: "plugins", icon: "plugins", label: "Plugins" },
      { id: "agents", icon: "users", label: "AI Agents" },
      { id: "extensions", icon: "grid", label: "Extensions" },
      { id: "docs", icon: "book", label: "Documentation" },
      { id: "themes", icon: "brush", label: "Themes" },
    ];

    it("should render exactly 10 default nav items (plus settings and avatar buttons)", () => {
      const { container } = render(() => <CortexActivityBar />);
      const navButtons = container.querySelectorAll("nav button[aria-label]");
      expect(navButtons.length).toBe(10);
    });

    it("should NOT include factory item after Phase 1 removal", () => {
      const { container } = render(() => <CortexActivityBar />);
      const factoryButton = container.querySelector('button[aria-label="Factory"]');
      expect(factoryButton).toBeNull();
      const factoryIcon = container.querySelector('[data-testid="icon-map"]');
      expect(factoryIcon).toBeNull();
    });

    EXPECTED_ITEMS.forEach((expected, index) => {
      it(`should render DEFAULT_ITEMS[${index}] with id="${expected.id}", icon="${expected.icon}", label="${expected.label}"`, () => {
        const { container } = render(() => <CortexActivityBar />);
        const navButtons = container.querySelectorAll("nav button[aria-label]");
        const button = navButtons[index];
        expect(button).toBeTruthy();
        expect(button.getAttribute("aria-label")).toBe(expected.label);
        const icon = button.querySelector(`[data-testid="icon-${expected.icon}"]`);
        expect(icon).toBeTruthy();
      });
    });

    it("should render default items in the correct order", () => {
      const { container } = render(() => <CortexActivityBar />);
      const navButtons = container.querySelectorAll("nav button[aria-label]");
      const labels = Array.from(navButtons).map((b) => b.getAttribute("aria-label"));
      expect(labels).toEqual(EXPECTED_ITEMS.map((i) => i.label));
    });
  });

  describe("custom items rendering", () => {
    it("should render only custom items when items prop is provided", () => {
      const customItems: ActivityBarItem[] = [
        { id: "custom1", icon: "star", label: "Favorites" },
        { id: "custom2", icon: "heart", label: "Liked" },
        { id: "custom3", icon: "bell", label: "Notifications" },
      ];

      const { container } = render(() => <CortexActivityBar items={customItems} />);
      const navButtons = container.querySelectorAll("nav button[aria-label]");
      expect(navButtons.length).toBe(3);
      expect(navButtons[0].getAttribute("aria-label")).toBe("Favorites");
      expect(navButtons[1].getAttribute("aria-label")).toBe("Liked");
      expect(navButtons[2].getAttribute("aria-label")).toBe("Notifications");
    });

    it("should render correct icons for custom items", () => {
      const customItems: ActivityBarItem[] = [
        { id: "c1", icon: "star", label: "Star" },
      ];

      const { container } = render(() => <CortexActivityBar items={customItems} />);
      const icon = container.querySelector('[data-testid="icon-star"]');
      expect(icon).toBeTruthy();
    });

    it("should not render any default items when custom items are provided", () => {
      const customItems: ActivityBarItem[] = [
        { id: "only", icon: "zap", label: "Only Item" },
      ];

      const { container } = render(() => <CortexActivityBar items={customItems} />);
      const homeIcon = container.querySelector('[data-testid="icon-home"]');
      expect(homeIcon).toBeNull();
    });
  });

  describe("active item highlighting", () => {
    it("should set aria-pressed to true on the active item", () => {
      const items: ActivityBarItem[] = [
        { id: "a", icon: "home", label: "A" },
        { id: "b", icon: "folder", label: "B" },
        { id: "c", icon: "search", label: "C" },
      ];

      const { container } = render(() => (
        <CortexActivityBar items={items} activeId="b" />
      ));
      const navButtons = container.querySelectorAll("nav button[aria-label]");
      expect(navButtons[0].getAttribute("aria-pressed")).toBe("false");
      expect(navButtons[1].getAttribute("aria-pressed")).toBe("true");
      expect(navButtons[2].getAttribute("aria-pressed")).toBe("false");
    });

    it("should set all items to aria-pressed false when activeId is null", () => {
      const items: ActivityBarItem[] = [
        { id: "a", icon: "home", label: "A" },
        { id: "b", icon: "folder", label: "B" },
      ];

      const { container } = render(() => (
        <CortexActivityBar items={items} activeId={null} />
      ));
      const navButtons = container.querySelectorAll("nav button[aria-label]");
      expect(navButtons[0].getAttribute("aria-pressed")).toBe("false");
      expect(navButtons[1].getAttribute("aria-pressed")).toBe("false");
    });

    it("should apply lime background on the active item", () => {
      const items: ActivityBarItem[] = [
        { id: "a", icon: "home", label: "A" },
      ];

      const { container } = render(() => (
        <CortexActivityBar items={items} activeId="a" />
      ));
      const button = container.querySelector('nav button[aria-label="A"]');
      expect(button).toBeTruthy();
      expect((button as HTMLElement).style.background).toBe("rgb(191, 255, 0)");
    });
  });

  describe("onItemClick callback", () => {
    it("should call onItemClick with the correct id when an item is clicked", async () => {
      const onItemClick = vi.fn();
      const items: ActivityBarItem[] = [
        { id: "item-alpha", icon: "home", label: "Alpha" },
        { id: "item-beta", icon: "folder", label: "Beta" },
      ];

      const { container } = render(() => (
        <CortexActivityBar items={items} onItemClick={onItemClick} />
      ));

      const betaButton = container.querySelector('nav button[aria-label="Beta"]');
      expect(betaButton).toBeTruthy();
      await fireEvent.click(betaButton!);
      expect(onItemClick).toHaveBeenCalledTimes(1);
      expect(onItemClick).toHaveBeenCalledWith("item-beta");
    });

    it("should call onItemClick with different ids for different items", async () => {
      const onItemClick = vi.fn();
      const items: ActivityBarItem[] = [
        { id: "first", icon: "home", label: "First" },
        { id: "second", icon: "folder", label: "Second" },
      ];

      const { container } = render(() => (
        <CortexActivityBar items={items} onItemClick={onItemClick} />
      ));

      await fireEvent.click(container.querySelector('nav button[aria-label="First"]')!);
      await fireEvent.click(container.querySelector('nav button[aria-label="Second"]')!);
      expect(onItemClick).toHaveBeenCalledTimes(2);
      expect(onItemClick).toHaveBeenNthCalledWith(1, "first");
      expect(onItemClick).toHaveBeenNthCalledWith(2, "second");
    });

    it("should not throw when onItemClick is not provided", async () => {
      const items: ActivityBarItem[] = [
        { id: "solo", icon: "home", label: "Solo" },
      ];

      const { container } = render(() => <CortexActivityBar items={items} />);
      const button = container.querySelector('nav button[aria-label="Solo"]');
      expect(() => fireEvent.click(button!)).not.toThrow();
    });
  });

  describe("avatar section", () => {
    it("should render avatar button at the bottom", () => {
      const { container } = render(() => <CortexActivityBar />);
      const avatarButton = container.querySelector('button[aria-label="User account"]');
      expect(avatarButton).toBeTruthy();
    });

    it("should render avatar image when avatarUrl is provided", () => {
      const url = "https://example.com/avatar.png";
      const { container } = render(() => <CortexActivityBar avatarUrl={url} />);
      const img = container.querySelector('img[alt="User avatar"]');
      expect(img).toBeTruthy();
      expect(img!.getAttribute("src")).toBe(url);
    });

    it("should render fallback user icon when no avatarUrl is provided", () => {
      const { container } = render(() => <CortexActivityBar />);
      const avatarButton = container.querySelector('button[aria-label="User account"]');
      expect(avatarButton).toBeTruthy();
      const userIcon = avatarButton!.querySelector('[data-testid="icon-user"]');
      expect(userIcon).toBeTruthy();
      const img = avatarButton!.querySelector("img");
      expect(img).toBeNull();
    });

    it("should render the green status dot on the avatar", () => {
      const { container } = render(() => <CortexActivityBar />);
      const avatarButton = container.querySelector('button[aria-label="User account"]');
      expect(avatarButton).toBeTruthy();
      const html = avatarButton!.innerHTML;
      expect(html).toContain("6px");
      expect(html).toContain("34D399");
    });
  });

  describe("onAvatarClick callback", () => {
    it("should call onAvatarClick when avatar button is clicked", async () => {
      const onAvatarClick = vi.fn();
      const { container } = render(() => (
        <CortexActivityBar onAvatarClick={onAvatarClick} />
      ));

      const avatarButton = container.querySelector('button[aria-label="User account"]');
      await fireEvent.click(avatarButton!);
      expect(onAvatarClick).toHaveBeenCalledTimes(1);
    });

    it("should not throw when onAvatarClick is not provided", async () => {
      const { container } = render(() => <CortexActivityBar />);
      const avatarButton = container.querySelector('button[aria-label="User account"]');
      expect(() => fireEvent.click(avatarButton!)).not.toThrow();
    });
  });

  describe("onSettingsClick callback", () => {
    it("should call onSettingsClick when settings button is clicked", async () => {
      const onSettingsClick = vi.fn();
      const { container } = render(() => (
        <CortexActivityBar onSettingsClick={onSettingsClick} />
      ));

      const settingsButton = container.querySelector('button[aria-label="Settings"]');
      expect(settingsButton).toBeTruthy();
      await fireEvent.click(settingsButton!);
      expect(onSettingsClick).toHaveBeenCalledTimes(1);
    });

    it("should render settings icon (settings-02)", () => {
      const { container } = render(() => <CortexActivityBar />);
      const settingsIcon = container.querySelector('[data-testid="icon-settings-02"]');
      expect(settingsIcon).toBeTruthy();
    });

    it("should dispatch custom event when onSettingsClick is not provided", async () => {
      const dispatchSpy = vi.fn();
      const originalDispatch = window.dispatchEvent;
      window.dispatchEvent = dispatchSpy;

      const { container } = render(() => <CortexActivityBar />);
      const settingsButton = container.querySelector('button[aria-label="Settings"]');
      await fireEvent.click(settingsButton!);

      expect(dispatchSpy).toHaveBeenCalled();
      const event = dispatchSpy.mock.calls[0][0];
      expect(event.type).toBe("settings:open-tab");

      window.dispatchEvent = originalDispatch;
    });
  });

  describe("toggle visibility", () => {
    it("should show toggle when showToggle is true", () => {
      const { queryByTestId } = render(() => (
        <CortexActivityBar showToggle={true} />
      ));
      expect(queryByTestId("toggle")).toBeTruthy();
    });

    it("should not show toggle when showToggle is false", () => {
      const { queryByTestId } = render(() => (
        <CortexActivityBar showToggle={false} />
      ));
      expect(queryByTestId("toggle")).toBeNull();
    });

    it("should not show toggle when showToggle is undefined", () => {
      const { queryByTestId } = render(() => <CortexActivityBar />);
      expect(queryByTestId("toggle")).toBeNull();
    });

    it("should pass checked state to toggle", () => {
      const { getByTestId } = render(() => (
        <CortexActivityBar showToggle={true} toggleValue={true} />
      ));
      const toggle = getByTestId("toggle") as HTMLInputElement;
      expect(toggle.checked).toBe(true);
    });
  });

  describe("onToggleChange callback", () => {
    it("should call onToggleChange when toggle is clicked", async () => {
      const onToggleChange = vi.fn();
      const { getByTestId } = render(() => (
        <CortexActivityBar
          showToggle={true}
          toggleValue={false}
          onToggleChange={onToggleChange}
        />
      ));

      const toggle = getByTestId("toggle");
      await fireEvent.click(toggle);
      expect(onToggleChange).toHaveBeenCalled();
    });

    it("should not throw when onToggleChange is not provided", async () => {
      const { getByTestId } = render(() => (
        <CortexActivityBar showToggle={true} />
      ));
      const toggle = getByTestId("toggle");
      expect(() => fireEvent.click(toggle)).not.toThrow();
    });
  });

  describe("custom class and style props", () => {
    it("should apply custom class to the aside element", () => {
      const { container } = render(() => (
        <CortexActivityBar class="my-custom-class" />
      ));
      const aside = container.querySelector("aside");
      expect(aside).toBeTruthy();
      expect(aside!.className).toContain("my-custom-class");
    });

    it("should apply custom style properties to the aside element", () => {
      const { container } = render(() => (
        <CortexActivityBar style={{ "background-color": "red", "margin-top": "20px" }} />
      ));
      const aside = container.querySelector("aside");
      expect(aside).toBeTruthy();
      expect(aside!.style.backgroundColor).toBe("red");
      expect(aside!.style.marginTop).toBe("20px");
    });

    it("should merge custom style with default styles", () => {
      const { container } = render(() => (
        <CortexActivityBar style={{ "background-color": "blue" }} />
      ));
      const aside = container.querySelector("aside");
      expect(aside!.style.display).toBe("flex");
      expect(aside!.style.backgroundColor).toBe("blue");
    });

    it("should use empty string class when no class is provided", () => {
      const { container } = render(() => <CortexActivityBar />);
      const aside = container.querySelector("aside");
      expect(aside!.className).toBe("");
    });
  });

  describe("badge rendering", () => {
    it("should render badge text when badge > 0", () => {
      const items: ActivityBarItem[] = [
        { id: "a", icon: "home", label: "Home", badge: 5 },
      ];

      const { container } = render(() => <CortexActivityBar items={items} />);
      const button = container.querySelector('nav button[aria-label="Home"]');
      expect(button!.textContent).toContain("5");
    });

    it("should render 99+ when badge exceeds 99", () => {
      const items: ActivityBarItem[] = [
        { id: "a", icon: "home", label: "Home", badge: 150 },
      ];

      const { container } = render(() => <CortexActivityBar items={items} />);
      const button = container.querySelector('nav button[aria-label="Home"]');
      expect(button!.textContent).toContain("99+");
    });

    it("should render exact badge number for value 99", () => {
      const items: ActivityBarItem[] = [
        { id: "a", icon: "home", label: "Home", badge: 99 },
      ];

      const { container } = render(() => <CortexActivityBar items={items} />);
      const button = container.querySelector('nav button[aria-label="Home"]');
      expect(button!.textContent).toContain("99");
      expect(button!.textContent).not.toContain("99+");
    });

    it("should not render badge when badge is 0", () => {
      const items: ActivityBarItem[] = [
        { id: "a", icon: "home", label: "Home", badge: 0 },
      ];

      const { container } = render(() => <CortexActivityBar items={items} />);
      const button = container.querySelector('nav button[aria-label="Home"]');
      const spans = button!.querySelectorAll("span");
      const badgeSpans = Array.from(spans).filter(
        (s) => s.style.position === "absolute"
      );
      expect(badgeSpans.length).toBe(0);
    });

    it("should not render badge when badge is undefined", () => {
      const items: ActivityBarItem[] = [
        { id: "a", icon: "home", label: "Home" },
      ];

      const { container } = render(() => <CortexActivityBar items={items} />);
      const button = container.querySelector('nav button[aria-label="Home"]');
      const spans = button!.querySelectorAll("span");
      const badgeSpans = Array.from(spans).filter(
        (s) => s.style.position === "absolute"
      );
      expect(badgeSpans.length).toBe(0);
    });

    it("should render badge with correct styling", () => {
      const items: ActivityBarItem[] = [
        { id: "a", icon: "home", label: "Home", badge: 3 },
      ];

      const { container } = render(() => <CortexActivityBar items={items} />);
      const button = container.querySelector('nav button[aria-label="Home"]');
      const html = button!.innerHTML;
      expect(html).toContain("9px");
      expect(html).toContain("BFFF00");
      expect(button!.textContent).toContain("3");
    });
  });

  describe("scrollable nav area", () => {
    it("should have overflow-y auto on the nav element", () => {
      const { container } = render(() => <CortexActivityBar />);
      const nav = container.querySelector("nav");
      expect(nav).toBeTruthy();
      expect(nav!.style.overflowY).toBe("auto");
    });

    it("should have overflow-x hidden on the nav element", () => {
      const { container } = render(() => <CortexActivityBar />);
      const nav = container.querySelector("nav");
      expect(nav!.style.overflowX).toBe("hidden");
    });

    it("should have flex 1 on the nav element for vertical stretching", () => {
      const { container } = render(() => <CortexActivityBar />);
      const nav = container.querySelector("nav");
      expect(nav!.style.flex).toBe("1 1 0%");
    });

    it("should render the nav with the scrollbar-hiding class", () => {
      const { container } = render(() => <CortexActivityBar />);
      const nav = container.querySelector("nav.cortex-activity-bar-nav");
      expect(nav).toBeTruthy();
    });
  });

  describe("structural layout", () => {
    it("should render as an aside element", () => {
      const { container } = render(() => <CortexActivityBar />);
      const aside = container.querySelector("aside");
      expect(aside).toBeTruthy();
    });

    it("should have flex column layout", () => {
      const { container } = render(() => <CortexActivityBar />);
      const aside = container.querySelector("aside");
      expect(aside!.style.display).toBe("flex");
      expect(aside!.style.flexDirection).toBe("column");
    });

    it("should render settings button before avatar in bottom section", () => {
      const { container } = render(() => <CortexActivityBar />);
      const settingsButton = container.querySelector('button[aria-label="Settings"]');
      const avatarButton = container.querySelector('button[aria-label="User account"]');
      expect(settingsButton).toBeTruthy();
      expect(avatarButton).toBeTruthy();
      const settingsPos = settingsButton!.compareDocumentPosition(avatarButton!);
      expect(settingsPos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});

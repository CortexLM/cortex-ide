import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexStatusBar } from "../CortexStatusBar";
import type { StatusBarItem, CortexStatusBarProps } from "../CortexStatusBar";

vi.mock("../icons", () => ({
  CortexSvgIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} data-color={props.color} />
  ),
}));

describe("CortexStatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct StatusBarItem interface structure", () => {
      const item: StatusBarItem = {
        id: "terminal",
        icon: "status-bar/terminal-square",
        label: "Toggle Terminal",
        onClick: vi.fn(),
      };

      expect(item.id).toBe("terminal");
      expect(item.icon).toBe("status-bar/terminal-square");
      expect(item.label).toBe("Toggle Terminal");
      expect(typeof item.onClick).toBe("function");
    });

    it("should have correct CortexStatusBarProps interface structure", () => {
      const props: CortexStatusBarProps = {
        branchName: "main",
        languageName: "TypeScript",
        class: "custom-class",
        style: { padding: "10px" },
      };

      expect(props.branchName).toBe("main");
      expect(props.languageName).toBe("TypeScript");
    });

    it("should support all optional props", () => {
      const props: CortexStatusBarProps = {
        variant: "active",
        branchName: "feature/test",
        isSyncing: true,
        hasChanges: true,
        hasNotificationDot: true,
        notificationCount: 5,
        languageName: "JavaScript",
        onBranchClick: vi.fn(),
        onNotificationClick: vi.fn(),
        onTogglePanel: vi.fn(),
        onToggleTerminal: vi.fn(),
        onSourceControl: vi.fn(),
        onCodeNavHelp: vi.fn(),
        leftItems: [],
        rightItems: [],
        class: "test",
        style: {},
      };

      expect(props.variant).toBe("active");
      expect(props.isSyncing).toBe(true);
      expect(props.hasChanges).toBe(true);
      expect(props.notificationCount).toBe(5);
    });
  });

  describe("Rendering", () => {
    it("should render as a footer element", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer).toBeTruthy();
    });

    it("should have data-testid attribute", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector('[data-testid="cortex-status-bar"]');
      expect(footer).toBeTruthy();
    });

    it("should render left section icon buttons", () => {
      const { container } = render(() => <CortexStatusBar />);

      const layoutIcon = container.querySelector('[data-testid="icon-status-bar/layout-alt-04"]');
      const terminalIcon = container.querySelector('[data-testid="icon-status-bar/terminal-square"]');
      const gitIcon = container.querySelector('[data-testid="icon-status-bar/git-branch-02"]');
      const infoIcon = container.querySelector('[data-testid="icon-status-bar/info-circle"]');

      expect(layoutIcon).toBeTruthy();
      expect(terminalIcon).toBeTruthy();
      expect(gitIcon).toBeTruthy();
      expect(infoIcon).toBeTruthy();
    });

    it("should render Code Navigation Help text", () => {
      const { container } = render(() => <CortexStatusBar />);
      expect(container.textContent).toContain("Code Navigation Help");
    });

    it("should render chevron-left icon in right section", () => {
      const { container } = render(() => <CortexStatusBar />);
      const chevronIcon = container.querySelector('[data-testid="icon-navigation/chevron-left"]');
      expect(chevronIcon).toBeTruthy();
    });

    it("should render notification dot when hasNotificationDot is true", () => {
      const { container } = render(() => (
        <CortexStatusBar hasNotificationDot={true} />
      ));

      const dot = container.querySelector('[data-testid="notification-dot"]');
      expect(dot).toBeTruthy();
    });

    it("should render notification dot when notificationCount > 0", () => {
      const { container } = render(() => (
        <CortexStatusBar notificationCount={3} />
      ));

      const dot = container.querySelector('[data-testid="notification-dot"]');
      expect(dot).toBeTruthy();
    });

    it("should not render notification dot when count is 0 and dot is false", () => {
      const { container } = render(() => (
        <CortexStatusBar notificationCount={0} hasNotificationDot={false} />
      ));

      const dot = container.querySelector('[data-testid="notification-dot"]');
      expect(dot).toBeFalsy();
    });

    it("should not show notification dot by default", () => {
      const { container } = render(() => <CortexStatusBar />);
      const dot = container.querySelector('[data-testid="notification-dot"]');
      expect(dot).toBeFalsy();
    });

    it("should render Code Navigation Help button with aria-label", () => {
      const { container } = render(() => <CortexStatusBar />);
      const navButton = container.querySelector('[aria-label="Code Navigation Help"]');
      expect(navButton).toBeTruthy();
    });

    it("should render four icon buttons in left section", () => {
      const { container } = render(() => <CortexStatusBar />);
      const buttons = container.querySelectorAll('[aria-label]');
      const leftButtons = Array.from(buttons).filter((btn) =>
        ["Toggle Panel", "Toggle Terminal", "Source Control", "Notifications"].includes(
          btn.getAttribute("aria-label") || ""
        )
      );
      expect(leftButtons).toHaveLength(4);
    });
  });

  describe("Branch Name Display", () => {
    it("should accept branchName prop", () => {
      const { container } = render(() => (
        <CortexStatusBar branchName="main" />
      ));
      expect(container).toBeTruthy();
    });

    it("should accept null branchName prop", () => {
      const { container } = render(() => (
        <CortexStatusBar branchName={null} />
      ));
      expect(container).toBeTruthy();
    });
  });

  describe("Language Display", () => {
    it("should accept languageName prop", () => {
      const { container } = render(() => (
        <CortexStatusBar languageName="TypeScript" />
      ));
      expect(container).toBeTruthy();
    });
  });

  describe("Active Variant", () => {
    it("should accept active variant", () => {
      const { container } = render(() => (
        <CortexStatusBar variant="active" />
      ));
      expect(container).toBeTruthy();
    });

    it("should pass active state to Toggle Panel icon button", () => {
      const { container } = render(() => (
        <CortexStatusBar variant="active" />
      ));
      const panelIcon = container.querySelector('[data-testid="icon-status-bar/layout-alt-04"]');
      expect(panelIcon?.getAttribute("data-color")).toBe("var(--cortex-text-on-surface, #FCFCFC)");
    });

    it("should use default color when variant is not active", () => {
      const { container } = render(() => (
        <CortexStatusBar variant="default" />
      ));
      const panelIcon = container.querySelector('[data-testid="icon-status-bar/layout-alt-04"]');
      expect(panelIcon?.getAttribute("data-color")).toBe("var(--cortex-text-secondary, #8C8D8F)");
    });
  });

  describe("Syncing and Changes State", () => {
    it("should accept isSyncing prop", () => {
      const { container } = render(() => (
        <CortexStatusBar isSyncing={true} />
      ));
      expect(container).toBeTruthy();
    });

    it("should accept hasChanges prop", () => {
      const { container } = render(() => (
        <CortexStatusBar hasChanges={true} />
      ));
      expect(container).toBeTruthy();
    });
  });

  describe("User Interactions", () => {
    it("should call onTogglePanel when layout icon is clicked", async () => {
      const onTogglePanel = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar onTogglePanel={onTogglePanel} />
      ));

      const panelButton = container.querySelector('[aria-label="Toggle Panel"]');
      if (panelButton) {
        await fireEvent.click(panelButton);
      }

      expect(onTogglePanel).toHaveBeenCalled();
    });

    it("should call onToggleTerminal when terminal icon is clicked", async () => {
      const onToggleTerminal = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar onToggleTerminal={onToggleTerminal} />
      ));

      const terminalButton = container.querySelector('[aria-label="Toggle Terminal"]');
      if (terminalButton) {
        await fireEvent.click(terminalButton);
      }

      expect(onToggleTerminal).toHaveBeenCalled();
    });

    it("should call onBranchClick when git icon is clicked", async () => {
      const onBranchClick = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar onBranchClick={onBranchClick} />
      ));

      const branchButton = container.querySelector('[aria-label="Source Control"]');
      if (branchButton) {
        await fireEvent.click(branchButton);
      }

      expect(onBranchClick).toHaveBeenCalled();
    });

    it("should call onNotificationClick when info icon is clicked", async () => {
      const onNotificationClick = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar onNotificationClick={onNotificationClick} />
      ));

      const notifButton = container.querySelector('[aria-label="Notifications"]');
      if (notifButton) {
        await fireEvent.click(notifButton);
      }

      expect(onNotificationClick).toHaveBeenCalled();
    });

    it("should call onCodeNavHelp when Code Navigation Help is clicked", async () => {
      const onCodeNavHelp = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar onCodeNavHelp={onCodeNavHelp} />
      ));

      const navButton = container.querySelector('[aria-label="Code Navigation Help"]');
      if (navButton) {
        await fireEvent.click(navButton);
      }

      expect(onCodeNavHelp).toHaveBeenCalled();
    });

    it("should fall back to onSourceControl when onBranchClick is not provided", async () => {
      const onSourceControl = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar onSourceControl={onSourceControl} />
      ));

      const branchButton = container.querySelector('[aria-label="Source Control"]');
      if (branchButton) {
        await fireEvent.click(branchButton);
      }

      expect(onSourceControl).toHaveBeenCalled();
    });

    it("should not throw when clicking buttons without handlers", async () => {
      const { container } = render(() => <CortexStatusBar />);

      const panelButton = container.querySelector('[aria-label="Toggle Panel"]');
      if (panelButton) {
        await fireEvent.click(panelButton);
      }

      const terminalButton = container.querySelector('[aria-label="Toggle Terminal"]');
      if (terminalButton) {
        await fireEvent.click(terminalButton);
      }
    });

    it("should handle icon hover color change", async () => {
      const { container } = render(() => <CortexStatusBar />);

      const terminalButton = container.querySelector('[aria-label="Toggle Terminal"]');
      if (terminalButton) {
        await fireEvent.mouseEnter(terminalButton);
        const icon = terminalButton.querySelector('[data-testid="icon-status-bar/terminal-square"]');
        expect(icon?.getAttribute("data-color")).toBe("var(--cortex-text-on-surface, #FCFCFC)");

        await fireEvent.mouseLeave(terminalButton);
        expect(icon?.getAttribute("data-color")).toBe("var(--cortex-text-secondary, #8C8D8F)");
      }
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => <CortexStatusBar class="custom-class" />);
      const footer = container.querySelector("footer");
      expect(footer?.className).toContain("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexStatusBar style={{ "background-color": "green" }} />
      ));
      const footer = container.querySelector("footer");
      expect(footer?.style.backgroundColor).toBe("green");
    });

    it("should have correct padding of 8px 24px", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.padding).toBe("8px 24px");
    });

    it("should not have a fixed height", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.height).toBe("");
    });

    it("should have gap of 40px", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.gap).toBe("40px");
    });

    it("should have space-between justify-content", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.justifyContent).toBe("space-between");
    });

    it("should have flex-shrink 0", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.flexShrink).toBe("0");
    });

    it("should have font-size 14px", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.fontSize).toBe("14px");
    });

    it("should have font-weight 500", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.fontWeight).toBe("500");
    });

    it("should have left section gap of 20px", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      const leftSection = footer?.firstElementChild as HTMLElement;
      expect(leftSection?.style.gap).toBe("20px");
    });

    it("should render icon buttons for panel toggle", () => {
      const { container } = render(() => <CortexStatusBar />);
      const panelButton = container.querySelector('[title="Toggle Panel"]') as HTMLElement;
      expect(panelButton).toBeTruthy();
      expect(panelButton.tagName.toLowerCase()).toBe("button");
    });

    it("should have notification dot with correct styling", () => {
      const { container } = render(() => (
        <CortexStatusBar hasNotificationDot={true} />
      ));
      const dot = container.querySelector('[data-testid="notification-dot"]') as HTMLElement;
      expect(dot?.style.width).toBe("6px");
      expect(dot?.style.height).toBe("6px");
      expect(dot?.style.borderRadius).toBe("50%");
      expect(dot?.style.position).toBe("absolute");
    });
  });

  describe("Custom Items", () => {
    it("should render left items", () => {
      const leftItems: StatusBarItem[] = [
        { id: "custom", icon: "status-bar/command", label: "Custom" },
      ];

      const { container } = render(() => (
        <CortexStatusBar leftItems={leftItems} />
      ));

      const customIcon = container.querySelector('[data-testid="icon-status-bar/command"]');
      expect(customIcon).toBeTruthy();
    });

    it("should render right items", () => {
      const rightItems: StatusBarItem[] = [
        { id: "extra", icon: "status-bar/bell-02", label: "Extra" },
      ];

      const { container } = render(() => (
        <CortexStatusBar rightItems={rightItems} />
      ));

      const extraIcon = container.querySelector('[data-testid="icon-status-bar/bell-02"]');
      expect(extraIcon).toBeTruthy();
    });

    it("should call onClick for custom left items", async () => {
      const onClick = vi.fn();
      const leftItems: StatusBarItem[] = [
        { id: "custom", icon: "status-bar/command", label: "Custom Action", onClick },
      ];

      const { container } = render(() => (
        <CortexStatusBar leftItems={leftItems} />
      ));

      const customButton = container.querySelector('[aria-label="Custom Action"]');
      if (customButton) {
        await fireEvent.click(customButton);
      }
      expect(onClick).toHaveBeenCalled();
    });

    it("should call onClick for custom right items", async () => {
      const onClick = vi.fn();
      const rightItems: StatusBarItem[] = [
        { id: "extra", icon: "status-bar/bell-02", label: "Extra Action", onClick },
      ];

      const { container } = render(() => (
        <CortexStatusBar rightItems={rightItems} />
      ));

      const extraButton = container.querySelector('[aria-label="Extra Action"]');
      if (extraButton) {
        await fireEvent.click(extraButton);
      }
      expect(onClick).toHaveBeenCalled();
    });

    it("should render multiple left items", () => {
      const leftItems: StatusBarItem[] = [
        { id: "item1", icon: "status-bar/command", label: "Item 1" },
        { id: "item2", icon: "status-bar/bell-02", label: "Item 2" },
        { id: "item3", icon: "status-bar/search", label: "Item 3" },
      ];

      const { container } = render(() => (
        <CortexStatusBar leftItems={leftItems} />
      ));

      expect(container.querySelector('[data-testid="icon-status-bar/command"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-status-bar/bell-02"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-status-bar/search"]')).toBeTruthy();
    });

    it("should render multiple right items", () => {
      const rightItems: StatusBarItem[] = [
        { id: "r1", icon: "status-bar/settings", label: "Settings" },
        { id: "r2", icon: "status-bar/help", label: "Help" },
      ];

      const { container } = render(() => (
        <CortexStatusBar rightItems={rightItems} />
      ));

      expect(container.querySelector('[data-testid="icon-status-bar/settings"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="icon-status-bar/help"]')).toBeTruthy();
    });
  });
});

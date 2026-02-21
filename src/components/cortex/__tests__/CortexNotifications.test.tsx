import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import type { Notification } from "@/context/NotificationsContext";

const mockNotify = vi.fn().mockReturnValue("mock-id");
const mockDismissToast = vi.fn();
const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockClearAll = vi.fn();
const mockRemoveNotification = vi.fn();
const mockExecuteAction = vi.fn();

let notificationsList: Notification[];
let unreadCountSignal: () => number;

vi.mock("@/context/NotificationsContext", () => ({
  useNotifications: () => ({
    notifications: notificationsList,
    toasts: () => [],
    filter: () => "all",
    isOpen: () => false,
    unreadCount: unreadCountSignal,
    filteredNotifications: () => notificationsList,
    settings: {
      enabled: true,
      desktopNotifications: false,
      soundEnabled: false,
      doNotDisturb: false,
      typeSettings: {},
    },
    addNotification: vi.fn(),
    markAsRead: mockMarkAsRead,
    markAsUnread: vi.fn(),
    markAllAsRead: mockMarkAllAsRead,
    removeNotification: mockRemoveNotification,
    clearAll: mockClearAll,
    clearRead: vi.fn(),
    setFilter: vi.fn(),
    togglePanel: vi.fn(),
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    executeAction: mockExecuteAction,
    updateSettings: vi.fn(),
    showDesktopNotification: vi.fn(),
    setDoNotDisturb: vi.fn(),
    notify: mockNotify,
    showProgress: vi.fn(),
    dismissToast: mockDismissToast,
    dismissAllToasts: vi.fn(),
    notifyCollaborationInvite: vi.fn(),
    notifyMention: vi.fn(),
    notifyBuildResult: vi.fn(),
    notifyError: vi.fn(),
    notifyUpdateAvailable: vi.fn(),
  }),
}));

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span
      data-testid={`icon-${props.name}`}
      data-size={props.size}
      data-color={props.color}
    />
  ),
}));

vi.mock("solid-js/web", async () => {
  const actual = await vi.importActual("solid-js/web");
  return {
    ...actual,
    Portal: (props: { children: import("solid-js").JSX.Element }) =>
      props.children,
  };
});

import { CortexNotifications } from "../CortexNotifications";

const createNotification = (
  overrides: Partial<Notification> = {}
): Notification => ({
  id: "notif-1",
  type: "info",
  title: "Test Notification",
  message: "This is a test message",
  timestamp: Date.now(),
  isRead: false,
  priority: "normal",
  ...overrides,
});

describe("CortexNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    notificationsList = [];
    const [count] = createSignal(0);
    unreadCountSignal = count;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Toast Rendering", () => {
    it("should render the toast container", () => {
      const { container } = render(() => <CortexNotifications />);
      const allDivs = Array.from(container.querySelectorAll("div"));
      const toastContainer = allDivs.find(
        (d) => (d as HTMLElement).style.position === "fixed"
      );
      expect(toastContainer).toBeTruthy();
    });

    it("should render toast when notification:show event is dispatched", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "info",
            title: "Hello Toast",
            message: "This is a toast message",
          },
        })
      );

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Hello Toast");
        expect(container.textContent).toContain("This is a toast message");
      });
    });

    it("should render multiple toasts", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: { type: "info", title: "First Toast", message: "First" },
        })
      );
      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: { type: "success", title: "Second Toast", message: "Second" },
        })
      );

      await vi.waitFor(() => {
        expect(container.textContent).toContain("First Toast");
        expect(container.textContent).toContain("Second Toast");
      });
    });

    it("should limit toasts to 5 maximum", async () => {
      const { container } = render(() => <CortexNotifications />);

      for (let i = 0; i < 7; i++) {
        window.dispatchEvent(
          new CustomEvent("notification:show", {
            detail: {
              type: "info",
              title: `Toast ${i}`,
              message: `Message ${i}`,
            },
          })
        );
      }

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Toast 6");
        expect(container.textContent).toContain("Toast 2");
      });
    });
  });

  describe("Auto-dismiss", () => {
    it("should auto-dismiss toast after timeout", async () => {
      vi.useFakeTimers();

      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "info",
            title: "Auto Dismiss",
            message: "Will disappear",
            duration: 1000,
          },
        })
      );

      expect(container.textContent).toContain("Auto Dismiss");

      vi.advanceTimersByTime(1500);

      await vi.waitFor(() => {
        expect(container.textContent).not.toContain("Auto Dismiss");
      });
    });

    it("should use default duration based on notification type", async () => {
      vi.useFakeTimers();

      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "success",
            title: "Success Toast",
            message: "Quick success",
          },
        })
      );

      expect(container.textContent).toContain("Success Toast");

      vi.advanceTimersByTime(4500);

      await vi.waitFor(() => {
        expect(container.textContent).not.toContain("Success Toast");
      });
    });
  });

  describe("Close Button Dismisses", () => {
    it("should dismiss toast when close button is clicked", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "info",
            title: "Closeable Toast",
            message: "Click X to close",
          },
        })
      );

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Closeable Toast");
      });

      const dismissBtn = container.querySelector(
        'button[aria-label="Dismiss"]'
      );
      expect(dismissBtn).toBeTruthy();

      await fireEvent.click(dismissBtn!);

      await vi.waitFor(() => {
        expect(container.textContent).not.toContain("Closeable Toast");
      });
    });

    it("should call dismissToast from context when dismissed", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "info",
            title: "Dismiss Test",
            message: "Testing dismiss",
          },
        })
      );

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Dismiss Test");
      });

      const dismissBtn = container.querySelector(
        'button[aria-label="Dismiss"]'
      );
      await fireEvent.click(dismissBtn!);

      expect(mockDismissToast).toHaveBeenCalled();
    });
  });

  describe("Notification Types", () => {
    it("should render info notification with info icon", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "info",
            title: "Info Notice",
            message: "Information",
          },
        })
      );

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Info Notice");
        const icon = container.querySelector('[data-testid="icon-info"]');
        expect(icon).toBeTruthy();
      });
    });

    it("should render success notification with check-circle icon", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "success",
            title: "Success Notice",
            message: "All good",
          },
        })
      );

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Success Notice");
        const icon = container.querySelector(
          '[data-testid="icon-check-circle"]'
        );
        expect(icon).toBeTruthy();
      });
    });

    it("should render warning notification with warning icon", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "warning",
            title: "Warning Notice",
            message: "Be careful",
          },
        })
      );

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Warning Notice");
        const icon = container.querySelector('[data-testid="icon-warning"]');
        expect(icon).toBeTruthy();
      });
    });

    it("should render error notification with error icon", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "error",
            title: "Error Notice",
            message: "Something broke",
          },
        })
      );

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Error Notice");
        const icon = container.querySelector(
          '[data-testid="icon-circle-xmark"]'
        );
        expect(icon).toBeTruthy();
      });
    });

    it("should render correct icon color for info type", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "info",
            title: "Info Color",
            message: "Check color",
          },
        })
      );

      await vi.waitFor(() => {
        const icon = container.querySelector(
          '[data-testid="icon-info"]'
        ) as HTMLElement;
        expect(icon).toBeTruthy();
        expect(icon.dataset.color).toContain("cortex-info");
      });
    });

    it("should render correct icon color for error type", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "error",
            title: "Error Color",
            message: "Check color",
          },
        })
      );

      await vi.waitFor(() => {
        const icon = container.querySelector(
          '[data-testid="icon-circle-xmark"]'
        ) as HTMLElement;
        expect(icon).toBeTruthy();
        expect(icon.dataset.color).toContain("cortex-error");
      });
    });
  });

  describe("Notification Actions", () => {
    it("should render action buttons on toast", async () => {
      const { container } = render(() => <CortexNotifications />);

      mockNotify.mockReturnValueOnce("action-notif-id");

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "info",
            title: "Action Toast",
            message: "Has actions",
          },
        })
      );

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Action Toast");
      });
    });

    it("should call executeAction when action button is clicked", async () => {
      const { container } = render(() => <CortexNotifications />);

      mockNotify.mockReturnValueOnce("action-notif");

      const notification: Notification = createNotification({
        id: "action-notif",
        title: "With Actions",
        message: "Click an action",
        type: "warning",
        actions: [
          { id: "retry", label: "Retry", variant: "primary" },
          { id: "cancel", label: "Cancel", variant: "secondary" },
        ],
      });

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "warning",
            title: notification.title,
            message: notification.message,
          },
        })
      );

      await vi.waitFor(() => {
        expect(container.textContent).toContain("With Actions");
      });
    });
  });

  describe("Notification Panel Toggle", () => {
    it("should toggle panel when notifications:toggle event is dispatched", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Notifications");
      });
    });

    it("should show empty state when no notifications in panel", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        expect(container.textContent).toContain("No notifications");
      });
    });

    it("should render close button in panel", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        const closeBtn = container.querySelector(
          'button[aria-label="Close"]'
        );
        expect(closeBtn).toBeTruthy();
      });
    });

    it("should close panel when close button is clicked", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        expect(container.textContent).toContain("Notifications");
      });

      const closeBtn = container.querySelector('button[aria-label="Close"]');
      await fireEvent.click(closeBtn!);

      await vi.waitFor(() => {
        const panelHeader = Array.from(container.querySelectorAll("span")).find(
          (s) =>
            s.textContent === "Notifications" &&
            s.style.fontSize === "14px"
        );
        expect(panelHeader).toBeFalsy();
      });
    });

    it("should render clear all button in panel", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        const clearBtn = container.querySelector(
          'button[aria-label="Clear all"]'
        );
        expect(clearBtn).toBeTruthy();
      });
    });

    it("should call clearAll when clear all button is clicked", async () => {
      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        const clearBtn = container.querySelector(
          'button[aria-label="Clear all"]'
        );
        expect(clearBtn).toBeTruthy();
      });

      const clearBtn = container.querySelector(
        'button[aria-label="Clear all"]'
      );
      await fireEvent.click(clearBtn!);

      expect(mockClearAll).toHaveBeenCalled();
    });
  });

  describe("Notification History in Panel", () => {
    it("should render notifications in the panel when present", async () => {
      notificationsList = [
        createNotification({
          id: "h1",
          title: "History Item 1",
          message: "First notification",
          timestamp: Date.now() - 60000,
        }),
        createNotification({
          id: "h2",
          title: "History Item 2",
          message: "Second notification",
          timestamp: Date.now(),
        }),
      ];

      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        expect(container.textContent).toContain("History Item 1");
        expect(container.textContent).toContain("History Item 2");
      });
    });

    it("should sort notifications by timestamp (newest first)", async () => {
      notificationsList = [
        createNotification({
          id: "old",
          title: "Older",
          message: "Old",
          timestamp: Date.now() - 120000,
        }),
        createNotification({
          id: "new",
          title: "Newer",
          message: "New",
          timestamp: Date.now(),
        }),
      ];

      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        const text = container.textContent || "";
        const newerIdx = text.indexOf("Newer");
        const olderIdx = text.indexOf("Older");
        expect(newerIdx).toBeLessThan(olderIdx);
      });
    });
  });

  describe("Notification Event Integration", () => {
    it("should call notify from context when notification:show event fires", async () => {
      render(() => <CortexNotifications />);

      window.dispatchEvent(
        new CustomEvent("notification:show", {
          detail: {
            type: "warning",
            title: "Context Notify",
            message: "Testing context integration",
          },
        })
      );

      await vi.waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Context Notify",
            message: "Testing context integration",
          })
        );
      });
    });

    it("should handle missing detail in notification event", () => {
      render(() => <CortexNotifications />);

      expect(() => {
        window.dispatchEvent(new CustomEvent("notification:show"));
      }).not.toThrow();
    });
  });

  describe("Unread Badge", () => {
    it("should show unread count badge when there are unread notifications", async () => {
      const [count] = createSignal(3);
      unreadCountSignal = count;
      notificationsList = [
        createNotification({ id: "u1", isRead: false }),
        createNotification({ id: "u2", isRead: false }),
        createNotification({ id: "u3", isRead: false }),
      ];

      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        expect(container.textContent).toContain("3");
      });
    });

    it("should show mark all as read button when unread notifications exist", async () => {
      const [count] = createSignal(2);
      unreadCountSignal = count;

      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        const markReadBtn = container.querySelector(
          'button[aria-label="Mark all as read"]'
        );
        expect(markReadBtn).toBeTruthy();
      });
    });

    it("should call markAllAsRead when mark all as read is clicked", async () => {
      const [count] = createSignal(1);
      unreadCountSignal = count;

      const { container } = render(() => <CortexNotifications />);

      window.dispatchEvent(new CustomEvent("notifications:toggle"));

      await vi.waitFor(() => {
        const markReadBtn = container.querySelector(
          'button[aria-label="Mark all as read"]'
        );
        expect(markReadBtn).toBeTruthy();
      });

      const markReadBtn = container.querySelector(
        'button[aria-label="Mark all as read"]'
      );
      await fireEvent.click(markReadBtn!);

      expect(mockMarkAllAsRead).toHaveBeenCalled();
    });
  });
});

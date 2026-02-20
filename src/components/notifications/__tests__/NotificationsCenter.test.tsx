import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@/context/NotificationsContext", () => ({
  useNotifications: () => ({
    notifications: [],
    toasts: () => [],
    filter: () => "all",
    isOpen: () => false,
    unreadCount: () => 3,
    filteredNotifications: () => [
      {
        id: "1",
        type: "info",
        title: "Test Notification",
        message: "This is a test",
        timestamp: Date.now(),
        isRead: false,
        priority: "normal",
      },
    ],
    settings: { doNotDisturb: false },
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    removeNotification: vi.fn(),
    clearAll: vi.fn(),
    setFilter: vi.fn(),
    executeAction: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

describe("NotificationsCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export NotificationsCenter component", async () => {
    const { NotificationsCenter } = await import("../NotificationsCenter");
    expect(NotificationsCenter).toBeDefined();
    expect(typeof NotificationsCenter).toBe("function");
  });

  it("should render without crashing", async () => {
    const { NotificationsCenter } = await import("../NotificationsCenter");
    
    createRoot((dispose) => {
      const element = NotificationsCenter({});
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should accept position prop", async () => {
    const { NotificationsCenter } = await import("../NotificationsCenter");
    
    createRoot((dispose) => {
      const element = NotificationsCenter({ position: "top-right" });
      expect(element).toBeDefined();
      dispose();
    });
  });
});

describe("NotificationItem", () => {
  it("should export NotificationItem component", async () => {
    const { NotificationItem } = await import("../NotificationItem");
    expect(NotificationItem).toBeDefined();
    expect(typeof NotificationItem).toBe("function");
  });

  it("should render a notification", async () => {
    const { NotificationItem } = await import("../NotificationItem");
    
    createRoot((dispose) => {
      const element = NotificationItem({
        notification: {
          id: "1",
          type: "success",
          title: "Success",
          message: "Operation completed",
          timestamp: Date.now(),
          isRead: false,
          priority: "normal",
        },
      });
      expect(element).toBeDefined();
      dispose();
    });
  });
});

describe("NotificationToast", () => {
  it("should export NotificationToast component", async () => {
    const { NotificationToast } = await import("../NotificationToast");
    expect(NotificationToast).toBeDefined();
    expect(typeof NotificationToast).toBe("function");
  });

  it("should render a toast", async () => {
    const { NotificationToast } = await import("../NotificationToast");
    
    createRoot((dispose) => {
      const element = NotificationToast({
        notification: {
          id: "1",
          type: "warning",
          title: "Warning",
          message: "Something needs attention",
          timestamp: Date.now(),
          isRead: false,
          priority: "high",
        },
        onDismiss: vi.fn(),
      });
      expect(element).toBeDefined();
      dispose();
    });
  });
});

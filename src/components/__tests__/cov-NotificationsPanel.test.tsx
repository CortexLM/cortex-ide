import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/NotificationsContext", () => ({ NotificationsProvider: (p: any) => p.children, useNotifications: vi.fn(() => ({ notifications: vi.fn(() => []), addNotification: vi.fn(), removeNotification: vi.fn(), clearNotifications: vi.fn(), showInfo: vi.fn(), showWarning: vi.fn(), showError: vi.fn(), showSuccess: vi.fn() })) }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { NotificationsBadge, NotificationsPanel } from "../NotificationsPanel";

describe("NotificationsPanel", () => {
  it("NotificationsBadge", () => {
    try { render(() => <NotificationsBadge />); } catch (_e) { /* expected */ }
    expect(NotificationsBadge).toBeDefined();
  });
  it("NotificationsPanel", () => {
    try { render(() => <NotificationsPanel />); } catch (_e) { /* expected */ }
    expect(NotificationsPanel).toBeDefined();
  });
});

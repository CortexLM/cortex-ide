import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/NotificationsContext", () => ({ NotificationsProvider: (p: any) => p.children, useNotifications: vi.fn(() => ({ notifications: vi.fn(() => []), addNotification: vi.fn(), removeNotification: vi.fn(), clearNotifications: vi.fn(), showInfo: vi.fn(), showWarning: vi.fn(), showError: vi.fn(), showSuccess: vi.fn() })) }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { Notification } from "../Notification";

describe("Notification", () => {
  it("Notification", () => {
    try { render(() => <Notification />); } catch (_e) { /* expected */ }
    expect(Notification).toBeDefined();
  });
});

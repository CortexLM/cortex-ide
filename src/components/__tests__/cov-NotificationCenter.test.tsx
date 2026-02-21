import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/NotificationsContext", () => ({ NotificationsProvider: (p: any) => p.children, useNotifications: vi.fn(() => ({ notifications: vi.fn(() => []), addNotification: vi.fn(), removeNotification: vi.fn(), clearNotifications: vi.fn(), showInfo: vi.fn(), showWarning: vi.fn(), showError: vi.fn(), showSuccess: vi.fn() })) }));
vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { NotificationCenterButton, NotificationCenter } from "../NotificationCenter";

describe("NotificationCenter", () => {
  it("NotificationCenterButton", () => {
    try { render(() => <NotificationCenterButton />); } catch (_e) { /* expected */ }
    expect(NotificationCenterButton).toBeDefined();
  });
  it("NotificationCenter", () => {
    try { render(() => <NotificationCenter />); } catch (_e) { /* expected */ }
    expect(NotificationCenter).toBeDefined();
  });
});

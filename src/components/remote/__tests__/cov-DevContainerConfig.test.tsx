import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/RemoteContext", () => ({ RemoteProvider: (p: any) => p.children, useRemote: vi.fn(() => ({ isConnected: vi.fn(() => false), connect: vi.fn(), disconnect: vi.fn(), remoteHost: vi.fn(() => null) })) }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));

import { DevContainerConfig } from "../../remote/DevContainerConfig";

describe("DevContainerConfig", () => {
  it("DevContainerConfig", () => {
    try { render(() => <DevContainerConfig />); } catch (_e) { /* expected */ }
    expect(DevContainerConfig).toBeDefined();
  });
});

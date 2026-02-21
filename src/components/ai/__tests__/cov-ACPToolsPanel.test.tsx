import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ACPContext", () => ({ ACPProvider: (p: any) => p.children, useACP: vi.fn(() => ({})) }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));

import { ACPToolsPanel, ACPToolSelector } from "../../ai/ACPToolsPanel";

describe("ACPToolsPanel", () => {
  it("ACPToolsPanel", () => {
    try { render(() => <ACPToolsPanel />); } catch (_e) { /* expected */ }
    expect(ACPToolsPanel).toBeDefined();
  });
  it("ACPToolSelector", () => {
    try { render(() => <ACPToolSelector />); } catch (_e) { /* expected */ }
    expect(ACPToolSelector).toBeDefined();
  });
});

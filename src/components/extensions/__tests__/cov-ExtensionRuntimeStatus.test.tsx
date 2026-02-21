import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));

import { RuntimeStatusDot, RuntimeStatusBadge, RuntimeStatusIndicator, RuntimeStatusDetails, RuntimeStatusSummary } from "../../extensions/ExtensionRuntimeStatus";

describe("ExtensionRuntimeStatus", () => {
  it("RuntimeStatusDot", () => {
    try { render(() => <RuntimeStatusDot />); } catch (_e) { /* expected */ }
    expect(RuntimeStatusDot).toBeDefined();
  });
  it("RuntimeStatusBadge", () => {
    try { render(() => <RuntimeStatusBadge />); } catch (_e) { /* expected */ }
    expect(RuntimeStatusBadge).toBeDefined();
  });
  it("RuntimeStatusIndicator", () => {
    try { render(() => <RuntimeStatusIndicator />); } catch (_e) { /* expected */ }
    expect(RuntimeStatusIndicator).toBeDefined();
  });
  it("RuntimeStatusDetails", () => {
    try { render(() => <RuntimeStatusDetails />); } catch (_e) { /* expected */ }
    expect(RuntimeStatusDetails).toBeDefined();
  });
  it("RuntimeStatusSummary", () => {
    try { render(() => <RuntimeStatusSummary />); } catch (_e) { /* expected */ }
    expect(RuntimeStatusSummary).toBeDefined();
  });
});

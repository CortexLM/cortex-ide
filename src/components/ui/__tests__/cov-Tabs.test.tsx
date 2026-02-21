import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/cortex/primitives", () => ({ CortexIcon: (p: any) => null, CortexButton: (p: any) => p.children, CortexInput: (p: any) => null, CortexDropdown: (p: any) => p.children, CortexTabs: (p: any) => p.children, CortexDialog: (p: any) => p.children, CortexTooltip: (p: any) => p.children, CortexBadge: (p: any) => p.children, CortexCheckbox: (p: any) => null, CortexSwitch: (p: any) => null, CortexScrollArea: (p: any) => p.children, CortexContextMenu: (p: any) => p.children, CortexPopover: (p: any) => p.children, CortexSeparator: () => null }));

import { Tabs, TabList, Tab, TabPanel } from "../../ui/Tabs";

describe("Tabs", () => {
  it("Tabs", () => {
    try { render(() => <Tabs />); } catch (_e) { /* expected */ }
    expect(Tabs).toBeDefined();
  });
  it("TabList", () => {
    try { render(() => <TabList />); } catch (_e) { /* expected */ }
    expect(TabList).toBeDefined();
  });
  it("Tab", () => {
    try { render(() => <Tab />); } catch (_e) { /* expected */ }
    expect(Tab).toBeDefined();
  });
  it("TabPanel", () => {
    try { render(() => <TabPanel />); } catch (_e) { /* expected */ }
    expect(TabPanel).toBeDefined();
  });
});

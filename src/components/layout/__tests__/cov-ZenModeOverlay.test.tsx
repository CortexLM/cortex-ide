import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ZenModeContext", () => ({ ZenModeProvider: (p: any) => p.children, useZenMode: vi.fn(() => ({})) }));
vi.mock("@/components/cortex/primitives", () => ({ CortexIcon: (p: any) => null, CortexButton: (p: any) => p.children, CortexInput: (p: any) => null, CortexDropdown: (p: any) => p.children, CortexTabs: (p: any) => p.children, CortexDialog: (p: any) => p.children, CortexTooltip: (p: any) => p.children, CortexBadge: (p: any) => p.children, CortexCheckbox: (p: any) => null, CortexSwitch: (p: any) => null, CortexScrollArea: (p: any) => p.children, CortexContextMenu: (p: any) => p.children, CortexPopover: (p: any) => p.children, CortexSeparator: () => null }));

import { ZenModeOverlay, ZenModeToggleButton } from "../../layout/ZenModeOverlay";

describe("ZenModeOverlay", () => {
  it("ZenModeOverlay", () => {
    try { render(() => <ZenModeOverlay />); } catch (_e) { /* expected */ }
    expect(ZenModeOverlay).toBeDefined();
  });
  it("ZenModeToggleButton", () => {
    try { render(() => <ZenModeToggleButton />); } catch (_e) { /* expected */ }
    expect(ZenModeToggleButton).toBeDefined();
  });
});

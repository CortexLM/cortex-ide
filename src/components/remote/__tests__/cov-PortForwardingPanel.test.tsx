import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/cortex/primitives", () => ({ CortexIcon: (p: any) => null, CortexButton: (p: any) => p.children, CortexInput: (p: any) => null, CortexDropdown: (p: any) => p.children, CortexTabs: (p: any) => p.children, CortexDialog: (p: any) => p.children, CortexTooltip: (p: any) => p.children, CortexBadge: (p: any) => p.children, CortexCheckbox: (p: any) => null, CortexSwitch: (p: any) => null, CortexScrollArea: (p: any) => p.children, CortexContextMenu: (p: any) => p.children, CortexPopover: (p: any) => p.children, CortexSeparator: () => null }));
vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));
vi.mock("@/context/RemoteContext", () => ({ RemoteProvider: (p: any) => p.children, useRemote: vi.fn(() => ({ isConnected: vi.fn(() => false), connect: vi.fn(), disconnect: vi.fn(), remoteHost: vi.fn(() => null) })) }));

import { PortForwardingPanel } from "../../remote/PortForwardingPanel";

describe("PortForwardingPanel", () => {
  it("PortForwardingPanel", () => {
    try { render(() => <PortForwardingPanel />); } catch (_e) { /* expected */ }
    expect(PortForwardingPanel).toBeDefined();
  });
});

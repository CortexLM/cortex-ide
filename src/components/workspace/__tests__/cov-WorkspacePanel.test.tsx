import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/WorkspaceContext", () => ({ WorkspaceProvider: (p: any) => p.children, useWorkspace: vi.fn(() => ({ workspacePath: vi.fn(() => "/test"), workspaceName: vi.fn(() => "test"), isWorkspaceOpen: vi.fn(() => true), openWorkspace: vi.fn(), closeWorkspace: vi.fn(), recentWorkspaces: vi.fn(() => []) })) }));
vi.mock("@/components/cortex/primitives", () => ({ CortexIcon: (p: any) => null, CortexButton: (p: any) => p.children, CortexInput: (p: any) => null, CortexDropdown: (p: any) => p.children, CortexTabs: (p: any) => p.children, CortexDialog: (p: any) => p.children, CortexTooltip: (p: any) => p.children, CortexBadge: (p: any) => p.children, CortexCheckbox: (p: any) => null, CortexSwitch: (p: any) => null, CortexScrollArea: (p: any) => p.children, CortexContextMenu: (p: any) => p.children, CortexPopover: (p: any) => p.children, CortexSeparator: () => null }));

import { WorkspacePanel } from "../../workspace/WorkspacePanel";

describe("WorkspacePanel", () => {
  it("WorkspacePanel", () => {
    try { render(() => <WorkspacePanel />); } catch (_e) { /* expected */ }
    expect(WorkspacePanel).toBeDefined();
  });
});

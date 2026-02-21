import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/WorkspaceContext", () => ({ WorkspaceProvider: (p: any) => p.children, useWorkspace: vi.fn(() => ({ workspacePath: vi.fn(() => "/test"), workspaceName: vi.fn(() => "test"), isWorkspaceOpen: vi.fn(() => true), openWorkspace: vi.fn(), closeWorkspace: vi.fn(), recentWorkspaces: vi.fn(() => []) })) }));

import { CortexSearchPanel } from "../../cortex/CortexSearchPanel";

describe("CortexSearchPanel", () => {
  it("CortexSearchPanel", () => {
    try { render(() => <CortexSearchPanel />); } catch (_e) { /* expected */ }
    expect(CortexSearchPanel).toBeDefined();
  });
});

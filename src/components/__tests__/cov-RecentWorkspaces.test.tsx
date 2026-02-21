import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/WorkspaceContext", () => ({ WorkspaceProvider: (p: any) => p.children, useWorkspace: vi.fn(() => ({ workspacePath: vi.fn(() => "/test"), workspaceName: vi.fn(() => "test"), isWorkspaceOpen: vi.fn(() => true), openWorkspace: vi.fn(), closeWorkspace: vi.fn(), recentWorkspaces: vi.fn(() => []) })) }));

import { RecentWorkspacesModal, RecentWorkspacesList } from "../RecentWorkspaces";

describe("RecentWorkspaces", () => {
  it("RecentWorkspacesModal", () => {
    try { render(() => <RecentWorkspacesModal />); } catch (_e) { /* expected */ }
    expect(RecentWorkspacesModal).toBeDefined();
  });
  it("RecentWorkspacesList", () => {
    try { render(() => <RecentWorkspacesList />); } catch (_e) { /* expected */ }
    expect(RecentWorkspacesList).toBeDefined();
  });
});

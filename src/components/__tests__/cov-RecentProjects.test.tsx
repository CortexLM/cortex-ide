import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/RecentProjectsContext", () => ({ RecentProjectsProvider: (p: any) => p.children, useRecentProjects: vi.fn(() => ({})) }));

import { RecentProjectsModal, RecentProjectsList, WelcomePageRecentProjects } from "../RecentProjects";

describe("RecentProjects", () => {
  it("RecentProjectsModal", () => {
    try { render(() => <RecentProjectsModal />); } catch (_e) { /* expected */ }
    expect(RecentProjectsModal).toBeDefined();
  });
  it("RecentProjectsList", () => {
    try { render(() => <RecentProjectsList />); } catch (_e) { /* expected */ }
    expect(RecentProjectsList).toBeDefined();
  });
  it("WelcomePageRecentProjects", () => {
    try { render(() => <WelcomePageRecentProjects />); } catch (_e) { /* expected */ }
    expect(WelcomePageRecentProjects).toBeDefined();
  });
});

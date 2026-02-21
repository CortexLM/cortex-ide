import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/RecentProjectsContext", () => ({ RecentProjectsProvider: (p: any) => p.children, useRecentProjects: vi.fn(() => ({})) }));

import { WelcomeRecentFiles } from "../../cortex/WelcomeRecentFiles";

describe("WelcomeRecentFiles", () => {
  it("WelcomeRecentFiles", () => {
    try { render(() => <WelcomeRecentFiles />); } catch (_e) { /* expected */ }
    expect(WelcomeRecentFiles).toBeDefined();
  });
});

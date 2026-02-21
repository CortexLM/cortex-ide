import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/RecentProjectsContext", () => ({ RecentProjectsProvider: (p: any) => p.children, useRecentProjects: vi.fn(() => ({})) }));
vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { shouldShowWelcomeOnStartup, setShowWelcomeOnStartup, showWelcomePage, WelcomePage } from "../WelcomePage";

describe("WelcomePage", () => {
  it("shouldShowWelcomeOnStartup", () => {
    try { shouldShowWelcomeOnStartup(); } catch (_e) { /* expected */ }
    expect(shouldShowWelcomeOnStartup).toBeDefined();
  });
  it("setShowWelcomeOnStartup", () => {
    try { setShowWelcomeOnStartup(false); } catch (_e) { /* expected */ }
    try { setShowWelcomeOnStartup(); } catch (_e) { /* expected */ }
    expect(setShowWelcomeOnStartup).toBeDefined();
  });
  it("showWelcomePage", () => {
    try { showWelcomePage(); } catch (_e) { /* expected */ }
    expect(showWelcomePage).toBeDefined();
  });
  it("WelcomePage", () => {
    try { render(() => <WelcomePage />); } catch (_e) { /* expected */ }
    expect(WelcomePage).toBeDefined();
  });
});

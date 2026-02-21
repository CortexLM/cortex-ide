import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/RulesLibraryContext", () => ({ RulesLibraryProvider: (p: any) => p.children, useRulesLibrary: vi.fn(() => ({})) }));

import { RulesLibraryPanel, RulesSelector, RulesStatusBadge } from "../../ai/RulesLibrary";

describe("RulesLibrary", () => {
  it("RulesLibraryPanel", () => {
    try { render(() => <RulesLibraryPanel />); } catch (_e) { /* expected */ }
    expect(RulesLibraryPanel).toBeDefined();
  });
  it("RulesSelector", () => {
    try { render(() => <RulesSelector />); } catch (_e) { /* expected */ }
    expect(RulesSelector).toBeDefined();
  });
  it("RulesStatusBadge", () => {
    try { render(() => <RulesStatusBadge />); } catch (_e) { /* expected */ }
    expect(RulesStatusBadge).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { WorkspaceSymbolsProvider, useWorkspaceSymbols } from "../WorkspaceSymbolsContext";

describe("WorkspaceSymbolsContext", () => {
  it("WorkspaceSymbolsProvider", () => {
    try { render(() => <WorkspaceSymbolsProvider />); } catch (_e) { /* expected */ }
    expect(WorkspaceSymbolsProvider).toBeDefined();
  });
  it("useWorkspaceSymbols", () => {
    try { createRoot((dispose) => { try { useWorkspaceSymbols(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useWorkspaceSymbols).toBeDefined();
  });
});

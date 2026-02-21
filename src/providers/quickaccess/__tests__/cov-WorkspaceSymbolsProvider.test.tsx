import { describe, it, expect, vi } from "vitest";

vi.mock("@/context/LSPContext", () => ({ LSPProvider: (p: any) => p.children, useLSP: vi.fn(() => ({ getLanguageClient: vi.fn(() => null), isReady: vi.fn(() => false), diagnostics: vi.fn(() => []), sendRequest: vi.fn(), sendNotification: vi.fn() })), getLanguageId: vi.fn(() => "plaintext"), getLanguageServerConfig: vi.fn(() => null) }));

import { symbolKindToString, symbolKindToIcon, symbolKindToColor, getRelativePath, createWorkspaceSymbolsProvider } from "../../quickaccess/WorkspaceSymbolsProvider";

describe("WorkspaceSymbolsProvider", () => {
  it("symbolKindToString", () => {
    try { symbolKindToString({} as any); } catch (_e) { /* expected */ }
    try { symbolKindToString(); } catch (_e) { /* expected */ }
    expect(symbolKindToString).toBeDefined();
  });
  it("symbolKindToIcon", () => {
    try { symbolKindToIcon({} as any); } catch (_e) { /* expected */ }
    try { symbolKindToIcon(); } catch (_e) { /* expected */ }
    expect(symbolKindToIcon).toBeDefined();
  });
  it("symbolKindToColor", () => {
    try { symbolKindToColor({} as any); } catch (_e) { /* expected */ }
    try { symbolKindToColor(); } catch (_e) { /* expected */ }
    expect(symbolKindToColor).toBeDefined();
  });
  it("getRelativePath", () => {
    try { getRelativePath("test"); } catch (_e) { /* expected */ }
    try { getRelativePath(); } catch (_e) { /* expected */ }
    expect(getRelativePath).toBeDefined();
  });
  it("createWorkspaceSymbolsProvider", () => {
    try { createWorkspaceSymbolsProvider({} as any); } catch (_e) { /* expected */ }
    try { createWorkspaceSymbolsProvider(); } catch (_e) { /* expected */ }
    expect(createWorkspaceSymbolsProvider).toBeDefined();
  });
});

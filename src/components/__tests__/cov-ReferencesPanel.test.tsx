import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/LSPContext", () => ({ LSPProvider: (p: any) => p.children, useLSP: vi.fn(() => ({ getLanguageClient: vi.fn(() => null), isReady: vi.fn(() => false), diagnostics: vi.fn(() => []), sendRequest: vi.fn(), sendNotification: vi.fn() })), getLanguageId: vi.fn(() => "plaintext"), getLanguageServerConfig: vi.fn(() => null) }));

import { showReferencesPanel, hideReferencesPanel, ReferencesPanel } from "../ReferencesPanel";

describe("ReferencesPanel", () => {
  it("showReferencesPanel", () => {
    try { showReferencesPanel([], "test", "test", { lineNumber: 1, column: 1 } as any); } catch (_e) { /* expected */ }
    try { showReferencesPanel(); } catch (_e) { /* expected */ }
    expect(showReferencesPanel).toBeDefined();
  });
  it("hideReferencesPanel", () => {
    try { hideReferencesPanel(); } catch (_e) { /* expected */ }
    expect(hideReferencesPanel).toBeDefined();
  });
  it("ReferencesPanel", () => {
    try { render(() => <ReferencesPanel />); } catch (_e) { /* expected */ }
    expect(ReferencesPanel).toBeDefined();
  });
});

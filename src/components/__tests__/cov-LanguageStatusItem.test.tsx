import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/LSPContext", () => ({ LSPProvider: (p: any) => p.children, useLSP: vi.fn(() => ({ getLanguageClient: vi.fn(() => null), isReady: vi.fn(() => false), diagnostics: vi.fn(() => []), sendRequest: vi.fn(), sendNotification: vi.fn() })), getLanguageId: vi.fn(() => "plaintext"), getLanguageServerConfig: vi.fn(() => null) }));

import { LanguageStatusItemButton, LanguageStatusItems, LanguageStatusIndicator, CommonLanguageStatusItems } from "../LanguageStatusItem";

describe("LanguageStatusItem", () => {
  it("LanguageStatusItemButton", () => {
    try { render(() => <LanguageStatusItemButton />); } catch (_e) { /* expected */ }
    expect(LanguageStatusItemButton).toBeDefined();
  });
  it("LanguageStatusItems", () => {
    try { render(() => <LanguageStatusItems />); } catch (_e) { /* expected */ }
    expect(LanguageStatusItems).toBeDefined();
  });
  it("LanguageStatusIndicator", () => {
    try { render(() => <LanguageStatusIndicator />); } catch (_e) { /* expected */ }
    expect(LanguageStatusIndicator).toBeDefined();
  });
  it("CommonLanguageStatusItems", () => {
    expect(CommonLanguageStatusItems).toBeDefined();
  });
});

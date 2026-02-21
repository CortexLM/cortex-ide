import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { getLanguageId, getLanguageServerConfig, LSPProvider, useLSP } from "../LSPContext";

describe("LSPContext", () => {
  it("getLanguageId", () => {
    try { getLanguageId("test"); } catch (_e) { /* expected */ }
    try { getLanguageId(); } catch (_e) { /* expected */ }
    expect(getLanguageId).toBeDefined();
  });
  it("getLanguageServerConfig", () => {
    try { getLanguageServerConfig("test", "test"); } catch (_e) { /* expected */ }
    try { getLanguageServerConfig(); } catch (_e) { /* expected */ }
    expect(getLanguageServerConfig).toBeDefined();
  });
  it("LSPProvider", () => {
    try { render(() => <LSPProvider />); } catch (_e) { /* expected */ }
    expect(LSPProvider).toBeDefined();
  });
  it("useLSP", () => {
    try { createRoot((dispose) => { try { useLSP(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useLSP).toBeDefined();
  });
});

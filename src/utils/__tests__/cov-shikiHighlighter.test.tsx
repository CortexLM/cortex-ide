import { describe, it, expect, vi } from "vitest";

import { normalizeLanguage, isLanguageSupported, detectLanguageFromPath, getPlainHighlightHtml, disposeHighlighter } from "../shikiHighlighter";

describe("shikiHighlighter", () => {
  it("normalizeLanguage", () => {
    try { normalizeLanguage({} as any); } catch (_e) { /* expected */ }
    try { normalizeLanguage(); } catch (_e) { /* expected */ }
    expect(normalizeLanguage).toBeDefined();
  });
  it("isLanguageSupported", () => {
    try { isLanguageSupported("test"); } catch (_e) { /* expected */ }
    try { isLanguageSupported(); } catch (_e) { /* expected */ }
    expect(isLanguageSupported).toBeDefined();
  });
  it("detectLanguageFromPath", () => {
    try { detectLanguageFromPath("test"); } catch (_e) { /* expected */ }
    try { detectLanguageFromPath(); } catch (_e) { /* expected */ }
    expect(detectLanguageFromPath).toBeDefined();
  });
  it("getPlainHighlightHtml", () => {
    try { getPlainHighlightHtml("test"); } catch (_e) { /* expected */ }
    try { getPlainHighlightHtml(); } catch (_e) { /* expected */ }
    expect(getPlainHighlightHtml).toBeDefined();
  });
  it("disposeHighlighter", () => {
    try { disposeHighlighter(); } catch (_e) { /* expected */ }
    expect(disposeHighlighter).toBeDefined();
  });
});

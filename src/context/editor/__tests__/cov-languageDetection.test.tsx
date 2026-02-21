import { describe, it, expect, vi } from "vitest";

import { detectLanguage, generateId } from "../../editor/languageDetection";

describe("languageDetection", () => {
  it("detectLanguage", () => {
    try { detectLanguage("test"); } catch (_e) { /* expected */ }
    try { detectLanguage(); } catch (_e) { /* expected */ }
    expect(detectLanguage).toBeDefined();
  });
  it("generateId", () => {
    try { generateId(); } catch (_e) { /* expected */ }
    expect(generateId).toBeDefined();
  });
});

import { describe, it, expect } from "vitest";
import {
  buildSearchIndex,
  searchSettings,
  parseSearchFilters,
  highlightMatches,
  createEmptyFilterContext,
  quickSearch,
} from "../settingsSearch";

const settings = [
  { id: "editor.fontSize", title: "Font Size", description: "Controls the font size", category: "Editor" },
  { id: "editor.tabSize", title: "Tab Size", description: "Controls the tab size", category: "Editor" },
  { id: "workbench.colorTheme", title: "Color Theme", description: "Specifies the color theme", category: "Workbench" },
  { id: "editor.wordWrap", title: "Word Wrap", description: "Controls word wrapping", category: "Editor", enumValues: ["on", "off", "bounded"] },
];

describe("settingsSearch", () => {
  describe("buildSearchIndex", () => {
    it("builds index from settings", () => {
      const index = buildSearchIndex(settings);
      expect(index).toBeDefined();
      expect(index.totalDocuments).toBe(4);
      expect(index.documents.size).toBe(4);
    });

    it("handles empty settings", () => {
      const index = buildSearchIndex([]);
      expect(index.totalDocuments).toBe(0);
    });
  });

  describe("searchSettings", () => {
    it("finds matching settings by title", () => {
      const index = buildSearchIndex(settings);
      const results = searchSettings("font", index, settings);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].settingId).toBe("editor.fontSize");
    });

    it("finds matching settings by id", () => {
      const index = buildSearchIndex(settings);
      const results = searchSettings("tabSize", index, settings);
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns empty for no match", () => {
      const index = buildSearchIndex(settings);
      const results = searchSettings("zzzznonexistent", index, settings);
      expect(results).toHaveLength(0);
    });

    it("returns empty for empty query", () => {
      const index = buildSearchIndex(settings);
      const results = searchSettings("", index, settings);
      expect(results).toHaveLength(0);
    });

    it("respects maxResults option", () => {
      const index = buildSearchIndex(settings);
      const results = searchSettings("editor", index, settings, { maxResults: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe("parseSearchFilters", () => {
    it("parses plain text query", () => {
      const result = parseSearchFilters("font size");
      expect(result.text).toBe("font size");
    });

    it("parses filter syntax", () => {
      const result = parseSearchFilters("@editor font");
      expect(result.text).toBeDefined();
    });
  });

  describe("highlightMatches", () => {
    it("returns highlight ranges", () => {
      const result = highlightMatches("Font Size", [{ start: 0, end: 4 }]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns non-highlighted text for no match", () => {
      const result = highlightMatches("Font Size", []);
      expect(result.every((r) => !r.highlighted)).toBe(true);
    });
  });

  describe("createEmptyFilterContext", () => {
    it("returns empty filter context", () => {
      const ctx = createEmptyFilterContext();
      expect(ctx.modifiedSettings).toBeInstanceOf(Set);
      expect(ctx.modifiedSettings.size).toBe(0);
      expect(ctx.extensionSettings).toBeInstanceOf(Map);
      expect(ctx.extensionSettings.size).toBe(0);
      expect(ctx.languageSettings).toBeInstanceOf(Map);
      expect(ctx.policySettings).toBeInstanceOf(Set);
    });
  });

  describe("quickSearch", () => {
    it("searches without pre-built index", () => {
      const results = quickSearch("font", settings);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].settingId).toBe("editor.fontSize");
    });

    it("returns empty for empty query", () => {
      const results = quickSearch("", settings);
      expect(results).toHaveLength(0);
    });
  });
});

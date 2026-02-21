import { describe, it, expect } from "vitest";
import {
  BUILTIN_THEMES,
  convertWorkbenchColors,
  convertEditorColors,
  convertTerminalColors,
  convertSyntaxColors,
  convertVSCodeTheme,
  cortexThemeToCustomizations,
} from "../theme-converter";

const minimalTheme = {
  colors: {
    "editor.background": "#1e1e1e",
    "editor.foreground": "#d4d4d4",
    "activityBar.background": "#333333",
    "sideBar.background": "#252526",
    "statusBar.background": "#007acc",
    "titleBar.activeBackground": "#3c3c3c",
    "terminal.background": "#1e1e1e",
    "terminal.foreground": "#cccccc",
    "terminal.ansiBlack": "#000000",
    "terminal.ansiRed": "#cd3131",
    "terminal.ansiGreen": "#0dbc79",
    "terminal.ansiYellow": "#e5e510",
    "terminal.ansiBlue": "#2472c8",
    "terminal.ansiMagenta": "#bc3fbc",
    "terminal.ansiCyan": "#11a8cd",
    "terminal.ansiWhite": "#e5e5e5",
    "terminal.ansiBrightBlack": "#666666",
    "terminal.ansiBrightRed": "#f14c4c",
    "terminal.ansiBrightGreen": "#23d18b",
    "terminal.ansiBrightYellow": "#f5f543",
    "terminal.ansiBrightBlue": "#3b8eea",
    "terminal.ansiBrightMagenta": "#d670d6",
    "terminal.ansiBrightCyan": "#29b8db",
    "terminal.ansiBrightWhite": "#e5e5e5",
  },
  tokenColors: [
    { scope: "comment", settings: { foreground: "#6A9955" } },
    { scope: "string", settings: { foreground: "#CE9178" } },
    { scope: "keyword", settings: { foreground: "#569CD6" } },
  ],
};

describe("theme-converter", () => {
  describe("BUILTIN_THEMES", () => {
    it("has built-in themes", () => {
      expect(BUILTIN_THEMES.length).toBeGreaterThan(0);
    });

    it("each theme has id and label", () => {
      for (const t of BUILTIN_THEMES) {
        expect(t.id).toBeTruthy();
        expect(t.label).toBeTruthy();
      }
    });
  });

  describe("convertWorkbenchColors", () => {
    it("extracts workbench colors", () => {
      const colors = convertWorkbenchColors(minimalTheme.colors, "dark");
      expect(colors).toBeDefined();
    });
  });

  describe("convertEditorColors", () => {
    it("extracts editor colors", () => {
      const colors = convertEditorColors(minimalTheme.colors, "dark");
      expect(colors).toBeDefined();
      expect(colors.editorBackground).toBe("#1e1e1e");
    });
  });

  describe("convertTerminalColors", () => {
    it("extracts terminal colors", () => {
      const colors = convertTerminalColors(minimalTheme.colors, "dark");
      expect(colors).toBeDefined();
      expect(colors.terminalBackground).toBe("#1e1e1e");
    });
  });

  describe("convertSyntaxColors", () => {
    it("converts token colors", () => {
      const syntax = convertSyntaxColors(minimalTheme.tokenColors, "dark");
      expect(syntax).toBeDefined();
    });
  });

  describe("convertVSCodeTheme", () => {
    it("converts full theme", () => {
      const theme = convertVSCodeTheme(minimalTheme as any, "Test Theme");
      expect(theme).toBeDefined();
      expect(theme.name).toBe("Test Theme");
    });
  });

  describe("cortexThemeToCustomizations", () => {
    it("converts cortex theme to customizations", () => {
      const theme = convertVSCodeTheme(minimalTheme as any, "Test");
      const customizations = cortexThemeToCustomizations(theme);
      expect(customizations).toBeDefined();
    });
  });
});

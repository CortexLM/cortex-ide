import { describe, it, expect, vi } from "vitest";

import { darkColors, lightColors, darkEditorColors, lightEditorColors, darkSyntaxColors, lightSyntaxColors, darkTerminalColors, lightTerminalColors, DEFAULT_DARK_COLORS, DEFAULT_LIGHT_COLORS } from "../../theme/defaultColors";

describe("defaultColors", () => {
  it("darkColors", () => {
    expect(darkColors).toBeDefined();
  });
  it("lightColors", () => {
    expect(lightColors).toBeDefined();
  });
  it("darkEditorColors", () => {
    expect(darkEditorColors).toBeDefined();
  });
  it("lightEditorColors", () => {
    expect(lightEditorColors).toBeDefined();
  });
  it("darkSyntaxColors", () => {
    expect(darkSyntaxColors).toBeDefined();
  });
  it("lightSyntaxColors", () => {
    expect(lightSyntaxColors).toBeDefined();
  });
  it("darkTerminalColors", () => {
    expect(darkTerminalColors).toBeDefined();
  });
  it("lightTerminalColors", () => {
    expect(lightTerminalColors).toBeDefined();
  });
  it("DEFAULT_DARK_COLORS", () => {
    expect(DEFAULT_DARK_COLORS).toBeDefined();
  });
  it("DEFAULT_LIGHT_COLORS", () => {
    expect(DEFAULT_LIGHT_COLORS).toBeDefined();
  });
});

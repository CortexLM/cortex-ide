import type { ThemeColors, EditorColors, SyntaxColors, TerminalColors } from "./types";

// ============================================================================
// UI Theme Color Palettes
// ============================================================================

// JetBrains Dark Theme
export const darkColors: ThemeColors = {
  background: "#18181a",
  backgroundSecondary: "#18181a",
  backgroundTertiary: "#3C3F41",
  foreground: "#D8DEE9",
  foregroundMuted: "#CCCCCC99",
  primary: "#4c9df3",
  primaryHover: "#66aefa",
  secondary: "#565656",
  accent: "#88C0D0",
  success: "#A3BE8C",
  warning: "#EBCB8B",
  error: "#BF616A",
  info: "#88C0D0",
  border: "#2A2A2A",
  borderActive: "#404040",
};

export const lightColors: ThemeColors = {
  background: "#ffffff",
  backgroundSecondary: "#f4f4f5",
  backgroundTertiary: "#e4e4e7",
  foreground: "#18181b",
  foregroundMuted: "#71717a",
  primary: "#6366f1",
  primaryHover: "#4f46e5",
  secondary: "#8b5cf6",
  accent: "#0891b2",
  success: "#16a34a",
  warning: "#d97706",
  error: "#dc2626",
  info: "#2563eb",
  border: "#e4e4e7",
  borderActive: "#d4d4d8",
};

// ============================================================================
// Editor Color Palettes
// ============================================================================

// Figma Design Editor Colors (node 5:12544)
export const darkEditorColors: EditorColors = {
  editorBackground: "#141415",
  editorForeground: "#FCFCFC",
  editorLineHighlight: "rgba(255,255,255,0.05)",
  editorSelectionBackground: "rgba(255,255,255,0.15)",
  editorSelectionForeground: "#FCFCFC",
  editorCursor: "#FCFCFC",
  editorWhitespace: "rgba(255,255,255,0.1)",
  editorIndentGuide: "rgba(255,255,255,0.05)",
  editorIndentGuideActive: "rgba(255,255,255,0.1)",
  editorLineNumber: "#8C8D8F",
  editorLineNumberActive: "#FCFCFC",
  editorRuler: "rgba(255,255,255,0.1)",
  editorGutter: "#141415",
  editorFoldBackground: "rgba(255,255,255,0.05)",
};

export const lightEditorColors: EditorColors = {
  editorBackground: "#ffffff",
  editorForeground: "#18181b",
  editorLineHighlight: "#f4f4f5",
  editorSelectionBackground: "#bfdbfe",
  editorSelectionForeground: "#18181b",
  editorCursor: "#6366f1",
  editorWhitespace: "#d4d4d8",
  editorIndentGuide: "#e4e4e7",
  editorIndentGuideActive: "#a1a1aa",
  editorLineNumber: "#a1a1aa",
  editorLineNumberActive: "#52525b",
  editorRuler: "#e4e4e7",
  editorGutter: "#ffffff",
  editorFoldBackground: "#f4f4f5",
};

// ============================================================================
// Syntax Highlighting Color Palettes
// ============================================================================

// Figma Design Exact Syntax Colors (node 5:12544)
export const darkSyntaxColors: SyntaxColors = {
  comment: "#8C8D8F",                 // Comments
  string: "#FFB7FA",                  // Strings, template literals (pink)
  number: "#FFB7FA",                  // Numbers (pink)
  keyword: "#FEAB78",                 // const, typeof, if, false, true (orange)
  operator: "#FCFCFC",                // =, ===, &&, ||
  function: "#66BFFF",                // useTranslation, useState, Object.keys (blue)
  variable: "#FCFCFC",                // Default text
  type: "#FEAB78",                    // <boolean>, type annotations (orange)
  class: "#66BFFF",                   // Class names (blue)
  constant: "#FEAB78",                // false, true, null (orange)
  parameter: "#FCFCFC",               // Function parameters
  property: "#FFB7FA",                // .length, .household, .members (pink)
  punctuation: "#FCFCFC",             // (), {}, []
  tag: "#FEAB78",                     // JSX tags (orange)
  attribute: "#FFB7FA",               // JSX attributes (pink)
  regexp: "#FFB7FA",                  // Regular expressions (pink)
  escape: "#FEAB78",                  // Escape sequences (orange)
  invalid: "#FF7070",                 // Invalid code
};

export const lightSyntaxColors: SyntaxColors = {
  comment: "#6b7280",
  string: "#16a34a",
  number: "#ca8a04",
  keyword: "#7c3aed",
  operator: "#18181b",
  function: "#2563eb",
  variable: "#a21caf",
  type: "#0891b2",
  class: "#b45309",
  constant: "#ea580c",
  parameter: "#c2410c",
  property: "#4f46e5",
  punctuation: "#52525b",
  tag: "#db2777",
  attribute: "#0891b2",
  regexp: "#dc2626",
  escape: "#b45309",
  invalid: "#dc2626",
};

// ============================================================================
// Terminal Color Palettes
// ============================================================================

// JetBrains Dark Terminal Colors
export const darkTerminalColors: TerminalColors = {
  terminalBackground: "#18181a",
  terminalForeground: "#D8DEE9",
  terminalCursor: "#FFFFFF",
  terminalCursorAccent: "#18181a",
  terminalSelection: "#40404080",
  terminalBlack: "#3B4252",
  terminalRed: "#BF616A",
  terminalGreen: "#A3BE8C",
  terminalYellow: "#EBCB8B",
  terminalBlue: "#81A1C1",
  terminalMagenta: "#B48EAD",
  terminalCyan: "#88C0D0",
  terminalWhite: "#E5E9F0",
  terminalBrightBlack: "#4C566A",
  terminalBrightRed: "#BF616A",
  terminalBrightGreen: "#A3BE8C",
  terminalBrightYellow: "#EBCB8B",
  terminalBrightBlue: "#81A1C1",
  terminalBrightMagenta: "#B48EAD",
  terminalBrightCyan: "#8FBCBB",
  terminalBrightWhite: "#ECEFF4",
};

export const lightTerminalColors: TerminalColors = {
  terminalBackground: "#ffffff",
  terminalForeground: "#18181b",
  terminalCursor: "#6366f1",
  terminalCursorAccent: "#ffffff",
  terminalSelection: "#bfdbfe80",
  terminalBlack: "#18181b",
  terminalRed: "#dc2626",
  terminalGreen: "#16a34a",
  terminalYellow: "#d97706",
  terminalBlue: "#2563eb",
  terminalMagenta: "#9333ea",
  terminalCyan: "#0891b2",
  terminalWhite: "#f4f4f5",
  terminalBrightBlack: "#71717a",
  terminalBrightRed: "#ef4444",
  terminalBrightGreen: "#22c55e",
  terminalBrightYellow: "#f59e0b",
  terminalBrightBlue: "#3b82f6",
  terminalBrightMagenta: "#a855f7",
  terminalBrightCyan: "#06b6d4",
  terminalBrightWhite: "#ffffff",
};

// ============================================================================
// Exported Default Colors for Reference
// ============================================================================

export const DEFAULT_DARK_COLORS = {
  ui: darkColors,
  editor: darkEditorColors,
  syntax: darkSyntaxColors,
  terminal: darkTerminalColors,
};

export const DEFAULT_LIGHT_COLORS = {
  ui: lightColors,
  editor: lightEditorColors,
  syntax: lightSyntaxColors,
  terminal: lightTerminalColors,
};

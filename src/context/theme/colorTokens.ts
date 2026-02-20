import type { ColorTokenInfo } from "./types";

// ============================================================================
// UI Color Token Metadata
// ============================================================================

export const UI_COLOR_TOKENS: ColorTokenInfo[] = [
  { key: "background", label: "Background", description: "Main application background" },
  { key: "backgroundSecondary", label: "Secondary Background", description: "Sidebar and panel backgrounds" },
  { key: "backgroundTertiary", label: "Tertiary Background", description: "Nested panel backgrounds" },
  { key: "foreground", label: "Foreground", description: "Primary text color" },
  { key: "foregroundMuted", label: "Muted Foreground", description: "Secondary text and labels" },
  { key: "primary", label: "Primary", description: "Primary accent color" },
  { key: "primaryHover", label: "Primary Hover", description: "Primary color on hover" },
  { key: "secondary", label: "Secondary", description: "Secondary accent color" },
  { key: "accent", label: "Accent", description: "Highlight accent color" },
  { key: "success", label: "Success", description: "Success state color" },
  { key: "warning", label: "Warning", description: "Warning state color" },
  { key: "error", label: "Error", description: "Error state color" },
  { key: "info", label: "Info", description: "Informational state color" },
  { key: "border", label: "Border", description: "Default border color" },
  { key: "borderActive", label: "Active Border", description: "Focused/active border color" },
];

// ============================================================================
// Editor Color Token Metadata
// ============================================================================

export const EDITOR_COLOR_TOKENS: ColorTokenInfo[] = [
  { key: "editorBackground", label: "Background", description: "Editor background" },
  { key: "editorForeground", label: "Foreground", description: "Editor text color" },
  { key: "editorLineHighlight", label: "Line Highlight", description: "Current line highlight" },
  { key: "editorSelectionBackground", label: "Selection Background", description: "Selected text background" },
  { key: "editorSelectionForeground", label: "Selection Foreground", description: "Selected text color" },
  { key: "editorCursor", label: "Cursor", description: "Cursor color" },
  { key: "editorWhitespace", label: "Whitespace", description: "Visible whitespace characters" },
  { key: "editorIndentGuide", label: "Indent Guide", description: "Indentation guide color" },
  { key: "editorIndentGuideActive", label: "Active Indent Guide", description: "Active indentation guide" },
  { key: "editorLineNumber", label: "Line Number", description: "Line number color" },
  { key: "editorLineNumberActive", label: "Active Line Number", description: "Current line number color" },
  { key: "editorRuler", label: "Ruler", description: "Column ruler color" },
  { key: "editorGutter", label: "Gutter", description: "Editor gutter background" },
  { key: "editorFoldBackground", label: "Fold Background", description: "Folded code background" },
];

// ============================================================================
// Syntax Color Token Metadata
// ============================================================================

export const SYNTAX_COLOR_TOKENS: ColorTokenInfo[] = [
  { key: "comment", label: "Comment", description: "Code comments" },
  { key: "string", label: "String", description: "String literals" },
  { key: "number", label: "Number", description: "Numeric literals" },
  { key: "keyword", label: "Keyword", description: "Language keywords" },
  { key: "operator", label: "Operator", description: "Operators (+, -, =, etc.)" },
  { key: "function", label: "Function", description: "Function names" },
  { key: "variable", label: "Variable", description: "Variable names" },
  { key: "type", label: "Type", description: "Type names" },
  { key: "class", label: "Class", description: "Class names" },
  { key: "constant", label: "Constant", description: "Constants and enums" },
  { key: "parameter", label: "Parameter", description: "Function parameters" },
  { key: "property", label: "Property", description: "Object properties" },
  { key: "punctuation", label: "Punctuation", description: "Brackets, semicolons, etc." },
  { key: "tag", label: "Tag", description: "HTML/XML tags" },
  { key: "attribute", label: "Attribute", description: "HTML/XML attributes" },
  { key: "regexp", label: "RegExp", description: "Regular expressions" },
  { key: "escape", label: "Escape", description: "Escape sequences" },
  { key: "invalid", label: "Invalid", description: "Invalid/error tokens" },
];

// ============================================================================
// Terminal Color Token Metadata
// ============================================================================

export const TERMINAL_COLOR_TOKENS: ColorTokenInfo[] = [
  { key: "terminalBackground", label: "Background", description: "Terminal background" },
  { key: "terminalForeground", label: "Foreground", description: "Terminal text color" },
  { key: "terminalCursor", label: "Cursor", description: "Terminal cursor color" },
  { key: "terminalCursorAccent", label: "Cursor Accent", description: "Cursor text color" },
  { key: "terminalSelection", label: "Selection", description: "Selected text background" },
  { key: "terminalBlack", label: "Black", description: "ANSI black" },
  { key: "terminalRed", label: "Red", description: "ANSI red" },
  { key: "terminalGreen", label: "Green", description: "ANSI green" },
  { key: "terminalYellow", label: "Yellow", description: "ANSI yellow" },
  { key: "terminalBlue", label: "Blue", description: "ANSI blue" },
  { key: "terminalMagenta", label: "Magenta", description: "ANSI magenta" },
  { key: "terminalCyan", label: "Cyan", description: "ANSI cyan" },
  { key: "terminalWhite", label: "White", description: "ANSI white" },
  { key: "terminalBrightBlack", label: "Bright Black", description: "ANSI bright black" },
  { key: "terminalBrightRed", label: "Bright Red", description: "ANSI bright red" },
  { key: "terminalBrightGreen", label: "Bright Green", description: "ANSI bright green" },
  { key: "terminalBrightYellow", label: "Bright Yellow", description: "ANSI bright yellow" },
  { key: "terminalBrightBlue", label: "Bright Blue", description: "ANSI bright blue" },
  { key: "terminalBrightMagenta", label: "Bright Magenta", description: "ANSI bright magenta" },
  { key: "terminalBrightCyan", label: "Bright Cyan", description: "ANSI bright cyan" },
  { key: "terminalBrightWhite", label: "Bright White", description: "ANSI bright white" },
];

// ============================================================================
// Component Color Token Metadata
// ============================================================================

export const COMPONENT_COLOR_TOKENS: ColorTokenInfo[] = [
  { key: "activityBar.background", label: "Activity Bar Background", description: "Activity bar background color" },
  { key: "activityBar.foreground", label: "Activity Bar Foreground", description: "Activity bar icon/text color" },
  { key: "activityBar.activeBorder", label: "Activity Bar Active Border", description: "Active item indicator border" },
  { key: "activityBar.badgeBackground", label: "Activity Bar Badge Background", description: "Notification badge background" },
  { key: "activityBar.badgeForeground", label: "Activity Bar Badge Foreground", description: "Notification badge text color" },
  { key: "statusBar.background", label: "Status Bar Background", description: "Status bar background color" },
  { key: "statusBar.foreground", label: "Status Bar Foreground", description: "Status bar text color" },
  { key: "statusBar.debuggingBackground", label: "Status Bar Debugging", description: "Status bar background when debugging" },
  { key: "statusBar.noFolderBackground", label: "Status Bar No Folder", description: "Status bar background with no folder open" },
  { key: "titleBar.activeBackground", label: "Title Bar Background", description: "Title bar background when active" },
  { key: "titleBar.activeForeground", label: "Title Bar Foreground", description: "Title bar text when active" },
  { key: "titleBar.inactiveBackground", label: "Title Bar Inactive Background", description: "Title bar background when inactive" },
  { key: "titleBar.inactiveForeground", label: "Title Bar Inactive Foreground", description: "Title bar text when inactive" },
  { key: "sidebar.background", label: "Sidebar Background", description: "Sidebar background color" },
  { key: "sidebar.foreground", label: "Sidebar Foreground", description: "Sidebar text color" },
  { key: "sidebar.border", label: "Sidebar Border", description: "Sidebar border color" },
];

/**
 * ColorCustomizationsContext
 * 
 * Allows users to override any theme color via settings.json
 * Follows the VS Code workbench.colorCustomizations pattern
 * 
 * Settings format:
 * "workbench.colorCustomizations": {
 *   "[Theme Name]": {
 *     "editor.background": "#1a1a2e",
 *     "sideBar.background": "#16213e",
 *     "activityBar.background": "#0f3460"
 *   },
 *   // Or global (all themes):
 *   "editor.selectionBackground": "#264f78"
 * }
 */

import {
  createContext,
  useContext,
  createEffect,
  onCleanup,
  ParentProps,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";

// ============================================================================
// Types
// ============================================================================

/** Single color customization value */
export type ColorValue = string;

/** Color customization map for a single theme or global */
export interface ColorCustomization {
  [colorKey: string]: ColorValue;
}

/** Theme-specific customizations with bracket notation */
export interface ThemeColorCustomizations {
  [themeKey: string]: ColorCustomization;
}

/** Parsed color customizations structure */
export interface ParsedColorCustomizations {
  /** Global customizations (apply to all themes) */
  global: ColorCustomization;
  /** Per-theme customizations (keyed by theme name) */
  perTheme: Record<string, ColorCustomization>;
}

/** VS Code-compatible color key categories */
export type ColorKeyCategory =
  | "editor"
  | "editorWidget"
  | "editorGroup"
  | "editorGroupHeader"
  | "tab"
  | "activityBar"
  | "activityBarBadge"
  | "sideBar"
  | "sideBarSectionHeader"
  | "list"
  | "tree"
  | "input"
  | "inputOption"
  | "inputValidation"
  | "dropdown"
  | "button"
  | "badge"
  | "scrollbar"
  | "scrollbarSlider"
  | "progressBar"
  | "minimap"
  | "minimapSlider"
  | "minimapGutter"
  | "statusBar"
  | "statusBarItem"
  | "titleBar"
  | "menubar"
  | "menu"
  | "notificationCenter"
  | "notificationToast"
  | "notifications"
  | "notification"
  | "panel"
  | "panelTitle"
  | "panelInput"
  | "panelSection"
  | "panelSectionHeader"
  | "terminal"
  | "terminalCursor"
  | "breadcrumb"
  | "breadcrumbPicker"
  | "debugToolBar"
  | "debugExceptionWidget"
  | "debugTokenExpression"
  | "debugView"
  | "testing"
  | "welcomePage"
  | "walkthrough"
  | "settings"
  | "textBlockQuote"
  | "textCodeBlock"
  | "textLink"
  | "textPreformat"
  | "textSeparator"
  | "foreground"
  | "errorForeground"
  | "descriptionForeground"
  | "focusBorder"
  | "contrastBorder"
  | "contrastActiveBorder"
  | "selection"
  | "icon"
  | "widget"
  | "sash"
  | "peekView"
  | "peekViewEditor"
  | "peekViewEditorGutter"
  | "peekViewResult"
  | "peekViewTitle"
  | "merge"
  | "diffEditor"
  | "gitDecoration"
  | "keybindingLabel"
  | "keybindingTable"
  | "commandCenter"
  | "symbolIcon"
  | "chart"
  | "notebook"
  | "notebookScrollbarSlider"
  | "notebookStatusBar"
  | "quickInput"
  | "quickInputList"
  | "quickInputTitle"
  | "search"
  | "searchEditor"
  | "editorStickyScroll"
  | "editorStickyScrollHover"
  | "commentsView"
  | "toolbar"
  | "banner"
  | "editorGutter"
  | "editorOverviewRuler"
  | "editorBracketMatch"
  | "editorBracketHighlight"
  | "editorCursor"
  | "editorIndentGuide"
  | "editorLineNumber"
  | "editorMarkerNavigation"
  | "editorMarkerNavigationInfo"
  | "editorMarkerNavigationWarning"
  | "editorMarkerNavigationError"
  | "editorRuler"
  | "editorWhitespace"
  | "editorCodeLens"
  | "editorLightBulb"
  | "editorLightBulbAutoFix"
  | "editorInlayHint"
  | "editorGhostText"
  | "editorUnnecessaryCode"
  | "editorUnicodeHighlight"
  | "editorLink"
  | "editorFold"
  | "editorHoverHighlight"
  | "editorSelectionHighlight"
  | "editorWordHighlight"
  | "editorWordHighlightStrong"
  | "editorWordHighlightText"
  | "editorFindMatch"
  | "editorFindMatchHighlight"
  | "editorFindRangeHighlight"
  | "editorLineHighlight"
  | "editorRangeHighlight"
  | "editorSymbolHighlight"
  | "editorInfo"
  | "editorWarning"
  | "editorError"
  | "editorHint"
  | "problemsErrorIcon"
  | "problemsWarningIcon"
  | "problemsInfoIcon";

/** Color key info for UI display */
export interface ColorKeyInfo {
  key: string;
  label: string;
  description: string;
  category: string;
  defaultDark?: string;
  defaultLight?: string;
}

/** State for the color customizations context */
export interface ColorCustomizationsState {
  /** Raw customizations from settings */
  raw: ThemeColorCustomizations;
  /** Parsed customizations */
  parsed: ParsedColorCustomizations;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
}

/** Context value interface */
export interface ColorCustomizationsContextValue {
  /** Current state */
  state: ColorCustomizationsState;
  /** Get customizations for current theme */
  customizations: () => ParsedColorCustomizations;
  /** Get effective color value for a key */
  getCustomizedColor: (colorKey: string, themeName: string) => string | undefined;
  /** Check if a color key has customization */
  hasCustomization: (colorKey: string, themeName: string) => boolean;
  /** Set a global color customization */
  setGlobalCustomization: (colorKey: string, value: string) => Promise<void>;
  /** Set a theme-specific color customization */
  setThemeCustomization: (themeName: string, colorKey: string, value: string) => Promise<void>;
  /** Remove a global color customization */
  removeGlobalCustomization: (colorKey: string) => Promise<void>;
  /** Remove a theme-specific color customization */
  removeThemeCustomization: (themeName: string, colorKey: string) => Promise<void>;
  /** Reset all customizations */
  resetAllCustomizations: () => Promise<void>;
  /** Reset customizations for a specific theme */
  resetThemeCustomizations: (themeName: string) => Promise<void>;
  /** Apply customizations to CSS variables */
  applyToCSS: (themeName: string) => void;
  /** Export customizations as JSON */
  exportCustomizations: () => string;
  /** Import customizations from JSON */
  importCustomizations: (json: string) => Promise<boolean>;
  /** Get all available color keys */
  getColorKeys: () => ColorKeyInfo[];
  /** Count of customizations */
  customizationCount: () => number;
  /** Count of global customizations */
  globalCustomizationCount: () => number;
  /** Count of theme-specific customizations */
  themeCustomizationCount: (themeName: string) => number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "orion-workbench-color-customizations";

/** Default empty parsed customizations */
const DEFAULT_PARSED: ParsedColorCustomizations = {
  global: {},
  perTheme: {},
};

/** All available color keys with metadata */
const COLOR_KEYS: ColorKeyInfo[] = [
  // Editor colors
  { key: "editor.background", label: "Background", description: "Editor background color", category: "Editor" },
  { key: "editor.foreground", label: "Foreground", description: "Editor default foreground color", category: "Editor" },
  { key: "editor.selectionBackground", label: "Selection Background", description: "Color of the selection", category: "Editor" },
  { key: "editor.selectionForeground", label: "Selection Foreground", description: "Color of the selection text", category: "Editor" },
  { key: "editor.inactiveSelectionBackground", label: "Inactive Selection", description: "Background of selection in inactive editor", category: "Editor" },
  { key: "editor.selectionHighlightBackground", label: "Selection Highlight", description: "Background of regions highlighted while selecting", category: "Editor" },
  { key: "editor.findMatchBackground", label: "Find Match", description: "Background of current search match", category: "Editor" },
  { key: "editor.findMatchHighlightBackground", label: "Find Match Highlight", description: "Background of other search matches", category: "Editor" },
  { key: "editor.findRangeHighlightBackground", label: "Find Range Highlight", description: "Background of range limiting the search", category: "Editor" },
  { key: "editor.hoverHighlightBackground", label: "Hover Highlight", description: "Highlight below the word for which hover is shown", category: "Editor" },
  { key: "editor.lineHighlightBackground", label: "Line Highlight", description: "Background of the line highlight", category: "Editor" },
  { key: "editor.lineHighlightBorder", label: "Line Highlight Border", description: "Border of the line highlight", category: "Editor" },
  { key: "editor.rangeHighlightBackground", label: "Range Highlight", description: "Background of highlighted ranges", category: "Editor" },
  { key: "editor.rangeHighlightBorder", label: "Range Highlight Border", description: "Border of highlighted ranges", category: "Editor" },
  { key: "editor.symbolHighlightBackground", label: "Symbol Highlight", description: "Background of symbol highlights", category: "Editor" },
  { key: "editor.symbolHighlightBorder", label: "Symbol Highlight Border", description: "Border of symbol highlights", category: "Editor" },
  { key: "editorCursor.foreground", label: "Cursor", description: "Color of the editor cursor", category: "Editor" },
  { key: "editorCursor.background", label: "Cursor Background", description: "Background of the editor cursor (for block cursors)", category: "Editor" },
  { key: "editorWhitespace.foreground", label: "Whitespace", description: "Color of whitespace characters", category: "Editor" },
  { key: "editorIndentGuide.background", label: "Indent Guide", description: "Color of indent guides", category: "Editor" },
  { key: "editorIndentGuide.activeBackground", label: "Active Indent Guide", description: "Color of active indent guide", category: "Editor" },
  { key: "editorLineNumber.foreground", label: "Line Number", description: "Color of line numbers", category: "Editor" },
  { key: "editorLineNumber.activeForeground", label: "Active Line Number", description: "Color of active line number", category: "Editor" },
  { key: "editorRuler.foreground", label: "Ruler", description: "Color of editor rulers", category: "Editor" },
  { key: "editor.wordHighlightBackground", label: "Word Highlight", description: "Background of word highlight", category: "Editor" },
  { key: "editor.wordHighlightStrongBackground", label: "Word Highlight Strong", description: "Background of strong word highlight", category: "Editor" },
  { key: "editorBracketMatch.background", label: "Bracket Match", description: "Background of matching brackets", category: "Editor" },
  { key: "editorBracketMatch.border", label: "Bracket Match Border", description: "Border of matching brackets", category: "Editor" },
  { key: "editorGutter.background", label: "Gutter Background", description: "Background of editor gutter", category: "Editor" },
  { key: "editorGutter.modifiedBackground", label: "Gutter Modified", description: "Background for modified lines", category: "Editor" },
  { key: "editorGutter.addedBackground", label: "Gutter Added", description: "Background for added lines", category: "Editor" },
  { key: "editorGutter.deletedBackground", label: "Gutter Deleted", description: "Background for deleted lines", category: "Editor" },
  { key: "editorGutter.foldingControlForeground", label: "Folding Control", description: "Color of folding control", category: "Editor" },
  
  // Sidebar colors
  { key: "sideBar.background", label: "Background", description: "Sidebar background", category: "Sidebar" },
  { key: "sideBar.foreground", label: "Foreground", description: "Sidebar foreground", category: "Sidebar" },
  { key: "sideBar.border", label: "Border", description: "Sidebar border", category: "Sidebar" },
  { key: "sideBarTitle.foreground", label: "Title", description: "Sidebar title foreground", category: "Sidebar" },
  { key: "sideBarSectionHeader.background", label: "Section Header", description: "Section header background", category: "Sidebar" },
  { key: "sideBarSectionHeader.foreground", label: "Section Header Text", description: "Section header foreground", category: "Sidebar" },
  { key: "sideBarSectionHeader.border", label: "Section Header Border", description: "Section header border", category: "Sidebar" },
  
  // Activity bar colors
  { key: "activityBar.background", label: "Background", description: "Activity bar background", category: "Activity Bar" },
  { key: "activityBar.foreground", label: "Foreground", description: "Activity bar foreground", category: "Activity Bar" },
  { key: "activityBar.inactiveForeground", label: "Inactive Foreground", description: "Inactive icon foreground", category: "Activity Bar" },
  { key: "activityBar.border", label: "Border", description: "Activity bar border", category: "Activity Bar" },
  { key: "activityBar.activeBorder", label: "Active Border", description: "Active indicator border", category: "Activity Bar" },
  { key: "activityBar.activeBackground", label: "Active Background", description: "Active icon background", category: "Activity Bar" },
  { key: "activityBarBadge.background", label: "Badge Background", description: "Badge background", category: "Activity Bar" },
  { key: "activityBarBadge.foreground", label: "Badge Foreground", description: "Badge foreground", category: "Activity Bar" },
  
  // Status bar colors
  { key: "statusBar.background", label: "Background", description: "Status bar background", category: "Status Bar" },
  { key: "statusBar.foreground", label: "Foreground", description: "Status bar foreground", category: "Status Bar" },
  { key: "statusBar.border", label: "Border", description: "Status bar border", category: "Status Bar" },
  { key: "statusBar.debuggingBackground", label: "Debugging Background", description: "Background when debugging", category: "Status Bar" },
  { key: "statusBar.debuggingForeground", label: "Debugging Foreground", description: "Foreground when debugging", category: "Status Bar" },
  { key: "statusBar.noFolderBackground", label: "No Folder Background", description: "Background when no folder open", category: "Status Bar" },
  { key: "statusBar.noFolderForeground", label: "No Folder Foreground", description: "Foreground when no folder open", category: "Status Bar" },
  { key: "statusBarItem.activeBackground", label: "Item Active", description: "Active item background", category: "Status Bar" },
  { key: "statusBarItem.hoverBackground", label: "Item Hover", description: "Hover item background", category: "Status Bar" },
  { key: "statusBarItem.prominentBackground", label: "Prominent Background", description: "Prominent item background", category: "Status Bar" },
  { key: "statusBarItem.prominentForeground", label: "Prominent Foreground", description: "Prominent item foreground", category: "Status Bar" },
  { key: "statusBarItem.prominentHoverBackground", label: "Prominent Hover", description: "Prominent item hover background", category: "Status Bar" },
  { key: "statusBarItem.remoteBackground", label: "Remote Background", description: "Remote indicator background", category: "Status Bar" },
  { key: "statusBarItem.remoteForeground", label: "Remote Foreground", description: "Remote indicator foreground", category: "Status Bar" },
  { key: "statusBarItem.errorBackground", label: "Error Background", description: "Error item background", category: "Status Bar" },
  { key: "statusBarItem.errorForeground", label: "Error Foreground", description: "Error item foreground", category: "Status Bar" },
  { key: "statusBarItem.warningBackground", label: "Warning Background", description: "Warning item background", category: "Status Bar" },
  { key: "statusBarItem.warningForeground", label: "Warning Foreground", description: "Warning item foreground", category: "Status Bar" },
  
  // Title bar colors
  { key: "titleBar.activeBackground", label: "Active Background", description: "Title bar background when active", category: "Title Bar" },
  { key: "titleBar.activeForeground", label: "Active Foreground", description: "Title bar foreground when active", category: "Title Bar" },
  { key: "titleBar.inactiveBackground", label: "Inactive Background", description: "Title bar background when inactive", category: "Title Bar" },
  { key: "titleBar.inactiveForeground", label: "Inactive Foreground", description: "Title bar foreground when inactive", category: "Title Bar" },
  { key: "titleBar.border", label: "Border", description: "Title bar border", category: "Title Bar" },
  
  // Tab colors
  { key: "tab.activeBackground", label: "Active Background", description: "Active tab background", category: "Tabs" },
  { key: "tab.activeForeground", label: "Active Foreground", description: "Active tab foreground", category: "Tabs" },
  { key: "tab.inactiveBackground", label: "Inactive Background", description: "Inactive tab background", category: "Tabs" },
  { key: "tab.inactiveForeground", label: "Inactive Foreground", description: "Inactive tab foreground", category: "Tabs" },
  { key: "tab.border", label: "Border", description: "Tab border", category: "Tabs" },
  { key: "tab.activeBorder", label: "Active Border", description: "Active tab border", category: "Tabs" },
  { key: "tab.activeBorderTop", label: "Active Border Top", description: "Active tab top border", category: "Tabs" },
  { key: "tab.unfocusedActiveBackground", label: "Unfocused Active Background", description: "Active tab background in unfocused group", category: "Tabs" },
  { key: "tab.unfocusedActiveForeground", label: "Unfocused Active Foreground", description: "Active tab foreground in unfocused group", category: "Tabs" },
  { key: "tab.unfocusedInactiveBackground", label: "Unfocused Inactive Background", description: "Inactive tab background in unfocused group", category: "Tabs" },
  { key: "tab.unfocusedInactiveForeground", label: "Unfocused Inactive Foreground", description: "Inactive tab foreground in unfocused group", category: "Tabs" },
  { key: "tab.hoverBackground", label: "Hover Background", description: "Tab hover background", category: "Tabs" },
  { key: "tab.hoverForeground", label: "Hover Foreground", description: "Tab hover foreground", category: "Tabs" },
  { key: "tab.hoverBorder", label: "Hover Border", description: "Tab hover border", category: "Tabs" },
  { key: "editorGroupHeader.tabsBackground", label: "Tabs Header Background", description: "Tab bar background", category: "Tabs" },
  { key: "editorGroupHeader.tabsBorder", label: "Tabs Header Border", description: "Tab bar border", category: "Tabs" },
  
  // Panel colors
  { key: "panel.background", label: "Background", description: "Panel background", category: "Panel" },
  { key: "panel.border", label: "Border", description: "Panel border", category: "Panel" },
  { key: "panelTitle.activeBorder", label: "Active Title Border", description: "Active panel title border", category: "Panel" },
  { key: "panelTitle.activeForeground", label: "Active Title", description: "Active panel title foreground", category: "Panel" },
  { key: "panelTitle.inactiveForeground", label: "Inactive Title", description: "Inactive panel title foreground", category: "Panel" },
  { key: "panelInput.border", label: "Input Border", description: "Panel input border", category: "Panel" },
  { key: "panelSection.border", label: "Section Border", description: "Panel section border", category: "Panel" },
  { key: "panelSection.dropBackground", label: "Section Drop Background", description: "Panel section drop background", category: "Panel" },
  { key: "panelSectionHeader.background", label: "Section Header Background", description: "Panel section header background", category: "Panel" },
  { key: "panelSectionHeader.foreground", label: "Section Header Foreground", description: "Panel section header foreground", category: "Panel" },
  { key: "panelSectionHeader.border", label: "Section Header Border", description: "Panel section header border", category: "Panel" },
  
  // Terminal colors
  { key: "terminal.background", label: "Background", description: "Terminal background", category: "Terminal" },
  { key: "terminal.foreground", label: "Foreground", description: "Terminal foreground", category: "Terminal" },
  { key: "terminal.border", label: "Border", description: "Terminal border", category: "Terminal" },
  { key: "terminal.selectionBackground", label: "Selection Background", description: "Terminal selection background", category: "Terminal" },
  { key: "terminal.selectionForeground", label: "Selection Foreground", description: "Terminal selection foreground", category: "Terminal" },
  { key: "terminalCursor.foreground", label: "Cursor", description: "Terminal cursor color", category: "Terminal" },
  { key: "terminalCursor.background", label: "Cursor Background", description: "Terminal cursor background", category: "Terminal" },
  { key: "terminal.ansiBlack", label: "ANSI Black", description: "ANSI black color", category: "Terminal" },
  { key: "terminal.ansiRed", label: "ANSI Red", description: "ANSI red color", category: "Terminal" },
  { key: "terminal.ansiGreen", label: "ANSI Green", description: "ANSI green color", category: "Terminal" },
  { key: "terminal.ansiYellow", label: "ANSI Yellow", description: "ANSI yellow color", category: "Terminal" },
  { key: "terminal.ansiBlue", label: "ANSI Blue", description: "ANSI blue color", category: "Terminal" },
  { key: "terminal.ansiMagenta", label: "ANSI Magenta", description: "ANSI magenta color", category: "Terminal" },
  { key: "terminal.ansiCyan", label: "ANSI Cyan", description: "ANSI cyan color", category: "Terminal" },
  { key: "terminal.ansiWhite", label: "ANSI White", description: "ANSI white color", category: "Terminal" },
  { key: "terminal.ansiBrightBlack", label: "ANSI Bright Black", description: "ANSI bright black color", category: "Terminal" },
  { key: "terminal.ansiBrightRed", label: "ANSI Bright Red", description: "ANSI bright red color", category: "Terminal" },
  { key: "terminal.ansiBrightGreen", label: "ANSI Bright Green", description: "ANSI bright green color", category: "Terminal" },
  { key: "terminal.ansiBrightYellow", label: "ANSI Bright Yellow", description: "ANSI bright yellow color", category: "Terminal" },
  { key: "terminal.ansiBrightBlue", label: "ANSI Bright Blue", description: "ANSI bright blue color", category: "Terminal" },
  { key: "terminal.ansiBrightMagenta", label: "ANSI Bright Magenta", description: "ANSI bright magenta color", category: "Terminal" },
  { key: "terminal.ansiBrightCyan", label: "ANSI Bright Cyan", description: "ANSI bright cyan color", category: "Terminal" },
  { key: "terminal.ansiBrightWhite", label: "ANSI Bright White", description: "ANSI bright white color", category: "Terminal" },
  
  // List colors
  { key: "list.activeSelectionBackground", label: "Active Selection Background", description: "Selected item background", category: "Lists" },
  { key: "list.activeSelectionForeground", label: "Active Selection Foreground", description: "Selected item foreground", category: "Lists" },
  { key: "list.activeSelectionIconForeground", label: "Active Selection Icon", description: "Selected item icon foreground", category: "Lists" },
  { key: "list.inactiveSelectionBackground", label: "Inactive Selection Background", description: "Inactive selection background", category: "Lists" },
  { key: "list.inactiveSelectionForeground", label: "Inactive Selection Foreground", description: "Inactive selection foreground", category: "Lists" },
  { key: "list.hoverBackground", label: "Hover Background", description: "Hover background", category: "Lists" },
  { key: "list.hoverForeground", label: "Hover Foreground", description: "Hover foreground", category: "Lists" },
  { key: "list.focusBackground", label: "Focus Background", description: "Focus background", category: "Lists" },
  { key: "list.focusForeground", label: "Focus Foreground", description: "Focus foreground", category: "Lists" },
  { key: "list.focusOutline", label: "Focus Outline", description: "Focus outline", category: "Lists" },
  { key: "list.focusAndSelectionOutline", label: "Focus Selection Outline", description: "Focus and selection outline", category: "Lists" },
  { key: "list.highlightForeground", label: "Highlight Foreground", description: "Match highlight foreground", category: "Lists" },
  { key: "list.invalidItemForeground", label: "Invalid Item Foreground", description: "Invalid item foreground", category: "Lists" },
  { key: "list.errorForeground", label: "Error Foreground", description: "Error item foreground", category: "Lists" },
  { key: "list.warningForeground", label: "Warning Foreground", description: "Warning item foreground", category: "Lists" },
  { key: "listFilterWidget.background", label: "Filter Widget Background", description: "Filter widget background", category: "Lists" },
  { key: "listFilterWidget.outline", label: "Filter Widget Outline", description: "Filter widget outline", category: "Lists" },
  { key: "listFilterWidget.noMatchesOutline", label: "Filter Widget No Matches", description: "Filter widget no matches outline", category: "Lists" },
  { key: "tree.indentGuidesStroke", label: "Tree Indent Guides", description: "Tree indent guide color", category: "Lists" },
  { key: "tree.tableColumnsBorder", label: "Tree Table Columns Border", description: "Tree table columns border", category: "Lists" },
  { key: "tree.tableOddRowsBackground", label: "Tree Table Odd Rows", description: "Tree table odd rows background", category: "Lists" },
  
  // Input colors
  { key: "input.background", label: "Background", description: "Input background", category: "Input" },
  { key: "input.foreground", label: "Foreground", description: "Input foreground", category: "Input" },
  { key: "input.border", label: "Border", description: "Input border", category: "Input" },
  { key: "input.placeholderForeground", label: "Placeholder", description: "Placeholder foreground", category: "Input" },
  { key: "inputOption.activeBackground", label: "Option Active Background", description: "Active option background", category: "Input" },
  { key: "inputOption.activeBorder", label: "Option Active Border", description: "Active option border", category: "Input" },
  { key: "inputOption.activeForeground", label: "Option Active Foreground", description: "Active option foreground", category: "Input" },
  { key: "inputOption.hoverBackground", label: "Option Hover Background", description: "Option hover background", category: "Input" },
  { key: "inputValidation.errorBackground", label: "Error Background", description: "Validation error background", category: "Input" },
  { key: "inputValidation.errorBorder", label: "Error Border", description: "Validation error border", category: "Input" },
  { key: "inputValidation.errorForeground", label: "Error Foreground", description: "Validation error foreground", category: "Input" },
  { key: "inputValidation.warningBackground", label: "Warning Background", description: "Validation warning background", category: "Input" },
  { key: "inputValidation.warningBorder", label: "Warning Border", description: "Validation warning border", category: "Input" },
  { key: "inputValidation.warningForeground", label: "Warning Foreground", description: "Validation warning foreground", category: "Input" },
  { key: "inputValidation.infoBackground", label: "Info Background", description: "Validation info background", category: "Input" },
  { key: "inputValidation.infoBorder", label: "Info Border", description: "Validation info border", category: "Input" },
  { key: "inputValidation.infoForeground", label: "Info Foreground", description: "Validation info foreground", category: "Input" },
  
  // Button colors
  { key: "button.background", label: "Background", description: "Button background", category: "Button" },
  { key: "button.foreground", label: "Foreground", description: "Button foreground", category: "Button" },
  { key: "button.border", label: "Border", description: "Button border", category: "Button" },
  { key: "button.hoverBackground", label: "Hover Background", description: "Button hover background", category: "Button" },
  { key: "button.secondaryBackground", label: "Secondary Background", description: "Secondary button background", category: "Button" },
  { key: "button.secondaryForeground", label: "Secondary Foreground", description: "Secondary button foreground", category: "Button" },
  { key: "button.secondaryHoverBackground", label: "Secondary Hover", description: "Secondary button hover background", category: "Button" },
  
  // Dropdown colors
  { key: "dropdown.background", label: "Background", description: "Dropdown background", category: "Dropdown" },
  { key: "dropdown.foreground", label: "Foreground", description: "Dropdown foreground", category: "Dropdown" },
  { key: "dropdown.border", label: "Border", description: "Dropdown border", category: "Dropdown" },
  { key: "dropdown.listBackground", label: "List Background", description: "Dropdown list background", category: "Dropdown" },
  
  // Badge colors
  { key: "badge.background", label: "Background", description: "Badge background", category: "Badge" },
  { key: "badge.foreground", label: "Foreground", description: "Badge foreground", category: "Badge" },
  
  // Scrollbar colors
  { key: "scrollbar.shadow", label: "Shadow", description: "Scrollbar shadow", category: "Scrollbar" },
  { key: "scrollbarSlider.background", label: "Slider Background", description: "Slider background", category: "Scrollbar" },
  { key: "scrollbarSlider.hoverBackground", label: "Slider Hover", description: "Slider hover background", category: "Scrollbar" },
  { key: "scrollbarSlider.activeBackground", label: "Slider Active", description: "Slider active background", category: "Scrollbar" },
  
  // Minimap colors
  { key: "minimap.background", label: "Background", description: "Minimap background", category: "Minimap" },
  { key: "minimap.foregroundOpacity", label: "Foreground Opacity", description: "Minimap foreground opacity", category: "Minimap" },
  { key: "minimap.selectionHighlight", label: "Selection Highlight", description: "Minimap selection highlight", category: "Minimap" },
  { key: "minimap.errorHighlight", label: "Error Highlight", description: "Minimap error highlight", category: "Minimap" },
  { key: "minimap.warningHighlight", label: "Warning Highlight", description: "Minimap warning highlight", category: "Minimap" },
  { key: "minimap.findMatchHighlight", label: "Find Match Highlight", description: "Minimap find match highlight", category: "Minimap" },
  { key: "minimapSlider.background", label: "Slider Background", description: "Minimap slider background", category: "Minimap" },
  { key: "minimapSlider.hoverBackground", label: "Slider Hover", description: "Minimap slider hover background", category: "Minimap" },
  { key: "minimapSlider.activeBackground", label: "Slider Active", description: "Minimap slider active background", category: "Minimap" },
  { key: "minimapGutter.addedBackground", label: "Gutter Added", description: "Minimap gutter added background", category: "Minimap" },
  { key: "minimapGutter.modifiedBackground", label: "Gutter Modified", description: "Minimap gutter modified background", category: "Minimap" },
  { key: "minimapGutter.deletedBackground", label: "Gutter Deleted", description: "Minimap gutter deleted background", category: "Minimap" },
  
  // Notification colors
  { key: "notifications.background", label: "Background", description: "Notifications background", category: "Notifications" },
  { key: "notifications.foreground", label: "Foreground", description: "Notifications foreground", category: "Notifications" },
  { key: "notifications.border", label: "Border", description: "Notifications border", category: "Notifications" },
  { key: "notificationLink.foreground", label: "Link Foreground", description: "Notification link foreground", category: "Notifications" },
  { key: "notificationCenterHeader.background", label: "Center Header Background", description: "Notification center header background", category: "Notifications" },
  { key: "notificationCenterHeader.foreground", label: "Center Header Foreground", description: "Notification center header foreground", category: "Notifications" },
  { key: "notificationCenter.border", label: "Center Border", description: "Notification center border", category: "Notifications" },
  { key: "notificationToast.border", label: "Toast Border", description: "Notification toast border", category: "Notifications" },
  { key: "notificationsErrorIcon.foreground", label: "Error Icon", description: "Error notification icon foreground", category: "Notifications" },
  { key: "notificationsWarningIcon.foreground", label: "Warning Icon", description: "Warning notification icon foreground", category: "Notifications" },
  { key: "notificationsInfoIcon.foreground", label: "Info Icon", description: "Info notification icon foreground", category: "Notifications" },
  
  // Breadcrumb colors
  { key: "breadcrumb.background", label: "Background", description: "Breadcrumb background", category: "Breadcrumbs" },
  { key: "breadcrumb.foreground", label: "Foreground", description: "Breadcrumb foreground", category: "Breadcrumbs" },
  { key: "breadcrumb.focusForeground", label: "Focus Foreground", description: "Focused breadcrumb foreground", category: "Breadcrumbs" },
  { key: "breadcrumb.activeSelectionForeground", label: "Active Selection", description: "Active breadcrumb foreground", category: "Breadcrumbs" },
  { key: "breadcrumbPicker.background", label: "Picker Background", description: "Breadcrumb picker background", category: "Breadcrumbs" },
  
  // Quick input colors
  { key: "quickInput.background", label: "Background", description: "Quick input background", category: "Quick Input" },
  { key: "quickInput.foreground", label: "Foreground", description: "Quick input foreground", category: "Quick Input" },
  { key: "quickInputTitle.background", label: "Title Background", description: "Quick input title background", category: "Quick Input" },
  { key: "quickInputList.focusBackground", label: "List Focus Background", description: "Focused item background", category: "Quick Input" },
  { key: "quickInputList.focusForeground", label: "List Focus Foreground", description: "Focused item foreground", category: "Quick Input" },
  { key: "quickInputList.focusIconForeground", label: "List Focus Icon", description: "Focused item icon foreground", category: "Quick Input" },
  
  // Widget colors
  { key: "editorWidget.background", label: "Background", description: "Widget background", category: "Widgets" },
  { key: "editorWidget.foreground", label: "Foreground", description: "Widget foreground", category: "Widgets" },
  { key: "editorWidget.border", label: "Border", description: "Widget border", category: "Widgets" },
  { key: "editorWidget.resizeBorder", label: "Resize Border", description: "Widget resize border", category: "Widgets" },
  { key: "editorSuggestWidget.background", label: "Suggest Background", description: "Suggest widget background", category: "Widgets" },
  { key: "editorSuggestWidget.foreground", label: "Suggest Foreground", description: "Suggest widget foreground", category: "Widgets" },
  { key: "editorSuggestWidget.border", label: "Suggest Border", description: "Suggest widget border", category: "Widgets" },
  { key: "editorSuggestWidget.selectedBackground", label: "Suggest Selected", description: "Selected suggestion background", category: "Widgets" },
  { key: "editorSuggestWidget.selectedForeground", label: "Suggest Selected Foreground", description: "Selected suggestion foreground", category: "Widgets" },
  { key: "editorSuggestWidget.highlightForeground", label: "Suggest Highlight", description: "Suggestion highlight foreground", category: "Widgets" },
  { key: "editorSuggestWidget.focusHighlightForeground", label: "Suggest Focus Highlight", description: "Focused suggestion highlight foreground", category: "Widgets" },
  { key: "editorHoverWidget.background", label: "Hover Background", description: "Hover widget background", category: "Widgets" },
  { key: "editorHoverWidget.foreground", label: "Hover Foreground", description: "Hover widget foreground", category: "Widgets" },
  { key: "editorHoverWidget.border", label: "Hover Border", description: "Hover widget border", category: "Widgets" },
  { key: "editorHoverWidget.statusBarBackground", label: "Hover Status Background", description: "Hover status bar background", category: "Widgets" },
  
  // Git decoration colors
  { key: "gitDecoration.addedResourceForeground", label: "Added", description: "Added file foreground", category: "Git" },
  { key: "gitDecoration.modifiedResourceForeground", label: "Modified", description: "Modified file foreground", category: "Git" },
  { key: "gitDecoration.deletedResourceForeground", label: "Deleted", description: "Deleted file foreground", category: "Git" },
  { key: "gitDecoration.renamedResourceForeground", label: "Renamed", description: "Renamed file foreground", category: "Git" },
  { key: "gitDecoration.untrackedResourceForeground", label: "Untracked", description: "Untracked file foreground", category: "Git" },
  { key: "gitDecoration.ignoredResourceForeground", label: "Ignored", description: "Ignored file foreground", category: "Git" },
  { key: "gitDecoration.conflictingResourceForeground", label: "Conflicting", description: "Conflicting file foreground", category: "Git" },
  { key: "gitDecoration.submoduleResourceForeground", label: "Submodule", description: "Submodule foreground", category: "Git" },
  { key: "gitDecoration.stageDeletedResourceForeground", label: "Staged Deleted", description: "Staged deleted file foreground", category: "Git" },
  { key: "gitDecoration.stageModifiedResourceForeground", label: "Staged Modified", description: "Staged modified file foreground", category: "Git" },
  
  // Focus border
  { key: "focusBorder", label: "Focus Border", description: "Overall border color for focused elements", category: "General" },
  { key: "foreground", label: "Foreground", description: "Overall foreground color", category: "General" },
  { key: "descriptionForeground", label: "Description Foreground", description: "Description foreground color", category: "General" },
  { key: "errorForeground", label: "Error Foreground", description: "Error foreground color", category: "General" },
  { key: "disabledForeground", label: "Disabled Foreground", description: "Disabled foreground color", category: "General" },
  { key: "icon.foreground", label: "Icon Foreground", description: "Default icon foreground", category: "General" },
  { key: "widget.shadow", label: "Widget Shadow", description: "Shadow color for widgets", category: "General" },
  { key: "selection.background", label: "Selection Background", description: "Background for selected text", category: "General" },
  { key: "sash.hoverBorder", label: "Sash Hover Border", description: "Hover border color for sashes", category: "General" },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse raw color customizations into structured format
 */
function parseColorCustomizations(raw: ThemeColorCustomizations): ParsedColorCustomizations {
  const result: ParsedColorCustomizations = {
    global: {},
    perTheme: {},
  };

  for (const [key, value] of Object.entries(raw)) {
    // Theme-specific customization: "[Theme Name]"
    if (key.startsWith("[") && key.endsWith("]")) {
      const themeName = key.slice(1, -1);
      if (typeof value === "object" && value !== null) {
        result.perTheme[themeName] = value as ColorCustomization;
      }
    } else if (typeof value === "string") {
      // Global customization
      result.global[key] = value;
    }
  }

  return result;
}

/**
 * Convert VS Code color key to CSS variable name
 */
function colorKeyToCSSVar(colorKey: string): string {
  // Convert "editor.background" to "--vscode-editor-background"
  return `--vscode-${colorKey.replace(/\./g, "-")}`;
}

/**
 * Validate hex color format
 */
function isValidColor(color: string): boolean {
  // Support hex colors with optional alpha
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

/**
 * Load customizations from storage
 */
function loadFromStorage(): ThemeColorCustomizations {
  if (typeof localStorage === "undefined") {
    return {};
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    return parsed as ThemeColorCustomizations;
  } catch (e) {
    console.error("[ColorCustomizations] Failed to load from storage:", e);
    return {};
  }
}

/**
 * Save customizations to storage
 */
function saveToStorage(customizations: ThemeColorCustomizations): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customizations));
  } catch (e) {
    console.error("[ColorCustomizations] Failed to save to storage:", e);
  }
}

// ============================================================================
// Context
// ============================================================================

const ColorCustomizationsContext = createContext<ColorCustomizationsContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function ColorCustomizationsProvider(props: ParentProps) {
  const [state, setState] = createStore<ColorCustomizationsState>({
    raw: loadFromStorage(),
    parsed: DEFAULT_PARSED,
    loading: false,
    error: null,
  });

  // Parse raw customizations on change
  createEffect(() => {
    const parsed = parseColorCustomizations(state.raw);
    setState("parsed", reconcile(parsed));
  });

  // Accessors
  const customizations = () => state.parsed;

  const getCustomizedColor = (colorKey: string, themeName: string): string | undefined => {
    const { parsed } = state;
    
    // Check theme-specific first
    const themeColors = parsed.perTheme[themeName];
    if (themeColors?.[colorKey]) {
      return themeColors[colorKey];
    }
    
    // Fall back to global
    return parsed.global[colorKey];
  };

  const hasCustomization = (colorKey: string, themeName: string): boolean => {
    return getCustomizedColor(colorKey, themeName) !== undefined;
  };

  // Mutation functions
  const setGlobalCustomization = async (colorKey: string, value: string): Promise<void> => {
    if (!isValidColor(value)) {
      console.warn(`[ColorCustomizations] Invalid color format: ${value}`);
      return;
    }

    const newRaw = { ...state.raw, [colorKey]: value };
    setState("raw", newRaw as ThemeColorCustomizations);
    saveToStorage(newRaw as ThemeColorCustomizations);

    window.dispatchEvent(new CustomEvent("color-customizations:changed", {
      detail: { colorKey, value, scope: "global" },
    }));
  };

  const setThemeCustomization = async (themeName: string, colorKey: string, value: string): Promise<void> => {
    if (!isValidColor(value)) {
      console.warn(`[ColorCustomizations] Invalid color format: ${value}`);
      return;
    }

    const themeKey = `[${themeName}]`;
    const existingTheme = (state.raw[themeKey] as ColorCustomization) || {};
    const newTheme = { ...existingTheme, [colorKey]: value };
    const newRaw = { ...state.raw, [themeKey]: newTheme };
    
    setState("raw", newRaw);
    saveToStorage(newRaw);

    window.dispatchEvent(new CustomEvent("color-customizations:changed", {
      detail: { colorKey, value, scope: "theme", themeName },
    }));
  };

  const removeGlobalCustomization = async (colorKey: string): Promise<void> => {
    const newRaw = { ...state.raw };
    delete newRaw[colorKey];
    
    setState("raw", newRaw);
    saveToStorage(newRaw);

    window.dispatchEvent(new CustomEvent("color-customizations:removed", {
      detail: { colorKey, scope: "global" },
    }));
  };

  const removeThemeCustomization = async (themeName: string, colorKey: string): Promise<void> => {
    const themeKey = `[${themeName}]`;
    const existingTheme = (state.raw[themeKey] as ColorCustomization) || {};
    
    const newTheme = { ...existingTheme };
    delete newTheme[colorKey];
    
    const newRaw = { ...state.raw };
    if (Object.keys(newTheme).length === 0) {
      delete newRaw[themeKey];
    } else {
      newRaw[themeKey] = newTheme;
    }
    
    setState("raw", newRaw);
    saveToStorage(newRaw);

    window.dispatchEvent(new CustomEvent("color-customizations:removed", {
      detail: { colorKey, scope: "theme", themeName },
    }));
  };

  const resetAllCustomizations = async (): Promise<void> => {
    setState("raw", {});
    saveToStorage({});
    
    window.dispatchEvent(new CustomEvent("color-customizations:reset"));
  };

  const resetThemeCustomizations = async (themeName: string): Promise<void> => {
    const themeKey = `[${themeName}]`;
    const newRaw = { ...state.raw };
    delete newRaw[themeKey];
    
    setState("raw", newRaw);
    saveToStorage(newRaw);

    window.dispatchEvent(new CustomEvent("color-customizations:theme-reset", {
      detail: { themeName },
    }));
  };

  const applyToCSS = (themeName: string): void => {
    const { parsed } = state;
    const root = document.documentElement;

    // Build effective colors (global + theme-specific)
    const effectiveColors: ColorCustomization = {
      ...parsed.global,
      ...(parsed.perTheme[themeName] || {}),
    };

    // Apply to CSS variables
    requestAnimationFrame(() => {
      for (const [colorKey, value] of Object.entries(effectiveColors)) {
        const cssVar = colorKeyToCSSVar(colorKey);
        root.style.setProperty(cssVar, value);
      }
    });
  };

  const exportCustomizations = (): string => {
    return JSON.stringify(state.raw, null, 2);
  };

  const importCustomizations = async (json: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(json);
      
      if (typeof parsed !== "object" || parsed === null) {
        console.error("[ColorCustomizations] Invalid import format");
        return false;
      }

      // Validate all color values
      const validated: Record<string, string | ColorCustomization> = {};
      
      for (const [key, value] of Object.entries(parsed)) {
        if (key.startsWith("[") && key.endsWith("]")) {
          // Theme-specific
          if (typeof value === "object" && value !== null) {
            const themeColors: ColorCustomization = {};
            for (const [colorKey, colorValue] of Object.entries(value as Record<string, unknown>)) {
              if (typeof colorValue === "string" && isValidColor(colorValue)) {
                themeColors[colorKey] = colorValue;
              }
            }
            if (Object.keys(themeColors).length > 0) {
              validated[key] = themeColors;
            }
          }
        } else if (typeof value === "string" && isValidColor(value)) {
          // Global
          validated[key] = value;
        }
      }

      setState("raw", validated as ThemeColorCustomizations);
      saveToStorage(validated as ThemeColorCustomizations);

      window.dispatchEvent(new CustomEvent("color-customizations:imported"));
      return true;
    } catch (e) {
      console.error("[ColorCustomizations] Failed to import:", e);
      return false;
    }
  };

  const getColorKeys = (): ColorKeyInfo[] => COLOR_KEYS;

  const customizationCount = (): number => {
    const { parsed } = state;
    let count = Object.keys(parsed.global).length;
    
    for (const colors of Object.values(parsed.perTheme)) {
      count += Object.keys(colors).length;
    }
    
    return count;
  };

  const globalCustomizationCount = (): number => {
    return Object.keys(state.parsed.global).length;
  };

  const themeCustomizationCount = (themeName: string): number => {
    return Object.keys(state.parsed.perTheme[themeName] || {}).length;
  };

  // Listen for theme changes to auto-apply customizations
  createEffect(() => {
    const handleThemeChange = (e: CustomEvent<{ theme: string }>) => {
      applyToCSS(e.detail.theme);
    };

    window.addEventListener("theme:changed", handleThemeChange as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("theme:changed", handleThemeChange as EventListener);
    });
  });

  const value: ColorCustomizationsContextValue = {
    state,
    customizations,
    getCustomizedColor,
    hasCustomization,
    setGlobalCustomization,
    setThemeCustomization,
    removeGlobalCustomization,
    removeThemeCustomization,
    resetAllCustomizations,
    resetThemeCustomizations,
    applyToCSS,
    exportCustomizations,
    importCustomizations,
    getColorKeys,
    customizationCount,
    globalCustomizationCount,
    themeCustomizationCount,
  };

  return (
    <ColorCustomizationsContext.Provider value={value}>
      {props.children}
    </ColorCustomizationsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useColorCustomizations(): ColorCustomizationsContextValue {
  const ctx = useContext(ColorCustomizationsContext);
  if (!ctx) {
    throw new Error("useColorCustomizations must be used within ColorCustomizationsProvider");
  }
  return ctx;
}

// ============================================================================
// Exports
// ============================================================================

export { COLOR_KEYS, colorKeyToCSSVar, isValidColor };

import type { CortexTheme, VSCodeThemeJSON } from "@/utils/theme-converter";

// ============================================================================
// Theme Type
// ============================================================================

export type Theme = "dark" | "light" | "system" | "high-contrast" | "high-contrast-light";

// ============================================================================
// Plugin Theme Contribution
// ============================================================================

export interface PluginThemeContribution {
  id: string;
  name: string;
  type: "dark" | "light" | "hc" | "hcLight";
  colors: Record<string, string>;
  tokenColors?: Array<{ scope?: string | string[]; settings: Record<string, string> }>;
}

// ============================================================================
// UI Theme Colors
// ============================================================================

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  foreground: string;
  foregroundMuted: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  borderActive: string;
}

// ============================================================================
// Editor Colors (Monaco/Code Editor)
// ============================================================================

export interface EditorColors {
  editorBackground: string;
  editorForeground: string;
  editorLineHighlight: string;
  editorSelectionBackground: string;
  editorSelectionForeground: string;
  editorCursor: string;
  editorWhitespace: string;
  editorIndentGuide: string;
  editorIndentGuideActive: string;
  editorLineNumber: string;
  editorLineNumberActive: string;
  editorRuler: string;
  editorGutter: string;
  editorFoldBackground: string;
}

// ============================================================================
// Syntax Highlighting Colors
// ============================================================================

export interface SyntaxColors {
  comment: string;
  string: string;
  number: string;
  keyword: string;
  operator: string;
  function: string;
  variable: string;
  type: string;
  class: string;
  constant: string;
  parameter: string;
  property: string;
  punctuation: string;
  tag: string;
  attribute: string;
  regexp: string;
  escape: string;
  invalid: string;
}

// ============================================================================
// Terminal Colors
// ============================================================================

export interface TerminalColors {
  terminalBackground: string;
  terminalForeground: string;
  terminalCursor: string;
  terminalCursorAccent: string;
  terminalSelection: string;
  terminalBlack: string;
  terminalRed: string;
  terminalGreen: string;
  terminalYellow: string;
  terminalBlue: string;
  terminalMagenta: string;
  terminalCyan: string;
  terminalWhite: string;
  terminalBrightBlack: string;
  terminalBrightRed: string;
  terminalBrightGreen: string;
  terminalBrightYellow: string;
  terminalBrightBlue: string;
  terminalBrightMagenta: string;
  terminalBrightCyan: string;
  terminalBrightWhite: string;
}

// ============================================================================
// Complete Color Customization Interface
// ============================================================================

export interface ColorCustomizations {
  ui: Partial<ThemeColors>;
  editor: Partial<EditorColors>;
  syntax: Partial<SyntaxColors>;
  terminal: Partial<TerminalColors>;
}

// ============================================================================
// Color Token Categories for UI
// ============================================================================

export type ColorToken = 
  | keyof ThemeColors 
  | keyof EditorColors 
  | keyof SyntaxColors 
  | keyof TerminalColors;

export type ColorCategory = "ui" | "editor" | "syntax" | "terminal";

// ============================================================================
// Color Token Metadata
// ============================================================================

export interface ColorTokenInfo {
  key: string;
  label: string;
  description: string;
}

// ============================================================================
// Default Empty Customizations
// ============================================================================

export const DEFAULT_CUSTOMIZATIONS: ColorCustomizations = {
  ui: {},
  editor: {},
  syntax: {},
  terminal: {},
};

// ============================================================================
// Storage Keys
// ============================================================================

export const STORAGE_KEY_CUSTOMIZATIONS = "cortex-color-customizations";

// ============================================================================
// Context Value Interface
// ============================================================================

export interface ThemeContextValue {
  // Base theme
  theme: () => Theme;
  setTheme: (theme: Theme) => void;
  isDark: () => boolean;

  // Theme preview
  previewTheme: () => Theme | null;
  isPreviewActive: () => boolean;
  startPreview: (theme: Theme) => void;
  stopPreview: () => void;
  applyPreviewedTheme: () => void;

  // Effective theme (considers preview state)
  effectiveTheme: () => Theme;

  // UI Colors (with customizations applied)
  colors: () => ThemeColors;

  // All color categories (with customizations applied)
  editorColors: () => EditorColors;
  syntaxColors: () => SyntaxColors;
  terminalColors: () => TerminalColors;

  // Color customizations
  colorCustomizations: () => ColorCustomizations;
  setColorCustomization: <C extends ColorCategory>(
    category: C,
    token: string,
    color: string
  ) => void;
  removeColorCustomization: <C extends ColorCategory>(
    category: C,
    token: string
  ) => void;
  resetCustomizations: () => void;
  resetCategoryCustomizations: (category: ColorCategory) => void;

  // Import/Export
  exportCustomizations: () => string;
  importCustomizations: (json: string) => boolean;

  // Default colors for reference
  getDefaultColors: () => {
    ui: ThemeColors;
    editor: EditorColors;
    syntax: SyntaxColors;
    terminal: TerminalColors;
  };

  // Check if a color has been customized
  hasCustomization: (category: ColorCategory, token: string) => boolean;

  // Get count of customizations
  customizationCount: () => number;

  // VS Code extension theme support
  activeVSCodeTheme: () => CortexTheme | null;
  applyVSCodeExtensionTheme: (themePath: string) => Promise<void>;
  applyVSCodeExtensionThemeFromJSON: (json: VSCodeThemeJSON, name?: string) => void;
  clearVSCodeExtensionTheme: () => void;
  applyVSCodeThemeToMonaco: (monaco: typeof import("monaco-editor")) => void;
  syncMonacoTheme: (monaco: typeof import("monaco-editor")) => void;

  // Plugin-contributed themes
  registerPluginTheme: (theme: PluginThemeContribution) => void;
  pluginThemes: () => PluginThemeContribution[];
  applyPluginTheme: (id: string) => void;

  // Built-in themes
  builtInThemes: () => Array<{id: string; name: string; type: string}>;
  applyBuiltInTheme: (themeId: string) => Promise<void>;
  loadCortexThemeFromJSON: (json: string) => boolean;

  // File icon theme
  fileIconThemeId: () => string;
  setFileIconThemeId: (id: string) => void;

  // Product icon theme
  productIconThemeId: () => string;
  setProductIconThemeId: (id: string) => void;

  // Backend theme loading
  loadBackendTheme: (path: string) => Promise<void>;
  listBackendThemes: () => Promise<ThemeListItem[]>;
}

// ============================================================================
// Backend Theme Types
// ============================================================================

export interface ThemeListItem {
  id: string;
  name: string;
  themeType: string;
  source: "builtin" | "plugin" | "custom" | "vscode";
}

export interface BackendThemeData {
  id: string;
  name: string;
  themeType: string;
  colors: Record<string, string>;
  tokenColors: Array<{ scope?: string[]; settings: Record<string, string> }>;
  source: "builtin" | "plugin" | "custom" | "vscode";
}

// ============================================================================
// File Icon Theme State
// ============================================================================

export interface FileIconThemeState {
  activeThemeId: string;
  availableThemes: string[];
}

// ============================================================================
// Product Icon Theme State
// ============================================================================

export interface ProductIconThemeState {
  activeThemeId: string;
  availableThemes: string[];
}

// ============================================================================
// Component-Specific Color Overrides
// ============================================================================

export interface ComponentColorOverrides {
  activityBar?: Partial<Record<string, string>>;
  statusBar?: Partial<Record<string, string>>;
  titleBar?: Partial<Record<string, string>>;
  sidebar?: Partial<Record<string, string>>;
}

import type { ThemeColors, EditorColors, SyntaxColors, TerminalColors } from "./types";

const kebabCaseCache = new Map<string, string>();

function toKebabCase(key: string): string {
  let cached = kebabCaseCache.get(key);
  if (!cached) {
    cached = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    kebabCaseCache.set(key, cached);
  }
  return cached;
}

export function applyCssVariables(
  uiColors: ThemeColors,
  edColors: EditorColors,
  synColors: SyntaxColors,
  termColors: TerminalColors,
): void {
  const root = document.documentElement;

  for (const [key, value] of Object.entries(uiColors)) {
    root.style.setProperty(`--color-${toKebabCase(key)}`, value);
  }

  for (const [key, value] of Object.entries(edColors)) {
    root.style.setProperty(`--color-${toKebabCase(key)}`, value);
  }

  for (const [key, value] of Object.entries(synColors)) {
    root.style.setProperty(`--syntax-${key}`, value);
  }

  for (const [key, value] of Object.entries(termColors)) {
    root.style.setProperty(`--color-${toKebabCase(key)}`, value);
  }

  // Backgrounds
  root.style.setProperty("--cortex-bg-base", uiColors.background);
  root.style.setProperty("--cortex-bg-elevated", uiColors.backgroundSecondary);
  root.style.setProperty("--cortex-bg-overlay", uiColors.backgroundTertiary);
  root.style.setProperty("--background-base", uiColors.background);
  root.style.setProperty("--background-stronger", uiColors.backgroundSecondary);
  root.style.setProperty("--background-elevated", uiColors.backgroundTertiary);

  // Surfaces
  root.style.setProperty("--cortex-surface-base", uiColors.backgroundSecondary);
  root.style.setProperty("--cortex-surface-raised", uiColors.backgroundSecondary);
  root.style.setProperty("--cortex-surface-hover", uiColors.backgroundTertiary);
  root.style.setProperty("--cortex-surface-active", uiColors.borderActive);
  root.style.setProperty("--surface-base", uiColors.backgroundSecondary);
  root.style.setProperty("--surface-raised", uiColors.backgroundSecondary);
  root.style.setProperty("--surface-raised-hover", uiColors.backgroundTertiary);
  root.style.setProperty("--surface-active", uiColors.borderActive);

  // Borders
  root.style.setProperty("--cortex-border-base", uiColors.border);
  root.style.setProperty("--cortex-border-subtle", uiColors.border);
  root.style.setProperty("--cortex-border-focus", uiColors.primary);
  root.style.setProperty("--border-base", uiColors.border);
  root.style.setProperty("--border-weak", uiColors.border);
  root.style.setProperty("--border-subtle", uiColors.border);
  root.style.setProperty("--border-focused", uiColors.primary);

  // Text
  root.style.setProperty("--cortex-text-primary", uiColors.foreground);
  root.style.setProperty("--cortex-text-secondary", uiColors.foreground);
  root.style.setProperty("--cortex-text-muted", uiColors.foregroundMuted);
  root.style.setProperty("--cortex-text-disabled", uiColors.foregroundMuted);
  root.style.setProperty("--text-strong", uiColors.foreground);
  root.style.setProperty("--text-base", uiColors.foreground);
  root.style.setProperty("--text-weak", uiColors.foregroundMuted);
  root.style.setProperty("--text-weaker", uiColors.foregroundMuted);

  // Accent colors
  root.style.setProperty("--cortex-accent", uiColors.primary);
  root.style.setProperty("--cortex-accent-hover", uiColors.primaryHover);
  root.style.setProperty("--accent", uiColors.accent);

  // Status colors
  root.style.setProperty("--cortex-success", uiColors.success);
  root.style.setProperty("--cortex-warning", uiColors.warning);
  root.style.setProperty("--cortex-error", uiColors.error);
  root.style.setProperty("--cortex-info", uiColors.info);

  // Editor specific
  root.style.setProperty("--vscode-editor-background", edColors.editorBackground);
  root.style.setProperty("--vscode-editor-foreground", edColors.editorForeground);
  root.style.setProperty("--vscode-editorLineNumber-foreground", edColors.editorLineNumber);
  root.style.setProperty("--vscode-editorLineNumber-activeForeground", edColors.editorLineNumberActive);
  root.style.setProperty("--vscode-editor-selectionBackground", edColors.editorSelectionBackground);
  root.style.setProperty("--vscode-editorCursor-foreground", edColors.editorCursor);

  // Panel/sidebar
  root.style.setProperty("--vscode-sideBar-background", uiColors.background);
  root.style.setProperty("--vscode-sideBar-foreground", uiColors.foreground);
  root.style.setProperty("--vscode-sideBarTitle-foreground", uiColors.foreground);
  root.style.setProperty("--vscode-panel-background", uiColors.background);
  root.style.setProperty("--vscode-panel-border", uiColors.border);

  // Activity bar
  root.style.setProperty("--vscode-activityBar-background", uiColors.background);
  root.style.setProperty("--vscode-activityBar-foreground", uiColors.foregroundMuted);
  root.style.setProperty("--vscode-activityBar-activeBorder", uiColors.primary);

  // Title bar
  root.style.setProperty("--vscode-titleBar-activeBackground", uiColors.background);
  root.style.setProperty("--vscode-titleBar-activeForeground", uiColors.foreground);

  // Status bar
  root.style.setProperty("--vscode-statusBar-background", uiColors.background);
  root.style.setProperty("--vscode-statusBar-foreground", uiColors.foregroundMuted);

  // List/tree
  root.style.setProperty("--vscode-list-activeSelectionBackground", uiColors.borderActive);
  root.style.setProperty("--vscode-list-activeSelectionForeground", uiColors.foreground);
  root.style.setProperty("--vscode-list-hoverBackground", uiColors.backgroundTertiary);
  root.style.setProperty("--vscode-list-hoverForeground", uiColors.foreground);

  // Tabs
  root.style.setProperty("--vscode-tab-activeBackground", uiColors.backgroundSecondary);
  root.style.setProperty("--vscode-tab-activeForeground", uiColors.foreground);
  root.style.setProperty("--vscode-tab-inactiveBackground", uiColors.background);
  root.style.setProperty("--vscode-tab-inactiveForeground", uiColors.foregroundMuted);
  root.style.setProperty("--vscode-editorGroupHeader-tabsBackground", uiColors.background);

  // Terminal
  root.style.setProperty("--vscode-terminal-background", termColors.terminalBackground);
  root.style.setProperty("--vscode-terminal-foreground", termColors.terminalForeground);
  root.style.setProperty("--vscode-terminalCursor-foreground", termColors.terminalCursor);
  root.style.setProperty("--vscode-terminalCursor-background", termColors.terminalCursorAccent);
  root.style.setProperty("--vscode-terminal-selectionBackground", termColors.terminalSelection);
  // ANSI colors
  root.style.setProperty("--vscode-terminal-ansiBlack", termColors.terminalBlack);
  root.style.setProperty("--vscode-terminal-ansiRed", termColors.terminalRed);
  root.style.setProperty("--vscode-terminal-ansiGreen", termColors.terminalGreen);
  root.style.setProperty("--vscode-terminal-ansiYellow", termColors.terminalYellow);
  root.style.setProperty("--vscode-terminal-ansiBlue", termColors.terminalBlue);
  root.style.setProperty("--vscode-terminal-ansiMagenta", termColors.terminalMagenta);
  root.style.setProperty("--vscode-terminal-ansiCyan", termColors.terminalCyan);
  root.style.setProperty("--vscode-terminal-ansiWhite", termColors.terminalWhite);
  // Bright ANSI colors
  root.style.setProperty("--vscode-terminal-ansiBrightBlack", termColors.terminalBrightBlack);
  root.style.setProperty("--vscode-terminal-ansiBrightRed", termColors.terminalBrightRed);
  root.style.setProperty("--vscode-terminal-ansiBrightGreen", termColors.terminalBrightGreen);
  root.style.setProperty("--vscode-terminal-ansiBrightYellow", termColors.terminalBrightYellow);
  root.style.setProperty("--vscode-terminal-ansiBrightBlue", termColors.terminalBrightBlue);
  root.style.setProperty("--vscode-terminal-ansiBrightMagenta", termColors.terminalBrightMagenta);
  root.style.setProperty("--vscode-terminal-ansiBrightCyan", termColors.terminalBrightCyan);
  root.style.setProperty("--vscode-terminal-ansiBrightWhite", termColors.terminalBrightWhite);
}

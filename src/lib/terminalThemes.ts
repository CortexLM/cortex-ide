/**
 * Terminal Color Scheme Definitions
 * 
 * Each theme defines ANSI colors for xterm terminal rendering.
 * These themes are similar to VS Code's built-in terminal themes.
 */

import type { ITheme } from "@xterm/xterm";

/** Terminal theme identifier */
export type TerminalColorScheme = 
  | "default-dark"
  | "default-light"
  | "solarized-dark"
  | "solarized-light"
  | "monokai"
  | "one-dark"
  | "dracula";

/** Terminal theme definition with metadata */
export interface TerminalThemeDefinition {
  id: TerminalColorScheme;
  name: string;
  description: string;
  theme: ITheme;
}

/**
 * Default Dark Theme
 * A balanced dark theme with comfortable contrast
 * Background matches card background (#18181a)
 */
const defaultDarkTheme: ITheme = {
  background: "#18181a",
  foreground: "#cccccc",
  cursor: "#ffffff",
  cursorAccent: "#18181a",
  selectionBackground: "rgba(255, 255, 255, 0.3)",
  selectionForeground: undefined,
  // Standard ANSI colors
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  // Bright ANSI colors
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#ffffff",
};

/**
 * Default Light Theme
 * A clean light theme for daytime use
 */
const defaultLightTheme: ITheme = {
  background: "#ffffff",
  foreground: "#333333",
  cursor: "#000000",
  cursorAccent: "#ffffff",
  selectionBackground: "rgba(0, 0, 0, 0.2)",
  selectionForeground: undefined,
  // Standard ANSI colors
  black: "#000000",
  red: "#cd3131",
  green: "#00bc00",
  yellow: "#949800",
  blue: "#0451a5",
  magenta: "#bc05bc",
  cyan: "#0598bc",
  white: "#555555",
  // Bright ANSI colors
  brightBlack: "#666666",
  brightRed: "#cd3131",
  brightGreen: "#14ce14",
  brightYellow: "#b5ba00",
  brightBlue: "#0451a5",
  brightMagenta: "#bc05bc",
  brightCyan: "#0598bc",
  brightWhite: "#a5a5a5",
};

/**
 * Solarized Dark Theme
 * Popular dark theme with reduced eye strain
 */
const solarizedDarkTheme: ITheme = {
  background: "#002b36",
  foreground: "#839496",
  cursor: "#839496",
  cursorAccent: "#002b36",
  selectionBackground: "#073642",
  selectionForeground: undefined,
  // Standard ANSI colors (Solarized base)
  black: "#073642",
  red: "#dc322f",
  green: "#859900",
  yellow: "#b58900",
  blue: "#268bd2",
  magenta: "#d33682",
  cyan: "#2aa198",
  white: "#eee8d5",
  // Bright ANSI colors
  brightBlack: "#002b36",
  brightRed: "#cb4b16",
  brightGreen: "#586e75",
  brightYellow: "#657b83",
  brightBlue: "#839496",
  brightMagenta: "#6c71c4",
  brightCyan: "#93a1a1",
  brightWhite: "#fdf6e3",
};

/**
 * Solarized Light Theme
 * Light variant of the popular Solarized theme
 */
const solarizedLightTheme: ITheme = {
  background: "#fdf6e3",
  foreground: "#657b83",
  cursor: "#657b83",
  cursorAccent: "#fdf6e3",
  selectionBackground: "#eee8d5",
  selectionForeground: undefined,
  // Standard ANSI colors (Solarized base)
  black: "#073642",
  red: "#dc322f",
  green: "#859900",
  yellow: "#b58900",
  blue: "#268bd2",
  magenta: "#d33682",
  cyan: "#2aa198",
  white: "#eee8d5",
  // Bright ANSI colors
  brightBlack: "#002b36",
  brightRed: "#cb4b16",
  brightGreen: "#586e75",
  brightYellow: "#657b83",
  brightBlue: "#839496",
  brightMagenta: "#6c71c4",
  brightCyan: "#93a1a1",
  brightWhite: "#fdf6e3",
};

/**
 * Monokai Theme
 * Vibrant theme with bold colors
 */
const monokaiTheme: ITheme = {
  background: "#272822",
  foreground: "#f8f8f2",
  cursor: "#f8f8f0",
  cursorAccent: "#272822",
  selectionBackground: "rgba(73, 72, 62, 0.8)",
  selectionForeground: undefined,
  // Standard ANSI colors
  black: "#272822",
  red: "#f92672",
  green: "#a6e22e",
  yellow: "#f4bf75",
  blue: "#66d9ef",
  magenta: "#ae81ff",
  cyan: "#a1efe4",
  white: "#f8f8f2",
  // Bright ANSI colors
  brightBlack: "#75715e",
  brightRed: "#f92672",
  brightGreen: "#a6e22e",
  brightYellow: "#f4bf75",
  brightBlue: "#66d9ef",
  brightMagenta: "#ae81ff",
  brightCyan: "#a1efe4",
  brightWhite: "#f9f8f5",
};

/**
 * One Dark Theme
 * Based on Atom's popular One Dark theme
 */
const oneDarkTheme: ITheme = {
  background: "#282c34",
  foreground: "#abb2bf",
  cursor: "#528bff",
  cursorAccent: "#282c34",
  selectionBackground: "rgba(62, 68, 81, 0.8)",
  selectionForeground: undefined,
  // Standard ANSI colors
  black: "#282c34",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#abb2bf",
  // Bright ANSI colors
  brightBlack: "#5c6370",
  brightRed: "#e06c75",
  brightGreen: "#98c379",
  brightYellow: "#e5c07b",
  brightBlue: "#61afef",
  brightMagenta: "#c678dd",
  brightCyan: "#56b6c2",
  brightWhite: "#ffffff",
};

/**
 * Dracula Theme
 * A dark theme with vibrant colors
 */
const draculaTheme: ITheme = {
  background: "#282a36",
  foreground: "#f8f8f2",
  cursor: "#f8f8f2",
  cursorAccent: "#282a36",
  selectionBackground: "rgba(68, 71, 90, 0.8)",
  selectionForeground: undefined,
  // Standard ANSI colors
  black: "#21222c",
  red: "#ff5555",
  green: "#50fa7b",
  yellow: "#f1fa8c",
  blue: "#bd93f9",
  magenta: "#ff79c6",
  cyan: "#8be9fd",
  white: "#f8f8f2",
  // Bright ANSI colors
  brightBlack: "#6272a4",
  brightRed: "#ff6e6e",
  brightGreen: "#69ff94",
  brightYellow: "#ffffa5",
  brightBlue: "#d6acff",
  brightMagenta: "#ff92df",
  brightCyan: "#a4ffff",
  brightWhite: "#ffffff",
};

/**
 * All available terminal themes
 */
export const TERMINAL_THEMES: TerminalThemeDefinition[] = [
  {
    id: "default-dark",
    name: "Default Dark",
    description: "A balanced dark theme with comfortable contrast",
    theme: defaultDarkTheme,
  },
  {
    id: "default-light",
    name: "Default Light",
    description: "A clean light theme for daytime use",
    theme: defaultLightTheme,
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    description: "Popular dark theme with reduced eye strain",
    theme: solarizedDarkTheme,
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    description: "Light variant of the popular Solarized theme",
    theme: solarizedLightTheme,
  },
  {
    id: "monokai",
    name: "Monokai",
    description: "Vibrant theme with bold colors",
    theme: monokaiTheme,
  },
  {
    id: "one-dark",
    name: "One Dark",
    description: "Based on Atom's popular One Dark theme",
    theme: oneDarkTheme,
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "A dark theme with vibrant colors",
    theme: draculaTheme,
  },
];

/**
 * Get a terminal theme by its ID
 * @param id - The theme identifier
 * @returns The xterm ITheme object, or default dark if not found
 */
export function getTerminalTheme(id: TerminalColorScheme | string): ITheme {
  const themeDef = TERMINAL_THEMES.find((t) => t.id === id);
  return themeDef?.theme ?? defaultDarkTheme;
}

/**
 * Get theme definition by ID
 * @param id - The theme identifier
 * @returns The full theme definition, or default dark if not found
 */
export function getTerminalThemeDefinition(id: TerminalColorScheme | string): TerminalThemeDefinition {
  const themeDef = TERMINAL_THEMES.find((t) => t.id === id);
  return themeDef ?? TERMINAL_THEMES[0];
}

/**
 * Default terminal color scheme
 */
export const DEFAULT_TERMINAL_COLOR_SCHEME: TerminalColorScheme = "default-dark";

/**
 * Create a terminal theme from VS Code CSS variables
 * This allows the terminal to match the current IDE theme
 * @returns ITheme object with colors from CSS variables
 */
export function getTerminalThemeFromCSS(): ITheme {
  const getVar = (name: string, fallback: string): string => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  };

  return {
    // Main colors - use VS Code terminal variables with fallbacks to card background (#18181a)
    background: getVar('--vscode-terminal-background', getVar('--vscode-editor-background', '#18181a')),
    foreground: getVar('--vscode-terminal-foreground', getVar('--vscode-editor-foreground', '#cccccc')),
    cursor: getVar('--vscode-terminalCursor-foreground', '#ffffff'),
    cursorAccent: getVar('--vscode-terminalCursor-background', '#18181a'),
    selectionBackground: getVar('--vscode-terminal-selectionBackground', 'rgba(255, 255, 255, 0.3)'),
    selectionForeground: getVar('--vscode-terminal-selectionForeground', ''),
    // ANSI colors - use VS Code's terminal ANSI color variables
    black: getVar('--vscode-terminal-ansiBlack', '#000000'),
    red: getVar('--vscode-terminal-ansiRed', '#cd3131'),
    green: getVar('--vscode-terminal-ansiGreen', '#0dbc79'),
    yellow: getVar('--vscode-terminal-ansiYellow', '#e5e510'),
    blue: getVar('--vscode-terminal-ansiBlue', '#2472c8'),
    magenta: getVar('--vscode-terminal-ansiMagenta', '#bc3fbc'),
    cyan: getVar('--vscode-terminal-ansiCyan', '#11a8cd'),
    white: getVar('--vscode-terminal-ansiWhite', '#e5e5e5'),
    // Bright ANSI colors
    brightBlack: getVar('--vscode-terminal-ansiBrightBlack', '#666666'),
    brightRed: getVar('--vscode-terminal-ansiBrightRed', '#f14c4c'),
    brightGreen: getVar('--vscode-terminal-ansiBrightGreen', '#23d18b'),
    brightYellow: getVar('--vscode-terminal-ansiBrightYellow', '#f5f543'),
    brightBlue: getVar('--vscode-terminal-ansiBrightBlue', '#3b8eea'),
    brightMagenta: getVar('--vscode-terminal-ansiBrightMagenta', '#d670d6'),
    brightCyan: getVar('--vscode-terminal-ansiBrightCyan', '#29b8db'),
    brightWhite: getVar('--vscode-terminal-ansiBrightWhite', '#ffffff'),
  };
}

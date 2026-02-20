import {
  createContext,
  useContext,
  ParentProps,
  createEffect,
  onMount,
  onCleanup,
  Accessor,
  createMemo,
  batch,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// ============================================================================
// Settings Type Definitions
// ============================================================================

/** Unicode highlight settings */
export interface UnicodeHighlightSettings {
  enabled: boolean;
  invisibleCharacters: boolean;
  ambiguousCharacters: boolean;
  nonBasicASCII: boolean;
  includeComments: boolean | "inUntrustedWorkspace";
  includeStrings: boolean | "inUntrustedWorkspace";
  allowedCharacters: Record<string, boolean>;
  allowedLocales: Record<string, boolean>;
}

/** Inlay hints settings */
export interface InlayHintsSettings {
  /** Enable inlay hints */
  enabled: boolean;
  /** Font size for inlay hints (in pixels). Use 0 to inherit from editor */
  fontSize: number;
  /** Font family for inlay hints. Empty string inherits from editor */
  fontFamily: string;
  /** Show type hints for variables */
  showTypes: boolean;
  /** Show parameter name hints in function calls */
  showParameterNames: boolean;
  /** Show return type hints */
  showReturnTypes: boolean;
  /** Maximum length of inlay hint text before truncation */
  maxLength: number;
  /** Padding around inlay hints */
  padding: boolean;
}

/** Editor settings */
export interface EditorSettings {
  fontFamily: string;
  fontSize: number;
  fontLigatures: boolean;
  lineHeight: number;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: "off" | "on" | "wordWrapColumn" | "bounded";
  wordWrapColumn: number;
  lineNumbers: "on" | "off" | "relative" | "interval";
  minimapEnabled: boolean;
  minimapWidth: number;
  bracketPairColorization: boolean;
  autoClosingBrackets: "always" | "languageDefined" | "beforeWhitespace" | "never";
  autoIndent: boolean;
  formatOnSave: boolean;
  formatOnPaste: boolean;
  formatOnType: boolean;
  formatOnTypeTriggerCharacters: string[];
  cursorStyle: "line" | "block" | "underline" | "line-thin" | "block-outline" | "underline-thin";
  cursorBlink: "blink" | "smooth" | "phase" | "expand" | "solid";
  renderWhitespace: "none" | "boundary" | "selection" | "trailing" | "all";
  scrollBeyondLastLine: boolean;
  smoothScrolling: boolean;
  mouseWheelZoom: boolean;
  linkedEditing: boolean;
  renameOnType: boolean;
  stickyScrollEnabled: boolean;
  foldingEnabled: boolean;
  showFoldingControls: "always" | "mouseover" | "never";
  guidesIndentation: boolean;
  guidesBracketPairs: boolean;
  highlightActiveIndentGuide: boolean;
  unicodeHighlight: UnicodeHighlightSettings;
  enablePreview: boolean;
  renderControlCharacters: boolean;
  dropIntoEditor: { enabled: boolean; showDropSelector: "afterDrop" | "never" };
  /** Large file optimizations */
  largeFileOptimizations?: boolean;
  /** Max tokenization line length */
  maxTokenizationLineLength?: number;
  /** Maximum lines for sticky scroll */
  stickyScrollMaxLines?: number;
  /** Enable vertical tabs layout */
  verticalTabs: boolean;
  /** Inlay hints configuration */
  inlayHints: InlayHintsSettings;
  /** Code Lens configuration */
  codeLens: CodeLensSettings;
  /** Semantic highlighting configuration */
  semanticHighlighting: SemanticHighlightingSettings;
}

/** Semantic highlighting settings for LSP-based token coloring */
export interface SemanticHighlightingSettings {
  /** Enable semantic highlighting from LSP */
  enabled: boolean;
  /** Show semantic tokens for strings (can be verbose in some languages) */
  strings: boolean;
  /** Show semantic tokens for comments */
  comments: boolean;
}

/** Code Lens display settings */
export interface CodeLensSettings {
  /** Enable Code Lens feature */
  enabled: boolean;
  /** Font family for Code Lens text */
  fontFamily: string;
  /** Font size for Code Lens text in pixels */
  fontSize: number;
  /** Show reference counts above functions/classes */
  showReferences: boolean;
  /** Show implementation counts for interfaces */
  showImplementations: boolean;
  /** Show run/debug actions for test functions */
  showTestActions: boolean;
}

/** Activity bar location type alias */
export type ActivityBarLocation = "side" | "top" | "hidden";

/** Menu bar visibility type alias */
export type MenuBarVisibility = "classic" | "compact" | "toggle" | "hidden";

/** Panel position type alias */
export type PanelPosition = "bottom" | "left" | "right";

/** Panel alignment type alias */
export type PanelAlignment = "center" | "left" | "right" | "justify";

/** Title bar style type alias */
export type TitleBarStyle = "native" | "custom";

/** Breadcrumbs file path display mode */
export type BreadcrumbsFilePath = "on" | "off" | "last";

/** Breadcrumbs symbol path display mode */
export type BreadcrumbsSymbolPath = "on" | "off" | "last";

/** Breadcrumbs display settings */
export interface BreadcrumbsSettings {
  /** Enable breadcrumbs navigation */
  enabled: boolean;
  /** File path display mode: on = full path, off = hidden, last = only filename */
  filePath: BreadcrumbsFilePath;
  /** Symbol path display mode: on = full hierarchy, off = hidden, last = only current symbol */
  symbolPath: BreadcrumbsSymbolPath;
  /** Show file type and symbol icons */
  icons: boolean;
}

/** Theme settings */
export interface ThemeSettings {
  theme: "dark" | "light" | "system" | "high-contrast" | "high-contrast-light";
  iconTheme: string;
  accentColor: string;
  uiFontFamily: string;
  uiFontSize: number;
  zoomLevel: number;
  sidebarPosition: "left" | "right";
  activityBarVisible: boolean;
  activityBarPosition: ActivityBarLocation;
  statusBarVisible: boolean;
  tabBarVisible: boolean;
  breadcrumbsEnabled: boolean;
  /** Detailed breadcrumbs configuration */
  breadcrumbs: BreadcrumbsSettings;
  wrapTabs: boolean;
  menuBarVisibility: MenuBarVisibility;
  panelPosition: PanelPosition;
  panelAlignment: PanelAlignment;
  /** Title bar style: native uses OS decorations, custom renders a VS Code-style title bar */
  titleBarStyle: TitleBarStyle;
  /** Show command center (search bar) in title bar */
  commandCenterEnabled: boolean;
  /** Auxiliary bar (secondary sidebar) visibility */
  auxiliaryBarVisible: boolean;
}

/** Terminal decoration settings for command status indicators */
export interface TerminalDecorationSettings {
  /** Enable command status decorations in gutter */
  enabled: boolean;
  /** Show command duration in tooltip */
  showDuration: boolean;
  /** Show exit code in tooltip */
  showExitCode: boolean;
}

/** Image scaling mode for terminal images */
export type TerminalImageScaling = "auto" | "fit" | "fill" | "none";

/** Terminal image settings for inline image support (iTerm2/Sixel/Kitty protocols) */
export interface TerminalImageSettings {
  /** Enable inline image rendering */
  enabled: boolean;
  /** Maximum single image size in bytes */
  maxImageSize: number;
  /** Maximum total memory for images in bytes */
  maxTotalMemory: number;
  /** Maximum number of images to keep in memory */
  maxImages: number;
  /** Image scaling mode */
  imageScaling: TerminalImageScaling;
  /** Enable iTerm2 inline images protocol */
  enableITerm2: boolean;
  /** Enable Sixel graphics protocol */
  enableSixel: boolean;
  /** Enable Kitty graphics protocol */
  enableKitty: boolean;
}

/** Terminal auto-reply settings for automated responses to prompts */
export interface TerminalAutoReplySettings {
  /** Enable auto-reply feature */
  enabled: boolean;
  /** Show notification when auto-reply triggers */
  showNotification: boolean;
  /** Default delay before sending reply (ms) */
  defaultDelay: number;
}

/** Terminal settings */
export interface TerminalSettings {
  shellPath: string;
  shellArgs: string[];
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  cursorStyle: "block" | "underline" | "bar";
  cursorBlink: boolean;
  scrollback: number;
  copyOnSelection: boolean;
  env: Record<string, string>;
  cwd: string;
  integratedGpu: boolean;
  colorScheme: string;
  wordSeparators: string;
  bell: "none" | "audible" | "visual";
  /** Enable accessible view mode with screen reader support */
  accessibleViewEnabled: boolean;
  /** Announce command completions and output to screen readers */
  screenReaderAnnounce: boolean;
  /** Command status decorations in gutter */
  decorations: TerminalDecorationSettings;
  /** Inline image settings (iTerm2/Sixel/Kitty protocols) */
  images: TerminalImageSettings;
  /** Auto-reply settings for automated responses to terminal prompts */
  autoReply: TerminalAutoReplySettings;
}

/** AI settings */
export interface AISettings {
  supermavenEnabled: boolean;
  supermavenApiKey: string;
  copilotEnabled: boolean;
  inlineSuggestEnabled: boolean;
  inlineSuggestShowToolbar: boolean;
  defaultProvider: string;
  defaultModel: string;
}

/** Security settings */
export interface SecuritySettings {
  sandboxMode: "workspace_write" | "directory_only" | "read_only";
  approvalMode: "auto" | "ask_edit" | "ask_all";
  networkAccess: boolean;
  trustedWorkspaces: string[];
  telemetryEnabled: boolean;
  crashReportsEnabled: boolean;
}

/** Search settings */
export interface SearchSettings {
  exclude: Record<string, boolean>;
  useIgnoreFiles: boolean;
  useGlobalIgnoreFiles: boolean;
  followSymlinks: boolean;
  contextLines: number;
  /** Show line numbers in search results */
  showLineNumbers: boolean;
}

/** JavaScript debug settings */
export interface JavaScriptDebugSettings {
  autoAttachFilter: "disabled" | "always" | "smart" | "onlyWithFlag";
}

/** Variable visualizer settings for the debugger */
export interface VariableVisualizerSettings {
  /** Enable custom variable visualizers */
  enabled: boolean;
  /** Number of bytes per row in hex viewer */
  hexBytesPerRow: number;
  /** Page size for array pagination */
  arrayPageSize: number;
}

/** Debug settings */
export interface DebugSettings {
  toolbarLocation: "floating" | "docked" | "commandCenter" | "hidden";
  javascript: JavaScriptDebugSettings;
  openDebugOnSessionStart: boolean;
  closeReadonlyTabsOnEnd: boolean;
  focusWindowOnBreak: boolean;
  focusEditorOnBreak: boolean;
  showInlineBreakpointCandidates: boolean;
  variableVisualizers: VariableVisualizerSettings;
}

/** Git settings */
export interface GitSettings {
  enabled: boolean;
  autofetch: boolean;
  autofetchPeriod: number;
  confirmSync: boolean;
  enableSmartCommit: boolean;
  pruneOnFetch: boolean;
  fetchTags: boolean;
  followTagsWhenSync: boolean;
  postCommitCommand: "none" | "push" | "sync";
  defaultCloneDirectory: string;
  branchSortOrder: "alphabetically" | "committerDate";
  rebaseWhenSync: boolean;
}

/** HTTP settings */
export interface HttpSettings {
  proxy: string;
  proxyStrictSSL: boolean;
  proxyAuthorization: string | null;
  proxySupport: "off" | "on" | "fallback";
}

/** SSH authentication method type */
export type SSHAuthMethod = "password" | "key" | "agent";

/** Saved SSH connection profile */
export interface SSHConnectionProfile {
  /** Unique profile identifier */
  id: string;
  /** Display name for this connection */
  name: string;
  /** Remote host address */
  host: string;
  /** SSH port (default: 22) */
  port: number;
  /** Username for authentication */
  username: string;
  /** Authentication method */
  authMethod: SSHAuthMethod;
  /** Path to private key file (for key auth) */
  privateKeyPath?: string;
  /** Whether the key requires a passphrase */
  usePassphrase?: boolean;
  /** Default working directory on remote */
  remoteWorkingDirectory?: string;
  /** Custom environment variables */
  env?: Record<string, string>;
}

/** SSH settings */
export interface SSHSettings {
  /** Default username for SSH connections */
  defaultUsername: string;
  /** Default SSH port */
  defaultPort: number;
  /** Path to SSH config file (e.g., ~/.ssh/config) */
  configFilePath: string;
  /** Default path to private key */
  defaultKeyPath: string;
  /** Connection timeout in seconds */
  connectionTimeout: number;
  /** Keep-alive interval in seconds (0 to disable) */
  keepAliveInterval: number;
  /** Default authentication method */
  defaultAuthMethod: SSHAuthMethod;
  /** Use SSH agent for authentication */
  useAgent: boolean;
  /** Saved connection profiles */
  savedProfiles: SSHConnectionProfile[];
  /** Auto-reconnect on connection drop */
  autoReconnect: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts: number;
  /** Reconnection delay in seconds */
  reconnectDelay: number;
  /** Enable compression */
  compression: boolean;
  /** Terminal type to request (e.g., "xterm-256color") */
  terminalType: string;
}

/** Files settings */
export interface FilesSettings {
  autoSave: "off" | "afterDelay" | "onFocusChange" | "onWindowChange";
  autoSaveDelay: number;
  hotExit: "off" | "onExit" | "onExitAndWindowClose";
  defaultLanguage: string;
  trimTrailingWhitespace: boolean;
  insertFinalNewline: boolean;
  trimFinalNewlines: boolean;
  exclude: Record<string, boolean>;
  watchExclude: Record<string, boolean>;
  encoding: string;
  eol: "auto" | "\n" | "\r\n";
  confirmDragAndDrop: boolean;
  confirmDelete: boolean;
  enableTrash: boolean;
  maxMemoryForLargeFilesMB: number;
  /** File associations - maps glob patterns to Monaco language IDs */
  associations: Record<string, string>;
}

/** File nesting patterns */
export interface FileNestingPatterns {
  [pattern: string]: string;
}

/** File nesting settings */
export interface FileNestingSettings {
  enabled: boolean;
  patterns: FileNestingPatterns;
}

/** Explorer sort order */
export type ExplorerSortOrder = "default" | "mixed" | "filesFirst" | "type" | "modified";

/** Explorer settings */
export interface ExplorerSettings {
  compactFolders: boolean;
  fileNesting: FileNestingSettings;
  indentGuidesEnabled: boolean;
  sortOrder: ExplorerSortOrder;
}

/** Zen Mode settings */
export interface ZenModeSettings {
  hideSidebar: boolean;
  hideStatusBar: boolean;
  hideMenuBar: boolean;
  hidePanel: boolean;
  centerLayout: boolean;
  maxWidth: string;
  fullScreen: boolean;
  showLineNumbers: boolean;
  silenceNotifications: boolean;
  
  // NEW - Additional settings
  /** Hide editor line numbers in Zen Mode */
  hideLineNumbers: boolean;
  /** Hide the tab bar in Zen Mode */
  hideTabs: boolean;
  /** Hide the activity bar in Zen Mode */
  hideActivityBar: boolean;
  /** Restore window state when exiting Zen Mode */
  restore: boolean;
}

/** Centered Editor Layout settings (independent of Zen Mode) */
export interface CenteredLayoutSettings {
  /** Whether centered layout is enabled */
  enabled: boolean;
  /** Maximum editor width in pixels (default 1200px) */
  maxWidth: number;
  /** Auto-adjust width based on viewport */
  autoResize: boolean;
  /** Ratio of side margins (0-0.4) */
  sideMarginRatio: number;
}

/** Screencast Mode settings */
export interface ScreencastModeSettings {
  enabled: boolean;
  showKeys: boolean;
  showMouse: boolean;
  showCommands: boolean;
  fontSize: number;
  duration: number;
}

/** Command Palette / Quick Access settings */
export interface CommandPaletteSettings {
  /** Number of history items to remember per provider (default 50, max 200) */
  historyLength: number;
  /** Preserve input when reopening the palette */
  preserveInput: boolean;
}

/** Extension settings */
export interface ExtensionSettingsMap {
  [extensionId: string]: Record<string, unknown>;
}

/** Language-specific editor override */
export interface LanguageEditorOverride {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  tabSize?: number;
  insertSpaces?: boolean;
  wordWrap?: "off" | "on" | "wordWrapColumn" | "bounded";
  lineNumbers?: "on" | "off" | "relative" | "interval";
  minimapEnabled?: boolean;
  bracketPairColorization?: boolean;
  autoClosingBrackets?: "always" | "languageDefined" | "beforeWhitespace" | "never";
  autoIndent?: boolean;
  formatOnSave?: boolean;
  formatOnPaste?: boolean;
  cursorStyle?: "line" | "block" | "underline" | "line-thin" | "block-outline" | "underline-thin";
  renderWhitespace?: "none" | "boundary" | "selection" | "trailing" | "all";
  guidesIndentation?: boolean;
  guidesBracketPairs?: boolean;
  foldingEnabled?: boolean;
  stickyScrollEnabled?: boolean;
  linkedEditing?: boolean;
  verticalTabs?: boolean;
  inlayHints?: Partial<InlayHintsSettings>;
}

export type LanguageOverridesMap = Record<string, LanguageEditorOverride>;

/** Tab sizing mode for workbench editor */
export type TabSizingMode = "fit" | "shrink" | "fixed";

/** Tab close button visibility */
export type TabCloseButtonVisibility = "always" | "onHover" | "never";

/** Tab close button position */
export type TabCloseButtonPosition = "left" | "right";

/** Workbench editor settings for tab behavior */
export interface WorkbenchEditorSettings {
  /** Tab sizing mode: 'fit' = minimum space needed, 'shrink' = shrink to fit with min width, 'fixed' = all same width */
  tabSizing: TabSizingMode;
  /** Minimum width for tabs in shrink mode (pixels) */
  tabSizingFixedMinWidth: number;
  /** Fixed width for tabs in fixed mode (pixels) */
  tabSizingFixedWidth: number;
  /** Whether to wrap tabs to multiple rows */
  wrapTabs: boolean;
  /** When to show the tab close button */
  showTabCloseButton: TabCloseButtonVisibility;
  /** Position of the tab close button */
  tabCloseButtonPosition: TabCloseButtonPosition;
  /** Centered editor layout settings (independent of Zen Mode) */
  centeredLayout: CenteredLayoutSettings;
}

/** Workbench settings container */
export interface WorkbenchSettings {
  editor: WorkbenchEditorSettings;
}

/** Main settings interface */
export interface CortexSettings {
  version: number;
  editor: EditorSettings;
  theme: ThemeSettings;
  terminal: TerminalSettings;
  ai: AISettings;
  security: SecuritySettings;
  files: FilesSettings;
  explorer: ExplorerSettings;
  zenMode: ZenModeSettings;
  screencastMode: ScreencastModeSettings;
  extensions: ExtensionSettingsMap;
  vimEnabled: boolean;
  languageOverrides: LanguageOverridesMap;
  debug: DebugSettings;
  search: SearchSettings;
  git: GitSettings;
  http: HttpSettings;
  commandPalette: CommandPaletteSettings;
  /** Workbench settings (tabs, layout, etc.) */
  workbench: WorkbenchSettings;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_UNICODE_HIGHLIGHT: UnicodeHighlightSettings = {
  enabled: true,
  invisibleCharacters: true,
  ambiguousCharacters: true,
  nonBasicASCII: false,
  includeComments: "inUntrustedWorkspace",
  includeStrings: true,
  allowedCharacters: {},
  allowedLocales: { _os: true, _vscode: true },
};

const DEFAULT_INLAY_HINTS: InlayHintsSettings = {
  enabled: true,
  fontSize: 0,
  fontFamily: "",
  showTypes: true,
  showParameterNames: true,
  showReturnTypes: true,
  maxLength: 25,
  padding: true,
};

const DEFAULT_CODE_LENS: CodeLensSettings = {
  enabled: true,
  fontFamily: "",
  fontSize: 12,
  showReferences: true,
  showImplementations: true,
  showTestActions: true,
};

const DEFAULT_SEMANTIC_HIGHLIGHTING: SemanticHighlightingSettings = {
  enabled: true,
  strings: true,
  comments: true,
};

const DEFAULT_EDITOR: EditorSettings = {
  fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
  fontSize: 14,
  fontLigatures: true,
  lineHeight: 1.5,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: "off",
  wordWrapColumn: 80,
  lineNumbers: "on",
  minimapEnabled: true,
  minimapWidth: 100,
  bracketPairColorization: true,
  autoClosingBrackets: "always",
  autoIndent: true,
  formatOnSave: false,
  formatOnPaste: false,
  formatOnType: false,
  formatOnTypeTriggerCharacters: [";", "}", "\n"],
  cursorStyle: "line",
  cursorBlink: "blink",
  renderWhitespace: "selection",
  scrollBeyondLastLine: true,
  smoothScrolling: true,
  mouseWheelZoom: false,
  linkedEditing: true,
  renameOnType: false,
  stickyScrollEnabled: false,
  foldingEnabled: true,
  showFoldingControls: "mouseover",
  guidesIndentation: true,
  guidesBracketPairs: true,
  highlightActiveIndentGuide: true,
  unicodeHighlight: DEFAULT_UNICODE_HIGHLIGHT,
  enablePreview: true,
  renderControlCharacters: false,
  dropIntoEditor: { enabled: true, showDropSelector: "afterDrop" },
  verticalTabs: false,
  inlayHints: DEFAULT_INLAY_HINTS,
  codeLens: DEFAULT_CODE_LENS,
  semanticHighlighting: DEFAULT_SEMANTIC_HIGHLIGHTING,
};

const DEFAULT_BREADCRUMBS: BreadcrumbsSettings = {
  enabled: true,
  filePath: "on",
  symbolPath: "on",
  icons: true,
};

const DEFAULT_THEME: ThemeSettings = {
  theme: "dark",
  iconTheme: "default",
  accentColor: "#6366f1",
  uiFontFamily: "Inter, system-ui, sans-serif",
  uiFontSize: 13,
  zoomLevel: 1.0,
  sidebarPosition: "left",
  activityBarVisible: true,
  activityBarPosition: "top",
  statusBarVisible: true,
  tabBarVisible: true,
  breadcrumbsEnabled: true,
  breadcrumbs: DEFAULT_BREADCRUMBS,
  wrapTabs: false,
  menuBarVisibility: "classic",
  panelPosition: "bottom",
  panelAlignment: "center",
  commandCenterEnabled: true,
  titleBarStyle: "custom",
  auxiliaryBarVisible: false,
};

const DEFAULT_TERMINAL: TerminalSettings = {
  shellPath: "",
  shellArgs: [],
  fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
  fontSize: 14,
  lineHeight: 1.2,
  cursorStyle: "block",
  cursorBlink: true,
  scrollback: 10000,
  copyOnSelection: false,
  env: {},
  cwd: "",
  integratedGpu: true,
  colorScheme: "default-dark",
  wordSeparators: " ()[]{}',\"`─",
  bell: "none",
  accessibleViewEnabled: false,
  screenReaderAnnounce: true,
  decorations: {
    enabled: true,
    showDuration: true,
    showExitCode: true,
  },
  images: {
    enabled: true,
    maxImageSize: 10 * 1024 * 1024, // 10MB per image
    maxTotalMemory: 100 * 1024 * 1024, // 100MB total
    maxImages: 50,
    imageScaling: "auto",
    enableITerm2: true,
    enableSixel: true,
    enableKitty: true,
  },
  autoReply: {
    enabled: false, // Disabled by default for safety
    showNotification: true,
    defaultDelay: 100,
  },
};

const DEFAULT_AI: AISettings = {
  supermavenEnabled: false,
  supermavenApiKey: "",
  copilotEnabled: false,
  inlineSuggestEnabled: true,
  inlineSuggestShowToolbar: true,
  defaultProvider: "anthropic",
  defaultModel: "claude-sonnet-4-20250514",
};

const DEFAULT_SECURITY: SecuritySettings = {
  sandboxMode: "workspace_write",
  approvalMode: "auto",
  networkAccess: true,
  trustedWorkspaces: [],
  telemetryEnabled: false,
  crashReportsEnabled: false,
};

const DEFAULT_SEARCH: SearchSettings = {
  exclude: {
    "**/node_modules": true,
    "**/bower_components": true,
    "**/*.code-search": true,
  },
  useIgnoreFiles: true,
  useGlobalIgnoreFiles: true,
  followSymlinks: true,
  contextLines: 2,
  showLineNumbers: true,
};

const DEFAULT_VARIABLE_VISUALIZERS: VariableVisualizerSettings = {
  enabled: true,
  hexBytesPerRow: 16,
  arrayPageSize: 50,
};

const DEFAULT_DEBUG: DebugSettings = {
  toolbarLocation: "floating",
  javascript: { autoAttachFilter: "disabled" },
  openDebugOnSessionStart: true,
  closeReadonlyTabsOnEnd: false,
  focusWindowOnBreak: true,
  focusEditorOnBreak: true,
  showInlineBreakpointCandidates: true,
  variableVisualizers: DEFAULT_VARIABLE_VISUALIZERS,
};

const DEFAULT_GIT: GitSettings = {
  enabled: true,
  autofetch: true,
  autofetchPeriod: 180,
  confirmSync: true,
  enableSmartCommit: true,
  pruneOnFetch: false,
  fetchTags: true,
  followTagsWhenSync: false,
  postCommitCommand: "none",
  defaultCloneDirectory: "",
  branchSortOrder: "committerDate",
  rebaseWhenSync: false,
};

const DEFAULT_HTTP: HttpSettings = {
  proxy: "",
  proxyStrictSSL: true,
  proxyAuthorization: null,
  proxySupport: "off",
};

const DEFAULT_FILES: FilesSettings = {
  autoSave: "off",
  autoSaveDelay: 1000,
  hotExit: "onExit",
  defaultLanguage: "",
  trimTrailingWhitespace: false,
  insertFinalNewline: false,
  trimFinalNewlines: false,
  exclude: {
    "**/.git": true,
    "**/.svn": true,
    "**/.hg": true,
    "**/CVS": true,
    "**/.DS_Store": true,
    "**/node_modules": true,
  },
  watchExclude: {
    "**/.git/objects/**": true,
    "**/node_modules/**": true,
  },
  encoding: "utf8",
  eol: "auto",
  confirmDragAndDrop: true,
  confirmDelete: true,
  enableTrash: true,
  maxMemoryForLargeFilesMB: 4096,
  associations: {},
};

const DEFAULT_FILE_NESTING: FileNestingPatterns = {
  "*.ts": "${basename}.js, ${basename}.d.ts",
  "package.json": "package-lock.json, yarn.lock, pnpm-lock.yaml",
  "tsconfig.json": "tsconfig.*.json",
};

const DEFAULT_EXPLORER: ExplorerSettings = {
  compactFolders: true,
  fileNesting: { enabled: true, patterns: DEFAULT_FILE_NESTING },
  indentGuidesEnabled: true,
  sortOrder: "default",
};

const DEFAULT_ZEN_MODE: ZenModeSettings = {
  hideSidebar: true,
  hideStatusBar: true,
  hideMenuBar: true,
  hidePanel: true,
  centerLayout: true,
  maxWidth: "900px",
  fullScreen: false,
  showLineNumbers: true,
  silenceNotifications: true,
  // New settings
  hideLineNumbers: false,
  hideTabs: false,
  hideActivityBar: true,
  restore: true,
};

const DEFAULT_CENTERED_LAYOUT: CenteredLayoutSettings = {
  enabled: false,
  maxWidth: 1200,
  autoResize: true,
  sideMarginRatio: 0.15,
};

const DEFAULT_SCREENCAST_MODE: ScreencastModeSettings = {
  enabled: false,
  showKeys: true,
  showMouse: true,
  showCommands: true,
  fontSize: 24,
  duration: 2000,
};

export const DEFAULT_COMMAND_PALETTE: CommandPaletteSettings = {
  historyLength: 50,
  preserveInput: false,
};

export const DEFAULT_WORKBENCH_EDITOR: WorkbenchEditorSettings = {
  tabSizing: "fit",
  tabSizingFixedMinWidth: 80,
  tabSizingFixedWidth: 120,
  wrapTabs: false,
  showTabCloseButton: "onHover",
  tabCloseButtonPosition: "right",
  centeredLayout: DEFAULT_CENTERED_LAYOUT,
};

export const DEFAULT_WORKBENCH: WorkbenchSettings = {
  editor: DEFAULT_WORKBENCH_EDITOR,
};

export const DEFAULT_SETTINGS: CortexSettings = {
  version: 1,
  editor: DEFAULT_EDITOR,
  theme: DEFAULT_THEME,
  terminal: DEFAULT_TERMINAL,
  ai: DEFAULT_AI,
  security: DEFAULT_SECURITY,
  files: DEFAULT_FILES,
  explorer: DEFAULT_EXPLORER,
  zenMode: DEFAULT_ZEN_MODE,
  screencastMode: DEFAULT_SCREENCAST_MODE,
  extensions: {},
  vimEnabled: false,
  languageOverrides: {},
  debug: DEFAULT_DEBUG,
  search: DEFAULT_SEARCH,
  git: DEFAULT_GIT,
  http: DEFAULT_HTTP,
  commandPalette: DEFAULT_COMMAND_PALETTE,
  workbench: DEFAULT_WORKBENCH,
};

// ============================================================================
// Workspace Types
// ============================================================================

export type PartialCortexSettings = {
  [K in keyof CortexSettings]?: K extends "extensions" | "languageOverrides"
    ? CortexSettings[K]
    : Partial<CortexSettings[K]>;
};

export type SettingSource = "user" | "workspace" | "folder" | "default";
export type SettingsScope = "user" | "workspace" | "folder";

export interface SettingsState {
  settings: CortexSettings;
  loading: boolean;
  saving: boolean;
  error: string | null;
  settingsPath: string;
  isDirty: boolean;
  lastSaved: number | null;
}

export interface WorkspaceSettingsState {
  userSettings: CortexSettings;
  workspaceSettings: PartialCortexSettings;
  folderSettings: Record<string, PartialCortexSettings>;
  workspacePath: string | null;
  workspaceSettingsPath: string | null;
  userSettingsPath: string;
  loading: boolean;
  savingUser: boolean;
  savingWorkspace: boolean;
  savingFolder: boolean;
  error: string | null;
  lastSaved: number | null;
}

// ============================================================================
// Context Interface
// ============================================================================

export interface SettingsContextValue {
  state: SettingsState;
  settings: Accessor<CortexSettings>;
  userSettings: Accessor<CortexSettings>;
  workspaceSettings: Accessor<PartialCortexSettings>;
  effectiveSettings: Accessor<CortexSettings>;
  workspacePath: Accessor<string | null>;
  hasWorkspace: Accessor<boolean>;
  folderSettings: Accessor<Record<string, PartialCortexSettings>>;

  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  updateSettings: <K extends keyof CortexSettings>(section: K, value: CortexSettings[K]) => Promise<void>;
  updateEditorSetting: <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => Promise<void>;
  updateInlayHintsSetting: <K extends keyof InlayHintsSettings>(key: K, value: InlayHintsSettings[K]) => Promise<void>;
  updateCodeLensSetting: <K extends keyof CodeLensSettings>(key: K, value: CodeLensSettings[K]) => Promise<void>;
  updateThemeSetting: <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => Promise<void>;
  updateTerminalSetting: <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => Promise<void>;
  updateAISetting: <K extends keyof AISettings>(key: K, value: AISettings[K]) => Promise<void>;
  updateSecuritySetting: <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => Promise<void>;
  updateFilesSetting: <K extends keyof FilesSettings>(key: K, value: FilesSettings[K]) => Promise<void>;
  updateExplorerSetting: <K extends keyof ExplorerSettings>(key: K, value: ExplorerSettings[K]) => Promise<void>;
  updateZenModeSetting: <K extends keyof ZenModeSettings>(key: K, value: ZenModeSettings[K]) => Promise<void>;
  updateScreencastModeSetting: <K extends keyof ScreencastModeSettings>(key: K, value: ScreencastModeSettings[K]) => Promise<void>;
  updateSearchSetting: <K extends keyof SearchSettings>(key: K, value: SearchSettings[K]) => Promise<void>;
  updateDebugSetting: <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]) => Promise<void>;
  updateGitSetting: <K extends keyof GitSettings>(key: K, value: GitSettings[K]) => Promise<void>;
updateHttpSetting: <K extends keyof HttpSettings>(key: K, value: HttpSettings[K]) => Promise<void>;
  updateCommandPaletteSetting: <K extends keyof CommandPaletteSettings>(key: K, value: CommandPaletteSettings[K]) => Promise<void>;
  updateWorkbenchEditorSetting: <K extends keyof WorkbenchEditorSettings>(key: K, value: WorkbenchEditorSettings[K]) => Promise<void>;
  updateCenteredLayoutSetting: <K extends keyof CenteredLayoutSettings>(key: K, value: CenteredLayoutSettings[K]) => Promise<void>;
  resetSettings: () => Promise<void>;
  resetSection: (section: keyof CortexSettings) => Promise<void>;
  exportSettings: () => Promise<string>;
  importSettings: (json: string) => Promise<void>;
  getExtensionSettings: (extensionId: string) => Record<string, unknown>;
  setExtensionSettings: (extensionId: string, settings: Record<string, unknown>) => Promise<void>;
  getSettingsPath: () => Promise<string>;

  loadWorkspaceSettings: (workspacePath: string) => Promise<void>;
  clearWorkspaceSettings: () => void;
  setWorkspaceSetting: <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K, value: CortexSettings[S][K]) => Promise<void>;
  resetWorkspaceSetting: <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K) => Promise<void>;
  getSettingSource: <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K) => SettingSource;
  hasWorkspaceOverride: <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K) => boolean;
  saveWorkspaceSettings: () => Promise<void>;

  isSettingModified: <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K) => boolean;
  getModifiedCountForSection: (section: keyof CortexSettings) => number;
  getAllModifiedSettings: () => Array<{ section: keyof CortexSettings; key: string; currentValue: unknown; defaultValue: unknown }>;
  resetSettingToDefault: <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K) => Promise<void>;
  getDefaultValue: <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K) => CortexSettings[S][K];

  loadFolderSettings: (folderPath: string) => Promise<void>;
  saveFolderSettings: (folderPath: string, settings: PartialCortexSettings) => Promise<void>;
  getEffectiveSettingsForPath: (filePath: string) => CortexSettings;
  setFolderSetting: <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(folderPath: string, section: S, key: K, value: CortexSettings[S][K]) => Promise<void>;
  resetFolderSetting: <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(folderPath: string, section: S, key: K) => Promise<void>;
  hasFolderOverride: <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(folderPath: string, section: S, key: K) => boolean;
  clearFolderSettings: (folderPath: string) => void;

  getEditorMonacoOptions: () => Record<string, unknown>;
  getEffectiveEditorSettings: (language: string) => EditorSettings;
  getLanguageOverride: (language: string) => LanguageEditorOverride | undefined;
  setLanguageOverride: (language: string, overrides: LanguageEditorOverride) => Promise<void>;
  resetLanguageOverride: (language: string) => Promise<void>;

  // File associations
  getFileAssociations: () => Record<string, string>;
  setFileAssociation: (pattern: string, languageId: string) => Promise<void>;
  removeFileAssociation: (pattern: string) => Promise<void>;
  getLanguageForFile: (filename: string) => string | undefined;
}

const SettingsContext = createContext<SettingsContextValue>();

// ============================================================================
// Utilities
// ============================================================================

/**
 * Deep merge two objects with proper type safety.
 * Source values override target values, with recursive merging for nested objects.
 * @param target - The base object to merge into
 * @param source - The object with values to merge (can be partial or PartialCortexSettings)
 * @returns A new merged object of type T
 */
function deepMerge<T extends object>(target: T, source: Partial<T> | PartialCortexSettings): T {
  const result = { ...target };
  const sourceRecord = source as Record<string, unknown>;
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = sourceRecord[key];
      const targetValue = target[key as keyof T];
      
      // Recursively merge nested objects (excluding arrays)
      if (
        sourceValue !== null &&
        sourceValue !== undefined &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        targetValue !== undefined &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue as object,
          sourceValue as Partial<typeof targetValue>
        );
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }
  
  return result;
}

function matchGlobPattern(filename: string, pattern: string): boolean {
  const regex = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\?/g, ".") + "$", "i");
  return regex.test(filename);
}

// ============================================================================
// Provider
// ============================================================================

export function SettingsProvider(props: ParentProps) {
  const [state, setState] = createStore<SettingsState>({
    settings: DEFAULT_SETTINGS,
    loading: true,
    saving: false,
    error: null,
    settingsPath: "",
    isDirty: false,
    lastSaved: null,
  });

  const [wsState, setWsState] = createStore<WorkspaceSettingsState>({
    userSettings: DEFAULT_SETTINGS,
    workspaceSettings: {},
    folderSettings: {},
    workspacePath: null,
    workspaceSettingsPath: null,
    userSettingsPath: "",
    loading: true,
    savingUser: false,
    savingWorkspace: false,
    savingFolder: false,
    error: null,
    lastSaved: null,
  });

  const effectiveSettings = createMemo(() => deepMerge(wsState.userSettings, wsState.workspaceSettings));

  createEffect(() => {
    setState("settings", reconcile(effectiveSettings()));
  });

  const userSettingsAccessor = () => wsState.userSettings;
  const workspaceSettingsAccessor = () => wsState.workspaceSettings;
  const folderSettingsAccessor = () => wsState.folderSettings;
  const workspacePathAccessor = () => wsState.workspacePath;
  const hasWorkspaceAccessor = () => wsState.workspacePath !== null;

  const loadSettings = async () => {
    batch(() => {
      setState("loading", true);
      setWsState("loading", true);
    });
    try {
      const loaded = await invoke<CortexSettings>("settings_load");
      // Validate loaded settings have required structure, fallback to defaults for missing sections
      const validated: CortexSettings = {
        ...DEFAULT_SETTINGS,
        ...loaded,
        // Ensure nested objects have defaults merged properly
        editor: { ...DEFAULT_SETTINGS.editor, ...loaded?.editor },
        theme: { ...DEFAULT_SETTINGS.theme, ...loaded?.theme },
        terminal: { ...DEFAULT_SETTINGS.terminal, ...loaded?.terminal },
        ai: { ...DEFAULT_SETTINGS.ai, ...loaded?.ai },
        security: { ...DEFAULT_SETTINGS.security, ...loaded?.security },
        files: { ...DEFAULT_SETTINGS.files, ...loaded?.files },
        explorer: { ...DEFAULT_SETTINGS.explorer, ...loaded?.explorer },
        zenMode: { ...DEFAULT_SETTINGS.zenMode, ...loaded?.zenMode },
        screencastMode: { ...DEFAULT_SETTINGS.screencastMode, ...loaded?.screencastMode },
        search: { ...DEFAULT_SETTINGS.search, ...loaded?.search },
        debug: { ...DEFAULT_SETTINGS.debug, ...loaded?.debug },
        git: { ...DEFAULT_SETTINGS.git, ...loaded?.git },
        http: { ...DEFAULT_SETTINGS.http, ...loaded?.http },
        commandPalette: { ...DEFAULT_SETTINGS.commandPalette, ...loaded?.commandPalette },
        workbench: { ...DEFAULT_SETTINGS.workbench, ...loaded?.workbench, editor: { ...DEFAULT_SETTINGS.workbench.editor, ...loaded?.workbench?.editor } },
      };
      batch(() => {
        setWsState("userSettings", reconcile(validated));
        setState("isDirty", false);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[SettingsContext] Failed to load settings, using defaults:", msg);
      batch(() => {
        setState("error", msg);
        setWsState("error", msg);
        // Fall back to default settings when loading fails (e.g., corrupted config file)
        setWsState("userSettings", reconcile({ ...DEFAULT_SETTINGS }));
      });
    } finally {
      batch(() => {
        setState("loading", false);
        setWsState("loading", false);
      });
    }
  };

  const loadWorkspaceSettings = async (workspacePath: string) => {
    batch(() => {
      setWsState("workspacePath", workspacePath);
    });
    try {
      // Get the actual settings path (prefers .vscode over .cortex)
      const settingsPath = await invoke<string>("settings_get_workspace_path", { workspacePath });
      setWsState("workspaceSettingsPath", settingsPath);
      
      // Load workspace settings using the new backend command
      const ws = await invoke<PartialCortexSettings>("settings_get_workspace", { workspacePath });
      setWsState("workspaceSettings", reconcile(ws));
    } catch (err) {
      console.warn("Failed to load workspace settings:", err);
      setWsState("workspaceSettings", {});
      setWsState("workspaceSettingsPath", `${workspacePath}/.vscode/settings.json`);
    }
    window.dispatchEvent(new CustomEvent("settings:workspace-loaded", { detail: { workspacePath } }));
  };

  const clearWorkspaceSettings = () => {
    batch(() => {
      setWsState("workspacePath", null);
      setWsState("workspaceSettingsPath", null);
      setWsState("workspaceSettings", {});
    });
    window.dispatchEvent(new CustomEvent("settings:workspace-cleared"));
  };

  const saveSettings = async () => {
    batch(() => {
      setState("saving", true);
      setWsState("savingUser", true);
    });
    try {
      await invoke("settings_save", { settings: wsState.userSettings });
      const now = Date.now();
      batch(() => {
        setState("isDirty", false);
        setState("lastSaved", now);
        setWsState("lastSaved", now);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      batch(() => {
        setState("error", msg);
        setWsState("error", msg);
      });
    } finally {
      batch(() => {
        setState("saving", false);
        setWsState("savingUser", false);
      });
    }
  };

  const saveWorkspaceSettings = async () => {
    if (!wsState.workspacePath) return;
    setWsState("savingWorkspace", true);
    try {
      // Use the new backend command to save workspace settings
      await invoke("settings_set_workspace_file", { workspacePath: wsState.workspacePath, content: wsState.workspaceSettings });
      setWsState("lastSaved", Date.now());
    } catch (e) {
      setWsState("error", e instanceof Error ? e.message : String(e));
    } finally {
      setWsState("savingWorkspace", false);
    }
  };

  const updateSettings = async <K extends keyof CortexSettings>(section: K, value: CortexSettings[K]) => {
    try {
      const updated = await invoke<CortexSettings>("settings_update", { section, value });
      const now = Date.now();
      batch(() => {
        setWsState("userSettings", reconcile(updated));
        setState("lastSaved", now);
        setWsState("lastSaved", now);
      });
      // Include the settings value in the event for other contexts to cache
      window.dispatchEvent(new CustomEvent("settings:changed", { detail: { section, settings: value } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      batch(() => {
        setState("error", msg);
        setWsState("error", msg);
      });
    }
  };

  const updateEditorSetting = async <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    await updateSettings("editor", { ...wsState.userSettings.editor, [key]: value });
  };

  const updateInlayHintsSetting = async <K extends keyof InlayHintsSettings>(key: K, value: InlayHintsSettings[K]) => {
    const currentInlayHints = wsState.userSettings.editor.inlayHints ?? DEFAULT_INLAY_HINTS;
    const newInlayHints = { ...currentInlayHints, [key]: value };
    await updateSettings("editor", { ...wsState.userSettings.editor, inlayHints: newInlayHints });
  };

  const updateCodeLensSetting = async <K extends keyof CodeLensSettings>(key: K, value: CodeLensSettings[K]) => {
    const currentCodeLens = wsState.userSettings.editor.codeLens ?? DEFAULT_CODE_LENS;
    const newCodeLens = { ...currentCodeLens, [key]: value };
    await updateSettings("editor", { ...wsState.userSettings.editor, codeLens: newCodeLens });
  };

  const updateThemeSetting = async <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    await updateSettings("theme", { ...wsState.userSettings.theme, [key]: value });
  };

  const updateTerminalSetting = async <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => {
    await updateSettings("terminal", { ...wsState.userSettings.terminal, [key]: value });
  };

  const updateAISetting = async <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    await updateSettings("ai", { ...wsState.userSettings.ai, [key]: value });
  };

  const updateSecuritySetting = async <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => {
    await updateSettings("security", { ...wsState.userSettings.security, [key]: value });
  };

  const updateFilesSetting = async <K extends keyof FilesSettings>(key: K, value: FilesSettings[K]) => {
    await updateSettings("files", { ...wsState.userSettings.files, [key]: value });
  };

  const updateExplorerSetting = async <K extends keyof ExplorerSettings>(key: K, value: ExplorerSettings[K]) => {
    await updateSettings("explorer", { ...wsState.userSettings.explorer, [key]: value });
  };

  const updateZenModeSetting = async <K extends keyof ZenModeSettings>(key: K, value: ZenModeSettings[K]) => {
    await updateSettings("zenMode", { ...wsState.userSettings.zenMode, [key]: value });
  };

  const updateScreencastModeSetting = async <K extends keyof ScreencastModeSettings>(key: K, value: ScreencastModeSettings[K]) => {
    await updateSettings("screencastMode", { ...wsState.userSettings.screencastMode, [key]: value });
  };

  const updateSearchSetting = async <K extends keyof SearchSettings>(key: K, value: SearchSettings[K]) => {
    await updateSettings("search", { ...wsState.userSettings.search, [key]: value });
  };

  const updateDebugSetting = async <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]) => {
    await updateSettings("debug", { ...wsState.userSettings.debug, [key]: value });
  };

  const updateGitSetting = async <K extends keyof GitSettings>(key: K, value: GitSettings[K]) => {
    await updateSettings("git", { ...wsState.userSettings.git, [key]: value });
  };

const updateHttpSetting = async <K extends keyof HttpSettings>(key: K, value: HttpSettings[K]) => {
    await updateSettings("http", { ...wsState.userSettings.http, [key]: value });
  };

const updateCommandPaletteSetting = async <K extends keyof CommandPaletteSettings>(key: K, value: CommandPaletteSettings[K]) => {
    const currentCommandPalette = wsState.userSettings.commandPalette ?? DEFAULT_COMMAND_PALETTE;
    await updateSettings("commandPalette", { ...currentCommandPalette, [key]: value });
  };

  const updateWorkbenchEditorSetting = async <K extends keyof WorkbenchEditorSettings>(key: K, value: WorkbenchEditorSettings[K]) => {
    const currentWorkbench = wsState.userSettings.workbench ?? DEFAULT_WORKBENCH;
    const currentEditor = currentWorkbench.editor ?? DEFAULT_WORKBENCH_EDITOR;
    const newEditor = { ...currentEditor, [key]: value };
    await updateSettings("workbench", { ...currentWorkbench, editor: newEditor });
  };

  const updateCenteredLayoutSetting = async <K extends keyof CenteredLayoutSettings>(key: K, value: CenteredLayoutSettings[K]) => {
    const currentWorkbench = wsState.userSettings.workbench ?? DEFAULT_WORKBENCH;
    const currentEditor = currentWorkbench.editor ?? DEFAULT_WORKBENCH_EDITOR;
    const currentCenteredLayout = currentEditor.centeredLayout ?? DEFAULT_CENTERED_LAYOUT;
    const newCenteredLayout = { ...currentCenteredLayout, [key]: value };
    const newEditor = { ...currentEditor, centeredLayout: newCenteredLayout };
    await updateSettings("workbench", { ...currentWorkbench, editor: newEditor });
    window.dispatchEvent(new CustomEvent("centered-layout:settings-changed", { detail: newCenteredLayout }));
  };

  const resetSettings = async () => {
    try {
      const def = await invoke<CortexSettings>("settings_reset");
      setWsState("userSettings", reconcile(def));
      setState("lastSaved", Date.now());
      setWsState("lastSaved", Date.now());
      window.dispatchEvent(new CustomEvent("settings:reset"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState("error", msg);
      setWsState("error", msg);
    }
  };

  const resetSection = async (section: keyof CortexSettings) => {
    try {
      const updated = await invoke<CortexSettings>("settings_reset_section", { section });
      setWsState("userSettings", reconcile(updated));
      setState("lastSaved", Date.now());
      setWsState("lastSaved", Date.now());
      window.dispatchEvent(new CustomEvent("settings:changed", { detail: { section } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState("error", msg);
      setWsState("error", msg);
    }
  };

  const exportSettings = async (): Promise<string> => invoke<string>("settings_export");

  const importSettings = async (json: string) => {
    const imported = await invoke<CortexSettings>("settings_import", { json });
    setWsState("userSettings", reconcile(imported));
    setState("lastSaved", Date.now());
    setWsState("lastSaved", Date.now());
    window.dispatchEvent(new CustomEvent("settings:imported"));
  };

  const getExtensionSettings = (extensionId: string) => effectiveSettings().extensions[extensionId] || {};

  const setExtensionSettings = async (extensionId: string, settings: Record<string, unknown>) => {
    await invoke("settings_set_extension", { extensionId, value: settings });
    setWsState("userSettings", "extensions", extensionId, settings);
  };

  const getSettingsPath = async (): Promise<string> => {
    const path = await invoke<string>("settings_get_path");
    setState("settingsPath", path);
    setWsState("userSettingsPath", path);
    return path;
  };

  const setWorkspaceSetting = async <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K, value: CortexSettings[S][K]) => {
    if (!wsState.workspacePath) return;
    const currentSection = (wsState.workspaceSettings[section] || {}) as Partial<CortexSettings[S]>;
    const newSection: Partial<CortexSettings[S]> = { ...currentSection, [key]: value };
    // Type assertion needed for solid-js store path typing limitation
    setWsState("workspaceSettings", section, newSection as PartialCortexSettings[S]);
    await saveWorkspaceSettings();
    window.dispatchEvent(new CustomEvent("settings:workspace-changed", { detail: { section, key, value } }));
  };

  const resetWorkspaceSetting = async <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K) => {
    if (!wsState.workspacePath) return;
    const currentSection = wsState.workspaceSettings[section];
    if (!currentSection) return;
    // Create a shallow copy without the key we want to remove
    const { [key as string]: _removed, ...remaining } = currentSection as Record<string, unknown>;
    if (Object.keys(remaining).length === 0) {
      const newWs = { ...wsState.workspaceSettings };
      delete newWs[section];
      setWsState("workspaceSettings", reconcile(newWs));
    } else {
      // Type assertion needed for solid-js store path typing limitation
      setWsState("workspaceSettings", section, remaining as PartialCortexSettings[S]);
    }
    await saveWorkspaceSettings();
    window.dispatchEvent(new CustomEvent("settings:workspace-reset", { detail: { section, key } }));
  };

  const getSettingSource = <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K): SettingSource => {
    const wsSection = wsState.workspaceSettings[section];
    if (wsSection && key in (wsSection as object)) return "workspace";
    const userSection = wsState.userSettings[section];
    const defaultSection = DEFAULT_SETTINGS[section];
    if (userSection && defaultSection) {
      const uv = (userSection as Record<string, unknown>)[key as string];
      const dv = (defaultSection as Record<string, unknown>)[key as string];
      if (JSON.stringify(uv) !== JSON.stringify(dv)) return "user";
    }
    return "default";
  };

  const hasWorkspaceOverride = <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K): boolean => {
    const wsSection = wsState.workspaceSettings[section];
    return wsSection !== undefined && key in (wsSection as object);
  };

  const isSettingModified = <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K): boolean => {
    const es = effectiveSettings()[section], ds = DEFAULT_SETTINGS[section];
    if (!es || !ds) return false;
    const cv = (es as Record<string, unknown>)[key as string];
    const dv = (ds as Record<string, unknown>)[key as string];
    return JSON.stringify(cv) !== JSON.stringify(dv);
  };

  const getModifiedCountForSection = (section: keyof CortexSettings): number => {
    const es = effectiveSettings()[section], ds = DEFAULT_SETTINGS[section];
    if (!es || !ds || typeof es !== "object") return 0;
    let count = 0;
    for (const k of Object.keys(ds)) {
      const cv = (es as Record<string, unknown>)[k];
      const dv = (ds as Record<string, unknown>)[k];
      if (JSON.stringify(cv) !== JSON.stringify(dv)) count++;
    }
    return count;
  };

  const getAllModifiedSettings = () => {
    const modified: Array<{ section: keyof CortexSettings; key: string; currentValue: unknown; defaultValue: unknown }> = [];
    const sections: (keyof CortexSettings)[] = ["editor", "theme", "terminal", "ai", "security", "files", "explorer", "zenMode", "search", "debug", "git", "http"];
    for (const section of sections) {
      const es = effectiveSettings()[section], ds = DEFAULT_SETTINGS[section];
      if (!es || !ds || typeof es !== "object") continue;
      for (const key of Object.keys(ds)) {
        const cv = (es as Record<string, unknown>)[key];
        const dv = (ds as Record<string, unknown>)[key];
        if (JSON.stringify(cv) !== JSON.stringify(dv)) modified.push({ section, key, currentValue: cv, defaultValue: dv });
      }
    }
    if (effectiveSettings().vimEnabled !== DEFAULT_SETTINGS.vimEnabled) {
      modified.push({ section: "vimEnabled" as keyof CortexSettings, key: "vimEnabled", currentValue: effectiveSettings().vimEnabled, defaultValue: DEFAULT_SETTINGS.vimEnabled });
    }
    return modified;
  };

  const resetSettingToDefault = async <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K): Promise<void> => {
    const ds = DEFAULT_SETTINGS[section];
    if (!ds || typeof ds !== "object") return;
    const dv = (ds as Record<string, unknown>)[key as string];
    const existingSection = wsState.userSettings[section];
    if (typeof existingSection !== "object" || existingSection === null) return;
    const newSection = { ...existingSection, [key]: dv } as CortexSettings[S];
    try {
      const updated = await invoke<CortexSettings>("settings_update", { section, value: newSection });
      setWsState("userSettings", reconcile(updated));
      setState("lastSaved", Date.now());
      setWsState("lastSaved", Date.now());
      window.dispatchEvent(new CustomEvent("settings:reset-to-default", { detail: { section, key, defaultValue: dv } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState("error", msg);
      setWsState("error", msg);
    }
  };

  const getDefaultValue = <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(section: S, key: K): CortexSettings[S][K] => {
    const ds = DEFAULT_SETTINGS[section];
    if (!ds || typeof ds !== "object") return undefined as unknown as CortexSettings[S][K];
    return (ds as Record<string, unknown>)[key as string] as CortexSettings[S][K];
  };

  const normalizePath = (path: string): string => path.replace(/\\/g, "/").replace(/\/+$/, "");

  const loadFolderSettings = async (folderPath: string): Promise<void> => {
    const np = normalizePath(folderPath);
    try {
      // Use the new backend command to load folder settings
      const fs = await invoke<PartialCortexSettings>("settings_get_folder", { folderPath: np });
      if (fs && Object.keys(fs).length > 0) {
        setWsState("folderSettings", np, fs);
        window.dispatchEvent(new CustomEvent("settings:folder-loaded", { detail: { folderPath: np, settings: fs } }));
      }
    } catch (err) {
      console.debug("Failed to load folder settings:", err);
    }
  };

  const saveFolderSettings = async (folderPath: string, settings: PartialCortexSettings): Promise<void> => {
    const np = normalizePath(folderPath);
    setWsState("savingFolder", true);
    try {
      // Use the new backend command to save folder settings
      await invoke("settings_set_folder_file", { folderPath: np, content: settings });
      setWsState("folderSettings", np, settings);
      setWsState("lastSaved", Date.now());
      window.dispatchEvent(new CustomEvent("settings:folder-saved", { detail: { folderPath: np } }));
    } catch (e) {
      setWsState("error", e instanceof Error ? e.message : String(e));
    } finally {
      setWsState("savingFolder", false);
    }
  };

  const getEffectiveSettingsForPath = (filePath: string): CortexSettings => {
    const nfp = normalizePath(filePath);
    let result = effectiveSettings();
    for (const fp of Object.keys(wsState.folderSettings)) {
      if (nfp.startsWith(fp + "/") || nfp === fp) {
        const fo = wsState.folderSettings[fp];
        if (fo && Object.keys(fo).length > 0) {
          result = deepMerge(result, fo);
          break;
        }
      }
    }
    return result;
  };

  const setFolderSetting = async <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(folderPath: string, section: S, key: K, value: CortexSettings[S][K]): Promise<void> => {
    const np = normalizePath(folderPath);
    const cfs = wsState.folderSettings[np] || {};
    const cs = (cfs[section] || {}) as Partial<CortexSettings[S]>;
    const ns = { ...cs, [key]: value };
    const nfs: PartialCortexSettings = { ...cfs, [section]: ns };
    await saveFolderSettings(np, nfs);
    window.dispatchEvent(new CustomEvent("settings:folder-changed", { detail: { folderPath: np, section, key, value } }));
  };

  const resetFolderSetting = async <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(folderPath: string, section: S, key: K): Promise<void> => {
    const np = normalizePath(folderPath);
    const cfs = wsState.folderSettings[np];
    if (!cfs) return;
    const cs = cfs[section];
    if (!cs) return;
    // Create a shallow copy without the key we want to remove
    const { [key as string]: _removed, ...remaining } = cs as Record<string, unknown>;
    let nfs: PartialCortexSettings;
    if (Object.keys(remaining).length === 0) {
      nfs = { ...cfs };
      delete nfs[section];
    } else {
      nfs = { ...cfs, [section]: remaining as Partial<CortexSettings[S]> };
    }
    await saveFolderSettings(np, nfs);
    window.dispatchEvent(new CustomEvent("settings:folder-reset", { detail: { folderPath: np, section, key } }));
  };

  const hasFolderOverride = <S extends keyof CortexSettings, K extends keyof CortexSettings[S]>(folderPath: string, section: S, key: K): boolean => {
    const np = normalizePath(folderPath);
    const fs = wsState.folderSettings[np];
    if (!fs) return false;
    const ss = fs[section];
    return ss !== undefined && key in (ss as object);
  };

  const clearFolderSettings = (folderPath: string): void => {
    const np = normalizePath(folderPath);
    const nfs = { ...wsState.folderSettings };
    delete nfs[np];
    setWsState("folderSettings", reconcile(nfs));
    window.dispatchEvent(new CustomEvent("settings:folder-cleared", { detail: { folderPath: np } }));
  };

  // Language-specific settings
  const getLanguageOverride = (language: string): LanguageEditorOverride | undefined => effectiveSettings().languageOverrides?.[`[${language}]`];

  const getEffectiveEditorSettings = (language: string): EditorSettings => {
    const base = effectiveSettings().editor;
    const override = getLanguageOverride(language);
    if (!override) return base;
    return { ...base, ...Object.fromEntries(Object.entries(override).filter(([, v]) => v !== undefined)) } as EditorSettings;
  };

  const setLanguageOverride = async (language: string, overrides: LanguageEditorOverride): Promise<void> => {
    const key = `[${language}]`;
    const co = { ...wsState.userSettings.languageOverrides, [key]: overrides };
    try {
      const updated = await invoke<CortexSettings>("settings_update", { section: "languageOverrides", value: co });
      setWsState("userSettings", reconcile(updated));
      setState("lastSaved", Date.now());
      setWsState("lastSaved", Date.now());
      window.dispatchEvent(new CustomEvent("settings:language-override-changed", { detail: { language, overrides } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState("error", msg);
      setWsState("error", msg);
    }
  };

  const resetLanguageOverride = async (language: string): Promise<void> => {
    const key = `[${language}]`;
    const co = { ...wsState.userSettings.languageOverrides };
    delete co[key];
    try {
      const updated = await invoke<CortexSettings>("settings_update", { section: "languageOverrides", value: co });
      setWsState("userSettings", reconcile(updated));
      setState("lastSaved", Date.now());
      setWsState("lastSaved", Date.now());
      window.dispatchEvent(new CustomEvent("settings:language-override-reset", { detail: { language } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState("error", msg);
      setWsState("error", msg);
    }
  };

  // File associations
  const getFileAssociations = (): Record<string, string> => effectiveSettings().files.associations || {};

  const setFileAssociation = async (pattern: string, languageId: string): Promise<void> => {
    const ca = { ...effectiveSettings().files.associations, [pattern]: languageId };
    await updateFilesSetting("associations", ca);
    window.dispatchEvent(new CustomEvent("settings:file-association-changed", { detail: { pattern, languageId } }));
  };

  const removeFileAssociation = async (pattern: string): Promise<void> => {
    const ca = { ...effectiveSettings().files.associations };
    delete ca[pattern];
    await updateFilesSetting("associations", ca);
    window.dispatchEvent(new CustomEvent("settings:file-association-removed", { detail: { pattern } }));
  };

  const getLanguageForFile = (filename: string): string | undefined => {
    const associations = getFileAssociations();
    const baseName = filename.split(/[/\\]/).pop() || filename;
    for (const [pattern, languageId] of Object.entries(associations)) {
      if (matchGlobPattern(baseName, pattern)) return languageId;
    }
    return undefined;
  };

  const getEditorMonacoOptions = (): Record<string, unknown> => {
    const e = effectiveSettings().editor;
    return {
      fontFamily: e.fontFamily,
      fontSize: e.fontSize,
      lineHeight: e.lineHeight,
      tabSize: e.tabSize,
      insertSpaces: e.insertSpaces,
      wordWrap: e.wordWrap,
      lineNumbers: e.lineNumbers,
      minimap: { enabled: e.minimapEnabled, maxColumn: e.minimapWidth },
      bracketPairColorization: { enabled: e.bracketPairColorization },
      autoClosingBrackets: e.autoClosingBrackets,
      autoIndent: e.autoIndent ? "full" : "none",
      formatOnPaste: e.formatOnPaste,
      cursorStyle: e.cursorStyle,
      cursorBlinking: e.cursorBlink,
      renderWhitespace: e.renderWhitespace,
      scrollBeyondLastLine: e.scrollBeyondLastLine,
      smoothScrolling: e.smoothScrolling,
      mouseWheelZoom: e.mouseWheelZoom,
      linkedEditing: e.linkedEditing,
      stickyScroll: { enabled: e.stickyScrollEnabled },
      folding: e.foldingEnabled,
      showFoldingControls: e.showFoldingControls,
      guides: { indentation: e.guidesIndentation, bracketPairs: e.guidesBracketPairs, highlightActiveIndentation: e.highlightActiveIndentGuide },
    };
  };

  onMount(async () => {
    await loadSettings();
    await getSettingsPath();
  });

  createEffect(() => {
    let unlistenProject: UnlistenFn | null = null;
    let unlistenClose: UnlistenFn | null = null;
    const setup = async () => {
      unlistenProject = await listen<{ path: string }>("project:opened", (e) => loadWorkspaceSettings(e.payload.path));
      unlistenClose = await listen("project:closed", clearWorkspaceSettings);
    };
    setup();
    onCleanup(() => { unlistenProject?.(); unlistenClose?.(); });
  });

  createEffect(() => {
    const handleStorage = (e: StorageEvent) => { if (e.key === "cortex-settings-sync") loadSettings(); };
    window.addEventListener("storage", handleStorage);
    onCleanup(() => window.removeEventListener("storage", handleStorage));
  });

  createEffect(() => {
    const handleFolderAdded = (e: CustomEvent<{ path: string }>) => loadFolderSettings(e.detail.path);
    const handleFolderRemoved = (e: CustomEvent<{ path: string }>) => clearFolderSettings(e.detail.path);
    window.addEventListener("workspace:folder-added", handleFolderAdded as unknown as EventListener);
    window.addEventListener("workspace:folder-removed", handleFolderRemoved as unknown as EventListener);
    onCleanup(() => {
      window.removeEventListener("workspace:folder-added", handleFolderAdded as unknown as EventListener);
      window.removeEventListener("workspace:folder-removed", handleFolderRemoved as unknown as EventListener);
    });
  });

// Respond to debug settings request from DebugContext
  createEffect(() => {
    const handleDebugSettingsRequest = () => {
      const debugSettings = effectiveSettings().debug;
      window.dispatchEvent(new CustomEvent("settings:changed", { 
        detail: { section: "debug", settings: debugSettings } 
      }));
    };
    window.addEventListener("debug:request-settings", handleDebugSettingsRequest);
    onCleanup(() => {
      window.removeEventListener("debug:request-settings", handleDebugSettingsRequest);
    });
  });

  // Handle settings:toggle events for toggling boolean settings
  createEffect(() => {
    const handleSettingsToggle = async (e: CustomEvent<{ section: keyof CortexSettings; key: string }>) => {
      const { section, key } = e.detail;
      const currentSettings = wsState.userSettings[section];
      if (currentSettings && typeof currentSettings === "object" && key in currentSettings) {
        const currentValue = (currentSettings as Record<string, unknown>)[key];
        if (typeof currentValue === "boolean") {
          await updateSettings(section, { ...currentSettings, [key]: !currentValue } as CortexSettings[typeof section]);
        }
      }
    };
    window.addEventListener("settings:toggle", handleSettingsToggle as unknown as EventListener);
    onCleanup(() => {
      window.removeEventListener("settings:toggle", handleSettingsToggle as unknown as EventListener);
    });
  });

  const value: SettingsContextValue = {
    state,
    settings: effectiveSettings,
    userSettings: userSettingsAccessor,
    workspaceSettings: workspaceSettingsAccessor,
    effectiveSettings,
    workspacePath: workspacePathAccessor,
    hasWorkspace: hasWorkspaceAccessor,
    folderSettings: folderSettingsAccessor,
    loadSettings,
    saveSettings,
    updateSettings,
    updateEditorSetting,
    updateInlayHintsSetting,
    updateCodeLensSetting,
    updateThemeSetting,
    updateTerminalSetting,
    updateAISetting,
    updateSecuritySetting,
    updateFilesSetting,
    updateExplorerSetting,
    updateZenModeSetting,
    updateScreencastModeSetting,
    updateSearchSetting,
    updateDebugSetting,
    updateGitSetting,
updateHttpSetting,
    updateCommandPaletteSetting,
    updateWorkbenchEditorSetting,
    updateCenteredLayoutSetting,
    resetSettings,
    resetSection,
    exportSettings,
    importSettings,
    getExtensionSettings,
    setExtensionSettings,
    getSettingsPath,
    loadWorkspaceSettings,
    clearWorkspaceSettings,
    setWorkspaceSetting,
    resetWorkspaceSetting,
    getSettingSource,
    hasWorkspaceOverride,
    saveWorkspaceSettings,
    isSettingModified,
    getModifiedCountForSection,
    getAllModifiedSettings,
    resetSettingToDefault,
    getDefaultValue,
    loadFolderSettings,
    saveFolderSettings,
    getEffectiveSettingsForPath,
    setFolderSetting,
    resetFolderSetting,
    hasFolderOverride,
    clearFolderSettings,
    getEditorMonacoOptions,
    getEffectiveEditorSettings,
    getLanguageOverride,
    setLanguageOverride,
    resetLanguageOverride,
    getFileAssociations,
    setFileAssociation,
    removeFileAssociation,
    getLanguageForFile,
  };

  return (
    <SettingsContext.Provider value={value}>
      {props.children}
    </SettingsContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within a SettingsProvider");
  return context;
}

export function useEditorSettings() {
  const { effectiveSettings, updateEditorSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().editor ?? DEFAULT_EDITOR,
    update: updateEditorSetting,
    reset: () => resetSection("editor"),
    getSource: (key: keyof EditorSettings) => getSettingSource("editor", key),
    hasOverride: (key: keyof EditorSettings) => hasWorkspaceOverride("editor", key),
    setWorkspace: <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => setWorkspaceSetting("editor", key, value),
    resetWorkspace: (key: keyof EditorSettings) => resetWorkspaceSetting("editor", key),
  };
}

export function useInlayHintsSettings() {
  const { effectiveSettings, updateInlayHintsSetting } = useSettings();
  return {
    settings: () => effectiveSettings().editor.inlayHints ?? DEFAULT_INLAY_HINTS,
    update: updateInlayHintsSetting,
    isEnabled: () => (effectiveSettings().editor.inlayHints ?? DEFAULT_INLAY_HINTS).enabled,
    showTypes: () => (effectiveSettings().editor.inlayHints ?? DEFAULT_INLAY_HINTS).showTypes,
    showParameterNames: () => (effectiveSettings().editor.inlayHints ?? DEFAULT_INLAY_HINTS).showParameterNames,
    showReturnTypes: () => (effectiveSettings().editor.inlayHints ?? DEFAULT_INLAY_HINTS).showReturnTypes,
  };
}

export function useCodeLensSettings() {
  const { effectiveSettings, updateCodeLensSetting } = useSettings();
  return {
    settings: () => effectiveSettings().editor.codeLens ?? DEFAULT_CODE_LENS,
    update: updateCodeLensSetting,
    isEnabled: () => (effectiveSettings().editor.codeLens ?? DEFAULT_CODE_LENS).enabled,
    showReferences: () => (effectiveSettings().editor.codeLens ?? DEFAULT_CODE_LENS).showReferences,
    showImplementations: () => (effectiveSettings().editor.codeLens ?? DEFAULT_CODE_LENS).showImplementations,
    showTestActions: () => (effectiveSettings().editor.codeLens ?? DEFAULT_CODE_LENS).showTestActions,
  };
}

export function useThemeSettings() {
  const { effectiveSettings, updateThemeSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().theme ?? DEFAULT_THEME,
    update: updateThemeSetting,
    reset: () => resetSection("theme"),
    getSource: (key: keyof ThemeSettings) => getSettingSource("theme", key),
    hasOverride: (key: keyof ThemeSettings) => hasWorkspaceOverride("theme", key),
    setWorkspace: <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => setWorkspaceSetting("theme", key, value),
    resetWorkspace: (key: keyof ThemeSettings) => resetWorkspaceSetting("theme", key),
  };
}

export function useTerminalSettings() {
  const { effectiveSettings, updateTerminalSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().terminal ?? DEFAULT_TERMINAL,
    update: updateTerminalSetting,
    reset: () => resetSection("terminal"),
    getSource: (key: keyof TerminalSettings) => getSettingSource("terminal", key),
    hasOverride: (key: keyof TerminalSettings) => hasWorkspaceOverride("terminal", key),
    setWorkspace: <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => setWorkspaceSetting("terminal", key, value),
    resetWorkspace: (key: keyof TerminalSettings) => resetWorkspaceSetting("terminal", key),
  };
}

export function useAISettings() {
  const { effectiveSettings, updateAISetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().ai ?? DEFAULT_AI,
    update: updateAISetting,
    reset: () => resetSection("ai"),
    getSource: (key: keyof AISettings) => getSettingSource("ai", key),
    hasOverride: (key: keyof AISettings) => hasWorkspaceOverride("ai", key),
    setWorkspace: <K extends keyof AISettings>(key: K, value: AISettings[K]) => setWorkspaceSetting("ai", key, value),
    resetWorkspace: (key: keyof AISettings) => resetWorkspaceSetting("ai", key),
  };
}

export function useSecuritySettings() {
  const { effectiveSettings, updateSecuritySetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().security ?? DEFAULT_SECURITY,
    update: updateSecuritySetting,
    reset: () => resetSection("security"),
    getSource: (key: keyof SecuritySettings) => getSettingSource("security", key),
    hasOverride: (key: keyof SecuritySettings) => hasWorkspaceOverride("security", key),
    setWorkspace: <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => setWorkspaceSetting("security", key, value),
    resetWorkspace: (key: keyof SecuritySettings) => resetWorkspaceSetting("security", key),
  };
}

export function useExplorerSettings() {
  const { effectiveSettings, updateExplorerSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().explorer ?? DEFAULT_EXPLORER,
    update: updateExplorerSetting,
    reset: () => resetSection("explorer"),
    getSource: (key: keyof ExplorerSettings) => getSettingSource("explorer", key),
    hasOverride: (key: keyof ExplorerSettings) => hasWorkspaceOverride("explorer", key),
    setWorkspace: <K extends keyof ExplorerSettings>(key: K, value: ExplorerSettings[K]) => setWorkspaceSetting("explorer", key, value),
    resetWorkspace: (key: keyof ExplorerSettings) => resetWorkspaceSetting("explorer", key),
  };
}

export function useZenModeSettings() {
  const { effectiveSettings, updateZenModeSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().zenMode ?? DEFAULT_ZEN_MODE,
    update: updateZenModeSetting,
    reset: () => resetSection("zenMode"),
    getSource: (key: keyof ZenModeSettings) => getSettingSource("zenMode", key),
    hasOverride: (key: keyof ZenModeSettings) => hasWorkspaceOverride("zenMode", key),
    setWorkspace: <K extends keyof ZenModeSettings>(key: K, value: ZenModeSettings[K]) => setWorkspaceSetting("zenMode", key, value),
    resetWorkspace: (key: keyof ZenModeSettings) => resetWorkspaceSetting("zenMode", key),
  };
}

export function useScreencastModeSettings() {
  const { effectiveSettings, updateScreencastModeSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().screencastMode ?? DEFAULT_SCREENCAST_MODE,
    update: updateScreencastModeSetting,
    reset: () => resetSection("screencastMode"),
    getSource: (key: keyof ScreencastModeSettings) => getSettingSource("screencastMode", key),
    hasOverride: (key: keyof ScreencastModeSettings) => hasWorkspaceOverride("screencastMode", key),
    setWorkspace: <K extends keyof ScreencastModeSettings>(key: K, value: ScreencastModeSettings[K]) => setWorkspaceSetting("screencastMode", key, value),
    resetWorkspace: (key: keyof ScreencastModeSettings) => resetWorkspaceSetting("screencastMode", key),
  };
}

export function useSearchSettings() {
  const { effectiveSettings, updateSearchSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().search ?? DEFAULT_SEARCH,
    update: updateSearchSetting,
    reset: () => resetSection("search"),
    getSource: (key: keyof SearchSettings) => getSettingSource("search", key),
    hasOverride: (key: keyof SearchSettings) => hasWorkspaceOverride("search", key),
    setWorkspace: <K extends keyof SearchSettings>(key: K, value: SearchSettings[K]) => setWorkspaceSetting("search", key, value),
    resetWorkspace: (key: keyof SearchSettings) => resetWorkspaceSetting("search", key),
  };
}

export function useFilesSettings() {
  const { effectiveSettings, updateFilesSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting, getFileAssociations, setFileAssociation, removeFileAssociation, getLanguageForFile } = useSettings();
  return {
    settings: () => effectiveSettings().files ?? DEFAULT_FILES,
    update: updateFilesSetting,
    reset: () => resetSection("files"),
    getSource: (key: keyof FilesSettings) => getSettingSource("files", key),
    hasOverride: (key: keyof FilesSettings) => hasWorkspaceOverride("files", key),
    setWorkspace: <K extends keyof FilesSettings>(key: K, value: FilesSettings[K]) => setWorkspaceSetting("files", key, value),
    resetWorkspace: (key: keyof FilesSettings) => resetWorkspaceSetting("files", key),
    getAssociations: getFileAssociations,
    setAssociation: setFileAssociation,
    removeAssociation: removeFileAssociation,
    getLanguageForFile,
  };
}

export function useDebugSettings() {
  const { effectiveSettings, updateDebugSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().debug ?? DEFAULT_DEBUG,
    update: updateDebugSetting,
    reset: () => resetSection("debug"),
    getSource: (key: keyof DebugSettings) => getSettingSource("debug", key),
    hasOverride: (key: keyof DebugSettings) => hasWorkspaceOverride("debug", key),
    setWorkspace: <K extends keyof DebugSettings>(key: K, value: DebugSettings[K]) => setWorkspaceSetting("debug", key, value),
    resetWorkspace: (key: keyof DebugSettings) => resetWorkspaceSetting("debug", key),
  };
}

export function useGitSettings() {
  const { effectiveSettings, updateGitSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().git ?? DEFAULT_GIT,
    update: updateGitSetting,
    reset: () => resetSection("git"),
    getSource: (key: keyof GitSettings) => getSettingSource("git", key),
    hasOverride: (key: keyof GitSettings) => hasWorkspaceOverride("git", key),
    setWorkspace: <K extends keyof GitSettings>(key: K, value: GitSettings[K]) => setWorkspaceSetting("git", key, value),
    resetWorkspace: (key: keyof GitSettings) => resetWorkspaceSetting("git", key),
  };
}

export function useHttpSettings() {
  const { effectiveSettings, updateHttpSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().http ?? DEFAULT_HTTP,
    update: updateHttpSetting,
    reset: () => resetSection("http"),
    getSource: (key: keyof HttpSettings) => getSettingSource("http", key),
    hasOverride: (key: keyof HttpSettings) => hasWorkspaceOverride("http", key),
    setWorkspace: <K extends keyof HttpSettings>(key: K, value: HttpSettings[K]) => setWorkspaceSetting("http", key, value),
    resetWorkspace: (key: keyof HttpSettings) => resetWorkspaceSetting("http", key),
  };
}

export function useCommandPaletteSettings() {
  const { effectiveSettings, updateCommandPaletteSetting, resetSection, getSettingSource, hasWorkspaceOverride, setWorkspaceSetting, resetWorkspaceSetting } = useSettings();
  return {
    settings: () => effectiveSettings().commandPalette ?? DEFAULT_COMMAND_PALETTE,
    update: updateCommandPaletteSetting,
    reset: () => resetSection("commandPalette"),
    getSource: (key: keyof CommandPaletteSettings) => getSettingSource("commandPalette", key),
    hasOverride: (key: keyof CommandPaletteSettings) => hasWorkspaceOverride("commandPalette", key),
    setWorkspace: <K extends keyof CommandPaletteSettings>(key: K, value: CommandPaletteSettings[K]) => setWorkspaceSetting("commandPalette", key, value),
    resetWorkspace: (key: keyof CommandPaletteSettings) => resetWorkspaceSetting("commandPalette", key),
    historyLength: () => Math.min(Math.max((effectiveSettings().commandPalette ?? DEFAULT_COMMAND_PALETTE).historyLength, 1), 200),
    preserveInput: () => (effectiveSettings().commandPalette ?? DEFAULT_COMMAND_PALETTE).preserveInput,
  };
}

export function useWorkbenchEditorSettings() {
  const { effectiveSettings, updateWorkbenchEditorSetting, resetSection } = useSettings();
  return {
    settings: () => effectiveSettings().workbench?.editor ?? DEFAULT_WORKBENCH_EDITOR,
    update: updateWorkbenchEditorSetting,
    reset: () => resetSection("workbench"),
    // Tab sizing settings
    tabSizing: () => (effectiveSettings().workbench?.editor ?? DEFAULT_WORKBENCH_EDITOR).tabSizing,
    tabSizingFixedMinWidth: () => (effectiveSettings().workbench?.editor ?? DEFAULT_WORKBENCH_EDITOR).tabSizingFixedMinWidth,
    tabSizingFixedWidth: () => (effectiveSettings().workbench?.editor ?? DEFAULT_WORKBENCH_EDITOR).tabSizingFixedWidth,
    wrapTabs: () => (effectiveSettings().workbench?.editor ?? DEFAULT_WORKBENCH_EDITOR).wrapTabs,
    showTabCloseButton: () => (effectiveSettings().workbench?.editor ?? DEFAULT_WORKBENCH_EDITOR).showTabCloseButton,
    tabCloseButtonPosition: () => (effectiveSettings().workbench?.editor ?? DEFAULT_WORKBENCH_EDITOR).tabCloseButtonPosition,
  };
}

export function useCenteredLayoutSettings() {
  const { effectiveSettings, updateCenteredLayoutSetting } = useSettings();
  const getSettings = () => effectiveSettings().workbench?.editor?.centeredLayout ?? DEFAULT_CENTERED_LAYOUT;
  
  return {
    settings: getSettings,
    update: updateCenteredLayoutSetting,
    enabled: () => getSettings().enabled,
    maxWidth: () => getSettings().maxWidth,
    autoResize: () => getSettings().autoResize,
    sideMarginRatio: () => getSettings().sideMarginRatio,
    toggle: async () => {
      const current = getSettings().enabled;
      await updateCenteredLayoutSetting("enabled", !current);
    },
  };
}


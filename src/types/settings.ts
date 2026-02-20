/**
 * Settings Types
 *
 * Centralized type definitions for application settings including
 * editor, theme, terminal, AI, and security settings.
 */

// ============================================================================
// Unicode Highlight Settings
// ============================================================================

/**
 * Unicode character highlighting settings.
 */
export interface UnicodeHighlightSettings {
  /** Whether unicode highlighting is enabled */
  enabled: boolean;
  /** Highlight invisible characters */
  invisibleCharacters: boolean;
  /** Highlight ambiguous characters */
  ambiguousCharacters: boolean;
  /** Highlight non-basic ASCII */
  nonBasicASCII: boolean;
  /** Include comments in highlighting */
  includeComments: boolean | "inUntrustedWorkspace";
  /** Include strings in highlighting */
  includeStrings: boolean | "inUntrustedWorkspace";
  /** Characters to allow */
  allowedCharacters: Record<string, boolean>;
  /** Locales to allow */
  allowedLocales: Record<string, boolean>;
}

// ============================================================================
// Editor Settings
// ============================================================================

/**
 * Code Lens display settings.
 */
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

/**
 * Editor configuration settings.
 */
export interface EditorSettings {
  /** Editor font family */
  fontFamily: string;
  /** Font size in pixels */
  fontSize: number;
  /** Line height multiplier */
  lineHeight: number;
  /** Tab size in spaces */
  tabSize: number;
  /** Insert spaces instead of tabs */
  insertSpaces: boolean;
  /** Word wrap mode */
  wordWrap: "off" | "on" | "wordWrapColumn" | "bounded";
  /** Word wrap column (used when wordWrap is "wordWrapColumn" or "bounded") */
  wordWrapColumn: number;
  /** Line numbers display mode */
  lineNumbers: "on" | "off" | "relative" | "interval";
  /** Enable minimap */
  minimapEnabled: boolean;
  /** Minimap width in pixels */
  minimapWidth: number;
  /** Enable bracket pair colorization */
  bracketPairColorization: boolean;
  /** Auto closing brackets behavior */
  autoClosingBrackets: "always" | "languageDefined" | "beforeWhitespace" | "never";
  /** Auto indent on new line */
  autoIndent: boolean;
  /** Format on save */
  formatOnSave: boolean;
  /** Format on paste */
  formatOnPaste: boolean;
  /** Format on type */
  formatOnType: boolean;
  /** Characters that trigger format on type */
  formatOnTypeTriggerCharacters: string[];
  /** Cursor style */
  cursorStyle: "line" | "block" | "underline" | "line-thin" | "block-outline" | "underline-thin";
  /** Cursor blinking style */
  cursorBlink: "blink" | "smooth" | "phase" | "expand" | "solid";
  /** Whitespace rendering mode */
  renderWhitespace: "none" | "boundary" | "selection" | "trailing" | "all";
  /** Allow scrolling past last line */
  scrollBeyondLastLine: boolean;
  /** Enable smooth scrolling */
  smoothScrolling: boolean;
  /** Enable mouse wheel zoom */
  mouseWheelZoom: boolean;
  /** Enable linked editing */
  linkedEditing: boolean;
  /** Enable rename on type */
  renameOnType: boolean;
  /** Enable sticky scroll */
  stickyScrollEnabled: boolean;
  /** Enable code folding */
  foldingEnabled: boolean;
  /** Folding controls visibility */
  showFoldingControls: "always" | "mouseover" | "never";
  /** Show indentation guides */
  guidesIndentation: boolean;
  /** Show bracket pair guides */
  guidesBracketPairs: boolean;
  /** Highlight active indent guide */
  highlightActiveIndentGuide: boolean;
  /** Unicode highlight settings */
  unicodeHighlight: UnicodeHighlightSettings;
  /** Enable preview mode for tabs */
  enablePreview: boolean;
  /** Render control characters */
  renderControlCharacters: boolean;
  /** Drop into editor settings */
  dropIntoEditor: { enabled: boolean; showDropSelector: "afterDrop" | "never" };
  /** Large file optimizations */
  largeFileOptimizations?: boolean;
  /** Max tokenization line length */
  maxTokenizationLineLength?: number;
  /** Enable vertical tabs layout */
  verticalTabs: boolean;
  /** Code Lens settings */
  codeLens: CodeLensSettings;
}

// ============================================================================
// Theme Settings
// ============================================================================

/**
 * Activity bar location options.
 */
export type ActivityBarLocation = "side" | "top" | "hidden";

/**
 * Menu bar visibility options.
 */
export type MenuBarVisibility = "classic" | "compact" | "toggle" | "hidden";

/**
 * Panel position options.
 */
export type PanelPosition = "bottom" | "left" | "right";

/**
 * Panel alignment options.
 */
export type PanelAlignment = "center" | "left" | "right" | "justify";

/**
 * Theme configuration settings.
 */
export interface ThemeSettings {
  /** Color theme */
  theme: "dark" | "light" | "system" | "high-contrast" | "high-contrast-light";
  /** File icon theme */
  iconTheme: string;
  /** Accent color */
  accentColor: string;
  /** UI font family */
  uiFontFamily: string;
  /** UI font size */
  uiFontSize: number;
  /** Zoom level */
  zoomLevel: number;
  /** Sidebar position */
  sidebarPosition: "left" | "right";
  /** Activity bar visible */
  activityBarVisible: boolean;
  /** Activity bar position */
  activityBarPosition: ActivityBarLocation;
  /** Status bar visible */
  statusBarVisible: boolean;
  /** Tab bar visible */
  tabBarVisible: boolean;
  /** Breadcrumbs enabled */
  breadcrumbsEnabled: boolean;
  /** Wrap tabs */
  wrapTabs: boolean;
  /** Menu bar visibility */
  menuBarVisibility: MenuBarVisibility;
  /** Panel position */
  panelPosition: PanelPosition;
  /** Panel alignment */
  panelAlignment: PanelAlignment;
  /** Enable Command Center in title bar */
  commandCenterEnabled: boolean;
}

// ============================================================================
// Terminal Settings
// ============================================================================

/**
 * Terminal decoration settings for command status indicators.
 */
export interface TerminalDecorationSettings {
  /** Enable command status decorations in gutter */
  enabled: boolean;
  /** Show command duration in tooltip */
  showDuration: boolean;
  /** Show exit code in tooltip */
  showExitCode: boolean;
}

/**
 * Image scaling mode for terminal images.
 */
export type TerminalImageScaling = "auto" | "fit" | "fill" | "none";

/**
 * Terminal image settings for inline image support (iTerm2/Sixel/Kitty protocols).
 */
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

/**
 * Terminal auto-reply settings for automated responses to prompts.
 */
export interface TerminalAutoReplySettings {
  /** Enable auto-reply feature */
  enabled: boolean;
  /** Show notification when auto-reply triggers */
  showNotification: boolean;
  /** Default delay before sending reply (ms) */
  defaultDelay: number;
}

/**
 * Terminal configuration settings.
 */
export interface TerminalSettings {
  /** Default shell path */
  shellPath: string;
  /** Shell arguments */
  shellArgs: string[];
  /** Terminal font family */
  fontFamily: string;
  /** Terminal font size */
  fontSize: number;
  /** Line height multiplier */
  lineHeight: number;
  /** Cursor style */
  cursorStyle: "block" | "underline" | "bar";
  /** Cursor blinking */
  cursorBlink: boolean;
  /** Scrollback buffer size */
  scrollback: number;
  /** Copy on selection */
  copyOnSelection: boolean;
  /** Environment variables */
  env: Record<string, string>;
  /** Default working directory */
  cwd: string;
  /** Use integrated GPU */
  integratedGpu: boolean;
  /** Color scheme name */
  colorScheme: string;
  /** Word separators for selection */
  wordSeparators: string;
  /** Bell behavior */
  bell: "none" | "audible" | "visual";
  /** Enable accessible view mode */
  accessibleViewEnabled: boolean;
  /** Announce to screen readers */
  screenReaderAnnounce: boolean;
  /** Command status decorations in gutter */
  decorations: TerminalDecorationSettings;
  /** Inline image settings (iTerm2/Sixel/Kitty protocols) */
  images: TerminalImageSettings;
  /** Auto-reply settings for automated responses to terminal prompts */
  autoReply: TerminalAutoReplySettings;
}

// ============================================================================
// AI Settings
// ============================================================================

/**
 * Inline suggestions provider type.
 */
export type InlineSuggestProvider = "auto" | "copilot" | "supermaven" | "openai" | "anthropic";

/**
 * Inline suggestions configuration settings.
 */
export interface InlineSuggestSettings {
  /** Enable inline suggestions */
  enabled: boolean;
  /** Show inline suggest toolbar on hover */
  showToolbar: boolean;
  /** Suppress standard suggestions when inline suggestion is shown */
  suppressSuggestions: boolean;
  /** Provider to use for completions */
  provider: InlineSuggestProvider;
  /** Debounce delay in milliseconds */
  debounceMs: number;
  /** Maximum completion length in characters */
  maxCompletionLength: number;
  /** Number of context lines to send before cursor */
  contextLinesBefore: number;
  /** Number of context lines to send after cursor */
  contextLinesAfter: number;
  /** Enable caching of completions */
  enableCache: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
}

/**
 * AI configuration settings.
 */
export interface AISettings {
  /** Enable Supermaven */
  supermavenEnabled: boolean;
  /** Supermaven API key */
  supermavenApiKey: string;
  /** Enable GitHub Copilot */
  copilotEnabled: boolean;
  /** Enable inline suggestions (legacy - use inlineSuggest.enabled) */
  inlineSuggestEnabled: boolean;
  /** Show inline suggest toolbar (legacy - use inlineSuggest.showToolbar) */
  inlineSuggestShowToolbar: boolean;
  /** Inline suggestions settings */
  inlineSuggest: InlineSuggestSettings;
  /** Default AI provider */
  defaultProvider: string;
  /** Default AI model */
  defaultModel: string;
}

// ============================================================================
// Security Settings
// ============================================================================

/**
 * Sandbox mode options.
 */
export type SandboxMode = "workspace_write" | "directory_only" | "read_only";

/**
 * Approval mode options.
 */
export type ApprovalMode = "auto" | "ask_edit" | "ask_all";

/**
 * Security configuration settings.
 */
export interface SecuritySettings {
  /** Sandbox mode */
  sandboxMode: SandboxMode;
  /** Approval mode for operations */
  approvalMode: ApprovalMode;
  /** Allow network access */
  networkAccess: boolean;
  /** List of trusted workspace paths */
  trustedWorkspaces: string[];
  /** Enable telemetry */
  telemetryEnabled: boolean;
  /** Enable crash reports */
  crashReportsEnabled: boolean;
}

// ============================================================================
// Search Settings
// ============================================================================

/**
 * Search configuration settings.
 */
export interface SearchSettings {
  /** Paths to exclude from search */
  exclude: Record<string, boolean>;
  /** Use .gitignore files */
  useIgnoreFiles: boolean;
  /** Use global ignore files */
  useGlobalIgnoreFiles: boolean;
  /** Follow symlinks */
  followSymlinks: boolean;
  /** Lines of context to show */
  contextLines: number;
}

// ============================================================================
// Debug Settings
// ============================================================================

/**
 * JavaScript debug settings.
 */
export interface JavaScriptDebugSettings {
  /** Auto attach filter */
  autoAttachFilter: "disabled" | "always" | "smart" | "onlyWithFlag";
}

/**
 * Variable visualizer settings for the debugger.
 */
export interface VariableVisualizerSettings {
  /** Enable custom variable visualizers */
  enabled: boolean;
  /** Number of bytes per row in hex viewer */
  hexBytesPerRow: number;
  /** Page size for array pagination */
  arrayPageSize: number;
}

/**
 * Debug configuration settings.
 */
export interface DebugSettings {
  /** Debug toolbar location */
  toolbarLocation: "floating" | "docked" | "commandCenter" | "hidden";
  /** JavaScript-specific settings */
  javascript: JavaScriptDebugSettings;
  /** Open debug view on session start */
  openDebugOnSessionStart: boolean;
  /** Close readonly tabs on debug end */
  closeReadonlyTabsOnEnd: boolean;
  /** Focus window on breakpoint */
  focusWindowOnBreak: boolean;
  /** Focus editor on breakpoint */
  focusEditorOnBreak: boolean;
  /** Show inline breakpoint candidates */
  showInlineBreakpointCandidates: boolean;
  /** Variable visualizer settings */
  variableVisualizers: VariableVisualizerSettings;
}

// ============================================================================
// Git Settings
// ============================================================================

/**
 * Git configuration settings.
 */
export interface GitSettings {
  /** Enable git features */
  enabled: boolean;
  /** Enable autofetch */
  autofetch: boolean;
  /** Autofetch period in seconds */
  autofetchPeriod: number;
  /** Confirm before sync */
  confirmSync: boolean;
  /** Enable smart commit */
  enableSmartCommit: boolean;
  /** Prune on fetch */
  pruneOnFetch: boolean;
  /** Fetch tags */
  fetchTags: boolean;
  /** Follow tags when syncing */
  followTagsWhenSync: boolean;
  /** Post commit command */
  postCommitCommand: "none" | "push" | "sync";
  /** Default clone directory */
  defaultCloneDirectory: string;
  /** Branch sort order */
  branchSortOrder: "alphabetically" | "committerDate";
  /** Rebase when syncing */
  rebaseWhenSync: boolean;
}

// ============================================================================
// HTTP Settings
// ============================================================================

/**
 * HTTP proxy configuration settings.
 */
export interface HttpSettings {
  /** Proxy URL */
  proxy: string;
  /** Strict SSL verification */
  proxyStrictSSL: boolean;
  /** Proxy authorization header */
  proxyAuthorization: string | null;
  /** Proxy support mode */
  proxySupport: "off" | "on" | "fallback";
}

// ============================================================================
// SSH Settings
// ============================================================================

/**
 * SSH authentication method type.
 */
export type SSHAuthMethod = "password" | "key" | "agent";

/**
 * Saved SSH connection profile.
 */
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

/**
 * SSH configuration settings.
 */
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

// ============================================================================
// Files Settings
// ============================================================================

/**
 * Files configuration settings.
 */
export interface FilesSettings {
  /** Auto save mode */
  autoSave: "off" | "afterDelay" | "onFocusChange" | "onWindowChange";
  /** Auto save delay in ms */
  autoSaveDelay: number;
  /** Hot exit behavior */
  hotExit: "off" | "onExit" | "onExitAndWindowClose";
  /** Default language for new files */
  defaultLanguage: string;
  /** Trim trailing whitespace on save */
  trimTrailingWhitespace: boolean;
  /** Insert final newline on save */
  insertFinalNewline: boolean;
  /** Trim final newlines on save */
  trimFinalNewlines: boolean;
  /** Files to exclude */
  exclude: Record<string, boolean>;
  /** Files to exclude from watching */
  watchExclude: Record<string, boolean>;
  /** Default file encoding */
  encoding: string;
  /** End of line sequence */
  eol: "auto" | "\n" | "\r\n";
  /** Confirm drag and drop */
  confirmDragAndDrop: boolean;
  /** Confirm delete */
  confirmDelete: boolean;
  /** Enable trash */
  enableTrash: boolean;
  /** Max memory for large files in MB */
  maxMemoryForLargeFilesMB: number;
  /** File associations */
  associations: Record<string, string>;
}

// ============================================================================
// Explorer Settings
// ============================================================================

/**
 * File nesting patterns.
 */
export interface FileNestingPatterns {
  [pattern: string]: string;
}

/**
 * File nesting settings.
 */
export interface FileNestingSettings {
  /** Enable file nesting */
  enabled: boolean;
  /** Nesting patterns */
  patterns: FileNestingPatterns;
}

/**
 * Explorer sort order options.
 */
export type ExplorerSortOrder = "default" | "mixed" | "filesFirst" | "type" | "modified";

/**
 * Explorer configuration settings.
 */
export interface ExplorerSettings {
  /** Compact folders (single-child folders) */
  compactFolders: boolean;
  /** File nesting settings */
  fileNesting: FileNestingSettings;
  /** Show indent guides */
  indentGuidesEnabled: boolean;
  /** Sort order */
  sortOrder: ExplorerSortOrder;
}

// ============================================================================
// Zen Mode Settings
// ============================================================================

/**
 * Zen mode configuration settings.
 */
export interface ZenModeSettings {
  /** Hide sidebar in zen mode */
  hideSidebar: boolean;
  /** Hide status bar in zen mode */
  hideStatusBar: boolean;
  /** Hide menu bar in zen mode */
  hideMenuBar: boolean;
  /** Hide panel in zen mode */
  hidePanel: boolean;
  /** Center layout in zen mode */
  centerLayout: boolean;
  /** Max width of centered layout */
  maxWidth: string;
  /** Enter fullscreen */
  fullScreen: boolean;
  /** Show line numbers */
  showLineNumbers: boolean;
  /** Silence notifications */
  silenceNotifications: boolean;
}

// ============================================================================
// Screencast Mode Settings
// ============================================================================

/**
 * Screencast mode configuration settings.
 */
export interface ScreencastModeSettings {
  /** Enable screencast mode */
  enabled: boolean;
  /** Show keyboard shortcuts */
  showKeys: boolean;
  /** Show mouse clicks */
  showMouse: boolean;
  /** Show commands */
  showCommands: boolean;
  /** Font size for display */
  fontSize: number;
  /** Display duration in ms */
  duration: number;
}

// ============================================================================
// Extension Settings
// ============================================================================

/**
 * Auto-update mode for extensions.
 */
export type ExtensionAutoUpdateMode = true | false | "onlyEnabledExtensions";

/**
 * Extension update settings.
 */
export interface ExtensionUpdateSettings {
  /** Auto-update mode: true (all), false (none), or "onlyEnabledExtensions" */
  autoUpdate: ExtensionAutoUpdateMode;
  /** Automatically check for updates on startup and periodically */
  autoCheckUpdates: boolean;
  /** Interval in minutes for periodic update checks (default: 60) */
  checkInterval: number;
}

/**
 * Extension settings map.
 */
export interface ExtensionSettingsMap {
  [extensionId: string]: Record<string, unknown>;
}

/**
 * Global extension settings including update behavior.
 */
export interface ExtensionsSettings {
  /** Update-related settings */
  updates: ExtensionUpdateSettings;
  /** Per-extension settings */
  perExtension: ExtensionSettingsMap;
}

// ============================================================================
// Composite Settings Types
// ============================================================================

/**
 * Main application settings interface.
 */
export interface CortexSettings {
  /** Settings version */
  version: number;
  /** Editor settings */
  editor: EditorSettings;
  /** Theme settings */
  theme: ThemeSettings;
  /** Terminal settings */
  terminal: TerminalSettings;
  /** AI settings */
  ai: AISettings;
  /** Security settings */
  security: SecuritySettings;
  /** Files settings */
  files: FilesSettings;
  /** Explorer settings */
  explorer: ExplorerSettings;
  /** Zen mode settings */
  zenMode: ZenModeSettings;
  /** Screencast mode settings */
  screencastMode: ScreencastModeSettings;
  /** Extension settings */
  extensions: ExtensionSettingsMap;
  /** Vim mode enabled */
  vimEnabled: boolean;
  /** Language-specific overrides */
  languageOverrides: Record<string, Partial<EditorSettings>>;
  /** Debug settings */
  debug: DebugSettings;
  /** Search settings */
  search: SearchSettings;
  /** Git settings */
  git: GitSettings;
  /** HTTP settings */
  http: HttpSettings;
  /** SSH settings */
  ssh: SSHSettings;
}

/**
 * Partial settings for workspace/folder overrides.
 */
export type PartialCortexSettings = {
  [K in keyof CortexSettings]?: K extends "extensions" | "languageOverrides"
    ? CortexSettings[K]
    : Partial<CortexSettings[K]>;
};

/**
 * Setting source type.
 */
export type SettingSource = "user" | "workspace" | "folder" | "default";

/**
 * Settings scope type.
 */
export type SettingsScope = "user" | "workspace" | "folder";

// ============================================================================
// Setting Widget Types
// ============================================================================

/**
 * Array setting value with manipulation methods.
 * Used for settings that contain lists of items (e.g., trusted workspaces, extensions).
 */
export interface ArraySettingValue<T = unknown> {
  /** The array items */
  items: T[];
  /** Add a new item to the array */
  addItem: (item: T) => void;
  /** Remove an item at the specified index */
  removeItem: (index: number) => void;
  /** Move an item from one index to another */
  moveItem: (fromIndex: number, toIndex: number) => void;
  /** Update an item at the specified index */
  updateItem: (index: number, item: T) => void;
}

/**
 * Object setting value with key-value manipulation methods.
 * Used for settings that contain dictionaries (e.g., file associations, env variables).
 */
export interface ObjectSettingValue {
  /** The key-value entries */
  entries: Array<{ key: string; value: unknown }>;
  /** Add a new entry */
  addEntry: (key: string, value: unknown) => void;
  /** Remove an entry by key */
  removeEntry: (key: string) => void;
  /** Update an entry's value */
  updateEntry: (key: string, value: unknown) => void;
}

// ============================================================================
// Setting Indicators
// ============================================================================

/**
 * Setting indicator type for visual status representation.
 */
export type SettingIndicatorType =
  | "modified"           // Setting has been changed from default
  | "synced"             // Setting is synced across devices
  | "syncIgnored"        // Setting is excluded from sync
  | "policy"             // Setting is controlled by policy
  | "restricted"         // Setting is restricted in current context
  | "workspace"          // Setting is set at workspace level
  | "folder";            // Setting is set at folder level

/**
 * Setting indicator for displaying status badges in the settings UI.
 */
export interface SettingIndicator {
  /** Type of indicator */
  type: SettingIndicatorType;
  /** Optional tooltip text to display on hover */
  tooltip?: string;
}

// ============================================================================
// Policy Settings
// ============================================================================

/**
 * Policy-controlled setting definition.
 * Used when settings are managed by enterprise policies or MDM.
 */
export interface PolicySetting {
  /** The setting identifier (e.g., "editor.fontSize") */
  settingId: string;
  /** The value enforced by the policy */
  policyValue: unknown;
  /** Source of the policy (e.g., "Group Policy", "MDM", "Organization") */
  policySource: string;
}

// ============================================================================
// Configuration Scope
// ============================================================================

/**
 * Configuration scope determines where a setting can be applied.
 * This affects which configuration targets can override the setting.
 */
export type ConfigurationScope =
  | "application"           // Default profile only, not synced
  | "machine"               // Local machine only
  | "window"                // User or workspace level
  | "resource"              // User, workspace, or folder level
  | "languageOverridable"   // Can be overridden per language
  | "machineOverridable";   // Machine level but can be overridden by workspace

// ============================================================================
// Configuration Target
// ============================================================================

/**
 * Configuration target specifies where to read/write a setting value.
 */
export type ConfigurationTarget =
  | "default"           // Built-in default values
  | "user"              // User settings (synced)
  | "userLocal"         // User settings (local only, not synced)
  | "userRemote"        // User settings on remote machine
  | "workspace"         // Workspace settings (.cortex/settings.json)
  | "workspaceFolder"   // Folder-specific settings in multi-root workspace
  | "memory";           // Temporary in-memory settings

// ============================================================================
// Setting Registration (for extensions)
// ============================================================================

/**
 * Setting type for registration.
 */
export type SettingType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "integer"
  | "null";

/**
 * Edit presentation mode for string settings.
 */
export type SettingEditPresentation = "singlelineText" | "multilineText";

/**
 * Setting registration definition for extensions to contribute settings.
 * Based on JSON Schema with additional VS Code-style properties.
 */
export interface SettingRegistration {
  /** Unique setting identifier (e.g., "myExtension.enableFeature") */
  id: string;
  /** JSON Schema type of the setting value */
  type: SettingType;
  /** Default value when not configured */
  default?: unknown;
  /** Plain text description shown in settings UI */
  description?: string;
  /** Configuration scope determining where setting can be applied */
  scope?: ConfigurationScope;
  /** Allowed values for enum-style settings */
  enum?: unknown[];
  /** Descriptions for each enum value */
  enumDescriptions?: string[];
  /** Minimum value for number/integer types */
  minimum?: number;
  /** Maximum value for number/integer types */
  maximum?: number;
  /** Regex pattern for string validation */
  pattern?: string;
  /** Custom error message when pattern validation fails */
  patternErrorMessage?: string;
  /** Message shown when setting is deprecated */
  deprecationMessage?: string;
  /** Markdown description (supports links, formatting) */
  markdownDescription?: string;
  /** How string settings should be edited */
  editPresentation?: SettingEditPresentation;
  /** Display order within the settings category */
  order?: number;
  /** Tags for categorization and search */
  tags?: string[];
}

// ============================================================================
// Setting Validation
// ============================================================================

/**
 * Validation severity level.
 */
export type SettingValidationSeverity = "error" | "warning" | "info";

/**
 * Result of validating a setting value.
 */
export interface SettingValidationResult {
  /** Whether the value is valid */
  valid: boolean;
  /** Validation message describing the issue or success */
  message?: string;
  /** Severity level of the validation result */
  severity?: SettingValidationSeverity;
}

// ============================================================================
// Setting Change Event
// ============================================================================

/**
 * Event fired when a setting value changes.
 */
export interface SettingChangeEvent {
  /** The setting key that changed */
  key: string;
  /** The previous value (undefined if newly set) */
  previousValue: unknown;
  /** The new value (undefined if removed) */
  newValue: unknown;
  /** The configuration target where the change occurred */
  target: ConfigurationTarget;
  /** Whether the change affects the current scope */
  affectsConfiguration: (section: string) => boolean;
}

// ============================================================================
// Settings Editor Types
// ============================================================================

/**
 * Settings editor filter options.
 */
export interface SettingsEditorFilter {
  /** Text search query */
  query?: string;
  /** Filter by modified settings only */
  modifiedOnly?: boolean;
  /** Filter by specific tags */
  tags?: string[];
  /** Filter by configuration scope */
  scope?: ConfigurationScope;
  /** Filter by extension ID */
  extensionId?: string;
}

/**
 * Settings editor group for organizing settings.
 */
export interface SettingsEditorGroup {
  /** Group identifier */
  id: string;
  /** Display title */
  title: string;
  /** Optional icon identifier */
  icon?: string;
  /** Child groups */
  children?: SettingsEditorGroup[];
  /** Settings in this group */
  settings?: string[];
  /** Display order */
  order?: number;
}

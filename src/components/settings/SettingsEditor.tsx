/**
 * =============================================================================
 * SETTINGS EDITOR - VS Code-style Tree-Based Settings UI
 * =============================================================================
 * 
 * A comprehensive settings editor with:
 * - Left: Table of Contents (TOC) tree with collapsible categories
 * - Right: Settings tree with type-specific renderers
 * - Search with advanced filters (@modified, @id:, @ext:, @lang:, @tag:, text search)
 * - Settings scope selector (User/Workspace/Folder tabs for multi-root)
 * - Persistence via SettingsContext
 * =============================================================================
 */

import {
  Show,
  For,
  createSignal,
  createMemo,
  createEffect,
} from "solid-js";
import { Icon } from "../ui/Icon";
import {
  useSettings,
  type SettingsScope,
  type CortexSettings,
  DEFAULT_SETTINGS,
  DEFAULT_WORKBENCH_EDITOR,
} from "@/context/SettingsContext";
import { useWorkspace, type WorkspaceFolder } from "@/context/WorkspaceContext";
import { useSettingsSync } from "@/context/SettingsSyncContext";
import { usePolicySettings } from "@/context/PolicySettingsContext";
import { useWorkspaceTrust } from "@/context/WorkspaceTrustContext";
import { isSettingRestricted, getSettingRestrictionReason } from "@/utils/restrictedSettings";
import { tokens } from "@/design-system/tokens";
import { Button, IconButton, Input, Text, Badge, Toggle } from "@/components/ui";
import { loadStylesheet } from "@/utils/lazyStyles";
loadStylesheet("settings");

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/** Setting value types */
type SettingType = "boolean" | "string" | "number" | "enum" | "array" | "object";

/** Setting tags for categorization */
type SettingTag = "experimental" | "preview" | "deprecated" | "advanced" | "core";

/** Individual setting definition */
interface SettingDefinition {
  id: string;
  key: string;
  section: keyof CortexSettings;
  subSection?: string;
  label: string;
  description: string;
  type: SettingType;
  defaultValue: unknown;
  enumValues?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  arrayItemType?: SettingType;
  /** Extension ID if this setting is contributed by an extension */
  extensionId?: string;
  /** Language IDs this setting applies to (for language-specific settings) */
  languageOverride?: string[];
  /** Tags for categorization (experimental, preview, deprecated, etc.) */
  tags?: SettingTag[];
}

/** TOC tree item */
interface TocItem {
  id: string;
  label: string;
  icon?: string;
  children?: TocItem[];
  section?: keyof CortexSettings;
}

/** Search filter type */
type SearchFilterType = "text" | "modified" | "extension" | "language" | "tag" | "id";

/** Parsed setting filter */
interface SettingFilter {
  type: SearchFilterType;
  value?: string;
}

/** Settings scope tab for multi-root workspaces */
interface SettingsScopeTab {
  id: string;
  label: string;
  scope: SettingsScope;
  folderPath?: string;
  icon?: string;
}

/** Search filter suggestion for autocomplete */
interface FilterSuggestion {
  filter: string;
  label: string;
  description: string;
}

// =============================================================================
// SETTINGS REGISTRY
// =============================================================================

/** Define all settings with metadata */
const SETTINGS_REGISTRY: SettingDefinition[] = [
  // Editor Settings - Core settings have tags
  { id: "editor.fontFamily", key: "fontFamily", section: "editor", label: "Font Family", description: "Controls the font family for the editor.", type: "string", defaultValue: DEFAULT_SETTINGS.editor.fontFamily, tags: ["core"] },
  { id: "editor.fontSize", key: "fontSize", section: "editor", label: "Font Size", description: "Controls the font size in pixels.", type: "number", defaultValue: DEFAULT_SETTINGS.editor.fontSize, min: 6, max: 72, tags: ["core"] },
  { id: "editor.lineHeight", key: "lineHeight", section: "editor", label: "Line Height", description: "Controls the line height. Use 0 to compute from font size.", type: "number", defaultValue: DEFAULT_SETTINGS.editor.lineHeight, min: 0, max: 3, step: 0.1 },
  { id: "editor.tabSize", key: "tabSize", section: "editor", label: "Tab Size", description: "The number of spaces a tab is equal to.", type: "number", defaultValue: DEFAULT_SETTINGS.editor.tabSize, min: 1, max: 8, languageOverride: ["javascript", "typescript", "python", "go", "rust"] },
  { id: "editor.insertSpaces", key: "insertSpaces", section: "editor", label: "Insert Spaces", description: "Insert spaces when pressing Tab.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.insertSpaces, languageOverride: ["javascript", "typescript", "python", "makefile"] },
  { id: "editor.wordWrap", key: "wordWrap", section: "editor", label: "Word Wrap", description: "Controls how lines should wrap.", type: "enum", defaultValue: DEFAULT_SETTINGS.editor.wordWrap, languageOverride: ["markdown", "plaintext", "html"], enumValues: [
    { value: "off", label: "Off" },
    { value: "on", label: "On" },
    { value: "wordWrapColumn", label: "Word Wrap Column" },
    { value: "bounded", label: "Bounded" },
  ]},
  { id: "editor.lineNumbers", key: "lineNumbers", section: "editor", label: "Line Numbers", description: "Controls the display of line numbers.", type: "enum", defaultValue: DEFAULT_SETTINGS.editor.lineNumbers, tags: ["core"], enumValues: [
    { value: "on", label: "On" },
    { value: "off", label: "Off" },
    { value: "relative", label: "Relative" },
    { value: "interval", label: "Interval" },
  ]},
  { id: "editor.minimapEnabled", key: "minimapEnabled", section: "editor", label: "Minimap Enabled", description: "Controls whether the minimap is shown.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.minimapEnabled },
  { id: "editor.minimapWidth", key: "minimapWidth", section: "editor", label: "Minimap Width", description: "Controls the maximum width of the minimap.", type: "number", defaultValue: DEFAULT_SETTINGS.editor.minimapWidth, min: 50, max: 300 },
  { id: "editor.bracketPairColorization", key: "bracketPairColorization", section: "editor", label: "Bracket Pair Colorization", description: "Controls whether bracket pair colorization is enabled.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.bracketPairColorization },
  { id: "editor.autoClosingBrackets", key: "autoClosingBrackets", section: "editor", label: "Auto Closing Brackets", description: "Controls whether the editor should automatically close brackets.", type: "enum", defaultValue: DEFAULT_SETTINGS.editor.autoClosingBrackets, languageOverride: ["javascript", "typescript", "json", "html"], enumValues: [
    { value: "always", label: "Always" },
    { value: "languageDefined", label: "Language Defined" },
    { value: "beforeWhitespace", label: "Before Whitespace" },
    { value: "never", label: "Never" },
  ]},
  { id: "editor.autoIndent", key: "autoIndent", section: "editor", label: "Auto Indent", description: "Controls whether the editor should automatically adjust indentation.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.autoIndent },
  { id: "editor.formatOnSave", key: "formatOnSave", section: "editor", label: "Format On Save", description: "Format a file on save.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.formatOnSave, languageOverride: ["javascript", "typescript", "python", "go", "rust", "json", "html", "css"] },
  { id: "editor.formatOnPaste", key: "formatOnPaste", section: "editor", label: "Format On Paste", description: "Format code when pasting.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.formatOnPaste },
  { id: "editor.formatOnType", key: "formatOnType", section: "editor", label: "Format On Type", description: "Format the line after typing.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.formatOnType },
  { id: "editor.cursorStyle", key: "cursorStyle", section: "editor", label: "Cursor Style", description: "Controls the cursor style.", type: "enum", defaultValue: DEFAULT_SETTINGS.editor.cursorStyle, enumValues: [
    { value: "line", label: "Line" },
    { value: "block", label: "Block" },
    { value: "underline", label: "Underline" },
    { value: "line-thin", label: "Line Thin" },
    { value: "block-outline", label: "Block Outline" },
    { value: "underline-thin", label: "Underline Thin" },
  ]},
  { id: "editor.cursorBlink", key: "cursorBlink", section: "editor", label: "Cursor Blinking", description: "Controls the cursor blinking animation style.", type: "enum", defaultValue: DEFAULT_SETTINGS.editor.cursorBlink, enumValues: [
    { value: "blink", label: "Blink" },
    { value: "smooth", label: "Smooth" },
    { value: "phase", label: "Phase" },
    { value: "expand", label: "Expand" },
    { value: "solid", label: "Solid" },
  ]},
  { id: "editor.renderWhitespace", key: "renderWhitespace", section: "editor", label: "Render Whitespace", description: "Controls how the editor should render whitespace characters.", type: "enum", defaultValue: DEFAULT_SETTINGS.editor.renderWhitespace, enumValues: [
    { value: "none", label: "None" },
    { value: "boundary", label: "Boundary" },
    { value: "selection", label: "Selection" },
    { value: "trailing", label: "Trailing" },
    { value: "all", label: "All" },
  ]},
  { id: "editor.scrollBeyondLastLine", key: "scrollBeyondLastLine", section: "editor", label: "Scroll Beyond Last Line", description: "Controls whether the editor will scroll beyond the last line.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.scrollBeyondLastLine },
  { id: "editor.smoothScrolling", key: "smoothScrolling", section: "editor", label: "Smooth Scrolling", description: "Controls whether the editor will scroll with an animation.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.smoothScrolling },
  { id: "editor.mouseWheelZoom", key: "mouseWheelZoom", section: "editor", label: "Mouse Wheel Zoom", description: "Zoom the font of the editor when using mouse wheel and holding Ctrl.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.mouseWheelZoom },
  { id: "editor.linkedEditing", key: "linkedEditing", section: "editor", label: "Linked Editing", description: "Controls whether the editor has linked editing enabled.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.linkedEditing, tags: ["preview"], languageOverride: ["html", "xml"] },
  { id: "editor.stickyScrollEnabled", key: "stickyScrollEnabled", section: "editor", label: "Sticky Scroll", description: "Shows the nested current scopes during scroll.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.stickyScrollEnabled, tags: ["experimental"] },
  { id: "editor.foldingEnabled", key: "foldingEnabled", section: "editor", label: "Folding", description: "Controls whether the editor has code folding enabled.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.foldingEnabled },
  { id: "editor.showFoldingControls", key: "showFoldingControls", section: "editor", label: "Show Folding Controls", description: "Controls when the folding controls on the gutter are shown.", type: "enum", defaultValue: DEFAULT_SETTINGS.editor.showFoldingControls, enumValues: [
    { value: "always", label: "Always" },
    { value: "mouseover", label: "On Mouse Over" },
    { value: "never", label: "Never" },
  ]},
  { id: "editor.guidesIndentation", key: "guidesIndentation", section: "editor", label: "Indentation Guides", description: "Controls whether the editor should render indent guides.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.guidesIndentation },
  { id: "editor.guidesBracketPairs", key: "guidesBracketPairs", section: "editor", label: "Bracket Pair Guides", description: "Controls whether bracket pair guides are enabled.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.guidesBracketPairs },
  { id: "editor.verticalTabs", key: "verticalTabs", section: "editor", label: "Vertical Tabs", description: "Enable vertical tabs layout.", type: "boolean", defaultValue: DEFAULT_SETTINGS.editor.verticalTabs, tags: ["experimental"] },

  // Theme Settings
  { id: "theme.theme", key: "theme", section: "theme", label: "Color Theme", description: "Specifies the color theme used in the workbench.", type: "enum", defaultValue: DEFAULT_SETTINGS.theme.theme, enumValues: [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "system", label: "System" },
  ]},
  { id: "theme.iconTheme", key: "iconTheme", section: "theme", label: "Icon Theme", description: "Specifies the file icon theme used in the workbench.", type: "string", defaultValue: DEFAULT_SETTINGS.theme.iconTheme },
  { id: "theme.accentColor", key: "accentColor", section: "theme", label: "Accent Color", description: "The accent color used throughout the UI.", type: "string", defaultValue: DEFAULT_SETTINGS.theme.accentColor },
  { id: "theme.uiFontFamily", key: "uiFontFamily", section: "theme", label: "UI Font Family", description: "Controls the font family for the user interface.", type: "string", defaultValue: DEFAULT_SETTINGS.theme.uiFontFamily },
  { id: "theme.uiFontSize", key: "uiFontSize", section: "theme", label: "UI Font Size", description: "Controls the font size for the user interface.", type: "number", defaultValue: DEFAULT_SETTINGS.theme.uiFontSize, min: 10, max: 24 },
  { id: "theme.zoomLevel", key: "zoomLevel", section: "theme", label: "Zoom Level", description: "Adjust the zoom level of the window.", type: "number", defaultValue: DEFAULT_SETTINGS.theme.zoomLevel, min: 0.5, max: 2, step: 0.1 },
  { id: "theme.sidebarPosition", key: "sidebarPosition", section: "theme", label: "Sidebar Position", description: "Controls the location of the sidebar.", type: "enum", defaultValue: DEFAULT_SETTINGS.theme.sidebarPosition, enumValues: [
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ]},
  { id: "theme.activityBarVisible", key: "activityBarVisible", section: "theme", label: "Activity Bar Visible", description: "Controls the visibility of the activity bar.", type: "boolean", defaultValue: DEFAULT_SETTINGS.theme.activityBarVisible },
  { id: "theme.activityBarPosition", key: "activityBarPosition", section: "theme", label: "Activity Bar Position", description: "Controls the position of the activity bar.", type: "enum", defaultValue: DEFAULT_SETTINGS.theme.activityBarPosition, enumValues: [
    { value: "side", label: "Side" },
    { value: "top", label: "Top" },
    { value: "hidden", label: "Hidden" },
  ]},
  { id: "theme.statusBarVisible", key: "statusBarVisible", section: "theme", label: "Status Bar Visible", description: "Controls the visibility of the status bar.", type: "boolean", defaultValue: DEFAULT_SETTINGS.theme.statusBarVisible },
  { id: "theme.tabBarVisible", key: "tabBarVisible", section: "theme", label: "Tab Bar Visible", description: "Controls the visibility of the tab bar.", type: "boolean", defaultValue: DEFAULT_SETTINGS.theme.tabBarVisible },
  { id: "theme.breadcrumbsEnabled", key: "breadcrumbsEnabled", section: "theme", label: "Breadcrumbs", description: "Enable/disable navigation breadcrumbs.", type: "boolean", defaultValue: DEFAULT_SETTINGS.theme.breadcrumbsEnabled },
  { id: "theme.wrapTabs", key: "wrapTabs", section: "theme", label: "Wrap Tabs", description: "Wrap tabs to multiple lines instead of scrolling.", type: "boolean", defaultValue: DEFAULT_SETTINGS.theme.wrapTabs },
  { id: "theme.menuBarVisibility", key: "menuBarVisibility", section: "theme", label: "Menu Bar Visibility", description: "Controls the visibility of the menu bar.", type: "enum", defaultValue: DEFAULT_SETTINGS.theme.menuBarVisibility, enumValues: [
    { value: "classic", label: "Classic" },
    { value: "compact", label: "Compact" },
    { value: "toggle", label: "Toggle" },
    { value: "hidden", label: "Hidden" },
  ]},
  { id: "theme.panelPosition", key: "panelPosition", section: "theme", label: "Panel Position", description: "Controls the default location of the panel.", type: "enum", defaultValue: DEFAULT_SETTINGS.theme.panelPosition, enumValues: [
    { value: "bottom", label: "Bottom" },
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ]},

  // Terminal Settings
  { id: "terminal.shellPath", key: "shellPath", section: "terminal", label: "Shell Path", description: "The path of the shell that the terminal uses.", type: "string", defaultValue: DEFAULT_SETTINGS.terminal.shellPath, placeholder: "Leave empty for default shell" },
  { id: "terminal.fontFamily", key: "fontFamily", section: "terminal", label: "Font Family", description: "Controls the font family of the terminal.", type: "string", defaultValue: DEFAULT_SETTINGS.terminal.fontFamily },
  { id: "terminal.fontSize", key: "fontSize", section: "terminal", label: "Font Size", description: "Controls the font size of the terminal.", type: "number", defaultValue: DEFAULT_SETTINGS.terminal.fontSize, min: 6, max: 72 },
  { id: "terminal.lineHeight", key: "lineHeight", section: "terminal", label: "Line Height", description: "Controls the line height of the terminal.", type: "number", defaultValue: DEFAULT_SETTINGS.terminal.lineHeight, min: 1, max: 3, step: 0.1 },
  { id: "terminal.cursorStyle", key: "cursorStyle", section: "terminal", label: "Cursor Style", description: "Controls the style of the terminal cursor.", type: "enum", defaultValue: DEFAULT_SETTINGS.terminal.cursorStyle, enumValues: [
    { value: "block", label: "Block" },
    { value: "underline", label: "Underline" },
    { value: "bar", label: "Bar" },
  ]},
  { id: "terminal.cursorBlink", key: "cursorBlink", section: "terminal", label: "Cursor Blink", description: "Controls whether the terminal cursor blinks.", type: "boolean", defaultValue: DEFAULT_SETTINGS.terminal.cursorBlink },
  { id: "terminal.scrollback", key: "scrollback", section: "terminal", label: "Scrollback", description: "Controls the maximum number of lines the terminal keeps in its buffer.", type: "number", defaultValue: DEFAULT_SETTINGS.terminal.scrollback, min: 1000, max: 100000, step: 1000 },
  { id: "terminal.copyOnSelection", key: "copyOnSelection", section: "terminal", label: "Copy On Selection", description: "Controls whether text selected in the terminal will be copied to the clipboard.", type: "boolean", defaultValue: DEFAULT_SETTINGS.terminal.copyOnSelection },
  { id: "terminal.colorScheme", key: "colorScheme", section: "terminal", label: "Color Scheme", description: "The color scheme to use for the terminal.", type: "string", defaultValue: DEFAULT_SETTINGS.terminal.colorScheme },
  { id: "terminal.bell", key: "bell", section: "terminal", label: "Bell", description: "Controls the terminal bell behavior.", type: "enum", defaultValue: DEFAULT_SETTINGS.terminal.bell, enumValues: [
    { value: "none", label: "None" },
    { value: "audible", label: "Audible" },
    { value: "visual", label: "Visual" },
  ]},

  // Files Settings
  { id: "files.autoSave", key: "autoSave", section: "files", label: "Auto Save", description: "Controls auto save of editors.", type: "enum", defaultValue: DEFAULT_SETTINGS.files.autoSave, enumValues: [
    { value: "off", label: "Off" },
    { value: "afterDelay", label: "After Delay" },
    { value: "onFocusChange", label: "On Focus Change" },
    { value: "onWindowChange", label: "On Window Change" },
  ]},
  { id: "files.autoSaveDelay", key: "autoSaveDelay", section: "files", label: "Auto Save Delay", description: "Controls the delay in ms after which an editor is saved automatically.", type: "number", defaultValue: DEFAULT_SETTINGS.files.autoSaveDelay, min: 100, max: 10000, step: 100 },
  { id: "files.hotExit", key: "hotExit", section: "files", label: "Hot Exit", description: "Controls whether unsaved files are remembered between sessions.", type: "enum", defaultValue: DEFAULT_SETTINGS.files.hotExit, enumValues: [
    { value: "off", label: "Off" },
    { value: "onExit", label: "On Exit" },
    { value: "onExitAndWindowClose", label: "On Exit and Window Close" },
  ]},
  { id: "files.defaultLanguage", key: "defaultLanguage", section: "files", label: "Default Language", description: "The default language mode for new files.", type: "string", defaultValue: DEFAULT_SETTINGS.files.defaultLanguage, placeholder: "e.g., javascript, typescript" },
  { id: "files.trimTrailingWhitespace", key: "trimTrailingWhitespace", section: "files", label: "Trim Trailing Whitespace", description: "When enabled, will trim trailing whitespace when saving a file.", type: "boolean", defaultValue: DEFAULT_SETTINGS.files.trimTrailingWhitespace },
  { id: "files.insertFinalNewline", key: "insertFinalNewline", section: "files", label: "Insert Final Newline", description: "When enabled, insert a final new line at the end of the file when saving it.", type: "boolean", defaultValue: DEFAULT_SETTINGS.files.insertFinalNewline },
  { id: "files.trimFinalNewlines", key: "trimFinalNewlines", section: "files", label: "Trim Final Newlines", description: "When enabled, will trim all new lines after the final new line at the end of the file when saving it.", type: "boolean", defaultValue: DEFAULT_SETTINGS.files.trimFinalNewlines },
  { id: "files.encoding", key: "encoding", section: "files", label: "Encoding", description: "The default character set encoding to use when reading and writing files.", type: "string", defaultValue: DEFAULT_SETTINGS.files.encoding },
  { id: "files.eol", key: "eol", section: "files", label: "End of Line", description: "The default end of line character.", type: "enum", defaultValue: DEFAULT_SETTINGS.files.eol, enumValues: [
    { value: "auto", label: "Auto" },
    { value: "\n", label: "LF" },
    { value: "\r\n", label: "CRLF" },
  ]},
  { id: "files.confirmDelete", key: "confirmDelete", section: "files", label: "Confirm Delete", description: "Controls if file deletions should ask for confirmation.", type: "boolean", defaultValue: DEFAULT_SETTINGS.files.confirmDelete },
  { id: "files.confirmDragAndDrop", key: "confirmDragAndDrop", section: "files", label: "Confirm Drag and Drop", description: "Controls if moving files in the explorer should ask for confirmation.", type: "boolean", defaultValue: DEFAULT_SETTINGS.files.confirmDragAndDrop },
  { id: "files.enableTrash", key: "enableTrash", section: "files", label: "Enable Trash", description: "Moves files/folders to the OS trash when deleting.", type: "boolean", defaultValue: DEFAULT_SETTINGS.files.enableTrash },

  // Explorer Settings
  { id: "explorer.compactFolders", key: "compactFolders", section: "explorer", label: "Compact Folders", description: "Controls whether the explorer should render folders in a compact form.", type: "boolean", defaultValue: DEFAULT_SETTINGS.explorer.compactFolders },
  { id: "explorer.sortOrder", key: "sortOrder", section: "explorer", label: "Sort Order", description: "Controls the sorting order of files and folders in the explorer.", type: "enum", defaultValue: DEFAULT_SETTINGS.explorer.sortOrder, enumValues: [
    { value: "default", label: "Name (Folders First)" },
    { value: "mixed", label: "Name (Mixed)" },
    { value: "filesFirst", label: "Name (Files First)" },
    { value: "type", label: "Type" },
    { value: "modified", label: "Date Modified" },
  ]},

  // Security Settings
  { id: "security.sandboxMode", key: "sandboxMode", section: "security", label: "Sandbox Mode", description: "Controls the level of file system access.", type: "enum", defaultValue: DEFAULT_SETTINGS.security.sandboxMode, enumValues: [
    { value: "workspace_write", label: "Workspace Write" },
    { value: "directory_only", label: "Directory Only" },
    { value: "read_only", label: "Read Only" },
  ]},
  { id: "security.approvalMode", key: "approvalMode", section: "security", label: "Approval Mode", description: "Controls when to ask for approval before operations.", type: "enum", defaultValue: DEFAULT_SETTINGS.security.approvalMode, enumValues: [
    { value: "auto", label: "Auto Approve" },
    { value: "ask_edit", label: "Ask for Edits" },
    { value: "ask_all", label: "Ask All" },
  ]},
  { id: "security.networkAccess", key: "networkAccess", section: "security", label: "Network Access", description: "Allow network access for extensions.", type: "boolean", defaultValue: DEFAULT_SETTINGS.security.networkAccess },
  { id: "security.telemetryEnabled", key: "telemetryEnabled", section: "security", label: "Telemetry", description: "Enable sending anonymous usage data.", type: "boolean", defaultValue: DEFAULT_SETTINGS.security.telemetryEnabled },
  { id: "security.crashReportsEnabled", key: "crashReportsEnabled", section: "security", label: "Crash Reports", description: "Enable sending crash reports.", type: "boolean", defaultValue: DEFAULT_SETTINGS.security.crashReportsEnabled },

  // Git Settings
  { id: "git.enabled", key: "enabled", section: "git", label: "Git Enabled", description: "Whether git is enabled.", type: "boolean", defaultValue: DEFAULT_SETTINGS.git.enabled },
  { id: "git.autofetch", key: "autofetch", section: "git", label: "Auto Fetch", description: "When enabled, fetch all remotes periodically.", type: "boolean", defaultValue: DEFAULT_SETTINGS.git.autofetch },
  { id: "git.autofetchPeriod", key: "autofetchPeriod", section: "git", label: "Auto Fetch Period", description: "Period in seconds between each automatic git fetch.", type: "number", defaultValue: DEFAULT_SETTINGS.git.autofetchPeriod, min: 60, max: 3600, step: 60 },
  { id: "git.confirmSync", key: "confirmSync", section: "git", label: "Confirm Sync", description: "Confirm before synchronizing git repositories.", type: "boolean", defaultValue: DEFAULT_SETTINGS.git.confirmSync },
  { id: "git.enableSmartCommit", key: "enableSmartCommit", section: "git", label: "Smart Commit", description: "Commit all changes when there are no staged changes.", type: "boolean", defaultValue: DEFAULT_SETTINGS.git.enableSmartCommit },
  { id: "git.pruneOnFetch", key: "pruneOnFetch", section: "git", label: "Prune On Fetch", description: "Prune when fetching.", type: "boolean", defaultValue: DEFAULT_SETTINGS.git.pruneOnFetch },
  { id: "git.postCommitCommand", key: "postCommitCommand", section: "git", label: "Post Commit Command", description: "The command to run after a successful commit.", type: "enum", defaultValue: DEFAULT_SETTINGS.git.postCommitCommand, enumValues: [
    { value: "none", label: "None" },
    { value: "push", label: "Push" },
    { value: "sync", label: "Sync" },
  ]},
  { id: "git.branchSortOrder", key: "branchSortOrder", section: "git", label: "Branch Sort Order", description: "Controls how branches are sorted.", type: "enum", defaultValue: DEFAULT_SETTINGS.git.branchSortOrder, enumValues: [
    { value: "alphabetically", label: "Alphabetically" },
    { value: "committerDate", label: "Committer Date" },
  ]},

  // HTTP Settings
  { id: "http.proxy", key: "proxy", section: "http", label: "Proxy", description: "The proxy setting to use.", type: "string", defaultValue: DEFAULT_SETTINGS.http.proxy, placeholder: "http://proxy.example.com:8080" },
  { id: "http.proxyStrictSSL", key: "proxyStrictSSL", section: "http", label: "Proxy Strict SSL", description: "Controls whether the proxy server certificate should be verified.", type: "boolean", defaultValue: DEFAULT_SETTINGS.http.proxyStrictSSL },
  { id: "http.proxySupport", key: "proxySupport", section: "http", label: "Proxy Support", description: "Use the proxy support for extensions.", type: "enum", defaultValue: DEFAULT_SETTINGS.http.proxySupport, enumValues: [
    { value: "off", label: "Off" },
    { value: "on", label: "On" },
    { value: "fallback", label: "Fallback" },
  ]},

  // AI Settings
  { id: "ai.supermavenEnabled", key: "supermavenEnabled", section: "ai", label: "Supermaven Enabled", description: "Enable Supermaven AI code completions.", type: "boolean", defaultValue: DEFAULT_SETTINGS.ai.supermavenEnabled, extensionId: "supermaven.supermaven" },
  { id: "ai.copilotEnabled", key: "copilotEnabled", section: "ai", label: "GitHub Copilot Enabled", description: "Enable GitHub Copilot.", type: "boolean", defaultValue: DEFAULT_SETTINGS.ai.copilotEnabled, extensionId: "github.copilot" },
  { id: "ai.inlineSuggestEnabled", key: "inlineSuggestEnabled", section: "ai", label: "Inline Suggestions", description: "Enable inline suggestions.", type: "boolean", defaultValue: DEFAULT_SETTINGS.ai.inlineSuggestEnabled },
  { id: "ai.inlineSuggestShowToolbar", key: "inlineSuggestShowToolbar", section: "ai", label: "Show Inline Suggest Toolbar", description: "Show toolbar for inline suggestions.", type: "boolean", defaultValue: DEFAULT_SETTINGS.ai.inlineSuggestShowToolbar },
  { id: "ai.defaultProvider", key: "defaultProvider", section: "ai", label: "Default Provider", description: "The default AI provider to use.", type: "string", defaultValue: DEFAULT_SETTINGS.ai.defaultProvider, tags: ["advanced"] },
  { id: "ai.defaultModel", key: "defaultModel", section: "ai", label: "Default Model", description: "The default AI model to use.", type: "string", defaultValue: DEFAULT_SETTINGS.ai.defaultModel, tags: ["advanced"] },

  // Zen Mode Settings
  { id: "zenMode.hideSidebar", key: "hideSidebar", section: "zenMode", label: "Hide Sidebar", description: "Hide the sidebar in zen mode.", type: "boolean", defaultValue: DEFAULT_SETTINGS.zenMode.hideSidebar },
  { id: "zenMode.hideStatusBar", key: "hideStatusBar", section: "zenMode", label: "Hide Status Bar", description: "Hide the status bar in zen mode.", type: "boolean", defaultValue: DEFAULT_SETTINGS.zenMode.hideStatusBar },
  { id: "zenMode.hidePanel", key: "hidePanel", section: "zenMode", label: "Hide Panel", description: "Hide the panel in zen mode.", type: "boolean", defaultValue: DEFAULT_SETTINGS.zenMode.hidePanel },
  { id: "zenMode.centerLayout", key: "centerLayout", section: "zenMode", label: "Center Layout", description: "Center the layout in zen mode.", type: "boolean", defaultValue: DEFAULT_SETTINGS.zenMode.centerLayout },
  { id: "zenMode.fullScreen", key: "fullScreen", section: "zenMode", label: "Full Screen", description: "Enter full screen in zen mode.", type: "boolean", defaultValue: DEFAULT_SETTINGS.zenMode.fullScreen },
  { id: "zenMode.silenceNotifications", key: "silenceNotifications", section: "zenMode", label: "Silence Notifications", description: "Silence notifications in zen mode.", type: "boolean", defaultValue: DEFAULT_SETTINGS.zenMode.silenceNotifications },

  // Search Settings
  { id: "search.useIgnoreFiles", key: "useIgnoreFiles", section: "search", label: "Use Ignore Files", description: "Controls whether to use .gitignore and .ignore files when searching.", type: "boolean", defaultValue: DEFAULT_SETTINGS.search.useIgnoreFiles },
  { id: "search.useGlobalIgnoreFiles", key: "useGlobalIgnoreFiles", section: "search", label: "Use Global Ignore Files", description: "Controls whether to use global .gitignore files.", type: "boolean", defaultValue: DEFAULT_SETTINGS.search.useGlobalIgnoreFiles },
  { id: "search.followSymlinks", key: "followSymlinks", section: "search", label: "Follow Symlinks", description: "Controls whether to follow symbolic links while searching.", type: "boolean", defaultValue: DEFAULT_SETTINGS.search.followSymlinks },
  { id: "search.contextLines", key: "contextLines", section: "search", label: "Context Lines", description: "Number of context lines to show around matches.", type: "number", defaultValue: DEFAULT_SETTINGS.search.contextLines, min: 0, max: 10 },

  // Debug Settings
  { id: "debug.toolbarLocation", key: "toolbarLocation", section: "debug", label: "Toolbar Location", description: "Controls the location of the debug toolbar.", type: "enum", defaultValue: DEFAULT_SETTINGS.debug.toolbarLocation, enumValues: [
    { value: "floating", label: "Floating" },
    { value: "docked", label: "Docked" },
    { value: "commandCenter", label: "Command Center" },
    { value: "hidden", label: "Hidden" },
  ]},
  { id: "debug.openDebugOnSessionStart", key: "openDebugOnSessionStart", section: "debug", label: "Open Debug On Session Start", description: "Automatically open the debug panel when a debug session starts.", type: "boolean", defaultValue: DEFAULT_SETTINGS.debug.openDebugOnSessionStart },
  { id: "debug.focusWindowOnBreak", key: "focusWindowOnBreak", section: "debug", label: "Focus Window On Break", description: "Focus the window when a breakpoint is hit.", type: "boolean", defaultValue: DEFAULT_SETTINGS.debug.focusWindowOnBreak },
  { id: "debug.focusEditorOnBreak", key: "focusEditorOnBreak", section: "debug", label: "Focus Editor On Break", description: "Focus the editor when a breakpoint is hit.", type: "boolean", defaultValue: DEFAULT_SETTINGS.debug.focusEditorOnBreak },

  // Workbench Editor Settings (Tab Sizing)
  { id: "workbench.editor.tabSizing", key: "tabSizing", section: "workbench" as keyof CortexSettings, subSection: "editor", label: "Tab Sizing", description: "Controls how tabs should be sized. 'fit' = minimum space needed, 'shrink' = shrink to fit with min width, 'fixed' = all tabs same width.", type: "enum", defaultValue: DEFAULT_WORKBENCH_EDITOR.tabSizing, enumValues: [
    { value: "fit", label: "Fit" },
    { value: "shrink", label: "Shrink" },
    { value: "fixed", label: "Fixed" },
  ]},
  { id: "workbench.editor.tabSizingFixedMinWidth", key: "tabSizingFixedMinWidth", section: "workbench" as keyof CortexSettings, subSection: "editor", label: "Tab Minimum Width (Shrink Mode)", description: "The minimum width of a tab when using shrink sizing mode (in pixels).", type: "number", defaultValue: DEFAULT_WORKBENCH_EDITOR.tabSizingFixedMinWidth, min: 50, max: 200 },
  { id: "workbench.editor.tabSizingFixedWidth", key: "tabSizingFixedWidth", section: "workbench" as keyof CortexSettings, subSection: "editor", label: "Tab Fixed Width", description: "The width of tabs when using fixed sizing mode (in pixels).", type: "number", defaultValue: DEFAULT_WORKBENCH_EDITOR.tabSizingFixedWidth, min: 80, max: 300 },
  { id: "workbench.editor.wrapTabs", key: "wrapTabs", section: "workbench" as keyof CortexSettings, subSection: "editor", label: "Wrap Tabs", description: "Wrap tabs to multiple lines instead of scrolling.", type: "boolean", defaultValue: DEFAULT_WORKBENCH_EDITOR.wrapTabs },
  { id: "workbench.editor.showTabCloseButton", key: "showTabCloseButton", section: "workbench" as keyof CortexSettings, subSection: "editor", label: "Show Tab Close Button", description: "Controls when the tab close button is shown.", type: "enum", defaultValue: DEFAULT_WORKBENCH_EDITOR.showTabCloseButton, enumValues: [
    { value: "always", label: "Always" },
    { value: "onHover", label: "On Hover" },
    { value: "never", label: "Never" },
  ]},
  { id: "workbench.editor.tabCloseButtonPosition", key: "tabCloseButtonPosition", section: "workbench" as keyof CortexSettings, subSection: "editor", label: "Tab Close Button Position", description: "Controls the position of the close button on tabs.", type: "enum", defaultValue: DEFAULT_WORKBENCH_EDITOR.tabCloseButtonPosition, enumValues: [
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ]},
];

/** TOC tree structure */
const TOC_TREE: TocItem[] = [
  {
    id: "editor",
    label: "Editor",
    icon: "pen-to-square",
    section: "editor",
    children: [
      { id: "editor.font", label: "Font", section: "editor" },
      { id: "editor.cursor", label: "Cursor", section: "editor" },
      { id: "editor.minimap", label: "Minimap", section: "editor" },
      { id: "editor.formatting", label: "Formatting", section: "editor" },
      { id: "editor.folding", label: "Folding", section: "editor" },
    ],
  },
  {
    id: "workbench",
    label: "Workbench",
    icon: "desktop",
    section: "theme",
    children: [
      { id: "workbench.appearance", label: "Appearance", section: "theme" },
      { id: "workbench.layout", label: "Layout", section: "theme" },
      { id: "workbench.editor", label: "Editor Tabs", section: "workbench" as keyof CortexSettings },
    ],
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: "terminal",
    section: "terminal",
  },
  {
    id: "files",
    label: "Files",
    icon: "folder",
    section: "files",
    children: [
      { id: "files.autosave", label: "Auto Save", section: "files" },
      { id: "files.encoding", label: "Encoding", section: "files" },
    ],
  },
  {
    id: "explorer",
    label: "Explorer",
    icon: "folder",
    section: "explorer",
  },
  {
    id: "search",
    label: "Search",
    icon: "magnifying-glass",
    section: "search",
  },
  {
    id: "git",
    label: "Git",
    icon: "code-branch",
    section: "git",
  },
  {
    id: "security",
    label: "Security",
    icon: "shield",
    section: "security",
  },
  {
    id: "network",
    label: "Network",
    icon: "globe",
    section: "http",
  },
  {
    id: "ai",
    label: "AI",
    icon: "microchip",
    section: "ai",
  },
  {
    id: "zenMode",
    label: "Zen Mode",
    icon: "bolt",
    section: "zenMode",
  },
  {
    id: "debug",
    label: "Debug",
    icon: "code",
    section: "debug",
  },
  {
    id: "extensions",
    label: "Extensions",
    icon: "box",
  },
];

// =============================================================================
// SEARCH FILTER PARSING & APPLICATION
// =============================================================================

/** Available filter suggestions for autocomplete */
const FILTER_SUGGESTIONS: FilterSuggestion[] = [
  { filter: "@modified", label: "@modified", description: "Show only modified settings" },
  { filter: "@ext:", label: "@ext:extensionId", description: "Filter by extension ID" },
  { filter: "@lang:", label: "@lang:languageId", description: "Filter by language (e.g., @lang:typescript)" },
  { filter: "@tag:", label: "@tag:tagName", description: "Filter by tag (experimental, preview, deprecated)" },
  { filter: "@id:", label: "@id:settingId", description: "Filter by setting ID" },
];

// Available tags for @tag: filter (for future autocomplete suggestions)
// const AVAILABLE_TAGS: SettingTag[] = ["experimental", "preview", "deprecated", "advanced", "core"];

// Available language IDs for @lang: filter (for future autocomplete suggestions)
// const COMMON_LANGUAGE_IDS = [
//   "javascript", "typescript", "python", "java", "csharp", "cpp", "c",
//   "go", "rust", "ruby", "php", "html", "css", "scss", "json", "yaml",
//   "markdown", "xml", "sql", "shell", "powershell", "dockerfile",
// ];

/**
 * Parse a search query into text and filters
 * Supports: @modified, @ext:extensionId, @lang:languageId, @tag:tagName, @id:settingId
 */
function parseSearchQuery(query: string): { text: string; filters: SettingFilter[] } {
  const filters: SettingFilter[] = [];
  let text = query;

  // @modified - show only modified settings
  if (text.includes("@modified")) {
    filters.push({ type: "modified" });
    text = text.replace(/@modified/g, "");
  }

  // @ext:extensionId - filter by extension
  let extMatch: RegExpExecArray | null;
  const extRegex = /@ext:(\S+)/g;
  while ((extMatch = extRegex.exec(text)) !== null) {
    filters.push({ type: "extension", value: extMatch[1].toLowerCase() });
  }
  text = text.replace(/@ext:\S+/g, "");

  // @lang:languageId - filter by language
  let langMatch: RegExpExecArray | null;
  const langRegex = /@lang:(\S+)/g;
  while ((langMatch = langRegex.exec(text)) !== null) {
    filters.push({ type: "language", value: langMatch[1].toLowerCase() });
  }
  text = text.replace(/@lang:\S+/g, "");

  // @tag:tagName - filter by tag (experimental, preview, deprecated)
  let tagMatch: RegExpExecArray | null;
  const tagRegex = /@tag:(\S+)/g;
  while ((tagMatch = tagRegex.exec(text)) !== null) {
    filters.push({ type: "tag", value: tagMatch[1].toLowerCase() });
  }
  text = text.replace(/@tag:\S+/g, "");

  // @id:settingId - filter by setting ID
  let idMatch: RegExpExecArray | null;
  const idRegex = /@id:(\S+)/g;
  while ((idMatch = idRegex.exec(text)) !== null) {
    filters.push({ type: "id", value: idMatch[1].toLowerCase() });
  }
  text = text.replace(/@id:\S+/g, "");

  return { text: text.trim(), filters };
}

/**
 * Filter settings based on parsed filters
 * @param settings - Array of settings to filter
 * @param filters - Parsed filters to apply
 * @param isSettingModified - Function to check if a setting is modified
 * @returns Filtered array of settings
 */
function filterSettingsByFilters(
  settings: SettingDefinition[],
  filters: SettingFilter[],
  isSettingModified: (section: keyof CortexSettings, key: string) => boolean
): SettingDefinition[] {
  if (filters.length === 0) return settings;

  return settings.filter((setting) => {
    for (const filter of filters) {
      switch (filter.type) {
        case "modified":
          if (!isSettingModified(setting.section, setting.key)) return false;
          break;

        case "extension":
          if (!setting.extensionId || !setting.extensionId.toLowerCase().includes(filter.value!)) {
            return false;
          }
          break;

        case "language":
          if (!setting.languageOverride || !setting.languageOverride.some(
            lang => lang.toLowerCase().includes(filter.value!)
          )) {
            return false;
          }
          break;

        case "tag":
          if (!setting.tags || !setting.tags.some(
            tag => tag.toLowerCase() === filter.value!
          )) {
            return false;
          }
          break;

        case "id":
          if (!setting.id.toLowerCase().includes(filter.value!)) {
            return false;
          }
          break;
      }
    }
    return true;
  });
}

/**
 * Filter settings by text search (label, description, id)
 */
function filterSettingsByText(
  settings: SettingDefinition[],
  searchText: string
): SettingDefinition[] {
  if (!searchText) return settings;
  
  const query = searchText.toLowerCase();
  return settings.filter((setting) =>
    setting.label.toLowerCase().includes(query) ||
    setting.description.toLowerCase().includes(query) ||
    setting.id.toLowerCase().includes(query)
  );
}

/**
 * Get autocomplete suggestions based on current input
 */
function getFilterSuggestions(input: string): FilterSuggestion[] {
  if (!input.includes("@")) return [];
  
  // Find the last @ in the input
  const lastAtIndex = input.lastIndexOf("@");
  const afterAt = input.slice(lastAtIndex);
  
  // If we're typing after @, show suggestions
  if (afterAt === "@") {
    return FILTER_SUGGESTIONS;
  }
  
  // Filter suggestions based on partial match
  return FILTER_SUGGESTIONS.filter(s => 
    s.filter.toLowerCase().startsWith(afterAt.toLowerCase())
  );
}

/**
 * Get settings scope tabs for multi-root workspaces
 */
function getSettingsTabs(workspaceFolders: WorkspaceFolder[], hasWorkspace: boolean): SettingsScopeTab[] {
  const tabs: SettingsScopeTab[] = [
    { id: "user", label: "User", scope: "user", icon: "user" },
  ];

  if (hasWorkspace) {
    tabs.push({ id: "workspace", label: "Workspace", scope: "workspace", icon: "gear" });
  }

  // Add tab per workspace folder if multi-root (more than 1 folder)
  if (workspaceFolders.length > 1) {
    workspaceFolders.forEach((folder) => {
      tabs.push({
        id: `folder-${folder.path}`,
        label: folder.name,
        scope: "folder",
        folderPath: folder.path,
        icon: "folder",
      });
    });
  }

  return tabs;
}

// =============================================================================
// FILTER AUTOCOMPLETE COMPONENT
// =============================================================================

function FilterAutocomplete(props: {
  suggestions: FilterSuggestion[];
  onSelect: (filter: string) => void;
  visible: boolean;
}) {
  return (
    <Show when={props.visible && props.suggestions.length > 0}>
      <div
        style={{
          position: "absolute",
          top: "100%",
          left: "0",
          right: "0",
          "margin-top": "4px",
          background: tokens.colors.surface.modal,
          border: `1px solid ${tokens.colors.border.default}`,
          "border-radius": tokens.radius.md,
          "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.3)",
          "z-index": "1000",
          overflow: "hidden",
        }}
      >
        <For each={props.suggestions}>
          {(suggestion) => (
            <button
              onClick={() => props.onSelect(suggestion.filter)}
              style={{
                display: "flex",
                "flex-direction": "column",
                gap: "2px",
                width: "100%",
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                "text-align": "left",
                cursor: "pointer",
                color: tokens.colors.text.primary,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ "font-weight": "500", "font-family": "var(--jb-font-code)", "font-size": "12px" }}>
                {suggestion.label}
              </span>
              <span style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                {suggestion.description}
              </span>
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}

// =============================================================================
// ACTIVE FILTERS DISPLAY
// =============================================================================

function ActiveFiltersDisplay(props: {
  filters: SettingFilter[];
  onRemoveFilter: (index: number) => void;
  onClearAll: () => void;
}) {
  const getFilterLabel = (filter: SettingFilter): string => {
    switch (filter.type) {
      case "modified": return "@modified";
      case "extension": return `@ext:${filter.value}`;
      case "language": return `@lang:${filter.value}`;
      case "tag": return `@tag:${filter.value}`;
      case "id": return `@id:${filter.value}`;
      default: return "";
    }
  };

  const getFilterColor = (filter: SettingFilter): string => {
    switch (filter.type) {
      case "modified": return "var(--cortex-warning)"; // Yellow
      case "extension": return "var(--cortex-info)"; // Blue
      case "language": return "var(--cortex-success)"; // Green
      case "tag": return "var(--cortex-info)"; // Purple
      case "id": return "var(--cortex-warning)"; // Orange
      default: return tokens.colors.text.muted;
    }
  };

  return (
    <Show when={props.filters.length > 0}>
      <div style={{ display: "flex", "align-items": "center", gap: "6px", "flex-wrap": "wrap" }}>
        <For each={props.filters}>
          {(filter, index) => (
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "4px",
                padding: "2px 8px",
                background: `${getFilterColor(filter)}20`,
                border: `1px solid ${getFilterColor(filter)}40`,
                "border-radius": tokens.radius.sm,
                "font-size": "11px",
                "font-family": "var(--jb-font-code)",
                color: getFilterColor(filter),
              }}
            >
              <span>{getFilterLabel(filter)}</span>
              <button
                onClick={() => props.onRemoveFilter(index())}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "0",
                  display: "flex",
                  "align-items": "center",
                  color: getFilterColor(filter),
                }}
              >
                <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
              </button>
            </div>
          )}
        </For>
        <button
          onClick={props.onClearAll}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.colors.text.muted,
            "font-size": "11px",
            padding: "2px 6px",
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
          onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.muted}
        >
          Clear all
        </button>
      </div>
    </Show>
  );
}

// =============================================================================
// SETTINGS SCOPE TABS COMPONENT
// =============================================================================

function SettingsScopeTabs(props: {
  tabs: SettingsScopeTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: "2px",
        padding: "4px",
        background: tokens.colors.surface.canvas,
        "border-radius": tokens.radius.lg,
        border: `1px solid ${tokens.colors.border.default}`,
        overflow: "auto",
        "max-width": "100%",
      }}
    >
      <For each={props.tabs}>
        {(tab) => {
          const isActive = () => props.activeTab === tab.id;
          const isFolder = () => tab.scope === "folder";
          
          return (
            <button
              onClick={() => props.onTabChange(tab.id)}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "6px",
                padding: "6px 12px",
                background: isActive()
                  ? tab.scope === "folder"
                    ? "var(--cortex-success)" // Teal for folder
                    : tab.scope === "workspace"
                      ? "var(--cortex-info)" // Purple for workspace
                      : tokens.colors.semantic.primary
                  : "transparent",
                border: "none",
                "border-radius": tokens.radius.md,
                cursor: "pointer",
                color: isActive() ? "#fff" : tokens.colors.text.secondary,
                "font-size": "12px",
                "font-weight": isActive() ? "500" : "400",
                "white-space": "nowrap",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive()) {
                  e.currentTarget.style.background = tokens.colors.interactive.hover;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive()) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
              title={isFolder() ? `Folder settings: ${tab.folderPath}` : `${tab.label} settings`}
            >
              <Show when={tab.icon}>
                <Icon name={tab.icon!} style={{ width: "12px", height: "12px" }} />
              </Show>
              <span style={{ "max-width": "120px", overflow: "hidden", "text-overflow": "ellipsis" }}>
                {tab.label}
              </span>
            </button>
          );
        }}
      </For>
    </div>
  );
}

// =============================================================================
// TAG BADGE COMPONENT
// =============================================================================

function SettingTagBadge(props: { tag: SettingTag }) {
  const getTagStyle = () => {
    switch (props.tag) {
      case "experimental":
        return { bg: "rgba(234, 179, 8, 0.2)", color: "var(--cortex-warning)", icon: "triangle-exclamation" };
      case "preview":
        return { bg: "rgba(59, 130, 246, 0.2)", color: "var(--cortex-info)", icon: "circle-info" };
      case "deprecated":
        return { bg: "rgba(239, 68, 68, 0.2)", color: "var(--cortex-error)", icon: "triangle-exclamation" };
      case "advanced":
        return { bg: "rgba(168, 85, 247, 0.2)", color: "var(--cortex-info)", icon: "gear" };
      case "core":
        return { bg: "rgba(34, 197, 94, 0.2)", color: "var(--cortex-success)", icon: "check" };
      default:
        return { bg: tokens.colors.surface.panel, color: tokens.colors.text.muted, icon: "tag" };
    }
  };

  const style = getTagStyle();

  return (
    <span
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: "4px",
        padding: "2px 6px",
        background: style.bg,
        color: style.color,
        "border-radius": tokens.radius.sm,
        "font-size": "10px",
        "font-weight": "500",
        "text-transform": "capitalize",
      }}
    >
      <Icon name={style.icon} style={{ width: "10px", height: "10px" }} />
      {props.tag}
    </span>
  );
}

// =============================================================================
// TOC TREE COMPONENT
// =============================================================================

function TocTreeItem(props: {
  item: TocItem;
  activeSection: string;
  onSelect: (id: string) => void;
  depth: number;
  getModifiedCount: (sectionId: string) => number;
  showModifiedOnly: boolean;
  searchQuery: string;
}) {
  const [isExpanded, setIsExpanded] = createSignal(true);
  const hasChildren = () => props.item.children && props.item.children.length > 0;

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (hasChildren()) {
      setIsExpanded(!isExpanded());
    }
    props.onSelect(props.item.id);
  };

  const modifiedCount = () => {
    if (props.item.section) {
      return props.getModifiedCount(props.item.section);
    }
    return 0;
  };

  const totalModifiedCount = (): number => {
    let total = modifiedCount();
    if (props.item.children) {
      for (const child of props.item.children) {
        if (child.section) {
          total += props.getModifiedCount(child.section);
        }
      }
    }
    return total;
  };

  const hasModifications = () => totalModifiedCount() > 0;

  // Filter by search query
  const matchesSearch = () => {
    if (!props.searchQuery) return true;
    const query = props.searchQuery.toLowerCase();
    return props.item.label.toLowerCase().includes(query);
  };

  const shouldShow = () => {
    if (!matchesSearch()) return false;
    if (props.showModifiedOnly && !hasModifications()) return false;
    return true;
  };

  const isActive = () => props.activeSection === props.item.id || props.activeSection.startsWith(props.item.id + ".");

  return (
    <Show when={shouldShow()}>
      <div class="settings-toc-node">
        <button
          onClick={handleClick}
          style={{
            display: "flex",
            "align-items": "center",
            width: "100%",
            gap: "6px",
            padding: `6px 8px 6px ${8 + props.depth * 16}px`,
            background: isActive() ? tokens.colors.interactive.selected : "transparent",
            border: "none",
            "border-radius": tokens.radius.sm,
            cursor: "pointer",
            color: isActive() ? tokens.colors.text.primary : tokens.colors.text.secondary,
            "font-size": "13px",
            "font-weight": isActive() ? "500" : "400",
            "text-align": "left",
            transition: "background 0.1s, color 0.1s",
          }}
          onMouseEnter={(e) => {
            if (!isActive()) {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive()) {
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          {/* Expand/Collapse Arrow */}
          <span style={{ width: "14px", "flex-shrink": "0", display: "flex", "align-items": "center", "justify-content": "center" }}>
            <Show when={hasChildren()}>
              <Show when={isExpanded()} fallback={<Icon name="chevron-right" style={{ width: "12px", height: "12px" }} />}>
                <Icon name="chevron-down" style={{ width: "12px", height: "12px" }} />
              </Show>
            </Show>
          </span>

          {/* Icon */}
          <Show when={props.item.icon && props.depth === 0}>
            <Icon name={props.item.icon!} style={{ width: "14px", height: "14px", "flex-shrink": "0", color: tokens.colors.icon.default }} />
          </Show>

          {/* Label */}
          <span style={{ flex: "1", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
            {props.item.label}
          </span>

          {/* Modified Count Badge */}
          <Show when={totalModifiedCount() > 0}>
            <Badge size="sm" style={{ 
              background: "rgba(234, 179, 8, 0.2)", 
              color: "var(--cortex-warning)",
              "font-size": "10px",
              padding: "2px 6px",
            }}>
              {totalModifiedCount()}
            </Badge>
          </Show>
        </button>

        {/* Children */}
        <Show when={hasChildren() && isExpanded()}>
          <div style={{ "margin-left": "0" }}>
            <For each={props.item.children}>
              {(child) => (
                <TocTreeItem
                  item={child}
                  activeSection={props.activeSection}
                  onSelect={props.onSelect}
                  depth={props.depth + 1}
                  getModifiedCount={props.getModifiedCount}
                  showModifiedOnly={props.showModifiedOnly}
                  searchQuery={props.searchQuery}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// =============================================================================
// SETTING RENDERERS
// =============================================================================

/** Boolean setting renderer */
function BooleanRenderer(props: {
  setting: SettingDefinition;
  value: boolean;
  onChange: (value: boolean) => void;
  isModified: boolean;
  hasOverride: boolean;
  onReset: () => void;
  onResetToDefault: () => void;
}) {
  return (
    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
      <Toggle
        checked={props.value}
        onChange={props.onChange}
      />
      <Show when={props.hasOverride}>
        <button
          onClick={props.onReset}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--cortex-info)",
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "border-radius": tokens.radius.sm,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          title="Reset to user setting"
        >
          <Icon name="rotate-left" style={{ width: "14px", height: "14px" }} />
        </button>
      </Show>
      <Show when={props.isModified && !props.hasOverride}>
        <button
          onClick={props.onResetToDefault}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.colors.text.muted,
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "border-radius": tokens.radius.sm,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          title="Reset to default"
        >
          <Icon name="rotate-left" style={{ width: "14px", height: "14px" }} />
        </button>
      </Show>
    </div>
  );
}

/** String setting renderer */
function StringRenderer(props: {
  setting: SettingDefinition;
  value: string;
  onChange: (value: string) => void;
  isModified: boolean;
  hasOverride: boolean;
  onReset: () => void;
  onResetToDefault: () => void;
}) {
  return (
    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
      <Input
        value={props.value || ""}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder={props.setting.placeholder || `Enter ${props.setting.label.toLowerCase()}`}
        style={{ width: "300px" }}
      />
      <Show when={props.hasOverride}>
        <button
          onClick={props.onReset}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--cortex-info)",
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "border-radius": tokens.radius.sm,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          title="Reset to user setting"
        >
          <Icon name="rotate-left" style={{ width: "14px", height: "14px" }} />
        </button>
      </Show>
      <Show when={props.isModified && !props.hasOverride}>
        <button
          onClick={props.onResetToDefault}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.colors.text.muted,
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "border-radius": tokens.radius.sm,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          title="Reset to default"
        >
          <Icon name="rotate-left" style={{ width: "14px", height: "14px" }} />
        </button>
      </Show>
    </div>
  );
}

/** Number setting renderer */
function NumberRenderer(props: {
  setting: SettingDefinition;
  value: number;
  onChange: (value: number) => void;
  isModified: boolean;
  hasOverride: boolean;
  onReset: () => void;
  onResetToDefault: () => void;
}) {
  return (
    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
      <input
        type="number"
        value={props.value}
        min={props.setting.min}
        max={props.setting.max}
        step={props.setting.step || 1}
        onInput={(e) => {
          const val = parseFloat(e.currentTarget.value);
          if (!isNaN(val)) {
            props.onChange(val);
          }
        }}
        style={{
          width: "100px",
          height: "28px",
          padding: "4px 8px",
          background: tokens.colors.surface.panel,
          border: `1px solid ${tokens.colors.border.default}`,
          "border-radius": tokens.radius.sm,
          color: tokens.colors.text.primary,
          "font-size": "13px",
          outline: "none",
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = tokens.colors.border.focus}
        onBlur={(e) => e.currentTarget.style.borderColor = tokens.colors.border.default}
      />
      <Show when={props.setting.min !== undefined && props.setting.max !== undefined}>
        <Text size="xs" style={{ color: tokens.colors.text.muted }}>
          ({props.setting.min} - {props.setting.max})
        </Text>
      </Show>
      <Show when={props.hasOverride}>
        <button
          onClick={props.onReset}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--cortex-info)",
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "border-radius": tokens.radius.sm,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          title="Reset to user setting"
        >
          <Icon name="rotate-left" style={{ width: "14px", height: "14px" }} />
        </button>
      </Show>
      <Show when={props.isModified && !props.hasOverride}>
        <button
          onClick={props.onResetToDefault}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.colors.text.muted,
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "border-radius": tokens.radius.sm,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          title="Reset to default"
        >
          <Icon name="rotate-left" style={{ width: "14px", height: "14px" }} />
        </button>
      </Show>
    </div>
  );
}

/** Enum setting renderer */
function EnumRenderer(props: {
  setting: SettingDefinition;
  value: string;
  onChange: (value: string) => void;
  isModified: boolean;
  hasOverride: boolean;
  onReset: () => void;
  onResetToDefault: () => void;
}) {
  return (
    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.currentTarget.value)}
        style={{
          height: "28px",
          padding: "4px 28px 4px 8px",
          background: tokens.colors.surface.panel,
          border: `1px solid ${tokens.colors.border.default}`,
          "border-radius": tokens.radius.sm,
          color: tokens.colors.text.primary,
          "font-size": "13px",
          outline: "none",
          cursor: "pointer",
          appearance: "none",
          "background-image": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          "background-repeat": "no-repeat",
          "background-position": "right 8px center",
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = tokens.colors.border.focus}
        onBlur={(e) => e.currentTarget.style.borderColor = tokens.colors.border.default}
      >
        <For each={props.setting.enumValues || []}>
          {(option) => (
            <option value={option.value}>{option.label}</option>
          )}
        </For>
      </select>
      <Show when={props.hasOverride}>
        <button
          onClick={props.onReset}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--cortex-info)",
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "border-radius": tokens.radius.sm,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          title="Reset to user setting"
        >
          <Icon name="rotate-left" style={{ width: "14px", height: "14px" }} />
        </button>
      </Show>
      <Show when={props.isModified && !props.hasOverride}>
        <button
          onClick={props.onResetToDefault}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.colors.text.muted,
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "border-radius": tokens.radius.sm,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          title="Reset to default"
        >
          <Icon name="rotate-left" style={{ width: "14px", height: "14px" }} />
        </button>
      </Show>
    </div>
  );
}

/** Array setting renderer with add/remove */
function ArrayRenderer(props: {
  setting: SettingDefinition;
  value: string[];
  onChange: (value: string[]) => void;
  isModified: boolean;
  hasOverride: boolean;
  onReset: () => void;
  onResetToDefault: () => void;
}) {
  const [newItem, setNewItem] = createSignal("");

  const addItem = () => {
    const item = newItem().trim();
    if (item && !props.value.includes(item)) {
      props.onChange([...props.value, item]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    props.onChange(props.value.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
      {/* Existing items */}
      <div style={{ display: "flex", "flex-wrap": "wrap", gap: "6px" }}>
        <For each={props.value}>
          {(item, index) => (
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
              padding: "4px 8px",
              background: tokens.colors.surface.panel,
              border: `1px solid ${tokens.colors.border.default}`,
              "border-radius": tokens.radius.sm,
              "font-size": "12px",
            }}>
              <span>{item}</span>
              <button
                onClick={() => removeItem(index())}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: tokens.colors.text.muted,
                  padding: "2px",
                  display: "flex",
                  "align-items": "center",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.semantic.error}
                onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.muted}
              >
                <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
              </button>
            </div>
          )}
        </For>
      </div>

      {/* Add new item */}
      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <Input
          value={newItem()}
          onInput={(e) => setNewItem(e.currentTarget.value)}
          placeholder="Add item..."
          style={{ width: "200px" }}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              addItem();
            }
          }}
        />
        <Button variant="ghost" size="sm" onClick={addItem} disabled={!newItem().trim()}>
          <Icon name="plus" style={{ width: "14px", height: "14px" }} />
          Add
        </Button>
      </div>

      {/* Reset buttons */}
      <div style={{ display: "flex", gap: "8px" }}>
        <Show when={props.hasOverride}>
          <Button variant="ghost" size="sm" onClick={props.onReset} style={{ color: "var(--cortex-info)" }}>
            <Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />
            Reset to user setting
          </Button>
        </Show>
        <Show when={props.isModified && !props.hasOverride}>
          <Button variant="ghost" size="sm" onClick={props.onResetToDefault}>
            <Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />
            Reset to default
          </Button>
        </Show>
      </div>
    </div>
  );
}

/** Object setting renderer with key-value pairs */
function ObjectRenderer(props: {
  setting: SettingDefinition;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  isModified: boolean;
  hasOverride: boolean;
  onReset: () => void;
  onResetToDefault: () => void;
}) {
  const [newKey, setNewKey] = createSignal("");
  const [newValue, setNewValue] = createSignal("");
  const [showJson, setShowJson] = createSignal(false);
  const [jsonText, setJsonText] = createSignal("");

  createEffect(() => {
    setJsonText(JSON.stringify(props.value, null, 2));
  });

  const addEntry = () => {
    const key = newKey().trim();
    const val = newValue().trim();
    if (key) {
      props.onChange({ ...props.value, [key]: val || true });
      setNewKey("");
      setNewValue("");
    }
  };

  const removeEntry = (key: string) => {
    const newObj = { ...props.value };
    delete newObj[key];
    props.onChange(newObj);
  };

  const saveJson = () => {
    try {
      const parsed = JSON.parse(jsonText());
      props.onChange(parsed);
      setShowJson(false);
    } catch (e) {
      // Invalid JSON
    }
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
      <Show when={!showJson()}>
        {/* Key-value pairs view */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
          <For each={Object.entries(props.value)}>
            {([key, val]) => (
              <div style={{
                display: "flex",
                "align-items": "center",
                gap: "8px",
                padding: "6px 8px",
                background: tokens.colors.surface.panel,
                border: `1px solid ${tokens.colors.border.default}`,
                "border-radius": tokens.radius.sm,
              }}>
                <span style={{ "font-weight": "500", color: tokens.colors.text.primary, "min-width": "120px" }}>{key}</span>
                <span style={{ color: tokens.colors.text.muted, flex: "1" }}>{String(val)}</span>
                <button
                  onClick={() => removeEntry(key)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: tokens.colors.text.muted,
                    padding: "4px",
                    display: "flex",
                    "align-items": "center",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.semantic.error}
                  onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.muted}
                >
                  <Icon name="minus" style={{ width: "14px", height: "14px" }} />
                </button>
              </div>
            )}
          </For>
        </div>

        {/* Add new entry */}
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Input
            value={newKey()}
            onInput={(e) => setNewKey(e.currentTarget.value)}
            placeholder="Key"
            style={{ width: "120px" }}
          />
          <Input
            value={newValue()}
            onInput={(e) => setNewValue(e.currentTarget.value)}
            placeholder="Value"
            style={{ width: "160px" }}
          />
          <Button variant="ghost" size="sm" onClick={addEntry} disabled={!newKey().trim()}>
            <Icon name="plus" style={{ width: "14px", height: "14px" }} />
            Add
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowJson(true)}>
            Edit as JSON
          </Button>
        </div>
      </Show>

      <Show when={showJson()}>
        {/* JSON editor */}
        <textarea
          value={jsonText()}
          onInput={(e) => setJsonText(e.currentTarget.value)}
          style={{
            width: "100%",
            height: "150px",
            padding: "8px",
            background: tokens.colors.surface.canvas,
            border: `1px solid ${tokens.colors.border.default}`,
            "border-radius": tokens.radius.sm,
            color: tokens.colors.text.primary,
            "font-family": "var(--jb-font-code)",
            "font-size": "12px",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="primary" size="sm" onClick={saveJson}>
            Save JSON
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowJson(false)}>
            Cancel
          </Button>
        </div>
      </Show>

      {/* Reset buttons */}
      <div style={{ display: "flex", gap: "8px" }}>
        <Show when={props.hasOverride}>
          <Button variant="ghost" size="sm" onClick={props.onReset} style={{ color: "var(--cortex-info)" }}>
            <Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />
            Reset to user setting
          </Button>
        </Show>
        <Show when={props.isModified && !props.hasOverride}>
          <Button variant="ghost" size="sm" onClick={props.onResetToDefault}>
            <Icon name="rotate-left" style={{ width: "12px", height: "12px" }} />
            Reset to default
          </Button>
        </Show>
      </div>
    </div>
  );
}

// =============================================================================
// SETTING ITEM COMPONENT
// =============================================================================

function SettingItem(props: {
  setting: SettingDefinition;
  scope: SettingsScope;
  folderPath?: string;
  searchQuery: string;
  parsedFilters: SettingFilter[];
  searchText: string;
}) {
  const settings = useSettings();
  
  // Try to use optional contexts - handle cases where they're not available
  let settingsSync: ReturnType<typeof useSettingsSync> | null = null;
  let policySettings: ReturnType<typeof usePolicySettings> | null = null;
  let workspaceTrust: ReturnType<typeof useWorkspaceTrust> | null = null;
  
  try {
    settingsSync = useSettingsSync();
  } catch {
    // SettingsSyncContext not available
  }
  
  try {
    policySettings = usePolicySettings();
  } catch {
    // PolicySettingsContext not available
  }
  
  try {
    workspaceTrust = useWorkspaceTrust();
  } catch {
    // WorkspaceTrustContext not available
  }

  // Get current value based on scope
  const currentValue = createMemo(() => {
    if (props.scope === "folder" && props.folderPath) {
      const folderSettings = settings.getEffectiveSettingsForPath(props.folderPath);
      const section = folderSettings[props.setting.section];
      if (section && typeof section === "object") {
        return (section as Record<string, unknown>)[props.setting.key] ?? props.setting.defaultValue;
      }
    }
    const section = settings.effectiveSettings()[props.setting.section];
    if (!section || typeof section !== "object") return props.setting.defaultValue;
    return (section as Record<string, unknown>)[props.setting.key] ?? props.setting.defaultValue;
  });

  // Check if modified from default
  // Note: Dynamic setting key access requires bypassing strict type checking
  const isModified = createMemo(() => {
    // @ts-expect-error Dynamic key access for settings - key comes from SettingDefinition
    return settings.isSettingModified(props.setting.section, props.setting.key);
  });

  // Check if has workspace override
  const hasOverride = createMemo(() => {
    if (props.scope === "folder" && props.folderPath) {
      // @ts-expect-error Dynamic key access for settings
      return settings.hasFolderOverride(props.folderPath, props.setting.section, props.setting.key);
    }
    // @ts-expect-error Dynamic key access for settings
    return settings.hasWorkspaceOverride(props.setting.section, props.setting.key);
  });

  // Get setting source (useful for showing source indicator in UI)
  const _source = createMemo(() => {
    // @ts-expect-error Dynamic key access for settings
    return settings.getSettingSource(props.setting.section, props.setting.key);
  });
  void _source; // Mark as intentionally unused
  
  // Check if setting is policy-controlled (enterprise)
  const isPolicyControlled = createMemo(() => {
    if (!policySettings) return false;
    return policySettings.isPolicyControlled(props.setting.id);
  });
  
  // Get policy description if controlled (reserved for future enterprise features)
  const _policyDescription = createMemo(() => {
    if (!policySettings || !isPolicyControlled()) return null;
    return policySettings.getPolicyDescription(props.setting.id);
  });
  void _policyDescription; // Mark as intentionally unused
  
  // Check if setting is restricted in untrusted workspace
  const isRestricted = createMemo(() => {
    if (!workspaceTrust) return false;
    const trustLevel = workspaceTrust.trustLevel?.() ?? "unknown";
    if (trustLevel === "trusted" || trustLevel === "unknown") return false;
    return isSettingRestricted(props.setting.id);
  });
  
  // Get restriction reason (reserved for future use)
  const _restrictionReason = createMemo(() => {
    if (!isRestricted()) return null;
    return getSettingRestrictionReason(props.setting.id);
  });
  void _restrictionReason; // Mark as intentionally unused
  
  // Check if sync is enabled and if this setting syncs (reserved for future sync indicators)
  const _isSyncEnabled = createMemo(() => {
    if (!settingsSync) return false;
    const state = settingsSync.state;
    return state?.enabled && state?.syncItems?.settings?.enabled || false;
  });
  void _isSyncEnabled; // Mark as intentionally unused
  
  // Check if setting is disabled (policy or restricted) (reserved for future disabling features)
  const _isDisabled = createMemo(() => {
    return isPolicyControlled() || isRestricted();
  });
  void _isDisabled; // Mark as intentionally unused

  // Update setting value based on scope
  const updateValue = async (value: unknown) => {
    if (props.scope === "folder" && props.folderPath) {
      // @ts-expect-error Dynamic key access for settings
      await settings.setFolderSetting(props.folderPath, props.setting.section, props.setting.key, value);
    } else if (props.scope === "workspace" && settings.hasWorkspace()) {
      // @ts-expect-error Dynamic key access for settings
      await settings.setWorkspaceSetting(props.setting.section, props.setting.key, value);
    } else {
      const section = settings.effectiveSettings()[props.setting.section];
      if (section && typeof section === "object") {
        const newSection = { ...section, [props.setting.key]: value };
        // @ts-expect-error Dynamic section update
        await settings.updateSettings(props.setting.section, newSection);
      }
    }
  };

  // Reset to parent scope setting
  const resetOverride = () => {
    if (props.scope === "folder" && props.folderPath) {
      // @ts-expect-error Dynamic key access for settings
      settings.resetFolderSetting(props.folderPath, props.setting.section, props.setting.key);
    } else {
      // @ts-expect-error Dynamic key access for settings
      settings.resetWorkspaceSetting(props.setting.section, props.setting.key);
    }
  };

  // Reset to default
  const resetToDefault = () => {
    // @ts-expect-error Dynamic key access for settings
    settings.resetSettingToDefault(props.setting.section, props.setting.key);
  };

  // Match search query - now uses pre-parsed filters
  const matchesSearch = createMemo(() => {
    // If we have filters, they're already applied at the parent level
    // Just check text search
    if (!props.searchText) return true;
    
    const query = props.searchText.toLowerCase();
    return (
      props.setting.label.toLowerCase().includes(query) ||
      props.setting.description.toLowerCase().includes(query) ||
      props.setting.id.toLowerCase().includes(query)
    );
  });

  // Render based on type
  const renderValue = () => {
    const val = currentValue();

    switch (props.setting.type) {
      case "boolean":
        return (
          <BooleanRenderer
            setting={props.setting}
            value={val as boolean}
            onChange={updateValue}
            isModified={isModified()}
            hasOverride={hasOverride()}
            onReset={resetOverride}
            onResetToDefault={resetToDefault}
          />
        );

      case "string":
        return (
          <StringRenderer
            setting={props.setting}
            value={val as string}
            onChange={updateValue}
            isModified={isModified()}
            hasOverride={hasOverride()}
            onReset={resetOverride}
            onResetToDefault={resetToDefault}
          />
        );

      case "number":
        return (
          <NumberRenderer
            setting={props.setting}
            value={val as number}
            onChange={updateValue}
            isModified={isModified()}
            hasOverride={hasOverride()}
            onReset={resetOverride}
            onResetToDefault={resetToDefault}
          />
        );

      case "enum":
        return (
          <EnumRenderer
            setting={props.setting}
            value={val as string}
            onChange={updateValue}
            isModified={isModified()}
            hasOverride={hasOverride()}
            onReset={resetOverride}
            onResetToDefault={resetToDefault}
          />
        );

      case "array":
        return (
          <ArrayRenderer
            setting={props.setting}
            value={(val as string[]) || []}
            onChange={updateValue}
            isModified={isModified()}
            hasOverride={hasOverride()}
            onReset={resetOverride}
            onResetToDefault={resetToDefault}
          />
        );

      case "object":
        return (
          <ObjectRenderer
            setting={props.setting}
            value={(val as Record<string, unknown>) || {}}
            onChange={updateValue}
            isModified={isModified()}
            hasOverride={hasOverride()}
            onReset={resetOverride}
            onResetToDefault={resetToDefault}
          />
        );

      default:
        return <Text size="sm" style={{ color: tokens.colors.text.muted }}>Unknown type</Text>;
    }
  };

  return (
    <Show when={matchesSearch()}>
      <div
        class="settings-item"
        style={{
          padding: "16px",
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          position: "relative",
        }}
      >
        {/* Modified indicator - 2px left border */}
        <Show when={isModified() || hasOverride()}>
          <div
            style={{
              position: "absolute",
              left: "0",
              top: "0",
              bottom: "0",
              width: "2px",
              background: hasOverride() ? "var(--cortex-info)" : tokens.colors.semantic.primary,
            }}
          />
        </Show>

        {/* Setting header */}
        <div style={{ display: "flex", "align-items": "flex-start", "justify-content": "space-between", "margin-bottom": "8px" }}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px", flex: "1" }}>
            {/* Label with source indicator and tags */}
            <div style={{ display: "flex", "align-items": "center", gap: "8px", "flex-wrap": "wrap" }}>
              <Text weight="medium" style={{ color: tokens.colors.text.primary }}>
                {props.setting.label}
              </Text>
              <Show when={hasOverride()}>
                <Badge size="sm" style={{ 
                  background: props.scope === "folder" 
                    ? "rgba(16, 185, 129, 0.2)" 
                    : "rgba(168, 85, 247, 0.2)", 
                  color: props.scope === "folder" ? "var(--cortex-success)" : "var(--cortex-info)" 
                }}>
                  {props.scope === "folder" ? "Folder" : "Workspace"}
                </Badge>
              </Show>
              <Show when={isModified() && !hasOverride()}>
                <span style={{
                  width: "6px",
                  height: "6px",
                  "border-radius": "var(--cortex-radius-full)",
                  background: tokens.colors.semantic.primary,
                }} title="Modified from default" />
              </Show>
              {/* Tags */}
              <Show when={props.setting.tags && props.setting.tags.length > 0}>
                <For each={props.setting.tags}>
                  {(tag) => <SettingTagBadge tag={tag} />}
                </For>
              </Show>
              {/* Extension badge */}
              <Show when={props.setting.extensionId}>
                <Badge size="sm" style={{ background: "rgba(59, 130, 246, 0.2)", color: "var(--cortex-info)" }}>
                  {props.setting.extensionId}
                </Badge>
              </Show>
              {/* Language badge */}
              <Show when={props.setting.languageOverride && props.setting.languageOverride.length > 0}>
                <Badge size="sm" style={{ background: "rgba(34, 197, 94, 0.2)", color: "var(--cortex-success)" }}>
                  {props.setting.languageOverride!.join(", ")}
                </Badge>
              </Show>
            </div>

            {/* Setting ID */}
            <Text size="xs" style={{ color: tokens.colors.text.muted, "font-family": "var(--jb-font-code)" }}>
              {props.setting.id}
            </Text>

            {/* Description */}
            <Text size="sm" style={{ color: tokens.colors.text.secondary, "margin-top": "4px" }}>
              {props.setting.description}
            </Text>

            {/* Default value indicator */}
            <Text size="xs" style={{ color: tokens.colors.text.muted, "margin-top": "4px" }}>
              Default: {String(props.setting.defaultValue)}
            </Text>
          </div>
        </div>

        {/* Setting value control */}
        <div style={{ "margin-top": "12px" }}>
          {renderValue()}
        </div>
      </div>
    </Show>
  );
}

// =============================================================================
// MAIN SETTINGS EDITOR COMPONENT
// =============================================================================

export interface SettingsEditorProps {
  initialScope?: SettingsScope;
  initialFolderPath?: string;
  onClose?: () => void;
}

export function SettingsEditor(props: SettingsEditorProps) {
  const settings = useSettings();
  
  // Try to use workspace context, but handle cases where it's not available
  let workspace: ReturnType<typeof useWorkspace> | null = null;
  try {
    workspace = useWorkspace();
  } catch {
    // WorkspaceContext not available
  }
  
  const [searchQuery, setSearchQuery] = createSignal("");
  const [activeSection, setActiveSection] = createSignal("editor");
  const [activeTabId, setActiveTabId] = createSignal<string>(
    props.initialFolderPath 
      ? `folder-${props.initialFolderPath}` 
      : props.initialScope === "workspace" 
        ? "workspace" 
        : "user"
  );
  const [showModifiedOnly, setShowModifiedOnly] = createSignal(false);
  const [showAutocomplete, setShowAutocomplete] = createSignal(false);
  let searchInputRef: HTMLInputElement | undefined;

  // Check if workspace is available
  const hasWorkspace = createMemo(() => settings.hasWorkspace());
  const workspacePath = createMemo(() => settings.workspacePath());

  // Get workspace folders from context
  const workspaceFolders = createMemo<WorkspaceFolder[]>(() => {
    if (!workspace) return [];
    return workspace.folders();
  });

  // Get settings scope tabs
  const settingsTabs = createMemo(() => {
    return getSettingsTabs(workspaceFolders(), hasWorkspace());
  });

  // Derive current scope and folder path from active tab
  const currentScope = createMemo<SettingsScope>(() => {
    const tab = settingsTabs().find(t => t.id === activeTabId());
    return tab?.scope || "user";
  });

  const currentFolderPath = createMemo<string | undefined>(() => {
    const tab = settingsTabs().find(t => t.id === activeTabId());
    return tab?.folderPath;
  });

  // Get workspace folder name
  const workspaceName = createMemo(() => {
    const path = workspacePath();
    if (!path) return null;
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || parts[parts.length - 2];
  });

  // Get current folder name for folder scope
  const currentFolderName = createMemo(() => {
    const path = currentFolderPath();
    if (!path) return null;
    const folder = workspaceFolders().find(f => f.path === path);
    return folder?.name || path.split(/[/\\]/).pop();
  });

  // Parse search query into text and filters
  const parsedQuery = createMemo(() => {
    return parseSearchQuery(searchQuery());
  });

  // Get filter suggestions for autocomplete
  const filterSuggestions = createMemo(() => {
    return getFilterSuggestions(searchQuery());
  });

  // Get modified count for a section
  const getModifiedCount = (sectionId: string): number => {
    const section = sectionId as keyof CortexSettings;
    if (section in DEFAULT_SETTINGS) {
      return settings.getModifiedCountForSection(section);
    }
    return 0;
  };

  // Get total modified count
  const totalModifiedCount = createMemo(() => {
    return settings.getAllModifiedSettings().length;
  });

  // Helper to check if setting is modified
  const isSettingModifiedFn = (section: keyof CortexSettings, key: string) => {
    // @ts-expect-error Dynamic key access for settings
    return settings.isSettingModified(section, key);
  };

  // Filter settings by active section, search, and filters
  const filteredSettings = createMemo(() => {
    let filtered = [...SETTINGS_REGISTRY];
    const { text, filters } = parsedQuery();

    // Filter by section if not searching
    if (!searchQuery()) {
      const tocItem = findTocItem(TOC_TREE, activeSection());
      if (tocItem?.section) {
        filtered = filtered.filter(s => s.section === tocItem.section);
      }
    }

    // Apply filters (@modified, @ext:, @lang:, @tag:, @id:)
    if (filters.length > 0 || showModifiedOnly()) {
      const effectiveFilters = showModifiedOnly() && !filters.some(f => f.type === "modified")
        ? [...filters, { type: "modified" as SearchFilterType }]
        : filters;
      filtered = filterSettingsByFilters(filtered, effectiveFilters, isSettingModifiedFn);
    }

    // Apply text search
    if (text) {
      filtered = filterSettingsByText(filtered, text);
    }

    return filtered;
  });

  // Find TOC item by ID
  function findTocItem(items: TocItem[], id: string): TocItem | undefined {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findTocItem(item.children, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  // Handle filter selection from autocomplete
  const handleFilterSelect = (filter: string) => {
    const currentQuery = searchQuery();
    const lastAtIndex = currentQuery.lastIndexOf("@");
    
    if (lastAtIndex >= 0) {
      // Replace partial filter with selected filter
      const newQuery = currentQuery.slice(0, lastAtIndex) + filter + " ";
      setSearchQuery(newQuery);
    } else {
      setSearchQuery(filter + " ");
    }
    
    setShowAutocomplete(false);
    searchInputRef?.focus();
  };

  // Remove a filter from the query
  const handleRemoveFilter = (index: number) => {
    const { filters } = parsedQuery();
    const filterToRemove = filters[index];
    let query = searchQuery();
    
    switch (filterToRemove.type) {
      case "modified":
        query = query.replace(/@modified/g, "");
        break;
      case "extension":
        query = query.replace(new RegExp(`@ext:${filterToRemove.value}\\s*`, "g"), "");
        break;
      case "language":
        query = query.replace(new RegExp(`@lang:${filterToRemove.value}\\s*`, "g"), "");
        break;
      case "tag":
        query = query.replace(new RegExp(`@tag:${filterToRemove.value}\\s*`, "g"), "");
        break;
      case "id":
        query = query.replace(new RegExp(`@id:${filterToRemove.value}\\s*`, "g"), "");
        break;
    }
    
    setSearchQuery(query.trim());
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    const { text } = parsedQuery();
    setSearchQuery(text);
  };

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);
  };

  // Scroll to section
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(`settings-section-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Handle search input focus
  const handleSearchFocus = () => {
    if (searchQuery().includes("@") || searchQuery() === "") {
      setShowAutocomplete(true);
    }
  };

  // Handle search input blur
  const handleSearchBlur = () => {
    // Delay to allow click on autocomplete items
    setTimeout(() => setShowAutocomplete(false), 200);
  };

  // Handle search input change
  const handleSearchInput = (e: InputEvent) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    setSearchQuery(value);
    if (value.includes("@")) {
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: tokens.colors.surface.modal,
        color: tokens.colors.text.primary,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          gap: "12px",
          padding: "16px 24px",
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          background: tokens.colors.surface.panel,
        }}
      >
        {/* Top row: Title, Tabs, Search, Close */}
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", gap: "16px" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "16px", flex: "1", "min-width": "0" }}>
            <Text as="h2" size="lg" weight="semibold" style={{ "flex-shrink": "0" }}>Settings</Text>

            {/* Settings scope tabs */}
            <SettingsScopeTabs
              tabs={settingsTabs()}
              activeTab={activeTabId()}
              onTabChange={handleTabChange}
            />

            {/* Search with autocomplete */}
            <div style={{ position: "relative", "flex-shrink": "0" }}>
              <Icon
                name="magnifying-glass"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "14px",
                  height: "14px",
                  color: tokens.colors.text.muted,
                  "pointer-events": "none",
                  "z-index": "1",
                }}
              />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search settings (@modified, @ext:, @lang:, @tag:, @id:)"
                value={searchQuery()}
                onInput={handleSearchInput}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                style={{
                  width: "380px",
                  "padding-left": "36px",
                  "padding-right": searchQuery() ? "32px" : "12px",
                }}
              />
              <Show when={searchQuery()}>
                <IconButton
                  onClick={() => setSearchQuery("")}
                  size="sm"
                  style={{
                    position: "absolute",
                    right: "4px",
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                >
                  <Icon name="xmark" />
                </IconButton>
              </Show>
              
              {/* Filter autocomplete dropdown */}
              <FilterAutocomplete
                suggestions={filterSuggestions()}
                onSelect={handleFilterSelect}
                visible={showAutocomplete()}
              />
            </div>
          </div>

          <Show when={props.onClose}>
            <IconButton onClick={props.onClose} size="lg">
              <Icon name="xmark" style={{ width: "20px", height: "20px" }} />
            </IconButton>
          </Show>
        </div>

        {/* Active filters display */}
        <Show when={parsedQuery().filters.length > 0}>
          <ActiveFiltersDisplay
            filters={parsedQuery().filters}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />
        </Show>
      </div>

      {/* Scope info banner */}
      <Show when={currentScope() === "workspace" && hasWorkspace()}>
        <div
          style={{
            padding: "8px 24px",
            background: "rgba(168, 85, 247, 0.1)",
            "border-bottom": "1px solid rgba(168, 85, 247, 0.2)",
          }}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <Icon name="gear" style={{ width: "12px", height: "12px", color: "var(--cortex-info)" }} />
            <Text size="xs" style={{ color: "var(--cortex-info)" }}>
              Editing workspace settings for <strong>{workspaceName()}</strong>
            </Text>
            <Text size="xs" style={{ color: "rgba(168, 85, 247, 0.6)" }}>
              - Settings here override your user settings for this workspace only
            </Text>
          </div>
        </div>
      </Show>

      {/* Folder scope info banner */}
      <Show when={currentScope() === "folder" && currentFolderPath()}>
        <div
          style={{
            padding: "8px 24px",
            background: "rgba(16, 185, 129, 0.1)",
            "border-bottom": "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <Icon name="folder" style={{ width: "12px", height: "12px", color: "var(--cortex-success)" }} />
            <Text size="xs" style={{ color: "var(--cortex-success)" }}>
              Editing folder settings for <strong>{currentFolderName()}</strong>
            </Text>
            <Text size="xs" style={{ color: "rgba(16, 185, 129, 0.6)" }}>
              - Settings here override workspace and user settings for files in this folder
            </Text>
          </div>
        </div>
      </Show>

      {/* Main content */}
      <div style={{ display: "flex", flex: "1", overflow: "hidden" }}>
        {/* TOC Sidebar */}
        <div
          style={{
            width: "260px",
            "border-right": `1px solid ${tokens.colors.border.default}`,
            "overflow-y": "auto",
            padding: "8px",
            "flex-shrink": "0",
            background: tokens.colors.surface.panel,
          }}
        >
          {/* Modified filter */}
          <div
            style={{
              "margin-bottom": "8px",
              "padding-bottom": "8px",
              "border-bottom": `1px solid ${tokens.colors.border.default}`,
            }}
          >
            <Button
              onClick={() => setShowModifiedOnly(!showModifiedOnly())}
              variant={showModifiedOnly() ? "secondary" : "ghost"}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "8px",
                width: "100%",
                padding: "6px 12px",
                "border-radius": tokens.radius.sm,
                "justify-content": "flex-start",
                background: showModifiedOnly() ? "rgba(234, 179, 8, 0.2)" : "transparent",
                color: showModifiedOnly() ? "var(--cortex-warning)" : tokens.colors.text.secondary,
                border: showModifiedOnly() ? "1px solid rgba(234, 179, 8, 0.3)" : "1px solid transparent",
              }}
            >
              <Icon name="filter" style={{ width: "14px", height: "14px" }} />
              <span style={{ flex: "1", "text-align": "left" }}>Modified</span>
              <Show when={totalModifiedCount() > 0}>
                <Badge
                  size="sm"
                  style={showModifiedOnly() ? {
                    background: "rgba(234, 179, 8, 0.3)",
                    color: "var(--cortex-warning)",
                  } : {}}
                >
                  {totalModifiedCount()}
                </Badge>
              </Show>
            </Button>
          </div>

          {/* TOC tree */}
          <For each={TOC_TREE}>
            {(item) => (
              <TocTreeItem
                item={item}
                activeSection={activeSection()}
                onSelect={scrollToSection}
                depth={0}
                getModifiedCount={getModifiedCount}
                showModifiedOnly={showModifiedOnly()}
                searchQuery={parsedQuery().text}
              />
            )}
          </For>
        </div>

        {/* Settings content */}
        <div
          style={{
            flex: "1",
            "overflow-y": "auto",
            "scroll-behavior": "smooth",
          }}
        >
          <Show
            when={filteredSettings().length > 0}
            fallback={
              <div style={{ padding: "48px 24px", "text-align": "center" }}>
                <Icon name="magnifying-glass" style={{ width: "48px", height: "48px", color: tokens.colors.text.muted, "margin-bottom": "16px" }} />
                <Text size="lg" style={{ color: tokens.colors.text.muted }}>
                  No settings found
                </Text>
                <Text size="sm" style={{ color: tokens.colors.text.muted, "margin-top": "8px" }}>
                  Try a different search term or filter
                </Text>
                <Show when={parsedQuery().filters.length > 0}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAllFilters}
                    style={{ "margin-top": "16px" }}
                  >
                    Clear all filters
                  </Button>
                </Show>
              </div>
            }
          >
            {/* Results count */}
            <Show when={searchQuery()}>
              <div style={{ padding: "12px 16px", "border-bottom": `1px solid ${tokens.colors.border.default}` }}>
                <Text size="sm" style={{ color: tokens.colors.text.muted }}>
                  {filteredSettings().length} setting{filteredSettings().length !== 1 ? "s" : ""} found
                </Text>
              </div>
            </Show>
            
            <For each={filteredSettings()}>
              {(setting) => (
                <SettingItem
                  setting={setting}
                  scope={currentScope()}
                  folderPath={currentFolderPath()}
                  searchQuery={searchQuery()}
                  parsedFilters={parsedQuery().filters}
                  searchText={parsedQuery().text}
                />
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}

export default SettingsEditor;


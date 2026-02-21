/**
 * Cortex UI Design System Components
 * 
 * Pixel-perfect implementations of Figma designs for Cortex GUI
 * Theme: Dark mode with Lime (#BFFF00) accent
 * 
 * Usage:
 *   import { CortexLayout, CortexTitleBar, ... } from '@/components/cortex';
 */

// Main Layout
export { CortexLayout, default as CortexLayoutDefault } from "./CortexLayout";
export type { CortexLayoutProps } from "./CortexLayout";

// Settings Panel (opens as editor tab)
export { CortexSettingsPanel, default as CortexSettingsPanelDefault } from "./CortexSettingsPanel";
export type { CortexSettingsPanelProps } from "./CortexSettingsPanel";
export { SETTINGS_VIRTUAL_PATH } from "./CortexSettingsPanel";

// Desktop Layout (production - connected to contexts)
export { CortexDesktopLayout, default as CortexDesktopLayoutDefault } from "./CortexDesktopLayout";

// Core Components
export { CortexTitleBar, default as CortexTitleBarDefault } from "./CortexTitleBar";
export type { CortexTitleBarProps } from "./CortexTitleBar";

export { CortexActivityBar, default as CortexActivityBarDefault } from "./CortexActivityBar";
export type { CortexActivityBarProps, ActivityBarItem } from "./CortexActivityBar";

export { CortexFileExplorer, default as CortexFileExplorerDefault } from "./CortexFileExplorer";
export type { CortexFileExplorerProps } from "./CortexFileExplorer";

export { CortexCodeEditor, default as CortexCodeEditorDefault } from "./CortexCodeEditor";
export type { CortexCodeEditorProps, EditorTab } from "./CortexCodeEditor";

export { EditorTabBar, default as EditorTabBarDefault } from "./EditorTabBar";
export type { EditorTabBarProps } from "./EditorTabBar";

export { EditorBreadcrumbs, default as EditorBreadcrumbsDefault } from "./EditorBreadcrumbs";
export type { EditorBreadcrumbsProps } from "./EditorBreadcrumbs";

export { CortexEditorTabs, default as CortexEditorTabsDefault } from "./CortexEditorTabs";
export type { CortexEditorTabsProps, EditorTab as CortexEditorTab } from "./CortexEditorTabs";

export { CortexChatPanel, default as CortexChatPanelDefault } from "./CortexChatPanel";
export type {
  CortexChatPanelProps,
  ChatPanelState,
  ChatMessage,
  ChatAction,
  ChatProgress,
  ChatToolCall,
} from "./CortexChatPanel";

export { CortexStatusBar, default as CortexStatusBarDefault } from "./CortexStatusBar";
export type { CortexStatusBarProps, CortexStatusBarVariant, StatusBarItem } from "./CortexStatusBar";

export { CortexBreadcrumb, default as CortexBreadcrumbDefault } from "./CortexBreadcrumb";
export type { CortexBreadcrumbProps, BreadcrumbSegment } from "./CortexBreadcrumb";

// Primitives
export {
  CortexIcon,
  CORTEX_ICON_SIZES,
  CortexButton,
  CortexToggle,
  CortexThemeToggle,
  CortexModeToggle,
  CortexInput,
  CortexPromptInput,
  CortexTooltip,
  CortexTreeItem,
  IndentGuide,
  CortexDropdown,
  CortexModal,
  CortexTabs,
  CortexTabPanel,
  CortexIconButton,
  CortexSmallButton,
  CortexSendButton,
  CortexHeaderItem,
  CortexDropdownItem,
  CortexDropdownMenu,
  CortexOpenProjectDropdown,
  CortexModelSelector,
  CortexStartPause,
  CortexCodeNavHelp,
  CortexSeparator,
  CortexConfigBadge,
  CortexVibeToggle,
} from "./primitives";

export type {
  CortexIconProps,
  CortexIconSize,
  CortexButtonProps,
  CortexButtonVariant,
  CortexButtonSize,
  CortexToggleProps,
  CortexThemeToggleProps,
  CortexModeToggleProps,
  CortexInputProps,
  CortexPromptInputProps,
  CortexTooltipProps,
  CortexTooltipPosition,
  CortexTreeItemProps,
  TreeItemData,
  IndentGuideProps,
  CortexDropdownProps,
  CortexDropdownOption,
  CortexModalProps,
  CortexModalSize,
  CortexTabsProps,
  CortexTab,
  CortexTabPanelProps,
  CortexIconButtonProps,
  CortexSmallButtonProps,
  CortexSendButtonProps,
  CortexHeaderItemProps,
  CortexDropdownItemProps,
  CortexDropdownMenuProps,
  CortexOpenProjectDropdownProps,
  CortexModelSelectorProps,
  CortexStartPauseProps,
  CortexStartPauseState,
  CortexCodeNavHelpProps,
  CortexSeparatorProps,
  CortexConfigBadgeProps,
  CortexConfigBadgeVariant,
  CortexVibeToggleProps,
  CortexVibeToggleMode,
  CortexVibeToggleVariant,
} from "./primitives";

// Output Panel
export { OutputPanel } from "./output";
export type { OutputPanelProps } from "./output";
export { CortexOutputChannel } from "./output";
export type { CortexOutputChannelProps } from "./output";
export { OutputChannelSelector } from "./output";
export type { OutputChannelSelectorProps } from "./output";

// Git Sub-Components
export { CortexGitDiffView, default as CortexGitDiffViewDefault } from "./CortexGitDiffView";
export type { CortexGitDiffViewProps } from "./CortexGitDiffView";
export { CortexDiffViewer, default as CortexDiffViewerDefault } from "./CortexDiffViewer";
export type { CortexDiffViewerProps } from "./CortexDiffViewer";
export { CortexGitHistory, default as CortexGitHistoryDefault } from "./CortexGitHistory";
export type { CortexGitHistoryProps } from "./CortexGitHistory";

// Source Control
export { CortexSourceControl, default as CortexSourceControlDefault } from "./CortexSourceControl";

// Diagnostics Panel
export { DiagnosticsFilterBar } from "./diagnostics";
export type { DiagnosticsFilterBarProps } from "./diagnostics";
export { DiagnosticsPanel } from "./diagnostics";
export type { DiagnosticsPanelProps } from "./diagnostics";
export { ErrorDetailView } from "./diagnostics";
export type { ErrorDetailViewProps } from "./diagnostics";
export { VulnerableDepsView } from "./diagnostics";
export type { VulnerableDepsViewProps } from "./diagnostics";

// Editor Components
export { QuickPickMenu } from "./editor";
export type { QuickPickMenuProps, QuickPickItem } from "./editor";
export { EditorStatusBarItems } from "./editor";
export type { EditorStatusBarItemsProps } from "./editor";
export { CortexDiffEditor } from "./editor";
export type { CortexDiffEditorProps } from "./editor";

// Account Panel
export { CortexAccountPanel } from "./CortexAccountPanel";

// Plugins Panel
export { CortexPluginsPanel } from "./CortexPluginsPanel";

// Update File View
export { CortexUpdateFileView } from "./CortexUpdateFileView";
export type { CortexUpdateFileViewProps, FileUpdate, DiffLine } from "./CortexUpdateFileView";

// Theme Picker
export { CortexThemePicker } from "./CortexThemePicker";

// Agents Panel
export { CortexAgentsPanel } from "./CortexAgentsPanel";

// Search Panel
export { CortexSearchPanel } from "./CortexSearchPanel";

// Welcome Recent Files
export { WelcomeRecentFiles } from "./WelcomeRecentFiles";

// AI Modifications
export { CortexAIModifications } from "./CortexAIModifications";
export type { CortexAIModificationsProps, AIModification } from "./CortexAIModifications";

// Token Limit
export { CortexTokenLimit } from "./CortexTokenLimit";
export type { CortexTokenLimitProps } from "./CortexTokenLimit";

// Update File (Modal)
export { CortexUpdateFile } from "./CortexUpdateFile";
export type { CortexUpdateFileProps } from "./CortexUpdateFile";

// AI Modifications Panel (wired)
export { CortexAIModificationsPanel } from "./CortexAIModificationsPanel";
export type { CortexAIModificationsPanelProps, FileModification } from "./CortexAIModificationsPanel";

// Token Limit Display (wired)
export { CortexTokenLimitDisplay } from "./CortexTokenLimitDisplay";
export type { CortexTokenLimitDisplayProps } from "./CortexTokenLimitDisplay";

// Command Palette
export { CortexCommandPalette } from "./command-palette";

// Notification System
export { CortexNotifications } from "./CortexNotifications";
export { NotificationHandler } from "./handlers/NotificationHandler";

// Icon Registry (Figma-sourced SVG icons)
export {
  CortexSvgIcon,
  CORTEX_ICON_REGISTRY,
  CORTEX_ICON_CATEGORIES,
  getCortexIconPath,
  getCortexIconsByCategory,
  FIGMA_ICON_MAP,
  FIGMA_FILE_KEY,
  FIGMA_SECTIONS,
} from "./icons";
export type {
  CortexSvgIconProps,
  CortexIconName,
  CortexIconCategory,
  FigmaIconEntry,
} from "./icons";



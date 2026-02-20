// UI Components
export { Button, IconButton } from "./ui";
export type { ButtonProps, IconButtonProps } from "./ui";

// Zen Mode components
export {
  ZenModeProvider,
  ZenModeOverlay,
  useZenMode,
  zenModeActive,
  zenModeFullscreen,
  enterZenMode,
  exitZenMode,
  enterFullscreen,
  exitFullscreen,
  getZenModeTransitionStyle,
  zenModeClasses,
} from "./ZenMode";
export type {
  ZenModeState,
  ZenModeActions,
  UseZenModeReturn,
} from "./ZenMode";

export { ResizeHandle } from "./ResizeHandle";
export type { ResizeHandleProps, ResizeDirection } from "./ResizeHandle";
export { Panel, PanelGroup, ResizablePanel, CollapsiblePanel } from "./PanelGroup";
export type { PanelProps, PanelGroupProps, PanelGroupDirection, ResizablePanelProps, CollapsiblePanelProps } from "./PanelGroup";
export { Header } from "./Header";
export { MenuBar } from "./MenuBar";
export { Sidebar } from "./Sidebar";
export { ModelSelector } from "./ModelSelector";
export { ChatMessage } from "./ChatMessage";
export { Markdown } from "./Markdown";
export { PromptInput } from "./PromptInput";
export { ApprovalDialog } from "./ApprovalDialog";
export { DiffView } from "./DiffView";
export { MultiDiffView } from "./MultiDiffView";
export type { MultiDiffViewProps, FileDiffInfo, FileStatus, FileDecision } from "./MultiDiffView";
export { CommandPalette } from "./CommandPalette";
export { QuickAccess, QuickAccessDialog, QuickAccessPrefixHint, QuickAccessTrigger } from "./QuickAccess";
export type { QuickAccessProps, QuickAccessDialogProps, QuickAccessTriggerProps } from "./QuickAccess";
export { ViewQuickAccess } from "./ViewQuickAccess";
export { ProjectSymbols, invalidateSymbolCache } from "./ProjectSymbols";
export { ReferencesView, triggerFindReferences, toggleReferencesView } from "./ReferencesView";
export type { ReferenceEntry, FileReferences, ReferenceSearch, ReferenceKind } from "./ReferencesView";
export { ReferencesPanel, showReferencesPanel, hideReferencesPanel } from "./ReferencesPanel";
export type { ReferenceLocation, FileReferences as ReferencesPanelFileGroup, ReferencesPanelState, ReferencesPanelProps } from "./ReferencesPanel";
export { CallHierarchyView, CallHierarchyPanel, useCallHierarchy, showCallHierarchy, showIncomingCalls, showOutgoingCalls } from "./CallHierarchyView";
export type {
  CallHierarchyItem,
  CallHierarchyIncomingCall,
  CallHierarchyOutgoingCall,
  CallHierarchySymbolKind,
  CallHierarchyDirection,
  CallHierarchyViewProps,
} from "./CallHierarchyView";
export { SettingsDialog } from "./SettingsDialog";
export { WebPreview } from "./WebPreview";
export { FeedbackDialog } from "./FeedbackDialog";

// Collaboration components
export { CollabPanel, CollabStatus } from "./collab/CollabPanel";
export { ParticipantsList, ParticipantAvatar } from "./collab/ParticipantsList";
export { ShareButton } from "./collab/ShareButton";
export { CursorOverlay, FollowIndicator, CursorPositionIndicator } from "./collab/CursorOverlay";

// Extension components
export { ExtensionCard, ExtensionsPanel, ExtensionMarketplace } from "./extensions";

// Task components
export { TasksPanel, TaskRunner, TaskConfigEditor, RunConfigDialog } from "./tasks";

// Viewer components
export { SVGPreview, isSVGFile, shouldShowSVGPreview } from "./viewers";
export { ImageViewer, isImageFile, getImageMimeType, IMAGE_EXTENSIONS } from "./viewers";
export { MarkdownPreview, isMarkdownFile } from "./viewers";

// Onboarding components
export {
  AIOnboarding,
  isFirstRun,
  isOnboardingCompleted,
  isOnboardingSkipped,
  markOnboardingComplete,
  markOnboardingSkipped,
  resetOnboardingState,
} from "./onboarding";

// Journal components
export { JournalPanel, JournalQuickOpen } from "./Journal";

// Bookmarks components
export { BookmarksPanel } from "./BookmarksPanel";

// Toolchain components
export { ToolchainSelector, ToolchainSelectorModal, ToolchainStatus } from "./ToolchainSelector";

// Formatter components
export { FormatterSelector, FormatterStatusBarItem, FormatterPromptDialog, useFormatterPrompt } from "./FormatterSelector";

// Developer tools
export { ComponentPreview, openComponentPreview, registerComponent } from "./dev";
export { Inspector, openInspector, toggleInspector } from "./dev";

// Snippet components
export { SnippetsPanel, SnippetEditor } from "./snippets";

// Recent Projects components
export { RecentProjectsModal, RecentProjectsList, WelcomePageRecentProjects } from "./RecentProjects";

// Welcome Page components
export {
  WelcomePage,
  shouldShowWelcomeOnStartup,
  setShowWelcomeOnStartup,
  showWelcomePage,
} from "./WelcomePage";

// Walkthrough components
export {
  Walkthrough,
  WalkthroughList,
  WalkthroughPanel,
  showWalkthroughs,
  showWalkthrough,
  isWalkthroughCompleted,
  getWalkthroughProgress,
  resetWalkthroughProgress,
  resetAllWalkthroughs,
  getBuiltinWalkthroughs,
  getWalkthroughById,
  BUILTIN_WALKTHROUGHS,
} from "./Walkthrough";
export type {
  WalkthroughData,
  WalkthroughProps,
  WalkthroughListProps,
} from "./Walkthrough";

// WalkthroughStep components
export { WalkthroughStep } from "./WalkthroughStep";
export type {
  WalkthroughStepData,
  WalkthroughStepProps,
  WalkthroughAction,
  WalkthroughActionType,
} from "./WalkthroughStep";

// System specs components
export { SystemSpecsDialog, useSystemSpecsDialog } from "./SystemSpecs";

// Auto-update components
export { AutoUpdateDialog, AutoUpdateStatusBadge, AutoUpdateMenuItem } from "./AutoUpdate";

// Release Notes components
export { ReleaseNotes, ReleaseNotesButton } from "./ReleaseNotes";

// Notifications components
export { NotificationsPanel, NotificationsBadge } from "./NotificationsPanel";
export { Notification } from "./Notification";
export type { NotificationProps } from "./Notification";

// Toast components
export { Toast } from "./Toast";
export type { ToastProps } from "./Toast";

// Context Server components (MCP)
export { ContextServerPanel, ContextServerSelector } from "./ai/ContextServerPanel";

// ACP Tools components
export { ACPToolsPanel, ACPToolSelector } from "./ai/ACPToolsPanel";

// Rules Library components
export { RulesLibraryPanel, RulesSelector, RulesStatusBadge } from "./ai/RulesLibrary";
export { RulesEditor } from "./ai/RulesEditor";

// WhichKey components
export { WhichKey, WhichKeySettings } from "./WhichKey";

// Activity Indicator components
export { ActivityIndicator, ActivityIndicatorMinimal, ActivityProgressBar } from "./ActivityIndicator";

// Language Status components
export { LanguageStatusItems, LanguageStatusItemButton, LanguageStatusIndicator, CommonLanguageStatusItems } from "./LanguageStatusItem";
export type { LanguageStatusItemProps, LanguageStatusItemsProps } from "./LanguageStatusItem";

// Testing components
export { TestExplorer, CoverageView, CoverageBar, CoverageStats, CoverageBadge, CoverageRing, CoverageChange, MiniCoverageBar, getCoverageStatus, getCoverageColor, getCoverageBackgroundColor, DEFAULT_THRESHOLDS, TestResults, CoverageOverlay, TestOutput } from "./testing";
export type { TestExplorerProps, TestFile, TestSuite, TestCase, TestStatus, CoverageViewProps, FileCoverage, CoverageSummary, CoverageTrend, CoverageReport, CoverageBarProps, CoverageStatsProps, CoverageBadgeProps, CoverageRingProps, CoverageChangeProps, MiniCoverageBarProps, CoverageThresholds, CoverageStatus } from "./testing";

// Notebook components
export { NotebookEditor, isNotebookFile, createEmptyNotebook } from "./notebook";
export type { NotebookEditorProps } from "./notebook";

// Debugger components
export { DebuggerPanel, DebugToolbar, BreakpointsView, VariablesView, CallStackView, WatchView, DebugConsole, DisassemblyView, MemoryView, useMemoryViewFromVariable, LaunchConfigModal, useBreakpointGutter, useInlineVariables, BreakpointPanel, VariablesPanel, WatchPanel, CallStackPanel, MemoryInspector } from "./debugger";
export type { BreakpointGutterProps, MemoryViewContextProps } from "./debugger";

// Settings components
export { KeymapEditor, EditorSettingsPanel, TerminalSettingsPanel, SettingsSyncPanel } from "./settings";

// Terminal support components
export { default as TerminalFind } from "./TerminalFind";
export { default as TerminalProfilePicker } from "./TerminalProfilePicker";
export { TerminalSuggest, useTerminalSuggestions } from "./TerminalSuggest";
export type {
  TerminalSuggestProps,
  Suggestion,
  SuggestionType,
  SuggestionSource,
  SuggestionContext,
  FileEntry,
  UseTerminalSuggestionsOptions,
  UseTerminalSuggestionsReturn,
} from "./TerminalSuggest";
export { TerminalQuickFix, useTerminalQuickFix, detectErrorFromLine } from "./TerminalQuickFix";
export type {
  TerminalQuickFixProps,
  ErrorCategory,
  QuickFixAction,
  DetectedError,
} from "./TerminalQuickFix";
export { TerminalGroupTabs } from "./TerminalGroupTabs";
export { TerminalGroupSplitView } from "./TerminalGroupSplitView";
export { TerminalGroupCommands } from "./TerminalGroupCommands";

// Search Editor
export { SearchEditor, useSearchEditor } from "./SearchEditor";

// Semantic Search
export { SemanticSearch } from "./SemanticSearch";

// Local History
export { LocalHistoryView, LocalHistoryButton, LocalHistorySettings } from "./LocalHistoryView";

// Type Hierarchy
export { TypeHierarchyView } from "./TypeHierarchyView";
export type { TypeKind, TypeHierarchyItem } from "./TypeHierarchyView";

// Timeline View
export { TimelineView, TimelineButton } from "./TimelineView";
export type { TimelineItem, TimelineSourceType, GitCommitInfo, DateRangeFilter, TimelineFilters, TimelineViewProps } from "./TimelineView";

// Accessibility
export { AccessibilityHelp, useAccessibilityHelpDialog } from "./AccessibilityHelp";

// Process Explorer (dev tools)
export { ProcessExplorer, useProcessExplorer, openProcessExplorer, toggleProcessExplorer } from "./dev";
export type { ProcessType, ProcessInfo, ProcessDetails } from "./dev";

// Breadcrumbs navigation
export { Breadcrumbs } from "./Breadcrumbs";
export type { BreadcrumbsProps } from "./Breadcrumbs";

// Auxiliary Window (pop-out editors)
export {
  AuxiliaryWindow,
  detachTabToWindow,
  getDetachTabAction,
  useDragDetach,
  useSyncedState,
} from "./AuxiliaryWindow";
export type {
  AuxiliaryWindowProps,
  AuxiliaryWindowHeaderProps,
  SyncedState,
  TabDetachConfig,
  TabContextMenuAction,
  UseDragDetachOptions,
  DragDetachHandlers,
  UseSyncedStateOptions,
} from "./AuxiliaryWindow";

// Workspace Trust
export {
  WorkspaceTrustBanner,
  TrustBadge,
  RestrictedModeIndicator,
  ActionBlockedDialog,
  useBlockedAction,
} from "./WorkspaceTrustBanner";
export type {
  WorkspaceTrustBannerProps,
  TrustBadgeProps,
  RestrictedModeIndicatorProps,
  ActionBlockedDialogProps,
} from "./WorkspaceTrustBanner";
export { WorkspaceTrustEditor } from "./WorkspaceTrustEditor";
export type { WorkspaceTrustEditorProps } from "./WorkspaceTrustEditor";

// Webview Panel
export { WebviewPanel, WebviewPanelContainer } from "./WebviewPanel";
export type { WebviewPanelProps, WebviewPanelContainerProps } from "./WebviewPanel";

// Welcome Views (Empty States)
export {
  WelcomeView,
  ExplorerWelcome,
  SearchWelcome,
  GitWelcome,
  DebugWelcome,
  CustomWelcomeView,
} from "./WelcomeView";
export type {
  WelcomeViewType,
  WelcomeViewAction,
  WelcomeViewProps,
  ExplorerWelcomeProps,
  SearchWelcomeProps,
  GitWelcomeProps,
  DebugWelcomeProps,
  CustomWelcomeViewProps,
  TipItem,
} from "./WelcomeView";

// Comments components
export { CommentsPanel, CommentThread } from "./comments";
export type { CommentsPanelProps, CommentThreadProps } from "./comments";

// Voice Input
export { VoiceInput, VoiceMicButton, VoiceAudioLevel } from "./VoiceInput";
export type { VoiceInputProps } from "./VoiceInput";

// GitHub Codespaces
export { CodespacesPanel } from "./codespaces";

// Error Boundaries
export {
  ErrorBoundary,
  SidebarErrorBoundary,
  EditorErrorBoundary,
  DialogErrorBoundary,
  InlineErrorBoundary,
  CompactFallback,
  withErrorBoundary,
} from "./ErrorBoundary";
export type {
  ErrorBoundaryProps,
  PanelErrorBoundaryProps,
  DefaultFallbackProps,
  CompactFallbackProps,
} from "./ErrorBoundary";

// Open With / Editor Associations
export { OpenWithMenu, useOpenWithMenu, getOpenWithMenuItems } from "./OpenWithMenu";
export type { OpenWithMenuProps, OpenWithSubmenuProps } from "./OpenWithMenu";
export {
  ConfigureDefaultEditorDialog,
  ConfigureDefaultEditorDialogContainer,
  useConfigureDefaultEditorDialog,
} from "./ConfigureDefaultEditorDialog";
export type { ConfigureDefaultEditorDialogProps, ConfigureDefaultEditorDialogContainerProps } from "./ConfigureDefaultEditorDialog";

// =============================================================================
// Agent Factory Components
// =============================================================================

export {
  // Main component
  AgentFactory,
  // Canvas components
  FactoryCanvas,
  CanvasBackground,
  CanvasToolbar,
  ConnectionLine,
  SelectionBox,
  MiniMap,
  // Node components
  BaseNodeContainer,
  NodePort,
  AgentNode,
  TriggerNode,
  ActionNode,
  LogicNode,
  SupervisorNode,
  MessageNode,
  // Panel components
  NodePalette,
  Inspector as FactoryInspector,
  ConsolePanel,
  LiveMonitor,
  AuditLog,
  ApprovalsPanel,
  // Builder components
  AgentBuilder,
  WorkflowSettings,
  // Dialog components
  ImportExportDialog,
  TemplateGallery,
  // Utilities
  NODE_METADATA,
  NODE_CATEGORIES,
  FACTORY_SHORTCUTS,
  DEFAULT_VIEWPORT,
  DEFAULT_GRID,
} from "./factory";

export type {
  AgentFactoryProps,
  CanvasNode,
  CanvasEdge,
  CanvasViewport,
  NodeType,
  NodeTypeMetadata,
  NodeCategory,
  FactoryNode,
  LogEntry,
  LogLevel,
  WorkflowTemplate,
  TemplateCategory,
} from "./factory";

/**
 * Centralized Types Index
 *
 * Re-exports all types from the types directory for convenient importing.
 * Import from '@/types' or '../types' instead of individual context files.
 *
 * @example
 * // Import specific types
 * import { Message, Thread, AIModel } from '@/types';
 *
 * // Import all AI types
 * import * as AITypes from '@/types/ai';
 */

// ============================================================================
// Editor Types
// ============================================================================

export type {
  CursorPosition,
  Selection,
  LineEnding,
  OpenFile,
  SplitDirection,
  EditorGroup,
  EditorSplit,
  EditorLayout,
  EditorState,
  LanguageMap,
  LanguageEditorOverride,
  LanguageOverridesMap,
} from "./editor";

// ============================================================================
// Workspace Types
// ============================================================================

export type {
  WorkspaceFolder,
  RecentWorkspace,
  WorkspaceSettings,
  WorkspaceFile,
  CodeWorkspaceFile,
  WorkspaceFormat,
  FileEntry,
  FileMetadata,
  ProjectConfig,
  FolderColor,
  WorkspaceTrustLevel,
  WorkspaceTrustState,
  WorkspaceStateData,
  EditorStateEntry,
  ScrollPosition,
  RecentWorkspaceBackend,
  WorkspaceFileDataBackend,
  WorkspaceFolderEntryBackend,
  ReplacePreviewLine,
  ReplacePreviewEntry,
  ReplacePreviewResult,
  SearchHistoryPersistEntry,
  FolderDisplayMode,
} from "./workspace";

// ============================================================================
// Terminal Types
// ============================================================================

export type {
  TerminalInfo,
  UpdateTerminalOptions,
  CreateTerminalOptions,
  TerminalProfileIcon,
  TerminalProfile,
  TerminalProfileConfig,
  TerminalOutput,
  TerminalStatus,
  TerminalsState,
  ShellIntegrationSequence,
  ShellIntegrationEvent,
  ShellIntegrationState,
  // Terminal Quick Fix Types
  TerminalQuickFix,
  TerminalQuickFixAction,
  TerminalPersistence,
  TerminalEnvironment,
  // Terminal Group Types
  TerminalGroup,
  TerminalSplitDirection,
  CreateGroupOptions,
  MoveToGroupOptions,
  PersistedTerminalGroupState,
  TerminalDragData,
  // SSH Terminal Types
  TerminalType,
  SSHAuthType,
  SSHAuthMethod,
  SSHConfig,
  SSHConnectionStatus,
  SSHTerminalInfo,
  SSHTerminalOutput,
  SSHTerminalStatus,
} from "./terminal";

// ============================================================================
// Git Types
// ============================================================================

export type {
  GitFileStatus,
  GitConflictType,
  GitFileChange,
  GitFile,
  GitStatus,
  GitBranch,
  GitBranchExtended,
  GitRemote,
  GitCommit,
  CommitRef,
  CommitFile,
  GitHunk,
  GitDiff,
  GitBlameEntry,
  GitStash,
  GitCompareCommit,
  GitCompareFile,
  GitCompareResult,
  RepoStatus,
  RepositoryInfo,
  GitHostingProviderType,
  GitRemoteInfo,
  GitHostingProviderConfig,
  GitHostingAction,
  GitContext,
  GitSyncSettings,
} from "./git";

// ============================================================================
// AI Types
// ============================================================================

export type {
  AIModel,
  MessageRole,
  FileContext,
  MessageContext,
  ToolCall,
  ToolResult,
  Message,
  AIMessage,
  Thread,
  Session,
  ToolParameter,
  ToolDefinition,
  SubAgentStatus,
  SubAgent,
  StreamChunk,
  AIState,
  InlineSuggestion,
  CompletionItem,
} from "./ai";

// ============================================================================
// Settings Types
// ============================================================================

export type {
  UnicodeHighlightSettings,
  EditorSettings,
  ActivityBarLocation,
  MenuBarVisibility,
  PanelPosition,
  PanelAlignment,
  ThemeSettings,
  TerminalSettings,
  AISettings,
  SandboxMode,
  ApprovalMode,
  SecuritySettings,
  SearchSettings,
  JavaScriptDebugSettings,
  DebugSettings,
  GitSettings,
  HttpSettings,
  FilesSettings,
  FileNestingPatterns,
  FileNestingSettings,
  ExplorerSortOrder,
  ExplorerSettings,
  ZenModeSettings,
  ScreencastModeSettings,
  ExtensionSettingsMap,
  CortexSettings,
  PartialCortexSettings,
  SettingSource,
  SettingsScope,
} from "./settings";

// ============================================================================
// Event Types
// ============================================================================

export type {
  // AI Events
  StreamChunkEvent,
  ToolCallEvent,
  ToolResultEvent,
  AgentStatusEvent,
  AIErrorEvent,
  // Terminal Events
  TerminalOutputEvent,
  TerminalStatusEvent,
  TerminalCreatedEvent,
  // File System Events
  FileSavedEvent,
  FileChangedEvent,
  FileClosingEvent,
  // Workspace Events
  FolderAddedEvent,
  FolderRemovedEvent,
  WorkspaceLoadedEvent,
  ProjectOpenedEvent,
  // Settings Events
  SettingsChangedEvent,
  SettingsResetEvent,
  WorkspaceSettingsChangedEvent,
  // Notification Events
  NotificationEvent,
  // Git Events
  GitStatusChangedEvent,
  GitBranchChangedEvent,
  // Editor Events
  CursorPositionChangedEvent,
  SelectionChangedEvent,
  // Debug Events
  DebugSessionStartedEvent,
  BreakpointHitEvent,
  // Command Events
  CommandExecutedEvent,
  // Extension Events
  ExtensionInstalledEvent,
  ExtensionActivatedEvent,
  // Window Events
  WindowFocusChangedEvent,
  WindowResizedEvent,
} from "./events";

// ============================================================================
// SSH Types (Extended)
// ============================================================================

export type {
  SSHAuthMethod as SSHAuthMethodType,
  SSHAuthConfig,
  SSHConfig as SSHConfigExtended,
  SSHConnectionProfile,
  SSHPortForward,
  SSHConnectionStatus as SSHConnectionStatusExtended,
  SSHSession,
  SSHPortForwardStatus,
  SSHOutputEvent,
  SSHStatusEvent,
  SSHProgressEvent,
  SSHContextValue,
  SSHState,
  Disposable,
  BackendSSHSessionInfo,
  BackendSSHConfig,
  MockSSHSessionData,
} from "./ssh";

export { toBackendSSHConfig, fromBackendSessionInfo } from "./ssh";

// ============================================================================
// Quick Input Types
// ============================================================================

export {
  QuickPickItemButtonLocation,
  ItemActivation,
} from "./quickInput";

export type {
  // Checkbox Types
  CheckboxState,
  QuickPickCheckbox,
  // Highlight Types
  HighlightRange,
  QuickPickHighlights,
  MatchOnLabelMode,
  // Tree Item Types
  QuickTreeItem,
  QuickTreeItemButton,
  // Widget Types
  QuickWidget,
  QuickWidgetInteractionEvent,
  // Separator Types
  QuickPickSeparatorWithButtons,
  QuickPickSeparatorButton,
  // Navigation Types
  QuickNavigateConfiguration,
  QuickNavigateKeybindings,
  // Extended Options Types
  QuickPickItemExtendedOptions,
  QuickPickFilterFunction,
  QuickPickScorerFunction,
  QuickPickExtendedOptions,
  QuickTreePickOptions,
  QuickInputExtendedOptions,
  // Event Types
  QuickPickItemButtonEvent,
  QuickPickSeparatorButtonEvent,
  QuickTreeNodeEvent,
  // Utility Types
  PartialBy,
  QuickTreeItemValue,
  FlattenedTreeItem,
} from "./quickInput";

// ============================================================================
// Debug Types
// ============================================================================

export type {
  // Range types
  DocumentRange,
  // Debug Hover types
  DebugHoverResult,
  DebugHoverState,
  DebugHoverChildVariable,
  // Inline Value types
  InlineValueType,
  InlineValue,
  InlineValueState,
  // Exception Widget types
  ExceptionInfo,
  ExceptionBreakMode,
  ExceptionDetails,
  ExceptionWidgetState,
  ExceptionWidgetPosition,
  // Breakpoint Mode types
  BreakpointMode,
  BreakpointModeAppliesTo,
  // Data Breakpoint types
  DataBreakpointAccessType,
  // Instruction Breakpoint types
  InstructionBreakpoint,
  // Session Picker types
  DebugSessionInfoBase,
  SessionPickerState,
  // Breakpoint Activation types
  BreakpointActivation,
  // Debug Console Settings types
  DebugConsoleSettings,
  // Debug Toolbar types
  DebugToolbarLocation,
  DebugToolbarConfig,
} from "./debug";

export { DEFAULT_DEBUG_CONSOLE_SETTINGS } from "./debug";

// ============================================================================
// Search Types
// ============================================================================

export type {
  // Common types
  Uri,
  Range,
  TextEdit,
  CancellationToken,
  Progress,
  // Search Editor
  SearchEditorState,
  SearchQuery,
  SearchResult,
  SearchMatch,
  // Search History
  SearchHistoryEntry,
  // Multi-line Search
  MultiLineSearchState,
  // Text Search Provider API
  TextSearchProvider,
  TextSearchQuery,
  TextSearchOptions,
  TextSearchResult,
  TextSearchComplete,
  // File Search Provider API
  FileSearchProvider,
  FileSearchQuery,
  FileSearchOptions,
  // Search Decorations
  SearchDecoration,
  // Replace
  ReplaceResult,
} from "./search";

// ============================================================================
// Task Types
// ============================================================================

export type {
  // Input Variables
  TaskInputVariable,
  TaskInputPickOption,
  // Depends Order
  DependsOrder,
  // Instance Policy
  InstancePolicy,
  // Shell Configuration
  ShellConfiguration,
  ShellQuotingOptions,
  // OS-specific Configuration
  TaskOSConfiguration,
  TaskConfiguration,
  TaskConfigurationBase,
  // Presentation Options
  TaskPresentationOptions,
  // Run Options
  TaskRunOptions,
  // Task Execution
  TaskExecution,
  TaskStartEvent,
  TaskEndEvent,
  TaskProcessStartEvent,
  TaskProcessEndEvent,
  // Extended Task Configuration
  TaskDefinition,
  TasksFile,
  // Task Provider Types
  TaskProviderCallback,
  TaskProviderDefinition,
  // Task Filter
  TaskFilter,
  // Task Quick Pick
  TaskQuickPickItem,
} from "./tasks";

// ============================================================================
// Workbench Types
// ============================================================================

export type {
  // Common types
  MarkdownString,
  Command,
  // Auxiliary Sidebar
  AuxiliarySidebarState,
  // Command Center
  CommandCenterState,
  // View Container
  ViewContainer,
  View,
  // Welcome View
  WelcomeView,
  WelcomeViewContent,
  // Panel
  PanelPosition as WorkbenchPanelPosition,
  PanelAlignment as WorkbenchPanelAlignment,
  // Editor Title Actions
  EditorTitleAction,
  // View Title Actions
  ViewTitleAction,
  // Status Bar
  StatusBarItemOptions,
  // Notifications
  NotificationOptions,
  NotificationAction,
  // Workbench State
  WorkbenchState,
} from "./workbench";

// ============================================================================
// Authentication Types
// ============================================================================

export type {
  // Event type for authentication
  Event,
  // Provider Types
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationProviderInformation,
  AuthenticationProviderOptions,
  // Session Types
  AuthenticationSession,
  AuthenticationSessionAccountInformation,
  AuthenticationSessionsChangeEvent,
  // Options Types
  AuthenticationGetSessionOptions,
  AuthenticationForceNewSessionOptions,
  // API Types
  AuthenticationAPI,
  BuiltinAuthenticationProvider,
  // OAuth Types (internal)
  OAuthConfig,
  OAuthState,
  OAuthTokenResponse,
} from "./authentication";

// ============================================================================
// Testing Types
// ============================================================================

export {
  TestRunProfileKind,
  TestResultState,
} from "./testing";

// ============================================================================
// SCM (Source Control) Types
// ============================================================================

export type {
  // Source Control Provider
  SourceControl,
  SourceControlInputBox,
  SourceControlResourceGroup,
  SourceControlResourceState,
  SourceControlResourceDecorations,
  SourceControlResourceThemableDecorations,
  QuickDiffProvider,
  // SCM History Provider
  ScmHistoryProvider,
  ScmHistoryItem,
  ScmHistoryItemGroup,
  ScmHistoryItemGroupUpstream,
  ScmHistoryItemChange,
  ScmHistoryOptions,
  ScmActionButton,
  // Timeline Provider
  TimelineProvider,
  Timeline,
  TimelineItem,
  TimelineOptions,
  TimelinePaging,
  TimelineChangeEvent,
} from "./scm";

// ============================================================================
// Keybindings Types
// ============================================================================

export type {
  // Keybinding Item Types
  KeybindingItem,
  KeybindingSource,
  // When Clause Types
  WhenClause,
  WhenExpression,
  WhenContext,
  // Conflict Types
  KeybindingConflict,
  // Record Keys Types
  RecordKeysState,
  RecordedKey,
  // Editor State Types
  KeybindingsEditorState,
  KeybindingSortField,
  KeybindingSortOrder,
  DefineKeybindingWidgetState,
  // JSON Types
  KeybindingJSON,
  // Resolution Types
  ResolvedKeybinding,
  // Keyboard Layout Types
  KeyboardLayout,
  KeyMapping,
} from "./keybindings";

// ============================================================================
// Comments Types
// ============================================================================

export {
  CommentMode,
  CommentThreadCollapsibleState,
  CommentThreadState,
} from "./comments";

export type {
  // Comment Controller
  CommentController,
  CommentOptions,
  CommentingRangeProvider,
  // Comment Thread
  CommentThread,
  Comment,
  CommentAuthorInformation,
  CommentReaction,
  CommentReply,
  // Events
  CommentThreadChangedEvent,
  // Configuration Types
  CommentControllerConfig,
  CreateCommentData,
  CreateCommentThreadData,
  // Serialization Types
  SerializedComment,
  SerializedCommentThread,
} from "./comments";

// ============================================================================
// Notebooks Types
// ============================================================================

export {
  NotebookCellKind,
  EndOfLine,
  ViewColumn,
  NotebookEditorRevealType,
  NotebookKernelMessageType,
} from "./notebooks";

export {
  createNotebookCellOutput,
  createTextOutputItem,
  createJsonOutputItem,
  createNotebookRange,
  createNotebookCellData,
  createEmptyNotebookData,
} from "./notebooks";

export type {
  // Document Types
  NotebookDocument,
  NotebookDocumentMetadata,
  // Cell Types
  NotebookCell,
  NotebookCellMetadata,
  NotebookCellData,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookCellOutputMetadata,
  NotebookCellExecutionSummary,
  NotebookCellExecutionTiming,
  // Range Types
  NotebookRange,
  NotebookRangeConstructor,
  // Controller Types
  NotebookController,
  NotebookControllerSelectionEvent,
  NotebookControllerOptions,
  NotebookCellExecution,
  // Edit Types
  NotebookEdit,
  // Serializer Types
  NotebookSerializer,
  NotebookSerializerOptions,
  NotebookData,
  // Editor Types
  NotebookEditor,
  NotebookEditorDecorationType,
  // Change Event Types
  NotebookDocumentChangeEvent,
  NotebookDocumentContentChange,
  NotebookDocumentCellChange,
  // Kernel Message Types
  NotebookKernelMessage,
  NotebookKernelStatus,
  // Renderer Types
  NotebookRenderer,
  NotebookRendererApi,
  NotebookRendererContext,
} from "./notebooks";

export type {
  // Core types
  TestController,
  TestItem,
  TestItemCollection,
  TestTag,
  TestRunProfile,
  TestRun,
  TestRunRequest,
  TestMessage,
  // Coverage types
  FileCoverage,
  CoverageStatistics,
  FileCoverageDetail,
  StatementCoverage,
  BranchCoverage,
  BranchOutcome,
  DeclarationCoverage,
  // UI state types
  TestResult,
  TestRunResult,
  TestExplorerState,
  // Helper types
  Position,
  Location,
  MarkdownString as TestMarkdownString,
  TestDiscoveryOptions,
  TestTagFactory,
  TestMessageFactory,
} from "./testing";

// ============================================================================
// Factory Types (AI Agent Factory)
// ============================================================================

export type {
  // Core Identifiers
  WorkflowId,
  NodeId,
  EdgeId,
  ExecutionId,
  AgentId,
  ApprovalId,
  AuditId,
  // Node Types
  NodeType,
  NodeDataBase,
  TriggerNodeData,
  AgentNodeData,
  ToolNodeData,
  ConditionNodeData,
  LoopNodeData,
  ParallelNodeData,
  MergeNodeData,
  DelayNodeData,
  HumanApprovalNodeData,
  SubworkflowNodeData,
  TransformNodeData,
  OutputNodeData,
  NodeData,
  // Workflow Definition
  Position as FactoryPosition,
  WorkflowNode,
  HandleType,
  WorkflowEdge,
  WorkflowVariable,
  Workflow,
  WorkflowSettings,
  // Agent Configuration
  AgentConfig,
  // Execution Types
  ExecutionStatus,
  NodeExecutionStatus,
  NodeExecution,
  WorkflowExecution,
  // Approval Types
  ApprovalAction,
  ApprovalStatus,
  ApprovalRequest,
  // Audit Types
  AuditEventType,
  AuditSeverity,
  AuditEntry,
  AuditFilter,
  AuditPage,
  // Event Types
  FactoryEvent,
  // API Response Types
  ListWorkflowsResponse,
  ListExecutionsResponse,
  ListAgentsResponse,
  ListApprovalsResponse,
  // Undo/Redo Types
  WorkflowMutationType,
  WorkflowMutation,
} from "./factory";
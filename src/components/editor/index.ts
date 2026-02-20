export { TabBar } from "./TabBar";
export { TabSwitcher } from "./TabSwitcher";
export { CodeEditor } from "./CodeEditor";
export { EditorPanel } from "./EditorPanel";
export { MultiBuffer, DiffView } from "./MultiBuffer";
export { VimMode } from "./VimMode";
export { Breadcrumbs } from "./Breadcrumbs";
export { DiagnosticsPanel, DiagnosticsSummary, InlineDiagnostics, ProblemsBottomPanel } from "./DiagnosticsPanel";
export { setupLSPIntegration, updateDiagnosticsMarkers, clearDiagnosticsMarkers, filePathToUri, uriToFilePath } from "./LSPIntegration";
export { setupFormatterIntegration, useFormatterIntegration, formatEditorDocument, formatEditorSelection } from "./FormatterIntegration";
export { OutlinePanel, OutlinePanelSidebar } from "./OutlinePanel";
export { EditorContextMenu, useEditorContextMenu } from "./EditorContextMenu";
export { LanguageTools } from "./LanguageTools";
export { GitGutterDecorations } from "./GitGutterDecorations";
export { BookmarksGutter } from "./BookmarksGutter";
export type {
  CodeAction,
  CodeActionKind,
  CodeActionContext,
  WorkspaceEdit,
  TextDocumentEdit,
  Command,
  LanguageToolsProps,
} from "./LanguageTools";
export { LanguageSelector, LanguageStatus, LanguageSelectorModal } from "./LanguageSelector";
export type { LanguageStatusProps } from "./LanguageSelector";
export { 
  InlineBlameManager, 
  createInlineBlameManager, 
  useInlineBlame,
  getInlineBlameMode, 
  setInlineBlameMode, 
  toggleInlineBlame 
} from "./InlineBlame";
export type { InlineBlameMode, InlineBlameOptions, BlameLineInfo } from "./InlineBlame";
export { PeekWidget, showPeekWidget, hidePeekWidget } from "./PeekWidget";
export type { PeekLocation, PeekWidgetProps, PeekWidgetState } from "./PeekWidget";
export { PeekReferences, showPeekReferences, hidePeekReferences } from "./PeekReferences";
export type { ReferenceItem, FileGroup, PeekReferencesState, PeekReferencesProps } from "./PeekReferences";
export { MultiDiffEditor } from "./MultiDiffEditor";
export type { MultiDiffEditorProps, FileDiff, FileStatus } from "./MultiDiffEditor";
export { MergeEditor, ConflictChunk } from "./merge/MergeEditor";
export type { MergeEditorProps } from "./merge/MergeEditor";
export { InlineDiffView } from "./diff/InlineDiffView";
export { SideBySideDiffView } from "./diff/SideBySideDiffView";
export { EditorGrid, GridSash } from "./EditorGrid";
export { GridSash as GridSashComponent } from "./GridSash";
export { EditorGridPanel } from "./EditorGridPanel";
export type { GridCell, EditorGridState, EditorGridProps, DropPosition } from "./EditorGrid";

// Zen Mode
export { ZenMode } from "./ZenMode";
export type { ZenModeProps, ZenModeSettings as ZenModeEditorSettings } from "./ZenMode";

// Bracket Pair Colorization
export { BracketPairColorization } from "./BracketPairColorization";
export type { BracketPairColorizationProps } from "./BracketPairColorization";

// Editor Font Settings
export { EditorFontSettings } from "./EditorFontSettings";
export type { EditorFontSettingsProps } from "./EditorFontSettings";

// 3-Way Diff Editor
export { DiffEditor3Way, parseConflictMarkers, buildResolvedContent } from "./DiffEditor3Way";
export type { DiffEditor3WayProps, ConflictMarker } from "./DiffEditor3Way";

// Minimap Controller
export { MinimapController, useMinimapController, MinimapSettingsPanel } from "./MinimapController";
export type { MinimapControllerProps, MinimapSettingsPanelProps } from "./MinimapController";

// Sticky Scroll
export { StickyScrollWidget, applyMonacoStickyScrollOptions } from "./StickyScrollWidget";

// Extracted Editor Features
export {
  // Inlay Hints
  createInlayHintsManager,
  getInlayHintsEditorOptions,
  type InlayHintSettings,
  type InlayHintsManager,
  // CodeLens
  createCodeLensManager,
  getCodeLensEditorOptions,
  type CodeLensSettings,
  type CodeLensManager,
  // Format On Type
  createFormatOnTypeManager,
  getFormatOnTypeEditorOptions,
  type FormatOnTypeSettings,
  type FormatOnTypeManager,
  // Linked Editing
  createLinkedEditingManager,
  getLinkedEditingEditorOptions,
  getTagAtPosition,
  findOpeningTag,
  findClosingTag,
  type LinkedEditingSettings,
  type LinkedEditingManager,
  // Smart Select
  SmartSelectManager,
  createSmartSelectManager,
  registerSmartSelectActions,
  // Coverage
  createCoverageManager,
  getCoverageEditorStyles,
  type LineCoverageStatus,
  type LineCoverageData,
  type CoverageSettings,
  type CoverageManager,
  // UI Panels
  CallHierarchyPanel,
  TypeHierarchyPanel,
  type CallHierarchyDirection,
  type CallHierarchyPanelProps,
  type TypeHierarchyPanelProps,
} from "./features";

// Minimap Navigation
export { Minimap } from "./Minimap";
export type { MinimapProps } from "./Minimap";

// Breadcrumb Bar
export { BreadcrumbBar } from "./BreadcrumbBar";
export type { BreadcrumbBarProps, BreadcrumbSegment } from "./BreadcrumbBar";

// Editor Tab Bar (with split support)
export { EditorTabBar } from "./EditorTabBar";
export type { EditorTabBarProps } from "./EditorTabBar";

// Editor Breadcrumbs (file path breadcrumbs)
export { EditorBreadcrumbs } from "./EditorBreadcrumbs";
export type { EditorBreadcrumbsProps } from "./EditorBreadcrumbs";

// Sticky Scroll
export { StickyScroll } from "./StickyScroll";
export type { StickyScrollProps } from "./StickyScroll";

// Peek View
export { PeekView } from "./PeekView";
export type { PeekViewProps, PeekLocation as PeekViewLocation } from "./PeekView";

// Inline Diff
export { InlineDiff } from "./InlineDiff";
export type { InlineDiffProps } from "./InlineDiff";

// Snippet Manager
export { SnippetManager } from "./SnippetManager";
export type { SnippetManagerProps, SnippetPlaceholder } from "./SnippetManager";

// Bracket Pair Colorizer
export { BracketPairColorizer } from "./BracketPairColorizer";
export type { BracketPairColorizerProps } from "./BracketPairColorizer";

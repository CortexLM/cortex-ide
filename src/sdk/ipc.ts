import { invoke } from "@tauri-apps/api/core";
import { editorLogger } from "@/utils/logger";

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface CodeActionContext {
  diagnostics: LspDiagnostic[];
  only?: string[];
  triggerKind?: number;
}

export interface LspDiagnostic {
  range: LspRange;
  message: string;
  severity?: number;
  code?: string | number;
  source?: string;
}

export interface CodeAction {
  title: string;
  kind?: string;
  isPreferred?: boolean;
  edit?: WorkspaceEdit;
  command?: LspCommand;
  diagnostics?: LspDiagnostic[];
}

export interface WorkspaceEdit {
  changes?: Record<string, TextEdit[]>;
}

export interface TextEdit {
  range: LspRange;
  newText: string;
}

export interface LspCommand {
  title: string;
  command: string;
  arguments?: unknown[];
}

export interface CodeLens {
  range: LspRange;
  command?: LspCommand;
  data?: unknown;
}

export interface FormattingOptions {
  tabSize: number;
  insertSpaces: boolean;
  trimTrailingWhitespace?: boolean;
  insertFinalNewline?: boolean;
  trimFinalNewlines?: boolean;
}

export interface PrepareRenameResult {
  range: LspRange;
  placeholder: string;
}

export interface SignatureHelp {
  signatures: SignatureInformation[];
  activeSignature: number;
  activeParameter: number;
}

export interface SignatureInformation {
  label: string;
  documentation?: string;
  parameters?: ParameterInformation[];
}

export interface ParameterInformation {
  label: string | [number, number];
  documentation?: string;
}

export interface InlayHint {
  position: LspPosition;
  label: string;
  kind?: number;
  paddingLeft?: boolean;
  paddingRight?: boolean;
}

export interface CallHierarchyItem {
  name: string;
  kind: number;
  uri: string;
  range: LspRange;
  selectionRange: LspRange;
  detail?: string;
}

export interface CallHierarchyIncomingCall {
  from: CallHierarchyItem;
  fromRanges: LspRange[];
}

export interface CallHierarchyOutgoingCall {
  to: CallHierarchyItem;
  fromRanges: LspRange[];
}

export interface TypeHierarchyItem {
  name: string;
  kind: number;
  uri: string;
  range: LspRange;
  selectionRange: LspRange;
  detail?: string;
}

export interface DapBreakpoint {
  id: number;
  verified: boolean;
  line: number;
  column?: number;
  source?: string;
  condition?: string;
  logMessage?: string;
}

export interface DapDataBreakpoint {
  id: number;
  verified: boolean;
  variableName: string;
  accessType: "read" | "write" | "readWrite";
}

export interface WatchExpression {
  id: string;
  expression: string;
  result?: string;
  type?: string;
}

export interface EvalResult {
  result: string;
  type?: string;
  variablesReference?: number;
}

export interface DisassembledInstruction {
  address: string;
  instruction: string;
  instructionBytes?: string;
  line?: number;
  location?: string;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  path: string;
  description?: string;
}

export interface ExtensionPermissions {
  fileSystem: boolean;
  network: boolean;
  process: boolean;
  clipboard: boolean;
  env: boolean;
}

export interface ExtensionLifecycleState {
  state: "installed" | "enabled" | "disabled" | "activating" | "active" | "deactivating" | "error";
  lastError?: string;
  activatedAt?: number;
}

export interface DiagnosticEntry {
  uri: string;
  range: LspRange;
  severity: "error" | "warning" | "information" | "hint";
  message: string;
  code?: string | number;
  source?: string;
}

export interface DiagnosticsSummary {
  totalErrors: number;
  totalWarnings: number;
  totalInformation: number;
  totalHints: number;
  fileCount: number;
}

export interface DiagnosticsFilter {
  severity?: "error" | "warning" | "information" | "hint";
  source?: string;
  uri?: string;
}

export interface TerminalSearchResult {
  line: number;
  column: number;
  text: string;
}

export interface TerminalProfile {
  id: string;
  name: string;
  shell: string;
  args?: string[];
  env?: Record<string, string>;
  icon?: string;
  isDefault?: boolean;
}

export interface TerminalLink {
  startIndex: number;
  length: number;
  text: string;
  uri?: string;
}

export async function lspCodeAction(
  serverId: string,
  uri: string,
  range: LspRange,
  context: CodeActionContext,
): Promise<CodeAction[]> {
  try {
    return await invoke<CodeAction[]>("lsp_code_action", { serverId, uri, range, context });
  } catch {
    return [];
  }
}

export async function lspCodeLens(serverId: string, uri: string): Promise<CodeLens[]> {
  try {
    return await invoke<CodeLens[]>("lsp_code_lens", { serverId, uri });
  } catch {
    return [];
  }
}

export async function lspResolveCodeLens(serverId: string, codeLens: CodeLens): Promise<CodeLens> {
  try {
    return await invoke<CodeLens>("lsp_resolve_code_lens", { serverId, codeLens });
  } catch {
    return codeLens;
  }
}

export async function lspFormatDocument(
  serverId: string,
  uri: string,
  options: FormattingOptions,
): Promise<TextEdit[]> {
  try {
    return await invoke<TextEdit[]>("lsp_format_document", { serverId, uri, options });
  } catch {
    return [];
  }
}

export async function lspFormatRange(
  serverId: string,
  uri: string,
  range: LspRange,
  options: FormattingOptions,
): Promise<TextEdit[]> {
  try {
    return await invoke<TextEdit[]>("lsp_format_range", { serverId, uri, range, options });
  } catch {
    return [];
  }
}

export async function lspRename(
  serverId: string,
  uri: string,
  position: LspPosition,
  newName: string,
): Promise<WorkspaceEdit | null> {
  try {
    return await invoke<WorkspaceEdit>("lsp_rename", { serverId, uri, position, newName });
  } catch {
    return null;
  }
}

export async function lspPrepareRename(
  serverId: string,
  uri: string,
  position: LspPosition,
): Promise<PrepareRenameResult | null> {
  try {
    return await invoke<PrepareRenameResult>("lsp_prepare_rename", { serverId, uri, position });
  } catch {
    return null;
  }
}

export async function lspSignatureHelp(
  serverId: string,
  uri: string,
  position: LspPosition,
): Promise<SignatureHelp | null> {
  try {
    return await invoke<SignatureHelp>("lsp_signature_help", { serverId, uri, position });
  } catch {
    return null;
  }
}

export async function lspInlayHints(
  serverId: string,
  uri: string,
  range: LspRange,
): Promise<InlayHint[]> {
  try {
    return await invoke<InlayHint[]>("lsp_inlay_hints", { serverId, uri, range });
  } catch {
    return [];
  }
}

export async function lspCallHierarchyPrepare(
  serverId: string,
  uri: string,
  position: LspPosition,
): Promise<CallHierarchyItem[]> {
  try {
    return await invoke<CallHierarchyItem[]>("lsp_call_hierarchy_prepare", { serverId, uri, position });
  } catch {
    return [];
  }
}

export async function lspCallHierarchyIncoming(
  serverId: string,
  item: CallHierarchyItem,
): Promise<CallHierarchyIncomingCall[]> {
  try {
    return await invoke<CallHierarchyIncomingCall[]>("lsp_call_hierarchy_incoming", { serverId, item });
  } catch {
    return [];
  }
}

export async function lspCallHierarchyOutgoing(
  serverId: string,
  item: CallHierarchyItem,
): Promise<CallHierarchyOutgoingCall[]> {
  try {
    return await invoke<CallHierarchyOutgoingCall[]>("lsp_call_hierarchy_outgoing", { serverId, item });
  } catch {
    return [];
  }
}

export async function lspTypeHierarchyPrepare(
  serverId: string,
  uri: string,
  position: LspPosition,
): Promise<TypeHierarchyItem[]> {
  try {
    return await invoke<TypeHierarchyItem[]>("lsp_type_hierarchy_prepare", { serverId, uri, position });
  } catch {
    return [];
  }
}

export async function lspTypeHierarchySupertypes(
  serverId: string,
  item: TypeHierarchyItem,
): Promise<TypeHierarchyItem[]> {
  try {
    return await invoke<TypeHierarchyItem[]>("lsp_type_hierarchy_supertypes", { serverId, item });
  } catch {
    return [];
  }
}

export async function lspTypeHierarchySubtypes(
  serverId: string,
  item: TypeHierarchyItem,
): Promise<TypeHierarchyItem[]> {
  try {
    return await invoke<TypeHierarchyItem[]>("lsp_type_hierarchy_subtypes", { serverId, item });
  } catch {
    return [];
  }
}

export async function dapSetConditionalBreakpoint(
  sessionId: string,
  source: string,
  line: number,
  condition: string,
): Promise<DapBreakpoint | null> {
  try {
    return await invoke<DapBreakpoint>("dap_set_conditional_breakpoint", {
      sessionId, source, line, condition,
    });
  } catch {
    return null;
  }
}

export async function dapSetLogpoint(
  sessionId: string,
  source: string,
  line: number,
  logMessage: string,
): Promise<DapBreakpoint | null> {
  try {
    return await invoke<DapBreakpoint>("dap_set_logpoint", {
      sessionId, source, line, logMessage,
    });
  } catch {
    return null;
  }
}

export async function dapSetDataBreakpoint(
  sessionId: string,
  variableName: string,
  accessType: "read" | "write" | "readWrite",
): Promise<DapDataBreakpoint | null> {
  try {
    return await invoke<DapDataBreakpoint>("dap_set_data_breakpoint", {
      sessionId, variableName, accessType,
    });
  } catch {
    return null;
  }
}

export async function dapAddWatchExpression(
  sessionId: string,
  expression: string,
): Promise<WatchExpression | null> {
  try {
    return await invoke<WatchExpression>("dap_add_watch_expression", {
      sessionId, expression,
    });
  } catch {
    return null;
  }
}

export async function dapRemoveWatchExpression(
  sessionId: string,
  id: string,
): Promise<boolean> {
  try {
    await invoke("dap_remove_watch_expression", { sessionId, id });
    return true;
  } catch {
    return false;
  }
}

export async function dapEvaluateWatch(
  sessionId: string,
  expression: string,
  frameId?: number,
): Promise<EvalResult | null> {
  try {
    return await invoke<EvalResult>("dap_evaluate_watch", {
      sessionId, expression, frameId,
    });
  } catch {
    return null;
  }
}

export async function dapDebugConsoleEval(
  sessionId: string,
  expression: string,
  context: "repl" | "watch" | "hover" = "repl",
): Promise<EvalResult | null> {
  try {
    return await invoke<EvalResult>("dap_debug_console_eval", {
      sessionId, expression, context,
    });
  } catch {
    return null;
  }
}

export async function dapDisassemble(
  sessionId: string,
  memoryReference: string,
  offset: number,
  instructionCount: number,
): Promise<DisassembledInstruction[]> {
  try {
    return await invoke<DisassembledInstruction[]>("dap_disassemble", {
      sessionId, memoryReference, offset, instructionCount,
    });
  } catch {
    return [];
  }
}

export async function extensionInstall(path: string): Promise<ExtensionInfo | null> {
  try {
    return await invoke<ExtensionInfo>("install_extension", { path });
  } catch {
    return null;
  }
}

export async function extensionUninstall(extensionId: string): Promise<boolean> {
  try {
    await invoke("uninstall_extension", { extensionId });
    return true;
  } catch {
    return false;
  }
}

export async function extensionEnable(extensionId: string): Promise<boolean> {
  try {
    await invoke("enable_extension", { extensionId });
    return true;
  } catch {
    return false;
  }
}

export async function extensionDisable(extensionId: string): Promise<boolean> {
  try {
    await invoke("disable_extension", { extensionId });
    return true;
  } catch {
    return false;
  }
}

export async function extensionGetPermissions(extensionId: string): Promise<ExtensionPermissions> {
  try {
    return await invoke<ExtensionPermissions>("get_extension_permissions", { extensionId });
  } catch {
    return { fileSystem: false, network: false, process: false, clipboard: false, env: false };
  }
}

export async function extensionSetPermissions(
  extensionId: string,
  permissions: ExtensionPermissions,
): Promise<boolean> {
  try {
    await invoke("set_extension_permissions", { extensionId, permissions });
    return true;
  } catch {
    return false;
  }
}

export async function extensionGetLifecycleState(extensionId: string): Promise<ExtensionLifecycleState> {
  try {
    return await invoke<ExtensionLifecycleState>("get_extension_lifecycle_state", { extensionId });
  } catch {
    return { state: "error", lastError: "Failed to get lifecycle state" };
  }
}

export async function extensionTriggerHostFunction(
  extensionId: string,
  functionName: string,
  args: unknown[],
): Promise<unknown> {
  try {
    return await invoke("trigger_extension_host_function", {
      extensionId, functionName, args,
    });
  } catch {
    return null;
  }
}

export async function extensionListInstalled(): Promise<ExtensionInfo[]> {
  try {
    return await invoke<ExtensionInfo[]>("list_installed_extensions");
  } catch {
    return [];
  }
}

export async function getDiagnosticsByFile(uri: string): Promise<DiagnosticEntry[]> {
  try {
    return await invoke<DiagnosticEntry[]>("diagnostics_get_by_file", { uri });
  } catch {
    return [];
  }
}

export async function getDiagnosticsSummary(): Promise<DiagnosticsSummary> {
  try {
    return await invoke<DiagnosticsSummary>("diagnostics_get_summary");
  } catch {
    return { totalErrors: 0, totalWarnings: 0, totalInformation: 0, totalHints: 0, fileCount: 0 };
  }
}

export async function filterDiagnostics(filter: DiagnosticsFilter): Promise<DiagnosticEntry[]> {
  try {
    return await invoke<DiagnosticEntry[]>("diagnostics_filter", { filter });
  } catch {
    return [];
  }
}

export async function searchTerminal(
  terminalId: string,
  query: string,
): Promise<TerminalSearchResult[]> {
  try {
    return await invoke<TerminalSearchResult[]>("terminal_search", { terminalId, query });
  } catch {
    return [];
  }
}

export async function getTerminalProfiles(): Promise<TerminalProfile[]> {
  try {
    return await invoke<TerminalProfile[]>("terminal_get_profiles");
  } catch {
    return [];
  }
}

export async function saveTerminalProfile(profile: TerminalProfile): Promise<boolean> {
  try {
    await invoke("terminal_save_profile", { profile });
    return true;
  } catch {
    return false;
  }
}

export async function detectTerminalLinks(terminalId: string): Promise<TerminalLink[]> {
  try {
    return await invoke<TerminalLink[]>("terminal_detect_links", { terminalId });
  } catch {
    return [];
  }
}

// ============================================================================
// Editor Feature Commands
// ============================================================================

export interface FoldingRange {
  startLine: number;
  endLine: number;
  kind: "comment" | "imports" | "region" | "block";
  collapsedText?: string;
}

export interface BreadcrumbSegment {
  name: string;
  kind: string;
  line: number;
  column: number;
}

export interface StickyScrollLineEntry {
  line: number;
  text: string;
  indentLevel: number;
  scopeKind: string;
}

export interface InlineDiffLine {
  changeType: "equal" | "insert" | "delete";
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  charChanges: InlineDiffCharChange[];
}

export interface InlineDiffCharChange {
  changeType: "equal" | "insert" | "delete";
  value: string;
}

export interface InlineDiffResult {
  lines: InlineDiffLine[];
  stats: {
    insertions: number;
    deletions: number;
    unchanged: number;
  };
  hasChanges: boolean;
}

export interface ExpandedSnippet {
  text: string;
  cursorOffset: number;
  tabStops: SnippetTabStop[];
}

export interface SnippetTabStop {
  index: number;
  offset: number;
  length: number;
  placeholder: string;
}

export interface EditorSymbolEntry {
  name: string;
  kind: string;
  filePath: string;
  line: number;
  column: number;
  containerName: string | null;
  score: number;
}

export interface FileChange {
  filePath: string;
  originalContent: string;
  newContent: string;
  occurrences: number;
}

export interface RenameResult {
  filesChanged: number;
  totalOccurrences: number;
  changes: FileChange[];
}

export interface ExtractResult {
  newContent: string;
  extractedText: string;
  insertedAtLine: number;
}

export async function renameAcrossFiles(
  workspacePath: string,
  oldName: string,
  newName: string,
  filePaths: string[],
): Promise<RenameResult | null> {
  try {
    return await invoke<RenameResult>("rename_across_files", {
      workspacePath,
      oldName,
      newName,
      filePaths,
    });
  } catch (error) {
    editorLogger.warn("[ipc] renameAcrossFiles failed:", error);
    return null;
  }
}

export async function extractVariable(
  content: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
  variableName: string,
): Promise<ExtractResult | null> {
  try {
    return await invoke<ExtractResult>("extract_variable", {
      content,
      startLine,
      startColumn,
      endLine,
      endColumn,
      variableName,
    });
  } catch (error) {
    editorLogger.warn("[ipc] extractVariable failed:", error);
    return null;
  }
}

export async function extractMethod(
  content: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
  methodName: string,
): Promise<ExtractResult | null> {
  try {
    return await invoke<ExtractResult>("extract_method", {
      content,
      startLine,
      startColumn,
      endLine,
      endColumn,
      methodName,
    });
  } catch (error) {
    editorLogger.warn("[ipc] extractMethod failed:", error);
    return null;
  }
}

export async function computeFoldingRanges(
  content: string,
  language: string,
): Promise<FoldingRange[]> {
  try {
    return await invoke<FoldingRange[]>("compute_folding_ranges", { content, language });
  } catch (error) {
    editorLogger.warn("[ipc] computeFoldingRanges failed:", error);
    return [];
  }
}

export async function getWorkspaceSymbols(
  workspacePath: string,
  query: string,
  maxResults?: number,
): Promise<EditorSymbolEntry[]> {
  try {
    return await invoke<EditorSymbolEntry[]>("get_workspace_symbols", {
      workspacePath,
      query,
      maxResults: maxResults ?? 100,
    });
  } catch (error) {
    editorLogger.warn("[ipc] getWorkspaceSymbols failed:", error);
    return [];
  }
}

export async function expandSnippet(
  body: string[],
  variables: Record<string, string>,
): Promise<ExpandedSnippet | null> {
  try {
    return await invoke<ExpandedSnippet>("expand_snippet", { body, variables });
  } catch (error) {
    editorLogger.warn("[ipc] expandSnippet failed:", error);
    return null;
  }
}

export async function computeInlineDiff(
  original: string,
  modified: string,
): Promise<InlineDiffResult | null> {
  try {
    return await invoke<InlineDiffResult>("compute_inline_diff", { original, modified });
  } catch (error) {
    editorLogger.warn("[ipc] computeInlineDiff failed:", error);
    return null;
  }
}

export async function getBreadcrumbPath(
  filePath: string,
  line: number,
  column: number,
): Promise<BreadcrumbSegment[]> {
  try {
    return await invoke<BreadcrumbSegment[]>("get_breadcrumb_path", { filePath, line, column });
  } catch (error) {
    editorLogger.warn("[ipc] getBreadcrumbPath failed:", error);
    return [];
  }
}

export async function getStickyScrollLines(
  content: string,
  language: string,
  visibleStartLine: number,
): Promise<StickyScrollLineEntry[]> {
  try {
    return await invoke<StickyScrollLineEntry[]>("get_sticky_scroll_lines", {
      content,
      language,
      visibleStartLine,
    });
  } catch (error) {
    editorLogger.warn("[ipc] getStickyScrollLines failed:", error);
    return [];
  }
}

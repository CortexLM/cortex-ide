import { createContext, useContext, ParentProps, onMount, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// LSP Types

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export type DiagnosticSeverity = "error" | "warning" | "information" | "hint";

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: string;
  source?: string;
  message: string;
  relatedInformation?: DiagnosticRelatedInfo[];
}

export interface DiagnosticRelatedInfo {
  location: Location;
  message: string;
}

export interface ServerCapabilities {
  completion: boolean;
  completionResolve: boolean;
  hover: boolean;
  definition: boolean;
  declaration: boolean;
  references: boolean;
  diagnostics: boolean;
  documentFormatting: boolean;
  documentRangeFormatting: boolean;
  rename: boolean;
  prepareRename: boolean;
  codeAction: boolean;
  signatureHelp: boolean;
  inlayHints: boolean;
  documentHighlight: boolean;
  semanticTokens: boolean;
  codeLens: boolean;
  codeLensResolve: boolean;
  foldingRangeProvider: boolean;
  selectionRangeProvider: boolean;
}

// Semantic Tokens Types

/**
 * LSP Semantic Token Legend - describes the token types and modifiers
 * supported by the language server.
 */
export interface SemanticTokensLegend {
  /** The token types that the server supports */
  tokenTypes: string[];
  /** The token modifiers that the server supports */
  tokenModifiers: string[];
}

/**
 * LSP Semantic Tokens result containing encoded token data.
 * Tokens are encoded as a flat array where each token is represented
 * by 5 integers: deltaLine, deltaStart, length, tokenType, tokenModifiers
 */
export interface SemanticTokensResult {
  /** Result ID for incremental updates */
  resultId?: string;
  /** Encoded semantic tokens data */
  data: number[];
  /** The legend describing token types and modifiers */
  legend?: SemanticTokensLegend;
}

/**
 * Decoded semantic token for easier consumption
 */
export interface DecodedSemanticToken {
  /** Line number (0-based) */
  line: number;
  /** Start character (0-based) */
  startChar: number;
  /** Token length */
  length: number;
  /** Token type index */
  tokenType: number;
  /** Token modifiers bitmask */
  tokenModifiers: number;
}

export type ServerStatus = "starting" | "running" | "stopped" | "error";

export interface ServerInfo {
  id: string;
  name: string;
  status: ServerStatus;
  capabilities?: ServerCapabilities;
}

export interface LanguageServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  rootPath: string;
  fileExtensions: string[];
  languageId: string;
}

export type CompletionItemKind =
  | "text" | "method" | "function" | "constructor" | "field"
  | "variable" | "class" | "interface" | "module" | "property"
  | "unit" | "value" | "enum" | "keyword" | "snippet"
  | "color" | "file" | "reference" | "folder" | "enumMember"
  | "constant" | "struct" | "event" | "operator" | "typeParameter";

export interface CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
  insertTextFormat?: number;
  textEdit?: TextEdit;
  additionalTextEdits?: TextEdit[];
  sortText?: string;
  filterText?: string;
  /** Command to execute after inserting this completion */
  command?: Command;
  /** Provider-specific data preserved between completion and resolve */
  data?: unknown;
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface HoverInfo {
  contents: string;
  range?: Range;
}

export interface CompletionResult {
  items: CompletionItem[];
  isIncomplete: boolean;
}

export interface DefinitionResult {
  locations: Location[];
}

export interface ReferencesResult {
  locations: Location[];
}

export interface TypeDefinitionResult {
  locations: Location[];
}

export interface ImplementationResult {
  locations: Location[];
}

export interface DeclarationResult {
  locations: Location[];
}

export interface PrepareRenameResult {
  /** The range of the string to rename */
  range: Range;
  /** The text of the string to rename (placeholder for rename input) */
  placeholder: string;
}

export interface RenameParams {
  uri: string;
  position: Position;
  newName: string;
}

export interface WorkspaceEdit {
  changes?: Record<string, TextEdit[]>;
}

export interface CodeActionParams {
  uri: string;
  range: Range;
  diagnostics: Diagnostic[];
}

export interface CodeAction {
  title: string;
  kind?: string;
  diagnostics?: Diagnostic[];
  isPreferred?: boolean;
  edit?: WorkspaceEdit;
  command?: Command;
}

export interface Command {
  title: string;
  command: string;
  arguments?: unknown[];
}

// Language Status Types

export type LanguageStatusSeverity = "info" | "warning" | "error";

export interface LanguageStatusCommand {
  title: string;
  command: string;
  arguments?: unknown[];
}

export interface LanguageStatusItem {
  id: string;
  label: string;
  severity: LanguageStatusSeverity;
  detail?: string;
  command?: LanguageStatusCommand;
}

export interface CodeActionResult {
  actions: CodeAction[];
}

export interface FormattingParams {
  uri: string;
  tabSize: number;
  insertSpaces: boolean;
}

export interface RangeFormattingParams {
  uri: string;
  range: Range;
  tabSize: number;
  insertSpaces: boolean;
}

export interface FormattingResult {
  edits: TextEdit[];
}

export interface SignatureHelpParams {
  uri: string;
  position: Position;
  triggerKind?: number;
  triggerCharacter?: string;
  isRetrigger?: boolean;
}

export interface ParameterInformation {
  label: string;
  documentation?: string;
}

export interface SignatureInformation {
  label: string;
  documentation?: string;
  parameters?: ParameterInformation[];
  activeParameter?: number;
}

export interface SignatureHelp {
  signatures: SignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
}

export interface DocumentDiagnostics {
  uri: string;
  diagnostics: Diagnostic[];
}

// Inlay Hints Types

export type InlayHintKind = "type" | "parameter";

export interface InlayHintLabelPart {
  value: string;
  tooltip?: string;
  location?: Location;
  command?: Command;
}

export interface InlayHint {
  position: Position;
  label: string | InlayHintLabelPart[];
  kind?: InlayHintKind;
  textEdits?: TextEdit[];
  tooltip?: string;
  paddingLeft?: boolean;
  paddingRight?: boolean;
}

export interface InlayHintsParams {
  uri: string;
  range: Range;
}

export interface InlayHintsResult {
  hints: InlayHint[];
}

// Document Highlight Types

/**
 * Document highlight kind indicating whether the occurrence is a read, write, or text occurrence.
 */
export type DocumentHighlightKind = "text" | "read" | "write";

/**
 * A document highlight represents a range in a text document which deserves
 * special attention, typically used to highlight all occurrences of a symbol.
 */
export interface DocumentHighlight {
  /** The range this highlight applies to */
  range: Range;
  /** The highlight kind (text, read, or write) */
  kind?: DocumentHighlightKind;
}

export interface DocumentHighlightsResult {
  highlights: DocumentHighlight[];
}

// Code Lens Types

/**
 * A code lens represents a command that should be shown along with source text,
 * like the number of references, a way to run tests, etc.
 */
export interface CodeLens {
  /** The range in which the code lens is valid. Should only span a single line. */
  range: Range;
  /** The command this code lens represents. */
  command?: Command;
  /** A data entry field preserved between resolve requests. */
  data?: unknown;
}

export interface CodeLensParams {
  /** The document to request code lenses for. */
  uri: string;
}

export interface CodeLensResult {
  /** The list of code lenses for the document. */
  lenses: CodeLens[];
}

/**
 * Code Lens kind indicating the type of action.
 */
export type CodeLensKind = "references" | "implementations" | "test" | "debug" | "custom";

/**
 * Extended code lens with additional metadata for UI rendering.
 */
export interface ExtendedCodeLens extends CodeLens {
  /** The kind of code lens for categorization. */
  kind?: CodeLensKind;
  /** Whether this is an action (clickable) or just informational. */
  isAction?: boolean;
}

// Folding Range Types

/**
 * Folding range kind indicating the type of folding region.
 */
export type FoldingRangeKind = "comment" | "imports" | "region";

/**
 * Represents a folding range in a document.
 */
export interface FoldingRange {
  /** The start line (0-based, inclusive) */
  startLine: number;
  /** The start character (0-based, optional) */
  startCharacter?: number;
  /** The end line (0-based, inclusive) */
  endLine: number;
  /** The end character (0-based, optional) */
  endCharacter?: number;
  /** The kind of folding range */
  kind?: FoldingRangeKind;
  /** Optional collapsed text to show when folded */
  collapsedText?: string;
}

export interface FoldingRangesResult {
  ranges: FoldingRange[];
}

// Selection Range Types

/**
 * Represents a selection range with optional parent for nested expansion.
 * Used for "Expand Selection" (Shift+Alt+Right) and "Shrink Selection" (Shift+Alt+Left).
 */
export interface SelectionRange {
  /** The range of this selection */
  range: Range;
  /** The parent selection range containing this range (for progressive expansion) */
  parent?: SelectionRange;
}

export interface SelectionRangesResult {
  ranges: SelectionRange[];
}

// Color Types

/**
 * LSP Color representation with RGBA values normalized to 0-1 range.
 */
export interface Color {
  /** Red component (0-1) */
  red: number;
  /** Green component (0-1) */
  green: number;
  /** Blue component (0-1) */
  blue: number;
  /** Alpha component (0-1) */
  alpha: number;
}

/**
 * Color information returned from LSP textDocument/documentColor.
 */
export interface ColorInformation {
  /** The range in the document where the color appears */
  range: Range;
  /** The color value */
  color: Color;
}

/**
 * Color presentation returned from LSP textDocument/colorPresentation.
 */
export interface ColorPresentation {
  /** The label of this color presentation (e.g., "#ff0000" or "rgb(255, 0, 0)") */
  label: string;
  /** An edit which is applied to a document when selecting this presentation */
  textEdit?: {
    range: Range;
    newText: string;
  };
  /** Additional edits to apply when selecting this presentation */
  additionalTextEdits?: Array<{
    range: Range;
    newText: string;
  }>;
}

// Document Link Types

/**
 * Document link returned from LSP textDocument/documentLink.
 */
export interface DocumentLink {
  /** The range this link spans in the document */
  range: Range;
  /** The target URI this link points to (may need resolving) */
  target?: string;
  /** Tooltip shown when hovering over the link */
  tooltip?: string;
  /** Data preserved between documentLink and documentLink/resolve requests */
  data?: unknown;
}

/**
 * EvaluatableExpression result from LSP.
 * Used to determine what expression to evaluate when hovering during debug.
 * The LSP textDocument/evaluatableExpression request tells the debugger
 * what expression to evaluate at a given position.
 */
export interface EvaluatableExpression {
  /** The range of the evaluatable expression in the document */
  range: Range;
  /** The expression to evaluate. If not provided, use the text at the range. */
  expression?: string;
}

// Type Hierarchy Types

export type SymbolKind =
  | "file" | "module" | "namespace" | "package" | "class"
  | "method" | "property" | "field" | "constructor" | "enum"
  | "interface" | "function" | "variable" | "constant" | "string"
  | "number" | "boolean" | "array" | "object" | "key"
  | "null" | "enumMember" | "struct" | "event" | "operator" | "typeParameter";

/**
 * Represents a type in the type hierarchy.
 * This is used for the LSP typeHierarchy/* requests.
 */
export interface TypeHierarchyItem {
  /** The name of the type (e.g., class name, interface name) */
  name: string;
  /** The kind of symbol (class, interface, enum, etc.) */
  kind: SymbolKind;
  /** Additional detail like module path or generic parameters */
  detail?: string;
  /** The URI of the document containing the type */
  uri: string;
  /** The full range of the type definition */
  range: Range;
  /** The range that should be selected when navigating to the type */
  selectionRange: Range;
  /** Tags for deprecated, etc. */
  tags?: number[];
  /** Provider-specific data that should be preserved across requests */
  data?: unknown;
}

export interface TypeHierarchyPrepareResult {
  items: TypeHierarchyItem[];
}

export interface SupertypesResult {
  items: TypeHierarchyItem[];
}

export interface SubtypesResult {
  items: TypeHierarchyItem[];
}

// Workspace Symbols Types

export interface WorkspaceSymbolInfo {
  name: string;
  kind: SymbolKind;
  containerName?: string;
  location: Location;
  tags?: number[];
}

export interface WorkspaceSymbolsResult {
  symbols: WorkspaceSymbolInfo[];
}

// State

interface LSPState {
  servers: Record<string, ServerInfo>;
  diagnostics: Record<string, DocumentDiagnostics>;
  languageStatus: Record<string, LanguageStatusItem[]>;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

interface LSPContextValue {
  state: LSPState;
  // Lazy initialization - call when first file is opened
  lazyInit: () => void;
  // Server management
  startServer: (config: LanguageServerConfig) => Promise<ServerInfo>;
  stopServer: (serverId: string) => Promise<void>;
  stopAllServers: () => Promise<void>;
  restartServer: (serverId: string) => Promise<ServerInfo>;
  getServerForFile: (filePath: string) => ServerInfo | undefined;
  getServerLogs: (serverId: string) => Promise<string[]>;
  // Document synchronization
  didOpen: (serverId: string, uri: string, languageId: string, version: number, text: string) => Promise<void>;
  didChange: (serverId: string, uri: string, version: number, text: string) => Promise<void>;
  didSave: (serverId: string, uri: string, text?: string) => Promise<void>;
  didClose: (serverId: string, uri: string) => Promise<void>;
  // Language features
  getCompletions: (serverId: string, uri: string, position: Position, triggerKind?: number, triggerCharacter?: string) => Promise<CompletionResult>;
  resolveCompletionItem: (serverId: string, item: CompletionItem) => Promise<CompletionItem>;
  getHover: (serverId: string, uri: string, position: Position) => Promise<HoverInfo | null>;
  getDefinition: (serverId: string, uri: string, position: Position) => Promise<DefinitionResult>;
  getTypeDefinition: (serverId: string, uri: string, position: Position) => Promise<TypeDefinitionResult>;
  getImplementation: (serverId: string, uri: string, position: Position) => Promise<ImplementationResult>;
  getDeclaration: (serverId: string, uri: string, position: Position) => Promise<DeclarationResult>;
  getReferences: (serverId: string, uri: string, position: Position) => Promise<ReferencesResult>;
  getSignatureHelp: (serverId: string, uri: string, position: Position, triggerKind?: number, triggerCharacter?: string, isRetrigger?: boolean) => Promise<SignatureHelp | null>;
  rename: (serverId: string, uri: string, position: Position, newName: string) => Promise<WorkspaceEdit>;
  prepareRename: (serverId: string, uri: string, position: Position) => Promise<PrepareRenameResult | null>;
  getCodeActions: (serverId: string, uri: string, range: Range, diagnostics: Diagnostic[]) => Promise<CodeActionResult>;
  formatDocument: (serverId: string, uri: string, tabSize: number, insertSpaces: boolean) => Promise<FormattingResult>;
  formatRange: (serverId: string, uri: string, range: Range, tabSize: number, insertSpaces: boolean) => Promise<FormattingResult>;
  // Inlay Hints
  getInlayHints: (serverId: string, uri: string, range: Range) => Promise<InlayHintsResult>;
  // Document Highlights
  getDocumentHighlights: (serverId: string, uri: string, position: Position) => Promise<DocumentHighlightsResult>;
  // Type Hierarchy
  prepareTypeHierarchy: (filePath: string, position: Position) => Promise<TypeHierarchyPrepareResult>;
  getSupertypes: (item: TypeHierarchyItem) => Promise<SupertypesResult>;
  getSubtypes: (item: TypeHierarchyItem) => Promise<SubtypesResult>;
  // Semantic Tokens
  getSemanticTokens: (serverId: string, uri: string) => Promise<SemanticTokensResult | null>;
  getSemanticTokensRange: (serverId: string, uri: string, range: Range) => Promise<SemanticTokensResult | null>;
  getSemanticTokensLegend: (serverId: string) => Promise<SemanticTokensLegend | null>;
  // Workspace Symbols
  getWorkspaceSymbols: (projectPath: string, query: string) => Promise<WorkspaceSymbolsResult>;
  // Code Lens
  getCodeLenses: (serverId: string, uri: string) => Promise<CodeLensResult>;
  resolveCodeLens: (serverId: string, codeLens: CodeLens) => Promise<CodeLens>;
  // Folding Ranges
  getFoldingRanges: (serverId: string, uri: string) => Promise<FoldingRange[]>;
  // Selection Ranges
  getSelectionRanges: (serverId: string, uri: string, positions: Position[]) => Promise<SelectionRange[]>;
  // Evaluatable Expression (for debug hover)
  getEvaluatableExpression: (serverId: string, uri: string, position: Position) => Promise<EvaluatableExpression | null>;
  // Document Colors
  getDocumentColors: (serverId: string, uri: string) => Promise<ColorInformation[]>;
  getColorPresentations: (serverId: string, uri: string, color: Color, range: Range) => Promise<ColorPresentation[]>;
  // Document Links
  getDocumentLinks: (serverId: string, uri: string) => Promise<DocumentLink[]>;
  resolveDocumentLink: (serverId: string, link: DocumentLink) => Promise<DocumentLink>;
  // Diagnostics
  getDiagnosticsForFile: (uri: string) => Diagnostic[];
  getAllDiagnostics: () => DocumentDiagnostics[];
  clearDiagnostics: (uri: string) => void;
  // Language Status
  setLanguageStatus: (language: string, items: LanguageStatusItem[]) => void;
  addLanguageStatusItem: (language: string, item: LanguageStatusItem) => void;
  removeLanguageStatusItem: (language: string, itemId: string) => void;
  getLanguageStatusItems: (language: string) => LanguageStatusItem[];
  clearLanguageStatus: (language: string) => void;
}

const LSPContext = createContext<LSPContextValue>();

// Mapping from file extension to language config
const LANGUAGE_CONFIGS: Record<string, Omit<LanguageServerConfig, "id" | "rootPath">> = {
  ts: {
    name: "TypeScript",
    command: "typescript-language-server",
    args: ["--stdio"],
    fileExtensions: ["ts", "tsx", "mts", "cts"],
    languageId: "typescript",
  },
  tsx: {
    name: "TypeScript",
    command: "typescript-language-server",
    args: ["--stdio"],
    fileExtensions: ["ts", "tsx", "mts", "cts"],
    languageId: "typescriptreact",
  },
  js: {
    name: "JavaScript",
    command: "typescript-language-server",
    args: ["--stdio"],
    fileExtensions: ["js", "jsx", "mjs", "cjs"],
    languageId: "javascript",
  },
  jsx: {
    name: "JavaScript",
    command: "typescript-language-server",
    args: ["--stdio"],
    fileExtensions: ["js", "jsx", "mjs", "cjs"],
    languageId: "javascriptreact",
  },
  rs: {
    name: "Rust",
    command: "rust-analyzer",
    args: [],
    fileExtensions: ["rs"],
    languageId: "rust",
  },
  py: {
    name: "Python",
    command: "pylsp",
    args: [],
    fileExtensions: ["py", "pyw", "pyi"],
    languageId: "python",
  },
  go: {
    name: "Go",
    command: "gopls",
    args: [],
    fileExtensions: ["go"],
    languageId: "go",
  },
};

export function LSPProvider(props: ParentProps) {
  const [state, setState] = createStore<LSPState>({
    servers: {},
    diagnostics: {},
    languageStatus: {},
    loading: false,
    error: null,
    initialized: false,
  });

  let unlistenDiagnostics: UnlistenFn | undefined;
  let listenersInitialized = false;

  // Lazy initialization - sets up event listeners on first file open
  // Idempotent: safe to call multiple times
  const lazyInit = () => {
    if (listenersInitialized) return;
    listenersInitialized = true;

    const initListeners = async () => {
      // Listen for diagnostics events from the backend
      unlistenDiagnostics = await listen<{
        server_id: string;
        uri: string;
        diagnostics: Array<{
          range: { start: Position; end: Position };
          severity?: number;
          code?: string;
          source?: string;
          message: string;
          related_information?: Array<{
            location: { uri: string; range: Range };
            message: string;
          }>;
        }>;
      }>("lsp:diagnostics", (event) => {
        const { uri, diagnostics } = event.payload;

        const mapped: Diagnostic[] = diagnostics.map((d) => ({
          range: d.range,
          severity: mapSeverity(d.severity),
          code: d.code,
          source: d.source,
          message: d.message,
          relatedInformation: d.related_information?.map((ri) => ({
            location: ri.location,
            message: ri.message,
          })),
        }));

        setState("diagnostics", uri, { uri, diagnostics: mapped });
      });

      setState("initialized", true);
    };

    initListeners().catch(console.error);
  };

  // Register cleanup synchronously
  onCleanup(() => {
    unlistenDiagnostics?.();
    // Stop all servers on cleanup
    stopAllServers().catch(console.error);
  });

  // Deferred fallback: set up listeners during idle time even if no file is opened
  onMount(() => {
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(() => lazyInit(), { timeout: 2000 });
    } else {
      setTimeout(() => lazyInit(), 100);
    }
  });

  const mapSeverity = (severity?: number): DiagnosticSeverity | undefined => {
    switch (severity) {
      case 1: return "error";
      case 2: return "warning";
      case 3: return "information";
      case 4: return "hint";
      default: return undefined;
    }
  };

  const startServer = async (config: LanguageServerConfig): Promise<ServerInfo> => {
    // Ensure event listeners are set up before starting any server
    lazyInit();
    setState("loading", true);
    setState("error", null);

    try {
      const info = await invoke<ServerInfo>("lsp_start_server", {
        config: {
          id: config.id,
          name: config.name,
          command: config.command,
          args: config.args,
          root_path: config.rootPath,
          file_extensions: config.fileExtensions,
          language_id: config.languageId,
        },
      });

      setState("servers", config.id, info);
      return info;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    } finally {
      setState("loading", false);
    }
  };

  const stopServer = async (serverId: string): Promise<void> => {
    try {
      await invoke("lsp_stop_server", { serverId });
      setState("servers", serverId, undefined!);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const stopAllServers = async (): Promise<void> => {
    try {
      await invoke("lsp_stop_all_servers");
      setState("servers", {});
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      throw e;
    }
  };

  const getServerForFile = (filePath: string): ServerInfo | undefined => {
    const ext = filePath.split(".").pop()?.toLowerCase();
    if (!ext) return undefined;

    return Object.values(state.servers).find((server) => {
      const config = LANGUAGE_CONFIGS[ext];
      return config && server.name === config.name && server.status === "running";
    });
  };

  const didOpen = async (
    serverId: string,
    uri: string,
    languageId: string,
    version: number,
    text: string
  ): Promise<void> => {
    try {
      await invoke("lsp_did_open", {
        serverId,
        params: { uri, language_id: languageId, version, text },
      });
    } catch (error) {
      console.error("LSP didOpen failed:", error);
    }
  };

  const didChange = async (
    serverId: string,
    uri: string,
    version: number,
    text: string
  ): Promise<void> => {
    try {
      await invoke("lsp_did_change", {
        serverId,
        params: { uri, version, text },
      });
    } catch (error) {
      console.error("LSP didChange failed:", error);
    }
  };

  const didSave = async (serverId: string, uri: string, text?: string): Promise<void> => {
    try {
      await invoke("lsp_did_save", {
        serverId,
        params: { uri, text },
      });
    } catch (error) {
      console.error("LSP didSave failed:", error);
    }
  };

  const didClose = async (serverId: string, uri: string): Promise<void> => {
    try {
      await invoke("lsp_did_close", {
        serverId,
        params: { uri },
      });
    } catch (error) {
      console.error("LSP didClose failed:", error);
    }
  };

  const getCompletions = async (
    serverId: string,
    uri: string,
    position: Position,
    triggerKind?: number,
    triggerCharacter?: string
  ): Promise<CompletionResult> => {
    const result = await invoke<CompletionResult>("lsp_completion", {
      serverId,
      params: {
        uri,
        position,
        trigger_kind: triggerKind,
        trigger_character: triggerCharacter,
      },
    });

    return {
      items: result.items.map((item) => ({
        ...item,
        kind: mapCompletionKind(item.kind as unknown as number),
      })),
      isIncomplete: result.isIncomplete,
    };
  };

  const mapCompletionKind = (kind?: number): CompletionItemKind | undefined => {
    const kinds: CompletionItemKind[] = [
      "text", "method", "function", "constructor", "field",
      "variable", "class", "interface", "module", "property",
      "unit", "value", "enum", "keyword", "snippet",
      "color", "file", "reference", "folder", "enumMember",
      "constant", "struct", "event", "operator", "typeParameter",
    ];
    return kind && kind >= 1 && kind <= 25 ? kinds[kind - 1] : undefined;
  };

  const completionKindToNumber = (kind?: CompletionItemKind): number | undefined => {
    if (!kind) return undefined;
    const kinds: CompletionItemKind[] = [
      "text", "method", "function", "constructor", "field",
      "variable", "class", "interface", "module", "property",
      "unit", "value", "enum", "keyword", "snippet",
      "color", "file", "reference", "folder", "enumMember",
      "constant", "struct", "event", "operator", "typeParameter",
    ];
    const index = kinds.indexOf(kind);
    return index >= 0 ? index + 1 : undefined;
  };

  const resolveCompletionItem = async (
    serverId: string,
    item: CompletionItem
  ): Promise<CompletionItem> => {
    try {
      const result = await invoke<{
        label: string;
        kind?: number;
        detail?: string;
        documentation?: string;
        insert_text?: string;
        insert_text_format?: number;
        text_edit?: { range: Range; new_text: string };
        additional_text_edits?: Array<{ range: Range; new_text: string }>;
        sort_text?: string;
        filter_text?: string;
        command?: { title: string; command: string; arguments?: unknown[] };
        data?: unknown;
      }>("lsp_completion_resolve", {
        serverId,
        item: {
          label: item.label,
          kind: completionKindToNumber(item.kind),
          detail: item.detail,
          documentation: item.documentation,
          insert_text: item.insertText,
          insert_text_format: item.insertTextFormat,
          text_edit: item.textEdit ? {
            range: item.textEdit.range,
            new_text: item.textEdit.newText,
          } : undefined,
          additional_text_edits: item.additionalTextEdits?.map((edit) => ({
            range: edit.range,
            new_text: edit.newText,
          })),
          sort_text: item.sortText,
          filter_text: item.filterText,
          command: item.command ? {
            title: item.command.title,
            command: item.command.command,
            arguments: item.command.arguments,
          } : undefined,
          data: item.data,
        },
      });

      return {
        label: result.label,
        kind: mapCompletionKind(result.kind),
        detail: result.detail,
        documentation: result.documentation,
        insertText: result.insert_text,
        insertTextFormat: result.insert_text_format,
        textEdit: result.text_edit ? {
          range: result.text_edit.range,
          newText: result.text_edit.new_text,
        } : undefined,
        additionalTextEdits: result.additional_text_edits?.map((edit) => ({
          range: edit.range,
          newText: edit.new_text,
        })),
        sortText: result.sort_text,
        filterText: result.filter_text,
        command: result.command ? {
          title: result.command.title,
          command: result.command.command,
          arguments: result.command.arguments,
        } : undefined,
        data: result.data,
      };
    } catch (e) {
      console.debug("LSP completion resolve error:", e);
      // Return the original item if resolve fails
      return item;
    }
  };

  const getHover = async (
    serverId: string,
    uri: string,
    position: Position
  ): Promise<HoverInfo | null> => {
    return await invoke<HoverInfo | null>("lsp_hover", {
      serverId,
      params: { uri, position },
    });
  };

  const getDefinition = async (
    serverId: string,
    uri: string,
    position: Position
  ): Promise<DefinitionResult> => {
    return await invoke<DefinitionResult>("lsp_definition", {
      serverId,
      params: { uri, position },
    });
  };

  const getReferences = async (
    serverId: string,
    uri: string,
    position: Position
  ): Promise<ReferencesResult> => {
    return await invoke<ReferencesResult>("lsp_references", {
      serverId,
      params: { uri, position },
    });
  };

  const getTypeDefinition = async (
    serverId: string,
    uri: string,
    position: Position
  ): Promise<TypeDefinitionResult> => {
    return await invoke<TypeDefinitionResult>("lsp_type_definition", {
      serverId,
      params: { uri, position },
    });
  };

  const getImplementation = async (
    serverId: string,
    uri: string,
    position: Position
  ): Promise<ImplementationResult> => {
    return await invoke<ImplementationResult>("lsp_implementation", {
      serverId,
      params: { uri, position },
    });
  };

  const getDeclaration = async (
    serverId: string,
    uri: string,
    position: Position
  ): Promise<DeclarationResult> => {
    try {
      const result = await invoke<{ locations: Array<{ uri: string; range: Range }> }>(
        "lsp_declaration",
        {
          serverId,
          params: { uri, position },
        }
      );
      return { locations: result.locations };
    } catch (e) {
      console.debug("LSP declaration error:", e);
      return { locations: [] };
    }
  };

  const getSignatureHelp = async (
    serverId: string,
    uri: string,
    position: Position,
    triggerKind?: number,
    triggerCharacter?: string,
    isRetrigger?: boolean
  ): Promise<SignatureHelp | null> => {
    return await invoke<SignatureHelp | null>("lsp_signature_help", {
      serverId,
      params: {
        uri,
        position,
        trigger_kind: triggerKind,
        trigger_character: triggerCharacter,
        is_retrigger: isRetrigger,
      },
    });
  };

  const rename = async (
    serverId: string,
    uri: string,
    position: Position,
    newName: string
  ): Promise<WorkspaceEdit> => {
    return await invoke<WorkspaceEdit>("lsp_rename", {
      serverId,
      params: { uri, position, new_name: newName },
    });
  };

  const prepareRename = async (
    serverId: string,
    uri: string,
    position: Position
  ): Promise<PrepareRenameResult | null> => {
    try {
      const result = await invoke<{
        range?: Range;
        placeholder?: string;
        default_behavior?: boolean;
      } | null>("lsp_prepare_rename", {
        serverId,
        params: { uri, position },
      });

      if (!result) return null;

      // Handle different response formats from LSP
      // Some servers return { range, placeholder }
      // Others might return { defaultBehavior: true } meaning rename is supported but no specific range
      if (result.default_behavior) {
        // Server supports rename but doesn't provide specific range/placeholder
        // Return null to indicate caller should proceed with default behavior
        return null;
      }

      if (result.range && result.placeholder !== undefined) {
        return {
          range: result.range,
          placeholder: result.placeholder,
        };
      }

      // If we only have range, extract the placeholder from the document
      // This is a fallback - caller should handle this case
      if (result.range) {
        return {
          range: result.range,
          placeholder: result.placeholder ?? "",
        };
      }

      return null;
    } catch (e) {
      console.debug("LSP prepareRename error:", e);
      return null;
    }
  };

  const getCodeActions = async (
    serverId: string,
    uri: string,
    range: Range,
    diagnostics: Diagnostic[]
  ): Promise<CodeActionResult> => {
    return await invoke<CodeActionResult>("lsp_code_action", {
      serverId,
      params: { uri, range, diagnostics },
    });
  };

  const formatDocument = async (
    serverId: string,
    uri: string,
    tabSize: number,
    insertSpaces: boolean
  ): Promise<FormattingResult> => {
    return await invoke<FormattingResult>("lsp_format", {
      serverId,
      params: { uri, tab_size: tabSize, insert_spaces: insertSpaces },
    });
  };

  const formatRange = async (
    serverId: string,
    uri: string,
    range: Range,
    tabSize: number,
    insertSpaces: boolean
  ): Promise<FormattingResult> => {
    return await invoke<FormattingResult>("lsp_format_range", {
      serverId,
      params: { uri, range, tab_size: tabSize, insert_spaces: insertSpaces },
    });
  };

  const getInlayHints = async (
    serverId: string,
    uri: string,
    range: Range
  ): Promise<InlayHintsResult> => {
    try {
      const result = await invoke<{ hints: Array<{
        position: Position;
        label: string | Array<{ value: string; tooltip?: string; location?: Location; command?: Command }>;
        kind?: number;
        text_edits?: Array<{ range: Range; new_text: string }>;
        tooltip?: string;
        padding_left?: boolean;
        padding_right?: boolean;
      }> }>("lsp_inlay_hints", {
        serverId,
        params: { uri, range },
      });

      // Map backend snake_case to frontend camelCase and numeric kind to string
      const hints: InlayHint[] = result.hints.map((hint) => ({
        position: hint.position,
        label: typeof hint.label === "string" 
          ? hint.label 
          : hint.label.map((part) => ({
              value: part.value,
              tooltip: part.tooltip,
              location: part.location,
              command: part.command,
            })),
        kind: hint.kind === 1 ? "type" : hint.kind === 2 ? "parameter" : undefined,
        textEdits: hint.text_edits?.map((edit) => ({
          range: edit.range,
          newText: edit.new_text,
        })),
        tooltip: hint.tooltip,
        paddingLeft: hint.padding_left,
        paddingRight: hint.padding_right,
      }));

      return { hints };
    } catch (e) {
      console.debug("LSP inlay hints error:", e);
      return { hints: [] };
    }
  };

  const getDocumentHighlights = async (
    serverId: string,
    uri: string,
    position: Position
  ): Promise<DocumentHighlightsResult> => {
    try {
      const result = await invoke<Array<{
        range: Range;
        kind?: number;
      }>>("lsp_document_highlights", {
        serverId,
        uri,
        position,
      });

      // Map numeric kind to string kind
      // LSP spec: 1 = Text, 2 = Read, 3 = Write
      const mapHighlightKind = (kind?: number): DocumentHighlightKind | undefined => {
        switch (kind) {
          case 1: return "text";
          case 2: return "read";
          case 3: return "write";
          default: return undefined;
        }
      };

      const highlights: DocumentHighlight[] = result.map((h) => ({
        range: h.range,
        kind: mapHighlightKind(h.kind),
      }));

      return { highlights };
    } catch (e) {
      console.debug("LSP document highlights error:", e);
      return { highlights: [] };
    }
  };

  // Semantic Tokens Methods

  const getSemanticTokens = async (
    serverId: string,
    uri: string
  ): Promise<SemanticTokensResult | null> => {
    try {
      const result = await invoke<{
        result_id?: string;
        data: number[];
        legend?: { token_types: string[]; token_modifiers: string[] };
      } | null>("lsp_semantic_tokens_full", {
        serverId,
        params: { uri },
      });

      if (!result) return null;

      return {
        resultId: result.result_id,
        data: result.data,
        legend: result.legend ? {
          tokenTypes: result.legend.token_types,
          tokenModifiers: result.legend.token_modifiers,
        } : undefined,
      };
    } catch (e) {
      console.debug("LSP semantic tokens error:", e);
      return null;
    }
  };

  const getSemanticTokensRange = async (
    serverId: string,
    uri: string,
    range: Range
  ): Promise<SemanticTokensResult | null> => {
    try {
      const result = await invoke<{
        result_id?: string;
        data: number[];
        legend?: { token_types: string[]; token_modifiers: string[] };
      } | null>("lsp_semantic_tokens_range", {
        serverId,
        params: { uri, range },
      });

      if (!result) return null;

      return {
        resultId: result.result_id,
        data: result.data,
        legend: result.legend ? {
          tokenTypes: result.legend.token_types,
          tokenModifiers: result.legend.token_modifiers,
        } : undefined,
      };
    } catch (e) {
      console.debug("LSP semantic tokens range error:", e);
      return null;
    }
  };

  const getSemanticTokensLegend = async (
    serverId: string
  ): Promise<SemanticTokensLegend | null> => {
    try {
      const result = await invoke<{
        token_types: string[];
        token_modifiers: string[];
      } | null>("lsp_semantic_tokens_legend", {
        serverId,
      });

      if (!result) return null;

      return {
        tokenTypes: result.token_types,
        tokenModifiers: result.token_modifiers,
      };
    } catch (e) {
      console.debug("LSP semantic tokens legend error:", e);
      return null;
    }
  };

  // Code Lens Methods

  const getCodeLenses = async (
    serverId: string,
    uri: string
  ): Promise<CodeLensResult> => {
    try {
      const result = await invoke<{
        lenses: Array<{
          range: { start: Position; end: Position };
          command?: { title: string; command: string; arguments?: unknown[] };
          data?: unknown;
        }>;
      }>("lsp_code_lens", {
        serverId,
        params: { uri },
      });

      const lenses: CodeLens[] = result.lenses.map((lens) => ({
        range: lens.range,
        command: lens.command ? {
          title: lens.command.title,
          command: lens.command.command,
          arguments: lens.command.arguments,
        } : undefined,
        data: lens.data,
      }));

      return { lenses };
    } catch (e) {
      console.debug("LSP code lens error:", e);
      return { lenses: [] };
    }
  };

  const resolveCodeLens = async (
    serverId: string,
    codeLens: CodeLens
  ): Promise<CodeLens> => {
    try {
      const result = await invoke<{
        range: { start: Position; end: Position };
        command?: { title: string; command: string; arguments?: unknown[] };
        data?: unknown;
      }>("lsp_code_lens_resolve", {
        serverId,
        codeLens: {
          range: codeLens.range,
          command: codeLens.command ? {
            title: codeLens.command.title,
            command: codeLens.command.command,
            arguments: codeLens.command.arguments,
          } : undefined,
          data: codeLens.data,
        },
      });

      return {
        range: result.range,
        command: result.command ? {
          title: result.command.title,
          command: result.command.command,
          arguments: result.command.arguments,
        } : undefined,
        data: result.data,
      };
    } catch (e) {
      console.debug("LSP code lens resolve error:", e);
      return codeLens;
    }
  };

  const restartServer = async (serverId: string): Promise<ServerInfo> => {
    const info = await invoke<ServerInfo>("lsp_restart", { serverId });
    setState("servers", serverId, info);
    return info;
  };

  const getServerLogs = async (serverId: string): Promise<string[]> => {
    return await invoke<string[]>("lsp_get_logs", { serverId });
  };

  const getDiagnosticsForFile = (uri: string): Diagnostic[] => {
    return state.diagnostics[uri]?.diagnostics ?? [];
  };

  const getAllDiagnostics = (): DocumentDiagnostics[] => {
    return Object.values(state.diagnostics);
  };

  const clearDiagnostics = (uri: string): void => {
    setState("diagnostics", uri, undefined!);
  };

  // Language Status Methods

  const setLanguageStatus = (language: string, items: LanguageStatusItem[]): void => {
    setState("languageStatus", language, items);
  };

  const addLanguageStatusItem = (language: string, item: LanguageStatusItem): void => {
    const currentItems = state.languageStatus[language] ?? [];
    const existingIndex = currentItems.findIndex((i) => i.id === item.id);
    if (existingIndex >= 0) {
      const updatedItems = [...currentItems];
      updatedItems[existingIndex] = item;
      setState("languageStatus", language, updatedItems);
    } else {
      setState("languageStatus", language, [...currentItems, item]);
    }
  };

  const removeLanguageStatusItem = (language: string, itemId: string): void => {
    const currentItems = state.languageStatus[language];
    if (currentItems) {
      const filteredItems = currentItems.filter((i) => i.id !== itemId);
      if (filteredItems.length > 0) {
        setState("languageStatus", language, filteredItems);
      } else {
        setState("languageStatus", language, undefined!);
      }
    }
  };

  const getLanguageStatusItems = (language: string): LanguageStatusItem[] => {
    return state.languageStatus[language] ?? [];
  };

  const clearLanguageStatus = (language: string): void => {
    setState("languageStatus", language, undefined!);
  };

  // Workspace Symbols and Type Hierarchy helper
  const mapSymbolKind = (kind: number): SymbolKind => {
    const kindMap: Record<number, SymbolKind> = {
      1: "file", 2: "module", 3: "namespace", 4: "package", 5: "class",
      6: "method", 7: "property", 8: "field", 9: "constructor", 10: "enum",
      11: "interface", 12: "function", 13: "variable", 14: "constant", 15: "string",
      16: "number", 17: "boolean", 18: "array", 19: "object", 20: "key",
      21: "null", 22: "enumMember", 23: "struct", 24: "event", 25: "operator",
      26: "typeParameter",
    };
    return kindMap[kind] || "variable";
  };

  const symbolKindToNumber = (kind: SymbolKind): number => {
    const kindMap: Record<SymbolKind, number> = {
      file: 1, module: 2, namespace: 3, package: 4, class: 5,
      method: 6, property: 7, field: 8, constructor: 9, enum: 10,
      interface: 11, function: 12, variable: 13, constant: 14, string: 15,
      number: 16, boolean: 17, array: 18, object: 19, key: 20,
      null: 21, enumMember: 22, struct: 23, event: 24, operator: 25, typeParameter: 26,
    };
    return kindMap[kind] || 5;
  };

  // Type Hierarchy Methods
  const prepareTypeHierarchy = async (
    filePath: string,
    position: Position
  ): Promise<TypeHierarchyPrepareResult> => {
    try {
      const result = await invoke<Array<{
        name: string; kind: number; detail?: string; uri: string;
        range: Range; selection_range: Range; tags?: number[]; data?: unknown;
      }>>("lsp_prepare_type_hierarchy", { path: filePath, line: position.line, character: position.character });

      return { items: result.map((item) => ({
        name: item.name, kind: mapSymbolKind(item.kind), detail: item.detail, uri: item.uri,
        range: item.range, selectionRange: item.selection_range, tags: item.tags, data: item.data,
      })) };
    } catch (e) {
      console.debug("LSP prepareTypeHierarchy error:", e);
      return { items: [] };
    }
  };

  const getSupertypes = async (item: TypeHierarchyItem): Promise<SupertypesResult> => {
    try {
      const result = await invoke<Array<{
        name: string; kind: number; detail?: string; uri: string;
        range: Range; selection_range: Range; tags?: number[]; data?: unknown;
      }>>("lsp_type_hierarchy_supertypes", {
        item: {
          name: item.name, kind: symbolKindToNumber(item.kind), detail: item.detail, uri: item.uri,
          range: item.range, selection_range: item.selectionRange, tags: item.tags, data: item.data,
        },
      });
      return { items: result.map((r) => ({
        name: r.name, kind: mapSymbolKind(r.kind), detail: r.detail, uri: r.uri,
        range: r.range, selectionRange: r.selection_range, tags: r.tags, data: r.data,
      })) };
    } catch (e) {
      console.debug("LSP getSupertypes error:", e);
      return { items: [] };
    }
  };

  const getSubtypes = async (item: TypeHierarchyItem): Promise<SubtypesResult> => {
    try {
      const result = await invoke<Array<{
        name: string; kind: number; detail?: string; uri: string;
        range: Range; selection_range: Range; tags?: number[]; data?: unknown;
      }>>("lsp_type_hierarchy_subtypes", {
        item: {
          name: item.name, kind: symbolKindToNumber(item.kind), detail: item.detail, uri: item.uri,
          range: item.range, selection_range: item.selectionRange, tags: item.tags, data: item.data,
        },
      });
      return { items: result.map((r) => ({
        name: r.name, kind: mapSymbolKind(r.kind), detail: r.detail, uri: r.uri,
        range: r.range, selectionRange: r.selection_range, tags: r.tags, data: r.data,
      })) };
    } catch (e) {
      console.debug("LSP getSubtypes error:", e);
      return { items: [] };
    }
  };

  const getWorkspaceSymbols = async (projectPath: string, query: string): Promise<WorkspaceSymbolsResult> => {
    try {
      const result = await invoke<Array<{
        name: string;
        kind: number;
        container_name?: string;
        location: { uri: string; range: Range };
        tags?: number[];
      }>>("lsp_workspace_symbols", { path: projectPath, query });

      const symbols: WorkspaceSymbolInfo[] = (result || []).map((sym) => ({
        name: sym.name,
        kind: mapSymbolKind(sym.kind),
        containerName: sym.container_name,
        location: sym.location,
        tags: sym.tags,
      }));

      return { symbols };
    } catch (e) {
      console.debug("LSP workspace symbols error:", e);
      return { symbols: [] };
    }
  };

  // Folding Ranges
  const getFoldingRanges = async (serverId: string, uri: string): Promise<FoldingRange[]> => {
    try {
      const result = await invoke<Array<{
        start_line: number;
        start_character?: number;
        end_line: number;
        end_character?: number;
        kind?: string;
        collapsed_text?: string;
      }>>("lsp_folding_ranges", {
        serverId,
        params: { uri },
      });

      return result.map((r) => ({
        startLine: r.start_line,
        startCharacter: r.start_character,
        endLine: r.end_line,
        endCharacter: r.end_character,
        kind: r.kind as FoldingRangeKind | undefined,
        collapsedText: r.collapsed_text,
      }));
    } catch (e) {
      console.debug("LSP folding ranges error:", e);
      return [];
    }
  };

  // Selection Ranges
  const getSelectionRanges = async (
    serverId: string,
    uri: string,
    positions: Position[]
  ): Promise<SelectionRange[]> => {
    try {
      const result = await invoke<Array<{
        range: Range;
        parent?: unknown; // Recursive structure
      }>>("lsp_selection_ranges", {
        serverId,
        params: { uri, positions },
      });

      // Convert flat result to SelectionRange with recursive parent structure
      const convertToSelectionRange = (item: { range: Range; parent?: unknown }): SelectionRange => {
        const selRange: SelectionRange = { range: item.range };
        if (item.parent && typeof item.parent === "object" && "range" in item.parent) {
          selRange.parent = convertToSelectionRange(item.parent as { range: Range; parent?: unknown });
        }
        return selRange;
      };

      return result.map(convertToSelectionRange);
    } catch (e) {
      console.debug("LSP selection ranges error:", e);
      return [];
    }
  };

  // Evaluatable Expression (for debug hover)
  const getEvaluatableExpression = async (
    serverId: string,
    uri: string,
    position: Position
  ): Promise<EvaluatableExpression | null> => {
    try {
      const result = await invoke<{
        range: Range;
        expression?: string;
      } | null>("lsp_evaluatable_expression", {
        serverId,
        params: { uri, position },
      });

      if (!result) return null;

      return {
        range: result.range,
        expression: result.expression,
      };
    } catch (e) {
      // This is an optional LSP feature, so don't log errors
      console.debug("LSP evaluatable expression not supported or error:", e);
      return null;
    }
  };

  // Document Colors
  const getDocumentColors = async (
    serverId: string,
    uri: string
  ): Promise<ColorInformation[]> => {
    try {
      const result = await invoke<Array<{
        range: Range;
        color: { red: number; green: number; blue: number; alpha: number };
      }>>("lsp_document_colors", {
        serverId,
        params: { uri },
      });

      return result.map((item) => ({
        range: item.range,
        color: item.color,
      }));
    } catch (e) {
      console.debug("LSP document colors error:", e);
      return [];
    }
  };

  const getColorPresentations = async (
    serverId: string,
    uri: string,
    color: Color,
    range: Range
  ): Promise<ColorPresentation[]> => {
    try {
      const result = await invoke<Array<{
        label: string;
        text_edit?: { range: Range; new_text: string };
        additional_text_edits?: Array<{ range: Range; new_text: string }>;
      }>>("lsp_color_presentations", {
        serverId,
        params: {
          uri,
          color,
          range,
        },
      });

      return result.map((item) => ({
        label: item.label,
        textEdit: item.text_edit ? {
          range: item.text_edit.range,
          newText: item.text_edit.new_text,
        } : undefined,
        additionalTextEdits: item.additional_text_edits?.map((edit) => ({
          range: edit.range,
          newText: edit.new_text,
        })),
      }));
    } catch (e) {
      console.debug("LSP color presentations error:", e);
      return [];
    }
  };

  // Document Links
  const getDocumentLinks = async (
    serverId: string,
    uri: string
  ): Promise<DocumentLink[]> => {
    try {
      const result = await invoke<Array<{
        range: Range;
        target?: string;
        tooltip?: string;
        data?: unknown;
      }>>("lsp_document_links", {
        serverId,
        params: { uri },
      });

      return result.map((item) => ({
        range: item.range,
        target: item.target,
        tooltip: item.tooltip,
        data: item.data,
      }));
    } catch (e) {
      console.debug("LSP document links error:", e);
      return [];
    }
  };

  const resolveDocumentLink = async (
    serverId: string,
    link: DocumentLink
  ): Promise<DocumentLink> => {
    try {
      const result = await invoke<{
        range: Range;
        target?: string;
        tooltip?: string;
        data?: unknown;
      }>("lsp_document_link_resolve", {
        serverId,
        link: {
          range: link.range,
          target: link.target,
          tooltip: link.tooltip,
          data: link.data,
        },
      });

      return {
        range: result.range,
        target: result.target,
        tooltip: result.tooltip,
        data: result.data,
      };
    } catch (e) {
      console.debug("LSP document link resolve error:", e);
      return link;
    }
  };

  return (
    <LSPContext.Provider
      value={{
        state,
        lazyInit,
        startServer,
        stopServer,
        stopAllServers,
        restartServer,
        getServerForFile,
        getServerLogs,
        didOpen,
        didChange,
        didSave,
        didClose,
        getCompletions,
        resolveCompletionItem,
        getHover,
        getDefinition,
        getTypeDefinition,
        getImplementation,
        getDeclaration,
        getReferences,
        getSignatureHelp,
        rename,
        prepareRename,
        getCodeActions,
        formatDocument,
        formatRange,
        getInlayHints,
        getDocumentHighlights,
        prepareTypeHierarchy,
        getSupertypes,
        getSubtypes,
        getWorkspaceSymbols,
        getSemanticTokens,
        getSemanticTokensRange,
        getSemanticTokensLegend,
        getCodeLenses,
        resolveCodeLens,
        getFoldingRanges,
        getSelectionRanges,
        getEvaluatableExpression,
        getDocumentColors,
        getColorPresentations,
        getDocumentLinks,
        resolveDocumentLink,
        getDiagnosticsForFile,
        getAllDiagnostics,
        clearDiagnostics,
        setLanguageStatus,
        addLanguageStatusItem,
        removeLanguageStatusItem,
        getLanguageStatusItems,
        clearLanguageStatus,
      }}
    >
      {props.children}
    </LSPContext.Provider>
  );
}

export function useLSP() {
  const context = useContext(LSPContext);
  if (!context) {
    throw new Error("useLSP must be used within LSPProvider");
  }
  return context;
}

// Utility to get language ID from file extension
export function getLanguageId(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const config = LANGUAGE_CONFIGS[ext];
  return config?.languageId ?? "plaintext";
}

// Utility to get suggested language server config for a file
export function getLanguageServerConfig(
  filename: string,
  rootPath: string
): LanguageServerConfig | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;

  const config = LANGUAGE_CONFIGS[ext];
  if (!config) return null;

  return {
    id: `${config.name.toLowerCase()}-${rootPath.replace(/[^a-z0-9]/gi, "-")}`,
    ...config,
    rootPath,
  };
}

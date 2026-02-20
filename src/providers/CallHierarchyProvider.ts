/**
 * Monaco Call Hierarchy Provider
 *
 * Provides call hierarchy integration for Monaco editor using LSP.
 * Features:
 * - LSP-based call hierarchy (textDocument/prepareCallHierarchy)
 * - Incoming calls (callHierarchy/incomingCalls)
 * - Outgoing calls (callHierarchy/outgoingCalls)
 * - Used for "Show Call Hierarchy" and "Peek Call Hierarchy" commands
 */

import type * as Monaco from "monaco-editor";
import type { Position, Range, SymbolKind } from "@/context/LSPContext";

/**
 * Call Hierarchy Item from LSP
 */
export interface CallHierarchyItem {
  name: string;
  kind: SymbolKind;
  tags?: number[];
  detail?: string;
  uri: string;
  range: Range;
  selectionRange: Range;
  data?: unknown;
}

/**
 * Monaco-compatible Call Hierarchy Item (for runtime use)
 */
interface MonacoCallHierarchyItem {
  name: string;
  kind: number;
  tags?: number[];
  detail?: string;
  uri: Monaco.Uri;
  range: Monaco.IRange;
  selectionRange: Monaco.IRange;
  data?: unknown;
}

/**
 * Monaco-compatible Incoming Call
 */
interface MonacoCallHierarchyIncomingCall {
  from: MonacoCallHierarchyItem;
  fromRanges: Monaco.IRange[];
}

/**
 * Monaco-compatible Outgoing Call
 */
interface MonacoCallHierarchyOutgoingCall {
  to: MonacoCallHierarchyItem;
  fromRanges: Monaco.IRange[];
}

/**
 * Incoming Call from LSP
 */
export interface CallHierarchyIncomingCall {
  from: CallHierarchyItem;
  fromRanges: Range[];
}

/**
 * Outgoing Call from LSP
 */
export interface CallHierarchyOutgoingCall {
  to: CallHierarchyItem;
  fromRanges: Range[];
}

/**
 * Call Hierarchy Provider Options
 */
export interface CallHierarchyProviderOptions {
  monaco: typeof Monaco;
  languageId: string;
  serverId: string;
  filePath: string;
  prepareCallHierarchy: (
    serverId: string,
    uri: string,
    position: Position
  ) => Promise<CallHierarchyItem[] | null>;
  getIncomingCalls: (
    serverId: string,
    item: CallHierarchyItem
  ) => Promise<CallHierarchyIncomingCall[]>;
  getOutgoingCalls: (
    serverId: string,
    item: CallHierarchyItem
  ) => Promise<CallHierarchyOutgoingCall[]>;
  getCapabilities: () => { callHierarchyProvider: boolean };
}

/**
 * Call Hierarchy Provider Result
 */
export interface CallHierarchyProviderResult {
  provider: Monaco.IDisposable;
}

/**
 * Convert Monaco Position to LSP Position
 */
function toLSPPosition(position: Monaco.IPosition): Position {
  return {
    line: position.lineNumber - 1,
    character: position.column - 1,
  };
}

/**
 * Convert LSP Range to Monaco IRange
 */
function toMonacoRange(range: Range): Monaco.IRange {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

/**
 * Convert LSP SymbolKind to Monaco SymbolKind
 */
function toMonacoSymbolKind(kind: SymbolKind, monaco: typeof Monaco): Monaco.languages.SymbolKind {
  const kindMap: Record<string, Monaco.languages.SymbolKind> = {
    file: monaco.languages.SymbolKind.File,
    module: monaco.languages.SymbolKind.Module,
    namespace: monaco.languages.SymbolKind.Namespace,
    package: monaco.languages.SymbolKind.Package,
    class: monaco.languages.SymbolKind.Class,
    method: monaco.languages.SymbolKind.Method,
    property: monaco.languages.SymbolKind.Property,
    field: monaco.languages.SymbolKind.Field,
    constructor: monaco.languages.SymbolKind.Constructor,
    enum: monaco.languages.SymbolKind.Enum,
    interface: monaco.languages.SymbolKind.Interface,
    function: monaco.languages.SymbolKind.Function,
    variable: monaco.languages.SymbolKind.Variable,
    constant: monaco.languages.SymbolKind.Constant,
    string: monaco.languages.SymbolKind.String,
    number: monaco.languages.SymbolKind.Number,
    boolean: monaco.languages.SymbolKind.Boolean,
    array: monaco.languages.SymbolKind.Array,
    object: monaco.languages.SymbolKind.Object,
    key: monaco.languages.SymbolKind.Key,
    null: monaco.languages.SymbolKind.Null,
    enumMember: monaco.languages.SymbolKind.EnumMember,
    struct: monaco.languages.SymbolKind.Struct,
    event: monaco.languages.SymbolKind.Event,
    operator: monaco.languages.SymbolKind.Operator,
    typeParameter: monaco.languages.SymbolKind.TypeParameter,
  };
  return kindMap[kind] ?? monaco.languages.SymbolKind.Function;
}

/**
 * Convert LSP CallHierarchyItem to Monaco-compatible CallHierarchyItem
 */
function toMonacoCallHierarchyItem(
  item: CallHierarchyItem,
  monaco: typeof Monaco
): MonacoCallHierarchyItem {
  return {
    name: item.name,
    kind: toMonacoSymbolKind(item.kind, monaco),
    tags: item.tags,
    detail: item.detail,
    uri: monaco.Uri.parse(item.uri),
    range: toMonacoRange(item.range),
    selectionRange: toMonacoRange(item.selectionRange),
    data: item.data,
  };
}

/**
 * Convert Monaco CallHierarchyItem back to LSP format
 */
function toLSPCallHierarchyItem(
  item: MonacoCallHierarchyItem
): CallHierarchyItem {
  return {
    name: item.name,
    kind: item.kind as unknown as SymbolKind,
    tags: item.tags,
    detail: item.detail,
    uri: item.uri.toString(),
    range: {
      start: {
        line: item.range.startLineNumber - 1,
        character: item.range.startColumn - 1,
      },
      end: {
        line: item.range.endLineNumber - 1,
        character: item.range.endColumn - 1,
      },
    },
    selectionRange: {
      start: {
        line: item.selectionRange.startLineNumber - 1,
        character: item.selectionRange.startColumn - 1,
      },
      end: {
        line: item.selectionRange.endLineNumber - 1,
        character: item.selectionRange.endColumn - 1,
      },
    },
    data: item.data,
  };
}

/**
 * Create a Monaco call hierarchy provider for LSP integration
 */
export function createCallHierarchyProvider(
  options: CallHierarchyProviderOptions
): CallHierarchyProviderResult {
  const {
    monaco,
    languageId,
    serverId,
    filePath,
    prepareCallHierarchy,
    getIncomingCalls,
    getOutgoingCalls,
    getCapabilities,
  } = options;

  const provider = (monaco.languages as any).registerCallHierarchyProvider(languageId, {
    async prepareCallHierarchy(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _token: Monaco.CancellationToken
    ): Promise<MonacoCallHierarchyItem | MonacoCallHierarchyItem[] | null> {
      const modelUri = model.uri.toString();
      const fileUri = `file://${filePath.replace(/\\/g, "/")}`;
      if (!modelUri.includes(filePath.replace(/\\/g, "/")) && modelUri !== fileUri) {
        return null;
      }

      const capabilities = getCapabilities();
      if (!capabilities.callHierarchyProvider) {
        return null;
      }

      try {
        const lspPosition = toLSPPosition(position);
        const items = await prepareCallHierarchy(serverId, filePath, lspPosition);

        if (!items || items.length === 0) {
          return null;
        }

        const monacoItems = items.map((item) => toMonacoCallHierarchyItem(item, monaco));
        return monacoItems.length === 1 ? monacoItems[0] : monacoItems;
      } catch (e) {
        console.debug("LSP prepare call hierarchy error:", e);
        return null;
      }
    },

    async provideIncomingCalls(
      item: MonacoCallHierarchyItem,
      _token: Monaco.CancellationToken
    ): Promise<MonacoCallHierarchyIncomingCall[] | null> {
      const capabilities = getCapabilities();
      if (!capabilities.callHierarchyProvider) {
        return null;
      }

      try {
        const lspItem = toLSPCallHierarchyItem(item);
        const incomingCalls = await getIncomingCalls(serverId, lspItem);

        return incomingCalls.map((call) => ({
          from: toMonacoCallHierarchyItem(call.from, monaco),
          fromRanges: call.fromRanges.map((r) => toMonacoRange(r)),
        }));
      } catch (e) {
        console.debug("LSP incoming calls error:", e);
        return null;
      }
    },

    async provideOutgoingCalls(
      item: MonacoCallHierarchyItem,
      _token: Monaco.CancellationToken
    ): Promise<MonacoCallHierarchyOutgoingCall[] | null> {
      const capabilities = getCapabilities();
      if (!capabilities.callHierarchyProvider) {
        return null;
      }

      try {
        const lspItem = toLSPCallHierarchyItem(item);
        const outgoingCalls = await getOutgoingCalls(serverId, lspItem);

        return outgoingCalls.map((call) => ({
          to: toMonacoCallHierarchyItem(call.to, monaco),
          fromRanges: call.fromRanges.map((r) => toMonacoRange(r)),
        }));
      } catch (e) {
        console.debug("LSP outgoing calls error:", e);
        return null;
      }
    },
  });

  return {
    provider,
  };
}

/**
 * Languages that typically support call hierarchy
 */
export const CALL_HIERARCHY_LANGUAGES = [
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
  "rust",
  "go",
  "python",
  "java",
  "kotlin",
  "c",
  "cpp",
  "csharp",
] as const;

/**
 * Get symbol kind icon for call hierarchy display
 */
export function getCallHierarchyIcon(kind: SymbolKind): string {
  const iconMap: Record<string, string> = {
    file: "file",
    module: "module",
    namespace: "namespace",
    package: "package",
    class: "class",
    method: "method",
    property: "property",
    field: "field",
    constructor: "constructor",
    enum: "enum",
    interface: "interface",
    function: "function",
    variable: "variable",
    constant: "constant",
    string: "string",
    number: "number",
    boolean: "boolean",
    array: "array",
    object: "object",
    key: "key",
    null: "null",
    enumMember: "enum-member",
    struct: "struct",
    event: "event",
    operator: "operator",
    typeParameter: "type-parameter",
  };
  return iconMap[kind] ?? "symbol-method";
}

/**
 * Format call hierarchy item for display
 */
export function formatCallHierarchyItem(item: CallHierarchyItem): string {
  const detail = item.detail ? ` - ${item.detail}` : "";
  return `${item.name}${detail}`;
}

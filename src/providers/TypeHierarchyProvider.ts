/**
 * Monaco Type Hierarchy Provider
 *
 * Provides type hierarchy integration for Monaco editor using LSP.
 * Features:
 * - LSP-based type hierarchy (textDocument/prepareTypeHierarchy)
 * - Supertypes (typeHierarchy/supertypes)
 * - Subtypes (typeHierarchy/subtypes)
 * - Used for "Show Type Hierarchy" and exploring class inheritance
 */

import type * as Monaco from "monaco-editor";
import type { Position, Range, SymbolKind } from "@/context/LSPContext";

/**
 * Type Hierarchy Item from LSP
 */
export interface TypeHierarchyItem {
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
 * Monaco-compatible Type Hierarchy Item (for runtime use)
 */
interface MonacoTypeHierarchyItem {
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
 * Type Hierarchy Provider Options
 */
export interface TypeHierarchyProviderOptions {
  monaco: typeof Monaco;
  languageId: string;
  serverId: string;
  filePath: string;
  prepareTypeHierarchy: (
    serverId: string,
    uri: string,
    position: Position
  ) => Promise<TypeHierarchyItem[] | null>;
  getSupertypes: (
    serverId: string,
    item: TypeHierarchyItem
  ) => Promise<TypeHierarchyItem[]>;
  getSubtypes: (
    serverId: string,
    item: TypeHierarchyItem
  ) => Promise<TypeHierarchyItem[]>;
  getCapabilities: () => { typeHierarchyProvider: boolean };
}

/**
 * Type Hierarchy Provider Result
 */
export interface TypeHierarchyProviderResult {
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
  return kindMap[kind] ?? monaco.languages.SymbolKind.Class;
}

/**
 * Convert LSP TypeHierarchyItem to Monaco-compatible TypeHierarchyItem
 */
function toMonacoTypeHierarchyItem(
  item: TypeHierarchyItem,
  monaco: typeof Monaco
): MonacoTypeHierarchyItem {
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
 * Convert Monaco TypeHierarchyItem back to LSP format
 */
function toLSPTypeHierarchyItem(
  item: MonacoTypeHierarchyItem
): TypeHierarchyItem {
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
 * Create a Monaco type hierarchy provider for LSP integration
 */
export function createTypeHierarchyProvider(
  options: TypeHierarchyProviderOptions
): TypeHierarchyProviderResult {
  const {
    monaco,
    languageId,
    serverId,
    filePath,
    prepareTypeHierarchy,
    getSupertypes,
    getSubtypes,
    getCapabilities,
  } = options;

  const provider = (monaco.languages as any).registerTypeHierarchyProvider(languageId, {
    async prepareTypeHierarchy(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _token: Monaco.CancellationToken
    ): Promise<MonacoTypeHierarchyItem | MonacoTypeHierarchyItem[] | null> {
      const modelUri = model.uri.toString();
      const fileUri = `file://${filePath.replace(/\\/g, "/")}`;
      if (!modelUri.includes(filePath.replace(/\\/g, "/")) && modelUri !== fileUri) {
        return null;
      }

      const capabilities = getCapabilities();
      if (!capabilities.typeHierarchyProvider) {
        return null;
      }

      try {
        const lspPosition = toLSPPosition(position);
        const items = await prepareTypeHierarchy(serverId, filePath, lspPosition);

        if (!items || items.length === 0) {
          return null;
        }

        const monacoItems = items.map((item) => toMonacoTypeHierarchyItem(item, monaco));
        return monacoItems.length === 1 ? monacoItems[0] : monacoItems;
      } catch (e) {
        console.debug("LSP prepare type hierarchy error:", e);
        return null;
      }
    },

    async provideSupertypes(
      item: MonacoTypeHierarchyItem,
      _token: Monaco.CancellationToken
    ): Promise<MonacoTypeHierarchyItem[] | null> {
      const capabilities = getCapabilities();
      if (!capabilities.typeHierarchyProvider) {
        return null;
      }

      try {
        const lspItem = toLSPTypeHierarchyItem(item);
        const supertypes = await getSupertypes(serverId, lspItem);

        return supertypes.map((t) => toMonacoTypeHierarchyItem(t, monaco));
      } catch (e) {
        console.debug("LSP supertypes error:", e);
        return null;
      }
    },

    async provideSubtypes(
      item: MonacoTypeHierarchyItem,
      _token: Monaco.CancellationToken
    ): Promise<MonacoTypeHierarchyItem[] | null> {
      const capabilities = getCapabilities();
      if (!capabilities.typeHierarchyProvider) {
        return null;
      }

      try {
        const lspItem = toLSPTypeHierarchyItem(item);
        const subtypes = await getSubtypes(serverId, lspItem);

        return subtypes.map((t) => toMonacoTypeHierarchyItem(t, monaco));
      } catch (e) {
        console.debug("LSP subtypes error:", e);
        return null;
      }
    },
  });

  return {
    provider,
  };
}

/**
 * Languages that typically support type hierarchy
 */
export const TYPE_HIERARCHY_LANGUAGES = [
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
  "java",
  "kotlin",
  "csharp",
  "cpp",
  "python",
] as const;

/**
 * Get symbol kind icon for type hierarchy display
 */
export function getTypeHierarchyIcon(kind: SymbolKind): string {
  const iconMap: Record<string, string> = {
    class: "symbol-class",
    interface: "symbol-interface",
    enum: "symbol-enum",
    struct: "symbol-struct",
    typeParameter: "symbol-type-parameter",
  };
  return iconMap[kind] ?? "symbol-class";
}

/**
 * Format type hierarchy item for display
 */
export function formatTypeHierarchyItem(item: TypeHierarchyItem): string {
  const detail = item.detail ? ` - ${item.detail}` : "";
  return `${item.name}${detail}`;
}

/**
 * Type hierarchy direction for UI display
 */
export type TypeHierarchyDirection = "supertypes" | "subtypes";

/**
 * Get label for type hierarchy direction
 */
export function getTypeHierarchyDirectionLabel(direction: TypeHierarchyDirection): string {
  return direction === "supertypes" ? "Supertypes" : "Subtypes";
}

/**
 * Monaco Semantic Tokens Provider
 * 
 * This module provides integration between LSP semantic tokens and Monaco editor.
 * It transforms LSP semantic token data into Monaco's expected format and handles
 * the registration and lifecycle of semantic tokens providers.
 */

import type * as Monaco from "monaco-editor";
import type { Range, SemanticTokensLegend, SemanticTokensResult } from "@/context/LSPContext";

// ============================================================================
// LSP Standard Token Types and Modifiers
// ============================================================================

/**
 * Standard LSP semantic token types as defined in the LSP specification.
 * These map to Monaco's token types for syntax highlighting.
 */
export const LSP_TOKEN_TYPES = [
  "namespace",
  "type",
  "class",
  "enum",
  "interface",
  "struct",
  "typeParameter",
  "parameter",
  "variable",
  "property",
  "enumMember",
  "event",
  "function",
  "method",
  "macro",
  "keyword",
  "modifier",
  "comment",
  "string",
  "number",
  "regexp",
  "operator",
  "decorator",
] as const;

/**
 * Standard LSP semantic token modifiers.
 * These are applied as a bitmask to provide additional token context.
 */
export const LSP_TOKEN_MODIFIERS = [
  "declaration",
  "definition",
  "readonly",
  "static",
  "deprecated",
  "abstract",
  "async",
  "modification",
  "documentation",
  "defaultLibrary",
] as const;

// ============================================================================
// Monaco Token Type Mapping
// ============================================================================

/**
 * Maps LSP token types to Monaco token identifiers for theming.
 * Monaco uses these identifiers in theme rules.
 */
const MONACO_TOKEN_TYPE_MAP: Record<string, string> = {
  namespace: "namespace",
  type: "type",
  class: "class",
  enum: "enum",
  interface: "interface",
  struct: "struct",
  typeParameter: "typeParameter",
  parameter: "parameter",
  variable: "variable",
  property: "property",
  enumMember: "enumMember",
  event: "event",
  function: "function",
  method: "method",
  macro: "macro",
  keyword: "keyword",
  modifier: "modifier",
  comment: "comment",
  string: "string",
  number: "number",
  regexp: "regexp",
  operator: "operator",
  decorator: "decorator",
};

/**
 * Maps token modifiers to Monaco modifier suffixes.
 * These are appended to the token type with a dot separator.
 */
const MONACO_MODIFIER_MAP: Record<string, string> = {
  declaration: "declaration",
  definition: "definition",
  readonly: "readonly",
  static: "static",
  deprecated: "deprecated",
  abstract: "abstract",
  async: "async",
  modification: "modification",
  documentation: "documentation",
  defaultLibrary: "defaultLibrary",
};

// ============================================================================
// Token Decoding
// ============================================================================

/**
 * Decodes the LSP semantic tokens data array into individual token information.
 * 
 * LSP encodes tokens as a flat array where each token takes 5 integers:
 * - deltaLine: line delta from previous token (or 0 for first token on same line)
 * - deltaStart: column delta from previous token (or absolute position if new line)
 * - length: token length in characters
 * - tokenType: index into the legend's token types array
 * - tokenModifiers: bitmask of modifiers from the legend's token modifiers array
 * 
 * @param data - The encoded token data array from LSP
 * @returns Array of decoded token information
 */
export interface DecodedToken {
  line: number;
  startChar: number;
  length: number;
  tokenType: number;
  tokenModifiers: number;
}

export function decodeSemanticTokens(data: number[]): DecodedToken[] {
  const tokens: DecodedToken[] = [];
  let line = 0;
  let startChar = 0;

  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaStart = data[i + 1];
    const length = data[i + 2];
    const tokenType = data[i + 3];
    const tokenModifiers = data[i + 4];

    // Update position based on deltas
    if (deltaLine > 0) {
      line += deltaLine;
      startChar = deltaStart;
    } else {
      startChar += deltaStart;
    }

    tokens.push({
      line,
      startChar,
      length,
      tokenType,
      tokenModifiers,
    });
  }

  return tokens;
}

// ============================================================================
// Monaco Provider Types
// ============================================================================

/**
 * Configuration for semantic tokens provider.
 */
export interface SemanticTokensProviderConfig {
  /** Whether semantic highlighting is enabled */
  enabled: boolean;
  /** Whether to show semantic tokens for strings */
  showStrings: boolean;
  /** Whether to show semantic tokens for comments */
  showComments: boolean;
}

/**
 * Function type for fetching semantic tokens from LSP.
 */
export type SemanticTokensFetcher = (uri: string) => Promise<SemanticTokensResult | null>;

/**
 * Function type for fetching semantic tokens for a range.
 */
export type SemanticTokensRangeFetcher = (uri: string, range: Range) => Promise<SemanticTokensResult | null>;

/**
 * Function type for getting the semantic tokens legend.
 */
export type SemanticTokensLegendFetcher = () => Promise<SemanticTokensLegend | null>;

// ============================================================================
// Monaco Semantic Tokens Provider Implementation
// ============================================================================

/**
 * Creates a Monaco DocumentSemanticTokensProvider that integrates with LSP.
 * 
 * @param fetchTokens - Function to fetch full document semantic tokens
 * @param fetchLegend - Function to fetch the semantic tokens legend
 * @param config - Provider configuration
 * @returns Monaco DocumentSemanticTokensProvider
 */
export function createSemanticTokensProvider(
  fetchTokens: SemanticTokensFetcher,
  fetchLegend: SemanticTokensLegendFetcher,
  config: SemanticTokensProviderConfig
): Monaco.languages.DocumentSemanticTokensProvider {
  // Cache the legend to avoid repeated fetches
  let cachedLegend: SemanticTokensLegend | null = null;

  return {
    getLegend(): Monaco.languages.SemanticTokensLegend {
      // Return a default legend if we don't have one cached
      // Monaco requires synchronous legend, but we update it async
      return {
        tokenTypes: cachedLegend?.tokenTypes || [...LSP_TOKEN_TYPES],
        tokenModifiers: cachedLegend?.tokenModifiers || [...LSP_TOKEN_MODIFIERS],
      };
    },

    async provideDocumentSemanticTokens(
      model: Monaco.editor.ITextModel,
      _lastResultId: string | null,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.SemanticTokens | null> {
      if (!config.enabled) {
        return null;
      }

      const uri = model.uri.toString();

      try {
        // Fetch legend if not cached
        if (!cachedLegend) {
          cachedLegend = await fetchLegend();
        }

        // Fetch semantic tokens
        const result = await fetchTokens(uri);
        if (!result || !result.data || result.data.length === 0) {
          return null;
        }

        // Update cached legend if provided in result
        if (result.legend) {
          cachedLegend = result.legend;
        }

        // Decode and filter tokens
        const decodedTokens = decodeSemanticTokens(result.data);
        const legend = cachedLegend || { tokenTypes: [...LSP_TOKEN_TYPES], tokenModifiers: [...LSP_TOKEN_MODIFIERS] };

        // Filter tokens based on config
        const filteredTokens = decodedTokens.filter((token) => {
          const tokenTypeName = legend.tokenTypes[token.tokenType];
          if (!config.showStrings && tokenTypeName === "string") return false;
          if (!config.showComments && tokenTypeName === "comment") return false;
          return true;
        });

        // Re-encode tokens for Monaco
        const data = encodeTokensForMonaco(filteredTokens);

        return {
          data: new Uint32Array(data),
          resultId: result.resultId,
        };
      } catch (e) {
        console.debug("Semantic tokens provider error:", e);
        return null;
      }
    },

    releaseDocumentSemanticTokens(_resultId: string | undefined): void {
      // Nothing to release
    },
  };
}

/**
 * Creates a Monaco DocumentRangeSemanticTokensProvider that integrates with LSP.
 * 
 * @param fetchTokensRange - Function to fetch semantic tokens for a range
 * @param fetchLegend - Function to fetch the semantic tokens legend
 * @param config - Provider configuration
 * @returns Monaco DocumentRangeSemanticTokensProvider
 */
export function createSemanticTokensRangeProvider(
  fetchTokensRange: SemanticTokensRangeFetcher,
  fetchLegend: SemanticTokensLegendFetcher,
  config: SemanticTokensProviderConfig
): Monaco.languages.DocumentRangeSemanticTokensProvider {
  let cachedLegend: SemanticTokensLegend | null = null;

  return {
    getLegend(): Monaco.languages.SemanticTokensLegend {
      return {
        tokenTypes: cachedLegend?.tokenTypes || [...LSP_TOKEN_TYPES],
        tokenModifiers: cachedLegend?.tokenModifiers || [...LSP_TOKEN_MODIFIERS],
      };
    },

    async provideDocumentRangeSemanticTokens(
      model: Monaco.editor.ITextModel,
      range: Monaco.Range,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.SemanticTokens | null> {
      if (!config.enabled) {
        return null;
      }

      const uri = model.uri.toString();
      const lspRange: Range = {
        start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
        end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
      };

      try {
        if (!cachedLegend) {
          cachedLegend = await fetchLegend();
        }

        const result = await fetchTokensRange(uri, lspRange);
        if (!result || !result.data || result.data.length === 0) {
          return null;
        }

        if (result.legend) {
          cachedLegend = result.legend;
        }

        const decodedTokens = decodeSemanticTokens(result.data);
        const legend = cachedLegend || { tokenTypes: [...LSP_TOKEN_TYPES], tokenModifiers: [...LSP_TOKEN_MODIFIERS] };

        const filteredTokens = decodedTokens.filter((token) => {
          const tokenTypeName = legend.tokenTypes[token.tokenType];
          if (!config.showStrings && tokenTypeName === "string") return false;
          if (!config.showComments && tokenTypeName === "comment") return false;
          return true;
        });

        const data = encodeTokensForMonaco(filteredTokens);

        return {
          data: new Uint32Array(data),
          resultId: result.resultId,
        };
      } catch (e) {
        console.debug("Semantic tokens range provider error:", e);
        return null;
      }
    },
  };
}

/**
 * Re-encodes decoded tokens back into Monaco's expected format.
 * Monaco expects the same 5-integer encoding as LSP.
 */
function encodeTokensForMonaco(tokens: DecodedToken[]): number[] {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;

  for (const token of tokens) {
    const deltaLine = token.line - prevLine;
    const deltaStart = deltaLine === 0 ? token.startChar - prevChar : token.startChar;

    data.push(deltaLine, deltaStart, token.length, token.tokenType, token.tokenModifiers);

    prevLine = token.line;
    prevChar = token.startChar;
  }

  return data;
}

// ============================================================================
// Theme Color Mappings
// ============================================================================

/**
 * Returns Monaco editor token color rules for semantic highlighting.
 * These should be added to the editor theme definition.
 */
export function getSemanticTokenColorRules(): Monaco.editor.ITokenThemeRule[] {
  return [
    // Types and classes
    { token: "type", foreground: "6366F1", fontStyle: "italic" },
    { token: "class", foreground: "6366F1", fontStyle: "italic" },
    { token: "interface", foreground: "6366F1", fontStyle: "italic" },
    { token: "struct", foreground: "6366F1", fontStyle: "italic" },
    { token: "enum", foreground: "6366F1", fontStyle: "italic" },
    { token: "typeParameter", foreground: "6366F1", fontStyle: "italic" },
    
    // Variables and properties
    { token: "variable", foreground: "FAFAFA" },
    { token: "variable.readonly", foreground: "6366F1" },
    { token: "variable.defaultLibrary", foreground: "6366F1" },
    { token: "property", foreground: "FAFAFA" },
    { token: "property.readonly", foreground: "6366F1" },
    
    // Parameters
    { token: "parameter", foreground: "FAFAFA", fontStyle: "italic" },
    
    // Functions and methods
    { token: "function", foreground: "D4D4D8" },
    { token: "function.declaration", foreground: "D4D4D8", fontStyle: "bold" },
    { token: "method", foreground: "D4D4D8" },
    { token: "method.declaration", foreground: "D4D4D8", fontStyle: "bold" },
    
    // Namespaces and modules
    { token: "namespace", foreground: "6366F1" },
    
    // Enum members and constants
    { token: "enumMember", foreground: "6366F1" },
    
    // Decorators and macros
    { token: "decorator", foreground: "F97316" },
    { token: "macro", foreground: "F97316" },
    
    // Modifiers applied to all tokens
    { token: "*.deprecated", fontStyle: "strikethrough" },
    { token: "*.abstract", fontStyle: "italic" },
    { token: "*.async", fontStyle: "italic" },
    { token: "*.static", fontStyle: "bold" },
  ];
}

/**
 * Semantic token style definition
 */
export interface SemanticTokenStyle {
  foreground?: string;
  fontStyle?: string;
}

/**
 * Returns Monaco editor semantic token styles for the color customization.
 * These can be used to customize semantic highlighting colors.
 */
export function getSemanticTokenStyles(): Record<string, SemanticTokenStyle> {
  return {
    // Semantic token rules that can be customized
    "*.deprecated": { fontStyle: "strikethrough" },
    "*.readonly": { foreground: "#6366F1" },
    "*.declaration": { fontStyle: "bold" },
    "parameter": { foreground: "#FAFAFA", fontStyle: "italic" },
    "variable.readonly.defaultLibrary": { foreground: "#6366F1" },
    "type": { foreground: "#6366F1", fontStyle: "italic" },
    "class": { foreground: "#6366F1", fontStyle: "italic" },
    "interface": { foreground: "#6366F1", fontStyle: "italic" },
    "enum": { foreground: "#6366F1" },
    "enumMember": { foreground: "#6366F1" },
    "function": { foreground: "#D4D4D8" },
    "method": { foreground: "#D4D4D8" },
    "namespace": { foreground: "#6366F1" },
    "property": { foreground: "#FAFAFA" },
    "variable": { foreground: "#FAFAFA" },
    "decorator": { foreground: "#F97316" },
    "macro": { foreground: "#F97316" },
  };
}

// ============================================================================
// Registration Helper
// ============================================================================

/**
 * Registers semantic tokens providers for a specific language with Monaco.
 * Returns a disposable that can be used to unregister the providers.
 */
export function registerSemanticTokensProviders(
  monaco: typeof Monaco,
  languageId: string,
  fetchTokens: SemanticTokensFetcher,
  fetchTokensRange: SemanticTokensRangeFetcher | null,
  fetchLegend: SemanticTokensLegendFetcher,
  config: SemanticTokensProviderConfig
): Monaco.IDisposable[] {
  const disposables: Monaco.IDisposable[] = [];

  // Register full document provider
  const fullProvider = createSemanticTokensProvider(fetchTokens, fetchLegend, config);
  disposables.push(
    monaco.languages.registerDocumentSemanticTokensProvider(languageId, fullProvider)
  );

  // Optionally register range provider
  if (fetchTokensRange) {
    const rangeProvider = createSemanticTokensRangeProvider(fetchTokensRange, fetchLegend, config);
    disposables.push(
      monaco.languages.registerDocumentRangeSemanticTokensProvider(languageId, rangeProvider)
    );
  }

  return disposables;
}

// ============================================================================
// Customization Integration
// ============================================================================

/**
 * Interface for semantic token rule from customization context
 */
export interface CustomSemanticTokenRule {
  foreground?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

/**
 * Converts a semantic token rule to Monaco format
 */
export function semanticRuleToMonaco(
  selector: string,
  rule: string | CustomSemanticTokenRule
): Monaco.editor.ITokenThemeRule {
  if (typeof rule === "string") {
    return {
      token: selector,
      foreground: rule.replace("#", ""),
    };
  }

  const monacoRule: Monaco.editor.ITokenThemeRule = {
    token: selector,
  };

  if (rule.foreground) {
    monacoRule.foreground = rule.foreground.replace("#", "");
  }
  if (rule.background) {
    monacoRule.background = rule.background.replace("#", "");
  }

  const fontStyles: string[] = [];
  if (rule.italic) fontStyles.push("italic");
  if (rule.bold) fontStyles.push("bold");
  if (rule.underline) fontStyles.push("underline");
  if (rule.strikethrough) fontStyles.push("strikethrough");
  
  if (fontStyles.length > 0) {
    monacoRule.fontStyle = fontStyles.join(" ");
  }

  return monacoRule;
}

/**
 * Merges custom semantic token rules with default rules.
 * Custom rules take precedence over defaults.
 */
export function mergeSemanticTokenRules(
  defaultRules: Monaco.editor.ITokenThemeRule[],
  customRules: Record<string, string | CustomSemanticTokenRule>
): Monaco.editor.ITokenThemeRule[] {
  const ruleMap = new Map<string, Monaco.editor.ITokenThemeRule>();

  // Add default rules
  for (const rule of defaultRules) {
    ruleMap.set(rule.token, rule);
  }

  // Override with custom rules
  for (const [selector, value] of Object.entries(customRules)) {
    const monacoRule = semanticRuleToMonaco(selector, value);
    ruleMap.set(selector, monacoRule);
  }

  return Array.from(ruleMap.values());
}

/**
 * Creates a function that returns semantic token color rules with customizations applied.
 */
export function createCustomizedSemanticTokenColorRules(
  customRules: Record<string, string | CustomSemanticTokenRule>
): Monaco.editor.ITokenThemeRule[] {
  const defaultRules = getSemanticTokenColorRules();
  return mergeSemanticTokenRules(defaultRules, customRules);
}

// ============================================================================
// Exports
// ============================================================================

export {
  MONACO_TOKEN_TYPE_MAP,
  MONACO_MODIFIER_MAP,
};

/**
 * EditorTypes - Centralized TypeScript interfaces and types for the CodeEditor module
 *
 * This file contains all type definitions extracted from CodeEditor.tsx to enable
 * better code organization and reusability across editor-related components.
 */

import type * as Monaco from "monaco-editor";

// ============================================================================
// Performance Utilities Types
// ============================================================================

export interface WindowWithIdleCallback {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number;
}

// ============================================================================
// Inlay Hints Types (LSP Specification)
// ============================================================================

export interface InlayHintLabelPart {
  value: string;
  tooltip?: string;
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
}

export interface LSPInlayHint {
  position: { line: number; character: number };
  label: string | InlayHintLabelPart[];
  kind?: 1 | 2;
  tooltip?: string;
  paddingLeft?: boolean;
  paddingRight?: boolean;
  textEdits?: Array<{
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    newText: string;
  }>;
  data?: unknown;
}

export interface LSPInlayHintsResponse {
  hints: LSPInlayHint[];
}

// ============================================================================
// Format on Type Types (LSP Specification)
// ============================================================================

export interface LSPTextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

export interface LSPOnTypeFormattingResponse {
  edits: LSPTextEdit[] | null;
}

// ============================================================================
// Selection Range Types (LSP Specification)
// ============================================================================

export interface LSPSelectionRange {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  parent?: LSPSelectionRange;
}

export interface LSPSelectionRangeResponse {
  ranges: LSPSelectionRange[] | null;
}

// ============================================================================
// CodeLens Types (LSP Specification)
// ============================================================================

export interface LSPCodeLens {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
  data?: unknown;
}

export interface LSPCodeLensResult {
  lenses: LSPCodeLens[];
}

// ============================================================================
// Semantic Tokens Types (LSP Specification)
// ============================================================================

export interface LSPSemanticTokensResult {
  data: number[];
  resultId?: string;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface FormatOnTypeSettings {
  enabled: boolean;
  triggerCharacters: string[];
}

export interface InlayHintSettings {
  enabled: "on" | "off" | "onUnlessPressed" | "offUnlessPressed";
  fontSize: number;
  fontFamily: string;
  showParameterNames: boolean;
  showTypeHints: boolean;
  showReturnTypes: boolean;
}

export interface UnicodeHighlightSettings {
  enabled: boolean;
  invisibleCharacters: boolean;
  ambiguousCharacters: boolean;
  nonBasicASCII: boolean;
  includeComments: boolean | "inUntrustedWorkspace";
  includeStrings: boolean | "inUntrustedWorkspace";
  allowedCharacters: Record<string, boolean>;
  allowedLocales: Record<string, boolean>;
}

export interface CodeLensSettings {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  showReferences: boolean;
  showImplementations: boolean;
  showTestActions: boolean;
}

// ============================================================================
// Debug Hover Types
// ============================================================================

export interface DebugEvaluateResult {
  result: string;
  type?: string;
  variablesReference: number;
}

export interface DebugVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
}

export interface DebugHoverState {
  isPaused: boolean;
  activeSessionId: string | null;
  evaluate: (expression: string, context?: string) => Promise<DebugEvaluateResult>;
  expandVariable: (variablesReference: number) => Promise<DebugVariable[]>;
  addWatchExpression: (expression: string) => void;
}

// ============================================================================
// Unicode Character Types
// ============================================================================

export type UnicodeCategory = "invisible" | "homoglyph" | "bidirectional" | "nonBasicASCII" | "unknown";

export interface UnicodeCharacterInfo {
  codePoint: string;
  name: string;
  category: UnicodeCategory;
  replacement?: string;
}

// ============================================================================
// Coverage Types
// ============================================================================

export type CoverageStatus = "covered" | "uncovered" | "partial";

export interface CoverageColors {
  covered: string;
  uncovered: string;
  partial: string;
}

export interface CoverageGlyphClasses {
  covered: string;
  uncovered: string;
  partial: string;
}

// ============================================================================
// Editor Props
// ============================================================================

export interface CodeEditorProps {
  file?: {
    id: string;
    path: string;
    name: string;
    content: string;
    language: string;
    modified: boolean;
  };
  groupId?: string;
}

// ============================================================================
// Provider Registration State
// ============================================================================

export interface ProviderDisposables {
  inlayHints: Monaco.IDisposable | null;
  onTypeFormatting: Monaco.IDisposable | null;
  codeLens: Monaco.IDisposable[];
  semanticTokens: Monaco.IDisposable[];
  linkedEditing: Monaco.IDisposable[];
  debugHover: Monaco.IDisposable | null;
  unicodeHover: Monaco.IDisposable | null;
  unicodeCodeAction: Monaco.IDisposable | null;
  formatOnPaste: Monaco.IDisposable | null;
}

// ============================================================================
// Language Map
// ============================================================================

export const LANGUAGE_MAP: Record<string, string> = {
  typescript: "typescript",
  javascript: "javascript",
  rust: "rust",
  python: "python",
  go: "go",
  json: "json",
  html: "html",
  css: "css",
  yaml: "yaml",
  toml: "ini",
  markdown: "markdown",
  sql: "sql",
  shell: "shell",
  dockerfile: "dockerfile",
  plaintext: "plaintext",
};

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_FORMAT_ON_TYPE_SETTINGS: FormatOnTypeSettings = {
  enabled: false,
  triggerCharacters: [";", "}", "\n"],
};

export const DEFAULT_INLAY_HINT_SETTINGS: InlayHintSettings = {
  enabled: "on",
  fontSize: 12,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, monospace",
  showParameterNames: true,
  showTypeHints: true,
  showReturnTypes: true,
};

export const DEFAULT_UNICODE_HIGHLIGHT_SETTINGS: UnicodeHighlightSettings = {
  enabled: true,
  invisibleCharacters: true,
  ambiguousCharacters: true,
  nonBasicASCII: false,
  includeComments: "inUntrustedWorkspace",
  includeStrings: true,
  allowedCharacters: {},
  allowedLocales: { _os: true, _vscode: true },
};

export const COVERAGE_COLORS: CoverageColors = {
  covered: "var(--cortex-syntax-function)",
  uncovered: "var(--cortex-error)",
  partial: "var(--cortex-warning)",
};

export const COVERAGE_GLYPH_CLASSES: CoverageGlyphClasses = {
  covered: "coverage-glyph-covered",
  uncovered: "coverage-glyph-uncovered",
  partial: "coverage-glyph-partial",
};

// ============================================================================
// Semantic Tokens Constants
// ============================================================================

export const SEMANTIC_TOKEN_TYPES = [
  "namespace", "type", "class", "enum", "interface", "struct",
  "typeParameter", "parameter", "variable", "property", "enumMember",
  "event", "function", "method", "macro", "keyword", "modifier",
  "comment", "string", "number", "regexp", "operator", "decorator"
] as const;

export const SEMANTIC_TOKEN_MODIFIERS = [
  "declaration", "definition", "readonly", "static", "deprecated",
  "abstract", "async", "modification", "documentation", "defaultLibrary"
] as const;

// ============================================================================
// Test Patterns for CodeLens
// ============================================================================

export const TEST_PATTERNS = {
  jest: /^(?:export\s+)?(?:async\s+)?(?:function\s+)?(?:it|test|describe)\s*\(/,
  vitest: /^(?:export\s+)?(?:async\s+)?(?:function\s+)?(?:it|test|describe|suite)\s*\(/,
  rust: /^#\[test\]|^#\[tokio::test\]/,
  pytest: /^(?:async\s+)?def\s+test_/,
  go: /^func\s+Test[A-Z]/,
} as const;

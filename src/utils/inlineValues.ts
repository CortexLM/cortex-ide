/**
 * Inline Values for Debug in Cortex IDE
 * Shows variable values inline in the editor during debugging
 */

import type * as monaco from 'monaco-editor';

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Inline value displayed in editor
 */
export interface InlineValue {
  range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  text: string;
  type: 'variable' | 'expression' | 'text';
  variableName?: string;
}

/**
 * Inline value context from debug adapter
 */
export interface InlineValueContext {
  frameId: number;
  stoppedLocation: { startLine: number; startColumn: number; endLine: number; endColumn: number };
}

/**
 * Document interface for inline values provider
 */
export interface InlineValuesDocument {
  uri: string;
  getText(): string;
  lineAt(line: number): { text: string };
}

/**
 * View range for inline values
 */
export interface ViewRange {
  startLine: number;
  endLine: number;
}

/**
 * Inline values provider (language-aware)
 */
export interface InlineValuesProvider {
  provideInlineValues(
    document: InlineValuesDocument,
    viewRange: ViewRange,
    context: InlineValueContext
  ): Promise<InlineValue[]>;
}

/**
 * Variable with position information
 */
export interface VariableInfo {
  name: string;
  range: { startColumn: number; endColumn: number };
}

/**
 * Evaluatable expression at position (for debug adapter)
 */
export interface EvaluatableExpression {
  expression: string;
  range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
}

// =============================================================================
// LANGUAGE PATTERNS
// =============================================================================

/**
 * Variable name patterns per language
 */
const VARIABLE_PATTERNS: Record<string, RegExp> = {
  javascript: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g,
  typescript: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g,
  javascriptreact: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g,
  typescriptreact: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g,
  python: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
  rust: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
  go: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
  java: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g,
  cpp: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
  c: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
  csharp: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
  ruby: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
  php: /\$([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
  swift: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
  kotlin: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
  lua: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
};

/**
 * Keywords to exclude from inline values per language
 */
const KEYWORDS: Record<string, Set<string>> = {
  javascript: new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'return', 'function', 'class', 'const', 'let', 'var', 'new', 'this', 'typeof',
    'instanceof', 'true', 'false', 'null', 'undefined', 'try', 'catch', 'finally',
    'throw', 'async', 'await', 'import', 'export', 'default', 'from', 'of', 'in',
    'delete', 'void', 'yield', 'with', 'debugger', 'extends', 'super', 'get', 'set'
  ]),
  typescript: new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'return', 'function', 'class', 'const', 'let', 'var', 'new', 'this', 'typeof',
    'instanceof', 'true', 'false', 'null', 'undefined', 'try', 'catch', 'finally',
    'throw', 'async', 'await', 'import', 'export', 'default', 'from', 'of', 'in',
    'interface', 'type', 'enum', 'implements', 'extends', 'public', 'private',
    'protected', 'readonly', 'abstract', 'static', 'namespace', 'module', 'declare',
    'keyof', 'infer', 'never', 'any', 'unknown', 'void', 'as', 'is', 'asserts',
    'super', 'get', 'set', 'require'
  ]),
  javascriptreact: new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'return', 'function', 'class', 'const', 'let', 'var', 'new', 'this', 'typeof',
    'instanceof', 'true', 'false', 'null', 'undefined', 'try', 'catch', 'finally',
    'throw', 'async', 'await', 'import', 'export', 'default', 'from', 'of', 'in',
    'delete', 'void', 'yield', 'with', 'debugger', 'extends', 'super', 'get', 'set'
  ]),
  typescriptreact: new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'return', 'function', 'class', 'const', 'let', 'var', 'new', 'this', 'typeof',
    'instanceof', 'true', 'false', 'null', 'undefined', 'try', 'catch', 'finally',
    'throw', 'async', 'await', 'import', 'export', 'default', 'from', 'of', 'in',
    'interface', 'type', 'enum', 'implements', 'extends', 'public', 'private',
    'protected', 'readonly', 'abstract', 'static', 'namespace', 'module', 'declare',
    'keyof', 'infer', 'never', 'any', 'unknown', 'void', 'as', 'is', 'asserts',
    'super', 'get', 'set', 'require'
  ]),
  python: new Set([
    'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as',
    'def', 'class', 'return', 'yield', 'import', 'from', 'and', 'or', 'not', 'in',
    'is', 'True', 'False', 'None', 'lambda', 'pass', 'break', 'continue', 'raise',
    'global', 'nonlocal', 'async', 'await', 'assert', 'del', 'print', 'self', 'cls'
  ]),
  rust: new Set([
    'fn', 'let', 'mut', 'const', 'if', 'else', 'match', 'for', 'while', 'loop',
    'break', 'continue', 'return', 'struct', 'enum', 'impl', 'trait', 'pub', 'use',
    'mod', 'self', 'super', 'crate', 'true', 'false', 'as', 'in', 'ref', 'move',
    'async', 'await', 'dyn', 'where', 'type', 'unsafe', 'extern', 'static', 'box',
    'macro', 'yield', 'try', 'abstract', 'become', 'do', 'final', 'override', 'priv',
    'virtual', 'typeof', 'unsized', 'Self', 'str', 'i8', 'i16', 'i32', 'i64', 'i128',
    'u8', 'u16', 'u32', 'u64', 'u128', 'f32', 'f64', 'bool', 'char', 'usize', 'isize'
  ]),
  go: new Set([
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
    'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map',
    'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var',
    'true', 'false', 'nil', 'iota', 'append', 'cap', 'close', 'complex', 'copy',
    'delete', 'imag', 'len', 'make', 'new', 'panic', 'print', 'println', 'real',
    'recover', 'int', 'int8', 'int16', 'int32', 'int64', 'uint', 'uint8', 'uint16',
    'uint32', 'uint64', 'float32', 'float64', 'complex64', 'complex128', 'byte',
    'rune', 'string', 'bool', 'error'
  ]),
  java: new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
    'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
    'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
    'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package',
    'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
    'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient',
    'try', 'void', 'volatile', 'while', 'true', 'false', 'null', 'var', 'record',
    'sealed', 'permits', 'non', 'yield'
  ]),
  cpp: new Set([
    'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor',
    'bool', 'break', 'case', 'catch', 'char', 'char8_t', 'char16_t', 'char32_t',
    'class', 'compl', 'concept', 'const', 'consteval', 'constexpr', 'constinit',
    'const_cast', 'continue', 'co_await', 'co_return', 'co_yield', 'decltype',
    'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit',
    'export', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline',
    'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq',
    'nullptr', 'operator', 'or', 'or_eq', 'private', 'protected', 'public',
    'register', 'reinterpret_cast', 'requires', 'return', 'short', 'signed',
    'sizeof', 'static', 'static_assert', 'static_cast', 'struct', 'switch',
    'template', 'this', 'thread_local', 'throw', 'true', 'try', 'typedef', 'typeid',
    'typename', 'union', 'unsigned', 'using', 'virtual', 'void', 'volatile',
    'wchar_t', 'while', 'xor', 'xor_eq', 'override', 'final'
  ]),
  c: new Set([
    'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double',
    'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long',
    'register', 'restrict', 'return', 'short', 'signed', 'sizeof', 'static',
    'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
    '_Alignas', '_Alignof', '_Atomic', '_Bool', '_Complex', '_Generic', '_Imaginary',
    '_Noreturn', '_Static_assert', '_Thread_local', 'NULL', 'true', 'false'
  ]),
  csharp: new Set([
    'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char',
    'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
    'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false',
    'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit',
    'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace',
    'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private',
    'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
    'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw',
    'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort',
    'using', 'virtual', 'void', 'volatile', 'while', 'var', 'dynamic', 'async',
    'await', 'nameof', 'when', 'where', 'yield', 'record', 'init', 'with'
  ]),
  ruby: new Set([
    'BEGIN', 'END', 'alias', 'and', 'begin', 'break', 'case', 'class', 'def',
    'defined?', 'do', 'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if',
    'in', 'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry',
    'return', 'self', 'super', 'then', 'true', 'undef', 'unless', 'until', 'when',
    'while', 'yield', '__ENCODING__', '__FILE__', '__LINE__', 'attr_accessor',
    'attr_reader', 'attr_writer', 'private', 'protected', 'public', 'require',
    'require_relative', 'include', 'extend', 'prepend', 'raise', 'lambda', 'proc'
  ]),
  php: new Set([
    'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch',
    'class', 'clone', 'const', 'continue', 'declare', 'default', 'die', 'do',
    'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach',
    'endif', 'endswitch', 'endwhile', 'eval', 'exit', 'extends', 'false', 'final',
    'finally', 'fn', 'for', 'foreach', 'function', 'global', 'goto', 'if',
    'implements', 'include', 'include_once', 'instanceof', 'insteadof', 'interface',
    'isset', 'list', 'match', 'namespace', 'new', 'null', 'or', 'print', 'private',
    'protected', 'public', 'readonly', 'require', 'require_once', 'return',
    'static', 'switch', 'throw', 'trait', 'true', 'try', 'unset', 'use', 'var',
    'while', 'xor', 'yield', 'yield from', 'self', 'parent', '__CLASS__',
    '__DIR__', '__FILE__', '__FUNCTION__', '__LINE__', '__METHOD__', '__NAMESPACE__',
    '__TRAIT__'
  ]),
  swift: new Set([
    'associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate',
    'func', 'import', 'init', 'inout', 'internal', 'let', 'open', 'operator',
    'private', 'protocol', 'public', 'rethrows', 'static', 'struct', 'subscript',
    'typealias', 'var', 'break', 'case', 'continue', 'default', 'defer', 'do',
    'else', 'fallthrough', 'for', 'guard', 'if', 'in', 'repeat', 'return',
    'switch', 'where', 'while', 'as', 'Any', 'catch', 'false', 'is', 'nil',
    'super', 'self', 'Self', 'throw', 'throws', 'true', 'try', 'async', 'await',
    'actor', 'isolated', 'nonisolated', 'some', 'any'
  ]),
  kotlin: new Set([
    'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun',
    'if', 'in', 'interface', 'is', 'null', 'object', 'package', 'return', 'super',
    'this', 'throw', 'true', 'try', 'typealias', 'typeof', 'val', 'var', 'when',
    'while', 'by', 'catch', 'constructor', 'delegate', 'dynamic', 'field', 'file',
    'finally', 'get', 'import', 'init', 'param', 'property', 'receiver', 'set',
    'setparam', 'where', 'actual', 'abstract', 'annotation', 'companion', 'const',
    'crossinline', 'data', 'enum', 'expect', 'external', 'final', 'infix', 'inline',
    'inner', 'internal', 'lateinit', 'noinline', 'open', 'operator', 'out',
    'override', 'private', 'protected', 'public', 'reified', 'sealed', 'suspend',
    'tailrec', 'vararg', 'it'
  ]),
  lua: new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
    'true', 'until', 'while', 'self'
  ]),
};

// =============================================================================
// DEFAULT PATTERNS FOR UNKNOWN LANGUAGES
// =============================================================================

const DEFAULT_VARIABLE_PATTERN = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
const DEFAULT_KEYWORDS = new Set<string>([
  'if', 'else', 'for', 'while', 'do', 'return', 'break', 'continue',
  'true', 'false', 'null', 'undefined', 'nil', 'none', 'void'
]);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the variable pattern for a language
 */
function getVariablePattern(languageId: string): RegExp {
  const pattern = VARIABLE_PATTERNS[languageId.toLowerCase()];
  if (pattern) {
    // Return a new instance to reset lastIndex
    return new RegExp(pattern.source, pattern.flags);
  }
  return new RegExp(DEFAULT_VARIABLE_PATTERN.source, DEFAULT_VARIABLE_PATTERN.flags);
}

/**
 * Get the keywords for a language
 */
function getKeywords(languageId: string): Set<string> {
  return KEYWORDS[languageId.toLowerCase()] ?? DEFAULT_KEYWORDS;
}

/**
 * Check if a position is inside a string or comment
 * (simplified heuristic - production code would use proper tokenization)
 */
function isInsideStringOrComment(line: string, column: number): boolean {
  let inString = false;
  let stringChar: string | null = null;
  let inLineComment = false;
  
  for (let i = 0; i < column && i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    // Check for line comment
    if (!inString && char === '/' && nextChar === '/') {
      inLineComment = true;
      break;
    }
    if (!inString && char === '#') {
      inLineComment = true;
      break;
    }
    
    // Check for string start/end
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && line[i - 1] !== '\\') {
      inString = false;
      stringChar = null;
    }
  }
  
  return inString || inLineComment;
}

/**
 * Truncate a value string if too long
 */
function truncateValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.substring(0, maxLength - 3) + '...';
}

/**
 * Check if line is just a comment or whitespace
 */
function isCommentOrWhitespaceLine(line: string, _languageId: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  
  // Common comment patterns
  if (trimmed.startsWith('//')) return true;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('/*') || trimmed.startsWith('*')) return true;
  if (trimmed.startsWith('--')) return true; // SQL, Lua, Haskell
  if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) return true; // Python docstrings
  
  return false;
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Extract variable names from a line
 */
export function extractVariableNames(
  line: string,
  languageId: string
): VariableInfo[] {
  const results: VariableInfo[] = [];
  const pattern = getVariablePattern(languageId);
  const keywords = getKeywords(languageId);
  const seen = new Set<string>();
  
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(line)) !== null) {
    const name = match[1];
    const startColumn = match.index;
    const endColumn = match.index + match[0].length;
    
    // Skip if already seen
    if (seen.has(name)) {
      continue;
    }
    
    // Skip keywords
    if (keywords.has(name)) {
      continue;
    }
    
    // Skip if inside string or comment
    if (isInsideStringOrComment(line, startColumn)) {
      continue;
    }
    
    // Skip single character names (often loop indices, less interesting)
    if (name.length === 1) {
      continue;
    }
    
    // Skip common non-variable patterns
    if (/^[A-Z_]+$/.test(name) && name.length > 2) {
      // Likely a constant - still include but could filter
    }
    
    seen.add(name);
    results.push({
      name,
      range: { startColumn, endColumn }
    });
  }
  
  return results;
}

/**
 * Filter variables (exclude keywords, duplicates, etc.)
 */
export function filterVariables(
  variables: VariableInfo[],
  languageId: string,
  scope?: Set<string>
): VariableInfo[] {
  const keywords = getKeywords(languageId);
  const seen = new Set<string>();
  
  return variables.filter(variable => {
    // Skip if already seen
    if (seen.has(variable.name)) {
      return false;
    }
    
    // Skip keywords
    if (keywords.has(variable.name)) {
      return false;
    }
    
    // If scope is provided, only include variables in scope
    if (scope && !scope.has(variable.name)) {
      return false;
    }
    
    seen.add(variable.name);
    return true;
  });
}

/**
 * Format value for inline display
 */
export function formatInlineValue(value: string, maxLength: number = 50): string {
  // Remove newlines and excessive whitespace
  let formatted = value.replace(/\s+/g, ' ').trim();
  
  // Handle different types of values
  if (formatted.startsWith('{') && formatted.endsWith('}')) {
    // Object - show truncated
    formatted = truncateValue(formatted, maxLength);
  } else if (formatted.startsWith('[') && formatted.endsWith(']')) {
    // Array - show truncated
    formatted = truncateValue(formatted, maxLength);
  } else if (formatted.startsWith('"') && formatted.endsWith('"')) {
    // String - show with quotes
    formatted = truncateValue(formatted, maxLength);
  } else if (formatted.startsWith("'") && formatted.endsWith("'")) {
    // String - show with quotes
    formatted = truncateValue(formatted, maxLength);
  } else if (formatted === 'undefined' || formatted === 'null' || formatted === 'None') {
    // Keep as is
  } else if (!isNaN(Number(formatted))) {
    // Number - keep as is
  } else if (formatted === 'true' || formatted === 'false' || formatted === 'True' || formatted === 'False') {
    // Boolean - keep as is
  } else {
    // Other - truncate
    formatted = truncateValue(formatted, maxLength);
  }
  
  return formatted;
}

/**
 * Calculate position for inline value display to avoid overlap with code
 */
export function calculateInlineValuePosition(
  lineText: string,
  variableEnd: number,
  tabSize: number = 4
): number {
  // Calculate visual width considering tabs
  let visualWidth = 0;
  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] === '\t') {
      visualWidth += tabSize - (visualWidth % tabSize);
    } else {
      visualWidth++;
    }
  }
  
  // Position inline value after the line content with some padding
  const padding = 4;
  return Math.max(variableEnd + padding, visualWidth + padding);
}

/**
 * Create Monaco decorations for inline values
 */
export function createInlineValueDecorations(
  values: InlineValue[],
  evaluatedValues: Map<string, string>
): monaco.editor.IModelDeltaDecoration[] {
  const decorations: monaco.editor.IModelDeltaDecoration[] = [];
  
  for (const value of values) {
    const variableName = value.variableName ?? value.text;
    const evaluatedValue = evaluatedValues.get(variableName);
    
    if (!evaluatedValue) {
      continue;
    }
    
    const formattedValue = formatInlineValue(evaluatedValue);
    const displayText = `${variableName} = ${formattedValue}`;
    
    decorations.push({
      range: {
        startLineNumber: value.range.startLine,
        startColumn: value.range.endColumn,
        endLineNumber: value.range.endLine,
        endColumn: value.range.endColumn
      },
      options: {
        after: {
          content: ` // ${displayText}`,
          inlineClassName: 'inline-value-decoration',
        },
        isWholeLine: false,
        stickiness: 1, // NeverGrowsWhenTypingAtEdges
      }
    });
  }
  
  return decorations;
}

/**
 * Get evaluatable expression at position (for debug adapter)
 */
export function getEvaluatableExpressionAtPosition(
  document: { getText(): string; lineAt(line: number): { text: string } },
  position: { line: number; column: number },
  languageId: string
): EvaluatableExpression | undefined {
  const line = document.lineAt(position.line).text;
  const pattern = getVariablePattern(languageId);
  const keywords = getKeywords(languageId);
  
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(line)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    
    // Check if position is within this match
    if (position.column >= start && position.column <= end) {
      const name = match[1];
      
      // Skip keywords
      if (keywords.has(name)) {
        continue;
      }
      
      // Skip if inside string or comment
      if (isInsideStringOrComment(line, start)) {
        continue;
      }
      
      // Try to expand to property access (e.g., obj.prop.value)
      let expression = name;
      let expressionStart = start;
      let expressionEnd = end;
      
      // Look backwards for property chain
      let i = start - 1;
      while (i >= 0) {
        if (line[i] === '.') {
          // Find the identifier before the dot
          let identEnd = i;
          i--;
          while (i >= 0 && /[a-zA-Z0-9_$]/.test(line[i])) {
            i--;
          }
          const identStart = i + 1;
          if (identStart < identEnd) {
            const ident = line.substring(identStart, identEnd);
            if (!keywords.has(ident)) {
              expression = ident + '.' + expression;
              expressionStart = identStart;
            } else {
              break;
            }
          } else {
            break;
          }
        } else if (/\s/.test(line[i])) {
          i--;
        } else {
          break;
        }
      }
      
      // Look forwards for property chain
      let j = end;
      while (j < line.length) {
        if (line[j] === '.') {
          j++;
          const identStart = j;
          while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) {
            j++;
          }
          if (j > identStart) {
            const ident = line.substring(identStart, j);
            if (!keywords.has(ident)) {
              expression = expression + '.' + ident;
              expressionEnd = j;
            } else {
              break;
            }
          } else {
            break;
          }
        } else if (/\s/.test(line[j])) {
          j++;
        } else {
          break;
        }
      }
      
      // Also check for array access (e.g., arr[0])
      if (j < line.length && line[j] === '[') {
        const bracketStart = j;
        let depth = 1;
        j++;
        while (j < line.length && depth > 0) {
          if (line[j] === '[') depth++;
          else if (line[j] === ']') depth--;
          j++;
        }
        if (depth === 0) {
          expression = expression + line.substring(bracketStart, j);
          expressionEnd = j;
        }
      }
      
      return {
        expression,
        range: {
          startLine: position.line,
          startColumn: expressionStart,
          endLine: position.line,
          endColumn: expressionEnd
        }
      };
    }
  }
  
  return undefined;
}

/**
 * Default inline values provider (generic, AST-unaware)
 */
export function createDefaultInlineValuesProvider(): InlineValuesProvider {
  return {
    async provideInlineValues(
      document: InlineValuesDocument,
      viewRange: ViewRange,
      context: InlineValueContext
    ): Promise<InlineValue[]> {
      const results: InlineValue[] = [];
      const seenVariables = new Set<string>();
      
      // Determine language from URI
      const uri = document.uri;
      let languageId = 'javascript'; // default
      
      if (uri.endsWith('.ts') || uri.endsWith('.tsx')) {
        languageId = uri.endsWith('.tsx') ? 'typescriptreact' : 'typescript';
      } else if (uri.endsWith('.js') || uri.endsWith('.jsx')) {
        languageId = uri.endsWith('.jsx') ? 'javascriptreact' : 'javascript';
      } else if (uri.endsWith('.py')) {
        languageId = 'python';
      } else if (uri.endsWith('.rs')) {
        languageId = 'rust';
      } else if (uri.endsWith('.go')) {
        languageId = 'go';
      } else if (uri.endsWith('.java')) {
        languageId = 'java';
      } else if (uri.endsWith('.cpp') || uri.endsWith('.cc') || uri.endsWith('.cxx') || uri.endsWith('.hpp')) {
        languageId = 'cpp';
      } else if (uri.endsWith('.c') || uri.endsWith('.h')) {
        languageId = 'c';
      } else if (uri.endsWith('.cs')) {
        languageId = 'csharp';
      } else if (uri.endsWith('.rb')) {
        languageId = 'ruby';
      } else if (uri.endsWith('.php')) {
        languageId = 'php';
      } else if (uri.endsWith('.swift')) {
        languageId = 'swift';
      } else if (uri.endsWith('.kt') || uri.endsWith('.kts')) {
        languageId = 'kotlin';
      } else if (uri.endsWith('.lua')) {
        languageId = 'lua';
      }
      
      // Only process lines up to and including the stopped location
      const startLine = Math.max(viewRange.startLine, 0);
      const endLine = Math.min(viewRange.endLine, context.stoppedLocation.endLine);
      
      for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
        try {
          const lineInfo = document.lineAt(lineNumber);
          const line = lineInfo.text;
          
          // Skip empty lines and comments
          if (isCommentOrWhitespaceLine(line, languageId)) {
            continue;
          }
          
          // Extract variables from this line
          const variables = extractVariableNames(line, languageId);
          
          for (const variable of variables) {
            // Skip if already seen in this scope
            if (seenVariables.has(variable.name)) {
              continue;
            }
            
            seenVariables.add(variable.name);
            
            results.push({
              range: {
                startLine: lineNumber,
                startColumn: variable.range.startColumn,
                endLine: lineNumber,
                endColumn: variable.range.endColumn
              },
              text: variable.name,
              type: 'variable',
              variableName: variable.name
            });
          }
        } catch {
          // Skip lines that can't be read
          continue;
        }
      }
      
      return results;
    }
  };
}

// =============================================================================
// INLINE VALUES MANAGER
// =============================================================================

/**
 * Manager for inline values in the editor
 */
export class InlineValuesManager {
  private providers: Map<string, InlineValuesProvider> = new Map();
  private defaultProvider: InlineValuesProvider;
  private decorationIds: string[] = [];
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  
  constructor() {
    this.defaultProvider = createDefaultInlineValuesProvider();
  }
  
  /**
   * Register a custom provider for a language
   */
  registerProvider(languageId: string, provider: InlineValuesProvider): void {
    this.providers.set(languageId, provider);
  }
  
  /**
   * Unregister a provider
   */
  unregisterProvider(languageId: string): void {
    this.providers.delete(languageId);
  }
  
  /**
   * Get provider for a language
   */
  getProvider(languageId: string): InlineValuesProvider {
    return this.providers.get(languageId) ?? this.defaultProvider;
  }
  
  /**
   * Set the editor instance
   */
  setEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;
  }
  
  /**
   * Update inline values in the editor
   */
  async updateInlineValues(
    document: InlineValuesDocument,
    context: InlineValueContext,
    evaluatedValues: Map<string, string>,
    languageId: string
  ): Promise<void> {
    if (!this.editor) {
      return;
    }
    
    // Clear existing decorations
    this.clearDecorations();
    
    // Get visible range
    const visibleRanges = this.editor.getVisibleRanges();
    if (visibleRanges.length === 0) {
      return;
    }
    
    const viewRange: ViewRange = {
      startLine: visibleRanges[0].startLineNumber - 1, // 0-based
      endLine: visibleRanges[visibleRanges.length - 1].endLineNumber - 1
    };
    
    // Get provider and fetch inline values
    const provider = this.getProvider(languageId);
    const inlineValues = await provider.provideInlineValues(document, viewRange, context);
    
    // Create decorations
    const decorations = createInlineValueDecorations(inlineValues, evaluatedValues);
    
    // Apply decorations
    if (decorations.length > 0) {
      this.decorationIds = this.editor.deltaDecorations([], decorations);
    }
  }
  
  /**
   * Clear all inline value decorations
   */
  clearDecorations(): void {
    if (this.editor && this.decorationIds.length > 0) {
      this.editor.deltaDecorations(this.decorationIds, []);
      this.decorationIds = [];
    }
  }
  
  /**
   * Dispose the manager
   */
  dispose(): void {
    this.clearDecorations();
    this.providers.clear();
    this.editor = null;
  }
}

// =============================================================================
// CSS STYLES (to be injected)
// =============================================================================

/**
 * Get CSS styles for inline value decorations
 */
export function getInlineValueStyles(): string {
  return `
    .inline-value-decoration {
      color: #6a9955;
      font-style: italic;
      opacity: 0.8;
      margin-left: 1em;
    }
    
    .monaco-editor.vs-dark .inline-value-decoration {
      color: #6a9955;
    }
    
    .monaco-editor.vs .inline-value-decoration {
      color: #008000;
    }
    
    .monaco-editor.hc-black .inline-value-decoration {
      color: #89d185;
    }
  `;
}

/**
 * Inject inline value styles into the document
 */
export function injectInlineValueStyles(): void {
  const styleId = 'cortex-inline-values-styles';
  
  // Check if already injected
  if (document.getElementById(styleId)) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = getInlineValueStyles();
  document.head.appendChild(style);
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let inlineValuesManagerInstance: InlineValuesManager | null = null;

/**
 * Get or create the singleton InlineValuesManager instance
 */
export function getInlineValuesManager(): InlineValuesManager {
  if (!inlineValuesManagerInstance) {
    inlineValuesManagerInstance = new InlineValuesManager();
  }
  return inlineValuesManagerInstance;
}

/**
 * Dispose the singleton instance
 */
export function disposeInlineValuesManager(): void {
  if (inlineValuesManagerInstance) {
    inlineValuesManagerInstance.dispose();
    inlineValuesManagerInstance = null;
  }
}

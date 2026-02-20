/**
 * Debug Hover Utilities for Cortex IDE
 * Expression evaluation and hover widget logic
 */

// Debug hover result
export interface DebugHoverResult {
  expression: string;
  value: string;
  type?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  memoryReference?: string;
  presentationHint?: VariablePresentationHint;
}

export interface VariablePresentationHint {
  kind?: 'property' | 'method' | 'class' | 'data' | 'event' | 'baseClass' | 'innerClass' | 'interface' | 'mostDerivedClass' | 'virtual' | 'dataBreakpoint';
  attributes?: ('static' | 'constant' | 'readOnly' | 'rawString' | 'hasObjectId' | 'canHaveObjectId' | 'hasSideEffects' | 'hasDataBreakpoint')[];
  visibility?: 'public' | 'private' | 'protected' | 'internal' | 'final';
  lazy?: boolean;
}

// Hover state
export interface DebugHoverState {
  visible: boolean;
  position: { x: number; y: number };
  expression: string;
  result?: DebugHoverResult;
  loading: boolean;
  error?: string;
  expandedPaths: Set<string>;
}

/**
 * Characters that can be part of an identifier by language
 */
const IDENTIFIER_CHARS: Record<string, RegExp> = {
  javascript: /[\w$]/,
  typescript: /[\w$]/,
  python: /[\w]/,
  rust: /[\w]/,
  go: /[\w]/,
  cpp: /[\w]/,
  c: /[\w]/,
  java: /[\w$]/,
  csharp: /[\w]/,
};

/**
 * Characters that can start an identifier by language
 */
const IDENTIFIER_START_CHARS: Record<string, RegExp> = {
  javascript: /[a-zA-Z_$]/,
  typescript: /[a-zA-Z_$]/,
  python: /[a-zA-Z_]/,
  rust: /[a-zA-Z_]/,
  go: /[a-zA-Z_]/,
  cpp: /[a-zA-Z_]/,
  c: /[a-zA-Z_]/,
  java: /[a-zA-Z_$]/,
  csharp: /[a-zA-Z_]/,
};

/**
 * Property access operators by language
 */
const PROPERTY_ACCESS_OPERATORS: Record<string, string[]> = {
  javascript: ['.', '?.'],
  typescript: ['.', '?.'],
  python: ['.'],
  rust: ['.', '::'],
  go: ['.'],
  cpp: ['.', '->', '::'],
  c: ['.', '->'],
  java: ['.'],
  csharp: ['.', '?.'],
};

/**
 * Get expression to evaluate at cursor position
 */
export function getExpressionAtPosition(
  lineText: string,
  column: number,
  languageId: string
): { expression: string; range: { startColumn: number; endColumn: number } } | undefined {
  if (!lineText || column < 0 || column > lineText.length) {
    return undefined;
  }

  const normalizedLang = normalizeLanguageId(languageId);
  const identifierChars = IDENTIFIER_CHARS[normalizedLang] || /[\w]/;
  const identifierStartChars = IDENTIFIER_START_CHARS[normalizedLang] || /[a-zA-Z_]/;

  // Find word boundaries around cursor
  let startColumn = column;
  let endColumn = column;

  // Expand left to find start of current word
  while (startColumn > 0 && identifierChars.test(lineText[startColumn - 1])) {
    startColumn--;
  }

  // Expand right to find end of current word
  while (endColumn < lineText.length && identifierChars.test(lineText[endColumn])) {
    endColumn++;
  }

  // Check if we found a valid identifier
  if (startColumn === endColumn) {
    return undefined;
  }

  // Verify it starts with a valid identifier character
  if (!identifierStartChars.test(lineText[startColumn])) {
    return undefined;
  }

  // Now expand left to capture property chains (e.g., obj.prop.value)
  const expanded = expandExpressionLeft(lineText, startColumn, normalizedLang);
  if (expanded.startColumn < startColumn) {
    startColumn = expanded.startColumn;
  }

  // Also expand right for property chains after the word
  const expandedRight = expandExpressionRight(lineText, endColumn, normalizedLang);
  if (expandedRight.endColumn > endColumn) {
    endColumn = expandedRight.endColumn;
  }

  const expression = lineText.substring(startColumn, endColumn);

  // Skip keywords
  if (isKeyword(expression, normalizedLang)) {
    return undefined;
  }

  return {
    expression,
    range: { startColumn, endColumn }
  };
}

/**
 * Normalize language ID to a standard form
 */
function normalizeLanguageId(languageId: string): string {
  const mapping: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'rs': 'rust',
    'c++': 'cpp',
    'c#': 'csharp',
    'cs': 'csharp',
  };
  return mapping[languageId.toLowerCase()] || languageId.toLowerCase();
}

/**
 * Check if expression is a language keyword
 */
function isKeyword(expression: string, languageId: string): boolean {
  const keywords: Record<string, Set<string>> = {
    javascript: new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'function', 'var', 'let', 'const', 'class', 'extends', 'new', 'this', 'super', 'import', 'export', 'default', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield', 'typeof', 'instanceof', 'in', 'of', 'void', 'delete', 'null', 'undefined', 'true', 'false']),
    typescript: new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'function', 'var', 'let', 'const', 'class', 'extends', 'new', 'this', 'super', 'import', 'export', 'default', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield', 'typeof', 'instanceof', 'in', 'of', 'void', 'delete', 'null', 'undefined', 'true', 'false', 'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'abstract', 'implements', 'public', 'private', 'protected', 'readonly', 'static', 'as', 'is', 'keyof', 'infer', 'never', 'unknown', 'any']),
    python: new Set(['if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'return', 'def', 'class', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'async', 'await', 'yield', 'lambda', 'pass', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'global', 'nonlocal', 'assert', 'del']),
    rust: new Set(['if', 'else', 'for', 'while', 'loop', 'break', 'continue', 'return', 'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'impl', 'trait', 'type', 'where', 'use', 'mod', 'pub', 'crate', 'self', 'super', 'match', 'if', 'else', 'async', 'await', 'move', 'ref', 'true', 'false', 'as', 'in', 'dyn', 'unsafe', 'extern']),
    go: new Set(['if', 'else', 'for', 'range', 'break', 'continue', 'return', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'select', 'case', 'default', 'switch', 'fallthrough', 'defer', 'package', 'import', 'true', 'false', 'nil', 'iota']),
    cpp: new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'class', 'struct', 'union', 'enum', 'namespace', 'using', 'typedef', 'template', 'typename', 'virtual', 'override', 'final', 'public', 'private', 'protected', 'static', 'const', 'constexpr', 'volatile', 'mutable', 'inline', 'extern', 'register', 'auto', 'new', 'delete', 'this', 'try', 'catch', 'throw', 'true', 'false', 'nullptr', 'sizeof', 'alignof', 'decltype', 'noexcept', 'static_cast', 'dynamic_cast', 'const_cast', 'reinterpret_cast']),
    c: new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'struct', 'union', 'enum', 'typedef', 'static', 'const', 'volatile', 'extern', 'register', 'auto', 'sizeof', 'void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned']),
    java: new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'class', 'interface', 'enum', 'extends', 'implements', 'new', 'this', 'super', 'import', 'package', 'try', 'catch', 'finally', 'throw', 'throws', 'public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'volatile', 'transient', 'native', 'instanceof', 'true', 'false', 'null', 'void', 'assert']),
    csharp: new Set(['if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'class', 'struct', 'interface', 'enum', 'delegate', 'event', 'new', 'this', 'base', 'using', 'namespace', 'try', 'catch', 'finally', 'throw', 'public', 'private', 'protected', 'internal', 'static', 'readonly', 'const', 'volatile', 'virtual', 'override', 'abstract', 'sealed', 'partial', 'async', 'await', 'is', 'as', 'typeof', 'sizeof', 'true', 'false', 'null', 'void', 'var', 'dynamic', 'object', 'string', 'in', 'out', 'ref', 'params']),
  };

  const keywordSet = keywords[languageId];
  return keywordSet ? keywordSet.has(expression) : false;
}

/**
 * Expand expression leftward to capture property chains
 */
export function expandExpressionLeft(
  lineText: string,
  endColumn: number,
  languageId: string
): { expression: string; startColumn: number } {
  const normalizedLang = normalizeLanguageId(languageId);
  const identifierChars = IDENTIFIER_CHARS[normalizedLang] || /[\w]/;
  const identifierStartChars = IDENTIFIER_START_CHARS[normalizedLang] || /[a-zA-Z_]/;
  const accessOperators = PROPERTY_ACCESS_OPERATORS[normalizedLang] || ['.'];

  let startColumn = endColumn;
  let depth = 0;

  while (startColumn > 0) {
    const prevChar = lineText[startColumn - 1];

    // Handle bracket access like [0] or ["key"]
    if (prevChar === ']') {
      depth = 1;
      startColumn--;
      while (startColumn > 0 && depth > 0) {
        startColumn--;
        if (lineText[startColumn] === '[') depth--;
        else if (lineText[startColumn] === ']') depth++;
      }
      continue;
    }

    // Check for property access operators
    let foundOperator = false;
    for (const op of accessOperators) {
      if (startColumn >= op.length) {
        const slice = lineText.substring(startColumn - op.length, startColumn);
        if (slice === op) {
          startColumn -= op.length;
          foundOperator = true;
          break;
        }
      }
    }

    if (foundOperator) {
      // After operator, expect an identifier
      while (startColumn > 0 && identifierChars.test(lineText[startColumn - 1])) {
        startColumn--;
      }
      // Verify it's a valid identifier start
      if (startColumn < endColumn && !identifierStartChars.test(lineText[startColumn])) {
        // Invalid, restore position
        startColumn++;
        break;
      }
      continue;
    }

    // Handle 'this' keyword specially
    if (startColumn >= 4) {
      const slice = lineText.substring(startColumn - 4, startColumn);
      if (slice === 'this' && (startColumn === 4 || !identifierChars.test(lineText[startColumn - 5]))) {
        startColumn -= 4;
        continue;
      }
    }

    // Handle 'self' keyword (for Python/Rust)
    if (startColumn >= 4) {
      const slice = lineText.substring(startColumn - 4, startColumn);
      if (slice === 'self' && (startColumn === 4 || !identifierChars.test(lineText[startColumn - 5]))) {
        startColumn -= 4;
        continue;
      }
    }

    // No more expansion possible
    break;
  }

  return {
    expression: lineText.substring(startColumn, endColumn),
    startColumn
  };
}

/**
 * Expand expression rightward to capture property chains after current position
 */
function expandExpressionRight(
  lineText: string,
  startColumn: number,
  languageId: string
): { expression: string; endColumn: number } {
  const normalizedLang = normalizeLanguageId(languageId);
  const identifierChars = IDENTIFIER_CHARS[normalizedLang] || /[\w]/;
  const accessOperators = PROPERTY_ACCESS_OPERATORS[normalizedLang] || ['.'];

  let endColumn = startColumn;

  while (endColumn < lineText.length) {
    // Check for property access operators
    let foundOperator = false;
    for (const op of accessOperators) {
      if (endColumn + op.length <= lineText.length) {
        const slice = lineText.substring(endColumn, endColumn + op.length);
        if (slice === op) {
          endColumn += op.length;
          foundOperator = true;
          break;
        }
      }
    }

    if (foundOperator) {
      // After operator, consume identifier
      while (endColumn < lineText.length && identifierChars.test(lineText[endColumn])) {
        endColumn++;
      }
      continue;
    }

    // Handle bracket access
    if (lineText[endColumn] === '[') {
      let depth = 1;
      endColumn++;
      while (endColumn < lineText.length && depth > 0) {
        if (lineText[endColumn] === '[') depth++;
        else if (lineText[endColumn] === ']') depth--;
        endColumn++;
      }
      continue;
    }

    break;
  }

  return {
    expression: lineText.substring(startColumn, endColumn),
    endColumn
  };
}

/**
 * Safe triangle for mouse movement - prevents hover from closing when moving mouse to it
 */
export interface SafeTriangle {
  points: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
}

/**
 * Calculate "safe triangle" for mouse movement
 * The triangle extends from the current mouse position to the hover widget
 */
export function calculateSafeTriangle(
  sourcePosition: { x: number; y: number },
  hoverBounds: { x: number; y: number; width: number; height: number }
): SafeTriangle {
  // Determine if hover is to the left or right of source
  const hoverIsRight = hoverBounds.x > sourcePosition.x;
  
  let topCorner: { x: number; y: number };
  let bottomCorner: { x: number; y: number };

  if (hoverIsRight) {
    // Hover is to the right - triangle points to left edge of hover
    topCorner = { x: hoverBounds.x, y: hoverBounds.y };
    bottomCorner = { x: hoverBounds.x, y: hoverBounds.y + hoverBounds.height };
  } else {
    // Hover is to the left - triangle points to right edge of hover
    topCorner = { x: hoverBounds.x + hoverBounds.width, y: hoverBounds.y };
    bottomCorner = { x: hoverBounds.x + hoverBounds.width, y: hoverBounds.y + hoverBounds.height };
  }

  // If hover is above or below, adjust the triangle
  if (hoverBounds.y + hoverBounds.height < sourcePosition.y) {
    // Hover is above source
    return {
      points: [
        sourcePosition,
        { x: hoverBounds.x, y: hoverBounds.y + hoverBounds.height },
        { x: hoverBounds.x + hoverBounds.width, y: hoverBounds.y + hoverBounds.height }
      ]
    };
  } else if (hoverBounds.y > sourcePosition.y) {
    // Hover is below source
    return {
      points: [
        sourcePosition,
        { x: hoverBounds.x, y: hoverBounds.y },
        { x: hoverBounds.x + hoverBounds.width, y: hoverBounds.y }
      ]
    };
  }

  return {
    points: [sourcePosition, topCorner, bottomCorner]
  };
}

/**
 * Check if a point is inside a triangle using barycentric coordinates
 */
export function isPointInTriangle(
  point: { x: number; y: number },
  triangle: SafeTriangle
): boolean {
  const [p1, p2, p3] = triangle.points;

  // Calculate vectors
  const v0x = p3.x - p1.x;
  const v0y = p3.y - p1.y;
  const v1x = p2.x - p1.x;
  const v1y = p2.y - p1.y;
  const v2x = point.x - p1.x;
  const v2y = point.y - p1.y;

  // Calculate dot products
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  // Calculate barycentric coordinates
  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  // Check if point is in triangle (with small epsilon for edge cases)
  const epsilon = 0.001;
  return (u >= -epsilon) && (v >= -epsilon) && (u + v <= 1 + epsilon);
}

/**
 * Format debug value for display with proper escaping and truncation
 */
export function formatDebugValue(
  value: string,
  type?: string,
  presentationHint?: VariablePresentationHint
): string {
  if (value === undefined || value === null) {
    return 'undefined';
  }

  // Handle lazy values
  if (presentationHint?.lazy) {
    return '<not evaluated>';
  }

  // Handle raw strings - show without escaping
  if (presentationHint?.attributes?.includes('rawString')) {
    return value;
  }

  let formatted = value;

  // Truncate very long values
  const maxLength = 1000;
  if (formatted.length > maxLength) {
    formatted = formatted.substring(0, maxLength) + '...';
  }

  // Format based on type
  if (type) {
    const lowerType = type.toLowerCase();

    // String types - ensure proper quoting
    if (lowerType === 'string' || lowerType === 'str') {
      if (!formatted.startsWith('"') && !formatted.startsWith("'")) {
        formatted = `"${formatted}"`;
      }
    }

    // Boolean types
    if (lowerType === 'boolean' || lowerType === 'bool') {
      formatted = formatted.toLowerCase();
    }

    // Null/None types
    if (lowerType === 'null' || lowerType === 'none' || lowerType === 'nil') {
      formatted = type.toLowerCase();
    }
  }

  return formatted;
}

/**
 * Check if value is expandable (has children)
 */
export function isExpandable(result: DebugHoverResult): boolean {
  // Has variables reference means it can be expanded
  if (result.variablesReference > 0) {
    return true;
  }

  // Has named or indexed variables
  if ((result.namedVariables && result.namedVariables > 0) ||
      (result.indexedVariables && result.indexedVariables > 0)) {
    return true;
  }

  return false;
}

/**
 * Build tree path for expanded items
 */
export function buildTreePath(parentPath: string, name: string): string {
  if (!parentPath) {
    return name;
  }

  // Handle array indices
  if (/^\d+$/.test(name)) {
    return `${parentPath}[${name}]`;
  }

  // Handle property names with special characters
  if (/[^a-zA-Z0-9_$]/.test(name)) {
    return `${parentPath}["${name.replace(/"/g, '\\"')}"]`;
  }

  return `${parentPath}.${name}`;
}

/**
 * Get icon for variable type based on type and presentation hint
 */
export function getVariableIcon(
  type?: string,
  presentationHint?: VariablePresentationHint
): string {
  // Priority to presentation hint kind
  if (presentationHint?.kind) {
    switch (presentationHint.kind) {
      case 'method':
        return 'symbol-method';
      case 'property':
        return 'symbol-property';
      case 'class':
      case 'baseClass':
      case 'innerClass':
      case 'mostDerivedClass':
        return 'symbol-class';
      case 'interface':
        return 'symbol-interface';
      case 'event':
        return 'symbol-event';
      case 'data':
        return 'symbol-variable';
      case 'virtual':
        return 'symbol-method';
      case 'dataBreakpoint':
        return 'debug-breakpoint-data';
    }
  }

  if (!type) {
    return 'symbol-variable';
  }

  const lowerType = type.toLowerCase();

  // Primitive types
  if (lowerType === 'string' || lowerType === 'str') {
    return 'symbol-string';
  }
  if (lowerType === 'number' || lowerType === 'int' || lowerType === 'integer' ||
      lowerType === 'float' || lowerType === 'double' || lowerType === 'i32' ||
      lowerType === 'i64' || lowerType === 'u32' || lowerType === 'u64' ||
      lowerType === 'f32' || lowerType === 'f64') {
    return 'symbol-number';
  }
  if (lowerType === 'boolean' || lowerType === 'bool') {
    return 'symbol-boolean';
  }
  if (lowerType === 'null' || lowerType === 'none' || lowerType === 'nil' ||
      lowerType === 'undefined') {
    return 'symbol-null';
  }

  // Collection types
  if (lowerType === 'array' || lowerType === 'list' || lowerType === 'vec' ||
      lowerType.startsWith('array<') || lowerType.startsWith('list<') ||
      lowerType.startsWith('vec<') || lowerType.endsWith('[]')) {
    return 'symbol-array';
  }
  if (lowerType === 'object' || lowerType === 'dict' || lowerType === 'map' ||
      lowerType === 'hashmap' || lowerType.startsWith('map<') ||
      lowerType.startsWith('dict<') || lowerType.startsWith('hashmap<')) {
    return 'symbol-object';
  }

  // Function types
  if (lowerType === 'function' || lowerType === 'fn' || lowerType === 'closure' ||
      lowerType === 'lambda' || lowerType.includes('->') ||
      lowerType.startsWith('func') || lowerType.includes('=>')) {
    return 'symbol-function';
  }

  // Class/struct types
  if (lowerType === 'class' || lowerType === 'struct' || lowerType === 'type') {
    return 'symbol-class';
  }

  // Enum types
  if (lowerType === 'enum' || lowerType.startsWith('enum ')) {
    return 'symbol-enum';
  }

  // Default
  return 'symbol-variable';
}

/**
 * Copy value to clipboard (formatted)
 */
export function getValueForCopy(result: DebugHoverResult): string {
  let value = result.value;

  // For objects/arrays, try to format as JSON if possible
  if (result.variablesReference > 0) {
    // If value looks like a type description, just return the expression
    if (value.startsWith('{') || value.startsWith('[') || value.startsWith('Object') ||
        value.startsWith('Array')) {
      return value;
    }
  }

  // Remove surrounding quotes for strings if present (user probably wants raw value)
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
    // Unescape common escape sequences
    value = value
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
  }

  return value;
}

/**
 * Get evaluate path for "Copy as Expression"
 */
export function getEvaluatePath(result: DebugHoverResult, parentPath?: string): string {
  const expression = result.expression;

  if (!parentPath) {
    return expression;
  }

  // Build full path
  return buildTreePath(parentPath, expression);
}

/**
 * Hover positioning configuration
 */
export interface HoverPosition {
  x: number;
  y: number;
  anchor: 'above' | 'below';
}

/**
 * Calculate optimal hover position to keep widget in viewport
 */
export function calculateHoverPosition(
  triggerPosition: { x: number; y: number },
  hoverSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
  _editorScrollTop: number
): HoverPosition {
  const padding = 8; // Padding from edges
  const verticalOffset = 4; // Space between trigger and hover

  // Start with position below the trigger
  let x = triggerPosition.x;
  let y = triggerPosition.y + verticalOffset;
  let anchor: 'above' | 'below' = 'below';

  // Check if hover fits below
  const fitsBelow = (y + hoverSize.height + padding) <= viewportSize.height;
  const fitsAbove = (triggerPosition.y - hoverSize.height - verticalOffset - padding) >= 0;

  // Prefer below, but use above if necessary
  if (!fitsBelow && fitsAbove) {
    y = triggerPosition.y - hoverSize.height - verticalOffset;
    anchor = 'above';
  } else if (!fitsBelow && !fitsAbove) {
    // Neither fits perfectly - choose the one with more space
    const spaceBelow = viewportSize.height - triggerPosition.y - verticalOffset;
    const spaceAbove = triggerPosition.y - verticalOffset;

    if (spaceAbove > spaceBelow) {
      y = padding;
      anchor = 'above';
    } else {
      y = triggerPosition.y + verticalOffset;
      anchor = 'below';
    }
  }

  // Horizontal positioning - try to center on trigger, but keep in bounds
  x = triggerPosition.x - hoverSize.width / 2;

  // Keep within horizontal bounds
  if (x < padding) {
    x = padding;
  } else if (x + hoverSize.width + padding > viewportSize.width) {
    x = viewportSize.width - hoverSize.width - padding;
  }

  // Ensure x is not negative
  x = Math.max(padding, x);

  return { x, y, anchor };
}

/**
 * Debounce hover evaluation to avoid excessive requests
 */
export function createHoverDebouncer(
  delay: number = 300
): {
  schedule: (callback: () => void) => void;
  cancel: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const schedule = (callback: () => void) => {
    cancel();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      callback();
    }, delay);
  };

  return { schedule, cancel };
}

/**
 * Create initial hover state
 */
export function createInitialHoverState(): DebugHoverState {
  return {
    visible: false,
    position: { x: 0, y: 0 },
    expression: '',
    result: undefined,
    loading: false,
    error: undefined,
    expandedPaths: new Set<string>()
  };
}

/**
 * Check if expression is safe to evaluate (doesn't have side effects)
 */
export function isSafeExpression(expression: string): boolean {
  // Dangerous patterns that could have side effects
  const dangerousPatterns = [
    /\(\s*\)/, // Function calls with ()
    /=(?!=)/, // Assignment (but not ==)
    /\+\+/, // Increment
    /--/, // Decrement
    /\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=|>>>=/, // Compound assignment
    /\bdelete\b/, // delete operator
    /\bnew\b/, // new operator (could have side effects in constructor)
    /\bawait\b/, // await (could trigger async operations)
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(expression)) {
      return false;
    }
  }

  return true;
}

/**
 * Get hover delay based on user preferences and context
 */
export function getHoverDelay(
  baseDelay: number,
  isRecentlyMoved: boolean,
  hasActiveHover: boolean
): number {
  // Shorter delay if there's already an active hover (user is exploring)
  if (hasActiveHover) {
    return Math.min(baseDelay, 150);
  }

  // Longer delay if mouse was recently moved (user is navigating)
  if (isRecentlyMoved) {
    return baseDelay * 1.5;
  }

  return baseDelay;
}

/**
 * Parse type information from value string (for languages that encode type in value)
 */
export function parseTypeFromValue(value: string): { value: string; type?: string } {
  // Pattern: "TypeName { ... }" or "TypeName(...)"
  const structMatch = value.match(/^([A-Z][a-zA-Z0-9_]*)\s*\{/);
  if (structMatch) {
    return { value, type: structMatch[1] };
  }

  // Pattern: "TypeName(...)"
  const tupleMatch = value.match(/^([A-Z][a-zA-Z0-9_]*)\s*\(/);
  if (tupleMatch) {
    return { value, type: tupleMatch[1] };
  }

  // Pattern: "<TypeName>" at the start
  const genericMatch = value.match(/^<([^>]+)>/);
  if (genericMatch) {
    return {
      value: value.substring(genericMatch[0].length).trim(),
      type: genericMatch[1]
    };
  }

  return { value };
}

/**
 * Format memory address for display
 */
export function formatMemoryReference(memoryReference?: string): string | undefined {
  if (!memoryReference) {
    return undefined;
  }

  // Already formatted
  if (memoryReference.startsWith('0x')) {
    return memoryReference;
  }

  // Try to parse as number and format
  const num = parseInt(memoryReference, 10);
  if (!isNaN(num)) {
    return '0x' + num.toString(16).padStart(8, '0');
  }

  return memoryReference;
}

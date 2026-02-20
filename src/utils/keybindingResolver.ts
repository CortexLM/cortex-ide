/**
 * Keybinding Resolver for Cortex IDE
 * Parses and evaluates keybindings with when clauses
 */

// When expression AST
export type WhenExpression =
  | { type: 'true' }
  | { type: 'false' }
  | { type: 'has'; key: string }
  | { type: 'equals'; key: string; value: string }
  | { type: 'notEquals'; key: string; value: string }
  | { type: 'regex'; key: string; pattern: RegExp }
  | { type: 'in'; key: string; value: string }
  | { type: 'not'; expr: WhenExpression }
  | { type: 'and'; exprs: WhenExpression[] }
  | { type: 'or'; exprs: WhenExpression[] };

// When context
export interface WhenContext {
  [key: string]: unknown;
}

// Token interface for lexer
interface Token {
  type: 'identifier' | 'string' | 'operator' | 'paren' | 'regex';
  value: string;
  position: number;
}

/**
 * Tokenizer for when clauses
 */
function tokenizeWhen(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  const skipWhitespace = () => {
    while (pos < input.length && /\s/.test(input[pos])) {
      pos++;
    }
  };

  const readString = (quote: string): string => {
    let result = '';
    pos++; // skip opening quote
    while (pos < input.length && input[pos] !== quote) {
      if (input[pos] === '\\' && pos + 1 < input.length) {
        pos++;
        const escapeChar = input[pos];
        switch (escapeChar) {
          case 'n': result += '\n'; break;
          case 't': result += '\t'; break;
          case 'r': result += '\r'; break;
          case '\\': result += '\\'; break;
          case "'": result += "'"; break;
          case '"': result += '"'; break;
          default: result += escapeChar;
        }
      } else {
        result += input[pos];
      }
      pos++;
    }
    pos++; // skip closing quote
    return result;
  };

  const readRegex = (): string => {
    let result = '';
    pos++; // skip opening /
    while (pos < input.length && input[pos] !== '/') {
      if (input[pos] === '\\' && pos + 1 < input.length) {
        result += input[pos] + input[pos + 1];
        pos += 2;
      } else {
        result += input[pos];
        pos++;
      }
    }
    pos++; // skip closing /
    // Read flags
    while (pos < input.length && /[gimsuy]/.test(input[pos])) {
      result += input[pos];
      pos++;
    }
    return result;
  };

  const readIdentifier = (): string => {
    let result = '';
    while (pos < input.length && /[a-zA-Z0-9_.\-:]/.test(input[pos])) {
      result += input[pos];
      pos++;
    }
    return result;
  };

  while (pos < input.length) {
    skipWhitespace();
    if (pos >= input.length) break;

    const startPos = pos;
    const char = input[pos];

    // Parentheses
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char, position: startPos });
      pos++;
      continue;
    }

    // String literals
    if (char === "'" || char === '"') {
      const value = readString(char);
      tokens.push({ type: 'string', value, position: startPos });
      continue;
    }

    // Regex (after =~ operator)
    if (char === '/' && tokens.length > 0 && 
        tokens[tokens.length - 1].type === 'operator' && 
        (tokens[tokens.length - 1].value === '=~' || tokens[tokens.length - 1].value === '!~')) {
      const value = readRegex();
      tokens.push({ type: 'regex', value, position: startPos });
      continue;
    }

    // Operators (multi-character first)
    let foundOp = false;
    for (const op of ['==', '!=', '=~', '!~', '&&', '||']) {
      if (input.slice(pos, pos + op.length) === op) {
        tokens.push({ type: 'operator', value: op, position: startPos });
        pos += op.length;
        foundOp = true;
        break;
      }
    }
    if (foundOp) continue;

    // Single character operators
    if (char === '!') {
      tokens.push({ type: 'operator', value: '!', position: startPos });
      pos++;
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      const value = readIdentifier();
      // Check for keyword operators
      if (value === 'in' || value === 'not') {
        tokens.push({ type: 'operator', value, position: startPos });
      } else if (value === 'true' || value === 'false') {
        tokens.push({ type: 'identifier', value, position: startPos });
      } else {
        tokens.push({ type: 'identifier', value, position: startPos });
      }
      continue;
    }

    // Unknown character, skip
    pos++;
  }

  return tokens;
}

/**
 * Parser class for when clauses
 */
class WhenParser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private match(type: Token['type'], value?: string): boolean {
    const token = this.current();
    if (!token) return false;
    if (token.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    return true;
  }

  private expect(type: Token['type'], value?: string): Token {
    const token = this.advance();
    if (!token) {
      throw new Error(`Unexpected end of input, expected ${type}${value ? ` '${value}'` : ''}`);
    }
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''}, got ${token.type} '${token.value}'`);
    }
    return token;
  }

  parse(): WhenExpression {
    if (this.tokens.length === 0) {
      return { type: 'true' };
    }
    const expr = this.parseOr();
    if (this.current()) {
      throw new Error(`Unexpected token: ${this.current()!.value}`);
    }
    return expr;
  }

  private parseOr(): WhenExpression {
    let left = this.parseAnd();

    while (this.match('operator', '||')) {
      this.advance();
      const right = this.parseAnd();
      if (left.type === 'or') {
        left.exprs.push(right);
      } else {
        left = { type: 'or', exprs: [left, right] };
      }
    }

    return left;
  }

  private parseAnd(): WhenExpression {
    let left = this.parseUnary();

    while (this.match('operator', '&&')) {
      this.advance();
      const right = this.parseUnary();
      if (left.type === 'and') {
        left.exprs.push(right);
      } else {
        left = { type: 'and', exprs: [left, right] };
      }
    }

    return left;
  }

  private parseUnary(): WhenExpression {
    if (this.match('operator', '!')) {
      this.advance();
      const expr = this.parseUnary();
      return { type: 'not', expr };
    }

    if (this.match('operator', 'not')) {
      this.advance();
      const expr = this.parseUnary();
      return { type: 'not', expr };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): WhenExpression {
    // Parenthesized expression
    if (this.match('paren', '(')) {
      this.advance();
      const expr = this.parseOr();
      this.expect('paren', ')');
      return expr;
    }

    // Boolean literals
    if (this.match('identifier', 'true')) {
      this.advance();
      return { type: 'true' };
    }

    if (this.match('identifier', 'false')) {
      this.advance();
      return { type: 'false' };
    }

    // Identifier-based expressions
    if (this.match('identifier')) {
      const key = this.advance()!.value;

      // Check for comparison operators
      if (this.match('operator', '==')) {
        this.advance();
        const value = this.parseValue();
        return { type: 'equals', key, value };
      }

      if (this.match('operator', '!=')) {
        this.advance();
        const value = this.parseValue();
        return { type: 'notEquals', key, value };
      }

      if (this.match('operator', '=~')) {
        this.advance();
        const pattern = this.parseRegex();
        return { type: 'regex', key, pattern };
      }

      if (this.match('operator', '!~')) {
        this.advance();
        const pattern = this.parseRegex();
        return { type: 'not', expr: { type: 'regex', key, pattern } };
      }

      if (this.match('operator', 'in')) {
        this.advance();
        const value = this.parseValue();
        return { type: 'in', key, value };
      }

      if (this.match('operator', 'not')) {
        this.advance();
        if (this.match('operator', 'in')) {
          this.advance();
          const value = this.parseValue();
          return { type: 'not', expr: { type: 'in', key, value } };
        }
        throw new Error("Expected 'in' after 'not'");
      }

      // Just a key (has expression)
      return { type: 'has', key };
    }

    throw new Error(`Unexpected token: ${this.current()?.value ?? 'end of input'}`);
  }

  private parseValue(): string {
    if (this.match('string')) {
      return this.advance()!.value;
    }
    if (this.match('identifier')) {
      return this.advance()!.value;
    }
    throw new Error(`Expected value, got ${this.current()?.type ?? 'end of input'}`);
  }

  private parseRegex(): RegExp {
    if (this.match('regex')) {
      const value = this.advance()!.value;
      // Parse regex with flags
      const lastSlash = value.lastIndexOf('/');
      if (lastSlash === -1) {
        return new RegExp(value);
      }
      const pattern = value;
      const flagMatch = pattern.match(/([gimsuy]*)$/);
      const flags = flagMatch ? flagMatch[1] : '';
      const regexBody = flags ? pattern.slice(0, -flags.length) : pattern;
      return new RegExp(regexBody, flags);
    }
    if (this.match('string')) {
      return new RegExp(this.advance()!.value);
    }
    throw new Error(`Expected regex, got ${this.current()?.type ?? 'end of input'}`);
  }
}

/**
 * Parse a when clause string into AST
 */
export function parseWhenClause(when: string): WhenExpression {
  if (!when || when.trim() === '') {
    return { type: 'true' };
  }

  const tokens = tokenizeWhen(when);
  const parser = new WhenParser(tokens);
  return parser.parse();
}

/**
 * Evaluate a when expression against a context
 */
export function evaluateWhen(expr: WhenExpression, context: WhenContext): boolean {
  switch (expr.type) {
    case 'true':
      return true;

    case 'false':
      return false;

    case 'has': {
      const value = getContextValue(context, expr.key);
      return value !== undefined && value !== null && value !== false && value !== '';
    }

    case 'equals': {
      const value = getContextValue(context, expr.key);
      return String(value) === expr.value;
    }

    case 'notEquals': {
      const value = getContextValue(context, expr.key);
      return String(value) !== expr.value;
    }

    case 'regex': {
      const value = getContextValue(context, expr.key);
      if (value === undefined || value === null) return false;
      return expr.pattern.test(String(value));
    }

    case 'in': {
      const keyValue = getContextValue(context, expr.key);
      const containerValue = getContextValue(context, expr.value);
      if (Array.isArray(containerValue)) {
        return containerValue.includes(keyValue);
      }
      if (typeof containerValue === 'object' && containerValue !== null) {
        return String(keyValue) in containerValue;
      }
      if (typeof containerValue === 'string') {
        return containerValue.includes(String(keyValue));
      }
      return false;
    }

    case 'not':
      return !evaluateWhen(expr.expr, context);

    case 'and':
      return expr.exprs.every(e => evaluateWhen(e, context));

    case 'or':
      return expr.exprs.some(e => evaluateWhen(e, context));

    default:
      return false;
  }
}

/**
 * Get value from context supporting dot notation
 */
function getContextValue(context: WhenContext, key: string): unknown {
  // Handle dot notation for nested properties
  const parts = key.split('.');
  let value: unknown = context;

  for (const part of parts) {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'object') {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Serialize when expression back to string
 */
export function serializeWhen(expr: WhenExpression): string {
  switch (expr.type) {
    case 'true':
      return 'true';

    case 'false':
      return 'false';

    case 'has':
      return expr.key;

    case 'equals':
      return `${expr.key} == '${escapeString(expr.value)}'`;

    case 'notEquals':
      return `${expr.key} != '${escapeString(expr.value)}'`;

    case 'regex':
      return `${expr.key} =~ /${expr.pattern.source}/${expr.pattern.flags}`;

    case 'in':
      return `${expr.key} in ${expr.value}`;

    case 'not': {
      const inner = serializeWhen(expr.expr);
      // Check if it's a regex negation
      if (expr.expr.type === 'regex') {
        return `${expr.expr.key} !~ /${expr.expr.pattern.source}/${expr.expr.pattern.flags}`;
      }
      // Check if it's an 'in' negation
      if (expr.expr.type === 'in') {
        return `${expr.expr.key} not in ${expr.expr.value}`;
      }
      // Wrap in parentheses if complex
      if (expr.expr.type === 'and' || expr.expr.type === 'or') {
        return `!(${inner})`;
      }
      return `!${inner}`;
    }

    case 'and':
      return expr.exprs.map(e => {
        const s = serializeWhen(e);
        return e.type === 'or' ? `(${s})` : s;
      }).join(' && ');

    case 'or':
      return expr.exprs.map(e => serializeWhen(e)).join(' || ');

    default:
      return '';
  }
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

// Keybinding types
export interface ParsedKeybinding {
  parts: KeybindingPart[];
  isChord: boolean;
}

export interface KeybindingPart {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  keyCode: string;
}

// Key code mapping
const KEY_CODE_MAP: Record<string, string> = {
  // Letters are handled dynamically
  'backspace': 'Backspace',
  'tab': 'Tab',
  'enter': 'Enter',
  'return': 'Enter',
  'escape': 'Escape',
  'esc': 'Escape',
  'space': 'Space',
  'pageup': 'PageUp',
  'pagedown': 'PageDown',
  'end': 'End',
  'home': 'Home',
  'left': 'ArrowLeft',
  'up': 'ArrowUp',
  'right': 'ArrowRight',
  'down': 'ArrowDown',
  'insert': 'Insert',
  'delete': 'Delete',
  'del': 'Delete',
  // Function keys
  'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4',
  'f5': 'F5', 'f6': 'F6', 'f7': 'F7', 'f8': 'F8',
  'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 'f12': 'F12',
  'f13': 'F13', 'f14': 'F14', 'f15': 'F15', 'f16': 'F16',
  'f17': 'F17', 'f18': 'F18', 'f19': 'F19',
  // Numpad
  'numpad0': 'Numpad0', 'numpad1': 'Numpad1', 'numpad2': 'Numpad2',
  'numpad3': 'Numpad3', 'numpad4': 'Numpad4', 'numpad5': 'Numpad5',
  'numpad6': 'Numpad6', 'numpad7': 'Numpad7', 'numpad8': 'Numpad8',
  'numpad9': 'Numpad9',
  'numpad_multiply': 'NumpadMultiply',
  'numpad_add': 'NumpadAdd',
  'numpad_separator': 'NumpadSeparator',
  'numpad_subtract': 'NumpadSubtract',
  'numpad_decimal': 'NumpadDecimal',
  'numpad_divide': 'NumpadDivide',
  // Punctuation
  ';': 'Semicolon',
  'semicolon': 'Semicolon',
  '=': 'Equal',
  'equal': 'Equal',
  ',': 'Comma',
  'comma': 'Comma',
  '-': 'Minus',
  'minus': 'Minus',
  '.': 'Period',
  'period': 'Period',
  '/': 'Slash',
  'slash': 'Slash',
  '`': 'Backquote',
  'backquote': 'Backquote',
  '[': 'BracketLeft',
  'bracketleft': 'BracketLeft',
  '\\': 'Backslash',
  'backslash': 'Backslash',
  ']': 'BracketRight',
  'bracketright': 'BracketRight',
  "'": 'Quote',
  'quote': 'Quote',
  // Special
  'capslock': 'CapsLock',
  'numlock': 'NumLock',
  'scrolllock': 'ScrollLock',
  'pause': 'Pause',
  'break': 'Pause',
  'printscreen': 'PrintScreen',
  'contextmenu': 'ContextMenu',
};

// Modifier aliases
const MODIFIER_ALIASES: Record<string, keyof KeybindingPart> = {
  'ctrl': 'ctrlKey',
  'control': 'ctrlKey',
  'shift': 'shiftKey',
  'alt': 'altKey',
  'option': 'altKey',
  'opt': 'altKey',
  'meta': 'metaKey',
  'cmd': 'metaKey',
  'command': 'metaKey',
  'win': 'metaKey',
  'windows': 'metaKey',
  'super': 'metaKey',
};

/**
 * Parse keybinding string (e.g., "ctrl+shift+p", "cmd+k cmd+s")
 */
export function parseKeybinding(keybinding: string): ParsedKeybinding {
  const normalizedInput = keybinding.trim().toLowerCase();
  
  // Split by space for chord keybindings
  const chordParts = normalizedInput.split(/\s+/);
  const parts: KeybindingPart[] = [];

  for (const chord of chordParts) {
    const part = parseKeybindingPart(chord);
    parts.push(part);
  }

  return {
    parts,
    isChord: parts.length > 1,
  };
}

/**
 * Parse a single keybinding part
 */
function parseKeybindingPart(part: string): KeybindingPart {
  const result: KeybindingPart = {
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    keyCode: '',
  };

  // Split by + but handle special cases like "ctrl++"
  const keys: string[] = [];
  let current = '';
  let i = 0;

  while (i < part.length) {
    if (part[i] === '+') {
      if (current) {
        keys.push(current);
        current = '';
      } else if (i + 1 < part.length && part[i + 1] === '+') {
        // Handle ++ case
        keys.push('+');
        i++;
      }
    } else {
      current += part[i];
    }
    i++;
  }
  if (current) {
    keys.push(current);
  }

  // Process each key
  for (const key of keys) {
    const lowKey = key.toLowerCase();

    // Check if it's a modifier
    if (MODIFIER_ALIASES[lowKey]) {
      const modKey = MODIFIER_ALIASES[lowKey];
      (result as unknown as Record<string, boolean>)[modKey] = true;
    } else {
      // It's the main key
      result.keyCode = normalizeKeyCode(lowKey);
    }
  }

  return result;
}

/**
 * Normalize a key code
 */
function normalizeKeyCode(key: string): string {
  const lowKey = key.toLowerCase();

  // Check map
  if (KEY_CODE_MAP[lowKey]) {
    return KEY_CODE_MAP[lowKey];
  }

  // Single letter
  if (lowKey.length === 1 && /[a-z]/.test(lowKey)) {
    return `Key${lowKey.toUpperCase()}`;
  }

  // Single digit
  if (lowKey.length === 1 && /[0-9]/.test(lowKey)) {
    return `Digit${lowKey}`;
  }

  // Return as-is (capitalize first letter)
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Normalize keybinding for comparison
 */
export function normalizeKeybinding(keybinding: string): string {
  const parsed = parseKeybinding(keybinding);
  return parsed.parts.map(part => {
    const modifiers: string[] = [];
    if (part.ctrlKey) modifiers.push('ctrl');
    if (part.shiftKey) modifiers.push('shift');
    if (part.altKey) modifiers.push('alt');
    if (part.metaKey) modifiers.push('meta');
    modifiers.push(part.keyCode.toLowerCase());
    return modifiers.join('+');
  }).join(' ');
}

/**
 * Convert keybinding to platform-specific string
 */
export function keybindingToString(
  parsed: ParsedKeybinding,
  platform: 'windows' | 'mac' | 'linux'
): string {
  return parsed.parts.map(part => {
    const keys: string[] = [];

    if (platform === 'mac') {
      if (part.ctrlKey) keys.push('\u2303'); // Control
      if (part.altKey) keys.push('\u2325'); // Option
      if (part.shiftKey) keys.push('\u21E7'); // Shift
      if (part.metaKey) keys.push('\u2318'); // Command
    } else {
      if (part.ctrlKey) keys.push('Ctrl');
      if (part.altKey) keys.push('Alt');
      if (part.shiftKey) keys.push('Shift');
      if (part.metaKey) keys.push(platform === 'windows' ? 'Win' : 'Super');
    }

    // Convert key code to display string
    const displayKey = keyCodeToDisplayString(part.keyCode, platform);
    keys.push(displayKey);

    return platform === 'mac' ? keys.join('') : keys.join('+');
  }).join(' ');
}

/**
 * Convert key code to display string
 */
function keyCodeToDisplayString(keyCode: string, platform: 'windows' | 'mac' | 'linux'): string {
  // Handle special keys
  const specialKeys: Record<string, { mac: string; other: string }> = {
    'Backspace': { mac: '\u232B', other: 'Backspace' },
    'Tab': { mac: '\u21E5', other: 'Tab' },
    'Enter': { mac: '\u21A9', other: 'Enter' },
    'Escape': { mac: '\u238B', other: 'Esc' },
    'Space': { mac: 'Space', other: 'Space' },
    'PageUp': { mac: '\u21DE', other: 'PgUp' },
    'PageDown': { mac: '\u21DF', other: 'PgDn' },
    'End': { mac: '\u2198', other: 'End' },
    'Home': { mac: '\u2196', other: 'Home' },
    'ArrowLeft': { mac: '\u2190', other: '\u2190' },
    'ArrowUp': { mac: '\u2191', other: '\u2191' },
    'ArrowRight': { mac: '\u2192', other: '\u2192' },
    'ArrowDown': { mac: '\u2193', other: '\u2193' },
    'Delete': { mac: '\u2326', other: 'Del' },
  };

  if (specialKeys[keyCode]) {
    return platform === 'mac' ? specialKeys[keyCode].mac : specialKeys[keyCode].other;
  }

  // Handle Key* codes
  if (keyCode.startsWith('Key')) {
    return keyCode.slice(3);
  }

  // Handle Digit* codes
  if (keyCode.startsWith('Digit')) {
    return keyCode.slice(5);
  }

  // Handle function keys
  if (/^F\d+$/.test(keyCode)) {
    return keyCode;
  }

  return keyCode;
}

/**
 * Match keyboard event to keybinding
 */
export function matchKeyboardEvent(
  event: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; code: string; key: string },
  binding: ParsedKeybinding,
  chordIndex: number = 0
): boolean {
  if (chordIndex >= binding.parts.length) {
    return false;
  }

  const part = binding.parts[chordIndex];

  // Match modifiers
  if (part.ctrlKey !== event.ctrlKey) return false;
  if (part.shiftKey !== event.shiftKey) return false;
  if (part.altKey !== event.altKey) return false;
  if (part.metaKey !== event.metaKey) return false;

  // Match key code
  const eventCode = event.code;
  const bindingCode = part.keyCode;

  // Direct match
  if (eventCode === bindingCode) return true;

  // Case-insensitive match
  if (eventCode.toLowerCase() === bindingCode.toLowerCase()) return true;

  // Try matching with Key prefix
  if (eventCode.startsWith('Key') && eventCode.slice(3).toLowerCase() === bindingCode.toLowerCase()) {
    return true;
  }

  // Try matching the key value for special characters
  if (event.key.toLowerCase() === bindingCode.toLowerCase()) return true;

  return false;
}

// Keybinding entry interface
export interface KeybindingEntry {
  key: string;
  command: string;
  when?: string;
  args?: unknown;
  source?: 'default' | 'user' | 'extension';
}

/**
 * Detect keybinding conflicts
 */
export interface KeybindingConflict {
  keybinding: string;
  conflictingCommands: Array<{
    command: string;
    when?: string;
    source: 'default' | 'user' | 'extension';
  }>;
  conflictType: 'exact' | 'shadow'; // shadow = more specific when clause shadows
}

export function detectConflicts(
  keybindings: Array<{
    key: string;
    command: string;
    when?: string;
    source: 'default' | 'user' | 'extension';
  }>
): KeybindingConflict[] {
  const conflicts: KeybindingConflict[] = [];
  const byKey = new Map<string, typeof keybindings>();

  // Group by normalized key
  for (const binding of keybindings) {
    const normalizedKey = normalizeKeybinding(binding.key);
    if (!byKey.has(normalizedKey)) {
      byKey.set(normalizedKey, []);
    }
    byKey.get(normalizedKey)!.push(binding);
  }

  // Find conflicts
  for (const [key, bindings] of byKey) {
    if (bindings.length <= 1) continue;

    // Check for exact conflicts (same or overlapping when clauses)
    const exactConflicts: typeof bindings = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < bindings.length; i++) {
      for (let j = i + 1; j < bindings.length; j++) {
        const pairKey = `${i}:${j}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const a = bindings[i];
        const b = bindings[j];

        const relationship = compareWhenClauses(a.when, b.when);

        if (relationship === 'equivalent' || relationship === 'overlapping') {
          if (!exactConflicts.includes(a)) exactConflicts.push(a);
          if (!exactConflicts.includes(b)) exactConflicts.push(b);
        }
      }
    }

    if (exactConflicts.length > 0) {
      conflicts.push({
        keybinding: key,
        conflictingCommands: exactConflicts.map(b => ({
          command: b.command,
          when: b.when,
          source: b.source,
        })),
        conflictType: 'exact',
      });
    }

    // Check for shadow conflicts (more specific when shadows less specific)
    const shadowConflicts: typeof bindings = [];
    for (let i = 0; i < bindings.length; i++) {
      for (let j = 0; j < bindings.length; j++) {
        if (i === j) continue;

        const a = bindings[i];
        const b = bindings[j];

        const relationship = compareWhenClauses(a.when, b.when);
        if (relationship === 'subset') {
          // a is more specific than b, might shadow
          if (!shadowConflicts.includes(a)) shadowConflicts.push(a);
          if (!shadowConflicts.includes(b)) shadowConflicts.push(b);
        }
      }
    }

    // Only add shadow conflicts if they're different from exact conflicts
    if (shadowConflicts.length > 0 && exactConflicts.length === 0) {
      conflicts.push({
        keybinding: key,
        conflictingCommands: shadowConflicts.map(b => ({
          command: b.command,
          when: b.when,
          source: b.source,
        })),
        conflictType: 'shadow',
      });
    }
  }

  return conflicts;
}

/**
 * Compare two when clauses
 * Returns: 'equivalent' | 'subset' | 'superset' | 'overlapping' | 'disjoint'
 */
function compareWhenClauses(
  whenA: string | undefined,
  whenB: string | undefined
): 'equivalent' | 'subset' | 'superset' | 'overlapping' | 'disjoint' {
  // Both undefined or empty = equivalent
  if ((!whenA || whenA.trim() === '') && (!whenB || whenB.trim() === '')) {
    return 'equivalent';
  }

  // One undefined = superset/subset relationship
  if (!whenA || whenA.trim() === '') {
    return 'superset'; // A matches everything, B is more specific
  }
  if (!whenB || whenB.trim() === '') {
    return 'subset'; // B matches everything, A is more specific
  }

  // Parse both
  try {
    const exprA = parseWhenClause(whenA);
    const exprB = parseWhenClause(whenB);

    const keysA = extractKeys(exprA);
    const keysB = extractKeys(exprB);

    // Check key overlap
    const commonKeys = keysA.filter(k => keysB.includes(k));

    if (commonKeys.length === 0) {
      // No common keys - could overlap in any context
      return 'overlapping';
    }

    // Same keys used
    if (keysA.length === keysB.length && commonKeys.length === keysA.length) {
      // Check if serialized forms are equivalent
      const serializedA = serializeWhen(exprA);
      const serializedB = serializeWhen(exprB);
      if (serializedA === serializedB) {
        return 'equivalent';
      }
    }

    // A uses subset of B's keys = A is more general
    if (keysA.every(k => keysB.includes(k)) && keysB.length > keysA.length) {
      return 'superset';
    }

    // B uses subset of A's keys = B is more general
    if (keysB.every(k => keysA.includes(k)) && keysA.length > keysB.length) {
      return 'subset';
    }

    // Default to overlapping
    return 'overlapping';
  } catch {
    // Parse error - assume overlapping
    return 'overlapping';
  }
}

/**
 * Extract context keys from when expression
 */
function extractKeys(expr: WhenExpression): string[] {
  const keys: string[] = [];

  function visit(e: WhenExpression) {
    switch (e.type) {
      case 'has':
      case 'equals':
      case 'notEquals':
      case 'regex':
        keys.push(e.key);
        break;
      case 'in':
        keys.push(e.key);
        keys.push(e.value);
        break;
      case 'not':
        visit(e.expr);
        break;
      case 'and':
      case 'or':
        e.exprs.forEach(visit);
        break;
    }
  }

  visit(expr);
  return [...new Set(keys)];
}

/**
 * Get the winning keybinding for a key press
 */
export function resolveKeybinding(
  pressedKey: ParsedKeybinding,
  keybindings: Array<{
    key: string;
    command: string;
    when?: string;
    args?: unknown;
  }>,
  context: WhenContext
): { command: string; args?: unknown } | undefined {
  // Filter to matching keybindings
  const matching = keybindings.filter(binding => {
    const parsed = parseKeybinding(binding.key);
    
    // Must have same number of chord parts
    if (parsed.parts.length !== pressedKey.parts.length) {
      return false;
    }

    // All parts must match
    for (let i = 0; i < parsed.parts.length; i++) {
      const a = parsed.parts[i];
      const b = pressedKey.parts[i];

      if (a.ctrlKey !== b.ctrlKey ||
          a.shiftKey !== b.shiftKey ||
          a.altKey !== b.altKey ||
          a.metaKey !== b.metaKey ||
          a.keyCode.toLowerCase() !== b.keyCode.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  if (matching.length === 0) {
    return undefined;
  }

  // Filter by when clause evaluation
  const applicable = matching.filter(binding => {
    if (!binding.when) {
      return true;
    }
    try {
      const expr = parseWhenClause(binding.when);
      return evaluateWhen(expr, context);
    } catch {
      return false;
    }
  });

  if (applicable.length === 0) {
    return undefined;
  }

  // Sort by specificity (most specific first)
  const sorted = sortBySpecificity(applicable);

  const winner = sorted[0];
  return {
    command: winner.command,
    args: winner.args,
  };
}

/**
 * Sort keybindings by specificity (more specific when = higher priority)
 */
export function sortBySpecificity<T extends { when?: string }>(keybindings: T[]): T[] {
  return [...keybindings].sort((a, b) => {
    const specA = calculateSpecificity(a.when);
    const specB = calculateSpecificity(b.when);
    return specB - specA; // Higher specificity first
  });
}

/**
 * Calculate when clause specificity
 * Higher number = more specific
 */
function calculateSpecificity(when: string | undefined): number {
  if (!when || when.trim() === '') {
    return 0;
  }

  try {
    const expr = parseWhenClause(when);
    return calculateExpressionSpecificity(expr);
  } catch {
    return 0;
  }
}

/**
 * Calculate specificity of a when expression
 */
function calculateExpressionSpecificity(expr: WhenExpression): number {
  switch (expr.type) {
    case 'true':
      return 0;
    case 'false':
      return 0;
    case 'has':
      return 1;
    case 'equals':
      return 2; // More specific than just 'has'
    case 'notEquals':
      return 2;
    case 'regex':
      return 3; // Even more specific
    case 'in':
      return 2;
    case 'not':
      return calculateExpressionSpecificity(expr.expr);
    case 'and':
      // Sum of all expressions (more conditions = more specific)
      return expr.exprs.reduce((sum, e) => sum + calculateExpressionSpecificity(e), 0);
    case 'or':
      // Average (disjunction is less specific)
      return Math.floor(
        expr.exprs.reduce((sum, e) => sum + calculateExpressionSpecificity(e), 0) / expr.exprs.length
      );
    default:
      return 0;
  }
}

/**
 * Create a chord state tracker for multi-key bindings
 */
export interface ChordState {
  active: boolean;
  parts: KeybindingPart[];
  startTime: number;
  timeout: number;
}

export function createChordTracker(timeout: number = 1000): {
  state: ChordState;
  handleKeyPress: (
    event: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; code: string; key: string },
    keybindings: Array<{ key: string; command: string; when?: string; args?: unknown }>,
    context: WhenContext
  ) => { command: string; args?: unknown } | 'pending' | undefined;
  reset: () => void;
} {
  const state: ChordState = {
    active: false,
    parts: [],
    startTime: 0,
    timeout,
  };

  const reset = () => {
    state.active = false;
    state.parts = [];
    state.startTime = 0;
  };

  const handleKeyPress = (
    event: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; code: string; key: string },
    keybindings: Array<{ key: string; command: string; when?: string; args?: unknown }>,
    context: WhenContext
  ): { command: string; args?: unknown } | 'pending' | undefined => {
    const now = Date.now();

    // Check timeout
    if (state.active && now - state.startTime > state.timeout) {
      reset();
    }

    // Create current pressed key
    const currentPart: KeybindingPart = {
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      keyCode: event.code,
    };

    // Build current chord
    const currentChord: ParsedKeybinding = {
      parts: [...state.parts, currentPart],
      isChord: state.parts.length > 0,
    };

    // Try to resolve
    const result = resolveKeybinding(currentChord, keybindings, context);

    if (result) {
      reset();
      return result;
    }

    // Check if this could be a chord prefix
    const potentialChords = keybindings.filter(binding => {
      const parsed = parseKeybinding(binding.key);
      if (parsed.parts.length <= currentChord.parts.length) {
        return false;
      }

      // Check if current chord matches prefix
      for (let i = 0; i < currentChord.parts.length; i++) {
        const a = parsed.parts[i];
        const b = currentChord.parts[i];
        if (a.ctrlKey !== b.ctrlKey ||
            a.shiftKey !== b.shiftKey ||
            a.altKey !== b.altKey ||
            a.metaKey !== b.metaKey ||
            a.keyCode.toLowerCase() !== b.keyCode.toLowerCase()) {
          return false;
        }
      }

      // Also check when clause
      if (binding.when) {
        try {
          const expr = parseWhenClause(binding.when);
          if (!evaluateWhen(expr, context)) {
            return false;
          }
        } catch {
          return false;
        }
      }

      return true;
    });

    if (potentialChords.length > 0) {
      // Start or continue chord
      if (!state.active) {
        state.startTime = now;
      }
      state.active = true;
      state.parts = currentChord.parts;
      return 'pending';
    }

    // No match
    reset();
    return undefined;
  };

  return { state, handleKeyPress, reset };
}

/**
 * Check if a keybinding matches a command
 */
export function findKeybindingsForCommand(
  command: string,
  keybindings: Array<{ key: string; command: string; when?: string }>,
  context?: WhenContext
): string[] {
  return keybindings
    .filter(binding => {
      if (binding.command !== command) return false;
      if (context && binding.when) {
        try {
          const expr = parseWhenClause(binding.when);
          return evaluateWhen(expr, context);
        } catch {
          return false;
        }
      }
      return true;
    })
    .map(binding => binding.key);
}

/**
 * Merge keybindings from multiple sources
 * User keybindings override defaults, negated commands remove bindings
 */
export function mergeKeybindings(
  defaultBindings: Array<{ key: string; command: string; when?: string; args?: unknown }>,
  userBindings: Array<{ key: string; command: string; when?: string; args?: unknown }>
): Array<{ key: string; command: string; when?: string; args?: unknown; source: 'default' | 'user' }> {
  const result: Array<{ key: string; command: string; when?: string; args?: unknown; source: 'default' | 'user' }> = [];

  // Add all default bindings
  for (const binding of defaultBindings) {
    result.push({ ...binding, source: 'default' });
  }

  // Process user bindings
  for (const binding of userBindings) {
    if (binding.command.startsWith('-')) {
      // Negated command - remove matching default bindings
      const commandToRemove = binding.command.slice(1);
      const normalizedKey = normalizeKeybinding(binding.key);

      for (let i = result.length - 1; i >= 0; i--) {
        const existing = result[i];
        if (existing.command === commandToRemove &&
            normalizeKeybinding(existing.key) === normalizedKey) {
          // Check when clause if specified
          if (!binding.when || binding.when === existing.when) {
            result.splice(i, 1);
          }
        }
      }
    } else {
      // Regular binding - add/override
      result.push({ ...binding, source: 'user' });
    }
  }

  return result;
}

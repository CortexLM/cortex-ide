/**
 * Find & Replace Utilities for Cortex IDE
 * Regex, case-sensitive, whole word, preserve case replacement
 */

// Find state
export interface FindState {
  searchString: string;
  replaceString: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  searchInSelection: boolean;
  preserveCase: boolean;
  matchesCount: number;
  currentMatch: number;
}

// Find match
export interface FindMatch {
  range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  matches: string[]; // Capture groups for regex
}

// Find options
export interface FindOptions {
  isRegex?: boolean;
  isCaseSensitive?: boolean;
  isWholeWord?: boolean;
  searchInSelection?: boolean;
  selectionRange?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
}

// Case pattern type
type CasePattern = 'lower' | 'upper' | 'title' | 'mixed';

// Search history management
export interface SearchHistory {
  searches: string[];
  replaces: string[];
  maxItems: number;
}

/**
 * Escape special regex characters
 */
export function escapeRegexSpecialChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build whole word regex pattern
 */
export function buildWholeWordPattern(word: string): string {
  return `\\b${word}\\b`;
}

/**
 * Validate regex pattern
 */
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid regex pattern' };
  }
}

/**
 * Get regex flags from options
 */
function getRegexFlags(options: FindOptions): string {
  let flags = 'g'; // Always global for findAll
  if (!options.isCaseSensitive) {
    flags += 'i';
  }
  return flags;
}

/**
 * Build search regex from pattern and options
 */
export function buildSearchRegex(
  searchString: string,
  options: FindOptions
): RegExp | null {
  if (!searchString) {
    return null;
  }

  try {
    let pattern: string;

    if (options.isRegex) {
      pattern = searchString;
    } else {
      pattern = escapeRegexSpecialChars(searchString);
    }

    if (options.isWholeWord && !options.isRegex) {
      pattern = buildWholeWordPattern(pattern);
    } else if (options.isWholeWord && options.isRegex) {
      // For regex with whole word, wrap in word boundaries
      pattern = `\\b(?:${pattern})\\b`;
    }

    const flags = getRegexFlags(options);
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/**
 * Detect case pattern of text
 */
function detectCasePattern(text: string): CasePattern {
  if (!text || text.length === 0) {
    return 'mixed';
  }

  const hasLower = /[a-z]/.test(text);
  const hasUpper = /[A-Z]/.test(text);

  if (!hasLower && !hasUpper) {
    return 'mixed'; // No letters
  }

  if (hasUpper && !hasLower) {
    return 'upper';
  }

  if (hasLower && !hasUpper) {
    return 'lower';
  }

  // Has both - check for title case (first letter upper, rest lower)
  if (text[0] === text[0].toUpperCase() && text.slice(1) === text.slice(1).toLowerCase()) {
    return 'title';
  }

  return 'mixed';
}

/**
 * Apply case pattern to text
 */
function applyCasePattern(text: string, pattern: CasePattern): string {
  switch (pattern) {
    case 'lower':
      return text.toLowerCase();
    case 'upper':
      return text.toUpperCase();
    case 'title':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case 'mixed':
    default:
      return text;
  }
}

/**
 * Preserve case in replacement
 * - "foo" -> "bar" becomes "FOO" -> "BAR", "Foo" -> "Bar"
 */
export function preserveCaseReplace(original: string, replacement: string): string {
  if (!original || !replacement) {
    return replacement;
  }

  const pattern = detectCasePattern(original);
  
  if (pattern === 'mixed') {
    // For mixed case, try character-by-character matching
    let result = '';
    for (let i = 0; i < replacement.length; i++) {
      const origChar = i < original.length ? original[i] : original[original.length - 1];
      const replChar = replacement[i];
      
      if (/[a-zA-Z]/.test(replChar)) {
        if (origChar === origChar.toUpperCase() && /[a-zA-Z]/.test(origChar)) {
          result += replChar.toUpperCase();
        } else {
          result += replChar.toLowerCase();
        }
      } else {
        result += replChar;
      }
    }
    return result;
  }

  return applyCasePattern(replacement, pattern);
}

/**
 * Parse replace pattern for capture groups ($1, $2, etc.)
 */
export function parseReplacePattern(pattern: string): Array<{ type: 'text' | 'group'; value: string | number }> {
  const result: Array<{ type: 'text' | 'group'; value: string | number }> = [];
  const regex = /\$(\d+|\$|&|`|')/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(pattern)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push({ type: 'text', value: pattern.slice(lastIndex, match.index) });
    }

    const captured = match[1];
    if (captured === '$') {
      // $$ -> literal $
      result.push({ type: 'text', value: '$' });
    } else if (captured === '&') {
      // $& -> entire match (group 0)
      result.push({ type: 'group', value: 0 });
    } else if (captured === '`' || captured === "'") {
      // $` and $' not commonly needed, treat as text
      result.push({ type: 'text', value: '$' + captured });
    } else {
      // $1, $2, etc.
      result.push({ type: 'group', value: parseInt(captured, 10) });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < pattern.length) {
    result.push({ type: 'text', value: pattern.slice(lastIndex) });
  }

  return result;
}

/**
 * Build replacement string (with capture groups for regex)
 */
export function buildReplacementString(
  replacePattern: string,
  match: FindMatch,
  options: { preserveCase?: boolean }
): string {
  const parts = parseReplacePattern(replacePattern);
  let result = '';

  for (const part of parts) {
    if (part.type === 'text') {
      result += part.value;
    } else {
      // Group reference
      const groupIndex = part.value as number;
      const groupValue = match.matches[groupIndex] ?? '';
      result += groupValue;
    }
  }

  if (options.preserveCase && match.matches[0]) {
    result = preserveCaseReplace(match.matches[0], result);
  }

  return result;
}

/**
 * Find all matches in text
 */
export function findAllMatches(
  text: string,
  searchString: string,
  options: FindOptions
): FindMatch[] {
  const regex = buildSearchRegex(searchString, options);
  if (!regex) {
    return [];
  }

  const matches: FindMatch[] = [];
  const lines = text.split('\n');
  let lineOffset = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    // Check if line is within selection range
    if (options.searchInSelection && options.selectionRange) {
      const sel = options.selectionRange;
      if (lineIndex < sel.startLine || lineIndex > sel.endLine) {
        lineOffset += line.length + 1;
        continue;
      }
    }

    // Reset regex for each line
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      const startColumn = match.index;
      const endColumn = match.index + match[0].length;

      // Check column bounds for selection
      if (options.searchInSelection && options.selectionRange) {
        const sel = options.selectionRange;
        if (lineIndex === sel.startLine && startColumn < sel.startColumn) {
          continue;
        }
        if (lineIndex === sel.endLine && endColumn > sel.endColumn) {
          continue;
        }
      }

      matches.push({
        range: {
          startLine: lineIndex,
          startColumn,
          endLine: lineIndex,
          endColumn,
        },
        matches: Array.from(match),
      });

      // Prevent infinite loop for zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }

    lineOffset += line.length + 1;
  }

  return matches;
}

/**
 * Find matches in document (line by line)
 */
export function findMatchesInDocument(
  lines: string[],
  searchString: string,
  options: FindOptions
): FindMatch[] {
  return findAllMatches(lines.join('\n'), searchString, options);
}

/**
 * Get match at index (circular navigation)
 */
export function getMatchAtIndex(
  matches: FindMatch[],
  index: number
): FindMatch | undefined {
  if (matches.length === 0) {
    return undefined;
  }

  // Handle circular indexing
  const normalizedIndex = ((index % matches.length) + matches.length) % matches.length;
  return matches[normalizedIndex];
}

/**
 * Find next match from position
 */
export function findNextMatch(
  matches: FindMatch[],
  fromPosition: { line: number; column: number },
  wrap: boolean
): { match: FindMatch; index: number } | undefined {
  if (matches.length === 0) {
    return undefined;
  }

  // Find first match after position
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const range = match.range;

    if (
      range.startLine > fromPosition.line ||
      (range.startLine === fromPosition.line && range.startColumn >= fromPosition.column)
    ) {
      return { match, index: i };
    }
  }

  // Wrap to beginning if enabled
  if (wrap && matches.length > 0) {
    return { match: matches[0], index: 0 };
  }

  return undefined;
}

/**
 * Find previous match from position
 */
export function findPrevMatch(
  matches: FindMatch[],
  fromPosition: { line: number; column: number },
  wrap: boolean
): { match: FindMatch; index: number } | undefined {
  if (matches.length === 0) {
    return undefined;
  }

  // Find last match before position
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const range = match.range;

    if (
      range.startLine < fromPosition.line ||
      (range.startLine === fromPosition.line && range.startColumn < fromPosition.column)
    ) {
      return { match, index: i };
    }
  }

  // Wrap to end if enabled
  if (wrap && matches.length > 0) {
    const lastIndex = matches.length - 1;
    return { match: matches[lastIndex], index: lastIndex };
  }

  return undefined;
}

/**
 * Replace single match
 */
export function replaceMatch(
  text: string,
  match: FindMatch,
  replaceString: string,
  options: { isRegex?: boolean; preserveCase?: boolean }
): { newText: string; delta: number } {
  const lines = text.split('\n');
  const { startLine, startColumn, endLine, endColumn } = match.range;

  // Build replacement string with capture groups if regex
  let replacement = replaceString;
  if (options.isRegex) {
    replacement = buildReplacementString(replaceString, match, { preserveCase: options.preserveCase });
  } else if (options.preserveCase) {
    replacement = preserveCaseReplace(match.matches[0], replaceString);
  }

  // Handle single-line match
  if (startLine === endLine) {
    const line = lines[startLine];
    lines[startLine] = line.slice(0, startColumn) + replacement + line.slice(endColumn);
  } else {
    // Handle multi-line match
    const firstLine = lines[startLine];
    const lastLine = lines[endLine];
    lines[startLine] = firstLine.slice(0, startColumn) + replacement + lastLine.slice(endColumn);
    lines.splice(startLine + 1, endLine - startLine);
  }

  const originalLength = match.matches[0]?.length ?? 0;
  const delta = replacement.length - originalLength;

  return {
    newText: lines.join('\n'),
    delta,
  };
}

/**
 * Replace all matches
 */
export function replaceAllMatches(
  text: string,
  searchString: string,
  replaceString: string,
  options: FindOptions & { preserveCase?: boolean }
): { newText: string; replacements: number } {
  const regex = buildSearchRegex(searchString, options);
  if (!regex) {
    return { newText: text, replacements: 0 };
  }

  let replacements = 0;

  const newText = text.replace(regex, (fullMatch, ...args) => {
    replacements++;

    // Extract capture groups (args before the last two which are offset and string)
    const groups = [fullMatch];
    for (let i = 0; i < args.length - 2; i++) {
      if (typeof args[i] === 'string') {
        groups.push(args[i]);
      }
    }

    const fakeMatch: FindMatch = {
      range: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 },
      matches: groups,
    };

    if (options.isRegex) {
      return buildReplacementString(replaceString, fakeMatch, { preserveCase: options.preserveCase });
    } else if (options.preserveCase) {
      return preserveCaseReplace(fullMatch, replaceString);
    }

    return replaceString;
  });

  return { newText, replacements };
}

/**
 * Get match highlights for display
 */
export function getMatchHighlights(
  _lineText: string,
  matches: FindMatch[]
): Array<{ start: number; end: number }> {
  const highlights: Array<{ start: number; end: number }> = [];

  for (const match of matches) {
    // Only include matches that are on a single line
    if (match.range.startLine === match.range.endLine) {
      highlights.push({
        start: match.range.startColumn,
        end: match.range.endColumn,
      });
    }
  }

  // Sort by start position and merge overlapping highlights
  highlights.sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const highlight of highlights) {
    if (merged.length === 0) {
      merged.push(highlight);
    } else {
      const last = merged[merged.length - 1];
      if (highlight.start <= last.end) {
        // Overlapping, extend the last highlight
        last.end = Math.max(last.end, highlight.end);
      } else {
        merged.push(highlight);
      }
    }
  }

  return merged;
}

/**
 * Add to search history
 */
export function addToSearchHistory(
  history: SearchHistory,
  type: 'search' | 'replace',
  value: string
): SearchHistory {
  if (!value || value.trim() === '') {
    return history;
  }

  const list = type === 'search' ? [...history.searches] : [...history.replaces];

  // Remove existing entry if present
  const existingIndex = list.indexOf(value);
  if (existingIndex !== -1) {
    list.splice(existingIndex, 1);
  }

  // Add to front
  list.unshift(value);

  // Trim to max items
  while (list.length > history.maxItems) {
    list.pop();
  }

  return {
    ...history,
    searches: type === 'search' ? list : history.searches,
    replaces: type === 'replace' ? list : history.replaces,
  };
}

/**
 * Get search history
 */
export function getSearchHistory(
  history: SearchHistory,
  type: 'search' | 'replace'
): string[] {
  return type === 'search' ? [...history.searches] : [...history.replaces];
}

/**
 * Create default find state
 */
export function createDefaultFindState(): FindState {
  return {
    searchString: '',
    replaceString: '',
    isRegex: false,
    isCaseSensitive: false,
    isWholeWord: false,
    searchInSelection: false,
    preserveCase: false,
    matchesCount: 0,
    currentMatch: -1,
  };
}

/**
 * Create default search history
 */
export function createDefaultSearchHistory(maxItems: number = 20): SearchHistory {
  return {
    searches: [],
    replaces: [],
    maxItems,
  };
}

/**
 * Count matches without returning them (performance optimization)
 */
export function countMatches(
  text: string,
  searchString: string,
  options: FindOptions
): number {
  const regex = buildSearchRegex(searchString, options);
  if (!regex) {
    return 0;
  }

  let count = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    count++;
    // Prevent infinite loop for zero-length matches
    if (match[0].length === 0) {
      regex.lastIndex++;
    }
  }

  return count;
}

/**
 * Check if position is inside a match
 */
export function isPositionInMatch(
  position: { line: number; column: number },
  match: FindMatch
): boolean {
  const { startLine, startColumn, endLine, endColumn } = match.range;

  if (position.line < startLine || position.line > endLine) {
    return false;
  }

  if (position.line === startLine && position.column < startColumn) {
    return false;
  }

  if (position.line === endLine && position.column >= endColumn) {
    return false;
  }

  return true;
}

/**
 * Get match containing position
 */
export function getMatchAtPosition(
  matches: FindMatch[],
  position: { line: number; column: number }
): { match: FindMatch; index: number } | undefined {
  for (let i = 0; i < matches.length; i++) {
    if (isPositionInMatch(position, matches[i])) {
      return { match: matches[i], index: i };
    }
  }
  return undefined;
}

/**
 * Compare two match positions
 */
export function compareMatchPositions(a: FindMatch, b: FindMatch): number {
  if (a.range.startLine !== b.range.startLine) {
    return a.range.startLine - b.range.startLine;
  }
  return a.range.startColumn - b.range.startColumn;
}

/**
 * Sort matches by position
 */
export function sortMatchesByPosition(matches: FindMatch[]): FindMatch[] {
  return [...matches].sort(compareMatchPositions);
}

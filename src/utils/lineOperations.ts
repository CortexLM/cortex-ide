/**
 * Line Operations Utilities for Cortex IDE
 * Sort, join, transform case, duplicate, move lines
 */

// Line range
export interface LineRange {
  startLine: number;
  endLine: number;
}

// Edit result
export interface EditResult {
  lines: string[];
  cursorLine: number;
  cursorColumn: number;
}

/**
 * Helper function to validate and normalize line range
 */
function normalizeRange(lines: string[], range: LineRange): LineRange {
  const startLine = Math.max(0, Math.min(range.startLine, lines.length - 1));
  const endLine = Math.max(startLine, Math.min(range.endLine, lines.length - 1));
  return { startLine, endLine };
}

/**
 * Helper function to extract range and apply transformation
 */
function applyRangeTransformation(
  lines: string[],
  range: LineRange,
  transform: (rangeLines: string[]) => string[]
): EditResult {
  const normalizedRange = normalizeRange(lines, range);
  const { startLine, endLine } = normalizedRange;
  
  const before = lines.slice(0, startLine);
  const rangeLines = lines.slice(startLine, endLine + 1);
  const after = lines.slice(endLine + 1);
  
  const transformed = transform(rangeLines);
  const result = [...before, ...transformed, ...after];
  
  return {
    lines: result,
    cursorLine: startLine,
    cursorColumn: 0
  };
}

/**
 * Sort lines ascending
 */
export function sortLinesAscending(lines: string[], range: LineRange): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    return [...rangeLines].sort((a, b) => a.localeCompare(b));
  });
}

/**
 * Sort lines descending
 */
export function sortLinesDescending(lines: string[], range: LineRange): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    return [...rangeLines].sort((a, b) => b.localeCompare(a));
  });
}

/**
 * Sort lines case-insensitive
 */
export function sortLinesCaseInsensitive(
  lines: string[],
  range: LineRange,
  descending: boolean = false
): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    const sorted = [...rangeLines].sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    return descending ? sorted.reverse() : sorted;
  });
}

/**
 * Sort lines by line length
 */
export function sortLinesByLength(
  lines: string[],
  range: LineRange,
  descending: boolean = false
): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    const sorted = [...rangeLines].sort((a, b) => a.length - b.length);
    return descending ? sorted.reverse() : sorted;
  });
}

/**
 * Natural sort comparator
 * Handles numbers properly: "item2" < "item10"
 */
function naturalCompare(a: string, b: string): number {
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];
  
  const maxLen = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLen; i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      // Both are numbers
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    } else {
      // At least one is not a number, compare as strings
      const cmp = aPart.localeCompare(bPart);
      if (cmp !== 0) {
        return cmp;
      }
    }
  }
  
  return 0;
}

/**
 * Natural sort (handles numbers properly)
 */
export function sortLinesNatural(
  lines: string[],
  range: LineRange,
  descending: boolean = false
): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    const sorted = [...rangeLines].sort(naturalCompare);
    return descending ? sorted.reverse() : sorted;
  });
}

/**
 * Delete duplicate lines
 */
export function deleteDuplicateLines(lines: string[], range: LineRange): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    const seen = new Set<string>();
    return rangeLines.filter(line => {
      if (seen.has(line)) {
        return false;
      }
      seen.add(line);
      return true;
    });
  });
}

/**
 * Delete duplicate lines (case-insensitive)
 */
export function deleteDuplicateLinesCaseInsensitive(lines: string[], range: LineRange): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    const seen = new Set<string>();
    return rangeLines.filter(line => {
      const lowerLine = line.toLowerCase();
      if (seen.has(lowerLine)) {
        return false;
      }
      seen.add(lowerLine);
      return true;
    });
  });
}

/**
 * Join lines with separator
 */
export function joinLines(
  lines: string[],
  range: LineRange,
  separator: string = ' '
): EditResult {
  const normalizedRange = normalizeRange(lines, range);
  const { startLine, endLine } = normalizedRange;
  
  const before = lines.slice(0, startLine);
  const rangeLines = lines.slice(startLine, endLine + 1);
  const after = lines.slice(endLine + 1);
  
  const joined = rangeLines.join(separator);
  const result = [...before, joined, ...after];
  
  return {
    lines: result,
    cursorLine: startLine,
    cursorColumn: joined.length
  };
}

/**
 * Join lines (smart - preserves indentation of first line, trims others)
 */
export function joinLinesSmartly(lines: string[], range: LineRange): EditResult {
  const normalizedRange = normalizeRange(lines, range);
  const { startLine, endLine } = normalizedRange;
  
  const before = lines.slice(0, startLine);
  const rangeLines = lines.slice(startLine, endLine + 1);
  const after = lines.slice(endLine + 1);
  
  if (rangeLines.length === 0) {
    return { lines, cursorLine: startLine, cursorColumn: 0 };
  }
  
  // Keep first line as-is, trim start of subsequent lines
  const joined = rangeLines.map((line, index) => {
    if (index === 0) {
      return line.trimEnd();
    }
    return line.trim();
  }).join(' ');
  
  const result = [...before, joined, ...after];
  
  return {
    lines: result,
    cursorLine: startLine,
    cursorColumn: joined.length
  };
}

/**
 * Duplicate lines (copy down)
 */
export function duplicateLinesDown(lines: string[], range: LineRange): EditResult {
  const normalizedRange = normalizeRange(lines, range);
  const { startLine, endLine } = normalizedRange;
  
  const before = lines.slice(0, endLine + 1);
  const rangeLines = lines.slice(startLine, endLine + 1);
  const after = lines.slice(endLine + 1);
  
  const result = [...before, ...rangeLines, ...after];
  
  return {
    lines: result,
    cursorLine: endLine + 1,
    cursorColumn: 0
  };
}

/**
 * Duplicate lines (copy up)
 */
export function duplicateLinesUp(lines: string[], range: LineRange): EditResult {
  const normalizedRange = normalizeRange(lines, range);
  const { startLine, endLine } = normalizedRange;
  
  const before = lines.slice(0, startLine);
  const rangeLines = lines.slice(startLine, endLine + 1);
  const after = lines.slice(startLine);
  
  const result = [...before, ...rangeLines, ...after];
  
  return {
    lines: result,
    cursorLine: startLine,
    cursorColumn: 0
  };
}

/**
 * Move lines up
 */
export function moveLinesUp(lines: string[], range: LineRange): EditResult {
  const normalizedRange = normalizeRange(lines, range);
  const { startLine, endLine } = normalizedRange;
  
  // Cannot move up if already at the top
  if (startLine === 0) {
    return {
      lines: [...lines],
      cursorLine: startLine,
      cursorColumn: 0
    };
  }
  
  const result = [...lines];
  const rangeLines = result.splice(startLine, endLine - startLine + 1);
  result.splice(startLine - 1, 0, ...rangeLines);
  
  return {
    lines: result,
    cursorLine: startLine - 1,
    cursorColumn: 0
  };
}

/**
 * Move lines down
 */
export function moveLinesDown(lines: string[], range: LineRange): EditResult {
  const normalizedRange = normalizeRange(lines, range);
  const { startLine, endLine } = normalizedRange;
  
  // Cannot move down if already at the bottom
  if (endLine >= lines.length - 1) {
    return {
      lines: [...lines],
      cursorLine: startLine,
      cursorColumn: 0
    };
  }
  
  const result = [...lines];
  const rangeLines = result.splice(startLine, endLine - startLine + 1);
  result.splice(startLine + 1, 0, ...rangeLines);
  
  return {
    lines: result,
    cursorLine: startLine + 1,
    cursorColumn: 0
  };
}

/**
 * Transform to uppercase
 */
export function transformToUppercase(text: string): string {
  return text.toUpperCase();
}

/**
 * Transform to lowercase
 */
export function transformToLowercase(text: string): string {
  return text.toLowerCase();
}

/**
 * Transform to title case
 */
export function transformToTitleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => {
    return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
  });
}

/**
 * Helper function to split text into words for case transformations
 */
function splitIntoWords(text: string): string[] {
  // Handle camelCase, PascalCase, snake_case, kebab-case, and spaces
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> camel Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // XMLParser -> XML Parser
    .replace(/[_\-\s]+/g, ' ') // Replace separators with space
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Transform to snake_case
 */
export function transformToSnakeCase(text: string): string {
  const words = splitIntoWords(text);
  return words.map(word => word.toLowerCase()).join('_');
}

/**
 * Transform to camelCase
 */
export function transformToCamelCase(text: string): string {
  const words = splitIntoWords(text);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.substring(1);
    })
    .join('');
}

/**
 * Transform to PascalCase
 */
export function transformToPascalCase(text: string): string {
  const words = splitIntoWords(text);
  return words
    .map(word => {
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.substring(1);
    })
    .join('');
}

/**
 * Transform to kebab-case
 */
export function transformToKebabCase(text: string): string {
  const words = splitIntoWords(text);
  return words.map(word => word.toLowerCase()).join('-');
}

/**
 * Transform to CONSTANT_CASE
 */
export function transformToConstantCase(text: string): string {
  const words = splitIntoWords(text);
  return words.map(word => word.toUpperCase()).join('_');
}

/**
 * Transpose characters at cursor
 * Swaps the character before cursor with the character at cursor
 */
export function transposeCharacters(
  line: string,
  column: number
): { line: string; column: number } {
  // Need at least 2 characters and valid position
  if (line.length < 2 || column < 1 || column > line.length) {
    return { line, column };
  }
  
  // Adjust column if at end of line
  const effectiveColumn = column >= line.length ? line.length - 1 : column;
  
  const chars = line.split('');
  const temp = chars[effectiveColumn - 1];
  chars[effectiveColumn - 1] = chars[effectiveColumn];
  chars[effectiveColumn] = temp;
  
  return {
    line: chars.join(''),
    column: Math.min(effectiveColumn + 1, line.length)
  };
}

/**
 * Transpose words at cursor
 * Swaps the word at cursor with the next word
 */
export function transposeWords(
  line: string,
  column: number
): { line: string; column: number } {
  const wordRegex = /\w+/g;
  const words: Array<{ word: string; start: number; end: number }> = [];
  let match;
  
  while ((match = wordRegex.exec(line)) !== null) {
    words.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  if (words.length < 2) {
    return { line, column };
  }
  
  // Find current word index
  let currentWordIndex = -1;
  for (let i = 0; i < words.length; i++) {
    if (column >= words[i].start && column <= words[i].end) {
      currentWordIndex = i;
      break;
    }
  }
  
  // If not on a word, find the closest word before cursor
  if (currentWordIndex === -1) {
    for (let i = words.length - 1; i >= 0; i--) {
      if (column > words[i].end) {
        currentWordIndex = i;
        break;
      }
    }
  }
  
  // If still no word found or at last word, try to swap with previous
  if (currentWordIndex === -1 || currentWordIndex >= words.length - 1) {
    if (words.length >= 2 && currentWordIndex === words.length - 1) {
      currentWordIndex = words.length - 2;
    } else {
      return { line, column };
    }
  }
  
  const word1 = words[currentWordIndex];
  const word2 = words[currentWordIndex + 1];
  
  // Build new line with swapped words
  const beforeWord1 = line.substring(0, word1.start);
  const betweenWords = line.substring(word1.end, word2.start);
  const afterWord2 = line.substring(word2.end);
  
  const newLine = beforeWord1 + word2.word + betweenWords + word1.word + afterWord2;
  const newColumn = word1.start + word2.word.length + betweenWords.length + word1.word.length;
  
  return {
    line: newLine,
    column: newColumn
  };
}

/**
 * Transpose lines
 * Swaps current line with the line below
 */
export function transposeLines(
  lines: string[],
  lineNumber: number
): { lines: string[]; lineNumber: number } {
  if (lines.length < 2 || lineNumber < 0 || lineNumber >= lines.length - 1) {
    return { lines: [...lines], lineNumber };
  }
  
  const result = [...lines];
  const temp = result[lineNumber];
  result[lineNumber] = result[lineNumber + 1];
  result[lineNumber + 1] = temp;
  
  return {
    lines: result,
    lineNumber: lineNumber + 1
  };
}

/**
 * Indent lines
 */
export function indentLines(
  lines: string[],
  range: LineRange,
  indentString: string
): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    return rangeLines.map(line => {
      // Don't indent empty lines
      if (line.trim() === '') {
        return line;
      }
      return indentString + line;
    });
  });
}

/**
 * Outdent lines
 */
export function outdentLines(
  lines: string[],
  range: LineRange,
  indentSize: number,
  useSpaces: boolean
): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    return rangeLines.map(line => {
      if (line.length === 0) {
        return line;
      }
      
      if (useSpaces) {
        // Remove up to indentSize spaces from the beginning
        let spacesToRemove = 0;
        for (let i = 0; i < Math.min(indentSize, line.length); i++) {
          if (line[i] === ' ') {
            spacesToRemove++;
          } else {
            break;
          }
        }
        return line.substring(spacesToRemove);
      } else {
        // Remove one tab from the beginning if present
        if (line[0] === '\t') {
          return line.substring(1);
        }
        return line;
      }
    });
  });
}

/**
 * Trim trailing whitespace
 */
export function trimTrailingWhitespace(lines: string[], range?: LineRange): EditResult {
  if (range) {
    return applyRangeTransformation(lines, range, (rangeLines) => {
      return rangeLines.map(line => line.trimEnd());
    });
  }
  
  // Apply to all lines if no range specified
  return {
    lines: lines.map(line => line.trimEnd()),
    cursorLine: 0,
    cursorColumn: 0
  };
}

/**
 * Add line comment
 */
export function addLineComment(
  lines: string[],
  range: LineRange,
  commentString: string
): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    // Find minimum indentation (ignoring empty lines)
    let minIndent = Infinity;
    for (const line of rangeLines) {
      if (line.trim() !== '') {
        const indent = line.search(/\S/);
        if (indent !== -1 && indent < minIndent) {
          minIndent = indent;
        }
      }
    }
    
    if (minIndent === Infinity) {
      minIndent = 0;
    }
    
    return rangeLines.map(line => {
      if (line.trim() === '') {
        return line;
      }
      const indent = line.substring(0, minIndent);
      const rest = line.substring(minIndent);
      return indent + commentString + ' ' + rest;
    });
  });
}

/**
 * Remove line comment
 */
export function removeLineComment(
  lines: string[],
  range: LineRange,
  commentString: string
): EditResult {
  const escapedComment = commentString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const commentRegex = new RegExp(`^(\\s*)${escapedComment}\\s?`);
  
  return applyRangeTransformation(lines, range, (rangeLines) => {
    return rangeLines.map(line => {
      return line.replace(commentRegex, '$1');
    });
  });
}

/**
 * Toggle line comment
 * If all non-empty lines are commented, remove comments. Otherwise, add comments.
 */
export function toggleLineComment(
  lines: string[],
  range: LineRange,
  commentString: string
): EditResult {
  const normalizedRange = normalizeRange(lines, range);
  const { startLine, endLine } = normalizedRange;
  const rangeLines = lines.slice(startLine, endLine + 1);
  
  const escapedComment = commentString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const commentRegex = new RegExp(`^\\s*${escapedComment}`);
  
  // Check if all non-empty lines are commented
  const allCommented = rangeLines.every(line => {
    if (line.trim() === '') {
      return true;
    }
    return commentRegex.test(line);
  });
  
  if (allCommented) {
    return removeLineComment(lines, range, commentString);
  } else {
    return addLineComment(lines, range, commentString);
  }
}

/**
 * Reverse lines
 */
export function reverseLines(lines: string[], range: LineRange): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    return [...rangeLines].reverse();
  });
}

/**
 * Shuffle lines (random order)
 * Uses Fisher-Yates shuffle algorithm
 */
export function shuffleLines(lines: string[], range: LineRange): EditResult {
  return applyRangeTransformation(lines, range, (rangeLines) => {
    const shuffled = [...rangeLines];
    
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  });
}

/**
 * Get unique lines (preserving order)
 */
export function getUniqueLines(lines: string[], range: LineRange): EditResult {
  return deleteDuplicateLines(lines, range);
}

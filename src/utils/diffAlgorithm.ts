/**
 * Diff Algorithms Implementation
 * Provides various diff algorithms for comparing text and data
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export enum DiffOperation {
  Equal = 'equal',
  Insert = 'insert',
  Delete = 'delete',
  Replace = 'replace',
}

export interface DiffResult<T = string> {
  operation: DiffOperation;
  value: T;
  oldIndex?: number;
  newIndex?: number;
}

export interface LineDiff {
  operation: DiffOperation;
  lineNumber: { old?: number; new?: number };
  content: string;
  context?: string[];
}

export interface UnifiedDiffOptions {
  contextLines?: number;
  oldFileName?: string;
  newFileName?: string;
  oldTimestamp?: string;
  newTimestamp?: string;
}

export interface SideBySideDiff {
  left: { lineNumber?: number; content: string; type: DiffOperation }[];
  right: { lineNumber?: number; content: string; type: DiffOperation }[];
}

// ============================================================================
// Myers Diff Algorithm
// ============================================================================

/**
 * Myers diff algorithm - the most commonly used diff algorithm
 * Time complexity: O((N+M)D) where D is the size of the minimum edit script
 * Space complexity: O((N+M)D)
 */
export class MyersDiff<T = string> {
  private equals: (a: T, b: T) => boolean;

  constructor(equals?: (a: T, b: T) => boolean) {
    this.equals = equals || ((a, b) => a === b);
  }

  /**
   * Compute the shortest edit script between two sequences
   */
  diff(oldSeq: T[], newSeq: T[]): DiffResult<T>[] {
    const n = oldSeq.length;
    const m = newSeq.length;
    const max = n + m;

    if (max === 0) return [];
    if (n === 0) return newSeq.map((v, i) => ({ operation: DiffOperation.Insert, value: v, newIndex: i }));
    if (m === 0) return oldSeq.map((v, i) => ({ operation: DiffOperation.Delete, value: v, oldIndex: i }));

    // V array stores the x-coordinate of the furthest reaching path for each diagonal
    const v: Map<number, number>[] = [];
    const trace: Map<number, number>[] = [];

    // Forward phase - find the shortest edit path
    for (let d = 0; d <= max; d++) {
      const vCurrent = new Map<number, number>();
      v.push(vCurrent);

      for (let k = -d; k <= d; k += 2) {
        let x: number;

        if (k === -d || (k !== d && (v[d - 1]?.get(k - 1) ?? -1) < (v[d - 1]?.get(k + 1) ?? -1))) {
          x = v[d - 1]?.get(k + 1) ?? 0;
        } else {
          x = (v[d - 1]?.get(k - 1) ?? -1) + 1;
        }

        let y = x - k;

        // Extend the snake
        while (x < n && y < m && this.equals(oldSeq[x], newSeq[y])) {
          x++;
          y++;
        }

        vCurrent.set(k, x);

        if (x >= n && y >= m) {
          trace.push(vCurrent);
          return this.backtrack(trace, oldSeq, newSeq);
        }
      }

      trace.push(vCurrent);
    }

    return this.backtrack(trace, oldSeq, newSeq);
  }

  private backtrack(trace: Map<number, number>[], oldSeq: T[], newSeq: T[]): DiffResult<T>[] {
    const result: DiffResult<T>[] = [];
    let x = oldSeq.length;
    let y = newSeq.length;

    for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
      const k = x - y;

      let prevK: number;
      if (k === -d || (k !== d && (trace[d - 1]?.get(k - 1) ?? -1) < (trace[d - 1]?.get(k + 1) ?? -1))) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }

      const prevX = trace[d - 1]?.get(prevK) ?? 0;
      const prevY = prevX - prevK;

      // Add the snake (equal elements)
      while (x > prevX && y > prevY) {
        x--;
        y--;
        result.unshift({ operation: DiffOperation.Equal, value: oldSeq[x], oldIndex: x, newIndex: y });
      }

      if (d > 0) {
        if (x > prevX) {
          x--;
          result.unshift({ operation: DiffOperation.Delete, value: oldSeq[x], oldIndex: x });
        } else if (y > prevY) {
          y--;
          result.unshift({ operation: DiffOperation.Insert, value: newSeq[y], newIndex: y });
        }
      }
    }

    return result;
  }
}

// ============================================================================
// Patience Diff Algorithm
// ============================================================================

/**
 * Patience diff algorithm - produces more human-readable diffs
 * Works by finding unique common lines and using them as anchors
 */
export class PatienceDiff {
  /**
   * Compute diff using patience algorithm
   */
  diff(oldLines: string[], newLines: string[]): DiffResult<string>[] {
    return this.patienceDiffRecursive(oldLines, newLines, 0, 0);
  }

  private patienceDiffRecursive(
    oldLines: string[],
    newLines: string[],
    oldOffset: number,
    newOffset: number
  ): DiffResult<string>[] {
    if (oldLines.length === 0) {
      return newLines.map((line, i) => ({
        operation: DiffOperation.Insert,
        value: line,
        newIndex: newOffset + i,
      }));
    }

    if (newLines.length === 0) {
      return oldLines.map((line, i) => ({
        operation: DiffOperation.Delete,
        value: line,
        oldIndex: oldOffset + i,
      }));
    }

    // Find unique lines in both sequences
    const uniqueOld = this.findUniqueLines(oldLines);
    const uniqueNew = this.findUniqueLines(newLines);

    // Find common unique lines
    const commonUnique = this.findCommonUniqueLines(oldLines, newLines, uniqueOld, uniqueNew);

    if (commonUnique.length === 0) {
      // Fall back to Myers diff
      const myers = new MyersDiff<string>();
      return myers.diff(oldLines, newLines).map(d => ({
        ...d,
        oldIndex: d.oldIndex !== undefined ? d.oldIndex + oldOffset : undefined,
        newIndex: d.newIndex !== undefined ? d.newIndex + newOffset : undefined,
      }));
    }

    // Find longest increasing subsequence of common unique lines
    const lcs = this.longestIncreasingSubsequence(commonUnique);

    // Recursively diff between anchors
    const result: DiffResult<string>[] = [];
    let oldPos = 0;
    let newPos = 0;

    for (const anchor of lcs) {
      // Diff before this anchor
      const beforeResult = this.patienceDiffRecursive(
        oldLines.slice(oldPos, anchor.oldIndex),
        newLines.slice(newPos, anchor.newIndex),
        oldOffset + oldPos,
        newOffset + newPos
      );
      result.push(...beforeResult);

      // Add the anchor as equal
      result.push({
        operation: DiffOperation.Equal,
        value: oldLines[anchor.oldIndex],
        oldIndex: oldOffset + anchor.oldIndex,
        newIndex: newOffset + anchor.newIndex,
      });

      oldPos = anchor.oldIndex + 1;
      newPos = anchor.newIndex + 1;
    }

    // Diff after last anchor
    const afterResult = this.patienceDiffRecursive(
      oldLines.slice(oldPos),
      newLines.slice(newPos),
      oldOffset + oldPos,
      newOffset + newPos
    );
    result.push(...afterResult);

    return result;
  }

  private findUniqueLines(lines: string[]): Set<number> {
    const counts = new Map<string, number[]>();
    
    lines.forEach((line, index) => {
      const indices = counts.get(line) || [];
      indices.push(index);
      counts.set(line, indices);
    });

    const unique = new Set<number>();
    counts.forEach((indices) => {
      if (indices.length === 1) {
        unique.add(indices[0]);
      }
    });

    return unique;
  }

  private findCommonUniqueLines(
    oldLines: string[],
    newLines: string[],
    uniqueOld: Set<number>,
    uniqueNew: Set<number>
  ): { oldIndex: number; newIndex: number }[] {
    const newLineToIndex = new Map<string, number>();
    uniqueNew.forEach(index => {
      newLineToIndex.set(newLines[index], index);
    });

    const common: { oldIndex: number; newIndex: number }[] = [];
    uniqueOld.forEach(oldIndex => {
      const line = oldLines[oldIndex];
      const newIndex = newLineToIndex.get(line);
      if (newIndex !== undefined) {
        common.push({ oldIndex, newIndex });
      }
    });

    return common.sort((a, b) => a.oldIndex - b.oldIndex);
  }

  private longestIncreasingSubsequence(
    pairs: { oldIndex: number; newIndex: number }[]
  ): { oldIndex: number; newIndex: number }[] {
    if (pairs.length === 0) return [];

    const n = pairs.length;
    const dp: number[] = new Array(n).fill(1);
    const prev: number[] = new Array(n).fill(-1);

    for (let i = 1; i < n; i++) {
      for (let j = 0; j < i; j++) {
        if (pairs[j].newIndex < pairs[i].newIndex && dp[j] + 1 > dp[i]) {
          dp[i] = dp[j] + 1;
          prev[i] = j;
        }
      }
    }

    // Find the index with maximum length
    let maxIdx = 0;
    for (let i = 1; i < n; i++) {
      if (dp[i] > dp[maxIdx]) {
        maxIdx = i;
      }
    }

    // Reconstruct the LIS
    const result: { oldIndex: number; newIndex: number }[] = [];
    let idx: number | null = maxIdx;
    while (idx !== -1 && idx !== null) {
      result.unshift(pairs[idx]);
      idx = prev[idx];
    }

    return result;
  }
}

// ============================================================================
// Minimal Diff Algorithm
// ============================================================================

/**
 * Minimal diff algorithm - finds the smallest possible diff
 * Uses dynamic programming to compute edit distance
 */
export class MinimalDiff<T = string> {
  private equals: (a: T, b: T) => boolean;

  constructor(equals?: (a: T, b: T) => boolean) {
    this.equals = equals || ((a, b) => a === b);
  }

  /**
   * Compute minimal diff using dynamic programming
   */
  diff(oldSeq: T[], newSeq: T[]): DiffResult<T>[] {
    const n = oldSeq.length;
    const m = newSeq.length;

    // Build DP table for edit distance
    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

    // Initialize base cases
    for (let i = 0; i <= n; i++) dp[i][0] = i;
    for (let j = 0; j <= m; j++) dp[0][j] = j;

    // Fill DP table
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (this.equals(oldSeq[i - 1], newSeq[j - 1])) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // Delete
            dp[i][j - 1],     // Insert
            dp[i - 1][j - 1]  // Replace
          );
        }
      }
    }

    // Backtrack to find the edit script
    return this.backtrack(dp, oldSeq, newSeq);
  }

  private backtrack(dp: number[][], oldSeq: T[], newSeq: T[]): DiffResult<T>[] {
    const result: DiffResult<T>[] = [];
    let i = oldSeq.length;
    let j = newSeq.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && this.equals(oldSeq[i - 1], newSeq[j - 1])) {
        result.unshift({
          operation: DiffOperation.Equal,
          value: oldSeq[i - 1],
          oldIndex: i - 1,
          newIndex: j - 1,
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j])) {
        result.unshift({
          operation: DiffOperation.Insert,
          value: newSeq[j - 1],
          newIndex: j - 1,
        });
        j--;
      } else if (i > 0) {
        result.unshift({
          operation: DiffOperation.Delete,
          value: oldSeq[i - 1],
          oldIndex: i - 1,
        });
        i--;
      }
    }

    return result;
  }

  /**
   * Get the edit distance (Levenshtein distance) between two sequences
   */
  editDistance(oldSeq: T[], newSeq: T[]): number {
    const n = oldSeq.length;
    const m = newSeq.length;

    // Use space-optimized version
    let prev = Array.from({ length: m + 1 }, (_, j) => j);
    let curr = new Array(m + 1).fill(0);

    for (let i = 1; i <= n; i++) {
      curr[0] = i;
      for (let j = 1; j <= m; j++) {
        if (this.equals(oldSeq[i - 1], newSeq[j - 1])) {
          curr[j] = prev[j - 1];
        } else {
          curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
        }
      }
      [prev, curr] = [curr, prev];
    }

    return prev[m];
  }
}

// ============================================================================
// Word-Level Diff
// ============================================================================

/**
 * Word-level diff - compares text at word granularity
 */
export class WordDiff {
  private wordPattern: RegExp;

  constructor(wordPattern?: RegExp) {
    this.wordPattern = wordPattern || /\S+|\s+/g;
  }

  /**
   * Split text into words
   */
  private tokenize(text: string): string[] {
    return text.match(this.wordPattern) || [];
  }

  /**
   * Compute word-level diff
   */
  diff(oldText: string, newText: string): DiffResult<string>[] {
    const oldWords = this.tokenize(oldText);
    const newWords = this.tokenize(newText);

    const myers = new MyersDiff<string>();
    return myers.diff(oldWords, newWords);
  }

  /**
   * Generate highlighted diff output
   */
  diffWithHighlight(oldText: string, newText: string): {
    old: { text: string; type: DiffOperation }[];
    new: { text: string; type: DiffOperation }[];
  } {
    const diffs = this.diff(oldText, newText);

    const oldResult: { text: string; type: DiffOperation }[] = [];
    const newResult: { text: string; type: DiffOperation }[] = [];

    for (const d of diffs) {
      switch (d.operation) {
        case DiffOperation.Equal:
          oldResult.push({ text: d.value, type: DiffOperation.Equal });
          newResult.push({ text: d.value, type: DiffOperation.Equal });
          break;
        case DiffOperation.Delete:
          oldResult.push({ text: d.value, type: DiffOperation.Delete });
          break;
        case DiffOperation.Insert:
          newResult.push({ text: d.value, type: DiffOperation.Insert });
          break;
      }
    }

    return { old: oldResult, new: newResult };
  }
}

// ============================================================================
// Character-Level Diff
// ============================================================================

/**
 * Character-level diff - finest granularity diff
 */
export class CharacterDiff {
  private myers: MyersDiff<string>;

  constructor() {
    this.myers = new MyersDiff<string>();
  }

  /**
   * Compute character-level diff
   */
  diff(oldText: string, newText: string): DiffResult<string>[] {
    const oldChars = oldText.split('');
    const newChars = newText.split('');
    return this.myers.diff(oldChars, newChars);
  }

  /**
   * Compute diff with merged consecutive changes
   */
  diffMerged(oldText: string, newText: string): DiffResult<string>[] {
    const charDiffs = this.diff(oldText, newText);
    return this.mergeConsecutive(charDiffs);
  }

  private mergeConsecutive(diffs: DiffResult<string>[]): DiffResult<string>[] {
    if (diffs.length === 0) return [];

    const result: DiffResult<string>[] = [];
    let current: DiffResult<string> = { ...diffs[0] };

    for (let i = 1; i < diffs.length; i++) {
      const d = diffs[i];
      if (d.operation === current.operation) {
        current.value += d.value;
      } else {
        result.push(current);
        current = { ...d };
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Get similarity ratio between two strings (0-1)
   */
  similarity(oldText: string, newText: string): number {
    if (oldText === newText) return 1;
    if (oldText.length === 0 && newText.length === 0) return 1;
    if (oldText.length === 0 || newText.length === 0) return 0;

    const minimal = new MinimalDiff<string>();
    const distance = minimal.editDistance(oldText.split(''), newText.split(''));
    const maxLength = Math.max(oldText.length, newText.length);

    return 1 - distance / maxLength;
  }
}

// ============================================================================
// Line Diff with Context
// ============================================================================

/**
 * Line-level diff with context lines
 */
export class LineDiffWithContext {
  private contextLines: number;

  constructor(contextLines: number = 3) {
    this.contextLines = contextLines;
  }

  /**
   * Split text into lines
   */
  private splitLines(text: string): string[] {
    return text.split(/\r?\n/);
  }

  /**
   * Compute line diff
   */
  diff(oldText: string, newText: string): LineDiff[] {
    const oldLines = this.splitLines(oldText);
    const newLines = this.splitLines(newText);

    const myers = new MyersDiff<string>();
    const diffs = myers.diff(oldLines, newLines);

    const result: LineDiff[] = [];
    let oldLineNum = 1;
    let newLineNum = 1;

    for (const d of diffs) {
      switch (d.operation) {
        case DiffOperation.Equal:
          result.push({
            operation: DiffOperation.Equal,
            lineNumber: { old: oldLineNum, new: newLineNum },
            content: d.value,
          });
          oldLineNum++;
          newLineNum++;
          break;
        case DiffOperation.Delete:
          result.push({
            operation: DiffOperation.Delete,
            lineNumber: { old: oldLineNum },
            content: d.value,
          });
          oldLineNum++;
          break;
        case DiffOperation.Insert:
          result.push({
            operation: DiffOperation.Insert,
            lineNumber: { new: newLineNum },
            content: d.value,
          });
          newLineNum++;
          break;
      }
    }

    return result;
  }

  /**
   * Get diff hunks with context
   */
  diffHunks(oldText: string, newText: string): LineDiff[][] {
    const lineDiffs = this.diff(oldText, newText);
    const hunks: LineDiff[][] = [];
    let currentHunk: LineDiff[] = [];
    let lastChangeIndex = -this.contextLines - 1;

    for (let i = 0; i < lineDiffs.length; i++) {
      const diff = lineDiffs[i];
      const isChange = diff.operation !== DiffOperation.Equal;

      if (isChange) {
        // Add context lines before change
        const contextStart = Math.max(lastChangeIndex + this.contextLines + 1, i - this.contextLines);
        for (let j = contextStart; j < i; j++) {
          if (!currentHunk.includes(lineDiffs[j])) {
            currentHunk.push(lineDiffs[j]);
          }
        }

        currentHunk.push(diff);
        lastChangeIndex = i;
      } else if (i - lastChangeIndex <= this.contextLines) {
        // Context line after change
        currentHunk.push(diff);
      } else if (currentHunk.length > 0) {
        // End of hunk
        hunks.push(currentHunk);
        currentHunk = [];
      }
    }

    if (currentHunk.length > 0) {
      hunks.push(currentHunk);
    }

    return hunks;
  }
}

// ============================================================================
// Unified Diff Format
// ============================================================================

/**
 * Generate unified diff format output
 */
export class UnifiedDiffFormat {
  private contextLines: number;

  constructor(contextLines: number = 3) {
    this.contextLines = contextLines;
  }

  /**
   * Generate unified diff string
   */
  format(oldText: string, newText: string, options: UnifiedDiffOptions = {}): string {
    const {
      oldFileName = 'a',
      newFileName = 'b',
      oldTimestamp = '',
      newTimestamp = '',
    } = options;

    const lineDiff = new LineDiffWithContext(this.contextLines);
    const hunks = lineDiff.diffHunks(oldText, newText);

    if (hunks.length === 0) {
      return '';
    }

    const lines: string[] = [];

    // Header
    lines.push(`--- ${oldFileName}${oldTimestamp ? '\t' + oldTimestamp : ''}`);
    lines.push(`+++ ${newFileName}${newTimestamp ? '\t' + newTimestamp : ''}`);

    // Hunks
    for (const hunk of hunks) {
      const hunkHeader = this.formatHunkHeader(hunk);
      lines.push(hunkHeader);

      for (const diff of hunk) {
        const prefix = this.getPrefix(diff.operation);
        lines.push(prefix + diff.content);
      }
    }

    return lines.join('\n');
  }

  private formatHunkHeader(hunk: LineDiff[]): string {
    let oldStart = Infinity;
    let oldCount = 0;
    let newStart = Infinity;
    let newCount = 0;

    for (const diff of hunk) {
      if (diff.lineNumber.old !== undefined) {
        oldStart = Math.min(oldStart, diff.lineNumber.old);
        if (diff.operation !== DiffOperation.Insert) {
          oldCount++;
        }
      }
      if (diff.lineNumber.new !== undefined) {
        newStart = Math.min(newStart, diff.lineNumber.new);
        if (diff.operation !== DiffOperation.Delete) {
          newCount++;
        }
      }
    }

    if (oldStart === Infinity) oldStart = 1;
    if (newStart === Infinity) newStart = 1;

    return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
  }

  private getPrefix(operation: DiffOperation): string {
    switch (operation) {
      case DiffOperation.Equal:
        return ' ';
      case DiffOperation.Delete:
        return '-';
      case DiffOperation.Insert:
        return '+';
      default:
        return ' ';
    }
  }

  /**
   * Parse unified diff format
   */
  parse(diffText: string): { oldFile: string; newFile: string; hunks: LineDiff[][] } {
    const lines = diffText.split('\n');
    let oldFile = '';
    let newFile = '';
    const hunks: LineDiff[][] = [];
    let currentHunk: LineDiff[] = [];
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      if (line.startsWith('---')) {
        oldFile = line.substring(4).split('\t')[0];
      } else if (line.startsWith('+++')) {
        newFile = line.substring(4).split('\t')[0];
      } else if (line.startsWith('@@')) {
        if (currentHunk.length > 0) {
          hunks.push(currentHunk);
          currentHunk = [];
        }

        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLineNum = parseInt(match[1], 10);
          newLineNum = parseInt(match[2], 10);
        }
      } else if (line.startsWith('-')) {
        currentHunk.push({
          operation: DiffOperation.Delete,
          lineNumber: { old: oldLineNum++ },
          content: line.substring(1),
        });
      } else if (line.startsWith('+')) {
        currentHunk.push({
          operation: DiffOperation.Insert,
          lineNumber: { new: newLineNum++ },
          content: line.substring(1),
        });
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.push({
          operation: DiffOperation.Equal,
          lineNumber: { old: oldLineNum++, new: newLineNum++ },
          content: line.substring(1),
        });
      }
    }

    if (currentHunk.length > 0) {
      hunks.push(currentHunk);
    }

    return { oldFile, newFile, hunks };
  }
}

// ============================================================================
// Side-by-Side Diff Format
// ============================================================================

/**
 * Generate side-by-side diff format
 */
export class SideBySideDiffFormat {
  private contextLines: number;

  constructor(contextLines: number = 3) {
    this.contextLines = contextLines;
  }

  /**
   * Generate side-by-side diff
   */
  format(oldText: string, newText: string): SideBySideDiff {
    const lineDiff = new LineDiffWithContext(this.contextLines);
    const diffs = lineDiff.diff(oldText, newText);

    const left: SideBySideDiff['left'] = [];
    const right: SideBySideDiff['right'] = [];

    let i = 0;
    while (i < diffs.length) {
      const diff = diffs[i];

      if (diff.operation === DiffOperation.Equal) {
        left.push({
          lineNumber: diff.lineNumber.old,
          content: diff.content,
          type: DiffOperation.Equal,
        });
        right.push({
          lineNumber: diff.lineNumber.new,
          content: diff.content,
          type: DiffOperation.Equal,
        });
        i++;
      } else if (diff.operation === DiffOperation.Delete) {
        // Check if next is an insert (modification)
        const next = diffs[i + 1];
        if (next && next.operation === DiffOperation.Insert) {
          left.push({
            lineNumber: diff.lineNumber.old,
            content: diff.content,
            type: DiffOperation.Delete,
          });
          right.push({
            lineNumber: next.lineNumber.new,
            content: next.content,
            type: DiffOperation.Insert,
          });
          i += 2;
        } else {
          left.push({
            lineNumber: diff.lineNumber.old,
            content: diff.content,
            type: DiffOperation.Delete,
          });
          right.push({
            content: '',
            type: DiffOperation.Equal,
          });
          i++;
        }
      } else if (diff.operation === DiffOperation.Insert) {
        left.push({
          content: '',
          type: DiffOperation.Equal,
        });
        right.push({
          lineNumber: diff.lineNumber.new,
          content: diff.content,
          type: DiffOperation.Insert,
        });
        i++;
      } else {
        i++;
      }
    }

    return { left, right };
  }

  /**
   * Format as string table
   */
  formatAsTable(oldText: string, newText: string, width: number = 40): string {
    const diff = this.format(oldText, newText);
    const lines: string[] = [];

    const separator = '│';
    const headerLine = '─'.repeat(width) + '┼' + '─'.repeat(width);

    lines.push(headerLine);

    const maxLines = Math.max(diff.left.length, diff.right.length);
    for (let i = 0; i < maxLines; i++) {
      const leftEntry = diff.left[i] || { content: '', type: DiffOperation.Equal };
      const rightEntry = diff.right[i] || { content: '', type: DiffOperation.Equal };

      const leftPrefix = this.getLinePrefix(leftEntry.type);
      const rightPrefix = this.getLinePrefix(rightEntry.type);

      const leftLineNum = leftEntry.lineNumber?.toString().padStart(4, ' ') || '    ';
      const rightLineNum = rightEntry.lineNumber?.toString().padStart(4, ' ') || '    ';

      const leftContent = this.truncate(`${leftPrefix}${leftLineNum} ${leftEntry.content}`, width);
      const rightContent = this.truncate(`${rightPrefix}${rightLineNum} ${rightEntry.content}`, width);

      lines.push(`${leftContent.padEnd(width)}${separator}${rightContent}`);
    }

    lines.push(headerLine);
    return lines.join('\n');
  }

  private getLinePrefix(type: DiffOperation): string {
    switch (type) {
      case DiffOperation.Delete:
        return '- ';
      case DiffOperation.Insert:
        return '+ ';
      default:
        return '  ';
    }
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get inline word-level highlights for modified lines
   */
  getInlineHighlights(
    oldLine: string,
    newLine: string
  ): {
    oldHighlights: { start: number; end: number }[];
    newHighlights: { start: number; end: number }[];
  } {
    const charDiff = new CharacterDiff();
    const diffs = charDiff.diff(oldLine, newLine);

    const oldHighlights: { start: number; end: number }[] = [];
    const newHighlights: { start: number; end: number }[] = [];

    let oldPos = 0;
    let newPos = 0;

    for (const d of diffs) {
      switch (d.operation) {
        case DiffOperation.Equal:
          oldPos += d.value.length;
          newPos += d.value.length;
          break;
        case DiffOperation.Delete:
          oldHighlights.push({ start: oldPos, end: oldPos + d.value.length });
          oldPos += d.value.length;
          break;
        case DiffOperation.Insert:
          newHighlights.push({ start: newPos, end: newPos + d.value.length });
          newPos += d.value.length;
          break;
      }
    }

    return { oldHighlights, newHighlights };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick diff function for simple use cases
 */
export function quickDiff(oldText: string, newText: string, options?: {
  algorithm?: 'myers' | 'patience' | 'minimal';
  granularity?: 'line' | 'word' | 'character';
}): DiffResult<string>[] {
  const { algorithm = 'myers', granularity = 'line' } = options || {};

  let oldSeq: string[];
  let newSeq: string[];

  switch (granularity) {
    case 'line':
      oldSeq = oldText.split(/\r?\n/);
      newSeq = newText.split(/\r?\n/);
      break;
    case 'word':
      oldSeq = oldText.match(/\S+|\s+/g) || [];
      newSeq = newText.match(/\S+|\s+/g) || [];
      break;
    case 'character':
      oldSeq = oldText.split('');
      newSeq = newText.split('');
      break;
  }

  switch (algorithm) {
    case 'myers':
      return new MyersDiff<string>().diff(oldSeq, newSeq);
    case 'patience':
      if (granularity !== 'line') {
        // Patience works best with lines
        return new MyersDiff<string>().diff(oldSeq, newSeq);
      }
      return new PatienceDiff().diff(oldSeq, newSeq);
    case 'minimal':
      return new MinimalDiff<string>().diff(oldSeq, newSeq);
  }
}

/**
 * Generate unified diff output
 */
export function unifiedDiff(
  oldText: string,
  newText: string,
  options?: UnifiedDiffOptions
): string {
  const formatter = new UnifiedDiffFormat();
  return formatter.format(oldText, newText, options);
}

/**
 * Generate side-by-side diff output
 */
export function sideBySideDiff(oldText: string, newText: string): SideBySideDiff {
  const formatter = new SideBySideDiffFormat();
  return formatter.format(oldText, newText);
}

/**
 * Calculate similarity between two texts (0-1)
 */
export function textSimilarity(text1: string, text2: string): number {
  const charDiff = new CharacterDiff();
  return charDiff.similarity(text1, text2);
}

/**
 * Apply a diff to transform old text to new text
 */
export function applyDiff<T>(_oldSeq: T[], diffs: DiffResult<T>[]): T[] {
  const result: T[] = [];

  for (const d of diffs) {
    switch (d.operation) {
      case DiffOperation.Equal:
      case DiffOperation.Insert:
        result.push(d.value);
        break;
      case DiffOperation.Delete:
        // Skip deleted items
        break;
    }
  }

  return result;
}

/**
 * Reverse a diff (swap insert/delete operations)
 */
export function reverseDiff<T>(diffs: DiffResult<T>[]): DiffResult<T>[] {
  return diffs.map(d => {
    switch (d.operation) {
      case DiffOperation.Insert:
        return { ...d, operation: DiffOperation.Delete, oldIndex: d.newIndex, newIndex: undefined };
      case DiffOperation.Delete:
        return { ...d, operation: DiffOperation.Insert, newIndex: d.oldIndex, oldIndex: undefined };
      default:
        return { ...d, oldIndex: d.newIndex, newIndex: d.oldIndex };
    }
  });
}

// ============================================================================
// Exports
// ============================================================================

export default {
  MyersDiff,
  PatienceDiff,
  MinimalDiff,
  WordDiff,
  CharacterDiff,
  LineDiffWithContext,
  UnifiedDiffFormat,
  SideBySideDiffFormat,
  DiffOperation,
  quickDiff,
  unifiedDiff,
  sideBySideDiff,
  textSimilarity,
  applyDiff,
  reverseDiff,
};

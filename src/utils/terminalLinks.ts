/**
 * Terminal Link Detection for Cortex IDE
 * Detects file paths, URLs, and custom word links in terminal output
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TerminalLink {
  startIndex: number;
  length: number;
  text: string;
  type: TerminalLinkType;
  tooltip?: string;
  uri?: string;
  range?: { line: number; column: number };
}

export type TerminalLinkType = 'file' | 'url' | 'localFile' | 'localFolder' | 'word' | 'custom';

export interface LinkDetectionOptions {
  workspaceFolder?: string;
  cwd?: string;
  detectUrls?: boolean;
  detectFiles?: boolean;
  detectWords?: boolean;
  wordSeparators?: string;
  customPatterns?: CustomLinkPattern[];
}

export interface CustomLinkPattern {
  regex: RegExp;
  type: string;
  handler: (match: RegExpMatchArray) => { uri?: string; tooltip?: string } | undefined;
}

/**
 * URL regex pattern
 */
const URL_PATTERN = /\b(https?:\/\/|ftp:\/\/|file:\/\/|mailto:)[^\s<>"')\]]+/gi;

/**
 * File path patterns per OS
 */
const UNIX_PATH_PATTERN = /(?:^|[\s'"({\[])((?:\/[\w.-]+)+(?::\d+(?::\d+)?)?)/g;
const WINDOWS_PATH_PATTERN = /(?:^|[\s'"({\[])([A-Za-z]:\\(?:[\w.-]+\\)*[\w.-]+(?::\d+(?::\d+)?)?)/g;
const RELATIVE_PATH_PATTERN = /(?:^|[\s'"({\[])(\.{1,2}\/[\w./-]+(?::\d+(?::\d+)?)?)/g;

/**
 * Default word separators
 */
export const DEFAULT_WORD_SEPARATORS = ' \t\n\r"\'`,;:!?()[]{}';

/**
 * Compiler output patterns for various languages
 */
const COMPILER_PATTERNS: Array<{ regex: RegExp; groups: { path: number; line: number; column?: number } }> = [
  // GCC/Clang style: file:line:column:
  { regex: /([^\s:]+):(\d+):(\d+):/g, groups: { path: 1, line: 2, column: 3 } },
  // TypeScript style: file(line,column):
  { regex: /([^\s(]+)\((\d+),(\d+)\):/g, groups: { path: 1, line: 2, column: 3 } },
  // Python style: File "path", line N
  { regex: /File "([^"]+)", line (\d+)/g, groups: { path: 1, line: 2 } },
  // Rust style: --> file:line:column
  { regex: /--> ([^\s:]+):(\d+):(\d+)/g, groups: { path: 1, line: 2, column: 3 } },
  // Go style: file:line:column:
  { regex: /^([^\s:]+):(\d+):(\d+):/gm, groups: { path: 1, line: 2, column: 3 } },
];

/**
 * Detect all links in a line of terminal output
 */
export function detectLinks(line: string, options: LinkDetectionOptions): TerminalLink[] {
  const links: TerminalLink[] = [];

  // Detect URLs
  if (options.detectUrls !== false) {
    links.push(...detectUrls(line));
  }

  // Detect file paths
  if (options.detectFiles !== false) {
    links.push(...detectFilePaths(line, options.workspaceFolder, options.cwd));
    links.push(...detectCompilerOutputLinks(line));
  }

  // Detect word links
  if (options.detectWords) {
    const separators = options.wordSeparators ?? DEFAULT_WORD_SEPARATORS;
    links.push(...detectWordLinks(line, separators));
  }

  // Detect custom patterns
  if (options.customPatterns && options.customPatterns.length > 0) {
    links.push(...detectCustomPatterns(line, options.customPatterns));
  }

  return mergeLinks(links);
}

/**
 * Detect URLs (http, https, ftp, mailto, etc.)
 */
export function detectUrls(line: string): TerminalLink[] {
  const links: TerminalLink[] = [];
  const regex = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    let url = match[0];
    
    // Clean trailing punctuation that's likely not part of URL
    const trailingPunct = /[.,;:!?)>\]]+$/;
    const trailingMatch = url.match(trailingPunct);
    if (trailingMatch) {
      // Check for balanced parentheses
      const openParens = (url.match(/\(/g) || []).length;
      const closeParens = (url.match(/\)/g) || []).length;
      if (closeParens > openParens) {
        url = url.replace(/\)+$/, (m) => ')'.repeat(Math.min(m.length, closeParens - openParens)));
      }
      // Remove other trailing punctuation
      url = url.replace(/[.,;:!?>\]]+$/, '');
    }

    links.push({
      startIndex: match.index,
      length: url.length,
      text: url,
      type: 'url',
      tooltip: `Open URL: ${url}`,
      uri: url,
    });
  }

  return links;
}

/**
 * Detect file paths (absolute and relative)
 */
export function detectFilePaths(
  line: string,
  workspaceFolder?: string,
  cwd?: string
): TerminalLink[] {
  const links: TerminalLink[] = [];
  const isWindows = process.platform === 'win32';

  // Detect absolute paths
  const absolutePattern = isWindows ? WINDOWS_PATH_PATTERN : UNIX_PATH_PATTERN;
  links.push(...detectPathsWithPattern(line, absolutePattern, 'localFile', workspaceFolder, cwd));

  // Detect relative paths
  links.push(...detectPathsWithPattern(line, RELATIVE_PATH_PATTERN, 'localFile', workspaceFolder, cwd));

  return links;
}

/**
 * Helper to detect paths with a specific pattern
 */
function detectPathsWithPattern(
  line: string,
  pattern: RegExp,
  type: TerminalLinkType,
  workspaceFolder?: string,
  cwd?: string
): TerminalLink[] {
  const links: TerminalLink[] = [];
  const regex = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    const fullMatch = match[0];
    const pathPart = match[1];
    
    if (!pathPart) continue;

    // Calculate actual start index (accounting for leading whitespace/quotes)
    const startIndex = match.index + fullMatch.indexOf(pathPart);
    const parsed = parseFilePath(pathPart);

    links.push({
      startIndex,
      length: pathPart.length,
      text: pathPart,
      type,
      tooltip: `Open file: ${parsed.path}${parsed.line ? `:${parsed.line}` : ''}`,
      uri: buildFileUri(parsed.path, workspaceFolder, cwd),
      range: parsed.line ? { line: parsed.line, column: parsed.column ?? 1 } : undefined,
    });
  }

  return links;
}

/**
 * Build file URI from path
 */
function buildFileUri(filePath: string, workspaceFolder?: string, cwd?: string): string {
  let resolvedPath = filePath;

  // Resolve relative paths
  if (!path.isAbsolute(filePath)) {
    const basePath = cwd || workspaceFolder || process.cwd();
    resolvedPath = path.resolve(basePath, filePath);
  }

  // Normalize path separators
  resolvedPath = resolvedPath.replace(/\\/g, '/');

  return `file://${resolvedPath}`;
}

/**
 * Parse file path with optional line:column
 */
export function parseFilePath(filePath: string): {
  path: string;
  line?: number;
  column?: number;
} {
  // Match patterns like:
  // /path/to/file:10:5
  // /path/to/file:10
  // /path/to/file(10,5)
  // /path/to/file
  
  // Pattern: path:line:column or path:line
  const colonMatch = filePath.match(/^(.+?):(\d+)(?::(\d+))?$/);
  if (colonMatch) {
    return {
      path: colonMatch[1],
      line: parseInt(colonMatch[2], 10),
      column: colonMatch[3] ? parseInt(colonMatch[3], 10) : undefined,
    };
  }

  // Pattern: path(line,column) or path(line)
  const parenMatch = filePath.match(/^(.+?)\((\d+)(?:,(\d+))?\)$/);
  if (parenMatch) {
    return {
      path: parenMatch[1],
      line: parseInt(parenMatch[2], 10),
      column: parenMatch[3] ? parseInt(parenMatch[3], 10) : undefined,
    };
  }

  return { path: filePath };
}

/**
 * Check if path exists (async)
 */
export async function resolveFilePath(
  filePath: string,
  workspaceFolder?: string,
  cwd?: string
): Promise<{ exists: boolean; resolvedPath: string; isDirectory: boolean }> {
  let resolvedPath = filePath;

  // Parse out line/column info
  const parsed = parseFilePath(filePath);
  resolvedPath = parsed.path;

  // Resolve relative paths
  if (!path.isAbsolute(resolvedPath)) {
    const basePath = cwd || workspaceFolder || process.cwd();
    resolvedPath = path.resolve(basePath, resolvedPath);
  }

  try {
    const stats = await fs.promises.stat(resolvedPath);
    return {
      exists: true,
      resolvedPath,
      isDirectory: stats.isDirectory(),
    };
  } catch {
    // Try with workspace folder if different from cwd
    if (workspaceFolder && workspaceFolder !== cwd) {
      const altPath = path.resolve(workspaceFolder, parsed.path);
      try {
        const stats = await fs.promises.stat(altPath);
        return {
          exists: true,
          resolvedPath: altPath,
          isDirectory: stats.isDirectory(),
        };
      } catch {
        // Path doesn't exist
      }
    }

    return {
      exists: false,
      resolvedPath,
      isDirectory: false,
    };
  }
}

/**
 * Detect word links (for Go to Definition, etc.)
 */
export function detectWordLinks(
  line: string,
  wordSeparators: string,
  isValidWord?: (word: string) => boolean
): TerminalLink[] {
  const links: TerminalLink[] = [];
  const separatorSet = new Set(wordSeparators.split(''));
  
  let wordStart = -1;
  let currentWord = '';

  for (let i = 0; i <= line.length; i++) {
    const char = line[i];
    const isSeparator = i === line.length || separatorSet.has(char);

    if (isSeparator) {
      if (wordStart !== -1 && currentWord.length > 0) {
        // Check if word is valid (not just numbers, has reasonable length)
        const isValid = isValidWord 
          ? isValidWord(currentWord)
          : isDefaultValidWord(currentWord);

        if (isValid) {
          links.push({
            startIndex: wordStart,
            length: currentWord.length,
            text: currentWord,
            type: 'word',
            tooltip: `Search: ${currentWord}`,
          });
        }
      }
      wordStart = -1;
      currentWord = '';
    } else {
      if (wordStart === -1) {
        wordStart = i;
      }
      currentWord += char;
    }
  }

  return links;
}

/**
 * Default word validation
 */
function isDefaultValidWord(word: string): boolean {
  // Must be at least 2 characters
  if (word.length < 2) return false;
  
  // Must not be purely numeric
  if (/^\d+$/.test(word)) return false;
  
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(word)) return false;
  
  // Must not be too long (likely not a meaningful identifier)
  if (word.length > 100) return false;

  return true;
}

/**
 * Detect compiler error patterns
 */
export function detectCompilerOutputLinks(line: string): TerminalLink[] {
  const links: TerminalLink[] = [];

  for (const pattern of COMPILER_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      const filePath = match[pattern.groups.path];
      const lineNum = parseInt(match[pattern.groups.line], 10);
      const colNum = pattern.groups.column ? parseInt(match[pattern.groups.column], 10) : undefined;

      if (!filePath || isNaN(lineNum)) continue;

      // Skip if path looks like a URL or protocol
      if (/^[a-z]+:\/\//i.test(filePath)) continue;

      // Find the actual position of the file path in the match
      const pathStartInMatch = match[0].indexOf(filePath);
      const startIndex = match.index + pathStartInMatch;

      // Calculate the full length including line:column
      let fullText = filePath;
      if (pattern.groups.column) {
        fullText = `${filePath}:${lineNum}:${colNum}`;
      } else {
        fullText = `${filePath}:${lineNum}`;
      }

      links.push({
        startIndex,
        length: fullText.length,
        text: fullText,
        type: 'file',
        tooltip: `Open ${filePath} at line ${lineNum}${colNum ? `, column ${colNum}` : ''}`,
        uri: `file://${filePath}`,
        range: { line: lineNum, column: colNum ?? 1 },
      });
    }
  }

  return links;
}

/**
 * Detect custom patterns
 */
function detectCustomPatterns(line: string, patterns: CustomLinkPattern[]): TerminalLink[] {
  const links: TerminalLink[] = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      const result = pattern.handler(match);
      if (result) {
        links.push({
          startIndex: match.index,
          length: match[0].length,
          text: match[0],
          type: 'custom',
          tooltip: result.tooltip,
          uri: result.uri,
        });
      }
    }
  }

  return links;
}

/**
 * Merge overlapping links (prefer more specific)
 */
export function mergeLinks(links: TerminalLink[]): TerminalLink[] {
  if (links.length <= 1) return links;

  // Sort by start index, then by length (longer first for same start)
  const sorted = [...links].sort((a, b) => {
    if (a.startIndex !== b.startIndex) {
      return a.startIndex - b.startIndex;
    }
    return b.length - a.length;
  });

  const merged: TerminalLink[] = [];

  // Priority order for link types (higher = more specific)
  const typePriority: Record<TerminalLinkType, number> = {
    'file': 5,
    'localFile': 4,
    'localFolder': 3,
    'url': 4,
    'custom': 2,
    'word': 1,
  };

  for (const link of sorted) {
    const linkEnd = link.startIndex + link.length;

    // Check if this link overlaps with any already merged link
    const overlappingIndex = merged.findIndex((existing) => {
      const existingEnd = existing.startIndex + existing.length;
      return !(linkEnd <= existing.startIndex || link.startIndex >= existingEnd);
    });

    if (overlappingIndex === -1) {
      // No overlap, add the link
      merged.push(link);
    } else {
      // Overlap found, keep the one with higher priority
      const existing = merged[overlappingIndex];
      const existingPriority = typePriority[existing.type] ?? 0;
      const newPriority = typePriority[link.type] ?? 0;

      // Prefer more specific type, or longer match for same priority
      if (newPriority > existingPriority || 
          (newPriority === existingPriority && link.length > existing.length)) {
        merged[overlappingIndex] = link;
      }
    }
  }

  // Sort final result by start index
  return merged.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Link provider interface for extensions
 */
export interface TerminalLinkProvider {
  provideTerminalLinks(context: TerminalLinkContext): Promise<TerminalLink[]>;
  handleTerminalLink(link: TerminalLink): Promise<void>;
}

export interface TerminalLinkContext {
  line: string;
  terminal: { name: string; cwd?: string };
}

/**
 * Create a default link provider
 */
export function createDefaultLinkProvider(options: LinkDetectionOptions = {}): TerminalLinkProvider {
  return {
    async provideTerminalLinks(context: TerminalLinkContext): Promise<TerminalLink[]> {
      const detectionOptions: LinkDetectionOptions = {
        ...options,
        cwd: context.terminal.cwd ?? options.cwd,
      };
      return detectLinks(context.line, detectionOptions);
    },

    async handleTerminalLink(link: TerminalLink): Promise<void> {
      // Default handler - can be overridden by extensions
      switch (link.type) {
        case 'url':
          // Would typically open in browser
          if (import.meta.env.DEV) console.log(`Opening URL: ${link.uri}`);
          break;
        case 'file':
        case 'localFile':
        case 'localFolder':
          // Would typically open in editor
          if (import.meta.env.DEV) console.log(`Opening file: ${link.uri}${link.range ? ` at ${link.range.line}:${link.range.column}` : ''}`);
          break;
        case 'word':
          // Would typically trigger search/go to definition
          if (import.meta.env.DEV) console.log(`Searching for: ${link.text}`);
          break;
        case 'custom':
          // Custom handler defined by pattern
          if (import.meta.env.DEV) console.log(`Custom link: ${link.text}`);
          break;
      }
    },
  };
}

/**
 * Composite link provider that combines multiple providers
 */
export class CompositeLinkProvider implements TerminalLinkProvider {
  private providers: TerminalLinkProvider[] = [];

  addProvider(provider: TerminalLinkProvider): void {
    this.providers.push(provider);
  }

  removeProvider(provider: TerminalLinkProvider): void {
    const index = this.providers.indexOf(provider);
    if (index !== -1) {
      this.providers.splice(index, 1);
    }
  }

  async provideTerminalLinks(context: TerminalLinkContext): Promise<TerminalLink[]> {
    const allLinks: TerminalLink[] = [];

    for (const provider of this.providers) {
      try {
        const links = await provider.provideTerminalLinks(context);
        allLinks.push(...links);
      } catch (error) {
        console.error('Link provider error:', error);
      }
    }

    return mergeLinks(allLinks);
  }

  async handleTerminalLink(link: TerminalLink): Promise<void> {
    // Use the first provider that can handle the link
    for (const provider of this.providers) {
      try {
        await provider.handleTerminalLink(link);
        return;
      } catch {
        // Try next provider
      }
    }
  }
}

/**
 * Utility: Extract all links from multiple lines
 */
export function detectLinksInBuffer(
  lines: string[],
  options: LinkDetectionOptions
): Map<number, TerminalLink[]> {
  const result = new Map<number, TerminalLink[]>();

  for (let i = 0; i < lines.length; i++) {
    const links = detectLinks(lines[i], options);
    if (links.length > 0) {
      result.set(i, links);
    }
  }

  return result;
}

/**
 * Utility: Find link at specific position in line
 */
export function findLinkAtPosition(
  line: string,
  position: number,
  options: LinkDetectionOptions
): TerminalLink | undefined {
  const links = detectLinks(line, options);
  
  return links.find((link) => {
    const linkEnd = link.startIndex + link.length;
    return position >= link.startIndex && position < linkEnd;
  });
}

/**
 * Utility: Validate and normalize URL
 */
export function normalizeUrl(url: string): string | undefined {
  try {
    // Handle URLs without protocol
    let normalizedUrl = url;
    if (!/^[a-z]+:\/\//i.test(url)) {
      normalizedUrl = `https://${url}`;
    }

    const parsed = new URL(normalizedUrl);
    return parsed.href;
  } catch {
    return undefined;
  }
}

/**
 * Utility: Check if string looks like a valid file path
 */
export function isLikelyFilePath(str: string): boolean {
  // Check for common file path indicators
  const hasPathSeparator = str.includes('/') || str.includes('\\');
  const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(str.replace(/:\d+(:\d+)?$/, ''));
  const startsWithDot = str.startsWith('./') || str.startsWith('../');
  const isAbsoluteUnix = str.startsWith('/');
  const isAbsoluteWindows = /^[A-Za-z]:[\\/]/.test(str);

  return hasPathSeparator && (hasFileExtension || startsWithDot || isAbsoluteUnix || isAbsoluteWindows);
}

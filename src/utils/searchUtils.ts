/**
 * Search Utilities
 * 
 * Provides tree view building, copy functions, and .code-search file format support.
 */

import { writeText } from "@tauri-apps/plugin-clipboard-manager";

// ============================================================================
// Types
// ============================================================================

export interface SearchMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchResult {
  file: string;
  matches: SearchMatch[];
}

export type SearchResultsViewMode = 'list' | 'tree';

export interface TreeNode {
  type: 'folder' | 'file' | 'match';
  path: string;
  name: string;
  children?: TreeNode[];
  match?: SearchMatch;
  expanded?: boolean;
  matchCount?: number;
  fileCount?: number;
}

export interface CopyOptions {
  includeLineNumbers: boolean;
  includeFilePaths: boolean;
  format: 'plain' | 'markdown' | 'json';
}

export interface CodeSearchFile {
  version: number;
  query: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  includePattern: string;
  excludePattern: string;
  contextLines: number;
  results: SearchResult[];
}

export interface CodeSearchFileFlags {
  isRegex: boolean;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
}

// ============================================================================
// Tree View Utilities
// ============================================================================

/**
 * Build a tree structure from flat search results
 * Groups results by folder hierarchy
 */
export function buildResultsTree(results: SearchResult[]): TreeNode[] {
  const root: Map<string, TreeNode> = new Map();
  
  for (const result of results) {
    const pathParts = result.file.replace(/\\/g, '/').split('/');
    let currentPath = '';
    let currentLevel = root;
    
    // Navigate/create folder nodes
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (!currentLevel.has(part)) {
        const folderNode: TreeNode = {
          type: 'folder',
          path: currentPath,
          name: part,
          children: [],
          expanded: true,
          matchCount: 0,
          fileCount: 0,
        };
        currentLevel.set(part, folderNode);
      }
      
      const folderNode = currentLevel.get(part)!;
      if (!folderNode.children) {
        folderNode.children = [];
      }
      
      // Convert children array to a map for efficient lookup
      const childMap = new Map<string, TreeNode>();
      for (const child of folderNode.children) {
        childMap.set(child.name, child);
      }
      currentLevel = childMap;
    }
    
    // Create file node
    const fileName = pathParts[pathParts.length - 1];
    const fileNode: TreeNode = {
      type: 'file',
      path: result.file,
      name: fileName,
      matchCount: result.matches.length,
      expanded: false,
      children: result.matches.map(match => ({
        type: 'match' as const,
        path: result.file,
        name: `Line ${match.line}: ${match.text.trim().slice(0, 60)}${match.text.length > 60 ? '...' : ''}`,
        match,
      })),
    };
    
    currentLevel.set(fileName, fileNode);
  }
  
  // Convert root map to array and calculate counts
  return convertMapToTreeArray(root);
}

function convertMapToTreeArray(map: Map<string, TreeNode>): TreeNode[] {
  const result: TreeNode[] = [];
  
  const values = Array.from(map.values());
  for (const node of values) {
    if (node.children && node.type === 'folder') {
      // Check if children is a Map (intermediate state) or already an array
      const childrenArray = Array.isArray(node.children) 
        ? node.children 
        : convertMapToTreeArray(node.children as unknown as Map<string, TreeNode>);
      
      node.children = childrenArray;
      
      // Calculate match and file counts
      let matchCount = 0;
      let fileCount = 0;
      for (const child of childrenArray) {
        if (child.type === 'file') {
          matchCount += child.matchCount || 0;
          fileCount += 1;
        } else if (child.type === 'folder') {
          matchCount += child.matchCount || 0;
          fileCount += child.fileCount || 0;
        }
      }
      node.matchCount = matchCount;
      node.fileCount = fileCount;
    }
    result.push(node);
  }
  
  // Sort: folders first, then files, alphabetically within each group
  return result.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Alternative tree builder that maintains the original flat structure
 * but groups by directory for display purposes
 */
export function buildSimpleTree(results: SearchResult[]): TreeNode[] {
  const folders = new Map<string, { files: SearchResult[]; matchCount: number }>();
  
  for (const result of results) {
    const normalizedPath = result.file.replace(/\\/g, '/');
    const lastSlash = normalizedPath.lastIndexOf('/');
    const folderPath = lastSlash > 0 ? normalizedPath.slice(0, lastSlash) : '';
    
    if (!folders.has(folderPath)) {
      folders.set(folderPath, { files: [], matchCount: 0 });
    }
    
    const folder = folders.get(folderPath)!;
    folder.files.push(result);
    folder.matchCount += result.matches.length;
  }
  
  const tree: TreeNode[] = [];
  
  // Sort folder paths
  const sortedFolders = Array.from(folders.entries()).sort((a, b) => 
    a[0].localeCompare(b[0])
  );
  
  for (const [folderPath, { files, matchCount }] of sortedFolders) {
    const folderNode: TreeNode = {
      type: 'folder',
      path: folderPath,
      name: folderPath || '(root)',
      matchCount,
      fileCount: files.length,
      expanded: true,
      children: files.map(result => ({
        type: 'file' as const,
        path: result.file,
        name: getFileName(result.file),
        matchCount: result.matches.length,
        expanded: false,
        children: result.matches.map(match => ({
          type: 'match' as const,
          path: result.file,
          name: match.text.trim(),
          match,
        })),
      })),
    };
    
    tree.push(folderNode);
  }
  
  return tree;
}

/**
 * Flatten tree for virtual scrolling
 */
export function flattenTree(
  nodes: TreeNode[], 
  expandedPaths: Set<string>,
  depth: number = 0
): Array<{ node: TreeNode; depth: number }> {
  const flat: Array<{ node: TreeNode; depth: number }> = [];
  
  for (const node of nodes) {
    flat.push({ node, depth });
    
    if (node.children && expandedPaths.has(node.path)) {
      flat.push(...flattenTree(node.children, expandedPaths, depth + 1));
    }
  }
  
  return flat;
}

// ============================================================================
// Copy Utilities
// ============================================================================

/**
 * Copy match text to clipboard
 */
export async function copyMatchText(match: SearchMatch): Promise<void> {
  try {
    await writeText(match.text.trim());
  } catch {
    await navigator.clipboard.writeText(match.text.trim());
  }
}

/**
 * Copy file path to clipboard
 */
export async function copyFilePath(filePath: string): Promise<void> {
  try {
    await writeText(filePath);
  } catch {
    await navigator.clipboard.writeText(filePath);
  }
}

/**
 * Copy relative file path to clipboard
 */
export async function copyRelativePath(filePath: string, projectPath: string): Promise<void> {
  const relativePath = filePath.replace(projectPath, '').replace(/^[\/\\]/, '');
  try {
    await writeText(relativePath);
  } catch {
    await navigator.clipboard.writeText(relativePath);
  }
}

/**
 * Copy full line to clipboard
 */
export async function copyLine(match: SearchMatch): Promise<void> {
  try {
    await writeText(match.text);
  } catch {
    await navigator.clipboard.writeText(match.text);
  }
}

/**
 * Copy file matches to clipboard
 */
export async function copyFileMatches(
  filePath: string, 
  matches: SearchMatch[], 
  options: CopyOptions
): Promise<void> {
  const text = formatFileMatches(filePath, matches, options);
  try {
    await writeText(text);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}

/**
 * Copy all results to clipboard
 */
export async function copyAllResults(
  results: SearchResult[], 
  options: CopyOptions
): Promise<void> {
  const text = formatAllResults(results, options);
  try {
    await writeText(text);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}

/**
 * Format file matches for copying
 */
function formatFileMatches(
  filePath: string, 
  matches: SearchMatch[], 
  options: CopyOptions
): string {
  switch (options.format) {
    case 'markdown':
      return formatFileMatchesMarkdown(filePath, matches, options);
    case 'json':
      return JSON.stringify({ file: filePath, matches }, null, 2);
    case 'plain':
    default:
      return formatFileMatchesPlain(filePath, matches, options);
  }
}

function formatFileMatchesPlain(
  filePath: string, 
  matches: SearchMatch[], 
  options: CopyOptions
): string {
  const lines: string[] = [];
  
  if (options.includeFilePaths) {
    lines.push(filePath);
  }
  
  for (const match of matches) {
    let line = '';
    if (options.includeLineNumbers) {
      line += `${match.line}: `;
    }
    line += match.text.trim();
    lines.push(line);
  }
  
  return lines.join('\n');
}

function formatFileMatchesMarkdown(
  filePath: string, 
  matches: SearchMatch[], 
  options: CopyOptions
): string {
  const lines: string[] = [];
  
  if (options.includeFilePaths) {
    lines.push(`### ${filePath}`);
    lines.push('');
  }
  
  lines.push('```');
  for (const match of matches) {
    let line = '';
    if (options.includeLineNumbers) {
      line += `${match.line}: `;
    }
    line += match.text.trim();
    lines.push(line);
  }
  lines.push('```');
  
  return lines.join('\n');
}

/**
 * Format all results for copying
 */
function formatAllResults(results: SearchResult[], options: CopyOptions): string {
  switch (options.format) {
    case 'markdown':
      return formatAllResultsMarkdown(results, options);
    case 'json':
      return JSON.stringify(results, null, 2);
    case 'plain':
    default:
      return formatAllResultsPlain(results, options);
  }
}

function formatAllResultsPlain(results: SearchResult[], options: CopyOptions): string {
  const sections: string[] = [];
  
  for (const result of results) {
    sections.push(formatFileMatchesPlain(result.file, result.matches, options));
  }
  
  return sections.join('\n\n');
}

function formatAllResultsMarkdown(results: SearchResult[], options: CopyOptions): string {
  const sections: string[] = [];
  
  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
  sections.push(`# Search Results`);
  sections.push(`**${totalMatches} matches** in **${results.length} files**`);
  sections.push('');
  
  for (const result of results) {
    sections.push(formatFileMatchesMarkdown(result.file, result.matches, { 
      ...options, 
      includeFilePaths: true 
    }));
    sections.push('');
  }
  
  return sections.join('\n');
}

// ============================================================================
// .code-search File Format
// ============================================================================

const CODE_SEARCH_VERSION = 1;

/**
 * Serialize search state to .code-search file format
 */
export function serializeToCodeSearch(state: {
  query: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  includePattern: string;
  excludePattern: string;
  contextLines: number;
  results: SearchResult[];
}): string {
  const lines: string[] = [];
  
  // Header comments
  lines.push(`# Query: ${state.query}`);
  
  // Flags
  const flags: string[] = [];
  if (state.isRegex) flags.push('RegExp');
  if (!state.isCaseSensitive) flags.push('IgnoreCase');
  if (state.isWholeWord) flags.push('WholeWord');
  if (flags.length > 0) {
    lines.push(`# Flags: ${flags.join(' ')}`);
  }
  
  // Patterns
  if (state.includePattern) {
    lines.push(`# Including: ${state.includePattern}`);
  }
  if (state.excludePattern) {
    lines.push(`# Excluding: ${state.excludePattern}`);
  }
  
  // Context lines
  if (state.contextLines > 0) {
    lines.push(`# ContextLines: ${state.contextLines}`);
  }
  
  lines.push('');
  
  // Results
  for (const result of state.results) {
    lines.push(`${result.file}:`);
    for (const match of result.matches) {
      const lineNum = String(match.line).padStart(4, ' ');
      lines.push(`  ${lineNum}:   ${match.text.trim()}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Parse .code-search file content
 */
export function parseCodeSearchFile(content: string): CodeSearchFile {
  const lines = content.split('\n');
  
  let query = '';
  let isRegex = false;
  let isCaseSensitive = true;
  let isWholeWord = false;
  let includePattern = '';
  let excludePattern = '';
  let contextLines = 0;
  const results: SearchResult[] = [];
  
  let currentFile: string | null = null;
  let currentMatches: SearchMatch[] = [];
  
  for (const line of lines) {
    // Parse header comments
    if (line.startsWith('# Query:')) {
      query = line.slice('# Query:'.length).trim();
      continue;
    }
    
    if (line.startsWith('# Flags:')) {
      const flagsStr = line.slice('# Flags:'.length).trim();
      const flags = flagsStr.split(' ');
      isRegex = flags.includes('RegExp');
      isCaseSensitive = !flags.includes('IgnoreCase');
      isWholeWord = flags.includes('WholeWord');
      continue;
    }
    
    if (line.startsWith('# Including:')) {
      includePattern = line.slice('# Including:'.length).trim();
      continue;
    }
    
    if (line.startsWith('# Excluding:')) {
      excludePattern = line.slice('# Excluding:'.length).trim();
      continue;
    }
    
    if (line.startsWith('# ContextLines:')) {
      contextLines = parseInt(line.slice('# ContextLines:'.length).trim(), 10) || 0;
      continue;
    }
    
    // Skip other comments and empty lines
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }
    
    // File path line (ends with :)
    if (!line.startsWith(' ') && line.endsWith(':')) {
      // Save previous file if any
      if (currentFile) {
        results.push({ file: currentFile, matches: currentMatches });
      }
      currentFile = line.slice(0, -1);
      currentMatches = [];
      continue;
    }
    
    // Match line (indented with line number)
    const matchLine = line.match(/^\s+(\d+):\s+(.*)$/);
    if (matchLine && currentFile) {
      const lineNum = parseInt(matchLine[1], 10);
      const text = matchLine[2];
      currentMatches.push({
        line: lineNum,
        column: 1,
        text,
        matchStart: 0,
        matchEnd: 0, // We don't preserve match positions
      });
    }
  }
  
  // Save last file
  if (currentFile && currentMatches.length > 0) {
    results.push({ file: currentFile, matches: currentMatches });
  }
  
  return {
    version: CODE_SEARCH_VERSION,
    query,
    isRegex,
    isCaseSensitive,
    isWholeWord,
    includePattern,
    excludePattern,
    contextLines,
    results,
  };
}

/**
 * Check if a file is a .code-search file
 */
export function isCodeSearchFile(path: string): boolean {
  return path.toLowerCase().endsWith('.code-search');
}

/**
 * Generate a default filename for saving search results
 */
export function generateCodeSearchFilename(query: string): string {
  const sanitized = query
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 30);
  const timestamp = new Date().toISOString().slice(0, 10);
  return `search-${sanitized || 'results'}-${timestamp}.code-search`;
}

// ============================================================================
// Helpers
// ============================================================================

function getFileName(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

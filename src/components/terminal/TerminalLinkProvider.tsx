/**
 * =============================================================================
 * TERMINAL LINK PROVIDER
 * =============================================================================
 *
 * Provides clickable link detection and handling for the terminal.
 * Detects URLs, file paths, and error locations (file:line:col).
 *
 * Link types:
 * - URLs (http/https): Opens in default browser
 * - File paths (absolute and relative): Opens in editor
 * - Error locations (file.ts:10:5): Opens in editor at line/column
 *
 * VS Code-compatible patterns:
 * - Standard URLs
 * - Windows and Unix file paths
 * - Compiler error formats (gcc, typescript, rust, etc.)
 *
 * Usage:
 *   const linkProvider = useTerminalLinkProvider();
 *   
 *   // Register with xterm.js
 *   terminal.registerLinkProvider(linkProvider.createLinkProvider(terminalId));
 * =============================================================================
 */

import { invoke } from "@tauri-apps/api/core";
import { terminalLogger } from "../../utils/logger";

// =============================================================================
// TYPES
// =============================================================================

export interface TerminalLink {
  /** Start index of link in line */
  startIndex: number;
  /** Length of link text */
  length: number;
  /** The detected link text */
  text: string;
  /** Type of link */
  type: "url" | "file" | "error-location";
  /** For file/error-location: file path */
  filePath?: string;
  /** For error-location: line number (1-based) */
  line?: number;
  /** For error-location: column number (1-based) */
  column?: number;
}

export interface LinkProviderOptions {
  /** Callback when a URL link is activated */
  onUrlClick?: (url: string) => void;
  /** Callback when a file link is activated */
  onFileClick?: (filePath: string, line?: number, column?: number) => void;
  /** Current working directory for resolving relative paths */
  cwd?: string;
  /** Enable/disable link detection */
  enabled?: boolean;
}

// =============================================================================
// PATTERNS
// =============================================================================

/** URL pattern - matches http, https, ftp protocols */
const URL_PATTERN = /\bhttps?:\/\/[^\s<>\[\]"'`]+(?<!\)|,|\.)/gi;

/** Absolute file path patterns */
const UNIX_ABSOLUTE_PATH = /(?:^|\s)(\/[^\s:*?"<>|]+)/g;
const WINDOWS_ABSOLUTE_PATH = /(?:^|\s)([A-Za-z]:\\[^\s:*?"<>|]+)/g;

/** Error location patterns - file:line or file:line:col */
const ERROR_LOCATION_PATTERNS = [
  // TypeScript/JavaScript: file.ts(10,5) or file.ts:10:5
  /([^\s()\[\]{}:]+\.[a-z]{1,10})(?:\((\d+),(\d+)\)|:(\d+)(?::(\d+))?)/gi,
  // Rust: --> src/main.rs:10:5
  /-->\s+([^\s:]+):(\d+):(\d+)/g,
  // GCC/Clang: file.c:10:5: error
  /([^\s:]+):(\d+):(\d+):\s*(?:error|warning|note)/gi,
  // Python: File "path.py", line 10
  /File\s+"([^"]+)",\s*line\s+(\d+)/gi,
  // Go: file.go:10:5:
  /([^\s:]+\.go):(\d+)(?::(\d+))?:/g,
  // Node.js stack trace: at file.js:10:5
  /at\s+(?:[^\s]+\s+\()?([^\s()]+):(\d+):(\d+)\)?/g,
  // Generic file:line:col at word boundary
  /\b([^\s:*?"<>|]+\.[a-zA-Z]{1,10}):(\d+)(?::(\d+))?\b/g,
];

/** Relative path pattern (starts with ./ or ../) */
const RELATIVE_PATH_PATTERN = /(?:^|\s)(\.\.?\/[^\s:*?"<>|]+)/g;

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Resolve a relative path against a base directory
 */
function resolvePath(relativePath: string, cwd?: string): string {
  if (!cwd) return relativePath;
  
  // Normalize separators
  const normalizedCwd = cwd.replace(/\\/g, "/");
  const normalizedPath = relativePath.replace(/\\/g, "/");
  
  if (normalizedPath.startsWith("/")) {
    return normalizedPath;
  }
  
  const parts = [...normalizedCwd.split("/"), ...normalizedPath.split("/")];
  const resolved: string[] = [];
  
  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }
  
  // Restore drive letter for Windows
  if (cwd.match(/^[A-Za-z]:/)) {
    return resolved.join("/");
  }
  
  return "/" + resolved.join("/");
}

/**
 * Check if a path looks like a file (has extension or exists)
 */
function looksLikeFile(path: string): boolean {
  // Has common file extension
  const extMatch = path.match(/\.([a-zA-Z0-9]{1,10})$/);
  if (extMatch) {
    const ext = extMatch[1].toLowerCase();
    // Common extensions that are definitely files
    const fileExtensions = new Set([
      "ts", "tsx", "js", "jsx", "mjs", "cjs",
      "py", "pyw", "rb", "php",
      "rs", "go", "java", "kt", "scala", "swift",
      "c", "cpp", "cc", "h", "hpp",
      "cs", "fs",
      "lua", "pl", "r", "jl",
      "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd",
      "json", "yaml", "yml", "toml", "xml", "html", "css", "scss",
      "md", "txt", "log", "conf", "cfg", "ini",
      "sql", "graphql", "proto",
      "vue", "svelte", "astro",
    ]);
    return fileExtensions.has(ext);
  }
  return false;
}

/**
 * Detect all links in a line of text
 */
export function detectLinks(line: string, cwd?: string): TerminalLink[] {
  const links: TerminalLink[] = [];
  const usedRanges: Array<[number, number]> = [];
  
  // Helper to check if range overlaps with existing
  const isOverlapping = (start: number, end: number): boolean => {
    return usedRanges.some(([s, e]) => 
      (start >= s && start < e) || (end > s && end <= e) || (start <= s && end >= e)
    );
  };
  
  // 1. Detect URLs first (highest priority)
  let match: RegExpExecArray | null;
  while ((match = URL_PATTERN.exec(line)) !== null) {
    const start = match.index;
    const text = match[0];
    if (!isOverlapping(start, start + text.length)) {
      links.push({
        startIndex: start,
        length: text.length,
        text,
        type: "url",
      });
      usedRanges.push([start, start + text.length]);
    }
  }
  URL_PATTERN.lastIndex = 0;
  
  // 2. Detect error locations (file:line:col patterns)
  for (const pattern of ERROR_LOCATION_PATTERNS) {
    while ((match = pattern.exec(line)) !== null) {
      const start = match.index;
      const fullMatch = match[0];
      const filePath = match[1];
      const lineNum = parseInt(match[2] || match[4], 10);
      const colNum = parseInt(match[3] || match[5], 10) || undefined;
      
      if (!isOverlapping(start, start + fullMatch.length) && looksLikeFile(filePath)) {
        const resolvedPath = filePath.startsWith(".") ? resolvePath(filePath, cwd) : filePath;
        links.push({
          startIndex: start,
          length: fullMatch.length,
          text: fullMatch,
          type: "error-location",
          filePath: resolvedPath,
          line: lineNum,
          column: colNum,
        });
        usedRanges.push([start, start + fullMatch.length]);
      }
    }
    pattern.lastIndex = 0;
  }
  
  // 3. Detect absolute file paths
  while ((match = UNIX_ABSOLUTE_PATH.exec(line)) !== null) {
    const start = match.index + (match[0].length - match[1].length);
    const text = match[1];
    if (!isOverlapping(start, start + text.length) && looksLikeFile(text)) {
      links.push({
        startIndex: start,
        length: text.length,
        text,
        type: "file",
        filePath: text,
      });
      usedRanges.push([start, start + text.length]);
    }
  }
  UNIX_ABSOLUTE_PATH.lastIndex = 0;
  
  while ((match = WINDOWS_ABSOLUTE_PATH.exec(line)) !== null) {
    const start = match.index + (match[0].length - match[1].length);
    const text = match[1];
    if (!isOverlapping(start, start + text.length) && looksLikeFile(text)) {
      links.push({
        startIndex: start,
        length: text.length,
        text,
        type: "file",
        filePath: text,
      });
      usedRanges.push([start, start + text.length]);
    }
  }
  WINDOWS_ABSOLUTE_PATH.lastIndex = 0;
  
  // 4. Detect relative paths
  while ((match = RELATIVE_PATH_PATTERN.exec(line)) !== null) {
    const start = match.index + (match[0].length - match[1].length);
    const text = match[1];
    if (!isOverlapping(start, start + text.length) && looksLikeFile(text)) {
      const resolvedPath = resolvePath(text, cwd);
      links.push({
        startIndex: start,
        length: text.length,
        text,
        type: "file",
        filePath: resolvedPath,
      });
      usedRanges.push([start, start + text.length]);
    }
  }
  RELATIVE_PATH_PATTERN.lastIndex = 0;
  
  // Sort by start index
  return links.sort((a, b) => a.startIndex - b.startIndex);
}

// =============================================================================
// LINK HANDLER
// =============================================================================

/**
 * Handle link activation
 */
export async function handleLinkClick(
  link: TerminalLink,
  options?: LinkProviderOptions
): Promise<void> {
  switch (link.type) {
    case "url": {
      // Open URL in default browser
      if (options?.onUrlClick) {
        options.onUrlClick(link.text);
      } else {
        try {
          await invoke("shell_open", { path: link.text });
        } catch (e) {
          terminalLogger.error("[TerminalLinkProvider] Failed to open URL:", e);
          // Fallback to window.open
          window.open(link.text, "_blank");
        }
      }
      break;
    }
    
    case "file":
    case "error-location": {
      // Open file in editor
      const filePath = link.filePath!;
      const line = link.line;
      const column = link.column;
      
      if (options?.onFileClick) {
        options.onFileClick(filePath, line, column);
      } else {
        // Dispatch event for editor to handle
        window.dispatchEvent(new CustomEvent("editor:open-file", {
          detail: {
            path: filePath,
            line,
            column,
            fromTerminal: true,
          }
        }));
      }
      break;
    }
  }
}

// =============================================================================
// XTERM.JS LINK PROVIDER FACTORY
// =============================================================================

/**
 * Create an xterm.js compatible link provider
 */
export function createXtermLinkProvider(
  _options?: LinkProviderOptions
) {
  return {
    provideLinks: (_lineIndex: number, callback: (links: any[]) => void) => {
      // This will be called by xterm.js for each visible line
      // Return empty for now - actual implementation requires terminal buffer access
      callback([]);
    },
  };
}

// =============================================================================
// HOOK FOR TERMINAL COMPONENTS
// =============================================================================

export interface UseTerminalLinkProviderReturn {
  /** Detect links in a line of text */
  detectLinks: (line: string) => TerminalLink[];
  /** Handle link click */
  handleClick: (link: TerminalLink) => Promise<void>;
  /** Check if a character position is within a link */
  getLinkAt: (line: string, charIndex: number) => TerminalLink | null;
}

/**
 * Hook for terminal link detection and handling
 */
export function useTerminalLinkProvider(
  options?: LinkProviderOptions
): UseTerminalLinkProviderReturn {
  const cwd = options?.cwd;
  
  const detectLinksInLine = (line: string): TerminalLink[] => {
    if (options?.enabled === false) return [];
    return detectLinks(line, cwd);
  };
  
  const handleClick = async (link: TerminalLink): Promise<void> => {
    await handleLinkClick(link, options);
  };
  
  const getLinkAt = (line: string, charIndex: number): TerminalLink | null => {
    const links = detectLinksInLine(line);
    for (const link of links) {
      if (charIndex >= link.startIndex && charIndex < link.startIndex + link.length) {
        return link;
      }
    }
    return null;
  };
  
  return {
    detectLinks: detectLinksInLine,
    handleClick,
    getLinkAt,
  };
}

export default useTerminalLinkProvider;

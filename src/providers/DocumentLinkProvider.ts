/**
 * Monaco Document Link Provider
 *
 * Provides document link detection and navigation for Monaco editor using LSP.
 * Features:
 * - Register monaco.languages.registerLinkProvider
 * - Detect URLs (http/https) in comments and strings
 * - Detect file paths (./relative, ../parent, absolute)
 * - Show underline on Ctrl+hover
 * - Open in browser or navigate to file on Ctrl+click
 */

import type * as Monaco from "monaco-editor";
import type { Range } from "@/context/LSPContext";

// ============================================================================
// Types
// ============================================================================

/**
 * Document link returned from LSP textDocument/documentLink.
 */
export interface DocumentLink {
  /** The range this link spans in the document */
  range: Range;
  /** The target URI this link points to (may need resolving) */
  target?: string;
  /** Tooltip shown when hovering over the link */
  tooltip?: string;
  /** Data preserved between documentLink and documentLink/resolve requests */
  data?: unknown;
}

/**
 * Options for creating a document link provider.
 */
export interface DocumentLinkProviderOptions {
  /** Monaco editor instance */
  monaco: typeof Monaco;
  /** Language ID to register the provider for */
  languageId: string;
  /** LSP server ID */
  serverId: string;
  /** File path/URI */
  filePath: string;
  /** Base directory for resolving relative paths */
  basePath: string;
  /** Function to get document links from LSP */
  getDocumentLinks: (serverId: string, uri: string) => Promise<DocumentLink[]>;
  /** Function to resolve a document link */
  resolveDocumentLink: (serverId: string, link: DocumentLink) => Promise<DocumentLink>;
  /** Callback when a link is clicked */
  onLinkClick?: (target: string, isExternal: boolean) => void;
}

/**
 * Result of creating a document link provider.
 */
export interface DocumentLinkProviderResult {
  /** Disposable to clean up the provider */
  provider: Monaco.IDisposable;
  /** Function to refresh links */
  refresh: () => void;
}

// ============================================================================
// Link Detection Patterns
// ============================================================================

/**
 * Patterns for detecting links in different contexts.
 */
const LINK_PATTERNS = {
  // URL patterns: http, https, ftp
  url: /\b(https?|ftp):\/\/[^\s<>\[\]{}()"']+/gi,

  // File protocol
  file: /\bfile:\/\/[^\s<>\[\]{}()"']+/gi,

  // Relative paths starting with ./ or ../
  relativePath: /(?:^|\s|["'`])(\.\.\?\/[^\s<>\[\]{}()"'`]+)/g,

  // Import/require paths in JavaScript/TypeScript
  importPath: /(?:from\s+|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g,

  // CSS url() paths
  cssUrl: /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi,

  // HTML src/href attributes
  htmlAttr: /(?:src|href)\s*=\s*['"]([^'"]+)['"]/gi,

  // Markdown links
  markdownLink: /\[([^\]]+)\]\(([^)]+)\)/g,

  // Plain file paths (Unix-style)
  unixPath: /(?:^|\s|["'`])(\/?(?:[\w.-]+\/)+[\w.-]+)/g,

  // Windows file paths
  windowsPath: /[A-Za-z]:\\(?:[^\s<>\[\]{}()"'\\]+\\?)+/gi,
};

/**
 * Link types for categorization.
 */
export type LinkType = "url" | "file" | "import" | "relative" | "unknown";

/**
 * Parsed link information.
 */
export interface ParsedLink {
  /** The raw text matched */
  text: string;
  /** The target URI/path */
  target: string;
  /** Link type */
  type: LinkType;
  /** Start offset in the line */
  startOffset: number;
  /** End offset in the line */
  endOffset: number;
  /** Tooltip text */
  tooltip?: string;
}

// ============================================================================
// Link Utilities
// ============================================================================

/**
 * Check if a string is an external URL.
 */
export function isExternalUrl(str: string): boolean {
  return /^(https?|ftp):\/\//i.test(str);
}

/**
 * Check if a string is a file path.
 */
export function isFilePath(str: string): boolean {
  // Windows path
  if (/^[A-Za-z]:\\/.test(str)) return true;
  // Unix absolute path
  if (str.startsWith("/")) return true;
  // Relative path
  if (str.startsWith("./") || str.startsWith("../")) return true;
  // File protocol
  if (str.startsWith("file://")) return true;
  return false;
}

/**
 * Normalize a file path.
 */
export function normalizePath(path: string): string {
  // Remove file:// protocol if present
  if (path.startsWith("file://")) {
    path = path.substring(7);
    // Handle Windows file:///C:/... format
    if (path.startsWith("/") && /^\/[A-Za-z]:/.test(path)) {
      path = path.substring(1);
    }
  }

  // Normalize slashes to forward slashes for consistency
  return path.replace(/\\/g, "/");
}

/**
 * Resolve a relative path against a base path.
 */
export function resolvePath(basePath: string, relativePath: string): string {
  if (isExternalUrl(relativePath)) return relativePath;

  const normalizedBase = normalizePath(basePath);
  const normalizedRelative = normalizePath(relativePath);

  // If already absolute, return as-is
  if (normalizedRelative.startsWith("/") || /^[A-Za-z]:/.test(normalizedRelative)) {
    return normalizedRelative;
  }

  // Get the directory of the base path
  const baseDir = normalizedBase.includes("/")
    ? normalizedBase.substring(0, normalizedBase.lastIndexOf("/"))
    : normalizedBase;

  // Split paths into segments
  const baseParts = baseDir.split("/").filter(Boolean);
  const relativeParts = normalizedRelative.split("/");

  const resultParts = [...baseParts];

  for (const part of relativeParts) {
    if (part === "..") {
      resultParts.pop();
    } else if (part !== "." && part !== "") {
      resultParts.push(part);
    }
  }

  // Reconstruct path
  const isWindowsPath = /^[A-Za-z]:/.test(normalizedBase);
  if (isWindowsPath) {
    return resultParts.join("/");
  }

  return "/" + resultParts.join("/");
}

/**
 * Get tooltip text for a link.
 */
export function getLinkTooltip(target: string, type: LinkType): string {
  switch (type) {
    case "url":
      return `Open URL: ${target}`;
    case "file":
      return `Open file: ${target}`;
    case "import":
      return `Go to module: ${target}`;
    case "relative":
      return `Open: ${target}`;
    default:
      return `Follow link: ${target}`;
  }
}

/**
 * Determine link type from target string.
 */
export function getLinkType(target: string): LinkType {
  if (isExternalUrl(target)) return "url";
  if (target.startsWith("file://")) return "file";
  if (target.startsWith("./") || target.startsWith("../")) return "relative";
  if (isFilePath(target)) return "file";
  return "unknown";
}

// ============================================================================
// Link Parsing
// ============================================================================

/**
 * Parse links from a line of text.
 */
export function parseLinksFromLine(
  lineText: string,
  _lineNumber: number,
  languageId: string
): ParsedLink[] {
  const links: ParsedLink[] = [];
  const seenRanges = new Set<string>();

  const addLink = (
    text: string,
    target: string,
    type: LinkType,
    startOffset: number,
    endOffset: number
  ) => {
    const rangeKey = `${startOffset}-${endOffset}`;
    if (!seenRanges.has(rangeKey)) {
      seenRanges.add(rangeKey);
      links.push({
        text,
        target,
        type,
        startOffset,
        endOffset,
        tooltip: getLinkTooltip(target, type),
      });
    }
  };

  // Find URLs
  const urlMatches = Array.from(lineText.matchAll(LINK_PATTERNS.url));
  for (const match of urlMatches) {
    addLink(match[0], match[0], "url", match.index!, match.index! + match[0].length);
  }

  // Find file:// URLs
  const fileMatches = Array.from(lineText.matchAll(LINK_PATTERNS.file));
  for (const match of fileMatches) {
    addLink(match[0], match[0], "file", match.index!, match.index! + match[0].length);
  }

  // Find import/require paths for JS/TS
  if (["javascript", "javascriptreact", "typescript", "typescriptreact"].includes(languageId)) {
    const importMatches = Array.from(lineText.matchAll(LINK_PATTERNS.importPath));
    for (const match of importMatches) {
      if (match[1] && !match[1].startsWith("@")) {
        // Skip @scoped packages
        const fullMatch = match[0];
        const path = match[1];
        const pathStart = match.index! + fullMatch.indexOf(path);
        addLink(path, path, "import", pathStart, pathStart + path.length);
      }
    }
  }

  // Find relative paths
  const relativeMatches = Array.from(lineText.matchAll(LINK_PATTERNS.relativePath));
  for (const match of relativeMatches) {
    const path = match[1];
    if (path) {
      const fullMatch = match[0];
      const pathStart = match.index! + fullMatch.indexOf(path);
      addLink(path, path, "relative", pathStart, pathStart + path.length);
    }
  }

  // Find CSS url() paths
  if (["css", "scss", "sass", "less", "stylus"].includes(languageId)) {
    const cssUrlMatches = Array.from(lineText.matchAll(LINK_PATTERNS.cssUrl));
    for (const match of cssUrlMatches) {
      const path = match[1];
      if (path && !path.startsWith("data:")) {
        const fullMatch = match[0];
        const pathStart = match.index! + fullMatch.indexOf(path);
        const type = isExternalUrl(path) ? "url" : "relative";
        addLink(path, path, type, pathStart, pathStart + path.length);
      }
    }
  }

  // Find HTML src/href
  if (["html", "vue", "svelte", "astro"].includes(languageId)) {
    const htmlAttrMatches = Array.from(lineText.matchAll(LINK_PATTERNS.htmlAttr));
    for (const match of htmlAttrMatches) {
      const path = match[1];
      if (path && !path.startsWith("#") && !path.startsWith("javascript:")) {
        const fullMatch = match[0];
        const pathStart = match.index! + fullMatch.indexOf(path);
        const type = isExternalUrl(path) ? "url" : "relative";
        addLink(path, path, type, pathStart, pathStart + path.length);
      }
    }
  }

  // Find Markdown links
  if (languageId === "markdown") {
    const mdMatches = Array.from(lineText.matchAll(LINK_PATTERNS.markdownLink));
    for (const match of mdMatches) {
      const target = match[2];
      if (target) {
        const fullMatch = match[0];
        const targetStart = match.index! + fullMatch.indexOf("(") + 1;
        const type = isExternalUrl(target) ? "url" : "relative";
        addLink(target, target, type, targetStart, targetStart + target.length);
      }
    }
  }

  return links;
}

// ============================================================================
// Document Link Provider
// ============================================================================

/**
 * Supported languages for document link provider.
 */
export const DOCUMENT_LINK_LANGUAGES = [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "css",
  "scss",
  "sass",
  "less",
  "stylus",
  "html",
  "vue",
  "svelte",
  "astro",
  "markdown",
  "json",
  "jsonc",
  "yaml",
  "toml",
  "xml",
  "python",
  "rust",
  "go",
  "java",
  "csharp",
  "cpp",
  "c",
  "php",
  "ruby",
  "shell",
  "bash",
  "powershell",
];

/**
 * Create a Monaco document link provider for LSP integration.
 */
export function createDocumentLinkProvider(
  options: DocumentLinkProviderOptions
): DocumentLinkProviderResult {
  const {
    monaco,
    languageId,
    serverId,
    filePath,
    basePath,
    getDocumentLinks,
    resolveDocumentLink,
    onLinkClick,
  } = options;

  const provider = monaco.languages.registerLinkProvider(languageId, {
    async provideLinks(
      model: Monaco.editor.ITextModel,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.ILinksList | null> {
      // Verify this is the correct model
      const modelUri = model.uri.toString();
      const fileUri = `file://${filePath.replace(/\\/g, "/")}`;
      if (!modelUri.includes(filePath.replace(/\\/g, "/")) && modelUri !== fileUri) {
        return null;
      }

      try {
        // Try to get links from LSP first
        const lspLinks = await getDocumentLinks(serverId, filePath);

        if (lspLinks && lspLinks.length > 0) {
          const links: Monaco.languages.ILink[] = lspLinks.map((link) => ({
            range: new monaco.Range(
              link.range.start.line + 1,
              link.range.start.character + 1,
              link.range.end.line + 1,
              link.range.end.character + 1
            ),
            url: link.target,
            tooltip: link.tooltip,
          }));

          return { links };
        }

        // Fallback: Parse links from document text
        return { links: parseLinksFromDocument(monaco, model, languageId, basePath) };
      } catch (e) {
        console.debug("Document link provider error (falling back to local parsing):", e);
        // Fallback to local link parsing
        return { links: parseLinksFromDocument(monaco, model, languageId, basePath) };
      }
    },

    async resolveLink(
      link: Monaco.languages.ILink,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.ILink | null> {
      // If link already has a URL, return as-is
      if (link.url) {
        return link;
      }

      try {
        // Try to resolve through LSP
        const lspRange: Range = {
          start: {
            line: link.range.startLineNumber - 1,
            character: link.range.startColumn - 1,
          },
          end: {
            line: link.range.endLineNumber - 1,
            character: link.range.endColumn - 1,
          },
        };

        const resolved = await resolveDocumentLink(serverId, {
          range: lspRange,
          target: link.url?.toString(),
          tooltip: link.tooltip,
        });

        if (resolved.target) {
          return {
            ...link,
            url: resolved.target,
            tooltip: resolved.tooltip || link.tooltip,
          };
        }
      } catch (e) {
        console.debug("Link resolve error:", e);
      }

      return link;
    },
  });

  // Register link opener command if callback provided
  let commandDisposable: Monaco.IDisposable | undefined;
  if (onLinkClick) {
    commandDisposable = monaco.editor.registerCommand(
      "orion.openLink",
      (_accessor, target: string) => {
        const isExternal = isExternalUrl(target);
        onLinkClick(target, isExternal);
      }
    );
  }

  return {
    provider: {
      dispose: () => {
        provider.dispose();
        commandDisposable?.dispose();
      },
    },
    refresh: () => {
      // Monaco will automatically refresh links when the model changes
      // This is mainly a placeholder for potential future optimizations
    },
  };
}

/**
 * Parse links from document text (fallback when LSP unavailable).
 */
function parseLinksFromDocument(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  languageId: string,
  basePath: string
): Monaco.languages.ILink[] {
  const links: Monaco.languages.ILink[] = [];
  const lineCount = model.getLineCount();

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const lineText = model.getLineContent(lineNumber);
    const parsedLinks = parseLinksFromLine(lineText, lineNumber, languageId);

    for (const parsed of parsedLinks) {
      // Resolve relative paths
      let target = parsed.target;
      if (parsed.type === "relative" || parsed.type === "import") {
        target = resolvePath(basePath, parsed.target);
        // Convert to file:// URL
        if (!target.startsWith("file://")) {
          target = `file://${target.startsWith("/") ? "" : "/"}${target}`;
        }
      }

      links.push({
        range: new monaco.Range(
          lineNumber,
          parsed.startOffset + 1,
          lineNumber,
          parsed.endOffset + 1
        ),
        url: target,
        tooltip: parsed.tooltip,
      });
    }
  }

  return links;
}

/**
 * Get Monaco editor options for document link styling.
 */
export function getDocumentLinkEditorOptions(): Monaco.editor.IEditorOptions {
  return {
    links: true,
  };
}

/**
 * Open a link in the appropriate application.
 * For external URLs, opens in browser.
 * For file paths, opens in editor.
 */
export async function openLink(
  target: string,
  options?: {
    openInBrowser?: (url: string) => Promise<void>;
    openInEditor?: (filePath: string) => Promise<void>;
  }
): Promise<void> {
  const isExternal = isExternalUrl(target);

  if (isExternal) {
    if (options?.openInBrowser) {
      await options.openInBrowser(target);
    } else {
      // Fallback: try window.open
      window.open(target, "_blank", "noopener,noreferrer");
    }
  } else {
    // It's a file path
    const filePath = normalizePath(target);
    if (options?.openInEditor) {
      await options.openInEditor(filePath);
    }
  }
}

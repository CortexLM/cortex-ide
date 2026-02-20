/**
 * Emmet utilities for HTML/JSX/XML tag balancing and wrapping.
 * Provides Balance Inward, Balance Outward, Wrap with Abbreviation, and Emmet Expand functionality.
 */
import type * as Monaco from "monaco-editor";
import * as emmetModule from "emmet";

// Get the default export which is the expand function
const emmet = (emmetModule as unknown as { default: (abbr: string, config?: unknown) => string }).default;

// ============================================================================
// Types
// ============================================================================

/** Represents a parsed tag with its position and properties */
interface ParsedTag {
  name: string;
  isClosing: boolean;
  isSelfClosing: boolean;
  startOffset: number;
  endOffset: number;
  innerStart?: number;
  innerEnd?: number;
}

/** Represents a matched tag pair (opening + closing) */
interface TagPair {
  opening: ParsedTag;
  closing: ParsedTag | null;
  innerStart: number;
  innerEnd: number;
  outerStart: number;
  outerEnd: number;
}

/** Emmet abbreviation expansion result */
interface ExpansionResult {
  openingTag: string;
  closingTag: string;
  attributes: Record<string, string>;
}

// ============================================================================
// Tag Parsing
// ============================================================================

/**
 * Parse all tags from content, supporting HTML, JSX, and XML.
 * Handles self-closing tags, JSX fragments, and void elements.
 */
function parseAllTags(content: string): ParsedTag[] {
  const tags: ParsedTag[] = [];
  // Match opening tags, closing tags, and self-closing tags
  // Supports: <tag>, </tag>, <tag/>, <tag />, <tag attr="value">, etc.
  const tagRegex = /<(\/?)([\w.:-]+)(\s[^>]*)?(\/?)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(content)) !== null) {
    const isClosing = match[1] === "/";
    const tagName = match[2];
    const selfClosingSlash = match[4] === "/";
    const startOffset = match.index;
    const endOffset = match.index + match[0].length;

    // Check for self-closing: explicit /> or void elements in HTML
    const voidElements = new Set([
      "area", "base", "br", "col", "embed", "hr", "img", "input",
      "link", "meta", "param", "source", "track", "wbr"
    ]);
    const isSelfClosing = selfClosingSlash || 
      (!isClosing && voidElements.has(tagName.toLowerCase()));

    tags.push({
      name: tagName,
      isClosing,
      isSelfClosing,
      startOffset,
      endOffset,
      innerStart: isClosing ? undefined : endOffset,
      innerEnd: isClosing ? startOffset : undefined,
    });
  }

  return tags;
}

/**
 * Find the tag pair that contains the given position.
 * Properly handles nested tags of the same name.
 */
function findEnclosingTagPair(
  _content: string,
  position: number,
  tags: ParsedTag[]
): TagPair | null {
  // Build a stack-based approach to find matching tag pairs
  const openingTags: ParsedTag[] = [];
  const pairs: TagPair[] = [];

  for (const tag of tags) {
    if (tag.isSelfClosing) {
      // Self-closing tags are their own pair
      pairs.push({
        opening: tag,
        closing: null,
        innerStart: tag.endOffset,
        innerEnd: tag.endOffset,
        outerStart: tag.startOffset,
        outerEnd: tag.endOffset,
      });
    } else if (tag.isClosing) {
      // Find matching opening tag (case-insensitive for HTML)
      for (let i = openingTags.length - 1; i >= 0; i--) {
        if (openingTags[i].name.toLowerCase() === tag.name.toLowerCase()) {
          const opening = openingTags[i];
          pairs.push({
            opening,
            closing: tag,
            innerStart: opening.endOffset,
            innerEnd: tag.startOffset,
            outerStart: opening.startOffset,
            outerEnd: tag.endOffset,
          });
          openingTags.splice(i, 1);
          break;
        }
      }
    } else {
      openingTags.push(tag);
    }
  }

  // Find the smallest enclosing pair that contains the position
  let smallestPair: TagPair | null = null;
  let smallestSize = Infinity;

  for (const pair of pairs) {
    const containsPosition = position >= pair.outerStart && position <= pair.outerEnd;
    const size = pair.outerEnd - pair.outerStart;

    if (containsPosition && size < smallestSize) {
      smallestSize = size;
      smallestPair = pair;
    }
  }

  return smallestPair;
}

/**
 * Find the parent tag pair that encloses the given tag pair.
 */
function findParentTagPair(
  _content: string,
  currentPair: TagPair,
  tags: ParsedTag[]
): TagPair | null {
  const openingTags: ParsedTag[] = [];
  const pairs: TagPair[] = [];

  for (const tag of tags) {
    if (tag.isSelfClosing) {
      pairs.push({
        opening: tag,
        closing: null,
        innerStart: tag.endOffset,
        innerEnd: tag.endOffset,
        outerStart: tag.startOffset,
        outerEnd: tag.endOffset,
      });
    } else if (tag.isClosing) {
      for (let i = openingTags.length - 1; i >= 0; i--) {
        if (openingTags[i].name.toLowerCase() === tag.name.toLowerCase()) {
          const opening = openingTags[i];
          pairs.push({
            opening,
            closing: tag,
            innerStart: opening.endOffset,
            innerEnd: tag.startOffset,
            outerStart: opening.startOffset,
            outerEnd: tag.endOffset,
          });
          openingTags.splice(i, 1);
          break;
        }
      }
    } else {
      openingTags.push(tag);
    }
  }

  // Find the smallest pair that strictly contains the current pair
  let parentPair: TagPair | null = null;
  let smallestSize = Infinity;

  for (const pair of pairs) {
    const strictlyContains = 
      pair.outerStart < currentPair.outerStart && 
      pair.outerEnd > currentPair.outerEnd;
    const size = pair.outerEnd - pair.outerStart;

    if (strictlyContains && size < smallestSize) {
      smallestSize = size;
      parentPair = pair;
    }
  }

  return parentPair;
}

// ============================================================================
// Abbreviation Expansion
// ============================================================================

/**
 * Parse an Emmet-like abbreviation and return the expanded tags.
 * Supports: tag, tag.class, tag#id, tag.class#id, tag[attr=value]
 */
function parseAbbreviation(abbreviation: string): ExpansionResult {
  const trimmed = abbreviation.trim();
  if (!trimmed) {
    return { openingTag: "<div>", closingTag: "</div>", attributes: {} };
  }

  // Parse the abbreviation
  let tagName = "div";
  const classes: string[] = [];
  let id = "";
  const attrs: Record<string, string> = {};

  // Extract attributes in brackets first: tag[attr=value]
  const bracketMatch = trimmed.match(/^([^[]*)\[([^\]]*)\]$/);
  let mainPart = trimmed;
  if (bracketMatch) {
    mainPart = bracketMatch[1];
    const attrStr = bracketMatch[2];
    // Parse attributes: attr=value or attr="value" or just attr
    const attrRegex = /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      const attrName = attrMatch[1];
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
      attrs[attrName] = attrValue;
    }
  }

  // Parse tag name, classes, and id: tag.class1.class2#id
  const parts = mainPart.split(/(?=[.#])/);
  for (const part of parts) {
    if (part.startsWith(".")) {
      classes.push(part.slice(1));
    } else if (part.startsWith("#")) {
      id = part.slice(1);
    } else if (part) {
      tagName = part;
    }
  }

  // Build the opening tag
  let openingTag = `<${tagName}`;
  if (id) {
    openingTag += ` id="${id}"`;
  }
  if (classes.length > 0) {
    openingTag += ` class="${classes.join(" ")}"`;
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (value) {
      openingTag += ` ${key}="${value}"`;
    } else {
      openingTag += ` ${key}`;
    }
  }
  openingTag += ">";

  const closingTag = `</${tagName}>`;

  return {
    openingTag,
    closingTag,
    attributes: { ...attrs, ...(id ? { id } : {}), ...(classes.length ? { class: classes.join(" ") } : {}) },
  };
}

/**
 * Generate a preview of the wrapped content.
 */
export function generateWrapPreview(
  selectedText: string,
  abbreviation: string
): string {
  if (!abbreviation.trim()) {
    return selectedText;
  }

  const { openingTag, closingTag } = parseAbbreviation(abbreviation);
  
  // For preview, show a condensed version if content is long
  const maxPreviewLength = 50;
  let contentPreview = selectedText;
  if (contentPreview.length > maxPreviewLength) {
    contentPreview = contentPreview.slice(0, maxPreviewLength) + "...";
  }
  
  return `${openingTag}${contentPreview}${closingTag}`;
}

// ============================================================================
// Editor Operations
// ============================================================================

/**
 * Get the current position as an offset in the document.
 */
function getOffset(
  model: Monaco.editor.ITextModel,
  position: Monaco.IPosition
): number {
  return model.getOffsetAt(position);
}

/**
 * Convert an offset to a Monaco position.
 */
function getPosition(
  model: Monaco.editor.ITextModel,
  offset: number
): Monaco.IPosition {
  return model.getPositionAt(offset);
}

/**
 * Check if the current file supports Emmet operations.
 * Supports HTML, JSX, TSX, XML, and similar markup languages.
 */
function isEmmetSupported(languageId: string): boolean {
  const supportedLanguages = new Set([
    "html",
    "xml",
    "xhtml",
    "htm",
    "javascriptreact",
    "typescriptreact",
    "jsx",
    "tsx",
    "vue",
    "svelte",
    "php",
    "handlebars",
    "razor",
    "erb",
    "ejs",
    "markdown",
  ]);
  return supportedLanguages.has(languageId.toLowerCase());
}

// ============================================================================
// Balance Inward
// ============================================================================

/**
 * Select the inner content of the current tag (Balance Inward).
 * If already at inner content, selects inner content of nested child tag.
 */
export function balanceInward(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco
): boolean {
  const model = editor.getModel();
  if (!model) return false;

  const languageId = model.getLanguageId();
  if (!isEmmetSupported(languageId)) {
    return false;
  }

  const selection = editor.getSelection();
  if (!selection) return false;

  const content = model.getValue();
  const tags = parseAllTags(content);

  // Get current selection bounds
  const selectionStart = getOffset(model, selection.getStartPosition());
  const selectionEnd = getOffset(model, selection.getEndPosition());
  const hasSelection = selectionStart !== selectionEnd;

  // Find the enclosing tag pair
  const currentPosition = hasSelection 
    ? Math.floor((selectionStart + selectionEnd) / 2)
    : selectionStart;
  
  const enclosingPair = findEnclosingTagPair(content, currentPosition, tags);
  if (!enclosingPair) return false;

  // If we already have the inner content selected, look for a nested tag
  if (hasSelection && 
      selectionStart === enclosingPair.innerStart && 
      selectionEnd === enclosingPair.innerEnd) {
    // Find a child tag within the selection
    const innerContent = content.slice(enclosingPair.innerStart, enclosingPair.innerEnd);
    const innerTags = parseAllTags(innerContent);
    
    if (innerTags.length > 0) {
      // Find the first tag pair in the inner content
      const childPair = findEnclosingTagPair(
        innerContent,
        0,
        innerTags
      );
      if (childPair && childPair.innerEnd > childPair.innerStart) {
        const newStart = enclosingPair.innerStart + childPair.innerStart;
        const newEnd = enclosingPair.innerStart + childPair.innerEnd;
        const startPos = getPosition(model, newStart);
        const endPos = getPosition(model, newEnd);
        editor.setSelection(new monaco.Selection(
          startPos.lineNumber,
          startPos.column,
          endPos.lineNumber,
          endPos.column
        ));
        return true;
      }
    }
    return false;
  }

  // Select the inner content
  if (enclosingPair.innerEnd > enclosingPair.innerStart) {
    const startPos = getPosition(model, enclosingPair.innerStart);
    const endPos = getPosition(model, enclosingPair.innerEnd);
    editor.setSelection(new monaco.Selection(
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column
    ));
    return true;
  }

  return false;
}

// ============================================================================
// Balance Outward
// ============================================================================

/**
 * Select the outer bounds of the current tag (Balance Outward).
 * If already at outer bounds, expands to parent tag.
 */
export function balanceOutward(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco
): boolean {
  const model = editor.getModel();
  if (!model) return false;

  const languageId = model.getLanguageId();
  if (!isEmmetSupported(languageId)) {
    return false;
  }

  const selection = editor.getSelection();
  if (!selection) return false;

  const content = model.getValue();
  const tags = parseAllTags(content);

  // Get current selection bounds
  const selectionStart = getOffset(model, selection.getStartPosition());
  const selectionEnd = getOffset(model, selection.getEndPosition());
  const hasSelection = selectionStart !== selectionEnd;

  // Find the enclosing tag pair
  const currentPosition = hasSelection 
    ? Math.floor((selectionStart + selectionEnd) / 2)
    : selectionStart;

  const enclosingPair = findEnclosingTagPair(content, currentPosition, tags);
  if (!enclosingPair) return false;

  // Check if we already have this tag's inner content selected
  const hasInnerSelected = hasSelection &&
    selectionStart === enclosingPair.innerStart &&
    selectionEnd === enclosingPair.innerEnd;

  // Check if we already have this tag's outer bounds selected
  const hasOuterSelected = hasSelection &&
    selectionStart === enclosingPair.outerStart &&
    selectionEnd === enclosingPair.outerEnd;

  if (hasOuterSelected) {
    // Already have outer selected, find parent tag
    const parentPair = findParentTagPair(content, enclosingPair, tags);
    if (parentPair) {
      const startPos = getPosition(model, parentPair.outerStart);
      const endPos = getPosition(model, parentPair.outerEnd);
      editor.setSelection(new monaco.Selection(
        startPos.lineNumber,
        startPos.column,
        endPos.lineNumber,
        endPos.column
      ));
      return true;
    }
    return false;
  }

  if (hasInnerSelected || !hasSelection) {
    // Select the outer bounds of the current tag
    const startPos = getPosition(model, enclosingPair.outerStart);
    const endPos = getPosition(model, enclosingPair.outerEnd);
    editor.setSelection(new monaco.Selection(
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column
    ));
    return true;
  }

  // If we have some other selection, try to select outer bounds
  const startPos = getPosition(model, enclosingPair.outerStart);
  const endPos = getPosition(model, enclosingPair.outerEnd);
  editor.setSelection(new monaco.Selection(
    startPos.lineNumber,
    startPos.column,
    endPos.lineNumber,
    endPos.column
  ));
  return true;
}

// ============================================================================
// Wrap with Abbreviation
// ============================================================================

/**
 * Wrap the current selection with an Emmet abbreviation.
 * If no selection, wraps the current line.
 */
export function wrapWithAbbreviation(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  abbreviation: string
): boolean {
  const model = editor.getModel();
  if (!model) return false;

  const trimmedAbbr = abbreviation.trim();
  if (!trimmedAbbr) return false;

  const selection = editor.getSelection();
  if (!selection) return false;

  const { openingTag, closingTag } = parseAbbreviation(trimmedAbbr);

  let selectedText: string;
  let replaceRange: Monaco.Range;

  if (selection.isEmpty()) {
    // No selection: wrap the current line's content (trimmed)
    const lineNumber = selection.startLineNumber;
    const lineContent = model.getLineContent(lineNumber);
    const trimmedLine = lineContent.trim();
    const leadingWhitespace = lineContent.match(/^\s*/)?.[0] || "";
    
    selectedText = trimmedLine;
    replaceRange = new monaco.Range(
      lineNumber,
      1,
      lineNumber,
      lineContent.length + 1
    );
    
    // Preserve indentation
    const newText = `${leadingWhitespace}${openingTag}${trimmedLine}${closingTag}`;
    editor.executeEdits("emmet-wrap", [{
      range: replaceRange,
      text: newText,
    }]);
  } else {
    // Has selection: wrap the selected text
    selectedText = model.getValueInRange(selection);
    
    // Check if selection spans multiple lines for proper indentation
    const isMultiLine = selection.startLineNumber !== selection.endLineNumber;
    
    if (isMultiLine) {
      // For multi-line selections, add newlines and indent content
      const startLineContent = model.getLineContent(selection.startLineNumber);
      const baseIndent = startLineContent.match(/^\s*/)?.[0] || "";
      const contentIndent = baseIndent + "  "; // Add 2 spaces for content
      
      // Re-indent each line of the selection
      const lines = selectedText.split("\n");
      const indentedLines = lines.map((line, index) => {
        if (index === 0) {
          // First line: add content indent
          return contentIndent + line.trimStart();
        }
        // Subsequent lines: preserve relative indentation but ensure minimum
        const trimmedContent = line.trimStart();
        if (!trimmedContent) return ""; // Empty lines
        // Add base indent + content indent
        return contentIndent + trimmedContent;
      }).filter((line, index, arr) => {
        // Remove trailing empty lines but keep internal ones
        if (line === "" && index === arr.length - 1) return false;
        return true;
      });
      
      const wrappedContent = [
        `${baseIndent}${openingTag}`,
        ...indentedLines,
        `${baseIndent}${closingTag}`
      ].join("\n");
      
      editor.executeEdits("emmet-wrap", [{
        range: selection,
        text: wrappedContent,
      }]);
    } else {
      // Single line: simple wrap
      const wrappedContent = `${openingTag}${selectedText}${closingTag}`;
      editor.executeEdits("emmet-wrap", [{
        range: selection,
        text: wrappedContent,
      }]);
    }
  }

  return true;
}

/**
 * Get the currently selected text or the current line content.
 * Used for generating wrap preview.
 */
export function getSelectionForWrap(
  editor: Monaco.editor.IStandaloneCodeEditor
): string {
  const model = editor.getModel();
  if (!model) return "";

  const selection = editor.getSelection();
  if (!selection) return "";

  if (selection.isEmpty()) {
    // Return current line content (trimmed)
    const lineContent = model.getLineContent(selection.startLineNumber);
    return lineContent.trim();
  }

  return model.getValueInRange(selection);
}

// ============================================================================
// Emmet Abbreviation Expansion
// ============================================================================

/**
 * Get the Emmet syntax type for a given language.
 * Maps Monaco/VS Code language IDs to Emmet syntax types.
 */
function getEmmetSyntax(language: string): string | null {
  const syntaxMap: Record<string, string> = {
    html: "html",
    htm: "html",
    xhtml: "html",
    jsx: "jsx",
    tsx: "jsx",
    javascriptreact: "jsx",
    typescriptreact: "jsx",
    xml: "xml",
    css: "css",
    scss: "scss",
    sass: "scss",
    less: "less",
    vue: "html",
    svelte: "html",
    handlebars: "html",
    razor: "html",
    php: "html",
    erb: "html",
    ejs: "html",
  };
  return syntaxMap[language.toLowerCase()] || null;
}

/**
 * Expand an Emmet abbreviation into its full HTML/CSS output.
 * Returns null if the abbreviation is invalid or the language is not supported.
 */
export function expandEmmetAbbreviation(
  abbreviation: string,
  language: string
): string | null {
  try {
    const syntax = getEmmetSyntax(language);
    if (!syntax) return null;

    // Don't expand very short or empty abbreviations
    if (!abbreviation || abbreviation.length < 1) return null;

    const result = emmet(abbreviation, {
      syntax: syntax as "html" | "xml" | "xhtml" | "jsx" | "css" | "scss" | "less",
      options: {
        "output.indent": "  ",
        "output.newline": "\n",
      },
    });

    // Return null if expansion is same as input (invalid abbreviation)
    if (result === abbreviation) return null;

    return result;
  } catch {
    return null;
  }
}

/**
 * Get the range of an Emmet abbreviation at the current cursor position.
 * Finds the abbreviation by looking backwards from the cursor for valid Emmet characters.
 * Returns null if no valid abbreviation is found.
 */
export function getAbbreviationRange(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  monaco: typeof Monaco
): Monaco.Range | null {
  const line = model.getLineContent(position.lineNumber);
  const beforeCursor = line.substring(0, position.column - 1);

  // Find abbreviation start (look for valid Emmet abbreviation characters)
  // Emmet abbreviations can contain: letters, numbers, dots, hashes, >, +, *, [], {}, (), @, -
  // But should not start with a number
  const match = beforeCursor.match(/([a-zA-Z][a-zA-Z0-9.#>+*\[\]{}()@\-:$^]*|[.#][a-zA-Z0-9.#>+*\[\]{}()@\-:$^]*)$/);
  if (!match) return null;

  const abbreviation = match[1];
  
  // Skip if abbreviation is too short or looks like it's part of normal text
  if (abbreviation.length < 1) return null;

  // Skip common non-abbreviation patterns (e.g., just a number, just dots, etc.)
  if (/^[0-9]+$/.test(abbreviation)) return null;
  if (/^[.#]+$/.test(abbreviation)) return null;

  return new monaco.Range(
    position.lineNumber,
    position.column - abbreviation.length,
    position.lineNumber,
    position.column
  );
}

// ============================================================================
// Exported Utility Functions
// ============================================================================

export const EmmetUtils = {
  balanceInward,
  balanceOutward,
  wrapWithAbbreviation,
  getSelectionForWrap,
  generateWrapPreview,
  isEmmetSupported,
  expandEmmetAbbreviation,
  getAbbreviationRange,
};

export default EmmetUtils;

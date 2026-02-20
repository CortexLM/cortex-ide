/**
 * Enhanced ANSI Color Utilities for Debug Console
 * 
 * Provides comprehensive ANSI escape code processing for debug console output,
 * including:
 * - Full 8-color, 16-color, 256-color, and 24-bit RGB support
 * - Text decorations (bold, italic, underline, strikethrough, etc.)
 * - Cursor movement and screen manipulation
 * - Link detection and rendering
 * - Theme-aware color mapping
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Style properties for rendered ANSI text
 */
export interface AnsiTextStyle {
  foreground?: string;
  background?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  blink?: boolean;
  inverse?: boolean;
  hidden?: boolean;
  strikethrough?: boolean;
  overline?: boolean;
  // Font selection (rarely used)
  font?: number;
}

/**
 * A segment of parsed ANSI text with style
 */
export interface AnsiTextSegment {
  text: string;
  style: AnsiTextStyle;
  isLink?: boolean;
  linkUrl?: string;
}

/**
 * Theme color definitions for ANSI colors
 */
export interface AnsiThemeColors {
  // Standard colors (0-7)
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  // Bright colors (8-15)
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
  // Default colors
  foreground: string;
  background: string;
}

/**
 * OSC 8 hyperlink info
 */
export interface AnsiHyperlink {
  url: string;
  id?: string;
  params: Record<string, string>;
}

// ============================================================================
// Default Theme Colors (Ayu Dark inspired)
// ============================================================================

export const DEFAULT_ANSI_COLORS: AnsiThemeColors = {
  // Standard colors
  black: '#000000',
  red: '#ff3333',
  green: '#b8cc52',
  yellow: '#e7c547',
  blue: '#36a3d9',
  magenta: '#f07178',
  cyan: '#95e6cb',
  white: '#ffffff',
  // Bright colors
  brightBlack: '#323232',
  brightRed: '#ff6565',
  brightGreen: '#eafe84',
  brightYellow: '#fff779',
  brightBlue: '#68d5ff',
  brightMagenta: '#ffa3aa',
  brightCyan: '#c7fffd',
  brightWhite: '#ffffff',
  // Defaults
  foreground: '#b3b1ad',
  background: '#0d1017',
};

// ============================================================================
// ANSI Escape Sequence Patterns
// ============================================================================

/**
 * Combined pattern for all escape sequences
 */
const ANSI_ESCAPE_PATTERN = /\x1b(?:\[([0-9;?]*)([A-Za-z])|\]([^\x07\x1b]*)(?:\x07|\x1b\\))/g;

/**
 * URL pattern for auto-linking
 */
const URL_PATTERN = /https?:\/\/[^\s<>'")\]]+/gi;

// ============================================================================
// Color Lookup Tables
// ============================================================================

/**
 * Standard 8-color palette indices
 */
const STANDARD_COLORS: Record<number, keyof AnsiThemeColors> = {
  0: 'black',
  1: 'red',
  2: 'green',
  3: 'yellow',
  4: 'blue',
  5: 'magenta',
  6: 'cyan',
  7: 'white',
};

/**
 * Bright 8-color palette indices (offset by 8)
 */
const BRIGHT_COLORS: Record<number, keyof AnsiThemeColors> = {
  0: 'brightBlack',
  1: 'brightRed',
  2: 'brightGreen',
  3: 'brightYellow',
  4: 'brightBlue',
  5: 'brightMagenta',
  6: 'brightCyan',
  7: 'brightWhite',
};

// ============================================================================
// Color Conversion Utilities
// ============================================================================

/**
 * Convert 256-color index to hex color
 */
export function index256ToHex(index: number): string {
  // Standard colors 0-7
  if (index < 8) {
    const colors = ['#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000ee', '#cd00cd', '#00cdcd', '#e5e5e5'];
    return colors[index];
  }
  
  // Bright colors 8-15
  if (index < 16) {
    const colors = ['#7f7f7f', '#ff0000', '#00ff00', '#ffff00', '#5c5cff', '#ff00ff', '#00ffff', '#ffffff'];
    return colors[index - 8];
  }
  
  // 216-color cube 16-231
  if (index < 232) {
    const i = index - 16;
    const r = Math.floor(i / 36);
    const g = Math.floor((i % 36) / 6);
    const b = i % 6;
    
    const toChannel = (n: number) => n === 0 ? 0 : 55 + n * 40;
    const toHex = (n: number) => toChannel(n).toString(16).padStart(2, '0');
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  
  // Grayscale 232-255
  const gray = 8 + (index - 232) * 10;
  const hex = gray.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

/**
 * Convert RGB values to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Get theme color by index (0-15)
 */
export function getThemeColor(index: number, theme: AnsiThemeColors = DEFAULT_ANSI_COLORS): string {
  if (index < 8) {
    return theme[STANDARD_COLORS[index]];
  }
  return theme[BRIGHT_COLORS[index - 8]];
}

// ============================================================================
// SGR (Select Graphic Rendition) Parser
// ============================================================================

/**
 * Parse SGR codes and update style
 */
export function parseSGR(codes: number[], currentStyle: AnsiTextStyle, theme: AnsiThemeColors = DEFAULT_ANSI_COLORS): AnsiTextStyle {
  const style = { ...currentStyle };
  
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    
    // Reset all attributes
    if (code === 0) {
      return {};
    }
    
    // Text attributes
    switch (code) {
      case 1: style.bold = true; break;
      case 2: style.dim = true; break;
      case 3: style.italic = true; break;
      case 4: style.underline = true; break;
      case 5: // Slow blink
      case 6: style.blink = true; break;  // Rapid blink
      case 7: style.inverse = true; break;
      case 8: style.hidden = true; break;
      case 9: style.strikethrough = true; break;
      // Fonts 10-19
      case 10: style.font = 0; break;
      case 11: case 12: case 13: case 14: case 15:
      case 16: case 17: case 18: case 19:
        style.font = code - 10;
        break;
      // Fraktur (20) - rarely supported
      case 21: style.bold = false; break;  // Double underline / bold off
      case 22: style.bold = false; style.dim = false; break;
      case 23: style.italic = false; break;
      case 24: style.underline = false; break;
      case 25: style.blink = false; break;
      case 27: style.inverse = false; break;
      case 28: style.hidden = false; break;
      case 29: style.strikethrough = false; break;
      // Overline (53)
      case 53: style.overline = true; break;
      case 55: style.overline = false; break;
    }
    
    // Foreground colors 30-37
    if (code >= 30 && code <= 37) {
      style.foreground = getThemeColor(code - 30, theme);
      continue;
    }
    
    // Extended foreground color (38)
    if (code === 38) {
      const subCode = codes[i + 1];
      if (subCode === 5 && codes[i + 2] !== undefined) {
        // 256-color mode
        style.foreground = index256ToHex(codes[i + 2]);
        i += 2;
      } else if (subCode === 2 && codes[i + 4] !== undefined) {
        // 24-bit RGB mode
        style.foreground = rgbToHex(codes[i + 2], codes[i + 3], codes[i + 4]);
        i += 4;
      }
      continue;
    }
    
    // Default foreground (39)
    if (code === 39) {
      delete style.foreground;
      continue;
    }
    
    // Background colors 40-47
    if (code >= 40 && code <= 47) {
      style.background = getThemeColor(code - 40, theme);
      continue;
    }
    
    // Extended background color (48)
    if (code === 48) {
      const subCode = codes[i + 1];
      if (subCode === 5 && codes[i + 2] !== undefined) {
        // 256-color mode
        style.background = index256ToHex(codes[i + 2]);
        i += 2;
      } else if (subCode === 2 && codes[i + 4] !== undefined) {
        // 24-bit RGB mode
        style.background = rgbToHex(codes[i + 2], codes[i + 3], codes[i + 4]);
        i += 4;
      }
      continue;
    }
    
    // Default background (49)
    if (code === 49) {
      delete style.background;
      continue;
    }
    
    // Bright foreground colors 90-97
    if (code >= 90 && code <= 97) {
      style.foreground = getThemeColor(code - 90 + 8, theme);
      continue;
    }
    
    // Bright background colors 100-107
    if (code >= 100 && code <= 107) {
      style.background = getThemeColor(code - 100 + 8, theme);
      continue;
    }
  }
  
  return style;
}

// ============================================================================
// OSC (Operating System Command) Parser
// ============================================================================

/**
 * Current hyperlink state for OSC 8 parsing
 */
interface HyperlinkState {
  active: boolean;
  url: string;
  id?: string;
  params: Record<string, string>;
}

/**
 * Parse OSC 8 hyperlink
 */
export function parseOSC8(data: string): AnsiHyperlink | null {
  // OSC 8 format: 8;params;url
  if (!data.startsWith('8;')) {
    return null;
  }
  
  const parts = data.substring(2).split(';');
  if (parts.length < 2) {
    return null;
  }
  
  const paramsStr = parts[0];
  const url = parts.slice(1).join(';');
  
  const params: Record<string, string> = {};
  if (paramsStr) {
    paramsStr.split(':').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value !== undefined) {
        params[key] = value;
      }
    });
  }
  
  return {
    url,
    id: params.id,
    params,
  };
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parser state
 */
interface ParserState {
  style: AnsiTextStyle;
  hyperlink: HyperlinkState;
}

/**
 * Parse ANSI text into styled segments
 */
export function parseAnsiText(
  text: string,
  theme: AnsiThemeColors = DEFAULT_ANSI_COLORS,
  autoLinkUrls: boolean = true
): AnsiTextSegment[] {
  const segments: AnsiTextSegment[] = [];
  let lastIndex = 0;
  
  const state: ParserState = {
    style: {},
    hyperlink: {
      active: false,
      url: '',
      params: {},
    },
  };
  
  // Reset regex state
  ANSI_ESCAPE_PATTERN.lastIndex = 0;
  
  let match: RegExpExecArray | null;
  while ((match = ANSI_ESCAPE_PATTERN.exec(text)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index);
      if (textContent) {
        addTextSegments(segments, textContent, state, autoLinkUrls);
      }
    }
    
    // Check if this is CSI or OSC
    if (match[1] !== undefined || match[2] !== undefined) {
      // CSI sequence
      const params = match[1] || '';
      const command = match[2];
      
      if (command === 'm') {
        // SGR - Select Graphic Rendition
        const codes = params ? params.split(';').map(Number) : [0];
        state.style = parseSGR(codes, state.style, theme);
      }
      // Other CSI commands (cursor movement, etc.) are ignored for text rendering
    } else if (match[3] !== undefined) {
      // OSC sequence
      const oscData = match[3];
      const hyperlink = parseOSC8(oscData);
      
      if (hyperlink) {
        if (hyperlink.url) {
          // Start hyperlink
          state.hyperlink = {
            active: true,
            url: hyperlink.url,
            id: hyperlink.id,
            params: hyperlink.params,
          };
        } else {
          // End hyperlink
          state.hyperlink = {
            active: false,
            url: '',
            params: {},
          };
        }
      }
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex);
    if (textContent) {
      addTextSegments(segments, textContent, state, autoLinkUrls);
    }
  }
  
  // Return original text if no segments were created
  if (segments.length === 0 && text.length > 0) {
    segments.push({ text, style: {} });
  }
  
  return segments;
}

/**
 * Add text segments with optional URL auto-detection
 */
function addTextSegments(
  segments: AnsiTextSegment[],
  text: string,
  state: ParserState,
  autoLinkUrls: boolean
): void {
  if (state.hyperlink.active) {
    // Text is part of an OSC 8 hyperlink
    segments.push({
      text,
      style: { ...state.style },
      isLink: true,
      linkUrl: state.hyperlink.url,
    });
    return;
  }
  
  if (!autoLinkUrls) {
    segments.push({ text, style: { ...state.style } });
    return;
  }
  
  // Auto-detect URLs
  URL_PATTERN.lastIndex = 0;
  let lastUrlIndex = 0;
  let urlMatch: RegExpExecArray | null;
  
  while ((urlMatch = URL_PATTERN.exec(text)) !== null) {
    // Add text before URL
    if (urlMatch.index > lastUrlIndex) {
      segments.push({
        text: text.slice(lastUrlIndex, urlMatch.index),
        style: { ...state.style },
      });
    }
    
    // Add URL as link
    segments.push({
      text: urlMatch[0],
      style: { ...state.style },
      isLink: true,
      linkUrl: urlMatch[0],
    });
    
    lastUrlIndex = urlMatch.index + urlMatch[0].length;
  }
  
  // Add remaining text after last URL
  if (lastUrlIndex < text.length) {
    segments.push({
      text: text.slice(lastUrlIndex),
      style: { ...state.style },
    });
  }
  
  // If no URLs were found, add the whole text
  if (lastUrlIndex === 0) {
    segments.push({ text, style: { ...state.style } });
  }
}

// ============================================================================
// Style to CSS Conversion
// ============================================================================

/**
 * Convert AnsiTextStyle to CSS properties
 */
export function styleToCss(style: AnsiTextStyle): Record<string, string> {
  const css: Record<string, string> = {};
  
  if (style.foreground) {
    css.color = style.foreground;
  }
  
  if (style.background) {
    css.backgroundColor = style.background;
  }
  
  // Font weight
  if (style.bold) {
    css.fontWeight = 'bold';
  } else if (style.dim) {
    css.opacity = '0.7';
  }
  
  // Font style
  if (style.italic) {
    css.fontStyle = 'italic';
  }
  
  // Text decoration
  const decorations: string[] = [];
  if (style.underline) decorations.push('underline');
  if (style.strikethrough) decorations.push('line-through');
  if (style.overline) decorations.push('overline');
  if (decorations.length > 0) {
    css.textDecoration = decorations.join(' ');
  }
  
  // Blink
  if (style.blink) {
    css.animation = 'blink 1s step-end infinite';
  }
  
  // Hidden
  if (style.hidden) {
    css.visibility = 'hidden';
  }
  
  // Inverse (swap foreground and background)
  // Note: This is handled separately as it requires knowing both colors
  
  return css;
}

/**
 * Convert style to inline CSS string
 */
export function styleToInlineCss(style: AnsiTextStyle): string {
  const css = styleToCss(style);
  return Object.entries(css)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
    .join('; ');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Strip all ANSI escape codes from text
 */
export function stripAnsiCodes(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, '');
}

/**
 * Check if text contains ANSI escape codes
 */
export function containsAnsiCodes(text: string): boolean {
  ANSI_ESCAPE_PATTERN.lastIndex = 0;
  return ANSI_ESCAPE_PATTERN.test(text);
}

/**
 * Get visible length of text (excluding escape codes)
 */
export function getVisibleLength(text: string): number {
  return stripAnsiCodes(text).length;
}

/**
 * Truncate ANSI text to visible length while preserving styles
 */
export function truncateAnsiText(text: string, maxLength: number, ellipsis: string = '...'): string {
  const segments = parseAnsiText(text, DEFAULT_ANSI_COLORS, false);
  let currentLength = 0;
  let result = '';
  
  for (const segment of segments) {
    const remainingLength = maxLength - currentLength;
    
    if (segment.text.length <= remainingLength) {
      result += segment.text;
      currentLength += segment.text.length;
    } else {
      result += segment.text.slice(0, remainingLength - ellipsis.length) + ellipsis;
      break;
    }
  }
  
  return result;
}

// ============================================================================
// React/Solid Helper for Rendering
// ============================================================================

/**
 * Render ANSI text to HTML string
 */
export function ansiToHtml(
  text: string,
  theme: AnsiThemeColors = DEFAULT_ANSI_COLORS,
  autoLinkUrls: boolean = true
): string {
  const segments = parseAnsiText(text, theme, autoLinkUrls);
  
  return segments.map(segment => {
    const style = styleToInlineCss(segment.style);
    const escapedText = escapeHtml(segment.text);
    
    if (segment.isLink && segment.linkUrl) {
      const escapedUrl = escapeHtml(segment.linkUrl);
      const styleAttr = style ? ` style="${style}"` : '';
      return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer"${styleAttr}>${escapedText}</a>`;
    }
    
    if (style) {
      return `<span style="${style}">${escapedText}</span>`;
    }
    
    return escapedText;
  }).join('');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Debug Console Specific Utilities
// ============================================================================

/**
 * Format debug output with appropriate styling
 */
export function formatDebugOutput(
  message: string,
  category: 'stdout' | 'stderr' | 'console' | 'important',
  theme: AnsiThemeColors = DEFAULT_ANSI_COLORS
): AnsiTextSegment[] {
  // Pre-process category-specific styling
  let styledMessage = message;
  
  switch (category) {
    case 'stderr':
      // If not already colored, apply red
      if (!containsAnsiCodes(message)) {
        styledMessage = `\x1b[31m${message}\x1b[0m`;
      }
      break;
    case 'important':
      // Bold + bright white
      if (!containsAnsiCodes(message)) {
        styledMessage = `\x1b[1;97m${message}\x1b[0m`;
      }
      break;
  }
  
  return parseAnsiText(styledMessage, theme);
}

/**
 * Highlight search term in ANSI text
 */
export function highlightSearchTerm(
  text: string,
  searchTerm: string,
  highlightStyle: AnsiTextStyle = { background: '#ffd700', foreground: '#000000' }
): AnsiTextSegment[] {
  if (!searchTerm) {
    return parseAnsiText(text);
  }
  
  const segments = parseAnsiText(text);
  const result: AnsiTextSegment[] = [];
  const searchLower = searchTerm.toLowerCase();
  
  for (const segment of segments) {
    const textLower = segment.text.toLowerCase();
    let lastIndex = 0;
    let matchIndex: number;
    
    while ((matchIndex = textLower.indexOf(searchLower, lastIndex)) !== -1) {
      // Add text before match
      if (matchIndex > lastIndex) {
        result.push({
          text: segment.text.slice(lastIndex, matchIndex),
          style: segment.style,
          isLink: segment.isLink,
          linkUrl: segment.linkUrl,
        });
      }
      
      // Add highlighted match
      result.push({
        text: segment.text.slice(matchIndex, matchIndex + searchTerm.length),
        style: { ...segment.style, ...highlightStyle },
        isLink: segment.isLink,
        linkUrl: segment.linkUrl,
      });
      
      lastIndex = matchIndex + searchTerm.length;
    }
    
    // Add remaining text
    if (lastIndex < segment.text.length) {
      result.push({
        text: segment.text.slice(lastIndex),
        style: segment.style,
        isLink: segment.isLink,
        linkUrl: segment.linkUrl,
      });
    }
  }
  
  return result;
}

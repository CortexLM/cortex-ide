/**
 * ANSI Escape Code Parser
 * Parses ANSI escape sequences in text and converts them to styled segments.
 * Supports colors (30-37, 90-97), background colors (40-47, 100-107),
 * bold, italic, underline, and reset codes.
 */

/**
 * Style information for an ANSI segment.
 */
export interface AnsiStyle {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/**
 * A segment of text with associated ANSI styling.
 */
export interface AnsiSegment {
  text: string;
  style: AnsiStyle;
}

/**
 * Standard ANSI color palette (30-37, foreground)
 */
const ANSI_COLORS: Record<number, string> = {
  30: "#000000", // Black
  31: "#cd0000", // Red
  32: "#00cd00", // Green
  33: "#cdcd00", // Yellow
  34: "#0000ee", // Blue
  35: "#cd00cd", // Magenta
  36: "#00cdcd", // Cyan
  37: "#e5e5e5", // White
};

/**
 * Bright ANSI colors (90-97, foreground)
 */
const ANSI_BRIGHT_COLORS: Record<number, string> = {
  90: "#7f7f7f", // Bright Black (Gray)
  91: "#ff0000", // Bright Red
  92: "#00ff00", // Bright Green
  93: "#ffff00", // Bright Yellow
  94: "#5c5cff", // Bright Blue
  95: "#ff00ff", // Bright Magenta
  96: "#00ffff", // Bright Cyan
  97: "#ffffff", // Bright White
};

/**
 * Standard ANSI background colors (40-47)
 */
const ANSI_BG_COLORS: Record<number, string> = {
  40: "#000000", // Black
  41: "#cd0000", // Red
  42: "#00cd00", // Green
  43: "#cdcd00", // Yellow
  44: "#0000ee", // Blue
  45: "#cd00cd", // Magenta
  46: "#00cdcd", // Cyan
  47: "#e5e5e5", // White
};

/**
 * Bright ANSI background colors (100-107)
 */
const ANSI_BRIGHT_BG_COLORS: Record<number, string> = {
  100: "#7f7f7f", // Bright Black (Gray)
  101: "#ff0000", // Bright Red
  102: "#00ff00", // Bright Green
  103: "#ffff00", // Bright Yellow
  104: "#5c5cff", // Bright Blue
  105: "#ff00ff", // Bright Magenta
  106: "#00ffff", // Bright Cyan
  107: "#ffffff", // Bright White
};

/**
 * ANSI escape sequence regex.
 * Matches sequences like ESC[...m where ... is one or more semicolon-separated numbers.
 */
const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

/**
 * Parses ANSI escape codes in text and returns styled segments.
 * @param text The text containing ANSI escape codes
 * @returns Array of segments with text and style information
 */
export function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  let currentStyle: AnsiStyle = {};
  let lastIndex = 0;

  // Reset the regex state
  ANSI_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ANSI_REGEX.exec(text)) !== null) {
    // Add text before this escape sequence with current style
    if (match.index > lastIndex) {
      const textSegment = text.slice(lastIndex, match.index);
      if (textSegment) {
        segments.push({
          text: textSegment,
          style: { ...currentStyle },
        });
      }
    }

    // Parse the SGR (Select Graphic Rendition) codes
    const codes = match[1] ? match[1].split(";").map(Number) : [0];
    currentStyle = processAnsiCodes(codes, currentStyle);

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last escape sequence
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      segments.push({
        text: remainingText,
        style: { ...currentStyle },
      });
    }
  }

  // If no segments were created, return the original text with empty style
  if (segments.length === 0 && text.length > 0) {
    segments.push({
      text,
      style: {},
    });
  }

  return segments;
}

/**
 * Processes ANSI SGR codes and updates the current style.
 * @param codes Array of SGR codes
 * @param currentStyle Current style state
 * @returns Updated style state
 */
function processAnsiCodes(codes: number[], currentStyle: AnsiStyle): AnsiStyle {
  const style = { ...currentStyle };

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];

    // Reset
    if (code === 0) {
      return {};
    }

    // Bold
    if (code === 1) {
      style.bold = true;
      continue;
    }

    // Italic
    if (code === 3) {
      style.italic = true;
      continue;
    }

    // Underline
    if (code === 4) {
      style.underline = true;
      continue;
    }

    // Bold off
    if (code === 21 || code === 22) {
      style.bold = false;
      continue;
    }

    // Italic off
    if (code === 23) {
      style.italic = false;
      continue;
    }

    // Underline off
    if (code === 24) {
      style.underline = false;
      continue;
    }

    // Standard foreground colors (30-37)
    if (code >= 30 && code <= 37) {
      style.color = ANSI_COLORS[code];
      continue;
    }

    // Default foreground color
    if (code === 39) {
      delete style.color;
      continue;
    }

    // Standard background colors (40-47)
    if (code >= 40 && code <= 47) {
      style.backgroundColor = ANSI_BG_COLORS[code];
      continue;
    }

    // Default background color
    if (code === 49) {
      delete style.backgroundColor;
      continue;
    }

    // Bright foreground colors (90-97)
    if (code >= 90 && code <= 97) {
      style.color = ANSI_BRIGHT_COLORS[code];
      continue;
    }

    // Bright background colors (100-107)
    if (code >= 100 && code <= 107) {
      style.backgroundColor = ANSI_BRIGHT_BG_COLORS[code];
      continue;
    }

    // 256-color mode: ESC[38;5;Nm or ESC[48;5;Nm
    if (code === 38 && codes[i + 1] === 5) {
      const colorIndex = codes[i + 2];
      if (colorIndex !== undefined) {
        style.color = get256Color(colorIndex);
        i += 2;
      }
      continue;
    }

    if (code === 48 && codes[i + 1] === 5) {
      const colorIndex = codes[i + 2];
      if (colorIndex !== undefined) {
        style.backgroundColor = get256Color(colorIndex);
        i += 2;
      }
      continue;
    }

    // 24-bit RGB mode: ESC[38;2;R;G;Bm or ESC[48;2;R;G;Bm
    if (code === 38 && codes[i + 1] === 2) {
      const r = codes[i + 2];
      const g = codes[i + 3];
      const b = codes[i + 4];
      if (r !== undefined && g !== undefined && b !== undefined) {
        style.color = `rgb(${r}, ${g}, ${b})`;
        i += 4;
      }
      continue;
    }

    if (code === 48 && codes[i + 1] === 2) {
      const r = codes[i + 2];
      const g = codes[i + 3];
      const b = codes[i + 4];
      if (r !== undefined && g !== undefined && b !== undefined) {
        style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        i += 4;
      }
      continue;
    }
  }

  return style;
}

/**
 * Converts a 256-color index to a hex color.
 * @param index Color index (0-255)
 * @returns Hex color string
 */
function get256Color(index: number): string {
  // Standard colors (0-7)
  if (index < 8) {
    const standardColors = [
      "#000000", "#cd0000", "#00cd00", "#cdcd00",
      "#0000ee", "#cd00cd", "#00cdcd", "#e5e5e5",
    ];
    return standardColors[index];
  }

  // Bright colors (8-15)
  if (index < 16) {
    const brightColors = [
      "#7f7f7f", "#ff0000", "#00ff00", "#ffff00",
      "#5c5cff", "#ff00ff", "#00ffff", "#ffffff",
    ];
    return brightColors[index - 8];
  }

  // 216-color cube (16-231)
  if (index < 232) {
    const i = index - 16;
    const r = Math.floor(i / 36);
    const g = Math.floor((i % 36) / 6);
    const b = i % 6;
    
    const toHex = (n: number) => {
      const value = n === 0 ? 0 : 55 + n * 40;
      return value.toString(16).padStart(2, "0");
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // Grayscale (232-255)
  const gray = 8 + (index - 232) * 10;
  const hex = gray.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

/**
 * Checks if a string contains ANSI escape codes.
 * @param text The text to check
 * @returns True if the text contains ANSI codes
 */
export function hasAnsiCodes(text: string): boolean {
  ANSI_REGEX.lastIndex = 0;
  return ANSI_REGEX.test(text);
}

/**
 * Strips all ANSI escape codes from text.
 * @param text The text containing ANSI codes
 * @returns The text with all ANSI codes removed
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

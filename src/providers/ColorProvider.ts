/**
 * Monaco Color Provider
 *
 * Provides color information integration for Monaco editor using LSP.
 * Features:
 * - Register monaco.languages.registerColorProvider for CSS/SCSS/Less/JS/TS
 * - Call LSP textDocument/documentColor to get color locations
 * - Call LSP textDocument/colorPresentation for color format conversions
 * - Show inline color decorations (colored squares next to values)
 * - Supports formats: #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba(), hsl(), hsla(), named colors
 */

import type * as Monaco from "monaco-editor";
import type { Range } from "@/context/LSPContext";

// ============================================================================
// Types
// ============================================================================

/**
 * LSP Color representation with RGBA values normalized to 0-1 range.
 */
export interface Color {
  /** Red component (0-1) */
  red: number;
  /** Green component (0-1) */
  green: number;
  /** Blue component (0-1) */
  blue: number;
  /** Alpha component (0-1) */
  alpha: number;
}

/**
 * Color information returned from LSP textDocument/documentColor.
 */
export interface ColorInformation {
  /** The range in the document where the color appears */
  range: Range;
  /** The color value */
  color: Color;
}

/**
 * Color presentation returned from LSP textDocument/colorPresentation.
 */
export interface ColorPresentation {
  /** The label of this color presentation (e.g., "#ff0000" or "rgb(255, 0, 0)") */
  label: string;
  /** An edit which is applied to a document when selecting this presentation */
  textEdit?: {
    range: Range;
    newText: string;
  };
  /** Additional edits to apply when selecting this presentation */
  additionalTextEdits?: Array<{
    range: Range;
    newText: string;
  }>;
}

/**
 * Options for creating a color provider.
 */
export interface ColorProviderOptions {
  /** Monaco editor instance */
  monaco: typeof Monaco;
  /** Language ID to register the provider for */
  languageId: string;
  /** LSP server ID */
  serverId: string;
  /** File path/URI */
  filePath: string;
  /** Function to get document colors from LSP */
  getDocumentColors: (serverId: string, uri: string) => Promise<ColorInformation[]>;
  /** Function to get color presentations from LSP */
  getColorPresentations: (
    serverId: string,
    uri: string,
    color: Color,
    range: Range
  ) => Promise<ColorPresentation[]>;
}

/**
 * Result of creating a color provider.
 */
export interface ColorProviderResult {
  /** Disposable to clean up the provider */
  provider: Monaco.IDisposable;
  /** Function to refresh color information */
  refresh: () => void;
}

// ============================================================================
// Language Patterns for Color Detection (fallback when LSP unavailable)
// ============================================================================

/** Regex patterns for detecting colors in different contexts */
const COLOR_PATTERNS = {
  // Hex colors: #RGB, #RRGGBB, #RRGGBBAA
  hex: /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
  // rgb() and rgba()
  rgb: /rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi,
  // hsl() and hsla()
  hsl: /hsla?\s*\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(?:,\s*[\d.]+\s*)?\)/gi,
  // Modern CSS rgb/hsl with space syntax
  rgbModern: /rgba?\s*\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*(?:\/\s*[\d.]+%?\s*)?\)/gi,
  hslModern: /hsla?\s*\(\s*[\d.]+(?:deg|rad|turn)?\s+[\d.]+%?\s+[\d.]+%?\s*(?:\/\s*[\d.]+%?\s*)?\)/gi,
};

/** Common CSS named colors */
const NAMED_COLORS: Record<string, Color> = {
  aliceblue: { red: 0.941, green: 0.973, blue: 1.0, alpha: 1 },
  antiquewhite: { red: 0.98, green: 0.922, blue: 0.843, alpha: 1 },
  aqua: { red: 0, green: 1, blue: 1, alpha: 1 },
  aquamarine: { red: 0.498, green: 1, blue: 0.831, alpha: 1 },
  azure: { red: 0.941, green: 1, blue: 1, alpha: 1 },
  beige: { red: 0.961, green: 0.961, blue: 0.863, alpha: 1 },
  bisque: { red: 1, green: 0.894, blue: 0.769, alpha: 1 },
  black: { red: 0, green: 0, blue: 0, alpha: 1 },
  blanchedalmond: { red: 1, green: 0.922, blue: 0.804, alpha: 1 },
  blue: { red: 0, green: 0, blue: 1, alpha: 1 },
  blueviolet: { red: 0.541, green: 0.169, blue: 0.886, alpha: 1 },
  brown: { red: 0.647, green: 0.165, blue: 0.165, alpha: 1 },
  burlywood: { red: 0.871, green: 0.722, blue: 0.529, alpha: 1 },
  cadetblue: { red: 0.373, green: 0.62, blue: 0.627, alpha: 1 },
  chartreuse: { red: 0.498, green: 1, blue: 0, alpha: 1 },
  chocolate: { red: 0.824, green: 0.412, blue: 0.118, alpha: 1 },
  coral: { red: 1, green: 0.498, blue: 0.314, alpha: 1 },
  cornflowerblue: { red: 0.392, green: 0.584, blue: 0.929, alpha: 1 },
  cornsilk: { red: 1, green: 0.973, blue: 0.863, alpha: 1 },
  crimson: { red: 0.863, green: 0.078, blue: 0.235, alpha: 1 },
  cyan: { red: 0, green: 1, blue: 1, alpha: 1 },
  darkblue: { red: 0, green: 0, blue: 0.545, alpha: 1 },
  darkcyan: { red: 0, green: 0.545, blue: 0.545, alpha: 1 },
  darkgoldenrod: { red: 0.722, green: 0.525, blue: 0.043, alpha: 1 },
  darkgray: { red: 0.663, green: 0.663, blue: 0.663, alpha: 1 },
  darkgreen: { red: 0, green: 0.392, blue: 0, alpha: 1 },
  darkgrey: { red: 0.663, green: 0.663, blue: 0.663, alpha: 1 },
  darkkhaki: { red: 0.741, green: 0.718, blue: 0.42, alpha: 1 },
  darkmagenta: { red: 0.545, green: 0, blue: 0.545, alpha: 1 },
  darkolivegreen: { red: 0.333, green: 0.42, blue: 0.184, alpha: 1 },
  darkorange: { red: 1, green: 0.549, blue: 0, alpha: 1 },
  darkorchid: { red: 0.6, green: 0.196, blue: 0.8, alpha: 1 },
  darkred: { red: 0.545, green: 0, blue: 0, alpha: 1 },
  darksalmon: { red: 0.914, green: 0.588, blue: 0.478, alpha: 1 },
  darkseagreen: { red: 0.561, green: 0.737, blue: 0.561, alpha: 1 },
  darkslateblue: { red: 0.282, green: 0.239, blue: 0.545, alpha: 1 },
  darkslategray: { red: 0.184, green: 0.31, blue: 0.31, alpha: 1 },
  darkslategrey: { red: 0.184, green: 0.31, blue: 0.31, alpha: 1 },
  darkturquoise: { red: 0, green: 0.808, blue: 0.82, alpha: 1 },
  darkviolet: { red: 0.58, green: 0, blue: 0.827, alpha: 1 },
  deeppink: { red: 1, green: 0.078, blue: 0.576, alpha: 1 },
  deepskyblue: { red: 0, green: 0.749, blue: 1, alpha: 1 },
  dimgray: { red: 0.412, green: 0.412, blue: 0.412, alpha: 1 },
  dimgrey: { red: 0.412, green: 0.412, blue: 0.412, alpha: 1 },
  dodgerblue: { red: 0.118, green: 0.565, blue: 1, alpha: 1 },
  firebrick: { red: 0.698, green: 0.133, blue: 0.133, alpha: 1 },
  floralwhite: { red: 1, green: 0.98, blue: 0.941, alpha: 1 },
  forestgreen: { red: 0.133, green: 0.545, blue: 0.133, alpha: 1 },
  fuchsia: { red: 1, green: 0, blue: 1, alpha: 1 },
  gainsboro: { red: 0.863, green: 0.863, blue: 0.863, alpha: 1 },
  ghostwhite: { red: 0.973, green: 0.973, blue: 1, alpha: 1 },
  gold: { red: 1, green: 0.843, blue: 0, alpha: 1 },
  goldenrod: { red: 0.855, green: 0.647, blue: 0.125, alpha: 1 },
  gray: { red: 0.502, green: 0.502, blue: 0.502, alpha: 1 },
  green: { red: 0, green: 0.502, blue: 0, alpha: 1 },
  greenyellow: { red: 0.678, green: 1, blue: 0.184, alpha: 1 },
  grey: { red: 0.502, green: 0.502, blue: 0.502, alpha: 1 },
  honeydew: { red: 0.941, green: 1, blue: 0.941, alpha: 1 },
  hotpink: { red: 1, green: 0.412, blue: 0.706, alpha: 1 },
  indianred: { red: 0.804, green: 0.361, blue: 0.361, alpha: 1 },
  indigo: { red: 0.294, green: 0, blue: 0.51, alpha: 1 },
  ivory: { red: 1, green: 1, blue: 0.941, alpha: 1 },
  khaki: { red: 0.941, green: 0.902, blue: 0.549, alpha: 1 },
  lavender: { red: 0.902, green: 0.902, blue: 0.98, alpha: 1 },
  lavenderblush: { red: 1, green: 0.941, blue: 0.961, alpha: 1 },
  lawngreen: { red: 0.486, green: 0.988, blue: 0, alpha: 1 },
  lemonchiffon: { red: 1, green: 0.98, blue: 0.804, alpha: 1 },
  lightblue: { red: 0.678, green: 0.847, blue: 0.902, alpha: 1 },
  lightcoral: { red: 0.941, green: 0.502, blue: 0.502, alpha: 1 },
  lightcyan: { red: 0.878, green: 1, blue: 1, alpha: 1 },
  lightgoldenrodyellow: { red: 0.98, green: 0.98, blue: 0.824, alpha: 1 },
  lightgray: { red: 0.827, green: 0.827, blue: 0.827, alpha: 1 },
  lightgreen: { red: 0.565, green: 0.933, blue: 0.565, alpha: 1 },
  lightgrey: { red: 0.827, green: 0.827, blue: 0.827, alpha: 1 },
  lightpink: { red: 1, green: 0.714, blue: 0.757, alpha: 1 },
  lightsalmon: { red: 1, green: 0.627, blue: 0.478, alpha: 1 },
  lightseagreen: { red: 0.125, green: 0.698, blue: 0.667, alpha: 1 },
  lightskyblue: { red: 0.529, green: 0.808, blue: 0.98, alpha: 1 },
  lightslategray: { red: 0.467, green: 0.533, blue: 0.6, alpha: 1 },
  lightslategrey: { red: 0.467, green: 0.533, blue: 0.6, alpha: 1 },
  lightsteelblue: { red: 0.69, green: 0.769, blue: 0.871, alpha: 1 },
  lightyellow: { red: 1, green: 1, blue: 0.878, alpha: 1 },
  lime: { red: 0, green: 1, blue: 0, alpha: 1 },
  limegreen: { red: 0.196, green: 0.804, blue: 0.196, alpha: 1 },
  linen: { red: 0.98, green: 0.941, blue: 0.902, alpha: 1 },
  magenta: { red: 1, green: 0, blue: 1, alpha: 1 },
  maroon: { red: 0.502, green: 0, blue: 0, alpha: 1 },
  mediumaquamarine: { red: 0.4, green: 0.804, blue: 0.667, alpha: 1 },
  mediumblue: { red: 0, green: 0, blue: 0.804, alpha: 1 },
  mediumorchid: { red: 0.729, green: 0.333, blue: 0.827, alpha: 1 },
  mediumpurple: { red: 0.576, green: 0.439, blue: 0.859, alpha: 1 },
  mediumseagreen: { red: 0.235, green: 0.702, blue: 0.443, alpha: 1 },
  mediumslateblue: { red: 0.482, green: 0.408, blue: 0.933, alpha: 1 },
  mediumspringgreen: { red: 0, green: 0.98, blue: 0.604, alpha: 1 },
  mediumturquoise: { red: 0.282, green: 0.82, blue: 0.8, alpha: 1 },
  mediumvioletred: { red: 0.78, green: 0.082, blue: 0.522, alpha: 1 },
  midnightblue: { red: 0.098, green: 0.098, blue: 0.439, alpha: 1 },
  mintcream: { red: 0.961, green: 1, blue: 0.98, alpha: 1 },
  mistyrose: { red: 1, green: 0.894, blue: 0.882, alpha: 1 },
  moccasin: { red: 1, green: 0.894, blue: 0.71, alpha: 1 },
  navajowhite: { red: 1, green: 0.871, blue: 0.678, alpha: 1 },
  navy: { red: 0, green: 0, blue: 0.502, alpha: 1 },
  oldlace: { red: 0.992, green: 0.961, blue: 0.902, alpha: 1 },
  olive: { red: 0.502, green: 0.502, blue: 0, alpha: 1 },
  olivedrab: { red: 0.42, green: 0.557, blue: 0.137, alpha: 1 },
  orange: { red: 1, green: 0.647, blue: 0, alpha: 1 },
  orangered: { red: 1, green: 0.271, blue: 0, alpha: 1 },
  orchid: { red: 0.855, green: 0.439, blue: 0.839, alpha: 1 },
  palegoldenrod: { red: 0.933, green: 0.91, blue: 0.667, alpha: 1 },
  palegreen: { red: 0.596, green: 0.984, blue: 0.596, alpha: 1 },
  paleturquoise: { red: 0.686, green: 0.933, blue: 0.933, alpha: 1 },
  palevioletred: { red: 0.859, green: 0.439, blue: 0.576, alpha: 1 },
  papayawhip: { red: 1, green: 0.937, blue: 0.835, alpha: 1 },
  peachpuff: { red: 1, green: 0.855, blue: 0.725, alpha: 1 },
  peru: { red: 0.804, green: 0.522, blue: 0.247, alpha: 1 },
  pink: { red: 1, green: 0.753, blue: 0.796, alpha: 1 },
  plum: { red: 0.867, green: 0.627, blue: 0.867, alpha: 1 },
  powderblue: { red: 0.69, green: 0.878, blue: 0.902, alpha: 1 },
  purple: { red: 0.502, green: 0, blue: 0.502, alpha: 1 },
  rebeccapurple: { red: 0.4, green: 0.2, blue: 0.6, alpha: 1 },
  red: { red: 1, green: 0, blue: 0, alpha: 1 },
  rosybrown: { red: 0.737, green: 0.561, blue: 0.561, alpha: 1 },
  royalblue: { red: 0.255, green: 0.412, blue: 0.882, alpha: 1 },
  saddlebrown: { red: 0.545, green: 0.271, blue: 0.075, alpha: 1 },
  salmon: { red: 0.98, green: 0.502, blue: 0.447, alpha: 1 },
  sandybrown: { red: 0.957, green: 0.643, blue: 0.376, alpha: 1 },
  seagreen: { red: 0.18, green: 0.545, blue: 0.341, alpha: 1 },
  seashell: { red: 1, green: 0.961, blue: 0.933, alpha: 1 },
  sienna: { red: 0.627, green: 0.322, blue: 0.176, alpha: 1 },
  silver: { red: 0.753, green: 0.753, blue: 0.753, alpha: 1 },
  skyblue: { red: 0.529, green: 0.808, blue: 0.922, alpha: 1 },
  slateblue: { red: 0.416, green: 0.353, blue: 0.804, alpha: 1 },
  slategray: { red: 0.439, green: 0.502, blue: 0.565, alpha: 1 },
  slategrey: { red: 0.439, green: 0.502, blue: 0.565, alpha: 1 },
  snow: { red: 1, green: 0.98, blue: 0.98, alpha: 1 },
  springgreen: { red: 0, green: 1, blue: 0.498, alpha: 1 },
  steelblue: { red: 0.275, green: 0.51, blue: 0.706, alpha: 1 },
  tan: { red: 0.824, green: 0.706, blue: 0.549, alpha: 1 },
  teal: { red: 0, green: 0.502, blue: 0.502, alpha: 1 },
  thistle: { red: 0.847, green: 0.749, blue: 0.847, alpha: 1 },
  tomato: { red: 1, green: 0.388, blue: 0.278, alpha: 1 },
  transparent: { red: 0, green: 0, blue: 0, alpha: 0 },
  turquoise: { red: 0.251, green: 0.878, blue: 0.816, alpha: 1 },
  violet: { red: 0.933, green: 0.51, blue: 0.933, alpha: 1 },
  wheat: { red: 0.961, green: 0.871, blue: 0.702, alpha: 1 },
  white: { red: 1, green: 1, blue: 1, alpha: 1 },
  whitesmoke: { red: 0.961, green: 0.961, blue: 0.961, alpha: 1 },
  yellow: { red: 1, green: 1, blue: 0, alpha: 1 },
  yellowgreen: { red: 0.604, green: 0.804, blue: 0.196, alpha: 1 },
};

// ============================================================================
// Color Conversion Utilities
// ============================================================================

/**
 * Convert a hex color string to Color object.
 */
export function hexToColor(hex: string): Color {
  const cleanHex = hex.replace("#", "");
  let r: number, g: number, b: number, a = 1;

  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
    g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
    b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
  } else if (cleanHex.length === 4) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
    g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
    b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
    a = parseInt(cleanHex[3] + cleanHex[3], 16) / 255;
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  } else if (cleanHex.length === 8) {
    r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    a = parseInt(cleanHex.substring(6, 8), 16) / 255;
  } else {
    return { red: 0, green: 0, blue: 0, alpha: 1 };
  }

  return { red: r, green: g, blue: b, alpha: a };
}

/**
 * Convert a Color object to hex string.
 */
export function colorToHex(color: Color, includeAlpha = false): string {
  const r = Math.round(color.red * 255).toString(16).padStart(2, "0");
  const g = Math.round(color.green * 255).toString(16).padStart(2, "0");
  const b = Math.round(color.blue * 255).toString(16).padStart(2, "0");

  if (includeAlpha && color.alpha < 1) {
    const a = Math.round(color.alpha * 255).toString(16).padStart(2, "0");
    return `#${r}${g}${b}${a}`;
  }

  return `#${r}${g}${b}`;
}

/**
 * Convert a Color object to RGB/RGBA string.
 */
export function colorToRgb(color: Color): string {
  const r = Math.round(color.red * 255);
  const g = Math.round(color.green * 255);
  const b = Math.round(color.blue * 255);

  if (color.alpha < 1) {
    return `rgba(${r}, ${g}, ${b}, ${color.alpha.toFixed(2)})`;
  }

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Convert a Color object to HSL/HSLA string.
 */
export function colorToHsl(color: Color): string {
  const r = color.red;
  const g = color.green;
  const b = color.blue;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  const hDeg = Math.round(h * 360);
  const sPercent = Math.round(s * 100);
  const lPercent = Math.round(l * 100);

  if (color.alpha < 1) {
    return `hsla(${hDeg}, ${sPercent}%, ${lPercent}%, ${color.alpha.toFixed(2)})`;
  }

  return `hsl(${hDeg}, ${sPercent}%, ${lPercent}%)`;
}

/**
 * Parse RGB/RGBA string to Color object.
 */
export function rgbToColor(rgb: string): Color | null {
  const match = rgb.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (!match) return null;

  return {
    red: parseInt(match[1], 10) / 255,
    green: parseInt(match[2], 10) / 255,
    blue: parseInt(match[3], 10) / 255,
    alpha: match[4] ? parseFloat(match[4]) : 1,
  };
}

/**
 * Parse HSL/HSLA string to Color object.
 */
export function hslToColor(hsl: string): Color | null {
  const match = hsl.match(/hsla?\s*\(\s*(\d+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (!match) return null;

  const h = parseInt(match[1], 10) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  const a = match[4] ? parseFloat(match[4]) : 1;

  // HSL to RGB conversion
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { red: r, green: g, blue: b, alpha: a };
}

/**
 * Parse a color string (any format) to Color object.
 */
export function parseColor(colorString: string): Color | null {
  const trimmed = colorString.trim().toLowerCase();

  // Check named colors
  if (NAMED_COLORS[trimmed]) {
    return { ...NAMED_COLORS[trimmed] };
  }

  // Check hex
  if (trimmed.startsWith("#")) {
    return hexToColor(trimmed);
  }

  // Check rgb/rgba
  if (trimmed.startsWith("rgb")) {
    return rgbToColor(trimmed);
  }

  // Check hsl/hsla
  if (trimmed.startsWith("hsl")) {
    return hslToColor(trimmed);
  }

  return null;
}

/**
 * Get all color presentations for a color.
 */
export function getDefaultColorPresentations(color: Color, range: Range): ColorPresentation[] {
  const presentations: ColorPresentation[] = [];

  // HEX (without alpha)
  presentations.push({
    label: colorToHex(color, false),
    textEdit: { range, newText: colorToHex(color, false) },
  });

  // HEX with alpha (if not fully opaque)
  if (color.alpha < 1) {
    presentations.push({
      label: colorToHex(color, true),
      textEdit: { range, newText: colorToHex(color, true) },
    });
  }

  // RGB/RGBA
  presentations.push({
    label: colorToRgb(color),
    textEdit: { range, newText: colorToRgb(color) },
  });

  // HSL/HSLA
  presentations.push({
    label: colorToHsl(color),
    textEdit: { range, newText: colorToHsl(color) },
  });

  return presentations;
}

// ============================================================================
// Color Provider
// ============================================================================

/**
 * Supported languages for color provider.
 */
export const COLOR_PROVIDER_LANGUAGES = [
  "css",
  "scss",
  "sass",
  "less",
  "stylus",
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "html",
  "vue",
  "svelte",
];

/**
 * Create a Monaco color provider for LSP integration.
 */
export function createColorProvider(options: ColorProviderOptions): ColorProviderResult {
  const { monaco, languageId, serverId, filePath, getDocumentColors, getColorPresentations } = options;

  const provider = monaco.languages.registerColorProvider(languageId, {
    async provideDocumentColors(
      model: Monaco.editor.ITextModel,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.IColorInformation[]> {
      // Verify this is the correct model
      const modelUri = model.uri.toString();
      const fileUri = `file://${filePath.replace(/\\/g, "/")}`;
      if (!modelUri.includes(filePath.replace(/\\/g, "/")) && modelUri !== fileUri) {
        return [];
      }

      try {
        // Try to get colors from LSP first
        const lspColors = await getDocumentColors(serverId, filePath);

        if (lspColors && lspColors.length > 0) {
          return lspColors.map((colorInfo) => ({
            range: new monaco.Range(
              colorInfo.range.start.line + 1,
              colorInfo.range.start.character + 1,
              colorInfo.range.end.line + 1,
              colorInfo.range.end.character + 1
            ),
            color: {
              red: colorInfo.color.red,
              green: colorInfo.color.green,
              blue: colorInfo.color.blue,
              alpha: colorInfo.color.alpha,
            },
          }));
        }

        // Fallback: Parse colors from document text
        return parseColorsFromDocument(monaco, model);
      } catch (e) {
        console.debug("Color provider error (falling back to local parsing):", e);
        // Fallback to local color parsing
        return parseColorsFromDocument(monaco, model);
      }
    },

    async provideColorPresentations(
      _model: Monaco.editor.ITextModel,
      colorInfo: Monaco.languages.IColorInformation,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.IColorPresentation[]> {
      const lspRange: Range = {
        start: {
          line: colorInfo.range.startLineNumber - 1,
          character: colorInfo.range.startColumn - 1,
        },
        end: {
          line: colorInfo.range.endLineNumber - 1,
          character: colorInfo.range.endColumn - 1,
        },
      };

      const lspColor: Color = {
        red: colorInfo.color.red,
        green: colorInfo.color.green,
        blue: colorInfo.color.blue,
        alpha: colorInfo.color.alpha,
      };

      try {
        // Try to get presentations from LSP
        const lspPresentations = await getColorPresentations(serverId, filePath, lspColor, lspRange);

        if (lspPresentations && lspPresentations.length > 0) {
          return lspPresentations.map((pres) => {
            const result: Monaco.languages.IColorPresentation = {
              label: pres.label,
            };

            if (pres.textEdit) {
              result.textEdit = {
                range: new monaco.Range(
                  pres.textEdit.range.start.line + 1,
                  pres.textEdit.range.start.character + 1,
                  pres.textEdit.range.end.line + 1,
                  pres.textEdit.range.end.character + 1
                ),
                text: pres.textEdit.newText,
              };
            }

            if (pres.additionalTextEdits) {
              result.additionalTextEdits = pres.additionalTextEdits.map((edit) => ({
                range: new monaco.Range(
                  edit.range.start.line + 1,
                  edit.range.start.character + 1,
                  edit.range.end.line + 1,
                  edit.range.end.character + 1
                ),
                text: edit.newText,
              }));
            }

            return result;
          });
        }

        // Fallback: Generate default presentations
        return getDefaultColorPresentations(lspColor, lspRange).map((pres) => ({
          label: pres.label,
          textEdit: pres.textEdit
            ? {
                range: colorInfo.range,
                text: pres.textEdit.newText,
              }
            : undefined,
        }));
      } catch (e) {
        console.debug("Color presentations error (falling back to defaults):", e);
        // Fallback to default presentations
        return getDefaultColorPresentations(lspColor, lspRange).map((pres) => ({
          label: pres.label,
          textEdit: pres.textEdit
            ? {
                range: colorInfo.range,
                text: pres.textEdit.newText,
              }
            : undefined,
        }));
      }
    },
  });

  return {
    provider,
    refresh: () => {
      // Monaco's color provider automatically refreshes when the document changes
      // This is a placeholder for potential future optimizations
    },
  };
}

/**
 * Parse colors from document text (fallback when LSP unavailable).
 */
function parseColorsFromDocument(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel
): Monaco.languages.IColorInformation[] {
  const colors: Monaco.languages.IColorInformation[] = [];
  const lineCount = model.getLineCount();

  // Process each line
  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const lineText = model.getLineContent(lineNumber);

    // Find hex colors
    const hexMatches = Array.from(lineText.matchAll(COLOR_PATTERNS.hex));
    for (const match of hexMatches) {
      const color = hexToColor(match[0]);
      const startColumn = match.index! + 1;
      const endColumn = startColumn + match[0].length;

      colors.push({
        range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
        color,
      });
    }

    // Find rgb/rgba colors
    const rgbMatches = Array.from(lineText.matchAll(COLOR_PATTERNS.rgb));
    for (const match of rgbMatches) {
      const color = rgbToColor(match[0]);
      if (color) {
        const startColumn = match.index! + 1;
        const endColumn = startColumn + match[0].length;

        colors.push({
          range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
          color,
        });
      }
    }

    // Find hsl/hsla colors
    const hslMatches = Array.from(lineText.matchAll(COLOR_PATTERNS.hsl));
    for (const match of hslMatches) {
      const color = hslToColor(match[0]);
      if (color) {
        const startColumn = match.index! + 1;
        const endColumn = startColumn + match[0].length;

        colors.push({
          range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
          color,
        });
      }
    }

    // Find named colors (only in CSS-like languages)
    const namedColorRegex = /\b([a-z]+)\b/gi;
    const namedMatches = Array.from(lineText.matchAll(namedColorRegex));
    for (const match of namedMatches) {
      const colorName = match[1].toLowerCase();
      if (NAMED_COLORS[colorName]) {
        const startColumn = match.index! + 1;
        const endColumn = startColumn + match[0].length;

        // Check context - only match if it looks like a color value
        // (after : in CSS, or in specific JavaScript contexts)
        const beforeMatch = lineText.substring(0, match.index!);
        if (beforeMatch.match(/:\s*$/) || beforeMatch.match(/color\s*[=:]\s*['"]?$/i)) {
          colors.push({
            range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
            color: { ...NAMED_COLORS[colorName] },
          });
        }
      }
    }
  }

  return colors;
}

/**
 * Get Monaco editor options for color picker styling.
 */
export function getColorProviderEditorOptions(): Monaco.editor.IEditorOptions {
  return {
    colorDecorators: true,
    colorDecoratorsLimit: 500,
  };
}

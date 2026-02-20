/**
 * =============================================================================
 * TERMINAL IMAGE PROTOCOLS - Parse terminal image escape sequences
 * =============================================================================
 *
 * Supports parsing of inline image protocols:
 * - iTerm2 inline images protocol (OSC 1337)
 * - Sixel graphics (DCS sequences)
 * - Kitty graphics protocol (APC sequences)
 *
 * These protocols allow terminals to display inline images within the terminal
 * output, commonly used for displaying plots, screenshots, and graphics.
 * =============================================================================
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supported image protocols
 */
export type ImageProtocol = "iterm2" | "sixel" | "kitty";

/**
 * Size units for image dimensions
 */
export type ImageSizeUnit = "cells" | "pixels" | "percent" | "auto";

/**
 * Inline image representation
 */
export interface InlineImage {
  /** Unique identifier for this image */
  id: string;
  /** Base64 encoded image data */
  data: string;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Width unit */
  widthUnit: ImageSizeUnit;
  /** Height unit */
  heightUnit: ImageSizeUnit;
  /** Whether to preserve aspect ratio */
  preserveAspectRatio: boolean;
  /** Position in terminal */
  position: {
    row: number;
    col: number;
  };
  /** Protocol that produced this image */
  protocol: ImageProtocol;
  /** Optional filename */
  filename?: string;
  /** MIME type if known */
  mimeType?: string;
  /** Whether to inline display (vs download) */
  inline: boolean;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Parsed iTerm2 image parameters
 */
interface ITerm2ImageParams {
  name?: string;
  size?: number;
  width?: string;
  height?: string;
  preserveAspectRatio?: boolean;
  inline?: boolean;
}

/**
 * Kitty image transmission parameters
 */
interface KittyImageParams {
  action?: "t" | "T" | "q" | "p" | "d" | "f" | "a" | "c"; // transmit, transmit+display, query, put, delete, frame, animate, compose
  format?: "24" | "32" | "100"; // RGB, RGBA, PNG
  transmission?: "d" | "f" | "t" | "s"; // direct, file, temp, shared memory
  compression?: "z"; // zlib
  width?: number;
  height?: number;
  id?: number;
  placement?: number;
  x?: number;
  y?: number;
  cols?: number;
  rows?: number;
  more?: boolean; // More data chunks to come
}

/**
 * Sixel image parameters
 */
interface SixelParams {
  pixelAspectRatio?: number;
  backgroundColor?: number;
  horizontalGridSize?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Escape sequence markers
const ESC = "\x1b";
const BEL = "\x07";
const ST = `${ESC}\\`; // String Terminator

// iTerm2 OSC 1337
const ITERM2_PREFIX = `${ESC}]1337;`;

// Kitty APC
const KITTY_PREFIX = `${ESC}_G`;

// Sixel DCS
const SIXEL_PREFIX = `${ESC}P`;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate unique image ID
 */
function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parse dimension string to value and unit
 */
function parseDimension(value: string | undefined): { value: number; unit: ImageSizeUnit } {
  if (!value || value === "auto") {
    return { value: 0, unit: "auto" };
  }

  const numMatch = value.match(/^(\d+)(px|%|cells?)?$/i);
  if (!numMatch) {
    return { value: 0, unit: "auto" };
  }

  const num = parseInt(numMatch[1], 10);
  const suffix = (numMatch[2] || "").toLowerCase();

  if (suffix === "px") {
    return { value: num, unit: "pixels" };
  } else if (suffix === "%") {
    return { value: num, unit: "percent" };
  } else if (suffix.startsWith("cell")) {
    return { value: num, unit: "cells" };
  }

  // Default to cells for bare numbers
  return { value: num, unit: "cells" };
}

/**
 * Decode base64 to determine image dimensions (PNG only for now)
 */
function getImageDimensionsFromBase64(base64: string): { width: number; height: number } | null {
  try {
    // Check PNG signature and extract dimensions from IHDR
    const binary = atob(base64.substring(0, 100)); // Only need first ~100 bytes for PNG header
    
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (binary.charCodeAt(0) === 0x89 && 
        binary.charCodeAt(1) === 0x50 && 
        binary.charCodeAt(2) === 0x4E && 
        binary.charCodeAt(3) === 0x47) {
      // IHDR chunk starts at byte 8, width at 16, height at 20
      const width = (binary.charCodeAt(16) << 24) | 
                   (binary.charCodeAt(17) << 16) | 
                   (binary.charCodeAt(18) << 8) | 
                   binary.charCodeAt(19);
      const height = (binary.charCodeAt(20) << 24) | 
                    (binary.charCodeAt(21) << 16) | 
                    (binary.charCodeAt(22) << 8) | 
                    binary.charCodeAt(23);
      return { width, height };
    }

    // JPEG: Look for SOF0 marker
    if (binary.charCodeAt(0) === 0xFF && binary.charCodeAt(1) === 0xD8) {
      // Would need to parse JPEG markers - return null for now
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect MIME type from base64 data
 */
function detectMimeType(base64: string): string {
  try {
    const binary = atob(base64.substring(0, 16));
    
    // PNG: 89 50 4E 47
    if (binary.charCodeAt(0) === 0x89 && binary.substring(1, 4) === "PNG") {
      return "image/png";
    }
    
    // JPEG: FF D8 FF
    if (binary.charCodeAt(0) === 0xFF && 
        binary.charCodeAt(1) === 0xD8 && 
        binary.charCodeAt(2) === 0xFF) {
      return "image/jpeg";
    }
    
    // GIF: 47 49 46 38
    if (binary.substring(0, 4) === "GIF8") {
      return "image/gif";
    }
    
    // WebP: RIFF...WEBP
    if (binary.substring(0, 4) === "RIFF" && binary.substring(8, 12) === "WEBP") {
      return "image/webp";
    }
    
    // BMP: 42 4D
    if (binary.substring(0, 2) === "BM") {
      return "image/bmp";
    }

    return "image/png"; // Default assumption
  } catch {
    return "image/png";
  }
}

// =============================================================================
// iTerm2 PROTOCOL PARSER
// =============================================================================

/**
 * Parse iTerm2 inline image escape sequence
 *
 * Format: OSC 1337 ; File=name=<base64>;size=<size>;inline=1 : <base64-data> ST
 * OSC = ESC ]
 * ST = ESC \ or BEL
 *
 * Parameters:
 * - name: Base64 encoded filename
 * - size: File size in bytes
 * - width: Width in cells/pixels/percent (e.g., "80px", "50%", "auto")
 * - height: Height in cells/pixels/percent
 * - preserveAspectRatio: 0 or 1 (default 1)
 * - inline: 0 or 1 (1 = display inline)
 */
export function parseITerm2Image(sequence: string): InlineImage | null {
  // Check for iTerm2 prefix
  if (!sequence.startsWith(ITERM2_PREFIX)) {
    return null;
  }

  // Remove prefix
  let content = sequence.substring(ITERM2_PREFIX.length);

  // Remove terminator (BEL or ST)
  if (content.endsWith(BEL)) {
    content = content.slice(0, -1);
  } else if (content.endsWith(ST)) {
    content = content.slice(0, -2);
  }

  // Check for File= prefix
  if (!content.startsWith("File=")) {
    return null;
  }

  content = content.substring(5); // Remove "File="

  // Split params from data at the colon
  const colonIndex = content.indexOf(":");
  if (colonIndex === -1) {
    return null;
  }

  const paramsStr = content.substring(0, colonIndex);
  const base64Data = content.substring(colonIndex + 1);

  if (!base64Data) {
    return null;
  }

  // Parse parameters
  const params: ITerm2ImageParams = {};
  const paramPairs = paramsStr.split(";");

  for (const pair of paramPairs) {
    const [key, value] = pair.split("=");
    if (!key) continue;

    switch (key.toLowerCase()) {
      case "name":
        try {
          params.name = atob(value);
        } catch {
          params.name = value;
        }
        break;
      case "size":
        params.size = parseInt(value, 10);
        break;
      case "width":
        params.width = value;
        break;
      case "height":
        params.height = value;
        break;
      case "preserveaspectratio":
        params.preserveAspectRatio = value !== "0";
        break;
      case "inline":
        params.inline = value === "1";
        break;
    }
  }

  // Parse dimensions
  const widthParsed = parseDimension(params.width);
  const heightParsed = parseDimension(params.height);

  // Try to get actual image dimensions if not specified
  let actualWidth = widthParsed.value;
  let actualHeight = heightParsed.value;

  if (widthParsed.unit === "auto" || heightParsed.unit === "auto") {
    const dims = getImageDimensionsFromBase64(base64Data);
    if (dims) {
      if (widthParsed.unit === "auto") {
        actualWidth = dims.width;
      }
      if (heightParsed.unit === "auto") {
        actualHeight = dims.height;
      }
    }
  }

  return {
    id: generateImageId(),
    data: base64Data,
    width: actualWidth,
    height: actualHeight,
    widthUnit: widthParsed.unit === "auto" ? "pixels" : widthParsed.unit,
    heightUnit: heightParsed.unit === "auto" ? "pixels" : heightParsed.unit,
    preserveAspectRatio: params.preserveAspectRatio !== false,
    position: { row: 0, col: 0 }, // Will be set by caller
    protocol: "iterm2",
    filename: params.name,
    mimeType: detectMimeType(base64Data),
    inline: params.inline !== false,
    createdAt: Date.now(),
  };
}

// =============================================================================
// SIXEL PROTOCOL PARSER
// =============================================================================

/**
 * Parse Sixel graphics escape sequence
 *
 * Format: DCS P1 ; P2 ; P3 q <sixel-data> ST
 * DCS = ESC P
 * ST = ESC \
 *
 * Parameters:
 * - P1: Pixel aspect ratio (0-9)
 * - P2: Background select (0=device default, 1=no change, 2=set to 0)
 * - P3: Horizontal grid size (ignored)
 */
export function parseSixelImage(sequence: string): InlineImage | null {
  // Check for Sixel DCS prefix
  if (!sequence.startsWith(SIXEL_PREFIX)) {
    return null;
  }

  // Remove prefix
  let content = sequence.substring(SIXEL_PREFIX.length);

  // Remove terminator
  if (content.endsWith(ST)) {
    content = content.slice(0, -2);
  }

  // Find 'q' which marks start of sixel data
  const qIndex = content.indexOf("q");
  if (qIndex === -1) {
    return null;
  }

  const paramsStr = content.substring(0, qIndex);
  const sixelData = content.substring(qIndex + 1);

  if (!sixelData) {
    return null;
  }

  // Parse parameters (P1;P2;P3)
  const params: SixelParams = {};
  const paramParts = paramsStr.split(";");

  if (paramParts[0]) {
    params.pixelAspectRatio = parseInt(paramParts[0], 10);
  }
  if (paramParts[1]) {
    params.backgroundColor = parseInt(paramParts[1], 10);
  }
  if (paramParts[2]) {
    params.horizontalGridSize = parseInt(paramParts[2], 10);
  }

  // Calculate dimensions from sixel data
  // Sixel encodes 6 pixels vertically per character
  // Width is determined by position commands ($, -)
  // This is a simplified calculation - full parsing would require decoding the sixel
  const dimensions = calculateSixelDimensions(sixelData);

  return {
    id: generateImageId(),
    data: sixelData, // Raw sixel data - will need conversion for display
    width: dimensions.width,
    height: dimensions.height,
    widthUnit: "pixels",
    heightUnit: "pixels",
    preserveAspectRatio: true,
    position: { row: 0, col: 0 },
    protocol: "sixel",
    mimeType: "image/sixel",
    inline: true,
    createdAt: Date.now(),
  };
}

/**
 * Calculate approximate dimensions from sixel data
 */
function calculateSixelDimensions(sixelData: string): { width: number; height: number } {
  let maxX = 0;
  let currentX = 0;
  let rows = 1;

  for (let i = 0; i < sixelData.length; i++) {
    const char = sixelData[i];
    const code = char.charCodeAt(0);

    if (char === "$") {
      // Carriage return - reset X
      currentX = 0;
    } else if (char === "-") {
      // New line - move down 6 pixels
      rows++;
      currentX = 0;
    } else if (char === "!") {
      // Repeat count
      let count = "";
      while (i + 1 < sixelData.length && /\d/.test(sixelData[i + 1])) {
        i++;
        count += sixelData[i];
      }
      currentX += parseInt(count, 10) || 1;
    } else if (code >= 63 && code <= 126) {
      // Sixel character
      currentX++;
    }

    maxX = Math.max(maxX, currentX);
  }

  return {
    width: maxX,
    height: rows * 6, // 6 pixels per row
  };
}

// =============================================================================
// KITTY PROTOCOL PARSER
// =============================================================================

/**
 * Parse Kitty graphics protocol escape sequence
 *
 * Format: APC G <key>=<value>,... ; <payload> ST
 * APC = ESC _
 * ST = ESC \
 *
 * Common parameters:
 * - a: action (t=transmit, T=transmit+display, q=query, p=put, d=delete)
 * - f: format (24=RGB, 32=RGBA, 100=PNG)
 * - t: transmission (d=direct, f=file, t=temp, s=shared)
 * - o: compression (z=zlib)
 * - s: width in pixels
 * - v: height in pixels
 * - i: image id
 * - c: columns
 * - r: rows
 * - m: more data to follow (1=yes)
 */
export function parseKittyImage(sequence: string): InlineImage | null {
  // Check for Kitty APC prefix
  if (!sequence.startsWith(KITTY_PREFIX)) {
    return null;
  }

  // Remove prefix
  let content = sequence.substring(KITTY_PREFIX.length);

  // Remove terminator
  if (content.endsWith(ST)) {
    content = content.slice(0, -2);
  }

  // Split params from payload at semicolon
  const semicolonIndex = content.indexOf(";");
  if (semicolonIndex === -1) {
    // No payload - might be a control command
    return null;
  }

  const paramsStr = content.substring(0, semicolonIndex);
  const payload = content.substring(semicolonIndex + 1);

  // Parse parameters
  const params: KittyImageParams = {};
  const paramPairs = paramsStr.split(",");

  for (const pair of paramPairs) {
    const [key, value] = pair.split("=");
    if (!key || !value) continue;

    switch (key) {
      case "a":
        params.action = value as KittyImageParams["action"];
        break;
      case "f":
        params.format = value as KittyImageParams["format"];
        break;
      case "t":
        params.transmission = value as KittyImageParams["transmission"];
        break;
      case "o":
        params.compression = value as KittyImageParams["compression"];
        break;
      case "s":
        params.width = parseInt(value, 10);
        break;
      case "v":
        params.height = parseInt(value, 10);
        break;
      case "i":
        params.id = parseInt(value, 10);
        break;
      case "p":
        params.placement = parseInt(value, 10);
        break;
      case "x":
        params.x = parseInt(value, 10);
        break;
      case "y":
        params.y = parseInt(value, 10);
        break;
      case "c":
        params.cols = parseInt(value, 10);
        break;
      case "r":
        params.rows = parseInt(value, 10);
        break;
      case "m":
        params.more = value === "1";
        break;
    }
  }

  // Skip non-transmission actions
  if (params.action && !["t", "T"].includes(params.action)) {
    return null;
  }

  // Skip "more data" chunks - they should be accumulated
  if (params.more) {
    return null;
  }

  // Decompress if needed
  let imageData = payload;
  if (params.compression === "z") {
    // Would need pako or similar for zlib decompression
    // For now, return as-is and let renderer handle it
  }

  // Determine dimensions
  let width = params.width || 0;
  let height = params.height || 0;

  // Try to get from PNG header if format is PNG
  if (params.format === "100" && (width === 0 || height === 0)) {
    const dims = getImageDimensionsFromBase64(imageData);
    if (dims) {
      width = width || dims.width;
      height = height || dims.height;
    }
  }

  // Determine MIME type from format
  let mimeType = "image/png";
  if (params.format === "24") {
    mimeType = "image/raw-rgb";
  } else if (params.format === "32") {
    mimeType = "image/raw-rgba";
  }

  return {
    id: params.id ? `kitty_${params.id}` : generateImageId(),
    data: imageData,
    width,
    height,
    widthUnit: "pixels",
    heightUnit: "pixels",
    preserveAspectRatio: true,
    position: {
      row: params.y || 0,
      col: params.x || 0,
    },
    protocol: "kitty",
    mimeType,
    inline: true,
    createdAt: Date.now(),
  };
}

// =============================================================================
// PROTOCOL DETECTION
// =============================================================================

/**
 * Detect which image protocol a sequence uses
 */
export function detectImageProtocol(sequence: string): ImageProtocol | null {
  if (sequence.startsWith(ITERM2_PREFIX) && sequence.includes("File=")) {
    return "iterm2";
  }

  if (sequence.startsWith(SIXEL_PREFIX) && sequence.includes("q")) {
    return "sixel";
  }

  if (sequence.startsWith(KITTY_PREFIX)) {
    return "kitty";
  }

  return null;
}

/**
 * Parse any supported image protocol
 */
export function parseImageSequence(sequence: string): InlineImage | null {
  const protocol = detectImageProtocol(sequence);

  switch (protocol) {
    case "iterm2":
      return parseITerm2Image(sequence);
    case "sixel":
      return parseSixelImage(sequence);
    case "kitty":
      return parseKittyImage(sequence);
    default:
      return null;
  }
}

// =============================================================================
// IMAGE SEQUENCE EXTRACTOR
// =============================================================================

/**
 * Extract image sequences from terminal output
 * Returns both the cleaned output and any found images
 */
export interface ExtractedImages {
  /** Terminal output with image sequences removed */
  cleanedOutput: string;
  /** Extracted images with their positions */
  images: Array<{
    image: InlineImage;
    startIndex: number;
    endIndex: number;
  }>;
}

/**
 * Extract all image sequences from terminal output
 */
export function extractImageSequences(output: string): ExtractedImages {
  const images: ExtractedImages["images"] = [];
  let cleanedOutput = output;
  let offset = 0;

  // Pattern to match all image sequence types
  // This is a simplified approach - real implementation would need more robust parsing
  const patterns = [
    // iTerm2: ESC ] 1337 ; File= ... (BEL or ESC \)
    /\x1b\]1337;File=[^\x07\x1b]*(?:\x07|\x1b\\)/g,
    // Sixel: ESC P ... q ... ESC \
    /\x1bP[^q]*q[^\x1b]*\x1b\\/g,
    // Kitty: ESC _ G ... ESC \
    /\x1b_G[^\x1b]*\x1b\\/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      const sequence = match[0];
      const image = parseImageSequence(sequence);

      if (image) {
        images.push({
          image,
          startIndex: match.index - offset,
          endIndex: match.index + sequence.length - offset,
        });

        // Remove sequence from cleaned output
        const beforeOffset = cleanedOutput.substring(0, match.index - offset);
        const afterOffset = cleanedOutput.substring(match.index - offset + sequence.length);
        cleanedOutput = beforeOffset + afterOffset;
        offset += sequence.length;
      }
    }
  }

  return { cleanedOutput, images };
}

// =============================================================================
// SIXEL CONVERSION (Basic implementation)
// =============================================================================

/**
 * Convert sixel data to PNG base64
 * This is a simplified implementation - a full implementation would require
 * proper sixel decoding
 */
export function convertSixelToPNG(_sixelData: string): string | null {
  // Sixel decoding is complex - would need to:
  // 1. Parse color definitions (#Pc;Pu;Px;Py;Pz)
  // 2. Decode sixel characters (63-126) to 6 vertical bits
  // 3. Handle position commands ($, -)
  // 4. Build pixel array
  // 5. Encode as PNG

  // For now, return null - sixel images would need a canvas-based decoder
  return null;
}

// =============================================================================
// KITTY RAW DATA CONVERSION
// =============================================================================

/**
 * Convert Kitty raw RGB/RGBA data to PNG base64
 */
export function convertKittyRawToPNG(
  _data: string,
  _width: number,
  _height: number,
  _format: "24" | "32"
): string | null {
  // Would need to:
  // 1. Decode base64
  // 2. Create canvas with correct dimensions
  // 3. Create ImageData from raw pixels
  // 4. Draw to canvas
  // 5. Export as PNG base64

  // For now, return null - would need canvas access
  return null;
}

export default {
  parseITerm2Image,
  parseSixelImage,
  parseKittyImage,
  detectImageProtocol,
  parseImageSequence,
  extractImageSequences,
};

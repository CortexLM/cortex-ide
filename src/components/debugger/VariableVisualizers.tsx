import { Show, For, createSignal, createMemo, JSX, Component } from "solid-js";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

// =============================================================================
// Types
// =============================================================================

export interface HexViewerProps {
  data: number[];
  bytesPerRow?: number;
}

export interface ImagePreviewProps {
  dataUrl: string;
  maxWidth?: number;
  maxHeight?: number;
}

export interface JsonTreeViewProps {
  data: unknown;
  expandLevel?: number;
}

export interface ArrayVisualizerProps {
  items: unknown[];
  pageSize?: number;
}

export interface DateTimeVisualizerProps {
  timestamp: number;
}

export interface ColorVisualizerProps {
  color: string;
}

export interface UrlVisualizerProps {
  url: string;
}

export interface MapVisualizerProps {
  entries: Array<{ key: unknown; value: unknown }>;
  pageSize?: number;
}

export interface SetVisualizerProps {
  values: unknown[];
  pageSize?: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Converts a byte to a printable ASCII character or a dot for non-printable
 */
function byteToAscii(byte: number): string {
  if (byte >= 32 && byte <= 126) {
    return String.fromCharCode(byte);
  }
  return ".";
}

/**
 * Pads a string to a minimum length
 */
function padLeft(str: string, length: number, char = " "): string {
  while (str.length < length) {
    str = char + str;
  }
  return str;
}

/**
 * Formats a number as hex with leading zeros
 */
function toHex(num: number, length = 2): string {
  return padLeft(num.toString(16).toUpperCase(), length, "0");
}

/**
 * Copies text to clipboard
 */
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    console.error("Failed to copy to clipboard:", e);
  }
}

/**
 * Formats a relative time string
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff > 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let value: number;
  let unit: string;

  if (seconds < 60) {
    value = seconds;
    unit = "second";
  } else if (minutes < 60) {
    value = minutes;
    unit = "minute";
  } else if (hours < 24) {
    value = hours;
    unit = "hour";
  } else if (days < 7) {
    value = days;
    unit = "day";
  } else if (weeks < 4) {
    value = weeks;
    unit = "week";
  } else if (months < 12) {
    value = months;
    unit = "month";
  } else {
    value = years;
    unit = "year";
  }

  const plural = value !== 1 ? "s" : "";
  return isPast ? `${value} ${unit}${plural} ago` : `in ${value} ${unit}${plural}`;
}

/**
 * Parses a color string and returns RGB values
 */
function parseColor(color: string): { r: number; g: number; b: number; a?: number } | null {
  // Handle hex colors
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
      a: hexMatch[4] ? parseInt(hexMatch[4], 16) / 255 : undefined,
    };
  }

  // Handle short hex colors
  const shortHexMatch = color.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
  if (shortHexMatch) {
    return {
      r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
      g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
      b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16),
    };
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : undefined,
    };
  }

  // Handle hsl/hsla colors
  const hslMatch = color.match(/hsla?\s*\(\s*(\d+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (hslMatch) {
    const h = parseInt(hslMatch[1], 10);
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    
    // Convert HSL to RGB
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
      a: hslMatch[4] ? parseFloat(hslMatch[4]) : undefined,
    };
  }

  return null;
}

/**
 * Determines if a color is light or dark for contrast purposes
 */
function isLightColor(r: number, g: number, b: number): boolean {
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

// =============================================================================
// Shared Styles
// =============================================================================

const visualizerContainerStyle: JSX.CSSProperties = {
  "font-family": "var(--monaco-monospace-font)",
  "font-size": "12px",
  "line-height": "1.4",
  background: "var(--surface-sunken)",
  border: "1px solid var(--border-weak)",
  "border-radius": tokens.radius.sm,
  overflow: "hidden",
};

const visualizerHeaderStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  padding: "4px 8px",
  background: "var(--surface-raised)",
  "border-bottom": "1px solid var(--border-weak)",
  color: "var(--text-weak)",
  "font-size": "11px",
};

const iconButtonStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  width: "20px",
  height: "20px",
  border: "none",
  background: "transparent",
  color: "var(--text-weak)",
  cursor: "pointer",
  "border-radius": tokens.radius.sm,
};

// =============================================================================
// HexViewer Component
// =============================================================================

/**
 * HexViewer - Displays binary data in hex and ASCII format
 * Similar to hex editors, showing offset | hex bytes | ASCII representation
 */
export function HexViewer(props: HexViewerProps): JSX.Element {
  const bytesPerRow = () => props.bytesPerRow ?? 16;
  const [collapsed, setCollapsed] = createSignal(props.data.length > 256);

  const rows = createMemo(() => {
    const data = props.data;
    const bpr = bytesPerRow();
    const result: Array<{ offset: number; bytes: number[]; ascii: string }> = [];
    
    for (let i = 0; i < data.length; i += bpr) {
      const rowBytes = data.slice(i, Math.min(i + bpr, data.length));
      const ascii = rowBytes.map(byteToAscii).join("");
      result.push({ offset: i, bytes: rowBytes, ascii });
    }
    
    return result;
  });

  const displayRows = () => collapsed() ? rows().slice(0, 8) : rows();

  const copyHex = () => {
    const hexStr = props.data.map((b) => toHex(b)).join(" ");
    copyToClipboard(hexStr);
  };

  return (
    <div style={visualizerContainerStyle}>
      <div style={visualizerHeaderStyle}>
        <span>Hex View ({props.data.length} bytes)</span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            style={iconButtonStyle}
            onClick={copyHex}
            title="Copy as hex"
            class="hover:bg-[var(--surface-hover)]"
          >
            <Icon name="copy" size="sm" />
          </button>
        </div>
      </div>
      
      <div style={{ padding: "4px", "overflow-x": "auto" }}>
        <table style={{ "border-collapse": "collapse", width: "100%" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", "font-size": "10px" }}>
              <th style={{ "text-align": "left", padding: "2px 8px 2px 4px", "border-bottom": "1px solid var(--border-weak)" }}>
                Offset
              </th>
              <th style={{ "text-align": "left", padding: "2px 8px", "border-bottom": "1px solid var(--border-weak)" }}>
                Hex
              </th>
              <th style={{ "text-align": "left", padding: "2px 4px 2px 8px", "border-bottom": "1px solid var(--border-weak)" }}>
                ASCII
              </th>
            </tr>
          </thead>
          <tbody>
            <For each={displayRows()}>
              {(row) => (
                <tr class="hover:bg-[var(--surface-hover)]">
                  <td style={{ 
                    padding: "1px 8px 1px 4px", 
                    color: "var(--debug-token-expression-name)",
                    "white-space": "nowrap"
                  }}>
                    {toHex(row.offset, 8)}
                  </td>
                  <td style={{ 
                    padding: "1px 8px", 
                    color: "var(--debug-token-expression-number)",
                    "white-space": "nowrap",
                    "font-family": "var(--monaco-monospace-font)"
                  }}>
                    {row.bytes.map((b) => toHex(b)).join(" ")}
                    {/* Pad with spaces if row is incomplete */}
                    {row.bytes.length < bytesPerRow() && 
                      "   ".repeat(bytesPerRow() - row.bytes.length)}
                  </td>
                  <td style={{ 
                    padding: "1px 4px 1px 8px", 
                    color: "var(--debug-token-expression-string)",
                    "white-space": "pre",
                    "font-family": "var(--monaco-monospace-font)",
                    "border-left": "1px solid var(--border-weak)"
                  }}>
                    {row.ascii}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        
        <Show when={rows().length > 8}>
          <button
            class="w-full text-center py-1 text-xs cursor-pointer hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--accent-primary)", border: "none", background: "transparent" }}
            onClick={() => setCollapsed(!collapsed())}
          >
            {collapsed() ? `Show all (${rows().length} rows)` : "Collapse"}
          </button>
        </Show>
      </div>
    </div>
  );
}

// =============================================================================
// ImagePreview Component
// =============================================================================

/**
 * ImagePreview - Displays image data URLs or base64 encoded images
 */
export function ImagePreview(props: ImagePreviewProps): JSX.Element {
  const [error, setError] = createSignal(false);
  const [dimensions, setDimensions] = createSignal<{ width: number; height: number } | null>(null);
  const [expanded, setExpanded] = createSignal(false);

  const maxWidth = () => props.maxWidth ?? 200;
  const maxHeight = () => props.maxHeight ?? 150;

  const handleLoad = (e: Event) => {
    const img = e.target as HTMLImageElement;
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const openInNewTab = () => {
    window.open(props.dataUrl, "_blank");
  };

  return (
    <div style={visualizerContainerStyle}>
      <div style={visualizerHeaderStyle}>
        <span>
          Image Preview
          <Show when={dimensions()}>
            {" "}({dimensions()!.width} x {dimensions()!.height})
          </Show>
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            style={iconButtonStyle}
            onClick={() => setExpanded(!expanded())}
            title={expanded() ? "Collapse" : "Expand"}
            class="hover:bg-[var(--surface-hover)]"
          >
            <Icon name="expand" size="sm" />
          </button>
          <button
            style={iconButtonStyle}
            onClick={openInNewTab}
            title="Open in new tab"
            class="hover:bg-[var(--surface-hover)]"
          >
            <Icon name="arrow-up-right-from-square" size="sm" />
          </button>
        </div>
      </div>
      
      <div style={{ 
        padding: "8px", 
        display: "flex", 
        "align-items": "center", 
        "justify-content": "center",
        background: "repeating-conic-gradient(var(--surface-raised) 0% 25%, transparent 0% 50%) 50% / 16px 16px"
      }}>
        <Show
          when={!error()}
          fallback={
            <div style={{ color: "var(--status-error)", padding: "16px" }}>
              Failed to load image
            </div>
          }
        >
          <img
            src={props.dataUrl}
            alt="Preview"
            style={{
              "max-width": expanded() ? "100%" : `${maxWidth()}px`,
              "max-height": expanded() ? "400px" : `${maxHeight()}px`,
              "object-fit": "contain",
              "border-radius": tokens.radius.sm,
            }}
            onLoad={handleLoad}
            onError={() => setError(true)}
          />
        </Show>
      </div>
    </div>
  );
}

// =============================================================================
// JsonTreeView Component
// =============================================================================

interface JsonNodeProps {
  name: string;
  value: unknown;
  depth: number;
  expandLevel: number;
}

function JsonNode(props: JsonNodeProps): JSX.Element {
  const isExpandable = () => {
    const val = props.value;
    return val !== null && typeof val === "object";
  };

  const [expanded, setExpanded] = createSignal(props.depth < props.expandLevel);

  const getValueDisplay = (): { text: string; color: string } => {
    const val = props.value;
    
    if (val === null) return { text: "null", color: "var(--debug-token-expression-value)" };
    if (val === undefined) return { text: "undefined", color: "var(--debug-token-expression-value)" };
    
    switch (typeof val) {
      case "string":
        return { text: `"${val}"`, color: "var(--debug-token-expression-string)" };
      case "number":
        return { text: String(val), color: "var(--debug-token-expression-number)" };
      case "boolean":
        return { text: String(val), color: "var(--debug-token-expression-boolean)" };
      case "object":
        if (Array.isArray(val)) {
          return { text: `Array(${val.length})`, color: "var(--text-weak)" };
        }
        return { text: `Object`, color: "var(--text-weak)" };
      default:
        return { text: String(val), color: "var(--text-base)" };
    }
  };

  const entries = createMemo(() => {
    const val = props.value;
    if (val === null || typeof val !== "object") return [];
    return Object.entries(val as object);
  });

  const indent = () => props.depth * 12;

  return (
    <div>
      <div
        class="flex items-center cursor-pointer hover:bg-[var(--surface-hover)]"
        style={{ "padding-left": `${indent()}px`, height: "20px" }}
        onClick={() => isExpandable() && setExpanded(!expanded())}
      >
        <Show when={isExpandable()} fallback={<div class="w-4" />}>
          <div class="w-4 h-4 flex items-center justify-center" style={{ color: "var(--text-weak)" }}>
            {expanded() ? <Icon name="chevron-down" size="xs" /> : <Icon name="chevron-right" size="xs" />}
          </div>
        </Show>
        
        <span style={{ color: "var(--debug-token-expression-name)" }}>{props.name}</span>
        <span style={{ color: "var(--text-weak)", margin: "0 4px" }}>:</span>
        <span style={{ color: getValueDisplay().color }}>{getValueDisplay().text}</span>
      </div>
      
      <Show when={expanded() && isExpandable()}>
        <For each={entries()}>
          {([key, value]) => (
            <JsonNode
              name={key}
              value={value}
              depth={props.depth + 1}
              expandLevel={props.expandLevel}
            />
          )}
        </For>
      </Show>
    </div>
  );
}

/**
 * JsonTreeView - Displays complex objects as a collapsible tree
 */
export function JsonTreeView(props: JsonTreeViewProps): JSX.Element {
  const expandLevel = () => props.expandLevel ?? 2;

  const copyJson = () => {
    try {
      const json = JSON.stringify(props.data, null, 2);
      copyToClipboard(json);
    } catch {
      // Handle circular references
      copyToClipboard("[Circular or non-serializable object]");
    }
  };

  return (
    <div style={visualizerContainerStyle}>
      <div style={visualizerHeaderStyle}>
        <span>JSON Tree</span>
        <button
          style={iconButtonStyle}
          onClick={copyJson}
          title="Copy as JSON"
          class="hover:bg-[var(--surface-hover)]"
        >
          <Icon name="copy" size="sm" />
        </button>
      </div>
      
      <div style={{ padding: "4px 0", "max-height": "300px", "overflow-y": "auto" }}>
        <JsonNode
          name="root"
          value={props.data}
          depth={0}
          expandLevel={expandLevel()}
        />
      </div>
    </div>
  );
}

// =============================================================================
// ArrayVisualizer Component
// =============================================================================

/**
 * ArrayVisualizer - Displays large arrays with pagination
 */
export function ArrayVisualizer(props: ArrayVisualizerProps): JSX.Element {
  const pageSize = () => props.pageSize ?? 50;
  const [page, setPage] = createSignal(0);

  const totalPages = () => Math.ceil(props.items.length / pageSize());
  const currentItems = () => props.items.slice(page() * pageSize(), (page() + 1) * pageSize());
  const startIndex = () => page() * pageSize();

  const formatValue = (val: unknown): { text: string; color: string } => {
    if (val === null) return { text: "null", color: "var(--debug-token-expression-value)" };
    if (val === undefined) return { text: "undefined", color: "var(--debug-token-expression-value)" };
    
    switch (typeof val) {
      case "string":
        const truncated = val.length > 50 ? val.slice(0, 47) + "..." : val;
        return { text: `"${truncated}"`, color: "var(--debug-token-expression-string)" };
      case "number":
        return { text: String(val), color: "var(--debug-token-expression-number)" };
      case "boolean":
        return { text: String(val), color: "var(--debug-token-expression-boolean)" };
      case "object":
        if (Array.isArray(val)) return { text: `Array(${val.length})`, color: "var(--text-weak)" };
        return { text: "{...}", color: "var(--text-weak)" };
      default:
        return { text: String(val), color: "var(--text-base)" };
    }
  };

  return (
    <div style={visualizerContainerStyle}>
      <div style={visualizerHeaderStyle}>
        <span>Array ({props.items.length} items)</span>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Show when={totalPages() > 1}>
            <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
              <button
                style={{ 
                  ...iconButtonStyle, 
                  opacity: page() === 0 ? 0.5 : 1,
                  cursor: page() === 0 ? "not-allowed" : "pointer"
                }}
                onClick={() => page() > 0 && setPage(page() - 1)}
                disabled={page() === 0}
                class="hover:bg-[var(--surface-hover)]"
              >
                &lt;
              </button>
              <span style={{ "font-size": "10px" }}>
                {page() + 1} / {totalPages()}
              </span>
              <button
                style={{ 
                  ...iconButtonStyle, 
                  opacity: page() >= totalPages() - 1 ? 0.5 : 1,
                  cursor: page() >= totalPages() - 1 ? "not-allowed" : "pointer"
                }}
                onClick={() => page() < totalPages() - 1 && setPage(page() + 1)}
                disabled={page() >= totalPages() - 1}
                class="hover:bg-[var(--surface-hover)]"
              >
                &gt;
              </button>
            </div>
          </Show>
        </div>
      </div>
      
      <div style={{ "max-height": "250px", "overflow-y": "auto" }}>
        <For each={currentItems()}>
          {(item, index) => {
            const display = formatValue(item);
            return (
              <div
                class="flex hover:bg-[var(--surface-hover)]"
                style={{ padding: "2px 8px", "font-size": "11px" }}
              >
                <span style={{ 
                  color: "var(--text-muted)", 
                  "min-width": "48px",
                  "text-align": "right",
                  "margin-right": "8px"
                }}>
                  [{startIndex() + index()}]
                </span>
                <span style={{ color: display.color, flex: 1, "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                  {display.text}
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

// =============================================================================
// DateTimeVisualizer Component
// =============================================================================

/**
 * DateTimeVisualizer - Displays Date objects in multiple formats
 */
export function DateTimeVisualizer(props: DateTimeVisualizerProps): JSX.Element {
  const date = createMemo(() => new Date(props.timestamp));
  
  const formats = createMemo(() => {
    const d = date();
    return [
      { label: "ISO 8601", value: d.toISOString() },
      { label: "Local", value: d.toLocaleString() },
      { label: "UTC", value: d.toUTCString() },
      { label: "Unix (ms)", value: String(props.timestamp) },
      { label: "Unix (s)", value: String(Math.floor(props.timestamp / 1000)) },
      { label: "Relative", value: formatRelativeTime(d) },
    ];
  });

  const copyValue = (value: string) => copyToClipboard(value);

  return (
    <div style={visualizerContainerStyle}>
      <div style={visualizerHeaderStyle}>
        <span>Date/Time</span>
      </div>
      
      <div style={{ padding: "4px 8px" }}>
        <For each={formats()}>
          {(format) => (
            <div 
              class="flex items-center justify-between py-1 hover:bg-[var(--surface-hover)] cursor-pointer group"
              style={{ "border-radius": tokens.radius.sm, padding: "2px 4px" }}
              onClick={() => copyValue(format.value)}
              title="Click to copy"
            >
              <span style={{ color: "var(--text-muted)", "font-size": "10px", "min-width": "70px" }}>
                {format.label}:
              </span>
              <span style={{ 
                color: "var(--debug-token-expression-string)", 
                flex: 1, 
                "text-align": "right",
                "font-size": "11px"
              }}>
                {format.value}
              </span>
              <Icon name="copy" size="xs" class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-weak)" }} />
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// =============================================================================
// ColorVisualizer Component
// =============================================================================

/**
 * ColorVisualizer - Displays color values with a swatch and various formats
 */
export function ColorVisualizer(props: ColorVisualizerProps): JSX.Element {
  const parsedColor = createMemo(() => parseColor(props.color));
  
  const colorFormats = createMemo(() => {
    const pc = parsedColor();
    if (!pc) return [];
    
    const hex = `#${toHex(pc.r)}${toHex(pc.g)}${toHex(pc.b)}`;
    const rgb = pc.a !== undefined 
      ? `rgba(${pc.r}, ${pc.g}, ${pc.b}, ${pc.a.toFixed(2)})`
      : `rgb(${pc.r}, ${pc.g}, ${pc.b})`;
    
    // Calculate HSL
    const r = pc.r / 255;
    const g = pc.g / 255;
    const b = pc.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    const hsl = pc.a !== undefined
      ? `hsla(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${pc.a.toFixed(2)})`
      : `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    
    return [
      { label: "HEX", value: hex },
      { label: "RGB", value: rgb },
      { label: "HSL", value: hsl },
      { label: "Original", value: props.color },
    ];
  });

  const copyValue = (value: string) => copyToClipboard(value);

  const swatchStyle = createMemo((): JSX.CSSProperties => {
    const pc = parsedColor();
    if (!pc) return { background: "var(--cortex-text-inactive)" };
    
    const bgColor = pc.a !== undefined
      ? `rgba(${pc.r}, ${pc.g}, ${pc.b}, ${pc.a})`
      : `rgb(${pc.r}, ${pc.g}, ${pc.b})`;
    
    return {
      background: bgColor,
      width: "100%",
      height: "40px",
      "border-radius": tokens.radius.sm,
      border: "1px solid var(--border-weak)",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      color: pc && isLightColor(pc.r, pc.g, pc.b) ? "#000" : "#fff",
      "font-size": "11px",
      "font-weight": "500",
    };
  });

  return (
    <div style={visualizerContainerStyle}>
      <div style={visualizerHeaderStyle}>
        <span>Color</span>
      </div>
      
      <div style={{ padding: "8px" }}>
        <Show
          when={parsedColor()}
          fallback={
            <div style={{ color: "var(--status-error)", "font-size": "11px" }}>
              Invalid color value: {props.color}
            </div>
          }
        >
          {/* Color swatch with checkerboard background for alpha */}
          <div style={{ 
            background: "repeating-conic-gradient(var(--surface-raised) 0% 25%, #fff 0% 50%) 50% / 8px 8px",
            "border-radius": tokens.radius.sm,
            "margin-bottom": "8px"
          }}>
            <div style={swatchStyle()}>
              {colorFormats()[0]?.value}
            </div>
          </div>
          
          {/* Color formats */}
          <For each={colorFormats()}>
            {(format) => (
              <div 
                class="flex items-center justify-between py-1 hover:bg-[var(--surface-hover)] cursor-pointer group"
                style={{ "border-radius": tokens.radius.sm, padding: "2px 4px" }}
                onClick={() => copyValue(format.value)}
                title="Click to copy"
              >
                <span style={{ color: "var(--text-muted)", "font-size": "10px", "min-width": "50px" }}>
                  {format.label}:
                </span>
                <span style={{ 
                  color: "var(--debug-token-expression-string)", 
                  flex: 1, 
                  "text-align": "right",
                  "font-size": "11px",
                  "font-family": "var(--monaco-monospace-font)"
                }}>
                  {format.value}
                </span>
                <Icon name="copy" size="xs" class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-weak)" }} />
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

// =============================================================================
// UrlVisualizer Component
// =============================================================================

/**
 * UrlVisualizer - Displays and parses URL strings
 */
export function UrlVisualizer(props: UrlVisualizerProps): JSX.Element {
  const parsedUrl = createMemo(() => {
    try {
      return new URL(props.url);
    } catch {
      return null;
    }
  });

  const urlParts = createMemo(() => {
    const url = parsedUrl();
    if (!url) return [];
    
    const parts = [
      { label: "Protocol", value: url.protocol },
      { label: "Host", value: url.host },
      { label: "Hostname", value: url.hostname },
    ];
    
    if (url.port) parts.push({ label: "Port", value: url.port });
    if (url.pathname && url.pathname !== "/") parts.push({ label: "Path", value: url.pathname });
    if (url.search) parts.push({ label: "Query", value: url.search });
    if (url.hash) parts.push({ label: "Hash", value: url.hash });
    if (url.username) parts.push({ label: "Username", value: url.username });
    
    return parts;
  });

  const searchParams = createMemo(() => {
    const url = parsedUrl();
    if (!url) return [];
    return Array.from(url.searchParams.entries());
  });

  const copyValue = (value: string) => copyToClipboard(value);

  const openUrl = () => {
    window.open(props.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={visualizerContainerStyle}>
      <div style={visualizerHeaderStyle}>
        <span>URL</span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            style={iconButtonStyle}
            onClick={() => copyValue(props.url)}
            title="Copy URL"
            class="hover:bg-[var(--surface-hover)]"
          >
            <Icon name="copy" size="sm" />
          </button>
          <Show when={parsedUrl()}>
            <button
              style={iconButtonStyle}
              onClick={openUrl}
              title="Open in browser"
              class="hover:bg-[var(--surface-hover)]"
            >
              <Icon name="arrow-up-right-from-square" size="sm" />
            </button>
          </Show>
        </div>
      </div>
      
      <div style={{ padding: "4px 8px" }}>
        <Show
          when={parsedUrl()}
          fallback={
            <div style={{ color: "var(--status-error)", "font-size": "11px", padding: "4px" }}>
              Invalid URL: {props.url}
            </div>
          }
        >
          {/* Full URL */}
          <div 
            class="mb-2 p-2 cursor-pointer hover:bg-[var(--surface-hover)]"
            style={{ 
              background: "var(--surface-raised)",
              "border-radius": tokens.radius.sm,
              "font-size": "11px",
              "word-break": "break-all",
              color: "var(--accent-primary)"
            }}
            onClick={() => copyValue(props.url)}
            title="Click to copy"
          >
            {props.url}
          </div>
          
          {/* URL parts */}
          <For each={urlParts()}>
            {(part) => (
              <div 
                class="flex items-center justify-between py-1 hover:bg-[var(--surface-hover)] cursor-pointer"
                style={{ "border-radius": tokens.radius.sm, padding: "2px 4px" }}
                onClick={() => copyValue(part.value)}
                title="Click to copy"
              >
                <span style={{ color: "var(--text-muted)", "font-size": "10px", "min-width": "70px" }}>
                  {part.label}:
                </span>
                <span style={{ 
                  color: "var(--debug-token-expression-string)", 
                  flex: 1, 
                  "text-align": "right",
                  "font-size": "11px",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "white-space": "nowrap"
                }}>
                  {part.value}
                </span>
              </div>
            )}
          </For>
          
          {/* Query parameters */}
          <Show when={searchParams().length > 0}>
            <div style={{ 
              "margin-top": "8px", 
              "padding-top": "8px", 
              "border-top": "1px solid var(--border-weak)" 
            }}>
              <div style={{ color: "var(--text-muted)", "font-size": "10px", "margin-bottom": "4px" }}>
                Query Parameters:
              </div>
              <For each={searchParams()}>
                {([key, value]) => (
                  <div 
                    class="flex items-center py-1 hover:bg-[var(--surface-hover)] cursor-pointer"
                    style={{ "border-radius": tokens.radius.sm, padding: "2px 4px" }}
                    onClick={() => copyValue(`${key}=${value}`)}
                    title="Click to copy"
                  >
                    <span style={{ 
                      color: "var(--debug-token-expression-name)", 
                      "font-size": "11px",
                      "margin-right": "4px"
                    }}>
                      {key}
                    </span>
                    <span style={{ color: "var(--text-weak)" }}>=</span>
                    <span style={{ 
                      color: "var(--debug-token-expression-string)", 
                      flex: 1, 
                      "font-size": "11px",
                      "margin-left": "4px",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap"
                    }}>
                      {decodeURIComponent(value)}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}

// =============================================================================
// MapVisualizer Component
// =============================================================================

/**
 * MapVisualizer - Displays Map objects with key-value pairs
 */
export function MapVisualizer(props: MapVisualizerProps): JSX.Element {
  const pageSize = () => props.pageSize ?? 50;
  const [page, setPage] = createSignal(0);

  const totalPages = () => Math.ceil(props.entries.length / pageSize());
  const currentEntries = () => props.entries.slice(page() * pageSize(), (page() + 1) * pageSize());

  const formatValue = (val: unknown): { text: string; color: string } => {
    if (val === null) return { text: "null", color: "var(--debug-token-expression-value)" };
    if (val === undefined) return { text: "undefined", color: "var(--debug-token-expression-value)" };
    
    switch (typeof val) {
      case "string":
        const truncated = val.length > 30 ? val.slice(0, 27) + "..." : val;
        return { text: `"${truncated}"`, color: "var(--debug-token-expression-string)" };
      case "number":
        return { text: String(val), color: "var(--debug-token-expression-number)" };
      case "boolean":
        return { text: String(val), color: "var(--debug-token-expression-boolean)" };
      case "object":
        if (Array.isArray(val)) return { text: `Array(${val.length})`, color: "var(--text-weak)" };
        return { text: "{...}", color: "var(--text-weak)" };
      default:
        return { text: String(val), color: "var(--text-base)" };
    }
  };

  return (
    <div style={visualizerContainerStyle}>
      <div style={visualizerHeaderStyle}>
        <span>Map ({props.entries.length} entries)</span>
        <Show when={totalPages() > 1}>
          <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <button
              style={{ ...iconButtonStyle, opacity: page() === 0 ? 0.5 : 1 }}
              onClick={() => page() > 0 && setPage(page() - 1)}
              disabled={page() === 0}
              class="hover:bg-[var(--surface-hover)]"
            >
              &lt;
            </button>
            <span style={{ "font-size": "10px" }}>{page() + 1} / {totalPages()}</span>
            <button
              style={{ ...iconButtonStyle, opacity: page() >= totalPages() - 1 ? 0.5 : 1 }}
              onClick={() => page() < totalPages() - 1 && setPage(page() + 1)}
              disabled={page() >= totalPages() - 1}
              class="hover:bg-[var(--surface-hover)]"
            >
              &gt;
            </button>
          </div>
        </Show>
      </div>
      
      <div style={{ "max-height": "250px", "overflow-y": "auto" }}>
        <For each={currentEntries()}>
          {(entry) => {
            const keyDisplay = formatValue(entry.key);
            const valueDisplay = formatValue(entry.value);
            return (
              <div
                class="flex hover:bg-[var(--surface-hover)]"
                style={{ padding: "2px 8px", "font-size": "11px" }}
              >
                <span style={{ color: keyDisplay.color, "min-width": "80px", "margin-right": "4px" }}>
                  {keyDisplay.text}
                </span>
                <span style={{ color: "var(--text-weak)", "margin-right": "4px" }}>=&gt;</span>
                <span style={{ color: valueDisplay.color, flex: 1, overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                  {valueDisplay.text}
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

// =============================================================================
// SetVisualizer Component
// =============================================================================

/**
 * SetVisualizer - Displays Set objects
 */
export function SetVisualizer(props: SetVisualizerProps): JSX.Element {
  const pageSize = () => props.pageSize ?? 50;
  const [page, setPage] = createSignal(0);

  const totalPages = () => Math.ceil(props.values.length / pageSize());
  const currentValues = () => props.values.slice(page() * pageSize(), (page() + 1) * pageSize());

  const formatValue = (val: unknown): { text: string; color: string } => {
    if (val === null) return { text: "null", color: "var(--debug-token-expression-value)" };
    if (val === undefined) return { text: "undefined", color: "var(--debug-token-expression-value)" };
    
    switch (typeof val) {
      case "string":
        const truncated = val.length > 50 ? val.slice(0, 47) + "..." : val;
        return { text: `"${truncated}"`, color: "var(--debug-token-expression-string)" };
      case "number":
        return { text: String(val), color: "var(--debug-token-expression-number)" };
      case "boolean":
        return { text: String(val), color: "var(--debug-token-expression-boolean)" };
      case "object":
        if (Array.isArray(val)) return { text: `Array(${val.length})`, color: "var(--text-weak)" };
        return { text: "{...}", color: "var(--text-weak)" };
      default:
        return { text: String(val), color: "var(--text-base)" };
    }
  };

  return (
    <div style={visualizerContainerStyle}>
      <div style={visualizerHeaderStyle}>
        <span>Set ({props.values.length} values)</span>
        <Show when={totalPages() > 1}>
          <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <button
              style={{ ...iconButtonStyle, opacity: page() === 0 ? 0.5 : 1 }}
              onClick={() => page() > 0 && setPage(page() - 1)}
              disabled={page() === 0}
              class="hover:bg-[var(--surface-hover)]"
            >
              &lt;
            </button>
            <span style={{ "font-size": "10px" }}>{page() + 1} / {totalPages()}</span>
            <button
              style={{ ...iconButtonStyle, opacity: page() >= totalPages() - 1 ? 0.5 : 1 }}
              onClick={() => page() < totalPages() - 1 && setPage(page() + 1)}
              disabled={page() >= totalPages() - 1}
              class="hover:bg-[var(--surface-hover)]"
            >
              &gt;
            </button>
          </div>
        </Show>
      </div>
      
      <div style={{ "max-height": "250px", "overflow-y": "auto" }}>
        <For each={currentValues()}>
          {(value) => {
            const display = formatValue(value);
            return (
              <div
                class="flex hover:bg-[var(--surface-hover)]"
                style={{ padding: "2px 8px", "font-size": "11px" }}
              >
                <span style={{ color: display.color, flex: 1, overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                  {display.text}
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

// =============================================================================
// Visualizer Type Detection
// =============================================================================

export type VisualizerType = 
  | "hex"
  | "image"
  | "json"
  | "array"
  | "datetime"
  | "color"
  | "url"
  | "map"
  | "set"
  | "default";

/**
 * Checks if a string is a valid color value
 */
export function isColorValue(value: string): boolean {
  return parseColor(value) !== null;
}

/**
 * Checks if a string looks like a URL
 */
export function isUrlValue(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a string is a data URL for an image
 */
export function isImageDataUrl(value: string): boolean {
  return value.startsWith("data:image/");
}

/**
 * Detects the appropriate visualizer type for a variable
 */
export function detectVisualizerType(type: string | undefined, value: string): VisualizerType {
  const normalizedType = type?.toLowerCase() ?? "";
  
  // Check type field first
  if (normalizedType === "arraybuffer" || normalizedType === "uint8array" || normalizedType === "buffer") {
    return "hex";
  }
  
  if (normalizedType === "date") {
    return "datetime";
  }
  
  if (normalizedType === "map") {
    return "map";
  }
  
  if (normalizedType === "set") {
    return "set";
  }
  
  if (normalizedType === "array" || normalizedType.startsWith("array(") || normalizedType.match(/\[\d+\]/)) {
    return "array";
  }
  
  // Check value patterns
  if (isImageDataUrl(value)) {
    return "image";
  }
  
  if (isUrlValue(value)) {
    return "url";
  }
  
  if (isColorValue(value)) {
    return "color";
  }
  
  // Check if it looks like a complex object
  if (normalizedType === "object" || value.startsWith("{") || value.startsWith("[")) {
    return "json";
  }
  
  return "default";
}

// =============================================================================
// Visualizer Component Map
// =============================================================================

export const VisualizerComponents: Record<VisualizerType, Component<any> | null> = {
  hex: HexViewer,
  image: ImagePreview,
  json: JsonTreeView,
  array: ArrayVisualizer,
  datetime: DateTimeVisualizer,
  color: ColorVisualizer,
  url: UrlVisualizer,
  map: MapVisualizer,
  set: SetVisualizer,
  default: null,
};


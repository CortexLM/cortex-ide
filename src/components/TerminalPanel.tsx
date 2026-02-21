import { Show, createSignal, createEffect, onMount, onCleanup, createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import { useTerminals, TerminalInfo } from "@/context/TerminalsContext";
import { useEditor } from "@/context/EditorContext";
import { useSettings } from "@/context/SettingsContext";
import { useAccessibility } from "@/context/AccessibilityContext";
import { getTerminalTheme, getTerminalThemeFromCSS } from "@/lib/terminalThemes";
import { tokens } from '@/design-system/tokens';
import { Terminal as XTerm, IMarker, IDecoration } from "@xterm/xterm";
import type { ILinkProvider, ILink, IBufferRange } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";
import { loadStylesheet } from "@/utils/lazyStyles";
loadStylesheet("terminal");
import { TerminalSuggest, useTerminalSuggestions, Suggestion } from "./TerminalSuggest";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TerminalQuickFix as _TerminalQuickFix } from "./TerminalQuickFix";
import { 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TerminalStickyScroll as _TerminalStickyScroll, 
  useTerminalCommandTracker, 
  StickyScrollSettings,
  CommandTrackerResult
} from "./TerminalStickyScroll";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TerminalFind as _TerminalFind, getPersistedSearchQuery } from "./TerminalFind";
import {
  TerminalDecorations,
  useTerminalDecorations,
  type CommandDecoration,
  type DecorationAction,
} from "./terminal/TerminalDecorations";
import { TerminalRenameDialog } from "./terminal/TerminalRenameDialog";
import { TerminalColorPicker } from "./terminal/TerminalColorPicker";

/**
 * Command marker for tracking command execution status in the terminal gutter
 */
interface CommandMarker {
  /** Line number where the command starts */
  line: number;
  /** Current status of the command */
  status: 'running' | 'success' | 'error';
  /** Exit code (available when command completes) */
  exitCode?: number;
  /** The command that was executed */
  command?: string;
  /** Unix timestamp when command started */
  startTime?: number;
  /** Unix timestamp when command ended */
  endTime?: number;
  /** Xterm marker reference */
  marker?: IMarker;
  /** Xterm decoration reference */
  decoration?: IDecoration;
}

/**
 * State for managing command markers per terminal
 */
interface CommandMarkerState {
  markers: CommandMarker[];
  /** Currently running command marker (if any) */
  currentMarker?: CommandMarker;
}

/**
 * Terminal Panel - Optimized for performance
 * 
 * Performance optimizations:
 * - WebGL renderer for GPU-accelerated rendering (when available)
 * - Lazy loading of terminal addons
 * - Disabled accessibility for better performance
 * - Debounced window resize handling
 * - Proper memory cleanup on terminal disposal
 * - Limited scrollback buffer (10000 lines)
 * - Chunked output processing
 */

const DEFAULT_PANEL_HEIGHT = 280;

// Performance constants
const SCROLLBACK_LINES = 10000;
const WINDOW_RESIZE_DEBOUNCE_MS = 150;
const OUTPUT_CHUNK_SIZE = 16384; // 16KB chunks for better throughput with large outputs
const OUTPUT_FLUSH_DEBOUNCE_MS = 8; // Faster flush for responsiveness
const ACK_BATCH_SIZE = 32768; // Batch acknowledgments to reduce IPC overhead

// WebGL addon loaded dynamically
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let webglAddonModule: { WebglAddon: new () => any } | null = null;
let webglLoadAttempted = false;

const loadWebglAddon = async (): Promise<boolean> => {
  if (webglLoadAttempted) return webglAddonModule !== null;
  webglLoadAttempted = true;
  try {
    // Dynamic import - module may not be installed
    const modulePath = "@xterm/addon-webgl";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webglAddonModule = await (import(/* @vite-ignore */ modulePath) as Promise<any>);
    return true;
  } catch {
    console.warn("[Terminal] WebGL addon not available, using canvas renderer");
    return false;
  }
};

// Shell type detection for icons
type ShellType = "powershell" | "bash" | "zsh" | "cmd" | "fish" | "sh" | "unknown";

interface TerminalInstance {
  terminal: XTerm;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  webglAddon: unknown | null;
  unsubscribe: () => void;
  outputBuffer: string[];
  /** Command markers state for gutter decorations */
  commandMarkers: CommandMarkerState;
  /** Scroll event handler for cleanup */
  scrollHandler?: (() => void) | null;
  /** Viewport element reference for cleanup */
  viewportElement?: HTMLElement | null;
  /** ResizeObserver for auto-fitting terminal on container resize */
  resizeObserver?: ResizeObserver | null;
  /** Container element reference for cleanup */
  containerElement?: HTMLElement | null;
  /** Decorations state manager for command status indicators */
  decorations?: ReturnType<typeof useTerminalDecorations>;
  /** Current running decoration ID */
  currentDecorationId?: string | null;
}

// Context menu state
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  terminalId: string | null;
}

// Shell profile for dropdown
interface ShellProfile {
  name: string;
  shell: string;
  icon: ShellType;
  args?: string[];
}

/**
 * Safely format duration from start and end timestamps
 * Handles undefined/null values gracefully for robust Tauri integration
 * @param startTime - Start timestamp (ms)
 * @param endTime - End timestamp (ms)
 * @returns Formatted duration string or null if times are invalid
 */
function formatCommandDuration(startTime: number | undefined, endTime: number | undefined): string | null {
  if (startTime === undefined || endTime === undefined) return null;
  if (startTime <= 0 || endTime <= 0) return null;
  
  const duration = endTime - startTime;
  if (duration < 0) return null;
  
  if (duration < 1000) {
    return `${duration}ms`;
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(duration / 60000);
    const seconds = ((duration % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}



/**
 * Create debounced function for window resize handling
 */
function createDebouncedResize(
  callback: () => void,
  delay: number
): { call: () => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return {
    call: () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        callback();
        timeoutId = null;
      }, delay);
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };
}

/**
 * Output stream processor for chunked processing with debounced flushing
 * Optimized for high-throughput terminal output
 * 
 * Performance optimizations:
 * - Pre-allocated buffer array to reduce GC pressure
 * - Uses TextDecoder for efficient string handling of large data
 * - Batched acknowledgments to reduce IPC overhead
 */
class OutputStreamProcessor {
  private bufferChunks: string[] = [];
  private bufferLength = 0;
  private readonly chunkSize: number;
  private flushTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pendingCallback: ((chunk: string) => void) | null = null;
  private pendingAckBytes = 0;
  private ackCallback: ((bytes: number) => void) | null = null;

  constructor(chunkSize: number = OUTPUT_CHUNK_SIZE) {
    this.chunkSize = chunkSize;
  }

  /**
   * Set acknowledgment callback for flow control
   */
  setAckCallback(callback: (bytes: number) => void): void {
    this.ackCallback = callback;
  }

  /**
   * Process data in chunks with optimized string handling
   * Uses array-based buffer to avoid repeated string concatenation
   */
  processChunked(data: string, callback: (chunk: string) => void): void {
    this.bufferChunks.push(data);
    this.bufferLength += data.length;
    this.pendingCallback = callback;
    
    // Track bytes for batched acknowledgment
    this.pendingAckBytes += data.length;
    
    // Process full chunks immediately when buffer exceeds chunk size
    while (this.bufferLength >= this.chunkSize) {
      // Join all chunks and split at chunk size
      const fullBuffer = this.bufferChunks.join('');
      const chunk = fullBuffer.substring(0, this.chunkSize);
      const remainder = fullBuffer.substring(this.chunkSize);
      
      // Reset buffer with remainder
      this.bufferChunks = remainder.length > 0 ? [remainder] : [];
      this.bufferLength = remainder.length;
      
      callback(chunk);
    }
    
    // Batch acknowledgments to reduce IPC overhead
    if (this.pendingAckBytes >= ACK_BATCH_SIZE && this.ackCallback) {
      this.ackCallback(this.pendingAckBytes);
      this.pendingAckBytes = 0;
    }
    
    // Schedule debounced flush for remaining data
    if (this.bufferLength > 0 && !this.flushTimeoutId) {
      this.flushTimeoutId = setTimeout(() => {
        this.flushImmediate();
      }, OUTPUT_FLUSH_DEBOUNCE_MS);
    }
  }

  /**
   * Internal immediate flush without timeout handling
   */
  private flushImmediate(): void {
    if (this.bufferLength > 0 && this.pendingCallback) {
      const data = this.bufferChunks.join('');
      this.bufferChunks = [];
      this.bufferLength = 0;
      this.pendingCallback(data);
    }
    this.flushTimeoutId = null;
    
    // Flush any remaining ack bytes
    if (this.pendingAckBytes > 0 && this.ackCallback) {
      this.ackCallback(this.pendingAckBytes);
      this.pendingAckBytes = 0;
    }
  }

  /**
   * Force flush the buffer immediately
   */
  flush(callback: (chunk: string) => void): void {
    if (this.flushTimeoutId) {
      clearTimeout(this.flushTimeoutId);
      this.flushTimeoutId = null;
    }
    if (this.bufferLength > 0) {
      const data = this.bufferChunks.join('');
      this.bufferChunks = [];
      this.bufferLength = 0;
      callback(data);
    }
    
    // Flush any remaining ack bytes
    if (this.pendingAckBytes > 0 && this.ackCallback) {
      this.ackCallback(this.pendingAckBytes);
      this.pendingAckBytes = 0;
    }
  }

  /**
   * Cancel any pending flush timeout and clear buffers
   */
  cancel(): void {
    if (this.flushTimeoutId) {
      clearTimeout(this.flushTimeoutId);
      this.flushTimeoutId = null;
    }
    this.bufferChunks = [];
    this.bufferLength = 0;
    this.pendingCallback = null;
    this.pendingAckBytes = 0;
  }

  /**
   * Dispose and release all resources to prevent memory leaks
   * Should be called when the terminal is being destroyed
   */
  dispose(): void {
    this.cancel();
    // Clear callbacks to prevent memory leaks from closures holding references
    this.ackCallback = null;
    this.pendingCallback = null;
  }

  /**
   * Check if the processor has been disposed
   */
  isDisposed(): boolean {
    return this.ackCallback === null && this.pendingCallback === null && this.bufferChunks.length === 0;
  }
}

/**
 * File path link provider for terminal
 * Detects local file paths in terminal output and makes them clickable
 */
class FilePathLinkProvider implements ILinkProvider {
  private terminal: XTerm;
  private onOpenFile: (path: string, line?: number, column?: number) => void;
  private hoverTooltip: HTMLDivElement | null = null;

  constructor(
    terminal: XTerm,
    onOpenFile: (path: string, line?: number, column?: number) => void
  ) {
    this.terminal = terminal;
    this.onOpenFile = onOpenFile;
  }

  provideLinks(
    bufferLineNumber: number,
    callback: (links: ILink[] | undefined) => void
  ): void {
    const buffer = this.terminal.buffer.active;
    const line = buffer.getLine(bufferLineNumber);
    if (!line) {
      callback(undefined);
      return;
    }

    const lineText = line.translateToString();
    if (!lineText || lineText.trim().length === 0) {
      callback(undefined);
      return;
    }

    const links: ILink[] = [];

    // Regex patterns for file paths with optional line:column
    const patterns = [
      // Unix absolute paths: /path/to/file.ts:10:5 or /path/to/file.ts(10,5)
      /(?<path>\/(?:[\w\-.]|\/)+\.[\w]+)(?::(?<line>\d+)(?::(?<col>\d+))?|\((?<pline>\d+)(?:,(?<pcol>\d+))?\))?/g,
      // Windows paths: C:\path\to\file.ts:10:5 or C:\path\to\file.ts(10,5)
      /(?<path>[A-Za-z]:\\(?:[\w\-.]|\\)+\.[\w]+)(?::(?<line>\d+)(?::(?<col>\d+))?|\((?<pline>\d+)(?:,(?<pcol>\d+))?\))?/g,
      // Relative paths: ./src/file.ts:10 or ../file.ts:10:5
      /(?<path>\.\.?\/(?:[\w\-.]|\/)+\.[\w]+)(?::(?<line>\d+)(?::(?<col>\d+))?|\((?<pline>\d+)(?:,(?<pcol>\d+))?\))?/g,
    ];

    for (const pattern of patterns) {
      // Reset lastIndex for each pattern
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(lineText)) !== null) {
        const matchText = match[0];
        const groups = match.groups;
        if (!groups?.path) continue;

        const filePath = groups.path;
        // Support both :line:col and (line,col) formats
        const lineNum = groups.line || groups.pline;
        const colNum = groups.col || groups.pcol;

        const startX = match.index + 1; // 1-based
        const endX = match.index + matchText.length + 1; // 1-based, exclusive

        const range: IBufferRange = {
          start: { x: startX, y: bufferLineNumber + 1 }, // 1-based line number
          end: { x: endX, y: bufferLineNumber + 1 },
        };

        links.push({
          range,
          text: matchText,
          activate: (_event: MouseEvent, _text: string) => {
            this.onOpenFile(
              filePath,
              lineNum ? parseInt(lineNum, 10) : undefined,
              colNum ? parseInt(colNum, 10) : undefined
            );
          },
          hover: (event: MouseEvent, _text: string) => {
            this.showHoverTooltip(event, filePath, lineNum, colNum);
          },
          leave: (_event: MouseEvent, _text: string) => {
            this.hideHoverTooltip();
          },
          dispose: () => {
            this.hideHoverTooltip();
          },
        });
      }
    }

    callback(links.length > 0 ? links : undefined);
  }

  private showHoverTooltip(
    event: MouseEvent,
    filePath: string,
    line?: string,
    column?: string
  ): void {
    this.hideHoverTooltip();

    const tooltip = document.createElement("div");
    tooltip.className = "xterm-hover terminal-file-link-tooltip";
    tooltip.style.cssText = `
      position: fixed;
      z-index: 1000;
      padding: ${tokens.spacing.sm} ${tokens.spacing.md};
      background: var(--jb-popup);
      border: 1px solid ${tokens.colors.border.divider};
      border-radius: ${tokens.radius.sm};
      font-size: var(--jb-text-muted-size);
      color: ${tokens.colors.text.primary};
      pointer-events: none;
      white-space: nowrap;
      box-shadow: var(--jb-shadow-popup);
    `;

    let tooltipText = "Click to open file";
    if (line) {
      tooltipText += ` at line ${line}`;
      if (column) {
        tooltipText += `:${column}`;
      }
    }

    // Show file path in tooltip as well
    const pathSpan = document.createElement("div");
    pathSpan.style.cssText = `
      font-size: var(--jb-text-header-size);
      color: ${tokens.colors.text.muted};
      margin-top: 2px;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    pathSpan.textContent = filePath;

    const actionSpan = document.createElement("div");
    actionSpan.textContent = tooltipText;

    tooltip.appendChild(actionSpan);
    tooltip.appendChild(pathSpan);

    // Position tooltip near the cursor
    const x = event.clientX + 10;
    const y = event.clientY + 10;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;

    // Add to terminal element to prevent mouse events from falling through
    const terminalElement = this.terminal.element;
    if (terminalElement) {
      terminalElement.appendChild(tooltip);
      this.hoverTooltip = tooltip;

      // Adjust position if tooltip goes off screen
      requestAnimationFrame(() => {
        const rect = tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          tooltip.style.left = `${event.clientX - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
          tooltip.style.top = `${event.clientY - rect.height - 10}px`;
        }
      });
    }
  }

  private hideHoverTooltip(): void {
    if (this.hoverTooltip) {
      this.hoverTooltip.remove();
      this.hoverTooltip = null;
    }
  }
}

export function TerminalPanel() {
  const { 
    state, 
    writeToTerminal,
    updateTerminalInfo,
    resizeTerminal,
    subscribeToOutput,
    renameTerminal,
    setTerminalColor,
    getTerminalName,
    getTerminalColor,
  } = useTerminals();
  
  // Editor context for opening files from terminal links
  const editor = useEditor();
  
  // Settings context for terminal appearance
  const settings = useSettings();
  const terminalSettings = () => settings.effectiveSettings().terminal;
  
  // Accessibility context for screen reader announcements
  const accessibility = useAccessibility();
  
  // ARIA live region reference for terminal announcements
  let ariaLiveRegion: HTMLDivElement | undefined;
  
  const [panelHeight] = createSignal(DEFAULT_PANEL_HEIGHT);
  const [isFocused] = createSignal(false);
  const [editingTabId] = createSignal<string | null>(null);
  const [showNewTerminalDropdown, setShowNewTerminalDropdown] = createSignal(false);
  const [_shellProfiles, setShellProfiles] = createSignal<ShellProfile[]>([]);
  const [tabOrder, setTabOrder] = createSignal<string[]>([]);
  
  // Context menu state
  const [contextMenu, setContextMenu] = createStore<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    terminalId: null,
  });

  // Custom terminal names
  const [_terminalNames] = createStore<Record<string, string>>({});
  
  // Terminal suggestions integration
  const suggestions = useTerminalSuggestions({ enabled: true, debounceMs: 50 });
  const [inputBuffer, setInputBuffer] = createStore<Record<string, string>>({});
  
  // Terminal quick fix integration for error detection
  const [_terminalOutputs, setTerminalOutputs] = createStore<Record<string, string>>({});
  const [quickFixEnabled] = createSignal(true);
  
  // Scroll lock state - when locked, don't auto-scroll on new output
  const [scrollLocked, setScrollLocked] = createSignal(false);
  
  // Find widget visibility state
  const [showFindWidget, setShowFindWidget] = createSignal(false);
  
  // Rename and color picker dialog state
  const [showRenameDialog, setShowRenameDialog] = createSignal(false);
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const [dialogTerminalId, setDialogTerminalId] = createSignal<string | null>(null);
  
  // Sticky scroll state - tracks commands per terminal for sticky headers
  const [stickyScrollSettings] = createStore<StickyScrollSettings>({
    enabled: true,
    maxCommands: 5,
  });
  const [_terminalScrollLines, setTerminalScrollLines] = createStore<Record<string, number>>({});
  const [_terminalTotalLines, setTerminalTotalLines] = createStore<Record<string, number>>({});
  const stickyScrollTrackers = new Map<string, CommandTrackerResult>();
  
  // Output stream processors per terminal
  const outputProcessors = new Map<string, OutputStreamProcessor>();
  
  // Terminal decorations state per terminal
  const terminalDecorations = new Map<string, ReturnType<typeof useTerminalDecorations>>();
  
  // Decoration settings accessor
  const decorationSettings = () => {
    const ts = terminalSettings();
    return ts.decorations ?? { enabled: true, showDuration: true, showExitCode: true };
  };
  
  // Embedded mode - renders into bottom panel instead of floating
  const [isEmbedded, setIsEmbedded] = createSignal(false);
  
  let terminalContainerRef: HTMLDivElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;
  let editInputRef: HTMLInputElement | undefined;
  let windowResizeDebouncer: ReturnType<typeof createDebouncedResize> | null = null;

  // Map of terminal instances keyed by terminal ID
  const terminalInstances = new Map<string, TerminalInstance>();

  const activeTerminal = createMemo(() => 
    state.terminals.find(t => t.id === state.activeTerminalId)
  );

  /**
   * Announce a message to screen readers via ARIA live region
   * Only announces if screen reader announcements are enabled in terminal settings
   */
  const announceToScreenReader = (message: string, assertive: boolean = false) => {
    const ts = terminalSettings();
    if (!ts.screenReaderAnnounce) return;
    
    // Use global accessibility context announcement if screen reader mode is on
    if (accessibility.screenReaderMode()) {
      accessibility.announceToScreenReader(message, assertive ? "assertive" : "polite");
      return;
    }
    
    // Fall back to local ARIA live region
    if (ariaLiveRegion) {
      ariaLiveRegion.setAttribute("aria-live", assertive ? "assertive" : "polite");
      ariaLiveRegion.textContent = "";
      requestAnimationFrame(() => {
        if (ariaLiveRegion) {
          ariaLiveRegion.textContent = message;
        }
      });
    }
  };

  // Update cursor position for suggestions dropdown
  const updateCursorPosition = (terminalId: string) => {
    const instance = terminalInstances.get(terminalId);
    if (!instance || !terminalContainerRef) return;
    
    const terminal = instance.terminal;
    const cursorX = terminal.buffer.active.cursorX;
    const cursorY = terminal.buffer.active.cursorY;
    
    // Get terminal container position
    const container = terminalContainerRef.querySelector(`[data-terminal-id="${terminalId}"]`) as HTMLElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const cellWidth = terminal.options.fontSize ? terminal.options.fontSize * 0.6 : 8;
    const cellHeight = terminal.options.fontSize ? terminal.options.fontSize * 1.2 : 16;
    
    const x = rect.left + cursorX * cellWidth + 8;
    const y = rect.top + cursorY * cellHeight + 8;
    
    suggestions.setCursorPosition({ x, y });
  };

  // Handle suggestion selection - write to terminal
  const handleSuggestionSelect = (suggestion: Suggestion) => {
    const active = activeTerminal();
    if (!active) return;
    
    const currentBuffer = inputBuffer[active.id] || "";
    const insertText = suggestion.insertText || suggestion.text;
    
    let deleteCount = 0;
    let textToInsert = "";
    
    if (suggestion.type === "history") {
      deleteCount = currentBuffer.length;
      textToInsert = insertText;
    } else if (suggestion.type === "arg" || suggestion.type === "file" || suggestion.type === "directory") {
      const parts = currentBuffer.split(/\s+/);
      const lastArg = parts[parts.length - 1] || "";
      deleteCount = lastArg.length;
      textToInsert = insertText;
    } else if (suggestion.type === "git" && insertText.startsWith("git ")) {
      deleteCount = currentBuffer.length;
      textToInsert = insertText;
    } else if (currentBuffer.includes(" ")) {
      const lastSpaceIdx = currentBuffer.lastIndexOf(" ");
      const lastArg = currentBuffer.slice(lastSpaceIdx + 1);
      deleteCount = lastArg.length;
      textToInsert = insertText;
    } else {
      deleteCount = currentBuffer.length;
      textToInsert = insertText;
    }
    
    const backspaces = "\b".repeat(deleteCount);
    const clearChars = " ".repeat(deleteCount);
    const backspaces2 = "\b".repeat(deleteCount);
    
    writeToTerminal(active.id, backspaces + clearChars + backspaces2 + textToInsert).catch(console.error);
    
    let newBuffer: string;
    if (suggestion.type === "history" || (suggestion.type === "git" && insertText.startsWith("git "))) {
      newBuffer = insertText;
    } else if (currentBuffer.includes(" ")) {
      const lastSpaceIdx = currentBuffer.lastIndexOf(" ");
      newBuffer = currentBuffer.slice(0, lastSpaceIdx + 1) + insertText;
    } else {
      newBuffer = insertText;
    }
    
    setInputBuffer(active.id, newBuffer);
    suggestions.closeSuggestions();
  };

  // Get or create sticky scroll tracker for a terminal
  const getStickyScrollTracker = (terminalId: string): CommandTrackerResult => {
    let tracker = stickyScrollTrackers.get(terminalId);
    if (!tracker) {
      tracker = useTerminalCommandTracker({
        maxCommands: 50,
        enabled: stickyScrollSettings.enabled,
      });
      stickyScrollTrackers.set(terminalId, tracker);
    }
    return tracker;
  };

  // Process terminal output line for sticky scroll command detection
  const processStickyScrollLine = (terminalId: string, lineNumber: number, lineContent: string) => {
    if (!stickyScrollSettings.enabled) return;
    const tracker = getStickyScrollTracker(terminalId);
    tracker.processLine(lineNumber, lineContent);
  };

  // Update terminal scroll position for sticky scroll
  const updateTerminalScrollPosition = (terminalId: string, scrollLine: number, totalLines: number) => {
    setTerminalScrollLines(terminalId, scrollLine);
    setTerminalTotalLines(terminalId, totalLines);
  };

  // Update tab order when terminals change
  createEffect(() => {
    const terminalIds = state.terminals.map(t => t.id);
    const currentOrder = tabOrder();
    
    const newIds = terminalIds.filter(id => !currentOrder.includes(id));
    const validOrder = currentOrder.filter(id => terminalIds.includes(id));
    
    if (newIds.length > 0 || validOrder.length !== currentOrder.length) {
      setTabOrder([...validOrder, ...newIds]);
    }
  });

  // Initialize available shell profiles and check for embedded mode
  onMount(async () => {
    // Check if we should render in embedded mode (into bottom panel)
    const embeddedContainer = document.querySelector('[data-terminal-embed="true"]') as HTMLDivElement;
    if (embeddedContainer) {
      setIsEmbedded(true);
      terminalContainerRef = embeddedContainer;
    }
    
    const profiles: ShellProfile[] = [];
    const isWindows = navigator.platform.toLowerCase().includes("win");
    
    if (isWindows) {
      profiles.push(
        { name: "PowerShell", shell: "powershell.exe", icon: "powershell" },
        { name: "PowerShell Core", shell: "pwsh.exe", icon: "powershell" },
        { name: "Command Prompt", shell: "cmd.exe", icon: "cmd" },
        { name: "Git Bash", shell: "C:\\Program Files\\Git\\bin\\bash.exe", icon: "bash" },
        { name: "WSL", shell: "wsl.exe", icon: "bash" }
      );
    } else {
      profiles.push(
        { name: "Bash", shell: "/bin/bash", icon: "bash" },
        { name: "Zsh", shell: "/bin/zsh", icon: "zsh" },
        { name: "Fish", shell: "/usr/bin/fish", icon: "fish" },
        { name: "sh", shell: "/bin/sh", icon: "sh" }
      );
    }
    
    setShellProfiles(profiles);
    
    // Pre-load WebGL addon asynchronously
    loadWebglAddon().catch(() => {});
  });

  // Effect to check for embedded container when it appears (e.g., when terminal tab is opened)
  // Uses interval to detect DOM changes since we can't use reactive dependencies for DOM queries
  onMount(() => {
    const checkForEmbeddedContainer = () => {
      const embeddedContainer = document.querySelector('[data-terminal-embed="true"]') as HTMLDivElement;
      
      if (embeddedContainer) {
        if (terminalContainerRef !== embeddedContainer) {
          if (import.meta.env.DEV) console.log("[Terminal] Found new embedded container");
          terminalContainerRef = embeddedContainer;
          setIsEmbedded(true);
          
          // Re-attach or re-initialize all terminals into the new container
          state.terminals.forEach(terminal => {
            if (import.meta.env.DEV) console.log("[Terminal] Checking terminal for re-attachment:", terminal.id);
            // Remove existing container div if it was in an old parent
            const existingDiv = document.querySelector(`[data-terminal-id="${terminal.id}"]`) as HTMLDivElement;
            
            if (existingDiv && existingDiv.parentElement !== embeddedContainer) {
              if (import.meta.env.DEV) console.log("[Terminal] Moving existing terminal div to new container");
              embeddedContainer.appendChild(existingDiv);
              const instance = terminalInstances.get(terminal.id);
              if (instance) {
                requestAnimationFrame(() => {
                  instance.fitAddon.fit();
                  instance.terminal.focus();
                });
              }
            } else if (!existingDiv) {
              if (import.meta.env.DEV) console.log("[Terminal] No existing div found, initializing new terminal container");
              initializeTerminal(terminal);
            }
          });
        }
      } else if (isEmbedded()) {
        if (import.meta.env.DEV) console.log("[Terminal] Lost embedded container");
        setIsEmbedded(false);
        terminalContainerRef = undefined;
        // Clean up terminal instance DOM elements as they are now detached
        terminalInstances.forEach((_, id) => {
          const div = document.querySelector(`[data-terminal-id="${id}"]`);
          div?.remove();
        });
      }
    };
    
    // Check periodically
    const interval = setInterval(checkForEmbeddedContainer, 50);
    onCleanup(() => clearInterval(interval));
  });

  // Initialize terminal when active terminal changes
  createEffect(() => {
    const active = activeTerminal();
    const terminals = state.terminals || [];
    
    // If no active terminal but terminals exist, use the first one
    const effectiveActive = active || (terminals.length > 0 ? terminals[0] : null);
    if (!effectiveActive) return;
    
    // If in embedded mode, ensure we have the container
    if (isEmbedded() && !terminalContainerRef) {
      const embeddedContainer = document.querySelector('[data-terminal-embed="true"]') as HTMLDivElement;
      if (embeddedContainer) {
        terminalContainerRef = embeddedContainer;
      }
    }
    
    if (!terminalContainerRef) return;

    if (!terminalInstances.has(effectiveActive.id)) {
      initializeTerminal(effectiveActive);
    }

    terminalInstances.forEach((_, terminalId) => {
      const container = terminalContainerRef?.querySelector(`[data-terminal-id="${terminalId}"]`) as HTMLElement;
      if (container) {
        container.style.display = terminalId === effectiveActive.id ? "block" : "none";
      }
    });

    const instance = terminalInstances.get(effectiveActive.id);
    if (instance) {
      requestAnimationFrame(() => {
        instance.fitAddon.fit();
        instance.terminal.focus();
      });
    }
  });

  // Fit terminals when panel height changes
  createEffect(() => {
    panelHeight();
    const active = activeTerminal();
    const terminals = state.terminals || [];
    const effectiveActive = active || (terminals.length > 0 ? terminals[0] : null);
    if (!effectiveActive) return;

    const instance = terminalInstances.get(effectiveActive.id);
    if (instance) {
      requestAnimationFrame(() => {
        instance.fitAddon.fit();
      });
    }
  });

  // Update terminal appearance when settings change
  createEffect(() => {
    const ts = terminalSettings();
    const colorScheme = ts.colorScheme || "default-dark";
    // Use CSS variables from IDE theme for terminal colors when colorScheme is "auto" or "default-*"
    const selectedTheme = colorScheme === "auto" || colorScheme.startsWith("default")
      ? getTerminalThemeFromCSS()
      : getTerminalTheme(colorScheme);
    
    // Update all existing terminal instances
    terminalInstances.forEach((instance) => {
      const term = instance.terminal;
      // Update theme
      term.options.theme = selectedTheme;
      // Update font settings
      term.options.fontFamily = ts.fontFamily;
      term.options.fontSize = ts.fontSize;
      term.options.lineHeight = ts.lineHeight;
      // Update cursor settings
      term.options.cursorBlink = ts.cursorBlink;
      term.options.cursorStyle = ts.cursorStyle === "bar" ? "bar" : ts.cursorStyle === "underline" ? "underline" : "block";
      // Update word separators
      term.options.wordSeparator = ts.wordSeparators || " ()[]{}',\"`─''";
      // Update accessibility settings
      term.options.screenReaderMode = ts.accessibleViewEnabled;
      // Refit after updating settings
      requestAnimationFrame(() => {
        instance.fitAddon.fit();
      });
    });
  });

  // Close dropdown when clicking outside
  createEffect(() => {
    if (showNewTerminalDropdown()) {
      const handleClickOutside = (e: MouseEvent) => {
        if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
          setShowNewTerminalDropdown(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
    }
  });

  // Close context menu when clicking outside
  createEffect(() => {
    if (contextMenu.visible) {
      const handleClickOutside = () => {
        setContextMenu({ visible: false, x: 0, y: 0, terminalId: null });
      };
      document.addEventListener("mousedown", handleClickOutside);
      onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
    }
  });

  // Focus edit input when editing starts
  createEffect(() => {
    if (editingTabId() && editInputRef) {
      editInputRef.focus();
      editInputRef.select();
    }
  });

  /**
   * Initialize terminal with performance optimizations
   */
  const initializeTerminal = async (terminalInfo: TerminalInfo) => {
    if (!terminalContainerRef) return;

    // Check if we already have an instance
    const existingInstance = terminalInstances.get(terminalInfo.id);
    
    // Check for existing container first - reuse if it exists
    let container = terminalContainerRef.querySelector(`[data-terminal-id="${terminalInfo.id}"]`) as HTMLDivElement | null;
    
    if (!container) {
      // Create new container only if one doesn't exist
      container = document.createElement("div");
      container.setAttribute("data-terminal-id", terminalInfo.id);
      container.style.width = "100%";
      container.style.height = "100%";
      terminalContainerRef.appendChild(container);
    }
    
    // Update display based on active state
    container.style.display = terminalInfo.id === state.activeTerminalId ? "block" : "none";

    if (existingInstance) {
      if (import.meta.env.DEV) console.log("[Terminal] Re-attaching existing terminal:", terminalInfo.id);
      existingInstance.terminal.open(container);
      requestAnimationFrame(() => {
        existingInstance.fitAddon.fit();
      });
      return;
    }

    // Get terminal settings for appearance
    const ts = terminalSettings();
    const colorScheme = ts.colorScheme || "default-dark";
    // Use CSS variables from IDE theme for terminal colors when colorScheme is "auto" or "default-*"
    // This ensures the terminal matches the IDE theme
    const selectedTheme = colorScheme === "auto" || colorScheme.startsWith("default")
      ? getTerminalThemeFromCSS()
      : getTerminalTheme(colorScheme);
    
    // Create xterm instance with performance optimizations
    const terminal = new XTerm({
      cursorBlink: ts.cursorBlink,
      cursorStyle: ts.cursorStyle === "bar" ? "bar" : ts.cursorStyle === "underline" ? "underline" : "block",
      fontSize: ts.fontSize,
      fontFamily: ts.fontFamily,
      lineHeight: ts.lineHeight,
      letterSpacing: 0,
      theme: selectedTheme,
      allowProposedApi: true,
      // Performance optimizations
      scrollback: ts.scrollback || SCROLLBACK_LINES,
      tabStopWidth: 4,
      // CRITICAL: convertEol must be false for TUI apps (htop, vim, etc.)
      // true would convert \n to \r\n breaking escape sequences
      convertEol: false,
      // Enable screen reader mode based on accessibility settings
      // When enabled, provides accessible buffer with ARIA support
      screenReaderMode: ts.accessibleViewEnabled,
      // Smooth scrolling disabled for performance
      smoothScrollDuration: 0,
      // Word separators for double-click selection
      wordSeparator: ts.wordSeparators || " ()[]{}',\"`─''",
      // Scroll sensitivity (default is 1)
      scrollSensitivity: 1,
      // Reduce reflows by not drawing cursor when unfocused
      cursorInactiveStyle: "none",
      // GPU acceleration hints
      rescaleOverlappingGlyphs: true,
      // Disable drawing of bold text as bright for consistency
      drawBoldTextInBrightColors: false,
    });

    // Set up bell handler based on settings
    terminal.onBell(() => {
      const bellSetting = terminalSettings()?.bell ?? "none";
      if (bellSetting === "audible") {
        // Play system beep using Web Audio API
        try {
          const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = 800;
          oscillator.type = "sine";
          gainNode.gain.value = 0.1;
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
          console.warn("[Terminal] Failed to play bell sound:", e);
        }
      } else if (bellSetting === "visual") {
        // Flash the terminal container briefly
        const termContainer = container;
        if (termContainer) {
          termContainer.classList.add("terminal-visual-bell");
          setTimeout(() => {
            termContainer.classList.remove("terminal-visual-bell");
          }, 150);
        }
      }
      // "none" - do nothing
    });

    // Load addons
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const unicode11Addon = new Unicode11Addon();
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.open(uri, "_blank");
    });

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);
    
    // Load Unicode11 addon for proper TUI character widths (box drawing, emojis, etc.)
    terminal.loadAddon(unicode11Addon);
    terminal.unicode.activeVersion = '11';

    // Register file path link provider for clickable file links
    const filePathLinkProvider = new FilePathLinkProvider(
      terminal,
      async (path: string, line?: number, column?: number) => {
        try {
          // Open the file in the editor
          await editor.openFile(path);
          
          // If line number is specified, navigate to that line after file opens
          if (line !== undefined) {
            // Give the editor a moment to open the file, then navigate
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("editor:goto-line", {
                  detail: { line, column: column || 1 },
                })
              );
            }, 100);
          }
        } catch (err) {
          console.error("[Terminal] Failed to open file:", path, err);
        }
      }
    );
    terminal.registerLinkProvider(filePathLinkProvider);

    // Command markers state for this terminal (for gutter decorations)
    const commandMarkersState: CommandMarkerState = {
      markers: [],
      currentMarker: undefined,
    };

    /**
     * Create or update a command decoration in the terminal gutter
     * DISABLED: Command markers are disabled for cleaner terminal appearance
     */
    const createCommandDecoration = (
      _term: XTerm,
      _marker: CommandMarker,
      _status: 'running' | 'success' | 'error'
    ): IDecoration | undefined => {
      // Command decorations disabled - return early
      return undefined;
      
      /* Original implementation commented out:
      // Dispose existing decoration if any
      if (marker.decoration) {
        marker.decoration.dispose();
        marker.decoration = undefined;
      }
      
      // Create a new xterm marker at the command line if needed
      if (!marker.marker || marker.marker.isDisposed) {
        marker.marker = term.registerMarker(0);
      }
      
      if (!marker.marker || marker.marker.isDisposed) {
        return undefined;
      }
      
      // Create the decoration
      const decoration = term.registerDecoration({
        marker: marker.marker,
        anchor: 'left',
        width: 1,
        height: 1,
        overviewRulerOptions: {
          color: status === 'success' ? tokens.colors.semantic.success : status === 'error' ? tokens.colors.semantic.error : tokens.colors.semantic.primary,
          position: 'left',
        },
      });
      
      if (decoration) {
        decoration.onRender((element) => {
          // Clear existing classes and add new ones
          element.classList.remove('command-marker-success', 'command-marker-error', 'command-marker-running');
          element.classList.add('terminal-command-decoration');
          element.classList.add(`command-marker-${status}`);
          
          // Add tooltip data attributes
          element.setAttribute('data-command', marker.command || '');
          element.setAttribute('data-status', status);
          
          if (marker.exitCode !== undefined) {
            element.setAttribute('data-exit-code', String(marker.exitCode));
          }
          if (marker.startTime) {
            element.setAttribute('data-start-time', String(marker.startTime));
          }
          if (marker.endTime) {
            element.setAttribute('data-end-time', String(marker.endTime));
            const duration = marker.endTime - (marker.startTime || marker.endTime);
            element.setAttribute('data-duration', String(duration));
          }
          
          // Add hover tooltip
          element.title = formatCommandTooltip(marker);
        });
        
        marker.decoration = decoration;
      }
      
      return decoration;
      */
    };

    /**
     * Format tooltip text for command marker
     * Uses formatCommandDuration helper for safe duration handling with undefined metadata
     */
    const formatCommandTooltip = (marker: CommandMarker): string => {
      const lines: string[] = [];
      
      if (marker.command) {
        lines.push(`Command: ${marker.command}`);
      }
      
      lines.push(`Status: ${marker.status}`);
      
      if (marker.exitCode !== undefined) {
        lines.push(`Exit Code: ${marker.exitCode}`);
      }
      
      // Use helper function for safe duration formatting (handles undefined metadata from Tauri)
      const durationStr = formatCommandDuration(marker.startTime, marker.endTime);
      if (durationStr) {
        lines.push(`Duration: ${durationStr}`);
      } else if (marker.startTime && marker.status === 'running') {
        lines.push('Running...');
      }
      
      return lines.join('\n');
    };

    // Initialize decorations manager for this terminal
    const decorationsManager = useTerminalDecorations({ maxDecorations: 100 });
    terminalDecorations.set(terminalInfo.id, decorationsManager);
    
    // Track pending command for decoration linking
    let pendingCommandLine: string | null = null;
    let currentDecorationId: string | null = null;
    let currentCwd: string | undefined = undefined;

    // Register shell integration OSC handler (OSC 633)
    // This allows the shell to communicate state to the terminal
    // Also creates command gutter decorations for visual feedback
    terminal.parser.registerOscHandler(633, (data) => {
      const parts = data.split(";");
      const type = parts[0];

      switch (type) {
        case "A": // Prompt start
          // Shell integration: Mark start of prompt
          updateTerminalInfo(terminalInfo.id, { command_running: false }).catch(console.error);
          break;
        case "B": // Prompt end
          break;
        case "C": { // Command start
          // Shell integration: Mark start of command execution
          updateTerminalInfo(terminalInfo.id, { command_running: true }).catch(console.error);
          
          // Create a new command marker with 'running' status
          const cursorLine = terminal.buffer.active.cursorY + terminal.buffer.active.baseY;
          const newMarker: CommandMarker = {
            line: cursorLine,
            status: 'running',
            startTime: Date.now(),
          };
          
          // Register the xterm marker at current cursor position
          newMarker.marker = terminal.registerMarker(0);
          
          // Create the decoration
          createCommandDecoration(terminal, newMarker, 'running');
          
          // Store as current marker and add to list
          commandMarkersState.currentMarker = newMarker;
          commandMarkersState.markers.push(newMarker);
          
          // Limit markers to last 100 to prevent memory issues
          if (commandMarkersState.markers.length > 100) {
            const removedMarker = commandMarkersState.markers.shift();
            if (removedMarker?.decoration) {
              removedMarker.decoration.dispose();
            }
            if (removedMarker?.marker && !removedMarker.marker.isDisposed) {
              removedMarker.marker.dispose();
            }
          }
          
          // Create decoration using the new decorations system
          if (decorationSettings().enabled && pendingCommandLine) {
            currentDecorationId = decorationsManager.startCommand(
              cursorLine,
              pendingCommandLine,
              currentCwd
            );
            pendingCommandLine = null;
          }
          break;
        }
        case "D": { // Command end
          // Shell integration: Mark end of command execution with optional exit code
          const exitCode = parts.length > 1 ? parseInt(parts[1], 10) : undefined;
          const validExitCode = exitCode !== undefined && !isNaN(exitCode) ? exitCode : undefined;
          
          if (validExitCode !== undefined) {
            updateTerminalInfo(terminalInfo.id, { 
              last_exit_code: validExitCode,
              command_running: false 
            }).catch(console.error);
          } else {
            updateTerminalInfo(terminalInfo.id, { command_running: false }).catch(console.error);
          }
          
          // Update the current marker with completion status
          if (commandMarkersState.currentMarker) {
            const marker = commandMarkersState.currentMarker;
            marker.endTime = Date.now();
            marker.exitCode = validExitCode;
            marker.status = validExitCode === 0 ? 'success' : 'error';
            
            // Update the decoration with new status
            createCommandDecoration(terminal, marker, marker.status);
            
            // Announce command completion to screen reader
            if (ts.screenReaderAnnounce) {
              // Use helper for safe duration formatting (handles undefined metadata from Tauri)
              const durationStr = formatCommandDuration(marker.startTime, marker.endTime) ?? "unknown time";
              const commandName = marker.command ? `"${marker.command}"` : "Command";
              const statusMsg = marker.status === 'success' 
                ? `${commandName} completed successfully in ${durationStr}`
                : `${commandName} failed with exit code ${validExitCode} after ${durationStr}`;
              announceToScreenReader(statusMsg, marker.status === 'error');
            }
            
            // Clear current marker
            commandMarkersState.currentMarker = undefined;
          }
          
          // End decoration with exit code
          if (currentDecorationId && decorationSettings().enabled) {
            decorationsManager.endCommand(currentDecorationId, validExitCode ?? 0);
            currentDecorationId = null;
          }
          break;
        }
        case "E": // Command line
          // Shell integration: Set the command line that was executed
          if (parts.length > 1) {
            const command = parts[1];
            updateTerminalInfo(terminalInfo.id, { last_command: command }).catch(console.error);
            
            // Store for decoration creation on command start
            pendingCommandLine = command;
            
            // Update the current marker with the command text
            if (commandMarkersState.currentMarker) {
              commandMarkersState.currentMarker.command = command;
              
              // Update tooltip if decoration element exists
              if (commandMarkersState.currentMarker.decoration?.element) {
                commandMarkersState.currentMarker.decoration.element.title = 
                  formatCommandTooltip(commandMarkersState.currentMarker);
                commandMarkersState.currentMarker.decoration.element.setAttribute('data-command', command);
              }
            }
          }
          break;
        case "P": // Property set
          // Shell integration: Set property (e.g., Cwd)
          if (parts.length > 1) {
            const property = parts[1];
            if (property.startsWith("Cwd=")) {
              const cwd = property.substring(4);
              currentCwd = cwd;
              updateTerminalInfo(terminalInfo.id, { cwd }).catch(console.error);
            }
          }
          break;
      }
      return true;
    });

    // Open terminal in container
    terminal.open(container);

    // Configure Windows PTY compatibility (like VS Code)
    // This is required for proper escape sequence handling on Windows with ConPTY
    const isWindows = navigator.platform.toLowerCase().includes("win");
    if (isWindows) {
      // Get Windows build number from navigator.userAgent
      // Format: "Windows NT 10.0; Win64; x64" or similar
      let buildNumber = 19041; // Default fallback (Windows 10 2004)
      const match = navigator.userAgent.match(/Windows NT (\d+)\.(\d+)(?:\.(\d+))?/);
      if (match && match[3]) {
        buildNumber = parseInt(match[3], 10);
      } else {
        // Try alternative: get from os.release() equivalent
        // On Windows 10/11, the third part of the version is the build number
        const osMatch = navigator.userAgent.match(/Windows NT \d+\.\d+/);
        if (osMatch) {
          // Windows 10 = 10.0, Windows 11 = 10.0 with build >= 22000
          // Use a reasonable modern default
          buildNumber = 22000; // Windows 11 baseline
        }
      }
      
      // Set windowsPty options for ConPTY backend
      terminal.options.windowsPty = {
        backend: 'conpty',
        buildNumber,
      };
      
      // Respond to DA1 (Device Attributes) request to avoid ConPTY delay
      // Reference: https://github.com/microsoft/terminal/blob/main/src/terminal/adapter/adaptDispatch.cpp
      terminal.parser.registerCsiHandler({ final: 'c' }, (params) => {
        if (params.length === 0 || (params.length === 1 && params[0] === 0)) {
          // Send DA1 response indicating VT100 with AVO (Advanced Video Option)
          writeToTerminal(terminalInfo.id, '\x1b[?61;4c').catch(() => {});
          return true;
        }
        return false;
      });
    }

    // Try to load WebGL addon for GPU-accelerated rendering
    let webglAddon: unknown = null;
    if (webglAddonModule) {
      try {
        webglAddon = new webglAddonModule.WebglAddon();
        terminal.loadAddon(webglAddon as Parameters<typeof terminal.loadAddon>[0]);
        if (import.meta.env.DEV) console.log("[Terminal] WebGL renderer enabled for terminal:", terminalInfo.id);
      } catch (e) {
        console.warn("[Terminal] Failed to enable WebGL renderer:", e);
        webglAddon = null;
      }
    }

    // Attach custom key event handler for mark navigation and select all
    terminal.attachCustomKeyEventHandler((e) => {
      // Ctrl+Up: Go to previous command
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'ArrowUp' && e.type === 'keydown') {
        goToPrevCommand(terminalInfo.id);
        return false; // Prevent default terminal behavior
      }
      // Ctrl+Down: Go to next command
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'ArrowDown' && e.type === 'keydown') {
        goToNextCommand(terminalInfo.id);
        return false; // Prevent default terminal behavior
      }
      // Ctrl+A: Select all content in terminal
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'a' && e.type === 'keydown') {
        terminal.selectAll();
        return false; // Prevent default terminal behavior
      }
      return true; // Allow other keys to pass through
    });

    // Fit after a short delay to ensure container is sized
    requestAnimationFrame(() => {
      fitAddon.fit();
      
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        resizeTerminal(terminalInfo.id, dims.cols, dims.rows).catch(console.error);
      }
      
      // Write connection message AFTER fit to avoid wrapping on small initial size
      terminal.write(`\x1b[1;34m[Cortex Terminal]\x1b[0m Connected to ${terminalInfo.shell}\r\n`);
      
      // Secondary fit after container has fully settled (fixes race condition)
      setTimeout(() => {
        if (container.offsetWidth > 0 && container.offsetHeight > 0) {
          fitAddon.fit();
          const dims2 = fitAddon.proposeDimensions();
          if (dims2 && dims2.cols > 0 && dims2.rows > 0) {
            resizeTerminal(terminalInfo.id, dims2.cols, dims2.rows).catch(console.error);
          }
        }
      }, 100);
    });

    // Create output stream processor for chunked processing
    const outputProcessor = new OutputStreamProcessor(OUTPUT_CHUNK_SIZE);
    outputProcessors.set(terminalInfo.id, outputProcessor);

    // Handle terminal input - send immediately, defer suggestions processing
    terminal.onData((data) => {
      // CRITICAL: Send input to PTY immediately without any blocking
      writeToTerminal(terminalInfo.id, data).catch(console.error);
      
      // Defer all suggestion/buffer processing to next frame to avoid blocking input
      // This is essential for TUI apps that need immediate key response
      requestAnimationFrame(() => {
        const currentBuffer = inputBuffer[terminalInfo.id] || "";
        
        if (data === "\r" || data === "\n") {
          if (currentBuffer.trim()) {
            suggestions.addToHistory(currentBuffer.trim());
          }
          setInputBuffer(terminalInfo.id, "");
          suggestions.closeSuggestions();
        } else if (data === "\x7f" || data === "\b") {
          const newBuffer = currentBuffer.slice(0, -1);
          setInputBuffer(terminalInfo.id, newBuffer);
          suggestions.setCurrentInput(newBuffer);
        } else if (data === "\x03") {
          setInputBuffer(terminalInfo.id, "");
          suggestions.closeSuggestions();
        } else if (data === "\x15") {
          setInputBuffer(terminalInfo.id, "");
          suggestions.closeSuggestions();
        } else if (data === "\t") {
          // Tab handled by suggestions
        } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
          const newBuffer = currentBuffer + data;
          setInputBuffer(terminalInfo.id, newBuffer);
          suggestions.setCurrentInput(newBuffer);
          updateCursorPosition(terminalInfo.id);
        } else if (data.length > 1) {
          const newBuffer = currentBuffer + data;
          setInputBuffer(terminalInfo.id, newBuffer);
          suggestions.setCurrentInput(newBuffer);
        }
      });
    });

    terminal.onBinary((data) => {
      writeToTerminal(terminalInfo.id, data).catch(console.error);
    });

    terminal.onResize(({ cols, rows }) => {
      resizeTerminal(terminalInfo.id, cols, rows).catch(console.error);
    });

    // Track if this terminal instance has been disposed to prevent writes after cleanup
    let isTerminalDisposed = false;
    
    // Subscribe to terminal output with robust stream closure handling
    const unsubscribe = subscribeToOutput((output) => {
      // Early exit if terminal has been disposed
      if (isTerminalDisposed) {
        return;
      }
      
      if (output.terminal_id === terminalInfo.id) {
        // Write output directly to terminal - no chunking for real-time TUI responsiveness
        // Guard against writing to a disposed terminal to prevent crashes
        try {
          // Multi-level check for terminal availability:
          // 1. Check our local disposed flag (fastest)
          // 2. Check if terminal element exists
          // 3. Check if terminal is marked as disposed via class
          // 4. Check if the terminal is in the instances map (hasn't been cleaned up)
          if (isTerminalDisposed) {
            return;
          }
          
          if (!terminal.element) {
            console.debug(`[Terminal] Terminal ${terminalInfo.id} element is null, marking as disposed`);
            isTerminalDisposed = true;
            return;
          }
          
          if (terminal.element.classList.contains('disposed')) {
            console.debug(`[Terminal] Terminal ${terminalInfo.id} is disposed, skipping output`);
            isTerminalDisposed = true;
            return;
          }
          
          // Check if terminal instance still exists in our map
          const instance = terminalInstances.get(terminalInfo.id);
          if (!instance) {
            console.debug(`[Terminal] Terminal ${terminalInfo.id} instance not found, marking as disposed`);
            isTerminalDisposed = true;
            return;
          }
          
          // Safe to write
          terminal.write(output.data);
        } catch (e) {
          // Terminal may be disposed or in an invalid state - this is expected during cleanup
          // Mark as disposed to prevent further write attempts
          isTerminalDisposed = true;
          console.debug(`[Terminal] Stream write failed for ${terminalInfo.id}, terminal may be closing:`, e);
          return; // Skip further processing for this output
        }
        
        // Defer non-critical processing to avoid blocking TUI updates
        // Use requestIdleCallback for lower priority tasks
        if (quickFixEnabled() || stickyScrollSettings.enabled) {
          requestAnimationFrame(() => {
            // Double-check terminal is still valid before deferred processing
            if (isTerminalDisposed || !terminalInstances.has(terminalInfo.id)) {
              return;
            }
            
            if (quickFixEnabled()) {
              setTerminalOutputs(terminalInfo.id, (prev) => {
                const newOutput = (prev || "") + output.data;
                if (newOutput.length > 50000) {
                  return newOutput.slice(-50000);
                }
                return newOutput;
              });
            }
            
            if (stickyScrollSettings.enabled) {
              // Safely access terminal buffer - may throw if disposed
              try {
                const lines = output.data.split(/\r?\n/);
                const baseLineNumber = terminal.buffer.active.baseY + terminal.buffer.active.cursorY;
                lines.forEach((line, index) => {
                  if (line.trim()) {
                    processStickyScrollLine(terminalInfo.id, baseLineNumber + index, line);
                  }
                });
                const scrollLine = terminal.buffer.active.viewportY;
                const totalLines = terminal.buffer.active.length;
                updateTerminalScrollPosition(terminalInfo.id, scrollLine, totalLines);
              } catch (bufferError) {
                // Terminal buffer may be invalid during disposal
                console.debug(`[Terminal] Buffer access failed for ${terminalInfo.id}:`, bufferError);
              }
            }
          });
        }
      }
    });
    
    // Setup scroll event listener with stored reference for cleanup
    const viewport = container.querySelector(".xterm-viewport") as HTMLElement;
    let scrollHandler: (() => void) | null = null;
    if (viewport) {
      scrollHandler = () => {
        const isAtBottom = Math.abs(
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
        ) < 5;
        
        if (isAtBottom && scrollLocked()) {
          setScrollLocked(false);
        }
        
        if (stickyScrollSettings.enabled) {
          const scrollLine = terminal.buffer.active.viewportY;
          const totalLines = terminal.buffer.active.length;
          updateTerminalScrollPosition(terminalInfo.id, scrollLine, totalLines);
        }
      };
      viewport.addEventListener("scroll", scrollHandler);
    }

    // Create ResizeObserver to auto-fit terminal when container size changes
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleResize = () => {
      // Only fit if this terminal is currently visible and has real dimensions
      if (container.style.display !== 'none' && 
          container.offsetParent !== null &&
          container.offsetWidth > 0 &&
          container.offsetHeight > 0) {
        fitAddon.fit();
        const dims = fitAddon.proposeDimensions();
        if (dims && dims.cols > 0 && dims.rows > 0) {
          resizeTerminal(terminalInfo.id, dims.cols, dims.rows).catch(console.error);
        }
      }
    };
    
    resizeObserver = new ResizeObserver((entries) => {
      // Debounce resize to avoid excessive fitting during drag
      // Use 16ms (~60fps) for smoother TUI rendering during resize
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            handleResize();
          }
        }
      }, 16); // 16ms debounce for smooth TUI resize
    });
    
    // Observe the container for size changes
    resizeObserver.observe(container);
    
    // Also observe the parent container (terminalContainerRef) for panel resize
    if (terminalContainerRef) {
      resizeObserver.observe(terminalContainerRef);
    }

    // Store instance with scroll handler and resize observer for proper cleanup
    terminalInstances.set(terminalInfo.id, {
      terminal,
      fitAddon,
      searchAddon,
      webglAddon,
      unsubscribe,
      outputBuffer: [],
      commandMarkers: commandMarkersState,
      scrollHandler,
      viewportElement: viewport,
      resizeObserver,
      containerElement: container,
      decorations: decorationsManager,
      currentDecorationId: null,
    });
  };

  // Navigate to next command marker in terminal
  const goToNextCommand = (terminalId: string) => {
    const instance = terminalInstances.get(terminalId);
    if (!instance) return;
    
    const markers = instance.commandMarkers.markers;
    if (markers.length === 0) return;
    
    const currentLine = instance.terminal.buffer.active.viewportY;
    
    // Find the next marker after current viewport position
    const nextMarker = markers.find(m => m.line > currentLine);
    
    if (nextMarker) {
      instance.terminal.scrollToLine(nextMarker.line);
      highlightMarker(nextMarker);
    } else if (markers.length > 0) {
      // Wrap to first marker
      instance.terminal.scrollToLine(markers[0].line);
      highlightMarker(markers[0]);
    }
  };

  // Navigate to previous command marker in terminal
  const goToPrevCommand = (terminalId: string) => {
    const instance = terminalInstances.get(terminalId);
    if (!instance) return;
    
    const markers = [...instance.commandMarkers.markers].reverse();
    if (markers.length === 0) return;
    
    const currentLine = instance.terminal.buffer.active.viewportY;
    
    // Find the previous marker before current viewport position
    const prevMarker = markers.find(m => m.line < currentLine);
    
    if (prevMarker) {
      instance.terminal.scrollToLine(prevMarker.line);
      highlightMarker(prevMarker);
    } else if (markers.length > 0) {
      // Wrap to last marker
      const lastMarker = instance.commandMarkers.markers[instance.commandMarkers.markers.length - 1];
      instance.terminal.scrollToLine(lastMarker.line);
      highlightMarker(lastMarker);
    }
  };

  // Highlight a marker briefly when navigating to it
  const highlightMarker = (marker: CommandMarker) => {
    if (!marker.decoration?.element) return;
    
    const element = marker.decoration.element;
    element.classList.add('command-marker-highlight');
    
    // Remove the highlight class after animation completes
    setTimeout(() => {
      element.classList.remove('command-marker-highlight');
    }, 600);
  };

  const clearTerminal = () => {
    const active = activeTerminal();
    if (active) {
      const instance = terminalInstances.get(active.id);
      if (instance) {
        instance.terminal.clear();
        // Also clear output buffer
        instance.outputBuffer.length = 0;
      }
    }
  };

  const selectAllTerminal = (terminalId: string) => {
    const instance = terminalInstances.get(terminalId);
    if (!instance?.terminal) return;
    
    // Select all content in the terminal
    instance.terminal.selectAll();
  };

  // Global event listeners for terminal commands
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.showPanel) return;
      
      // Ctrl+F to open find widget
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "f" && isFocused()) {
        e.preventDefault();
        e.stopPropagation();
        setShowFindWidget(true);
        return;
      }
      
      // F3 / Shift+F3 for find next/prev when find widget is open
      if (e.key === "F3" && showFindWidget()) {
        e.preventDefault();
        const active = activeTerminal();
        const searchQuery = getPersistedSearchQuery();
        if (active && searchQuery) {
          const instance = terminalInstances.get(active.id);
          if (instance && instance.searchAddon) {
            if (e.shiftKey) {
              instance.searchAddon.findPrevious(searchQuery);
            } else {
              instance.searchAddon.findNext(searchQuery);
            }
          }
        }
        return;
      }
      
      // Ctrl+Shift+L to toggle scroll lock
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        e.preventDefault();
        const newLocked = !scrollLocked();
        setScrollLocked(newLocked);
        if (!newLocked) {
          const active = activeTerminal();
          if (active) {
            const instance = terminalInstances.get(active.id);
            if (instance) {
              instance.terminal.scrollToBottom();
            }
          }
        }
        return;
      }
      
      // Ctrl+L to clear
      if (e.ctrlKey && e.key === "l" && isFocused()) {
        e.preventDefault();
        clearTerminal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    
    // Terminal navigation event handlers
    const handleGoToNextCommand = () => {
      const active = activeTerminal();
      if (active) {
        goToNextCommand(active.id);
      }
    };
    
    const handleGoToPrevCommand = () => {
      const active = activeTerminal();
      if (active) {
        goToPrevCommand(active.id);
      }
    };
    
    const handleSelectAll = () => {
      const active = activeTerminal();
      if (active) {
        selectAllTerminal(active.id);
      }
    };
    
    window.addEventListener("terminal:go-to-next-command", handleGoToNextCommand);
    window.addEventListener("terminal:go-to-prev-command", handleGoToPrevCommand);
    window.addEventListener("terminal:select-all", handleSelectAll);
    
    // Event handlers for rename and color picker dialogs
    const handleShowRenameDialog = () => {
      const active = activeTerminal();
      if (active) {
        setDialogTerminalId(active.id);
        setShowRenameDialog(true);
      }
    };
    
    const handleShowColorPicker = () => {
      const active = activeTerminal();
      if (active) {
        setDialogTerminalId(active.id);
        setShowColorPicker(true);
      }
    };
    
    window.addEventListener("terminal:show-rename-dialog", handleShowRenameDialog);
    window.addEventListener("terminal:show-color-picker", handleShowColorPicker);
    
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("terminal:go-to-next-command", handleGoToNextCommand);
      window.removeEventListener("terminal:go-to-prev-command", handleGoToPrevCommand);
      window.removeEventListener("terminal:select-all", handleSelectAll);
      window.removeEventListener("terminal:show-rename-dialog", handleShowRenameDialog);
      window.removeEventListener("terminal:show-color-picker", handleShowColorPicker);
      
      // Dispose all terminal instances with proper cleanup
      terminalInstances.forEach((instance) => {
        instance.unsubscribe();
        
        // Clean up scroll event listener
        if (instance.scrollHandler && instance.viewportElement) {
          instance.viewportElement.removeEventListener("scroll", instance.scrollHandler);
          instance.scrollHandler = null;
          instance.viewportElement = null;
        }
        
        if (instance.webglAddon && typeof (instance.webglAddon as { dispose?: () => void }).dispose === 'function') {
          try {
            (instance.webglAddon as { dispose: () => void }).dispose();
          } catch (err) { console.debug("WebGL addon disposal failed:", err); }
        }
        instance.outputBuffer.length = 0;
        instance.terminal?.dispose?.();
      });
      terminalInstances.clear();
      
      // Clean up output processors (dispose to prevent memory leaks)
      outputProcessors.forEach((processor) => {
        processor.dispose();
      });
      outputProcessors.clear();
      
      // Cancel window resize debouncer
      windowResizeDebouncer?.cancel();
    });
  });

  // Handle window resize with debouncing
  onMount(() => {
    windowResizeDebouncer = createDebouncedResize(() => {
      const active = activeTerminal();
      if (active) {
        const instance = terminalInstances.get(active.id);
        if (instance) {
          instance.fitAddon.fit();
        }
      }
    }, WINDOW_RESIZE_DEBOUNCE_MS);

    const handleResize = () => {
      windowResizeDebouncer?.call();
    };

    window.addEventListener("resize", handleResize);
    onCleanup(() => {
      window.removeEventListener("resize", handleResize);
      windowResizeDebouncer?.cancel();
    });
  });

  // Get decorations for the active terminal
  const activeDecorations = createMemo((): CommandDecoration[] => {
    const activeId = state.activeTerminalId;
    if (!activeId) return [];
    const decorations = terminalDecorations.get(activeId);
    if (!decorations) return [];
    return decorations.decorations();
  });

  // Get scroll state for active terminal
  const activeTerminalScrollState = createMemo(() => {
    const activeId = state.activeTerminalId;
    if (!activeId) return { scrollOffset: 0, lineHeight: 18, visibleLines: 50 };
    const instance = terminalInstances.get(activeId);
    if (!instance) return { scrollOffset: 0, lineHeight: 18, visibleLines: 50 };
    const buffer = instance.terminal.buffer.active;
    return {
      scrollOffset: buffer.viewportY,
      lineHeight: Math.round(instance.terminal.options.fontSize || 14) * (instance.terminal.options.lineHeight || 1.2),
      visibleLines: instance.terminal.rows,
    };
  });

  // Handle decoration action click
  const handleDecorationAction = async (decoration: CommandDecoration, action: DecorationAction) => {
    const activeId = state.activeTerminalId;
    if (!activeId) return;

    switch (action) {
      case "copy-command":
        await navigator.clipboard.writeText(decoration.command);
        break;
      
      case "copy-output":
        if (decoration.output) {
          await navigator.clipboard.writeText(decoration.output);
        }
        break;
      
      case "rerun":
        // Write the command to the terminal and execute it
        await writeToTerminal(activeId, decoration.command + "\r");
        break;
      
      case "show-output":
        // For now, just copy output. Could open in a panel later.
        if (decoration.output) {
          await navigator.clipboard.writeText(decoration.output);
        }
        break;
    }
  };

  // In embedded mode, don't render the floating panel - terminals render into the embedded container
  return (
    <>
      {/* ARIA Live Region for Terminal Accessibility Announcements */}
      <div
        ref={ariaLiveRegion}
        aria-live="polite"
        aria-atomic="true"
        role="status"
        class="sr-only"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: "0",
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          "white-space": "nowrap",
          border: "0",
        }}
      />
      
      {/* Terminal Command Suggestions Dropdown */}
      <TerminalSuggest
        visible={suggestions.showSuggestions()}
        input={suggestions.currentInput()}
        cursorPosition={suggestions.cursorPosition()}
        onSelect={handleSuggestionSelect}
        onClose={suggestions.closeSuggestions}
        context={suggestions.context()}
        maxSuggestions={10}
      />

      {/* Terminal Command Decorations (gutter status indicators) */}
      <Show when={decorationSettings().enabled && activeTerminal()}>
        <TerminalDecorations
          terminalId={state.activeTerminalId || ""}
          decorations={activeDecorations()}
          onDecorationClick={handleDecorationAction}
          enabled={decorationSettings().enabled}
          showDuration={decorationSettings().showDuration}
          showExitCode={decorationSettings().showExitCode}
          lineHeight={activeTerminalScrollState().lineHeight}
          scrollOffset={activeTerminalScrollState().scrollOffset}
          visibleLines={activeTerminalScrollState().visibleLines}
        />
      </Show>

      {/* VS Code Terminal Styles - Z-index architecture, gutter system, cursor states */}
      <style>{`
        /* VS Code Terminal - Height and positioning */
        .xterm {
          height: 100%;
          padding-left: var(--terminal-gutter-padding, 20px);
          user-select: none;
          -webkit-user-select: none;
          cursor: text;
        }
        
        .xterm .xterm-screen {
          cursor: text;
          z-index: 31;
        }
        
        /* Gutter system - 20px with negative margin */
        .xterm .xterm-scrollable-element {
          margin-left: calc(-1 * var(--terminal-gutter-padding, 20px));
          padding-left: var(--terminal-gutter-padding, 20px);
        }
        
        /* Viewport positioning - z-index 30 */
        .xterm-viewport {
          overflow-y: auto !important;
          z-index: 30;
        }
        
        /* Scrollbar styling with VS Code tokens */
        .xterm-viewport::-webkit-scrollbar {
          width: 8px;
        }
        .xterm-viewport::-webkit-scrollbar-track {
          background: transparent;
        }
        .xterm-viewport::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-background, var(--jb-scrollbar-thumb));
          border-radius: var(--cortex-radius-sm);
        }
        .xterm-viewport::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-hoverBackground, var(--jb-scrollbar-thumb-hover));
        }
        .xterm-viewport::-webkit-scrollbar-thumb:active {
          background: var(--vscode-scrollbarSlider-activeBackground, var(--jb-scrollbar-thumb-active));
        }
        
        /* Cursor states - 5 distinct states */
        .xterm.enable-mouse-events,
        .xterm.enable-mouse-events .xterm-screen {
          cursor: default;
        }
        
        .xterm.xterm-cursor-pointer,
        .xterm .xterm-cursor-pointer {
          cursor: pointer !important;
        }
        
        .xterm.column-select.focus,
        .xterm.column-select.focus .xterm-screen {
          cursor: crosshair;
        }
        
        .terminal-groups-container.alt-active .xterm {
          cursor: default;
        }
        
        /* Scrollbar fade animations - VS Code spec */
        .xterm .xterm-scrollable-element > .visible {
          opacity: 1;
          background: transparent;
          transition: opacity 100ms linear;
          z-index: 11;
        }
        
        .xterm .xterm-scrollable-element > .invisible {
          opacity: 0;
          pointer-events: none;
        }
        
        .xterm .xterm-scrollable-element > .invisible.fade {
          transition: opacity 800ms linear;
        }
        
        /* Text decorations - xterm underline styles */
        .xterm-underline-1 { text-decoration: underline; }
        .xterm-underline-2 { text-decoration: double underline; }
        .xterm-underline-3 { text-decoration: wavy underline; }
        .xterm-underline-4 { text-decoration: dotted underline; }
        .xterm-underline-5 { text-decoration: dashed underline; }
        .xterm-overline { text-decoration: overline; }
        .xterm-strikethrough { text-decoration: line-through; }
        
        /* Helpers and utilities */
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        
        /* High contrast mode focus border - z-index 32 */
        .cortex-terminal-panel.high-contrast .xterm.focus::before,
        .cortex-terminal-panel.high-contrast .xterm:focus::before {
          display: block;
          content: "";
          border: 1px solid var(--vscode-contrastActiveBorder, var(--cortex-warning));
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 32;
          pointer-events: none;
        }
        
        /* Find active result decoration - z-index 7 */
        .xterm-find-active-result-decoration {
          outline-style: solid !important;
          outline-width: 2px !important;
          z-index: 7 !important;
        }
        
        /* High contrast find decoration */
        .high-contrast .xterm-find-result-decoration {
          outline-style: solid !important;
        }
      `}</style>

      {/* Terminal Rename Dialog */}
      <TerminalRenameDialog
        open={showRenameDialog()}
        currentName={getTerminalName(dialogTerminalId() || "") || "Terminal"}
        onRename={(name) => {
          const termId = dialogTerminalId();
          if (termId) {
            renameTerminal(termId, name);
          }
          setShowRenameDialog(false);
          setDialogTerminalId(null);
        }}
        onCancel={() => {
          setShowRenameDialog(false);
          setDialogTerminalId(null);
        }}
      />

      {/* Terminal Color Picker */}
      <TerminalColorPicker
        open={showColorPicker()}
        currentColor={getTerminalColor(dialogTerminalId() || "")}
        onColorSelect={(color) => {
          const termId = dialogTerminalId();
          if (termId) {
            setTerminalColor(termId, color);
          }
          setShowColorPicker(false);
          setDialogTerminalId(null);
        }}
        onCancel={() => {
          setShowColorPicker(false);
          setDialogTerminalId(null);
        }}
      />
    </>
  );
}




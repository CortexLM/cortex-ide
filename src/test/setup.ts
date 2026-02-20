/**
 * Test Setup - Global test configuration for Cortex IDE
 * 
 * This file is run before each test file to set up the test environment.
 * It provides:
 * - JSDOM environment polyfills
 * - Monaco Editor mocks
 * - Tauri API mocks
 * - Global test utilities
 */

import { vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// JSDOM Polyfills
// ============================================================================

// Mock ResizeObserver (not available in JSDOM)
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: "",
  thresholds: [],
}));

// Mock MutationObserver if not available
if (!global.MutationObserver) {
  global.MutationObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: () => [],
  }));
}

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollTo
Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// Mock requestAnimationFrame/cancelAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 0) as unknown as number);
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// Mock getComputedStyle
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = vi.fn((element: Element) => {
  try {
    return originalGetComputedStyle(element);
  } catch {
    return {
      getPropertyValue: () => "",
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
    } as unknown as CSSStyleDeclaration;
  }
});

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(""),
    write: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue([]),
  },
  writable: true,
});

// ============================================================================
// Monaco Editor Mocks
// ============================================================================

export const createMockMonacoEditor = () => ({
  getValue: vi.fn().mockReturnValue(""),
  setValue: vi.fn(),
  getModel: vi.fn().mockReturnValue({
    getValue: vi.fn().mockReturnValue(""),
    getLineContent: vi.fn().mockReturnValue(""),
    getLineCount: vi.fn().mockReturnValue(1),
    getLineMaxColumn: vi.fn().mockReturnValue(1),
    getFullModelRange: vi.fn().mockReturnValue({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
    }),
    findMatches: vi.fn().mockReturnValue([]),
    getWordAtPosition: vi.fn().mockReturnValue(null),
    getValueInRange: vi.fn().mockReturnValue(""),
    uri: { toString: () => "file:///test.ts" },
    onDidChangeContent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  }),
  getPosition: vi.fn().mockReturnValue({ lineNumber: 1, column: 1 }),
  setPosition: vi.fn(),
  getSelection: vi.fn().mockReturnValue({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 1,
    isEmpty: () => true,
  }),
  setSelection: vi.fn(),
  setSelections: vi.fn(),
  getSelections: vi.fn().mockReturnValue([]),
  revealPositionInCenter: vi.fn(),
  revealLine: vi.fn(),
  revealLineInCenter: vi.fn(),
  revealRange: vi.fn(),
  revealRangeInCenter: vi.fn(),
  focus: vi.fn(),
  layout: vi.fn(),
  deltaDecorations: vi.fn().mockReturnValue([]),
  createDecorationsCollection: vi.fn().mockReturnValue({
    set: vi.fn(),
    clear: vi.fn(),
    getRanges: vi.fn().mockReturnValue([]),
  }),
  onDidChangeCursorPosition: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidChangeCursorSelection: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidChangeModelContent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidBlurEditorWidget: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onKeyDown: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  addCommand: vi.fn().mockReturnValue(null),
  addAction: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  executeEdits: vi.fn().mockReturnValue(true),
  pushUndoStop: vi.fn(),
  trigger: vi.fn(),
  getContainerDomNode: vi.fn().mockReturnValue(document.createElement("div")),
  getDomNode: vi.fn().mockReturnValue(document.createElement("div")),
  getScrollWidth: vi.fn().mockReturnValue(0),
  getScrollHeight: vi.fn().mockReturnValue(0),
  getScrollTop: vi.fn().mockReturnValue(0),
  getScrollLeft: vi.fn().mockReturnValue(0),
  setScrollTop: vi.fn(),
  setScrollPosition: vi.fn(),
  getVisibleRanges: vi.fn().mockReturnValue([]),
  getTopForLineNumber: vi.fn().mockReturnValue(0),
  getScrolledVisiblePosition: vi.fn().mockReturnValue({ left: 100, top: 50, height: 20 }),
  getConfiguration: vi.fn().mockReturnValue({
    fontInfo: { fontSize: 14, lineHeight: 20 },
  }),
  getLayoutInfo: vi.fn().mockReturnValue({
    width: 800,
    height: 600,
    contentWidth: 780,
    contentHeight: 580,
  }),
  dispose: vi.fn(),
});

export const createMockMonaco = () => ({
  editor: {
    create: vi.fn().mockReturnValue(createMockMonacoEditor()),
    createModel: vi.fn().mockReturnValue({
      getValue: vi.fn().mockReturnValue(""),
      setValue: vi.fn(),
      dispose: vi.fn(),
    }),
    defineTheme: vi.fn(),
    setTheme: vi.fn(),
    setModelLanguage: vi.fn(),
    TrackedRangeStickiness: {
      NeverGrowsWhenTypingAtEdges: 1,
      GrowsOnlyWhenTypingBefore: 2,
      GrowsOnlyWhenTypingAfter: 3,
      AlwaysGrowsWhenTypingAtEdges: 4,
    },
    MinimapPosition: { Inline: 1, Gutter: 2 },
    OverviewRulerLane: { Left: 1, Center: 2, Right: 4, Full: 7 },
    ScrollType: { Smooth: 0, Immediate: 1 },
    EndOfLineSequence: { LF: 0, CRLF: 1 },
    EndOfLinePreference: { TextDefined: 0, LF: 1, CRLF: 2 },
    EditorOption: {},
  },
  languages: {
    register: vi.fn(),
    registerCompletionItemProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerHoverProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerDefinitionProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerReferenceProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerSignatureHelpProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerDocumentHighlightProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerDocumentSymbolProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerCodeActionProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerCodeLensProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerDocumentFormattingEditProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerDocumentRangeFormattingEditProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerOnTypeFormattingEditProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerFoldingRangeProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerInlayHintsProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerLinkProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    setLanguageConfiguration: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    getLanguages: vi.fn().mockReturnValue([]),
    CompletionItemKind: {
      Method: 0, Function: 1, Constructor: 2, Field: 3, Variable: 4,
      Class: 5, Struct: 6, Interface: 7, Module: 8, Property: 9,
      Event: 10, Operator: 11, Unit: 12, Value: 13, Constant: 14,
      Enum: 15, EnumMember: 16, Keyword: 17, Text: 18, Color: 19,
      File: 20, Reference: 21, Customcolor: 22, Folder: 23, TypeParameter: 24,
      User: 25, Issue: 26, Snippet: 27,
    },
    CompletionItemInsertTextRule: { None: 0, InsertAsSnippet: 4 },
    SignatureHelpTriggerKind: { Invoke: 1, TriggerCharacter: 2, ContentChange: 3 },
    DocumentHighlightKind: { Text: 0, Read: 1, Write: 2 },
    SymbolKind: {
      File: 0, Module: 1, Namespace: 2, Package: 3, Class: 4,
      Method: 5, Property: 6, Field: 7, Constructor: 8, Enum: 9,
      Interface: 10, Function: 11, Variable: 12, Constant: 13, String: 14,
      Number: 15, Boolean: 16, Array: 17, Object: 18, Key: 19,
      Null: 20, EnumMember: 21, Struct: 22, Event: 23, Operator: 24,
      TypeParameter: 25,
    },
    FoldingRangeKind: { Comment: 1, Imports: 2, Region: 3 },
    InlayHintKind: { Type: 1, Parameter: 2 },
  },
  Range: vi.fn(function (this: Record<string, unknown>, startLine: number, startCol: number, endLine: number, endCol: number) {
    this.startLineNumber = startLine;
    this.startColumn = startCol;
    this.endLineNumber = endLine;
    this.endColumn = endCol;
    this.isEmpty = () => startLine === endLine && startCol === endCol;
    this.containsPosition = vi.fn().mockReturnValue(false);
    this.containsRange = vi.fn().mockReturnValue(false);
    this.strictContainsRange = vi.fn().mockReturnValue(false);
    this.plusRange = vi.fn();
    this.intersectRanges = vi.fn();
    this.equalsRange = vi.fn().mockReturnValue(false);
    this.getEndPosition = () => ({ lineNumber: endLine, column: endCol });
    this.getStartPosition = () => ({ lineNumber: startLine, column: startCol });
  }),
  Position: vi.fn(function (this: Record<string, unknown>, line: number, col: number) {
    this.lineNumber = line;
    this.column = col;
    this.equals = vi.fn().mockReturnValue(false);
    this.isBefore = vi.fn().mockReturnValue(false);
    this.isBeforeOrEqual = vi.fn().mockReturnValue(false);
  }),
  Selection: vi.fn(function (this: Record<string, unknown>, startLine: number, startCol: number, endLine: number, endCol: number) {
    this.startLineNumber = startLine;
    this.startColumn = startCol;
    this.endLineNumber = endLine;
    this.endColumn = endCol;
    this.selectionStartLineNumber = startLine;
    this.selectionStartColumn = startCol;
    this.positionLineNumber = endLine;
    this.positionColumn = endCol;
    this.isEmpty = () => startLine === endLine && startCol === endCol;
    this.getDirection = vi.fn().mockReturnValue(0);
  }),
  Uri: {
    parse: vi.fn().mockImplementation((str: string) => ({
      toString: () => str,
      fsPath: str.replace("file://", ""),
      scheme: "file",
      authority: "",
      path: str.replace("file://", ""),
      query: "",
      fragment: "",
    })),
    file: vi.fn().mockImplementation((path: string) => ({
      toString: () => `file://${path}`,
      fsPath: path,
      scheme: "file",
      authority: "",
      path: path,
      query: "",
      fragment: "",
    })),
  },
  KeyMod: { CtrlCmd: 2048, Shift: 1024, Alt: 512, WinCtrl: 256 },
  KeyCode: {
    Enter: 3, Escape: 9, Tab: 2, Backspace: 1,
    KeyA: 31, KeyC: 33, KeyF: 36, KeyH: 38, KeyV: 52, KeyX: 54, KeyZ: 56,
    F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65, F8: 66, F9: 67,
  },
  MarkerSeverity: { Hint: 1, Info: 2, Warning: 4, Error: 8 },
});

// ============================================================================
// Tauri API Mocks
// ============================================================================

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
  once: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(""),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
  message: vi.fn().mockResolvedValue(undefined),
  ask: vi.fn().mockResolvedValue(false),
  confirm: vi.fn().mockResolvedValue(false),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: vi.fn().mockResolvedValue("windows"),
  arch: vi.fn().mockResolvedValue("x86_64"),
  type: vi.fn().mockResolvedValue("Windows_NT"),
  version: vi.fn().mockResolvedValue("10.0.0"),
  hostname: vi.fn().mockResolvedValue("localhost"),
  locale: vi.fn().mockResolvedValue("en-US"),
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  Command: {
    create: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "" }),
      spawn: vi.fn().mockResolvedValue({ pid: 1234 }),
    }),
  },
  open: vi.fn().mockResolvedValue(undefined),
}));

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset DOM
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  
  // Add CSS variables for theming
  document.documentElement.style.cssText = `
    --jb-bg-panel: #2b2b2b;
    --jb-bg-popup: #3c3f41;
    --jb-text-primary: #bababa;
    --jb-text-secondary: #808080;
    --jb-border-default: #323232;
    --jb-accent-primary: #4a88c7;
    --jb-radius-md: 4px;
    --jb-shadow-popup: 0 2px 8px rgba(0,0,0,0.5);
  `;
});

afterEach(() => {
  // Cleanup any side effects
  vi.restoreAllMocks();
});

// ============================================================================
// Global Test Utilities
// ============================================================================

/**
 * Wait for a condition to be true
 */
export const waitFor = async (
  condition: () => boolean,
  timeout = 1000,
  interval = 50
): Promise<void> => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error("waitFor timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

/**
 * Wait for next tick (microtask queue flush)
 */
export const nextTick = (): Promise<void> => 
  new Promise((resolve) => queueMicrotask(resolve));

/**
 * Wait for a number of milliseconds
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a mock keyboard event
 */
export const createKeyboardEvent = (
  type: "keydown" | "keyup" | "keypress",
  options: Partial<KeyboardEventInit> = {}
): KeyboardEvent => {
  return new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    ...options,
  });
};

/**
 * Create a mock mouse event
 */
export const createMouseEvent = (
  type: string,
  options: Partial<MouseEventInit> = {}
): MouseEvent => {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    ...options,
  });
};

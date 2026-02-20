/**
 * @file notebooks.ts
 * @description Complete TypeScript types for the Notebook API
 * Compatible with VS Code Notebook API and Jupyter .ipynb format
 */

// ============================================================================
// Core Types & Enums
// ============================================================================

/**
 * Represents the kind of a notebook cell
 */
export enum NotebookCellKind {
  /** Markup/Markdown cell for documentation */
  Markup = 1,
  /** Code cell for executable code */
  Code = 2
}

/**
 * Cancellation token for async operations
 */
export interface CancellationToken {
  /** Is cancellation requested */
  isCancellationRequested: boolean;
  /** Event fired when cancellation is requested */
  onCancellationRequested: Event<void>;
}

/**
 * Generic event type
 */
export type Event<T> = (listener: (e: T) => void, thisArgs?: unknown, disposables?: Disposable[]) => Disposable;

/**
 * Disposable resource interface
 */
export interface Disposable {
  dispose(): void;
}

/**
 * URI representation for notebook documents
 */
export interface Uri {
  /** Scheme of the URI (e.g., 'file', 'untitled') */
  scheme: string;
  /** Authority component */
  authority: string;
  /** Path component */
  path: string;
  /** Query string */
  query: string;
  /** Fragment identifier */
  fragment: string;
  /** File system path */
  fsPath: string;
  /** String representation */
  toString(): string;
  /** Convert to JSON */
  toJSON(): unknown;
}

/**
 * Text document interface for cell content
 */
export interface TextDocument {
  /** URI of the document */
  uri: Uri;
  /** File name */
  fileName: string;
  /** Is the document untitled */
  isUntitled: boolean;
  /** Language identifier */
  languageId: string;
  /** Version number */
  version: number;
  /** Is the document dirty */
  isDirty: boolean;
  /** Is the document closed */
  isClosed: boolean;
  /** End of line sequence */
  eol: EndOfLine;
  /** Number of lines */
  lineCount: number;
  /** Get text content */
  getText(range?: Range): string;
  /** Get line at position */
  lineAt(line: number): TextLine;
  /** Get line at position */
  lineAt(position: Position): TextLine;
  /** Offset at position */
  offsetAt(position: Position): number;
  /** Position at offset */
  positionAt(offset: number): Position;
  /** Validate range */
  validateRange(range: Range): Range;
  /** Validate position */
  validatePosition(position: Position): Position;
  /** Get word range at position */
  getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
  /** Save document */
  save(): Promise<boolean>;
}

/**
 * End of line sequence
 */
export enum EndOfLine {
  LF = 1,
  CRLF = 2
}

/**
 * Position in a document
 */
export interface Position {
  readonly line: number;
  readonly character: number;
  isBefore(other: Position): boolean;
  isBeforeOrEqual(other: Position): boolean;
  isAfter(other: Position): boolean;
  isAfterOrEqual(other: Position): boolean;
  isEqual(other: Position): boolean;
  compareTo(other: Position): number;
  translate(lineDelta?: number, characterDelta?: number): Position;
  translate(change: { lineDelta?: number; characterDelta?: number }): Position;
  with(line?: number, character?: number): Position;
  with(change: { line?: number; character?: number }): Position;
}

/**
 * Range in a document
 */
export interface Range {
  readonly start: Position;
  readonly end: Position;
  readonly isEmpty: boolean;
  readonly isSingleLine: boolean;
  contains(positionOrRange: Position | Range): boolean;
  isEqual(other: Range): boolean;
  intersection(range: Range): Range | undefined;
  union(other: Range): Range;
  with(start?: Position, end?: Position): Range;
  with(change: { start?: Position; end?: Position }): Range;
}

/**
 * Text line interface
 */
export interface TextLine {
  readonly lineNumber: number;
  readonly text: string;
  readonly range: Range;
  readonly rangeIncludingLineBreak: Range;
  readonly firstNonWhitespaceCharacterIndex: number;
  readonly isEmptyOrWhitespace: boolean;
}

// ============================================================================
// Notebook Document Types
// ============================================================================

/**
 * Represents a notebook document
 */
export interface NotebookDocument {
  /** URI of the notebook */
  readonly uri: Uri;
  /** Type of the notebook (e.g., 'jupyter-notebook') */
  readonly notebookType: string;
  /** Version number, incremented on each change */
  readonly version: number;
  /** Whether the notebook has unsaved changes */
  readonly isDirty: boolean;
  /** Whether the notebook is untitled */
  readonly isUntitled: boolean;
  /** Whether the notebook is closed */
  readonly isClosed: boolean;
  /** Notebook metadata */
  readonly metadata: NotebookDocumentMetadata;
  /** Number of cells in the notebook */
  readonly cellCount: number;
  /** Get cells in range */
  getCells(range?: NotebookRange): NotebookCell[];
  /** Get cell at index */
  cellAt(index: number): NotebookCell;
  /** Save the notebook */
  save(): Promise<boolean>;
}

/**
 * Notebook document metadata
 */
export interface NotebookDocumentMetadata {
  /** Custom metadata */
  [key: string]: unknown;
}

// ============================================================================
// Notebook Cell Types
// ============================================================================

/**
 * Represents a cell in a notebook
 */
export interface NotebookCell {
  /** Index of the cell in the notebook */
  readonly index: number;
  /** Reference to the parent notebook */
  readonly notebook: NotebookDocument;
  /** Kind of the cell (Markup or Code) */
  readonly kind: NotebookCellKind;
  /** Text document containing the cell content */
  readonly document: TextDocument;
  /** Cell metadata */
  readonly metadata: NotebookCellMetadata;
  /** Cell outputs (readonly snapshot) */
  readonly outputs: readonly NotebookCellOutput[];
  /** Execution summary if cell was executed */
  readonly executionSummary?: NotebookCellExecutionSummary;
}

/**
 * Cell metadata
 */
export interface NotebookCellMetadata {
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Data structure for creating new cells
 */
export interface NotebookCellData {
  /** Kind of the cell */
  kind: NotebookCellKind;
  /** Cell content/source */
  value: string;
  /** Language identifier */
  languageId: string;
  /** Optional metadata */
  metadata?: NotebookCellMetadata;
  /** Optional outputs */
  outputs?: NotebookCellOutput[];
  /** Optional execution summary */
  executionSummary?: NotebookCellExecutionSummary;
}

// ============================================================================
// Notebook Cell Output Types
// ============================================================================

/**
 * Represents an output of a notebook cell
 */
export interface NotebookCellOutput {
  /** Unique identifier for the output */
  readonly id: string;
  /** Output items with different mime types */
  readonly items: NotebookCellOutputItem[];
  /** Output metadata */
  readonly metadata?: NotebookCellOutputMetadata;
}

/**
 * Output metadata
 */
export interface NotebookCellOutputMetadata {
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * A single output item with a specific mime type
 */
export interface NotebookCellOutputItem {
  /** MIME type of the output */
  readonly mime: string;
  /** Raw data as Uint8Array */
  readonly data: Uint8Array;
}

// Note: NotebookCellOutputItem factory methods should be implemented in a separate module
// or used via the createTextOutputItem/createJsonOutputItem functions below

/**
 * Execution summary for a cell
 */
export interface NotebookCellExecutionSummary {
  /** Execution order number */
  readonly executionOrder?: number;
  /** Whether execution was successful */
  readonly success?: boolean;
  /** Timing information */
  readonly timing?: NotebookCellExecutionTiming;
}

/**
 * Timing information for cell execution
 */
export interface NotebookCellExecutionTiming {
  /** Start time in milliseconds */
  readonly startTime: number;
  /** End time in milliseconds */
  readonly endTime: number;
}

// ============================================================================
// Notebook Range Types
// ============================================================================

/**
 * Represents a range of cells in a notebook
 */
export interface NotebookRange {
  /** Start index (inclusive) */
  readonly start: number;
  /** End index (exclusive) */
  readonly end: number;
  /** Whether the range is empty */
  readonly isEmpty: boolean;
  /** Create a new range with different start/end */
  with(change: { start?: number; end?: number }): NotebookRange;
}

/**
 * Constructor type for NotebookRange
 */
export interface NotebookRangeConstructor {
  new (start: number, end: number): NotebookRange;
}

// ============================================================================
// Notebook Controller (Kernel) Types
// ============================================================================

/**
 * Notebook controller (kernel) for executing cells
 */
export interface NotebookController {
  /** Unique identifier */
  readonly id: string;
  /** Type of notebooks this controller handles */
  readonly notebookType: string;
  /** Display label */
  label: string;
  /** Short description */
  description?: string;
  /** Detailed description */
  detail?: string;
  /** Whether controller supports execution order */
  supportsExecutionOrder?: boolean;
  /** Languages supported by this controller */
  supportedLanguages?: string[];
  /** Event fired when notebook selection changes */
  onDidChangeSelectedNotebooks: Event<NotebookControllerSelectionEvent>;
  /** Create an execution for a cell */
  createNotebookCellExecution(cell: NotebookCell): NotebookCellExecution;
  /** Interrupt handler (optional) */
  interruptHandler?: (notebook: NotebookDocument) => void | Promise<void>;
  /** Execute handler */
  executeHandler?: (
    cells: NotebookCell[],
    notebook: NotebookDocument,
    controller: NotebookController
  ) => void | Promise<void>;
  /** Dispose the controller */
  dispose(): void;
}

/**
 * Event for notebook controller selection changes
 */
export interface NotebookControllerSelectionEvent {
  /** The affected notebook */
  readonly notebook: NotebookDocument;
  /** Whether the controller is now selected */
  readonly selected: boolean;
}

/**
 * Options for creating a notebook controller
 */
export interface NotebookControllerOptions {
  /** Unique identifier */
  id: string;
  /** Type of notebooks */
  notebookType: string;
  /** Display label */
  label: string;
  /** Optional handler for execution */
  handler?: (
    cells: NotebookCell[],
    notebook: NotebookDocument,
    controller: NotebookController
  ) => void | Promise<void>;
}

// ============================================================================
// Notebook Cell Execution Types
// ============================================================================

/**
 * Represents an execution of a notebook cell
 */
export interface NotebookCellExecution {
  /** The cell being executed */
  readonly cell: NotebookCell;
  /** Cancellation token */
  readonly token: CancellationToken;
  /** Execution order number */
  executionOrder: number | undefined;
  /** Start the execution */
  start(startTime?: number): void;
  /** End the execution */
  end(success: boolean | undefined, endTime?: number): void;
  /** Clear all outputs */
  clearOutput(cell?: NotebookCell): Thenable<void>;
  /** Replace all outputs */
  replaceOutput(outputs: NotebookCellOutput | NotebookCellOutput[], cell?: NotebookCell): Thenable<void>;
  /** Append outputs */
  appendOutput(outputs: NotebookCellOutput | NotebookCellOutput[], cell?: NotebookCell): Thenable<void>;
  /** Replace items in a specific output */
  replaceOutputItems(items: NotebookCellOutputItem | NotebookCellOutputItem[], outputId: string): Thenable<void>;
  /** Append items to a specific output */
  appendOutputItems(items: NotebookCellOutputItem | NotebookCellOutputItem[], outputId: string): Thenable<void>;
}

/**
 * Thenable type for async operations
 */
export type Thenable<T> = PromiseLike<T>;

// ============================================================================
// Notebook Edit Types
// ============================================================================

/**
 * Edit operations for notebooks
 */
export interface NotebookEdit {
  /** Range of cells to replace */
  readonly range: NotebookRange;
  /** New cells to insert */
  readonly newCells: NotebookCellData[];
  /** New cell metadata (if editing metadata) */
  readonly newCellMetadata?: NotebookCellMetadata;
  /** New notebook metadata (if editing notebook metadata) */
  readonly newNotebookMetadata?: NotebookDocumentMetadata;
}

// Note: NotebookEdit factory methods should be implemented in a separate module

// ============================================================================
// Notebook Serializer Types
// ============================================================================

/**
 * Serializer for reading and writing notebook files
 */
export interface NotebookSerializer {
  /** Deserialize bytes to notebook data */
  deserializeNotebook(content: Uint8Array, token: CancellationToken): Thenable<NotebookData> | NotebookData;
  /** Serialize notebook data to bytes */
  serializeNotebook(data: NotebookData, token: CancellationToken): Thenable<Uint8Array> | Uint8Array;
}

/**
 * Options for notebook serializer
 */
export interface NotebookSerializerOptions {
  /** Transient output options */
  transientOutputs?: boolean;
  /** Transient cell metadata keys */
  transientCellMetadata?: { [key: string]: boolean };
  /** Transient document metadata keys */
  transientDocumentMetadata?: { [key: string]: boolean };
}

/**
 * Complete notebook data structure
 */
export interface NotebookData {
  /** Array of cell data */
  cells: NotebookCellData[];
  /** Notebook metadata */
  metadata?: NotebookDocumentMetadata;
}

// ============================================================================
// Notebook Editor Types
// ============================================================================

/**
 * Notebook editor for displaying notebooks
 */
export interface NotebookEditor {
  /** The notebook being edited */
  readonly notebook: NotebookDocument;
  /** Selected cell ranges */
  readonly selections: NotebookRange[];
  /** Visible cell ranges */
  readonly visibleRanges: readonly NotebookRange[];
  /** View column */
  readonly viewColumn?: ViewColumn;
  /** Reveal a cell range */
  revealRange(range: NotebookRange, revealType?: NotebookEditorRevealType): void;
  /** Set selections */
  setDecorations(decorationType: NotebookEditorDecorationType, range: NotebookRange): void;
}

/**
 * View column for editors
 */
export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9
}

/**
 * How to reveal a range in the editor
 */
export enum NotebookEditorRevealType {
  /** Reveal at top */
  AtTop = 0,
  /** Reveal in center */
  InCenter = 1,
  /** Reveal in center if outside viewport */
  InCenterIfOutsideViewport = 2,
  /** Reveal at default position */
  Default = 3
}

/**
 * Decoration type for notebook editor
 */
export interface NotebookEditorDecorationType {
  /** Unique key */
  readonly key: string;
  /** Dispose the decoration */
  dispose(): void;
}

// ============================================================================
// Notebook Document Content Change Types
// ============================================================================

/**
 * Event describing changes to a notebook
 */
export interface NotebookDocumentChangeEvent {
  /** The affected notebook */
  readonly notebook: NotebookDocument;
  /** Changed metadata */
  readonly metadata?: NotebookDocumentMetadata;
  /** Content changes */
  readonly contentChanges: readonly NotebookDocumentContentChange[];
  /** Cell changes */
  readonly cellChanges: readonly NotebookDocumentCellChange[];
}

/**
 * Content change in a notebook
 */
export interface NotebookDocumentContentChange {
  /** Range of removed cells */
  readonly range: NotebookRange;
  /** Removed cells */
  readonly removedCells: readonly NotebookCell[];
  /** Added cells */
  readonly addedCells: readonly NotebookCell[];
}

/**
 * Cell-level change in a notebook
 */
export interface NotebookDocumentCellChange {
  /** The changed cell */
  readonly cell: NotebookCell;
  /** Document changes */
  readonly document?: TextDocument;
  /** Metadata changes */
  readonly metadata?: NotebookCellMetadata;
  /** Output changes */
  readonly outputs?: readonly NotebookCellOutput[];
  /** Execution summary changes */
  readonly executionSummary?: NotebookCellExecutionSummary;
}

// ============================================================================
// Notebook Workspace Edit Types
// ============================================================================

/**
 * Workspace edit with notebook changes
 */
export interface WorkspaceEdit {
  /** Set notebook edit */
  set(uri: Uri, edits: NotebookEdit[]): void;
  /** Get notebook edits */
  get(uri: Uri): NotebookEdit[];
  /** Has edits for URI */
  has(uri: Uri): boolean;
  /** Delete edits for URI */
  delete(uri: Uri, range?: Range): void;
  /** Insert text */
  insert(uri: Uri, position: Position, newText: string): void;
  /** Replace text */
  replace(uri: Uri, range: Range, newText: string): void;
  /** Size of edits */
  readonly size: number;
  /** All entries */
  entries(): [Uri, (NotebookEdit | TextEdit)[]][];
}

/**
 * Text edit
 */
export interface TextEdit {
  /** Range to replace */
  range: Range;
  /** New text */
  newText: string;
}

// ============================================================================
// Notebook Kernel Message Types (for communication)
// ============================================================================

/**
 * Message sent to/from notebook kernel
 */
export interface NotebookKernelMessage {
  /** Message type */
  type: NotebookKernelMessageType;
  /** Message ID */
  id: string;
  /** Payload data */
  payload: unknown;
}

/**
 * Types of kernel messages
 */
export enum NotebookKernelMessageType {
  /** Execute code request */
  ExecuteRequest = 'execute_request',
  /** Execute result */
  ExecuteResult = 'execute_result',
  /** Stream output (stdout/stderr) */
  Stream = 'stream',
  /** Display data */
  DisplayData = 'display_data',
  /** Error output */
  Error = 'error',
  /** Kernel status change */
  Status = 'status',
  /** Interrupt request */
  InterruptRequest = 'interrupt_request',
  /** Shutdown request */
  ShutdownRequest = 'shutdown_request',
  /** Complete request (autocomplete) */
  CompleteRequest = 'complete_request',
  /** Complete reply */
  CompleteReply = 'complete_reply',
  /** Inspect request */
  InspectRequest = 'inspect_request',
  /** Inspect reply */
  InspectReply = 'inspect_reply'
}

/**
 * Kernel execution state
 */
export type NotebookKernelStatus = 'idle' | 'busy' | 'starting' | 'restarting' | 'disconnected' | 'error';

// ============================================================================
// Notebook Rendering Types
// ============================================================================

/**
 * Renderer for notebook outputs
 */
export interface NotebookRenderer {
  /** Unique identifier */
  readonly id: string;
  /** Renderer entry point */
  readonly entrypoint: Uri;
  /** Mime types handled */
  readonly mimeTypes: readonly string[];
  /** Dependencies on other renderers */
  readonly dependencies?: readonly string[];
}

/**
 * API available to notebook renderers
 */
export interface NotebookRendererApi<T = void> {
  /** State associated with the renderer */
  readonly state: T;
  /** Update state */
  setState(state: T): void;
  /** Post message to extension */
  postMessage(message: unknown): void;
  /** Event for messages from extension */
  onDidReceiveMessage: Event<unknown>;
}

/**
 * Context for rendering output
 */
export interface NotebookRendererContext<T = void> {
  /** Renderer API */
  readonly api: NotebookRendererApi<T>;
  /** The output being rendered */
  readonly output: NotebookCellOutput;
  /** The MIME type being rendered */
  readonly mimeType: string;
  /** The element to render into */
  readonly element: HTMLElement;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Create a new NotebookCellOutput
 */
export function createNotebookCellOutput(
  items: NotebookCellOutputItem[],
  id?: string,
  metadata?: NotebookCellOutputMetadata
): NotebookCellOutput {
  return {
    id: id ?? generateOutputId(),
    items,
    metadata
  };
}

/**
 * Create a new NotebookCellOutputItem from text
 */
export function createTextOutputItem(text: string, mime: string = 'text/plain'): NotebookCellOutputItem {
  return {
    mime,
    data: new TextEncoder().encode(text)
  };
}

/**
 * Create a new NotebookCellOutputItem from JSON
 */
export function createJsonOutputItem(value: unknown, mime: string = 'application/json'): NotebookCellOutputItem {
  return {
    mime,
    data: new TextEncoder().encode(JSON.stringify(value))
  };
}

/**
 * Generate a unique output ID
 */
function generateOutputId(): string {
  return `output-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a NotebookRange
 */
export function createNotebookRange(start: number, end: number): NotebookRange {
  return {
    start,
    end,
    isEmpty: start >= end,
    with(change: { start?: number; end?: number }): NotebookRange {
      return createNotebookRange(
        change.start ?? this.start,
        change.end ?? this.end
      );
    }
  };
}

/**
 * Create a NotebookCellData
 */
export function createNotebookCellData(
  kind: NotebookCellKind,
  value: string,
  languageId: string,
  metadata?: NotebookCellMetadata,
  outputs?: NotebookCellOutput[],
  executionSummary?: NotebookCellExecutionSummary
): NotebookCellData {
  return {
    kind,
    value,
    languageId,
    metadata,
    outputs,
    executionSummary
  };
}

/**
 * Create empty NotebookData
 */
export function createEmptyNotebookData(metadata?: NotebookDocumentMetadata): NotebookData {
  return {
    cells: [],
    metadata
  };
}



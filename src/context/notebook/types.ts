import type { Accessor, Setter } from "solid-js";

export type CellType = "code" | "markdown" | "raw";
export type KernelStatus = "idle" | "busy" | "disconnected" | "starting" | "restarting" | "error";
export type KernelLanguage = "python" | "javascript" | "typescript";
export type OutputType = "stream" | "execute_result" | "display_data" | "error";
export type StreamName = "stdout" | "stderr";

export interface NotebookMetadata {
  kernelspec?: {
    name: string;
    display_name: string;
    language: string;
  };
  language_info?: {
    name: string;
    version?: string;
    mimetype?: string;
    file_extension?: string;
  };
  title?: string;
  authors?: string[];
  created?: string;
  modified?: string;
}

export interface CellMetadata {
  collapsed?: boolean;
  scrolled?: boolean | "auto";
  tags?: string[];
  trusted?: boolean;
  editable?: boolean;
  deletable?: boolean;
  name?: string;
}

export interface StreamOutput {
  output_type: "stream";
  name: StreamName;
  text: string;
}

export interface ExecuteResultOutput {
  output_type: "execute_result";
  execution_count: number;
  data: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface DisplayDataOutput {
  output_type: "display_data";
  data: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ErrorOutput {
  output_type: "error";
  ename: string;
  evalue: string;
  traceback: string[];
}

export type CellOutput = StreamOutput | ExecuteResultOutput | DisplayDataOutput | ErrorOutput;

export interface NotebookCell {
  id: string;
  cell_type: CellType;
  source: string;
  metadata: CellMetadata;
  outputs: CellOutput[];
  execution_count: number | null;
}

export interface JupyterNotebook {
  metadata: NotebookMetadata;
  nbformat: number;
  nbformat_minor: number;
  cells: NotebookCell[];
}

export interface NotebookData {
  path: string;
  name: string;
  notebook: JupyterNotebook;
  modified: boolean;
  kernelId: string | null;
  lastSaved: number | null;
}

export interface ExecutionQueueItem {
  notebookPath: string;
  cellId: string;
  status: "pending" | "executing";
  queuedAt: number;
}

export interface KernelInfo {
  id: string;
  language: KernelLanguage;
  status: KernelStatus;
  executionCount: number;
  displayName: string;
}

export interface KernelEvent {
  event: "status" | "output" | "result" | "error" | "interrupt";
  data: {
    kernel_id: string;
    cell_id?: string;
    notebook_path?: string;
    status?: KernelStatus;
    output?: CellOutput;
    execution_count?: number;
    error?: string;
  };
}

export interface NotebookState {
  notebooks: Record<string, NotebookData>;
  activeNotebookPath: string | null;
  activeCellId: string | null;
  kernels: Record<string, KernelInfo>;
  executionQueue: ExecutionQueueItem[];
  isLoading: boolean;
  error: string | null;
}

export interface DragState {
  draggedIndex: Accessor<number | null>;
  dragOverIndex: Accessor<number | null>;
  setDraggedIndex: Setter<number | null>;
  setDragOverIndex: Setter<number | null>;
}

export interface CollapseState {
  collapsedCells: Accessor<Record<string, boolean>>;
  toggleCellCollapse: (cellId: string) => void;
}

export interface NotebookContextValue {
  state: NotebookState;

  openNotebook: (path: string) => Promise<void>;
  saveNotebook: (path?: string) => Promise<void>;
  closeNotebook: (path: string) => void;
  createNotebook: (path: string, language?: KernelLanguage) => Promise<void>;

  addCell: (type: CellType, afterIndex?: number) => void;
  deleteCell: (index: number) => void;
  moveCell: (fromIndex: number, toIndex: number) => void;
  updateCellSource: (cellId: string, source: string) => void;
  changeCellType: (index: number, type: CellType) => void;
  duplicateCell: (index: number) => void;
  mergeCells: (startIndex: number, endIndex: number) => void;
  splitCell: (index: number, splitPosition: number) => void;

  setActiveNotebook: (path: string | null) => void;
  setActiveCell: (cellId: string | null) => void;
  selectNextCell: () => void;
  selectPreviousCell: () => void;

  executeCell: (index: number) => Promise<void>;
  executeAllCells: () => Promise<void>;
  executeCellsAbove: (index: number) => Promise<void>;
  executeCellsBelow: (index: number) => Promise<void>;

  startKernel: (language: KernelLanguage) => Promise<KernelInfo>;
  interruptKernel: () => Promise<void>;
  restartKernel: (executeAll?: boolean) => Promise<void>;
  changeKernel: (language: KernelLanguage) => Promise<void>;
  getKernelStatus: () => KernelStatus;
  listKernels: () => Promise<KernelInfo[]>;

  clearOutputs: () => void;
  clearCellOutput: (cellId: string) => void;

  getActiveNotebook: () => NotebookData | null;
  getActiveCell: () => NotebookCell | null;
  getCellByIndex: (index: number) => NotebookCell | null;
  getCellIndex: (cellId: string) => number;
  isExecuting: () => boolean;
  exportToScript: () => string;
  exportToHtml: (path?: string) => Promise<string>;
  exportToPython: (path?: string) => Promise<string>;
  exportToPdf: (path?: string) => Promise<string>;

  dragState: DragState;
  collapsedCells: Accessor<Record<string, boolean>>;
  toggleCellCollapse: (cellId: string) => void;
}

import { createContext, useContext, ParentComponent, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { createLogger } from "../utils/logger";

const replLogger = createLogger("REPL");

// Types matching Rust backend
export type KernelStatus = "starting" | "idle" | "busy" | "restarting" | "shuttingdown" | "shutdown" | "error";
export type KernelType = "python" | "node" | "jupyter";
export type OutputType = "stdout" | "stderr" | "result" | "error" | "display";
export type CellStatus = "pending" | "running" | "success" | "error";

export interface KernelSpec {
  id: string;
  name: string;
  display_name: string;
  language: string;
  kernel_type: KernelType;
  executable: string | null;
}

export interface KernelInfo {
  id: string;
  spec: KernelSpec;
  status: KernelStatus;
  execution_count: number;
}

export interface OutputContent {
  type: "text" | "html" | "image" | "json" | "error";
  data: string | { name: string; message: string; traceback: string[] } | Record<string, unknown>;
}

export interface CellOutput {
  output_type: OutputType;
  content: OutputContent;
  timestamp: number;
}

export interface Cell {
  id: string;
  input: string;
  outputs: CellOutput[];
  execution_count: number | null;
  status: CellStatus;
  created_at: number;
  executed_at: number | null;
}

export interface Variable {
  name: string;
  value_type: string;
  value_repr: string;
  is_function: boolean;
  is_module: boolean;
  timestamp?: number;
}

// Local variable tracked from REPL input
export interface TrackedVariable {
  name: string;
  value: unknown;
  valueType: string;
  valueRepr: string;
  timestamp: number;
  isObject: boolean;
  isArray: boolean;
  isFunction: boolean;
  children?: TrackedVariable[];
}

// Maximum number of locally tracked variables to keep
const MAX_TRACKED_VARIABLES = 50;

interface KernelEvent {
  event: "status" | "output" | "result" | "error" | "variables";
  data: {
    kernel_id: string;
    cell_id?: string;
    status?: KernelStatus;
    output?: CellOutput;
    result?: {
      cell_id: string;
      execution_count: number;
      status: CellStatus;
      outputs: CellOutput[];
    };
    error?: string;
    variables?: Variable[];
  };
}

interface REPLState {
  kernelSpecs: KernelSpec[];
  kernels: KernelInfo[];
  activeKernelId: string | null;
  cells: Cell[];
  activeCellId: string | null;
  variables: Variable[];
  trackedVariables: TrackedVariable[];
  showPanel: boolean;
  showVariableInspector: boolean;
  isLoading: boolean;
  error: string | null;
}

interface REPLContextValue {
  state: REPLState;
  // Kernel management
  loadKernelSpecs: () => Promise<void>;
  startKernel: (specId: string) => Promise<KernelInfo>;
  stopKernel: (kernelId: string) => Promise<void>;
  restartKernel: (kernelId: string) => Promise<KernelInfo>;
  interruptKernel: (kernelId: string) => Promise<void>;
  setActiveKernel: (kernelId: string | null) => void;
  // Cell management
  addCell: (input?: string) => Cell;
  updateCell: (cellId: string, updates: Partial<Cell>) => void;
  deleteCell: (cellId: string) => void;
  executeCell: (cellId: string) => Promise<void>;
  executeAllCells: () => Promise<void>;
  clearCellOutput: (cellId: string) => void;
  clearAllOutputs: () => void;
  setActiveCell: (cellId: string | null) => void;
  // Variable management
  trackVariable: (name: string, value: unknown) => void;
  clearVariables: () => void;
  copyVariableToClipboard: (variable: Variable | TrackedVariable) => Promise<void>;
  inspectVariable: (variable: Variable | TrackedVariable) => void;
  // UI controls
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  toggleVariableInspector: () => void;
  // Error management
  clearError: () => void;
  // Export
  exportToNotebook: () => Promise<string>;
  // Run selection from editor
  executeSelection: (code: string) => Promise<void>;
}

const REPLContext = createContext<REPLContextValue>();

function generateCellId(): string {
  return `cell_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const REPLProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<REPLState>({
    kernelSpecs: [],
    kernels: [],
    activeKernelId: null,
    cells: [],
    activeCellId: null,
    variables: [],
    trackedVariables: [],
    showPanel: false,
    showVariableInspector: false,
    isLoading: false,
    error: null,
  });

  let eventUnlisten: UnlistenFn | null = null;

  // Handle kernel events from backend
  const handleKernelEvent = (event: KernelEvent) => {
    switch (event.event) {
      case "status":
        setState(produce((s) => {
          const kernel = s.kernels.find(k => k.id === event.data.kernel_id);
          if (kernel && event.data.status) {
            kernel.status = event.data.status;
          }
        }));
        break;
      
      case "output":
        if (event.data.cell_id && event.data.output) {
          setState(produce((s) => {
            const cell = s.cells.find(c => c.id === event.data.cell_id);
            if (cell) {
              cell.outputs.push(event.data.output!);
            }
          }));
        }
        break;
      
      case "result":
        if (event.data.result) {
          const result = event.data.result;
          setState(produce((s) => {
            const cell = s.cells.find(c => c.id === result.cell_id);
            if (cell) {
              cell.status = result.status;
              cell.execution_count = result.execution_count;
              cell.executed_at = Date.now();
              cell.outputs = [...cell.outputs, ...result.outputs];
            }
          }));
        }
        break;
      
      case "error":
        setState("error", event.data.error || "Unknown error");
        if (event.data.cell_id) {
          setState(produce((s) => {
            const cell = s.cells.find(c => c.id === event.data.cell_id);
            if (cell) {
              cell.status = "error";
            }
          }));
        }
        break;
      
      case "variables":
        if (event.data.variables) {
          setState("variables", event.data.variables);
        }
        break;
    }
  };

  // Register cleanup synchronously
  onCleanup(() => {
    if (eventUnlisten) {
      eventUnlisten();
    }
  });

  onMount(async () => {
    try {
      // Listen for kernel events
      eventUnlisten = await listen<KernelEvent>("repl:event", (e) => {
        handleKernelEvent(e.payload);
      });

      // Load kernel specs
      await loadKernelSpecs();
    } catch (e) {
      console.error("[REPL] Initialization failed:", e);
    }
  });

  const loadKernelSpecs = async () => {
    setState("isLoading", true);
    try {
      const specs = await invoke<KernelSpec[]>("repl_list_kernel_specs");
      setState("kernelSpecs", specs);
      setState("error", null);
    } catch (e) {
      console.error("[REPL] Failed to load kernel specs:", e);
      setState("error", String(e));
    } finally {
      setState("isLoading", false);
    }
  };

  const startKernel = async (specId: string): Promise<KernelInfo> => {
    setState("isLoading", true);
    try {
      const kernel = await invoke<KernelInfo>("repl_start_kernel", { specId });
      setState(produce((s) => {
        s.kernels.push(kernel);
        s.activeKernelId = kernel.id;
        s.error = null;
      }));
      return kernel;
    } catch (e) {
      console.error("[REPL] Failed to start kernel:", e);
      setState("error", String(e));
      throw e;
    } finally {
      setState("isLoading", false);
    }
  };

  const stopKernel = async (kernelId: string): Promise<void> => {
    try {
      await invoke("repl_shutdown_kernel", { kernelId });
      setState(produce((s) => {
        s.kernels = s.kernels.filter(k => k.id !== kernelId);
        if (s.activeKernelId === kernelId) {
          s.activeKernelId = s.kernels.length > 0 ? s.kernels[0].id : null;
        }
      }));
    } catch (e) {
      console.error("[REPL] Failed to stop kernel:", e);
      setState("error", String(e));
      throw e;
    }
  };

  const restartKernel = async (kernelId: string): Promise<KernelInfo> => {
    try {
      const kernel = await invoke<KernelInfo>("repl_restart_kernel", { kernelId });
      setState(produce((s) => {
        const idx = s.kernels.findIndex(k => k.id === kernelId);
        if (idx !== -1) {
          s.kernels[idx] = kernel;
        }
        // Clear all outputs on restart
        s.cells.forEach(cell => {
          cell.outputs = [];
          cell.status = "pending";
          cell.execution_count = null;
        });
      }));
      return kernel;
    } catch (e) {
      console.error("[REPL] Failed to restart kernel:", e);
      setState("error", String(e));
      throw e;
    }
  };

  const interruptKernel = async (kernelId: string): Promise<void> => {
    try {
      await invoke("repl_interrupt", { kernelId });
    } catch (e) {
      console.error("[REPL] Failed to interrupt kernel:", e);
      setState("error", String(e));
      throw e;
    }
  };

  const setActiveKernel = (kernelId: string | null) => {
    setState("activeKernelId", kernelId);
  };

  const addCell = (input = ""): Cell => {
    const cell: Cell = {
      id: generateCellId(),
      input,
      outputs: [],
      execution_count: null,
      status: "pending",
      created_at: Date.now(),
      executed_at: null,
    };
    setState(produce((s) => {
      s.cells.push(cell);
      s.activeCellId = cell.id;
    }));
    return cell;
  };

  const updateCell = (cellId: string, updates: Partial<Cell>) => {
    setState(produce((s) => {
      const cell = s.cells.find(c => c.id === cellId);
      if (cell) {
        Object.assign(cell, updates);
      }
    }));
  };

  const deleteCell = (cellId: string) => {
    setState(produce((s) => {
      const idx = s.cells.findIndex(c => c.id === cellId);
      if (idx !== -1) {
        s.cells.splice(idx, 1);
        if (s.activeCellId === cellId) {
          s.activeCellId = s.cells.length > 0 
            ? s.cells[Math.max(0, idx - 1)].id 
            : null;
        }
      }
    }));
  };

  const executeCell = async (cellId: string): Promise<void> => {
    const cell = state.cells.find(c => c.id === cellId);
    if (!cell || !state.activeKernelId) {
      if (!state.activeKernelId) {
        setState("error", "No active kernel. Please start a kernel first.");
      }
      return;
    }

    // Clear previous outputs and set status
    setState(produce((s) => {
      const c = s.cells.find(c => c.id === cellId);
      if (c) {
        c.outputs = [];
        c.status = "running";
      }
    }));

    try {
      const executionCount = await invoke<number>("repl_execute", {
        kernelId: state.activeKernelId,
        code: cell.input,
        cellId: cell.id,
      });
      
      setState(produce((s) => {
        const c = s.cells.find(c => c.id === cellId);
        if (c) {
          c.execution_count = executionCount;
        }
      }));
    } catch (e) {
      console.error("[REPL] Failed to execute cell:", e);
      setState(produce((s) => {
        const c = s.cells.find(c => c.id === cellId);
        if (c) {
          c.status = "error";
          c.outputs.push({
            output_type: "error",
            content: { type: "text", data: String(e) },
            timestamp: Date.now(),
          });
        }
      }));
    }
  };

  const executeAllCells = async (): Promise<void> => {
    for (const cell of state.cells) {
      await executeCell(cell.id);
    }
  };

  const clearCellOutput = (cellId: string) => {
    setState(produce((s) => {
      const cell = s.cells.find(c => c.id === cellId);
      if (cell) {
        cell.outputs = [];
        cell.status = "pending";
        cell.execution_count = null;
      }
    }));
  };

  const clearAllOutputs = () => {
    setState(produce((s) => {
      s.cells.forEach(cell => {
        cell.outputs = [];
        cell.status = "pending";
        cell.execution_count = null;
      });
    }));
  };

  const setActiveCell = (cellId: string | null) => {
    setState("activeCellId", cellId);
  };

  // Helper to determine JavaScript type information
  const getTypeInfo = (value: unknown): { type: string; isObject: boolean; isArray: boolean; isFunction: boolean } => {
    if (value === null) return { type: "null", isObject: false, isArray: false, isFunction: false };
    if (value === undefined) return { type: "undefined", isObject: false, isArray: false, isFunction: false };
    if (Array.isArray(value)) return { type: `Array(${value.length})`, isObject: false, isArray: true, isFunction: false };
    if (typeof value === "function") return { type: "function", isObject: false, isArray: false, isFunction: true };
    if (typeof value === "object") {
      const constructorName = value.constructor?.name || "Object";
      return { type: constructorName, isObject: true, isArray: false, isFunction: false };
    }
    return { type: typeof value, isObject: false, isArray: false, isFunction: false };
  };

  // Helper to create a string representation of a value
  const getValueRepr = (value: unknown, maxLength = 200): string => {
    try {
      if (value === null) return "null";
      if (value === undefined) return "undefined";
      if (typeof value === "function") {
        const fnStr = value.toString();
        return fnStr.length > maxLength ? fnStr.slice(0, maxLength) + "..." : fnStr;
      }
      if (typeof value === "string") return JSON.stringify(value);
      if (typeof value === "object") {
        const str = JSON.stringify(value, null, 2);
        return str.length > maxLength ? str.slice(0, maxLength) + "..." : str;
      }
      return String(value);
    } catch (err) {
      console.debug("[REPL] Value representation failed:", err);
      return "[Unable to represent value]";
    }
  };

  // Build tree structure for nested objects/arrays
  const buildVariableTree = (name: string, value: unknown, depth = 0, maxDepth = 3): TrackedVariable => {
    const typeInfo = getTypeInfo(value);
    const result: TrackedVariable = {
      name,
      value,
      valueType: typeInfo.type,
      valueRepr: getValueRepr(value),
      timestamp: Date.now(),
      isObject: typeInfo.isObject,
      isArray: typeInfo.isArray,
      isFunction: typeInfo.isFunction,
    };

    if (depth < maxDepth && (typeInfo.isObject || typeInfo.isArray) && value !== null) {
      const children: TrackedVariable[] = [];
      if (typeInfo.isArray && Array.isArray(value)) {
        value.slice(0, 100).forEach((item, index) => {
          children.push(buildVariableTree(`[${index}]`, item, depth + 1, maxDepth));
        });
        if (value.length > 100) {
          children.push({
            name: `[...${value.length - 100} more items]`,
            value: undefined,
            valueType: "truncated",
            valueRepr: "...",
            timestamp: Date.now(),
            isObject: false,
            isArray: false,
            isFunction: false,
          });
        }
      } else if (typeInfo.isObject && typeof value === "object" && value !== null) {
        const entries = Object.entries(value as Record<string, unknown>);
        entries.slice(0, 100).forEach(([key, val]) => {
          children.push(buildVariableTree(key, val, depth + 1, maxDepth));
        });
        if (entries.length > 100) {
          children.push({
            name: `...${entries.length - 100} more properties`,
            value: undefined,
            valueType: "truncated",
            valueRepr: "...",
            timestamp: Date.now(),
            isObject: false,
            isArray: false,
            isFunction: false,
          });
        }
      }
      if (children.length > 0) {
        result.children = children;
      }
    }

    return result;
  };

  const trackVariable = (name: string, value: unknown): void => {
    const trackedVar = buildVariableTree(name, value);
    
    setState(produce((s) => {
      // Check if variable already exists - update it
      const existingIndex = s.trackedVariables.findIndex(v => v.name === name);
      if (existingIndex !== -1) {
        s.trackedVariables[existingIndex] = trackedVar;
      } else {
        // Add new variable
        s.trackedVariables.push(trackedVar);
        // Keep only the last N variables
        if (s.trackedVariables.length > MAX_TRACKED_VARIABLES) {
          s.trackedVariables = s.trackedVariables.slice(-MAX_TRACKED_VARIABLES);
        }
      }
    }));
  };

  const clearVariables = (): void => {
    setState(produce((s) => {
      s.variables = [];
      s.trackedVariables = [];
    }));
  };

  const copyVariableToClipboard = async (variable: Variable | TrackedVariable): Promise<void> => {
    try {
      const textToCopy = "value_repr" in variable 
        ? variable.value_repr 
        : variable.valueRepr;
      await navigator.clipboard.writeText(textToCopy);
    } catch (e) {
      console.error("[REPL] Failed to copy to clipboard:", e);
      setState("error", "Failed to copy to clipboard");
    }
  };

  const inspectVariable = (variable: Variable | TrackedVariable): void => {
    // Log to console for inspection
    if ("value" in variable) {
      replLogger.debug(`Inspect ${variable.name}:`, variable.value);
    } else {
      replLogger.debug(`Inspect ${variable.name}:`, variable.value_repr);
    }
    
    // Also show in variable inspector if not already open
    if (!state.showVariableInspector) {
      setState("showVariableInspector", true);
    }
  };

  const togglePanel = () => {
    setState("showPanel", !state.showPanel);
  };

  const openPanel = () => {
    setState("showPanel", true);
  };

  const closePanel = () => {
    setState("showPanel", false);
  };

  const toggleVariableInspector = () => {
    setState("showVariableInspector", !state.showVariableInspector);
  };

  const clearError = () => {
    setState("error", null);
  };

  const exportToNotebook = async (): Promise<string> => {
    const notebook = {
      metadata: {
        kernelspec: state.activeKernelId 
          ? state.kernels.find(k => k.id === state.activeKernelId)?.spec 
          : null,
        created_at: Date.now(),
      },
      cells: state.cells.map(cell => ({
        cell_type: "code",
        source: cell.input,
        outputs: cell.outputs.map(output => ({
          output_type: output.output_type === "stdout" ? "stream" : 
                       output.output_type === "result" ? "execute_result" :
                       output.output_type === "error" ? "error" : "display_data",
          name: output.output_type === "stdout" ? "stdout" : 
                output.output_type === "stderr" ? "stderr" : undefined,
          data: output.content,
        })),
        execution_count: cell.execution_count,
      })),
      nbformat: 4,
      nbformat_minor: 5,
    };
    return JSON.stringify(notebook, null, 2);
  };

  const executeSelection = async (code: string): Promise<void> => {
    if (!state.activeKernelId) {
      setState("error", "No active kernel. Please start a kernel first.");
      openPanel();
      return;
    }

    // Create a temporary cell for the selection
    const cell = addCell(code);
    openPanel();
    await executeCell(cell.id);
  };

  return (
    <REPLContext.Provider
      value={{
        state,
        loadKernelSpecs,
        startKernel,
        stopKernel,
        restartKernel,
        interruptKernel,
        setActiveKernel,
        addCell,
        updateCell,
        deleteCell,
        executeCell,
        executeAllCells,
        clearCellOutput,
        clearAllOutputs,
        setActiveCell,
        trackVariable,
        clearVariables,
        copyVariableToClipboard,
        inspectVariable,
        togglePanel,
        openPanel,
        closePanel,
        toggleVariableInspector,
        clearError,
        exportToNotebook,
        executeSelection,
      }}
    >
      {props.children}
    </REPLContext.Provider>
  );
};

export function useREPL() {
  const ctx = useContext(REPLContext);
  if (!ctx) throw new Error("useREPL must be used within REPLProvider");
  return ctx;
}

import { createContext, useContext, ParentComponent, onMount, onCleanup, batch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { getWsUrl } from "@/utils/config";
import type { KernelLanguage, KernelEvent, NotebookData, NotebookCell, NotebookState, NotebookContextValue } from "./types";
import { createCellManager, createDragState, createCollapseState } from "./CellManager";
import { createKernelManager } from "./KernelManager";
import { createOutputManager } from "./OutputRenderer";
import { createDefaultNotebook, parseNotebookFile, serializeNotebook, getNotebookNameFromPath } from "./utils";

export { createDragState, createCollapseState, createCellManager } from "./CellManager";
export { createKernelManager, generateKernelId } from "./KernelManager";
export { createOutputManager } from "./OutputRenderer";
export * from "./types";

const NotebookContext = createContext<NotebookContextValue>();

export const NotebookProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<NotebookState>({
    notebooks: {}, activeNotebookPath: null, activeCellId: null,
    kernels: {}, executionQueue: [], isLoading: false, error: null,
  });

  let eventUnlisten: UnlistenFn | null = null;
  const wsRef = { current: null as WebSocket | null };
  const cellManager = createCellManager(state, setState);
  const dragState = createDragState();
  const { collapsedCells, toggleCellCollapse } = createCollapseState();
  const outputManager = createOutputManager(state, setState);

  const setupWs = (kernelId: string): Promise<WebSocket> => new Promise((resolve, reject) => {
    const ws = new WebSocket(getWsUrl(`/kernel/${kernelId}/ws`));
    ws.onopen = () => { wsRef.current = ws; resolve(ws); };
    ws.onmessage = (ev) => {
      try { outputManager.handleKernelEvent(JSON.parse(ev.data) as KernelEvent); } catch (_) { /* skip */ }
    };
    ws.onerror = (err) => { reject(err); };
    ws.onclose = () => {
      wsRef.current = null;
      setState(produce((s) => { const k = s.kernels[kernelId]; if (k) k.status = "disconnected"; }));
    };
  });

  const executeCell = async (index: number): Promise<void> => {
    const p = state.activeNotebookPath;
    if (!p) throw new Error("No active notebook");
    const nd = state.notebooks[p];
    if (!nd) throw new Error("Notebook not found");
    if (index < 0 || index >= nd.notebook.cells.length) throw new Error("Invalid cell index");
    const cell = nd.notebook.cells[index];
    if (cell.cell_type !== "code") return;
    if (!nd.kernelId) {
      await kernelManager.startKernel(nd.notebook.metadata.kernelspec?.language as KernelLanguage || "python");
    }
    const kId = state.notebooks[p]?.kernelId;
    if (!kId) throw new Error("Failed to start kernel");
    setState(produce((s) => {
      const nb = s.notebooks[p]; if (nb) nb.notebook.cells[index].outputs = [];
      s.executionQueue.push({ notebookPath: p, cellId: cell.id, status: "executing", queuedAt: Date.now() });
      const k = s.kernels[kId]; if (k) k.status = "busy";
    }));
    try {
      await invoke("notebook_execute_cell", { kernelId: kId, cellId: cell.id, code: cell.source, notebookPath: p });
    } catch (e) {
      setState(produce((s) => {
        s.executionQueue = s.executionQueue.filter((i) => !(i.notebookPath === p && i.cellId === cell.id));
        const nb = s.notebooks[p];
        if (nb) nb.notebook.cells[index].outputs.push({
          output_type: "error", ename: "ExecutionError", evalue: e instanceof Error ? e.message : String(e), traceback: [],
        });
        const k = s.kernels[kId]; if (k) k.status = "idle";
      }));
      throw e;
    }
  };

  const executeAllCells = async (): Promise<void> => {
    const p = state.activeNotebookPath; if (!p) return;
    const cells = state.notebooks[p]?.notebook.cells; if (!cells) return;
    for (let i = 0; i < cells.length; i++) { if (cells[i].cell_type === "code") await executeCell(i); }
  };

  const kernelManager = createKernelManager(state, setState, wsRef, setupWs, executeAllCells);

  const openNotebook = async (path: string): Promise<void> => {
    const existing = state.notebooks[path];
    if (existing) {
      batch(() => { setState("activeNotebookPath", path); setState("activeCellId", existing.notebook.cells[0]?.id || null); });
      return;
    }
    setState("isLoading", true); setState("error", null);
    try {
      const notebook = parseNotebookFile(await invoke<string>("fs_read_file", { path }));
      const data: NotebookData = { path, name: getNotebookNameFromPath(path), notebook, modified: false, kernelId: null, lastSaved: Date.now() };
      batch(() => {
        setState(produce((s) => { s.notebooks[path] = data; }));
        setState("activeNotebookPath", path); setState("activeCellId", notebook.cells[0]?.id || null); setState("isLoading", false);
      });
    } catch (e) {
      setState("error", `Failed to open notebook: ${e instanceof Error ? e.message : String(e)}`);
      setState("isLoading", false); throw e;
    }
  };

  const saveNotebook = async (path?: string): Promise<void> => {
    const tp = path || state.activeNotebookPath;
    if (!tp) throw new Error("No notebook to save");
    const nd = state.notebooks[tp]; if (!nd) throw new Error("Notebook not found");
    setState("isLoading", true); setState("error", null);
    try {
      await invoke("fs_write_file", { path: tp, content: serializeNotebook(nd.notebook) });
      setState(produce((s) => {
        const nb = s.notebooks[tp];
        if (nb) { nb.modified = false; nb.lastSaved = Date.now(); nb.notebook.metadata.modified = new Date().toISOString(); }
      }));
      setState("isLoading", false);
    } catch (e) {
      setState("error", `Failed to save notebook: ${e instanceof Error ? e.message : String(e)}`);
      setState("isLoading", false); throw e;
    }
  };

  const closeNotebook = (path: string): void => {
    setState(produce((s) => {
      const nb = s.notebooks[path];
      if (nb?.kernelId) delete s.kernels[nb.kernelId];
      delete s.notebooks[path];
      if (s.activeNotebookPath === path) {
        const rem = Object.keys(s.notebooks);
        s.activeNotebookPath = rem[0] || null;
        s.activeCellId = s.activeNotebookPath ? (s.notebooks[s.activeNotebookPath]?.notebook.cells[0]?.id || null) : null;
      }
      s.executionQueue = s.executionQueue.filter((i) => i.notebookPath !== path);
    }));
  };

  const createNotebook = async (path: string, language: KernelLanguage = "python"): Promise<void> => {
    const notebook = createDefaultNotebook(language);
    const data: NotebookData = { path, name: getNotebookNameFromPath(path), notebook, modified: true, kernelId: null, lastSaved: null };
    batch(() => {
      setState(produce((s) => { s.notebooks[path] = data; }));
      setState("activeNotebookPath", path); setState("activeCellId", notebook.cells[0]?.id || null);
    });
    await saveNotebook(path);
  };

  const setActiveNotebook = (path: string | null): void => {
    if (path === state.activeNotebookPath) return;
    batch(() => {
      setState("activeNotebookPath", path);
      setState("activeCellId", path ? (state.notebooks[path]?.notebook.cells[0]?.id || null) : null);
    });
  };

  const setActiveCell = (cellId: string | null): void => { setState("activeCellId", cellId); };

  const selectNextCell = (): void => {
    const p = state.activeNotebookPath; if (!p) return;
    const cells = state.notebooks[p]?.notebook.cells; if (!cells) return;
    const idx = cells.findIndex((c) => c.id === state.activeCellId);
    if (idx < cells.length - 1) setState("activeCellId", cells[idx + 1].id);
  };

  const selectPreviousCell = (): void => {
    const p = state.activeNotebookPath; if (!p) return;
    const cells = state.notebooks[p]?.notebook.cells; if (!cells) return;
    const idx = cells.findIndex((c) => c.id === state.activeCellId);
    if (idx > 0) setState("activeCellId", cells[idx - 1].id);
  };

  const executeCellsAbove = async (index: number): Promise<void> => {
    const p = state.activeNotebookPath; if (!p) return;
    const cells = state.notebooks[p]?.notebook.cells; if (!cells) return;
    for (let i = 0; i < index && i < cells.length; i++) { if (cells[i].cell_type === "code") await executeCell(i); }
  };

  const executeCellsBelow = async (index: number): Promise<void> => {
    const p = state.activeNotebookPath; if (!p) return;
    const cells = state.notebooks[p]?.notebook.cells; if (!cells) return;
    for (let i = index; i < cells.length; i++) { if (cells[i].cell_type === "code") await executeCell(i); }
  };

  const getActiveNotebook = (): NotebookData | null =>
    state.activeNotebookPath ? (state.notebooks[state.activeNotebookPath] || null) : null;
  const getActiveCell = (): NotebookCell | null => {
    const nb = getActiveNotebook(); if (!nb || !state.activeCellId) return null;
    return nb.notebook.cells.find((c) => c.id === state.activeCellId) || null;
  };
  const getCellByIndex = (index: number): NotebookCell | null => getActiveNotebook()?.notebook.cells[index] || null;
  const getCellIndex = (cellId: string): number => getActiveNotebook()?.notebook.cells.findIndex((c) => c.id === cellId) ?? -1;
  const isExecuting = (): boolean => state.executionQueue.length > 0;

  onMount(async () => {
    try {
      eventUnlisten = await listen<KernelEvent>("notebook:kernel_event", (e) => { outputManager.handleKernelEvent(e.payload); });
    } catch (_e) { /* Tauri event listener not available */ }
    onCleanup(() => { if (eventUnlisten) eventUnlisten(); if (wsRef.current) wsRef.current.close(); });
  });

  const contextValue: NotebookContextValue = {
    state, openNotebook, saveNotebook, closeNotebook, createNotebook,
    ...cellManager,
    setActiveNotebook, setActiveCell, selectNextCell, selectPreviousCell,
    executeCell, executeAllCells, executeCellsAbove, executeCellsBelow,
    ...kernelManager,
    clearOutputs: outputManager.clearOutputs, clearCellOutput: outputManager.clearCellOutput,
    getActiveNotebook, getActiveCell, getCellByIndex, getCellIndex, isExecuting,
    exportToScript: () => outputManager.exportToScript(getActiveNotebook()),
    exportToHtml: outputManager.exportToHtml, exportToPython: outputManager.exportToPython, exportToPdf: outputManager.exportToPdf,
    dragState, collapsedCells, toggleCellCollapse,
  };

  return (<NotebookContext.Provider value={contextValue}>{props.children}</NotebookContext.Provider>);
};

export function useNotebook(): NotebookContextValue {
  const context = useContext(NotebookContext);
  if (!context) throw new Error("useNotebook must be used within NotebookProvider");
  return context;
}

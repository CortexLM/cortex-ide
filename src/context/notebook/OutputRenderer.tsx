import { produce, SetStoreFunction } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import type {
  KernelEvent,
  NotebookData,
  NotebookState,
} from "./types";

export function createOutputManager(
  state: NotebookState,
  setState: SetStoreFunction<NotebookState>,
) {
  const handleKernelEvent = (event: KernelEvent) => {
    const { data } = event;

    switch (event.event) {
      case "status": {
        if (data.kernel_id && data.status) {
          setState(produce((s) => {
            const kernel = s.kernels[data.kernel_id!];
            if (kernel) {
              kernel.status = data.status!;
            }
          }));
        }
        break;
      }

      case "output": {
        if (data.notebook_path && data.cell_id && data.output) {
          setState(produce((s) => {
            const notebookData = s.notebooks[data.notebook_path!];
            if (notebookData) {
              const cellIndex = notebookData.notebook.cells.findIndex(
                (c) => c.id === data.cell_id,
              );
              if (cellIndex !== -1) {
                notebookData.notebook.cells[cellIndex].outputs.push(data.output!);
                notebookData.modified = true;
              }
            }
          }));
        }
        break;
      }

      case "result": {
        if (data.notebook_path && data.cell_id) {
          setState(produce((s) => {
            const notebookData = s.notebooks[data.notebook_path!];
            if (notebookData) {
              const cellIndex = notebookData.notebook.cells.findIndex(
                (c) => c.id === data.cell_id,
              );
              if (cellIndex !== -1) {
                notebookData.notebook.cells[cellIndex].execution_count =
                  data.execution_count ?? null;
                notebookData.modified = true;
              }
            }

            s.executionQueue = s.executionQueue.filter(
              (item) => !(item.notebookPath === data.notebook_path &&
                         item.cellId === data.cell_id),
            );

            const activeNotebook = s.notebooks[s.activeNotebookPath || ""];
            if (activeNotebook?.kernelId) {
              const kernel = s.kernels[activeNotebook.kernelId];
              if (kernel && s.executionQueue.length === 0) {
                kernel.status = "idle";
                if (data.execution_count !== undefined) {
                  kernel.executionCount = data.execution_count;
                }
              }
            }
          }));
        }
        break;
      }

      case "error": {
        setState("error", data.error || "Unknown kernel error");

        if (data.notebook_path && data.cell_id) {
          setState(produce((s) => {
            const notebookData = s.notebooks[data.notebook_path!];
            if (notebookData) {
              const cellIndex = notebookData.notebook.cells.findIndex(
                (c) => c.id === data.cell_id,
              );
              if (cellIndex !== -1) {
                notebookData.notebook.cells[cellIndex].outputs.push({
                  output_type: "error",
                  ename: "ExecutionError",
                  evalue: data.error || "Unknown error",
                  traceback: [],
                });
                notebookData.modified = true;
              }
            }

            s.executionQueue = s.executionQueue.filter(
              (item) => !(item.notebookPath === data.notebook_path &&
                         item.cellId === data.cell_id),
            );
          }));
        }
        break;
      }

      case "interrupt": {
        setState(produce((s) => {
          if (data.kernel_id) {
            const notebookPath = Object.entries(s.notebooks)
              .find(([_, nb]) => nb.kernelId === data.kernel_id)?.[0];

            if (notebookPath) {
              s.executionQueue = s.executionQueue.filter(
                (item) => item.notebookPath !== notebookPath,
              );
            }

            const kernel = s.kernels[data.kernel_id];
            if (kernel) {
              kernel.status = "idle";
            }
          }
        }));
        break;
      }
    }
  };

  const clearOutputs = (): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks[notebookPath];
      if (!notebookData) return;

      notebookData.notebook.cells.forEach((cell) => {
        if (cell.cell_type === "code") {
          cell.outputs = [];
          cell.execution_count = null;
        }
      });
      notebookData.modified = true;
    }));
  };

  const clearCellOutput = (cellId: string): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks[notebookPath];
      if (!notebookData) return;

      const cell = notebookData.notebook.cells.find((c) => c.id === cellId);
      if (cell && cell.cell_type === "code") {
        cell.outputs = [];
        cell.execution_count = null;
        notebookData.modified = true;
      }
    }));
  };

  const exportToScript = (notebookData: NotebookData | null): string => {
    if (!notebookData) return "";

    const lines: string[] = [];
    const language = notebookData.notebook.metadata.kernelspec?.language || "python";

    lines.push(`# Exported from ${notebookData.name}`);
    lines.push(`# Language: ${language}`);
    lines.push("");

    notebookData.notebook.cells.forEach((cell, index) => {
      if (cell.cell_type === "code") {
        lines.push(`# Cell ${index + 1}`);
        lines.push(cell.source);
        lines.push("");
      } else if (cell.cell_type === "markdown") {
        const commentPrefix = language === "python" ? "#" : "//";
        cell.source.split("\n").forEach((line) => {
          lines.push(`${commentPrefix} ${line}`);
        });
        lines.push("");
      }
    });

    return lines.join("\n");
  };

  const exportToHtml = async (path?: string): Promise<string> => {
    const targetPath = path || state.activeNotebookPath;
    if (!targetPath) {
      throw new Error("No notebook path specified");
    }
    return invoke<string>("notebook_export_html", { path: targetPath });
  };

  const exportToPython = async (path?: string): Promise<string> => {
    const targetPath = path || state.activeNotebookPath;
    if (!targetPath) {
      throw new Error("No notebook path specified");
    }
    return invoke<string>("notebook_export_python", { path: targetPath });
  };

  const exportToPdf = async (path?: string): Promise<string> => {
    const targetPath = path || state.activeNotebookPath;
    if (!targetPath) {
      throw new Error("No notebook path specified");
    }
    return invoke<string>("notebook_export_pdf", { path: targetPath });
  };

  return {
    handleKernelEvent,
    clearOutputs,
    clearCellOutput,
    exportToScript,
    exportToHtml,
    exportToPython,
    exportToPdf,
  };
}

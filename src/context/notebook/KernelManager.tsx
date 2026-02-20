import { produce, SetStoreFunction } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import type {
  KernelLanguage,
  KernelStatus,
  KernelInfo,
  NotebookState,
} from "./types";

export function generateKernelId(): string {
  return `kernel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createKernelManager(
  state: NotebookState,
  setState: SetStoreFunction<NotebookState>,
  wsConnectionRef: { current: WebSocket | null },
  setupWebSocketConnection: (kernelId: string) => Promise<WebSocket>,
  executeAllCells: () => Promise<void>,
) {
  const startKernel = async (language: KernelLanguage): Promise<KernelInfo> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) {
      throw new Error("No active notebook");
    }

    setState("isLoading", true);
    setState("error", null);

    try {
      const kernelId = generateKernelId();

      const result = await invoke<{ id: string; language: string; display_name: string }>(
        "notebook_start_kernel",
        { kernelId, language, notebookPath },
      );

      const kernelInfo: KernelInfo = {
        id: result.id || kernelId,
        language: result.language as KernelLanguage || language,
        status: "idle",
        executionCount: 0,
        displayName: result.display_name || `${language} kernel`,
      };

      try {
        await setupWebSocketConnection(kernelInfo.id);
      } catch (_wsError) {
        /* WebSocket optional — falls back to Tauri events */
      }

      setState(produce((s) => {
        s.kernels[kernelInfo.id] = kernelInfo;
        const nb = s.notebooks[notebookPath];
        if (nb) {
          nb.kernelId = kernelInfo.id;
        }
      }));
      setState("isLoading", false);

      return kernelInfo;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setState("error", `Failed to start kernel: ${errorMessage}`);
      setState("isLoading", false);
      throw e;
    }
  };

  const interruptKernel = async (): Promise<void> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks[notebookPath];
    if (!notebookData?.kernelId) return;

    try {
      await invoke("notebook_interrupt_kernel", {
        kernelId: notebookData.kernelId,
      });

      setState(produce((s) => {
        s.executionQueue = s.executionQueue.filter(
          (item) => item.notebookPath !== notebookPath,
        );
        const kernel = s.kernels[notebookData.kernelId!];
        if (kernel) {
          kernel.status = "idle";
        }
      }));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setState("error", `Failed to interrupt kernel: ${errorMessage}`);
      throw e;
    }
  };

  const restartKernel = async (executeAll_flag = false): Promise<void> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks[notebookPath];
    if (!notebookData) return;

    const language = notebookData.notebook.metadata.kernelspec?.language as KernelLanguage || "python";

    if (notebookData.kernelId) {
      setState(produce((s) => {
        const kernel = s.kernels[notebookData.kernelId!];
        if (kernel) {
          kernel.status = "restarting";
        }
      }));

      try {
        await invoke("notebook_shutdown_kernel", {
          kernelId: notebookData.kernelId,
        });
      } catch (_e) {
        /* shutdown may fail if kernel already dead */
      }

      if (wsConnectionRef.current) {
        wsConnectionRef.current.close();
        wsConnectionRef.current = null;
      }

      setState(produce((s) => {
        delete s.kernels[notebookData.kernelId!];
        const nb = s.notebooks[notebookPath];
        if (nb) {
          nb.kernelId = null;
          nb.notebook.cells.forEach((cell) => {
            cell.outputs = [];
            cell.execution_count = null;
          });
        }
        s.executionQueue = s.executionQueue.filter(
          (item) => item.notebookPath !== notebookPath,
        );
      }));
    }

    await startKernel(language);

    if (executeAll_flag) {
      await executeAllCells();
    }
  };

  const changeKernel = async (language: KernelLanguage): Promise<void> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks[notebookPath];
    if (!notebookData) return;

    if (notebookData.kernelId) {
      try {
        await invoke("notebook_shutdown_kernel", {
          kernelId: notebookData.kernelId,
        });
      } catch (_e) {
        /* shutdown may fail if kernel already dead */
      }

      setState(produce((s) => {
        delete s.kernels[notebookData.kernelId!];
        const nb = s.notebooks[notebookPath];
        if (nb) {
          nb.kernelId = null;
        }
      }));
    }

    setState(produce((s) => {
      const nb = s.notebooks[notebookPath];
      if (nb) {
        nb.notebook.metadata.kernelspec = {
          name: language,
          display_name: language.charAt(0).toUpperCase() + language.slice(1),
          language,
        };
        nb.modified = true;
      }
    }));

    await startKernel(language);
  };

  const getKernelStatus = (): KernelStatus => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return "disconnected";

    const notebookData = state.notebooks[notebookPath];
    if (!notebookData?.kernelId) return "disconnected";

    const kernel = state.kernels[notebookData.kernelId];
    return kernel?.status || "disconnected";
  };

  const listKernels = async (): Promise<KernelInfo[]> => {
    return invoke<KernelInfo[]>("notebook_list_kernels");
  };

  return {
    startKernel,
    interruptKernel,
    restartKernel,
    changeKernel,
    getKernelStatus,
    listKernels,
  };
}

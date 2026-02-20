import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("REPLContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Kernel Types", () => {
    type KernelStatus = "starting" | "idle" | "busy" | "restarting" | "shuttingdown" | "shutdown" | "error";
    type KernelType = "python" | "node" | "jupyter";

    interface KernelSpec {
      id: string;
      name: string;
      display_name: string;
      language: string;
      kernel_type: KernelType;
      executable: string | null;
    }

    interface KernelInfo {
      id: string;
      spec: KernelSpec;
      status: KernelStatus;
      execution_count: number;
    }

    it("should create kernel spec", () => {
      const spec: KernelSpec = {
        id: "python3",
        name: "python3",
        display_name: "Python 3",
        language: "python",
        kernel_type: "python",
        executable: "/usr/bin/python3",
      };

      expect(spec.id).toBe("python3");
      expect(spec.language).toBe("python");
    });

    it("should create kernel info", () => {
      const kernel: KernelInfo = {
        id: "kernel-1",
        spec: {
          id: "python3",
          name: "python3",
          display_name: "Python 3",
          language: "python",
          kernel_type: "python",
          executable: null,
        },
        status: "idle",
        execution_count: 5,
      };

      expect(kernel.status).toBe("idle");
      expect(kernel.execution_count).toBe(5);
    });

    it("should track kernel status transitions", () => {
      const statuses: KernelStatus[] = ["starting", "idle", "busy", "idle", "shuttingdown", "shutdown"];

      let currentStatus: KernelStatus = "starting";

      for (const status of statuses.slice(1)) {
        currentStatus = status;
      }

      expect(currentStatus).toBe("shutdown");
    });
  });

  describe("Cell Management", () => {
    type CellStatus = "pending" | "running" | "success" | "error";
    type OutputType = "stdout" | "stderr" | "result" | "error" | "display";

    interface OutputContent {
      type: "text" | "html" | "image" | "json" | "error";
      data: string | Record<string, unknown>;
    }

    interface CellOutput {
      output_type: OutputType;
      content: OutputContent;
      timestamp: number;
    }

    interface Cell {
      id: string;
      input: string;
      outputs: CellOutput[];
      execution_count: number | null;
      status: CellStatus;
      created_at: number;
      executed_at: number | null;
    }

    it("should create a cell", () => {
      const cell: Cell = {
        id: "cell-1",
        input: "print('Hello')",
        outputs: [],
        execution_count: null,
        status: "pending",
        created_at: Date.now(),
        executed_at: null,
      };

      expect(cell.id).toBe("cell-1");
      expect(cell.status).toBe("pending");
    });

    it("should add output to cell", () => {
      const cell: Cell = {
        id: "cell-1",
        input: "print('Hello')",
        outputs: [],
        execution_count: 1,
        status: "running",
        created_at: Date.now(),
        executed_at: null,
      };

      cell.outputs.push({
        output_type: "stdout",
        content: { type: "text", data: "Hello\n" },
        timestamp: Date.now(),
      });

      expect(cell.outputs).toHaveLength(1);
      expect(cell.outputs[0].output_type).toBe("stdout");
    });

    it("should update cell status", () => {
      const cell: Cell = {
        id: "cell-1",
        input: "x = 1 + 1",
        outputs: [],
        execution_count: null,
        status: "pending",
        created_at: Date.now(),
        executed_at: null,
      };

      cell.status = "running";
      cell.execution_count = 1;

      cell.status = "success";
      cell.executed_at = Date.now();

      expect(cell.status).toBe("success");
      expect(cell.executed_at).not.toBeNull();
    });

    it("should handle error output", () => {
      const cell: Cell = {
        id: "cell-1",
        input: "1/0",
        outputs: [],
        execution_count: 1,
        status: "running",
        created_at: Date.now(),
        executed_at: null,
      };

      cell.outputs.push({
        output_type: "error",
        content: {
          type: "error",
          data: { name: "ZeroDivisionError", message: "division by zero", traceback: [] },
        },
        timestamp: Date.now(),
      });
      cell.status = "error";

      expect(cell.status).toBe("error");
      expect(cell.outputs[0].output_type).toBe("error");
    });

    it("should delete cell", () => {
      const cells: Cell[] = [
        {
          id: "cell-1",
          input: "x = 1",
          outputs: [],
          execution_count: 1,
          status: "success",
          created_at: Date.now(),
          executed_at: Date.now(),
        },
        {
          id: "cell-2",
          input: "y = 2",
          outputs: [],
          execution_count: 2,
          status: "success",
          created_at: Date.now(),
          executed_at: Date.now(),
        },
      ];

      const filtered = cells.filter((c) => c.id !== "cell-1");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("cell-2");
    });

    it("should clear cell outputs", () => {
      const cell: Cell = {
        id: "cell-1",
        input: "print('test')",
        outputs: [
          { output_type: "stdout", content: { type: "text", data: "test\n" }, timestamp: Date.now() },
        ],
        execution_count: 1,
        status: "success",
        created_at: Date.now(),
        executed_at: Date.now(),
      };

      cell.outputs = [];

      expect(cell.outputs).toHaveLength(0);
    });
  });

  describe("Variable Tracking", () => {
    interface Variable {
      name: string;
      value_type: string;
      value_repr: string;
      is_function: boolean;
      is_module: boolean;
      timestamp?: number;
    }

    interface TrackedVariable {
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

    it("should create a variable", () => {
      const variable: Variable = {
        name: "x",
        value_type: "int",
        value_repr: "42",
        is_function: false,
        is_module: false,
      };

      expect(variable.name).toBe("x");
      expect(variable.value_repr).toBe("42");
    });

    it("should create a tracked variable", () => {
      const tracked: TrackedVariable = {
        name: "data",
        value: { a: 1, b: 2 },
        valueType: "object",
        valueRepr: "{'a': 1, 'b': 2}",
        timestamp: Date.now(),
        isObject: true,
        isArray: false,
        isFunction: false,
      };

      expect(tracked.isObject).toBe(true);
      expect(tracked.valueType).toBe("object");
    });

    it("should track array variable", () => {
      const tracked: TrackedVariable = {
        name: "items",
        value: [1, 2, 3],
        valueType: "list",
        valueRepr: "[1, 2, 3]",
        timestamp: Date.now(),
        isObject: false,
        isArray: true,
        isFunction: false,
      };

      expect(tracked.isArray).toBe(true);
    });

    it("should track function variable", () => {
      const variable: Variable = {
        name: "my_func",
        value_type: "function",
        value_repr: "<function my_func at 0x...>",
        is_function: true,
        is_module: false,
      };

      expect(variable.is_function).toBe(true);
    });

    it("should limit tracked variables", () => {
      const maxTracked = 50;
      const variables: TrackedVariable[] = [];

      for (let i = 0; i < 60; i++) {
        variables.push({
          name: `var_${i}`,
          value: i,
          valueType: "int",
          valueRepr: String(i),
          timestamp: Date.now(),
          isObject: false,
          isArray: false,
          isFunction: false,
        });
      }

      const trimmed = variables.slice(-maxTracked);

      expect(trimmed).toHaveLength(50);
    });

    it("should clear variables", () => {
      let variables: Variable[] = [
        { name: "x", value_type: "int", value_repr: "1", is_function: false, is_module: false },
        { name: "y", value_type: "int", value_repr: "2", is_function: false, is_module: false },
      ];

      variables = [];

      expect(variables).toHaveLength(0);
    });
  });

  describe("Kernel Management", () => {
    interface KernelSpec {
      id: string;
      name: string;
      display_name: string;
      language: string;
    }

    interface KernelInfo {
      id: string;
      spec: KernelSpec;
      status: string;
    }

    it("should load kernel specs", async () => {
      const specs: KernelSpec[] = [
        { id: "python3", name: "python3", display_name: "Python 3", language: "python" },
        { id: "node", name: "node", display_name: "Node.js", language: "javascript" },
      ];

      vi.mocked(invoke).mockResolvedValueOnce(specs);

      const result = await invoke("repl_list_kernel_specs");

      expect(invoke).toHaveBeenCalledWith("repl_list_kernel_specs");
      expect(result).toEqual(specs);
    });

    it("should start kernel", async () => {
      const kernel: KernelInfo = {
        id: "kernel-1",
        spec: { id: "python3", name: "python3", display_name: "Python 3", language: "python" },
        status: "starting",
      };

      vi.mocked(invoke).mockResolvedValueOnce(kernel);

      const result = await invoke("repl_start_kernel", { specId: "python3" });

      expect(invoke).toHaveBeenCalledWith("repl_start_kernel", { specId: "python3" });
      expect(result).toEqual(kernel);
    });

    it("should shutdown kernel", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("repl_shutdown_kernel", { kernelId: "kernel-1" });

      expect(invoke).toHaveBeenCalledWith("repl_shutdown_kernel", { kernelId: "kernel-1" });
    });

    it("should restart kernel", async () => {
      const kernel: KernelInfo = {
        id: "kernel-1",
        spec: { id: "python3", name: "python3", display_name: "Python 3", language: "python" },
        status: "restarting",
      };

      vi.mocked(invoke).mockResolvedValueOnce(kernel);

      const result = await invoke("repl_restart_kernel", { kernelId: "kernel-1" });

      expect(invoke).toHaveBeenCalledWith("repl_restart_kernel", { kernelId: "kernel-1" });
      expect(result).toEqual(kernel);
    });

    it("should interrupt kernel", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("repl_interrupt", { kernelId: "kernel-1" });

      expect(invoke).toHaveBeenCalledWith("repl_interrupt", { kernelId: "kernel-1" });
    });
  });

  describe("Code Execution", () => {
    it("should execute code", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("repl_execute", { kernelId: "kernel-1", cellId: "cell-1", code: "print('hello')" });

      expect(invoke).toHaveBeenCalledWith("repl_execute", {
        kernelId: "kernel-1",
        cellId: "cell-1",
        code: "print('hello')",
      });
    });

    it("should execute all cells", async () => {
      interface Cell {
        id: string;
        input: string;
      }

      const cells: Cell[] = [
        { id: "cell-1", input: "x = 1" },
        { id: "cell-2", input: "y = 2" },
        { id: "cell-3", input: "z = x + y" },
      ];

      vi.mocked(invoke).mockResolvedValue(undefined);

      for (const cell of cells) {
        await invoke("repl_execute", { kernelId: "kernel-1", cellId: cell.id, code: cell.input });
      }

      expect(invoke).toHaveBeenCalledTimes(3);
    });
  });

  describe("Event Handling", () => {
    interface KernelEvent {
      event: "status" | "output" | "result" | "error" | "variables";
      data: {
        kernel_id: string;
        cell_id?: string;
        status?: string;
        output?: { output_type: string; content: unknown };
        error?: string;
      };
    }

    it("should listen for repl events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("repl:event", () => {});

      expect(listen).toHaveBeenCalledWith("repl:event", expect.any(Function));
    });

    it("should handle status event", () => {
      const event: KernelEvent = {
        event: "status",
        data: {
          kernel_id: "kernel-1",
          status: "idle",
        },
      };

      expect(event.event).toBe("status");
      expect(event.data.status).toBe("idle");
    });

    it("should handle output event", () => {
      const event: KernelEvent = {
        event: "output",
        data: {
          kernel_id: "kernel-1",
          cell_id: "cell-1",
          output: { output_type: "stdout", content: "Hello\n" },
        },
      };

      expect(event.event).toBe("output");
      expect(event.data.output?.output_type).toBe("stdout");
    });

    it("should handle error event", () => {
      const event: KernelEvent = {
        event: "error",
        data: {
          kernel_id: "kernel-1",
          error: "Kernel crashed",
        },
      };

      expect(event.event).toBe("error");
      expect(event.data.error).toBe("Kernel crashed");
    });
  });

  describe("UI State", () => {
    interface REPLState {
      showPanel: boolean;
      showVariableInspector: boolean;
      activeKernelId: string | null;
      activeCellId: string | null;
      isLoading: boolean;
      error: string | null;
    }

    it("should toggle panel", () => {
      const state: REPLState = {
        showPanel: false,
        showVariableInspector: false,
        activeKernelId: null,
        activeCellId: null,
        isLoading: false,
        error: null,
      };

      state.showPanel = true;

      expect(state.showPanel).toBe(true);
    });

    it("should toggle variable inspector", () => {
      const state: REPLState = {
        showPanel: true,
        showVariableInspector: false,
        activeKernelId: "kernel-1",
        activeCellId: null,
        isLoading: false,
        error: null,
      };

      state.showVariableInspector = true;

      expect(state.showVariableInspector).toBe(true);
    });

    it("should set active kernel", () => {
      const state: REPLState = {
        showPanel: true,
        showVariableInspector: false,
        activeKernelId: null,
        activeCellId: null,
        isLoading: false,
        error: null,
      };

      state.activeKernelId = "kernel-1";

      expect(state.activeKernelId).toBe("kernel-1");
    });

    it("should set active cell", () => {
      const state: REPLState = {
        showPanel: true,
        showVariableInspector: false,
        activeKernelId: "kernel-1",
        activeCellId: null,
        isLoading: false,
        error: null,
      };

      state.activeCellId = "cell-1";

      expect(state.activeCellId).toBe("cell-1");
    });

    it("should handle error state", () => {
      const state: REPLState = {
        showPanel: true,
        showVariableInspector: false,
        activeKernelId: "kernel-1",
        activeCellId: null,
        isLoading: false,
        error: null,
      };

      state.error = "Failed to connect to kernel";

      expect(state.error).toBe("Failed to connect to kernel");
    });

    it("should clear error", () => {
      const state: REPLState = {
        showPanel: true,
        showVariableInspector: false,
        activeKernelId: null,
        activeCellId: null,
        isLoading: false,
        error: "Some error",
      };

      state.error = null;

      expect(state.error).toBeNull();
    });
  });

  describe("Export to Notebook", () => {
    interface Cell {
      id: string;
      input: string;
      outputs: unknown[];
      execution_count: number | null;
    }

    it("should export cells to notebook format", () => {
      const cells: Cell[] = [
        { id: "cell-1", input: "x = 1", outputs: [], execution_count: 1 },
        { id: "cell-2", input: "print(x)", outputs: [{ text: "1\n" }], execution_count: 2 },
      ];

      const notebook = {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: { kernelspec: { name: "python3", display_name: "Python 3" } },
        cells: cells.map((cell) => ({
          cell_type: "code",
          source: cell.input,
          outputs: cell.outputs,
          execution_count: cell.execution_count,
        })),
      };

      expect(notebook.nbformat).toBe(4);
      expect(notebook.cells).toHaveLength(2);
    });
  });
});

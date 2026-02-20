import type {
  CellType,
  CellOutput,
  CellMetadata,
  KernelLanguage,
  NotebookMetadata,
  NotebookCell,
  JupyterNotebook,
  StreamName,
} from "./types";
import { createEmptyCell } from "./CellManager";

export function createDefaultNotebook(language: KernelLanguage = "python"): JupyterNotebook {
  const languageInfo: Record<string, { name: string; file_extension: string; mimetype: string }> = {
    python: { name: "python", file_extension: ".py", mimetype: "text/x-python" },
    javascript: { name: "javascript", file_extension: ".js", mimetype: "text/javascript" },
    typescript: { name: "typescript", file_extension: ".ts", mimetype: "text/typescript" },
  };

  return {
    metadata: {
      kernelspec: {
        name: language,
        display_name: language.charAt(0).toUpperCase() + language.slice(1),
        language,
      },
      language_info: languageInfo[language],
      created: new Date().toISOString(),
    },
    nbformat: 4,
    nbformat_minor: 5,
    cells: [createEmptyCell("code")],
  };
}

function normalizeOutputData(data: Record<string, unknown> | undefined): Record<string, string> {
  if (!data) return {};
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    normalized[key] = Array.isArray(value) ? value.join("") : String(value);
  }
  return normalized;
}

function normalizeOutput(output: Record<string, unknown>): CellOutput {
  const outputType = output.output_type as string;
  switch (outputType) {
    case "stream":
      return {
        output_type: "stream",
        name: (output.name as StreamName) || "stdout",
        text: Array.isArray(output.text)
          ? (output.text as string[]).join("")
          : (output.text as string) || "",
      };
    case "execute_result":
      return {
        output_type: "execute_result",
        execution_count: (output.execution_count as number) || 0,
        data: normalizeOutputData(output.data as Record<string, unknown>),
        metadata: output.metadata as Record<string, unknown>,
      };
    case "display_data":
      return {
        output_type: "display_data",
        data: normalizeOutputData(output.data as Record<string, unknown>),
        metadata: output.metadata as Record<string, unknown>,
      };
    case "error":
      return {
        output_type: "error",
        ename: (output.ename as string) || "Error",
        evalue: (output.evalue as string) || "",
        traceback: (output.traceback as string[]) || [],
      };
    default:
      return { output_type: "stream", name: "stdout", text: JSON.stringify(output) };
  }
}

export function parseNotebookFile(content: string): JupyterNotebook {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid notebook JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (typeof parsed.nbformat !== "number" || parsed.nbformat < 4) {
    throw new Error("Unsupported notebook format. Only nbformat 4+ is supported.");
  }
  const cells: NotebookCell[] = (parsed.cells || []).map(
    (cell: Record<string, unknown>, index: number) => {
      const source = Array.isArray(cell.source)
        ? (cell.source as string[]).join("")
        : (cell.source as string) || "";
      const outputs: CellOutput[] = Array.isArray(cell.outputs)
        ? (cell.outputs as Record<string, unknown>[]).map(normalizeOutput)
        : [];
      return {
        id: (cell.id as string) || `cell-${Date.now()}-${index}`,
        cell_type: (cell.cell_type as CellType) || "code",
        source,
        metadata: (cell.metadata as CellMetadata) || {},
        outputs,
        execution_count: (cell.execution_count as number | null) ?? null,
      };
    },
  );
  return {
    metadata: (parsed.metadata as NotebookMetadata) || {},
    nbformat: parsed.nbformat,
    nbformat_minor: parsed.nbformat_minor || 0,
    cells,
  };
}

export function serializeNotebook(notebook: JupyterNotebook): string {
  const serialized = {
    metadata: notebook.metadata,
    nbformat: notebook.nbformat,
    nbformat_minor: notebook.nbformat_minor,
    cells: notebook.cells.map((cell) => ({
      id: cell.id,
      cell_type: cell.cell_type,
      source: cell.source.split("\n").map((line, i, arr) =>
        i < arr.length - 1 ? line + "\n" : line,
      ),
      metadata: cell.metadata,
      ...(cell.cell_type === "code" ? {
        outputs: cell.outputs,
        execution_count: cell.execution_count,
      } : {}),
    })),
  };
  return JSON.stringify(serialized, null, 1);
}

export function getNotebookNameFromPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "Untitled.ipynb";
}

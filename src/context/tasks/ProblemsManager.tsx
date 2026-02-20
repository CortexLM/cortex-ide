import { createSignal, createMemo } from "solid-js";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Problems");

export type ProblemSeverity = "error" | "warning" | "info";

export interface Problem {
  id: string;
  taskId: string;
  file: string;
  line: number;
  column: number;
  severity: ProblemSeverity;
  message: string;
  code: string | null;
  source: string;
}

interface TaskDiagnosticPayload {
  taskId: string;
  file: string;
  line: number;
  column: number;
  severity: string;
  message: string;
  code: string | null;
  source: string;
}

function normalizeSeverity(raw: string): ProblemSeverity {
  const lower = raw.toLowerCase();
  if (lower === "error") return "error";
  if (lower === "warning" || lower === "warn") return "warning";
  return "info";
}

export interface ProblemsFilter {
  severity?: ProblemSeverity;
  file?: string;
}

export function createProblemsManager() {
  const [problems, setProblems] = createSignal<Problem[]>([]);
  const [filter, setFilter] = createSignal<ProblemsFilter>({});

  let unlisten: UnlistenFn | undefined;

  const filteredProblems = createMemo(() => {
    const all = problems();
    const f = filter();
    return all.filter((p) => {
      if (f.severity && p.severity !== f.severity) return false;
      if (f.file && !p.file.includes(f.file)) return false;
      return true;
    });
  });

  const counts = createMemo(() => {
    const all = problems();
    return {
      total: all.length,
      error: all.filter((p) => p.severity === "error").length,
      warning: all.filter((p) => p.severity === "warning").length,
      info: all.filter((p) => p.severity === "info").length,
    };
  });

  const groupedByFile = createMemo(() => {
    const map = new Map<string, Problem[]>();
    for (const p of filteredProblems()) {
      const group = map.get(p.file);
      if (group) group.push(p);
      else map.set(p.file, [p]);
    }
    return map;
  });

  const addProblem = (payload: TaskDiagnosticPayload) => {
    const id = `${payload.taskId}:${payload.file}:${payload.line}:${payload.column}:${payload.message}`;
    const problem: Problem = {
      id,
      taskId: payload.taskId,
      file: payload.file,
      line: payload.line,
      column: payload.column,
      severity: normalizeSeverity(payload.severity),
      message: payload.message,
      code: payload.code,
      source: payload.source,
    };

    setProblems((prev) => {
      if (prev.some((p) => p.id === id)) return prev;
      return [...prev, problem];
    });

    emitStatusBarUpdate();
  };

  const clearAll = () => {
    setProblems([]);
    emitStatusBarUpdate();
  };

  const clearByTaskId = (taskId: string) => {
    setProblems((prev) => prev.filter((p) => p.taskId !== taskId));
    emitStatusBarUpdate();
  };

  const clearByFile = (file: string) => {
    setProblems((prev) => prev.filter((p) => p.file !== file));
    emitStatusBarUpdate();
  };

  const setSeverityFilter = (severity?: ProblemSeverity) => {
    setFilter((prev) => ({ ...prev, severity }));
  };

  const setFileFilter = (file?: string) => {
    setFilter((prev) => ({ ...prev, file }));
  };

  const emitStatusBarUpdate = () => {
    const c = counts();
    window.dispatchEvent(
      new CustomEvent("problems:status-update", {
        detail: { total: c.total, error: c.error, warning: c.warning, info: c.info },
      })
    );
  };

  const fetchFromBackend = async () => {
    try {
      const backendProblems = await invoke<TaskDiagnosticPayload[]>("tasks_get_problems");
      for (const p of backendProblems) {
        addProblem(p);
      }
    } catch (err) {
      logger.warn("Failed to fetch problems from backend:", err);
    }
  };

  const startListening = async () => {
    unlisten = await listen<TaskDiagnosticPayload>("task:diagnostic", (ev) => {
      addProblem(ev.payload);
    });
    await fetchFromBackend();
  };

  const stopListening = () => {
    unlisten?.();
  };

  return {
    problems,
    filteredProblems,
    counts,
    groupedByFile,
    filter,
    addProblem,
    clearAll,
    clearByTaskId,
    clearByFile,
    setSeverityFilter,
    setFileFilter,
    startListening,
    stopListening,
  };
}

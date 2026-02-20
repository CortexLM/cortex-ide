import { createContext, useContext, type ParentComponent } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type {
  Breakpoint,
  BreakpointLocation,
  FunctionBreakpoint,
  DataBreakpoint,
  DataBreakpointAccessType,
} from "@/context/DebugContext";

interface BreakpointState {
  breakpoints: Record<string, Breakpoint[]>;
  functionBreakpoints: FunctionBreakpoint[];
  dataBreakpoints: DataBreakpoint[];
}

interface DebugBreakpointContextValue {
  state: BreakpointState;
  setBreakpoints: (
    path: string,
    breakpoints: BreakpointLocation[],
  ) => Promise<Breakpoint[]>;
  toggleBreakpoint: (
    path: string,
    line: number,
    column?: number,
  ) => Promise<Breakpoint[]>;
  removeBreakpoint: (
    path: string,
    line: number,
    column?: number,
  ) => Promise<void>;
  getBreakpointsForFile: (path: string) => Breakpoint[];
  enableBreakpoint: (
    path: string,
    line: number,
    enabled: boolean,
    column?: number,
  ) => Promise<void>;
  removeAllBreakpoints: () => Promise<void>;
  addDataBreakpoint: (
    variableName: string,
    accessType: DataBreakpointAccessType,
    dataId?: string,
  ) => Promise<DataBreakpoint | null>;
  removeDataBreakpoint: (id: string) => Promise<void>;
  enableDataBreakpoint: (id: string, enabled: boolean) => Promise<void>;
  clearDataBreakpoints: () => Promise<void>;
}

const DebugBreakpointContext = createContext<DebugBreakpointContextValue>();

export const DebugBreakpointProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<BreakpointState>({
    breakpoints: {},
    functionBreakpoints: [],
    dataBreakpoints: [],
  });

  const getBreakpointsForFile = (path: string): Breakpoint[] =>
    state.breakpoints[path] || [];

  const setBreakpoints = async (
    path: string,
    breakpoints: BreakpointLocation[],
  ): Promise<Breakpoint[]> => {
    const mapped = breakpoints.map(
      (bp): Breakpoint => ({
        path: bp.path,
        line: bp.line,
        column: bp.column,
        verified: false,
        condition: bp.condition,
        hitCondition: bp.hitCondition,
        logMessage: bp.logMessage,
        enabled: bp.enabled ?? true,
      }),
    );
    setState("breakpoints", path, mapped);
    return mapped;
  };

  const toggleBreakpoint = async (
    path: string,
    line: number,
    _column?: number,
  ): Promise<Breakpoint[]> => {
    const existing = getBreakpointsForFile(path);
    const idx = existing.findIndex((bp) => bp.line === line);
    if (idx >= 0) {
      const updated = existing.filter((_, i) => i !== idx);
      setState("breakpoints", path, updated);
      return updated;
    }
    const newBp: Breakpoint = { path, line, verified: false, enabled: true };
    const updated = [...existing, newBp];
    setState("breakpoints", path, updated);
    return updated;
  };

  const removeBreakpoint = async (
    path: string,
    line: number,
    _column?: number,
  ) => {
    const existing = getBreakpointsForFile(path);
    setState(
      "breakpoints",
      path,
      existing.filter((bp) => bp.line !== line),
    );
  };

  const enableBreakpoint = async (
    path: string,
    line: number,
    enabled: boolean,
    _column?: number,
  ) => {
    setState(
      produce((s) => {
        const bps = s.breakpoints[path];
        if (bps) {
          const bp = bps.find((b) => b.line === line);
          if (bp) bp.enabled = enabled;
        }
      }),
    );
  };

  const removeAllBreakpoints = async () => {
    setState("breakpoints", {});
  };

  const addDataBreakpoint = async (
    variableName: string,
    accessType: DataBreakpointAccessType,
    dataId?: string,
  ): Promise<DataBreakpoint | null> => {
    const newBp: DataBreakpoint = {
      id: `data-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      variableName,
      accessType,
      enabled: true,
      hitCount: 0,
      dataId,
    };
    setState(
      produce((s) => {
        s.dataBreakpoints.push(newBp);
      }),
    );
    return newBp;
  };

  const removeDataBreakpoint = async (id: string) => {
    setState("dataBreakpoints", (bps) => bps.filter((bp) => bp.id !== id));
  };

  const enableDataBreakpoint = async (id: string, enabled: boolean) => {
    setState(
      produce((s) => {
        const bp = s.dataBreakpoints.find((b) => b.id === id);
        if (bp) bp.enabled = enabled;
      }),
    );
  };

  const clearDataBreakpoints = async () => {
    setState("dataBreakpoints", []);
  };

  return (
    <DebugBreakpointContext.Provider
      value={{
        state,
        setBreakpoints,
        toggleBreakpoint,
        removeBreakpoint,
        getBreakpointsForFile,
        enableBreakpoint,
        removeAllBreakpoints,
        addDataBreakpoint,
        removeDataBreakpoint,
        enableDataBreakpoint,
        clearDataBreakpoints,
      }}
    >
      {props.children}
    </DebugBreakpointContext.Provider>
  );
};

export function useDebugBreakpoints() {
  const ctx = useContext(DebugBreakpointContext);
  if (!ctx)
    throw new Error(
      "useDebugBreakpoints must be used within DebugBreakpointProvider",
    );
  return ctx;
}

export type { BreakpointState, DebugBreakpointContextValue };

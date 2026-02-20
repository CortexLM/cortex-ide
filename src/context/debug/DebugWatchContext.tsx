import { createContext, useContext, type ParentComponent } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { WatchExpression } from "@/context/DebugContext";

interface WatchState {
  watchExpressions: WatchExpression[];
}

interface DebugWatchContextValue {
  state: WatchState;
  addWatchExpression: (expression: string) => void;
  removeWatchExpression: (id: string) => void;
  updateWatchResult: (id: string, result: string, type?: string) => void;
  updateWatchError: (id: string, error: string) => void;
  clearWatches: () => void;
}

const DebugWatchContext = createContext<DebugWatchContextValue>();

export const DebugWatchProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<WatchState>({
    watchExpressions: [],
  });

  const addWatchExpression = (expression: string) => {
    const id = `watch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setState(
      produce((s) => {
        s.watchExpressions.push({ id, expression });
      }),
    );
  };

  const removeWatchExpression = (id: string) => {
    setState("watchExpressions", (exprs) => exprs.filter((e) => e.id !== id));
  };

  const updateWatchResult = (id: string, result: string, type?: string) => {
    setState(
      produce((s) => {
        const expr = s.watchExpressions.find((e) => e.id === id);
        if (expr) {
          expr.result = result;
          expr.type = type;
          expr.error = undefined;
        }
      }),
    );
  };

  const updateWatchError = (id: string, error: string) => {
    setState(
      produce((s) => {
        const expr = s.watchExpressions.find((e) => e.id === id);
        if (expr) {
          expr.error = error;
          expr.result = undefined;
        }
      }),
    );
  };

  const clearWatches = () => {
    setState("watchExpressions", []);
  };

  return (
    <DebugWatchContext.Provider
      value={{
        state,
        addWatchExpression,
        removeWatchExpression,
        updateWatchResult,
        updateWatchError,
        clearWatches,
      }}
    >
      {props.children}
    </DebugWatchContext.Provider>
  );
};

export function useDebugWatch() {
  const ctx = useContext(DebugWatchContext);
  if (!ctx)
    throw new Error("useDebugWatch must be used within DebugWatchProvider");
  return ctx;
}

export type { WatchState, DebugWatchContextValue };

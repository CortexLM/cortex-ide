import { createContext, useContext, type ParentComponent } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { OutputMessage } from "@/context/DebugContext";

interface ConsoleState {
  output: OutputMessage[];
  maxOutputEntries: number;
}

interface DebugConsoleContextValue {
  state: ConsoleState;
  addOutput: (
    category: string,
    output: string,
    source?: string,
    line?: number,
  ) => void;
  clearOutput: () => void;
  setMaxEntries: (max: number) => void;
}

const DebugConsoleContext = createContext<DebugConsoleContextValue>();

export const DebugConsoleProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<ConsoleState>({
    output: [],
    maxOutputEntries: 5000,
  });

  const addOutput = (
    category: string,
    output: string,
    source?: string,
    line?: number,
  ) => {
    setState(
      produce((s) => {
        s.output.push({
          category,
          output,
          source,
          line,
          timestamp: Date.now(),
        });
        if (s.output.length > s.maxOutputEntries) {
          s.output = s.output.slice(-s.maxOutputEntries);
        }
      }),
    );
  };

  const clearOutput = () => {
    setState("output", []);
  };

  const setMaxEntries = (max: number) => {
    setState("maxOutputEntries", max);
  };

  return (
    <DebugConsoleContext.Provider
      value={{
        state,
        addOutput,
        clearOutput,
        setMaxEntries,
      }}
    >
      {props.children}
    </DebugConsoleContext.Provider>
  );
};

export function useDebugConsole() {
  const ctx = useContext(DebugConsoleContext);
  if (!ctx)
    throw new Error(
      "useDebugConsole must be used within DebugConsoleProvider",
    );
  return ctx;
}

export type { ConsoleState, DebugConsoleContextValue };

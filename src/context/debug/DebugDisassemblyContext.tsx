import { createContext, useContext, type ParentComponent } from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

interface DisassembledInstruction {
  address: string;
  instructionBytes?: string;
  instruction: string;
  symbol?: string;
  location?: { name?: string; path?: string; sourceReference?: number };
  line?: number;
  column?: number;
}

interface DisassemblyState {
  instructions: DisassembledInstruction[];
  currentAddress: string | null;
  loading: boolean;
  error: string | null;
  useHex: boolean;
  showSource: boolean;
}

interface DebugDisassemblyContextValue {
  state: DisassemblyState;
  fetchDisassembly: (
    sessionId: string,
    memoryReference: string,
    offset?: number,
    count?: number,
  ) => Promise<void>;
  setCurrentAddress: (address: string | null) => void;
  toggleHex: () => void;
  toggleSource: () => void;
  clearDisassembly: () => void;
}

const DebugDisassemblyContext = createContext<DebugDisassemblyContextValue>();

export const DebugDisassemblyProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<DisassemblyState>({
    instructions: [],
    currentAddress: null,
    loading: false,
    error: null,
    useHex: true,
    showSource: true,
  });

  const fetchDisassembly = async (
    sessionId: string,
    memoryReference: string,
    offset?: number,
    count?: number,
  ) => {
    setState({ loading: true, error: null });
    try {
      const response = await invoke<{
        instructions: DisassembledInstruction[];
      }>("debug_disassemble", {
        sessionId,
        memoryReference,
        instructionOffset: offset ?? -50,
        instructionCount: count ?? 200,
        resolveSymbols: true,
      });
      setState({
        instructions: response.instructions,
        loading: false,
      });
    } catch (e) {
      setState({
        error: e instanceof Error ? e.message : String(e),
        loading: false,
      });
    }
  };

  const setCurrentAddress = (address: string | null) => {
    setState("currentAddress", address);
  };

  const toggleHex = () => setState("useHex", !state.useHex);
  const toggleSource = () => setState("showSource", !state.showSource);

  const clearDisassembly = () => {
    setState({
      instructions: [],
      currentAddress: null,
      error: null,
    });
  };

  return (
    <DebugDisassemblyContext.Provider
      value={{
        state,
        fetchDisassembly,
        setCurrentAddress,
        toggleHex,
        toggleSource,
        clearDisassembly,
      }}
    >
      {props.children}
    </DebugDisassemblyContext.Provider>
  );
};

export function useDebugDisassembly() {
  const ctx = useContext(DebugDisassemblyContext);
  if (!ctx)
    throw new Error(
      "useDebugDisassembly must be used within DebugDisassemblyProvider",
    );
  return ctx;
}

export type {
  DisassembledInstruction,
  DisassemblyState,
  DebugDisassemblyContextValue,
};

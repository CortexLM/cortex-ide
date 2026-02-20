import { createContext, useContext, type ParentComponent } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import type {
  DebugSessionInfo,
  DebugSessionConfig,
  DebugSessionState,
} from "@/context/DebugContext";

interface DebugSessionStore {
  sessions: DebugSessionInfo[];
  activeSessionId: string | null;
  isDebugging: boolean;
}

interface DebugSessionContextValue {
  state: DebugSessionStore;
  startSession: (config: DebugSessionConfig) => Promise<DebugSessionInfo>;
  stopSession: (sessionId?: string, terminate?: boolean) => Promise<void>;
  restartSession: (sessionId?: string) => Promise<void>;
  getActiveSession: () => DebugSessionInfo | undefined;
  getSessions: () => DebugSessionInfo[];
  setActiveSession: (sessionId: string) => void;
}

const DebugSessionContext = createContext<DebugSessionContextValue>();

export const DebugSessionProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<DebugSessionStore>({
    sessions: [],
    activeSessionId: null,
    isDebugging: false,
  });

  const startSession = async (
    config: DebugSessionConfig,
  ): Promise<DebugSessionInfo> => {
    const result = await invoke<DebugSessionInfo>("debug_start_session", {
      config,
    });
    setState(
      produce((s) => {
        s.sessions.push(result);
        s.activeSessionId = result.id;
        s.isDebugging = true;
      }),
    );
    return result;
  };

  const stopSession = async (sessionId?: string, terminate?: boolean) => {
    const id = sessionId || state.activeSessionId;
    if (!id) return;
    await invoke("debug_stop_session", {
      sessionId: id,
      terminate: terminate ?? true,
    });
    setState(
      produce((s) => {
        s.sessions = s.sessions.filter((ss) => ss.id !== id);
        if (s.activeSessionId === id) {
          s.activeSessionId = s.sessions[0]?.id || null;
        }
        s.isDebugging = s.sessions.length > 0;
      }),
    );
  };

  const restartSession = async (sessionId?: string) => {
    const id = sessionId || state.activeSessionId;
    if (!id) return;
    await invoke("debug_restart_session", { sessionId: id });
  };

  const getActiveSession = () =>
    state.sessions.find((s) => s.id === state.activeSessionId);

  const getSessions = () => state.sessions;

  const setActiveSession = (sessionId: string) =>
    setState("activeSessionId", sessionId);

  return (
    <DebugSessionContext.Provider
      value={{
        state,
        startSession,
        stopSession,
        restartSession,
        getActiveSession,
        getSessions,
        setActiveSession,
      }}
    >
      {props.children}
    </DebugSessionContext.Provider>
  );
};

export function useDebugSession() {
  const ctx = useContext(DebugSessionContext);
  if (!ctx)
    throw new Error("useDebugSession must be used within DebugSessionProvider");
  return ctx;
}

export type { DebugSessionStore, DebugSessionContextValue, DebugSessionState };

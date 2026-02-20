import { createContext, useContext, ParentProps, createSignal } from "solid-js";

interface SessionContextValue {
  sidebarOpen: () => boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  promptFocused: () => boolean;
  setPromptFocused: (focused: boolean) => void;
}

const SessionContext = createContext<SessionContextValue>();

export function SessionProvider(props: ParentProps) {
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [promptFocused, setPromptFocused] = createSignal(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen());

  return (
    <SessionContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        promptFocused,
        setPromptFocused,
      }}
    >
      {props.children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

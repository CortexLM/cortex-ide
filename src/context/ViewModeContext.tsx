import { createContext, useContext, ParentProps, createSignal } from "solid-js";

export type ViewMode = "vibe" | "ide";

interface ViewModeContextValue {
  mode: () => ViewMode;
  setMode: (mode: ViewMode) => void;
  isVibeMode: () => boolean;
  isIDEMode: () => boolean;
  toggleMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextValue>();

const STORAGE_KEY = "cortex_view_mode";

export function ViewModeProvider(props: ParentProps) {
  const [mode, setModeSignal] = createSignal<ViewMode>(
    (localStorage.getItem(STORAGE_KEY) as ViewMode) || "vibe"
  );

  const setMode = (newMode: ViewMode) => {
    setModeSignal(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  const isVibeMode = () => mode() === "vibe";
  const isIDEMode = () => mode() === "ide";

  const toggleMode = () => {
    setMode(mode() === "vibe" ? "ide" : "vibe");
  };

  const value: ViewModeContextValue = {
    mode,
    setMode,
    isVibeMode,
    isIDEMode,
    toggleMode,
  };

  return (
    <ViewModeContext.Provider value={value}>
      {props.children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}

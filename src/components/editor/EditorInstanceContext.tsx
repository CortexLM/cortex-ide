import {
  createContext,
  useContext,
  ParentProps,
  Accessor,
} from "solid-js";
import type * as Monaco from "monaco-editor";
import type { OpenFile } from "@/context/EditorContext";

// ============================================================================
// Types
// ============================================================================

export interface EditorInstanceContextValue {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
  activeFile: Accessor<OpenFile | undefined>;
}

interface EditorInstanceProviderProps {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
  activeFile: Accessor<OpenFile | undefined>;
}

// ============================================================================
// Context
// ============================================================================

const EditorInstanceContext = createContext<EditorInstanceContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function EditorInstanceProvider(props: ParentProps<EditorInstanceProviderProps>) {
  const value: EditorInstanceContextValue = {
    editor: props.editor,
    monaco: props.monaco,
    activeFile: props.activeFile,
  };

  return (
    <EditorInstanceContext.Provider value={value}>
      {props.children}
    </EditorInstanceContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useEditorInstance(): EditorInstanceContextValue {
  const ctx = useContext(EditorInstanceContext);
  if (!ctx) {
    throw new Error("useEditorInstance must be used within EditorInstanceProvider");
  }
  return ctx;
}

import type * as Monaco from "monaco-editor";
import { VimMode } from "@/components/editor/VimMode";

interface EditorVimModeProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
}

export function EditorVimMode(props: EditorVimModeProps) {
  return <VimMode editor={props.editor} monaco={props.monaco} />;
}

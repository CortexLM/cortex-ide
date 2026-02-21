import { createEffect, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type * as Monaco from "monaco-editor";

interface EditorMinimapProps {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
}

export function EditorMinimap(props: EditorMinimapProps) {
  createEffect(() => {
    const editor = props.editor();
    const monaco = props.monaco();
    if (!editor || !monaco) return;

    const handleToggleMinimap = () => {
      const currentOption = editor.getOption(monaco.editor.EditorOption.minimap);
      editor.updateOptions({ minimap: { enabled: !currentOption.enabled } });
    };

    window.addEventListener("editor:toggle-minimap", handleToggleMinimap);

    onCleanup(() => {
      window.removeEventListener("editor:toggle-minimap", handleToggleMinimap);
    });
  });

  return null;
}

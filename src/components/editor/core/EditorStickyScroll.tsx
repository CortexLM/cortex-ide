import { createEffect, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import { useSettings } from "@/context/SettingsContext";
import type * as Monaco from "monaco-editor";

interface EditorStickyScrollProps {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
}

export function EditorStickyScroll(props: EditorStickyScrollProps) {
  const { updateEditorSetting } = useSettings();

  createEffect(() => {
    const editor = props.editor();
    const monaco = props.monaco();
    if (!editor || !monaco) return;

    const handleToggleStickyScroll = () => {
      const opt = editor.getOption(monaco.editor.EditorOption.stickyScroll);
      const newEnabled = !opt.enabled;
      editor.updateOptions({ stickyScroll: { enabled: newEnabled, maxLineCount: 5 } });
      updateEditorSetting("stickyScrollEnabled", newEnabled);
    };

    window.addEventListener("editor:toggle-sticky-scroll", handleToggleStickyScroll);

    onCleanup(() => {
      window.removeEventListener("editor:toggle-sticky-scroll", handleToggleStickyScroll);
    });
  });

  return null;
}

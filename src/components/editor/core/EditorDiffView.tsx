import { createEffect, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { OpenFile } from "@/context/EditorContext";
import { useTesting } from "@/context/TestingContext";
import type * as Monaco from "monaco-editor";
import {
  goToNextChange,
  goToPrevChange,
} from "@/components/editor/GitGutterDecorations";
import {
  applyCoverageDecorations,
  clearCoverageDecorations,
} from "@/components/editor/modules/EditorUtils";

interface EditorDiffViewProps {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
  activeFile: Accessor<OpenFile | undefined>;
}

export function EditorDiffView(props: EditorDiffViewProps) {
  const testing = useTesting();

  createEffect(() => {
    const editor = props.editor();
    const monaco = props.monaco();
    if (!editor || !monaco) return;

    const updateCoverageDecorationsForFile = () => {
      const file = props.activeFile();
      if (!file || !testing.state.showCoverageDecorations) {
        clearCoverageDecorations(editor);
        return;
      }
      const coverage = testing.getCoverageForFile(file.path);
      if (coverage && coverage.lines.length > 0) {
        applyCoverageDecorations(editor, monaco, coverage.lines);
      } else {
        clearCoverageDecorations(editor);
      }
    };

    const handleGoToNextChange = () => {
      const file = props.activeFile();
      if (file?.path) goToNextChange(editor, file.path);
    };

    const handleGoToPrevChange = () => {
      const file = props.activeFile();
      if (file?.path) goToPrevChange(editor, file.path);
    };

    const handleCoverageUpdated = () => updateCoverageDecorationsForFile();

    const handleCoverageVisibilityChanged = (e: CustomEvent<{ visible: boolean }>) => {
      if (!e.detail) return;
      if (e.detail.visible) {
        updateCoverageDecorationsForFile();
      } else {
        clearCoverageDecorations(editor);
      }
    };

    const handleCoverageCleared = () => clearCoverageDecorations(editor);

    const handleToggleCoverageDecorations = () => testing.toggleCoverageDecorations();

    if (testing.state.showCoverageDecorations) {
      updateCoverageDecorationsForFile();
    }

    window.addEventListener("git:go-to-next-change", handleGoToNextChange);
    window.addEventListener("git:go-to-prev-change", handleGoToPrevChange);
    window.addEventListener("testing:coverage-updated", handleCoverageUpdated);
    window.addEventListener("testing:coverage-visibility-changed", handleCoverageVisibilityChanged as EventListener);
    window.addEventListener("testing:coverage-cleared", handleCoverageCleared);
    window.addEventListener("editor:toggle-coverage-decorations", handleToggleCoverageDecorations);

    onCleanup(() => {
      window.removeEventListener("git:go-to-next-change", handleGoToNextChange);
      window.removeEventListener("git:go-to-prev-change", handleGoToPrevChange);
      window.removeEventListener("testing:coverage-updated", handleCoverageUpdated);
      window.removeEventListener("testing:coverage-visibility-changed", handleCoverageVisibilityChanged as EventListener);
      window.removeEventListener("testing:coverage-cleared", handleCoverageCleared);
      window.removeEventListener("editor:toggle-coverage-decorations", handleToggleCoverageDecorations);
      clearCoverageDecorations(editor);
    });
  });

  return null;
}

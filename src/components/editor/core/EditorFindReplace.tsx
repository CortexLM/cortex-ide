import { createEffect, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import { useSettings } from "@/context/SettingsContext";
import type * as Monaco from "monaco-editor";
import {
  updateInlayHintSettings,
  getInlayHintSettings,
  getUnicodeHighlightSettings,
  updateUnicodeHighlightSettings,
  getFormatOnTypeSettings,
  updateFormatOnTypeSettings,
} from "@/components/editor/modules/EditorLSP";
import {
  getFormatOnPasteEnabled,
  updateFormatOnPasteEnabled,
  getLinkedEditingEnabled,
  setLinkedEditingEnabledState,
} from "@/components/editor/core/EditorInstance";

interface EditorFindReplaceProps {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
}

export function EditorFindReplace(props: EditorFindReplaceProps) {
  const { updateEditorSetting } = useSettings();

  createEffect(() => {
    const editor = props.editor();
    const monaco = props.monaco();
    if (!editor || !monaco) return;

    const handleFormatDocument = () => {
      editor.trigger("format", "editor.action.formatDocument", null);
    };

    const handleToggleWordWrap = () => {
      const currentWrap = editor.getOption(monaco.editor.EditorOption.wordWrap);
      editor.updateOptions({ wordWrap: currentWrap === "off" ? "on" : "off" });
    };

    const handleToggleStickyScroll = () => {
      const opt = editor.getOption(monaco.editor.EditorOption.stickyScroll);
      const newEnabled = !opt.enabled;
      editor.updateOptions({ stickyScroll: { enabled: newEnabled, maxLineCount: 5 } });
      updateEditorSetting("stickyScrollEnabled", newEnabled);
    };

    const handleToggleBracketColorization = () => {
      const opt = editor.getOption(monaco.editor.EditorOption.bracketPairColorization);
      const newEnabled = !opt.enabled;
      editor.updateOptions({
        bracketPairColorization: { enabled: newEnabled, independentColorPoolPerBracketType: true },
      });
      updateEditorSetting("bracketPairColorization", newEnabled);
    };

    const handleToggleBracketGuides = () => {
      const opt = editor.getOption(monaco.editor.EditorOption.guides);
      const newEnabled = !opt.bracketPairs;
      editor.updateOptions({
        guides: { ...opt, bracketPairs: newEnabled, bracketPairsHorizontal: newEnabled },
      });
      updateEditorSetting("guidesBracketPairs", newEnabled);
    };

    const handleToggleIndentationGuides = () => {
      const opt = editor.getOption(monaco.editor.EditorOption.guides);
      const newEnabled = !opt.indentation;
      editor.updateOptions({
        guides: { ...opt, indentation: newEnabled, highlightActiveIndentation: newEnabled },
      });
      updateEditorSetting("guidesIndentation", newEnabled);
    };

    const handleToggleInlayHints = () => {
      const opt = editor.getOption(monaco.editor.EditorOption.inlayHints);
      const newEnabled: "on" | "off" = opt.enabled === "on" ? "off" : "on";
      editor.updateOptions({ inlayHints: { ...opt, enabled: newEnabled } });
      updateInlayHintSettings({ enabled: newEnabled });
    };

    const handleToggleUnicodeHighlight = () => {
      const newEnabled = !getUnicodeHighlightSettings().enabled;
      updateUnicodeHighlightSettings({ enabled: newEnabled });
      editor.updateOptions({
        unicodeHighlight: {
          ambiguousCharacters: newEnabled ? getUnicodeHighlightSettings().ambiguousCharacters : false,
          invisibleCharacters: newEnabled ? getUnicodeHighlightSettings().invisibleCharacters : false,
          nonBasicASCII: newEnabled ? getUnicodeHighlightSettings().nonBasicASCII : false,
        },
      });
    };

    const handleUnicodeHighlightSettingsChange = (
      e: CustomEvent<{ enabled?: boolean; invisibleCharacters?: boolean; ambiguousCharacters?: boolean; nonBasicASCII?: boolean }>,
    ) => {
      const { enabled, invisibleCharacters, ambiguousCharacters, nonBasicASCII } = e.detail;
      updateUnicodeHighlightSettings({
        enabled: enabled ?? getUnicodeHighlightSettings().enabled,
        invisibleCharacters: invisibleCharacters ?? getUnicodeHighlightSettings().invisibleCharacters,
        ambiguousCharacters: ambiguousCharacters ?? getUnicodeHighlightSettings().ambiguousCharacters,
        nonBasicASCII: nonBasicASCII ?? getUnicodeHighlightSettings().nonBasicASCII,
      });
      editor.updateOptions({
        unicodeHighlight: {
          ambiguousCharacters: ambiguousCharacters ?? getUnicodeHighlightSettings().ambiguousCharacters,
          invisibleCharacters: invisibleCharacters ?? getUnicodeHighlightSettings().invisibleCharacters,
          nonBasicASCII: nonBasicASCII ?? getUnicodeHighlightSettings().nonBasicASCII,
        },
      });
    };

    const handleToggleLinkedEditing = () => {
      const newEnabled = !getLinkedEditingEnabled();
      setLinkedEditingEnabledState(newEnabled);
      editor.updateOptions({ linkedEditing: newEnabled });
      updateEditorSetting("linkedEditing", newEnabled);
    };

    const handleToggleFormatOnType = () => {
      const newEnabled = !getFormatOnTypeSettings().enabled;
      updateFormatOnTypeSettings({ enabled: newEnabled });
      editor.updateOptions({ formatOnType: newEnabled });
      updateEditorSetting("formatOnType", newEnabled);
    };

    const handleToggleFormatOnPaste = () => {
      const newEnabled = !getFormatOnPasteEnabled();
      updateFormatOnPasteEnabled(newEnabled);
      updateEditorSetting("formatOnPaste", newEnabled);
    };

    const handleInlayHintsSettingsChange = (
      e: CustomEvent<{ enabled?: "on" | "off" | "onUnlessPressed" | "offUnlessPressed"; fontSize?: number; showParameterNames?: boolean; showTypeHints?: boolean }>,
    ) => {
      const { enabled, fontSize, showParameterNames, showTypeHints } = e.detail;
      const opt = editor.getOption(monaco.editor.EditorOption.inlayHints);
      editor.updateOptions({
        inlayHints: { ...opt, enabled: enabled ?? opt.enabled, fontSize: fontSize ?? opt.fontSize },
      });
      updateInlayHintSettings({
        enabled: enabled ?? getInlayHintSettings().enabled,
        fontSize: fontSize ?? getInlayHintSettings().fontSize,
        showParameterNames: showParameterNames ?? getInlayHintSettings().showParameterNames,
        showTypeHints: showTypeHints ?? getInlayHintSettings().showTypeHints,
      });
    };

    const handleFormatOnTypeSettingsChange = (
      e: CustomEvent<{ enabled?: boolean; triggerCharacters?: string[] }>,
    ) => {
      const { enabled, triggerCharacters } = e.detail;
      if (enabled !== undefined) editor.updateOptions({ formatOnType: enabled });
      updateFormatOnTypeSettings({
        enabled: enabled ?? getFormatOnTypeSettings().enabled,
        triggerCharacters: triggerCharacters ?? getFormatOnTypeSettings().triggerCharacters,
      });
    };

    let searchDecorations: string[] = [];
    const handleBufferSearchHighlights = (
      e: CustomEvent<{ decorations: Array<{ range: { startLine: number; startColumn: number; endLine: number; endColumn: number }; isCurrent: boolean }> }>,
    ) => {
      const { decorations } = e.detail;
      const model = editor.getModel();
      if (!model) return;
      const newDecorations = decorations.map((dec) => ({
        range: new monaco.Range(dec.range.startLine, dec.range.startColumn, dec.range.endLine, dec.range.endColumn),
        options: {
          className: dec.isCurrent ? "search-match-current" : "search-match",
          overviewRuler: {
            color: dec.isCurrent ? "rgba(249, 168, 37, 1)" : "rgba(230, 180, 60, 0.7)",
            position: monaco.editor.OverviewRulerLane.Center,
          },
          minimap: {
            color: dec.isCurrent ? "rgba(249, 168, 37, 1)" : "rgba(230, 180, 60, 0.7)",
            position: monaco.editor.MinimapPosition.Inline,
          },
        },
      }));
      searchDecorations = editor.deltaDecorations(searchDecorations, newDecorations);
    };

    window.addEventListener("editor:format-document", handleFormatDocument);
    window.addEventListener("editor:toggle-word-wrap", handleToggleWordWrap);
    window.addEventListener("editor:toggle-sticky-scroll", handleToggleStickyScroll);
    window.addEventListener("editor:toggle-bracket-colorization", handleToggleBracketColorization);
    window.addEventListener("editor:toggle-bracket-guides", handleToggleBracketGuides);
    window.addEventListener("editor:toggle-indentation-guides", handleToggleIndentationGuides);
    window.addEventListener("editor:toggle-inlay-hints", handleToggleInlayHints);
    window.addEventListener("editor:toggle-unicode-highlight", handleToggleUnicodeHighlight);
    window.addEventListener("editor:unicode-highlight-settings", handleUnicodeHighlightSettingsChange as EventListener);
    window.addEventListener("editor:toggle-linked-editing", handleToggleLinkedEditing);
    window.addEventListener("editor:toggle-format-on-type", handleToggleFormatOnType);
    window.addEventListener("editor:toggle-format-on-paste", handleToggleFormatOnPaste);
    window.addEventListener("editor:inlay-hints-settings", handleInlayHintsSettingsChange as EventListener);
    window.addEventListener("editor:format-on-type-settings", handleFormatOnTypeSettingsChange as EventListener);
    window.addEventListener("buffer-search:highlights", handleBufferSearchHighlights as EventListener);

    onCleanup(() => {
      window.removeEventListener("editor:format-document", handleFormatDocument);
      window.removeEventListener("editor:toggle-word-wrap", handleToggleWordWrap);
      window.removeEventListener("editor:toggle-sticky-scroll", handleToggleStickyScroll);
      window.removeEventListener("editor:toggle-bracket-colorization", handleToggleBracketColorization);
      window.removeEventListener("editor:toggle-bracket-guides", handleToggleBracketGuides);
      window.removeEventListener("editor:toggle-indentation-guides", handleToggleIndentationGuides);
      window.removeEventListener("editor:toggle-inlay-hints", handleToggleInlayHints);
      window.removeEventListener("editor:toggle-unicode-highlight", handleToggleUnicodeHighlight);
      window.removeEventListener("editor:unicode-highlight-settings", handleUnicodeHighlightSettingsChange as EventListener);
      window.removeEventListener("editor:toggle-linked-editing", handleToggleLinkedEditing);
      window.removeEventListener("editor:toggle-format-on-type", handleToggleFormatOnType);
      window.removeEventListener("editor:toggle-format-on-paste", handleToggleFormatOnPaste);
      window.removeEventListener("editor:inlay-hints-settings", handleInlayHintsSettingsChange as EventListener);
      window.removeEventListener("editor:format-on-type-settings", handleFormatOnTypeSettingsChange as EventListener);
      window.removeEventListener("buffer-search:highlights", handleBufferSearchHighlights as EventListener);
      searchDecorations = editor.deltaDecorations(searchDecorations, []);
    });
  });

  return null;
}

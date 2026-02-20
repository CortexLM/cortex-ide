import { createEffect, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type * as Monaco from "monaco-editor";
import {
  balanceInward,
  balanceOutward,
  wrapWithAbbreviation,
  getSelectionForWrap,
} from "@/utils/emmet";

interface EditorEmmetProps {
  editor: Accessor<Monaco.editor.IStandaloneCodeEditor | null>;
  monaco: Accessor<typeof Monaco | null>;
}

export function EditorEmmet(props: EditorEmmetProps) {
  createEffect(() => {
    const editor = props.editor();
    const monaco = props.monaco();
    if (!editor || !monaco) return;

    const handleEmmetBalanceInward = () => {
      balanceInward(editor, monaco);
      editor.focus();
    };

    const handleEmmetBalanceOutward = () => {
      balanceOutward(editor, monaco);
      editor.focus();
    };

    const handleEmmetGetSelection = () => {
      const text = getSelectionForWrap(editor);
      window.dispatchEvent(
        new CustomEvent("emmet:selection-response", { detail: { text } }),
      );
    };

    const handleEmmetWrap = (e: CustomEvent<{ abbreviation: string }>) => {
      const { abbreviation } = e.detail;
      if (abbreviation) {
        wrapWithAbbreviation(editor, monaco, abbreviation);
        editor.focus();
      }
    };

    let zenModeOriginalLineNumbers: "on" | "off" | "relative" | "interval" = "on";

    const getLineNumbersString = (renderType: number): "on" | "off" | "relative" | "interval" => {
      if (renderType === 0) return "off";
      if (renderType === 1) return "on";
      if (renderType === 2) return "relative";
      return "interval";
    };

    const handleZenModeEnter = (e: CustomEvent<{ settings: { hideLineNumbers?: boolean } }>) => {
      const { settings } = e.detail || {};
      if (settings?.hideLineNumbers) {
        const opt = editor.getOption(monaco.editor.EditorOption.lineNumbers);
        zenModeOriginalLineNumbers = getLineNumbersString(opt.renderType);
        editor.updateOptions({ lineNumbers: "off" });
      }
    };

    const handleZenModeExit = (e: CustomEvent<{ savedState?: { lineNumbers?: string } }>) => {
      const { savedState } = e.detail || {};
      const restoreTo =
        (savedState?.lineNumbers as "on" | "off" | "relative" | "interval") ||
        zenModeOriginalLineNumbers || "on";
      editor.updateOptions({ lineNumbers: restoreTo });
    };

    const handleZenModeHideLineNumbers = () => {
      const opt = editor.getOption(monaco.editor.EditorOption.lineNumbers);
      zenModeOriginalLineNumbers = getLineNumbersString(opt.renderType);
      editor.updateOptions({ lineNumbers: "off" });
    };

    const handleZenModeRestoreLineNumbers = (e: CustomEvent<{ lineNumbers?: string }>) => {
      const restoreTo =
        (e.detail?.lineNumbers as "on" | "off" | "relative" | "interval") ||
        zenModeOriginalLineNumbers || "on";
      editor.updateOptions({ lineNumbers: restoreTo });
    };

    window.addEventListener("emmet:balance-inward", handleEmmetBalanceInward);
    window.addEventListener("emmet:balance-outward", handleEmmetBalanceOutward);
    window.addEventListener("emmet:get-selection", handleEmmetGetSelection);
    window.addEventListener("emmet:wrap", handleEmmetWrap as EventListener);
    window.addEventListener("zenmode:enter", handleZenModeEnter as EventListener);
    window.addEventListener("zenmode:exit", handleZenModeExit as EventListener);
    window.addEventListener("zenmode:hide-line-numbers", handleZenModeHideLineNumbers);
    window.addEventListener("zenmode:restore-line-numbers", handleZenModeRestoreLineNumbers as EventListener);

    onCleanup(() => {
      window.removeEventListener("emmet:balance-inward", handleEmmetBalanceInward);
      window.removeEventListener("emmet:balance-outward", handleEmmetBalanceOutward);
      window.removeEventListener("emmet:get-selection", handleEmmetGetSelection);
      window.removeEventListener("emmet:wrap", handleEmmetWrap as EventListener);
      window.removeEventListener("zenmode:enter", handleZenModeEnter as EventListener);
      window.removeEventListener("zenmode:exit", handleZenModeExit as EventListener);
      window.removeEventListener("zenmode:hide-line-numbers", handleZenModeHideLineNumbers);
      window.removeEventListener("zenmode:restore-line-numbers", handleZenModeRestoreLineNumbers as EventListener);
    });
  });

  return null;
}

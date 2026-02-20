import { Component, JSX, createSignal, createMemo } from "solid-js";
import { CortexIcon, CortexTooltip } from "../primitives";
import { useStatusBar } from "@/context/StatusBarContext";
import { QuickPickMenu, type QuickPickItem } from "./QuickPickMenu";

export interface EditorStatusBarItemsProps {
  class?: string;
  style?: JSX.CSSProperties;
}

type ActiveMenu = "encoding" | "lineEnding" | "indentation" | null;

const ENCODING_ITEMS: QuickPickItem[] = [
  { id: "utf-8", label: "UTF-8" },
  { id: "utf-16le", label: "UTF-16 LE" },
  { id: "utf-16be", label: "UTF-16 BE" },
  { id: "windows-1252", label: "Windows 1252" },
  { id: "iso-8859-1", label: "ISO 8859-1" },
  { id: "ascii", label: "ASCII" },
];

const LINE_ENDING_ITEMS: QuickPickItem[] = [
  { id: "LF", label: "LF", description: "Unix / macOS" },
  { id: "CRLF", label: "CRLF", description: "Windows" },
];

const INDENTATION_ITEMS: QuickPickItem[] = [
  { id: "spaces-2", label: "Spaces: 2" },
  { id: "spaces-4", label: "Spaces: 4" },
  { id: "spaces-8", label: "Spaces: 8" },
  { id: "tabs-2", label: "Tabs: 2", description: "Tab Size: 2" },
  { id: "tabs-4", label: "Tabs: 4", description: "Tab Size: 4" },
  { id: "tabs-8", label: "Tabs: 8", description: "Tab Size: 8" },
];

export const EditorStatusBarItems: Component<EditorStatusBarItemsProps> = (props) => {
  const statusBar = useStatusBar();
  const editorInfo = createMemo(() => statusBar.editorInfo());

  const [activeMenu, setActiveMenu] = createSignal<ActiveMenu>(null);
  let encodingRef: HTMLDivElement | undefined;
  let lineEndingRef: HTMLDivElement | undefined;
  let indentationRef: HTMLDivElement | undefined;

  const [wordWrapEnabled, setWordWrapEnabled] = createSignal(false);

  const itemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
    padding: "2px 6px",
    "border-radius": "var(--cortex-radius-sm)",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "2px",
    ...props.style,
  });

  const toggleMenu = (menu: ActiveMenu) => {
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  const handleWordWrapToggle = () => {
    const next = !wordWrapEnabled();
    setWordWrapEnabled(next);
    window.dispatchEvent(
      new CustomEvent("editor:toggle-word-wrap", {
        detail: { enabled: next },
      })
    );
  };

  const handleEncodingSelect = (item: QuickPickItem) => {
    setActiveMenu(null);
    window.dispatchEvent(
      new CustomEvent("editor:encoding-change", {
        detail: { encoding: item.label },
      })
    );
  };

  const handleLineEndingSelect = (item: QuickPickItem) => {
    setActiveMenu(null);
    window.dispatchEvent(
      new CustomEvent("editor:line-ending-change", {
        detail: { lineEnding: item.id as "LF" | "CRLF" },
      })
    );
  };

  const handleIndentationSelect = (item: QuickPickItem) => {
    setActiveMenu(null);
    const [type, sizeStr] = item.id.split("-");
    window.dispatchEvent(
      new CustomEvent("editor:indentation-change", {
        detail: {
          type: type as "spaces" | "tabs",
          size: parseInt(sizeStr, 10),
        },
      })
    );
  };

  const indentationLabel = createMemo(() => {
    const info = editorInfo().indentation;
    return `${info.type === "spaces" ? "Spaces" : "Tabs"}: ${info.size}`;
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <CortexTooltip content="Toggle Word Wrap" position="top">
        <div
          style={{
            ...itemStyle,
            color: wordWrapEnabled()
              ? "var(--cortex-accent-primary, #BFFF00)"
              : "var(--cortex-text-muted)",
          }}
          onClick={handleWordWrapToggle}
          role="button"
          aria-label="Toggle Word Wrap"
          aria-pressed={wordWrapEnabled()}
        >
          <CortexIcon name="text-width" size={12} />
          <span>{wordWrapEnabled() ? "Wrap" : "No Wrap"}</span>
        </div>
      </CortexTooltip>

      <CortexTooltip content={`Encoding: ${editorInfo().encoding}`} position="top">
        <div
          ref={encodingRef}
          style={itemStyle}
          onClick={() => toggleMenu("encoding")}
          role="button"
          aria-label="Select Encoding"
          aria-expanded={activeMenu() === "encoding"}
        >
          <span>{editorInfo().encoding}</span>
        </div>
      </CortexTooltip>

      <CortexTooltip content={`Line Ending: ${editorInfo().lineEnding}`} position="top">
        <div
          ref={lineEndingRef}
          style={itemStyle}
          onClick={() => toggleMenu("lineEnding")}
          role="button"
          aria-label="Select Line Ending"
          aria-expanded={activeMenu() === "lineEnding"}
        >
          <span>{editorInfo().lineEnding}</span>
        </div>
      </CortexTooltip>

      <CortexTooltip content={`Indentation: ${indentationLabel()}`} position="top">
        <div
          ref={indentationRef}
          style={itemStyle}
          onClick={() => toggleMenu("indentation")}
          role="button"
          aria-label="Select Indentation"
          aria-expanded={activeMenu() === "indentation"}
        >
          <span>{indentationLabel()}</span>
        </div>
      </CortexTooltip>

      <QuickPickMenu
        items={ENCODING_ITEMS}
        visible={activeMenu() === "encoding"}
        anchorRef={encodingRef}
        onSelect={handleEncodingSelect}
        onClose={() => setActiveMenu(null)}
        title="Select Encoding"
        searchable
      />

      <QuickPickMenu
        items={LINE_ENDING_ITEMS}
        visible={activeMenu() === "lineEnding"}
        anchorRef={lineEndingRef}
        onSelect={handleLineEndingSelect}
        onClose={() => setActiveMenu(null)}
        title="Select Line Ending"
      />

      <QuickPickMenu
        items={INDENTATION_ITEMS}
        visible={activeMenu() === "indentation"}
        anchorRef={indentationRef}
        onSelect={handleIndentationSelect}
        onClose={() => setActiveMenu(null)}
        title="Select Indentation"
      />
    </div>
  );
};

export default EditorStatusBarItems;

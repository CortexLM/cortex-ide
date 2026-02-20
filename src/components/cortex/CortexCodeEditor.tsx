/**
 * CortexCodeEditor - Pixel-perfect code editor shell matching Figma design
 *
 * Structure:
 * - Tab Bar: CortexEditorTabs (47px)
 * - Editor Content: Monaco wrapper (flex)
 * - Status Bar: CortexStatusBar (28px)
 *
 * Integrates CortexEditorTabs and CortexStatusBar for a complete editor frame.
 * Actual editing uses Monaco Editor passed via children slot.
 */

import { Component, JSX, splitProps } from "solid-js";
import { CortexIcon } from "./primitives";
import { CortexEditorTabs, type EditorTab } from "./CortexEditorTabs";
import { CortexStatusBar } from "./CortexStatusBar";

export type { EditorTab };

export interface CortexCodeEditorProps {
  tabs?: EditorTab[];
  activeTabId?: string | null;
  onTabClick?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onTabCloseOthers?: (id: string) => void;
  onTabCloseAll?: () => void;
  onTabReorder?: (sourceId: string, targetId: string) => void;
  onNewTab?: () => void;
  currentLine?: number;
  currentColumn?: number;
  selectionCount?: number;
  language?: string;
  encoding?: string;
  lineEnding?: "LF" | "CRLF" | "CR";
  indentType?: "spaces" | "tabs";
  indentSize?: number;
  branchName?: string | null;
  notificationCount?: number;
  onLanguageClick?: () => void;
  onEncodingClick?: () => void;
  onLineEndingClick?: () => void;
  onIndentationClick?: () => void;
  onNotificationClick?: () => void;
  onBranchClick?: () => void;
  onTogglePanel?: () => void;
  onToggleTerminal?: () => void;
  children?: JSX.Element;
  class?: string;
  style?: JSX.CSSProperties;
}

const SAMPLE_TABS: EditorTab[] = [
  { id: "1", name: "SurveyQuestion.tsx" },
  { id: "2", name: "Cargo.toml" },
  { id: "3", name: "build.rs" },
];

export const CortexCodeEditor: Component<CortexCodeEditorProps> = (props) => {
  const [local, others] = splitProps(props, [
    "tabs",
    "activeTabId",
    "onTabClick",
    "onTabClose",
    "onTabCloseOthers",
    "onTabCloseAll",
    "onTabReorder",
    "onNewTab",
    "currentLine",
    "currentColumn",
    "selectionCount",
    "language",
    "encoding",
    "lineEnding",
    "indentType",
    "indentSize",
    "branchName",
    "notificationCount",
    "onLanguageClick",
    "onEncodingClick",
    "onLineEndingClick",
    "onIndentationClick",
    "onNotificationClick",
    "onBranchClick",
    "onTogglePanel",
    "onToggleTerminal",
    "children",
    "class",
    "style",
  ]);

  const tabs = () => local.tabs || SAMPLE_TABS;
  const activeTabId = () => local.activeTabId ?? tabs()[0]?.id ?? null;

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    width: "100%",
    height: "100%",
    background: "var(--cortex-bg-primary, #141415)",
    overflow: "hidden",
    ...local.style,
  });

  const editorContentStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    background: "var(--cortex-bg-secondary, #1C1C1D)",
  });

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      {/* Tab Bar */}
      <CortexEditorTabs
        tabs={tabs()}
        activeTabId={activeTabId()}
        onTabSelect={local.onTabClick}
        onTabClose={local.onTabClose}
        onTabCloseOthers={local.onTabCloseOthers}
        onTabCloseAll={local.onTabCloseAll}
        onTabReorder={local.onTabReorder}
        onNewTab={local.onNewTab}
      />

      {/* Editor Content (Monaco slot) */}
      <div style={editorContentStyle()}>
        {local.children || <EditorPlaceholder />}
      </div>

      {/* Status Bar */}
      <CortexStatusBar
        variant="active"
        branchName={local.branchName}
        cursorLine={local.currentLine}
        cursorColumn={local.currentColumn}
        selectionCount={local.selectionCount}
        languageName={local.language}
        encoding={local.encoding}
        lineEnding={local.lineEnding}
        indentType={local.indentType}
        indentSize={local.indentSize}
        notificationCount={local.notificationCount}
        onLanguageClick={local.onLanguageClick}
        onEncodingClick={local.onEncodingClick}
        onLineEndingClick={local.onLineEndingClick}
        onIndentationClick={local.onIndentationClick}
        onNotificationClick={local.onNotificationClick}
        onBranchClick={local.onBranchClick}
        onTogglePanel={local.onTogglePanel}
        onToggleTerminal={local.onToggleTerminal}
      />
    </div>
  );
};

const EditorPlaceholder: Component = () => {
  const containerStyle = (): JSX.CSSProperties => ({
    width: "100%",
    height: "100%",
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    background: "var(--cortex-bg-secondary, #1C1C1D)",
    color: "var(--cortex-text-muted, #8C8D8F)",
    gap: "16px",
  });

  return (
    <div style={containerStyle()}>
      <CortexIcon name="file-code" size={48} />
      <span style={{ "font-size": "14px" }}>No file selected</span>
    </div>
  );
};

export default CortexCodeEditor;

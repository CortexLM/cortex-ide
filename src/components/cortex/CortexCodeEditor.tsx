/**
 * CortexCodeEditor - Pixel-perfect code editor shell matching Figma design
 *
 * Figma specs (node 5:12544, layout_D1BM8Q):
 * - Container: bg #1C1C1D, border 1px solid #2E2F31, border-radius 16px
 * - Structure: EditorTabBar → EditorBreadcrumbs → Monaco container
 * - Monaco area: bg #141415, flex-1, overflow hidden
 * - Scrollbar: 8px thumb, color #2E2F31, track transparent
 *
 * Sub-components extracted per 300-line rule:
 * - EditorTabBar: tab bar with file tabs
 * - EditorBreadcrumbs: path breadcrumb trail
 */

import { Component, JSX, Show, splitProps } from "solid-js";
import { CortexIcon } from "./primitives";
import { EditorTabBar } from "./EditorTabBar";
import { EditorBreadcrumbs, type BreadcrumbSegment } from "./EditorBreadcrumbs";
import { CortexStatusBar } from "./CortexStatusBar";
import type { EditorTab } from "./CortexEditorTabs";

export type { EditorTab };
export type { BreadcrumbSegment } from "./EditorBreadcrumbs";

export interface CortexCodeEditorProps {
  tabs?: EditorTab[];
  activeTabId?: string | null;
  onTabClick?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onTabCloseOthers?: (id: string) => void;
  onTabCloseAll?: () => void;
  onTabReorder?: (sourceId: string, targetId: string) => void;
  onNewTab?: () => void;
  breadcrumbs?: BreadcrumbSegment[];
  language?: string;
  branchName?: string | null;
  notificationCount?: number;
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

const DEFAULT_BREADCRUMBS: BreadcrumbSegment[] = [
  { label: "node" },
  { label: "src" },
  { label: "main.rs" },
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
    "breadcrumbs",
    "language",
    "branchName",
    "notificationCount",
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
  const breadcrumbs = () => local.breadcrumbs || DEFAULT_BREADCRUMBS;

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    width: "100%",
    height: "100%",
    background: "#1C1C1D",
    border: "1px solid #2E2F31",
    "border-radius": "16px",
    overflow: "hidden",
    ...local.style,
  });

  const editorContentStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    background: "#141415",
  });

  return (
    <div class={`cortex-code-editor ${local.class || ""}`} style={containerStyle()} {...others}>
      <EditorTabBar
        tabs={tabs()}
        activeTabId={activeTabId()}
        onTabSelect={local.onTabClick}
        onTabClose={local.onTabClose}
        onTabCloseOthers={local.onTabCloseOthers}
        onTabCloseAll={local.onTabCloseAll}
        onTabReorder={local.onTabReorder}
        onNewTab={local.onNewTab}
      />

      <Show when={breadcrumbs().length > 0}>
        <EditorBreadcrumbs segments={breadcrumbs()} />
      </Show>

      <div style={editorContentStyle()}>
        {local.children || <EditorPlaceholder />}
      </div>

      <CortexStatusBar
        variant="active"
        branchName={local.branchName}
        languageName={local.language}
        notificationCount={local.notificationCount}
        onNotificationClick={local.onNotificationClick}
        onBranchClick={local.onBranchClick}
        onTogglePanel={local.onTogglePanel}
        onToggleTerminal={local.onToggleTerminal}
      />

      <style>{`
        .cortex-code-editor .monaco-editor,
        .cortex-code-editor .monaco-editor .overflow-guard {
          border-radius: 0;
        }
        .cortex-code-editor .monaco-editor .monaco-scrollable-element > .scrollbar > .slider {
          background: #2E2F31 !important;
          border-radius: 4px;
        }
        .cortex-code-editor .monaco-editor .monaco-scrollable-element > .scrollbar.vertical {
          width: 8px !important;
        }
        .cortex-code-editor .monaco-editor .monaco-scrollable-element > .scrollbar.vertical > .slider {
          width: 8px !important;
        }
        .cortex-code-editor .monaco-editor .monaco-scrollable-element > .scrollbar.horizontal {
          height: 8px !important;
        }
        .cortex-code-editor .monaco-editor .monaco-scrollable-element > .scrollbar.horizontal > .slider {
          height: 8px !important;
        }
        .cortex-code-editor .monaco-editor .monaco-scrollable-element > .scrollbar {
          background: transparent !important;
        }
      `}</style>
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
    background: "#141415",
    color: "#8C8D8F",
    gap: "16px",
  });

  return (
    <div style={containerStyle()}>
      <CortexIcon name="file-code" size={48} />
      <span style={{ "font-size": "14px", "font-family": "'Figtree', sans-serif" }}>No file selected</span>
    </div>
  );
};

export default CortexCodeEditor;

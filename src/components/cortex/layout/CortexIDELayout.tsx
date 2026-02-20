import { JSX, Show, Suspense, lazy } from "solid-js";
import CortexActivityBar from "@/components/cortex/CortexActivityBar";
import CortexChatPanel, { ChatPanelState, ChatMessage } from "@/components/cortex/CortexChatPanel";
import { CortexStatusBar } from "@/components/cortex/CortexStatusBar";
import { CortexSidebarContainer } from "./CortexSidebarContainer";
import { CortexBottomPanelContainer } from "./CortexBottomPanelContainer";
import type { SidebarTab, BottomPanelTab } from "./types";

const EditorPanel = lazy(() => import("@/components/editor/EditorPanel").then(m => ({ default: m.EditorPanel })));

export interface CortexIDELayoutProps {
  sidebarTab: SidebarTab;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  isResizing: boolean;
  projectPath: string | null;
  bottomPanelTab: BottomPanelTab;
  bottomPanelCollapsed: boolean;
  bottomPanelHeight: number;
  chatState: ChatPanelState;
  chatMessages: ChatMessage[];
  chatInput: string;
  isProcessing: boolean;
  modelName: string;
  onNavItemClick: (id: string) => void;
  onAvatarClick: () => void;
  onFileSelect: (filePath: string) => void;
  onSidebarWidthChange: (width: number) => void;
  onResizingChange: (resizing: boolean) => void;
  onBottomPanelTabChange: (tab: BottomPanelTab) => void;
  onBottomPanelCollapse: () => void;
  onBottomPanelHeightChange: (height: number) => void;
  onChatInputChange: (value: string) => void;
  onChatSubmit: (value: string) => void;
  branchName?: string | null;
  isSyncing?: boolean;
  hasChanges?: boolean;
  cursorLine?: number;
  cursorColumn?: number;
  selectionCount?: number;
  languageName?: string;
  encoding?: string;
  lineEnding?: "LF" | "CRLF" | "CR";
  indentType?: "spaces" | "tabs";
  indentSize?: number;
  onBranchClick?: () => void;
  onCursorClick?: () => void;
  onLanguageClick?: () => void;
  onEncodingClick?: () => void;
  onLineEndingClick?: () => void;
  onIndentationClick?: () => void;
  onTogglePanel?: () => void;
  onToggleTerminal?: () => void;
}

export function CortexIDELayout(props: CortexIDELayoutProps) {
  const editorContainerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    "min-width": "0",
    height: "calc(100% - var(--cortex-space-4))",
    "margin-top": "var(--cortex-space-2)",
    "margin-bottom": "var(--cortex-space-2)",
    "margin-left": "var(--cortex-space-3)",
    "margin-right": "var(--cortex-space-2)",
    background: "var(--cortex-bg-primary)",
    "border-radius": "var(--cortex-container-radius, 24px)",
    border: "1px solid var(--cortex-border-default)",
    "box-shadow": "var(--cortex-panel-shadow)",
    transition: "box-shadow 200ms ease-out",
  });

  return (
    <>
      <CortexActivityBar
        activeId={props.sidebarCollapsed ? null : props.sidebarTab}
        onItemClick={props.onNavItemClick}
        onAvatarClick={props.onAvatarClick}
      />

      <div style={{ display: "flex", flex: "1", overflow: "hidden", "flex-direction": "column" }}>
        <div style={{ display: "flex", flex: "1", overflow: "hidden" }}>
          <CortexSidebarContainer
            sidebarTab={props.sidebarTab}
            sidebarCollapsed={props.sidebarCollapsed}
            sidebarWidth={props.sidebarWidth}
            isResizing={props.isResizing}
            projectPath={props.projectPath}
            onFileSelect={props.onFileSelect}
            onSidebarWidthChange={props.onSidebarWidthChange}
            onResizingChange={props.onResizingChange}
          />

          <div style={editorContainerStyle()}>
            <Suspense fallback={
              <div style={{
                flex: "1",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                background: "var(--cortex-bg-primary)",
              }}>
                <div style={{
                  width: "32px",
                  height: "32px",
                  border: "2px solid var(--cortex-text-muted)",
                  "border-top-color": "var(--cortex-accent-primary, var(--cortex-accent-primary))",
                  "border-radius": "var(--cortex-radius-full)",
                  animation: "spin 0.8s linear infinite",
                }} />
              </div>
            }>
              <EditorPanel />
            </Suspense>

            <CortexBottomPanelContainer
              bottomPanelTab={props.bottomPanelTab}
              bottomPanelCollapsed={props.bottomPanelCollapsed}
              bottomPanelHeight={props.bottomPanelHeight}
              onTabChange={props.onBottomPanelTabChange}
              onCollapse={props.onBottomPanelCollapse}
              onHeightChange={props.onBottomPanelHeightChange}
            />
          </div>
        </div>

        <CortexStatusBar
          branchName={props.branchName}
          isSyncing={props.isSyncing}
          hasChanges={props.hasChanges}
          cursorLine={props.cursorLine}
          cursorColumn={props.cursorColumn}
          selectionCount={props.selectionCount}
          languageName={props.languageName}
          encoding={props.encoding}
          lineEnding={props.lineEnding}
          indentType={props.indentType}
          indentSize={props.indentSize}
          onBranchClick={props.onBranchClick}
          onCursorClick={props.onCursorClick}
          onLanguageClick={props.onLanguageClick}
          onEncodingClick={props.onEncodingClick}
          onLineEndingClick={props.onLineEndingClick}
          onIndentationClick={props.onIndentationClick}
          onTogglePanel={props.onTogglePanel}
          onToggleTerminal={props.onToggleTerminal}
        />
      </div>

      <Show when={props.chatState === "expanded"}>
        <CortexChatPanel
          state={props.chatState}
          messages={props.chatMessages}
          inputValue={props.chatInput}
          onInputChange={props.onChatInputChange}
          onSubmit={props.onChatSubmit}
          isProcessing={props.isProcessing}
          modelName={props.modelName}
          style={{
            position: "absolute",
            right: "16px",
            bottom: "44px",
            "z-index": "100",
          }}
        />
      </Show>
    </>
  );
}

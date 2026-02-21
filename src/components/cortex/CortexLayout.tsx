/**
 * CortexLayout - Complete layout assembling all Figma components
 * 
 * Layout Structure:
 * ┌─────────────────────────────────────────────────────┐
 * │                    TitleBar (57px)                   │
 * ├────┬────────────┬───────────────────────────────────┤
 * │    │            │                                    │
 * │ A  │   File     │                                    │
 * │ c  │  Explorer  │         Code Editor                │
 * │ t  │  (317px)   │         (flex)                     │
 * │ i  │            │                                    │
 * │ v  │            │                                    │
 * │ i  │            │                                    │
 * │ t  │            │                                    │
 * │ y  │            │                                    │
 * │    │            │                                    │
 * │ B  │            │                                    │
 * │ a  ├────────────┤                                    │
 * │ r  │   Chat     │                                    │
 * │    │  (overlay) │                                    │
 * │40px│            │                                    │
 * ├────┴────────────┴───────────────────────────────────┤
 * │                   StatusBar (28px)                   │
 * └─────────────────────────────────────────────────────┘
 */

import { Component, JSX, splitProps, Show } from "solid-js";
import CortexTitleBar from "./CortexTitleBar";
import CortexActivityBar from "./CortexActivityBar";
import CortexFileExplorer from "./CortexFileExplorer";
import CortexCodeEditor from "./CortexCodeEditor";
import CortexChatPanel, { ChatPanelState, ChatMessage } from "./CortexChatPanel";
// CortexStatusBar removed
import { TreeItemData } from "./primitives";

export interface CortexLayoutProps {
  // TitleBar props
  appName?: string;
  currentPage?: string;
  isDraft?: boolean;
  
  // Mode
  mode?: "vibe" | "ide";
  onModeChange?: (mode: "vibe" | "ide") => void;
  
  // Theme
  isDarkMode?: boolean;
  onThemeChange?: (isDark: boolean) => void;
  
  // Window controls
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  
  // Activity Bar
  activeNavId?: string | null;
  onNavItemClick?: (id: string) => void;
  avatarUrl?: string;
  onAvatarClick?: () => void;
  
  // File Explorer
  explorerTitle?: string;
  explorerItems?: TreeItemData[];
  selectedFileId?: string | null;
  expandedFolderIds?: Set<string>;
  onFileSelect?: (item: TreeItemData) => void;
  onFolderToggle?: (item: TreeItemData) => void;
  showExplorer?: boolean;
  
  // Code Editor
  editorTabs?: Array<{
    id: string;
    name: string;
    icon?: string;
    isModified?: boolean;
  }>;
  activeTabId?: string | null;
  onTabClick?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onNewTab?: () => void;
  currentLine?: number;
  currentColumn?: number;
  language?: string;
  editorContent?: JSX.Element;
  
  // Chat Panel
  chatState?: ChatPanelState;
  chatMessages?: ChatMessage[];
  chatInputValue?: string;
  onChatInputChange?: (value: string) => void;
  onChatSubmit?: (value: string) => void;
  onChatStop?: () => void;
  isChatProcessing?: boolean;
  modelName?: string;
  modelIcon?: string;
  onModelClick?: () => void;
  
  // Status Bar
  projectType?: string;
  projectName?: string;
  
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexLayout: Component<CortexLayoutProps> = (props) => {
  const [local, others] = splitProps(props, [
    "appName",
    "currentPage",
    "isDraft",
    "mode",
    "onModeChange",
    "isDarkMode",
    "onThemeChange",
    "onMinimize",
    "onMaximize",
    "onClose",
    "activeNavId",
    "onNavItemClick",
    "avatarUrl",
    "onAvatarClick",
    "explorerTitle",
    "explorerItems",
    "selectedFileId",
    "expandedFolderIds",
    "onFileSelect",
    "onFolderToggle",
    "showExplorer",
    "editorTabs",
    "activeTabId",
    "onTabClick",
    "onTabClose",
    "onNewTab",
    "currentLine",
    "currentColumn",
    "language",
    "editorContent",
    "chatState",
    "chatMessages",
    "chatInputValue",
    "onChatInputChange",
    "onChatSubmit",
    "onChatStop",
    "isChatProcessing",
    "modelName",
    "modelIcon",
    "onModelClick",
    "projectType",
    "projectName",
    "class",
    "style",
  ]);

  // Default to IDE mode showing explorer
  const mode = () => local.mode || "ide";
  const showExplorer = () => local.showExplorer ?? (mode() === "ide");
  const chatState = () => local.chatState || (mode() === "vibe" ? "home" : "minimized");

  // Root container - full viewport
  const rootStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    width: "100vw",
    height: "100vh",
    background: "var(--cortex-bg-primary)",
    overflow: "hidden",
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    color: "var(--cortex-text-primary, var(--cortex-text-primary))",
    ...local.style,
  });

  // Main content area (below title bar, above status bar)
  const mainContentStyle = (): JSX.CSSProperties => ({
    display: "flex",
    flex: "1",
    overflow: "hidden",
    position: "relative",
  });

  // Content area (next to activity bar)
  const contentAreaStyle = (): JSX.CSSProperties => ({
    display: "flex",
    flex: "1",
    overflow: "hidden",
  });

  // Editor container
  const editorContainerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
  });

  return (
    <div class={local.class} style={rootStyle()} {...others}>
      {/* Title Bar */}
      <CortexTitleBar
        appName={local.appName}
        currentPage={local.currentPage}
        isDraft={local.isDraft}
        mode={mode()}
        onModeChange={local.onModeChange}
        isDarkMode={local.isDarkMode ?? true}
        onThemeChange={local.onThemeChange}
        onMinimize={local.onMinimize}
        onMaximize={local.onMaximize}
        onClose={local.onClose}
      />

      {/* Main Content */}
      <main style={mainContentStyle()}>
        {/* Activity Bar */}
        <CortexActivityBar
          activeId={local.activeNavId}
          onItemClick={local.onNavItemClick}
          avatarUrl={local.avatarUrl}
          onAvatarClick={local.onAvatarClick}
        />

        {/* Content Area */}
        <div style={contentAreaStyle()}>
          {/* File Explorer (conditionally shown) */}
          <Show when={showExplorer()}>
            <CortexFileExplorer
              title={local.explorerTitle}
              items={local.explorerItems}
              selectedId={local.selectedFileId}
              expandedIds={local.expandedFolderIds}
              onSelect={local.onFileSelect}
              onToggle={local.onFolderToggle}
              projectType={local.projectType}
              projectName={local.projectName}
            />
          </Show>

          {/* Editor or Home Chat */}
          <Show
            when={mode() === "ide" || chatState() !== "home"}
            fallback={
              <CortexChatPanel
                state="home"
                messages={local.chatMessages}
                inputValue={local.chatInputValue}
                onInputChange={local.onChatInputChange}
                onSubmit={local.onChatSubmit}
                onStop={local.onChatStop}
                isProcessing={local.isChatProcessing}
                modelName={local.modelName}
                modelIcon={local.modelIcon}
                onModelClick={local.onModelClick}
              />
            }
          >
            <div style={editorContainerStyle()}>
              <CortexCodeEditor
                tabs={local.editorTabs}
                activeTabId={local.activeTabId}
                onTabClick={local.onTabClick}
                onTabClose={local.onTabClose}
                onNewTab={local.onNewTab}
                language={local.language}
              >
                {local.editorContent}
              </CortexCodeEditor>
            </div>
          </Show>
        </div>

        {/* Chat Panel Overlay (minimized or expanded in IDE mode) */}
        <Show when={mode() === "ide" && chatState() !== "home"}>
          <CortexChatPanel
            state={chatState()}
            messages={local.chatMessages}
            inputValue={local.chatInputValue}
            onInputChange={local.onChatInputChange}
            onSubmit={local.onChatSubmit}
            onStop={local.onChatStop}
            isProcessing={local.isChatProcessing}
            modelName={local.modelName}
            modelIcon={local.modelIcon}
            onModelClick={local.onModelClick}
          />
        </Show>
      </main>

    </div>
  );
};

export default CortexLayout;



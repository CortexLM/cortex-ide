import { Component, createSignal, Show, type JSX } from "solid-js";
import { CortexDiffEditor } from "./editor/CortexDiffEditor";
import { CortexIcon, CortexTooltip, CortexIconButton } from "./primitives";

type ViewMode = "inline" | "side-by-side";

export interface CortexGitDiffViewProps {
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  language: string;
  staged?: boolean;
  onClose?: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const fileName = (filePath: string): string => {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
};

const dirPath = (filePath: string): string => {
  const parts = filePath.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
};

const containerStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  height: "100%",
  overflow: "hidden",
  background: "var(--cortex-bg-secondary)",
  color: "var(--cortex-text-primary)",
  "font-family": "var(--cortex-font-sans)",
  "font-size": "13px",
};

const headerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  height: "40px",
  padding: "0 12px",
  "border-bottom": "1px solid var(--cortex-bg-hover)",
  "flex-shrink": "0",
  gap: "8px",
};

const fileInfoStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  flex: "1",
  "min-width": "0",
  overflow: "hidden",
};

const fileNameStyle: JSX.CSSProperties = {
  "font-weight": "500",
  color: "var(--cortex-text-primary)",
  "white-space": "nowrap",
  overflow: "hidden",
  "text-overflow": "ellipsis",
};

const dirPathStyle: JSX.CSSProperties = {
  color: "var(--cortex-text-inactive)",
  "font-size": "12px",
  "white-space": "nowrap",
  overflow: "hidden",
  "text-overflow": "ellipsis",
};

const stagedBadgeStyle: JSX.CSSProperties = {
  background: "var(--cortex-success)",
  color: "var(--cortex-accent-text)",
  padding: "1px 6px",
  "border-radius": "var(--cortex-radius-lg)",
  "font-size": "10px",
  "font-weight": "600",
  "text-transform": "uppercase",
  "letter-spacing": "0.5px",
  "flex-shrink": "0",
};

const controlsStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "4px",
  "flex-shrink": "0",
};

const navGroupStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "2px",
};

const separatorStyle: JSX.CSSProperties = {
  width: "1px",
  height: "16px",
  background: "var(--cortex-bg-hover)",
  margin: "0 4px",
  "flex-shrink": "0",
};

const viewToggleStyle = (active: boolean): JSX.CSSProperties => ({
  background: active ? "rgba(255,255,255,0.1)" : "transparent",
  border: "none",
  color: active ? "var(--cortex-text-primary)" : "var(--cortex-text-inactive)",
  cursor: "pointer",
  padding: "4px 8px",
  "border-radius": "var(--cortex-radius-sm)",
  "font-size": "11px",
  "font-family": "var(--cortex-font-sans)",
  transition: "all 150ms ease",
  "white-space": "nowrap",
});

const editorContainerStyle: JSX.CSSProperties = {
  flex: "1",
  overflow: "hidden",
  position: "relative",
};

export const CortexGitDiffView: Component<CortexGitDiffViewProps> = (props) => {
  const [viewMode, setViewMode] = createSignal<ViewMode>("inline");

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={fileInfoStyle}>
          <CortexIcon name="file" size={14} color="var(--cortex-text-inactive)" />
          <span style={fileNameStyle}>{fileName(props.filePath)}</span>
          <Show when={dirPath(props.filePath)}>
            <span style={dirPathStyle}>{dirPath(props.filePath)}</span>
          </Show>
          <Show when={props.staged}>
            <span style={stagedBadgeStyle}>Staged</span>
          </Show>
        </div>

        <div style={controlsStyle}>
          <div style={navGroupStyle}>
            <CortexTooltip content="Previous file">
              <CortexIconButton
                icon="chevron-left"
                size={20}
                onClick={() => props.onNavigatePrev?.()}
                disabled={!props.hasPrev}
                title="Previous file"
              />
            </CortexTooltip>
            <CortexTooltip content="Next file">
              <CortexIconButton
                icon="chevron-right"
                size={20}
                onClick={() => props.onNavigateNext?.()}
                disabled={!props.hasNext}
                title="Next file"
              />
            </CortexTooltip>
          </div>

          <div style={separatorStyle} />

          <div style={navGroupStyle}>
            <button
              style={viewToggleStyle(viewMode() === "inline")}
              onClick={() => setViewMode("inline")}
              title="Inline diff"
            >
              Inline
            </button>
            <button
              style={viewToggleStyle(viewMode() === "side-by-side")}
              onClick={() => setViewMode("side-by-side")}
              title="Side-by-side diff"
            >
              Split
            </button>
          </div>

          <div style={separatorStyle} />

          <CortexTooltip content="Close diff view">
            <CortexIconButton
              icon="xmark"
              size={20}
              onClick={() => props.onClose?.()}
              title="Close"
            />
          </CortexTooltip>
        </div>
      </div>

      <div style={editorContainerStyle}>
        <CortexDiffEditor
          originalContent={props.originalContent}
          modifiedContent={props.modifiedContent}
          language={props.language}
          filePath={props.filePath}
          staged={props.staged}
          readOnly
        />
      </div>
    </div>
  );
};

export default CortexGitDiffView;

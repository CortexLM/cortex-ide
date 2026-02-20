import type { JSX } from "solid-js";

export const modalStyles = {
  conflictIndicator: {
    color: "var(--vscode-errorForeground, var(--cortex-error))",
    "font-size": "14px",
    cursor: "help",
  } as JSX.CSSProperties,

  sourceCell: {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  } as JSX.CSSProperties,

  sourceBadge: {
    padding: "2px 6px",
    "border-radius": "var(--cortex-radius-lg)",
    "font-size": "11px",
    "text-transform": "capitalize",
  } as JSX.CSSProperties,

  sourceBadgeDefault: {
    "background-color": "var(--vscode-textBlockQuote-background, var(--cortex-bg-hover))",
    color: "var(--vscode-textBlockQuote-border, var(--cortex-text-inactive))",
  } as JSX.CSSProperties,

  sourceBadgeUser: {
    "background-color": "var(--vscode-gitDecoration-modifiedResourceForeground, var(--cortex-warning))",
    color: "var(--vscode-editor-background, var(--cortex-bg-primary))",
  } as JSX.CSSProperties,

  sourceBadgeExtension: {
    "background-color": "var(--vscode-gitDecoration-untrackedResourceForeground, var(--cortex-success))",
    color: "var(--vscode-editor-background, var(--cortex-bg-primary))",
  } as JSX.CSSProperties,

  whenCell: {
    "font-family": "var(--vscode-editor-font-family, monospace)",
    "font-size": "11px",
    opacity: "0.8",
  } as JSX.CSSProperties,

  actionButtons: {
    display: "flex",
    gap: "4px",
    "margin-left": "auto",
  } as JSX.CSSProperties,

  actionButton: {
    padding: "4px 8px",
    border: "none",
    "border-radius": "var(--cortex-radius-sm)",
    "background-color": "var(--vscode-button-secondaryBackground, var(--cortex-bg-hover))",
    color: "var(--vscode-button-secondaryForeground, var(--cortex-text-primary))",
    cursor: "pointer",
    "font-size": "12px",
    display: "flex",
    "align-items": "center",
    gap: "4px",
  } as JSX.CSSProperties,

  primaryButton: {
    "background-color": "var(--vscode-button-background, var(--cortex-info))",
    color: "var(--vscode-button-foreground, var(--cortex-text-primary))",
  } as JSX.CSSProperties,

  dangerButton: {
    "background-color": "var(--vscode-errorForeground, var(--cortex-error))",
    color: "var(--vscode-editor-background, var(--cortex-bg-primary))",
  } as JSX.CSSProperties,

  modalOverlay: {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    "background-color": "rgba(0, 0, 0, 0.5)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "z-index": "1000",
  } as JSX.CSSProperties,

  modal: {
    "background-color": "var(--vscode-editorWidget-background, var(--cortex-bg-primary))",
    border: "1px solid var(--vscode-editorWidget-border, var(--cortex-bg-active))",
    "border-radius": "var(--cortex-radius-sm)",
    padding: "16px",
    "min-width": "400px",
    "max-width": "600px",
    "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.3)",
  } as JSX.CSSProperties,

  modalTitle: {
    "font-size": "14px",
    "font-weight": "600",
    "margin-bottom": "16px",
    "padding-bottom": "8px",
    "border-bottom": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
  } as JSX.CSSProperties,

  modalField: {
    "margin-bottom": "12px",
  } as JSX.CSSProperties,

  modalLabel: {
    display: "block",
    "margin-bottom": "4px",
    "font-size": "12px",
    opacity: "0.8",
  } as JSX.CSSProperties,

  modalInput: {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid var(--vscode-input-border, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-sm)",
    "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
    color: "var(--vscode-input-foreground, var(--cortex-text-primary))",
    "font-size": "13px",
    "font-family": "var(--vscode-editor-font-family, monospace)",
    outline: "none",
    "box-sizing": "border-box",
  } as JSX.CSSProperties,

  recordButton: {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: "8px",
    width: "100%",
    padding: "12px",
    border: "2px dashed var(--vscode-input-border, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-sm)",
    "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
    color: "var(--vscode-input-foreground, var(--cortex-text-primary))",
    cursor: "pointer",
    "font-size": "13px",
    transition: "border-color 0.2s, background-color 0.2s",
  } as JSX.CSSProperties,

  recordButtonRecording: {
    "border-color": "var(--vscode-errorForeground, var(--cortex-error))",
    "background-color": "rgba(244, 135, 113, 0.1)",
  } as JSX.CSSProperties,

  recordedKeys: {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: "4px",
    padding: "8px",
    "min-height": "32px",
  } as JSX.CSSProperties,

  recordedKey: {
    padding: "4px 8px",
    "background-color": "var(--vscode-badge-background, var(--cortex-bg-active))",
    color: "var(--vscode-badge-foreground, var(--cortex-text-primary))",
    "border-radius": "var(--cortex-radius-sm)",
    "font-family": "var(--vscode-editor-font-family, monospace)",
    "font-size": "12px",
  } as JSX.CSSProperties,

  modalActions: {
    display: "flex",
    "justify-content": "flex-end",
    gap: "8px",
    "margin-top": "16px",
    "padding-top": "12px",
    "border-top": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
  } as JSX.CSSProperties,

  conflictWarning: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    "background-color": "rgba(244, 135, 113, 0.1)",
    border: "1px solid var(--vscode-errorForeground, var(--cortex-error))",
    "border-radius": "var(--cortex-radius-sm)",
    "margin-top": "8px",
    "font-size": "12px",
    color: "var(--vscode-errorForeground, var(--cortex-error))",
  } as JSX.CSSProperties,

  emptyState: {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    padding: "48px",
    opacity: "0.6",
  } as JSX.CSSProperties,

  emptyStateIcon: {
    "font-size": "48px",
    "margin-bottom": "16px",
  } as JSX.CSSProperties,

  statusBar: {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "6px 12px",
    "border-top": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
    "font-size": "12px",
    opacity: "0.8",
  } as JSX.CSSProperties,
};

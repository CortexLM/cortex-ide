import type { JSX } from "solid-js";

export const baseStyles = {
  container: {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    "background-color": "var(--vscode-editor-background, var(--cortex-bg-primary))",
    color: "var(--vscode-editor-foreground, var(--cortex-text-primary))",
    "font-family": "var(--vscode-font-family, 'Segoe UI', sans-serif)",
    "font-size": "13px",
  } as JSX.CSSProperties,

  toolbar: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    "border-bottom": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
    "flex-wrap": "wrap",
  } as JSX.CSSProperties,

  searchContainer: {
    display: "flex",
    "align-items": "center",
    flex: "1",
    "min-width": "200px",
    "max-width": "400px",
    position: "relative",
  } as JSX.CSSProperties,

  searchInput: {
    width: "100%",
    padding: "6px 32px 6px 8px",
    border: "1px solid var(--vscode-input-border, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-sm)",
    "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
    color: "var(--vscode-input-foreground, var(--cortex-text-primary))",
    "font-size": "13px",
    outline: "none",
  } as JSX.CSSProperties,

  searchIcon: {
    position: "absolute",
    right: "8px",
    opacity: "0.6",
    "pointer-events": "none",
  } as JSX.CSSProperties,

  filterContainer: {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  } as JSX.CSSProperties,

  filterButton: {
    padding: "4px 8px",
    border: "1px solid transparent",
    "border-radius": "var(--cortex-radius-sm)",
    "background-color": "transparent",
    color: "var(--vscode-foreground, var(--cortex-text-primary))",
    cursor: "pointer",
    "font-size": "12px",
    transition: "background-color 0.1s",
  } as JSX.CSSProperties,

  filterButtonActive: {
    "background-color": "var(--vscode-button-background, var(--cortex-info))",
    color: "var(--vscode-button-foreground, var(--cortex-text-primary))",
  } as JSX.CSSProperties,

  tableContainer: {
    flex: "1",
    overflow: "auto",
  } as JSX.CSSProperties,

  table: {
    width: "100%",
    "border-collapse": "collapse",
    "table-layout": "fixed",
  } as JSX.CSSProperties,

  tableHeader: {
    position: "sticky",
    top: "0",
    "background-color": "var(--vscode-editorWidget-background, var(--cortex-bg-primary))",
    "z-index": "1",
  } as JSX.CSSProperties,

  th: {
    padding: "8px 12px",
    "text-align": "left",
    "font-weight": "600",
    "border-bottom": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
    cursor: "pointer",
    "user-select": "none",
    "white-space": "nowrap",
  } as JSX.CSSProperties,

  thCommand: {
    width: "35%",
  } as JSX.CSSProperties,

  thKeybinding: {
    width: "25%",
  } as JSX.CSSProperties,

  thWhen: {
    width: "25%",
  } as JSX.CSSProperties,

  thSource: {
    width: "15%",
  } as JSX.CSSProperties,

  sortIndicator: {
    "margin-left": "4px",
    opacity: "0.7",
  } as JSX.CSSProperties,

  tr: {
    cursor: "pointer",
    transition: "background-color 0.1s",
  } as JSX.CSSProperties,

  trHover: {
    "background-color": "var(--vscode-list-hoverBackground, var(--cortex-bg-hover))",
  } as JSX.CSSProperties,

  trSelected: {
    "background-color": "var(--vscode-list-activeSelectionBackground, var(--cortex-bg-active))",
    color: "var(--vscode-list-activeSelectionForeground, var(--cortex-text-primary))",
  } as JSX.CSSProperties,

  td: {
    padding: "6px 12px",
    "border-bottom": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  } as JSX.CSSProperties,

  commandCell: {
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
  } as JSX.CSSProperties,

  commandTitle: {
    "font-weight": "500",
  } as JSX.CSSProperties,

  commandId: {
    "font-size": "11px",
    opacity: "0.7",
    "font-family": "var(--vscode-editor-font-family, monospace)",
  } as JSX.CSSProperties,

  keybindingCell: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  } as JSX.CSSProperties,

  keybindingBadge: {
    display: "inline-flex",
    "align-items": "center",
    padding: "2px 6px",
    "background-color": "var(--vscode-badge-background, var(--cortex-bg-active))",
    color: "var(--vscode-badge-foreground, var(--cortex-text-primary))",
    "border-radius": "var(--cortex-radius-sm)",
    "font-family": "var(--vscode-editor-font-family, monospace)",
    "font-size": "12px",
  } as JSX.CSSProperties,
};

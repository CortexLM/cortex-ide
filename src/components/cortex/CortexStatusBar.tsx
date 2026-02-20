/**
 * CortexStatusBar - Pixel-perfect IDE status bar matching Figma design
 *
 * Figma specs (node 443:7673 "Footer"):
 * - Container: flex row, space-between, gap 40px, height 28px, padding 8px 24px
 * - Background: var(--cortex-bg-primary), border-top: 1px solid var(--cortex-border-subtle)
 * - Left section: git branch name, sync status
 * - Right section: cursor position, indentation, encoding, EOL, language, notifications
 * - Font: var(--cortex-font-sans), 12px, weight 500
 * - Text: var(--cortex-text-on-surface) primary, var(--cortex-text-secondary) muted
 *
 * Wires to StatusBarContext when available for real editor info.
 */

import { Component, JSX, splitProps, Show, createSignal } from "solid-js";
import { CortexIcon } from "./primitives";

export type CortexStatusBarVariant = "default" | "active";

export interface StatusBarItem {
  id: string;
  icon: string;
  label: string;
  onClick?: () => void;
}

export interface CortexStatusBarProps {
  variant?: CortexStatusBarVariant;
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
  notificationCount?: number;
  onBranchClick?: () => void;
  onCursorClick?: () => void;
  onLanguageClick?: () => void;
  onEncodingClick?: () => void;
  onLineEndingClick?: () => void;
  onIndentationClick?: () => void;
  onNotificationClick?: () => void;
  onTogglePanel?: () => void;
  onToggleTerminal?: () => void;
  onSourceControl?: () => void;
  leftItems?: StatusBarItem[];
  rightItems?: StatusBarItem[];
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexStatusBar: Component<CortexStatusBarProps> = (props) => {
  const [local] = splitProps(props, [
    "variant",
    "branchName",
    "isSyncing",
    "hasChanges",
    "cursorLine",
    "cursorColumn",
    "selectionCount",
    "languageName",
    "encoding",
    "lineEnding",
    "indentType",
    "indentSize",
    "notificationCount",
    "onBranchClick",
    "onCursorClick",
    "onLanguageClick",
    "onEncodingClick",
    "onLineEndingClick",
    "onIndentationClick",
    "onNotificationClick",
    "onTogglePanel",
    "onToggleTerminal",
    "onSourceControl",
    "leftItems",
    "rightItems",
    "class",
    "style",
  ]);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    gap: "40px",
    height: "28px",
    padding: "8px 24px",
    background: "var(--cortex-bg-primary)",
    "border-top": "1px solid var(--cortex-border-subtle)",
    "flex-shrink": "0",
    "font-family": "var(--cortex-font-sans)",
    "font-size": "12px",
    "font-weight": "500",
    color: "var(--cortex-text-secondary)",
    transition: "background var(--cortex-transition-fast, 100ms ease)",
    ...local.style,
  });

  const sectionStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
  };

  const indentationLabel = () => {
    const type = local.indentType || "spaces";
    const size = local.indentSize || 2;
    return `${type === "spaces" ? "Spaces" : "Tabs"}: ${size}`;
  };

  return (
    <footer class={local.class} style={containerStyle()}>
      {/* Left Section: Git branch + panel toggles */}
      <div style={sectionStyle}>
        <Show when={local.branchName}>
          <StatusBarButton
            onClick={local.onBranchClick ?? local.onSourceControl}
            title="Source Control"
          >
            <CortexIcon name="git" size={16} color="currentColor" />
            <span>{local.branchName}</span>
            <Show when={local.isSyncing}>
              <CortexIcon name="sync" size={16} color="currentColor" />
            </Show>
            <Show when={local.hasChanges}>
              <span style={{ "font-size": "10px" }}>●</span>
            </Show>
          </StatusBarButton>
        </Show>

        <Show when={local.onTogglePanel}>
          <StatusBarButton onClick={local.onTogglePanel} title="Toggle Panel">
            <CortexIcon name="layout" size={16} color="currentColor" />
          </StatusBarButton>
        </Show>

        <Show when={local.onToggleTerminal}>
          <StatusBarButton onClick={local.onToggleTerminal} title="Toggle Terminal">
            <CortexIcon name="terminal" size={16} color="currentColor" />
          </StatusBarButton>
        </Show>

        <Show when={local.leftItems}>
          {(items) => (
            <>
              {items().map((item) => (
                <StatusBarButton
                  onClick={item.onClick}
                  title={item.label}
                >
                  <CortexIcon name={item.icon} size={16} color="currentColor" />
                </StatusBarButton>
              ))}
            </>
          )}
        </Show>
      </div>

      {/* Right Section: Editor info + notifications */}
      <div style={{ ...sectionStyle, gap: "12px" }}>
        <StatusBarButton
          onClick={local.onCursorClick}
          title="Go to Line/Column"
        >
          <span>Ln {local.cursorLine || 1}, Col {local.cursorColumn || 1}</span>
          <Show when={(local.selectionCount ?? 0) > 0}>
            <span>({local.selectionCount} selected)</span>
          </Show>
        </StatusBarButton>

        <StatusBarButton
          onClick={local.onIndentationClick}
          title="Select Indentation"
        >
          <span>{indentationLabel()}</span>
        </StatusBarButton>

        <StatusBarButton
          onClick={local.onEncodingClick}
          title="Select Encoding"
        >
          <span>{local.encoding || "UTF-8"}</span>
        </StatusBarButton>

        <StatusBarButton
          onClick={local.onLineEndingClick}
          title="Select End of Line Sequence"
        >
          <span>{local.lineEnding || "LF"}</span>
        </StatusBarButton>

        <StatusBarButton
          onClick={local.onLanguageClick}
          title="Select Language Mode"
        >
          <span>{local.languageName || "Plain Text"}</span>
        </StatusBarButton>

        <Show when={local.onNotificationClick}>
          <StatusBarButton
            onClick={local.onNotificationClick}
            title="Notifications"
          >
            <CortexIcon name="bell" size={16} color="currentColor" />
            <Show when={(local.notificationCount ?? 0) > 0}>
              <span style={{
                "min-width": "14px",
                height: "14px",
                "border-radius": "7px",
                background: "var(--cortex-accent-primary, #B2FF22)",
                color: "var(--cortex-accent-text, #000)",
                "font-size": "10px",
                "font-weight": "600",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                padding: "0 3px",
              }}>
                {local.notificationCount}
              </span>
            </Show>
          </StatusBarButton>
        </Show>

        <Show when={local.rightItems}>
          {(items) => (
            <>
              {items().map((item) => (
                <StatusBarButton
                  onClick={item.onClick}
                  title={item.label}
                >
                  <CortexIcon name={item.icon} size={16} color="currentColor" />
                </StatusBarButton>
              ))}
            </>
          )}
        </Show>
      </div>
    </footer>
  );
};

interface StatusBarButtonProps {
  onClick?: (() => void) | undefined;
  title?: string;
  children: JSX.Element;
}

const StatusBarButton: Component<StatusBarButtonProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  return (
    <button
      style={{
        display: "flex",
        "align-items": "center",
        gap: "4px",
        padding: "2px 6px",
        "border-radius": "var(--cortex-radius-sm, 4px)",
        cursor: props.onClick ? "pointer" : "default",
        background: isHovered() ? "var(--cortex-bg-hover)" : "transparent",
        border: "none",
        color: "inherit",
        "font-family": "inherit",
        "font-size": "inherit",
        "white-space": "nowrap",
        transition: "background var(--cortex-transition-fast, 100ms ease), color var(--cortex-transition-fast, 100ms ease)",
      }}
      title={props.title}
      aria-label={props.title}
      onClick={() => props.onClick?.()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {props.children}
    </button>
  );
};

export default CortexStatusBar;

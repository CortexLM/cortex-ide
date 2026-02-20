/**
 * EnhancedStatusBar - Extended status bar with editor info, diagnostics, and breadcrumb
 * Matches Figma Footer (443:7673): padding 8px 24px, gap 40px
 * Active variant shows breadcrumb trail with chevron-right separators
 */

import { Component, JSX, Show, For, createMemo } from "solid-js";
import { CortexIcon, CortexTooltip } from "./primitives";
import { CortexBreadcrumb, type BreadcrumbSegment } from "./CortexBreadcrumb";
import { useStatusBar, type StatusBarItemConfig } from "@/context/StatusBarContext";
import { useDiagnostics } from "@/context/DiagnosticsContext";
import { useWorkspaceTrust, useTrustStatus } from "@/context/WorkspaceTrustContext";

export interface EnhancedStatusBarProps {
  breadcrumbs?: BreadcrumbSegment[];
  class?: string;
  style?: JSX.CSSProperties;
}

export const EnhancedStatusBar: Component<EnhancedStatusBarProps> = (props) => {
  const statusBar = useStatusBar();
  const diagnostics = useDiagnostics();
  const trust = useWorkspaceTrust();
  const trustStatus = useTrustStatus();

  const diagnosticCounts = createMemo(() => diagnostics.getCounts());
  const editorInfo = createMemo(() => statusBar.editorInfo());
  const cursorPos = createMemo(() => statusBar.cursorPosition());
  const selection = createMemo(() => statusBar.selection());

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    width: "100%",
    height: "28px",
    background: "var(--cortex-bg-primary)",
    padding: "8px 24px",
    "border-top": "1px solid var(--cortex-border-default, #2E2F31)",
    "flex-shrink": "0",
    "font-size": "12px",
    "font-family": "'Figtree', var(--cortex-font-sans, Inter, sans-serif)",
    "font-weight": "500",
    color: "var(--cortex-text-muted)",
    gap: "40px",
    ...props.style,
  });

  const sectionStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "12px",
    height: "100%",
  };

  const itemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
    padding: "2px 6px",
    "border-radius": "var(--cortex-radius-sm)",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  };

  const handleDiagnosticsClick = () => {
    diagnostics.togglePanel();
  };

  const handleTrustClick = () => {
    window.dispatchEvent(new CustomEvent("open-settings", { detail: { section: "workspace-trust" } }));
  };

  const handleNotificationsClick = () => {
    window.dispatchEvent(new CustomEvent("notifications:toggle"));
  };

  const handleLanguageClick = () => {
    window.dispatchEvent(new CustomEvent("command:execute", { detail: { command: "workbench.action.changeLanguageMode" } }));
  };

  const handleEncodingClick = () => {
    window.dispatchEvent(new CustomEvent("command:execute", { detail: { command: "workbench.action.changeEncoding" } }));
  };

  const handleLineEndingClick = () => {
    window.dispatchEvent(new CustomEvent("command:execute", { detail: { command: "workbench.action.changeEol" } }));
  };

  const handleIndentationClick = () => {
    window.dispatchEvent(new CustomEvent("command:execute", { detail: { command: "editor.action.indentationToSpaces" } }));
  };

  const handleCursorClick = () => {
    window.dispatchEvent(new CustomEvent("command:execute", { detail: { command: "workbench.action.gotoLine" } }));
  };

  const handleBranchClick = () => {
    window.dispatchEvent(new CustomEvent("command:execute", { detail: { command: "git.checkout" } }));
  };

  return (
    <footer class={props.class} style={containerStyle()}>
      <div style={sectionStyle}>
        <CortexTooltip content={`${diagnosticCounts().error} Errors, ${diagnosticCounts().warning} Warnings`} position="top">
          <div
            style={{
              ...itemStyle,
              color: diagnosticCounts().error > 0
                ? "var(--cortex-error)"
                : diagnosticCounts().warning > 0
                ? "var(--cortex-warning)"
                : "var(--cortex-text-muted)",
            }}
            onClick={handleDiagnosticsClick}
          >
            <CortexIcon name="circle-xmark" size={12} />
            <span>{diagnosticCounts().error}</span>
            <CortexIcon name="triangle-exclamation" size={12} />
            <span>{diagnosticCounts().warning}</span>
          </div>
        </CortexTooltip>

        <Show when={statusBar.branchName()}>
          <CortexTooltip content={`Git Branch: ${statusBar.branchName()}`} position="top">
            <div style={itemStyle} onClick={handleBranchClick}>
              <CortexIcon name="code-branch" size={12} />
              <span>{statusBar.branchName()}</span>
              <Show when={statusBar.hasChanges()}>
                <span style={{ color: "var(--cortex-warning)" }}>*</span>
              </Show>
            </div>
          </CortexTooltip>
        </Show>

        <Show when={trust.isRestrictedMode()}>
          <CortexTooltip content={trustStatus().description} position="top">
            <div
              style={{
                ...itemStyle,
                color: trustStatus().color,
                background: "rgba(245, 158, 11, 0.1)",
              }}
              onClick={handleTrustClick}
            >
              <CortexIcon name="shield-exclamation" size={12} />
              <span>Restricted</span>
            </div>
          </CortexTooltip>
        </Show>

        <For each={statusBar.leftItems()}>
          {(item) => (
            <StatusBarItem item={item} onClick={() => item.command && statusBar.executeCommand(item.command)} />
          )}
        </For>
      </div>

      <div style={sectionStyle}>
        <Show
          when={props.breadcrumbs && props.breadcrumbs.length > 0}
          fallback={
            <For each={statusBar.centerItems()}>
              {(item) => (
                <StatusBarItem item={item} onClick={() => item.command && statusBar.executeCommand(item.command)} />
              )}
            </For>
          }
        >
          <CortexBreadcrumb segments={props.breadcrumbs!} />
        </Show>
      </div>

      <div style={sectionStyle}>
        <For each={statusBar.rightItems()}>
          {(item) => (
            <StatusBarItem item={item} onClick={() => item.command && statusBar.executeCommand(item.command)} />
          )}
        </For>

        <CortexTooltip content={`Line ${cursorPos().line}, Column ${cursorPos().column}`} position="top">
          <div style={itemStyle} onClick={handleCursorClick}>
            <span>Ln {cursorPos().line}, Col {cursorPos().column}</span>
            <Show when={selection()}>
              <span style={{ color: "var(--cortex-text-muted)" }}>
                ({selection()!.lines > 1 ? `${selection()!.lines} lines` : `${selection()!.characters} selected`})
              </span>
            </Show>
          </div>
        </CortexTooltip>

        <CortexTooltip content={`Indentation: ${editorInfo().indentation.size} ${editorInfo().indentation.type}`} position="top">
          <div style={itemStyle} onClick={handleIndentationClick}>
            <span>
              {editorInfo().indentation.type === "spaces" ? "Spaces" : "Tabs"}: {editorInfo().indentation.size}
            </span>
          </div>
        </CortexTooltip>

        <CortexTooltip content={`Encoding: ${editorInfo().encoding}`} position="top">
          <div style={itemStyle} onClick={handleEncodingClick}>
            <span>{editorInfo().encoding}</span>
          </div>
        </CortexTooltip>

        <CortexTooltip content={`Line Ending: ${editorInfo().lineEnding}`} position="top">
          <div style={itemStyle} onClick={handleLineEndingClick}>
            <span>{editorInfo().lineEnding}</span>
          </div>
        </CortexTooltip>

        <CortexTooltip content={`Language: ${editorInfo().languageName}`} position="top">
          <div style={itemStyle} onClick={handleLanguageClick}>
            <span>{editorInfo().languageName}</span>
          </div>
        </CortexTooltip>

        <CortexTooltip content={`${statusBar.notificationCount()} notifications`} position="top">
          <div
            style={{
              ...itemStyle,
              position: "relative",
            }}
            onClick={handleNotificationsClick}
          >
            <CortexIcon name="bell" size={14} />
            <Show when={statusBar.notificationCount() > 0}>
              <span
                style={{
                  position: "absolute",
                  top: "-2px",
                  right: "-2px",
                  "min-width": "14px",
                  height: "14px",
                  "border-radius": "7px",
                  background: "var(--cortex-accent-primary)",
                  color: "var(--cortex-accent-text)",
                  "font-size": "9px",
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  padding: "0 3px",
                }}
              >
                {statusBar.notificationCount() > 99 ? "99+" : statusBar.notificationCount()}
              </span>
            </Show>
          </div>
        </CortexTooltip>
      </div>
    </footer>
  );
};

interface StatusBarItemProps {
  item: StatusBarItemConfig;
  onClick?: () => void;
}

const StatusBarItem: Component<StatusBarItemProps> = (props) => {
  const itemStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    padding: "2px 6px",
    "border-radius": "var(--cortex-radius-sm)",
    cursor: props.onClick ? "pointer" : "default",
    color: props.item.color || "var(--cortex-text-muted)",
    background: props.item.backgroundColor || "transparent",
    transition: "background var(--cortex-transition-fast)",
  });

  const content = (
    <div
      style={itemStyle()}
      onClick={props.onClick}
      role={props.onClick ? "button" : undefined}
      aria-label={props.item.accessibilityLabel || props.item.tooltip}
    >
      <Show when={props.item.icon}>
        <CortexIcon name={props.item.icon!} size={12} />
      </Show>
      <Show when={props.item.text}>
        <span>{props.item.text}</span>
      </Show>
    </div>
  );

  return (
    <Show when={props.item.tooltip} fallback={content}>
      <CortexTooltip content={props.item.tooltip!} position="top">
        {content}
      </CortexTooltip>
    </Show>
  );
};

export default EnhancedStatusBar;

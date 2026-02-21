/**
 * ExplorerHeader - Tab header for Explorer panel
 * Matches Figma Explorer component (590:10817) tab section
 *
 * Layout: row, stretch, fill width
 * Active tab: folder icon + "Explorer" (Figtree 14px 500, #E9E9EA)
 * Inactive tab: magic wand icon + "AI Terminal" (14px, gradient text)
 */

import { Component, JSX } from "solid-js";
import { CortexIcon } from "../primitives";

export type ExplorerTab = "explorer" | "ai-terminal";

export interface ExplorerHeaderProps {
  activeTab?: ExplorerTab;
  onTabChange?: (tab: ExplorerTab) => void;
}

export const ExplorerHeader: Component<ExplorerHeaderProps> = (props) => {
  const activeTab = () => props.activeTab ?? "explorer";

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "row",
    "align-self": "stretch",
    width: "100%",
    "flex-shrink": "0",
  });

  const tabStyle = (isActive: boolean): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "row",
    "justify-content": "center",
    "align-items": "center",
    gap: "6px",
    padding: "10px 16px",
    flex: "1",
    cursor: "pointer",
    background: isActive ? "transparent" : "#141415",
    border: "none",
    "border-bottom": isActive ? "none" : "1px solid #2E2F31",
    "border-right": isActive ? "1px solid #2E2F31" : "none",
    "border-radius": isActive ? "0px 0px 0px 6px" : "0px 0px 0px 6px",
    height: isActive ? "auto" : "36px",
  });

  const tabTextStyle = (isActive: boolean): JSX.CSSProperties => ({
    "font-family": "Figtree, var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    "font-weight": "500",
    "line-height": "1em",
    color: isActive ? "#E9E9EA" : "#8C8D8F",
    "white-space": "nowrap",
  });

  const gradientTextStyle = (): JSX.CSSProperties => ({
    "font-family": "Figtree, var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    "font-weight": "500",
    "line-height": "1em",
    background: "linear-gradient(90deg, #8C8D8F 0%, #FCFCFC 100%)",
    "-webkit-background-clip": "text",
    "-webkit-text-fill-color": "transparent",
    "background-clip": "text",
    "white-space": "nowrap",
  });

  return (
    <div style={containerStyle()}>
      <button
        style={tabStyle(activeTab() === "explorer")}
        onClick={() => props.onTabChange?.("explorer")}
        aria-label="Explorer"
        aria-selected={activeTab() === "explorer"}
        role="tab"
      >
        <CortexIcon name="folder" size={16} color={activeTab() === "explorer" ? "#E9E9EA" : "#8C8D8F"} />
        <span style={tabTextStyle(activeTab() === "explorer")}>Explorer</span>
      </button>

      <button
        style={tabStyle(activeTab() === "ai-terminal")}
        onClick={() => props.onTabChange?.("ai-terminal")}
        aria-label="AI Terminal"
        aria-selected={activeTab() === "ai-terminal"}
        role="tab"
      >
        <CortexIcon name="star" size={16} color="#FFFFFF" />
        <span style={activeTab() === "ai-terminal" ? tabTextStyle(true) : gradientTextStyle()}>
          AI Terminal
        </span>
      </button>
    </div>
  );
};

export default ExplorerHeader;

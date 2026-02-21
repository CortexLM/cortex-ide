export type SidebarTab = "files" | "search" | "git" | "debug" | "extensions" | "agents" | "themes" | "plugins" | "account";
export type BottomPanelTab = "terminal" | "output" | "problems";
export type ViewMode = "vibe" | "ide";

export const BOTTOM_PANEL_TABS: BottomPanelTab[] = ["terminal", "output", "problems"];
export const BOTTOM_PANEL_DEFAULT_HEIGHT = 200;
export const BOTTOM_PANEL_MIN_HEIGHT = 100;
export const BOTTOM_PANEL_MAX_HEIGHT = 500;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 600;
export const SIDEBAR_DEFAULT_WIDTH = 320;

export function SidebarSkeleton() {
  return (
    <div style={{
      flex: "1",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    }}>
      <div style={{
        width: "24px",
        height: "24px",
        border: "2px solid currentColor",
        "border-top-color": "transparent",
        "border-radius": "var(--cortex-radius-full)",
        animation: "spin 0.8s linear infinite",
      }} />
    </div>
  );
}

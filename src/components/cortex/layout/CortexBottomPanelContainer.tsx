import { Show, Suspense, For, lazy } from "solid-js";
import { BOTTOM_PANEL_TABS, BOTTOM_PANEL_MIN_HEIGHT, BOTTOM_PANEL_MAX_HEIGHT, SidebarSkeleton } from "./types";
import type { BottomPanelTab } from "./types";

const CortexOutputPanel = lazy(() => import("@/components/cortex/output/OutputPanel").then(m => ({ default: m.OutputPanel })));
const CortexDiagnosticsPanel = lazy(() => import("@/components/cortex/diagnostics/DiagnosticsPanel").then(m => ({ default: m.DiagnosticsPanel })));

export interface CortexBottomPanelContainerProps {
  bottomPanelTab: BottomPanelTab;
  bottomPanelCollapsed: boolean;
  bottomPanelHeight: number;
  onTabChange: (tab: BottomPanelTab) => void;
  onCollapse: () => void;
  onHeightChange: (height: number) => void;
}

export function CortexBottomPanelContainer(props: CortexBottomPanelContainerProps) {
  return (
    <Show when={!props.bottomPanelCollapsed}>
      <div
        style={{
          width: "4px",
          cursor: "row-resize",
          background: "transparent",
          transition: "background 200ms ease-out",
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startHeight = props.bottomPanelHeight;
          const onMouseMove = (ev: MouseEvent) => {
            const delta = startY - ev.clientY;
            props.onHeightChange(Math.max(BOTTOM_PANEL_MIN_HEIGHT, Math.min(BOTTOM_PANEL_MAX_HEIGHT, startHeight + delta)));
          };
          const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
          };
          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--cortex-accent-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      />
      <div style={{
        height: `${props.bottomPanelHeight}px`,
        "flex-shrink": "0",
        display: "flex",
        "flex-direction": "column",
        "border-top": "1px solid var(--cortex-border-default)",
      }}>
        <div style={{
          display: "flex",
          "align-items": "center",
          gap: "0",
          padding: "0 8px",
          height: "36px",
          "flex-shrink": "0",
          background: "var(--cortex-bg-secondary)",
          "border-bottom": "1px solid var(--cortex-border-default)",
        }}>
          <For each={BOTTOM_PANEL_TABS}>{(tab) => (
            <button
              style={{
                padding: "4px 12px",
                background: "transparent",
                border: "none",
                "border-bottom": props.bottomPanelTab === tab ? "2px solid var(--cortex-accent-primary)" : "2px solid transparent",
                color: props.bottomPanelTab === tab ? "var(--cortex-text-primary)" : "var(--cortex-text-muted)",
                "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
                "font-size": "12px",
                cursor: "pointer",
                "text-transform": "capitalize",
                transition: "color 150ms ease-out, border-bottom-color 150ms ease-out",
              }}
              onClick={() => props.onTabChange(tab)}
            >
              {tab}
            </button>
          )}</For>
          <div style={{ flex: "1" }} />
          <button
            style={{
              width: "24px",
              height: "24px",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              background: "transparent",
              border: "none",
              color: "var(--cortex-text-muted)",
              cursor: "pointer",
            }}
            onClick={() => props.onCollapse()}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
        <div style={{ flex: "1", overflow: "hidden" }}>
          <Show when={props.bottomPanelTab === "output"}>
            <Suspense fallback={<SidebarSkeleton />}>
              <CortexOutputPanel onClose={() => props.onCollapse()} />
            </Suspense>
          </Show>
          <Show when={props.bottomPanelTab === "problems"}>
            <Suspense fallback={<SidebarSkeleton />}>
              <CortexDiagnosticsPanel />
            </Suspense>
          </Show>
          <Show when={props.bottomPanelTab === "terminal"}>
            <div
              data-terminal-embed="true"
              style={{
                flex: "1",
                height: "100%",
                display: "flex",
                overflow: "hidden",
              }}
            />
          </Show>
        </div>
      </div>
    </Show>
  );
}

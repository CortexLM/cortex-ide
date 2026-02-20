import { JSX, Show, Suspense, lazy } from "solid-js";
import type { SidebarTab } from "./types";
import { SidebarSkeleton, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from "./types";

const CortexAgentsPanel = lazy(() => import("@/components/cortex/CortexAgentsPanel").then(m => ({ default: m.CortexAgentsPanel })));
const CortexFactoryPanel = lazy(() => import("@/components/cortex/CortexFactoryPanel").then(m => ({ default: m.CortexFactoryPanel })));
const RealFileExplorer = lazy(() => import("@/components/FileExplorer").then(m => ({ default: m.FileExplorer })));
const CortexGitPanel = lazy(() => import("@/components/cortex/CortexGitPanel").then(m => ({ default: m.CortexGitPanel })));
const CortexSearchPanel = lazy(() => import("@/components/cortex/CortexSearchPanel").then(m => ({ default: m.CortexSearchPanel })));
const CortexDebugPanel = lazy(() => import("@/components/cortex/CortexDebugPanel").then(m => ({ default: m.CortexDebugPanel })));
const CortexExtensionsPanel = lazy(() => import("@/components/cortex/CortexExtensionsPanel").then(m => ({ default: m.CortexExtensionsPanel })));
const CortexThemePicker = lazy(() => import("@/components/cortex/CortexThemePicker").then(m => ({ default: m.CortexThemePicker })));
const CortexPluginsPanel = lazy(() => import("@/components/cortex/CortexPluginsPanel").then(m => ({ default: m.CortexPluginsPanel })));
const CortexAccountPanel = lazy(() => import("@/components/cortex/CortexAccountPanel").then(m => ({ default: m.CortexAccountPanel })));

function EmptyExplorer(props: { onOpenFolder: () => void }) {
  return (
    <div style={{
      flex: "1",
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      padding: "24px",
      gap: "16px",
      color: "var(--cortex-text-inactive)",
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      <p style={{
        "font-family": "'Inter', sans-serif",
        "font-size": "14px",
        "text-align": "center",
        margin: "0",
      }}>
        No folder opened
      </p>
      <button
        onClick={props.onOpenFolder}
        style={{
          padding: "8px 16px",
          background: "var(--cortex-accent-primary)",
          border: "none",
          "border-radius": "var(--cortex-radius-md)",
          "font-family": "'Inter', sans-serif",
          "font-size": "13px",
          "font-weight": "500",
          color: "var(--cortex-text-primary)",
          cursor: "pointer",
        }}
      >
        Open Folder
      </button>
    </div>
  );
}

export interface CortexSidebarContainerProps {
  sidebarTab: SidebarTab;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  isResizing: boolean;
  projectPath: string | null;
  onFileSelect: (filePath: string) => void;
  onSidebarWidthChange: (width: number) => void;
  onResizingChange: (resizing: boolean) => void;
}

export function CortexSidebarContainer(props: CortexSidebarContainerProps) {
  const sidebarStyle = (): JSX.CSSProperties => ({
    width: props.sidebarCollapsed ? "0" : `${props.sidebarWidth}px`,
    height: "calc(100% - 16px)",
    "margin-top": "var(--cortex-space-2)",
    "margin-bottom": "var(--cortex-space-2)",
    "margin-left": "var(--cortex-space-2)",
    "flex-shrink": "0",
    overflow: "hidden",
    transition: props.isResizing ? "none" : "width 150ms ease, opacity 150ms ease",
    background: "var(--cortex-sidebar-bg)",
    "border-radius": "var(--cortex-sidebar-radius)",
    border: "1px solid var(--cortex-sidebar-border)",
    opacity: props.sidebarCollapsed ? "0" : "1",
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
    position: "relative",
  });

  return (
    <Show when={!props.sidebarCollapsed}>
      <aside style={sidebarStyle()}>
        <Show when={props.sidebarTab === "files"}>
          <Show
            when={props.projectPath && props.projectPath !== "."}
            fallback={<EmptyExplorer onOpenFolder={() => window.dispatchEvent(new CustomEvent("folder:open"))} />}
          >
            <Suspense fallback={<SidebarSkeleton />}>
              <RealFileExplorer
                rootPath={props.projectPath}
                onFileSelect={props.onFileSelect}
              />
            </Suspense>
          </Show>
        </Show>

        <Show when={props.sidebarTab === "search"}>
          <Suspense fallback={<SidebarSkeleton />}>
            <CortexSearchPanel />
          </Suspense>
        </Show>

        <Show when={props.sidebarTab === "git"}>
          <Suspense fallback={<SidebarSkeleton />}>
            <CortexGitPanel />
          </Suspense>
        </Show>

        <Show when={props.sidebarTab === "debug"}>
          <Suspense fallback={<SidebarSkeleton />}>
            <CortexDebugPanel />
          </Suspense>
        </Show>

        <Show when={props.sidebarTab === "extensions"}>
          <Suspense fallback={<SidebarSkeleton />}>
            <CortexExtensionsPanel />
          </Suspense>
        </Show>

        <Show when={props.sidebarTab === "agents"}>
          <Suspense fallback={<SidebarSkeleton />}>
            <CortexAgentsPanel />
          </Suspense>
        </Show>

        <Show when={props.sidebarTab === "factory"}>
          <Suspense fallback={<SidebarSkeleton />}>
            <CortexFactoryPanel />
          </Suspense>
        </Show>

        <Show when={props.sidebarTab === "themes"}>
          <Suspense fallback={<SidebarSkeleton />}>
            <CortexThemePicker />
          </Suspense>
        </Show>

        <Show when={props.sidebarTab === "plugins"}>
          <Suspense fallback={<SidebarSkeleton />}>
            <CortexPluginsPanel />
          </Suspense>
        </Show>

        <Show when={props.sidebarTab === "account"}>
          <Suspense fallback={<SidebarSkeleton />}>
            <CortexAccountPanel />
          </Suspense>
        </Show>
      </aside>

      <div
        style={{
          width: "6px",
          cursor: "col-resize",
          background: "transparent",
          transition: "background 150ms",
          "flex-shrink": "0",
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          props.onResizingChange(true);
          const startX = e.clientX;
          const startWidth = props.sidebarWidth;

          const onMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;
            props.onSidebarWidthChange(Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, startWidth + delta)));
          };

          const onMouseUp = () => {
            props.onResizingChange(false);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
          };

          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "linear-gradient(to right, transparent 2px, var(--cortex-accent-primary) 2px, var(--cortex-accent-primary) 4px, transparent 4px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      />
    </Show>
  );
}

import { Component, For, Show, createSignal } from "solid-js";
import type { RecentProject } from "@/context/RecentProjectsContext";

const FILE_ICON_MAP: Record<string, string> = {
  tsx: "/icons/files/react-ts.svg",
  jsx: "/icons/files/react.svg",
  ts: "/icons/files/ts.svg",
  js: "/icons/files/js.svg",
  rs: "/icons/files/rust.svg",
  py: "/icons/files/python.svg",
  go: "/icons/files/go.svg",
  toml: "/icons/files/gear.svg",
  json: "/icons/files/json.svg",
  yaml: "/icons/files/yaml.svg",
  yml: "/icons/files/yaml.svg",
  md: "/icons/files/markdown.svg",
  css: "/icons/files/css.svg",
  html: "/icons/files/html.svg",
  svg: "/icons/files/svg.svg",
  vue: "/icons/files/vue.svg",
  svelte: "/icons/files/svelte.svg",
};

const FOLDER_ICON = "/icons/files/document.svg";

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return FILE_ICON_MAP[ext] || FOLDER_ICON;
}

function formatPath(path: string, maxLength: number = 60): string {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.length <= maxLength) return normalized;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 2) return normalized;
  return "~/" + parts.slice(-2).join("/");
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

interface WelcomeRecentFilesProps {
  projects: RecentProject[];
  onOpen: (project: RecentProject) => void;
}

export const WelcomeRecentFiles: Component<WelcomeRecentFilesProps> = (props) => {
  return (
    <div style={{
      display: "flex",
      "flex-direction": "column",
      width: "100%",
      "max-width": "480px",
    }}>
      <div style={{
        "font-size": "12px",
        "font-weight": "500",
        color: "var(--cortex-text-secondary)",
        "text-transform": "uppercase",
        "letter-spacing": "0.05em",
        "margin-bottom": "8px",
        padding: "0 4px",
      }}>
        Recent Projects
      </div>
      <div style={{
        display: "flex",
        "flex-direction": "column",
        gap: "2px",
        "border-radius": "var(--cortex-radius-md)",
        overflow: "hidden",
      }}>
        <For each={props.projects.slice(0, 8)}>
          {(project) => (
            <RecentFileItem
              project={project}
              onOpen={() => props.onOpen(project)}
            />
          )}
        </For>
      </div>
    </div>
  );
};

interface RecentFileItemProps {
  project: RecentProject;
  onOpen: () => void;
}

const RecentFileItem: Component<RecentFileItemProps> = (props) => {
  const [hovered, setHovered] = createSignal(false);

  return (
    <button
      onClick={props.onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "10px",
        padding: "8px 12px",
        background: hovered() ? "var(--cortex-bg-hover)" : "transparent",
        border: "none",
        cursor: "pointer",
        width: "100%",
        "text-align": "left",
        "border-radius": "var(--cortex-radius-sm)",
        transition: "background var(--cortex-transition-fast)",
      }}
    >
      <img
        src={getFileIcon(props.project.name)}
        alt=""
        width="18"
        height="18"
        style={{ "flex-shrink": "0", opacity: "0.8" }}
      />
      <div style={{ flex: "1", "min-width": "0", overflow: "hidden" }}>
        <div style={{
          "font-size": "13px",
          "font-weight": "500",
          color: "var(--cortex-text-primary)",
          "white-space": "nowrap",
          overflow: "hidden",
          "text-overflow": "ellipsis",
        }}>
          {props.project.name}
        </div>
        <div style={{
          "font-size": "11px",
          color: "var(--cortex-text-secondary)",
          "white-space": "nowrap",
          overflow: "hidden",
          "text-overflow": "ellipsis",
          "margin-top": "1px",
        }}>
          {formatPath(props.project.path)}
        </div>
      </div>
      <Show when={props.project.pinned}>
        <div style={{
          width: "6px",
          height: "6px",
          "border-radius": "var(--cortex-radius-full)",
          background: "var(--cortex-accent-primary)",
          "flex-shrink": "0",
        }} />
      </Show>
      <span style={{
        "font-size": "11px",
        color: "var(--cortex-text-tertiary)",
        "flex-shrink": "0",
        "white-space": "nowrap",
      }}>
        {formatRelativeTime(props.project.lastOpened)}
      </span>
    </button>
  );
};

export default WelcomeRecentFiles;

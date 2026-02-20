import { Component, Show, createSignal } from "solid-js";
import { useRecentProjects, type RecentProject } from "@/context/RecentProjectsContext";
import { WelcomeRecentFiles } from "@/components/cortex/WelcomeRecentFiles";

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

interface QuickActionProps {
  label: string;
  icon: string;
  onClick: () => void;
}

function QuickActionButton(props: QuickActionProps) {
  const [hovered, setHovered] = createSignal(false);

  return (
    <button
      onClick={props.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "10px",
        padding: "10px 16px",
        background: hovered() ? "var(--cortex-bg-hover)" : "var(--cortex-bg-secondary)",
        border: "1px solid var(--cortex-border-default)",
        "border-radius": "var(--cortex-radius-md)",
        color: "var(--cortex-text-primary)",
        "font-size": "13px",
        "font-weight": "500",
        cursor: "pointer",
        "font-family": "var(--cortex-font-sans)",
        transition: "background var(--cortex-transition-fast)",
        flex: "1",
        "min-width": "0",
        "white-space": "nowrap",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--cortex-accent-primary)">
        <Show when={props.icon === "file"}>
          <path d="M13.85 4.44l-3.29-3.29A1.5 1.5 0 0 0 9.5 0.75H3.5A1.5 1.5 0 0 0 2 2.25v11.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V5.5a1.5 1.5 0 0 0-.15-1.06z" />
        </Show>
        <Show when={props.icon === "folder"}>
          <path d="M14.5 3H7.71l-2-2H1.5A1.5 1.5 0 0 0 0 2.5v11A1.5 1.5 0 0 0 1.5 15h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 3z" />
        </Show>
        <Show when={props.icon === "clone"}>
          <path d="M11.75 5a1.25 1.25 0 1 0-1.5 1.22V7.5a.5.5 0 0 1-.5.5H6.25a.5.5 0 0 1-.5-.5V6.22a1.25 1.25 0 1 0-1 0v3.56a1.25 1.25 0 1 0 1 0V8.5a.5.5 0 0 1 .5-.5h3.5a1.5 1.5 0 0 0 1.5-1.5V6.22A1.25 1.25 0 0 0 11.75 5z" />
        </Show>
      </svg>
      {props.label}
    </button>
  );
}

interface ShortcutItemProps {
  keys: string;
  description: string;
}

function ShortcutItem(props: ShortcutItemProps) {
  return (
    <div style={{
      display: "flex",
      "justify-content": "space-between",
      "align-items": "center",
      padding: "6px 0",
    }}>
      <span style={{
        "font-size": "13px",
        color: "var(--cortex-text-secondary)",
      }}>
        {props.description}
      </span>
      <kbd style={{
        "font-size": "11px",
        color: "var(--cortex-text-tertiary)",
        background: "var(--cortex-bg-secondary)",
        border: "1px solid var(--cortex-border-default)",
        "border-radius": "var(--cortex-radius-xs)",
        padding: "2px 6px",
        "font-family": "var(--cortex-font-mono, monospace)",
        "white-space": "nowrap",
      }}>
        {props.keys}
      </kbd>
    </div>
  );
}

const Welcome: Component = () => {
  const recentProjects = useRecentProjects();

  const handleNewFile = () => {
    window.dispatchEvent(new CustomEvent("file:new"));
  };

  const handleOpenFolder = () => {
    window.dispatchEvent(new CustomEvent("folder:open"));
  };

  const handleCloneRepo = () => {
    window.dispatchEvent(new CustomEvent("git:clone"));
  };

  const handleOpenProject = (project: RecentProject) => {
    recentProjects.openProject(project);
  };

  const sortedProjects = () => {
    const pinned = recentProjects.pinnedProjects();
    const unpinned = recentProjects.unpinnedProjects();
    return [...pinned, ...unpinned];
  };

  return (
    <div
      data-testid="welcome-page"
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        width: "100%",
        height: "100%",
        "min-height": "100vh",
        background: "var(--cortex-bg-primary)",
        overflow: "auto",
        "font-family": "var(--cortex-font-sans)",
      }}
    >
      <div style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "max-width": "680px",
        width: "100%",
        padding: "48px 24px",
        gap: "36px",
      }}>
        {/* Branding */}
        <div style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          gap: "16px",
        }}>
          <img
            src="/assets/abstract-design.svg"
            alt="Cortex"
            style={{
              width: "100%",
              "max-width": "320px",
              height: "auto",
              opacity: "0.7",
            }}
          />
          <h1 style={{
            "font-size": "24px",
            "font-weight": "600",
            color: "var(--cortex-text-primary)",
            margin: "0",
            "letter-spacing": "-0.01em",
          }}>
            Welcome to Cortex
          </h1>
          <p style={{
            "font-size": "14px",
            color: "var(--cortex-text-secondary)",
            margin: "0",
            "text-align": "center",
            "max-width": "400px",
            "line-height": "1.5",
          }}>
            AI-powered code editor. Start a new project or open a recent one.
          </p>
        </div>

        {/* Quick Actions */}
        <div style={{
          display: "flex",
          "flex-direction": "column",
          gap: "12px",
          width: "100%",
          "max-width": "480px",
        }}>
          <div style={{
            "font-size": "12px",
            "font-weight": "500",
            color: "var(--cortex-text-secondary)",
            "text-transform": "uppercase",
            "letter-spacing": "0.05em",
            padding: "0 4px",
          }}>
            Quick Actions
          </div>
          <div style={{
            display: "flex",
            gap: "8px",
          }}>
            <QuickActionButton label="New File" icon="file" onClick={handleNewFile} />
            <QuickActionButton label="Open Folder" icon="folder" onClick={handleOpenFolder} />
            <QuickActionButton label="Clone Repository" icon="clone" onClick={handleCloneRepo} />
          </div>
        </div>

        {/* Recent Projects */}
        <Show when={sortedProjects().length > 0}>
          <WelcomeRecentFiles
            projects={sortedProjects()}
            onOpen={handleOpenProject}
          />
        </Show>

        {/* Getting Started - Keyboard Shortcuts */}
        <div style={{
          display: "flex",
          "flex-direction": "column",
          gap: "8px",
          width: "100%",
          "max-width": "480px",
        }}>
          <div style={{
            "font-size": "12px",
            "font-weight": "500",
            color: "var(--cortex-text-secondary)",
            "text-transform": "uppercase",
            "letter-spacing": "0.05em",
            padding: "0 4px",
          }}>
            Getting Started
          </div>
          <div style={{
            display: "flex",
            "flex-direction": "column",
            padding: "8px 12px",
            background: "var(--cortex-bg-secondary)",
            "border-radius": "var(--cortex-radius-md)",
            border: "1px solid var(--cortex-border-default)",
          }}>
            <ShortcutItem keys={`${modKey}+Shift+P`} description="Command Palette" />
            <ShortcutItem keys={`${modKey}+O`} description="Open File" />
            <ShortcutItem keys={`${modKey}+N`} description="New File" />
            <ShortcutItem keys={`${modKey}+\``} description="Toggle Terminal" />
            <ShortcutItem keys={`${modKey}+B`} description="Toggle Sidebar" />
            <ShortcutItem keys={`${modKey}+S`} description="Save File" />
          </div>
        </div>

        {/* Documentation Links */}
        <div style={{
          display: "flex",
          "flex-direction": "column",
          gap: "8px",
          width: "100%",
          "max-width": "480px",
        }}>
          <div style={{
            "font-size": "12px",
            "font-weight": "500",
            color: "var(--cortex-text-secondary)",
            "text-transform": "uppercase",
            "letter-spacing": "0.05em",
            padding: "0 4px",
          }}>
            Learn More
          </div>
          <div style={{
            display: "flex",
            gap: "8px",
            "flex-wrap": "wrap",
          }}>
            <DocLink label="Documentation" href="https://docs.cortex.dev" />
            <DocLink label="Getting Started Guide" href="https://docs.cortex.dev/getting-started" />
            <DocLink label="Keyboard Shortcuts" href="https://docs.cortex.dev/shortcuts" />
          </div>
        </div>
      </div>
    </div>
  );
};

interface DocLinkProps {
  label: string;
  href: string;
}

function DocLink(props: DocLinkProps) {
  const [hovered, setHovered] = createSignal(false);

  return (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "6px",
        padding: "8px 12px",
        background: hovered() ? "var(--cortex-bg-hover)" : "transparent",
        border: "1px solid var(--cortex-border-default)",
        "border-radius": "var(--cortex-radius-sm)",
        color: "var(--cortex-accent-primary)",
        "font-size": "13px",
        "text-decoration": "none",
        "font-family": "var(--cortex-font-sans)",
        transition: "background var(--cortex-transition-fast)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--cortex-accent-primary)">
        <path d="M1 2.5A2.5 2.5 0 0 1 3.5 0h5.586a1.5 1.5 0 0 1 1.06.44l3.415 3.414A1.5 1.5 0 0 1 14 4.914V13.5a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 1 13.5v-11zM3.5 1A1.5 1.5 0 0 0 2 2.5v11A1.5 1.5 0 0 0 3.5 15h8a1.5 1.5 0 0 0 1.5-1.5V5H9.5A1.5 1.5 0 0 1 8 3.5V1H3.5zM9 1.414V3.5a.5.5 0 0 0 .5.5h2.086L9 1.414zM4 7a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 7zm0 2.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0 2.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5z" />
      </svg>
      {props.label}
    </a>
  );
}

export default Welcome;

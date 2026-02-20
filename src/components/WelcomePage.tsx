import { createSignal, Show, onMount, onCleanup, createEffect } from "solid-js";
import { useRecentProjects, type RecentProject } from "@/context/RecentProjectsContext";
import { useCommands } from "@/context/CommandContext";
import { CortexPromptInput } from "@/components/cortex/primitives/CortexInput";
import { CortexOpenProjectDropdown } from "@/components/cortex/primitives/CortexOpenProjectDropdown";
import { WelcomeRecentFiles } from "@/components/cortex/WelcomeRecentFiles";

const STORAGE_KEYS = {
  showOnStartup: "welcome_show_on_startup",
} as const;

interface WelcomePageProps {
  onClose?: () => void;
  onNewFile?: () => void;
  onOpenFolder?: () => void;
  onCloneRepository?: () => void;
}

export function WelcomePage(props: WelcomePageProps) {
  const recentProjects = useRecentProjects();
  const { registerCommand, unregisterCommand } = useCommands();

  const [isVisible, setIsVisible] = createSignal(true);
  const [showOnStartup, setShowOnStartup] = createSignal(
    localStorage.getItem(STORAGE_KEYS.showOnStartup) !== "false"
  );
  const [promptValue, setPromptValue] = createSignal("");
  const [dropdownOpen, setDropdownOpen] = createSignal(false);

  createEffect(() => {
    localStorage.setItem(STORAGE_KEYS.showOnStartup, showOnStartup().toString());
  });

  onMount(() => {
    registerCommand({
      id: "welcome.show",
      label: "Welcome: Show Welcome Page",
      category: "Help",
      action: () => setIsVisible(true),
    });

    const handleShowWelcome = () => setIsVisible(true);
    window.addEventListener("welcome:show", handleShowWelcome);

    onCleanup(() => {
      unregisterCommand("welcome.show");
      window.removeEventListener("welcome:show", handleShowWelcome);
    });
  });

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVisible()) {
        setIsVisible(false);
        props.onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handleOpenFolder = () => {
    props.onOpenFolder
      ? props.onOpenFolder()
      : window.dispatchEvent(new CustomEvent("folder:open"));
  };

  const handleNewFile = () => {
    props.onNewFile
      ? props.onNewFile()
      : window.dispatchEvent(new CustomEvent("file:new"));
  };

  const handleCloneRepo = () => {
    props.onCloneRepository
      ? props.onCloneRepository()
      : window.dispatchEvent(new CustomEvent("git:clone"));
  };

  const handlePromptSubmit = (value: string) => {
    if (!value.trim()) return;
    window.dispatchEvent(new CustomEvent("chat:submit", { detail: { message: value } }));
    setPromptValue("");
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
    <Show when={isVisible()}>
      <div
        class="welcome-page"
        style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "justify-content": "center",
          width: "100%",
          height: "100%",
          background: "var(--cortex-bg-primary)",
          overflow: "auto",
          "font-family": "var(--cortex-font-sans)",
          position: "relative",
        }}
      >
        <div style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "max-width": "560px",
          width: "100%",
          padding: "40px 24px",
          gap: "32px",
        }}>
          <img
            src="/assets/abstract-design.svg"
            alt=""
            style={{
              width: "100%",
              "max-width": "465px",
              height: "auto",
              opacity: "0.6",
            }}
          />

          <div style={{
            width: "100%",
            "max-width": "480px",
          }}>
            <CortexPromptInput
              value={promptValue()}
              onChange={setPromptValue}
              onSubmit={handlePromptSubmit}
              placeholder="Ask Cortex anything..."
              style={{ width: "100%" }}
            />
          </div>

          <div style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
          }}>
            <CortexOpenProjectDropdown
              label="Open Project"
              isOpen={dropdownOpen()}
              onClick={() => setDropdownOpen(!dropdownOpen())}
            >
              <Show when={dropdownOpen()}>
                <DropdownMenu
                  onOpenFolder={() => { setDropdownOpen(false); handleOpenFolder(); }}
                  onNewFile={() => { setDropdownOpen(false); handleNewFile(); }}
                  onCloneRepo={() => { setDropdownOpen(false); handleCloneRepo(); }}
                />
              </Show>
            </CortexOpenProjectDropdown>
          </div>

          <Show when={sortedProjects().length > 0}>
            <WelcomeRecentFiles
              projects={sortedProjects()}
              onOpen={handleOpenProject}
            />
          </Show>
        </div>

        <div style={{
          position: "absolute",
          bottom: "12px",
          right: "16px",
          display: "flex",
          "align-items": "center",
          gap: "8px",
        }}>
          <label style={{
            display: "flex",
            "align-items": "center",
            gap: "6px",
            cursor: "pointer",
            "font-size": "11px",
            color: "var(--cortex-text-tertiary)",
          }}>
            <input
              type="checkbox"
              checked={showOnStartup()}
              onChange={(e) => setShowOnStartup(e.currentTarget.checked)}
              style={{ "accent-color": "var(--cortex-accent-primary)" }}
            />
            Show on startup
          </label>
        </div>
      </div>
    </Show>
  );
}

interface DropdownMenuProps {
  onOpenFolder: () => void;
  onNewFile: () => void;
  onCloneRepo: () => void;
}

function DropdownMenu(props: DropdownMenuProps) {
  return (
    <div style={{
      position: "absolute",
      top: "calc(100% + 4px)",
      left: "0",
      "min-width": "200px",
      background: "var(--cortex-dropdown-bg)",
      border: "1px solid var(--cortex-dropdown-border)",
      "border-radius": "var(--cortex-radius-md)",
      "box-shadow": "var(--cortex-elevation-3)",
      "z-index": "var(--cortex-z-dropdown)",
      padding: "4px",
      "font-family": "var(--cortex-font-sans)",
    }}>
      <DropdownItem label="Open Folder" icon="folder" onClick={props.onOpenFolder} />
      <DropdownItem label="New File" icon="file" onClick={props.onNewFile} />
      <DropdownItem label="Clone Repository" icon="code-branch" onClick={props.onCloneRepo} />
    </div>
  );
}

function DropdownItem(props: { label: string; icon: string; onClick: () => void }) {
  const [hovered, setHovered] = createSignal(false);
  return (
    <button
      onClick={props.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        width: "100%",
        padding: "8px 12px",
        background: hovered() ? "var(--cortex-bg-hover)" : "transparent",
        border: "none",
        "border-radius": "var(--cortex-radius-xs)",
        color: "var(--cortex-text-primary)",
        "font-size": "13px",
        cursor: "pointer",
        "text-align": "left",
        "font-family": "var(--cortex-font-sans)",
        transition: "background var(--cortex-transition-fast)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--cortex-text-secondary)">
        <Show when={props.icon === "folder"}>
          <path d="M14.5 3H7.71l-2-2H1.5A1.5 1.5 0 0 0 0 2.5v11A1.5 1.5 0 0 0 1.5 15h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 3z"/>
        </Show>
        <Show when={props.icon === "file"}>
          <path d="M13.85 4.44l-3.29-3.29A1.5 1.5 0 0 0 9.5 0.75H3.5A1.5 1.5 0 0 0 2 2.25v11.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V5.5a1.5 1.5 0 0 0-.15-1.06z"/>
        </Show>
        <Show when={props.icon === "code-branch"}>
          <path d="M11.75 5a1.25 1.25 0 1 0-1.5 1.22V7.5a.5.5 0 0 1-.5.5H6.25a.5.5 0 0 1-.5-.5V6.22a1.25 1.25 0 1 0-1 0v3.56a1.25 1.25 0 1 0 1 0V8.5a.5.5 0 0 1 .5-.5h3.5a1.5 1.5 0 0 0 1.5-1.5V6.22A1.25 1.25 0 0 0 11.75 5z"/>
        </Show>
      </svg>
      {props.label}
    </button>
  );
}

export function shouldShowWelcomeOnStartup(): boolean {
  return localStorage.getItem(STORAGE_KEYS.showOnStartup) !== "false";
}

export function setShowWelcomeOnStartup(show: boolean): void {
  localStorage.setItem(STORAGE_KEYS.showOnStartup, show.toString());
}

export function showWelcomePage(): void {
  window.dispatchEvent(new CustomEvent("welcome:show"));
}

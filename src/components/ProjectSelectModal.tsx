import { createSignal, createEffect, Show, For } from "solid-js";
import { Modal } from "./ui/Modal";
import { Icon } from "./ui/Icon";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

interface CortexProject {
  name: string;
  path: string;
  modifiedAt: number;
}

export interface ProjectSelectModalProps {
  open: boolean;
  onClose: () => void;
  onProjectSelected: (path: string) => void;
}

type ModalMode = "choice" | "create" | "cortex-projects";

export function ProjectSelectModal(props: ProjectSelectModalProps) {
  const [mode, setMode] = createSignal<ModalMode>("choice");
  const [projectName, setProjectName] = createSignal("");
  const [defaultPath, setDefaultPath] = createSignal("");
  const [cortexProjects, setCortexProjects] = createSignal<CortexProject[]>([]);
  const [error, setError] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);

  let inputRef: HTMLInputElement | undefined;

  // Load default path and existing projects
  const loadData = async () => {
    try {
      const [path, projects] = await Promise.all([
        invoke<string>("fs_get_default_projects_dir"),
        invoke<CortexProject[]>("fs_list_cortex_projects"),
      ]);
      setDefaultPath(path);
      setCortexProjects(projects);
    } catch (e) {
      console.error("Failed to load project data:", e);
    }
  };

  // When modal opens, reset state and load data
  createEffect(() => {
    if (props.open) {
      loadData();
      setMode("choice");
      setProjectName("");
      setError("");
    }
  });

  // Focus input when switching to create mode
  createEffect(() => {
    if (mode() === "create" && inputRef) {
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  const handleOpenFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Open Project Folder",
      });
      if (selected && typeof selected === "string") {
        props.onProjectSelected(selected);
        props.onClose();
      }
    } catch (e) {
      setError(`Failed to open folder: ${e}`);
    }
  };

  const handleCreateProject = async () => {
    const name = projectName().trim();
    if (!name) {
      setError("Please enter a project name");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const path = await invoke<string>("fs_create_project", { name });
      props.onProjectSelected(path);
      props.onClose();
    } catch (e) {
      setError(`${e}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectCortexProject = (path: string) => {
    props.onProjectSelected(path);
    props.onClose();
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Styles
  const optionButtonStyle = {
    width: "100%",
    "text-align": "left" as const,
    padding: "14px 16px",
    "border-radius": "var(--cortex-radius-lg)",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    display: "flex",
    "align-items": "center",
    gap: "14px",
  };

  const optionButtonHoverStyle = {
    background: "rgba(255,255,255,0.06)",
    "border-color": "rgba(255,255,255,0.1)",
    transform: "translateY(-1px)",
  };

  const backButtonStyle = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    padding: "6px 10px",
    "border-radius": "var(--cortex-radius-md)",
    background: "transparent",
    border: "none",
    color: "var(--vibe-text-muted, var(--cortex-text-inactive))",
    cursor: "pointer",
    "font-size": "13px",
    "margin-bottom": "8px",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    "border-radius": "var(--cortex-radius-lg)",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(0,0,0,0.2)",
    color: "var(--vibe-text-primary, var(--cortex-text-primary))",
    "font-size": "14px",
    outline: "none",
  };

  const createButtonStyle = {
    width: "100%",
    padding: "12px",
    "border-radius": "var(--cortex-radius-lg)",
    border: "none",
    background: "var(--cortex-info)",
    color: "white",
    "font-size": "14px",
    "font-weight": "500",
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  const projectItemStyle = {
    width: "100%",
    "text-align": "left" as const,
    padding: "10px 14px",
    "border-radius": "var(--cortex-radius-md)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "background 0.1s ease",
    display: "flex",
    "align-items": "center",
    gap: "12px",
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={
        mode() === "choice"
          ? "Select a Project"
          : mode() === "create"
            ? "Create New Project"
            : "Cortex Projects"
      }
      closeOnOverlay={false}
      closeOnEscape={true}
      size="md"
    >
      {/* Choice View */}
      <Show when={mode() === "choice"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
          <p
            style={{
              color: "var(--vibe-text-muted, var(--cortex-text-inactive))",
              margin: "0 0 8px 0",
              "font-size": "14px",
            }}
          >
            Choose a project folder to start working
          </p>

          {/* Open Folder Button */}
          <button
            style={optionButtonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, optionButtonHoverStyle)}
            onMouseLeave={(e) =>
              Object.assign(e.currentTarget.style, {
                background: "rgba(255,255,255,0.03)",
                "border-color": "rgba(255,255,255,0.06)",
                transform: "translateY(0)",
              })
            }
            onClick={handleOpenFolder}
          >
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "36px",
                height: "36px",
                "border-radius": "var(--cortex-radius-md)",
                background: "rgba(59, 130, 246, 0.15)",
              }}
            >
              <Icon name="folder-open" style={{ width: "18px", height: "18px", color: "var(--cortex-info)" }} />
            </div>
            <div>
              <div
                style={{
                  "font-size": "14px",
                  "font-weight": "500",
                  color: "var(--vibe-text-primary, var(--cortex-text-primary))",
                }}
              >
                Open Existing Folder
              </div>
              <div style={{ "font-size": "12px", color: "var(--vibe-text-muted, var(--cortex-text-inactive))", "margin-top": "2px" }}>
                Select any folder from your computer
              </div>
            </div>
          </button>

          {/* Create Project Button */}
          <button
            style={optionButtonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, optionButtonHoverStyle)}
            onMouseLeave={(e) =>
              Object.assign(e.currentTarget.style, {
                background: "rgba(255,255,255,0.03)",
                "border-color": "rgba(255,255,255,0.06)",
                transform: "translateY(0)",
              })
            }
            onClick={() => setMode("create")}
          >
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "36px",
                height: "36px",
                "border-radius": "var(--cortex-radius-md)",
                background: "rgba(16, 185, 129, 0.15)",
              }}
            >
              <Icon name="folder-plus" style={{ width: "18px", height: "18px", color: "var(--cortex-success)" }} />
            </div>
            <div>
              <div
                style={{
                  "font-size": "14px",
                  "font-weight": "500",
                  color: "var(--vibe-text-primary, var(--cortex-text-primary))",
                }}
              >
                Create New Project
              </div>
              <div style={{ "font-size": "12px", color: "var(--vibe-text-muted, var(--cortex-text-inactive))", "margin-top": "2px" }}>
                Start fresh in Cortex/Projects
              </div>
            </div>
          </button>

          {/* Cortex Projects - Show if there are existing projects */}
          <Show when={cortexProjects().length > 0}>
            <button
              style={optionButtonStyle}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, optionButtonHoverStyle)}
              onMouseLeave={(e) =>
                Object.assign(e.currentTarget.style, {
                  background: "rgba(255,255,255,0.03)",
                  "border-color": "rgba(255,255,255,0.06)",
                  transform: "translateY(0)",
                })
              }
              onClick={() => setMode("cortex-projects")}
            >
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  width: "36px",
                  height: "36px",
                  "border-radius": "var(--cortex-radius-md)",
                  background: "rgba(168, 85, 247, 0.15)",
                }}
              >
                <Icon name="grid" style={{ width: "18px", height: "18px", color: "var(--cortex-info)" }} />
              </div>
              <div style={{ flex: "1" }}>
                <div
                  style={{
                    "font-size": "14px",
                    "font-weight": "500",
                    color: "var(--vibe-text-primary, var(--cortex-text-primary))",
                  }}
                >
                  Open Cortex Project
                </div>
                <div style={{ "font-size": "12px", color: "var(--vibe-text-muted, var(--cortex-text-inactive))", "margin-top": "2px" }}>
                  {cortexProjects().length} project{cortexProjects().length !== 1 ? "s" : ""} available
                </div>
              </div>
              <Icon
                name="chevron-right"
                style={{ width: "16px", height: "16px", color: "var(--vibe-text-muted, var(--cortex-text-inactive))" }}
              />
            </button>
          </Show>
        </div>
      </Show>

      {/* Create Project View */}
      <Show when={mode() === "create"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
          <button
            style={backButtonStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            onClick={() => {
              setMode("choice");
              setError("");
            }}
          >
            <Icon name="chevron-left" style={{ width: "14px", height: "14px" }} />
            Back
          </button>

          <div>
            <label
              style={{
                display: "block",
                "font-size": "13px",
                color: "var(--vibe-text-secondary, var(--cortex-text-inactive))",
                "margin-bottom": "8px",
              }}
            >
              Project Name
            </label>
            <input
              ref={inputRef}
              type="text"
              placeholder="my-awesome-project"
              value={projectName()}
              onInput={(e) => {
                setProjectName(e.currentTarget.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.5)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          <p
            style={{
              "font-size": "12px",
              color: "var(--vibe-text-muted, var(--cortex-bg-active))",
              margin: "0",
              "word-break": "break-all",
            }}
          >
            Will be created at:{" "}
            <span style={{ color: "var(--vibe-text-secondary, var(--cortex-text-inactive))" }}>
              {defaultPath()}/{projectName() || "..."}
            </span>
          </p>

          <Show when={error()}>
            <p
              style={{
                color: "var(--cortex-error)",
                "font-size": "13px",
                margin: "0",
                padding: "8px 12px",
                background: "rgba(239, 68, 68, 0.1)",
                "border-radius": "var(--cortex-radius-md)",
              }}
            >
              {error()}
            </p>
          </Show>

          <button
            style={{
              ...createButtonStyle,
              opacity: isCreating() ? 0.7 : 1,
              cursor: isCreating() ? "not-allowed" : "pointer",
            }}
            onClick={handleCreateProject}
            disabled={isCreating()}
            onMouseEnter={(e) => !isCreating() && (e.currentTarget.style.background = "var(--cortex-info)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--cortex-info)")}
          >
            {isCreating() ? "Creating..." : "Create Project"}
          </button>
        </div>
      </Show>

      {/* Cortex Projects List View */}
      <Show when={mode() === "cortex-projects"}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          <button
            style={backButtonStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            onClick={() => setMode("choice")}
          >
            <Icon name="chevron-left" style={{ width: "14px", height: "14px" }} />
            Back
          </button>

          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              gap: "2px",
              "max-height": "300px",
              "overflow-y": "auto",
            }}
          >
            <For each={cortexProjects()}>
              {(project) => (
                <button
                  style={projectItemStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  onClick={() => handleSelectCortexProject(project.path)}
                >
                  <Icon
                    name="folder"
                    style={{ width: "16px", height: "16px", color: "var(--vibe-text-muted, var(--cortex-text-inactive))" }}
                  />
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div
                      style={{
                        "font-size": "14px",
                        color: "var(--vibe-text-primary, var(--cortex-text-primary))",
                        "white-space": "nowrap",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                      }}
                    >
                      {project.name}
                    </div>
                  </div>
                  <div style={{ "font-size": "12px", color: "var(--vibe-text-muted, var(--cortex-bg-active))" }}>
                    {formatDate(project.modifiedAt)}
                  </div>
                </button>
              )}
            </For>
          </div>

          <Show when={cortexProjects().length === 0}>
            <p
              style={{
                "text-align": "center",
                color: "var(--vibe-text-muted, var(--cortex-text-inactive))",
                padding: "24px",
                "font-size": "14px",
              }}
            >
              No projects yet. Create your first one!
            </p>
          </Show>
        </div>
      </Show>
    </Modal>
  );
}


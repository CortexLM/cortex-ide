import { Component, JSX, For, Show, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { useWorkspaceTrust, type TrustedFolder } from "@/context/WorkspaceTrustContext";

export interface WorkspaceTrustEditorProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const WorkspaceTrustEditor: Component<WorkspaceTrustEditorProps> = (props) => {
  const trust = useWorkspaceTrust();
  const [newFolderPath, setNewFolderPath] = createSignal("");

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    gap: "24px",
    padding: "24px",
    background: "var(--cortex-bg-primary)",
    ...props.style,
  });

  const sectionStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "12px",
  };

  const sectionTitleStyle: JSX.CSSProperties = {
    "font-size": "14px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
  };

  const sectionDescStyle: JSX.CSSProperties = {
    "font-size": "12px",
    color: "var(--cortex-text-muted)",
    "margin-top": "-8px",
  };

  const listStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "4px",
    background: "var(--cortex-bg-secondary)",
    "border-radius": "var(--cortex-radius-md)",
    padding: "8px",
  };

  const itemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    background: "var(--cortex-bg-primary)",
    "border-radius": "var(--cortex-radius-sm)",
  };

  const itemPathStyle: JSX.CSSProperties = {
    flex: "1",
    "font-size": "12px",
    "font-family": "var(--cortex-font-mono)",
    color: "var(--cortex-text-primary)",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const itemDateStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--cortex-text-muted)",
    "flex-shrink": "0",
  };

  const inputRowStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "8px",
  };

  const inputStyle: JSX.CSSProperties = {
    flex: "1",
    padding: "8px 12px",
    "font-size": "12px",
    "font-family": "var(--cortex-font-mono)",
    background: "var(--cortex-bg-secondary)",
    border: "1px solid var(--cortex-border-default)",
    "border-radius": "var(--cortex-radius-sm)",
    color: "var(--cortex-text-primary)",
    outline: "none",
  };

  const toggleStyle = (_enabled: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "12px",
    background: "var(--cortex-bg-secondary)",
    "border-radius": "var(--cortex-radius-md)",
    cursor: "pointer",
  });

  const switchStyle = (enabled: boolean): JSX.CSSProperties => ({
    width: "36px",
    height: "20px",
    "border-radius": "10px",
    background: enabled ? "var(--cortex-accent-primary)" : "var(--cortex-bg-active)",
    position: "relative",
    transition: "background var(--cortex-transition-fast)",
    cursor: "pointer",
  });

  const switchKnobStyle = (enabled: boolean): JSX.CSSProperties => ({
    position: "absolute",
    top: "2px",
    left: enabled ? "18px" : "2px",
    width: "16px",
    height: "16px",
    "border-radius": "50%",
    background: "white",
    transition: "left var(--cortex-transition-fast)",
  });

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleAddFolder = () => {
    const path = newFolderPath().trim();
    if (path) {
      trust.addTrustedFolder(path);
      setNewFolderPath("");
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        trust.addTrustedFolder(selected);
      }
    } catch {
      // Dialog not available
    }
  };

  return (
    <div class={props.class} style={containerStyle()}>
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Workspace Trust Settings</div>
        <div style={sectionDescStyle}>
          Control which workspaces are trusted and can run code.
        </div>

        <div
          style={toggleStyle(trust.settings().enabled)}
          onClick={() => trust.updateSettings({ enabled: !trust.settings().enabled })}
        >
          <div>
            <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>
              Enable Workspace Trust
            </div>
            <div style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
              Restrict untrusted workspaces from running code
            </div>
          </div>
          <div style={switchStyle(trust.settings().enabled)}>
            <div style={switchKnobStyle(trust.settings().enabled)} />
          </div>
        </div>

        <div
          style={toggleStyle(trust.settings().showBanner)}
          onClick={() => trust.updateSettings({ showBanner: !trust.settings().showBanner })}
        >
          <div>
            <div style={{ "font-size": "13px", color: "var(--cortex-text-primary)" }}>
              Show Trust Banner
            </div>
            <div style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
              Display a banner when opening untrusted workspaces
            </div>
          </div>
          <div style={switchStyle(trust.settings().showBanner)}>
            <div style={switchKnobStyle(trust.settings().showBanner)} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Trusted Folders</div>
        <div style={sectionDescStyle}>
          Folders you trust. Subfolders are also trusted.
        </div>

        <div style={inputRowStyle}>
          <input
            type="text"
            style={inputStyle}
            placeholder="Enter folder path..."
            value={newFolderPath()}
            onInput={(e) => setNewFolderPath(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddFolder();
            }}
          />
          <Button variant="secondary" size="sm" onClick={handleBrowseFolder}>
            <Icon name="folder-open" size={14} />
            Browse
          </Button>
          <Button variant="primary" size="sm" onClick={handleAddFolder} disabled={!newFolderPath().trim()}>
            Add
          </Button>
        </div>

        <Show
          when={trust.trustedFolders().length > 0}
          fallback={
            <div style={{ ...listStyle, "align-items": "center", padding: "24px", color: "var(--cortex-text-muted)" }}>
              <Icon name="folder-open" size={24} style={{ opacity: "0.5" }} />
              <span style={{ "font-size": "12px" }}>No trusted folders configured</span>
            </div>
          }
        >
          <div style={listStyle}>
            <For each={trust.trustedFolders()}>
              {(folder: TrustedFolder) => (
                <div style={itemStyle}>
                  <Icon name="folder" size={14} style={{ color: "var(--cortex-text-muted)", "flex-shrink": "0" }} />
                  <span style={itemPathStyle} title={folder.path}>
                    {folder.path}
                  </span>
                  <Show when={folder.trustParent}>
                    <Badge variant="muted" size="sm">Parent</Badge>
                  </Show>
                  <span style={itemDateStyle}>{formatDate(folder.trustedAt)}</span>
                  <IconButton
                    icon={<Icon name="trash" size={12} />}
                    tooltip="Remove"
                    size="sm"
                    onClick={() => trust.removeTrustedFolder(folder.path)}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div style={sectionStyle}>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (confirm("Are you sure you want to clear all trust decisions?")) {
              trust.clearAllTrustDecisions();
            }
          }}
          style={{ "align-self": "flex-start" }}
        >
          <Icon name="trash" size={14} />
          Clear All Trust Decisions
        </Button>
      </div>
    </div>
  );
};

export default WorkspaceTrustEditor;

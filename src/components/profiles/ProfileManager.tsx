import { Show, For, createSignal, createEffect } from "solid-js";
import { useProfiles, type Profile } from "@/context/ProfilesContext";
import { Button, Input, Modal, IconButton, Text, Divider, Badge } from "@/components/ui";
import { getProfileIcon } from "./ProfileSwitcher";
import { Icon } from "../ui/Icon";
import type { JSX } from "solid-js";

type ManagerView = "list" | "edit" | "create";

export function ProfileManager() {
  const {
    profiles,
    activeProfileId,
    showManager,
    closeManager,
    createProfile,
    deleteProfile,
    duplicateProfile,
    updateProfile,
    switchProfile,
    exportProfile,
    importProfile,
    getAvailableIcons,
    isDefaultProfile,
  } = useProfiles();

  const [view, setView] = createSignal<ManagerView>("list");
  const [editingProfile, setEditingProfile] = createSignal<Profile | null>(null);
  const [newProfileName, setNewProfileName] = createSignal("");
  const [newProfileIcon, setNewProfileIcon] = createSignal("code");
  const [copyFromProfile, setCopyFromProfile] = createSignal<string | undefined>();
  const [error, setError] = createSignal<string | null>(null);
  const [importText, setImportText] = createSignal("");
  const [showImportDialog, setShowImportDialog] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal<string | null>(null);

  // Reset state when closing
  createEffect(() => {
    if (!showManager()) {
      setView("list");
      setEditingProfile(null);
      setNewProfileName("");
      setNewProfileIcon("code");
      setCopyFromProfile(undefined);
      setError(null);
      setImportText("");
      setShowImportDialog(false);
      setShowDeleteConfirm(null);
    }
  });

  const handleCreateProfile = async () => {
    const name = newProfileName().trim();
    if (!name) {
      setError("Profile name is required");
      return;
    }

    try {
      const profile = await createProfile(name, copyFromProfile());
      await updateProfile(profile.id, { icon: newProfileIcon() });
      setView("list");
      setNewProfileName("");
      setNewProfileIcon("code");
      setCopyFromProfile(undefined);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create profile");
    }
  };

  const handleUpdateProfile = async () => {
    const profile = editingProfile();
    if (!profile) return;

    const name = newProfileName().trim();
    if (!name) {
      setError("Profile name is required");
      return;
    }

    try {
      await updateProfile(profile.id, { 
        name, 
        icon: newProfileIcon() 
      });
      setView("list");
      setEditingProfile(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      await deleteProfile(id);
      setShowDeleteConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete profile");
    }
  };

  const handleDuplicate = async (profile: Profile) => {
    try {
      await duplicateProfile(profile.id, `${profile.name} (Copy)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate profile");
    }
  };

  const handleExport = async (profile: Profile) => {
    try {
      const json = await exportProfile(profile.id);
      if (json) {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${profile.name.toLowerCase().replace(/\s+/g, "-")}-profile.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export profile");
    }
  };

  const handleImport = async () => {
    const text = importText().trim();
    if (!text) {
      setError("Please paste profile JSON");
      return;
    }

    const result = await importProfile(text);
    if (result.success) {
      setShowImportDialog(false);
      setImportText("");
      setError(null);
    } else {
      setError(result.error || "Failed to import profile");
    }
  };

  const handleFileImport = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importProfile(text);
      if (result.success) {
        setShowImportDialog(false);
        setError(null);
      } else {
        setError(result.error || "Failed to import profile");
      }
    } catch (err) {
      setError("Failed to read file");
    }
    input.value = "";
  };

  const startEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setNewProfileName(profile.name);
    setNewProfileIcon(profile.icon || "code");
    setView("edit");
  };

  const startCreate = () => {
    setNewProfileName("");
    setNewProfileIcon("code");
    setCopyFromProfile(undefined);
    setView("create");
  };

  // Styles
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    "min-height": "400px",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    "margin-bottom": "16px",
  };

  const listStyle: JSX.CSSProperties = {
    flex: "1",
    "overflow-y": "auto",
    display: "flex",
    "flex-direction": "column",
    gap: "4px",
  };

  const profileItemStyle = (isActive: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "12px",
    "border-radius": "var(--jb-radius-md)",
    background: isActive ? "var(--jb-surface-alt)" : "transparent",
    border: isActive ? "1px solid var(--jb-accent)" : "1px solid transparent",
    cursor: "pointer",
    transition: "all var(--cortex-transition-fast)",
  });

  const iconContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "36px",
    height: "36px",
    "border-radius": "var(--jb-radius-md)",
    background: "var(--jb-surface-hover)",
    color: "var(--jb-text-body-color)",
  };

  const profileInfoStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
  };

  const profileNameStyle: JSX.CSSProperties = {
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
    "font-size": "13px",
  };

  const profileMetaStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "4px",
  };

  const iconGridStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "repeat(5, 1fr)",
    gap: "8px",
    padding: "12px 0",
  };

  const iconButtonStyle = (isSelected: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "40px",
    height: "40px",
    "border-radius": "var(--jb-radius-md)",
    border: isSelected ? "2px solid var(--jb-accent)" : "1px solid var(--jb-border-default)",
    background: isSelected ? "var(--jb-surface-alt)" : "transparent",
    cursor: "pointer",
    color: "var(--jb-text-body-color)",
  });

  const formStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "16px",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "12px",
    "font-weight": "500",
    color: "var(--jb-text-muted-color)",
    "margin-bottom": "6px",
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const getProfileStats = (profile: Profile): string => {
    const parts: string[] = [];
    if (profile.settings && Object.keys(profile.settings).length > 0) {
      parts.push("Settings");
    }
    if (profile.keybindings && profile.keybindings.length > 0) {
      parts.push(`${profile.keybindings.length} keybindings`);
    }
    if (profile.enabledExtensions && profile.enabledExtensions.length > 0) {
      parts.push(`${profile.enabledExtensions.length} extensions`);
    }
    return parts.length > 0 ? parts.join(" | ") : "Empty profile";
  };

  return (
    <Modal
      open={showManager()}
      onClose={closeManager}
      title={view() === "list" ? "Profiles" : view() === "create" ? "New Profile" : "Edit Profile"}
      size="lg"
      footer={
        <Show when={view() !== "list"}>
          <Button variant="ghost" onClick={() => setView("list")}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={view() === "create" ? handleCreateProfile : handleUpdateProfile}
          >
            {view() === "create" ? "Create Profile" : "Save Changes"}
          </Button>
        </Show>
      }
    >
      <div style={containerStyle}>
        <Show when={error()}>
          <div style={{ 
            padding: "8px 12px", 
            background: "var(--jb-error-bg)", 
            color: "var(--jb-error)",
            "border-radius": "var(--jb-radius-md)",
            "margin-bottom": "16px",
            "font-size": "12px",
          }}>
            {error()}
          </div>
        </Show>

        {/* List View */}
        <Show when={view() === "list"}>
          <div style={headerStyle}>
            <Text variant="body" style={{ color: "var(--jb-text-muted-color)" }}>
              {profiles().length} profile{profiles().length !== 1 ? "s" : ""}
            </Text>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowImportDialog(true)}
              >
                <Icon name="upload" size={14} />
                Import
              </Button>
              <Button variant="primary" size="sm" onClick={startCreate}>
                <Icon name="plus" size={14} />
                New Profile
              </Button>
            </div>
          </div>

          <div style={listStyle}>
            <For each={profiles()}>
              {(profile) => {
                const isActive = () => profile.id === activeProfileId();
                return (
                  <div
                    style={profileItemStyle(isActive())}
                    onClick={() => switchProfile(profile.id)}
                    onMouseEnter={(e) => {
                      if (!isActive()) {
                        e.currentTarget.style.background = "var(--jb-surface-hover)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive()) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div style={iconContainerStyle}>
                      {getProfileIcon(profile.icon, 18)}
                    </div>
                    
                    <div style={profileInfoStyle}>
                      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                        <span style={profileNameStyle}>{profile.name}</span>
                        <Show when={profile.isDefault}>
                          <Badge variant="default" size="sm">Default</Badge>
                        </Show>
                        <Show when={isActive()}>
                          <Badge variant="success" size="sm">Active</Badge>
                        </Show>
                      </div>
                      <span style={profileMetaStyle}>
                        {getProfileStats(profile)} | Updated {formatDate(profile.updatedAt)}
                      </span>
                    </div>

                    <div style={actionsStyle} onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        icon={<Icon name="pen" size={14} />}
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(profile)}
                        title="Edit profile"
                      />
                      <IconButton
                        icon={<Icon name="copy" size={14} />}
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicate(profile)}
                        title="Duplicate profile"
                      />
                      <IconButton
                        icon={<Icon name="download" size={14} />}
                        size="sm"
                        variant="ghost"
                        onClick={() => handleExport(profile)}
                        title="Export profile"
                      />
                      <Show when={!isDefaultProfile(profile.id)}>
                        <IconButton
                          icon={<Icon name="trash" size={14} />}
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowDeleteConfirm(profile.id)}
                          title="Delete profile"
                        />
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Create/Edit View */}
        <Show when={view() === "create" || view() === "edit"}>
          <div style={formStyle}>
            <div>
              <div style={labelStyle}>Profile Name</div>
              <Input
                value={newProfileName()}
                onInput={(e) => setNewProfileName(e.currentTarget.value)}
                placeholder="Enter profile name"
              />
            </div>

            <div>
              <div style={labelStyle}>Icon</div>
              <div style={iconGridStyle}>
                <For each={getAvailableIcons()}>
                  {(icon) => (
                    <button
                      style={iconButtonStyle(newProfileIcon() === icon)}
                      onClick={() => setNewProfileIcon(icon)}
                      type="button"
                    >
                      {getProfileIcon(icon, 18)}
                    </button>
                  )}
                </For>
              </div>
            </div>

            <Show when={view() === "create"}>
              <div>
                <div style={labelStyle}>Copy Settings From</div>
                <select
                  value={copyFromProfile() || ""}
                  onChange={(e) => setCopyFromProfile(e.currentTarget.value || undefined)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    "border-radius": "var(--jb-radius-md)",
                    border: "1px solid var(--jb-border-default)",
                    background: "var(--jb-input-bg)",
                    color: "var(--jb-text-body-color)",
                    "font-size": "13px",
                  }}
                >
                  <option value="">Start with empty profile</option>
                  <For each={profiles()}>
                    {(profile) => (
                      <option value={profile.id}>{profile.name}</option>
                    )}
                  </For>
                </select>
              </div>
            </Show>

            <Show when={view() === "edit" && editingProfile()}>
              <Divider />
              <div>
                <div style={labelStyle}>Profile Contents</div>
                <div style={{ 
                  display: "flex", 
                  "flex-direction": "column", 
                  gap: "8px",
                  "font-size": "12px",
                  color: "var(--jb-text-muted-color)",
                }}>
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <Icon name="gear" size={14} />
                    <span>
                      {editingProfile()?.settings && Object.keys(editingProfile()!.settings).length > 0 
                        ? `${Object.keys(editingProfile()!.settings).length} setting sections` 
                        : "No custom settings"}
                    </span>
                  </div>
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <Icon name="command" size={14} />
                    <span>
                      {editingProfile()?.keybindings?.length || 0} custom keybindings
                    </span>
                  </div>
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <Icon name="box" size={14} />
                    <span>
                      {editingProfile()?.enabledExtensions?.length || 0} enabled extensions
                    </span>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Delete Confirmation Modal */}
        <Show when={showDeleteConfirm()}>
          <Modal
            open={true}
            onClose={() => setShowDeleteConfirm(null)}
            title="Delete Profile"
            size="sm"
            footer={
              <>
                <Button variant="ghost" onClick={() => setShowDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button 
                  variant="danger" 
                  onClick={() => handleDeleteProfile(showDeleteConfirm()!)}
                >
                  Delete
                </Button>
              </>
            }
          >
            <Text>
              Are you sure you want to delete this profile? This action cannot be undone.
            </Text>
          </Modal>
        </Show>

        {/* Import Dialog */}
        <Show when={showImportDialog()}>
          <Modal
            open={true}
            onClose={() => {
              setShowImportDialog(false);
              setImportText("");
            }}
            title="Import Profile"
            size="md"
            footer={
              <>
                <Button variant="ghost" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleImport}>
                  Import
                </Button>
              </>
            }
          >
            <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
              <div>
                <div style={labelStyle}>Import from file</div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  style={{
                    "font-size": "12px",
                    color: "var(--jb-text-muted-color)",
                  }}
                />
              </div>
              <Divider />
              <div>
                <div style={labelStyle}>Or paste profile JSON</div>
                <textarea
                  value={importText()}
                  onInput={(e) => setImportText(e.currentTarget.value)}
                  placeholder='Paste profile JSON here...'
                  style={{
                    width: "100%",
                    height: "200px",
                    padding: "12px",
                    "border-radius": "var(--jb-radius-md)",
                    border: "1px solid var(--jb-border-default)",
                    background: "var(--jb-input-bg)",
                    color: "var(--jb-text-body-color)",
                    "font-family": "var(--jb-font-mono)",
                    "font-size": "12px",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </Modal>
        </Show>
      </div>
    </Modal>
  );
}

import { createSignal, For, Show, createEffect, onMount, onCleanup } from "solid-js";
import { useProfiles, type Profile } from "@/context/ProfilesContext";
import { Icon } from "../ui/Icon";
import { Button, IconButton, Input, Text, Badge } from "@/components/ui";

// ============================================================================
// Profile Manager Component
// ============================================================================

export function ProfileManager() {
  const profiles = useProfiles();
  const [editingProfileId, setEditingProfileId] = createSignal<string | null>(null);
  const [editingName, setEditingName] = createSignal("");
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal<string | null>(null);
  const [showIconPicker, setShowIconPicker] = createSignal<string | null>(null);
  const [menuOpenForId, setMenuOpenForId] = createSignal<string | null>(null);
  const [importError, setImportError] = createSignal<string | null>(null);
  const [importSuccess, setImportSuccess] = createSignal<string | null>(null);

  // Clear messages after timeout
  createEffect(() => {
    if (importError() || importSuccess()) {
      const timeout = setTimeout(() => {
        setImportError(null);
        setImportSuccess(null);
      }, 3000);
      onCleanup(() => clearTimeout(timeout));
    }
  });

  // Close menus on outside click
  onMount(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-profile-menu]")) {
        setMenuOpenForId(null);
      }
      if (!target.closest("[data-icon-picker]")) {
        setShowIconPicker(null);
      }
    };

    document.addEventListener("click", handleClick);
    onCleanup(() => document.removeEventListener("click", handleClick));
  });

  const startEditing = (profile: Profile) => {
    setEditingProfileId(profile.id);
    setEditingName(profile.name);
  };

  const saveEditing = () => {
    const id = editingProfileId();
    const name = editingName().trim();
    if (id && name) {
      profiles.renameProfile(id, name);
    }
    setEditingProfileId(null);
    setEditingName("");
  };

  const cancelEditing = () => {
    setEditingProfileId(null);
    setEditingName("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEditing();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const handleExport = async (profileId: string) => {
    const json = await profiles.exportProfile(profileId);
    if (json) {
      const profile = profiles.profiles().find((p) => p.id === profileId);
      const filename = `profile-${profile?.name || "export"}-${Date.now()}.json`;
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    setMenuOpenForId(null);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = await profiles.importProfile(text);
        if (result.success && result.profile) {
          setImportSuccess(`Imported profile: ${result.profile.name}`);
        } else {
          setImportError(result.error || "Failed to import profile");
        }
      } catch (err) {
        setImportError("Failed to read file");
      }
    };
    input.click();
  };

  const handleDelete = (profileId: string) => {
    profiles.deleteProfile(profileId);
    setShowDeleteConfirm(null);
    setMenuOpenForId(null);
  };

  const handleDuplicate = (profileId: string) => {
    const source = profiles.profiles().find((p) => p.id === profileId);
    if (source) {
      profiles.duplicateProfile(profileId, `${source.name} (Copy)`);
    }
    setMenuOpenForId(null);
  };

  const handleIconSelect = (profileId: string, icon: string) => {
    profiles.setProfileIcon(profileId, icon);
    setShowIconPicker(null);
  };

  const formatDate = (dateOrTimestamp: Date | number): string => {
    const date = typeof dateOrTimestamp === 'number' 
      ? new Date(dateOrTimestamp) 
      : dateOrTimestamp;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div class="flex flex-col gap-4 h-full">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <Text as="h2" size="lg" weight="semibold">
            User Profiles
          </Text>
          <Text variant="muted" size="sm" style={{ "margin-top": "4px" }}>
            Create and manage profiles with custom settings, keybindings, and snippets.
          </Text>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon name="upload" class="w-4 h-4" />}
            onClick={handleImport}
          >
            Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Icon name="plus" class="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            New Profile
          </Button>
        </div>
      </div>

      {/* Messages */}
      <Show when={importError()}>
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            color: "var(--error)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <Icon name="xmark" class="w-4 h-4" />
          {importError()}
        </div>
      </Show>

      <Show when={importSuccess()}>
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
          style={{
            background: "rgba(34, 197, 94, 0.1)",
            color: "var(--success)",
            border: "1px solid rgba(34, 197, 94, 0.2)",
          }}
        >
          <Icon name="check" class="w-4 h-4" />
          {importSuccess()}
        </div>
      </Show>

      {/* Profiles List */}
      <div class="flex flex-col gap-2 flex-1 overflow-y-auto">
        <For each={profiles.profiles()}>
          {(profile) => (
            <div
              class="flex items-center gap-3 p-3 rounded-lg transition-colors relative"
              style={{
                background:
                  profiles.activeProfileId() === profile.id
                    ? "var(--background-active)"
                    : "var(--background-hover)",
                border: `1px solid ${
                  profiles.activeProfileId() === profile.id
                    ? "var(--primary)"
                    : "var(--border-weak)"
                }`,
              }}
            >
              {/* Icon with picker */}
              <div class="relative" data-icon-picker>
                <IconButton
                  size="lg"
                  variant="ghost"
                  tooltip="Change icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowIconPicker(
                      showIconPicker() === profile.id ? null : profile.id
                    );
                  }}
                  style={{ width: "40px", height: "40px", "font-size": "24px" }}
                >
                  {profile.icon}
                </IconButton>

                {/* Icon Picker Dropdown */}
                <Show when={showIconPicker() === profile.id}>
                  <div
                    class="absolute left-0 top-full mt-1 p-2 rounded-lg shadow-lg z-50 grid grid-cols-5 gap-1"
                    style={{
                      background: "var(--background-elevated)",
                      border: "1px solid var(--border-weak)",
                      width: "180px",
                    }}
                  >
                    <For each={profiles.getAvailableIcons()}>
                      {(icon) => (
                        <IconButton
                          size="md"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIconSelect(profile.id, icon);
                          }}
                          style={{ width: "32px", height: "32px", "font-size": "18px" }}
                        >
                          {icon}
                        </IconButton>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              {/* Profile Info */}
              <div class="flex-1 min-w-0">
                <Show
                  when={editingProfileId() !== profile.id}
                  fallback={
                    <div class="flex items-center gap-2">
                      <Input
                        type="text"
                        value={editingName()}
                        onInput={(e) => setEditingName(e.currentTarget.value)}
                        onKeyDown={handleKeyDown}
                        autofocus
                        style={{ flex: "1" }}
                      />
                      <IconButton
                        size="sm"
                        variant="ghost"
                        tooltip="Save"
                        onClick={saveEditing}
                      >
                        <Icon
                          name="check"
                          class="w-4 h-4"
                          style={{ color: "var(--success)" }}
                        />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant="ghost"
                        tooltip="Cancel"
                        onClick={cancelEditing}
                      >
                        <Icon
                          name="xmark"
                          class="w-4 h-4"
                          style={{ color: "var(--error)" }}
                        />
                      </IconButton>
                    </div>
                  }
                >
                  <div class="flex items-center gap-2">
                    <Text weight="medium" truncate>
                      {profile.name}
                    </Text>
                    <Show when={profiles.activeProfileId() === profile.id}>
                      <Badge variant="accent">
                        Active
                      </Badge>
                    </Show>
                    <Show when={profiles.isDefaultProfile(profile.id)}>
                      <Badge variant="default">
                        Default
                      </Badge>
                    </Show>
                  </div>
                  <Text variant="muted" size="xs" style={{ "margin-top": "2px" }}>
                    Updated {formatDate(profile.updatedAt)}
                  </Text>
                </Show>
              </div>

              {/* Actions */}
              <div class="flex items-center gap-1">
                <Show when={profiles.activeProfileId() !== profile.id}>
                  <Button
                    variant="primary"
                    size="sm"
                    iconRight={<Icon name="chevron-right" class="w-3 h-3" />}
                    onClick={() => profiles.switchProfile(profile.id)}
                  >
                    Switch
                  </Button>
                </Show>

                {/* More Actions Menu */}
                <div class="relative" data-profile-menu>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    tooltip="More actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenForId(
                        menuOpenForId() === profile.id ? null : profile.id
                      );
                    }}
                  >
<Icon
                    name="ellipsis-vertical"
                    class="w-4 h-4"
                    style={{ color: "var(--text-weaker)" }}
                  />
                  </IconButton>

                  <Show when={menuOpenForId() === profile.id}>
                    <div
                      class="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-50 min-w-[160px]"
                      style={{
                        background: "var(--background-elevated)",
                        border: "1px solid var(--border-weak)",
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Icon name="pen" class="w-4 h-4" />}
                        onClick={() => {
                          startEditing(profile);
                          setMenuOpenForId(null);
                        }}
                        style={{ width: "100%", "justify-content": "flex-start", padding: "6px 12px" }}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Icon name="copy" class="w-4 h-4" />}
                        onClick={() => handleDuplicate(profile.id)}
                        style={{ width: "100%", "justify-content": "flex-start", padding: "6px 12px" }}
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Icon name="download" class="w-4 h-4" />}
                        onClick={() => handleExport(profile.id)}
                        style={{ width: "100%", "justify-content": "flex-start", padding: "6px 12px" }}
                      >
                        Export
                      </Button>
                      <Show when={!profiles.isDefaultProfile(profile.id)}>
                        <div
                          class="my-1 mx-2"
                          style={{
                            height: "1px",
                            background: "var(--border-weak)",
                          }}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Icon name="trash" class="w-4 h-4" />}
                          onClick={() => {
                            setShowDeleteConfirm(profile.id);
                            setMenuOpenForId(null);
                          }}
                          style={{ width: "100%", "justify-content": "flex-start", padding: "6px 12px" }}
                        >
                          Delete
                        </Button>
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Create Profile Modal */}
      <Show when={showCreateModal()}>
        <CreateProfileModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (name, icon, copyFromCurrent) => {
            // Create profile (optionally copying from current active profile)
            const copyFromId = copyFromCurrent ? profiles.activeProfileId() : undefined;
            const newProfile = await profiles.createProfile(name, copyFromId ?? undefined);
            // Set the icon if specified
            if (icon && newProfile?.id) {
              await profiles.setProfileIcon(newProfile.id, icon);
            }
            setShowCreateModal(false);
          }}
          icons={profiles.getAvailableIcons()}
        />
      </Show>

      {/* Delete Confirmation Modal */}
      <Show when={showDeleteConfirm()}>
        <DeleteConfirmModal
          profileName={
            profiles.profiles().find((p) => p.id === showDeleteConfirm())
              ?.name || ""
          }
          onConfirm={() => handleDelete(showDeleteConfirm()!)}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      </Show>
    </div>
  );
}

// ============================================================================
// Create Profile Modal
// ============================================================================

interface CreateProfileModalProps {
  onClose: () => void;
  onCreate: (name: string, icon: string, copyFromCurrent: boolean) => void;
  icons: string[];
}

function CreateProfileModal(props: CreateProfileModalProps) {
  const [name, setName] = createSignal("");
  const [selectedIcon, setSelectedIcon] = createSignal("👤");
  const [copyFromCurrent, setCopyFromCurrent] = createSignal(false);

  const handleCreate = () => {
    const trimmedName = name().trim();
    if (trimmedName) {
      props.onCreate(trimmedName, selectedIcon(), copyFromCurrent());
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && name().trim()) {
      handleCreate();
    } else if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <div
      class="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class="rounded-xl shadow-2xl p-6 w-full max-w-md"
        style={{
          background: "var(--background-elevated)",
          border: "1px solid var(--border-weak)",
        }}
      >
        <Text as="h3" size="lg" weight="semibold" style={{ "margin-bottom": "16px" }}>
          Create New Profile
        </Text>

        {/* Name Input */}
        <div class="mb-4">
          <Input
            label="Profile Name"
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="e.g., Work, Personal, Minimal"
            autofocus
          />
        </div>

        {/* Icon Picker */}
        <div class="mb-4">
          <Text as="label" variant="muted" weight="medium" style={{ display: "block", "margin-bottom": "6px" }}>
            Icon
          </Text>
          <div class="flex flex-wrap gap-1 p-2 rounded-md" style={{
            background: "var(--background-base)",
            border: "1px solid var(--border-weak)",
          }}>
            <For each={props.icons}>
              {(icon) => (
                <IconButton
                  size="md"
                  variant="ghost"
                  active={selectedIcon() === icon}
                  onClick={() => setSelectedIcon(icon)}
                  style={{ width: "32px", height: "32px", "font-size": "18px" }}
                >
                  {icon}
                </IconButton>
              )}
            </For>
          </div>
        </div>

        {/* Copy Settings Option */}
        <label class="flex items-center gap-2 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={copyFromCurrent()}
            onChange={(e) => setCopyFromCurrent(e.currentTarget.checked)}
            class="w-4 h-4 rounded"
            style={{
              "accent-color": "var(--primary)",
            }}
          />
          <Text size="sm">
            Copy settings from current profile
          </Text>
        </label>

        {/* Actions */}
        <div class="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={props.onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!name().trim()}
          >
            Create Profile
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Delete Confirmation Modal
// ============================================================================

interface DeleteConfirmModalProps {
  profileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal(props: DeleteConfirmModalProps) {
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <div
      class="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onCancel();
      }}
    >
      <div
        class="rounded-xl shadow-2xl p-6 w-full max-w-sm"
        style={{
          background: "var(--background-elevated)",
          border: "1px solid var(--border-weak)",
        }}
      >
        <div class="flex items-center gap-3 mb-4">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
            }}
          >
            <Icon name="trash" class="w-5 h-5" style={{ color: "var(--error)" }} />
          </div>
          <Text as="h3" size="lg" weight="semibold">
            Delete Profile
          </Text>
        </div>

        <Text variant="muted" size="sm" style={{ "margin-bottom": "24px", display: "block" }}>
          Are you sure you want to delete{" "}
          <Text as="span" weight="medium">
            "{props.profileName}"
          </Text>
          ? This action cannot be undone.
        </Text>

        <div class="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={props.onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={props.onConfirm}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Profile Quick Switch Component (for StatusBar)
// ============================================================================

export function ProfileQuickSwitch() {
  const profiles = useProfiles();
  const [isOpen, setIsOpen] = createSignal(false);

  // Close on outside click
  onMount(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-profile-quick-switch]")) {
        setIsOpen(false);
      }
    };

    document.addEventListener("click", handleClick);
    onCleanup(() => document.removeEventListener("click", handleClick));
  });

  // Listen for quick switch toggle from keyboard
  onMount(() => {
    const handleQuickSwitch = () => setIsOpen((prev) => !prev);
    window.addEventListener("profiles:toggle-quick-switch", handleQuickSwitch);
    onCleanup(() =>
      window.removeEventListener("profiles:toggle-quick-switch", handleQuickSwitch)
    );
  });

  // Sync with context state
  createEffect(() => {
    if (profiles.showQuickSwitch()) {
      setIsOpen(true);
    }
  });

  createEffect(() => {
    if (!isOpen()) {
      profiles.closeQuickSwitch();
    }
  });

  const activeProfile = () => profiles.activeProfile();

  return (
    <div class="relative" data-profile-quick-switch>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen());
        }}
        title="Switch Profile (Ctrl+Alt+P)"
        style={{ padding: "2px 6px", gap: "4px" }}
      >
        <Text size="xs">{activeProfile()?.icon || "👤"}</Text>
        <Text size="xs" truncate style={{ "max-width": "60px" }}>
          {activeProfile()?.name || "Profile"}
        </Text>
      </Button>

      <Show when={isOpen()}>
        <div
          class="absolute bottom-full right-0 mb-1 py-1 rounded-lg shadow-lg z-50 min-w-[180px]"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border-weak)",
          }}
        >
          <div
            class="px-3 py-1.5 border-b"
            style={{
              "border-color": "var(--border-weak)",
            }}
          >
            <Text size="xs" weight="medium" variant="muted">
              Switch Profile
            </Text>
          </div>
          <For each={profiles.profiles()}>
            {(profile) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  profiles.switchProfile(profile.id);
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  "justify-content": "flex-start",
                  padding: "6px 12px",
                  gap: "8px",
                  color:
                    profiles.activeProfileId() === profile.id
                      ? "var(--primary)"
                      : "var(--text-base)",
                  background:
                    profiles.activeProfileId() === profile.id
                      ? "rgba(99, 102, 241, 0.1)"
                      : "transparent",
                }}
              >
                <Text size="sm">{profile.icon}</Text>
                <Text size="sm" truncate style={{ flex: "1", "text-align": "left" }}>{profile.name}</Text>
                <Show when={profiles.activeProfileId() === profile.id}>
                  <Icon name="check" class="w-3.5 h-3.5" />
                </Show>
              </Button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Profile Command (for Command Palette)
// ============================================================================

export function registerProfileCommands(
  registerCommand: (command: {
    id: string;
    label: string;
    category: string;
    shortcut?: string;
    action: () => void;
  }) => void
) {
  registerCommand({
    id: "profiles.switch",
    label: "Profiles: Switch Profile",
    category: "Profiles",
    shortcut: "Ctrl+Alt+P",
    action: () => {
      window.dispatchEvent(new CustomEvent("profiles:toggle-quick-switch"));
    },
  });

  registerCommand({
    id: "profiles.create",
    label: "Profiles: Create New Profile",
    category: "Profiles",
    action: () => {
      window.dispatchEvent(new CustomEvent("profiles:open-create-modal"));
    },
  });

  registerCommand({
    id: "profiles.manage",
    label: "Profiles: Manage Profiles",
    category: "Profiles",
    action: () => {
      window.dispatchEvent(
        new CustomEvent("settings:open-tab")
      );
    },
  });

  registerCommand({
    id: "profiles.export",
    label: "Profiles: Export Current Profile",
    category: "Profiles",
    action: () => {
      window.dispatchEvent(new CustomEvent("profiles:export-current"));
    },
  });

  registerCommand({
    id: "profiles.import",
    label: "Profiles: Import Profile",
    category: "Profiles",
    action: () => {
      window.dispatchEvent(new CustomEvent("profiles:import"));
    },
  });
}

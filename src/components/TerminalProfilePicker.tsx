import { createSignal, createMemo, For, Show, onCleanup, onMount } from "solid-js";
import { Icon } from "./ui/Icon";
import {
  useTerminals,
  TerminalProfile,
  TerminalProfileConfig,
  TerminalProfileIcon,
} from "@/context/TerminalsContext";

// Icon mapping for terminal profiles - now uses Icon name strings
const PROFILE_ICONS: Record<TerminalProfileIcon, { iconName: string; label: string }> = {
  terminal: { iconName: "terminal", label: "Terminal" },
  powershell: { iconName: "terminal", label: "PowerShell" },
  bash: { iconName: "terminal", label: "Bash" },
  zsh: { iconName: "terminal", label: "Zsh" },
  fish: { iconName: "terminal", label: "Fish" },
  cmd: { iconName: "terminal", label: "Command Prompt" },
  git: { iconName: "code", label: "Git" },
  node: { iconName: "code", label: "Node.js" },
  python: { iconName: "code", label: "Python" },
  ruby: { iconName: "code", label: "Ruby" },
  rust: { iconName: "code", label: "Rust" },
  docker: { iconName: "terminal", label: "Docker" },
  ubuntu: { iconName: "terminal", label: "Ubuntu" },
  debian: { iconName: "terminal", label: "Debian" },
  arch: { iconName: "terminal", label: "Arch" },
  fedora: { iconName: "terminal", label: "Fedora" },
  nushell: { iconName: "terminal", label: "Nushell" },
  custom: { iconName: "terminal", label: "Custom" },
};

// Available profile colors
const PROFILE_COLORS = [
  { hex: "var(--cortex-info)", name: "Indigo" },
  { hex: "var(--cortex-success)", name: "Green" },
  { hex: "var(--cortex-warning)", name: "Amber" },
  { hex: "var(--cortex-error)", name: "Red" },
  { hex: "var(--cortex-info)", name: "Violet" },
  { hex: "var(--cortex-info)", name: "Cyan" },
  { hex: "var(--cortex-error)", name: "Pink" },
  { hex: "var(--cortex-success)", name: "Lime" },
  { hex: "var(--cortex-warning)", name: "Orange" },
  { hex: "var(--cortex-info)", name: "Teal" },
  { hex: "var(--cortex-text-inactive)", name: "Slate" },
  { hex: "var(--cortex-info)", name: "Purple" },
];

// Available icon types
const AVAILABLE_ICONS: TerminalProfileIcon[] = [
  "terminal",
  "powershell",
  "bash",
  "zsh",
  "fish",
  "cmd",
  "git",
  "node",
  "python",
  "ruby",
  "rust",
  "docker",
  "ubuntu",
  "debian",
  "arch",
  "fedora",
  "nushell",
  "custom",
];

interface ProfileEditorProps {
  profile?: TerminalProfile;
  onSave: (config: TerminalProfileConfig) => void;
  onCancel: () => void;
  isNew?: boolean;
}

/**
 * Profile Editor Modal Component
 * Allows editing profile name, path, args, icon, color, and environment variables
 */
function ProfileEditor(props: ProfileEditorProps) {
  const [name, setName] = createSignal(props.profile?.name ?? "");
  const [path, setPath] = createSignal(props.profile?.path ?? "");
  const [args, setArgs] = createSignal(props.profile?.args?.join(" ") ?? "");
  const [icon, setIcon] = createSignal<TerminalProfileIcon>(props.profile?.icon ?? "terminal");
  const [color, setColor] = createSignal(props.profile?.color ?? "var(--cortex-info)");
  const [envVars, setEnvVars] = createSignal<Array<{ key: string; value: string }>>(
    props.profile?.env
      ? Object.entries(props.profile.env).map(([key, value]) => ({ key, value }))
      : []
  );
  const [showIconPicker, setShowIconPicker] = createSignal(false);
  const [showColorPicker, setShowColorPicker] = createSignal(false);

  const isValid = createMemo(() => {
    return name().trim().length > 0 && path().trim().length > 0;
  });

  const handleSave = () => {
    if (!isValid()) return;

    const env: Record<string, string> = {};
    for (const { key, value } of envVars()) {
      if (key.trim()) {
        env[key.trim()] = value;
      }
    }

    const config: TerminalProfileConfig = {
      name: name().trim(),
      path: path().trim(),
      args: args().trim() ? args().trim().split(/\s+/) : [],
      icon: icon(),
      color: color(),
      env: Object.keys(env).length > 0 ? env : undefined,
    };

    props.onSave(config);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars(), { key: "", value: "" }]);
  };

  const updateEnvVar = (index: number, field: "key" | "value", newValue: string) => {
    const updated = [...envVars()];
    updated[index][field] = newValue;
    setEnvVars(updated);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars().filter((_, i) => i !== index));
  };

  // Close on escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onCancel();
    } else if (e.key === "Enter" && e.ctrlKey && isValid()) {
      handleSave();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  const iconName = createMemo(() => PROFILE_ICONS[icon()].iconName);

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onCancel();
      }}
    >
      <div
        class="w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden"
        style={{
          background: "var(--surface-base)",
          "border-color": "var(--border-base)",
          "max-height": "90vh",
        }}
      >
        {/* Header */}
        <div
          class="flex items-center justify-between px-4 py-3 border-b"
          style={{ "border-color": "var(--border-base)" }}
        >
          <div class="flex items-center gap-2">
            <Icon name={iconName()} class="w-4 h-4" style={{ color: color() }} />
            <span class="font-medium" style={{ color: "var(--text-base)" }}>
              {props.isNew ? "New Terminal Profile" : "Edit Profile"}
            </span>
          </div>
          <button
            onClick={props.onCancel}
            class="p-1.5 rounded-lg hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
          >
            <Icon name="xmark" class="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div class="p-4 space-y-4 overflow-y-auto" style={{ "max-height": "calc(90vh - 120px)" }}>
          {/* Name Field */}
          <div>
            <label class="block text-xs font-medium mb-1.5" style={{ color: "var(--text-weak)" }}>
              Profile Name
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g., PowerShell Core"
              class="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                background: "var(--surface-raised)",
                "border-color": "var(--border-base)",
                color: "var(--text-base)",
              }}
              autofocus
            />
          </div>

          {/* Path Field */}
          <div>
            <label class="block text-xs font-medium mb-1.5" style={{ color: "var(--text-weak)" }}>
              Shell Path
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                value={path()}
                onInput={(e) => setPath(e.currentTarget.value)}
                placeholder="e.g., C:\\Program Files\\PowerShell\\7\\pwsh.exe"
                class="flex-1 px-3 py-2 rounded-lg border text-sm font-mono"
                style={{
                  background: "var(--surface-raised)",
                  "border-color": "var(--border-base)",
                  color: "var(--text-base)",
                }}
              />
              <button
                class="px-3 py-2 rounded-lg border hover:bg-[var(--surface-hover)]"
                style={{
                  background: "var(--surface-raised)",
                  "border-color": "var(--border-base)",
                  color: "var(--text-weak)",
                }}
                title="Browse..."
              >
                <Icon name="folder" class="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Arguments Field */}
          <div>
            <label class="block text-xs font-medium mb-1.5" style={{ color: "var(--text-weak)" }}>
              Arguments (optional)
            </label>
            <input
              type="text"
              value={args()}
              onInput={(e) => setArgs(e.currentTarget.value)}
              placeholder="e.g., -NoLogo -NoProfile"
              class="w-full px-3 py-2 rounded-lg border text-sm font-mono"
              style={{
                background: "var(--surface-raised)",
                "border-color": "var(--border-base)",
                color: "var(--text-base)",
              }}
            />
            <span class="text-xs mt-1 block" style={{ color: "var(--text-weaker)" }}>
              Space-separated arguments to pass to the shell
            </span>
          </div>

          {/* Icon and Color Row */}
          <div class="grid grid-cols-2 gap-4">
            {/* Icon Picker */}
            <div class="relative">
              <label class="block text-xs font-medium mb-1.5" style={{ color: "var(--text-weak)" }}>
                Icon
              </label>
              <button
                onClick={() => {
                  setShowIconPicker(!showIconPicker());
                  setShowColorPicker(false);
                }}
                class="w-full flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-[var(--surface-hover)]"
                style={{
                  background: "var(--surface-raised)",
                  "border-color": showIconPicker() ? "var(--text-weak)" : "var(--border-base)",
                  color: "var(--text-base)",
                }}
              >
                <Icon name={iconName()} class="w-4 h-4" style={{ color: color() }} />
                <span class="flex-1 text-left text-sm">{PROFILE_ICONS[icon()].label}</span>
                <Icon
                  name="chevron-down"
                  class="w-3.5 h-3.5"
                  style={{
                    color: "var(--text-weak)",
                    transform: showIconPicker() ? "rotate(180deg)" : "none",
                    transition: "transform 150ms",
                  }}
                />
              </button>

              {/* Icon Picker Dropdown */}
              <Show when={showIconPicker()}>
                <div
                  class="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border shadow-xl overflow-hidden"
                  style={{
                    background: "var(--surface-base)",
                    "border-color": "var(--border-base)",
                    "max-height": "200px",
                    "overflow-y": "auto",
                  }}
                >
                <For each={AVAILABLE_ICONS}>
                    {(iconType) => {
                      const iconTypeName = PROFILE_ICONS[iconType].iconName;
                      return (
                        <button
                          onClick={() => {
                            setIcon(iconType);
                            setShowIconPicker(false);
                          }}
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
                          style={{ color: "var(--text-base)" }}
                        >
                          <Icon name={iconTypeName} class="w-4 h-4" style={{ color: color() }} />
                          <span class="flex-1 text-left">{PROFILE_ICONS[iconType].label}</span>
                          <Show when={icon() === iconType}>
                            <Icon name="check" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>

            {/* Color Picker */}
            <div class="relative">
              <label class="block text-xs font-medium mb-1.5" style={{ color: "var(--text-weak)" }}>
                Color
              </label>
              <button
                onClick={() => {
                  setShowColorPicker(!showColorPicker());
                  setShowIconPicker(false);
                }}
                class="w-full flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-[var(--surface-hover)]"
                style={{
                  background: "var(--surface-raised)",
                  "border-color": showColorPicker() ? "var(--text-weak)" : "var(--border-base)",
                  color: "var(--text-base)",
                }}
              >
                <div
                  class="w-4 h-4 rounded"
                  style={{ background: color() }}
                />
                <span class="flex-1 text-left text-sm font-mono">{color()}</span>
                <Icon
                  name="chevron-down"
                  class="w-3.5 h-3.5"
                  style={{
                    color: "var(--text-weak)",
                    transform: showColorPicker() ? "rotate(180deg)" : "none",
                    transition: "transform 150ms",
                  }}
                />
              </button>

              {/* Color Picker Dropdown */}
              <Show when={showColorPicker()}>
                <div
                  class="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border shadow-xl p-2"
                  style={{
                    background: "var(--surface-base)",
                    "border-color": "var(--border-base)",
                  }}
                >
                  <div class="grid grid-cols-6 gap-1.5 mb-2">
                    <For each={PROFILE_COLORS}>
                      {(colorOption) => (
                        <button
                          onClick={() => {
                            setColor(colorOption.hex);
                            setShowColorPicker(false);
                          }}
                          class="w-7 h-7 rounded-lg border-2 hover:scale-110 transition-transform"
                          style={{
                            background: colorOption.hex,
                            "border-color": color() === colorOption.hex ? "white" : "transparent",
                          }}
                          title={colorOption.name}
                        />
                      )}
                    </For>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      type="color"
                      value={color()}
                      onInput={(e) => setColor(e.currentTarget.value)}
                      class="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={color()}
                      onInput={(e) => {
                        const val = e.currentTarget.value;
                        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                          setColor(val);
                        }
                      }}
                      placeholder="var(--cortex-accent-text)"
                      class="flex-1 px-2 py-1 rounded border font-mono text-xs"
                      style={{
                        background: "var(--surface-raised)",
                        "border-color": "var(--border-base)",
                        color: "var(--text-base)",
                      }}
                    />
                  </div>
                </div>
              </Show>
            </div>
          </div>

          {/* Environment Variables */}
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                Environment Variables
              </label>
              <button
                onClick={addEnvVar}
                class="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
              >
                <Icon name="plus" class="w-3 h-3" />
                Add Variable
              </button>
            </div>
            <Show
              when={envVars().length > 0}
              fallback={
                <div
                  class="px-3 py-4 rounded-lg border text-center text-xs"
                  style={{
                    background: "var(--surface-raised)",
                    "border-color": "var(--border-base)",
                    color: "var(--text-weaker)",
                  }}
                >
                  No environment variables defined
                </div>
              }
            >
              <div class="space-y-2">
                <For each={envVars()}>
                  {(envVar, index) => (
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        value={envVar.key}
                        onInput={(e) => updateEnvVar(index(), "key", e.currentTarget.value)}
                        placeholder="KEY"
                        class="w-1/3 px-2 py-1.5 rounded border text-xs font-mono"
                        style={{
                          background: "var(--surface-raised)",
                          "border-color": "var(--border-base)",
                          color: "var(--text-base)",
                        }}
                      />
                      <span class="text-xs" style={{ color: "var(--text-weaker)" }}>=</span>
                      <input
                        type="text"
                        value={envVar.value}
                        onInput={(e) => updateEnvVar(index(), "value", e.currentTarget.value)}
                        placeholder="value"
                        class="flex-1 px-2 py-1.5 rounded border text-xs font-mono"
                        style={{
                          background: "var(--surface-raised)",
                          "border-color": "var(--border-base)",
                          color: "var(--text-base)",
                        }}
                      />
                      <button
                        onClick={() => removeEnvVar(index())}
                        class="p-1.5 rounded hover:bg-[var(--surface-raised)]"
                        style={{ color: "var(--text-weak)" }}
                      >
                        <Icon name="xmark" class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* Footer */}
        <div
          class="flex items-center justify-end gap-2 px-4 py-3 border-t"
          style={{ "border-color": "var(--border-base)", background: "var(--surface-raised)" }}
        >
          <button
            onClick={props.onCancel}
            class="px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-base)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid()}
            class="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: isValid() ? "var(--text-weaker)" : "var(--surface-base)",
              color: isValid() ? "var(--background-base)" : "var(--text-weaker)",
              cursor: isValid() ? "pointer" : "not-allowed",
              opacity: isValid() ? 1 : 0.5,
            }}
          >
            {props.isNew ? "Create Profile" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TerminalProfilePickerProps {
  /** Called when a profile is selected for terminal creation */
  onSelectProfile?: (profile: TerminalProfile) => void;
  /** Show as dropdown (default) or inline list */
  variant?: "dropdown" | "inline";
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * Terminal Profile Picker Component
 * Displays a dropdown/list of available terminal profiles with options to:
 * - Select a profile to create a terminal
 * - Set a default profile
 * - Create new custom profiles
 * - Edit existing profiles
 * - Delete custom profiles
 */
export function TerminalProfilePicker(props: TerminalProfilePickerProps) {
  const {
    state,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
    getDefaultProfile,
    createTerminalWithProfile,
    openTerminal,
  } = useTerminals();

  const [isOpen, setIsOpen] = createSignal(false);
  const [showEditor, setShowEditor] = createSignal(false);
  const [editingProfile, setEditingProfile] = createSignal<TerminalProfile | undefined>(undefined);
  const [hoveredProfileId, setHoveredProfileId] = createSignal<string | null>(null);

  const defaultProfile = createMemo(() => getDefaultProfile());

  const builtinProfiles = createMemo(() => state.profiles.filter((p) => p.isBuiltin));
  const customProfiles = createMemo(() => state.profiles.filter((p) => !p.isBuiltin));

  const handleSelectProfile = async (profile: TerminalProfile) => {
    setIsOpen(false);

    if (props.onSelectProfile) {
      props.onSelectProfile(profile);
    } else {
      // Default behavior: create terminal and open it
      try {
        const terminal = await createTerminalWithProfile(profile.id);
        openTerminal(terminal.id);
      } catch (e) {
        console.error("[TerminalProfilePicker] Failed to create terminal:", e);
      }
    }
  };

  const handleCreateProfile = () => {
    setEditingProfile(undefined);
    setShowEditor(true);
    setIsOpen(false);
  };

  const handleEditProfile = (profile: TerminalProfile) => {
    setEditingProfile(profile);
    setShowEditor(true);
    setIsOpen(false);
  };

  const handleDeleteProfile = async (profile: TerminalProfile) => {
    if (profile.isBuiltin) return;
    await deleteProfile(profile.id);
  };

  const handleSetDefault = (profile: TerminalProfile) => {
    setDefaultProfile(profile.id);
  };

  const handleSaveProfile = async (config: TerminalProfileConfig) => {
    const editing = editingProfile();
    if (editing) {
      await updateProfile(editing.id, config);
    } else {
      await createProfile(config);
    }
    setShowEditor(false);
    setEditingProfile(undefined);
  };

  const handleCancelEdit = () => {
    setShowEditor(false);
    setEditingProfile(undefined);
  };

  // Close dropdown on click outside
  let dropdownRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  const renderProfileItem = (profile: TerminalProfile, showActions: boolean = true) => {
    const profileIconName = PROFILE_ICONS[profile.icon].iconName;
    const isHovered = hoveredProfileId() === profile.id;

    return (
      <div
        class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
        onMouseEnter={() => setHoveredProfileId(profile.id)}
        onMouseLeave={() => setHoveredProfileId(null)}
        onClick={() => handleSelectProfile(profile)}
      >
        {/* Icon */}
        <Icon name={profileIconName} class="w-4 h-4 shrink-0" style={{ color: profile.color }} />

        {/* Name and info */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-sm truncate" style={{ color: "var(--text-base)" }}>
              {profile.name}
            </span>
            <Show when={profile.isDefault}>
              <span
                class="text-[10px] px-1 py-0.5 rounded"
                style={{ background: "var(--surface-raised)", color: "var(--text-weak)" }}
              >
                Default
              </span>
            </Show>
          </div>
          <Show when={!props.compact}>
            <div class="text-xs truncate" style={{ color: "var(--text-weaker)" }}>
              {profile.path}
            </div>
          </Show>
        </div>

        {/* Actions */}
        <Show when={showActions && isHovered}>
          <div class="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Show when={!profile.isDefault}>
              <button
                onClick={() => handleSetDefault(profile)}
                class="p-1 rounded hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
                title="Set as Default"
              >
                <Icon name="star" class="w-3.5 h-3.5" />
              </button>
            </Show>
            <Show when={!profile.isBuiltin}>
              <button
                onClick={() => handleEditProfile(profile)}
                class="p-1 rounded hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
                title="Edit Profile"
              >
                <Icon name="pen" class="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDeleteProfile(profile)}
                class="p-1 rounded hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--cortex-error)" }}
                title="Delete Profile"
              >
                <Icon name="trash" class="w-3.5 h-3.5" />
              </button>
            </Show>
          </div>
        </Show>
      </div>
    );
  };

  // Inline variant - show all profiles in a list
  if (props.variant === "inline") {
    return (
      <>
        <div
          class="rounded-lg border overflow-hidden"
          style={{ background: "var(--surface-base)", "border-color": "var(--border-base)" }}
        >
          <Show when={builtinProfiles().length > 0}>
            <div
              class="px-3 py-1.5 text-xs font-medium border-b"
              style={{ color: "var(--text-weak)", "border-color": "var(--border-base)" }}
            >
              Detected Shells
            </div>
            <For each={builtinProfiles()}>{(profile) => renderProfileItem(profile)}</For>
          </Show>

          <Show when={customProfiles().length > 0}>
            <div
              class="px-3 py-1.5 text-xs font-medium border-t border-b"
              style={{ color: "var(--text-weak)", "border-color": "var(--border-base)" }}
            >
              Custom Profiles
            </div>
            <For each={customProfiles()}>{(profile) => renderProfileItem(profile)}</For>
          </Show>

          <button
            onClick={handleCreateProfile}
            class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border-t hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-weak)", "border-color": "var(--border-base)" }}
          >
            <Icon name="plus" class="w-4 h-4" />
            <span>New Profile</span>
          </button>
        </div>

        {/* Profile Editor Modal */}
        <Show when={showEditor()}>
          <ProfileEditor
            profile={editingProfile()}
            onSave={handleSaveProfile}
            onCancel={handleCancelEdit}
            isNew={!editingProfile()}
          />
        </Show>
      </>
    );
  }

  // Dropdown variant (default)
  return (
    <>
      <div class="relative" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen())}
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:border-[var(--border-active)] transition-colors"
          style={{
            background: "var(--surface-raised)",
            "border-color": isOpen() ? "var(--text-weak)" : "var(--border-base)",
            color: "var(--text-base)",
          }}
        >
          <Show
            when={defaultProfile()}
            fallback={<Icon name="terminal" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />}
          >
            {(profile) => {
              const profileIcon = PROFILE_ICONS[profile().icon].iconName;
              return <Icon name={profileIcon} class="w-4 h-4" style={{ color: profile().color }} />;
            }}
          </Show>
          <span class="text-sm max-w-[120px] truncate">
            {defaultProfile()?.name ?? "Select Profile"}
          </span>
          <Icon
            name="chevron-down"
            class="w-3.5 h-3.5"
            style={{
              color: "var(--text-weak)",
              transform: isOpen() ? "rotate(180deg)" : "none",
              transition: "transform 150ms",
            }}
          />
        </button>

        {/* Dropdown Panel */}
        <Show when={isOpen()}>
          <div
            class="absolute top-full left-0 mt-1 z-50 min-w-[280px] max-h-[400px] overflow-hidden rounded-lg border shadow-xl"
            style={{
              background: "var(--surface-base)",
              "border-color": "var(--border-base)",
            }}
          >
            {/* Profiles List */}
            <div class="max-h-[300px] overflow-y-auto">
              <Show when={state.profiles.length === 0}>
                <div
                  class="px-4 py-6 text-center text-sm"
                  style={{ color: "var(--text-weak)" }}
                >
                  <Show when={!state.profilesLoaded} fallback="No profiles available">
                    Loading profiles...
                  </Show>
                </div>
              </Show>

              <Show when={builtinProfiles().length > 0}>
                <div
                  class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b"
                  style={{ color: "var(--text-weaker)", "border-color": "var(--border-base)" }}
                >
                  Detected Shells
                </div>
                <For each={builtinProfiles()}>{(profile) => renderProfileItem(profile)}</For>
              </Show>

              <Show when={customProfiles().length > 0}>
                <div
                  class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-t border-b"
                  style={{ color: "var(--text-weaker)", "border-color": "var(--border-base)" }}
                >
                  Custom Profiles
                </div>
                <For each={customProfiles()}>{(profile) => renderProfileItem(profile)}</For>
              </Show>
            </div>

            {/* Create New Profile */}
            <div class="border-t" style={{ "border-color": "var(--border-base)" }}>
              <button
                onClick={handleCreateProfile}
                class="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--surface-hover)]"
                style={{ color: "var(--text-weak)" }}
              >
                <Icon name="plus" class="w-4 h-4" />
                <span>New Profile...</span>
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* Profile Editor Modal */}
      <Show when={showEditor()}>
        <ProfileEditor
          profile={editingProfile()}
          onSave={handleSaveProfile}
          onCancel={handleCancelEdit}
          isNew={!editingProfile()}
        />
      </Show>
    </>
  );
}

export default TerminalProfilePicker;


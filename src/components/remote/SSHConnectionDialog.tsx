/**
 * SSH Connection Dialog
 *
 * Modal dialog for creating and managing SSH connections.
 * Features:
 * - Host/Port/Username configuration
 * - Multiple authentication methods (Password, SSH Key, SSH Agent)
 * - Private key file selection with browse
 * - Save connection profiles
 * - Recent/saved connections list
 * - Test connection functionality
 * - Connection status feedback
 */

import { createSignal, Show, For, createEffect, onMount, batch, onCleanup } from "solid-js";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../ui/Icon";
import { ConnectionProfile, AuthMethod, useRemote } from "@/context/RemoteContext";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

export interface SSHConnectionDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when the dialog should close */
  onClose: () => void;
  /** Profile to edit (if editing existing) */
  editProfile?: ConnectionProfile;
  /** Called when a connection is initiated */
  onConnect?: (profile: ConnectionProfile) => void;
  /** Saved connection profiles to show */
  savedConnections?: ConnectionProfile[];
}

interface TestResult {
  success: boolean;
  message: string;
  platform?: string;
  elapsed?: number;
}

// ============================================================================
// Component
// ============================================================================

export function SSHConnectionDialog(props: SSHConnectionDialogProps) {
  const remote = useRemote();

  // Form state
  const [name, setName] = createSignal("");
  const [host, setHost] = createSignal("");
  const [port, setPort] = createSignal(22);
  const [username, setUsername] = createSignal("");
  const [authType, setAuthType] = createSignal<"password" | "key" | "agent">("key");
  const [password, setPassword] = createSignal("");
  const [privateKeyPath, setPrivateKeyPath] = createSignal("");
  const [passphrase, setPassphrase] = createSignal("");
  const [defaultDirectory, setDefaultDirectory] = createSignal("");
  const [saveConnection, setSaveConnection] = createSignal(true);

  // UI state
  const [availableKeys, setAvailableKeys] = createSignal<string[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [isTesting, setIsTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal<TestResult | null>(null);
  const [profileId, setProfileId] = createSignal("");
  const [activeTab, setActiveTab] = createSignal<"form" | "saved">("form");
  const [showPasswordField, setShowPasswordField] = createSignal(false);

  // Refs
  let dialogRef: HTMLDivElement | undefined;

  // ============================================================================
  // Effects
  // ============================================================================

  // Load available SSH keys
  onMount(async () => {
    try {
      const keys = await remote.getDefaultKeyPaths();
      setAvailableKeys(keys);
      if (keys.length > 0 && !props.editProfile) {
        setPrivateKeyPath(keys[0]);
      }
    } catch (e) {
      console.error("Failed to get default key paths:", e);
    }
  });

  // Generate profile ID for new profiles
  createEffect(async () => {
    if (props.isOpen && !props.editProfile) {
      try {
        const id = await remote.generateProfileId();
        setProfileId(id);
      } catch (e) {
        console.error("Failed to generate profile ID:", e);
        setProfileId(`profile_${Date.now()}`);
      }
    }
  });

  // Populate form when editing
  createEffect(() => {
    if (props.editProfile) {
      batch(() => {
        setProfileId(props.editProfile!.id);
        setName(props.editProfile!.name);
        setHost(props.editProfile!.host);
        setPort(props.editProfile!.port);
        setUsername(props.editProfile!.username);
        setAuthType(props.editProfile!.auth_method.type);
        setDefaultDirectory(props.editProfile!.default_directory || "");
        setSaveConnection(true);

        if (props.editProfile!.auth_method.type === "password") {
          setPassword(props.editProfile!.auth_method.password || "");
        } else if (props.editProfile!.auth_method.type === "key") {
          setPrivateKeyPath(props.editProfile!.auth_method.private_key_path || "");
          setPassphrase(props.editProfile!.auth_method.passphrase || "");
        }
      });
    } else {
      // Reset form for new profile
      resetForm();
    }
  });

  // Reset test result when form changes
  createEffect(() => {
    // Track relevant fields
    host();
    port();
    username();
    authType();
    password();
    privateKeyPath();
    passphrase();
    // Clear test result
    setTestResult(null);
  });

  // Handle escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && props.isOpen) {
      props.onClose();
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  // ============================================================================
  // Helpers
  // ============================================================================

  const resetForm = () => {
    batch(() => {
      setName("");
      setHost("");
      setPort(22);
      setUsername("");
      setAuthType("key");
      setPassword("");
      setPassphrase("");
      setDefaultDirectory("");
      setSaveConnection(true);
      setError(null);
      setTestResult(null);
      if (availableKeys().length > 0) {
        setPrivateKeyPath(availableKeys()[0]);
      } else {
        setPrivateKeyPath("");
      }
    });
  };

  const buildProfile = (): ConnectionProfile => {
    let authMethod: AuthMethod;

    switch (authType()) {
      case "password":
        authMethod = { type: "password", password: password() };
        break;
      case "key":
        authMethod = {
          type: "key",
          private_key_path: privateKeyPath(),
          passphrase: passphrase() || undefined,
        };
        break;
      case "agent":
        authMethod = { type: "agent" };
        break;
    }

    return {
      id: profileId(),
      name: name() || `${username()}@${host()}`,
      host: host(),
      port: port(),
      username: username(),
      auth_method: authMethod,
      default_directory: defaultDirectory() || undefined,
      port_forwards: [],
    };
  };

  const isValid = () => {
    return (
      host().trim() !== "" &&
      username().trim() !== "" &&
      (authType() !== "password" || password().trim() !== "") &&
      (authType() !== "key" || privateKeyPath().trim() !== "")
    );
  };

  // ============================================================================
  // Actions
  // ============================================================================

  const handleBrowseKey = async () => {
    try {
      const selected = await open({
        multiple: false,
        title: "Select SSH Private Key",
        filters: [
          { name: "All Files", extensions: ["*"] },
          { name: "Private Keys", extensions: ["pem", "key"] },
        ],
      });
      if (selected && typeof selected === "string") {
        setPrivateKeyPath(selected);
      }
    } catch (e) {
      console.error("Failed to open file dialog:", e);
    }
  };

  const handleTestConnection = async () => {
    if (!isValid()) return;

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    const startTime = Date.now();

    try {
      const profile = buildProfile();
      // For testing, we attempt a quick connection
      const result = await Promise.race([
        remote.connect(profile).then(async (info) => {
          // Disconnect immediately after successful test
          await remote.disconnect(info.id);
          return {
            success: true,
            platform: info.platform,
          };
        }),
        new Promise<{ success: false; error: string }>((_, reject) =>
          setTimeout(() => reject({ success: false, error: "Connection timeout" }), 30000)
        ),
      ]);

      const elapsed = Date.now() - startTime;

      if (result.success) {
        setTestResult({
          success: true,
          message: `Connected successfully${result.platform ? ` to ${result.platform}` : ""}`,
          platform: result.platform,
          elapsed,
        });
      }
    } catch (e) {
      const elapsed = Date.now() - startTime;
      setTestResult({
        success: false,
        message: String(e),
        elapsed,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!isValid()) return;

    setError(null);
    setIsSaving(true);

    try {
      const profile = buildProfile();
      await remote.saveProfile(profile);
      props.onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!isValid()) return;

    setError(null);
    setIsConnecting(true);

    try {
      const profile = buildProfile();

      // Save profile if checkbox is checked
      if (saveConnection()) {
        await remote.saveProfile(profile);
      }

      // Connect
      await remote.connect(profile);
      props.onConnect?.(profile);
      props.onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSelectSaved = (profile: ConnectionProfile) => {
    batch(() => {
      setProfileId(profile.id);
      setName(profile.name);
      setHost(profile.host);
      setPort(profile.port);
      setUsername(profile.username);
      setAuthType(profile.auth_method.type);
      setDefaultDirectory(profile.default_directory || "");
      setSaveConnection(false); // Already saved

      if (profile.auth_method.type === "password") {
        setPassword(profile.auth_method.password || "");
      } else if (profile.auth_method.type === "key") {
        setPrivateKeyPath(profile.auth_method.private_key_path || "");
        setPassphrase(profile.auth_method.passphrase || "");
      }

      setActiveTab("form");
    });
  };

  const handleQuickConnect = async (profile: ConnectionProfile) => {
    setError(null);
    setIsConnecting(true);

    try {
      await remote.connect(profile);
      props.onConnect?.(profile);
      props.onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDeleteProfile = async (profileId: string, e: MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this saved connection?")) {
      try {
        await remote.deleteProfile(profileId);
      } catch (e) {
        console.error("Failed to delete profile:", e);
      }
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  const savedProfiles = () => props.savedConnections || remote.state.profiles;

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={props.onClose}
        />

        {/* Dialog */}
        <div
          ref={dialogRef}
          class="relative w-full max-w-xl rounded-lg shadow-2xl animate-in fade-in zoom-in-95"
          style={{
            "background-color": "var(--surface-base)",
            border: "1px solid var(--border-base)",
            "max-height": "85vh",
          }}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-5 py-4 border-b"
            style={{ "border-color": "var(--border-base)" }}
          >
            <div class="flex items-center gap-3">
              <div
                class="p-2 rounded-lg"
                style={{ "background-color": tokens.colors.semantic.primary + "20" }}
              >
                <Icon
                  name="terminal"
                  class="w-5 h-5"
                  style={{ color: tokens.colors.semantic.primary }}
                />
              </div>
              <div>
                <h2
                  class="text-lg font-semibold"
                  style={{ color: "var(--text-base)" }}
                >
                  {props.editProfile ? "Edit SSH Connection" : "New SSH Connection"}
                </h2>
                <p
                  class="text-xs"
                  style={{ color: "var(--text-weak)" }}
                >
                  Connect to a remote server via SSH
                </p>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="p-2 rounded-lg hover:bg-[var(--surface-raised)] transition-colors"
              style={{ color: "var(--text-weak)" }}
            >
              <Icon name="xmark" class="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <Show when={savedProfiles().length > 0 && !props.editProfile}>
            <div
              class="flex gap-1 px-5 py-2 border-b"
              style={{ "border-color": "var(--border-base)" }}
            >
              <button
                onClick={() => setActiveTab("form")}
                class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={{
                  "background-color":
                    activeTab() === "form" ? "var(--accent)" : "transparent",
                  color: activeTab() === "form" ? "white" : "var(--text-weak)",
                }}
              >
                <Icon name="plus" class="w-4 h-4" />
                New Connection
              </button>
              <button
                onClick={() => setActiveTab("saved")}
                class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={{
                  "background-color":
                    activeTab() === "saved" ? "var(--accent)" : "transparent",
                  color: activeTab() === "saved" ? "white" : "var(--text-weak)",
                }}
              >
                <Icon name="clock" class="w-4 h-4" />
                Saved ({savedProfiles().length})
              </button>
            </div>
          </Show>

          {/* Content */}
          <div class="overflow-y-auto" style={{ "max-height": "calc(85vh - 180px)" }}>
            {/* Saved Connections Tab */}
            <Show when={activeTab() === "saved"}>
              <div class="p-4 space-y-2">
                <For each={savedProfiles()}>
                  {(profile) => (
                    <div
                      class="group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-[var(--surface-raised)]"
                      style={{
                        border: "1px solid var(--border-base)",
                      }}
                      onClick={() => handleSelectSaved(profile)}
                    >
                      <div
                        class="p-2 rounded-lg"
                        style={{
                          "background-color": "var(--surface-raised)",
                        }}
                      >
                        <Icon
                          name="server"
                          class="w-4 h-4"
                          style={{ color: tokens.colors.text.muted }}
                        />
                      </div>

                      <div class="flex-1 min-w-0">
                        <div
                          class="font-medium truncate"
                          style={{ color: "var(--text-base)" }}
                        >
                          {profile.name}
                        </div>
                        <div
                          class="text-xs truncate"
                          style={{ color: "var(--text-weak)" }}
                        >
                          {profile.username}@{profile.host}:{profile.port}
                        </div>
                      </div>

                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickConnect(profile);
                          }}
                          class="p-2 rounded-lg hover:bg-[var(--surface-overlay)] transition-colors"
                          style={{ color: tokens.colors.semantic.success }}
                          title="Quick Connect"
                        >
                          <Icon name="bolt" class="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteProfile(profile.id, e)}
                          class="p-2 rounded-lg hover:bg-[var(--surface-overlay)] transition-colors"
                          style={{ color: tokens.colors.semantic.error }}
                          title="Delete"
                        >
                          <Icon name="trash" class="w-4 h-4" />
                        </button>
                      </div>

                      <Icon
                        name="chevron-right"
                        class="w-4 h-4 opacity-50"
                        style={{ color: "var(--text-weak)" }}
                      />
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Connection Form Tab */}
            <Show when={activeTab() === "form"}>
              <div class="p-5 space-y-5">
                {/* Connection Name */}
                <div class="space-y-2">
                  <label
                    class="text-sm font-medium"
                    style={{ color: "var(--text-base)" }}
                  >
                    Connection Name
                  </label>
                  <div class="relative">
                    <Icon
                      name="server"
                      class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: "var(--text-weak)" }}
                    />
                    <input
                      type="text"
                      value={name()}
                      onInput={(e) => setName(e.currentTarget.value)}
                      placeholder="My Server (optional)"
                      class="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      style={{
                        "background-color": "var(--surface-raised)",
                        border: "1px solid var(--border-base)",
                        color: "var(--text-base)",
                      }}
                    />
                  </div>
                </div>

                {/* Host and Port */}
                <div class="grid grid-cols-4 gap-3">
                  <div class="col-span-3 space-y-2">
                    <label
                      class="text-sm font-medium"
                      style={{ color: "var(--text-base)" }}
                    >
                      Host <span style={{ color: tokens.colors.semantic.error }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={host()}
                      onInput={(e) => setHost(e.currentTarget.value)}
                      placeholder="192.168.1.100 or server.example.com"
                      class="w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      style={{
                        "background-color": "var(--surface-raised)",
                        border: "1px solid var(--border-base)",
                        color: "var(--text-base)",
                      }}
                    />
                  </div>
                  <div class="space-y-2">
                    <label
                      class="text-sm font-medium"
                      style={{ color: "var(--text-base)" }}
                    >
                      Port
                    </label>
                    <input
                      type="number"
                      value={port()}
                      onInput={(e) => setPort(parseInt(e.currentTarget.value) || 22)}
                      min="1"
                      max="65535"
                      class="w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      style={{
                        "background-color": "var(--surface-raised)",
                        border: "1px solid var(--border-base)",
                        color: "var(--text-base)",
                      }}
                    />
                  </div>
                </div>

                {/* Username */}
                <div class="space-y-2">
                  <label
                    class="text-sm font-medium"
                    style={{ color: "var(--text-base)" }}
                  >
                    Username <span style={{ color: tokens.colors.semantic.error }}>*</span>
                  </label>
                  <div class="relative">
                    <Icon
                      name="user"
                      class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: "var(--text-weak)" }}
                    />
                    <input
                      type="text"
                      value={username()}
                      onInput={(e) => setUsername(e.currentTarget.value)}
                      placeholder="root"
                      class="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      style={{
                        "background-color": "var(--surface-raised)",
                        border: "1px solid var(--border-base)",
                        color: "var(--text-base)",
                      }}
                    />
                  </div>
                </div>

                {/* Authentication Type */}
                <div class="space-y-3">
                  <label
                    class="text-sm font-medium"
                    style={{ color: "var(--text-base)" }}
                  >
                    Authentication
                  </label>
                  <div class="flex gap-2">
                    <button
                      onClick={() => setAuthType("key")}
                      class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                      style={{
                        "background-color":
                          authType() === "key" ? "var(--accent)" : "var(--surface-raised)",
                        color: authType() === "key" ? "white" : "var(--text-base)",
                        border: `1px solid ${authType() === "key" ? "var(--accent)" : "var(--border-base)"}`,
                      }}
                    >
                      <Icon name="key" class="w-4 h-4" />
                      SSH Key
                    </button>
                    <button
                      onClick={() => setAuthType("password")}
                      class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                      style={{
                        "background-color":
                          authType() === "password" ? "var(--accent)" : "var(--surface-raised)",
                        color: authType() === "password" ? "white" : "var(--text-base)",
                        border: `1px solid ${authType() === "password" ? "var(--accent)" : "var(--border-base)"}`,
                      }}
                    >
                      <Icon name="lock" class="w-4 h-4" />
                      Password
                    </button>
                    <button
                      onClick={() => setAuthType("agent")}
                      class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                      style={{
                        "background-color":
                          authType() === "agent" ? "var(--accent)" : "var(--surface-raised)",
                        color: authType() === "agent" ? "white" : "var(--text-base)",
                        border: `1px solid ${authType() === "agent" ? "var(--accent)" : "var(--border-base)"}`,
                      }}
                    >
                      SSH Agent
                    </button>
                  </div>
                </div>

                {/* Password Auth */}
                <Show when={authType() === "password"}>
                  <div class="space-y-2">
                    <label
                      class="text-sm font-medium"
                      style={{ color: "var(--text-base)" }}
                    >
                      Password <span style={{ color: tokens.colors.semantic.error }}>*</span>
                    </label>
                    <div class="relative">
                      <Icon
                        name="lock"
                        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: "var(--text-weak)" }}
                      />
                      <input
                        type={showPasswordField() ? "text" : "password"}
                        value={password()}
                        onInput={(e) => setPassword(e.currentTarget.value)}
                        placeholder="Enter password"
                        class="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        style={{
                          "background-color": "var(--surface-raised)",
                          border: "1px solid var(--border-base)",
                          color: "var(--text-base)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordField(!showPasswordField())}
                        class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--surface-overlay)]"
                        style={{ color: "var(--text-weak)" }}
                      >
                        {showPasswordField() ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </Show>

                {/* SSH Key Auth */}
                <Show when={authType() === "key"}>
                  <div class="space-y-4">
                    <div class="space-y-2">
                      <label
                        class="text-sm font-medium"
                        style={{ color: "var(--text-base)" }}
                      >
                        Private Key Path{" "}
                        <span style={{ color: tokens.colors.semantic.error }}>*</span>
                      </label>
                      <div class="flex gap-2">
                        <Show
                          when={availableKeys().length > 0}
                          fallback={
                            <input
                              type="text"
                              value={privateKeyPath()}
                              onInput={(e) => setPrivateKeyPath(e.currentTarget.value)}
                              placeholder="~/.ssh/id_rsa"
                              class="flex-1 px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                              style={{
                                "background-color": "var(--surface-raised)",
                                border: "1px solid var(--border-base)",
                                color: "var(--text-base)",
                              }}
                            />
                          }
                        >
                          <select
                            value={privateKeyPath()}
                            onChange={(e) => setPrivateKeyPath(e.currentTarget.value)}
                            class="flex-1 px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            style={{
                              "background-color": "var(--surface-raised)",
                              border: "1px solid var(--border-base)",
                              color: "var(--text-base)",
                            }}
                          >
                            <For each={availableKeys()}>
                              {(key) => <option value={key}>{key}</option>}
                            </For>
                            <option value="">Custom path...</option>
                          </select>
                        </Show>
                        <button
                          onClick={handleBrowseKey}
                          class="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--surface-overlay)]"
                          style={{
                            "background-color": "var(--surface-raised)",
                            border: "1px solid var(--border-base)",
                            color: "var(--text-base)",
                          }}
                        >
                          <Icon name="file" class="w-4 h-4" />
                          Browse
                        </button>
                      </div>
                    </div>
                    <div class="space-y-2">
                      <label
                        class="text-sm font-medium"
                        style={{ color: "var(--text-base)" }}
                      >
                        Passphrase (if key is encrypted)
                      </label>
                      <input
                        type="password"
                        value={passphrase()}
                        onInput={(e) => setPassphrase(e.currentTarget.value)}
                        placeholder="Key passphrase"
                        class="w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        style={{
                          "background-color": "var(--surface-raised)",
                          border: "1px solid var(--border-base)",
                          color: "var(--text-base)",
                        }}
                      />
                    </div>
                  </div>
                </Show>

                {/* SSH Agent Auth */}
                <Show when={authType() === "agent"}>
                  <div
                    class="flex items-start gap-3 px-4 py-3 rounded-lg"
                    style={{
                      "background-color": tokens.colors.semantic.info + "15",
                      border: `1px solid ${tokens.colors.semantic.info}30`,
                    }}
                  >
                    <Icon
                      name="key"
                      class="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: tokens.colors.semantic.info }}
                    />
                    <div>
                      <p
                        class="text-sm font-medium"
                        style={{ color: tokens.colors.semantic.info }}
                      >
                        SSH Agent Authentication
                      </p>
                      <p
                        class="text-xs mt-1"
                        style={{ color: "var(--text-weak)" }}
                      >
                        Make sure your key is loaded with{" "}
                        <code
                          class="px-1 py-0.5 rounded"
                          style={{ "background-color": "var(--surface-raised)" }}
                        >
                          ssh-add
                        </code>
                        . The SSH agent will handle authentication automatically.
                      </p>
                    </div>
                  </div>
                </Show>

                {/* Default Directory */}
                <div class="space-y-2">
                  <label
                    class="text-sm font-medium"
                    style={{ color: "var(--text-base)" }}
                  >
                    Default Directory (optional)
                  </label>
                  <div class="relative">
                    <Icon
                      name="folder"
                      class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: "var(--text-weak)" }}
                    />
                    <input
                      type="text"
                      value={defaultDirectory()}
                      onInput={(e) => setDefaultDirectory(e.currentTarget.value)}
                      placeholder="~ or /home/user/projects"
                      class="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      style={{
                        "background-color": "var(--surface-raised)",
                        border: "1px solid var(--border-base)",
                        color: "var(--text-base)",
                      }}
                    />
                  </div>
                </div>

                {/* Save Connection Checkbox */}
                <Show when={!props.editProfile}>
                  <label
                    class="flex items-center gap-3 cursor-pointer"
                    onClick={() => setSaveConnection(!saveConnection())}
                  >
                    <div
                      class="w-5 h-5 rounded flex items-center justify-center transition-colors"
                      style={{
                        "background-color": saveConnection()
                          ? "var(--accent)"
                          : "var(--surface-raised)",
                        border: `1px solid ${saveConnection() ? "var(--accent)" : "var(--border-base)"}`,
                      }}
                    >
                      <Show when={saveConnection()}>
                        <Icon name="check" class="w-3.5 h-3.5 text-white" />
                      </Show>
                    </div>
                    <span class="text-sm" style={{ color: "var(--text-base)" }}>
                      Save this connection for future use
                    </span>
                  </label>
                </Show>

                {/* Test Result */}
                <Show when={testResult()}>
                  <div
                    class="flex items-start gap-3 px-4 py-3 rounded-lg animate-in fade-in"
                    style={{
                      "background-color": testResult()!.success
                        ? tokens.colors.semantic.success + "15"
                        : tokens.colors.semantic.error + "15",
                      border: `1px solid ${testResult()!.success ? tokens.colors.semantic.success : tokens.colors.semantic.error}30`,
                    }}
                  >
                    {testResult()!.success ? (
                      <Icon
                        name="check"
                        class="w-5 h-5 flex-shrink-0 mt-0.5"
                        style={{ color: tokens.colors.semantic.success }}
                      />
                    ) : (
                      <Icon
                        name="circle-exclamation"
                        class="w-5 h-5 flex-shrink-0 mt-0.5"
                        style={{ color: tokens.colors.semantic.error }}
                      />
                    )}
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-sm font-medium"
                        style={{
                          color: testResult()!.success
                            ? tokens.colors.semantic.success
                            : tokens.colors.semantic.error,
                        }}
                      >
                        {testResult()!.success ? "Connection Successful" : "Connection Failed"}
                      </p>
                      <p
                        class="text-xs mt-1 break-words"
                        style={{ color: "var(--text-weak)" }}
                      >
                        {testResult()!.message}
                        {testResult()!.elapsed && ` (${testResult()!.elapsed}ms)`}
                      </p>
                    </div>
                  </div>
                </Show>

                {/* Error Display */}
                <Show when={error()}>
                  <div
                    class="flex items-start gap-3 px-4 py-3 rounded-lg"
                    style={{
                      "background-color": tokens.colors.semantic.error + "15",
                      border: `1px solid ${tokens.colors.semantic.error}`,
                    }}
                  >
                    <Icon
                      name="circle-exclamation"
                      class="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: tokens.colors.semantic.error }}
                    />
                    <p
                      class="text-sm"
                      style={{ color: tokens.colors.semantic.error }}
                    >
                      {error()}
                    </p>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-between gap-3 px-5 py-4 border-t"
            style={{ "border-color": "var(--border-base)" }}
          >
            <Show when={activeTab() === "form"}>
              <button
                onClick={handleTestConnection}
                disabled={!isValid() || isTesting()}
                class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 hover:bg-[var(--surface-raised)]"
                style={{
                  color: "var(--text-base)",
                  border: "1px solid var(--border-base)",
                }}
              >
                {isTesting() ? (
                  <>
                    <Icon name="rotate" class="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Icon name="bolt" class="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </button>
            </Show>

            <div class="flex items-center gap-2 ml-auto">
              <button
                onClick={props.onClose}
                class="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-base)" }}
              >
                Cancel
              </button>

              <Show when={activeTab() === "form"}>
                <Show when={props.editProfile}>
                  <button
                    onClick={handleSave}
                    disabled={!isValid() || isSaving()}
                    class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{
                      "background-color": "var(--surface-raised)",
                      color: "var(--text-base)",
                      border: "1px solid var(--border-base)",
                    }}
                  >
                    {isSaving() ? (
                      <>
                        <Icon name="rotate" class="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Icon name="check" class="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                </Show>

                <button
                  onClick={handleConnect}
                  disabled={!isValid() || isConnecting()}
                  class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    "background-color": "var(--accent)",
                    color: "white",
                  }}
                >
                  {isConnecting() ? (
                    <>
                      <Icon name="rotate" class="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Icon name="terminal" class="w-4 h-4" />
                      Connect
                    </>
                  )}
                </button>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default SSHConnectionDialog;

import { Show, For, createSignal, createMemo, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import {
  useSettingsSync,
  SyncAccount,
  SyncableItem,
  SyncConflict,
  ConflictResolution,
  SyncActivityEntry,
} from "@/context/SettingsSyncContext";
import {
  Toggle,
  SectionHeader,
  FormGroup,
  Button,
  InfoBox,
  Input,
  PasswordInput,
} from "./FormComponents";

// ============================================================================
// Icon Components
// ============================================================================

function SyncIcon(props: { class?: string }) {
  return (
    <svg
      class={props.class || "w-4 h-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function CloudIcon(props: { class?: string }) {
  return (
    <svg
      class={props.class || "w-4 h-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
      />
    </svg>
  );
}

function CheckCircleIcon(props: { class?: string }) {
  return (
    <svg
      class={props.class || "w-4 h-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ExclamationIcon(props: { class?: string }) {
  return (
    <svg
      class={props.class || "w-4 h-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function GitHubIcon(props: { class?: string }) {
  return (
    <svg
      class={props.class || "w-5 h-5"}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function DownloadIcon(props: { class?: string }) {
  return (
    <svg
      class={props.class || "w-4 h-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function UploadIcon(props: { class?: string }) {
  return (
    <svg
      class={props.class || "w-4 h-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

function TrashIcon(props: { class?: string }) {
  return (
    <svg
      class={props.class || "w-4 h-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

// ============================================================================
// Sync Status Badge Component
// ============================================================================

function SyncStatusBadge() {
  const { state } = useSettingsSync();
  
  const statusConfig = createMemo(() => {
    switch (state.status) {
      case "syncing":
        return {
          label: "Syncing...",
          class: "bg-blue-500/20 text-blue-400 border-blue-500/30",
          icon: <SyncIcon class="w-3 h-3 animate-spin" />,
        };
      case "synced":
        return {
          label: "Synced",
          class: "bg-green-500/20 text-green-400 border-green-500/30",
          icon: <CheckCircleIcon class="w-3 h-3" />,
        };
      case "error":
        return {
          label: "Error",
          class: "bg-red-500/20 text-red-400 border-red-500/30",
          icon: <ExclamationIcon class="w-3 h-3" />,
        };
      case "conflict":
        return {
          label: "Conflicts",
          class: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
          icon: <ExclamationIcon class="w-3 h-3" />,
        };
      default:
        return {
          label: "Idle",
          class: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
          icon: <CloudIcon class="w-3 h-3" />,
        };
    }
  });

  return (
    <span
      class={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border ${statusConfig().class}`}
    >
      {statusConfig().icon}
      {statusConfig().label}
    </span>
  );
}

// ============================================================================
// Account Setup Component
// ============================================================================

function AccountSetup() {
  const { enableSync } = useSettingsSync();
  const [provider, setProvider] = createSignal<"github" | "custom">("github");
  const [token, setToken] = createSignal("");
  const [username] = createSignal("");
  const [gistId, setGistId] = createSignal("");
  const [customEndpoint, setCustomEndpoint] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const account: SyncAccount = {
        id: `${provider()}-${Date.now()}`,
        provider: provider(),
        username: username() || "user",
        accessToken: token(),
        gistId: gistId() || undefined,
        customEndpoint: provider() === "custom" ? customEndpoint() : undefined,
      };
      
      await enableSync(account);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const isValid = createMemo(() => {
    if (!token()) return false;
    if (provider() === "custom" && !customEndpoint()) return false;
    return true;
  });

  return (
    <div class="space-y-4">
      <InfoBox variant="info">
        <p>
          Settings Sync allows you to sync your settings, keybindings, snippets, and more across
          multiple devices. Choose a sync provider to get started.
        </p>
      </InfoBox>

      <FormGroup>
        <div class="settings-row">
          <span class="settings-row-label">Sync Provider</span>
          <select
            value={provider()}
            onChange={(e) => setProvider(e.currentTarget.value as "github" | "custom")}
            class="settings-inline-select"
          >
            <option value="github">GitHub Gist</option>
            <option value="custom">Custom Server</option>
          </select>
        </div>
      </FormGroup>

      <Show when={provider() === "github"}>
        <FormGroup>
          <div class="space-y-3">
            <PasswordInput
              label="GitHub Personal Access Token"
              description="Generate a token at GitHub → Settings → Developer settings → Personal access tokens. Requires 'gist' scope."
              value={token()}
              onInput={(e) => setToken(e.currentTarget.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            />
            <Input
              label="Existing Gist ID (Optional)"
              description="Leave empty to create a new gist, or enter an existing gist ID to use."
              value={gistId()}
              onInput={(e) => setGistId(e.currentTarget.value)}
              placeholder="abc123def456..."
            />
          </div>
        </FormGroup>
      </Show>

      <Show when={provider() === "custom"}>
        <FormGroup>
          <div class="space-y-3">
            <Input
              label="Server Endpoint"
              description="The URL of your sync server (e.g., https://sync.example.com)"
              value={customEndpoint()}
              onInput={(e) => setCustomEndpoint(e.currentTarget.value)}
              placeholder="https://sync.example.com"
            />
            <PasswordInput
              label="Access Token"
              description="Your authentication token for the sync server."
              value={token()}
              onInput={(e) => setToken(e.currentTarget.value)}
              placeholder="your-access-token"
            />
          </div>
        </FormGroup>
      </Show>

      <Show when={error()}>
        <InfoBox variant="error">
          <p>{error()}</p>
        </InfoBox>
      </Show>

      <div class="flex justify-end">
        <Button
          variant="primary"
          disabled={!isValid() || loading()}
          loading={loading()}
          onClick={handleConnect}
          icon={provider() === "github" ? <GitHubIcon class="w-4 h-4" /> : <CloudIcon />}
        >
          {provider() === "github" ? "Connect with GitHub" : "Connect to Server"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Account Info Component
// ============================================================================

function AccountInfo() {
  const { state, signOut, syncNow, getLastSyncTimeFormatted } = useSettingsSync();
  const [signingOut, setSigningOut] = createSignal(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div class="p-4 rounded-lg bg-surface-2 border border-border">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
            <Show
              when={state.account?.provider === "github"}
              fallback={<CloudIcon class="w-5 h-5 text-accent" />}
            >
              <GitHubIcon class="w-5 h-5 text-accent" />
            </Show>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-medium text-foreground">{state.account?.username || "Connected"}</span>
              <SyncStatusBadge />
            </div>
            <span class="text-xs text-foreground-muted">
              {state.account?.provider === "github" ? "GitHub Gist" : "Custom Server"}
              {state.account?.email && ` • ${state.account.email}`}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          loading={signingOut()}
        >
          Sign Out
        </Button>
      </div>
      
      <div class="mt-4 pt-4 border-t border-border flex items-center justify-between">
        <span class="text-sm text-foreground-muted">
          Last synced: {getLastSyncTimeFormatted()}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => syncNow()}
          disabled={state.status === "syncing"}
          icon={<SyncIcon class={state.status === "syncing" ? "animate-spin" : ""} />}
        >
          Sync Now
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Sync Items Configuration Component
// ============================================================================

function SyncItemsConfig() {
  const { state, toggleSyncItem } = useSettingsSync();

  const syncItems: { key: SyncableItem; label: string; description: string }[] = [
    {
      key: "settings",
      label: "Settings",
      description: "Editor, theme, terminal, and other application settings",
    },
    {
      key: "keybindings",
      label: "Keyboard Shortcuts",
      description: "Custom keybindings and keyboard shortcuts",
    },
    {
      key: "snippets",
      label: "Snippets",
      description: "Code snippets for all languages",
    },
    {
      key: "uiState",
      label: "UI State",
      description: "Window layout, sidebar state, and panel positions",
    },
    {
      key: "extensions",
      label: "Extensions",
      description: "List of installed and enabled extensions",
    },
  ];

  return (
    <FormGroup title="What to Sync">
      <div class="space-y-1">
        <For each={syncItems}>
          {(item) => (
            <div class="settings-row py-2">
              <div class="flex-1">
                <span class="settings-row-label block">{item.label}</span>
                <span class="text-xs text-foreground-muted">{item.description}</span>
              </div>
              <Toggle
                checked={state.syncItems[item.key].enabled}
                onChange={(checked) => toggleSyncItem(item.key, checked)}
              />
            </div>
          )}
        </For>
      </div>
    </FormGroup>
  );
}

// ============================================================================
// Sync Settings Component
// ============================================================================

function SyncSettings() {
  const { state, setAutoSync, setSyncOnStartup, setSyncInterval } = useSettingsSync();

  const intervalOptions = [
    { value: "5", label: "Every 5 minutes" },
    { value: "15", label: "Every 15 minutes" },
    { value: "30", label: "Every 30 minutes" },
    { value: "60", label: "Every hour" },
    { value: "120", label: "Every 2 hours" },
    { value: "360", label: "Every 6 hours" },
    { value: "1440", label: "Once a day" },
  ];

  return (
    <FormGroup title="Sync Options">
      <div class="settings-row">
        <span class="settings-row-label">Auto Sync</span>
        <Toggle
          checked={state.autoSync}
          onChange={setAutoSync}
        />
      </div>
      <Show when={state.autoSync}>
        <div class="settings-row">
          <span class="settings-row-label">Sync Interval</span>
          <select
            value={state.syncInterval.toString()}
            onChange={(e) => setSyncInterval(parseInt(e.currentTarget.value))}
            class="settings-inline-select"
          >
            <For each={intervalOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </div>
      </Show>
      <div class="settings-row">
        <span class="settings-row-label">Sync on Startup</span>
        <Toggle
          checked={state.syncOnStartup}
          onChange={setSyncOnStartup}
        />
      </div>
    </FormGroup>
  );
}

// ============================================================================
// Conflict Resolution Component
// ============================================================================

function ConflictItem(props: { conflict: SyncConflict }) {
  const { resolveConflict } = useSettingsSync();
  const [resolving, setResolving] = createSignal(false);

  const handleResolve = async (choice: ConflictResolution) => {
    setResolving(true);
    try {
      await resolveConflict(props.conflict.id, choice);
    } finally {
      setResolving(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const itemLabels: Record<SyncableItem, string> = {
    settings: "Settings",
    keybindings: "Keybindings",
    snippets: "Snippets",
    uiState: "UI State",
    extensions: "Extensions",
  };

  return (
    <div class="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
      <div class="flex items-start justify-between mb-2">
        <div>
          <span class="font-medium text-yellow-400">{itemLabels[props.conflict.itemType]}</span>
          <div class="text-xs text-foreground-muted mt-0.5">
            Local: {formatDate(props.conflict.localTimestamp)} • Remote: {formatDate(props.conflict.remoteTimestamp)}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 mt-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleResolve("local")}
          disabled={resolving()}
        >
          Keep Local
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleResolve("remote")}
          disabled={resolving()}
        >
          Use Remote
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleResolve("merge")}
          disabled={resolving()}
        >
          Merge
        </Button>
      </div>
    </div>
  );
}

function ConflictResolutionPanel() {
  const { state, resolveAllConflicts } = useSettingsSync();
  const [resolvingAll, setResolvingAll] = createSignal(false);

  const handleResolveAll = async (choice: ConflictResolution) => {
    setResolvingAll(true);
    try {
      await resolveAllConflicts(choice);
    } finally {
      setResolvingAll(false);
    }
  };

  return (
    <Show when={state.conflicts.length > 0}>
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <SectionHeader
            title="Conflicts"
            description={`${state.conflicts.length} conflict(s) need resolution`}
            icon={<ExclamationIcon class="w-4 h-4 text-yellow-400" />}
          />
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleResolveAll("local")}
              disabled={resolvingAll()}
            >
              Keep All Local
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleResolveAll("remote")}
              disabled={resolvingAll()}
            >
              Use All Remote
            </Button>
          </div>
        </div>
        <div class="space-y-2">
          <For each={state.conflicts}>
            {(conflict) => <ConflictItem conflict={conflict} />}
          </For>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Activity Log Component
// ============================================================================

function ActivityLog() {
  const { state, clearActivityLog } = useSettingsSync();
  const [expanded, setExpanded] = createSignal(false);

  const visibleEntries = createMemo(() => {
    return expanded() ? state.activityLog : state.activityLog.slice(0, 5);
  });

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionIcon = (entry: SyncActivityEntry) => {
    switch (entry.action) {
      case "upload":
        return <UploadIcon class="w-3 h-3 text-blue-400" />;
      case "download":
        return <DownloadIcon class="w-3 h-3 text-green-400" />;
      case "conflict":
        return <ExclamationIcon class="w-3 h-3 text-yellow-400" />;
      case "error":
        return <ExclamationIcon class="w-3 h-3 text-red-400" />;
      case "merge":
        return <SyncIcon class="w-3 h-3 text-purple-400" />;
    }
  };

  return (
    <Show when={state.activityLog.length > 0}>
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <SectionHeader title="Activity" />
          <Button variant="ghost" size="sm" onClick={clearActivityLog}>
            Clear
          </Button>
        </div>
        <div class="space-y-1">
          <For each={visibleEntries()}>
            {(entry) => (
              <div class="flex items-center gap-2 py-1.5 px-2 rounded text-sm hover:bg-surface-2">
                {getActionIcon(entry)}
                <span class="flex-1 text-foreground-muted truncate">{entry.message}</span>
                <span class="text-xs text-foreground-muted">{formatTime(entry.timestamp)}</span>
              </div>
            )}
          </For>
        </div>
        <Show when={state.activityLog.length > 5}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded())}
            class="w-full"
          >
            {expanded() ? "Show Less" : `Show ${state.activityLog.length - 5} More`}
          </Button>
        </Show>
      </div>
    </Show>
  );
}

// ============================================================================
// Import/Export Component
// ============================================================================

function ImportExportSection() {
  const { exportSettings, importSettings } = useSettingsSync();
  const [importing, setImporting] = createSignal(false);
  const [exporting, setExporting] = createSignal(false);
  const [importError, setImportError] = createSignal<string | null>(null);

  let fileInputRef: HTMLInputElement | undefined;

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportSettings();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cortex-settings-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef?.click();
  };

  const handleFileSelect = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);

    try {
      const text = await file.text();
      await importSettings(text);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
      input.value = "";
    }
  };

  return (
    <FormGroup title="Backup & Restore">
      <div class="space-y-3">
        <p class="text-sm text-foreground-muted">
          Export your settings to a file for backup, or import settings from a previous backup.
        </p>
        
        <Show when={importError()}>
          <InfoBox variant="error">
            <p>{importError()}</p>
          </InfoBox>
        </Show>

        <div class="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExport}
            loading={exporting()}
            icon={<DownloadIcon />}
          >
            Export Settings
          </Button>
          <Button
            variant="secondary"
            onClick={handleImportClick}
            loading={importing()}
            icon={<UploadIcon />}
          >
            Import Settings
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            class="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>
    </FormGroup>
  );
}

// ============================================================================
// Danger Zone Component
// ============================================================================

function DangerZone() {
  const { resetSyncState } = useSettingsSync();
  const [resetting, setResetting] = createSignal(false);
  const [confirmReset, setConfirmReset] = createSignal(false);

  const handleReset = async () => {
    if (!confirmReset()) {
      setConfirmReset(true);
      return;
    }
    
    setResetting(true);
    try {
      await resetSyncState();
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  return (
    <FormGroup title="Danger Zone">
      <div class="p-3 rounded-lg border border-red-500/30 bg-red-500/10">
        <div class="flex items-start justify-between">
          <div>
            <span class="font-medium text-red-400">Reset Sync</span>
            <p class="text-sm text-foreground-muted mt-1">
              This will sign out, clear all sync data, and remove your sync configuration.
              Your local settings will not be affected.
            </p>
          </div>
        </div>
        <div class="mt-3">
          <Show
            when={confirmReset()}
            fallback={
              <Button
                variant="danger"
                size="sm"
                onClick={handleReset}
                icon={<TrashIcon />}
              >
                Reset Sync Data
              </Button>
            }
          >
            <div class="flex items-center gap-2">
              <span class="text-sm text-red-400">Are you sure?</span>
              <Button
                variant="danger"
                size="sm"
                onClick={handleReset}
                loading={resetting()}
              >
                Yes, Reset
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </Button>
            </div>
          </Show>
        </div>
      </div>
    </FormGroup>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

export function SettingsSyncPanel() {
  const { state } = useSettingsSync();

  onMount(async () => {
    try {
      const status = await invoke<{ status: string; lastSyncTime: number | null }>("sync_status");
      if (status && import.meta.env.DEV) {
        console.debug("[SettingsSyncPanel] Backend sync status:", status.status);
      }
    } catch {
      // Backend not available, frontend-only mode
    }
  });

  return (
    <div class="space-y-6 max-h-[500px] overflow-y-auto pr-2">
      {/* Header with Status */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <CloudIcon class="w-5 h-5 text-accent" />
          <h2 class="text-lg font-semibold">Settings Sync</h2>
        </div>
        <Show when={state.enabled}>
          <SyncStatusBadge />
        </Show>
      </div>

      {/* Error Display */}
      <Show when={state.error}>
        <InfoBox variant="error">
          <p>{state.error}</p>
        </InfoBox>
      </Show>

      {/* Main Content */}
      <Show
        when={state.enabled && state.account}
        fallback={<AccountSetup />}
      >
        {/* Account Info */}
        <AccountInfo />

        {/* Conflict Resolution */}
        <ConflictResolutionPanel />

        {/* Sync Items Configuration */}
        <SyncItemsConfig />

        {/* Sync Settings */}
        <SyncSettings />

        {/* Activity Log */}
        <ActivityLog />

        {/* Import/Export */}
        <ImportExportSection />

        {/* Danger Zone */}
        <DangerZone />
      </Show>
    </div>
  );
}

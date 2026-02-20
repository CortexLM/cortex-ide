import { Show, createMemo, For } from "solid-js";
import { useAutoUpdate, DownloadingData, UpdateAvailableData, RestartRequiredData, ErrorData } from "@/context/AutoUpdateContext";
import { Button, IconButton } from "./ui";
import { Icon } from "./ui/Icon";

/**
 * AutoUpdateDialog - Modal dialog for displaying update information and actions
 */
export function AutoUpdateDialog() {
  const update = useAutoUpdate();
  
  const statusType = createMemo(() => update.status.type);
  
  const updateData = createMemo(() => {
    if (update.status.type === "UpdateAvailable") {
      return update.status.data as UpdateAvailableData;
    }
    return null;
  });
  
  const downloadData = createMemo(() => {
    if (update.status.type === "Downloading") {
      return update.status.data as DownloadingData;
    }
    return null;
  });
  
  const restartData = createMemo(() => {
    if (update.status.type === "RestartRequired") {
      return update.status.data as RestartRequiredData;
    }
    return null;
  });
  
  const errorData = createMemo(() => {
    if (update.status.type === "Error") {
      return update.status.data as ErrorData;
    }
    return null;
  });

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatReleaseNotes = (notes: string | null): string[] => {
    if (!notes) return [];
    return notes.split("\n").filter(line => line.trim().length > 0);
  };

  const handleClose = () => {
    update.setShowDialog(false);
  };

  const handleSkip = () => {
    const data = updateData();
    if (data) {
      update.skipVersion(data.version);
    }
  };

  return (
    <Show when={update.showDialog}>
      <div 
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0, 0, 0, 0.6)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget && statusType() !== "Downloading") {
            handleClose();
          }
        }}
      >
        <div 
          class="w-full max-w-lg rounded-lg shadow-2xl"
          style={{
            background: "var(--ui-panel-bg)",
            border: "1px solid var(--ui-panel-bg-lighter)",
          }}
        >
          {/* Header */}
          <div 
            class="flex items-center justify-between px-5 py-4"
            style={{ "border-bottom": "1px solid var(--ui-panel-bg-lighter)" }}
          >
            <div class="flex items-center gap-3">
              <div 
                class="flex items-center justify-center w-10 h-10 rounded-full"
                style={{ background: "var(--cortex-info)" }}
              >
                <Icon name="download" size={20} class="text-blue-400" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-white">
                  {statusType() === "RestartRequired" ? "Update Ready" : "Update Available"}
                </h2>
                <p class="text-sm text-gray-400">
                  {updateData()?.version || restartData()?.version || "New version"}
                </p>
              </div>
            </div>
            <Show when={statusType() !== "Downloading" && statusType() !== "Installing"}>
              <IconButton
                icon={<Icon name="xmark" size={20} />}
                title="Close"
                variant="ghost"
                size="md"
                onClick={handleClose}
              />
            </Show>
          </div>

          {/* Content */}
          <div class="px-5 py-4">
            {/* Error State */}
            <Show when={statusType() === "Error"}>
              <div 
                class="flex items-start gap-3 p-4 rounded-lg mb-4"
                style={{ background: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.3)" }}
              >
                <Icon name="circle-exclamation" size={20} class="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-sm font-medium text-red-400">Update Error</p>
                  <p class="text-sm text-red-300 mt-1">{errorData()?.message}</p>
                </div>
              </div>
            </Show>

            {/* Update Available State */}
            <Show when={statusType() === "UpdateAvailable" && updateData()}>
              <div class="space-y-4">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-400">Current version:</span>
                  <span class="text-white font-mono">{update.currentVersion}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-400">New version:</span>
                  <span class="text-green-400 font-mono">{updateData()?.version}</span>
                </div>
                <Show when={updateData()?.release_date}>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-400">Release date:</span>
                    <span class="text-white">{updateData()?.release_date}</span>
                  </div>
                </Show>

                {/* Release Notes */}
                <Show when={updateData()?.release_notes}>
                  <div class="mt-4">
                    <p class="text-sm font-medium text-gray-300 mb-2">What's New:</p>
                    <div 
                      class="max-h-48 overflow-y-auto rounded-lg p-3 text-sm"
                      style={{ background: "var(--ui-panel-bg)" }}
                    >
                      <For each={formatReleaseNotes(updateData()?.release_notes || null)}>
                        {(line) => (
                          <p class="text-gray-300 mb-1">{line}</p>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            {/* Checking State */}
<Show when={statusType() === "Checking"}>
              <div class="flex items-center justify-center gap-3 py-8">
                <Icon name="rotate" size={24} class="text-blue-400 animate-spin" />
                <span class="text-gray-300">Checking for updates...</span>
              </div>
            </Show>

            {/* Downloading State */}
            <Show when={statusType() === "Downloading" && downloadData()}>
              <div class="space-y-4">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-400">Downloading version:</span>
                  <span class="text-white font-mono">{downloadData()?.version}</span>
                </div>
                
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-400">Progress:</span>
                    <span class="text-white">{downloadData()?.progress.toFixed(1)}%</span>
                  </div>
                  <div 
                    class="h-2 rounded-full overflow-hidden"
                    style={{ background: "var(--ui-panel-bg-lighter)" }}
                  >
                    <div 
                      class="h-full rounded-full transition-all duration-300"
                      style={{ 
                        background: "linear-gradient(90deg, var(--cortex-info), var(--cortex-info))",
                        width: `${downloadData()?.progress || 0}%` 
                      }}
                    />
                  </div>
                  <div class="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatBytes(downloadData()?.downloaded_bytes || 0)}</span>
                    <span>{formatBytes(downloadData()?.total_bytes || 0)}</span>
                  </div>
                </div>
              </div>
            </Show>

            {/* Installing State */}
<Show when={statusType() === "Installing"}>
              <div class="flex items-center justify-center gap-3 py-8">
                <Icon name="rotate" size={24} class="text-blue-400 animate-spin" />
                <span class="text-gray-300">Installing update...</span>
              </div>
            </Show>

            {/* Restart Required State */}
            <Show when={statusType() === "RestartRequired" && restartData()}>
              <div class="space-y-4">
                <div 
                  class="flex items-start gap-3 p-4 rounded-lg"
                  style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)" }}
                >
                  <Icon name="check" size={20} class="text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p class="text-sm font-medium text-green-400">Update Downloaded</p>
                    <p class="text-sm text-green-300 mt-1">
                      Version {restartData()?.version} has been downloaded. Restart the app to apply the update.
                    </p>
                  </div>
                </div>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div 
            class="flex items-center justify-between px-5 py-4 gap-3"
            style={{ "border-top": "1px solid var(--ui-panel-bg-lighter)" }}
          >
            {/* Update Available Actions */}
            <Show when={statusType() === "UpdateAvailable"}>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="forward-step" size={16} />}
                onClick={handleSkip}
              >
                Skip this version
              </Button>
              <div class="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleClose}>
                  Later
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Icon name="download" size={16} />}
                  onClick={() => update.downloadAndInstall()}
                >
                  Download & Install
                </Button>
              </div>
            </Show>

            {/* Downloading Actions */}
            <Show when={statusType() === "Downloading"}>
              <div class="w-full text-center text-sm text-gray-400">
                Please wait while the update downloads...
              </div>
            </Show>

            {/* Installing Actions */}
            <Show when={statusType() === "Installing"}>
              <div class="w-full text-center text-sm text-gray-400">
                Installing update, please wait...
              </div>
            </Show>

            {/* Restart Required Actions */}
            <Show when={statusType() === "RestartRequired"}>
              <Button variant="secondary" size="sm" onClick={handleClose}>
                Later
              </Button>
              <Button
                variant="primary"
                size="sm"
icon={<Icon name="rotate" size={16} />}
                onClick={() => update.restartApp()}
              >
                Restart Now
              </Button>
            </Show>

            {/* Error Actions */}
            <Show when={statusType() === "Error"}>
              <Button
                variant="ghost"
                size="sm"
icon={<Icon name="rotate" size={16} />}
                onClick={() => update.checkForUpdates()}
              >
                Try Again
              </Button>
              <Button variant="secondary" size="sm" onClick={handleClose}>
                Close
              </Button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}

/**
 * AutoUpdateStatusBadge - Small badge shown in status bar when update is available
 */
export function AutoUpdateStatusBadge() {
  const update = useAutoUpdate();
  
  const showBadge = createMemo(() => {
    return update.status.type === "UpdateAvailable" || 
           update.status.type === "RestartRequired" ||
           update.status.type === "Downloading";
  });
  
  const badgeText = createMemo(() => {
    switch (update.status.type) {
      case "UpdateAvailable":
        return "Update";
      case "Downloading":
        return `${update.getDownloadProgress().toFixed(0)}%`;
      case "RestartRequired":
        return "Restart";
      default:
        return "";
    }
  });
  
  const badgeColor = createMemo(() => {
    switch (update.status.type) {
      case "UpdateAvailable":
        return "var(--cortex-info)";
      case "Downloading":
        return "var(--cortex-warning)";
      case "RestartRequired":
        return "var(--cortex-success)";
      default:
        return "#666";
    }
  });

  return (
    <Show when={showBadge()}>
      <button
        onClick={() => update.setShowDialog(true)}
        class="flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full transition-colors hover:opacity-80"
        style={{ 
          background: badgeColor(),
          color: "white",
        }}
        title="Update available - Click to view"
      >
        <Show when={update.status.type === "Downloading"}>
          <Icon name="rotate" size={12} class="animate-spin" />
        </Show>
        <Show when={update.status.type === "UpdateAvailable"}>
          <Icon name="download" size={12} />
        </Show>
<Show when={update.status.type === "RestartRequired"}>
          <Icon name="check" size={12} />
        </Show>
        <span>{badgeText()}</span>
      </button>
    </Show>
  );
}

/**
 * AutoUpdateMenuItem - Menu item for manual update check
 */
export function AutoUpdateMenuItem(props: { onClose?: () => void }) {
  const update = useAutoUpdate();
  
  const handleClick = () => {
    props.onClose?.();
    if (update.status.type === "UpdateAvailable" || update.status.type === "RestartRequired") {
      update.setShowDialog(true);
    } else {
      update.checkForUpdates();
      update.setShowDialog(true);
    }
  };
  
  const label = createMemo(() => {
    switch (update.status.type) {
      case "UpdateAvailable":
        return "Update Available...";
      case "Downloading":
        return "Downloading Update...";
      case "RestartRequired":
        return "Restart to Update";
      case "Checking":
        return "Checking...";
      default:
        return "Check for Updates...";
    }
  });

  return (
    <button
      onClick={handleClick}
      disabled={update.status.type === "Downloading" || update.status.type === "Checking"}
      class="w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors"
      style={{
        color: update.status.type === "UpdateAvailable" ? "var(--cortex-info)" : 
               update.status.type === "RestartRequired" ? "var(--cortex-success)" : "var(--cortex-text-primary)",
        background: "transparent",
        cursor: update.status.type === "Downloading" || update.status.type === "Checking" ? "default" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (update.status.type !== "Downloading" && update.status.type !== "Checking") {
          e.currentTarget.style.background = "var(--ui-panel-bg-lighter)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span class="flex items-center gap-2">
<Show when={update.status.type === "Checking" || update.status.type === "Downloading"}>
          <Icon name="rotate" size={14} class="animate-spin" />
        </Show>
<Show when={update.status.type === "UpdateAvailable"}>
          <Icon name="download" size={14} />
        </Show>
<Show when={update.status.type === "RestartRequired"}>
          <Icon name="check" size={14} />
        </Show>
<Show when={update.status.type === "Idle" || update.status.type === "UpToDate" || update.status.type === "Error"}>
          <Icon name="rotate" size={14} />
        </Show>
        {label()}
      </span>
    </button>
  );
}

export default AutoUpdateDialog;


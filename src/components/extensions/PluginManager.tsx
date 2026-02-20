/**
 * PluginManager - Extension lifecycle management UI
 *
 * Provides controls for enabling, disabling, uninstalling, and updating
 * extensions.  Displays activation time metrics and plugin size.
 */

import { Component, createSignal, onMount, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@/components/ui/Icon";
import { Button, Badge, Text, LoadingSpinner, EmptyState } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { extensionLogger } from "@/utils/logger";

interface ManagedExtension {
  id: string;
  name: string;
  displayName: string;
  version: string;
  enabled: boolean;
  activationTime?: number;
  size?: number;
  hasUpdate?: boolean;
  updateVersion?: string;
  autoUpdate?: boolean;
}

interface PluginManagerProps {
  class?: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatTime(ms: number): string {
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export const PluginManager: Component<PluginManagerProps> = (props) => {
  const [extensions, setExtensions] = createSignal<ManagedExtension[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [busyIds, setBusyIds] = createSignal<Set<string>>(new Set());
  const [autoUpdate, setAutoUpdate] = createSignal(false);
  const [updatingAll, setUpdatingAll] = createSignal(false);

  const markBusy = (id: string) =>
    setBusyIds((prev) => new Set([...prev, id]));
  const clearBusy = (id: string) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const loadExtensions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<ManagedExtension[]>("get_extensions");
      setExtensions(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      extensionLogger.error("Failed to load extensions:", msg);
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadExtensions();
    try {
      const enabled = await invoke<boolean>("registry_check_updates_enabled");
      setAutoUpdate(enabled);
    } catch { /* setting not available */ }
  });

  const handleEnable = async (id: string) => {
    markBusy(id);
    try {
      await invoke("enable_extension", { extensionId: id });
      setExtensions((prev) =>
        prev.map((ext) => (ext.id === id ? { ...ext, enabled: true } : ext)),
      );
    } catch (err) {
      extensionLogger.error(`Failed to enable ${id}:`, err);
    } finally {
      clearBusy(id);
    }
  };

  const handleDisable = async (id: string) => {
    markBusy(id);
    try {
      await invoke("disable_extension", { extensionId: id });
      setExtensions((prev) =>
        prev.map((ext) => (ext.id === id ? { ...ext, enabled: false } : ext)),
      );
    } catch (err) {
      extensionLogger.error(`Failed to disable ${id}:`, err);
    } finally {
      clearBusy(id);
    }
  };

  const handleUninstall = async (id: string) => {
    markBusy(id);
    try {
      await invoke("uninstall_extension", { extensionId: id });
      setExtensions((prev) => prev.filter((ext) => ext.id !== id));
    } catch (err) {
      extensionLogger.error(`Failed to uninstall ${id}:`, err);
    } finally {
      clearBusy(id);
    }
  };

  const handleUpdate = async (id: string) => {
    markBusy(id);
    try {
      await invoke("update_extension", { extensionId: id });
      setExtensions((prev) =>
        prev.map((ext) =>
          ext.id === id
            ? { ...ext, hasUpdate: false, version: ext.updateVersion ?? ext.version, updateVersion: undefined }
            : ext,
        ),
      );
    } catch (err) {
      extensionLogger.error(`Failed to update ${id}:`, err);
    } finally {
      clearBusy(id);
    }
  };

  const handleUpdateAll = async () => {
    setUpdatingAll(true);
    try {
      await invoke("update_all_extensions");
      await loadExtensions();
    } catch (err) {
      extensionLogger.error("Failed to update all:", err);
    } finally {
      setUpdatingAll(false);
    }
  };

  const handleToggleAutoUpdate = async () => {
    const newVal = !autoUpdate();
    setAutoUpdate(newVal);
    try {
      await invoke("set_auto_update_extensions", { enabled: newVal });
    } catch (err) {
      extensionLogger.error("Failed to toggle auto-update:", err);
      setAutoUpdate(!newVal);
    }
  };

  const metricsInfo = () => {
    const exts = extensions();
    const withTime = exts.filter((e) => e.activationTime != null);
    if (withTime.length === 0) return null;
    const avg = withTime.reduce((s, e) => s + e.activationTime!, 0) / withTime.length;
    const updatable = exts.filter((e) => e.hasUpdate).length;
    return { total: exts.length, activated: withTime.length, avgTime: avg, updatable };
  };

  return (
    <div
      class={`flex flex-col h-full overflow-hidden ${props.class || ""}`}
      style={{ "background-color": tokens.colors.surface.base }}
    >
      <div
        class="flex items-center justify-between px-4 py-3 border-b"
        style={{ "border-color": tokens.colors.border.default }}
      >
        <div class="flex items-center gap-2">
          <Text weight="bold" size="sm">Plugin Manager</Text>
          <Show when={metricsInfo()}>
            {(info) => (
              <Text variant="muted" size="xs">
                {info().total} plugins · avg {formatTime(info().avgTime)}
              </Text>
            )}
          </Show>
        </div>
        <div class="flex items-center gap-1.5">
          <Show when={metricsInfo()?.updatable}>
            <Button variant="primary" size="sm" onClick={handleUpdateAll} disabled={updatingAll()} loading={updatingAll()}>
              Update All
            </Button>
          </Show>
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
            style={{
              color: autoUpdate() ? tokens.colors.semantic.primary : tokens.colors.text.muted,
              "background-color": autoUpdate() ? tokens.colors.interactive.active : "transparent",
            }}
            onClick={handleToggleAutoUpdate}
            title="Auto-update extensions"
          >
            <Icon name="arrows-rotate" class="w-3 h-3" />
          </button>
          <Button variant="secondary" size="sm" onClick={loadExtensions}>
            <Icon name="refresh" class="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <Show when={loading()}>
        <div class="flex items-center justify-center flex-1">
          <LoadingSpinner size="lg" />
        </div>
      </Show>

      <Show when={!loading() && error()}>
        <div class="flex flex-col items-center justify-center flex-1 gap-3 px-6">
          <Icon name="circle-exclamation" class="w-8 h-8 text-error" />
          <Text variant="muted" size="sm">{error()}</Text>
          <Button variant="secondary" size="sm" onClick={loadExtensions}>Retry</Button>
        </div>
      </Show>

      <Show when={!loading() && !error() && extensions().length === 0}>
        <EmptyState icon="puzzle-piece" title="No extensions installed" description="Install extensions from the marketplace to get started." />
      </Show>

      <Show when={!loading() && !error() && extensions().length > 0}>
        <div class="flex-1 overflow-y-auto">
          <For each={extensions()}>
            {(ext) => {
              const busy = () => busyIds().has(ext.id);
              return (
                <div
                  class="flex items-start gap-3 px-4 py-3 border-b"
                  style={{ "border-color": tokens.colors.border.divider, opacity: ext.enabled ? 1 : 0.6 }}
                >
                  <div
                    class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
                    style={{ "background-color": tokens.colors.interactive.active, color: tokens.colors.semantic.primary }}
                  >
                    <Icon name="puzzle-piece" class="w-4 h-4" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <Text weight="bold" size="sm">{ext.displayName || ext.name}</Text>
                      <Badge size="sm">v{ext.version}</Badge>
                      <Show when={!ext.enabled}><Badge variant="default" size="sm">Disabled</Badge></Show>
                      <Show when={ext.hasUpdate}><Badge variant="warning" size="sm">Update {ext.updateVersion}</Badge></Show>
                    </div>
                    <div class="flex items-center gap-3 mt-1 text-xs" style={{ color: tokens.colors.text.muted }}>
                      <Show when={ext.activationTime != null}>
                        <span class="flex items-center gap-1"><Icon name="clock" class="w-3 h-3" />{formatTime(ext.activationTime!)}</span>
                      </Show>
                      <Show when={ext.size != null}>
                        <span class="flex items-center gap-1"><Icon name="hard-drive" class="w-3 h-3" />{formatSize(ext.size!)}</span>
                      </Show>
                    </div>
                    <div class="flex items-center gap-2 mt-2">
                      <Show
                        when={ext.enabled}
                        fallback={<Button variant="primary" size="sm" onClick={() => handleEnable(ext.id)} disabled={busy()} loading={busy()}>Enable</Button>}
                      >
                        <Button variant="secondary" size="sm" onClick={() => handleDisable(ext.id)} disabled={busy()} loading={busy()}>Disable</Button>
                      </Show>
                      <Show when={ext.hasUpdate}>
                        <Button variant="primary" size="sm" onClick={() => handleUpdate(ext.id)} disabled={busy()} loading={busy()}>Update</Button>
                      </Show>
                      <Button variant="danger" size="sm" onClick={() => handleUninstall(ext.id)} disabled={busy()} loading={busy()}>Uninstall</Button>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

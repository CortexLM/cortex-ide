import { createSignal, onMount, Show, For, JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

interface UpdateInfo {
  name: string;
  current_version: string;
  latest_version: string;
  download_url: string;
}

interface ExtensionUpdatePanelProps {
  onUpdateComplete?: () => void;
}

export function ExtensionUpdatePanel(props: ExtensionUpdatePanelProps): JSX.Element {
  const [updates, setUpdates] = createSignal<UpdateInfo[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [updating, setUpdating] = createSignal<Set<string>>(new Set());
  const [autoUpdate, setAutoUpdate] = createSignal(false);

  onMount(async () => {
    await checkForUpdates();
    try {
      const enabled = await invoke<boolean>("registry_check_updates_enabled");
      setAutoUpdate(enabled);
    } catch {
      // Setting not available
    }
  });

  const checkForUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<UpdateInfo[]>("check_extension_updates");
      setUpdates(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const updateExtension = async (name: string) => {
    setUpdating((prev) => {
      const next = new Set(prev);
      next.add(name);
      return next;
    });
    try {
      await invoke("registry_install", { name, version: null });
      setUpdates((prev) => prev.filter((u) => u.name !== name));
      props.onUpdateComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  };

  const updateAll = async () => {
    const currentUpdates = updates();
    for (const update of currentUpdates) {
      await updateExtension(update.name);
    }
  };

  const toggleAutoUpdate = async () => {
    const newValue = !autoUpdate();
    try {
      await invoke("set_auto_update_extensions", { enabled: newValue });
      setAutoUpdate(newValue);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div class="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)]">
        <h2 class="text-sm font-semibold">Extension Updates</h2>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={autoUpdate()}
              onChange={toggleAutoUpdate}
              class="rounded"
            />
            Auto-update
          </label>
          <button
            class="px-3 py-1 text-xs rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-colors"
            onClick={checkForUpdates}
            disabled={loading()}
          >
            Refresh
          </button>
          <Show when={updates().length > 0}>
            <button
              class="px-3 py-1 text-xs rounded bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
              onClick={updateAll}
            >
              Update All
            </button>
          </Show>
        </div>
      </div>

      <Show when={error()}>
        <div class="p-3 m-3 rounded bg-red-500/10 text-red-400 text-xs">
          {error()}
        </div>
      </Show>

      <Show when={loading()}>
        <div class="flex items-center justify-center p-8">
          <span class="text-sm text-[var(--text-secondary)]">Checking for updates...</span>
        </div>
      </Show>

      <Show when={!loading() && updates().length === 0 && !error()}>
        <div class="flex items-center justify-center p-8">
          <span class="text-sm text-[var(--text-tertiary)]">All extensions are up to date.</span>
        </div>
      </Show>

      <Show when={!loading() && updates().length > 0}>
        <div class="flex-1 overflow-y-auto">
          <For each={updates()}>
            {(update) => (
              <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] hover:bg-[var(--bg-secondary)] transition-colors">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{update.name}</p>
                  <p class="text-xs text-[var(--text-tertiary)]">
                    {update.current_version} → {update.latest_version}
                  </p>
                </div>
                <button
                  class="px-3 py-1 text-xs rounded bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  onClick={() => updateExtension(update.name)}
                  disabled={updating().has(update.name)}
                >
                  {updating().has(update.name) ? "Updating..." : "Update"}
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

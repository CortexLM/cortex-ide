import { createSignal, Show, For, onMount } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import {
  gitStashListEnhanced,
  gitStashApply,
  gitStashPop,
  gitStashDrop,
  gitStashCreate,
  type StashEntry,
} from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";

export interface StashManagerProps {
  onStashChanged?: () => void;
}

export function StashManager(props: StashManagerProps) {
  const [stashes, setStashes] = createSignal<StashEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [operating, setOperating] = createSignal<string | null>(null);
  const [showCreate, setShowCreate] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [includeUntracked, setIncludeUntracked] = createSignal(true);
  const [confirmDrop, setConfirmDrop] = createSignal<number | null>(null);

  onMount(() => fetchStashes());

  const fetchStashes = async () => {
    setLoading(true);
    try {
      const data = await gitStashListEnhanced(getProjectPath());
      setStashes(data);
    } catch (err) {
      console.error("Failed to fetch stashes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setOperating("create");
    try {
      await gitStashCreate(getProjectPath(), message() || "WIP", includeUntracked());
      setShowCreate(false);
      setMessage("");
      await fetchStashes();
      props.onStashChanged?.();
    } catch (err) {
      console.error("Failed to create stash:", err);
    } finally {
      setOperating(null);
    }
  };

  const handleApply = async (index: number) => {
    setOperating(`apply-${index}`);
    try {
      await gitStashApply(getProjectPath(), index);
      props.onStashChanged?.();
    } catch (err) {
      console.error("Failed to apply stash:", err);
    } finally {
      setOperating(null);
    }
  };

  const handlePop = async (index: number) => {
    setOperating(`pop-${index}`);
    try {
      await gitStashPop(getProjectPath(), index);
      await fetchStashes();
      props.onStashChanged?.();
    } catch (err) {
      console.error("Failed to pop stash:", err);
    } finally {
      setOperating(null);
    }
  };

  const handleDrop = async (index: number) => {
    setOperating(`drop-${index}`);
    setConfirmDrop(null);
    try {
      await gitStashDrop(getProjectPath(), index);
      await fetchStashes();
      props.onStashChanged?.();
    } catch (err) {
      console.error("Failed to drop stash:", err);
    } finally {
      setOperating(null);
    }
  };

  return (
    <div class="flex flex-col h-full overflow-hidden" style={{ background: tokens.colors.surface.panel }}>
      <div class="flex items-center justify-between px-3 py-2 border-b shrink-0" style={{ "border-color": tokens.colors.border.divider }}>
        <div class="flex items-center gap-2">
          <Icon name="box-archive" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />
          <span class="text-sm font-medium" style={{ color: tokens.colors.text.primary }}>Stashes</span>
          <span class="text-xs px-1.5 rounded" style={{ background: tokens.colors.interactive.hover, color: tokens.colors.text.muted }}>{stashes().length}</span>
        </div>
        <div class="flex items-center gap-1">
          <button class="p-1 rounded hover:bg-white/10" onClick={() => setShowCreate(!showCreate())} title="Create stash">
            <Icon name="plus" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />
          </button>
          <button class="p-1 rounded hover:bg-white/10" onClick={fetchStashes} disabled={loading()} title="Refresh">
            <Icon name="rotate" class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} style={{ color: tokens.colors.text.muted }} />
          </button>
        </div>
      </div>

      <Show when={showCreate()}>
        <div class="p-3 border-b" style={{ "border-color": tokens.colors.border.divider }}>
          <input
            type="text"
            class="w-full px-2 py-1.5 text-sm rounded outline-none mb-2"
            style={{ background: tokens.colors.interactive.hover, color: tokens.colors.text.primary }}
            placeholder="Stash message (optional)"
            value={message()}
            onInput={(e) => setMessage(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: tokens.colors.text.muted }}>
              <input type="checkbox" checked={includeUntracked()} onChange={(e) => setIncludeUntracked(e.currentTarget.checked)} />
              Include untracked
            </label>
            <button
              class="px-3 py-1 text-xs rounded"
              style={{ background: tokens.colors.semantic.primary, color: "white" }}
              onClick={handleCreate}
              disabled={operating() === "create"}
            >
              {operating() === "create" ? "Creating..." : "Stash"}
            </button>
          </div>
        </div>
      </Show>

      <div class="flex-1 overflow-auto">
        <Show when={!loading() && stashes().length === 0}>
          <div class="flex flex-col items-center justify-center h-full gap-2">
            <Icon name="box-archive" class="w-8 h-8" style={{ color: tokens.colors.text.muted }} />
            <span class="text-xs" style={{ color: tokens.colors.text.muted }}>No stashes</span>
          </div>
        </Show>
        <For each={stashes()}>
          {(stash) => (
            <div class="group flex items-center gap-2 px-3 py-2 border-b hover:bg-white/5 transition-colors" style={{ "border-color": tokens.colors.border.divider }}>
              <div class="flex-1 min-w-0">
                <div class="text-sm truncate" style={{ color: tokens.colors.text.primary }}>{stash.message}</div>
                <div class="text-xs flex items-center gap-2" style={{ color: tokens.colors.text.muted }}>
                  <span>stash@{`{${stash.index}}`}</span>
                  <Show when={stash.branch}><span>on {stash.branch}</span></Show>
                </div>
              </div>
              <Show when={confirmDrop() === stash.index}>
                <button class="px-2 py-0.5 text-xs rounded" style={{ background: `color-mix(in srgb, ${tokens.colors.semantic.error} 20%, transparent)`, color: tokens.colors.semantic.error }} onClick={() => handleDrop(stash.index)}>
                  Confirm
                </button>
                <button class="px-2 py-0.5 text-xs rounded hover:bg-white/10" style={{ color: tokens.colors.text.muted }} onClick={() => setConfirmDrop(null)}>
                  Cancel
                </button>
              </Show>
              <Show when={confirmDrop() !== stash.index}>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="p-1 rounded hover:bg-white/10" title="Apply" onClick={() => handleApply(stash.index)} disabled={operating() !== null}>
                    <Icon name="check" class="w-3.5 h-3.5" style={{ color: tokens.colors.semantic.success }} />
                  </button>
                  <button class="p-1 rounded hover:bg-white/10" title="Pop" onClick={() => handlePop(stash.index)} disabled={operating() !== null}>
                    <Icon name="arrow-up" class="w-3.5 h-3.5" style={{ color: tokens.colors.semantic.info }} />
                  </button>
                  <button class="p-1 rounded hover:bg-white/10" title="Drop" onClick={() => setConfirmDrop(stash.index)} disabled={operating() !== null}>
                    <Icon name="trash" class="w-3.5 h-3.5" style={{ color: tokens.colors.semantic.error }} />
                  </button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

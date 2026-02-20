import { createSignal, Show, createEffect } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import { gitPush, gitPull, gitFetch } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";

export interface SyncStatusProps {
  branch?: string;
  ahead?: number;
  behind?: number;
  onRefresh?: () => void;
}

export function SyncStatus(props: SyncStatusProps) {
  const [syncing, setSyncing] = createSignal<"pull" | "push" | "fetch" | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [showForcePush, setShowForcePush] = createSignal(false);
  const [ahead, setAhead] = createSignal(props.ahead ?? 0);
  const [behind, setBehind] = createSignal(props.behind ?? 0);

  createEffect(() => {
    setAhead(props.ahead ?? 0);
    setBehind(props.behind ?? 0);
  });

  const handleFetch = async () => {
    setSyncing("fetch");
    setError(null);
    try {
      const projectPath = getProjectPath();
      await gitFetch(projectPath, "origin");
      props.onRefresh?.();
    } catch (err) {
      setError(`Fetch failed: ${err}`);
    } finally {
      setSyncing(null);
    }
  };

  const handlePull = async () => {
    setSyncing("pull");
    setError(null);
    try {
      const projectPath = getProjectPath();
      await gitPull(projectPath, "origin");
      setBehind(0);
      props.onRefresh?.();
    } catch (err) {
      setError(`Pull failed: ${err}`);
    } finally {
      setSyncing(null);
    }
  };

  const handlePush = async (force = false) => {
    setSyncing("push");
    setError(null);
    setShowForcePush(false);
    try {
      const projectPath = getProjectPath();
      if (force) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("git_push", { path: projectPath, remote: "origin", force: true });
      } else {
        await gitPush(projectPath, "origin");
      }
      setAhead(0);
      props.onRefresh?.();
    } catch (err) {
      const errStr = String(err);
      if (errStr.includes("rejected") || errStr.includes("non-fast-forward")) {
        setShowForcePush(true);
        setError("Push rejected. Remote has changes. Pull first or force push.");
      } else {
        setError(`Push failed: ${err}`);
      }
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div class="flex flex-col gap-2 p-3" style={{ background: tokens.colors.surface.panel }}>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="code-branch" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />
          <span class="text-sm font-medium" style={{ color: tokens.colors.text.primary }}>
            {props.branch || "main"}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <Show when={behind() > 0}>
            <span class="text-xs px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${tokens.colors.semantic.info} 20%, transparent)`, color: tokens.colors.semantic.info }}>
              ↓{behind()}
            </span>
          </Show>
          <Show when={ahead() > 0}>
            <span class="text-xs px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${tokens.colors.semantic.success} 20%, transparent)`, color: tokens.colors.semantic.success }}>
              ↑{ahead()}
            </span>
          </Show>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
          style={{ background: `color-mix(in srgb, ${tokens.colors.semantic.info} 15%, transparent)`, color: tokens.colors.semantic.info }}
          onClick={handleFetch}
          disabled={syncing() !== null}
          title="Fetch from remote"
        >
          <Show when={syncing() === "fetch"} fallback={<Icon name="rotate" class="w-3.5 h-3.5" />}>
            <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />
          </Show>
          Fetch
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
          style={{ background: `color-mix(in srgb, ${tokens.colors.semantic.info} 15%, transparent)`, color: tokens.colors.semantic.info }}
          onClick={handlePull}
          disabled={syncing() !== null}
          title="Pull from remote"
        >
          <Show when={syncing() === "pull"} fallback={<Icon name="arrow-down" class="w-3.5 h-3.5" />}>
            <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />
          </Show>
          Pull
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
          style={{ background: `color-mix(in srgb, ${tokens.colors.semantic.success} 15%, transparent)`, color: tokens.colors.semantic.success }}
          onClick={() => handlePush(false)}
          disabled={syncing() !== null}
          title="Push to remote"
        >
          <Show when={syncing() === "push"} fallback={<Icon name="arrow-up" class="w-3.5 h-3.5" />}>
            <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />
          </Show>
          Push
        </button>
      </div>

      <Show when={error()}>
        <div class="flex items-center gap-2 px-2 py-1.5 rounded text-xs" style={{ background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`, color: tokens.colors.semantic.error }}>
          <Icon name="circle-exclamation" class="w-3.5 h-3.5 shrink-0" />
          <span class="flex-1">{error()}</span>
          <button class="p-0.5 rounded hover:bg-white/10" onClick={() => setError(null)}>
            <Icon name="xmark" class="w-3 h-3" />
          </button>
        </div>
      </Show>

      <Show when={showForcePush()}>
        <div class="flex flex-col gap-2 p-2 rounded border" style={{ "border-color": tokens.colors.semantic.warning, background: `color-mix(in srgb, ${tokens.colors.semantic.warning} 5%, transparent)` }}>
          <div class="flex items-center gap-2 text-xs" style={{ color: tokens.colors.semantic.warning }}>
            <Icon name="triangle-exclamation" class="w-4 h-4 shrink-0" />
            <span class="font-medium">Force push will overwrite remote history</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="flex-1 px-3 py-1.5 text-xs rounded transition-colors"
              style={{ background: `color-mix(in srgb, ${tokens.colors.semantic.error} 20%, transparent)`, color: tokens.colors.semantic.error }}
              onClick={() => handlePush(true)}
              disabled={syncing() !== null}
            >
              Force Push
            </button>
            <button
              class="flex-1 px-3 py-1.5 text-xs rounded transition-colors hover:bg-white/10"
              style={{ color: tokens.colors.text.muted }}
              onClick={() => setShowForcePush(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

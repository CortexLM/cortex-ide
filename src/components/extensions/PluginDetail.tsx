import { Component, Show, For, createSignal, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@/components/ui/Icon";
import { Button, Badge, Text, LoadingSpinner } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

export interface PluginDependency { name: string; version: string; type: "required" | "optional" }

export interface PluginInfo {
  name: string; displayName: string; author: string; description: string;
  version: string; downloads: number; rating: number; readme: string;
  dependencies: PluginDependency[]; license?: string; repository?: string;
  categories: string[]; isInstalled: boolean;
}

interface PluginDetailProps { pluginName: string; onBack?: () => void; onInstall?: (name: string) => void; class?: string }

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function renderStars(r: number): string {
  const f = Math.floor(r), h = r - f >= 0.5 ? 1 : 0;
  return "★".repeat(f) + (h ? "½" : "") + "☆".repeat(5 - f - h);
}

export const PluginDetail: Component<PluginDetailProps> = (props) => {
  const [plugin, setPlugin] = createSignal<PluginInfo | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [installing, setInstalling] = createSignal(false);

  onMount(async () => {
    try {
      const data = await invoke<PluginInfo>("registry_get_plugin", { name: props.pluginName });
      setPlugin(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  });

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await invoke("registry_install_plugin", { name: props.pluginName });
      setPlugin((prev) => (prev ? { ...prev, isInstalled: true } : prev));
      props.onInstall?.(props.pluginName);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async () => {
    setInstalling(true);
    try {
      await invoke("registry_uninstall_plugin", { name: props.pluginName });
      setPlugin((prev) => (prev ? { ...prev, isInstalled: false } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div class={`flex flex-col h-full bg-background overflow-hidden ${props.class || ""}`}>
      <Show when={loading()}>
        <div class="flex items-center justify-center flex-1">
          <LoadingSpinner size="lg" />
        </div>
      </Show>
      <Show when={!loading() && error() && !plugin()}>
        <div class="flex flex-col items-center justify-center flex-1 gap-3 px-6">
          <Icon name="circle-exclamation" class="w-8 h-8 text-error" />
          <Text variant="muted" size="sm">{error()}</Text>
          <Show when={props.onBack}>
            <Button variant="secondary" size="sm" onClick={props.onBack}>Go Back</Button>
          </Show>
        </div>
      </Show>
      <Show when={plugin()}>
        {(info) => (
          <>
            <div class="flex items-start gap-4 px-4 py-4 border-b border-border">
              <Show when={props.onBack}>
                <button type="button" class="p-1.5 rounded hover:bg-white/5 text-foreground-muted hover:text-foreground transition-colors flex-shrink-0 mt-0.5" onClick={props.onBack}>
                  <Icon name="arrow-left" class="w-4 h-4" />
                </button>
              </Show>
              <div class="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center" style={{ "background-color": tokens.colors.interactive.active, color: tokens.colors.semantic.primary }}>
                <Icon name="puzzle-piece" class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <Text as="h2" weight="bold" size="lg" style={{ margin: 0 }}>{info().displayName || info().name}</Text>
                  <Badge size="sm">v{info().version}</Badge>
                  <Show when={info().isInstalled}><Badge variant="success" size="sm">Installed</Badge></Show>
                </div>
                <Text variant="muted" size="xs" style={{ "margin-top": "2px" }}>by {info().author}</Text>
                <Text variant="muted" size="sm" style={{ "margin-top": "6px", "line-height": "1.4" }}>{info().description}</Text>
              </div>
              <div class="flex-shrink-0">
                <Show when={!info().isInstalled} fallback={<Button variant="danger" size="sm" onClick={handleUninstall} disabled={installing()} loading={installing()}>Uninstall</Button>}>
                  <Button variant="primary" size="sm" onClick={handleInstall} disabled={installing()} loading={installing()}>Install</Button>
                </Show>
              </div>
            </div>
            <Show when={error()}>
              <div class="mx-4 mt-3 px-3 py-2 rounded text-sm flex items-center gap-2 bg-error/10 text-error border border-error/20">
                <Icon name="circle-exclamation" class="w-4 h-4 flex-shrink-0" />
                <span>{error()}</span>
              </div>
            </Show>
            <div class="flex items-center gap-5 px-4 py-3 border-b border-border text-xs" style={{ color: tokens.colors.text.muted }}>
              <span class="flex items-center gap-1.5">
                <Icon name="download" class="w-3.5 h-3.5" />{formatDownloads(info().downloads)} downloads
              </span>
              <span class="flex items-center gap-1.5">
                <span style={{ color: tokens.colors.semantic.warning }}>{renderStars(info().rating)}</span>{info().rating.toFixed(1)}
              </span>
              <Show when={info().license}>
                <span class="flex items-center gap-1.5"><Icon name="scale-balanced" class="w-3.5 h-3.5" />{info().license}</span>
              </Show>
              <Show when={info().repository}>
                <a href={info().repository} target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 hover:underline" style={{ color: tokens.colors.semantic.primary }}>
                  <Icon name="code-branch" class="w-3.5 h-3.5" />Repository
                </a>
              </Show>
            </div>
            <div class="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              <Show when={info().readme}>
                <div>
                  <Text weight="bold" size="sm" style={{ "margin-bottom": "8px" }}>README</Text>
                  <pre class="text-xs leading-relaxed rounded-lg p-4 overflow-x-auto whitespace-pre-wrap" style={{ "background-color": tokens.colors.surface.canvas, color: tokens.colors.text.primary, border: `1px solid ${tokens.colors.border.default}` }}>{info().readme}</pre>
                </div>
              </Show>
              <Show when={info().dependencies.length > 0}>
                <div>
                  <Text weight="bold" size="sm" style={{ "margin-bottom": "8px" }}>Dependencies ({info().dependencies.length})</Text>
                  <div class="space-y-1.5">
                    <For each={info().dependencies}>
                      {(dep) => (
                        <div class="flex items-center justify-between px-3 py-2 rounded text-xs" style={{ "background-color": tokens.colors.surface.canvas, border: `1px solid ${tokens.colors.border.default}` }}>
                          <div class="flex items-center gap-2">
                            <Icon name="puzzle-piece" class="w-3 h-3" style={{ color: tokens.colors.text.muted }} />
                            <span style={{ color: tokens.colors.text.primary }}>{dep.name}</span>
                            <Badge size="sm">{dep.version}</Badge>
                          </div>
                          <Badge size="sm" variant={dep.type === "required" ? "error" : "default"}>{dep.type}</Badge>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
          </>
        )}
      </Show>
    </div>
  );
};

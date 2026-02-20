import { createSignal, onMount, Show, For, JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

interface ExtensionDependency {
  name: string;
  version_requirement: string;
}

interface ExtensionVersion {
  version: string;
  download_url: string;
  published_at: string;
}

interface ExtensionDetail {
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  icon_url?: string;
  repository_url?: string;
  download_url: string;
  categories: string[];
  updated_at: string;
  readme?: string;
  dependencies: ExtensionDependency[];
  versions: ExtensionVersion[];
}

interface ExtensionDetailPageProps {
  extensionName: string;
  onBack?: () => void;
  onInstall?: (name: string) => void;
}

export function ExtensionDetailPage(props: ExtensionDetailPageProps): JSX.Element {
  const [detail, setDetail] = createSignal<ExtensionDetail | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [installing, setInstalling] = createSignal(false);
  const [selectedVersion, setSelectedVersion] = createSignal<string>("latest");

  onMount(async () => {
    try {
      const result = await invoke<ExtensionDetail>("registry_get_plugin", {
        name: props.extensionName,
      });
      setDetail(result);
      if (result.versions.length > 0) {
        setSelectedVersion(result.versions[0].version);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  });

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await invoke("registry_install", {
        name: props.extensionName,
        version: selectedVersion() === "latest" ? null : selectedVersion(),
      });
      props.onInstall?.(props.extensionName);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  };

  const renderStars = (rating: number): string => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - half);
  };

  return (
    <div class="flex flex-col h-full overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Show when={props.onBack}>
        <button
          class="flex items-center gap-1 px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          onClick={props.onBack}
        >
          ← Back
        </button>
      </Show>

      <Show when={loading()}>
        <div class="flex items-center justify-center p-8">
          <span class="text-[var(--text-secondary)]">Loading extension details...</span>
        </div>
      </Show>

      <Show when={error()}>
        <div class="p-4 m-4 rounded bg-red-500/10 text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <Show when={detail()}>
        {(ext) => (
          <>
            <div class="flex items-start gap-4 p-6 border-b border-[var(--border-primary)]">
              <Show when={ext().icon_url}>
                <img
                  src={ext().icon_url!}
                  alt={ext().name}
                  class="w-16 h-16 rounded-lg"
                />
              </Show>
              <Show when={!ext().icon_url}>
                <div class="w-16 h-16 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-2xl font-bold text-[var(--text-secondary)]">
                  {ext().name.charAt(0).toUpperCase()}
                </div>
              </Show>
              <div class="flex-1 min-w-0">
                <h1 class="text-xl font-semibold truncate">{ext().name}</h1>
                <p class="text-sm text-[var(--text-secondary)]">{ext().author}</p>
                <p class="mt-1 text-sm text-[var(--text-secondary)]">{ext().description}</p>
                <div class="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
                  <span>{renderStars(ext().rating)} {ext().rating.toFixed(1)}</span>
                  <span>{ext().downloads.toLocaleString()} downloads</span>
                  <span>Updated {ext().updated_at}</span>
                </div>
              </div>
              <div class="flex flex-col items-end gap-2">
                <div class="flex items-center gap-2">
                  <Show when={ext().versions.length > 1}>
                    <select
                      class="px-2 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)]"
                      value={selectedVersion()}
                      onChange={(e) => setSelectedVersion(e.currentTarget.value)}
                    >
                      <For each={ext().versions}>
                        {(v) => <option value={v.version}>{v.version}</option>}
                      </For>
                    </select>
                  </Show>
                  <button
                    class="px-4 py-1.5 text-sm font-medium rounded bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                    onClick={handleInstall}
                    disabled={installing()}
                  >
                    {installing() ? "Installing..." : "Install"}
                  </button>
                </div>
                <span class="text-xs text-[var(--text-tertiary)]">v{ext().version}</span>
              </div>
            </div>

            <div class="flex gap-6 p-6">
              <div class="flex-1 min-w-0">
                <Show when={ext().readme}>
                  <div class="prose prose-sm prose-invert max-w-none">
                    <h2 class="text-lg font-semibold mb-3">README</h2>
                    <pre class="whitespace-pre-wrap text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] p-4 rounded-lg overflow-x-auto">
                      {ext().readme}
                    </pre>
                  </div>
                </Show>
                <Show when={!ext().readme}>
                  <p class="text-sm text-[var(--text-tertiary)] italic">No README available.</p>
                </Show>
              </div>

              <div class="w-64 shrink-0 space-y-4">
                <Show when={ext().categories.length > 0}>
                  <div>
                    <h3 class="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-1">Categories</h3>
                    <div class="flex flex-wrap gap-1">
                      <For each={ext().categories}>
                        {(cat) => (
                          <span class="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                            {cat}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={ext().dependencies.length > 0}>
                  <div>
                    <h3 class="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-1">Dependencies</h3>
                    <ul class="space-y-1">
                      <For each={ext().dependencies}>
                        {(dep) => (
                          <li class="text-sm text-[var(--text-secondary)]">
                            {dep.name} <span class="text-[var(--text-tertiary)]">{dep.version_requirement}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                </Show>

                <Show when={ext().repository_url}>
                  <div>
                    <h3 class="text-xs font-semibold uppercase text-[var(--text-tertiary)] mb-1">Repository</h3>
                    <a
                      href={ext().repository_url!}
                      class="text-sm text-[var(--accent-primary)] hover:underline break-all"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ext().repository_url}
                    </a>
                  </div>
                </Show>
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}

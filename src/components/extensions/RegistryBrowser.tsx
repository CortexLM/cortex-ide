import { Component, Show, For, createSignal, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@/components/ui/Icon";
import { Button, Badge, Input, EmptyState, LoadingSpinner } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

export interface RegistryPlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  version: string;
  downloads: number;
  rating: number;
  categories: string[];
  updatedAt: string;
}

type CategoryFilter = "All" | "Themes" | "Languages" | "Snippets" | "AI" | "Git" | "Testing" | "Other";
type SortOption = "relevance" | "downloads" | "rating" | "updated" | "name";

interface RegistryBrowserProps {
  onSelectPlugin?: (name: string) => void;
  class?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORIES: CategoryFilter[] = ["All", "Themes", "Languages", "Snippets", "AI", "Git", "Testing", "Other"];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "downloads", label: "Downloads" },
  { value: "rating", label: "Rating" },
  { value: "updated", label: "Recently Updated" },
  { value: "name", label: "Name" },
];

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

// ============================================================================
// Component
// ============================================================================

export const RegistryBrowser: Component<RegistryBrowserProps> = (props) => {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<CategoryFilter>("All");
  const [sortBy, setSortBy] = createSignal<SortOption>("relevance");
  const [results, setResults] = createSignal<RegistryPlugin[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [page, setPage] = createSignal(0);
  const [hasMore, setHasMore] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
  });

  const fetchResults = async (resetPage: boolean) => {
    const currentPage = resetPage ? 0 : page();
    if (resetPage) {
      setPage(0);
    }

    setLoading(true);
    setError(null);

    try {
      const category = selectedCategory() === "All" ? undefined : selectedCategory().toLowerCase();
      const data = await invoke<RegistryPlugin[]>("registry_search", {
        query: searchQuery() || undefined,
        category,
        sortBy: sortBy(),
        page: currentPage,
        pageSize: PAGE_SIZE,
      });

      if (resetPage) {
        setResults(data);
      } else {
        setResults((prev) => [...prev, ...data]);
      }

      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      fetchResults(true);
    }, DEBOUNCE_MS);
  };

  const handleCategoryChange = (cat: CategoryFilter) => {
    setSelectedCategory(cat);
    fetchResults(true);
  };

  const handleSortChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    setSortBy(target.value as SortOption);
    fetchResults(true);
  };

  const handleLoadMore = () => {
    setPage((p) => p + 1);
    fetchResults(false);
  };

  const handlePluginClick = (name: string) => {
    props.onSelectPlugin?.(name);
  };

  const formatDownloads = (count: number): string => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
  };

  return (
    <div class={`flex flex-col h-full bg-background ${props.class || ""}`}>
      {/* Search Header */}
      <div class="flex flex-col gap-3 px-4 py-3 border-b border-border">
        <div class="flex items-center gap-2">
          <Icon name="magnifying-glass" class="w-4 h-4 text-foreground-muted flex-shrink-0" />
          <Input
            placeholder="Search plugins..."
            value={searchQuery()}
            onInput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
            style={{ flex: 1 }}
          />
        </div>

        {/* Category Filters */}
        <div class="flex items-center gap-1.5 flex-wrap">
          <For each={CATEGORIES}>
            {(cat) => (
              <button
                type="button"
                class={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory() === cat
                    ? "text-white"
                    : "text-foreground-muted hover:text-foreground hover:bg-white/5"
                }`}
                style={{
                  "background-color": selectedCategory() === cat
                    ? tokens.colors.semantic.primary
                    : "transparent",
                  border: `1px solid ${
                    selectedCategory() === cat
                      ? tokens.colors.semantic.primary
                      : tokens.colors.border.default
                  }`,
                }}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat}
              </button>
            )}
          </For>
        </div>

        {/* Sort */}
        <div class="flex items-center gap-2">
          <span class="text-xs text-foreground-muted">Sort by:</span>
          <select
            class="text-xs rounded px-2 py-1 border"
            style={{
              "background-color": tokens.colors.surface.canvas,
              "border-color": tokens.colors.border.default,
              color: tokens.colors.text.primary,
            }}
            value={sortBy()}
            onChange={handleSortChange}
          >
            <For each={SORT_OPTIONS}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </div>
      </div>

      {/* Results */}
      <div class="flex-1 overflow-y-auto">
        <Show when={error()}>
          <div class="mx-4 mt-3 px-3 py-2 rounded text-sm flex items-center gap-2 bg-error/10 text-error border border-error/20">
            <Icon name="circle-exclamation" class="w-4 h-4 flex-shrink-0" />
            <span>{error()}</span>
          </div>
        </Show>

        <Show
          when={results().length > 0}
          fallback={
            <Show
              when={!loading()}
              fallback={
                <div class="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              }
            >
              <EmptyState
                icon={<Icon name="puzzle-piece" class="w-8 h-8" />}
                title="No plugins found"
                description="Try adjusting your search or category filter."
              />
            </Show>
          }
        >
          <div class="grid grid-cols-1 gap-px" style={{ "background-color": tokens.colors.border.divider }}>
            <For each={results()}>
              {(plugin) => (
                <button
                  type="button"
                  class="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  style={{ "background-color": tokens.colors.surface.canvas }}
                  onClick={() => handlePluginClick(plugin.name)}
                >
                  {/* Plugin Icon */}
                  <div
                    class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{
                      "background-color": tokens.colors.interactive.active,
                      color: tokens.colors.semantic.primary,
                    }}
                  >
                    <Icon name="puzzle-piece" class="w-5 h-5" />
                  </div>

                  {/* Info */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span
                        class="text-sm font-semibold truncate"
                        style={{ color: tokens.colors.text.primary }}
                      >
                        {plugin.name}
                      </span>
                      <Badge size="sm">v{plugin.version}</Badge>
                    </div>
                    <div
                      class="text-xs truncate mt-0.5"
                      style={{ color: tokens.colors.text.muted }}
                    >
                      {plugin.author}
                    </div>
                    <div
                      class="text-xs truncate mt-0.5 line-clamp-1"
                      style={{ color: tokens.colors.text.muted }}
                    >
                      {plugin.description}
                    </div>
                  </div>

                  {/* Stats */}
                  <div class="flex-shrink-0 flex items-center gap-3 text-xs" style={{ color: tokens.colors.text.muted }}>
                    <span class="flex items-center gap-1">
                      <Icon name="download" class="w-3 h-3" />
                      {formatDownloads(plugin.downloads)}
                    </span>
                    <span class="flex items-center gap-1">
                      <Icon name="star" class="w-3 h-3" />
                      {plugin.rating.toFixed(1)}
                    </span>
                  </div>
                </button>
              )}
            </For>
          </div>

          {/* Load More */}
          <Show when={hasMore() && !loading()}>
            <div class="flex justify-center py-4">
              <Button variant="secondary" size="sm" onClick={handleLoadMore}>
                Load More
              </Button>
            </div>
          </Show>

          <Show when={loading() && results().length > 0}>
            <div class="flex items-center justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

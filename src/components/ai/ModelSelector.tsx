/**
 * Model Selector Component
 * A minimalist, keyboard-navigable model selector with provider grouping
 * Inspired by Zed's language_model_selector.rs
 */

import {
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  For,
  Show,
  type JSX,
} from "solid-js";
import { Icon } from "../ui/Icon";
import type { LLMModel } from "@/utils/llm";

// Re-export LLMModel as AIModel for flexibility
export type AIModel = LLMModel;

export interface ModelSelectorProps {
  models: AIModel[];
  selected: string;
  onSelect: (modelId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Format context window size for display
 */
function formatContextWindow(tokens: number | undefined): string {
  if (!tokens) return "";
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`;
  }
  return tokens.toString();
}

/**
 * Provider icon component
 */
function ProviderIcon(props: { provider?: string; class?: string }): JSX.Element {
  const labelMap: Record<string, string> = {
    anthropic: "A",
    openai: "O",
    google: "G",
    mistral: "M",
    deepseek: "D",
  };

  const label = () => {
    const provider = props.provider?.toLowerCase() || "";
    return labelMap[provider] || "•";
  };

  return (
    <span class={`inline-flex items-center justify-center font-mono text-[10px] font-bold opacity-70 ${props.class || ""}`} aria-hidden="true">
      {label()}
    </span>
  );
}

/**
 * Get display name for provider
 */
function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    mistral: "Mistral",
    deepseek: "DeepSeek",
  };
  return names[provider.toLowerCase()] || provider;
}

export function ModelSelector(props: ModelSelectorProps): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [focusedIndex, setFocusedIndex] = createSignal(-1);

  let containerRef: HTMLDivElement | undefined;
  let searchInputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Find selected model
  const selectedModel = createMemo(() =>
    props.models.find((m) => m.id === props.selected)
  );

  // Filter models by search query
  const filteredModels = createMemo(() => {
    const query = search().toLowerCase().trim();
    if (!query) return props.models;
    return props.models.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query)
    );
  });

  // Group models by provider
  const groupedModels = createMemo(() => {
    const groups: Record<string, AIModel[]> = {};
    for (const model of filteredModels()) {
      const provider = model.provider;
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(model);
    }
    return groups;
  });

  // Flat list of selectable model IDs for keyboard navigation
  const flatModelIds = createMemo(() => {
    const ids: string[] = [];
    for (const models of Object.values(groupedModels())) {
      for (const model of models) {
        ids.push(model.id);
      }
    }
    return ids;
  });

  // Reset focus index when search changes
  createEffect(() => {
    search();
    setFocusedIndex(0);
  });

  // Focus search input when dropdown opens
  createEffect(() => {
    if (open()) {
      requestAnimationFrame(() => {
        searchInputRef?.focus();
      });
      // Set initial focus to selected model or first item
      const currentIndex = flatModelIds().indexOf(props.selected);
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
    } else {
      setSearch("");
      setFocusedIndex(-1);
    }
  });

  // Click outside to close
  createEffect(() => {
    if (!open()) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!open()) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    const ids = flatModelIds();
    const currentIndex = focusedIndex();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, ids.length - 1));
        scrollToFocusedItem();
        break;

      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        scrollToFocusedItem();
        break;

      case "Enter":
        e.preventDefault();
        if (currentIndex >= 0 && currentIndex < ids.length) {
          handleSelect(ids[currentIndex]);
        }
        break;

      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;

      case "Tab":
        setOpen(false);
        break;

      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        scrollToFocusedItem();
        break;

      case "End":
        e.preventDefault();
        setFocusedIndex(ids.length - 1);
        scrollToFocusedItem();
        break;
    }
  };

  const scrollToFocusedItem = () => {
    requestAnimationFrame(() => {
      const focused = listRef?.querySelector('[data-focused="true"]');
      focused?.scrollIntoView({ block: "nearest" });
    });
  };

  const handleSelect = (modelId: string) => {
    props.onSelect(modelId);
    setOpen(false);
  };

  const handleTriggerClick = () => {
    if (!props.disabled) {
      setOpen(!open());
    }
  };

  return (
    <div
      ref={containerRef}
      class="model-selector relative"
      onKeyDown={handleKeyDown}
    >
      {/* Trigger button - ghost style, 24px height */}
      <button
        type="button"
        class={`model-selector-trigger flex h-6 items-center gap-1.5 rounded px-2 text-sm transition-colors hover:bg-background-tertiary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 ${
          props.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
        onClick={handleTriggerClick}
        disabled={props.disabled}
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label="Select model"
      >
        <Show when={selectedModel()} fallback={<span class="text-foreground-muted">{props.placeholder || "Select model"}</span>}>
          {(model) => (
            <>
              <ProviderIcon provider={model().provider} class="text-base" />
              <span class="model-name max-w-[120px] truncate font-medium">
                {model().name}
              </span>
              <span class="text-xs text-foreground-muted capitalize hidden sm:inline">
                {getProviderDisplayName(model().provider)}
              </span>
            </>
          )}
        </Show>
        <Icon
          name="chevron-down"
          class={`h-4 w-4 text-foreground-muted transition-transform duration-200 ${
            open() ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown - fixed 280px width */}
      <Show when={open()}>
        <div
          class="model-selector-dropdown absolute right-0 top-full z-50 mt-1 w-[280px] overflow-hidden rounded-lg border border-border bg-background-secondary shadow-lg"
          role="listbox"
          aria-label="Available models"
        >
          {/* Search input */}
          <div class="model-search border-b border-border p-2">
            <div class="relative">
              <Icon name="magnifying-glass" class="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
              <input
                ref={searchInputRef}
                type="text"
                class="w-full rounded-md border border-border bg-background-primary py-1.5 pl-8 pr-3 text-sm placeholder:text-foreground-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Search models..."
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
              />
            </div>
          </div>

          {/* Model list grouped by provider */}
          <div
            ref={listRef}
            class="model-list max-h-[340px] overflow-y-auto p-1"
          >
            <Show
              when={Object.keys(groupedModels()).length > 0}
              fallback={
                <div class="px-3 py-6 text-center text-sm text-foreground-muted">
                  No models found
                </div>
              }
            >
              <For each={Object.entries(groupedModels())}>
                {([provider, models]) => (
                  <div class="model-group">
                    {/* Provider header - 11px uppercase */}
                    <div class="model-group-header flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
                      <ProviderIcon provider={provider} class="text-[11px]" />
                      <span>{getProviderDisplayName(provider)}</span>
                      <span class="font-normal">({models.length})</span>
                    </div>

                    {/* Models in this provider */}
                    <For each={models}>
                      {(model) => {
                        const isSelected = () => model.id === props.selected;
                        const isFocused = () =>
                          flatModelIds()[focusedIndex()] === model.id;

                        return (
                          <button
                            type="button"
                            class={`model-item flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm transition-colors ${
                              isSelected()
                                ? "bg-primary/10 text-primary"
                                : isFocused()
                                ? "bg-background-tertiary"
                                : "hover:bg-background-tertiary"
                            }`}
                            onClick={() => handleSelect(model.id)}
                            onMouseEnter={() =>
                              setFocusedIndex(flatModelIds().indexOf(model.id))
                            }
                            role="option"
                            aria-selected={isSelected()}
                            data-focused={isFocused()}
                          >
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2">
                                <span class="model-item-name font-medium truncate">
                                  {model.name}
                                </span>
                                {/* Capability badges */}
                                <Show when={model.supportsVision}>
                                  <span class="shrink-0 rounded bg-blue-500/20 px-1 py-0.5 text-[10px] text-blue-400">
                                    Vision
                                  </span>
                                </Show>
                                <Show when={model.supportsThinking}>
                                  <span class="shrink-0 rounded bg-[var(--cortex-info)]/20 px-1 py-0.5 text-[10px] text-[var(--cortex-info)]">
                                    Thinking
                                  </span>
                                </Show>
                              </div>
                              <Show when={model.description}>
                                <div class="text-xs text-foreground-muted truncate mt-0.5">
                                  {model.description}
                                </div>
                              </Show>
                            </div>

                            {/* Context window */}
                            <span class="model-item-context shrink-0 text-xs text-foreground-muted">
                              {formatContextWindow(model.maxContextTokens)}
                            </span>

                            {/* Selection indicator */}
                            <Show when={isSelected()}>
                              <Icon name="check" class="check-icon h-4 w-4 shrink-0 text-primary" />
                            </Show>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* Footer with selected model info */}
          <Show when={selectedModel()}>
            {(model) => (
              <div class="border-t border-border bg-background-tertiary/50 px-3 py-2">
                <div class="flex items-center justify-between text-xs text-foreground-muted">
                  <span>
                    Context: {formatContextWindow(model().maxContextTokens)} tokens
                  </span>
                  <span>
                    Output: {formatContextWindow(model().maxOutputTokens)} max
                  </span>
                </div>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}

/**
 * Compact model selector variant for tight spaces
 */
export function ModelSelectorCompact(
  props: ModelSelectorProps & { showProvider?: boolean }
): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [focusedIndex, setFocusedIndex] = createSignal(-1);

  let containerRef: HTMLDivElement | undefined;
  let searchInputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const selectedModel = createMemo(() =>
    props.models.find((m) => m.id === props.selected)
  );

  const filteredModels = createMemo(() => {
    const query = search().toLowerCase().trim();
    if (!query) return props.models;
    return props.models.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query)
    );
  });

  const groupedModels = createMemo(() => {
    const groups: Record<string, AIModel[]> = {};
    for (const model of filteredModels()) {
      if (!groups[model.provider]) {
        groups[model.provider] = [];
      }
      groups[model.provider].push(model);
    }
    return groups;
  });

  const flatModelIds = createMemo(() => {
    const ids: string[] = [];
    for (const models of Object.values(groupedModels())) {
      for (const model of models) {
        ids.push(model.id);
      }
    }
    return ids;
  });

  createEffect(() => {
    search();
    setFocusedIndex(0);
  });

  createEffect(() => {
    if (open()) {
      requestAnimationFrame(() => searchInputRef?.focus());
      const idx = flatModelIds().indexOf(props.selected);
      setFocusedIndex(idx >= 0 ? idx : 0);
    } else {
      setSearch("");
      setFocusedIndex(-1);
    }
  });

  createEffect(() => {
    if (!open()) return;
    const handler = (e: MouseEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    onCleanup(() => document.removeEventListener("mousedown", handler));
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!open()) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    const ids = flatModelIds();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((p) => Math.min(p + 1, ids.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((p) => Math.max(p - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (focusedIndex() >= 0 && focusedIndex() < ids.length) {
          props.onSelect(ids[focusedIndex()]);
          setOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  const handleSelect = (modelId: string) => {
    props.onSelect(modelId);
    setOpen(false);
  };

  return (
    <div ref={containerRef} class="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        class={`flex h-6 items-center gap-1.5 rounded px-2 text-xs transition-colors hover:bg-background-tertiary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 ${
          props.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
        onClick={() => !props.disabled && setOpen(!open())}
        disabled={props.disabled}
        aria-haspopup="listbox"
        aria-expanded={open()}
      >
        <Show when={selectedModel()} fallback={<span class="text-foreground-muted">Model</span>}>
          {(model) => (
            <>
              <ProviderIcon provider={model().provider} class="text-xs" />
              <span class="max-w-[80px] truncate">{model().name}</span>
              <Show when={props.showProvider}>
                <span class="text-foreground-muted">
                  ({getProviderDisplayName(model().provider)})
                </span>
              </Show>
            </>
          )}
        </Show>
        <Icon name="chevron-down" class={`h-3 w-3 transition-transform ${open() ? "rotate-180" : ""}`} />
      </button>

      <Show when={open()}>
        <div class="absolute right-0 top-full z-50 mt-1 w-[280px] overflow-hidden rounded-lg border border-border bg-background-secondary shadow-lg">
          <div class="border-b border-border p-1.5">
            <div class="relative">
              <Icon name="magnifying-glass" class="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
              <input
                ref={searchInputRef}
                type="text"
                class="w-full rounded border border-border bg-background-primary py-1 pl-7 pr-2 text-xs placeholder:text-foreground-muted focus:border-primary focus:outline-none"
                placeholder="Search..."
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
              />
            </div>
          </div>

          <div ref={listRef} class="max-h-[280px] overflow-y-auto p-1">
            <Show
              when={Object.keys(groupedModels()).length > 0}
              fallback={<div class="px-2 py-4 text-center text-xs text-foreground-muted">No models</div>}
            >
              <For each={Object.entries(groupedModels())}>
                {([provider, models]) => (
                  <div class="mb-1 last:mb-0">
                    <div class="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
                      <ProviderIcon provider={provider} class="text-[11px]" />
                      {getProviderDisplayName(provider)}
                    </div>
                    <For each={models}>
                      {(model) => {
                        const isSelected = () => model.id === props.selected;
                        const isFocused = () => flatModelIds()[focusedIndex()] === model.id;
                        return (
                          <button
                            type="button"
                            class={`flex h-8 w-full items-center justify-between gap-2 rounded px-2 text-left text-xs transition-colors ${
                              isSelected()
                                ? "bg-primary/10 text-primary"
                                : isFocused()
                                ? "bg-background-tertiary"
                                : "hover:bg-background-tertiary"
                            }`}
                            onClick={() => handleSelect(model.id)}
                            onMouseEnter={() => setFocusedIndex(flatModelIds().indexOf(model.id))}
                            role="option"
                            aria-selected={isSelected()}
                          >
                            <span class="truncate">{model.name}</span>
                            <div class="flex items-center gap-1">
                              <span class="text-foreground-muted">
                                {formatContextWindow(model.maxContextTokens)}
                              </span>
                              <Show when={isSelected()}>
                                <Icon name="check" class="h-3 w-3 text-primary" />
                              </Show>
                            </div>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default ModelSelector;


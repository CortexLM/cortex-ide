/**
 * LLM Selector Component
 * Allows selecting LLM provider and model
 */

import { createSignal, For, Show, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { useLLM } from "@/context/LLMContext";
import type { LLMProviderType, LLMModel } from "@/utils/llm";

interface LLMSelectorProps {
  showProviderFilter?: boolean;
  compact?: boolean;
  onSelect?: (model: LLMModel, provider: LLMProviderType) => void;
}

export function LLMSelector(props: LLMSelectorProps) {
  const llm = useLLM();
  const [isOpen, setIsOpen] = createSignal(false);
  const [selectedProvider, setSelectedProvider] = createSignal<LLMProviderType | "all">("all");

  const activeModel = createMemo(() => llm.getActiveModel());
  const activeProviderType = () => llm.state.activeProviderType;

  const filteredModels = createMemo(() => {
    const provider = selectedProvider();
    if (provider === "all") {
      return llm.getAllModels();
    }
    return llm.getModels(provider);
  });

  const groupedModels = createMemo(() => {
    const models = filteredModels();
    const groups: Record<LLMProviderType, LLMModel[]> = {
      anthropic: [],
      openai: [],
      google: [],
      mistral: [],
      deepseek: [],
      openrouter: [],
    };

    for (const model of models) {
      if (groups[model.provider]) {
        groups[model.provider].push(model);
      }
    }

    return groups;
  });

  const handleSelectModel = (model: LLMModel) => {
    llm.setActiveModel(model.id, model.provider);
    props.onSelect?.(model, model.provider);
    setIsOpen(false);
  };

  const providerStatuses = createMemo(() => {
    const statuses: Record<LLMProviderType, boolean> = {
      anthropic: false,
      openai: false,
      google: false,
      mistral: false,
      deepseek: false,
      openrouter: false,
    };

    for (const status of llm.getProviderStatuses()) {
      statuses[status.type] = status.isConfigured;
    }

    return statuses;
  });

  const getProviderIcon = (type: LLMProviderType) => {
    const icons: Record<LLMProviderType, string> = {
      anthropic: "🤖",
      openai: "🧠",
      google: "🔷",
      mistral: "💨",
      deepseek: "🌊",
      openrouter: "🔀",
    };
    return icons[type];
  };

  return (
    <div class="relative">
      <button
        onClick={() => setIsOpen(!isOpen())}
        class={`flex items-center gap-2 rounded-lg border border-border bg-background-tertiary transition-colors hover:border-border-active ${
          props.compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
        }`}
      >
        <Icon name="microchip" class={props.compact ? "h-3 w-3" : "h-4 w-4"} style={{ color: "var(--color-primary)" }} />
        <span class="max-w-[150px] truncate">
          {activeModel()?.name || "Select Model"}
        </span>
        <span class="text-xs text-foreground-muted capitalize">
          {llm.getProviderDisplayName(activeProviderType())}
        </span>
        <Icon name="chevron-down" class={`transition-transform ${props.compact ? "h-3 w-3" : "h-4 w-4"} ${isOpen() ? "rotate-180" : ""}`} />
      </button>

      <Show when={isOpen()}>
        <div class="absolute right-0 top-full z-50 mt-1 min-w-[320px] max-h-[400px] overflow-hidden rounded-lg border border-border bg-background-secondary shadow-lg">
          {/* Provider Filter */}
          <Show when={props.showProviderFilter !== false}>
            <div class="flex items-center gap-1 border-b border-border p-2 overflow-x-auto">
              <button
                onClick={() => setSelectedProvider("all")}
                class={`whitespace-nowrap rounded px-2 py-1 text-xs transition-colors ${
                  selectedProvider() === "all"
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-background-tertiary"
                }`}
              >
                All
              </button>
              <For each={llm.getProviderTypes()}>
                {(type) => (
                  <button
                    onClick={() => setSelectedProvider(type)}
                    class={`flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-xs transition-colors ${
                      selectedProvider() === type
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-background-tertiary"
                    }`}
                  >
                    <span>{getProviderIcon(type)}</span>
                    <span>{llm.getProviderDisplayName(type)}</span>
                    <Show when={!providerStatuses()[type] && llm.providerRequiresApiKey(type)}>
                      <Icon name="circle-exclamation" class="h-3 w-3 text-warning" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>

          {/* Model List */}
          <div class="max-h-[320px] overflow-y-auto p-2">
            <For each={Object.entries(groupedModels())}>
              {([provider, models]) => (
                <Show when={models.length > 0}>
                  <div class="mb-2">
                    <div class="mb-1 flex items-center gap-2 px-2 text-xs font-medium text-foreground-muted">
                      <span>{getProviderIcon(provider as LLMProviderType)}</span>
                      <span>{llm.getProviderDisplayName(provider as LLMProviderType)}</span>
                      <Show when={!providerStatuses()[provider as LLMProviderType] && llm.providerRequiresApiKey(provider as LLMProviderType)}>
                        <span class="text-warning">(No API Key)</span>
                      </Show>
                    </div>
                    <For each={models}>
                      {(model) => (
                        <button
                          onClick={() => handleSelectModel(model)}
                          class={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors ${
                            model.id === activeModel()?.id && model.provider === activeProviderType()
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-background-tertiary"
                          }`}
                        >
                          <div class="flex-1">
                            <div class="flex items-center gap-2">
                              <span>{model.name}</span>
                              <Show when={model.supportsVision}>
                                <span class="text-[10px] rounded bg-blue-500/20 px-1 text-blue-400">Vision</span>
                              </Show>
                              <Show when={model.supportsThinking}>
                                <span class="text-[10px] rounded bg-[var(--cortex-info)]/20 px-1 text-[var(--cortex-info)]">Thinking</span>
                              </Show>
                            </div>
                            <Show when={model.description}>
                              <div class="text-xs text-foreground-muted">{model.description}</div>
                            </Show>
                          </div>
                          <Show when={model.id === activeModel()?.id && model.provider === activeProviderType()}>
                            <Icon name="check" class="h-4 w-4 text-primary" />
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              )}
            </For>
          </div>

          {/* Footer with context info */}
          <div class="border-t border-border px-3 py-2">
            <div class="flex items-center justify-between text-xs text-foreground-muted">
              <span class="flex items-center gap-1">
                <Icon name="server" class="h-3 w-3" />
                {activeModel()?.maxContextTokens?.toLocaleString() || 0} tokens context
              </span>
              <span>
                {activeModel()?.maxOutputTokens?.toLocaleString() || 0} max output
              </span>
            </div>
          </div>
        </div>
      </Show>

      {/* Click outside to close */}
      <Show when={isOpen()}>
        <div
          class="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      </Show>
    </div>
  );
}

/**
 * Compact model chip display
 */
export function ModelChip(props: { model?: LLMModel }) {
  const llm = useLLM();

  return (
    <div class="flex items-center gap-1 rounded-full bg-background-tertiary px-2 py-0.5 text-xs">
      <Icon name="microchip" class="h-3 w-3" style={{ color: "var(--color-primary)" }} />
      <span class="max-w-[100px] truncate">
        {props.model?.name || llm.getActiveModel()?.name || "No model"}
      </span>
    </div>
  );
}

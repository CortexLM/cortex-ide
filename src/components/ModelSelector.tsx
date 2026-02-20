import { createSignal, For, Show, createMemo } from "solid-js";
import { Icon } from "./ui/Icon";
import { useSDK } from "@/context/SDKContext";
import { useLLM } from "@/context/LLMContext";
import type { LLMModel, LLMProviderType } from "@/utils/llm";

export function ModelSelector() {
  const { updateConfig } = useSDK();
  const llm = useLLM();
  const [isOpen, setIsOpen] = createSignal(false);
  const [filterProvider, setFilterProvider] = createSignal<LLMProviderType | "all">("all");

  const activeModel = createMemo(() => llm.getActiveModel());
  const activeProviderType = () => llm.state.activeProviderType;

  const filteredModels = createMemo(() => {
    const provider = filterProvider();
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
      groups[model.provider].push(model);
    }

    return groups;
  });

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

  const getProviderIcon = (type: LLMProviderType): string => {
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

  const handleSelectModel = (model: LLMModel) => {
    // Update LLM context
    llm.setActiveModel(model.id, model.provider);
    
    // Also update SDK config for backend communication
    const sdkModelId = `${model.provider}/${model.id}`;
    updateConfig({ model: sdkModelId });
    
    setIsOpen(false);
  };

  return (
    <div class="relative">
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-3 py-1.5 text-sm hover:border-border-active transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <Icon name="microchip" class="h-4 w-4 text-primary" />
        <span class="max-w-[150px] truncate">{activeModel()?.name || "Select Model"}</span>
        <span class="text-xs text-foreground-muted capitalize">
          {llm.getProviderDisplayName(activeProviderType())}
        </span>
        <Icon name="chevron-down" class={`h-4 w-4 transition-transform ${isOpen() ? "rotate-180" : ""}`} />
      </button>

      <Show when={isOpen()}>
        <div class="absolute right-0 top-full mt-1 z-50 min-w-[320px] max-h-[450px] overflow-hidden rounded-lg border border-border bg-background-secondary shadow-lg">
          {/* Provider Filter Tabs */}
          <div class="flex items-center gap-1 border-b border-border p-2 overflow-x-auto">
            <button
              onClick={() => setFilterProvider("all")}
              class={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                filterProvider() === "all"
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-background-tertiary text-foreground-muted"
              }`}
            >
              All Providers
            </button>
            <For each={llm.getProviderTypes()}>
              {(type) => (
                <button
                  onClick={() => setFilterProvider(type)}
                  class={`flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    filterProvider() === type
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-background-tertiary text-foreground-muted"
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

          {/* Model List */}
          <div class="max-h-[350px] overflow-y-auto p-2">
            <For each={Object.entries(groupedModels())}>
              {([provider, models]) => (
                <Show when={models.length > 0}>
                  <div class="mb-3 last:mb-0">
                    <div class="mb-1 flex items-center gap-2 px-2 text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                      <span>{getProviderIcon(provider as LLMProviderType)}</span>
                      <span>{llm.getProviderDisplayName(provider as LLMProviderType)}</span>
                      <Show when={!providerStatuses()[provider as LLMProviderType] && llm.providerRequiresApiKey(provider as LLMProviderType)}>
                        <span class="text-warning normal-case font-normal">(Configure API Key)</span>
                      </Show>
                    </div>
                    <For each={models}>
                      {(model) => {
                        const isSelected = () => model.id === activeModel()?.id && model.provider === activeProviderType();
                        return (
                          <button
                            onClick={() => handleSelectModel(model)}
                            class={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50 ${
                              isSelected()
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-background-tertiary"
                            }`}
                          >
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-medium">{model.name}</span>
                                <Show when={model.supportsVision}>
                                  <span class="text-[10px] rounded bg-blue-500/20 px-1 py-0.5 text-blue-400">Vision</span>
                                </Show>
                                <Show when={model.supportsThinking}>
                                  <span class="text-[10px] rounded bg-purple-500/20 px-1 py-0.5 text-purple-400">Thinking</span>
                                </Show>
                                <Show when={model.supportsTools}>
                                  <span class="text-[10px] rounded bg-green-500/20 px-1 py-0.5 text-green-400">Tools</span>
                                </Show>
                              </div>
                              <Show when={model.description}>
                                <div class="text-xs text-foreground-muted truncate">{model.description}</div>
                              </Show>
                            </div>
                            <Show when={isSelected()}>
                              <Icon name="check" class="h-4 w-4 text-primary flex-shrink-0" />
                            </Show>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>
              )}
            </For>
          </div>

          {/* Footer */}
          <div class="border-t border-border px-3 py-2 bg-background-tertiary/50">
            <div class="flex items-center justify-between text-xs text-foreground-muted">
              <span class="flex items-center gap-1">
                <Icon name="server" class="h-3 w-3" />
                {activeModel()?.maxContextTokens?.toLocaleString() || 0} context
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
          class="fixed inset-0 z-40 cursor-default"
          onClick={() => setIsOpen(false)}
        />
      </Show>
    </div>
  );
}

/**
 * LLM Context Provider
 * Manages multiple LLM providers, API keys, and model selection
 */

import { createContext, useContext, ParentProps, onMount, createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";
import {
  createProvider,
  getProviderTypes,
  getProviderDisplayName,
  providerRequiresApiKey,
  type LLMProvider,
  type LLMProviderType,
  type LLMProviderConfig,
  type LLMProviderSettings,
  type LLMModel,
  type LLMUsage,
  type ProviderStatus,
} from "@/utils/llm";

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_SETTINGS = "cortex_llm_settings";
const STORAGE_KEY_ACTIVE_PROVIDER = "cortex_llm_active_provider";
const STORAGE_KEY_ACTIVE_MODEL = "cortex_llm_active_model";
const STORAGE_KEY_USAGE = "cortex_llm_usage";

// ============================================================================
// Types
// ============================================================================

interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  byProvider: Record<LLMProviderType, {
    inputTokens: number;
    outputTokens: number;
    requests: number;
  }>;
  byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    requests: number;
  }>;
  lastReset: number;
}

interface LLMState {
  providers: Map<LLMProviderType, LLMProvider>;
  settings: LLMProviderSettings;
  activeProviderType: LLMProviderType;
  activeModelId: string;
  providerStatuses: ProviderStatus[];
  usage: UsageStats;
  isInitialized: boolean;
}

interface LLMContextValue {
  state: LLMState;
  
  // Provider management
  getProvider: (type: LLMProviderType) => LLMProvider | undefined;
  getActiveProvider: () => LLMProvider | undefined;
  setActiveProvider: (type: LLMProviderType) => void;
  
  // Model management
  getModels: (providerType?: LLMProviderType) => LLMModel[];
  getAllModels: () => LLMModel[];
  getActiveModel: () => LLMModel | undefined;
  setActiveModel: (modelId: string, providerType?: LLMProviderType) => void;
  
  // Configuration
  updateProviderConfig: (type: LLMProviderType, config: LLMProviderConfig) => void;
  getProviderConfig: (type: LLMProviderType) => LLMProviderConfig | undefined;
  setApiKey: (type: LLMProviderType, apiKey: string) => void;
  
  // Status
  getProviderStatuses: () => ProviderStatus[];
  refreshProviderStatus: (type: LLMProviderType) => Promise<void>;
  
  // Usage tracking
  trackUsage: (usage: LLMUsage, provider: LLMProviderType, model: string) => void;
  getUsageStats: () => UsageStats;
  resetUsageStats: () => void;
  
  // Utilities
  getProviderTypes: () => LLMProviderType[];
  getProviderDisplayName: (type: LLMProviderType) => string;
  providerRequiresApiKey: (type: LLMProviderType) => boolean;
}

// ============================================================================
// Default State
// ============================================================================

const defaultUsage: UsageStats = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalRequests: 0,
  byProvider: {
    anthropic: { inputTokens: 0, outputTokens: 0, requests: 0 },
    openai: { inputTokens: 0, outputTokens: 0, requests: 0 },
    google: { inputTokens: 0, outputTokens: 0, requests: 0 },
    mistral: { inputTokens: 0, outputTokens: 0, requests: 0 },
    deepseek: { inputTokens: 0, outputTokens: 0, requests: 0 },
    openrouter: { inputTokens: 0, outputTokens: 0, requests: 0 },
  },
  byModel: {},
  lastReset: Date.now(),
};

// ============================================================================
// Context
// ============================================================================

const LLMContext = createContext<LLMContextValue>();

export function LLMProvider(props: ParentProps) {
  const [state, setState] = createStore<LLMState>({
    providers: new Map(),
    settings: {},
    activeProviderType: "anthropic",
    activeModelId: "claude-opus-4-5-latest",
    providerStatuses: [],
    usage: defaultUsage,
    isInitialized: false,
  });

  // Initialize providers
  const initializeProviders = () => {
    const providers = new Map<LLMProviderType, LLMProvider>();
    const types = getProviderTypes();

    for (const type of types) {
      const provider = createProvider(type);
      const config = state.settings[type];
      if (config) {
        provider.configure(config);
      }
      providers.set(type, provider);
    }

    setState("providers", providers);
    updateProviderStatuses();
  };

  // Load settings from storage
  const loadSettings = () => {
    try {
      const settingsJson = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (settingsJson) {
        const settings: LLMProviderSettings = JSON.parse(settingsJson);
        setState("settings", settings);
      }

      const activeProvider = localStorage.getItem(STORAGE_KEY_ACTIVE_PROVIDER);
      if (activeProvider) {
        setState("activeProviderType", activeProvider as LLMProviderType);
      }

      const activeModel = localStorage.getItem(STORAGE_KEY_ACTIVE_MODEL);
      if (activeModel) {
        setState("activeModelId", activeModel);
      }

      const usageJson = localStorage.getItem(STORAGE_KEY_USAGE);
      if (usageJson) {
        const usage: UsageStats = JSON.parse(usageJson);
        setState("usage", usage);
      }
    } catch (e) {
      console.error("[LLM] Failed to load settings:", e);
    }
  };

  // Save settings to storage
  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(state.settings));
      localStorage.setItem(STORAGE_KEY_ACTIVE_PROVIDER, state.activeProviderType);
      localStorage.setItem(STORAGE_KEY_ACTIVE_MODEL, state.activeModelId);
      localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(state.usage));
    } catch (e) {
      console.error("[LLM] Failed to save settings:", e);
    }
  };

  // Update provider statuses
  const updateProviderStatuses = () => {
    const statuses: ProviderStatus[] = [];
    
    for (const [type, provider] of state.providers) {
      statuses.push({
        type,
        name: provider.name,
        isConfigured: provider.isConfigured,
        isConnected: provider.isConfigured,
        modelCount: provider.getModels().length,
      });
    }
    
    setState("providerStatuses", statuses);
  };

  // Initialize on mount
  onMount(() => {
    loadSettings();
    initializeProviders();
    setState("isInitialized", true);
  });

  // Save settings when they change
  createEffect(() => {
    if (state.isInitialized) {
      saveSettings();
    }
  });

  // Context value
  const contextValue: LLMContextValue = {
    state,

    getProvider: (type: LLMProviderType) => {
      return state.providers.get(type);
    },

    getActiveProvider: () => {
      return state.providers.get(state.activeProviderType);
    },

    setActiveProvider: (type: LLMProviderType) => {
      setState("activeProviderType", type);
      
      // Set default model for this provider
      const provider = state.providers.get(type);
      if (provider) {
        const defaultModel = provider.getDefaultModel();
        setState("activeModelId", defaultModel.id);
      }
    },

    getModels: (providerType?: LLMProviderType) => {
      const type = providerType || state.activeProviderType;
      const provider = state.providers.get(type);
      return provider?.getModels() || [];
    },

    getAllModels: () => {
      const allModels: LLMModel[] = [];
      for (const [, provider] of state.providers) {
        allModels.push(...provider.getModels());
      }
      return allModels;
    },

    getActiveModel: () => {
      const provider = state.providers.get(state.activeProviderType);
      if (!provider) return undefined;
      
      const models = provider.getModels();
      return models.find(m => m.id === state.activeModelId) || models[0];
    },

    setActiveModel: (modelId: string, providerType?: LLMProviderType) => {
      setState("activeModelId", modelId);
      
      if (providerType) {
        setState("activeProviderType", providerType);
      } else {
        // Find which provider has this model
        for (const [type, provider] of state.providers) {
          const hasModel = provider.getModels().some(m => m.id === modelId);
          if (hasModel) {
            setState("activeProviderType", type);
            break;
          }
        }
      }
    },

    updateProviderConfig: (type: LLMProviderType, config: LLMProviderConfig) => {
      setState(produce((s) => {
        s.settings[type] = { ...s.settings[type], ...config };
      }));

      const provider = state.providers.get(type);
      if (provider) {
        provider.configure({ ...state.settings[type], ...config });
        updateProviderStatuses();
      }
    },

    getProviderConfig: (type: LLMProviderType) => {
      return state.settings[type];
    },

    setApiKey: (type: LLMProviderType, apiKey: string) => {
      contextValue.updateProviderConfig(type, { apiKey });
    },

    getProviderStatuses: () => {
      return state.providerStatuses;
    },

    refreshProviderStatus: async (type: LLMProviderType) => {
      const provider = state.providers.get(type);
      if (!provider) return;

      try {
        const isValid = await provider.validateApiKey?.();
        setState(produce((s) => {
          const status = s.providerStatuses.find(ps => ps.type === type);
          if (status) {
            status.isConnected = isValid ?? provider.isConfigured;
            status.lastError = isValid ? undefined : "API key validation failed";
          }
        }));
      } catch (e) {
        setState(produce((s) => {
          const status = s.providerStatuses.find(ps => ps.type === type);
          if (status) {
            status.isConnected = false;
            status.lastError = e instanceof Error ? e.message : "Unknown error";
          }
        }));
      }
    },

    trackUsage: (usage: LLMUsage, provider: LLMProviderType, model: string) => {
      setState(produce((s) => {
        s.usage.totalInputTokens += usage.inputTokens;
        s.usage.totalOutputTokens += usage.outputTokens;
        s.usage.totalRequests += 1;

        s.usage.byProvider[provider].inputTokens += usage.inputTokens;
        s.usage.byProvider[provider].outputTokens += usage.outputTokens;
        s.usage.byProvider[provider].requests += 1;

        if (!s.usage.byModel[model]) {
          s.usage.byModel[model] = { inputTokens: 0, outputTokens: 0, requests: 0 };
        }
        s.usage.byModel[model].inputTokens += usage.inputTokens;
        s.usage.byModel[model].outputTokens += usage.outputTokens;
        s.usage.byModel[model].requests += 1;
      }));
    },

    getUsageStats: () => {
      return state.usage;
    },

    resetUsageStats: () => {
      setState("usage", { ...defaultUsage, lastReset: Date.now() });
    },

    getProviderTypes,
    getProviderDisplayName,
    providerRequiresApiKey,
  };

  return (
    <LLMContext.Provider value={contextValue}>
      {props.children}
    </LLMContext.Provider>
  );
}

export function useLLM() {
  const ctx = useContext(LLMContext);
  if (!ctx) throw new Error("useLLM must be used within LLMProvider");
  return ctx;
}

export type { LLMContextValue, UsageStats };

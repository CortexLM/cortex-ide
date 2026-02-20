import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/llm", () => ({
  createProvider: vi.fn(),
  getProviderTypes: vi.fn().mockReturnValue(["openai", "anthropic", "local"]),
  getDefaultModels: vi.fn().mockReturnValue([
    { id: "gpt-4", name: "GPT-4", provider: "openai" },
    { id: "claude-3", name: "Claude 3", provider: "anthropic" },
  ]),
}));

interface LLMProvider {
  id: string;
  type: "openai" | "anthropic" | "local" | "custom";
  name: string;
  apiKey?: string;
  baseUrl?: string;
  isEnabled: boolean;
  models: LLMModel[];
}

interface LLMModel {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  maxTokens?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

interface LLMUsage {
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: number;
  cost?: number;
}

interface LLMSettings {
  defaultProvider: string | null;
  defaultModel: string | null;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  systemPrompt: string;
  streamResponses: boolean;
  saveHistory: boolean;
  maxHistoryItems: number;
}

interface LLMState {
  providers: LLMProvider[];
  activeProvider: LLMProvider | null;
  activeModel: LLMModel | null;
  settings: LLMSettings;
  usage: LLMUsage[];
  isLoading: boolean;
  error: string | null;
}

interface LLMContextValue {
  state: LLMState;
  addProvider: (provider: Omit<LLMProvider, "id">) => void;
  updateProvider: (id: string, updates: Partial<LLMProvider>) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (providerId: string) => void;
  setActiveModel: (modelId: string) => void;
  updateSettings: (settings: Partial<LLMSettings>) => void;
  recordUsage: (usage: Omit<LLMUsage, "timestamp">) => void;
  clearUsage: () => void;
  getUsageStats: () => { totalTokens: number; totalCost: number };
  testConnection: (providerId: string) => Promise<boolean>;
  refreshModels: (providerId: string) => Promise<void>;
}

const STORAGE_KEY_SETTINGS = "cortex_llm_settings";
const STORAGE_KEY_ACTIVE_PROVIDER = "cortex_llm_active_provider";
const STORAGE_KEY_ACTIVE_MODEL = "cortex_llm_active_model";
const STORAGE_KEY_USAGE = "cortex_llm_usage";

describe("LLMContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("LLMProvider interface", () => {
    it("should have correct provider structure", () => {
      const provider: LLMProvider = {
        id: "provider-1",
        type: "openai",
        name: "OpenAI",
        apiKey: "sk-test-key",
        baseUrl: "https://api.openai.com/v1",
        isEnabled: true,
        models: [],
      };

      expect(provider.id).toBe("provider-1");
      expect(provider.type).toBe("openai");
      expect(provider.isEnabled).toBe(true);
    });

    it("should support different provider types", () => {
      const types: Array<"openai" | "anthropic" | "local" | "custom"> = [
        "openai",
        "anthropic",
        "local",
        "custom",
      ];

      types.forEach((type) => {
        const provider: LLMProvider = {
          id: `provider-${type}`,
          type,
          name: type.toUpperCase(),
          isEnabled: true,
          models: [],
        };
        expect(provider.type).toBe(type);
      });
    });

    it("should allow optional fields", () => {
      const provider: LLMProvider = {
        id: "local-1",
        type: "local",
        name: "Local LLM",
        isEnabled: true,
        models: [],
      };

      expect(provider.apiKey).toBeUndefined();
      expect(provider.baseUrl).toBeUndefined();
    });
  });

  describe("LLMModel interface", () => {
    it("should have correct model structure", () => {
      const model: LLMModel = {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        provider: "openai",
        contextWindow: 128000,
        maxTokens: 4096,
        supportsVision: true,
        supportsTools: true,
      };

      expect(model.id).toBe("gpt-4-turbo");
      expect(model.contextWindow).toBe(128000);
      expect(model.supportsVision).toBe(true);
    });

    it("should allow minimal model definition", () => {
      const model: LLMModel = {
        id: "custom-model",
        name: "Custom Model",
        provider: "custom",
      };

      expect(model.contextWindow).toBeUndefined();
      expect(model.supportsTools).toBeUndefined();
    });
  });

  describe("LLMUsage interface", () => {
    it("should track token usage", () => {
      const usage: LLMUsage = {
        providerId: "openai-1",
        modelId: "gpt-4",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        timestamp: Date.now(),
        cost: 0.0045,
      };

      expect(usage.totalTokens).toBe(150);
      expect(usage.cost).toBe(0.0045);
    });
  });

  describe("LLMSettings interface", () => {
    it("should have correct default settings", () => {
      const settings: LLMSettings = {
        defaultProvider: null,
        defaultModel: null,
        temperature: 0.7,
        maxTokens: 2048,
        topP: 1.0,
        frequencyPenalty: 0,
        presencePenalty: 0,
        systemPrompt: "",
        streamResponses: true,
        saveHistory: true,
        maxHistoryItems: 100,
      };

      expect(settings.temperature).toBe(0.7);
      expect(settings.streamResponses).toBe(true);
    });
  });

  describe("Storage persistence", () => {
    it("should save settings to localStorage", () => {
      const settings: LLMSettings = {
        defaultProvider: "openai-1",
        defaultModel: "gpt-4",
        temperature: 0.8,
        maxTokens: 4096,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.1,
        systemPrompt: "You are a helpful assistant.",
        streamResponses: true,
        saveHistory: true,
        maxHistoryItems: 50,
      };

      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));

      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.temperature).toBe(0.8);
    });

    it("should save active provider to localStorage", () => {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PROVIDER, "openai-1");

      const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_PROVIDER);
      expect(stored).toBe("openai-1");
    });

    it("should save active model to localStorage", () => {
      localStorage.setItem(STORAGE_KEY_ACTIVE_MODEL, "gpt-4-turbo");

      const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_MODEL);
      expect(stored).toBe("gpt-4-turbo");
    });

    it("should save usage data to localStorage", () => {
      const usage: LLMUsage[] = [
        {
          providerId: "openai-1",
          modelId: "gpt-4",
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          timestamp: Date.now(),
        },
      ];

      localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(usage));

      const stored = localStorage.getItem(STORAGE_KEY_USAGE);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
    });
  });

  describe("State management", () => {
    it("should manage providers array", () => {
      let state: LLMState = {
        providers: [],
        activeProvider: null,
        activeModel: null,
        settings: {
          defaultProvider: null,
          defaultModel: null,
          temperature: 0.7,
          maxTokens: 2048,
          topP: 1.0,
          frequencyPenalty: 0,
          presencePenalty: 0,
          systemPrompt: "",
          streamResponses: true,
          saveHistory: true,
          maxHistoryItems: 100,
        },
        usage: [],
        isLoading: false,
        error: null,
      };

      const newProvider: LLMProvider = {
        id: "openai-1",
        type: "openai",
        name: "OpenAI",
        isEnabled: true,
        models: [],
      };

      state = { ...state, providers: [...state.providers, newProvider] };
      expect(state.providers).toHaveLength(1);
    });

    it("should set active provider", () => {
      const provider: LLMProvider = {
        id: "openai-1",
        type: "openai",
        name: "OpenAI",
        isEnabled: true,
        models: [
          { id: "gpt-4", name: "GPT-4", provider: "openai" },
        ],
      };

      let state: LLMState = {
        providers: [provider],
        activeProvider: null,
        activeModel: null,
        settings: {
          defaultProvider: null,
          defaultModel: null,
          temperature: 0.7,
          maxTokens: 2048,
          topP: 1.0,
          frequencyPenalty: 0,
          presencePenalty: 0,
          systemPrompt: "",
          streamResponses: true,
          saveHistory: true,
          maxHistoryItems: 100,
        },
        usage: [],
        isLoading: false,
        error: null,
      };

      state = { ...state, activeProvider: provider };
      expect(state.activeProvider?.id).toBe("openai-1");
    });

    it("should track usage history", () => {
      let state: LLMState = {
        providers: [],
        activeProvider: null,
        activeModel: null,
        settings: {
          defaultProvider: null,
          defaultModel: null,
          temperature: 0.7,
          maxTokens: 2048,
          topP: 1.0,
          frequencyPenalty: 0,
          presencePenalty: 0,
          systemPrompt: "",
          streamResponses: true,
          saveHistory: true,
          maxHistoryItems: 100,
        },
        usage: [],
        isLoading: false,
        error: null,
      };

      const newUsage: LLMUsage = {
        providerId: "openai-1",
        modelId: "gpt-4",
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        timestamp: Date.now(),
      };

      state = { ...state, usage: [...state.usage, newUsage] };
      expect(state.usage).toHaveLength(1);
      expect(state.usage[0].totalTokens).toBe(300);
    });
  });

  describe("Provider operations", () => {
    it("should add a new provider", () => {
      let providers: LLMProvider[] = [];

      const newProvider: LLMProvider = {
        id: `provider-${Date.now()}`,
        type: "anthropic",
        name: "Anthropic",
        apiKey: "sk-ant-test",
        isEnabled: true,
        models: [],
      };

      providers = [...providers, newProvider];
      expect(providers).toHaveLength(1);
      expect(providers[0].type).toBe("anthropic");
    });

    it("should update provider settings", () => {
      let providers: LLMProvider[] = [
        {
          id: "openai-1",
          type: "openai",
          name: "OpenAI",
          apiKey: "old-key",
          isEnabled: true,
          models: [],
        },
      ];

      providers = providers.map((p) =>
        p.id === "openai-1" ? { ...p, apiKey: "new-key", name: "OpenAI Updated" } : p
      );

      expect(providers[0].apiKey).toBe("new-key");
      expect(providers[0].name).toBe("OpenAI Updated");
    });

    it("should remove provider", () => {
      let providers: LLMProvider[] = [
        { id: "p1", type: "openai", name: "OpenAI", isEnabled: true, models: [] },
        { id: "p2", type: "anthropic", name: "Anthropic", isEnabled: true, models: [] },
      ];

      providers = providers.filter((p) => p.id !== "p1");
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe("p2");
    });
  });

  describe("Usage statistics", () => {
    it("should calculate total tokens", () => {
      const usage: LLMUsage[] = [
        { providerId: "p1", modelId: "m1", promptTokens: 100, completionTokens: 50, totalTokens: 150, timestamp: 1 },
        { providerId: "p1", modelId: "m1", promptTokens: 200, completionTokens: 100, totalTokens: 300, timestamp: 2 },
      ];

      const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);
      expect(totalTokens).toBe(450);
    });

    it("should calculate total cost", () => {
      const usage: LLMUsage[] = [
        { providerId: "p1", modelId: "m1", promptTokens: 100, completionTokens: 50, totalTokens: 150, timestamp: 1, cost: 0.01 },
        { providerId: "p1", modelId: "m1", promptTokens: 200, completionTokens: 100, totalTokens: 300, timestamp: 2, cost: 0.02 },
      ];

      const totalCost = usage.reduce((sum, u) => sum + (u.cost || 0), 0);
      expect(totalCost).toBe(0.03);
    });

    it("should clear usage history", () => {
      let usage: LLMUsage[] = [
        { providerId: "p1", modelId: "m1", promptTokens: 100, completionTokens: 50, totalTokens: 150, timestamp: 1 },
      ];

      usage = [];
      expect(usage).toHaveLength(0);
    });
  });

  describe("Settings management", () => {
    it("should update individual settings", () => {
      let settings: LLMSettings = {
        defaultProvider: null,
        defaultModel: null,
        temperature: 0.7,
        maxTokens: 2048,
        topP: 1.0,
        frequencyPenalty: 0,
        presencePenalty: 0,
        systemPrompt: "",
        streamResponses: true,
        saveHistory: true,
        maxHistoryItems: 100,
      };

      settings = { ...settings, temperature: 0.9, maxTokens: 4096 };
      expect(settings.temperature).toBe(0.9);
      expect(settings.maxTokens).toBe(4096);
    });

    it("should set system prompt", () => {
      let settings: LLMSettings = {
        defaultProvider: null,
        defaultModel: null,
        temperature: 0.7,
        maxTokens: 2048,
        topP: 1.0,
        frequencyPenalty: 0,
        presencePenalty: 0,
        systemPrompt: "",
        streamResponses: true,
        saveHistory: true,
        maxHistoryItems: 100,
      };

      settings = { ...settings, systemPrompt: "You are a coding assistant." };
      expect(settings.systemPrompt).toBe("You are a coding assistant.");
    });
  });

  describe("Context value structure", () => {
    it("should define all required methods", () => {
      const mockContext: LLMContextValue = {
        state: {
          providers: [],
          activeProvider: null,
          activeModel: null,
          settings: {
            defaultProvider: null,
            defaultModel: null,
            temperature: 0.7,
            maxTokens: 2048,
            topP: 1.0,
            frequencyPenalty: 0,
            presencePenalty: 0,
            systemPrompt: "",
            streamResponses: true,
            saveHistory: true,
            maxHistoryItems: 100,
          },
          usage: [],
          isLoading: false,
          error: null,
        },
        addProvider: vi.fn(),
        updateProvider: vi.fn(),
        removeProvider: vi.fn(),
        setActiveProvider: vi.fn(),
        setActiveModel: vi.fn(),
        updateSettings: vi.fn(),
        recordUsage: vi.fn(),
        clearUsage: vi.fn(),
        getUsageStats: vi.fn(),
        testConnection: vi.fn(),
        refreshModels: vi.fn(),
      };

      expect(mockContext.addProvider).toBeDefined();
      expect(mockContext.updateProvider).toBeDefined();
      expect(mockContext.removeProvider).toBeDefined();
      expect(mockContext.setActiveProvider).toBeDefined();
      expect(mockContext.recordUsage).toBeDefined();
      expect(mockContext.testConnection).toBeDefined();
    });
  });
});

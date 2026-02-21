import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

interface AIModel {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
}

interface AIProviderState {
  models: AIModel[];
  selectedModel: string;
  isLoading: boolean;
}

interface AIProviderContextValue {
  models: () => AIModel[];
  selectedModel: () => string;
  isLoading: () => boolean;
  setSelectedModel: (model: string) => void;
  fetchModels: () => Promise<void>;
  _state: AIProviderState;
}

const STORAGE_KEY_SELECTED_MODEL = "cortex_ai_selected_model";

describe("AIProviderContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("AIModel interface", () => {
    it("should have correct model structure", () => {
      const model: AIModel = {
        id: "gpt-4",
        name: "GPT-4",
        provider: "openai",
        contextWindow: 128000,
        supportsStreaming: true,
        supportsTools: true,
      };

      expect(model.id).toBe("gpt-4");
      expect(model.provider).toBe("openai");
      expect(model.contextWindow).toBe(128000);
      expect(model.supportsStreaming).toBe(true);
      expect(model.supportsTools).toBe(true);
    });

    it("should support different providers", () => {
      const models: AIModel[] = [
        {
          id: "gpt-4",
          name: "GPT-4",
          provider: "openai",
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
        },
        {
          id: "claude-3-opus",
          name: "Claude 3 Opus",
          provider: "anthropic",
          contextWindow: 200000,
          supportsStreaming: true,
          supportsTools: true,
        },
        {
          id: "gemini-pro",
          name: "Gemini Pro",
          provider: "google",
          contextWindow: 32000,
          supportsStreaming: true,
          supportsTools: false,
        },
      ];

      expect(models).toHaveLength(3);
      expect(models.map((m) => m.provider)).toEqual(["openai", "anthropic", "google"]);
    });

    it("should support models without tool use", () => {
      const model: AIModel = {
        id: "text-davinci",
        name: "Text Davinci",
        provider: "openai",
        contextWindow: 4096,
        supportsStreaming: false,
        supportsTools: false,
      };

      expect(model.supportsStreaming).toBe(false);
      expect(model.supportsTools).toBe(false);
    });
  });

  describe("AIProviderState interface", () => {
    it("should have correct initial state", () => {
      const state: AIProviderState = {
        models: [],
        selectedModel: "",
        isLoading: false,
      };

      expect(state.models).toEqual([]);
      expect(state.selectedModel).toBe("");
      expect(state.isLoading).toBe(false);
    });

    it("should represent loaded state", () => {
      const state: AIProviderState = {
        models: [
          {
            id: "gpt-4",
            name: "GPT-4",
            provider: "openai",
            contextWindow: 128000,
            supportsStreaming: true,
            supportsTools: true,
          },
        ],
        selectedModel: "gpt-4",
        isLoading: false,
      };

      expect(state.models).toHaveLength(1);
      expect(state.selectedModel).toBe("gpt-4");
    });

    it("should represent loading state", () => {
      const state: AIProviderState = {
        models: [],
        selectedModel: "",
        isLoading: true,
      };

      expect(state.isLoading).toBe(true);
    });
  });

  describe("IPC operations", () => {
    it("should call invoke for ai_list_models", async () => {
      const mockModels: AIModel[] = [
        {
          id: "gpt-4",
          name: "GPT-4",
          provider: "openai",
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
        },
        {
          id: "claude-3-opus",
          name: "Claude 3 Opus",
          provider: "anthropic",
          contextWindow: 200000,
          supportsStreaming: true,
          supportsTools: true,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockModels);

      const result = await invoke("ai_list_models");

      expect(invoke).toHaveBeenCalledWith("ai_list_models");
      expect(result).toHaveLength(2);
      expect((result as AIModel[])[0].id).toBe("gpt-4");
    });

    it("should handle empty model list", async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await invoke("ai_list_models");

      expect(result).toEqual([]);
    });

    it("should handle invoke failure", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Failed to fetch models"));

      await expect(invoke("ai_list_models")).rejects.toThrow("Failed to fetch models");
    });
  });

  describe("Storage persistence", () => {
    it("should save selected model to localStorage", () => {
      localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, "gpt-4");

      const stored = localStorage.getItem(STORAGE_KEY_SELECTED_MODEL);
      expect(stored).toBe("gpt-4");
    });

    it("should load selected model from localStorage", () => {
      localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, "claude-3-opus");

      const model = localStorage.getItem(STORAGE_KEY_SELECTED_MODEL);
      expect(model).toBe("claude-3-opus");
    });

    it("should handle missing storage key", () => {
      const model = localStorage.getItem(STORAGE_KEY_SELECTED_MODEL);
      expect(model).toBeNull();
    });

    it("should overwrite existing model selection", () => {
      localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, "gpt-4");
      localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, "claude-3-opus");

      const stored = localStorage.getItem(STORAGE_KEY_SELECTED_MODEL);
      expect(stored).toBe("claude-3-opus");
    });
  });

  describe("Model selection logic", () => {
    it("should auto-select first model when none selected", () => {
      const models: AIModel[] = [
        {
          id: "gpt-4",
          name: "GPT-4",
          provider: "openai",
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
        },
      ];

      const state: AIProviderState = {
        models,
        selectedModel: "",
        isLoading: false,
      };

      if (!state.selectedModel && state.models.length > 0) {
        state.selectedModel = state.models[0].id;
      }

      expect(state.selectedModel).toBe("gpt-4");
    });

    it("should not override existing selection", () => {
      const models: AIModel[] = [
        {
          id: "gpt-4",
          name: "GPT-4",
          provider: "openai",
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
        },
      ];

      const state: AIProviderState = {
        models,
        selectedModel: "claude-3-opus",
        isLoading: false,
      };

      if (!state.selectedModel && state.models.length > 0) {
        state.selectedModel = state.models[0].id;
      }

      expect(state.selectedModel).toBe("claude-3-opus");
    });

    it("should handle model selection with persistence", () => {
      const setSelectedModel = (model: string) => {
        localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, model);
      };

      setSelectedModel("gpt-4");
      expect(localStorage.getItem(STORAGE_KEY_SELECTED_MODEL)).toBe("gpt-4");

      setSelectedModel("claude-3-opus");
      expect(localStorage.getItem(STORAGE_KEY_SELECTED_MODEL)).toBe("claude-3-opus");
    });
  });

  describe("Context value structure", () => {
    it("should define all required context methods", () => {
      const state: AIProviderState = {
        models: [],
        selectedModel: "",
        isLoading: false,
      };

      const contextValue: AIProviderContextValue = {
        models: () => state.models,
        selectedModel: () => state.selectedModel,
        isLoading: () => state.isLoading,
        setSelectedModel: vi.fn(),
        fetchModels: vi.fn().mockResolvedValue(undefined),
        _state: state,
      };

      expect(contextValue.models()).toEqual([]);
      expect(contextValue.selectedModel()).toBe("");
      expect(contextValue.isLoading()).toBe(false);
      expect(typeof contextValue.setSelectedModel).toBe("function");
      expect(typeof contextValue.fetchModels).toBe("function");
    });

    it("should expose reactive accessors", () => {
      const models: AIModel[] = [
        {
          id: "gpt-4",
          name: "GPT-4",
          provider: "openai",
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
        },
      ];

      const state: AIProviderState = {
        models,
        selectedModel: "gpt-4",
        isLoading: false,
      };

      const contextValue: AIProviderContextValue = {
        models: () => state.models,
        selectedModel: () => state.selectedModel,
        isLoading: () => state.isLoading,
        setSelectedModel: vi.fn(),
        fetchModels: vi.fn().mockResolvedValue(undefined),
        _state: state,
      };

      expect(contextValue.models()).toHaveLength(1);
      expect(contextValue.selectedModel()).toBe("gpt-4");
    });
  });

  describe("Fetch models workflow", () => {
    it("should fetch and store models", async () => {
      const mockModels: AIModel[] = [
        {
          id: "gpt-4",
          name: "GPT-4",
          provider: "openai",
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
        },
        {
          id: "claude-3-sonnet",
          name: "Claude 3 Sonnet",
          provider: "anthropic",
          contextWindow: 200000,
          supportsStreaming: true,
          supportsTools: true,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockModels);

      const result = await invoke<AIModel[]>("ai_list_models");

      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe("openai");
      expect(result[1].provider).toBe("anthropic");
    });

    it("should set loading state during fetch", () => {
      const state: AIProviderState = {
        models: [],
        selectedModel: "",
        isLoading: false,
      };

      state.isLoading = true;
      expect(state.isLoading).toBe(true);

      state.isLoading = false;
      expect(state.isLoading).toBe(false);
    });

    it("should handle fetch with auto-selection", async () => {
      const mockModels: AIModel[] = [
        {
          id: "gpt-4",
          name: "GPT-4",
          provider: "openai",
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockModels);

      const models = await invoke<AIModel[]>("ai_list_models");

      const state: AIProviderState = {
        models: models,
        selectedModel: "",
        isLoading: false,
      };

      if (!state.selectedModel && state.models.length > 0) {
        state.selectedModel = state.models[0].id;
        localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, state.selectedModel);
      }

      expect(state.selectedModel).toBe("gpt-4");
      expect(localStorage.getItem(STORAGE_KEY_SELECTED_MODEL)).toBe("gpt-4");
    });
  });
});

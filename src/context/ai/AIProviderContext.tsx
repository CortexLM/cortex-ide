/**
 * AIProviderContext - Manages AI model and provider state
 * 
 * Handles:
 * - Available models list
 * - Selected model state
 * - Model persistence
 */

import {
  createContext,
  useContext,
  onMount,
  ParentProps,
  Accessor,
} from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

import type { AIModel } from "../../types";

const STORAGE_KEY_SELECTED_MODEL = "cortex_ai_selected_model";

interface AIProviderState {
  models: AIModel[];
  selectedModel: string;
  isLoading: boolean;
}

export interface AIProviderContextValue {
  models: Accessor<AIModel[]>;
  selectedModel: Accessor<string>;
  isLoading: Accessor<boolean>;
  setSelectedModel: (model: string) => void;
  fetchModels: () => Promise<void>;
  _state: AIProviderState;
}

const AIProviderContext = createContext<AIProviderContextValue>();

export function AIProviderProvider(props: ParentProps) {
  const [state, setState] = createStore<AIProviderState>({
    models: [],
    selectedModel: "",
    isLoading: false,
  });

  const loadFromStorage = () => {
    try {
      const savedModel = localStorage.getItem(STORAGE_KEY_SELECTED_MODEL);
      if (savedModel) {
        setState("selectedModel", savedModel);
      }
    } catch (e) {
      console.warn("[AIProviderContext] Failed to load from storage:", e);
    }
  };

  const saveToStorage = () => {
    try {
      if (state.selectedModel) {
        localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, state.selectedModel);
      }
    } catch (e) {
      console.warn("[AIProviderContext] Failed to save to storage:", e);
    }
  };

  const fetchModels = async (): Promise<void> => {
    setState("isLoading", true);
    try {
      const models = await invoke<AIModel[]>("ai_list_models");
      setState("models", models);

      if (!state.selectedModel && models.length > 0) {
        setState("selectedModel", models[0].id);
        saveToStorage();
      }
    } catch (e) {
      console.error("[AIProviderContext] Failed to fetch models:", e);
    } finally {
      setState("isLoading", false);
    }
  };

  const setSelectedModel = (model: string) => {
    setState("selectedModel", model);
    saveToStorage();
  };

  const models: Accessor<AIModel[]> = () => state.models;
  const selectedModel: Accessor<string> = () => state.selectedModel;
  const isLoading: Accessor<boolean> = () => state.isLoading;

  onMount(() => {
    loadFromStorage();
  });

  const value: AIProviderContextValue = {
    models,
    selectedModel,
    isLoading,
    setSelectedModel,
    fetchModels,
    _state: state,
  };

  return (
    <AIProviderContext.Provider value={value}>
      {props.children}
    </AIProviderContext.Provider>
  );
}

export function useAIProvider() {
  const context = useContext(AIProviderContext);
  if (!context) {
    throw new Error("useAIProvider must be used within AIProviderProvider");
  }
  return context;
}

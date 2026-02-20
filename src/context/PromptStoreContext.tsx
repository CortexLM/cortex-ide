import { createContext, useContext, ParentProps, createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { useCommands } from "./CommandContext";

// ============================================================================
// Prompt Types
// ============================================================================

/** A saved prompt template */
export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  description: string;
  tags: string[];
  category: string;
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Prompt category for organization */
export interface PromptCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  promptCount: number;
}

/** Export format for prompts */
export interface PromptExportData {
  version: string;
  exportedAt: string;
  prompts: SavedPrompt[];
  categories: PromptCategory[];
}

// ============================================================================
// Prompt State
// ============================================================================

interface PromptStoreState {
  prompts: SavedPrompt[];
  categories: PromptCategory[];
  searchQuery: string;
  selectedCategory: string | null;
  selectedTags: string[];
  showFavoritesOnly: boolean;
  sortBy: "title" | "createdAt" | "updatedAt" | "usageCount";
  sortOrder: "asc" | "desc";
  showPanel: boolean;
  editingPrompt: SavedPrompt | null;
  isCreatingNew: boolean;
  loading: boolean;
  error: string | null;
}

interface PromptStoreContextValue {
  state: PromptStoreState;
  // CRUD operations
  loadPrompts: () => Promise<void>;
  createPrompt: (prompt: Omit<SavedPrompt, "id" | "createdAt" | "updatedAt" | "usageCount">) => Promise<SavedPrompt>;
  updatePrompt: (id: string, updates: Partial<SavedPrompt>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  duplicatePrompt: (id: string) => Promise<SavedPrompt>;
  // Category operations
  createCategory: (category: Omit<PromptCategory, "id" | "promptCount">) => void;
  updateCategory: (id: string, updates: Partial<PromptCategory>) => void;
  deleteCategory: (id: string) => void;
  // Filtering and search
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
  setShowFavoritesOnly: (show: boolean) => void;
  setSortBy: (sort: "title" | "createdAt" | "updatedAt" | "usageCount") => void;
  setSortOrder: (order: "asc" | "desc") => void;
  // Filtered results
  getFilteredPrompts: () => SavedPrompt[];
  getAllTags: () => string[];
  // Panel controls
  openPanel: () => void;
  closePanel: () => void;
  editPrompt: (prompt: SavedPrompt) => void;
  createNewPrompt: () => void;
  closeEditor: () => void;
  // Quick actions
  toggleFavorite: (id: string) => Promise<void>;
  incrementUsage: (id: string) => Promise<void>;
  insertPromptIntoChat: (prompt: SavedPrompt) => void;
  // Import/Export
  exportPrompts: (promptIds?: string[]) => PromptExportData;
  importPrompts: (data: PromptExportData, merge?: boolean) => Promise<number>;
  exportToFile: (promptIds?: string[]) => Promise<void>;
  importFromFile: () => Promise<number>;
}

const PromptStoreContext = createContext<PromptStoreContextValue>();

const PROMPTS_STORAGE_KEY = "cortex-prompt-store";
const CATEGORIES_STORAGE_KEY = "cortex-prompt-categories";

// ============================================================================
// Default Categories
// ============================================================================

const DEFAULT_CATEGORIES: PromptCategory[] = [
  { id: "coding", name: "Coding", color: "#8b5cf6", icon: "code", promptCount: 0 },
  { id: "writing", name: "Writing", color: "#3b82f6", icon: "pencil", promptCount: 0 },
  { id: "analysis", name: "Analysis", color: "#22c55e", icon: "chart", promptCount: 0 },
  { id: "creative", name: "Creative", color: "#f59e0b", icon: "lightbulb", promptCount: 0 },
  { id: "general", name: "General", color: "#6b7280", icon: "folder", promptCount: 0 },
];

// ============================================================================
// Default Prompts
// ============================================================================

const DEFAULT_PROMPTS: SavedPrompt[] = [
  {
    id: "code-review",
    title: "Code Review",
    content: "Please review the following code and provide feedback on:\n1. Code quality and best practices\n2. Potential bugs or issues\n3. Performance considerations\n4. Security concerns\n5. Suggestions for improvement\n\n```\n{{code}}\n```",
    description: "Comprehensive code review prompt",
    tags: ["code", "review", "quality"],
    category: "coding",
    isFavorite: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "explain-code",
    title: "Explain Code",
    content: "Please explain the following code in detail:\n\n1. What does this code do?\n2. How does it work step by step?\n3. What are the key concepts used?\n4. Are there any edge cases to consider?\n\n```\n{{code}}\n```",
    description: "Get a detailed explanation of code",
    tags: ["code", "explain", "learning"],
    category: "coding",
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "write-tests",
    title: "Write Unit Tests",
    content: "Write comprehensive unit tests for the following code. Include:\n1. Happy path tests\n2. Edge cases\n3. Error handling tests\n4. Mock dependencies where appropriate\n\nUse {{framework}} testing framework.\n\n```\n{{code}}\n```",
    description: "Generate unit tests for code",
    tags: ["code", "testing", "unit-tests"],
    category: "coding",
    isFavorite: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "refactor-code",
    title: "Refactor Code",
    content: "Please refactor the following code to improve:\n1. Readability\n2. Maintainability\n3. Performance (if applicable)\n4. Follow {{language}} best practices\n\nExplain the changes you made and why.\n\n```\n{{code}}\n```",
    description: "Refactor code for better quality",
    tags: ["code", "refactor", "clean-code"],
    category: "coding",
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "write-documentation",
    title: "Write Documentation",
    content: "Write comprehensive documentation for the following code including:\n1. Overview/Purpose\n2. Parameters/Arguments\n3. Return values\n4. Usage examples\n5. Notes and caveats\n\nUse {{format}} format.\n\n```\n{{code}}\n```",
    description: "Generate documentation for code",
    tags: ["documentation", "code", "comments"],
    category: "writing",
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "summarize",
    title: "Summarize Text",
    content: "Please summarize the following text in {{length}} (short/medium/detailed):\n\n{{text}}\n\nProvide:\n1. Key points\n2. Main conclusions\n3. Important details",
    description: "Summarize text content",
    tags: ["writing", "summary", "analysis"],
    category: "analysis",
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "brainstorm",
    title: "Brainstorm Ideas",
    content: "Help me brainstorm ideas for: {{topic}}\n\nPlease provide:\n1. At least 10 creative ideas\n2. Pros and cons for each\n3. Implementation difficulty (easy/medium/hard)\n4. Potential impact\n\nThink outside the box!",
    description: "Generate creative ideas for a topic",
    tags: ["creative", "brainstorm", "ideas"],
    category: "creative",
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "debug-error",
    title: "Debug Error",
    content: "I'm getting the following error:\n\n```\n{{error}}\n```\n\nIn this code:\n\n```\n{{code}}\n```\n\nPlease help me:\n1. Understand what's causing the error\n2. Provide a solution\n3. Explain how to prevent this in the future",
    description: "Debug an error message",
    tags: ["code", "debug", "error"],
    category: "coding",
    isFavorite: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateCategoryId(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Provider Component
// ============================================================================

export function PromptStoreProvider(props: ParentProps) {
  const [state, setState] = createStore<PromptStoreState>({
    prompts: [],
    categories: [...DEFAULT_CATEGORIES],
    searchQuery: "",
    selectedCategory: null,
    selectedTags: [],
    showFavoritesOnly: false,
    sortBy: "updatedAt",
    sortOrder: "desc",
    showPanel: false,
    editingPrompt: null,
    isCreatingNew: false,
    loading: false,
    error: null,
  });

  // NOTE: Prompts are lazy-loaded when the panel opens, not on mount
  // This ensures instant window startup

  // Register commands
  createEffect(() => {
    try {
      const commands = useCommands();

      commands.registerCommand({
        id: "prompt-store-open",
        label: "Prompt Store: Open",
        shortcut: "Ctrl+Shift+P",
        category: "AI",
        action: openPanel,
      });

      commands.registerCommand({
        id: "prompt-store-new",
        label: "Prompt Store: New Prompt",
        category: "AI",
        action: createNewPrompt,
      });

      commands.registerCommand({
        id: "prompt-store-export",
        label: "Prompt Store: Export All",
        category: "AI",
        action: () => exportToFile(),
      });

      commands.registerCommand({
        id: "prompt-store-import",
        label: "Prompt Store: Import",
        category: "AI",
        action: () => importFromFile(),
      });
    } catch (err) {
      console.debug("[PromptStore] Command registration failed:", err);
    }
  });

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  const loadPrompts = async (): Promise<void> => {
    setState("loading", true);
    setState("error", null);

    try {
      // Try to load from Tauri backend first
      try {
        const data = await invoke<{ prompts: SavedPrompt[]; categories: PromptCategory[] }>("prompt_store_load");
        setState("prompts", data.prompts);
        setState("categories", data.categories.length > 0 ? data.categories : DEFAULT_CATEGORIES);
        updateCategoryCounts();
        return;
      } catch (err) {
        console.debug("[PromptStore] Backend load failed:", err);
      }

      // Load from localStorage
      const storedPrompts = localStorage.getItem(PROMPTS_STORAGE_KEY);
      const storedCategories = localStorage.getItem(CATEGORIES_STORAGE_KEY);

      if (storedPrompts) {
        setState("prompts", JSON.parse(storedPrompts));
      } else {
        setState("prompts", DEFAULT_PROMPTS);
        saveToStorage();
      }

      if (storedCategories) {
        setState("categories", JSON.parse(storedCategories));
      }

      updateCategoryCounts();
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
    } finally {
      setState("loading", false);
    }
  };

  const saveToStorage = async (): Promise<void> => {
    try {
      // Try Tauri backend first
      try {
        await invoke("prompt_store_save", {
          prompts: state.prompts,
          categories: state.categories,
        });
        return;
      } catch (err) {
        console.debug("[PromptStore] Backend save failed:", err);
      }

      localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(state.prompts));
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(state.categories));
    } catch (e) {
      console.error("Failed to save prompts:", e);
    }
  };

  const updateCategoryCounts = (): void => {
    setState(
      "categories",
      produce((categories) => {
        for (const cat of categories) {
          cat.promptCount = state.prompts.filter((p) => p.category === cat.id).length;
        }
      })
    );
  };

  const createPrompt = async (
    promptData: Omit<SavedPrompt, "id" | "createdAt" | "updatedAt" | "usageCount">
  ): Promise<SavedPrompt> => {
    const now = new Date().toISOString();
    const prompt: SavedPrompt = {
      ...promptData,
      id: generateId(),
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    setState("prompts", (prompts) => [...prompts, prompt]);
    updateCategoryCounts();
    await saveToStorage();

    return prompt;
  };

  const updatePrompt = async (id: string, updates: Partial<SavedPrompt>): Promise<void> => {
    setState(
      "prompts",
      (p) => p.id === id,
      produce((p) => {
        Object.assign(p, updates);
        p.updatedAt = new Date().toISOString();
      })
    );
    updateCategoryCounts();
    await saveToStorage();
  };

  const deletePrompt = async (id: string): Promise<void> => {
    setState("prompts", (prompts) => prompts.filter((p) => p.id !== id));
    updateCategoryCounts();
    await saveToStorage();
  };

  const duplicatePrompt = async (id: string): Promise<SavedPrompt> => {
    const original = state.prompts.find((p) => p.id === id);
    if (!original) {
      throw new Error("Prompt not found");
    }

    return createPrompt({
      title: `${original.title} (Copy)`,
      content: original.content,
      description: original.description,
      tags: [...original.tags],
      category: original.category,
      isFavorite: false,
    });
  };

  // ============================================================================
  // Category Operations
  // ============================================================================

  const createCategory = (categoryData: Omit<PromptCategory, "id" | "promptCount">): void => {
    const category: PromptCategory = {
      ...categoryData,
      id: generateCategoryId(),
      promptCount: 0,
    };

    setState("categories", (categories) => [...categories, category]);
    saveToStorage();
  };

  const updateCategory = (id: string, updates: Partial<PromptCategory>): void => {
    setState(
      "categories",
      (c) => c.id === id,
      produce((c) => Object.assign(c, updates))
    );
    saveToStorage();
  };

  const deleteCategory = (id: string): void => {
    // Move prompts in this category to "general"
    setState(
      "prompts",
      (p) => p.category === id,
      "category",
      "general"
    );
    setState("categories", (categories) => categories.filter((c) => c.id !== id));
    updateCategoryCounts();
    saveToStorage();
  };

  // ============================================================================
  // Filtering and Search
  // ============================================================================

  const setSearchQuery = (query: string): void => {
    setState("searchQuery", query);
  };

  const setSelectedCategory = (category: string | null): void => {
    setState("selectedCategory", category);
  };

  const toggleTag = (tag: string): void => {
    setState("selectedTags", (tags) => {
      if (tags.includes(tag)) {
        return tags.filter((t) => t !== tag);
      }
      return [...tags, tag];
    });
  };

  const clearFilters = (): void => {
    setState("searchQuery", "");
    setState("selectedCategory", null);
    setState("selectedTags", []);
    setState("showFavoritesOnly", false);
  };

  const setShowFavoritesOnly = (show: boolean): void => {
    setState("showFavoritesOnly", show);
  };

  const setSortBy = (sort: "title" | "createdAt" | "updatedAt" | "usageCount"): void => {
    setState("sortBy", sort);
  };

  const setSortOrder = (order: "asc" | "desc"): void => {
    setState("sortOrder", order);
  };

  const getFilteredPrompts = (): SavedPrompt[] => {
    let filtered = [...state.prompts];

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.content.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (state.selectedCategory) {
      filtered = filtered.filter((p) => p.category === state.selectedCategory);
    }

    // Filter by tags
    if (state.selectedTags.length > 0) {
      filtered = filtered.filter((p) =>
        state.selectedTags.every((tag) => p.tags.includes(tag))
      );
    }

    // Filter by favorites
    if (state.showFavoritesOnly) {
      filtered = filtered.filter((p) => p.isFavorite);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (state.sortBy) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "updatedAt":
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case "usageCount":
          comparison = a.usageCount - b.usageCount;
          break;
      }

      return state.sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  };

  const getAllTags = (): string[] => {
    const tagsSet = new Set<string>();
    for (const prompt of state.prompts) {
      for (const tag of prompt.tags) {
        tagsSet.add(tag);
      }
    }
    return Array.from(tagsSet).sort();
  };

  // ============================================================================
  // Panel Controls
  // ============================================================================

  const openPanel = (): void => {
    setState("showPanel", true);
    // Lazy load prompts on first open
    if (state.prompts.length === 0 && !state.loading) {
      loadPrompts();
    }
  };

  const closePanel = (): void => {
    setState("showPanel", false);
    setState("editingPrompt", null);
    setState("isCreatingNew", false);
  };

  const editPrompt = (prompt: SavedPrompt): void => {
    setState("editingPrompt", prompt);
    setState("isCreatingNew", false);
  };

  const createNewPrompt = (): void => {
    setState("editingPrompt", null);
    setState("isCreatingNew", true);
    setState("showPanel", true);
  };

  const closeEditor = (): void => {
    setState("editingPrompt", null);
    setState("isCreatingNew", false);
  };

  // ============================================================================
  // Quick Actions
  // ============================================================================

  const toggleFavorite = async (id: string): Promise<void> => {
    const prompt = state.prompts.find((p) => p.id === id);
    if (prompt) {
      await updatePrompt(id, { isFavorite: !prompt.isFavorite });
    }
  };

  const incrementUsage = async (id: string): Promise<void> => {
    const prompt = state.prompts.find((p) => p.id === id);
    if (prompt) {
      await updatePrompt(id, { usageCount: prompt.usageCount + 1 });
    }
  };

  const insertPromptIntoChat = (prompt: SavedPrompt): void => {
    incrementUsage(prompt.id);
    
    // Dispatch event for chat to handle
    window.dispatchEvent(
      new CustomEvent("prompt-store:insert", {
        detail: {
          prompt: prompt.content,
          title: prompt.title,
          id: prompt.id,
        },
      })
    );
    
    closePanel();
  };

  // ============================================================================
  // Import/Export
  // ============================================================================

  const exportPrompts = (promptIds?: string[]): PromptExportData => {
    const promptsToExport = promptIds
      ? state.prompts.filter((p) => promptIds.includes(p.id))
      : state.prompts;

    const categoryIds = new Set(promptsToExport.map((p) => p.category));
    const categoriesToExport = state.categories.filter((c) => categoryIds.has(c.id));

    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      prompts: promptsToExport,
      categories: categoriesToExport,
    };
  };

  const importPrompts = async (data: PromptExportData, merge = true): Promise<number> => {
    if (!data.prompts || !Array.isArray(data.prompts)) {
      throw new Error("Invalid import data: missing prompts array");
    }

    let importedCount = 0;
    const now = new Date().toISOString();

    // Import categories first
    if (data.categories && Array.isArray(data.categories)) {
      for (const cat of data.categories) {
        const existing = state.categories.find((c) => c.id === cat.id || c.name === cat.name);
        if (!existing) {
          setState("categories", (categories) => [
            ...categories,
            { ...cat, promptCount: 0 },
          ]);
        }
      }
    }

    // Import prompts
    for (const prompt of data.prompts) {
      if (merge) {
        const existing = state.prompts.find((p) => p.id === prompt.id);
        if (existing) {
          // Update existing prompt if imported version is newer
          if (new Date(prompt.updatedAt) > new Date(existing.updatedAt)) {
            await updatePrompt(prompt.id, prompt);
            importedCount++;
          }
        } else {
          // Add new prompt with new ID to avoid conflicts
          setState("prompts", (prompts) => [
            ...prompts,
            {
              ...prompt,
              id: generateId(),
              createdAt: now,
              updatedAt: now,
            },
          ]);
          importedCount++;
        }
      } else {
        // Replace all - add with new IDs
        setState("prompts", (prompts) => [
          ...prompts,
          {
            ...prompt,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
          },
        ]);
        importedCount++;
      }
    }

    updateCategoryCounts();
    await saveToStorage();

    return importedCount;
  };

  const exportToFile = async (promptIds?: string[]): Promise<void> => {
    const data = exportPrompts(promptIds);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `cortex-prompts-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importFromFile = async (): Promise<number> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(0);
          return;
        }

        try {
          const text = await file.text();
          const data = JSON.parse(text) as PromptExportData;
          const count = await importPrompts(data, true);
          resolve(count);
        } catch (err) {
          reject(new Error(`Failed to import: ${err}`));
        }
      };

      input.click();
    });
  };

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: PromptStoreContextValue = {
    state,
    loadPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    duplicatePrompt,
    createCategory,
    updateCategory,
    deleteCategory,
    setSearchQuery,
    setSelectedCategory,
    toggleTag,
    clearFilters,
    setShowFavoritesOnly,
    setSortBy,
    setSortOrder,
    getFilteredPrompts,
    getAllTags,
    openPanel,
    closePanel,
    editPrompt,
    createNewPrompt,
    closeEditor,
    toggleFavorite,
    incrementUsage,
    insertPromptIntoChat,
    exportPrompts,
    importPrompts,
    exportToFile,
    importFromFile,
  };

  return (
    <PromptStoreContext.Provider value={value}>
      {props.children}
    </PromptStoreContext.Provider>
  );
}

export function usePromptStore() {
  const context = useContext(PromptStoreContext);
  if (!context) {
    throw new Error("usePromptStore must be used within PromptStoreProvider");
  }
  return context;
}

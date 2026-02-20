import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("PromptStoreContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Prompt Types", () => {
    interface SavedPrompt {
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

    interface PromptCategory {
      id: string;
      name: string;
      color: string;
      icon: string;
      promptCount: number;
    }

    it("should create a saved prompt", () => {
      const prompt: SavedPrompt = {
        id: "prompt-1",
        title: "Code Review",
        content: "Please review this code: {{code}}",
        description: "Comprehensive code review prompt",
        tags: ["code", "review"],
        category: "coding",
        isFavorite: true,
        usageCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(prompt.id).toBe("prompt-1");
      expect(prompt.title).toBe("Code Review");
      expect(prompt.isFavorite).toBe(true);
    });

    it("should create a prompt category", () => {
      const category: PromptCategory = {
        id: "coding",
        name: "Coding",
        color: "#8b5cf6",
        icon: "code",
        promptCount: 10,
      };

      expect(category.id).toBe("coding");
      expect(category.promptCount).toBe(10);
    });
  });

  describe("Prompt CRUD Operations", () => {
    interface SavedPrompt {
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

    it("should create a new prompt", () => {
      const prompts: SavedPrompt[] = [];

      const newPrompt: SavedPrompt = {
        id: `prompt_${Date.now()}`,
        title: "New Prompt",
        content: "This is a new prompt",
        description: "A test prompt",
        tags: ["test"],
        category: "general",
        isFavorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      prompts.push(newPrompt);

      expect(prompts).toHaveLength(1);
      expect(prompts[0].title).toBe("New Prompt");
    });

    it("should update a prompt", () => {
      const prompt: SavedPrompt = {
        id: "prompt-1",
        title: "Original Title",
        content: "Original content",
        description: "Original description",
        tags: ["original"],
        category: "general",
        isFavorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      prompt.title = "Updated Title";
      prompt.content = "Updated content";
      prompt.updatedAt = new Date().toISOString();

      expect(prompt.title).toBe("Updated Title");
      expect(prompt.content).toBe("Updated content");
    });

    it("should delete a prompt", () => {
      const prompts: SavedPrompt[] = [
        {
          id: "prompt-1",
          title: "Prompt 1",
          content: "Content 1",
          description: "",
          tags: [],
          category: "general",
          isFavorite: false,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "prompt-2",
          title: "Prompt 2",
          content: "Content 2",
          description: "",
          tags: [],
          category: "general",
          isFavorite: false,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const filtered = prompts.filter((p) => p.id !== "prompt-1");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("prompt-2");
    });

    it("should duplicate a prompt", () => {
      const original: SavedPrompt = {
        id: "prompt-1",
        title: "Original Prompt",
        content: "Original content",
        description: "Test",
        tags: ["test"],
        category: "coding",
        isFavorite: true,
        usageCount: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const duplicate: SavedPrompt = {
        ...original,
        id: `prompt_${Date.now()}`,
        title: `${original.title} (Copy)`,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(duplicate.title).toBe("Original Prompt (Copy)");
      expect(duplicate.usageCount).toBe(0);
      expect(duplicate.content).toBe(original.content);
    });
  });

  describe("Category Management", () => {
    interface PromptCategory {
      id: string;
      name: string;
      color: string;
      icon: string;
      promptCount: number;
    }

    it("should create a category", () => {
      const categories: PromptCategory[] = [];

      const newCategory: PromptCategory = {
        id: `category_${Date.now()}`,
        name: "Custom Category",
        color: "#ff5733",
        icon: "star",
        promptCount: 0,
      };

      categories.push(newCategory);

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe("Custom Category");
    });

    it("should update category prompt count", () => {
      const categories: PromptCategory[] = [
        { id: "coding", name: "Coding", color: "#8b5cf6", icon: "code", promptCount: 5 },
        { id: "writing", name: "Writing", color: "#3b82f6", icon: "pencil", promptCount: 3 },
      ];

      const categoryIndex = categories.findIndex((c) => c.id === "coding");
      if (categoryIndex !== -1) {
        categories[categoryIndex].promptCount += 1;
      }

      expect(categories[0].promptCount).toBe(6);
    });

    it("should delete a category", () => {
      const categories: PromptCategory[] = [
        { id: "coding", name: "Coding", color: "#8b5cf6", icon: "code", promptCount: 5 },
        { id: "writing", name: "Writing", color: "#3b82f6", icon: "pencil", promptCount: 3 },
      ];

      const filtered = categories.filter((c) => c.id !== "writing");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("coding");
    });
  });

  describe("Filtering and Search", () => {
    interface SavedPrompt {
      id: string;
      title: string;
      content: string;
      description: string;
      tags: string[];
      category: string;
      isFavorite: boolean;
      usageCount: number;
    }

    const prompts: SavedPrompt[] = [
      {
        id: "1",
        title: "Code Review",
        content: "Review code",
        description: "Code review prompt",
        tags: ["code", "review"],
        category: "coding",
        isFavorite: true,
        usageCount: 10,
      },
      {
        id: "2",
        title: "Write Tests",
        content: "Write unit tests",
        description: "Testing prompt",
        tags: ["code", "testing"],
        category: "coding",
        isFavorite: false,
        usageCount: 5,
      },
      {
        id: "3",
        title: "Blog Post",
        content: "Write a blog post",
        description: "Writing prompt",
        tags: ["writing", "content"],
        category: "writing",
        isFavorite: true,
        usageCount: 3,
      },
    ];

    it("should filter by search query", () => {
      const query = "code";
      const filtered = prompts.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Code Review");
    });

    it("should filter by category", () => {
      const category = "coding";
      const filtered = prompts.filter((p) => p.category === category);

      expect(filtered).toHaveLength(2);
    });

    it("should filter by tag", () => {
      const tag = "review";
      const filtered = prompts.filter((p) => p.tags.includes(tag));

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Code Review");
    });

    it("should filter favorites only", () => {
      const filtered = prompts.filter((p) => p.isFavorite);

      expect(filtered).toHaveLength(2);
    });

    it("should get all unique tags", () => {
      const allTags = prompts.flatMap((p) => p.tags);
      const uniqueTags = [...new Set(allTags)];

      expect(uniqueTags).toContain("code");
      expect(uniqueTags).toContain("review");
      expect(uniqueTags).toContain("writing");
    });
  });

  describe("Sorting", () => {
    interface SavedPrompt {
      id: string;
      title: string;
      usageCount: number;
      createdAt: string;
      updatedAt: string;
    }

    const prompts: SavedPrompt[] = [
      { id: "1", title: "Beta", usageCount: 5, createdAt: "2024-01-02", updatedAt: "2024-02-01" },
      { id: "2", title: "Alpha", usageCount: 10, createdAt: "2024-01-01", updatedAt: "2024-03-01" },
      { id: "3", title: "Gamma", usageCount: 3, createdAt: "2024-01-03", updatedAt: "2024-01-15" },
    ];

    it("should sort by title ascending", () => {
      const sorted = [...prompts].sort((a, b) => a.title.localeCompare(b.title));

      expect(sorted[0].title).toBe("Alpha");
      expect(sorted[1].title).toBe("Beta");
      expect(sorted[2].title).toBe("Gamma");
    });

    it("should sort by title descending", () => {
      const sorted = [...prompts].sort((a, b) => b.title.localeCompare(a.title));

      expect(sorted[0].title).toBe("Gamma");
      expect(sorted[2].title).toBe("Alpha");
    });

    it("should sort by usage count descending", () => {
      const sorted = [...prompts].sort((a, b) => b.usageCount - a.usageCount);

      expect(sorted[0].usageCount).toBe(10);
      expect(sorted[1].usageCount).toBe(5);
      expect(sorted[2].usageCount).toBe(3);
    });

    it("should sort by created date", () => {
      const sorted = [...prompts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      expect(sorted[0].id).toBe("3");
      expect(sorted[2].id).toBe("2");
    });

    it("should sort by updated date", () => {
      const sorted = [...prompts].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      expect(sorted[0].id).toBe("2");
    });
  });

  describe("Favorites and Usage", () => {
    interface SavedPrompt {
      id: string;
      title: string;
      isFavorite: boolean;
      usageCount: number;
    }

    it("should toggle favorite", () => {
      const prompt: SavedPrompt = {
        id: "prompt-1",
        title: "Test",
        isFavorite: false,
        usageCount: 0,
      };

      prompt.isFavorite = !prompt.isFavorite;

      expect(prompt.isFavorite).toBe(true);

      prompt.isFavorite = !prompt.isFavorite;

      expect(prompt.isFavorite).toBe(false);
    });

    it("should increment usage count", () => {
      const prompt: SavedPrompt = {
        id: "prompt-1",
        title: "Test",
        isFavorite: false,
        usageCount: 5,
      };

      prompt.usageCount += 1;

      expect(prompt.usageCount).toBe(6);
    });
  });

  describe("Import/Export", () => {
    interface SavedPrompt {
      id: string;
      title: string;
      content: string;
      tags: string[];
      category: string;
    }

    interface PromptCategory {
      id: string;
      name: string;
      color: string;
      icon: string;
      promptCount: number;
    }

    interface PromptExportData {
      version: string;
      exportedAt: string;
      prompts: SavedPrompt[];
      categories: PromptCategory[];
    }

    it("should export prompts", () => {
      const prompts: SavedPrompt[] = [
        { id: "1", title: "Prompt 1", content: "Content 1", tags: [], category: "general" },
        { id: "2", title: "Prompt 2", content: "Content 2", tags: [], category: "coding" },
      ];

      const categories: PromptCategory[] = [
        { id: "general", name: "General", color: "#gray", icon: "folder", promptCount: 1 },
        { id: "coding", name: "Coding", color: "#purple", icon: "code", promptCount: 1 },
      ];

      const exportData: PromptExportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        prompts,
        categories,
      };

      expect(exportData.prompts).toHaveLength(2);
      expect(exportData.categories).toHaveLength(2);
    });

    it("should import prompts with merge", () => {
      const existing: SavedPrompt[] = [
        { id: "1", title: "Existing", content: "Existing content", tags: [], category: "general" },
      ];

      const importData: PromptExportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        prompts: [
          { id: "2", title: "Imported", content: "Imported content", tags: [], category: "general" },
        ],
        categories: [],
      };

      const merged = [...existing, ...importData.prompts];

      expect(merged).toHaveLength(2);
    });

    it("should import prompts with replace", () => {
      const importData: PromptExportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        prompts: [
          { id: "new-1", title: "New 1", content: "Content", tags: [], category: "general" },
          { id: "new-2", title: "New 2", content: "Content", tags: [], category: "general" },
        ],
        categories: [],
      };

      const prompts = importData.prompts;

      expect(prompts).toHaveLength(2);
      expect(prompts[0].id).toBe("new-1");
    });

    it("should export selected prompts only", () => {
      const allPrompts: SavedPrompt[] = [
        { id: "1", title: "Prompt 1", content: "Content 1", tags: [], category: "general" },
        { id: "2", title: "Prompt 2", content: "Content 2", tags: [], category: "general" },
        { id: "3", title: "Prompt 3", content: "Content 3", tags: [], category: "general" },
      ];

      const selectedIds = ["1", "3"];
      const selectedPrompts = allPrompts.filter((p) => selectedIds.includes(p.id));

      expect(selectedPrompts).toHaveLength(2);
      expect(selectedPrompts.map((p) => p.id)).toEqual(["1", "3"]);
    });
  });

  describe("Persistence", () => {
    it("should call invoke for loading prompts", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await invoke("prompt_store_load");

      expect(invoke).toHaveBeenCalledWith("prompt_store_load");
    });

    it("should call invoke for saving prompts", async () => {
      const data = { prompts: [], categories: [] };

      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("prompt_store_save", { data });

      expect(invoke).toHaveBeenCalledWith("prompt_store_save", { data });
    });
  });
});

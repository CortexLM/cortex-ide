import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("PromptStore Component Logic", () => {
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
        id: "p1",
        title: "Code Review",
        content: "Review this code: {{code}}",
        description: "Comprehensive code review",
        tags: ["code", "review"],
        category: "coding",
        isFavorite: true,
        usageCount: 5,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      };

      expect(prompt.title).toBe("Code Review");
      expect(prompt.isFavorite).toBe(true);
      expect(prompt.tags).toContain("code");
    });

    it("should create a prompt category", () => {
      const category: PromptCategory = {
        id: "coding",
        name: "Coding",
        color: "#8b5cf6",
        icon: "code",
        promptCount: 10,
      };

      expect(category.name).toBe("Coding");
      expect(category.promptCount).toBe(10);
    });
  });

  describe("Default Categories", () => {
    interface PromptCategory {
      id: string;
      name: string;
      color: string;
      icon: string;
      promptCount: number;
    }

    const DEFAULT_CATEGORIES: PromptCategory[] = [
      { id: "coding", name: "Coding", color: "#8b5cf6", icon: "code", promptCount: 0 },
      { id: "writing", name: "Writing", color: "#3b82f6", icon: "pencil", promptCount: 0 },
      { id: "analysis", name: "Analysis", color: "#22c55e", icon: "chart", promptCount: 0 },
      { id: "creative", name: "Creative", color: "#f59e0b", icon: "lightbulb", promptCount: 0 },
      { id: "general", name: "General", color: "#6b7280", icon: "folder", promptCount: 0 },
    ];

    it("should have five default categories", () => {
      expect(DEFAULT_CATEGORIES).toHaveLength(5);
    });

    it("should include coding category", () => {
      const coding = DEFAULT_CATEGORIES.find((c) => c.id === "coding");
      expect(coding).toBeDefined();
      expect(coding?.color).toBe("#8b5cf6");
    });

    it("should include writing category", () => {
      const writing = DEFAULT_CATEGORIES.find((c) => c.id === "writing");
      expect(writing).toBeDefined();
      expect(writing?.icon).toBe("pencil");
    });

    it("should have unique ids", () => {
      const ids = DEFAULT_CATEGORIES.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should all start with zero prompt count", () => {
      DEFAULT_CATEGORIES.forEach((cat) => {
        expect(cat.promptCount).toBe(0);
      });
    });
  });

  describe("formatDate", () => {
    function formatDate(dateStr: string): string {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      return date.toLocaleDateString();
    }

    it("should return Today for today", () => {
      const today = new Date().toISOString();
      expect(formatDate(today)).toBe("Today");
    });

    it("should return Yesterday for one day ago", () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(formatDate(oneDayAgo.toISOString())).toBe("Yesterday");
    });

    it("should return days ago for recent dates", () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(0, 0, 0, 0);
      expect(formatDate(threeDaysAgo.toISOString())).toBe("3 days ago");
    });

    it("should return weeks ago for older dates", () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      twoWeeksAgo.setHours(0, 0, 0, 0);
      expect(formatDate(twoWeeksAgo.toISOString())).toBe("2 weeks ago");
    });

    it("should return locale date for very old dates", () => {
      const oldDate = "2023-01-01T00:00:00Z";
      const result = formatDate(oldDate);
      expect(result).not.toBe("Today");
      expect(result).not.toContain("days ago");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getSortLabel", () => {
    function getSortLabel(sortBy: string): string {
      switch (sortBy) {
        case "title":
          return "Name";
        case "createdAt":
          return "Created";
        case "updatedAt":
          return "Modified";
        case "usageCount":
          return "Usage";
        default:
          return "Sort";
      }
    }

    it("should return Name for title", () => {
      expect(getSortLabel("title")).toBe("Name");
    });

    it("should return Created for createdAt", () => {
      expect(getSortLabel("createdAt")).toBe("Created");
    });

    it("should return Modified for updatedAt", () => {
      expect(getSortLabel("updatedAt")).toBe("Modified");
    });

    it("should return Usage for usageCount", () => {
      expect(getSortLabel("usageCount")).toBe("Usage");
    });

    it("should return Sort for unknown", () => {
      expect(getSortLabel("unknown")).toBe("Sort");
    });
  });

  describe("Category Lookup", () => {
    interface PromptCategory {
      id: string;
      name: string;
      color: string;
      icon: string;
      promptCount: number;
    }

    const categories: PromptCategory[] = [
      { id: "coding", name: "Coding", color: "#8b5cf6", icon: "code", promptCount: 5 },
      { id: "writing", name: "Writing", color: "#3b82f6", icon: "pencil", promptCount: 3 },
      { id: "general", name: "General", color: "#6b7280", icon: "folder", promptCount: 2 },
    ];

    function getCategoryColor(categoryId: string): string {
      const category = categories.find((c) => c.id === categoryId);
      return category?.color || "var(--cortex-text-inactive)";
    }

    function getCategoryName(categoryId: string): string {
      const category = categories.find((c) => c.id === categoryId);
      return category?.name || "Unknown";
    }

    it("should find category color", () => {
      expect(getCategoryColor("coding")).toBe("#8b5cf6");
    });

    it("should return default color for unknown category", () => {
      expect(getCategoryColor("nonexistent")).toBe("var(--cortex-text-inactive)");
    });

    it("should find category name", () => {
      expect(getCategoryName("writing")).toBe("Writing");
    });

    it("should return Unknown for missing category", () => {
      expect(getCategoryName("nonexistent")).toBe("Unknown");
    });
  });

  describe("Prompt Filtering", () => {
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

    const prompts: SavedPrompt[] = [
      {
        id: "p1", title: "Code Review", content: "Review code", description: "Review",
        tags: ["code", "review"], category: "coding", isFavorite: true, usageCount: 10,
        createdAt: "2024-01-01", updatedAt: "2024-01-10",
      },
      {
        id: "p2", title: "Write Tests", content: "Write tests", description: "Testing",
        tags: ["code", "testing"], category: "coding", isFavorite: false, usageCount: 5,
        createdAt: "2024-01-02", updatedAt: "2024-01-05",
      },
      {
        id: "p3", title: "Blog Post", content: "Write blog", description: "Blog",
        tags: ["writing", "blog"], category: "writing", isFavorite: true, usageCount: 3,
        createdAt: "2024-01-03", updatedAt: "2024-01-03",
      },
    ];

    it("should filter by favorites only", () => {
      const favorites = prompts.filter((p) => p.isFavorite);
      expect(favorites).toHaveLength(2);
      expect(favorites.map((p) => p.id)).toContain("p1");
      expect(favorites.map((p) => p.id)).toContain("p3");
    });

    it("should filter by category", () => {
      const coding = prompts.filter((p) => p.category === "coding");
      expect(coding).toHaveLength(2);
    });

    it("should filter by tag", () => {
      const codeTagged = prompts.filter((p) => p.tags.includes("code"));
      expect(codeTagged).toHaveLength(2);
    });

    it("should filter by search query in title", () => {
      const query = "review";
      const filtered = prompts.filter(
        (p) => p.title.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("p1");
    });

    it("should combine multiple filters", () => {
      const filtered = prompts.filter(
        (p) => p.category === "coding" && p.isFavorite
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("p1");
    });
  });

  describe("Prompt Sorting", () => {
    interface SavedPrompt {
      id: string;
      title: string;
      usageCount: number;
      createdAt: string;
      updatedAt: string;
    }

    const prompts: SavedPrompt[] = [
      { id: "p1", title: "Bravo", usageCount: 5, createdAt: "2024-01-02", updatedAt: "2024-01-10" },
      { id: "p2", title: "Alpha", usageCount: 10, createdAt: "2024-01-01", updatedAt: "2024-01-05" },
      { id: "p3", title: "Charlie", usageCount: 3, createdAt: "2024-01-03", updatedAt: "2024-01-03" },
    ];

    it("should sort by title ascending", () => {
      const sorted = [...prompts].sort((a, b) => a.title.localeCompare(b.title));
      expect(sorted[0].title).toBe("Alpha");
      expect(sorted[2].title).toBe("Charlie");
    });

    it("should sort by title descending", () => {
      const sorted = [...prompts].sort((a, b) => b.title.localeCompare(a.title));
      expect(sorted[0].title).toBe("Charlie");
      expect(sorted[2].title).toBe("Alpha");
    });

    it("should sort by usage count descending", () => {
      const sorted = [...prompts].sort((a, b) => b.usageCount - a.usageCount);
      expect(sorted[0].id).toBe("p2");
      expect(sorted[2].id).toBe("p3");
    });

    it("should sort by createdAt ascending", () => {
      const sorted = [...prompts].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      expect(sorted[0].id).toBe("p2");
      expect(sorted[2].id).toBe("p3");
    });

    it("should sort by updatedAt descending", () => {
      const sorted = [...prompts].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      expect(sorted[0].id).toBe("p1");
      expect(sorted[2].id).toBe("p3");
    });
  });

  describe("Tag Extraction", () => {
    interface SavedPrompt {
      id: string;
      tags: string[];
    }

    it("should extract all unique tags", () => {
      const prompts: SavedPrompt[] = [
        { id: "p1", tags: ["code", "review"] },
        { id: "p2", tags: ["code", "testing"] },
        { id: "p3", tags: ["writing", "blog"] },
      ];

      const allTags = [...new Set(prompts.flatMap((p) => p.tags))];
      expect(allTags).toHaveLength(5);
      expect(allTags).toContain("code");
      expect(allTags).toContain("review");
      expect(allTags).toContain("testing");
      expect(allTags).toContain("writing");
      expect(allTags).toContain("blog");
    });

    it("should handle prompts with no tags", () => {
      const prompts: SavedPrompt[] = [
        { id: "p1", tags: [] },
      ];

      const allTags = [...new Set(prompts.flatMap((p) => p.tags))];
      expect(allTags).toHaveLength(0);
    });
  });

  describe("Export Data", () => {
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

    interface PromptExportData {
      version: string;
      exportedAt: string;
      prompts: SavedPrompt[];
      categories: PromptCategory[];
    }

    it("should create export data structure", () => {
      const exportData: PromptExportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        prompts: [],
        categories: [],
      };

      expect(exportData.version).toBe("1.0");
      expect(exportData.prompts).toHaveLength(0);
    });

    it("should include prompts and categories in export", () => {
      const exportData: PromptExportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        prompts: [
          {
            id: "p1", title: "Test", content: "Content", description: "Desc",
            tags: ["tag"], category: "general", isFavorite: false, usageCount: 0,
            createdAt: "2024-01-01", updatedAt: "2024-01-01",
          },
        ],
        categories: [
          { id: "general", name: "General", color: "#6b7280", icon: "folder", promptCount: 1 },
        ],
      };

      expect(exportData.prompts).toHaveLength(1);
      expect(exportData.categories).toHaveLength(1);
    });
  });
});

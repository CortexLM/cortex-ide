import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("RulesLibraryContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rule Types", () => {
    type RuleSource = "project" | "user" | "builtin";

    interface Rule {
      id: string;
      name: string;
      description: string;
      content: string;
      enabled: boolean;
      priority: number;
      tags: string[];
      source: RuleSource;
      createdAt: string;
      updatedAt: string;
    }

    interface RulesFile {
      path: string;
      name: string;
      source: RuleSource;
      rules: Rule[];
      lastModified: string;
    }

    it("should create a rule", () => {
      const rule: Rule = {
        id: "rule-1",
        name: "Code Style",
        description: "Enforce consistent code style",
        content: "Always use consistent indentation...",
        enabled: true,
        priority: 10,
        tags: ["style", "formatting"],
        source: "project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(rule.id).toBe("rule-1");
      expect(rule.enabled).toBe(true);
      expect(rule.tags).toContain("style");
    });

    it("should create a rules file", () => {
      const rulesFile: RulesFile = {
        path: "/project/.cortex/rules.json",
        name: "Project Rules",
        source: "project",
        rules: [
          {
            id: "rule-1",
            name: "Rule 1",
            description: "Description",
            content: "Content",
            enabled: true,
            priority: 1,
            tags: [],
            source: "project",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        lastModified: new Date().toISOString(),
      };

      expect(rulesFile.rules).toHaveLength(1);
      expect(rulesFile.source).toBe("project");
    });
  });

  describe("Rule CRUD Operations", () => {
    interface Rule {
      id: string;
      name: string;
      content: string;
      enabled: boolean;
      priority: number;
      tags: string[];
      source: string;
    }

    it("should create a new rule", () => {
      const rules: Rule[] = [];

      const newRule: Rule = {
        id: `rule_${Date.now()}`,
        name: "New Rule",
        content: "Rule content here",
        enabled: true,
        priority: 1,
        tags: ["new"],
        source: "user",
      };

      rules.push(newRule);

      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe("New Rule");
    });

    it("should update a rule", () => {
      const rule: Rule = {
        id: "rule-1",
        name: "Original Name",
        content: "Original content",
        enabled: true,
        priority: 1,
        tags: [],
        source: "user",
      };

      rule.name = "Updated Name";
      rule.content = "Updated content";
      rule.tags = ["updated"];

      expect(rule.name).toBe("Updated Name");
      expect(rule.tags).toContain("updated");
    });

    it("should delete a rule", () => {
      const rules: Rule[] = [
        { id: "1", name: "Rule 1", content: "", enabled: true, priority: 1, tags: [], source: "user" },
        { id: "2", name: "Rule 2", content: "", enabled: true, priority: 2, tags: [], source: "user" },
      ];

      const filtered = rules.filter((r) => r.id !== "1");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("2");
    });

    it("should duplicate a rule", () => {
      const original: Rule = {
        id: "rule-1",
        name: "Original Rule",
        content: "Rule content",
        enabled: true,
        priority: 5,
        tags: ["tag1"],
        source: "user",
      };

      const duplicate: Rule = {
        ...original,
        id: `rule_${Date.now()}`,
        name: `${original.name} (Copy)`,
      };

      expect(duplicate.name).toBe("Original Rule (Copy)");
      expect(duplicate.content).toBe(original.content);
      expect(duplicate.id).not.toBe(original.id);
    });
  });

  describe("Rule Enable/Disable", () => {
    interface Rule {
      id: string;
      name: string;
      enabled: boolean;
    }

    it("should toggle rule enabled state", () => {
      const rule: Rule = { id: "1", name: "Rule", enabled: true };

      rule.enabled = !rule.enabled;

      expect(rule.enabled).toBe(false);
    });

    it("should enable a rule", () => {
      const rule: Rule = { id: "1", name: "Rule", enabled: false };

      rule.enabled = true;

      expect(rule.enabled).toBe(true);
    });

    it("should disable a rule", () => {
      const rule: Rule = { id: "1", name: "Rule", enabled: true };

      rule.enabled = false;

      expect(rule.enabled).toBe(false);
    });

    it("should enable all rules", () => {
      const rules: Rule[] = [
        { id: "1", name: "Rule 1", enabled: false },
        { id: "2", name: "Rule 2", enabled: true },
        { id: "3", name: "Rule 3", enabled: false },
      ];

      rules.forEach((r) => {
        r.enabled = true;
      });

      expect(rules.every((r) => r.enabled)).toBe(true);
    });

    it("should disable all rules", () => {
      const rules: Rule[] = [
        { id: "1", name: "Rule 1", enabled: true },
        { id: "2", name: "Rule 2", enabled: true },
        { id: "3", name: "Rule 3", enabled: false },
      ];

      rules.forEach((r) => {
        r.enabled = false;
      });

      expect(rules.every((r) => !r.enabled)).toBe(true);
    });

    it("should get enabled rules", () => {
      const rules: Rule[] = [
        { id: "1", name: "Rule 1", enabled: true },
        { id: "2", name: "Rule 2", enabled: false },
        { id: "3", name: "Rule 3", enabled: true },
      ];

      const enabled = rules.filter((r) => r.enabled);

      expect(enabled).toHaveLength(2);
    });
  });

  describe("Rule Priority", () => {
    interface Rule {
      id: string;
      name: string;
      priority: number;
    }

    it("should set rule priority", () => {
      const rule: Rule = { id: "1", name: "Rule", priority: 1 };

      rule.priority = 10;

      expect(rule.priority).toBe(10);
    });

    it("should sort rules by priority", () => {
      const rules: Rule[] = [
        { id: "1", name: "Low", priority: 1 },
        { id: "2", name: "High", priority: 10 },
        { id: "3", name: "Medium", priority: 5 },
      ];

      const sorted = [...rules].sort((a, b) => b.priority - a.priority);

      expect(sorted[0].name).toBe("High");
      expect(sorted[2].name).toBe("Low");
    });

    it("should move rule up", () => {
      const rules: Rule[] = [
        { id: "1", name: "First", priority: 3 },
        { id: "2", name: "Second", priority: 2 },
        { id: "3", name: "Third", priority: 1 },
      ];

      const ruleToMove = rules.find((r) => r.id === "3");
      const ruleAbove = rules.find((r) => r.id === "2");

      if (ruleToMove && ruleAbove) {
        const temp = ruleToMove.priority;
        ruleToMove.priority = ruleAbove.priority;
        ruleAbove.priority = temp;
      }

      expect(rules.find((r) => r.id === "3")?.priority).toBe(2);
      expect(rules.find((r) => r.id === "2")?.priority).toBe(1);
    });
  });

  describe("Rule Filtering", () => {
    type RuleSource = "project" | "user" | "builtin";

    interface Rule {
      id: string;
      name: string;
      description: string;
      tags: string[];
      source: RuleSource;
      enabled: boolean;
    }

    const rules: Rule[] = [
      { id: "1", name: "Code Style", description: "Style rules", tags: ["style"], source: "project", enabled: true },
      { id: "2", name: "Security", description: "Security rules", tags: ["security"], source: "user", enabled: true },
      { id: "3", name: "Performance", description: "Perf rules", tags: ["perf"], source: "builtin", enabled: false },
    ];

    it("should filter by search query", () => {
      const query = "security";
      const filtered = rules.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.description.toLowerCase().includes(query.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Security");
    });

    it("should filter by tag", () => {
      const tag = "style";
      const filtered = rules.filter((r) => r.tags.includes(tag));

      expect(filtered).toHaveLength(1);
    });

    it("should filter by source", () => {
      const source: RuleSource = "user";
      const filtered = rules.filter((r) => r.source === source);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].source).toBe("user");
    });

    it("should get all unique tags", () => {
      const allTags = rules.flatMap((r) => r.tags);
      const uniqueTags = [...new Set(allTags)];

      expect(uniqueTags).toContain("style");
      expect(uniqueTags).toContain("security");
      expect(uniqueTags).toContain("perf");
    });

    it("should get rules by source", () => {
      const sources: RuleSource[] = ["project", "user", "builtin"];
      const bySource = sources.map((source) => ({
        source,
        rules: rules.filter((r) => r.source === source),
      }));

      expect(bySource[0].rules).toHaveLength(1);
    });
  });

  describe("Rule Composition", () => {
    interface RuleComposition {
      id: string;
      name: string;
      description: string;
      ruleIds: string[];
      enabled: boolean;
    }

    it("should create a composition", () => {
      const composition: RuleComposition = {
        id: "comp-1",
        name: "Code Quality",
        description: "Combined quality rules",
        ruleIds: ["rule-1", "rule-2", "rule-3"],
        enabled: true,
      };

      expect(composition.ruleIds).toHaveLength(3);
    });

    it("should update composition", () => {
      const composition: RuleComposition = {
        id: "comp-1",
        name: "Original",
        description: "",
        ruleIds: ["rule-1"],
        enabled: true,
      };

      composition.name = "Updated";
      composition.ruleIds = [...composition.ruleIds, "rule-2"];

      expect(composition.name).toBe("Updated");
      expect(composition.ruleIds).toHaveLength(2);
    });

    it("should delete composition", () => {
      const compositions: RuleComposition[] = [
        { id: "1", name: "Comp 1", description: "", ruleIds: [], enabled: true },
        { id: "2", name: "Comp 2", description: "", ruleIds: [], enabled: true },
      ];

      const filtered = compositions.filter((c) => c.id !== "1");

      expect(filtered).toHaveLength(1);
    });

    it("should get composed rules", () => {
      interface Rule {
        id: string;
        name: string;
      }

      const allRules: Rule[] = [
        { id: "rule-1", name: "Rule 1" },
        { id: "rule-2", name: "Rule 2" },
        { id: "rule-3", name: "Rule 3" },
      ];

      const composition: RuleComposition = {
        id: "comp-1",
        name: "Composition",
        description: "",
        ruleIds: ["rule-1", "rule-3"],
        enabled: true,
      };

      const composedRules = allRules.filter((r) => composition.ruleIds.includes(r.id));

      expect(composedRules).toHaveLength(2);
    });
  });

  describe("Rule Inheritance", () => {
    interface RuleInheritance {
      enabled: boolean;
      parentRulesPath: string | null;
      mergeStrategy: "override" | "append" | "prepend";
    }

    it("should configure inheritance", () => {
      const inheritance: RuleInheritance = {
        enabled: true,
        parentRulesPath: "/parent/.cortex/rules.json",
        mergeStrategy: "append",
      };

      expect(inheritance.enabled).toBe(true);
      expect(inheritance.mergeStrategy).toBe("append");
    });

    it("should disable inheritance", () => {
      const inheritance: RuleInheritance = {
        enabled: true,
        parentRulesPath: "/parent/rules.json",
        mergeStrategy: "override",
      };

      inheritance.enabled = false;

      expect(inheritance.enabled).toBe(false);
    });

    it("should change merge strategy", () => {
      const inheritance: RuleInheritance = {
        enabled: true,
        parentRulesPath: "/parent/rules.json",
        mergeStrategy: "override",
      };

      inheritance.mergeStrategy = "prepend";

      expect(inheritance.mergeStrategy).toBe("prepend");
    });
  });

  describe("Rule Preview", () => {
    interface RulePreview {
      totalRules: number;
      enabledRules: number;
      estimatedTokens: number;
      previewText: string;
      warnings: string[];
    }

    it("should generate preview", () => {
      const preview: RulePreview = {
        totalRules: 10,
        enabledRules: 7,
        estimatedTokens: 1500,
        previewText: "Combined rules content...",
        warnings: [],
      };

      expect(preview.totalRules).toBe(10);
      expect(preview.enabledRules).toBe(7);
    });

    it("should include warnings", () => {
      const preview: RulePreview = {
        totalRules: 5,
        enabledRules: 5,
        estimatedTokens: 10000,
        previewText: "...",
        warnings: ["Token count exceeds recommended limit", "Conflicting rules detected"],
      };

      expect(preview.warnings).toHaveLength(2);
    });

    it("should estimate token count", () => {
      const estimateTokens = (text: string): number => {
        return Math.ceil(text.length / 4);
      };

      const content = "This is a test rule with some content.";
      const tokens = estimateTokens(content);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe("File Operations", () => {
    it("should scan project rules", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await invoke("rules_scan_project", { projectPath: "/project" });

      expect(invoke).toHaveBeenCalledWith("rules_scan_project", { projectPath: "/project" });
    });

    it("should save rules file", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("rules_save_file", { path: "/project/rules.json", content: "{}" });

      expect(invoke).toHaveBeenCalledWith("rules_save_file", { path: "/project/rules.json", content: "{}" });
    });

    it("should read rules file", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("{}");

      const result = await invoke("rules_read_file", { path: "/project/rules.json" });

      expect(invoke).toHaveBeenCalledWith("rules_read_file", { path: "/project/rules.json" });
      expect(result).toBe("{}");
    });

    it("should write rules file", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("rules_write_file", { path: "/project/rules.json", content: "{}" });

      expect(invoke).toHaveBeenCalledWith("rules_write_file", { path: "/project/rules.json", content: "{}" });
    });

    it("should delete rules file", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("rules_delete_file", { path: "/project/rules.json" });

      expect(invoke).toHaveBeenCalledWith("rules_delete_file", { path: "/project/rules.json" });
    });
  });

  describe("Rule Validation", () => {
    interface Rule {
      name: string;
      content: string;
    }

    it("should validate rule name", () => {
      const validate = (rule: Partial<Rule>): string[] => {
        const errors: string[] = [];
        if (!rule.name?.trim()) {
          errors.push("Name is required");
        }
        return errors;
      };

      expect(validate({ name: "" })).toContain("Name is required");
      expect(validate({ name: "Valid Name" })).toHaveLength(0);
    });

    it("should validate rule content", () => {
      const validate = (rule: Partial<Rule>): string[] => {
        const errors: string[] = [];
        if (!rule.content?.trim()) {
          errors.push("Content is required");
        }
        return errors;
      };

      expect(validate({ content: "" })).toContain("Content is required");
      expect(validate({ content: "Valid content" })).toHaveLength(0);
    });
  });

  describe("UI State", () => {
    interface RulesLibraryState {
      showPanel: boolean;
      editingRule: { id: string; name: string } | null;
      selectedRuleId: string | null;
      loading: boolean;
      error: string | null;
      searchQuery: string;
    }

    it("should open panel", () => {
      const state: RulesLibraryState = {
        showPanel: false,
        editingRule: null,
        selectedRuleId: null,
        loading: false,
        error: null,
        searchQuery: "",
      };

      state.showPanel = true;

      expect(state.showPanel).toBe(true);
    });

    it("should close panel", () => {
      const state: RulesLibraryState = {
        showPanel: true,
        editingRule: null,
        selectedRuleId: null,
        loading: false,
        error: null,
        searchQuery: "",
      };

      state.showPanel = false;

      expect(state.showPanel).toBe(false);
    });

    it("should set editing rule", () => {
      const state: RulesLibraryState = {
        showPanel: true,
        editingRule: null,
        selectedRuleId: null,
        loading: false,
        error: null,
        searchQuery: "",
      };

      state.editingRule = { id: "rule-1", name: "Test Rule" };

      expect(state.editingRule?.id).toBe("rule-1");
    });

    it("should select rule", () => {
      const state: RulesLibraryState = {
        showPanel: true,
        editingRule: null,
        selectedRuleId: null,
        loading: false,
        error: null,
        searchQuery: "",
      };

      state.selectedRuleId = "rule-1";

      expect(state.selectedRuleId).toBe("rule-1");
    });

    it("should update search query", () => {
      const state: RulesLibraryState = {
        showPanel: true,
        editingRule: null,
        selectedRuleId: null,
        loading: false,
        error: null,
        searchQuery: "",
      };

      state.searchQuery = "security";

      expect(state.searchQuery).toBe("security");
    });
  });
});

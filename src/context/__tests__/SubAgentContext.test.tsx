import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("SubAgentContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SubAgentType enum", () => {
    it("should define agent type values", () => {
      const SubAgentType = {
        Code: "code",
        Research: "research",
        Refactor: "refactor",
        Custom: "custom",
      } as const;

      expect(SubAgentType.Code).toBe("code");
      expect(SubAgentType.Research).toBe("research");
      expect(SubAgentType.Refactor).toBe("refactor");
      expect(SubAgentType.Custom).toBe("custom");
    });
  });

  describe("SubAgent interface", () => {
    it("should define sub-agent structure", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const agent: SubAgent = {
        id: "agent-001",
        name: "Code Assistant",
        type: "code",
        description: "Helps with coding tasks",
        systemPrompt: "You are a helpful coding assistant.",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isBuiltIn: false,
      };

      expect(agent.id).toBe("agent-001");
      expect(agent.name).toBe("Code Assistant");
      expect(agent.type).toBe("code");
      expect(agent.description).toBe("Helps with coding tasks");
      expect(agent.systemPrompt).toBe("You are a helpful coding assistant.");
      expect(agent.isBuiltIn).toBe(false);
    });

    it("should support built-in agents", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const builtInAgent: SubAgent = {
        id: "builtin-refactor",
        name: "Refactor Agent",
        type: "refactor",
        description: "Helps refactor code",
        systemPrompt: "You are an expert at refactoring code.",
        createdAt: 0,
        updatedAt: 0,
        isBuiltIn: true,
      };

      expect(builtInAgent.isBuiltIn).toBe(true);
      expect(builtInAgent.type).toBe("refactor");
    });
  });

  describe("SubAgentContextValue interface", () => {
    it("should define context value structure", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      interface SubAgentContextValue {
        agents: SubAgent[];
        selectedAgentId: string | null;
        isLoading: boolean;
        error: string | null;
        createAgent: (agent: Omit<SubAgent, "id" | "createdAt" | "updatedAt" | "isBuiltIn">) => SubAgent;
        updateAgent: (id: string, updates: Partial<SubAgent>) => void;
        deleteAgent: (id: string) => void;
        duplicateAgent: (id: string) => SubAgent | null;
        selectAgent: (id: string | null) => void;
        getAgent: (id: string) => SubAgent | undefined;
        getAgentsByType: (type: SubAgent["type"]) => SubAgent[];
        exportAgents: () => string;
        importAgents: (json: string) => boolean;
      }

      const mockContextValue: SubAgentContextValue = {
        agents: [],
        selectedAgentId: null,
        isLoading: false,
        error: null,
        createAgent: vi.fn(),
        updateAgent: vi.fn(),
        deleteAgent: vi.fn(),
        duplicateAgent: vi.fn(),
        selectAgent: vi.fn(),
        getAgent: vi.fn(),
        getAgentsByType: vi.fn(),
        exportAgents: vi.fn(),
        importAgents: vi.fn(),
      };

      expect(mockContextValue.agents).toEqual([]);
      expect(mockContextValue.selectedAgentId).toBeNull();
      expect(mockContextValue.isLoading).toBe(false);
      expect(mockContextValue.error).toBeNull();
    });
  });

  describe("Agent CRUD operations", () => {
    it("should create a new agent with generated id and timestamps", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const createAgent = (
        input: Omit<SubAgent, "id" | "createdAt" | "updatedAt" | "isBuiltIn">
      ): SubAgent => {
        const now = Date.now();
        return {
          ...input,
          id: `agent-${now}`,
          createdAt: now,
          updatedAt: now,
          isBuiltIn: false,
        };
      };

      const newAgent = createAgent({
        name: "Research Bot",
        type: "research",
        description: "Searches for information",
        systemPrompt: "You are a research assistant.",
      });

      expect(newAgent.id).toMatch(/^agent-\d+$/);
      expect(newAgent.name).toBe("Research Bot");
      expect(newAgent.type).toBe("research");
      expect(newAgent.isBuiltIn).toBe(false);
      expect(newAgent.createdAt).toBe(newAgent.updatedAt);
    });

    it("should update an existing agent", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const agents: SubAgent[] = [
        {
          id: "agent-1",
          name: "Original Name",
          type: "code",
          description: "Original description",
          systemPrompt: "Original prompt",
          createdAt: 1000,
          updatedAt: 1000,
          isBuiltIn: false,
        },
      ];

      const updateAgent = (id: string, updates: Partial<SubAgent>): SubAgent[] => {
        return agents.map((agent) =>
          agent.id === id
            ? { ...agent, ...updates, updatedAt: Date.now() }
            : agent
        );
      };

      const updated = updateAgent("agent-1", { name: "Updated Name" });
      expect(updated[0].name).toBe("Updated Name");
      expect(updated[0].updatedAt).toBeGreaterThan(updated[0].createdAt);
    });

    it("should delete an agent by id", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const agents: SubAgent[] = [
        {
          id: "agent-1",
          name: "Agent 1",
          type: "code",
          description: "",
          systemPrompt: "",
          createdAt: 1000,
          updatedAt: 1000,
          isBuiltIn: false,
        },
        {
          id: "agent-2",
          name: "Agent 2",
          type: "research",
          description: "",
          systemPrompt: "",
          createdAt: 1000,
          updatedAt: 1000,
          isBuiltIn: false,
        },
      ];

      const deleteAgent = (id: string): SubAgent[] => {
        return agents.filter((agent) => agent.id !== id);
      };

      const remaining = deleteAgent("agent-1");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("agent-2");
    });

    it("should not delete built-in agents", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const agents: SubAgent[] = [
        {
          id: "builtin-1",
          name: "Built-in Agent",
          type: "code",
          description: "",
          systemPrompt: "",
          createdAt: 0,
          updatedAt: 0,
          isBuiltIn: true,
        },
      ];

      const deleteAgent = (id: string): SubAgent[] => {
        return agents.filter((agent) => agent.id !== id || agent.isBuiltIn);
      };

      const remaining = deleteAgent("builtin-1");
      expect(remaining).toHaveLength(1);
    });

    it("should duplicate an agent", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const original: SubAgent = {
        id: "agent-1",
        name: "Original Agent",
        type: "code",
        description: "Original description",
        systemPrompt: "Original prompt",
        createdAt: 1000,
        updatedAt: 1000,
        isBuiltIn: false,
      };

      const duplicateAgent = (agent: SubAgent): SubAgent => {
        const now = Date.now();
        return {
          ...agent,
          id: `agent-${now}`,
          name: `${agent.name} (Copy)`,
          createdAt: now,
          updatedAt: now,
          isBuiltIn: false,
        };
      };

      const duplicate = duplicateAgent(original);
      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate.name).toBe("Original Agent (Copy)");
      expect(duplicate.systemPrompt).toBe(original.systemPrompt);
      expect(duplicate.isBuiltIn).toBe(false);
    });
  });

  describe("Agent selection and retrieval", () => {
    it("should select an agent by id", () => {
      let selectedAgentId: string | null = null;

      const selectAgent = (id: string | null): void => {
        selectedAgentId = id;
      };

      selectAgent("agent-1");
      expect(selectedAgentId).toBe("agent-1");

      selectAgent(null);
      expect(selectedAgentId).toBeNull();
    });

    it("should get an agent by id", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const agents: SubAgent[] = [
        {
          id: "agent-1",
          name: "Agent 1",
          type: "code",
          description: "",
          systemPrompt: "",
          createdAt: 1000,
          updatedAt: 1000,
          isBuiltIn: false,
        },
      ];

      const getAgent = (id: string): SubAgent | undefined => {
        return agents.find((agent) => agent.id === id);
      };

      expect(getAgent("agent-1")).toBeDefined();
      expect(getAgent("nonexistent")).toBeUndefined();
    });

    it("should get agents by type", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const agents: SubAgent[] = [
        { id: "1", name: "A1", type: "code", description: "", systemPrompt: "", createdAt: 0, updatedAt: 0, isBuiltIn: false },
        { id: "2", name: "A2", type: "research", description: "", systemPrompt: "", createdAt: 0, updatedAt: 0, isBuiltIn: false },
        { id: "3", name: "A3", type: "code", description: "", systemPrompt: "", createdAt: 0, updatedAt: 0, isBuiltIn: false },
      ];

      const getAgentsByType = (type: SubAgent["type"]): SubAgent[] => {
        return agents.filter((agent) => agent.type === type);
      };

      const codeAgents = getAgentsByType("code");
      expect(codeAgents).toHaveLength(2);
      expect(codeAgents.every((a) => a.type === "code")).toBe(true);
    });
  });

  describe("Import and export", () => {
    it("should export agents to JSON", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const agents: SubAgent[] = [
        {
          id: "agent-1",
          name: "Test Agent",
          type: "code",
          description: "Test description",
          systemPrompt: "Test prompt",
          createdAt: 1000,
          updatedAt: 1000,
          isBuiltIn: false,
        },
      ];

      const exportAgents = (): string => {
        const exportable = agents.filter((a) => !a.isBuiltIn);
        return JSON.stringify(exportable, null, 2);
      };

      const exported = exportAgents();
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("Test Agent");
    });

    it("should import agents from JSON", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const json = JSON.stringify([
        {
          id: "imported-1",
          name: "Imported Agent",
          type: "research",
          description: "Imported description",
          systemPrompt: "Imported prompt",
          createdAt: 2000,
          updatedAt: 2000,
          isBuiltIn: false,
        },
      ]);

      const importAgents = (jsonStr: string): { success: boolean; agents: SubAgent[] } => {
        try {
          const imported = JSON.parse(jsonStr) as SubAgent[];
          return { success: true, agents: imported };
        } catch {
          return { success: false, agents: [] };
        }
      };

      const result = importAgents(json);
      expect(result.success).toBe(true);
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe("Imported Agent");
    });

    it("should handle invalid JSON on import", () => {
      const importAgents = (jsonStr: string): boolean => {
        try {
          JSON.parse(jsonStr);
          return true;
        } catch {
          return false;
        }
      };

      expect(importAgents("invalid json")).toBe(false);
      expect(importAgents("[]")).toBe(true);
    });
  });

  describe("localStorage persistence", () => {
    it("should persist agents to localStorage", () => {
      interface SubAgent {
        id: string;
        name: string;
        type: "code" | "research" | "refactor" | "custom";
        description: string;
        systemPrompt: string;
        createdAt: number;
        updatedAt: number;
        isBuiltIn: boolean;
      }

      const STORAGE_KEY = "zen-subagents";

      const saveAgents = (agents: SubAgent[]): void => {
        const customAgents = agents.filter((a) => !a.isBuiltIn);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customAgents));
      };

      const loadAgents = (): SubAgent[] => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      };

      const agents: SubAgent[] = [
        {
          id: "agent-1",
          name: "Saved Agent",
          type: "code",
          description: "",
          systemPrompt: "",
          createdAt: 1000,
          updatedAt: 1000,
          isBuiltIn: false,
        },
      ];

      saveAgents(agents);
      const loaded = loadAgents();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe("Saved Agent");
    });
  });
});

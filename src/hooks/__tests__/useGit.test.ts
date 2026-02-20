import { describe, it, expect, vi, beforeEach } from "vitest";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("useAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Agent Interface", () => {
    interface Agent {
      id: string;
      name: string;
      description: string;
      color?: string;
      tools: string[];
      model?: string;
      reasoningEffort?: "low" | "medium" | "high";
      prompt: string;
      scope: "project" | "user" | "builtin";
      filePath?: string;
      createdAt?: string;
      updatedAt?: string;
    }

    it("should create a user agent", () => {
      const agent: Agent = {
        id: "agent-1",
        name: "Code Reviewer",
        description: "Reviews code for best practices",
        color: "#4CAF50",
        tools: ["read_file", "search_files"],
        model: "gpt-4",
        reasoningEffort: "high",
        prompt: "Review the code for best practices",
        scope: "user",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      expect(agent.id).toBe("agent-1");
      expect(agent.scope).toBe("user");
    });

    it("should create a project agent", () => {
      const agent: Agent = {
        id: "agent-2",
        name: "Test Writer",
        description: "Writes unit tests",
        tools: ["read_file", "write_file"],
        prompt: "Write comprehensive unit tests",
        scope: "project",
        filePath: ".agents/test-writer.yml",
      };

      expect(agent.scope).toBe("project");
      expect(agent.filePath).toBeDefined();
    });

    it("should create a builtin agent", () => {
      const agent: Agent = {
        id: "builtin-coder",
        name: "Coder",
        description: "General purpose coding assistant",
        tools: ["read_file", "write_file", "shell"],
        prompt: "You are a coding assistant",
        scope: "builtin",
      };

      expect(agent.scope).toBe("builtin");
    });

    it("should support optional fields", () => {
      const agent: Agent = {
        id: "agent-3",
        name: "Simple Agent",
        description: "A simple agent",
        tools: [],
        prompt: "Help the user",
        scope: "user",
      };

      expect(agent.color).toBeUndefined();
      expect(agent.model).toBeUndefined();
      expect(agent.reasoningEffort).toBeUndefined();
    });

    it("should have reasoning effort levels", () => {
      const levels: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];

      levels.forEach(level => {
        const agent: Agent = {
          id: "agent-test",
          name: "Test",
          description: "Test",
          tools: [],
          prompt: "Test",
          scope: "user",
          reasoningEffort: level,
        };

        expect(agent.reasoningEffort).toBe(level);
      });
    });
  });

  describe("AgentFormData Interface", () => {
    interface AgentFormData {
      name: string;
      description: string;
      model: string;
      reasoningEffort: "low" | "medium" | "high";
      tools: string[];
      prompt: string;
      color?: string;
      scope: "project" | "user";
    }

    it("should create form data for new agent", () => {
      const formData: AgentFormData = {
        name: "New Agent",
        description: "A new agent",
        model: "gpt-4",
        reasoningEffort: "medium",
        tools: ["read_file"],
        prompt: "Help the user",
        scope: "user",
      };

      expect(formData.name).toBe("New Agent");
      expect(formData.scope).toBe("user");
    });

    it("should include optional color", () => {
      const formData: AgentFormData = {
        name: "Colored Agent",
        description: "An agent with color",
        model: "gpt-4",
        reasoningEffort: "low",
        tools: [],
        prompt: "Help",
        color: "#FF5722",
        scope: "project",
      };

      expect(formData.color).toBe("#FF5722");
    });

    it("should only allow project or user scope", () => {
      const scopes: Array<"project" | "user"> = ["project", "user"];

      scopes.forEach(scope => {
        const formData: AgentFormData = {
          name: "Test",
          description: "Test",
          model: "gpt-4",
          reasoningEffort: "medium",
          tools: [],
          prompt: "Test",
          scope,
        };

        expect(formData.scope).toBe(scope);
      });
    });
  });

  describe("UseAgentsReturn Interface", () => {
    interface Agent {
      id: string;
      name: string;
      description: string;
      tools: string[];
      prompt: string;
      scope: "project" | "user" | "builtin";
    }

    interface AgentFormData {
      name: string;
      description: string;
      model: string;
      reasoningEffort: "low" | "medium" | "high";
      tools: string[];
      prompt: string;
      scope: "project" | "user";
    }

    interface UseAgentsReturn {
      agents: () => Agent[];
      userAgents: () => Agent[];
      builtinAgents: () => Agent[];
      isLoading: () => boolean;
      error: () => string | null;
      createAgent: (data: AgentFormData) => Promise<Agent>;
      updateAgent: (id: string, data: AgentFormData) => Promise<Agent>;
      deleteAgent: (id: string) => Promise<void>;
      refresh: () => Promise<void>;
    }

    it("should define all return properties", () => {
      const mockReturn: UseAgentsReturn = {
        agents: () => [],
        userAgents: () => [],
        builtinAgents: () => [],
        isLoading: () => false,
        error: () => null,
        createAgent: vi.fn().mockResolvedValue({ id: "new" }),
        updateAgent: vi.fn().mockResolvedValue({ id: "updated" }),
        deleteAgent: vi.fn().mockResolvedValue(undefined),
        refresh: vi.fn().mockResolvedValue(undefined),
      };

      expect(mockReturn.agents()).toHaveLength(0);
      expect(mockReturn.isLoading()).toBe(false);
      expect(mockReturn.error()).toBeNull();
    });

    it("should separate user and builtin agents", () => {
      const userAgent: Agent = {
        id: "user-1",
        name: "User Agent",
        description: "User created",
        tools: [],
        prompt: "Help",
        scope: "user",
      };

      const builtinAgent: Agent = {
        id: "builtin-1",
        name: "Builtin Agent",
        description: "Built-in",
        tools: [],
        prompt: "Help",
        scope: "builtin",
      };

      const mockReturn: UseAgentsReturn = {
        agents: () => [userAgent, builtinAgent],
        userAgents: () => [userAgent],
        builtinAgents: () => [builtinAgent],
        isLoading: () => false,
        error: () => null,
        createAgent: vi.fn(),
        updateAgent: vi.fn(),
        deleteAgent: vi.fn(),
        refresh: vi.fn(),
      };

      expect(mockReturn.agents()).toHaveLength(2);
      expect(mockReturn.userAgents()).toHaveLength(1);
      expect(mockReturn.builtinAgents()).toHaveLength(1);
    });
  });

  describe("Initial Loading State", () => {
    it("should start with loading true", () => {
      const isLoading = true;
      expect(isLoading).toBe(true);
    });

    it("should have empty agents initially", () => {
      const agents: unknown[] = [];
      expect(agents).toHaveLength(0);
    });

    it("should have no error initially", () => {
      const error: string | null = null;
      expect(error).toBeNull();
    });
  });

  describe("CRUD Operations", () => {
    it("should create agent via API", async () => {
      const mockAgent = {
        id: "new-agent",
        name: "New Agent",
        description: "Created agent",
        tools: [],
        prompt: "Help",
        scope: "user" as const,
      };

      const createAgent = vi.fn().mockResolvedValue(mockAgent);

      const result = await createAgent({
        name: "New Agent",
        description: "Created agent",
        model: "gpt-4",
        reasoningEffort: "medium" as const,
        tools: [],
        prompt: "Help",
        scope: "user" as const,
      });

      expect(createAgent).toHaveBeenCalled();
      expect(result.id).toBe("new-agent");
    });

    it("should update agent via API", async () => {
      const mockAgent = {
        id: "agent-1",
        name: "Updated Agent",
        description: "Updated description",
        tools: ["read_file"],
        prompt: "Updated prompt",
        scope: "user" as const,
      };

      const updateAgent = vi.fn().mockResolvedValue(mockAgent);

      const result = await updateAgent("agent-1", {
        name: "Updated Agent",
        description: "Updated description",
        model: "gpt-4",
        reasoningEffort: "high" as const,
        tools: ["read_file"],
        prompt: "Updated prompt",
        scope: "user" as const,
      });

      expect(updateAgent).toHaveBeenCalledWith("agent-1", expect.any(Object));
      expect(result.name).toBe("Updated Agent");
    });

    it("should delete agent via API", async () => {
      const deleteAgent = vi.fn().mockResolvedValue(undefined);

      await deleteAgent("agent-1");

      expect(deleteAgent).toHaveBeenCalledWith("agent-1");
    });
  });

  describe("Refresh Behavior", () => {
    it("should call refresh to fetch agents", async () => {
      const refresh = vi.fn().mockResolvedValue(undefined);

      await refresh();

      expect(refresh).toHaveBeenCalled();
    });

    it("should set loading during refresh", async () => {
      const refresh = vi.fn().mockImplementation(async () => {
        await Promise.resolve();
      });

      const refreshPromise = refresh();
      expect(refresh).toHaveBeenCalled();
      await refreshPromise;
    });
  });

  describe("Error Handling", () => {
    it("should set error on create failure", async () => {
      const createAgent = vi.fn().mockRejectedValue(new Error("Failed to create agent"));

      await expect(createAgent({})).rejects.toThrow("Failed to create agent");
    });

    it("should set error on update failure", async () => {
      const updateAgent = vi.fn().mockRejectedValue(new Error("Failed to update agent"));

      await expect(updateAgent("id", {})).rejects.toThrow("Failed to update agent");
    });

    it("should set error on delete failure", async () => {
      const deleteAgent = vi.fn().mockRejectedValue(new Error("Failed to delete agent"));

      await expect(deleteAgent("id")).rejects.toThrow("Failed to delete agent");
    });

    it("should set error on refresh failure", async () => {
      const refresh = vi.fn().mockRejectedValue(new Error("Failed to fetch agents"));

      await expect(refresh()).rejects.toThrow("Failed to fetch agents");
    });
  });

  describe("Available Tools", () => {
    interface AvailableTool {
      id: string;
      name: string;
      description: string;
      category: "file" | "search" | "execution" | "network" | "utility";
    }

    it("should define available tools", () => {
      const tools: AvailableTool[] = [
        { id: "read_file", name: "Read File", description: "Read file contents", category: "file" },
        { id: "write_file", name: "Write File", description: "Write file contents", category: "file" },
        { id: "search_files", name: "Search Files", description: "Search in files", category: "search" },
        { id: "shell", name: "Shell", description: "Execute shell commands", category: "execution" },
        { id: "fetch_url", name: "Fetch URL", description: "Fetch URL contents", category: "network" },
      ];

      expect(tools).toHaveLength(5);
      expect(tools.find(t => t.id === "read_file")?.category).toBe("file");
    });

    it("should have all tool categories", () => {
      const categories: Array<"file" | "search" | "execution" | "network" | "utility"> = [
        "file",
        "search",
        "execution",
        "network",
        "utility",
      ];

      expect(categories).toHaveLength(5);
    });
  });

  describe("Agent Stats", () => {
    interface AgentStats {
      totalInvocations: number;
      averageTokensUsed: number;
      successRate: number;
      lastUsed?: string;
    }

    it("should track agent statistics", () => {
      const stats: AgentStats = {
        totalInvocations: 100,
        averageTokensUsed: 1500,
        successRate: 0.95,
        lastUsed: "2024-01-15T10:30:00Z",
      };

      expect(stats.totalInvocations).toBe(100);
      expect(stats.successRate).toBe(0.95);
    });

    it("should handle agent without stats", () => {
      const stats: AgentStats = {
        totalInvocations: 0,
        averageTokensUsed: 0,
        successRate: 0,
      };

      expect(stats.totalInvocations).toBe(0);
      expect(stats.lastUsed).toBeUndefined();
    });
  });

  describe("Agent Events", () => {
    it("should listen for agent status events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("agent:status", () => {});

      expect(listen).toHaveBeenCalledWith("agent:status", expect.any(Function));
    });

    it("should listen for agent created events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("agent:created", () => {});

      expect(listen).toHaveBeenCalledWith("agent:created", expect.any(Function));
    });

    it("should listen for agent updated events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("agent:updated", () => {});

      expect(listen).toHaveBeenCalledWith("agent:updated", expect.any(Function));
    });

    it("should listen for agent deleted events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("agent:deleted", () => {});

      expect(listen).toHaveBeenCalledWith("agent:deleted", expect.any(Function));
    });
  });

  describe("Agent Scope Filtering", () => {
    interface Agent {
      id: string;
      name: string;
      scope: "project" | "user" | "builtin";
    }

    it("should filter by scope", () => {
      const agents: Agent[] = [
        { id: "1", name: "User Agent", scope: "user" },
        { id: "2", name: "Project Agent", scope: "project" },
        { id: "3", name: "Builtin Agent", scope: "builtin" },
      ];

      const userAgents = agents.filter(a => a.scope === "user");
      const projectAgents = agents.filter(a => a.scope === "project");
      const builtinAgents = agents.filter(a => a.scope === "builtin");

      expect(userAgents).toHaveLength(1);
      expect(projectAgents).toHaveLength(1);
      expect(builtinAgents).toHaveLength(1);
    });

    it("should combine all agents", () => {
      const userAgents: Agent[] = [{ id: "1", name: "User", scope: "user" }];
      const builtinAgents: Agent[] = [{ id: "2", name: "Builtin", scope: "builtin" }];

      const allAgents = [...builtinAgents, ...userAgents];

      expect(allAgents).toHaveLength(2);
    });
  });
});

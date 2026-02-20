import { createSignal, createEffect } from "solid-js";
import type { Agent, AgentFormData } from "@/types/agents";
import {
  fetchUserAgents,
  fetchBuiltinAgents,
  createAgent as apiCreateAgent,
  updateAgent as apiUpdateAgent,
  deleteAgent as apiDeleteAgent,
} from "@/api/agents";

interface UseAgentsReturn {
  /** All agents (user + builtin) */
  agents: () => Agent[];
  /** User-defined agents only */
  userAgents: () => Agent[];
  /** Built-in agents only */
  builtinAgents: () => Agent[];
  /** Whether we're currently loading */
  isLoading: () => boolean;
  /** Any error that occurred */
  error: () => string | null;
  /** Create a new agent */
  createAgent: (data: AgentFormData) => Promise<Agent>;
  /** Update an existing agent */
  updateAgent: (id: string, data: AgentFormData) => Promise<Agent>;
  /** Delete an agent */
  deleteAgent: (id: string) => Promise<void>;
  /** Refresh the agent list */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing agents
 */
export function useAgents(): UseAgentsReturn {
  const [userAgents, setUserAgents] = createSignal<Agent[]>([]);
  const [builtinAgents, setBuiltinAgents] = createSignal<Agent[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // All agents combined
  const agents = () => [...builtinAgents(), ...userAgents()];

  // Fetch all agents
  const refresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [userResult, builtinResult] = await Promise.all([
        fetchUserAgents().catch(() => []),
        fetchBuiltinAgents().catch(() => []),
      ]);

      setUserAgents(userResult);
      setBuiltinAgents(builtinResult.map((a) => ({ ...a, scope: "builtin" as const })));
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to fetch agents";
      setError(err);
      console.error("[useAgents] Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new agent
  const createAgent = async (data: AgentFormData): Promise<Agent> => {
    try {
      const agent = await apiCreateAgent(data);
      // Refresh list to include new agent
      await refresh();
      return agent;
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to create agent";
      setError(err);
      throw new Error(err);
    }
  };

  // Update an existing agent
  const updateAgent = async (id: string, data: AgentFormData): Promise<Agent> => {
    try {
      const agent = await apiUpdateAgent(id, data);
      // Update local state
      setUserAgents((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...agent } : a))
      );
      return agent;
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to update agent";
      setError(err);
      throw new Error(err);
    }
  };

  // Delete an agent
  const deleteAgent = async (id: string): Promise<void> => {
    try {
      await apiDeleteAgent(id);
      // Remove from local state
      setUserAgents((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to delete agent";
      setError(err);
      throw new Error(err);
    }
  };

  // Initial fetch
  createEffect(() => {
    refresh();
  });

  return {
    agents,
    userAgents,
    builtinAgents,
    isLoading,
    error,
    createAgent,
    updateAgent,
    deleteAgent,
    refresh,
  };
}

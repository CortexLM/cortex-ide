/**
 * API functions for agent management
 */

import type { Agent, AgentFormData, AvailableTool, AgentStats } from "@/types/agents";

const API_BASE = "/api/v1";

/**
 * Fetch all user agents
 */
export async function fetchUserAgents(): Promise<Agent[]> {
  const response = await fetch(`${API_BASE}/agents`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch agents");
  }
  
  return response.json();
}

/**
 * Fetch a single agent by ID
 */
export async function fetchAgent(agentId: string): Promise<Agent> {
  const response = await fetch(`${API_BASE}/agents/${agentId}`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch agent");
  }
  
  return response.json();
}

/**
 * Create a new agent
 */
export async function createAgent(data: AgentFormData): Promise<Agent> {
  const response = await fetch(`${API_BASE}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error("Failed to create agent");
  }
  
  return response.json();
}

/**
 * Update an existing agent
 */
export async function updateAgent(
  agentId: string,
  data: AgentFormData
): Promise<Agent> {
  const response = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error("Failed to update agent");
  }
  
  return response.json();
}

/**
 * Delete an agent
 */
export async function deleteAgent(agentId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    throw new Error("Failed to delete agent");
  }
}

/**
 * Fetch available tools that can be assigned to agents
 */
export async function fetchAvailableTools(): Promise<AvailableTool[]> {
  const response = await fetch(`${API_BASE}/agents/tools`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch available tools");
  }
  
  return response.json();
}

/**
 * Fetch agent statistics
 */
export async function fetchAgentStats(agentId: string): Promise<AgentStats> {
  const response = await fetch(`${API_BASE}/agents/${agentId}/stats`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch agent statistics");
  }
  
  return response.json();
}

/**
 * Fetch built-in agents
 */
export async function fetchBuiltinAgents(): Promise<Agent[]> {
  const response = await fetch(`${API_BASE}/agents/builtin`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch built-in agents");
  }
  
  return response.json();
}

/**
 * Generate agent prompt using AI
 */
export async function generateAgentPrompt(
  description: string,
  tools?: string[],
  name?: string
): Promise<AgentFormData> {
  const response = await fetch(`${API_BASE}/agents/generate-prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, tools, name }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to generate agent prompt");
  }
  
  return response.json();
}

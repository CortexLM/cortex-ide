/**
 * Types for agent management
 */

/** Agent definition */
export interface Agent {
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

/** Agent form data for create/edit */
export interface AgentFormData {
  name: string;
  description: string;
  model: string;
  reasoningEffort: "low" | "medium" | "high";
  tools: string[];
  prompt: string;
  color?: string;
  scope: "project" | "user";
}

/** Available tools that can be assigned to agents */
export interface AvailableTool {
  id: string;
  name: string;
  description: string;
  category: "file" | "search" | "execution" | "network" | "utility";
}

/** Agent execution stats */
export interface AgentStats {
  totalInvocations: number;
  averageTokensUsed: number;
  successRate: number;
  lastUsed?: string;
}

import { ToolCall } from "@/context/SDKContext";

/**
 * Enhanced polymorphic message type for Agentic Terminal UI.
 */
export type AgenticMessageType = 
  | 'user-text' 
  | 'agent-text' 
  | 'tool-step' 
  | 'terminal-output';

export interface AgenticToolStep extends ToolCall {
  collapsed?: boolean;
  indentationLevel?: number;
}

export interface AgenticMessage {
  id: string;
  type: AgenticMessageType;
  content?: string;
  role?: 'user' | 'assistant' | 'system';
  timestamp: number;
  tool?: AgenticToolStep;
  status?: 'running' | 'success' | 'error';
  metadata?: Record<string, any>;
}

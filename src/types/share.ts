/**
 * Types for session sharing functionality
 */

/** A message in a shared session */
export interface SharedMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  toolCalls?: SharedToolCall[];
}

/** A tool call in a shared message */
export interface SharedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
}

/** A shared session */
export interface SharedSession {
  id: string;
  title: string;
  createdAt: string;
  expiresAt?: string;
  messages: SharedMessage[];
  viewCount: number;
  shareToken: string;
  /** Whether the share is password protected */
  isProtected: boolean;
}

/** Share settings when creating a share */
export interface ShareSettings {
  /** Title for the shared session */
  title?: string;
  /** Expiration in hours (null = never) */
  expiresInHours?: number | null;
  /** Password to protect the share */
  password?: string;
  /** Whether to include tool outputs */
  includeToolOutputs: boolean;
  /** Maximum messages to include (null = all) */
  maxMessages?: number | null;
}

/** Response when creating a share */
export interface ShareResponse {
  shareToken: string;
  shareUrl: string;
  expiresAt?: string;
}

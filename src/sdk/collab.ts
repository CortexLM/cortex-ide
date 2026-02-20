/**
 * @fileoverview Collaboration SDK
 *
 * Typed IPC wrappers for the Tauri collaboration backend commands.
 * Provides session management, cursor broadcasting, and CRDT document sync.
 *
 * @module @cortex/sdk/collab
 */

import { invoke } from "@tauri-apps/api/core";

export interface CollabParticipant {
  id: string;
  name: string;
  color: string;
  permission: "owner" | "editor" | "viewer";
  cursor?: CursorPosition;
  selection?: SelectionRange;
  joinedAt: number;
}

export interface CursorPosition {
  fileId: string;
  line: number;
  column: number;
  timestamp: number;
}

export interface SelectionRange {
  fileId: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  timestamp: number;
}

export interface CollabSessionInfo {
  id: string;
  name: string;
  hostId: string;
  createdAt: number;
  participants: CollabParticipant[];
  documentIds: string[];
  serverPort: number;
}

/**
 * Create a new collaboration session.
 * Starts the WebSocket server if not already running.
 */
export async function collabCreateSession(
  name: string,
  userName: string,
): Promise<CollabSessionInfo> {
  return invoke<CollabSessionInfo>("collab_create_session", {
    name,
    userName,
  });
}

/**
 * Join an existing collaboration session.
 */
export async function collabJoinSession(
  sessionId: string,
  userName: string,
): Promise<CollabSessionInfo> {
  return invoke<CollabSessionInfo>("collab_join_session", {
    sessionId,
    userName,
  });
}

/**
 * Leave a collaboration session.
 */
export async function collabLeaveSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  return invoke<void>("collab_leave_session", {
    sessionId,
    userId,
  });
}

/**
 * Broadcast cursor position to all peers in a session.
 */
export async function collabBroadcastCursor(
  sessionId: string,
  userId: string,
  fileId: string,
  line: number,
  column: number,
): Promise<void> {
  return invoke<void>("collab_broadcast_cursor", {
    sessionId,
    userId,
    fileId,
    line,
    column,
  });
}

/**
 * Sync a CRDT document update with the backend.
 * Returns the full document state after applying the update.
 */
export async function collabSyncDocument(
  sessionId: string,
  fileId: string,
  update: number[],
): Promise<number[]> {
  return invoke<number[]>("collab_sync_document", {
    sessionId,
    fileId,
    update,
  });
}

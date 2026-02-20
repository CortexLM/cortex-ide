/**
 * API functions for session sharing
 */

import type { SharedSession, ShareSettings, ShareResponse } from "@/types/share";

const API_BASE = "/api/v1";

/**
 * Fetch a shared session by token
 */
export async function fetchSharedSession(token: string): Promise<SharedSession> {
  const response = await fetch(`${API_BASE}/share/${token}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Session not found or expired");
    }
    if (response.status === 401) {
      throw new Error("Password required");
    }
    throw new Error("Failed to fetch shared session");
  }
  
  return response.json();
}

/**
 * Fetch a password-protected shared session
 */
export async function fetchProtectedSession(
  token: string,
  password: string
): Promise<SharedSession> {
  const response = await fetch(`${API_BASE}/share/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid password");
    }
    throw new Error("Failed to fetch shared session");
  }
  
  return response.json();
}

/**
 * Create a new share for a session
 */
export async function createShare(
  sessionId: string,
  settings: ShareSettings
): Promise<ShareResponse> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  
  if (!response.ok) {
    throw new Error("Failed to create share");
  }
  
  return response.json();
}

/**
 * Revoke a share
 */
export async function revokeShare(token: string): Promise<void> {
  const response = await fetch(`${API_BASE}/share/${token}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    throw new Error("Failed to revoke share");
  }
}

/**
 * Report a shared session
 */
export async function reportShare(
  token: string,
  reason: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/share/${token}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to report share");
  }
}

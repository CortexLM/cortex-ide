// Local storage for sessions and messages
// Uses localStorage for simplicity, can be upgraded to IndexedDB for larger data

import { Message, Session } from "@/context/SDKContext";

const STORAGE_PREFIX = "cortex_";
const SESSIONS_KEY = `${STORAGE_PREFIX}sessions`;
const MESSAGES_KEY = `${STORAGE_PREFIX}messages_`;

export interface StoredSession extends Session {
  messages: Message[];
}

// Get all session IDs
export function getSessionIds(): string[] {
  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Get all sessions (without messages)
export function getSessions(): Session[] {
  const ids = getSessionIds();
  return ids.map(id => getSession(id)).filter(Boolean) as Session[];
}

// Get a session by ID
export function getSession(sessionId: string): Session | null {
  try {
    const data = localStorage.getItem(`${STORAGE_PREFIX}session_${sessionId}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Save a session
export function saveSession(session: Session): void {
  try {
    // Save session
    localStorage.setItem(`${STORAGE_PREFIX}session_${session.id}`, JSON.stringify(session));
    
    // Add to session list if not exists
    const ids = getSessionIds();
    if (!ids.includes(session.id)) {
      ids.unshift(session.id); // Add to beginning (most recent)
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(ids.slice(0, 50))); // Keep max 50 sessions
    }
  } catch (e) {
    console.error("[Storage] Failed to save session:", e);
  }
}

// Delete a session
export function deleteSession(sessionId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}session_${sessionId}`);
    localStorage.removeItem(`${MESSAGES_KEY}${sessionId}`);
    
    const ids = getSessionIds().filter(id => id !== sessionId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error("[Storage] Failed to delete session:", e);
  }
}

// Get messages for a session
export function getMessages(sessionId: string): Message[] {
  try {
    const data = localStorage.getItem(`${MESSAGES_KEY}${sessionId}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save messages for a session
export function saveMessages(sessionId: string, messages: Message[]): void {
  try {
    localStorage.setItem(`${MESSAGES_KEY}${sessionId}`, JSON.stringify(messages));
  } catch (e) {
    console.error("[Storage] Failed to save messages:", e);
    // If quota exceeded, try to clean up old sessions
    cleanupOldSessions();
  }
}

// Update session title based on first user message
// Returns true if title was updated
export function updateSessionTitle(sessionId: string, messages: Message[]): boolean {
  const session = getSession(sessionId);
  if (!session) return false;
  
  // Don't update if already has a custom title (not default)
  if (session.title && session.title !== "New Session" && session.title !== "Session") {
    return false;
  }
  
  const firstUserMsg = messages.find(m => m.role === "user");
  if (firstUserMsg) {
    const textPart = firstUserMsg.parts.find(p => p.type === "text");
    if (textPart && textPart.type === "text") {
      const title = textPart.content.slice(0, 50) + (textPart.content.length > 50 ? "..." : "");
      if (session.title !== title) {
        session.title = title;
        // Save session data only, don't modify session list
        localStorage.setItem(`${STORAGE_PREFIX}session_${session.id}`, JSON.stringify(session));
        return true;
      }
    }
  }
  return false;
}

// Clean up old sessions when storage is full
function cleanupOldSessions(): void {
  const ids = getSessionIds();
  if (ids.length > 10) {
    // Remove oldest sessions
    const toRemove = ids.slice(10);
    toRemove.forEach(id => {
      localStorage.removeItem(`${STORAGE_PREFIX}session_${id}`);
      localStorage.removeItem(`${MESSAGES_KEY}${id}`);
    });
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(ids.slice(0, 10)));
  }
}

// Export all data (for backup)
export function exportData(): string {
  const sessions = getSessions();
  const data = sessions.map(session => ({
    ...session,
    messages: getMessages(session.id),
  }));
  return JSON.stringify(data, null, 2);
}

// Import data (from backup)
export function importData(json: string): void {
  let data: StoredSession[];
  try {
    data = JSON.parse(json) as StoredSession[];
  } catch (e) {
    console.error("[Storage] Failed to parse import data:", e);
    return;
  }
  
  if (!Array.isArray(data)) {
    console.error("[Storage] Invalid import data: expected array");
    return;
  }
  
  data.forEach(session => {
    if (session && session.id) {
      saveSession(session);
      saveMessages(session.id, session.messages || []);
    }
  });
}

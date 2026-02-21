/**
 * SSH Context
 *
 * Provides SSH connection management for remote terminals.
 * Handles connection lifecycle, profile storage, and data streaming.
 */

import {
  createContext,
  useContext,
  ParentComponent,
  onMount,
  onCleanup,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { createLogger } from "../utils/logger";

const sshLogger = createLogger("SSH");

import type {
  SSHConfig,
  SSHSession,
  SSHConnectionProfile,
  SSHConnectionStatus,
  SSHProgressEvent,
  SSHState,
  SSHContextValue,
  Disposable,
  BackendSSHSessionInfo,
  MockSSHSessionData,
} from "../types/ssh";
import { toBackendSSHConfig, fromBackendSessionInfo } from "../types/ssh";

// ============================================================================
// Constants
// ============================================================================

const PROFILES_STORAGE_KEY = "orion_ssh_profiles";

// SECURITY: Never enable mock mode in production
const MOCK_MODE = false;

// Build-time assertion - will fail if MOCK_MODE is true in production
if ((import.meta as unknown as { env: { PROD: boolean } }).env.PROD && MOCK_MODE) {
  throw new Error("SECURITY ERROR: MOCK_MODE must be disabled in production builds");
}

// Default profile colors for visual identification
const PROFILE_COLORS = [
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#84cc16", // Lime
  "#f97316", // Orange
  "#14b8a6", // Teal
];

// ============================================================================
// Context Setup
// ============================================================================

const SSHContext = createContext<SSHContextValue>();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID.
 */
const generateId = (prefix: string = "ssh"): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Get a random profile color.
 */
const getRandomColor = (): string => {
  return PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)];
};

// ============================================================================
// Mock Implementation
// ============================================================================

const mockSessions = new Map<string, MockSSHSessionData>();

const mockConnect = async (config: SSHConfig): Promise<BackendSSHSessionInfo> => {
  await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate connection delay

  const sessionId = generateId("mock_ssh");
  
  const mockData: MockSSHSessionData = {
    sessionId,
    outputQueue: [],
    isConnected: true,
  };

  // Simulate initial connection output
  mockData.outputQueue.push(
    `\x1b[1;32m[SSH]\x1b[0m Connected to ${config.username}@${config.host}\r\n`,
    `\x1b[1;34m[SSH]\x1b[0m Platform: Linux\r\n`,
    `\x1b[1;34m[SSH]\x1b[0m Home: /home/${config.username}\r\n\r\n`,
    `${config.username}@remote:~$ `,
  );

  mockSessions.set(sessionId, mockData);

  return {
    id: sessionId,
    name: `${config.username}@${config.host}`,
    host: config.host,
    port: config.port,
    username: config.username,
    cols: 120,
    rows: 30,
    status: "connected",
    created_at: Date.now(),
    connected_at: Date.now(),
    remote_platform: "Linux",
    remote_home: `/home/${config.username}`,
    cwd: `/home/${config.username}`,
  };
};

const mockDisconnect = async (sessionId: string): Promise<void> => {
  const session = mockSessions.get(sessionId);
  if (session) {
    session.isConnected = false;
    if (session.outputInterval) {
      clearInterval(session.outputInterval);
    }
    mockSessions.delete(sessionId);
  }
};

const mockWrite = async (sessionId: string, data: string): Promise<void> => {
  const session = mockSessions.get(sessionId);
  if (!session || !session.isConnected) return;

  // Echo the input and simulate a response
  if (data === "\r" || data === "\n") {
    session.outputQueue.push(`\r\n`);
    // Simulate command execution after 100ms
    setTimeout(() => {
      session.outputQueue.push(`${session.sessionId.split("_")[2]}@remote:~$ `);
    }, 100);
  } else if (data === "\x03") {
    // Ctrl+C
    session.outputQueue.push(`^C\r\n`);
    session.outputQueue.push(`${session.sessionId.split("_")[2]}@remote:~$ `);
  } else {
    session.outputQueue.push(data);
  }
};

const mockResize = async (_sessionId: string, _cols: number, _rows: number): Promise<void> => {
  // No-op for mock
};

// ============================================================================
// Provider Component
// ============================================================================

export const SSHProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<SSHState>({
    sessions: [],
    savedProfiles: [],
    activeSessionId: null,
    isLoading: false,
    error: null,
  });

  // Event subscribers
  const dataSubscribers = new Map<string, Set<(data: string) => void>>();
  const statusSubscribers = new Map<string, Set<(status: SSHConnectionStatus, error?: string) => void>>();
  const progressSubscribers = new Map<string, Set<(event: SSHProgressEvent) => void>>();

  // Event listeners for cleanup
  let unlistenOutput: UnlistenFn | null = null;
  let unlistenStatus: UnlistenFn | null = null;
  let unlistenProgress: UnlistenFn | null = null;

  // Mock output processor
  let mockOutputInterval: ReturnType<typeof setInterval> | null = null;

  // ============================================================================
  // Profile Management
  // ============================================================================

  /**
   * Load profiles from storage.
   */
  const loadProfiles = async (): Promise<void> => {
    try {
      // Try to load from Tauri backend first
      if (!MOCK_MODE) {
        try {
          const profiles = await invoke<SSHConnectionProfile[]>("ssh_get_profiles");
          setState("savedProfiles", profiles);
          return;
        } catch (err) {
          console.debug("[SSH] Backend profiles load failed:", err);
        }
      }

      // Load from localStorage
      const stored = localStorage.getItem(PROFILES_STORAGE_KEY);
      if (stored) {
        const profiles = JSON.parse(stored) as SSHConnectionProfile[];
        setState("savedProfiles", profiles);
      }
    } catch (e) {
      sshLogger.error("Failed to load profiles:", e);
    }
  };

  /**
   * Save profiles to storage.
   */
  const saveProfilesToStorage = (): void => {
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(state.savedProfiles));
    } catch (e) {
      sshLogger.error("Failed to save profiles:", e);
    }
  };

  /**
   * Save a new connection profile.
   */
  const saveProfile = async (
    profileData: Omit<SSHConnectionProfile, "id" | "createdAt" | "updatedAt">
  ): Promise<SSHConnectionProfile> => {
    const now = Date.now();
    const profile: SSHConnectionProfile = {
      ...profileData,
      id: generateId("profile"),
      createdAt: now,
      updatedAt: now,
      color: profileData.color || getRandomColor(),
    };

    setState("savedProfiles", (profiles) => [...profiles, profile]);
    saveProfilesToStorage();

    // Also save to backend if available
    if (!MOCK_MODE) {
      try {
        await invoke("ssh_save_profile", { profile });
      } catch (e) {
        sshLogger.warn("Backend profile save failed:", e);
      }
    }

    return profile;
  };

  /**
   * Update an existing profile.
   */
  const updateProfile = async (
    profileId: string,
    updates: Partial<SSHConnectionProfile>
  ): Promise<void> => {
    setState(
      "savedProfiles",
      (p) => p.id === profileId,
      produce((profile) => {
        Object.assign(profile, updates, { updatedAt: Date.now() });
      })
    );
    saveProfilesToStorage();

    // Also update backend if available
    if (!MOCK_MODE) {
      try {
        const profile = state.savedProfiles.find((p) => p.id === profileId);
        if (profile) {
          await invoke("ssh_save_profile", { profile });
        }
      } catch (e) {
        sshLogger.warn("Backend profile update failed:", e);
      }
    }
  };

  /**
   * Delete a saved profile.
   */
  const deleteProfile = async (profileId: string): Promise<void> => {
    setState("savedProfiles", (profiles) => profiles.filter((p) => p.id !== profileId));
    saveProfilesToStorage();

    // Also delete from backend if available
    if (!MOCK_MODE) {
      try {
        await invoke("ssh_delete_profile", { profileId });
      } catch (e) {
        sshLogger.warn("Backend profile delete failed:", e);
      }
    }
  };

  /**
   * Get profile by ID.
   */
  const getProfile = (profileId: string): SSHConnectionProfile | undefined => {
    return state.savedProfiles.find((p) => p.id === profileId);
  };

  /**
   * Generate a unique profile ID.
   */
  const generateProfileId = async (): Promise<string> => {
    if (!MOCK_MODE) {
      try {
        return await invoke<string>("ssh_generate_profile_id");
      } catch (err) {
        console.debug("[SSH] Backend ID generation failed:", err);
      }
    }
    return generateId("profile");
  };

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Establish a new SSH connection.
   */
  const connect = async (config: SSHConfig): Promise<string> => {
    setState("isLoading", true);
    setState("error", null);

    // Create initial session in connecting state
    const tempSessionId = generateId("pending");
    const initialSession: SSHSession = {
      id: tempSessionId,
      config,
      status: "connecting",
      createdAt: new Date(),
    };

    setState("sessions", (sessions) => [...sessions, initialSession]);

    try {
      let sessionInfo: BackendSSHSessionInfo;

      if (MOCK_MODE) {
        sessionInfo = await mockConnect(config);
      } else {
        const backendConfig = toBackendSSHConfig(config);
        sessionInfo = await invoke<BackendSSHSessionInfo>("ssh_connect", {
          config: backendConfig,
          cols: 120,
          rows: 30,
        });
      }

      // Update session with real info
      const realSession = fromBackendSessionInfo(sessionInfo, config);

      setState("sessions", (sessions) =>
        sessions.map((s) => (s.id === tempSessionId ? realSession : s))
      );

      setState("activeSessionId", realSession.id);
      setState("isLoading", false);

      // Update profile connection stats if applicable
      if (config.profileId) {
        const profile = getProfile(config.profileId);
        if (profile) {
          updateProfile(config.profileId, {
            lastConnected: Date.now(),
            connectCount: (profile.connectCount || 0) + 1,
          });
        }
      }

      sshLogger.debug("Connected:", realSession.id);
      return realSession.id;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      
      // Update session to error state
      setState(
        "sessions",
        (s) => s.id === tempSessionId,
        produce((session) => {
          session.status = "error";
          session.error = errorMsg;
        })
      );

      setState("error", errorMsg);
      setState("isLoading", false);
      
      sshLogger.error("Connection failed:", errorMsg);
      throw new Error(errorMsg);
    }
  };

  /**
   * Disconnect an SSH session.
   */
  const disconnect = async (sessionId: string): Promise<void> => {
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) return;

    try {
      if (MOCK_MODE) {
        await mockDisconnect(sessionId);
      } else {
        await invoke("ssh_disconnect", { sessionId });
      }
    } catch (e) {
      sshLogger.warn("Disconnect error:", e);
    }

    // Remove session from state
    setState("sessions", (sessions) => sessions.filter((s) => s.id !== sessionId));

    // Update active session if needed
    if (state.activeSessionId === sessionId) {
      const remaining = state.sessions.filter((s) => s.id !== sessionId);
      setState("activeSessionId", remaining.length > 0 ? remaining[0].id : null);
    }

    // Clean up subscribers
    dataSubscribers.delete(sessionId);
    statusSubscribers.delete(sessionId);
    progressSubscribers.delete(sessionId);

    sshLogger.debug("Disconnected:", sessionId);
  };

  /**
   * Reconnect a disconnected session.
   */
  const reconnect = async (sessionId: string): Promise<void> => {
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update status to reconnecting
    setState(
      "sessions",
      (s) => s.id === sessionId,
      produce((s) => {
        s.status = "reconnecting";
        s.error = undefined;
      })
    );

    try {
      // Disconnect the old session
      await disconnect(sessionId);
      
      // Connect with the same config
      await connect(session.config);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      sshLogger.error("Reconnect failed:", errorMsg);
      throw e;
    }
  };

  /**
   * Set the active session.
   */
  const setActiveSession = (sessionId: string | null): void => {
    setState("activeSessionId", sessionId);
    
    // Update isActive flag on sessions
    setState(
      "sessions",
      produce((sessions) => {
        for (const session of sessions) {
          session.isActive = session.id === sessionId;
        }
      })
    );
  };

  /**
   * Get session by ID.
   */
  const getSession = (sessionId: string): SSHSession | undefined => {
    return state.sessions.find((s) => s.id === sessionId);
  };

  // ============================================================================
  // Data Transmission
  // ============================================================================

  /**
   * Write data to an SSH session.
   */
  const writeToSession = async (sessionId: string, data: string): Promise<void> => {
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session || session.status !== "connected") {
      console.warn("[SSH] Cannot write to session:", sessionId, "status:", session?.status);
      return;
    }

    try {
      if (MOCK_MODE) {
        await mockWrite(sessionId, data);
      } else {
        await invoke("ssh_pty_write", { sessionId, data });
      }
    } catch (e) {
      console.error("[SSH] Write error:", e);
      throw e;
    }
  };

  /**
   * Resize the PTY for a session.
   */
  const resizeSession = async (sessionId: string, cols: number, rows: number): Promise<void> => {
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session || session.status !== "connected") return;

    try {
      if (MOCK_MODE) {
        await mockResize(sessionId, cols, rows);
      } else {
        await invoke("ssh_pty_resize", { sessionId, cols, rows });
      }

      // Update session dimensions
      setState(
        "sessions",
        (s) => s.id === sessionId,
        produce((s) => {
          s.cols = cols;
          s.rows = rows;
        })
      );
    } catch (e) {
      console.error("[SSH] Resize error:", e);
    }
  };

  // ============================================================================
  // Event Subscriptions
  // ============================================================================

  /**
   * Subscribe to session data output.
   */
  const onSessionData = (sessionId: string, callback: (data: string) => void): Disposable => {
    if (!dataSubscribers.has(sessionId)) {
      dataSubscribers.set(sessionId, new Set());
    }
    dataSubscribers.get(sessionId)!.add(callback);

    return {
      dispose: () => {
        dataSubscribers.get(sessionId)?.delete(callback);
      },
    };
  };

  /**
   * Subscribe to session status changes.
   */
  const onSessionStatus = (
    sessionId: string,
    callback: (status: SSHConnectionStatus, error?: string) => void
  ): Disposable => {
    if (!statusSubscribers.has(sessionId)) {
      statusSubscribers.set(sessionId, new Set());
    }
    statusSubscribers.get(sessionId)!.add(callback);

    return {
      dispose: () => {
        statusSubscribers.get(sessionId)?.delete(callback);
      },
    };
  };

  /**
   * Subscribe to connection progress.
   */
  const onConnectionProgress = (
    sessionId: string,
    callback: (event: SSHProgressEvent) => void
  ): Disposable => {
    if (!progressSubscribers.has(sessionId)) {
      progressSubscribers.set(sessionId, new Set());
    }
    progressSubscribers.get(sessionId)!.add(callback);

    return {
      dispose: () => {
        progressSubscribers.get(sessionId)?.delete(callback);
      },
    };
  };

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Test an SSH connection without creating a terminal.
   */
  const testConnection = async (
    config: SSHConfig
  ): Promise<{ success: boolean; error?: string; remotePlatform?: string }> => {
    if (MOCK_MODE) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true, remotePlatform: "Linux" };
    }

    try {
      const backendConfig = toBackendSSHConfig(config);
      const result = await invoke<{ success: boolean; error?: string; remote_platform?: string }>(
        "ssh_test_connection",
        { config: backendConfig }
      );
      return {
        success: result.success,
        error: result.error,
        remotePlatform: result.remote_platform,
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };

  /**
   * Get available SSH keys from the system.
   */
  const getAvailableKeys = async (): Promise<string[]> => {
    if (MOCK_MODE) {
      return ["~/.ssh/id_rsa", "~/.ssh/id_ed25519"];
    }

    try {
      return await invoke<string[]>("ssh_get_available_keys");
    } catch (e) {
      console.warn("[SSH] Failed to get available keys:", e);
      return [];
    }
  };

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Handle output event from backend.
   */
  const handleOutputEvent = (event: { session_id: string; data: string }): void => {
    const subscribers = dataSubscribers.get(event.session_id);
    if (subscribers) {
      for (const callback of subscribers) {
        try {
          callback(event.data);
        } catch (e) {
          console.error("[SSH] Data subscriber error:", e);
        }
      }
    }
  };

  /**
   * Handle status event from backend.
   */
  const handleStatusEvent = (event: {
    session_id: string;
    status: string | { error: { message: string } };
  }): void => {
    let status: SSHConnectionStatus;
    let error: string | undefined;

    if (typeof event.status === "string") {
      status = event.status as SSHConnectionStatus;
    } else {
      status = "error";
      error = event.status.error.message;
    }

    // Update session state
    setState(
      "sessions",
      (s) => s.id === event.session_id,
      produce((session) => {
        session.status = status;
        session.error = error;
        if (status === "connected") {
          session.connectedAt = new Date();
        }
      })
    );

    // Notify subscribers
    const subscribers = statusSubscribers.get(event.session_id);
    if (subscribers) {
      for (const callback of subscribers) {
        try {
          callback(status, error);
        } catch (e) {
          console.error("[SSH] Status subscriber error:", e);
        }
      }
    }

    // Remove disconnected sessions after a delay
    if (status === "disconnected") {
      setTimeout(() => {
        const session = state.sessions.find((s) => s.id === event.session_id);
        if (session?.status === "disconnected") {
          setState("sessions", (sessions) => sessions.filter((s) => s.id !== event.session_id));
        }
      }, 5000);
    }
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(async () => {
    // Load saved profiles
    await loadProfiles();

    // Set up event listeners
    if (!MOCK_MODE) {
      try {
        unlistenOutput = await listen<{ session_id: string; data: string }>(
          "ssh-terminal:output",
          (event) => handleOutputEvent(event.payload)
        );

        unlistenStatus = await listen<{
          session_id: string;
          status: string | { error: { message: string } };
        }>("ssh-terminal:status", (event) => handleStatusEvent(event.payload));

        unlistenProgress = await listen<SSHProgressEvent>(
          "ssh-terminal:progress",
          (event) => {
            const subscribers = progressSubscribers.get(event.payload.sessionId);
            if (subscribers) {
              for (const callback of subscribers) {
                try {
                  callback(event.payload);
                } catch (e) {
                  console.error("[SSH] Progress subscriber error:", e);
                }
              }
            }
          }
        );
      } catch (e) {
        console.error("[SSH] Failed to set up event listeners:", e);
      }
    } else {
      // Mock mode: process mock output
      mockOutputInterval = setInterval(() => {
        for (const [sessionId, mockData] of mockSessions) {
          if (mockData.outputQueue.length > 0) {
            const data = mockData.outputQueue.shift()!;
            handleOutputEvent({ session_id: sessionId, data });
          }
        }
      }, 50);
    }
  });

  onCleanup(() => {
    // Clean up event listeners
    unlistenOutput?.();
    unlistenStatus?.();
    unlistenProgress?.();

    // Clean up mock interval
    if (mockOutputInterval) {
      clearInterval(mockOutputInterval);
    }

    // Disconnect all sessions
    for (const session of state.sessions) {
      disconnect(session.id).catch(() => {});
    }

    // Clear subscribers
    dataSubscribers.clear();
    statusSubscribers.clear();
    progressSubscribers.clear();
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: SSHContextValue = {
    get sessions() {
      return state.sessions;
    },
    get savedProfiles() {
      return state.savedProfiles;
    },
    get activeSessionId() {
      return state.activeSessionId;
    },
    get isLoading() {
      return state.isLoading;
    },
    get error() {
      return state.error;
    },
    connect,
    disconnect,
    reconnect,
    setActiveSession,
    getSession,
    writeToSession,
    resizeSession,
    saveProfile,
    updateProfile,
    deleteProfile,
    loadProfiles,
    getProfile,
    onSessionData,
    onSessionStatus,
    onConnectionProgress,
    testConnection,
    getAvailableKeys,
    generateProfileId,
  };

  return (
    <SSHContext.Provider value={contextValue}>
      {props.children}
    </SSHContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access SSH context.
 */
export function useSSH(): SSHContextValue {
  const context = useContext(SSHContext);
  if (!context) {
    throw new Error("useSSH must be used within SSHProvider");
  }
  return context;
}

// Re-export types
export type { SSHContextValue } from "../types/ssh";

export default SSHProvider;

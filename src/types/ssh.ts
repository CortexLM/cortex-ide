/**
 * SSH Types (Extended)
 *
 * Extended type definitions for SSH remote terminal functionality.
 * These types complement the base types in terminal.ts and provide
 * additional structure for the SSHContext and frontend components.
 * 
 * Note: The base SSHConfig type is defined in terminal.ts and matches
 * the Rust backend. These types provide additional frontend-specific
 * types for the SSH context and UI components.
 */

import type { SSHConfig as BaseSSHConfig } from "./terminal";

// Re-export base types for convenience
export type { SSHConfig as BaseSSHConfig } from "./terminal";

// ============================================================================
// SSH Authentication Types (Frontend)
// ============================================================================

/**
 * Frontend SSH authentication method type.
 * Maps to backend types: "password" | "key" | "agent"
 */
export type SSHAuthMethod = "password" | "privateKey" | "agent";

/**
 * Frontend SSH authentication configuration.
 */
export interface SSHAuthConfig {
  /** Authentication method */
  method: SSHAuthMethod;
  /** Password for password authentication */
  password?: string;
  /** Path to private key file */
  privateKeyPath?: string;
  /** Passphrase for encrypted private key */
  passphrase?: string;
}

// ============================================================================
// SSH Connection Configuration (Frontend)
// ============================================================================

/**
 * Frontend SSH connection configuration.
 * Used in UI components and converted to backend format for API calls.
 */
export interface SSHConfig {
  /** Remote host address (hostname or IP) */
  host: string;
  /** SSH port (default: 22) */
  port: number;
  /** Username for authentication */
  username: string;
  /** Authentication method */
  authMethod: SSHAuthMethod;
  /** Password (for password auth) */
  password?: string;
  /** Path to private key file (for privateKey auth) */
  privateKeyPath?: string;
  /** Passphrase for encrypted private key */
  passphrase?: string;
  /** Initial working directory on remote */
  initialDirectory?: string;
  /** Environment variables to set on remote */
  env?: Record<string, string>;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Keep-alive interval in seconds */
  keepAliveInterval?: number;
  /** Profile ID for saved connections */
  profileId?: string;
}

/**
 * Backend SSH configuration format (matches Rust types).
 */
export interface BackendSSHConfig {
  host: string;
  port: number;
  username: string;
  auth_method: {
    type: "password" | "key" | "agent";
    password?: string;
    private_key_path?: string;
    passphrase?: string;
    has_password?: boolean;
    has_passphrase?: boolean;
  };
  profile_id?: string;
  initial_cwd?: string;
  env?: Record<string, string>;
}

/**
 * Convert from frontend SSHConfig to backend format.
 */
export function toBackendSSHConfig(config: SSHConfig): BackendSSHConfig {
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    auth_method: {
      type: config.authMethod === "privateKey" ? "key" : config.authMethod,
      password: config.password,
      private_key_path: config.privateKeyPath,
      passphrase: config.passphrase,
      has_password: config.password !== undefined,
      has_passphrase: config.passphrase !== undefined,
    },
    profile_id: config.profileId,
    initial_cwd: config.initialDirectory,
    env: config.env,
  };
}

/**
 * Convert from backend SSHConfig to frontend format.
 */
export function fromBackendSSHConfig(config: BaseSSHConfig): SSHConfig {
  let authMethod: SSHAuthMethod;
  if (config.auth_method.type === "key") {
    authMethod = "privateKey";
  } else if (config.auth_method.type === "password") {
    authMethod = "password";
  } else {
    authMethod = "agent";
  }

  return {
    host: config.host,
    port: config.port,
    username: config.username,
    authMethod,
    privateKeyPath: config.auth_method.private_key_path,
    initialDirectory: config.initial_cwd,
    env: config.env,
    profileId: config.profile_id,
  };
}

// ============================================================================
// SSH Connection Profile Types
// ============================================================================

/**
 * A saved SSH connection profile.
 */
export interface SSHConnectionProfile {
  /** Unique profile identifier */
  id: string;
  /** Display name for the profile */
  name: string;
  /** Remote host address */
  host: string;
  /** SSH port */
  port: number;
  /** Username for authentication */
  username: string;
  /** Authentication method */
  authMethod: SSHAuthMethod;
  /** Path to private key file (stored, not the actual content) */
  privateKeyPath?: string;
  /** Whether password is stored in secure storage */
  hasStoredPassword: boolean;
  /** Whether passphrase is stored in secure storage */
  hasStoredPassphrase: boolean;
  /** Default working directory on remote */
  defaultDirectory?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Color for visual identification */
  color?: string;
  /** Icon identifier */
  icon?: string;
  /** Tags for organization */
  tags?: string[];
  /** Last connected timestamp */
  lastConnected?: number;
  /** Number of times connected */
  connectCount?: number;
  /** Creation timestamp */
  createdAt: number;
  /** Last modified timestamp */
  updatedAt: number;
  /** Port forwards to automatically establish */
  portForwards?: SSHPortForward[];
}

/**
 * Port forwarding configuration.
 */
export interface SSHPortForward {
  /** Local port to listen on */
  localPort: number;
  /** Remote host to forward to */
  remoteHost: string;
  /** Remote port to forward to */
  remotePort: number;
  /** Whether to auto-forward on connect */
  autoForward: boolean;
  /** Description/name for this forward */
  name?: string;
}

// ============================================================================
// SSH Session Types
// ============================================================================

/**
 * SSH connection status (frontend specific).
 */
export type SSHConnectionStatus =
  | "connecting"
  | "authenticating"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

/**
 * SSH session information (frontend).
 */
export interface SSHSession {
  /** Unique session identifier */
  id: string;
  /** SSH configuration used for this session */
  config: SSHConfig;
  /** Current connection status */
  status: SSHConnectionStatus;
  /** Error message if status is "error" */
  error?: string;
  /** Error code if available */
  errorCode?: string;
  /** When the connection was established */
  connectedAt?: Date;
  /** When the session was created/initiated */
  createdAt: Date;
  /** Remote platform (Linux, Darwin, Windows) */
  remotePlatform?: string;
  /** Remote OS version */
  remoteOSVersion?: string;
  /** Remote home directory */
  remoteHome?: string;
  /** Current working directory on remote */
  currentDirectory?: string;
  /** Remote hostname (may differ from config.host if DNS) */
  remoteHostname?: string;
  /** PTY dimensions */
  cols?: number;
  rows?: number;
  /** Bytes sent */
  bytesSent?: number;
  /** Bytes received */
  bytesReceived?: number;
  /** Active port forwards for this session */
  portForwards?: SSHPortForwardStatus[];
  /** Whether this session is the active/focused one */
  isActive?: boolean;
  /** Associated terminal ID */
  terminalId?: string;
}

/**
 * Port forward status within a session.
 */
export interface SSHPortForwardStatus {
  /** Forward configuration */
  config: SSHPortForward;
  /** Whether the forward is active */
  active: boolean;
  /** Error message if failed */
  error?: string;
  /** Bytes forwarded */
  bytesForwarded?: number;
}

// ============================================================================
// SSH Event Types
// ============================================================================

/**
 * SSH terminal output event.
 */
export interface SSHOutputEvent {
  /** Session ID */
  sessionId: string;
  /** Output data (may be binary-encoded) */
  data: string;
  /** Whether this is stderr (vs stdout) */
  isStderr?: boolean;
}

/**
 * SSH session status change event.
 */
export interface SSHStatusEvent {
  /** Session ID */
  sessionId: string;
  /** New status */
  status: SSHConnectionStatus;
  /** Error message if applicable */
  error?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * SSH connection progress event.
 */
export interface SSHProgressEvent {
  /** Session ID */
  sessionId: string;
  /** Progress stage */
  stage: "dns" | "tcp" | "auth" | "channel" | "shell";
  /** Progress message */
  message: string;
  /** Progress percentage (0-100) if available */
  progress?: number;
}

// ============================================================================
// SSH Context Types
// ============================================================================

/**
 * Disposable interface for cleanup.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * SSH Context value interface.
 */
export interface SSHContextValue {
  /** All active SSH sessions */
  sessions: SSHSession[];
  /** Saved connection profiles */
  savedProfiles: SSHConnectionProfile[];
  /** Currently active session ID */
  activeSessionId: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Global error */
  error: string | null;

  // Connection management
  /** Establish a new SSH connection */
  connect(config: SSHConfig): Promise<string>;
  /** Disconnect an SSH session */
  disconnect(sessionId: string): Promise<void>;
  /** Reconnect a disconnected session */
  reconnect(sessionId: string): Promise<void>;
  /** Set the active session */
  setActiveSession(sessionId: string | null): void;
  /** Get session by ID */
  getSession(sessionId: string): SSHSession | undefined;

  // Data transmission
  /** Write data to an SSH session */
  writeToSession(sessionId: string, data: string): Promise<void>;
  /** Resize the PTY for a session */
  resizeSession(sessionId: string, cols: number, rows: number): Promise<void>;

  // Profile management
  /** Save a connection profile */
  saveProfile(profile: Omit<SSHConnectionProfile, "id" | "createdAt" | "updatedAt">): Promise<SSHConnectionProfile>;
  /** Update an existing profile */
  updateProfile(profileId: string, updates: Partial<SSHConnectionProfile>): Promise<void>;
  /** Delete a saved profile */
  deleteProfile(profileId: string): Promise<void>;
  /** Load profiles from storage */
  loadProfiles(): Promise<void>;
  /** Get profile by ID */
  getProfile(profileId: string): SSHConnectionProfile | undefined;

  // Event subscriptions
  /** Subscribe to session data output */
  onSessionData(sessionId: string, callback: (data: string) => void): Disposable;
  /** Subscribe to session status changes */
  onSessionStatus(sessionId: string, callback: (status: SSHConnectionStatus, error?: string) => void): Disposable;
  /** Subscribe to connection progress */
  onConnectionProgress(sessionId: string, callback: (event: SSHProgressEvent) => void): Disposable;

  // Utility
  /** Test an SSH connection without creating a terminal */
  testConnection(config: SSHConfig): Promise<{ success: boolean; error?: string; remotePlatform?: string }>;
  /** Get available SSH keys from the system */
  getAvailableKeys(): Promise<string[]>;
  /** Generate a unique profile ID */
  generateProfileId(): Promise<string>;
}

/**
 * SSH state for the context store.
 */
export interface SSHState {
  sessions: SSHSession[];
  savedProfiles: SSHConnectionProfile[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Backend Response Types
// ============================================================================

/**
 * Backend SSH session info response.
 */
export interface BackendSSHSessionInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  cols: number;
  rows: number;
  status: string | { error: { message: string } };
  created_at: number;
  connected_at?: number;
  remote_platform?: string;
  remote_home?: string;
  cwd?: string;
}

/**
 * Convert backend session info to frontend format.
 */
export function fromBackendSessionInfo(info: BackendSSHSessionInfo, config: SSHConfig): SSHSession {
  let status: SSHConnectionStatus;
  let error: string | undefined;

  if (typeof info.status === "string") {
    status = info.status as SSHConnectionStatus;
  } else if (info.status && typeof info.status === "object" && "error" in info.status) {
    status = "error";
    error = info.status.error.message;
  } else {
    status = "error";
    error = "Unknown status";
  }

  return {
    id: info.id,
    config,
    status,
    error,
    connectedAt: info.connected_at ? new Date(info.connected_at) : undefined,
    createdAt: new Date(info.created_at),
    remotePlatform: info.remote_platform,
    remoteHome: info.remote_home,
    currentDirectory: info.cwd,
    cols: info.cols,
    rows: info.rows,
  };
}

// ============================================================================
// Mock Data Types (for development)
// ============================================================================

/**
 * Mock SSH session data for development/testing.
 */
export interface MockSSHSessionData {
  sessionId: string;
  outputQueue: string[];
  isConnected: boolean;
  outputInterval?: ReturnType<typeof setInterval>;
}

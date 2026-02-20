/**
 * Remote Debug Configuration Types
 * 
 * Types for configuring remote debugging sessions including:
 * - Connection settings (SSH, TCP, Docker, etc.)
 * - Path mappings between local and remote
 * - Debug adapter configuration
 */

// ============================================================================
// Connection Types
// ============================================================================

/** Supported remote connection types */
export type RemoteConnectionType = 
  | "ssh"      // SSH tunnel to remote machine
  | "tcp"      // Direct TCP connection (e.g., debug adapter protocol over socket)
  | "docker"   // Docker container debugging
  | "wsl"      // Windows Subsystem for Linux
  | "kubernetes"; // Kubernetes pod debugging

/** SSH connection configuration */
export interface SSHConnectionConfig {
  type: "ssh";
  /** Remote host address */
  host: string;
  /** SSH port (default 22) */
  port: number;
  /** SSH username */
  username: string;
  /** Authentication method */
  authMethod: "password" | "key" | "agent";
  /** Path to private key (for key auth) */
  privateKeyPath?: string;
  /** Passphrase for private key */
  passphrase?: string;
  /** Remote debug port to forward */
  remoteDebugPort: number;
  /** Local port to bind (0 = auto) */
  localPort: number;
}

/** TCP connection configuration */
export interface TCPConnectionConfig {
  type: "tcp";
  /** Remote host address */
  host: string;
  /** Debug adapter port */
  port: number;
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/** Docker container connection configuration */
export interface DockerConnectionConfig {
  type: "docker";
  /** Container ID or name */
  containerId: string;
  /** Container port where debugger is listening */
  containerPort: number;
  /** Host port to bind */
  hostPort?: number;
  /** Docker host (for remote Docker) */
  dockerHost?: string;
}

/** WSL connection configuration */
export interface WSLConnectionConfig {
  type: "wsl";
  /** WSL distribution name */
  distribution: string;
  /** Debug port inside WSL */
  remoteDebugPort: number;
}

/** Kubernetes connection configuration */
export interface KubernetesConnectionConfig {
  type: "kubernetes";
  /** Pod name */
  podName: string;
  /** Namespace */
  namespace?: string;
  /** Container name (if multiple containers in pod) */
  containerName?: string;
  /** Remote debug port */
  remotePort: number;
  /** Local port to bind */
  localPort?: number;
  /** Kubectl context */
  context?: string;
}

/** Union type of all connection configs */
export type RemoteConnectionConfig = 
  | SSHConnectionConfig 
  | TCPConnectionConfig 
  | DockerConnectionConfig 
  | WSLConnectionConfig 
  | KubernetesConnectionConfig;

// ============================================================================
// Path Mapping
// ============================================================================

/** Maps local paths to remote paths for source debugging */
export interface PathMapping {
  /** Unique identifier */
  id: string;
  /** Local path (where source files exist on this machine) */
  localPath: string;
  /** Remote path (where source files exist on the remote machine) */
  remotePath: string;
  /** Whether this mapping is enabled */
  enabled: boolean;
}

// ============================================================================
// Debug Adapter Configuration
// ============================================================================

/** Debug adapter type for remote debugging */
export type RemoteDebugAdapterType = 
  | "node"     // Node.js debugging
  | "python"   // Python debugging (debugpy)
  | "go"       // Go debugging (delve)
  | "rust"     // Rust debugging (lldb/gdb)
  | "cpp"      // C++ debugging (lldb/gdb)
  | "java"     // Java debugging (JDWP)
  | "dotnet"   // .NET debugging
  | "ruby"     // Ruby debugging
  | "php"      // PHP debugging (Xdebug)
  | "custom";  // Custom debug adapter

/** Remote debug adapter settings */
export interface RemoteDebugAdapterConfig {
  /** Adapter type */
  type: RemoteDebugAdapterType;
  /** Custom adapter executable path (for custom type) */
  adapterPath?: string;
  /** Additional adapter arguments */
  adapterArgs?: string[];
  /** Custom launch/attach arguments */
  launchArgs?: Record<string, unknown>;
}

// ============================================================================
// Complete Remote Debug Configuration
// ============================================================================

/** Complete remote debug configuration */
export interface RemoteDebugConfig {
  /** Unique identifier */
  id: string;
  /** Display name for this configuration */
  name: string;
  /** Connection configuration */
  connection: RemoteConnectionConfig;
  /** Debug adapter configuration */
  adapter: RemoteDebugAdapterConfig;
  /** Path mappings */
  pathMappings: PathMapping[];
  /** Environment variables to set on remote */
  env?: Record<string, string>;
  /** Pre-launch command to run on remote */
  preLaunchCommand?: string;
  /** Post-debug command to run on remote */
  postDebugCommand?: string;
  /** Whether this is a "launch" or "attach" configuration */
  request: "launch" | "attach";
  /** Stop on entry point */
  stopOnEntry?: boolean;
  /** Created timestamp */
  createdAt: number;
  /** Last used timestamp */
  lastUsedAt?: number;
}

// ============================================================================
// Wizard State Types
// ============================================================================

/** Steps in the remote debug wizard */
export type RemoteDebugWizardStep = 
  | "connection"    // Step 1: Configure connection
  | "adapter"       // Step 2: Select debug adapter
  | "pathMappings"  // Step 3: Configure path mappings
  | "review";       // Step 4: Review and save

/** Wizard state */
export interface RemoteDebugWizardState {
  /** Current step */
  currentStep: RemoteDebugWizardStep;
  /** Partial configuration being built */
  config: Partial<RemoteDebugConfig>;
  /** Validation errors by field */
  errors: Record<string, string>;
  /** Whether a connection test is in progress */
  testingConnection: boolean;
  /** Connection test result */
  connectionTestResult?: {
    success: boolean;
    message: string;
    latency?: number;
  };
}

// ============================================================================
// Storage Keys
// ============================================================================

export const REMOTE_DEBUG_STORAGE_KEYS = {
  /** Saved remote debug configurations */
  savedConfigs: "remote_debug_configs",
  /** Recently used configurations */
  recentConfigs: "remote_debug_recent",
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID for a configuration
 */
export function generateConfigId(): string {
  return `remote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique ID for a path mapping
 */
export function generateMappingId(): string {
  return `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get default connection config for a connection type
 */
export function getDefaultConnectionConfig(type: RemoteConnectionType): RemoteConnectionConfig {
  switch (type) {
    case "ssh":
      return {
        type: "ssh",
        host: "",
        port: 22,
        username: "",
        authMethod: "key",
        remoteDebugPort: 9229,
        localPort: 0,
      };
    case "tcp":
      return {
        type: "tcp",
        host: "localhost",
        port: 9229,
        timeout: 10000,
      };
    case "docker":
      return {
        type: "docker",
        containerId: "",
        containerPort: 9229,
      };
    case "wsl":
      return {
        type: "wsl",
        distribution: "Ubuntu",
        remoteDebugPort: 9229,
      };
    case "kubernetes":
      return {
        type: "kubernetes",
        podName: "",
        remotePort: 9229,
      };
  }
}

/**
 * Get default adapter config for an adapter type
 */
export function getDefaultAdapterConfig(type: RemoteDebugAdapterType): RemoteDebugAdapterConfig {
  return {
    type,
    launchArgs: {},
  };
}

/**
 * Load saved remote debug configurations from localStorage
 */
export function loadSavedConfigs(): RemoteDebugConfig[] {
  try {
    const stored = localStorage.getItem(REMOTE_DEBUG_STORAGE_KEYS.savedConfigs);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load remote debug configs:", e);
  }
  return [];
}

/**
 * Save remote debug configurations to localStorage
 */
export function saveConfigs(configs: RemoteDebugConfig[]): void {
  try {
    localStorage.setItem(REMOTE_DEBUG_STORAGE_KEYS.savedConfigs, JSON.stringify(configs));
  } catch (e) {
    console.error("Failed to save remote debug configs:", e);
  }
}

/**
 * Get connection type display name
 */
export function getConnectionTypeDisplayName(type: RemoteConnectionType): string {
  switch (type) {
    case "ssh": return "SSH Tunnel";
    case "tcp": return "TCP/IP";
    case "docker": return "Docker Container";
    case "wsl": return "WSL";
    case "kubernetes": return "Kubernetes Pod";
  }
}

/**
 * Get adapter type display name
 */
export function getAdapterTypeDisplayName(type: RemoteDebugAdapterType): string {
  switch (type) {
    case "node": return "Node.js";
    case "python": return "Python (debugpy)";
    case "go": return "Go (Delve)";
    case "rust": return "Rust (LLDB/GDB)";
    case "cpp": return "C/C++ (LLDB/GDB)";
    case "java": return "Java (JDWP)";
    case "dotnet": return ".NET";
    case "ruby": return "Ruby";
    case "php": return "PHP (Xdebug)";
    case "custom": return "Custom";
  }
}

/**
 * Get connection type icon
 */
export function getConnectionTypeIcon(type: RemoteConnectionType): string {
  switch (type) {
    case "ssh": return "terminal";
    case "tcp": return "globe";
    case "docker": return "box";
    case "wsl": return "terminal";
    case "kubernetes": return "server";
  }
}

/**
 * Get adapter type icon
 */
export function getAdapterTypeIcon(type: RemoteDebugAdapterType): string {
  switch (type) {
    case "node": return "code";
    case "python": return "code";
    case "go": return "code";
    case "rust": return "code";
    case "cpp": return "code";
    case "java": return "code";
    case "dotnet": return "code";
    case "ruby": return "code";
    case "php": return "code";
    case "custom": return "settings";
  }
}

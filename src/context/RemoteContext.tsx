import { createContext, useContext, ParentProps, createEffect, onCleanup, createSignal, Accessor } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

// Types matching the Rust backend
export interface AuthMethod {
  type: "password" | "key" | "agent";
  password?: string;
  private_key_path?: string;
  passphrase?: string;
}

// Remote Tunnel types
export type TunnelAuthProvider = "github" | "microsoft";

export type TunnelStatus = "inactive" | "connecting" | "active" | "error" | "closing";

export interface TunnelInfo {
  id: string;
  url: string;
  status: TunnelStatus;
  authProvider: TunnelAuthProvider;
  localPort: number;
  createdAt: number;
  expiresAt?: number;
  error?: string;
}

export interface PortForward {
  local_port: number;
  remote_host: string;
  remote_port: number;
}

export interface ConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: AuthMethod;
  default_directory?: string;
  port_forwards: PortForward[];
}

export interface RemoteFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified?: number;
  permissions?: number;
}

export interface RemoteFileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: RemoteFileNode[];
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

/** Status of a forwarded port */
export type ForwardedPortStatus = "active" | "connecting" | "error" | "stopped";

/** Represents an active port forwarding session */
export interface ForwardedPort {
  id: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  status: ForwardedPortStatus;
  error?: string;
  connectionId: string;
  createdAt: number;
  lastActivity?: number;
  bytesTransferred?: number;
  autoDetected: boolean;
}

/** Port detection result from terminal output */
export interface DetectedPort {
  port: number;
  protocol?: "http" | "https" | "tcp";
  source: string;
  timestamp: number;
}

export type ConnectionStatus = 
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | { error: { message: string } };

export interface ConnectionInfo {
  id: string;
  profile: ConnectionProfile;
  status: ConnectionStatus;
  home_directory?: string;
  platform?: string;
}

// WSL Types
export type WSLConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WSLDistro {
  name: string;
  version: 1 | 2;
  isDefault: boolean;
  status: WSLConnectionStatus;
  error?: string;
  basePath?: string;
}

// Dev Container Types
export type ContainerStatus = "running" | "stopped" | "building" | "starting" | "error";

export interface DevContainer {
  id: string;
  name: string;
  image?: string;
  status: ContainerStatus;
  configPath?: string;
  workspacePath?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  startedAt?: number;
  error?: string;
  ports?: number[];
}

export interface DevContainerConfig {
  name?: string;
  path: string;
  image?: string;
  build?: {
    dockerfile?: string;
    context?: string;
    args?: Record<string, string>;
  };
  features?: Record<string, Record<string, string | number | boolean> | boolean>;
  forwardPorts?: number[];
  mounts?: Array<string | { source?: string; target?: string; type?: "bind" | "volume" }>;
  postCreateCommand?: string;
  postStartCommand?: string;
  postAttachCommand?: string;
  customizations?: {
    vscode?: {
      extensions?: string[];
      settings?: Record<string, unknown>;
    };
  };
  remoteUser?: string;
  workspaceFolder?: string;
  shutdownAction?: "none" | "stopContainer" | "stopCompose";
}

export interface DevContainerFeature {
  id: string;
  name: string;
  description?: string;
  version?: string;
  options?: Record<string, {
    type?: "string" | "number" | "boolean";
    default?: string | number | boolean;
    description?: string;
    enum?: string[];
  }>;
}

export interface DevContainerTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  config?: DevContainerConfig;
}

interface RemoteState {
  profiles: ConnectionProfile[];
  connections: ConnectionInfo[];
  activeConnectionId: string | null;
  isLoading: boolean;
  error: string | null;
  forwardedPorts: ForwardedPort[];
  detectedPorts: DetectedPort[];
  autoForwardPorts: boolean;
  tunnels: TunnelInfo[];
  // WSL State
  wslAvailable: boolean;
  wslDistros: WSLDistro[];
  activeWSLDistro: string | null;
  // Dev Container State
  containers: DevContainer[];
  activeContainerId: string | null;
  availableDevContainerConfigs: DevContainerConfig[];
  availableDevContainerFeatures: DevContainerFeature[];
  availableDevContainerTemplates: DevContainerTemplate[];
}

interface RemoteContextValue {
  state: RemoteState;
  
  // Profile management
  loadProfiles: () => Promise<void>;
  saveProfile: (profile: ConnectionProfile) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  generateProfileId: () => Promise<string>;
  getDefaultKeyPaths: () => Promise<string[]>;
  
  // Connection management
  connect: (profile: ConnectionProfile) => Promise<ConnectionInfo>;
  disconnect: (connectionId: string) => Promise<void>;
  reconnect: (connectionId: string) => Promise<ConnectionInfo>;
  setActiveConnection: (connectionId: string | null) => void;
  getActiveConnection: () => ConnectionInfo | null;
  
  // File operations
  listDirectory: (connectionId: string, path: string) => Promise<RemoteFileEntry[]>;
  getFileTree: (connectionId: string, path: string, depth?: number) => Promise<RemoteFileNode>;
  readFile: (connectionId: string, path: string) => Promise<string>;
  writeFile: (connectionId: string, path: string, content: string) => Promise<void>;
  deleteFile: (connectionId: string, path: string, recursive?: boolean) => Promise<void>;
  createDirectory: (connectionId: string, path: string, recursive?: boolean) => Promise<void>;
  rename: (connectionId: string, oldPath: string, newPath: string) => Promise<void>;
  stat: (connectionId: string, path: string) => Promise<RemoteFileEntry>;
  
  // Command execution
  executeCommand: (connectionId: string, command: string, workingDir?: string) => Promise<CommandResult>;
  
  // Port forwarding
  forwardPort: (connectionId: string, localPort: number, remotePort: number, remoteHost?: string) => Promise<ForwardedPort>;
  stopForwarding: (portId: string) => Promise<void>;
  getForwardedPorts: (connectionId?: string) => ForwardedPort[];
  setAutoForwardPorts: (enabled: boolean) => void;
  autoForward: Accessor<boolean>;
  clearDetectedPorts: () => void;
  processTerminalOutput: (connectionId: string, output: string) => void;
  openForwardedPort: (portId: string) => void;
  
  // Remote tunnels
  createTunnel: (localPort: number, authProvider: TunnelAuthProvider) => Promise<TunnelInfo>;
  connectToTunnel: (tunnelUrl: string) => Promise<TunnelInfo>;
  closeTunnel: (tunnelId: string) => Promise<void>;
  getTunnels: () => TunnelInfo[];
  refreshTunnel: (tunnelId: string) => Promise<TunnelInfo>;
  
  // WSL operations
  detectWSL: () => Promise<void>;
  connectToWSL: (distroName: string) => Promise<void>;
  disconnectFromWSL: (distroName: string) => Promise<void>;
  openFolderInWSL: (distroName: string, folderPath: string) => Promise<void>;
  openTerminalInWSL: (distroName: string, cwd?: string) => Promise<void>;
  getWSLDistros: () => WSLDistro[];
  getActiveWSLDistro: () => WSLDistro | null;
  
  // Dev Container operations
  listContainers: () => Promise<void>;
  connectToContainer: (containerId: string) => Promise<void>;
  startContainer: (containerId: string) => Promise<void>;
  stopContainer: (containerId: string) => Promise<void>;
  removeContainer: (containerId: string) => Promise<void>;
  buildDevContainer: (workspacePath: string, configPath?: string, onProgress?: (message: string) => void) => Promise<DevContainer>;
  loadDevContainerConfig: (configPath: string) => Promise<DevContainerConfig>;
  saveDevContainerConfig: (config: DevContainerConfig, workspacePath: string) => Promise<void>;
  loadDevContainerFeatures: () => Promise<void>;
  loadDevContainerTemplates: () => Promise<void>;
  getActiveContainer: () => DevContainer | null;
}

const RemoteContext = createContext<RemoteContextValue>();

// Storage keys
const PORT_FORWARDING_SETTINGS_KEY = "cortex_port_forwarding_settings";

// Port detection patterns
const PORT_PATTERNS = [
  // Common server startup patterns
  /(?:listening|running|started|server|serving)\s+(?:on|at)\s+(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)?[:\s]+(\d{2,5})/gi,
  // Direct port mentions
  /port[:\s]+(\d{2,5})/gi,
  // URL patterns
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/gi,
  // Common dev server patterns
  /(?:webpack|vite|next|nuxt|gatsby|parcel|esbuild|dev)\s+(?:dev\s+)?(?:server\s+)?(?:at|on)\s+(?:https?:\/\/)?[^:]+:(\d{2,5})/gi,
  // Docker exposed ports
  /->(\d{2,5})\/tcp/gi,
  // Forwarding patterns
  /forwarding\s+(?:to|from)\s+(?:https?:\/\/)?[^:]+:(\d{2,5})/gi,
];

// Common ports to filter out (system ports that aren't usually dev servers)
const EXCLUDED_PORTS = new Set([22, 23, 25, 53, 67, 68, 69, 110, 123, 137, 138, 139, 143, 161, 162, 389, 445, 514, 636, 993, 995]);

function loadPortForwardingSettings(): { autoForward: boolean } {
  try {
    const stored = localStorage.getItem(PORT_FORWARDING_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.debug("[Remote] Parse settings failed:", err);
  }
  return { autoForward: true };
}

function savePortForwardingSettings(settings: { autoForward: boolean }): void {
  try {
    localStorage.setItem(PORT_FORWARDING_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.debug("[Remote] Save settings failed:", err);
  }
}

export function RemoteProvider(props: ParentProps) {
  const savedSettings = loadPortForwardingSettings();
  const [autoForward, setAutoForwardSignal] = createSignal(savedSettings.autoForward);
  
  const [state, setState] = createStore<RemoteState>({
    profiles: [],
    connections: [],
    activeConnectionId: null,
    isLoading: false,
    error: null,
    forwardedPorts: [],
    detectedPorts: [],
    autoForwardPorts: savedSettings.autoForward,
    tunnels: [],
    // WSL State
    wslAvailable: false,
    wslDistros: [],
    activeWSLDistro: null,
    // Dev Container State
    containers: [],
    activeContainerId: null,
    availableDevContainerConfigs: [],
    availableDevContainerFeatures: [],
    availableDevContainerTemplates: [],
  });
  
  // Track already notified ports to avoid duplicates
  const notifiedPorts = new Set<string>();

  // Load profiles on mount
  createEffect(() => {
    loadProfiles();
  });

  // Periodic connection health check
  createEffect(() => {
    const interval = setInterval(async () => {
      for (const conn of state.connections) {
        if (conn.status === "connected") {
          try {
            await invoke("remote_get_status", { connectionId: conn.id });
          } catch (e) {
            console.warn(`Connection ${conn.id} health check failed:`, e);
            setState("connections", (c) => c.id === conn.id, "status", { error: { message: String(e) } });
          }
        }
      }
    }, 30000); // Check every 30 seconds

    onCleanup(() => clearInterval(interval));
  });

  const loadProfiles = async () => {
    setState("isLoading", true);
    setState("error", null);
    try {
      const profiles = await invoke<ConnectionProfile[]>("remote_get_profiles");
      setState("profiles", profiles);
    } catch (e) {
      console.error("Failed to load profiles:", e);
      setState("error", String(e));
    } finally {
      setState("isLoading", false);
    }
  };

  const saveProfile = async (profile: ConnectionProfile) => {
    try {
      await invoke("remote_save_profile", { profile });
      await loadProfiles();
    } catch (e) {
      console.error("Failed to save profile:", e);
      throw e;
    }
  };

  const deleteProfile = async (profileId: string) => {
    try {
      await invoke("remote_delete_profile", { profileId });
      await loadProfiles();
    } catch (e) {
      console.error("Failed to delete profile:", e);
      throw e;
    }
  };

  const generateProfileId = async (): Promise<string> => {
    return await invoke<string>("remote_generate_profile_id");
  };

  const getDefaultKeyPaths = async (): Promise<string[]> => {
    return await invoke<string[]>("remote_get_default_key_paths");
  };

  const connect = async (profile: ConnectionProfile): Promise<ConnectionInfo> => {
    setState("isLoading", true);
    setState("error", null);
    
    // Update connection state to connecting
    const existingIndex = state.connections.findIndex((c) => c.id === profile.id);
    if (existingIndex >= 0) {
      setState("connections", existingIndex, "status", "connecting");
    } else {
      setState("connections", (conns) => [
        ...conns,
        {
          id: profile.id,
          profile,
          status: "connecting" as ConnectionStatus,
          home_directory: undefined,
          platform: undefined,
        },
      ]);
    }

    try {
      const info = await invoke<ConnectionInfo>("remote_connect", { profile });
      
      // Update connection info
      setState(
        "connections",
        (c) => c.id === info.id,
        produce((conn) => {
          conn.status = "connected";
          conn.home_directory = info.home_directory;
          conn.platform = info.platform;
        })
      );
      
      setState("activeConnectionId", info.id);
      setState("isLoading", false);
      return info;
    } catch (e) {
      console.error("Failed to connect:", e);
      setState(
        "connections",
        (c) => c.id === profile.id,
        "status",
        { error: { message: String(e) } }
      );
      setState("error", String(e));
      setState("isLoading", false);
      throw e;
    }
  };

  const disconnect = async (connectionId: string) => {
    try {
      await invoke("remote_disconnect", { connectionId });
      setState("connections", (conns) => conns.filter((c) => c.id !== connectionId));
      
      if (state.activeConnectionId === connectionId) {
        const remaining = state.connections.filter((c) => c.id !== connectionId);
        setState("activeConnectionId", remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (e) {
      console.error("Failed to disconnect:", e);
      throw e;
    }
  };

  const reconnect = async (connectionId: string): Promise<ConnectionInfo> => {
    const connection = state.connections.find((c) => c.id === connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    
    // Disconnect first (ignore errors)
    try {
      await invoke("remote_disconnect", { connectionId });
    } catch (err) {
      console.debug("[Remote] Disconnect failed:", err);
    }
    
    // Reconnect with the same profile
    return await connect(connection.profile);
  };

  const setActiveConnection = (connectionId: string | null) => {
    setState("activeConnectionId", connectionId);
  };

  const getActiveConnection = (): ConnectionInfo | null => {
    if (!state.activeConnectionId) return null;
    return state.connections.find((c) => c.id === state.activeConnectionId) || null;
  };

  const listDirectory = async (connectionId: string, path: string): Promise<RemoteFileEntry[]> => {
    return await invoke<RemoteFileEntry[]>("remote_list_directory", { connectionId, path });
  };

  const getFileTree = async (connectionId: string, path: string, depth: number = 3): Promise<RemoteFileNode> => {
    return await invoke<RemoteFileNode>("remote_get_file_tree", { connectionId, path, depth });
  };

  const readFile = async (connectionId: string, path: string): Promise<string> => {
    return await invoke<string>("remote_read_file", { connectionId, path });
  };

  const writeFile = async (connectionId: string, path: string, content: string): Promise<void> => {
    try {
      await invoke("remote_write_file", { connectionId, path, content });
    } catch (error) {
      console.error("Remote writeFile failed:", error);
      throw error;
    }
  };

  const deleteFile = async (connectionId: string, path: string, recursive: boolean = false): Promise<void> => {
    try {
      await invoke("remote_delete", { connectionId, path, recursive });
    } catch (error) {
      console.error("Remote deleteFile failed:", error);
      throw error;
    }
  };

  const createDirectory = async (connectionId: string, path: string, recursive: boolean = true): Promise<void> => {
    try {
      await invoke("remote_create_directory", { connectionId, path, recursive });
    } catch (error) {
      console.error("Remote createDirectory failed:", error);
      throw error;
    }
  };

  const rename = async (connectionId: string, oldPath: string, newPath: string): Promise<void> => {
    try {
      await invoke("remote_rename", { connectionId, oldPath, newPath });
    } catch (error) {
      console.error("Remote rename failed:", error);
      throw error;
    }
  };

  const stat = async (connectionId: string, path: string): Promise<RemoteFileEntry> => {
    return await invoke<RemoteFileEntry>("remote_stat", { connectionId, path });
  };

  const executeCommand = async (connectionId: string, command: string, workingDir?: string): Promise<CommandResult> => {
    return await invoke<CommandResult>("remote_execute_command", { connectionId, command, workingDir });
  };

  // Port forwarding functions
  const generatePortId = (): string => {
    return `port_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const forwardPort = async (
    connectionId: string,
    localPort: number,
    remotePort: number,
    remoteHost: string = "localhost"
  ): Promise<ForwardedPort> => {
    // Check if port is already forwarded
    const existing = state.forwardedPorts.find(
      (p) => p.localPort === localPort && p.connectionId === connectionId && p.status === "active"
    );
    if (existing) {
      throw new Error(`Local port ${localPort} is already forwarded`);
    }

    const portId = generatePortId();
    const newPort: ForwardedPort = {
      id: portId,
      localPort,
      remoteHost,
      remotePort,
      status: "connecting",
      connectionId,
      createdAt: Date.now(),
      autoDetected: false,
    };

    setState("forwardedPorts", (ports) => [...ports, newPort]);

    try {
      // Call backend to establish port forwarding
      await invoke("remote_forward_port", {
        connectionId,
        localPort,
        remoteHost,
        remotePort,
      });

      setState(
        "forwardedPorts",
        (p) => p.id === portId,
        produce((port) => {
          port.status = "active";
        })
      );

      return { ...newPort, status: "active" };
    } catch (e) {
      setState(
        "forwardedPorts",
        (p) => p.id === portId,
        produce((port) => {
          port.status = "error";
          port.error = String(e);
        })
      );
      throw e;
    }
  };

  const stopForwarding = async (portId: string): Promise<void> => {
    const port = state.forwardedPorts.find((p) => p.id === portId);
    if (!port) {
      return;
    }

    try {
      await invoke("remote_stop_forward", {
        connectionId: port.connectionId,
        localPort: port.localPort,
      });
    } catch (e) {
      console.warn("Failed to stop port forwarding:", e);
    }

    setState("forwardedPorts", (ports) => ports.filter((p) => p.id !== portId));
  };

  const getForwardedPorts = (connectionId?: string): ForwardedPort[] => {
    if (connectionId) {
      return state.forwardedPorts.filter((p) => p.connectionId === connectionId);
    }
    return state.forwardedPorts;
  };

  const setAutoForwardPorts = (enabled: boolean) => {
    setAutoForwardSignal(enabled);
    setState("autoForwardPorts", enabled);
    savePortForwardingSettings({ autoForward: enabled });
  };

  const clearDetectedPorts = () => {
    setState("detectedPorts", []);
    notifiedPorts.clear();
  };

  const extractPortsFromText = (text: string): number[] => {
    const ports = new Set<number>();
    
    for (const pattern of PORT_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const port = parseInt(match[1], 10);
        if (port >= 1024 && port <= 65535 && !EXCLUDED_PORTS.has(port)) {
          ports.add(port);
        }
      }
    }
    
    return Array.from(ports);
  };

  const processTerminalOutput = (connectionId: string, output: string) => {
    const detectedPortNumbers = extractPortsFromText(output);
    
    for (const port of detectedPortNumbers) {
      const portKey = `${connectionId}:${port}`;
      
      // Skip if already notified
      if (notifiedPorts.has(portKey)) {
        continue;
      }
      
      // Skip if already forwarded
      const alreadyForwarded = state.forwardedPorts.some(
        (p) => p.remotePort === port && p.connectionId === connectionId && p.status === "active"
      );
      if (alreadyForwarded) {
        continue;
      }
      
      notifiedPorts.add(portKey);
      
      const detectedPort: DetectedPort = {
        port,
        protocol: output.toLowerCase().includes("https") ? "https" : "http",
        source: output.substring(0, 100),
        timestamp: Date.now(),
      };
      
      setState("detectedPorts", (ports) => {
        // Avoid duplicates
        if (ports.some((p) => p.port === port)) {
          return ports;
        }
        return [...ports, detectedPort];
      });
      
      // Emit event for notification
      window.dispatchEvent(
        new CustomEvent("remote:port-detected", {
          detail: { connectionId, port: detectedPort },
        })
      );
      
      // Auto-forward if enabled
      if (state.autoForwardPorts) {
        forwardPort(connectionId, port, port, "localhost").catch((e) => {
          console.warn(`Auto-forward failed for port ${port}:`, e);
        });
      }
    }
  };

  const openForwardedPort = (portId: string) => {
    const port = state.forwardedPorts.find((p) => p.id === portId);
    if (port && port.status === "active") {
      const protocol = "http"; // Default to http, could be made configurable
      const url = `${protocol}://localhost:${port.localPort}`;
      window.open(url, "_blank");
    }
  };

  // Remote Tunnel functions
  const generateTunnelId = (): string => {
    return `tunnel_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  const createTunnel = async (localPort: number, authProvider: TunnelAuthProvider): Promise<TunnelInfo> => {
    const existingTunnel = state.tunnels.find(
      (t) => t.localPort === localPort && (t.status === "active" || t.status === "connecting")
    );
    if (existingTunnel) {
      throw new Error(`A tunnel is already active on port ${localPort}`);
    }

    const tunnelId = generateTunnelId();
    const newTunnel: TunnelInfo = {
      id: tunnelId,
      url: "",
      status: "connecting",
      authProvider,
      localPort,
      createdAt: Date.now(),
    };

    setState("tunnels", (tunnels) => [...tunnels, newTunnel]);

    try {
      const result = await invoke<{ url: string; expires_at?: number }>("tunnel_create", {
        localPort,
        authProvider,
      });

      const activeTunnel: TunnelInfo = {
        ...newTunnel,
        url: result.url,
        status: "active",
        expiresAt: result.expires_at,
      };

      setState(
        "tunnels",
        (t) => t.id === tunnelId,
        produce((tunnel) => {
          tunnel.url = result.url;
          tunnel.status = "active";
          tunnel.expiresAt = result.expires_at;
        })
      );

      window.dispatchEvent(
        new CustomEvent("remote:tunnel-created", {
          detail: { tunnel: activeTunnel },
        })
      );

      return activeTunnel;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      
      setState(
        "tunnels",
        (t) => t.id === tunnelId,
        produce((tunnel) => {
          tunnel.status = "error";
          tunnel.error = errorMsg;
        })
      );
      
      throw new Error(`Failed to create tunnel: ${errorMsg}`);
    }
  };

  const connectToTunnel = async (tunnelUrl: string): Promise<TunnelInfo> => {
    const normalizedUrl = tunnelUrl.startsWith("http") ? tunnelUrl : `https://${tunnelUrl}`;
    
    const existingTunnel = state.tunnels.find(
      (t) => t.url === normalizedUrl && (t.status === "active" || t.status === "connecting")
    );
    if (existingTunnel) {
      return existingTunnel;
    }

    const tunnelId = generateTunnelId();
    const newTunnel: TunnelInfo = {
      id: tunnelId,
      url: normalizedUrl,
      status: "connecting",
      authProvider: "github",
      localPort: 0,
      createdAt: Date.now(),
    };

    setState("tunnels", (tunnels) => [...tunnels, newTunnel]);

    try {
      const result = await invoke<{ local_port: number; auth_provider: TunnelAuthProvider; expires_at?: number }>(
        "tunnel_connect",
        { tunnelUrl: normalizedUrl }
      );

      const connectedTunnel: TunnelInfo = {
        ...newTunnel,
        status: "active",
        authProvider: result.auth_provider,
        localPort: result.local_port,
        expiresAt: result.expires_at,
      };

      setState(
        "tunnels",
        (t) => t.id === tunnelId,
        produce((tunnel) => {
          tunnel.status = "active";
          tunnel.authProvider = result.auth_provider;
          tunnel.localPort = result.local_port;
          tunnel.expiresAt = result.expires_at;
        })
      );

      window.dispatchEvent(
        new CustomEvent("remote:tunnel-connected", {
          detail: { tunnel: connectedTunnel },
        })
      );

      return connectedTunnel;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      
      setState(
        "tunnels",
        (t) => t.id === tunnelId,
        produce((tunnel) => {
          tunnel.status = "error";
          tunnel.error = errorMsg;
        })
      );
      
      throw new Error(`Failed to connect to tunnel: ${errorMsg}`);
    }
  };

  const closeTunnel = async (tunnelId: string): Promise<void> => {
    const tunnel = state.tunnels.find((t) => t.id === tunnelId);
    if (!tunnel) {
      return;
    }

    setState(
      "tunnels",
      (t) => t.id === tunnelId,
      produce((t) => {
        t.status = "closing";
      })
    );

    try {
      await invoke("tunnel_close", { tunnelId: tunnel.id, localPort: tunnel.localPort });
    } catch (e) {
      console.warn("Failed to close tunnel gracefully:", e);
    }

    setState("tunnels", (tunnels) => tunnels.filter((t) => t.id !== tunnelId));

    window.dispatchEvent(
      new CustomEvent("remote:tunnel-closed", {
        detail: { tunnelId },
      })
    );
  };

  const getTunnels = (): TunnelInfo[] => {
    return state.tunnels;
  };

  const refreshTunnel = async (tunnelId: string): Promise<TunnelInfo> => {
    const tunnel = state.tunnels.find((t) => t.id === tunnelId);
    if (!tunnel) {
      throw new Error(`Tunnel not found: ${tunnelId}`);
    }

    if (tunnel.status !== "active") {
      throw new Error("Cannot refresh a tunnel that is not active");
    }

    setState(
      "tunnels",
      (t) => t.id === tunnelId,
      produce((t) => {
        t.status = "connecting";
      })
    );

    try {
      const result = await invoke<{ url: string; expires_at?: number }>("tunnel_refresh", {
        tunnelId: tunnel.id,
        localPort: tunnel.localPort,
      });

      setState(
        "tunnels",
        (t) => t.id === tunnelId,
        produce((t) => {
          t.status = "active";
          t.url = result.url;
          t.expiresAt = result.expires_at;
          t.error = undefined;
        })
      );

      return {
        ...tunnel,
        url: result.url,
        status: "active",
        expiresAt: result.expires_at,
        error: undefined,
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      
      setState(
        "tunnels",
        (t) => t.id === tunnelId,
        produce((t) => {
          t.status = "error";
          t.error = errorMsg;
        })
      );
      
      throw new Error(`Failed to refresh tunnel: ${errorMsg}`);
    }
  };

  // WSL functions
  const detectWSL = async (): Promise<void> => {
    try {
      const result = await invoke<{ available: boolean; distros: WSLDistro[] }>("wsl_detect");
      setState("wslAvailable", result.available);
      setState("wslDistros", result.distros);
    } catch (e) {
      console.warn("WSL detection failed:", e);
      setState("wslAvailable", false);
      setState("wslDistros", []);
    }
  };

  const connectToWSL = async (distroName: string): Promise<void> => {
    const distroIndex = state.wslDistros.findIndex((d) => d.name === distroName);
    if (distroIndex === -1) {
      throw new Error(`WSL distro not found: ${distroName}`);
    }

    setState("wslDistros", distroIndex, "status", "connecting");

    try {
      const result = await invoke<{ base_path: string }>("wsl_connect", { distroName });
      setState("wslDistros", distroIndex, produce((d) => {
        d.status = "connected";
        d.basePath = result.base_path;
        d.error = undefined;
      }));
      setState("activeWSLDistro", distroName);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("wslDistros", distroIndex, produce((d) => {
        d.status = "error";
        d.error = errorMsg;
      }));
      throw e;
    }
  };

  const disconnectFromWSL = async (distroName: string): Promise<void> => {
    const distroIndex = state.wslDistros.findIndex((d) => d.name === distroName);
    if (distroIndex === -1) {
      return;
    }

    try {
      await invoke("wsl_disconnect", { distroName });
    } catch (e) {
      console.warn("WSL disconnect failed:", e);
    }

    setState("wslDistros", distroIndex, produce((d) => {
      d.status = "disconnected";
      d.basePath = undefined;
    }));

    if (state.activeWSLDistro === distroName) {
      setState("activeWSLDistro", null);
    }
  };

  const openFolderInWSL = async (distroName: string, folderPath: string): Promise<void> => {
    try {
      await invoke("wsl_open_folder", { distroName, folderPath });
    } catch (error) {
      console.error("WSL openFolder failed:", error);
      throw error;
    }
  };

  const openTerminalInWSL = async (distroName: string, cwd?: string): Promise<void> => {
    try {
      await invoke("wsl_open_terminal", { distroName, cwd });
    } catch (error) {
      console.error("WSL openTerminal failed:", error);
      throw error;
    }
  };

  const getWSLDistros = (): WSLDistro[] => {
    return state.wslDistros;
  };

  const getActiveWSLDistro = (): WSLDistro | null => {
    if (!state.activeWSLDistro) return null;
    return state.wslDistros.find((d) => d.name === state.activeWSLDistro) || null;
  };

  // Dev Container operations
  const listContainers = async (): Promise<void> => {
    try {
      const containers = await invoke<DevContainer[]>("devcontainer_list");
      setState("containers", containers);
    } catch (e) {
      console.error("Failed to list containers:", e);
      setState("containers", []);
    }
  };

  const connectToContainer = async (containerId: string): Promise<void> => {
    const containerIndex = state.containers.findIndex((c) => c.id === containerId);
    if (containerIndex === -1) {
      throw new Error(`Container not found: ${containerId}`);
    }

    if (state.containers[containerIndex].status !== "running") {
      throw new Error("Container must be running to connect");
    }

    try {
      await invoke("devcontainer_connect", { containerId });
      setState("activeContainerId", containerId);
      
      window.dispatchEvent(
        new CustomEvent("devcontainer:connected", {
          detail: { containerId, name: state.containers[containerIndex].name },
        })
      );
    } catch (e) {
      console.error("Failed to connect to container:", e);
      throw e;
    }
  };

  const startContainer = async (containerId: string): Promise<void> => {
    const containerIndex = state.containers.findIndex((c) => c.id === containerId);
    if (containerIndex === -1) {
      throw new Error(`Container not found: ${containerId}`);
    }

    setState("containers", containerIndex, "status", "starting");
    setState("containers", containerIndex, "error", undefined);

    try {
      await invoke("devcontainer_start", { containerId });
      setState("containers", containerIndex, "status", "running");
      setState("containers", containerIndex, "startedAt", Date.now());
    } catch (e) {
      setState("containers", containerIndex, "status", "error");
      setState("containers", containerIndex, "error", String(e));
      throw e;
    }
  };

  const stopContainer = async (containerId: string): Promise<void> => {
    const containerIndex = state.containers.findIndex((c) => c.id === containerId);
    if (containerIndex === -1) {
      throw new Error(`Container not found: ${containerId}`);
    }

    try {
      await invoke("devcontainer_stop", { containerId });
      setState("containers", containerIndex, "status", "stopped");
      setState("containers", containerIndex, "startedAt", undefined);
      setState("containers", containerIndex, "cpuUsage", undefined);
      setState("containers", containerIndex, "memoryUsage", undefined);

      if (state.activeContainerId === containerId) {
        setState("activeContainerId", null);
        window.dispatchEvent(
          new CustomEvent("devcontainer:disconnected", { detail: { containerId } })
        );
      }
    } catch (e) {
      console.error("Failed to stop container:", e);
      throw e;
    }
  };

  const removeContainer = async (containerId: string): Promise<void> => {
    const container = state.containers.find((c) => c.id === containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    if (container.status === "running") {
      await stopContainer(containerId);
    }

    try {
      await invoke("devcontainer_remove", { containerId });
      setState("containers", (containers) => containers.filter((c) => c.id !== containerId));

      if (state.activeContainerId === containerId) {
        setState("activeContainerId", null);
      }
    } catch (e) {
      console.error("Failed to remove container:", e);
      throw e;
    }
  };

  const buildDevContainer = async (
    workspacePath: string,
    configPath?: string,
    onProgress?: (message: string) => void
  ): Promise<DevContainer> => {
    const buildId = `build_${Date.now()}`;
    
    const tempContainer: DevContainer = {
      id: buildId,
      name: `Building: ${workspacePath.split("/").pop() || "container"}`,
      status: "building",
      workspacePath,
      configPath,
    };
    
    setState("containers", (containers) => [...containers, tempContainer]);

    const handleProgress = (event: Event) => {
      const customEvent = event as CustomEvent<{ buildId: string; message: string }>;
      if (customEvent.detail.buildId === buildId) {
        onProgress?.(customEvent.detail.message);
      }
    };

    window.addEventListener("devcontainer:build-progress", handleProgress);

    try {
      const container = await invoke<DevContainer>("devcontainer_build", {
        workspacePath,
        configPath,
        buildId,
      });

      setState("containers", (containers) =>
        containers.map((c) => (c.id === buildId ? container : c))
      );

      return container;
    } catch (e) {
      setState("containers", (containers) =>
        containers.map((c) =>
          c.id === buildId
            ? { ...c, status: "error" as ContainerStatus, error: String(e) }
            : c
        )
      );
      throw e;
    } finally {
      window.removeEventListener("devcontainer:build-progress", handleProgress);
    }
  };

  const loadDevContainerConfig = async (configPath: string): Promise<DevContainerConfig> => {
    try {
      return await invoke<DevContainerConfig>("devcontainer_load_config", { configPath });
    } catch (e) {
      console.error("Failed to load devcontainer config:", e);
      throw e;
    }
  };

  const saveDevContainerConfig = async (
    config: DevContainerConfig,
    workspacePath: string
  ): Promise<void> => {
    try {
      await invoke("devcontainer_save_config", { config, workspacePath });
      
      setState("availableDevContainerConfigs", (configs) => {
        const existingIndex = configs.findIndex((c) => c.path === config.path);
        if (existingIndex >= 0) {
          return configs.map((c, i) => (i === existingIndex ? config : c));
        }
        return [...configs, config];
      });
    } catch (e) {
      console.error("Failed to save devcontainer config:", e);
      throw e;
    }
  };

  const loadDevContainerFeatures = async (): Promise<void> => {
    try {
      const features = await invoke<DevContainerFeature[]>("devcontainer_list_features");
      setState("availableDevContainerFeatures", features);
    } catch (e) {
      console.error("Failed to load devcontainer features:", e);
      setState("availableDevContainerFeatures", getDefaultFeatures());
    }
  };

  const loadDevContainerTemplates = async (): Promise<void> => {
    try {
      const templates = await invoke<DevContainerTemplate[]>("devcontainer_list_templates");
      setState("availableDevContainerTemplates", templates);
    } catch (e) {
      console.error("Failed to load devcontainer templates:", e);
      setState("availableDevContainerTemplates", getDefaultTemplates());
    }
  };

  const getActiveContainer = (): DevContainer | null => {
    if (!state.activeContainerId) return null;
    return state.containers.find((c) => c.id === state.activeContainerId) || null;
  };

  // Clean up forwarded ports when disconnecting
  const originalDisconnect = disconnect;
  const disconnectWithPortCleanup = async (connectionId: string) => {
    // Stop all port forwards for this connection
    const portsToStop = state.forwardedPorts.filter((p) => p.connectionId === connectionId);
    for (const port of portsToStop) {
      try {
        await stopForwarding(port.id);
      } catch {
        // Ignore errors during cleanup
      }
    }
    
    // Clear detected ports for this connection
    setState("detectedPorts", (ports) => ports.filter((_p) => {
      // We can't filter by connectionId here since DetectedPort doesn't have it
      // This is fine - detected ports are transient suggestions
      return true;
    }));
    
    await originalDisconnect(connectionId);
  };

  return (
    <RemoteContext.Provider
      value={{
        state,
        loadProfiles,
        saveProfile,
        deleteProfile,
        generateProfileId,
        getDefaultKeyPaths,
        connect,
        disconnect: disconnectWithPortCleanup,
        reconnect,
        setActiveConnection,
        getActiveConnection,
        listDirectory,
        getFileTree,
        readFile,
        writeFile,
        deleteFile,
        createDirectory,
        rename,
        stat,
        executeCommand,
        forwardPort,
        stopForwarding,
        getForwardedPorts,
        setAutoForwardPorts,
        autoForward,
        clearDetectedPorts,
        processTerminalOutput,
        openForwardedPort,
        createTunnel,
        connectToTunnel,
        closeTunnel,
        getTunnels,
        refreshTunnel,
        detectWSL,
        connectToWSL,
        disconnectFromWSL,
        openFolderInWSL,
        openTerminalInWSL,
        getWSLDistros,
        getActiveWSLDistro,
        listContainers,
        connectToContainer,
        startContainer,
        stopContainer,
        removeContainer,
        buildDevContainer,
        loadDevContainerConfig,
        saveDevContainerConfig,
        loadDevContainerFeatures,
        loadDevContainerTemplates,
        getActiveContainer,
      }}
    >
      {props.children}
    </RemoteContext.Provider>
  );
}

export function useRemote() {
  const context = useContext(RemoteContext);
  if (!context) {
    throw new Error("useRemote must be used within RemoteProvider");
  }
  return context;
}

// Default features when backend fetch fails
function getDefaultFeatures(): DevContainerFeature[] {
  return [
    {
      id: "ghcr.io/devcontainers/features/node:1",
      name: "Node.js",
      description: "Installs Node.js, nvm, yarn, and pnpm",
      version: "1",
      options: {
        version: { type: "string", default: "lts", description: "Node.js version to install" },
        nodeGypDependencies: { type: "boolean", default: true, description: "Install node-gyp dependencies" },
      },
    },
    {
      id: "ghcr.io/devcontainers/features/python:1",
      name: "Python",
      description: "Installs Python, pip, and pyenv",
      version: "1",
      options: {
        version: { type: "string", default: "latest", description: "Python version to install" },
        installTools: { type: "boolean", default: true, description: "Install common Python tools" },
      },
    },
    {
      id: "ghcr.io/devcontainers/features/rust:1",
      name: "Rust",
      description: "Installs Rust, rustup, and common Rust utilities",
      version: "1",
      options: {
        version: { type: "string", default: "latest", description: "Rust version to install" },
        profile: { type: "string", default: "default", enum: ["minimal", "default", "complete"], description: "Rustup profile" },
      },
    },
    {
      id: "ghcr.io/devcontainers/features/go:1",
      name: "Go",
      description: "Installs Go programming language",
      version: "1",
      options: {
        version: { type: "string", default: "latest", description: "Go version to install" },
      },
    },
    {
      id: "ghcr.io/devcontainers/features/docker-in-docker:2",
      name: "Docker in Docker",
      description: "Install Docker CLI and engine inside container",
      version: "2",
      options: {
        version: { type: "string", default: "latest", description: "Docker version" },
        moby: { type: "boolean", default: true, description: "Use Moby instead of Docker CE" },
      },
    },
    {
      id: "ghcr.io/devcontainers/features/git:1",
      name: "Git",
      description: "Install Git version control",
      version: "1",
      options: {
        version: { type: "string", default: "latest", description: "Git version" },
        ppa: { type: "boolean", default: true, description: "Use PPA for latest version" },
      },
    },
    {
      id: "ghcr.io/devcontainers/features/github-cli:1",
      name: "GitHub CLI",
      description: "Install the GitHub CLI (gh)",
      version: "1",
      options: {
        version: { type: "string", default: "latest", description: "GitHub CLI version" },
      },
    },
    {
      id: "ghcr.io/devcontainers/features/aws-cli:1",
      name: "AWS CLI",
      description: "Install the AWS CLI",
      version: "1",
      options: {
        version: { type: "string", default: "latest", description: "AWS CLI version" },
      },
    },
  ];
}

// Default templates when backend fetch fails
function getDefaultTemplates(): DevContainerTemplate[] {
  return [
    {
      id: "node",
      name: "Node.js",
      description: "Develop Node.js applications",
      category: "Languages",
      icon: "🟢",
      config: {
        name: "Node.js Dev Container",
        path: ".devcontainer/devcontainer.json",
        image: "mcr.microsoft.com/devcontainers/javascript-node:1-20",
        features: {},
        forwardPorts: [3000],
        postCreateCommand: "npm install",
        customizations: {
          vscode: {
            extensions: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"],
          },
        },
      },
    },
    {
      id: "typescript-node",
      name: "Node.js & TypeScript",
      description: "Develop Node.js TypeScript applications",
      category: "Languages",
      icon: "💙",
      config: {
        name: "Node.js & TypeScript Dev Container",
        path: ".devcontainer/devcontainer.json",
        image: "mcr.microsoft.com/devcontainers/typescript-node:1-20",
        features: {},
        forwardPorts: [3000],
        postCreateCommand: "npm install",
        customizations: {
          vscode: {
            extensions: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"],
          },
        },
      },
    },
    {
      id: "python",
      name: "Python",
      description: "Develop Python applications",
      category: "Languages",
      icon: "🐍",
      config: {
        name: "Python Dev Container",
        path: ".devcontainer/devcontainer.json",
        image: "mcr.microsoft.com/devcontainers/python:1-3.11",
        features: {},
        forwardPorts: [8000],
        postCreateCommand: "pip install -r requirements.txt",
        customizations: {
          vscode: {
            extensions: ["ms-python.python", "ms-python.vscode-pylance"],
          },
        },
      },
    },
    {
      id: "rust",
      name: "Rust",
      description: "Develop Rust applications",
      category: "Languages",
      icon: "🦀",
      config: {
        name: "Rust Dev Container",
        path: ".devcontainer/devcontainer.json",
        image: "mcr.microsoft.com/devcontainers/rust:1",
        features: {},
        postCreateCommand: "cargo build",
        customizations: {
          vscode: {
            extensions: ["rust-lang.rust-analyzer", "tamasfe.even-better-toml"],
          },
        },
      },
    },
    {
      id: "go",
      name: "Go",
      description: "Develop Go applications",
      category: "Languages",
      icon: "🐹",
      config: {
        name: "Go Dev Container",
        path: ".devcontainer/devcontainer.json",
        image: "mcr.microsoft.com/devcontainers/go:1-1.21",
        features: {},
        forwardPorts: [8080],
        postCreateCommand: "go mod download",
        customizations: {
          vscode: {
            extensions: ["golang.go"],
          },
        },
      },
    },
    {
      id: "ubuntu",
      name: "Ubuntu",
      description: "Basic Ubuntu environment",
      category: "Base",
      icon: "🐧",
      config: {
        name: "Ubuntu Dev Container",
        path: ".devcontainer/devcontainer.json",
        image: "mcr.microsoft.com/devcontainers/base:ubuntu",
        features: {},
      },
    },
    {
      id: "debian",
      name: "Debian",
      description: "Basic Debian environment",
      category: "Base",
      icon: "🌀",
      config: {
        name: "Debian Dev Container",
        path: ".devcontainer/devcontainer.json",
        image: "mcr.microsoft.com/devcontainers/base:debian",
        features: {},
      },
    },
    {
      id: "alpine",
      name: "Alpine",
      description: "Lightweight Alpine Linux environment",
      category: "Base",
      icon: "🏔️",
      config: {
        name: "Alpine Dev Container",
        path: ".devcontainer/devcontainer.json",
        image: "mcr.microsoft.com/devcontainers/base:alpine",
        features: {},
      },
    },
  ];
}

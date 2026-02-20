/**
 * Tunnel Context
 *
 * SolidJS context for remote tunnel management.
 * Wraps Tauri IPC calls for tunnel lifecycle operations.
 */

import {
  createContext,
  useContext,
  ParentProps,
  onMount,
  createMemo,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "../utils/logger";

const tunnelLogger = createLogger("Tunnel");

// ============================================================================
// Types
// ============================================================================

export type TunnelAuthProvider = "github" | "microsoft";

export type TunnelStatus = "inactive" | "connecting" | "active" | "error" | "closing";

export interface TunnelInfo {
  id: string;
  name: string;
  url: string;
  status: TunnelStatus;
  authProvider: TunnelAuthProvider;
  localPort: number;
  relayUrl: string;
  connectionCode: string;
  createdAt: string;
  expiresAt?: string;
  error?: string;
}

// ============================================================================
// Validation
// ============================================================================

const TUNNEL_URL_RE = /^wss:\/\/.+/;

function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be an integer between 1 and 65535");
  }
}

function validateTunnelUrl(url: string): void {
  if (!url || typeof url !== "string") {
    throw new Error("Tunnel URL is required");
  }
  if (!TUNNEL_URL_RE.test(url)) {
    throw new Error("Tunnel URL must use wss:// scheme");
  }
}

// ============================================================================
// State
// ============================================================================

interface TunnelState {
  tunnels: TunnelInfo[];
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Context Value Interface
// ============================================================================

interface TunnelContextValue {
  state: TunnelState;
  createTunnel: (localPort: number, authProvider: TunnelAuthProvider, name?: string) => Promise<TunnelInfo>;
  connectToTunnel: (tunnelUrl: string) => Promise<TunnelInfo>;
  disconnectTunnel: (tunnelId: string) => Promise<void>;
  getTunnelStatus: (tunnelId: string) => Promise<TunnelInfo>;
  refreshTunnels: () => Promise<void>;
  activeTunnels: Accessor<TunnelInfo[]>;
  activeTunnelCount: Accessor<number>;
}

// ============================================================================
// Context
// ============================================================================

const TunnelContext = createContext<TunnelContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function TunnelProvider(props: ParentProps) {
  const [state, setState] = createStore<TunnelState>({
    tunnels: [],
    isLoading: false,
    error: null,
  });

  // ============================================================================
  // Derived State
  // ============================================================================

  const activeTunnels = createMemo(() =>
    state.tunnels.filter((t) => t.status === "active")
  );

  const activeTunnelCount = createMemo(() => activeTunnels().length);

  // ============================================================================
  // Tunnel Operations
  // ============================================================================

  const createTunnel = async (
    localPort: number,
    authProvider: TunnelAuthProvider,
    name?: string
  ): Promise<TunnelInfo> => {
    validatePort(localPort);

    setState("isLoading", true);
    setState("error", null);

    try {
      const tunnel = await invoke<TunnelInfo>("remote_tunnel_create", {
        localPort,
        authProvider,
        name,
      });

      setState("tunnels", (tunnels) => [...tunnels, tunnel]);
      tunnelLogger.debug("Tunnel created:", tunnel.id);
      return tunnel;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      throw new Error(errorMsg);
    } finally {
      setState("isLoading", false);
    }
  };

  const connectToTunnel = async (tunnelUrl: string): Promise<TunnelInfo> => {
    validateTunnelUrl(tunnelUrl);

    setState("isLoading", true);
    setState("error", null);

    try {
      const tunnel = await invoke<TunnelInfo>("remote_tunnel_connect", {
        tunnelUrl,
      });

      setState("tunnels", (tunnels) => {
        const existing = tunnels.findIndex((t) => t.id === tunnel.id);
        if (existing >= 0) {
          return tunnels.map((t, i) => (i === existing ? tunnel : t));
        }
        return [...tunnels, tunnel];
      });

      tunnelLogger.debug("Connected to tunnel:", tunnel.id);
      return tunnel;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      throw new Error(errorMsg);
    } finally {
      setState("isLoading", false);
    }
  };

  const disconnectTunnel = async (tunnelId: string): Promise<void> => {
    setState(
      "tunnels",
      (t) => t.id === tunnelId,
      produce((t) => {
        t.status = "closing";
      })
    );

    try {
      await invoke("remote_tunnel_disconnect", { tunnelId });
      setState("tunnels", (tunnels) => tunnels.filter((t) => t.id !== tunnelId));
      tunnelLogger.debug("Tunnel disconnected:", tunnelId);
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
      throw new Error(errorMsg);
    }
  };

  const getTunnelStatus = async (tunnelId: string): Promise<TunnelInfo> => {
    try {
      const tunnel = await invoke<TunnelInfo>("remote_tunnel_status", { tunnelId });

      setState(
        "tunnels",
        (t) => t.id === tunnelId,
        produce((t) => {
          t.status = tunnel.status;
          t.url = tunnel.url;
          t.expiresAt = tunnel.expiresAt;
          t.error = tunnel.error;
        })
      );

      return tunnel;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      throw new Error(errorMsg);
    }
  };

  const refreshTunnels = async (): Promise<void> => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const tunnels = await invoke<TunnelInfo[]>("remote_tunnel_list");
      setState("tunnels", tunnels);
      tunnelLogger.debug("Tunnels refreshed, count:", tunnels.length);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState("error", errorMsg);
      tunnelLogger.debug("Failed to refresh tunnels:", errorMsg);
    } finally {
      setState("isLoading", false);
    }
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    refreshTunnels();
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: TunnelContextValue = {
    state,
    createTunnel,
    connectToTunnel,
    disconnectTunnel,
    getTunnelStatus,
    refreshTunnels,
    activeTunnels,
    activeTunnelCount,
  };

  return (
    <TunnelContext.Provider value={contextValue}>
      {props.children}
    </TunnelContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTunnel(): TunnelContextValue {
  const context = useContext(TunnelContext);
  if (!context) {
    throw new Error("useTunnel must be used within TunnelProvider");
  }
  return context;
}

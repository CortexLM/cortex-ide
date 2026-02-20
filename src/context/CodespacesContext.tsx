/**
 * GitHub Codespaces Context
 * 
 * Provides GitHub Codespaces integration for the application.
 * Manages authentication, listing, creating, and connecting to codespaces.
 */

import {
  createContext,
  useContext,
  createEffect,
  onCleanup,
  ParentProps,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { createLogger } from "../utils/logger";

const codespacesLogger = createLogger("Codespaces");

// Storage keys
const GITHUB_AUTH_KEY = "cortex_github_codespaces_auth";
const CODESPACES_SETTINGS_KEY = "cortex_codespaces_settings";

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = "Ov23liYSLpqMfzqg8B1s"; // Placeholder - should be configured
const GITHUB_SCOPES = ["codespace", "repo", "user"];

// Types
export type CodespaceState = 
  | "Unknown"
  | "Created"
  | "Queued"
  | "Provisioning"
  | "Available"
  | "Awaiting"
  | "Unavailable"
  | "Deleted"
  | "Moved"
  | "Shutdown"
  | "Archived"
  | "Starting"
  | "ShuttingDown"
  | "Failed"
  | "Exporting"
  | "Updating"
  | "Rebuilding";

export type MachineDisplayName = "2-core" | "4-core" | "8-core" | "16-core" | "32-core";

export interface CodespaceMachine {
  name: string;
  display_name: MachineDisplayName;
  operating_system: string;
  storage_in_bytes: number;
  memory_in_bytes: number;
  cpus: number;
  prebuild_availability: "none" | "ready" | "in_progress";
}

export interface CodespaceRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  html_url: string;
  default_branch: string;
}

export interface Codespace {
  id: number;
  name: string;
  display_name?: string;
  environment_id?: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  billable_owner: {
    login: string;
  };
  repository: CodespaceRepository;
  machine?: CodespaceMachine;
  prebuild: boolean;
  devcontainer_path?: string;
  created_at: string;
  updated_at: string;
  last_used_at: string;
  state: CodespaceState;
  url: string;
  git_status: {
    ahead: number;
    behind: number;
    has_uncommitted_changes: boolean;
    has_unpushed_changes: boolean;
    ref: string;
  };
  location: string;
  idle_timeout_minutes: number;
  web_url: string;
  machines_url: string;
  start_url: string;
  stop_url: string;
  recent_folders: string[];
  runtime_constraints?: {
    allowed_port_privacy_settings?: string[];
  };
  pending_operation?: boolean;
  pending_operation_disabled_reason?: string;
  retention_period_minutes?: number;
  retention_expires_at?: string;
}

export interface CreateCodespaceOptions {
  repository_id: number;
  ref?: string;
  location?: string;
  geo?: "EuropeWest" | "SoutheastAsia" | "UsEast" | "UsWest";
  client_ip?: string;
  machine?: string;
  devcontainer_path?: string;
  multi_repo_permissions_opt_out?: boolean;
  working_directory?: string;
  idle_timeout_minutes?: number;
  display_name?: string;
  retention_period_minutes?: number;
}

export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  avatar_url: string;
  email?: string;
}

export interface GitHubAuthState {
  accessToken: string | null;
  user: GitHubUser | null;
  expiresAt?: number;
  scopes: string[];
}

export interface CodespacesSettings {
  defaultMachine: MachineDisplayName;
  defaultIdleTimeout: number;
  defaultRetentionDays: number;
  autoStartOnConnect: boolean;
  preferredRegion: string;
}

interface CodespacesState {
  auth: GitHubAuthState;
  codespaces: Codespace[];
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;
  settings: CodespacesSettings;
  lastRefresh: number | null;
}

interface CodespacesContextValue {
  state: CodespacesState;
  
  // Authentication
  authenticate: () => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
  getUser: () => GitHubUser | null;
  
  // Codespaces operations
  listCodespaces: () => Promise<Codespace[]>;
  getCodespace: (codespaceName: string) => Promise<Codespace>;
  createCodespace: (options: CreateCodespaceOptions) => Promise<Codespace>;
  deleteCodespace: (codespaceName: string) => Promise<void>;
  startCodespace: (codespaceName: string) => Promise<Codespace>;
  stopCodespace: (codespaceName: string) => Promise<Codespace>;
  
  // Connection
  openInBrowser: (codespace: Codespace) => Promise<void>;
  openInVSCode: (codespace: Codespace) => Promise<void>;
  connectViaSSH: (codespace: Codespace) => Promise<void>;
  
  // Utilities
  refreshCodespaces: () => Promise<void>;
  getCodespacesByRepo: (repoFullName: string) => Codespace[];
  getRunningCodespaces: () => Codespace[];
  
  // Settings
  updateSettings: (settings: Partial<CodespacesSettings>) => void;
  
  // Repository helpers
  getAvailableMachines: (repositoryId: number) => Promise<CodespaceMachine[]>;
  searchRepositories: (query: string) => Promise<CodespaceRepository[]>;
}

const CodespacesContext = createContext<CodespacesContextValue>();

// Default settings
const DEFAULT_SETTINGS: CodespacesSettings = {
  defaultMachine: "2-core",
  defaultIdleTimeout: 30,
  defaultRetentionDays: 30,
  autoStartOnConnect: true,
  preferredRegion: "UsEast",
};

/** Load auth state from localStorage */
function loadAuthState(): GitHubAuthState {
  try {
    const stored = localStorage.getItem(GITHUB_AUTH_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Check if token is expired
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem(GITHUB_AUTH_KEY);
        return { accessToken: null, user: null, scopes: [] };
      }
      return parsed;
    }
  } catch (e) {
    console.error("[Codespaces] Failed to load auth state:", e);
  }
  return { accessToken: null, user: null, scopes: [] };
}

/** Save auth state to localStorage */
function saveAuthState(auth: GitHubAuthState): void {
  try {
    localStorage.setItem(GITHUB_AUTH_KEY, JSON.stringify(auth));
  } catch (e) {
    console.error("[Codespaces] Failed to save auth state:", e);
  }
}

/** Load settings from localStorage */
function loadSettings(): CodespacesSettings {
  try {
    const stored = localStorage.getItem(CODESPACES_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("[Codespaces] Failed to load settings:", e);
  }
  return DEFAULT_SETTINGS;
}

/** Save settings to localStorage */
function saveSettings(settings: CodespacesSettings): void {
  try {
    localStorage.setItem(CODESPACES_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("[Codespaces] Failed to save settings:", e);
  }
}

/** GitHub API helper */
async function githubApi<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `GitHub API error: ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export function CodespacesProvider(props: ParentProps) {
  const [state, setState] = createStore<CodespacesState>({
    auth: loadAuthState(),
    codespaces: [],
    isLoading: false,
    isAuthenticating: false,
    error: null,
    settings: loadSettings(),
    lastRefresh: null,
  });

  // OAuth callback handler
  let oauthWindow: Window | null = null;
  let oauthCheckInterval: number | null = null;

  onCleanup(() => {
    if (oauthCheckInterval) {
      clearInterval(oauthCheckInterval);
    }
    if (oauthWindow && !oauthWindow.closed) {
      oauthWindow.close();
    }
  });

  // Auto-refresh codespaces when authenticated
  createEffect(() => {
    if (state.auth.accessToken && !state.lastRefresh) {
      refreshCodespaces();
    }
  });

  /** Start GitHub OAuth flow */
  const authenticate = async () => {
    setState("isAuthenticating", true);
    setState("error", null);

    try {
      // Try to use Tauri backend for OAuth if available
      try {
        const result = await invoke<{ access_token: string; user: GitHubUser; scopes: string[] }>(
          "github_oauth_authenticate",
          { clientId: GITHUB_CLIENT_ID, scopes: GITHUB_SCOPES }
        );

        const authState: GitHubAuthState = {
          accessToken: result.access_token,
          user: result.user,
          scopes: result.scopes,
        };

        setState("auth", authState);
        saveAuthState(authState);
        await refreshCodespaces();
        return;
      } catch (e) {
        codespacesLogger.debug("Tauri OAuth not available, using browser flow");
      }

      // Fallback to browser-based OAuth
      const state_param = crypto.randomUUID();
      const redirect_uri = "http://localhost:21345/oauth/callback"; // Local callback server
      
      const authUrl = new URL("https://github.com/login/oauth/authorize");
      authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirect_uri);
      authUrl.searchParams.set("scope", GITHUB_SCOPES.join(" "));
      authUrl.searchParams.set("state", state_param);

      // Open OAuth window
      oauthWindow = window.open(
        authUrl.toString(),
        "GitHub OAuth",
        "width=600,height=700,menubar=no,toolbar=no"
      );

      // Listen for OAuth callback via Tauri event
      const unlisten = await import("@tauri-apps/api/event").then(({ listen }) =>
        listen<{ code: string; state: string }>("github-oauth-callback", async (event) => {
          if (event.payload.state !== state_param) {
            setState("error", "OAuth state mismatch - possible CSRF attack");
            return;
          }

          try {
            // Exchange code for token via backend
            const result = await invoke<{ access_token: string; scopes: string[] }>(
              "github_oauth_exchange_code",
              { code: event.payload.code }
            );

            // Fetch user info
            const user = await githubApi<GitHubUser>("/user", result.access_token);

            const authState: GitHubAuthState = {
              accessToken: result.access_token,
              user,
              scopes: result.scopes,
            };

            setState("auth", authState);
            saveAuthState(authState);
            await refreshCodespaces();
          } catch (e) {
            setState("error", `OAuth exchange failed: ${e}`);
          } finally {
            unlisten();
          }
        })
      );

      // Also check if window was closed without completing OAuth
      oauthCheckInterval = setInterval(() => {
        if (oauthWindow && oauthWindow.closed) {
          clearInterval(oauthCheckInterval!);
          oauthCheckInterval = null;
          if (!state.auth.accessToken) {
            setState("error", "OAuth cancelled by user");
            setState("isAuthenticating", false);
          }
        }
      }, 500) as unknown as number;

    } catch (e) {
      console.error("[Codespaces] Authentication failed:", e);
      setState("error", String(e));
    } finally {
      setState("isAuthenticating", false);
    }
  };

  /** Logout and clear stored auth */
  const logout = () => {
    setState("auth", { accessToken: null, user: null, scopes: [] });
    setState("codespaces", []);
    setState("lastRefresh", null);
    localStorage.removeItem(GITHUB_AUTH_KEY);
  };

  /** Check if user is authenticated */
  const isAuthenticated = () => {
    return !!state.auth.accessToken;
  };

  /** Get current user */
  const getUser = () => {
    return state.auth.user;
  };

  /** List all user's codespaces */
  const listCodespaces = async (): Promise<Codespace[]> => {
    if (!state.auth.accessToken) {
      throw new Error("Not authenticated");
    }

    setState("isLoading", true);
    setState("error", null);

    try {
      const response = await githubApi<{ codespaces: Codespace[] }>(
        "/user/codespaces",
        state.auth.accessToken
      );

      setState("codespaces", response.codespaces);
      setState("lastRefresh", Date.now());
      return response.codespaces;
    } catch (e) {
      console.error("[Codespaces] Failed to list codespaces:", e);
      setState("error", String(e));
      throw e;
    } finally {
      setState("isLoading", false);
    }
  };

  /** Get a specific codespace */
  const getCodespace = async (codespaceName: string): Promise<Codespace> => {
    if (!state.auth.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      return await githubApi<Codespace>(
        `/user/codespaces/${codespaceName}`,
        state.auth.accessToken
      );
    } catch (e) {
      console.error("[Codespaces] Failed to get codespace:", e);
      throw e;
    }
  };

  /** Create a new codespace */
  const createCodespace = async (options: CreateCodespaceOptions): Promise<Codespace> => {
    if (!state.auth.accessToken) {
      throw new Error("Not authenticated");
    }

    setState("isLoading", true);
    setState("error", null);

    try {
      const codespace = await githubApi<Codespace>(
        "/user/codespaces",
        state.auth.accessToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
        }
      );

      // Add to local list
      setState("codespaces", (prev) => [codespace, ...prev]);
      return codespace;
    } catch (e) {
      console.error("[Codespaces] Failed to create codespace:", e);
      setState("error", String(e));
      throw e;
    } finally {
      setState("isLoading", false);
    }
  };

  /** Delete a codespace */
  const deleteCodespace = async (codespaceName: string): Promise<void> => {
    if (!state.auth.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      await githubApi<void>(
        `/user/codespaces/${codespaceName}`,
        state.auth.accessToken,
        { method: "DELETE" }
      );

      // Remove from local list
      setState("codespaces", (prev) => prev.filter((c) => c.name !== codespaceName));
    } catch (e) {
      console.error("[Codespaces] Failed to delete codespace:", e);
      throw e;
    }
  };

  /** Start a codespace */
  const startCodespace = async (codespaceName: string): Promise<Codespace> => {
    if (!state.auth.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const codespace = await githubApi<Codespace>(
        `/user/codespaces/${codespaceName}/start`,
        state.auth.accessToken,
        { method: "POST" }
      );

      // Update local list
      setState(
        "codespaces",
        (c) => c.name === codespaceName,
        produce((c) => {
          Object.assign(c, codespace);
        })
      );

      return codespace;
    } catch (e) {
      console.error("[Codespaces] Failed to start codespace:", e);
      throw e;
    }
  };

  /** Stop a codespace */
  const stopCodespace = async (codespaceName: string): Promise<Codespace> => {
    if (!state.auth.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const codespace = await githubApi<Codespace>(
        `/user/codespaces/${codespaceName}/stop`,
        state.auth.accessToken,
        { method: "POST" }
      );

      // Update local list
      setState(
        "codespaces",
        (c) => c.name === codespaceName,
        produce((c) => {
          Object.assign(c, codespace);
        })
      );

      return codespace;
    } catch (e) {
      console.error("[Codespaces] Failed to stop codespace:", e);
      throw e;
    }
  };

  /** Open codespace in browser */
  const openInBrowser = async (codespace: Codespace) => {
    await open(codespace.web_url);
  };

  /** Open codespace in VS Code desktop */
  const openInVSCode = async (codespace: Codespace) => {
    // VS Code URL scheme for codespaces
    const vscodeUrl = `vscode://github.codespaces/connect?name=${encodeURIComponent(codespace.name)}&windowId=_blank`;
    
    try {
      await open(vscodeUrl);
    } catch (e) {
      // Fallback to web URL if VS Code isn't installed
      console.warn("[Codespaces] VS Code not available, opening in browser:", e);
      await openInBrowser(codespace);
    }
  };

  /** Connect to codespace via SSH */
  const connectViaSSH = async (codespace: Codespace) => {
    // This requires GitHub CLI to be installed
    // gh codespace ssh -c <codespace-name>
    try {
      // Create a new terminal
      const terminalInfo = await invoke<{ id: string }>("terminal_create", {
        options: {
          name: `SSH: ${codespace.display_name || codespace.name}`,
        },
      });
      
      // Write the SSH command to the terminal
      // Small delay to let the shell initialize
      await new Promise((resolve) => setTimeout(resolve, 500));
      await invoke("terminal_write", {
        terminalId: terminalInfo.id,
        data: `gh codespace ssh -c ${codespace.name}\n`,
      });
    } catch (e) {
      console.error("[Codespaces] Failed to connect via SSH:", e);
      // Show instructions for installing gh CLI
      window.dispatchEvent(
        new CustomEvent("toast:show", {
          detail: {
            type: "error",
            message: "SSH connection requires GitHub CLI (gh). Please install it first.",
          },
        })
      );
    }
  };

  /** Refresh codespaces list */
  const refreshCodespaces = async () => {
    if (!state.auth.accessToken) return;
    
    await listCodespaces();
  };

  /** Get codespaces for a specific repository */
  const getCodespacesByRepo = (repoFullName: string): Codespace[] => {
    return state.codespaces.filter((c) => c.repository.full_name === repoFullName);
  };

  /** Get all running codespaces */
  const getRunningCodespaces = (): Codespace[] => {
    return state.codespaces.filter((c) => c.state === "Available");
  };

  /** Update settings */
  const updateSettings = (settings: Partial<CodespacesSettings>) => {
    setState("settings", (prev) => {
      const newSettings = { ...prev, ...settings };
      saveSettings(newSettings);
      return newSettings;
    });
  };

  /** Get available machines for a repository */
  const getAvailableMachines = async (repositoryId: number): Promise<CodespaceMachine[]> => {
    if (!state.auth.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await githubApi<{ machines: CodespaceMachine[] }>(
        `/repositories/${repositoryId}/codespaces/machines`,
        state.auth.accessToken
      );
      return response.machines;
    } catch (e) {
      console.error("[Codespaces] Failed to get machines:", e);
      throw e;
    }
  };

  /** Search repositories for codespace creation */
  const searchRepositories = async (query: string): Promise<CodespaceRepository[]> => {
    if (!state.auth.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await githubApi<{ items: CodespaceRepository[] }>(
        `/search/repositories?q=${encodeURIComponent(query)}+in:name&per_page=10`,
        state.auth.accessToken
      );
      return response.items;
    } catch (e) {
      console.error("[Codespaces] Failed to search repositories:", e);
      throw e;
    }
  };

  // Periodic refresh of codespaces (every 5 minutes when authenticated)
  createEffect(() => {
    if (!state.auth.accessToken) return;

    const interval = setInterval(() => {
      refreshCodespaces();
    }, 5 * 60 * 1000);

    onCleanup(() => clearInterval(interval));
  });

  return (
    <CodespacesContext.Provider
      value={{
        state,
        authenticate,
        logout,
        isAuthenticated,
        getUser,
        listCodespaces,
        getCodespace,
        createCodespace,
        deleteCodespace,
        startCodespace,
        stopCodespace,
        openInBrowser,
        openInVSCode,
        connectViaSSH,
        refreshCodespaces,
        getCodespacesByRepo,
        getRunningCodespaces,
        updateSettings,
        getAvailableMachines,
        searchRepositories,
      }}
    >
      {props.children}
    </CodespacesContext.Provider>
  );
}

export function useCodespaces() {
  const context = useContext(CodespacesContext);
  if (!context) {
    throw new Error("useCodespaces must be used within CodespacesProvider");
  }
  return context;
}

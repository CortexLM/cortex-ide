/**
 * Extension Host Context
 *
 * SolidJS context provider for the WASM-based Extension Host system.
 * Provides crash-isolated extension execution via Tauri IPC to the
 * wasmtime-based backend runtime.
 *
 * @example
 * ```tsx
 * <ExtensionHostProvider
 *   extensions={extensions}
 *   autoStart={true}
 * >
 *   <App />
 * </ExtensionHostProvider>
 *
 * function MyComponent() {
 *   const { executeCommand, isReady } = useExtensionHost();
 *
 *   const handleClick = async () => {
 *     if (isReady()) {
 *       await executeCommand("myExtension.doSomething");
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>Execute</button>;
 * }
 * ```
 */

import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  onCleanup,
  onMount,
  Accessor,
  ParentProps,
  createMemo,
  batch,
  Component,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Enums & Types (previously from extension-host module)
// ============================================================================

export enum ExtensionHostStatus {
  Stopped = 0,
  Starting = 1,
  Ready = 2,
  Crashed = 3,
}

export enum ExtensionStatus {
  Inactive = 0,
  Activating = 1,
  Active = 2,
  Deactivating = 3,
  Error = 4,
  Crashed = 5,
}

export enum LogLevel {
  Trace = 0,
  Debug = 1,
  Info = 2,
  Warning = 3,
  Error = 4,
}

export interface ExtensionDescription {
  id: string;
  name: string;
  version: string;
  path: string;
  main: string;
  activationEvents: string[];
  dependencies: string[];
  extensionKind: number[];
}

export interface ExtensionRuntimeState {
  id: string;
  status: ExtensionStatus;
  activationTime?: number;
  error?: string;
  exports?: unknown;
  lastActivity?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface ExtensionActivatedPayload {
  extensionId: string;
  activationTime: number;
  exports?: unknown;
}

export interface ExtensionErrorPayload {
  extensionId: string;
  error: string;
  phase: string;
}

export interface WorkspaceFolder {
  uri: string;
  name: string;
  index: number;
}

export interface Disposable {
  dispose(): void;
}

export function createUri(path: string): string {
  return `file://${path}`;
}

// ============================================================================
// Types
// ============================================================================

export interface ExtensionLogEntry {
  id: string;
  timestamp: number;
  extensionId: string;
  level: LogLevel;
  message: string;
}

export interface ExtensionHostStats {
  status: ExtensionHostStatus;
  uptime: number;
  extensionCount: number;
  activeExtensions: number;
  totalActivationTime: number;
  restartCount: number;
  lastCrash?: {
    timestamp: number;
    error: string;
  };
}

export interface ExtensionHostOptions {
  extensions: ExtensionDescription[];
  workspaceFolders?: WorkspaceFolder[];
  configuration?: Record<string, unknown>;
  logLevel?: LogLevel;
  maxLogs?: number;
  autoStart?: boolean;
  autoRestart?: boolean;
  maxRestarts?: number;
  restartDelay?: number;
}

export interface ExtensionHostAPI {
  status: Accessor<ExtensionHostStatus>;
  isReady: Accessor<boolean>;
  isStarting: Accessor<boolean>;
  extensions: Accessor<ExtensionRuntimeState[]>;
  activeExtensions: Accessor<ExtensionRuntimeState[]>;
  logs: Accessor<ExtensionLogEntry[]>;
  stats: Accessor<ExtensionHostStats>;
  lastError: Accessor<Error | null>;

  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;

  activateExtension: (extensionId: string) => Promise<void>;
  deactivateExtension: (extensionId: string) => Promise<void>;
  getExtensionState: (extensionId: string) => ExtensionRuntimeState | undefined;
  isExtensionActive: (extensionId: string) => boolean;

  executeCommand: <T = unknown>(commandId: string, ...args: unknown[]) => Promise<T>;
  registerCommand: (commandId: string, handler: (...args: unknown[]) => unknown) => Disposable;

  sendEvent: (eventName: string, data: unknown) => void;

  clearLogs: () => void;
  getExtensionLogs: (extensionId: string) => ExtensionLogEntry[];
}

// ============================================================================
// Context
// ============================================================================

const ExtensionHostContext = createContext<ExtensionHostAPI>();

export function useExtensionHost(): ExtensionHostAPI {
  const context = useContext(ExtensionHostContext);
  if (!context) {
    throw new Error(
      "useExtensionHost must be used within an ExtensionHostProvider"
    );
  }
  return context;
}

// ============================================================================
// Provider Props
// ============================================================================

export interface ExtensionHostProviderProps extends ParentProps, ExtensionHostOptions {
  onReady?: () => void;
  onExtensionActivated?: (payload: ExtensionActivatedPayload) => void;
  onExtensionError?: (payload: ExtensionErrorPayload) => void;
  onCrash?: (error: Error) => void;
  onRestart?: (attempt: number) => void;
}

// ============================================================================
// Provider Implementation
// ============================================================================

export const ExtensionHostProvider: Component<ExtensionHostProviderProps> = (props) => {
  const maxLogs = () => props.maxLogs ?? 1000;
  const autoStart = () => props.autoStart ?? true;

  const [status, setStatus] = createSignal<ExtensionHostStatus>(
    ExtensionHostStatus.Stopped
  );
  const [extensions, setExtensions] = createStore<ExtensionRuntimeState[]>([]);
  const [logs, setLogs] = createSignal<ExtensionLogEntry[]>([]);
  const [lastError, setLastError] = createSignal<Error | null>(null);
  const [startTime, setStartTime] = createSignal<number | null>(null);
  const [restartCount, setRestartCount] = createSignal(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lastCrash, _setLastCrash] = createSignal<{ timestamp: number; error: string } | null>(null);

  let logIdCounter = 0;
  const commandHandlers = new Map<string, (...args: unknown[]) => unknown>();

  const isReady = createMemo(() => status() === ExtensionHostStatus.Ready);
  const isStarting = createMemo(() => status() === ExtensionHostStatus.Starting);
  const activeExtensions = createMemo(() =>
    extensions.filter((e) => e.status === ExtensionStatus.Active)
  );

  const stats = createMemo((): ExtensionHostStats => {
    const start = startTime();
    return {
      status: status(),
      uptime: start ? Date.now() - start : 0,
      extensionCount: extensions.length,
      activeExtensions: activeExtensions().length,
      totalActivationTime: extensions.reduce(
        (sum, e) => sum + (e.activationTime ?? 0),
        0
      ),
      restartCount: restartCount(),
      lastCrash: lastCrash() ?? undefined,
    };
  });

  // ============================================================================
  // Extension State Management
  // ============================================================================

  const updateExtensionState = (
    extensionId: string,
    update: Partial<ExtensionRuntimeState>
  ): void => {
    setExtensions(
      produce((draft) => {
        const index = draft.findIndex((e) => e.id === extensionId);
        if (index >= 0) {
          Object.assign(draft[index], update, { lastActivity: Date.now() });
        } else {
          draft.push({
            id: extensionId,
            status: ExtensionStatus.Inactive,
            ...update,
            lastActivity: Date.now(),
          } as ExtensionRuntimeState);
        }
      })
    );
  };

  const addLog = (entry: Omit<ExtensionLogEntry, "id">): void => {
    const log: ExtensionLogEntry = {
      ...entry,
      id: `log_${++logIdCounter}_${Date.now()}`,
    };

    setLogs((prev) => {
      const next = [...prev, log];
      const max = maxLogs();
      if (next.length > max) {
        return next.slice(-max);
      }
      return next;
    });
  };

  // ============================================================================
  // Host Lifecycle (WASM via Tauri IPC)
  // ============================================================================

  const start = async (): Promise<void> => {
    if (status() === ExtensionHostStatus.Ready) {
      console.warn("[ExtensionHostProvider] Host already started");
      return;
    }

    if (props.extensions.length === 0) {
      console.info("[ExtensionHostProvider] No extensions to load");
      setStatus(ExtensionHostStatus.Ready);
      return;
    }

    setStatus(ExtensionHostStatus.Starting);
    setLastError(null);

    try {
      const initialStates: ExtensionRuntimeState[] = props.extensions.map((ext) => ({
        id: ext.id,
        status: ExtensionStatus.Inactive,
      }));
      setExtensions(initialStates);

      for (const ext of props.extensions) {
        try {
          await invoke("load_wasm_extension", {
            extensionId: ext.id,
            wasmPath: ext.path + "/" + ext.main,
          });

          updateExtensionState(ext.id, {
            status: ExtensionStatus.Active,
            activationTime: 0,
          });

          addLog({
            timestamp: Date.now(),
            extensionId: ext.id,
            level: LogLevel.Info,
            message: "Activated via WASM runtime",
          });

          props.onExtensionActivated?.({
            extensionId: ext.id,
            activationTime: 0,
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          updateExtensionState(ext.id, {
            status: ExtensionStatus.Error,
            error: errMsg,
          });

          addLog({
            timestamp: Date.now(),
            extensionId: ext.id,
            level: LogLevel.Error,
            message: `Failed to load: ${errMsg}`,
          });

          props.onExtensionError?.({
            extensionId: ext.id,
            error: errMsg,
            phase: "activation",
          });
        }
      }

      setStartTime(Date.now());

      batch(() => {
        setStatus(ExtensionHostStatus.Ready);
        setLastError(null);
      });

      addLog({
        timestamp: Date.now(),
        extensionId: "extension-host",
        level: LogLevel.Info,
        message: "Extension host ready",
      });

      props.onReady?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setLastError(err);
      setStatus(ExtensionHostStatus.Crashed);
      throw err;
    }
  };

  const stop = async (): Promise<void> => {
    if (status() === ExtensionHostStatus.Stopped) {
      return;
    }

    try {
      for (const ext of extensions) {
        try {
          await invoke("unload_wasm_extension", { extensionId: ext.id });
        } catch (error) {
          console.error(`[ExtensionHostProvider] Error unloading ${ext.id}:`, error);
        }
      }
    } finally {
      setExtensions([]);
      setStartTime(null);
      setStatus(ExtensionHostStatus.Stopped);
    }
  };

  const restart = async (): Promise<void> => {
    await stop();
    setRestartCount((c) => c + 1);
    props.onRestart?.(restartCount());
    await start();
  };

  // ============================================================================
  // Extension Control
  // ============================================================================

  const activateExtension = async (extensionId: string): Promise<void> => {
    updateExtensionState(extensionId, {
      status: ExtensionStatus.Activating,
    });

    try {
      const ext = props.extensions.find((e) => e.id === extensionId);
      if (!ext) {
        throw new Error(`Extension not found: ${extensionId}`);
      }

      await invoke("load_wasm_extension", {
        extensionId: ext.id,
        wasmPath: ext.path + "/" + ext.main,
      });

      updateExtensionState(extensionId, {
        status: ExtensionStatus.Active,
        activationTime: 0,
      });
    } catch (error) {
      updateExtensionState(extensionId, {
        status: ExtensionStatus.Error,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const deactivateExtension = async (extensionId: string): Promise<void> => {
    updateExtensionState(extensionId, {
      status: ExtensionStatus.Deactivating,
    });

    try {
      await invoke("unload_wasm_extension", { extensionId });

      updateExtensionState(extensionId, {
        status: ExtensionStatus.Inactive,
        exports: undefined,
      });
    } catch (error) {
      updateExtensionState(extensionId, {
        status: ExtensionStatus.Error,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const getExtensionState = (extensionId: string): ExtensionRuntimeState | undefined => {
    return extensions.find((e) => e.id === extensionId);
  };

  const isExtensionActive = (extensionId: string): boolean => {
    const state = getExtensionState(extensionId);
    return state?.status === ExtensionStatus.Active;
  };

  // ============================================================================
  // Command Execution
  // ============================================================================

  const executeCommand = async <T = unknown>(
    commandId: string,
    ...args: unknown[]
  ): Promise<T> => {
    if (!isReady()) {
      throw new Error("Extension host not ready");
    }

    const localHandler = commandHandlers.get(commandId);
    if (localHandler) {
      return localHandler(...args) as T;
    }

    const parts = commandId.split(".");
    const extensionId = parts.length > 1 ? parts[0] : commandId;

    const result = await invoke<T>("execute_wasm_command", {
      extensionId,
      command: commandId,
      args: args.length > 0 ? args : undefined,
    });

    return result;
  };

  const registerCommand = (
    commandId: string,
    handler: (...args: unknown[]) => unknown
  ): Disposable => {
    commandHandlers.set(commandId, handler);
    return {
      dispose: () => {
        commandHandlers.delete(commandId);
      },
    };
  };

  // ============================================================================
  // Events
  // ============================================================================

  const sendEvent = (_eventName: string, _data: unknown): void => {
    // Events are handled via Tauri event system
  };

  // ============================================================================
  // Utilities
  // ============================================================================

  const clearLogs = (): void => {
    setLogs([]);
  };

  const getExtensionLogs = (extensionId: string): ExtensionLogEntry[] => {
    return logs().filter((log) => log.extensionId === extensionId);
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    if (autoStart()) {
      start().catch((error) => {
        console.error("[ExtensionHostProvider] Auto-start failed:", error);
      });
    }
  });

  onCleanup(() => {
    stop().catch((error) => {
      console.error("[ExtensionHostProvider] Cleanup failed:", error);
    });
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const api: ExtensionHostAPI = {
    status,
    isReady,
    isStarting,
    extensions: () => extensions,
    activeExtensions,
    logs,
    stats,
    lastError,

    start,
    stop,
    restart,

    activateExtension,
    deactivateExtension,
    getExtensionState,
    isExtensionActive,

    executeCommand,
    registerCommand,

    sendEvent,

    clearLogs,
    getExtensionLogs,
  };

  return (
    <ExtensionHostContext.Provider value={api}>
      {props.children}
    </ExtensionHostContext.Provider>
  );
};

// ============================================================================
// Utility Hooks
// ============================================================================

export function useExtension(extensionId: string): Accessor<ExtensionRuntimeState | undefined> {
  const { extensions } = useExtensionHost();
  return createMemo(() => extensions().find((e) => e.id === extensionId));
}

export function useExtensionActive(extensionId: string): Accessor<boolean> {
  const extension = useExtension(extensionId);
  return createMemo(() => extension()?.status === ExtensionStatus.Active);
}

export function useCommand<T = unknown, Args extends unknown[] = unknown[]>(
  commandId: string
): (...args: Args) => Promise<T> {
  const { executeCommand, isReady } = useExtensionHost();

  return async (...args: Args): Promise<T> => {
    if (!isReady()) {
      throw new Error("Extension host not ready");
    }
    return executeCommand<T>(commandId, ...args);
  };
}

export function useCommandHandler(
  commandId: string,
  handler: (...args: unknown[]) => unknown
): void {
  const { registerCommand, isReady } = useExtensionHost();

  createEffect(() => {
    if (isReady()) {
      const disposable = registerCommand(commandId, handler);
      onCleanup(() => disposable.dispose());
    }
  });
}

export function useExtensionLogs(
  extensionId?: string,
  minLevel?: LogLevel
): Accessor<ExtensionLogEntry[]> {
  const { logs } = useExtensionHost();

  return createMemo(() => {
    let filtered = logs();

    if (extensionId) {
      filtered = filtered.filter((log) => log.extensionId === extensionId);
    }

    if (minLevel !== undefined) {
      filtered = filtered.filter((log) => log.level >= minLevel);
    }

    return filtered;
  });
}

export function useExtensionEvent(eventName: string): (data: unknown) => void {
  const { sendEvent, isReady } = useExtensionHost();

  return (data: unknown): void => {
    if (isReady()) {
      sendEvent(eventName, data);
    }
  };
}

export function useExtensionHostStats(): Accessor<ExtensionHostStats> {
  const { stats } = useExtensionHost();
  return stats;
}

export function useExtensionHostReady(): Accessor<boolean> {
  const { isReady } = useExtensionHost();
  return isReady;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createWorkspaceFolders(paths: string[]): WorkspaceFolder[] {
  return paths.map((path, index) => ({
    uri: createUri(path),
    name: path.split(/[/\\]/).pop() ?? path,
    index,
  }));
}

export function manifestToDescription(
  manifest: {
    name: string;
    version: string;
    main?: string;
    activationEvents?: string[];
    dependencies?: string[];
    extensionKind?: ("ui" | "workspace")[];
  },
  path: string
): ExtensionDescription {
  return {
    id: manifest.name,
    name: manifest.name,
    version: manifest.version,
    path,
    main: manifest.main ?? "dist/extension.js",
    activationEvents: manifest.activationEvents ?? ["*"],
    dependencies: manifest.dependencies ?? [],
    extensionKind: (manifest.extensionKind ?? ["workspace"]).map((k) =>
      k === "ui" ? 1 : 2
    ),
  };
}

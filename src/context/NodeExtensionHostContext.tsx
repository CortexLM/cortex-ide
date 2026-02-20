/**
 * NodeExtensionHostContext — SolidJS context for the Node.js-based
 * VS Code-compatible Extension Host.
 *
 * Manages the lifecycle of the Node.js sidecar process that runs VS Code
 * extensions natively.  Exposes signals for host status, installed
 * extensions, active extensions, and contributed UI elements (menus,
 * views, status bar items).
 *
 * This is independent of the WASM-based ExtensionHostContext which
 * handles Cortex-native WASM plugins.
 */

import {
  createContext,
  useContext,
  createSignal,
  onMount,
  onCleanup,
  Accessor,
  ParentProps,
  JSX,
  batch,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// ============================================================================
// Types
// ============================================================================

export type NodeHostStatus = "stopped" | "starting" | "ready" | "error";

export interface InstalledVscodeExtension {
  id: string;
  name: string;
  displayName?: string;
  version: string;
  path: string;
  activationEvents: string[];
}

export interface NodeExtensionState {
  extensionId: string;
  status: "inactive" | "activating" | "active" | "error";
  activationTimeMs?: number;
  error?: string;
}

export interface ContributedStatusBarItem {
  itemId: string;
  extensionId: string;
  text: string;
  tooltip?: string;
  command?: string;
  alignment?: "left" | "right";
  priority?: number;
}

export interface ContributedTreeView {
  viewId: string;
  extensionId: string;
  title: string;
}

export interface ContributedWebviewPanel {
  panelId: string;
  extensionId: string;
  title: string;
  html?: string;
}

export interface ContributedMenu {
  menuId: string;
  extensionId: string;
  command?: string;
  group?: string;
  when?: string;
}

export interface NodeExtensionHostAPI {
  status: Accessor<NodeHostStatus>;
  lastError: Accessor<string | null>;
  installedExtensions: Accessor<InstalledVscodeExtension[]>;
  activeExtensions: Accessor<NodeExtensionState[]>;
  statusBarItems: Accessor<ContributedStatusBarItem[]>;
  treeViews: Accessor<ContributedTreeView[]>;
  webviewPanels: Accessor<ContributedWebviewPanel[]>;
  menus: Accessor<ContributedMenu[]>;

  startHost: () => Promise<void>;
  stopHost: () => Promise<void>;
  installExtension: (extensionId: string) => Promise<InstalledVscodeExtension>;
  activateExtension: (extensionId: string) => Promise<void>;
  callExtensionApi: (
    namespace: string,
    method: string,
    args?: unknown
  ) => Promise<unknown>;
  refreshInstalled: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const NodeExtensionHostContext = createContext<NodeExtensionHostAPI>();

export function useNodeExtensionHost(): NodeExtensionHostAPI {
  const ctx = useContext(NodeExtensionHostContext);
  if (!ctx) {
    throw new Error(
      "useNodeExtensionHost must be used within a NodeExtensionHostProvider"
    );
  }
  return ctx;
}

// ============================================================================
// Provider
// ============================================================================

export function NodeExtensionHostProvider(props: ParentProps): JSX.Element {
  const [status, setStatus] = createSignal<NodeHostStatus>("stopped");
  const [lastError, setLastError] = createSignal<string | null>(null);
  const [installedExtensions, setInstalledExtensions] = createSignal<
    InstalledVscodeExtension[]
  >([]);
  const [activeExtensions, setActiveExtensions] = createSignal<
    NodeExtensionState[]
  >([]);
  const [statusBarItems, setStatusBarItems] = createSignal<
    ContributedStatusBarItem[]
  >([]);
  const [treeViews, setTreeViews] = createSignal<ContributedTreeView[]>([]);
  const [webviewPanels, setWebviewPanels] = createSignal<
    ContributedWebviewPanel[]
  >([]);
  const [menus, setMenus] = createSignal<ContributedMenu[]>([]);

  const unlisteners: UnlistenFn[] = [];

  // --------------------------------------------------------------------------
  // Host lifecycle
  // --------------------------------------------------------------------------

  const startHost = async (): Promise<void> => {
    if (status() === "ready" || status() === "starting") return;
    setStatus("starting");
    setLastError(null);
    try {
      await invoke("start_extension_host");
      setStatus("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      batch(() => {
        setStatus("error");
        setLastError(msg);
      });
    }
  };

  const stopHost = async (): Promise<void> => {
    if (status() === "stopped") return;
    try {
      await invoke("extension_host_stop");
    } catch {
      // best-effort
    }
    batch(() => {
      setStatus("stopped");
      setActiveExtensions([]);
      setStatusBarItems([]);
      setTreeViews([]);
      setWebviewPanels([]);
      setMenus([]);
    });
  };

  // --------------------------------------------------------------------------
  // Extension management
  // --------------------------------------------------------------------------

  const installExtension = async (
    extensionId: string
  ): Promise<InstalledVscodeExtension> => {
    const result = await invoke<InstalledVscodeExtension>(
      "install_vscode_extension",
      { extensionId }
    );
    setInstalledExtensions((prev) => [
      ...prev.filter((e) => e.id !== result.id),
      result,
    ]);
    return result;
  };

  const activateExt = async (extensionId: string): Promise<void> => {
    setActiveExtensions((prev) => [
      ...prev.filter((e) => e.extensionId !== extensionId),
      { extensionId, status: "activating" },
    ]);
    try {
      await invoke("activate_extension", { extensionId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActiveExtensions((prev) =>
        prev.map((e) =>
          e.extensionId === extensionId
            ? { ...e, status: "error" as const, error: msg }
            : e
        )
      );
      throw err;
    }
  };

  const callExtensionApi = async (
    namespace: string,
    method: string,
    args?: unknown
  ): Promise<unknown> => {
    return invoke("call_extension_api", { namespace, method, args });
  };

  const refreshInstalled = async (): Promise<void> => {
    try {
      const list = await invoke<InstalledVscodeExtension[]>(
        "extension_host_list_installed"
      );
      const mapped: InstalledVscodeExtension[] = list.map((e) => ({
        ...e,
        activationEvents: (e as unknown as Record<string, unknown>)
          .activationEvents as string[] ?? [],
      }));
      setInstalledExtensions(mapped);
    } catch {
      // ignore
    }
  };

  // --------------------------------------------------------------------------
  // Event listeners
  // --------------------------------------------------------------------------

  onMount(async () => {
    await refreshInstalled();

    const u1 = await listen<{ payload: unknown }>(
      "extension-host:message",
      (event) => {
        handleHostMessage(event.payload);
      }
    );
    unlisteners.push(u1);

    const u2 = await listen("extension-host:status", (event) => {
      const s = event.payload as string;
      if (s === "ready") setStatus("ready");
      else if (s === "stopped") setStatus("stopped");
      else if (s === "error") setStatus("error");
    });
    unlisteners.push(u2);

    const u3 = await listen<InstalledVscodeExtension>(
      "extension-host:installed",
      (event) => {
        setInstalledExtensions((prev) => [
          ...prev.filter((e) => e.id !== event.payload.id),
          event.payload,
        ]);
      }
    );
    unlisteners.push(u3);

    const u4 = await listen<{ extensionId: string }>(
      "extension-host:activating",
      (event) => {
        setActiveExtensions((prev) => [
          ...prev.filter((e) => e.extensionId !== event.payload.extensionId),
          { extensionId: event.payload.extensionId, status: "activating" },
        ]);
      }
    );
    unlisteners.push(u4);
  });

  onCleanup(() => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  });

  // --------------------------------------------------------------------------
  // Message handler
  // --------------------------------------------------------------------------

  function handleHostMessage(payload: unknown): void {
    if (!payload || typeof payload !== "object") return;
    const msg = payload as Record<string, unknown>;

    if ("method" in msg && typeof msg.method === "string") {
      handleNotification(msg.method, msg.params as Record<string, unknown> | undefined);
    }
  }

  function handleNotification(
    method: string,
    params: Record<string, unknown> | undefined
  ): void {
    if (!params) return;

    switch (method) {
      case "extensionActivated": {
        const extId = params.extensionId as string;
        const time = params.activationTimeMs as number | undefined;
        setActiveExtensions((prev) =>
          prev.map((e) =>
            e.extensionId === extId
              ? { ...e, status: "active" as const, activationTimeMs: time }
              : e
          )
        );
        break;
      }
      case "extensionError": {
        const extId = params.extensionId as string;
        const error = params.error as string;
        setActiveExtensions((prev) =>
          prev.map((e) =>
            e.extensionId === extId
              ? { ...e, status: "error" as const, error }
              : e
          )
        );
        break;
      }
      case "contributeStatusBarItem": {
        const item: ContributedStatusBarItem = {
          itemId: params.itemId as string,
          extensionId: params.extensionId as string,
          text: params.text as string,
          tooltip: params.tooltip as string | undefined,
          command: params.command as string | undefined,
          alignment: params.alignment as "left" | "right" | undefined,
          priority: params.priority as number | undefined,
        };
        setStatusBarItems((prev) => [
          ...prev.filter((i) => i.itemId !== item.itemId),
          item,
        ]);
        break;
      }
      case "contributeTreeView": {
        const view: ContributedTreeView = {
          viewId: params.viewId as string,
          extensionId: params.extensionId as string,
          title: params.title as string,
        };
        setTreeViews((prev) => [
          ...prev.filter((v) => v.viewId !== view.viewId),
          view,
        ]);
        break;
      }
      case "contributeWebviewPanel": {
        const panel: ContributedWebviewPanel = {
          panelId: params.panelId as string,
          extensionId: params.extensionId as string,
          title: params.title as string,
          html: params.html as string | undefined,
        };
        setWebviewPanels((prev) => [
          ...prev.filter((p) => p.panelId !== panel.panelId),
          panel,
        ]);
        break;
      }
      case "contributeMenu": {
        const menu: ContributedMenu = {
          menuId: params.menuId as string,
          extensionId: params.extensionId as string,
          command: params.command as string | undefined,
          group: params.group as string | undefined,
          when: params.when as string | undefined,
        };
        setMenus((prev) => [
          ...prev.filter((m) => m.menuId !== menu.menuId),
          menu,
        ]);
        break;
      }
      default:
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Context value
  // --------------------------------------------------------------------------

  const api: NodeExtensionHostAPI = {
    status,
    lastError,
    installedExtensions,
    activeExtensions,
    statusBarItems,
    treeViews,
    webviewPanels,
    menus,

    startHost,
    stopHost,
    installExtension,
    activateExtension: activateExt,
    callExtensionApi,
    refreshInstalled,
  };

  return (
    <NodeExtensionHostContext.Provider value={api}>
      {props.children}
    </NodeExtensionHostContext.Provider>
  );
}

/**
 * PluginAPIBridge - Bridges Tauri backend plugin events with frontend UI
 *
 * Manages message display, permission request dialogs, and contributed
 * view updates from extensions running in the backend runtime. Listens
 * for Tauri events and maintains queues for UI consumption.
 */

import {
  createContext, useContext, onMount, onCleanup,
  ParentProps, Accessor, createSignal, JSX,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// ============================================================================
// Types
// ============================================================================

export type PluginMessageSeverity = "info" | "warning" | "error";

export interface PluginMessage {
  id: string;
  extensionId: string;
  severity: PluginMessageSeverity;
  message: string;
  actions?: string[];
  timestamp: number;
}

export interface PermissionRequest {
  requestId: string;
  extensionId: string;
  permission: string;
  description: string;
  timestamp: number;
}

export interface ContributedViewUpdate {
  extensionId: string;
  viewId: string;
  data: unknown;
}

export interface ProgressIndicator {
  progressId: string;
  extensionId: string;
  title: string;
  cancellable: boolean;
  message?: string;
  percentage?: number;
  timestamp: number;
}

export interface OutputChannel {
  channelId: string;
  extensionId: string;
  name: string;
}

export interface OpenDocumentRequest {
  extensionId: string;
  path: string;
}

export interface PluginAPIBridgeContextValue {
  messages: Accessor<PluginMessage[]>;
  pendingPermissions: Accessor<PermissionRequest[]>;
  progressIndicators: Accessor<ProgressIndicator[]>;
  outputChannels: Accessor<OutputChannel[]>;
  respondToPermissionRequest: (requestId: string, approved: boolean) => Promise<void>;
  dismissMessage: (messageId: string) => void;
  dismissProgress: (progressId: string) => void;
  getActiveMessages: () => PluginMessage[];
  getPendingPermissions: () => PermissionRequest[];
}

// ============================================================================
// Context
// ============================================================================

const PluginAPIBridgeContext = createContext<PluginAPIBridgeContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function PluginAPIBridgeProvider(props: ParentProps): JSX.Element {
  const [messages, setMessages] = createSignal<PluginMessage[]>([]);
  const [pendingPermissions, setPendingPermissions] = createSignal<PermissionRequest[]>([]);
  const [progressIndicators, setProgressIndicators] = createSignal<ProgressIndicator[]>([]);
  const [outputChannels, setOutputChannels] = createSignal<OutputChannel[]>([]);
  const unlistenFns: UnlistenFn[] = [];

  const respondToPermissionRequest = async (
    requestId: string,
    approved: boolean,
  ): Promise<void> => {
    try {
      await invoke("plugin_respond_permission_request", { requestId, approved });
      setPendingPermissions((prev) => prev.filter((req) => req.requestId !== requestId));
    } catch (e) {
      console.error("[PluginAPIBridge] Failed to respond to permission request:", e);
      throw e;
    }
  };

  const dismissMessage = (messageId: string): void => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  };

  const dismissProgress = (progressId: string): void => {
    setProgressIndicators((prev) => prev.filter((p) => p.progressId !== progressId));
  };

  const getActiveMessages = (): PluginMessage[] => messages();
  const getPendingPermissions = (): PermissionRequest[] => pendingPermissions();

  onMount(async () => {
    try {
      const unlistenMessage = await listen<{
        id: string; extensionId: string; severity: PluginMessageSeverity;
        message: string; actions?: string[];
      }>("plugin:show-message", (event) => {
        const payload = event.payload;
        setMessages((prev) => [...prev, {
          id: payload.id,
          extensionId: payload.extensionId,
          severity: payload.severity,
          message: payload.message,
          actions: payload.actions,
          timestamp: Date.now(),
        }]);
      });
      unlistenFns.push(unlistenMessage);
    } catch (e) {
      console.warn("[PluginAPIBridge] Failed to listen for show-message events:", e);
    }

    try {
      const unlistenPermission = await listen<{
        requestId: string; extensionId: string; permission: string; description: string;
      }>("plugin:permission-request", (event) => {
        const payload = event.payload;
        setPendingPermissions((prev) => [...prev, {
          requestId: payload.requestId,
          extensionId: payload.extensionId,
          permission: payload.permission,
          description: payload.description,
          timestamp: Date.now(),
        }]);
      });
      unlistenFns.push(unlistenPermission);
    } catch (e) {
      console.warn("[PluginAPIBridge] Failed to listen for permission-request events:", e);
    }

    try {
      const unlistenViewUpdate = await listen<{
        extensionId: string; viewId: string; data: unknown;
      }>("plugin:contributed-view-update", (event) => {
        const payload = event.payload;
        window.dispatchEvent(
          new CustomEvent("plugin:view-update", {
            detail: {
              extensionId: payload.extensionId,
              viewId: payload.viewId,
              data: payload.data,
            } satisfies ContributedViewUpdate,
          }),
        );
      });
      unlistenFns.push(unlistenViewUpdate);
    } catch (e) {
      console.warn("[PluginAPIBridge] Failed to listen for contributed-view-update events:", e);
    }

    try {
      const unlistenProgress = await listen<{
        progress_id: string; extension_id: string; title: string;
        cancellable: boolean; message?: string; percentage?: number;
      }>("plugin:show-progress", (event) => {
        const p = event.payload;
        setProgressIndicators((prev) => {
          const existing = prev.find((i) => i.progressId === p.progress_id);
          if (existing) {
            return prev.map((i) =>
              i.progressId === p.progress_id
                ? { ...i, message: p.message, percentage: p.percentage }
                : i,
            );
          }
          return [...prev, {
            progressId: p.progress_id, extensionId: p.extension_id,
            title: p.title, cancellable: p.cancellable,
            message: p.message, percentage: p.percentage, timestamp: Date.now(),
          }];
        });
      });
      unlistenFns.push(unlistenProgress);
    } catch (e) {
      console.warn("[PluginAPIBridge] Failed to listen for progress events:", e);
    }

    try {
      const unlistenOutputChannel = await listen<{
        channel_id: string; extension_id: string; name: string;
      }>("plugin:output-channel-created", (event) => {
        const p = event.payload;
        setOutputChannels((prev) => [...prev, {
          channelId: p.channel_id, extensionId: p.extension_id, name: p.name,
        }]);
      });
      unlistenFns.push(unlistenOutputChannel);
    } catch (e) {
      console.warn("[PluginAPIBridge] Failed to listen for output-channel events:", e);
    }

    try {
      const unlistenOpenDoc = await listen<{ extension_id: string; path: string }>(
        "plugin:open-document",
        (event) => {
          window.dispatchEvent(
            new CustomEvent("plugin:open-document", {
              detail: {
                extensionId: event.payload.extension_id,
                path: event.payload.path,
              } satisfies OpenDocumentRequest,
            }),
          );
        },
      );
      unlistenFns.push(unlistenOpenDoc);
    } catch (e) {
      console.warn("[PluginAPIBridge] Failed to listen for open-document events:", e);
    }

    try {
      const unlistenSaveAll = await listen<{ extension_id: string }>(
        "plugin:save-all",
        (event) => {
          window.dispatchEvent(
            new CustomEvent("plugin:save-all", {
              detail: { extensionId: event.payload.extension_id },
            }),
          );
        },
      );
      unlistenFns.push(unlistenSaveAll);
    } catch (e) {
      console.warn("[PluginAPIBridge] Failed to listen for save-all events:", e);
    }
  });

  onCleanup(() => {
    for (const unlisten of unlistenFns) {
      unlisten();
    }
    unlistenFns.length = 0;
  });

  const value: PluginAPIBridgeContextValue = {
    messages, pendingPermissions, progressIndicators, outputChannels,
    respondToPermissionRequest, dismissMessage, dismissProgress,
    getActiveMessages, getPendingPermissions,
  };

  return (
    <PluginAPIBridgeContext.Provider value={value}>
      {props.children}
    </PluginAPIBridgeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function usePluginAPIBridge(): PluginAPIBridgeContextValue {
  const context = useContext(PluginAPIBridgeContext);
  if (!context) {
    throw new Error("usePluginAPIBridge must be used within PluginAPIBridgeProvider");
  }
  return context;
}

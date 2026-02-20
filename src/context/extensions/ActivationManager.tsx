/**
 * ActivationManager - Manages extension activation lifecycle
 *
 * Tracks activation events including file opens, command invocations,
 * view visibility changes, and startup completion. Coordinates with
 * the Tauri backend to determine which extensions should activate
 * for each event type.
 */

import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  ParentProps,
  Accessor,
  createSignal,
  JSX,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// ============================================================================
// Types
// ============================================================================

export type ActivationEventType =
  | { type: "onStartupFinished" }
  | { type: "onLanguage"; language: string }
  | { type: "onCommand"; command: string }
  | { type: "workspaceContains"; pattern: string }
  | { type: "onView"; viewId: string }
  | { type: "onDebug" }
  | { type: "onFileSystem"; scheme: string };

interface ActivationRecord {
  time: number;
  event: string;
}

interface ActivationMetrics {
  totalActivated: number;
  averageActivationTime: number;
  activations: Array<{ extensionId: string; time: number; event: string }>;
}

interface FileOpenedPayload {
  path: string;
  language?: string;
}

interface CommandInvokedPayload {
  command: string;
}

export interface ActivationManagerContextValue {
  activatedExtensions: Accessor<Map<string, ActivationRecord>>;
  pendingActivations: Accessor<string[]>;
  triggerActivation: (event: ActivationEventType) => Promise<void>;
  getActivationMetrics: () => ActivationMetrics;
  isExtensionActivated: (id: string) => boolean;
}

// ============================================================================
// Context
// ============================================================================

const ActivationManagerContext =
  createContext<ActivationManagerContextValue>();

// ============================================================================
// Helpers
// ============================================================================

function languageFromExtension(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) return null;

  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    lua: "lua",
    zig: "zig",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    sql: "sql",
    sh: "shellscript",
    bash: "shellscript",
    zsh: "shellscript",
    fish: "shellscript",
    ps1: "powershell",
    r: "r",
    dart: "dart",
    ex: "elixir",
    exs: "elixir",
    erl: "erlang",
    hs: "haskell",
    ml: "ocaml",
    vue: "vue",
    svelte: "svelte",
  };

  return languageMap[ext] ?? null;
}

// ============================================================================
// Provider
// ============================================================================

export function ActivationManagerProvider(
  props: ParentProps,
): JSX.Element {
  const [activatedExtensions, setActivatedExtensions] = createSignal<
    Map<string, ActivationRecord>
  >(new Map());
  const [pendingActivations, setPendingActivations] = createSignal<string[]>(
    [],
  );

  const unlistenFns: UnlistenFn[] = [];
  let startupTimerId: ReturnType<typeof setTimeout> | undefined;

  const triggerActivation = async (
    event: ActivationEventType,
  ): Promise<void> => {
    try {
      const extensionIds = await invoke<string[]>(
        "check_activation_event",
        { event },
      );

      if (extensionIds.length === 0) return;

      setPendingActivations((prev) => [
        ...prev,
        ...extensionIds.filter((id) => !prev.includes(id)),
      ]);

      const now = Date.now();
      const eventLabel =
        event.type === "onLanguage"
          ? `onLanguage:${event.language}`
          : event.type === "onCommand"
            ? `onCommand:${event.command}`
            : event.type === "workspaceContains"
              ? `workspaceContains:${event.pattern}`
              : event.type === "onView"
                ? `onView:${event.viewId}`
                : event.type === "onFileSystem"
                  ? `onFileSystem:${event.scheme}`
                  : event.type;

      setActivatedExtensions((prev) => {
        const next = new Map(prev);
        for (const id of extensionIds) {
          if (!next.has(id)) {
            next.set(id, { time: now, event: eventLabel });
          }
        }
        return next;
      });

      setPendingActivations((prev) =>
        prev.filter((id) => !extensionIds.includes(id)),
      );
    } catch (e) {
      console.error(
        "[ActivationManager] Failed to trigger activation:",
        e,
      );
    }
  };

  const getActivationMetrics = (): ActivationMetrics => {
    const activated = activatedExtensions();
    const activations: ActivationMetrics["activations"] = [];

    for (const [extensionId, record] of activated.entries()) {
      activations.push({
        extensionId,
        time: record.time,
        event: record.event,
      });
    }

    const totalActivated = activations.length;
    const averageActivationTime =
      totalActivated > 0
        ? activations.reduce((sum, a) => sum + a.time, 0) / totalActivated
        : 0;

    return { totalActivated, averageActivationTime, activations };
  };

  const isExtensionActivated = (id: string): boolean => {
    return activatedExtensions().has(id);
  };

  const handleFileOpened = (event: CustomEvent<FileOpenedPayload>) => {
    const { path, language } = event.detail;
    const lang = language ?? languageFromExtension(path);
    if (lang) {
      triggerActivation({ type: "onLanguage", language: lang });
    }
  };

  const handleCommandInvoked = (
    event: CustomEvent<CommandInvokedPayload>,
  ) => {
    const { command } = event.detail;
    triggerActivation({ type: "onCommand", command });
  };

  onMount(async () => {
    window.addEventListener(
      "editor:file-opened",
      handleFileOpened as EventListener,
    );
    window.addEventListener(
      "command:invoked",
      handleCommandInvoked as EventListener,
    );

    try {
      const unlistenFileOpened = await listen<FileOpenedPayload>(
        "editor:file-opened",
        (event) => {
          const { path, language } = event.payload;
          const lang = language ?? languageFromExtension(path);
          if (lang) {
            triggerActivation({ type: "onLanguage", language: lang });
          }
        },
      );
      unlistenFns.push(unlistenFileOpened);
    } catch (e) {
      console.warn(
        "[ActivationManager] Failed to listen for file-opened events:",
        e,
      );
    }

    try {
      const unlistenCommand = await listen<CommandInvokedPayload>(
        "command:invoked",
        (event) => {
          triggerActivation({
            type: "onCommand",
            command: event.payload.command,
          });
        },
      );
      unlistenFns.push(unlistenCommand);
    } catch (e) {
      console.warn(
        "[ActivationManager] Failed to listen for command events:",
        e,
      );
    }

    try {
      const unlistenDebug = await listen<{ session_id: string }>(
        "plugin:debug-session-start",
        () => {
          triggerActivation({ type: "onDebug" });
        },
      );
      unlistenFns.push(unlistenDebug);
    } catch (e) {
      console.warn(
        "[ActivationManager] Failed to listen for debug session events:",
        e,
      );
    }

    try {
      const unlistenView = await listen<{ view_id: string }>(
        "plugin:view-visible",
        (event) => {
          triggerActivation({
            type: "onView",
            viewId: event.payload.view_id,
          });
        },
      );
      unlistenFns.push(unlistenView);
    } catch (e) {
      console.warn(
        "[ActivationManager] Failed to listen for view visibility events:",
        e,
      );
    }

    try {
      const unlistenFs = await listen<{ scheme: string }>(
        "plugin:filesystem-accessed",
        (event) => {
          triggerActivation({
            type: "onFileSystem",
            scheme: event.payload.scheme,
          });
        },
      );
      unlistenFns.push(unlistenFs);
    } catch (e) {
      console.warn(
        "[ActivationManager] Failed to listen for filesystem events:",
        e,
      );
    }

    startupTimerId = setTimeout(() => {
      triggerActivation({ type: "onStartupFinished" });
    }, 5000);
  });

  onCleanup(() => {
    window.removeEventListener(
      "editor:file-opened",
      handleFileOpened as EventListener,
    );
    window.removeEventListener(
      "command:invoked",
      handleCommandInvoked as EventListener,
    );

    for (const unlisten of unlistenFns) {
      unlisten();
    }
    unlistenFns.length = 0;

    if (startupTimerId !== undefined) {
      clearTimeout(startupTimerId);
    }
  });

  const value: ActivationManagerContextValue = {
    activatedExtensions,
    pendingActivations,
    triggerActivation,
    getActivationMetrics,
    isExtensionActivated,
  };

  return (
    <ActivationManagerContext.Provider value={value}>
      {props.children}
    </ActivationManagerContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useActivationManager(): ActivationManagerContextValue {
  const context = useContext(ActivationManagerContext);
  if (!context) {
    throw new Error(
      "useActivationManager must be used within ActivationManagerProvider",
    );
  }
  return context;
}

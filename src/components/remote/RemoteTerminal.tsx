/**
 * Remote Terminal Component
 *
 * xterm.js terminal connected to an SSH session.
 * Features:
 * - Real-time output streaming from SSH PTY
 * - Connection status indicator
 * - Reconnect on disconnect
 * - Copy/paste support
 * - Resize handling
 * - Theme synchronization
 */

import {
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  Show,
  type JSX,
  batch,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebglAddon } from "@xterm/addon-webgl";
// ClipboardAddon disabled - package not installed. Using manual clipboard handling instead.
// import { ClipboardAddon } from "@xterm/addon-clipboard";
import { Icon } from "../ui/Icon";
import {
  type SSHConfig,
  type SSHTerminalInfo,
  type SSHTerminalOutput,
  type SSHTerminalStatus,
} from "@/context/TerminalsContext";
import { useSettings } from "@/context/SettingsContext";
import { getTerminalTheme, getTerminalThemeFromCSS } from "@/lib/terminalThemes";
import { tokens } from "@/design-system/tokens";
import "@xterm/xterm/css/xterm.css";

// ============================================================================
// Types
// ============================================================================

export interface RemoteTerminalProps {
  /** SSH configuration for this terminal */
  sshConfig: SSHConfig;
  /** SSH session ID (if already connected) */
  sessionId?: string;
  /** Terminal name */
  name?: string;
  /** Called when connection status changes */
  onStatusChange?: (
    status: "connecting" | "connected" | "disconnected" | "error"
  ) => void;
  /** Called when terminal is closed */
  onClose?: () => void;
  /** Called when reconnect is requested */
  onReconnect?: () => void;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Custom class name */
  class?: string;
  /** Custom style */
  style?: JSX.CSSProperties;
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
  /** Enable WebGL rendering (better performance) */
  enableWebGL?: boolean;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

// ============================================================================
// Component
// ============================================================================

export function RemoteTerminal(props: RemoteTerminalProps) {
  const settings = useSettings();

  // State
  const [status, setStatus] = createSignal<ConnectionStatus>(
    props.sessionId ? "connected" : "connecting"
  );
  const [sessionId, setSessionId] = createSignal<string | null>(
    props.sessionId || null
  );
  const [error, setError] = createSignal<string | null>(null);
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [sessionInfo, setSessionInfo] = createSignal<SSHTerminalInfo | null>(
    null
  );
  const [connectionTime, setConnectionTime] = createSignal<Date | null>(null);
  const [bytesReceived, setBytesReceived] = createSignal(0);
  const [bytesSent, setBytesSent] = createSignal(0);
  const [isFocused, setIsFocused] = createSignal(false);

  // Refs
  let containerRef: HTMLDivElement | undefined;
  let terminal: XTerm | null = null;
  let fitAddon: FitAddon | null = null;
  let searchAddon: SearchAddon | null = null;
  let webglAddon: WebglAddon | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let unlistenOutput: UnlistenFn | null = null;
  let unlistenStatus: UnlistenFn | null = null;
  let pendingAckBytes = 0;
  let uptimeInterval: ReturnType<typeof setInterval> | null = null;

  const ACK_BATCH_SIZE = 32768;

  // Computed
  const terminalSettings = () => settings.effectiveSettings().terminal;

  // ============================================================================
  // Terminal Initialization
  // ============================================================================

  const initializeTerminal = () => {
    if (!containerRef || terminal) return;

    const ts = terminalSettings();
    const colorScheme = ts.colorScheme || "default-dark";
    const selectedTheme =
      colorScheme === "auto" || colorScheme.startsWith("default")
        ? getTerminalThemeFromCSS()
        : getTerminalTheme(colorScheme);

    terminal = new XTerm({
      cursorBlink: ts.cursorBlink,
      cursorStyle:
        ts.cursorStyle === "bar"
          ? "bar"
          : ts.cursorStyle === "underline"
            ? "underline"
            : "block",
      fontSize: ts.fontSize,
      fontFamily: ts.fontFamily,
      lineHeight: ts.lineHeight,
      theme: selectedTheme,
      allowProposedApi: true,
      scrollback: ts.scrollback || 10000,
      tabStopWidth: 4,
      convertEol: false,
      smoothScrollDuration: 0,
      wordSeparator: ts.wordSeparators || " ()[]{}',\"`-''",
      // fastScrollModifier removed in newer xterm.js versions
      // fastScrollModifier: "alt",
      // fastScrollSensitivity: 5,
      cursorInactiveStyle: "none",
      rescaleOverlappingGlyphs: true,
      drawBoldTextInBrightColors: false,
    });

    // Load addons
    fitAddon = new FitAddon();
    searchAddon = new SearchAddon();
    const unicode11Addon = new Unicode11Addon();
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.open(uri, "_blank");
    });
    // ClipboardAddon disabled - using manual clipboard handling
    // const clipboardAddon = new ClipboardAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(unicode11Addon);
    // terminal.loadAddon(clipboardAddon);
    terminal.unicode.activeVersion = "11";

    terminal.open(containerRef);

    // Try to enable WebGL rendering
    if (props.enableWebGL !== false) {
      try {
        webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon?.dispose();
          webglAddon = null;
        });
        terminal.loadAddon(webglAddon);
      } catch (e) {
        console.warn("[RemoteTerminal] WebGL not available:", e);
      }
    }

    // Handle terminal input - send to SSH PTY
    terminal.onData(async (data) => {
      const sid = sessionId();
      if (!sid || status() !== "connected") return;

      try {
        await invoke("ssh_pty_write", { sessionId: sid, data });
        setBytesSent((prev) => prev + data.length);
      } catch (e) {
        console.error("[RemoteTerminal] Write error:", e);
        handleConnectionError(String(e));
      }
    });

    terminal.onBinary(async (data) => {
      const sid = sessionId();
      if (!sid || status() !== "connected") return;

      try {
        await invoke("ssh_pty_write", { sessionId: sid, data });
        setBytesSent((prev) => prev + data.length);
      } catch (e) {
        console.error("[RemoteTerminal] Binary write error:", e);
      }
    });

    // Handle resize
    terminal.onResize(async ({ cols, rows }) => {
      const sid = sessionId();
      if (!sid || status() !== "connected") return;

      try {
        await invoke("ssh_pty_resize", { sessionId: sid, cols, rows });
      } catch (e) {
        console.error("[RemoteTerminal] Resize error:", e);
      }
    });

    // Track focus using textarea element events
    const textareaEl = terminal.element?.querySelector('.xterm-helper-textarea');
    if (textareaEl) {
      textareaEl.addEventListener('focus', () => setIsFocused(true));
      textareaEl.addEventListener('blur', () => setIsFocused(false));
    }

    // Initial fit
    requestAnimationFrame(() => {
      fitAddon?.fit();
    });

    // Set up resize observer
    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (
          containerRef &&
          containerRef.offsetWidth > 0 &&
          containerRef.offsetHeight > 0
        ) {
          fitAddon?.fit();
        }
      });
    });
    resizeObserver.observe(containerRef);
  };

  // ============================================================================
  // Connection Management
  // ============================================================================

  const connect = async () => {
    if (sessionId()) {
      // Already have a session
      return;
    }

    batch(() => {
      setStatus("connecting");
      setError(null);
    });
    props.onStatusChange?.("connecting");

    terminal?.write("\x1b[1;34m[SSH]\x1b[0m Connecting to ");
    terminal?.write(
      `\x1b[1;36m${props.sshConfig.username}@${props.sshConfig.host}\x1b[0m...\r\n`
    );

    try {
      const info = await invoke<SSHTerminalInfo>("ssh_connect", {
        config: props.sshConfig,
        cols: terminal?.cols || 120,
        rows: terminal?.rows || 30,
      });

      batch(() => {
        setSessionId(info.id);
        setSessionInfo(info);
        setStatus("connected");
        setConnectionTime(new Date());
      });
      props.onStatusChange?.("connected");

      terminal?.write(
        `\x1b[1;32m[SSH]\x1b[0m Connected to ${info.username}@${info.host}\r\n`
      );
      if (info.remote_platform) {
        terminal?.write(
          `\x1b[1;34m[SSH]\x1b[0m Platform: ${info.remote_platform}\r\n`
        );
      }
      if (info.remote_home) {
        terminal?.write(`\x1b[1;34m[SSH]\x1b[0m Home: ${info.remote_home}\r\n`);
      }
      terminal?.write("\r\n");

      // Start uptime counter
      uptimeInterval = setInterval(() => {
        // Force re-render for uptime display
        setConnectionTime((t) => (t ? new Date(t.getTime()) : null));
      }, 60000);
    } catch (e) {
      const errorMsg = String(e);
      batch(() => {
        setStatus("error");
        setError(errorMsg);
      });
      props.onStatusChange?.("error");

      terminal?.write(
        `\x1b[1;31m[SSH]\x1b[0m Connection failed: ${errorMsg}\r\n`
      );
    }
  };

  const disconnect = async () => {
    const sid = sessionId();
    if (!sid) return;

    if (uptimeInterval) {
      clearInterval(uptimeInterval);
      uptimeInterval = null;
    }

    try {
      await invoke("ssh_disconnect", { sessionId: sid });
    } catch (e) {
      console.error("[RemoteTerminal] Disconnect error:", e);
    }

    batch(() => {
      setSessionId(null);
      setStatus("disconnected");
      setConnectionTime(null);
    });
    props.onStatusChange?.("disconnected");

    terminal?.write("\r\n\x1b[1;33m[SSH]\x1b[0m Disconnected.\r\n");
  };

  const reconnect = async () => {
    const sid = sessionId();
    if (sid) {
      try {
        await invoke("ssh_disconnect", { sessionId: sid });
      } catch {
        // Ignore disconnect errors during reconnect
      }
    }

    batch(() => {
      setSessionId(null);
      setBytesReceived(0);
      setBytesSent(0);
    });

    terminal?.write("\r\n\x1b[1;33m[SSH]\x1b[0m Reconnecting...\r\n");
    await connect();

    props.onReconnect?.();
  };

  const handleConnectionError = (errorMsg: string) => {
    batch(() => {
      setStatus("error");
      setError(errorMsg);
    });
    props.onStatusChange?.("error");

    terminal?.write(`\r\n\x1b[1;31m[SSH]\x1b[0m Error: ${errorMsg}\r\n`);
  };

  // ============================================================================
  // Flow Control
  // ============================================================================

  const acknowledgeOutput = async (bytes: number) => {
    pendingAckBytes += bytes;

    if (pendingAckBytes >= ACK_BATCH_SIZE) {
      const sid = sessionId();
      if (sid) {
        try {
          await invoke("ssh_pty_ack", {
            sessionId: sid,
            bytes: pendingAckBytes,
          });
        } catch {
          // Ignore ack errors
        }
      }
      pendingAckBytes = 0;
    }
  };

  // ============================================================================
  // Clipboard Operations
  // ============================================================================

  const copyToClipboard = async () => {
    if (!terminal) return;
    const selection = terminal.getSelection();
    if (selection) {
      try {
        await navigator.clipboard.writeText(selection);
      } catch (e) {
        console.error("[RemoteTerminal] Copy failed:", e);
      }
    }
  };

  const pasteFromClipboard = async () => {
    const sid = sessionId();
    if (!sid || status() !== "connected") return;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        await invoke("ssh_pty_write", { sessionId: sid, data: text });
      }
    } catch (e) {
      console.error("[RemoteTerminal] Paste failed:", e);
    }
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    initializeTerminal();
    if (props.autoConnect !== false) {
      connect();
    }
  });

  onMount(async () => {
    // Listen for SSH output
    unlistenOutput = await listen<SSHTerminalOutput>(
      "ssh-terminal:output",
      (event) => {
        const sid = sessionId();
        if (event.payload.session_id === sid && terminal) {
          terminal.write(event.payload.data);
          setBytesReceived((prev) => prev + event.payload.data.length);
          acknowledgeOutput(event.payload.data.length);
        }
      }
    );

    // Listen for SSH status changes
    unlistenStatus = await listen<SSHTerminalStatus>(
      "ssh-terminal:status",
      (event) => {
        const sid = sessionId();
        if (event.payload.session_id === sid) {
          const newStatus =
            typeof event.payload.status === "string"
              ? event.payload.status
              : "error";

          if (newStatus === "disconnected") {
            batch(() => {
              setStatus("disconnected");
              setConnectionTime(null);
            });
            props.onStatusChange?.("disconnected");
            terminal?.write(
              "\r\n\x1b[1;31m[SSH]\x1b[0m Connection lost.\r\n"
            );
          } else if (newStatus === "reconnecting") {
            setStatus("connecting");
            props.onStatusChange?.("connecting");
            terminal?.write(
              "\r\n\x1b[1;33m[SSH]\x1b[0m Reconnecting...\r\n"
            );
          }
        }
      }
    );
  });

  onCleanup(() => {
    unlistenOutput?.();
    unlistenStatus?.();
    resizeObserver?.disconnect();

    if (uptimeInterval) {
      clearInterval(uptimeInterval);
    }

    // Flush remaining acks
    const sid = sessionId();
    if (sid && pendingAckBytes > 0) {
      invoke("ssh_pty_ack", { sessionId: sid, bytes: pendingAckBytes }).catch(
        () => {}
      );
    }

    webglAddon?.dispose();
    terminal?.dispose();
    terminal = null;
    fitAddon = null;
    searchAddon = null;
    webglAddon = null;
  });

  // Update terminal theme when settings change
  createEffect(() => {
    if (!terminal) return;

    const ts = terminalSettings();
    const colorScheme = ts.colorScheme || "default-dark";
    const selectedTheme =
      colorScheme === "auto" || colorScheme.startsWith("default")
        ? getTerminalThemeFromCSS()
        : getTerminalTheme(colorScheme);

    terminal.options.theme = selectedTheme;
    terminal.options.fontFamily = ts.fontFamily;
    terminal.options.fontSize = ts.fontSize;
    terminal.options.lineHeight = ts.lineHeight;
    terminal.options.cursorBlink = ts.cursorBlink;
    terminal.options.cursorStyle =
      ts.cursorStyle === "bar"
        ? "bar"
        : ts.cursorStyle === "underline"
          ? "underline"
          : "block";

    requestAnimationFrame(() => {
      fitAddon?.fit();
    });
  });

  // ============================================================================
  // Helpers
  // ============================================================================

  const formatUptime = (startTime: Date | null): string => {
    if (!startTime) return "";
    const diff = Date.now() - startTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusColor = () => {
    switch (status()) {
      case "connected":
        return tokens.colors.semantic.success;
      case "connecting":
        return tokens.colors.semantic.warning;
      case "disconnected":
        return tokens.colors.text.muted;
      case "error":
        return tokens.colors.semantic.error;
    }
  };

  const statusIcon = () => {
    switch (status()) {
      case "connected":
        return <Icon name="wifi" style={{ color: statusColor() }} />;
      case "connecting":
        return (
          <Icon name="rotate" class="animate-spin" style={{ color: statusColor() }} />
        );
      case "disconnected":
        return <Icon name="wifi-slash" style={{ color: statusColor() }} />;
      case "error":
        return <Icon name="wifi-slash" style={{ color: statusColor() }} />;
    }
  };

  const displayName = () => {
    const info = sessionInfo();
    if (info) {
      return `${info.username}@${info.host}`;
    }
    return (
      props.name || `${props.sshConfig.username}@${props.sshConfig.host}`
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      class={props.class}
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        "background-color": "var(--surface-base)",
        position: "relative",
        ...props.style,
      }}
    >
      {/* Toolbar */}
      <Show when={props.showToolbar !== false}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.md,
            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
            "background-color": "var(--surface-raised)",
            "min-height": "40px",
          }}
        >
          {/* Status indicator */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
            }}
          >
            {statusIcon()}
            <span
              style={{
                "font-size": tokens.typography.fontSize.sm,
                color: tokens.colors.text.primary,
                "font-weight": tokens.typography.fontWeight.medium,
              }}
            >
              {displayName()}
            </span>
          </div>

          {/* Remote info */}
          <Show when={sessionInfo()}>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: tokens.spacing.sm,
                padding: `2px ${tokens.spacing.sm}`,
                "border-radius": tokens.radius.sm,
                "background-color": "var(--surface-overlay)",
              }}
            >
              <Icon
                name="server"
                class="w-3 h-3"
                style={{ color: tokens.colors.text.muted }}
              />
              <span
                style={{
                  "font-size": tokens.typography.fontSize.xs,
                  color: tokens.colors.text.muted,
                }}
              >
                {sessionInfo()?.remote_platform}
              </span>
            </div>
          </Show>

          {/* Connection time */}
          <Show when={connectionTime() && status() === "connected"}>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: tokens.spacing.xs,
                "font-size": tokens.typography.fontSize.xs,
                color: tokens.colors.text.muted,
              }}
            >
              <Icon name="clock" class="w-3 h-3" />
              {formatUptime(connectionTime())}
            </div>
          </Show>

          {/* Data transfer stats */}
          <Show when={status() === "connected"}>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: tokens.spacing.xs,
                "font-size": tokens.typography.fontSize.xs,
                color: tokens.colors.text.muted,
              }}
            >
              <Icon name="wave-pulse" class="w-3 h-3" />
              {formatBytes(bytesReceived())} / {formatBytes(bytesSent())}
            </div>
          </Show>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Actions */}
          <Show when={status() === "connected"}>
            <button
              onClick={copyToClipboard}
              style={{
                display: "flex",
                "align-items": "center",
                padding: tokens.spacing.xs,
                "border-radius": tokens.radius.sm,
                border: "none",
                background: "transparent",
                color: tokens.colors.text.muted,
                cursor: "pointer",
              }}
              title="Copy Selection (Ctrl+Shift+C)"
            >
              <Icon name="copy" size={14} />
            </button>

            <button
              onClick={pasteFromClipboard}
              style={{
                display: "flex",
                "align-items": "center",
                padding: tokens.spacing.xs,
                "border-radius": tokens.radius.sm,
                border: "none",
                background: "transparent",
                color: tokens.colors.text.muted,
                cursor: "pointer",
              }}
              title="Paste (Ctrl+Shift+V)"
            >
              <Icon name="clipboard" size={14} />
            </button>
          </Show>

          <Show when={status() === "disconnected" || status() === "error"}>
            <button
              onClick={reconnect}
              style={{
                display: "flex",
                "align-items": "center",
                gap: tokens.spacing.xs,
                padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
                "border-radius": tokens.radius.sm,
                border: "none",
                background: tokens.colors.semantic.primary,
                color: "white",
                cursor: "pointer",
                "font-size": tokens.typography.fontSize.sm,
                "font-weight": tokens.typography.fontWeight.medium,
              }}
            >
              <Icon name="rotate" size={14} />
              Reconnect
            </button>
          </Show>

          <Show when={status() === "connected"}>
            <button
              onClick={disconnect}
              style={{
                display: "flex",
                "align-items": "center",
                padding: tokens.spacing.xs,
                "border-radius": tokens.radius.sm,
                border: "none",
                background: "transparent",
                color: tokens.colors.text.muted,
                cursor: "pointer",
              }}
              title="Disconnect"
            >
              <Icon name="wifi-slash" size={14} />
            </button>
          </Show>

          <button
            onClick={() => setIsMaximized(!isMaximized())}
            style={{
              display: "flex",
              "align-items": "center",
              padding: tokens.spacing.xs,
              "border-radius": tokens.radius.sm,
              border: "none",
              background: "transparent",
              color: tokens.colors.text.muted,
              cursor: "pointer",
            }}
            title={isMaximized() ? "Restore" : "Maximize"}
          >
            {isMaximized() ? (
              <Icon name="minimize" size={14} />
            ) : (
              <Icon name="maximize" size={14} />
            )}
          </button>

          <Show when={props.onClose}>
            <button
              onClick={props.onClose}
              style={{
                display: "flex",
                "align-items": "center",
                padding: tokens.spacing.xs,
                "border-radius": tokens.radius.sm,
                border: "none",
                background: "transparent",
                color: tokens.colors.text.muted,
                cursor: "pointer",
              }}
              title="Close"
            >
              <Icon name="xmark" size={14} />
            </button>
          </Show>
        </div>
      </Show>

      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          "min-height": 0,
          overflow: "hidden",
          padding: tokens.spacing.xs,
        }}
        onFocus={() => terminal?.focus()}
      />

      {/* Error overlay */}
      <Show when={error() && status() === "error"}>
        <div
          style={{
            position: "absolute",
            bottom: tokens.spacing.md,
            left: tokens.spacing.md,
            right: tokens.spacing.md,
            padding: tokens.spacing.md,
            "background-color": `color-mix(in srgb, ${tokens.colors.semantic.error} 15%, var(--surface-base))`,
            border: `1px solid ${tokens.colors.semantic.error}`,
            "border-radius": tokens.radius.md,
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.md,
          }}
        >
          <Icon
            name="wifi-slash"
            class="w-5 h-5 flex-shrink-0"
            style={{ color: tokens.colors.semantic.error }}
          />
          <div style={{ flex: 1, "min-width": 0 }}>
            <p
              class="font-medium"
              style={{
                color: tokens.colors.semantic.error,
                "font-size": tokens.typography.fontSize.sm,
              }}
            >
              Connection Error
            </p>
            <p
              class="truncate"
              style={{
                color: tokens.colors.text.muted,
                "font-size": tokens.typography.fontSize.xs,
              }}
            >
              {error()}
            </p>
          </div>
          <button
            onClick={reconnect}
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.xs,
              padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
              "border-radius": tokens.radius.sm,
              border: "none",
              background: tokens.colors.semantic.error,
              color: "white",
              cursor: "pointer",
              "font-size": tokens.typography.fontSize.sm,
              "font-weight": tokens.typography.fontWeight.medium,
              "flex-shrink": 0,
            }}
          >
            <Icon name="rotate" size={14} />
            Retry
          </button>
        </div>
      </Show>

      {/* Focus indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "2px",
          "background-color": isFocused()
            ? tokens.colors.semantic.primary
            : "transparent",
          transition: "background-color 0.15s",
        }}
      />
    </div>
  );
}

export default RemoteTerminal;

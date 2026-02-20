import { Show, createSignal, onMount, JSX } from "solid-js";
import { Icon } from "./ui/Icon";
import { useSession } from "@/context/SessionContext";
import { useSDK } from "@/context/SDKContext";
import { useCommands } from "@/context/CommandContext";
import { useNavigate } from "@solidjs/router";
import { ModelSelector } from "./ModelSelector";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IconButton, Text } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

// VS Code Titlebar Dimensions
const TITLEBAR_HEIGHT = 35;  // VS Code standard: 35px
const WINDOW_CONTROL_WIDTH = 46;  // Windows standard: 46px per button

export function Header() {
  const { toggleSidebar } = useSession();
  const { state, destroySession, interrupt } = useSDK();
  const { setShowCommandPalette } = useCommands();
  const navigate = useNavigate();
  const [isMaximized, setIsMaximized] = createSignal(false);

  const appWindow = getCurrentWindow();

  onMount(async () => {
    // Check initial maximized state
    setIsMaximized(await appWindow.isMaximized());
    
    // Listen for window state changes
    const unlisten = await appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    });
    
    return () => unlisten();
  });

  const handleNewSession = async () => {
    await destroySession();
    navigate("/");
  };

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  const headerStyle: JSX.CSSProperties = {
    position: "relative",
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    height: `${TITLEBAR_HEIGHT}px`,
    "min-height": `${TITLEBAR_HEIGHT}px`,
    "max-height": `${TITLEBAR_HEIGHT}px`,
    background: tokens.colors.surface.panel,
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
    "z-index": "2500",
    isolation: "isolate",
    "flex-shrink": "0",
    "padding-left": tokens.spacing.md,
  };

  const leftSectionStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    "min-width": "0",
    "flex-shrink": "1",
    overflow: "hidden",
  };

  const centerSectionStyle: JSX.CSSProperties = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    "align-items": "center",
    "font-size": "12px",
    color: tokens.colors.text.muted,
  };

  const rightSectionStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "flex-shrink": "0",
  };

  const appActionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    "margin-right": tokens.spacing.md,
  };

  const windowControlsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    height: `${TITLEBAR_HEIGHT}px`,
    "flex-shrink": "0",
  };

  const windowControlStyle: JSX.CSSProperties = {
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    width: `${WINDOW_CONTROL_WIDTH}px`,
    height: `${TITLEBAR_HEIGHT}px`,
    color: tokens.colors.icon.default,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  };

  const sessionInfoStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.md,
    "margin-left": tokens.spacing.md,
  };

  return (
    <header style={headerStyle} data-tauri-drag-region>
      {/* Left section - Menu and controls */}
      <div style={leftSectionStyle}>
        <IconButton
          onClick={toggleSidebar}
          tooltip="Toggle sidebar"
          size="md"
        >
          <Icon name="bars" size={16} />
        </IconButton>
        
        <Show when={state.currentSession}>
          <div style={sessionInfoStyle} data-tauri-drag-region>
            <Text weight="medium" size="sm">
              {state.currentSession!.title}
            </Text>
            <Text variant="muted" size="xs">
              {state.messages.length} messages
            </Text>
          </div>
        </Show>
      </div>

      {/* Center section - App title (draggable) */}
      <div style={centerSectionStyle} data-tauri-drag-region>
        <Text variant="muted" size="sm" data-tauri-drag-region>
          Cortex Desktop
        </Text>
      </div>

      {/* Right section - Actions and Window Controls */}
      <div style={rightSectionStyle}>
        {/* App actions */}
        <div style={appActionsStyle}>
          <ModelSelector />
          
          <Show when={state.isStreaming}>
            <IconButton
              onClick={interrupt}
              tooltip="Stop generation"
              size="md"
              style={{ color: tokens.colors.semantic.error }}
            >
              <Icon name="square" size={16} />
            </IconButton>
          </Show>

          <IconButton
            onClick={handleNewSession}
            tooltip="New session (Ctrl+N)"
            size="md"
          >
            <Icon name="plus" size={16} />
          </IconButton>

          <IconButton
            onClick={() => setShowCommandPalette(true)}
            tooltip="Command palette (Ctrl+K)"
            size="md"
          >
            <Icon name="command" size={16} />
          </IconButton>

          <IconButton
            onClick={() => window.dispatchEvent(new CustomEvent("settings:open-tab"))}
            tooltip="Settings"
            size="md"
          >
            <Icon name="gear" size={16} />
          </IconButton>
        </div>

        {/* Window Controls - Windows style */}
        <div style={windowControlsStyle}>
          {/* Minimize */}
          <button
            onClick={handleMinimize}
            style={windowControlStyle}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            title="Minimize"
          >
            <Icon name="minus" size={16} />
          </button>

          {/* Maximize/Restore */}
          <button
            onClick={handleMaximize}
            style={windowControlStyle}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            title={isMaximized() ? "Restore" : "Maximize"}
          >
            <Show when={isMaximized()} fallback={
              <Icon name="maximize" size={14} />
            }>
              {/* Restore icon - two overlapping squares */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="5" width="8" height="8" rx="1" />
                <path d="M5 5V3.5A1.5 1.5 0 016.5 2H11.5A1.5 1.5 0 0113 3.5V8.5A1.5 1.5 0 0111.5 10H10" />
              </svg>
            </Show>
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            style={windowControlStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--cortex-error)";
              e.currentTarget.style.color = "var(--cortex-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = tokens.colors.icon.default;
            }}
            title="Close"
          >
            <Icon name="xmark" size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}


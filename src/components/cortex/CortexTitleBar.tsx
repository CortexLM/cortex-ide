/**
 * CortexTitleBar - Pixel-perfect title bar matching Figma Header (443:7609)
 * Layout: Flexbox with justify-content: space-between
 * Left: Logo (40×40) + (Vibe/IDE toggle + Open Project) + Menu items
 * Right: Config badge + Start/Pause + vertical separator + Window controls
 * Gap: 44px, Padding: 0 0 0 8px, Height: 56px
 *
 * OS-aware window controls:
 * - macOS: traffic-light circles on the LEFT
 * - Windows/Linux: — □ × buttons on the RIGHT
 */

import { Component, JSX, splitProps, Show, For, onMount, onCleanup } from "solid-js";
import {
  CortexHeaderItem,
  CortexConfigBadge,
  CortexStartPause,
} from "./primitives";
import { CortexVibeToggle } from "./primitives/CortexVibeToggle";
import { CortexOpenProjectDropdown } from "./primitives/CortexOpenProjectDropdown";
import { TitleBarDropdownMenu } from "./titlebar/TitleBarDropdownMenu";
import { WindowControls } from "./titlebar/WindowControls";
import { CortexLogo } from "./titlebar/CortexLogo";
import { MENU_LABELS, DEFAULT_MENUS } from "./titlebar/defaultMenus";
import { detectPlatform } from "./titlebar/platformDetect";
import type { MenuItem } from "./titlebar/defaultMenus";

export type { MenuItem };

export interface CortexTitleBarProps {
  appName?: string;
  currentPage?: string;
  isDraft?: boolean;
  mode?: "vibe" | "ide";
  onModeChange?: (mode: "vibe" | "ide") => void;
  isDarkMode?: boolean;
  onThemeChange?: (isDark: boolean) => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  isMenuOpen?: boolean;
  onMenuToggle?: () => void;
  activeMenu?: string | null;
  onMenuSelect?: (menu: string | null) => void;
  menuItems?: Record<string, MenuItem[]>;
  configLabel?: string;
  isConfigOpen?: boolean;
  onConfigClick?: (e: MouseEvent) => void;
  configChildren?: JSX.Element;
  isRunning?: boolean;
  onStartPause?: (e: MouseEvent) => void;
  openProjectLabel?: string;
  isProjectDropdownOpen?: boolean;
  onProjectDropdownClick?: (e: MouseEvent) => void;
  projectDropdownChildren?: JSX.Element;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexTitleBar: Component<CortexTitleBarProps> = (props) => {
  const [local, others] = splitProps(props, [
    "appName", "currentPage", "isDraft", "mode", "onModeChange",
    "isDarkMode", "onThemeChange", "onMinimize", "onMaximize", "onClose",
    "isMenuOpen", "onMenuToggle", "activeMenu", "onMenuSelect", "menuItems",
    "configLabel", "isConfigOpen", "onConfigClick", "configChildren",
    "isRunning", "onStartPause", "openProjectLabel", "isProjectDropdownOpen",
    "onProjectDropdownClick", "projectDropdownChildren", "class", "style",
  ]);

  const isMac = detectPlatform() === "macos";

  type WindowHandle = {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    unmaximize: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    close: () => Promise<void>;
  };
  let windowHandle: WindowHandle | null = null;

  onMount(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      windowHandle = getCurrentWindow();
    } catch {
      // Not in Tauri context
    }
  });

  const handleMinimize = async () => {
    if (local.onMinimize) return local.onMinimize();
    if (windowHandle) await windowHandle.minimize();
  };

  const handleMaximize = async () => {
    if (local.onMaximize) return local.onMaximize();
    if (windowHandle) {
      const isMax = await windowHandle.isMaximized();
      if (isMax) await windowHandle.unmaximize();
      else await windowHandle.maximize();
    }
  };

  const handleClose = async () => {
    if (local.onClose) return local.onClose();
    if (windowHandle) await windowHandle.close();
  };

  const getMenuItems = (menu: string) =>
    local.menuItems?.[menu] || DEFAULT_MENUS[menu] || [];

  const handleMenuItemClick = (item: MenuItem) => {
    if (item.action) item.action();
    local.onMenuSelect?.(null);
  };

  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let menuBarRef: HTMLDivElement | undefined;

  const cancelCloseTimer = () => {
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  };

  const startCloseTimer = () => {
    cancelCloseTimer();
    closeTimer = setTimeout(() => {
      local.onMenuSelect?.(null);
      closeTimer = null;
    }, 200);
  };

  const handleMenuMouseEnter = (label: string) => {
    cancelCloseTimer();
    local.onMenuSelect?.(label);
  };

  const handleMenuMouseLeave = () => {
    startCloseTimer();
  };

  const handleMenuClick = (label: string) => {
    cancelCloseTimer();
    if (local.activeMenu === label) {
      local.onMenuSelect?.(null);
    } else {
      local.onMenuSelect?.(label);
    }
  };

  onMount(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && local.activeMenu) local.onMenuSelect?.(null);
    };
    const clickOutsideHandler = (e: MouseEvent) => {
      if (local.activeMenu && menuBarRef && !menuBarRef.contains(e.target as Node)) {
        local.onMenuSelect?.(null);
      }
    };
    document.addEventListener("keydown", keyHandler);
    document.addEventListener("mousedown", clickOutsideHandler);
    onCleanup(() => {
      document.removeEventListener("keydown", keyHandler);
      document.removeEventListener("mousedown", clickOutsideHandler);
      cancelCloseTimer();
    });
  });

  const windowControlsEl = () => (
    <WindowControls
      onMinimize={handleMinimize}
      onMaximize={handleMaximize}
      onClose={handleClose}
    />
  );

  return (
    <header
      class={local.class}
      data-tauri-drag-region
      style={{
        display: "flex",
        "justify-content": "space-between",
        "align-items": "center",
        gap: "44px",
        width: "100%",
        height: "56px",
        "min-height": "56px",
        padding: "0 0 0 8px",
        background: "transparent",
        position: "relative",
        "-webkit-app-region": "drag",
        "user-select": "none",
        ...local.style,
      }}
      {...others}
    >
      {/* Left Section */}
      <div style={{
        display: "flex",
        "align-items": "center",
        gap: "12px",
        "-webkit-app-region": "no-drag",
        "min-width": "0",
        "flex-shrink": "1",
        overflow: "hidden",
      }}>
        <Show when={isMac}>
          {windowControlsEl()}
        </Show>

        <CortexLogo size={40} />

        <div style={{
          display: "flex",
          "align-items": "center",
          gap: "4px",
        }}>
          <div style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
          }}>
            <CortexVibeToggle
              mode={local.mode ?? "ide"}
              onChange={local.onModeChange}
            />
            <CortexOpenProjectDropdown
              label={local.openProjectLabel}
              isOpen={local.isProjectDropdownOpen}
              onClick={local.onProjectDropdownClick}
            >
              {local.projectDropdownChildren}
            </CortexOpenProjectDropdown>
          </div>

          <div ref={menuBarRef} style={{ display: "flex", "align-items": "center", "min-width": "0", overflow: "hidden" }}>
            <For each={MENU_LABELS}>
              {(label) => (
                <div
                  style={{ position: "relative" }}
                  onMouseEnter={() => handleMenuMouseEnter(label)}
                  onMouseLeave={handleMenuMouseLeave}
                >
                  <CortexHeaderItem
                    label={label}
                    isActive={local.activeMenu === label}
                    onClick={() => handleMenuClick(label)}
                  />
                  <Show when={local.activeMenu === label}>
                    <TitleBarDropdownMenu
                      items={getMenuItems(label)}
                      onItemClick={handleMenuItemClick}
                      onMouseEnter={cancelCloseTimer}
                      onMouseLeave={handleMenuMouseLeave}
                    />
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div style={{
        display: "flex",
        "align-items": "center",
        gap: "20px",
        "-webkit-app-region": "no-drag",
        "flex-shrink": "0",
      }}>
        <div style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
        }}>
          <CortexConfigBadge
            label={local.configLabel ?? "config"}
            isOpen={local.isConfigOpen}
            onClick={local.onConfigClick}
          >
            {local.configChildren}
          </CortexConfigBadge>
          <CortexStartPause
            state={local.isRunning ? "pause" : "start"}
            onClick={local.onStartPause}
          />
        </div>

        {/* Vertical Separator */}
        <div style={{
          width: "1px",
          height: "20px",
          background: "#2E2F31",
          "flex-shrink": "0",
        }} />

        <Show when={!isMac}>
          {windowControlsEl()}
        </Show>
      </div>

    </header>
  );
};

export default CortexTitleBar;

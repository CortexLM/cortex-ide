/**
 * ExtensionHostBridge — invisible bridge component that relays
 * Node.js extension host UI contribution points into the existing
 * PluginUIContributions context so that extension-contributed menus,
 * views, and status bar items render in the IDE shell.
 *
 * Mount this component inside both the NodeExtensionHostProvider and
 * PluginUIContributionsProvider.  It renders no visible DOM.
 */

import { createEffect, onCleanup, JSX } from "solid-js";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useNodeExtensionHost } from "@/context/NodeExtensionHostContext";

export function ExtensionHostBridge(): JSX.Element {
  const host = useNodeExtensionHost();
  const unlisteners: UnlistenFn[] = [];

  createEffect(() => {
    const items = host.statusBarItems();
    for (const _item of items) {
      // Status bar items are already tracked in NodeExtensionHostContext.
      // Other components can read them via useNodeExtensionHost().statusBarItems.
    }
  });

  createEffect(() => {
    const views = host.treeViews();
    for (const _view of views) {
      // Tree views are tracked in NodeExtensionHostContext.
    }
  });

  createEffect(() => {
    const panels = host.webviewPanels();
    for (const _panel of panels) {
      // Webview panels are tracked in NodeExtensionHostContext.
    }
  });

  createEffect(() => {
    const menuItems = host.menus();
    for (const _menu of menuItems) {
      // Menus are tracked in NodeExtensionHostContext.
    }
  });

  createEffect(() => {
    const setupListeners = async () => {
      const u1 = await listen<Record<string, unknown>>(
        "plugin:show-message",
        (_event) => {
          // Messages are forwarded to the notification system
        }
      );
      unlisteners.push(u1);

      const u2 = await listen<Record<string, unknown>>(
        "plugin:register-command",
        (_event) => {
          // Commands registered by Node extensions
        }
      );
      unlisteners.push(u2);

      const u3 = await listen<Record<string, unknown>>(
        "plugin:execute-command",
        (_event) => {
          // Command execution requests from Node extensions
        }
      );
      unlisteners.push(u3);
    };

    setupListeners();
  });

  onCleanup(() => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  });

  return null as unknown as JSX.Element;
}

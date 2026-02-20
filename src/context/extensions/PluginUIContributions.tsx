/**
 * PluginUIContributions - Manages plugin-contributed UI elements
 *
 * Maintains a reactive store of UI contributions from extensions: sidebar
 * views, bottom panel tabs, status bar items, command palette entries,
 * context menu items, and configuration sections.  Other components query
 * this store to render plugin content dynamically.
 */

import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  ParentProps,
  JSX,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { extensionLogger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

export interface SidebarViewContribution {
  viewId: string;
  extensionId: string;
  title: string;
  icon?: string;
}

export interface PanelTabContribution {
  panelId: string;
  extensionId: string;
  title: string;
  icon?: string;
}

export interface StatusBarItemContribution {
  itemId: string;
  extensionId: string;
  text: string;
  tooltip?: string;
  command?: string;
  priority?: number;
  alignment?: "left" | "right";
}

export interface CommandPaletteEntry {
  commandId: string;
  extensionId: string;
  title: string;
  category?: string;
}

export interface ContextMenuContribution {
  menuItemId: string;
  extensionId: string;
  label: string;
  command: string;
  group?: string;
  when?: string;
}

export interface ConfigurationSectionContribution {
  sectionId: string;
  extensionId: string;
  title: string;
  properties: Record<string, ConfigurationProperty>;
}

export interface ConfigurationProperty {
  type: string;
  default?: unknown;
  description?: string;
  enum?: unknown[];
  enumDescriptions?: string[];
}

export interface PluginContributions {
  sidebarViews: SidebarViewContribution[];
  panelTabs: PanelTabContribution[];
  statusBarItems: StatusBarItemContribution[];
  commandPalette: CommandPaletteEntry[];
  contextMenuItems: ContextMenuContribution[];
  configurationSections: ConfigurationSectionContribution[];
}

export interface PluginUIContributionsContextValue {
  contributions: PluginContributions;
  getSidebarViews: (extensionId?: string) => SidebarViewContribution[];
  getPanelTabs: (extensionId?: string) => PanelTabContribution[];
  getStatusBarItems: (alignment?: "left" | "right") => StatusBarItemContribution[];
  getCommandPaletteEntries: () => CommandPaletteEntry[];
  getContextMenuItems: (group?: string) => ContextMenuContribution[];
  getConfigurationSections: (extensionId?: string) => ConfigurationSectionContribution[];
  removeContributions: (extensionId: string) => void;
}

// ============================================================================
// Event payload types
// ============================================================================

interface SidebarViewPayload {
  view_id: string;
  extension_id: string;
  title: string;
  icon?: string;
}

interface PanelTabPayload {
  panel_id: string;
  extension_id: string;
  title: string;
  icon?: string;
}

interface StatusBarPayload {
  extension_id: string;
  text: string;
  tooltip?: string;
  command?: string;
  priority?: number;
  alignment?: "left" | "right";
}

interface CommandPalettePayload {
  command_id: string;
  extension_id: string;
  title: string;
  category?: string;
}

interface ContextMenuPayload {
  menu_item_id: string;
  extension_id: string;
  label: string;
  command: string;
  group?: string;
  when?: string;
}

interface ConfigurationSectionPayload {
  section_id: string;
  extension_id: string;
  title: string;
  properties: Record<string, ConfigurationProperty>;
}

interface ExtensionRemovedPayload {
  extension_id: string;
}

// ============================================================================
// Context
// ============================================================================

const PluginUIContributionsContext =
  createContext<PluginUIContributionsContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function PluginUIContributionsProvider(
  props: ParentProps,
): JSX.Element {
  const [contributions, setContributions] = createStore<PluginContributions>({
    sidebarViews: [],
    panelTabs: [],
    statusBarItems: [],
    commandPalette: [],
    contextMenuItems: [],
    configurationSections: [],
  });

  const unlistenFns: UnlistenFn[] = [];

  const getSidebarViews = (extensionId?: string) => {
    if (!extensionId) return contributions.sidebarViews;
    return contributions.sidebarViews.filter(
      (v) => v.extensionId === extensionId,
    );
  };

  const getPanelTabs = (extensionId?: string) => {
    if (!extensionId) return contributions.panelTabs;
    return contributions.panelTabs.filter(
      (t) => t.extensionId === extensionId,
    );
  };

  const getStatusBarItems = (alignment?: "left" | "right") => {
    if (!alignment) return contributions.statusBarItems;
    return contributions.statusBarItems.filter(
      (i) => (i.alignment ?? "left") === alignment,
    );
  };

  const getCommandPaletteEntries = () => contributions.commandPalette;

  const getContextMenuItems = (group?: string) => {
    if (!group) return contributions.contextMenuItems;
    return contributions.contextMenuItems.filter((i) => i.group === group);
  };

  const getConfigurationSections = (extensionId?: string) => {
    if (!extensionId) return contributions.configurationSections;
    return contributions.configurationSections.filter(
      (s) => s.extensionId === extensionId,
    );
  };

  const removeContributions = (extensionId: string) => {
    setContributions(
      produce((draft) => {
        draft.sidebarViews = draft.sidebarViews.filter(
          (v) => v.extensionId !== extensionId,
        );
        draft.panelTabs = draft.panelTabs.filter(
          (t) => t.extensionId !== extensionId,
        );
        draft.statusBarItems = draft.statusBarItems.filter(
          (i) => i.extensionId !== extensionId,
        );
        draft.commandPalette = draft.commandPalette.filter(
          (e) => e.extensionId !== extensionId,
        );
        draft.contextMenuItems = draft.contextMenuItems.filter(
          (m) => m.extensionId !== extensionId,
        );
        draft.configurationSections = draft.configurationSections.filter(
          (s) => s.extensionId !== extensionId,
        );
      }),
    );
  };

  const setupListeners = async () => {
    try {
      const u1 = await listen<SidebarViewPayload>(
        "plugin:register-sidebar-view",
        (event) => {
          const p = event.payload;
          setContributions(
            produce((draft) => {
              if (!draft.sidebarViews.some((v) => v.viewId === p.view_id)) {
                draft.sidebarViews.push({
                  viewId: p.view_id,
                  extensionId: p.extension_id,
                  title: p.title,
                  icon: p.icon,
                });
              }
            }),
          );
        },
      );
      unlistenFns.push(u1);
    } catch (e) {
      extensionLogger.warn("Failed to listen for sidebar view events:", e);
    }

    try {
      const u2 = await listen<PanelTabPayload>(
        "plugin:register-panel-tab",
        (event) => {
          const p = event.payload;
          setContributions(
            produce((draft) => {
              if (!draft.panelTabs.some((t) => t.panelId === p.panel_id)) {
                draft.panelTabs.push({
                  panelId: p.panel_id,
                  extensionId: p.extension_id,
                  title: p.title,
                  icon: p.icon,
                });
              }
            }),
          );
        },
      );
      unlistenFns.push(u2);
    } catch (e) {
      extensionLogger.warn("Failed to listen for panel tab events:", e);
    }

    try {
      const u3 = await listen<StatusBarPayload>(
        "plugin:statusbar-update",
        (event) => {
          const p = event.payload;
          setContributions(
            produce((draft) => {
              const existing = draft.statusBarItems.find(
                (i) => i.extensionId === p.extension_id,
              );
              if (existing) {
                existing.text = p.text;
                existing.tooltip = p.tooltip;
                existing.command = p.command;
              } else {
                draft.statusBarItems.push({
                  itemId: `statusbar-${p.extension_id}-${Date.now()}`,
                  extensionId: p.extension_id,
                  text: p.text,
                  tooltip: p.tooltip,
                  command: p.command,
                  priority: p.priority,
                  alignment: p.alignment,
                });
              }
            }),
          );
        },
      );
      unlistenFns.push(u3);
    } catch (e) {
      extensionLogger.warn("Failed to listen for status bar events:", e);
    }

    try {
      const u4 = await listen<CommandPalettePayload>(
        "plugin:register-command",
        (event) => {
          const p = event.payload;
          setContributions(
            produce((draft) => {
              if (
                !draft.commandPalette.some(
                  (c) => c.commandId === p.command_id,
                )
              ) {
                draft.commandPalette.push({
                  commandId: p.command_id,
                  extensionId: p.extension_id,
                  title: p.title,
                  category: p.category,
                });
              }
            }),
          );
        },
      );
      unlistenFns.push(u4);
    } catch (e) {
      extensionLogger.warn("Failed to listen for command palette events:", e);
    }

    try {
      const u5 = await listen<ContextMenuPayload>(
        "plugin:register-context-menu",
        (event) => {
          const p = event.payload;
          setContributions(
            produce((draft) => {
              if (
                !draft.contextMenuItems.some(
                  (m) => m.menuItemId === p.menu_item_id,
                )
              ) {
                draft.contextMenuItems.push({
                  menuItemId: p.menu_item_id,
                  extensionId: p.extension_id,
                  label: p.label,
                  command: p.command,
                  group: p.group,
                  when: p.when,
                });
              }
            }),
          );
        },
      );
      unlistenFns.push(u5);
    } catch (e) {
      extensionLogger.warn("Failed to listen for context menu events:", e);
    }

    try {
      const u7 = await listen<ConfigurationSectionPayload>(
        "plugin:register-configuration-section",
        (event) => {
          const p = event.payload;
          setContributions(
            produce((draft) => {
              if (!draft.configurationSections.some((s) => s.sectionId === p.section_id)) {
                draft.configurationSections.push({
                  sectionId: p.section_id,
                  extensionId: p.extension_id,
                  title: p.title,
                  properties: p.properties,
                });
              }
            }),
          );
        },
      );
      unlistenFns.push(u7);
    } catch (e) {
      extensionLogger.warn("Failed to listen for configuration section events:", e);
    }

    try {
      const u6 = await listen<ExtensionRemovedPayload>(
        "plugin:extension-removed",
        (event) => {
          removeContributions(event.payload.extension_id);
        },
      );
      unlistenFns.push(u6);
    } catch (e) {
      extensionLogger.warn("Failed to listen for extension-removed events:", e);
    }
  };

  onMount(() => {
    setupListeners();
  });

  onCleanup(() => {
    for (const unlisten of unlistenFns) {
      unlisten();
    }
    unlistenFns.length = 0;
  });

  const value: PluginUIContributionsContextValue = {
    contributions,
    getSidebarViews,
    getPanelTabs,
    getStatusBarItems,
    getCommandPaletteEntries,
    getContextMenuItems,
    getConfigurationSections,
    removeContributions,
  };

  return (
    <PluginUIContributionsContext.Provider value={value}>
      {props.children}
    </PluginUIContributionsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function usePluginUIContributions(): PluginUIContributionsContextValue {
  const context = useContext(PluginUIContributionsContext);
  if (!context) {
    throw new Error(
      "usePluginUIContributions must be used within PluginUIContributionsProvider",
    );
  }
  return context;
}

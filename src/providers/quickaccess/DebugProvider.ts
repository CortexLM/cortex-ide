/**
 * =============================================================================
 * DEBUG PROVIDER - debug prefix
 * =============================================================================
 * 
 * Lists launch configurations from launch.json.
 * Shows active debug session with controls.
 * Accessible via "debug " prefix in quick access.
 */

import type { QuickAccessProvider, QuickAccessItem, QuickAccessItemButton } from "./types";
import { Icon } from "../../components/ui/Icon";
import type { DebugSessionInfo, SavedLaunchConfig } from "@/context/DebugContext";
import type { Component, JSX } from "solid-js";

/**
 * Debug item data
 */
interface DebugItemData {
  type: "launch" | "stop" | "restart" | "add";
  configName?: string;
  sessionId?: string;
}

/**
 * Get icon for debug type
 */
function getDebugTypeIcon(type: string): Component<{ style?: JSX.CSSProperties }> {
  const lowerType = type.toLowerCase();
  
  if (lowerType.includes("node") || lowerType.includes("pwa")) {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
  }
  
  return (props: { style?: JSX.CSSProperties }) => Icon({ name: "bug", style: props.style });
}

/**
 * Get description for debug type
 */
function getDebugTypeDescription(config: SavedLaunchConfig): string {
  const parts: string[] = [];
  
  if (config.type) {
    parts.push(config.type);
  }
  
  if (config.request) {
    parts.push(config.request);
  }
  
  return parts.join(" - ");
}

/**
 * Create the Debug Provider
 */
export function createDebugProvider(
  getLaunchConfigs: () => SavedLaunchConfig[],
  getActiveSession: () => DebugSessionInfo | undefined,
  startSession: (config: SavedLaunchConfig) => Promise<void>,
  stopSession: (sessionId?: string) => Promise<void>,
  restartSession: (sessionId?: string) => Promise<void>,
  hide: () => void
): QuickAccessProvider<DebugItemData> {
  
  return {
    id: "quickaccess.debug",
    prefix: "debug ",
    name: "Debug",
    description: "Start debugging or manage sessions",
    placeholder: "Search debug configurations...",

    async provideItems(query: string): Promise<QuickAccessItem<DebugItemData>[]> {
      const items: QuickAccessItem<DebugItemData>[] = [];
      const trimmedQuery = query.trim().toLowerCase();
      const configs = getLaunchConfigs();
      const activeSession = getActiveSession();

      // Active session controls first
      if (activeSession) {
        const stopButton: QuickAccessItemButton = {
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "stop", style: props.style }),
          tooltip: "Stop",
          onClick: () => stopSession(activeSession.id),
        };

        const restartButton: QuickAccessItemButton = {
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "rotate", style: props.style }),
          tooltip: "Restart",
          onClick: () => restartSession(activeSession.id),
        };

        // Check if matches query
        const matchesQuery = !trimmedQuery || activeSession.name.toLowerCase().includes(trimmedQuery);

        if (matchesQuery) {
          items.push({
            id: "separator-active",
            label: "Active Session",
            kind: "separator",
          });

          items.push({
            id: `active-${activeSession.id}`,
            label: activeSession.name,
            description: "Active",
            detail: `Type: ${activeSession.type}`,
            icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "play", style: props.style }),
            iconColor: "#22c55e", // Green for active
            buttons: [restartButton, stopButton],
            data: { type: "stop" as const, sessionId: activeSession.id },
          });
        }
      }

      // Filter configs by query
      const filteredConfigs = configs.filter(config => {
        if (!trimmedQuery) return true;
        const name = config.name.toLowerCase();
        const type = (config.type || "").toLowerCase();
        return name.includes(trimmedQuery) || type.includes(trimmedQuery);
      });

      // Add separator if we have active session and configs
      if (activeSession && filteredConfigs.length > 0) {
        items.push({
          id: "separator-configs",
          label: "Launch Configurations",
          kind: "separator",
        });
      } else if (filteredConfigs.length > 0 && !activeSession) {
        items.push({
          id: "separator-configs",
          label: "Launch Configurations",
          kind: "separator",
        });
      }

      // Add launch configs
      const configItems = filteredConfigs.map(config => ({
        id: `config-${config.name}`,
        label: config.name,
        description: getDebugTypeDescription(config),
        detail: config.program || config.cwd,
        icon: getDebugTypeIcon(config.type),
        data: { type: "launch" as const, configName: config.name },
      }));

      items.push(...configItems);

      // Add configuration action
      if (!trimmedQuery || "add configuration".includes(trimmedQuery) || "create".includes(trimmedQuery)) {
        if (items.length > 0) {
          items.push({
            id: "separator-actions",
            label: "Actions",
            kind: "separator",
          });
        }

        items.push({
          id: "add-config",
          label: "Add Configuration...",
          description: "Create a new launch configuration",
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "plus", style: props.style }),
          data: { type: "add" as const },
        });
      }

      // If no configs at all
      if (configs.length === 0 && !activeSession) {
        items.push({
          id: "no-configs",
          label: "No debug configurations found",
          description: "Create a launch.json file to configure debugging",
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "gear", style: props.style }),
          data: { type: "add" as const },
        });
      }

      return items;
    },

    onSelect(item: QuickAccessItem<DebugItemData>): void {
      if (!item.data) return;
      
      hide();

      switch (item.data.type) {
        case "launch":
          if (item.data.configName) {
            const configs = getLaunchConfigs();
            const config = configs.find(c => c.name === item.data!.configName);
            if (config) {
              startSession(config);
            }
          }
          break;
        case "stop":
          stopSession(item.data.sessionId);
          break;
        case "restart":
          restartSession(item.data.sessionId);
          break;
        case "add":
          // Open launch.json configuration
          window.dispatchEvent(new CustomEvent("debug:add-configuration"));
          break;
      }
    },

    onButtonClick(_item: QuickAccessItem<DebugItemData>, button: QuickAccessItemButton): void {
      button.onClick();
    },
  };
}

export default createDebugProvider;

/**
 * =============================================================================
 * TERMINAL PROVIDER - term prefix
 * =============================================================================
 * 
 * Lists all terminals + options to create new ones.
 * Accessible via "term " prefix in quick access.
 */

import type { QuickAccessProvider, QuickAccessItem, QuickAccessItemButton } from "./types";
import { Icon } from "../../components/ui/Icon";
import type { TerminalInfo, TerminalProfile } from "@/context/TerminalsContext";
import type { Component, JSX } from "solid-js";

/**
 * Terminal item data
 */
interface TerminalItemData {
  type: "focus" | "create" | "close";
  terminalId?: string;
  profileId?: string;
}

/**
 * Get icon for terminal profile based on shell type
 */
function getTerminalIcon(terminal: TerminalInfo): Component<{ style?: JSX.CSSProperties }> {
  const shell = (terminal.shell || "").toLowerCase();
  
  if (shell.includes("powershell") || shell.includes("pwsh")) {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
  }
  if (shell.includes("bash") || shell.includes("git")) {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
  }
  if (shell.includes("cmd")) {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
  }
  if (shell.includes("wsl") || shell.includes("ubuntu") || shell.includes("linux")) {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
  }
  if (terminal.type === "ssh") {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "globe", style: props.style });
  }
  
  return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
}

/**
 * Get icon for profile
 */
function getProfileIcon(profile: TerminalProfile): Component<{ style?: JSX.CSSProperties }> {
  const icon = profile.icon?.toLowerCase() || "";
  
  if (icon === "powershell" || icon.includes("powershell")) {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
  }
  if (icon === "bash" || icon.includes("bash")) {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
  }
  if (icon === "cmd" || icon.includes("cmd")) {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
  }
  if (icon === "ubuntu" || icon === "wsl" || icon.includes("linux")) {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
  }
  
  return (props: { style?: JSX.CSSProperties }) => Icon({ name: "terminal", style: props.style });
}

/**
 * Create the Terminal Provider
 */
export function createTerminalProvider(
  getTerminals: () => TerminalInfo[],
  getProfiles: () => TerminalProfile[],
  focusTerminal: (id: string) => void,
  createTerminal: (profileId?: string) => Promise<void>,
  closeTerminal: (id: string) => Promise<void>,
  hide: () => void
): QuickAccessProvider<TerminalItemData> {
  
  return {
    id: "quickaccess.terminal",
    prefix: "term ",
    name: "Terminal",
    description: "Open or create terminals",
    placeholder: "Search terminals or create new...",

    async provideItems(query: string): Promise<QuickAccessItem<TerminalItemData>[]> {
      const items: QuickAccessItem<TerminalItemData>[] = [];
      const trimmedQuery = query.trim().toLowerCase();
      const terminals = getTerminals();
      const profiles = getProfiles();

      // Add existing terminals
      const terminalItems = terminals
        .filter(t => {
          if (!trimmedQuery) return true;
          const name = (t.name || "").toLowerCase();
          const shell = (t.shell || "").toLowerCase();
          return name.includes(trimmedQuery) || shell.includes(trimmedQuery);
        })
        .map(terminal => {
          const closeButton: QuickAccessItemButton = {
            icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "xmark", style: props.style }),
            tooltip: "Close Terminal",
            onClick: () => {
              closeTerminal(terminal.id);
            },
          };

          return {
            id: `terminal-${terminal.id}`,
            label: terminal.name || `Terminal ${terminal.id.slice(0, 8)}`,
            description: terminal.type === "ssh" ? "SSH" : "Local",
            detail: terminal.cwd,
            icon: getTerminalIcon(terminal),
            buttons: [closeButton],
            data: { type: "focus" as const, terminalId: terminal.id },
          };
        });

      if (terminalItems.length > 0) {
        items.push(...terminalItems);
      }

      // Add separator before new terminal options
      if (terminalItems.length > 0 && profiles.length > 0) {
        items.push({
          id: "separator-new",
          label: "New Terminal",
          kind: "separator",
        });
      }

      // Add profile options for creating new terminals
      const profileItems = profiles
        .filter(profile => {
          if (!trimmedQuery) return true;
          const name = (profile.name || "").toLowerCase();
          return name.includes(trimmedQuery);
        })
        .map(profile => ({
          id: `profile-${profile.id}`,
          label: `New ${profile.name}`,
          description: profile.isDefault ? "Default" : undefined,
          icon: getProfileIcon(profile),
          iconColor: profile.color,
          data: { type: "create" as const, profileId: profile.id },
        }));

      items.push(...profileItems);

      // If no profiles, add a generic "New Terminal" option
      if (profiles.length === 0) {
        items.push({
          id: "new-terminal",
          label: "New Terminal",
          description: "Create a new terminal",
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "plus", style: props.style }),
          data: { type: "create" as const },
        });
      }

      return items;
    },

    onSelect(item: QuickAccessItem<TerminalItemData>): void {
      if (!item.data) return;
      
      hide();

      switch (item.data.type) {
        case "focus":
          if (item.data.terminalId) {
            focusTerminal(item.data.terminalId);
          }
          break;
        case "create":
          createTerminal(item.data.profileId);
          break;
      }
    },

    onButtonClick(_item: QuickAccessItem<TerminalItemData>, button: QuickAccessItemButton): void {
      // Button onClick is called directly
      button.onClick();
    },
  };
}

export default createTerminalProvider;

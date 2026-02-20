/**
 * =============================================================================
 * EXTENSION PROVIDER - ext prefix
 * =============================================================================
 * 
 * Lists installed extensions with enable/disable actions.
 * Provides options to install new extensions.
 * Accessible via "ext " prefix in quick access.
 */

import type { QuickAccessProvider, QuickAccessItem, QuickAccessItemButton } from "./types";
import { Icon } from "../../components/ui/Icon";
import type { Extension } from "@/context/ExtensionsContext";
import type { JSX } from "solid-js";

/**
 * Extension item data
 */
interface ExtensionItemData {
  type: "show" | "enable" | "disable" | "uninstall" | "install" | "list" | "refresh";
  extensionId?: string;
  extensionName?: string;
}

/**
 * Create the Extension Provider
 */
export function createExtensionProvider(
  getExtensions: () => Extension[],
  enableExtension: (name: string) => Promise<void>,
  disableExtension: (name: string) => Promise<void>,
  uninstallExtension: (name: string) => Promise<void>,
  openExtensionDetails: (id: string) => void,
  openExtensionMarketplace: () => void,
  refreshExtensions: () => Promise<void>,
  hide: () => void
): QuickAccessProvider<ExtensionItemData> {
  
  return {
    id: "quickaccess.extension",
    prefix: "ext ",
    name: "Extensions",
    description: "Manage installed extensions",
    placeholder: "Search extensions...",

    async provideItems(query: string): Promise<QuickAccessItem<ExtensionItemData>[]> {
      const items: QuickAccessItem<ExtensionItemData>[] = [];
      const trimmedQuery = query.trim().toLowerCase();
      const extensions = getExtensions();

      // Filter extensions by query
      const filteredExtensions = extensions.filter(ext => {
        if (!trimmedQuery) return true;
        const name = ext.manifest.name.toLowerCase();
        const displayName = (ext.manifest.description || "").toLowerCase();
        return name.includes(trimmedQuery) || displayName.includes(trimmedQuery);
      });

      // Add installed extensions
      if (filteredExtensions.length > 0) {
        items.push({
          id: "separator-installed",
          label: "Installed Extensions",
          kind: "separator",
        });

        const extensionItems = filteredExtensions.map(ext => {
          const buttons: QuickAccessItemButton[] = [];

          // Enable/Disable button
          if (ext.enabled) {
            buttons.push({
              icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "xmark", style: props.style }),
              tooltip: "Disable",
              onClick: () => disableExtension(ext.manifest.name),
            });
          } else {
            buttons.push({
              icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "check", style: props.style }),
              tooltip: "Enable",
              onClick: () => enableExtension(ext.manifest.name),
            });
          }

          // Uninstall button
          buttons.push({
            icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "trash", style: props.style }),
            tooltip: "Uninstall",
            onClick: () => {
              if (confirm(`Uninstall ${ext.manifest.name}?`)) {
                uninstallExtension(ext.manifest.name);
              }
            },
          });

          return {
            id: `ext-${ext.manifest.name}`,
            label: ext.manifest.name,
            description: ext.enabled ? "Enabled" : "Disabled",
            detail: ext.manifest.description,
            icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "box", style: props.style }),
            iconColor: ext.enabled ? "#22c55e" : "#6b7280", // Green if enabled, gray if disabled
            buttons,
            data: {
              type: "show" as const,
              extensionId: ext.manifest.name,
              extensionName: ext.manifest.name,
            },
          };
        });

        items.push(...extensionItems);
      }

      // Add actions section
      const showActions = !trimmedQuery || 
        "install".includes(trimmedQuery) || 
        "marketplace".includes(trimmedQuery) ||
        "refresh".includes(trimmedQuery) ||
        "show".includes(trimmedQuery);

      if (showActions) {
        items.push({
          id: "separator-actions",
          label: "Actions",
          kind: "separator",
        });

        // Install Extension
        if (!trimmedQuery || "install".includes(trimmedQuery) || "marketplace".includes(trimmedQuery)) {
          items.push({
            id: "install-extension",
            label: "Install Extension...",
            description: "Browse and install extensions from marketplace",
            icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "cloud-arrow-down", style: props.style }),
            data: { type: "install" as const },
          });
        }

        // Show Installed Extensions
        if (!trimmedQuery || "show".includes(trimmedQuery) || "installed".includes(trimmedQuery) || "list".includes(trimmedQuery)) {
          items.push({
            id: "show-installed",
            label: "Show Installed Extensions",
            description: "View all installed extensions",
            icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "list", style: props.style }),
            data: { type: "list" as const },
          });
        }

        // Refresh Extensions
        if (!trimmedQuery || "refresh".includes(trimmedQuery) || "reload".includes(trimmedQuery)) {
          items.push({
            id: "refresh-extensions",
            label: "Refresh Extensions",
            description: "Reload extension list",
            icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "rotate", style: props.style }),
            data: { type: "refresh" as const },
          });
        }
      }

      // If no extensions at all
      if (extensions.length === 0 && !trimmedQuery) {
        items.unshift({
          id: "no-extensions",
          label: "No extensions installed",
          description: "Install extensions from the marketplace",
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "box", style: props.style }),
          data: { type: "install" as const },
        });
      }

      return items;
    },

    onSelect(item: QuickAccessItem<ExtensionItemData>): void {
      if (!item.data) return;
      
      hide();

      switch (item.data.type) {
        case "show":
          if (item.data.extensionId) {
            openExtensionDetails(item.data.extensionId);
          }
          break;
        case "enable":
          if (item.data.extensionName) {
            enableExtension(item.data.extensionName);
          }
          break;
        case "disable":
          if (item.data.extensionName) {
            disableExtension(item.data.extensionName);
          }
          break;
        case "uninstall":
          if (item.data.extensionName) {
            uninstallExtension(item.data.extensionName);
          }
          break;
        case "install":
          openExtensionMarketplace();
          break;
        case "list":
          // Open extensions view
          window.dispatchEvent(new CustomEvent("view:focus", { 
            detail: { view: "extensions", type: "sidebar" } 
          }));
          break;
        case "refresh":
          refreshExtensions();
          break;
      }
    },

    onButtonClick(_item: QuickAccessItem<ExtensionItemData>, button: QuickAccessItemButton): void {
      button.onClick();
    },
  };
}

export default createExtensionProvider;

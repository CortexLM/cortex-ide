/**
 * =============================================================================
 * HELP PROVIDER - ? prefix
 * =============================================================================
 * 
 * Shows all available quick access prefixes when user types '?'.
 * Selecting an item switches to that provider.
 */

import type { QuickAccessProvider, QuickAccessItem } from "./types";
import { Icon } from "../../components/ui/Icon";

/**
 * Help item data contains the prefix to switch to
 */
interface HelpItemData {
  /** Prefix to switch to when selected */
  targetPrefix: string;
}

/**
 * Create icon component helper
 */
const createIcon = (name: string) => {
  return (props: { style?: import("solid-js").JSX.CSSProperties }) => Icon({ name, style: props.style });
};

/**
 * All available quick access prefixes and their descriptions
 */
const HELP_ITEMS: QuickAccessItem<HelpItemData>[] = [
  {
    id: "help-commands",
    label: ">",
    description: "Show and Run Commands",
    detail: "Type > followed by command name",
    icon: createIcon("chevron-right"),
    data: { targetPrefix: ">" },
  },
  {
    id: "help-symbol-editor",
    label: "@",
    description: "Go to Symbol in Editor",
    detail: "Type @ followed by symbol name",
    icon: createIcon("function"),
    data: { targetPrefix: "@" },
  },
  {
    id: "help-symbol-workspace",
    label: "#",
    description: "Go to Symbol in Workspace",
    detail: "Type # followed by symbol name",
    icon: createIcon("cube"),
    data: { targetPrefix: "#" },
  },
  {
    id: "help-goto-line",
    label: ":",
    description: "Go to Line",
    detail: "Type : followed by line number",
    icon: createIcon("hashtag"),
    data: { targetPrefix: ":" },
  },
  {
    id: "help-text-search",
    label: "%",
    description: "Search in Files",
    detail: "Type % followed by text to search in all files",
    icon: createIcon("magnifying-glass"),
    data: { targetPrefix: "%" },
  },
  {
    id: "help-view",
    label: "view ",
    description: "Open View",
    detail: "Type view followed by view name",
    icon: createIcon("table-columns"),
    data: { targetPrefix: "view " },
  },
  {
    id: "help-terminal",
    label: "term ",
    description: "Open Terminal",
    detail: "Type term followed by terminal name or create new",
    icon: createIcon("terminal"),
    data: { targetPrefix: "term " },
  },
  {
    id: "help-task",
    label: "task ",
    description: "Run Task",
    detail: "Type task followed by task name",
    icon: createIcon("play"),
    data: { targetPrefix: "task " },
  },
  {
    id: "help-debug",
    label: "debug ",
    description: "Start Debugging",
    detail: "Type debug followed by configuration name",
    icon: createIcon("bug"),
    data: { targetPrefix: "debug " },
  },
  {
    id: "help-extension",
    label: "ext ",
    description: "Manage Extensions",
    detail: "Type ext followed by extension name",
    icon: createIcon("box"),
    data: { targetPrefix: "ext " },
  },
  {
    id: "help-issue",
    label: "issue ",
    description: "Report Issue",
    detail: "Type issue to report bugs, request features, or report performance issues",
    icon: createIcon("bug"),
    data: { targetPrefix: "issue " },
  },
];

/**
 * Create the Help Provider
 */
export function createHelpProvider(
  onPrefixChange: (prefix: string) => void
): QuickAccessProvider<HelpItemData> {
  return {
    id: "quickaccess.help",
    prefix: "?",
    name: "Help",
    description: "Show all quick access commands",
    placeholder: "Type ? to see available commands",

    async provideItems(query: string): Promise<QuickAccessItem<HelpItemData>[]> {
      const trimmedQuery = query.trim().toLowerCase();
      
      if (!trimmedQuery) {
        return HELP_ITEMS;
      }

      // Filter items by label or description
      return HELP_ITEMS.filter(item => {
        const labelMatch = item.label.toLowerCase().includes(trimmedQuery);
        const descMatch = item.description?.toLowerCase().includes(trimmedQuery);
        const detailMatch = item.detail?.toLowerCase().includes(trimmedQuery);
        return labelMatch || descMatch || detailMatch;
      });
    },

    onSelect(item: QuickAccessItem<HelpItemData>): void {
      if (item.data?.targetPrefix) {
        // Switch to the selected provider
        onPrefixChange(item.data.targetPrefix);
      }
    },
  };
}

export default createHelpProvider;

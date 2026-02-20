/**
 * Hook for feature modules to register commands with the command palette.
 *
 * Automatically registers commands on mount and unregisters on cleanup.
 * Uses the existing CommandContext for integration with the palette.
 *
 * @example
 * ```tsx
 * function MyFeature() {
 *   useCommandRegistry([
 *     { id: "my.command", label: "Do Thing", category: "Editor", handler: () => doThing() },
 *   ]);
 *   return <div>...</div>;
 * }
 * ```
 */

import { onMount, onCleanup } from "solid-js";
import { useCommands, type Command } from "@/context/CommandContext";

export interface CommandRegistration {
  id: string;
  label: string;
  category: string;
  icon?: string;
  keybinding?: string;
  whenClause?: string;
  handler: () => void;
}

export function useCommandRegistry(commands: CommandRegistration[]): void {
  const { registerCommand, unregisterCommand } = useCommands();

  onMount(() => {
    for (const cmd of commands) {
      const command: Command = {
        id: cmd.id,
        label: cmd.label,
        category: cmd.category,
        shortcut: cmd.keybinding,
        action: cmd.handler,
      };
      registerCommand(command);
    }
  });

  onCleanup(() => {
    for (const cmd of commands) {
      unregisterCommand(cmd.id);
    }
  });
}

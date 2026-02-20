import type { KeybindingSource } from "../../../types/keybindings";
import type { CommandBinding } from "../../../context/KeymapContext";

export interface KeybindingTableItem {
  id: string;
  command: string;
  commandTitle: string;
  category: string;
  keybinding: string;
  when: string;
  source: KeybindingSource;
  isDefault: boolean;
  isUserDefined: boolean;
  hasConflict: boolean;
  conflictsWith: string[];
  binding: CommandBinding;
}

export type FilterSource = "all" | "user" | "default" | "extension";

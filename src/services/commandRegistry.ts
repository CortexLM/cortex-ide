/**
 * Central command registry where all features register their commands.
 *
 * Each command has an id, label, category, optional icon/keybinding/when-clause,
 * and a handler function. The registry supports change listeners so UI components
 * can react to registration/unregistration.
 */

export type CommandCategory =
  | "General"
  | "Editor"
  | "Edit"
  | "Terminal"
  | "Git"
  | "Debug"
  | "AI"
  | "Extensions"
  | "Settings"
  | "Preferences"
  | "Navigation"
  | "Search"
  | "View"
  | "Selection"
  | "Multi-Cursor"
  | "Editor Layout"
  | "Transform"
  | "Sort"
  | "Emmet"
  | "Folding"
  | "Bookmarks"
  | "Tasks"
  | "Testing"
  | "Source"
  | "Refactor"
  | "File"
  | "Developer"
  | "Help";

export interface CommandRegistryEntry {
  id: string;
  label: string;
  category: CommandCategory | string;
  icon?: string;
  keybinding?: string;
  whenClause?: string;
  handler: () => void;
}

export type ChangeListener = () => void;

export interface CommandRegistry {
  register: (entry: CommandRegistryEntry) => void;
  registerMany: (entries: CommandRegistryEntry[]) => void;
  unregister: (id: string) => void;
  getAll: () => CommandRegistryEntry[];
  getById: (id: string) => CommandRegistryEntry | undefined;
  getByCategory: (category: string) => CommandRegistryEntry[];
  getCategories: () => string[];
  execute: (id: string) => boolean;
  onChanged: (listener: ChangeListener) => () => void;
}

export function createCommandRegistry(): CommandRegistry {
  const entries = new Map<string, CommandRegistryEntry>();
  const listeners = new Set<ChangeListener>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const register = (entry: CommandRegistryEntry) => {
    entries.set(entry.id, entry);
    notify();
  };

  const registerMany = (newEntries: CommandRegistryEntry[]) => {
    for (const entry of newEntries) {
      entries.set(entry.id, entry);
    }
    notify();
  };

  const unregister = (id: string) => {
    if (entries.delete(id)) {
      notify();
    }
  };

  const getAll = (): CommandRegistryEntry[] => {
    return Array.from(entries.values());
  };

  const getById = (id: string): CommandRegistryEntry | undefined => {
    return entries.get(id);
  };

  const getByCategory = (category: string): CommandRegistryEntry[] => {
    return Array.from(entries.values()).filter(e => e.category === category);
  };

  const getCategories = (): string[] => {
    const cats = new Set<string>();
    for (const entry of entries.values()) {
      cats.add(entry.category);
    }
    return Array.from(cats).sort();
  };

  const execute = (id: string): boolean => {
    const entry = entries.get(id);
    if (entry) {
      entry.handler();
      return true;
    }
    return false;
  };

  const onChanged = (listener: ChangeListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    register,
    registerMany,
    unregister,
    getAll,
    getById,
    getByCategory,
    getCategories,
    execute,
    onChanged,
  };
}

import type { RecordedKey } from "../../../types/keybindings";
import type { CommandBinding, Keybinding } from "../../../context/KeymapContext";
import { detectConflicts } from "../../../utils/keybindingResolver";
import type { KeybindingTableItem } from "./keybindingsTypes";

export function formatRecordedKey(key: RecordedKey): string {
  const parts: string[] = [];
  if (key.ctrlKey) parts.push("Ctrl");
  if (key.altKey) parts.push("Alt");
  if (key.shiftKey) parts.push("Shift");
  if (key.metaKey) parts.push("Meta");

  let keyDisplay = key.key;
  const keyMap: Record<string, string> = {
    ArrowUp: "\u2191",
    ArrowDown: "\u2193",
    ArrowLeft: "\u2190",
    ArrowRight: "\u2192",
    Escape: "Esc",
    Backspace: "\u232B",
    Delete: "Del",
    Enter: "\u21B5",
    Tab: "\u21E5",
    " ": "Space",
    Control: "Ctrl",
    Alt: "Alt",
    Shift: "Shift",
    Meta: "Meta",
  };

  if (keyMap[key.key]) {
    keyDisplay = keyMap[key.key];
  } else if (key.key.length === 1) {
    keyDisplay = key.key.toUpperCase();
  }

  parts.push(keyDisplay);
  return parts.join("+");
}

export function buildConflictsMap(
  bindings: CommandBinding[],
  formatKeybinding: (kb: Keybinding) => string
): Map<string, string[]> {
  const conflictData: Array<{
    key: string;
    command: string;
    when?: string;
    source: "default" | "user" | "extension";
  }> = [];

  for (const binding of bindings) {
    const eff = binding.customKeybinding ?? binding.defaultKeybinding;
    if (eff) {
      conflictData.push({
        key: formatKeybinding(eff),
        command: binding.commandId,
        when: binding.customWhen ?? binding.when,
        source: binding.customKeybinding ? "user" : "default",
      });
    }
  }

  const detected = detectConflicts(conflictData);
  const map = new Map<string, string[]>();

  for (const conflict of detected) {
    for (const cmd of conflict.conflictingCommands) {
      const existing = map.get(cmd.command) || [];
      const others = conflict.conflictingCommands
        .filter((c) => c.command !== cmd.command)
        .map((c) => c.command);
      map.set(cmd.command, [...new Set([...existing, ...others])]);
    }
  }

  return map;
}

export function buildTableItems(
  bindings: CommandBinding[],
  conflicts: Map<string, string[]>,
  formatKeybinding: (kb: Keybinding) => string
): KeybindingTableItem[] {
  return bindings.map((binding) => {
    const eff = binding.customKeybinding ?? binding.defaultKeybinding;
    const when = binding.customWhen ?? binding.when;
    const cw = conflicts.get(binding.commandId) || [];
    return {
      id: binding.commandId,
      command: binding.commandId,
      commandTitle: binding.label,
      category: binding.category,
      keybinding: eff ? formatKeybinding(eff) : "",
      when: when || "",
      source: binding.customKeybinding ? "user" : "default",
      isDefault: !binding.customKeybinding,
      isUserDefined: !!binding.customKeybinding,
      hasConflict: cw.length > 0,
      conflictsWith: cw,
      binding,
    };
  });
}

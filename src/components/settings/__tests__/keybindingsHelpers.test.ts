import { describe, it, expect, vi } from "vitest";

vi.mock("@/utils/keybindingResolver", () => ({
  detectConflicts: vi.fn().mockReturnValue([]),
}));

import { formatRecordedKey, buildConflictsMap, buildTableItems } from "../keybindings/keybindingsHelpers";
import type { CommandBinding, Keybinding } from "@/context/KeymapContext";
import { detectConflicts } from "@/utils/keybindingResolver";

function makeKeybinding(key: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}): Keybinding {
  return {
    keystrokes: [{
      key,
      modifiers: {
        ctrl: mods.ctrl ?? false,
        alt: mods.alt ?? false,
        shift: mods.shift ?? false,
        meta: mods.meta ?? false,
      },
    }],
  };
}

function makeBinding(opts: {
  commandId: string;
  label: string;
  category?: string;
  defaultKeybinding?: Keybinding | null;
  customKeybinding?: Keybinding | null;
  when?: string;
  customWhen?: string;
}): CommandBinding {
  return {
    commandId: opts.commandId,
    label: opts.label,
    category: opts.category ?? "General",
    defaultKeybinding: opts.defaultKeybinding ?? null,
    customKeybinding: opts.customKeybinding ?? null,
    when: opts.when,
    customWhen: opts.customWhen,
  };
}

describe("formatRecordedKey", () => {
  it("formats a simple letter key", () => {
    const result = formatRecordedKey({
      key: "s",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("S");
  });

  it("formats Ctrl modifier", () => {
    const result = formatRecordedKey({
      key: "s",
      code: "",
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("Ctrl+S");
  });

  it("formats multiple modifiers", () => {
    const result = formatRecordedKey({
      key: "s",
      code: "",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("Ctrl+Shift+S");
  });

  it("formats all four modifiers", () => {
    const result = formatRecordedKey({
      key: "a",
      code: "",
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
      metaKey: true,
      timestamp: 0,
    });
    expect(result).toBe("Ctrl+Alt+Shift+Meta+A");
  });

  it("maps ArrowUp to ↑", () => {
    const result = formatRecordedKey({
      key: "ArrowUp",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("↑");
  });

  it("maps ArrowDown to ↓", () => {
    const result = formatRecordedKey({
      key: "ArrowDown",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("↓");
  });

  it("maps ArrowLeft to ←", () => {
    const result = formatRecordedKey({
      key: "ArrowLeft",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("←");
  });

  it("maps ArrowRight to →", () => {
    const result = formatRecordedKey({
      key: "ArrowRight",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("→");
  });

  it("maps Escape to Esc", () => {
    const result = formatRecordedKey({
      key: "Escape",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("Esc");
  });

  it("maps Backspace to ⌫", () => {
    const result = formatRecordedKey({
      key: "Backspace",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("⌫");
  });

  it("maps Delete to Del", () => {
    const result = formatRecordedKey({
      key: "Delete",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("Del");
  });

  it("maps Enter to ↵", () => {
    const result = formatRecordedKey({
      key: "Enter",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("↵");
  });

  it("maps Tab to ⇥", () => {
    const result = formatRecordedKey({
      key: "Tab",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("⇥");
  });

  it("maps space to Space", () => {
    const result = formatRecordedKey({
      key: " ",
      code: "",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("Space");
  });

  it("combines modifier with special key", () => {
    const result = formatRecordedKey({
      key: "Enter",
      code: "",
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      timestamp: 0,
    });
    expect(result).toBe("Ctrl+↵");
  });
});

describe("buildConflictsMap", () => {
  const formatKeybinding = (kb: Keybinding): string => {
    const ks = kb.keystrokes[0];
    const parts: string[] = [];
    if (ks.modifiers.ctrl) parts.push("Ctrl");
    if (ks.modifiers.alt) parts.push("Alt");
    if (ks.modifiers.shift) parts.push("Shift");
    parts.push(ks.key);
    return parts.join("+");
  };

  it("returns empty map when no conflicts", () => {
    vi.mocked(detectConflicts).mockReturnValue([]);
    const bindings = [
      makeBinding({ commandId: "cmd1", label: "Command 1", defaultKeybinding: makeKeybinding("s", { ctrl: true }) }),
    ];
    const result = buildConflictsMap(bindings, formatKeybinding);
    expect(result.size).toBe(0);
  });

  it("maps conflicting commands to each other", () => {
    vi.mocked(detectConflicts).mockReturnValue([
      {
        keybinding: "Ctrl+s",
        conflictingCommands: [
          { command: "cmd1", when: undefined, source: "default" },
          { command: "cmd2", when: undefined, source: "user" },
        ],
        conflictType: "exact",
      },
    ]);
    const bindings = [
      makeBinding({ commandId: "cmd1", label: "Cmd 1", defaultKeybinding: makeKeybinding("s", { ctrl: true }) }),
      makeBinding({ commandId: "cmd2", label: "Cmd 2", customKeybinding: makeKeybinding("s", { ctrl: true }) }),
    ];
    const result = buildConflictsMap(bindings, formatKeybinding);
    expect(result.get("cmd1")).toContain("cmd2");
    expect(result.get("cmd2")).toContain("cmd1");
  });

  it("skips bindings without keybindings", () => {
    vi.mocked(detectConflicts).mockReturnValue([]);
    const bindings = [
      makeBinding({ commandId: "cmd1", label: "No Key" }),
    ];
    const result = buildConflictsMap(bindings, formatKeybinding);
    expect(result.size).toBe(0);
  });
});

describe("buildTableItems", () => {
  const formatKeybinding = (kb: Keybinding): string => {
    const ks = kb.keystrokes[0];
    const parts: string[] = [];
    if (ks.modifiers.ctrl) parts.push("Ctrl");
    parts.push(ks.key);
    return parts.join("+");
  };

  it("creates table items from bindings", () => {
    const bindings = [
      makeBinding({ commandId: "editor.save", label: "Save File", category: "File", defaultKeybinding: makeKeybinding("s", { ctrl: true }) }),
    ];
    const conflicts = new Map<string, string[]>();
    const items = buildTableItems(bindings, conflicts, formatKeybinding);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("editor.save");
    expect(items[0].command).toBe("editor.save");
    expect(items[0].commandTitle).toBe("Save File");
    expect(items[0].category).toBe("File");
    expect(items[0].keybinding).toBe("Ctrl+s");
    expect(items[0].source).toBe("default");
    expect(items[0].isDefault).toBe(true);
    expect(items[0].isUserDefined).toBe(false);
    expect(items[0].hasConflict).toBe(false);
  });

  it("uses custom keybinding over default", () => {
    const bindings = [
      makeBinding({
        commandId: "cmd1",
        label: "Cmd",
        defaultKeybinding: makeKeybinding("s", { ctrl: true }),
        customKeybinding: makeKeybinding("d", { ctrl: true }),
      }),
    ];
    const items = buildTableItems(bindings, new Map(), formatKeybinding);
    expect(items[0].keybinding).toBe("Ctrl+d");
    expect(items[0].isUserDefined).toBe(true);
    expect(items[0].isDefault).toBe(false);
    expect(items[0].source).toBe("user");
  });

  it("handles binding with no keybinding", () => {
    const bindings = [
      makeBinding({ commandId: "cmd1", label: "No Key" }),
    ];
    const items = buildTableItems(bindings, new Map(), formatKeybinding);
    expect(items[0].keybinding).toBe("");
  });

  it("includes when clause from custom or default", () => {
    const bindings = [
      makeBinding({ commandId: "cmd1", label: "Cmd", when: "editorFocus", defaultKeybinding: makeKeybinding("a") }),
    ];
    const items = buildTableItems(bindings, new Map(), formatKeybinding);
    expect(items[0].when).toBe("editorFocus");
  });

  it("prefers customWhen over when", () => {
    const bindings = [
      makeBinding({ commandId: "cmd1", label: "Cmd", when: "editorFocus", customWhen: "terminalFocus", defaultKeybinding: makeKeybinding("a") }),
    ];
    const items = buildTableItems(bindings, new Map(), formatKeybinding);
    expect(items[0].when).toBe("terminalFocus");
  });

  it("marks items with conflicts", () => {
    const bindings = [
      makeBinding({ commandId: "cmd1", label: "Cmd 1", defaultKeybinding: makeKeybinding("s", { ctrl: true }) }),
    ];
    const conflicts = new Map([["cmd1", ["cmd2"]]]);
    const items = buildTableItems(bindings, conflicts, formatKeybinding);
    expect(items[0].hasConflict).toBe(true);
    expect(items[0].conflictsWith).toEqual(["cmd2"]);
  });

  it("includes binding reference", () => {
    const binding = makeBinding({ commandId: "cmd1", label: "Cmd", defaultKeybinding: makeKeybinding("a") });
    const items = buildTableItems([binding], new Map(), formatKeybinding);
    expect(items[0].binding).toBe(binding);
  });
});

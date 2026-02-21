import { describe, it, expect } from "vitest";
import {
  parseWhenClause,
  evaluateWhen,
  serializeWhen,
  parseKeybinding,
  normalizeKeybinding,
  keybindingToString,
  matchKeyboardEvent,
  resolveKeybinding,
  sortBySpecificity,
  detectConflicts,
  findKeybindingsForCommand,
  mergeKeybindings,
  createChordTracker,
  type WhenContext,
} from "../keybindingResolver";

describe("keybindingResolver", () => {
  describe("parseWhenClause", () => {
    it("parses empty string as true", () => {
      expect(parseWhenClause("")).toEqual({ type: "true" });
      expect(parseWhenClause("  ")).toEqual({ type: "true" });
    });
    it("parses boolean literals", () => {
      expect(parseWhenClause("true")).toEqual({ type: "true" });
      expect(parseWhenClause("false")).toEqual({ type: "false" });
    });
    it("parses has expression", () => {
      expect(parseWhenClause("editorFocus")).toEqual({ type: "has", key: "editorFocus" });
    });
    it("parses equals expression", () => {
      const r = parseWhenClause("resourceScheme == 'file'");
      expect(r.type).toBe("equals");
      if (r.type === "equals") {
        expect(r.key).toBe("resourceScheme");
        expect(r.value).toBe("file");
      }
    });
    it("parses notEquals expression", () => {
      const r = parseWhenClause("viewType != 'markdown'");
      expect(r.type).toBe("notEquals");
    });
    it("parses regex expression", () => {
      const r = parseWhenClause("resourceFilename =~ /\\.tsx?$/");
      expect(r.type).toBe("regex");
    });
    it("parses negated regex", () => {
      const r = parseWhenClause("resourceFilename !~ /\\.md$/");
      expect(r.type).toBe("not");
    });
    it("parses in expression", () => {
      const r = parseWhenClause("key in list");
      expect(r.type).toBe("in");
    });
    it("parses not in expression", () => {
      const r = parseWhenClause("key not in list");
      expect(r.type).toBe("not");
    });
    it("parses and expression", () => {
      const r = parseWhenClause("editorFocus && textInputFocus");
      expect(r.type).toBe("and");
    });
    it("parses or expression", () => {
      const r = parseWhenClause("editorFocus || terminalFocus");
      expect(r.type).toBe("or");
    });
    it("parses not expression with !", () => {
      const r = parseWhenClause("!editorFocus");
      expect(r.type).toBe("not");
    });
    it("parses not expression with keyword", () => {
      const r = parseWhenClause("not editorFocus");
      expect(r.type).toBe("not");
    });
    it("parses parenthesized expression", () => {
      const r = parseWhenClause("(editorFocus || terminalFocus) && !isReadonly");
      expect(r.type).toBe("and");
    });
    it("parses complex nested expression", () => {
      const r = parseWhenClause("editorFocus && resourceScheme == 'file' && !isReadonly");
      expect(r.type).toBe("and");
    });
    it("handles string with escape characters", () => {
      const r = parseWhenClause("key == 'hello\\nworld'");
      expect(r.type).toBe("equals");
    });
    it("handles double-quoted strings", () => {
      const r = parseWhenClause('key == "value"');
      expect(r.type).toBe("equals");
    });
  });

  describe("evaluateWhen", () => {
    it("evaluates true", () => {
      expect(evaluateWhen({ type: "true" }, {})).toBe(true);
    });
    it("evaluates false", () => {
      expect(evaluateWhen({ type: "false" }, {})).toBe(false);
    });
    it("evaluates has - truthy", () => {
      expect(evaluateWhen({ type: "has", key: "editorFocus" }, { editorFocus: true })).toBe(true);
    });
    it("evaluates has - falsy", () => {
      expect(evaluateWhen({ type: "has", key: "editorFocus" }, { editorFocus: false })).toBe(false);
      expect(evaluateWhen({ type: "has", key: "editorFocus" }, {})).toBe(false);
      expect(evaluateWhen({ type: "has", key: "editorFocus" }, { editorFocus: null })).toBe(false);
      expect(evaluateWhen({ type: "has", key: "editorFocus" }, { editorFocus: "" })).toBe(false);
    });
    it("evaluates equals", () => {
      expect(evaluateWhen({ type: "equals", key: "lang", value: "ts" }, { lang: "ts" })).toBe(true);
      expect(evaluateWhen({ type: "equals", key: "lang", value: "ts" }, { lang: "js" })).toBe(false);
    });
    it("evaluates notEquals", () => {
      expect(evaluateWhen({ type: "notEquals", key: "lang", value: "ts" }, { lang: "js" })).toBe(true);
    });
    it("evaluates regex", () => {
      expect(evaluateWhen({ type: "regex", key: "file", pattern: /\.tsx?$/ }, { file: "app.tsx" })).toBe(true);
      expect(evaluateWhen({ type: "regex", key: "file", pattern: /\.tsx?$/ }, { file: "app.py" })).toBe(false);
      expect(evaluateWhen({ type: "regex", key: "file", pattern: /\.tsx?$/ }, {})).toBe(false);
    });
    it("evaluates in - array", () => {
      expect(evaluateWhen({ type: "in", key: "item", value: "list" }, { item: "a", list: ["a", "b"] })).toBe(true);
      expect(evaluateWhen({ type: "in", key: "item", value: "list" }, { item: "c", list: ["a", "b"] })).toBe(false);
    });
    it("evaluates in - object", () => {
      expect(evaluateWhen({ type: "in", key: "item", value: "obj" }, { item: "a", obj: { a: 1 } })).toBe(true);
    });
    it("evaluates in - string", () => {
      expect(evaluateWhen({ type: "in", key: "item", value: "str" }, { item: "bc", str: "abcd" })).toBe(true);
    });
    it("evaluates in - non-container", () => {
      expect(evaluateWhen({ type: "in", key: "item", value: "num" }, { item: "a", num: 42 })).toBe(false);
    });
    it("evaluates not", () => {
      expect(evaluateWhen({ type: "not", expr: { type: "false" } }, {})).toBe(true);
    });
    it("evaluates and", () => {
      expect(evaluateWhen({ type: "and", exprs: [{ type: "true" }, { type: "true" }] }, {})).toBe(true);
      expect(evaluateWhen({ type: "and", exprs: [{ type: "true" }, { type: "false" }] }, {})).toBe(false);
    });
    it("evaluates or", () => {
      expect(evaluateWhen({ type: "or", exprs: [{ type: "false" }, { type: "true" }] }, {})).toBe(true);
      expect(evaluateWhen({ type: "or", exprs: [{ type: "false" }, { type: "false" }] }, {})).toBe(false);
    });
    it("supports dot notation for nested context", () => {
      const ctx: WhenContext = { editor: { mode: "normal" } };
      expect(evaluateWhen({ type: "equals", key: "editor.mode", value: "normal" }, ctx)).toBe(true);
    });
  });

  describe("serializeWhen", () => {
    it("serializes true", () => expect(serializeWhen({ type: "true" })).toBe("true"));
    it("serializes false", () => expect(serializeWhen({ type: "false" })).toBe("false"));
    it("serializes has", () => expect(serializeWhen({ type: "has", key: "editorFocus" })).toBe("editorFocus"));
    it("serializes equals", () => expect(serializeWhen({ type: "equals", key: "k", value: "v" })).toBe("k == 'v'"));
    it("serializes notEquals", () => expect(serializeWhen({ type: "notEquals", key: "k", value: "v" })).toBe("k != 'v'"));
    it("serializes regex", () => {
      const r = serializeWhen({ type: "regex", key: "k", pattern: /test/i });
      expect(r).toContain("=~");
    });
    it("serializes in", () => expect(serializeWhen({ type: "in", key: "k", value: "list" })).toBe("k in list"));
    it("serializes not of simple expr", () => {
      expect(serializeWhen({ type: "not", expr: { type: "has", key: "k" } })).toBe("!k");
    });
    it("serializes not of complex expr", () => {
      const r = serializeWhen({ type: "not", expr: { type: "and", exprs: [{ type: "true" }, { type: "false" }] } });
      expect(r).toContain("!(");
    });
    it("serializes not of regex as !~", () => {
      const r = serializeWhen({ type: "not", expr: { type: "regex", key: "k", pattern: /test/ } });
      expect(r).toContain("!~");
    });
    it("serializes not of in as 'not in'", () => {
      const r = serializeWhen({ type: "not", expr: { type: "in", key: "k", value: "list" } });
      expect(r).toBe("k not in list");
    });
    it("serializes and", () => {
      const r = serializeWhen({ type: "and", exprs: [{ type: "has", key: "a" }, { type: "has", key: "b" }] });
      expect(r).toBe("a && b");
    });
    it("serializes or", () => {
      const r = serializeWhen({ type: "or", exprs: [{ type: "has", key: "a" }, { type: "has", key: "b" }] });
      expect(r).toBe("a || b");
    });
    it("wraps or inside and with parens", () => {
      const r = serializeWhen({
        type: "and",
        exprs: [{ type: "or", exprs: [{ type: "has", key: "a" }, { type: "has", key: "b" }] }, { type: "has", key: "c" }],
      });
      expect(r).toBe("(a || b) && c");
    });
  });

  describe("parseKeybinding", () => {
    it("parses simple key", () => {
      const r = parseKeybinding("a");
      expect(r.parts).toHaveLength(1);
      expect(r.parts[0].keyCode).toBe("KeyA");
      expect(r.isChord).toBe(false);
    });
    it("parses modifier+key", () => {
      const r = parseKeybinding("ctrl+s");
      expect(r.parts[0].ctrlKey).toBe(true);
      expect(r.parts[0].keyCode).toBe("KeyS");
    });
    it("parses multiple modifiers", () => {
      const r = parseKeybinding("ctrl+shift+p");
      expect(r.parts[0].ctrlKey).toBe(true);
      expect(r.parts[0].shiftKey).toBe(true);
    });
    it("parses chord keybinding", () => {
      const r = parseKeybinding("ctrl+k ctrl+s");
      expect(r.parts).toHaveLength(2);
      expect(r.isChord).toBe(true);
    });
    it("parses function keys", () => {
      const r = parseKeybinding("f5");
      expect(r.parts[0].keyCode).toBe("F5");
    });
    it("parses special keys", () => {
      expect(parseKeybinding("escape").parts[0].keyCode).toBe("Escape");
      expect(parseKeybinding("enter").parts[0].keyCode).toBe("Enter");
      expect(parseKeybinding("tab").parts[0].keyCode).toBe("Tab");
      expect(parseKeybinding("backspace").parts[0].keyCode).toBe("Backspace");
      expect(parseKeybinding("delete").parts[0].keyCode).toBe("Delete");
      expect(parseKeybinding("space").parts[0].keyCode).toBe("Space");
    });
    it("parses modifier aliases", () => {
      expect(parseKeybinding("cmd+s").parts[0].metaKey).toBe(true);
      expect(parseKeybinding("option+s").parts[0].altKey).toBe(true);
      expect(parseKeybinding("win+s").parts[0].metaKey).toBe(true);
    });
    it("parses digit keys", () => {
      const r = parseKeybinding("ctrl+1");
      expect(r.parts[0].keyCode).toBe("Digit1");
    });
    it("parses punctuation keys", () => {
      expect(parseKeybinding("ctrl+;").parts[0].keyCode).toBe("Semicolon");
      expect(parseKeybinding("ctrl+[").parts[0].keyCode).toBe("BracketLeft");
    });
  });

  describe("normalizeKeybinding", () => {
    it("normalizes modifier order", () => {
      expect(normalizeKeybinding("shift+ctrl+p")).toBe("ctrl+shift+keya".replace("keya", "keyp"));
    });
    it("normalizes case", () => {
      expect(normalizeKeybinding("Ctrl+S")).toBe(normalizeKeybinding("ctrl+s"));
    });
  });

  describe("keybindingToString", () => {
    it("formats for windows", () => {
      const parsed = parseKeybinding("ctrl+shift+p");
      const r = keybindingToString(parsed, "windows");
      expect(r).toContain("Ctrl");
      expect(r).toContain("Shift");
    });
    it("formats for mac with symbols", () => {
      const parsed = parseKeybinding("ctrl+shift+p");
      const r = keybindingToString(parsed, "mac");
      expect(r).toContain("\u2303"); // Control symbol
      expect(r).toContain("\u21E7"); // Shift symbol
    });
    it("formats for linux", () => {
      const parsed = parseKeybinding("meta+s");
      const r = keybindingToString(parsed, "linux");
      expect(r).toContain("Super");
    });
    it("displays special keys", () => {
      const parsed = parseKeybinding("ctrl+enter");
      const r = keybindingToString(parsed, "windows");
      expect(r).toContain("Enter");
    });
    it("displays function keys", () => {
      const parsed = parseKeybinding("f5");
      expect(keybindingToString(parsed, "windows")).toBe("F5");
    });
    it("strips Key prefix for letter keys", () => {
      const parsed = parseKeybinding("a");
      expect(keybindingToString(parsed, "windows")).toBe("A");
    });
    it("strips Digit prefix for number keys", () => {
      const parsed = parseKeybinding("1");
      expect(keybindingToString(parsed, "windows")).toBe("1");
    });
  });

  describe("matchKeyboardEvent", () => {
    it("matches simple key", () => {
      const binding = parseKeybinding("ctrl+s");
      const event = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, code: "KeyS", key: "s" };
      expect(matchKeyboardEvent(event, binding)).toBe(true);
    });
    it("fails on modifier mismatch", () => {
      const binding = parseKeybinding("ctrl+s");
      const event = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, code: "KeyS", key: "s" };
      expect(matchKeyboardEvent(event, binding)).toBe(false);
    });
    it("returns false for out-of-range chord index", () => {
      const binding = parseKeybinding("ctrl+s");
      const event = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, code: "KeyS", key: "s" };
      expect(matchKeyboardEvent(event, binding, 5)).toBe(false);
    });
    it("matches via key value for special chars", () => {
      const binding = parseKeybinding("ctrl+;");
      const event = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, code: "Semicolon", key: ";" };
      expect(matchKeyboardEvent(event, binding)).toBe(true);
    });
  });

  describe("resolveKeybinding", () => {
    it("resolves simple binding", () => {
      const pressed = parseKeybinding("ctrl+s");
      const bindings = [{ key: "ctrl+s", command: "workbench.action.files.save" }];
      const result = resolveKeybinding(pressed, bindings, {});
      expect(result?.command).toBe("workbench.action.files.save");
    });
    it("returns undefined for no match", () => {
      const pressed = parseKeybinding("ctrl+s");
      const bindings = [{ key: "ctrl+p", command: "quickOpen" }];
      expect(resolveKeybinding(pressed, bindings, {})).toBeUndefined();
    });
    it("filters by when clause", () => {
      const pressed = parseKeybinding("ctrl+c");
      const bindings = [
        { key: "ctrl+c", command: "editor.copy", when: "editorFocus" },
        { key: "ctrl+c", command: "terminal.copy", when: "terminalFocus" },
      ];
      const ctx: WhenContext = { editorFocus: true, terminalFocus: false };
      const result = resolveKeybinding(pressed, bindings, ctx);
      expect(result?.command).toBe("editor.copy");
    });
    it("picks most specific when clause", () => {
      const pressed = parseKeybinding("ctrl+c");
      const bindings = [
        { key: "ctrl+c", command: "general.copy" },
        { key: "ctrl+c", command: "editor.copy", when: "editorFocus && textInputFocus" },
      ];
      const ctx: WhenContext = { editorFocus: true, textInputFocus: true };
      const result = resolveKeybinding(pressed, bindings, ctx);
      expect(result?.command).toBe("editor.copy");
    });
  });

  describe("sortBySpecificity", () => {
    it("sorts more specific first", () => {
      const items = [
        { when: undefined },
        { when: "editorFocus && textInputFocus" },
        { when: "editorFocus" },
      ];
      const sorted = sortBySpecificity(items);
      expect(sorted[0].when).toBe("editorFocus && textInputFocus");
      expect(sorted[sorted.length - 1].when).toBeUndefined();
    });
  });

  describe("detectConflicts", () => {
    it("detects exact conflicts", () => {
      const bindings = [
        { key: "ctrl+s", command: "save", source: "default" as const },
        { key: "ctrl+s", command: "saveAll", source: "user" as const },
      ];
      const conflicts = detectConflicts(bindings);
      expect(conflicts.length).toBeGreaterThan(0);
    });
    it("no conflicts for different keys", () => {
      const bindings = [
        { key: "ctrl+s", command: "save", source: "default" as const },
        { key: "ctrl+p", command: "quickOpen", source: "default" as const },
      ];
      expect(detectConflicts(bindings)).toHaveLength(0);
    });
    it("detects shadow conflicts", () => {
      const bindings = [
        { key: "ctrl+c", command: "general.copy", source: "default" as const },
        { key: "ctrl+c", command: "editor.copy", when: "editorFocus", source: "default" as const },
      ];
      const conflicts = detectConflicts(bindings);
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe("findKeybindingsForCommand", () => {
    it("finds bindings for command", () => {
      const bindings = [
        { key: "ctrl+s", command: "save" },
        { key: "ctrl+shift+s", command: "saveAll" },
        { key: "cmd+s", command: "save" },
      ];
      const result = findKeybindingsForCommand("save", bindings);
      expect(result).toHaveLength(2);
    });
    it("filters by context", () => {
      const bindings = [
        { key: "ctrl+c", command: "copy", when: "editorFocus" },
        { key: "ctrl+c", command: "copy", when: "terminalFocus" },
      ];
      const result = findKeybindingsForCommand("copy", bindings, { editorFocus: true });
      expect(result).toHaveLength(1);
    });
  });

  describe("mergeKeybindings", () => {
    it("adds user bindings after defaults", () => {
      const defaults = [{ key: "ctrl+s", command: "save" }];
      const user = [{ key: "ctrl+shift+s", command: "saveAll" }];
      const merged = mergeKeybindings(defaults, user);
      expect(merged).toHaveLength(2);
      expect(merged[0].source).toBe("default");
      expect(merged[1].source).toBe("user");
    });
    it("removes bindings with negated commands", () => {
      const defaults = [{ key: "ctrl+s", command: "save" }];
      const user = [{ key: "ctrl+s", command: "-save" }];
      const merged = mergeKeybindings(defaults, user);
      expect(merged).toHaveLength(0);
    });
    it("removes with when clause matching", () => {
      const defaults = [{ key: "ctrl+c", command: "copy", when: "editorFocus" }];
      const user = [{ key: "ctrl+c", command: "-copy", when: "editorFocus" }];
      const merged = mergeKeybindings(defaults, user);
      expect(merged).toHaveLength(0);
    });
  });

  describe("createChordTracker", () => {
    it("returns undefined for non-matching key", () => {
      const tracker = createChordTracker();
      const event = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, code: "KeyA", key: "a" };
      const result = tracker.handleKeyPress(event, [], {});
      expect(result).toBeUndefined();
    });
    it("returns pending for chord prefix", () => {
      const tracker = createChordTracker();
      const bindings = [{ key: "ctrl+k ctrl+s", command: "saveAll" }];
      const event = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, code: "KeyK", key: "k" };
      const result = tracker.handleKeyPress(event, bindings, {});
      expect(result).toBe("pending");
    });
    it("resolves chord on second key", () => {
      const tracker = createChordTracker();
      const bindings = [{ key: "ctrl+k ctrl+s", command: "saveAll" }];
      const event1 = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, code: "KeyK", key: "k" };
      tracker.handleKeyPress(event1, bindings, {});
      const event2 = { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, code: "KeyS", key: "s" };
      const result = tracker.handleKeyPress(event2, bindings, {});
      expect(result).toEqual({ command: "saveAll", args: undefined });
    });
    it("resets state", () => {
      const tracker = createChordTracker();
      tracker.state.active = true;
      tracker.reset();
      expect(tracker.state.active).toBe(false);
    });
  });
});

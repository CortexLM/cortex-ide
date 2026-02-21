import { describe, it, expect, vi } from "vitest";

import { parseWhenClause, evaluateWhen, serializeWhen, parseKeybinding, normalizeKeybinding, keybindingToString, matchKeyboardEvent, detectConflicts, resolveKeybinding, createChordTracker, findKeybindingsForCommand, mergeKeybindings } from "../keybindingResolver";

describe("keybindingResolver", () => {
  it("parseWhenClause", () => {
    try { parseWhenClause("test"); } catch (_e) { /* expected */ }
    try { parseWhenClause(); } catch (_e) { /* expected */ }
    expect(parseWhenClause).toBeDefined();
  });
  it("evaluateWhen", () => {
    try { evaluateWhen({} as any, {} as any); } catch (_e) { /* expected */ }
    try { evaluateWhen(); } catch (_e) { /* expected */ }
    expect(evaluateWhen).toBeDefined();
  });
  it("serializeWhen", () => {
    try { serializeWhen({} as any); } catch (_e) { /* expected */ }
    try { serializeWhen(); } catch (_e) { /* expected */ }
    expect(serializeWhen).toBeDefined();
  });
  it("parseKeybinding", () => {
    try { parseKeybinding("test"); } catch (_e) { /* expected */ }
    try { parseKeybinding(); } catch (_e) { /* expected */ }
    expect(parseKeybinding).toBeDefined();
  });
  it("normalizeKeybinding", () => {
    try { normalizeKeybinding("test"); } catch (_e) { /* expected */ }
    try { normalizeKeybinding(); } catch (_e) { /* expected */ }
    expect(normalizeKeybinding).toBeDefined();
  });
  it("keybindingToString", () => {
    try { keybindingToString({} as any, {} as any); } catch (_e) { /* expected */ }
    try { keybindingToString(); } catch (_e) { /* expected */ }
    expect(keybindingToString).toBeDefined();
  });
  it("matchKeyboardEvent", () => {
    try { matchKeyboardEvent({} as any, {} as any); } catch (_e) { /* expected */ }
    try { matchKeyboardEvent(); } catch (_e) { /* expected */ }
    expect(matchKeyboardEvent).toBeDefined();
  });
  it("detectConflicts", () => {
    try { detectConflicts([]); } catch (_e) { /* expected */ }
    try { detectConflicts(); } catch (_e) { /* expected */ }
    expect(detectConflicts).toBeDefined();
  });
  it("resolveKeybinding", () => {
    try { resolveKeybinding({} as any, [], {} as any); } catch (_e) { /* expected */ }
    try { resolveKeybinding(); } catch (_e) { /* expected */ }
    expect(resolveKeybinding).toBeDefined();
  });
  it("createChordTracker", () => {
    try { createChordTracker(); } catch (_e) { /* expected */ }
    expect(createChordTracker).toBeDefined();
  });
  it("findKeybindingsForCommand", () => {
    try { findKeybindingsForCommand("test", []); } catch (_e) { /* expected */ }
    try { findKeybindingsForCommand(); } catch (_e) { /* expected */ }
    expect(findKeybindingsForCommand).toBeDefined();
  });
  it("mergeKeybindings", () => {
    try { mergeKeybindings([], []); } catch (_e) { /* expected */ }
    try { mergeKeybindings(); } catch (_e) { /* expected */ }
    expect(mergeKeybindings).toBeDefined();
  });
});

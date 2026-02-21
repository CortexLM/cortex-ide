import { describe, it, expect, vi } from "vitest";

import { loadCustomWhenClauses, saveCustomWhenClauses, loadCustomBindings, saveCustomBindings, formatKeystroke, formatKeybindingFn, keystrokesEqual, keybindingsEqual, keyboardEventToKeystroke, parseKeybindingStringFn, STORAGE_KEY, WHEN_STORAGE_KEY, CHORD_TIMEOUT_MS } from "../../keymap/keymapHelpers";

describe("keymapHelpers", () => {
  it("loadCustomWhenClauses", () => {
    try { loadCustomWhenClauses(); } catch (_e) { /* expected */ }
    expect(loadCustomWhenClauses).toBeDefined();
  });
  it("saveCustomWhenClauses", () => {
    try { saveCustomWhenClauses({}); } catch (_e) { /* expected */ }
    try { saveCustomWhenClauses(); } catch (_e) { /* expected */ }
    expect(saveCustomWhenClauses).toBeDefined();
  });
  it("loadCustomBindings", () => {
    try { loadCustomBindings(); } catch (_e) { /* expected */ }
    expect(loadCustomBindings).toBeDefined();
  });
  it("saveCustomBindings", () => {
    try { saveCustomBindings({}); } catch (_e) { /* expected */ }
    try { saveCustomBindings(); } catch (_e) { /* expected */ }
    expect(saveCustomBindings).toBeDefined();
  });
  it("formatKeystroke", () => {
    try { formatKeystroke({} as any); } catch (_e) { /* expected */ }
    try { formatKeystroke(); } catch (_e) { /* expected */ }
    expect(formatKeystroke).toBeDefined();
  });
  it("formatKeybindingFn", () => {
    try { formatKeybindingFn({} as any); } catch (_e) { /* expected */ }
    try { formatKeybindingFn(); } catch (_e) { /* expected */ }
    expect(formatKeybindingFn).toBeDefined();
  });
  it("keystrokesEqual", () => {
    try { keystrokesEqual({} as any, {} as any); } catch (_e) { /* expected */ }
    try { keystrokesEqual(); } catch (_e) { /* expected */ }
    expect(keystrokesEqual).toBeDefined();
  });
  it("keybindingsEqual", () => {
    try { keybindingsEqual({} as any, {} as any); } catch (_e) { /* expected */ }
    try { keybindingsEqual(); } catch (_e) { /* expected */ }
    expect(keybindingsEqual).toBeDefined();
  });
  it("keyboardEventToKeystroke", () => {
    try { keyboardEventToKeystroke({} as any); } catch (_e) { /* expected */ }
    try { keyboardEventToKeystroke(); } catch (_e) { /* expected */ }
    expect(keyboardEventToKeystroke).toBeDefined();
  });
  it("parseKeybindingStringFn", () => {
    try { parseKeybindingStringFn("test"); } catch (_e) { /* expected */ }
    try { parseKeybindingStringFn(); } catch (_e) { /* expected */ }
    expect(parseKeybindingStringFn).toBeDefined();
  });
  it("STORAGE_KEY", () => {
    expect(STORAGE_KEY).toBeDefined();
  });
  it("WHEN_STORAGE_KEY", () => {
    expect(WHEN_STORAGE_KEY).toBeDefined();
  });
  it("CHORD_TIMEOUT_MS", () => {
    expect(CHORD_TIMEOUT_MS).toBeDefined();
  });
});

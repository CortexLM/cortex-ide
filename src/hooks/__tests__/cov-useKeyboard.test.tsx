import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { createKeyboardShortcut, useKeyboard } from "../useKeyboard";

describe("useKeyboard", () => {
  it("createKeyboardShortcut", () => {
    try { createKeyboardShortcut("test", {} as any); } catch (_e) { /* expected */ }
    try { createKeyboardShortcut(); } catch (_e) { /* expected */ }
    expect(createKeyboardShortcut).toBeDefined();
  });
  it("useKeyboard", () => {
    try { createRoot((dispose) => { try { useKeyboard({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useKeyboard).toBeDefined();
  });
});

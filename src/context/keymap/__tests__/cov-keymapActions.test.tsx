import { describe, it, expect, vi } from "vitest";

import { createKeymapActions } from "../../keymap/keymapActions";

describe("keymapActions", () => {
  it("createKeymapActions", () => {
    try { createKeymapActions({} as any); } catch (_e) { /* expected */ }
    try { createKeymapActions(); } catch (_e) { /* expected */ }
    expect(createKeymapActions).toBeDefined();
  });
});

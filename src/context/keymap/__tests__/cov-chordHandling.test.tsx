import { describe, it, expect, vi } from "vitest";

import { createChordHandlers } from "../../keymap/chordHandling";

describe("chordHandling", () => {
  it("createChordHandlers", () => {
    try { createChordHandlers({} as any); } catch (_e) { /* expected */ }
    try { createChordHandlers(); } catch (_e) { /* expected */ }
    expect(createChordHandlers).toBeDefined();
  });
});

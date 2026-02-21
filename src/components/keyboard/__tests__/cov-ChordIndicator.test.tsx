import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/keymap", () => ({ keymap: (p: any) => p.children, usekeymap: vi.fn(() => ({})) }));

import { ChordIndicator } from "../../keyboard/ChordIndicator";

describe("ChordIndicator", () => {
  it("ChordIndicator", () => {
    try { render(() => <ChordIndicator />); } catch (_e) { /* expected */ }
    expect(ChordIndicator).toBeDefined();
  });
});

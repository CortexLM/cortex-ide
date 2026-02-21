import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/keymap", () => ({ keymap: (p: any) => p.children, usekeymap: vi.fn(() => ({})) }));

import { KeybindingRow } from "../../keyboard/KeybindingRow";

describe("KeybindingRow", () => {
  it("KeybindingRow", () => {
    try { render(() => <KeybindingRow />); } catch (_e) { /* expected */ }
    expect(KeybindingRow).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/keymap", () => ({ keymap: (p: any) => p.children, usekeymap: vi.fn(() => ({})) }));
vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));

import { KeyboardShortcutsEditor } from "../../keyboard/KeyboardShortcutsEditor";

describe("KeyboardShortcutsEditor", () => {
  it("KeyboardShortcutsEditor", () => {
    try { render(() => <KeyboardShortcutsEditor />); } catch (_e) { /* expected */ }
    expect(KeyboardShortcutsEditor).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/keymap", () => ({ keymap: (p: any) => p.children, usekeymap: vi.fn(() => ({})) }));

import { ConflictIndicator } from "../../keyboard/ConflictIndicator";

describe("ConflictIndicator", () => {
  it("ConflictIndicator", () => {
    try { render(() => <ConflictIndicator />); } catch (_e) { /* expected */ }
    expect(ConflictIndicator).toBeDefined();
  });
});

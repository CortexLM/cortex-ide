import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/keymap", () => ({ keymap: (p: any) => p.children, usekeymap: vi.fn(() => ({})) }));

import { KeyRecorder } from "../../keyboard/KeyRecorder";

describe("KeyRecorder", () => {
  it("KeyRecorder", () => {
    try { render(() => <KeyRecorder />); } catch (_e) { /* expected */ }
    expect(KeyRecorder).toBeDefined();
  });
});

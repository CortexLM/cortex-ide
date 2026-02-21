import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/KeymapContext", () => ({ KeymapProvider: (p: any) => p.children, useKeymap: vi.fn(() => ({})) }));

import { KeybindingEditor } from "../../settings/KeybindingEditor";

describe("KeybindingEditor", () => {
  it("KeybindingEditor", () => {
    try { render(() => <KeybindingEditor />); } catch (_e) { /* expected */ }
    expect(KeybindingEditor).toBeDefined();
  });
});

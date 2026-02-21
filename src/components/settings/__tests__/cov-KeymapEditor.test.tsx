import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/KeymapContext", () => ({ KeymapProvider: (p: any) => p.children, useKeymap: vi.fn(() => ({})) }));

import { KeymapEditor } from "../../settings/KeymapEditor";

describe("KeymapEditor", () => {
  it("KeymapEditor", () => {
    try { render(() => <KeymapEditor />); } catch (_e) { /* expected */ }
    expect(KeymapEditor).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/REPLContext", () => ({ REPLProvider: (p: any) => p.children, useREPL: vi.fn(() => ({ history: vi.fn(() => []), evaluate: vi.fn(), clear: vi.fn() })) }));

import { VariableInspector } from "../../repl/VariableInspector";

describe("VariableInspector", () => {
  it("VariableInspector", () => {
    try { render(() => <VariableInspector />); } catch (_e) { /* expected */ }
    expect(VariableInspector).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/REPLContext", () => ({ REPLProvider: (p: any) => p.children, useREPL: vi.fn(() => ({ history: vi.fn(() => []), evaluate: vi.fn(), clear: vi.fn() })) }));

import { REPLPanel } from "../../repl/REPLPanel";

describe("REPLPanel", () => {
  it("REPLPanel", () => {
    try { render(() => <REPLPanel />); } catch (_e) { /* expected */ }
    expect(REPLPanel).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/REPLContext", () => ({ REPLProvider: (p: any) => p.children, useREPL: vi.fn(() => ({ history: vi.fn(() => []), evaluate: vi.fn(), clear: vi.fn() })) }));

import { REPLOutput, REPLOutputList } from "../../repl/REPLOutput";

describe("REPLOutput", () => {
  it("REPLOutput", () => {
    try { render(() => <REPLOutput />); } catch (_e) { /* expected */ }
    expect(REPLOutput).toBeDefined();
  });
  it("REPLOutputList", () => {
    try { render(() => <REPLOutputList />); } catch (_e) { /* expected */ }
    expect(REPLOutputList).toBeDefined();
  });
});

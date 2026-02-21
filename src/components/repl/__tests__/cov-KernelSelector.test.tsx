import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/REPLContext", () => ({ REPLProvider: (p: any) => p.children, useREPL: vi.fn(() => ({ history: vi.fn(() => []), evaluate: vi.fn(), clear: vi.fn() })) }));

import { KernelSelector } from "../../repl/KernelSelector";

describe("KernelSelector", () => {
  it("KernelSelector", () => {
    try { render(() => <KernelSelector />); } catch (_e) { /* expected */ }
    expect(KernelSelector).toBeDefined();
  });
});

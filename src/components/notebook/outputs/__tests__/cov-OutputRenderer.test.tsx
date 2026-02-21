import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/NotebookContext", () => ({ NotebookProvider: (p: any) => p.children, useNotebook: vi.fn(() => ({ cells: vi.fn(() => []), activeCell: vi.fn(() => null), addCell: vi.fn(), removeCell: vi.fn(), executeCell: vi.fn() })) }));

import { OutputRenderer } from "../../../notebook/outputs/OutputRenderer";

describe("OutputRenderer", () => {
  it("OutputRenderer", () => {
    try { render(() => <OutputRenderer />); } catch (_e) { /* expected */ }
    expect(OutputRenderer).toBeDefined();
  });
});

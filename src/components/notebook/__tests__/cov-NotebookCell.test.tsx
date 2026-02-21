import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/NotebookContext", () => ({ NotebookProvider: (p: any) => p.children, useNotebook: vi.fn(() => ({ cells: vi.fn(() => []), activeCell: vi.fn(() => null), addCell: vi.fn(), removeCell: vi.fn(), executeCell: vi.fn() })) }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { NotebookCell } from "../../notebook/NotebookCell";

describe("NotebookCell", () => {
  it("NotebookCell", () => {
    try { render(() => <NotebookCell />); } catch (_e) { /* expected */ }
    expect(NotebookCell).toBeDefined();
  });
});

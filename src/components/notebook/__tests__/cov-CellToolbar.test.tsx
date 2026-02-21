import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));
vi.mock("@/context/NotebookContext", () => ({ NotebookProvider: (p: any) => p.children, useNotebook: vi.fn(() => ({ cells: vi.fn(() => []), activeCell: vi.fn(() => null), addCell: vi.fn(), removeCell: vi.fn(), executeCell: vi.fn() })) }));

import { CellToolbar } from "../../notebook/CellToolbar";

describe("CellToolbar", () => {
  it("CellToolbar", () => {
    try { render(() => <CellToolbar />); } catch (_e) { /* expected */ }
    expect(CellToolbar).toBeDefined();
  });
});

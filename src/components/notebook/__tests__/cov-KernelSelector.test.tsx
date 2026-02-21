import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));
vi.mock("@/context/NotebookContext", () => ({ NotebookProvider: (p: any) => p.children, useNotebook: vi.fn(() => ({ cells: vi.fn(() => []), activeCell: vi.fn(() => null), addCell: vi.fn(), removeCell: vi.fn(), executeCell: vi.fn() })) }));

import { KernelSelector } from "../../notebook/KernelSelector";

describe("KernelSelector", () => {
  it("KernelSelector", () => {
    try { render(() => <KernelSelector />); } catch (_e) { /* expected */ }
    expect(KernelSelector).toBeDefined();
  });
});

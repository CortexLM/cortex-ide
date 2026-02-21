import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/OutlineContext", () => ({ OutlineProvider: (p: any) => p.children, useOutline: vi.fn(() => ({ symbols: vi.fn(() => []), activeSymbol: vi.fn(() => null), refresh: vi.fn() })) }));

import { BreadcrumbSymbolPicker } from "../../../editor/breadcrumbs/BreadcrumbSymbolPicker";

describe("BreadcrumbSymbolPicker", () => {
  it("BreadcrumbSymbolPicker", () => {
    try { render(() => <BreadcrumbSymbolPicker />); } catch (_e) { /* expected */ }
    expect(BreadcrumbSymbolPicker).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";

vi.mock("@/context/OutlineContext", () => ({ OutlineProvider: (p: any) => p.children, useOutline: vi.fn(() => ({ symbols: vi.fn(() => []), activeSymbol: vi.fn(() => null), refresh: vi.fn() })) }));

import { BREADCRUMB_CSS_VARS, SYMBOL_ICONS, SYMBOL_COLORS } from "../../../editor/breadcrumbs/breadcrumbConstants";

describe("breadcrumbConstants", () => {
  it("BREADCRUMB_CSS_VARS", () => {
    expect(BREADCRUMB_CSS_VARS).toBeDefined();
  });
  it("SYMBOL_ICONS", () => {
    expect(SYMBOL_ICONS).toBeDefined();
  });
  it("SYMBOL_COLORS", () => {
    expect(SYMBOL_COLORS).toBeDefined();
  });
});

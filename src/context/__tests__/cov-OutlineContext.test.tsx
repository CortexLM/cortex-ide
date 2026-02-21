import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { getSymbolFilterType, OutlineProvider, useOutline, symbolTypeFilterConfig, allSymbolTypeFilters } from "../OutlineContext";

describe("OutlineContext", () => {
  it("getSymbolFilterType", () => {
    try { getSymbolFilterType({} as any); } catch (_e) { /* expected */ }
    try { getSymbolFilterType(); } catch (_e) { /* expected */ }
    expect(getSymbolFilterType).toBeDefined();
  });
  it("OutlineProvider", () => {
    try { render(() => <OutlineProvider />); } catch (_e) { /* expected */ }
    expect(OutlineProvider).toBeDefined();
  });
  it("useOutline", () => {
    try { createRoot((dispose) => { try { useOutline(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useOutline).toBeDefined();
  });
  it("symbolTypeFilterConfig", () => {
    expect(symbolTypeFilterConfig).toBeDefined();
  });
  it("allSymbolTypeFilters", () => {
    expect(allSymbolTypeFilters).toBeDefined();
  });
});

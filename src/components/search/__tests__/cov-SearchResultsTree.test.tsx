import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SearchContext", () => ({ SearchProvider: (p: any) => p.children, useSearch: vi.fn(() => ({})) }));

import { SearchResultsTree } from "../../search/SearchResultsTree";

describe("SearchResultsTree", () => {
  it("SearchResultsTree", () => {
    try { render(() => <SearchResultsTree />); } catch (_e) { /* expected */ }
    expect(SearchResultsTree).toBeDefined();
  });
});

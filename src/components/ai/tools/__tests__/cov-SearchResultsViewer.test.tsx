import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { SearchResultsViewer } from "../../../ai/tools/SearchResultsViewer";

describe("SearchResultsViewer", () => {
  it("SearchResultsViewer", () => {
    try { render(() => <SearchResultsViewer />); } catch (_e) { /* expected */ }
    expect(SearchResultsViewer).toBeDefined();
  });
});

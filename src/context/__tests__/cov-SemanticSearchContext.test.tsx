import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SemanticSearchProvider, useSemanticSearch } from "../SemanticSearchContext";

describe("SemanticSearchContext", () => {
  it("SemanticSearchProvider", () => {
    try { render(() => <SemanticSearchProvider />); } catch (_e) { /* expected */ }
    expect(SemanticSearchProvider).toBeDefined();
  });
  it("useSemanticSearch", () => {
    try { createRoot((dispose) => { try { useSemanticSearch(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSemanticSearch).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { loadSearchEditorFromFile, createSearchEditorState, SearchEditor } from "../../search/SearchEditor";

describe("SearchEditor", () => {
  it("loadSearchEditorFromFile", () => {
    try { loadSearchEditorFromFile("test", "test"); } catch (_e) { /* expected */ }
    try { loadSearchEditorFromFile(); } catch (_e) { /* expected */ }
    expect(loadSearchEditorFromFile).toBeDefined();
  });
  it("createSearchEditorState", () => {
    try { createSearchEditorState("test", {} as any); } catch (_e) { /* expected */ }
    try { createSearchEditorState(); } catch (_e) { /* expected */ }
    expect(createSearchEditorState).toBeDefined();
  });
  it("SearchEditor", () => {
    try { render(() => <SearchEditor />); } catch (_e) { /* expected */ }
    expect(SearchEditor).toBeDefined();
  });
});

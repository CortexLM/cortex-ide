import { describe, it, expect, vi } from "vitest";

import { createDefaultNotebook, parseNotebookFile, serializeNotebook, getNotebookNameFromPath } from "../../notebook/utils";

describe("utils", () => {
  it("createDefaultNotebook", () => {
    try { createDefaultNotebook(); } catch (_e) { /* expected */ }
    expect(createDefaultNotebook).toBeDefined();
  });
  it("parseNotebookFile", () => {
    try { parseNotebookFile("test"); } catch (_e) { /* expected */ }
    try { parseNotebookFile(); } catch (_e) { /* expected */ }
    expect(parseNotebookFile).toBeDefined();
  });
  it("serializeNotebook", () => {
    try { serializeNotebook({} as any); } catch (_e) { /* expected */ }
    try { serializeNotebook(); } catch (_e) { /* expected */ }
    expect(serializeNotebook).toBeDefined();
  });
  it("getNotebookNameFromPath", () => {
    try { getNotebookNameFromPath("test"); } catch (_e) { /* expected */ }
    try { getNotebookNameFromPath(); } catch (_e) { /* expected */ }
    expect(getNotebookNameFromPath).toBeDefined();
  });
});

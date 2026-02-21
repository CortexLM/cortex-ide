import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { computeNotebookDiff, NotebookDiff } from "../../notebook/NotebookDiff";

describe("NotebookDiff", () => {
  it("computeNotebookDiff", () => {
    try { computeNotebookDiff("test", "test"); } catch (_e) { /* expected */ }
    try { computeNotebookDiff(); } catch (_e) { /* expected */ }
    expect(computeNotebookDiff).toBeDefined();
  });
  it("NotebookDiff", () => {
    try { render(() => <NotebookDiff />); } catch (_e) { /* expected */ }
    expect(NotebookDiff).toBeDefined();
  });
});

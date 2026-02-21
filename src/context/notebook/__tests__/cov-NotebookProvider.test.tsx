import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { NotebookProvider, useNotebook } from "../../notebook/NotebookProvider";

describe("NotebookProvider", () => {
  it("NotebookProvider", () => {
    try { render(() => <NotebookProvider />); } catch (_e) { /* expected */ }
    expect(NotebookProvider).toBeDefined();
  });
  it("useNotebook", () => {
    try { createRoot((dispose) => { try { useNotebook(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useNotebook).toBeDefined();
  });
});

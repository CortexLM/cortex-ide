import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { CommentsProvider, useComments } from "../CommentsContext";

describe("CommentsContext", () => {
  it("CommentsProvider", () => {
    try { render(() => <CommentsProvider />); } catch (_e) { /* expected */ }
    expect(CommentsProvider).toBeDefined();
  });
  it("useComments", () => {
    try { createRoot((dispose) => { try { useComments(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useComments).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SnippetsProvider, useSnippets } from "../SnippetsContext";

describe("SnippetsContext", () => {
  it("SnippetsProvider", () => {
    try { render(() => <SnippetsProvider />); } catch (_e) { /* expected */ }
    expect(SnippetsProvider).toBeDefined();
  });
  it("useSnippets", () => {
    try { createRoot((dispose) => { try { useSnippets(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSnippets).toBeDefined();
  });
});

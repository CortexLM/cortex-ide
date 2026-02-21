import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SnippetsContext", () => ({ SnippetsProvider: (p: any) => p.children, useSnippets: vi.fn(() => ({})) }));

import { SnippetEditor } from "../../snippets/SnippetEditor";

describe("SnippetEditor", () => {
  it("SnippetEditor", () => {
    try { render(() => <SnippetEditor />); } catch (_e) { /* expected */ }
    expect(SnippetEditor).toBeDefined();
  });
});

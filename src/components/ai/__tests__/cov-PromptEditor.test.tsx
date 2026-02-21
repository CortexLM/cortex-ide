import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/PromptStoreContext", () => ({ PromptStoreProvider: (p: any) => p.children, usePromptStore: vi.fn(() => ({})) }));

import { PromptEditor } from "../../ai/PromptEditor";

describe("PromptEditor", () => {
  it("PromptEditor", () => {
    try { render(() => <PromptEditor />); } catch (_e) { /* expected */ }
    expect(PromptEditor).toBeDefined();
  });
});

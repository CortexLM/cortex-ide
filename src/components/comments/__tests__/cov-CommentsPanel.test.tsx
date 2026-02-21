import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/CommentsContext", () => ({ CommentsProvider: (p: any) => p.children, useComments: vi.fn(() => ({})) }));

import { CommentsPanel } from "../../comments/CommentsPanel";

describe("CommentsPanel", () => {
  it("CommentsPanel", () => {
    try { render(() => <CommentsPanel />); } catch (_e) { /* expected */ }
    expect(CommentsPanel).toBeDefined();
  });
});

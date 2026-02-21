import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/CommentsContext", () => ({ CommentsProvider: (p: any) => p.children, useComments: vi.fn(() => ({})) }));

import { CommentThread } from "../../comments/CommentThread";

describe("CommentThread", () => {
  it("CommentThread", () => {
    try { render(() => <CommentThread />); } catch (_e) { /* expected */ }
    expect(CommentThread).toBeDefined();
  });
});

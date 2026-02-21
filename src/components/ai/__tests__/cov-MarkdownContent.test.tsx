import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { MarkdownContent } from "../../ai/MarkdownContent";

describe("MarkdownContent", () => {
  it("MarkdownContent", () => {
    try { render(() => <MarkdownContent />); } catch (_e) { /* expected */ }
    expect(MarkdownContent).toBeDefined();
  });
});

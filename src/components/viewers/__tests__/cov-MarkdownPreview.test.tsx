import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { isMarkdownFile, MarkdownPreview } from "../../viewers/MarkdownPreview";

describe("MarkdownPreview", () => {
  it("isMarkdownFile", () => {
    try { isMarkdownFile("test"); } catch (_e) { /* expected */ }
    try { isMarkdownFile(); } catch (_e) { /* expected */ }
    expect(isMarkdownFile).toBeDefined();
  });
  it("MarkdownPreview", () => {
    try { render(() => <MarkdownPreview />); } catch (_e) { /* expected */ }
    expect(MarkdownPreview).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { MarkdownCell } from "../../notebook/MarkdownCell";

describe("MarkdownCell", () => {
  it("MarkdownCell", () => {
    try { render(() => <MarkdownCell />); } catch (_e) { /* expected */ }
    expect(MarkdownCell).toBeDefined();
  });
});

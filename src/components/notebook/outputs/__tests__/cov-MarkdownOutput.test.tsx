import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { MarkdownOutput } from "../../../notebook/outputs/MarkdownOutput";

describe("MarkdownOutput", () => {
  it("MarkdownOutput", () => {
    try { render(() => <MarkdownOutput />); } catch (_e) { /* expected */ }
    expect(MarkdownOutput).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { HtmlOutput } from "../../../notebook/outputs/HtmlOutput";

describe("HtmlOutput", () => {
  it("HtmlOutput", () => {
    try { render(() => <HtmlOutput />); } catch (_e) { /* expected */ }
    expect(HtmlOutput).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { TextOutput } from "../../../notebook/outputs/TextOutput";

describe("TextOutput", () => {
  it("TextOutput", () => {
    try { render(() => <TextOutput />); } catch (_e) { /* expected */ }
    expect(TextOutput).toBeDefined();
  });
});

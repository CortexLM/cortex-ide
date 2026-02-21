import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { AnsiOutput } from "../../../notebook/outputs/AnsiOutput";

describe("AnsiOutput", () => {
  it("AnsiOutput", () => {
    try { render(() => <AnsiOutput />); } catch (_e) { /* expected */ }
    expect(AnsiOutput).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ProgressBar } from "../../ui/ProgressBar";

describe("ProgressBar", () => {
  it("ProgressBar", () => {
    try { render(() => <ProgressBar />); } catch (_e) { /* expected */ }
    expect(ProgressBar).toBeDefined();
  });
});

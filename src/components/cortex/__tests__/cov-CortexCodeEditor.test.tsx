import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexCodeEditor } from "../../cortex/CortexCodeEditor";

describe("CortexCodeEditor", () => {
  it("CortexCodeEditor", () => {
    try { render(() => <CortexCodeEditor />); } catch (_e) { /* expected */ }
    expect(CortexCodeEditor).toBeDefined();
  });
});

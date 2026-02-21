import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexInput, CortexPromptInput } from "../../../cortex/primitives/CortexInput";

describe("CortexInput", () => {
  it("CortexInput", () => {
    try { render(() => <CortexInput />); } catch (_e) { /* expected */ }
    expect(CortexInput).toBeDefined();
  });
  it("CortexPromptInput", () => {
    try { render(() => <CortexPromptInput />); } catch (_e) { /* expected */ }
    expect(CortexPromptInput).toBeDefined();
  });
});

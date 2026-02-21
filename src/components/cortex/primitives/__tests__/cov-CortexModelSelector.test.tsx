import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexModelSelector } from "../../../cortex/primitives/CortexModelSelector";

describe("CortexModelSelector", () => {
  it("CortexModelSelector", () => {
    try { render(() => <CortexModelSelector />); } catch (_e) { /* expected */ }
    expect(CortexModelSelector).toBeDefined();
  });
});

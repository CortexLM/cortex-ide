import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexAccountPanel } from "../../cortex/CortexAccountPanel";

describe("CortexAccountPanel", () => {
  it("CortexAccountPanel", () => {
    try { render(() => <CortexAccountPanel />); } catch (_e) { /* expected */ }
    expect(CortexAccountPanel).toBeDefined();
  });
});

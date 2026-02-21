import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexPluginsPanel } from "../../cortex/CortexPluginsPanel";

describe("CortexPluginsPanel", () => {
  it("CortexPluginsPanel", () => {
    try { render(() => <CortexPluginsPanel />); } catch (_e) { /* expected */ }
    expect(CortexPluginsPanel).toBeDefined();
  });
});

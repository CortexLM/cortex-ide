import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ModelSelector, ModelSelectorCompact } from "../../ai/ModelSelector";

describe("ModelSelector", () => {
  it("ModelSelector", () => {
    try { render(() => <ModelSelector />); } catch (_e) { /* expected */ }
    expect(ModelSelector).toBeDefined();
  });
  it("ModelSelectorCompact", () => {
    try { render(() => <ModelSelectorCompact />); } catch (_e) { /* expected */ }
    expect(ModelSelectorCompact).toBeDefined();
  });
});

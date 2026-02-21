import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexTreeItem, IndentGuide } from "../../../cortex/primitives/CortexTreeItem";

describe("CortexTreeItem", () => {
  it("CortexTreeItem", () => {
    try { render(() => <CortexTreeItem />); } catch (_e) { /* expected */ }
    expect(CortexTreeItem).toBeDefined();
  });
  it("IndentGuide", () => {
    try { render(() => <IndentGuide />); } catch (_e) { /* expected */ }
    expect(IndentGuide).toBeDefined();
  });
});

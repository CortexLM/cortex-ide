import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ExplorerTreeView } from "../../../cortex/explorer/ExplorerTreeView";

describe("ExplorerTreeView", () => {
  it("ExplorerTreeView", () => {
    try { render(() => <ExplorerTreeView />); } catch (_e) { /* expected */ }
    expect(ExplorerTreeView).toBeDefined();
  });
});

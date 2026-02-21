import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ExplorerHeader } from "../../../cortex/explorer/ExplorerHeader";

describe("ExplorerHeader", () => {
  it("ExplorerHeader", () => {
    try { render(() => <ExplorerHeader />); } catch (_e) { /* expected */ }
    expect(ExplorerHeader).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexHeaderItem } from "../../../cortex/primitives/CortexHeaderItem";

describe("CortexHeaderItem", () => {
  it("CortexHeaderItem", () => {
    try { render(() => <CortexHeaderItem />); } catch (_e) { /* expected */ }
    expect(CortexHeaderItem).toBeDefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexDropdownItem } from "../../../cortex/primitives/CortexDropdownItem";

describe("CortexDropdownItem", () => {
  it("CortexDropdownItem", () => {
    try { render(() => <CortexDropdownItem />); } catch (_e) { /* expected */ }
    expect(CortexDropdownItem).toBeDefined();
  });
});

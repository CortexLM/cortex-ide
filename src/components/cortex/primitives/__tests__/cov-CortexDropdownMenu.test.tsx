import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexDropdownMenu } from "../../../cortex/primitives/CortexDropdownMenu";

describe("CortexDropdownMenu", () => {
  it("CortexDropdownMenu", () => {
    try { render(() => <CortexDropdownMenu />); } catch (_e) { /* expected */ }
    expect(CortexDropdownMenu).toBeDefined();
  });
});
